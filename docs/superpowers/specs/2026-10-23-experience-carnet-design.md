# Expérience « carnet » : la direction des maquettes et la recherche en images (lot UI, rév. 2, 23 octobre 2026)

Base : `main` `05c751f` (chaîne A → F en ligne, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, suite 5948/5948, épingle 5947).
Demande de Neegan (23 octobre, 16 h 57 HAE, capture de l'onglet Web) : « je ne vois toujours pas d'images qui accompagnent les
recherches, et cela ne ressemble pas aux maquettes que je t'ai fournies » ; « ok oui go, pour améliorer l'expérience UI/UX ».
Références : le dossier de passation du 18 octobre, `docs/maquettes/2026-10-18-mitsu-claude-code/` (sept maquettes, réduites en JPEG ;
`03_PARCOURS_ET_DIRECTION_VISUELLE.md` fait foi sur les images : « une direction à adapter à Mitsu », § 7 « les textes fonctionnels
priment sur les petites incohérences des images ») ; la décision D-9 du lot A (18 octobre) qui avait mis cette direction hors lot ;
la spec « Refonte visuelle » (`2026-10-18-refonte-visuelle-design.md`, V-1 à V-6, T-1 à T-11, R-VIS-1 à R-VIS-14) que ce lot amende ;
la spec « Les plats en images » (`2026-10-19-plats-en-images-design.md`, D-F3, I-F2, I-F3, I-F6, D-F9, D-F11) qu'il respecte.
Cartographie préalable (cinq lectures en parallèle, 23 octobre) : `.superpowers/sdd/2026-10-23-experience-carnet/cartographie.md`.
Rév. 2 : après la revue adverse de la rév. 1 (trois lentilles, 63 constats, aucun Critical : § 12).

Deux volets, deux plans, deux branches : **UI-2 « Aperçus »** (un outil serveur sans modèle qui rend les images des résultats web, une
migration `0007`, un redéploiement ; la première phrase de Neegan) et **UI-1 « Carnet »** (thème, composition des écrans, textes, icônes :
aucun serveur ; la seconde phrase). UI-2 se construit d'abord (le lot le plus court et le plus indépendant) ; UI-1 suit ; chacun fusionne
sans attendre l'autre (§ 9).

## 0. Décisions (chacune renversable sans défaire le reste ; prises le 23 octobre, à confirmer par Neegan)

- **D-UI-1 Adapter, pas copier.** Les maquettes fixent la direction (crème, olive, grandes photos, titres serif généreux, filets fins au
  lieu de cartes à ombre) ; les parcours, les écrans, la navigation, les données et les libellés qui portent une règle du produit restent
  ceux de l'app. Rien n'est inventé pour ressembler à une image (§ 8).
- **D-UI-2 L'olive devient la couleur d'action — ce qui renverse V-4 (§ 13, point 0).** `--action` passe de la tomate `#bc3026` à l'olive
  `#4f6b2e` (5,55 sur papier, 5,95 sur carte, 4,97 sur `--accent-bg`, 5,14 sur `--paper-2`), `--action-2` (survol) `#3e5424` (papier dessus
  7,72), `--action-bg` `#e9eddf` (gris `--muted` dessus 4,80, ambre 4,71), `--tap` `rgba(79,107,46,.15)`. Le vert gris des états
  (`--accent #45604a`, `--ok`) reste ; la brique `--danger` reste le seul rouge. V-2 et V-4 de la refonte visuelle sont amendés (§ 12).
  Règle vérifiable : un ÉTAT n'est jamais un bouton plein olive ni un texte olive (badge « Original », statut ok, puce cochée = vert gris,
  jamais `.btn.primary`) ; l'action (bouton plein, lien, onglet actif, anneau de focus) n'emprunte jamais le vert gris ; la galerie de la
  preuve visuelle montre un badge « Original » à côté d'un `.btn.primary` pour que l'œil les distingue (§ 7).
- **D-UI-3 Titres plus grands, police système.** Titres de PAGE (`pageHeader` d'Aujourd'hui, Bibliothèque, Ajouter, Ma semaine, Ma
  cuisine, Réglages) : `h1` `clamp(1.8rem, 6vw, 2.6rem)` (3,2 rem ≥ 900 px) ; titres de FICHE (recette, livre : `h1.titre-fiche`) :
  `clamp(1.5rem, 4.5vw, 2.2rem)` (2,6 rem ≥ 900 px), pour qu'un titre long (« The Particular Sadness of Lemon Cake ») tienne en deux
  lignes à 375 px ; `h2` 1,6 rem ; titre de carte-plat en serif 1,3 rem ; `--serif` reste Georgia (la CSP n'admet aucune police externe
  et V-2 le veut ainsi). La barre haute garde 64 px et sa marque 44 px.
- **D-UI-4 La bibliothèque s'ouvre sur les plats.** `#/library` gagne un troisième segment, **« Recettes »**, par défaut : la grille des
  recettes (deux colonnes dès 360 px, trois ≥ 900 px) en cartes-plat (D-UI-5), un champ « Une recette, un ingrédient… » qui filtre
  localement, les filtres **Toutes / De mes livres / Du web** calculés sur les données (`edition_id`, `source_url` ; une fiche qui a les
  deux est dans les deux), l'action principale « Ajouter une recette » (→ `#/add`) dans l'en-tête et, sous 760 px, répétée en bouton
  pleine largeur sous la grille (maquette mobile 01), et en pied « Recettes de mes livres à importer → » vers la liste des références.
  « Livres » (avec « Ajouter un livre ») et « Plats » gardent leurs écrans. L'entrée de navigation garde sa route `/library` et prend le
  libellé « Bibliothèque » (en.js « Library ») ; les retours « ← Mes livres » (recipe.js:88, book.js:121) et la carte d'accueil
  « Aller à Mes livres. » (accueil-livre.js:14) suivent (« ← Bibliothèque », « Aller à la bibliothèque. ») ; le segment « Mes livres » de
  la RECHERCHE (`MODES`, search.js:18) garde son libellé : il nomme une portée de recherche, pas l'écran.
- **D-UI-5 La carte-plat.** `recipeCard(doc, { photoEnTete: true, fichier })` : l'appelant passe la ligne `files` lue en une fois
  (`repo.getFiles`), la carte décide au rendu, de façon synchrone ; QUAND `typeAffichage(fichier)` est une image (I-F6, I-UI-5), une image
  4:3 (`img.plat-vignette.grande`, `displayUrl(fichier, urlDeBlob)`) au-dessus du titre serif et d'une ligne « Du web · {hôte} · 35 min »
  ou « De mon livre · {titre} · 40 min » (durée = `total_minutes ?? prep + cook`, UN nombre par `formatMinutes`, jamais la paire
  « actif · total » ; rien sans durée) ; SANS photo, une seule forme : `a.item-link.carte-plat.sans-photo`, un bloc de titre serif sur
  `--paper-2` (même rayon 12, hauteur minimale 7 rem pour aligner les rangées), la même ligne de source dessous ; jamais de cadre vide ni
  d'image générique. L'image garde la classe `plat-vignette` (révocation D-T9). La carte horizontale actuelle reste le défaut partout
  ailleurs.
- **D-UI-6 La fiche recette en deux colonnes.** ≥ 760 px : [en-tête : état, titre, provenance, « Voir la page d'origine ↗ », repères
  « 4 portions · 35 min », « Commencer à cuisiner » + « Corriger »] | [photo du plat, pleine largeur de colonne, 4:3] ; puis
  [Ingrédients] | [Préparation]. < 760 px : photo pleine largeur sous la provenance, repères, puis un `segmented` **Ingrédients /
  Préparation** (bascule locale, sans navigation ni appel), « Commencer à cuisiner » pleine largeur, « Corriger » en lien texte à côté
  tant que la version affichée n'est pas vérifiée (le seul geste que « — vérifie » et « {n} lignes à vérifier » réclament). Le −/+ des
  portions, Unités, Langue, le sélecteur de versions, « Créer ma version », « Adapter avec l'IA », repas, épicerie, plat, export passent
  sous un `details[data-role=autres-gestes]` « Portions, versions et autres gestes » (jamais « Réglages » : l'app a déjà un écran de ce
  nom). Le style inline 320 px de la photo disparaît. La bascule et l'ouverture du `details` suivent un `matchMedia('(min-width: 760px)')`
  injectable (`deps.matchMedia`, défaut `window.matchMedia`), écouté sur `change` : les deux sections sont toujours dans le DOM ; en
  large aucune n'a `hidden` et le `segmented` est `hidden` ; le choix mémorisé dans l'instance survit à `drawBody()`.
