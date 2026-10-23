# Expérience « carnet » : la direction des maquettes et la recherche en images (lot UI, rév. 1, 23 octobre 2026)

Base : `main` `05c751f` (chaîne A → F en ligne, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, suite 5948/5948, épingle 5947).
Demande de Neegan (23 octobre, 16 h 57 HAE, capture de l'onglet Web) : « je ne vois toujours pas d'images qui accompagnent les
recherches, et cela ne ressemble pas aux maquettes que je t'ai fournies » ; « ok oui go, pour améliorer l'expérience UI/UX ».
Références : le dossier de passation du 18 octobre, `docs/maquettes/2026-10-18-mitsu-claude-code/` (sept maquettes, réduites en JPEG ;
`03_PARCOURS_ET_DIRECTION_VISUELLE.md` fait foi sur les images : « une direction à adapter à Mitsu », § 7 « les textes fonctionnels
priment sur les petites incohérences des images ») ; la décision D-9 du lot A (18 octobre) qui avait mis cette direction hors lot ;
la spec « Refonte visuelle » (`2026-10-18-refonte-visuelle-design.md`, V-1 à V-6, T-1 à T-11, R-VIS-1 à R-VIS-14) que ce lot amende ;
la spec « Les plats en images » (`2026-10-19-plats-en-images-design.md`, D-F3, I-F3, I-F6, D-F9, D-F11) qu'il respecte.
Cartographie préalable (cinq lectures en parallèle, 23 octobre) : `.superpowers/sdd/2026-10-23-experience-carnet/cartographie.md`.

Deux volets, deux plans : **UI-1 « Carnet »** (thème, composition des écrans, textes, icônes : aucun serveur) et **UI-2 « Aperçus »**
(un outil serveur sans modèle qui rend les images des résultats web, une migration `0007`, un redéploiement). UI-1 se construit et se
fusionne d'abord ; UI-2 s'empile dessus.

## 0. Décisions (chacune renversable sans défaire le reste ; prises le 23 octobre, à confirmer par Neegan)

- **D-UI-1 Adapter, pas copier.** Les maquettes fixent la direction (crème, olive, grandes photos, titres serif généreux, filets fins au
  lieu de cartes à ombre) ; les parcours, les écrans, la navigation, les données et les libellés qui portent une règle du produit restent
  ceux de l'app. Rien n'est inventé pour ressembler à une image (§ 8).
- **D-UI-2 L'olive devient la couleur d'action.** `--action` passe de la tomate `#bc3026` à l'olive `#4f6b2e` (5,55 sur papier, 5,95 sur
  carte, 4,97 sur `--accent-bg`), `--action-2` (survol) `#3e5424` (papier dessus 7,72), `--action-bg` `#e9eddf` (gris `--muted` dessus 4,80,
  ambre 4,71), `--tap` `rgba(79,107,46,.15)`. Le vert gris des états (`--accent #45604a`, `--ok`) reste ; la brique `--danger` reste le seul
  rouge. V-2 et V-4 de la refonte visuelle sont amendés (§ 12) : l'action et les états sont deux verts distincts, lisibles par leur rôle
  (bouton plein, lien, onglet actif, anneau de focus = olive ; badge « Original », statut ok, puce cochée = vert gris).
- **D-UI-3 Titres plus grands, police système.** `h1` 2,6 rem (3,2 rem ≥ 900 px), `h2` 1,6 rem, titre de carte-plat en serif 1,3 rem ;
  `--serif` reste Georgia (la CSP n'admet aucune police externe et V-2 le veut ainsi). La barre haute garde 64 px et sa marque 44 px.
- **D-UI-4 La bibliothèque s'ouvre sur les plats.** `#/library` gagne un troisième segment, **« Recettes »**, par défaut : la grille de
  toutes les recettes (deux colonnes dès 360 px, trois ≥ 900 px) en cartes-plat (D-UI-5), un champ « Une recette, un ingrédient… » qui
  filtre localement, les filtres **Toutes / De mes livres / Du web** calculés sur les données (`edition_id`, `source_url`), et en pied
  « Recettes de mes livres à importer → » vers la liste des références. « Livres » et « Plats » gardent leurs écrans. L'entrée de
  navigation garde sa route `/library` et prend le libellé « Bibliothèque » (en.js « Library »).
- **D-UI-5 La carte-plat.** `recipeCard(doc, { photoEnTete: true })` rend, QUAND les octets de `photo_sha256` sont ici (I-F6), une image
  4:3 au-dessus du titre serif et d'une ligne « Du web · {hôte} · 35 min » ou « De mon livre · {titre} · 40 min » (durée seulement si
  connue) ; sans photo, la carte-texte d'aujourd'hui, jamais de cadre vide ni d'image générique. L'image garde la classe `plat-vignette`
  (révocation D-T9) et passe par `displayUrl(f, urlDeBlob)`. La carte horizontale actuelle reste le défaut partout ailleurs.
