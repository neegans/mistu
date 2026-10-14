# Architecture — Cuisine OS V0

## Choix

- **PWA sans étape de build** : modules ES natifs, aucune dépendance npm. Un serveur statique suffit. Choix guidé par « éviter la surarchitecture » (spec §15) et par la possibilité de tout vérifier en ouvrant l'app.
- **Local-first** : IndexedDB comme base unique (un magasin par entité), blobs (photos, PDF) stockés dédupliqués par SHA-256 dans le magasin `files`. La sauvegarde complète (ZIP) reste un mécanisme de durabilité et de transfert entre appareils, utilisable sans compte. Depuis le lot L3, **les fiches** peuvent aussi voyager par un serveur Supabase quand un compte est connecté (voir « Synchronisation (L3) ») ; les **octets des fichiers**, eux, ne partent pas encore (L4). L'app reste utilisable sans compte, sur un appareil seul.
- **Déterministe avant IA** : unités, portions, courses, régimes, sauvegarde et recherche sont du code sans LLM. L'IA est une abstraction `LLMProvider` (aucun, compatible OpenAI, Anthropic) branchée uniquement sur l'extraction de pages et d'index; ses résultats sont toujours « à vérifier ».

## Carte des modules

```text
index.html, styles.css, manifest.webmanifest, sw.js
src/app.js                 coquille, navigation, routes
src/core/    db.js (IndexedDB), router.js (#/…), dom.js (el, dialogues), i18n.js (FR clé, EN dictionnaire), hash.js (SHA-256 + repli), zip.js (ZIP stored), ids.js, bus.js
src/model/   schema.js (magasins, relations, vocabulaires), seed.js (unités, conventions, ingrédients FR/EN, presets d'appareils), repo.js (accès, réglages, activité, fichiers)
src/domain/  quantity.js (fractions, plages, qualitatif), units.js (conventions, conversions, affichage), lines.js (analyse d'une ligne d'ingrédient), scaling.js,
             diet.js, grocery.js, search.js (langage naturel → pastilles; groupes), dishes.js (rapprochement, comparaison), pairing.js (accompagnements, résumé de repas),
             rediscover.js, timers.js, backup.js (archive, inspection isolée, restauration, vérification), exporters.js (JSON-LD, YAML Paprika, HTML), llm.js
src/ui/      state.js (cache), components.js, home, search, library, book, dish, recipe, recipe-edit, cook, import, meals, grocery, kitchen, settings, add
src/sync/    tables.js, mime.js, clock.js, outbox.js, config.js, auth.js — voir « Synchronisation (L1-L2) »
             transport.js, lots.js, reponses.js, push.js, backfill.js, pull.js, conflits.js, moteur.js — voir « Synchronisation (L3) »
src/core/log.js            point d'entrée unique du journal d'erreurs (logError)
src/vendor/  supabase-2.117.3.umd.js (dépendance embarquée, vérifiée deux fois)
tests/       tests.js + index.html : tests du domaine ; backup.js : régressions IndexedDB dans des bases temporaires ; sync.js : lot « compte et stockage distant » (L1-L2) ;
             sync-l3.js + transport-factice.js + sync-fixture.js : lot « envoi et réception » (L3), transport simulé, aucun réseau
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
les vide — en une transaction sans capture, en gardant `sync_state.device_id`. L'identité d'appareil vit dans
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

## Synchronisation (L3)

Spec : `docs/spec-compte-et-stockage-distant.md` § 5.3 (envoi), § 5.5 (réception et conflits), § 5.2 (envoi
initial), § 4.2 (interface), § 11 (amendements R37 à R56). Livré ici : **les fiches** voyagent entre les appareils
d'un même compte — envoi, envoi initial, réception, conflits, quarantaine, pause, et un moteur qui décide quand.
Pas les **octets** des fichiers (L4), pas la purge du serveur (L5).

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

### Ce qui est absent (L4 et L5)

- **Octets des fichiers** (L4) : pas de `src/sync/files.js`, aucun téléversement ni téléchargement, aucune qualité
  d'envoi, aucun affichage de l'espace serveur. Les **lignes** `files` sont bien reçues, sans leurs octets
  (`remote: true`, blob local conservé — R55), et `identiques` doit encore y comparer la liste blanche des champs
  du serveur (R56, ouvert). Une archive produite sur un appareil qui a reçu de telles lignes exigera
  `missing_files` dans son manifeste (R18).
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
amendé). Livré ici : la grille de cinq cartes, un livre créé en deux pas (ISBN ou saisie), les puces « Cuisines »
partagées entre le livre et la fiche recette, l'accueil d'un livre ajouté, le signet (lien web gardé comme
référence), et la couverture (reçue par ISBN ou photographiée).

### Modules neufs (sept, un rôle chacun)

```text
src/ui/puces.js          pucesModel/renderPuces/basculerPuce/ajouterPuce/cuisinesExistantes : un geste de pastilles
                         partagé par le livre (add.js) et la fiche recette (recipe-edit.js) ; graine fermée de
                         quinze cuisines, normalisation (minuscules, accents retirés) pour le doublon, affichage
                         capitalisé ; jamais dans un <label> (R-UX-8 : un clic sur le texte voisin activerait la
                         première puce).
