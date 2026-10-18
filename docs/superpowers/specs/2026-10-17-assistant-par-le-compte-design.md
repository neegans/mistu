# La configuration de l'assistant suit le compte — spec de design

Date : 17 octobre 2026 (soir). Révision 1. Branche `assistant-compte`, worktree `~/projects/mistu-web` (serveur
`http://localhost:8083/`), base `main` `66c5d19` (lots « Chercher sur le web » et « Confort après preuve » LIVE).
Spec parente de la synchronisation : `docs/spec-compte-et-stockage-distant.md` (§ 3.1 « `settings` n'est jamais
synchronisé », § 5, § 6.5, § 11 R1-R64). Spec du lot web : `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md`
(I-C : « la clé ne va jamais dans une sauvegarde ou la synchro » — amendé par ce lot, voir § 1).

## 1. Décision et contexte

Le 17 octobre au soir, l'iPhone de Neegan montre la garde « Pour chercher sur le web, configure l'assistant IA » alors que
la clé est entrée sur le Mac. Neegan : « pourquoi tu as créé deux systèmes différents… ça doit être la même clé ». Ce
n'étaient pas deux systèmes : la clé vivait dans le magasin `settings` (clé `llm`), que la synchronisation n'a jamais
porté (spec parente § 3.1) et que les archives écartent (`SECRET_SETTING_KEYS`). Ce choix de prudence — le serveur ne
voit jamais la clé — avait une conséquence non dite à l'approbation du lot web : retaper la clé sur chaque appareil.

