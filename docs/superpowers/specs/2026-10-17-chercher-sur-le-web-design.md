# Chercher sur le web — design (rév. 1, 17 octobre 2026)

Source : brainstorm des 16 et 17 octobre. Le 16, l'onglet « Web » de la recherche a été mesuré : coquille « Le Web n’est pas
activé », aucune requête ne sort de l'app, « saumon fenouil » est compris (filtres saumon + fenouil) mais ne cherche que la
bibliothèque. Le 17, Neegan a tranché trois choses : **le but est l'intelligence artificielle** (pas un moteur de recherche) ;
l'assistant rapporte **des recettes trouvées sur le web sous forme de liens vérifiables** (pas une fiche complète, pas une
recette composée, pas une conversation) ; son assistant est **Anthropic, clé déjà entrée** dans Réglages → Assistant IA.
Le design en huit rulings W-1 à W-8 a reçu « go » en chat. Lot construit sur la branche `recherche-web`, arbre
`~/projects/mistu-web` (serveur `http://localhost:8083/`), base `main` @ `e4e841b` (lot ISBN fusionné, suite 1537/1537,
total épinglé 1536). Le site public ne change qu'à la fusion et au `git push` de Neegan.

**Convention d'écriture.** Les textes d'interface cités entre « » sont les clés `t()` **exactes**, avec l'apostrophe
typographique (U+2019) comme tout `en.js` ; la prose de cette spec garde l'apostrophe droite. Les messages de commit
restent en ASCII sans accents. Jamais `git add -A` (`.superpowers/` non suivi).

## 1. Le problème, du côté de la personne

Neegan écrit « saumon fenouil » dans la recherche, ouvre l'onglet Web et lit que le Web n'est pas activé. Il n'a rien de
plus qu'avec sa bibliothèque. Ce qu'il veut : que l'assistant qu'il a déjà configuré aille chercher pour lui des pages de
recettes qui répondent à sa demande, qu'il puisse les ouvrir, et garder celles qui valent la peine dans sa bibliothèque.

Ce que l'app sait déjà faire, et que le lot réutilise :

- un **assistant IA** fournisseur-agnostique (`src/domain/llm.js`), réglé dans Réglages → Assistant IA, clé gardée sur
  l'appareil, **exclue des sauvegardes** (`tests/backup.js`) et **jamais synchronisée** (le magasin `settings` n'est pas
  dans `src/sync/`) ; il lit aujourd'hui des pages photographiées et des index ;
- un **lien externe** ouvert dans un nouvel onglet (`src/ui/recipe.js`, « Ouvrir le lien », `target="_blank"`,
  `rel="noopener noreferrer"`) ;
- un **signet** « Garder un lien web » (`src/ui/signet.js`, route `#/add/signet`) qui transforme adresse + titre en
  recette-référence, et une aide pure `lienSignet` (`src/core/lien.js`) qui n'accepte que `http:`/`https:`, retire les
  identifiants collés dans l'adresse et rend l'hôte en punycode.

Ce que l'API Anthropic permet : un **outil de recherche web côté serveur** (`web_search_20250305`). L'app envoie la
demande avec l'outil déclaré ; le serveur cherche ; la réponse porte, **à part du texte de l'assistant**, la liste brute des
pages trouvées (`web_search_result` : `url`, `title`, `page_age`). C'est cette liste qui permet de tenir « rien d'inventé ».
Tarif : 10 $ par 1 000 recherches, plus les jetons ; `usage.server_tool_use.web_search_requests` compte les recherches.
Si un administrateur a désactivé la recherche web sur le compte, la requête échoue en 400 « not enabled ».

## 2. Périmètre et hors lot

**Dans le lot.**

1. Mode « Web » de la recherche : un bouton explicite qui lance **un** appel à l'assistant avec l'outil de recherche web.
2. Affichage de 5 liens au plus, tous présents dans les résultats bruts du serveur, avec « pourquoi ça colle ».
3. « Garder ce lien » → route signet **préremplie** (adresse + titre) ; rien n'est enregistré sans le geste de la personne.
4. Trois issues distinctes : trouvé, rien trouvé, indisponible (avec « Réessayer » quand ça a du sens).
5. Garde du fournisseur : non configuré, compatible OpenAI (ne cherche pas), Anthropic.
6. Module neuf `src/domain/recherche-web.js`, petit ajout à `llm.js`, `search.js`, `signet.js`, `en.js`, `sw.js`,
   `schema.js`, tests, docs.

