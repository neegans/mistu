-- Preuve 0004 — spec docs/superpowers/specs/2026-10-18-passerelle-assistant-design.md § 4. À coller dans l'éditeur SQL
-- de Supabase APRÈS `migrations/0004_assistant_journal.sql` (étape 10 de `supabase/README.md`).
--
-- AUCUN jeton à remplacer et AUCUNE adresse à ajouter : cette preuve ne touche pas à la liste des adresses admises.
-- Pour le seul verdict 3.01 (une ligne de journal, puis la vue qui la compte), elle EMPRUNTE le compte le plus ancien
-- de `auth.users` — sans jamais le nommer ni l'afficher : le verdict ne montre que « appels = 1 ». Si `auth.users`
-- est vide, ce verdict est sauté (« aucun compte : etape sautee », vert). Tout est annulé à la dernière instruction :
-- la ligne de preuve ne survit pas, et la preuve est rejouable telle quelle.
--
-- Même lecture que les preuves 0001 et 0003 : l'éditeur n'affiche qu'UN tableau (la table des verdicts) ; lis d'abord
-- la ligne 999 « BILAN » (`ok = true` = aucun verdict faux). Au dialogue « Potential issue detected » du tableau de
-- bord, choisis « Run without RLS » (l'autre bouton ajoute une instruction APRÈS le rollback, qui échoue : README,
-- étape 5). Si une instruction échoue, l'éditeur annule tout et le message d'erreur est la seule sortie : corrige,
-- puis recolle le fichier entier.
--
-- Ce que la preuve ne dit pas : que la fonction « assistant » écrit bien dans ce journal. Cela se prouve par les
-- sondes du déploiement (README, étape 10) ; ici, on prouve que le journal est fermé aux clients et ouvert à la clé
-- secrète du projet (verdict 1.09), et que la réservation d'un appel (assistant_reserver) est fermée aux clients, ouverte
-- à cette clé, et refuse un appel de trop (verdicts 1.10, 1.11, 2.04, 3.04). La CONCURRENCE elle-même (deux appels
-- simultanés) ne se prouve pas dans l'éditeur : une seule session, et les verrous consultatifs y sont réentrants.

begin;

-- 0. Gardes de lecture : un échec ici dit quoi faire, au lieu de laisser une erreur Postgres opaque.
do $$
begin
  if to_regclass('public.assistant_journal') is null then
    raise exception 'public.assistant_journal absente : colle d''abord supabase/migrations/0004_assistant_journal.sql (etape 10 du README)';
  end if;
  if to_regclass('public.assistant_usage_jour') is null then
    raise exception 'public.assistant_usage_jour absente : 0004 na pas ete collee en entier (etape 10 du README)';
  end if;
  if to_regprocedure('public.assistant_reserver(uuid,text,integer,integer)') is null then
    raise exception 'public.assistant_reserver absente : 0004 na pas ete collee en entier (etape 10 du README)';
  end if;
end $$;

-- La table des verdicts, temporaire (elle meurt avec la session, et de toute façon avec le rollback).
create temporary table preuve (ordre numeric primary key, etape text, attendu text, obtenu text, ok boolean);
grant insert, select on table pg_temp.preuve to authenticated;
-- Même ceinture que les preuves 0001 et 0003 (verdict 0.01) : `usage` sur le schéma temporaire, tenté sous protection.
do $$
declare v text := 'accorde explicitement';
begin
  begin
    execute format('grant usage on schema %I to authenticated',
      (select nspname from pg_namespace where oid = pg_my_temp_schema()));
  exception when others then
    v := 'grant refuse (' || sqlstate || ') : on compte sur lUSAGE implicite du schema temporaire';
  end;
  insert into pg_temp.preuve values (0.01, 'usage sur le schema temporaire pour authenticated', 'accorde ou implicite', v, true);
end $$;

-- 1. LA TABLE, SA VUE ET LEURS PRIVILÈGES (spec § 4). Fermées aux clients : RLS sans règle ET plus aucun privilège.
insert into pg_temp.preuve
select 1.01, 'public.assistant_journal presente, RLS activee', 'true', coalesce(v::text, 'absente'), coalesce(v, false)
from (select (select relrowsecurity from pg_class where oid = to_regclass('public.assistant_journal')) as v) t;
insert into pg_temp.preuve
select 1.02, 'aucune regle (policy) sur assistant_journal', '0', count(*)::text, count(*) = 0
from pg_policies where schemaname = 'public' and tablename = 'assistant_journal';
insert into pg_temp.preuve
select 1.03, 'anon et authenticated : aucun privilege sur la table', 'false / false', a::text || ' / ' || b::text, not a and not b
from (select has_table_privilege('anon', 'public.assistant_journal', 'select, insert, update, delete, truncate, references, trigger') as a,
             has_table_privilege('authenticated', 'public.assistant_journal', 'select, insert, update, delete, truncate, references, trigger') as b) t;
