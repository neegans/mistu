# Résultats des preuves — projet `mitsu` (le seul projet, D8 révoquée le 13 octobre 2026)

Projet Supabase `mitsu`, région Canada (Central), éditeur SQL du tableau de bord, rôle `postgres`.
Collages joués par Neegan le 13 octobre 2026 ; sorties relues et consignées par l'agent le même jour.
Aucune adresse ni clé ici : les jetons `A_EMAIL`/`B_EMAIL` de la preuve étaient deux adresses du domaine
réservé `exemple.invalid`, retirées de `private.allowed_users` après coup (étape 4 bis du README).

## Chronologie

| Heure | Collage | Résultat |
| --- | --- | --- |
| 10 h 43 | `insert into private.allowed_users …` (2 adresses de preuve `exemple.invalid`) | `allowed_users_apres = 4` (2 avant) |
| 10 h 46 | `migrations/0003_assistant_config.sql` | `Success. No rows returned` |
| 10 h 46 | empreinte du `0003` collé : `shasum -a 256 supabase/migrations/0003_assistant_config.sql` | `37f9f80d62cf82457b177f35979892ce7deeaf2067567a506228e145ad8efd39` |
| 10 h 50 | preuve `0003` (« Run without RLS ») | `999 BILAN : 0 faux sur 45` |
| 10 h 55 | retrait des 2 adresses de preuve | `allowed_users_apres_retrait = 2` (le nombre d'avant l'étape 1) |
| — | `notify pgrst, 'reload schema';` (seulement si une lecture a rendu 404) | non nécessaire à ce stade (rien de servi encore) |

## Piège du tableau de bord (à connaître avant de jouer une preuve)

Le tableau de bord détecte un `create table` sans `enable row level security` et ouvre un dialogue « Potential
issue detected » avec deux boutons. **« Run and enable RLS » ajoute lui-même `alter table preuve enable row level
security` à la fin du script**, donc *après* le `rollback;` qui a déjà fait disparaître la table temporaire :
l'ajout échoue (`42P01`) et l'éditeur n'affiche que cette erreur, alors que la preuve avait tourné et s'était
annulée normalement (vérifié : `auth.users` à 0, `public.books` à 0, liste intacte). **Choisir « Run without
RLS »** : la table des verdicts est temporaire et meurt avec la transaction, RLS n'y a aucun sens.

## Preuve `0001_tables_et_regles.sql` — 76 verdicts, 0 faux