- **D-UI-7 La fiche livre en deux colonnes.** ≥ 900 px (`div.two-col.livre`, `200px 1fr`, classe neuve) : gauche = `bookCover`
  ≈ 200 px, la section « Couverture » actuelle (`.card`, ses gestes inchangés : Télécharger, Réessayer, Photographier, Choisir),
  métadonnées repliées (`details` inchangé), « Sommaire » (vignettes des pages d'index) ; droite = `pageHeader` déjà passé (titre,
  sous-titre « {auteur} · {n} disponible(s) · {m} à importer », ACTIONS gardées en tête : les deux menus `details.menu-source` d'aujourd'hui,
  renommés « Ajouter des recettes » (Photographier / Choisir des photos ou un PDF ; plusieurs recettes à la fois = lot D) et « Ajouter des
  pages de sommaire »), les rappels, puis « Les recettes de ce livre » : filtres, liste COMPACTE « vignette 48 px si octets · titre · p. N ·
  badge » avec « Importer » (référence sans adresse) et « Saisir à la main » (même `href` qu'aujourd'hui) sur la ligne. < 900 px : la même
  chose empilée, la liste limitée à 8 lignes puis « Voir les {n} recettes » (déplie sur place, sans navigation) pour que les actions
  restent atteignables. Les trois chips d'état du menu disparaissent (la phrase du sous-titre les remplace) ; la vignette de la liste
  tient D-F9.
- **D-UI-8 Les listes sur le papier, section par section.** `section(title, …, { plain: true })` rend `section.plain` (sans fond ni ombre,
  `h2` serif, filet fin `--line` sous le titre) ; sans l'option, `section.card` reste le défaut (54 appelants dans 17 modules : rien ne
  change hors des sections nommées en § 4). Chaque tâche liste les sections qu'elle bascule et amende leurs tests (§ 7).
- **D-UI-9 Icônes au trait.** Un module `src/ui/icones.js` de vingt-deux SVG inline monochromes (`currentColor`, `aria-hidden`, `icone(nom)`
  lève sur un nom inconnu) remplace les émojis de la navigation (`app.js`), de la grille Ajouter (`add.js:29-34`), de l'accueil d'un livre
  (`accueil-livre.js:12-14`) et des onze états vides (`emptyState`, § 3.3) ; les émojis restent dans les textes de contenu.
- **D-UI-10 Libellés d'affichage.** « À importer » pour une référence sans adresse dans les listes, badges, compteurs et filtres
  (`availabilityBadge` → « À importer · p. {p} » ; `label('availability', 'reference_only')` → « À importer », suivi par les exports et
  Redécouvrir) ; « Disponible » pour le badge court ; « Repérée dans ton livre — page {p} » reste sur la fiche (il dit d'où elle vient) ;
  « Voir la page d'origine ↗ » (lien texte, même `data-role`) remplace « Ouvrir le lien » partout (fiche, bloc du signet, écran d'import
  web) sur TOUTE adresse lisible, `http:` compris (I-B5 : seule la LECTURE exige https) ; « Ajouter des recettes » et « Ajouter des pages
  de sommaire » remplacent « + Recette » et « + Pages d'index ». La phrase « Texte conservé dans Mitsu » de la rév. 1 est retirée (elle
  nommait la marque et doublait « — vérifie »). `availability` et les statuts du journal ne changent pas (doc 03 § 5).
- **D-UI-11 La marque reste « Cuisine OS »** (titre, manifeste, icône, nom sur l'iPhone) : « mitsu » des maquettes est le nom du projet,
  pas celui de l'app ; à trancher par Neegan (§ 13).
- **D-UI-12 Les aperçus des résultats web (UI-2).** Un sixième outil serveur, **`apercu-web`**, sans modèle : pour au plus 5 adresses
  (celles des liens choisis d'une recherche), la fonction télécharge chaque page (bornes de `lecture-web`), en tire l'adresse d'image par
  LA règle de F (`lirePageHtml(...).page.image_url` : `Recipe` lisible retenu, sinon `og:image` hors page de liste), télécharge l'image
  (bornes d'`image-web`, ≤ 1 Mio par image) et rend une entrée par adresse reçue ; **un appel du quota pour les cinq**, zéro jeton.
  Forme exacte : § 6. Côté app, la vignette (4:3, classe `plat-vignette`) s'affiche par blob local, jamais par une adresse `https` (I-F3,
  CSP inchangée), après le mur de pixels de F (I-F2). Rien n'est écrit dans `files` : une mémoire vive par adresse (`Map(href → aperçu)`,
  échecs compris) à côté de la mémoire des liens ; les URL `blob:` sont révoquées au redessin et au changement de route (D-T9), les Blob
  vivent et meurent avec la mémoire des liens.
- **D-UI-13 Les aperçus sont automatiques, un appel de plus par recherche — défaut à confirmer (§ 13, point 2).** Quand une vue connectée
  rend un « trouvé », l'app demande les aperçus des adresses qu'elle ne connaît pas encore (un vol d'aperçus unique, annulable) ; le texte
  de garde dit AVANT la tape « Une recherche = 2 appels à l'assistant (résultats, puis photos), comptés dans ton quota du jour. » ; une
  ligne d'état sous « Demande envoyée » dit « Photos en cours de récupération… », puis disparaît (au moins une image), ou devient « Photos
  indisponibles pour cette recherche. » (aucune image, échec, `0007` absente) ou « Quota du jour atteint : photos indisponibles. » (429
  écrit par la passerelle) ; les figures sont insérées en UNE fois pour toute la liste, jamais carte par carte. Renversable vers une tape
  « Voir les photos (1 appel) ».
- **D-UI-14 UI-2 exige `0007`.** La contrainte `outil` du journal passe à six valeurs ; `0007` est écrite à la main comme `0004` et `0006`,
  collée par Neegan AVANT le redéploiement et AVANT le push de UI-2 ; sans elle, chaque aperçu répond 502 sans ligne comptée (l'insert
  lève 23514 avant la réservation) et l'app montre les résultats sans image (comportement dégradé de D-UI-13, jamais une erreur bloquante).

## 1. Pour toi

Tu verras la photo des plats dans l'onglet Web dès les résultats, et l'app prend l'allure des maquettes : papier crème, olive pour ce qui
se touche, grands titres, et de grandes photos de plats partout où tu en as. « Bibliothèque » s'ouvre sur tes recettes en grille, avec
leur photo quand tu l'as, les filtres De mes livres / Du web et le bouton « Ajouter une recette » ; tes livres et tes plats sont à côté. Une
fiche de recette met la photo en regard du titre sur le Mac, en pleine largeur sur l'iPhone, puis Ingrédients et Préparation côte à côte
(ou en deux onglets sur l'iPhone) ; « Commencer à cuisiner » reste le grand bouton et « Corriger » reste à portée tant que tu n'as pas
relu. Une fiche de livre montre la couverture et le sommaire à gauche, la liste des recettes à droite avec « Disponible » ou « À
importer » et « Importer » sur la ligne. Dans l'onglet Web, chaque résultat vient avec la photo de la page quand le site en publie une :
c'est un appel de plus de ton quota par recherche (deux au lieu d'un, dit avant la tape), jamais une page ni une image chargée depuis ton
appareil. Rien n'est inventé : pas de photo quand il n'y en a pas, pas de sous-titre ni de durée sans donnée, « vérifie » reste affiché tant
que tu n'as pas relu. Les écrans que les maquettes ne montrent pas (Réglages, Ma semaine, Ma cuisine, le mode cuisine, l'épicerie) ne
changent que de couleurs et de titres.

## 2. Invariants

- **I-UI-1 Aucune règle de produit ne bouge.** L'original n'est jamais réécrit (« Corriger » crée une version) ; un signet n'est pas une
  recette conservée (il garde son badge « Lien web » là où il paraît) ; « Disponible » seulement après enregistrement ; **un geste = un
  nombre d'appels annoncé AVANT la tape** (une recherche illustrée en annonce deux) ; aucune donnée inventée (pas de sous-titre, de titre
  d'étape, de durée, de « Livre reconnu » sans « vérifie ») ; le segment « Web » de la recherche reste l'appel payant, distinct du filtre
  « Du web » de la bibliothèque ; « Voir la page d'origine » reste offert sur toute adresse lisible (I-B5).
- **I-UI-2 Aucune image distante.** `img-src 'self' blob: data:` inchangée ; toute image vient d'un blob local (I-F3) ; l'adresse IP de
  l'appareil ne part jamais chez un site (D-F3) ; les aperçus passent par la fonction, avec ses hôtes refusés, sa boucle de redirections
  et son `User-Agent` ; une image reçue passe le mur de pixels de F avant tout `<img>` (I-F2 : type de l'en-tête = type annoncé, ≤ 16 Mpx,
  petit côté ≥ 200 px).
- **I-UI-3 Aucune classe JS renommée, aucune route retirée, aucun écran retiré de la navigation** (règle « une page sans lien n'existe
  pas ») ; `NAV`, `registerRoutes`, `ROUTES_DE_SAISIE` gardent leurs entrées ; les blocs épinglés par les tests de comportement (ordre des
  rangées d'une carte web, `.status[role=status]` suivie de `.row`, `data-role` des gestes) se déplacent avec leurs tests amendés, jamais
  en silence.
- **I-UI-4 Accessibilité mesurée, comme la refonte visuelle.** 28 paires + la paire neuve ≥ 4,5 ; contour des champs ≥ 3 (aucun champ
  posé sur `--action-bg`, où `--field-line` ne vaut que 2,89) ; cibles ≥ 44 px (36 pour `.btn.small`) ; focus visible ; mouvement réduit ;
  `[hidden]` et jamais une `display:none` neuve ; les vignettes décoratives gardent `alt=''` ; une image qui porte un sens a un nom ; le
  glisser garde Monter / Descendre ; toute règle neuve de `styles.css` respecte T-1, T-2 et T-11 de `tests/theme.js` (jetons seulement,
  jamais le mot « olive » en valeur, jamais 56 px hors `.btn.big`, survol sous `@media (hover: hover)`).
- **I-UI-5 Rien sans octets.** Une carte-plat ou une vignette de résultat n'existe que lorsque les octets sont là et de type image (liste
  blanche `typeAffichage`) ; la décision est prise AU RENDU, de façon synchrone, à partir de la ligne `files` passée à la carte ; sinon la
  carte sans photo ; aucune image générique, aucune photo IA substituée (B7).
- **I-UI-6 Un appel = une réservation, avant tout téléchargement** (I-B10) ; chaque adresse d'un aperçu est validée AVANT la réservation ;
  une adresse refusée est rendue `{ url, image: null, raison: 'interdit' }` et ne prive pas les autres ; la réservation n'a lieu que s'il
  reste au moins une adresse admise (422 sans réservation sinon) ; le journal ne porte que des compteurs.
- **I-UI-7 Versions.** Le premier lot FUSIONNÉ porte `APP_VERSION 0.16.0`, le second `0.17.0` ; pendant la construction UI-2 porte 0.16.0
  et UI-1 0.17.0 ; si l'ordre des fusions s'inverse, un commit de version renumérote le lot qui fusionne (schema.js, sw.js et les 13
  assertions + 1 commentaire des 8 suites : § 7). `sw.js` `cuisine-os-v0.1N.0-K`, +1 à chaque commit qui touche `src/`, `styles.css`,
  `index.html`, le manifeste ou `sw.js` (R-B-24) ; `SHELL` + `./src/ui/icones.js` (UI-1), + `./src/domain/apercu-web.js` (UI-2).

## 3. Direction visuelle (UI-1)

### 3.1 Jetons (styles.css `:root`, 29 jetons épinglés par `tests/theme.js:2, 27-28`)

| Jeton | Aujourd'hui | Demain | Pourquoi |
| --- | --- | --- | --- |
| `--action` | `#bc3026` | `#4f6b2e` | l'olive des maquettes ; 5,55 sur papier, 5,95 sur carte, 4,97 sur accent-bg, 5,14 sur paper-2 |
| `--action-2` | `#98231b` | `#3e5424` | survol ; papier dessus 7,72 |
| `--action-bg` | `#f7e3e0` | `#e9eddf` | fond pâle de l'action ; gris dessus 4,80, olive 5,08, ambre 4,71 ; jamais un champ dessus (2,89) |
| `--tap` | `rgba(188,48,38,.15)` | `rgba(79,107,46,.15)` | la même olive en touche |
| les 25 autres | inchangés | inchangés | papier, encre, gris, filets, accent, warn, danger, ok, rayons, ombre, polices, barre |

`theme-color`, le manifeste, `--sage` (`#b9c8bb`, en dur), `--accent-2` ne changent pas. Dans `tests/theme.js:27`, une seule des six
valeurs change (`--action`) ; `PAIRES` gagne UNE paire (olive sur `--paper-2`, 5,14 : les trois autres y sont déjà) ; les libellés de :27
et :93 (« en tomate ») sont réécrits ; recalcul par la formule du test : les 28 paires restent ≥ 4,5, minimum 4,62 inchangé.

### 3.2 Typographie et espaces

Titres de page et de fiche : D-UI-3 ; `h2` 1,6 rem, `h3` 1,15 rem ; sous-titre de page `p.muted` 1,05 rem ; titre de carte-plat `h3`
serif 1,3 rem ; `.brand` inchangée (1,25 rem, 44 px, barre 64 px) ; `.step-num` passe en `--paper-2` / `--ink` (cercle beige des
maquettes) ; espacement vertical des sections 1,6 rem. Aucune taille n'est épinglée hors la barre (`tests/theme.js:135`) et
`.search-bar input` 52. La preuve visuelle vérifie un titre de fiche long aux quatre largeurs.

### 3.3 Composants

- **`section(title, …, { plain })`** : `section.plain` seulement sur demande (D-UI-8) ; `section.card` reste le défaut. Basculent en
  `plain` : fiche recette « Ingrédients », « Préparation », « Original », « Versions », « Mémoire culinaire » ; fiche livre « Les recettes de
  ce livre », « Sommaire », « Pages et fichiers sources » ; Aujourd'hui « Favoris », « Dernières cuissons », « Reprendre ma recette »,
  « Redécouvrir », « À utiliser » ; Bibliothèque sous Livres « Liens web gardés », « Recettes créées avec l'IA ». Restent `.card` : les
  panneaux d'action (« Couverture », « Photo du plat », « Fichiers », « Pages d'index », import, questions, réglages, erreurs) et tout
  module hors § 4. `.card` ne change pas (R-VIS-14).