**Décision de Neegan (17 octobre, 21 h 30)** : la même clé partout, **par son compte** (option recommandée, contre un
transfert d'appareil à appareil par code QR sans serveur). Ce lot renverse donc une partie de I-C du lot web : la
configuration de l'assistant **voyage par la synchronisation**, et seulement par elle ; elle ne va toujours **jamais**
dans une archive ZIP, une adresse, un écran de conflit ni un journal.

## 2. But, non-buts

**But.** Entrer la configuration de l'assistant (fournisseur, modèle, clé, URL de base) une fois sur un appareil connecté
au compte ; chaque autre appareil connecté la reçoit à sa prochaine passe ; la changer ou la retirer une fois suffit.

**Non-buts.** Pas de passerelle serveur (Mistu reste personnel) · pas de chiffrement par phrase secrète (il réintroduirait
une saisie par appareil ; voir § 7) · pas de synchronisation des autres réglages (`ui_locale`, `units`, `device_name`,
`sync_activity`, `last_backup` restent par appareil) · pas de D5 · pas de détection fine d'une table absente côté serveur
(§ 6.4 : l'ordre des gestes suffit) · le redessin du formulaire Réglages pendant une passe (défaut préexistant, § 9).

## 3. Invariants

- **K-1 Une seule source.** La configuration vit dans le magasin **`assistant_config`**, une ligne `id: 'llm'`. Le
  réglage `settings.llm` disparaît : lu une dernière fois par la passe unique de § 5.6, puis effacé. `repo.setSetting`
  **refuse** toute clé de `SECRET_SETTING_KEYS` (lève) : plus jamais de secret dans `settings`.
- **K-2 Un secret ne traîne nulle part.** Jamais dans une archive ZIP (export, inspection, restauration), jamais dans
  `sync_conflicts`, jamais dans un `payload` d'`outbox` (donc jamais de `delete` sur ce magasin : § 5.4), jamais dans
  l'adresse, jamais dans `logError` / `journaliser`, jamais dans un texte rendu (le champ reste `type="password"`).
- **K-3 Synchronisée comme les autres.** `assistant_config` entre dans `SYNC_STORES` : capture (`outbox.js`), envoi
  initial (`backfill.js`), réception (`pull.js`), table serveur du même nom, `owner_id = auth.uid()`, règles RLS
  propriétaire identiques aux 25 autres. Aucun chemin spécial de transport.
- **K-4 Sans compte, rien ne change.** Sans synchronisation configurée ou sans compte connecté, la configuration
  reste sur l'appareil, exactement comme aujourd'hui ; elle part au premier passage après connexion (envoi initial).
- **K-5 Jamais de conflit à trancher.** Pour ce magasin, I7 s'applique sans écran : la version la plus récente gagne ;
  à instant égal et contenu différent, **la version du compte** (serveur) gagne et est écrite ici ; plus récente ici,
  elle repart. Aucune entrée `sync_conflicts` n'est jamais créée pour `assistant_config` (§ 5.5).
- **K-6 Retirer = écrire vide.** « Aucun (manuel) » enregistré écrit la ligne `{ id: 'llm', provider: 'none', model: '',
  base_url: '', api_key: '' }` : la clé disparaît partout par une **écriture**, pas une suppression.
- **K-7 Une archive ne touche pas la configuration.** Exclue de `ARCHIVE_DATA_STORES` ; une restauration en mode
  **remplacement** la garde (elle n'est pas de la bibliothèque) ; une fusion aussi ; une vieille archive sans ce magasin
  reste valide.
- **K-8 Effacer l'appareil = l'effacer ici seulement.** « Effacer les données de cet appareil » et « Changer de compte »
  vident `assistant_config` comme tout le reste (`repo.clearDevice`) ; la configuration du compte revient par la
  réception après reconnexion. Rien n'est envoyé au serveur par ces gestes (origine `device`).
- **K-9 Dernière de la liste.** `assistant_config` est déclaré **en dernier** parmi les magasins synchronisés de
  `STORES` : la réception la lit en dernier, donc une passe contre un serveur qui n'aurait pas encore la table reçoit
  tout le reste avant d'échouer sur elle (§ 6.4).
- **K-10 Réglages dit l'état réel.** Le texte de la section « Assistant IA » décrit ce qui se passe **sur cet appareil,
  maintenant** : avec un compte connecté, « suit ton compte » ; sans compte, « reste sur cet appareil » ; dans les deux
  cas, « jamais dans les sauvegardes ZIP ». Aucun « synchronisé » sans compte.
- **K-11 Ce que les consommateurs lisent ne change pas.** `ctx.settings.llm` garde sa forme `{ provider, model,
  base_url, api_key }` : `providerFrom`, `search.js`, `recipe-edit.js`, `import.js`, `components.js` et
  `recherche-web.js` ne changent pas d'une ligne.

## 4. Modèle de données

### 4.1 Local

`src/model/schema.js` : `DB_VERSION = 3` ; `STORES` gagne, **après `timer_launches` et avant `files`** (pour rester
dans la partie synchronisée et dernier de `SYNC_STORES` — ordre à prouver par un test, pas à supposer) :

```js
assistant_config: { keyPath: 'id', indexes: [] },   // une ligne 'llm' ; spec 2026-10-17-assistant-par-le-compte § 4
```

`ARCHIVE_DATA_STORES` exclut `assistant_config` (comme `files` et `settings`) ; `SYNC_STORES` l'inclut (26 magasins) ;
`SECRET_SETTING_KEYS` reste `['llm']` (filtre des vieilles archives). `backup.js` : `DATA_STORES` inchangé ; le
`clearStores` du mode remplacement exclut `assistant_config` en plus des internes.

Ligne : `{ id: 'llm', provider: 'none' | 'openai_compatible' | 'anthropic', model: string, base_url: string,
api_key: string, updated_at: iso }`. Bornes à l'écriture locale (module pur `src/domain/assistant-config.js`,
`normaliserConfigAssistant(brut) → ligne`) : chaînes `trim()`, Cc/Cf retirés (`borner` de `src/core/bornes.js`), `model`
≤ 200 points de code, `base_url` ≤ 500, `api_key` ≤ 500 ; `provider` hors liste → `'none'` ; `provider === 'none'` →
les trois autres champs vidés (K-6). La même fonction normalise une ligne **reçue** avant qu'elle n'atteigne
`ctx.settings.llm` (une ligne étrangère ou abîmée ne casse jamais un écran).

### 4.2 Serveur

Table `public.assistant_config` rendue par le **même gabarit** que les 25 autres (`tools/generer-migrations.mjs`,
`table(store)`) : `owner_id`, `id`, `data`, `updated_at`, `server_seq`, `deleted_at`, clé primaire `(owner_id, id)`,
index `assistant_config_recv (owner_id, server_seq)`, déclencheur `assistant_config_seq` (`touch_server_seq`), RLS
activée, quatre règles `is_allowed() and owner_id = auth.uid()` (suppression sous `app.purge`). Aucune colonne
générée, aucun champ de relation requis (`REQUIRED` vide). `sync_push` vérifie déjà `data->>'id' = id`.

## 5. Comportements

### 5.1 Lecture
`repo.getSettings()` compose `llm` depuis la ligne `assistant_config` `'llm'` (normalisée, sans `id` ni `updated_at`),
`{ provider: 'none' }` à défaut ; une éventuelle ligne `settings.llm` résiduelle est **ignorée**. Le cache de
`src/ui/state.js` est invalidé par les événements `change` / `settings` et par `invalidate()` après une passe qui a
écrit (`app.js`, `passeAEcrit`) : une configuration reçue est lue au rendu suivant, sans rechargement.

### 5.2 Écriture (Réglages → Assistant IA)
« Enregistrer » appelle `repo.saveAssistantConfig(brut)` : normalise (§ 4.1), écrit `{ …, updated_at: syncNow() }`
par `db.mutate` avec l'origine `local` (capturée par `outbox.js`, `user_id` du compte courant ou `null`), émet `change`
(le moteur planifie une passe : `moteur.js` écoute `change`) et `settings` (`{ key: 'llm' }`, pour les écouteurs
existants). Plus aucun appel à `setSetting('llm', …)` dans `src/`. « Tester » ne change pas (il teste l'objet non
enregistré). Le toast reste « Assistant enregistré ».

### 5.3 Réception
Chemin générique de `pull.js` : la ligne arrive dans le magasin `assistant_config` avec l'origine `remote` (pas de
recapture). Après la passe, `invalidate()` ; sur `/settings`, l'abonnement existant redessine la page (le formulaire
montre la configuration reçue) ; sur `/search`, le rendu suivant lit la garde avec la nouvelle configuration.

