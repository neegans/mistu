// L6 — structure et immutabilité des versions publiées ; DELETE reste sous les portes L1/L2.
export const traductionsVersionsSql=String.raw`
create or replace function public.l6_id(value jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(value)='string' and char_length(value#>>'{}') between 1 and 200 and (value#>>'{}') !~ ('['||chr(1)||'-'||chr(31)||chr(127)||']'),false);
$$;
create or replace function public.l6_valid_structure(version jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare structure jsonb:=version->'ingredient_structure';b jsonb;v jsonb;ids text[]:='{}';heads text[]:='{}';foods text[]:='{}';trimchars text:=E'\t\n\r\f\v '||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
begin
 if not public.l5_exact_keys(structure,array['format','blocks']) or structure->'format' is distinct from '1'::jsonb or jsonb_typeof(structure->'blocks') is distinct from 'array' or jsonb_typeof(version->'ingredients') is distinct from 'array' then return false;end if;
 if jsonb_array_length(structure->'blocks')>300 or jsonb_array_length(version->'ingredients')>200 then return false;end if;
 for v in select * from jsonb_array_elements(version->'ingredients') loop if not public.l6_id(v->'id') or (v->>'id')=any(ids) then return false;end if;ids:=array_append(ids,v->>'id');end loop;
 for b in select * from jsonb_array_elements(structure->'blocks') loop
  if b->>'kind'='heading' then
   if not public.l5_exact_keys(b,array['kind','id','text']) or not public.l6_id(b->'id') or (b->>'id')=any(heads) or (b->>'id')=any(ids) or jsonb_typeof(b->'text') is distinct from 'string' or char_length(b->>'text')>300 or btrim(b->>'text',trimchars)='' then return false;end if;heads:=array_append(heads,b->>'id');
  elsif b->>'kind'='ingredient' then
   if not public.l5_exact_keys(b,array['kind','ingredient_id']) or not public.l6_id(b->'ingredient_id') then return false;end if;foods:=array_append(foods,b->>'ingredient_id');
  else return false;end if;
 end loop;
 return cardinality(heads)<=100 and foods=ids;
end $$;
create or replace function public.l6_project_version(version jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','published-version-v1','data',version-array['updated_at','created_at','status']);
$$;
create or replace function public.l6_check_version_transition(before_data jsonb,after_data jsonb,protected boolean default false) returns void language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(after_data) is distinct from 'object' then perform public.l5_fail('version_invalide');end if;
 if before_data is not null and not(before_data?'ingredient_structure') and after_data?'ingredient_structure' then perform public.l5_fail('version_immuable');end if;
 if after_data?'ingredient_structure' and not public.l6_valid_structure(after_data) then perform public.l5_fail('structure_invalide');end if;
 if before_data is not null and (before_data?'ingredient_structure' or protected) then
  if public.l6_project_version(before_data) is distinct from public.l6_project_version(after_data) then perform public.l5_fail('version_immuable');end if;
  if before_data->'status' is distinct from after_data->'status' and after_data->>'status' is distinct from 'tested' then perform public.l5_fail('statut_invalide');end if;
  if before_data->>'created_at' is not null and before_data->'created_at' is distinct from after_data->'created_at' then perform public.l5_fail('version_immuable');end if;
 end if;
end $$;
create or replace function public.l6_check_version_parents(uid uuid,row_data jsonb,nouvelle boolean) returns void language plpgsql stable security definer set search_path='' as $$
declare parent text;derived text:=row_data->'provenance'->>'derived_from';p jsonb;queue text[]:='{}';seen text[]:='{}';done text[]:='{}';graph jsonb:='{}';heights jsonb:='{}';edges jsonb;edge text;h integer;progress boolean;structured boolean:=row_data?'ingredient_structure';pstructured boolean:=false;i integer:=1;parents text[]:='{}';
begin
 if row_data->>'parent_version_id' is not null then parents:=array_append(parents,row_data->>'parent_version_id');end if;if derived is not null then parents:=array_append(parents,derived);end if;
 foreach parent in array parents loop
  select data into p from public.recipe_versions where owner_id=uid and id=parent and deleted_at is null;
  if p?'ingredient_structure' then pstructured:=true;end if;
  if (structured or nouvelle) and (p is null or p->>'recipe_id' is distinct from row_data->>'recipe_id' or not public.l6_id(to_jsonb(parent))) then perform public.l5_fail('parent_invalide');end if;
 end loop;
 if pstructured and not structured then perform public.l5_fail('structure_requise');end if;
 if not structured and not nouvelle then return;end if;
 if not public.l6_id(row_data->'id') or not public.l6_id(row_data->'recipe_id') or (cardinality(parents)=2 and parents[1]<>parents[2]) then perform public.l5_fail('parent_invalide');end if;
 if (row_data?'parent_version_id' and row_data->'parent_version_id'<>'null'::jsonb and not public.l6_id(row_data->'parent_version_id')) or (row_data->'provenance'?'derived_from' and row_data->'provenance'->'derived_from'<>'null'::jsonb and not public.l6_id(row_data->'provenance'->'derived_from')) then perform public.l5_fail('parent_invalide');end if;
 queue:=parents;
 while i<=cardinality(queue) loop
  parent:=queue[i];i:=i+1;if parent=row_data->>'id' then perform public.l5_fail('parent_cycle');end if;if parent=any(seen) then continue;end if;
  select data into p from public.recipe_versions where owner_id=uid and id=parent and deleted_at is null;
  if p is null or p->>'recipe_id' is distinct from row_data->>'recipe_id' then perform public.l5_fail('parent_invalide');end if;
  seen:=array_append(seen,parent);edges:='[]';
  if p->>'parent_version_id' is not null then if not public.l6_id(p->'parent_version_id') then perform public.l5_fail('parent_invalide');end if;edges:=edges||jsonb_build_array(p->'parent_version_id');queue:=array_append(queue,p->>'parent_version_id');end if;
  if p->'provenance'->>'derived_from' is not null and p->'provenance'->>'derived_from' is distinct from p->>'parent_version_id' then if not public.l6_id(p->'provenance'->'derived_from') then perform public.l5_fail('parent_invalide');end if;edges:=edges||jsonb_build_array(p->'provenance'->'derived_from');queue:=array_append(queue,p->'provenance'->>'derived_from');end if;
  graph:=graph||jsonb_build_object(parent,edges);
 end loop;
 -- Chaque ancêtre est lu une fois ; un DAG historique ne produit pas une explosion de chemins.
 while cardinality(done)<cardinality(seen) loop
  progress:=false;
  foreach parent in array seen loop
   if parent=any(done) then continue;end if;
   if exists(select 1 from jsonb_array_elements_text(graph->parent)e where not(e=any(done))) then continue;end if;
   h:=1;for edge in select jsonb_array_elements_text(graph->parent) loop h:=greatest(h,1+(heights->>edge)::integer);end loop;if h>256 then perform public.l5_fail('parent_cycle');end if;
   done:=array_append(done,parent);heights:=heights||jsonb_build_object(parent,h);progress:=true;
  end loop;
  if not progress then perform public.l5_fail('parent_cycle');end if;
 end loop;
end $$;
create or replace function public.l6_check_version_parents(uid uuid,row_data jsonb) returns void language sql stable security definer set search_path='' as $$select public.l6_check_version_parents(uid,row_data,false);$$;
create or replace function public.l6_validate_version_write(uid uuid,before_data jsonb,after_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare protected boolean;vid text:=coalesce(after_data->>'id',before_data->>'id');begin
 if auth.uid() is null or uid is distinct from auth.uid() or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 select exists(select 1 from public.recipe_translations where owner_id=uid and deleted_at is null and data->>'recipe_version_id'=vid and data->'alignment_format'='2'::jsonb) or exists(select 1 from public.imports where owner_id=uid and deleted_at is null and data->>'kind'='traduction' and data->>'source_version_id'=vid) into protected;
 if after_data is null then if before_data?'ingredient_structure' or protected then perform public.l5_fail('version_immuable');end if;return;end if;
 perform public.l6_check_version_transition(before_data,after_data,protected);
 perform public.l6_check_version_parents(uid,after_data,before_data is null);
end $$;
create or replace function public.l6_guard_version() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;begin
 perform public.l2_lock_owner();
 if tg_op='DELETE' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.sync_purge_all()'::regprocedure) and current_setting('app.purge',true)='on' and current_setting('app.l1_purge_all',true)='on' and old.owner_id=auth.uid() then return old;end if;
 if tg_op='DELETE' then perform public.l6_validate_version_write(old.owner_id,old.data,null);return old;end if;
 if tg_op='UPDATE' then if old.owner_id is distinct from new.owner_id or old.id is distinct from new.id then raise check_violation using message='version_immuable';end if;before_data:=old.data;if new.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then perform public.l6_validate_version_write(old.owner_id,old.data,null);end if;end if;
 perform public.l6_validate_version_write(new.owner_id,before_data,new.data);return new;
end $$;
drop trigger if exists l6_version_guard on public.recipe_versions;
create trigger l6_version_guard before insert or update or delete on public.recipe_versions for each row execute function public.l6_guard_version();
revoke all on function public.l6_id(jsonb),public.l6_valid_structure(jsonb),public.l6_project_version(jsonb),public.l6_check_version_transition(jsonb,jsonb,boolean),public.l6_check_version_parents(uuid,jsonb),public.l6_check_version_parents(uuid,jsonb,boolean),public.l6_guard_version(),public.l6_validate_version_write(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.l6_validate_version_write(uuid,jsonb,jsonb) to authenticated;
`;
