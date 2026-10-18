# Audit du système d'importation — livres, photos, liens web, images

Dépôt `neegans/mistu`, `main` = `57babc6` (18 octobre 2026). Lecture seule, quatre explorations du code (modèle et synchro ;
parcours livre et table des matières ; import de pages et extraction ; liens web et images), relues par le contrôleur contre
`CLAUDE.md`, `STATE.md` et `supabase/proofs/RESULTATS-mitsu.md`. Objectif de Neegan : « constituer progressivement une base de
données de recettes à partir de mes livres, de mes photos et des liens web que je sauvegarde », avec le moins de saisie possible
et toujours la possibilité de vérifier et corriger.

Légende des colonnes « Preuve » : **code** = observé dans le code ; **suite** = épinglé par la suite de tests (navigateur ou Node,
fixtures, aucun réseau) ; **réel** = mesuré en vrai (site public ou script contre un vrai service) ; **rien** = ni test ni mesure.

## 0. Lecture rapide

- **Le squelette existe et il est bon** : séance de photos (`scan_sessions`, `source_documents`, `source_pages`, octets dans
  `files` par SHA-256), références d'index `availability: reference_only` avec leurs libellés « Repérée dans ton livre », extraction
  d'une recette photographiée par le modèle de vision (`claude-sonnet-5-5`, forcé par la passerelle), éditeur de relecture où toute
  ligne est « à vérifier », versions jamais réécrites (`recipe_versions`, `provenance`), signets web, exports.
- **Ce qui manque pour ton objectif** : la couverture n'est pas lue (image seulement, jamais de vision) ; une table des matières sur
  plusieurs photos part en un seul appel sans ordre ni fusion, et se corrige dans une zone de texte ; un lot de recettes
  photographiées exige que tu regroupes les pages à la main, une recette par appel, sans appariement à l'index ; un lien web n'est
  qu'un lien, aucun chemin ne lit une page (la passerelle n'admet que l'outil de recherche) ; aucune image de plat n'existe dans le
  modèle ; aucun brouillon ni journal d'import, donc une extraction réussie se perd si tu quittes l'écran ; les photos et
  couvertures ne voyagent jamais entre appareils (seau Supabase créé, jamais utilisé).
- **Ce qui est prouvé en vrai** : l'identification par ISBN chez Open Library (script, 15 octobre), la recherche web (appel réel
  17 octobre, puis par la passerelle le 18) et la passerelle elle-même (sondes et première recherche réelle). **Aucun appel réel
  d'extraction de pages, aucune lecture d'index, aucune couverture photographiée, aucun signet gardé** ne sont consignés : ces
  parcours ne sont éprouvés que par la suite, sur fixtures.
- **Coordination** : pas d'« agent cerveau ». Un enchaînement déterministe avec trois appels typés au modèle (classer un lot de
  photos, lire une couverture, extraire une recette ou une table des matières structurée), la lecture web d'abord par le JSON-LD
  `schema.org/Recipe` de la page (sans modèle) puis le modèle en repli, et une confirmation humaine à chaque jonction. Détail § 7.

## 1. Audit concret

### 1.1 Ajouter un livre à partir de sa couverture

| Demandé | État | Où (code, tables) | Preuve | Travail nécessaire |
|---|---|---|---|---|
| Analyser la couverture avec un modèle de vision | **Absent** | Seules lectures d'images par modèle : `extractRecipeFromImages` et `extractIndexFromImages` (`src/domain/llm.js:67-85`), appelées par `recipe-edit.js:152` et `import.js:232`. Rien pour la couverture ; la spec UX du 13 oct classe l'OCR « hors du lot » | code | Nouvel appel `extraction` avec un prompt « couverture » → `{title, author, publisher, uncertain}` ; préremplir le pas 2 avec l'étiquette « Lu sur la couverture — vérifie » |
| Extraire titre et auteur | **Partiel** (par ISBN seulement) | ISBN tapé ou code-barres (`BarcodeDetector`, photo, `livre-ajout.js:503-517`) → Open Library `search.json` (`livre-ajout.js:67,108-114`), repli `api/books`, Google Books jamais (clé vide, `config.js:17`) | **réel** (script 15 oct : « Berber and Q », « À la di Stasio ») ; code-barres : code seulement | Après la lecture de la couverture, chercher l'ISBN par titre + auteur chez Open Library pour rattraper les métadonnées |
| Créer automatiquement la fiche | **Partiel** | Pas 2 prérempli puis « Ajouter ce livre » (`livre-ajout.js:543-559`) : `books` + `book_editions` | suite (`tests/ajouter.js:411-546, 1448`) | Rien à changer dans la mécanique ; brancher la lecture de couverture dessus |
| Enregistrer la couverture et l'associer | **Fonctionnel** | `poserCouverture` : 25 Mo max, 16 Mpx, JPEG 1200 px, SHA-256 → `files`, pointeur `book_editions.cover_sha256` (`livre-ajout.js:215-231, 288`) | suite (`tests/ajouter.js:1065-1139`) ; aucune photo réelle | Les octets restent sur l'appareil (voir § 1.6) |
| Corriger les renseignements | **Fonctionnel** | Pas 2 : titre obligatoire, auteur, langue, cuisines, mots-clés, « Plus de détails » ; fiche livre « Enregistrer » (`book.js:213`) | suite | — |
| Ne rien inventer | **Fonctionnel** | « Aucune fiche chez Open Library pour cet ISBN. Complète à la main. » (`livre-ajout.js:261-263`) | suite | Garder la même règle pour la lecture de couverture (`null` + « incertain ») |