### 5.4 Jamais de suppression
Aucun chemin du code n'appelle `repo.remove` / `removeMany` sur `assistant_config` (test statique sur `src/`, comme le
test des écritures directes). Une tombale reçue pour ce magasin (impossible par ce code, possible par un autre client)
est traitée comme une ligne vide : `decider` rend `'ecrire'` d'une ligne `provider: 'none'` si elle est plus récente,
`'ignorer'` sinon — jamais `conflit_renvoyer`.

### 5.5 Conflits sans écran (K-5)
- `pull.js` `decider` : pour `assistant_config`, `'conflit'` → `'ecrire'` (égalité : le compte gagne) ;
  `'conflit_renvoyer'` → **remettre en file seulement** (entrée `outbox` `put`, origine locale), **sans** entrée
  `sync_conflicts`.
- `reponses.js` : un `rejected` `conflit` sur `assistant_config` retire les entrées de la file et **n'ajoute aucun
  conflit** ; la version du serveur, jointe au refus (`r.server`), est écrite ici (origine `remote`) si elle est plus
  récente que la fiche locale relue — sinon la fiche locale repart (elle est plus récente : le serveur l'acceptera).
- `garderIci` / `garderAilleurs` / `ignorerRenvoye` : inchangés (ils ne verront jamais ce magasin).
- Le transport factice en mode `serveur` (`tests/transport-factice.js`) arbitre déjà comme `sync_push` : les deux
  règles ci-dessus se prouvent avec lui, deux appareils (`withRepo` + `withDatabase`) et une horloge pilotée.

### 5.6 Passe unique de migration locale
Dans `repo.init()`, après `horodaterAnciennesFiches` et le nettoyage des chaînes, garde `sync_state`
`assistant_config_migre` (valeur `DB_VERSION`, origine `device`) : si `settings.llm` existe et qu'aucune ligne
`assistant_config` n'existe, écrire la ligne normalisée avec `updated_at: syncNow()` **origine `local`** (elle entre en
file : la configuration du Mac monte au premier passage, K-4), puis effacer `settings.llm` (origine `device`). Si une
ligne `assistant_config` existe déjà (reçue avant la passe), `settings.llm` est simplement effacé. Idempotente ;
éprouvée sur base peuplée (comme R26).

