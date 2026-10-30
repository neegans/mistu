import {sourcesGardesSql} from './sources-gardes-sql.mjs';
import {sourcesCanonSql} from './sources-canon-sql.mjs';
import {sourcesPrimitivesSql} from './sources-primitives-sql.mjs';
import {sourcesTransfertsSql} from './sources-transferts-sql.mjs';
import {sourcesIndexResultSql} from './sources-index-result-sql.mjs';
import {sourcesIndexApplicationSql} from './sources-index-application-sql.mjs';
import {sourcesRevisionsSql} from './sources-revisions-sql.mjs';
import {corbeilleLivresSQL} from './corbeille-livres-sql.mjs';
export function sourcesSQL(){
 const base=corbeilleLivresSQL(),guard=base.match(/create or replace function public\.l2_guard_write\(\) returns trigger[\s\S]*?end \$\$;/)?.[0];if(!guard)throw Error('Garde L2 introuvable');
 const trusted="current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l5_apply_source_command(jsonb)'::regprocedure)";
 const parentGuard=guard.replace('begin\n',`begin\n if tg_table_name in ('source_documents','source_pages','scan_sessions','imports') and ${trusted} then if tg_op='DELETE' then return old;else return new;end if;end if;\n`);
 return `-- 0010_sources_index.sql — généré par tools/generer-migrations.mjs.\n-- Protocole L5 : commandes immuables ; aucune application distante automatique.\n${sourcesCanonSql}\n${sourcesPrimitivesSql}\n${sourcesIndexResultSql}\n${sourcesRevisionsSql}\n${sourcesIndexApplicationSql}\n${sourcesTransfertsSql}\n`+String.raw`
create or replace function public.l5_apply_source_command(c jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;server jsonb;motif text;begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 begin
  if jsonb_typeof(c) is distinct from 'object' or c->'protocol'<>'1'::jsonb or not public.l5_id(c->'id') or not public.l5_id(c->'operation_id') or not(c?'edition_id' and c?'base_edition_cycle_id') or not(c->'edition_id'='null'::jsonb or public.l5_id(c->'edition_id')) or not(c->'base_edition_cycle_id'='null'::jsonb or public.l5_id(c->'base_edition_cycle_id')) or c->'edition_id'='null'::jsonb and c->'base_edition_cycle_id'<>'null'::jsonb or c->>'payload_sha256' !~ '^[a-f0-9]{64}$' or public.l5_sha256(c-'payload_sha256') is distinct from c->>'payload_sha256' then perform public.l5_fail('invalid_shape');end if;
  if octet_length(c::text)>786432 or octet_length(jsonb_build_object('rows',jsonb_build_array(c))::text)>921600 then perform public.l5_fail('too_large');end if;
  if c->>'op'='source_revision' then result:=public.l5_revision(c);
  elsif c->>'op'='index_apply' then result:=public.l5_index_apply(c);
  elsif c->>'op'='source_transfer' then result:=public.l5_transfer(c);
  else perform public.l5_fail('capability_missing');end if;
  return jsonb_build_object('accepted',jsonb_build_array(result),'adjusted','[]'::jsonb,'rejected','[]'::jsonb,'server_time',clock_timestamp());
 exception when check_violation or data_exception then
  motif:=sqlerrm;if motif not in ('source_changed','session_changed','edition_cycle','owner_changed','result_changed','index_changed','id_collision','invalid_shape','too_large','capability_missing','transfer_expired','transfer_changed') then motif:='invalid_shape';end if;
  if c->>'store' in ('source_documents','source_pages','scan_sessions','imports','recipes') then server:=public.l5_get(c->>'store',c->>'id');end if;
  return jsonb_build_object('accepted','[]'::jsonb,'adjusted','[]'::jsonb,'rejected',jsonb_build_array(jsonb_build_object('store',c->>'store','id',c->>'id','operation_id',c->>'operation_id','payload_sha256',c->>'payload_sha256','reason',motif,'server',server)),'server_time',clock_timestamp());
 end;
end $$;
`+parentGuard+String.raw`
`+sourcesGardesSql+String.raw`
do $$declare s text;begin foreach s in array array['source_pages','source_documents','scan_sessions','imports','recipes'] loop execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.l5_guard_write()',s||'_l5_guard',s);end loop;end $$;
alter function public.sync_push_v2(jsonb) rename to l2_sync_push_v2;
create function public.sync_push_v2(rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;
 perform public.l2_lock_owner();
 if exists(select 1 from jsonb_array_elements(rows) r where r->>'op' in ('source_revision','index_apply','source_transfer')) then
  if jsonb_array_length(rows)<>1 or octet_length(jsonb_build_object('rows',rows)::text)>921600 then raise exception 'rows : commande isolée requise';end if;
  return public.l5_apply_source_command(rows->0);
 end if;
 return public.l2_sync_push_v2(rows);
end $$;
create or replace function public.sync_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('recipe_lifecycle',1,'edition_lifecycle',1,'source_batches',1,'source_revisions',1);
$$;
-- Les helpers internes n’acceptent aucun appel client. Le seul helper exposé répète toutes les gardes de sa RPC.
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l5_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end $$;
grant execute on function public.l5_guard_validate_initial_index(jsonb),public.l5_apply_source_command(jsonb),public.l5_pending_source(text,text),public.source_transfer_status(text) to authenticated;
revoke all on function public.source_transfer_status(text),public.l5_cleanup_transfers() from public,anon;
revoke all on function public.l5_cleanup_transfers() from authenticated;
grant execute on function public.l5_cleanup_transfers() to service_role;
grant execute on function public.l5_project_page(jsonb), public.l5_project_document(jsonb), public.l5_project_fields(jsonb,text,text[]), public.l5_page_rotation(jsonb) to authenticated;
-- Les projections de trigger composent les helpers canon sans accéder aux données d’un compte.
grant execute on function public.sync_push_v2(jsonb),public.l2_sync_push_v2(jsonb),public.sync_capabilities() to authenticated;
`;
}
