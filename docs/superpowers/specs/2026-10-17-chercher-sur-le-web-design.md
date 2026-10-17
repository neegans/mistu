# Chercher sur le web — design (rév. 2.1, 17 octobre 2026)

Source : brainstorm des 16 et 17 octobre. Le 16, l'onglet « Web » de la recherche a été mesuré : coquille « Le Web n’est pas
activé », aucune requête ne sort de l'app, « saumon fenouil » est compris (filtres saumon + fenouil) mais ne cherche que la
bibliothèque. Le 17, Neegan a tranché trois choses : **le but est l'intelligence artificielle** (pas un moteur de recherche) ;
l'assistant rapporte **des recettes trouvées sur le web sous forme de liens vérifiables** (pas une fiche complète, pas une
recette composée, pas une conversation) ; son assistant est **Anthropic, clé déjà entrée** dans Réglages → Assistant IA.
Le design en huit rulings W-1 à W-8 a reçu « go » en chat. Lot construit sur la branche `recherche-web`, arbre
`~/projects/mistu-web` (serveur `http://localhost:8083/`), base `main` @ `e4e841b` (lot ISBN fusionné, suite 1537/1537,
total épinglé 1536). Le site public ne change qu'à la fusion et au `git push` de Neegan.
**Rév. 2** : réécrite après deux revues adverses (sécurité S1-S15, faisabilité F1-F22 — § 11.1) ; ce qui a changé est marqué
« (S·/F·) ». Les trois changements de fond : l'état de la recherche web vit **au niveau du module** (un seul appel en vol
dans toute l'app, mémoire vive par demande — F2/F3/F13/F20) ; **ce qui part est ce qui est affiché** (textes des puces,
champ relu à la tape — F1/F14/S6) ; **l'assistant ne garantit rien** sur les restrictions (avertissement fixe — S1).
**Rév. 2.1 (17 octobre, après-midi)** : Neegan a reçu un kit de contre-proposition (`~/Downloads/mistu-claude-code-kit`, produit par un
autre outil à partir du plan rév. 1) et a tranché : **Mistu reste personnel** (pas de passerelle serveur, clé sur l'appareil + plafond
sur le compte — § 10 R2) ; **« Créer avec l'IA » en option = lot 2** ; **refonte visuelle = lot 3** ; un lot à la fois. Trois
correctifs du kit entrent dans ce lot (K1-K3, § 11.1) : résultats **conservés** quand la demande change, avec mention ; **pas de
complément automatique** à cinq liens ; **code de la raison** affiché sous le texte générique. Deux autres étaient déjà pris (R-WEB-1,
R-WEB-2) ; le kit a aussi relevé un test de navigation faux dans le plan (corrigé) et inspiré `redirect: 'error'` sur l'appel.

**Convention d'écriture.** Les textes d'interface cités entre « » sont les clés `t()` **exactes**, avec l'apostrophe
typographique (U+2019) comme tout `en.js` ; la prose de cette spec garde l'apostrophe droite. Les messages de commit
restent en ASCII sans accents. Jamais `git add -A` (`.superpowers/` non suivi).

## 1. Le problème, du côté de la personne

Neegan écrit « saumon fenouil » dans la recherche, ouvre l'onglet Web et lit que le Web n'est pas activé. Il n'a rien de
plus qu'avec sa bibliothèque. Ce qu'il veut : que l'assistant qu'il a déjà configuré aille chercher pour lui des pages de
recettes qui répondent à sa demande, qu'il puisse les ouvrir, et garder celles qui valent la peine dans sa bibliothèque.

Ce que l'app sait déjà faire, et que le lot réutilise :

- un **assistant IA** fournisseur-agnostique (`src/domain/llm.js`), réglé dans Réglages → Assistant IA, clé gardée sur
  l'appareil, **exclue des sauvegardes** (`SECRET_SETTING_KEYS`, `tests/backup.js`) et **jamais synchronisée** (le magasin
  `settings` n'est pas dans `SYNC_STORES`) ; il lit aujourd'hui des pages photographiées et des index ;
- un **lien externe** ouvert dans un nouvel onglet (`src/ui/recipe.js`, « Ouvrir le lien », `target="_blank"`,
  `rel="noopener noreferrer"`, `<meta name="referrer" content="no-referrer">`) ;
- un **signet** « Garder un lien web » (`src/ui/signet.js`, route `#/add/signet`) qui transforme adresse + titre en
  recette-référence, et une aide pure `lienSignet` (`src/core/lien.js`) qui n'accepte que `http:`/`https:`, retire les
  identifiants collés dans l'adresse et rend l'hôte en punycode ; `signetModel` **refuse** une adresse de plus de 2 048
  caractères et un titre de plus de 300 ;
- les aides du lot ISBN : `lireBornee` (corps lu en flux et coupé), `signalDelai` (abandon borné), `OPTIONS_FETCH`
  (`mode: 'cors'`, `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`) et `borner` (Cc/Cf et
  U+2028/2029 retirés, tronqué par points de code) — toutes dans `src/ui/livre-ajout.js` aujourd'hui (§ 7.2).

Ce que l'API Anthropic permet : un **outil de recherche web côté serveur** (`web_search_20250305`). L'app envoie la
demande avec l'outil déclaré ; le serveur cherche ; la réponse porte, **à part du texte de l'assistant**, la liste brute des
pages trouvées (`web_search_result` : `url`, `title`, `page_age`). C'est cette liste qui permet de tenir « rien d'inventé ».
Tarif : 10 $ par 1 000 recherches, plus les jetons (les résultats lus comptent en entrée) ;
`usage.server_tool_use.web_search_requests` compte les recherches. Si un administrateur a désactivé la recherche web sur
le compte, la requête échoue en 400 « not enabled » (forme exacte à mesurer, § 10).

## 2. Périmètre et hors lot

**Dans le lot.**

1. Mode « Web » de la recherche : un bouton explicite qui lance **un** appel à l'assistant avec l'outil de recherche web ;
   un bouton « Annuler » pendant l'attente (F20).
2. Affichage de 5 liens au plus, tous présents dans les résultats bruts du serveur, avec « pourquoi ça colle » quand
   l'assistant l'a dit, et un avertissement fixe sur les restrictions (S1).
3. « Garder ce lien » → route signet **préremplie** (adresse + titre) avec l'hôte affiché ; rien n'est enregistré sans le
   geste de la personne (S4).
4. Issues distinctes : trouvé, rien trouvé, indisponible avec raison (« Réessayer » quand ça a du sens), et les deux
   gardes du fournisseur rendues à l'écran (F5).
5. Module neuf `src/domain/recherche-web.js` ; module neuf `src/core/bornes.js` qui **reçoit** les aides du lot ISBN
   (F11/S8) ; petits ajouts à `llm.js`, `search.js` (UI et domaine), `signet.js`, `components.js`, `en.js`, `sw.js`,
   `schema.js` ; tests ; docs.

**Hors du lot (nommé pour ne pas y glisser).** Lire la page trouvée pour en tirer une fiche recette (= « Une fiche
recette complète », écartée le 17 octobre ; lot suivant naturel) · recherche web par un fournisseur compatible OpenAI ·
stockage durable ou historique des résultats · recherche automatique sans tape · `web_fetch`, conversation, flux
(`stream`) · reprise d'un `pause_turn` (un seul appel, on lit ce qu'il a rendu) · résultats web dans le mode « Tout » ·
filtres de domaines réglables · pays réglable (R3) · changement du modèle ou de la clé (Réglages existants) · plafond de
dépense côté app (le mur est côté compte : § 10 R2) · Safari/iPhone (aucun WebKit ici ; preuve par Neegan) · D5
(sous-domaine), nommé en § 10 comme préalable à la clé sur le site public (S7) · **passerelle serveur à clé commune** (Mistu reste
personnel, décision du 17 octobre) · **mode « Créer avec l'IA »** (lot 2, en option, sur les versions de recette existantes) ·
**refonte visuelle** ivoire/tomate du kit (lot 3) · **images des sites sources** (relais à défendre contre les requêtes internes).

## 3. Invariants

- **I-A Rien d'inventé.** Un lien ne s'affiche que si son adresse, normalisée par `lienSignet`, est **égale** à celle d'un
  bloc `web_search_result` de la réponse. Le texte de l'assistant ne peut ni ajouter une adresse, ni en changer le titre,
  ni la raccourcir. Si l'assistant ne rend pas de choix lisible, l'app liste les résultats bruts tels quels, sans
  « pourquoi ». **Une adresse n'est jamais tronquée** (F9/S3) : trop longue, elle est refusée là où elle arrive.