### 5.7 Cycle du compte
`clearDevice` vide `assistant_config` (K-8, déjà vrai pour tout `STORES`). À la reconnexion, l'envoi initial ne trouve
rien à envoyer pour ce magasin et la réception ramène la ligne du compte. Après `changerDeCompte`, la configuration du
**nouveau** compte arrive ; l'ancienne a été vidée avec l'appareil. « Se déconnecter » ne touche à rien (comme aujourd'hui).

## 6. Serveur : migration `0003`

### 6.1 Principe
Les migrations sont **à ajout seul** : `0001` est appliquée sur `mitsu` et doit rester **octet pour octet** identique
au fichier commité. `0003_assistant_config.sql` ajoute la table et **recrée** (`create or replace function`) les quatre
fonctions qui portent la liste littérale des magasins : `sync_push`, `sync_purge`, `sync_purge_all`, `purge_tombstones`,
avec les **26** noms. `0002` ne change pas.

### 6.2 Générateur
`src/sync/tables.js` exporte `SYNC_STORES_0001` : la liste **littérale et figée** des 25 noms de `0001` (test :
chaque nom ∈ `SYNC_STORES`, ordre identique à celui de `0001` commité). `tools/generer-migrations.mjs` :
`renderMigrations()` rend `0001` à partir de `SYNC_STORES_0001`, `0002` inchangé, et `0003` à partir de
`SYNC_STORES.filter((s) => !SYNC_STORES_0001.includes(s))` pour les tables neuves et de `SYNC_STORES` entier pour les
quatre fonctions (dans `sync_push`, les constantes `stores`, `keys` et `required` sont toutes trois rendues avec les 26 :
`keys` gagne `"assistant_config": "id"`, `required` gagne `"assistant_config": []`). Les corps des fonctions sont
extraits dans un rendu `fonctions(stores)` partagé par `0001` et `0003` ;
le `--check` existant prouve que `0001` et `0002` n'ont **pas bougé d'un octet**, et couvre désormais `0003`.
`tools/generer-migrations.test.mjs` : `0001` compte toujours 25 tables ; `0003` crée exactement 1 table, 4 règles,
1 déclencheur, 1 index, et ses quatre fonctions listent les 26 magasins dans l'ordre de `SYNC_STORES`.

### 6.3 Preuve `supabase/proofs/0003_assistant_config.sql`
Même technique que la preuve `0001` (transaction + `rollback`, verdicts imprimés, « Run without RLS ») : table présente
avec RLS activée · 4 règles · déclencheur et index présents · `sync_push` accepte un élément `assistant_config` pour
l'utilisateur de test et le relit par `owner_id` · un second utilisateur de test ne lit **rien** de cette ligne · une
tentative de `delete` sans `app.purge` est refusée · les quatre fonctions nomment `assistant_config` (lecture de
`pg_get_functiondef`) · `count(*)` des tables synchronisées = 26. Sortie à consigner dans
`supabase/proofs/RESULTATS-mitsu.md` (nouvelle section datée, geste Neegan). `supabase/README.md` gagne l'étape
`0003` (après `0002`, avant les preuves).

### 6.4 Ordre des gestes (le code attend la table)
1. Neegan colle `0003` puis sa preuve dans l'éditeur SQL de `mitsu` (« Run without RLS »), consigne la sortie.
2. Ensuite seulement : fusion et `push` du code. Un client **ancien** contre le serveur **nouveau** ne voit rien
   (il n'envoie ni ne lit cette table). Un client **nouveau** contre le serveur **ancien** verrait son `sync_push`
   échouer entier (`store inconnu`) dès qu'une ligne `assistant_config` est en file, et sa réception s'arrêter sur
   cette table — **en dernier** (K-9), donc après tout le reste. C'est pourquoi l'ordre 1 → 2 n'est pas négociable
   et figure dans CLAUDE.md et STATE.md.

## 7. Sécurité — ce qui est protégé, ce qui ne l'est pas

- **En transit** : HTTPS vers `mitsu` (CSP `connect-src https:` inchangée, aucun hôte neuf).
- **Au repos, serveur** : la clé repose **en clair** dans `assistant_config.data` (jsonb), derrière RLS propriétaire +
  `is_allowed()` (liste d'adresses) + la session Google. Qui la lit : le propriétaire connecté ; le tableau de bord
  Supabase (Neegan) ; quiconque détient la clé `service_role` (hors dépôt, I6) ; les **sauvegardes du projet Supabase**
  la contiennent. Décision : acceptée pour une instance personnelle ; le mur reste le **plafond de dépense du workspace
  Anthropic** (lot web, R2). Un chiffrement côté client exigerait une phrase à retaper par appareil : refusé par
  l'objectif même du lot. Journaux Postgres : les paramètres des RPC ne sont pas journalisés par défaut (**non mesuré**).
- **Au repos, appareil** : la clé est dans IndexedDB, comme aujourd'hui (`settings.llm` l'était). La file `outbox` ne
  porte pas la fiche pour un `put` (relue à l'envoi) ; aucun `delete` (K-2) ; aucun conflit stocké (K-5). L'inspection
  d'une archive, l'export lisible (HTML/YAML) et `tests/backup.js` ne voient jamais ce magasin.
- **Origine partagée** : D5 inchangé. Toute page Pages du compte lit la même IndexedDB (lot web, V-S1) ; aujourd'hui
  `neegans/mistu` est le seul dépôt du compte avec Pages (mesuré le 17 octobre par `gh api`).
- **Réception d'une ligne hostile** : normalisée avant usage (§ 4.1) ; la clé reçue n'est jamais rendue (champ
  `password`) ; `providerFrom` ne voit qu'un objet typé.
- **Ce qui part** : une fiche de plus dans l'envoi, même chemin, même jeton. Les invariants I-C du lot web sur les
  **appels à l'API Anthropic** (en-têtes, corps, adresse) ne changent pas.

## 8. Tests (rouges d'abord, comportement, jamais le texte source sauf tests statiques existants)

- **Schéma** : `SYNC_STORES.length === 26`, `assistant_config` **dernier**, absent de `ARCHIVE_DATA_STORES`,
  `DB_VERSION === 3` ; montée 2 → 3 sur base peuplée (magasin créé, données intactes).
- **Normalisation** (`src/domain/assistant-config.js`, pur) : bornes, Cc/Cf, `provider` inconnu → `none`, `none` vide
  les champs, ligne reçue abîmée (chaînes manquantes, types faux) → objet sain.
- **Lecture** : `getSettings().llm` vient de `assistant_config` ; `settings.llm` résiduel ignoré ; `setSetting('llm')`
  lève.
- **Écriture** : « Enregistrer » (espion sur `repo.saveAssistantConfig`, jamais `setSetting`) → ligne en base, entrée
  `outbox` `put` avec `user_id` du compte, événements `change` + `settings`, toast ; « Aucun » → ligne vide (K-6).
- **Capture / envoi initial / réception** : capturée (`origine local`), non capturée (`remote`, `device`) ; présente
  dans l'envoi initial ; reçue par `appliquerPage` → `getSettings().llm` à jour après `invalidate()`.
- **Conflits** (deux appareils, transport factice `serveur`, horloge pilotée) : plus récent ailleurs → écrit ici ;
  égalité différente → le compte gagne, `sync_conflicts` vide ; plus récent ici → repart, `sync_conflicts` vide ;
  refus `conflit` au push → aucune entrée de conflit, file nettoyée, serveur appliqué ou fiche renvoyée ; tombale
  reçue → ligne vide, pas de conflit.
- **Jamais de suppression** : test statique « aucun `remove(`/`removeMany(` sur `assistant_config` dans `src/` ».
- **Archives** : octets du ZIP sans la clé ; inspection d'une vieille archive (25 magasins + settings) valide ;
  restauration en remplacement garde la ligne ; en fusion aussi ; `compterFichesSynchronisees` tolère l'absence du
  magasin dans l'archive.
- **Cycle du compte** : `clearDevice` vide le magasin ; passe unique § 5.6 (copie + file + effacement, idempotente,
  cas « ligne déjà reçue »).
- **Réglages** : texte selon l'état (connecté / sans compte), champ clé `type=password`, la clé n'apparaît dans aucun
  `textContent`.
- **Générateur** : `0001`/`0002` octet pour octet (le `--check` existant) ; `0003` (1 table, 4 règles, 1 déclencheur,
  1 index, 4 fonctions × 26 noms) ; `SYNC_STORES_0001` ⊂ `SYNC_STORES` dans l'ordre.
- **Tests existants à retourner délibérément** (chacun nommé dans le plan) : `tests/sync.js:9-11` (25 → 26),
  `tests/sync.js:155-157` (capture), `tests/sync-l3.js:524-535` (envoi initial 23/24 → 24/25),
  `tools/generer-migrations.test.mjs` (25 tables de `0001` **inchangé** ; ajouts pour `0003`), pins de version
  (`v0\.6\.0-\d+` dans `tests/ajouter.js`, `tests/sync-l3.js`, `tests/recherche-web.js`), total épinglé
  (`tests/tests.js`, relu dans « obtenu »). `tests/recherche-web.js:239, 295, 600, 702` (clé jamais dans une issue ni un
  rendu) restent verts tels quels.

## 9. Dettes nommées à l'avance

- Le formulaire « Assistant IA » est reconstruit à chaque changement d'état du moteur pendant qu'on est sur `/settings`
  (`suivreMoteur`, 300 ms) : une saisie en cours peut être perdue par une passe qui démarre — préexistant, plus visible
  maintenant qu'enregistrer déclenche une passe. Remède hors lot : ne pas reconstruire une section qui a le focus.
- Pas de détection côté client d'une table absente du serveur (§ 6.4) ; un lot ultérieur pourra classer le `store
  inconnu` et désactiver proprement ce magasin.
- `SECRET_SETTING_KEYS` reste une liste et non un motif (spec parente § 6.5, toujours non fait).
- La preuve `0001` (`count(*) = 25`) devient fausse une fois `0003` appliquée : elle prouve `0001` seule ; `0003` a sa
  propre preuve (26).

## 10. Gestes de Neegan (hors code)

1. **Avant la fusion** : coller `supabase/migrations/0003_assistant_config.sql` puis `supabase/proofs/0003_assistant_config.sql`
   dans l'éditeur SQL de `mitsu` (« Run without RLS »), coller la sortie dans `RESULTATS-mitsu.md` (je prépare la section).
2. **iPhone** : « Connexion avec Google » depuis l'app installée, me dire où atterrit le retour (mesure iOS attendue
   depuis le 13 octobre ; si le retour tombe dans Safari, lot à part : `skipBrowserRedirect`).
3. Fusion et `push` (ses gestes), puis sur le Mac : Réglages → Assistant IA montre la configuration existante
   (passe unique), « Enregistrer » une fois si on veut forcer l'envoi ; sur l'iPhone connecté : la configuration arrive
   à la passe suivante (Réglages → « Envoyer maintenant » la force).
4. Faire tourner la clé passée par le chat ; plafond de dépense du workspace.

## 11. Versions

`APP_VERSION = '0.6.0'` (nouveau schéma local, nouvelle table serveur), `DB_VERSION = 3`, `sw.js VERSION =
'cuisine-os-v0.6.0-N'` (N = numéro de tâche), `SHELL` + `./src/domain/assistant-config.js` (seul module neuf). Pins
`v0\.6\.0-\d+` et `'0.6.0'`.

## 12. Ce que la revue a amendé

(À remplir après les deux revues adverses — sécurité, faisabilité — puis par les rulings de construction R-CPT-1….)
