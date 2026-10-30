import {inventaireCanonSql} from './inventaire-canon-sql.mjs';
import {inventaireGardesSql} from './inventaire-gardes-sql.mjs';
import {inventairePublicationSql} from './inventaire-publication-sql.mjs';
export function inventaireSQL(){return '-- 0013_inventaire.sql — généré, aucune exécution distante automatique.\n'+inventaireCanonSql+inventairePublicationSql+String.raw`
create or replace function public.l8_apply_inventory_command(c jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;server jsonb;motif text;previous text:=coalesce(current_setting('app.l1_write',true),'');begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;perform public.l2_lock_owner();
 begin
  perform set_config('app.l1_write',jsonb_build_object('archive_import',c->>'action'='restore')::text,true);result:=public.l8_inventory(c);perform set_config('app.l1_write',previous,true);
  return jsonb_build_object('accepted',jsonb_build_array(result),'adjusted','[]'::jsonb,'rejected','[]'::jsonb,'server_time',clock_timestamp());
 exception when check_violation or data_exception then
  motif:=sqlerrm;if motif not in ('forme_invalide','operation_invalide','operation_obsolete','bornes','restauration_changee','source_changee','cycle_change','stock_change','stock_invalide','lot_termine','quantite_inconnue','quantite_depassee','precision_invalide','annulation_indisponible') then motif:='forme_invalide';end if;
  server:=public.l8_get('inventory',c->>'id');perform set_config('app.l1_write',previous,true);return jsonb_build_object('accepted','[]'::jsonb,'adjusted','[]'::jsonb,'rejected',jsonb_build_array(jsonb_build_object('store','inventory','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','reason',motif,'server',server)),'server_time',clock_timestamp());
 end;
end$$;
`+inventaireGardesSql+String.raw`
-- L8 contrôle source et cycles dans la commande ; aucun ancien RPC ne reçoit cette exception de table.
do $patch$ declare nom text;definition text;clause text;begin
 foreach nom in array array['l1_guard_recipe','l2_guard_write'] loop
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=nom and p.pronargs=0;
  clause:='begin'||chr(10)||' if tg_table_name=''inventory'' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid=''public.l8_apply_inventory_command(jsonb)''::regprocedure) then if tg_op=''DELETE'' then return old;else return new;end if;end if;'||chr(10);
  definition:=regexp_replace(definition,'begin[[:space:]]',clause,'i');execute definition;
 end loop;
end $patch$;
alter function public.sync_push_v2(jsonb) rename to l7_sync_push_v2;
create function public.sync_push_v2(rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;perform public.l2_lock_owner();
 if exists(select 1 from jsonb_array_elements(rows) r where r->>'op'='inventory_change') then if jsonb_array_length(rows)<>1 or octet_length(jsonb_build_object('rows',rows)::text)>921600 then raise exception 'rows : commande isolée requise';end if;return public.l8_apply_inventory_command(rows->0);end if;return public.l7_sync_push_v2(rows);
end$$;
create or replace function public.sync_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('recipe_lifecycle',1,'edition_lifecycle',1,'source_batches',1,'source_revisions',1,'recipe_language',1,'cooking_persistence',1,'inventory_changes',1)$$;
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l8_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end$$;
revoke all on function public.sync_push_v2(jsonb),public.l7_sync_push_v2(jsonb),public.sync_capabilities() from public,anon,authenticated;
grant execute on function public.l8_validate_inventory_write(jsonb,jsonb,text),public.l8_apply_inventory_command(jsonb),public.sync_push_v2(jsonb),public.l7_sync_push_v2(jsonb),public.sync_capabilities() to authenticated;
`;}