**Hors du lot (nommé pour ne pas y glisser).** Lire la page trouvée pour en tirer une fiche recette (= « Une fiche
recette complète », écartée le 17 octobre ; lot suivant naturel) · recherche web par un fournisseur compatible OpenAI ·
stockage ou historique des résultats · recherche automatique sans tape · `web_fetch`, conversation, flux (`stream`) ·
reprise d'un `pause_turn` (un seul appel, on lit ce qu'il a rendu) · résultats web dans le mode « Tout » · filtres de
domaines réglables · changement du modèle ou de la clé (Réglages existants) · Safari/iPhone (aucun WebKit ici ; preuve
par Neegan).

## 3. Invariants

- **I-A Rien d'inventé.** Un lien ne s'affiche que si son adresse figure dans un bloc `web_search_result` de la réponse.
  Le texte de l'assistant ne peut ni ajouter une adresse ni en changer le titre. Si l'assistant ne rend pas de choix
  lisible, l'app liste les résultats bruts tels quels, sans « pourquoi ».
- **I-B Aucune requête sans tape.** Le rendu du mode Web ne fait aucun appel réseau. Seul le bouton (ou « Réessayer »)
  déclenche l'appel ; champ vide = bouton éteint.
- **I-C La clé reste sur l'appareil.** Elle part dans l'en-tête `x-api-key` de l'appel, jamais dans une adresse, un texte
  d'écran, une erreur affichée, une sauvegarde ou la synchro. Ce qui part chez Anthropic : la demande tapée, les filtres
  compris (type, restrictions, durée), la langue de l'interface, le pays `CA` et le fuseau de l'appareil. **Rien de la
  bibliothèque.**
- **I-D CSP inchangée.** `connect-src 'self' https:` couvre déjà `api.anthropic.com`. Aucun script, style ou image
  externe.
- **I-E Déterministe avant IA.** La lecture de la réponse et le choix des liens sont des fonctions pures, testées sur des
  réponses fixes. L'état de l'écran reflète l'issue de l'appel, jamais une supposition.
- **I-F Trois issues, trois textes.** « Rien trouvé » n'est dit que si l'appel a réussi et n'a rapporté aucune page.
  Tout le reste est « indisponible », avec la raison la plus précise connue.
- **I-G Aucun stockage.** Les résultats vivent dans l'état de la page ; changer la demande les efface.
- **I-H Rendu sûr.** Tout texte passe par `el()` (nœuds texte, jamais `innerHTML`). Chaque adresse est revalidée **au
  rendu** par `lienSignet` : `http:`/`https:` seulement, identifiants retirés, hôte recalculé. Une adresse refusée par
  `lienSignet` n'est pas affichée du tout.
- **I-I Un appel en vol par page.** Une nouvelle tape ou un changement de demande rend muette la réponse de l'appel
  précédent (compteur de génération, comme R-ISBN-8).
- **I-J Le texte libre de l'assistant est borné.** Seul « pourquoi ça colle » est montré, par lien, tronqué à 200 points de
  code, caractères de contrôle et de format (Cc/Cf) retirés. Le reste du texte n'est jamais rendu.

## 4. `src/domain/recherche-web.js` — module neuf

Dépendances : `parseJsonLoose`, `ANTHROPIC_MESSAGES_URL`, `anthropicHeaders` depuis `llm.js` ; `lienSignet` depuis
`core/lien.js`. Aucun import d'interface.

### 4.1 `construireDemande({ q, parsed, langue })` → `{ system, user }` (pure)

- `q` borné à 500 points de code, Cc/Cf retirés ; vide après nettoyage → `TypeError` (l'écran n'appelle pas).
- `user` : la demande, puis une ligne par filtre compris et non vide : type (`parsed.filters.type`), restrictions
  (`parsed.filters.diets`), durée maximale (`parsed.filters.max_total_minutes`), ingrédients à inclure/exclure
  (`include`/`exclude`, libellés tels que `parseQuery` les rend). Rien d'autre du contexte.
