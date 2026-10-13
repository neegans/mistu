-- Preuve 0001 — spec § 7.2. À coller dans l'éditeur SQL de Supabase APRÈS `0001_tables_et_regles.sql`
-- ET APRÈS l'insertion des deux adresses dans `private.allowed_users` (étape 4 de `supabase/README.md`).
--
-- AVANT DE COLLER, remplace les quatre jetons partout dans le fichier (Cmd-F, « Tout remplacer ») :
--   A_UUID, B_UUID   : deux uuid au hasard, distincts (`select gen_random_uuid();` en donne un)
--   A_EMAIL, B_EMAIL : deux adresses présentes dans `private.allowed_users`, EN MINUSCULES
-- Ne recolle jamais le fichier modifié dans le dépôt : il contiendrait tes adresses.
--
-- L'éditeur SQL n'affiche qu'UN tableau de résultats : celui du dernier `select` qui renvoie des lignes. Ce script
-- n'en a donc qu'un, à la fin : la table des verdicts, une ligne par preuve (ordre, étape, attendu, obtenu, ok).
-- Lis d'abord la ligne 999 « BILAN » : `ok = true` veut dire « aucun verdict faux ». Colle le tableau entier dans
-- `supabase/proofs/RESULTATS-<projet>.md` (sans tes adresses : remets les jetons).
--
-- Tout se joue dans une transaction annulée à la dernière instruction : la preuve ne laisse RIEN (ni compte dans
-- `auth.users`, ni fiche, ni adresse retirée) et elle est rejouable telle quelle. Si une instruction échoue,
-- l'éditeur annule tout et le message d'erreur est la seule sortie : corrige, puis recolle le fichier entier.
--
-- Les cinq motifs de rejet de `sync_push` que cette preuve fait sortir : 'updated_at', 'cle', 'forme', 'conflit'
-- (et 'taille', voir la note de la section 5).

begin;

-- 0. Gardes de lecture : un échec ici dit quoi faire, au lieu de laisser une erreur Postgres opaque.
do $$
begin
  if (select count(*) from private.allowed_users where email in ('A_EMAIL', 'B_EMAIL')) <> 2 then
    raise exception 'A_EMAIL et B_EMAIL doivent etre dans private.allowed_users, en minuscules (etape 4 du README)';
  end if;
  if exists (select 1 from auth.users where email in ('A_EMAIL', 'B_EMAIL')) then
    raise exception 'une de ces adresses a deja un compte : auth.users refuse un doublon de courriel. Prends deux adresses de preuve (README, « deux adresses de preuve »)';
  end if;
end $$;

-- La table des verdicts. Elle est temporaire : elle meurt avec la session, et de toute façon avec le rollback.
-- Le `primary key` sur `ordre` interdit deux preuves au même numéro (une erreur de copie se verrait tout de suite).
create temporary table preuve (ordre numeric primary key, etape text, attendu text, obtenu text, ok boolean);
grant insert, select on table pg_temp.preuve to authenticated;

