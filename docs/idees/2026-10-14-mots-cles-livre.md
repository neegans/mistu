# Mots-clés d'un livre — brief pour le lot « Identifier un livre, fiable » (`isbn-fiable`)

Demande de Neegan, 14 octobre 2026 (soir), après son premier vrai essai d'« Ajouter un livre » avec l'ISBN
`9781785035289` (« Berber and Q », Josh Katz) : *« on devrait avoir plus de mots-clés pour aider à faire des recherches
plus tard… genre bbq, charbon, arabe »*. Décision : **à ajouter au lot `isbn-fiable`** (même écran), pas un lot à part.

## Ce qui existe déjà (à ne pas réinventer)

- `books.tags` : tableau de chaînes présent dans le modèle depuis le début (`src/ui/livre-ajout.js fabriquerLivre` écrit
  `tags: []`), **jamais rempli** — aucun écran ne l'édite. Vit dans `data` côté serveur : aucune migration.
- Le filtre de « Mes livres » (`src/ui/library.js`, `hay`) lit déjà `book.tags`.
- Le composant **puces** (`src/ui/puces.js` : `pucesModel`, `renderPuces`, `basculerPuce`, `ajouterPuce`, normalisation
  unique, plafonds 60 caractères / 50 puces, jamais dans un `<label>` — ruling R-UX-8) sert déjà aux cuisines sur quatre
  écrans : le même geste convient aux mots-clés.
- La recherche (`src/domain/search.js`) construit `tokens`/`titleTokens` par recette ; **les mots-clés du livre n'y
  entrent pas** aujourd'hui.

## Mesuré le 14 octobre sur `9781785035289` (ce qu'Open Library sait vraiment)

- `GET https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data` → `title`, `authors`, `publishers`
  (« Penguin Random House »), `publish_date` (2018), `number_of_pages` (288), **`subjects: [« Barbecuing »]`** ; **pas de
  `languages`** dans cette forme.
- `…&jscmd=details` → **`languages: [{ key: '/languages/eng' }]`** (la langue existe, l'app ne la lit pas : c'est le trou
  « mon livre est en anglais »).
- `GET https://openlibrary.org/search.json?isbn=<isbn>&fields=key,title,author_name,first_publish_year,language,cover_i,subject,publisher&limit=1`
  → `language: ['eng']`, `subject: ['Barbecuing']`, `publisher: ['Ebury Publishing', 'Penguin Random House']`, **pas de
  `cover_i`** : aucune couverture chez Open Library pour ce livre (édition, œuvre `OL21142351W` et recherche confondues).
- Google Books : **429 « Quota exceeded … Queries per day »** sans clé d'API — une clé (projet `cuisine-os-neegan`, API
  Books, gratuite) entrée dans Réglages rendrait la langue, la vignette et des `categories`.

## Design proposé

1. **Champ « Mots-clés »** en puces, au pas 2 d'« Ajouter un livre » et dans la fiche livre (bloc « Métadonnées et
   convention », à côté de « Cuisines ») : libre, Entrée ou « Ajouter », stocké dans `books.tags` (minuscules, sans
   espaces de bord, comme les cuisines ; mêmes plafonds).
2. **Suggestions** sous le champ, cliquables, jamais posées sans la tape de la personne (rien d'inventé) :
   - les `subjects` d'Open Library pour ce livre (forme `data`, puis `search.json` en repli), étiquetés « Proposé par
     Open Library », tronqués à 60 caractères, 10 au plus ;
   - les `categories` de Google Books si une clé est configurée ;
   - les mots-clés déjà donnés à d'autres livres (fréquence décroissante), comme les cuisines existantes.
3. **Recherche** : les `tags` du livre comptent pour **toutes ses recettes** — dans `buildDocs`, ajouter les mots-clés du
   livre (via `edition → book`) aux `tokens` de chaque recette de ce livre (et aux `titleTokens` des références d'index,
   comme les cuisines depuis F7) ; une recette de « Berber and Q » remonte sur « bbq » même si son titre ne le dit pas.
   « Mes livres » filtre déjà dessus.
4. **Langue** (même lot) : lire `languages` par `jscmd=details` (ou `search.json`), proposer `en`/`fr` quand connu et que
   la personne n'a pas touché le menu — règle déjà en place pour Google Books (`fusionnerFiche`, `langueTouchee`).
5. Invariants du lot UX à garder : provenance étiquetée (I-A), états réels (I-B), puces hors `<label>` (R-UX-8), mêmes
   bornes réseau que `lookupIsbn` (300 caractères par champ, corps lu en flux et coupé à 256 Ko, options S12, délai 10 s).

## Tests attendus (rouge d'abord)

- Modèle pur des suggestions : union Open Library → Google → existants, dédoublonnée par normalisation, 10 au plus,
  étiquetées par source ; une suggestion cliquée devient une puce choisie ; rien n'est écrit sans geste.
- `fabriquerLivre` écrit `tags` ; la fiche livre les réécrit sans toucher les autres champs (relecture avant écriture, C4).
- Recherche : une recette sans « bbq » dans son titre, dans un livre tagué `bbq`, remonte sur « bbq » ; un signet rattaché
  à un livre tagué aussi.
- Langue : `details` → `eng` → menu « English » ; menu touché par la personne → inchangé.
- Branche à rebaser sur `main` **`dccafe4`** (suite 1378/1378, total épinglé dans `tests/tests.js`) avant tout.
