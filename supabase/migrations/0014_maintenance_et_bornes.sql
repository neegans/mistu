-- 0014_maintenance_et_bornes.sql — généré par tools/generer-migrations.mjs.
-- Audit L0-L10, tâche 8. Fichier préparé seulement : aucune application distante automatique.
-- Corps complets composés au build ; migrations 0001–0013 inchangées.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Refus atomique avant tout changement si d'anciens transferts n'ont plus de compte.
-- Le préflight doit les signaler ; cette migration n'efface jamais silencieusement leur contenu.
do $$begin
 if exists(select 1 from private.mistu_source_transfers t where not exists(select 1 from auth.users u where u.id=t.owner_id))
 or exists(select 1 from private.mistu_source_transfer_parts p where not exists(select 1 from auth.users u where u.id=p.owner_id))
 then raise exception 'transferts orphelins : resoudre le preflight avant 0014' using errcode='23503';end if;
end $$;

-- L'administrateur purge explicitement une cible même retirée de allowed_users, sans usurper son JWT.
-- Le DELETE auth.users reste un geste séparé, après le succès de cette fonction.
create or replace function public.admin_purge_owner(uid uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare s text;n integer:=0;k integer;
 avant_purge text:=coalesce(pg_catalog.current_setting('app.purge',true),'');
 avant_l1 text:=coalesce(pg_catalog.current_setting('app.l1_purge_all',true),'');
 avant_cible text:=coalesce(pg_catalog.current_setting('app.admin_purge_owner',true),'');
begin
 if uid is null then raise exception 'proprietaire requis' using errcode='22023';end if;
 -- Un JWT tiers ferait ensuite verrouiller son propriétaire par les triggers statement : refuser
 -- avant toute prise de verrou, sans changer le JWT ni le verrouillage des écritures ordinaires.
 if auth.uid() is not null and auth.uid() is distinct from uid then raise exception 'contexte administrateur incompatible' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||':library-write',0));
 perform pg_catalog.set_config('app.purge','on',true);
 perform pg_catalog.set_config('app.l1_purge_all','on',true);
 perform pg_catalog.set_config('app.admin_purge_owner',uid::text,true);
 begin
  delete from private.mistu_source_transfer_parts where owner_id=uid;get diagnostics k=row_count;n:=n+k;
  delete from private.mistu_source_transfers where owner_id=uid;get diagnostics k=row_count;n:=n+k;
  foreach s in array array['books','book_editions','source_documents','source_pages','scan_sessions','dishes','dish_recipe_links','recipes','recipe_versions','recipe_translations','ingredients','unit_definitions','unit_conventions','substitutions','appliances','cook_history','cook_sessions','inventory','meals','meal_feedback','shopping_lists','library_activity','rediscovery_prefs','timer_launches','files','assistant_config','imports'] loop
   execute pg_catalog.format('delete from public.%I where owner_id=$1',s) using uid;
   get diagnostics k=row_count;n:=n+k;
  end loop;
 exception when others then
  perform pg_catalog.set_config('app.purge',avant_purge,true);
  perform pg_catalog.set_config('app.l1_purge_all',avant_l1,true);
  perform pg_catalog.set_config('app.admin_purge_owner',avant_cible,true);
  raise;
 end;
 perform pg_catalog.set_config('app.purge',avant_purge,true);
 perform pg_catalog.set_config('app.l1_purge_all',avant_l1,true);
 perform pg_catalog.set_config('app.admin_purge_owner',avant_cible,true);
 return n;
end $$;
revoke all on function public.admin_purge_owner(uuid) from public,anon,authenticated;
grant execute on function public.admin_purge_owner(uuid) to service_role;

create or replace function public.l1_guard_recipe() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ctx jsonb; d jsonb; before_data jsonb; rid text; parent jsonb; parent_deleted timestamptz;
  expected text; ids text[]; previous_ids text[]; token text; trash text; historical boolean;
begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;
 if tg_table_name='inventory' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l8_apply_inventory_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_table_name='cook_sessions' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l7_apply_cooking_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_table_name='recipe_translations' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l6_apply_translation_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;

  if current_setting('app.l1_purge_all',true)='on' then if tg_op='DELETE' then return old; else return new; end if; end if;
  ctx:=coalesce(nullif(current_setting('app.l1_write',true),''),'{}')::jsonb;
  d:=case when tg_op='DELETE' then old.data else new.data end;
  before_data:=case when tg_op='INSERT' then null else old.data end;
  ids:=public.l1_recipe_ids(tg_table_name,d);
  previous_ids:=public.l1_recipe_ids(tg_table_name,before_data);
  if tg_table_name in ('recipe_versions','recipe_translations','substitutions','dish_recipe_links') then ids:=ids||previous_ids;end if;
  if tg_table_name='recipes' then
    token:=d->>'lifecycle_id';trash:=d->>'trashed_at';
    if token is not null and (jsonb_typeof(d->'lifecycle_id') is distinct from 'string' or not(d?'trashed_at') or length(token)>200 or token !~ '^[A-Za-z0-9_-]+$') then raise check_violation using message='cycle'; end if;
    if trash is not null then
      if token is null or jsonb_typeof(d->'trashed_at') is distinct from 'string' then raise check_violation using message='cycle'; end if;
      if trash !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then raise check_violation using message='cycle';end if;
      begin
        if to_char(trash::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>trash then raise check_violation using message='cycle';end if;
      exception when others then raise check_violation using message='cycle'; end;
    end if;
    if tg_op='DELETE' and (before_data->>'lifecycle_id' is not null or before_data->>'trashed_at' is not null) then raise check_violation using message='cycle'; end if;
    if tg_op<>'DELETE' and (d->>'lifecycle_id' is distinct from before_data->>'lifecycle_id' or d->>'trashed_at' is distinct from before_data->>'trashed_at')
      and not (ctx->>'op' is not distinct from 'lifecycle' or (ctx->>'archive_import' is not distinct from 'true' and tg_op='INSERT')) then raise check_violation using message='cycle'; end if;
    if tg_op='INSERT' and ctx->>'archive_import'='true' then return new;end if;
  end if;
  for rid in select distinct v from unnest(ids) v where v is not null order by v loop
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||rid,0));
    select data,deleted_at into parent,parent_deleted from public.recipes where owner_id=auth.uid() and id=rid;
    if tg_table_name='recipes' and tg_op<>'INSERT' then parent:=old.data;parent_deleted:=old.deleted_at;end if;
    if ctx->>'op'='lifecycle' and tg_table_name='recipes' then continue; end if;
    historical:=ctx->>'historique'='true';
    if ctx ? 'recipe_contexts' then select coalesce(bool_or(x->>'historique'='true'),false) into historical from jsonb_array_elements(ctx->'recipe_contexts') x where x->>'recipe_id'=rid;end if;
    -- Un historique explicitement capturé peut évoluer sans ajouter/changer une référence recette ou version.
    if historical and tg_table_name in ('meals','shopping_lists','cook_sessions','inventory') and tg_op in ('UPDATE','DELETE') and rid=any(previous_ids) and public.l1_recipe_refs(d)=public.l1_recipe_refs(before_data) then continue; end if;
    if parent->>'lifecycle_id' is null and parent->>'trashed_at' is null and not (ctx ? 'expected_cycle_id') and not (ctx ? 'recipe_contexts') then continue; end if;
    expected:=ctx->>'expected_cycle_id';
    if ctx ? 'recipe_contexts' then
      select x->>'expected_cycle_id' into expected from jsonb_array_elements(ctx->'recipe_contexts') x where x->>'recipe_id'=rid;
      if not found then raise check_violation using message='cycle'; end if;
    elsif ctx->>'recipe_id' is distinct from rid then raise check_violation using message='cycle'; end if;
    if parent_deleted is not null or (parent->>'trashed_at' is not null and not(tg_op='INSERT' and ctx->>'archive_import' is not distinct from 'true')) or expected is distinct from parent->>'lifecycle_id' then raise check_violation using message='cycle'; end if;
    if tg_op='DELETE' and parent->>'lifecycle_id' is not null then raise check_violation using message='cycle'; end if;
  end loop;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