| ordre | etape | attendu | obtenu | ok |
| ----- | ----- | ------- | ------ | -- |
| 0.01 | usage sur le schema temporaire pour authenticated | accorde ou implicite | accorde explicitement | true |
| 1.01 | authenticated : select sur public.books | true | true | true |
| 1.02 | authenticated : insert sur public.books | true | true | true |
| 1.03 | authenticated : update sur public.books | true | true | true |
| 1.04 | authenticated : select sur public.files | true | true | true |
| 1.05 | authenticated : usage sur la sequence public.sync_seq | true | true | true |
| 1.06 | authenticated : usage sur le schema public | true | true | true |
| 1.07 | authenticated : execute sur public.is_allowed() (appelee par les 100 regles) | true | true | true |
| 2.01 | declencheur B1 : deux adresses listees passent | 2 | 2 | true |
| 2.02 | declencheur B1 : adresse hors liste refusee | P0001 adresse non autorisee | P0001 adresse non autorisée | true |
| 2.03 | crochet before_user_created : adresse listee | {} | {} | true |
| 2.04 | crochet before_user_created : adresse inconnue | 403 | 403 | true |
| 2.05 | crochet before_user_created : courriel absent | 403 | 403 | true |
| 3.01 | A pousse un livre et une ligne de fichier | accepted 2, rejected 0 | accepted 2, adjusted 0, rejected 0 | true |
| 3.02 | A relit son livre | 1 | 1 | true |
| 3.03 | A relit sa ligne de fichier | 1 | 1 | true |
| 3.04 | R13 : server_seq pose sur la ligne inseree (preuve franche en 6.07) | non nul | 31 | true |
| 3.05 | B ne voit rien de A | 0 | 0 | true |
| 3.06 | B pousse le meme id et la meme empreinte | accepted 2, rejected 0 | accepted 2, rejected 0 | true |
| 3.07 | B ne voit que SA ligne, avec SON contenu | 1 / Livre B | 1 / Livre B | true |
| 3.08 | B ne peut pas ecrire chez A | 42501 (refus de la regle) | 42501 new row violates row-level security policy for table "books" | true |
| 3.09 | owner_id nul refuse | 23502 (not null) ou 42501 | 42501 new row violates row-level security policy for table "books" | true |
| 3.10 | meme id chez deux proprietaires (vu de postgres, proprietaire des tables : hors RLS) | 2 lignes, 2 proprietaires | 2 lignes, 2 proprietaires | true |
| 3.11 | meme empreinte chez deux proprietaires (vu de postgres : hors RLS) | 2 lignes, 2 proprietaires | 2 lignes, 2 proprietaires | true |
| 3.12 | aucune ligne piratee | 0 | 0 | true |
| 4.01 | delete direct : aucune ligne supprimee | 1 | 1 | true |
| 4.02 | sync_purge rend 1 | 1 | 1 | true |
| 4.03 | ligne disparue apres sync_purge | 0 | 0 | true |
| 4.04 | sync_purge_all retire ce qui reste a A (la ligne de fichier) | 1 | 1 | true |
| 4.05 | A ne garde aucune ligne | 0 | 0 | true |
| 4.06 | app.purge reste pose apres sync_purge dans la meme transaction (attendu, sans effet via PostgREST) | on | on | true |
| 5.01 | store inconnu : appel entier refuse | P0001 store inconnu | P0001 store inconnu | true |
| 5.02 | R10 : lelement valide du meme appel nest pas ecrit | 0 | 0 | true |
| 5.03 | motifs : m1 updated_at, m2 cle, m3 forme, m4 adjusted, m5 accepted | 3 rejets, 1 ajuste, 1 accepte | accepted m5 ; adjusted m4 (updated_at ramené à l'heure serveur) ; rejected m1 updated_at, m2 cle, m3 forme | true |
| 5.04 | m4 ajuste : updated_at ramene a lheure serveur | moins de 5 minutes dans le futur | 2026-10-13 15:25:23+00 | true |
| 5.05 | m5 tombale sur ligne inconnue : data vide, deleted_at pose | {} et une date | {} / 2026-10-13 15:25:23+00 | true |
| 5.06 | corrections T3 : tombale sans id (cle), deleted non booleen (forme), files size non numerique (forme), files avec blob (forme), n5 accepte | 4 rejets, 1 accepte | accepted n5 ; rejected (id null) cle, n2 forme, files …03 forme, files …04 forme | true |
| 5.07 | n5 ecrit, aucun des quatre rejets ecrit | 1 livre n5, 0 ligne de fichier | 1 / 0 | true |
| 5.08 | element de plus de 512 Ko : rejected taille, sans que lappel leve | 1 rejet taille, 0 accepte | rejected t1 taille | true |
| 5.09 | lelement de plus de 512 Ko nest pas ecrit | 0 | 0 | true |
| 5.10 | charge de plus de 1 Mo : appel refuse | P0001 rows : 1 Mo au plus | P0001 rows : 1 Mo au plus | true |
| 5.11 | 501 elements : appel refuse | P0001 rows : 500 elements au plus | P0001 rows : 500 éléments au plus | true |
| 6.01 | premier push de i1 | accepted 1 | accepted i1 | true |
| 6.02 | server_seq apres le premier push | valeur de reference | 51 | true |
| 6.03 | push identique : accepte, rien ecrit | accepted 1 | accepted i1 | true |
| 6.04 | server_seq inchange apres le push identique | 51 | 51 | true |
| 6.05 | plus ancien : rejected conflit, avec la ligne du serveur | conflit + server | rejected i1 conflit, server = {data {t 1, id i1}, deleted_at null, updated_at 2026-10-12T10:00:00+00:00} | true |
| 6.06 | plus recent : accepte | accepted 1 | accepted i1 | true |
| 6.07 | R13 : server_seq augmente alors que lupdate ne le nomme pas | plus grand que 51 | 52 | true |
| 6.08 | sous app.maintenance : server_seq inchange malgre une vraie ecriture | 52 | 52 | true |
| 6.09 | ecriture sous maintenance bien effectuee (sinon 6.08 ne prouve rien) | true | true | true |
| 6.10 | R25 : plus grand server_seq distribue, releve avant lupdate pirate | valeur de reference | 52 | true |
| 6.11 | R25 : lupdate pose server_seq = 1 et la valeur est remplacee par une valeur neuve, strictement superieure | plus grand que 52 | 53 | true |
| 6.12 | S2 : deleted_at avant lupdate direct | valeur de reference | null | true |
| 6.13 | S2 : update direct set deleted_at = now() -> deleted_at inchange | null | null | true |
| 6.14 | S2 : via set_config(app.sync_push, on, true) dans la meme transaction -> deleted_at change | non null, different de 6.12 | 2026-10-13 15:25:23+00 | true |
| 7.01 | files : la contrainte check refuse un blob | 23514 (check_violation) | 23514 new row for relation "files" violates check constraint "files_data_check" | true |
| 8.01 | anon : aucun privilege sur les 25 tables de public | 25 tables, aucun privilege | 25 tables | true |
| 8.02 | anon : execute sur public.sync_push(jsonb) | false | false | true |
| 8.03 | anon : execute sur public.sync_purge(text, text) | false | false | true |
| 8.04 | anon : execute sur public.sync_purge_all() | false | false | true |
| 8.05 | anon : execute sur public.is_allowed() | false | false | true |
| 8.06 | authenticated : select sur private.allowed_users (hors API) | false | false | true |
| 8.07 | authenticated : usage sur le schema private (hors API) | false | false | true |
| 8.08 | authenticated : execute sur public.before_user_created(jsonb) | false | false | true |
| 8.09 | authenticated : execute sur public.touch_server_seq() (et pourtant le declencheur tourne, 6.07) | false | false | true |
| 8.10 | authenticated : execute sur public.enforce_allowed_user() | false | false | true |
| 8.11 | authenticated : execute sur public.purge_tombstones() | false | false | true |
| 8.12 | supabase_auth_admin : execute sur public.before_user_created(jsonb) | true | true | true |
| 8.13 | supabase_auth_admin : usage sur le schema public | true | true | true |
| 8.14 | authenticated : execute sur public.sync_push(jsonb) | true | true | true |
| 8.15 | authenticated : execute sur public.sync_purge(text, text) | true | true | true |
| 8.16 | authenticated : execute sur public.sync_purge_all() | true | true | true |
| 9.01 | B retire de private.allowed_users | 1 | 1 | true |
| 9.02 | B ne voit plus rien (il voyait sa ligne en 3.07) | 0 | 0 | true |
| 9.03 | sync_push leve pour une personne retiree, au lieu de rendre des rejets forme | P0001 adresse non autorisee | P0001 adresse non autorisée | true |
| 999 | BILAN | aucun verdict faux | 0 faux sur 76 | true |

Les colonnes `obtenu` des verdicts 5.03, 5.06, 5.08, 6.01, 6.03, 6.05 et 6.06 sont résumées ici (le JSON complet
renvoyé par `sync_push` a été lu en entier ; `server_time` omis).

## Preuve `0002_stockage.sql` — 11 verdicts, 0 faux (11 h 29)

`0002_stockage.sql` collé à 11 h 28 : `Success. No rows returned` (les quatre `create policy … on storage.objects`
sont passées sous `postgres`, pas de repli par Storage → Policies). Preuve jouée avec « Run without RLS ».

| ordre | etape | attendu | obtenu | ok |
| ----- | ----- | ------- | ------ | -- |
| 1.01 | seau pages : prive, 50 Mo, six types | false / 52428800 / 6 | false / 52428800 / 6 | true |
| 1.02 | liste blanche des types, dans lordre de src/sync/mime.js | informatif | image/jpeg, image/png, image/webp, image/heic, application/pdf, application/epub+zip | true |
| 1.03 | un seul seau nomme pages | 1 | 1 | true |
| 2.01 | les quatre regles pages_* existent | 4 | 4 : pages_delete, pages_insert, pages_select, pages_update | true |
| 2.02 | les quatre commandes sont couvertes, pour authenticated seulement | DELETE, INSERT, SELECT, UPDATE / authenticated | DELETE, INSERT, SELECT, UPDATE / {authenticated} | true |
| 2.03 | chaque regle pages_* porte is_allowed ET le dossier du proprietaire | true | true | true |
| 2.04 | RLS active sur storage.objects (sinon les regles ne servent a rien) | true | true | true |
| 2.05 | aucune autre regle que les quatre sur storage.objects (informatif : Supabase en pose parfois) | informatif | aucune | true |
| 3.01 | la vue private.storage_usage existe | 1 | 1 | true |
| 3.02 | la vue nest exposee ni a authenticated ni a anon (R15) | false / false | false / false | true |
| 3.03 | etat du seau (informatif : vide avant L4) | aucune ligne tant quaucune page nest televersee | aucune ligne | true |
| 999 | BILAN | aucun verdict faux | 0 faux sur 11 | true |

## Crochet « Before User Created » et fournisseurs

Remplis le 13 octobre : `0001_hook.md` (crochet ENABLED, 15 h 13) et `0001_providers.md` (Google seul, Email éteint,
contre-preuve par l'API publique à 15 h 14).

## Première connexion réelle — 13 octobre 2026, 15 h 33 (Mac, Chrome, `https://neegans.github.io/mistu/`)

Après le commit `5fde3ed` (config `mitsu`, SW `v0.2.0-5`) et l'URL Configuration (Site URL Pages, trois Redirect
URLs) : Réglages → « Activer la synchronisation » → écran Google (application en statut Testing, compte en Test user)
→ retour dans Réglages. Texte de la section, copié par Neegan : **« Connectée : <une des deux adresses autorisées> »,
« À envoyer : 0 », bouton « Se déconnecter »**. Ce que ça prouve d'un coup : B0 (écran de consentement Testing laisse
passer le Test user), B1 (le crochet a laissé naître le compte, l'adresse étant dans `private.allowed_users`), la
garde de compte côté app (`is_allowed()` vrai pour ce jeton), le retour OAuth PKCE sans `code` résiduel, et la liste
blanche d'hôtes (`neegans.github.io` → entrée `prod`). « À envoyer : 0 » : bibliothèque neuve sur cette origine
(64 ingrédients, 27 unités, 5 conventions = amorçage, hors capture). **Pas encore mesuré** : le retour OAuth depuis
la PWA installée sur iPhone (spec § 4.1) — à faire par Neegan sur l'appareil.

## Preuve `0003_assistant_config.sql` — 45 verdicts, 0 faux (18 octobre 2026, 10 h 50, geste de Neegan)

Section préparée le 18 octobre 2026 (lot « la configuration de l'assistant suit le compte », spec
`docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` § 6.3 ; procédure : étape 8 bis du README).
**Jouée le 18 octobre 2026 vers 10 h 50 (heure de Montréal) par Neegan, avant toute fusion et tout `push` du code.** Jetons remis ci-dessous ; aucune valeur de `data` (seulement des longueurs de clé).

Le dépôt est public : jetons `A_EMAIL` / `B_EMAIL` / `A_UUID` / `B_UUID` remis partout, et **aucune valeur de la
colonne `data`** — la preuve n'affiche que des compteurs, des motifs et des longueurs de clé. Si une cellule montre
une clé (`sk-…`) ou un objet `data`, ne pas la coller ici : le signaler.

**Clé de lecture des lignes `7.01` à `7.05`, à juger AVANT le `push`** (même clé que l'étape 8 bis du README ; d'après
la documentation de PostgreSQL, non mesurée sur `mitsu`). La clé de l'assistant peut finir dans les journaux de
Postgres si :
- `log_statement` (7.03) vaut `all` ou `log_min_duration_statement` (7.04) n'est pas `-1` — **et, dans les deux cas,**
  `log_parameter_max_length` (7.05) n'est pas `0` : un envoi **réussi** de `sync_push` peut être journalisé avec ses
  paramètres ;
- `log_min_error_statement` (7.01) vaut `error` ou un niveau plus bas — **et** `log_parameter_max_length_on_error`
  (7.02) n'est pas `0` : un envoi **en erreur** (adresse retirée, `store inconnu`) peut être journalisé avec ses
  paramètres.

Si l'une de ces conditions est remplie : l'écrire ici et le dire avant le `push`. On recopie les valeurs des réglages,
jamais une valeur de `data`.

| Heure | Collage | Résultat |
| --- | --- | --- |
| … | `insert into private.allowed_users …` (2 adresses de preuve `exemple.invalid`) | … |
| … | `migrations/0003_assistant_config.sql` | … |
| … | empreinte du `0003` collé : `shasum -a 256 supabase/migrations/0003_assistant_config.sql` | … |
| … | preuve `0003` (« Run without RLS ») | `999 BILAN : … faux sur …` |
| … | retrait des 2 adresses de preuve | … |
| … | `notify pgrst, 'reload schema';` (seulement si une lecture a rendu 404) | … |

Tableau des verdicts (ordre, etape, attendu, obtenu, ok), tel que rendu par l'éditeur SQL :

| ordre | etape | attendu | obtenu | ok |
| --- | --- | --- | --- | --- |
| 0.01 | usage sur le schema temporaire pour authenticated | accorde ou implicite | accorde explicitement | true |
| 0.02 | deux comptes de preuve crees (annules au rollback) | 2 | 2 | true |
| 1.01 | public.assistant_config presente, RLS activee | true | true | true |
| 1.02 | quatre regles : une par commande, pour authenticated, is_allowed et owner_id partout, delete sous app.purge | 4 : DELETE, INSERT, SELECT, UPDATE / {authenticated} / delete sous app.purge | 4 : DELETE, INSERT, SELECT, UPDATE / {authenticated} / delete sous app.purge | true |
| 1.03 | declencheur assistant_config_seq -> public.touch_server_seq(), actif | 1 | 1 | true |
| 1.04 | index assistant_config_recv (owner_id, server_seq) | 1 | 1 | true |
| 1.05 | cle primaire composee (owner_id, id) : elle isole les comptes (S8) | 1 | 1 | true |
| 1.06 | owner_id references auth.users on delete cascade | 1 | 1 | true |
| 2.01 | authenticated : select, insert, update sur public.assistant_config | true / true / true | true / true / true | true |
| 2.02 | anon : aucun privilege sur les 26 tables de public | 26 tables, 0 avec un privilege anon | 26 tables, 0 avec un privilege anon | true |
| 2.03 | anon : execute sur public.sync_push(jsonb) | false | false | true |
| 2.04 | anon : execute sur public.sync_purge(text, text) | false | false | true |
| 2.05 | anon : execute sur public.sync_purge_all() | false | false | true |
| 2.06 | anon : execute sur public.purge_tombstones() | false | false | true |
| 2.07 | authenticated : execute sur public.sync_push(jsonb) | true | true | true |
| 2.08 | authenticated : execute sur public.sync_purge(text, text) | true | true | true |
| 2.09 | authenticated : execute sur public.sync_purge_all() | true | true | true |
| 2.10 | authenticated : execute sur public.purge_tombstones() | false | false | true |
| 2.11 | les 26 tables synchronisees de public ont toutes la RLS activee | 26 | 26 | true |
| 3.01 | A pousse sa configuration llm (cle factice) | accepted 1, adjusted 0, rejected 0 | accepted 1, adjusted 0, rejected 0 | true |
| 3.02 | A relit sa ligne par owner_id : une ligne, cle de 17 caracteres (jamais la valeur) | 1 ligne, cle de 17 | 1 ligne, cle de 17 | true |
| 3.03 | le reste de la fiche est celui qui a ete pousse (compare sans etre affiche) | conforme | conforme | true |
| 3.04 | A pousse llm PLUS ANCIEN avec une autre cle factice : rejete, motif conflit | rejected 1, motif conflit, accepted 0 | rejected 1, motif conflit, accepted 0 | true |
| 3.05 | apres le conflit, la cle est toujours celle de 3.01 | cle de 17 | cle de 17 | true |
| 3.06 | A pousse llm PLUS RECENT (cle tournee, factice) : accepte | accepted 1, rejected 0 | accepted 1, rejected 0 | true |
| 3.07 | la cle a change : longueur 25 au lieu de 17, toujours une seule ligne | 1 ligne, cle de 25 | 1 ligne, cle de 25 | true |
| 4.01 | B ne voit rien de A | 0 | 0 | true |
| 4.02 | B pousse son propre llm (plus ancien que celui de A) : accepte | accepted 1, rejected 0 | accepted 1, rejected 0 | true |
| 4.03 | B ne voit que SA ligne : une ligne, cle de 12 | 1 ligne, cle de 12 | 1 ligne, cle de 12 | true |
| 4.04 | B ne peut pas ecrire chez A | 42501 (refus de la regle) | 42501 new row violates row-level security policy for table "assistant_config" | true |
| 4.05 | B ne peut pas modifier la ligne de A : aucune ligne touchee | 0 | 0 | true |
| 4.06 | meme id llm chez les deux comptes de preuve (vu de postgres : hors RLS) | 2 lignes, 2 proprietaires | 2 lignes, 2 proprietaires | true |
| 4.07 | aucune ligne piratee chez les deux comptes de preuve | 0 | 0 | true |
| 5.01 | delete direct de A, sans app.purge : aucune ligne supprimee, sans erreur | 0 | 0 | true |
| 5.02 | A garde sa ligne apres le delete | 1 | 1 | true |
| 6.01 | public.sync_push(jsonb) : 26 magasins, la liste finit par files, assistant_config | 26 / true | 26 / true | true |
| 6.02 | public.sync_purge(text, text) : 26 magasins, la liste finit par files, assistant_config | 26 / true | 26 / true | true |
| 6.03 | public.sync_purge_all() : 26 magasins, la liste finit par files, assistant_config | 26 / true | 26 / true | true |
| 6.04 | public.purge_tombstones() : 26 magasins, la liste finit par files, assistant_config | 26 / true | 26 / true | true |
| 6.05 | sync_push : keys et required connaissent assistant_config | true / true | true / true | true |
| 7.01 | log_min_error_statement (informatif) | valeur relevee | error | true |
| 7.02 | log_parameter_max_length_on_error (informatif) | valeur relevee | 0 | true |
| 7.03 | log_statement (informatif) | valeur relevee | ddl | true |
| 7.04 | log_min_duration_statement (informatif) | valeur relevee | -1 | true |
| 7.05 | log_parameter_max_length (informatif) | valeur relevee | -1 | true |
| 999 | BILAN | aucun verdict faux | 0 faux sur 45 | true |

**Jugement des lignes `7.01` à `7.05` (journaux de Postgres), fait avant le `push`** : `log_statement = ddl` et
`log_min_duration_statement = -1` → un envoi **réussi** de `sync_push` n'est pas journalisé avec ses paramètres (la
valeur de `log_parameter_max_length`, `-1`, est sans effet) ; `log_min_error_statement = error` **mais**
`log_parameter_max_length_on_error = 0` → un envoi **en erreur** n'est pas journalisé avec ses paramètres. **Aucune
des deux conditions n'est remplie : la clé de l'assistant ne peut pas finir dans les journaux de Postgres de `mitsu`**
avec ces réglages (à rejuger si Supabase les change).

