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

## Passerelle `assistant` — déployée le 18 octobre 2026 (v1 17 h 05, v2 18 h 16, v3 19 h 19 UTC), sondes sans dépense 9/9 conformes aux trois versions

Code : `supabase/functions/assistant/` (spec `docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md`). La clé Anthropic est un secret du projet (`ANTHROPIC_API_KEY`, posé par Neegan dans Edge Functions → Secrets le 18 octobre, 15 h 13 UTC) : rien d'elle n'est ici, ni ailleurs dans le dépôt.

**Déploiement (contrôleur, 18 octobre 2026, 17 h 05 UTC = 13 h 05 à Montréal)** : `~/.local/bin/supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api` depuis le worktree, code = commit `1590ba8` (index.ts, logique.js, deno.json téléversés ; bundle côté serveur, sans Docker). `supabase functions list` : slug `assistant`, **version 1**, `status ACTIVE`, **`verify_jwt: false`**, `import_map: true` (deno.json), `ezbr_sha256 b5905318…`. Aucun `config.toml` dans le dépôt.

**Sondes sans dépense (curl, 17 h 05-17 h 06 UTC ; aucune n'atteint Anthropic : toutes s'arrêtent à une garde avant la réservation)** :

| Sonde | Requête | Statut | Corps | Notes |
|---|---|---|---|---|
| S1 | `OPTIONS`, `Origin: https://neegans.github.io` | 204 | — | `access-control-allow-origin: https://neegans.github.io`, `allow-headers: authorization, apikey, content-type, x-client-info`, `allow-methods: POST, OPTIONS`, `max-age: 600`, `vary: Origin` ; 269 ms (démarrage à froid) |
| S2 | `OPTIONS`, `Origin: https://evil.example` | 204 | — | **sans** `access-control-allow-origin` ; 17 ms |
| S3 | `POST` sans `Authorization`, origine admise | 401 | `{"erreur":"non_connecte"}` | CORS présent, `cache-control: no-store` |
| S4 | `POST`, `Origin: https://evil.example` | 403 | `{"erreur":"origine"}` | sans Allow-Origin |
| S5 | `POST`, `Authorization: Bearer bidon.bidon.bidon` + `apikey` publique | 401 | `{"erreur":"non_connecte"}` | `getUser` a refusé ; donc `createClient` a reçu une clé publique valide — nouvelle ou legacy, cette sonde ne les distingue pas ; le GET avec une session réelle le dira (`cles`) ; 104 ms |
| S6 | `GET`, jeton bidon | 401 | `{"erreur":"non_connecte"}` | |
| S7 | `PUT`, origine admise | 405 | `{"erreur":"methode"}` | |
| S8 | `POST` sans en-tête `Origin` | 403 | `{"erreur":"origine"}` | un appelant hors navigateur sans Origin est refusé |
| S9 | `POST`, clé publique `sb_publishable_…` en Bearer | 401 | `{"erreur":"non_connecte"}` | la clé publique seule ne vaut pas une session |
| S10 | `POST`, `content-length: 9000000` mensonger (2 octets envoyés) | 400 | page HTML Cloudflare | refusé par la bordure Cloudflare avant la fonction : ne mesure pas notre borne (couverte par le test Node, cas f) |

**Non mesuré ici (exige une session réelle = geste de Neegan)** : `GET` → `{ modele, quotaJour, cles }` (depuis la version 3 ; `cles` dit quelle voie de clés Supabase a servi) ; un `POST` admis → une ligne `assistant_journal` et un appel Anthropic ; le comportement de `is_allowed` pour une session non admise ; la prise en compte d'un secret changé par un isolat chaud. **Préalable au premier POST réel** : `0004` collée + `notify pgrst, 'reload schema';` (sinon `assistant_reserver` inconnue → 502).

**Redéploiement (contrôleur, 18 octobre 2026, 18 h 16 UTC = 14 h 16 à Montréal)** : même commande, code = commit `6d7ed21` (après les restes parqués de la revue : annulation du corps quand `content-length` dépasse la borne, plafond int4 du quota, `jourDe` fermé, défaut `max_tokens` borné). `supabase functions list` : **version 2**, `ACTIVE`, `verify_jwt: false`, `import_map: true`, `ezbr_sha256 245fcab5…`. Les neuf sondes S1-S9 rejouées à 18 h 16 UTC : **mêmes statuts, mêmes corps, mêmes en-têtes CORS** (S1 204 + Allow-Origin, 626 ms à froid ; S2 204 sans Allow-Origin ; S3 401 `non_connecte` ; S4 403 `origine` ; S5 401 `non_connecte` 363 ms ; S6 401 ; S7 405 `methode` ; S8 403 `origine` ; S9 401 `non_connecte`). Aucune n'a atteint Anthropic ni la réservation (0004 n'est pas collée : un POST admis rendrait 502 `serveur` tant que `assistant_reserver` n'existe pas).

**Troisième déploiement (contrôleur, 18 octobre 2026, 19 h 19 UTC = 15 h 19 à Montréal), après la revue finale de branche** : même commande, code = commit `2a2f838` (vague finale : lecteur tolérant des clés Supabase injectées + repère non secret `cles` dans le GET, abandon du client propagé à l'appel amont et journalisé 499, pages photographiées réduites avant l'envoi côté app, délais client 135 s). `supabase functions list` : **version 3**, `ACTIVE`, `verify_jwt: false`, `import_map: true`, `ezbr_sha256 95034efd…`. Les neuf sondes S1-S9 rejouées à 19 h 19 UTC : **identiques aux versions 1 et 2** (S1 204 + Allow-Origin, 732 ms à froid ; S2 204 sans Allow-Origin ; S3 401 `non_connecte` ; S4 403 `origine` ; S5 401 `non_connecte` ; S6 401 ; S7 405 `methode` ; S8 403 `origine` ; S9 401 `non_connecte`). Non mesuré, exige une session réelle : le `GET` → `{ modele, quotaJour, cles }` (quelle voie de clés a servi), un `POST` admis, le 499 sur une requête coupée en vol.