create or replace function public.l2_guard_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;d jsonb;before_data jsonb;ids text[];eid text;ed jsonb;ed_deleted timestamptz;ec jsonb;rc jsonb;rid text;recipe jsonb;
 lifecycle boolean;archive_insert boolean;historical boolean;can_complete boolean;source_group jsonb;
begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;
 if tg_table_name='inventory' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l8_apply_inventory_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_table_name='cook_sessions' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l7_apply_cooking_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_table_name='recipe_translations' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l6_apply_translation_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;

 if tg_table_name in ('source_documents','source_pages','scan_sessions','imports') and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l5_apply_source_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if current_setting('app.l1_purge_all',true)='on' then if tg_op='DELETE' then return old;else return new;end if;end if;
 ctx:=coalesce(nullif(current_setting('app.l1_write',true),''),'{}')::jsonb;
 source_group:=coalesce(nullif(current_setting('app.l2_sources',true),''),'{}')::jsonb;
 d:=case when tg_op='DELETE' then old.data else new.data end;before_data:=case when tg_op='INSERT' then null else old.data end;
 lifecycle:=coalesce(ctx->>'op'='lifecycle' and ctx->>'id'=d->>'id',false);
 archive_insert:=tg_op='INSERT' and coalesce(ctx->>'archive_import'='true',false);
 if tg_op='UPDATE' and (
  (tg_table_name='source_documents' and (d->>'edition_id' is distinct from before_data->>'edition_id' or d->>'scan_session_id' is distinct from before_data->>'scan_session_id')) or
  (tg_table_name='source_pages' and (d->>'edition_id' is distinct from before_data->>'edition_id' or d->>'document_id' is distinct from before_data->>'document_id')) or
  (tg_table_name='scan_sessions' and d->>'edition_id' is distinct from before_data->>'edition_id')) then raise check_violation using message='cycle';end if;
 ids:=public.l2_edition_ids(tg_table_name,d)||public.l2_edition_ids(tg_table_name,before_data);
 if tg_table_name='books' and (tg_op='DELETE' or new.deleted_at is not null) and exists(select 1 from unnest(ids) x where x is not null) then raise check_violation using message='cycle';end if;
 if tg_table_name='books' and tg_op<>'DELETE' and new.deleted_at is null then
  if not exists(select 1 from unnest(ids) x where x is not null) then return new;end if;
  if exists(select 1 from public.book_editions e where e.owner_id=auth.uid() and e.id=any(ids) and e.deleted_at is null and public.l2_valid_edition(e.data) and e.data->>'trashed_at' is null and
   (e.data->>'lifecycle_id' is null or exists(select 1 from jsonb_array_elements(coalesce(ctx->'edition_contexts','[]')) x where x->>'edition_id'=e.id and x->>'expected_cycle_id' is not distinct from e.data->>'lifecycle_id'))) then return new;end if;
  raise check_violation using message='cycle';
 end if;
 if tg_table_name='book_editions' then
  if tg_op='DELETE' or new.deleted_at is not null or (tg_op='UPDATE' and old.deleted_at is not null) then raise check_violation using message='cycle';end if;
  if not public.l2_valid_edition(d) then raise check_violation using message='cycle';end if;
  if (d->>'lifecycle_id' is distinct from before_data->>'lifecycle_id' or d->>'trashed_at' is distinct from before_data->>'trashed_at' or d->>'trash_mode' is distinct from before_data->>'trash_mode') and not(lifecycle or archive_insert) then raise check_violation using message='cycle';end if;
 end if;
 if tg_table_name='recipes' then
  if not coalesce(public.l2_valid_exception(d),false) then raise check_violation using message='cycle';end if;
  if not(lifecycle or archive_insert) then
   if tg_op='INSERT' and d->>'restored_from_edition' is not null then raise check_violation using message='cycle';end if;
   if tg_op='UPDATE' then
    if d->>'edition_id' is distinct from before_data->>'edition_id' then new.data:=new.data||jsonb_build_object('restored_from_edition',null);
    elsif before_data?'restored_from_edition' then new.data:=new.data||jsonb_build_object('restored_from_edition',before_data->'restored_from_edition');
    else new.data:=new.data-'restored_from_edition';end if;
    d:=new.data;
   end if;
  end if;
 end if;
 for eid in select distinct x from unnest(ids) x where x is not null order by x loop
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':edition:'||eid,0));
  select data,deleted_at into ed,ed_deleted from public.book_editions where owner_id=auth.uid() and id=eid;
  if tg_table_name='book_editions' then ed:=before_data;ed_deleted:=case when tg_op='INSERT' then null else old.deleted_at end;end if;
  if ed->>'lifecycle_id' is not null and tg_table_name in ('recipes','recipe_versions','recipe_translations','substitutions','dish_recipe_links','source_documents','source_pages','scan_sessions')
   and (tg_op='DELETE' or new.deleted_at is not null or (tg_op='UPDATE' and old.deleted_at is not null)) then raise check_violation using message='cycle';end if;
  if lifecycle then continue;end if;
  if tg_table_name='book_editions' and archive_insert then continue;end if;
  if ed is null and tg_table_name<>'book_editions' then raise check_violation using message='cycle';end if;
  if ed_deleted is not null or (ed is not null and not public.l2_valid_edition(ed)) then raise check_violation using message='cycle';end if;
  select x into ec from jsonb_array_elements(coalesce(ctx->'edition_contexts','[]')) x where x->>'edition_id'=eid;
  historical:=coalesce(ec->>'historique'='true',false);
  if historical and tg_op='UPDATE' and tg_table_name in ('meals','shopping_lists','cook_sessions','inventory') and public.l1_recipe_refs(d)=public.l1_recipe_refs(before_data) then continue;end if;
  if historical and tg_op='DELETE' and tg_table_name='inventory' then continue;end if;
  if tg_op='UPDATE' and tg_table_name='scan_sessions' and d->>'edition_id' is not distinct from before_data->>'edition_id' and d->'page_ids' is not distinct from before_data->'page_ids' and d->'recipe_ids' is not distinct from before_data->'recipe_ids' and d->'document_ids' is not distinct from before_data->'document_ids' then continue;end if;
  if ed->>'lifecycle_id' is not null and (ec is null or ec->>'expected_cycle_id' is distinct from ed->>'lifecycle_id') then raise check_violation using message='cycle';end if;
  if ec is not null and ec->>'expected_cycle_id' is distinct from ed->>'lifecycle_id' and not(tg_table_name='book_editions' and archive_insert) then raise check_violation using message='cycle';end if;
  if archive_insert then continue;end if;
  if tg_op<>'DELETE' and tg_table_name in ('scan_sessions','source_documents','source_pages') and source_group->>'edition_id'=eid and exists(select 1 from jsonb_array_elements(coalesce(source_group->'rows','[]')) x where x->>'store'=tg_table_name and x->>'id'=d->>'id') then continue;end if;
  if tg_table_name='recipes' then
   if ctx->>'recipe_id'=d->>'id' then rc:=ctx;else select x into rc from jsonb_array_elements(coalesce(ctx->'recipe_contexts','[]')) x where x->>'recipe_id'=d->>'id';end if;
   if ed->>'lifecycle_id' is not null and tg_op='UPDATE' and (not coalesce(rc?'expected_edition_id',false) or rc->>'expected_edition_id' is distinct from before_data->>'edition_id') then raise check_violation using message='cycle';end if;
   if tg_op='UPDATE' and d->>'edition_id' is distinct from before_data->>'edition_id' then
    if eid=before_data->>'edition_id' and not public.l2_recipe_active(before_data,ed) then raise check_violation using message='cycle';end if;
    if eid=d->>'edition_id' and ed->>'trashed_at' is not null then raise check_violation using message='cycle';end if;
   elsif ed->>'trashed_at' is not null and (tg_op='INSERT' or not public.l2_recipe_active(d,ed)) then raise check_violation using message='cycle';end if;
  elsif tg_table_name in ('recipe_versions','recipe_translations','substitutions','dish_recipe_links','meals','shopping_lists','cook_sessions','inventory') then
   for rid in select distinct x from unnest(public.l1_recipe_ids(tg_table_name,d)||public.l1_recipe_ids(tg_table_name,before_data)) x where x is not null loop
    select data into recipe from public.recipes where owner_id=auth.uid() and id=rid;
    if recipe->>'edition_id'=eid and not public.l2_recipe_active(recipe,ed) then raise check_violation using message='cycle';end if;
   end loop;
  elsif ed->>'trashed_at' is not null then
   can_complete:=false; -- le complément exige le groupe atomique vérifié ci-dessus
   if not can_complete then raise check_violation using message='cycle';end if;
  end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