### 1.2 Importer une table des matières sur plusieurs pages

| Demandé | État | Où | Preuve | Travail nécessaire |
|---|---|---|---|---|
| Proposer la table des matières après la couverture | **Fonctionnel** | « Et maintenant ? » (`accueil-livre.js:12`) : « Photographier l'index ou la table des matières » | suite (`tests/ajouter.js:621-650`) | — |
| Importer toutes les photos ensemble | **Fonctionnel** | `pickFiles` `multiple: true` ; `startScanSession` (`import.js:31-57`) ; « + Photographier » ajoute à la séance | code ; `startScanSession` **hors test** | Un `try/catch` : un échec en cours de boucle laisse des blobs sans lignes |
| Les associer au bon livre | **Fonctionnel** | `edition_id` de la séance ; un index exige un livre (`add.js:40`) ; « Livre de cette séance » corrige après coup (`import.js:103-110`) | suite (sélecteur) | — |
| Reconstituer l'ordre à partir des indices | **Absent** | `position` = rang d'ajout (`import.js:36,47`) ; l'ordre envoyé au modèle est l'ordre de cochage (`import.js:161`) ; aucune lecture des numéros imprimés de la photo d'index | code | Le modèle rend, par photo, la plage de pages lue ; l'app propose un ordre et le montre |
| Corriger l'ordre | **Absent** | Aucun geste monter/descendre/glisser ; `file_position` et `locator` toujours `null` | code | Réordonnancement dans la séance, écrit dans `source_pages.position` |
| Extraire sections, titres, numéros de page | **Partiel** | `INDEX_SYSTEM` (`llm.js:75-77`) demande `{entries:[{title, printed_page, section, ingredients_mentioned}]}` ; **un seul appel** avec toutes les photos ; `section` et `ingredients_mentioned` **perdus** à la jonction texte `Titre — page` (`import.js:233`) ; `max_tokens` 4000 ; `stop_reason` ignoré | suite : seulement une réponse `entries: []` (`tests/passerelle.js:410`) ; aucun test d'entrées réelles ; **aucun appel réel** | Sortie structurée par photo, conservée telle quelle (plus de passage par le texte), `max_tokens` relevé, troncature détectée |
| Réunir en une table structurée, corrigeable | **Partiel** | Zone de texte « Titre — 132 », `parseIndexLines` (`import.js:267-279`), « Créer les références » (`import.js:239-261`) ; dédoublonnage `titre normalisé | page` ; chaque lecture **remplace** la zone | code ; `parseIndexLines` seul testé (`tests/tests.js:166`) | Tableau d'entrées éditable (titre, page, section, photo d'origine), fusion des lectures successives |
| Distinguer ordre des photos et pages imprimées | **Partiel** | `position` (ordre) et `printed_page` (champ « p. imprimée » par miniature, `import.js:137`) existent et sont distincts ; rien ne les relie aux entrées lues | code | Voir « reconstituer l'ordre » |
| Recette répertoriée ≠ contenu disponible, dans les données et à l'écran | **Fonctionnel** | `recipes.availability = reference_only`, `current_version_id: null` (`import.js:255`) ; badge « Repérée dans ton livre — page N » (`components.js:34`), fiche (`recipe.js:233-245`), groupe à part en recherche (`search.js:160`), compteurs de la fiche livre (`book.js:87-90`) | suite (badge, recherche) ; fiche livre **hors test** | Lier chaque référence à **sa** photo d'index (aujourd'hui `source_page_ids` = toutes les pages cochées) |

### 1.3 Importer des recettes photographiées

| Demandé | État | Où | Preuve | Travail nécessaire |
|---|---|---|---|---|
| Reconnaître les recettes présentes dans un lot | **Absent** | Le schéma de sortie est **une** recette ; message « Extrais la recette de ces pages » (`llm.js:70`) ; aucune détection de plusieurs recettes | code | Appel « classer » : `{groupes:[{photos, titre, page}], orphelines}` proposé, confirmé à l'écran |
| Regrouper les photos d'une même recette | **Partiel** (manuel) | Cochage des miniatures puis « Regrouper en recette » → `#/recipes/new?pages=…` (`import.js:127,136`) ; un groupe = un éditeur = un appel | code ; vue de séance **hors test** | Le classement ci-dessus propose les groupes ; le cochage reste la correction |
| Extraire titre, ingrédients, quantités, étapes, portions, temps, notes | **Partiel** | `PARSER_SYSTEM` (`llm.js:58-65`) : titre, langue, portions, `prep/cook_minutes`, ingrédients en **texte source** + `uncertain`, étapes, `printed_page`, `sub_recipes`, `uncertain_fields`, `notes` ; structure quantité/unité/nom calculée **localement** par le parseur (`lines.js:49-82`) ; `notes` et `sub_recipes` validés mais **jamais lus** par l'éditeur ; `active/total_minutes` non extraits ; `max_tokens` 4000 ; `stop_reason` ignoré (une réponse coupée = « réponse sans JSON ») | suite : un cas nominal (`tests/passerelle.js:186-196`) ; `validateParsedRecipe` sans test ; **aucun appel réel** | Lire `notes`, relever `max_tokens`, lire `stop_reason`, stocker `uncertain` par ligne |
| Associer au livre et à son entrée de table des matières | **Partiel** | Livre : `edition_id` de la séance (`recipe-edit.js:29`). Entrée : seulement via « Scanner cette recette » qui pose `sessionStorage.cuisineos.pending_recipe` (`book.js:105`, `recipe.js:241`, `recipe-edit.js:39-41`) ; **aucun appariement par titre ou page** ; aucun sélecteur de référence | code ; rattachement **hors test** | Proposer la référence par `titre normalisé + page` à l'enregistrement, confirmable ; sélecteur de repli |
| Enregistrer le contenu structuré et conserver les images | **Fonctionnel** | `save()` (`recipe-edit.js:203-245`) : version `kind: extraction`, `provenance{source_page_ids, source_document_id, generated_by: 'ai', model, edition_id}`, pages marquées `kind: 'recipe'` ; originaux pleine taille dans `files` | code ; `save()` **sans test** | Garder aussi la réponse brute bornée (diagnostic) |
| Dire ce qui est disponible et ce qui reste à vérifier | **Partiel** | `availability` posé (`available` / `partial`) ; `verification_state` de la **fiche** est écrit mais **jamais affiché** (seuls ligne et version le sont) ; `uncertain` et `uncertain_fields` n'apparaissent que dans un texte d'état éphémère (`recipe-edit.js:160-161`) | code | Afficher l'état de vérification de la fiche ; conserver les incertitudes par ligne |
| Distinguer plusieurs recettes d'une recette sur plusieurs photos | **Absent** | Rien dans le prompt ni dans le code sur la continuité entre pages | code | Appel « classer » (ci-dessus) |
| Fidélité, unités, ordre des étapes, illisible signalé, rien d'inventé | **Partiel** | Prompt : « recopie le texte exactement … N'invente jamais … `uncertain` » ; ordre des étapes conservé (`lines.js:87-90`) ; chip « Image très légère » sous 80 Ko (`import.js:14,46`) ; **aucun champ « page manquante » / « recette incomplète »** ; une étape qui contient un saut de ligne devient plusieurs étapes | code | Ajouter `page_manquante` et `incomplet` à la sortie, les montrer ; garder les étapes multi-lignes |
| Progression compréhensible | **Absent** | Un texte unique « Lecture des pages par l’assistant… » ; le bouton « Lire avec l’assistant IA » du panneau d'index **n'est pas désactivé** pendant l'appel : deux clics = deux appels facturés (`import.js:224-237`) | code | Journal d'import (§ 2) et verrou du bouton |

### 1.4 Sauvegarder une recette provenant du web

| Demandé | État | Où | Preuve | Travail nécessaire |
|---|---|---|---|---|
| Extraire le contenu de la recette et l'enregistrer | **Absent** | Signet = recette-référence sans version : `source_url`, `source_label` (hôte), titre, cuisines (`signet.js:45-52`) ; « L'app n'ouvre pas la page : donne-lui le titre » (`signet.js:75`) ; aucun `fetch` d'une page, aucun `DOMParser`, aucune lecture de JSON-LD ; la passerelle n'admet que `web_search_20250305` (`logique.js:3,6,64-83`), blocs `text` et `image` seulement | suite (forme exacte du signet, 0 réseau) ; **aucun signet réel consigné** | Nouvel outil de la passerelle « lecture-web » : la fonction télécharge la page (bornée), lit le JSON-LD `Recipe` s'il existe, sinon passe le texte au modèle ; l'app montre un aperçu puis « Garder » |
| Consulter le texte dans Mitsu ensuite | **Absent** | Fiche d'un signet : « L'app n'a pas lu la page : ouvre-la pour cuisiner. » + « Ouvrir le lien » (`recipe.js:250-258`) | suite | Découle du point précédent : version `extraction` + `availability: available` |
| Provenance : URL, site, auteur | **Partiel** | `source_url`, `source_label` = hôte ; **aucun champ auteur** sur une recette (seulement sur `books`) ; les repères de la recherche (présentation, temps, difficulté) ne sont pas transmis au signet (`search.js:281`) | suite | `source_author`, `source_site`, `source_fetched_at` ; passer les repères au signet |
| Éviter publicités, menus, commentaires | **Absent** | — | — | JSON-LD d'abord (il ne porte que la recette) ; sinon texte principal nettoyé, borné |
| Dire clairement « inaccessible » ou « incomplet » ; un lien sans contenu n'est pas une recette importée | **Partiel** | Un signet reste `reference_only` et porte le badge « Lien web » ; mais une fois une version saisie à la main, la fiche perd le lien cliquable (`recipe.js:61`) | suite (badge) | État d'import `echec` visible ; garder « Ouvrir le lien » sur toute fiche à `source_url` |

### 1.5 Bonus : images des plats

| Demandé | État | Où | Preuve | Travail nécessaire |
|---|---|---|---|---|
| Récupérer une photo pertinente et l'associer | **Absent** | Aucun champ d'illustration sur `recipes` ni `recipe_versions` ; `cook_history.photos` toujours `[]` (`cook.js:183`) ; CSP `img-src 'self' blob: data:` (`index.html:5`) interdit toute image externe ; `og:image` : 0 occurrence | code ; CSP épinglée (`tests/ajouter.js:1805`) | `recipes.photo_sha256` (pointeur souple comme `cover_sha256`), image rapatriée **par la fonction** (CORS), ré-encodée JPEG 1200 px, rangée dans `files` |
| Distinguer images sources et photo du plat | **Partiel** | Les images sources existent (`source_page_ids` → `source_pages.sha256`) et sont affichées « Original » ; la photo du plat n'existe pas | code | Deux champs distincts ; aucune confusion possible si `photo_sha256` est à part |
| Modifier l'association | **Absent** | Seul le livre a photographier / choisir / retirer | code | Même zone que la couverture, sur la fiche recette |

### 1.6 Structurer et fiabiliser

| Demandé | État | Où | Preuve | Travail nécessaire |
|---|---|---|---|---|
| Champs recettes, livres, sources, images | **Fonctionnel** pour l'existant | § 2 ci-dessous. Aucun schéma de champs : le code écrit ce qu'il veut (`AVAILABILITY` et `VERIFICATION` importés nulle part) | code | Valider le vocabulaire à l'écriture |
| États répertoriée / en cours / disponible / incomplète | **Partiel** | `availability` : `reference_only` / `partial` / `available` (libellés `core/i18n.js:25-29`) ; `verification_state` : `unverified` / `to_verify` / `verified` ; **pas d'état « en cours d'import »** (seule la séance est `open`) ; état de la fiche jamais affiché | code | Journal d'import pour « en cours » et « échec » ; pas de troisième vocabulaire |
| Texte en base, images en stockage de fichiers reliés | **Partiel** | Texte dans IndexedDB, synchronisé (25 tables + `assistant_config`) ; octets dans `files` (IndexedDB), **jamais synchronisés** (`outbox.js:7-15`, `backfill.js:9-17`) ; seau Supabase `pages` (50 Mo, 6 types) créé par `0002`, **aucun appel** dans `src/` ; sur un second appareil, pointeurs sans octets (couverture : « n'est pas sur cet appareil », miniatures de pages : `<img>` vide) | suite (absence de `files` dans la file) ; **aucune passe réelle** | Lot « octets entre appareils » : envoi/réception des `files` référencés vers le seau |
| Photos floues, pages manquantes, erreurs d'extraction | **Partiel** | Chip « très légère » (< 80 Ko) ; textes d'erreur de la passerelle complets (quota, trop lourd, serveur, délai) ; pas de page manquante ; pas de garde « hors ligne » avant l'extraction ; pas d'annulation de l'extraction | suite (textes d'erreur, 9 cas) | Champs de sortie, garde hors ligne, bouton Annuler |
| Relancer sans doublon ni écraser les corrections | **Partiel** | Séance reprenable (`status: open`) ; **l'extraction n'est pas persistée** (formulaire en mémoire, perdu si on quitte, appel facturé) ; aucun identifiant d'import ; une nouvelle séance = nouveaux documents et pages même pour la même photo (blob partagé, `repo.js:356`) ; les corrections vivent dans des versions (`kind: correction`), jamais réécrites | code | Journal d'import avec le résultat ; reprise = relecture du journal, pas un nouvel appel |
| Doublons sans fusion automatique | **Partiel** | Références : `titre normalisé | page` dans l'édition, ignorées (`import.js:245-254`) ; nouvelle recette d'un livre : titre + page avec « Créer un doublon » (`recipe-edit.js:216-219`) ; **livres par ISBN : rien** ; **signets par URL : rien** ; octets identiques dédoublonnés par SHA-256 | code ; aucun test | Avertir sur ISBN et URL déjà présents ; jamais fusionner |
| Plusieurs images avec progression | **Absent** | Voir § 1.3 | code | Journal d'import |

## 2. Structure de données proposée

**À conserver tel quel** (il porte déjà l'essentiel) : `books`, `book_editions` (`cover_sha256`), `scan_sessions`, `source_documents`,
`source_pages` (`printed_page`, `position`, `kind`), `files` (clé SHA-256), `recipes` (`edition_id`, `printed_page`, `source_page_ids`,
`source_url`, `source_label`, `availability`, `verification_state`, `current_version_id`), `recipe_versions` (`kind`, `provenance`,
lignes d'ingrédients avec `source_text`, étapes à identifiant stable), le principe « une correction = une version ».

**À ajouter** (`DB_VERSION 4`, chaque magasin neuf déclaré dans `schema.js` et donc dans la synchro et l'archive) :

| Quoi | Forme | Pourquoi |
|---|---|---|
| Magasin **`imports`** (le journal d'import) | `{ id, kind: 'couverture' \| 'index' \| 'classement' \| 'recette' \| 'web', edition_id, page_ids[], source_url, status: 'a_lancer' \| 'en_cours' \| 'a_verifier' \| 'enregistre' \| 'echec', attempts, erreur, resultat (JSON structuré validé), reponse_brute (bornée 64 Ko), recipe_ids[], model, created_at, updated_at }` | Un appel payé n'est plus perdu ; relance = relecture ; progression et « en cours » visibles ; aucune écriture de recette avant ta confirmation |
| `source_pages` | `+ printed_page_range` (lu par le modèle sur la photo), `+ role: 'couverture' \| 'index' \| 'recette' \| null` (remplace à terme `kind`), `position` **modifiable** | Ordre proposé et corrigeable ; distinguer photo d'index et photo de recette |
| `recipes` (références d'index) | `+ index_page_id` (la photo précise), `section` enfin rempli, `+ raw_entry` (la ligne telle que lue) | Une référence sait d'où elle vient ; appariement et correction |
| `recipes` (web) | `+ source_author`, `+ source_site`, `+ source_fetched_at`, `+ source_kind: 'jsonld' \| 'modele'` ; le contenu = `recipe_versions` `kind: extraction` avec `provenance.source_url` | Provenance complète ; distinguer une lecture fidèle (JSON-LD) d'une lecture par modèle |
| `recipes` (photo du plat) | `+ photo_sha256` (pointeur souple vers `files`, comme `cover_sha256`), `+ photo_origin: 'web' \| 'appareil' \| null`, `+ photo_source_url` | Illustration distincte des images sources |
| Lignes d'ingrédients | `+ uncertain: boolean` (venu du modèle) | L'incertitude survit à la navigation |
| Vocabulaire | `availability` et `verification_state` **validés à l'écriture** (`db.mutate` refuse une valeur hors liste) | Aujourd'hui rien ne l'impose |

**À ne pas faire** : un troisième vocabulaire d'état sur la recette. « En cours » et « échec » sont des états **de l'import**
(magasin `imports`), « répertoriée / partielle / disponible » et « non vérifiée / à vérifier / vérifiée » restent sur la recette ; l'écran
compose les deux.

**Images** : les octets restent dans `files` ; leur voyage entre appareils (seau `pages`, politiques déjà en place) est un lot à part,
sans lequel couverture, pages et photos de plats ne sont visibles que sur l'appareil qui les a prises.

## 3. Parcours techniques complets

### 3.1 Un livre
1. **Couverture** : photo → `poserCouverture` (existant : 16 Mpx, JPEG 1200 px, `files`, `cover_sha256` posé sur une édition brouillon)
   → **nouveau** : `imports{kind: 'couverture'}` → un appel `extraction` (image réduite à 1568 px, prompt « lis titre, auteur, éditeur,
   rien d'inventé, `uncertain` ») → pas 2 prérempli « Lu sur la couverture — vérifie » → **nouveau** : recherche Open Library par
   titre + auteur (`search.json?title=&author=`) pour proposer l'ISBN et les métadonnées (étiquette « Proposé par Open Library ») →
   « Ajouter ce livre ». L'ISBN tapé ou scanné reste le chemin le plus sûr et reste offert.
2. **« Et maintenant ? »** (existant) → « Photographier l'index ».
3. **Table des matières** : N photos → séance (existant) → **nouveau** : un appel `extraction` avec les N images demandant, **par
   photo**, `{ photo, printed_page_range, entries:[{title, printed_page, section, uncertain}] }` (`max_tokens` relevé ; si
   `stop_reason = max_tokens`, dire « lecture coupée : moins de photos à la fois ») → résultat dans `imports{kind: 'index', status:
   'a_verifier'}` → **nouveau** écran : ordre des photos proposé par les plages lues (glisser pour corriger, écrit `position`),
   tableau d'entrées éditable (titre, page, section, photo) → « Créer les références » (existant, enrichi de `index_page_id`,
   `section`) → `imports.status = 'enregistre'`. Une seconde lecture **fusionne** par `titre normalisé | page` au lieu de remplacer.

### 3.2 Des photos de recettes
1. N photos → séance avec intention « recette » (existant).
2. **Nouveau** : appel « classer » (`extraction`, N images réduites, prompt : « quelles recettes vois-tu, quelles photos vont
   ensemble, quelle page est imprimée ; une photo qui continue une recette sans son début = `orpheline` ») → `{ groupes:[{ photos:[…],
   title, printed_page }], orphelines:[…] }` → écran de regroupement : groupes proposés, cases à déplacer, « Lire ces recettes ». Pour
   une seule photo ou un seul groupe évident, l'écran se passe de l'appel de classement (zéro dépense).
3. Par groupe confirmé : `imports{kind: 'recette'}` → appel `extraction` existant (prompt enrichi : `page_manquante`, `incomplet`,
   `notes` lues, étapes multi-lignes) → résultat persisté → éditeur de relecture (existant) prérempli depuis le journal.
4. À « Enregistrer » (existant) : **nouveau** appariement proposé à une référence de la même édition par `titre normalisé + page`
   (« Ces pages complètent “X”, page 132 ? », décoché si le doute est grand) ; sinon le sélecteur ; la référence devient
   `available` ou `partial` ; les photos reçoivent `role: 'recette'` ; `imports.status = 'enregistre'`.
5. La fiche livre dit « disponibles » / « repérées » / « à vérifier » (existant + affichage de `verification_state`).

### 3.3 Un lien web
1. « Garder la recette » (depuis l'onglet Web ou une adresse collée) → `imports{kind: 'web', source_url}`.
2. **Nouveau, serveur** : outil `lecture-web` de la fonction `assistant` : télécharge la page (https seulement, redirections
   limitées, hôtes publics seulement, 15 s, 2 Mio), cherche un JSON-LD `@type: Recipe` (`name`, `author`, `recipeIngredient`,
   `recipeInstructions`, `recipeYield`, `prepTime`/`cookTime`/`totalTime`, `image`) ; s'il existe → réponse structurée **sans
   modèle** ; sinon → texte principal nettoyé et borné, passé au modèle avec le prompt d'extraction → réponse structurée. Même
   journal, même quota ; la réponse dit `source_kind`.
3. Client : aperçu « Lue sur <site> — vérifie » (ingrédients passés par le parseur, toutes lignes à vérifier, comme l'extraction
   photo) → « Garder » → version `extraction` avec `provenance.source_url`, `source_author`, `source_site`, `availability:
   available` ; échec → la fiche reste un signet avec « Contenu non récupéré : ouvre la page », `imports.status = 'echec'`, relance
   possible.
4. **Bonus image** : si le JSON-LD ou `og:image` donne une adresse, la fonction rapatrie l'image (5 Mo, types image), le client la
   ré-encode (JPEG 1200 px) → `files` → `photo_sha256` ; échec silencieux, texte gardé.

## 4. Plan d'implémentation par étapes

| Lot | Contenu | Dépend de | Taille | Limites |
|---|---|---|---|---|
| **A. Journal d'import** | Magasin `imports`, persistance du résultat de toute extraction, écran de progression et de reprise, verrou des boutons, garde hors ligne, bouton Annuler ; `verification_state` affiché sur la fiche ; validation du vocabulaire | rien | M | Aucune IA nouvelle ; fondation des autres lots |
| **B. Recette web complète** | Outil `lecture-web` (fonction redéployée), JSON-LD puis modèle, « Garder la recette », aperçu, provenance, état `echec` ; passer les repères de la recherche au signet | A | L | Sites sans JSON-LD et protégés contre les robots : lecture par modèle ou échec dit ; coût d'un appel par page |
| **C. Table des matières multi-pages** | Sortie structurée par photo, ordre proposé et corrigeable, tableau d'entrées, fusion des lectures, `index_page_id`, `section` | A | L | Un livre de 4-5 pages d'index = 1 appel ; `max_tokens` à mesurer sur de vraies photos |
| **D. Lot de recettes photographiées** | Appel « classer », écran de regroupement, extraction par groupe, `page_manquante`/`incomplet`, appariement proposé à la référence, `uncertain` par ligne | A, C (pour l'appariement) | L | 5 recettes = 1 classement + 5 extractions = 6 appels sur 60/jour ; 8 Mio par appel ≈ 8-10 photos réduites |
| **E. Couverture lue** | Prompt couverture, préremplissage, recherche Open Library par titre + auteur | A | S | Couvertures sans titre lisible → saisie ; aucune invention |
| **F. Images des plats** | `photo_sha256`, rapatriement par la fonction, zone photographier / choisir / retirer sur la fiche, cartes et fiche illustrées | B (pour le web) | M | CSP inchangée (toujours `blob:`) ; octets locaux tant que G n'est pas fait |
| **G. Octets entre appareils** | Envoi et réception des `files` référencés (seau `pages`), reprise, quota de stockage | rien | L | Préalable à tout usage multi-appareils des photos ; iPhone jamais mesuré |

Ordre conseillé : **A → B → C → D**, E en parallèle (petit), F puis G. Chaque lot suit la méthode : spec courte, revue adverse, plan,
tâches avec tests, `/verify`, fusion par Neegan. Chaque lot qui touche la fonction `assistant` la redéploie (sondes sans dépense) ;
chaque lot qui ajoute un magasin monte `DB_VERSION` et génère une migration (`tools/generer-migrations.mjs`).

**Limites transverses** : quota 60 appels par compte et par jour ; 8 Mio par appel d'extraction ; 120 s côté serveur ; le modèle est
`claude-sonnet-5-5` pour tout ; Safari et l'iPhone jamais mesurés pour la photo (décodage de photos de plusieurs dizaines de Mpx
par `createImageBitmap` non éprouvé) ; aucune preuve réelle d'extraction aujourd'hui : **le premier geste du lot A est une extraction
réelle d'une page de livre sur le site public**, pour mesurer durée, jetons et fidélité avant de bâtir dessus.

## 5. Critères de validation concrets

| Critère | Observable attendu | Aujourd'hui |
|---|---|---|
| Importer une couverture sans saisie manuelle | Photo → pas 2 prérempli (titre, auteur) étiqueté « Lu sur la couverture », champ illisible vide et dit, « Ajouter ce livre » sans frappe | Saisie obligatoire (titre) sauf par ISBN |
| Réunir cinq pages de table des matières | 5 photos → 1 appel → ordre proposé juste ou corrigé en un glisser → tableau d'entrées → N références, chacune liée à sa photo et sa section ; une relecture ne crée aucun doublon | 1 appel, zone de texte, section perdue, ordre non corrigeable |
| Assembler une recette répartie sur deux photos | 2 photos → classement « 1 recette, 2 photos » → 1 extraction → fiche avec les deux pages en « Original » | Possible si on coche les deux à la main ; aucune détection |
| Importer plusieurs recettes photographiées en une opération | 5 photos de 3 recettes → classement en 3 groupes confirmés → 3 extractions → 3 fiches « à vérifier », 1 orpheline signalée | Un groupe à la main par recette |
| Sauvegarder une recette web et retrouver son texte | « Garder la recette » → aperçu (JSON-LD ou modèle) → fiche `available` avec ingrédients, étapes, portions, temps, source et auteur, lien ouvrable | Lien seul, texte absent |
| Relancer un import interrompu sans doublon | Quitter pendant « en cours » → revenir → le journal montre l'import, « Reprendre » relit le résultat sans nouvel appel ; aucune recette ni page en double | Résultat perdu, nouvel appel, nouvelles pages |
| Signaler une extraction incomplète sans inventer | Photo d'une page coupée → `incomplet: true`, `page_manquante: true` → fiche `partial`, bandeau « page manquante », lignes incertaines marquées | « uncertain » dans un texte d'état éphémère ; pas de page manquante |
| Doublon de livre ou de lien | Même ISBN ou même URL → avertissement avant création, jamais de fusion | Rien |
| Photo du plat (bonus) | Recette web avec JSON-LD `image` → vignette sur la carte ; remplaçable à la main ; échec sans effet sur le texte | Aucune image de recette |

## 6. Ce qui a été vérifié, et comment

- **Code** : lu par quatre explorations indépendantes, chaque constat avec fichier et ligne, puis recoupé avec le schéma
  (`src/model/schema.js`) et `docs/architecture.md` par le contrôleur. Aucun fichier modifié.
- **Suite de tests** : lue, pas exécutée pour cet audit (dernier passage : 3011/3011 sur `778883c`). Les tests nommés dans les tableaux
  sont ceux qui épinglent le comportement cité ; « hors test » veut dire qu'aucun test ne l'exerce.
- **Réel** : seules trois mesures existent dans les documents du dépôt : Open Library par ISBN (script Chrome, 15 octobre,
  `CLAUDE.md` « Mesures réelles »), la recherche web (appel réel du 17 octobre, puis la première recherche par la passerelle sur le
  site public le 18), et les sondes de la passerelle (S1-S12, `RESULTATS-mitsu.md`). **Rien** pour l'extraction de pages, l'index, la
  couverture photographiée, le code-barres, les signets, la synchro réelle ou l'iPhone.
- Deux écarts de documentation relevés au passage : `docs/architecture.md:370-371` dit la relation `source_pages.sha256 → files`
  « latente, jamais vérifiée », alors que `RELATIONS` la contient et que la restauration la vérifie ; `STATE.md` dit encore le lot
  « présentation du serveur » non fusionné alors que `main` le porte (`57babc6`).

## 7. Coordination : un enchaînement, pas un cerveau

**Recommandation : pas d'agent orchestrateur.** Ce qu'il faut reconnaître se dit en trois appels typés, chacun avec un schéma de
sortie fermé, validé champ par champ comme une donnée hostile (ce que fait déjà `creation-ia.js`) :
1. **classer** un lot de photos (groupes, pages imprimées, orphelines) ;
2. **lire** une image ciblée (couverture, ou table des matières par photo) ;
3. **extraire** une recette (photos d'un groupe, ou texte d'une page web).

Tout le reste est déterministe et déjà dans l'app ou simple à écrire : séance, journal d'import, appariement par titre normalisé et
page, dédoublonnage, versions, provenance, JSON-LD. Les jonctions où l'IA peut se tromper (groupes, ordre, appariement) sont des
écrans de confirmation, pas des décisions d'agent. Raisons : une seule personne et un quota de 60 appels par jour ; une PWA
locale-first où chaque écriture doit être relisible et réversible ; un modèle unique côté serveur ; et une règle de la maison déjà en
place, « rien d'inventé, tout à vérifier ». Un « agent cerveau » ajouterait des appels, des états cachés et des erreurs sans écran
pour les corriger. Si un jour un lot de 30 photos mélangées devient courant, le classement peut s'enchaîner automatiquement avec les
extractions dans le journal d'import, sans changer d'architecture.