**Preuve `0004_assistant_journal.sql` — JOUÉE par Neegan le 18 octobre 2026 (vers 20 h 40 UTC = 16 h 40 à Montréal), après le collage de `0004` entière (« Run without RLS », `Success. No rows returned`)** : `999 BILAN` = **0 faux sur 20**. Tableau tel quel (aucune valeur de `data`, aucun identifiant réel : la preuve pose ses propres lignes puis `rollback;`) :

| ordre | etape                                                                                              | attendu                          | obtenu                                                  | ok   |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------- | ---- |
| 0.01  | usage sur le schema temporaire pour authenticated                                                  | accorde ou implicite             | accorde explicitement                                   | true |
| 1.01  | public.assistant_journal presente, RLS activee                                                     | true                             | true                                                    | true |
| 1.02  | aucune regle (policy) sur assistant_journal                                                        | 0                                | 0                                                       | true |
| 1.03  | anon et authenticated : aucun privilege sur la table                                               | false / false                    | false / false                                           | true |
| 1.04  | index assistant_journal_owner_jour (owner_id, jour)                                                | 1                                | 1                                                       | true |
| 1.05  | vue assistant_usage_jour presente, en security invoker                                             | true                             | true                                                    | true |
| 1.06  | anon et authenticated : aucun privilege sur la vue                                                 | false / false                    | false / false                                           | true |
| 1.07  | anon et authenticated : aucun privilege sur la sequence de id                                      | false / false                    | false / false                                           | true |
| 1.08  | owner_id references auth.users on delete cascade                                                   | 1                                | 1                                                       | true |
| 1.09  | service_role : select, insert, update sur la table, select sur la vue, usage sur la sequence de id | true / true / true / true / true | true / true / true / true / true                        | true |
| 1.10  | assistant_reserver : security invoker, volatile, search_path fixe                                  | false / v / true                 | false / v / true                                        | true |
| 1.11  | assistant_reserver : execute refuse a anon et authenticated, accorde a service_role                | false / false / true             | false / false / true                                    | true |
| 2.01  | authenticated : select count(*) sur assistant_journal est refuse                                   | 42501 (permission denied)        | 42501 permission denied for table assistant_journal     | true |
| 2.02  | authenticated : insert dans assistant_journal est refuse                                           | 42501 (permission denied)        | 42501 permission denied for table assistant_journal     | true |
| 2.03  | authenticated : select sur assistant_usage_jour est refuse                                         | 42501 (permission denied)        | 42501 permission denied for view assistant_usage_jour   | true |
| 2.04  | authenticated : l appel de assistant_reserver est refuse                                           | 42501 (permission denied)        | 42501 permission denied for function assistant_reserver | true |
| 3.01  | sous postgres : une ligne de journal, puis assistant_usage_jour la compte                          | appels = 1                       | appels = 1                                              | true |
| 3.02  | la vue additionne les jetons de la ligne                                                           | jetons 10 / 20                   | jetons 10 / 20                                          | true |
| 3.03  | un outil hors liste est refuse par le check                                                        | 23514                            | 23514                                                   | true |
| 3.04  | assistant_reserver : un id tant que le quota n est pas atteint, puis null                          | id non nul, puis null            | id non nul, puis null                                   | true |
| 999   | BILAN                                                                                              | aucun verdict faux               | 0 faux sur 20                                           | true |

**Sondes du contrôleur juste après (20 h 46-20 h 47 UTC, clé publique `sb_publishable_…` seule, `POST /rest/v1/rpc/assistant_reserver`, aucune dépense, aucune ligne écrite)** :

| Sonde | Requête | Statut | Corps | Ce que ça prouve |
|---|---|---|---|---|
| S11 | corps avec des noms de paramètres faux (`p_modele`) | 404 | `PGRST202` … « Perhaps you meant to call the function public.assistant_reserver(p_octets, p_outil, p_owner, p_quota) » | le cache de schéma de PostgREST **connaît** `assistant_reserver` avec sa vraie signature : le rechargement a eu lieu (par `notify pgrst` ou par le déclencheur DDL de Supabase), donc plus de 502 `PGRST202` à craindre au premier POST réel |
| S12 | corps avec les bons noms (`p_owner`, `p_outil`, `p_quota`, `p_octets`) | 401 | `{"code":"42501","message":"permission denied for function assistant_reserver"}` | `anon` est refusé par l'API aussi (le verdict 2.04 vaut par la voie HTTP) ; seule `service_role`, donc la fonction `assistant`, peut réserver |

Reste non prouvé côté SQL : la concurrence réelle (deux appels simultanés sous le verrou), qui ne se joue pas dans l'éditeur.

