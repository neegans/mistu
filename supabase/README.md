# Supabase — comment appliquer et prouver le serveur de synchronisation

Ce dossier contient **tout le serveur** de Cuisine OS : trois migrations générées et une quatrième écrite à la main
(`migrations/`), les preuves à jouer après les avoir appliquées (`proofs/`) et la fonction de la passerelle de l'assistant
(`functions/`). Rien n'est appliqué automatiquement : chaque étape est un geste de
Neegan dans l'éditeur SQL du tableau de bord Supabase. Spec de référence :
`docs/spec-compte-et-stockage-distant.md` (§ 3 pour le serveur, § 7.2 pour les preuves).

```
supabase/
  migrations/0001_tables_et_regles.sql   généré par tools/generer-migrations.mjs — ne pas éditer à la main
  migrations/0002_stockage.sql           idem
  migrations/0003_assistant_config.sql   idem ; à ajout seul (lot « assistant par le compte », étape 8 bis)
  proofs/0001_tables_et_regles.sql       à coller après 0001 ; jetons à remplacer ; n'écrit rien (rollback final)
  proofs/0002_stockage.sql               à coller après 0002 ; lecture seule
  proofs/0003_assistant_config.sql       à coller après 0003 ; jetons à remplacer ; n'écrit rien (rollback final)
  migrations/0004_assistant_journal.sql  écrite à la main, hors du générateur (lot « passerelle de l'assistant », étape 10)
  proofs/0004_assistant_journal.sql      à coller après 0004 ; rien à remplacer ; n'écrit rien (rollback final)
  functions/assistant/                   la fonction de la passerelle (index.ts, logique.js, deno.json) ; déployée par le CLI, étape 10
  proofs/0001_hook.md                    gabarit : capture du crochet « Before User Created »
  proofs/0001_providers.md               gabarit : capture des fournisseurs de connexion
  proofs/RESULTATS-<projet>.md           tes sorties, collées (à créer : un fichier par projet)
```

## Un seul projet : `mitsu` (depuis le 13 octobre 2026, R33)