src/ui/livre-ajout.js    lookupIsbn (Open Library puis Google Books en repli), fusionnerFiche, fabriquerLivre,
                         enregistrerLivre, renderLivreAjout/renderLivreAjoutRoute : le formulaire « Ajouter un
                         livre » en deux pas ; la couverture reçue appartient à SA demande d'ISBN, jamais à une
                         autre (R-UX-13).
src/ui/accueil-livre.js  accueilLivreModel/ACCUEIL_ACTIONS/renderAccueilLivre : l'écran après l'ajout d'un livre
                         (photographier l'index ou une recette, aller à Mes livres) ; `?nouveau` sans valeur ne
                         journalise rien (R-UX-10 : le modèle décide, pas la route).
src/ui/signet.js         lienSignet (ré-exporté de core/lien.js), signetModel, fabriquerSignet, enregistrerSignet,
                         renderSignet/renderSignetRoute : garder un lien web comme référence, avec titre et livre
                         facultatif.
src/core/image.js        dimensionsImage, reduireImage, ErreurImage, LIMITES_COUVERTURE, COVER_INPUT_MIME :
                         dimensions lues dans l'en-tête AVANT décodage (bombe de décompression), re-encodage JPEG
                         systématique (HEIC et formats exotiques inclus), bornes 25 Mo / 50 Mpx (fichier local) et
                         5 Mo (corps d'une réponse distante, lu en flux et coupé — Open Library n'annonce pas
                         `content-length`, R-UX-12).
src/core/blob-urls.js    urlDeBlob/revoquerUrlsDeBlob : chaque URL blob: créée pour afficher une couverture ou un
                         aperçu est suivie dans un registre partagé, révoquée à la route suivante (S15/F4). Dette
                         assumée : `displayUrl` (vignettes, PDF) crée encore des URL blob: hors de ce registre
                         (pré-existant, hors lot).
src/core/lien.js         lienSignet(sourceUrl) : fonction pure sans dépendance, pour que tout écran affichant un
                         lien puisse revalider l'adresse AU RENDU (seuls http:/https: s'ouvrent, hôte rendu en
                         punycode) sans jamais faire confiance à un `source_label` stocké, qu'une archive ou le
                         serveur peuvent avoir rempli avec n'importe quoi (S7). Sous `components.js` ET
                         `signet.js` (qui importe `components.js`), pour éviter un cycle.