create or replace function public.l5_guard_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;d jsonb;k text;managed boolean;initial_index boolean;begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;

 perform public.l2_lock_owner();
 -- Le rôle du helper est inaccessible aux clients ; aucun GUC ne peut créer cette autorité.
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l5_apply_source_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 before_data:=case when tg_op='INSERT' then '{}'::jsonb else old.data end;d:=case when tg_op='DELETE' then '{}'::jsonb else new.data end;
 if public.l5_pending_source(tg_table_name,coalesce(before_data->>'id',d->>'id')) then raise check_violation using message='source_reserved';end if;
 if tg_table_name='recipes' then
  managed:=exists(select 1 from public.imports i left join public.scan_sessions s on s.owner_id=i.owner_id and s.id=i.data->>'scan_session_id'
   where i.owner_id=auth.uid() and i.id in (before_data->>'index_import_id',d->>'index_import_id') and i.data->>'kind'='index'
   and (i.data?'source_capture' or i.data?'index_storage' or s.data?'source_state'))
   or exists(select 1 from public.source_pages p where p.owner_id=auth.uid() and p.id in (before_data->>'index_page_id',d->>'index_page_id')
    and (p.data?'source_revision' or p.data?'source_copy' or exists(select 1 from public.scan_sessions s where s.owner_id=p.owner_id and s.data?'source_state' and coalesce(s.data->'page_ids','[]')?p.id)));
  if managed and tg_op='INSERT' then raise check_violation using message='source_reserved';end if;
  if managed and tg_op='UPDATE' then
   foreach k in array array['index_rubriques','printed_pages','index_import_id','index_page_id'] loop
    if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;
   end loop;
   -- La complétion conserve l’origine d’index et utilise les photos de la recette extraite.
   if (d->>'availability'='reference_only' or d->>'current_version_id' is null) and before_data->'source_page_ids' is distinct from d->'source_page_ids' then raise check_violation using message='source_reserved';end if;
  end if;
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 managed:=(before_data?'source_revision' or before_data?'source_state' or before_data?'source_copy' or before_data?'index_storage' or before_data?'source_capture' or before_data?'index_call');
 if tg_table_name='source_pages' and exists(select 1 from public.scan_sessions s where s.owner_id=auth.uid() and s.deleted_at is null and s.data?'source_state' and coalesce(s.data->'page_ids','[]')?(before_data->>'id')) then managed:=true;end if;
 if tg_table_name='source_documents' and exists(select 1 from public.scan_sessions s where s.owner_id=auth.uid() and s.deleted_at is null and s.data?'source_state' and coalesce(s.data->'document_ids','[]')?(before_data->>'id')) then managed:=true;end if;
 if managed and (tg_op='DELETE' or new.deleted_at is not null) then raise check_violation using message='source_reserved';end if;
 if tg_op='UPDATE' and tg_table_name='source_pages' and public.l5_project_page(before_data) is distinct from public.l5_project_page(d) then raise check_violation using message='source_reserved';end if;
 if tg_op='UPDATE' and tg_table_name='source_documents' and public.l5_project_document(before_data) is distinct from public.l5_project_document(d) then raise check_violation using message='source_reserved';end if;
 initial_index:=tg_table_name='imports' and tg_op='INSERT' and (d?'source_capture' or d?'index_call');
 for k in select unnest(case when tg_table_name='imports' then array['source_capture','index_call','index_storage','index_decision_revision','index_decisions','index_application_receipts','index_resolved_occurrences'] when tg_table_name='scan_sessions' then array['source_state','source_receipts','source_copy'] else array['source_revision','source_copy'] end) loop
  if initial_index and k in ('source_capture','index_call') then continue;end if;
  if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;
 end loop;
 if initial_index then perform public.l5_guard_validate_initial_index(d);end if;
 if tg_table_name='imports' and before_data?'source_capture' then
  foreach k in array array['id','kind','recipe_id','edition_id','scan_session_id','page_ids','owner_id','expected_edition_id','expected_edition_cycle_id','expected_cycle_id'] loop
   if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;
  end loop;
  if (d->>'status'='enregistre' or before_data->>'status'='enregistre') and before_data->'status' is distinct from d->'status' then raise check_violation using message='source_reserved';end if;
  if before_data->>'resultat' is not null or before_data->>'index_storage' is not null then
   foreach k in array array['resultat','model','started_at'] loop if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;end loop;
  elsif d->>'resultat' is not null then perform public.l5_guard_validate_initial_index(d);
  end if;
 end if;
 if tg_table_name='scan_sessions' and before_data?'source_state' then
  foreach k in array array['id','edition_id','page_ids','document_ids'] loop if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;end loop;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

