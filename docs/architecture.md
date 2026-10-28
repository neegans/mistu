# Architecture — Cuisine OS V0

## Choix

- **PWA sans étape de build** : modules ES natifs, aucune dépendance npm. Un serveur statique suffit. Choix guidé par « éviter la surarchitecture » (spec §15) et par la possibilité de tout vérifier en ouvrant l'app.
- **Local-first** : IndexedDB comme base unique (un magasin par entité), blobs (photos, PDF) stockés dédupliqués par SHA-256 dans le magasin `files`. La sauvegarde complète (ZIP) reste un mécanisme de durabilité et de transfert entre appareils, utilisable sans compte. Depuis le lot L3, **les fiches** peuvent aussi voyager par un serveur Supabase quand un compte est connecté (voir « Synchronisation (L3) ») ; depuis le lot G, les **octets des fichiers** voyagent aussi (L4 : voir « Fichiers (L4, lot G) »). L'app reste utilisable sans compte, sur un appareil seul.
- **Déterministe avant IA** : unités, portions, courses, régimes, sauvegarde et recherche sont du code sans LLM. L'IA est une abstraction `LLMProvider` (aucun, ou la passerelle `assistant` ; depuis le 18 octobre, plus de fournisseur compatible OpenAI ni de clé dans l'app) branchée sur l'extraction de pages et d'index, et sur la recherche web (Anthropic seulement), où le texte de l'assistant ne peut qu'étiqueter des pages que le serveur a réellement rapportées ; la lecture de la réponse et le choix des liens sont du code sans LLM ; et, depuis le 18 octobre, sur la création d'une recette (Anthropic seulement), dont la sortie est une donnée validée champ par champ par du code sans LLM. Ses résultats sont toujours « à vérifier ».

## Carte des modules

```text
index.html, styles.css, manifest.webmanifest, sw.js
src/app.js                 coquille, navigation, routes
src/core/    db.js (IndexedDB), router.js (#/…), dom.js (el, dialogues), i18n.js (FR clé, EN dictionnaire), hash.js (SHA-256 + repli), zip.js (ZIP stored), ids.js, bus.js,
             bornes.js (borner, lireBornee, signalDelai, OPTIONS_FETCH : bornes des appels distants, pur, sans import)
src/model/   schema.js (magasins, relations, vocabulaires), seed.js (unités, conventions, ingrédients FR/EN, presets d'appareils), repo.js (accès, réglages, activité, fichiers)
src/domain/  quantity.js (fractions, plages, qualitatif), units.js (conventions, conversions, affichage), lines.js (analyse d'une ligne d'ingrédient), scaling.js,
             diet.js, grocery.js, search.js (langage naturel → pastilles; groupes), dishes.js (rapprochement, comparaison), pairing.js (accompagnements, résumé de repas),
             rediscover.js, timers.js, backup.js (archive, inspection isolée, restauration, vérification), exporters.js (JSON-LD, YAML Paprika, HTML), llm.js, passerelle.js (transport vers la fonction `assistant` — voir « La passerelle de l'assistant »),
             recherche-web.js (demande, corps, lecture de la réponse et choix des liens de la recherche web ; un appel, ne lève jamais),
             assistant-config.js (normalisation de la configuration de l'assistant IA, pure — voir « L'assistant suit le compte »),
             creation-ia.js (demande, validation, fabrication et appel de « Créer une recette avec l'assistant » — voir cette section)
src/ui/      state.js (cache), components.js, home, search, library, book, dish, recipe, recipe-edit, cook, import, meals, grocery, kitchen, settings, add,
             creer-ia (écran #/recipes/creer)
src/sync/    tables.js, mime.js, clock.js, outbox.js, config.js, auth.js — voir « Synchronisation (L1-L2) »
             transport.js, lots.js, reponses.js, push.js, backfill.js, pull.js, conflits.js, moteur.js — voir « Synchronisation (L3) »
src/core/log.js            point d'entrée unique du journal d'erreurs (logError)
src/vendor/  supabase-2.117.3.umd.js (dépendance embarquée, vérifiée deux fois)
tests/       tests.js + index.html : tests du domaine ; backup.js : régressions IndexedDB dans des bases temporaires ; sync.js : lot « compte et stockage distant » (L1-L2) ;
             sync-l3.js + transport-factice.js + sync-fixture.js : lot « envoi et réception » (L3), transport simulé, aucun réseau ;
             assistant-compte.js : lot « l'assistant suit le compte » ; creer-ia.js : lot « créer une recette avec l'assistant » (fetch factice injecté) ;
             passerelle.js : lot « la passerelle de l'assistant » (fetch factice injecté) ; côté serveur, tools/assistant-*.test.mjs (Node)
```

## Dépendance embarquée

`supabase-js` est embarqué en un seul fichier autonome, jamais installé par `npm` à l'exécution (spec § 6.1) :
`src/vendor/supabase-2.117.3.umd.js` est une copie **octet pour octet** de `dist/umd/supabase.js` tiré du tarball
npm officiel `@supabase/supabase-js@2.117.3` (bundle IIFE, `globalName` `supabase`, ~213 Ko). Il est chargé par un
`<script src="./src/vendor/supabase-2.117.3.umd.js">` **classique** (jamais `type="module"`, un IIFE n'y
exposerait rien), **avant** `src/app.js` dans `index.html` et avant `tests.js` dans `tests/index.html`. Le bundle
`+esm` de jsDelivr est exclu : il importe huit modules du CDN à l'exécution, ce qui violerait la CSP
`script-src 'self'` et la portée « aucune dépendance npm à l'exécution ».

**Deux vérifications distinctes**, faites par `tools/verifier-vendor.mjs` (Node, zéro dépendance) :
1. l'archive `.tgz` obtenue par `npm pack @supabase/supabase-js@2.117.3` (sans `npm install`) confrontée au
   `dist.integrity` publié par le registre npm (sha512 en base64) ;
2. le fichier `dist/umd/supabase.js` extrait de cette archive (`tar -xzf …tgz package/dist/umd/supabase.js`) haché
   en sha256 et comparé octet pour octet au même fichier servi par unpkg
   (`https://unpkg.com/@supabase/supabase-js@2.117.3/dist/umd/supabase.js`).

Obtention (dans un dossier hors dépôt, jamais le `.tgz` commité) :

```sh
cd <dossier hors dépôt> && npm pack @supabase/supabase-js@2.117.3
tar -xzf supabase-supabase-js-2.117.3.tgz package/dist/umd/supabase.js
node tools/verifier-vendor.mjs 2.117.3 <chemin du .tgz> package/dist/umd/supabase.js
```

Sortie obtenue le 12 octobre 2026 (les deux vérifications réussies) :

```json
{
  "version": "2.117.3",
  "integrity_registre": "sha512-K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==",
  "archive_ok": true,
  "umd_sha256": "d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3",
  "unpkg_sha256": "d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3",
  "umd_ok": true
}
```

Mise à jour : **manuelle**, jamais automatique. Pour une nouvelle version, refaire les deux vérifications
ci-dessus (ou, pour revérifier seulement le fichier déjà commité sans ravoir l'archive :
`node tools/verifier-vendor.mjs --local src/vendor/supabase-<version>.umd.js <version>`, qui ne fait que (2) et
imprime le sha256), puis remplacer le fichier dans `src/vendor/` et les deux `<script>` qui le chargent.

## Synchronisation (L1-L2)

Spec du lot : `docs/spec-compte-et-stockage-distant.md` (conception amont : `docs/compte-et-stockage-distant.md`).
Livré ici : le serveur en migrations, la connexion, la capture des écritures. L'échange de données lui-même est le
lot L3, décrit dans « Synchronisation (L3) » juste après.

### Modules

```text
src/sync/tables.js    TABLES : par magasin synchronisable, la clé, les colonnes générées (index de STORES + size/mime
                      pour files) et les champs de relation obligatoires. Source de vérité du générateur de migrations.
                      keyOf(store, record) : la clé d'une fiche, fonction unique (outbox, envoi, réception).
src/sync/mime.js      liste blanche fermée des six types synchronisables, resolveMime (type déclaré, sinon extension,
                      sinon application/octet-stream + syncable:false), safeDisplayType, extensionFor, displayUrl.
src/sync/clock.js     syncNow() : horloge corrigée du décalage serveur, strictement croissante (offset 0 avant L3).
src/sync/outbox.js    installCapture(db, …) : pose db.onMutate ; ne fait que remplir la file.
src/sync/config.js    SUPABASE.prod / SUPABASE.dev (url + anonKey + hosts, valeurs publiques) ; currentConfig(hostname)
                      rend l'entrée dont hosts contient l'hôte (liste blanche, minuscules) et null sinon : une
                      origine non nommée n'a aucune configuration, elle ne retombe jamais sur prod (S1).
src/sync/auth.js      createAuth : client PKCE depuis globalThis.supabase, signIn/signOut, handleReturn (échange du
                      code puis retrait de l'historique), garde de compte, readError (phrase fixe, jamais le texte brut).
src/core/log.js       logError(code, details) : un code et une liste blanche d'identifiants ; jamais e.stack, jamais
                      le corps d'une réponse. Seul console.error du dépôt (reste un console.warn dans app.js quand
                      l'enregistrement du service worker échoue).
```

### Une seule porte d'écriture

`db.mutate({ puts, deletes, clearStores, origin, payloads })` est la seule transaction d'écriture de `src/core/db.js` ;
`put`, `putMany`, `putBatch`, `delete`, `deleteMany`, `clear`, `clearAll` en sont des enveloppes (`MUTATING_METHODS`).
`installCapture` y branche `db.onMutate`, qui renvoie les lignes d'outbox **écrites dans la même transaction** que la
donnée : une écriture annulée ne laisse aucune entrée de file.

- Une suppression met en file son `payload` (copie de la fiche au moment de la suppression) ; un `put` sera relu à
  l'envoi.
- `origin: 'remote'` (réception, ajustement d'horloge) et `origin: 'device'` ne sont **jamais** capturés.
- `settings` n'est pas synchronisable ; `library_activity` n'entre en file que si le réglage « Synchroniser mon
  historique de consultation » est actif (lu par `src/ui/state.js`, relu à chaque événement qui peut le réécrire).
- Une ligne `files` hors liste blanche (`syncable: false`, ou un `mime` absent de la liste) reste locale et n'entre
  jamais en file.
- Un test statique de `tests/sync.js` échoue si un fichier de `SHELL` autre que `src/model/repo.js`, `src/sync/*`,
  `src/domain/backup.js` et `src/core/db.js` appelle une méthode mutante de `db` directement.

### Magasins internes

`SYNC_INTERNAL_STORES = ['outbox', 'sync_state', 'sync_conflicts']` (`DB_VERSION` 2). Ils sont **hors archive** :
`ARCHIVE_DATA_STORES` les exclut, l'inspection et la vérification de restauration n'en voient aucune trace, les puces
« Données sur cet appareil » ne les listent pas, et un remplacement par ZIP ne les vide pas. Seul `repo.clearDevice()`
les vide — en une transaction sans capture, en gardant `sync_state.device_id`. Un magasin qui n'est **pas** interne
partage ces trois traits depuis le lot « L'assistant suit le compte » : `assistant_config` (la configuration de l'assistant, synchronisée) est
hors archive, un remplacement par ZIP ne le vide pas, et `repo.clearDevice()` le vide (voir « L'assistant suit le
compte »). L'identité d'appareil vit dans
`sync_state.device_id` (plus aucun reflet dans `localStorage`) ; l'ancienne clé `cuisineos.device` est reprise une
seule fois puis retirée.

### Dépendance embarquée

`src/vendor/supabase-2.117.3.umd.js`, chargé par un `<script>` classique avant `src/app.js` (détail et procédure :
« Dépendance embarquée » ci-dessus). Deux empreintes, vérifiées par `tools/verifier-vendor.mjs` :

- fichier servi (sha256) : `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3` ;
- tarball npm (`dist.integrity` du registre) : `sha512-K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==`.

Si `globalThis.supabase?.createClient` est absent, `createAuth` reste indisponible avec le motif `bibliotheque` et
l'interface le dit ; l'application démarre quand même (invariant I4 : utilisable sans compte).

### Durcissement du client

`index.html` **et** `tests/index.html` portent la même balise
`Content-Security-Policy` — `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none';
form-action 'none'` — et `<meta name="referrer" content="no-referrer">`. `script-src 'self'` n'est jamais élargi ;
`frame-ancestors` n'est jamais ajouté (WebKit l'hérite dans un document `blob:` et refuse alors le cadre) ;
`connect-src https:` reste large parce que la `base_url` d'un fournisseur d'IA est libre. Les PDF et EPUB s'affichent
dans une `<iframe sandbox>` sans `allow-same-origin`, avec un bouton de téléchargement permanent ; aucun
`window.open` sur un `blob:` ne subsiste.

Service worker : `sw-rules.js` (partagé avec les tests par `importScripts`) ne met en cache que les GET de même
origine **sans chaîne de requête** — un retour `?code=…` est servi par le réseau et jamais stocké.

### Côté serveur

