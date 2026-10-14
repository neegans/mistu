# Identifier un livre, fiable — design (rév. 1, 14 octobre 2026)

Source : signalement de Neegan le 14 octobre (« ISBN 9781785035289 : le logiciel n'est pas capable de le retrouver »,
test fait **sur le Mac, site public**), diagnostic du même jour (mémoire `project_mistu_isbn_lookup_diagnostic_20261014`),
décisions prises en chat : **Google Books = case à clé, vide par défaut** ; lot livré sur la branche `isbn-fiable`, arbre
`~/projects/mistu-isbn` (serveur `http://localhost:8082/`), base `ajouter-livres-ux` @ `808aff8`. Le lot rejoint `main`
**après** le lot UX « Ajouter et livres » ; le site public ne change qu'à la fusion et au `git push` de Neegan.

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
   l'API actuelle (`search.json?isbn=`) donne en **un** appel titre, auteurs, éditeur, année, langue et ISBN frères.

Mécanismes plausibles du jour : Open Library limite à **1 requête/s par adresse IP** non identifiée (un navigateur ne peut
pas poser l'en-tête d'identification) ; sur Mac, Safari avec « Relais privé » ou un réseau partagé met beaucoup de monde
derrière la même adresse. Un 429 passager → « aucune fiche ». À cela s'ajoute un détail d'ergonomie : **Entrée** dans le
champ ISBN ne fait rien (pas de `<form>`), il faut cliquer « Identifier ».

Le lot répond à une seule question : **« Pourquoi mon livre n'est pas rempli, et qu'est-ce que je fais ? »** — en disant la
vraie raison, en offrant un geste (Réessayer, ou Saisir à la main), et en refusant tout de suite un ISBN mal tapé.

## 2. Périmètre et hors lot

**Dans le lot.** § 4 validation de l'ISBN avant tout appel · § 5 `lookupIsbn` à trois issues, sources Open Library actuelle
puis legacy, Google Books seulement avec clé, une reprise automatique · § 6 écran du pas 1 (messages vrais, « Réessayer »,
Entrée = Identifier) · § 7 clé Google Books publique, vide par défaut · § 8 versions, dictionnaire, CSP (inchangée).

**Hors du lot (mesuré, nommé pour ne pas y glisser).** BnF (SRU, CORS ouvert mais **0 livre québécois sur 6** : dépôt légal
français seulement) · Library of Congress (défi Cloudflare, 403) · BAnQ (500) · Wikidata (sans fiche) · la **couverture**
(§ 6 du lot UX, inchangée : toujours Open Library seule, demandée après une identification Open Library) · espacement des
appels pour la limite 1 req/s (rafale de 6 simultanées mesurée à 200 le 14 octobre : pas de douleur réelle) · mesure Safari
(WebKit absent du Playwright local, disque à 97 % : non téléchargé) · création de la clé Google (geste de Neegan, § 7).

## 3. Invariants

- **I-B (hérité).** Un état d'écran reflète un événement réel : « aucune fiche » n'est dit que si une source a **répondu**
  qu'elle n'en a pas ; « n'a pas répondu » n'est dit que si **aucune** source n'a répondu.
- **Aucune donnée inventée (hérité).** Une fiche reçue est proposée « à vérifier », jamais enregistrée seule.
- **Aucune clé privée dans le dépôt (hérité, R29).** La clé Google Books est **publique par conception** (restreinte par
  référent HTTP chez Google), au même titre que la clé publiable Supabase ; vide par défaut.
- **Aucun réseau dans la suite (hérité).** `fetch`, l'horloge d'attente et l'état « en ligne » sont injectés.
- **Aucun hôte nouveau.** `openlibrary.org`, `covers.openlibrary.org`, `www.googleapis.com` : CSP `connect-src 'self' https:`
  inchangée (R-UX-15).
- **I-R (nouveau).** Une reprise automatique n'a lieu que sur un échec **muet** (délai, réseau) ; un refus **parlé** (429,
  5xx, 4xx) n'est jamais réessayé par la machine — c'est la personne qui décide, par « Réessayer ».

## 4. Validation de l'ISBN — `src/core/isbn.js` (module neuf, pur)