create or replace function public.l6_guard_version() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;

 perform public.l2_lock_owner();
 if tg_op='DELETE' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.sync_purge_all()'::regprocedure) and current_setting('app.purge',true)='on' and current_setting('app.l1_purge_all',true)='on' and old.owner_id=auth.uid() then return old;end if;
 if tg_op='DELETE' then perform public.l6_validate_version_write(old.owner_id,old.data,null);return old;end if;
 if tg_op='UPDATE' then if old.owner_id is distinct from new.owner_id or old.id is distinct from new.id then raise check_violation using message='version_immuable';end if;before_data:=old.data;if new.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then perform public.l6_validate_version_write(old.owner_id,old.data,null);end if;end if;
 perform public.l6_validate_version_write(new.owner_id,before_data,new.data);return new;
end $$;

create or replace function public.l6_guard_journal() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;d jsonb;managed boolean;begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;

 perform public.l2_lock_owner();
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l6_apply_translation_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='INSERT' then select data into before_data from public.imports where owner_id=new.owner_id and id=new.id;else before_data:=old.data;end if;
 d:=case when tg_op='DELETE' then '{}'::jsonb else new.data end;
 managed:=before_data->>'kind'='traduction' or d->>'kind'='traduction' or before_data ?| array['translation_capture','translation_call','translation_resolutions'] or d ?| array['translation_capture','translation_call','translation_resolutions'];
 if not coalesce(managed,false) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' or new.deleted_at is not null or new.id is distinct from d->>'id' or new.owner_id is distinct from auth.uid()
 or tg_op='UPDATE' and (old.owner_id is distinct from new.owner_id or old.id is distinct from new.id) then raise check_violation using message='translation_reserved';end if;
 perform public.l6_validate_journal_write(new.owner_id,d,tg_op);return new;