**Redéploiement, version 4 (contrôleur, 23 octobre 2026, 20 h 24 UTC = 16 h 24 à Montréal)** : même commande (`--no-verify-jwt --use-api`,
CLI 2.121.0), code = `0c7cbbd` (pointe de la chaîne A → F : outils `lecture-web` du lot B et `image-web` du lot F ; quatre fichiers téléversés,
`lecture-web.js` compris), `ezbr_sha256 cbe7be61ef10fc312b898aa37b013beb30dd9f66ef4c7887efd4a8ddfb2e081a`, `ACTIVE`, `verify_jwt: false` ; jouée après `0005` et `0006` collées et
prouvées, et après les tests Node du serveur sur `0c7cbbd` (115/115). **S1-S9 rejouées à 20 h 25 UTC : statuts, corps et en-têtes CORS
identiques aux versions 1 à 3** (204 avec Allow-Origin, `allow-headers: authorization, apikey, content-type, x-client-info`,
`allow-methods: POST, OPTIONS`, `max-age: 600` / 204 sans Allow-Origin / 401 / 403 / 401 / 401 / 405 / 403 / 401 ; 94 à 627 ms, S1 à froid).
Le `GET` d'état avec une session réelle (première mesure, F-1) : voir « Sondes `lecture-web` ».

## Preuve `0005_imports.sql` — 35 verdicts, 0 faux (23 octobre 2026, vers 20 h 05 UTC = 16 h 05 à Montréal, geste de Neegan)

**JOUÉE par Neegan le 23 octobre 2026 (vers 20 h 05 UTC), avant la fusion et le `push` du code de ce lot : `999 BILAN` =
`0 faux sur 35`, `ok` vrai sur les 36 lignes.** Les collages ont été faits dans l'ordre de l'étape 11 depuis un kit copier-coller
préparé par le contrôleur (cinq fichiers, jetons de la preuve déjà remplacés : une adresse `exemple.invalid`, un uuid tiré au hasard ;
ni l'un ni l'autre n'est consigné ici) ; le tableau des verdicts ci-dessous est la sortie de l'éditeur SQL, collée telle quelle.

Section préparée le 18 octobre 2026 (lot A « importer une recette repérée », spec
`docs/superpowers/specs/2026-10-18-import-cible-design.md` § 3.5 ; procédure : étape 11 du README). **Jouée par Neegan avant
toute fusion et tout `push` du code de ce lot** (règle de l'étape 11), après `0003` (jouée le 18 octobre, ci-dessus) ; indépendante de `0004`. Jetons
`A_EMAIL` / `A_UUID` remis ; la preuve n'affiche jamais la colonne `data` (compteurs, motifs et verdicts « conforme / différente »
seulement) ; aucune clé n'est en jeu (`imports` n'en porte pas). La migration `0005` est rendue depuis le `SYNC_STORES` vivant tant
qu'elle n'est pas appliquée : une fois collée, la figer (`SYNC_STORES_0005` + empreinte épinglée, fin de l'étape 11).

| Heure | Collage | Résultat |
| --- | --- | --- |
| 23 oct. 2026, avant 20 h 05 UTC | `insert into private.allowed_users …` (1 adresse de preuve `exemple.invalid`) | jouée (fichier 1 du kit) ; le compte affiché après l'insertion n'a pas été rapporté (attendu 3 : les deux adresses admises plus celle de preuve ; le retrait rend 2) |
| idem | `migrations/0005_imports.sql` | jouée en un seul collage (fichier 2 du kit, identique au fichier du dépôt : `cmp` muet) ; sortie non rapportée (attendu `Success. No rows returned`) ; la preuve atteste la table, ses règles, son déclencheur, ses index et les quatre fonctions recréées (verdicts 1.01-1.08, 2.01, 5.01-5.05) |
| — | empreinte du `0005` collé : `shasum -a 256 supabase/migrations/0005_imports.sql` | `1af9e999d88958ea44ed739900cef842e54d1473b9d3f6a825ee23a388600ae0` (fichier du dépôt à `2b6a2fd`, celui du kit) |
| idem | `notify pgrst, 'reload schema';` (collée seule) | jouée (fichier 3 du kit) |
| vers 20 h 05 UTC | preuve `0005` (« Run without RLS ») | `999 BILAN : 0 faux sur 35`, `ok` vrai sur les 36 lignes (fichier 4 du kit) |
| 20 h 14 UTC (16 h 14 à Montréal) | retrait de l'adresse de preuve | jouée (fichier 5 du kit : `delete … where email = lower('…')` puis `select count(*)`) ; `allowed_users_apres` = **2**, soit les deux adresses admises connues (capture d'écran de Neegan) |

Tableau des verdicts (ordre, etape, attendu, obtenu, ok), tel que rendu par l'éditeur SQL :