La spec prévoyait deux projets (D8 : `mistu-dev` puis `mistu`). Neegan a révoqué D8 le 13 octobre : un second projet
coûte 10 $ par mois sur l'organisation Pro, pour un usage personnel. **Tout se joue sur `mitsu`**, le projet réel —
d'où deux règles : la preuve `0001` se joue **avant la première connexion réelle** (elle insère deux comptes et les
annule), et `localhost` reste autorisé (Redirect URLs, entrée `dev` de `config.js`) sur ce projet. Les neuf étapes
ci-dessous ont été jouées le 13 octobre ; sorties dans `proofs/RESULTATS-mitsu.md`. L'étape **8 bis** (migration
`0003`, lot « la configuration de l'assistant suit le compte ») s'y ajoute et reste **à jouer**, ainsi que l'étape **10** (fonction `assistant` et migration `0004`, lot « passerelle de l'assistant »). Pour un projet neuf (changement
d'hébergement, retour à deux projets), elles sont à refaire en entier : les migrations ne « voyagent » pas d'un
projet à l'autre.

## Trois choses à savoir avant de coller

- **Coller depuis l'éditeur SQL du tableau de bord, sous le rôle `postgres`.** Les 25 tables n'héritent des
  privilèges de `authenticated` que par les `alter default privileges` du projet, qui ne s'appliquent qu'aux objets
  créés par `postgres` dans le schéma `public`. Appliquées par une autre connexion (un autre rôle, un outil tiers),
  les tables existeraient, les règles aussi, et **l'application ne pourrait rien lire ni écrire** : la section 1 de
  la preuve `0001` est là pour attraper exactement ça.
- **Un collage = une transaction.** Si une seule instruction échoue, l'éditeur annule **tout** : la base reste
  intacte et le collage est à refaire une fois la cause corrigée. Il n'y a pas d'état « à moitié appliqué ».
- **Les migrations ne sont pas rejouables.** `create table`, `create policy`, `create index`, `create trigger` sur
  les tables de `public` ne sont pas écrits avec `if not exists` : un deuxième collage de `0001` (ou de `0002`)
  échoue sur le premier objet déjà présent — sans rien casser, puisque tout est annulé. **Un seul collage par
  projet.** Pour repartir de zéro, c'est un projet neuf (ou une suppression explicite des objets, hors procédure).

## La procédure, étape par étape

### 1. Coller `0001_tables_et_regles.sql` SANS sa dernière instruction

Ouvrir `migrations/0001_tables_et_regles.sql`, tout sélectionner **sauf la dernière ligne**, qui est exactement :

```sql
select cron.schedule('cuisine-os-tombales', '15 4 * * *', 'select public.purge_tombstones()');
```

La coller dans l'éditeur SQL et exécuter. Pourquoi la retirer : elle est la seule instruction du fichier qui dépend
de l'extension **`pg_cron`**, et comme le collage entier est une seule transaction, son échec annulerait les 25
tables, les 100 règles et les 8 fonctions avec elle.

> Remarque : la **première** instruction du fichier, `create extension if not exists pg_cron;`, peut elle aussi
> échouer sur un projet où l'extension n'est pas disponible pour `postgres` (message « permission denied to create
> extension »). Même conséquence, même remède : voir l'étape 2, puis recoller.

### 2. Activer `pg_cron` si besoin

Tableau de bord → **Database → Extensions** → chercher `pg_cron` → activer. Puis, si l'étape 1 avait échoué sur le
`create extension`, la recoller en entier (rien n'avait été appliqué).

### 3. Coller la dernière instruction, seule

```sql
select cron.schedule('cuisine-os-tombales', '15 4 * * *', 'select public.purge_tombstones()');
```

Attendu : une ligne, un numéro de tâche (`schedule`). C'est le ménage des tombales à 4 h 15, tous les jours (spec
§ 3.1). Si l'instruction échoue encore, **ne pas forcer** : le reste de `0001` fonctionne sans elle, les tombales
s'accumuleront simplement jusqu'à ce que la tâche soit posée. Le noter dans le fichier de résultats.

### 4. Taper les adresses autorisées

**À taper à la main, jamais dans le dépôt** (le dépôt est public) :

```sql
insert into private.allowed_users (email) values (lower('...')), (lower('...')) on conflict do nothing;
```

Une ligne par personne autorisée, en minuscules (la contrainte de la table l'exige). C'est la barrière **B1** : sans
ligne ici, aucun compte ne peut être créé et aucune requête ne renvoie quoi que ce soit. Contrôle :
`select count(*) from private.allowed_users;`.

### 5. Jouer la preuve `0001`

Ouvrir `proofs/0001_tables_et_regles.sql`, **remplacer les quatre jetons** (`A_UUID`, `A_EMAIL`, `B_UUID`,
`B_EMAIL` — lire l'en-tête du fichier), coller le tout, exécuter. La sortie est **un seul tableau** : une ligne par
preuve, plus une ligne `999 BILAN`. `ok = true` partout, et `BILAN` à `0 faux`, c'est vert.

> **Dialogue « Potential issue detected » du tableau de bord.** La preuve crée une table temporaire sans RLS ; le
> tableau de bord le détecte et propose « Run and enable RLS ». **Choisir « Run without RLS »** : l'autre bouton
> ajoute `alter table preuve enable row level security` **après** le `rollback` final, la table n'existe plus, et
> l'éditeur n'affiche que `42P01 relation "preuve" does not exist` alors que la preuve a tourné et s'est annulée
> normalement (mesuré le 13 octobre ; vérifié : rien n'avait persisté). Même dialogue pour la preuve `0002`.

- La preuve **n'écrit rien** : sa dernière instruction est `rollback;`. Elle est rejouable telle quelle.
- Toute ligne `ok = false` renvoie à la **tâche 3** (le générateur de migrations), pas à un rafistolage à la main.
  La section 1 porte son propre remède en commentaire : c'est la seule à appliquer soi-même, et à signaler.

**Deux adresses de preuve.** La preuve insère deux lignes dans `auth.users` (et les annule). `auth.users` refuse un
doublon de courriel : si une des deux adresses a **déjà** un compte — ce sera le cas sur `mistu` dès la première
connexion réelle — la preuve s'arrête net, avec un message qui le dit. Deux solutions : jouer la preuve **avant** la
première connexion, ou ajouter à `private.allowed_users` deux adresses dédiées à la preuve, du domaine réservé
`exemple.invalid` (elles n'ont pas besoin d'exister : rien ne leur est envoyé), les utiliser comme `A_EMAIL` et
`B_EMAIL`, puis les retirer de la liste après coup.

> Si l'insertion dans `auth.users` est refusée (« permission denied for table users »), c'est que `postgres` n'a pas
> les privilèges sur le schéma `auth` de ce projet : le noter et le signaler, la preuve ne peut pas être jouée telle
> quelle (le reste du § 7.2 demanderait alors deux comptes créés par le tableau de bord).
>
> Si elle est refusée pour une **colonne obligatoire** (« null value in column "…" violates not-null constraint ») :
> certaines versions du schéma GoTrue ont des colonnes `not null` **sans valeur par défaut** — `encrypted_password`
> en est le cas classique. Remède immédiat : ajouter la colonne nommée dans l'erreur à la liste des deux `insert
> into auth.users`, avec une valeur factice (`''` pour du texte, `now()` pour une date), et **le signaler** : la
> liste des colonnes de la preuve devra suivre la version du schéma.
>
> Si un verdict échoue sur « **permission denied for schema pg_temp_…** » : me le signaler. La preuve écrit ses
> verdicts dans une table temporaire, et elle tente explicitement d'accorder `usage` sur ce schéma (verdict 0.01, qui
> dit si le `grant` a été accordé ou refusé). Si ni le `grant` ni l'accès implicite ne passent, la preuve sera
> réécrite avec un `reset role` avant chaque verdict.

### 6. Coller `0002_stockage.sql`

Ouvrir `migrations/0002_stockage.sql`, coller le tout, exécuter. Crée le seau privé `pages` (50 Mo, six types), ses
quatre règles et la vue de suivi. **Après `0001`, jamais seul** : il appelle `public.is_allowed()` et écrit dans le
schéma `private`, tous deux nés en `0001`.

> Si `create policy … on storage.objects` est refusé (« must be owner of table objects »), c'est que cette table
> appartient à `supabase_storage_admin` sur ce projet : **tout `0002` est annulé** (même mode d'échec que l'étape 1),
> les quatre règles doivent alors être posées depuis **Storage → Policies** du tableau de bord, et il faut le signaler.

### 7. Jouer la preuve `0002`

Coller `proofs/0002_stockage.sql` (aucun jeton à remplacer, lecture seule). Même lecture : un tableau, une ligne
`999 BILAN`. Les refus réels (objet hors de son dossier, type hors liste, plus de 50 Mo) ne s'y trouvent pas : ils
sont prononcés par l'API de téléversement et se jouent **depuis l'app**, au lot L4.

### 8. Brancher le crochet, et le prouver

Tableau de bord → **Authentication → Hooks** → **Before User Created** → type *Postgres function* → choisir
`public.before_user_created` → activer. Puis remplir `proofs/0001_hook.md` (capture + date + projet).

### 8 bis. Coller `0003_assistant_config.sql`, puis jouer sa preuve

Lot « la configuration de l'assistant suit le compte » (spec
`docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md`, § 6). Cette étape s'ajoute aux neuf autres
(placée ici pour l'ordre de lecture : elle ne dépend que de `0001` et `0002`) et se joue **une fois** — et **avant
tout `push` du code de ce lot** : un client neuf
contre un serveur sans `0003` mettrait sa configuration en quarantaine (`refus`), et un `raise` de `sync_push` peut
journaliser son paramètre côté Postgres (spec § 6.4).

`0003` est **à ajout seul** : elle crée `public.assistant_config` (même gabarit que les 25 autres tables), la révoque
pour `anon` (la révocation générale de `0001` ne couvrait que les tables d'alors), et **recrée** les quatre fonctions
qui portent la liste des magasins — `sync_push`, `sync_purge`, `sync_purge_all`, `purge_tombstones` — avec les 26
noms ; leurs `revoke`/`grant` sont rejoués, sans effet. `0001` et `0002` ne changent pas d'un octet (empreintes
SHA-256 épinglées dans `tools/generer-migrations.test.mjs`). Comme `0001`, elle n'est **pas rejouable** : un second
collage échoue sur le `create table` et n'applique rien. Pas de `cron.schedule` ici : la tâche du ménage appelle
`purge_tombstones` par son nom, la recréer ne la touche pas.

1. **Deux adresses de preuve**, tapées à la main : deux adresses inventées du domaine réservé `exemple.invalid` (rien
   ne leur est envoyé), sans compte dans `auth.users` — les mêmes que pour `0001` conviennent, puisqu'elles ont été
   retirées :
   ```sql
   insert into private.allowed_users (email) values (lower('...')), (lower('...')) on conflict do nothing;
   ```
2. **Coller `migrations/0003_assistant_config.sql`** en entier, depuis l'éditeur SQL, sous `postgres` (comme `0001` :
   c'est ce qui donne à `authenticated` ses droits sur la table neuve — verdict 2.01 de la preuve). Attendu :
   `Success. No rows returned`.
3. **Jouer `proofs/0003_assistant_config.sql`** : remplacer les quatre jetons (`A_UUID`, `B_UUID` : deux
   `select gen_random_uuid();` ; `A_EMAIL`, `B_EMAIL` : les deux adresses de l'étape 1, en minuscules), coller le
   tout, exécuter, et choisir **« Run without RLS »** au dialogue du tableau de bord (voir l'étape 5, « Jouer la preuve
   `0001` »). Lire d'abord la
   ligne `999 BILAN` : `0 faux`, c'est vert. Les clés poussées par la preuve sont **factices** (`sk-factice-…`) et la
   preuve n'affiche jamais la colonne `data` : seulement la longueur de la clé. Les lignes `7.01` à `7.05` (journaux
   de Postgres) restent `ok = true` quelle que soit leur valeur, mais elles **se jugent ici, avant le `push`** : c'est
   le seul moment où on les voit. Clé de lecture (d'après la documentation de PostgreSQL, non mesurée sur `mitsu`) —
   la clé de l'assistant peut finir dans les journaux de Postgres si :
   - `log_statement` (7.03) vaut `all` ou `log_min_duration_statement` (7.04) n'est pas `-1` — **et, dans les deux
     cas,** `log_parameter_max_length` (7.05) n'est pas `0` : un envoi **réussi** de `sync_push` peut être journalisé
     avec ses paramètres (le lot envoyé, donc la clé) ;
   - `log_min_error_statement` (7.01) vaut `error` ou un niveau plus bas (`warning`, `notice`, `info`, `debug1` à
     `debug5`) — **et** `log_parameter_max_length_on_error` (7.02) n'est pas `0` : un envoi **en erreur** (adresse
     retirée de la liste, `store inconnu`) peut être journalisé avec ses paramètres.

   Si l'une de ces conditions est remplie : le noter dans `RESULTATS-mitsu.md` et le dire **avant** le `push`. Jamais
   une valeur de `data` recopiée.
4. **Retirer les deux adresses de preuve** :
   `delete from private.allowed_users where email in (lower('...'), lower('...'));`, puis contrôle
   `select count(*) from private.allowed_users;` (le nombre d'avant l'étape 1).
5. Si une lecture de la table rend **404** ensuite (dans l'app ou par l'API) : `notify pgrst, 'reload schema';` — le
   cache de schéma de PostgREST n'avait pas encore vu la table.
6. **Consigner** la sortie dans `proofs/RESULTATS-mitsu.md`, section « Preuve `0003_assistant_config.sql` » déjà
   préparée : jetons remis, **aucune valeur de `data`** (le dépôt est public). Ensuite seulement : fusion et `push`.

> **Règle de lecture de `public.assistant_config`** (spec § 7) : aucune requête, humaine ou d'agent, ne lit la colonne
> `data` de cette table — elle porte la clé de l'assistant, en clair. Pour un diagnostic : `data - 'api_key'` (la
> fiche sans la clé) et `length(data->>'api_key')`, rien d'autre.

Une fois `0003` appliquée, la figer : liste `SYNC_STORES_0003` + empreinte SHA-256 épinglée (logique F11), au
prochain lot qui touche le générateur. L'empreinte du fichier collé se relit par
`shasum -a 256 supabase/migrations/0003_assistant_config.sql` et se consigne dans `RESULTATS-mitsu.md`.

### 9. Fermer les autres portes, et le prouver

Tableau de bord → **Authentication → Providers** : **Google** activé, et lui seul — **Email** désactivé (ni mot de
passe, ni *magic link*), **Phone** désactivé, **Anonymous** désactivé, *Confirm email* activé, liaison automatique
d'identités désactivée. Puis remplir `proofs/0001_providers.md` (capture + date + projet).

### 10. La passerelle de l'assistant : secret, fonction, `0004` et sa preuve

Lot « passerelle de l'assistant » (spec `docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md`) : la clé
Anthropic quitte les appareils. Une fonction Supabase, `assistant`, la pose sur chaque appel, après avoir vérifié la
session, la liste des adresses admises et le quota du jour ; elle ne journalise que des compteurs (table
`assistant_journal`, migration `0004`). Cette étape se joue **une fois**, **avant** de pousser le code du client qui
appelle la fonction. Aucun des gestes ci-dessous n'appelle Anthropic ni ne dépense.

1. **Poser le secret.** Tableau de bord → **Edge Functions → Secrets** : ajouter `ANTHROPIC_API_KEY`, la clé du
   workspace Anthropic de Cuisine OS (celui qui a un plafond de dépense mensuel). **Jamais dans un fichier**, ni dans
   le dépôt, ni dans une conversation : seul son nom y figure. Trois autres secrets sont facultatifs, avec une valeur
   par défaut : `ASSISTANT_MODELE` (le modèle imposé aux appels, `claude-sonnet-5-5`), `ASSISTANT_QUOTA_JOUR` (appels par
   compte et par jour UTC, 60) et `ASSISTANT_ORIGINES` (origines admises, séparées par des virgules,
   `https://neegans.github.io` ; ajouter `http://localhost:8083` pour essayer depuis le Mac).
2. **Déployer la fonction.** Préalable, une seule fois : `supabase login` dans Terminal. Puis, depuis la racine du dépôt :
   ```
   supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt
   ```
   `--no-verify-jwt` est voulu : la fonction vérifie elle-même la session (`auth.getUser`) et la liste admise
   (`is_allowed()`), et le navigateur envoie d'abord une requête `OPTIONS` **sans jeton** que la vérification amont de
   Supabase refuserait — le client n'enverrait alors jamais sa vraie demande.
3. **Coller `0004`, puis sa preuve**, dans l'éditeur SQL sous `postgres`, comme à l'étape 8 bis : d'abord
   `migrations/0004_assistant_journal.sql` en entier (à ajout seul ; attendu `Success. No rows returned`), puis
   `proofs/0004_assistant_journal.sql` — **rien à remplacer, aucune adresse à ajouter** — en choisissant
   **« Run without RLS »**. Lire d'abord la ligne `999 BILAN` (`0 faux` = vert), puis consigner le tableau tel quel dans
   `RESULTATS-mitsu.md` (la preuve n'affiche aucune adresse). Tant que `0004` n'est pas collée, un `POST` valide
   (session ouverte, adresse admise) répond `502 serveur` avant tout appel au fournisseur.
4. **Trois sondes sans dépense.** Dans Terminal : `U=https://ybdooerfeziiabsbfxtb.supabase.co/functions/v1/assistant`,
   puis, avec l'en-tête d'origine (sans lui, la fonction répond `403 origine`, sa première garde) :
   - `curl -i -X OPTIONS -H 'Origin: https://neegans.github.io' "$U"` → **204**, avec `Access-Control-Allow-Origin` ;
   - `curl -i -X POST -H 'Origin: https://neegans.github.io' "$U"` → **401** `{"erreur":"non_connecte"}` (un 401 qui
     dit `Invalid JWT` vient du portail Supabase : la fonction a été déployée sans `--no-verify-jwt`) ;
   - `GET` avec un jeton de session : dans la console du navigateur, sur le site connecté,
     `JSON.parse(localStorage.getItem('sb-ybdooerfeziiabsbfxtb-auth-token')).access_token` (nom par défaut de
     supabase-js, non vérifié ici), puis `curl -i -H 'Origin: https://neegans.github.io' -H 'Authorization: Bearer <jeton>' "$U"`
     → **200** `{"modele":"claude-sonnet-5-5","quotaJour":60}`. Le jeton vaut une heure : ne le colle nulle part.
5. **Changer le quota sans redéployer** : `supabase secrets set ASSISTANT_QUOTA_JOUR=120 --project-ref ybdooerfeziiabsbfxtb`,
   puis relire `quotaJour` par la troisième sonde (même geste pour `ASSISTANT_MODELE` et `ASSISTANT_ORIGINES`).
6. **Faire tourner la clé** (rotation) : remplacer la valeur du secret `ANTHROPIC_API_KEY` dans le tableau de bord (pas par
   `supabase secrets set`, qui laisserait la clé dans l'historique du shell), puis révoquer l'ancienne dans la console
   Anthropic. Rien d'autre : ni migration, ni changement dans l'app.

## Où coller les sorties

Dans `supabase/proofs/RESULTATS-<projet>.md` — donc `RESULTATS-mitsu.md` (un seul projet depuis le 13 octobre, R33). Un fichier
par projet, avec la date, et pour chaque preuve le tableau tel que l'éditeur l'affiche.

**Sans adresses.** Le dépôt est public : remettre les jetons `A_EMAIL` / `B_EMAIL` / `A_UUID` / `B_UUID` à la place
des valeurs utilisées, partout, avant de coller — y compris dans les messages d'erreur recopiés. Aucune clé non
plus : la clé `anon` et l'URL du projet sont publiques par conception et vivent dans `src/sync/config.js` ; la clé
`service_role`, jamais, nulle part.

L1 n'est fini que quand les deux preuves sont vertes et consignées, et que les deux captures sont collées.

## Appareil perdu ou clé exposée

Depuis le lot « la configuration de l'assistant suit le compte » (spec § 7), un appareil connecté porte la clé de
l'assistant de **tous** les appareils du compte, et une clé tournée lui parviendrait à sa prochaine passe. Choisir
« Aucun » dans Réglages → Assistant IA ne révoque rien (un appareil hors ligne garde sa copie, les sauvegardes du
projet Supabase aussi). Dans cet ordre :

1. **Retirer l'adresse** de la liste, tapée à la main :
   `delete from private.allowed_users where email = lower('...');` — toute lecture et tout envoi sont refusés dès la
   requête suivante (preuve `0001`, verdicts 9.01-9.03), même avec une session encore ouverte.
2. **Fermer les sessions** : tableau de bord → **Authentication → Users** → ce compte → fermer toutes ses sessions.
3. **Révoquer l'ancienne clé** dans la console Anthropic (workspace de Cuisine OS), sans attendre : la clé exposée
   est utilisable directement chez le fournisseur.
4. **Attendre l'expiration des jetons d'accès** (R-CPT-6) : attendre que la durée de vie d'un jeton d'accès se soit
   écoulée depuis la fermeture des sessions — réglage « JWT expiry » du projet, 3600 s par défaut, à lire dans
   Authentication → Settings (emplacement à confirmer dans le tableau de bord : non vérifié). Fermer les sessions
   révoque les jetons de rafraîchissement, mais un jeton d'accès déjà émis reste valide jusqu'à son expiration :
   l'adresse remise trop tôt, l'appareil perdu recevrait la nouvelle clé à sa prochaine passe. L'adresse reste hors de la liste pendant tout ce temps.
5. **Remettre l'adresse** (`insert into private.allowed_users (email) values (lower('...'));`), reconnecter les
   appareils gardés, et entrer la nouvelle clé **une fois**, dans Réglages → Assistant IA d'un appareil connecté :
   elle suit le compte jusqu'aux autres. Sur chaque appareil gardé, **recharger Réglages et vérifier que la clé reçue
   est la nouvelle avant tout « Enregistrer »** : la synchronisation est « dernier qui écrit gagne » à la ligne, et un
   « Enregistrer » fait avec l'ancienne clé encore en mémoire (appareil resté hors ligne pendant la rotation, ou page
   Réglages restée ouverte) la renverrait partout.
