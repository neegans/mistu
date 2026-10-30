# Supabase — comment appliquer et prouver le serveur de synchronisation

Ce dossier contient **tout le serveur** de Cuisine OS : onze migrations générées (`0001`, `0002`, `0003`, `0005`, `0008` à `0014`) et trois
écrites à la main (`0004`, `0006`, `0007`), dans `migrations/` ; les preuves à jouer après les avoir appliquées (`proofs/`) et la fonction de la passerelle de l'assistant
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
  migrations/0005_imports.sql            généré par tools/generer-migrations.mjs ; à ajout seul (lot A « importer une recette repérée », étape 11)
  proofs/0005_imports.sql                à coller après 0005 ; jetons à remplacer ; n'écrit rien (rollback final)
  migrations/0006_lecture_web.sql        écrite à la main, hors du générateur (lot B « recette web complète », étape 12)
  proofs/0006_lecture_web.sql            à coller après 0006 ; rien à remplacer ; n'écrit rien (rollback final)
  migrations/0007_apercu_web.sql         écrite à la main, hors du générateur (lot UI-2 « aperçus des résultats web », étape 13)
  proofs/0007_apercu_web.sql             à coller après 0007 ; rien à remplacer ; n'écrit rien (rollback final)
  migrations/0008_corbeille_recettes.sql générée par tools/corbeille-sql.mjs (via generer-migrations.mjs), lot L1, étape 14
  proofs/0008_corbeille_recettes.sql     preuve mutante réservée à une base de test ; rollback final
  proofs/0008_corbeille_concurrence.cjs  deux sessions sur le PostgreSQL local de preuve uniquement
  migrations/0009_corbeille_livres.sql   cycle des éditions, générée
  migrations/0010_sources_index.sql      sources et index, générée
  migrations/0011_ingredients_traductions.sql traductions, générée
  migrations/0012_cuisine_minuteurs.sql  cuisine et minuteries, générée
  migrations/0013_inventaire.sql         inventaire, générée
  migrations/0014_maintenance_et_bornes.sql maintenance, générée ; NON appliquée
  proofs/0014_maintenance.sql           preuves mutantes, base locale jetable uniquement
  functions/assistant/                   la fonction de la passerelle (index.ts, logique.js, lecture-web.js, deno.json) ; déployée par le CLI, étape 10
  proofs/0001_hook.md                    gabarit : capture du crochet « Before User Created »
  proofs/0001_providers.md               gabarit : capture des fournisseurs de connexion
  proofs/RESULTATS-<projet>.md           tes sorties, collées (à créer : un fichier par projet)
```

## Un seul projet : `mitsu` (depuis le 13 octobre 2026, R33)

La spec prévoyait deux projets (D8 : `mistu-dev` puis `mistu`). Neegan a révoqué D8 le 13 octobre : un second projet
coûte 10 $ par mois sur l'organisation Pro, pour un usage personnel. **Tout se joue sur `mitsu`**, le projet réel —
d'où deux règles : la preuve `0001` se joue **avant la première connexion réelle** (elle insère deux comptes et les
annule), et `localhost` reste autorisé (Redirect URLs, entrée `dev` de `config.js`) sur ce projet. Les neuf étapes
ci-dessous ont été jouées le 13 octobre ; sorties dans `proofs/RESULTATS-mitsu.md`. Les étapes **8 bis** (migration
`0003`, lot « la configuration de l'assistant suit le compte ») et **10** (fonction `assistant` et migration `0004`, lot « passerelle de
l'assistant ») s'y sont ajoutées et ont été jouées le 18 octobre ; l'étape **11** (migration `0005`, lot A « importer une recette
repérée ») s'y ajoute et reste **à jouer**. Pour un projet neuf (changement
d'hébergement, retour à deux projets), elles sont à refaire en entier : les migrations ne « voyagent » pas d'un
projet à l'autre.

## Trois choses à savoir avant de coller

- **Coller depuis l'éditeur SQL du tableau de bord, sous le rôle `postgres`.** Les tables synchronisées (27 avec `0005`) n'héritent des
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
sont prononcés par l'API de téléversement et se jouent **depuis l'app**, au lot L4. L4 utilise ces règles (lot G) ; l'espace est mesuré par
l'app en listant son dossier ; le quota est celui du projet, l'app ne le connaît pas.

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
   compte et par jour UTC, 60) et `ASSISTANT_ORIGINES` (origines admises, séparées par des virgules). Posée,
   `ASSISTANT_ORIGINES` **REMPLACE la valeur par défaut** (`https://neegans.github.io`) : pour essayer depuis le Mac,
   lister les deux origines, séparées par une virgule (`https://neegans.github.io,http://localhost:8086` : le port est celui du
   serveur local qui sert l'app).
   Ces trois valeurs sont relues à chaque requête : une valeur changée est prise au prochain appel ; un isolat déjà chaud
   peut garder l'ancienne valeur jusqu'à son recyclage (non prouvé).
2. **Déployer la fonction.** Préalable, une seule fois : `supabase login` dans Terminal. Puis, depuis la racine du dépôt :
   ```
   supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api
   ```
   `--use-api` fait construire le paquet côté serveur de Supabase : ni Docker ni démon local n'est requis (c'est la forme qui a
   servi aux deux déploiements du 18 octobre). `--no-verify-jwt` est voulu : la fonction vérifie elle-même la session (`auth.getUser`) et la liste admise
   (`is_allowed()`), et le navigateur envoie d'abord une requête `OPTIONS` **sans jeton** que la vérification amont de
   Supabase refuserait — le client n'enverrait alors jamais sa vraie demande.