-- 1. LES PRIVILÈGES PAR DÉFAUT DONT TOUT DÉPEND (R11). Une règle RLS ne sert à rien si le rôle de l'API n'a pas le
--    privilège de table : `sync_push` est `security invoker`, et le déclencheur `touch_server_seq` appelle
--    `nextval('public.sync_seq')` sous l'identité de l'appelant. Ces droits viennent des `alter default privileges`
--    du projet Supabase, pas de la migration : ils n'existent que si `0001` a été appliqué depuis l'éditeur SQL,
--    sous le rôle `postgres`.
--    Si l'une de ces lignes est fausse, exécuter
--      grant select, insert, update on all tables in schema public to authenticated;
--      grant usage on all sequences in schema public to authenticated;
--    puis LE SIGNALER : le générateur de migrations devra poser ces `grant` lui-même.
insert into pg_temp.preuve
select n, etape, 'true', v::text, v from (values
  (1.01, 'authenticated : select sur public.books', has_table_privilege('authenticated', 'public.books', 'select')),
  (1.02, 'authenticated : insert sur public.books', has_table_privilege('authenticated', 'public.books', 'insert')),
  (1.03, 'authenticated : update sur public.books', has_table_privilege('authenticated', 'public.books', 'update')),
  (1.04, 'authenticated : select sur public.files', has_table_privilege('authenticated', 'public.files', 'select')),
  (1.05, 'authenticated : usage sur la sequence public.sync_seq', has_sequence_privilege('authenticated', 'public.sync_seq', 'usage')),
  (1.06, 'authenticated : usage sur le schema public', has_schema_privilege('authenticated', 'public', 'usage')),
  (1.07, 'authenticated : execute sur public.is_allowed() (appelee par les 100 regles)', has_function_privilege('authenticated', 'public.is_allowed()', 'execute'))
) as x(n, etape, v);

