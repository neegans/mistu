# Supabase — comment appliquer et prouver le serveur de synchronisation

Ce dossier contient **tout le serveur** de Cuisine OS : deux migrations générées (`migrations/`) et les preuves à
jouer après les avoir appliquées (`proofs/`). Rien n'est appliqué automatiquement : chaque étape est un geste de
Neegan dans l'éditeur SQL du tableau de bord Supabase. Spec de référence :
`docs/spec-compte-et-stockage-distant.md` (§ 3 pour le serveur, § 7.2 pour les preuves).

```
supabase/
  migrations/0001_tables_et_regles.sql   généré par tools/generer-migrations.mjs — ne pas éditer à la main
  migrations/0002_stockage.sql           idem
  proofs/0001_tables_et_regles.sql       à coller après 0001 ; jetons à remplacer ; n'écrit rien (rollback final)
  proofs/0002_stockage.sql               à coller après 0002 ; lecture seule
  proofs/0001_hook.md                    gabarit : capture du crochet « Before User Created »
  proofs/0001_providers.md               gabarit : capture des fournisseurs de connexion
  proofs/RESULTATS-<projet>.md           tes sorties, collées (à créer : un fichier par projet)
```

## Deux projets, dans cet ordre

1. **`mistu-dev`** — le projet de développement (D8). **Tout se joue ici d'abord** : c'est là que les preuves du
   § 7.2 doivent être vertes. `http://localhost:8081` reste autorisé sur ce projet seulement.
2. **`mistu`** — le projet réel, **après** la revue adverse de L1 et seulement si les preuves de `mistu-dev` sont
   vertes. `localhost` y est retiré.

La procédure ci-dessous est la même pour les deux. Sur `mistu`, elle est à refaire en entier (étapes 1 à 9) : les
migrations sont des objets de base de données, elles ne « voyagent » pas d'un projet à l'autre.

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

### 9. Fermer les autres portes, et le prouver

Tableau de bord → **Authentication → Providers** : **Google** activé, et lui seul — **Email** désactivé (ni mot de
passe, ni *magic link*), **Phone** désactivé, **Anonymous** désactivé, *Confirm email* activé, liaison automatique
d'identités désactivée. Puis remplir `proofs/0001_providers.md` (capture + date + projet).

## Où coller les sorties

Dans `supabase/proofs/RESULTATS-<projet>.md` — donc `RESULTATS-mistu-dev.md`, puis `RESULTATS-mistu.md`. Un fichier
par projet, avec la date, et pour chaque preuve le tableau tel que l'éditeur l'affiche.

**Sans adresses.** Le dépôt est public : remettre les jetons `A_EMAIL` / `B_EMAIL` / `A_UUID` / `B_UUID` à la place
des valeurs utilisées, partout, avant de coller — y compris dans les messages d'erreur recopiés. Aucune clé non
plus : la clé `anon` et l'URL du projet sont publiques par conception et vivent dans `src/sync/config.js` ; la clé
`service_role`, jamais, nulle part.

L1 n'est fini que quand les deux preuves sont vertes et consignées, et que les deux captures sont collées.