- `system` (texte fixe, en français quand `langue === 'fr'`, en anglais sinon) : rôle « tu trouves des pages de recettes sur
  le web pour Cuisine OS » ; **cherche toujours sur le web** (1 à 3 recherches) ; préfère les pages de recettes complètes,
  en français du Québec d'abord quand la langue est `fr` ; puis **réponds uniquement** par un objet JSON
  `{"choix":[{"url":"…","pourquoi":"…"}]}` de 5 entrées au plus, dont chaque `url` est **l'adresse exacte d'une page
  trouvée par la recherche** ; n'invente ni page ni adresse ; `pourquoi` = une phrase courte qui relie la page à la demande.

### 4.2 `corpsRequete({ cfg, demande })` → objet JSON (pure)

```js
{ model: cfg.model, max_tokens: 4096, system: demande.system,
  messages: [{ role: 'user', content: demande.user }],
  tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3,
            user_location: { type: 'approximate', country: 'CA', timezone } }] }
```

- `timezone` = `Intl.DateTimeFormat().resolvedOptions().timeZone` si c'est une chaîne non vide, sinon omis.
- **Pas** de `thinking` (défaut du modèle), **pas** de `output_config.format` (incompatible avec les citations toujours
  actives de la recherche web), **pas** de `allowed_callers` (défaut `direct` sur `web_search_20250305`), pas de `stream`.
- La version `web_search_20250305` est choisie **parce qu'elle vaut pour tous les modèles** et rend la liste brute
  complète ; les versions à filtrage dynamique cachent une partie des résultats dans des blocs d'exécution de code et
  exigent un modèle qui les prend en charge — le modèle de Neegan est un texte libre dans Réglages.

### 4.3 `lireReponse(json)` → `{ resultats, erreursOutil, texte, stopReason, recherches }` (pure)

- `resultats` : tous les blocs `content[].type === 'web_search_tool_result'` dont `content` est un **tableau** → chaque
  entrée `type === 'web_search_result'` avec `url` chaîne non vide → `{ url, titre: title chaîne ou '', date: page_age
  chaîne ou null }`, dans l'ordre, **dédoublonnés par `href` normalisé** (`lienSignet(url).href`) ; une adresse refusée par
  `lienSignet` est ignorée.
- `erreursOutil` : les `content` qui sont un **objet** → `error_code` (chaîne) ; sinon rien.
- `texte` : concaténation des blocs `type === 'text'` (chaîne), séparés par un saut de ligne.
- `stopReason` : `json.stop_reason` chaîne ou null ; `recherches` : `json.usage.server_tool_use.web_search_requests` si
  entier ≥ 0, sinon null.
- Toute forme hostile (`content` absent ou non tableau, bloc sans `type`, champs du mauvais type) est ignorée, jamais
  levée.

### 4.4 `choisirLiens(lu, { max = 5 } = {})` → `{ liens, repli }` (pure)

1. Tente `parseJsonLoose(lu.texte)` ; `choix` doit être un tableau. Pour chaque entrée avec `url` chaîne :
   `href = lienSignet(url).href` ; gardée **seulement si** un résultat de `lu.resultats` a le même `href`. Titre et date
   viennent **du résultat**, jamais du choix. `pourquoi` : chaîne tronquée à 200 points de code, Cc/Cf retirés, ou null.
   Dédoublonnage par `href`, ordre des choix, `max` au plus.
2. Si le JSON est illisible, si `choix` manque ou si aucune entrée ne survit → `repli = true`, `liens` = les `max` premiers
   `lu.resultats` avec `pourquoi: null`.
3. Chaque lien rendu : `{ href, hote, titre, date, pourquoi }` (`hote` = `lienSignet(href).hote`). Titre vide → `hote`.

### 4.5 `chercherRecettesWeb({ q, parsed, langue, cfg }, deps = {})` → issue

`deps` : `fetch` (défaut `globalThis.fetch`), `enLigne` (défaut `() => navigator.onLine !== false`), `tentativeMs`
(défaut **45 000** : une à trois recherches côté serveur prennent couramment 10 à 30 s), `corpsMax` (défaut 2 Mio :
`encrypted_content` est volumineux), `AbortController` (défaut global).

Issues, dans cet ordre de décision :

