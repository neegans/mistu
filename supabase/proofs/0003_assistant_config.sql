-- Preuve 0003 — spec docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md § 6.3. À coller dans
-- l'éditeur SQL de Supabase APRÈS `migrations/0003_assistant_config.sql` ET APRÈS l'insertion des deux adresses de
-- preuve dans `private.allowed_users` (étape 8 bis de `supabase/README.md`).
--
-- AVANT DE COLLER, remplace les quatre jetons partout dans le fichier (Cmd-F, « Tout remplacer ») :
--   A_UUID, B_UUID   : deux uuid au hasard, distincts (`select gen_random_uuid();` en donne un)
--   A_EMAIL, B_EMAIL : les deux adresses de preuve (domaine réservé exemple.invalid) que tu viens d'ajouter à
--                      `private.allowed_users`, EN MINUSCULES, et qui n'ont pas de compte dans `auth.users`
-- Ne recolle jamais le fichier modifié dans le dépôt : il contiendrait tes adresses.
--
-- RÈGLE DE LECTURE (spec § 7, S7). Cette preuve ne lit ni n'affiche JAMAIS la colonne `data` de
-- `public.assistant_config` : seulement la longueur de la clé, `length(data->>'api_key')`, et la fiche privée de sa
-- clé, `data - 'api_key'`, comparée sans être affichée. Les clés poussées sont FACTICES (« sk-factice-… ») ; la règle
-- vaut quand même ici, pour qu'elle vaille partout. Attention : la réponse de `sync_push` à un conflit porte la ligne
-- du serveur (`server.data`, donc la clé) ; elle n'est donc jamais affichée telle quelle, seulement ses compteurs et
-- son motif. `RESULTATS-mitsu.md` vit dans un dépôt public : rien de `data` n'y entre.
--
-- Même lecture que la preuve 0001 : l'éditeur n'affiche qu'UN tableau (la table des verdicts) ; lis d'abord la ligne
-- 999 « BILAN » (`ok = true` = aucun verdict faux). Au dialogue « Potential issue detected » du tableau de bord,
-- choisis « Run without RLS » (l'autre bouton ajoute une instruction APRÈS le rollback, qui échoue : README, étape 5).
-- Tout se joue dans une transaction annulée à la dernière instruction : la preuve ne laisse RIEN (ni compte,
-- ni ligne de configuration) et elle est rejouable telle quelle. Si une instruction échoue, l'éditeur annule tout et
-- le message d'erreur est la seule sortie : corrige, puis recolle le fichier entier.

begin;

-- 0. Gardes de lecture : un échec ici dit quoi faire, au lieu de laisser une erreur Postgres opaque.
do $$
begin
  if to_regclass('public.assistant_config') is null then
    raise exception 'public.assistant_config absente : colle d''abord supabase/migrations/0003_assistant_config.sql (etape 8 bis du README)';
  end if;
  if position('''assistant_config''' in pg_get_functiondef('public.sync_push(jsonb)'::regprocedure)) = 0 then
    raise exception 'sync_push ne connait pas assistant_config : 0003 na pas ete collee en entier (etape 8 bis du README)';
  end if;
  if (select count(*) from private.allowed_users where email in ('A_EMAIL', 'B_EMAIL')) <> 2 then
    raise exception 'A_EMAIL et B_EMAIL doivent etre dans private.allowed_users, en minuscules (etape 8 bis du README)';
  end if;
  if exists (select 1 from auth.users where email in ('A_EMAIL', 'B_EMAIL')) then
    raise exception 'une de ces adresses a deja un compte : auth.users refuse un doublon de courriel. Prends deux adresses de preuve du domaine exemple.invalid (README, etape 8 bis)';
  end if;
end $$;

-- La table des verdicts, temporaire (elle meurt avec la session, et de toute façon avec le rollback). Le `primary
-- key` sur `ordre` interdit deux preuves au même numéro.
create temporary table preuve (ordre numeric primary key, etape text, attendu text, obtenu text, ok boolean);
grant insert, select on table pg_temp.preuve to authenticated;
-- Même ceinture que la preuve 0001 (verdict 0.01) : `usage` sur le schéma temporaire, tenté sous protection.
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

-- Les deux comptes de preuve (annulés par le rollback final). Le déclencheur B1 les laisse passer : leurs adresses
-- sont dans la liste (garde 0).
insert into auth.users (id, email, instance_id, aud, role)
  values ('A_UUID', 'A_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into auth.users (id, email, instance_id, aud, role)
  values ('B_UUID', 'B_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into pg_temp.preuve
select 0.02, 'deux comptes de preuve crees (annules au rollback)', '2', count(*)::text, count(*) = 2
from auth.users where id in ('A_UUID', 'B_UUID');

-- 1. LA TABLE NEUVE (spec § 4.2) : même gabarit que les 25 autres.
insert into pg_temp.preuve
select 1.01, 'public.assistant_config presente, RLS activee', 'true', coalesce(v::text, 'absente'), coalesce(v, false)
from (select (select relrowsecurity from pg_class where oid = to_regclass('public.assistant_config')) as v) t;
insert into pg_temp.preuve
select 1.02, 'quatre regles : une par commande, pour authenticated, is_allowed et owner_id partout, delete sous app.purge',
  '4 : DELETE, INSERT, SELECT, UPDATE / {authenticated} / delete sous app.purge',
  count(*) || ' : ' || coalesce(string_agg(cmd, ', ' order by cmd), 'aucune') || ' / ' || coalesce(string_agg(distinct roles::text, ' '), 'aucun')
    || ' / ' || case when coalesce(bool_or(cmd = 'DELETE' and qual like '%app.purge%'), false) then 'delete sous app.purge' else 'delete NON garde' end,
  count(*) = 4 and string_agg(cmd, ', ' order by cmd) = 'DELETE, INSERT, SELECT, UPDATE'
  and bool_and(roles::text[] = array['authenticated'])
  and bool_and(coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%is_allowed%'
           and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%owner_id%'
           and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%uid%')
  and coalesce(bool_or(cmd = 'DELETE' and qual like '%app.purge%'), false)
from pg_policies where schemaname = 'public' and tablename = 'assistant_config';
insert into pg_temp.preuve
select 1.03, 'declencheur assistant_config_seq -> public.touch_server_seq(), actif', '1', count(*)::text, count(*) = 1
from pg_trigger where tgrelid = to_regclass('public.assistant_config') and tgname = 'assistant_config_seq'
  and tgfoid = 'public.touch_server_seq()'::regprocedure and not tgisinternal and tgenabled <> 'D';
insert into pg_temp.preuve
select 1.04, 'index assistant_config_recv (owner_id, server_seq)', '1', count(*)::text, count(*) = 1
from pg_indexes where schemaname = 'public' and tablename = 'assistant_config' and indexname = 'assistant_config_recv'
  and indexdef like '%(owner_id, server_seq)';
insert into pg_temp.preuve
select 1.05, 'cle primaire composee (owner_id, id) : elle isole les comptes (S8)', '1', count(*)::text, count(*) = 1
from pg_indexes where schemaname = 'public' and tablename = 'assistant_config' and indexname = 'assistant_config_pkey'
  and indexdef like 'CREATE UNIQUE INDEX%(owner_id, id)';
insert into pg_temp.preuve
select 1.06, 'owner_id references auth.users on delete cascade', '1', count(*)::text, count(*) = 1
from pg_constraint where conrelid = to_regclass('public.assistant_config') and contype = 'f'
  and confrelid = 'auth.users'::regclass and confdeltype = 'c';

-- 2. PRIVILÈGES (spec § 6.3, S4). `authenticated` tient ses droits des `alter default privileges` du projet (0003
--    collée sous `postgres`, comme 0001) ; `anon` les aurait reçus de la même façon, d'où le `revoke` de 0003 : le
--    `revoke … on all tables` de 0001 ne couvrait que les 25 tables d'alors. 2.02 reprend l'expression de 8.01 (0001),
--    relue à 26, et y ajoute les trois privilèges que 8.01 ne nommait pas.
insert into pg_temp.preuve
select 2.01, 'authenticated : select, insert, update sur public.assistant_config', 'true / true / true',
  s::text || ' / ' || i::text || ' / ' || u::text, s and i and u
from (select has_table_privilege('authenticated', 'public.assistant_config', 'select') as s,
             has_table_privilege('authenticated', 'public.assistant_config', 'insert') as i,
             has_table_privilege('authenticated', 'public.assistant_config', 'update') as u) t;
insert into pg_temp.preuve
select 2.02, 'anon : aucun privilege sur les 26 tables de public', '26 tables, 0 avec un privilege anon',
  count(*) || ' tables, ' || count(*) filter (where has_table_privilege('anon', 'public.' || tablename, 'select, insert, update, delete, truncate, references, trigger')) || ' avec un privilege anon',
  count(*) = 26 and bool_and(
       not has_table_privilege('anon', 'public.' || tablename, 'select')
   and not has_table_privilege('anon', 'public.' || tablename, 'insert')
   and not has_table_privilege('anon', 'public.' || tablename, 'update')
   and not has_table_privilege('anon', 'public.' || tablename, 'delete')
   and not has_table_privilege('anon', 'public.' || tablename, 'truncate, references, trigger'))
from pg_tables where schemaname = 'public';
insert into pg_temp.preuve
select n, etape, att::text, v::text, v = att from (values
  (2.03, 'anon : execute sur public.sync_push(jsonb)', has_function_privilege('anon', 'public.sync_push(jsonb)', 'execute'), false),
  (2.04, 'anon : execute sur public.sync_purge(text, text)', has_function_privilege('anon', 'public.sync_purge(text, text)', 'execute'), false),
  (2.05, 'anon : execute sur public.sync_purge_all()', has_function_privilege('anon', 'public.sync_purge_all()', 'execute'), false),
  (2.06, 'anon : execute sur public.purge_tombstones()', has_function_privilege('anon', 'public.purge_tombstones()', 'execute'), false),
  (2.07, 'authenticated : execute sur public.sync_push(jsonb)', has_function_privilege('authenticated', 'public.sync_push(jsonb)', 'execute'), true),
  (2.08, 'authenticated : execute sur public.sync_purge(text, text)', has_function_privilege('authenticated', 'public.sync_purge(text, text)', 'execute'), true),
  (2.09, 'authenticated : execute sur public.sync_purge_all()', has_function_privilege('authenticated', 'public.sync_purge_all()', 'execute'), true),
  (2.10, 'authenticated : execute sur public.purge_tombstones()', has_function_privilege('authenticated', 'public.purge_tombstones()', 'execute'), false)
) as x(n, etape, v, att);
insert into pg_temp.preuve
select 2.11, 'les 26 tables synchronisees de public ont toutes la RLS activee', '26', count(*)::text, count(*) = 26
from pg_class c join pg_namespace s on s.oid = c.relnamespace
where s.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity;

-- 3. A POUSSE ET RELIT SA CONFIGURATION. La clé factice de 3.01 compte 17 caractères (« sk-factice-preuve ») ;
--    celle de 3.04, plus ancienne, 19 ; celle de 3.06, plus récente, 25. Seules ces longueurs sont relues.
set local role authenticated;
set local request.jwt.claims = '{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}';
insert into pg_temp.preuve
select 3.01, 'A pousse sa configuration llm (cle factice)', 'accepted 1, adjusted 0, rejected 0',
  'accepted ' || jsonb_array_length(reponse->'accepted') || ', adjusted ' || jsonb_array_length(reponse->'adjusted') || ', rejected ' || jsonb_array_length(reponse->'rejected'),
  jsonb_array_length(reponse->'accepted') = 1 and jsonb_array_length(reponse->'adjusted') = 0 and jsonb_array_length(reponse->'rejected') = 0
  and reponse->'accepted' @> '[{"store":"assistant_config","id":"llm"}]'::jsonb
from (select public.sync_push('[{"store":"assistant_config","id":"llm","data":{"id":"llm","provider":"anthropic","model":"m","base_url":"","api_key":"sk-factice-preuve"},"updated_at":"2026-10-17T10:00:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 3.02, 'A relit sa ligne par owner_id : une ligne, cle de 17 caracteres (jamais la valeur)', '1 ligne, cle de 17',
  count(*) || ' ligne, cle de ' || coalesce(max(length(data->>'api_key'))::text, 'rien'),
  count(*) = 1 and max(length(data->>'api_key')) = 17
from public.assistant_config where owner_id = auth.uid() and id = 'llm';
insert into pg_temp.preuve
select 3.03, 'le reste de la fiche est celui qui a ete pousse (compare sans etre affiche)', 'conforme',
  case when bool_and((data - 'api_key') = '{"id":"llm","provider":"anthropic","model":"m","base_url":""}'::jsonb) then 'conforme' else 'different' end,
  coalesce(bool_and((data - 'api_key') = '{"id":"llm","provider":"anthropic","model":"m","base_url":""}'::jsonb), false)
from public.assistant_config where owner_id = auth.uid() and id = 'llm';
-- Le conflit se prouve sur le MÊME compte (S8) : la clé primaire composée isole les comptes, donc B ne peut pas
-- entrer en conflit avec A (4.02). La réponse porte `server.data` : seuls le compte et le motif sont affichés.
insert into pg_temp.preuve
select 3.04, 'A pousse llm PLUS ANCIEN avec une autre cle factice : rejete, motif conflit', 'rejected 1, motif conflit, accepted 0',
  'rejected ' || jsonb_array_length(reponse->'rejected') || ', motif ' || coalesce(reponse->'rejected'->0->>'reason', 'aucun') || ', accepted ' || jsonb_array_length(reponse->'accepted'),
  jsonb_array_length(reponse->'rejected') = 1 and reponse->'rejected'->0->>'reason' = 'conflit'
  and reponse->'rejected'->0->>'store' = 'assistant_config' and reponse->'rejected'->0->>'id' = 'llm' and jsonb_array_length(reponse->'accepted') = 0
from (select public.sync_push('[{"store":"assistant_config","id":"llm","data":{"id":"llm","provider":"anthropic","model":"m","base_url":"","api_key":"sk-factice-ancienne"},"updated_at":"2026-10-17T09:00:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 3.05, 'apres le conflit, la cle est toujours celle de 3.01', 'cle de 17',
  'cle de ' || coalesce(max(length(data->>'api_key'))::text, 'rien'), max(length(data->>'api_key')) = 17
from public.assistant_config where owner_id = auth.uid() and id = 'llm';
insert into pg_temp.preuve
select 3.06, 'A pousse llm PLUS RECENT (cle tournee, factice) : accepte', 'accepted 1, rejected 0',
  'accepted ' || jsonb_array_length(reponse->'accepted') || ', rejected ' || jsonb_array_length(reponse->'rejected'),
  jsonb_array_length(reponse->'accepted') = 1 and jsonb_array_length(reponse->'rejected') = 0
from (select public.sync_push('[{"store":"assistant_config","id":"llm","data":{"id":"llm","provider":"anthropic","model":"m","base_url":"","api_key":"sk-factice-preuve-tournee"},"updated_at":"2026-10-17T11:00:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 3.07, 'la cle a change : longueur 25 au lieu de 17, toujours une seule ligne', '1 ligne, cle de 25',
  count(*) || ' ligne, cle de ' || coalesce(max(length(data->>'api_key'))::text, 'rien'),
  count(*) = 1 and max(length(data->>'api_key')) = 25
from public.assistant_config where owner_id = auth.uid() and id = 'llm';

-- 4. B NE VOIT RIEN DE A, ET A SA PROPRE LIGNE « llm ». Sa clé factice compte 12 caractères (« sk-factice-b »), et
--    son horodatage est PLUS ANCIEN que celui de A : il est accepté quand même, parce que ce n'est pas la même ligne.
set local request.jwt.claims = '{"sub":"B_UUID","email":"B_EMAIL","role":"authenticated"}';
insert into pg_temp.preuve
select 4.01, 'B ne voit rien de A', '0', count(*)::text, count(*) = 0 from public.assistant_config;
insert into pg_temp.preuve
select 4.02, 'B pousse son propre llm (plus ancien que celui de A) : accepte', 'accepted 1, rejected 0',
  'accepted ' || jsonb_array_length(reponse->'accepted') || ', rejected ' || jsonb_array_length(reponse->'rejected'),
  jsonb_array_length(reponse->'accepted') = 1 and jsonb_array_length(reponse->'rejected') = 0
from (select public.sync_push('[{"store":"assistant_config","id":"llm","data":{"id":"llm","provider":"anthropic","model":"m","base_url":"","api_key":"sk-factice-b"},"updated_at":"2026-10-17T08:00:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 4.03, 'B ne voit que SA ligne : une ligne, cle de 12', '1 ligne, cle de 12',
  count(*) || ' ligne, cle de ' || coalesce(max(length(data->>'api_key'))::text, 'rien'),
  count(*) = 1 and max(length(data->>'api_key')) = 12
from public.assistant_config;
do $$
declare v text;
begin
  begin
    insert into public.assistant_config (owner_id, id, data, updated_at) values ('A_UUID', 'llm_pirate', '{"id":"llm_pirate"}'::jsonb, now());
    raise exception 'KO : insert chez A accepte';
  exception when others then v := sqlstate || ' ' || sqlerrm;
  end;
  insert into pg_temp.preuve values
    (4.04, 'B ne peut pas ecrire chez A', '42501 (refus de la regle)', v, v like '42501%');
end $$;
with u as (update public.assistant_config set updated_at = updated_at where owner_id = 'A_UUID' returning 1)
insert into pg_temp.preuve
select 4.05, 'B ne peut pas modifier la ligne de A : aucune ligne touchee', '0', count(*)::text, count(*) = 0 from u;

-- Vu de `postgres` (propriétaire de la table, donc hors RLS) : deux lignes « llm », deux propriétaires, rien de
-- piraté. Toujours sans lire `data`. Hors RLS, la table contient AUSSI les vraies lignes « llm » des comptes réels
-- (dès le premier envoi de l'app) : chaque compte est donc borné aux deux comptes de preuve.
reset role;
insert into pg_temp.preuve
select 4.06, 'meme id llm chez les deux comptes de preuve (vu de postgres : hors RLS)', '2 lignes, 2 proprietaires',
  count(*) || ' lignes, ' || count(distinct owner_id) || ' proprietaires', count(*) = 2 and count(distinct owner_id) = 2
from public.assistant_config where id = 'llm' and owner_id in ('A_UUID', 'B_UUID');
insert into pg_temp.preuve
select 4.07, 'aucune ligne piratee chez les deux comptes de preuve', '0', count(*)::text, count(*) = 0
from public.assistant_config where id = 'llm_pirate' and owner_id in ('A_UUID', 'B_UUID');

-- 5. SUPPRESSION DIRECTE (comme 4.01 de 0001) : la règle delete n'est franchissable que sous `app.purge`. Aucune purge
--    n'a été jouée plus haut ; le drapeau est remis à vide quand même, pour que le verdict ne dépende pas de l'ordre.
--    Le `delete` ne lève pas : il ne supprime rien.
set local role authenticated;
set local request.jwt.claims = '{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}';
select set_config('app.purge', '', true);
with d as (delete from public.assistant_config where id = 'llm' returning 1)
insert into pg_temp.preuve
select 5.01, 'delete direct de A, sans app.purge : aucune ligne supprimee, sans erreur', '0', count(*)::text, count(*) = 0 from d;
insert into pg_temp.preuve
select 5.02, 'A garde sa ligne apres le delete', '1', count(*)::text, count(*) = 1 from public.assistant_config where id = 'llm';
reset role;

-- 6. LES QUATRE FONCTIONS RECRÉÉES (spec § 6.1) : chacune liste 26 magasins, et la liste finit par 'files',
--    'assistant_config' (K-9 : la table neuve est la dernière). Le premier `array[` de chaque corps est la constante
--    `stores`. La garde 0 a déjà vu 'assistant_config' dans `sync_push` ; 6.01 en vérifie en plus le nombre et la place.
--    `to_regprocedure` rend NULL (au lieu de lever) pour une fonction absente : chaque NULL donne un verdict FAUX.
insert into pg_temp.preuve
select n, f || ' : 26 magasins, la liste finit par files, assistant_config', '26 / true',
  coalesce(nb::text, 'aucune liste') || ' / ' || coalesce(fin::text, 'fonction absente'), coalesce(nb = 26 and fin, false)
from (values
  (6.01, 'public.sync_push(jsonb)'),
  (6.02, 'public.sync_purge(text, text)'),
  (6.03, 'public.sync_purge_all()'),
  (6.04, 'public.purge_tombstones()')
) as x(n, f),
lateral (select pg_get_functiondef(to_regprocedure(f)) as d) y,
lateral (select array_length(string_to_array(split_part(split_part(y.d, 'array[', 2), ']', 1), ', '), 1) as nb,
                position('''files'', ''assistant_config'']' in y.d) > 0 as fin) z;
insert into pg_temp.preuve
select 6.05, 'sync_push : keys et required connaissent assistant_config', 'true / true',
  coalesce((position('"assistant_config":"id"' in d) > 0)::text || ' / ' || (position('"assistant_config":[]' in d) > 0)::text, 'fonction absente'),
  coalesce(position('"assistant_config":"id"' in d) > 0 and position('"assistant_config":[]' in d) > 0, false)
from (select pg_get_functiondef(to_regprocedure('public.sync_push(jsonb)')) as d) t;

-- 7. JOURNAUX DE POSTGRES (S9 : le « non mesuré » du § 7 devient une mesure). Verdicts INFORMATIFS : `ok = true`
--    quelle que soit la valeur, qui est simplement relevée. Lecture d'après la documentation de PostgreSQL :
--    `log_min_error_statement` = à partir de quel niveau une instruction en erreur est journalisée avec son texte ;
--    `log_parameter_max_length_on_error` = paramètres liés recopiés dans ces messages (0 : aucun ; -1 : en entier) ;
--    `log_statement`, `log_min_duration_statement` et `log_parameter_max_length` disent si une instruction QUI
--    RÉUSSIT peut être journalisée, et avec quelle part de ses paramètres (l'envoi passe la fiche, donc la clé, en
--    paramètre de `sync_push`). Une valeur illisible pour `postgres` est notée comme telle, sans arrêter la preuve.
do $$
declare nom text; v text; n numeric := 7.00;
begin
  foreach nom in array array['log_min_error_statement', 'log_parameter_max_length_on_error', 'log_statement',
                             'log_min_duration_statement', 'log_parameter_max_length'] loop
    n := n + 0.01;
    begin
      v := coalesce(current_setting(nom, true), 'absent de ce serveur');
    exception when others then v := 'illisible (' || sqlstate || ')';
    end;
    insert into pg_temp.preuve values (n, nom || ' (informatif)', 'valeur relevee', v, true);
  end loop;
end $$;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Dernière instruction : tout est annulé. Ni compte, ni ligne de configuration ne survit à cette preuve.
rollback;