insert into pg_temp.preuve
select 1.04, 'index assistant_journal_owner_jour (owner_id, jour)', '1', count(*)::text, count(*) = 1
from pg_indexes where schemaname = 'public' and tablename = 'assistant_journal' and indexname = 'assistant_journal_owner_jour'
  and indexdef like '%(owner_id, jour)';
insert into pg_temp.preuve
select 1.05, 'vue assistant_usage_jour presente, en security invoker', 'true', coalesce(v::text, 'absente'), coalesce(v, false)
from (select (select 'security_invoker=true' = any (reloptions) from pg_class
              where oid = to_regclass('public.assistant_usage_jour') and relkind = 'v') as v) t;
insert into pg_temp.preuve
select 1.06, 'anon et authenticated : aucun privilege sur la vue', 'false / false', a::text || ' / ' || b::text, not a and not b
from (select has_table_privilege('anon', 'public.assistant_usage_jour', 'select, insert, update, delete, truncate, references, trigger') as a,
             has_table_privilege('authenticated', 'public.assistant_usage_jour', 'select, insert, update, delete, truncate, references, trigger') as b) t;
insert into pg_temp.preuve
select 1.07, 'anon et authenticated : aucun privilege sur la sequence de id', 'false / false', a::text || ' / ' || b::text, not a and not b
from (select has_sequence_privilege('anon', 'public.assistant_journal_id_seq', 'usage, select, update') as a,
             has_sequence_privilege('authenticated', 'public.assistant_journal_id_seq', 'usage, select, update') as b) t;
insert into pg_temp.preuve
select 1.08, 'owner_id references auth.users on delete cascade', '1', count(*)::text, count(*) = 1
from pg_constraint where conrelid = to_regclass('public.assistant_journal') and contype = 'f'
  and confrelid = 'auth.users'::regclass and confdeltype = 'c';
-- La clé secrète du projet (rôle service_role : c'est elle qui écrit et lit ce journal) garde ses droits, sinon la
-- fonction répondrait 502 au premier comptage. L'id est un bigserial : l'insertion de la réservation appelle nextval, donc
-- exige aussi USAGE sur la séquence (un `revoke` trop large sur les séquences casserait chaque appel).
insert into pg_temp.preuve
select 1.09, 'service_role : select, insert, update sur la table, select sur la vue, usage sur la sequence de id', 'true / true / true / true / true',
  s::text || ' / ' || i::text || ' / ' || u::text || ' / ' || v::text || ' / ' || q::text, s and i and u and v and q
from (select has_table_privilege('service_role', 'public.assistant_journal', 'select') as s,
             has_table_privilege('service_role', 'public.assistant_journal', 'insert') as i,
             has_table_privilege('service_role', 'public.assistant_journal', 'update') as u,
             has_table_privilege('service_role', 'public.assistant_usage_jour', 'select') as v,
             has_sequence_privilege('service_role', 'public.assistant_journal_id_seq', 'usage') as q) t;
-- La réservation atomique d'un appel : security invoker (les droits du seul appelant), volatile, search_path fixé ;
-- exécutable par la clé secrète du projet seulement.
insert into pg_temp.preuve
select 1.10, 'assistant_reserver : security invoker, volatile, search_path fixe', 'false / v / true',
  d::text || ' / ' || v || ' / ' || c::text, not d and v = 'v' and c
from (select p.prosecdef as d, p.provolatile::text as v,
             exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%') as c
      from pg_proc p where p.oid = to_regprocedure('public.assistant_reserver(uuid,text,integer,integer)')) t;
insert into pg_temp.preuve
select 1.11, 'assistant_reserver : execute refuse a anon et authenticated, accorde a service_role', 'false / false / true',
  a::text || ' / ' || b::text || ' / ' || c::text, not a and not b and c
from (select has_function_privilege('anon', 'public.assistant_reserver(uuid,text,integer,integer)', 'execute') as a,
             has_function_privilege('authenticated', 'public.assistant_reserver(uuid,text,integer,integer)', 'execute') as b,
             has_function_privilege('service_role', 'public.assistant_reserver(uuid,text,integer,integer)', 'execute') as c) t;

-- 2. LES REFUS, JOUÉS COMME UN CLIENT (spec § 4). Sous `authenticated`, avec la session d'un compte existant (jamais
--    nommé), lecture et écriture lèvent 42501 : l'erreur est attrapée et son code est le verdict. Le privilège est
--    vérifié avant la règle de ligne, donc le jeton de session n'y change rien ; il est posé pour que la preuve
--    ressemble à un vrai client. Les identifiants de la requête ne sont jamais affichés.
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', coalesce((select id::text from auth.users order by created_at limit 1), '00000000-0000-0000-0000-000000000000'),
                      'role', 'authenticated')::text, true);