- **`recipeCard(doc, { photoEnTete, fichier })`** : variante verticale `a.item-link.carte-plat` : `img.plat-vignette.grande` 4:3
  (`object-fit: cover`, rayon 12) quand `fichier` est une image affichable, puis `h3` serif, puis une ligne `.muted` « {source} · {durée} »
  (D-UI-5) ; les badges (« À importer », « Lien web », favori, cuisinée) restent dans la carte ; sans photo : `a.item-link.carte-plat
  .sans-photo` (bloc de titre sur `--paper-2`, hauteur minimale 7 rem, ligne de source). Le balisage de la carte horizontale actuelle ne
  change pas (épinglé par `tests/photo-plat.js:1164-1179`). La règle `.plat-vignette` 72 px reste unique ; la règle neuve porte le
  sélecteur `.plat-vignette.grande` (l'épingle `tests/photo-plat.js:1320-1323` passe à « exactement deux sélecteurs »).
- **`grilleCartes(noeuds)`** : `div.grille-plats` (2 colonnes dès 360 px, 3 ≥ 900 px, `gap 1.2rem`, `align-items: stretch`) : classe neuve,
  `.grid` intact. Bornée : 60 cartes rendues, `getFiles` sur les empreintes des cartes rendues seulement, « Voir plus » rend la page
  suivante (F-9).
- **`pageHeader`** : inchangé (titre + sous-titre + actions) ; les écrans qui ne l'utilisaient pas (Aujourd'hui) l'adoptent.
- **`icones.js`** : `icone(nom)` → `svg[aria-hidden=true][focusable=false]` 24 × 24 au trait (`stroke: currentColor`), vingt-deux noms,
  relevés du code : navigation `soleil`, `bibliotheque`, `calendrier`, `toque`, `plus`, `roue` ; grille Ajouter `livres`, `appareil-photo`,
  `crayon`, `lien`, `etincelle`, `flocon` ; accueil d'un livre `page`, `horloge` ; états vides `panier` (grocery.js:21), `assiette`
  (library.js:103, dish.js:43), `couverts` (meals.js:18), `salade` (meals.js:79), `livre-ouvert` (book.js:176), `loupe` (search.js:162),
  `toque` (kitchen.js:30), `flocon` (kitchen.js:75), `appareil-photo` (import.js:68), `livres` (library.js:53) ; cartes et repères `globe`,
  `horloge`, `personnes`, `image`. Hors de la feuille de style : `tests/theme.js` ne les voit pas.
- **`bookCover`** : inchangé (R-UX-14, S3, tests/ajouter.js:1355-1373) ; la grille des livres garde `.grid`, les couvertures passent à
  `minmax(170px, 1fr)` par une classe `.grid.livres`.
- **`.two-col`** : inchangé (760 px) ; `.two-col.livre` (`200px 1fr` sous `@media (min-width: 900px)`) est neuve ; `.narrow-left`
  (sans appelant) n'est pas touchée.

## 4. Écrans (UI-1)

### 4.1 Bibliothèque (`src/ui/library.js`)

`pageHeader('Bibliothèque', { subtitle: 'Tes livres, tes trouvailles, tes recettes.', actions })` — `actions` = « Ajouter une recette »
(`a.btn.primary` → `#/add`) sur le segment Recettes, « Ajouter un livre » (→ `#/add/livre`, l'actuel) sur Livres, rien sur Plats —, puis
`segmented` **Recettes | Livres | Plats** (`?tab=recettes|books|dishes`, `recettes` par défaut ; `?tab=books` et `?tab=dishes` d'aujourd'hui
restent valides). Segment Recettes : champ `input[type=search]` « Une recette, un ingrédient… » (filtre local sur `ctx.docs` : titre,
ingrédients, livre, comme `library.js:66`), puces **Toutes / De mes livres / Du web** (`edition_id` non nul ; `source_url` non nul ; une
fiche qui a les deux est dans les deux), tri : dernière modification d'abord (§ 13, point 5), `grilleCartes` de `recipeCard(doc,
{ photoEnTete: true, fichier })` pour chaque recette dont **`availability !== 'reference_only' || source_url`** (les signets non lus sont
dedans, en carte sans photo avec le badge « Lien web » et sans durée ; les références d'index sont dehors), les octets des photos des 60
premières cartes lus en UNE fois par `repo.getFiles(...)` (comme les couvertures, library.js:57) et révoqués après chaque redessin (D-T9 :
`remplacerEnRevoquant` relève `img.plat-vignette`) ; « Voir plus » rend les 60 suivantes. Sous 760 px, « Ajouter une recette » est répété
en `a.btn.primary.big.block` sous la grille. Pied : « Recettes de mes livres à importer → » vers `#/library?tab=a-importer` : segment actif
Recettes, `back: 'Recettes'`, liste compacte des références sans adresse, groupées par livre (« {titre du livre} » puis « {titre} · p. N ·
À importer » → `#/recipes/<id>/importer`). Vide : « Aucune recette pour l'instant. » + « Ajouter une recette ». Segments Livres (grille
actuelle) et Plats inchangés ; « Liens web gardés » et « Recettes créées avec l'IA » restent sous Livres (ordre N-7, en `plain`) ET leurs
fiches apparaissent dans la grille Recettes avec leur badge. Les tests qui appellent `renderLibrary({}, {}, ctx)` en attendant les livres
(`tests/ajouter.js:3675, 3734-3758`, `tests/creer-ia.js:1513-1517`) passent `{ tab: 'books' }` ; un test neuf affirme que `{}` rend
Recettes.

