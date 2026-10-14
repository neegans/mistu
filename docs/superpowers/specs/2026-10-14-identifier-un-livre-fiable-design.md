# Identifier un livre, fiable — design (rév. 2, 14 octobre 2026)

Source : signalement de Neegan le 14 octobre (« ISBN 9781785035289 : le logiciel n'est pas capable de le retrouver »,
test fait **sur le Mac, site public**), diagnostic du même jour (mémoire `project_mistu_isbn_lookup_diagnostic_20261014`),
décisions prises en chat : **Google Books = case à clé, vide par défaut**. Lot livré sur la branche `isbn-fiable`, arbre
`~/projects/mistu-isbn` (serveur `http://localhost:8082/`), base `ajouter-livres-ux` @ `808aff8`. Le lot rejoint `main`
**après** le lot UX « Ajouter et livres » ; le site public ne change qu'à la fusion et au `git push` de Neegan.
**Rév. 2** : réécrite après deux revues adverses (sécurité S1-S13, faisabilité F1-F27 — § 11.1) ; ce qui a changé est
marqué « (S·/F·) ».

**Convention d'écriture.** Les textes d'interface cités entre « » sont les clés `t()` **exactes**, avec l'apostrophe
typographique ’ (U+2019) comme tout `en.js` (F21) ; la prose de cette spec garde l'apostrophe droite.

## 1. Le problème, du côté de la personne

Neegan tape un ISBN que la source connaît (Open Library répond « Berber and Q », Josh Katz, 2018, en 0,3 à 0,8 s avec CORS
ouvert ; l'app le trouve depuis Chrome sans fenêtre sur les deux versions) — et pourtant l'écran lui a dit que le livre
n'existe pas. Trois défauts du code s'additionnent :

1. **Un seul message pour tout.** Délai dépassé, réseau coupé, hors ligne, réponse 429 « trop de demandes », panne 5xx,
   corps illisible : tout donne « Aucune fiche trouvée pour cet ISBN. Complète à la main. » — un mensonge quand personne
   n'a répondu. Et rien ne propose de réessayer.
2. **Le repli Google Books est mort.** Sans clé, l'API répond 429 avec un quota à zéro (projet anonyme de Google,
   `quota_limit_value 0`, rapports tiers de septembre et octobre 2026). Dès qu'Open Library rate, il n'y a plus rien.
3. **Le point d'entrée utilisé est « legacy ».** `api/books?bibkeys=` est marqué « may be phased out » par Open Library ;
   l'API actuelle (`search.json?isbn=`) donne en **un** appel titre, auteurs, éditeur, année, langue.

Mécanismes plausibles du jour : Open Library limite à **1 requête/s par adresse IP** non identifiée (un navigateur ne peut
pas poser l'en-tête d'identification) ; sur Mac, Safari avec « Relais privé » ou un réseau partagé met beaucoup de monde
derrière la même adresse. Un 429 passager → « aucune fiche ». À cela s'ajoute un détail d'ergonomie : **Entrée** dans le
champ ISBN ne fait rien (pas de `<form>`), il faut cliquer « Identifier ».

Le lot répond à une seule question : **« Pourquoi mon livre n'est pas rempli, et qu'est-ce que je fais ? »** — en disant la
vraie raison, en offrant un geste (Réessayer, ou Saisir à la main), et en refusant tout de suite un ISBN mal tapé.

## 2. Périmètre et hors lot

**Dans le lot.** § 4 validation de l'ISBN avant tout appel · § 5 `lookupIsbn` à trois issues, sources Open Library actuelle
puis legacy, Google Books seulement avec clé, une reprise automatique · § 6 écran du pas 1 (messages vrais, « Réessayer »,
Entrée = Identifier, une identification à la fois) · § 7 clé Google Books publique, vide par défaut · § 8 versions,
dictionnaire, CSP (inchangée), docs.

**Hors du lot (mesuré, nommé pour ne pas y glisser).** BnF (SRU, CORS ouvert mais **0 livre québécois sur 6** : dépôt légal
français seulement) · Library of Congress (défi Cloudflare, 403) · BAnQ (500) · Wikidata (sans fiche) · la **couverture**
(§ 6 du lot UX : toujours Open Library seule, demandée après une identification Open Library ; seule sa fonction de lecture
du corps gagne un paramètre, § 5) · espacement des appels pour la limite 1 req/s (rafale de 6 simultanées mesurée à 200 le
14 octobre : pas de douleur réelle) · mesure Safari (WebKit absent du Playwright local, disque à 97 % : non téléchargé) ·
création de la clé Google (geste de Neegan, § 7) · abandon de la requête en vol quand on **quitte** la route (S4d : coût
borné à `totalMs`, et la génération § 6 rend sa réponse muette — nommé, pas construit) · le chemin réel du lecteur de
code-barres (`pickFiles` + `createImageBitmap` : non exerçable par la suite, comme avant — F8).

## 3. Invariants

- **I-B (hérité).** Un état d'écran reflète un événement réel : « aucune fiche » n'est dit que si **Open Library** a
  **répondu** qu'elle n'en a pas (S5/F6) ; « n'a pas répondu » n'est dit que si Open Library n'a pas répondu.
- **Aucune donnée inventée (hérité).** Une fiche reçue est proposée « à vérifier », jamais enregistrée seule ; un champ
  qui n'est pas une chaîne n'est pas une donnée (S6).
