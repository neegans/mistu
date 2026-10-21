# Lot G — « Les photos voyagent entre appareils » : octets des fichiers (L4 de la spec compte) — spec (rév. 4)

> **Rév. 4 → construction, close le 20 octobre 2026** : rulings R-G-7 à R-G-30 au § 12 (Départ, construction, vague finale), limites ajoutées au § 11, dettes au § 13 ; chiffres finaux dans `CLAUDE.md` (section du lot G). La vague finale a été faite INLINE par le chef d'orchestre (limite de dépense du compte) : une re-revue à trois lentilles de ce diff est due AVANT la fusion (R-G-30).

Date : 19 octobre 2026 (rév. 1 le même jour ; rév. 2 après la revue adverse à trois lentilles ; rév. 3 après les rulings du chef
d'orchestre R-G-1 à R-G-5 et les constats N-1 à N-4 ; rév. 4 après le ruling R-G-6 — constat C-1 de la vérification de la rév. 3 —, § 12 ;
§ 13 est vide). Base : la tête du lot A sur
`import-cible` (worktree `~/projects/mistu-import`, `24e539b` au moment des rév. 3 et 4 — `f5e5464` à la rév. 2 —, `APP_VERSION 0.9.0`
(`src/model/schema.js`), `DB_VERSION 4`, `sw.js` `cuisine-os-v0.9.0-5` ; le lot A y commet encore). Branche à créer : `photos-entre-appareils`, worktree
`~/projects/mistu-photos-entre-appareils`, serveur de
vérification `python3 -m http.server 8090 --bind 127.0.0.1` (consigne du chef d'orchestre au Départ, 19 octobre : chaîne linéaire A → B → G → C → D → E → F, un worktree propre par lot, créé sur la tête FINALE du lot précédent — ici la tête finale du lot B « Recette web complète » — ; la rév. 1 disait `octets-fichiers`, `~/projects/mistu-fichiers` et 8089, nom et port repris par le lot B ; `APP_VERSION` de G = 0.11.0, règle R-E-18). Sources : spec parente `docs/spec-compte-et-stockage-distant.md`
(§ 3.6, § 4.2 ensemble L4, § 5.4, § 7, § 8 ligne L4, § 11 : R12, R18, R39, R46, R55, R56, R58) ; audit
`docs/audits/2026-10-18-import-livres-photos-web.md` (§ 1.6 « Texte en base, images en stockage », § 2 « Images », § 4 lot G, § 5 critères) ;
dossier de passation `Mitsu_Claude_Code/04_PLAN_TECHNIQUE_ET_VALIDATION.md` (§ 4 G : « les pointeurs seuls ne rendent pas les photos
accessibles sur iPhone … vérifier téléchargement, accès et récupération après interruption » ; **§ 5, tableau de validation, ligne « Deux
appareils »** : « Images réellement ouvertes sur le second appareil, pas seulement leurs pointeurs ») ; migration
`supabase/migrations/0002_stockage.sql` ; `CLAUDE.md` (dettes L4 de L3). Méthode : spec → revue adverse → plan → construction par
sous-agents → `/verify` → fusion par Neegan.

Lecture du code faite avant d'écrire, refaite pour la rév. 2, et pour la rév. 3 sur `24e539b` pour chaque nom que les rulings touchent
(`decider`, `ficheFichier` et le chemin `deletes` de `pull.js` ; `garderAilleurs` et `serveur.deleted_at` de `conflits.js` ; `verifyRestored`,
`canonical`, `applyArchive` de `backup.js` ; `putFile` et son option `origin` ; `LIMITES_COUVERTURE.pixels = 16_000_000` ; la vue
`private.storage_usage` de `0002` ; R33 de `CLAUDE.md` : « un second projet coûte 10 $ par mois sur l'organisation Pro » ; les onze assertions
L3 de § 7, aux mêmes lignes ; et pour la rév. 4 — R-G-6 —, sur `24e539b` encore : `applyArchive` (`existingFiles` lue en fusion **seulement**,
`batch.files.push({ ...existing, sha256, blob, mime, size, created_at })`, `clearStores` en remplacement, retour = décomptes par magasin
qu'**aucun appelant ne lit** — `settings.js` l'`await` sans l'assigner, les 22 appels des suites de même), `verifyRestored` (`sha256Hex(row.blob)
!== file.sha256` et `row.blob.size !== file.size` en brut), `ficheRestauree` (nommée une fois, relue par `verifyRestored` : le gabarit R61),
`createArchive` (« Fichier source endommagé » encore levé) ; `appliquerArchive` et `restoreReport` de `settings.js` (le bilan vit dans `result`,
après `verifyRestored` ; `confirmDialog` y est importé de `core/dom.js`, pas injecté dans `renderSettings`) ; `messageRenvoi` et
`messageRemplacementServeur` (pures, exportées, éprouvées par appel direct dans `tests/sync-l3.js`) ; `estOriginalIci`, `octetsRestaures`,
`originauxConserves`, `messageOriginauxConserves` : aucune occurrence dans `src/` ni `tests/`) (noms vérifiés par `grep` et lecture ; les numéros de ligne ne sont plus
cités : le lot A les déplace à chaque commit, les symboles sont nommés à la place) : `src/sync/` en entier (`moteur.js`, `push.js`,
`pull.js`, `backfill.js`, `lots.js`, `outbox.js`, `transport.js`, `tables.js`, `mime.js`, `config.js`, `auth.js`, `clock.js`, `reponses.js`,
`conflits.js`), `src/model/repo.js` (`putFile`, `getFile`, `getFiles`, `ajouterPages`, les passes d'`init()`), `src/model/schema.js`,
`src/domain/backup.js`, `src/core/db.js` (`mutate`, `getSnapshot`, `onMutate`, `conditions`), `src/core/image.js` (`reduireImage`,
`dimensionsImage`, `preparerPhotoLocale`, `LIMITES_COUVERTURE`), `src/core/hash.js`, `src/core/blob-urls.js`, `src/core/log.js`,
`src/ui/settings.js`, `src/ui/state.js`, `src/ui/book.js`, `src/ui/import.js`, `src/ui/recipe.js`, `src/ui/components.js` (`bookCover`,
`pdfFrame`, `field`, `segmented`), `src/ui/library.js`, `src/ui/livre-ajout.js` (`poserCouverture`, `renderZoneCouverture`),
`src/domain/llm.js` (`pagePourEnvoi`), `src/domain/import-cible.js` (`fabriquerExtraction` : `recipes.photo_sha256`), `src/app.js`, `sw.js`,
`src/i18n/en.js`, `src/vendor/supabase-2.117.3.umd.js` (lu dans le bundle : `storage.from(bucket)` avec `upload(path, body, opts)` →
`uploadOrUpdate` ; **un corps `Blob` passe par `prepareUploadFormData` → `FormData`, et l'option `contentType` n'est posée en en-tête que
dans la branche hors Blob** ; `x-upsert` ; `download(path)` ; `list(prefix, { limit, offset, sortBy, search })` ; `remove(paths)` ;
`getPublicUrl`, `createSignedUrl` ; **`StorageApiError` porte `status` (statut HTTP, repli 500), `statusCode` (chaîne : `statusCode` du corps,
sinon `code` du corps, sinon le statut) et `code` (`Duplicate`, `InvalidMimeType`, `KeyNotFound`…)**), `tests/sync.js`, `tests/sync-l3.js`,
`tests/transport-factice.js` (son mode `serveur` n'émet jamais `adjusted`), `tests/sync-fixture.js`, `tests/backup.js` (`withDatabase`,
`rewriteArchive`), `tests/assistant-compte.js`, `tests/passerelle.js`, `tests/tests.js` (total épinglé), `tests/fixtures/`,
`tools/generer-migrations.mjs` (importe `tables.js` sous Node), `supabase/README.md` (étapes 6 et 7), `docs/architecture.md` (« Ce qui est
absent (L4 et L5) »).

## 0. Décisions (chacune renversable sans défaire le reste ; « coût si faux » = ce qu'on perd si la décision est mauvaise)

- **D-G1 (brief)** Périmètre = L4 de la spec compte, **sans** la purge ni « Supprimer ma bibliothèque du serveur » (L5, R12) : envoi des octets
  des fichiers **référencés** (une ligne `files` `syncable: true` avec `blob`, pointée par au moins une fiche synchronisée :
  `source_pages.sha256`, `source_documents.sha256`, `book_editions.cover_sha256`, `recipes.photo_sha256` et `imports.photo_sha256` — ces deux
  derniers depuis le lot A, `fabriquerExtraction` et `repo.ajouterPages` ; les orphelins ne partent pas et ne sont pas effacés), réception à la
  demande et globale, qualité d'envoi, espace serveur, `missing_files` (R18), `identiques` sur `files` (R56). Aucune nouvelle table, aucune
  migration, aucun changement de la fonction `assistant`, `DB_VERSION` inchangée (4). Renversable : un lot L5 à part. Coût si faux : des
  objets orphelins s'accumulent sur le serveur (D-G3, D-G4) sans geste pour les retirer avant L5.
- **D-G2 (brief, précisée en rév. 2)** Chemin d'objet `<owner_id>/<empreinte des octets envoyés>` dans le seau `pages` (règles de `0002` :
  `(storage.foldername(name))[1] = auth.uid()::text`), `upsert: false` ; le type part comme **type du `Blob`** (§ 4.7 c : supabase-js ignore
  l'option `contentType` pour un `Blob`) ; un **objet déjà présent** n'est pas une erreur : il se reconnaît par `statusCode === '409' ||
  status === 409 || code === 'Duplicate'` (les trois formes vues chez le fournisseur, § 11) ; l'app lit alors les métadonnées par
  `list('<owner_id>', { search: <empreinte>, limit: 1 })` ; `metadata.size` égal → confirmé ; différent → `upsert: true` puis nouvelle
  lecture ; encore différent → `file_error` motif `verification`. Un fichier n'est « envoyé » qu'après confirmation. Le serveur ne vérifie
  aucune empreinte SHA-256 : **la clé est l'empreinte calculée par l'appareil qui envoie** (limite dite, § 11). Renversable : `download` +
  recalcul à la place de `list` (plus cher). Coût si faux : un 409 mal lu laisse un objet d'un autre contenu sous la même clé (impossible
  sans collision SHA-256, sauf objet tronqué : c'est ce que la taille attrape) ; un 409 **non reconnu** marquerait chaque objet déjà présent
  « Type de fichier refusé » pour toujours (c'est pourquoi les trois formes sont lues).
- **D-G3 (brief, précisée ici — le point le plus délicat du lot)** Qualité d'envoi (D2 du 12 octobre) : **Réduite** par défaut (JPEG, grand
  côté 2 000 px, qualité 0,8, cible ≈ 400 Ko ; une image déjà sous 2 000 px **et** sous 600 Ko part telle quelle ; PDF et EPUB partent
  toujours tels quels ; une image que le navigateur ne décode pas — HEIC hors Safari — part telle quelle ; une image de **plus de 16 Mpx**
  n'est jamais décodée et part telle quelle, § 4.7 a — R-G-4 : mur de sécurité existant, hauteur **à relever après mesure**, § 10 geste 8) ou
  **Originale** (réglage `settings.upload_quality`, par appareil, jamais synchronisé).
  Les octets réduits ont une **autre** empreinte que l'original : la ligne `files` (clé = empreinte de l'original local) gagne un champ `remote`
  **objet** `{ sha256, size, mime, quality, uploaded_at, owner }` qui dit quels octets sont au serveur et sous quel compte (`owner` =
  `auth.uid()` de l'appareil qui a envoyé ; § 3.1). **`quality` est un fait mesuré, jamais le réglage** : `'originale'` si l'empreinte des
  octets envoyés est la clé de la ligne, `'reduite'` sinon (rév. 2, S-3 : le réglage choisit les octets, l'étiquette dit ce qui est parti). La
  réception télécharge `<owner_id courant>/<remote.sha256>` (seulement si `remote.owner` est le compte courant, § 3.1), vérifie type, taille
  et empreinte des octets reçus **contre `remote`** (jamais contre la clé seule), écrit le blob sous la clé de la ligne par `db.mutate`
  d'origine `remote` (la ligne garde `remote` et toutes ses métadonnées serveur, `size` compris). L'original reste **toujours** sur l'appareil
  qui l'a pris — et aucune archive restaurée ne le remplace par une copie (rév. 4, R-G-6, § 3.4). **Archive** : `createArchive` vérifie aujourd'hui l'empreinte des octets contre le nom du fichier (« Fichier source
  endommagé ») — une copie réduite téléchargée **ferait échouer l'archive**. Le manifeste gagne donc, par entrée `files[]`, `bytes_sha256`,
  `bytes_size`, `bytes_mime` — **présents dès que les octets archivés ne sont pas l'original**, quel que soit `remote` (rév. 2, S-1 : lier
  `bytes_*` à `remote` rendait l'archive impossible après un renvoi en originale ou une restauration ailleurs) — et `remote` ; § 3.4 dit
  exactement ce que `createArchive`, `inspectArchive`, `applyArchive` et `verifyRestored` font de ces champs. Renversable : refuser d'archiver
  une copie réduite (l'archive dirait « non téléchargée ») — mais l'appareil qui n'a QUE des copies réduites (l'iPhone, demain) ne pourrait
  plus rien archiver de ses pages. Coût si faux : une archive d'iPhone qui ne porte pas les photos qu'il affiche.
- **D-G4 (brief, précisée)** Pas de file stockée pour les octets : à chaque passe du moteur, **après** l'envoi et la réception des fiches, une
  passe « fichiers » calcule les lignes à envoyer (référencées, `syncable`, **original présent ici** (`estOriginalIci`), `remote` nul, invalide
  ou d'un autre `owner`, ou — **seulement** quand la personne a demandé « Renvoyer en originale » — `remote.sha256 !== sha256`), envoie **un**
  fichier à la fois, borne la passe (≤ 20 fichiers **ou** ≤ 60 s), reprenable (la passe suivante reprend là où la précédente s'est arrêtée :
  l'ordre est celui de `created_at ?? updated_at`), interrompue par `arreter()` ; échec classé (`classerErreur`) → recul exponentiel
  (`reculMs`), jamais de boucle serrée ; un fichier refusé (> 50 Mo avant tout envoi, type refusé par le serveur, vérification impossible) est
  marqué `sync_state.file_error:<sha256>` avec son motif et n'est plus retenté avant « Réessayer » (sauf `trop_gros`, qui n'a pas de
  « Réessayer » : rien ne changera tant que le fichier est le même, § 4.10). Un **seau plein** (413, 507, « exceeded ») pose
  **`sync_state.pause_fichiers`**, une clé **distincte** de `sync_state.pause` (rév. 2, B-5/S-4 : la pause de quota de `push.js` suspend
  l'envoi des fiches ; un seau plein ne doit suspendre que les octets — Postgres accepte encore les fiches). Réglages montre « Photos à
  envoyer : N » (distinct de « À envoyer : N » des fiches) et la progression « Envoi des photos : N/M ». Renversable : une file `outbox` pour
  les octets. Coût si faux : une passe de 60 s peut retarder l'envoi des fiches d'une passe (c'est pourquoi les fiches partent AVANT les
  octets).
- **D-G5 (brief, précisée)** Réception : une ligne `files` sans octets s'affiche « n'est pas encore sur cet appareil » avec **« Télécharger »**
  là où un fichier s'affiche (couverture sur la fiche du livre, miniature de page de séance, « Original » et « Pages d'index » de la fiche
  recette, cadre PDF) — **seulement si `remote.owner` est le compte courant** ; un `remote` d'un autre compte est traité comme « pas encore
  envoyée » — il vaut « aucune copie serveur connue » pour l'état, les compteurs, le téléchargement et la candidature (R-G-2 ; rév. 2,
  B-4/S-8/F-7 : les règles `pages_select` interdisent l'autre dossier, le 404 serait certain). Le téléchargement est **sur une
  tape**, jamais automatique à l'ouverture d'un écran (aucune détection de réseau ; une tape = des octets qui descendent, décidés par la
  personne ; « Télécharger toutes les pages » couvre le reste). Réglages : « Télécharger toutes les pages (N fichiers, ~M Mo) » (tant que l'app
  est au premier plan, reprenable, bornée par passe comme l'envoi). Type vérifié contre `ALLOWED_MIME`, taille et empreinte recalculée comparées
  à `remote` (D-G3) ; écart → rien n'est écrit, `file_error`, « Fichier illisible reçu du serveur. » + « Réessayer ». **Tranché (R-G-1)** : sur une tape
  seulement, plus « Télécharger toutes les pages » dans Réglages ; le téléchargement automatique à l'ouverture d'un écran reste hors périmètre
  (§ 8). Renversable : un lot ultérieur. Coût si faux : une tape de plus par page sur le Mac.
- **D-G6 (brief, précisée en rév. 2, tranchée en rév. 3 : R-G-5)** Espace serveur sans migration : l'app liste **son** dossier
  (`list('<owner_id>', { limit: 1000, offset })`, paginé jusqu'à une page courte, 20 pages au plus) et additionne `metadata.size` ; résultat
  gardé dans `sync_state.storage_usage = { octets, objets, at, tronque }` ; recalculé sur « Actualiser » et à la fin d'une passe qui a confirmé
  au moins un fichier. **Aucune promesse de palier ni de plafond** : `mitsu` vit sur une organisation **Pro** (`CLAUDE.md`, R33 : « un second
  projet coûte 10 $ par mois sur l'organisation Pro ») et l'app **ne connaît pas le plan** du projet — ni son quota, ni son prix ; la rév. 2
  (« Le palier gratuit donne 1 Go pour tout le projet », barre sur 1 024 Mo, alerte à 80 %, « le palier Pro (100 Go) est à ~25 $/mois »)
  affirmait un plan que rien dans le code ne lit, et qui est faux pour `mitsu`. L'écran dit une **mesure**, jamais un plafond : « Tes photos
  sur le serveur : X Mo (N fichiers) » + « Actualiser » — **sans barre, sans seuil, sans phrase de palier**. Ce que l'app mesure est le dossier
  de CE compte (deux comptes sont admis ; le serveur, lui, compte le projet entier) : « Tes » le dit, rien de plus. La vue
  `private.storage_usage` n'est pas lisible par l'app (révoquée par `0002`, R15) : elle reste pour l'éditeur SQL, où Neegan lit le total du
  projet. **Aucune migration** (la fonction `public.storage_total()` de la rév. 2 est abandonnée, § 8). Renversable : une phrase de plan posée
  à la main par Neegan le jour où il voudra la nommer (hors code tant que l'app ne lit pas le plan). Coût si faux : un seau plein n'est annoncé
  par rien avant le 413 (`pause_fichiers`, § 4.10) ; et jusqu'à 20 requêtes `list` par mesure sur une très grosse bibliothèque.
- **D-G7 (brief, précisée)** R18 : `createArchive` écrit `missing_files` dans le manifeste pour les lignes sans blob (`sha256`, `mime`, `size`,
  `remote`) ; `inspectArchive` **et `requireInspection`** comptent ces empreintes comme connues (relations `source_pages.sha256 → files` et
  `source_documents.sha256 → files` : `files ∪ missing` passé à `checkRelations`, rév. 2, B-6) ; `applyArchive` restaure ces lignes **sans
  blob** (en fusion, un blob local déjà présent est gardé) ; `verifyRestored` les ignore ; le bilan dit « N pages ne sont pas encore
  téléchargées sur cet appareil et ne sont pas dans l'archive. » Les archives d'avant portent une liste absente = vide (même tolérance que
  `MAGASINS_AJOUTES_APRES_V1`). `missing_files` n'entre **pas** dans `counts` : un client plus ancien refuse tout décompte de magasin inconnu
  (« Décompte de magasin inconnu », `inspectArchive`), et il doit rester capable de lire une archive neuve **sans** pages manquantes.
  Renversable : non (prérequis R18). Coût si faux : aucune archive possible depuis un appareil qui a reçu des lignes sans octets.
- **D-G8 (brief, précisée)** R56 : `identiques` sur `files` compare la **liste blanche des champs du serveur** `CHAMPS_FILES_SERVEUR = ['sha256',
  'mime', 'size', 'original_filename', 'remote', 'updated_at']` (déclarée dans `src/sync/tables.js`, à côté de `TABLES` — `updated_at` est déjà
  écarté par `identiques`) ; `blob`, `syncable`, `created_at` exclus. **Ce qui part est ce qui se compare** : `lots.js` envoie la même
  projection (`projectionFichier(row)`), jamais `blob` (contrainte `check (not (data ? 'blob'))` de `0001`). `decider` et `identiques`
  reçoivent la **table** pour appliquer cette projection (rév. 2, B-18/F-3). Les lignes `files` (métadonnées) entrent en file **oui**, par la
  capture (`outbox.js`), **seulement** quand `remote` est un objet valide **de ce compte** (`remoteDeCeCompte(remote, user_id)`) — c'est elle
  qui dit aux autres appareils où sont les octets — donc après la confirmation de ses octets, jamais avant ; **jamais une suppression**
  (`deletes` de `files` : aucune capture, rév. 2, S-5/F-23 — effacer des octets sur tous les appareils est un geste de L5) ; la retenue de
  `lots.js` (`fichier en attente`) reste comme filet pour une ligne sans `remote` de ce compte qui entrerait par un autre chemin ;
  `backfill:files` est posé par l'envoi initial, qui met en file les seules lignes à `remote` valide de ce compte. Contrôle contre R58 :
  « À envoyer : N » ne compte que des lignes dont les octets sont confirmés — chaque entrée part et le compteur redescend. Renversable : exclure
  `files` de la capture et le gérer dans la passe fichiers. Coût si faux : une ligne `files` en quarantaine pour `forme` si un champ hors liste
  se glisse dans la projection (le factice en mode `serveur` le dirait).
- **D-G9 (brief, précisée)** Client Storage **injecté** : `createStockage(client)` vit dans `src/sync/transport.js` (R53 : `auth.getClient()` ne
  sort que vers `app.js`, qui le passe à ce module), rend des erreurs de la forme `{ type, status, statusCode, code, message }` (classées par
  `classerErreur`, **plus** `statusCode` et `code` de `StorageApiError`, rév. 2, B-3), et c'est le moteur qui le reçoit (`createMoteur({ …,
  stockage })`). La suite n'appelle jamais le réseau : un Storage factice en mémoire (`tests/stockage-factice.js` : `envoyer`, `recevoir`,
  `lister`, déjà présent sous ses **deux formes** (`status 409` et `status 400 + statusCode '409'`), 413, 415, 404 sous ses deux formes,
  erreurs scriptées, journal) ; CSP `connect-src 'self' https:` couvre déjà l'hôte du projet. Renversable : un module `stockage.js` à part.
  Coût si faux : aucun.
- **D-G10 (brief)** Hors périmètre : purge et suppression serveur (L5) ; HEIC → JPEG **côté réception** ; vidéos ; PDF réduits (jamais) ;
  dédoublonnage multi-comptes ; téléchargement de la version originale quand une copie réduite est déjà ici (une « copie périmée » — blob
  d'une taille différente de `remote.size` après un renvoi en originale — reste `present`, comptée, § 11).
- **D-G11 (brief)** Versions : `APP_VERSION` +1 mineure sur la tête du lot précédent fusionné — le lot B portera `0.10.0`, donc G = **`0.11.0`** ;
  si G fusionne **avant** B, G prend `0.10.0` et B `0.11.0` (le second à fusionner rebase et prend le numéro suivant ; D-10 du lot A : fusions
  séquentielles, fichiers communs `sw.js`, `APP_VERSION`, `en.js`, `schema.js`, total épinglé). `sw.js` `VERSION` monotone
  (`cuisine-os-v0.11.0-N`, strictement au-dessus de la tête servie), **incrémentée à chaque tâche qui touche `src/`** (règle de `CLAUDE.md`),
  `SHELL` + `./src/sync/fichiers.js` **dès la tâche 1** (le module est atteignable depuis `app.js` dès qu'`outbox.js` ou `pull.js` l'importe ;
  rév. 2, F-5) ; `DB_VERSION` 4.
- **D-G12 (auteur, précisée en rév. 2)** Le champ `remote` **change de nature** : booléen `true` en L3 (R55 : « ligne reçue sans octets ») →
  **objet descripteur de la copie serveur** (D-G3). L'état « pas d'octets ici » n'est plus un drapeau, c'est `!(row.blob instanceof Blob)`.
  `pull.js` cesse d'écrire `remote: true` **et cesse d'effacer `remote` quand un blob local existe** : `ficheFichier` garde le `remote` tel que
  la ligne reçue le porte, blob local réécrit s'il existe (rév. 2, B-1/F-2 : avec le `delete fiche.remote` d'aujourd'hui, deux appareils qui
  ont le même original — l'iPhone rempli par l'archive du Mac — se renvoyaient la photo **à chaque passe, pour toujours**) ; `createArchive`
  et `verifyRestored` lisent la présence du blob ; une passe unique d'`init()` (`sync_state.files_remote_v2`, origine `device`, `updated_at`
  conservé) retire le booléen des lignes de L3 ; à la lecture, `remoteValide()` traite `true`, `null`, absent et toute forme invalide comme
  « aucune copie serveur connue », et `remoteDeCeCompte()` y range aussi un `remote` d'un autre compte (R-G-2). Renversable : un second nom de champ
  (`envoi`) — deux champs pour dire la même distance, refusé. Coût si
  faux : les assertions L3 amendées de § 7 (onze, nommées).
- **D-G13 (auteur, précisée)** Le téléchargement et l'espace serveur passent par le **moteur** (`moteur.telecharger`, `moteur.telechargerTout`,
  `moteur.actualiserEspace`, …) : l'interface n'a jamais le client ni le `stockage` (R53), et un appareil sans compte n'a rien à appeler. Le
  moteur tient **tous** ses vols (passe, téléchargements lancés par une tape, mesure d'espace) dans un ensemble : `arreter()` les attend tous,
  et après l'arrêt chaque API rend `{ erreur: { type: 'arrete' } }` sans appel ni écriture (rév. 2, B-9 : un téléchargement lancé par une tape
  n'était pas `vol`, et « Effacer les données » pouvait écrire une ligne dans une base vidée — la classe de défaut que m2 a fermée en L3).
  Renversable : un module d'interface qui reçoit le `stockage`. Coût si faux : aucun.
- **D-G14 (auteur)** La pastille « N non envoyés » **ne compte pas** les photos à envoyer : elle lit `outbox` (R52, R58) et les octets n'y sont
  jamais. Réglages porte le nombre, pas l'en-tête. **Tranché (R-G-3)** : défaut gardé. Renversable : additionner, un lot ultérieur. Coût si faux : un
  chiffre de plus dans la barre.
- **D-G15 (rév. 2, S-5/F-1 ; retranchée en rév. 3, N-4)** **Exception `files` à la règle des tombales** : une tombale `files` — reçue par
  `pull.js` (décision `supprimer` de `decider`) **ou** tranchée par « Garder celle d'ailleurs » (`garderAilleurs`, `serveur.deleted_at`,
  « Supprimer ici aussi ») — **ne supprime jamais un blob local, ni la ligne** : la ligne est réécrite par `fusionnerFichier(locale, { remote:
  null }, updated_at de la tombale)` (D-G16) — blob, `syncable`, `created_at` et métadonnées gardés, **`remote` passe à `null`** —, origine
  `remote` (rien ne repart : la capture n'entre qu'avec un `remote` de ce compte, D-G8), journalisée à la réception
  (`logError('sync.pull.tombale_files')`), comptée dans `recues` et jamais dans `supprimees`, le curseur avance ; sans ligne locale, rien
  (`decider` rend déjà `ignorer`) ; une tombale plus ancienne que la ligne locale suit I7 comme en L3 (`conflit_renvoyer`). Et **aucune
  suppression locale de `files` n'est capturée** (D-G8). Raison : les octets sont **adressés par contenu** et **référencés par d'autres fiches**
  (`source_pages`, `source_documents`, `book_editions`, `recipes`, `imports`) : une suppression côté serveur dit « cette copie serveur n'existe
  plus », jamais « efface l'original de l'appareil » — or `files` entre dans `SYNCHRONISEES`, et le chemin générique de `pull.js`
  (`deletes[table]`) comme celui de `garderAilleurs` (`deletes[conflit.store]`) retireraient la ligne **et le Blob** : l'appareil qui a pris la
  photo perdrait sa seule copie sur un `sync_purge('files', sha)` joué dans l'éditeur SQL (R12, préparation de L5). La rév. 2 ignorait la
  tombale (ligne intacte, `remote` gardé) : la ligne restait `distant` sur un objet qui n'existe plus → « Télécharger » → 404 →
  `file_error introuvable` ; avec `remote: null`, elle devient `absent` ou `present`, et l'appareil qui a l'original la renvoie
  (`candidatsEnvoi`). Renversable : L5 définit le vrai sort d'une tombale `files` (retrait des octets locaux sur geste, jamais sur réception).
  **Coût si faux : un fichier purgé côté serveur (L5 à venir) remonte au prochain envoi tant qu'une fiche le référence** (original ici,
  `remote` nul → candidat) — à régler en L5 (§ 11). `derniersEffets.fichiersRecus` reste toujours présent (forme d'état fixe, § 3.6 ; une
  tombale ne le touche pas).
- **D-G16 (rév. 2, B-2/F-1 — I-G10 renforcé)** **Une seule règle de fusion** pour toute écriture d'une ligne `files` depuis une copie serveur :
  `fusionnerFichier(locale, data, updated_at)` (`src/sync/fichiers.js`, pure) = `{ ...metaLocale sans blob, ...data, updated_at }` + blob
  local s'il existe ; `remote` est celui de `data` (ni effacé, ni `true`) ; `syncable` et `created_at` locaux survivent. Relue par
  `ficheFichier` (réception), par `appliquerReponse` pour un `adjusted` sur `files` (`reecrire`), par `garderAilleurs` sur un conflit `files`
  et, avec `data = { remote: null }` et l'`updated_at` de la tombale, par la **tombale `files`** — réception (décision `supprimer`) comme
  « Garder celle d'ailleurs » (`serveur.deleted_at`) (D-G15, N-4).
  Raison : `appliquerReponse` écrit `{ ...element.data, updated_at }` et `garderAilleurs` `{ ...serveur.data, updated_at }` ; pour `files`,
  `data` est la projection sans blob : un `put` IndexedDB **remplaçait** la ligne et effaçait le blob local — en Réduite, l'original n'existe
  nulle part ailleurs. `adjusted` arrive dès qu'un `updated_at` dépasse `now() + 5 min` au serveur (horloge en avance avant la première
  mesure) ; un conflit `files` dès que deux appareils confirment la même clé à instant égal avec un `remote` différent. Le factice en mode
  `serveur` n'émet jamais `adjusted` : ces chemins sont éprouvés par un `pousser` scripté (§ 7). Renversable : non. Coût si faux : aucun.

## 1. Pour toi

Tu photographies une recette sur l'iPhone ; sur le Mac, la fiche montre déjà le texte et dit « 3 pages ne sont pas encore sur cet appareil »
avec **Télécharger** : une tape, et les pages sont là. Dans Réglages, « Photos à envoyer » descend à mesure que l'iPhone envoie, « Tes photos
sur le serveur » dit ce que tu y occupes (Mo et nombre de fichiers — une mesure, pas un plafond : l'app ne connaît pas le plan du projet), et
« Télécharger toutes les pages » fait venir d'un coup ce qui manque ici.
Par défaut les photos partent **réduites** (environ 400 Ko, 2 000 px — lisibles, légères, sans les métadonnées de l'appareil) et l'original
reste sur l'appareil qui l'a prise ; tu peux choisir « Originale » par appareil, et renvoyer en originale ce qui est déjà parti. Une archive
ZIP dit franchement combien de pages lui manquent et combien sont des copies du serveur. Rien n'est annoncé « envoyé » avant que le serveur
l'ait confirmé.

## 2. Invariants

- **I-G1 Porte unique.** Toute écriture passe par `db.mutate` : origine `local` pour ce que la personne décide (et pour la confirmation d'un
  envoi, qui doit partir au compte), `remote` pour ce qui vient du serveur (octets téléchargés, lignes reçues, ajustements, « Garder celle
  d'ailleurs »), `device` pour l'état de l'appareil (`sync_state`, passes uniques). `MUTATING_METHODS` (`tests/sync.js`) est inchangé.
- **I-G2 Rien n'est « envoyé » sans confirmation** (I5 de la spec parente) : `remote` n'est posé qu'après un `upload` accepté ou un « déjà
  présent » vérifié par la taille ; une ligne `files` n'entre en file qu'avec `remote` de ce compte ; « Photos à envoyer » compte ce qui n'a
  pas de `remote` valide de ce compte et dont l'original est ici.
- **I-G3 L'original ne quitte jamais l'appareil qui l'a pris** autrement que par la qualité « Originale » choisie ; en « Réduite », ce qui part
  est une copie JPEG ; **toute écriture d'une ligne `files` venue du serveur — réception, tombale, ajustement, conflit — préserve `blob`,
  `syncable` et `created_at`** (D-G15, D-G16 ; une tombale ne touche que `remote`, qu'elle met à `null`) ; **un original local n'est jamais
  remplacé** — ni par le serveur, ni par une archive restaurée, en fusion comme en remplacement (R-G-6, § 3.4 `octetsRestaures`) ; le seul blob
  local qu'une écriture remplace est une **copie**, et seulement par une archive (par l'original qu'elle porte — R-G-6 —, ou par une autre copie,
  comme avant) ; le serveur, lui, ne réécrit jamais un blob local, original ou copie (rév. 3 : « rien n'est jamais réécrit dans le blob local d'une
  ligne qui en a un » visait ce chemin-là ; l'archive est dite ici depuis la rév. 4).
- **I-G4 Aucune détection de réseau.** Un envoi ou un téléchargement est tenté quand un déclencheur l'appelle (passe, tape) ; l'échec est classé
  et dit ; `navigator.onLine` n'est lu nulle part dans ce lot.
- **I-G5 Le jeton et le client ne traversent pas l'interface** (R53) : seuls `app.js` (qui le passe), `transport.js` et le moteur les voient ;
  l'état du moteur ne porte ni jeton, ni URL, ni message brut du fournisseur (`logError` garde code et statut).
- **I-G6 Aucune URL publique** : seau privé, `download` authentifié ; `getPublicUrl`, `createSignedUrl` et `.remove(` du stockage ne sont
  appelés nulle part (test de source borné à `src/sync/transport.js`, seul module qui tient `client.storage`, § 7).
- **I-G7 Ce qui s'écrit après un téléchargement est vérifié** contre `remote` (type dans la liste blanche, taille, empreinte) ; un écart
  n'écrit rien et se dit.
- **I-G8 Les textes passent par `t()`** avec une entrée `en.js` chacun ; aucun texte ne nomme le fournisseur de stockage ; une ligne de
  Réglages nomme un fichier par ce qu'il est pour la personne (page, couverture, photo du plat), jamais par son empreinte seule (§ 4.1 item 6).
- **I-G9 Les tests de L2-L3 restent verts**, à **onze assertions amendées** près, nommées en § 7 (« Assertions L3 amendées ») — aucune
  supprimée, aucune autre ; la suite est épinglée N-1 (`tests/tests.js`), relevée à chaque tâche.
- **I-G10 Une seule définition** de « fichier référencé » (`referencesFichiers`), de « ligne à envoyer » (`candidatsEnvoi`), de la projection
  serveur (`projectionFichier`), de la validité de `remote` (`remoteValide`, `remoteDeCeCompte`), de la fusion d'une ligne venue du serveur
  (`fusionnerFichier`), de l'écriture d'octets reçus (`fusionnerOctetsRecus`) et de la garde de relecture (`peutEcrireRemote`,
  `peutEcrireOctets`, § 4.7 f et § 4.8) — relues par la passe, la capture, les lots, la réception,
  les ajustements, les conflits, l'archive, `repo.putFile` et Réglages.

## 3. Données

### 3.1 La ligne `files` (magasin inchangé, `keyPath: 'sha256'`)

```
{ sha256,                       // clé : empreinte des OCTETS ORIGINAUX (ceux de l'appareil qui a pris la photo)
  mime, size,                   // type et taille de l'original (colonnes générées `mime`, `size` de public.files : TABLES.files)
  original_filename,            // champ serveur (nettoyé par nettoyerChaines à l'écriture : R61)
  created_at, updated_at,
  syncable,                     // LOCAL : résolu par resolveMime ; faux = jamais envoyé (R-L3-22 inchangé)
  blob,                         // LOCAL : l'original ici, OU la copie du serveur téléchargée ici, OU absent
  remote: null | {              // SERVEUR : la copie qui est au serveur, posée par l'appareil qui a envoyé, reçue par les autres
    sha256,                     // empreinte des octets envoyés (= clé si l'original est parti tel quel)
    size, mime,                 // taille et type des octets envoyés (image/jpeg après réduction)
    quality: 'reduite' | 'originale',   // FAIT : 'originale' ssi remote.sha256 === sha256 (D-G3)
    uploaded_at,                // syncNow() au moment de la confirmation ; informatif, jamais interprété ni affiché
    owner } }                   // auth.uid() de l'appareil qui a envoyé : le dossier où sont les octets
```

- **Champs serveur** (`CHAMPS_FILES_SERVEUR`, `src/sync/tables.js`) : `sha256, mime, size, original_filename, remote, updated_at`.
  `projectionFichier(row)` (même module, pure) ne rend que ceux-là, `remote` tel quel s'il est valide, `null` sinon (absent, `true`, forme
  invalide). C'est ce que `lots.js` envoie et ce que `identiques` compare (D-G8). La projection **ne regarde pas `owner`** : un `remote` d'un
  autre compte se compare et se renvoie tel quel (sinon l'écho d'une ligne reçue ferait un conflit : ses deux côtés doivent se lire pareil) ;
  c'est la capture, l'envoi initial et `candidatsEnvoi` qui ne retiennent que les `remote` de ce compte.
- **`remoteValide(remote)`** (`src/sync/tables.js`, pure — posée là parce que `projectionFichier` en dépend et que `tables.js` est lu sous Node
  par `tools/generer-migrations.mjs` ; réexportée par `fichiers.js`) : objet nu (prototype `Object.prototype` ou `null`, pas un tableau), lu par
  `Object.hasOwn` ; `sha256` qui passe `/^[a-f0-9]{64}$/` ; `size` entier sûr de 1 à 52 428 800 ; `mime` ∈ `ALLOWED_MIME` ; `quality` ∈
  `['reduite', 'originale']` ; `uploaded_at` chaîne ; `owner` chaîne non vide ≤ 64. **Un champ supplémentaire est ignoré, pas refusé** (une
  version future qui enrichit `remote` ne doit pas faire renvoyer chaque photo entre versions) ; `uploaded_at` n'est jamais interprété ni
  affiché. Tout autre cas (dont le booléen `true` de L3) → faux. Une ligne reçue du serveur est une donnée hostile : rien n'est téléchargé sur
  un `remote` invalide. **`remoteDeCeCompte(remote, uid)`** (même module) = `remoteValide(remote) && typeof uid === 'string' && remote.owner
  === uid`.
- **`estOriginalIci(row)`** (pure, `fichiers.js`) : `row.blob instanceof Blob && row.blob.size === row.size` — sans hachage, et **sans** la
  disjonction `remote.sha256 === sha256` de la rév. 1 (vraie sur une copie réduite après un renvoi en originale ailleurs, S-3). Limite dite :
  une copie dont la taille égalerait exactement celle de l'original passerait pour lui (§ 11).
- **`copiePerimee(row)`** (pure) : `row.blob instanceof Blob && !estOriginalIci(row) && remoteValide(row.remote) && row.blob.size !==
  row.remote.size` — le blob d'ici n'est ni l'original ni la copie que le serveur porte aujourd'hui (renvoi en originale fait ailleurs,
  § 10 geste 6). État `present` (D-G10 : on ne retélécharge pas), compté par `compter()` et dit en Réglages (§ 4.1 item 8).
- **Quatre états, lus par l'interface** (`etatFichier(row, { connecte, uid, erreurs })`, pure, `fichiers.js` ; `erreurs` = ensemble des
  `sha256` qui ont une clé `file_error`, lu en base par l'appelant) : `erreur` (clé `file_error:<sha256>` présente) · `present` (blob) ·
  `distant` (pas de blob, `remoteDeCeCompte(remote, uid)` : téléchargeable si `connecte`) · `absent` (pas de blob, et pas de `remote` valide de
  ce compte — l'appareil qui l'a pris n'a pas encore envoyé, la ligne n'est pas encore reçue, **ou** les octets sont dans le dossier d'un autre
  compte — R-G-2 : un `remote` d'un autre compte vaut « aucune copie serveur connue » ; c'est l'appareil qui a l'original qui les renverra sous
  ce compte, D-G4). `erreur` prime (une clé posée est un fait qu'un geste
  retire). `nomFichier(sha256, snapshot)` (pure) rend le nom que la personne reconnaît, par l'inverse de `referencesFichiers` : « Page {p} ·
  {livre} » ou « page non numérotée · {livre} » (`source_pages` → `source_documents.edition_id` → `book_editions.book_id` → `books.title` ;
  sans livre : « Page {p} »), `original_filename` (`source_documents`), « Couverture · {livre} » (`book_editions.cover_sha256`), « Photo du plat
  · {titre} » (`recipes.photo_sha256`, titre de la version courante), « Photo importée · {date} » (`imports.photo_sha256`, `created_at` de
  l'import) ; repli : l'empreinte tronquée à 12.
- **Affichage** (règle unique, `displayUrl` de `mime.js`, `bookCover` et `pdfFrame` la suivent) : `type = safeDisplayType(blob.type) ??
  safeDisplayType(row.mime)` ; sans type → rien n'est affiché. Le **type du blob, dans la liste, gagne** : une copie JPEG téléchargée sous une
  ligne `image/heic` doit s'afficher `image/jpeg` sur Chrome ; un blob `text/html` sous une ligne `image/jpeg` reste retypé `image/jpeg` (S3
  du lot UX tenu : jamais un type hors liste). Changement réel par rapport à L2 (`safeDisplayType(fileRow?.mime)` seul), nommé ici (F-9).
- **`putFile(sha256, blob, meta)`** : inchangé pour une ligne sans blob et sans métadonnées serveur (cas d'aujourd'hui), à une chose près :
  `rest` (les métadonnées) passe par `nettoyerChaines` (un `original_filename` à caractère de contrôle faisait un conflit perpétuel dès que la
  ligne part, classe R61 ; B-27). **Amendé** : avec `origin: 'remote'` sur une ligne existante, la ligne écrite est
  **`fusionnerOctetsRecus(existing, blob)`** (`fichiers.js`, pure : `{ ...existing, blob, syncable: isAllowed(existing.mime) }` — ni `size`,
  ni `mime`, ni `updated_at` ne bougent, sinon la ligne locale divergerait de la copie serveur et chaque écho ferait un conflit). C'est la même
  fonction que le moteur appelle avant son `db.mutate` d'origine `remote` (les modules de `src/sync/` n'importent pas `repo` ; une règle, deux
  appelants : F-20).
- **Passe unique `convertirRemoteBooleen()`** dans `repo.init()`, après `purgerFilesEnFile()` : garde `sync_state.files_remote_v2 = 1` écrite
  dans la même transaction ; toute ligne `files` dont `remote === true` est réécrite sans ce champ, `updated_at` conservé, origine `device`
  (rien en file : ce n'est pas un geste de la personne). Une bibliothèque saine n'écrit rien.
- **Contrainte Node** : `src/sync/fichiers.js` et tout ce qu'il importe n'ont **aucun global navigateur au niveau module** (`createImageBitmap`,
  `OffscreenCanvas`, `document` restent dans des fonctions) ; un test Node `tools/fichiers-node.test.mjs` l'importe et appelle `remoteValide`
  (F-12).

### 3.2 `sync_state` (clés neuves, toutes d'origine `device`, toutes vidées par `clearDevice()`)

| Clé | Valeur | Sens |
|---|---|---|
| `file_error:<sha256>` | `{ motif, sens: 'envoi' \| 'reception', at }` | fichier refusé ou illisible ; plus retenté avant « Réessayer » (motifs § 4.10) ; **retirée à la réception d'une ligne `files` dont `remote` change** (F-7) ; la clé n'est posée que si `HASH.test(sha256)` (une clé de ligne venue du serveur sans forme hexadécimale ne devient jamais une clé `sync_state` : motif `forme` journalisé sans clé, S-13) |
| `pause_fichiers` | `{ raison: 'stockage', at }` | seau plein (413, 507, « exceeded ») : **la passe fichiers seule** est suspendue — envoi et téléchargement global —, les fiches continuent de partir ; levée par « Envoyer maintenant » (qui lève aussi `pause`) |
| `storage_usage` | `{ octets, objets, at, tronque }` | dernière mesure du dossier de ce compte (D-G6) |
| `telecharger_tout` | `{ at }` | « Télécharger toutes les pages » demandé ; retiré quand plus rien ne manque ou sur « Arrêter » |
| `renvoi_originale` | `{ at }` | « Renvoyer en originale » demandé ; retiré quand plus aucune candidate |
| `files_remote_v2` | `1` | passe unique D-G12 faite |
| `backfill:files` | `'fait'` | marqueur de l'envoi initial, désormais posé (D-G8) |

### 3.3 Réglage `settings.upload_quality`

`'reduite'` (défaut, `DEFAULT_SETTINGS` de `repo.js`) ou `'originale'` ; écrit par `repo.setSetting` ; jamais synchronisé (`settings`) ; relu
par `state.js` dans sa copie `reglages` et exposé comme **fonction** `qualiteEnvoi = () => reglages.upload_quality === 'originale' ? 'originale'
: 'reduite'` (à côté d'`isActivitySynced`, même forme) ; `app.js` la passe au moteur (`qualite: qualiteEnvoi`), qui la passe à la passe
fichiers, **qui l'appelle à chaque fichier** (le réglage peut changer pendant une passe ; B-16). Changer le réglage ne renvoie rien de ce qui
est déjà parti (D-G4).

### 3.4 Archive (format 1, champs additifs ; `ARCHIVE_FORMAT_VERSION` inchangée)

Manifeste `files[]`, entrée : `{ path, sha256, size, mime, bytes_sha256?, bytes_size?, bytes_mime?, remote? }`.
- `sha256`, `size`, `mime` = **la ligne** (clé, taille et type de l'original : ce que le serveur connaît). Aujourd'hui `size` est la longueur
  des octets archivés ; les deux coïncident pour un original, et c'est le seul cas qui existait.
- `bytes_sha256`, `bytes_size`, `bytes_mime` présents **ensemble**, et **dès que les octets archivés ne sont pas l'original** (`h =
  sha256Hex(blob) !== row.sha256`), **quel que soit `remote`** : ils décrivent ce qui est dans le ZIP, et l'archive est auto-cohérente par
  eux seuls. Aucun lien exigé entre `bytes_sha256` et `remote.sha256` (S-1 : l'exiger rendait l'archive **impossible** sur B après un
  « Renvoyer en originale » sur A — B garde la copie réduite h1 et reçoit `remote` R2 ≠ h1 —, après une restauration en remplacement ailleurs
  (`remote` redevenu `null`), ou après « Garder celle d'ailleurs » ; une sauvegarde bloquée par une ligne est la perte de durabilité que D-G7
  voulait éviter).
- `remote` : copie de `row.remote` quand il est valide, absent sinon (il voyage pour que la restauration sache où sont les octets ;
  informatif à l'inspection). Il porte `owner`, l'identifiant technique du compte (un uuid, pas un secret) : `README_TXT` le dit (S-9).
- `path` = `files/<sha256>.<extFor(bytes_mime ?? mime)>` ; le contrôle de chemin d'`inspectArchive` (« Chemin de fichier invalide ») suit cette
  règle.
Manifeste `missing_files[]` (D-G7) : `{ sha256, mime, size, remote? }` par ligne **sans blob** ; une empreinte ne peut pas être à la fois dans
`files` et dans `missing_files` (refus « Empreinte de fichier répétée »). Absent dans une archive ancienne = `[]`.

Ce que chaque fonction fait :
- `createArchive` : pour chaque ligne `files` du snapshot — sans blob → `missing_files` (quelle que soit la valeur de `remote` : D-G12) ; avec
  blob → `h = sha256Hex(octets)` ; `h === row.sha256` → entrée comme aujourd'hui (+ `remote` si valide) ; `h !== row.sha256` → entrée avec
  `bytes_*` (+ `remote` si valide), **jamais une levée** : « Fichier source endommagé » disparaît de `createArchive` (l'inspection le dit encore
  pour un ZIP abîmé). Rend `missingFiles` (déjà rendu), `filesBytes` (octets archivés) et **`copies = { serveur, inconnues }`** : `serveur` =
  entrées à `bytes_*` dont `bytes_sha256 === remote?.sha256` ; `inconnues` = les autres (ni l'original, ni la copie serveur connue : octets
  abîmés ou copie périmée) — archivées telles quelles, dites dans le bilan (§ 4.6).
- `inspectArchive` : valide chaque entrée (`HASH`, `validCount`, `validKey` ; `bytes_sha256` par `HASH`, `bytes_size` par `validCount`,
  `bytes_mime` par `validKey`, les trois ensemble ou aucun ; `remote` par `remoteValide` s'il est présent — un `remote` **invalide** refuse :
  « Description de fichier invalide ») ; vérifie l'entrée ZIP contre `bytes_sha256 ?? sha256` et `bytes_size ?? size` ; valide chaque entrée de
  `missing_files` (`HASH`, `validKey(mime)`, `validCount(size)`, `remote` absent ou valide, aucune empreinte commune avec `files`) ; les
  empreintes de `missing_files` entrent dans l'ensemble passé à `checkRelations` ; `summary` gagne `files_distants` (= `missing_files.length`)
  et `files_copies` (= entrées à `bytes_*`) ; `payload.missing = [{ sha256, mime, size, remote? }]`, `payload.files[i]` porte `{ sha256, bytes,
  mime, size, bytes_sha256?, bytes_size?, bytes_mime?, remote? }`.
- `requireInspection` : revalide `payload.files` avec **`(bytes_size ?? size) === bytes.length`** (la comparaison actuelle `size !==
  bytes.length` refuserait chaque copie, F-8) et `bytes_sha256 ?? sha256` par `HASH` ; revalide `payload.missing` (mêmes règles qu'à
  l'inspection, aucune empreinte commune) ; passe **`files ∪ missing`** à `checkRelations` (sinon toute archive dont une `source_page` pointe
  une page manquante est acceptée à l'inspection et refusée à l'application, B-6).
- **`octetsRestaures(entry, ligne)`** (`backup.js`, pure, **nommée une fois** et relue par `applyArchive` et par `verifyRestored` — le gabarit de
  `ficheRestauree`, R61 : le bilan compare la base à ce que la restauration a **promis**, jamais à l'archive brute ; rév. 4, R-G-6, constat C-1) :
  `entreeOriginale = (entry.bytes_sha256 ?? entry.sha256) === entry.sha256` (une entrée sans `bytes_*` ; `createArchive` n'écrit jamais
  `bytes_sha256 === sha256`, la forme est tolérée) ; `originalIci = ligne?.blob instanceof Blob && estOriginalIci(ligne)` (`src/sync/fichiers.js`,
  § 3.1 : `blob.size === size`, sans hachage — `backup.js` importe déjà `src/sync/` : `lots.js`, `clock.js`) ; **`garder = originalIci &&
  !entreeOriginale`** — **un blob local original n'est jamais remplacé par une copie venue d'une archive**, ni en fusion ni en remplacement ;
  symétriquement, une copie locale (`!originalIci`) est remplacée par ce que l'archive porte : l'original (`entreeOriginale`) ou une autre copie
  (comme avant). Rend `{ garder, blob, attendu }` : `garder` → `blob = ligne.blob`, `attendu = { sha256: entry.sha256, size: entry.size }` ;
  sinon `blob = new Blob([entry.bytes], { type: entry.bytes_mime ?? entry.mime })`, `attendu = { sha256: entry.bytes_sha256 ?? entry.sha256,
  size: entry.bytes_size ?? entry.size }`. Coût si faux : une archive ne peut plus servir à dégrader volontairement un original (personne ne le
  demande) ; la limite de `estOriginalIci` par la taille (§ 11) vaut ici aussi.
- `applyArchive` : `existingFiles` lue **dans les deux modes** (aujourd'hui `new Map()` en remplacement : sans la ligne locale, l'original ne
  peut ni être reconnu ni survivre à `clearStores` — il ne survit que porté dans le `batch`) ; pour chaque entrée, `o = octetsRestaures(entry,
  existing)` ; ligne restaurée avec octets = `{ ...existing, sha256, blob: o.blob, mime, size, remote: entry.remote ?? existing?.remote ?? null,
  created_at }` en fusion — **`remote` et les métadonnées toujours pris de l'archive, le blob selon `garder`** (même règle que `missing_files` :
  seuls `mime`, `size`, `remote` et `created_at` sont écrits quand l'original est gardé) ; en remplacement, la ligne locale ne sert qu'à
  `octetsRestaures` (le blob gardé) : ni `...existing`, ni `existing.remote` (`remote: entry.remote ?? null`), ni `existing.created_at` — tout le
  reste comme aujourd'hui ; ligne de `missing_files` = `{ ...existing, sha256, mime, size, remote: entry.remote ?? existing?.remote ?? null }`
  **sans toucher au blob local s'il existe** (fusion) ; `normaliserFiches` horodate comme pour tout magasin synchronisé. Rend les décomptes par
  magasin (forme inchangée, qu'aucun appelant ne lit) **plus `originauxConserves`** (nombre d'entrées à `garder`), lu par `appliquerArchive`
  (`settings.js`) pour le bilan (§ 4.6). En remplacement, `clearStores` vide `files` puis réécrit : les octets locaux des pages de `missing_files`
  et des pages absentes de l'archive sont retirés, et le bilan le dit (§ 4.6) ; les originaux des pages **présentes** dans l'archive survivent
  (R-G-6).
- `verifyRestored` : `comparableFiles = snapshot.files.filter((row) => row.blob instanceof Blob)` ; en remplacement
  `comparableFiles.length === payload.files.length` ; pour chaque entrée, `row = filesBySha.get(sha256)` et **`{ attendu } =
  octetsRestaures(entry, row)`** sur la ligne telle qu'elle est après la restauration — même décision qu'à l'application : un original gardé
  est encore un original (`row.blob.size === row.size`), une copie écrite ne l'est pas (`bytes_size !== size`, limite § 11) — ; contrôles
  `row.size === size`, `row.mime === mime`, `row.blob.size === attendu.size`, `sha256Hex(row.blob) === attendu.sha256` — **jamais
  `bytes_sha256 ?? sha256` en brut** (rév. 3 : une implémentation prudente qui gardait l'original lisait « Empreinte différente » et un bilan
  rouge, C-1) ; **`remote` comparé seulement si l'entrée en
  porte un** (`entry.remote !== undefined` → `canonical(row.remote ?? null) === canonical(entry.remote)`) : une entrée sans `remote` ne
  contraint rien, parce qu'en fusion `applyArchive` garde le `remote` de la ligne locale (`entry.remote ?? existing?.remote ?? null`) et
  qu'une comparaison inconditionnelle (`canonical(row.remote ?? null) === canonical(remote ?? null)`, rév. 2) annonçait « contenu différent »
  pour chaque page envoyée depuis cet appareil et restaurée depuis une archive faite avant son envoi (rév. 3, N-1) ; **même règle pour chaque
  entrée de `missing_files`** : la ligne existe (blob indifférent), `remote` égal seulement si l'entrée en porte un.
- `compterFichesSynchronisees` : pour `files`, `payload.files.length + payload.missing.length` — les lignes de `missing_files` à `remote`
  repartent aussi (`putBatch` d'origine `local` → capture D-G8) ; le nombre annoncé avant la restauration était faux de `missing.length`
  (B-25).
Un client **plus ancien** qui lit une archive neuve : sans pages manquantes ni copies, il la lit telle quelle (champs inconnus ignorés) ; avec,
il la refuse (« introuvable » ou « endommagé ») — le README le dit déjà (« mets l'app à jour »).

### 3.5 Fichiers référencés (`referencesFichiers(snapshot)`, pure)

Ensemble des `sha256` lus dans `source_pages[].sha256`, `source_documents[].sha256`, `book_editions[].cover_sha256`, `recipes[].photo_sha256`,
`imports[].photo_sha256` (valeurs qui passent `HASH` seulement). Une ligne `files` hors de cet ensemble est un orphelin : ni envoyée, ni
comptée, ni effacée (D-G1). Le snapshot est pris par `db.getSnapshot([...ces cinq magasins, 'files', 'books', 'book_editions'])` **une fois
par passe** et réutilisé par `envoyer`, `telechargerTout` et `compter()` (S-12 : deux lectures de toutes les lignes `files` par passe, blobs
compris, sur iPhone — coût mesuré en § 10, nommé en § 11).

### 3.6 État du moteur (`AU_REPOS`, `moteur.js`) — clés neuves, **toujours présentes** (au repos, à leur valeur de repos), figées par
`instantane()`

```
fichiers: { aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0 },
progressionFichiers: null | { sens: 'envoi' | 'reception', n, total },      // pendant la passe seulement
espaceServeur: null | { octets, objets, at, tronque },                        // dernière mesure (sync_state)
telechargementGlobal: false,                                                   // sync_state.telecharger_tout présent
pauseFichiers: null | { raison: 'stockage', at },                              // sync_state.pause_fichiers (distinct de pause)
```
`derniersEffets` gagne **toujours** `fichiersRecus: 0` (forme d'état fixe, confirmée par N-4 : les deux assertions L3 qui le comparent exactement
sont amendées, § 7 ; une tombale `files` ne le touche pas, compte dans `recues` et jamais dans `supprimees`, D-G15).
`phase` gagne la valeur `'fichiers'`. `charger()` lit `storage_usage`, `telecharger_tout`, `pause_fichiers` et compte ; la fin de passe
recompte.

## 4. Parcours

### 4.1 Réglages → Synchronisation (ensemble L4, après l'ensemble L3, avant « Historique de consultation »)

Rendu par `syncSectionL4(model, gestes)` (export de `settings.js`, comme `syncSectionL3`), seulement si `connectee && moteur`. Lignes et gestes,
dans cet ordre, textes exacts :
1. « Photos à envoyer : {n} » (toujours) ; pendant un envoi : « Envoi des photos : {n}/{m} » (progression `sens: 'envoi'`) ; si
   `pauseFichiers` : « Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir. »
   (`card warn` ; R-G-5 : aucun chiffre de plan) — « Envoyer maintenant » (L3) lève `pause` **et** `pause_fichiers`.
2. « Pages à télécharger : {n} (~{m} Mo) » si `n > 0` (m = Σ `remote.size`, arrondi au dixième) ; bouton **« Télécharger toutes les pages
   ({n} fichiers, ~{m} Mo) »** → `gestes.telechargerTout` ; pendant : « Téléchargement des pages : {n}/{m} » et le bouton devient **« Arrêter le
   téléchargement »** → `gestes.arreterTelechargement`.
3. « Tes photos sur le serveur : {x} Mo ({n} fichiers) » (x = `octets` en Mo arrondi au dixième, n = `objets`), ou « Espace serveur : pas encore
   mesuré. » ; `tronque` → « au moins {x} Mo ({n} fichiers) » ; bouton **« Actualiser »** → `gestes.actualiserEspace`. **Rien d'autre** (R-G-5) :
   ni `<progress>`, ni seuil, ni mention d'un plan, d'un gigaoctet ou d'un prix — l'app ne connaît pas le plan du projet (`mitsu` est sur une
   organisation Pro, R33), elle dit ce qu'elle mesure.
4. `el('div', { class: 'field' }, el('span', null, t('Qualité d’envoi des photos')), segmented([{ value: 'reduite', label: t('Réduite (≈ 400 Ko,
   2 000 px)') }, { value: 'originale', label: t('Originale') }], qualite, …), el('small', null, hint))` — la forme de `segmented` est
   `(options: [{ value, label }], value, onChange)` (F-19) ; **pas `field()`**, qui rend un `<label>` : R-UX-8 exige que le `segmented` soit hors
   d'un label (même habillage `.field` par un `div`, comme les puces de `book.js` ; le même défaut existe sur les trois segments de
   « Préférences », hors lot, nommé par la refonte visuelle) (B-15). Hint : « L’original reste toujours sur l’appareil qui a pris la photo.
   Réduite : JPEG de 2 000 px au plus, environ 400 Ko par page, métadonnées retirées. Originale : le fichier tel quel, avec ses métadonnées
   (dont la position GPS si la photo en porte). » (S-9). La bascule écrit `repo.setSetting('upload_quality', v)` puis `refresh()`.
5. Si `upload_quality === 'originale'` et `n > 0` : bouton **« Renvoyer en originale les {n} photos de cet appareil envoyées en réduite »** →
   `gestes.renvoyerOriginale` (n = candidates `estOriginalIci(row) && remoteDeCeCompte(row.remote, uid) && row.remote.sha256 !== row.sha256`,
   compté par `compter()` ; un fichier parti tel quel n'est pas compté ni renvoyé, B-21).
6. « Fichiers refusés : {n} » si `n > 0`, puis une ligne par entrée `file_error` d'une ligne **référencée** : « {nomFichier} — {motif en phrase} »
   avec **« Réessayer »** → `gestes.reessayerFichier(sha256)` (retire la clé, puis une passe ou un téléchargement selon `sens`) — **sauf** motif
   `trop_gros` : pas de bouton (§ 4.10).
7. « {n} fichier(s) de type inconnu ne seront pas synchronisés. » si `typeInconnu > 0` (référencés et `syncable: false`).
8. « {n} copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra. » si `copiesSansServeur > 0`
   (blob présent, pas l'original, pas de `remote` valide de ce compte — restauration en remplacement ailleurs, S-3) ; « {n} photo(s) ici sont
   une copie plus ancienne que celle du serveur. » si `copiesPerimees > 0` (§ 3.1 ; D-G10 : pas de retéléchargement).
`SYNC_L4_ACTIONS = ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerOriginale', 'reessayerFichier']` ;
`gestesL4Pour({ db, obtenirMoteur, dire, rafraichir, journaliser })` protège chaque geste comme `gestesL3Pour` (« Ce geste n’a pas abouti. »).
`syncSectionModel` reçoit `fichiersErreurs` (lues en base au rendu, comme la quarantaine), `qualite` et `snapshot` (pour `nomFichier`), et
rend `fichiers`, `espace`, `qualite`, `erreursFichiers` dans la même forme que `quarantaine`. Sans moteur, le modèle reste exactement celui de
L3 (pas une clé de plus). `renderSettings(params, query, ctx, { fetch, createArchive = createArchiveReel })` : l'injection de `createArchive`
sert le test du bilan (F-15). « Effacer les données de cet appareil » et « Changer de compte » arrêtent déjà le moteur (R52) : `arreter()`
attend **tous** les vols (passe, téléchargements par tape, mesure) et rien n'est écrit après (D-G13) ; **un envoi ou un téléchargement en cours
n'est pas annulable** (`upload()` et `download()` de storage-js 2.117.3 ne prennent pas de signal ; `stop()` n'est relu qu'entre deux
fichiers) : les deux gestes affichent le toast « Envoi en cours… » tant que `progressionFichiers` est non nul (S-11/F-24 ; § 11).

### 4.2 Fiche du livre (`src/ui/book.js`) — couverture

`fichierCouverture` est lu comme aujourd'hui. `etatCouv.message` et la zone (`renderZoneCouverture`, `livre-ajout.js`) reçoivent `etatFichier` :
- `present` : inchangé.
- `distant` + compte : « La couverture n’est pas sur cet appareil. » (texte existant) + bouton **« Télécharger »** → `moteur.telecharger([sha])`
  → pendant : bouton éteint, « Téléchargement… » ; succès : `invalidate()` + `refresh()` ; échec : toast « Le téléchargement n’a pas abouti. »
  et, si `file_error`, « Fichier illisible reçu du serveur. » + « Réessayer ».
- `distant` sans compte : « La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger. »
- `absent` : « La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée. »
Les vignettes de **Mes livres** (`library.js`, `bookCover`) restent muettes sans image (§ 6 du lot UX) : aucun bouton dans la grille.

### 4.3 Séance de scan (`src/ui/import.js`, `sessionView`) et fiche du livre (« Pages et fichiers sources »)

Chaque miniature est rendue par `vignettePage(page, fichier, { connecte, uid, erreurs, telecharger })` (neuf, `components.js`) : avec blob →
`<img>` comme aujourd'hui (`displayUrl`) ; sinon un `figure.fichier-absent` (même gabarit 110 × 140 que `.thumbs img`) qui dit l'état :
« Pas encore sur cet appareil » + **« Télécharger »** (`distant`, compte) · « Connecte-toi pour la télécharger » (`distant`, sans compte) ·
« Pas encore envoyée par l’appareil qui l’a prise » (`absent`) · « Pas encore reçue » (aucune ligne `files`) · « Fichier illisible reçu du
serveur » + **« Réessayer »** (`erreur`). Au-dessus des miniatures, si ≥ 2 pages sont `distant` et qu'un compte est là : **« Télécharger les {n}
pages »** (un geste, téléchargements en série dans l'ordre des pages). Le `status info` « Aucune synchronisation serveur configurée : sauvegarde
via Réglages » (le `status info` de `sessionView`), faux dès qu'un compte existe, devient : sans compte « Sans compte, ces photos restent sur
cet appareil : sauvegarde via Réglages » ; avec compte « {n}/{m} photos de cette séance envoyées au serveur » (n = pages dont la ligne `files`
a un `remote` valide de ce compte ; I5). **Cette ligne seule est redessinée sur `onEtat`** (comme la vignette) : `/import` est une route de
saisie (`ROUTES_DE_SAISIE`), `doitRendreApresPasse` refuse le rendu, et les écritures du moteur par `db.mutate` n'émettent pas `change` — sans
cela la phrase resterait figée jusqu'à la prochaine ouverture (F-21). Le même `vignettePage` sert aux miniatures de la fiche du livre (la
boucle `thumbs` de `renderBook`, section « Pages et fichiers sources »).

### 4.4 Fiche recette (`src/ui/recipe.js`) — « Original » et « Pages d'index »

Mêmes `vignettePage` ; même bouton groupé « Télécharger les {n} pages » sous le titre de la section quand ≥ 2 pages manquent. La photo du plat
(`recipes.photo_sha256`, lot A) suit la règle de la couverture (§ 4.2) là où le lot A l'affiche.

### 4.5 Document PDF ou EPUB (`pdfFrame`, `components.js`)

`pdfFrame({ sha256, filename, connecte, telecharger })` reste **synchrone à l'appel** (l'appelant fait `box.append(pdfFrame(…))`) : il rend tout
de suite le conteneur `div.stack`, et c'est à la résolution de `repo.getFile` qu'il y pose **soit** le cadre (`iframe.pdf`, `sandbox`, `src` par
`displayUrl`) **soit**, sans blob, « Ce fichier n’est pas encore sur cet appareil. » (texte existant) + **« Télécharger »** (compte) — jamais un
cadre vide (B-24). Après téléchargement, le cadre remplace le bouton. « Télécharger le fichier » (existant) ne s'affiche qu'avec un blob. Le
rendu PDF en cadre sur iPhone est mesuré en § 10 : s'il est partiel, le cadre cède la place au bouton.

### 4.6 Archive (Réglages → Sauvegarde)

- Création : après le toast existant, dans `backupStatus` (`status warn`, une phrase par cas) : si `missingFiles > 0` : « {n} pages ne sont pas
  encore téléchargées sur cet appareil et ne sont pas dans l’archive. » (singulier : « 1 page n’est pas encore téléchargée sur cet appareil et
  n’est pas dans l’archive. ») ; si `copies.serveur > 0` : « {n} fichier(s) archivé(s) sont des copies du serveur, pas l’original. » ; si
  `copies.inconnues > 0` : « {n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels
  quels. »
- Inspection (`restoreReport`) : puce « pages manquantes : {n} » si `summary.files_distants > 0` et la phrase « Cette archive renvoie à {n} pages
  qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les
  pages). » (D-G5 : rien ne se télécharge tout seul, et une entrée sans `remote` ne viendra de nulle part — I5 : rien n'est annoncé sans fait,
  B-8) ; puce « copies du serveur : {n} » si `summary.files_copies > 0` ; en mode remplacement, une phrase de plus : « Les pages de cet appareil
  absentes de l’archive seront retirées d’ici. » (B-28).
- Restauration : après le statut de `verifyRestored`, dans `result` (`appliquerArchive`, `settings.js`), si `originauxConserves > 0` :
  « {n} originaux de cet appareil conservés (l’archive portait des copies). » (singulier, même règle que « 1 page … » et que `messageRenvoi` :
  « 1 original de cet appareil conservé (l’archive portait une copie). ») — par **`messageOriginauxConserves(n)`** (pure, exportée, à côté de
  `messageRenvoi` : `null` pour 0) ; R-G-6. Inchangée pour le reste ; les lignes de `missing_files` sont restaurées sans blob et apparaissent
  `distant` ou `absent` selon leur `remote`.

### 4.7 La passe « fichiers » (`src/sync/fichiers.js`, `createFichiers({ db, stockage, getUserId, qualite, reduire = reduireImage, hacher =
sha256Hex, maintenant = Date.now, limites = LIMITES_FICHIERS })`)

`LIMITES_FICHIERS = { parPasse: 20, dureeMs: 60000, octetsMax: 52428800, pixelsMax: LIMITES_COUVERTURE.pixels /* 16 Mpx, une seule borne
dans l'app */, reduite: { maxCote: 2000, qualite: 0.8, octetsTelQuel: 614400 } }`. `qualite` est une **fonction** `() => 'reduite' |
'originale'`, relue à chaque fichier (§ 3.3).

`envoyer({ stop, surProgression, snapshot })` :
1. `uid = getUserId()` (nul → `{ rien: true }`). `pauseFichiers` posée → `{ pause: true }` sans rien tenter. `renvoi = !!(await db.get('sync_state',
   'renvoi_originale'))`. `erreurs = clés file_error`.
2. `candidats = candidatsEnvoi(snapshot, { uid, renvoi, erreurs })` (pure) : lignes `files` avec **`estOriginalIci(row)`** (un original ici —
   jamais une copie du serveur : une copie sans `remote` valide est un état `present` sans serveur, comptée (`copiesSansServeur`), pas un
   envoi, S-3), `syncable !== false`, référencées (§ 3.5), sans `file_error`, et (`!remoteDeCeCompte(remote, uid)` **ou** (`renvoi &&
   remote.sha256 !== row.sha256`)) ; triées par `(created_at ?? updated_at ?? '')` croissant (une ligne reçue n'a pas de `created_at`, hors
   projection, B-20). Si `renvoi` et aucune candidate de renvoi → `renvoi_originale` retiré.
3. Pour chaque candidate, tant que `n < parPasse`, `maintenant() - debut < dureeMs` et `!stop()` : `surProgression({ sens: 'envoi', n, total })`.
   a. `octets = await octetsAEnvoyer(row, { qualite: qualite(), reduire, limites })` (pure à `reduire` près) → `{ blob, mime }` : `qualite ===
      'originale'` → tel quel ; PDF/EPUB → tel quel ; image : `dims = await dimensionsImage(blob)` ; `dims` lisible et `dims.largeur *
      dims.hauteur > limites.pixelsMax` → **tel quel, sans décodage** (R-G-4 : mur de sécurité existant, hauteur à relever après mesure, § 10
      geste 8 ; `logError('sync.fichiers.trop_grande', { pixels })` une fois par passe ; B-29/S-6/F-22 : `ajouterPages` stocke les pages brutes, sans
      le mur de `preparerPhotoLocale` ; décoder 48 Mpx en RGBA ≈ 200 Mo
      à chaque passe tant que la ligne est candidate, et l'épuisement mémoire n'est pas une `ErreurImage` : l'onglet est tué et la candidate
      reste candidate — une boucle de plantage) ; `dims` lisible, grand côté ≤ 2 000 et `blob.size ≤ octetsTelQuel` → tel quel ; sinon
      `reduire(blob, { maxCote: 2000, qualite: 0.8 })` → JPEG ; si le résultat est plus gros que l'original → l'original ; `ErreurImage`
      (`indecodable`, HEIC sur Chrome) → tel quel.
   b. `blob.size > octetsMax` → `file_error:<sha256> = { motif: 'trop_gros', sens: 'envoi', at }` (origine `device`), `erreurs += 1`, suivant.
   c. `h = await hacher(blob)` ; `quality = h === row.sha256 ? 'originale' : 'reduite'` (le fait, D-G3) ; `chemin = \`${uid}/${h}\`` ;
      `r = await stockage.envoyer(chemin, new Blob([blob], { type: octets.mime }), { upsert: false })` — **la copie retypée est la règle**
      (comme `displayUrl`) : supabase-js met un `Blob` dans un `FormData` et le type envoyé est `blob.type`, jamais l'option `contentType` ; un
      fichier dont `File.type` était vide à la capture et dont le mime a été résolu par l'extension partirait sinon `application/octet-stream`
      → 415 → « Type de fichier refusé » alors que la ligne dit `image/heic` ou `application/epub+zip` (S-2).
   d. `r.erreur` nulle → confirmé. `dejaPresent(r.erreur)` (`transport.js`, pure : `statusCode === '409' || status === 409 || code ===
      'Duplicate'`) → `v = await verifierDistant(uid, h, blob.size)` (`stockage.lister(uid, { search: h, limit: 1 })` → objet dont `name === h`
      → `Number(metadata.size) === blob.size`) ; vrai → confirmé ; faux → `stockage.envoyer(…, { upsert: true })` puis `verifierDistant` ;
      vrai → confirmé ; faux → `file_error` motif `verification`, suivant.
   e. Autre erreur classée : `auth` → `bilan.attenteConnexion = true`, arrêt ; `quota` → **`sync_state.pause_fichiers = { raison: 'stockage',
      at }`** (origine `device`), `bilan.pauseFichiers = true`, arrêt — **jamais `sync_state.pause`** (D-G4) ; `refus` (400/415/422 : type
      refusé) → `file_error` motif `type`, suivant ; `reseau` / `inconnu` → `bilan.erreur`, `bilan.recul = reculMs(tentatives)` (`tentatives` =
      échecs consécutifs tenus en mémoire par l'instance, remis à zéro à la première confirmation), arrêt.
   f. Confirmé : **relire la ligne juste avant d'écrire** (`relue = await db.get('files', sha256)`) et appliquer la **garde de relecture**
      `peutEcrireRemote(avant, relue, { h, uid })` (`fichiers.js`, pure ; `avant` = la ligne telle que le snapshot l'a lue) : **rien n'est écrit si
      la ligne a été modifiée depuis la lecture (`relue` disparue, sans blob, ou `(relue.updated_at ?? null) !== (avant.updated_at ?? null)`) OU si
      `remote` est déjà valide pour CETTE empreinte sous CE compte (`remoteDeCeCompte(relue.remote, uid) && relue.remote.sha256 === h`)** — la
      passe suivante tranche. Tout le reste **passe** : un renvoi en originale (`relue.remote` = la copie réduite de ce compte, `updated_at`
      inchangé → écrit), un ré-envoi sous un autre compte (`relue.remote.owner !== uid` → écrit), une ligne jamais envoyée (rév. 3, N-2 : la garde
      de la rév. 2 — « un `remote` valide d'une autre empreinte que `h` → rien » — ne distinguait pas « posé entre-temps » de « déjà là avant
      l'envoi » et **bloquait pour toujours** ces deux chemins que D-G4 promet ; S-10 reste tenu : une réception pendant l'envoi change
      `updated_at`, donc rien n'écrase — un envoi dure des minutes, et une écriture entière de la ligne relue avant l'`await` écrasait la
      réception, repartait en origine `local` et gagnait par I7, un orphelin de plus ; la dette TOCTOU de L3, § 11 ; `db.mutate({ conditions })`
      du lot A tranche sur un `status`, pas sur `updated_at` : sa généralisation est un lot à part) ; sinon `db.mutate({ puts: { files:
      [nettoyerChaines({ ...relue, remote: { sha256: h, size: blob.size, mime: octets.mime, quality, uploaded_at: syncNow(), owner: uid },
      updated_at: syncNow() })] }, origin: 'local' })` — seuls `remote` et `updated_at` changent sur la ligne relue ; capturée par `outbox.js`
      (D-G8). `confirmes += 1`.
4. Rend `{ confirmes, erreurs, restants, attenteConnexion, pauseFichiers, erreur, recul }` (`restants` = candidates non traitées).

Dans `moteur.passe()`, après la réception et seulement si `stockage` est injecté, hors `pause_fichiers` et sans `envoiBloque` :
`poser({ phase: 'fichiers' })` ; `snapshot` pris une fois ; `bilanFichiers = await fichiers.envoyer({ stop: () => arrete, surProgression,
snapshot })` ; puis, si `telecharger_tout` est posé : `bilanReception2 = await fichiers.telechargerTout({ stop, surProgression, snapshot })` ;
puis, si `bilanFichiers.confirmes > 0` ou si `storage_usage` est absent : `await appliquerEspace(await fichiers.mesurerEspace())`. Effets :
`attenteConnexion` / `erreur` / `recul` traités exactement comme ceux de `push.envoyer()` (le bloc `bilanEnvoi.pause / attenteConnexion /
erreur / recul` de `passe()`) ; `pauseFichiers` → `poser({ pauseFichiers: await lirePauseFichiers() })` ; `confirmes > 0` → `planifier()` (les
lignes confirmées partent à la passe suivante, 2 s plus tard) ; `restants > 0` sans erreur et `fenetre.document?.visibilityState !== 'hidden'`
→ `programmerReprise(1000)` ; en fin de passe `fin` inclut `fichiers: compter(snapshot)`. `derniersEffets.fichiersRecus` (compté par
`telecharger`) : `passeAEcrit` le lit (une page arrivée doit redessiner la fiche affichée). Le wrapper `compte` du moteur enveloppe aussi
`stockage` : un envoi ou un téléchargement abouti compte pour « Dernier échange » (I5). `envoyerMaintenant()` lève `pause` **et**
`pause_fichiers`. `pause_fichiers` posée → `envoyer` et `telechargerTout` sautés, `push.envoyer()` appelé (les fiches partent).

### 4.8 Téléchargement (`fichiers.telecharger(shas, { stop })`, exposé par `moteur.telecharger`)

Pour chaque `sha256` (en série, et une seule fois à la fois par clé : ensemble `enVol` de l'instance) : `uid = getUserId()` (nul → `{ rien:
true }`) ; ligne relue ; blob déjà là → rien ; `file_error` présent → rien (« Réessayer » retire la clé d'abord) ; `!remoteValide(ligne.remote)`
→ `file_error` motif `forme`, `sens: 'reception'` ; **`ligne.remote.owner !== uid` → `{ recus: 0 }` sans appel** (les octets ne sont pas dans
ce dossier, B-4) ; sinon `r = await stockage.recevoir(\`${uid}/${ligne.remote.sha256}\`)` ; **`introuvable(r.erreur)`** (`transport.js`, pure :
`statusCode === '404' || status === 404 || code ∈ ['KeyNotFound', 'NoSuchKey', 'not_found']`, testé **avant** le type : `classerErreur` range
404 en `inconnu`, F-13) → `file_error` motif `introuvable` ; `refus` → `introuvable` aussi ; `auth` / `quota` / `reseau` / `inconnu` → arrêt
avec `erreur` ; octets reçus → `blob.size === remote.size` et `await hacher(blob) === remote.sha256` et `isAllowed(remote.mime)` ; écart → rien
n'est écrit, `file_error` motif `empreinte` (ou `taille`, `type`) ; sinon **relire la ligne** et appliquer `peutEcrireOctets(ligne, relue)`
(`fichiers.js`, pure) : **rien n'est écrit si un blob est déjà là ou si la ligne a été modifiée depuis la lecture (`(relue.updated_at ?? null)
!== (ligne.updated_at ?? null)`)** — un `remote` d'une autre empreinte posé entre-temps en est le cas visé (S-10, N-2 : la même forme de garde
qu'à l'envoi ; coût : un champ sans rapport qui bouge pendant la descente perd un téléchargement, la tape suivante le refait) ; sinon
`db.mutate({ puts: { files: [fusionnerOctetsRecus(relue, new Blob([blob], { type: remote.mime }))] }, origin: 'remote' })` (I-G7 ; `size`, `mime`,
`updated_at` de la ligne intacts : § 3.1). Rend `{ recus, erreurs, erreur }`. Les écrans appellent
`await moteur.telecharger([sha])` puis `invalidate()` et redessinent la zone (jamais `refresh()` pendant une saisie : les écrans de § 4.2-4.5
ne sont pas des routes de saisie, sauf `/import`, qui redessine la vignette et la phrase de séance seules).

`telechargerTout({ stop, surProgression, snapshot })` : candidates = lignes référencées, sans blob, à `remoteDeCeCompte`, sans `file_error`,
triées par `(created_at ?? updated_at ?? '')` ; `telecharger` par fichier dans la borne (`parPasse`, `dureeMs`) ; `surProgression({ sens:
'reception', n, total })` ; plus aucune candidate → `telecharger_tout` retiré ; rend `{ recus, restants, erreur }`. `moteur.telechargerTout()`
pose la clé (origine `device`) puis `executer('telechargement')` ; `moteur.arreterTelechargement()` retire la clé (la passe en vol s'arrête à
son prochain fichier : `stop` relit la clé). `visibilitychange` vers `hidden` ne retire pas la clé : la prochaine passe `premier_plan` reprend
(reprenable, D-G5).

**Arrêt** (D-G13) : le moteur tient `vols = new Set()` (promesses) ; `telecharger`, `telechargerTout` par tape et `actualiserEspace` y entrent
et en sortent (`finally`) ; `arreter()` rend `Promise.allSettled([vol, ...vols])` ; après `arrete`, ces trois API rendent `{ erreur: { type:
'arrete' } }` sans appel ni écriture.

### 4.9 Espace serveur (`fichiers.mesurerEspace()`, `moteur.actualiserEspace()`)

`offset = 0 ; total = 0 ; objets = 0 ; for (page = 0 ; page < 20 ; page++) { r = await stockage.lister(uid, { limit: 1000, offset }) ; erreur →
{ erreur } ; objets += r.objets.length ; total += Σ Number(o.metadata?.size) || 0 ; if (r.objets.length < 1000) break ; offset += 1000 }` →
`{ octets: total, objets, at: syncNow(), tronque }` → `sync_state.storage_usage` (origine `device`) → `poser({ espaceServeur })`. `Actualiser` →
`moteur.actualiserEspace()` : hors passe, sans attendre un vol (`lister` ne touche pas la base avant la fin), inscrit dans `vols`. Un dossier
qui dépasse 20 pages rend la mesure des 20 premières et `tronque: true` (affiché « au moins {x} Mo ({n} fichiers) »). La mesure est celle **du
dossier de ce compte** (D-G6) ; elle n'est comparée à rien (R-G-5).

### 4.10 Cas et textes

| Cas | `sync_state` | Écran |
|---|---|---|
| Fichier > 50 Mo | `file_error` `trop_gros` (envoi) | Réglages : « Plus de 50 Mo : ce fichier reste sur cet appareil seulement. » — **sans** « Réessayer » (le fichier n'a jamais été envoyé : « le serveur refuse » serait faux, et un bouton qui « échouera pareil » est une attente que personne ne tient, R52 ; B-22) |
| 400 / 415 / 422 à l'envoi (type) | `file_error` `type` (envoi) | « Type de fichier refusé par le serveur. » + « Réessayer » |
| déjà présent puis taille différente deux fois | `file_error` `verification` (envoi) | « Empreinte différente après envoi. » + « Réessayer » |
| 401 / 403 / « adresse non autorisée » | — | `attenteConnexion` : « En attente de connexion — l’envoi reprendra après la prochaine connexion. » (texte L3) |
| 413 / 507 / « exceeded » | `pause_fichiers` | « Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir. » ; « Envoyer maintenant » lève la pause |
| réseau / 5xx / 429 / inconnu | — | `derniereErreur` (L3) ; recul 2 s … 5 min ; rien n'est marqué sur le fichier |
| `remote` invalide à la réception | `file_error` `forme` (réception) | « Ligne de fichier mal formée reçue du serveur. » + « Réessayer » |
| 404 à la réception (sous ce compte) | `file_error` `introuvable` (réception) | « Ce fichier n’est plus sur le serveur. » + « Réessayer » |
| empreinte / taille / type faux à la réception | `file_error` `empreinte` \| `taille` \| `type` (réception) | « Fichier illisible reçu du serveur. » + « Réessayer » |
| aucune ligne `files` pour une page | — | « Pas encore reçue » |
| ligne sans `remote` valide de ce compte | — | « Pas encore envoyée par l’appareil qui l’a prise » |
| sans compte, ligne `distant` | — | « Connecte-toi pour la télécharger » |

Motifs → phrases : `MOTIFS_FICHIER` (`settings.js`, comme `MOTIFS_ENVOI`) ; un motif inconnu → « Fichier refusé » (jamais le jeton brut).

## 5. Textes (FR → EN, toutes par `t()` ; une entrée `en.js` par chaîne, un test de filet les relit)

« Photos à envoyer : {n} » → "Photos to upload: {n}" · « Envoi des photos : {n}/{m} » → "Uploading photos: {n}/{m}" · « Pages à télécharger :
{n} (~{m} Mo) » → "Pages to download: {n} (~{m} MB)" · « Télécharger toutes les pages ({n} fichiers, ~{m} Mo) » → "Download all pages ({n} files,
~{m} MB)" · « Arrêter le téléchargement » → "Stop downloading" · « Téléchargement des pages : {n}/{m} » → "Downloading pages: {n}/{m}" ·
« Tes photos sur le serveur : {x} Mo ({n} fichiers) » → "Your photos on the server: {x} MB ({n} files)" · « Espace serveur : pas encore
mesuré. » → "Server storage: not measured yet." · « au moins {x} Mo ({n} fichiers) » → "at least {x} MB ({n} files)" · « Actualiser » →
"Refresh" · (R-G-5 : aucune chaîne ne nomme un plan, un gigaoctet, un palier ni un prix) · « Espace photos plein sur le serveur : les photos
attendent sur cet appareil, les fiches continuent de partir. » → "Photo storage on the server is full: photos wait on this device, records
keep going out." · « Qualité d’envoi des photos » → "Photo upload quality" · « Réduite (≈ 400 Ko, 2 000 px) » → "Reduced (≈ 400 KB,
2,000 px)" · « Originale » → "Original" · « L’original reste toujours sur l’appareil qui a pris la photo. Réduite : JPEG de 2 000 px au plus,
environ 400 Ko par page, métadonnées retirées. Originale : le fichier tel quel, avec ses métadonnées (dont la position GPS si la photo en
porte). » → "The original always stays on the device that took the photo. Reduced: JPEG of at most 2,000 px, about 400 KB per page, metadata
removed. Original: the file as is, with its metadata (including GPS position if the photo has one)." · « Renvoyer en originale les {n} photos
de cet appareil envoyées en réduite » → "Re-upload as original the {n} photos of this device sent reduced" · « Fichiers refusés : {n} » →
"Rejected files: {n}" · « Réessayer » (existe) · « {n} fichier(s) de type inconnu ne seront pas synchronisés. » → "{n} file(s) of unknown type
will not be synchronized." · « {n} copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra. » →
"{n} photo copy(ies) here that the server no longer tracks: the device with the original will send them again." · « {n} photo(s) ici sont une
copie plus ancienne que celle du serveur. » → "{n} photo(s) here are an older copy than the server's." · « Plus de 50 Mo : ce fichier reste
sur cet appareil seulement. » → "Over 50 MB: this file stays on this device only." · « Type de fichier refusé par le serveur. » → "File type
refused by the server." · « Empreinte différente après envoi. » → "Different fingerprint after upload." · « Ligne de fichier mal formée reçue du
serveur. » → "Malformed file row received from the server." · « Ce fichier n’est plus sur le serveur. » → "This file is no longer on the
server." · « Fichier illisible reçu du serveur. » → "Unreadable file received from the server." · « Fichier refusé » → "File refused" ·
« Télécharger » → "Download" · « Télécharger les {n} pages » → "Download the {n} pages" · « Téléchargement… » → "Downloading…" · « Le
téléchargement n’a pas abouti. » → "The download did not complete." · « Envoi en cours… » → "Upload in progress…" · « Pas encore sur cet
appareil » → "Not on this device yet" · « Connecte-toi pour la télécharger » → "Sign in to download it" · « Pas encore envoyée par l’appareil
qui l’a prise » → "Not yet sent by the device that took it" · « Pas encore reçue » → "Not received yet" · « La couverture n’est pas sur cet
appareil. Connecte-toi pour la télécharger. » → "The cover is not on this device. Sign in to download it." · « La couverture n’est pas sur cet
appareil : l’appareil qui l’a prise ne l’a pas encore envoyée. » → "The cover is not on this device: the device that took it has not sent it
yet." · « Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages » → "Without an account these photos stay on this device:
back up from Settings" · « {n}/{m} photos de cette séance envoyées au serveur » → "{n}/{m} photos of this session uploaded to the server" ·
« Page {p} · {livre} » → "Page {p} · {livre}" · « page non numérotée · {livre} » → "unnumbered page · {livre}" · « Page {p} » → "Page {p}" ·
« Couverture · {livre} » → "Cover · {livre}" · « Photo du plat · {titre} » → "Dish photo · {titre}" · « Photo importée · {date} » → "Imported
photo · {date}" · « {n} pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive. » → "{n} pages are not downloaded
on this device yet and are not in the archive." · « 1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive. » → "1 page
is not downloaded on this device yet and is not in the archive." · « {n} fichier(s) archivé(s) sont des copies du serveur, pas l’original. » →
"{n} archived file(s) are server copies, not the original." · « {n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du
serveur connue : archivés tels quels. » → "{n} archived file(s) have bytes that are neither the original nor the known server copy: archived as
is." · « pages manquantes : {n} » → "missing pages: {n}" · « copies du serveur : {n} » → "server copies: {n}" · « Cette archive renvoie à {n} pages
qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages). »
→ "This archive refers to {n} pages that are not in it: those on the server can be downloaded (from the page, or Settings → Download all pages)."
· « Les pages de cet appareil absentes de l’archive seront retirées d’ici. » → "Pages on this device that are not in the archive will be
removed from here." · « {n} originaux de cet appareil conservés (l’archive portait des copies). » → "{n} originals of this device kept (the archive
carried copies)." · « 1 original de cet appareil conservé (l’archive portait une copie). » → "1 original of this device kept (the archive carried a
copy)." · « Ce geste n’a pas abouti. » (existe) · « Ce fichier n’est pas encore sur cet appareil. », « Télécharger le fichier »,
« La couverture n’est pas sur cet appareil. », « En attente de connexion … » : existent. `README_TXT` (`backup.js`, hors `t()`) gagne la
ligne : « Le manifeste peut porter l'identifiant technique du compte qui a envoyé un fichier (un uuid, pas un secret). »

## 6. Serveur

**Rien à migrer.** Le seau `pages` (privé, `file_size_limit = 52428800`, six types) et ses quatre règles `pages_select`, `pages_insert`,
`pages_update`, `pages_delete` existent (`0002_stockage.sql`, appliqué et prouvé le 13 octobre, 11 verdicts). Ce que l'app appelle, exactement,
tout par `createStockage(client)` (`src/sync/transport.js`) :
- `client.storage.from('pages').upload(\`${uid}/${h}\`, blob, { upsert: false })` → règle `pages_insert` ; avec `upsert: true` → `pages_update`
  (en-tête `x-upsert: true`). **Le type part comme `blob.type`** (corps `Blob` → `FormData` : l'option `contentType` est inopérante pour un
  Blob dans supabase-js 2.117.3, S-2) — d'où la copie retypée de § 4.7 c.
- `client.storage.from('pages').download(\`${uid}/${remote.sha256}\`)` → `pages_select` ; rend un `Blob`.
- `client.storage.from('pages').list(uid, { limit, offset, search })` → `pages_select` ; `POST /object/list/pages` ; chaque objet porte `name`
  et `metadata.size` (la forme que la vue `private.storage_usage` lit déjà) et `metadata.mimetype` (lu en § 10 geste 1).
Jamais `remove` (L5, R12), jamais `getPublicUrl`, jamais `createSignedUrl`. `createStockage` rend `{ envoyer(chemin, blob, opts) → { erreur },
recevoir(chemin) → { blob, erreur }, lister(prefixe, opts) → { objets, erreur } }`, chaque erreur de la forme `{ type, status, statusCode, code,
message }` : `type` et `message` par `classerErreur({ status: e.status, code: e.code, message: e.message })`, puis `statusCode: e.statusCode ??
null` (chaîne) et `code: e.code ?? null` recopiés (`StorageApiError` porte toujours `status` — statut HTTP, repli 500 —, `statusCode` — celui
du corps, sinon `code` du corps, sinon le statut — et `code`). `dejaPresent(erreur)` et `introuvable(erreur)` (exportées, pures) lisent les trois
champs (§ 4.7 d, § 4.8) : les formes « HTTP 400 + statusCode '409' » et « HTTP 400 + statusCode '404' » ont existé chez le fournisseur, et la
forme réelle de `mitsu` n'est pas mesurée avant § 10 (B-3). Le `GET` de `download` et le `POST` de `list` partent avec le jeton de la session
(supabase-js) : aucun en-tête ni jeton dans l'app. `supabase/README.md` : une note d'une ligne à l'étape 7 (« L4 utilise ces règles ; l'espace
est mesuré par l'app en listant son dossier ; le quota est celui du projet, l'app ne le connaît pas » — R-G-5).

## 7. Tests (suite navigateur `tests/sync-l4.js`, `runSyncL4Tests({ eq, ok })`, enregistrée dans `tests/tests.js` après `runImportCibleTests`
et avant `runThemeTests` ; bases jetables `withRepo` / `withDatabase` ; Storage factice ; aucun réseau ; total épinglé relevé à chaque tâche)

**Storage factice** (`tests/stockage-factice.js`, `creerStockageFactice({ objets = {}, limiteOctets = 52428800, types = ALLOWED_MIME, pannes
= [], forme409 = 'status' | 'statusCode', forme404 = 'status' | 'statusCode' })`) : mémoire `objets[chemin] = { octets, type }` ; `envoyer` →
`refus` 415 si **`blob.type`** hors `types` (jamais l'option : S-2), 413 si `blob.size > limiteOctets`, « déjà présent » si le chemin existe et
`!upsert` — sous la forme choisie : `{ status: 409, statusCode: '409', code: 'Duplicate' }` ou `{ status: 400, statusCode: '409', code:
'Duplicate' }` —, sinon écrit ; `recevoir` → introuvable (`{ status: 404, statusCode: '404', code: 'KeyNotFound' }` ou `{ status: 400,
statusCode: '404', … }`) si absent, sinon `Blob` du type stocké ; `lister(prefixe, { limit, offset, search })` → objets du dossier, `{ name,
metadata: { size, mimetype } }`, filtrés par `search` ; `pannes` : liste `{ methode, chemin?, erreur }` consommée dans l'ordre ; `journal` de
tous les appels ; `octets(chemin)` lu par les tests. Il rend des `{ erreur }` déjà classées, de la forme de `createStockage` (comme le transport
factice rend des réponses).

Chaque test nomme le **mutant** qu'il tue (rejoué sur une copie à la vague finale, comme les lots précédents).

**Assertions L3 amendées** (I-G9 : onze, nommées ici, aucune supprimée, aucune autre ; numéros relevés sur `f5e5464`, revérifiés inchangés sur
`24e539b`) :
- `tests/sync-l3.js` : l. 527 `tablesAEnvoyer(...).length` 24 → **25** ; l. 528 25 → **26** ; l. 529 `includes('files')` `false` → **`true`** ;
  l. 537 `r.tables.length` 24 → **25** ; l. 543 `backfill:files` `undefined` → **`'fait'`** ; l. 545 `p.total === 24` → **25** ; l. 682 `[sans.remote,
  'blob' in sans]` `[true, false]` → **`[remoteValide(sans.remote), 'blob' in sans] = [false, false]`** (la ligne arrive **sans octets et sans
  `remote` valide**, plus `remote: true`) ; l. 1703 et 1708 `eq(e.derniersEffets, { recues, supprimees, ajustes, conflits })` → **`{ …,
  fichiersRecus: 0 }`**.
- `tests/assistant-compte.js` : l. 388 `[false, true, 26]` → **`[false, true, 27]`** ; l. 395 `[25, …]` et `prog.every(total === 25)` → **26**.
- Inchangées mais **contraignantes** : `tests/sync-l3.js` l. 99-101 (`composerLots` sur deux `put` `files` avec `relire → undefined` attend
  `retenue`, jamais `abandonnee`) : dans `elementDe`, pour `files`, la relecture puis `!fiche || !remoteDeCeCompte(fiche.remote, entree.user_id)`
  → `retenue` **précède** la branche « fiche disparue » (R-L3-28) ; l. 540-542 (`refs + 2`, aucune `files` en file : les deux lignes de la
  fixture n'ont pas de `remote`).

- **Schéma et projection** : `CHAMPS_FILES_SERVEUR` exact ; `projectionFichier` retire `blob`, `syncable`, `created_at`, garde `remote` objet
  (`owner` quelconque), rend `remote: null` pour `true` (mutant : `blob` gardé → la projection porte un Blob). `remoteValide` : 14 formes (vrai ;
  vrai avec un champ en plus → **vrai** ; `true` ; `null` ; objet à prototype étranger → faux ; empreinte courte ; `size` 0 ; `size` 52 428 801 ;
  `mime` svg ; `quality` autre ; `owner` vide ; `uploaded_at` nombre ; tableau ; chaîne) (mutant : borne de taille retirée ; mutant : champ en plus
  refusé). `remoteDeCeCompte` : même owner (vrai), autre owner (faux), `uid` nul (faux). `estOriginalIci` : original (vrai), copie réduite (faux),
  copie de taille égale à `remote.size` et `remote.sha256 === sha256` **(faux : la disjonction retirée)**, sans blob (faux), fichier parti tel
  quel (vrai). `copiePerimee` : blob ≠ original et `blob.size !== remote.size` (vrai), copie fidèle (faux). `referencesFichiers` : les cinq
  pointeurs, une valeur non-HASH ignorée, un orphelin exclu (mutant : `imports.photo_sha256` retiré de la liste). `etatFichier` : quatre états ×
  connecté / non, plus `remote` d'un **autre owner → `absent`** (mutant : owner ignoré → `distant`) et `erreur` qui prime. `nomFichier` : les cinq
  formes et le repli. `fusionnerFichier` : blob gardé, `remote` = celui de `data` (objet, `null`, absent → absent), `syncable`/`created_at` gardés,
  `updated_at` du serveur (mutant : `delete fiche.remote` réintroduit). `fusionnerOctetsRecus` : `size`/`mime`/`updated_at` intacts.
  **`peutEcrireRemote(avant, relue, { h, uid })`** (N-2) : ligne inchangée sans
  `remote` → vrai ; `updated_at` différent → faux ; `relue` absente → faux ; `relue` sans blob → faux ; `remote` déjà `{ sha256: h, owner: uid }`
  valide → faux ; `remote` de `uid` d'une **autre** empreinte, même `updated_at` → **vrai** (renvoi en originale) ; `remote` d'un autre owner,
  même `updated_at` → **vrai** (ré-envoi sous ce compte) (mutant : la garde de la rév. 2 « autre empreinte → faux » ; mutant : `updated_at`
  ignoré). **`peutEcrireOctets(avant, relue)`** : blob déjà là → faux ; `updated_at` différent → faux ; sinon vrai.
  `fichiers.js` importable sous Node (`tools/fichiers-node.test.mjs`).
- **Passe unique D-G12** : base avec `remote: true` sur deux lignes et une ligne saine → `init()` retire le booléen des deux, garde `updated_at`,
  n'écrit rien en `outbox`, pose `files_remote_v2` ; second `init()` : aucune transaction (`db.mutate` espionné) (mutant : `updated_at` réécrit).
- **Capture (D-G8)** : `putFile` d'une photo → aucune entrée `outbox` (R-L3-22 tenu) ; la même ligne réécrite avec `remote` valide de ce compte
  (origine `local`) → UNE entrée `files` ; avec `remote: true` → aucune ; avec `remote` d'un **autre owner** → aucune ; `syncable: false` + `remote`
  → aucune ; **`db.mutate({ deletes: { files: [sha] } }, origin: 'local')` → aucune entrée** (mutant : `wanted` sans la condition `remote` ;
  mutant : `deletes` capturés). `lots.js` : une entrée `files` dont la ligne a `remote` de ce compte → élément avec exactement
  `CHAMPS_FILES_SERVEUR` et sans `blob` ; sans `remote`, ou d'un autre owner → retenue `fichier en attente` ; `relire → undefined` → retenue (test
  L3 l. 99-101 inchangé) (mutant : projection non appliquée → `blob` dans l'élément, et le factice en mode `serveur` refuse `forme`… éprouvé par
  un `check` ajouté au factice : un `data` qui porte `blob` est rejeté `forme`). `putFile` nettoie `original_filename` (U+0000 retiré).
- **Envoi initial** : `tablesCandidates()` inclut `files` ; une base avec quatre lignes `files` (une à `remote` valide de ce compte, une sans, une
  d'un autre owner, une `syncable: false` à `remote`) → UNE entrée en file, `backfill:files = 'fait'` posé (mutant : filtre retiré → quatre
  entrées).
- **Réception (R56, D-G12, D-G15, D-G16)** : `decider({ locale, distante, table: 'files' })` à instant égal, locale avec `blob`, `syncable`,
  `created_at` différents et distante sans → `ignorer` (mutant : `identiques` sans projection → `conflit`) ; `decider` à deux clés (L3) inchangé
  ; **A et B ont le même blob ; B reçoit la ligne de A à `remote` objet → B garde blob ET `remote`, `candidatsEnvoi(B)` vide** (mutant :
  `delete fiche.remote` réintroduit → B redevient candidate) ; ligne reçue sans `remote` sur une ligne locale sans blob → ni `remote: true`, ni
  `'remote' in fiche` (mutant : `fiche.remote = true` réintroduit) ; **tombale `files` reçue (décision `supprimer`) sur une ligne avec blob → ligne
  gardée,
  blob gardé, `syncable` et `created_at` gardés, `remote: null`, `updated_at` de la tombale, aucune entrée `outbox`,
  `logError('sync.pull.tombale_files')`, curseur avancé, `recues` +1 et `supprimees` inchangé** (N-4 ; mutant : `deletes.files` réintroduit →
  blob perdu ; mutant : tombale ignorée → `remote` gardé, ligne `distant` sur un objet purgé) ; sur une ligne sans blob → ligne gardée,
  `remote: null` (état `absent`) ; tombale d'une clé inconnue → rien (`ignorer`) ; tombale plus ancienne que la ligne locale → `conflit_renvoyer`
  comme en L3 (ligne intacte, remise en file, retenue `fichier en attente` sans `remote` de ce compte) ;
  **ligne reçue dont `remote` change alors qu'une `file_error:<sha>` de sens réception existe → la clé est retirée dans la même transaction**
  (mutant : clé gardée) ; **`adjusted` scripté** (`createPush` + transport factice dont `pousser` rend `adjusted` pour une clé `files`) sur une
  ligne avec blob → blob, `syncable`, `created_at` gardés, `updated_at` du serveur posé (mutant : spread nu → blob perdu) ; **`garderAilleurs` sur
  un conflit `files`** → blob gardé, `remote` du serveur posé (mutant : spread nu → blob perdu) ; **`garderAilleurs` sur un conflit `files` dont
  le serveur est une tombale (`server.deleted_at`, « Supprimer ici aussi ») → ligne et blob gardés, `remote: null`, `updated_at` de la tombale,
  conflit retiré, origine `remote`** (N-4 ; mutant : `deletes[conflit.store]` → blob perdu) ; `garderIci` sur `files` → inchangé (le blob est
  dans `conflit.local`).
- **`octetsAEnvoyer`** (avec `reduire` injecté qui note ses appels, et une vraie image fabriquée par `OffscreenCanvas` 3 000 × 200 PNG pour un
  cas réel) : `originale` → tel quel, `reduire` non appelé ; PDF → tel quel ; image 3 000 px → `reduire` appelé avec `{ maxCote: 2000, qualite:
  0.8 }`, sortie JPEG ; image 1 200 px de 300 Ko → tel quel ; image 1 200 px de 900 Ko → réduite ; `reduire` qui lève `ErreurImage('indecodable')`
  → tel quel ; résultat plus gros que l'original → l'original ; **en-tête PNG de 5 000 × 4 000 (20 Mpx, fabriqué, corps tronqué) → tel quel,
  `reduire` NON appelé** (mutant : mur de pixels retiré → `reduire` appelé) (mutant : seuil `octetsTelQuel` retiré ; mutant : HEIC indécodable
  refusé). `qualite` est appelée **à chaque fichier** (espion : n appels pour n candidates).
- **`envoyer` (passe)** avec `withRepo` + stockage factice : (a) trois photos référencées, une orpheline, une `syncable: false` → trois `envoyer`
  dans l'ordre `created_at`, trois `remote` écrits `{ sha256: h, size, mime: 'image/jpeg', quality: 'reduite', uploaded_at, owner: 'u1' }`, **le
  blob envoyé a `type === 'image/jpeg'`** (lu dans le journal du factice), trois entrées `outbox`, `confirmes = 3`, l'orpheline intacte (mutant :
  orpheline envoyée ; mutant : blob non retypé → une ligne dont `blob.type === ''` et `mime === 'image/heic'` part `''` → 415 sur le factice) ;
  (a2) image sous les seuils, partie telle quelle → **`quality: 'originale'`** (le fait), et non candidate au renvoi ; (b) déjà présent (forme
  `status`) → `lister` appelé avec `search = h`, taille égale → confirmé sans second envoi (mutant : 409 traité en succès sans `lister`) ; (b2)
  déjà présent (forme `status 400 + statusCode '409'`) → même chemin (mutant : `statusCode` ignoré → `file_error type`) ; (c) déjà présent, taille
  différente → `envoyer` `upsert: true` puis `lister` → confirmé ; (d) déjà présent puis deux tailles différentes → `file_error` `verification`,
  rien d'écrit sur la ligne (mutant : `remote` écrit quand même) ; (e) 415 type → `file_error` `type`, la passe continue sur le suivant ; (f)
  `limites.octetsMax = 10` injecté et un vrai `Blob` de 11 octets → aucun appel réseau, `file_error` `trop_gros` (mutant : borne retirée) ; (g)
  erreur `reseau` au deuxième → arrêt, `recul = 2000`, le premier confirmé, le troisième `restant`, rien marqué (mutant : la passe continue après
  `reseau`) ; (h) `auth` → `attenteConnexion`, rien d'autre ; (i) `quota` → **`sync_state.pause_fichiers` posé, `sync_state.pause` ABSENT**,
  `pauseFichiers: true` (mutant : clé `pause` posée) ; (j) borne 20 : 25 candidates → 20 envoyées, `restants = 5` ; borne 60 s : `maintenant`
  injecté qui saute de 61 s après le premier → `confirmes = 1` (mutant : borne de temps retirée) ; (k) `stop()` vrai après le premier → arrêt ;
  (l) la ligne relue avant l'écriture : supprimée entre-temps → rien n'est écrit (mutant : écriture d'une fiche fantôme) ; (l2) **une réception
  pendant l'`envoyer` (le factice écrit en base, avant de répondre, la ligne avec un autre `remote` et un `updated_at` neuf) → rien n'est
  écrit** (N-2 ; mutant : écriture écrasante ; mutant : `updated_at` ignoré) ; (l3) **renvoi en originale : ligne à `remote` réduit de ce compte,
  `updated_at` inchangé pendant l'envoi → le `remote` originale est écrit** (N-2 ; mutant : garde de la rév. 2 « autre empreinte → rien » →
  jamais écrit) ; (l4) **ré-envoi sous un autre compte : ligne à `remote.owner = 'u2'`, envoi sous `u1` → `remote` de `u1` écrit** (même
  mutant) ; (m) `renvoi_originale` : une ligne `reduite` dont l'original est ici → renvoyée en `originale` sous la nouvelle empreinte,
  l'ancienne reste sur le factice (dit) ; une ligne `reduite` sans original ici → pas candidate ; **une ligne partie telle quelle (`remote.sha256
  === sha256`) → pas candidate** ; plus de candidate → clé retirée (mutant : `estOriginalIci` ignoré → la copie réduite repart) ; (n) une ligne
  dont le blob est une copie (taille ≠ `size`) et `remote: null` → **pas candidate**, `compter().copiesSansServeur = 1` (mutant : candidate →
  `quality: 'originale'` écrit sur une copie).
- **Moteur** : `createMoteur` sans `stockage` → clés L4 à leur valeur de repos, `passe` identique à L3 (les suites L3 passent telles quelles,
  aux onze assertions près) ; avec `stockage` : ordre des phases observé par `onEtat` = `envoi_initial → envoi → reception → fichiers`,
  `fin.fichiers` recompté ; `confirmes > 0` → `planifier` (minuterie observée avec `delaiRegroupementMs: 1`) puis les lignes `files` partent dans
  la passe suivante (mutant : `planifier` non appelé → l'entrée attend) ; `restants > 0` → `programmerReprise` (mutant : pas de reprise) ;
  `arreter()` pendant la passe → `stop` vrai, aucun envoi de plus ; **`pause_fichiers` posée → `push.envoyer` appelé, `fichiers.envoyer` NON
  appelé** (mutant : passe fichiers tentée) ; `pause` (L3) posée → envoi des fiches sauté comme en L3 ; `envoyerMaintenant` → les deux clés
  retirées ; sans compte → rien ; **une tape `telecharger` puis `arreter()` → `arreter()` ne se résout qu'après le téléchargement, aucune
  écriture après ; `telecharger` après `arreter()` → `{ erreur: { type: 'arrete' } }` sans appel** (mutant : vol non tenu → écriture après
  l'arrêt) ; `db.getSnapshot` espionné : **une** lecture de `files` par passe (mutant : `compter()` relit).
- **Téléchargement** : `telecharger([sha])` : ligne `distant` → `recevoir(\`u1/${remote.sha256}\`)`, blob écrit avec `type: remote.mime`,
  `size`/`mime`/`updated_at` de la ligne **inchangés**, `syncable: true`, origine `remote` (aucune entrée `outbox`), `recus = 1` (mutant :
  `putFile` ordinaire → `size` réécrit) ; empreinte fausse → rien d'écrit, `file_error` `empreinte` ; taille fausse → `taille` ; `remote.mime`
  hors liste → `type` sans appel réseau ; `remote: true` → `forme` ; **`remote.owner !== uid` → `{ recus: 0 }`, aucun appel, aucune `file_error`**
  (mutant : owner ignoré → 404 → `introuvable`) ; 404 (forme `status`) → `introuvable` ; 404 (forme `status 400 + statusCode '404'`) →
  `introuvable` (mutant : `statusCode` ignoré → `type`) ; blob déjà là → aucun appel ; **ligne modifiée pendant la descente (le factice réécrit la
  ligne avec
  un `updated_at` neuf avant de répondre) → rien d'écrit, aucune `file_error`, `recus = 0`** (N-2 ; mutant : écriture malgré le changement) ; deux
  appels concurrents sur la même clé → un seul `recevoir` (mutant : `enVol` retiré) ; `file_error` présent → aucun appel ; `reessayerFichier` retire
  la clé puis télécharge ; `putFile(sha,
  blob, { origin: 'remote' })` sur une ligne existante → même ligne que `fusionnerOctetsRecus` (une règle, deux appelants).
- **`telechargerTout`** : 25 lignes `distant`, 2 avec `file_error`, 1 orpheline, 1 d'un autre owner → 20 reçues, `restants = 3`, clé gardée ;
  passe suivante → 3 reçues, clé retirée (mutant : clé jamais retirée) ; `arreterTelechargement` pendant → arrêt au fichier suivant ;
  `compter().aTelecharger` et `octetsATelecharger` ignorent l'autre owner (mutant : compté).
- **Espace** : factice avec 1 250 objets → `lister` appelé deux fois (`offset` 0 puis 1000), `octets` = somme exacte, `storage_usage` écrit
  (origine `device`), `espaceServeur` posé ; erreur `reseau` → `storage_usage` inchangé ; 20 pages pleines → `tronque: true` (mutant : pagination
  retirée → une seule page comptée).
- **Archive (D-G3, D-G7, S-1)** : (a) base avec une ligne sans blob à `remote` valide, une sans blob et sans `remote`, une avec original, une
  avec copie réduite (blob JPEG dont l'empreinte = `remote.sha256`) → `createArchive` : `missing_files` de 2, `files` de 2 dont une à `bytes_*`,
  `missingFiles = 2`, `copies = { serveur: 1, inconnues: 0 }` ; `inspectArchive` ok, `summary.files_distants = 2`, `files_copies = 1`, relations
  tenues ; `applyArchive` dans une base vide → 4 lignes, deux sans blob, la copie réduite sous sa clé avec `remote` ; `verifyRestored` ok (mutant
  : `bytes_sha256` ignoré à l'inspection → « endommagé » ; mutant : `comparableFiles` compte les lignes sans blob → décompte faux ; mutant :
  `requireInspection` compare `size` à `bytes.length` → « Archive non validée ») ; (b) **copie réduite SANS `remote`** → `createArchive`
  **réussit**, entrée à `bytes_*` sans `remote`, `copies.inconnues = 1`, archive inspectée et restaurée (mutant : levée « Fichier source
  endommagé » réintroduite) ; (b2) copie dont `bytes_sha256 !== remote.sha256` (copie périmée) → réussit, `copies.inconnues = 1` ; (c) archive
  fabriquée (`rewriteArchive`, `tests/backup.js`) : `bytes_size` seul (sans `bytes_sha256`) → refusée « Description de fichier invalide » ; même
  empreinte dans `files` et `missing_files` → refusée ; `missing_files` qui porte un `remote` invalide → refusée ; **une `source_page` qui pointe
  une entrée de `missing_files` → inspectée ok ET appliquée ok** (mutant : `requireInspection` sans `missing` → « introuvable ») ; (d) archive
  **figée** d'avant le lot — **`tests/fixtures/archive-0.8.1-sans-imports.zip`** (sans `missing_files`, sans `bytes_*`, posée par le lot A) →
  inspectée et restaurée (mutant : `missing_files` exigé) ; (e) fusion : une ligne de `missing_files` sur une base qui a déjà le blob → blob gardé
  ; **(e2) fusion, N-1 : une entrée `files` SANS `remote` (archive faite avant l'envoi) restaurée sur une ligne locale qui porte un `remote`
  valide → `applyArchive` garde le `remote` local et `verifyRestored` rend `ok: true`** (mutant : `remote` comparé inconditionnellement →
  « contenu différent ») ; **(e3) même cas sur `missing_files`** (entrée sans `remote`, ligne locale à `remote`) → ok ; une entrée **avec** un
  `remote` différent de celui de la ligne restaurée → écart dit (le contrôle tient là où l'archive affirme quelque chose) ; **(e4) fusion, R-G-6 :**
  base avec une ligne à l'**original** (`blob.size === size`, `remote` R1 de ce compte), archive dont l'entrée pour cette empreinte porte
  `bytes_*` (copie JPEG) et un `remote` R2 → `applyArchive` en fusion : blob **inchangé** (`sha256Hex(row.blob) === sha256`, `row.blob.size ===
  size`), `remote` = R2 (pris de l'archive), `mime` et `size` de l'entrée, retour `originauxConserves = 1` ; `verifyRestored` `ok: true` ;
  `compter().copiesSansServeur` nul (mutant : « blob tel quel » rétabli — `blob: Blob(bytes)` sans `octetsRestaures` → `sha256Hex(row.blob) ===
  bytes_sha256`, **rouge** ; mutant : comparaison brute dans `verifyRestored` — `sha256Hex(row.blob) === (bytes_sha256 ?? sha256)` → « Empreinte
  différente », `ok: false`, **rouge**) ; **(e5) remplacement, R-G-6 :** même base, même archive, `mode: 'replace'` → même résultat (l'original
  survit à `clearStores`, porté dans le `batch`), `remote` = R2, `originauxConserves = 1`, `verifyRestored` `ok: true` et décompte
  `comparableFiles` tenu (mutant « blob tel quel » → rouge ; mutant : `existingFiles` vide en remplacement, comme aujourd'hui → la copie écrite,
  rouge) ; **(e6) R-G-6, symétrique :** base avec une ligne dont le blob est une **copie** (`blob.size !== size`, `remote` R1), entrée
  **originale** (sans `bytes_*`) → blob **remplacé** par l'original (`sha256Hex(row.blob) === sha256`, `row.blob.size === size`),
  `originauxConserves = 0`, `verifyRestored` `ok: true` (mutant : `garder` sans `!entreeOriginale` → la copie gardée, rouge) ; **(e7)**
  `messageOriginauxConserves` : `[0, 1, 3]` → `[null, '1 original de cet appareil conservé (l’archive portait une copie).', '3 originaux de cet
  appareil conservés (l’archive portait des copies).']` (appel direct, comme `messageRenvoi` dans `tests/sync-l3.js` ; le câblage dans
  `appliquerArchive` n'est pas exercé par la suite — `confirmDialog` y est importé, pas injecté — et reste à la revue, dit) ; (f) les textes du bilan («
  {n} pages ne sont pas encore téléchargées … », singulier à 1, copies serveur, octets inconnus) rendus dans Réglages
  avec `createArchive` injecté dans `renderSettings` rendant `missingFiles: 2, copies: { serveur: 1, inconnues: 1 }` ; (g) `compterFichesSynchronisees`
  = `files.length + missing.length` pour `files` (mutant : `missing` oublié) ; (h) `README_TXT` porte la ligne sur l'identifiant du compte.
- **Réglages** (rendu réel de `syncSectionL4` et `syncSectionModel`) : sans moteur → aucune clé L4 ; avec moteur et `fichiers.aEnvoyer = 3` →
  « Photos à envoyer : 3 » ; progression `envoi` → « Envoi des photos : 2/3 » ; `pauseFichiers` → la phrase « Espace photos plein … » ;
  `aTelecharger = 4`, `octets = 1,6 Mo` → ligne et bouton « Télécharger toutes les pages (4 fichiers, ~1,6 Mo) » ; `telechargementGlobal` →
  « Arrêter le téléchargement » ; espace 850 Mo et 312 objets → « Tes photos sur le serveur : 850 Mo (312 fichiers) », **aucun `<progress>` et aucun
  texte de `syncSectionL4` qui contienne « Go », « palier » ou « $ »** (R-G-5 ; mutant : barre ou phrase de palier réintroduite ; mutant : `objets`
  ignoré → « (0 fichiers) ») ; `tronque` → « au moins 850 Mo (312 fichiers) » ; espace nul → « pas encore mesuré » ; segmented `reduite` actif, **hors
  de tout `<label>`** (`closest('label')` nul) ; clic `originale` → `setSetting('upload_quality',
  'originale')` espionné ; bouton « Renvoyer en originale … (2) » seulement en `originale` avec 2 candidates ; trois `file_error` → trois lignes
  avec **`nomFichier`** (« Page 12 · Mon livre », « Couverture · Mon livre », « Photo du plat · Tarte ») et leur phrase (`MOTIFS_FICHIER`, motif
  inconnu → « Fichier refusé ») et « Réessayer » câblé sur `gestesL4Pour` (espion) ; **`trop_gros` → sa phrase, aucun bouton** (mutant : bouton
  rendu) ; `typeInconnu = 1` → la phrase ; `copiesSansServeur = 1` et `copiesPerimees = 1` → leurs phrases ; chaque `SYNC_L4_ACTIONS` câblée
  (mutant : action renommée → bouton manquant, test rouge) ; `effacerDonnees` avec `progressionFichiers` non nul → toast « Envoi en cours… ».
- **Écrans** : `vignettePage` × 5 états (+ autre owner → « Pas encore envoyée … ») ; `bookCover` et la zone couverture de `book.js` : `distant`
  + compte → bouton « Télécharger » qui appelle `moteur.telecharger([sha])` (moteur factice) puis redessine avec l'image ; sans compte → phrase
  sans bouton ; **`pdfFrame` sans blob → conteneur rendu de suite, puis bouton et pas de cadre à la résolution ; avec blob → cadre** (mutant :
  cadre rendu avant la résolution) ; `recipe.js` « Original » avec 2 pages `distant` → « Télécharger les 2 pages » → deux clés passées à
  `telecharger` dans l'ordre ; `import.js` : phrase « {n}/{m} photos de cette séance envoyées au serveur » à 1/3, **puis 2/3 après un `onEtat`
  sans re-rendu de la route** (mutant : compte sur `blob` au lieu de `remote` ; mutant : phrase non abonnée).
- **`displayUrl` / `bookCover` / `pdfFrame`** : blob `image/jpeg` sur une ligne `mime: image/heic` → URL typée `image/jpeg` (le type du blob,
  dans la liste, gagne) ; blob `text/html` sur une ligne `image/jpeg` → retypé `image/jpeg` (S3 tenu) ; blob `text/html` sur une ligne
  `text/html` → rien (mutant : type du blob pris sans liste blanche).
- **Sources et versions** : `src/sync/transport.js` ne contient ni `.getPublicUrl(`, ni `.createSignedUrl(`, ni `.remove(` (test de texte,
  faible, admis ; borné au seul module qui tient `client.storage` : `src/` hors vendor porte 15 `.remove(` DOM et `repo.remove`, et
  `src/vendor/` porte les trois) ; `getClient` n'est appelé que dans `src/app.js` (défini dans `auth.js` ; `transport.js` reçoit `client`) ;
  `navigator.onLine` absent de `src/sync/` ; `APP_VERSION` et le pin `sw.js` (`v0\.11\.0-\d+`) dans **six** suites : `tests/ajouter.js`,
  `tests/sync-l3.js`, `tests/recherche-web.js`, `tests/assistant-compte.js`, `tests/creer-ia.js`, **`tests/passerelle.js`** (B-11/F-6) ; `SHELL`
  complet (test existant `tests/sync.js`, « tout module atteignable depuis app.js est dans SHELL ») ; chaque chaîne `t()` neuve a son entrée `EN`
  (filet, liste dans le test) ; aucun caractère invisible (commande Python des lots précédents).

## 8. Hors périmètre (nommé pour ne pas y glisser)

Purge d'un objet et « Supprimer ma bibliothèque du serveur » (L5, R12, `sync_purge`, `remove`) ; **le vrai sort d'une tombale `files`** (D-G15, N-4 :
en L4 elle met `remote` à `null`
et ne supprime jamais un blob ; retirer des octets locaux est un geste de L5) ; orphelins serveur (une ancienne copie réduite après un renvoi en
originale, un même original envoyé par deux appareils, un
`remote` d'un autre compte ré-envoyé sous ce compte) ; HEIC → JPEG côté réception ; vidéos ; réduction des PDF ; dédoublonnage entre comptes ;
téléchargement automatique à l'ouverture d'un écran (R-G-1) ; télécharger l'originale (ou la copie à jour) quand une copie est déjà ici ;
envoi reprenable (TUS) ; envoi ou téléchargement **annulable** (signal) ; quota dur par personne ; mesure du quota **du projet** et toute
mention d'un plan, d'un palier ou d'un prix dans l'app (R-G-5 : aucune migration, l'app ne connaît pas le plan ; `public.storage_total()`
abandonnée) ; pastille d'en-tête pour les photos (R-G-3) ; affichage d'une page en grand (visionneuse) ; miniatures générées côté serveur ;
généralisation de `db.mutate({
conditions })` à un champ autre que `status`.

## 9. Ordre des tâches (TDD, chacune rouge puis verte, revue par tâche ; **à chaque tâche qui touche `src/` : `sw.js` `VERSION` +1, `SHELL`
à jour, total épinglé de `tests/tests.js` relevé dans « obtenu »**)

1. **Données et projection** : `remoteValide`, `remoteDeCeCompte`, `CHAMPS_FILES_SERVEUR`, `projectionFichier` (`tables.js`) ;
   `estOriginalIci`, `copiePerimee`, `referencesFichiers`, `etatFichier`, `nomFichier`, `candidatsEnvoi`, `fusionnerFichier`,
   `fusionnerOctetsRecus`, `peutEcrireRemote`, `peutEcrireOctets` (`src/sync/fichiers.js`, pures ; `tools/fichiers-node.test.mjs`) ; `identiques(a, b,
   table)` et `decider({ locale,
   distante, table })` à projection sur `files` (R56) ; `ficheFichier` par `fusionnerFichier` (ni `remote: true`, ni `delete`) ; tombale `files`
   → `fusionnerFichier(locale, { remote: null }, updated_at)` à la réception (décision `supprimer`) et dans `garderAilleurs`
   (`serveur.deleted_at`), journalisée, jamais `deletes` (D-G15, N-4) ; retrait de `file_error` à la réception d'un `remote` changé ;
   `appliquerReponse` (`adjusted`) et `garderAilleurs` par
   `fusionnerFichier` pour `files` ; capture `files` à `remote` de ce compte, puts seulement ; envoi initial de `files` filtré ; `lots.js` à
   projection et retenue après relecture ; passe unique `convertirRemoteBooleen` ; `putFile` à origine `remote` par `fusionnerOctetsRecus` et
   `nettoyerChaines` sur les métadonnées ; `DEFAULT_SETTINGS.upload_quality` ; `qualiteEnvoi` dans `state.js` ; `displayUrl` / `bookCover` à
   type du blob. **`SHELL` + `./src/sync/fichiers.js`, `VERSION` +1** (atteignable dès ici). Suites L2-L3 vertes (onze assertions amendées,
   nommées en § 7).
2. **Archive** (D-G3, D-G7, S-1, R-G-6) : `createArchive` (`bytes_*` découplés, `copies`, plus de levée), `inspectArchive`, `requireInspection`,
   **`octetsRestaures`** (pure, nommée une fois, importe `estOriginalIci` de `src/sync/fichiers.js` — tâche 1), `applyArchive` (`existingFiles`
   dans les deux modes, blob selon `garder`, retour `originauxConserves`), `verifyRestored` (N-1 : `remote` comparé seulement si l'entrée en
   porte un ; R-G-6 : `attendu` d'`octetsRestaures`, jamais `bytes_sha256 ?? sha256` en brut), `compterFichesSynchronisees`, `README_TXT` ;
   fixture figée existante ; textes du bilan dans `settings.js` (avec l'injection `createArchive` ; `messageOriginauxConserves` et son câblage
   dans `appliquerArchive`) ; tests (e4) à (e7) et leurs mutants.
3. **Storage** : `createStockage(client)`, `dejaPresent`, `introuvable` dans `transport.js` ; `tests/stockage-factice.js` (deux formes) ;
   `octetsAEnvoyer` (mur 16 Mpx, retypage) ; `envoyer` de la passe (déjà présent, erreurs, bornes, `pause_fichiers`, garde de relecture N-2,
   `renvoi_originale`) ; `telecharger` (owner, 404 sous deux formes, garde de relecture), `telechargerTout`, `mesurerEspace`.
4. **Moteur** : `createMoteur({ stockage, qualite, reduire })`, phase `fichiers`, un snapshot par passe, `fin.fichiers`,
   `derniersEffets.fichiersRecus`, `pauseFichiers`, `planifier` / `programmerReprise`, `vols` et `arreter()` étendu, API `telecharger`,
   `telechargerTout`, `arreterTelechargement`, `actualiserEspace`, `renvoyerEnOriginale`, `reessayerFichier` ; `envoyerMaintenant` lève les deux
   pauses ; `app.js` passe `stockage: createStockage(client)`, `qualite: qualiteEnvoi`.
5. **Réglages** : `syncSectionModel` étendu, `syncSectionL4`, `SYNC_L4_ACTIONS`, `gestesL4Pour`, `MOTIFS_FICHIER`, réglage de qualité (hors
   label), espace serveur **sans barre, sans seuil, sans phrase de palier** (R-G-5), textes `en.js`, toast « Envoi en cours… » dans `effacerDonnees` /
   `changerDeCompte`.
6. **Écrans** : `vignettePage`, `bookCover` / zone couverture, `pdfFrame` asynchrone, `recipe.js`, `import.js` (phrase de séance abonnée) ;
   versions (`APP_VERSION`, pins dans les six suites, `sw.js`), total épinglé, `docs/architecture.md` (« Ce qui est absent (L4 et L5) » réécrit,
   et `src/sync/files.js` → `fichiers.js`), `CLAUDE.md` section du lot, **spec parente amendée en § 11 par une ligne R66** qui nomme : le
   module s'appelle `src/sync/fichiers.js` (§ 5.4, § 8 ligne L4 disaient `files.js`) ; la qualité est notée dans `files.remote.quality` et non
   dans la provenance de la page (`upload_quality`, § 5.4) ; `remote` est un objet descripteur, plus `true` (R55, R18 : `missing_files` porte
   `remote` objet ou absent) ; le 409 est vérifié par `list` + taille et non par `download` + recalcul (§ 5.4) ; l'erreur d'un fichier vit dans
   `sync_state.file_error:<sha256>`, pas dans une entrée de file (§ 5.4) ; une tombale `files` ne supprime jamais un blob local — la ligne reste,
   `remote` passe à `null` (D-G15, N-4) ; l'espace serveur affiché est
   une mesure du dossier du compte, sans mention de plan ni de quota (R-G-5) ; `putFile(…, {
   origin: 'remote' })` écrit par `fusionnerOctetsRecus` (§ 5.4 DOIT tenu) ; `supabase/README.md` étape 7.
7. **Clôture** : revue finale de branche, `/verify` (trois lentilles), mutants rejoués, registre copié dans le dépôt principal avant tout
   `git worktree remove`.

## 10. Preuve réelle (gestes de Neegan, site public, deux appareils connectés au même compte)

1. **Photo iPhone → fiche Mac, même empreinte.** iPhone : Réglages → Synchronisation → qualité « Réduite » (défaut) ; photographier une page
   dans un livre ; Réglages montre « Photos à envoyer : 1 » puis 0, « Dernier échange » à l'instant, « Tes photos sur le serveur : 0,4 Mo ».
   Mac : la fiche (ou la séance) montre la vignette « Pas encore sur cet appareil » + « Télécharger » ; une tape → l'image. Preuve d'empreinte,
   dans la console du Mac : `(await (await import('./src/model/repo.js')).getFile('<sha256>')).remote` — `sha256` égal au nom de l'objet dans
   Storage → `pages/<uid>/` du tableau de bord, `size` égal à `metadata.size`, **`mime` égal à `metadata.mimetype`** (S-2), `quality` =
   `'reduite'`. Noter la durée d'envoi, la taille, **les dimensions de la photo (console : `dimensionsImage`) et si elle est partie réduite ou
   telle quelle** (mur de 16 Mpx : un iPhone récent peut dépasser ; R-G-4, geste 8).
2. **Fichier > 50 Mo refusé proprement.** Mac : Ajouter → « Choisir des fichiers » → un PDF de plus de 50 Mo ; Réglages : « Fichiers refusés : 1
   — {nom du fichier} — Plus de 50 Mo : ce fichier reste sur cet appareil seulement. », **sans** bouton, aucune requête `upload` dans l'onglet
   Réseau, « Photos à envoyer » ne le compte pas ; le PDF reste lisible localement.
3. **Archive avec pages non téléchargées.** Mac, avant toute tape « Télécharger » sur une séance de l'iPhone : « Sauvegarder toute ma
   bibliothèque » → « N pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive. » ; « Restaurer une sauvegarde… »
   sur ce ZIP → « pages manquantes : N » et l'archive acceptée. Après le geste 6 : une nouvelle archive du Mac dit « 1 fichier archivé a des
   octets qui ne sont ni l’original ni la copie du serveur connue » et **réussit**.
4. **Rendu PDF en cadre sur iPhone** (spec parente § 5.4, mesure due depuis L4) : un PDF envoyé du Mac, téléchargé sur l'iPhone par
   « Télécharger » ; dire si le cadre affiche la première page, rien, ou une partie ; si partiel, le cadre cède la place au bouton (décision
   consignée en § 12).
5. **Télécharger toutes les pages** : Mac, Réglages → « Télécharger toutes les pages (N fichiers, ~M Mo) » → progression, puis 0 ; fermer
   l'onglet au milieu, rouvrir : la reprise continue (clé `telecharger_tout` tenue). Noter la **durée d'une passe** avec la bibliothèque réelle
   (S-12 ; console : `performance.now()` autour d'`executer()`).
6. **Originale** : iPhone, qualité « Originale », une photo → Mac la reçoit à sa taille d'origine ; puis « Renvoyer en originale les N photos …
   » sur l'iPhone pour la photo du geste 1 : `remote.quality` passe à `originale` sur le Mac après réception (console), l'ancienne copie reste
   dans le dossier (orphelin, L5 : dit), **et sur le Mac la vignette reste la copie réduite** (D-G10 ; Réglages : « 1 photo ici est une copie
   plus ancienne que celle du serveur. »).
7. **Forme réelle du « déjà présent »** : Mac, console, sur une photo déjà envoyée : relancer l'envoi du même blob par `createStockage` (un
   `envoyer` manuel, `upsert: false`) et lire `erreur.status`, `erreur.statusCode`, `erreur.code` ; coller la forme dans `CLAUDE.md` (§ 11) ;
   si `dejaPresent` ne la reconnaît pas, la spec s'amende avant la suite.
8. **Mur de 16 Mpx sur l'iPhone (R-G-4 : « à relever après mesure »).** iPhone, qualité « Réduite », une page prise avec les réglages photo
   **par défaut** de l'appareil (noter le modèle, le format HEIC ou JPEG et la résolution réglée) ; après réception sur le Mac, console :
   `dimensionsImage(blob)` et `blob.size` de la ligne `files`, `remote.quality` et `remote.size` — la **taille réelle d'une page** (Mpx et Mo), et
   si elle est partie telle quelle (`'originale'`, poids d'origine : au-dessus du mur) ou réduite (`'reduite'`, ≈ 400 Ko). Puis une page prise
   **sous** le mur (réglage photo à 12 Mpx si l'appareil l'offre) : noter la durée de l'envoi et si l'app **tient** pendant la réduction (aucune
   mesure de mémoire n'est lisible sur Safari iOS : le fait observable est « l'onglet tient » ou « l'app est rechargée » ; `createImageBitmap`
   sur 12 Mpx ≈ 48 Mo RGBA). Décision **après** la mesure, consignée en § 12 : hauteur du mur pour cette passe (16, 24 ou 50 Mpx), ou
   `file_error trop_grande` ; rien ne change avant.
Aucun agent n'exécute ces gestes ; les mesures (durées, tailles, statut réel d'un 413 de quota, forme réelle d'un 409 et d'un 404, dimensions
et poids d'une page d'iPhone, tenue de l'app pendant une réduction sous le mur) sont collées dans `CLAUDE.md` et, si l'une d'elles contredit la
spec (§ 11), la spec s'amende avant la suite.

## 11. Risques et limites assumés

- **Le serveur ne vérifie aucune empreinte** : la clé est l'empreinte calculée par l'appareil qui envoie ; un objet tronqué est attrapé par la
  taille (déjà présent) et par la vérification à la réception (I-G7), rien de plus.
- **Statuts réels non mesurés** : la forme d'un « déjà présent » (`status 409` ou `status 400 + statusCode '409'`, `code 'Duplicate'`, message
  « The resource already exists »), d'un 404 de `download`, d'un 413 de quota de projet (par opposition au 413 d'un objet trop gros — le client
  refuse avant l'envoi au-dessus de 50 Mo, donc un 413 reçu est lu comme quota), d'un 415 de type refusé. `dejaPresent` et `introuvable` lisent
  les trois champs ; `classerErreur` range le reste selon ses règles existantes ; § 10 les mesure (geste 7).
- **`list` à `search`** : filtre par préfixe de nom ; une empreinte en est un bon ; `limit` 1 000 par page est l'hypothèse (le défaut est 100).
- **Plan du projet inconnu de l'app, mesure du compte** (D-G6, R-G-5) : l'app ne voit que son dossier et ne connaît ni le plan, ni le quota,
  ni le prix du projet (`mitsu` est sur une organisation Pro, R33) ; deux comptes remplissent le même espace ; l'écran dit une mesure, jamais un
  plafond ; un seau plein se dit par le 413 (`pause_fichiers`), pas avant ; `public.storage_total()` est abandonnée (§ 8).
- **Orphelins serveur** (D-G1, D-G10) : renvoi en originale, deux appareils qui envoient le même original **avant** que le premier `remote` ne
  soit reçu par l'autre (le premier reçu arrête l'autre : avec `remote` conservé à la réception, D-G12, `candidatsEnvoi` ne retient plus la ligne
  ; une course sur la même passe laisse un orphelin), un `remote` d'un autre `owner` ré-envoyé sous ce compte — rien n'est retiré avant L5.
- **Deux comptes, une archive** : une archive restaurée sous l'autre compte porte des `remote` de l'autre `owner` : ces pages sont `absent`
  (« Pas encore envoyée … ») jusqu'à ce qu'un appareil qui a l'original les renvoie sous ce compte ; le `remote` étranger écrase alors l'autre
  côté (I7), et les appareils du premier compte voient ces lignes `absent` à leur tour — c'est le dédoublonnage multi-comptes hors périmètre
  (D-G10).
- **`estOriginalIci` et `copiePerimee` par la taille** : une copie dont la taille égalerait exactement celle de l'original (ou de `remote.size`)
  serait mal classée (probabilité négligeable ; effet : un renvoi « en originale » de la copie, ou une copie périmée non comptée ; à la
  restauration, R-G-6 lit la même fonction : une telle copie locale serait « gardée » comme un original devant une copie d'archive, et
  `verifyRestored`, qui relit la ligne après coup, dirait vert — même classe, même probabilité).
- **Copie périmée** : après un renvoi en originale fait ailleurs, l'appareil qui a la copie réduite la garde (`present`), compte comme
  `copiesPerimees`, ne retélécharge rien (D-G10) ; l'archive l'emporte telle quelle (`bytes_*`, `copies.inconnues`).
- **Mur de 16 Mpx** : une page de plus de 16 Mpx (iPhone Pro récent : 24 ou 48 Mpx) n'est jamais décodée en « Réduite » et **part telle quelle**
  (3 à 10 Mo HEIC/JPEG, `quality: 'originale'`) ; l'espace en pâtit ; mesuré en § 10 gestes 1 et 8 ; la hauteur du mur est **à relever après mesure**
  (R-G-4 ; alternative : `file_error trop_grande`). Une image au-dessous du mur est décodée par `createImageBitmap` : son coût mémoire sur
  iPhone n'est pas mesuré avant § 10 geste 8.
- **Arrêt non annulable** : `upload()` et `download()` de storage-js 2.117.3 n'acceptent aucun signal ; « Effacer les données » et « Changer de
  compte » attendent la fin du fichier en cours (jusqu'à 50 Mo sur cellulaire) en affichant « Envoi en cours… » ; un signal est en § 8.
- **Relecture avant écriture** (S-10, N-2) : la garde compare l'`updated_at` de la ligne relue à celui de la ligne lue (et, à l'envoi, refuse
  d'écrire un `remote` déjà posé pour cette empreinte sous ce compte) ; la fenêtre entre la relecture et le `db.mutate` reste (deux `await`), de
  même nature que la dette TOCTOU de L3 (`appliquerPage`, `fichesLocales`) ; `db.mutate({ conditions })` du lot A ne tranche que sur un
  `status` ; sa généralisation est un lot à part.
- **Tombale `files` et purge à venir** (D-G15, N-4) : une tombale met `remote` à `null` et garde l'original ; tant qu'une fiche référence
  l'empreinte, `candidatsEnvoi` la retient et l'appareil qui a l'original **renvoie** le fichier à la passe suivante — un objet purgé côté
  serveur remonte. Voulu en L4 (jamais perdre un original sur réception) ; L5 tranchera (purger = retirer la référence ou marquer la ligne,
  jamais effacer des octets à la réception).
- **Coût d'une passe** : `db.getSnapshot` lit toutes les lignes `files` (blobs compris — IndexedDB rend des `Blob` par référence, les octets ne
  sont pas copiés en mémoire, mais le nombre de lignes compte) une fois par passe, toutes les 2 s après une écriture ; non mesuré avant § 10
  geste 5 sur la bibliothèque réelle.
- **Retenue de `lots.js`** : une entrée `files` dont la ligne n'a pas de `remote` de ce compte au moment de l'envoi reste nommée « fichier en
  attente » dans la file (R-L3-5) ; la capture et l'envoi initial la rendent inatteignable (ils filtrent par `owner`), et une entrée `user_id`
  nul de `files` ne peut plus exister (la capture exige `remote.owner === user_id`).
- **HEIC** : en « Réduite », un HEIC pris sur iPhone est ré-encodé JPEG par Safari ; en « Originale », il part HEIC et le Mac (Chrome) ne
  l'affiche pas (D-G10 : conversion côté réception hors périmètre). Un HEIC sans `File.type` résolu par l'extension part désormais typé
  `image/heic` (S-2).
- **Métadonnées** : « Originale » envoie le fichier tel quel, EXIF compris (position GPS, appareil, date) ; « Réduite » les retire (canvas) ; le
  hint le dit (S-9). `remote.owner` (uuid du compte) entre dans `files.data` et dans le manifeste d'archive partageable ; `README_TXT` le dit.
- **`remote` d'une version future** : un champ en plus est ignoré (F-23) ; un champ requis **changé de forme** invaliderait `remote` et ferait
  renvoyer la photo une fois (puis le nouveau `remote` l'arrête).
- **Ordre de réception** : `source_pages` arrive avant `files` (ordre de `SYNC_STORES`) ; une page peut s'afficher « Pas encore reçue » pendant
  une passe, puis « Pas encore sur cet appareil » à la suivante — deux états vrais, successifs.
- **Archive neuve, client ancien** : refusée dès qu'elle porte une page manquante ou une copie (« mets l'app à jour », README).
- **Passe de 60 s** : les fiches partent avant les octets dans la même passe ; une passe fichiers longue retarde la passe suivante d'autant.
- **Safari et l'iPhone** : rien de ce lot n'y est mesuré avant § 10 (téléversement en arrière-plan coupé par iOS : le `recul` et la reprise au
  `premier_plan` sont le filet).

- **Mise à jour (construction, R-G-18)** : un onglet encore sur l'ancien code APRÈS la passe unique peut écrire `remote: true` et avancer le curseur ;
  tous les onglets et appareils doivent être rechargés en 0.11.0. `putFile` ne remplace pas une copie réduite par l'original importé (I-G3 réserve le
  remplacement à l'archive).
- **Archive fabriquée (vague finale, R-G-25)** : la limite « par la taille » n'était pas négligeable face à une archive construite à la main — une copie ne
  porte plus jamais la taille de l'original dans une archive (`bytesValides`), et des octets partis tels quels dont l'empreinte n'est pas la clé ne
  partent pas (`file_error` `forme`). Reste assumé : une copie reçue du serveur dont la taille égale celle de l'original est prise pour l'original
  (`estOriginalIci`) jusqu'au prochain téléchargement.
- **Réglage par appareil (R-G-27)** : `upload_quality` ne voyage pas dans l'archive ; en remplacement, le magasin `settings` est vidé puis rempli des
  réglages publics, et la qualité d'envoi revient à `reduite`.
- **Arrêt entre onglets (R-G-21)** : « Arrêter le téléchargement » touché dans un autre onglet n'arrête pas la passe déjà en vol du premier (20 fichiers
  ou 60 s au plus) ; le compte final d'une passe relit la base au plus trois fois.
- **Reprise après une erreur passagère de téléchargement (R-G-29)** : « Télécharger toutes les pages » s'arrête sans reprise automatique (seul l'envoi
  programme un recul) ; la clé reste posée et un autre déclencheur (écriture, retour en ligne, passe suivante) la relit.
- **`conflit_renvoyer` sur `files` (R-G-29)** : remet en file une entrée même sans remote valide de ce compte (« fichier en attente » tant que l'appareil
  n'a pas l'original) — seul chemin qui contourne D-G8, épinglé tel quel (test c6).
- **Sans compte connu (R-G-29)** : `contexteFichiers` rend `uid` nul et une ligne sans octets à remote valide est dite « Pas encore envoyée par l’appareil
  qui l’a prise », alors que la copie est au serveur.
- **Cache HTTP (R-G-29)** : les octets privés téléchargés peuvent rester dans le cache du navigateur (envoi sans `cacheControl`, descente sans
  `cache: 'no-store'`) ; « Effacer les données de cet appareil » ne vide que la base.
- **Aperçu de la couverture (R-G-29)** : `book.js` crée l'URL de l'aperçu sur le type brut du blob (préexistant l. 144, recopié l. 191), hors de la règle
  F-9 que `bookCover`, `photoDuPlat` et `poserImage` suivent ; non exploitable par le chemin du serveur (octets retypés à la descente).
- **Réglages (R-G-29)** : dès qu'une `file_error` existe, chaque rendu relit le snapshot (`files` entier), jusqu'à toutes les 300 ms pendant une passe.

## 12. Ce que les revues ont amendé (rév. 1 → rév. 2 → rév. 3 → rév. 4)

Trois lentilles (besoin B, sécurité S, faisabilité F) ; chaque constat est appliqué ou refusé avec sa raison ; les constats de faisabilité ont
été vérifiés dans le worktree (`f5e5464`) avant d'être appliqués.

**Lentille besoin**
- **B-1** (Critical, `ficheFichier` `delete fiche.remote` → renvoi perpétuel) — **appliqué** : D-G12, D-G16, `fusionnerFichier`, § 7 test « A et
  B ont le même blob » et mutant ; § 11 « le premier `remote` reçu arrête l'autre ».
- **B-2** (Critical, `reecrire` et `garderAilleurs` remplacent la ligne et effacent le blob) — **appliqué** : D-G16, I-G3 étendu, § 7 tests
  `adjusted` scripté et `garderAilleurs` sur `files` ; `garderIci` inchangé.
- **B-3** (Important, `statusCode`/`code` ignorés) — **appliqué** (vérifié dans le bundle : `statusCode = corps.statusCode || corps.code ||
  statut`) : D-G2, D-G9, § 4.7 d `dejaPresent`, § 4.8 `introuvable`, § 6 forme de l'erreur, factice à deux formes, § 10 geste 7.
- **B-4** (Important, `remote.owner` jamais lu à la réception) — **appliqué** : D-G5, `etatFichier(row, { connecte, uid, erreurs })` → `absent`,
  `telecharger` sans appel, `telechargerTout` / `compter()` filtrés, tests.
- **B-5** (Important, 413/507 pose `sync_state.pause`) — **appliqué** : D-G4, `pause_fichiers` (§ 3.2, § 3.6 `pauseFichiers`), § 4.1 texte,
  § 4.7 e, § 4.10, test (i) et test moteur « push appelé, fichiers non ».
- **B-6** (Important, `requireInspection` sans `missing`) — **appliqué** : D-G7, § 3.4 `requireInspection` et `verifyRestored`, test (c).
- **B-7** (Important, « une assertion près » faux) — **appliqué** : bloc « Assertions L3 amendées » en § 7 (onze, numéros relevés sur `f5e5464` :
  la 679 citée est la 682), I-G9.
- **B-8** (Important, « elles se téléchargeront … après la restauration ») — **appliqué** : § 4.6 texte d'inspection, phrase du remplacement,
  entrées `en.js`.
- **B-9** (Important, `arreter()` ne couvre pas un téléchargement par tape) — **appliqué** : D-G13, § 4.8 « Arrêt », `vols`, `{ type: 'arrete' }`,
  test moteur.
- **B-10** (Minor, test de texte `.remove(` rougit d'emblée) — **appliqué** (15 occurrences DOM et `repo.remove` mesurées hors vendor) : borné à
  `src/sync/transport.js`.
- **B-11** (Minor, `tests/passerelle.js` absent des pins) — **appliqué** : six suites.
- **B-12** (Minor, fixture figée existe) — **appliqué** : `tests/fixtures/archive-0.8.1-sans-imports.zip` nommée.
- **B-13** (Minor, lignes périmées) — **appliqué dans son principe, pas dans ses chiffres** : les numéros proposés (`moteur.js` 190-193,
  `book.js` 167-171) sont eux-mêmes faux sur `f5e5464` (188-191 et 168-172 exacts) ; la rév. 2 nomme par symbole partout (le `status info` de
  `sessionView`, la boucle `thumbs` de `renderBook`, le bloc `bilanEnvoi.pause / attenteConnexion / erreur / recul`).
- **B-14** (Minor, attribution « audit § 5 Deux appareils ») — **appliqué** : la ligne est dans `04_PLAN_TECHNIQUE_ET_VALIDATION.md` § 5
  (vérifié : l'audit § 5 ne la porte pas).
- **B-15** (Minor, `field()` rend un `<label>`) — **appliqué** : § 4.1 item 4 en `div.field`, test `closest('label')`.
- **B-16** (Minor, `qualite` fonction ou valeur) — **appliqué** : § 3.3, § 4.7 (fonction relue à chaque fichier, espion).
- **B-17** (Minor, `etatFichier` sans `erreurs`) — **appliqué** : signature `{ connecte, uid, erreurs }`.
- **B-18** (Minor, `decider` sans table) — **appliqué** : `decider({ locale, distante, table })`, `identiques(a, b, table)`, `appliquerPage` passe
  la table ; les appels L3 à deux clés tiennent par le défaut.
- **B-19** (Minor, `remoteValide` dans `fichiers.js` tiré par `tables.js`) — **appliqué** : `remoteValide` et `remoteDeCeCompte` dans `tables.js`,
  réexportées ; contrainte Node sur `fichiers.js` et test Node.
- **B-20** (Minor, tri sur `created_at` absent) — **appliqué** : `created_at ?? updated_at ?? ''`.
- **B-21** (Minor, renvoi d'un fichier parti tel quel) — **appliqué** : candidat de renvoi seulement si `remote.sha256 !== row.sha256` (et
  `quality` devient un fait, S-3).
- **B-22** (Minor, « Réessayer » sur `trop_gros`) — **appliqué** : pas de bouton, texte « Plus de 50 Mo : ce fichier reste sur cet appareil
  seulement. », D-G4, § 4.10, test.
- **B-23** (Minor, « files · sha tronqué ») — **appliqué** : `nomFichier` (§ 3.1), I-G8, § 4.1 item 6, textes, test.
- **B-24** (Minor, `pdfFrame` synchrone) — **appliqué** : § 4.5, test « conteneur de suite, cadre ou bouton à la résolution ».
- **B-25** (Minor, `compterFichesSynchronisees` sans `missing`) — **appliqué** : § 3.4, test (g).
- **B-26** (Minor, amendements du parent à nommer) — **appliqué** : § 9 tâche 6, ligne R66 avec sept amendements (fusionné avec F-10).
- **B-27** (Minor, `putFile` sans `nettoyerChaines`) — **appliqué** : § 3.1 `putFile`, § 4.7 f, test.
- **B-28** (Minor, remplacement retire des octets sans le dire) — **appliqué** : § 4.6 phrase « Les pages de cet appareil absentes de l’archive
  seront retirées d’ici. ».
- **B-29** (Minor, décodage non borné) — **appliqué** (avec S-6 et F-22) : mur `pixelsMax = LIMITES_COUVERTURE.pixels` ; au-dessus, la photo
  **part telle quelle sans décodage** (défaut ; alternative `file_error trop_grande` et hauteur du mur, alors en § 13 — tranché par R-G-4 en rév. 3) ;
  test « en-tête 20 Mpx →
  `reduire` non appelé ».

**Lentille sécurité**
- **S-1** (Critical, `bytes_*` liés à `remote` → archive impossible après un renvoi en originale) — **appliqué** : D-G3, § 3.4 (`bytes_*` dès que
  `h !== sha256`, quel que soit `remote` ; plus de « Copie de fichier incohérente » ; `createArchive` ne lève plus, rend `copies`), § 4.6 textes,
  § 7 tests (b), (b2), § 11 « copie périmée », `copiePerimee` comptée.
- **S-2** (Important, `contentType` ignoré pour un `Blob`) — **appliqué** (vérifié dans le bundle : `prepareUploadFormData`) : § 4.7 c copie
  retypée, § 6, factice qui lit `blob.type`, § 10 geste 1 lit `metadata.mimetype`, test (a) mutant « non retypé ».
- **S-3** (Important, `quality` = réglage, `estOriginalIci` vraie sur une copie) — **appliqué** : D-G3 (`quality` = fait mesuré au point c),
  `estOriginalIci` sans la disjonction, `candidatsEnvoi` exige `estOriginalIci`, `copiesSansServeur` compté et dit (§ 4.1 item 8), tests (a2), (n).
- **S-4** (Important, pause quota partagée) — **appliqué** : même remède que B-5.
- **S-5** (Important, tombale `files` efface le blob ; `deletes` capturés) — **appliqué** : D-G15, D-G8 (« jamais une suppression »), I-G3, § 8,
  tests « tombale → intacte » (devenu « tombale → `remote: null`, blob gardé » par N-4 en rév. 3), « deletes → aucune entrée ».
- **S-6** (Important, `reduire` sans mur de pixels) — **appliqué** : même remède que B-29 (défaut « telle quelle » ; l'alternative `file_error`, alors
  en § 13, est
  tranchée par R-G-4 en rév. 3).
- **S-7** (Important, « X Mo sur 1 Go » compare un compte au projet) — **appliqué** : D-G6, § 4.1 ligne 3, textes, § 11 ; `public.storage_total()`
  alors en § 13 (renverserait D-G6 : migration) — abandonnée par R-G-5 en rév. 3, qui retire aussi toute mention de palier.
- **S-8** (Minor, owner étranger → « Télécharger » puis 404 ; projection) — **appliqué pour l'état, les compteurs et `telecharger`** (B-4) ;
  **refusé** pour « `projectionFichier(row, uid)` rend `remote: null` quand `owner !== uid` » : la projection sert aussi à `identiques`, et l'écho
  d'une ligne reçue à `remote` étranger se compare avec un `data` qui porte cet objet — projeter `null` d'un côté ferait un conflit à chaque écho
  ; le filtre par `owner` vit dans la capture, l'envoi initial et `candidatsEnvoi` (§ 3.1). **Refusé** aussi pour le texte « Ce fichier n’est pas
  dans ton espace serveur. » : un `remote` étranger ne déclenche plus aucun téléchargement, donc aucun 404 ; le 404 restant (sous ce compte)
  garde « Ce fichier n’est plus sur le serveur. ».
- **S-9** (Minor, EXIF et uuid non dits) — **appliqué** : hint de § 4.1 item 4, `README_TXT`, § 11.
- **S-10** (Minor, relecture avant un long `await`) — **appliqué** : § 4.7 f et § 4.8 relisent juste avant `db.mutate`, n'écrivent que les champs
  du geste, ne font rien si un `remote` d'une autre empreinte est arrivé (garde réécrite par N-2 en rév. 3 : `updated_at`) ; test (l2) ; § 11 nomme la
  dette et la primitive `conditions` du lot A
  (hors périmètre pour `remote`).
- **S-11** (Minor, `arreter()` attend un envoi non annulable) — **appliqué** : § 4.1, § 11, toast « Envoi en cours… », § 8 (signal).
- **S-12** (Minor, deux `getSnapshot` par passe) — **appliqué** : un snapshot par passe réutilisé (§ 3.5, § 4.7), test d'espion, § 10 geste 5,
  § 11.
- **S-13** (Minor, objet nu, `uploaded_at`, clé `file_error` sans `HASH`) — **appliqué** pour le prototype nu, `Object.hasOwn`, `uploaded_at`
  jamais interprété, `HASH.test` avant toute `file_error` (§ 3.1, § 3.2, test « prototype étranger ») ; **refusé** pour « champ étranger refusé » :
  F-23 montre qu'un `remote` enrichi par une version future ferait renvoyer chaque photo entre versions ; un champ en plus est ignoré (les lectures
  par `Object.hasOwn` ne regardent que les six champs connus).

**Lentille faisabilité**
- **F-1** (Critical, trois chemins L3 remplacent la ligne `files`) — **appliqué** : D-G15, D-G16 (mêmes remèdes que B-2 et S-5) ; § 7 nomme le
  `pousser` scripté parce que le factice en mode `serveur` n'émet jamais `adjusted` (vérifié : `adjusted = []`).
- **F-2** (Critical, `ficheFichier` `delete remote`) — **appliqué** : même remède que B-1.
- **F-3** (Important, `identiques`/`decider` sans table) — **appliqué** : même remède que B-18.
- **F-4** (Important, six à huit assertions, 1703/1708, 100-101) — **appliqué** : bloc « Assertions L3 amendées » (onze, dont 1703 et 1708 par
  un `fichiersRecus: 0` toujours présent plutôt qu'une forme d'état variable) ; ordre d'`elementDe` écrit (retenue `files` après relecture,
  avant « fiche disparue »).
- **F-5** (Important, `SHELL` rouge dès la tâche 1) — **appliqué** : D-G11, § 9 en-tête et tâche 1.
- **F-6** (Important, `tests/passerelle.js` oublié) — **appliqué** : même remède que B-11.
- **F-7** (Important, owner étranger → 404 collant ; `file_error` masque la correction) — **appliqué** : B-4, plus le retrait de
  `file_error:<sha256>` dans la même transaction quand `remote` change à la réception (§ 3.2, § 7 test et mutant).
- **F-8** (Minor, `requireInspection` exige `size === bytes.length`) — **appliqué** (vérifié) : § 3.4, mutant dédié.
- **F-9** (Minor, règle d'affichage « type du blob gagne » non écrite) — **appliqué** : § 3.1 « Affichage », § 9 tâche 1.
- **F-10** (Minor, `files.js` dans le parent et `architecture.md`) — **appliqué** : § 9 tâche 6 (R66), fusionné avec B-26.
- **F-11** (Minor, `.remove(` rougit ; `getClient` toléré sur `transport.js`) — **appliqué** : même remède que B-10 ; « `getClient` appelé
  seulement dans `app.js` » (vérifié : `auth.js` le définit, `app.js` l'appelle, `transport.js` reçoit `client`).
- **F-12** (Minor, `tables.js → fichiers.js` sous Node) — **appliqué** : même remède que B-19, plus `tools/fichiers-node.test.mjs`.
- **F-13** (Minor, 404 rangé `inconnu`) — **appliqué** (vérifié : `s !== 404` exclut 404 du type `refus`) : `introuvable` testé avant le type
  (§ 4.8).
- **F-14** (Minor, « Blob creux » écarté par `instanceof`) — **appliqué** : test (f) avec `limites.octetsMax = 10` et un vrai `Blob` de 11 octets.
- **F-15** (Minor, `renderSettings` sans injection `createArchive`) — **appliqué** : `{ fetch, createArchive = createArchiveReel }` (§ 4.1, § 7).
- **F-16** (Minor, fixture figée existe) — **appliqué** : même remède que B-12.
- **F-17** (Minor, total épinglé à chaque tâche) — **appliqué** : en-tête de § 9.
- **F-18** (Minor, lignes citées décalées) — **appliqué pour `import.js` (82 → 80), refusé pour `backup.js`** : sur `f5e5464`, « Fichier source
  endommagé » est bien l. 134, le contrôle de chemin l. 194 et « Décompte de magasin inconnu » l. 203 (les 135/195/204 proposés sont faux) ;
  conclusion commune avec B-13 : plus aucun numéro de ligne dans la spec, des symboles.
- **F-19** (Minor, « trois états » puis quatre ; forme de `segmented`) — **appliqué** : § 3.1 « quatre états », § 4.1 item 4 `[{ value, label }]`.
- **F-20** (Minor, `putFile` amendé sans appelant) — **appliqué** : `fusionnerOctetsRecus` partagée par `repo.putFile` (origine `remote`) et le
  moteur ; test « même ligne par les deux chemins ».
- **F-21** (Minor, phrase « {n}/{m} photos » figée sur `/import`) — **appliqué** (vérifié : `/import` ∈ `ROUTES_DE_SAISIE`) : la ligne seule est
  redessinée sur `onEtat` (§ 4.3), test.
- **F-22** (Minor, mur de pixels) — **appliqué** : même remède que B-29/S-6.
- **F-23** (Minor, `remoteValide` tolère des extras ; `deletes` jamais capturés) — **appliqué** : § 3.1 (extras ignorés, test « champ en plus →
  vrai » et mutant), D-G8/D-G15 (`deletes` jamais capturés, test).
- **F-24** (Minor, `arreter()` attend un envoi) — **appliqué** : même remède que S-11.

**Rév. 2 → rév. 3 — rulings du chef d'orchestre (R-G-1 à R-G-5, les cinq points de l'ancien § 13) et constats (N-1 à N-4)** ; chacun est
appliqué dans le texte et nommé là où il porte ; les noms touchés ont été relus dans le worktree (`24e539b`) ; § 13 est vide d'autant.
- **R-G-1** (ex-§ 13.1) **Téléchargement sur une tape seulement**, plus « Télécharger toutes les pages » dans Réglages (défaut gardé) — **appliqué** :
  D-G5 tranchée ; le téléchargement automatique à l'ouverture d'un écran reste hors périmètre (§ 8).
- **R-G-2** (ex-§ 13.2) **`remote.owner` : oui, et lu** ; un `remote` d'un autre compte **vaut « aucune copie serveur connue »** — **appliqué** : pour
  l'état (`absent`), les compteurs, le téléchargement (aucun appel) et la candidature (l'appareil qui a l'original renvoie sous ce compte) ; il
  voyage tel quel dans la projection et l'archive (S-8 tenu : sinon un conflit à chaque écho) : D-G5, D-G12, § 3.1.
- **R-G-3** (ex-§ 13.3) **La pastille « N non envoyés » ne compte pas les photos** (défaut gardé) — **appliqué** : D-G14 tranchée ; le nombre vit
  dans Réglages (§ 4.1 item 1).
- **R-G-4** (ex-§ 13.4) **Seuils d'`octetsAEnvoyer` en « Réduite »**, défauts confirmés — **appliqué** : (a) une image ≤ 2 000 px **et** ≤ 600 Ko
  part telle quelle ; (b) un HEIC indécodable (Chrome) part tel quel ; (c) une image de **plus de 16 Mpx part telle quelle sans décodage** — le
  mur de sécurité existant (`LIMITES_COUVERTURE.pixels`), **hauteur à relever après mesure** : § 10 geste 8 (taille réelle d'une page d'iPhone,
  tenue de l'app pendant une réduction sous le mur) ; D-G3, § 4.7 a, § 11.
- **R-G-5** (ex-§ 13.5 ; répond aussi à N-3) **Aucune promesse de palier** : `mitsu` est sur une organisation Pro (`CLAUDE.md`, R33) et l'app ne
  connaît pas le plan — **appliqué** : « Tes photos sur le serveur : X Mo (N fichiers) » + « Actualiser », **sans barre, sans seuil, sans phrase
  de palier** ; le texte de pause ne cite plus « 1 Go » ; la vue `private.storage_usage` reste pour l'éditeur SQL ; **aucune migration**
  (`public.storage_total()` abandonnée) : D-G6, § 1, § 4.1 items 1 et 3, § 4.9, § 4.10, § 5, § 6, § 7, § 8, § 11.
- **N-1** `verifyRestored` tolère un `remote` absent de l'entrée quand la ligne locale en porte un (fusion : `applyArchive` garde le `remote`
  local) — **appliqué** : `remote` n'est comparé que si l'entrée en porte un ; même règle pour `missing_files` : § 3.4, § 7 tests (e2), (e3).
- **N-2** Garde de relecture réécrite — **appliqué** : `peutEcrireRemote(avant, relue, { h, uid })` (pure) : « rien n'est écrit si la ligne a été
  modifiée depuis la lecture (`updated_at` différent) OU si `remote` est déjà valide pour CETTE empreinte sous CE compte » ; un renvoi en
  originale et un ré-envoi sous un autre compte **passent** (la garde de la rév. 2 les bloquait pour toujours) ; même forme à la réception
  (`peutEcrireOctets`) : § 4.7 f, § 4.8, I-G10, § 7 tests (l2) à (l4) et cas purs, § 11.
- **N-3** Promesse de palier dans l'écran d'espace — **appliqué** : voir R-G-5.
- **N-4** **Exception `files` pour les tombales** — **appliqué** : une tombale (reçue, ou tranchée par « Garder celle d'ailleurs ») ne supprime
  **jamais** un blob local : la ligne reste, `remote` passe à `null` (octets adressés par contenu, référencés par d'autres fiches) ; coût si
  faux : un fichier purgé côté serveur (L5 à venir) remonte au prochain envoi tant qu'une fiche le référence — à régler en L5 (§ 11) ;
  `derniersEffets.fichiersRecus` reste toujours présent (forme d'état fixe, § 3.6) : D-G15, D-G16, I-G3, § 7, § 8, § 9 tâches 1 et 6 (R66).

**Rév. 3 → rév. 4 — ruling du chef d'orchestre (R-G-6), sur le constat C-1 de la vérification de la rév. 3** ; appliqué dans le texte et
nommé là où il porte ; les noms touchés ont été relus dans le worktree (`24e539b`, inchangé) ; rien d'autre ne change.
- **R-G-6** (C-1, Critical, § 3.4 `applyArchive` / `verifyRestored` : la restauration d'une archive remplaçait un original local par la copie
  réduite que l'archive porte — « blob **tel quel** » —, sans un mot, et `verifyRestored` (`sha256Hex(row.blob) === (bytes_sha256 ?? sha256)`)
  rendait rouge une implémentation qui l'évitait) — **appliqué** : un blob local **original** (`estOriginalIci` : l'empreinte des octets présents
  est la clé de la ligne) n'est **jamais** remplacé par une copie venue d'une archive (entrée à `bytes_sha256` différente de la clé), ni en
  fusion ni en remplacement — seuls les métadonnées et `remote` sont pris de l'archive (même règle que `missing_files`) ; symétriquement une copie
  locale est remplacée par un original de l'archive (entrée sans `bytes_*`) ; `verifyRestored` compare à ce que la restauration **promet**
  (`octetsRestaures(entry, ligne)`, pure, nommée une fois, comme `ficheRestauree` pour R61) ; le bilan dit « {n} originaux de cet appareil
  conservés (l’archive portait des copies). » quand n > 0 (singulier sur le gabarit de `messageRenvoi`) ; coût si faux : une archive ne peut plus
  servir à dégrader volontairement un original (personne ne le demande). Où : D-G3 (une phrase), I-G3 (amendé : « rien n'est jamais réécrit dans
  le blob local » borné au serveur, l'archive dite), § 3.4 (`octetsRestaures`, `applyArchive` — `existingFiles` dans les deux modes, retour
  `originauxConserves` —, `verifyRestored`), § 4.6 (bilan, `messageOriginauxConserves`), § 5 (deux chaînes), § 7 tests (e4) à (e7) et les trois
  mutants demandés (« blob tel quel » → (e4) et (e5) rouges ; comparaison brute dans `verifyRestored` → rouge) plus deux (`existingFiles` vide en
  remplacement ; `garder` sans `!entreeOriginale`), § 9 tâche 2, § 11 (limite par la taille, étendue à la restauration), en-tête (lecture du code).
  Les mineurs m-1 à m-4 de la même vérification ne font l'objet d'aucun ruling et restent à la construction (hors verdict).

### Rév. 4 → construction : ce que le chef d'orchestre a tranché (R-G-7 à R-G-30, 20 octobre 2026)

**Départ (rejeu du plan rév. 3 par intention, voie (b), sur la tête finale du lot B `cf91f09` ; spec commise `3601a52`, plan rejoué `c227711`).** Les
écarts d'intention entre le plan G (écrit sur `bd03e48` / `4cb99a0`) et le code commis de B sont tranchés en faveur du code commis :
- **R-G-7** — la suite G (`runSyncL4Tests`) s'enregistre dans `tests/tests.js` après `runLectureWebTests` (lot B).
- **R-G-8** — base en `0.10.0` : `APP_VERSION` passe à `0.11.0` et `sw.js` à `cuisine-os-v0.11.0-1` dès la tâche 1 ; pins relevés à `3601a52`.
- **R-G-9** — `deps` de `renderImportCible` porte huit noms (dont `veilleMs`, lot A) ; une fiche à adresse part vers `renderImportWeb` ; F-9 reste propre à
  l'écran photo.
- **R-G-10** — `MODULES_NEUFS` et `CHAINES_NEUVES_AILLEURS` (`tests/ajouter.js`) : ajouts en fin de liste, rien retiré.
- **R-G-11** — `components.js` garde les ajouts de B ; `bookCover` et `pdfFrame` sont ceux du plan, à l'octet.
- **R-G-12** — `recipe.js` : `referenceOnly` devient async et garde la branche signet de B en tête.
- **R-G-13** — `docs/architecture.md` : la ligne visée est la l. 1276 ; la section du lot A n'est pas réécrite.
- **R-G-14** (C-1) — bloc de tests de la tâche 6 : une image `loading: 'lazy'` détachée n'est jamais chargée par Chrome ; l'image passe en `eager` avant
  l'attente (`finDesImages`, `vignettePage`). **R-G-15** (C-2) — le bloc de la tâche 5 « après la lecture des conflits » se place après
  `suivreMoteurDeLaPage(moteur);` (TDZ sinon). **R-G-16** (C-3) — la clé `import.js` du filet i18n porte une seule chaîne depuis `4cb99a0`.
- **Versions (R-E-18, R-B-24)** — tout commit qui touche `src/` ou `sw.js` incrémente `VERSION`, ronde comprise : T1 `-1` … T6 `-11`, ronde 1 de T6 `-12`,
  vague finale `-13` ; épingle finale 4386.

**Construction (six tâches, une ronde chacune, re-revues propres ; tête de code `c42693f`).**
- **R-G-17 (condition `{ key, fusion }` de `db.mutate`)** — ratifiée : la forme minimale que demande I-G3 (relire et réécrire la ligne `files` dans la
  même transaction, sans statut) ; § 8 et § 11 amendés : la généralisation des conditions reste un lot à part, cette forme est celle du lot G.
  `conditionFichier` (réception, ajustement, tombale, archive), `peutEcrireRemote` / `peutEcrireOctets` (envoi, descente) la portent ; `src/sync/push.js`
  est touché par la tâche 1 pour refondre `reecrire.files` dans la transaction. Coût si faux : une ligne `files` réécrite depuis un instantané périmé
  effacerait un blob arrivé entre-temps.
- **R-G-18 (règles de fusion `files`)** — ratifiées : `decider` adopte, à instant égal, un remote serveur valide quand celui d'ici est invalide (I7
  amendé) ; la passe unique retire aussi `cursor:files` (D-G12 étendue) ; `garderIci` refuse sur `files` une version d'ici nulle (D-G15) ; `remoteValide`
  borne `uploaded_at` (40 points de code) et le remote sérialisé (4 096 unités) ; `putFile` d'origine remote n'écrit jamais sur une ligne qui a déjà un
  blob ; `fusionnerFichier` borne la fusion aux `CHAMPS_FILES_SERVEUR`. Limites au § 11.
- **R-G-19 (archive)** — ratifiés : en remplacement aussi, une page de `missing_files` garde les octets d'ici (`decisionManquante`, taille et type d'ici ;
  § 3.4 amendé : I-G3 et le But priment sur « les octets locaux des pages de missing_files sont retirés ») ; un blob gardé (R-G-6 ou page manquante)
  garde sa taille et son type d'ici (§ 3.4 « métadonnées toujours prises de l'archive » amendé) ; `verifyRestored` compare à la décision prise ;
  `inspectArchive` refuse `bytes_sha256 === sha256` quand `bytes_size !== size` ; `applyArchive` écrit par `db.mutate({ conditions: { files } })` ;
  `syncable` écrit à la restauration ; `requireInspection` revalide `files` ; `HASH = HASH_FICHIER`. Refus ratifié : `compterFichesSynchronisees` suit
  B-25 tel qu'écrit et annonce un nombre trop grand (la capture D-G8 n'envoie que les lignes à remote de ce compte) — dette, § 13.
- **R-G-20 (passe fichiers)** — ratifiés D-R1-a à D-R1-f : une erreur de `lister` après un 409 est une erreur d'envoi (auth → attente de connexion,
  réseau → recul, refus / quota / inconnu → recul ; jamais d'upsert, de `file_error` ni de `pause_fichiers`) ; sous HTTP 400 un `statusCode` à trois
  chiffres classe l'erreur, `InvalidJWT` et `AccessDenied` valent `auth` (forme réelle chez `mitsu` non mesurée) ; le remote est validé avant l'envoi
  (fichier vide ou type hors liste → `file_error` `forme`, sans appel réseau) ; toute levée de `reduire` donne l'original ; `restants` de
  `telechargerTout` compte les candidates tentées sans issue et la clé ne tombe que si rien ne manque ; `reculMs` vit dans `clock.js`. Refus ratifiés :
  `size < 1` reste candidat (marqué une fois à l'envoi) ; `LIMITES_FICHIERS` intact, `ESPACE` à part.
- **R-G-21 (moteur)** — ratifiés : `envoyerMaintenant` tenu dans `vols` et rend `{ erreur: { type: 'arrete' } }` après l'arrêt ; motif `file_error`
  `illisible` (envoi) pour un original dont le blob ne se relit plus ; une levée de la phase fichiers ne va qu'au journal (`sync.fichiers`). Limites au § 11.
- **R-G-22 (Réglages)** — ratifiés : quatre textes neufs hors § 5 (l'aide de la qualité nomme ce qui part tel quel ; « Fichier vide ou mal formé : il reste
  sur cet appareil seulement. » ; « Fichier illisible sur cet appareil. ») ; sous `pauseFichiers`, « Télécharger toutes les pages » n'est plus proposé
  (le moteur suspend toujours, § 3.2 tient) ; `MOTIFS_FICHIER` / `motifFichier` vivent dans `components.js`. Reportés : course entre onglets sur
  « Arrêter », singuliers et plancher « ~0 Mo », `toFixed(1)` préexistant.
- **R-G-23 (écrans)** — ratifiés : `contexteFichiers` rend la `Map` des `file_error` ; option `uid` de `pdfFrame`, qui ne dit l'état que si le geste est
  câblé ; « Page originale » (`en.js`) ; la couverture garde son propre état (double tape, refresh) ; le succès d'un téléchargement se décide sur les
  octets relus. Dette : deux tapes concurrentes sur la même clé donnent un toast d'échec transitoire alors que les images arrivent. Survivants
  ÉQUIVALENTS déclarés : G13 et G16 (`invalidate()` retiré : le cache de `getData` ne charge pas `files`).

**Vague finale (chef d'orchestre, inline ; commit `c42693f`).**
- **R-G-24 (correctness)** — un refus « conflit » de `sync_push` sur `files` ne fait aucune entrée de journal : le serveur refuse aussi une version plus
  ANCIENNE que la sienne (pas seulement l'instant égal de D-G16), deux appareils qui envoient le même original se refusaient l'un l'autre et « Conflits
  à trancher » nommait une empreinte (I-G8). Retirer sans journal, comme K-5 ; la réception écrit la version du serveur par `conditionFichier` (blob
  gardé) et son remote de ce compte arrête la candidature. Réglages nomme une ligne `files` en quarantaine ou en conflit par `nomFichier` dès qu'un
  snapshot est là (lu aussi dans ces deux cas) ; sans snapshot, la forme bornée de L3. Coût si faux : une ligne `files` refusée pour une autre raison
  qu'un doublon n'est plus montrée comme conflit — elle repart par la capture ou reste en quarantaine, nommée.
- **R-G-25 (sécurité)** — une copie ne porte jamais la taille de l'original dans une archive (`bytesValides`) ; `createArchive` décrit une copie locale de
  même taille avec `size: 0` ; filet à l'envoi : des octets partis tels quels dont l'empreinte n'est pas la clé ne partent pas (`file_error` `forme`).
  § 11 amendé (le « négligeable » devenait choisi par qui fabrique l'archive).
- **R-G-26 (faux-verts)** — gardes `type` de `bookCover` et `poserImage` épinglées par une ligne `application/pdf` aux octets JPEG (P1) ;
  `conditionFichier` « bougée » et « disparue depuis la lecture » épinglées (tests purs + réception) ; libellés corrigés.
- **R-G-27** — `upload_quality` (« par appareil, jamais synchronisé », § 3.3) ne voyage pas dans l'archive et n'est pas écrit à la restauration
  (`CLES_PAR_APPAREIL`, une définition pour les deux sens) ; limite au § 11 pour le mode remplacement.
- **R-G-28** — avec un compte, la confirmation d'« Effacer les données de cet appareil » dit « Les photos pas encore envoyées seront perdues. » et la
  section « Données » dit « …sauf les photos pas encore envoyées. » (la file ne compte que les fiches, D-G8). Refuser le geste tant que des photos
  restent à envoyer est laissé à Neegan (§ 13).
- **R-G-29** — limites et dettes de la revue finale nommées sans code : § 11 (reprise après erreur passagère, `conflit_renvoyer`, `uid` nul, cache HTTP,
  aperçu de la couverture, relecture du snapshot) et § 13 (identité des remotes à l'écho — F-23 —, `nomFichier` reconstruit trois `Map` par appel, trois
  copies de la regex HASH, alias mort `SYNCHRONISEES`, retypage recopié, fidélité du Storage factice au 404, assertions creuses nommées l. ~1885 et
  ~394 de `tests/sync-l4.js`, le contrôle « I-G8 lu dans les modules » admis comme contrôle supplémentaire).
- **R-G-30 (méthode)** — la vague n'a pas pu être faite par un agent (limite de dépense du compte, 20 octobre) : le chef d'orchestre l'a faite inline,
  tests d'abord (les rouges mesurés par les mutants M1 à M10 sur copies servies à part, le code étant corrigé au moment du premier passage), suite 4387/4387,
  Node 174/174, `--check` 0, invisibles 0 ; aucune re-revue à trois lentilles n'a relu ce diff : elle est due avant la fusion de G.

## 13. Points à trancher par Neegan

**Aucun.** Les cinq points de la rév. 2 sont tranchés par le chef d'orchestre (R-G-1 à R-G-5, § 12), et le Critical de la vérification de la
rév. 3 par R-G-6 (rév. 4, § 12). Ce qui reste n'est pas une décision mais
une **mesure** due par § 10 : la forme réelle du « déjà présent » (geste 7) et la hauteur du mur de pixels sur l'iPhone (geste 8, « à relever
après mesure ») — si l'une contredit la spec, elle s'amende avant la suite (§ 10, dernier alinéa).

**Depuis la construction (20 octobre 2026) :**
1. **Décision de produit (R-G-28)** : faut-il REFUSER « Effacer les données de cet appareil » tant qu'il reste des photos à envoyer ou refusées à l'envoi,
   plutôt que de nommer la perte dans la confirmation (fait) ? Coût du refus : un appareil qui ne peut plus envoyer (fichier refusé) ne pourrait plus
   s'effacer sans « Abandonner » chaque refus.
2. **Dettes (R-G-19, R-G-23, R-G-29)** : `compterFichesSynchronisees` annonce un nombre trop grand avant le geste (B-25 contre D-G8) ; registre partagé des
   descentes en vol (toast transitoire sur deux tapes) ; identité des remotes à l'écho (F-23) ; `nomFichier` et ses trois `Map` ; trois copies de HASH ;
   alias `SYNCHRONISEES` ; retypage recopié dans `bookCover` / `poserImage` ; Storage factice et le 404 ; assertions creuses nommées.
3. **Re-revue due (R-G-30)** : le diff de la vague finale `c42693f` doit être relu à trois lentilles AVANT la fusion de G, dès que des agents sont disponibles.