### 4.2 Fiche recette (`src/ui/recipe.js`, `src/ui/photo-plat.js`)

Ordre du DOM : `pageHeader` (titre `h1.titre-fiche` ; sous-titre = « Du web · {hôte} » / « De mon livre · {titre} — {auteur} · page N » /
étiquette IA ; `back: 'Bibliothèque'`) → `div.fiche-tete` à deux colonnes ≥ 760 px (`.two-col`) : colonne 1 = badges (disponibilité,
version, vérification, type, cuisines), bandeau web / bandeau lecture (inchangés), ligne de repères `div.reperes` (« {n} portions ·
{durée} », chaque partie seulement si connue ; durée = `total_minutes ?? prep + cook` par `formatMinutes`), lien « Voir la page d'origine ↗ »
(`a.btn.link[data-role=ouvrir-lien]`, toute adresse lisible), rangée `button.btn.primary.big.block` « Commencer à cuisiner » + `a.btn.link`
« Corriger » (visible tant que `verification_state !== 'verified'` ; toujours présent dans le `details` aussi) ; colonne 2 = `photo.entete`
(figure pleine largeur de colonne, 4:3, `object-fit: cover`, légende « Image de la page {hote} » inchangée) ; sous 760 px, la colonne 2
passe AVANT les repères (photo sous la provenance, comme la maquette mobile). Puis `details.card[data-role=autres-gestes]` « Portions,
versions et autres gestes » (ouvert ≥ 760 px, fermé en dessous, par le `matchMedia` injecté) qui reprend TOUT le contenu actuel de
`controls` et de la rangée d'actions sauf « Commencer à cuisiner » et « Corriger ». Puis `div.recipe-body` : ≥ 760 px `.two-col` [section
Ingrédients | section Préparation] (toutes deux `plain`) ; < 760 px un `segmented` **Ingrédients / Préparation** au-dessus (bascule par
`hidden` sur la section non choisie, état mémorisé dans l'instance, jamais dans l'adresse ; le `segmented` lui-même `hidden` en large).
Puis `photo.zone` (section « Photo du plat », `.card`, gestes inchangés), « Original », « Versions », « Mémoire culinaire » (`plain`),
Export, inchangés. Ingrédients : la liste garde `ingredientLineEl` et « Remplacer » (le mode cuisine garde les cases « j'ai » ; pas de liste
cochable dupliquée) ; le `select` « Évaluer une restriction… » et `timeText` (la paire « actif · total ») restent dans l'en-tête de la
section. Le test `tests/photo-plat.js:341` (ordre emplacement → `.card.sage` → body → zone → Original) est amendé à l'ordre neuf
(emplacement dans `.fiche-tete`, `details[data-role=autres-gestes]` à la place de `.card.sage`) ; `tests/creer-ia.js:1346, 1376, 1391`
lisent `[data-role=autres-gestes]` au lieu de `.card.sage`.

### 4.3 Fiche livre (`src/ui/book.js`)

`pageHeader(book.title, { subtitle: '{auteur} · {n} disponible(s) · {m} à importer', back: 'Bibliothèque', actions })` — `actions` = les
deux `details.menu-source` d'aujourd'hui (book.js:32, markup inchangé, `styles.css:144-145` inchangées), `summary` « Ajouter des recettes »
et « Ajouter des pages de sommaire » (`tests/ajouter.js:844-846` amendés aux nouveaux textes) ; puis `div.two-col.livre` ≥ 900 px :
gauche = `bookCover` ≈ 200 px + section « Couverture » (`.card`, `renderZoneCouverture`, `tests/sync-l4.js:3396/3585/3715` et
`tests/ajouter.js:3667` intacts) + `details` « Métadonnées et convention » (inchangé) + « Sommaire » (`plain`) : `div.thumbs` des pages
`kind === 'index'` (vignettes numérotées, « Reprendre la séance » si une séance est ouverte ; l'ordre se corrige dans le panneau de la
séance, pas ici) ; droite = rappels (imports à reprendre, séance en cours, convention tasses : inchangés), puis `section.plain` « Les
recettes de ce livre » : filtres Toutes / Disponibles / À importer / Favoris + champ, `ul.liste-compacte` de lignes `li.row.between`
[`img.plat-vignette` 48 px quand les octets sont là (même `getFiles`, même révocation que `drawList` aujourd'hui : D-F9 tenu,
`tests/photo-plat.js:1296-1309` amendé à la ligne compacte) ; `a[href=#/recipes/<id>]` titre serif, `span.muted` « p. N » si
`printed_page`, `span.chip.neutral` section] [badge « Disponible » / « À importer » / « Lien web » / « Partielle » ; `a.btn.small`
« Importer » et `a.btn.small` « Saisir à la main » (référence sans adresse, mêmes `href` qu'aujourd'hui : `tests/import-cible.js:1485`
intact) ; favori]. Sous 900 px : gauche puis droite ; la liste montre 8 lignes puis `button.btn` « Voir les {n} recettes » (déplie sur
place). `renderAccueilLivre` (`?nouveau=1`) reste ; « Pages et fichiers sources » (`plain`) reste en bas (documents non-photo).
`CHAINES_NEUVES_AILLEURS['../src/ui/book.js']` (tests/ajouter.js:25) perd « + Recette », « + Pages d'index » et gagne les chaînes neuves.

### 4.4 Aujourd'hui (`src/ui/home.js`)

`pageHeader('Qu'est-ce qu'on cuisine ?', { subtitle: 'Cherche une recette, un ingrédient, une envie.' })` au-dessus de la `.search-bar`
(qui quitte sa `.card.sage`) ; « Favoris » et « Dernières cuissons » en `grilleCartes` de cartes-plat (home.js fait sa passe `getFiles` sur
les empreintes des cartes rendues ; la cuisson garde sa date et son bouton « Refaire comme la dernière fois » sous la carte) ; « Reprendre
ma recette », « Redécouvrir », « À utiliser » inchangés en `section.plain` ; « Bienvenue » inchangé.

### 4.5 Ajouter, import ciblé, séance

`#/add` : titres serif, icônes au trait, section « Imports » en tête inchangée (D-1). `#/recipes/<id>/importer` : badge « À importer »
(référence) / « Partielle » ; le bouton « Retirer la page {n} » devient un `×` en coin de la vignette (même nom accessible, ≥ 44 px) ;
légende « Page 1 · p. 76 » (le champ « p. imprimée » s'ouvre à la tape) ; Monter / Descendre restent ; le glisser n'entre pas dans ce lot
(§ 8). Le panneau d'index de la séance (`table-matieres.js`) ne change que par le thème.

### 4.6 Résultats web (`src/ui/search.js`) — thème en UI-1, vignettes en UI-2

UI-1 : la carte « Trouvé sur le web » garde sa forme épinglée (`tests/recherche-web.js:1035`) ; thème seulement. UI-2 : `figure.apercu` >
`img.plat-vignette.grande[alt='']` (4:3) en TÊTE des cartes qui ont une image, insérées en UNE fois pour toute la liste à la réception (forme
amendée dans le test : `FIGURE.apercu` optionnel en premier) ; `renderSearch` prend `deps.apercus` (défaut `lireApercusWeb`) : quand
`deps.chercher` est injecté sans `deps.apercus`, aucun aperçu n'est demandé (les tests de route existants n'appellent rien). Mémoire :
`apercus = Map(href → { blob, type } | { raison })` au niveau du module, à côté de `memoire` ; au premier rendu d'un `trouve` par une vue
connectée, l'app demande les hrefs ABSENTS de la Map (0 appel si tout est connu ; « Chercher à nouveau » ne repaie que les adresses
neuves) dans un vol d'aperçus unique (`AbortController`, abandonné par `lancer()`, par « Annuler », par `reinitialiserWeb()` et quand plus
aucune vue n'est connectée ; côté serveur un abandon fait 499, appel compté) ; la Map se vide avec `memoire` (`reinitialiserWeb`,
nouvelle issue). Au rendu, les URL `blob:` sont recréées depuis les Blob et révoquées par `remplacerEnRevoquant` et au changement de
route ; `img.onerror` → figure retirée, URL révoquée. Ligne d'état `p.muted[data-role=etat-apercus]` sous « Demande envoyée » : « Photos en
cours de récupération… » pendant le vol ; retirée dès qu'une image est posée ; « Photos indisponibles pour cette recherche. » (aucune
image, échec, `0007` absente) ; « Quota du jour atteint : photos indisponibles. » (429 écrit, raison `quota`). Texte de garde :
« Une recherche = 2 appels à l'assistant (résultats, puis photos), comptés dans ton quota du jour. » (`tests/recherche-web.js:553` et le
filet `CLES` :1289 amendés).

