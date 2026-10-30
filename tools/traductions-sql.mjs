import {traductionsCanonSql} from './traductions-canon-sql.mjs';
import {traductionsVersionsSql} from './traductions-versions-sql.mjs';
import {traductionsJournauxSql} from './traductions-journaux-sql.mjs';
import {traductionsPublicationSql} from './traductions-publication-sql.mjs';
import {sourcesTransfertsSql} from './sources-transferts-sql.mjs';
export function traductionsSQL(){
 // L5 garde ses registres, ses délais et ses opérations. Seule une cible historique typée supplémentaire est admise.
 let transfer=sourcesTransfertsSql.match(/create or replace function public\.l5_transfer\(c jsonb\) returns jsonb[\s\S]*?end \$\$;/)?.[0];if(!transfer)throw Error('Transfert L5 introuvable');
 transfer=transfer.replace("perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',c->>'purpose' in ('archive','bootstrap','index_result'));", "if not(c->>'store'='imports' and c->>'purpose' in ('archive','bootstrap') and c->'part_count'='0'::jsonb and c->'row_count'='0'::jsonb) then perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',c->>'purpose' in ('archive','bootstrap','index_result'));end if;");
 const cycle="perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',purpose in ('archive','bootstrap','index_result'));";
 const finish=transfer.lastIndexOf(cycle);if(finish<0)throw Error('Cycle transfert introuvable');transfer=transfer.slice(0,finish)+"if not(h.store='imports' and purpose in ('archive','bootstrap') and target->>'kind'='traduction' and h.row_count=0 and (h.header->>'part_count')::integer=0 and public.l5_get('book_editions',c->>'edition_id') is null) then "+cycle+"end if;"+transfer.slice(finish+cycle.length);
 const marker=" else\n  if target->>'kind' is distinct from 'index'";
 if(!transfer.includes(marker))throw Error('Branche cible L5 introuvable');
 transfer=transfer.replace(marker," elsif target->>'kind'='traduction' then\n  if purpose not in ('archive','bootstrap') or h.row_count<>0 or (h.header->>'part_count')::integer<>0 then perform public.l5_fail('invalid_shape');end if;\n  target:=target||jsonb_build_object('created_at',coalesce(old_target->'created_at',to_jsonb(to_char(stamp at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))),'updated_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'));\n  if not public.l6_valid_journal(target) then perform public.l5_fail('invalid_shape');end if;\n  perform public.l6_check_journal_source(uid,target,true);\n else\n  if target->>'kind' is distinct from 'index'");
 return '-- 0011_ingredients_traductions.sql — généré par tools/generer-migrations.mjs.\n-- Protocole L6 ; aucun nouveau magasin, aucune migration distante automatique.\n'+traductionsVersionsSql+'\n'+traductionsCanonSql+'\n'+traductionsPublicationSql+'\n'+traductionsJournauxSql+'\n'+transfer+String.raw`
create or replace function public.l6_apply_translation_command(c jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare intent jsonb;result jsonb;motif text;server jsonb;prev text:=coalesce(current_setting('app.l1_write',true),'');begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;perform public.l2_lock_owner();
 begin
  if jsonb_typeof(c) is distinct from 'object' or c->'protocol' is distinct from '1'::jsonb or c->>'op' is distinct from 'translation_apply' or not public.l6_id(c->'id') or not public.l6_id(c->'nonce') or not public.l6_op(c->'operation_id') or not public.l6_hash(c->'payload_sha256') or public.l5_sha256(c-'payload_sha256') is distinct from c->>'payload_sha256' then perform public.l5_fail('operation_invalide');end if;
  if octet_length(c::text)>786432 or octet_length(jsonb_build_object('rows',jsonb_build_array(c))::text)>921600 then perform public.l5_fail('bornes');end if;
  intent:=c-'operation_id'-'payload_sha256';if c->>'mode'='publish' then intent:=jsonb_set(intent,'{translation}',(intent->'translation')-'revision');end if;
  if c->>'operation_id' is distinct from 'tr_op_'||public.l5_sha256(jsonb_build_object('projection','translation-intent-v1','command',intent)) then perform public.l5_fail('operation_invalide');end if;
  perform set_config('app.l1_write',jsonb_build_object('archive_import',c->>'mode'='restore','recipe_contexts',jsonb_build_array(jsonb_build_object('recipe_id',c->'recipe_id','expected_cycle_id',c->'base_cycle_id')),'edition_contexts',jsonb_build_array(jsonb_build_object('edition_id',c->'edition_id','expected_cycle_id',c->'base_edition_cycle_id')))::text,true);
  result:=public.l6_translation(c);perform set_config('app.l1_write',prev,true);return jsonb_build_object('accepted',jsonb_build_array(result),'adjusted','[]'::jsonb,'rejected','[]'::jsonb,'server_time',clock_timestamp());
 exception when check_violation or data_exception then
  motif:=sqlerrm;if motif not in ('forme_invalide','operation_invalide','operation_obsolete','bornes','source_changee','cycle_change','traductions_changees','alignement','journal_change','resolution_changee','sans_changement') then motif:='forme_invalide';end if;
  if c->>'store' in ('recipe_translations','imports') then server:=public.l6_get(c->>'store',c->>'id');end if;
  perform set_config('app.l1_write',prev,true);return jsonb_build_object('accepted','[]'::jsonb,'adjusted','[]'::jsonb,'rejected',jsonb_build_array(jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','reason',motif,'server',server)),'server_time',clock_timestamp());
 end;
end $$;
create or replace function public.l6_guard_translation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform public.l2_lock_owner();
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l6_apply_translation_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if (tg_op<>'INSERT' and (old.data->'alignment_format'='2'::jsonb or old.data->'translated_content'->'format'='2'::jsonb)) or (tg_op<>'DELETE' and (new.data->'alignment_format'='2'::jsonb or new.data->'translated_content'->'format'='2'::jsonb)) then raise check_violation using message='translation_reserved';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger imports_l6_guard before insert or update or delete on public.imports for each row execute function public.l6_guard_journal();
create trigger recipe_translations_l6_guard before insert or update or delete on public.recipe_translations for each row execute function public.l6_guard_translation();
-- La seule RPC élevée de traduction réutilise les gardes de contexte puis écrit l'historique exact.
-- Les corps déjà installés gardent toutes leurs autres exceptions L1/L2.
do $patch$ declare nom text;definition text;clause text;begin
 foreach nom in array array['l1_guard_recipe','l2_guard_write'] loop
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=nom and p.pronargs=0;
  clause:='begin'||chr(10)||' if tg_table_name=''recipe_translations'' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid=''public.l6_apply_translation_command(jsonb)''::regprocedure) then if tg_op=''DELETE'' then return old;else return new;end if;end if;'||chr(10);
  definition:=regexp_replace(definition,'begin[[:space:]]',clause,'i');execute definition;
 end loop;
end $patch$;
-- Le verrou propriétaire reste le premier verrou, y compris sur les anciennes RPC.
alter function public.sync_push_v2(jsonb) rename to l5_sync_push_v2;
create function public.sync_push_v2(rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;perform public.l2_lock_owner();
 if exists(select 1 from jsonb_array_elements(rows) r where r->>'op'='translation_apply') then if jsonb_array_length(rows)<>1 or octet_length(jsonb_build_object('rows',rows)::text)>921600 then raise exception 'rows : commande isolée requise';end if;return public.l6_apply_translation_command(rows->0);end if;
 return public.l5_sync_push_v2(rows);
end $$;
create or replace function public.sync_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object('recipe_lifecycle',1,'edition_lifecycle',1,'source_batches',1,'source_revisions',1,'recipe_language',1) $$;
-- Helpers privés ; les seules entrées auth sont la RPC et les validations de déclencheur explicitement réautorisées.
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l6_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end $$;
revoke all on function public.sync_push_v2(jsonb),public.l5_sync_push_v2(jsonb),public.sync_capabilities() from public,anon,authenticated;
grant execute on function public.l6_validate_version_write(uuid,jsonb,jsonb),public.l6_validate_journal_write(uuid,jsonb,text),public.l6_apply_translation_command(jsonb),public.sync_push_v2(jsonb),public.l5_sync_push_v2(jsonb),public.sync_capabilities() to authenticated;
`;
}