- **Aucune clé privée dans le dépôt (hérité, R29).** La clé Google Books est **publique par conception** ; sa restriction
  par référent est un **dos-d'âne**, pas un mur (S1) ; vide par défaut.
- **Aucun réseau dans la suite (hérité).** `fetch`, l'attente, l'état « en ligne », les délais et la clé sont injectés
  par un quatrième paramètre de la route (F3).
- **Aucun hôte nouveau.** `openlibrary.org`, `covers.openlibrary.org`, `www.googleapis.com` : CSP `connect-src 'self' https:`
  inchangée (R-UX-15).
- **I-R (nouveau).** Une reprise automatique n'a lieu que sur un échec **muet** (délai, réseau) ; un refus **parlé** (429,
  5xx, 4xx) n'est jamais réessayé par la machine — c'est la personne qui décide, par « Réessayer ».
- **I-G (nouveau, S3/F9).** **Une identification à la fois**, et une réponse n'écrit que si elle appartient à la
  **génération** courante : tout geste qui change l'ISBN ou le pas fait avancer la génération.

## 4. Validation de l'ISBN — `src/core/isbn.js` (module neuf, pur)

`validerIsbn(texte)` → `{ ok: true, isbn13, isbn10 }` ou `{ ok: false, motif }`, avec `motif ∈ { 'vide', 'longueur',
'controle', 'pas_isbn' }`. Règles, après `nettoyerIsbn` (chiffres et X seulement ; **le x minuscule devient X** — F23) :

- longueur 10 : neuf chiffres + chiffre de contrôle 0-9 ou X ; somme pondérée 10→1 ≡ 0 (mod 11) ; sinon `controle` ;
  `isbn13` = `978` + les neuf chiffres + contrôle EAN recalculé ; `isbn10` = la forme nettoyée.