## 5. Textes (FR → EN, par `t()`, entrées `src/i18n/en.js`, apostrophe U+2019 dans les chaînes)

| FR | EN | Où |
| --- | --- | --- |
| Bibliothèque | Library | NAV, pageHeader, retours « ← Bibliothèque » (recipe.js, book.js) |
| Aller à la bibliothèque. | Go to the library. | accueil d'un livre |
| Tes livres, tes trouvailles, tes recettes. | Your books, your finds, your recipes. | sous-titre |
| Recettes | Recipes | segment ; `back` de la liste « à importer » |
| Ajouter une recette | Add a recipe | action d'en-tête, bouton mobile, état vide |
| Une recette, un ingrédient… | A recipe, an ingredient… | filtre |
| Toutes / De mes livres / Du web | All / From my books / From the web | puces |
| Recettes de mes livres à importer | Recipes from my books to import | pied |
| Voir plus | Show more | grille (page suivante) |
| À importer | To import | badge, compteur, filtre, `label('availability', 'reference_only')` |
| À importer · p. {p} | To import · p. {p} | `availabilityBadge` d'une référence avec page |
| Disponible | Available | badge court |
| Partielle | Partial | badge court |
| Du web · {h} | From the web · {h} | ligne de source |
| De mon livre · {t} | From my book · {t} | ligne de source |
| {n} portions · {d} | {n} servings · {d} | repères (n ≥ 2 ; « 1 portion ») |
| Voir la page d'origine | View the original page | lien (fiche, bloc du signet, écran d'import web) |
| Corriger | Edit | lien texte de l'en-tête (clé existante) |
| Portions, versions et autres gestes | Servings, versions and more | details |
| Ingrédients / Préparation | Ingredients / Steps | segmented mobile |
| Les recettes de ce livre | The recipes in this book | section |
| {n} disponible(s) · {m} à importer | {n} available · {m} to import | sous-titre livre |
| Voir les {n} recettes | Show all {n} recipes | liste compacte, mobile |
| Ajouter des recettes | Add recipes | menu de la fiche livre |
| Ajouter des pages de sommaire | Add table-of-contents pages | menu de la fiche livre |
| Sommaire | Table of contents | section |
| Cherche une recette, un ingrédient, une envie. | Search a recipe, an ingredient, a craving. | sous-titre accueil |
| Aucune recette pour l'instant. | No recipes yet. | vide |
| Une recherche = 2 appels à l'assistant (résultats, puis photos), comptés dans ton quota du jour. | One search = 2 assistant calls (results, then photos), counted in your daily quota. | garde web (UI-2) |
| Photos en cours de récupération… | Fetching photos… | UI-2 |
| Photos indisponibles pour cette recherche. | Photos unavailable for this search. | UI-2 |
| Quota du jour atteint : photos indisponibles. | Daily quota reached: photos unavailable. | UI-2 |

Les libellés qui portent une règle restent : « Repérée dans ton livre — page {p} » (fiche), « Créer ma version », « Commencer à cuisiner »,
« Garder et lire », « Lue sur {h} le {d} … — vérifie. », « Selon la page », « Image de la page {hote} », « Mes livres » (segment de la
recherche). Les chaînes retirées quittent aussi `en.js` : « + Recette », « + Pages d'index », « Ouvrir le lien » (trois sites),
« Une recherche = un appel à l'assistant, compté dans ton quota du jour. » (UI-2).

## 6. Serveur : l'outil `apercu-web` (UI-2)

