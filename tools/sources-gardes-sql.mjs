import {SYNC_STORES} from '../src/model/schema.js';

export const sourcesGardesSql=String.raw`
-- Cette validation élevée ne fait que lire le graphe du propriétaire authentifié.
create or replace function public.l5_guard_validate_initial_index(d jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c jsonb:=d->'index_call';begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 if octet_length(d::text)>524288 then perform public.l5_fail('too_large');end if;
 if d->>'kind' is distinct from 'index' or d->>'recipe_id' is not null or d->>'owner_id' is distinct from auth.uid()::text
 or coalesce(d->>'status','') not in ('a_lancer','en_cours','a_verifier','echec','ignore') then perform public.l5_fail('invalid_shape');end if;
 if d->>'expected_edition_id' is distinct from d->>'edition_id' or d->>'expected_cycle_id' is not null then perform public.l5_fail('invalid_shape');end if;
 perform public.l5_cycle(d->>'edition_id',d->>'expected_edition_cycle_id',true);
 perform public.l5_check_capture(d->'source_capture',false);
 if not public.l5_index_keys(c,array['format','series_id','page_id','kind','parent_call_id'],array['format','series_id','page_id','kind','parent_call_id'])
 or c->'format' is distinct from '1'::jsonb or not public.l5_id(c->'series_id') or not public.l5_id(c->'page_id')
 or coalesce(c->>'kind','') not in ('full','left_half','right_half')
 or c->>'kind'='full' and c->'parent_call_id' is distinct from 'null'::jsonb
 or c->>'kind'<>'full' and not public.l5_id(c->'parent_call_id')
 or d->'page_ids' is distinct from jsonb_build_array(c->'page_id')
 or d->'source_capture'->'selected_page_ids' is distinct from d->'page_ids'
 or d->'source_capture'->'session_id' is distinct from d->'scan_session_id'
 or d->'source_capture'->'pages'->0->'zone'->'kind' is distinct from c->'kind'
 or (public.l5_get('scan_sessions',d->>'scan_session_id')->'data'->>'edition_id') is distinct from d->>'edition_id' then perform public.l5_fail('invalid_shape');end if;
 if d->>'resultat' is not null or d->>'status'='a_verifier' then perform public.l5_index_result(d);end if;
end $$;

create or replace function public.l5_guard_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;d jsonb;k text;managed boolean;initial_index boolean;begin
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

-- Une purge volontaire reste possible, explicitement authentifiée et limitée à ce propriétaire.
-- Les anciens marqueurs L1 sont restaurés ; ils n'autorisent jamais seuls les écritures L5.
create or replace function public.sync_purge_all() returns integer
language plpgsql security definer set search_path='' as $$
declare s text;n integer:=0;k integer;before_purge text;before_l1 text;begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();before_purge:=coalesce(current_setting('app.purge',true),'');before_l1:=coalesce(current_setting('app.l1_purge_all',true),'');
 perform set_config('app.purge','on',true);perform set_config('app.l1_purge_all','on',true);
 foreach s in array array[`+SYNC_STORES.map(s=>"'"+s+"'").join(',')+String.raw`] loop
  execute format('delete from public.%I where owner_id=auth.uid()',s);get diagnostics k=row_count;n:=n+k;
 end loop;
 perform set_config('app.purge',before_purge,true);perform set_config('app.l1_purge_all',before_l1,true);return n;
end $$;
revoke all on function public.sync_purge_all() from public,anon;
grant execute on function public.sync_purge_all() to authenticated;
`;