end $$;

create or replace function public.l7_guard_cooking() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;reserved boolean;begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;

 perform public.l2_lock_owner();
 if tg_table_name not in ('timer_launches','cook_sessions') then raise check_violation using message='forme_invalide';end if;
 if tg_op='DELETE' then
  if old.owner_id is distinct from auth.uid() or auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
  if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.sync_purge_all()'::regprocedure) and current_setting('app.purge',true)='on' and current_setting('app.l1_purge_all',true)='on' then return old;end if;
  perform public.l7_validate_cooking_write(tg_table_name,old.data,null);return old;
 end if;
 if new.owner_id is distinct from auth.uid() or auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if old.owner_id is distinct from new.owner_id or old.id is distinct from new.id then raise check_violation using message='cooking_reserved';end if;
  before_data:=old.data;
 end if;
 -- Ce rôle élevé provient de l’unique helper de commande fermé ; un GUC ne donne aucune autorité.
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid=to_regprocedure('public.l7_apply_cooking_command(jsonb)')) then
  reserved:=case when tg_table_name='timer_launches' then coalesce(before_data ?| array['timer_format','mirror'],false) or new.data ?| array['timer_format','mirror'] else coalesce(before_data?'cooking_state',false) or new.data?'cooking_state' or coalesce(before_data->'progress'->'format'='2'::jsonb,false) or new.data->'progress'->'format'='2'::jsonb end;
  if reserved and (new.deleted_at is not null or new.data->>'id' is distinct from new.id or not(case when tg_table_name='timer_launches' then public.l7_valid_timer(new.data) else public.l7_valid_session(new.data) end)) then raise check_violation using message='forme_invalide';end if;
  return new;
 end if;
 if tg_op='UPDATE' and new.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then perform public.l7_validate_cooking_write(tg_table_name,before_data,null);end if;
 perform public.l7_validate_cooking_write(tg_table_name,before_data,new.data);return new;
