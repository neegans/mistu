-- Preuve 0005 — spec docs/superpowers/specs/2026-10-18-import-cible-design.md § 3.5 (lot A « importer une recette
-- repérée »). À coller dans l'éditeur SQL de Supabase APRÈS `migrations/0005_imports.sql` (et son `notify pgrst`) ET
-- APRÈS l'insertion de l'adresse de preuve dans `private.allowed_users` (étape 11 de `supabase/README.md`).
--
-- AVANT DE COLLER, remplace les deux jetons partout dans le fichier (Cmd-F, « Tout remplacer ») :
--   A_UUID  : un uuid au hasard (`select gen_random_uuid();` en donne un)
--   A_EMAIL : l'adresse de preuve (domaine réservé exemple.invalid) que tu viens d'ajouter à `private.allowed_users`,
--             EN MINUSCULES, et qui n'a pas de compte dans `auth.users`
-- Ne recolle jamais le fichier modifié dans le dépôt : il contiendrait ton adresse.
--
-- RÈGLE DE LECTURE (même règle que la preuve 0003, pour qu'elle vaille partout). Cette preuve ne lit ni n'affiche
-- JAMAIS la colonne `data` de `public.imports` : les lignes poussées sont relues par leurs COLONNES GÉNÉRÉES
-- (`edition_id`, `recipe_id`, `status`), et la fiche entière n'est que COMPARÉE à ce qui a été poussé (verdict
-- « conforme / différente »). Les fiches poussées sont factices (identifiants `*_preuve`). La réponse de `sync_push`
-- n'est jamais affichée telle quelle (un conflit porterait la ligne du serveur) : seulement ses compteurs et motifs.
-- `RESULTATS-mitsu.md` vit dans un dépôt public : rien de `data` n'y entre.
--
-- Même lecture que les preuves 0001 et 0003 : l'éditeur n'affiche qu'UN tableau (la table des verdicts) ; lis d'abord la
-- ligne 999 « BILAN » (`ok = true` = aucun verdict faux). Au dialogue « Potential issue detected » du tableau de bord,
-- choisis « Run without RLS » (l'autre bouton ajoute une instruction APRÈS le rollback, qui échoue : README, étape 5).
-- Tout se joue dans une transaction annulée à la dernière instruction : la preuve ne laisse RIEN (ni compte, ni ligne
-- d'import) et elle est rejouable telle quelle. Si une instruction échoue, l'éditeur annule tout et le message d'erreur
-- est la seule sortie : corrige, puis recolle le fichier entier.

begin;

-- 0. Gardes de lecture : un échec ici dit quoi faire, au lieu de laisser une erreur Postgres opaque.
do $$
begin
  if to_regclass('public.imports') is null then
    raise exception 'public.imports absente : colle d''abord supabase/migrations/0005_imports.sql (etape 11 du README)';
  end if;
  if position('''imports''' in pg_get_functiondef('public.sync_push(jsonb)'::regprocedure)) = 0 then
    raise exception 'sync_push ne connait pas imports : 0005 na pas ete collee en entier (etape 11 du README)';
  end if;
  if (select count(*) from private.allowed_users where email = 'A_EMAIL') <> 1 then
    raise exception 'A_EMAIL doit etre dans private.allowed_users, en minuscules (etape 11 du README)';
  end if;
  if exists (select 1 from auth.users where email = 'A_EMAIL') then
    raise exception 'cette adresse a deja un compte : auth.users refuse un doublon de courriel. Prends une adresse de preuve du domaine exemple.invalid (README, etape 11)';
  end if;
end $$;

-- La table des verdicts, temporaire (elle meurt avec la session, et de toute façon avec le rollback). Le `primary
-- key` sur `ordre` interdit deux preuves au même numéro.
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

-- Le compte de preuve (annulé par le rollback final). Le déclencheur B1 le laisse passer : son adresse est dans la
-- liste (garde 0).
insert into auth.users (id, email, instance_id, aud, role)
  values ('A_UUID', 'A_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into pg_temp.preuve
select 0.02, 'un compte de preuve cree (annule au rollback)', '1', count(*)::text, count(*) = 1
from auth.users where id = 'A_UUID';

-- 1. LA TABLE NEUVE (spec § 3.5) : même gabarit que les 26 autres, plus trois colonnes générées et leurs index.
insert into pg_temp.preuve
select 1.01, 'public.imports presente, RLS activee', 'true', coalesce(v::text, 'absente'), coalesce(v, false)
from (select (select relrowsecurity from pg_class where oid = to_regclass('public.imports')) as v) t;
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
from pg_policies where schemaname = 'public' and tablename = 'imports';
insert into pg_temp.preuve
select 1.03, 'declencheur imports_seq -> public.touch_server_seq(), actif', '1', count(*)::text, count(*) = 1
from pg_trigger where tgrelid = to_regclass('public.imports') and tgname = 'imports_seq'
  and tgfoid = 'public.touch_server_seq()'::regprocedure and not tgisinternal and tgenabled <> 'D';
insert into pg_temp.preuve
select 1.04, 'index imports_recv (owner_id, server_seq)', '1', count(*)::text, count(*) = 1
from pg_indexes where schemaname = 'public' and tablename = 'imports' and indexname = 'imports_recv'
  and indexdef like '%(owner_id, server_seq)';
insert into pg_temp.preuve
select 1.05, 'cle primaire composee (owner_id, id) : elle isole les comptes', '1', count(*)::text, count(*) = 1
from pg_indexes where schemaname = 'public' and tablename = 'imports' and indexname = 'imports_pkey'
  and indexdef like 'CREATE UNIQUE INDEX%(owner_id, id)';
insert into pg_temp.preuve
select 1.06, 'owner_id references auth.users on delete cascade', '1', count(*)::text, count(*) = 1
from pg_constraint where conrelid = to_regclass('public.imports') and contype = 'f'
  and confrelid = 'auth.users'::regclass and confdeltype = 'c';
-- Les trois colonnes générées STOCKÉES (attgenerated = 's'), de type text, lues dans la fiche : ce sont elles que la
-- preuve relit en section 3, à la place de la colonne jsonb.
insert into pg_temp.preuve
select 1.07, 'trois colonnes generees stockees, de type text : edition_id, recipe_id, status', '3', count(*)::text, count(*) = 3
from pg_attribute where attrelid = to_regclass('public.imports') and attname in ('edition_id', 'recipe_id', 'status')
  and attgenerated = 's' and atttypid = 'text'::regtype and not attisdropped;
insert into pg_temp.preuve
select 1.08, 'un index (owner_id, colonne) par colonne generee : imports_edition_id, imports_recipe_id, imports_status', '3', count(*)::text, count(*) = 3
from pg_indexes where schemaname = 'public' and tablename = 'imports'
  and indexname in ('imports_edition_id', 'imports_recipe_id', 'imports_status')
  and indexdef like '%(owner_id, ' || replace(indexname, 'imports_', '') || ')';

-- 2. PRIVILÈGES (S4). `authenticated` tient ses droits des `alter default privileges` du projet (0005 collée sous
--    `postgres`, comme 0001 et 0003) ; `anon` les aurait reçus de la même façon, d'où le `revoke` de 0005. Depuis 0004,
--    `public` porte aussi `assistant_journal` (hors synchronisation, révoquée pour anon ET authenticated) : 2.02 compte
--    donc les 27 tables synchronisées par leur nom, et exige qu'AUCUNE table de `public` ne donne un privilège à anon.
insert into pg_temp.preuve
select 2.01, 'authenticated : select, insert, update sur public.imports', 'true / true / true',
  s::text || ' / ' || i::text || ' / ' || u::text, s and i and u
from (select has_table_privilege('authenticated', 'public.imports', 'select') as s,
             has_table_privilege('authenticated', 'public.imports', 'insert') as i,
             has_table_privilege('authenticated', 'public.imports', 'update') as u) t;
insert into pg_temp.preuve
select 2.02, 'anon : aucun privilege sur aucune table de public ; les 27 tables synchronisees y sont', '27 synchronisees, 0 table avec un privilege anon',
  count(*) filter (where tablename = any(synchronisees)) || ' synchronisees, '
    || count(*) filter (where has_table_privilege('anon', 'public.' || tablename, 'select, insert, update, delete, truncate, references, trigger')) || ' table avec un privilege anon',
  count(*) filter (where tablename = any(synchronisees)) = 27 and bool_and(
       not has_table_privilege('anon', 'public.' || tablename, 'select')
   and not has_table_privilege('anon', 'public.' || tablename, 'insert')
   and not has_table_privilege('anon', 'public.' || tablename, 'update')
   and not has_table_privilege('anon', 'public.' || tablename, 'delete')
   and not has_table_privilege('anon', 'public.' || tablename, 'truncate, references, trigger'))
from pg_tables,
  (select array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config', 'imports'] as synchronisees) liste
where schemaname = 'public';
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
select 2.11, 'les 27 tables synchronisees de public ont toutes la RLS activee', '27', count(*)::text, count(*) = 27
from pg_class c join pg_namespace s on s.oid = c.relnamespace
where s.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and c.relname = any(array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config', 'imports']);

-- 3. A POUSSE DEUX LIGNES D'IMPORT ET LES RELIT PAR LEURS COLONNES GÉNÉRÉES. Fiches factices : un import de recette
--    (`imp_preuve`, `a_lancer`, puis `a_verifier` par un second envoi plus récent : la colonne `status` doit suivre) et un
--    import d'index (`imp_index`, sans `recipe_id` : aucun champ n'est requis pour `imports`, la colonne générée est nulle).
set local role authenticated;
set local request.jwt.claims = '{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}';
insert into pg_temp.preuve
select 3.01, 'A pousse une ligne imports (import de recette, a_lancer)', 'accepted 1, adjusted 0, rejected 0',
  'accepted ' || jsonb_array_length(reponse->'accepted') || ', adjusted ' || jsonb_array_length(reponse->'adjusted') || ', rejected ' || jsonb_array_length(reponse->'rejected'),
  jsonb_array_length(reponse->'accepted') = 1 and jsonb_array_length(reponse->'adjusted') = 0 and jsonb_array_length(reponse->'rejected') = 0
  and reponse->'accepted' @> '[{"store":"imports","id":"imp_preuve"}]'::jsonb
from (select public.sync_push('[{"store":"imports","id":"imp_preuve","data":{"id":"imp_preuve","kind":"recette","edition_id":"ed_preuve","recipe_id":"rc_preuve","scan_session_id":"ss_preuve","page_ids":["pg_preuve_1","pg_preuve_2"],"photo_sha256":null,"status":"a_lancer","erreur":null,"resultat":null,"reponse_brute":null,"appels":0,"model":null,"duree_ms":null,"device_id":"dev_preuve","document_id_vol":null,"battement_at":null,"created_at":"2026-10-18T10:00:00Z","updated_at":"2026-10-18T10:00:00Z","started_at":null,"finished_at":null},"updated_at":"2026-10-18T10:00:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 3.02, 'A relit sa ligne par ses colonnes generees : une ligne, edition_id / recipe_id / status conformes (compares, pas affiches)', '1 ligne, conformes',
  count(*) || ' ligne, ' || case when coalesce(bool_and(edition_id = 'ed_preuve' and recipe_id = 'rc_preuve' and status = 'a_lancer'), false) then 'conformes' else 'differentes' end,
  count(*) = 1 and coalesce(bool_and(edition_id = 'ed_preuve' and recipe_id = 'rc_preuve' and status = 'a_lancer'), false)
from public.imports where owner_id = auth.uid() and id = 'imp_preuve';
insert into pg_temp.preuve
select 3.03, 'la fiche entiere est celle qui a ete poussee (comparee sans etre affichee)', 'conforme',
  case when coalesce(bool_and(data = '{"id":"imp_preuve","kind":"recette","edition_id":"ed_preuve","recipe_id":"rc_preuve","scan_session_id":"ss_preuve","page_ids":["pg_preuve_1","pg_preuve_2"],"photo_sha256":null,"status":"a_lancer","erreur":null,"resultat":null,"reponse_brute":null,"appels":0,"model":null,"duree_ms":null,"device_id":"dev_preuve","document_id_vol":null,"battement_at":null,"created_at":"2026-10-18T10:00:00Z","updated_at":"2026-10-18T10:00:00Z","started_at":null,"finished_at":null}'::jsonb), false) then 'conforme' else 'differente' end,
  coalesce(bool_and(data = '{"id":"imp_preuve","kind":"recette","edition_id":"ed_preuve","recipe_id":"rc_preuve","scan_session_id":"ss_preuve","page_ids":["pg_preuve_1","pg_preuve_2"],"photo_sha256":null,"status":"a_lancer","erreur":null,"resultat":null,"reponse_brute":null,"appels":0,"model":null,"duree_ms":null,"device_id":"dev_preuve","document_id_vol":null,"battement_at":null,"created_at":"2026-10-18T10:00:00Z","updated_at":"2026-10-18T10:00:00Z","started_at":null,"finished_at":null}'::jsonb), false)
from public.imports where owner_id = auth.uid() and id = 'imp_preuve';
insert into pg_temp.preuve
select 3.04, 'A pousse la meme ligne PLUS RECENTE, passee a a_verifier (transition du journal) : acceptee', 'accepted 1, rejected 0',
  'accepted ' || jsonb_array_length(reponse->'accepted') || ', rejected ' || jsonb_array_length(reponse->'rejected'),
  jsonb_array_length(reponse->'accepted') = 1 and jsonb_array_length(reponse->'rejected') = 0
from (select public.sync_push('[{"store":"imports","id":"imp_preuve","data":{"id":"imp_preuve","kind":"recette","edition_id":"ed_preuve","recipe_id":"rc_preuve","scan_session_id":"ss_preuve","page_ids":["pg_preuve_1","pg_preuve_2"],"photo_sha256":null,"status":"a_verifier","erreur":null,"resultat":{"titre":"preuve"},"reponse_brute":null,"appels":1,"model":"m","duree_ms":1234,"device_id":"dev_preuve","document_id_vol":null,"battement_at":null,"created_at":"2026-10-18T10:00:00Z","updated_at":"2026-10-18T10:05:00Z","started_at":"2026-10-18T10:04:00Z","finished_at":"2026-10-18T10:05:00Z"},"updated_at":"2026-10-18T10:05:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 3.05, 'la colonne generee status suit la fiche : a_verifier, toujours une seule ligne', '1 ligne, status conforme',
  count(*) || ' ligne, status ' || case when coalesce(bool_and(status = 'a_verifier'), false) then 'conforme' else 'different' end,
  count(*) = 1 and coalesce(bool_and(status = 'a_verifier'), false)
from public.imports where owner_id = auth.uid() and id = 'imp_preuve';
insert into pg_temp.preuve
select 3.06, 'A pousse un import d index sans recipe_id (aucun champ requis pour imports) : accepte', 'accepted 1, rejected 0',
  'accepted ' || jsonb_array_length(reponse->'accepted') || ', rejected ' || jsonb_array_length(reponse->'rejected'),
  jsonb_array_length(reponse->'accepted') = 1 and jsonb_array_length(reponse->'rejected') = 0
from (select public.sync_push('[{"store":"imports","id":"imp_index","data":{"id":"imp_index","kind":"index","edition_id":"ed_preuve","recipe_id":null,"scan_session_id":"ss_preuve","page_ids":["pg_preuve_3"],"photo_sha256":null,"status":"a_lancer","erreur":null,"resultat":null,"reponse_brute":null,"appels":0,"model":null,"duree_ms":null,"device_id":"dev_preuve","document_id_vol":null,"battement_at":null,"created_at":"2026-10-18T10:10:00Z","updated_at":"2026-10-18T10:10:00Z","started_at":null,"finished_at":null},"updated_at":"2026-10-18T10:10:00Z"}]'::jsonb) as reponse) t;
insert into pg_temp.preuve
select 3.07, 'sa colonne generee recipe_id est nulle, edition_id et status posees', '1 ligne, recipe_id nul, edition_id et status conformes',
  count(*) || ' ligne, recipe_id ' || case when coalesce(bool_and(recipe_id is null), false) then 'nul' else 'non nul' end
    || ', edition_id et status ' || case when coalesce(bool_and(edition_id = 'ed_preuve' and status = 'a_lancer'), false) then 'conformes' else 'differentes' end,
  count(*) = 1 and coalesce(bool_and(recipe_id is null and edition_id = 'ed_preuve' and status = 'a_lancer'), false)
from public.imports where owner_id = auth.uid() and id = 'imp_index';

-- 4. SUPPRESSION DIRECTE (comme 5.01 de 0003) : la règle delete n'est franchissable que sous `app.purge`. Aucune purge
--    n'a été jouée plus haut ; le drapeau est remis à vide quand même, pour que le verdict ne dépende pas de l'ordre.
--    Le `delete` ne lève pas : il ne supprime rien.
select set_config('app.purge', '', true);
with d as (delete from public.imports where id = 'imp_preuve' returning 1)
insert into pg_temp.preuve
select 4.01, 'delete direct de A, sans app.purge : aucune ligne supprimee, sans erreur', '0', count(*)::text, count(*) = 0 from d;
insert into pg_temp.preuve
select 4.02, 'A garde ses deux lignes apres le delete', '2', count(*)::text, count(*) = 2
from public.imports where owner_id = auth.uid();
reset role;

-- 5. LES QUATRE FONCTIONS RECRÉÉES (spec § 3.5) : chacune liste 27 magasins, et la liste finit par 'assistant_config',
--    'imports' (K-9 : la table neuve est la dernière). Le premier `array[` de chaque corps est la constante `stores`.
--    La garde 0 a déjà vu 'imports' dans `sync_push` ; 5.01 en vérifie en plus le nombre et la place.
--    `to_regprocedure` rend NULL (au lieu de lever) pour une fonction absente : chaque NULL donne un verdict FAUX.
insert into pg_temp.preuve
select n, f || ' : 27 magasins, la liste finit par assistant_config, imports', '27 / true',
  coalesce(nb::text, 'aucune liste') || ' / ' || coalesce(fin::text, 'fonction absente'), coalesce(nb = 27 and fin, false)
from (values
  (5.01, 'public.sync_push(jsonb)'),
  (5.02, 'public.sync_purge(text, text)'),
  (5.03, 'public.sync_purge_all()'),
  (5.04, 'public.purge_tombstones()')
) as x(n, f),
lateral (select pg_get_functiondef(to_regprocedure(f)) as d) y,
lateral (select array_length(string_to_array(split_part(split_part(y.d, 'array[', 2), ']', 1), ', '), 1) as nb,
                position('''assistant_config'', ''imports'']' in y.d) > 0 as fin) z;
insert into pg_temp.preuve
select 5.05, 'sync_push : keys et required connaissent imports', 'true / true',
  coalesce((position('"imports":"id"' in d) > 0)::text || ' / ' || (position('"imports":[]' in d) > 0)::text, 'fonction absente'),
  coalesce(position('"imports":"id"' in d) > 0 and position('"imports":[]' in d) > 0, false)
from (select pg_get_functiondef(to_regprocedure('public.sync_push(jsonb)')) as d) t;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Dernière instruction : tout est annulé. Ni compte, ni ligne d'import ne survit à cette preuve.
rollback;