- **I-B Aucune requête sans tape.** Le rendu du mode Web ne fait aucun appel réseau. Seuls « Chercher sur le web avec
  l’assistant » et « Réessayer » déclenchent l'appel ; demande vide = bouton éteint.
- **I-C La clé reste sur l'appareil — un dos-d'âne, pas un mur (S7).** Elle part dans l'en-tête `x-api-key` de
  l'appel, jamais dans une adresse, un texte d'écran, une erreur affichée, un journal, une sauvegarde ou la synchro. Mais
  **toute page de la même origine** (`neegans.github.io` est partagée par tous les sites Pages du compte tant que D5
  n'est pas fait) **ou un XSS futur lit IndexedDB et l'utilise** : le vrai mur est côté compte Anthropic (§ 10 R2). Ce qui
  part chez Anthropic, et vraisemblablement chez son fournisseur de recherche (S15) : la demande tapée, **les textes des
  puces affichées** (type, restrictions, ingrédients, durées — F1), la langue de l'interface, le pays `CA`, le fuseau de
  l'appareil, et l'adresse IP de l'appareil (appel direct depuis le navigateur). **Rien de la bibliothèque.**
- **I-D CSP inchangée.** `connect-src 'self' https:` couvre déjà `api.anthropic.com`. Aucun script, style ou image
  externe.
- **I-E Déterministe avant IA.** La lecture de la réponse et le choix des liens sont des fonctions pures, testées sur des
  réponses fixes. L'état de l'écran reflète l'issue de l'appel, jamais une supposition.
- **I-F Issues distinctes.** « Rien trouvé » n'est dit que si **une recherche a eu lieu** et n'a rapporté aucune page
  (F10). Tout le reste est « indisponible », avec la raison la plus précise connue — y compris « l'assistant n'a pas
  cherché ».
- **I-G Mémoire vive seulement.** La dernière issue vit dans la mémoire du module `search.js`, **jamais** en base, ni dans
  une archive, ni au serveur ; elle meurt au rechargement. Elle reste **affichée tant qu'une nouvelle recherche n'a pas
  abouti**, toujours avec la demande qui l'a produite (« Demande envoyée : … ») ; si la demande courante (texte ou puces)
  diffère, l'écran le dit : « La demande a changé depuis cette recherche. » (K1 : le kit a convaincu que cacher les liens à
  chaque puce touchée est plus brutal qu'utile ; S5 reste couvert par la mention et par la ligne de la demande).
- **I-H Rendu sûr.** Tout texte passe par `el()` (nœuds texte, jamais `innerHTML`). Chaque adresse est revalidée **au
  rendu** par `lienSignet`. **Titre et date d'un résultat sont bornés** (300 et 40 points de code, Cc/Cf et U+2028/2029
  retirés — F8/S2) ; « pourquoi » à 200.
- **I-I Un appel en vol dans toute l'app** (F2/F3). Le vol vit au niveau du module ; une nouvelle tape l'abandonne
  (`AbortController`) avant d'en lancer un autre ; « Annuler » l'abandonne sans rien lancer. Une réponse d'un vol
  abandonné n'écrit rien.
- **I-J Ce qui part est ce qui est affiché** (F1/F14/S6). La demande envoyée = le champ **relu à la tape** + les textes
  des puces **telles qu'elles sont à l'écran** à cet instant. La demande envoyée est rappelée au-dessus des résultats.
- **I-K L'assistant ne garantit rien** (S1). Aucun texte de l'assistant n'est présenté comme une vérification : un
  avertissement fixe accompagne toujours les liens, et le `system` lui interdit d'affirmer une compatibilité. Principe
  fondateur du projet : aucune compatibilité inventée, aucune restriction assouplie.

## 4. `src/domain/recherche-web.js` — module neuf

Dépendances : `parseJsonLoose`, `ANTHROPIC_MESSAGES_URL`, `anthropicHeaders` depuis `llm.js` ; `lienSignet` depuis
`core/lien.js` ; `borner`, `lireBornee`, `signalDelai`, `OPTIONS_FETCH` depuis `core/bornes.js` (§ 7.2). Aucun import
d'interface. **Aucune fonction de ce module ne lève** vers l'appelant : `chercherRecettesWeb` rend toujours une issue
(F12/S10).

### 4.1 `construireDemande({ q, filtres, langue })` → `{ system, user, cle }` (pure)