| ordre | etape | attendu | obtenu | ok |
| --- | --- | --- | --- | --- |
| 0.01  | usage sur le schema temporaire pour authenticated                                                                          | accorde ou implicite                                                         | accorde explicitement                                                        | true |
| 0.02  | un compte de preuve cree (annule au rollback)                                                                              | 1                                                                            | 1                                                                            | true |
| 1.01  | public.imports presente, RLS activee                                                                                       | true                                                                         | true                                                                         | true |
| 1.02  | quatre regles : une par commande, pour authenticated, is_allowed et owner_id partout, delete sous app.purge                | 4 : DELETE, INSERT, SELECT, UPDATE / {authenticated} / delete sous app.purge | 4 : DELETE, INSERT, SELECT, UPDATE / {authenticated} / delete sous app.purge | true |
| 1.03  | declencheur imports_seq -> public.touch_server_seq(), actif                                                                | 1                                                                            | 1                                                                            | true |
| 1.04  | index imports_recv (owner_id, server_seq)                                                                                  | 1                                                                            | 1                                                                            | true |
| 1.05  | cle primaire composee (owner_id, id) : elle isole les comptes                                                              | 1                                                                            | 1                                                                            | true |
| 1.06  | owner_id references auth.users on delete cascade                                                                           | 1                                                                            | 1                                                                            | true |
| 1.07  | trois colonnes generees stockees, de type text : edition_id, recipe_id, status                                             | 3                                                                            | 3                                                                            | true |
| 1.08  | un index (owner_id, colonne) par colonne generee : imports_edition_id, imports_recipe_id, imports_status                   | 3                                                                            | 3                                                                            | true |
| 2.01  | authenticated : select, insert, update sur public.imports                                                                  | true / true / true                                                           | true / true / true                                                           | true |
| 2.02  | anon : aucun privilege sur aucune table de public ; les 27 tables synchronisees y sont                                     | 27 synchronisees, 0 table avec un privilege anon                             | 27 synchronisees, 0 table avec un privilege anon                             | true |
| 2.03  | anon : execute sur public.sync_push(jsonb)                                                                                 | false                                                                        | false                                                                        | true |
| 2.04  | anon : execute sur public.sync_purge(text, text)                                                                           | false                                                                        | false                                                                        | true |
| 2.05  | anon : execute sur public.sync_purge_all()                                                                                 | false                                                                        | false                                                                        | true |
| 2.06  | anon : execute sur public.purge_tombstones()                                                                               | false                                                                        | false                                                                        | true |
| 2.07  | authenticated : execute sur public.sync_push(jsonb)                                                                        | true                                                                         | true                                                                         | true |
| 2.08  | authenticated : execute sur public.sync_purge(text, text)                                                                  | true                                                                         | true                                                                         | true |
| 2.09  | authenticated : execute sur public.sync_purge_all()                                                                        | true                                                                         | true                                                                         | true |
| 2.10  | authenticated : execute sur public.purge_tombstones()                                                                      | false                                                                        | false                                                                        | true |
| 2.11  | les 27 tables synchronisees de public ont toutes la RLS activee                                                            | 27                                                                           | 27                                                                           | true |
| 3.01  | A pousse une ligne imports (import de recette, a_lancer)                                                                   | accepted 1, adjusted 0, rejected 0                                           | accepted 1, adjusted 0, rejected 0                                           | true |
| 3.02  | A relit sa ligne par ses colonnes generees : une ligne, edition_id / recipe_id / status conformes (compares, pas affiches) | 1 ligne, conformes                                                           | 1 ligne, conformes                                                           | true |
| 3.03  | la fiche entiere est celle qui a ete poussee (comparee sans etre affichee)                                                 | conforme                                                                     | conforme                                                                     | true |
| 3.04  | A pousse la meme ligne PLUS RECENTE, passee a a_verifier (transition du journal) : acceptee                                | accepted 1, rejected 0                                                       | accepted 1, rejected 0                                                       | true |
| 3.05  | la colonne generee status suit la fiche : a_verifier, toujours une seule ligne                                             | 1 ligne, status conforme                                                     | 1 ligne, status conforme                                                     | true |
| 3.06  | A pousse un import d index sans recipe_id (aucun champ requis pour imports) : accepte                                      | accepted 1, rejected 0                                                       | accepted 1, rejected 0                                                       | true |
| 3.07  | sa colonne generee recipe_id est nulle, edition_id et status posees                                                        | 1 ligne, recipe_id nul, edition_id et status conformes                       | 1 ligne, recipe_id nul, edition_id et status conformes                       | true |
| 4.01  | delete direct de A, sans app.purge : aucune ligne supprimee, sans erreur                                                   | 0                                                                            | 0                                                                            | true |
| 4.02  | A garde ses deux lignes apres le delete                                                                                    | 2                                                                            | 2                                                                            | true |
| 5.01  | public.sync_push(jsonb) : 27 magasins, la liste finit par assistant_config, imports                                        | 27 / true                                                                    | 27 / true                                                                    | true |
| 5.02  | public.sync_purge(text, text) : 27 magasins, la liste finit par assistant_config, imports                                  | 27 / true                                                                    | 27 / true                                                                    | true |
| 5.03  | public.sync_purge_all() : 27 magasins, la liste finit par assistant_config, imports                                        | 27 / true                                                                    | 27 / true                                                                    | true |
| 5.04  | public.purge_tombstones() : 27 magasins, la liste finit par assistant_config, imports                                      | 27 / true                                                                    | 27 / true                                                                    | true |
| 5.05  | sync_push : keys et required connaissent imports                                                                           | true / true                                                                  | true / true                                                                  | true |
| 999   | BILAN                                                                                                                      | aucun verdict faux                                                           | 0 faux sur 35                                                                | true |

## Preuve `0006_lecture_web.sql` — 10 verdicts, 0 faux (23 octobre 2026, vers 20 h 20 UTC = 16 h 20 à Montréal, geste de Neegan)

Section préparée le 19 octobre 2026 (lot B « recette web complète », spec `docs/superpowers/specs/2026-10-19-recette-web-design.md` § 6.4 ;
procédure : étape 12 du README). **JOUÉE par Neegan le 23 octobre 2026 (vers 20 h 20 UTC), après `0005` (jouée le même jour), avant le redéploiement de la fonction et
avant tout `push` : `999 BILAN` = `0 faux sur 10`, `ok` vrai sur les 11 lignes.** Collages depuis un kit copier-coller préparé par le
contrôleur (trois fichiers, identiques à ceux du dépôt, rien à remplacer) ; le tableau des verdicts ci-dessous est la sortie de l'éditeur SQL,
collée telle quelle. Rien à
remplacer ; la preuve n'affiche aucune adresse ni aucun identifiant (compte emprunté jamais nommé) ; aucune clé n'est en jeu. Lire en
particulier 1.01 (les cinq outils, dans l'ordre d'`OUTILS_0006` : `image-web` comprise, pour le lot F) et 2.03 bis (`image-web` accepté par
`assistant_reserver`).