`validerIsbn(texte)` → `{ ok: true, isbn13, isbn10 }` ou `{ ok: false, motif }`, avec `motif ∈ { 'vide', 'longueur',
'controle', 'pas_isbn' }`. Règles, après `nettoyerIsbn` (chiffres et X seulement, X admis en dernière position d'un 10) :

- longueur 10 : neuf chiffres + chiffre de contrôle 0-9 ou X ; somme pondérée 10→1 ≡ 0 (mod 11) ; sinon `controle` ;
  `isbn13` = `978` + les neuf chiffres + contrôle EAN recalculé ; `isbn10` = la forme tapée en majuscule.
- longueur 13 : treize chiffres ; préfixe `978` ou `979`, sinon `pas_isbn` (un code-barres de prix ou d'un autre produit) ;
  contrôle EAN (poids 1,3 alternés) sinon `controle` ; `isbn10` = conversion si `978`, `null` si `979`.
- toute autre longueur → `longueur` ; chaîne vide → `vide`. Un X ailleurs qu'en dernière position d'un 10 → `longueur`.

`nettoyerIsbn` déménage dans ce module et reste ré-exporté par `livre-ajout.js` (aucun autre importateur). **Ce qui est
enregistré** (`fabriquerLivre`) : `isbn13` quand la validation passe ; sinon la saisie nettoyée telle quelle (une saisie à la
main garde ce que la personne a tapé — I-B : on n'« arrange » pas). Les éditions existantes à dix chiffres ne bougent pas.

Le lecteur de code-barres (`scanner`) garde son filtre `/^97[89]\d{10}$/` et passe par la même `identifier` : un code lu
qui échoue au contrôle est traité comme un ISBN tapé faux (message § 6), pas comme « aucun ISBN lu ».

## 5. `lookupIsbn` — trois issues, trois sources au plus

**Signature.** `lookupIsbn(isbn13, { fetch = globalThis.fetch, signal, cle = GOOGLE_BOOKS.key, attendre = attenteReelle } = {})`
→ `{ statut, fiche, source, motif, appels }` :

- `statut ∈ { 'trouve', 'introuvable', 'indisponible' }` ;
- `source ∈ { 'openlibrary', 'googlebooks', null }` (`'openlibrary'` pour les deux points d'entrée Open Library : la
  provenance affichée et la couverture ne distinguent pas l'API) ;
- `motif` : `null` sauf `indisponible` → `'delai' | 'reseau' | 'limite' | 'serveur'` (le motif `'horsligne'` est posé par
  la route, § 6, sans appel) ;
- `fiche` : `{ title, author, publisher, year, language }` tronqués et bornés **comme aujourd'hui** (S3 : 300 caractères,
  année à quatre chiffres sinon `null`, corps > 256 Ko abandonné avant `JSON.parse`), `null` sinon ;
- `appels` : nombre de `fetch` faits (preuve des reprises et des sources non appelées).

**Un appel = un budget.** Chaque `fetch` reçoit **son propre** signal : `LIMITES_ISBN.delaiMs` = **8 000 ms** par tentative
(chrono interne, `AbortController` par tentative, relié au `signal` extérieur : l'abandon de la route abandonne la tentative
en vol). Les options S12 restent (`mode: 'cors'`, `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy:
'no-referrer'`) — **une exception nommée** pour Google Books, § 7.

**Classement d'un échec** (par tentative) : `fetch` qui rejette → `reseau` ; abandon par le chrono interne → `delai` ;
abandon par le signal extérieur → `delai` ; HTTP 429 → `limite` ; tout autre HTTP non 2xx → `serveur` ; corps > 256 Ko,
JSON invalide ou forme inattendue → `serveur`. Une réponse 2xx JSON **sans fiche** est une réponse (**« a répondu »**), pas un
échec.

**Ordre et règles.**
1. **Open Library, API actuelle** : `https://openlibrary.org/search.json?isbn=<isbn13>&fields=title,author_name,publisher,
   first_publish_year,language,isbn&limit=1`. `docs[0]` → `title`, `author` = `author_name.join(', ')`, `publisher` =
   `publisher[0]`, `year` = `first_publish_year`, `language` = `'fr'` si la liste contient `fre`, `'en'` si `eng` (le
   français d'abord quand les deux sont là), `null` sinon. `numFound === 0` → « a répondu, rien ».
   **Reprise (I-R)** : sur `delai` ou `reseau`, **une** seconde tentative après `LIMITES_ISBN.repriseMs` = **1 500 ms**
   (`attendre` injectée) ; jamais sur `limite`/`serveur`.
2. **Open Library, legacy** (`api/books?bibkeys=ISBN:<isbn13>&format=json&jscmd=data`, lecture **comme aujourd'hui**),
   **seulement** si 1 a répondu « rien » (l'index de recherche peut retarder sur une édition fraîche). Pas de reprise. Un
   échec ici ne change pas le statut : 1 a répondu. Le jour où ce point d'entrée disparaît, cette étape échoue en
   `serveur` sur les seuls « rien » — rien d'autre ne bouge.
3. **Google Books**, **seulement si `cle` est non vide** et si ni 1 ni 2 n'ont donné de fiche (réponse « rien » **ou**
   échec) : `https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn13>&maxResults=1&key=<cle>`, lecture comme
   aujourd'hui (`items[0].volumeInfo`, langue `fr`/`en` sinon `null`). Pas de reprise. Sans clé : **aucun appel**, `appels`
   ne compte rien.

**Agrégation.** Une fiche à n'importe quelle étape → `trouve` (la première gagne ; les étapes suivantes ne sont pas
appelées). Sinon : si **au moins une** étape a répondu → `introuvable` ; si **aucune** n'a répondu → `indisponible`, et
`motif` = celui de la **dernière tentative de l'étape 1** (l'étape 3, si elle a aussi échoué, ne renomme pas le motif : le
message nomme Open Library, § 6).

**Ce qui ne change pas.** `fusionnerFiche`, `OPTIONS_FETCH` (export inchangé), la provenance « Renseigné par Open Library /
Google Books — vérifie et corrige. », la couverture (demandée après `source === 'openlibrary'`, même mécanique R-UX-12/13).

## 6. Écran — pas 1 « Identifier »

**Modèle** `livreAjoutModel(etat)` gagne : `validation` (motif § 4 ou `null`), `resultat` (`{ statut, motif }` ou `null`),
`reprise` (booléen : seconde tentative en cours), `cleGoogle` (booléen, `!!GOOGLE_BOOKS.key`). Il rend en plus
`messages.validation`, `messages.indisponible`, `messages.sources`, et `peutReessayer` (`resultat?.statut === 'indisponible'
&& !recherche`). `messages.recherche` devient « Recherche… » ou « Nouvel essai… » (`reprise`).

**Route.** `identifier()` :
1. `validerIsbn(etat.isbn)` : `vide` → `toast('Saisis un ISBN d'abord.')` (comme aujourd'hui) ; `longueur`/`controle`/
   `pas_isbn` → `etat.validation`, redessin, **aucun appel**, on reste au pas 1.
2. `enLigne()` (injectée, défaut `navigator.onLine !== false`) faux → `etat.resultat = { statut: 'indisponible', motif:
   'horsligne' }`, **aucun appel**.
3. Sinon `etat.recherche = true`, `validation` et `resultat` remis à `null`, provenance et couverture remises à zéro
   (R-UX-13 inchangé), `AbortController` **extérieur** à `LIMITES_ISBN.totalMs` = **20 000 ms**, `lookupIsbn(isbn13, …)`.
   `reprise` est posée par un rappel `surReprise` passé à `lookupIsbn` (option `surReprise`, facultative) → redessin.
4. `trouve` → pas 2, champs fusionnés, provenance = source (inchangé). `introuvable` → pas 2, champs vides, provenance
   `'aucune'` (inchangé). **`indisponible` → on reste au pas 1**, `etat.resultat` posé, ISBN conservé.
5. `finally` : chrono extérieur levé, `recherche = false`, redessin.

**Gestes.** `reessayer` = `identifier` (même porte, mêmes règles — le bouton n'existe que si `peutReessayer`).
`changerIsbn` ne redessine pas (R-UX-9) : `validation` et `resultat` tombent au prochain `identifier`. `retourIsbn`
remet `resultat`, `validation` à `null` (inchangé pour le reste). Le champ ISBN reçoit `onKeydown` : **Entrée** →
`preventDefault()` + `identifier` (pas de `<form>` : un `submit` natif ferait naviguer le `#`).

**Textes** (`t()`, dictionnaire anglais § 8) :

| Quand | Texte |
|---|---|
| `validation = longueur` ou `controle` | « Cet ISBN n'est pas valide, vérifie les chiffres. » |
| `validation = pas_isbn` | « Ce code-barres n'est pas un ISBN. » |
| `indisponible / delai` | « Open Library n'a pas répondu à temps. » |
| `indisponible / reseau` | « Impossible de joindre Open Library. Vérifie ta connexion. » |
| `indisponible / limite` | « Open Library reçoit trop de demandes en ce moment. Attends quelques secondes. » |
| `indisponible / serveur` | « Open Library est en panne pour le moment. » |
| `indisponible / horsligne` | « Tu es hors ligne. » |
| `introuvable`, sans clé | « Aucune fiche chez Open Library pour cet ISBN. Complète à la main. » |
| `introuvable`, avec clé | « Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main. » |
| sous les boutons, sans clé | « L'ISBN est envoyé à Open Library. » |
| sous les boutons, avec clé | « L'ISBN est envoyé à Open Library, puis à Google Books si besoin. » (inchangé) |
| pendant la reprise | « Nouvel essai… » |

Mise en page du pas 1 : première ligne et champ inchangés ; `messages.validation` sous le champ (`.muted`, pas de carte
rouge) ; la rangée de boutons inchangée (« Scanner le code-barres », « Identifier », « Saisir à la main ») ; **sous la
rangée**, quand `resultat` est `indisponible` : le message, puis un bouton `.btn.primary` **« Réessayer »** (`data-role=
"reessayer"`) ; « Saisir à la main » reste offert à côté. Pendant `recherche` : « Identifier » et « Réessayer » fermés, le
message « Recherche… »/« Nouvel essai… » visible. Aucun `logError`, aucune carte rouge pour une identification qui échoue
(c'est un état ordinaire, pas une erreur du programme).

Le site public (`main`, `src/ui/add.js` d'avant le lot UX) n'est **pas** touché : il disparaît à la fusion du lot UX.

## 7. Clé Google Books — publique, vide par défaut

`src/sync/config.js` (le fichier des valeurs publiques par conception) exporte en plus :

```js
export const GOOGLE_BOOKS = { key: '' }; // vide = Google Books jamais appelé
```

**Pourquoi c'est public.** Une clé d'API Google **restreinte par référent HTTP** (`https://neegans.github.io/*`,
`http://localhost:8082/*`…) n'ouvre rien à qui la copie ailleurs ; c'est le même modèle que `sb_publishable_…`. Quota
gratuit 1 000 requêtes/jour ; abus visible dans la console Google ; rotation = remplacer la chaîne.

**L'exception S12.** Avec `referrerPolicy: 'no-referrer'`, Google ne reçoit **aucun** référent et **refuse** une clé
restreinte par référent. L'appel Google Books (et lui seul) part donc avec `referrerPolicy: 'strict-origin'` : l'origine
seule (`https://neegans.github.io/`), jamais le chemin ni le `#` ; rien n'est envoyé si la page n'est pas en HTTPS (hors
`localhost`, que les navigateurs traitent comme sûr). Affirmé par un test (espion sur les options du troisième `fetch`).

**Geste de Neegan (pas dans ce lot, documenté dans `docs/google-books.md`, dix lignes)** : projet Google Cloud
`cuisine-os-neegan` → activer « Books API » → Identifiants → clé d'API → restriction « Sites web » avec les référents
ci-dessus → restriction d'API « Books API » → coller la clé dans `GOOGLE_BOOKS.key` → `SHELL` inchangé, `VERSION` incrémentée.
Tant que la case est vide, le lot vit avec Open Library seule — c'est l'état livré.

## 8. Données, versions, dictionnaire, CSP

| Élément | Changement |
|---|---|
| Base locale / serveur / archive | **aucun** : `book_editions.isbn` reste un texte (13 chiffres pour une saisie valide) ; `DB_VERSION` inchangée ; `--check` reste 0 |
| `src/core/isbn.js` | module neuf → entrée dans `SHELL` |
| `src/sync/config.js` | `GOOGLE_BOOKS` ajouté (pas de changement pour `SUPABASE`/`currentConfig`) |
| `src/model/schema.js` | `APP_VERSION = '0.4.1'` |
| `sw.js` | `VERSION = 'cuisine-os-v0.4.1-1'` ; le pin structurel de `tests/ajouter.js` passe à `v0\.4\.1-\d+` et `'0.4.1'` |
| `src/i18n/en.js` | chaque chaîne neuve de § 6 a son entrée ; les deux chaînes retirées (« Aucune fiche trouvée pour cet ISBN. Complète à la main. », rien d'autre) sont retirées du dictionnaire |
| CSP (`index.html`, `tests/index.html`) | **inchangée** (`connect-src 'self' https:`, R-UX-15) |
| `docs/architecture.md`, `CLAUDE.md` | une sous-section « Identifier un livre, fiable » (ce qui est livré, ce qui n'est pas prouvé, dettes) |
| `docs/google-books.md` | procédure § 7 |
| `docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md` | **pas modifiée** : ce lot a sa spec ; § 5 de l'autre reste l'histoire du 13 octobre |

## 9. Ce que la suite de tests doit prouver (rouge d'abord)

Même harnais que le lot UX (`tests/ajouter.js`, bloc « § 5 Ajouter un livre en deux pas » réécrit ; `fetch` injecté,
`attendre` injectée = **aucune vraie attente**, `enLigne` injectée, gestes réels sur la route avec `globalThis.fetch`
stubbé et restauré en `finally`).

1. **`validerIsbn`** : `0306406152` → `{ ok, isbn13: '9780306406157', isbn10: '0306406152' }` ; `080442957X` (X) ok ;
   `9782890772816` ok, `isbn10: '2890772810'` ; `9791234567896` (979) ok, `isbn10: null` ; `9781785035280` → `controle` ;
   `5901234123457` (EAN non livre) → `pas_isbn` ; `978178503528` (12) → `longueur` ; `' 978-1-78503-528-9 '` ok (nettoyage) ;
   `''` → `vide` ; `12345678X9` → `longueur`.
2. **`lookupIsbn`, statuts** (une réponse factice par adresse) : search 200 + doc → `trouve` / `openlibrary` / `appels 1`,
   `language 'fr'` quand `['eng','fre']` ; search 200 `numFound 0` + legacy fiche → `trouve` / `appels 2` ; search 0 +
   legacy `{}` → `introuvable` / `appels 2` / `motif null` ; search 0 + legacy **rejette** → `introuvable` quand même ;
   search rejette **deux fois** → `indisponible` / `reseau` / `appels 2` (reprise comptée) et `attendre` appelée **une**
   fois avec 1 500 ; search rejette puis répond → `trouve` / `appels 2` ; search 429 → `indisponible` / `limite` /
   `appels 1` (**aucune** reprise, `attendre` jamais appelée) ; search 503 → `serveur` / `appels 1` ; search à corps
   > 256 Ko → `serveur` ; chrono interne : un `fetch` qui n'aboutit jamais, horloge factice → `delai`, et `signal.aborted`
   vrai sur le signal reçu par ce `fetch` ; signal extérieur abandonné pendant la tentative → `delai`, aucune reprise.
3. **`lookupIsbn`, Google** : sans clé, search 0 + legacy `{}` → `appels 2`, **aucune** adresse `googleapis` vue ; avec
   `cle: 'k'` → troisième appel, adresse contenant `key=k` et `q=isbn:`, options `{ …OPTIONS_FETCH, referrerPolicy:
   'strict-origin', signal }` (les options des appels Open Library restent `no-referrer`) ; Google 200 + item → `trouve`
   / `googlebooks` ; Google 429 après deux « rien » → `introuvable` (une source a répondu) ; **tout** rejette avec clé →
   `indisponible` / motif de l'étape 1.
4. **Modèle** : `livreAjoutModel({ validation: 'controle' })` → `messages.validation` ; `{ resultat: { statut:
   'indisponible', motif: 'limite' } }` → `messages.indisponible` au texte voulu et `peutReessayer` vrai ; `recherche`
   vrai → `peutReessayer` faux ; `reprise` → « Nouvel essai… » ; `cleGoogle` → les deux phrases « sources » et les deux
   « introuvable ».
5. **Route** (fetch stubbé) : ISBN faux → **aucun** appel, message visible, pas 1, le champ garde sa valeur ; `enLigne`
   faux → aucun appel, « Tu es hors ligne. », bouton « Réessayer » présent ; search 429 → pas 1, message « trop de
   demandes », « Réessayer » présent, **puis** le stub passe à 200 et « Réessayer » → pas 2, provenance Open Library ;
   **Entrée** dans le champ (`keydown`, `key: 'Enter'`) → l'appel part ; `← Changer d'ISBN` après un `indisponible` →
   message disparu ; `scanner` avec un code lu au contrôle faux (`BarcodeDetector` factice) → message « pas valide »,
   aucun appel ; la couverture est demandée après un `trouve` par **search** (et pas avant) ; `enregistrer` après un
   `trouve` écrit `isbn: '<13>'` (espion `saveBatch`) ; une saisie à la main avec `12345` écrit `'12345'`.
6. **Statique** : `SHELL` contient `./src/core/isbn.js` ; `VERSION` au motif `v0\.4\.1-\d+` ; `APP_VERSION '0.4.1'` ;
   chaque `t('…')` littéral de `isbn.js`, `livre-ajout.js` et des chaînes neuves a son entrée `en.js` (même mécanique F13)
   ; la chaîne retirée n'est plus dans `en.js` ; `GOOGLE_BOOKS.key === ''` **dans le dépôt** (un test lit `config.js` :
   la case livrée est vide) ; aucun `html:`/`innerHTML`/`window.open` dans `isbn.js` ; U+2028/2029 = 0 ; CSP affirmée
   inchangée (R-UX-15).

**Mesures réelles (au plan, avant « vert »)** sur `http://localhost:8082/` : `9781785035289` et `9782890772816` →
« Renseigné par Open Library », champs remplis, **une** requête `search.json` chacune (journal réseau) ; `9781785035280`
→ refusé, **zéro** requête ; `context.setOffline(true)` → « Tu es hors ligne. » + « Réessayer », zéro requête ;
`setOffline(false)` + « Réessayer » → trouvé. Après fusion et `push` de Neegan : les deux ISBN depuis le site public.

## 10. Risques et décisions ouvertes

- **Qualité des champs de `search.json`** : données au niveau de l'**œuvre** (éditeurs de toutes les éditions, première
  année de parution), pas de l'édition tenue en main. Accepté : la fiche est « à vérifier », et le legacy ne sert plus
  qu'en filet. Si le legacy disparaît, on perd ce filet sur les éditions fraîches — rien d'autre.
- **Deux appels Open Library d'affilée** sur un « rien » (search puis legacy) face à la limite 1 req/s : mesuré sans
  effet sur une rafale de six ; si un 429 apparaît sur le legacy, le statut reste `introuvable` (vrai : search a répondu).
- **`navigator.onLine`** : `false` est fiable (vraiment hors ligne) ; `true` ne garantit rien — d'où `reseau` qui reste
  possible après ce contrôle.
- **Pire cas de durée** : 8 s + 1,5 s + 8 s (étape 1 et sa reprise) + 8 s (legacy) + 8 s (Google) = 33,5 s > `totalMs`
  20 s : le chrono extérieur coupe à 20 s en `delai`. Choix assumé : mieux vaut une réponse vraie à 20 s qu'un écran
  muet à 34 s.
- **Clé Google publique** : exposée par conception ; sa protection est la restriction par référent **et** la restriction
  d'API. Une clé sans restriction ne doit **jamais** être collée (dit dans `docs/google-books.md`).
- **Safari / iPhone** non mesurés (pas de WebKit ici) : `AbortController`, `keydown`, `navigator.onLine` sont standard ;
  la preuve sur appareil reste un geste de Neegan, comme pour le lot UX.
- **Code-barres au contrôle faux** : le filtre `/^97[89]\d{10}$/` du lecteur accepte un EAN valide à préfixe 978/979
  mais pas un ISBN ; `validerIsbn` le prend ensuite. Un vrai ISBN mal lu (chiffre flou) finit « pas valide » : la
  personne retape ; on ne corrige rien à sa place.

## 11. Traçabilité des revues

À remplir après la revue adverse (faisabilité et sécurité) ; chaque constat reçoit une réponse ici, et ce qui change dans
la spec est marqué « (S·/F·) ». Les amendements de construction iront en **§ 11.2** (rulings R-ISBN-n).