- `q` : `borner(q, 500)` ; `filtres` : tableau de **chaînes** (les textes des puces, fournis par l'écran — F1), chacune
  `borner(·, 80)`, vides retirées, 12 au plus ; `langue` : `'fr'` ou autre → anglais.
- `q` vide après nettoyage → `{ system: null, user: null, cle: null }` (l'écran éteint le bouton sur la même règle ;
  `chercherRecettesWeb` rend alors `indisponible`/`requete`).
- `user` : la demande, puis une ligne « Contraintes : » suivie des filtres séparés par « ; » si la liste n'est pas vide.
  Rien d'autre du contexte.
- `system` (texte fixe par langue) : rôle « tu trouves des pages de recettes sur le web pour Cuisine OS » ; **cherche
  toujours sur le web** (1 à 3 recherches), même si tu crois connaître des recettes ; préfère les pages de recettes
  complètes, en français du Québec d'abord quand la langue est `fr` ; **n'affirme jamais** qu'une page respecte une
  restriction alimentaire ou une durée : dis seulement ce que la page annonce (S1) ; puis **réponds uniquement** par un
  objet JSON `{"choix":[{"url":"…","pourquoi":"…"}]}` de 5 entrées au plus, dont chaque `url` est **l'adresse exacte d'une
  page trouvée par la recherche** ; n'invente ni page ni adresse ; `pourquoi` = une phrase courte.
- `cle` : `JSON.stringify([q nettoyé, filtres nettoyés, langue])` — la clé de mémoire du § 5.1 (F3/F13).

### 4.2 `corpsRequete({ cfg, demande, fuseau })` → objet JSON (pure)

```js
{ model: cfg.model, max_tokens: 4096, system: demande.system,
  messages: [{ role: 'user', content: demande.user }],
  tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3,
            user_location: { type: 'approximate', country: 'CA', timezone } }] }
```

- `timezone` = `fuseau` si c'est une chaîne non vide, sinon la propriété est omise. `fuseau` est **injecté** (F18) ; le
  défaut de `chercherRecettesWeb` est `Intl.DateTimeFormat().resolvedOptions().timeZone`, dans un `try` qui rend `''`.
- **Pas** de `thinking` (défaut du modèle), **pas** de `output_config.format` (incompatible avec les citations toujours
  actives de la recherche web), **pas** de `allowed_callers` (défaut `direct` sur `web_search_20250305`), pas de `stream`.
- La version `web_search_20250305` est choisie **parce qu'elle vaut pour tous les modèles** et rend la liste brute
  complète ; les versions à filtrage dynamique cachent une partie des résultats dans des blocs d'exécution de code et
  exigent un modèle qui les prend en charge — le modèle de Neegan est un texte libre dans Réglages.

### 4.3 `lireReponse(json)` → `{ resultats, erreursOutil, aCherche, texte, stopReason, recherches }` (pure)

- `resultats` : tous les blocs `content[].type === 'web_search_tool_result'` dont `content` est un **tableau** → chaque
  entrée `type === 'web_search_result'` avec `url` chaîne non vide → `{ href, hote, titre, date }` où `href`/`hote`
  viennent de `lienSignet(url)` (une adresse refusée est ignorée), `titre = borner(title, 300)` (chaîne, sinon `''`),
  `date = borner(page_age, 40)` (chaîne, sinon `null`) (F8/S2) ; dans l'ordre, **dédoublonnés par `href` exact** (F21 :
  fragment, barre finale et paramètres comptent — deux adresses différentes sont deux pages, c'est voulu).
- `erreursOutil` : les `content` qui sont un **objet** → `error_code` (chaîne) ; sinon rien.
- `aCherche` : vrai s'il existe au moins un bloc `server_tool_use` ou `web_search_tool_result` (F10).
- `texte` : concaténation des blocs `type === 'text'` (chaîne) **sans séparateur** (F7/S13 : les citations coupent le
  texte au milieu d'une chaîne JSON).
- `stopReason` : `json.stop_reason` chaîne ou null ; `recherches` : `json.usage.server_tool_use.web_search_requests` si
  entier ≥ 0, sinon null.
- Toute forme hostile (`content` absent ou non tableau, bloc sans `type`, champs du mauvais type, entrée `null`) est
  ignorée, jamais levée.

### 4.4 `choisirLiens(lu, { max = 5 } = {})` → `{ liens, repli }` (pure)

1. Tente `parseJsonLoose(lu.texte)` ; `choix` doit être un tableau ; une entrée non-objet ou sans `url` chaîne est
   ignorée (S13). Pour chaque entrée : `href = lienSignet(url).href` ; gardée **seulement si** un résultat de
   `lu.resultats` a exactement ce `href`. Titre, hôte et date viennent **du résultat**. `pourquoi = borner(pourquoi, 200)`
   ou `null`. Dédoublonnage par `href`, ordre des choix.
2. **Pas de complément automatique** (K1 du kit, remplace F21) : `liens` = les choix survivants seulement, `max` au plus.
   Les résultats restants, dans l'ordre du serveur et `pourquoi: null`, vont dans **`autres`** : l'écran les offre repliés
   (« Autres pages trouvées ({n}) »). Remplir une sélection de deux pages avec trois moins pertinentes la diluait.
3. `repli = true` seulement si **aucun** choix n'a survécu (JSON illisible, `choix` absent ou vide, aucune adresse
   retrouvée) : `liens` = les `max` premiers résultats tels quels, `autres` = le reste.
4. Retour `{ liens, autres, repli }`. Chaque lien rendu : `{ href, hote, titre, date, pourquoi }`. Titre vide → `hote`.

### 4.5 `chercherRecettesWeb({ q, filtres, langue, cfg }, deps = {})` → issue (ne lève jamais)

`deps` : `fetch` (défaut `globalThis.fetch`, **appelé comme fonction libre** : `const f = deps.fetch ?? globalThis.fetch;
f(url, options)` — F11), `enLigne` (défaut `() => navigator.onLine !== false`), `tentativeMs` (défaut **45 000** : une à
trois recherches côté serveur prennent couramment 10 à 30 s — R6), `corpsMax` (défaut 2 Mio : `encrypted_content` est
volumineux), `corpsErreurMax` (défaut 64 Kio), `fuseau` (§ 4.2), `signal` (un `AbortSignal` **extérieur**, posé par
l'écran — I-I ; combiné au délai : `signalDelai(tentativeMs)` et `signal` abandonnent tous deux la requête). Options
réseau : `{ ...OPTIONS_FETCH, method: 'POST', redirect: 'error', headers: anthropicHeaders(cfg.api_key), body, signal }` (G2 :
la clé ne suit jamais une redirection).

Issues, dans cet ordre de décision (la première condition vraie gagne) :

| `etat` | `raison` | Quand |
|---|---|---|
| `non_configure` | — | `cfg` absent, `provider` absent ou `'none'`, ou `api_key`/`model` vides. Aucun appel. |
| `non_pris_en_charge` | — | `cfg.provider !== 'anthropic'`. Aucun appel. |
| `indisponible` | `requete` | demande vide après nettoyage (`cle === null`). Aucun appel. |
| `indisponible` | `hors_ligne` | `enLigne()` faux. Aucun appel. |
| `indisponible` | `annule` | `signal.aborted` avant ou pendant l'appel (l'écran n'affiche pas cette issue : § 5.4). |
| `indisponible` | `delai` | abandon par `signalDelai` après `tentativeMs` (corps compris). |
| `indisponible` | `reseau` | `fetch` lève (hors abandon). |
| `indisponible` | `cle_refusee` | statut 401 ou 403 (S12 : un 403 `permission_error` peut aussi être un droit manquant — texte § 5.6). |
| `indisponible` | `recherche_desactivee` | statut 400 **et** corps JSON borné (`corpsErreurMax`) dont `error.message` contient `web search` ou `web_search` **et** `not enabled` ou `disabled` (insensible à la casse) (S12). |
| `indisponible` | `trop_de_demandes` | statut 429. |
| `indisponible` | `requete` | tout autre 4xx (F10). |
| `indisponible` | `serveur` | statut 5xx (529 compris). |
| `indisponible` | `reponse_illisible` | corps > `corpsMax` (lu en flux par `lireBornee` — S8), JSON invalide, ou `content` non tableau. |
| `indisponible` | `refus` | `stopReason === 'refusal'` — **avant** `trouve`, même avec des résultats (F22). |
| `indisponible` | `trop_de_demandes` | `erreursOutil` contient `too_many_requests` et aucun résultat. |
| `indisponible` | `outil` | `erreursOutil` non vide et aucun résultat (`unavailable`, `invalid_tool_input`, …). |
| `indisponible` | `interrompu` | aucun résultat et `stopReason` ∈ {`pause_turn`, `max_tokens`} (F10). |
| `indisponible` | `pas_cherche` | aucun résultat et `aCherche` faux (l'assistant a répondu de mémoire — R4, F10). |
| `rien` | — | `aCherche` vrai, aucun résultat (listes vides). |
| `trouve` | — | au moins un résultat → `liens` et `autres` par § 4.4. Une erreur d'outil ou un `pause_turn` **après** des résultats est ignoré. |
| `indisponible` | `interne` | toute exception inattendue (filet `try/catch` autour de tout) ; `logError('web_recherche', { raison })` **sans aucun champ de `cfg`** (S10/F12). |

Retour : `{ etat, raison, liens, autres, repli, recherches, modele: cfg?.model ?? null }`. `liens` et `autres` sont `[]` hors `trouve`.
**Aucun texte de l'API n'est recopié dans l'issue** (I-C) : les corps d'erreur servent au classement, pas à l'écran.

## 5. Écran — mode Web de `src/ui/search.js`

### 5.1 État au niveau du module (F2/F3/F13/F20)

`run()` appelle `navigate(…, { replace: true })`, donc **chaque Entrée, changement de mode ou de case ré-instancie la
route** (`app.js` rejoue `renderSearch` sur `hashchange`). Un état d'instance ne survit pas ; l'état web vit donc dans le
module :

```js
let memoire = null;   // { cle, issue }            — la dernière issue, pour la demande exacte qui l'a produite (I-G)
let vol = null;       // { cle, controller, promesse } — l'unique appel en vol dans l'app (I-I)
const vues = new Set(); // callbacks de redessin des instances vivantes du mode Web
export function etatWeb() { return { cle: vol?.cle ?? null, enCours: !!vol, memoire: memoire ? { cle: memoire.cle, etat: memoire.issue.etat } : null }; }
export function reinitialiserWeb() { vol?.controller.abort(); vol = null; memoire = null; vues.clear(); } // tests seulement
```

- La **clé courante** d'une instance = `construireDemande({ q: state.q, filtres: textesDesPuces(), langue }).cle`,
  recalculée à chaque redessin du mode Web. `textesDesPuces()` = `chipsFor(state.parsed.filters).map((c) =>
  libellePuce(c, ctx.ingredientsById))`, **la même fonction** que celle qui dessine les puces (§ 7.3, I-J).
- Au redessin : si `vol && vol.cle === cle` → écran « en cours » (§ 5.4) ; sinon si `memoire` existe → écran de l'issue
  (§ 5.5-5.7), avec la mention « La demande a changé depuis cette recherche. » quand `memoire.cle !== cle` (K1) ; sinon →
  écran du bouton (§ 5.3). Une puce touchée ou un mot ajouté ne fait donc pas disparaître les liens : il le dit, et
  « Chercher à nouveau » repart avec la demande courante.
- Chaque instance pose son callback dans `vues` au rendu et le retire quand son nœud racine n'est plus connecté
  (vérifié au moment de notifier : `root.isConnected`).

### 5.2 Garde du fournisseur (F5/F6/S11)

`const fournisseur = providerFrom(ctx.settings)` — **une seule source de vérité**, celle de `llm.js` :

1. `!fournisseur.configured` (aucun, ou Anthropic sans clé ou sans modèle) : `status warn` « Pour chercher sur le web,
   configure l’assistant IA : fournisseur Anthropic, modèle et clé. » + bouton « Réglages » (`#/settings`), même forme
   que `aiNotice`. Fin.
2. `configured && !fournisseur.supportsWebSearch` : `status warn` « Ce fournisseur ne cherche pas sur le web. Choisis
   Anthropic dans Réglages → Assistant IA. » + « Réglages ». Fin.
3. Sinon : § 5.3. Les issues `non_configure` / `non_pris_en_charge` du module, si elles revenaient quand même (réglage
   changé pendant le vol), se rendent avec **ces mêmes deux textes** (F5).

### 5.3 Écran du bouton

Carte : bouton « Chercher sur le web avec l’assistant » (`disabled` si `borner(input.value, 500)` est vide — la même
règle que § 4.1), sous-ligne `muted` « Une recherche = un appel à ton compte Anthropic. » ; champ vide → petite ligne
« Écris d’abord ce que tu cherches. ».

### 5.4 Tape, vol, annulation (I-B, I-I, I-J)

1. **Relire le champ** : `state.q = input.value.trim()`, `state.parsed = parseQuery(state.q)` (plus `type = role` si
   `forRecipe`), exactement comme `run()` (F14/S6). Calculer `filtres = textesDesPuces()` et `demande`.
2. **Abandonner** le vol précédent s'il existe (`vol.controller.abort()`), même pour une autre demande (I-I).
3. Poser `vol = { cle, controller, promesse }` où `promesse = deps.chercher({ q, filtres, langue, cfg: ctx.settings.llm },
   { enLigne, signal: controller.signal, ...depsForces })`, puis `navigate('/search' + buildQuery({…}), { replace: true })`
   (la route se ré-instancie et retrouve le vol par sa clé — § 5.1). `depsForces` est vide à la tape ; « Réessayer »
   passe `{ enLigne: () => true }` (S9 : `navigator.onLine` ment parfois, le geste de la personne fait foi).
4. **Au retour** : `if (vol?.promesse !== promesse) return;` (vol abandonné ou remplacé : rien). Sinon `vol = null` ;
   si `issue.raison !== 'annule'` → `memoire = { cle, issue }` ; notifier `vues`.
5. **Filet** : `promesse` est entourée d'un `try/catch` dans l'écran aussi (F12) : une exception → `memoire = { cle,
   issue: { etat: 'indisponible', raison: 'interne', liens: [] } }`, `vol = null`, notification. Jamais d'écran figé.
6. **Écran « en cours »** : bouton éteint, `div.status[role="status"]` « L’assistant cherche sur le web… » (F20), bouton
   « Annuler » → `vol.controller.abort(); vol = null;` → écran du bouton (la mémoire reste ce qu'elle était). Le coût
   d'un appel annulé reste facturé côté serveur (R2).

### 5.5 Issue `trouve`

Section « Trouvé sur le web » : ligne `muted` « Demande envoyée : {q} » (+ « · » + filtres joints par « ; » s'il y en a —
I-J) ; si `memoire.cle !== cle` : `status` « La demande a changé depuis cette recherche. » (K1) ; puis une carte par lien de
`liens` : `a` (`class btn`, `href = lien.href`, `target="_blank"`, `rel="noopener noreferrer"`) avec le titre ; ligne `muted`
hôte (+ « · » + date si connue) ; `pourquoi` si présent ; bouton « Garder ce lien » → `deps.navigate('/add/signet' +
buildQuery({ adresse: lien.href, titre: lien.titre }))` (F4). Si `autres` n'est pas vide : `details` dont le `summary` dit
« Autres pages trouvées ({n}) », une ligne par page (même `a`, hôte, « Garder ce lien »), repliées par défaut (K2). Sous la
liste, **toujours** : `status` « L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de
cuisiner. » (S1/I-K) ; « Recherches faites par l’assistant : {n} » si `recherches` connu ; « Liens tels que trouvés, sans
tri de l’assistant. » si `repli`. Puis le bouton « Chercher à nouveau » (= tape, § 5.4). Un « trouvé » dont aucune carte ne
survit à la revalidation au rendu se rend comme `rien` (R-WEB-3).

### 5.6 Issue `rien` et issue `indisponible`

- `rien` : `status` « Aucune page trouvée pour cette demande. Reformule ou cherche autrement. » + « Réessayer ».
- `indisponible`, `div.status.warn[role="status"]` selon `raison` : `hors_ligne` : « Tu es hors ligne. » (clé existante) ;
  `cle_refusee` : « Ta clé Anthropic a été refusée, ou n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA. » +
  « Réglages » ; `recherche_desactivee` : « La recherche web n’est pas activée sur ton compte Anthropic. » +
  « Réglages » ; `trop_de_demandes` : « Trop de demandes pour l’instant. Réessaie dans une minute. » ; `refus` :
  « L’assistant a refusé cette demande. » ; `pas_cherche` : « L’assistant n’a pas cherché sur le web. Réessaie. » ;
  `requete` quand la demande est vide : « Écris d’abord ce que tu cherches. » ; toute autre raison (`delai`, `reseau`,
  `requete`, `serveur`, `reponse_illisible`, `outil`, `interrompu`, `interne`) : « L’assistant n’a pas répondu. Réessaie. »,
  suivi d'une ligne `small.muted` « Code : {c} » (clé existante) portant la `raison` (K3 : des causes distinctes restent
  distinguables pour les rapports de Neegan, sans recopier le fournisseur).
- « Réessayer » accompagne toutes les raisons sauf `cle_refusee`, `recherche_desactivee` et `refus`. Il refait § 5.4 avec
  `depsForces = { enLigne: () => true }`.
- `annule` n'est jamais rendue (§ 5.4.4).

### 5.7 Signature, injection, autres modes

`renderSearch(params, query, ctx, deps = {})` ; `deps.chercher` (défaut `chercherRecettesWeb`), `deps.enLigne`,
`deps.navigate` (défaut `navigate` du routeur — F4). Les modes `recipes`, `books`, `all` ne changent pas : aucun lien web
n'y apparaît. `src/domain/search.js` : `searchDocs(…, { mode: 'web' })` rend des groupes **vides sans `notice`** (le texte
mort « Le Web n’est pas activé : … Les résultats ci-dessous viennent de ta bibliothèque uniquement. » est retiré, et
`pairing.js` ne le propage plus — F16) ; le test existant `tests/tests.js` l. 119 reste vert.

## 6. Signet prérempli — `src/ui/signet.js`

`renderSignetRoute` lit `query.adresse` et `query.titre` dans `etat` **avant** le premier dessin : `adresse` **telle
quelle** (jamais tronquée — F9/S3 ; trop longue, `signetModel` dit « Adresse trop longue. ») ; `titre` = `borner(titre,
LIMITES_SIGNET.titre)` (points de code, Cc/Cf retirés — F9/S2). Une adresse préremplie passe par la même validation
qu'une adresse tapée. **Quand `query.adresse` est présent** (S4 : un lien profond `#/add/signet?adresse=…` arrive aussi
de l'extérieur de l'app), une bannière `status` précède le formulaire : « Adresse reçue : vérifie-la avant
d’enregistrer. » suivie de l'hôte recalculé en `strong` (vide si l'adresse est refusée). Rien n'est écrit en base avant
« Enregistrer ». `enregistrerSignet` nettoie déjà les chaînes à l'écriture (`nettoyerChaines`, Cc seulement) ; le `borner`
du titre à l'entrée couvre les Cf.