end$$;

create or replace function public.l8_guard_inventory() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;reserved boolean;begin

 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;

 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;

 perform public.l2_lock_owner();
 if tg_table_name<>'inventory' then raise check_violation using message='forme_invalide';end if;
 if tg_op='DELETE' then
  if old.owner_id is distinct from auth.uid() or auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
  if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.sync_purge_all()'::regprocedure) and current_setting('app.purge',true)='on' and current_setting('app.l1_purge_all',true)='on' then return old;end if;
  perform public.l8_validate_inventory_write(old.data,null,'DELETE');return old;
 end if;
 if new.owner_id is distinct from auth.uid() or auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if old.owner_id is distinct from new.owner_id or old.id is distinct from new.id then raise check_violation using message='inventory_reserved';end if;
  before_data:=old.data;
 end if;
 reserved:=coalesce(before_data ?| array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'],false) or coalesce(new.data ?| array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'],false);
 -- L’autorité vient du helper fermé SECURITY DEFINER, jamais d’un drapeau de session.
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid=to_regprocedure('public.l8_apply_inventory_command(jsonb)')) then
  if reserved and (new.deleted_at is not null or new.data->>'id' is distinct from new.id or not public.l8_valid_inventory(new.data)) then raise check_violation using message='forme_invalide';end if;
  return new;
 end if;
 if tg_op='UPDATE' and new.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then perform public.l8_validate_inventory_write(before_data,null,'DELETE');end if;
 perform public.l8_validate_inventory_write(before_data,new.data,tg_op);return new;
end$$;