end $$;
set local role authenticated;
do $$
declare v text;
begin
  begin
    perform count(*) from public.assistant_journal;
    v := 'AUCUNE ERREUR : la lecture a ete permise';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values (2.01, 'authenticated : select count(*) sur assistant_journal est refuse', '42501 (permission denied)', v, v like '42501%');
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values ('00000000-0000-0000-0000-000000000000', 'creation', 200, current_date);
    v := 'AUCUNE ERREUR : l ecriture a ete permise';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values (2.02, 'authenticated : insert dans assistant_journal est refuse', '42501 (permission denied)', v, v like '42501%');
  begin
    perform count(*) from public.assistant_usage_jour;
    v := 'AUCUNE ERREUR : la lecture de la vue a ete permise';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values (2.03, 'authenticated : select sur assistant_usage_jour est refuse', '42501 (permission denied)', v, v like '42501%');
  begin
    perform public.assistant_reserver('00000000-0000-0000-0000-000000000000', 'creation', 1, 5);
    v := 'AUCUNE ERREUR : la reservation a ete permise';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values (2.04, 'authenticated : l appel de assistant_reserver est refuse', '42501 (permission denied)', v, v like '42501%' and (v like '%assistant_reserver%' or v like '%function%'));
end $$;
reset role;

-- 3. LA LIGNE ET LA VUE, VUES DE `postgres` (propriétaire de la table, donc hors RLS). La ligne de preuve porte un jour
--    d'il y a longtemps (2000-01-01) : de vraies lignes du même compte, d'aujourd'hui, ne faussent donc pas « appels = 1 ».
--    Le compte emprunté est le plus ancien de `auth.users` ; il n'est jamais affiché. Tout est annulé au rollback final.
do $$
declare uid uuid; n bigint; e bigint; s bigint; v text; c bigint; r1 bigint; r2 bigint;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    insert into pg_temp.preuve values
      (3.01, 'sous postgres : une ligne de journal, puis assistant_usage_jour la compte', 'appels = 1', 'aucun compte : etape sautee', true),
      (3.02, 'la vue additionne les jetons de la ligne', 'jetons 10 / 20', 'aucun compte : etape sautee', true),
      (3.03, 'un outil hors liste est refuse par le check', '23514', 'aucun compte : etape sautee', true),
      (3.04, 'assistant_reserver : un id tant que le quota n est pas atteint, puis null', 'id non nul, puis null', 'aucun compte : etape sautee', true);
    return;
  end if;
  insert into public.assistant_journal (owner_id, outil, statut, jetons_entree, jetons_sortie, duree_ms, octets, jour)
    values (uid, 'creation', 200, 10, 20, 1234, 99, date '2000-01-01');
  select appels, jetons_entree, jetons_sortie into n, e, s
    from public.assistant_usage_jour where owner_id = uid and jour = date '2000-01-01';
  insert into pg_temp.preuve values
    (3.01, 'sous postgres : une ligne de journal, puis assistant_usage_jour la compte', 'appels = 1', 'appels = ' || coalesce(n::text, 'aucune ligne'), n = 1),
    (3.02, 'la vue additionne les jetons de la ligne', 'jetons 10 / 20', 'jetons ' || coalesce(e::text, '?') || ' / ' || coalesce(s::text, '?'), e = 10 and s = 20);
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'inconnu', 200, date '2000-01-01');
    v := 'AUCUNE ERREUR : un outil hors liste a ete accepte';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (3.03, 'un outil hors liste est refuse par le check', '23514', v, v = '23514');
  -- La réservation : avec un quota d'un appel de plus que le compte du jour UTC, le premier appel rend un id, le second
  -- (même quota) rend null. Les deux lignes « en vol » créées ici sont annulées au rollback final.
  select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;
  r1 := public.assistant_reserver(uid, 'creation', 1, c::integer + 1);
  r2 := public.assistant_reserver(uid, 'creation', 1, c::integer + 1);
  insert into pg_temp.preuve values (3.04, 'assistant_reserver : un id tant que le quota n est pas atteint, puis null', 'id non nul, puis null',
    'id ' || case when r1 is null then 'null' else 'non nul' end || ', puis ' || case when r2 is null then 'null' else 'NON NUL' end,
    r1 is not null and r2 is null);
end $$;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Dernière instruction : tout est annulé. Ni la ligne de preuve, ni la table des verdicts ne survit.
rollback;
