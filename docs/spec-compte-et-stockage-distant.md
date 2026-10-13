# Spécification — Compte et stockage distant (Cuisine OS, lot « synchronisation »)

**Version 3 — 12 octobre 2026.** Rédigée par Claude Code (terminal) sur « ok Go » de Neegan. v1 attaquée par deux
revues adverses (faisabilité : 36 constats ; sécurité : 24) ; v2 re-relue (18 constats nouveaux, 5 trous, 16 partiels
identifiés) ; **v3 = tout intégré** (traçabilité § 10 ; rapports dans le scratchpad de la session). **À relire par
Neegan**, puis exécutée lot par lot par la session VibeForge. Conception amont : `docs/compte-et-stockage-distant.md`
(§ 7 bis y dit ce que la présente spec remplace). Spec mère : `cuisine-os-spec-v3.md`.

Vocabulaire : **DOIT** = exigence testée (chaque DOIT renvoie à une preuve du § 7) ; **PEUT** = permis ;
**OUVERT** = décision reportée, le code ne la préjuge pas.

---

## 1. But et périmètre

Permettre à Neegan d'utiliser **la même bibliothèque** sur iPhone, iPad et Mac : ce qui est photographié ou corrigé
sur un appareil se retrouve sur les autres, sans ZIP à transporter, et la bibliothèque tient hors de la mémoire du
téléphone. L'app reste utilisable **hors ligne** et **sans compte**.

**Ordre de grandeur, dit franchement** : le palier gratuit de Supabase offre **1 Go** de fichiers — avec des photos
originales de 1,5 à 3 Mo, c'est 350 à 650 pages, soit un livre et demi ; avec des photos **réduites** (~400 Ko par page,
**défaut retenu, D2**) c'est ~2 500 pages, et l'original reste sur l'appareil qui l'a pris. Au-delà : palier Pro
(100 Go, ~25 $ US/mois). L'interface affiche toujours où on en est (§ 4.2) ; rien ne surprend.

**Dans le lot :** connexion Google (deux adresses autorisées), base Postgres (Supabase, projet « mistu ») miroir des
magasins, fichiers (photos, PDF, EPUB) dans un bucket privé, file d'envoi locale, **envoi initial** de la bibliothèque
existante, réception par curseur serveur, conflits visibles, quarantaine visible, second appareil, suppression réelle
(par fiche et globale), archive ZIP conservée, durcissement du client (CSP, cadres isolés).

**Hors lot (ne pas construire) :** partage entre personnes, bibliothèque commune d'entreprise, rôles, tuile et
connexion unique dans le portail Oraquan, recherche ou IA côté serveur, chiffrement de bout en bout, synchronisation
des réglages, envoi reprenable (TUS), auto-hébergement (possible plus tard, non fait).

## 2. Invariants

I1. PWA **sans build**, aucune dépendance npm à l'exécution, GitHub Pages. La seule bibliothèque tierce est
    `supabase-js`, **embarquée en un fichier autonome** (§ 6.1).
I2. Les **26** magasins IndexedDB existants, leurs clés (`id` ; `edition_id` pour `rediscovery_prefs` ; `sha256` pour
    `files` ; `key` pour `settings`), leurs identifiants préfixés générés par l'app et `RELATIONS` ne changent pas.
    Le lot ajoute trois magasins internes (§ 5.1).
I3. L'archive ZIP `cuisine-os-archive` v1 reste produite et restaurable depuis l'état local ; une archive produite
    **avant** le lot reste inspectable et restaurable **après** ; les magasins internes n'y entrent jamais ; la
    restauration n'applique aucun refus de type de fichier.
I4. Sans compte, l'app se comporte exactement comme avant : capture de n'importe quel fichier, archive, restauration
    (preuve : suite complète verte sans compte, § 7.1).
I5. Principes de la spec mère : l'original n'est jamais réécrit ; aucune donnée inventée ; **un état affiché reflète
    un événement réel** — « envoyé » = accusé du serveur, « effacé du serveur » = nombre de lignes supprimées ≥ 1.
I6. Dépôt public : aucune adresse, aucun nom, aucune clé secrète dedans. La clé `anon` est publique par conception ;
    la clé `service_role` n'existe nulle part dans le projet ni dans une conversation d'agent.
I7. **Le plus récent gagne, partout**, avec la même règle à l'envoi et à la réception : `updated_at` strictement
    supérieur gagne ; égal avec contenu identique = rien ; égal avec contenu différent = **conflit** à trancher par
    la personne. `updated_at` est l'horloge du client, corrigée par le décalage mesuré avec le serveur (§ 5.3) et
    ramenée à l'heure du serveur au-delà de 5 minutes dans le futur (§ 3.4). Aucune fusion silencieuse de champs.

## 3. Serveur (Supabase, projet « mistu »)

**Portée géographique** : Postgres et Storage sont dans la région Canada (Central). Les journaux de la plateforme,
le service d'authentification et le détour OAuth par Google **sortent du Canada** ; c'est consigné, et une
évaluation des facteurs relatifs à la vie privée sera faite avant toute ouverture aux employés.

### 3.1 Tables
Une table `public.<magasin>` pour chacun des **25** magasins synchronisables (`SYNC_STORES` = tous les magasins de
`STORES` **sauf `settings`**, exporté par `schema.js` ; test : `SYNC_STORES.length === 25` et égalité avec la liste
de `sync_push`). `settings` n'est jamais synchronisé. `library_activity` a sa table mais est **traité à part**
(§ 5.2 : ni capture, ni envoi initial, ni réception sans le réglage explicite).

Forme commune des 25 tables :

```sql
create table public.recipes (
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id          text not null,                       -- la clé du magasin (id | edition_id | sha256)
  data        jsonb not null,                      -- la fiche telle que l'app la stocke ; '{}' pour une tombale née supprimée
  updated_at  timestamptz not null,                -- horloge du client (corrigée, bornée § 3.4) ; arbitrage I7
  server_seq  bigint not null,                     -- ordre de réception : nextval('public.sync_seq') (déclencheur, § ci-dessous)
  deleted_at  timestamptz,                         -- tombale ; posée par le serveur
  primary key (owner_id, id),
  edition_id  text generated always as (data->>'edition_id') stored   -- colonnes générées : voir tables.js
);
create index recipes_recv on public.recipes (owner_id, server_seq);
create index recipes_edition on public.recipes (owner_id, edition_id);
```

- DOIT : clé primaire **composée** `(owner_id, id)` ; `id` seul n'est jamais unique (deux comptes peuvent avoir le
  même `id` : références corrigées à identifiant fixe, `files` dont la clé est l'empreinte).
- DOIT : `owner_id` **non nul** ; un `insert` avec `owner_id` NULL est refusé (preuve § 7.2). Les références communes
  de la trajectoire « employés » vivront dans des tables `ref_*` séparées (hors lot).
- DOIT : `src/sync/tables.js` déclare, **par table**, (a) les colonnes générées = les index de `STORES` **plus** les
  colonnes supplémentaires explicitement listées (`files` : `size` par `((data->>'size')::bigint)`, `mime` par
  `(data->>'mime')`), (b) les champs de relation **obligatoires** de la fiche (`recipe_versions.recipe_id`,
  `source_pages.document_id`, …). La migration est générée depuis cette liste ; le test § 7.1 compare la migration à
  `tables.js` (pas à `STORES.indexes` seul).