## 7. Fournisseur, aides communes, puces

### 7.1 `src/domain/llm.js`

- `LLMProvider` : `get supportsWebSearch() { return false; }` ; `AnthropicProvider` : `true`. **Lu** par § 5.2 (F6).
- Exports neufs : `ANTHROPIC_MESSAGES_URL` (`https://api.anthropic.com/v1/messages`) et `anthropicHeaders(apiKey)` →
  `{ 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true' }`. `AnthropicProvider.complete` les utilise : refactor **à
  comportement inchangé** (même URL, mêmes en-têtes, même corps), verrouillé par un test écrit **avant** (§ 9.7).
- Le modèle reste `cfg.model` tel que tapé. Rien d'autre ne change dans `llm.js`.

### 7.2 `src/core/bornes.js` — module neuf, pur, sans import (F11/S8)

Reçoit, **déplacées** depuis `src/ui/livre-ajout.js` sans changer une ligne de leur corps : `lireBornee(r, maxOctets)`,
`signalDelai(ms)`, `OPTIONS_FETCH`, et `borner(s, max)` (généralisée : `max` en paramètre ; `livre-ajout.js` l'appelle avec
`LIMITES_ISBN.champ`). `livre-ajout.js` les **importe et les ré-exporte** (`export { lireBornee, signalDelai, OPTIONS_FETCH }
from '../core/bornes.js'`) : `tests/ajouter.js`, qui les lit via le module de route, ne change pas. Le domaine n'importe
plus rien de l'interface. `SHELL` += `./src/core/bornes.js`.