- **D-UI-6 La fiche recette en deux colonnes.** ≥ 760 px : [en-tête : état, titre, provenance, « Voir la page d'origine ↗ », repères
  « 4 portions · 35 min », « Commencer à cuisiner »] | [photo du plat, pleine largeur de colonne, 4:3] ; puis [Ingrédients] | [Préparation].
  < 760 px : photo pleine largeur sous la provenance, repères, puis un `segmented` **Ingrédients / Préparation** (bascule locale, sans
  navigation ni appel), « Commencer à cuisiner » plein largeur. Le −/+ des portions, Unités, Langue, « Corriger », « Créer ma version »,
  repas, épicerie, plat, export passent sous un `details` « Réglages et plus ». Le style inline 320 px de la photo disparaît.
- **D-UI-7 La fiche livre en deux colonnes.** ≥ 900 px : gauche = couverture (≈ 200 px) avec « Modifier la couverture » replié, métadonnées
  repliées, vignettes des pages d'index ; droite = « Les recettes de ce livre · {n} disponibles · {m} à importer », filtre, liste COMPACTE
  « titre · p. N · badge » avec « Importer » sur la ligne (référence sans adresse) et « Ajouter des photos de recettes » (plusieurs
  recettes ou plusieurs pages à la fois : lot D). < 900 px : la même chose empilée. La section « Couverture » séparée disparaît (ses
  gestes vivent sous la couverture).
- **D-UI-8 Les listes sur le papier.** Les sections de listes (`section()`) perdent leur fond de carte et leur ombre : titre serif, filet
  fin ; `.card` reste pour les panneaux d'action (import, questions, réglages, erreurs).
- **D-UI-9 Icônes au trait.** Un module `src/ui/icones.js` de douze SVG inline monochromes (`currentColor`, `aria-hidden`) remplace les
  émojis de la navigation, de la grille Ajouter et des états vides ; les émojis restent dans les textes de contenu.