`supabase/migrations/0001_tables_et_regles.sql` (séquence `sync_seq`, 25 tables, déclencheur `touch_server_seq` qui
pose `server_seq` et **fige `deleted_at`** hors `app.sync_push` — les deux colonnes appartiennent au serveur, R25 et
S2 —, RLS avec `is_allowed()` sur chaque règle, règle `delete` gardée par `app.purge`, schéma `private`, fonction du crochet
« Before User Created » + déclencheur de secours, `sync_push`, `sync_purge`, `sync_purge_all`, révocations, tâche
`pg_cron` des tombales) et `supabase/migrations/0002_stockage.sql` (seau privé `pages`, ses quatre règles, vue
`private.storage_usage`). Les deux fichiers sont **générés** par `tools/generer-migrations.mjs` depuis
`src/sync/tables.js` et `src/sync/mime.js` : ne pas les éditer à la main ;
`node tools/generer-migrations.mjs --check` sort en code 1 si les fichiers commités diffèrent du généré
(`--dir <chemin>` vise un autre répertoire, pour l'écriture comme pour la vérification : c'est ainsi que `--check`
lui-même est éprouvé, sur une copie altérée dans un répertoire temporaire).
Application et preuves : `supabase/README.md` (gestes manuels de Neegan dans l'éditeur SQL, preuves `supabase/proofs/`).
Une troisième migration, `0003_assistant_config.sql`, à ajout seul, est générée de la même façon et fait partie de
`--check` (voir « L'assistant suit le compte ») ; `0001` et `0002` ne changent pas.

## Synchronisation (L3)

Spec : `docs/spec-compte-et-stockage-distant.md` § 5.3 (envoi), § 5.5 (réception et conflits), § 5.2 (envoi
initial), § 4.2 (interface), § 11 (amendements R37 à R56). Livré ici : **les fiches** voyagent entre les appareils
d'un même compte — envoi, envoi initial, réception, conflits, quarantaine, pause, et un moteur qui décide quand.
Les **octets** des fichiers ne sont pas de L3 : ils voyagent depuis le lot G (L4, voir « Fichiers (L4, lot G) ») ; la purge du serveur reste L5.

### Modules (huit, un rôle chacun)

```text
src/sync/transport.js  le SEUL module qui parle au serveur : pousser(elements) → sync_push (RPC), lire(table, apres,
                       limite) → lecture par server_seq croissant. classerErreur() range toute erreur en cinq types :
                       reseau (0, 5xx, 429), auth (401, 403, P0001 « adresse non autorisée »), quota (413, 507,
                       « exceeded »), refus (autre 4xx : une règle du serveur) et inconnu. Le client vient de
                       auth.getClient() (R53) ; dans les tests, tests/transport-factice.js le remplace.
src/sync/lots.js       pur : dédoublonnage par (store, id) — la version la plus récente —, ordre des seq, bornes
                       LIMITES { elements: 500, lot: 921600, element: 524288 } (R39), nettoyage des caractères de
                       contrôle, cleDe(). Rend { lots: [{ elements, seqs }], retenues: [{ seq, seqs, raison }] }.
src/sync/reponses.js   pur : une réponse de sync_push → des EFFETS ({ retirer, reecrire, conflits, quarantaine }).
                       Une clé nommée hors du lot envoyé n'a aucun effet (R41).
src/sync/push.js       une passe d'envoi : lecture de la file, relecture des fiches (un put est relu, une suppression
                       part avec son payload), envoi par lots, application des effets en UNE transaction. Erreurs :
                       recul exponentiel 2 s → 5 min (tries, next_try_at), attente de connexion sur auth, pause sur
                       quota, dichotomie sur refus jusqu'à nommer la fiche fautive (quarantined_at + last_error).
src/sync/backfill.js   envoi initial : ce qui existait AVANT la connexion est mis en file table par table, commandé
                       par des marqueurs sync_state (backfill:<table> = 'fait'), reprenable, par morceaux de 500.
src/sync/pull.js       réception : par table, pages par server_seq croissant ; la page et le curseur
                       (sync_state cursor:<table>) sont écrits dans la MÊME transaction, et le curseur ne recule
                       jamais (R46). Décision I7, conflits, ordre recipe_versions avant recipes (R45).
src/sync/conflits.js   les deux gestes : garderIci (version locale réécrite avec un updated_at neuf, donc renvoyée)
                       et garderAilleurs (version du serveur écrite, sans renvoi) ; purgerAnciens (30 jours).
src/sync/moteur.js     quand : déclencheurs (démarrage, online, retour au premier plan, écriture regroupée à 2 s,
                       « Envoyer maintenant », reprise après un recul), UNE passe à la fois, état observable.
```

### Ordre d'une passe

Sans compte, aucune passe n'a lieu : seuls les compteurs de la file sont rafraîchis. Avec un compte :

1. **pause relue** dans `sync_state` (R47) — un autre onglet a pu la poser ;
2. **envoi initial** (`backfill`) tant qu'une table n'a pas son marqueur — sauté si la pause tient ;
3. **envoi** (`push`) : lots, réponses, effets ; la mesure d'horloge rapportée par `server_time` est appliquée ;
4. **réception** (`pull`) — tentée seulement si l'envoi n'a pas buté (erreur, quota découvert, connexion à refaire),
   mais **non** empêchée par une pause de quota déjà posée (R48 : lire ne consomme pas d'espace) ;
5. **« Dernier échange »** horodaté une seule fois, et seulement si un appel a réellement abouti (I5) ;
6. **purge des conflits** de plus de 30 jours ;
7. `finally` : comptes de la file relus et `derniersEffets` publié — ce que la passe a **écrit**
   (`recues`, `supprimees`, `ajustes`, `conflits`), d'où le rafraîchissement des vues (R49, R51).

### État du moteur (ce que Réglages et la pastille lisent)

`{ enCours, phase, progression, dernierEchange, aEnvoyer, enQuarantaine, conflits, pause, attenteConnexion,
horloge, derniereErreur, derniersEffets }`, rendu en copie **figée** (`Object.freeze`), posé seulement par un fait
(I5) : `phase` vaut `envoi_initial`, `envoi` ou `reception` ; `progression` = `{ table, n, total }` ; `pause` =
`{ raison: 'quota', at }` et n'est levée que par « Envoyer maintenant » ; `attenteConnexion` vient d'un 401 ou d'un
refus d'adresse ; `horloge` = `{ minutes }` au-delà de 5 minutes d'écart ; `derniereErreur` ne porte qu'un **type**,
jamais le message du fournisseur. Les abonnés passent par `onEtat(fn)` ; `arreter()` retire les écouteurs de fenêtre
et du bus, pas les abonnés.

### Règle I7, une seule fois

`updated_at` strictement supérieur gagne ; égal + contenu identique = rien ; égal + contenu différent = **conflit**
à trancher par la personne ; aucune fusion silencieuse de champs. Deux précisions mesurées (R44) : les heures se
**comparent par instant** (`Date.parse`) et se **stockent verbatim** (la chaîne du serveur, microsecondes
comprises, pour qu'un renvoi soit égal côté serveur) ; la comparaison de contenu ignore `updated_at` et trie les
clés d'objet récursivement (un `jsonb` revient dans un autre ordre), mais **jamais** l'ordre d'un tableau — une
liste d'étapes a un ordre, c'est du contenu. Les écritures de la réception portent `origin: 'remote'` : jamais
recapturées. `syncNow()` (horloge corrigée du décalage mesuré) horodate tout ce qui doit repartir.

### Fichiers (L4, lot G) et ce qui reste absent (L5)

- **Octets des fichiers** (L4, lot G) : `src/sync/fichiers.js` (définitions uniques et passe « fichiers »),
  `createStockage` dans `src/sync/transport.js` (seau privé `pages`, `upload`/`download`/`list`, jamais d'URL publique
  ni de suppression) ; `files.remote` est un objet `{ sha256, size, mime, quality, uploaded_at, owner }` (plus `true`) ;
  envoi après les fiches, réduit par défaut, l'original reste ici ; téléchargement sur une tape ou par « Télécharger
  toutes les pages » ; espace mesuré sans plan ; archive à `missing_files` et `bytes_*` (R18) ; `identiques` compare
  la projection serveur (R56).
- **Purge du serveur et tombales lisibles** (L5) : `sync_purge` / `sync_purge_all` existent en base, toujours sans
  appelant côté client ; la tâche `pg_cron` des tombales tourne, mais rien ne l'explique dans l'interface. Un
  remplacement par archive ne supprime donc rien chez le fournisseur (R50, O3 ouvert).
- **« Supprimer ma bibliothèque du serveur »** : ce geste n'existe pas (L5). Aujourd'hui, « Effacer les données de
  cet appareil » vide **l'appareil**, pas le serveur — et la phrase de l'écran le dit.
- **Preuve sur appareils** : aucune passe réelle contre le projet `mitsu` n'a encore eu lieu. Tout ce qui précède
  est éprouvé par la suite (transport factice, bases temporaires), pas par deux appareils qui s'échangent une
  recette ; le parcours § 7.3 reste à faire par Neegan.

## Page « Ajouter » et flux des livres

Spec : `docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md` (§ 15.2 : ce que la construction a
amendé). Livré ici : la grille de cinq cartes (six depuis le 18 octobre : « Créer avec l'IA », voir « Créer une recette
avec l'assistant »), un livre créé en deux pas (ISBN ou saisie), les puces « Cuisines »
partagées entre le livre et la fiche recette, l'accueil d'un livre ajouté, le signet (lien web gardé comme
référence), et la couverture (reçue par ISBN ou photographiée).

### Modules neufs (sept, un rôle chacun)

```text
src/ui/puces.js          pucesModel/renderPuces/basculerPuce/ajouterPuce/cuisinesExistantes : un geste de pastilles
                         partagé par le livre (add.js) et la fiche recette (recipe-edit.js) ; graine fermée de
                         quinze cuisines, normalisation (minuscules, accents retirés) pour le doublon, affichage
                         capitalisé ; jamais dans un <label> (R-UX-8 : un clic sur le texte voisin activerait la
                         première puce). Depuis « Identifier un livre, fiable » : motsClesExistants (les `tags`
                         des livres, la fréquence fait l'ordre), suggestionsModel/renderSuggestions (les mots-clés
                         PROPOSÉS par la source, étiquetés « Proposé par Open Library / Google Books », 10 au
                         plus, jamais écrits sans une tape — une suggestion cliquée est une saisie) et un 3ᵉ
                         paramètre `libelleAutre` de renderPuces (« Autre mot-clé »).
src/ui/livre-ajout.js    lookupIsbn — trois issues : trouvé / introuvable / indisponible avec motif (délai, réseau,
                         limite, serveur ; « hors ligne » est posé par la route sans appel). Open Library
                         `search.json` d'abord, l'ancien `api/books` en filet sur un « rien » seulement, Google
                         Books seulement avec `GOOGLE_BOOKS.key` (src/sync/config.js, vide par défaut) et
                         seulement après un « rien » d'Open Library ; une tentative = un budget (AbortController
                         par tentative, 8 s, corps lu en flux et coupé à 256 Ko), une seule reprise sur un échec
                         MUET (délai, réseau), jamais sur un refus parlé (429, 5xx) ; `fiche.motsCles` = des
                         propositions, sujets techniques filtrés (toute valeur à `:` ou `=` écartée avant le
                         plafond de dix, R-ISBN-6). Puis fusionnerFiche, fabriquerLivre (ISBN-13 ou null, jamais une suite
                         libre de chiffres), enregistrerLivre, renderLivreAjout/renderLivreAjoutRoute : le
                         formulaire « Ajouter un livre » en deux pas (Entrée = Identifier, une identification à
                         la fois, « Réessayer » quand Open Library n'a pas répondu) ; la couverture reçue
                         appartient à SA demande d'ISBN, jamais à une autre (R-UX-13).
src/ui/accueil-livre.js  accueilLivreModel/ACCUEIL_ACTIONS/renderAccueilLivre : l'écran après l'ajout d'un livre
                         (photographier l'index ou une recette, aller à Mes livres) ; `?nouveau` sans valeur ne
                         journalise rien (R-UX-10 : le modèle décide, pas la route).
src/ui/signet.js         lienSignet (ré-exporté de core/lien.js), signetModel, fabriquerSignet, enregistrerSignet,
                         renderSignet/renderSignetRoute : garder un lien web comme référence, avec titre et livre
                         facultatif.
src/core/image.js        dimensionsImage, reduireImage, ErreurImage, LIMITES_COUVERTURE (COVER_INPUT_MIME, lui,
                         est exporté par src/sync/mime.js — RF-m3) : dimensions lues dans l'en-tête AVANT tout
                         décodage (bombe de décompression), ré-encodage JPEG systématique (HEIC et formats
                         exotiques inclus), bornes 25 Mo / 16 Mpx (fichier local) et 5 Mo / 16 Mpx (corps d'une
                         réponse distante, lu EN FLUX et coupé — Open Library n'annonce pas `content-length`,
                         R-UX-12). Le mur de pixels vaut pour les DEUX sources depuis S2 : une image choisie ici
                         est mesurée par `poserCouverture` (chemin local) avant `reduireImage`, et seuls les
                         conteneurs que `dimensionsImage` sait lire (JPEG, PNG, WebP) y passent — un en-tête
                         illisible (HEIC) traverse, et c'est le ré-encodage qui tranche. Le corps JSON des
                         métadonnées est lu par la MÊME fonction bornée que les octets d'une couverture
                         (`lireBornee`, coupée à 256 Ko — S1 ; définie depuis le 17 octobre dans `core/bornes.js`, ré-exportée par
                         livre-ajout.js).
src/core/blob-urls.js    urlDeBlob/revoquerUrlDeBlob/revoquerUrlsDeBlob : chaque URL blob: créée pour afficher une
                         couverture ou un aperçu est suivie dans un registre partagé, révoquée à la route suivante
                         (S15/F4) ; `revoquerUrlDeBlob(u)` révoque UNE URL connue, ce dont `library.js` a besoin
                         pour ne lâcher que la génération précédente — et APRÈS avoir remplacé les nœuds (D-T9 :
                         révoquer avant laisse un <img> sur une URL morte, erreur de console). Dette
                         assumée : `displayUrl` (vignettes, PDF) crée encore des URL blob: hors de ce registre
                         (pré-existant, hors lot).
src/core/lien.js         lienSignet(sourceUrl) et libelleSource(recipe) : fonctions pures sans dépendance, pour
                         que tout écran affichant un
                         lien puisse revalider l'adresse AU RENDU (seuls http:/https: s'ouvrent, hôte rendu en
                         punycode) sans jamais faire confiance à un `source_label` stocké, qu'une archive ou le
                         serveur peuvent avoir rempli avec n'importe quoi (S7). Sous `components.js` ET
                         `signet.js` (qui importe `components.js`), pour éviter un cycle. `lienSignet` RETIRE
                         `username`/`password` de l'href rendu (D-T7 : un mot de passe collé dans une adresse ne
                         se stocke ni ne se renvoie) ; `libelleSource` sert les surfaces qui n'affichent qu'un
                         texte (`meals.js`, `exporters.js` — S8).
```

### Identifier un livre, fiable (lot du 14-15 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md` (§ 11.2 : ce que la construction a
amendé). Un seul module neuf ; les autres changements sont décrits sur les lignes de `puces.js` et `livre-ajout.js`
ci-dessus.

```text
src/core/isbn.js         nettoyerIsbn, validerIsbn (ISBN-10/13, chiffre de contrôle, préfixe 978/979 → isbn13 +
                         isbn10, ou un motif : vide, longueur, controle, pas_isbn), codeBarresVersIsbn : module
                         pur, appelé AVANT tout réseau (un ISBN mal tapé est refusé tout de suite, zéro requête).
                         Vague /verify (C3) : une étiquette collée (« ISBN-13: … ») est retirée avant le nettoyage.
src/domain/search.js     buildDocs : les `tags` d'un livre (ses mots-clés) entrent dans les `tokens` de TOUTES ses
                         recettes, et dans les `titleTokens` de ses références (`reference_only` : index, signet
                         rattaché) — une référence de « Berber and Q » remonte sur « bbq » même si son titre ne le
                         dit pas. Une recette sans édition ne reçoit rien. Vague /verify (S2) : `tagsDe` (pur,
                         exporté ici) rend les `tags` d'un livre en tableau de chaînes — un `tags` d'archive ou de
                         ligne reçue qui n'en est pas un ne fait plus tomber la recherche ; puces.js et book.js
                         l'importent d'ici (aucune dépendance domaine → ui, aucun module neuf).
src/ui/book.js           fiche livre : bloc « Mots-clés » à côté de « Cuisines » ; « Enregistrer » écrit `tags`
                         (relecture C4 inchangée, `cover_sha256` intact). Pas de suggestions distantes ici.
```

Clé Google Books : procédure et murs dans `docs/google-books.md` (publique par conception, vide par défaut).

`src/ui/add.js` est réécrit (grille de cinq cartes `renderGrille`, sélecteur avant scan `renderSelecteurScan`,
`parametresDeScan` pur, R-UX-7) mais reste le même fichier, déjà dans `SHELL` depuis le lot d'hébergement.

### « Intention dans l'adresse »

Une séance de scan ne sait pas, à l'ouverture, si elle vient de « + Pages d'index » ou de « + Recette ». Plutôt
qu'un état posé en base ou en mémoire — qu'un rafraîchissement réappliquerait indéfiniment (F6) —, l'intention
voyage dans l'URL (`adresseSeance(sessionId, intention)` → `/import?session=…&intention=index`), est consommée au
premier rendu (`appliquerIntention` : présélection des pages, panneau d'index ouvert ou non), puis retirée de
l'adresse par un geste `historique.remplacer` injecté (jamais un vrai `history.replaceState` dans un test, I-H — une exception nommée : le test de la dépendance par défaut de la recherche web, restauré en `finally`) :
un `refresh()` ultérieur ne la réapplique donc pas.

### `cover_sha256` : pointeur souple

`book_editions.cover_sha256` pointe une ligne `files` par son empreinte, **sans** entrée dans `RELATIONS`
(`schema.js`) et sans relation d'archive : une fiche dont la couverture n'est pas (encore, ou plus) sur cet
appareil reste restaurable et affichable — la fiche le dit (« La couverture n'est pas sur cet appareil. ») plutôt
que d'échouer. Choix voulu (S1/F2) : une relation stricte aurait rendu une archive irrestaurable dès qu'une
couverture manque, par exemple après une réception L3 (qui reçoit la ligne `files` sans ses octets — L4). Dette
nommée : `source_pages.sha256` reste la même sorte de relation latente, jamais vérifiée nulle part.

## Chercher sur le web avec l'assistant (17 octobre 2026)

> **Amendé le 18 octobre** (lot « La passerelle de l'assistant », branche non fusionnée) : `ANTHROPIC_MESSAGES_URL`, `anthropicHeaders` et toute clé ont disparu de
> l'app ; le transport passe par `passerelle.js` (session, jamais de clé) ; `cle_refusee` et `recherche_desactivee` n'existent plus ; le délai client
> est de 135 s (et non plus 45 s). Le texte ci-dessous décrit le lot tel qu'il était à sa clôture.

Spec : `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (rév. 2.1 ; § 11.2 : ce que la construction a
amendé, R-WEB-1 à R-WEB-10). Livré ici : l'onglet « Web » de la recherche lance, sur une tape et sur elle seule, **un**
appel à l'API Anthropic avec l'outil de recherche web côté serveur (`web_search_20250305`), affiche au plus cinq liens
pris dans les résultats bruts du serveur, et « Garder ce lien » ouvre le signet prérempli. Deux modules neufs ; les
autres changements tiennent en quelques lignes chacun.

```text
src/core/bornes.js          REÇU du lot ISBN (spec § 7.2) : borner(s, max), lireBornee(r, maxOctets), signalDelai(ms),
                            OPTIONS_FETCH, déplacés depuis livre-ajout.js sans changer leur corps (seul borner reçoit sa
                            borne en paramètre). Module pur, sans import : le domaine le lit comme l'interface.
                            livre-ajout.js les importe et ré-exporte lireBornee, signalDelai et OPTIONS_FETCH
                            (tests/ajouter.js les lit toujours par le module de route).
src/domain/recherche-web.js construireDemande (q borné à 500 points de code, filtres = textes des puces bornés à 80, 12 au
                            plus ; rend aussi q et filtres NETTOYÉS et la clé de mémoire), corpsRequete (max_uses 3, pays
                            CA, fuseau injecté ; ni thinking, ni stream, ni output_config), lireReponse (résultats bruts
                            dédoublonnés par href exact, erreurs d'outil, aCherche, texte recollé sans séparateur),
                            choisirLiens ({ liens, autres, repli }), chercherRecettesWeb (un appel, ne lève jamais, rend
                            une issue). N'importe rien de src/ui/.
src/domain/llm.js           supportsWebSearch (vrai pour Anthropic seulement) ; ANTHROPIC_MESSAGES_URL et
                            anthropicHeaders(apiKey) exportés et utilisés par AnthropicProvider.complete (comportement
                            inchangé, verrouillé par un test écrit avant le refactor).
src/ui/components.js        libellePuce(c, ingredientsById) : l'ancien chipLabel (déjà exporté), renommé — une seule
                            définition de ce qu'une puce dit, pour l'écran et pour la demande (I-J).
src/ui/search.js            le mode Web : garde du fournisseur, bouton, vol, issues (ci-dessous).
src/ui/signet.js            renderSignetRoute lit query.adresse (telle quelle) et query.titre (borné à 300) ; bannière
                            « Adresse reçue » dont l'hôte vient de signetModel, la même décision que l'enregistrement
                            (R-WEB-8).
src/domain/search.js        searchDocs(…, { mode: 'web' }) rend des groupes vides sans notice : le texte mort « Le Web
                            n'est pas activé » est retiré du domaine, de l'écran et de en.js ; pairing.js ne le propage
                            plus.
```

**État au niveau du module (`src/ui/search.js`).** `run()` navigue en `replace`, donc chaque Entrée, changement de mode
ou de case ré-instancie la route : un état d'instance ne survivrait pas. Trois variables de module portent la recherche
web : `memoire` (`{ cle, issue, q, filtres }` — la dernière issue, sous la clé exacte de la demande qui l'a produite,
avec la `q` et les filtres nettoyés qui sont partis ; mémoire **vive** : jamais en base, ni dans une archive, ni au
serveur, elle meurt au rechargement — I-G) ; `vol` (`{ cle, controller, promesse }` — l'unique appel en vol de toute
l'app — I-I) ; `vues` (un ensemble de `{ root, redessiner }` : les instances vivantes du mode Web, dédoublonnées par
racine, purgées à chaque rendu et à chaque notification dès que leur racine a quitté le document). `etatWeb()` et
`reinitialiserWeb()` exposent et remettent cet état pour les tests, qui attendent un fait et jamais un délai. Une tape
(`lancer`) relit le champ seulement s'il a changé depuis la dernière analyse (R-WEB-2) — et ne garde alors que les
puces ajoutées par les listes (R-WEB-10 : affichées moins l'analyse de l'ancien texte ; exclusions, ingrédients et
durées viennent du nouveau texte ; Entrée, changement de mode ou de case, `run()`, réanalysent sans rien garder) —,
abandonne le vol précédent,
pose le nouveau, puis met l'adresse à jour sans re-rendu (`remplacerAdresse`) : l'instance courante garde ses puces et
son vol ; au retour, une promesse qui n'est plus celle du vol n'écrit rien ; une exception
devient l'issue gelée `interne` (filet de l'écran : jamais d'écran figé). « Annuler » abandonne sans rien lancer, et la
mémoire reste ce qu'elle était.

**Le mur I-A : rien d'inventé.** Un lien ne s'affiche que si son adresse, normalisée par `lienSignet`, est **égale** au
`href` d'un bloc `web_search_result` de la réponse. Le texte de l'assistant ne fait qu'habiller : il choisit parmi ces
pages et en donne une présentation (deux ou trois phrases dans la voix d'un serveur, bornée AU MOT à 400 points de code
par `bornerAuMot`, écartée si elle porte une adresse web) et trois repères typés (`temps_min` entier de 1 à 1440,
`difficulte` ∈ facile / moyen / exigeant, `ingredients` entier de 1 à 99 ; sinon `null`), lus par `Object.hasOwn` ; titre
(300), hôte et date (40) viennent du résultat, bornés et nettoyés des Cc/Cf. Un choix qui désigne une adresse absente des résultats est ignoré ; si aucun choix ne survit, `repli` : les cinq
premiers résultats tels quels, avec « Liens tels que trouvés, sans tri de l’assistant. ». Une adresse n'est jamais
tronquée. Au rendu, chaque `href` est revalidé par `lienSignet` (une adresse refusée n'a pas de carte ; un « trouvé »
sans carte survivante se rend comme « rien », R-WEB-3). La ligne de repères de chaque carte commence par « Estimé par
l’assistant : » (c'est une estimation, pas une donnée de la page), et la mention I-K est toujours sous les liens :
« L’assistant présente les plats et estime le temps d’après les pages : il ne vérifie ni le temps, ni les ingrédients, ni
les restrictions. Relis la page avant de cuisiner. » (sur un `repli`, l'ancienne phrase, sans estimation). Pas de complément
automatique : les pages non choisies sont repliées sous « Autres pages trouvées ({n}) » (K2).

**Issues.** `chercherRecettesWeb` rend toujours `{ etat, raison, liens, autres, repli, recherches, modele }`, sans la clé
ni aucun texte d'un corps d'**erreur** (I-C : il sert au classement, pas à l'écran) ; d'une réponse réussie, seuls les
titres et dates des résultats (bornés, nettoyés) et la présentation de chaque lien (400 points de code coupés au mot,
Cc/Cf retirés) avec ses trois repères typés arrivent à l'écran. `non_configure` et `non_pris_en_charge` : aucun appel. `indisponible`, avec une raison :
`requete` (demande vide, ou un 4xx sans autre sens), `hors_ligne`, `annule` (jamais rendue), `delai` (45 s), `reseau`,
`cle_refusee` (401 ; 403 ; clé hors `[\x21-\x7e]`, refusée avant tout appel — R-WEB-5), `recherche_desactivee` (400 ou
403 dont l'`error.message`, lu en flux et borné à 64 Kio, dit « web search … not enabled / disabled » — R-WEB-6),
`trop_de_demandes` (429, ou erreur d'outil `too_many_requests` sans résultat), `serveur` (5xx), `reponse_illisible`
(corps au-delà de 2 Mio, JSON invalide, `content` qui n'est pas un tableau), `refus` (`stop_reason: 'refusal'`, même
avec des résultats), `outil`, `interrompu` (`pause_turn` ou `max_tokens` sans résultat), `pas_cherche` (l'assistant a
répondu sans chercher), `interne` (filet ; journal sans aucun champ de `cfg`). Puis `rien` (une recherche a eu lieu,
aucune page) et `trouve`. Le corps et les en-têtes sont construits avant le `try` du réseau (R-WEB-4) ; l'appel porte
`redirect: 'error'` (la clé ne suit jamais une redirection). À l'écran : K1 ne vaut que pour `trouve` (les liens
restent quand la demande change, et « La demande a changé depuis cette recherche. » le dit) ; toute autre issue ne
s'affiche que pour sa demande (R-WEB-7) ; « Réessayer » force `enLigne` à vrai ; les écrans sans « Réessayer »
(`cle_refusee`, `recherche_desactivee`, `refus`, `non_configure`, `non_pris_en_charge`) offrent « Chercher à nouveau » ;
une raison sans texte propre dit « L’assistant n’a pas répondu. Réessaie. » avec « Code : {raison} » dessous (K3).

**Mesuré en réel (17 octobre 2026, site public).** Un appel réel à l'API Anthropic, demande « puttanesca » : **un** POST
vers l'API Messages → 200, 2 recherches, 5 liens choisis + 13 autres pages, ≈ 20 s ; `page_age` vu en « 654 days ago »
et parfois « April 30, 2025 ».

**Ce qui n'est pas prouvé.** Tout le reste est éprouvé par la suite, avec un `fetch` factice et des réponses fixes :
statut et corps exacts d'un compte sans recherche web, `pause_turn` et `refusal`, taille du corps, coût. Ni Safari ni
l'iPhone (aucun WebKit ici), ni `target="_blank"` et `navigator.onLine` depuis une PWA installée. Et
`AbortSignal.timeout` compte le temps **actif** : sur une PWA iOS en arrière-plan, 45 s ne sont pas 45 s réelles.

## L'assistant suit le compte (17-18 octobre 2026)

> **Amendé le 18 octobre** (lot « La passerelle de l'assistant », branche non fusionnée) : la clé ne vit plus dans le navigateur ni dans Réglages (section à deux
> états, sans champ) ; une passe unique vide toute clé trouvée ; le magasin `assistant_config` reste (dette). Le texte ci-dessous décrit le lot tel qu'il
> était à sa clôture.

Spec : `docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` (rév. 2 ; § 12 : rulings R-CPT-1 à
R-CPT-7) ; spec parente `docs/spec-compte-et-stockage-distant.md` § 11, R65. Livré ici : la configuration de
l'assistant IA (fournisseur, modèle, URL de base, clé) s'entre une fois sur un appareil connecté et suit le compte
jusqu'aux autres ; elle ne vit plus dans `settings`. Un module neuf ; ailleurs, des changements bornés (les plus gros :
la section Réglages et le générateur de migrations).

```text
src/domain/assistant-config.js  pur : normaliserConfigAssistant(brut) → { provider, model, base_url, api_key } (chaînes
                                rognées, Cc/Cf retirés par borner, bornes 200 / 500 / 500 ; fournisseur hors liste → none ;
                                none vide tout ; base_url en https, ou en http vers la boucle locale seulement, jamais
                                d'identifiants, toujours vide pour anthropic ; refusée pour openai_compatible → toute la
                                configuration à none, R-CPT-4) ; LIGNE_ASSISTANT = 'llm' ; configVide.
src/model/schema.js             DB_VERSION 3 ; magasin assistant_config (keyPath id, noDelete), déclaré après files et
                                avant settings : dernier des 26 SYNC_STORES ; hors ARCHIVE_DATA_STORES.
src/core/db.js                  mutate lève, avant toute transaction, pour une suppression sur un magasin noDelete dont
                                l'origine n'est pas 'remote' ; clearStores reste permis (vidage d'appareil).
src/model/repo.js               getSettings compose llm depuis la ligne assistant_config (normalisée) ; getSetting et
                                setSetting lèvent sur une clé de SECRET_SETTING_KEYS ; saveAssistantConfig ; passe unique
                                migrerConfigAssistant dans init().
src/sync/config.js              configAssistantSuitLeCompte(hostname) : vrai ssi l'hôte figure dans SUPABASE.prod.hosts.
src/sync/outbox.js, backfill.js, pull.js, moteur.js
                                prédicat injecté configSuitLeCompte, faux par défaut (R-CPT-1) ; app.js passe le vrai.
src/sync/pull.js                regleDuMagasin, après decider : conflit → ecrire, conflit_renvoyer → renvoyer_seulement.
src/sync/reponses.js            refus conflit sur ce magasin : retirer de la file, jamais d'entrée de conflit ; réécrire
                                la version du compte seulement si c'est un objet nu, sans tombale, au moins aussi récent,
                                et si la fiche n'a pas bougé pendant l'aller-retour.
src/sync/conflits.js            garderIci, garderAilleurs et ignorerRenvoye refusent ce magasin par son nom.
src/domain/backup.js            le remplacement ne vide pas assistant_config (K-7).
src/ui/settings.js              sectionAssistant (dépendances injectées), texteAssistant (quatre états K-10),
                                occupeParAssistant (K-12, câblé dans le occupe de suivreMoteurDeLaPage).
src/sync/tables.js              SYNC_STORES_0001 : les 25 noms de 0001, figés.
tools/generer-migrations.mjs    0001 depuis SYNC_STORES_0001, 0002 inchangée, 0003 depuis SYNC_STORES ; le bloc des quatre
                                fonctions est partagé (fonctions(stores)) ; --check couvre les trois fichiers.
```

**Le magasin.** Une ligne `{ id: 'llm', provider, model, base_url, api_key, created_at, updated_at }`, normalisée à
l'écriture locale (« Enregistrer ») et à la lecture (`getSettings`), jamais à la réception : la ligne reçue est écrite
telle que le serveur la porte (normaliser créerait une différence à instant égal, réécrite à chaque passe). Les
consommateurs lisent toujours `ctx.settings.llm` (`providerFrom`, `search.js`, `recipe-edit.js`, `import.js`,
`components.js`, `recherche-web.js` : inchangés, K-11). Le cache de `src/ui/state.js` est invalidé après une passe qui
a écrit : une configuration reçue est lue au rendu suivant.

**Production seulement (K-3).** Capture (`installCapture`), envoi initial (`envoiInitial`, marqueur
`backfill:assistant_config`) et réception (`createPull`) ne voient ce magasin que si `configSuitLeCompte()` est vrai,
c'est-à-dire sur un hôte de `SUPABASE.prod.hosts`. Sur `localhost` / `127.0.0.1`, la configuration reste sur
l'appareil : une origine `localhost:<port>` est partagée par tout autre projet servi sur ce port, IndexedDB et jeton de
session compris.

**Jamais de conflit, jamais de suppression (K-5, K-6).** I7 s'applique sans écran : le plus récent gagne ; à instant
égal et contenu différent, la version du compte gagne et est écrite ici ; plus récente ici, la fiche repart (remise en
file sans journal). Aucune entrée `sync_conflicts` n'est créée pour ce magasin. « Aucun (manuel) » écrit la ligne vide
(`provider: 'none'`, champs vides) : la clé disparaît partout par une **écriture** ; sans configuration ici, rien n'est
écrit ; la confirmation « Retirer l'assistant de tous tes appareils ? » est demandée dès que la ligne vide partira au
compte, c'est-à-dire sur **tout hôte de production** (R-CPT-7, qui remplace R-CPT-5 : écrite déconnectée, la ligne est
capturée avec `user_id: null` et part sous le premier compte qui se connecte ici, appareil lié ou jamais lié — `fileDe`,
R-L3-24) ; hors production, jamais. En production, le texte « sans compte » le dit : « Sans compte, la configuration
reste sur cet appareil jusqu’à ta première connexion, puis elle suit ton compte. » Une tombale reçue (d'un autre
client) suit le chemin générique : supprimée ici si elle est plus récente ou égale, jamais écrite (elle porte l'ancienne
`data`, clé comprise).

**La passe unique (§ 5.6).** Dans `repo.init()`, après l'horodatage des anciennes fiches et le nettoyage des chaînes,
garde `sync_state.assistant_config_migre = 1` : une seule transaction d'origine `device` copie `settings.llm` vers
`assistant_config` (si le fournisseur n'est pas `none`, que la clé n'est pas vide et qu'aucune ligne n'existe) avec
**l'horodatage de l'ancienne ligne**, à défaut `1970-01-01T00:00:00.000Z` (jamais « maintenant » : une vieille clé
battrait une clé tournée), pose la garde et efface `settings.llm` dans tous les cas. `init()` précède
`installCapture` : rien n'entre en file ici, c'est l'envoi initial qui envoie la ligne.

**La table serveur.** `public.assistant_config`, du même gabarit que les 25 autres (`owner_id`, `id`, `data`,
`updated_at`, `server_seq`, `deleted_at`, RLS propriétaire avec `is_allowed()`), plus `revoke all on
public.assistant_config from anon` ; `0003_assistant_config.sql` recrée `sync_push`, `sync_purge`, `sync_purge_all` et
`purge_tombstones` avec les 26 noms. La clé y repose **en clair** dans `data` : aucune requête humaine ou d'agent ne
lit cette colonne (`data - 'api_key'` et `length(data->>'api_key')` pour un diagnostic). Preuve écrite :
`supabase/proofs/0003_assistant_config.sql` (clés factices, `data` jamais affichée). Ni la migration ni la preuve n'ont
été exécutées : leur syntaxe seulement est vérifiée hors ligne, par pglast v8.6 — `parse_sql` sur les instructions de
premier niveau (`0003` 20, preuve `0003` 48, aucune erreur ; il traite un corps `$$…$$` comme une chaîne opaque), puis
`parse_plpgsql` sur les corps PL/pgSQL (les 4 fonctions de `0003`, les 4 blocs `do` de la preuve : aucune erreur ; un
`thn` dans `sync_push` et un `valuez` dans un bloc `do`, posés sur des copies, passent `parse_sql` et sont refusés par
`parse_plpgsql`). Application : `supabase/README.md`, étape 8 bis, **avant** tout `push` du code.

**Ce qui n'est pas prouvé.** La passe réelle contre `mitsu` (aucune n'a tourné : ni `0003`, ni sa preuve) ; l'iPhone ;
le chemin « nouveau client, ancien serveur » : non mesuré, ni en factice ni contre PostgREST (le transport factice
n'arbitre pas `store inconnu`) ; le 400 est une inférence ; éprouvés seulement : les briques génériques L3 (dichotomie →
quarantaine `refus`, `inconnu` → recul, `tests/sync-l3.js`) et l'ordre « `assistant_config` lu en dernier »
(`tests/assistant-compte.js` ≈ l. 281-293) ; l'état « appareil lié sans session » de K-10, inobservable sur
`localhost` (prédicat injecté) ; K-12 (le formulaire n'est pas reconstruit sous le focus) n'est éprouvé que par
`occupeParAssistant`, le câblage dans `suivreMoteurDeLaPage` est lu au source.

## Créer une recette avec l'assistant (18 octobre 2026)

> **Amendé le 18 octobre** (lot « La passerelle de l'assistant », branche non fusionnée) : l'appel de création passe par la fonction `assistant` (outil `creation`),
> avec la session ; sans session, l'écran dit « Connecte-toi pour utiliser l’assistant. » ; le délai client est de 135 s (et non plus 120 s). Le texte ci-dessous
> décrit le lot tel qu'il était à sa clôture.

Spec : `docs/superpowers/specs/2026-10-18-creer-avec-l-ia-design.md` (rév. 2, amendée à la clôture puis à la vague finale ;
§ 11 : rulings R-CRE-1 à R-CRE-15). Livré ici : une demande en texte libre, avec restrictions, type, portions et temps maximal, devient, sur un clic
et sur lui seul, **un** appel à l'API Anthropic (Messages, sans outil) qui rend **une** proposition de recette ; « Garder »
l'écrit comme une recette ordinaire du modèle existant — aucun magasin neuf, `DB_VERSION` 3 inchangée, aucune migration, CSP
inchangée. Deux modules neufs ; ailleurs, des changements bornés.

```text
src/domain/creation-ia.js  pur, sauf creerRecetteIA qui reçoit fetch en dépendance ; n'importe rien de src/ui/.
                           estCreationIA(v) : generated_by 'ai', provenance.creation objet, et kind synthesis — ou adaptation
                           avec derived_from (une extraction IA de livre n'en est jamais une, F6) ;
                           etiquetteCreationIA(version, recipe = null) : LA fonction d'étiquette (clé française ; null = aucune) ;
                           AVERTISSEMENT_CREATION_IA ; lireCreation(version) : description, conseils, notes et minutes estimées
                           RELUS et rebornés à chaque rendu et export (une ligne reçue peut porter n'importe quoi) ;
                           construireDemandeCreation → { system, user, cle } (demande bornée à 500, en adaptation un bloc
                           délimité « donnée » + le changement) ; validerRecetteIA(json, { servings, maxMinutes }) →
                           { ok, recette, avertissements } ou { ok: false, motif } ; texteLigne (R-CRE-7) ;
                           fabriquerRecetteIA → { recipe | null, version } (lignes par parseIngredientLine, identifiants
                           réattribués par le newId injecté) ; creerRecetteIA(args, deps) → issue, ne lève jamais ;
                           LIMITES_CREATION, CLES_REFUSEES, conventionCreation.
src/ui/creer-ia.js         renderCreerIA(params, query, ctx, deps) — creer, repo, navigate, toast, enLigne, remplacerAdresse
                           injectés ; filtresDepuisQuery(query, parente) : liste blanche C-16 ; etatCreation() et
                           reinitialiserCreation() pour les tests.
src/app.js                 route('/recipes/creer', renderCreerIA) AVANT /recipes/:id (F1).
src/ui/state.js            '/recipes/creer' dans ROUTES_DE_SAISIE : une passe de synchronisation ne reconstruit pas l'écran
                           pendant la saisie.
src/ui/add.js              carte creerIA (cinquième de la grille, GRILLE_ACTIONS add.js:10 ; le congélateur est sixième)
                           → navigate('/recipes/creer').
src/ui/search.js           bouton « Créer une recette avec ces critères » (creer-depuis-web) sur rien, trouvé et
                           recherche_desactivee : relireChamp puis navigation avec q et les puces affichées ; aucun appel.
src/ui/components.js       etiquetteIA(version, recipe = null) (helper DOM qui délègue, R-CRE-4) ; versionBadge, recipeCard,
                           provenanceText ; ingredientLineEl (N-9).
src/ui/dish.js             provenanceComparee, lieuRattachement (vague finale) : la comparaison de plats et les rattachements
                           proposés disent l'étiquette d'une fiche origine 'ia', jamais un livre ni « p. {page} ».
src/ui/recipe.js, cook.js, meals.js, library.js
                           étiquette, blocs de la création, « Adapter avec l'IA » (→ #/recipes/creer?adapter=<version>),
                           « Marquer testée » étendu à synthesis, section « Recettes créées avec l'IA » de Mes livres.
src/domain/exporters.js    étiquette en texte brut (jamais t()) ; pour une fiche origine 'ia' : ni livre, ni ISBN, ni page,
                           ni source_url, ni champ de durée (totalTime, prep_time, cook_time) ; les blocs de la création et
                           l'avertissement voyagent, l'estimation en texte (« Environ {m} min (estimé par l'assistant). »,
                           exporters.js:32) ; le site lisible échappe aussi page, empreinte d'image et lien de l'index.
src/domain/diet.js         N-8, règle asymétrique (R-CRE-1) ; R-CRE-9.
src/domain/grocery.js      N-9 : regroupement par identité pour une ligne vérifiée seulement.
src/domain/lines.js        detectTimers borné : 4 minuteurs par étape au plus, ≤ 24 h, au-delà écarté (R-CRE-8).
```

**L'appel.** Même squelette et mêmes murs que la recherche web : gardes `non_configure` (cfg, clé et modèle chaînes non
vides), `non_pris_en_charge` (fournisseur autre qu'Anthropic), clé `/^[\x21-\x7e]+$/` sinon `cle_refusee` sans appel,
`requete` (demande vide, ou adaptation sans changement), `hors_ligne`, `annule` ; corps `{ model, max_tokens: 16000,
system, messages }` sans `thinking` ni `tools` (seuls les blocs `text` sont lus) ; `redirect: 'error'`, `credentials:
'omit'` ; délai 120 s ; corps lu en flux et borné à 1 Mio ; le corps d'une réponse en erreur n'est jamais lu (le statut
seul classe : 401/403 `cle_refusee`, 429 `trop_de_demandes`, autre 4xx `requete`, hors 2xx `serveur`) ; `stop_reason`
`refusal` → `refus`, `max_tokens` → `interrompu` ; texte du modèle illisible → `illisible`, motif `json` ; sinon
`validerRecetteIA` → `trouve { recette, avertissements, modele, usage }` ou `illisible` + motif (`forme`, `bornes`,
`lien`, `affirmation`, `caracteres`). Journal : `{ reason: 'illisible:<motif>' }` ou `{ reason: 'interne' }` + nom de
l'erreur, jamais un corps (P13). L'issue ne porte jamais la clé.

**La sortie du modèle est une donnée hostile.** Lecture propriété par propriété (`Object.hasOwn`), bornes strictes
(refus, jamais de troncature silencieuse), Cc/Cf retirés puis NFC et espaces repliés, refus des marques combinantes
empilées (`\p{M}{3,}`) ; refus `lien` pour une adresse (best-effort après NFKC) ou une clé de `CLES_REFUSEES` ;
refus `affirmation` pour un titre qui nomme une restriction (libellés FR/EN de `DIET_TAGS`) ou promet une certitude ;
portions ou durée différentes de la demande : avertissements, pas de refus (l'appel est payé). Rendu en texte seul
(`el()`). Contrat invite ↔ validateur (vague finale, R-CRE-13/14) : l'invite FR et EN annonce chaque règle qui refuse, avec
des cibles sous les bornes pour ce qui se compte en caractères (titre 100/120, description 350/400, conseils et notes
200/250, étapes 400/500, nom 80/100, unité 20/30), et demande de respecter les restrictions demandées sans rien certifier ;
une unité vide vaut « unité » (« 2 œufs »), aucune autre règle n'est assouplie ; une table de tests « règle refusée →
phrase » (FR et EN, création et adaptation) rougit quand une phrase disparaît.

**L'écran.** État au niveau du module, comme la recherche web : `memoire` (`{ cle, demande, filtres, langue, parente,
changement, issue, gardee, echec }` — ce qui est PARTI, jamais le formulaire ; mémoire de session, jamais en base),
`vol` (`{ cle, controller, promesse }` : UN vol pour toute l'app ; une seconde création est refusée tant que rien n'est
annulé ; une réponse dont la promesse n'est plus celle du vol n'écrit rien) et `vues` (instances vivantes, purgées par
`isConnected`, toutes notifiées : toute instance montre le vol). Le rendu suit la table de décision P7 du plan (vol,
gardes, proposition gardée, proposition, K1, issue, formulaire). La saisie ne redessine pas (focus iPhone) ; elle
bascule seulement la mention K1. « Garder cette recette » pose `memoire.gardee` de façon synchrone puis écrit **une**
transaction (`repo.saveBatch` : fiche + version, ou version seule pour une adaptation) : un retour arrière montre
« Recette gardée » + « Ouvrir la fiche », jamais un second « Garder ».

**La fiche gardée.** `recipe.origine: 'ia'` (durable, survit à « Corriger », N-10), sans `edition_id` ni `source_url` ;
version `synthesis` (ou `adaptation` enfant, `recipe_id` de la parente, `current_version_id` inchangé), `status:
'proposed'`, lignes `to_verify`, `total_minutes: null` (la durée estimée vit dans `provenance.creation.minutes_estimees`,
affichée « environ {m} min (estimé par l'assistant) », jamais exportée en `totalTime` : elle voyage en texte dans la
description, `exporters.js:32`), `provenance.creation` = demande, filtres
partis, description, conseils, notes de restrictions, date, jetons.

**L'étiquette est dérivée des données, jamais de `source_label`** (C-2). `etiquetteCreationIA(version, recipe)` :
`synthesis` → « Créée avec l'IA · non testée / testée » ; adaptation IA → « Adaptée avec l'IA · … » ; sur une fiche
`origine: 'ia'`, une correction → « Corrigée par toi — d'après une création IA », une autre version manuelle → « Ma
version — d'après une création IA » ; fiche seule → « Créée avec l'IA ». Une seule source pour l'écran (`t()` au rendu,
par `etiquetteIA`) et les exports (texte brut). Le mode cuisine pose l'étiquette pour toute fiche `origine: 'ia'` et
l'avertissement C-9 pour une version `estCreationIA` seulement (R-CRE-10).

**N-8 et N-9 : l'app entière, pas seulement les créations (à confirmer par Neegan, renversables).** N-8, dans
`assessVersion` : une ligne non vérifiée dont l'identité proposée ne bloque pas est **inconnue** ; si elle bloque, elle
bloque (`proposed: true`) ; un bloquant facultatif ne masque pas une inconnue (R-CRE-9). Mesuré (lignes non vérifiées,
index du seed) : « 250 ml lait de coco » → `ing_milk` → `incompatible` sous sans lactose, `to_verify` sous sans gluten.
N-9 : une ligne non vérifiée s'affiche telle qu'écrite, avec ` (identité proposée : {libellé} ?)` (fiche et mode
cuisine), sans badge « Traduction », sans conversion par l'identité proposée (`qtyEl`), et se regroupe dans les courses
par son texte (`ingredient_id: null`). Effet sur les fiches de LIVRE : une recette aux lignes non vérifiées passe de
« compatible » à « à vérifier » ; « 3 oignons » et « 1 oignon » non vérifiés font deux groupes de courses (mesuré).

**Ce qui n'est pas prouvé.** **Aucun appel réel** : chaque test passe par un `fetch` factice injecté, et le parcours
dans l'app réelle de la tâche 3 avait l'API Anthropic interceptée ; forme réelle d'une réponse, taux de refus `illisible` ou
`affirmation`, durée, jetons et coût d'un appel réel restent à mesurer (geste de Neegan, spec § 10). Ni Safari ni
l'iPhone ; ni les minuteurs Siri d'une étape de création sur appareil ; ni l'effet de N-8/N-9 sur la vraie bibliothèque
de Neegan (fixtures seulement).

## Thème « magazine culinaire » (18 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-18-refonte-visuelle-design.md` (rév. 2, amendée à la clôture ; § 2 : invariants T-1 à T-11 ;
§ 8 : rulings R-VIS-1 à R-VIS-14). Un thème, pas une refonte des écrans : la feuille, deux balises d'`index.html`, deux couleurs du
manifeste et un bloc de tests ; aucun module de `src/` touché, aucune classe lue par le JS renommée, aucun test de comportement retouché.

```text
styles.css            :root = 38 propriétés : les 29 jetons de la spec § 3.1 (papier, encre, gris, filets, action tomate,
                      accent vert, ambre, brique, ok, voile, reflet de tape, rayons, ombre, serif, sans, --topbar-h),
                      --nav-h, --safe-b et --safe-t inchangés, et 6 alias des anciens noms (--cream, --cream-2, --green,
                      --green-2, --sage, --sage-2) ; color-scheme: light ; hors :root, seules couleurs en dur : #fff et
                      #222 (T-2). 317 lignes (260 à la pointe du lot 2, 315 à la clôture).
index.html            theme-color #f8f5ef ; apple-mobile-web-app-status-bar-style default (était black-translucent).
manifest.webmanifest  theme_color et background_color #f8f5ef.
tests/theme.js        runThemeTests({ eq, ok }) : 79 assertions, dernier bloc de tests/tests.js avant le total épinglé.
```

**Jetons.** Toute couleur vit dans `:root` : une règle nouvelle prend un jeton, jamais une valeur. Les anciens noms restent des
alias en `var()` (seul `--sage` garde une valeur propre, `#b9c8bb`), pour les règles qui les portent encore. La hauteur de la barre
est un jeton, `--topbar-h` (64 px) : le panneau latéral (≥ 900 px) et le `scroll-margin-top` des cartes la suivent ; `.btn.big`
garde son `56px` en dur, seul restant. Ni `color-mix()` ni `oklch` (iOS < 16.2), aucune police externe, aucune image.

**`[hidden] { display: none !important; }`** (T-9). Le JS cache par l'attribut `hidden` (pastille, mention K1, erreurs, aides) ;
une règle d'auteur qui pose `display` (`.status` en `inline-flex`, `.row`, `.btn`) le montrerait sinon. D'où R-VIS-1 : la règle
`.status[hidden]` du lot 2 est retirée, redondante. L'inventaire des `display: none` est **exact** (les cinq d'origine, `[hidden]` à
part) et la feuille ne contient ni `visibility: hidden`, ni `opacity: 0`, ni `font-size: 0` : cacher autrement qu'avant serait un
changement de comportement.

**Comment `tests/theme.js` mesure** (la feuille est LUE et MESURÉE, jamais recopiée dans le test). Deux temps.
1. **Lecture** : `fetch('../styles.css?v=…', { cache: 'no-store' })`, commentaires retirés ; `:root` lu par une expression ancrée,
   `hex()` résout les `var()` en chaîne ; les paires `PAIRES` (texte, fond, où : spec § 3.6) sont calculées par la formule WCAG ;
   inventaire des `display: none`, couleurs en dur et couleurs nommées hors `:root`, contenu des blocs `:focus-visible`, mouvement
   réduit et `@media (hover: hover)` ; `index.html` et le manifeste sont relus. Depuis la vague finale (R-VIS-14), un petit lecteur
   `regles()` rend les règles dans l'ordre des sources avec leur `@media` : `.status` doit venir après `.row`, et les règles de base de
   `.toast` (`bottom`) et de `main.content` (bas du `padding`) doivent rester calées sur `calc(var(--nav-h) + var(--safe-b) + …)`.
2. **Rendu** : la feuille est injectée par un `<link>` (avec `?v=`) dans une scène hors écran mais **visible**
   (`position:absolute; left:-9999px`, 390 px de large) ; les composants y sont montés, puis mesurés par `getBoundingClientRect` et
   `getComputedStyle` (couleurs ramenées en hex par `rgbVersHex`) ; le `<link>` et la scène sont retirés en `finally` (aucun reste,
   vérifié par les mutants des tâches). Les règles qui portent le comportement (R-VIS-14) y sont mesurées : `.row` en `wrap`, une
   mention `div.status.row.between` en `inline-flex`, `details.menu-source > summary` en `inline-flex` sans marqueur, `.cover-wrap` en
   `relative`.

Deux limites assumées : la page de tests est large, donc les règles sous 440 px (R-VIS-4) n'y jouent pas — seule la preuve visuelle
les mesure ; et les assertions de focus suivent l'heuristique `:focus-visible` de Chromium (une interaction au pointeur avant le bloc
donnerait un faux rouge, jamais un faux vert).

**La preuve visuelle vit hors git**, dans le registre du lot : `.superpowers/sdd/2026-10-18-refonte-visuelle/preuve-visuelle.cjs`
(Playwright **dédié**, jamais le navigateur MCP partagé ;
`node preuve-visuelle.cjs 8085 [--css=<fichier>] [--largeurs=…] [--seulement=…]`, code de sortie 0 = vert) et `galerie.html` (toutes les variantes de composants ; servie par le serveur de l'arbre,
elle lie `/styles.css`). Quatre largeurs (375 × 812, 390 × 844, 768 × 1024, 1512 × 982), `reducedMotion: 'reduce'`, service workers
bloqués, réseau externe coupé (sauf l'API interceptée de M3), porte passée par « Continuer sans compte ». Colonnes : débordement,
navigation, cibles, contraste par nœud texte contre son fond effectif (un dégradé compte comme ses arrêts, le pire gagne), `[hidden]`,
console ; plus **M3** (vrai vol sur `#/search?mode=web`, configuration factice, API interceptée, aucune clé réelle) et **M14** (focus au
clavier réel, rayons de l'anneau lus par coin). Sorties : `resultats.md` / `.json` et `captures/<largeur>-<nom>.png`. `--css=<fichier>`
sert une feuille figée : c'est ainsi que l'outil a été vu ROUGE sur l'ancien thème (331 fautes) avant de servir de preuve. Le registre
se copie dans le dépôt principal **avant** tout `git worktree remove`, sinon l'outil et les captures disparaissent.

**Rulings** : R-VIS-1 à R-VIS-14, une ligne chacun en spec § 8 (registre : `progress.md`, `task-3-report.md`). Trois touchent la
structure plus que la couleur : **R-VIS-7** `.cover { position: relative }` (l'image d'une couverture prend `.cover` pour bloc
conteneur : coins arrondis, même rectangle à 0,1 px près) ; **R-VIS-8**
`.status[role="status"] + .row > .btn:not(.primary) { margin-left: auto }` (« Annuler » à droite pendant un vol ; dépend de l'attribut `role` posé par `search.js:202` et `creer-ia.js:238`,
seules annonces suivies d'une `.row`) — un **crochet de style** sur une structure du JS : `role="status"` est gardé par les tests de
comportement (`tests/recherche-web.js:383`, `tests/creer-ia.js`), mais l'assertion R-VIS-8 de `tests/theme.js` construit son propre DOM,
donc une rangée enveloppée ou une classe `.status` changée ne serait vue que par la preuve M3 (hors git) ; **R-VIS-10** `.chip.clickable:has(> input:checked)` (ignorée sans prise en charge de `:has()` :
retour à la puce neutre). **R-VIS-13** (vague finale) `--warn: #8b5f10` : l'ambre d'une quantité estimée sur une ligne surlignée du
mode cuisine (`.cook .ingredients li.hit .est`, accent-bg) passe de 4,49 à 4,62 ; c'est la 28e paire. **R-VIS-14** : ce qui portait
le comportement n'était tenu que par la relecture (cinq mutants survivaient) ; il est épinglé par `tests/theme.js`.

## La passerelle de l'assistant (18 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md` (rév. 2 ; § 9 : décisions du 18 octobre ; § 10 : rulings
R-PV-1 à R-T4-11). Livré ici (branche `passerelle-assistant`, non fusionnée) : l'app n'appelle plus l'API d'Anthropic. Elle poste à
une fonction Supabase, `assistant`, avec la session de la personne ; la clé Anthropic est un secret du projet et ne quitte jamais le
serveur. Un module neuf côté app (`passerelle.js`), une fonction et une migration côté serveur ; ailleurs, des gardes « Connecte-toi »
et une section Réglages sans champ. Amendé par la vague finale de la revue de branche (F-1 à F-14, commits `f43e071` et `2a2f838`) : les
points touchés sont dits ci-dessous ; la fonction est déployée en version 3 (code `2a2f838`).

```text
app (GitHub Pages, session Supabase)
  |  POST /functions/v1/assistant   corps { outil, corps }   (outil : recherche-web | creation | extraction)
  |  authorization: Bearer <access_token>  .  apikey: <clé publique du projet>  .  content-type: application/json
  v
fonction « assistant » (Deno, verify_jwt false), gardes dans CET ordre :
  OPTIONS -> 204 | origine admise | méthode POST ou GET | jeton de forme valide | auth.getUser(jeton) |
  is_allowed() (clé publique + jeton de la personne) | GET -> { modele, quotaJour, cles }, fin |
  corps lu en flux, coupé à 8 Mio | JSON + liste blanche + bornes de l'outil (lireDemande)
  |
  v   rpc, clé SECRÈTE du projet
public.assistant_reserver(owner, outil, octets, quota)   verrou consultatif par compte, comptage du jour UTC,
  |                                                      insertion « en vol » (statut 0) ; null = quota atteint -> 429
  v
api.anthropic.com/v1/messages   x-api-key = secret ANTHROPIC_API_KEY, modèle forcé, redirect 'error', 120 s ;
  |                               req.signal (le client part) abandonne l'appel -> journal 499, aucun corps relayé
  |
  v   réponse lue bornée (2 Mio d'octets), corps relayé tel quel pour 200 / 400 / 403 / 413 / 429
public.assistant_journal : la ligne reçoit statut, jetons, durée (jamais de contenu) ; vue public.assistant_usage_jour
```

**Modules, un rôle chacun.**
```text
supabase/functions/assistant/logique.js   pur (aucune API Deno ; tourne sous Node et sous Deno) : OUTILS, LIMITES, origineAdmise,
                                          entetesCors, lireDemande (liste blanche par outil, modèle forcé, bornes en octets),
                                          statutRelaye, ligneJournal (compteurs), corpsErreur, decisionQuota (règle de référence
                                          testée sous Node ; plus importée par index.ts : la règle vit en SQL).
supabase/functions/assistant/index.ts     Deno.serve : l'ordre des gardes, lireCorpsBorne (demande et réponse), la réservation,
                                          l'appel (abandonné si le client part : 499), la mise à jour du journal, le try/catch global ;
                                          secrets lus à chaque requête ; cleDepuis(brut, prefixe) lit les clés Supabase injectées sous
                                          toutes leurs formes, à condition qu'elles portent leur préfixe (repli sur les clés legacy).
supabase/functions/assistant/deno.json    import map : npm:@supabase/supabase-js@2.118.0 (épinglé) ; deno.d.ts : types pour tsc, jamais importé.
supabase/migrations/0004_assistant_journal.sql   table, vue, fonction ; à ajout seul ; hors du générateur (NOMS inchangé).
supabase/proofs/0004_assistant_journal.sql       preuve (24 instructions + 5 blocs do ; 1.09 : droits de service_role dont USAGE sur la
                                          séquence de id) ; jamais jouée.
src/domain/passerelle.js    transport pur : appelerAssistant (POST), etatAssistant (GET), echecDomaine, urlAssistant, sessionValide.
src/domain/llm.js           PasserelleProvider ; providerFrom(settings, { session }) ; NoneProvider sans session ;
                            pagePourEnvoi(blob) : la copie d'une page qui part à l'assistant (1568 px au plus, JPEG).
src/domain/recherche-web.js, creation-ia.js   transport seulement (session au lieu de cfg) ; toute leur logique est inchangée.
src/sync/auth.js            jeton() : { access_token, user: { id, email } } | null ; lecture locale, un jeton expiré peut être rafraîchi
                            par le réseau par supabase-js (l'attente est bornée à 2 s par sessionAssistant).
src/ui/components.js        sessionAssistant(ctx, { delaiMs }), carteConnexion(connecter, ctx), messageGardeRefusee, texteRefusAssistant,
                            texteEchecAssistant.
src/ui/settings.js          section Assistant (sans session, ou avec session et un GET) ; src/model/repo.js effacerCleLocale() (à chaque
                            init()) ; src/app.js installCapture avant init().
tests : tools/assistant-logique.test.mjs, assistant-index.test.mjs (+ faux/supabase.mjs), generer-migrations.test.mjs ; tests/passerelle.js.
```

**Ordre des gardes (côté app).** `sessionAssistant(ctx)` rend `null` sans compte reconnu sur l'appareil (`ctx.sync.user`), sans appeler
`jeton()`, et au-delà de 2 s (`Promise.race`, comme `demarrerSync`). Sans session valide (jeton ASCII visible), `appelerAssistant` rend
`non_connecte` sans `fetch`. Un seul transport interne pour le POST et le GET : trois en-têtes, `redirect: 'error'`, `credentials: 'omit'`,
corps de succès lu en flux (2 Mio), corps d'erreur (64 Kio) lu pour son seul champ `erreur`, jamais rendu. Le jeton n'entre dans aucun
objet rendu. Les écrans (`search.js`, `creer-ia.js`, `import.js`, `recipe-edit.js`) lisent la session au rendu et la relisent à l'appel.
Quand la garde de compte a refusé l'adresse sur cet appareil (`ctx.sync.guard.ok === false`), `carteConnexion` dit le message de la garde au
lieu de « Connecte-toi » et n'offre pas « Se connecter » (il boucle sur le même refus) ; Réglages fait de même. Les pages d'une lecture sont
réduites avant l'envoi (`pagePourEnvoi`) ; une page indécodable n'est jamais envoyée.

**Réservation atomique.** `public.assistant_reserver` fait en une transaction ce que deux appels simultanés ne pouvaient pas faire
séparément : prendre un verrou consultatif propre au compte, compter les lignes du jour UTC, refuser au quota (`null`), sinon insérer la
ligne « en vol ». Elle est `security invoker` (seule la clé secrète a des droits sur la table : un `execute` qui fuirait tomberait en
42501) ; le motif suppose READ COMMITTED, défaut de PostgREST. Un plantage laisse une ligne au statut 0 qui compte : voulu. La
concurrence elle-même ne se prouve pas dans l'éditeur SQL (une session, verrous réentrants).

**Bornes.** Demande : `content-length` refusé avant lecture, flux coupé à 8 Mio (la plus grande borne d'outil), puis 512 Kio
(`recherche-web`, `creation`) ou 8 Mio (`extraction`), en octets ; `max_tokens` ≤ 16 000 (défaut `min(4000, plafond)`) ; `system` ≤ 20 000
caractères, 20 messages, `max_uses` ≤ 5 ; délai amont 120 s ; réponse ≤ 2 Mio d'octets ; quota par défaut 60 par compte et par jour UTC,
borné à l'int4 (secret `ASSISTANT_QUOTA_JOUR`). Côté app : 135 s par appel (le serveur attend Anthropic 120 s plus ses propres étapes, et l'idle de
la plateforme est de 150 s ; le GET d'état de Réglages garde 15 s), corps d'état 16 Kio ; une page envoyée tient en 1568 px de côté au plus.

**Classement des statuts.**

| Statut de la fonction | Corps | Issue côté app |
|---|---|---|
| 204 (`OPTIONS`) | aucun ; `Allow-Origin` seulement si l'origine est admise | — |
| 200, 400, 403, 413, 429 d'Anthropic | corps d'Anthropic, sans champ `erreur` | succès ; 400/413 → `requete` (413 : « trop lourde ») ; 403 → `serveur` ; 429 → `trop_de_demandes` |
| 401 | `non_connecte` | `non_connecte` |
| 403 | `non_admis` | `non_admis` |
| 403 | `origine` (absente ou refusée) | `serveur` (une panne de configuration, pas un compte refusé) |
| 405 | `methode` | `requete` |
| 400 / 422 / 413 | `requete` / `bornes` / `trop_lourd` | `requete` (413 : « trop lourde » ; « choisis moins de pages » pour une lecture de pages) |
| 429 | `quota` + `quota: n` | `quota` (« {n} appels », ou sans nombre) |
| 502 | `serveur` : réservation en erreur, exception, réponse > 2 Mio, 401 / 404 / 5xx / redirection d'Anthropic | `serveur` |
| 503 | `serveur` (529 d'Anthropic) | `serveur` |
| 504 | `delai` | `delai` |
| 499 | aucun corps : le client est parti, l'appel amont est abandonné | — (le client n'est plus là) ; la ligne du journal porte 499 |

**Ce qui est absent.** Streaming, cache des réponses, plusieurs modèles par outil, quotas par jetons (le quota compte des appels), relevé
d'usage dans l'app (aujourd'hui : `public.assistant_usage_jour` dans l'éditeur SQL), assistant sans compte, plusieurs clés ou
fournisseurs (`OpenAICompatibleProvider` est retiré), gestion de `pause_turn` (relayé tel quel), et le retrait du magasin
`assistant_config` (26 → 25) : il reste, ainsi que `assistant-config.js`, mais plus rien ne le lit pour l'assistant. Une passe de
`repo.init()` (`effacerCleLocale`) réécrit vide toute ligne qui porte une clé ou un fournisseur, en origine `local` : sur un hôte de production,
la ligne vide part au compte et efface la clé du serveur et des autres appareils. Elle tourne à **chaque** démarrage, sans garde (une garde
« une fois » laissait passer une clé arrivée après le premier démarrage) : une ligne déjà vide, incomplète ou absente n'écrit rien. Dette nommée
(F-15, M7) : le corps de la demande, jusqu'à 8 Mio, est analysé deux fois (`index.ts`, puis `lireDemande`).

**Ce qui n'est pas prouvé.** La preuve `0004` n'a pas été jouée ; aucun POST réel n'a eu lieu (aucun appel à Anthropic, aucune ligne de
journal) ; le préflight d'un vrai navigateur, le `GET` avec session (dont la valeur de `cles` : par quelle voie la plateforme sert les clés),
`is_allowed` pour une session non admise, l'abandon du client → 499 (prouvé sous Node seulement : que `req.signal` s'abaisse dans le runtime
Supabase reste à constater), l'ordre `installCapture` / `init()` dans l'app réelle (`app.js` n'est pas importable par la suite), Safari et
l'iPhone. Mesuré : le déploiement (v1, v2 et v3) et neuf sondes `curl` sans dépense, identiques aux trois versions
(`supabase/proofs/RESULTATS-mitsu.md`).

## Importer une recette repérée : le journal d'import (18-19 octobre 2026, lot A)

Spec : `docs/superpowers/specs/2026-10-18-import-cible-design.md` (rév. 3.1 ; § 3 : données ; § 3.6 : primitives ; § 12 : rulings, jusqu'à la clôture
du chef d'orchestre : VF-1 à VF-17). Livré ici (branche `import-cible`, non fusionnée) : une recette « Repérée dans ton livre » s'importe depuis son
propre écran, et chaque lecture de l'assistant passe par un journal, le magasin `imports`, AVANT d'atteindre un écran ou une recette. Un magasin neuf
(le 27e synchronisé), une porte d'écriture conditionnée, un domaine pur et un écran neufs ; la passerelle et la fonction `assistant` sont inchangées ;
côté serveur, une migration générée à ajout seul, `0005`. Amendé par la vague finale (battement hors de la ligne synchronisée, VF-2), par la ronde
finale 2 (pages déjà liées seulement si leurs octets sont là, garde I-5 de couverture) et par la clôture du chef d'orchestre (spec § 12, 19 octobre :
m9, m12 et m13 ratifiés, `hb-ignore` équivalent, VF-16 et VF-17).

```text
fiche du livre « Importer » · fiche « Importer cette recette » / « Relire les pages » · section « Imports » « Reprendre »
  |
  v
#/recipes/<id>/importer   (src/ui/import-cible.js ; route de saisie : une passe de synchro ne redessine pas l'écran en plein vol)
  | 1re photo : repo.ajouterPages({ import }) -> octets dans files, puis UNE transaction : imports a_lancer + scan_sessions + source_documents
  |             + source_pages, conditionnée (la ligne n'existe pas ; aucun import ouvert pour ce recipe_id) ; pages déjà liées en tête (octets ici)
  | ordre, retrait, pointeur de la photo du plat : repo.transitionner sur place (attendus a_lancer | a_verifier | echec)
  | p. imprimée : repo.save('source_pages', …) -> source_pages.printed_page ; la ligne imports n'est pas touchée
  v
« Extraire et enregistrer » -> lancerExtraction : UN vol par document (DOCUMENT_ID), posé avant tout await
  gardes : vol tenu | hors ligne | session | pages | octets | image  -> refus, rien d'écrit
  a_lancer | echec -> en_cours   (started_at, document_id_vol, battement_at ; refusé si page_ids a changé depuis la lecture des pages)
  battement toutes les 15 s : sync_state « battement:<id> » (status 'vol', origine device : hors file, aucun change)
  appels + 1 au départ du fetch -> PasserelleProvider.complete : POST /functions/v1/assistant, outil extraction, max_tokens 6000, signal
  |
  v
extraireRecette : stop_reason max_tokens -> coupe ; JSON -> validateParsedRecipe (bornes, Cc/Cf retirés) ; ni ligne ni étape -> vide
  |  en_cours -> a_verifier (resultat, reponse_brute <= 16 000 points de code, model, duree_ms)      [I-3 : AVANT toute recette]
  |  sinon en_cours -> echec(raison) ; « Annuler » -> echec(annule) ; réponse arrivée après : reponse_brute seule, l'état reste echec
  v
decider() : résultat REVALIDÉ (hostile : a_verifier -> echec(illisible)) ; référence RELUE ; discordance (D-6) -> « Rattacher » ;
            « Remplacer par cette lecture ? » (I-5 : une version non ai peut être courante, ou des pages courantes ne sont pas relues,
            mesurées sur les pages de la nouvelle version, VF-17) ;
            fabriquerExtraction
  |
  v
UNE transaction : imports a_verifier -> enregistre (reponse_brute null, finished_at ; liée à cleLecture)
                  + recipes (même id) + recipe_versions (extraction) + source_pages (kind recipe, position) + scan_sessions (done)
```

**Modules, un rôle chacun.**
```text
src/domain/import-cible.js   pur : TRANSITIONS (gelée en profondeur), RAISONS_ECHEC, MOTS_VIDES, motsDistinctifs, discordance, deplacerPage,
                             retirerPage, fabriquerExtraction (version extraction + fiche + pages ; remplacer: false = « Garder ma version »),
                             pagesNonRelues (couverture, ronde finale 2), ageDepuis, dateReception, seanceDUnImportCible, KINDS_IMPORT,
                             IMPORTS_OUVERTS, importOuvert, cibleReprise, lignesImports (les lignes de la section ; l'écran traduit).
src/domain/vocabulaire.js    pur : assertVocabulaire(fiche, magasin) chez les fabricants (D-12) ; ErreurVocabulaire { magasin, champ, valeur }.
src/ui/import-cible.js       l'écran (renderImportCible, etatRoute) ; le vol, au niveau du module (lancerExtraction, annulerVol, tenirVol,
                             libererVol, volEnCours, DOCUMENT_ID, BATTEMENT_MS) ; la plomberie du journal partagée par l'éditeur et le panneau
                             d'index (lireDansLeJournal, relireDuJournal, cleLecture) ; une phrase par raison (texteEchec, phraseEchec, texteRefus).
src/core/db.js               mutate({ …, conditions }) : lecture, vérification et écriture dans UNE transaction ; TransitionRefusee.
src/model/repo.js            transitionner (nettoyage R61, updated_at, un change par magasin, autres), saveBatch(…, { conditions }),
                             ajouterPages, ouvrirImport, battre, oublierBattement ; à chaque init() : marquerInterrompus, puis la purge à 30 jours.
src/model/schema.js          DB_VERSION 4, STORES.imports, RELATIONS, MAGASINS_AJOUTES_APRES_V1, STATUTS_IMPORT, IMPORTS_TERMINES.
src/domain/llm.js            consigne amendée (incomplete, missing_page, étape entière) ; extraireRecette (signal, stopReason,
                             modele, texteBrut) ; validateParsedRecipe (exportée, bornée ; `extraireIndex` et `validerIndex` retirés par le lot C, R-C-6 : `extraireTableMatieres`, `validerLectureIndex`) ; ErreurExtraction ; pagePourEnvoi
                             muré avant le décodage (LIMITES_ENVOI : 50 Mo, 50 Mpx).
src/domain/backup.js         une archive de format 1 sans imports s'inspecte et se restaure (imports vaut []).
src/sync/tables.js           SYNC_STORES_0003 figée (26 noms) ; tools/generer-migrations.mjs rend 0005 pour les magasins absents de cette liste.
src/core/image.js            preparerPhotoLocale (le mur des couvertures : 25 Mo, 16 Mpx, JPEG 1 200 px), partagé avec la photo du plat.
src/ui/add.js                la section « Imports », avant la grille ; book.js « {n} imports à reprendre » et séances filtrées ; import.js (panneau
                             d'index par le journal, séances filtrées) ; recipe-edit.js (?import=, « par paragraphe », héritage de la lecture) ;
                             recipe.js, cook.js, grocery.js, components.js (bandeau de lecture, puce « incertain », « Lue par l’assistant, non relue »).
supabase/migrations/0005_imports.sql   générée, à ajout seul : public.imports et les quatre fonctions recréées avec les 27 noms.
supabase/proofs/0005_imports.sql       preuve (35 verdicts, jamais la colonne data, rollback dernier) ; jamais jouée.
tests : tests/import-cible.js (neuf), tests/fixtures/archive-0.8.1-sans-imports.zip, tests/passerelle.js ; tools/generer-migrations.test.mjs.
```

**Le magasin `imports`.** Une ligne par lecture (ou tentative de lecture), clé `id` (`imp_…`), index `edition_id`, `recipe_id`, `status` ; dernier
magasin synchronisé (dans `STORES`, après `assistant_config` et avant `settings`, qui n'est pas synchronisé : ordre de réception, K-9) ; archivé.
`nouvelleLigneImport` (une définition pour `ajouterPages` et `ouvrirImport`) fabrique la ligne neuve avec tous ses champs, sauf trois, posés ailleurs :
```text
id, kind ('recette' | 'index' ; 'web' et 'couverture' réservés aux lots B et E), edition_id, recipe_id (null : index ou « Regrouper en recette »),
scan_session_id, page_ids (ORDRE de lecture : la seule source de vérité de l'ordre), photo_sha256 (null),
status ('a_lancer'), erreur { raison, extra } (null), resultat (sortie validée : une recette, ou { entries, uncertain } pour un index),
reponse_brute (<= 16 000 points de code, diagnostic, jamais rendue, null à enregistre), appels (0), model (<= 80 points de code), duree_ms,
device_id (l'appareil des photos), document_id_vol (le document qui tient le vol), battement_at (posé au DÉPART du vol, plus ensuite),
started_at, finished_at

posés ailleurs :
photo_origin ('photo' | 'image')   plus tard, au premier « Prendre une photo » ou « Choisir une image », avec photo_sha256 :
                                   repo.transitionner('imports', id, { attendus: a_lancer | a_verifier | echec, patch: { photo_sha256, photo_origin } })
created_at                         par horodater, dans le saveBatch qui écrit la ligne neuve
updated_at                         par horodater (même saveBatch), puis à chaque repo.transitionner
```

| Statut | Sens | Transitions sortantes (toutes par `repo.transitionner`) |
|---|---|---|
| `a_lancer` | pages là, rien d'envoyé | `en_cours` (départ), `ignore` |
| `en_cours` | un vol : un document, un battement | `a_verifier` (réponse validée) ; `echec` : la raison de l'appel, `annule` (par le document du vol), `interrompu` (passe du démarrage ou de l'affichage), `incertain` (réponse reçue, écriture impossible) |
| `a_verifier` | lecture reçue, validée, dans le journal | `enregistre` ; `a_lancer` (« Changer les pages ») ; `ignore` ; `echec(illisible)` pour un seul cas : un résultat relu (synchro, archive) qui ne passe plus sa validation (T4-R1) |
| `echec` | `erreur.raison` dit pourquoi | `en_cours` (« Relancer »), `a_lancer`, `ignore` |
| `enregistre`, `ignore` | terminaux (`IMPORTS_TERMINES`) | aucune ; supprimés après 30 jours |

Une lecture SANS référence (éditeur, panneau d'index) relancée sur d'autres pages passe `a_verifier → a_lancer → en_cours` en UNE transaction, après
les gardes du vol (T6-R1-a). Une réponse arrivée après `annule` ou `interrompu` tenterait `echec → a_verifier`, qui n'existe pas : elle n'écrit que
`reponse_brute`, le prix assumé de I-4 (« L’appel a peut-être été compté ; relancer en coûtera un autre. »). `TRANSITIONS` documente ; le mur, à
l'exécution, est la liste `attendus` de chaque écriture.

**Vocabulaire.** `assertVocabulaire(ligne, 'imports')` exige un `status` de `STATUTS_IMPORT` à la naissance d'une ligne, comme
`assertVocabulaire(fiche, 'recipes')` chez les cinq fabricants de recettes (`fabriquerExtraction`, `fabriquerRecetteIA`, `fabriquerSignet`, le
`save()` de l'éditeur, « Créer les références ») ; la restauration, la réception et les passes du démarrage restent tolérantes (D-12). Les raisons
d'échec forment une liste fermée (`RAISONS_ECHEC`) : celles que la passerelle classe (`non_connecte`, `non_admis`, `quota`, `trop_de_demandes`,
`requete`, `serveur`, `delai`, `reseau`, `interne`, `reponse_illisible`), puis celles du journal (`annule`, `coupe`, `illisible`, `hors_bornes`,
`vide`, `interrompu`, `incertain`) ; tout autre message devient `interne`, jamais un texte libre. Une ligne reçue hors vocabulaire (sorte ou statut
inconnus) n'est ni listée ni reprise (`importOuvert`, une seule définition, VF-11) ; un STATUT inconnu ou nul ne bloque pas non plus la première photo
(éprouvé : statuts `zzz` et `null`, `tests/import-cible.js`). Une SORTE inconnue ou réservée (`web`, `couverture`) au statut ouvert BLOQUE en
revanche, sur la même `recipe_id` : la condition de création (`{ index: 'recipe_id', valeur, exclus: IMPORTS_OUVERTS }`, `nouvelleLigneImport`) et la
pré-vérification d'`ajouterPages` ne regardent que le statut, jamais `kind`, alors que l'écran ciblé ne retient que `kind === 'recette'`
(`ligneOuverte`) ; `ajouterPhotos` avale la `TransitionRefusee` sans toast : « Photographier » reste muet. Aucun client du lot A n'écrit une telle
ligne (seulement `recette`, et `index` sans `recipe_id`) ; à trancher au lot B (une condition sensible à la sorte, ou la ligne `web` montrée et
reprise par l'écran ciblé ; dans les deux cas, un refus dit).

**Relations d'archive et rétention.** `edition_id → book_editions` et `scan_session_id → scan_sessions` sont des relations d'archive ;
`recipe_id`, `page_ids[]`, `photo_sha256` et, côté versions, `provenance.import_id` sont des pointeurs souples (une recette supprimée, une page
retirée ou une ligne purgée ne bloquent pas une archive ; la fabrication ignore une page absente). `MAGASINS_AJOUTES_APRES_V1 = ['imports']` :
absent d'une archive de format 1, le magasin vaut `[]` à l'inspection et à la restauration (décomptes et empreintes ne l'exigent pas) ; un
client 0.8.x refuse une archive neuve (trois messages, `supabase/README.md`, étape 11 : « mets l'app à jour »). À `enregistre`, `reponse_brute`
passe à `null` ; à chaque `init()`, les lignes `enregistre` et `ignore` dont `updated_at` a plus de 30 jours sont supprimées par UNE suppression
conditionnée d'origine `local` (tombale synchronisée : la ligne disparaît aussi du serveur et des autres appareils ; « À envoyer » monte
d'autant ce jour-là) ; une ligne qui ne serait plus terminée annule la purge, retentée au démarrage suivant ; un `echec` attend un geste ; une
date illisible ne purge pas. Les incertitudes du modèle vivent aussi dans la version (`provenance.uncertain_fields`, VF-10) : la purge ne les
efface pas d'une fiche encore à vérifier.

**Côté serveur (`0005`, générée).** `public.imports` suit le gabarit des 26 autres tables (`owner_id`, `id`, `data` jsonb, `updated_at`,
`server_seq`, `deleted_at` ; RLS `is_allowed() and owner_id = auth.uid()` ; suppression directe seulement sous `app.purge` ; déclencheur
`imports_seq`), plus trois colonnes générées stockées, `edition_id`, `recipe_id` et `status` (`data->>…`), chacune avec son index ; `revoke all
on public.imports from anon` ; `sync_push`, `sync_purge`, `sync_purge_all` et `purge_tombstones` sont recréées avec les 27 noms (`keys.imports =
"id"`, `required.imports = []` : `required` ne liste que ce que l'app pose toujours, et `edition_id` ou `scan_session_id` peuvent manquer).
`0001` à `0003` ne changent pas d'un octet (empreintes épinglées) ; `0005` se fige (`SYNC_STORES_0005` + empreinte) une fois collée.

**Écritures conditionnées (I-10).** `db.mutate({ puts, deletes, clearStores, origin, payloads, conditions })` : avec des conditions,
`ecrireConditionne` ouvre UNE transaction readwrite sur tout ce qui est touché (plus `outbox` si la base l'a), lit chaque condition (`get`, ou
`index.getAll(valeur)`), vérifie, fusionne le patch (objet ou `(courant) => objet`), appelle la capture d'outbox de façon synchrone dans le rappel de
la dernière lecture (elle voit la fiche fusionnée), puis écrit ; une condition fausse annule la transaction et lève `TransitionRefusee { store, key,
statut }` — rien n'est écrit, pas même les `puts`. Trois formes : `{ key, attendus, patch? }`, `{ key, absente: true }` (une création n'écrase jamais
une ligne), `{ index, valeur, exclus }` (un seul import ouvert par `recipe_id`, I-2). Sans condition, le chemin ordinaire est inchangé, et
`MUTATING_METHODS` aussi. `repo.transitionner(store, key, { attendus, patch, puts, deletes, payloads, origin, autres })` est la seule porte de
TRANSITION des écrans (test statique : hors `repo.js`, `transitionner(` n'apparaît que sous la forme `repo.transitionner(` ; une écriture sans statut
n'y passe pas : le numéro imprimé d'une page, `repo.save('source_pages', …)`) : nettoyage des chaînes, `updated_at = syncNow()`, un `change` par
magasin, la fiche écrite en retour ; `autres` porte des conditions sur d'AUTRES magasins (le battement interne, ci-dessous).

**Le vol (I-7) et son battement.** Un vol par document (onglet) : une variable de module posée AVANT tout `await` (une double tape ne fait qu'un POST)
et libérée en `finally` ; `DOCUMENT_ID` est écrit dans `document_id_vol` ; seul ce document offre « Annuler » (`annulerVol` lève le signal du `fetch`
et écrit `en_cours → echec(annule)`) ; ailleurs, « En cours sur un autre écran ». « Extraire » de « Corriger » (lecture hors journal d'une recette
existante) tient le même vol, sans ligne (`tenirVol`, VF-14). Le départ vaut pour les pages LUES : si `page_ids` a changé pendant la réduction des
images, la transition de départ refuse et rien ne part (VF-4). Le battement vit HORS de la ligne synchronisée (VF-2) : toutes les 15 s, `repo.battre`
écrit dans `sync_state` la ligne `battement:<id>` (`{ key, status: 'vol', value: iso }`, origine `device` : jamais capturée, jamais envoyée, aucun
`change`), effacée en `finally` par `repo.oublierBattement` — réécrire `imports` à chaque battement posait un `updated_at` neuf, déclenchait une passe
de synchro et renvoyait des échos en conflit. `repo.marquerInterrompus` tourne à chaque `init()`, à l'affichage de la section « Imports » quand le
journal porte un vol (une fois de plus après 91 s si la page est montée) et à l'affichage de l'écran ciblé (puis toutes les 91 s tant que sa ligne
vole ailleurs) : une ligne `en_cours` est vivante si son battement interne a moins de 90 s, ou, pour CET appareil, si son `battement_at` de départ a
moins de 90 s, ou, pour un AUTRE appareil, si `battement_at` ou `started_at` ont moins de 10 min à l'heure corrigée par le décalage serveur ; un
horodatage à plus de 10 min dans le futur ne prouve rien (VF-12). Sinon `en_cours → echec(interrompu)`, conditionnée : le battement est relu DANS la
transaction (`autres: { sync_state: [{ key, attendus: ['vol'], patch qui refuse s'il est frais }] }`, ou `absente` s'il ne l'était pas à la lecture)
et effacé avec elle. `appels + 1` est écrit juste avant l'appel réseau, par l'enveloppe du `fetch`.

**Reprise et lectures sans référence.** `lignesImports` (pur) rend les lignes de la section : imports ouverts, les plus récents d'abord, puis
séances `open` qui ne sont pas celle d'un import ciblé ouvert ; gestes par état, par appareil (« Photos sur un autre appareil » : « Reprendre »
seulement avec un résultat, jamais « Relancer ») et par référence (absente : aucun geste ; devenue `available` : « Ignorer » seul).
`cibleReprise` : recette ciblée → `#/recipes/<id>/importer?import=<imp>`, recette sans référence → `#/recipes/new?import=<imp>`, index →
`#/import?session=<s>&import=<imp>`. L'écran ciblé choisit la ligne affichée, puis `?import=`, puis une lecture reçue, puis celle de cet
appareil (VF-6). L'éditeur (« Extraire avec l'assistant IA » d'une recette neuve) et le panneau d'index passent par `lireDansLeJournal` :
gardes AVANT toute écriture, ligne reprise par la transition de départ ou ouverte (`repo.ouvrirImport`), réponse écrite `a_verifier`, relue
et REVALIDÉE (`validateParsedRecipe` ; `validerIndex` est remplacé par `revaliderResultatIndex` depuis le lot C) ; la clôture (`enregistre`) se fait dans la transaction de la recette ou des références et
ne vaut que pour LA lecture posée (`cleLecture = [id, started_at, resultat]`). Seule la séance d'un import ciblé ouvert quitte les rappels
génériques (« Séances à reprendre », « Séance en cours », « Photos conservées ») ; elle y revient après « Ignorer ».

**Frontière avec la passerelle.** Le lot est un CLIENT de la passerelle, rien de plus (D-5) : `PasserelleProvider.complete` poste `{ outil:
'extraction', corps }` à `/functions/v1/assistant` avec la session (borne serveur de 8 Mio pour cet outil ; `max_tokens` plafonné à 16 000 par
le serveur : le lot demande 6 000 pour une recette, 4 000 pour un index) ; les pages partent dans l'ordre de `page_ids`, réduites par
`pagePourEnvoi` (1 568 px, JPEG) et murées à 50 Mo et 50 Mpx AVANT le décodage (VF-13) ; le `signal` du vol est celui d'`appelerAssistant` (le
serveur abandonne alors l'appel amont et journalise 499 : prouvé sous Node seulement, lot passerelle F-5). Les raisons de l'appel sont celles
d'`echecDomaine` et leurs textes ceux de `texteEchecAssistant` ; le lot n'ajoute que les siennes. Deux compteurs distincts : `imports.appels`
(les départs de CETTE ligne, côté app) et `public.assistant_usage_jour` (le quota du serveur, 60 appels par compte et par jour UTC) ; chaque
départ compte dans le quota, même annulé (I-4). Rien dans le lot ne lit `assistant_config` ni ne nomme le fournisseur ; un corps d'erreur n'est
jamais rendu ; `reponse_brute` (le texte du modèle, borné) non plus. La fonction `assistant` et `0004` sont inchangées.

**Ce qui est absent.** Lecture d'une page web (B), octets entre appareils (G), table des matières structurée et ordre proposé (C), classement
automatique d'un lot de photos (D), lecture de la couverture (E), photo du plat automatique (F) ; relecture d'une recette `available` ; glisser au
toucher (Monter / Descendre seulement) ; verrou serveur (deux appareils qui importent la même référence : le dernier qui enregistre gagne) ; quota
visible dans l'app ; « Ignorer » sur une ligne dont la référence n'est pas encore reçue (m9) ; borne d'octets dans `ajouterPages` (m12 : elle
toucherait les PDF et EPUB de la séance générique) ; abandon de la relecture de « Corriger » au changement de route (m13) — m9, m12 et m13 ratifiés
tels quels à la clôture (spec § 12). Dettes nommées : `cleLecture` sérialise `resultat`, une ligne ré-reçue aux clés JSON réordonnées change de clé
(refus prudent) ; I-2 aveugle à la sorte (ci-dessus, « Vocabulaire » ; à trancher au lot B) ; `imports` chargé dans `getData` à chaque rendu (spec §
11, « à surveiller » : `reponse_brute` bornée, effacée à `enregistre`) ; VF-16, deux dettes de texte de la question I-5 posée par la seule couverture
(rien ne dit quelles pages ne sont pas relues ; « Garder ma version » se lit mal quand la courante est une lecture de l'assistant), décision de
produit pour Neegan (spec § 5).

**Ce qui n'est pas prouvé.** `0005` et sa preuve n'ont pas été jouées sur `mitsu` (syntaxe seulement, pglast v8.6) ; aucune extraction réelle (la
preuve § 10 de la spec : modèle, durée, fidélité, 6 000 jetons sous les 120 s du serveur) ; le 499 à « Annuler » ; deux appareils réels ; Safari et
l'iPhone (`capture`, focus, photos de 48 Mpx, HEIC, veille d'une PWA tuée puis relancée). Mesuré : la suite (3694/3694), le générateur (125/125,
`--check` 0), 152 mutants joués (149 relevés dans les rapports du registre, 3 par la re-revue de la ronde finale 2) : tous rouges sauf `hb-ignore`,
déclaré équivalent à la clôture, et **M3** (`?.blob instanceof Blob` remplacé par la seule présence de la ligne `files` dans `pagesDejaLiees`),
survivant nommé : seule une ligne `files` distante sans blob (fenêtre L2, avant R58) le tue, pratiquement inatteignable pour les pages du lot A.

## Recette web complète : l'outil `lecture-web` (19-20 octobre 2026, lot B)

Spec : `docs/superpowers/specs/2026-10-19-recette-web-design.md` (rév. 4 ; § 3 : données ; § 4 : parcours ; § 6 : serveur ; § 12 : rulings, jusqu'à la
clôture du chef d'orchestre : R-B-17 à R-B-28, puis R-B-22 bis ; § 13 : ce qui reste ouvert). Livré ici (branche `recette-web`, empilée sur
`import-cible`, non fusionnée) : un lien web gardé (un signet `reference_only` à `source_url`) devient une recette. La passerelle gagne un quatrième
outil, `lecture-web` : la fonction télécharge elle-même la page, lit d'abord son JSON-LD `Recipe` (aucun appel au modèle), sinon fait lire son texte
principal par le modèle ; le client revalide tout, écrit la lecture dans le journal du lot A (une ligne `imports` `kind: 'web'`), puis « Enregistrer »
recompose la fiche du signet. Côté serveur : un module pur neuf (`lecture-web.js`), `logique.js` et `index.ts` amendés, une migration écrite à la main
(`0006`, la contrainte `outil`) ; côté app : un domaine (`src/domain/lecture-web.js`), un écran (`src/ui/import-web.js`) et une feuille de vol
(`src/ui/vol.js`) neufs. Amendé par la vague finale de la revue de branche (`d8163be`, `ebbcf10` : veille VF-15 de l'écran web, `adresseNormalisee`
linéaire et bornée, réponse suivie refusée, `auMot`) et par la ronde finale 2 (`51bad50` : R-B-22 `portionsDe`, précisé par R-B-22 bis ; R-B-23 alias
de la fonction). La fonction déployée reste la version 3 du lot 4 : ce chemin n'est pas servi avant `0006` et le redéploiement (`index.ts` et
`lecture-web.js` ont changé jusqu'à `ebbcf10` et `51bad50`).

```text
fiche d'un lien « Lire la recette avec l’assistant » · onglet Web « Garder et lire » · « Relire la page avec l’assistant » · section « Imports »
  |
  v
demarrerLectureWeb (src/ui/import-web.js) : adresse du signet (ou du résultat) par lienSignet ET https:, sinon refus local (interdit, zéro réseau)
  | « Garder et lire » : adresse normalisée déjà gardée -> dit, rien d'écrit ; sinon UNE transaction conditionnée :
  |                      recipes (signet neuf, absente) + imports a_lancer kind web (absente ; aucun import ouvert pour ce recipe_id)
  | fiche : l'import web OUVERT de la fiche est repris (importOuvert) ; sinon même création conditionnée (TransitionRefusee -> relu, repris)
  v
lancerLecture : prendreVol (src/ui/vol.js, LE vol du document, posé avant tout await) ;
  gardes : vol tenu | inconnu | statut | hors ligne | session | signet relu hors https  -> refus, rien d'écrit
  a_lancer | echec (| a_verifier pour « Relire ») -> en_cours en UNE transition (started_at, document_id_vol, battement_at de départ, device_id d'ici)
  battement toutes les 15 s : sync_state « battement:<id> » (repo.battre, origine device ; la ligne imports ne bouge pas, R-B-17)
  appels + 1 au départ du fetch -> lireRecetteWeb : POST /functions/v1/assistant { outil: 'lecture-web', corps: { url: <source_url du signet RELU> } }
  |
  v
fonction « assistant » : OPTIONS | origine | méthode | session | is_allowed | corps borné | lireDemande : liste blanche { url }, valideAdresse
  |                      (refus -> 422 interdit AVANT la réservation : rien n'est compté)
  v   rpc assistant_reserver(owner, 'lecture-web', octets, quota)     null -> 429 ; la contrainte de 0006 admet l'outil
telechargerPage : GET, redirect 'manual', credentials 'omit', user-agent Mitsu/0.10, 15 s par saut, 30 s en tout
  |   r.redirected -> 422 interdit ; 3xx : corps annulé, location revalidée par valideAdresse, 3 sauts au plus ; hors 2xx -> 502 inaccessible ;
  |   content-type hors text/html | application/xhtml+xml -> 422 pas_une_page ; corps > 2 Mio -> 413 trop_lourde ; décodage par lireCharset
  v
lirePageHtml (lecture-web.js, pur, balayages linéaires) : blocs JSON-LD -> la première Recipe LISIBLE ?
  |-- oui : 200 { source_kind: 'jsonld', page, recette (construite), usage 0 / 0, stop_reason null, model null }     aucun appel au modèle
  |-- non : texte principal (<= 40 000 points de code, coupe dite) ; moins de 40 -> 422 vide ; sinon
  |         appelerAnthropic(corpsLectureModele : CONSIGNE_LECTURE_WEB, <<<PAGE>>> texte neutralisé <<<FIN>>>, max_tokens 6000)
  |         -> 200 { source_kind: 'modele', page, recette: <texte des blocs text>, usage, stop_reason, model }
  v   journal : statut rendu, jetons (0 / 0 pour un JSON-LD), durée ; budget de 120 s épuisé -> 504 delai ; client parti -> 499
client : lireLecture = lirePage (hôte RECALCULÉ, bornes, Cc / Cf retirés, auteur et site à adresse -> null) + validateParsedRecipe + retirerAdresses
  |  en_cours -> a_verifier (resultat { source_kind, page, recette }, reponse_brute <= 16 000, model, duree_ms)     [I-B4 : AVANT tout rendu]
  |  sinon en_cours -> echec(raison) ; « Annuler » -> echec(annule) ; réponse arrivée après : reponse_brute seule, l'état reste echec
  v
#/recipes/<id>/importer, variante web : relireResultat à chaque rendu (illisible -> echec(illisible), lié à cleLecture) ; « Lue sur {hote} — vérifie… »
  |  « Enregistrer » : signet et versions RELUS après le dialogue ; fabriquerLectureWeb ; « Remplacer par cette lecture ? » si une version ÉCRITE existe
  v
UNE transaction : imports a_verifier -> enregistre (reponse_brute null, finished_at ; liée à cleLecture)
                  + recipe_versions (extraction, provenance web) + recipes (le signet recomposé ; aucun put si « Ajouter sans remplacer »)
```

**Modules, un rôle chacun.**
```text
supabase/functions/assistant/lecture-web.js   pur, FEUILLE (aucun import ; Node et Deno) : LIMITES_LECTURE, valideAdresse, hoteAdmis, typeAdmis,
                                              lireCharset, decoderEntites, nettoyerChaineJsonLd, decouperEtape, dureeIsoEnMinutes, extraireBlocsJsonLd,
                                              trouverRecettes, auteurDe, siteDe, titreDe, recetteDepuisJsonLd ({ recette, lisible }), textePrincipal
                                              ({ texte, coupe }), lirePageHtml. Aucune fonction ne lève sur une entrée hostile.
supabase/functions/assistant/logique.js       OUTILS (quatre), lireDemande (lecture-web : { url } seul, valideAdresse, hotesRefuses),
                                              CONSIGNE_LECTURE_WEB, neutraliser, corpsLectureModele ; importe valideAdresse et LIMITES_LECTURE de
                                              lecture-web.js (un seul sens).
supabase/functions/assistant/index.ts         hotesRefuses() (hôte de SUPABASE_URL, ses sous-domaines, l'alias <ref>.functions.supabase.co),
                                              telechargerPage, appelerAnthropic (UN point d'appel pour les quatre outils), le bloc lecture-web de traiter.
supabase/migrations/0006_lecture_web.sql      écrite à la main : drop puis add constraint assistant_journal_outil_check, à cinq valeurs.
supabase/proofs/0006_lecture_web.sql          preuve (garde 0, 10 verdicts, rollback dernier) ; jamais jouée.
src/domain/lecture-web.js    lirePage, MOTIF_FRAGMENT_ADRESSE, retirerAdresses, lireLecture, relireResultat, lireRecetteWeb (l'appel, par la passerelle),
                             fabriquerImportWeb, versionHumaine, fabriquerLectureWeb (sixième fabricant à appeler assertVocabulaire).
src/ui/vol.js                feuille sans vue : DOCUMENT_ID, BATTEMENT_MS, LA variable de vol (prendreVol, libererVol, volEnCours, volTenu).
src/ui/import-web.js         demarrerLectureWeb, lancerLecture, annulerLecture, enregistrerLecture, texteEchecLecture, renderImportWeb ; ouverteWeb,
                             ligneWebOuverte ; abonnés (ecouterLecture) et veille VF-15.
src/ui/import-cible.js       prend son vol dans vol.js (ré-exports gardés) ; renderImportCible délègue une fiche à source_url à renderImportWeb (sens
                             unique : import-web.js et vol.js n'importent jamais import-cible.js) ; texteRefus dit interdit.
src/domain/import-cible.js   KINDS_IMPORT (+ web), KINDS_PAGES, importOuvert, versionEcrite, cleLecture, modeleBorne, RAISONS_ECHEC élargie, cibleReprise et
                             lignesImports pour le web.
src/core/lien.js             adresseNormalisee, doublonDAdresse, ADRESSE_MAX ; src/domain/recherche-web.js : reperesDe, porteUneAdresse, MOTIF_ADRESSE ancré.
src/domain/passerelle.js     RAISON_DE_ERREUR : interdit, inaccessible, pas_une_page, trop_lourde -> page_trop_lourde, vide -> page_vide.
src/ui/recipe.js, search.js, signet.js, components.js, add.js   la fiche d'un lien (blocSignet, bandeau web), « Garder et lire », le doublon au
                             formulaire, ligneReperes, les lignes web de la section « Imports ».
src/model/schema.js, repo.js, src/domain/vocabulaire.js   SOURCE_KINDS ; gardes KINDS_PAGES d'ouvrirImport et d'ajouterPages ; recipes.source_kind.
tests : tests/lecture-web.js (neuf) ; tools/assistant-lecture-web.test.mjs et tools/lien.test.mjs (neufs), assistant-index.test.mjs,
        assistant-logique.test.mjs, generer-migrations.test.mjs.
```

**Les murs de la fonction (D-B1, I-B8, I-B10, R-B-21, R-B-23).** Le client n'envoie que `{ url }` ; `lireDemande` ne lit aucun autre champ et refuse
AVANT la réservation (422 `interdit`, rien de compté) toute adresse que `valideAdresse` refuse : hors ASCII visible (vérifié AVANT `new URL` : un U+2028
ou un Cf ne passe jamais), plus de 2 048 points de code (le `href` normalisé aussi), autre schéma que `https:`, port explicite, identifiants, hôte sans
point, IP littérale (IPv4, y compris les formes numériques que `URL` ramène à une IPv4 ; IPv6 entre crochets), `localhost`, suffixes `.local`,
`.internal`, `.localhost`, hôte refusé et ses sous-domaines (`hotesRefuses()` : l'hôte de `SUPABASE_URL`, qui sert PostgREST et `/functions/v1`, et
l'alias `<ref>.functions.supabase.co` : la fonction ne se rappelle jamais elle-même). La réservation précède tout téléchargement : la fonction n'est
jamais un relais gratuit. À chaque saut : `redirect: 'manual'`, corps du 3xx annulé, `location` résolue contre l'adresse courante puis REVALIDÉE par les
mêmes règles (refus → 422 après réservation), trois sauts au plus ; une réponse que le runtime aurait suivie malgré tout (`r.redirected`) est refusée
sans lire son corps. Trois en-têtes posés par le code (`user-agent` qui nomme Mitsu, `accept`, `accept-language`) et `credentials: 'omit'` : jamais
`authorization`, `apikey`, `cookie`, `x-api-key` ; aucun corps d'erreur d'un site n'est relayé ni journalisé. Le mur contre un hôte public qui
résoudrait vers une adresse interne est TLS : la vérification du certificat n'est jamais relâchée (`Deno.createHttpClient` et `caCerts` absents, test de
source) ; pas d'épinglage d'IP (rebinding DNS assumé, R-B-21 ; l'absence de réseau privé des isolats est un second filet, non mesuré). Minuteries : 15 s
par saut, 30 s pour tout le téléchargement, retirées en `finally` avec leurs écouteurs ; le budget de 120 s (`ctl`) couvre la requête : son abandon
pendant le téléchargement, en-têtes ou corps, est relancé et rend 504 `delai`, jamais `inaccessible` (D-B26).

**La page (D-B2, D-B12, D-B20, D-B25).** Décodage par `lireCharset` (`charset` du `content-type`, sinon `<meta charset>` ou `http-equiv` dans les 4 096
premiers octets, sinon UTF-8 ; un label que `TextDecoder` refuse vaut UTF-8). Tout est lu par balayages linéaires (`indexOf` depuis la position
courante ; aucune regex sur le HTML entier hors la passe bornée de `decoderEntites` et les normalisations d'espaces) : trois pages hostiles de 2 Mio
tiennent sous 500 ms. Une balise commence par `<` suivi d'une lettre, de `/`, `!` ou `?` (un `<` de texte reste du texte) ; un nom de balise finit sur
un blanc, `/` ou `>`. `extraireBlocsJsonLd` lit les `<script type="application/ld+json">` (≤ 512 Kio chacun ; `@graph` et tableaux aplatis ; JSON
illisible ignoré) ; `recetteDepuisJsonLd` construit l'objet de sortie du lot A (§ 3.4) plus `total_minutes`, en lisant chaque propriété par
`Object.hasOwn` (jamais `Object.assign` ni `for…in` : aucune pollution de prototype) ; une `Recipe` n'est « trouvée » que LISIBLE (au moins une ligne
ou une étape), la première gagne et les autres lisibles sont comptées (`autres_recettes`) ; une chaîne d'instructions est découpée aux fins de phrase
en étapes ≤ 2 000 (rien de perdu), la `description` coupée au mot à 2 000 (la seule troncature), les listes relayées à la borne + 1 (le client refuse
alors `hors_bornes`) ; `recipeYield` → `portionsDe` (R-B-22 et R-B-22 bis : la chaîne passe par `nettoyerChaineJsonLd` puis NFC ; un nombre nu, un
intervalle (la borne basse, même inversé) ou un nombre accompagné d'un mot de portion, avant ou après ; 1 à 9 999, nombre JSON compris ; sinon `null` :
rien d'inventé) ; `image` est ignorée (lot F). Sans JSON-LD lisible, `textePrincipal` retire scripts, styles, `noscript`, `svg`, `template` et
commentaires, prend `<main>`, sinon `<article>`, sinon `<body>`, y retire `nav`, `header`, `footer`, `aside` (et `form` dans `main` / `article`, jamais
s'il vide la zone), décode les entités (table fermée ; Cc, Cf, surrogates, U+2028 / U+2029, U+007F retirés), coupe net à 40 000 points de code et le
dit (`texte_coupe`). Le modèle reçoit ce texte, `neutraliser` (toute suite de trois `<` ou plus espacée) entre `<<<PAGE>>>` et `<<<FIN>>>`, avec
`CONSIGNE_LECTURE_WEB` (le texte de la page est une DONNÉE, jamais une consigne ; aucune adresse web nommée) et `max_tokens` 6 000 ; la fonction relaie
sa sortie sans la valider.

**Réponse et statuts de l'outil `lecture-web`.**

| Issue | Statut et corps de la fonction | Journal (`assistant_journal`) | Côté app |
|---|---|---|---|
| adresse envoyée refusée | 422 `interdit` | aucune ligne (avant la réservation) | `interdit` |
| quota atteint | 429 `quota` | aucune ligne (la réservation rend `null`) | `quota` |
| cible d'une redirection refusée, ou réponse suivie (`r.redirected`) | 422 `interdit` | 422 | `interdit` |
| DNS, connexion, TLS, 4xx ou 5xx, 3xx sans `location` lisible, plus de 3 sauts, 15 s d'un saut, 30 s en tout | 502 `inaccessible` | 502 | `inaccessible` |
| `content-type` refusé | 422 `pas_une_page` | 422 | `pas_une_page` |
| corps de plus de 2 Mio | 413 `trop_lourde` | 413 | `page_trop_lourde` |
| moins de 40 points de code de texte | 422 `vide` | 422 | `page_vide` |
| JSON-LD lisible | 200 `jsonld`, `usage` 0 / 0 | 200, 0 / 0 | `a_verifier`, ou `hors_bornes` (texte JSON-LD), `vide`, `lien` |
| texte lu par le modèle | 200 `modele`, `usage` d'Anthropic | 200, jetons | `a_verifier`, ou `coupe`, `illisible`, `hors_bornes`, `vide`, `lien` |
| 400, 403, 413, 429 d'Anthropic | relayés tels quels (comme le lot 4) | statut relayé | comme le lot 4 |
| budget de 120 s épuisé | 504 `delai` | 504 | `delai` |
| client parti | 499, aucun corps | 499 | — |

**Relecture côté client (I-B2, I-B5).** La réponse est une donnée hostile. `lirePage` relit chaque champ de `page` par `borner` (Cc / Cf retirés,
borné) ; l'hôte est RECALCULÉ par `lienSignet(url_finale)`, jamais celui du serveur, et toujours affiché en premier ; `auteur` et `site` passent à `null`
s'ils portent une adresse et ne s'affichent qu'après, sous « Selon la page : … » ; `lue_le` n'est admise qu'en ISO UTC ; `titre_page` n'est jamais
rendue. La recette passe `validateParsedRecipe` (un dépassement REFUSE, `hors_bornes`, jamais de troncature silencieuse), puis `retirerAdresses` : une
adresse (`MOTIF_ADRESSE` sur le texte NFKC, jamais `MOTIF_HOTE`) dans le TITRE refuse (`lien`) ; dans une ligne, une étape ou les notes, le fragment
devient « [adresse retirée] » dans le texte d'origine, la ligne passe `uncertain` et `uncertain_fields` reçoit une entrée par champ (motifs ancrés par
lookbehind : linéaires). `total_minutes` ne vient que d'un JSON-LD ; `printed_page` et `missing_page` sont forcés. Un `resultat` relu du journal (rendu,
synchro, archive, « Reprendre ») repasse par `relireResultat` avant tout usage, et la fiche passe sa recette relue à la bannière du lot A. Tout texte lu
est rendu en nœud texte.

**La migration `0006`.** Le `check` de colonne de `public.assistant_journal` (`0004`) ne connaissait que trois outils : sans `0006`,
`assistant_reserver('lecture-web')` échoue en 23514 et chaque lecture web répond 502 `serveur`, sans rien casser d'autre. `0006` (écrite à la main,
hors `NOMS` du générateur et de `--check`, comme `0004` ; 4 instructions, `begin` et `commit` compris : deux `alter table` entre eux) remplace
`assistant_journal_outil_check` par une liste à CINQ valeurs, dans l'ordre `'recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'` :
la cinquième sert le lot F, qui n'écrira aucune migration ; `OUTILS` en porte CINQ depuis le lot F (`OUTILS` = `OUTILS_0006`, R-F-9 ; jusqu’au lot E,
quatre : le test croisé affirmait
`OUTILS_0006.slice(0, 4)`, une valeur admise de plus dans un `check` étant inoffensive tant qu’`OUTILS` ne la portait pas). Ni table, ni fonction, ni
privilège : la vue,
`assistant_reserver` et les `revoke` de `0004` tiennent. La preuve (`rollback;` dernier, rien à remplacer) : garde 0 (table et contrainte présentes,
sinon les `check` réels nommés) ; 1.01 les cinq outils dans l'ordre, 1.02 une seule contrainte `check`, 1.03 et 1.04 privilèges inchangés, 1.05 la vue
`security_invoker` ; 2.01 à 2.031 sous `postgres`, avec un compte emprunté : 2.01 `lecture-web` accepté et 2.02 `'inconnu'` → 23514 (inserts datés du
2000-01-01), 2.03 `assistant_reserver` accepte `lecture-web` puis 2.031 `image-web` (sur le jour UTC courant : `c` compté sur `(now() at time zone
'utc')::date`, recompté avant 2.031), chaque appel dans un bloc `exception` ; 3.01 les trois anciens outils (inserts datés du 2000-01-01) ; tout est
annulé par le `rollback` ; `999 BILAN` (attendu `0 faux sur 10`). Le générateur dit « la 0007 à venir » : le prochain lot qui ajoute un magasin
synchronisé la génère, après avoir figé `0005`.

**La ligne `imports` `kind: 'web'` et le vol partagé.** `fabriquerImportWeb` naît `a_lancer`, `recipe_id` = le signet, `edition_id`, `scan_session_id`,
`photo_sha256` nuls, `page_ids: []`, `device_id` de cet appareil (exigé) ; `resultat` = `{ source_kind, page, recette }`, `reponse_brute` (texte du
modèle, ou la recette JSON-LD reçue) ≤ 16 000 points de code et effacée à `enregistre`. `KINDS_IMPORT = ['recette', 'index', 'web']` (les sortes que
la section liste et qu'`importOuvert` reconnaît) ; `KINDS_PAGES = ['recette', 'index']` (les sortes à pages) : `repo.ouvrirImport` et `repo.ajouterPages`
refusent une ligne web (`TypeError`, rien d'écrit). Une seule définition d'« ouvert » (`importOuvert`, R-B-18) ; le mur de création reste celui du lot A
(`absente` + index `recipe_id` sans statut ouvert), aveugle à la sorte : un import ouvert d'une autre sorte rend le refus nommé `transition`. `vol.js`
porte LA variable de vol du document : `prendreVol` avant tout `await`, `libererVol` ne libère que sa tenue ; un vol web refuse une extraction photo et
l'inverse ; « Annuler » n'est offert que par le document qui tient le vol (`volTenu`). Le départ est UNE transition (`a_lancer | echec`, plus
`a_verifier` pour « Relire », liée à `cleLecture`) qui pose `en_cours`, efface l'ancien diagnostic et réécrit `device_id` : une ligne venue d'un autre
appareil devient celle d'ici (R-B-8) : l'appareil d'origine la juge alors à 10 min (`VOL_MORT_MS`), plus sur 90 s d'un battement qu'il ne voit pas.
`lignesImports` : « {titre} — Lien web · {hôte} » ;
« Réessayer » (`relancer`) offert aussi pour une ligne d'un autre appareil et sans page ; une fiche `available` garde ses gestes (la relecture la vise) ;
`cibleReprise` → `/recipes/<recipe_id>/importer?import=<id>` (R-B-20).

**Frontière avec le lot A.** B est un client du journal d'A, sans champ neuf ni statut neuf : mêmes `TRANSITIONS`, même porte (`repo.transitionner`,
`db.mutate({ conditions })`), même battement interne (`battement:<id>` de `sync_state`, R-B-17), même passe `interrompu` (au démarrage, à l'affichage
de la section, et, depuis la vague, à l'affichage de l'écran web puis toutes les `BATTEMENT_MORT_MS` + 1 s tant que la ligne vole ailleurs), même
purge à 30 jours. L'écran ciblé d'A (`#/recipes/<id>/importer`) délègue toute fiche à `source_url` à la variante web, en sens unique ; son vol vient
de `vol.js` (`DOCUMENT_ID`, `BATTEMENT_MS` et `volEnCours` ré-exportés ; `reinitialiserImportCible` y reste locale et appelle `reinitialiserVol`). Les
versions : « Enregistrer » fabrique une version `extraction` (`generated_by: 'ai'`, provenance web : `source_url`, `url_finale`, `source_kind`,
`lue_le`, `lu_le`, `auteur`, `site`, `titre_lu`, `titre_signet`, `uncertain_fields`), et la question I-5 ne se pose que devant une version ÉCRITE au
sens de `versionEcrite` (R-B-19, la même définition que `fabriquerExtraction`) ; la bannière du lot A s'applique telle quelle à cette version, après
le bandeau web. Deux compteurs, comme au lot A : `imports.appels` (les départs de la ligne) et `public.assistant_usage_jour` (le quota du serveur :
chaque lecture admise compte, même lue dans le JSON-LD).

**Ce qui est absent.** Image du plat et `og:image` (lot F, qui emploiera `image-web`) ; PDF, EPUB, pages derrière une connexion ; pages rendues par
JavaScript (`page_vide`) ; plusieurs recettes d'une page (la première lisible) ; `recipeCuisine`, `keywords`, `nutrition` ; épinglage d'IP ; `deno-dom` ;
repères portés par « Garder ce lien » ; une écoute `online` / `offline` sur la fiche ; la garde d'identité du vol aux écritures de fin (les deux machines,
A et B, R-B-27) ; une fin de vol commune (`lancerLecture` recopie `volUnique`) ; la notification croisée des deux écrans quand un vol de l'autre sorte
commence ou finit.

**Ce qui n'est pas prouvé.** `0006` et sa preuve n'ont pas été jouées sur `mitsu` (syntaxe seulement, pglast v8.6) ; la fonction n'est pas redéployée :
`redirect: 'manual'` sous le runtime Supabase (S17), `credentials: 'omit'` sous Deno, le mur TLS et l'absence de réseau privé des isolats ne sont pas
mesurés ; aucune lecture réelle (JSON-LD d'un vrai site, durée, jetons et coût d'une lecture par le modèle, charset réel) ; le 499 à « Annuler » (sous
Node seulement) ; deux appareils réels ; Safari et l'iPhone (dont le coût des motifs sous JavaScriptCore : Chrome masque un retour arrière par son
moteur linéaire de repli, la durée n'est affirmée que sous Node). Mesuré : la suite navigateur, Node (172/172 sur `51bad50`), `--check` 0, `tsc` 0, tous
les mutants nommés par la spec § 7.5 et par le plan (C1 à C24, B1 à B8, T6a à T6j) rouges, deux équivalents déclarés, aucun survivant (R-B-28).

## Les photos voyagent entre appareils : les octets des fichiers (20 octobre 2026, lot G)

Spec : `docs/superpowers/specs/2026-10-19-photos-entre-appareils-design.md` (rév. 4 ; § 3 : données ; § 4 : parcours ; § 7 : tests ; § 11 : limites ;
§ 12 : rulings R-G-1 à R-G-32 ; § 13 : dettes). Livré ici (branche `photos-entre-appareils`, empilée sur `recette-web`, non fusionnée) : le niveau
L4 de la synchronisation — les OCTETS des fichiers (pages photographiées, couvertures, photos de plat) suivent le compte par le Storage de `mitsu`,
sans migration ni changement de la fonction `assistant`.

**Modules, un rôle chacun.**
```text
src/sync/tables.js       CHAMPS_FILES_SERVEUR, projectionFichier (une ligne files vue du serveur : sans blob, syncable, created_at),
                         remoteValide (remote objet borné : sha256, size, mime, quality, uploaded_at, owner), HASH_FICHIER
src/sync/fichiers.js     estOriginalIci, copiePerimee, telechargerUn (une copie reçue ne prend jamais la taille de l'original, R-G-31), candidatsEnvoi (D-G8), fusionnerFichier (D-G16, une règle), conditionFichier
                         ({ key, fusion } : la fusion refaite sur la ligne relue en transaction, I-G3), memeRemote (F-7), peutEcrireRemote,
                         peutEcrireOctets, octetsAEnvoyer (réduite ou telle quelle), createFichiers (envoyer, telecharger, telechargerTout,
                         reessayerFichier ; erreurs file_error:<sha>, pause_fichiers, renvoi_originale), nomFichier, referencesFichiers,
                         lireErreursFichiers, LIMITES_FICHIERS
src/sync/mime.js         typeAffichage, displayUrl, safeDisplayType (F-9 : le type du blob, dans la liste blanche, gagne)
src/sync/outbox.js       capture L4 : une ligne files n'entre en file qu'avec un remote valide de ce compte ; jamais une suppression
src/sync/pull.js         réception files par conditionFichier ; tombale files = remote null (D-G15) ; F-7 : file_error de réception levée
src/sync/push.js         reecrire.files refondu dans la transaction (conditions) ; reponses.js : conflit files = retrait sans journal (R-G-24)
src/sync/conflits.js     garderIci (jamais de suppression de files), garderAilleurs (fusion)
src/sync/moteur.js       phase « fichiers » après la réception, un snapshot par passe, vols tenus par arreter, gestes de fichiers
src/sync/clock.js        reculMs (recul des erreurs passagères ; réexporté par push.js)
src/core/db.js           db.mutate({ conditions: { files: [{ key, fusion }] } }) : relire et réécrire dans la même transaction (R-G-17)
src/domain/backup.js     archive : missing_files, copies décrites par bytes_* (jamais la taille de l'original, R-G-25), decisionRestauration (R-G-6),
                         decisionManquante (R-G-19), verifyRestored ; upload_quality hors archive (R-G-27)
src/ui/components.js     bookCover, pdfFrame (état du fichier : Télécharger, Réessayer, phrase), contexteFichiers, MOTIFS_FICHIER / motifFichier
src/ui/settings.js       section Synchronisation L4 (photos à envoyer, pages à télécharger, espace, qualité par appareil, fichiers refusés nommés),
                         effacerDonnees (la perte des photos non envoyées est dite, R-G-28)
src/ui/book.js, import-cible.js (poserImage), recipe.js (photoDuPlat)   écrans : couverture, vignettes, photo du plat, téléchargement sur une tape
tests/sync-l4.js         la suite du lot (runSyncL4Tests, après runLectureWebTests) ; tests/stockage-factice.js : Storage factice
```

**Flux.** Une photo prise ici → ligne `files` avec blob (original, `syncable`) → si une fiche la référence, la passe fichiers l'envoie (réduite ou
telle quelle), vérifie « déjà présent », pose `remote` (fait, jamais réglage) sur la ligne relue ; la ligne, désormais à remote de ce compte, entre en
file et part comme fiche (projection). Ailleurs : la fiche arrive sans octets, la ligne porte `remote` ; l'écran dit « Télécharger » (ou tout d'un coup
depuis Réglages) ; la descente écrit les octets retypés `remote.mime` sur la ligne relue, l'affichage suit F-9. Un original importé ici par-dessus une
copie n'est pas remplacé par la copie ; une copie reçue n'efface jamais un original (I-G3). Conflit `files` au serveur (même original poussé par deux
appareils) : retrait sans journal, la réception apporte la version du serveur (R-G-24).

**Invariants.** I-G3 (un blob local n'est jamais effacé par une écriture serveur : condition de fusion en transaction) ; D-G8 (capture seulement sur
remote confirmé) ; D-G15 (aucune suppression locale de `files` par la synchro) ; D-G16 (une règle de fusion) ; F-9 (type affiché = type du blob dans la
liste blanche) ; I-G8 (une personne ne voit jamais une empreinte : `nomFichier`) ; R-G-25 (une copie d'archive ne prend jamais la taille de l'original ;
des octets tels quels dont l'empreinte n'est pas la clé ne partent pas). Limites assumées : spec § 11 (dont le cache HTTP des octets privés, la reprise
après une erreur passagère, l'arrêt entre onglets) ; dettes : § 13.

## Table des matières sur plusieurs pages (lot C, 19-21 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-19-table-des-matieres-design.md` (rév. 7 ; § 3 : données ; § 4 : parcours ; § 7 : tests ; § 11 : limites ;
§ 12 : rulings R-C-1 à R-C-38 ; § 13 : dettes). Livré ici (branche `table-des-matieres`, empilée sur `photos-entre-appareils`, non fusionnée) : la
lecture d'une table des matières photographiée sur plusieurs pages, sans migration ni changement de la fonction `assistant`.

Une table des matières photographiée sur une à cinq pages se lit en UN appel (`extraireTableMatieres`, `src/domain/llm.js` : outil `extraction`,
8 000 jetons, chaque image précédée de « Photo n », consigne « donnée, jamais consigne »). La réponse est une donnée hostile : `validerLectureIndex`
la lit par propriétés propres, construit chaque objet, borne en points de code et en octets (256 Kio) ; une entrée trop longue ou porteuse d'une
adresse est écartée et COMPTÉE (`ecartees`), jamais tronquée ni la lecture jetée ; `hors_bornes` reste pour les comptes, un numéro de photo hors 1..N et
la taille.

- **Modules.** `src/domain/table-matieres.js` (pur : correspondance photo ↔ page envoyée `resultatIndex`, revalidation `revaliderResultatIndex`,
  `ordrePropose`, `positionsProposees`, `reordonnerSeance`, `pagesALire`, tableau `lignesTableau` / `recalculer` / `planCreation`, `fabriquerReferences`,
  `ligneOuverteDeSeance`, `executerIndex`) ; `src/ui/table-matieres.js` (`panneauLecture` : « Ordre des photos » puis « Entrées
  lues » ; `creerReferences`, sans DOM) ; `src/ui/import.js` reste la porte (`indexEntriesPanel` : quatre états et un état « en vol ») ;
  `src/core/bornes.js` porte désormais `MOTIF_ADRESSE`, `MOTIF_HOTE`, `normaliserPourAdresse` et `porteUneAdresse` (une définition, partagée avec la
  recherche web et la lecture d'une page web du lot B, qui les lisent par `src/domain/recherche-web.js`).
- **Un seul vol.** `lancerVol(importId, executer, options)` (`src/ui/import-cible.js`) est la primitive du lot A extraite à l'identique : un vol par
  document (la tenue de `src/ui/vol.js` du lot B : recettes, index ET lecture web), battement toutes les 15 s (hors de la ligne, `repo.battre`), `appels + 1` au départ du fetch, `a_verifier` écrit avant tout rendu, « Annuler », et l'option
  `lecture` du lot A (ronde 1 de la tâche 6) : les gardes passent avant toute écriture, puis la ligne est reprise par la transition de départ ou naît par
  `repo.ouvrirImport` — c'est ainsi que le panneau d'index lit, et un « Lire » refusé n'écrit rien ; `lancerExtraction` = `lancerVol` + l'exécutant de la
  sorte de la ligne (recette ou `executerIndex`).
- **Journal.** La lecture vit dans `imports{kind:'index'}.resultat` sous la forme `{ photos: [{ page_id, printed_page_range, entries }], ecartees,
  uncertain }`, relue par `relireDuJournal` (forme C par `VALIDEURS.index`) ; `ordre_applique_at` dit qu'un ordre a été appliqué (effacé, avec le diagnostic de la
  lecture remplacée, au départ de toute lecture d'index). Un geste ne vaut que pour la lecture montrée (`cleLecture`, revérifiée dans la transaction). Aucun magasin neuf, aucun index neuf,
  `DB_VERSION` inchangée.
- **`repo.transitionner(…, { conditions })`.** D'autres fiches vérifiées et patchées dans la MÊME transaction que la ligne : « Appliquer cet ordre »
  écrit la ligne (`page_ids`, `ordre_applique_at`), les positions et la séance (patch-fonction relu dans la transaction) en une fois, sans `refresh()` ;
  l'écran de séance suit par `reordonnerVignettes`.
- **Champs neufs (données JSON).** `recipes` : `index_page_id` (pointeur souple, hors `RELATIONS`), `raw_entry`, `index_uncertain` ; `section` enfin
  rempli, et lu par `sectionLisible` (`src/domain/llm.js` : ramenée à une ligne (`uneLigne`), nettoyée, bornée à 200 points de code comme à la fabrication) sur la fiche livre, la fiche
  référence et dans la recherche. `source_pages` : `printed_page_range` (pages CITÉES), `role: 'index'` ; `kind` posé seulement s'il est nul ; `printed_page` jamais écrit par C.
- **Ce qui n'est pas mesuré.** Une vraie lecture de 3 à 5 photos (durée, coupe, fidélité, jetons) : preuve § 10 de la spec, geste de Neegan après la fusion de C et son `push`, avant la fusion de D (R-C-33) ; depuis la section « Imports », un index en échec se reprend au panneau (« Reprendre »), il n'y est plus relancé (VF-C3).

## Un lot de recettes photographiées (lot D, 19-22 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-19-recettes-en-lot-design.md` (rév. 5 ; § 3 : données ; § 4 : parcours ; § 7 : tests ; § 11 : limites ;
§ 12 : rulings R-D-1 à R-D-28 ; § 13 : ce qui reste). Livré ici (branche `recettes-en-lot`, empilée sur `table-des-matieres`, non fusionnée) : le
classement d’un lot de photos de recettes en un appel, leur lecture une à une, l’appariement aux références, sans migration ni changement de la
fonction `assistant`.

Plusieurs recettes photographiées dans une séance se classent en UN appel (`classerPhotos`, `src/domain/llm.js` : outil `extraction`, 2 000 jetons,
2 à 10 photos comptées avant tout décodage, chaque image précédée de « Photo n », consigne « donnée, jamais consigne »). La réponse est une donnée
hostile : `validerClassement` la lit par propriétés propres et construit chaque objet ; un numéro mal formé → `illisible`, hors 1..N ou répété →
`hors_bornes` ; une photo nommée par deux groupes reste dans celui qui l'a en tête, sinon dans le premier, et entre dans `partagees` (D-D21, R-D-7) ;
un titre trop long ou porteur d'une adresse devient nul et le groupe incertain — un classement payé n'est jamais jeté pour un titre. Une seule règle
des titres (`estTitreUneLigne`, `src/core/bornes.js`) juge la validation, la revalidation et le champ `lot` ; la validation ramène d'abord le texte
à une ligne par `uneLigne` (lot C : fins de ligne repliées AVANT le nettoyage) puis `plierUneLigne`.

- **Modules.** `src/domain/classement.js` (pur : `resultatClassement` — correspondance sur les pages ENVOYÉES —, `revaliderResultatClassement`,
  `cleClassement`, l'état de regroupement `regroupementInitial` / `deplacerVers` / `bougerDansGroupe` / `retirerDuGroupe`, le brouillon `brouillonDe` /
  `restaurerBrouillon`, l'appariement `candidatsReference` / `referencesOccupees` / `concordance` / `proposerAppariements` / `filtrerReferences`, le plan
  `lecturesDuLot`, `referenceALire`, `progressionLots`, `blocsImports`, `suiteDuLot`, `pagesEnCours`) ; `src/ui/regroupement.js` (`panneauClassement` — cinq états —,
  `executerClassement`, `texteEchecClassement`, `selecteurReferences`, `creerLesLectures` et `rattacherLecture` sans DOM, `lireLeLot`, `lotEnCours`,
  `noteLotsDeSeance`, `blocApparierLecture`) ; monté par `sessionView` (`renderImport` à quatre paramètres) et par l'éditeur ; il n'importe jamais
  `import.js` ni `recipe-edit.js`.
- **Journal.** `imports{kind:'classement'}` : `resultat` = `{ groupes: [{ page_ids, title, printed_page, uncertain }], orphelines, non_classees, partagees,
  uncertain }` ; `brouillon` = les groupes de la personne (`{ cle: started_at, groupes: [{ cle, page_ids }], a_part, choix, prochain }`, aucun texte),
  relu comme une donnée hostile ; la clé du classement rendu (`cleClassement`) garde chaque geste jusque dans la transaction. Une ligne `recette` d'un
  lot porte `lot: { classement_id, rang, total, titre, page }` (revalidé par `lotDe`). `SORTES_IMPORT` (`src/model/schema.js`) ferme `imports.kind` ;
  `ligneImportNeuve` (`src/domain/import-cible.js`) est la seule fabrique d'une ligne neuve. Aucun magasin ni index neuf, `DB_VERSION` inchangée.
- **Le vol.** `lancerVol(importId, executer, { …, attendus, accepte })` : `accepte` est une liste BLANCHE de sortes évaluée après la relecture et avant
  toute écriture (`lancerExtraction` : `SORTES_EXTRACTION`) ; `attendus` = les statuts de départ admis. Un lot se lit une recette à la fois (`lireLeLot`
  passe `['a_lancer']` : une ligne passée `echec` ailleurs est refusée avant tout POST ; un lot par document ; prise et libération dites sur le bus) ;
  `suiteDuLot` décide, défaut FERMÉ (coupe, illisible, hors_bornes, vide et le 413 laissent continuer ; les refus de `REFUS_SAUT_LOT` — inconnu,
  transition, sans_page, image, octets_absents, sorte — sautent le groupe ; tout autre échec ou refus arrête).
- **« Lire ces recettes ».** `creerLesLectures` : toutes les relectures avant (clé, livre de la séance, références candidates, photos prises ailleurs,
  octets), puis UNE transaction — le classement `enregistre` (clé rejouée dedans), les lignes neuves (`absente`) et une condition d'index par référence
  cochée (I-2).
- **Enregistrer une lecture issue d'une séance (N-1).** `issueDUneSeance` ; `fabriquerExtraction(…, { reecrirePositions })` garde les positions de la
  séance, pose `role: 'recette'` et retire `reference.index_page_id` des pages lues et de l'union ; la séance entre dans la transaction par le sac `conditions` et ne passe
  `done` que quand plus aucune de ses photos n'est sans rôle (`statutSeanceApres`). L'écran ciblé offre « En faire une nouvelle recette » sur toute
  discordance ; l'éditeur porte notes, incertitudes et limites de la lecture et propose une référence (`blocApparierLecture` → `rattacherLecture`).
- **`repo.transitionner(…, { conditions })`** (sac de C, précisé par D-D17) : sur le magasin de la ligne, le sac n'admet que les formes `absente` et
  `index` (toute autre forme y reste refusée, garde du lot C), passées telles quelles APRÈS la condition de la ligne.
- **Vague finale (revue de branche).** `restaurerBrouillon` n'exige la couverture que des pages du résultat présentes ici (un brouillon écrit après
  « Retirer » d'une photo classée se restaure ; une orpheline revenue va à part) ; `revaliderResultatClassement` refuse plus de 10 `page_ids` ;
  `classer()` lie le vol aux pages comptées (`accepte` compare `page_ids`) ; le panneau rejoue la passe `interrompu` (`repo.marquerInterrompus`) sur
  un classement en vol ailleurs, à l'affichage puis toutes les `BATTEMENT_MORT_MS` + 1 s, et, tant qu'une photo manque, revérifie les octets à
  chaque état du moteur (`ctx.sync.moteur.onEtat`) ; `regrouperPermis` retire « Regrouper en recette » pour une photo d'une lecture de recette
  ouverte de la séance ; « Ignorer » d'un classement reçu, répondu non, redessine la section « Imports ».
- **Ce qui n'est pas mesuré.** Un vrai classement (durée, justesse des groupes, borne réelle d'un envoi de 10 photos, page partagée) : sonde de Neegan
  avant la fusion (R-D-8) ; la lecture réelle de cinq recettes : preuve § 10 de la spec.

## Un livre reconnu depuis sa couverture (lot E, 19-23 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-19-couverture-lue-design.md` (rév. 7 ; § 0 : décisions D-E1 à D-E23 ; § 2 : invariants I-E1 à I-E10 ; § 3 :
données ; § 4 : parcours ; § 7 : tests ; § 11 : limites ; § 12 : rulings R-E-1 à R-E-39 ; § 13 : ce qui reste). Livré ici (branche `couverture-lue`,
empilée sur `recettes-en-lot`, non fusionnée) : la lecture d'une couverture par l'assistant au pas 1 d'« Ajouter un livre », le rattrapage Open Library,
la suppression d'un livre vide sans orphelin et le filet de l'archive, sans migration ni changement de la fonction `assistant`.

- **Domaine pur** `src/domain/couverture.js` : la ligne du journal (`fabriquerImportCouverture` = `ligneImportNeuve({ kind: 'couverture' })` +
  `cover_sha256`, R-E-21), la correspondance titre / auteur (`titreCorrespond`, normalisation), l'ISBN d'une œuvre à une seule édition
  (`editionUnique`, `isbnUnique`), les champs depuis une lecture (`champsDepuisLecture`, `uncertain` honoré), `URL_OL_TITRE_AUTEUR` et `lireSearchListe`
  (exportées). La lecture et sa validation vivent dans `src/domain/llm.js` (`COUVERTURE_SYSTEM`, `extraireCouverture`, `validerLectureCouverture` :
  propriétés propres, bornes en points de code, `ligneNettoyee` = `surUneLigne`, R-E-22 ; aucune adresse).
- **Le vol** est la primitive partagée `lancerVol` (`src/ui/import-cible.js`, lot C, étendue par D) sur `volUnique` (`src/ui/vol.js`, lot B) : E lui
  ajoute l'option `preparer({ ligne, repo })` (une couverture n'a jamais de page ; sans elle, le chemin des pages est inchangé) ;
`lancerLectureCouverture
  = lancerVol(id, executerCouverture, { accepte, preparer, attendus: ['a_lancer', 'echec'], lecture: null })` ; un seul vol par document, verrou
réciproque
  avec l'import ciblé, l'index, le classement et la lecture web (R-E-23). Le battement vit dans `sync_state` (`repo.battre`), jamais dans la ligne.
- **L'écran** `src/ui/livre-ajout.js` : pas 1 (photo posée dans `files` AVANT toute ligne et tout appel, I-E2), pas 2 pré-rempli et étiqueté,
  `relire()` / `appliquerLecture()` idempotentes (générations : un geste de la personne gagne, I-E4), bandeau Open Library posé par `majProposition()`
  (jamais par `dessiner()` : la saisie et le focus survivent), « Ajouter ce livre » qui ferme l'import dans la transaction du livre, reprise par
  `#/add/livre?import=` (`src/ui/state.js`, `ROUTES_DE_SAISIE`).
- **Données et suppression** : `repo.removeBatch` (une transaction, plusieurs magasins, R-E-12), `supprimerLivreVide` (`src/ui/book.js` : refus pendant
  `en_cours`, aucun orphelin : lignes du journal détachées, activité et préférence retirées avec l'édition, R-E-8) ; `createArchive`
(`src/domain/backup.js`)
  écarte les traces de consultation orphelines et les compte (`tracesOrphelines`), dites par `messagesArchive` (lot G, R-E-26).
- **Section Imports** (`src/ui/add.js`, `src/domain/import-cible.js`) : `KINDS_IMPORT` + `'couverture'` (jamais de page : `KINDS_PAGES` inchangée, les
  murs
  de `repo.js` refusent une page sur une couverture) ; phrases propres (« La couverture n’a pas encore été lue. », « Lecture de la couverture par
  l’assistant… », `texteEchecCouverture`) ; une couverture `a_lancer` d'un autre appareil n'offre que « Ignorer » (R-E-19).
- **Vague finale et ronde de clôture (22-23 octobre)** : `saisirMain` (« aucun ISBN avant comme après » = le même ISBN ; provenance `couverture`),
  `identifier` (remise d'une lecture appliquée dans la seule branche `trouve` ; champs repris d'Open Library gardés sur introuvable ou panne),
  `rendreFin()` (blocs seuls après un geste), `majZoneCouverture`, `online` ignoré pendant le vol, `relecturesFaites` (fait pour les tests),
  `avancerCouverture` (un geste de la seule zone Couverture ne détache pas la lecture), `volAilleurs` (un vol hors journal compte), `ici` de
  `volUnique` couvre `couverture` (R-E-30 (e)) ; `lotDe` lit `BORNES_CLASSEMENT`, `surUneLigne` privée. Ronde de clôture : `garderDistants` dans
  `identifier`, `messages.introuvable` / `texteAucune()` dans le modèle du pas 2.

## Les plats en images (lot F, 19-23 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-19-plats-en-images-design.md` (rév. 4 ; § 0 : décisions D-F1 à D-F19 ; § 2 : invariants I-F1 à I-F11 ; § 3 :
données ; § 4 : parcours ; § 6 : serveur ; § 7 : tests ; § 11 : limites ; § 12 : rulings R-F-1 à R-F-29 ; § 13 : ce qui reste). Livré ici (branche
`plats-en-images`, empilée sur `couverture-lue`, non fusionnée) : la photo du plat sur la fiche et dans les listes, son rapatriement depuis la page web
par la fonction, sans migration ; la fonction `assistant` gagne un cinquième outil et doit être redéployée.

- **Données.** `recipes.photo_sha256` : pointeur souple vers `files` (comme `cover_sha256` : la fiche vit sans ses octets, l'état « fichier absent » et
  « Télécharger » du lot G s'appliquent) ; `recipes.photo_origin` (`PHOTO_ORIGINS` : la personne, la page web, `null` sinon) ; `photo_source_url` : la
  provenance ou le rapatriement attendu, jamais rendu tel quel ; `HASH` (`src/model/schema.js`). Toute écriture relit la fiche (I-F1) ; les écrivains de
  `recipes` sont recensés (D-F16, `recensement-D-F16.md`) : ★ Favori et « Corriger » relisent avant d'écrire.
- **Serveur** (`supabase/functions/assistant/`, outil `image-web`, cinquième et dernier outil de `OUTILS` = `OUTILS_0006`, R-F-9) : télécharge l'image
  de la page (`https` seul, hôtes refusés et alias comme `lecture-web`, UNE boucle de redirections partagée — `suivreRedirections`, garde
  `r.redirected`, `ctlSaut` —, corps borné à 2 Mio, type lu dans la signature des octets, jamais le modèle : zéro jeton, un appel du quota), rend
  `{ octets (base64), type, taille }` ou un 422 nommé (`pas_une_image`, `trop_lourde`, `inaccessible`, `interdit`).
- **Domaine client** : `src/domain/photo-web.js` (adresse d'image depuis le JSON-LD ou `og:image` de la lecture web, `originePhotoAdmise`, mur distant),
  `src/domain/base64.js` (décodage borné), `lireImageWeb` (un appel, un `putFile` après relecture de la fiche, jamais par-dessus une photo choisie).
- **Écrans** : `src/ui/photo-plat.js` (zone « Photo du plat » = `renderZoneCouverture` de `src/ui/components.js`, déplacée là pour éviter le premier
  cycle
  d'imports, R-F-12 ; figure de tête `figurePhotoPlat` avec la garde `safeDisplayType` de G ; « Récupération… », « Image de la page {site} », échec en
  une ligne, « Réessayer » avec son coût, « Ne pas récupérer ») ; cartes (`vignettePlat` 72 px, `recipeCard`, repas ; URL de blob révoquées au
  redessin) ; `import-web.js` (annonce des deux appels, rapatriement déclenché sur `fiche.signet.id`).
- **Vague finale (R-F-21)** : `dimensionsImage` (`src/core/image.js`) lit l'en-tête JPEG comme libjpeg (FF de remplissage sauté ; `FF 00`, EOI ou SOS
  avant le SOF → illisible → image distante refusée sans décodage) ; `TYPE_JSONLD` linéaire ; `imageUrlDe` valide chaque candidat tour à tour (JSON-LD
  refusée → `og:image`), écarte une adresse dégénérée et compte `max(autres, Recipe − 1)` pour la garde de liste ; `enregistrerLecture`
  (`import-web.js`) et les écrivains de la photo (`photo-plat.js`, ★ Favori, « Corriger ») écrivent par la condition `{ key, fusion }` de
  `repo.saveBatch`, la fiche relue DANS la transaction ; résidu SSRF de R-B-21 repris (R-F-19).

## Expérience « carnet » (lot UI-1, 23-28 octobre 2026)

Spec : `docs/superpowers/specs/2026-10-23-experience-carnet-design.md` (rév. 2.1 ; § 0 : D-UI-1 à D-UI-14 ; § 2 : I-UI-1 à I-UI-7 ; § 3 : jetons,
typographie, composants ; § 4 : écrans ; § 5 : textes ; § 12 « Construction UI-1 : rulings » : R-UI-P1 à P3, R-UI1-1, R-UI1-2, R-UI-1 à R-UI-44 ; § 13 : les sept défauts
confirmés). Livré ici (branche `experience-carnet`, construite sur `f3672be` en parallèle de UI-2 — fusionné dans `main` le 27 octobre — et non fusionnée) : la direction des maquettes
adaptée à l'app — thème, composition des écrans, textes, icônes — sans serveur, sans migration, sans règle de produit changée (I-UI-1).

- **Jetons** (`styles.css` `:root`, `tests/theme.js`) : quatre valeurs changent — `--action #4f6b2e` (l'olive des maquettes ; renverse V-4 de la refonte,
  § 13 point 0), `--action-2 #3e5424`, `--action-bg #e9eddf`, `--tap rgba(79,107,46,.15)` ; 29 paires ≥ 4,5 (la 29e : olive sur `--paper-2`, 5,14). Règle
  vérifiable (D-UI-2) : un ÉTAT (badge « Original », statut ok, puce cochée) reste vert gris (`--accent`, `--ok`) ; l'ACTION (bouton plein, lien, onglet
  actif, anneau de focus) porte l'olive ; la galerie les met côte à côte (bloc `badges-et-action`). Inventaire T-1 et liste blanche T-2 inchangés.
- **Typographie** : `h1` de page `clamp(1.8rem, 6vw, 3.2rem)` ; `h1.titre-fiche` (`pageHeader(…, { classeTitre: 'titre-fiche' })`) `clamp(1.5rem, 4.5vw,
  2.6rem)` ; `h2` 1,6 rem ; titre de carte-plat serif 1,3 rem ; `--serif` Georgia (CSP : aucune police externe) ; `.step-num` sur `--paper-2`.
- **Composants** (`src/ui/components.js`) : `sectionPlain(title, ...children)` → `section.plain` (sans fond ni ombre, filet `--line` sous le titre) ;
  `section()` inchangé (`.card`, 54 appelants) ; `recipeCard(doc, { photoEnTete, fichier })` : la carte-plat VERTICALE (`a.item-link.carte-plat`,
  `img.plat-vignette.grande` 4:3 quand `typeAffichage(fichier)` est une image, sinon `.sans-photo` : bloc de titre sur `--paper-2`, 7 rem) — décision
  SYNCHRONE au rendu sur la ligne `files` passée par l'appelant (`repo.getFiles` en une fois pour les cartes rendues, I-UI-5 ; jamais `vignettePlat`,
  jamais un cadre vide) ; la carte horizontale reste le défaut ailleurs ; `grilleCartes(noeuds)` → `div.grille-plats` (2 colonnes dès 360 px, 3 dès
  900 px), bornée à 60 cartes + « Voir plus » (F-9) ; trois règles `.plat-vignette` (72 px, `.grande` 4:3, `.petite` 48 px).
- **Icônes** (`src/ui/icones.js`, dans `SHELL`) : `icone(nom)` → `svg[aria-hidden][focusable=false]` 24 × 24 au trait, `stroke: currentColor`, vingt-trois
  noms relevés du code (navigation, grille Ajouter, accueil d'un livre, états vides, repères) ; nom inconnu → levée ; les émojis restent dans les textes
  de contenu. `tests/theme.js` ne les voit pas (hors feuille de style).
- **Écrans** : `src/ui/library.js` (segment Recettes par défaut, filtres par données, tri par dernière modification, pied `?tab=a-importer`, actions par
  segment : « Ajouter une recette » → `#/add`, « Ajouter un livre » → `#/add/livre`) ; `src/ui/recipe.js` (`div.fiche-tete` `.two-col` ≥ 760 px, repères
  `div.reperes`, `a.btn.link[data-role=ouvrir-lien]` « Voir la page d'origine ↗ », `details.card[data-role=autres-gestes]`, `segmented` Ingrédients /
  Préparation par `hidden`, `deps.matchMedia` injectable écouté sur `change`) ; `src/ui/book.js` (`div.two-col.livre` `200px 1fr` ≥ 900 px, « Sommaire »
  = `div.thumbs` des pages `kind === 'index'`, `ul.liste-compacte`, 8 lignes puis « Voir les {n} recettes ») ; `src/ui/home.js` (`pageHeader`,
  `grilleCartes` sur Favoris et Dernières cuissons, sa propre passe `getFiles`) ; `src/ui/add.js`, `accueil-livre.js`, `import-cible.js` (icônes, « × » de
  retrait ≥ 44 px, badge « À importer ») ; `src/app.js` (NAV `label: 'Bibliothèque'`, icônes). Les écrans hors § 4 ne changent que par les jetons et les
  titres (§ 8). `search.js` ne change pas (la carte web garde sa forme épinglée ; UI-2 y pose les vignettes).
- **Libellés** (D-UI-10) : `availabilityBadge` porte ses textes courts (« À importer · p. {p} », « À importer », « Disponible », « Partielle », « Lien
  web » ; un état hors vocabulaire → badge vide) ; `STATE_LABELS.availability.reference_only` → « À importer » (lue par `dish.js` seulement — comparaison de plats, rattachements —, où un signet dit
  « Lien web » par `libelleDisponibilite` : R-UI-32 ; ni les exports ni Redécouvrir ne la lisent) ; « Repérée dans ton livre — page {p} » reste
  sur la fiche ; « Voir la page d'origine » sur toute adresse lisible (`http:` compris, I-B5) ; « + Recette », « + Pages d'index », « Ouvrir le lien »,
  « Aller à Mes livres. » retirées du source ET d'`en.js` ; « Mes livres » reste le segment de la recherche.
- **Tests** : `tests/carnet.js` (`runCarnetTests({ eq, ok })`, câblé dans `tests/tests.js` avant le bloc thème ; blocs par tâche ; le bloc T6 porte les
  filets : table `TEXTES_UI1` de 33 paires, `CHAINES_NEUVES_AILLEURS` vérifiée par CALCUL sur les cinq modules hors `MODULES_NEUFS`, chaînes retirées
  absentes de tout module de `SHELL`, treize sélecteurs neufs présents) ; `tests/theme.js` amendé (une valeur, une paire, deux libellés) ; épingles
  amendées tâche par tâche (spec § 7), jamais contournées.
- **Preuve visuelle** (registre, hors git ; `preuve-visuelle.cjs`, copie adaptée de l'outil du lot refonte) : quatre largeurs (375 × 812, 390 × 844,
  768 × 1024, 1512 × 982) plus la galerie à 320 × 568 ; `reducedMotion: 'reduce'`, service workers bloqués, réseau externe coupé, porte passée ; les
  données sont SEMÉES dans la base jetable du contexte par les modules réels (`semer(page, 'peu' | 'beaucoup')` : un livre, douze recettes, deux
  pages de sommaire ; 2 puis 9 photos) ; colonnes : débordement, navigation, cibles, contraste par nœud texte, `[hidden]`, **onglet** (« Bibliothèque »
  exact, une ligne, sans débordement : D-UI-4, § 13 point 3), console ; M14 (focus clavier, anneau olive) ; M3 NON rejouée (l'app ne poste plus à
  `api.anthropic.com` ; `search.js` inchangé : R-VIS-8 tenu par `tests/theme.js`). La galerie monte les composants RÉELS (`recipeCard`, `grilleCartes`,
  `sectionPlain`, `section`, `pageHeader`, `icone`) par un `<script type="module">` et signale `data-galerie-prete`. Contre-preuves : olive pâle →
  contraste KO ; libellé d'onglet allongé → onglet KO. Deux retouches de l'outil source : le repli `setContent` part d'une page de MÊME origine
  (`/icons/` : depuis `about:blank`, Chrome bloque la feuille et les modules, R-UI-42) ; le 404 différé de `/favicon.ico` est compté à part (R-UI-43).
  Mesure du 28 octobre : 69 lignes sur 69, 173 captures, contraste rendu minimum 4,62 sur 3 600 nœuds, M14 20 sur 20.

## Modèle de données (magasins IndexedDB)

`books`, `book_editions` (ISBN, langue, `unit_convention_id`), `source_documents` (fichier, sha256, type), `source_pages` (page imprimée, position),
`scan_sessions`, `dishes` (libellés FR/EN embarqués), `dish_recipe_links` (proposé / confirmé / refusé), `recipes` (titre original, disponibilité, vérification, favori, pages sources, `current_version_id`),
`recipe_versions` (extraction / correction / adaptation / traduction / synthèse; ingrédients avec texte source, quantité, unité, identité proposée; étapes à identifiant stable; provenance avec instantané de convention),
`recipe_translations`, `ingredients` (identité neutre, libellés FR/EN, `contains` pour les régimes, équivalences documentées), `unit_definitions`, `unit_conventions` (révision),
`substitutions`, `appliances` (capacités), `cook_history` (version exacte, portions, quantités effectivement utilisées), `cook_sessions` (progression par identifiant d'étape),
`inventory`, `meals` (éléments avec rôle, portions, verrouillage), `meal_feedback`, `shopping_lists`, `library_activity`, `rediscovery_prefs`, `timer_launches`, `files`, `assistant_config` (une ligne `llm` : la configuration de l'assistant, clé comprise ; jamais supprimée localement, jamais archivée), `settings`.

Règles : identifiants stables préfixés; une correction crée une version (jamais de réécriture); l'historique référence la version et un instantané des quantités; les adaptations sont des versions, sans table concurrente.

## Sauvegarde

Archive ZIP « stored » : `manifest.json` (format `cuisine-os-archive` v1, décomptes, liste des fichiers avec SHA-256), `data/<magasin>.json`, `files/<sha256>.<ext>`, `README.txt`.
L’export lit tous les magasins dans une transaction IndexedDB commune, puis construit et hache l’archive en mémoire. Les fichiers sources sont rehachés avant export. Si des relations sont déjà incohérentes dans la bibliothèque, l’archive peut être conservée avec un avertissement visible ; elle sera refusée à la restauration tant que les incohérences ne sont pas résolues. Aucune donnée n’est supprimée ou réparée automatiquement.

L’inspection exige tous les magasins de données et les réglages, leurs décomptes et leurs empreintes. Elle refuse les clés absentes ou dupliquées, les chemins ZIP répétés, les entrées non déclarées, les fichiers corrompus et les relations connues cassées. Les chemins de relations dans le schéma peuvent traverser des objets et des tableaux. Il s’agit d’une validation de structure, de clés et de relations, pas d’un contrôle de tous les champs métier.

La restauration prépare les objets et fichiers avant toute écriture. La fusion et le remplacement utilisent une seule transaction ; en remplacement, les vidages font partie de cette transaction. Une exception synchrone ou une erreur IndexedDB annule les écritures du lot. En fusion, les fiches portant le même identifiant sont remplacées, les autres sont conservées ; les métadonnées locales des fichiers existants sont conservées et leurs octets sont réécrits depuis l’archive validée. Les réglages secrets sont ignorés à l’import (`SECRET_SETTING_KEYS`) ; en remplacement, les réglages locaux sont vidés et remplacés par ceux de l’archive. La configuration de l’assistant, elle, n’est plus un réglage : elle vit dans `assistant_config`, qui n’entre dans aucune archive et qu’un remplacement **garde** (K-7) — une archive ne peut ni la porter ni l’effacer.

La vérification relit un instantané commun et compare le contenu JSON complet des fiches importées, leurs clés, les relations déclarées, les tailles/types et empreintes des fichiers. En remplacement, les décomptes doivent aussi être identiques ; en fusion, des fiches supplémentaires sont permises. Le bilan reste visible et l’utilisateur recharge explicitement l’application. Les anciennes commandes sont désactivées pour éviter d’exporter un contexte périmé.

Le format reste v1 : les archives complètes produites précédemment restent lisibles si elles satisfont les contrôles renforcés. Les versions inconnues sont refusées. ZIP64 et les entrées compressées/chiffrées ne sont pas pris en charge ; les limites du ZIP standard sont contrôlées avant génération. Les archives et photos restent chargées en mémoire : les gros volumes et le quota sur iPhone restent à valider.

« Dernière archive générée » atteste seulement la génération et le déclenchement du téléchargement. Le navigateur ne confirme pas l’enregistrement dans Fichiers. Les scénarios automatisés ajoutés dans tests/backup.js utilisent exclusivement des bases temporaires cuisine-os-backup-test-* ; ils n’ont pas été exécutés pendant cette modification.

## Limites connues de V0

- Échange de données entre appareils : **les fiches** voyagent depuis le lot L3, avec un compte connecté (voir
  « Synchronisation (L3) ») ; les **octets des fichiers** (photos, PDF) voyagent depuis le lot G (voir « Fichiers (L4, lot G) ») ; pour
  tout appareil sans compte, le transfert reste l'archive ZIP. Aucune passe réelle n'a encore été mesurée sur deux
  appareils.
- Pas de reconnaissance vocale; minuterie confiée au système (Siri / raccourci).
- EPUB conservé mais non rendu; PDF affiché via le lecteur du navigateur, pages référencées à la main.
- Interface anglaise partielle (dictionnaire `src/i18n/en.js`).
- Adaptations Rapide / On se gâte / Meal prep, moteur de salubrité, planificateur multi-repas et synthèse : paliers V1–V1.5, non implémentés (indiqués comme tels dans l'interface). Exception depuis le 18 octobre : une version de genre `synthesis` naît désormais de « Créer une recette avec l'assistant » (une proposition à vérifier, voir cette section).
