// L7 — gardes invoker : une RPC ancienne ou REST ne peut modifier les formes réservées.
export const cuisineGardesSql=String.raw`
create or replace function public.l7_validate_cooking_write(store_name text,before_data jsonb,after_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare protected boolean;begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 if store_name not in ('timer_launches','cook_sessions') or store_name is null then perform public.l5_fail('forme_invalide');end if;
 protected:=case when store_name='timer_launches' then coalesce(before_data ?| array['timer_format','mirror'],false) or coalesce(after_data ?| array['timer_format','mirror'],false)
  else coalesce(before_data?'cooking_state',false) or coalesce(after_data?'cooking_state',false) or coalesce(before_data->'progress'->'format'='2'::jsonb,false) or coalesce(after_data->'progress'->'format'='2'::jsonb,false) end;
 if not protected then return;end if;
 if before_data is null or after_data is null or before_data-'updated_at' is distinct from after_data-'updated_at' then perform public.l5_fail('cooking_reserved');end if;
 if not(case when store_name='timer_launches' then public.l7_valid_timer(after_data) else public.l7_valid_session(after_data) end) then perform public.l5_fail('cooking_reserved');end if;
end$$;
create or replace function public.l7_guard_cooking() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;reserved boolean;begin
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
drop trigger if exists l7_cooking_guard on public.timer_launches;
create trigger l7_cooking_guard before insert or update or delete on public.timer_launches for each row execute function public.l7_guard_cooking();
drop trigger if exists l7_cooking_guard on public.cook_sessions;
create trigger l7_cooking_guard before insert or update or delete on public.cook_sessions for each row execute function public.l7_guard_cooking();
-- La composition finale répète cette fermeture après la définition du dispatcher et de ses alias.
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l7_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end$$;
grant execute on function public.l7_validate_cooking_write(text,jsonb,jsonb) to authenticated;
`;