```

`src/ui/add.js` est réécrit (grille de cinq cartes `renderGrille`, sélecteur avant scan `renderSelecteurScan`,
`parametresDeScan` pur, R-UX-7) mais reste le même fichier, déjà dans `SHELL` depuis le lot d'hébergement.

### « Intention dans l'adresse »

Une séance de scan ne sait pas, à l'ouverture, si elle vient de « + Pages d'index » ou de « + Recette ». Plutôt
qu'un état posé en base ou en mémoire — qu'un rafraîchissement réappliquerait indéfiniment (F6) —, l'intention
voyage dans l'URL (`adresseSeance(sessionId, intention)` → `/import?session=…&intention=index`), est consommée au
premier rendu (`appliquerIntention` : présélection des pages, panneau d'index ouvert ou non), puis retirée de
l'adresse par un geste `historique.remplacer` injecté (jamais un vrai `history.replaceState` dans un test, I-H) :
un `refresh()` ultérieur ne la réapplique donc pas.

### `cover_sha256` : pointeur souple

`book_editions.cover_sha256` pointe une ligne `files` par son empreinte, **sans** entrée dans `RELATIONS`
(`schema.js`) et sans relation d'archive : une fiche dont la couverture n'est pas (encore, ou plus) sur cet
appareil reste restaurable et affichable — la fiche le dit (« La couverture n'est pas sur cet appareil. ») plutôt
que d'échouer. Choix voulu (S1/F2) : une relation stricte aurait rendu une archive irrestaurable dès qu'une
couverture manque, par exemple après une réception L3 (qui reçoit la ligne `files` sans ses octets — L4). Dette
nommée : `source_pages.sha256` reste la même sorte de relation latente, jamais vérifiée nulle part.

## Modèle de données (magasins IndexedDB)

`books`, `book_editions` (ISBN, langue, `unit_convention_id`), `source_documents` (fichier, sha256, type), `source_pages` (page imprimée, position),
`scan_sessions`, `dishes` (libellés FR/EN embarqués), `dish_recipe_links` (proposé / confirmé / refusé), `recipes` (titre original, disponibilité, vérification, favori, pages sources, `current_version_id`),
`recipe_versions` (extraction / correction / adaptation / traduction / synthèse; ingrédients avec texte source, quantité, unité, identité proposée; étapes à identifiant stable; provenance avec instantané de convention),
`recipe_translations`, `ingredients` (identité neutre, libellés FR/EN, `contains` pour les régimes, équivalences documentées), `unit_definitions`, `unit_conventions` (révision),
`substitutions`, `appliances` (capacités), `cook_history` (version exacte, portions, quantités effectivement utilisées), `cook_sessions` (progression par identifiant d'étape),
`inventory`, `meals` (éléments avec rôle, portions, verrouillage), `meal_feedback`, `shopping_lists`, `library_activity`, `rediscovery_prefs`, `timer_launches`, `files`, `settings`.

Règles : identifiants stables préfixés; une correction crée une version (jamais de réécriture); l'historique référence la version et un instantané des quantités; les adaptations sont des versions, sans table concurrente.

## Sauvegarde

Archive ZIP « stored » : `manifest.json` (format `cuisine-os-archive` v1, décomptes, liste des fichiers avec SHA-256), `data/<magasin>.json`, `files/<sha256>.<ext>`, `README.txt`.
L’export lit tous les magasins dans une transaction IndexedDB commune, puis construit et hache l’archive en mémoire. Les fichiers sources sont rehachés avant export. Si des relations sont déjà incohérentes dans la bibliothèque, l’archive peut être conservée avec un avertissement visible ; elle sera refusée à la restauration tant que les incohérences ne sont pas résolues. Aucune donnée n’est supprimée ou réparée automatiquement.

L’inspection exige tous les magasins de données et les réglages, leurs décomptes et leurs empreintes. Elle refuse les clés absentes ou dupliquées, les chemins ZIP répétés, les entrées non déclarées, les fichiers corrompus et les relations connues cassées. Les chemins de relations dans le schéma peuvent traverser des objets et des tableaux. Il s’agit d’une validation de structure, de clés et de relations, pas d’un contrôle de tous les champs métier.

La restauration prépare les objets et fichiers avant toute écriture. La fusion et le remplacement utilisent une seule transaction ; en remplacement, les vidages font partie de cette transaction. Une exception synchrone ou une erreur IndexedDB annule les écritures du lot. En fusion, les fiches portant le même identifiant sont remplacées, les autres sont conservées ; les métadonnées locales des fichiers existants sont conservées et leurs octets sont réécrits depuis l’archive validée. Les réglages secrets sont ignorés à l’import ; en remplacement, les secrets locaux sont effacés avec les autres réglages.

La vérification relit un instantané commun et compare le contenu JSON complet des fiches importées, leurs clés, les relations déclarées, les tailles/types et empreintes des fichiers. En remplacement, les décomptes doivent aussi être identiques ; en fusion, des fiches supplémentaires sont permises. Le bilan reste visible et l’utilisateur recharge explicitement l’application. Les anciennes commandes sont désactivées pour éviter d’exporter un contexte périmé.

Le format reste v1 : les archives complètes produites précédemment restent lisibles si elles satisfont les contrôles renforcés. Les versions inconnues sont refusées. ZIP64 et les entrées compressées/chiffrées ne sont pas pris en charge ; les limites du ZIP standard sont contrôlées avant génération. Les archives et photos restent chargées en mémoire : les gros volumes et le quota sur iPhone restent à valider.

« Dernière archive générée » atteste seulement la génération et le déclenchement du téléchargement. Le navigateur ne confirme pas l’enregistrement dans Fichiers. Les scénarios automatisés ajoutés dans tests/backup.js utilisent exclusivement des bases temporaires cuisine-os-backup-test-* ; ils n’ont pas été exécutés pendant cette modification.

## Limites connues de V0

- Échange de données entre appareils : **les fiches** voyagent depuis le lot L3, avec un compte connecté (voir
  « Synchronisation (L3) ») ; les **octets des fichiers** (photos, PDF) ne partent pas encore — pour eux, et pour
  tout appareil sans compte, le transfert reste l'archive ZIP. Aucune passe réelle n'a encore été mesurée sur deux
  appareils.
- Pas de reconnaissance vocale; minuterie confiée au système (Siri / raccourci).
- EPUB conservé mais non rendu; PDF affiché via le lecteur du navigateur, pages référencées à la main.
- Interface anglaise partielle (dictionnaire `src/i18n/en.js`).
- Adaptations Rapide / On se gâte / Meal prep, moteur de salubrité, planificateur multi-repas et synthèse : paliers V1–V1.5, non implémentés (indiqués comme tels dans l'interface).