### 7.3 `src/ui/components.js` — `libellePuce(c, ingredientsById)` (F1, I-J)

Le libellé d'une puce est aujourd'hui calculé **dans** `filterChips`. Il est extrait en fonction pure exportée
`libellePuce(c, ingredientsById)` → chaîne (type et restriction par `label()`, ingrédient par son libellé dans la langue
de l'interface ou son id à défaut, `exclude_text` tel quel, durées « ≤ {n} min » comme la puce). `filterChips` l'appelle
(comportement inchangé) ; `search.js` l'appelle pour la demande (§ 5.1). Ainsi **une seule définition** de ce qu'une
puce dit.

## 8. Données, versions, dictionnaire, CSP, docs

- **Aucun** changement de schéma, aucune migration, aucun réglage neuf. `tools/generer-migrations.mjs --check` reste 0.
- `src/model/schema.js` : `APP_VERSION = '0.5.0'`. `sw.js` : `VERSION = 'cuisine-os-v0.5.0-9'` (valeur réelle à la
  clôture, tâche 9), `SHELL` += `'./src/domain/recherche-web.js'` et `'./src/core/bornes.js'` (le test « SHELL complet »
  de `tests/sync.js` rougit sinon).
- **Tests existants qui passent au rouge et sont mis à jour** (F15) : `tests/ajouter.js` l. 1800 (`v0\.4\.1-\d+` →
  `v0\.5\.0-\d+`) et l. 1802 (`'0.4.1'` → `'0.5.0'`) ; `tests/sync-l3.js` l. 1864 (`v0\.4\.1-\d+` → `v0\.5\.0-\d+`). Le § 9.6
  **remplace** ces pins, il ne les double pas.
- `src/i18n/en.js` : une clé par texte « » des § 5 et 6, avec l'apostrophe U+2019. Clés neuves : « Pour chercher sur le
  web, configure l’assistant IA : fournisseur Anthropic, modèle et clé. » · « Ce fournisseur ne cherche pas sur le web.
  Choisis Anthropic dans Réglages → Assistant IA. » · « Chercher sur le web avec l’assistant » · « Une recherche = un
  appel à ton compte Anthropic. » · « Écris d’abord ce que tu cherches. » · « L’assistant cherche sur le web… » ·
  « Annuler » (vérifier si elle existe) · « Trouvé sur le web » · « Demande envoyée : {q} » · « Garder ce lien » ·
  « L’assistant ne vérifie ni les ingrédients ni les restrictions : relis la page avant de cuisiner. » · « Recherches
  faites par l’assistant : {n} » · « Liens tels que trouvés, sans tri de l’assistant. » · « Chercher à nouveau » ·
  « Aucune page trouvée pour cette demande. Reformule ou cherche autrement. » · « Ta clé Anthropic a été refusée, ou
  n’a pas ce droit. Vérifie-la dans Réglages → Assistant IA. » · « La recherche web n’est pas activée sur ton compte
  Anthropic. » · « Trop de demandes pour l’instant. Réessaie dans une minute. » · « L’assistant a refusé cette
  demande. » · « L’assistant n’a pas cherché sur le web. Réessaie. » · « L’assistant n’a pas répondu. Réessaie. » ·
  « Adresse reçue : vérifie-la avant d’enregistrer. » · « La demande a changé depuis cette recherche. » · « Autres pages
  trouvées ({n}) ». Existantes (vérifiées) : « Réessayer », « Réglages », « Tu es hors ligne. », « Code : {c} ». **Retirée** de `src/ui/search.js` l. 60 et de `en.js` l. 17 : « Le Web n’est pas activé : aucune source
  externe n’est configurée. Aucune recherche extérieure n’a été faite. » (aucun test ne la cite — vérifié).
- CSP : inchangée (I-D). `index.html` n'est pas touché.
- Docs : `docs/architecture.md` (modules `recherche-web.js` et `bornes.js`, rulings W-1…W-8, « déterministe avant IA »
  étendu à la recherche web), `CLAUDE.md` (section du lot : fait, non prouvé, dettes, gestes de Neegan § 10), `STATE.md` à
  la pause. Total épinglé `tests/tests.js` l. 180 : lu dans « obtenu : X » puis posé, jamais deviné.

## 9. Ce que la suite de tests doit prouver (rouge d'abord, sauf § 9.7)

Fichier neuf `tests/recherche-web.js` exportant `runRechercheWebTests({ eq, ok })`, enregistré dans `tests/tests.js` avec
le même `try/catch` que les autres suites. Réponses d'API **fixes** dans le fichier (jamais de réseau). Les tests d'écran
appellent `reinitialiserWeb()` avant chaque cas et lisent `etatWeb()` comme **fait attendu** (F4), jamais un délai.

- **9.1 `lireReponse`.** Fixture exacte (F17) : bloc A = [a, b, c avec `user:pass@`], bloc B = [a (doublon), `ftp://x`, d]
  → **4** résultats dans l'ordre a, b, c (href sans identifiants), d ; titre de c = 300 points de code exactement pour un
  `title` de 350 contenant U+202E (retiré) ; `page_age` absent → `date: null` ; `content` objet `error_code` →
  `erreursOutil`, `aCherche` vrai ; liste vide → 0 résultat, `aCherche` vrai ; aucun bloc outil → `aCherche` faux ;
  `usage` absent → `recherches: null` ; deux blocs `text` « {"choix":[{"url":"ht » + « tps://…"}]} » → `texte` recollé
  sans saut de ligne (F7) ; `content` racine non tableau → résultats vides sans lever ; entrée `null` ignorée.
- **9.2 `choisirLiens`.** 3 choix dont un `url` hors résultats, sur 4 résultats → `liens` = les 2 choix survivants dans
  l'ordre des choix (titres **des résultats**, `pourquoi` posé), `autres` = les 2 résultats restants dans l'ordre du serveur
  (`pourquoi: null`), `repli: false` (K2) ; choix avec `user:pass@` → `href` sans identifiants et retrouvé ; `pourquoi`
  de 300 points de code avec un U+200B → 200, sans Cc/Cf ; JSON illisible → `repli: true`, `liens` = 5 premiers résultats,
  `autres` = le reste ; `choix: []` → repli ; `choix: [null, 3, {}]` → repli sans lever (S13) ; 7 choix valides → `liens` 5,
  `autres` 2 ; doublon de choix → 1 ; prose « {x} puis {json} » → repli.
- **9.3 `construireDemande` et `corpsRequete`.** `q` de 600 points de code → 500 ; `filtres` ['Sans gluten', '', 'x'] →
  `user` contient « Contraintes : Sans gluten ; x » ; `q` fait de U+200B → `cle: null` ; `langue: 'en'` → `system`
  anglais (F18) ; `cle` identique pour deux appels aux mêmes arguments, différente si un filtre change ;
  `fuseau: ''` → `user_location` sans `timezone` ; `fuseau: 'America/Toronto'` → présent ; corps sans `thinking`,
  `output_config`, `stream`, `allowed_callers` ; `tools[0]` = `{ type: 'web_search_20250305', name: 'web_search',
  max_uses: 3, … }`.
- **9.4 `chercherRecettesWeb` avec `fetch` factice.** La fonction factice vérifie qu'elle est appelée **sans `this`**
  (F11) ; en-têtes `x-api-key` égal à la clé et `anthropic-dangerous-direct-browser-access: 'true'`, options
  `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`, `signal` présent ; l'URL ne contient pas
  la clé ; `cfg` absent / `provider: 'none'` / Anthropic sans clé → `non_configure`, **0 appel** ; `openai_compatible` →
  `non_pris_en_charge`, 0 appel ; `q` vide → `requete`, 0 appel ; `enLigne: () => false` → `hors_ligne`, 0 appel ;
  `signal` déjà abandonné → `annule`, 0 appel ; 401 et 403 → `cle_refusee` ; 400 `{"error":{"type":"invalid_request_error",
  "message":"Web search is not enabled for this organization"}}` → `recherche_desactivee` ; 400 autre → `requete` ; 404 →
  `requete` ; 429 → `trop_de_demandes` ; 529 → `serveur` ; `fetch` qui lève → `reseau` ; `tentativeMs: 1` et un `fetch`
  qui ne répond qu'à l'abandon de son `signal` (rejet `AbortError`) → `delai` (F18) ; `signal` extérieur abandonné pendant
  le vol → `annule` ; corps > `corpsMax` par une vraie `Response` en flux → `reponse_illisible` ; `stop_reason: 'refusal'`
  **avec** 2 résultats → `refus`, `liens: []` ; `too_many_requests` sans résultat → `trop_de_demandes` ; `unavailable`
  sans résultat → `outil` ; `max_uses_exceeded` **avec** 2 résultats → `trouve` 2 liens ; `pause_turn` sans résultat →
  `interrompu` ; `pause_turn` avec résultats → `trouve` ; aucun bloc outil, `end_turn` → `pas_cherche` ; listes vides →
  `rien` ; cas nominal → `trouve`, `recherches: 2`, `modele` recopié ; `fetch` qui rend un objet sans `ok` ni `status` →
  `interne`, sans lever. **L'issue ne contient jamais la clé ni un extrait du corps** (comparaison JSON de l'issue contre
  la clé et contre une chaîne sentinelle du corps).
