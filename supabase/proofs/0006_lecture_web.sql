-- Preuve 0006 — spec du lot B (2026-10-19-recette-web § 6.4). À coller dans l'éditeur SQL de Supabase APRÈS
-- `migrations/0006_lecture_web.sql` (étape 12 de `supabase/README.md`).
--
-- AUCUN jeton à remplacer et AUCUNE adresse à ajouter. Pour les verdicts 2.01 à 2.03 bis et 3.01, elle EMPRUNTE le compte le plus ancien de
-- `auth.users` — sans jamais le nommer ni l'afficher ; si `auth.users` est vide, ces verdicts sont sautés (« aucun compte : etape sautee »,
-- vert). Tout est annulé à la dernière instruction : rejouable telle quelle.
--
-- Lis d'abord la ligne 999 « BILAN » (`ok = true` = aucun verdict faux). Au dialogue « Potential issue detected », choisis « Run without
-- RLS » (README, étape 5). Si une instruction échoue, l'éditeur annule tout et le message d'erreur est la seule sortie.

begin;

-- 0. Gardes de lecture : 0004 collée, et la contrainte au nom attendu (sinon, le message nomme les contraintes `check` réelles à relever).
do $$
declare v text;
begin
  if to_regclass('public.assistant_journal') is null then
    raise exception 'public.assistant_journal absente : colle d''abord 0004 (etape 10 du README), puis 0006';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.assistant_journal'::regclass and conname = 'assistant_journal_outil_check') then
    select string_agg(conname, ', ') into v from pg_constraint where conrelid = 'public.assistant_journal'::regclass and contype = 'c';
    raise exception 'contrainte assistant_journal_outil_check absente ; contraintes check presentes : %', coalesce(v, 'aucune');
  end if;
end $$;

create temporary table preuve (ordre numeric primary key, etape text, attendu text, obtenu text, ok boolean);

-- 1. LA CONTRAINTE ET CE QUI NE DOIT PAS AVOIR BOUGÉ.
insert into pg_temp.preuve
select 1.01, 'pg_get_constraintdef : les cinq outils, dans l ordre d OUTILS_0006', 'recherche-web < creation < extraction < lecture-web < image-web',
  case when a > 0 and b > a and c > b and d > c and e > d then 'dans l ordre' else 'positions ' || a || ' / ' || b || ' / ' || c || ' / ' || d || ' / ' || e end,
  a > 0 and b > a and c > b and d > c and e > d
from (select position('''recherche-web''' in x) as a, position('''creation''' in x) as b, position('''extraction''' in x) as c, position('''lecture-web''' in x) as d,
             position('''image-web''' in x) as e
      from (select pg_get_constraintdef(oid) as x from pg_constraint where conrelid = 'public.assistant_journal'::regclass and conname = 'assistant_journal_outil_check') t) u;
insert into pg_temp.preuve
select 1.02, 'une seule contrainte check sur assistant_journal', '1', count(*)::text, count(*) = 1
from pg_constraint where conrelid = 'public.assistant_journal'::regclass and contype = 'c';
insert into pg_temp.preuve
select 1.03, 'anon et authenticated : aucun privilege sur la table (inchange depuis 0004)', 'false / false', a::text || ' / ' || b::text, not a and not b
from (select has_table_privilege('anon', 'public.assistant_journal', 'select, insert, update, delete, truncate, references, trigger') as a,
             has_table_privilege('authenticated', 'public.assistant_journal', 'select, insert, update, delete, truncate, references, trigger') as b) t;
insert into pg_temp.preuve
select 1.04, 'service_role : select, insert, update sur la table', 'true / true / true', s::text || ' / ' || i::text || ' / ' || u::text, s and i and u
from (select has_table_privilege('service_role', 'public.assistant_journal', 'select') as s,
             has_table_privilege('service_role', 'public.assistant_journal', 'insert') as i,
             has_table_privilege('service_role', 'public.assistant_journal', 'update') as u) t;
insert into pg_temp.preuve
select 1.05, 'vue assistant_usage_jour toujours la, en security invoker', 'true', coalesce(v::text, 'absente'), coalesce(v, false)
from (select (select 'security_invoker=true' = any (reloptions) from pg_class
              where oid = to_regclass('public.assistant_usage_jour') and relkind = 'v') as v) t;

-- 2. LE QUATRIÈME OUTIL, VU DE `postgres` (propriétaire de la table), et la cinquième valeur, image-web, admise dès 0006 pour le lot F (2.03 bis,
-- R-B-6). Compte emprunté jamais affiché ; lignes insérées au jour 2000-01-01, 2.03 et 2.031 réservent sur le jour UTC courant ; tout est annulé.
do $$
declare uid uuid; v text; c bigint; r bigint;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    insert into pg_temp.preuve values
      (2.01, 'sous postgres : une ligne de journal outil lecture-web est acceptee', 'acceptee', 'aucun compte : etape sautee', true),
      (2.02, 'un outil hors liste est toujours refuse par le check', '23514', 'aucun compte : etape sautee', true),
      (2.03, 'assistant_reserver accepte lecture-web : un id non nul', 'id non nul', 'aucun compte : etape sautee', true),
      (2.031, '2.03 bis : assistant_reserver(uid, ''image-web'', 1, c + 1) -> id non nul (la valeur du lot F)', 'id non nul', 'aucun compte : etape sautee', true),
      (3.01, 'les trois anciens outils passent encore', 'acceptes', 'aucun compte : etape sautee', true);
    return;
  end if;
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'lecture-web', 200, date '2000-01-01');
    v := 'acceptee';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.01, 'sous postgres : une ligne de journal outil lecture-web est acceptee', 'acceptee', v, v = 'acceptee');
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'inconnu', 200, date '2000-01-01');
    v := 'AUCUNE ERREUR : un outil hors liste a ete accepte';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.02, 'un outil hors liste est toujours refuse par le check', '23514', v, v = '23514');
  -- 2.03 et 2.03 bis : chaque appel dans un bloc exception, comme 2.01 et 2.02 — un refus du check (23514 : une 0006 collée sans image-web) devient
  -- un verdict rouge lisible au BILAN, au lieu d'annuler le collage entier sans rien afficher.
  select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;
  begin
    r := public.assistant_reserver(uid, 'lecture-web', 1, c::integer + 1);
    v := case when r is null then 'null' else 'id non nul' end;
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.03, 'assistant_reserver accepte lecture-web : un id non nul', 'id non nul', v, v = 'id non nul');
  -- 2.03 bis (R-B-6 = R-F-1) : la valeur du lot F, admise dès 0006 ; c recompté (2.03 vient d'écrire une ligne du jour : le quota c + 1 vaut pour lui).
  select count(*) into c from public.assistant_journal where owner_id = uid and jour = (now() at time zone 'utc')::date;
  begin
    r := public.assistant_reserver(uid, 'image-web', 1, c::integer + 1);
    v := case when r is null then 'null' else 'id non nul' end;
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (2.031, '2.03 bis : assistant_reserver(uid, ''image-web'', 1, c + 1) -> id non nul (la valeur du lot F)', 'id non nul', v, v = 'id non nul');
  begin
    insert into public.assistant_journal (owner_id, outil, statut, jour) values (uid, 'recherche-web', 200, date '2000-01-01'), (uid, 'creation', 200, date '2000-01-01'), (uid, 'extraction', 200, date '2000-01-01');
    v := 'acceptes';
  exception when others then v := sqlstate;
  end;
  insert into pg_temp.preuve values (3.01, 'les trois anciens outils passent encore', 'acceptes', v, v = 'acceptes');
end $$;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Dernière instruction : tout est annulé.
rollback;
