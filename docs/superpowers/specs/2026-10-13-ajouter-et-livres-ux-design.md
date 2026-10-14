# Page « Ajouter » et flux des livres — design (rév. 2, 13 octobre 2026)

Source : notes de Neegan `docs/idees/2026-10-13-ux-page-ajouter.md`. Décisions prises en chat le 13 octobre (soir) :
**tout en un lot** (navigation, dévoilement progressif, puces « Cuisines », couverture) ; le « lien web » est un **signet
simple** (adresse + titre), pas une lecture de la page. Lot livré sur la branche `ajouter-livres-ux`, arbre `~/projects/mistu`.
**Rév. 2** : réécrite après deux revues adverses (sécurité S1-S16, faisabilité F1-F25 — § 15.1) ; ce qui a changé est
marqué « (S·/F·) ».

## 1. Le problème, du côté de la personne

Aujourd'hui, la page « Ajouter » (`#/add`, `src/ui/add.js`) montre quatre tuiles puis, en bas, **tout** le formulaire
« Ajouter un livre ». Quand on a un livre dans les mains, on ne sait pas : où mettre sa couverture, comment lui donner ses
pages d'index, comment y rattacher des recettes photographiées — tout de suite ou plus tard. La mécanique existe
pourtant (fiche livre → « Photographier des pages » → séance → « Index / table des matières » → « Créer les références » ;
identification par ISBN ; lecteur de code-barres) : elle est **mal exposée**, pas absente.

Le lot répond à trois questions, dans l'ordre où elles se posent :
1. **« Qu'est-ce que je veux ajouter ? »** — une grille de cartes claires, et rien d'autre sur la page.
2. **« Comment j'ajoute un livre ? »** — un flux en deux pas (identifier, puis compléter), avec sa couverture.
3. **« Et maintenant, mes photos vont où ? »** — un accueil du livre juste après sa création, des boutons sans ambiguïté
   dans la fiche, et, quand on part de la page générale, une question posée **avant** de prendre les photos.

## 2. Périmètre et ordre de livraison

**Dans le lot.** § 4 grille · § 5 flux « Ajouter un livre » en deux pas · § 6 couverture · § 7 puces « Cuisines »
(formulaire du livre, fiche livre **et** éditeur de recette) · § 8 accueil du livre après création · § 9 fiche livre ·
§ 10 sélecteur avant un scan parti de la page générale · § 11 signet web.

**Ordre de livraison (F25).** Un seul lot, mais le plan le découpe en trois tranches **livrables chacune seule**, dans cet
ordre : (1) navigation et puces (§§ 4, 5 sans couverture, 7, 8, 9, 10) ; (2) signet (§ 11) ; (3) couverture (§ 6) — la
seule tranche qui parle à un hôte tiers et touche les fichiers : si elle doit attendre, les deux premières sont déjà
servies.