| `etat` | `raison` | Quand |
|---|---|---|
| `non_configure` | — | `cfg.provider` absent ou `'none'`, ou `api_key`/`model` vides. Aucun appel. |
| `non_pris_en_charge` | — | `cfg.provider !== 'anthropic'`. Aucun appel. |
| `indisponible` | `hors_ligne` | `enLigne()` faux. Aucun appel. |
| `indisponible` | `delai` | abandon par `AbortController` après `tentativeMs` (corps compris). |
| `indisponible` | `reseau` | `fetch` lève (hors abandon). |
| `indisponible` | `cle_refusee` | statut 401 ou 403. |
| `indisponible` | `recherche_desactivee` | statut 400 et corps (texte, borné) contenant `web search` ou `web_search` et `not enabled`. |
| `indisponible` | `requete` | autre 400, 404, 413, 422. |
| `indisponible` | `trop_de_demandes` | statut 429, ou `erreursOutil` contient `too_many_requests` sans aucun résultat. |
| `indisponible` | `serveur` | statut 5xx (529 compris). |
| `indisponible` | `reponse_illisible` | corps > `corpsMax`, JSON invalide, ou `content` non tableau. |
| `indisponible` | `refus` | `stopReason === 'refusal'` (modèles récents : HTTP 200 avec refus). |
| `indisponible` | `outil` | `erreursOutil` non vide **et** aucun résultat (autres codes : `unavailable`, `invalid_tool_input`, …). |
| `rien` | — | appel réussi, aucun résultat (listes vides **ou** l'assistant n'a pas cherché). |
| `trouve` | — | au moins un résultat → `liens` par § 4.4. Une erreur d'outil **après** des résultats (ex. `max_uses_exceeded`) est ignorée. |

Retour : `{ etat, raison, liens, repli, recherches, modele: cfg.model }`. `liens` est `[]` hors `trouve`. **Aucun texte de
l'API n'est recopié dans l'issue** (I-C, I-J) : les corps d'erreur servent au classement, pas à l'écran.

## 5. Écran — mode Web de `src/ui/search.js`

Signature : `renderSearch(params, query, ctx, deps = {})`, `deps.chercher` (défaut `chercherRecettesWeb`) et
`deps.enLigne` ; une seule convention d'injection, celle du lot ISBN (F3).

État ajouté : `state.web = { gen: 0, enCours: false, issue: null, pourQ: '' }`. `run()` (nouvelle demande) remet
`issue = null`, `pourQ = ''` et incrémente `gen` (I-G, I-I). Le bloc `if (state.mode === 'web')` remplace la coquille par
`renderWeb()` :

1. **Fournisseur absent** (`ctx.settings.llm.provider` vide ou `'none'`) : `status warn` « Pour chercher sur le web,
   configure l’assistant IA. » + bouton « Réglages » (`#/settings`), même forme que `aiNotice`. Fin.
2. **Fournisseur compatible OpenAI** : `status warn` « Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans
   Réglages → Assistant IA. » + « Réglages ». Fin.
3. **Anthropic** : carte avec le bouton « Chercher sur le web avec l’assistant » (`disabled` si `state.q` vide ou si
   `enCours`), sous-ligne `muted` « Une recherche = un appel à ton compte Anthropic. » ; champ vide → petite ligne
   « Écris d’abord ce que tu cherches. ».
4. **Tape** : `gen += 1`, `enCours = true`, `pourQ = state.q`, redessin (« L’assistant cherche sur le web… »), puis
   `await deps.chercher({ q, parsed: state.parsed, langue: getUiLocale(), cfg: ctx.settings.llm }, { enLigne })`. Au retour :
   si `gen` a changé → **rien** ; sinon `enCours = false`, `issue = retour`, redessin.
5. **`trouve`** : section « Trouvé sur le web », une carte par lien : `a` (`class btn`, `href = lien.href`,
   `target="_blank"`, `rel="noopener noreferrer"`) avec le titre ; ligne `muted` hôte (+ « · » + date si connue) ;
   `pourquoi` si présent ; bouton « Garder ce lien » → `navigate('/add/signet' + buildQuery({ adresse: lien.href,
   titre: lien.titre }))`. Sous la liste : « Recherches faites par l’assistant : {n} » si `recherches` connu ;
   « Liens tels que trouvés, sans tri de l’assistant. » si `repli`.
