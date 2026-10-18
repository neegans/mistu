# Résultats des preuves — projet `mitsu` (le seul projet, D8 révoquée le 13 octobre 2026)

Projet Supabase `mitsu`, région Canada (Central), éditeur SQL du tableau de bord, rôle `postgres`.
Collages joués par Neegan le 13 octobre 2026 ; sorties relues et consignées par l'agent le même jour.
Aucune adresse ni clé ici : les jetons `A_EMAIL`/`B_EMAIL` de la preuve étaient deux adresses du domaine
réservé `exemple.invalid`, retirées de `private.allowed_users` après coup (étape 4 bis du README).

## Chronologie

| Heure | Collage | Résultat |
| --- | --- | --- |
| 11 h 17 | `0001_tables_et_regles.sql` sans sa dernière ligne | `Success. No rows returned` (`create extension pg_cron` passé du premier coup) |
| 11 h 18 | `select cron.schedule('cuisine-os-tombales', '15 4 * * *', …)` | `schedule = 1` |
| 11 h 19 | `insert into private.allowed_users …` (2 adresses réelles + 2 adresses de preuve) | `autorisees = 4` |
| 11 h 20 | preuve `0001` — **premier essai** | `42P01 relation "preuve" does not exist` — voir « Piège du tableau de bord » |
| 11 h 23 | sondes : état intact ? table temporaire visible d'une instruction à l'autre ? | `autorisees 4 / comptes 0 / livres 0` ; `meme_session 1` |
| 11 h 25 | preuve `0001` — **second essai, « Run without RLS »** | **`999 BILAN : 0 faux sur 76`** |

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

## Preuve `0003_assistant_config.sql` — à jouer (à remplir par Neegan, sans aucune valeur de data)

Section préparée le 18 octobre 2026 (lot « la configuration de l'assistant suit le compte », spec
`docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` § 6.3 ; procédure : étape 8 bis du README).
**Rien n'a encore été joué sur `mitsu`.** À remplir au moment du collage, **avant** la fusion et le `push` du code.

Le dépôt est public : jetons `A_EMAIL` / `B_EMAIL` / `A_UUID` / `B_UUID` remis partout, et **aucune valeur de la
colonne `data`** — la preuve n'affiche que des compteurs, des motifs et des longueurs de clé. Si une cellule montre
une clé (`sk-…`) ou un objet `data`, ne pas la coller ici : le signaler.

| Heure | Collage | Résultat |
| --- | --- | --- |
| … | `insert into private.allowed_users …` (2 adresses de preuve `exemple.invalid`) | … |
| … | `migrations/0003_assistant_config.sql` | … |
| … | preuve `0003` (« Run without RLS ») | `999 BILAN : … faux sur …` |
| … | retrait des 2 adresses de preuve | … |
| … | `notify pgrst, 'reload schema';` (seulement si une lecture a rendu 404) | … |

Tableau des verdicts (ordre, etape, attendu, obtenu, ok) : à coller ici.

Lignes `7.01` à `7.05` (journaux de Postgres, informatives) : à recopier telles quelles — c'est la mesure que la
spec § 7 attendait (S9).