- longueur 13 : **treize chiffres** (un X n'importe où → `longueur` — F23) ; préfixe `978` ou `979` vérifié **avant** le
  contrôle, sinon `pas_isbn` (un code-barres de prix ou d'un autre produit) ; contrôle EAN (poids 1,3 alternés) sinon
  `controle` ; `isbn10` = conversion si `978`, `null` si `979`.
- toute autre longueur → `longueur` (un X hors dernière position d'un 10 aussi) ; chaîne vide → `vide`.

`codeBarresVersIsbn(codes)` (F8) : reçoit la liste rendue par `BarcodeDetector.detect`, rend le premier `rawValue` au motif
`/^97[89]\d{10}$/`, ou `null`. `scanner` l'appelle puis passe par `identifier` : un code lu qui échoue au contrôle est
traité comme un ISBN tapé faux (message § 6), pas comme « aucun ISBN lu ». La fonction est testée seule ; le chemin
`pickFiles` + `createImageBitmap` reste hors suite (comme avant).

`nettoyerIsbn` déménage dans ce module et reste ré-exporté par `livre-ajout.js` (aucun autre importateur).

**Ce qui est enregistré (S8/F22).** `fabriquerLivre` écrit `isbn13` quand la validation passe ; sinon **`null`** — jamais
une suite libre de chiffres (elle finirait dans la colonne générée `isbn` et son index btree, `0001_tables_et_regles.sql`
99-103). `saisirMain` **normalise** l'ISBN en `isbn13` quand il est valide (affiché = enregistré) ; invalide et non vide,
il est gardé **borné à 20 caractères** pour l'affichage du pas 2 seulement (« ISBN 12345 — non valide, ne sera pas
enregistré »). Le champ ISBN porte `maxlength="20"`. Les éditions existantes à dix chiffres ne bougent pas.

## 5. `lookupIsbn` — trois issues, trois sources au plus

**Signature.** `lookupIsbn(isbn13, { fetch = globalThis.fetch, signal, cle = '', attendre = attenteReelle,
surReprise = null, tentativeMs = LIMITES_ISBN.tentativeMs, repriseMs = LIMITES_ISBN.repriseMs } = {})` (F4 : les délais
sont **injectés**, la suite passe `tentativeMs: 1`). **Entrée gardée (S9)** : `isbn13` doit matcher `/^97[89]\d{10}$/`,
sinon `TypeError` **avant tout appel** — l'erreur est celle d'un appelant, pas de la source. Rend
`{ statut, fiche, source, motif, google, appels }` :

- `statut ∈ { 'trouve', 'introuvable', 'indisponible' }` ;
- `source ∈ { 'openlibrary', 'googlebooks', null }` (`'openlibrary'` pour les deux points d'entrée Open Library : la
  provenance affichée et la couverture ne distinguent pas l'API) ;
- `motif` : `null` sauf `indisponible` → `'delai' | 'reseau' | 'limite' | 'serveur'` (le motif `'horsligne'` est posé par
  la route, § 6, sans appel) ;
- `google ∈ { 'non_appele', 'rien', 'echec' }` (S5 : le message d'« introuvable » ne nomme que ce qui a répondu) ;
- `fiche` : `{ title, author, publisher, year, language }`, `null` sinon ;
- `appels` : nombre de `fetch` faits (preuve des reprises et des sources non appelées).

**Bornes (S3 héritées, S6/S7 durcies).** `borner(s)` tronque à 300 caractères **et retire les catégories Cc et Cf**
(`\p{Cc}`, `\p{Cf}` : contrôle, bidi, U+2028/2029) ; `annee()` inchangée (quatre chiffres ou `null`). Un champ n'est pris
que si c'est une **chaîne** ; un tableau est filtré sur ses chaînes ; tout le reste vaut `''`. **Une fiche exige un
`title` chaîne non vide après `trim()`** ; sans titre, la réponse compte comme « rien ». Le corps est lu **en flux** par
`corpsBorne(r, type, borne)` (la fonction de la couverture gagne un troisième paramètre, défaut inchangé
`LIMITES_COUVERTURE.octetsDistants`) avec `borne = LIMITES_ISBN.corps` = **256 Kio d'octets**, coupé par `cancel()` —
plus de `r.text()` entier en mémoire (S7).

**Un appel = un budget.** Chaque tentative a son `AbortController`, armé par `setTimeout(tentativeMs)` ; il couvre le
`fetch` **et** la lecture du corps (un abandon pendant `read()` rejette, S4e). Il est relié au `signal` extérieur par un
écouteur `abort` posé `{ once: true }` et **retiré en `finally`** (S4f) ; **avant chaque tentative et après chaque
attente**, `signal.aborted` est lu : abandonné → **arrêt immédiat**, aucune étape suivante, aucune reprise (S4a-c, F14).
`attendre(ms, signal)` est abandonnable (rejet ou retour anticipé → arrêt). Les options S12 restent (`mode: 'cors'`,
`credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`) — **une exception nommée** pour Google
Books, § 7.

**Classement d'un échec (par tentative, dans cet ordre — F14).** Signal de la tentative abandonné (`ctl.signal.aborted`,
que ce soit le chrono ou l'extérieur) → `delai` ; sinon `fetch`/`read` qui rejette → `reseau` ; HTTP 429 → `limite` ;
tout autre HTTP non 2xx → `serveur` ; corps > 256 Kio, JSON invalide ou **forme inattendue** → `serveur`. Une réponse 2xx
JSON **sans fiche mais de forme attendue** est une réponse (**« a répondu »**), pas un échec.

**Ordre et règles.**
1. **Open Library, API actuelle** : `https://openlibrary.org/search.json?isbn=<isbn13>&fields=title,author_name,publisher,
   first_publish_year,language&limit=1` (`isbn` retiré des `fields` : jamais lu — F13). Forme attendue :
   `Array.isArray(docs)` (S6/F13 — `numFound` n'est pas requis) ; sinon `serveur`. `docs[0]` avec titre → fiche :
   `title`, `author` = chaînes de `author_name` jointes par « , », `publisher` = **première** chaîne de `publisher`
   (liste au niveau de l'œuvre, § 10), `year` = `first_publish_year` si entier, `language` = `'fr'` si
   `Array.isArray(language)` contient `'fre'`, `'en'` si `'eng'` (le français d'abord quand les deux sont là), `null`
   sinon. `docs` vide ou sans titre → « a répondu, rien ».
   **Reprise (I-R)** : sur `delai` (du chrono, pas de l'extérieur) ou `reseau`, **une** seconde tentative après
   `attendre(repriseMs, signal)` ; `surReprise()` est appelé juste avant (la route affiche « Nouvel essai… ») ; jamais
   sur `limite`/`serveur`.
2. **Open Library, legacy** (`api/books?bibkeys=ISBN:<isbn13>&format=json&jscmd=data`, même typage des champs : titre
   chaîne non vide, `authors[].name`/`publishers[].name` filtrés sur les chaînes, `publish_date` → `annee()`),
   **seulement** si 1 a répondu « rien » (l'index de recherche peut retarder sur une édition fraîche). Pas de reprise. Un
   échec ici ne change pas le statut : 1 a répondu. Le jour où ce point d'entrée disparaît, cette étape échoue en
   `serveur` sur les seuls « rien » — rien d'autre ne bouge.
3. **Google Books**, **seulement si `cle` est non vide ET si l'étape 1 a répondu « rien »** (S4c/F6 : après un échec
   d'Open Library, Google n'est pas appelé — l'écran dira « n'a pas répondu » et offrira « Réessayer ») et si 2 n'a pas
   donné de fiche : `https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn13>&maxResults=1&key=<encodeURIComponent(cle)>`
   (S9), lecture `items[0].volumeInfo` avec le même typage (titre chaîne non vide ; `authors` filtré ; langue `fr`/`en`
   sinon `null`). Pas de reprise. `google` = `'rien'` (2xx de forme attendue sans fiche) ou `'echec'`. Sans clé : **aucun
   appel**, `google = 'non_appele'`.

**Agrégation (S5/F6).** Une fiche à n'importe quelle étape → `trouve` (la première gagne ; les étapes suivantes ne sont
pas appelées). Sinon : **si l'étape 1 a répondu « rien » → `introuvable`** (quoi qu'aient fait 2 et 3) ; **si l'étape 1
n'a pas répondu → `indisponible`**, `motif` = celui de sa dernière tentative, et ni 2 ni 3 ne sont appelés.

**Ce qui ne change pas.** `fusionnerFiche`, `OPTIONS_FETCH` (export inchangé), la provenance « Renseigné par Open Library /
Google Books — vérifie et corrige. », la couverture (demandée après `source === 'openlibrary'`, même mécanique R-UX-12/13,
**même délai `LIMITES_ISBN.delaiMs` = 10 000 ms** — F24 : le délai de la couverture ne bouge pas, celui des tentatives est
`tentativeMs`).

## 6. Écran — pas 1 « Identifier »

**Dépendances de la route (F3).** `renderLivreAjoutRoute(params, query, ctx, deps = {})` avec
`{ fetch = globalThis.fetch, enLigne = () => navigator.onLine !== false, attendre = attenteReelle, cle = GOOGLE_BOOKS.key,
naviguer = navigate, tentativeMs, repriseMs } = deps`. Le routeur (`app.js:81`) passe trois arguments : les défauts sont
la production. `fetch` sert aussi à la couverture (`recupererCouvertureParIsbn(isbn, { fetch, signal })`). **La suite ne
stubbe plus `globalThis.fetch` pour cette route** : une seule convention, `deps` (F1/F3).

**Modèle** `livreAjoutModel(etat)` gagne : `validation` (motif § 4 ou `null`), `resultat` (`{ statut, motif, google }` ou
`null`), `reprise` (booléen), `cleGoogle` (**paramètre**, défaut `false` ; la route le pose à `!!deps.cle` — F12),
`isbnValide` (booléen, pour la ligne de rappel du pas 2). Il rend en plus `messages.validation`, `messages.indisponible`,
`messages.sources`, `messages.rappelIsbn`, et `peutReessayer` (`resultat?.statut === 'indisponible' && !recherche`).
`messages.recherche` devient « Recherche… » ou « Nouvel essai… » (`reprise`).

**Route.** `identifier({ forcer = false } = {})` :
0. **Garde I-G** : `if (etat.recherche) return;` (S3/F9).
1. `validerIsbn(etat.isbn)` : `vide` → `toast('Saisis un ISBN d’abord.')` (comme aujourd'hui) ; `longueur`/`controle`/
   `pas_isbn` → `etat.validation`, redessin, **aucun appel**, on reste au pas 1. Valide → `etat.validation = null`
   **tout de suite** (F18), `etat.isbn = isbn13`.
2. `enLigne()` faux **et** `!forcer` → `etat.resultat = { statut: 'indisponible', motif: 'horsligne' }`, **aucun appel**
   (S13 : « Réessayer » passe `forcer: true` — un navigateur qui se croit hors ligne à tort n'enferme personne).
3. `etat.generation += 1` (la valeur est capturée dans `gen`), `etat.recherche = true`, `reprise = false`, `resultat =
   null`, provenance et couverture remises à zéro (R-UX-13 inchangé), redessin (le champ ISBN est **`readOnly`** pendant
   la recherche — S3). `AbortController` **extérieur** armé à `LIMITES_ISBN.totalMs` = **20 000 ms**, puis
   `lookupIsbn(isbn13, { fetch, signal, cle, attendre, tentativeMs, repriseMs, surReprise })` ; `surReprise` pose
   `reprise = true` et redessine (F26 : ce redessin remplace le champ, qui est `readOnly` à ce moment — rien à perdre).
4. **À la réponse, si `gen !== etat.generation` : rien n'est écrit** (I-G). Sinon : `trouve` → pas 2, champs fusionnés sur
   `{ …CHAMPS_VIDES(), language: '' }` puis `language` retombe à `'fr'` si vide (F5 : la langue reçue arrive au sélecteur),
   provenance = source. `introuvable` → pas 2, champs vides, provenance `'aucune'`, `resultat` posé (pour le texte avec
   ou sans Google). **`indisponible` → on reste au pas 1**, `resultat` posé, ISBN conservé.
5. `finally` : chrono extérieur levé, `recherche = false`, `reprise = false` (S11), redessin **seulement si `gen ===
   etat.generation`**.

**Gestes.** `reessayer` = `identifier({ forcer: true })` (le bouton n'existe que si `peutReessayer`). `changerIsbn` ne
redessine pas (R-UX-9) : `validation` et `resultat` tombent au prochain `identifier`. **`saisirMain` et `retourIsbn` font
avancer `generation`** et remettent `resultat`, `validation` à `null` (F7) ; `saisirMain` normalise l'ISBN (§ 4). Le
champ ISBN reçoit `onKeydown` : **Entrée** → `preventDefault()` + `identifier()`, **ignorée si `e.repeat ||
e.isComposing`** (S3) ; pas de `<form>` (un `submit` natif ferait naviguer le `#`).

**Textes** (clés `t()` exactes, apostrophe ’) :

| Quand | Texte |
|---|---|
| `validation = longueur` ou `controle` | « Cet ISBN n’est pas valide, vérifie les chiffres. » |
| `validation = pas_isbn` | « Ce code-barres n’est pas un ISBN. » |
| `indisponible / delai` | « Open Library n’a pas répondu à temps. » |
| `indisponible / reseau` | « Impossible de joindre Open Library. Vérifie ta connexion. » |
| `indisponible / limite` | « Open Library reçoit trop de demandes en ce moment. Attends quelques secondes. » |
| `indisponible / serveur` | « Open Library est en panne pour le moment. » |
| `indisponible / horsligne` | « Tu es hors ligne. » |
| `introuvable`, `google = non_appele` | « Aucune fiche chez Open Library pour cet ISBN. Complète à la main. » |
| `introuvable`, `google = rien` | « Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main. » |
| `introuvable`, `google = echec` | « Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main. » |
| sous les boutons, sans clé | « L’ISBN est envoyé à Open Library. » |
| sous les boutons, avec clé | « L’ISBN est envoyé à Open Library, puis à Google Books si besoin. » (inchangé) |
| pendant la reprise | « Nouvel essai… » |
| rappel au pas 2, ISBN invalide | « ISBN {i} — non valide, ne sera pas enregistré » |
| bouton | « Réessayer » |

Mise en page du pas 1 : première ligne et champ inchangés (`maxlength="20"`, `readOnly` pendant la recherche) ;
`messages.validation` sous le champ (`.muted`, pas de carte rouge) ; la rangée de boutons inchangée (« Scanner le
code-barres », « Identifier », « Saisir à la main ») ; **sous la rangée**, quand `resultat` est `indisponible` et que la
recherche est finie : le message, puis **un seul** bouton `.btn.primary` **« Réessayer »** (`data-role="reessayer"`) —
pas de second « Saisir à la main » (F17). Pendant `recherche` : « Identifier » fermé, « Réessayer » **absent**, le message
« Recherche… »/« Nouvel essai… » visible. Aucun `logError`, aucune carte rouge pour une identification qui échoue (c'est
un état ordinaire, pas une erreur du programme).

Le site public (`main`, `src/ui/add.js` d'avant le lot UX) n'est **pas** touché : il disparaît à la fusion du lot UX.

## 7. Clé Google Books — publique, vide par défaut

`src/sync/config.js` (le fichier des valeurs publiques par conception) exporte en plus :

```js
export const GOOGLE_BOOKS = { key: '' }; // vide = Google Books jamais appelé
```

**Pourquoi c'est public, et ce qui protège vraiment (S1).** La restriction par référent HTTP est un **dos-d'âne** : un
`Referer` se forge en une ligne hors navigateur, et la clé se lit dans le dépôt public. Les **murs** sont ailleurs, et
c'est le geste de Neegan qui les pose : (1) un projet Google Cloud **dédié et sans compte de facturation** (par exemple
`cuisine-os-livres` — **pas** `cuisine-os-neegan`, qui porte le client OAuth de la connexion : un signalement d'abus ne
doit pas toucher le login) ; (2) restriction d'API « Books API » seule ; (3) **plafond de quota abaissé** (IAM → Quotas,
par exemple 200 appels/jour) ; (4) restriction par référent quand même (`https://neegans.github.io/*`,
`http://localhost:8082/*`…). **Impact accepté d'un abus** : la perte du repli Google jusqu'à rotation de la clé — rien
d'autre n'est atteignable. Une clé **sans** restriction d'API ne doit **jamais** être collée.

**L'exception S12.** Avec `referrerPolicy: 'no-referrer'`, Google ne reçoit **aucun** référent et **refuse** une clé
restreinte par référent. L'appel Google Books (et lui seul) part donc avec `referrerPolicy: 'strict-origin'` : l'origine
seule, jamais le chemin ni le `#` ; le référent est omis seulement sur un **déclassement** HTTPS → HTTP (S10/F20 : une
page servie en `http://` envoie son origine à `https://www.googleapis.com` — inoffensif, Google refuse un référent hors
liste). La politique par requête l'emporte sur le `<meta name="referrer">` de la page. **Non prouvé** : que Google
accepte un `Referer` réduit à l'origine pour une clé restreinte, et que Safari envoie bien ce référent — à mesurer au
geste de Neegan, avec sa clé.

**Geste de Neegan (pas dans ce lot, écrit dans `docs/google-books.md`, une page)** : projet dédié sans facturation →
« Books API » → clé d'API → restrictions (sites web, API) → quota abaissé → coller dans `GOOGLE_BOOKS.key` → `VERSION`
incrémentée → `git push`. **Si la protection de push de GitHub refuse la chaîne `AIza…`** (S2 : possible sur un dépôt
public), passer par l'écran de contournement avec le motif « clé publique par conception, restreinte » — documenté.
Tant que la case est vide, le lot vit avec Open Library seule — c'est l'état livré.

## 8. Données, versions, dictionnaire, CSP, docs

| Élément | Changement |
|---|---|
| Base locale / serveur / archive | **aucun schéma** : `book_editions.isbn` reste un texte — désormais **13 chiffres ou `null`** pour les fiches neuves (S8) ; `DB_VERSION` inchangée ; `--check` reste 0 |
| `src/core/isbn.js` | module neuf (`nettoyerIsbn`, `validerIsbn`, `codeBarresVersIsbn`) → entrée dans `SHELL` |
| `src/ui/livre-ajout.js` | `LIMITES_ISBN = { champ: 300, corps: 262144, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 }` ; `corpsBorne(r, type, borne)` ; `lookupIsbn`, modèle, rendu, route (§ 5-6) ; commentaire d'en-tête de `lookupIsbn` réécrit (F27) |
| `src/sync/config.js` | `GOOGLE_BOOKS` ajouté (pas de changement pour `SUPABASE`/`currentConfig`) |
| `src/model/schema.js` | `APP_VERSION = '0.4.1'` |
| `sw.js` | `VERSION = 'cuisine-os-v0.4.1-1'` ; **les deux pins** passent à `v0\.4\.1-\d+` / `'0.4.1'` : `tests/ajouter.js` (≈ 862-864) **et** `tests/sync-l3.js` (≈ 1864) (F10) |
| `src/i18n/en.js` | chaque chaîne neuve de § 6 a son entrée ; **une** chaîne retirée (« Aucune fiche trouvée pour cet ISBN. Complète à la main. », F16) |
| CSP (`index.html`, `tests/index.html`) | **inchangée** (`connect-src 'self' https:`, R-UX-15) |
| `docs/architecture.md` (ligne ≈ 262 « Open Library puis Google Books en repli »), `CLAUDE.md` | réécrits : sous-section « Identifier un livre, fiable » (livré, non prouvé, dettes) (F27) |
| `docs/google-books.md` | procédure § 7 |
| `docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md` | **pas modifiée** : ce lot a sa spec |

**Fusion (F10).** `isbn-fiable` est posée sur le sommet actuel de `ajouter-livres-ux` (`808aff8`). Ordre : UX dans
`main`, puis ISBN. **Si `ajouter-livres-ux` reçoit un commit avant la fusion, rebaser `isbn-fiable` dessus** ; les lignes
de version (`APP_VERSION`, `VERSION`, les deux pins) se résolvent en faveur d'`isbn-fiable`.

## 9. Ce que la suite de tests doit prouver (rouge d'abord)

Même harnais que le lot UX (`tests/ajouter.js` : bloc « § 5 Ajouter un livre en deux pas » **réécrit**, bloc route
R-UX-13 (≈ 631-775) **réécrit** — F1 ; `deps` injectées ; `attendre` factice = **aucune vraie attente** ; `tentativeMs: 1`
pour les délais ; `withRepo` pour les écritures).

**Tests existants qui passent au rouge, et c'est attendu (F11).** `ajouter.js` ≈ 136 (`LIMITES_ISBN` : trois clés de
plus), 142-161 (réponses factices de forme legacy servies à `search.json` → `serveur`), 149 (`signal: undefined` : la
tentative a toujours un signal), 154-156 (`eq` sur l'objet entier : `statut`/`motif`/`google`/`appels` neufs), 170 (texte
retiré), 204 (phrase « sources » sans clé), 631-775 (ISBN de fixture à trois chiffres, stub sans `search.json`, cas
Google sans clé), 862-864 et `sync-l3.js` ≈ 1864 (pins). La fixture `9782761950001` (contrôle faux) est remplacée par de
vrais ISBN-13 (F22).

1. **`validerIsbn`** : `0306406152` → `{ ok, isbn13: '9780306406157', isbn10: '0306406152' }` ; `080442957x` (x minuscule)
   ok, `isbn10 '080442957X'` ; `9782890772816` ok, `isbn10 '2890772810'` ; `9791234567896` ok, `isbn10 null` ;
   `9781785035280` → `controle` ; `5901234123457` → `pas_isbn` ; `978X785035289` → `longueur` ; `978178503528` (12) →
   `longueur` ; `' 978-1-78503-528-9 '` ok ; `''` → `vide` ; `12345678X9` → `longueur`. `codeBarresVersIsbn([{ rawValue:
   '5901234123457' }, { rawValue: '9781785035289' }])` → `'9781785035289'` ; `[]` → `null`.
2. **`lookupIsbn`, garde et statuts** : `'9781&x=1'` → `TypeError`, **0 appel** (S9) ; search 200 + doc → `trouve` /
   `openlibrary` / `appels 1`, `language 'fr'` quand `['eng','fre']` ; search `{ docs: [] }` sans `numFound` + legacy fiche
   → `trouve` / `appels 2` ; search 0 + legacy `{}` → `introuvable` / `appels 2` / `google 'non_appele'` ; search 0 +
   legacy **rejette** → `introuvable` ; search rejette **deux fois** → `indisponible` / `reseau` / `appels 2`, `attendre`
   appelée **une** fois avec `(repriseMs, signal)`, `surReprise` appelée une fois ; search rejette puis répond → `trouve`
   / `appels 2` ; search 429 → `limite` / `appels 1`, `attendre` jamais appelée ; search 503 → `serveur` / `appels 1` ;
   `tentativeMs: 1` + `fetch` qui n'aboutit jamais → `delai` et `signal.aborted` vrai sur le signal reçu par ce `fetch`,
   puis (reprise) second appel ; signal extérieur abandonné **pendant la tentative** → `delai`, `appels 1`, aucune reprise ;
   signal abandonné **pendant `attendre`** (l'`attendre` factice l'abandonne) → `appels 1` ; signal **déjà** abandonné →
   `appels 0`, `delai` (S4).
3. **`lookupIsbn`, formes hostiles (S6/F13)** : search `{}` (sans `docs`) → `serveur` ; `docs[0]` sans `title` → « rien »
   (legacy appelé) ; `title: 12` → rien ; `author_name: 'x'` → `author ''` ; `publisher: [{}]` → `''` ; `language:
   'french'` → `null` ; titre avec U+202E et U+2028 → retirés ; corps en flux de 300 Kio (ReadableStream injecté comme
   R-UX-12) → `serveur`, `cancel()` appelé.
4. **`lookupIsbn`, Google** : sans clé, search 0 + legacy `{}` → `appels 2`, **aucune** adresse `googleapis` vue ; avec
   `cle: 'k&x'` → troisième appel, adresse contenant `key=k%26x` et `q=isbn:`, options `{ …OPTIONS_FETCH, referrerPolicy:
   'strict-origin', signal }` (les appels Open Library restent `no-referrer`) ; Google 200 + item → `trouve` /
   `googlebooks` ; Google 429 après deux « rien » → `introuvable` / `google 'echec'` ; Google 200 vide → `introuvable` /
   `google 'rien'` ; **search 503 avec clé → `indisponible` / `serveur`, `appels 1`, aucune adresse `googleapis`** (F6).
5. **Modèle** : `livreAjoutModel({ validation: 'controle' })` → `messages.validation` ; `{ resultat: { statut:
   'indisponible', motif: 'limite' } }` → `messages.indisponible` au texte voulu et `peutReessayer` vrai ; `recherche`
   vrai → `peutReessayer` faux ; `reprise` → « Nouvel essai… » ; `cleGoogle` vrai/faux → les deux phrases « sources » ;
   les trois textes d'`introuvable` selon `google` ; `isbnValide` faux → rappel « non valide ».
6. **Route** (`deps` injectées, `withRepo`) : ISBN faux → **aucun** appel, message visible, pas 1, le champ garde sa
   valeur ; `enLigne` faux → aucun appel, « Tu es hors ligne. », « Réessayer » présent, puis « Réessayer » **appelle
   quand même** (`forcer`, S13) ; search 429 → pas 1, message « trop de demandes », « Réessayer » présent, « Saisir à la
   main » **une seule fois** dans la page (F17) ; puis le stub passe à 200 et « Réessayer » → pas 2, provenance Open
   Library, `select[name=language]` = `en` pour `['eng']` (F5) ; après un `indisponible`, « Saisir à la main » → pas 2
   sans message, « ← Changer d’ISBN » → pas 1 sans message (F7) ; **Entrée** (`keydown`, `key: 'Enter'`) → l'appel part ;
   **deux Entrée** (le second pendant la recherche) → **un** appel, et `input.readOnly` vrai pendant la recherche (S3/F9)
   ; Entrée avec `repeat: true` → aucun appel ; **réponse tardive** : A identifié, réponse retenue ; « Saisir à la main »
   ; la réponse de A arrive → pas 2 **vide**, aucune provenance, `generation` a bougé (I-G) ; **croisement** : A
   identifié (réponse retenue), « ← Changer d’ISBN », B identifié, réponse de A libérée puis celle de B → champs = B
   seulement ; la couverture est demandée après un `trouve` par **search** (adresse `covers.openlibrary.org` vue une
   fois) et jamais après `indisponible` ; « Ajouter ce livre » après un `trouve` (`naviguer` injectée, espionnée) →
   `db.getAll('book_editions')` contient `isbn: '<13>'` (F15) ; « Saisir à la main » avec `12345` → édition `isbn: null`
   et rappel « non valide » ; saisie de 10 000 chiffres → champ borné (`maxlength`), édition `isbn: null` (S8).
7. **Statique** : `SHELL` contient `./src/core/isbn.js` ; les **deux** pins à `0.4.1` ; chaque `t('…')` littéral de
   `livre-ajout.js` et `isbn.js` a son entrée `en.js` (mécanique F13 du lot UX) ; la chaîne retirée n'est plus dans
   `en.js` ; `GOOGLE_BOOKS.key` est une chaîne **vide ou au motif `/^AIza[0-9A-Za-z_-]{35}$/`** (S2/F2 : un test de
   forme, jamais de valeur) ; aucun `html:`/`innerHTML`/`window.open` dans `isbn.js` **ni dans les rendus neufs de
   `livre-ajout.js`** (S12) ; un `resultat` dont le motif serait une chaîne hostile reste du texte ; CSP affirmée inchangée
   (R-UX-15). (U+2028/2029 = grep de `/verify`, pas de la suite — F25.)

**Mesures réelles (au plan, avant « vert »)** sur `http://localhost:8082/` : `9781785035289` et `9782890772816` →
« Renseigné par Open Library », champs remplis, langue `en`/`fr`, **une** requête `search.json` chacune (journal réseau)
; `9781785035280` → refusé, **zéro** requête ; `context.setOffline(true)` → « Tu es hors ligne. » + « Réessayer », zéro
requête ; `setOffline(false)` + « Réessayer » → trouvé. Après fusion et `push` de Neegan : les deux ISBN depuis le site
public. Le chemin Google avec clé n'est mesuré **qu'au geste de Neegan** (§ 7).

## 10. Risques et décisions ouvertes

- **Qualité des champs de `search.json`** : données au niveau de l'**œuvre** (premier éditeur de la liste, première année
  de parution), pas de l'édition tenue en main. Accepté : la fiche est « à vérifier », et le legacy ne sert plus qu'en
  filet. Si le legacy disparaît, on perd ce filet sur les éditions fraîches — rien d'autre.
- **Deux appels Open Library d'affilée** sur un « rien » (search puis legacy) face à la limite 1 req/s : mesuré sans
  effet sur une rafale de six ; si un 429 apparaît sur le legacy, le statut reste `introuvable` (vrai : search a répondu).
- **`navigator.onLine`** : `false` n'est pas une vérité absolue (VPN, adaptateur virtuel — S13), d'où « Réessayer » qui
  force l'appel ; `true` ne garantit rien, d'où `reseau` possible après ce contrôle.
- **Pire cas de durée (F19)** : sans clé 8 + 1,5 + 8 = 17,5 s (le legacy ne suit qu'un « rien », jamais un échec) ; avec
  clé, après un « rien » : 8 (search) + 8 (legacy) + 8 (Google) = 24 s → le chrono extérieur coupe à 20 s ; le statut est
  alors `introuvable` (search a répondu) avec `google 'echec'` — vrai. Choix assumé.
- **Clé Google publique** : dos-d'âne (référent) + murs (projet dédié sans facturation, API seule, quota abaissé) ;
  l'abus coûte le repli Google, rien d'autre.
- **Safari / iPhone** non mesurés (pas de WebKit ici) : `AbortController`, `keydown`, `navigator.onLine`, `readOnly` sont
  standard ; la preuve sur appareil reste un geste de Neegan, comme pour le lot UX.
- **Quitter la route pendant une recherche** : la requête en vol n'est pas abandonnée (au plus `totalMs`), sa réponse
  est muette (génération). Nommé, pas construit (S4d).
- **Code-barres au contrôle faux** : un vrai ISBN mal lu (chiffre flou) finit « pas valide » : la personne retape ; on ne
  corrige rien à sa place.

## 11. Traçabilité des revues

### 11.1 Constats et réponses (rév. 1 → rév. 2)

| Constat | Sévérité | Réponse |
|---|---|---|
| S1 référent = dos-d'âne, projet partagé avec le login | Important | § 7 : murs nommés (projet dédié sans facturation, API seule, quota abaissé), impact accepté = perte du repli |
| S2 / F2 test `key === ''` rougit le jour de la clé ; push protection | Important / Bloquant | § 9.7 test de **forme** ; § 7 contournement GitHub documenté |
| S3 / F9 identifications concurrentes, Entrée contourne le bouton | **Bloquant** | § 3 I-G ; § 6 garde `recherche`, `readOnly`, `repeat/isComposing`, génération ; tests § 9.6 |
| S4 / F14 abandon non étanche, classement `AbortError` = `reseau` | Important | § 5 : `aborted` lu avant chaque tentative et après `attendre`, écouteur `once` retiré, chrono couvre le corps, ordre de classement ; S4d nommé hors lot |
| S5 / F6 « ni Google Books » quand Open Library n'a pas répondu | Important | § 5 : `introuvable` ⇔ étape 1 a répondu « rien » ; Google jamais appelé après un échec OL ; champ `google` ; trois textes |
| S6 / F13 formes hostiles, « rien » indéfini | Important | § 5 : `Array.isArray(docs)`, titre chaîne non vide, champs typés, `borner` retire Cc/Cf ; tests § 9.3 |
| S7 corps lu en entier | Mineur | § 5 : `corpsBorne` réutilisé, 256 Kio d'octets en flux |
| S8 / F22 / F23 ISBN libre stocké, X minuscule, affiché ≠ enregistré | Important | § 4 : `null` si invalide, `maxlength 20`, X majuscule, `saisirMain` normalise ; 13 avec X → `longueur` |
| S9 confiance à l'appelant, `key=` non encodé | Mineur | § 5 : `TypeError` hors motif, `encodeURIComponent` ; test § 9.2 |
| S10 / F20 `strict-origin` mal décrit | Mineur | § 7 corrigé ; « non prouvé » nommé |
| S11 `reprise` jamais remise | Mineur | § 6 étapes 3 et 5 |
| S12 / F4 tests aveugles, chrono non injectable | Important | § 5 `tentativeMs`/`repriseMs` injectés ; § 9 : double Entrée, réponse tardive, flux, formes, saisie longue, rendus neufs |
| S13 `onLine === false` = vérité | Mineur | § 6 : « Réessayer » force l'appel |
| F1 bloc R-UX-13 condamné | **Bloquant** | § 9 : bloc réécrit (ISBN valides, stub `search.json`, cas Google par `deps.cle`) |
| F3 aucun canal d'injection | **Bloquant** | § 6 : `deps` (4e paramètre), une seule convention |
| F5 langue morte à l'écran | Important | § 6 étape 4 : fusion sur `language: ''`, repli `'fr'` ; test |
| F7 « Changer d’ISBN » après `indisponible` | Important | § 6 : `saisirMain`/`retourIsbn` remettent `resultat`/`validation` ; test réécrit |
| F8 `scanner` non testable | Important | § 4 `codeBarresVersIsbn` pur ; chemin `pickFiles` hors lot |
| F10 deux pins, ordre de fusion | Important | § 8 |
| F11 inventaire des rouges attendus | Important | § 9 en tête |
| F12 `cleGoogle` | Important | § 6 : paramètre du modèle |
| F15 `enregistrer` sur la route | Important | § 9.6 : `withRepo` + `naviguer` injectée |
| F16 « deux chaînes » | Mineur | § 8 : une |
| F17 Réessayer « fermé », doublon « Saisir à la main » | Mineur | § 6 : absent pendant la recherche, un seul bouton |
| F18 `validation` collante | Mineur | § 6 étape 1 |
| F19 pire cas faux | Mineur | § 10 recalculé |
| F21 apostrophes | Mineur | convention en tête, textes § 6 |
| F24 délai de la couverture changé en silence | Mineur | § 5 : `tentativeMs` séparé, `delaiMs` 10 s intact |
| F25 U+2028 « même mécanique » | Mineur | § 9.7 : grep de `/verify` |
| F26 `surReprise` redessine | Mineur | § 6 étape 3 : nommé |
| F27 charge docs | Mineur | § 8 |

Constats **non retenus** : aucun. Constat **hors lot** : S4d (abandon au départ de la route), § 2.

### 11.2 Ce que la construction a amendé

(À remplir pendant la construction : une ligne par ruling R-ISBN-n.)
