# Page « Ajouter » et flux des livres — design (rév. 1, 13 octobre 2026)

Source : notes de Neegan `docs/idees/2026-10-13-ux-page-ajouter.md`. Décisions prises en chat le 13 octobre (soir) :
**tout en un lot** (navigation, dévoilement progressif, puces « Cuisines », couverture) ; le « lien web » est un **signet
simple** (adresse + titre), pas une lecture de la page. Lot livré sur la branche `ajouter-livres-ux`, arbre `~/projects/mistu`.

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

## 2. Périmètre

**Dans le lot.** § 4 grille · § 5 flux « Ajouter un livre » en deux pas · § 6 couverture (par ISBN ou par photo/image) ·
§ 7 puces « Cuisines » (formulaire du livre **et** éditeur de recette) · § 8 accueil du livre après création · § 9 fiche
livre : deux gestes nommés et association automatique · § 10 sélecteur « pour quel livre / quel genre de pages » avant un
scan parti de la page générale · § 11 signet web.

**Hors du lot (nommé pour ne pas y glisser).** Lecture d'une page web pour en tirer une recette (réseau + extraction + IA :
lot à part) · réduction des **pages scannées** (D2 du 12 octobre : la réduction écrite ici ne sert qu'aux couvertures) ·
transport des **octets** des fichiers entre appareils (lot L4 : une couverture ne voyage pas encore) · OCR · refonte de
l'éditeur de recette au-delà du champ « Cuisines ».

## 3. Invariants (hérités, et un nouveau)

- **I-A Rien d'inventé.** Une fiche renseignée par Open Library ou Google Books est **étiquetée** comme telle, modifiable,
  jamais présentée comme saisie par la personne ; une couverture est **reçue** ou **photographiée**, jamais un visuel de
  remplacement qui ressemble à une couverture. Sans couverture, la vignette texte actuelle reste.
- **I-B États = événements réels.** « Livre ajouté » après l'écriture ; « Couverture enregistrée » après `putFile` ;
  « Aucune fiche trouvée » après la réponse (ou l'échec) du réseau, jamais avant.
- **I-C Écran du côté de la personne.** Première ligne de chaque écran = ce qu'elle peut faire ; aucune contrainte interne
  affichée (pas de « edition_id », pas de « sha256 ») ; le facultatif est replié.
- **I-D Porte unique.** Toute écriture passe par `db.mutate` (capture de synchronisation intacte) ; chaînes par `t()` avec
  entrée dans `src/i18n/en.js` ; `SHELL` et `VERSION` suivis ; aucun `innerHTML`, aucun `window.open`.
- **I-E L'original n'est jamais réécrit.** Un signet est une recette-référence ; il ne crée aucune version.
- **I-F (nouveau) Une photo prise depuis un livre appartient à ce livre.** Un scan lancé depuis une fiche livre ou depuis
  l'accueil d'un livre porte l'édition **sans la redemander** ; seul un scan parti de la page générale pose la question.

## 4. Page « Ajouter » — la grille

`renderAdd()` ne rend plus que `pageHeader` + une grille `.grid.wide` de **cinq cartes**, dans cet ordre :

| Carte | Sous-titre | Geste |
|---|---|---|
| 📚 **Ajouter un livre** | ISBN (scan ou saisie), ou titre à la main | `navigate('/add/livre')` |
| 📷 **Photographier ou importer des pages** | Caméra, photos ou PDF — pour une recette ou un index | ouvre le sélecteur § 10 (dans la page, à la place de la grille) |
| ✍️ **Saisir une recette** | À la main | `navigate('/recipes/new' + ?edition)` (inchangé) |
| 🔗 **Garder un lien web** | Une recette ou une page à retrouver | `navigate('/add/signet')` |
| 🧊 **Ajouter un lot au congélateur** | inchangé | `navigate('/kitchen?tab=inventory&add=1')` |

- Le formulaire « Ajouter un livre » **disparaît** de `#/add`. Les deux tuiles actuelles « Photographier des pages » et
  « Choisir des photos ou un PDF » **fusionnent** dans la deuxième carte : les deux manières de fournir les fichiers vivent
  dans le sélecteur § 10.
- `#/add?edition=<id>` (arrivée depuis une fiche livre) continue de pré-associer l'édition : la deuxième carte ouvre alors le
  sélecteur **avec le livre déjà choisi et non modifiable** (I-F), et « Saisir une recette » garde `?edition`.
- La `tile()` locale devient un composant `carte(ico, titre, sousTitre, onClick)` de `src/ui/components.js` (même rendu,
  réutilisable par § 8).

## 5. « Ajouter un livre » en deux pas — route `#/add/livre`

Nouveau module `src/ui/livre-ajout.js` ; le code du formulaire actuel (`bookForm`, `lookupIsbn`, `scan`) y déménage ;
`lookupIsbn` reste exporté sous le même nom (il est importé ailleurs ? — à vérifier au plan ; sinon simple déplacement).

**Pas 1 — Identifier.** Un seul champ ISBN, deux boutons `primary` côte à côte : **« Scanner le code-barres »** (lecteur
`BarcodeDetector`, comme aujourd'hui ; absent → bouton désactivé avec la phrase « Le lecteur de code-barres n'est pas offert
dans ce navigateur. ») et **« Identifier »** ; dessous, un lien `.btn.link` **« Saisir à la main »**.
- « Identifier » → `lookupIsbn(isbn)` (Open Library puis Google Books, inchangé) → pas 2 avec les champs remplis et une
  ligne de provenance : « Renseigné par Open Library — vérifie et corrige. » (ou « … par Google Books »). Échec ou vide →
  pas 2 avec les champs vides et « Aucune fiche trouvée pour cet ISBN. Complète à la main. » (I-B).
- « Saisir à la main » → pas 2, champs vides, ISBN conservé s'il a été tapé.
- Pendant l'appel : bouton désactivé, « Recherche… » ; **délai borné à 10 s** (`AbortController`), au-delà traité comme un
  échec. L'appel réseau n'a lieu que sur le geste.

**Pas 2 — Compléter.** Champs existants : Titre*, Auteur / chef, Éditeur, Année, Langue, Convention de mesure (replié dans
« Plus de détails » : Éditeur, Année, Convention — I-C) ; **« Cuisines »** en puces (§ 7) ; **« Couverture »** (§ 6). Un lien
« ← Changer d'ISBN » revient au pas 1 sans perdre la saisie. Bouton **« Ajouter ce livre »** (`primary`, désactivé sans
titre).
- Enregistrement : comme aujourd'hui (`books` + `book_editions`, `cuisines` tableau), **plus** `cover_sha256` sur l'édition
  si une couverture a été posée, en **une** transaction `db.mutate` (la ligne `files` de la couverture est écrite **avant**,
  par `putFile`, au moment où l'image est choisie — voir § 6). Puis `toast(t('Livre ajouté'))` et
  `navigate('/books/<edition.id>?nouveau=1')` (§ 8).
- Modèle pur exporté : `livreAjoutModel(etat)` → `{ pas, champs, provenance, couverture, peutEnregistrer, messages }` ;
  rendu `renderLivreAjout(model, gestes)` — même motif que `porte-entree.js`, testable sans réseau ni base.

## 6. Couverture

**Modèle.** `book_editions.cover_sha256` (texte, facultatif) → ligne de `files` (`sha256`, `blob`, `mime`, `size`,
`syncable: true`, `created_at`, `updated_at`, méta `{ role: 'cover' }`). Relation déclarée dans `RELATIONS`
(`book_editions.cover_sha256 → files`, facultative) pour que l'archive et `verifyRestored` la connaissent. **Pas de nouvel
index → `DB_VERSION` inchangée ; le champ vit dans `data` côté serveur → aucune migration, `tools/generer-migrations.mjs
--check` doit rester à 0.**

**Trois sources, une seule règle (I-A).**
1. **Reçue par ISBN** : après une identification réussie, l'app tente `https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false`
   (404 quand il n'y en a pas : aucune image de remplacement), puis, en repli, `imageLinks.thumbnail` de Google Books (`http`
   → `https`). `fetch` → `Blob` ; type dans `image/jpeg|png|webp` sinon rejet. La CSP actuelle (`img-src 'self' blob: data:`)
   **interdit** d'afficher l'image externe directement : on l'affiche par `displayUrl()` depuis le blob, comme toute photo.
   **Risque nommé** : l'en-tête CORS de ces hôtes n'a pas été mesuré ; le plan commence par cette mesure (une requête
   réelle depuis le site Pages et depuis `localhost`). Si le `fetch` échoue (CORS, réseau, 404) → « Aucune couverture
   reçue. Tu peux la photographier. » — jamais une erreur rouge.
2. **Photographiée** : `pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' })`.
3. **Choisie** : `pickFiles({ accept: 'image/*', multiple: false })`.

**Réduction.** Nouveau `src/core/image.js` : `reduireImage(blob, { maxCote = 1200, qualite = 0.85 })` → `Blob` JPEG via
`createImageBitmap` + `canvas` (orientation EXIF respectée par `createImageBitmap({ imageOrientation: 'from-image' })`) ;
rend le blob **tel quel** s'il fait déjà ≤ 1200 px de grand côté **et** ≤ 400 Ko. Une couverture reçue par ISBN passe
par la même fonction. Réservée aux couvertures dans ce lot (D2 pour les pages scannées = autre lot).

**Écriture.** `sha256(blob réduit)` → `repo.putFile(sha256, blob, { mime, role: 'cover' })` au moment du choix ; l'écran
montre l'aperçu et **« Retirer »**. Si la personne quitte sans enregistrer le livre, la ligne `files` orpheline est retirée
(garde dans le modèle : `couverture.enAttente` ; `repo.retirerFichierSiOrphelin(sha256)` vérifie qu'aucune `source_pages`
ni `book_editions` ne la référence avant de l'effacer). Même garde à la suppression d'une édition.

**Affichage.** `bookCover(edition, book, { fichier })` : si `fichier?.blob` existe → `<img class="cover-img" alt="">` par
`displayUrl` (URL révoquée au prochain rendu) ; sinon la vignette texte actuelle. `library.js` et `book.js` lisent la ligne
`files` en lot (`repo.getFiles(sha256s)` — une transaction) avant de rendre. **Sur un autre appareil** (avant L4), l'édition
porte `cover_sha256` mais la ligne `files` n'y est pas : vignette texte, sans message (I-B : rien à annoncer).

**Modification.** Dans la fiche livre (bas de page, bloc « Enregistrer » existant) : « Couverture » avec les trois sources et
« Retirer » ; l'édition est réécrite par `db.mutate` (origine `local`, donc elle repart au serveur avec son `cover_sha256`).

## 7. Puces « Cuisines »

Composant `src/ui/puces.js` : `pucesModel({ valeurs, choisies, suggestions })` → liste ordonnée `{ libelle, choisie }` ;
`renderPuces(model, { basculer, ajouter })` → boutons `.puce[aria-pressed]` + champ replié « Autre… » (Entrée ou bouton
« Ajouter » → `ajouter(texte)` ; vide ou doublon insensible à la casse/aux accents → ignoré).
- **Suggestions** = union, dans cet ordre : les cuisines **déjà choisies** (toujours visibles), celles **déjà présentes** dans
  `books.cuisines` et `recipes.cuisines` de la base (par fréquence décroissante), puis une **graine** fermée :
  `Québécoise, Autochtone, Française, Italienne, Levantine, Marocaine, Mexicaine, Indienne, Chinoise, Japonaise, Thaïe,
  Vietnamienne, Grecque, Espagnole, Américaine`. La graine est une liste de `t()` (traduite), les valeurs **stockées** restent
  les chaînes françaises telles qu'affichées.
- **Stockage inchangé** : `cuisines` reste un tableau de chaînes ; les valeurs existantes s'affichent comme puces choisies,
  rien n'est renommé ni fusionné (une variante orthographique ancienne reste ce qu'elle est).
- Utilisé dans le pas 2 du livre (§ 5), dans la fiche livre (bloc « Enregistrer ») et dans `recipe-edit.js` à la place du
  champ texte « Cuisines » (même fonction, même base : la personne ne rencontre qu'un seul geste).

## 8. Accueil du livre après création — `#/books/:id?nouveau=1`

Pas de modale (fragile en PWA iOS, et la fiche **est** la destination). `renderBook` lit `query.nouveau` : si présent, un
panneau `.card.accueil-livre` s'affiche **au-dessus** du contenu habituel :

> **Le livre est dans ta bibliothèque. Et maintenant ?**
> 📸 **Photographier l'index ou la table des matières** — pour que l'app connaisse les recettes du livre.
> 📄 **Photographier ou importer des pages de recettes** — seulement celles qui t'intéressent, tout de suite.
> **Plus tard** — aller à Mes livres.

- Les deux premières cartes lancent le scan **avec l'édition et le genre de pages** (`startScanSession(files, { edition_id,
  intention: 'index' | 'recette' })`, § 10) via deux boutons « Photographier » / « Choisir des photos ou un PDF » dévoilés au
  toucher de la carte ; « Plus tard » → `navigate('/library')`.
- Le panneau n'est **pas persistant** : il tient au paramètre d'adresse ; un rechargement sans `?nouveau=1` montre la fiche
  normale. Il se referme aussi par « × » (retire le paramètre, `history.replaceState`).
- Modèle pur `accueilLivreModel({ nouveau })` → `{ afficher, cartes }`.

## 9. Fiche livre — deux gestes nommés, association automatique

En-tête de `renderBook` : les actions deviennent **« + Pages d'index »** et **« + Recette »** (chacune ouvre le même mini
sélecteur de source « Photographier / Choisir des photos ou un PDF / Saisir à la main » pour « + Recette » ; « Photographier /
Choisir » pour « + Pages d'index »). Tout scan parti d'ici porte `edition_id` **et** `intention` (I-F) : aucune question sur le
livre. Le bloc « Ajouter des entrées d'index à la main » (`indexEntriesPanel`) et les gestes par recette référencée
(« Scanner cette recette », « Saisir à la main ») sont **inchangés**.

Séance déjà ouverte pour cette édition : une ligne « Séance en cours : N pages — Reprendre » (données réelles de
`scan_sessions` à `status` ouvert) au-dessus des gestes, pour ne pas en ouvrir une seconde par mégarde.

## 10. Sélecteur avant un scan parti de la page générale

Ouvert par la deuxième carte de § 4, **dans la page** (la grille est remplacée ; « ← Retour » la rétablit) :

> **Ces pages vont où ?**
> Livre : `select` « Recette indépendante (sans livre) » *(défaut)* + mes livres (titre · auteur · année), triés par activité
> récente (`repo.recordActivity` existe) puis titre.
> Genre de pages : ◉ **Page(s) de recette** *(défaut)* ○ **Index ou table des matières** *(désactivé tant qu'aucun livre
> n'est choisi : un index sans livre n'a pas de sens — phrase affichée sous l'option)*.
> [ 📷 Photographier ] [ 🖼 Choisir des photos ou un PDF ]

- Les deux boutons appellent `startScanSession(files, { edition_id, intention })` avec les `accept` actuels (`image/*` +
  `capture: 'environment'` ; `image/*,application/pdf,application/epub+zip`).
- `scan_sessions.intention` (`'index' | 'recette' | null`, nouveau champ, `data` côté serveur : aucune migration) est écrit
  par `startScanSession` ; `sessionView` s'en sert **une fois**, à l'arrivée : `index` → toutes les pages de la séance
  présélectionnées et `indexPanel` ouvert ; `recette` → pages présélectionnées et « Regrouper en recette » rendu `primary`.
  Le `select` « Livre de cette séance » et le reste de la séance sont inchangés (on peut toujours changer d'avis).
- Modèle pur `selecteurScanModel({ livres, editionImposee, livreChoisi, genre })` → `{ options, genreDisponible, boutons }`.

## 11. Signet web — route `#/add/signet`

Nouveau module `src/ui/signet.js`. Écran :

> **Garder un lien web** — une recette ou une page que tu veux retrouver dans ta bibliothèque.
> Adresse* · Titre* · Livre (facultatif : « Aucun — recette indépendante » / mes livres) · Cuisines (puces) · bouton
> **« Garder le lien »**.

- **Aucun réseau** : le titre est tapé par la personne (une phrase le dit : « L'app n'ouvre pas la page : donne-lui le
  titre. »). L'adresse DOIT se lire par `new URL()` avec `protocol` `http:` ou `https:` ; sinon « Adresse non reconnue. »
  et le bouton reste désactivé. L'adresse est stockée **telle que lue** (`url.href`), bornée à 2 048 caractères.
- Écriture (I-E) : une `recipes` avec `availability: 'reference_only'`, `current_version_id: null`, `ingredient_ids: []`,
  `source_page_ids: []`, `original_title` = titre, `original_language` = langue de l'interface, `type: null`, `tags: []`,
  `cuisines`, `edition_id` (ou `null`), **`source_url`** (nouveau champ, `data` côté serveur : aucune migration),
  `source_label` = hôte de l'adresse (ex. `ricardocuisine.com`), `verification_state` identique aux références d'index.
  Puis `toast(t('Lien gardé'))` et `navigate('/recipes/<id>')`.
- Vue recette (`recipe.js`) : quand `source_url` est présent, un bouton **« Ouvrir le lien »** = `<a href class="btn"
  target="_blank" rel="noopener noreferrer">` (pas de `window.open`) et l'hôte affiché en sous-titre ; la vue continue de
  dire qu'il n'y a aucune version. La recherche la trouve comme toute référence (titre, cuisines) — rien à changer.
- Modèle pur `signetModel({ adresse, titre, editionId, cuisines })` → `{ valide, erreurs, hote }`.

## 12. Données, synchronisation, archive — ce qui change et ce qui ne change pas

| Élément | Changement | Serveur | Archive |
|---|---|---|---|
| `book_editions.cover_sha256` | nouveau champ facultatif | dans `data` → aucune migration | relation déclarée → vérifiée |
| `files` (rôle `cover`) | nouvelles lignes, `syncable: true` | ligne **non** mise en file (R58), octets = L4 | déjà incluse |
| `scan_sessions.intention` | nouveau champ facultatif | `data` → aucune migration | magasin déjà archivé |
| `recipes.source_url` | nouveau champ facultatif | `data` → aucune migration | déjà archivé |
| `DB_VERSION` | **inchangée** (aucun index nouveau) | — | — |
| `tools/generer-migrations.mjs --check` | DOIT rester 0 | — | — |

Tout passe par `db.mutate` origine `local` (sauf les relectures) : les livres, éditions, recettes et séances continuent de
partir au serveur comme aujourd'hui. Une couverture **ne voyage pas** avant L4 : c'est dit en § 6 et dans `CLAUDE.md`.

## 13. Ce que la suite de tests doit prouver (rouge d'abord)

Tout en modèles purs + rendus DOM (motif `porte-entree`), bases jetables (`withRepo`), **aucun réseau** (`lookupIsbn` et le
`fetch` de couverture reçoivent un `fetch` injecté), **aucun geste destructeur** dans le navigateur partagé.

1. Grille : cinq cartes dans l'ordre, libellés `t()`, aucun formulaire rendu ; `?edition` → sélecteur avec livre imposé.
2. `livreAjoutModel` : pas 1 → pas 2 par « Identifier » (réponse fausse injectée : provenance « Open Library »), par échec
   (message I-B, champs vides), par « Saisir à la main » ; « Changer d'ISBN » conserve la saisie ; `peutEnregistrer` faux
   sans titre ; délai 10 s → échec (horloge injectée).
3. Enregistrement : une seule transaction, `books` + `book_editions` (+ `cover_sha256`), espion `db.mutate` ; navigation
   `?nouveau=1` (espion `navigate`).
4. Couverture : `reduireImage` sur un PNG 2 000 px généré au canvas → JPEG ≤ 1 200 px ; petit blob rendu tel quel ;
   `fetch` injecté 404 → « Aucune couverture reçue » ; CORS simulé (rejet) → même phrase, aucune erreur console ;
   `retirerFichierSiOrphelin` n'efface pas un sha256 référencé par une `source_pages` ; `bookCover` avec blob → `<img>`,
   sans → vignette texte ; fiche livre « Retirer » → `cover_sha256` à `null`, fichier retiré si orphelin.
5. Puces : ordre (choisies, fréquence, graine), doublon insensible aux accents ignoré, « Autre… » ajoute et choisit,
   `cuisines` stocké en tableau ; `recipe-edit` écrit le même tableau.
6. Accueil : `accueilLivreModel({ nouveau: '1' }).afficher` vrai, trois cartes ; sans paramètre → rien ; « × » retire le
   paramètre.
7. Fiche livre : deux actions nommées ; un scan parti d'ici porte `edition_id` et `intention` (espion `startScanSession`) ;
   « Séance en cours » affichée seulement s'il en existe une ouverte pour cette édition.
8. Sélecteur : « Index » désactivé sans livre ; `startScanSession` appelé avec `{ edition_id: null, intention: 'recette' }`
   par défaut ; livre imposé non modifiable ; `sessionView` : `intention: 'index'` → pages présélectionnées + panneau
   ouvert ; `'recette'` → bouton primaire.
9. Signet : `signetModel` refuse `ftp://`, `javascript:`, texte sans schéma ; accepte `https://…` ; hôte extrait ; écriture
   `reference_only` sans version (`recipe_versions` compte inchangé) ; vue recette → `<a rel="noopener noreferrer">`.
10. Statique : `SHELL` complet (nouveaux modules), `VERSION` incrémentée, `--check` 0, aucune chaîne `t()` neuve sans
    entrée dans `en.js`, aucun `innerHTML`/`window.open`, U+2028/2029 = 0.

## 14. Risques et décisions ouvertes (à trancher au plan, pas à cacher)

- **CORS des couvertures** (§ 6) : mesure réelle en première tâche ; si Open Library refuse, la couverture par ISBN tombe à
  « Aucune couverture reçue » et le lot garde photo/image — rien d'autre ne dépend de cette source.
- **`createImageBitmap` + `imageOrientation`** : disponible sur Safari iOS récent ; repli sans orientation si l'option est
  rejetée (image possiblement tournée : la personne la voit et peut en reprendre une).
- **Taille des fichiers** : une couverture ≤ 400 Ko environ ; l'archive ZIP grossit d'autant par livre — acceptable.
- **`lookupIsbn`** garde deux hôtes externes déjà présents aujourd'hui ; aucun nouvel hôte n'entre dans `connect-src`
  (`https:` l'autorise déjà).
- **`recipe-edit.js`** est le fichier le plus dense de l'app : le changement se limite au remplacement du champ texte
  « Cuisines » par les puces (une ligne de rendu, une ligne de lecture).

## 15. Traçabilité des revues

Rév. 1 écrite le 13 octobre 2026 (soir) depuis les notes de Neegan et la carte du code (`add.js`, `book.js`, `import.js`,
`library.js`, `components.js`, `recipe-edit.js`, `schema.js`, `repo.js`, `mime.js`, `router.js`, CSP d'`index.html`).
Revues adverses à venir : faisabilité/cohérence et sécurité ; leurs constats et réponses iront en § 15.1.
