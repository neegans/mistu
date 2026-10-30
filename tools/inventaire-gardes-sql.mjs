// L8 — protège aussi la disparition de tous les marqueurs et les formes malformées.
export const inventaireGardesSql=String.raw`
create or replace function public.l8_validate_inventory_write(before_data jsonb,after_data jsonb,operation text) returns void language plpgsql security definer set search_path='' as $$
declare protected boolean;begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 if operation is null or operation not in ('INSERT','UPDATE','DELETE') then perform public.l5_fail('forme_invalide');end if;
 protected:=coalesce(before_data ?| array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'],false) or coalesce(after_data ?| array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'],false);
 if not protected then return;end if;
 if operation<>'UPDATE' or before_data is null or after_data is null or before_data-'updated_at' is distinct from after_data-'updated_at' or not public.l8_valid_inventory(after_data) then perform public.l5_fail('inventory_reserved');end if;
end$$;
create or replace function public.l8_guard_inventory() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;reserved boolean;begin
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
drop trigger if exists l8_inventory_guard on public.inventory;
create trigger l8_inventory_guard before insert or update or delete on public.inventory for each row execute function public.l8_guard_inventory();
-- Répété après la composition complète du dispatcher et de ses alias.
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l8_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end$$;
grant execute on function public.l8_validate_inventory_write(jsonb,jsonb,text) to authenticated;
`;