- **Demande** : `{ outil: 'apercu-web', corps: { urls: [ ... ] } }`, 1 à 5 chaînes, chacune ≤ 2 048 ; corps ≤ 512 Kio ; une forme autre
  → 400 `forme` sans réservation. Chaque chaîne est validée par `valideAdresse` avec `hotesRefuses` AVANT la réservation ; une adresse
  refusée devient l'entrée `{ url, image: null, raison: 'interdit' }` de la réponse ; la réservation (`assistant_reserver(owner,
  'apercu-web', octets, quota)`) n'a lieu que s'il reste au moins une adresse admise ; si aucune ne passe → 422 `interdit` sans
  réservation. Les doublons ne sont fusionnés que pour le TÉLÉCHARGEMENT : la réponse rend une entrée par chaîne reçue, `url` = la chaîne
  reçue, telle quelle (le client indexe par `lien.href`).
- **Traitement** : un `AbortController` par appel (budget serveur **60 s**, relayé à chaque `suivreRedirections`, sous les 120 s de la
  fonction) ; en parallèle borné à **2** (constante `PARALLELISME_APERCU`, renversable à 1 ou 3 après la sonde), pour chaque adresse :
  `telechargerPage` (bornes `LIMITES_LECTURE` : 3 sauts, 15 s par saut, 30 s par page, 2 Mio) → `lirePageHtml(...).page.image_url` (LA
  règle de F : `Recipe` lisible retenu, sinon `og:image` hors page de liste ; aucune seconde copie) → `telechargerImage(href, { max: 1 Mio })`
  (paramètre `max` ajouté, défaut `LIMITES_IMAGE.octets` : u2-u12 de `tools/assistant-index.test.mjs` inchangés en sens, un test « cinq
  images à la borne → corps ≤ corpsMax » ajouté ; types jpeg/png/webp, `signatureImage`) ; une adresse qui échoue rend `{ url, image: null,
  raison }` (`inaccessible`, `pas_de_recette`, `pas_d_image`, `image_trop_lourde`, `delai`) sans faire échouer les autres ; le budget
  épuisé rend `delai` aux adresses restantes. Somme bornée par appel : 5 × 2 Mio de pages + 5 × 1 Mio d'images = 15 Mio lus ; mémoire
  transitoire de l'isolat ≈ 2 × (2 Mio d'octets + 2 Mio de chaîne + copies de `balayer` et de `textePrincipal`) ≈ 20 Mio au parallélisme 2
  (contre ≈ 5 Mio pour `image-web`) ; CPU : 47 à 185 ms par page hostile de 2 Mio (mesure de B), donc ≈ 1 s pour cinq ; les limites réelles
  de la plateforme (mémoire, CPU par requête) ne sont pas dans le dépôt : la sonde « cinq pages hostiles de 2 Mio » les éprouve (§ 6, Sondes).
- **Réponse** : 200 `{ apercus: [{ url, image: { type, taille, octets (base64) } | null, raison: null | 'interdit' | 'inaccessible' |
  'pas_de_recette' | 'pas_d_image' | 'image_trop_lourde' | 'delai' }] }` ; ≤ 5 × 1,4 Mio de base64 (≈ 7 Mio) ; `raison` nulle quand
  l'image est présente ; jamais le modèle (`OUTILS_MODELE` inchangé) ; journal `apercu-web`, statut 200 (499 si le client est parti :
  appel compté, comme F-5), jetons null, durée.
- **Serveur** : `OUTILS` + `'apercu-web'` (logique.js:7), `lireDemande` : forme `urls` pour cet outil seul (logique.js:40-58), branche dans
  `index.ts` à côté d'`image-web` (261-266) ; tests Node : logique (formes, bornes, doublons, refus par adresse sans réservation, 422
  seulement si aucune admise), `index.ts` (réservation unique après la validation, parallélisme 2, budget 60 s, `url` = chaîne reçue,
  journal), `OUTILS_0007` dans `tools/generer-migrations.test.mjs:1182-1192`.
- **`0007_apercu_web.sql`** : `begin; alter table … drop constraint assistant_journal_outil_check; alter table … add constraint … check
  (outil in (…six valeurs, dans l'ordre d'OUTILS_0007…)); commit;` (DDL transactionnel : aucune fenêtre sans contrainte ; un verrou de
  quelques millisecondes sur une petite table), écrite à la main comme `0006` ; sa preuve reprend 1.01 à six valeurs et ajoute 2.03 ter
  (`assistant_reserver(uid, 'apercu-web', …)` → id non nul ; les cinq anciens passent) ; README étape 13 (dit que la preuve `0006` devient
  historique : rejouée après `0007`, son 1.01 rougit) ; `RESULTATS-mitsu.md` : sections « Preuve `0007` — à jouer » et « Sondes
  `apercu-web` ». Le générateur (`tools/generer-migrations.mjs:202, 322`), son test (`:1264-1266`) et le README étape 11 passent de
  « la 0007 à venir » à « la 0008 à venir ».
- **Client** : `src/domain/apercu-web.js` : `lireApercusWeb({ urls, session }, { fetch, signal, tentativeMs: 135 000, corpsMax: 8 Mio })` →
  `{ etat: 'recus', apercus: Map(url → { blob, type } | { raison }) }` | `{ etat: 'echec', raison }` ; chaque entrée est décodée l'une après
  l'autre (base64 relu à la longueur exacte, `atob` puis `Uint8Array`, la chaîne intermédiaire lâchée avant la suivante), type dans la liste
  blanche, blob retypé, puis `dimensionsImage(blob)` (I-F2 : type de l'en-tête = type annoncé, ≤ 16 Mpx, petit côté ≥ `COTE_MIN_DISTANT`
  200 px) sinon `{ raison: 'image_refusee' }` ; `search.js` l'appelle par `deps.apercus` (§ 4.6) ; le délai client (135 s) est celui de la
  passerelle, au-dessus du budget serveur (60 s) et du transfert de 7 Mio (≈ 56 s à 1 Mbit/s).
- **Sondes** après redéploiement (sans dépense : forme refusée 400, cinq adresses interdites 422 sans ligne au journal, une admise et
  quatre interdites → 200 avec quatre `interdit` et UNE ligne, sans jeton 401 ; payantes, zéro jeton : les cinq adresses de la recherche
  « puttanesca » → cinq images ou raisons avec leur compte d'`image_trop_lourde` (décide si la borne passe à 2 Mio), durée totale ; une
  page de liste → `pas_de_recette` ; « cinq pages hostiles de 2 Mio » servies par un hôte public contrôlé par le contrôleur → 200 ou
  `delai` en moins de 60 s, jamais un 502 d'isolat tué). Session de Neegan lue par le script d'attente du presse-papiers, jamais dans une
  commande.

## 7. Tests

- **Épingles à amender, jamais à contourner**, tâche par tâche (chaque tâche relève `tests/tests.js:250` à la valeur mesurée) :
  - UI-1 T1 : `tests/theme.js:27` (`--action`), `PAIRES` (+1), `:93` (libellé) ; pins de version : `tests/ajouter.js:3817, 3819`,
    `tests/passerelle.js:765, 767`, `tests/recherche-web.js:66 (commentaire), 69, 72`, `tests/sync-l3.js:1867`, `tests/sync-l4.js:514, 516,
    3506-3507`, `tests/assistant-compte.js:8`, `tests/creer-ia.js:11`, `tests/classement.js:2568` (13 assertions + 1 commentaire, 8 suites),
    `src/model/schema.js:6`, `sw.js:4` ; `tests/ajouter.js:8` (`MODULES_NEUFS` + `icones.js`) ; SHELL. Aucun test n'épingle le libellé
    NAV « Mes livres » (grep fait) : seuls les quatre sites du source (D-UI-4) changent.
  - UI-1 T2 : `tests/ajouter.js:3675, 3734-3758` et `tests/creer-ia.js:1513-1517` (`{ tab: 'books' }`) ; `tests/ajouter.js:3729`,
    `tests/creer-ia.js:1511-1512` (sections « Liens web gardés » / « Recettes créées avec l'IA » en `plain`) ; `tests/photo-plat.js:1320-1323`
    (deux sélecteurs `.plat-vignette`).
  - UI-1 T3 : `tests/photo-plat.js:340-341` (ordre, « Original » et « Versions » en `plain`), `tests/creer-ia.js:1341, 1346, 1376, 1391,
    1790` (`[data-role=autres-gestes]`, sections `plain`) ; `tests/lecture-web.js:605, 611, 1051-1073, 1109, 1150` et `tests/ajouter.js:37,
    1149` (libellé « Voir la page d'origine », même `data-role`, http gardé).
  - UI-1 T4 : `tests/ajouter.js:844-846` (textes des `summary`), `tests/photo-plat.js:1296-1309` (vignette de la ligne compacte),
    `tests/sync-l4.js:3476, 3580, 3595, 3606, 3810` et `tests/ajouter.js:3729` (sections de la fiche livre basculées en `plain` ; « Couverture »,
    « Fichiers », « Pages d'index » restent `.card`), `tests/import-cible.js` (ligne compacte, mêmes `href` ; « Retirer la page {n} » en `×`),
    `CHAINES_NEUVES_AILLEURS` de book.js.
  - UI-1 T5 : `tests/ajouter.js:1133` (« À importer · p. 12 »), compteurs book.js:163/195 et library.js:73 (aucun test : vérifiés par le test
    neuf des libellés).
  - UI-2 : `tests/recherche-web.js:553` (texte de garde), `:1035/1055/1225` (forme de la carte avec `FIGURE.apercu` optionnel), `:1289`
    (`CLES`) ; `tests/photo-plat.js:1330` (test de source I-F3 : + `src/ui/search.js`, + `src/ui/library.js`) ; `tools/assistant-index.test.mjs`
    (u2-u12 : `telechargerImage` avec `max`), `tools/generer-migrations.test.mjs:1182-1192, 1264-1266`.
- **Tests neufs** (par comportement, bases jetables, `fetch` factice, `matchMedia` factice) : `tests/carnet.js` : jetons et paire (dans
  `theme.js`), carte-plat avec et sans octets (décision synchrone, jamais de cadre vide ; `plat-vignette` révoquée au redessin), grille 2/3
  colonnes (scène hors écran à 375 et 1100 px), grille bornée (fixture de 70 recettes à photo : 60 lectures, « Voir plus » en lit 10),
  segment Recettes (défaut `{}`, filtres par données, signet dedans / référence dehors, pied « à importer », `?tab=` ancien valide), actions
  d'en-tête par segment, fiche recette (ordre du DOM, bascule Ingrédients / Préparation sans navigation dans les deux états du
  `matchMedia`, `details` ouvert/fermé selon l'état, « Corriger » visible non vérifiée / absent de l'en-tête vérifiée, « autres gestes »
  porte tous les anciens boutons, repères dérivés : « 1 portion », rien sans durée, un seul nombre), fiche livre (ligne compacte, vignette
  48 px si octets, « Importer » et « Saisir à la main » seulement sur une référence sans adresse, sous-titre dérivé, 8 lignes puis « Voir les
  {n} recettes »), libellés (« À importer » n'apparaît que pour `reference_only` sans `source_url` ; « Voir la page d'origine » sur une
  fiche http), icônes (`aria-hidden`, `currentColor`, nom inconnu → levée), filets i18n. UI-2 : `tests/apercu-web.js` (forme exacte de la
  demande, en-têtes, un appel pour N, 0 appel quand tout est connu, « Chercher à nouveau » ne redemande que les hrefs neufs, un seul vol,
  abandon par `lancer()` / « Annuler » / dernière vue déconnectée, insertion en une fois, ligne d'état dans ses trois formes, 429 `quota`,
  blob par adresse, `dimensionsImage` refuse un en-tête menteur ou 400 Mpx, `onerror`, URL révoquées et Blob gardés au changement de
  route, type hors liste refusé, `deps.chercher` sans `deps.apercus` → 0 appel, jamais de `src` https).
- **Mutants** rejoués sur des copies servies à part : olive remise en tomate (theme rougit), `photoEnTete` sans contrôle des octets (cadre
  vide : rougit), filtre « Du web » câblé sur `mode=web` (rougit : aucun appel), « À importer » posé sur une `available` (rougit),
  `plain` par défaut (rougit : sections `.card` épinglées), « Corriger » hors de l'en-tête sur une fiche non vérifiée (rougit), grille
  sans borne (70 lectures : rougit) ; UI-2 : réservation avant la validation (harnais Node rougit), `src = https://…` (rougit), figures
  insérées carte par carte (rougit : insertion en deux temps observée), aperçus demandés par une vue déconnectée (rougit), Blob jetés
  au changement de route (rougit : second appel).
- **Preuve visuelle** (registre, hors git) : `preuve-visuelle.cjs` du lot refonte rejouée aux quatre largeurs sur les écrans touchés
  (bibliothèque Recettes avec peu et beaucoup de photos, fiche recette à titre long, fiche livre, onglet Web pendant et après les
  aperçus) ; galerie : badge « Original » à côté d'un `.btn.primary` (D-UI-2), « Bibliothèque » dans l'onglet à 320 et 375 px (§ 13,
  point 3) ; captures dans le registre.

## 8. Hors périmètre (nommé pour ne pas y glisser)

Navigation à deux onglets et avatar (V-3) ; police externe (CSP, V-2) ; renommer la marque (D-UI-11, § 13) ; sous-titres de recette,
titres d'étape, « Livre reconnu » sans vérification, « Les pages sont regroupées automatiquement » (I-D4) ; le stepper « Couverture ✓ —
Table des matières ✓ — ③ Recettes » et le H1 d'état « Votre livre prend forme. » de la maquette 02 (un indicateur inféré ; le titre du
livre reste le H1) ; glisser-déposer des pages (Monter / Descendre restent le chemin garanti) ; images dans les listes de plats (`dishes`)
et de repas ; cases « j'ai » sur la fiche ; stockage des aperçus dans `files` ; redimensionnement côté serveur ; mode sombre ; les écrans
hors § 4 (Réglages, Ma semaine, Ma cuisine, mode cuisine, épicerie, import, édition) ne changent que par les jetons et les titres.

## 9. Ordre des lots et des tâches