## Passerelle `assistant` — déployée le 18 octobre 2026 (17 h 05 UTC), sondes sans dépense 9/9 conformes

Code : `supabase/functions/assistant/` (spec `docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md`). La clé Anthropic est un secret du projet (`ANTHROPIC_API_KEY`, posé par Neegan dans Edge Functions → Secrets le 18 octobre, 15 h 13 UTC) : rien d'elle n'est ici, ni ailleurs dans le dépôt.

**Déploiement (contrôleur, 18 octobre 2026, 17 h 05 UTC = 13 h 05 à Montréal)** : `~/.local/bin/supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api` depuis le worktree, code = commit `1590ba8` (index.ts, logique.js, deno.json téléversés ; bundle côté serveur, sans Docker). `supabase functions list` : slug `assistant`, **version 1**, `status ACTIVE`, **`verify_jwt: false`**, `import_map: true` (deno.json), `ezbr_sha256 b5905318…`. Aucun `config.toml` dans le dépôt.

**Sondes sans dépense (curl, 17 h 05-17 h 06 UTC ; aucune n'atteint Anthropic : toutes s'arrêtent à une garde avant la réservation)** :

| Sonde | Requête | Statut | Corps | Notes |
|---|---|---|---|---|
| S1 | `OPTIONS`, `Origin: https://neegans.github.io` | 204 | — | `access-control-allow-origin: https://neegans.github.io`, `allow-headers: authorization, apikey, content-type, x-client-info`, `allow-methods: POST, OPTIONS`, `max-age: 600`, `vary: Origin` ; 269 ms (démarrage à froid) |
| S2 | `OPTIONS`, `Origin: https://evil.example` | 204 | — | **sans** `access-control-allow-origin` ; 17 ms |
| S3 | `POST` sans `Authorization`, origine admise | 401 | `{"erreur":"non_connecte"}` | CORS présent, `cache-control: no-store` |
| S4 | `POST`, `Origin: https://evil.example` | 403 | `{"erreur":"origine"}` | sans Allow-Origin |
| S5 | `POST`, `Authorization: Bearer bidon.bidon.bidon` + `apikey` publique | 401 | `{"erreur":"non_connecte"}` | `getUser` a refusé ; donc `createClient` a bien reçu une clé publique valide (`SUPABASE_PUBLISHABLE_KEYS` lu) ; 104 ms |
| S6 | `GET`, jeton bidon | 401 | `{"erreur":"non_connecte"}` | |
| S7 | `PUT`, origine admise | 405 | `{"erreur":"methode"}` | |
| S8 | `POST` sans en-tête `Origin` | 403 | `{"erreur":"origine"}` | un appelant hors navigateur sans Origin est refusé |
| S9 | `POST`, clé publique `sb_publishable_…` en Bearer | 401 | `{"erreur":"non_connecte"}` | la clé publique seule ne vaut pas une session |
| S10 | `POST`, `content-length: 9000000` mensonger (2 octets envoyés) | 400 | page HTML Cloudflare | refusé par la bordure Cloudflare avant la fonction : ne mesure pas notre borne (couverte par le test Node, cas f) |

**Non mesuré ici (exige une session réelle = geste de Neegan)** : `GET` → `{ modele, quotaJour }` ; un `POST` admis → une ligne `assistant_journal` et un appel Anthropic ; le comportement de `is_allowed` pour une session non admise ; la prise en compte d'un secret changé par un isolat chaud. **Préalable au premier POST réel** : `0004` collée + `notify pgrst, 'reload schema';` (sinon `assistant_reserver` inconnue → 502).

**Preuve `0004_assistant_journal.sql` — à jouer (geste de Neegan, après le collage de `0004` et `notify pgrst, 'reload schema';`)** : le BILAN et les verdicts seront collés ici.