- **D-UI-10 Libellés d'affichage.** « À importer » pour une référence sans adresse dans les listes, badges et compteurs ; « Disponible »
  pour le badge court ; « Repérée dans ton livre — page {p} » reste sur la fiche (il dit d'où elle vient) ; « Voir la page d'origine ↗ »
  (lien texte) remplace le bouton « Ouvrir le lien » (même `data-role`) ; « Texte conservé dans Mitsu » / « Texte et photo conservés
  dans Mitsu » sont DÉRIVÉS (version présente ; photo présente avec octets) et toujours suivis de « — vérifie » tant que la version n'est
  pas vérifiée ; « Ajouter des photos de recettes » et « Ajouter le sommaire » remplacent « + Recette » et « + Pages d'index ».
  `availability` et les statuts du journal ne changent pas (doc 03 § 5).
- **D-UI-11 La marque reste « Cuisine OS »** (titre, manifeste, icône, nom sur l'iPhone) : « mitsu » des maquettes est le nom du projet,
  pas celui de l'app ; à trancher par Neegan (§ 13).
- **D-UI-12 Les aperçus des résultats web (UI-2).** Un sixième outil serveur, **`apercu-web`**, sans modèle : pour au plus 5 adresses
  (celles des liens choisis d'une recherche), la fonction télécharge chaque page (bornes de `lecture-web`), en tire l'adresse d'image par
  `imageUrlDe` (JSON-LD `Recipe.image`, sinon `og:image`, règles de `adresseImage`), télécharge l'image (bornes d'`image-web`, ≤ 1 Mio par
  image) et rend `[{ url, image: { type, taille, octets } | null, raison }]` ; **un appel du quota pour les cinq**, zéro jeton. Côté app,
  la vignette (4:3, classe `plat-vignette`) s'affiche par blob local, jamais par une adresse `https` (I-F3, CSP inchangée). Rien n'est
  écrit dans `files` : une mémoire vive par adresse, révoquée au redessin et au changement de route.
- **D-UI-13 Les aperçus sont automatiques, un appel de plus par recherche.** Dès les liens reçus, l'app demande les aperçus (« Une
  recherche = 2 appels : résultats, puis photos. » dans le texte de garde) ; un 429 ou un échec rend les résultats sans image, sans
  message d'erreur (une ligne « Photos indisponibles pour cette recherche. »). Renversable vers une tape « Voir les photos (1 appel) » (§ 13).
- **D-UI-14 UI-2 exige `0007`.** La contrainte `outil` du journal passe à six valeurs ; `0007` est écrite à la main comme `0004` et `0006`,
  collée par Neegan AVANT le redéploiement et AVANT le push de UI-2 ; sans elle, chaque aperçu répond 502 et l'app montre les résultats
  sans image (comportement dégradé de D-UI-13, jamais une erreur bloquante).

## 1. Pour toi

L'app garde ses écrans, ses gestes et ses règles ; elle change d'allure : le papier crème, des titres serif plus grands, des listes posées
sur le fond au lieu de cartes blanches, et l'olive comme couleur de ce qui se touche (le vert gris reste aux états : « Original », « ok »).
« Bibliothèque » s'ouvre sur tes recettes en grille, avec leur photo quand tu l'as, et des filtres De mes livres / Du web ; tes livres et
tes plats sont à côté. Une fiche de recette met la photo en regard du titre sur le Mac, en pleine largeur sur l'iPhone, puis Ingrédients et
Préparation côte à côte (ou en deux onglets sur l'iPhone) ; « Commencer à cuisiner » reste le grand bouton. Une fiche de livre montre la
couverture et le sommaire à gauche, la liste des recettes à droite avec « Disponible » ou « À importer » et le bouton « Importer » sur la
ligne. Dans l'onglet Web, chaque résultat vient avec la photo de la page quand le site en publie une : c'est un appel de plus de ton quota
par recherche (deux au lieu d'un), jamais une page ni une image chargée depuis ton appareil. Rien n'est inventé : pas de photo quand il
n'y en a pas, pas de sous-titre ni de durée sans donnée, « vérifie » reste affiché tant que tu n'as pas relu.

## 2. Invariants

- **I-UI-1 Aucune règle de produit ne bouge.** L'original n'est jamais réécrit (« Corriger » crée une version) ; un signet n'est pas une
  recette conservée ; « Disponible » seulement après enregistrement ; un clic = un appel ; aucune donnée inventée (pas de sous-titre, de
  titre d'étape, de durée, de « Livre reconnu » sans « vérifie ») ; le segment « Web » de la recherche reste l'appel payant, distinct du
  filtre « Du web » de la bibliothèque.
- **I-UI-2 Aucune image distante.** `img-src 'self' blob: data:` inchangée ; toute image vient d'un blob local (I-F3) ; l'adresse IP de
  l'appareil ne part jamais chez un site (D-F3) ; les aperçus passent par la fonction, avec ses hôtes refusés et sa boucle de redirections.
- **I-UI-3 Aucune classe JS renommée, aucune route retirée, aucun écran retiré de la navigation** (règle « une page sans lien n'existe
  pas ») ; `NAV`, `registerRoutes`, `ROUTES_DE_SAISIE` gardent leurs entrées ; les blocs épinglés par les tests de comportement (ordre des
  rangées d'une carte web, `.status[role=status]` suivie de `.row`, `data-role` des gestes) se déplacent avec leurs tests amendés, jamais
  en silence.
- **I-UI-4 Accessibilité mesurée, comme la refonte visuelle.** 28 paires + les paires neuves ≥ 4,5 ; contour des champs ≥ 3 ; cibles ≥ 44 px
  (36 pour `.btn.small`) ; focus visible ; mouvement réduit ; `[hidden]` et jamais une `display:none` neuve ; les vignettes décoratives
  gardent `alt=''` ; une image qui porte un sens a un nom ; le glisser garde Monter / Descendre.
- **I-UI-5 Rien sans octets.** Une carte-plat ou une vignette de résultat n'existe que lorsque les octets sont là et de type image (liste
  blanche `typeAffichage`) ; sinon la carte-texte ; aucune image générique, aucune photo IA substituée (B7).
- **I-UI-6 Un appel = une réservation, avant tout téléchargement** (I-B10) ; chaque adresse d'un aperçu est validée AVANT la réservation ;
  le journal ne porte que des compteurs.
- **I-UI-7 Versions.** `APP_VERSION 0.16.0` dès la première tâche de UI-1 (pins relevés dans les huit suites) ; `sw.js` `cuisine-os-v0.16.0-N`,
  +1 à chaque commit qui touche `src/`, `styles.css`, `index.html`, le manifeste ou `sw.js` (R-B-24) ; `SHELL` + `./src/ui/icones.js`.
  UI-2 : `0.17.0`.

## 3. Direction visuelle (UI-1)

### 3.1 Jetons (styles.css `:root`, 29 jetons épinglés par `tests/theme.js:2, 27-28`)

| Jeton | Aujourd'hui | Demain | Pourquoi |
| --- | --- | --- | --- |
| `--action` | `#bc3026` | `#4f6b2e` | l'olive des maquettes ; 5,55 sur papier, 5,95 sur carte, 4,97 sur accent-bg, 5,14 sur paper-2 |
| `--action-2` | `#98231b` | `#3e5424` | survol ; papier dessus 7,72 |
| `--action-bg` | `#f7e3e0` | `#e9eddf` | fond pâle de l'action ; gris dessus 4,80, olive 5,08, ambre 4,71 |
| `--tap` | `rgba(188,48,38,.15)` | `rgba(79,107,46,.15)` | la même olive en touche |
| les 25 autres | inchangés | inchangés | papier, encre, gris, filets, accent, warn, danger, ok, rayons, ombre, polices, barre |

`theme-color`, le manifeste, `--sage` (`#b9c8bb`, en dur) ne changent pas. Les six valeurs de `tests/theme.js:27-28` sont réécrites ;
les paires neuves (olive sur `--card`, olive sur `--paper-2`, papier sur olive, gris sur `--action-bg`) entrent dans `PAIRES`.

### 3.2 Typographie et espaces

`h1` 2,6 rem (3,2 rem ≥ 900 px), `h2` 1,6 rem, `h3` 1,15 rem ; sous-titre de page `p.muted` 1,05 rem ; titre de carte-plat `h3` serif
1,3 rem ; `.brand` inchangée (1,25 rem, 44 px, barre 64 px) ; `.step-num` passe en `--paper-2` / `--ink` (cercle beige des maquettes) ;
espacement vertical des sections 1,6 rem. Aucune taille n'est épinglée hors la barre (`tests/theme.js:135`) et `.search-bar input` 52.

### 3.3 Composants

- **`section(title, …)`** : `section.plain` (sans fond ni filet ni ombre, `h2` serif, filet fin `--line` sous le titre) ; `section.card`
  gardée par une option `{ carte: true }` pour les panneaux d'action. `.card` ne change pas (R-VIS-14).
- **`recipeCard(doc, { photoEnTete })`** : variante verticale `a.item-link.carte-plat` : `img.plat-vignette.grande` 4:3 (`object-fit:
  cover`, rayon 12) quand les octets sont là, puis `h3` serif, puis une ligne `.muted` « {source} · {durée} » ; les badges (« À importer »,
  favori, cuisinée) restent dans la carte ; sans photo : `a.item-link.carte-plat.sans-photo` (titre et ligne seulement). Le balisage de la
  carte horizontale actuelle ne change pas (épinglé par `tests/photo-plat.js:1164-1179`).
- **`grilleCartes(noeuds)`** : `div.grille-plats` (2 colonnes dès 360 px, 3 ≥ 900 px, `gap 1.2rem`) : classe neuve, `.grid` intact.
- **`pageHeader`** : inchangé (titre + sous-titre + actions) ; les écrans qui ne l'utilisaient pas (Aujourd'hui) l'adoptent.
- **`icones.js`** : `icone(nom)` → `svg[aria-hidden=true][focusable=false]` 24 × 24 au trait (`stroke: currentColor`) : soleil, livres,
  calendrier, toque, plus, roue, loupe, globe, livre ouvert, horloge, personnes, appareil photo, image. Utilisées par `shell()` (NAV),
  `add.js` (grille), `emptyState`, la ligne de source des cartes, les repères de la fiche.
- **`bookCover`** : inchangé (R-UX-14, S3, tests/ajouter.js:1355-1373) ; la grille des livres garde `.grid`, les couvertures passent à
  `minmax(170px, 1fr)` par une classe `.grid.livres`.

## 4. Écrans (UI-1)

### 4.1 Bibliothèque (`src/ui/library.js`)

`pageHeader('Bibliothèque', { subtitle: 'Tes livres, tes trouvailles, tes recettes.' })`, puis `segmented` **Recettes | Livres | Plats**
(`?tab=recettes|books|dishes`, `recettes` par défaut ; les adresses `?tab=books` et `?tab=dishes` d'aujourd'hui restent valides).
Segment Recettes : champ `input[type=search]` « Une recette, un ingrédient… » (filtre local sur `ctx.docs` : titre, ingrédients, livre,
comme `library.js:66`), puces **Toutes / De mes livres / Du web** (`edition_id` non nul ; `source_url` non nul : un signet non lu est
« Du web » avec le badge « Lien web »), tri : dernière modification d'abord ; `grilleCartes` de `recipeCard(doc, { photoEnTete: true })`
pour chaque recette dont `availability !== 'reference_only'`, les octets des photos lus en UNE fois par `repo.getFiles(...)` (comme les
couvertures, library.js:57) et révoqués après chaque redessin (D-T9 : `remplacerEnRevoquant` relève `img.plat-vignette`). Pied :
« Recettes de mes livres à importer → » vers `#/library?tab=a-importer` : liste compacte des références sans adresse, groupées par livre
(« {titre du livre} » puis « {titre} · p. N · À importer » → `#/recipes/<id>/importer`). Vide : « Aucune recette pour l'instant. » +
« Ajouter une recette » (→ `#/add`). Segments Livres (grille actuelle, « Ajouter un livre » → `#/add/livre`) et Plats inchangés ;
« Liens web gardés » et « Recettes créées avec l'IA » restent sous Livres (ordre N-7) ET apparaissent dans la grille Recettes avec leur
badge.

### 4.2 Fiche recette (`src/ui/recipe.js`, `src/ui/photo-plat.js`)

Ordre du DOM : `pageHeader` (titre ; sous-titre = « Du web · {hôte} » / « De mon livre · {titre} — {auteur} · page N » / étiquette IA ;
`back`) → `div.fiche-tete` à deux colonnes ≥ 760 px (`.two-col`) : colonne 1 = badges (disponibilité, version, vérification, type, cuisines),
bandeau web / bandeau lecture, ligne de repères `div.reperes` (« {n} portions · {durée} », chaque partie seulement si connue), lien
« Voir la page d'origine ↗ » (`a.btn.link[data-role=ouvrir-lien]`, https seulement), phrase dérivée « Texte conservé dans Mitsu — vérifie »,
`button.btn.primary.big.block` « Commencer à cuisiner » ; colonne 2 = `photo.entete` (figure pleine largeur de colonne, 4:3, `object-fit:
cover`, légende « Image de la page {hote} » inchangée) ; sous 760 px, la colonne 2 passe AVANT les repères (photo sous la provenance, comme
la maquette mobile). Puis `details.card` « Réglages et plus » (ouvert ≥ 760 px, fermé en dessous) qui reprend TOUT le contenu actuel de
`controls` et de la rangée d'actions sauf « Commencer à cuisiner ». Puis `div.recipe-body` : ≥ 760 px `.two-col` [section Ingrédients |
section Préparation] ; < 760 px un `segmented` **Ingrédients / Préparation** au-dessus (bascule par `hidden` sur la section non choisie,
état mémorisé dans l'instance, jamais dans l'adresse). Puis `photo.zone` (section « Photo du plat », gestes inchangés), « Original »,
« Versions », « Mémoire culinaire », Export, inchangés. Le test `tests/photo-plat.js:341` (ordre emplacement → `.card.sage` → body →
zone → Original) est amendé à l'ordre neuf (emplacement dans `.fiche-tete`, `details` « Réglages et plus » à la place de `.card.sage`).
Ingrédients : la liste garde `ingredientLineEl` et « Remplacer » (le mode cuisine garde les cases « j'ai » ; pas de liste cochable
dupliquée) ; le `select` « Évaluer une restriction… » et `timeText` restent dans l'en-tête de la section.

### 4.3 Fiche livre (`src/ui/book.js`)

`pageHeader(book.title, { subtitle: '{auteur} · {n} disponibles · {m} à importer', back })` ; `div.two-col.narrow-left` ≥ 900 px :
gauche = `bookCover` ≈ 200 px + `details` « Modifier la couverture » (le contenu actuel de la section Couverture, `renderZoneCouverture`)
+ `details` « Métadonnées et convention » (inchangé) + « Sommaire » : `div.thumbs` des pages `kind === 'index'` (vignettes numérotées,
« Reprendre la séance » si une séance est ouverte ; l'ordre se corrige dans le panneau de la séance, pas ici) ; droite = rappels (imports
à reprendre, séance en cours, convention tasses : inchangés), puis `section.plain` « Les recettes de ce livre » : filtres Toutes /
Disponibles / À importer / Favoris + champ, `ul.liste-compacte` de lignes `li.row.between` [`a[href=#/recipes/<id>]` titre serif,
`span.muted` « p. N » si `printed_page`, `span.chip.neutral` section] [badge « Disponible » / « À importer » / « Lien web » / « Partielle » ;
`a.btn.small` « Importer » (référence sans adresse) ; favori]. Sous 900 px : gauche puis droite. Pied : `div.row` « Ajouter des photos de
recettes » (`.btn.primary`, → `startScanSession` de la fiche : Photographier / Choisir des photos ou un PDF) + « Saisir une recette » +
« Ajouter le sommaire ». Le menu `details.menu-source` et ses trois chips d'état disparaissent (la phrase du sous-titre les remplace) ;
`renderAccueilLivre` (`?nouveau=1`) reste ; « Pages et fichiers sources » reste en bas (documents non-photo). Les tests qui lisent les
rangées « Importer / Saisir à la main » sous chaque carte (`tests/import-cible.js`) sont amendés à la ligne compacte (mêmes `href`).

### 4.4 Aujourd'hui (`src/ui/home.js`)

`pageHeader('Qu'est-ce qu'on cuisine ?', { subtitle: 'Cherche une recette, un ingrédient, une envie.' })` au-dessus de la `.search-bar`
(qui quitte sa `.card.sage`) ; « Favoris » et « Dernières cuissons » en `grilleCartes` de cartes-plat (la cuisson garde sa date et son
bouton « Refaire comme la dernière fois » sous la carte) ; « Reprendre ma recette », « Redécouvrir », « À utiliser » inchangés en
`section.plain` ; « Bienvenue » inchangé.

### 4.5 Ajouter, import ciblé, séance

`#/add` : titres serif, icônes au trait, section « Imports » en tête inchangée (D-1). `#/recipes/<id>/importer` : badge « À importer »
(référence) / « Partielle » ; le bouton « Retirer la page {n} » devient un `×` en coin de la vignette (même nom accessible, ≥ 44 px) ;
légende « Page 1 · p. 76 » (le champ « p. imprimée » s'ouvre à la tape) ; Monter / Descendre restent ; le glisser n'entre pas dans ce lot
(§ 8). Le panneau d'index de la séance (`table-matieres.js`) ne change que par le thème.

### 4.6 Résultats web (`src/ui/search.js`) — thème en UI-1, vignettes en UI-2

UI-1 : la carte « Trouvé sur le web » garde sa forme épinglée (`tests/recherche-web.js:1035`) ; thème seulement. UI-2 : `figure.apercu` >
`img.plat-vignette.grande` (4:3) insérée en TÊTE de la carte quand l'aperçu est reçu (forme amendée dans le test : `FIGURE.apercu` optionnel
en premier) ; les aperçus sont demandés une fois par liste de liens (clé = la demande envoyée), gardés dans la mémoire vive de la route
(`memoire`, comme les liens), révoqués par `remplacerEnRevoquant` et au changement de route ; le texte de garde devient « Une recherche =
2 appels à l'assistant (résultats, puis photos), comptés dans ton quota du jour. » ; sans aperçu (429, échec, `0007` absente) : « Photos
indisponibles pour cette recherche. » en `.muted` sous « Demande envoyée ».

## 5. Textes (FR → EN, par `t()`, entrées `src/i18n/en.js`, apostrophe U+2019 dans les chaînes)

| FR | EN | Où |
| --- | --- | --- |
| Bibliothèque | Library | NAV, pageHeader |
| Tes livres, tes trouvailles, tes recettes. | Your books, your finds, your recipes. | sous-titre |
| Recettes | Recipes | segment |
| Une recette, un ingrédient… | A recipe, an ingredient… | filtre |
| Toutes / De mes livres / Du web | All / From my books / From the web | puces |
| Recettes de mes livres à importer | Recipes from my books to import | pied |
| À importer | To import | badge, compteur, filtre |
| Disponible | Available | badge court |
| Partielle | Partial | badge court |
| Du web · {h} | From the web · {h} | ligne de source |
| De mon livre · {t} | From my book · {t} | ligne de source |
| {n} portions · {d} | {n} servings · {d} | repères (n ≥ 2 ; « 1 portion ») |
| Voir la page d'origine | View the original page | lien |
| Texte conservé dans Mitsu | Text kept in Mitsu | phrase dérivée |
| Texte et photo conservés dans Mitsu | Text and photo kept in Mitsu | phrase dérivée |
| Réglages et plus | Settings and more | details |
| Ingrédients / Préparation | Ingredients / Steps | segmented mobile |
| Les recettes de ce livre | The recipes in this book | section |
| {n} disponibles · {m} à importer | {n} available · {m} to import | sous-titre livre |
| Ajouter des photos de recettes | Add recipe photos | bouton |
| Ajouter le sommaire | Add the table of contents | bouton |
| Modifier la couverture | Change the cover | details |
| Sommaire | Table of contents | section |
| Cherche une recette, un ingrédient, une envie. | Search a recipe, an ingredient, a craving. | sous-titre accueil |
| Aucune recette pour l'instant. | No recipes yet. | vide |
| Une recherche = 2 appels à l'assistant (résultats, puis photos), comptés dans ton quota du jour. | One search = 2 assistant calls (results, then photos), counted in your daily quota. | garde web (UI-2) |
| Photos indisponibles pour cette recherche. | Photos unavailable for this search. | UI-2 |

Les libellés qui portent une règle restent : « Repérée dans ton livre — page {p} » (fiche), « Corriger », « Créer ma version »,
« Commencer à cuisiner », « Garder et lire », « Lue sur {h} le {d} … — vérifie. », « Selon la page », « Image de la page {hote} ».

## 6. Serveur : l'outil `apercu-web` (UI-2)

- **Demande** : `{ outil: 'apercu-web', corps: { urls: [ ... ] } }`, 1 à 5 chaînes, chacune ≤ 2 048, `https` seule, validées par
  `valideAdresse` avec `hotesRefuses` AVANT la réservation (une adresse refusée → 422 `interdit` pour toute la demande : l'app ne l'envoie
  jamais, elle filtre d'abord) ; doublons retirés ; corps ≤ 512 Kio.
- **Traitement** : une réservation (`assistant_reserver(owner, 'apercu-web', octets, quota)`) ; puis, en parallèle borné (5 au plus), pour
  chaque adresse : `telechargerPage` (bornes `LIMITES_LECTURE` : 3 sauts, 15 s par saut, 30 s par page, 2 Mio) → `imageUrlDe(objet, html,
  { urlFinale, hotesRefuses, autresRecettes })` sur le premier `Recipe` trouvé (sinon `og:image` hors page de liste) → `telechargerImage`
  (types jpeg/png/webp, ≤ 1 Mio ici, `signatureImage`) ; budget total 90 s sous les 120 s de la fonction ; une adresse qui échoue rend
  `{ url, image: null, raison }` (`inaccessible`, `pas_de_recette`, `pas_d_image`, `image_trop_lourde`, `delai`) sans faire échouer les autres.
- **Réponse** : 200 `{ apercus: [{ url, image: { type, taille, url_finale, octets (base64) } | null, raison }] }` ; ≤ 5 × 1,4 Mio de base64 ;
  jamais le modèle (`OUTILS_MODELE` inchangé) ; journal `apercu-web`, statut 200, jetons null, durée.
- **Serveur** : `OUTILS` + `'apercu-web'` (logique.js:7), `lireDemande` : forme `urls` pour cet outil seul (logique.js:40-58), branche dans
  `index.ts` à côté d'`image-web` (261-266) ; tests Node : logique (formes, bornes, doublons, refus avant réservation), `index.ts` (réservation
  unique, parallélisme borné, budget, journal), `OUTILS_0007` dans `tools/generer-migrations.test.mjs:1182-1192`.
- **`0007_apercu_web.sql`** : `drop constraint` + `add constraint … check (outil in (…six valeurs…))`, écrite à la main comme `0006`, sa
  preuve (contrainte à six valeurs dans l'ordre d'`OUTILS_0007`, `assistant_reserver(uid, 'apercu-web', …)` → id non nul, les cinq anciens
  passent), README étape 13, section « Preuve `0007` — à jouer » et « Sondes `apercu-web` » dans `RESULTATS-mitsu.md`.
- **Client** : `src/domain/apercu-web.js` : `lireApercusWeb({ urls, session }, { fetch, signal, tentativeMs: 90 000, corpsMax: 8 Mio })` →
  `{ etat: 'recus', apercus: Map(url → { blob, type } | null) }` | `{ etat: 'echec', raison }` ; chaque base64 relu à la longueur exacte, type
  dans la liste blanche, blob retypé ; `search.js` l'appelle après `trouve` (D-UI-13) hors du vol partagé (il n'y a rien à annuler : un
  « Annuler » pendant la recherche empêche la demande d'aperçus).
- **Sondes** après redéploiement (sans dépense : forme refusée 400, adresse interdite 422, sans jeton 401 ; payantes, zéro jeton : les cinq
  adresses de la recherche « puttanesca » → cinq images ou raisons, durée totale ; une page de liste → `pas_de_recette`).

## 7. Tests

- **Épingles à amender, jamais à contourner** (liste de la cartographie) : `tests/theme.js:27-28` (six hex et accent-2), `PAIRES` (+ 4),
  `:93` (`.badge.ai` olive), `tests/tests.js:250` (total N−1), les 14 pins de version (8 fichiers) + `src/model/schema.js:6`,
  `tests/photo-plat.js:341` (ordre de la fiche), `tests/recherche-web.js:1035/1055/1225` (forme de la carte, UI-2), `tests/import-cible.js`
  (rangée « Importer » → ligne compacte ; badge « À importer » ; « Retirer la page {n} » en `×`), `tests/ajouter.js:8` (`MODULES_NEUFS` +
  `icones.js`), SHELL, `tests/lecture-web.js` (libellé « Ouvrir le lien » → « Voir la page d'origine », même `data-role`), les tests qui
  lisent le libellé NAV « Mes livres » (à relever par `grep` avant T1).
- **Tests neufs** (par comportement, bases jetables, `fetch` factice) : `tests/carnet.js` : jetons et paires (dans `theme.js`), carte-plat
  avec et sans octets (jamais de cadre vide ; `plat-vignette` révoquée au redessin), grille 2/3 colonnes (scène hors écran à 375 et 1100 px),
  segment Recettes (filtres par données, pied « à importer », `?tab=` ancien valide), fiche recette (ordre du DOM, bascule Ingrédients /
  Préparation sans navigation, « Réglages et plus » porte tous les anciens boutons, repères dérivés : « 1 portion », rien sans durée,
  phrase « conservé » dérivée), fiche livre (ligne compacte, « Importer » seulement sur une référence sans adresse, sous-titre dérivé,
  couverture repliée), libellés (« À importer » n'apparaît que pour `reference_only` sans `source_url`), icônes (`aria-hidden`, `currentColor`),
  filets i18n. UI-2 : `tests/apercu-web.js` (forme exacte de la demande, en-têtes, un appel pour N, 429 → résultats sans image et phrase,
  blob par adresse, révocation, type hors liste refusé, jamais de `src` https).
- **Mutants** rejoués sur des copies servies à part : olive remise en tomate (theme rougit), `photoEnTete` sans contrôle des octets (cadre
  vide : rougit), filtre « Du web » câblé sur `mode=web` (rougit : aucun appel), « À importer » posé sur une `available` (rougit),
  `apercu-web` sans validation avant réservation (harnais Node rougit), `src = https://…` (rougit).
- **Preuve visuelle** (registre, hors git) : `preuve-visuelle.cjs` du lot refonte rejouée aux quatre largeurs sur les écrans touchés
  (bibliothèque Recettes, fiche recette, fiche livre, onglet Web) ; captures dans le registre.

## 8. Hors périmètre (nommé pour ne pas y glisser)

Navigation à deux onglets et avatar (V-3) ; police externe (CSP, V-2) ; renommer la marque (D-UI-11, § 13) ; sous-titres de recette,
titres d'étape, « Livre reconnu » sans vérification, « Les pages sont regroupées automatiquement » (I-D4) ; glisser-déposer des pages
(Monter / Descendre restent le chemin garanti) ; images dans les listes de plats (`dishes`) et de repas ; cases « j'ai » sur la fiche ;
stockage des aperçus dans `files` ; redimensionnement côté serveur ; mode sombre.

## 9. Ordre des tâches

**UI-1 « Carnet »** (plan 1, branche `experience-carnet`, worktree `~/projects/mistu-carnet`, serveur 8095) :
T1 jetons, typographie, `section.plain`, `icones.js`, NAV « Bibliothèque », `APP_VERSION 0.16.0`, pins, `theme.js` amendé ;
T2 carte-plat, `grilleCartes`, segment Recettes + filtres + pied « à importer » ; T3 fiche recette ; T4 fiche livre ; T5 Aujourd'hui,
Ajouter, import ciblé, libellés dérivés ; T6 filets, preuve visuelle, docs, total épinglé. Revue à trois lentilles par tâche, revue finale,
vague, `/verify`.
**UI-2 « Aperçus »** (plan 2, même branche après UI-1 ou branche `apercus-web`) : S1 serveur + tests Node + `0007` + preuve + README ;
S2 client + carte + tests ; S3 docs, redéploiement (chef), sondes, RESULTATS.

## 10. Preuve réelle (geste de Neegan, sur le site public, après le push)

UI-1 : Bibliothèque → Recettes (grille, filtres, pied), une fiche de recette avec photo sur le Mac (deux colonnes) et sur l'iPhone
(onglets), une fiche de livre, Aujourd'hui, Ajouter ; dire ce qui ne ressemble pas assez aux maquettes. UI-2 : après `0007` collée et la
fonction redéployée : « puttanesca » dans l'onglet Web → des photos sous les titres, `select jour, outil, appels from
public.assistant_usage_jour` : +2 par recherche ; une recherche dont les sites n'ont pas d'image → la phrase « Photos indisponibles ».

## 11. Risques et limites assumés

- Les photos locales sont ré-encodées à 1 200 px (image.js:16) : une carte-plat sur un Mac large peut paraître douce ; assumé.
- Une grille de 500 recettes lit `files` en une transaction par rendu (dette R-F-25) ; mesurer à T2, borner la grille à 60 cartes + « Voir
  plus » si la lecture dépasse 300 ms.
- `app.js` reste hors suite : la coquille (NAV avec icônes) n'est mesurée que par la preuve visuelle.
- UI-2 : 2 appels par recherche (30 recherches illustrées par jour) ; une page sans `Recipe` ni `og:image` n'a pas d'aperçu ; un 403
  anti-hotlink rend `inaccessible` (D-F3 : rien n'est contourné) ; 5 pages + 5 images par appel = jusqu'à 90 s côté serveur.
- La preuve visuelle vit hors git (registre) : la recomposition des fiches n'est mesurée aux quatre largeurs que là.

## 12. Amendements

(vide à la rév. 1)

## 13. À trancher par Neegan (sans urgence ; chaque lot a construit un défaut)

1. **La marque** : garder « Cuisine OS » (défaut) ou passer à « Mitsu » (titre, manifeste, icône iPhone, `SHELL`).
2. **Les aperçus** : automatiques (défaut, 2 appels par recherche) ou sur une tape « Voir les photos (1 appel) ».
3. **L'entrée de navigation** : « Bibliothèque » (défaut) ou garder « Mes livres » avec le segment Recettes dedans.
4. **La fiche recette** : « Réglages et plus » replié sur l'iPhone (défaut) ou toujours ouvert.