Deux branches, toutes deux créées sur le commit de cette rév. 2 (spec et maquettes dedans) : **`apercus-web`** (UI-2, worktree
`~/projects/mistu-apercus`, serveur 8095) et **`experience-carnet`** (UI-1, worktree `~/projects/mistu-carnet`, serveur 8096). Construction
séquentielle : UI-2 d'abord (le plus court, la première phrase de Neegan), UI-1 ensuite sans attendre la fusion de UI-2 (sa fusion dépend
de `0007` et du redéploiement, gestes de Neegan et du contrôleur). Chaque lot fusionne dans `main` par un commit de fusion ; le second
résout les quatre fichiers communs : `sw.js` (son propre `VERSION`), `src/model/schema.js` et les pins (règle I-UI-7), `src/i18n/en.js`
(union), `tests/tests.js:250` (remesuré) ; le § 12 de cette spec reçoit les rulings de chaque lot sous son propre titre.

**UI-2 « Aperçus »** (plan 1, `0.16.0`) : S1 serveur (`lecture-web.js` / `logique.js` / `index.ts`, `telechargerImage({ max })`) + tests Node +
`0007` + preuve + README + générateur « 0008 » ; S2 domaine client (`apercu-web.js`, `dimensionsImage`) + `search.js` (vol, Map, ligne
d'état, insertion) + tests + filets + pins ; S3 docs, redéploiement (chef), sondes, RESULTATS. Gate de fusion : `0007` collée et prouvée,
sondes vertes (dont « cinq pages hostiles »), `/verify`.
**UI-1 « Carnet »** (plan 2, `0.17.0`) : T1 jetons, typographie, `section({ plain })`, `icones.js`, NAV « Bibliothèque » et ses quatre
sites, pins, `theme.js` amendé ; T2 carte-plat, `grilleCartes` bornée, segment Recettes + filtres + actions + pied « à importer » ; T3 fiche
recette ; T4 fiche livre ; T5 Aujourd'hui, Ajouter, import ciblé, libellés dérivés ; T6 filets, preuve visuelle, docs. Revue à trois
lentilles par tâche, revue finale, vague, `/verify`.

## 10. Preuve réelle (geste de Neegan, sur le site public, après chaque push)

UI-2 : après `0007` collée et la fonction redéployée : « puttanesca » dans l'onglet Web → la ligne « Photos en cours de récupération… »
puis des photos en tête des cartes, posées d'un coup ; `select jour, outil, appels from public.assistant_usage_jour` : +2 par recherche ;
« Chercher à nouveau » → au plus un appel de plus ; une recherche dont les sites n'ont pas d'image → « Photos indisponibles ». UI-1 :
Bibliothèque → Recettes sur TA bibliothèque (dire si la grille, avec le nombre réel de photos que tu as, ressemble assez à la maquette ;
sinon § 13, point 5), filtres, pied, « Ajouter une recette » ; une fiche de recette avec photo sur le Mac (deux colonnes) et sur l'iPhone
(onglets, « Corriger » à côté) ; une fiche de livre (menus en tête, 8 lignes puis « Voir les {n} recettes » sur l'iPhone) ; Aujourd'hui ;
Ajouter ; l'onglet « Bibliothèque » lisible sur l'iPhone, « Agrandir l'affichage » dit.

## 11. Risques et limites assumés

- Les photos locales sont ré-encodées à 1 200 px (image.js:16) : une carte-plat sur un Mac large peut paraître douce ; assumé.
- Peu de photos aujourd'hui : seules les recettes web rapatriées (lot F) et les photos posées à la main en ont ; la grille Recettes sera
  d'abord faite de cartes sans photo (bloc titre sur `--paper-2`) avec quelques cartes illustrées : elle ressemblera à la maquette à mesure
  que les photos arrivent (§ 10, § 13 point 5).
- La grille lit les lignes `files` entières (blob compris) des 60 cartes rendues : ≈ 60 × 300 Ko = 18 Mo par rendu au pire ; « Voir plus »
  ajoute autant ; jamais toute la bibliothèque d'un coup (F-9).
- `app.js` reste hors suite : la coquille (NAV avec icônes, libellé « Bibliothèque ») n'est mesurée que par la preuve visuelle.
- UI-2, quota : 2 appels par recherche illustrée (30 par jour) ; un abandon client fait 499 côté serveur, compté.
- UI-2, vie privée : en mode automatique, jusqu'à 10 requêtes signées `Mitsu/0.10 (+https://neegans.github.io/mistu/)` partent par
  recherche vers des pages que la personne n'a pas choisies (le modèle et le moteur les ont choisies) ; l'IP reste celle de
  l'infrastructure (I-UI-2) ; F n'avait accepté cette exposition que pour une image, après un geste : d'où § 13, point 2.
- UI-2, amplification : un appel du quota achète jusqu'à 10 téléchargements (15 Mio, 60 s de connexions sortantes, 30 sauts) au lieu
  d'un ; mêmes règles SSRF par adresse que B et F (résidu R-B-21 inchangé) ; le mur reste la liste admise et `ASSISTANT_QUOTA_JOUR`.
- UI-2, mémoire : ≈ 20 Mio transitoires dans l'isolat au parallélisme 2 ; côté iPhone, une réponse de 7 Mio lue en texte puis décodée
  adresse par adresse (≈ 7 Mio de chaîne + un binaire à la fois) ; une image au-delà de 1 Mio rend `image_trop_lourde` (pas de
  redimensionnement) et peut manquer en silence (la sonde « puttanesca » compte ces cas).
- UI-2, écran : les figures arrivent 20 à 90 s après les résultats, en une fois ; la ligne d'état prévient ; une personne qui tape pendant
  l'insertion voit la liste descendre d'un coup (mesuré dans la preuve visuelle, assumé).
- UI-2 : une page sans `Recipe` ni `og:image` n'a pas d'aperçu ; un 403 anti-hotlink rend `inaccessible` (D-F3 : rien n'est contourné).
- La preuve visuelle vit hors git (registre) : la recomposition des fiches n'est mesurée aux quatre largeurs que là.

## 12. Amendements

### Revue adverse de la rév. 1 → rév. 2 (23 octobre 2026 ; trois lentilles, 0 Critical, 35 Important, 28 Minor ; `revue-spec-rev1.md` du registre)

Lentille besoin (B) :
- **B-I-1** UI-2 d'abord, sur sa propre branche ; règle des quatre fichiers communs (§ 9, en-tête).
- **B-I-2** I-UI-1 réécrit « un geste = un nombre d'appels annoncé avant la tape » ; D-UI-13 reste le défaut, coût 60 → 30 en § 13.2.
- **B-I-3** § 13 point 0 : l'olive renverse V-4 ; règle vérifiable (un état n'est jamais un bouton plein olive ; galerie) en D-UI-2.
- **B-I-4** « Ajouter une recette » en action d'en-tête du segment Recettes, répété pleine largeur sous 760 px (D-UI-4, § 4.1).
- **B-I-5** condition de la grille `availability !== 'reference_only' || source_url` : signets dedans (carte sans photo, « Lien web »,
  sans durée), références dehors ; « Liens web gardés » reste sous Livres (§ 4.1).
- **B-I-6** durée = `total_minutes ?? prep + cook`, un nombre par `formatMinutes` ; `timeText` reste dans l'en-tête d'Ingrédients.
- **B-I-7** « Texte conservé dans Mitsu » retirée (D-UI-10, § 5).
- **B-I-8** « Corriger » en lien texte à côté de « Commencer à cuisiner » tant que non vérifiée ; `details` renommé « Portions, versions et
  autres gestes », `data-role=autres-gestes` (D-UI-6, § 4.2, § 13.4).
- **B-I-9** `.plain` opt-in ; liste des sections basculées en § 3.3 ; les autres écrans en § 8 (D-UI-8).
- **B-I-10** « Voir la page d'origine » sur toute adresse lisible, http compris (I-B5 tenu) ; tests nommés en § 7 T3.
- **B-I-11** vingt-deux icônes relevées du code (`grep ico:` et `emptyState(`), listées avec leur usage (§ 3.3).
- **B-I-12** insertion des figures en une fois, ligne d'état « Photos en cours de récupération… », mesure dans la preuve visuelle (D-UI-13, § 4.6).
- **B-I-13** validation par adresse avant la réservation, `interdit` par entrée, 422 seulement si aucune admise (I-UI-6, § 6).
- **B-I-14** actions de la fiche livre gardées en tête ; liste à 8 lignes + « Voir les {n} recettes » sous 900 px (D-UI-7, § 4.3).
- **B-I-15** une seule carte sans photo (bloc titre sur `--paper-2`, 7 rem) ; l'allure avec peu de photos nommée en § 11 ; preuve sur sa
  bibliothèque en § 10 ; tri « photos d'abord » en § 13.5.
- **B-M-1** § 1 ouvre par le but. **B-M-2** « {n} disponible(s) ». **B-M-3** « Bibliothèque » mesuré à 320/375 dans la preuve, repli en
  § 13.3. **B-M-4** `?tab=a-importer` : segment Recettes actif, `back: 'Recettes'`. **B-M-5** stepper et H1 de la maquette 02 en § 8.
  **B-M-6** borne d'image gardée à 1 Mio, comptée par la sonde « puttanesca » avant de passer à 2 Mio (§ 6, § 11). **B-M-7** une fiche
  dans les deux filtres, dit. **B-M-8** « Ajouter des pages de sommaire ». **B-M-9** retours « ← Bibliothèque » ; segment de recherche
  « Mes livres » gardé (D-UI-4, § 5). **B-M-10** générateur, test et README étape 11 : « la 0008 à venir » (§ 6). **B-M-11** pointe mémoire
  iPhone en § 11, décodage adresse par adresse (§ 6). **B-M-12** titres de fiche en `clamp()`, vérifiés aux quatre largeurs (D-UI-3).

Lentille faisabilité (F) :
- **F-1** `.plain` opt-in (= B-I-9) ; sélecteurs `section.card` à amender listés par tâche en § 7 ; liste des sections qui restent `.card`.
- **F-2** tests qui attendent les livres par défaut passent `{ tab: 'books' }` ; test neuf « `{}` rend Recettes » (§ 4.1, § 7 T2).
- **F-3** `recipeCard(doc, { photoEnTete, fichier })` synchrone ; home.js fait sa passe `getFiles` (D-UI-5, I-UI-5, § 4.4).
- **F-4** `tests/creer-ia.js:1346, 1376, 1391` → `[data-role=autres-gestes]` (§ 4.2, § 7 T3).
- **F-5** `matchMedia` injectable, deux sections toujours dans le DOM, `segmented` `hidden` en large, état survivant à `drawBody()` (D-UI-6).
- **F-6** fiche livre : menus `details.menu-source` gardés (textes des `summary` amendés), « Couverture » reste `.card`, vignette 48 px sur la
  ligne compacte (D-F9 tenu), « Saisir à la main » gardé sur la ligne ; épingles listées en § 7 T4 (D-UI-7, § 4.3).
- **F-7** `.plat-vignette.grande` ; l'épingle `tests/photo-plat.js:1320-1323` passe à deux sélecteurs (§ 3.3).
- **F-8** `tests/ajouter.js:1133` en § 7 T5 ; compteurs et `label('availability', 'reference_only')` dits (D-UI-10).
- **F-9** grille bornée a priori : 60 cartes, `getFiles` des cartes rendues, « Voir plus » ; test à 70 recettes (§ 3.3, § 4.1, § 7).
- **F-10** `deps.apercus` ; `deps.chercher` sans `deps.apercus` → aucun appel ; `tests/recherche-web.js:553` et `:1289` en § 7 (§ 4.6).
- **F-11** chaque tâche relève l'épingle et amende ses tests ; T6 ne porte que filets, preuve et docs (§ 7, § 9).
- **F-12** § 3.1 corrigé : une valeur de `theme.js:27`, `PAIRES` +1, libellés :27 et :93, aucun champ sur `--action-bg` (2,89).
- **F-13** liste exacte des pins : 13 assertions + 1 commentaire dans 8 suites, `schema.js:6`, `sw.js:4` (§ 7 T1, I-UI-7).
- **F-14** aucun test sur le libellé NAV ; les quatre sites du source nommés (D-UI-4) ; « à relever par grep » retiré de § 7.
- **F-15** « Voir la page d'origine » sur les trois sites en T3 ; tests listés (D-UI-10, § 7 T3).
- **F-16** `styles.css:144-145` restent (menus gardés) ; `CHAINES_NEUVES_AILLEURS` de book.js nettoyée (§ 4.3).
- **F-17** `.two-col.livre` neuve sous 900 px ; `.two-col` de la recette reste à 760 px ; `.narrow-left` intacte (§ 3.3).
- **F-18** contraintes de `tests/theme.js` sur toute règle neuve (I-UI-4).
- **F-19** `image_trop_lourde` au-delà de 1 Mio, pas de redimensionnement ; pointe mémoire en § 11 ; 512 Kio refusé (les images de partage
  dépassent souvent 500 Ko ; la sonde tranche entre 1 et 2 Mio).

Lentille sécurité, quota, vie privée (S) :
- **S-1** budget serveur 60 s, un `AbortController` par appel relayé aux redirections, délai client 135 s, transfert de 7 Mio chiffré (§ 6).
- **S-2** mémoire et CPU chiffrés, parallélisme 2 renversable, sonde « cinq pages hostiles de 2 Mio » (§ 6, § 11) ; lecteur allégé
  refusé (une seule règle d'image, celle de F : le coût de `textePrincipal` est accepté et chiffré).
- **S-3** = B-I-13 (I-UI-6, § 6).
- **S-4** vol d'aperçus unique, demandé par une vue connectée, abandonné par `lancer()`, « Annuler », `reinitialiserWeb()` et la dernière
  vue déconnectée ; 499 compté dit en § 6 et § 11.
- **S-5** `Map(href → aperçu | { raison })` au niveau du module, échecs mémorisés, seuls les hrefs absents sont demandés (§ 4.6).
- **S-6** URL révoquées au redessin et au changement de route, Blob gardés avec `memoire` et libérés avec elle (D-UI-12, § 4.6).
- **S-7** `dimensionsImage(blob)` avant tout `<img>` (I-F2), `onerror` → figure retirée (I-UI-2, § 6, § 4.6).
- **S-8** amplification ×10 nommée, somme par appel bornée (§ 6, § 11).
- **S-9** `url` de la réponse = chaîne reçue ; dédoublonnage pour le téléchargement seulement (§ 6).
- **S-10** `lirePageHtml(...).page.image_url` : une seule règle d'image (D-UI-12, § 6).
- **S-11** paramètre `max` de `telechargerImage` nommé ; test « cinq images à la borne → corps ≤ corpsMax » (§ 6).
- **S-12** décodage adresse par adresse, chaînes intermédiaires lâchées (§ 6, § 11).
- **S-13** README étape 13 : preuve `0006` historique ; preuve `0007` reprend 1.01 à six valeurs et 2.03 ter (§ 6).
- **S-14** vie privée du mode automatique en § 11 ; § 13.2 présenté comme une décision de vie privée autant que de quota.
- **S-15** « Quota du jour atteint : photos indisponibles. » sur 429 `quota` écrit (D-UI-13, § 4.6, § 5).
- **S-16** test de source I-F3 (`tests/photo-plat.js:1330`) étendu à `search.js` et `library.js` (§ 7).
- **S-17** une seule forme de réponse (§ 6), `raison: null` avec une image ; D-UI-12 renvoie à § 6.

### Specs amendées par ce lot

- Refonte visuelle (`2026-10-18-refonte-visuelle-design.md`) : V-2 et V-4 (l'action devient l'olive `#4f6b2e`, le vert gris reste aux
  états) ; T-1 inchangé (aucun `display:none` neuf) ; R-VIS-8 inchangé (« Annuler » à droite pendant un vol) ; `tests/theme.js` : une
  valeur, une paire, deux libellés.
- Les plats en images (`2026-10-19-plats-en-images-design.md`) : D-F9 tenu par la vignette 48 px de la liste compacte ; I-F2 et I-F3 étendus
  aux aperçus de résultats ; la règle d'image de F (`page.image_url`) devient la seule, aussi pour `apercu-web`.
- Chercher sur le web (`2026-10-17-chercher-sur-le-web-design.md`) : I-K inchangée ; le texte de garde annonce deux appels (UI-2) ; la
  forme de la carte gagne une figure optionnelle en tête.
- Recette web (`2026-10-19-recette-web-design.md`) : I-B5 tenu (« Voir la page d'origine » sur toute adresse lisible) ; `telechargerImage`
  gagne un paramètre `max` ; `0007` prend le nom que le générateur réservait (la prochaine migration générée sera `0008`).

## 13. À trancher par Neegan (sans urgence ; chaque point a son défaut, construit tel quel)

0. **L'olive comme couleur d'action** (renverse V-4 de la refonte visuelle, jamais confirmée) : olive (défaut, c'est la maquette) ou garder
   la tomate `#bc3026` (une ligne de `styles.css` et `theme.js:27`).
1. **La marque** : garder « Cuisine OS » (défaut) ou passer à « Mitsu » (titre, manifeste, icône iPhone, `SHELL`).
2. **Les aperçus** : automatiques (défaut : 2 appels par recherche, donc 30 recherches illustrées par jour, et jusqu'à 10 requêtes signées
   Mitsu vers des pages que tu n'as pas choisies) ou sur une tape « Voir les photos (1 appel) » (quota et vie privée préservés, un geste de
   plus). C'est autant une décision de vie privée que de quota.
3. **L'entrée de navigation** : « Bibliothèque » (défaut ; mesuré à 320 et 375 px dans la preuve visuelle, repli « Carnet » si le libellé
   coupe) ou garder « Mes livres » avec le segment Recettes dedans.
4. **La fiche recette** : « Portions, versions et autres gestes » replié sur l'iPhone (défaut ; « Corriger » reste visible à côté de
   « Commencer à cuisiner » tant que tu n'as pas relu) ou toujours ouvert.
5. **Le tri de la grille Recettes** : dernière modification d'abord (défaut) ou « photos d'abord » (les cartes illustrées en tête, pour
   ressembler à la maquette tant que les photos sont rares).
6. **L'ordre des lots** : UI-2 « Aperçus » d'abord (défaut : la première phrase, un lot court) ou UI-1 « Carnet » d'abord.
