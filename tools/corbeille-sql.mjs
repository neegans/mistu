// Migration additive L1 ; ne régénère aucune migration historique.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SYNC_STORES } from '../src/model/schema.js';

export function corbeilleSQL() { return `-- L1 : cycle de vie des recettes, distinct des tombales de synchronisation.
-- Migration additive. Aucun contenu ni fichier existant supprimé.
create or replace function public.sync_capabilities() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select case when public.is_allowed() then '{"recipe_lifecycle":1}'::jsonb else '{}'::jsonb end
$$;
revoke all on function public.sync_capabilities() from public, anon;
grant execute on function public.sync_capabilities() to authenticated;

create or replace function public.l1_recipe_ids(s text, d jsonb) returns text[]
language plpgsql stable security invoker set search_path = '' as $$
declare ids text[] := '{}'; rid text; x jsonb;
begin
  if s = 'recipes' then return array[d->>'id']; end if;
  if s in ('recipe_versions','dish_recipe_links') then return array[d->>'recipe_id']; end if;
  if s in ('recipe_translations','substitutions') then
    select data->>'recipe_id' into rid from public.recipe_versions where owner_id=auth.uid() and id=d->>'recipe_version_id';
    return array[rid];
  end if;
  if s in ('meals','shopping_lists') then
    for x in select * from jsonb_array_elements(case when jsonb_typeof(d->'items')='array' then d->'items' else '[]'::jsonb end) loop
      ids:=array_append(ids,x->>'recipe_id');
      select data->>'recipe_id' into rid from public.recipe_versions where owner_id=auth.uid() and id=x->>'recipe_version_id';
      ids:=array_append(ids,rid);
    end loop;
  elsif s='cook_sessions' then
    ids:=array_append(ids,d->>'recipe_id');
    for x in select * from jsonb_array_elements(case when jsonb_typeof(d->'selected_version_ids')='array' then d->'selected_version_ids' else '[]'::jsonb end) loop
      select data->>'recipe_id' into rid from public.recipe_versions where owner_id=auth.uid() and id=x#>>'{}';
      ids:=array_append(ids,rid);
    end loop;
  elsif s='inventory' then
    ids:=array_append(ids,d->>'source_recipe_id');
    select data->>'recipe_id' into rid from public.recipe_versions where owner_id=auth.uid() and id=d->>'source_recipe_version_id';
    ids:=array_append(ids,rid);
  end if;
  return ids;
end $$;
revoke all on function public.l1_recipe_ids(text,jsonb) from public, anon;
grant execute on function public.l1_recipe_ids(text,jsonb) to authenticated;

-- Seules les références sont figées : cocher une course, avancer la cuisson ou consommer une portion reste possible.
create or replace function public.l1_recipe_refs(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('recipe_id',d->'recipe_id','recipe_version_id',d->'recipe_version_id',
    'source_recipe_id',d->'source_recipe_id','source_recipe_version_id',d->'source_recipe_version_id',
    'selected_version_ids',d->'selected_version_ids','items',
    (select jsonb_agg(jsonb_build_array(x->'recipe_id',x->'recipe_version_id')) from jsonb_array_elements(case when jsonb_typeof(d->'items')='array' then d->'items' else '[]'::jsonb end) x))
$$;
revoke all on function public.l1_recipe_refs(jsonb) from public, anon;
grant execute on function public.l1_recipe_refs(jsonb) to authenticated;

create or replace function public.l1_guard_recipe() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare ctx jsonb; d jsonb; before_data jsonb; rid text; parent jsonb; parent_deleted timestamptz;
  expected text; ids text[]; previous_ids text[]; token text; trash text; historical boolean;
begin
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
      if trash !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$' then raise check_violation using message='cycle';end if;
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
revoke all on function public.l1_guard_recipe() from public, anon, authenticated;
${['recipes','recipe_versions','recipe_translations','substitutions','dish_recipe_links','meals','shopping_lists','cook_sessions','inventory'].map(s=>`create trigger ${s}_l1_cycle before insert or update or delete on public.${s} for each row execute function public.l1_guard_recipe();`).join('\n')}

create or replace function public.sync_push_v2(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; c jsonb; cur jsonb; d jsonb; response jsonb; result jsonb;
  rid text; opid text; base text; action text; stamp timestamptz; old_stamp timestamptz; deleted timestamptz; seq bigint;
  accepted jsonb:='[]';adjusted jsonb:='[]';rejected jsonb:='[]';seed_used boolean; bad text;
begin
  if not public.is_allowed() then raise exception 'adresse non autorisée'; end if;
  if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    rid:=coalesce(r->>'recipe_id',case when r->>'store'='recipes' then r->>'id' end);
    opid:=r->>'operation_id';seed_used:=false;cur:=null;deleted:=null;bad:=null;
    if rid is not null then perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||rid,0)); end if;
    select data,updated_at,deleted_at,server_seq into cur,old_stamp,deleted,seq from public.recipes where owner_id=auth.uid() and id=rid;
    begin
      if r->>'op'='lifecycle' then
        action:=r->>'action';base:=r->>'base_cycle_id';
        if r->>'store' is distinct from 'recipes' or jsonb_typeof(r->'id') is distinct from 'string' or jsonb_typeof(r->'recipe_id') is distinct from 'string' or btrim(rid)='' or r->>'id' is distinct from rid
          or jsonb_typeof(r->'operation_id') is distinct from 'string' or opid !~ '^[A-Za-z0-9_-]{1,200}$'
          or jsonb_typeof(r->'action') is distinct from 'string' or action not in ('trash','restore')
          or not(r?'base_cycle_id') or (base is not null and (jsonb_typeof(r->'base_cycle_id') is distinct from 'string' or base !~ '^[A-Za-z0-9_-]{1,200}$'))
          or jsonb_typeof(r->'at') is distinct from 'string' then raise check_violation using message='cycle'; end if;
        stamp:=(r->>'at')::timestamptz;
        if to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from r->>'at' then raise check_violation using message='cycle';end if;
        if stamp is null or r->>'at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$' or deleted is not null or cur->>'edition_id' is not null then raise check_violation using message='cycle'; end if;
        if cur->>'lifecycle_id'=opid then
          if (action='trash') is distinct from (cur->>'trashed_at' is not null) then raise check_violation using message='cycle';end if;
          -- Accusé perdu : la création couverte peut sortir de file si son contenu est toujours confirmé.
          seed_used:=jsonb_typeof(r->'seed')='object' and (cur-'lifecycle_id'-'trashed_at'-'updated_at')=((r->'seed')-'lifecycle_id'-'trashed_at'-'updated_at');
        else
          if cur is null then
            d:=r->'seed';
            if action<>'trash' or base is not null or jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'id') is distinct from 'string' or d->>'id' is distinct from rid or d->>'edition_id' is not null or pg_column_size(d)>524288 then raise check_violation using message='cycle'; end if;
            seed_used:=true;
          else
            if base is distinct from cur->>'lifecycle_id' or (action='trash' and cur->>'trashed_at' is not null) or (action='restore' and cur->>'trashed_at' is null) then raise check_violation using message='cycle'; end if;
            d:=cur;
          end if;
          d:=d||jsonb_build_object('lifecycle_id',opid,'trashed_at',case when action='trash' then r->>'at' else null end);
          old_stamp:=greatest(clock_timestamp(),coalesce(old_stamp,clock_timestamp())+interval '1 microsecond');
          d:=d||jsonb_build_object('updated_at',old_stamp);
          perform set_config('app.l1_write',r::text,true);
          if seed_used then insert into public.recipes(owner_id,id,data,updated_at) values(auth.uid(),rid,d,old_stamp);
          else update public.recipes set data=d,updated_at=old_stamp where owner_id=auth.uid() and id=rid;end if;
        end if;
        select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into result from public.recipes where owner_id=auth.uid() and id=rid;
        accepted:=accepted||jsonb_build_object('store','recipes','id',rid,'operation_id',opid,'server',result,'seed_used',seed_used);
      else
        if r->>'store'='recipes' then
          if deleted is not null then raise check_violation using message='cycle';end if;
          if cur is not null and r->>'archive_import'='true' and ((r->'data')->>'lifecycle_id' is distinct from cur->>'lifecycle_id' or (r->'data')->>'trashed_at' is distinct from cur->>'trashed_at') then raise check_violation using message='cycle';end if;
          if cur is not null and ((cur->>'lifecycle_id' is not null and not (r ? 'expected_cycle_id')) or r->>'expected_cycle_id' is distinct from cur->>'lifecycle_id' or cur->>'trashed_at' is not null) then raise check_violation using message='cycle';end if;
          if cur is not null then
            if cur ? 'lifecycle_id' or cur ? 'trashed_at' then r:=jsonb_set(r,'{data}',(r->'data')||jsonb_build_object('lifecycle_id',cur->'lifecycle_id','trashed_at',cur->'trashed_at'));
            else r:=jsonb_set(r,'{data}',(r->'data')-'lifecycle_id'-'trashed_at');end if;
          elsif r->>'archive_import' is distinct from 'true' then r:=jsonb_set(r,'{data}',(r->'data')-'lifecycle_id'-'trashed_at');end if;
        end if;
        perform set_config('app.l1_write',r::text,true);
        response:=public.sync_push(jsonb_build_array(r));
        accepted:=accepted||coalesce(response->'accepted','[]');adjusted:=adjusted||coalesce(response->'adjusted','[]');
        for c in select * from jsonb_array_elements(coalesce(response->'rejected','[]')) loop
          if c->>'reason'='forme' and (rid is not null or r?'recipe_contexts') then c:=c||jsonb_build_object('reason','cycle','server',case when cur is null then null else jsonb_build_object('data',cur,'updated_at',old_stamp,'deleted_at',deleted) end);end if;
          rejected:=rejected||c;
        end loop;
      end if;
    exception when check_violation or invalid_datetime_format or datetime_field_overflow then
      rejected:=rejected||jsonb_build_object('store',r->>'store','id',r->>'id','operation_id',opid,'reason','cycle','server',case when cur is null then null else jsonb_build_object('data',cur,'updated_at',old_stamp,'deleted_at',deleted) end);
    end;
    perform set_config('app.l1_write','',true);
  end loop;
  return jsonb_build_object('server_time',clock_timestamp(),'accepted',accepted,'adjusted',adjusted,'rejected',rejected);
end $$;
revoke all on function public.sync_push_v2(jsonb) from public, anon;
grant execute on function public.sync_push_v2(jsonb) to authenticated;

-- L'effacement volontaire du compte reste distinct de la corbeille et de la purge individuelle.
create or replace function public.sync_purge_all() returns integer
language plpgsql security invoker set search_path = '' as $$
declare s text; n integer:=0; k integer;
begin
  if not public.is_allowed() then raise exception 'adresse non autorisée';end if;
  perform set_config('app.purge','on',true);perform set_config('app.l1_purge_all','on',true);
  foreach s in array array[${SYNC_STORES.map(s=>`'${s}'`).join(',')}] loop
    execute format('delete from public.%I where owner_id=auth.uid()',s);get diagnostics k=row_count;n:=n+k;
  end loop;
  perform set_config('app.l1_purge_all','',true);return n;
end $$;
revoke all on function public.sync_purge_all() from public, anon;
grant execute on function public.sync_purge_all() to authenticated;
`; }

export function verifierCorbeilleSQL({check=true,root=resolve(fileURLToPath(new URL('..',import.meta.url)))}={}) {
  const cible=resolve(root,'supabase/migrations/0008_corbeille_recettes.sql'),contenu=corbeilleSQL();
  if(check) {if(readFileSync(cible,'utf8')!==contenu) throw Error('Migration corbeille non conforme au générateur');}
  else writeFileSync(cible,contenu);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) verifierCorbeilleSQL({check:process.argv.includes('--check')});