- **9.5 Écran (rendus DOM à gestes injectés ; `deps.chercher` factice qui compte ses appels et rend une promesse pilotée ;
  `deps.navigate` factice ; fixture `ctx` = `{ docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback:
  [], settings: { llm: … } }`).** `llm: { provider: 'none' }` → texte § 5.2.1 + lien `#/settings`, 0 appel ; `anthropic`
  sans clé → même texte (F5) ; `openai_compatible` avec clé → texte § 5.2.2 ; Anthropic complet + champ vide → bouton
  `disabled`, « Écris d’abord ce que tu cherches. », 0 appel au rendu ; champ « saumon fenouil » tapé **sans Entrée** →
  tape → **1** appel dont `q === 'saumon fenouil'` (F14) et `filtres` = textes des puces à l'écran (puce `sans_gluten` →
  'Sans gluten' — F1) ; `etatWeb().enCours` vrai, bouton éteint, `[role="status"]` « L’assistant cherche sur le web… »,
  « Annuler » présent ; **Annuler** → `enCours` faux, `signal.aborted` vrai, écran du bouton, mémoire inchangée ;
  **seconde tape pendant un vol** (une **nouvelle instance** rendue avec la même `ctx` pendant le vol, puis tape :
  c'est ce que fait la ré-instanciation de production) → le premier `signal` est abandonné, 2 appels au total, la
  résolution tardive du premier n'écrit **rien** (`memoire.cle` = celle du second) (F2/F3) ; résolution `trouve` → une
  `a[target="_blank"][rel="noopener noreferrer"]` par lien, `href` égal à `lien.href`, texte = titre, hôte affiché,
  « Demande envoyée : saumon fenouil », avertissement § 5.5 présent, « Garder ce lien » → `deps.navigate` reçoit
  `/add/signet?adresse=…&titre=…` encodés ; `repli` → ligne « Liens tels que trouvés… » ; `rien` → texte + « Réessayer »
  qui rappelle `chercher` avec `enLigne()` vrai (S9) ; `indisponible` × 8 raisons → le bon texte, « Réessayer » absent
  pour `cle_refusee`/`recherche_desactivee`/`refus`, lien Réglages présent pour les deux premières ; `chercher` qui
  **lève** → `indisponible`/`interne`, « L’assistant n’a pas répondu. Réessaie. », `enCours` faux (F12) ; **puce ajoutée**
  après `trouve` → les liens RESTENT, la mention « La demande a changé depuis cette recherche. » apparaît, aucun appel (K1) ;
  puce retirée → la mention disparaît, aucun appel ; `autres` non vide → `details` « Autres pages trouvées ({n}) » replié avec
  ses liens (K2) ; raison `delai` → « Code : delai » sous le texte générique (K3) ; **nouvelle instance** rendue avec la même `ctx` et la même `q` → les liens de la mémoire, 0 appel
  (F3) ; mode `all` avec la même `q` → aucun lien web ; **aucun `innerHTML`** (un titre `<b>x</b>` rendu littéralement).
  `run()` n'est pas invoqué par ces tests (il appelle `location.replace` sur la page de tests) : la ré-instanciation est
  simulée en appelant `renderSearch` une seconde fois (F3).
- **9.6 Signet prérempli.** Route avec `query = { adresse: 'https://exemple.test/r', titre: 'Saumon' }` → les deux champs
  remplis, bannière « Adresse reçue : vérifie-la avant d’enregistrer. » avec `strong` « exemple.test », bouton ouvert,
  **0 écriture** en base ; `adresse: 'javascript:alert(1)'` → champ montré, « Adresse non reconnue. », `strong` vide,
  bouton fermé ; adresse de 3 000 caractères → champ **entier**, « Adresse trop longue. », bouton fermé (F9) ; titre de 400
  points de code avec U+202E → 300 sans U+202E ; route **sans** `query.adresse` → aucune bannière.
- **9.7 Comportement inchangé (tests écrits AVANT le refactor, verts dès le départ — exception nommée à « rouge
  d'abord », F19).** `AnthropicProvider.complete` avec un `fetch` global remplacé (comme `tests/ajouter.js` l. 592-618) :
  URL `https://api.anthropic.com/v1/messages`, les quatre en-têtes, corps `{ model, max_tokens, system, messages }` ;
  `OpenAICompatibleProvider` intact ; `lireBornee`/`signalDelai`/`OPTIONS_FETCH` toujours lus depuis
  `src/ui/livre-ajout.js` par `tests/ajouter.js` (ré-export) ; `borner` dans `livre-ajout.js` tronque toujours à
  `LIMITES_ISBN.champ` ; `filterChips` rend les mêmes libellés qu'avant via `libellePuce` ; `searchDocs(docs,
  parseQuery('salade'), { mode: 'web' })` → `admissible.length === 0` et `notice === undefined` ; `tests/backup.js` sur le
  secret `llm` reste vert.
- **9.8 Statiques.** `sw.js` : `SHELL` contient les deux modules neufs (garde existante) et `VERSION ===
  'cuisine-os-v0.5.0-1'` ; `APP_VERSION === '0.5.0'` ; chaque texte « » des § 5 et 6 a sa clé dans `en.js` ; les sources de
  `src/ui/search.js` et `src/domain/search.js` ne contiennent plus « Le Web n’est pas activé » ; `supportsWebSearch` vaut
  `false` pour `none` et `openai_compatible`, `true` pour `anthropic` ; `anthropicHeaders('k')` rend exactement les quatre
  en-têtes ; `src/domain/recherche-web.js` et `src/core/bornes.js` n'importent rien de `src/ui/`.
- **Node** : `node --test tools/*.test.mjs` 40/40 et `--check` 0 inchangés (aucun outil touché).

## 10. Risques, murs hors code, décisions ouvertes

- **R1 Modèle libre.** `web_search_20250305` vaut pour tous les modèles actuels ; si Anthropic la retire un jour, l'appel
  rendra 400 → `requete` → « L’assistant n’a pas répondu. ». Dette nommée.
- **R2 Coût — le mur est côté compte (S7/S14).** Chaque tape coûte 1 à 3 recherches (0,01 à 0,03 $) plus les jetons,
  **résultats lus compris** : de l'ordre de 0,05 à 0,20 $ avec Opus 5.5, à mesurer. Un appel annulé ou abandonné au délai
  est facturé quand même. Côté app : aucune tape automatique (I-B), un seul vol (I-I), mémoire par demande (pas de
  second appel pour la même demande). **Gestes de Neegan, hors code** : utiliser une clé d'un **workspace Anthropic
  dédié à Cuisine OS avec un plafond de dépense mensuel**, et **ne pas entrer cette clé sur le site public tant que D5
  (sous-domaine dédié) n'est pas fait** — sur `neegans.github.io`, toute autre page Pages du compte lit la clé (I-C).
- **R3 Pays fixé à `CA`.** Hypothèse produit (app née au Québec). Deviendra un réglage si la douleur est réelle.
- **R4 L'assistant peut ne pas chercher** : issue `pas_cherche`, texte honnête, « Réessayer » (F10). Le `system` insiste.
- **R5 Injection par les pages lues (S1/S2).** Le serveur lit le web ; le texte de l'assistant et les titres des pages
  peuvent porter du contenu hostile. Murs : seules les adresses **des résultats** s'affichent (I-A) ; titres, dates et
  « pourquoi » bornés et nettoyés, nœuds texte (I-H) ; **aucune affirmation de l'assistant n'est présentée comme une
  vérification** (I-K : avertissement fixe). Reste vrai : un « pourquoi » peut être faux ou flatteur — c'est pour ça que
  l'avertissement est permanent et que la page s'ouvre pour être lue.
- **R6 Délai de 45 s.** Trop court pour trois recherches lentes → `delai` et « Réessayer » (double coût) ; trop long pour
  une personne pressée → « Annuler ». Mesure réelle à faire par Neegan ; valeur injectable.
- **R7 Vie privée (S15).** Partent chez Anthropic : la demande, les textes des puces, la langue, `CA`, le fuseau, l'IP.
  Les restrictions alimentaires (« sans gluten ») peuvent relever de la santé au sens de la Loi 25 : c'est la personne
  qui choisit de les envoyer, à chaque tape, et l'écran le dit (« Une recherche = un appel à ton compte Anthropic. »).
  Rien de la bibliothèque, pas de compte Cuisine OS, pas d'identifiant d'appareil.
- **R8 Citations.** Les conditions d'usage demandent d'afficher les sources quand on montre la sortie de l'API : l'écran
  montre **les sources elles-mêmes** (les liens), et rien d'autre du texte que « pourquoi », rattaché à son lien.
- **R9 Lien profond du signet (S4).** `#/add/signet?adresse=…` est partageable : une adresse d'hameçonnage arrive
  préremplie. Dos-d'âne : bannière + hôte recalculé en gras, aucune écriture sans « Enregistrer ». Le mur reste la
  lecture de l'hôte par la personne.
- **R10 Classement des erreurs par texte (S12).** Le 400 « not enabled » est reconnu par `error.message` ; un libellé
  changé le fait retomber dans `requete` (texte générique, pas faux). Un 403 est dit « refusée, ou n’a pas ce droit ».
- **R11 Décisions du 17 octobre (kit).** Mistu reste **personnel** : pas de passerelle serveur ni de clé commune ; la clé sur
  l'appareil et le plafond de dépense du compte restent le mur. « Créer avec l'IA » (en option, sur les versions de recette
  existantes et leur provenance) = **lot 2** ; refonte visuelle (références du kit) = **lot 3**. Un lot à la fois.
- **Non prouvé par la construction** : un appel réel avec la clé de Neegan (statut et corps exacts d'un compte sans
  recherche web ; forme réelle de `page_age`, `web_search_requests`, `pause_turn`, `refusal` ; taille réelle du corps ;
  durée ; coût) ; `target=_blank` et `navigator.onLine` depuis une PWA installée sur iPhone ; Safari.

## 11. Traçabilité des revues

### 11.1 Constats et réponses (rév. 1 → rév. 2, puis kit → rév. 2.1)

| Constat | Sévérité | Réponse |
|---|---|---|
| S1 un « pourquoi » peut affirmer une compatibilité jamais vérifiée | **Bloquant** | I-K ; § 5.5 avertissement fixe toujours affiché ; § 4.1 `system` interdit l'affirmation (best-effort nommé R5) |
| S2 / F8 titre et date non bornés (Cc/Cf, bidi) ; `nettoyerChaines` ne retire que les Cc (vérifié `src/sync/lots.js`) | Important | § 4.3 `borner(title, 300)`, `borner(page_age, 40)` ; § 6 titre borné à l'entrée ; tests 9.1, 9.6 |
| S3 / F9 adresse tronquée = adresse inventée ; `signetModel` refuse déjà | Important | I-A « jamais tronquée » ; § 6 adresse telle quelle → « Adresse trop longue. » ; titre par points de code |
| S4 lien profond du signet = porte ouverte | Important | § 6 bannière « Adresse reçue… » + hôte en `strong` ; R9 ; test 9.6 |
| S5 / F13 puces changées → résultats périmés ; appel en vol non muet | Important | § 5.1 mémoire par **clé de demande** (puces comprises) ; I-G ; test 9.5 |
| S6 / F14 ce qui part n'est pas ce qui est visible | Mineur / Important | I-J ; § 5.4.1 champ relu à la tape ; § 5.5 « Demande envoyée : {q} » ; test 9.5 |
| S7 clé lisible par toute page de l'origine | Important | I-C redit « dos-d'âne » ; R2 : workspace dédié à plafond + D5 avant la clé publique (gestes Neegan) |
| S8 / F11 2 Mio pas en flux ; `lireBornee` inaccessible au domaine ; `fetch` comme méthode ; options du lot ISBN | Mineur / Important | § 7.2 `core/bornes.js` reçoit `lireBornee`/`signalDelai`/`OPTIONS_FETCH`/`borner` ; § 4.5 fonction libre, `corpsErreurMax` 64 Kio ; test 9.4 |
| S9 « Réessayer » ne sort jamais de `hors_ligne` | Mineur | § 5.4.3 `depsForces = { enLigne: () => true }` ; test 9.5 |
| S10 / F12 pas de filet : `enCours` figé | Mineur / Important | § 4.5 ne lève jamais (`interne`) ; § 5.4.5 `try/catch` écran ; tests 9.4, 9.5 |
| S11 / F5 / F6 `non_configure` sans texte ; `supportsWebSearch` mort | Mineur / Important | § 5.2 garde unique par `providerFrom(…).configured` et `.supportsWebSearch` ; mêmes textes pour les issues |
| S12 400 « not enabled » par sous-chaîne ; 403 | Mineur | § 4.5 `error.message` du JSON borné ; texte 403 « ou n’a pas ce droit » ; R10 |
| S13 / F7 jointure `\n`, prose avant JSON, entrée `null` | Mineur / Important | § 4.3 sans séparateur ; § 4.4 entrées non-objets ignorées ; tests 9.1, 9.2 |
| S14 coût sans plafond, abandon non remboursé | Mineur | R2 : mur côté compte ; « Annuler » nommé comme facturé ; mémoire évite les doubles appels |
| S15 vie privée incomplète (IP, tiers, Loi 25) | Mineur | I-C, R7 complétés |
| F1 `include`/`exclude` sont des ids ; `exclude_text`, `max_active`, `quick` ignorés ; libellés | **Bloquant** | § 4.1 `filtres` = **textes des puces** ; § 7.3 `libellePuce` partagée avec `filterChips` ; test 9.5 'Sans gluten' |
| F2 `enCours` incohérent, seconde tape impossible, `pourQ` mort | **Bloquant** | § 5.1 état de module (`vol`, `memoire`) ; § 5.4 ; `pourQ` supprimé ; scénario 9.5 « nouvelle instance pendant le vol » |
| F3 `run()` ré-instancie la route (vérifié `router.js` l. 23-27, `app.js` l. 94) | Important | § 5.1 : l'état survit à l'instance ; vol unique abandonné à la tape ; tests 9.5 sans `run()` |
| F4 `navigate` non injecté ; pas de fait attendu ; pas de fixture `ctx` | Important | § 5.7 `deps.navigate` ; `etatWeb()` / `reinitialiserWeb()` ; fixture nommée en 9.5 |
| F10 `pause_turn`/`max_tokens`/« pas cherché » tombent dans `rien` ; 4xx orphelins | Important | § 4.3 `aCherche` ; § 4.5 `interrompu`, `pas_cherche`, fourre-tout 4xx → `requete` ; I-F |
| F15 pins `v0\.4\.1` rougissent | Important | § 8 liste exacte des trois lignes ; 9.8 les remplace |
| F16 « search.js » = deux fichiers ; `notice` mort du domaine | Mineur | § 5.7 et § 8 chemins complets ; `notice` retiré de `domain/search.js` et `pairing.js` ; test 9.7 |
| F17 compte « 3 + 2 » ambigu | Mineur | 9.1 fixture écrite entrée par entrée → 4 |
| F18 chrono, `Intl`, branche anglaise non injectables / non testés | Mineur | § 4.2 `fuseau` injecté ; `AbortController` dep retiré ; 9.3, 9.4 |
| F19 test « inchangé » ne peut pas être rouge d'abord | Mineur | 9.7 exception nommée : écrits avant, verts |
| F20 pas d'`aria-live`, pas d'annulation, retour arrière repaie | Mineur | § 5.4.6 `role="status"` + « Annuler » ; mémoire par demande (F20) |
| F21 dédoublonnage et « un seul choix survit » | Mineur | § 4.3 égalité exacte voulue ; § 4.4 complément par les résultats restants |
| F22 ordre des tâches, imports, `q`, `refus` avec résultats | Mineur | plan séparé (writing-plans) ; § 5.4 définit `q` ; § 4.5 `refus` avant `trouve` |
| K1 (kit) cacher les liens à chaque puce touchée est brutal | Important | I-G, § 5.1, § 5.5 : liens conservés + « La demande a changé depuis cette recherche. » |
| K2 (kit) compléter à cinq dilue la sélection | Important | § 4.4 `autres` repliés « Autres pages trouvées ({n}) », plus de complément |
| K3 (kit) causes distinctes écrasées par un texte générique | Mineur | § 5.6 « Code : {c} » sous le texte générique |
| G1 (kit) test de navigation du plan comptait la navigation de `lancer()` | Mineur | plan T7 : navigations vers `/add/signet` comptées à part |
| G2 (kit) la clé pouvait suivre une redirection | Mineur | § 4.5 / plan T4 : `redirect: 'error'` sur l'appel Anthropic |

### 11.2 Ce que la construction a amendé

Une ligne par écart entre cette spec et ce qui a été construit (tâches 1 à 9, registre
`.superpowers/sdd/2026-10-17-chercher-sur-le-web/progress.md`), avec son coût si le ruling était faux.

- **R-WEB-1** (T3/T6) `construireDemande` rend aussi `q` et `filtres` **nettoyés** ; `lancer` envoie et mémorise
  ceux-là (`memoire` = `{ cle, issue, q, filtres }`, pas seulement `{ cle, issue }` du § 5.1) ; l'écran rappelle la
  demande partie (« Demande envoyée : … »), jamais la saisie brute. Coût si faux : aucun.
- **R-WEB-2** (T6) `lancer` ne réanalyse le champ que s'il a changé depuis la dernière analyse
  (`input.value.trim() !== state.q`, amende § 5.4.1) : les filtres ajoutés par les listes « + type » / « + restriction »
  et les puces retirées à la main survivent à la tape. Coût si faux : un filtre perdu.
- **R-WEB-3** (T7) un `trouve` dont aucune carte ne survit à la revalidation au rendu se rend comme `rien`. Coût si
  faux : un titre vide.
- **R-WEB-4** (T4, ruling corps-avant-try) le corps **et** les en-têtes de la requête sont construits avant le `try` du
  réseau : une exception y devient `interne` (filet), jamais `reseau`. Coût si faux : un classement d'erreur.
- **R-WEB-5** (T4 ronde 1) garde de forme de la clé `/^[\x21-\x7e]+$/` → `cle_refusee` avant tout appel (une clé
  collée avec un caractère invisible faisait un `TypeError` de `fetch` classé `reseau`) ; `chercherRecettesWeb(null)`
  ne lève pas (destructuration dans le `try`) ; après la lecture d'un corps d'erreur, un abandon extérieur → `annule` ;
  `ctl.abort()` en `finally`. Coût si faux : quelques lignes dans une fonction, un classement de plus.
- **R-WEB-6** (T4 ronde 1, amende le tableau du § 4.5) un **403** passe par la même lecture bornée que le 400 :
  `error.message` « web search … not enabled / disabled » → `recherche_desactivee`, sinon `cle_refusee` ; 401 →
  `cle_refusee`. Coût si faux : un classement de plus.
- **R-WEB-7** (T7 ronde 1, amende § 5.1 et § 5.6) K1 ne vaut que pour `trouve` (garder des **liens** visibles quand la
  demande change) ; toute autre issue en mémoire ne s'affiche que si `memoire.cle === cle`, sinon écran du bouton ; les
  écrans sans « Réessayer » (`cle_refusee`, `recherche_desactivee`, `refus`, `non_configure`, `non_pris_en_charge`)
  offrent « Chercher à nouveau » (= `lancer()`, sans forcer `enLigne`) — sans quoi une clé corrigée dans Réglages
  laissait l'écran « clé refusée » sans issue jusqu'au rechargement. Coût si faux : un bouton de plus. Résidu nommé : un
  `trouve` sans carte survivante (rendu `rien`, R-WEB-3) suit encore K1.
- **R-WEB-8** (T8 ronde 1, amende le code du § 6) l'hôte de la bannière « Adresse reçue » vient de
  `signetModel(etat).hote || ''` (même décision que l'enregistrement : rognage, longueur) ; la garde `recue` exige
  `query.adresse.trim() !== ''` ; la bannière est volontairement statique (« reçue » = l'adresse telle qu'arrivée).
  Coût si faux : aucun.
- **K1-K3, G1-G2** (kit, rév. 2.1) : déjà au § 11.1. K2 : `choisirLiens` rend `{ liens, autres, repli }` (l'en-tête du
  § 4.4 dit encore `{ liens, repli }` ; son point 4 fait foi).
- **État de l'écran** (T6-T7) : `vues` est un ensemble de `{ root, redessiner }`, purgé à **chaque rendu** du mode Web
  (pas seulement au moment de notifier, § 5.1) et dédoublonné par racine ; « Résultat reçu. », rendu provisoire de la
  tâche 6, est remplacé par les écrans des § 5.5-5.6 en tâche 7. Coût si faux : aucun.
- **Tests durcis par les revues** : T3 (adresse inventée sur un hôte réel, Cf/bidi placés **avant** la coupe,
  `u:p@` côté choix, repli à 7 résultats) ; T4 (filet et ruling corps-avant-try testés par un getter piégé et un stub de
  `console.error` ; vraie `Response` en flux sous la borne) ; T6 (I-I prouvé sans « Annuler », redessin à la résolution
  lu dans le DOM, filtres comparés aux `.chip` du DOM, aide « Écris d’abord ce que tu cherches. » basculée à la frappe
  avec `data-role="aide-web"`, `Object.freeze(ISSUE_INTERNE)` — ces deux derniers avec deux lignes de code) ; T7
  (« Demande envoyée » exacte, `href` avec identifiants revalidé au rendu, « Réessayer » discriminé par
  `enLigne: false`, constantes au niveau du module, `Object.hasOwn`). Coût si faux : aucun sur le produit, des
  assertions de plus.
- **Fixtures du plan corrigées** : pré-vol, le test R-WEB-1 attend la `q` nettoyée passée au module, et les blocs d'écran
  forcent `setUiLocale('fr')` en tête ; T5 « en quinze minutes » → « en 15 minutes » (l'analyseur ne lit que les
  chiffres) ; T6 « saumon » et « fenouil » sont des ingrédients du lexique → puces `avec …` (textes des puces lus dans
  le DOM) ; T7 le test R-WEB-1 clique « Chercher à nouveau » (K1), et la vérification sans `innerHTML` passe par
  `vraiFetch` (le bloc piège `fetch`). Coût si faux : aucun (entrées de test, attendus et code inchangés).
- **Notes de couche** : `libellePuce` est l'ancien `chipLabel` (déjà exporté), renommé ; `lireBornee`, `signalDelai`,
  `OPTIONS_FETCH` et `borner` sont déplacés dans `src/core/bornes.js` et ré-exportés par `livre-ajout.js` (`borner` y
  est appelée avec `LIMITES_ISBN.champ`).
- **Dictionnaire et versions** (T8-T9) : « Adresse reçue : vérifie-la avant d’enregistrer. » est entrée dans `en.js` dès
  la tâche 8 (le contrôle F13 de `tests/ajouter.js` couvre `signet.js`) ; « Annuler » existait déjà : la tâche 9 ajoute
  22 clés, aucune en double, et retire la clé morte. Le contrôle du § 9.8 passe par une liste explicite de 28 clés (les
  textes `indisponible` passent par `t(cle)` avec une variable : aucune lecture du source ne les voit). `VERSION` est
  épinglée par le motif `v0\.5\.0-\d+` dans trois suites, pas par la valeur exacte du § 9.8 ; la valeur réelle est au
  § 8. Total épinglé à la clôture : **1752** (`tests/tests.js`), suite 1753/1753. Coût si faux : aucun.