6. **`rien`** : `status` « Aucune page trouvée pour cette demande. Reformule ou cherche autrement. » + « Réessayer ».
7. **`indisponible`** : `status warn` selon `raison` — `hors_ligne` : « Tu es hors ligne. » (clé existante) ;
   `cle_refusee` : « Ta clé Anthropic a été refusée. Vérifie-la dans Réglages → Assistant IA. » + « Réglages » ;
   `recherche_desactivee` : « La recherche web n’est pas activée sur ton compte Anthropic. » + « Réglages » ;
   `trop_de_demandes` : « Trop de demandes pour l’instant. Réessaie dans une minute. » ; `refus` : « L’assistant a refusé
   cette demande. » ; toute autre raison : « L’assistant n’a pas répondu. Réessaie. ». « Réessayer » accompagne toutes
   les raisons sauf `cle_refusee`, `recherche_desactivee` et `refus`. « Réessayer » refait exactement le pas 4.
8. Les modes `recipes`, `books`, `all` ne changent pas : aucun lien web n'y apparaît.

## 6. Signet prérempli — `src/ui/signet.js`

`renderSignetRoute` lit `query.adresse` et `query.titre` (chaînes, tronquées à `LIMITES_SIGNET`) dans `etat` **avant** le
premier dessin. Une adresse préremplie passe par la même validation qu'une adresse tapée : si `lienSignet` la refuse, le
champ la montre et l'erreur s'affiche (le champ n'est pas vide). Rien n'est écrit en base avant « Enregistrer ».

## 7. Fournisseur — `src/domain/llm.js`

- `LLMProvider` : `get supportsWebSearch() { return false; }` ; `AnthropicProvider` : `true`.
- Exports neufs : `ANTHROPIC_MESSAGES_URL` (`https://api.anthropic.com/v1/messages`) et `anthropicHeaders(apiKey)` →
  `{ 'content-type', 'x-api-key', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }`.
  `AnthropicProvider.complete` les utilise : refactor **à comportement inchangé** (même URL, mêmes en-têtes, même corps).
- Le modèle reste `cfg.model` tel que tapé par Neegan. Rien d'autre ne change dans `llm.js`.

## 8. Données, versions, dictionnaire, CSP, docs

- **Aucun** changement de schéma, aucune migration, aucun réglage neuf. `tools/generer-migrations.mjs --check` reste 0.
- `src/model/schema.js` : `APP_VERSION = '0.5.0'` (nouvelle capacité réseau). `sw.js` : `VERSION = 'cuisine-os-v0.5.0-1'`,
  `SHELL` += `'./src/domain/recherche-web.js'` (le test « SHELL complet » de `tests/sync.js` rougit sinon).
- `src/i18n/en.js` : une clé par texte « » des § 5 et 6, avec l'apostrophe U+2019. Liste à tenir : « Pour chercher sur le
  web, configure l’assistant IA. » · « Ce fournisseur ne cherche pas sur le web. Choisis Anthropic dans Réglages →
  Assistant IA. » · « Chercher sur le web avec l’assistant » · « Une recherche = un appel à ton compte Anthropic. » ·
  « Écris d’abord ce que tu cherches. » · « L’assistant cherche sur le web… » · « Trouvé sur le web » · « Garder ce lien »
  · « Recherches faites par l’assistant : {n} » · « Liens tels que trouvés, sans tri de l’assistant. » · « Aucune page
  trouvée pour cette demande. Reformule ou cherche autrement. » · « Ta clé Anthropic a été refusée. Vérifie-la dans
  Réglages → Assistant IA. » · « La recherche web n’est pas activée sur ton compte Anthropic. » · « Trop de demandes pour
  l’instant. Réessaie dans une minute. » · « L’assistant a refusé cette demande. » · « L’assistant n’a pas répondu.
  Réessaie. » · « Réessayer » (existe déjà : vérifier). La clé « Le Web n’est pas activé : … » est **retirée** de
  `search.js` et de `en.js`.
- CSP : inchangée (I-D). `index.html` n'est pas touché.
- Docs : `docs/architecture.md` (module, rulings W-1…W-8, « déterministe avant IA » étendu à la recherche web),
  `CLAUDE.md` (section du lot : fait, non prouvé, dettes), `STATE.md` à la pause. Total épinglé `tests/tests.js` : lu dans
  « obtenu : X » puis posé, jamais deviné.

## 9. Ce que la suite de tests doit prouver (rouge d'abord)

Fichier neuf `tests/recherche-web.js` exportant `runRechercheWebTests({ eq, ok })`, enregistré dans `tests/tests.js` avec
le même `try/catch` que les autres suites. Réponses d'API **fixes** dans le fichier (jamais de réseau).

- **9.1 `lireReponse`.** Deux blocs `web_search_tool_result` (3 + 2 résultats, un doublon par `href`, un `url` `ftp:`) →
  4 résultats dans l'ordre, titre/date typés ; `content` objet `error_code` → `erreursOutil` ; liste vide → 0 ;
  `usage` absent → `recherches: null` ; texte concaténé ; `content` racine non tableau → résultats vides sans lever.
- **9.2 `choisirLiens`.** 3 choix dont un `url` hors résultats → 2 liens dans l'ordre des choix, titres **des résultats** ;
  choix avec `user:pass@` → `href` sans identifiants et retrouvé ; `pourquoi` de 300 points de code avec un U+200B →
  200, sans Cc/Cf ; JSON illisible → `repli` et 5 premiers résultats, `pourquoi: null` ; `choix: []` → repli ; 7 choix
  valides → 5 ; doublon de choix → 1.
- **9.3 `chercherRecettesWeb` avec `fetch` factice.** Forme du corps (modèle, `tools[0].type === 'web_search_20250305'`,
  `max_uses === 3`, `user_location.country === 'CA'`, `system` non vide, `user` contient `q` et « sans gluten » quand
  `parsed.filters.diets = ['sans_gluten']`, **aucun** `thinking`, `output_config`, `stream`) ; en-têtes `x-api-key` égal à
  la clé et `anthropic-dangerous-direct-browser-access: 'true'` ; l'URL appelée ne contient pas la clé ; `provider: 'none'`
  → `non_configure` et **0 appel** ; `openai_compatible` → `non_pris_en_charge`, 0 appel ; `enLigne: () => false` →
  `hors_ligne`, 0 appel ; 401 → `cle_refusee` ; 400 « Web search is not enabled » → `recherche_desactivee` ; 400 autre →
  `requete` ; 429 → `trop_de_demandes` ; 529 → `serveur` ; `fetch` qui lève → `reseau` ; abandon (signal `aborted`, chrono
  injecté) → `delai` ; corps > `corpsMax` → `reponse_illisible` ; `stop_reason: 'refusal'` → `refus` ; `too_many_requests`
  sans résultat → `trop_de_demandes` ; `unavailable` sans résultat → `outil` ; `max_uses_exceeded` **avec** 2 résultats →
  `trouve` 2 liens ; listes vides → `rien` ; aucun bloc outil → `rien` ; cas nominal → `trouve`, `recherches: 2`,
  `modele` recopié. **L'issue ne contient jamais la clé ni un extrait du corps.**
- **9.4 Écran (rendus DOM à gestes injectés, `deps.chercher` factice qui compte ses appels).** `llm.provider: 'none'` →
  texte « Pour chercher sur le web, configure l’assistant IA. » + lien `#/settings`, 0 appel ; `openai_compatible` → texte
  dédié ; `anthropic` + `q` vide → bouton `disabled`, « Écris d’abord ce que tu cherches. », 0 appel au rendu ; `q` =
  « saumon fenouil » → tape → **1** appel avec `q` et `cfg` ; pendant l'attente bouton `disabled` et « L’assistant cherche
  sur le web… » ; réponse tardive de la génération 1 après une seconde tape → écran de la génération 2 seulement ;
  `trouve` → une `a[target="_blank"][rel="noopener noreferrer"]` par lien, `href` égal à `lien.href`, texte = titre, hôte
  affiché, « Garder ce lien » → `navigate` reçoit `/add/signet?adresse=…&titre=…` encodés ; `repli` → ligne « Liens tels
  que trouvés… » ; `rien` → texte + « Réessayer » qui rappelle `chercher` (2 appels) ; `indisponible` × 6 raisons → le bon
  texte, « Réessayer » absent pour `cle_refusee`/`recherche_desactivee`/`refus`, lien Réglages présent pour les deux
  premières ; changer `q` (Entrée) efface les résultats ; mode `all` avec la même `q` → aucun lien web ; **aucun
  `innerHTML`** dans le rendu (un titre `<b>x</b>` est rendu littéralement).
- **9.5 Signet prérempli.** Route avec `query = { adresse: 'https://exemple.test/r', titre: 'Saumon' }` → les deux champs
  remplis, bouton ouvert, **0 écriture** en base ; `adresse: 'javascript:alert(1)'` → champ montré, erreur affichée,
  bouton fermé ; titre de 400 caractères → tronqué à `LIMITES_SIGNET.titre`.
- **9.6 Statiques.** `sw.js` : `SHELL` contient `./src/domain/recherche-web.js` (garde existante) et `VERSION ===
  'cuisine-os-v0.5.0-1'` ; `APP_VERSION === '0.5.0'` ; chaque texte « » des § 5 et 6 a sa clé dans `en.js` ; le source de
  `search.js` ne contient plus « Le Web n’est pas activé » ; `llm.js` : `supportsWebSearch` vaut `false` pour `none` et
  `openai_compatible`, `true` pour `anthropic` ; `anthropicHeaders('k')` rend exactement les quatre en-têtes.
- **9.7 Comportement inchangé.** `searchDocs(docs, parseQuery('salade'), { mode: 'web' })` reste 0 (test existant,
  l. 119) ; le test `tests/backup.js` sur le secret `llm` reste vert ; `AnthropicProvider.complete` envoie la même requête
  qu'avant (fetch factice : URL, en-têtes, corps).
- **Node** : `node --test tools/*.test.mjs` 40/40 et `--check` 0 inchangés (aucun outil touché).

## 10. Risques et décisions ouvertes

- **R1 Modèle libre.** `web_search_20250305` vaut pour tous les modèles actuels ; si Anthropic la retire un jour, l'appel
  rendra 400 → `requete` → « L’assistant n’a pas répondu. ». Dette nommée : classer ce 400 à part quand ce jour viendra.
- **R2 Coût.** Chaque tape coûte 1 à 3 recherches (0,01 à 0,03 $) plus les jetons (0,02 à 0,07 $ avec Opus 5.5) sur le
  compte de Neegan. Annoncé sous le bouton (W-7). Aucune tape automatique (I-B).
- **R3 Pays fixé à `CA`.** Hypothèse produit (app née au Québec). Deviendra un réglage si la douleur est réelle.
- **R4 L'assistant peut ne pas chercher** et répondre de mémoire : aucun bloc résultat → `rien`, même si son texte
  « connaît » des recettes. C'est I-A qui gagne ; le `system` insiste pour chercher toujours.
- **R5 Injection par les pages lues.** Le serveur lit le web ; le texte de l'assistant peut porter du contenu hostile.
  Mur : seules les adresses **des résultats** s'affichent (I-A) ; le texte visible se limite à « pourquoi », 200 points de
  code, Cc/Cf retirés, nœud texte (I-H, I-J). Une adresse de résultat reste un lien que la personne choisit d'ouvrir.
- **R6 Délai de 45 s.** Trop court pour trois recherches lentes → `delai` et « Réessayer » ; trop long pour une personne
  pressée. Mesure réelle à faire par Neegan ; valeur injectable.
- **R7 Vie privée.** La demande, ses filtres et la langue partent chez Anthropic (I-C). Rien de la bibliothèque, pas de
  compte, pas d'identifiant d'appareil.
- **R8 Citations.** Les conditions d'usage demandent d'afficher les sources quand on montre la sortie de l'API : l'écran
  montre **les sources elles-mêmes** (les liens), et rien d'autre du texte que « pourquoi », rattaché à son lien.
- **Non prouvé par la construction** : un appel réel avec la clé de Neegan (preuve sur son appareil : Mac d'abord, puis
  iPhone), le délai réel, Safari.

## 11. Traçabilité des revues

### 11.1 Constats et réponses (rév. 1 → rév. 2)

À remplir après les deux revues adverses (sécurité S·, faisabilité F·).

### 11.2 Ce que la construction a amendé

À remplir pendant le SDD (rulings R-WEB-n, chaque ligne avec son coût si faux).
