import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {sourcesCorbeilleSQL} from './corbeille-sources-sql.mjs';
import {SYNC_STORES} from '../src/model/schema.js';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));

export function corbeilleLivresSQL() {
  const ancien=readFileSync(resolve(ROOT,'supabase/migrations/0005_imports.sql'),'utf8');
  const push=ancien.match(/create or replace function public\.sync_push\(rows jsonb\) returns jsonb[\s\S]*?\$\$;/)?.[0];
  if(!push)throw Error('Définition sync_push historique absente');
  const l1=readFileSync(resolve(ROOT,'supabase/migrations/0008_corbeille_recettes.sql'),'utf8').match(/create or replace function public\.sync_push_v2\(rows jsonb\) returns jsonb[\s\S]*?\$\$;/)?.[0];
  if(!l1)throw Error('Définition L1 absente');
  return `-- L2 : cycle des éditions et restauration individuelle depuis un groupe.
-- Aucun contenu existant réécrit. Migration unique, à appliquer après 0008.
-- Un verrou de bibliothèque par propriétaire précède les verrous de lignes, y compris en REST.
create or replace function public.l2_lock_owner() returns void
language sql volatile security invoker set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':library-write',0))
$$;
create or replace function public.l2_guard_statement() returns trigger
language plpgsql security invoker set search_path='' as $$
begin perform public.l2_lock_owner();return null;end $$;
${SYNC_STORES.map(s=>`create trigger ${s}_l2_statement before insert or update or delete on public.${s} for each statement execute function public.l2_guard_statement();`).join('\n')}
create or replace function public.l2_valid_edition(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare token text:=d->>'lifecycle_id';stamp text:=d->>'trashed_at';mode text:=d->>'trash_mode';
begin
  if d is null or jsonb_typeof(d)<>'object' then return false;end if;
  if token is null and stamp is null and mode is null then return true;end if;
  if jsonb_typeof(d->'lifecycle_id') is distinct from 'string' or token !~ '^[A-Za-z0-9_-]{1,200}$' or not(d?'trashed_at') or not(d?'trash_mode') then return false;end if;
  if stamp is null then return mode is null;end if;
  if jsonb_typeof(d->'trashed_at') is distinct from 'string' or mode is null or mode not in ('keep_recipes','with_recipes') then return false;end if;
  begin return to_char(stamp::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=stamp;exception when others then return false;end;
end $$;
create or replace function public.l2_valid_exception(d jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(d->'restored_from_edition','null')='null'::jsonb or
 (jsonb_typeof(d->'restored_from_edition')='object' and jsonb_typeof(d#>'{restored_from_edition,edition_id}')='string'
 and d#>>'{restored_from_edition,edition_id}'=d->>'edition_id'
 and btrim(d#>>'{restored_from_edition,edition_id}')<>'' and ((d->'restored_from_edition')-array['edition_id','lifecycle_id'])='{}'::jsonb
 and jsonb_typeof(d#>'{restored_from_edition,lifecycle_id}')='string'
 and d#>>'{restored_from_edition,lifecycle_id}' ~ '^[A-Za-z0-9_-]{1,200}$')
$$;
create or replace function public.l2_recipe_active(r jsonb,e jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(r is not null and r->>'trashed_at' is null and public.l2_valid_exception(r) and
 (r->>'edition_id' is null or (public.l2_valid_edition(e) and (e->>'trashed_at' is null or e->>'trash_mode'='keep_recipes' or
 (r#>>'{restored_from_edition,edition_id}'=r->>'edition_id' and r#>>'{restored_from_edition,lifecycle_id}'=e->>'lifecycle_id')))),false)
$$;
create or replace function public.l2_edition_ids(s text,d jsonb) returns text[]
language plpgsql stable security invoker set search_path='' as $$
declare ids text[]:='{}';rid text;eid text;
begin
 if s='book_editions' then return array[d->>'id'];end if;
 if s='books' then select coalesce(array_agg(id),'{}') into ids from public.book_editions where owner_id=auth.uid() and data->>'book_id'=d->>'id' and deleted_at is null;return ids;end if;
 if s in ('recipes','source_documents','source_pages','scan_sessions','library_activity','rediscovery_prefs','imports') then ids:=array_append(ids,d->>'edition_id');end if;
 if s='source_pages' then select data->>'edition_id' into eid from public.source_documents where owner_id=auth.uid() and id=d->>'document_id';ids:=array_append(ids,eid);end if;
 for rid in select unnest(public.l1_recipe_ids(s,d)) loop
  select data->>'edition_id' into eid from public.recipes where owner_id=auth.uid() and id=rid;ids:=array_append(ids,eid);
 end loop;
 return ids;
end $$;
create or replace function public.l2_lock_rows(rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb;x jsonb;old_data jsonb;rids text[]:='{}';eids text[]:='{}';v text;s text;
begin
 perform public.l2_lock_owner();
 for r in select * from jsonb_array_elements(rows) loop
  s:=r->>'store';old_data:=null;
  if s=any(array[${SYNC_STORES.map(s=>`'${s}'`).join(',')}]) then execute format('select data from public.%I where owner_id=auth.uid() and id=$1',s) into old_data using r->>'id';end if;
  rids:=rids||public.l1_recipe_ids(s,r->'data')||public.l1_recipe_ids(s,old_data)||array[r->>'recipe_id'];
  eids:=eids||public.l2_edition_ids(s,r->'data')||public.l2_edition_ids(s,old_data)||array[r->>'edition_id'];
  for x in select * from jsonb_array_elements(coalesce(r->'recipe_contexts','[]')) loop rids:=array_append(rids,x->>'recipe_id');end loop;
  for x in select * from jsonb_array_elements(coalesce(r->'edition_contexts','[]')) loop eids:=array_append(eids,x->>'edition_id');if x->>'recipe_id' is not null then rids:=array_append(rids,x->>'recipe_id');end if;end loop;
 end loop;
 for v in select distinct a from unnest(rids) a where a is not null order by a loop
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||v,0));
  select data->>'edition_id' into s from public.recipes where owner_id=auth.uid() and id=v;eids:=array_append(eids,s);
 end loop;
 for v in select distinct a from unnest(eids) a where a is not null order by a loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':edition:'||v,0));end loop;
end $$;

create or replace function public.l2_guard_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;d jsonb;before_data jsonb;ids text[];eid text;ed jsonb;ed_deleted timestamptz;ec jsonb;rc jsonb;rid text;recipe jsonb;
 lifecycle boolean;archive_insert boolean;historical boolean;can_complete boolean;source_group jsonb;
begin
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
${['book_editions','books','recipes','recipe_versions','recipe_translations','substitutions','dish_recipe_links','meals','shopping_lists','cook_sessions','inventory','source_documents','source_pages','scan_sessions'].map(s=>`create trigger ${s}_l2_cycle before insert or update or delete on public.${s} for each row execute function public.l2_guard_write();`).join('\n')}

-- L'ancien point d'entrée conserve ses règles de contenu ; il préverrouille aussi le lot entier.
${push.replace("  perform set_config('app.sync_push', 'on', true);","  perform public.l2_lock_rows(rows);\n  perform set_config('app.sync_push', 'on', true);")}
alter function public.sync_push_v2(jsonb) rename to l1_sync_push_v2;
${l1.replace('public.sync_push_v2(', 'public.l1_sync_push_v2(').replace('begin\n', 'begin\n  perform public.l2_lock_owner();\n')}
${sourcesCorbeilleSQL()}
create function public.sync_push_v2(rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare r jsonb;cur jsonb;parent jsonb;d jsonb;result jsonb;response jsonb;rejet jsonb;edstate jsonb;old_stamp timestamptz;deleted timestamptz;parent_deleted timestamptz;stamp timestamptz;
 target text;id text;eid text;opid text;action text;base text;mode text;seed_used boolean;accepted jsonb:='[]';adjusted jsonb:='[]';rejected jsonb:='[]';
begin
 if not public.is_allowed() then raise exception 'adresse non autorisée';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;
 perform public.l2_lock_rows(rows);
 for r in select * from jsonb_array_elements(rows) loop
  id:=r->>'id';target:=r->>'store';eid:=r->>'edition_id';opid:=r->>'operation_id';action:=r->>'action';base:=r->>'base_cycle_id';mode:=r->>'mode';seed_used:=false;cur:=null;parent:=null;deleted:=null;parent_deleted:=null;old_stamp:=null;
  if target='book_editions' then select data,updated_at,deleted_at into cur,old_stamp,deleted from public.book_editions where owner_id=auth.uid() and book_editions.id=id;
  elsif target='recipes' then select data,updated_at,deleted_at into cur,old_stamp,deleted from public.recipes where owner_id=auth.uid() and recipes.id=id;end if;
  if eid is null and r->>'op' is distinct from 'lifecycle' then eid:=case when target='book_editions' then id else coalesce(cur->>'edition_id',r->'data'->>'edition_id',r->'edition_contexts'->0->>'edition_id') end;end if;
  if eid is not null then select data,deleted_at into parent,parent_deleted from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;end if;
  begin
   if r->>'op'='source_batch' then
    accepted:=accepted||public.l2_sync_sources(r);
   elsif r->>'op'='lifecycle' and (target='book_editions' or eid is not null or action='restore_from_edition') then
    if jsonb_typeof(r->'id') is distinct from 'string' or btrim(id)='' or jsonb_typeof(r->'operation_id') is distinct from 'string' or opid !~ '^[A-Za-z0-9_-]{1,200}$'
     or not(r?'base_cycle_id') or (base is not null and (jsonb_typeof(r->'base_cycle_id') is distinct from 'string' or base !~ '^[A-Za-z0-9_-]{1,200}$'))
     or action is null or action not in ('trash','restore','restore_from_edition') or jsonb_typeof(r->'at') is distinct from 'string' then raise check_violation using message='cycle';end if;
    stamp:=(r->>'at')::timestamptz;if to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from r->>'at' or deleted is not null then raise check_violation using message='cycle';end if;
    if target='book_editions' then
     if r->>'entity' is distinct from 'edition' or eid is distinct from id or action='restore_from_edition' or (action='trash' and (mode is null or mode not in ('keep_recipes','with_recipes'))) then raise check_violation using message='cycle';end if;
     if cur is not null and not public.l2_valid_edition(cur) then raise check_violation using message='cycle';end if;
     if cur->>'lifecycle_id'=opid then
      if (action='trash') is distinct from (cur->>'trashed_at' is not null) or (action='trash' and mode is distinct from cur->>'trash_mode') then raise check_violation using message='cycle';end if;
     else
      if cur is null then
       d:=r->'seed';if action<>'trash' or base is not null or jsonb_typeof(d) is distinct from 'object' or d->>'id' is distinct from id or pg_column_size(d)>524288 or not exists(select 1 from public.books where owner_id=auth.uid() and books.id=d->>'book_id' and deleted_at is null) then raise check_violation using message='cycle';end if;seed_used:=true;
      else
       if base is distinct from cur->>'lifecycle_id' or (action='trash')=(cur->>'trashed_at' is not null) then raise check_violation using message='cycle';end if;d:=cur;
      end if;
      old_stamp:=greatest(clock_timestamp(),coalesce(old_stamp,clock_timestamp())+interval '1 microsecond');
      d:=d||jsonb_build_object('lifecycle_id',opid,'trashed_at',case when action='trash' then r->>'at' else null end,'trash_mode',case when action='trash' then mode else null end,'updated_at',old_stamp);
      perform set_config('app.l1_write',r::text,true);
      if seed_used then insert into public.book_editions(owner_id,id,data,updated_at) values(auth.uid(),id,d,old_stamp);else update public.book_editions set data=d,updated_at=old_stamp where owner_id=auth.uid() and book_editions.id=id;end if;
     end if;
     select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into result from public.book_editions where owner_id=auth.uid() and book_editions.id=id;
     accepted:=accepted||jsonb_build_object('store',target,'id',id,'operation_id',opid,'server',result,'seed_used',seed_used);
    else
     if target<>'recipes' or cur is null or cur->>'edition_id' is distinct from eid or parent is null or parent_deleted is not null or not public.l2_valid_edition(parent) or not(r?'base_edition_cycle_id') then raise check_violation using message='cycle';end if;
     if cur->>'lifecycle_id'=opid then
      if (action='trash') is distinct from (cur->>'trashed_at' is not null) or (action='restore_from_edition' and (cur#>>'{restored_from_edition,edition_id}' is distinct from eid or cur#>>'{restored_from_edition,lifecycle_id}' is distinct from r->>'base_edition_cycle_id')) then raise check_violation using message='cycle';end if;
     else
      if base is distinct from cur->>'lifecycle_id' or r->>'base_edition_cycle_id' is distinct from parent->>'lifecycle_id' then raise check_violation using message='cycle';end if;
      if action='restore_from_edition' then if parent->>'trashed_at' is null or parent->>'trash_mode'<>'with_recipes' then raise check_violation using message='cycle';end if;
      elsif action='trash' then if not public.l2_recipe_active(cur,parent) then raise check_violation using message='cycle';end if;
      else if cur->>'trashed_at' is null or not public.l2_recipe_active(cur||'{"trashed_at":null}'::jsonb,parent) then raise check_violation using message='cycle';end if;end if;
      old_stamp:=greatest(clock_timestamp(),old_stamp+interval '1 microsecond');
      d:=cur||jsonb_build_object('lifecycle_id',opid,'trashed_at',case when action='trash' then r->>'at' else null end,'restored_from_edition',case when action='restore_from_edition' then jsonb_build_object('edition_id',eid,'lifecycle_id',r->>'base_edition_cycle_id') else null end,'updated_at',old_stamp);
      perform set_config('app.l1_write',r::text,true);update public.recipes set data=d,updated_at=old_stamp where owner_id=auth.uid() and recipes.id=id;
     end if;
     select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into result from public.recipes where owner_id=auth.uid() and recipes.id=id;
     select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into response from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;
     accepted:=accepted||jsonb_build_object('store',target,'id',id,'operation_id',opid,'server',result,'edition_server',response);
    end if;
   else
    response:=public.l1_sync_push_v2(jsonb_build_array(r));accepted:=accepted||coalesce(response->'accepted','[]');adjusted:=adjusted||coalesce(response->'adjusted','[]');
    for rejet in select * from jsonb_array_elements(coalesce(response->'rejected','[]')) loop
     if rejet->>'reason'='forme' and jsonb_array_length(coalesce(r->'edition_contexts','[]'))>0 then rejet:=rejet||'{"reason":"cycle"}'::jsonb;end if;
     if rejet->>'reason'='cycle' and eid is not null then
      select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into edstate from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;
      rejet:=rejet||jsonb_build_object('edition_server',edstate);
     end if;
     rejected:=rejected||rejet;
    end loop;
   end if;
  exception when check_violation or invalid_datetime_format or datetime_field_overflow then
   if target=any(array[${SYNC_STORES.map(s=>`'${s}'`).join(',')}]) then execute format('select jsonb_build_object(''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',target) into result using id;else result:=null;end if;
   select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into response from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;
   rejected:=rejected||jsonb_build_object('store',target,'id',id,'operation_id',opid,'reason','cycle','server',result,'edition_server',response);
  end;
  perform set_config('app.l1_write','',true);perform set_config('app.l2_sources','',true);
 end loop;
 return jsonb_build_object('server_time',clock_timestamp(),'accepted',accepted,'adjusted',adjusted,'rejected',rejected);
end $$;
create or replace function public.sync_capabilities() returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when public.is_allowed() then '{"recipe_lifecycle":1,"edition_lifecycle":1}'::jsonb else '{}'::jsonb end
$$;
${['l2_lock_owner()','l2_sync_sources(jsonb)','l2_valid_edition(jsonb)','l2_valid_exception(jsonb)','l2_recipe_active(jsonb,jsonb)','l2_edition_ids(text,jsonb)','l2_lock_rows(jsonb)','l1_sync_push_v2(jsonb)','sync_push_v2(jsonb)','sync_capabilities()'].map(s=>`revoke all on function public.${s} from public,anon;\ngrant execute on function public.${s} to authenticated;`).join('\n')}
revoke all on function public.l2_guard_write() from public,anon,authenticated;
revoke all on function public.l2_guard_statement() from public,anon,authenticated;
`;
}
export function verifierCorbeilleLivresSQL({root=ROOT,check=true}={}) {
  const path=resolve(root,'supabase/migrations/0009_corbeille_livres.sql'),data=corbeilleLivresSQL();
  if(check){if(readFileSync(path,'utf8')!==data)throw Error('Migration corbeille livres non conforme au générateur');}
  else writeFileSync(path,data);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))verifierCorbeilleLivresSQL({check:process.argv.includes('--check')});