3. **Coller `0004`, puis sa preuve**, dans l'éditeur SQL sous `postgres`, comme à l'étape 8 bis : d'abord
   `migrations/0004_assistant_journal.sql` en entier (à ajout seul ; elle crée aussi la fonction
   `public.assistant_reserver`, la réservation atomique d'un appel, que seule la clé secrète du projet peut exécuter ;
   attendu `Success. No rows returned`), puis, **collée seule** dans l'éditeur, la ligne
   ```sql
   notify pgrst, 'reload schema';
   ```
   (PostgREST doit connaître `assistant_reserver` : sans elle, l'appel de la fonction répond `PGRST202` et tous les `POST`
   valides rendent `502 serveur`), puis
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
     supabase-js, non vérifié ici) ; copier le jeton, puis dans Terminal **ne jamais le coller dans une commande** (il
     resterait dans l'historique) : `read -rs JETON` (coller le jeton, Entrée : rien ne s'affiche), puis
     `curl -i -H 'Origin: https://neegans.github.io' -H "Authorization: Bearer $JETON" "$U"`
     → **200** `{"modele":"claude-sonnet-5-5","quotaJour":60,"cles":"nouvelles"}`, et enfin `unset JETON`. Le jeton vaut une heure.
     `cles` est un repère **non secret** : par quelle voie la fonction a lu ses deux clés Supabase. `nouvelles` : les variables
     injectées `SUPABASE_PUBLISHABLE_KEYS` et `SUPABASE_SECRET_KEYS` (une clé n'est prise que si elle commence par son préfixe,
     `sb_publishable_` ou `sb_secret_` — liste d'objets `{ api_key }`, liste de chaînes, objet ou chaîne nue, toutes les formes
     sont lues) ; `legacy` : le repli sur `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` ; `mixte` : une de chaque. Les deux
     valeurs marchent ; ce champ dit seulement laquelle sert (la sonde d'un jeton bidon, elle, ne les distingue pas).
5. **Changer le quota sans redéployer** : `supabase secrets set ASSISTANT_QUOTA_JOUR=120 --project-ref ybdooerfeziiabsbfxtb`,
   puis relire `quotaJour` par la troisième sonde (même geste pour `ASSISTANT_MODELE` et `ASSISTANT_ORIGINES`).
6. **Faire tourner la clé** (rotation) : remplacer la valeur du secret `ANTHROPIC_API_KEY` dans le tableau de bord (pas par
   `supabase secrets set`, qui laisserait la clé dans l'historique du shell), puis révoquer l'ancienne dans la console
   Anthropic. Rien d'autre : ni migration, ni changement dans l'app.
7. **Geste facultatif : vider côté serveur toute ligne de configuration qui porterait encore une clé.** L'app vide elle-même
   la sienne : à **chaque** démarrage, une ligne `llm` qui porte une clé ou un fournisseur est réécrite vide et part au compte
   (elle efface alors celle du serveur et des autres appareils). Mais une ligne-clé qui dort sur le serveur sans qu'aucun
   appareil se reconnecte reste là ; ce geste la vide à la main, une fois, dans l'éditeur SQL sous `postgres`. **À ne coller que
   si tu le veux : la fonction ne le fait pas, et rien dans le dépôt ne l'exécute.** Attendu `UPDATE n`, où *n* est le nombre
   de lignes qui portaient une clé ou un fournisseur (`UPDATE 0` : rien à vider) :
   ```sql
   update public.assistant_config set data = data || '{"provider":"none","model":"","base_url":"","api_key":""}'::jsonb, updated_at = now() where coalesce(data->>'api_key','') <> '' or coalesce(data->>'provider','none') <> 'none';
   ```
   (La table est celle de `0003` : `data` est la colonne jsonb de la ligne, `updated_at` son horodatage ; le déclencheur
   `touch_server_seq` pose le numéro de séquence, donc les appareils la reçoivent à leur prochaine passe. La clé, elle, reste
   valide chez Anthropic tant qu'on ne l'a pas révoquée : voir le point 6.)

### 11. Coller `0005_imports.sql`, puis jouer sa preuve

Lot A « importer une recette repérée » (spec `docs/superpowers/specs/2026-10-18-import-cible-design.md`, § 3.5) : le journal des
imports (magasin `imports`, 27e magasin synchronisé, le dernier, K-9) a sa table sur le serveur. Cette étape se joue **une fois**,
après `0003` (elle ne dépend pas de `0004`), et **avant tout `push` du code de ce lot** : un client neuf contre un serveur sans
`0005` verrait `sync_push` refuser son lot (`store inconnu`) et mettrait ses lignes `imports` en quarantaine (`refus`, bruyante, non
destructive : Réglages → Synchronisation → « Réessayer » sur l'entrée, une fois `0005` collée). Côté **réception**, le même client
s'arrêterait sur `imports` — la dernière table (K-9) : les 26 autres sont reçues, rien n'est perdu — avec un échange en erreur à chaque
passe (le 404 de PostgREST sur une table qu'il ne connaît pas est classé `inconnu`), visible dans Réglages → Synchronisation ; il
disparaît sans geste dès que `0005` est collée et le cache de schéma de PostgREST rechargé (geste 3). Lecture du code (`src/sync/transport.js`, `src/sync/pull.js`), non
mesurée contre PostgREST.

`0005` est **à ajout seul**, générée par `tools/generer-migrations.mjs` pour les magasins de `SYNC_STORES` absents de la liste figée
`SYNC_STORES_0003` (aujourd'hui `imports`, seul) : elle crée `public.imports` (même gabarit que les 26 autres tables, plus trois
colonnes générées `edition_id`, `recipe_id` et `status`, lues dans la fiche, chacune avec son index), la révoque pour `anon` (la
révocation générale de `0001` ne couvrait que les tables d'alors), et **recrée** les quatre fonctions qui portent la liste des
magasins — `sync_push`, `sync_purge`, `sync_purge_all`, `purge_tombstones` — avec les 27 noms ; leurs `revoke`/`grant` sont rejoués,
sans effet. `0001`, `0002` et `0003` ne changent pas d'un octet (empreintes SHA-256 épinglées dans `tools/generer-migrations.test.mjs`).
Comme `0003`, elle n'est **pas rejouable** : un second collage échoue sur le `create table` et n'applique rien. Pas de `cron.schedule`
ici non plus.

1. **Une adresse de preuve**, tapée à la main : une adresse inventée du domaine réservé `exemple.invalid` (rien ne lui est envoyé),
   sans compte dans `auth.users` — une de celles de `0003` convient, puisqu'elles ont été retirées :
   ```sql
   insert into private.allowed_users (email) values (lower('...')) on conflict do nothing;
   ```
2. **Coller `migrations/0005_imports.sql`** en entier, depuis l'éditeur SQL, sous `postgres` (comme `0001` et `0003` : c'est ce qui
   donne à `authenticated` ses droits sur la table neuve — verdict 2.01 de la preuve). Attendu : `Success. No rows returned`.
3. Puis, **collée seule** dans l'éditeur, la ligne
   ```sql
   notify pgrst, 'reload schema';
   ```
   (le cache de schéma de PostgREST doit connaître `public.imports` et la nouvelle `sync_push` ; sans elle, une lecture de la table
   ou un envoi peut répondre 404 jusqu'au prochain rechargement).
4. **Jouer `proofs/0005_imports.sql`** : remplacer les deux jetons (`A_UUID` : un `select gen_random_uuid();` ; `A_EMAIL` : l'adresse
   de l'étape 1, en minuscules), coller le tout, exécuter, et choisir **« Run without RLS »** au dialogue du tableau de bord (voir
   l'étape 5, « Jouer la preuve `0001` »). Lire d'abord la ligne `999 BILAN` : `0 faux`, c'est vert. La preuve pousse deux lignes
   `imports` factices par `sync_push` (un import de recette qu'elle fait passer à `a_verifier`, un import d'index sans `recipe_id`), les
   relit par leurs colonnes générées, essaie un `delete` direct (refusé sans `app.purge`), relit les quatre fonctions, puis annule tout
   (`rollback;`) ; elle n'affiche jamais la colonne `data` (seulement des compteurs et des verdicts « conforme / différente »).
5. **Retirer l'adresse de preuve** : `delete from private.allowed_users where email = lower('...');`, puis contrôle
   `select count(*) from private.allowed_users;` (le nombre d'avant l'étape 1).
6. **Consigner** la sortie dans `proofs/RESULTATS-mitsu.md`, section « Preuve `0005_imports.sql` — à jouer » déjà préparée : jetons
   remis, aucune adresse. Ensuite seulement : fusion et `push`.

**Archives et clients plus anciens.** Une archive ZIP faite par l'app à jour porte `data/imports.json` et son décompte. Un client
**plus ancien** (0.8.x) qui la lit la refuse déjà, par ses contrôles d'archive — trois messages : « Description de magasin absente ou inconnue »,
« Décompte de magasin inconnu : imports » et « Entrée non déclarée dans le manifeste : data/imports.json » — : le remède est simple, **mets l'app à jour** sur cet appareil (recharge la page ou relance
l'app installée), puis restaure ; ne retouche pas l'archive. L'inverse — une archive d'avant le lot lue par l'app à jour — se restaure
en fusion comme en remplacement : `imports` y vaut une liste vide.

Une fois `0005` appliquée, la figer : liste `SYNC_STORES_0005` + empreinte SHA-256 épinglée (même logique que `SYNC_STORES_0003`), au
prochain lot qui touche le générateur. L'empreinte du fichier collé se relit par `shasum -a 256 supabase/migrations/0005_imports.sql`
et se consigne dans `RESULTATS-mitsu.md`.

### 12. Coller `0006_lecture_web.sql`, puis jouer sa preuve

Lot B « recette web complète » (spec `docs/superpowers/specs/2026-10-19-recette-web-design.md`, § 3.7 et § 6.4) : la passerelle gagne
un quatrième outil, `lecture-web` — la fonction télécharge elle-même la page d'un lien gardé et la lit (les données que le site publie
d'abord, le modèle seulement sinon). Le `check` de colonne du journal (`0004`) ne connaît que trois outils : **un code servi avant `0006` :
chaque lecture web répond 502 `serveur` (la réservation refuse l'outil), rien d'autre ne change.** `0006` est écrite à la main, comme
`0004` (hors du générateur et de `--check`), et ne touche qu'à cette contrainte : ni table, ni fonction, ni privilège ; la contrainte admet
aussi `image-web` (lot F, à venir), qu'aucun code de ce lot n'écrit.

1. **Coller `migrations/0006_lecture_web.sql`** en entier, sous `postgres` (un collage = une transaction). Attendu :
   `Success. No rows returned`. Si la contrainte porte un autre nom sur ce projet, le collage échoue sans rien appliquer : la garde 0
   de la preuve nomme alors les contraintes `check` réelles, à relever avant de corriger.
2. Facultatif : `notify pgrst, 'reload schema';` collée seule — aucune table ni fonction neuve, le cache de PostgREST n'a rien à apprendre.
3. **Jouer `proofs/0006_lecture_web.sql`** (rien à remplacer, aucune adresse à ajouter ; « Run without RLS »). Lire la ligne
   `999 BILAN` : `0 faux`, c'est vert — dont 1.01 (les cinq outils, dans l'ordre d'`OUTILS_0006`) et 2.03 bis (`image-web` accepté par
   `assistant_reserver`).
4. **Consigner** la sortie dans `proofs/RESULTATS-mitsu.md`, section « Preuve `0006_lecture_web.sql` — à jouer » déjà préparée.
5. **Ordre, sans exception** : `0006` → redéploiement de la fonction (la commande du point 2 de l'étape 10 :
   `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api`) → les sondes sans dépense
   S13-S16, S19 (l'alias de la fonction, `https://ybdooerfeziiabsbfxtb.functions.supabase.co/` → 422 `interdit` sans réservation, R-B-23) et les neuf sondes S1-S9 du lot 4 rejouées (leur liste : `RESULTATS-mitsu.md`, section « Passerelle `assistant` ») → S17-S18, un
   appel du quota chacune, sans dépense Anthropic (zéro jeton) : S17, une adresse
   `https` en 301 / 302 vers une page à JSON-LD `Recipe` complet — attendu une lecture `jsonld` sans appel au modèle, ou un refus propre et
   nommé ; une redirection opaque (502 `inaccessible` sur une chaîne que `curl` suit) impose une ronde sur `telechargerPage` avant d'aller
   plus loin → fusion → `push`. Les sondes se consignent dans la section « Sondes `lecture-web` » de `RESULTATS-mitsu.md`.
   S13-S15 et S17-S18 passent la session et la liste admise : elles se jouent avec la session lue comme au point 4 de l'étape 10
   (`read -rs JETON`, jamais le jeton dans une commande, `unset JETON` à la fin) ; S16 se joue sans jeton. S17 se vérifie d'abord sans la
   fonction, avec SON `User-Agent` (un site peut rediriger selon l'agent) : `curl -sI -A 'Mitsu/0.10 (+https://neegans.github.io/mistu/)'`
   sur l'adresse pour la redirection, puis `curl -s` sur la cible pour le bloc JSON-LD.

### 13. Coller `0007_apercu_web.sql`, puis jouer sa preuve

Lot UI-2 « aperçus des résultats web » (spec `docs/superpowers/specs/2026-10-23-experience-carnet-design.md`, § 6 et D-UI-14) : la passerelle gagne
un sixième outil, `apercu-web`, sans modèle — pour les adresses des liens d'une recherche (cinq au plus), la fonction télécharge chaque page, en tire
l'adresse d'image par la règle du lot F (`Recipe` lisible, sinon `og:image`), télécharge l'image (1 Mio au plus) et rend une entrée par adresse ; un
appel du quota pour les cinq, zéro jeton. Le `check` de colonne du journal, tel que `0006` l'a laissé, ne connaît que cinq outils : **un code servi
avant `0007` : chaque demande d'aperçus répond 502 `serveur` (la réservation refuse l'outil) ; l'app montre les résultats sans image, rien d'autre ne
change.** `0007` est écrite à la main, comme `0004` et `0006` (hors du générateur et de `--check`), et ne touche qu'à cette contrainte : ni table, ni
fonction, ni privilège ; le `drop` et l'`add` tiennent dans une transaction (DDL transactionnel : aucune fenêtre sans contrainte). Après `0007`,
**la preuve `0006` devient historique** : rejouée, son 1.01 rougit (il attend cinq valeurs) — c'est attendu, pas un défaut.

1. **Coller `migrations/0007_apercu_web.sql`** en entier, sous `postgres` (un collage = une transaction). Attendu : `Success. No rows returned`. Si la
   contrainte porte un autre nom sur ce projet, le collage échoue sans rien appliquer : la garde 0 de la preuve nomme alors les contraintes `check`
   réelles, à relever avant de corriger. Relever l'empreinte du fichier collé : `shasum -a 256 supabase/migrations/0007_apercu_web.sql`.
2. Facultatif : `notify pgrst, 'reload schema';` collée seule — aucune table ni fonction neuve, le cache de PostgREST n'a rien à apprendre.
3. **Jouer `proofs/0007_apercu_web.sql`** (rien à remplacer, aucune adresse à ajouter ; « Run without RLS »). Lire la ligne `999 BILAN` : `0 faux sur 11`,
   c'est vert — dont 1.01 (les six outils, dans l'ordre d'`OUTILS_0007`) et 2.03 ter (`apercu-web` accepté par `assistant_reserver` ; les cinq anciens
   passent encore, 3.01). **Il faut un compte dans `auth.users`** : sans lui, six verdicts (2.01 à 2.032 et 3.01) sont sautés, leur obtenu dit
   « aucun compte : etape sautee » et leur `ok` est nul — ils comptent comme faux, le BILAN dit `6 faux sur 11` : ce n'est PAS vert. Vert = aucune ligne
   « aucun compte : etape sautee » et 2.032 qui lit `id non nul`.
4. **Consigner** la sortie dans `proofs/RESULTATS-mitsu.md`, section « Preuve `0007_apercu_web.sql` — à jouer » déjà préparée (tableau tel quel, empreinte).
5. **Ordre, sans exception** : `0007` → redéploiement de la fonction (geste du chef d'orchestre, la commande du point 2 de l'étape 10 :
   `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api`) → les sondes sans dépense (aucune réservation) : S-A1 (forme refusée,
   `urls: 'x'` → 400 `requete`, aucune ligne au journal), S-A2 (cinq adresses interdites → 422 `interdit`, aucune ligne), S-A4 (sans jeton → 401
   `non_connecte`), et les sondes S1-S9 du lot 4, S13-S16 et S19 du lot B, S-F1 à S-F3 du lot F et le `GET` d'état rejoués (leurs listes : `RESULTATS-mitsu.md`, sections « Passerelle
   `assistant` », « Sondes `lecture-web` » et « Sondes `image-web` » ; `lecture-web` et `image-web` doivent être reprouvés sur la version 5) → les sondes payantes, un appel du quota
   chacune et zéro jeton : S-A3 (une admise et quatre interdites → 200 avec quatre `interdit` et UNE ligne `apercu-web`), S17-S18 du lot B et S-F4-S-F5
   du lot F rejouées, S-A5 (les cinq adresses des liens de la recherche « puttanesca » → cinq images ou raisons, le compte d'`image_trop_lourde`
   — il décide si la borne passe de 1 à 2 Mio —, la durée totale et la taille réelle de la réponse), S-A6 (une page de liste → `pas_de_recette`),
   S-A7 (« cinq pages hostiles de 2 Mio » servies par un hôte public contrôlé par le contrôleur → 200 ou `delai` en moins de 60 s, jamais un 502
   d'isolat tué) → fusion → `push`. Les sondes se consignent dans la section « Sondes `apercu-web` » de `RESULTATS-mitsu.md`. S-A1, S-A2, S-A3 et S-A5 à S-A7
   passent la session et la liste admise (la fonction lit la session avant le corps : sans elle, S-A1 et S-A2 rendraient 401) : la session de Neegan est lue par le script d'attente du presse-papiers (fichier d'en-tête à mode 600,
   `curl -H @fichier`, fichier vidé dès les sondes finies) — jamais le jeton dans une commande, ni dans un fichier du dépôt ; S-A4 se joue sans jeton. **Exception tranchée le 27 octobre 2026
   (R-UI2-20, spec § 12)** : Neegan ayant autorisé la fusion et le push à la fin du lot, le code de UI-2 part sur le site public AVANT `0007` ; la
   version 4 encore déployée refuse l'outil `apercu-web` en 400 `requete` avant toute réservation (aucun appel compté) et l'onglet Web dit « Photos
   indisponibles pour cette recherche. » jusqu'au redéploiement ; l'ordre `0007` → redéploiement → sondes reste ; une ronde imposée par les sondes
   (borne 2 Mio, parallélisme) part en commit de suite.

### 14. Corbeille individuelle — migration `0008`

Appliquée le 29 octobre 2026 sur « deploy avant » de Neegan, avant publication de l’application 0.23.0.
Elle ajoute `sync_capabilities`, `sync_push_v2` et neuf triggers de protection du cycle ; elle adapte
`sync_purge_all` pour conserver l’effacement volontaire du compte. Elle ne modifie ni ne supprime les données existantes.
Aucun redéploiement de la fonction `assistant` n’est nécessaire.

Pour un autre projet déjà initialisé, appliquer le fichier **une seule fois**, sous `postgres`, dans une transaction.
Le CLI authentifié permet `supabase db query --linked --project-ref <ref> --file <transaction.sql>` ;
utiliser une référence de projet explicite et vérifier les catalogues avant le geste. Ne pas rejouer les anciennes migrations.
La transaction de publication borne les attentes de verrous et notifie PostgREST de recharger son schéma.

Après application : contrôler les corps de fonctions, les neuf triggers activés, RLS et les droits
`authenticated`/`anon` ; vérifier `sync_capabilities` sous un compte autorisé. Le résultat attendu est
`{"recipe_lifecycle":1}`. L’absence de session ne doit pas ouvrir les RPC.

La preuve SQL `0008` crée des fixtures et exerce notamment `sync_purge_all` avant son rollback :
**elle reste réservée à une base de test**, conformément à son en-tête. La publication utilise des contrôles
de catalogue et de capacité en lecture seule ; les 42 assertions et la concurrence à deux sessions ont été
exécutées séparément sur PostgreSQL local. Résultats et limites dans `proofs/RESULTATS-mitsu.md`.

Conserver les protections serveur si une version de l’interface doit être retirée. Une bibliothèque DB5
ne s’ouvre pas avec l’ancien logiciel DB4 ; un retour arrière ne doit pas effacer les marqueurs de corbeille.

### 15. De `0009` à `0014` — reçus, maintenance et suppression administrative

**État du lot C : `0014` écrite pour relecture, non appliquée.** Son application est un geste de Neegan, après son postflight de `0011`–`0013`. Publier le site ou committer le fichier SQL ne l’applique pas. Aucun redéploiement de la fonction `assistant` n’est requis.

| Migration | Objet | État documenté de `mitsu` |
| --- | --- | --- |
| `0009_corbeille_livres.sql` | Cycle des éditions | Reçu historique dans `RESULTATS-mitsu.md` |
| `0010_sources_index.sql` | Sources, index, transferts privés | Reçu historique dans `RESULTATS-mitsu.md` |
| `0011_ingredients_traductions.sql` | Versions structurées et traductions | Reçu historique rapproché ; postflight de Neegan à consigner |
| `0012_cuisine_minuteurs.sql` | Cuisine et minuteries | Reçu historique rapproché ; postflight de Neegan à consigner |
| `0013_inventaire.sql` | Inventaire | Reçu historique rapproché ; postflight de Neegan à consigner |
| `0014_maintenance_et_bornes.sql` | Purge des tombales, verrous bornés, purge administrative, transferts | **Non appliquée** |

Sur une base neuve, appliquer les migrations manquantes dans cet ordre après `0001`–`0008`, une fois chacune. Sur `mitsu`, **ne pas recoller `0009`–`0013`** : vérifier d’abord ce qui est déjà installé. Les empreintes historiques et les preuves locales ne remplacent pas le catalogue distant actuel.

Avant `0014`, Neegan consigne dans `proofs/RESULTATS-mitsu.md` la date et le résultat de ces contrôles en lecture seule :

1. Sauvegarde terminée et moyen de restauration identifié ; catalogue et droits actuels conservés sans données métier ni identifiants personnels.
2. Corps installés de L6/L7/L8, `l1_guard_recipe`, `l2_guard_write`, `sync_push_v2` et `sync_capabilities` comparés au résultat d’un PostgreSQL local ayant reçu `0001`–`0013`. Les gardes L1/L2 doivent contenir les trois exceptions successives de traduction, cuisine et inventaire.
3. Fonctions attendues, `security definer`/`invoker`, propriétaire, `search_path`, droits `PUBLIC`/`anon`/`authenticated`/`service_role`, triggers activés et RLS. Une différence de privilèges par défaut de `service_role` doit être expliquée ; aucun héritage par les rôles clients ne doit être supposé.
4. Capacités `recipe_language:1`, `cooking_persistence:1`, `inventory_changes:1` et deux tables privées L5 sans accès client. Contrôler l’absence de transferts dont le propriétaire n’existe plus, sans afficher leur contenu. `0014` refuse atomiquement ces orphelins ; elle ne les efface pas silencieusement.

Les requêtes de catalogue sont exécutées dans une transaction `begin read only; … rollback;`. Ne pas jouer les preuves mutantes sur `mitsu`, même si elles se terminent par `rollback`.

Après ce postflight et la décision de Neegan : comparer le SHA256 du fichier relu avec `shasum -a 256 supabase/migrations/0014_maintenance_et_bornes.sql`, puis appliquer **ce fichier exact, une seule fois**, sous `postgres`. La transaction du fichier borne les attentes de verrous, installe les corps complets des gardes, les limites de verrous, la purge administrative et les clés étrangères privées ; elle inscrit le nettoyage des transferts à 04 h 30 dans `pg_cron`. Une erreur doit annuler l’ensemble, sans continuer instruction par instruction.

Après application, consigner les corps et ACL, les deux clés étrangères validées avec cascade, ainsi que les deux tâches `cuisine-os-tombales` et `cuisine-os-transferts`. `admin_purge_owner(uuid)` doit être refusée à `PUBLIC`, `anon` et `authenticated`, et accordée à `service_role`. Observer ensuite les exécutions réelles dans `cron.job_run_details` ; un test local de la commande ne prouve pas le fonctionnement de l’ordonnanceur distant. Recharger le schéma PostgREST selon la notification du fichier.

**Supprimer un compte, après installation de `0014` :** retirer son admission et fermer ses sessions, traiter ses objets du stockage via l’API de stockage habituelle, puis exécuter `select public.admin_purge_owner('…');` dans l’éditeur SQL sous `postgres`, **PUIS Delete user**. Remplacer le jeton uniquement dans l’éditeur, jamais dans le dépôt. La fonction purge les lignes synchronisées et les deux tables privées de transfert du seul propriétaire ciblé, même sans JWT ou si son adresse n’est plus admise. Une session portant un UID différent de la cible est refusée avant tout verrou ; ne pas emprunter le JWT d’un autre compte. Elle ne supprime ni le compte Auth lui-même, ni les objets binaires du bucket. L’opération est destructive et réservée au geste explicite de Neegan.

La preuve `proofs/0014_maintenance.sql` et `tools/prover-purge-tombales.mjs` sont exclusivement locales : elles utilisent des comptes synthétiques, mutent des fixtures et vérifient les refus exacts. Les commandes rejouables et les limites du cluster de réception sont dans le [reçu du lot C](../docs/superpowers/plans/2026-10-30-correctifs-audit-c-reception.md). Un clone sans extension `pg_cron` ne prouve que l’enregistrement des commandes et leur exécution manuelle, pas leur planification réelle.

## Où coller les sorties

Dans `supabase/proofs/RESULTATS-<projet>.md` — donc `RESULTATS-mitsu.md` (un seul projet depuis le 13 octobre, R33). Un fichier
par projet, avec la date, et pour chaque preuve le tableau tel que l'éditeur l'affiche.

**Sans adresses.** Le dépôt est public : remettre les jetons `A_EMAIL` / `B_EMAIL` / `A_UUID` / `B_UUID` à la place
des valeurs utilisées, partout, avant de coller — y compris dans les messages d'erreur recopiés. Aucune clé non
plus : la clé `anon` et l'URL du projet sont publiques par conception et vivent dans `src/sync/config.js` ; la clé
`service_role`, jamais, nulle part.

L1 n'est fini que quand les deux preuves sont vertes et consignées, et que les deux captures sont collées.

## Appareil perdu ou clé exposée

Depuis le lot « passerelle de l'assistant » (étape 10), aucun appareil ne porte plus la clé d'Anthropic : c'est un secret du projet
Supabase (`ANTHROPIC_API_KEY`) et Réglages → Assistant IA n'a plus aucun champ. Un appareil perdu ne livre donc pas la clé ; il garde en
revanche une **session**, et tant qu'elle vit, celui qui le tient peut appeler l'assistant — et lire la synchronisation — au nom du compte.
Une clé exposée ailleurs (une conversation, un appareil resté sur une ancienne version de l'app qui portait encore l'ancienne clé locale,
une sauvegarde) reste utilisable directement chez le fournisseur tant qu'on ne l'a pas révoquée. Dans cet ordre :

1. **Retirer l'adresse** de la liste, tapée à la main :
   `delete from private.allowed_users where email = lower('...');` — toute lecture, tout envoi et tout appel de l'assistant sont refusés dès la
   requête suivante (preuve `0001`, verdicts 9.01-9.03 ; la fonction `assistant` interroge la même `is_allowed()`), même avec une session encore ouverte.
2. **Fermer les sessions** : tableau de bord → **Authentication → Users** → ce compte → fermer toutes ses sessions.
3. **Révoquer l'ancienne clé** dans la console Anthropic (workspace de Cuisine OS), sans attendre : la clé exposée
   est utilisable directement chez le fournisseur. Tant que le secret du projet nomme la clé révoquée, l'assistant répond en erreur pour
   tout le monde : pour éviter la coupure, crée d'abord la nouvelle clé et pose-la comme secret (étape 10, point 6) avant de révoquer
   l'ancienne.
4. **Attendre l'expiration des jetons d'accès** (R-CPT-6) : attendre que la durée de vie d'un jeton d'accès se soit
   écoulée depuis la fermeture des sessions — réglage « JWT expiry » du projet, 3600 s par défaut, à lire dans
   Authentication → Settings (emplacement à confirmer dans le tableau de bord : non vérifié). Fermer les sessions
   révoque les jetons de rafraîchissement, mais un jeton d'accès déjà émis reste valide jusqu'à son expiration :
   l'adresse remise trop tôt, l'appareil perdu pourrait encore appeler l'assistant et la synchronisation avec ce jeton. L'adresse reste hors de la liste pendant tout ce temps.
5. **Remettre l'adresse** (`insert into private.allowed_users (email) values (lower('...'));`), reconnecter les
   appareils gardés, et entrer la nouvelle clé **une fois**, comme secret du projet Supabase (tableau de bord → **Edge Functions → Secrets**,
   `ANTHROPIC_API_KEY` ; étape 10, point 6) : **rien dans l'app**, aucun appareil ne la reçoit. Un appareil resté sur une ancienne version
   de l'app garde sa clé locale jusqu'à son prochain démarrage sur la version à jour (la passe d'effacement tourne à chaque démarrage et
   renvoie la ligne vide au compte) ; c'est la révocation de l'étape 3 qui la rend inoffensive.
