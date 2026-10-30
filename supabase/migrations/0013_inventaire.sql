-- 0013_inventaire.sql — généré, aucune exécution distante automatique.

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
 if not public.l5_exact_keys(s,array['format','unit','initial','remaining','state']::text[]) or s->'format' is distinct from '1'::jsonb or coalesce(s->>'state','') not in ('available','finished') then return false;end if;
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
 if jsonb_typeof(r) is distinct from 'object' or not public.l6_id(r->'id') or not(r ?& array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor']::text[]) or not public.l8_op(r->'stock_revision') or not public.l8_valid_stock(r->'stock') or not public.l8_valid_action(r->'stock_last_action') or not public.l8_valid_receipts(r->'stock_receipts',r->'stock_receipt_floor') then return false;end if;
 foreach k in array array['ingredient_id','source_recipe_id','source_recipe_version_id','source_cook_history_id'] loop if r?k and r->k<>'null'::jsonb and not public.l6_id(r->k) then return false;end if;end loop;
 foreach k in array array['prepared_on','use_by_on'] loop if r?k and r->k<>'null'::jsonb and not public.l8_civil_date(r->k) then return false;end if;end loop;
 if r->'source_cook_history_id' is not null and r->'source_cook_history_id'<>'null'::jsonb and (not public.l6_id(r->'source_recipe_id') or not public.l6_id(r->'source_recipe_version_id')) then return false;end if;
 perform public.l5_canonical(r);return octet_length(r::text)<=524288;
 exception when others then return false;
end$$;
create or replace function public.l8_project_seed(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','inventory-seed-v1','data',r-'created_at'-'updated_at')$$;
create or replace function public.l8_project_source(source_type text,r jsonb) returns jsonb language plpgsql immutable set search_path='' as $$begin
 case source_type
 when 'recipe' then return public.l5_project_fields(r,'inventory-recipe-v1',array['id','lifecycle_id','trashed_at','edition_id','restored_from_edition']::text[]);
 when 'edition' then return public.l5_project_fields(r,'inventory-edition-v1',array['id','lifecycle_id','trashed_at','trash_mode']::text[]);
 when 'version' then return public.l5_project_fields(r,'inventory-version-v1',array['id','recipe_id']::text[]);
 when 'history' then return public.l5_project_fields(r,'inventory-history-v1',array['id','recipe_id','recipe_version_id']::text[]);
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

create or replace function public.l8_get(s text,k text) returns jsonb language plpgsql stable set search_path='' as $$declare r jsonb;begin
 if s not in ('inventory','recipes','book_editions','recipe_versions','cook_history') then perform public.l5_fail('forme_invalide');end if;
 execute format('select jsonb_build_object(''store'',$2,''id'',id,''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',s) into r using k,s;return r;
end$$;
create or replace function public.l8_data(s text,k text) returns jsonb language plpgsql stable set search_path='' as $$declare r jsonb:=public.l8_get(s,k);begin if r is null or r->>'deleted_at' is not null then return null;end if;return r->'data';end$$;
create or replace function public.l8_valid_patch(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare k text;v jsonb;begin
 if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) x where not(x=any(array['label','quantity_text','location','prepared_on','use_by_on','use_by_origin','reheat_method','expected_quality','notes']::text[]))) then return false;end if;
 for k,v in select * from jsonb_each(p) loop
  if k in ('prepared_on','use_by_on') then if v<>'null'::jsonb and not public.l8_civil_date(v) then return false;end if;
  elsif k='use_by_origin' then if v not in ('null'::jsonb,'"user"'::jsonb) then return false;end if;
  elsif k='location' then if v not in ('"congelateur"'::jsonb,'"frigo"'::jsonb,'"garde_manger"'::jsonb) then return false;end if;
  elsif jsonb_typeof(v) is distinct from 'string' or char_length(v#>>'{}')>(case when k='label' then 1000 else 10000 end) or k='label' and btrim(v#>>'{}',E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))='' then return false;end if;
 end loop;perform public.l5_canonical(p);return true;
 exception when others then return false;
end$$;
create or replace function public.l8_valid_new(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare k text;p jsonb:='{}';begin
 if not public.l5_exact_keys(r,array['id','label','ingredient_id','source_recipe_id','source_recipe_version_id','source_cook_history_id','quantity_text','portions','location','prepared_at','use_by','use_by_origin','prepared_on','use_by_on','reheat_method','expected_quality','notes','stock','created_at','updated_at']::text[]) or not public.l6_id(r->'id') or not public.l8_date(r->'created_at') or not public.l8_date(r->'updated_at') or r->'portions'<>'null'::jsonb or r->'prepared_at'<>'null'::jsonb or r->'use_by'<>'null'::jsonb or r->'ingredient_id'<>'null'::jsonb or not public.l8_valid_stock(r->'stock') or r->'stock'->>'state'<>'available' or r->'stock'->'unit'<>'null'::jsonb and r->'stock'->'initial'<>r->'stock'->'remaining' then return false;end if;
 foreach k in array array['label','quantity_text','location','prepared_on','use_by_on','use_by_origin','reheat_method','expected_quality','notes']::text[] loop p:=p||jsonb_build_object(k,r->k);end loop;if not public.l8_valid_patch(p) then return false;end if;
 foreach k in array array['source_recipe_id','source_recipe_version_id','source_cook_history_id'] loop if r->k<>'null'::jsonb and not public.l6_id(r->k) then return false;end if;end loop;
 return (r->'source_recipe_id'='null'::jsonb)=(r->'source_recipe_version_id'='null'::jsonb) and (r->'source_cook_history_id'='null'::jsonb or r->'source_recipe_id'<>'null'::jsonb);
 exception when others then return false;
end$$;
create or replace function public.l8_validate_command(c jsonb) returns void language plpgsql immutable set search_path='' as $$declare b jsonb:=c->'base';x jsonb:=c->'change';s jsonb:=c->'source';k text;v jsonb;begin
 if not public.l5_exact_keys(c,array['protocol','op','store','id','action','operation_id','nonce','payload_sha256','base','change','source']) or c->'protocol' is distinct from '1'::jsonb or c->>'op' is distinct from 'inventory_change' or c->>'store' is distinct from 'inventory' or not public.l6_id(c->'id') or not public.l6_id(c->'nonce') or not public.l8_op(c->'operation_id') or not public.l6_hash(c->'payload_sha256') or not public.l5_exact_keys(s,array['mode','recipe','edition','version','history']) or coalesce(s->>'mode','') not in ('none','active','historical','restore') then perform public.l5_fail('forme_invalide');end if;
 foreach k in array array['recipe','edition','version','history'] loop v:=s->k;if v<>'null'::jsonb and (not public.l5_exact_keys(v,array['id','sha256']) or not public.l6_id(v->'id') or not(v->'sha256'='null'::jsonb or public.l6_hash(v->'sha256'))) or s->>'mode'='none' and v<>'null'::jsonb then perform public.l5_fail('forme_invalide');end if;end loop;
 case c->>'action'
 when 'create' then if not public.l5_exact_keys(b,array['target']) or b->'target'<>'null'::jsonb or not public.l5_exact_keys(x,array['lot']) or x->'lot'->'id' is distinct from c->'id' or not public.l8_valid_new(x->'lot') then perform public.l5_fail('forme_invalide');end if;
 when 'adopt' then if not public.l5_exact_keys(b,array['legacy_sha256']) or not public.l6_hash(b->'legacy_sha256') or not public.l5_exact_keys(x,array['stock','patch']) or not public.l8_valid_stock(x->'stock') or not public.l8_valid_patch(x->'patch') then perform public.l5_fail('forme_invalide');end if;
 when 'restore' then if not public.l5_exact_keys(b,array['expected_target_sha256']) or not(b->'expected_target_sha256'='null'::jsonb or public.l6_hash(b->'expected_target_sha256')) or not public.l5_exact_keys(x,array['purpose','target']) or coalesce(x->>'purpose','') not in ('archive','bootstrap') or x->'target'->'id' is distinct from c->'id' or not public.l8_valid_inventory(x->'target') then perform public.l5_fail('forme_invalide');end if;
 else
  if not public.l5_exact_keys(b,case when c->>'action'='undo' then array['revision','seed_sha256','action_id'] else array['revision','seed_sha256'] end) or not public.l8_op(b->'revision') or not public.l6_hash(b->'seed_sha256') then perform public.l5_fail('forme_invalide');end if;
  case c->>'action'
  when 'edit' then if not public.l5_exact_keys(x,array['patch','stock']) or not public.l8_valid_patch(x->'patch') or not(x->'stock'='null'::jsonb or public.l8_valid_stock(x->'stock')) then perform public.l5_fail('forme_invalide');end if;
  when 'consume' then if not public.l5_exact_keys(x,array['amount','after','at']) or not public.l8_date(x->'at') or not public.l8_valid_stock(x->'after') or public.l8_quantity(x->'amount',x->'after'->>'unit') is null or public.l8_quantity(x->'amount',x->'after'->>'unit')=0 then perform public.l5_fail('forme_invalide');end if;
  when 'finish' then if not public.l5_exact_keys(x,array['after','at']) or not public.l8_date(x->'at') or not public.l8_valid_stock(x->'after') or x->'after'->>'state'<>'finished' then perform public.l5_fail('forme_invalide');end if;
  when 'undo' then if not public.l8_op(b->'action_id') or not public.l5_exact_keys(x,array['at']) or not public.l8_date(x->'at') then perform public.l5_fail('forme_invalide');end if;
  else perform public.l5_fail('forme_invalide');end case;
 end case;
 if octet_length(c::text)>786432 or octet_length(jsonb_build_object('rows',jsonb_build_array(c))::text)>921600 then perform public.l5_fail('bornes');end if;
 if public.l5_sha256(c-'payload_sha256') is distinct from c->>'payload_sha256' or 'iv_op_'||public.l5_sha256(jsonb_build_object('projection','inventory-intent-v1','command',c-'operation_id'-'payload_sha256')) is distinct from c->>'operation_id' then perform public.l5_fail('operation_invalide');end if;
end$$;
create or replace function public.l8_valid_recipe_cycle(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(r) is distinct from 'object' then return false;end if;
 if r->>'lifecycle_id' is null and r->>'trashed_at' is null then return true;end if;
 return coalesce(jsonb_typeof(r->'lifecycle_id')='string' and r->>'lifecycle_id' ~ '^[A-Za-z0-9_-]{1,200}$' and r?'trashed_at' and (r->'trashed_at'='null'::jsonb or public.l8_date(r->'trashed_at')),false);
end$$;
create or replace function public.l8_check_source(c jsonb,d jsonb) returns void language plpgsql stable set search_path='' as $$
declare s jsonb:=c->'source';refs jsonb;ids jsonb;r jsonb;e jsonb;v jsonb;h jsonb;k text;rid text;expected_mode text;begin
 v:=public.l8_data('recipe_versions',d->>'source_recipe_version_id');rid:=coalesce(d->>'source_recipe_id',v->>'recipe_id');r:=public.l8_data('recipes',rid);e:=public.l8_data('book_editions',r->>'edition_id');h:=public.l8_data('cook_history',d->>'source_cook_history_id');
 refs:=jsonb_build_object('recipe',r,'edition',e,'version',v,'history',h);ids:=jsonb_build_object('recipe',rid,'version',d->>'source_recipe_version_id','edition',r->>'edition_id','history',d->>'source_cook_history_id');
 expected_mode:=case when not exists(select 1 from jsonb_each(ids) z where z.value<>'null'::jsonb) then 'none' when c->>'action'='restore' then 'restore' when c->>'action'='create' and d->>'source_cook_history_id' is null then 'active' else 'historical' end;
 if s->>'mode' is distinct from expected_mode then perform public.l5_fail('source_changee');end if;
 foreach k in array array['recipe','edition','version','history'] loop
  if s->k->>'id' is distinct from ids->>k then perform public.l5_fail('source_changee');end if;
  if refs->k='null'::jsonb then if s->k->>'sha256' is not null then perform public.l5_fail('source_changee');end if;
  elsif public.l5_sha256(public.l8_project_source(k,refs->k)) is distinct from s->k->>'sha256' then perform public.l5_fail('source_changee');end if;
 end loop;
 if v is not null and v->>'recipe_id' is distinct from rid or h is not null and (h->>'recipe_id' is distinct from rid or h->>'recipe_version_id' is distinct from d->>'source_recipe_version_id') then perform public.l5_fail('source_changee');end if;
 if r is not null and (not public.l8_valid_recipe_cycle(r) or not coalesce(public.l2_valid_exception(r),false)) or e is not null and not public.l2_valid_edition(e) then perform public.l5_fail('cycle_change');end if;
 if c->>'action'='create' and expected_mode<>'none' then
  if r is null or v is null or expected_mode='historical' and h is null then perform public.l5_fail('source_changee');end if;
  if expected_mode='active' and not public.l2_recipe_active(r,e) then perform public.l5_fail('cycle_change');end if;
 end if;
end$$;
create or replace function public.l8_inventory(c jsonb) returns jsonb language plpgsql set search_path='' as $$
declare old jsonb;d jsonb;b jsonb:=c->'base';x jsonb:=c->'change';a text:=c->>'action';s jsonb;after_stock jsonb;last_action jsonb;rem numeric;used numeric;stamp timestamptz;row_result jsonb;begin
 perform public.l8_validate_command(c);old:=public.l8_get('inventory',c->>'id');if old->>'deleted_at' is not null then perform public.l5_fail('operation_obsolete');end if;d:=old->'data';
 if public.l8_receipt(d,c) then return jsonb_build_object('store','inventory','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','already_applied',true,'server_rows',jsonb_build_array(old));end if;
 if a='create' then if old is not null then perform public.l5_fail('stock_change');end if;d:=x->'lot'||jsonb_build_object('stock_revision',c->'operation_id','stock_last_action',null,'stock_receipts','[]'::jsonb,'stock_receipt_floor',0);perform public.l8_check_source(c,d);
 elsif a='restore' then
  if d is null then if b->'expected_target_sha256'<>'null'::jsonb then perform public.l5_fail('restauration_changee');end if;elsif public.l5_sha256(public.l8_project_seed(d)) is distinct from b->>'expected_target_sha256' or public.l8_project_seed(d) is distinct from public.l8_project_seed(x->'target') then perform public.l5_fail('restauration_changee');end if;
  d:=x->'target';perform public.l8_check_source(c,d);
 else
  if d is null or public.l5_sha256(public.l8_project_seed(d)) is distinct from (case when a='adopt' then b->>'legacy_sha256' else b->>'seed_sha256' end) then perform public.l5_fail('stock_change');end if;perform public.l8_check_source(c,d);
  if a='adopt' then if d ?| array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'] then perform public.l5_fail('stock_change');end if;d:=d||(x->'patch')||jsonb_build_object('stock',x->'stock','stock_revision',c->'operation_id','stock_last_action',null,'stock_receipts','[]'::jsonb,'stock_receipt_floor',0);
  else
   if not public.l8_valid_inventory(d) or d->'stock_revision' is distinct from b->'revision' then perform public.l5_fail('stock_change');end if;s:=d->'stock';
   if a='edit' then d:=d||(x->'patch')||jsonb_build_object('stock_last_action',null);if x->'stock'<>'null'::jsonb then d:=d||jsonb_build_object('stock',x->'stock');end if;
   elsif a='undo' then
    last_action:=d->'stock_last_action';if coalesce(last_action->>'type','') not in ('consume','finish') or last_action->'operation_id' is distinct from d->'stock_revision' or last_action->'operation_id' is distinct from b->'action_id' or s is distinct from last_action->'after' then perform public.l5_fail('annulation_indisponible');end if;
    after_stock:=last_action->'before';d:=d||jsonb_build_object('stock',after_stock,'stock_last_action',jsonb_build_object('operation_id',c->'operation_id','type','undo','at',x->'at','before',s,'after',after_stock,'undo_of',last_action->'operation_id'));
   else
    if s->>'state'<>'available' then perform public.l5_fail('lot_termine');end if;
    if a='consume' then if s->'unit'='null'::jsonb then perform public.l5_fail('quantite_inconnue');end if;rem:=public.l8_quantity(s->'remaining',s->>'unit');used:=public.l8_quantity(x->'amount',s->>'unit');if used is null or used<=0 then perform public.l5_fail('stock_invalide');end if;if used>rem then perform public.l5_fail('quantite_depassee');end if;after_stock:=s||jsonb_build_object('remaining',(rem-used)/1000000,'state',case when rem=used then 'finished' else 'available' end);
    else after_stock:=s||jsonb_build_object('remaining',case when s->'unit'='null'::jsonb then 'null'::jsonb else '0'::jsonb end,'state','finished');end if;
    if after_stock is distinct from x->'after' then perform public.l5_fail('stock_invalide');end if;d:=d||jsonb_build_object('stock',after_stock,'stock_last_action',jsonb_build_object('operation_id',c->'operation_id','type',a,'at',x->'at','before',s,'after',after_stock,'undo_of',null));
   end if;
  end if;
 end if;
 d:=public.l8_add_receipt(d,c,a='restore');stamp:=clock_timestamp();d:=d||jsonb_build_object('updated_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));if not(d?'created_at') then d:=d||jsonb_build_object('created_at',d->'updated_at');end if;
 if not public.l8_valid_inventory(d) then perform public.l5_fail('stock_invalide');end if;if a in ('create','adopt','edit') and octet_length((d-'stock'-'stock_revision'-'stock_last_action'-'stock_receipts'-'stock_receipt_floor')::text)+32768>524288 then perform public.l5_fail('bornes');end if;
 insert into public.inventory(owner_id,id,data,updated_at) values(auth.uid(),c->>'id',d,stamp) on conflict(owner_id,id) do update set data=excluded.data,updated_at=excluded.updated_at;
 row_result:=public.l8_get('inventory',c->>'id');return jsonb_build_object('store','inventory','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','server_rows',jsonb_build_array(row_result));
end$$;

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