-- Même fermeture de références que 0009, bornée avant tout verrou de recette/édition.
create or replace function public.l2_lock_rows(rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb;x jsonb;old_data jsonb;rids text[]:='{}';eids text[]:='{}';v text;s text;
begin
 if jsonb_typeof(rows) is distinct from 'array' then raise exception 'rows : lot invalide' using errcode='22023';end if;
 if jsonb_array_length(rows)>500 or octet_length(rows::text)>1048576 then raise exception 'trop de lignes' using errcode='22023';end if;
 perform public.l2_lock_owner();
 for r in select * from jsonb_array_elements(rows) loop
  if jsonb_typeof(r) is distinct from 'object'
  or r?'recipe_contexts' and jsonb_typeof(r->'recipe_contexts') is distinct from 'array'
  or r?'edition_contexts' and jsonb_typeof(r->'edition_contexts') is distinct from 'array'
  then raise exception 'rows : contexte invalide' using errcode='22023';end if;
  s:=r->>'store';old_data:=null;
  if s=any(array['books','book_editions','source_documents','source_pages','scan_sessions','dishes','dish_recipe_links','recipes','recipe_versions','recipe_translations','ingredients','unit_definitions','unit_conventions','substitutions','appliances','cook_history','cook_sessions','inventory','meals','meal_feedback','shopping_lists','library_activity','rediscovery_prefs','timer_launches','files','assistant_config','imports']) then execute format('select data from public.%I where owner_id=auth.uid() and id=$1',s) into old_data using r->>'id';end if;
  rids:=rids||public.l1_recipe_ids(s,r->'data')||public.l1_recipe_ids(s,old_data)||array[r->>'recipe_id'];
  eids:=eids||public.l2_edition_ids(s,r->'data')||public.l2_edition_ids(s,old_data)||array[r->>'edition_id'];
  for x in select * from jsonb_array_elements(coalesce(r->'recipe_contexts','[]')) loop rids:=array_append(rids,x->>'recipe_id');end loop;
  for x in select * from jsonb_array_elements(coalesce(r->'edition_contexts','[]')) loop eids:=array_append(eids,x->>'edition_id');if x->>'recipe_id' is not null then rids:=array_append(rids,x->>'recipe_id');end if;end loop;
 end loop;
 rids:=array(select distinct a from unnest(rids) a where a is not null order by a);
 -- Le verrou de bibliothèque protège ces lectures ; leurs éditions comptent avant la première prise de ligne.
 eids:=eids||array(select data->>'edition_id' from public.recipes where owner_id=auth.uid() and id=any(rids));
 eids:=array(select distinct a from unnest(eids) a where a is not null order by a);
 -- Un même texte dans les deux espaces désigne deux verrous différents.
 if cardinality(rids)+cardinality(eids)>2000 then raise exception 'trop de lignes' using errcode='22023';end if;
 foreach v in array rids loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||v,0));end loop;
 foreach v in array eids loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':edition:'||v,0));end loop;
end $$;
revoke all on function public.l2_lock_rows(jsonb) from public,anon;
grant execute on function public.l2_lock_rows(jsonb) to authenticated;

-- Les déclencheurs existants restent attachés aux mêmes signatures ; aucune garde n'est désactivée.
revoke all on function public.l1_guard_recipe(),public.l2_guard_write(),public.l5_guard_write(),public.l6_guard_version(),public.l6_guard_journal(),public.l7_guard_cooking(),public.l8_guard_inventory() from public,anon,authenticated;

alter table private.mistu_source_transfers add constraint mistu_source_transfers_owner_fkey foreign key(owner_id) references auth.users(id) on delete cascade;
alter table private.mistu_source_transfer_parts add constraint mistu_source_transfer_parts_owner_fkey foreign key(owner_id) references auth.users(id) on delete cascade;
-- Le lien composite parts→header existant reste protégé ; les purges explicites suppriment les parts d'abord.
revoke all on private.mistu_source_transfers,private.mistu_source_transfer_parts from public,anon,authenticated;
revoke all on function public.l5_cleanup_transfers() from public,anon,authenticated;
grant execute on function public.l5_cleanup_transfers() to service_role;
select cron.schedule('cuisine-os-transferts','30 4 * * *','select public.l5_cleanup_transfers()');
notify pgrst,'reload schema';
commit;
