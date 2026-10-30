// L8 — projections et validations pures partagées avec inventaire-format.js.
import {CHAMPS_STOCK,CHAMPS_RESERVES_INVENTAIRE,CHAMPS_SOURCE_INVENTAIRE} from '../src/domain/inventaire-format.js';
const quote=s=>"'"+s.replaceAll("'","''")+"'",keys=xs=>'array['+xs.map(quote).join(',')+']::text[]';
export const inventaireCanonSql=String.raw`
create or replace function public.l8_op(v jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')=70 and v#>>'{}' ~ '^iv_op_[a-f0-9]{64}$',false)$$;
create or replace function public.l8_date(v jsonb) returns boolean language sql immutable set search_path='' as $$select public.l7_date(v)$$;
create or replace function public.l8_civil_date(v jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')=10 and left(v#>>'{}',4)<>'0000' and public.l7_date(to_jsonb((v#>>'{}')||'T00:00:00.000Z')),false)$$;
create or replace function public.l8_quantity(v jsonb,unit text) returns numeric language plpgsql immutable set search_path='' as $$
declare n numeric;limit_value numeric;begin
 if jsonb_typeof(v) is distinct from 'number' or unit is null or unit not in ('portion','piece','g','kg','ml','l') then return null;end if;
 n:=(v::text)::numeric;if n<0 then return null;end if;limit_value:=case when unit in ('portion','piece') then 1000 else 1000000000 end;
 if n>limit_value or trunc(n*1000000)<>n*1000000 then return null;end if;return n*1000000;
 exception when others then return null;
end$$;
create or replace function public.l8_valid_stock(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare remaining_value numeric;initial_value numeric;begin
 if not public.l5_exact_keys(s,${keys(CHAMPS_STOCK)}) or s->'format' is distinct from '1'::jsonb or coalesce(s->>'state','') not in ('available','finished') then return false;end if;
 if s->'unit'='null'::jsonb then return s->'initial'='null'::jsonb and s->'remaining'='null'::jsonb;end if;
 remaining_value:=public.l8_quantity(s->'remaining',s->>'unit');if remaining_value is null then return false;end if;
 if s->'initial'<>'null'::jsonb then initial_value:=public.l8_quantity(s->'initial',s->>'unit');if initial_value is null or remaining_value>initial_value then return false;end if;end if;
 return (s->>'state'='available' and remaining_value>0) or (s->>'state'='finished' and remaining_value=0);
 exception when others then return false;
end$$;
create or replace function public.l8_valid_receipts(rs jsonb,floor_value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;seen text[]:='{}';begin
 if jsonb_typeof(rs) is distinct from 'array' or jsonb_array_length(rs)>128 or not public.l5_index_int(floor_value,0,jsonb_array_length(rs)) then return false;end if;
 for r in select * from jsonb_array_elements(rs) loop
  if not public.l5_exact_keys(r,array['operation_id','payload_sha256']) or not public.l8_op(r->'operation_id') or not public.l6_hash(r->'payload_sha256') or (r->>'operation_id')=any(seen) then return false;end if;seen:=array_append(seen,r->>'operation_id');
 end loop;return true;
 exception when others then return false;
end$$;
create or replace function public.l8_valid_action(a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare b jsonb:=a->'before';n jsonb:=a->'after';begin
 if a='null'::jsonb then return true;end if;
 if not public.l5_exact_keys(a,array['operation_id','type','at','before','after','undo_of']) or not public.l8_op(a->'operation_id') or coalesce(a->>'type','') not in ('consume','finish','undo') or not public.l8_date(a->'at') or not public.l8_valid_stock(b) or not public.l8_valid_stock(n) then return false;end if;
 if a->>'type'='undo' then return public.l8_op(a->'undo_of') and a->'undo_of'<>a->'operation_id';end if;
 if a->'undo_of'<>'null'::jsonb or b->>'state'<>'available' or b->'unit'<>n->'unit' or b->'initial'<>n->'initial' then return false;end if;
 if a->>'type'='finish' then return n=b||jsonb_build_object('state','finished','remaining',case when b->'unit'='null'::jsonb then 'null'::jsonb else '0'::jsonb end);end if;
 return b->'unit'<>'null'::jsonb and public.l8_quantity(n->'remaining',n->>'unit')<public.l8_quantity(b->'remaining',b->>'unit');
 exception when others then return false;
end$$;
create or replace function public.l8_valid_inventory(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;begin
 if jsonb_typeof(r) is distinct from 'object' or not public.l6_id(r->'id') or not(r ?& ${keys(CHAMPS_RESERVES_INVENTAIRE)}) or not public.l8_op(r->'stock_revision') or not public.l8_valid_stock(r->'stock') or not public.l8_valid_action(r->'stock_last_action') or not public.l8_valid_receipts(r->'stock_receipts',r->'stock_receipt_floor') then return false;end if;
 foreach k in array array['ingredient_id','source_recipe_id','source_recipe_version_id','source_cook_history_id'] loop if r?k and r->k<>'null'::jsonb and not public.l6_id(r->k) then return false;end if;end loop;
 foreach k in array array['prepared_on','use_by_on'] loop if r?k and r->k<>'null'::jsonb and not public.l8_civil_date(r->k) then return false;end if;end loop;
 if r->'source_cook_history_id' is not null and r->'source_cook_history_id'<>'null'::jsonb and (not public.l6_id(r->'source_recipe_id') or not public.l6_id(r->'source_recipe_version_id')) then return false;end if;
 perform public.l5_canonical(r);return octet_length(r::text)<=524288;
 exception when others then return false;
end$$;
create or replace function public.l8_project_seed(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','inventory-seed-v1','data',r-'created_at'-'updated_at')$$;
create or replace function public.l8_project_source(source_type text,r jsonb) returns jsonb language plpgsql immutable set search_path='' as $$begin
 case source_type
 ${Object.entries(CHAMPS_SOURCE_INVENTAIRE).map(([type,fields])=>`when ${quote(type)} then return public.l5_project_fields(r,${quote('inventory-'+type+'-v1')},${keys(fields)});`).join('\n ')}
 else perform public.l5_fail('forme_invalide');end case;
end$$;
create or replace function public.l8_receipt(d jsonb,c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;begin
 if not public.l8_valid_inventory(d) then return false;end if;
 for r in select e.value from jsonb_array_elements(d->'stock_receipts') with ordinality e(value,n) where e.n>(d->>'stock_receipt_floor')::integer loop
  if r->'operation_id'=c->'operation_id' then if r->'payload_sha256' is distinct from c->'payload_sha256' then perform public.l5_fail('operation_invalide');end if;return true;end if;
 end loop;return false;
end$$;
create or replace function public.l8_add_receipt(d jsonb,c jsonb,restore boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$
declare rs jsonb:=coalesce(d->'stock_receipts','[]'::jsonb);f integer:=coalesce((d->>'stock_receipt_floor')::integer,0);removed_count integer;begin
 if restore then f:=jsonb_array_length(rs);end if;
 if not exists(select 1 from jsonb_array_elements(rs) r where r->'operation_id'=c->'operation_id') then rs:=rs||jsonb_build_array(jsonb_build_object('operation_id',c->'operation_id','payload_sha256',c->'payload_sha256'));end if;
 removed_count:=greatest(0,jsonb_array_length(rs)-128);if removed_count>0 then select coalesce(jsonb_agg(e.value order by e.n),'[]'::jsonb) into rs from jsonb_array_elements(rs) with ordinality e(value,n) where e.n>removed_count;end if;
 return d||jsonb_build_object('stock_revision',c->'operation_id','stock_receipts',rs,'stock_receipt_floor',greatest(0,f-removed_count));
end$$;
`;
