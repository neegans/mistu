# La configuration de l'assistant suit le compte — spec de design

Date : 17 octobre 2026 (soir). **Révision 2** (après deux revues adverses : sécurité S1-S14, faisabilité F1-F15 — § 12).
Branche `assistant-compte`, worktree `~/projects/mistu-web` (serveur `http://localhost:8083/`), base `main` `66c5d19`
(lots « Chercher sur le web » et « Confort après preuve » LIVE). Spec parente de la synchronisation :
`docs/spec-compte-et-stockage-distant.md` (§ 3.1 « `settings` n'est jamais synchronisé », § 5.5 I7, § 6.5, § 11
R1-R64). Spec du lot web : `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (I-C, geste R2).

## 1. Décision, contexte, ce que ce lot amende

Le 17 octobre au soir, l'iPhone de Neegan montre la garde « Pour chercher sur le web, configure l'assistant IA » alors que
la clé est entrée sur le Mac. Neegan : « pourquoi tu as créé deux systèmes différents… ça doit être la même clé ». Ce
n'étaient pas deux systèmes : la clé vivait dans le magasin `settings` (clé `llm`), que la synchronisation n'a jamais
porté (spec parente § 3.1) et que les archives écartent (`SECRET_SETTING_KEYS`). Ce choix de prudence — le serveur ne
voit jamais la clé — avait une conséquence non dite à l'approbation du lot web : retaper la clé sur chaque appareil.

**Décision de Neegan (17 octobre, 21 h 30)** : la même clé partout, **par son compte** (option recommandée, contre un
transfert d'appareil à appareil par code QR sans serveur).

**Ce que ce lot amende explicitement** (décisions de Neegan, consignées ici) :
- Lot web **I-C** : la configuration de l'assistant **voyage par la synchronisation**, et seulement par elle. Elle ne va
  toujours **jamais** dans une archive ZIP, une adresse, un écran de conflit, un journal ni un texte rendu.
- Lot web **geste R2** (« ne pas entrer la clé sur le site public tant que D5 n'est pas fait ») : le site public est la
  seule origine de l'iPhone ; le but même du lot y dépose la clé. R2 est **retiré** ; D5 reste recommandé (§ 7).
- Spec parente **I7 / § 5.5** (« instant égal et contenu différent = conflit tranché par la personne ») : pour ce seul
  magasin, à instant égal **la version du compte gagne, sans écran** (K-5).
- Spec parente **§ 3.1** : 26 magasins miroirs au lieu de 25 ; `settings` reste hors synchronisation.

## 2. But, non-buts

**But.** Entrer la configuration de l'assistant (fournisseur, modèle, clé, URL de base) une fois sur un appareil connecté
au compte, **sur le site public** ; chaque autre appareil connecté la reçoit à sa prochaine passe ; la changer ou la
retirer une fois suffit.

**Non-buts.** Pas de passerelle serveur (Mistu reste personnel) · pas de chiffrement par phrase secrète (il réintroduirait
une saisie par appareil ; § 7) · pas de synchronisation des autres réglages (`ui_locale`, `units`, `device_name`,
`sync_activity`, `last_backup` restent par appareil) · pas de D5 · pas de garde côté client contre un serveur sans la
table (§ 6.4 : l'ordre des gestes et la quarantaine suffisent) · pas d'écran L5 (fiches supprimées encore sur le
serveur) — quand il viendra, il exclura ce magasin.

## 3. Invariants

- **K-1 Une seule source.** La configuration vit dans le magasin **`assistant_config`**, une ligne `id: 'llm'`. Le
  réglage `settings.llm` disparaît : lu une dernière fois par la passe unique de § 5.6, puis effacé. `repo.setSetting`
  **et** `repo.getSetting` **refusent** (lèvent) toute clé de `SECRET_SETTING_KEYS` : plus jamais de secret dans `settings`.
- **K-2 Un secret ne traîne nulle part.** Jamais dans une archive ZIP (export, inspection, restauration), jamais dans
  `sync_conflicts`, jamais dans un `payload` d'`outbox` (donc jamais de suppression d'origine locale : K-6, § 5.4),
  jamais dans l'adresse, jamais dans `logError` / `journaliser` / un toast, jamais dans un texte rendu (champ
  `type="password"`, `value` posé en propriété), jamais dans une requête SQL humaine ou d'agent (§ 7).
- **K-3 Synchronisée comme les autres, sur les hôtes de production seulement.** `assistant_config` entre dans
  `SYNC_STORES` : capture (`outbox.js`), envoi initial (`backfill.js`), réception (`pull.js`), table serveur du même nom,
  `owner_id = auth.uid()`, règles RLS propriétaire identiques aux 25 autres, **plus** `revoke all … from anon` (§ 6).
  **Hors des hôtes de `prod.hosts`** (`localhost`, `127.0.0.1`, tout port), le magasin est **local seulement** : ni
  capturé, ni envoyé, ni reçu (prédicat `configAssistantSuitLeCompte(hostname)` de `src/sync/config.js`, injecté
  dans les trois modules comme `isActivitySynced`). Raison : une origine `localhost:<port>` est partagée par tout autre
  projet servi sur ce port, IndexedDB **et** jeton de session compris (S3).
- **K-4 Sans compte, rien ne change.** Sans synchronisation configurée, sans compte connecté, ou hors production (K-3),
  la configuration reste sur l'appareil, comme aujourd'hui. Sur un hôte de production, ce qui existe part au premier
  passage avec un compte (envoi initial), et ce qui est tapé déconnecté partira à la reconnexion (K-10 le dit).
- **K-5 Jamais de conflit à trancher.** Pour ce magasin, I7 s'applique sans écran : la version la plus récente gagne ;
  à instant égal et contenu différent, **la version du compte** (serveur) gagne et est écrite ici ; plus récente ici,
  elle repart. Aucune entrée `sync_conflicts` n'est jamais créée pour `assistant_config` (§ 5.5).
- **K-6 Retirer = écrire vide, jamais supprimer, jamais par accident.** « Aucun (manuel) » enregistré écrit la ligne
  `{ id: 'llm', provider: 'none', model: '', base_url: '', api_key: '' }` : la clé disparaît partout par une **écriture**.
  Sur un appareil qui **n'a aucune ligne** (neuf, ou vidé, configuration pas encore reçue), « Enregistrer » avec
  « Aucun » **n'écrit rien** (sinon une ligne vide plus récente effacerait la clé du compte : F5). Avec un compte
  connecté et une clé présente, « Aucun » demande d'abord « Retirer l'assistant de tous tes appareils ? » (même
  mécanisme de confirmation que « Effacer les données de cet appareil »). **« Aucun » retire la clé de la
  configuration, il ne la révoque pas** (§ 7).
- **K-7 Une archive ne touche pas la configuration.** Exclue de `ARCHIVE_DATA_STORES` ; une restauration en mode
  **remplacement** la garde (elle n'est pas de la bibliothèque) ; une fusion aussi ; une vieille archive sans ce magasin
  reste valide ; `validateRows` refuse toujours un magasin inconnu (une archive ne peut ni porter ni injecter la ligne).
- **K-8 Effacer l'appareil = l'effacer ici seulement.** « Effacer les données de cet appareil » et « Changer de compte »
  vident `assistant_config` comme tout le reste (`repo.clearDevice`, `clearStores`) ; la configuration du compte revient
  par la réception après reconnexion. Rien n'est envoyé au serveur par ces gestes (origine `device`).
- **K-9 Dernière de la liste.** `assistant_config` est déclaré **après `files` et avant `settings`** dans `STORES` :
  dernier de `SYNC_STORES`, donc lu en dernier par la réception (`pull.js` suit l'ordre de `SYNC_STORES`, `files`
  compris). Tests : `SYNC_STORES.at(-1) === 'assistant_config'` et `SYNC_STORES.slice(0, 25)` égal à `SYNC_STORES_0001`.
- **K-10 Réglages dit l'état réel, en quatre textes.** Section « Assistant IA », selon `ctx.sync` et l'hôte :
  (a) hôte hors production : « Sur cette adresse de développement, la configuration reste sur cet appareil. » ;
  (b) jamais connectée : « Sans compte, la configuration reste sur cet appareil. » ; (c) appareil lié à un compte mais
  déconnecté : « Ce qui est enregistré ici partira à ton compte à la prochaine connexion. » ; (d) connectée : « La
  configuration de l'assistant suit ton compte sur tes appareils connectés. » Toujours suivi de « Elle n'est jamais
  incluse dans les sauvegardes ZIP. » Les quatre chaînes entrent dans `src/i18n/en.js`.
- **K-11 Ce que les consommateurs lisent ne change pas.** `ctx.settings.llm` garde sa forme `{ provider, model,
  base_url, api_key }` : `providerFrom`, `search.js`, `recipe-edit.js`, `import.js`, `components.js` et
  `recherche-web.js` ne changent pas d'une ligne.
- **K-12 Le formulaire ne se dérobe pas sous les doigts.** La page Réglages n'est pas reconstruite par `suivreMoteur`
  tant que le focus est dans la section « Assistant IA » (`occupe` vrai) — une passe lancée par `visibilitychange`
  (revenir après avoir copié la clé depuis une autre app) ou par « Enregistrer » ne perd plus le fournisseur et le
  modèle tapés (F14).

## 4. Modèle de données

### 4.1 Local

`src/model/schema.js` : `DB_VERSION = 3` ; `STORES` gagne, **après `files` et avant `settings`** :

```js
assistant_config: { keyPath: 'id', indexes: [], noDelete: true },   // une ligne 'llm' ; spec 2026-10-17-assistant-par-le-compte § 4
```

`noDelete: true` est lu par `db.mutate` (§ 5.4). `ARCHIVE_DATA_STORES` exclut `assistant_config` (comme `files` et
`settings`) ; `SYNC_STORES` l'inclut (26 magasins, dernier) ; `SECRET_SETTING_KEYS` reste `['llm']` (filtre des vieilles
archives, refus de `setSetting`/`getSetting`). `backup.js` : `DATA_STORES` inchangé ; le `clearStores` du mode
remplacement exclut `assistant_config` en plus des internes ; `compterFichesSynchronisees` et `normaliserFiches`
tolèrent déjà l'absence du magasin dans une archive (test à poser).

Ligne : `{ id: 'llm', provider: 'none' | 'openai_compatible' | 'anthropic', model: string, base_url: string,
api_key: string, updated_at: iso }` (`created_at` posé par `save`, ignoré à la lecture). Normalisation (module pur
`src/domain/assistant-config.js`, `normaliserConfigAssistant(brut) → { provider, model, base_url, api_key }`) : chaînes
`trim()`, Cc/Cf retirés (`borner` de `src/core/bornes.js`), `model` ≤ 200 points de code, `base_url` ≤ 500, `api_key`
≤ 500 ; `provider` hors liste → `'none'` ; `provider === 'none'` → les trois autres champs vidés ; `base_url` n'est
gardée que si c'est une URL `https:` absolue sans identifiants, et toujours vidée pour `anthropic` (S14).
**Elle s'applique à l'écriture locale (« Enregistrer ») et à la lecture (`getSettings`)** ; la réception écrit la
ligne **telle que le serveur la porte** (normaliser une ligne reçue créerait, à instant égal, une différence avec la
copie du serveur, réécrite à chaque passe : F13).

### 4.2 Serveur

Table `public.assistant_config` rendue par le **même gabarit** que les 25 autres (`tools/generer-migrations.mjs`,
`table(store)`) : `owner_id`, `id`, `data`, `updated_at`, `server_seq`, `deleted_at`, clé primaire `(owner_id, id)`,
index `assistant_config_recv (owner_id, server_seq)`, déclencheur `assistant_config_seq` (`touch_server_seq`), RLS
activée, quatre règles `is_allowed() and owner_id = auth.uid()` (suppression sous `app.purge`), **et** `revoke all on
public.assistant_config from anon;` (le `revoke … on all tables` de `0001` n'a couvert que les tables d'alors : S4/F8).
Aucune colonne générée, aucun champ de relation requis. `sync_push` vérifie déjà `data->>'id' = id`.

## 5. Comportements

### 5.1 Lecture
`repo.getSettings()` compose `llm` depuis la ligne `assistant_config` `'llm'` (lue par `db.get`, normalisée, sans `id`,
`updated_at` ni `created_at`), `{ provider: 'none' }` à défaut ; une éventuelle ligne `settings.llm` résiduelle est
**ignorée**. La fausse base des tests de `getSettings` (`tests/sync-l3.js` ≈ 2022-2034) reçoit un `get` qui rend
`undefined` (F10). Le cache de `src/ui/state.js` est invalidé par `change` / `settings` et par `invalidate()` après une
passe qui a écrit (`passeAEcrit`) : une configuration reçue est lue au rendu suivant, sans rechargement.

### 5.2 Écriture (Réglages → Assistant IA)
« Enregistrer » appelle `repo.saveAssistantConfig(brut)` = `normaliserConfigAssistant` + `repo.save('assistant_config',
{ id: 'llm', …normalisé })` (qui horodate par `syncNow()`, nettoie, écrit par `db.mutate` d'origine `local` — capturée
sur un hôte de production avec le `user_id` du compte courant ou `null` — et émet `change`, que le moteur écoute) +
`bus.emit('settings', { key: 'llm' })` **sans la valeur**. Règles K-6 (rien à écrire / confirmation) appliquées avant.
Plus aucun appel à `setSetting('llm', …)` dans `src/`. « Tester » ne change pas (il teste l'objet non enregistré). Le
toast reste « Assistant enregistré ». Pour les tests, la section est rendue par une fonction exportée à dépendances
injectées (`{ repo, toast, confirmer }`), comme `reglerHistorique` — on ne pose pas d'espion sur un espace de noms de
module (F12) ; les effets mesurés sont la ligne en base, l'entrée de file, les événements et le toast dans le DOM.

### 5.3 Réception
Chemin générique de `pull.js` : la ligne arrive dans le magasin `assistant_config` avec l'origine `remote` (pas de
recapture), telle quelle. Après la passe, `invalidate()` ; sur `/settings`, l'abonnement existant redessine la page
(sauf K-12) ; sur `/search`, le rendu suivant lit la garde avec la nouvelle configuration.

### 5.4 Jamais de suppression locale (garde de comportement, pas de texte)
`db.mutate` **lève** avant d'ouvrir la transaction pour toute entrée `deletes.<magasin noDelete>` dont l'origine n'est
pas `remote` (`repo.remove`, `removeMany`, `db.delete`, `db.deleteMany`, `garderIci`, `garderAilleurs` sont ainsi tous
fermés, quel que soit le chemin) ; `clearStores` reste permis (K-8). `garderIci` / `garderAilleurs` / `ignorerRenvoye`
refusent en plus ce magasin par leur nom (ils ne le verront jamais : K-5). Test : `repo.remove('assistant_config',
'llm')` rejette, la file reste vide, la ligne est intacte (S6).
**Tombale reçue** (impossible par ce code, possible par un autre client ; elle **porte l'ancienne `data`, clé comprise**,
jusqu'à la purge des 90 jours — `coalesce(d, cur_data)`) : chemin générique. Plus récente ou égale → la ligne locale
est **supprimée** (origine `remote`, rien en file, `getSettings().llm` retombe sur `{ provider: 'none' }` : l'effet
local de K-6) ; plus ancienne → remise en file sans journal (§ 5.5). **Jamais `'ecrire'` d'une tombale** (S5/F6).
Fixtures : une tombale dont `data` porte une `api_key` → la ligne locale disparaît et la clé n'est écrite nulle part ;
une tombale `data: {}` → ni erreur ni blocage de la page, le curseur avance.

### 5.5 Conflits sans écran (K-5) — points d'insertion
- **Réception** : `decider` reste pur (les tests l'appellent avec `{ locale, distante }`). La règle du magasin vit dans
  `appliquerPage`, juste **après** la décision : `'conflit'` → traité comme `'ecrire'` ; `'conflit_renvoyer'` → remise
  en file (`refile`) puis `continue`, **sans** entrée `sync_conflicts`.
- **Envoi** : `reponses.js` ne touche jamais la base ; il rend `retirer`, `reecrire`, `conflits`, `quarantaine`,
  `retirerConflits`, que `push.js` applique en une transaction d'origine `remote`. Un refus `conflit` sur
  `assistant_config` : **retirer** les entrées ; si `r.server.data` existe **sans** `deleted_at`, que son instant est ≥
  celui de la fiche relue et que la fiche **n'a pas bougé pendant l'aller-retour** (`updated_at` égal à celui de
  l'élément envoyé — règle R-L3-7, S11), alors `reecrire.assistant_config` reçoit `{ ...r.server.data, updated_at:
  r.server.updated_at }` ; sinon **rien** (une édition faite pendant l'aller-retour a sa propre entrée ; remettre en
  file la version refusée bouclerait : F7). Serveur en tombale : retirer seulement. Une réécriture compte en `ajustes`,
  donc `passeAEcrit` invalide le cache.
- `garderIci` / `garderAilleurs` / `ignorerRenvoye` : inchangés pour les autres magasins.
- Le transport factice en mode `serveur` rend `rejected` avec `server: { data, updated_at, deleted_at }` comme la RPC :
  les règles se prouvent avec lui, deux bases (`withRepo` pour A, `withDatabase` + `installCapture(dbB)` pour B, B
  écrivant par `dbB.mutate`), et des **lignes à `updated_at` fixes** pour fabriquer les égalités d'instant (le factice
  n'a pas d'horloge pilotable : F15).

### 5.6 Passe unique de migration locale (une transaction, origine `device`)
Dans `repo.init()`, après `horodaterAnciennesFiches` et le nettoyage des chaînes, garde `sync_state`
`assistant_config_migre` (valeur `1`) : **une seule transaction d'origine `device`** qui (1) si `settings.llm` existe
avec `provider !== 'none'` **et** une `api_key` non vide, **et** qu'aucune ligne `assistant_config` n'existe, écrit la
ligne normalisée avec **`updated_at` = celui de la ligne `settings.llm`**, à défaut `'1970-01-01T00:00:00.000Z'`
(pour que toute version du compte gagne — S1/F4 : horodater à « maintenant » ferait battre une clé tournée par une
vieille clé restée sur une autre origine) ; (2) pose la garde ; (3) efface `settings.llm` dans tous les cas.
`repo.init()` précède `installCapture` (`app.js`) : **rien n'entre en file ici** ; c'est l'envoi initial qui envoie la
ligne au premier passage avec un compte, sur un hôte de production (marqueur `backfill:assistant_config` absent :
S10/F3). Tests dans l'ordre de `boot()` : `init()` sans capture puis `envoiInitial` → une entrée `put`
`assistant_config:llm` ; idempotente ; cas « ligne déjà reçue » ; cas « serveur porte K2 plus récente, une base monte
avec K1 dans `settings` → K2 reste partout » (S1).

### 5.7 Cycle du compte
`clearDevice` vide `assistant_config` (K-8). À la reconnexion, la réception ramène la ligne du compte. Après
`changerDeCompte`, la configuration du **nouveau** compte arrive ; l'ancienne a été vidée avec l'appareil. « Se
déconnecter » (`scope: 'local'`) ne touche à rien ; la garde lie l'appareil au premier compte accepté et
`estDeCeCompte` traite `user_id == null` comme « tout compte » : un appareil lié envoie au compte lié (K-10 c).

## 6. Serveur : migration `0003`

### 6.1 Principe
Les migrations sont **à ajout seul** : `0001` et `0002` sont appliquées sur `mitsu` et restent identiques aux fichiers
commités ; leurs empreintes SHA-256 sont **épinglées** dans `tools/generer-migrations.test.mjs` (`0001` =
`e90ff35ec7c031f63dfb903e6885103ed7e42202866f59359ce019d00b85ee51`, `0002` =
`2e90d2b1beb7270601f83c7408b1a2a2be32c800772f14f454960b233a2d5944`, mesurées le 17 octobre sur `main 66c5d19`) :
`--check` prouve « généré = commité », l'empreinte prouve « commité = appliqué » (F11). `0003_assistant_config.sql`
ajoute la table, son `revoke … from anon`, et **recrée** (`create or replace function`) les quatre fonctions qui
portent la liste littérale des magasins : `sync_push`, `sync_purge`, `sync_purge_all`, `purge_tombstones`, avec les
**26** noms (dans `sync_push`, les constantes `stores`, `keys` et `required` : `keys` gagne `"assistant_config": "id"`,
`required` gagne `"assistant_config": []`). `create or replace` conserve les droits des fonctions ; `0003` rejoue tout
de même les `revoke`/`grant` du bloc, sans effet (idempotents), et la preuve les relit.

### 6.2 Générateur
`src/sync/tables.js` exporte `SYNC_STORES_0001` : la liste **littérale et figée** des 25 noms de `0001`. Tests :
`SYNC_STORES.slice(0, 25)` égal à `SYNC_STORES_0001` (K-9). `tools/generer-migrations.mjs` : `renderMigrations()`
rend `0001` à partir de `SYNC_STORES_0001`, `0002` inchangé, et `0003` à partir de
`SYNC_STORES.filter((s) => !SYNC_STORES_0001.includes(s))` pour les tables neuves et de `SYNC_STORES` entier pour les
quatre fonctions. Le bloc des fonctions (`0001` l. ≈ 128-268) ne dépend que de `list(stores)`, `keys` et `required` :
il est extrait dans `fonctions(stores)` partagé par `0001` et `0003` ; restent dans le préfixe de `0001` les
commentaires littéraux « 25 tables » / « 25 déclencheurs » et, **hors** de `fonctions()`, la ligne `cron.schedule` ;
`ENTETE` prend le nom de spec en paramètre (valeur par défaut = l'actuel). La boucle de `--check` liste une troisième
cible, et `NOMS` des tests node aussi (F10/F11). `tools/generer-migrations.test.mjs` : `0001` compte toujours 25 tables
(boucle sur `SYNC_STORES_0001`, liste littérale `SYNC_STORES_0001` quatre fois) ; `0003` crée exactement 1 table,
4 règles, 1 déclencheur, 1 index, 1 `revoke … from anon`, et ses quatre fonctions listent les 26 magasins dans l'ordre de
`SYNC_STORES` ; empreintes de `0001`/`0002` épinglées.

### 6.3 Preuve `supabase/proofs/0003_assistant_config.sql`
Même technique que la preuve `0001` (transaction + `rollback`, table temporaire des verdicts, « Run without RLS »,
deux utilisateurs de test insérés dans `auth.users`, changement d'utilisateur par `set local role authenticated; set
local request.jwt.claims = '{"sub":…,"email":…,"role":"authenticated"}'`, puis `reset role`) — **avec une clé factice
uniquement, et sans jamais imprimer `data`** (S7). Verdicts : table présente avec RLS activée · 4 règles · déclencheur
et index présents · `authenticated` a `select`, `insert`, `update` sur la table (comme 1.01-1.03) · **`anon` n'a aucun
privilège** sur les **26** tables (comme 8.01, relu à 26) ni sur les quatre fonctions recréées · A pousse un élément
`assistant_config` et le relit par `owner_id` (`length(data->>'api_key')`, jamais la valeur) · B ne lit **rien** de la
ligne de A · A pousse `'llm'` **plus ancien** → `rejected` motif `conflit` (identifiant fixe : la clé primaire composée
isole les comptes ; le conflit se prouve sur le **même** compte : S8) · un `delete` sans `app.purge` **ne supprime
rien** (0 ligne, comme 4.01 — il ne lève pas) · les quatre fonctions nomment `assistant_config` (`pg_get_functiondef`)
· `count(*)` des tables synchronisées = 26 · impression de `current_setting('log_min_error_statement')` et
`current_setting('log_parameter_max_length_on_error')` (S9 : le « non mesuré » du § 7 devient une mesure). Sortie à
consigner dans `supabase/proofs/RESULTATS-mitsu.md` (nouvelle section datée, geste Neegan, **sans aucune valeur de
`data`**). `supabase/README.md` gagne l'étape `0003` (préalables de la preuve : deux adresses `exemple.invalid` dans
`allowed_users` avant, retirées après, comme pour `0001` ; quatre jetons à remplacer ; « Run without RLS » : F9).

### 6.4 Ordre des gestes, et ce qui se passe si on se trompe
1. Neegan colle `0003` puis sa preuve dans l'éditeur SQL de `mitsu`, consigne la sortie. Si la lecture de la table rend
   404 ensuite : `notify pgrst, 'reload schema';`.
2. Ensuite seulement : fusion et `push` du code. Un client **ancien** contre le serveur **nouveau** ne voit rien.
   Un client **nouveau** contre le serveur **ancien** : `sync_push` lève `store inconnu` (HTTP 400, **à mesurer** ;
   inférence d'après PostgREST), classé `refus` → la dichotomie met `assistant_config:llm` seul en **quarantaine**
   (motif `refus`), le reste du lot passe, l'envoi n'est pas bloqué ; la réception finit en `inconnu` sur la **dernière**
   table (K-9), après tout le reste. Après `0003` : Réglages → Synchronisation → « Réessayer » sur cette entrée (F2).
   Ce chemin n'est **pas** éprouvable par la suite (le transport factice n'arbitre pas `store inconnu`).
3. **Aucune session réelle** sur l'origine du worktree de la branche tant que `0003` n'est pas appliquée — un `raise`
   de `sync_push` journalise son paramètre côté Postgres selon `log_parameter_max_length_on_error` (S9). Avec K-3,
   `localhost` n'envoie de toute façon pas ce magasin ; la règle vaut pour la prudence et pour le site public.

## 7. Sécurité — ce qui est protégé, ce qui ne l'est pas, et quoi faire si ça tourne mal

- **En transit** : HTTPS vers `mitsu` (CSP `connect-src https:` inchangée, aucun hôte neuf).
- **Au repos, serveur** : la clé repose **en clair** dans `assistant_config.data` (jsonb), derrière RLS propriétaire +
  `is_allowed()` + la session Google ; `anon` révoqué sur la table. **Qui peut la lire** : le propriétaire connecté ;
  l'éditeur SQL et le tableau de bord Supabase (Neegan, et **tout membre de l'organisation** Supabase) ; tout agent
  branché au projet par MCP ; quiconque détient `service_role` (hors dépôt, I6) ; les **sauvegardes du projet Supabase**.
  Décision : acceptée pour une instance personnelle ; le mur reste le **plafond de dépense du workspace Anthropic**
  (lot web, R2). Un chiffrement côté client exigerait une phrase à retaper par appareil : refusé par l'objectif même du
  lot. Journaux Postgres : mesurés par la preuve `0003` (§ 6.3).
- **Règle de lecture (S7)** : aucune requête humaine ou d'agent ne lit `data` de `assistant_config` ; pour un diagnostic,
  `data - 'api_key'` et `length(data->>'api_key')`. `RESULTATS-mitsu.md` vit dans un dépôt **public** : jamais une
  valeur de `data` dedans.
- **Au repos, appareil** : IndexedDB, comme aujourd'hui. La file `outbox` ne porte pas la fiche pour un `put` (relue à
  l'envoi) ; aucune suppression d'origine locale (§ 5.4) ; aucun conflit stocké (K-5) ; `logError` ne garde que
  `store`, `id`, `status`, `reason` ; la quarantaine affiche `store · id` ; le libellé d'un conflit vient de
  `title`/`name`/`record_id` (mesuré par la revue : aucun chemin d'affichage ou de journal n'expose une fiche).
- **Se connecter sur une origine = y déposer la clé** (S3). D'où K-3 : hôtes de production seulement. D5 (origine
  dédiée) reste recommandé : toute page Pages du compte lit la même IndexedDB ; aujourd'hui `neegans/mistu` est le seul
  dépôt du compte avec Pages (mesuré le 17 octobre par `gh api`).
- **Ce qui est nouveau et doit être dit** (S2) : un appareil volé avec sa session ouverte expose désormais la clé de
  **tous** les appareils, et une **rotation lui parviendrait** à sa prochaine passe. « Aucun » ne révoque rien
  (appareils hors ligne, sauvegardes Supabase). **Procédure « appareil perdu ou clé exposée », dans cet ordre** :
  1. retirer l'adresse de `private.allowed_users` (coupe toute lecture à la requête suivante : preuve 9.01-9.03) ;
  2. Supabase → Authentication → Users → fermer toutes les sessions du compte ;
  3. révoquer l'ancienne clé dans la console Anthropic ;
  4. remettre l'adresse, reconnecter les appareils gardés, entrer la nouvelle clé une fois.
  Cette procédure figure dans `supabase/README.md` et dans CLAUDE.md.
- **Réception d'une ligne hostile** : normalisée à la lecture (§ 4.1) ; la clé reçue n'est jamais rendue (champ
  `password`) ; `providerFrom` ne voit qu'un objet typé ; `base_url` reçue non `https:` → vidée à la lecture.
- **Ce qui part** : une fiche de plus dans l'envoi, même chemin, même jeton. Les invariants I-C du lot web sur les
  **appels à l'API Anthropic** (en-têtes, corps, adresse) ne changent pas.

## 8. Tests (rouges d'abord, comportement ; les tests statiques existants restent, aucun neuf)

- **Schéma** : `SYNC_STORES.length === 26`, `SYNC_STORES.at(-1) === 'assistant_config'`, `slice(0, 25)` =
  `SYNC_STORES_0001`, absent de `ARCHIVE_DATA_STORES`, `DB_VERSION === 3` ; montée 2 → 3 sur base peuplée (magasin
  créé, données intactes ; modèle R26 `tests/sync.js` ≈ 215-287, `V1_SEULEMENT` sans `assistant_config`).
- **Normalisation** (pur) : bornes, Cc/Cf, `provider` inconnu → `none`, `none` vide les champs, `base_url` http / avec
  identifiants / pour `anthropic` → `''`, ligne reçue abîmée (chaînes manquantes, types faux) → objet sain.
- **Lecture** : `getSettings().llm` vient de `assistant_config` ; `settings.llm` résiduel ignoré ; `setSetting('llm')`
  et `getSetting('llm')` lèvent ; fausse base avec `get` → pas d'erreur console.
- **Écriture** (fonction à dépendances injectées) : « Enregistrer » → ligne en base, entrée `outbox` `put` avec
  `user_id` du compte (hôte de production), événements `change` + `settings` (sans valeur), toast dans le DOM ;
  « Aucun » sans ligne → rien écrit ; « Aucun » avec clé et compte → confirmation puis ligne vide (K-6) ; hôte hors
  production → ligne en base, **aucune** entrée de file (K-3).
- **Capture / envoi initial / réception** : capturée (`local`, production), non capturée (`remote`, `device`, hors
  production) ; présente dans l'envoi initial (production), absente hors production ; reçue par `appliquerPage`
  (telle quelle) → `getSettings().llm` à jour après `invalidate()` ; non reçue hors production.
- **Conflits** (deux bases, factice `serveur`, `updated_at` fixes) : plus récent ailleurs → écrit ici ; égalité
  différente → le compte gagne, `sync_conflicts` vide ; plus récent ici → repart, `sync_conflicts` vide ; refus
  `conflit` au push → aucune entrée de conflit, file nettoyée, serveur réécrit si la fiche n'a pas bougé, rien sinon ;
  tombale reçue (avec `api_key` dans `data`, puis `data: {}`) → ligne locale supprimée / rien de bloqué, pas de conflit,
  rien en file.
- **Jamais de suppression locale** : `repo.remove`, `db.delete`, `db.mutate({ deletes })` d'origine `local`/`device`
  rejettent ; origine `remote` passe ; `clearStores` passe ; `garderIci`/`garderAilleurs` refusent le magasin.
- **Archives** : octets du ZIP sans la clé ; inspection d'une vieille archive (25 magasins + settings) valide ;
  restauration en remplacement garde la ligne ; en fusion aussi ; `compterFichesSynchronisees` tolère l'absence.
- **Cycle du compte** : `clearDevice` vide le magasin ; passe unique § 5.6 (horodatage d'origine, repli 1970, rien si
  `none`/clé vide, idempotente, « ligne déjà reçue », K2 reste partout).
- **Réglages** : quatre textes K-10 ; champ clé `type=password` ; la clé n'apparaît dans aucun `textContent` ni
  `outerHTML` ; K-12 : focus dans la section → `suivreMoteur` ne reconstruit pas.
- **Générateur** : `0001`/`0002` octet pour octet (`--check`) **et** empreintes ; `0003` (1 table, 4 règles,
  1 déclencheur, 1 index, 1 `revoke anon`, 4 fonctions × 26 noms, `keys`/`required` avec `assistant_config`).
- **Tests existants à retourner délibérément** (chacun nommé dans le plan) : `tests/sync.js:9-11` (25 → 26), `:70`
  (`DB_VERSION`), `:155-157` (capture), `:226` (`V1_SEULEMENT`), `:243` (`idb.version` → `DB_VERSION`) ;
  `tests/sync-l3.js:524-535` (envoi initial 23/24 → 24/25), `:542` (progression `total` 23 → 24), `:2022-2034` (fausse
  base avec `get`) ; `tools/generer-migrations.test.mjs:23`, `:49-52` (→ `SYNC_STORES_0001`), `:208` (`NOMS` + `0003`) ;
  pins `v0\.6\.0-\d+` (`tests/ajouter.js` ≈ 1858/1860, `tests/sync-l3.js` ≈ 1864, `tests/recherche-web.js` 40/43) ;
  total épinglé (`tests/tests.js`, relu dans « obtenu ») ; le test de `SHELL` (`tests/sync.js` ≈ 922-963) impose le
  module neuf. `tests/recherche-web.js:239, 295, 600, 702` (clé jamais dans une issue ni un rendu) restent verts.

## 9. Dettes nommées à l'avance

- Pas de garde côté client contre un serveur sans la table (§ 6.4) ; un lot ultérieur pourra classer `store inconnu`.
- `SECRET_SETTING_KEYS` reste une liste et non un motif (spec parente § 6.5, toujours non fait).
- La preuve `0001`, verdict 8.01 (`count(*) = 25` et zéro privilège `anon`), doit désormais se **relire à 26** : la
  preuve `0003` le fait ; ne pas écarter un 8.01 faux d'un revers de main.
- « Données sur cet appareil » (Réglages) montrera une puce « assistant_config : 1 » : exact, assumé.
- Un vieil onglet resté en v2 reçoit une `VersionError` après `versionchange` (préexistant).
- Hors production, la configuration reste par origine (K-3) : sur `localhost`, on la retape — assumé.

## 10. Gestes de Neegan (hors code)

1. **Avant la fusion** : ajouter les deux adresses de preuve `exemple.invalid` à `allowed_users`, coller
   `supabase/migrations/0003_assistant_config.sql` puis `supabase/proofs/0003_assistant_config.sql` (jetons remplacés,
   « Run without RLS »), coller la sortie dans `RESULTATS-mitsu.md` (section préparée, sans aucune valeur de `data`),
   retirer les deux adresses. Si une lecture rend 404 ensuite : `notify pgrst, 'reload schema';`.
2. **iPhone** : « Connexion avec Google » depuis l'app installée, me dire où atterrit le retour (mesure iOS attendue
   depuis le 13 octobre ; si le retour tombe dans Safari, lot à part : `skipBrowserRedirect`).
3. Fusion et `push` (ses gestes). Puis sur le Mac, **site public** : Réglages → Assistant IA montre la configuration
   existante (passe unique) et le texte (d) ; « Envoyer maintenant » force l'envoi initial ; sur l'iPhone connecté :
   la configuration arrive à la passe suivante (« Envoyer maintenant » la force) ; si une entrée est en quarantaine
   `refus` (ordre inversé par erreur) : « Réessayer ».
4. Faire tourner la clé passée par le chat (procédure § 7 si l'ancienne doit être traitée comme exposée) ; plafond de
   dépense du workspace.

## 11. Versions

`APP_VERSION = '0.6.0'` (nouveau schéma local, nouvelle table serveur), `DB_VERSION = 3`, `sw.js VERSION =
'cuisine-os-v0.6.0-N'` (N = numéro de tâche), `SHELL` + `./src/domain/assistant-config.js` (seul module neuf). Pins
`v0\.6\.0-\d+` et `'0.6.0'`.

## 12. Ce que la revue a amendé

**Revue sécurité (S1-S14).** S1 (bloquant) : la passe unique horodatait à « maintenant » → l'horodatage d'origine de
`settings.llm`, repli 1970, rien si `none`/clé vide (§ 5.6). S2 : procédure « appareil perdu ou clé exposée », « Aucun »
≠ révocation (§ 7, K-6). S3 : « se connecter = déposer la clé » ; geste R2 retiré explicitement ; **K-3 : production
seulement** (nouveau prédicat). S4 : `revoke … from anon` sur la table neuve ; preuve des privilèges sur 26 tables et
4 fonctions ; 8.01 à relire à 26 (§ 4.2, § 6, § 9). S5 : jamais `'ecrire'` d'une tombale (elle porte l'ancienne clé) ;
suppression générique d'origine `remote` (§ 5.4, avec F6). S6 : garde `noDelete` dans `db.mutate`, pas un test de
texte (§ 5.4). S7 : règle « jamais `select data` », clé factice en preuve, `RESULTATS` public (§ 7, § 6.3). S8 :
preuve du conflit sur le même compte, `delete` = 0 ligne, adresses de preuve (§ 6.3, § 10). S9 : journaux mesurés par
la preuve, aucune session réelle avant `0003`, « quarantaine » et non « échoue entier » (§ 6.3, § 6.4). S10 : `init()`
précède la capture → l'envoi initial envoie (§ 5.6). S11 : amendement de I7 déclaré ; R-L3-7 côté envoi (§ 1, § 5.5).
S12 : trois états de compte dans K-10. S13 : position après `files` (K-9). S14 : `base_url` https sans identifiants,
vidée pour `anthropic` (§ 4.1).

**Revue faisabilité (F1-F15).** F1 = S13. F2 : vrai comportement « nouveau client, ancien serveur » (quarantaine
`refus`, réception `inconnu` en dernier, geste « Réessayer », `notify pgrst`) et « non éprouvable par la suite »
(§ 6.4). F3 = S10, plus « une seule transaction d'origine `device` » (§ 5.6). F4 = S1. F5 : « Aucun » n'écrit rien sans
ligne ; confirmation avec clé et compte (K-6). F6 = S5. F7 : points d'insertion nommés (`appliquerPage` après
`decider`, `reecrire` côté envoi), jamais remettre en file un refus `conflit`, `ajustes` → `passeAEcrit` (§ 5.5).
F8 = S4. F9 : préalables de la preuve, changement d'utilisateur, `delete` = 0 ligne (§ 6.3, § 10). F10 : liste complète
des tests à retourner (§ 8). F11 : empreintes SHA-256 épinglées, détails de la factorisation (§ 6.1, § 6.2). F12 : pas
d'espion sur un espace de noms → fonction à dépendances injectées (§ 5.2). F13 : normalisation à l'écriture locale et
à la lecture, jamais sur la ligne reçue (§ 4.1). F14 : **K-12** (formulaire non reconstruit sous le focus) entre dans le
lot. F15 : `getSetting('llm')` lève aussi, garde = 1, `created_at` ignoré, chaînes en `en.js`, condition `ctx.sync.user`,
puce « assistant_config : 1 », tests à deux bases par `dbB.mutate`, égalités d'instant par `updated_at` fixes.

**Rulings de construction** : R-CPT-1… (à consigner pendant le SDD).