-- 2. LA BARRIÈRE B1 (spec § 3.2). D'abord qu'elle LAISSE PASSER une adresse listée : un crochet ou un déclencheur
--    qui refuserait tout le monde serait indiscernable d'une barrière qui marche. Ensuite qu'elle refuse.
insert into auth.users (id, email, instance_id, aud, role)
  values ('A_UUID', 'A_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into auth.users (id, email, instance_id, aud, role)
  values ('B_UUID', 'B_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into pg_temp.preuve
select 2.01, 'declencheur B1 : deux adresses listees passent', '2', count(*)::text, count(*) = 2
from auth.users where id in ('A_UUID', 'B_UUID');

-- Le refus. Le bloc intérieur lève toujours (soit la barrière, soit notre « KO ») : son écriture est donc toujours
-- annulée, et le verdict est écrit par le bloc extérieur, resté vivant. Aucun savepoint n'est nécessaire — et il
-- serait nuisible : un `rollback to savepoint` effacerait aussi la ligne de verdict.
do $$
declare v text;
begin
  begin
    insert into auth.users (id, email, instance_id, aud, role)
      values (gen_random_uuid(), 'inconnu@exemple.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    raise exception 'KO : adresse hors liste acceptee';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (2.02, 'declencheur B1 : adresse hors liste refusee', 'P0001 adresse non autorisee', v, v like 'P0001 adresse non autoris%');
end $$;

-- Le crochet « Before User Created » lui-même, appelé directement (sous `postgres`, qui en a le droit).
insert into pg_temp.preuve
select 2.03, 'crochet before_user_created : adresse listee', '{}', v::text, v = '{}'::jsonb
from (select public.before_user_created('{"user":{"email":"A_EMAIL"}}'::jsonb) as v) t;
insert into pg_temp.preuve
select 2.04, 'crochet before_user_created : adresse inconnue', '403', coalesce(v->'error'->>'http_code', v::text), v->'error'->>'http_code' = '403'
from (select public.before_user_created('{"user":{"email":"inconnu@exemple.invalid"}}'::jsonb) as v) t;
insert into pg_temp.preuve
select 2.05, 'crochet before_user_created : courriel absent', '403', coalesce(v->'error'->>'http_code', v::text), v->'error'->>'http_code' = '403'
from (select public.before_user_created('{}'::jsonb) as v) t;

-- 3. DEUX APPELANTS (spec § 7.2) : A écrit et relit ; B ne voit rien de A ; les deux poussent le MÊME `id` et le
--    MÊME `sha256` et réussissent tous deux (clé composée) ; B ne peut pas écrire chez A ; `owner_id` nul refusé.
--    Les empreintes de preuve sont construites par `lpad(...)` : 64 caractères, sans risque de mal compter.
set local role authenticated;
set local request.jwt.claims = '{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}';
insert into pg_temp.preuve
select 3.01, 'A pousse un livre et une ligne de fichier', 'accepted 2, rejected 0',
  'accepted ' || jsonb_array_length(v->'accepted') || ', adjusted ' || jsonb_array_length(v->'adjusted') || ', rejected ' || jsonb_array_length(v->'rejected'),
  jsonb_array_length(v->'accepted') = 2 and jsonb_array_length(v->'rejected') = 0
from (select public.sync_push(jsonb_build_array(
  '{"store":"books","id":"b_commun","data":{"id":"b_commun","title":"Livre A"},"updated_at":"2026-10-12T10:00:00Z"}'::jsonb,
  jsonb_build_object('store', 'files', 'id', lpad('1', 64, '0'), 'updated_at', '2026-10-12T10:00:00Z',
    'data', jsonb_build_object('sha256', lpad('1', 64, '0'), 'mime', 'image/jpeg', 'size', 3))
)) as v) t;
insert into pg_temp.preuve
select 3.02, 'A relit son livre', '1', count(*)::text, count(*) = 1 from public.books where id = 'b_commun';
insert into pg_temp.preuve
select 3.03, 'A relit sa ligne de fichier', '1', count(*)::text, count(*) = 1 from public.files where id = lpad('1', 64, '0');
-- Preuve R13 : la ligne porte un `server_seq` alors que `execute` est révoqué sur `public.touch_server_seq()` (8.09).
-- Honnêteté : à l'insertion, une valeur non nulle pourrait aussi venir du défaut de colonne `nextval(...)`. La
-- preuve franche que le déclencheur TOURNE est 6.07 : un `update` de `sync_push`, qui ne touche pas la colonne,
-- fait quand même augmenter `server_seq`.
insert into pg_temp.preuve
select 3.04, 'R13 : server_seq pose sur la ligne inseree (preuve franche en 6.07)', 'non nul', server_seq::text, server_seq is not null
from public.books where id = 'b_commun';

set local request.jwt.claims = '{"sub":"B_UUID","email":"B_EMAIL","role":"authenticated"}';
insert into pg_temp.preuve
select 3.05, 'B ne voit rien de A', '0', count(*)::text, count(*) = 0 from public.books;
insert into pg_temp.preuve
select 3.06, 'B pousse le meme id et la meme empreinte', 'accepted 2, rejected 0',
  'accepted ' || jsonb_array_length(v->'accepted') || ', rejected ' || jsonb_array_length(v->'rejected'),
  jsonb_array_length(v->'accepted') = 2 and jsonb_array_length(v->'rejected') = 0
from (select public.sync_push(jsonb_build_array(
  '{"store":"books","id":"b_commun","data":{"id":"b_commun","title":"Livre B"},"updated_at":"2026-10-12T10:00:00Z"}'::jsonb,
  jsonb_build_object('store', 'files', 'id', lpad('1', 64, '0'), 'updated_at', '2026-10-12T10:00:00Z',
    'data', jsonb_build_object('sha256', lpad('1', 64, '0'), 'mime', 'image/jpeg', 'size', 3))
)) as v) t;
insert into pg_temp.preuve
select 3.07, 'B ne voit que SA ligne, avec SON contenu', '1 / Livre B',
  count(*) || ' / ' || coalesce(max(data->>'title'), 'rien'), count(*) = 1 and max(data->>'title') = 'Livre B'
from public.books where id = 'b_commun';

do $$
declare v text;
begin
  begin
    insert into public.books (owner_id, id, data, updated_at) values ('A_UUID', 'b_pirate', '{"id":"b_pirate"}'::jsonb, now());
    raise exception 'KO : insert chez A accepte';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (3.08, 'B ne peut pas ecrire chez A', '42501 (refus de la regle)', v, v like '42501%');
  begin
    insert into public.books (owner_id, id, data, updated_at) values (null, 'b_nul', '{"id":"b_nul"}'::jsonb, now());
    raise exception 'KO : owner_id nul accepte';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (3.09, 'owner_id nul refuse', '23502 (not null) ou 42501', v, v like '23502%' or v like '42501%');
end $$;

-- Vu de `postgres` (propriétaire des tables, donc hors RLS) : deux lignes, deux propriétaires, rien de piraté.
reset role;
insert into pg_temp.preuve
select 3.10, 'meme id chez deux proprietaires (vu de postgres, proprietaire des tables : hors RLS)', '2 lignes, 2 proprietaires',
  count(*) || ' lignes, ' || count(distinct owner_id) || ' proprietaires', count(*) = 2 and count(distinct owner_id) = 2
from public.books where id = 'b_commun';
insert into pg_temp.preuve
select 3.11, 'meme empreinte chez deux proprietaires (vu de postgres : hors RLS)', '2 lignes, 2 proprietaires',
  count(*) || ' lignes, ' || count(distinct owner_id) || ' proprietaires', count(*) = 2 and count(distinct owner_id) = 2
from public.files where id = lpad('1', 64, '0');
insert into pg_temp.preuve
select 3.12, 'aucune ligne piratee', '0', count(*)::text, count(*) = 0
from public.books where id in ('b_pirate', 'b_nul');

-- 4. SUPPRESSION (spec § 3.5, amendée R12). Le `delete` direct de l'API ne passe pas la règle : 0 ligne supprimée,
--    sans erreur. `sync_purge` supprime la ligne et rend le compte. R12 : ni `sync_purge` ni `sync_purge_all` ne
--    touchent au stockage — l'objet du seau est supprimé par l'app, par l'API de téléversement (L5).
set local role authenticated;
set local request.jwt.claims = '{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}';
delete from public.books where id = 'b_commun';
insert into pg_temp.preuve
select 4.01, 'delete direct : aucune ligne supprimee', '1', count(*)::text, count(*) = 1 from public.books where id = 'b_commun';
insert into pg_temp.preuve
select 4.02, 'sync_purge rend 1', '1', v::text, v = 1 from (select public.sync_purge('books', 'b_commun') as v) t;
insert into pg_temp.preuve
select 4.03, 'ligne disparue apres sync_purge', '0', count(*)::text, count(*) = 0 from public.books where id = 'b_commun';
insert into pg_temp.preuve
select 4.04, 'sync_purge_all retire ce qui reste a A (la ligne de fichier)', '1', v::text, v = 1
from (select public.sync_purge_all() as v) t;
insert into pg_temp.preuve
select 4.05, 'A ne garde aucune ligne', '0', n::text, n = 0
from (select (select count(*) from public.books) + (select count(*) from public.files) as n) t;
-- Mesure annexe, attendue : `set_config(..., true)` vaut pour toute la TRANSACTION, pas pour la seule instruction.
-- Dans l'app, chaque appel RPC est sa propre transaction, donc sans conséquence ; dans CE script, `app.purge` reste
-- posé après 4.02 — c'est pourquoi 4.01 est joué AVANT toute purge. On le remet à vide juste après.
insert into pg_temp.preuve
select 4.06, 'app.purge reste pose apres sync_purge dans la meme transaction (attendu, sans effet via PostgREST)',
  'on', coalesce(nullif(current_setting('app.purge', true), ''), 'non pose'), true;
select set_config('app.purge', '', true);

-- 5. MOTIFS DE REJET ET AJUSTEMENTS (spec § 3.4). Un élément mal formé ne doit JAMAIS faire échouer le lot. Seuls
--    un `store` inconnu (R10) et les deux bornes du lot refusent l'appel entier.
do $$
declare v text;
begin
  begin
    -- Un élément VALIDE est placé avant celui au store inconnu : c'est lui qui prouve R10 en 5.02 (l'appel entier
    -- est refusé, donc même ce qui était écrivable n'est pas écrit).
    perform public.sync_push('[
      {"store":"books","id":"avant_pirate","data":{"id":"avant_pirate"},"updated_at":"2026-10-12T10:00:00Z"},
      {"store":"pirates","id":"x","data":{"id":"x"},"updated_at":"2026-10-12T10:00:00Z"}
    ]'::jsonb);
    raise exception 'KO : store inconnu accepte';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (5.01, 'store inconnu : appel entier refuse', 'P0001 store inconnu', v, v = 'P0001 store inconnu');
end $$;
insert into pg_temp.preuve
select 5.02, 'R10 : lelement valide du meme appel nest pas ecrit', '0', count(*)::text, count(*) = 0
from public.books where id = 'avant_pirate';

insert into pg_temp.preuve
select 5.03, 'motifs : m1 updated_at, m2 cle, m3 forme, m4 adjusted, m5 accepted', '3 rejets, 1 ajuste, 1 accepte', v::text,
      v->'rejected' @> '[{"store":"books","id":"m1","reason":"updated_at"}]'::jsonb
  and v->'rejected' @> '[{"store":"books","id":"m2","reason":"cle"}]'::jsonb
  and v->'rejected' @> '[{"store":"recipe_versions","id":"m3","reason":"forme"}]'::jsonb
  and v->'adjusted' @> '[{"store":"books","id":"m4"}]'::jsonb
  and v->'accepted' @> '[{"store":"books","id":"m5"}]'::jsonb
  and jsonb_array_length(v->'rejected') = 3 and jsonb_array_length(v->'adjusted') = 1 and jsonb_array_length(v->'accepted') = 1
from (select public.sync_push('[
 {"store":"books","id":"m1","data":{"id":"m1"}},
 {"store":"books","id":"m2","data":{"id":"autre"},"updated_at":"2026-10-12T10:00:00Z"},
 {"store":"recipe_versions","id":"m3","data":{"id":"m3"},"updated_at":"2026-10-12T10:00:00Z"},
 {"store":"books","id":"m4","data":{"id":"m4"},"updated_at":"2999-01-01T00:00:00Z"},
 {"store":"books","id":"m5","data":null,"deleted":true,"updated_at":"2026-10-12T10:00:00Z"}
]'::jsonb) as v) t;
insert into pg_temp.preuve
select 5.04, 'm4 ajuste : updated_at ramene a lheure serveur', 'moins de 5 minutes dans le futur', updated_at::text,
  updated_at <= now() + interval '5 minutes' from public.books where id = 'm4';
insert into pg_temp.preuve
select 5.05, 'm5 tombale sur ligne inconnue : data vide, deleted_at pose', '{} et une date',
  data::text || ' / ' || coalesce(deleted_at::text, 'null'), data = '{}'::jsonb and deleted_at is not null
from public.books where id = 'm5';

-- Corrections de la tâche 3, toutes dans le MÊME appel qu'un élément valide : aucune ne fait échouer le lot.
-- La tombale sans `id` sort en `rejected` avec `"id": null` — la vérification ne porte donc que sur store+motif.
insert into pg_temp.preuve
select 5.06, 'corrections T3 : tombale sans id (cle), deleted non booleen (forme), files size non numerique (forme), files avec blob (forme), n5 accepte',
  '4 rejets, 1 accepte', v::text,
      v->'rejected' @> '[{"store":"books","reason":"cle"}]'::jsonb
  and v->'rejected' @> '[{"store":"books","id":"n2","reason":"forme"}]'::jsonb
  and v->'rejected' @> jsonb_build_array(jsonb_build_object('store', 'files', 'id', lpad('3', 64, '0'), 'reason', 'forme'))
  and v->'rejected' @> jsonb_build_array(jsonb_build_object('store', 'files', 'id', lpad('4', 64, '0'), 'reason', 'forme'))
  and v->'accepted' @> '[{"store":"books","id":"n5"}]'::jsonb
  and jsonb_array_length(v->'rejected') = 4 and jsonb_array_length(v->'accepted') = 1
from (select public.sync_push(jsonb_build_array(
  '{"store":"books","data":null,"deleted":true,"updated_at":"2026-10-12T10:00:00Z"}'::jsonb,
  '{"store":"books","id":"n2","data":{"id":"n2"},"deleted":"oui","updated_at":"2026-10-12T10:00:00Z"}'::jsonb,
  jsonb_build_object('store', 'files', 'id', lpad('3', 64, '0'), 'updated_at', '2026-10-12T10:00:00Z',
    'data', jsonb_build_object('sha256', lpad('3', 64, '0'), 'mime', 'image/jpeg', 'size', 'trois')),
  jsonb_build_object('store', 'files', 'id', lpad('4', 64, '0'), 'updated_at', '2026-10-12T10:00:00Z',
    'data', jsonb_build_object('sha256', lpad('4', 64, '0'), 'mime', 'image/jpeg', 'size', 3, 'blob', 'x')),
  '{"store":"books","id":"n5","data":{"id":"n5"},"updated_at":"2026-10-12T10:00:00Z"}'::jsonb
)) as v) t;
insert into pg_temp.preuve
select 5.07, 'n5 ecrit, aucun des quatre rejets ecrit', '1 livre n5, 0 ligne de fichier',
  (select count(*) from public.books where id = 'n5') || ' / ' || (select count(*) from public.files),
  (select count(*) from public.books where id = 'n5') = 1 and (select count(*) from public.files) = 0;

-- Les deux bornes du lot (spec § 3.4) : l'appel entier est refusé, rien n'est écrit.
-- Note sur le motif 'taille' : il n'est PAS atteignable tel que `sync_push` est écrit. La borne par élément
-- (`pg_column_size(d) > 1 Mo`) et la borne du lot (`pg_column_size(rows) > 1 Mo`) sont au même seuil : un élément
-- de plus de 1 Mo rend forcément le lot plus gros que 1 Mo, donc l'appel est refusé AVANT la boucle. Signalé au
-- rapport de la tâche 4 ; le motif reste comme garde si la borne du lot change un jour.
do $$
declare v text; gros jsonb;
begin
  gros := jsonb_build_array(jsonb_build_object('store', 'books', 'id', 'gros', 'updated_at', '2026-10-12T10:00:00Z',
    'data', jsonb_build_object('id', 'gros', 'remplissage', repeat('x', 1300000))));
  begin
    perform public.sync_push(gros);
    raise exception 'KO : charge de plus de 1 Mo acceptee';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (5.08, 'charge de plus de 1 Mo : appel refuse', 'P0001 rows : 1 Mo au plus', v, v like 'P0001 rows : 1 Mo%');
  begin
    perform public.sync_push((select jsonb_agg(jsonb_build_object('store', 'books', 'id', 'b' || g,
      'updated_at', '2026-10-12T10:00:00Z', 'data', jsonb_build_object('id', 'b' || g))) from generate_series(1, 501) g));
    raise exception 'KO : 501 elements acceptes';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (5.09, '501 elements : appel refuse', 'P0001 rows : 500 elements au plus', v, v like 'P0001 rows : 500%');
end $$;

-- 6. IDEMPOTENCE SANS ÉCRITURE, CONFLIT, server_seq CROISSANT, MAINTENANCE (spec § 3.1 et § 3.4).
--    Pas de `\gset` (c'est du psql, pas l'éditeur) : les valeurs de `server_seq` sont posées dans la table des
--    verdicts, lisibles à l'œil ET comparées par le script lui-même.
insert into pg_temp.preuve
select 6.01, 'premier push de i1', 'accepted 1', v::text, jsonb_array_length(v->'accepted') = 1
from (select public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":1},"updated_at":"2026-10-12T10:00:00Z"}]'::jsonb) as v) t;
insert into pg_temp.preuve
select 6.02, 'server_seq apres le premier push', 'valeur de reference', server_seq::text, server_seq is not null
from public.books where id = 'i1';
insert into pg_temp.preuve
select 6.03, 'push identique : accepte, rien ecrit', 'accepted 1', v::text, jsonb_array_length(v->'accepted') = 1
from (select public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":1},"updated_at":"2026-10-12T10:00:00Z"}]'::jsonb) as v) t;
insert into pg_temp.preuve
select 6.04, 'server_seq inchange apres le push identique', (select obtenu from pg_temp.preuve where ordre = 6.02),
  server_seq::text, server_seq::text = (select obtenu from pg_temp.preuve where ordre = 6.02)
from public.books where id = 'i1';
insert into pg_temp.preuve
select 6.05, 'plus ancien : rejected conflit, avec la ligne du serveur', 'conflit + server', v::text,
      v->'rejected' @> '[{"store":"books","id":"i1","reason":"conflit"}]'::jsonb
  and v->'rejected'->0->'server'->>'updated_at' is not null
  and jsonb_array_length(v->'accepted') = 0
from (select public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":0},"updated_at":"2026-10-12T09:00:00Z"}]'::jsonb) as v) t;
insert into pg_temp.preuve
select 6.06, 'plus recent : accepte', 'accepted 1', v::text, jsonb_array_length(v->'accepted') = 1
from (select public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":2},"updated_at":"2026-10-12T11:00:00Z"}]'::jsonb) as v) t;
-- Preuve franche de R13 : l'`update` de `sync_push` ne nomme pas `server_seq`. S'il augmente, c'est que le
-- déclencheur `touch_server_seq` a tourné sous `authenticated`, malgré la révocation de son `execute` (8.09).
insert into pg_temp.preuve
select 6.07, 'R13 : server_seq augmente alors que lupdate ne le nomme pas',
  'plus grand que ' || (select obtenu from pg_temp.preuve where ordre = 6.02), server_seq::text,
  server_seq > (select obtenu from pg_temp.preuve where ordre = 6.02)::bigint
from public.books where id = 'i1';
select set_config('app.maintenance', 'on', true);
update public.books set data = data || '{"maintenance":true}'::jsonb where id = 'i1';
insert into pg_temp.preuve
select 6.08, 'sous app.maintenance : server_seq inchange malgre une vraie ecriture',
  (select obtenu from pg_temp.preuve where ordre = 6.07), server_seq::text,
  server_seq::text = (select obtenu from pg_temp.preuve where ordre = 6.07)
from public.books where id = 'i1';
insert into pg_temp.preuve
select 6.09, 'ecriture sous maintenance bien effectuee (sinon 6.08 ne prouve rien)', 'true', (data ? 'maintenance')::text,
  data ? 'maintenance' from public.books where id = 'i1';
select set_config('app.maintenance', '', true);

-- 7. public.files : JAMAIS d'octets en base, même par un `insert` direct (spec § 3.3).
do $$
declare v text;
begin
  begin
    insert into public.files (id, data, updated_at) values ('f_blob', '{"sha256":"f_blob","blob":"x"}'::jsonb, now());
    raise exception 'KO : ligne files avec blob acceptee';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (7.01, 'files : la contrainte check refuse un blob', '23514 (check_violation)', v, v like '23514%');
end $$;

-- 8. PRIVILÈGES DES RÔLES DE L'API (spec § 7.2).
reset role;
insert into pg_temp.preuve
select 8.01, 'anon : aucun privilege sur les 25 tables de public', '25 tables, aucun privilege',
  count(*) || ' tables', count(*) = 25 and bool_and(
       not has_table_privilege('anon', 'public.' || tablename, 'select')
   and not has_table_privilege('anon', 'public.' || tablename, 'insert')
   and not has_table_privilege('anon', 'public.' || tablename, 'update')
   and not has_table_privilege('anon', 'public.' || tablename, 'delete'))
from pg_tables where schemaname = 'public';
insert into pg_temp.preuve
select n, etape, att::text, v::text, v = att from (values
  (8.02, 'anon : execute sur public.sync_push(jsonb)', has_function_privilege('anon', 'public.sync_push(jsonb)', 'execute'), false),
  (8.03, 'anon : execute sur public.sync_purge(text, text)', has_function_privilege('anon', 'public.sync_purge(text, text)', 'execute'), false),
  (8.04, 'anon : execute sur public.sync_purge_all()', has_function_privilege('anon', 'public.sync_purge_all()', 'execute'), false),
  (8.05, 'anon : execute sur public.is_allowed()', has_function_privilege('anon', 'public.is_allowed()', 'execute'), false),
  (8.06, 'authenticated : select sur private.allowed_users (hors API)', has_table_privilege('authenticated', 'private.allowed_users', 'select'), false),
  (8.07, 'authenticated : usage sur le schema private (hors API)', has_schema_privilege('authenticated', 'private', 'usage'), false),
  (8.08, 'authenticated : execute sur public.before_user_created(jsonb)', has_function_privilege('authenticated', 'public.before_user_created(jsonb)', 'execute'), false),
  (8.09, 'authenticated : execute sur public.touch_server_seq() (et pourtant le declencheur tourne, 6.07)', has_function_privilege('authenticated', 'public.touch_server_seq()', 'execute'), false),
  (8.10, 'authenticated : execute sur public.enforce_allowed_user()', has_function_privilege('authenticated', 'public.enforce_allowed_user()', 'execute'), false),
  (8.11, 'authenticated : execute sur public.purge_tombstones()', has_function_privilege('authenticated', 'public.purge_tombstones()', 'execute'), false),
  (8.12, 'supabase_auth_admin : execute sur public.before_user_created(jsonb)', has_function_privilege('supabase_auth_admin', 'public.before_user_created(jsonb)', 'execute'), true),
  (8.13, 'supabase_auth_admin : usage sur le schema public', has_schema_privilege('supabase_auth_admin', 'public', 'usage'), true),
  (8.14, 'authenticated : execute sur public.sync_push(jsonb)', has_function_privilege('authenticated', 'public.sync_push(jsonb)', 'execute'), true),
  (8.15, 'authenticated : execute sur public.sync_purge(text, text)', has_function_privilege('authenticated', 'public.sync_purge(text, text)', 'execute'), true),
  (8.16, 'authenticated : execute sur public.sync_purge_all()', has_function_privilege('authenticated', 'public.sync_purge_all()', 'execute'), true)
) as x(n, etape, v, att);

-- 9. ADRESSE RETIRÉE DE LA LISTE (spec § 3.2) : plus rien à la requête suivante, et `sync_push` LÈVE au lieu de
--    rendre des rejets « forme » — l'autorisation est contrôlée une fois, en tête de la fonction.
with d as (delete from private.allowed_users where email = 'B_EMAIL' returning 1)
insert into pg_temp.preuve select 9.01, 'B retire de private.allowed_users', '1', count(*)::text, count(*) = 1 from d;
set local role authenticated;
set local request.jwt.claims = '{"sub":"B_UUID","email":"B_EMAIL","role":"authenticated"}';
insert into pg_temp.preuve
select 9.02, 'B ne voit plus rien (il voyait sa ligne en 3.07)', '0', count(*)::text, count(*) = 0
from public.books where id = 'b_commun';
do $$
declare v text;
begin
  begin
    perform public.sync_push('[{"store":"books","id":"b_apres","data":{"id":"b_apres"},"updated_at":"2026-10-12T10:00:00Z"}]'::jsonb);
    raise exception 'KO : sync_push accepte une personne retiree de la liste';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (9.03, 'sync_push leve pour une personne retiree, au lieu de rendre des rejets forme', 'P0001 adresse non autorisee', v, v like 'P0001 adresse non autoris%');
end $$;
reset role;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Dernière instruction : tout est annulé. Ni compte, ni fiche, ni adresse retirée ne survit à cette preuve.
rollback;