| Heure | Collage | Résultat |
| --- | --- | --- |
| 23 oct. 2026, vers 20 h 15 UTC | `migrations/0006_lecture_web.sql` | jouée en un collage (fichier 1 du kit, identique au fichier du dépôt) ; sortie non rapportée (attendu `Success. No rows returned`) ; la preuve atteste la contrainte (1.01, 1.02) |
| — | empreinte du `0006` collé : `shasum -a 256 supabase/migrations/0006_lecture_web.sql` | `b2d4cf5944e2c2dc0c3982f0acbcd88d3b61d0f849d3693635aa98d1d286f234` (fichier du dépôt à `cf91f09`, identique à la pointe `0c7cbbd`) |
| idem | `notify pgrst, 'reload schema';` (collée seule ; facultative selon l'étape 12) | jouée (fichier 2 du kit) |
| vers 20 h 20 UTC | preuve `0006` (« Run without RLS ») | `999 BILAN : 0 faux sur 10`, `ok` vrai sur les 11 lignes (fichier 3 du kit) |

Tableau des verdicts (ordre, etape, attendu, obtenu, ok), tel que rendu par l'éditeur SQL :

| ordre | etape | attendu | obtenu | ok |
| --- | --- | --- | --- | --- |
| 1.01  | pg_get_constraintdef : les cinq outils, dans l ordre d OUTILS_0006                           | recherche-web < creation < extraction < lecture-web < image-web | dans l ordre       | true |
| 1.02  | une seule contrainte check sur assistant_journal                                             | 1                                                               | 1                  | true |
| 1.03  | anon et authenticated : aucun privilege sur la table (inchange depuis 0004)                  | false / false                                                   | false / false      | true |
| 1.04  | service_role : select, insert, update sur la table                                           | true / true / true                                              | true / true / true | true |
| 1.05  | vue assistant_usage_jour toujours la, en security invoker                                    | true                                                            | true               | true |
| 2.01  | sous postgres : une ligne de journal outil lecture-web est acceptee                          | acceptee                                                        | acceptee           | true |
| 2.02  | un outil hors liste est toujours refuse par le check                                         | 23514                                                           | 23514              | true |
| 2.03  | assistant_reserver accepte lecture-web : un id non nul                                       | id non nul                                                      | id non nul         | true |
| 2.031 | 2.03 bis : assistant_reserver(uid, 'image-web', 1, c + 1) -> id non nul (la valeur du lot F) | id non nul                                                      | id non nul         | true |
| 3.01  | les trois anciens outils passent encore                                                      | acceptes                                                        | acceptes           | true |
| 999   | BILAN                                                                                        | aucun verdict faux                                              | 0 faux sur 10      | true |

## Sondes `lecture-web` — jouées le 23 octobre 2026 sur la version 4 (7 sur 7 conformes, plus le `GET` d'état)

Jouées par le contrôleur le 23 octobre 2026 (étape 12, point 5) entre 20 h 25 et 20 h 35 UTC, sur la **version 4** de la fonction
(déployée à 20 h 24 UTC depuis `0c7cbbd`, `ezbr_sha256 cbe7be61ef10fc31…`, voir « Passerelle `assistant` »). **`GET` d'état avec la session
de Neegan : 200 `{"modele":"claude-sonnet-5-5","quotaJour":60,"cles":"nouvelles"}` (689 ms)** : la plateforme sert les NOUVELLES clés
(`sb_publishable_` / `sb_secret_`, F-1 ; première mesure). Session : jeton copié depuis la console du site connecté vers un fichier d'en-tête à
mode 600 (`curl -H @fichier`), jamais affiché ni tapé dans une commande, fichier vidé dès les sondes finies. S13-S16 et S19 ne dépensent rien (elles s'arrêtent avant
la réservation) ; S17-S18 coûtent un appel du quota chacune, sans dépense Anthropic : zéro jeton attendu (R-B-14). S13-S15 et S17-S18 se jouent
avec la session de Neegan lue par `read -rs JETON` (README, étape 10, point 4 ; jamais le jeton dans une commande) ; S16 sans jeton.

| Sonde | Requête | Statut attendu | Statut obtenu | Ce que ça prouve |
| --- | --- | --- | --- | --- |
| S13 | `{ outil: 'lecture-web', corps: { url: 'http://exemple.test/' } }` | 422 `interdit` | 422 `interdit` (307 ms) | refus avant toute réservation (`assistant_usage_jour` inchangé) |
| S14 | `https://127.0.0.1/` | 422 `interdit` | 422 `interdit` (155 ms) | adresse IP refusée |
| S15 | `https://localhost/` | 422 `interdit` | 422 `interdit` (263 ms) | hôte local refusé |
| S16 | sans jeton | 401 `non_connecte` | 401 `non_connecte` (sans jeton, 94 ms) | la session d'abord |
| S17 | une adresse `https` en 301 / 302 vers une page à JSON-LD `Recipe` complet (vérifiée d'abord sans la fonction : `curl -sI -A 'Mitsu/0.10 (+https://neegans.github.io/mistu/)'`, puis `curl -s` sur la cible) | 200 `jsonld`, `usage` 0 / 0 — ou un refus propre et nommé | 200 `source_kind: jsonld`, `usage` 0 / 0, `page.url_finale` = la page `www`, recette « Pâtes à la sauce puttanesca » lue (10 ingrédients, étapes) ; 658 ms. Adresse envoyée : `https://ricardocuisine.com/recettes/6309-pates-a-la-sauce-puttanesca` (301 vers `www.ricardocuisine.com`, vérifié d'abord par `curl -sI` avec le `User-Agent` de la fonction ; la cible porte un JSON-LD `Recipe` complet) | `redirect: 'manual'` sous le runtime : lecture `jsonld` sans appel au modèle, `page.url_finale` ≠ l'adresse envoyée ; opaque (502 `inaccessible` sur une chaîne que `curl` suit) → ronde sur `telechargerPage` avant la fusion |
| S18 | une adresse publique en `https` qui redirige vers `http://` | 422 `interdit` | 422 `interdit` (430 ms). Adresse : `https://httpbin.org/redirect-to?url=http%3A%2F%2Fexample.com%2F` (302 vers `http://example.com/`, vérifié d'abord par `curl -sI`) | la cible d'une redirection est revalidée (« non mesurée » si aucun hôte connu) |
| S19 | `https://ybdooerfeziiabsbfxtb.functions.supabase.co/` | 422 `interdit` | 422 `interdit` (176 ms) | l'alias de la fonction est refusé avant toute réservation (R-B-23, ronde finale 2 `51bad50`) |

## Sondes `image-web` — jouées le 23 octobre 2026 sur la version 4 (5 sur 5 conformes)

Lot F « Les plats en images » (spec `docs/superpowers/specs/2026-10-19-plats-en-images-design.md` § 10, pas 2) : même version 4, même session et
mêmes conditions que les sondes `lecture-web` ci-dessus, le même jour (20 h 25 à 20 h 35 UTC). S-F1 à S-F3 ne dépensent rien (elles s'arrêtent
avant la réservation) ; S-F4 et S-F5 coûtent un appel du quota chacune, zéro jeton (la fonction télécharge l'image elle-même, aucun appel au
modèle). Cible de S-F4 vérifiée d'abord sans la fonction (`curl -sI` : `content-type: image/jpeg`, `content-length: 171503`, sous les 2 Mio,
R-F-4) ; aucun 403 anti-hotlink rencontré (D-F3 : rien à contourner).

| Sonde | Requête | Statut attendu | Statut obtenu | Ce que ça prouve |
| --- | --- | --- | --- | --- |
| S-F1 | `{ outil: 'image-web', corps: { url: 'http://exemple.test/i.jpg' } }` | 422 `interdit` | 422 `interdit` (219 ms) | refus avant toute réservation |
| S-F2 | `https://127.0.0.1/i.jpg` | 422 `interdit` | 422 `interdit` (383 ms) | adresse IP refusée |
| S-F3 | sans jeton | 401 `non_connecte` | 401 `non_connecte` (148 ms) | la session d'abord |
| S-F4 | l'image de la recette Ricardo de S17 : `https://images.ricardocuisine.com/services/recipes/1x1/6309-v2.jpg` | 200, `type` et `taille` conformes, `Buffer.from(octets, 'base64').length === taille` | 200 `type: image/jpeg`, `taille` 171 503, `url_finale` = l'adresse envoyée, base64 décodé = 171 503 octets (cohérent) ; 676 ms | la fonction télécharge l'image, la borne et la rend telle quelle, sans appel au modèle |
| S-F5 | la page HTML de la même recette (`https://www.ricardocuisine.com/recettes/6309-pates-a-la-sauce-puttanesca`) | 422 `pas_une_image` | 422 `pas_une_image` (406 ms) | une page n'est pas une image |

Attendu dans `public.assistant_journal` (à lire par Neegan dans l'éditeur SQL, non fait par le contrôleur) : deux lignes `lecture-web` (S17 en 200,
S18 en 422) et deux lignes `image-web` (S-F4 en 200, S-F5 en 422), jetons `null` ; `assistant_usage_jour` du 23 octobre : 4 appels de plus.

## Preuve `0007_apercu_web.sql` — jouée le 28 octobre 2026 (0 faux sur 11)

Section préparée le 25 octobre 2026 (lot UI-2 « Aperçus des résultats web », spec `docs/superpowers/specs/2026-10-23-experience-carnet-design.md`
§ 6, D-UI-14 ; procédure : étape 13 du README). **À jouer par Neegan après `0006` (jouée le 23 octobre, ci-dessus), AVANT le redéploiement de la
fonction et AVANT que le code du lot UI-2 n'arrive sur le site public** : coller `migrations/0007_apercu_web.sql` en entier (attendu `Success. No rows
returned`), relever `shasum -a 256 supabase/migrations/0007_apercu_web.sql`, puis la preuve (« Run without RLS ») : lire `999 BILAN`, attendu
`0 faux sur 11` — dont 1.01 (les six outils, dans l'ordre d'`OUTILS_0007`) et 2.03 ter (`apercu-web` accepté par `assistant_reserver` ; les cinq anciens
passent encore, 3.01) — avec un compte dans `auth.users` : sans lui, six verdicts sont sautés (« aucun compte : etape sautee », `ok` nul) et comptent
comme faux (`6 faux sur 11` : PAS vert) ; vert = aucune ligne « aucun compte : etape sautee » et 2.032 qui lit `id non nul`. Rien à remplacer, aucune adresse ; la preuve n'affiche aucun identifiant (compte emprunté jamais nommé) ; aucune clé en jeu.
Après `0007`, la preuve `0006` devient historique : rejouée, son 1.01 rougit (voulu).

| Heure | Collage | Résultat |
| --- | --- | --- |
| 28 octobre 2026, avant 13 h 35 UTC | `migrations/0007_apercu_web.sql` (copiée du dépôt par `pbcopy`, à la tête `949c947`) | collée par Neegan ; la preuve qui suit la lit appliquée (1.01, 1.02) |
| — | empreinte du `0007` collé : `shasum -a 256 supabase/migrations/0007_apercu_web.sql` | `70168ef84f16d914532aa57eddf4c9b8162234c7cff4381e54145cfd59ab3739` (le fichier du dépôt, copié tel quel) |
| — | `notify pgrst, 'reload schema';` (collée seule ; facultative selon l'étape 13) | non jouée (facultative : aucune table ni fonction neuve) |
| 28 octobre 2026, tableau reçu à 13 h 35 UTC | preuve `0007` (« Run without RLS » ; empreinte `f072ccce…`) | **`999 BILAN : 0 faux sur 11`**, `ok` vrai sur les 12 lignes, aucune ligne « aucun compte : etape sautee », 2.032 `id non nul` |

Tableau des verdicts (ordre, etape, attendu, obtenu, ok), tel que rendu par l'éditeur SQL :

| ordre | etape | attendu | obtenu | ok |
| --- | --- | --- | --- | --- |
| 1.01 | pg_get_constraintdef : les six outils, dans l ordre d OUTILS_0007 | recherche-web < creation < extraction < lecture-web < image-web < apercu-web | dans l ordre | true |
| 1.02 | une seule contrainte check sur assistant_journal | 1 | 1 | true |
| 1.03 | anon et authenticated : aucun privilege sur la table (inchange depuis 0004) | false / false | false / false | true |
| 1.04 | service_role : select, insert, update sur la table | true / true / true | true / true / true | true |
| 1.05 | vue assistant_usage_jour toujours la, en security invoker | true | true | true |
| 2.01 | sous postgres : une ligne de journal outil apercu-web est acceptee | acceptee | acceptee | true |
| 2.02 | un outil hors liste est toujours refuse par le check | 23514 | 23514 | true |
| 2.03 | assistant_reserver accepte lecture-web : un id non nul | id non nul | id non nul | true |
| 2.031 | 2.03 bis : assistant_reserver(uid, 'image-web', 1, c + 1) -> id non nul (la valeur du lot F) | id non nul | id non nul | true |
| 2.032 | 2.03 ter : assistant_reserver(uid, 'apercu-web', 1, c + 1) -> id non nul (la valeur du lot UI-2) | id non nul | id non nul | true |
| 3.01 | les cinq anciens outils passent encore | acceptes | acceptes | true |
| 999 | BILAN | aucun verdict faux | 0 faux sur 11 | true |

## Sondes `apercu-web` — version 5 déployée le 28 octobre 2026 (sondes sans session jouées ; sondes avec session à jouer)

**Version 5** déployée par le contrôleur le 28 octobre 2026 à 13 h 36 UTC, après la `0007` collée et prouvée ci-dessus, depuis `~/projects/mistu`
à la tête `949c947` (le code de `supabase/functions/` y est celui de `ecfc19b`, vérifié par `/verify` : `git diff ecfc19b 949c947 -- supabase/functions`
vide), par `~/.local/bin/supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api` (CLI 2.121.0 ; aucun
`config.toml` dans le dépôt) ; `supabase functions list` : `ACTIVE`, version 5, `verify_jwt: false`, `import_map: true`, `ezbr_sha256
d399d826f87f8ac40290bd31738aba5959b6eae6442bfc7e7a239e60d194a56a`. Recul : redéployer la version 4 depuis `0c7cbbd`. Sondes sans session, sans
dépense (13 h 36-13 h 37 UTC ; toutes s'arrêtent avant la réservation) : S1 `OPTIONS` origine admise → 204, `access-control-allow-origin:
https://neegans.github.io`, `allow-headers: authorization, apikey, content-type, x-client-info`, `allow-methods: POST, OPTIONS`, `max-age: 600` ; S2
`OPTIONS` origine refusée → 204 sans `allow-origin` ; S3 `POST` sans jeton → 401 `non_connecte` ; S4 origine refusée → 403 `origine` ; S5 jeton bidon et
clé publique → 401 `non_connecte` ; S6 `GET` jeton bidon → 401 ; S7 `PUT` → 405 `methode` ; S8 sans `Origin` → 403 `origine` ; S9 clé publique en
Bearer → 401 `non_connecte` ; S16 (`lecture-web`), S-F3 (`image-web`) et S-A4 (`apercu-web`) sans jeton → 401 `non_connecte` : identiques aux
versions 1 à 4. S-A1 et S-A2 passent la session (la fonction lit la session avant le corps : sans elle, 401) : à jouer avec la session de Neegan,
comme les sondes payantes.

Lot UI-2 (spec § 6, « Sondes » ; étape 13, point 5 du README) : à jouer par le chef d'orchestre sur la version redéployée (version et `ezbr_sha256` à
consigner ici, comme pour les versions 1 à 4, section « Passerelle `assistant` »), après la `0007` collée et prouvée par Neegan, et après les tests Node
du serveur. S-A1, S-A2 et S-A4 ne dépensent rien (elles s'arrêtent avant la réservation : `assistant_usage_jour` inchangé) ; S-A3 et S-A5 à S-A7
coûtent un appel du quota chacune, **sans dépense** Anthropic : **zéro jeton** attendu (jetons `null` au journal). Les sondes S1-S9 du lot 4, S13-S19 du
lot B, S-F1 à S-F3 du lot F et le `GET` d'état sont rejouées au même redéploiement (les chemins `lecture-web` et `image-web` reprouvés sur la version 5).
Session : jeton copié depuis la console du site connecté par le script d'attente du presse-papiers vers un fichier d'en-tête à mode
600 (`curl -H @fichier`), fichier vidé dès les sondes finies — jamais le jeton dans une commande ; S-A4 se joue sans jeton.

| Sonde | Requête | Statut attendu | Statut obtenu | Ce que ça prouve |
| --- | --- | --- | --- | --- |
| S-A1 | `{ outil: 'apercu-web', corps: { urls: 'x' } }` | 400 `requete` | à jouer | forme refusée avant toute réservation (aucune ligne au journal) |
| S-A2 | `urls: ['http://exemple.test/', 'https://127.0.0.1/', 'https://localhost/', 'https://ybdooerfeziiabsbfxtb.supabase.co/', 'https://exemple.test:8443/']` | 422 `interdit` | à jouer | cinq adresses refusées par `valideAdresse` : 422 sans réservation, aucune ligne |
| S-A3 | une admise (la page Ricardo de S17) et les quatre premières de S-A2 | 200, `apercus[0]` avec `image` ou une raison, `apercus[1..4]` `{ image: null, raison: 'interdit' }` | à jouer | validation par adresse AVANT une réservation unique (I-UI-6) : UNE ligne `apercu-web` au journal, jetons `null` |
| S-A4 | sans jeton | 401 `non_connecte` | 401 `non_connecte` (103 ms, version 5) | la session d'abord |
| S-A5 | les cinq adresses des liens de la recherche « puttanesca » (relevées dans l'app) | 200 : cinq images ou raisons, en ≤ 60 s | à jouer | taille réelle de la réponse (K-5), durée totale, compte d'`image_trop_lourde` (décide si la borne passe de 1 à 2 Mio, B-M-6) |
| S-A6 | une page de liste (catégorie de recettes) | 200 : `pas_de_recette` | à jouer | la règle de F (page de liste : `og:image` écartée) vaut pour les aperçus |
| S-A7 | « cinq pages hostiles de 2 Mio » servies par un hôte public contrôlé par le contrôleur | 200 ou `delai` en moins de 60 s | à jouer | budget de 60 s et parallélisme 2 sous le vrai runtime (mémoire ≈ 20 Mio transitoires) : jamais un 502 d'isolat tué (S-2) |

Attendu dans `public.assistant_journal` (à lire par Neegan dans l'éditeur SQL) : une ligne `apercu-web` par sonde payante (S-A3, S-A5, S-A6, S-A7), statut 200,
jetons `null` ; `assistant_usage_jour` du jour : 4 appels de plus.

## Migration `0008_corbeille_recettes.sql` — appliquée le 29 octobre 2026

Autorisation de Neegan : « deploy avant », suivie de « et enchaine sur le restant des lots ».
Code `52338ec`, application 0.23.0 ; projet `mitsu`. Sauvegarde physique du 29 octobre à 06:29 UTC
observée `COMPLETED` avant le geste. Aucune sauvegarde n’a été restaurée.

Préflight en transaction `READ ONLY` : PostgreSQL 17.11, rôle `postgres`, neuf tables cibles présentes,
anciennes fonctions requises présentes ; aucune fonction ni aucun trigger L1 déjà installé.
Migration appliquée une seule fois par la Management API du CLI, dans une transaction avec délais bornés
et notification de rechargement du schéma PostgREST. Aucun contenu métier n’est modifié par la migration.
SHA-256 du fichier appliqué : `d7bbb381d8b7f56c28e74ae32be9c6f3d596ffdf908bbbf244e5235d853a63a3`.

| Contrôle après migration | Résultat |
|---|---|
| Corps des fonctions | 7/7 exacts, dont les 6 de L1 et l’ancienne `sync_push` inchangée ; `security invoker` |
| Triggers | 9/9 activés sur INSERT/UPDATE/DELETE, fonction attendue, RLS active |
| Droits cap/v2 | Exécution autorisée à `authenticated`, refusée à `anon` |
| Fonction de trigger | Pas d’exécution directe autorisée à `authenticated` |
| Capacité sous rôle `authenticated` autorisé, transaction en lecture seule | `recipe_lifecycle = 1` |
| HTTP PostgREST anonyme, `sync_capabilities` et `sync_push_v2` | HTTP 401, code `42501`, refus attendu |

Les claims du contrôle de capacité ont été construits côté SQL depuis un compte déjà autorisé,
sans emprunter de JWT utilisateur. Aucun identifiant ou courriel n’est sorti, aucune recette n’a été consultée,
aucune écriture métier n’a été exécutée. Ce contrôle SQL ne constitue pas un échange HTTP authentifié.

La preuve mutante `0008` n’a pas été jouée sur la production. Les **42 assertions** et les **deux connexions
concurrentes** ont été exécutées sur PostgreSQL local jetable pendant la construction, puis le serveur arrêté.
La convergence sur les deux appareils réels reste à vérifier.
Traces locales : `.superpowers/sdd/2026-10-29-l1-publication/` (`migration-0008.log`,
`postflight-0008-resultat.json`, `postgrest-anonyme.json`). Aucun redéploiement de l’assistant.