- DOIT : `server_seq` vient d'une **séquence globale** `public.sync_seq`, posée par un déclencheur `before insert or
  update` **seulement si** `data`, `updated_at` ou `deleted_at` changent **et** que `current_setting('app.maintenance',
  true)` n'est pas `'on'`. Toute maintenance SQL (dont la tâche des tombales) pose `set local app.maintenance = 'on'` :
  elle ne réémet rien aux appareils (preuve § 7.2).
- DOIT : `public.files` porte en plus la contrainte `check (not (data ? 'blob'))` : les octets ne sont jamais dans la
  base (preuve § 7.2).
- Tombales : `deleted_at` posé par le serveur ; `data` conservé **90 jours** (lisible par la personne : « Fiches
  supprimées encore sur le serveur », § 4.2, avec « Restaurer » et « Effacer définitivement ») puis vidé (`'{}'`) par
  une tâche `pg_cron` sous `app.maintenance`. La ligne reste (ordre de réception).
- `on delete cascade` est le chemin de **suppression de compte** (tout disparaît avec `auth.users`) ; dit ici pour que
  « jamais d'effacement » ne soit pas lu comme une promesse absolue.

### 3.2 Règles d'accès
Schéma `private` **non exposé** à l'API (`revoke usage on schema private from anon, authenticated`) :
- `private.allowed_users(email text primary key check (email = lower(email) and email like '%@%'), added_at
  timestamptz default now())` — alimentée par Neegan dans l'éditeur SQL (`insert … values (lower('…')) on conflict do
  nothing`) ; les adresses ne transitent jamais par le dépôt ni par un agent.
- `private.is_allowed() returns boolean` — `security definer`, `stable`, `set search_path = ''` :
  `exists (select 1 from private.allowed_users a where a.email = lower(auth.jwt()->>'email'))`. Exécutable par
  `authenticated` (ne révèle que « moi, suis-je autorisé »).
- `private.before_user_created(event jsonb) returns jsonb` — fonction du crochet B1 (§ 3.3) : `grant execute … to
  supabase_auth_admin`, `revoke … from public, anon, authenticated`.

Sur chacune des 25 tables, RLS activée, **toute** règle pour `authenticated` porte la condition d'autorisation :
- `select` : `private.is_allowed() and owner_id = auth.uid()`
- `insert` : `with check (private.is_allowed() and owner_id = auth.uid())`
- `update` : `using (…) with check (…)` mêmes conditions
- `delete` : `using (private.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on')` —
  franchissable **seulement** depuis les fonctions de purge (§ 3.5), qui posent `set local app.purge = 'on'` ; un
  `delete` direct par l'API est refusé (0 ligne) — preuve § 7.2. *(Remplace le brief § 4.2.)*
- `revoke all on all tables in schema public from anon` ; preuve : `has_table_privilege('anon', …)` = false sur les 25.
- `revoke execute on function public.sync_push(jsonb), public.sync_purge(text, text), public.sync_purge_all() from
  public, anon ; grant … to authenticated` ; preuve : `has_function_privilege('anon', …, 'execute')` = false.
- DOIT : une adresse retirée de `allowed_users` perd l'accès **à la requête suivante** (preuve § 7.2).

### 3.3 Qui peut se connecter — trois barrières, nommées par solidité
- **B0 — Google** : l'écran de consentement reste en statut *Testing* avec les adresses de Neegan en *Test users* :
  Google refuse tout autre compte **avant** Supabase. C'est la barrière réelle d'aujourd'hui ; elle **tombe** le jour
  de l'ouverture aux employés (écran « In production ») — ce passage est un geste gaté : § 7.2 rejoué en entier.
- **B1 — crochet « Before User Created »** (Auth Hook, fonction Postgres `private.before_user_created`, palier Free) :
  refuse la création si `email` est nul ou absent de `private.allowed_users`, en renvoyant
  `{"error":{"http_code":403,"message":"adresse non autorisée"}}`. La migration **crée** la fonction ; **son
  branchement est un geste de Neegan** (Authentication → Hooks → Before User Created), prouvé par
  `supabase/proofs/0001_hook.md` (capture de la page Hooks : hook actif, fonction choisie). Défense secondaire :
  déclencheur `before insert on auth.users` (`security definer`, `set search_path = ''`, `if new.email is null or not
  exists (…) then raise`).
- **B2 — RLS** avec `private.is_allowed()` dans chaque règle (§ 3.2) : un compte créé par erreur ne peut **ni lire ni
  écrire**, et une adresse retirée de la liste perd l'accès à la requête suivante.
- DOIT (réglages du projet, preuve `supabase/proofs/0001_providers.md` = capture de la page Providers) : **seul le
  fournisseur Google est activé** ; e-mail/mot de passe, magic link, OTP téléphone et connexions anonymes sont
  explicitement désactivés ; « Confirm email » activé ; liaison automatique d'identités désactivée.

### 3.4 Fonction d'envoi `public.sync_push(rows jsonb) returns jsonb`
`security invoker` (sous RLS ; **la passer en `security definer` est interdit**, quel que soit le problème qu'on
croit régler). Entrée : tableau d'objets `{ store, id, data, updated_at, deleted }` ; **500 éléments au plus et 1 Mo
de JSON au plus** (le client borne avant l'appel ; le serveur refuse au-delà, sans rien écrire). Sortie :
`{ server_time, accepted: [{store,id}], adjusted: [{store,id,updated_at}], rejected: [{store,id,reason,server?}] }`.
- `store` DOIT être comparé (sensible à la casse) à un `array[...]` littéral des 25 noms **avant** toute
  interpolation, puis interpolé **uniquement** par `format('%I')` ; jamais de concaténation.
- `forme` : `data` DOIT être un objet contenant la clé du magasin (`id` = `data->>'<keyPath>'`) **et** les champs de
  relation obligatoires déclarés dans `tables.js` ; sinon rejet (motif `forme` ; `clé` si c'est la clé qui manque ou
  diffère). Tombale à `data` nul : exemptée.
- `updated_at` manquant ou non analysable → rejet (motif `updated_at`). `updated_at` dans le futur de plus de
  5 minutes → **ramené à `now()`** et renvoyé dans `adjusted` (le client réécrit sa fiche locale **sans capture**, § 5.3).
- `pg_column_size(data) > 1 Mo` → rejet (motif `taille`).
- Ligne absente : insertion avec `owner_id = auth.uid()` (`data = '{}'` si tombale à `data` nul).
- Ligne présente : `updated_at` entrant **>** en base → remplacement de `data`, `updated_at`, `deleted_at` (posé si
  `deleted`, remis à NULL sinon ; tombale à `data` nul : `data` existant conservé) ; **égal et `data` identique** (ou
  tombale sur tombale) → `accepted` **sans écrire** (réessai idempotent ; `server_seq` inchangé, preuve § 7.2) ;
  sinon → rejet (motif `conflit`) avec la version serveur (`data`, `updated_at`, `deleted_at`).
- **Jamais d'exception pour un élément** : chaque élément finit dans `accepted`, `adjusted` ou `rejected` ; l'appel
  entier n'échoue que pour une entrée malformée (pas un tableau, trop grand) — et alors rien n'est écrit.
- `server_time` = `now()` du serveur, renvoyé à chaque appel (correction d'horloge, § 5.3).

### 3.5 Suppression réelle
- `public.sync_purge(store text, id text) returns integer` : `security invoker` ; `set local app.purge = 'on'` ;
  `delete … returning` ; pour `files`, supprime aussi l'objet `pages/<owner_id>/<sha256>` ; **renvoie le nombre de
  lignes réellement supprimées**.
- `public.sync_purge_all() returns integer` : même mécanique sur toutes les lignes et objets du propriétaire courant.
- DOIT (I5) : l'app n'affiche « effacé du serveur » que si le nombre renvoyé est ≥ 1 ; 0 → « Rien n'a été effacé »
  avec le motif connu.

### 3.6 Fichiers
- Bucket **privé** `pages`, créé avec `file_size_limit = 50 Mo` (plafond du palier Free) et `allowed_mime_types` =
  la **liste blanche** du lot (`src/sync/mime.js`, unique) : `image/jpeg`, `image/png`, `image/webp`, `image/heic`,
  `application/pdf`, `application/epub+zip`. Quota total du palier Free : **1 Go** (nommé partout où il compte).
- Chemin : `<owner_id>/<sha256>` **sans extension** ; le type est porté par `contentType` à l'envoi et par la ligne
  `files` (`data.mime`).
- Règles sur `storage.objects` pour `authenticated` (`select`, `insert`, `update`, `delete`) :
  `private.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text` ; le `delete`
  n'est appelé que par les fonctions de purge et par la réécriture d'un objet corrompu (§ 5.4).
- Pas d'envoi reprenable dans ce lot : un fichier > 50 Mo est **refusé avant la tentative** et reste visible en file
  avec `last_error = 'fichier trop volumineux'` (O4).
- Vue `private.storage_usage` (octets par propriétaire) ; OUVERT : quota dur par utilisateur avant le multi-utilisateurs.

### 3.7 Migrations et preuves
`supabase/migrations/0001_tables_et_regles.sql` (séquence, 25 tables générées depuis `tables.js`, déclencheur
`server_seq`, RLS dont la règle `delete` gardée, `private`, `is_allowed`, fonction du crochet B1 + déclencheur,
`sync_push`, `sync_purge`, `sync_purge_all`, révocations, tâche `pg_cron` des tombales), `0002_stockage.sql`
(bucket, règles, vue). Preuves `supabase/proofs/0001_*.sql`, `0002_*.sql` (requêtes à coller après application,
résultat attendu en commentaire), `0001_hook.md`, `0001_providers.md` (captures). Aucune valeur personnelle dans ces
fichiers. Le même jeu de migrations est appliqué au **projet de développement** (D8, § 8).

## 4. Client — connexion

### 4.1 Module `src/sync/auth.js`
- `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', persistSession: true,
  detectSessionInUrl: true } })` depuis `globalThis.supabase` (§ 6.1). DOIT : si `globalThis.supabase?.createClient`
  est absent, l'app affiche « La bibliothèque de synchronisation n'a pas été chargée » et la synchronisation reste
  désactivée (test § 7.1). URL et clé dans `src/sync/config.js` (commité : valeurs publiques).
- `signIn()` : `signInWithOAuth({ provider: 'google', options: { redirectTo } })` avec `redirectTo` = l'URL de l'app
  **sans fragment** (sinon GoTrue colle la requête après `#` et le code n'est jamais lu).
- Retour : après l'échange, `history.replaceState(null, '', location.pathname + location.hash)` — le fragment de
  route est conservé, `code` disparaît de l'historique (test § 7.1). Un refus (`error`, `error_code`,
  `error_description` dans la requête **ou** le fragment) est reconnu et affiché « Cette adresse n'est pas
  autorisée. » ; le texte brut n'est jamais montré.
- **Garde de compte** : à toute connexion, si `sync_state.user_id` existe et diffère de `auth.uid()`, la
  synchronisation **reste désactivée** et l'app explique : « Cet appareil a été synchronisé avec <adresse>. » avec un
  geste exécutable, **« Changer de compte sur cet appareil »** : double confirmation, exige qu'une archive ZIP ait
  été créée pendant la session, annonce « N envois en attente seront perdus — ils sont dans l'archive », puis appelle
  `repo.clearDevice()` (§ 5.1). Chaque entrée d'outbox porte `user_id` et n'est jamais envoyée sous un autre compte.
- `signOut()` : ferme la session locale (`scope: 'local'`) ; ne touche pas aux données ni à la file (conservée,
  état « en attente de connexion »).
- **Mesure iOS avant L3** : une PWA installée a son propre conteneur de stockage ; si le retour de Google atterrit
  dans Safari et non dans l'app, `signIn()` passe à `skipBrowserRedirect: true` et ouvre l'URL obtenue par
  `window.open` **sur le geste de l'utilisateur**. Le résultat (version d'iOS, chemin retenu) est consigné dans
  `CLAUDE.md` et conditionne L3.

### 4.2 Interface (Réglages → « Synchronisation »)
- Désactivée : « Tes données restent sur cet appareil. » + bouton **« Activer la synchronisation »** (seul libellé).
- Activée, par lot (§ 8) : **L2** « Connectée : <adresse> », « À envoyer : N », « Se déconnecter » ; **L3** +
  « Dernier échange : <heure> », « En quarantaine : N » (§ 5.3), « Conflits : N » (§ 5.5), « Envoyer maintenant » ;
  **L4** + « Espace serveur : X Mo **sur 1 Go** (palier gratuit) » avec barre, et au-delà de 80 % « Il reste de la
  place pour environ N pages — le palier Pro (100 Go) est à ~25 $/mois », « Télécharger toutes les pages (N fichiers,
  ~M Mo) », réglage « Qualité d'envoi des photos » (§ 5.4), « N fichiers de type inconnu ne seront pas
  synchronisés » ; **L5** + « Fiches supprimées encore sur le serveur (N) » (tombales < 90 jours : « Restaurer » =
  relit `data` du serveur, `updated_at` neuf, mise en file ; « Effacer définitivement » = `sync_purge`, confirmation
  simple), « Supprimer ma bibliothèque du serveur » (double confirmation, `sync_purge_all`), « Effacer les données
  de cet appareil ».
- Réglage « Synchroniser mon historique de consultation » (désactivé par défaut) : l'activer déclenche l'envoi
  initial de `library_activity` ; le désactiver purge ses lignes du serveur (`sync_purge` par ligne) et affiche
  « Ton historique de consultation a été retiré du serveur (N lignes). »
- Pendant l'envoi initial : « Envoi initial : <table> N/24 » (25 moins `library_activity`, sauf réglage) ; pendant
  la première réception : « Réception : <table> N/24 ».
- « Effacer les données de cet appareil » : refusé tant que la file d'envoi n'est pas vide (« N éléments ne sont
  pas encore envoyés » ; les entrées en quarantaine comptent : « Abandonner » d'abord) ; sinon `repo.clearDevice()`.
  Texte : « Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur. »
- Les magasins internes n'apparaissent pas dans les puces « Données sur cet appareil ».
- En-tête : pastille « N non envoyés » quand N > 0. Toutes les chaînes par `t()` ; `en.js` complété.
- `sync_state.device_id` remplace `localStorage['cuisineos.device']`, migré à la montée `DB_VERSION 2`.

## 5. Client — synchronisation

### 5.1 Magasins internes (`DB_VERSION` 1 → 2) — `SYNC_INTERNAL_STORES = ['outbox', 'sync_state', 'sync_conflicts']`
- `outbox` : `{ seq (clé autoIncrement), user_id, store, id, op: 'put'|'delete', updated_at, payload, tries,
  last_error, quarantined_at }` — `payload` = copie de la fiche **au moment de la suppression** ; pour un `put`, la
  fiche est relue à l'envoi.
- `sync_state` : `{ key, value }` — `user_id`, `device_id`, `cursor:<table>` (dernier `server_seq` reçu),
  `backfill:<table>` (= `'fait'` quand l'envoi initial de la table est terminé), `last_exchange_at`,
  `clock_offset_ms`, `clock_warned_at`, `file_error:<sha256>`.
- `sync_conflicts` : `{ id (= store:id), store, record_id, local, server, at }`.
- DOIT : `schema.js` exporte `SYNC_INTERNAL_STORES` et
  `ARCHIVE_DATA_STORES = Object.keys(STORES).filter((s) => s !== 'files' && s !== 'settings' &&
  !SYNC_INTERNAL_STORES.includes(s))` ; `validateRows`, `checkRelations`, `verifyRestored` n'en voient aucune trace ;
  absents des puces. Preuve § 7.1 : une archive v1 produite **avant** le lot est inspectée et restaurée après la
  montée en `DB_VERSION 2`.
- DOIT : **jamais vidés par un remplacement ZIP** (`applyArchive` efface `Object.keys(STORES)` moins
  `SYNC_INTERNAL_STORES`) ; vidés **seulement** par `repo.clearDevice()`.
- `repo.clearDevice()` DOIT, en une seule transaction `db.mutate` **sans capture** : vider `Object.keys(STORES)` moins
  `SYNC_INTERNAL_STORES`, vider `sync_conflicts`, vider `outbox`, retirer de `sync_state` toutes les clés **sauf**
  `device_id` (`user_id`, `cursor:*`, `backfill:*`, `clock_*`, `file_error:*` compris) ; puis `signOut({ scope:
  'local' })` et suppression de la clé de session de `supabase-js` dans `localStorage`.
- `db.js` : prend en charge `autoIncrement` dans la définition d'un magasin et gagne `mutate({ puts, deletes,
  clearStores, origin })` — **une seule transaction** sur l'union des magasins ; `put`, `putMany`, `putBatch`,
  `delete`, `deleteMany`, `clear`, `clearAll` deviennent des enveloppes de `mutate` (signatures inchangées ;
  `tests/backup.js` reste vert) ; `db.js` exporte `MUTATING_METHODS` (la liste de ces noms) pour le test statique.
- `keyOf(store, record)` = `record[STORES[store].keyPath]`, fonction unique pour l'outbox, l'envoi et la réception.

### 5.2 Capture des écritures (`src/sync/outbox.js`) — **active dès L2**
- DOIT : la capture est posée dans `db.mutate` (une seule porte) : toute écriture ou suppression d'un magasin de
  `SYNC_STORES` ajoute son entrée d'outbox **dans la même transaction**, sauf `origin: 'remote'` (réception,
  ajustements) et sauf `library_activity` sans le réglage.
- DOIT : plus **aucun** appel direct aux méthodes mutantes de `db` dans `src/ui` et `src/domain` **hors
  `src/domain/backup.js`** : les neuf sites (`grocery.js:22`, `import.js:169`, `home.js:77` et `:82`, `book.js:104`,
  `cook.js:65`, `:119`, `:122`, `settings.js:155`) passent par `repo.save / repo.remove / repo.clearDevice`.
  `backup.js` **garde** `db.putBatch(batch, { clearStores })` : la restauration reste **une seule** transaction, et la
  capture l'atteint par `mutate` sans modification. Test statique (§ 7.1) : pour chaque fichier de `SHELL` hors
  `src/model/repo.js`, `src/sync/` et `src/domain/backup.js`, échouer si la source contient
  `/\bdb\.(put|putMany|putBatch|delete|deleteMany|clear|clearAll)\s*\(/` ; échouer aussi si `MUTATING_METHODS`
  contient un nom absent de ce motif.
- DOIT : `putFile`, `recordActivity` et les écritures de `rediscovery_prefs` posent `updated_at` (preuve § 7.1 :
  lecture de la fiche écrite). `files.data` = liste blanche de champs (`sha256, mime, size, original_filename,
  created_at, updated_at, remote, syncable`) ; jamais `blob` (preuve § 7.1).
- Les caractères de contrôle (`\u0000` compris) sont retirés des chaînes avant l'envoi (PostgreSQL les refuse).
- **Envoi initial** (`backfill`) : commandé par les marqueurs, **pas** par `user_id` : à chaque passage d'envoi,
  toute table de `SYNC_STORES` (hors `library_activity` sans réglage) dont `sync_state` ne porte pas
  `backfill:<table> = 'fait'` est parcourue entièrement et mise en file, table par table, **avant** toute réception ;
  reprenable ; interface § 4.2. Ainsi un appareil connecté en L2 envoie sa bibliothèque dès L3.
- `library_activity` : exclu de la capture, de l'envoi initial **et** de la réception tant que le réglage est
  désactivé ; l'activer retire `backfill:library_activity` (envoi initial de rattrapage) ; le désactiver purge (§ 4.2).
- Restauration ZIP sur un appareil synchronisé : **fusion** = chaque fiche écrite reçoit un `updated_at` neuf
  (l'instant de la restauration) avant mise en file, et le bilan annonce « N fiches seront renvoyées au serveur » ;
  **remplacement** = refusé dès qu'une entrée d'outbox existe, connecté ou non (« Désactive et vide la file, ou
  restaure sur un appareil vierge »). OUVERT : remplacement avec tombales généralisées (O3).

### 5.3 Envoi (`src/sync/push.js`)
- Déclencheurs : connexion établie, `online`, écriture (regroupement 2 s), « Envoyer maintenant », retour au
  premier plan.
- Lots : ordre de `seq`, dédoublonnés par `(store, id)` (le plus récent), **≤ 500 lignes et ≤ 1 Mo de JSON** ; une
  fiche seule > 1 Mo part dans un lot d'une ligne et, refusée pour sa taille, va en quarantaine en nommant la fiche.
- `put` : fiche relue à l'envoi ; disparue → l'entrée devient `delete` avec son `payload`. `files` : la ligne n'est
  envoyée qu'après l'empreinte distante confirmée (§ 5.4) ; sinon `last_error = 'fichier en attente'` ; une ligne
  `syncable: false` n'est jamais mise en file.
- **Horloge** : chaque réponse porte `server_time` ; le client garde `clock_offset_ms` (serveur − local) et les
  `updated_at` des écritures synchronisées sont posés par `syncNow()` = local + décalage (jamais inférieur au dernier
  `server_time` vu). Si |décalage| > 5 min, avertissement unique « L'heure de cet appareil semble fausse (± X min) »
  (`clock_warned_at`). Preuve § 7.1 : deux horloges simulées (avance de 10 min, retard de 2 h) → aucun conflit
  fabriqué, aucune boucle.
- Réponses : `accepted` → retrait ; `adjusted` → retrait, puis réécriture de la fiche locale avec **exactement** le
  `updated_at` renvoyé, par `db.mutate({ …, origin: 'remote' })` (**non capturée**) ; `rejected{conflit}` → retrait +
  conflit (§ 5.5) ; `rejected{updated_at | taille | forme | clé}` → **quarantaine** immédiate avec motif ; réseau /
  5xx / 429 → `tries + 1`, recul 2 s, 4 s … plafond 5 min ; 401 → « en attente de connexion » ; **4xx autre (lot
  entier refusé)** → dichotomie jusqu'à isoler l'entrée fautive → quarantaine, le reste part ; refus de quota (`413`,
  `507`, message « exceeded ») → synchronisation **en pause** : « Espace serveur plein (1 Go au palier gratuit) —
  rien n'est perdu, tout reste sur cet appareil ».
- Quarantaine : après 5 refus permanents ou un motif permanent, `quarantined_at` posé ; Réglages affiche « En
  quarantaine : N » avec, par entrée, la fiche, le motif et deux gestes (« Réessayer », « Abandonner cet envoi » —
  qui ne touche pas à la fiche locale).
- I5 : « À envoyer » lit `outbox` ; une fiche n'est « envoyée » que par l'absence d'entrée la concernant.

### 5.4 Fichiers (`src/sync/files.js`)
- **Enregistrement local (I4 intact)** : si `blob.type` est vide ou hors liste, le type est résolu **une seule fois**
  par l'extension du nom d'origine contre la table de `src/sync/mime.js` ; si la résolution échoue, le fichier est
  enregistré `mime: 'application/octet-stream'`, **visible et utilisable localement**, marqué `syncable: false`,
  jamais envoyé, compté dans Réglages. Aucun refus local ; aucun refus à la restauration (I3).
- **Envoi** : `upload('<uid>/<sha256>', blob, { contentType, upsert: false })`, types de la liste blanche
  seulement. Un **409** n'est jamais un succès en soi : l'app télécharge l'objet distant, compare l'empreinte ;
  identique → confirmé ; différente → réécriture avec `upsert: true` puis nouvelle vérification. L'entrée de file ne
  disparaît qu'après **empreinte distante confirmée**.
- **Qualité d'envoi** (DOIT, L4) : réglage « Qualité d'envoi des photos » = **Réduite** (défaut, D2 décidée le 12 oct :
  JPEG, grand côté 2 000 px, cible ~400 Ko) ou *Originale* ; le choix est noté dans la provenance de la page
  (`upload_quality`) et l'estimation d'espace du § 4.2 en tient compte. L'original reste **toujours** sur l'appareil
  qui l'a pris (magasin `files` local), et une page peut être renvoyée en originale à la demande.
- **Réception** : une ligne `files` reçue arrive **sans octets** : écrite `remote: true`, sans `blob`. DOIT :
  `putFile(sha256, blob, { origin: 'remote' })` écrit le blob même si la ligne existe (retour anticipé seulement si
  `existing.blob instanceof Blob`). `createArchive` et `verifyRestored` DOIVENT ignorer les lignes sans blob ; le
  bilan d'archive dit « N pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l'archive »
  (preuve § 7.1).
- Téléchargement **à la demande** (ouverture d'une page) et par « Télécharger toutes les pages » (tant que l'app est
  au premier plan, reprenable) — aucune détection de réseau. `download(path)` → type vérifié contre la liste
  blanche, empreinte recalculée et comparée à la clé ; écart ou type hors liste → rien n'est écrit,
  `sync_state.file_error:<sha256>`, la page affiche « Fichier illisible reçu du serveur » + « Réessayer ».
- **Affichage (livré en L2, avant toute session)** : les blobs sont reconstruits avec un type de la liste blanche
  (`octet-stream` → affiché comme image seulement si l'image se décode, sinon « Télécharger ») ; les PDF/EPUB
  s'affichent dans une `<iframe sandbox>` **sans** `allow-same-origin`, avec, **en permanence** sous le cadre, le
  bouton « Télécharger le fichier » et la phrase « Si l'aperçu reste vide, télécharge le fichier » (le refus n'est pas
  détectable, I5) ; plus aucun `window.open` sur un `blob:`. Le rendu PDF en cadre sur iPhone est mesuré en L4 et
  consigné ; s'il est partiel, le PDF passe directement au téléchargement.

### 5.5 Réception et conflits (`src/sync/pull.js`)
- Par table (hors `library_activity` sans réglage) : `select … where server_seq > cursor order by server_seq limit
  1000`, paginé ; le curseur n'avance qu'après écriture locale réussie de la page (`origin: 'remote'`).
- Ligne reçue avec `deleted_at` → suppression locale ; sans → écrite **si** son `updated_at` est strictement
  supérieur au local (ou local absent). Local strictement plus récent → conservé, conflit journalisé **et** entrée
  d'outbox pour le renvoyer (le serveur l'acceptera : il est plus récent). **Égalité** : `data` identique → rien ;
  `data` différent → conflit journalisé, **sans** remise en file (résolution par le geste) — même règle qu'au § 3.4.
- Conflit (`sync_conflicts`) dans Réglages : « <titre> — version d'ici du <date>, version d'ailleurs du <date> »,
  gestes **« Garder celle d'ici (<date>) »** (restaure depuis `sync_conflicts.local`, `updated_at` neuf par
  `syncNow()`, mise en file) ou **« Garder celle d'ailleurs »** (écrit la version serveur localement, `origin:
  'remote'`, efface le conflit). Plus de 30 jours → retiré.
- `recipes.current_version_id` : quand une ligne `recipes` reçue change le pointeur alors que la version locale
  pointée n'est pas un ancêtre (`parent_version_id`) de la version reçue, un conflit est journalisé et la vue recette
  affiche « Une autre version a été créée ailleurs » avec les deux versions ; **aucune version n'est jamais masquée**.
- Première connexion : envoi initial (§ 5.2) **puis** réception complète (données) ; fichiers à la demande.

### 5.6 Service worker
- DOIT : le gestionnaire `fetch` ne met en cache **que** les requêtes `same-origin` dont `url.search` est vide ; une
  navigation avec paramètres (`?code=…`) est servie réseau et jamais stockée (test : après une navigation
  `?code=abc`, aucune clé de cache ne contient `code=`). Les autres origines ne sont pas interceptées (test).
- `src/vendor/…` et `src/sync/*.js` entrent dans `SHELL` ; `VERSION` incrémenté.

## 6. Dépendance embarquée et durcissement du client

6.1 `supabase-js` : fichier `dist/umd/supabase.js` du **tarball npm officiel** (bundle IIFE autonome, `globalName`
    `supabase`, ~215 Ko), version épinglée. **Deux vérifications distinctes**, notées dans `docs/architecture.md` :
    (1) l'archive `.tgz` confrontée au `dist.integrity` du registre npm ; (2) le fichier **extrait** haché en SHA-256
    et comparé octet pour octet au même fichier servi par unpkg. DOIT : chargé par un `<script src="./src/vendor/
    supabase-<version>.umd.js">` **classique** (jamais `type="module"` : un IIFE n'y exposerait rien) avant `app.js`
    ; absence détectée (§ 4.1). Le bundle `+esm` de jsDelivr est **exclu** (il importe huit modules du CDN à
    l'exécution). Mise à jour : manuelle, mêmes deux vérifications.
6.2 DOIT : `index.html` **et `tests/index.html`** portent `<meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:;
    frame-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'none'">`
    et `<meta name="referrer" content="no-referrer">` ; les styles et le gestionnaire d'erreur inline de
    `tests/index.html` passent dans des fichiers. `connect-src https:` reste large parce que la `base_url` d'IA est
    libre (assumé) ; `script-src 'self'` n'est jamais élargi ; **`frame-ancestors` n'est jamais ajouté** (WebKit
    l'hérite dans un document `blob:` et refuse alors le cadre). Preuve § 7.1 : les deux balises présentes, et un
    fichier `text/html` déposé dans la bibliothèque ne s'exécute pas et n'atteint pas `localStorage`.
6.3 Session : jetons gardés par `supabase-js` dans `localStorage`. **Tous les sites GitHub Pages d'un même compte
    partagent l'origine `neegans.github.io`** (et donc `localStorage`, IndexedDB, caches) : DOIT (D5, décidée le
    12 oct), avant la fin de L2, **une origine dédiée** à Cuisine OS — un sous-domaine d'un domaine de Neegan, par
    CNAME vers GitHub Pages (fichier `CNAME` dans le dépôt, HTTPS forcé). `redirectTo`, Site URL et Redirect URLs de
    Supabase, origines du client OAuth Google, `manifest.webmanifest` et `SHELL` suivent la nouvelle adresse ;
    l'icône iPhone est réinstallée. Tant que le CNAME n'est pas actif, aucune connexion réelle n'est faite depuis
    l'ancienne adresse.
6.4 Journal : un seul point `logError(code, { store, id })` remplace **tous** les `console.error(e)` du dépôt
    (`app.js:69,107`, `bus.js:12,15`) ; les cartes d'erreur affichent un code et un geste, **jamais `e.stack`** ni le
    corps d'une réponse réseau.
6.5 La clé d'IA reste en clair sur l'appareil (choix assumé, sans backend d'IA) ; `settings` n'est jamais
    synchronisé ; `SECRET_SETTING_KEYS` devient une liste de motifs et un test échoue si un réglage non listé porte
    `key`, `token` ou `secret` dans son nom.

## 7. Tests et preuves

7.1 `tests/sync.js` (bases temporaires `cuisine-os-sync-test-*`, transport simulé, aucun réseau) DOIT couvrir :
    capture dans la même transaction (écriture échouée → pas d'entrée) ; capture d'une suppression avec `payload` ;
    aucune capture `origin: 'remote'` ; test statique `MUTATING_METHODS` (§ 5.2) ; `keyOf` sur les quatre clés ;
    dédoublonnage et ordre `seq` ; bornes 500 / 1 Mo ; `put` relu à l'envoi ; `files` retenu sans empreinte distante ;
    `syncable: false` jamais en file ; 409 vérifié puis `upsert: true` ; réponses `accepted / adjusted (réécriture non
    capturée) / rejected` (par motif) → retrait / conflit / quarantaine ; dichotomie sur 4xx ; pause sur quota ; recul
    exponentiel ; 401 → attente ; `\u0000` retiré ; **horloges simulées** (+10 min, −2 h : ni conflit fabriqué ni
    boucle, avertissement unique) ; envoi initial par marqueurs, complet, reprenable, **et déclenché sur un appareil
    déjà connecté** ; `library_activity` exclu puis rattrapé à l'activation ; garde de compte + « Changer de
    compte » ; `repo.clearDevice()` (contenu exact du § 5.1) ; réception : tombale → suppression sans capture ; plus
    ancien ignoré ; local plus récent conservé + conflit + remise en file ; égalité différente → conflit sans
    remise en file ; curseur n'avance qu'après écriture ; `current_version_id` → conflit ; « Garder celle d'ici »
    restaure depuis `sync_conflicts.local` ; ligne `files` reçue sans octets puis `putFile` remote écrit le blob ;
    **archive produite avec une ligne `files` sans blob** (bilan) ; empreinte et type reçus vérifiés ;
    `SYNC_STORES.length === 25` ; concordance migration ↔ `tables.js` ; `putFile`/`recordActivity`/`rediscovery_prefs`
    posent `updated_at` ; `files.data` sans champ hors liste ; **archive v1 d'avant le lot inspectée et restaurée
    après `DB_VERSION 2`** ; archive sans magasins internes ; remplacement refusé avec outbox ; fusion → `updated_at`
    neufs ; montée `DB_VERSION` 1 → 2 sur base peuplée sans perte, `device_id` migré ; `sw.js` : pas de cache avec
    paramètres, autre origine non interceptée ; retrait de `code=` avec fragment conservé ; `globalThis.supabase`
    absent → message ; les deux `<meta>` du § 6.2 dans `index.html` et `tests/index.html` ; fichier `text/html`
    inerte ; `SECRET_SETTING_KEYS` par motifs ; **suite complète verte sans compte (I4)**.
7.2 `supabase/proofs/0001_*.sql` — **L1 se prouve par SQL seul**, dans l'éditeur, en simulant deux appelants
    (`set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","email":"<adresse>"}'`) avec deux
    lignes insérées à la main dans `auth.users` (puis retirées) : A et B poussent le **même `id`** et le **même
    `sha256`** et réussissent tous deux, chacun ne voyant que sa ligne ; B ne voit rien de A ; B ne peut pas écrire
    `owner_id = A` ; `insert` avec `owner_id` NULL refusé ; `delete` direct → 0 ligne ; `sync_purge` → 1 et l'objet
    disparu ; `sync_purge_all` ; `store` inconnu → appel refusé sans écriture ; `updated_at` manquant →
    `rejected{updated_at}` ; futur → `adjusted` ; `id` ≠ clé → `rejected{clé}` ; champ de relation obligatoire absent
    → `rejected{forme}` ; égal + identique → `accepted` **et `server_seq` inchangé** ; plus ancien →
    `rejected{conflit}` ; tombale sur ligne inconnue → `'{}'` ; `server_seq` croissant à chaque vraie écriture ;
    maintenance sous `app.maintenance` → `server_seq` inchangé ; `check (not (data ? 'blob'))` refuse ; `allowed_users`
    illisible par l'API ; adresse retirée → `select` vide à la requête suivante ; `anon` sans privilège sur les 25
    tables ; `has_function_privilege('anon', …)` = false sur les trois fonctions ; bucket : objet hors de son dossier
    refusé, type hors liste refusé, > 50 Mo refusé.
    **Preuves de L2 (connexion Google réelle)** : `0001_providers.md` (capture Providers), `0001_hook.md` (capture
    Hooks : B1 branché), et **B1 obligatoire** : un troisième compte Google ajouté en *Test users* (B0 levée pour lui)
    mais **absent** d'`allowed_users` → connexion refusée (journal Auth : « adresse non autorisée »), aucune ligne dans
    `auth.users` ; retiré des testeurs ensuite.
7.3 Parcours sur appareils, un par lot (§ 8), résultats collés par Neegan dans `CLAUDE.md` ; aucune case cochée sans
    exécution. La mesure iOS (§ 4.1) fait partie de L2 ; la mesure du rendu PDF en cadre fait partie de L4.

## 8. Lots (ordre, chacun livrable seul)

| Lot | Livre | Preuve |
|---|---|---|
| L1 | `tables.js`, `mime.js`, migrations `0001` + `0002` générées, preuves SQL ; **revue adverse par Claude Code avant application** ; application sur le projet réel **et** sur le projet de développement (D8) | § 7.2, partie SQL, jouée par Neegan dans l'éditeur |
| L2 | **D'abord** le durcissement (CSP + referrer sur les deux pages, `sandbox` sur les deux cadres, fin du `window.open`, blobs retypés, `logError`) ; puis `src/vendor` (UMD vérifié deux fois), `config.js`, `auth.js` + garde de compte + « Changer de compte », SW corrigé, `db.mutate` + `autoIncrement` + `MUTATING_METHODS`, `DB_VERSION 2` (`device_id` migré, `ARCHIVE_DATA_STORES` corrigé), `repo.clearDevice`, **capture active** + refactor des 9 écritures, Réglages (ensemble L2), **origine dédiée active (D5)**, hook B1 branché par Neegan, `localhost` **retiré du projet réel** (reste sur le projet de développement, D8) ; mesure iOS | tests § 7.1 (capture, SW, DB_VERSION, archive v1, CSP, `text/html` inerte, I4) ; preuves L2 du § 7.2 ; connexion Mac + iPhone installé, retour plein écran, session conservée, refus B1 affiché |
| L3 | `push.js`, `pull.js`, envoi initial par marqueurs, horloge, conflits, quarantaine, pause quota, pastille, Réglages (ensemble L3) | § 7.1 complet ; iPhone hors ligne → compteur → réseau → Mac ; **bibliothèque existante du Mac entièrement arrivée** ; suppression propagée ; conflit volontaire résolu |
| L4 | `files.js`, envoi/réception, 409 vérifié, lignes sans octets, « Télécharger toutes les pages », qualité d'envoi, espace serveur sur 1 Go, mesure du rendu PDF | photo iPhone → fiche Mac, même empreinte ; fichier > 50 Mo refusé proprement ; archive produite avec pages non téléchargées |
| L5 | second appareil, ZIP (fusion/remplacement), tombales lisibles + `sync_purge` par fiche, `sync_purge_all`, « Effacer les données de cet appareil », `library_activity` opt-in complet | iPad vierge → données complètes + pages téléchargées sur demande, mêmes empreintes ; ZIP = mêmes décomptes ; effacement constaté (nombre ≥ 1) |

## 9. Décisions de Neegan (12 octobre 2026, en plus de D1, D3, D4 du brief)
D2 (révisée). Photos **réduites par défaut** (~400 Ko, grand côté 2 000 px), originale au choix ; l'original reste sur
    l'appareil. — **DÉCIDÉ**
D5. **Origine dédiée** : sous-domaine d'un domaine à Neegan, CNAME vers GitHub Pages, avant la fin de L2 (§ 6.3). Le
    nom exact du sous-domaine est donné par Neegan au début de L2. — **DÉCIDÉ**
D6. Historique de consultation **non synchronisé par défaut**, réglage explicite, purge au retrait. — **DÉCIDÉ**
D7. Tombales : `data` conservé **90 jours**, lisible et effaçable depuis Réglages (§ 4.2), puis vidé. — **DÉCIDÉ**
D8. **Second projet Supabase** gratuit pour le développement ; `localhost` seulement là ; mêmes migrations. — **DÉCIDÉ**

## 10. Traçabilité des revues
**v1 → v2** : clé `(owner_id, id)`, `owner_id not null` (séc. 1/18, fais. 1) · `server_seq`, `updated_at` borné (séc. 4,
fais. 3-4) · barrières B0/B1/B2, hook, `is_allowed()` partout, providers, `revoke` (séc. 2-3-5-20-22-31, fais. 19-20) ·
`sync_push` par élément, idempotent, bornes, `format('%I')` (séc. 12-13, fais. 9-12-18-30-33) · capture `db.mutate`, 9
écritures, `payload`, `updated_at` manquants, envoi initial (fais. 2-7-8-9-11) · garde de compte (fais. 10) · conflits
(fais. 13-14-21) · ZIP, « Effacer » (fais. 15-16-17, séc. 14) · fichiers (séc. 7-8-9-21, fais. 6-23-26-29) ·
suppression réelle, tombales (séc. 14) · `library_activity` (séc. 15) · région (séc. 16) · UMD (séc. 17, fais. 5) ·
CSP (séc. 11, fais. 35) · origine dédiée (séc. 10) · `logError` (séc. 23) · clé d'IA (séc. 24) · SW, `redirectTo`
(séc. 6, fais. 22-25) · iOS (fais. 27) · décomptes (fais. 24) · preuves (fais. 28) · `localhost` (séc. 19).
**v2 → v3** : envoi initial par marqueurs (N-1) · `repo.clearDevice` défini (N-2) · test statique sur toutes les
méthodes mutantes, `MUTATING_METHODS` (N-3) · « Changer de compte » (N-4) · lignes `files` sans octets, archive
tolérante (N-5) · règle `delete` gardée par `app.purge`, purge qui compte (N-6, fait 5) · MIME : résolution locale,
`syncable: false`, aucun refus local ni à la restauration (N-7) · durcissement blob en L2 (N-8) · `adjusted` non
capturé, `clock_offset_ms`, horloge en retard (N-9) · `library_activity` partout opt-in avec rattrapage et purge
(N-10) · `backup.js` garde sa transaction unique ; `logError` partout, plus de `e.stack` (N-11) ·
`ARCHIVE_DATA_STORES` corrigé, archive v1 d'avant le lot (N-12) · huit DOIT reliés à des preuves, CSP sur
`tests/index.html` (N-13) · colonnes générées par `tables.js`, champs de relation obligatoires = fais. 36 (N-14) ·
`allowed_users` en minuscules (N-15) · tombales lisibles, `sync_purge` par fiche a un appelant (N-16) · D8 portée par
L1/L2 (N-17) · L1 prouvé par SQL, preuves B1/hook/providers en L2, Réglages par lot, `device_id` (N-18) · 1 Go nommé,
estimation de pages, qualité d'envoi DOIT (T-1) · bouton de téléchargement permanent, pas de `frame-ancestors`,
mesure PDF (T-2) · deux vérifications d'intégrité, `<script>` classique, absence détectée (T-3) · fonction du hook
avec `grant` à `supabase_auth_admin`, branchement prouvé (T-4) · déclencheur sous `app.maintenance`, idempotent sans
écriture (T-5) · « Confirm email » (séc. 3) · I7 égalité symétrique.

## 11. Amendements consignés pendant la construction (12-13 octobre 2026)

Décisions prises pendant la construction de L1-L2 (registre complet : `.superpowers/sdd/2026-10-12-compte-et-stockage-l1-l2/progress.md`, rulings R1 à R32 ; R24 à R30 sont la vague de corrections de la revue finale de branche, `final-review.md` ; R31, R32, S1 et S2 sont la vague des **résidus `/verify`** — trois lentilles adverses indépendantes, `verify-residus-report.md`). Les sections ci-dessus **ne sont pas réécrites** : ce qui suit les amende ou les précise, une ligne par décision. Les décisions purement d'exécution (ordre des tâches, forme des tests) n'y figurent pas.

- **R6 — amende § 3.2 et § 3.3.** `is_allowed()`, `before_user_created(jsonb)` et le déclencheur `enforce_allowed_user()` vivent dans le schéma **`public`**, pas `private` (toujours `security definer`, `set search_path = ''`, avec les `grant`/`revoke` de la spec : `execute` révoqué à `public` et `anon`, accordé à `authenticated` pour `is_allowed()` et à `supabase_auth_admin` pour la fonction du crochet). Raison : une règle RLS et le service d'authentification exécutent la fonction sous le rôle appelant, qui n'a pas `usage` sur `private`. `private` ne garde que la table `allowed_users` et la vue `storage_usage`.
- **R9 — amende § 3.4.** Les motifs de rejet renvoyés par `sync_push` sont des jetons **ASCII** : `cle` (et non `clé`), `forme`, `taille`, `updated_at`, `conflit`. Ce sont des valeurs machine comparées par le client, pas des phrases affichables.
- **R12 — amende § 3.5.** `sync_purge` et `sync_purge_all` ne touchent **plus** `storage.objects` : un `delete` SQL y laisserait les octets orphelins côté stockage. **L'application supprime l'objet par l'API Storage** (règle `pages_delete`) **avant** d'appeler `sync_purge('files', <sha256>)`, et n'affiche « effacé du serveur » que si les deux ont réussi. La valeur renvoyée par les fonctions compte les lignes de table seulement.
- **R14 — amende § 3.4 et § 5.3.** Borne **par élément** de `sync_push` abaissée à **512 Ko** (`pg_column_size(data) > 524288` → `rejected{taille}`) ; la borne du **lot** reste 1 Mo. Raison : avec deux fois 1 Mo, le motif `taille` était inatteignable et « fiche trop grosse » ne se distinguait pas de « lot trop gros ». Côté client (L3), une fiche de plus de 512 Ko part en quarantaine sans tentative d'envoi.
- **R18 — amende I3 et § 5.4, à faire en L4.** Avant la première réception de fichiers, le manifeste d'archive gagne `missing_files` (`sha256`, `mime`, `size`, `remote: true`) ; `inspectArchive` compte ces empreintes comme connues et `applyArchive` restaure ces lignes sans blob. Sans cela, une archive produite sur un appareil qui a reçu des lignes `files` sans octets serait **refusée** à l'inspection (relation `source_pages` → `files` introuvable). Les archives v1 d'avant le lot portent une liste vide. C'est un **prérequis de L4**, pas une amélioration.
- **R19 et R20 — amendent § 4.2 (dernier alinéa) et § 5.1.** L'identité d'appareil vit **uniquement** dans `sync_state.device_id` : `repo.init()` l'assure (la crée par `newId('dev')` si elle manque) et `repo.deviceId()` la rend de façon synchrone. Il n'y a **plus aucun reflet** dans `localStorage` : l'ancienne clé `cuisineos.device` est reprise **une seule fois** à la montée `DB_VERSION 2`, puis retirée, et un test échoue si un autre fichier que `src/model/repo.js` la nomme encore.
- **R21 et R23 — amendent § 4.1.** `signIn()` mémorise la route courante (le retour du fournisseur arrive sans fragment) ; `handleReturn()` renvoie en plus `present`, vrai seulement si l'URL portait un code ou un refus. La route mémorisée est restaurée à **tout retour réel** — succès, code sans session, refus — jamais sur un chargement ordinaire, jamais par-dessus un fragment qui porte déjà une route, et la clé est consommée une seule fois. Un `signIn()` qui échoue sans redirection retire la clé : aucune route fantôme ne détourne le démarrage suivant.
- **R22 — amende § 4.1 et § 4.2.** L'état « garde de compte refusée » offre **deux** gestes : « Changer de compte sur cet appareil » (destructif, double confirmation) **et** « Se déconnecter ». Sans le second, seul le geste destructif sortait de l'impasse.
- **Limite connue — précise § 3.2 (règle `delete`) et § 3.5.** `set local app.purge = 'on'` vaut pour la **transaction** entière, pas pour l'instruction. Via PostgREST, un appel de RPC est une transaction : la portée reste donc celle de l'appel de purge, et un `delete` direct par l'API est toujours refusé (0 ligne). Mais sur une connexion SQL qui enchaînerait une purge et d'autres instructions dans la même transaction, la règle `delete` resterait franchissable jusqu'au `commit`. Accepté comme limite connue ; en défense en profondeur, `0002` révoque aussi tout privilège sur `private.storage_usage` pour `anon` et `authenticated`.
- **R24 — amende § 4.2 (dernier alinéa).** « « Effacer les données de cet appareil » : refusé tant que la file d'envoi n'est pas vide » ne vaut **que si un compte est connecté**. Sans compte, rien ne peut vider la file (il n'y a pas d'envoi en L2, et « Abandonner cet envoi » est reporté en L3) : le refus rendait le bouton inutilisable **pour toujours** dès la première écriture ordinaire. Sans compte, le double contrôle (confirmation + mot « EFFACER ») s'applique donc et la file est perdue avec le reste.
- **R25 — amende § 3.1 et § 3.2 (règle `update`).** `server_seq` est posée par le déclencheur `touch_server_seq` à **chaque** `insert` et à **chaque** `update` (hors `app.maintenance`), **sans jamais lire la valeur fournie par l'appelant**. Raison : la règle `*_update` n'autorise que par **ligne**, jamais par **colonne**, et `authenticated` a le privilège `update` sur les 25 tables — un `PATCH` direct pouvait donc écrire le curseur de réception de tous les appareils (§ 5.5) et arrêter la réception en silence. Conséquence assumée : une écriture qui ne change rien consomme un numéro de séquence (`sync_push` n'écrit déjà rien sur un réessai identique). `deleted_at` reste écrivable par le propriétaire : c'est sa ligne. Preuve : verdicts 6.10-6.11 de `proofs/0001_tables_et_regles.sql`.
- **R26 — amende § 5.2 (troisième DOIT) et § 7.1.** `repo.init()` horodate l'amorçage : les **96** fiches de référence (`UNIT_DEFINITIONS`, `UNIT_CONVENTIONS`, `INGREDIENTS`) portent un `updated_at` à l'insertion — sans lui, l'envoi initial de L3 les aurait toutes fait rejeter (`rejected{updated_at}` → quarantaine immédiate, § 5.3). Et une **passe unique** horodate les fiches écrites **avant** le lot : toute ligne d'un magasin de `SYNC_STORES` sans `updated_at` en reçoit un, par une origine que la capture ignore (jamais en file), avec une garde dans `sync_state.stamp_updated_at` (valeur `DB_VERSION`) pour ne pas rejouer. La montée `DB_VERSION 1 → 2` sur base peuplée est désormais **exercée** par un test qui ouvre réellement une base en version 1 puis la rouvre par le chemin du démarrage.
- **R27 — amende § 4.2 et § 5.2.** Retirer le consentement à l'historique de consultation retire **aussi** les entrées `library_activity` **déjà** en file : un retrait de consentement qui laisse partir ce qui attendait n'est pas un retrait. La purge des lignes du serveur reste L5 ; le retrait local, lui, est fait aujourd'hui.
- **R28 — amende § 4.1.** Le démarrage de la connexion est **borné dans le temps** (`demarrerSync({ auth, delaiMs = 8000 })`). `getSession()` rafraîchit le jeton par le réseau : hors ligne il ne rend rien avant le délai du navigateur, et le démarrage entier était suspendu — ce qui contredisait l'invariant I4. Au dépassement : `logError('sync_boot_timeout')`, l'app s'ouvre avec `enAttente: true` et sans compte ; quand le travail tardif aboutit, son résultat est appliqué, le cache invalidé et un rendu redemandé (comme `auth.onChange`), route mémorisée restaurée à ce moment-là. L'ordre `handleReturn` → `session` → `guard` est inchangé.
- **R29 — précise I6.** Dépôt public : **aucune clé** ; **aucune adresse courriel autre que celle, publique, de la signature des commits du propriétaire** (déjà nommée dans `CLAUDE.md`). Le **prénom** du propriétaire et le **domaine** de l'entreprise sont **assumés publics** (compte GitHub, signature des commits, chaînes de l'app). Décision de Neegan ; rien n'est retiré du dépôt. `service_role` reste interdit partout.
- **R30 — amende § 4.2 (section « Synchronisation »).** Tant que le démarrage borné (R28) n'a pas abouti (`enAttente: true`), la section dit **« Vérification du compte… »** et **n'offre aucun geste** : ni « Tes données restent sur cet appareil. », ni « Activer la synchronisation », ni le nombre d'éléments en attente. Le compte n'est pas encore CONNU ; annoncer un état sans événement réel contredirait l'invariant I5. Le résultat tardif (ou son échec) redemande un rendu, et la section redevient celle de tous les jours.
- **R31 — amende § 5.2 (dernier alinéa) et § 7.1.** La restauration en **remplacement** est refusée dès qu'une entrée d'`outbox` existe, **connecté ou non**, et la file est relue **au moment du geste** (`restaurerArchive({ mode, pending, toast, appliquer })`, dépendances injectées, testée). Message adapté à L2 : « N éléments sont en attente d'envoi. Restaure en fusion, ou efface d'abord les données de cet appareil. » (singulier à part) — il n'existe **pas** de geste « vider la file » avant L3 ; les deux issues d'aujourd'hui sont la **fusion** et « Effacer les données de cet appareil », qui purge la file. La **fusion** reste permise.
- **R32 — amende § 4.1 (R28).** Le résultat **tardif** du démarrage n'est appliqué que si **personne n'a posé d'état depuis le dépassement** de la borne : un compteur de générations dans `src/ui/state.js` est incrémenté à chaque `setSyncState`, et le travail tardif compare la génération qu'il a quittée à celle de son aboutissement. Sinon il est ignoré — un `auth.onChange` (jeton rafraîchi, déconnexion, connexion dans un autre onglet) dit la session d'aujourd'hui, le résultat tardif celle d'il y a dix secondes. Si le travail tardif **échoue**, l'attente est levée (`logError('sync_boot_failed')`) au lieu de figer la section sur « Vérification du compte… » sans aucun geste (R30). `auth.onChange` pose aussi `enAttente: false` : un changement de session est un événement réel.
- **S2 — précise § 3.1 (« posée par le serveur ») et § 3.2 (règle `update`).** La tombale **`deleted_at` est figée** par `touch_server_seq` sur chaque `update` hors `app.maintenance` (`new.deleted_at := old.deleted_at`), **sauf** si `current_setting('app.sync_push', true) = 'on'` ; `sync_push` pose ce drapeau **local à sa transaction**, après `is_allowed()`. Même raison que R25 : la règle `*_update` n'autorise que par **ligne**, jamais par **colonne** — un `PATCH` direct posant `deleted_at = now()` faisait disparaître la fiche de **tous** les appareils à la prochaine réception, sans passer par `sync_push` et sans qu'un client puisse distinguer cela d'une suppression voulue. Sous maintenance, l'ancienne valeur de `server_seq` est aussi reposée. Preuve : verdicts **6.12-6.14** de `proofs/0001_tables_et_regles.sql`.
- **S1 — précise § 4.1 et § 6.3.** `src/sync/config.js` porte une **liste blanche d'hôtes** (`hosts`) par entrée : `currentConfig(hostname)` rend l'entrée dont la liste contient l'hôte (comparaison exacte, en minuscules) et **`null` sinon** — plus de repli silencieux sur `prod`. Sans cela, le jour où `prod` sera rempli, **toute** origine servant ces fichiers (miroir, sous-domaine oublié, copie) créerait un client avec la clé du vrai projet. L'hôte du sous-domaine (D5) est ajouté dans `prod.hosts` **en même temps** que l'URL et la clé.
- **Précise § 6.1.** `tools/verifier-vendor.mjs` a trois codes de sortie : **0** = les vérifications demandées ont réussi, **1** = une empreinte ne concorde pas, **2** = usage incorrect (argument manquant, version mal formée, fichier absent). Le mode `--local <fichier> <version>` ne fait que la vérification (2) et **exige** la version (mesuré le 13 octobre : sans elle, code 2 ; avec une version inexistante, code 1) — sans cette garde, unpkg servait la dernière version publiée et la comparaison ne voulait rien dire.