**Hors du lot (nommé pour ne pas y glisser).** Lecture d'une page web pour en tirer une recette · réduction des **pages
scannées** (D2 du 12 octobre : `reduireImage` ne sert ici qu'aux couvertures) · transport des **octets** des fichiers entre
appareils (L4 : une couverture ne voyage pas encore) · **effacement automatique de fichiers** (S8/S11 : aucun blob n'est
supprimé par ce lot — balayage des orphelins = lot L4, avec le stockage) · OCR · refonte de l'éditeur de recette au-delà
du champ « Cuisines ».

## 3. Invariants (hérités, et deux nouveaux)

- **I-A Rien d'inventé.** Une fiche renseignée par Open Library ou Google Books est **étiquetée** comme telle, modifiable,
  jamais présentée comme saisie par la personne ; une couverture est **reçue** ou **photographiée**, jamais un visuel de
  remplacement. Sans couverture, la vignette texte actuelle reste. Un signet **n'est pas** « repéré dans ton livre » (F8).
- **I-B États = événements réels.** « Livre ajouté » après l'écriture ; « Couverture enregistrée » après `putFile` ;
  « Aucune fiche trouvée » après la réponse (ou l'échec) du réseau, jamais avant.
- **I-C Écran du côté de la personne.** Première ligne de chaque écran = ce qu'elle peut faire ; aucune contrainte interne
  affichée ; le facultatif est replié ; quand l'app parle à un tiers, l'écran **le nomme** (S12).
- **I-D Porte unique et nettoyage.** Toute écriture de fiche passe par `repo.save` / `repo.saveBatch` (qui appliquent R61
  — caractères de contrôle retirés), **jamais** par `db.mutate` direct depuis une vue (S2). Chaînes par `t()` avec entrée
  dans `src/i18n/en.js` ; `SHELL` et `VERSION` suivis ; aucun `innerHTML`, aucun `html:` d'`el()`, aucun `window.open`.
- **I-E L'original n'est jamais réécrit.** Un signet est une recette-référence ; il ne crée aucune version.
- **I-F (nouveau) Une photo prise depuis un livre appartient à ce livre.** Un scan lancé depuis une fiche livre, depuis
  l'accueil d'un livre ou depuis « Scanner cette recette » porte l'édition **sans la redemander** ; seul un scan parti de la
  page générale pose la question.
- **I-G (nouveau) Ce qui vient d'ailleurs est borné et revalidé.** Métadonnées distantes tronquées, images distantes
  bornées en octets et en pixels **avant** décodage, toute couverture ré-encodée par l'app, adresse d'un signet revalidée
  **au rendu** (S3-S7).
- **I-H (nouveau) Les vues reçoivent leurs gestes.** Les rendus neufs reçoivent `{ navigate, startScanSession, pickFiles,
  historique }` en paramètre (motif `porte-entree.js`), câblés par `app.js` — c'est ce qui les rend testables sans
  bundler (F1).

## 4. Page « Ajouter » — la grille

`renderAdd(params, query, ctx, gestes)` ne rend plus que `pageHeader` + une grille `.grid.wide` de **cinq cartes** :

| Carte | Sous-titre | Geste |
|---|---|---|
| 📚 **Ajouter un livre** | ISBN (scan ou saisie), ou titre à la main | `navigate('/add/livre')` |
| 📷 **Photographier ou importer des pages** | Caméra, photos ou PDF — pour une recette ou un index | ouvre le sélecteur § 10, dans la page |
| ✍️ **Saisir une recette** | À la main | `navigate('/recipes/new' + ?edition)` (inchangé) |
| 🔗 **Garder un lien web** | Une recette ou une page à retrouver | `navigate('/add/signet')` |
| 🧊 **Ajouter un lot au congélateur** | inchangé | `navigate('/kitchen?tab=inventory&add=1')` |

- Le formulaire « Ajouter un livre » **disparaît** de `#/add`. Les tuiles « Photographier des pages » et « Choisir des photos
  ou un PDF » **fusionnent** dans la deuxième carte ; les deux manières de fournir les fichiers vivent dans le sélecteur.
- **`#/add?edition=<id>`** (arrivée depuis « Scanner cette recette », `recipe.js`) : l'id est confronté à
  `ctx.editionsById` ; **inconnu → traité comme absent** (S9). Connu → I-F : la deuxième carte s'ouvre **directement sur
  les deux boutons de fichiers** (livre et genre « recette » déjà connus, aucune question — F14) ; « Saisir une recette »
  garde `?edition`.
- La `tile()` locale devient `carte(ico, titre, sousTitre, onClick)` dans `src/ui/components.js` (même rendu ; § 8 l'utilise).
- Routes neuves enregistrées dans `src/app.js` (`registerRoutes`) : `/add/livre`, `/add/signet` (regex ancrées : aucune
  concurrence avec `/add`, F17).

## 5. « Ajouter un livre » en deux pas — route `#/add/livre`

Nouveau module `src/ui/livre-ajout.js` ; `bookForm`, `scan` et `lookupIsbn` y déménagent (`lookupIsbn` n'est importé nulle
part ailleurs — F17).

**`lookupIsbn(isbn, { fetch = globalThis.fetch, signal } = {})` — signature neuve (F3).** Rend `{ fiche, source }` avec
`source ∈ { 'openlibrary', 'googlebooks', null }` ; les **deux** appels sont dans un `try` ; chaque `fetch` est appelé avec
`{ mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal }` (S12) ; le corps est lu
en texte et **abandonné au-delà de 256 Ko** avant `JSON.parse` ; chaque champ retenu (`title`, `author`, `publisher`,
`language`) est **tronqué à 300 caractères** et `year` doit être un entier à quatre chiffres, sinon vide (S3). Un
échec réseau, un 404, un 429 (mesuré sur Google Books le 13 octobre) ou le délai → `{ fiche: null, source: null }`.

**Pas 1 — Identifier.** Première ligne : « Scanne le code-barres, tape l'ISBN, ou saisis le livre à la main. » Un champ ISBN,
deux boutons `primary` : **« Scanner le code-barres »** (`BarcodeDetector`, comme aujourd'hui ; absent → bouton désactivé +
« Le lecteur de code-barres n'est pas offert dans ce navigateur. ») et **« Identifier »** ; dessous, `.btn.link` **« Saisir à
la main »** ; sous les boutons, la phrase : « L'ISBN est envoyé à Open Library, puis à Google Books si besoin. » (S12).
- « Identifier » → `lookupIsbn` avec un `AbortController` à **10 s** → pas 2 avec les champs remplis et la provenance :
  « Renseigné par Open Library — vérifie et corrige. » (ou « … par Google Books »). Échec → pas 2, champs vides, « Aucune
  fiche trouvée pour cet ISBN. Complète à la main. » (I-B). Pendant l'appel : bouton désactivé, « Recherche… ».
- « Saisir à la main » → pas 2, champs vides, ISBN conservé.

**Pas 2 — Compléter.** Champs visibles : Titre*, Auteur / chef, **Langue du livre** (elle pilote la recherche FR/EN : pas
repliée — F23), **Cuisines** en puces (§ 7), **Couverture** (§ 6, tranche 3). Replié dans « Plus de détails » : Éditeur,
Année, Convention de mesure. L'ISBN **ne se modifie qu'en revenant au pas 1** par « ← Changer d'ISBN » (la saisie du pas 2
est conservée — F23). Bouton **« Ajouter ce livre »** (`primary`, désactivé sans titre).
- Enregistrement : `repo.saveBatch` (I-D) écrit `books` + `book_editions` (**+ `cover_sha256`** si une couverture est posée)
  dans **une** transaction, origine `local` ; puis `toast(t('Livre ajouté'))` et `navigate('/books/<edition.id>?nouveau=1')`.
- Modèle pur exporté : `livreAjoutModel(etat)` → `{ pas, champs, provenance, couverture, peutEnregistrer, messages }` ;
  rendu `renderLivreAjout(model, gestes)` (I-H).

## 6. Couverture (tranche 3)

**Modèle.** `book_editions.cover_sha256` (texte, facultatif) = **pointeur souple** vers une ligne de `files` ; **aucune
relation déclarée dans `RELATIONS`** (F2/S1) : la ligne `files` ne voyage pas entre appareils avant L4, et une relation
déclarée rendrait **irrestaurable** toute archive faite sur un appareil qui a reçu `cover_sha256` sans ses octets
(`backup.js` refuse un parent `files` absent). Un pointeur qui ne résout pas → vignette texte, sans message. (Le même trou
latent existe pour `source_pages.sha256` : dette nommée, à traiter en L4.) Aucune méta `role` sur la ligne `files` : rien ne
la lit, et l'archive ne la conserverait pas (F9). **Pas de nouvel index → `DB_VERSION` inchangée ; aucune migration serveur ;
`tools/generer-migrations.mjs --check` reste à 0 (F24).**

**Sources.**
1. **Reçue par ISBN** (`source === 'openlibrary'` seulement — le repli Google Books est abandonné pour la couverture : API
   429 sans clé le 13 octobre, F/§ 14) : `https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false` avec les
   mêmes options de `fetch` que § 5 et le même délai 10 s. **Mesuré le 13 octobre (soir) depuis `https://neegans.github.io`** :
   200 `image/jpeg` 17,9 Ko pour un ISBN connu, 404 sans couverture (`default=false` tient). À refaire depuis `localhost`
   au plan. Bornes **avant** décodage (S4) : `Content-Length` **et** `blob.size` ≤ **5 Mo**, type annoncé dans
   `COVER_INPUT_MIME` (exporté de `mime.js` : `image/jpeg`, `image/png`, `image/webp` — F20), **dimensions lues dans
   l'en-tête du fichier** (`dimensionsImage(blob)` : SOF JPEG / IHDR PNG / VP8·VP8L·VP8X WebP) ≤ **50 Mpx** ; hors bornes ou
   en-tête illisible → rejet silencieux. Tout échec → « Aucune couverture reçue. Tu peux la photographier. » — jamais une
   carte rouge.
2. **Photographiée** : `pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' })`.
3. **Choisie** : `pickFiles({ accept: 'image/*', multiple: false })`.
   Pour 2 et 3 : octets ≤ **25 Mo**, type dans `ALLOWED_MIME` image (HEIC admis en entrée : Safari le décode) ; une image
   que `createImageBitmap` **ne décode pas** (HEIC sur Chrome, fichier corrompu) → « Cette image ne peut pas être lue ici.
   Essaie une autre photo. » (F11).

**Ré-encodage systématique (S5/F11).** `src/core/image.js` : `reduireImage(blob, { maxCote = 1200, qualite = 0.85 })` →
`createImageBitmap(blob, { imageOrientation: 'from-image' })` (repli sans l'option si rejetée) → `canvas` → **toujours** un
`Blob` `image/jpeg`, quelle que soit la source. Conséquences voulues : le type est **prouvé** par le décodage, les
métadonnées (dont la position GPS d'une photo) **disparaissent**, HEIC devient JPEG. `sha256` du blob ré-encodé →
`repo.putFile(sha256, blob, { mime: 'image/jpeg' })` — idempotent : une empreinte déjà connue rend la ligne existante
inchangée, et rien ne dépend de sa méta (F10). La capture de synchronisation ne met pas cette ligne en file (R58).

**Orphelins (S8/S11).** Si la personne quitte le pas 2 sans enregistrer, ou retire une couverture, la ligne `files` **reste** :
ce lot **n'efface aucun blob** (une suppression hors transaction unique court contre une séance de scan qui peut partager
l'empreinte). Coût : quelques centaines de Ko par essai abandonné ; balayage par comptage de références = L4.

**Affichage.** `bookCover(edition, book, { href, fichier })` : `fichier?.blob` → `<img class="cover-img" alt="">` ; sinon la
vignette texte. **Propriétaire des URL `blob:`** (F4/S15) : `src/core/blob-urls.js` — `urlDeBlob(blob)` enregistre l'URL ;
`revoquerUrlsDeBlob()` révoque tout ; `app.js` l'appelle **à chaque changement de route** et `library.js` **en tête de chaque
`draw()`**. `renderLibrary` devient asynchrone : il lit en **une** transaction les lignes `files` des éditions qui portent un
`cover_sha256` (`repo.getFiles(sha256s)`, neuf, sur `db.getMany`) et les passe à `booksTab(ctx, fichiers)` (signature
changée ; l'option `href` survit — F5). `ctx` ne porte pas les fichiers (F17).

**Fiche livre (F15).** La couverture s'affiche **dans l'en-tête** de la fiche (à gauche du titre) ; un bloc visible
« Couverture » (hors du `<details>` replié « Métadonnées et convention ») offre « Photographier », « Choisir une image »,
« Retirer » ; chaque geste réécrit l'édition par `repo.save` (origine `local` : le pointeur repart au serveur). « Retirer »
met `cover_sha256` à `null` et **ne touche pas** la ligne `files`.

## 7. Puces « Cuisines »

Composant `src/ui/puces.js` : `pucesModel({ choisies, existantes, graine })` → liste ordonnée `{ cle, libelle, choisie }` ;
`renderPuces(model, { basculer, ajouter })` → boutons `.puce[aria-pressed]` + champ replié « Autre… » (Entrée ou « Ajouter »).
- **Une seule normalisation** décide tout (F16) : `normaliser(s)` = `trim`, minuscules, accents retirés (`\p{M}` avec `u`).
  **Valeur stockée** = la chaîne **en minuscules, sans espaces de bord**, comme `add.js` et `recipe-edit.js` le font
  aujourd'hui ; **affichage** = première lettre en capitale (cosmétique, `capitaliser()`). Deux valeurs de même
  `normaliser()` sont la même puce : la valeur **existante** gagne, sa jumelle de graine est masquée ; « Autre… » refuse un
  doublon par la même clé et ignore le vide.
- **Suggestions**, dans l'ordre : les cuisines **déjà choisies**, celles **déjà présentes** dans `books.cuisines` et
  `recipes.cuisines` (fréquence décroissante), puis la **graine** : `québécoise, autochtone, française, italienne, levantine,
  marocaine, mexicaine, indienne, chinoise, japonaise, thaïe, vietnamienne, grecque, espagnole, américaine` (libellés
  passés par `t()` à l'affichage ; valeurs stockées en français, en minuscules).
- **Stockage inchangé** : `cuisines` reste un tableau de chaînes ; rien n'est renommé ni fusionné dans la base.
- Utilisé au pas 2 du livre (§ 5), dans la fiche livre (bloc replié « Métadonnées et convention », à la place du champ
  texte) et dans `recipe-edit.js` à la place du champ texte « Cuisines » (une ligne de rendu, une ligne de lecture).

## 8. Accueil du livre après création — `#/books/:id?nouveau=1`

Pas de modale (fragile en PWA iOS ; la fiche **est** la destination). `renderBook` lit `query.nouveau` : si présent, un
panneau `.card.accueil-livre` s'affiche **au-dessus** du contenu habituel :

> **Le livre est dans ta bibliothèque. Et maintenant ?**
> 📸 **Photographier l'index ou la table des matières** — pour que l'app connaisse les recettes du livre.
> 📄 **Photographier ou importer des pages de recettes** — seulement celles qui t'intéressent, tout de suite.
> **Plus tard** — aller à Mes livres.

- Les deux premières cartes dévoilent « Photographier » / « Choisir des photos ou un PDF » et lancent
  `startScanSession(files, { edition_id, intention })` (§ 10, I-F) ; « Plus tard » → `navigate('/library')`.
- Le panneau tient au paramètre d'adresse : « × » le **retire du DOM** et appelle `historique.remplacer('#/books/<id>')`
  (geste injecté qui enveloppe `history.replaceState` — pas de `hashchange`, donc pas de re-rendu, F19/I-H). Un
  rechargement sans `?nouveau=1` montre la fiche normale.
- **`?nouveau=1` n'écrit pas d'activité** : `recordActivity('open_book')` est sauté (seules les ouvertures volontaires
  comptent — S16).
- Modèle pur `accueilLivreModel({ nouveau })` → `{ afficher, cartes }`.

## 9. Fiche livre — deux gestes nommés, association automatique

En-tête de `renderBook` : actions **« + Pages d'index »** (dévoile « Photographier » / « Choisir des photos ou un PDF ») et
**« + Recette »** (dévoile les deux mêmes + « Saisir à la main »). Tout scan parti d'ici appelle `startScanSession(files,
{ edition_id, intention })` (I-F). `indexEntriesPanel` et les gestes par recette référencée (« Scanner cette recette »,
« Saisir à la main ») sont **inchangés**.

Séance déjà ouverte pour cette édition (`scan_sessions` à `status` ouvert, lues dans `ctx`) : une ligne `t('Séance en
cours : {n} page(s) — Reprendre')` (convention de pluriel de la maison, F21) au-dessus des gestes.

## 10. Sélecteur avant un scan parti de la page générale

Ouvert par la deuxième carte de § 4, **dans la page** (la grille est remplacée ; « ← Retour » la rétablit) :

> **Ces pages vont où ?**
> Livre : `select` « Recette indépendante (sans livre) » *(défaut)* + mes livres, libellés par **`libelleLivre(edition,
> book)`** = « titre · auteur · année » (fonction unique, **reprise aussi** par le `select` « Livre de cette séance » de
> `import.js` — F18), triés par **activité récente lue dans `ctx.library_activity`** puis titre.
> Genre de pages : ◉ **Page(s) de recette** *(défaut)* ○ **Index ou table des matières** *(désactivé sans livre : « Un index
> appartient à un livre : choisis-le d'abord. »)*.
> [ 📷 Photographier ] [ 🖼 Choisir des photos ou un PDF ]

- Les deux boutons appellent `startScanSession(files, { edition_id, intention })` avec les `accept` actuels.
- **L'intention voyage dans l'adresse, pas dans la base (F6).** `startScanSession` navigue vers
  `#/import?session=<id>&intention=index|recette` ; `sessionView` l'applique **au premier rendu seulement** (`index` → toutes
  les pages présélectionnées + `indexPanel` ouvert ; `recette` → pages présélectionnées + « Regrouper en recette » rendu
  `primary`), puis `historique.remplacer('#/import?session=<id>')` retire le paramètre : les `refresh()` suivants n'ont plus
  rien à appliquer et la désélection de la personne tient. **Aucun champ nouveau sur `scan_sessions`.** Le `select` « Livre
  de cette séance » et le reste de la séance sont inchangés.
- Modèle pur `selecteurScanModel({ livres, editionImposee, livreChoisi, genre })` → `{ options, genreDisponible, boutons }`.

## 11. Signet web — route `#/add/signet`

Nouveau module `src/ui/signet.js`. Écran :

> **Garder un lien web** — une recette ou une page que tu veux retrouver dans ta bibliothèque. *L'app n'ouvre pas la page :
> donne-lui le titre.*
> Adresse* · Titre* · Livre (facultatif : « Aucun — recette indépendante » / mes livres) · Cuisines (puces) · **« Garder le
> lien »**.

- **Validation dans le modèle et à l'écriture (S13)** : `signetModel({ adresse, titre, editionId, cuisines })` → `{ valide,
  erreurs, hote }`. `adresse` DOIT se lire par `new URL()` avec `protocol ∈ { 'http:', 'https:' }`, `href` ≤ **2 048**
  caractères, titre non vide ≤ 300 ; `enregistrerSignet` **revérifie** les mêmes règles avant `repo.save` (un `maxlength`
  seul se contourne au collage). Valeur stockée = `url.href`.
- Écriture (I-E, I-D) : une `recipes` `reference_only`, `current_version_id: null`, `ingredient_ids: []`, `source_page_ids:
  []`, `original_title`, `original_language` = langue de l'interface, `type: null`, `tags: []`, `cuisines`, `edition_id`
  (ou `null`), **`source_url`** (champ déjà connu de `exporters.js`, F22), `source_label` = `url.host`, `verification_state`
  comme les références d'index. Puis `toast(t('Lien gardé'))`, `navigate('/recipes/<id>')`.
- **Vue recette (F8, S6, S7)** : quand `source_url` est présent, la branche `referenceOnly()` de `recipe.js` rend un texte
  **propre au signet** — « Lien web gardé. L'app n'a pas lu la page : ouvre-la pour cuisiner. » — **sans** « Scanner cette
  recette », et la pastille dit « Lien web » (pas « Repérée dans ton livre »). Le bouton **« Ouvrir le lien »** n'est rendu
  que si `new URL(source_url)` **au rendu** a un protocole `http:`/`https:` (une fiche venue d'une archive ou de la
  réception peut porter n'importe quoi) ; sinon l'adresse est affichée en **texte inerte**. L'hôte affiché est **recalculé**
  depuis `source_url` (`new URL(...).host`, punycode pour les IDN, `userinfo` exclu) — jamais `source_label` stocké. Lien
  = `<a class="btn" target="_blank" rel="noopener noreferrer">` (pas de `window.open` ; `no-referrer` global tient). Un
  signet rattaché à un livre affiche **et** le livre **et** l'hôte (F22).
- **Recherche (F7)** : `search.js` ajoute les `cuisines` aux `titleTokens` d'une référence ; un signet se trouve donc par
  son titre et ses cuisines (les références d'index ont `cuisines: []` : aucun effet sur elles).

## 12. Données, synchronisation, archive, CSP

| Élément | Changement | Serveur | Archive |
|---|---|---|---|
| `book_editions.cover_sha256` | pointeur souple, **sans relation déclarée** | dans `data` → aucune migration | copié comme champ ; absence de la ligne `files` **tolérée** |
| `files` (couvertures) | nouvelles lignes JPEG ré-encodées, `syncable: true` | ligne **non** mise en file (R58), octets = L4 | déjà incluse |
| `recipes.source_url` | utilisé par le signet (déjà écrit par `exporters.js`) | `data` → aucune migration | déjà archivé |
| `scan_sessions` | **inchangé** (intention dans l'adresse) | — | — |
| `DB_VERSION` | **inchangée** | — | — |
| `--check` | DOIT rester 0 | — | — |
| CSP `connect-src` | **inchangée** : `'self' https:` — S10 retirée par R-UX-15 (l'assistant IA, `src/domain/llm.js`, accepte une URL de base **libre**, aucune liste fermée ne peut la couvrir) ; murs réels = `script-src 'self'`, `img-src` fermé, `object-src 'none'` | — | `tests/index.html` suit |

Tout passe par `repo.save`/`saveBatch` origine `local` ; livres, éditions, recettes et séances continuent de partir au
serveur comme aujourd'hui. Une couverture **ne voyage pas** avant L4 (§ 6, `CLAUDE.md`).

## 13. Ce que la suite de tests doit prouver (rouge d'abord)

Modèles purs + rendus DOM (motif `porte-entree`, gestes injectés — I-H), bases jetables (`withRepo`), **aucun réseau**
(`fetch` injecté), **aucun geste destructeur** dans le navigateur partagé, **aucun `history.*` réel** (geste `historique`
injecté — F19).

1. Grille : cinq cartes dans l'ordre, libellés `t()`, aucun formulaire ; `?edition` inconnu → traité absent ; connu →
   les deux boutons de fichiers, aucune question.
2. `livreAjoutModel` : pas 1 → pas 2 par « Identifier » (réponse injectée → provenance « Open Library »), par échec, par
   « Saisir à la main » ; « Changer d'ISBN » conserve la saisie ; `peutEnregistrer` faux sans titre.
   `lookupIsbn` : délai 10 s (horloge et `fetch` injectés : `signal.aborted`), corps > 256 Ko abandonné, champs tronqués à
   300, `year` non entier → vide, second appel qui rejette → `{ fiche: null }`, options de `fetch` passées (espion).
3. Enregistrement par `repo.saveBatch` (espion : **une** transaction, `books` + `book_editions` + `cover_sha256`) ; un titre
   avec `\u0001` arrive **propre** en base (R61 par `repo`) ; `navigate('/books/<id>?nouveau=1')` (geste espionné).
4. Couverture : `dimensionsImage` sur des en-têtes JPEG/PNG/WebP fabriqués (dont un 20 000 × 20 000 → refus avant tout
   décodage) ; `reduireImage` sur un PNG 2 000 px généré au canvas → JPEG ≤ 1 200 px, et sur un petit PNG → **JPEG quand
   même** ; blob indécodable → refus nommé ; `fetch` injecté 404 / rejet / `Content-Length` 6 Mo / type `text/html` →
   « Aucune couverture reçue », **aucun `logError`, aucune carte rouge** (F12) ; `putFile` idempotent ; `bookCover` avec
   fichier → `<img>`, sans → vignette ; « Retirer » → `cover_sha256: null`, ligne `files` **intacte** ;
   `revoquerUrlsDeBlob` appelé en tête de `draw()` et au changement de route (espion sur `URL.revokeObjectURL`).
5. Puces : ordre (choisies, fréquence, graine) ; « Italienne » stocké ≠ nouveau doublon de « italienne » ; graine masquée
   derrière une valeur existante ; « Autre… » ajoute en minuscules et choisit ; `recipe-edit` écrit le même tableau ;
   affichage capitalisé.
6. Accueil : `afficher` vrai avec `nouveau`, trois cartes ; « × » retire le nœud et appelle `historique.remplacer` ;
   `recordActivity` **non** appelé avec `?nouveau=1` (espion).
7. Fiche livre : deux actions ; `startScanSession` injecté reçoit `{ edition_id, intention }` ; « Séance en cours » seulement
   s'il en existe une ouverte, pluriel conforme ; couverture dans l'en-tête quand le fichier existe.
8. Sélecteur : « Index » désactivé sans livre ; défaut `{ edition_id: null, intention: 'recette' }` ; `libelleLivre` unique
   (fiche et `import.js`) ; `sessionView` avec `?intention=index` → pages présélectionnées + panneau ouvert, puis
   `historique.remplacer` sans le paramètre ; un `refresh()` ultérieur **ne** réapplique rien.
9. Signet : refus de `ftp:`, `javascript:`, `data:`, texte sans schéma, `href` 2 049 caractères ; acceptation `https://…` ;
   `enregistrerSignet` refuse ce que le modèle refuse (appel direct avec une adresse hostile → aucune écriture) ; écriture
   `reference_only` sans version ; vue recette : texte « Lien web gardé », pastille « Lien web », aucun bouton « Scanner » ;
   `source_url: 'javascript:…'` posé en base → **aucun `<a>`**, texte inerte ; hôte affiché = `new URL().host` même si
   `source_label` ment ; `search` trouve le signet par une cuisine.
10. Statique : `SHELL` complet ; `VERSION` incrémentée ; `--check` 0 ; **liste nominative** des modules neufs
    (`livre-ajout.js`, `signet.js`, `puces.js`, `image.js`, `blob-urls.js`, et les chaînes neuves d'`add.js`, `book.js`,
    `import.js`, `recipe.js`, `library.js`) dont **chaque** `t('…')` littéral a son entrée dans `en.js` (F13) ; aucun
    `html:`, `innerHTML`, `window.open` dans ces modules (S14) ; un rendu avec une chaîne hostile (`<img onerror>`) reste du
    texte ; U+2028/2029 = 0 ; `connect-src` d'`index.html` et de `tests/index.html` = la liste fermée de § 12.

## 14. Risques et décisions ouvertes

- **Open Library** : CORS mesuré ouvert depuis le site Pages ; à remesurer depuis `localhost` au plan. Les couvertures y sont
  **téléversées par des inconnus** : d'où les bornes **avant** décodage et le ré-encodage (I-G).
- **Google Books** : 429 sans clé le 13 octobre ; gardé seulement comme repli de **métadonnées** (déjà le cas), jamais pour
  la couverture.
- **`createImageBitmap` + `imageOrientation`** : repli sans l'option si rejetée (image possiblement tournée : la personne
  la voit et peut en reprendre une).
- **CSP non épinglable** : dos-d'âne assumé (`connect-src 'self' https:` reste large, l'URL de base de l'assistant
  IA est libre, R-UX-15) ; mur = `script-src 'self'` + `img-src` fermé.
- **Orphelins `files`** : assumés jusqu'à L4 ; coût borné (~400 Ko par essai abandonné).
- **`recipe-edit.js`** : changement limité au champ « Cuisines ».

## 15. Traçabilité des revues

Rév. 1 (13 octobre, soir) écrite depuis les notes de Neegan et la carte du code. Rév. 2 après deux revues adverses
indépendantes (opus) : sécurité (S1-S16) et faisabilité/cohérence (F1-F25). Mesure réelle Open Library / Google Books le
13 octobre.

### 15.1 Constats et réponses

| Constat | Réponse (§) |
|---|---|
| S1/F2 relation couverture → archive irrestaurable | pointeur souple, pas de relation (§ 6, § 12) ; dette `source_pages.sha256` nommée |
| S2 `db.mutate` contourne R61 | I-D : `repo.save`/`saveBatch` partout ; test § 13.3 |
| S3 métadonnées distantes sans borne | 300 car./champ, corps ≤ 256 Ko, `year` entier (§ 5) |
| S4 bombe de décompression | 5 Mo + 50 Mpx **avant** décodage par en-tête, délai 10 s (§ 6) |
| S5/F11 octets « tels quels », HEIC | ré-encodage JPEG systématique, refus nommé si indécodable (§ 6) |
| S6 `source_url` validé à la saisie seulement | revalidation **au rendu**, texte inerte sinon (§ 11) |
| S7 hôte affiché mensonger | hôte recalculé depuis `source_url` au rendu (§ 11) |
| S8/S11 course orphelins, fuite | aucun effacement de blob dans ce lot ; L4 (§ 2, § 6) |
| S9 `?edition` non vérifié | confronté à `editionsById`, inconnu = absent (§ 4) |
| S10 `connect-src https:` | **retirée** (R-UX-15) : URL de base libre de l'assistant IA, aucune liste fermée possible (§ 12) |
| S12 tiers non nommés, options `fetch` | phrase à l'écran ; `credentials/cache/referrerPolicy` explicites (§ 5) |
| S13 borne 2 048 non située | modèle **et** écriture (§ 11) |
| S14 test statique court | `html:` interdit, rendu hostile (§ 13.10) |
| S15/F4 URL `blob:` fuitées | `blob-urls.js`, révocation route + `draw()` (§ 6) |
| S16 activité écrite à l'arrivée `?nouveau` | `recordActivity` sauté (§ 8) |
| F1 espions impossibles | I-H gestes injectés (§ 3, § 13) |
| F3 `lookupIsbn` contradictoire | signature neuve `{ fetch, signal }`, deux `try` (§ 5) |
| F5 `booksTab` synchrone, `getFiles` absent | `renderLibrary` asynchrone, `repo.getFiles`, `booksTab(ctx, fichiers)` (§ 6) |
| F6 intention persistée réappliquée | intention dans l'adresse, consommée puis retirée (§ 10) |
| F7 recherche des signets | `cuisines` dans `titleTokens` des références (§ 11) |
| F8 écran de référence mensonger | texte et pastille propres au signet, sans « Scanner » (§ 11) |
| F9/F10 méta `role`, `putFile` idempotent | méta retirée ; idempotence dite (§ 6) |
| F12 « aucune erreur console » improuvable | assertion = aucun `logError`/carte rouge (§ 13.4) |
| F13 test `en.js` inimplémentable | liste nominative des modules neufs (§ 13.10) |
| F14 tape de trop avec `?edition` | boutons de fichiers directs (§ 4) |
| F15 couverture invisible sur la fiche | en-tête + bloc « Couverture » visible (§ 6) |
| F16 casse graine/valeurs | une normalisation ; stocké minuscules, affiché capitalisé (§ 7) |
| F17 `app.js`/`state.js` hors périmètre | routes et `ctx` nommés (§ 4, § 6) |
| F18 tri/libellé des livres | `ctx.library_activity`, `libelleLivre` unique (§ 10) |
| F19 `replaceState` sans re-rendu | retrait du DOM + geste `historique` (§ 8, § 10) |
| F20 liste MIME dupliquée | `COVER_INPUT_MIME` exporté de `mime.js` (§ 6) |
| F21 pluriel | `t('{n} page(s)')` (§ 9) |
| F22 `source_url` existant, hôte perdu avec livre | assumé ; livre **et** hôte affichés (§ 11) |
| F23 Langue / ISBN ambigus | Langue visible ; ISBN par « Changer d'ISBN » seulement (§ 5) |
| F24 `DB_VERSION`/`--check` | confirmé (§ 6, § 12) |
| F25 taille du lot | trois tranches livrables, couverture en dernier (§ 2) |

### 15.2 Ce que la construction a amendé

Une ligne par écart réel entre ce plan et le code livré, décidé par le contrôleur pendant les dix tâches
(registre complet : `.superpowers/sdd/2026-10-14-ajouter-et-livres-ux/progress.md`).

| Ruling | Décision |
|---|---|
| R-UX-1 | La forme d'une entrée d'outbox (nom du champ) n'était pas fixée au plan ; l'assertion de test est adaptée au champ réel. |
| R-UX-2 | `parseQuery('thaïe')` traite le mot comme du texte, pas comme un filtre ; la cuisine de test (T7) est restée inchangée. |
| R-UX-3 | Un module neuf entre dans `SHELL` dès la tâche qui le **crée**, avant tout import (le test de complétude ne vérifie que « atteignable ⊆ `SHELL` »). |
| R-UX-4 | Répartition des modèles d'implémentation (sonnet/opus) par tâche, décidée au pré-vol, sans incidence sur le code livré. |
| R-UX-5 | `APP_VERSION` passe à `'0.4.0'` dès la tâche 1 (pin structurel `v0.4.0-\d+`), et non en tâche 10 comme prévu au brief. |
| R-UX-6 | Le chemin « édition imposée » non testé (`dessinerImpose`) est supprimé ; `?edition` connu ouvre directement le sélecteur avec le livre fixé. |
| R-UX-7 | `parametresDeScan` extrait en fonction pure exportée, pour que l'écran et la séance de scan lisent exactement le même modèle. |
| R-UX-8 | Les puces (et tout groupe de boutons) ne vont jamais dans un `<label>` — `div.field > span + contenu` —, porté aux tâches 5 et 6 et au champ « Cuisines / régions » de `recipe-edit.js`. |
| R-UX-9 | `majBoutonEnregistrer` + `data-role="enregistrer"` évitent un redessin à chaque frappe ; `enCours` dans le modèle garde contre le double clic. |
| R-UX-10 | `?nouveau` sans valeur laisse le MODÈLE décider d'afficher l'accueil, pour ne jamais journaliser une visite sautée. |
| R-UX-11 | `lienSignet` déplacé dans `src/core/lien.js` (sous `components.js` et `signet.js`, sans cycle) ; l'hôte affiché est recalculé depuis `source_url`, jamais lu dans `source_label` stocké. |
| R-UX-12 | Le corps d'une réponse de couverture est lu **en flux**, annulé dès 5 Mo cumulés (Open Library n'annonce pas `content-length`). |
| R-UX-13 | La couverture reçue est remise à vide par `identifier` et `retourIsbn` ; une réponse distante tardive n'appartient qu'à SA demande d'ISBN (`isbnDemande`, `touchee`). |
| R-UX-14 | `alt = book.title` sur l'image de couverture, pour qu'un lien vers l'image porte toujours un nom accessible. |
| R-UX-15 | **S10 retirée** : `connect-src` reste `'self' https:` sur les deux pages (l'assistant IA, `src/domain/llm.js`, accepte une URL de base libre — aucune liste fermée ne peut la couvrir sans casser cette fonctionnalité antérieure au lot). Le test statique affirme à la place `connect-src`/`img-src`/`script-src`/`object-src` exacts sur les deux pages. |

Compte final (tâche 10, clôture, après la revue de tâche ronde 1) : **1264/1264** tests verts, suite complète, 0
erreur et 0 avertissement console.
