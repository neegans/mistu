-- 0011_ingredients_traductions.sql — généré par tools/generer-migrations.mjs.
-- Protocole L6 ; aucun nouveau magasin, aucune migration distante automatique.

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


create or replace function public.l6_locale(value text) returns text language sql immutable set search_path='' as $$
 select case when value !~ '[^A-Za-z-]' and value ~ '^[A-Za-z]{2,3}(-[A-Za-z]{2})?$' then lower(split_part(value,'-',1))||case when position('-' in value)>0 then '-'||upper(split_part(value,'-',2)) else '' end else null end;
$$;
create or replace function public.l6_presence_path(row_data jsonb,path text) returns jsonb language sql immutable set search_path='' as $$
 select case when row_data #> string_to_array(path,'.') is null then jsonb_build_array(false) else jsonb_build_array(true,row_data #> string_to_array(path,'.')) end;
$$;
create or replace function public.l6_project_source(recipe jsonb,version jsonb,source_locale text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-source-v2','recipe_id',recipe->'id','recipe_version_id',version->'id','source_locale',source_locale,'fields',(select jsonb_agg(jsonb_build_array(k,public.l6_presence_path(version,k)) order by n) from unnest(array['servings','yield_text','ingredients','ingredient_structure','steps','notes','constraints','convention_snapshot','provenance.thermomix','provenance.thermomix_invalide','provenance.convention_snapshot','plan_invalide']::text[]) with ordinality f(k,n)));
$$;
create or replace function public.l6_project_source(recipe jsonb,version jsonb) returns jsonb language sql immutable set search_path='' as $$
 select public.l6_project_source(recipe,version,public.l6_locale(recipe->>'original_language'));
$$;
create or replace function public.l6_project_title(recipe jsonb,version jsonb) returns jsonb language sql immutable set search_path='' as $$
 select public.l5_project_fields(recipe,'translation-title-v1',array['display_title','original_title'])||jsonb_build_object('recipe_id',recipe->'id','recipe_version_id',version->'id');
$$;
create or replace function public.l6_project_reading(journal jsonb) returns jsonb language sql immutable set search_path='' as $$
 select public.l5_project_fields(journal,'translation-reading-v1',array['id','kind','recipe_id','source_version_id','target_locale','owner_id','edition_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id','started_at','model','translation_source_signature','translation_capture','translation_call','resultat']::text[]);
$$;
create or replace function public.l6_project_resolution(journal jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-resolution-v1','revision',coalesce(journal->'translation_resolution_revision','null'::jsonb),'resolutions',coalesce((select jsonb_agg(x order by convert_to(x->>'ref','UTF8'),n) from jsonb_array_elements(coalesce(nullif(journal->'translation_resolutions','null'::jsonb),'[]'::jsonb)) with ordinality a(x,n)),'[]'::jsonb));
$$;
create or replace function public.l6_project_candidate(row_data jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-candidate-v1','data',row_data-array['created_at','updated_at','publication_receipts']);
$$;
create or replace function public.l6_project_seed(row_data jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-seed-v1','data',row_data-array['created_at','updated_at']);
$$;
create or replace function public.l6_segment_ref(version_id text,kind text,source_id text,field text) returns text language sql immutable set search_path='' as $$
 select 'ts_'||public.l5_sha256(jsonb_build_array('translation-ref-v1',version_id,kind,source_id,field));
$$;
create or replace function public.l6_source_segment(version_id text,kind text,source_id text,field text,source_text jsonb,source_locale text) returns jsonb language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(source_text) is distinct from 'string' then perform public.l5_fail('source_invalide');end if;
 return jsonb_build_object('ref',public.l6_segment_ref(version_id,kind,source_id,field),'kind',kind,'source_id',source_id,'field',field,'text',source_text,'source_sha256',public.l5_sha256(jsonb_build_object('projection','translation-segment-v1','recipe_version_id',version_id,'kind',kind,'source_id',source_id,'field',field,'text',source_text,'source_locale',source_locale)));
end $$;
create or replace function public.l6_source_segments(recipe jsonb,version jsonb,source_locale text) returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb:='[]';v jsonb;title jsonb;keys text[][]:=array[['name_text','name'],['preparation','preparation'],['source_text','source']];k text[];vid text:=version->>'id';
begin
 if jsonb_typeof(recipe) is distinct from 'object' or jsonb_typeof(version) is distinct from 'object' or not public.l6_id(recipe->'id') or not public.l6_id(version->'id') or version->>'recipe_id' is distinct from recipe->>'id' or jsonb_typeof(version->'ingredients') is distinct from 'array' or jsonb_typeof(version->'steps') is distinct from 'array' then perform public.l5_fail('source_invalide');end if;
 if jsonb_array_length(version->'ingredients')>200 or jsonb_array_length(version->'steps')>200 or octet_length(version::text)>524288 then perform public.l5_fail('bornes');end if;
 if version?'ingredient_structure' and not public.l6_valid_structure(version) then perform public.l5_fail('structure_invalide');end if;
 if exists(select 1 from jsonb_array_elements(version->'ingredients') x where not public.l6_id(x->'id')) or exists(select 1 from jsonb_array_elements(version->'steps') x where not public.l6_id(x->'id')) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(version->'ingredients')x) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(version->'steps')x) then perform public.l5_fail('identites_invalides');end if;
 -- Même choix que display_title || original_title || '', sans transformer nombre/objet en texte.
 title:=recipe->'display_title';if title is null or title in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) then title:=recipe->'original_title';end if;if title is null or title in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) then title:='""'::jsonb;end if;
 r:=r||jsonb_build_array(public.l6_source_segment(vid,'title',vid,'text',title,source_locale));
 for v in select * from jsonb_array_elements(version->'ingredients') loop
  foreach k slice 1 in array keys loop
   if v?k[1] and v->k[1]<>'null'::jsonb and jsonb_typeof(v->k[1]) is distinct from 'string' then perform public.l5_fail('source_invalide');end if;
   if coalesce(v->>k[1],'')<>'' then r:=r||jsonb_build_array(public.l6_source_segment(vid,'ingredient',v->>'id',k[2],v->k[1],source_locale));end if;
  end loop;
 end loop;
 for v in select * from jsonb_array_elements(coalesce(version->'ingredient_structure'->'blocks','[]'::jsonb)) loop if v->>'kind'='heading' then r:=r||jsonb_build_array(public.l6_source_segment(vid,'heading',v->>'id','text',v->'text',source_locale));end if;end loop;
 for v in select * from jsonb_array_elements(version->'steps') loop r:=r||jsonb_build_array(public.l6_source_segment(vid,'step',v->>'id','text',v->'text',source_locale));end loop;
 foreach k slice 1 in array array[['notes','notes'],['yield_text','yield']] loop
  if version?k[1] and version->k[1]<>'null'::jsonb and jsonb_typeof(version->k[1]) is distinct from 'string' then perform public.l5_fail('source_invalide');end if;
  if coalesce(version->>k[1],'')<>'' then r:=r||jsonb_build_array(public.l6_source_segment(vid,k[2],vid,'text',version->k[1],source_locale));end if;
 end loop;
 if jsonb_array_length(r)>903 then perform public.l5_fail('bornes');end if;return r;
end $$;
revoke all on function public.l6_locale(text),public.l6_presence_path(jsonb,text),public.l6_project_source(jsonb,jsonb,text),public.l6_project_source(jsonb,jsonb),public.l6_project_title(jsonb,jsonb),public.l6_project_reading(jsonb),public.l6_project_resolution(jsonb),public.l6_project_candidate(jsonb),public.l6_project_seed(jsonb),public.l6_segment_ref(text,text,text,text),public.l6_source_segment(text,text,text,text,jsonb,text),public.l6_source_segments(jsonb,jsonb,text) from public,anon,authenticated;


create or replace function public.l6_get(s text,k text) returns jsonb language plpgsql stable set search_path='' as $$
declare r jsonb;begin
 if s not in ('recipes','recipe_versions','recipe_translations','book_editions','imports') then perform public.l5_fail('forme_invalide');end if;
 execute format('select jsonb_build_object(''store'',$2,''id'',id,''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',s) into r using k,s;return r;
end $$;
create or replace function public.l6_put(s text,k text,d jsonb) returns jsonb language plpgsql set search_path='' as $$
declare stamp timestamptz:=clock_timestamp();v jsonb;begin
 if s not in ('recipe_translations','imports') or d->>'id' is distinct from k then perform public.l5_fail('forme_invalide');end if;
 v:=d||jsonb_build_object('updated_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 if not(v?'created_at') then v:=v||jsonb_build_object('created_at',v->'updated_at');end if;
 if octet_length(v::text)>524288 then perform public.l5_fail('bornes');end if;
 execute format('insert into public.%I(owner_id,id,data,updated_at) values(auth.uid(),$1,$2,$3) on conflict(owner_id,id) do update set data=excluded.data,updated_at=excluded.updated_at',s) using k,v,stamp;return public.l6_get(s,k);
end $$;
create or replace function public.l6_hash(v jsonb) returns boolean language sql immutable set search_path='' as $$ select coalesce(jsonb_typeof(v)='string' and v#>>'{}' ~ '^[a-f0-9]{64}$',false) $$;
create or replace function public.l6_op(v jsonb) returns boolean language sql immutable set search_path='' as $$ select coalesce(jsonb_typeof(v)='string' and v#>>'{}' ~ '^tr_op_[a-f0-9]{64}$',false) $$;
create or replace function public.l6_ref(v jsonb) returns boolean language sql immutable set search_path='' as $$ select coalesce(jsonb_typeof(v)='string' and v#>>'{}' ~ '^ts_[a-f0-9]{64}$',false) $$;
create or replace function public.l6_segment_bound(s jsonb) returns integer language sql immutable set search_path='' as $$
 select case when s->>'kind'='title' and s->>'field'='text' then 1000 when s->>'kind'='ingredient' and s->>'field' in ('name','preparation','source') then 2000 when s->>'kind'='heading' and s->>'field'='text' then 300 when s->>'kind' in ('step','notes') and s->>'field'='text' then 10000 when s->>'kind'='yield' and s->>'field'='text' then 200 else null end;
$$;
create or replace function public.l6_valid_translation(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb;r jsonb;k text;seen text[]:='{}';total integer:=0;ids text[]:='{}';floor integer;begin
 if not public.l5_exact_keys(d,array['id','recipe_version_id','locale','alignment_format','source_signature','source_locale','revision','translated_content','verification_state','publication_receipts','publication_receipt_floor','created_at','updated_at']) or not public.l6_id(d->'id') or not public.l6_id(d->'recipe_version_id') or coalesce(d->>'locale','') not in ('fr','en') or d->'alignment_format' is distinct from '2'::jsonb or not public.l6_hash(d->'source_signature') or d->'source_locale'<>'null'::jsonb and public.l6_locale(d->>'source_locale') is distinct from d->>'source_locale' or not public.l6_op(d->'revision') or d->>'verification_state' is distinct from 'unverified' or not public.l5_exact_keys(d->'translated_content',array['format','segments']) or d->'translated_content'->'format' is distinct from '2'::jsonb or jsonb_typeof(d->'translated_content'->'segments') is distinct from 'array' or jsonb_array_length(d->'translated_content'->'segments')>903 or jsonb_typeof(d->'publication_receipts') is distinct from 'array' or jsonb_array_length(d->'publication_receipts')>128 or not public.l5_index_int(d->'publication_receipt_floor',0,jsonb_array_length(d->'publication_receipts')) or not public.l6_journal_date(d->'created_at') or not public.l6_journal_date(d->'updated_at') or octet_length(d::text)>524288 then return false;end if;
 begin perform (d->>'created_at')::timestamptz;perform (d->>'updated_at')::timestamptz;exception when others then return false;end;
 for r in select value from jsonb_array_elements(d->'publication_receipts') loop if not public.l5_exact_keys(r,array['operation_id','payload_sha256']) or not public.l6_op(r->'operation_id') or not public.l6_hash(r->'payload_sha256') or r->>'operation_id'=any(ids) then return false;end if;ids:=array_append(ids,r->>'operation_id');end loop;
 for s in select value from jsonb_array_elements(d->'translated_content'->'segments') loop
  if not public.l5_exact_keys(s,array['kind','source_id','field','source_sha256','text','origin','journal_id']) or not public.l6_id(s->'source_id') or not public.l6_hash(s->'source_sha256') or public.l6_segment_bound(s) is null then return false;end if;
  k:=jsonb_build_array(s->'kind',s->'source_id',s->'field')::text;if k=any(seen) then return false;end if;seen:=array_append(seen,k);
  if s->'text'='null'::jsonb then if s->'origin'<>'null'::jsonb or s->'journal_id'<>'null'::jsonb then return false;end if;
  else if jsonb_typeof(s->'text') is distinct from 'string' or length(s->>'text')>public.l6_segment_bound(s) or not ((coalesce(s->>'origin','')='manual' and s->'journal_id'='null'::jsonb) or (coalesce(s->>'origin','')='ai' and public.l6_id(s->'journal_id'))) then return false;end if;total:=total+length(s->>'text');end if;
 end loop;return total<=200000;
end $$;
create or replace function public.l6_context(c jsonb,historical boolean default false) returns jsonb language plpgsql stable set search_path='' as $$
declare r jsonb;v jsonb;e jsonb;rid text:=c->>'recipe_id';vid text:=c->>'recipe_version_id';begin
 r:=public.l6_get('recipes',rid);v:=public.l6_get('recipe_versions',vid);
 if r is null or v is null or r->>'deleted_at' is not null or v->>'deleted_at' is not null or v->'data'->>'recipe_id' is distinct from rid then perform public.l5_fail('source_changee');end if;r:=r->'data';v:=v->'data';
 if r->>'edition_id' is distinct from c->>'edition_id' or r->>'lifecycle_id' is distinct from c->>'base_cycle_id' or (not historical and r->>'trashed_at' is not null) or not public.l2_valid_exception(r) then perform public.l5_fail('cycle_change');end if;
 if c->>'edition_id' is not null then e:=public.l6_get('book_editions',c->>'edition_id');if e is null or e->>'deleted_at' is not null or not public.l2_valid_edition(e->'data') or e->'data'->>'lifecycle_id' is distinct from c->>'base_edition_cycle_id' then perform public.l5_fail('cycle_change');end if;e:=e->'data';if not historical and e->>'trashed_at' is not null and e->>'trash_mode'<>'keep_recipes' and r->'restored_from_edition'->>'lifecycle_id' is distinct from e->>'lifecycle_id' then perform public.l5_fail('cycle_change');end if;
 elsif c->>'base_edition_cycle_id' is not null then perform public.l5_fail('forme_invalide');end if;
 return jsonb_build_object('recipe',r,'version',v,'edition',e);
end $$;
create or replace function public.l6_check_alignment(t jsonb,recipe jsonb,version jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare expected jsonb;seg jsonb;s jsonb;i integer:=0;begin
 if not public.l6_valid_translation(t) or t->>'recipe_version_id' is distinct from version->>'id' or public.l5_sha256(public.l6_project_source(recipe,version,t->>'source_locale')) is distinct from t->>'source_signature' then perform public.l5_fail('source_changee');end if;
 expected:=public.l6_source_segments(recipe,version,t->>'source_locale');if jsonb_array_length(expected)<>jsonb_array_length(t->'translated_content'->'segments') then perform public.l5_fail('alignement');end if;
 for s in select value from jsonb_array_elements(expected) loop seg:=t->'translated_content'->'segments'->i;if jsonb_build_array(s->'kind',s->'source_id',s->'field') is distinct from jsonb_build_array(seg->'kind',seg->'source_id',seg->'field') or s->>'kind'<>'title' and s->'source_sha256' is distinct from seg->'source_sha256' then perform public.l5_fail('alignement');end if;i:=i+1;end loop;return expected;
end $$;
create or replace function public.l6_add_receipt(d jsonb,c jsonb,restore boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$
declare receipts jsonb:=coalesce(d->'publication_receipts','[]');floor integer:=coalesce((d->>'publication_receipt_floor')::integer,0);n integer;begin
 receipts:=receipts||jsonb_build_array(jsonb_build_object('operation_id',c->'operation_id','payload_sha256',c->'payload_sha256'));n:=greatest(0,jsonb_array_length(receipts)-128);select coalesce(jsonb_agg(value order by ordinality),'[]') into receipts from jsonb_array_elements(receipts) with ordinality where ordinality>n;
 floor:=case when restore then jsonb_array_length(receipts)-1 else greatest(0,floor-n) end;return d||jsonb_build_object('revision',c->'operation_id','publication_receipts',receipts,'publication_receipt_floor',floor);
end $$;
create or replace function public.l6_has_receipt(d jsonb,c jsonb,field_name text default 'publication_receipts') returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;floor integer:=case when field_name='publication_receipts' then coalesce((d->>'publication_receipt_floor')::integer,0) else 0 end;begin
 for r in select value from jsonb_array_elements(coalesce(d->field_name,'[]')) with ordinality where ordinality>floor loop if r->'operation_id'=c->'operation_id' then if r->'payload_sha256' is distinct from c->'payload_sha256' then perform public.l5_fail('operation_invalide');end if;return true;end if;end loop;return false;
end $$;
create or replace function public.l6_check_ai(t jsonb) returns void language plpgsql stable set search_path='' as $$
declare s jsonb;j jsonb;r jsonb;ref text;begin
 for s in select value from jsonb_array_elements(t->'translated_content'->'segments') where value->>'origin'='ai' loop
  j:=public.l6_get('imports',s->>'journal_id');if j is null or j->>'deleted_at' is not null or not public.l6_valid_journal(j->'data') then perform public.l5_fail('journal_change');end if;j:=j->'data';ref:=public.l6_segment_ref(t->>'recipe_version_id',s->>'kind',s->>'source_id',s->>'field');
  if j->>'source_version_id' is distinct from t->>'recipe_version_id' or j->>'translation_source_signature' is distinct from t->>'source_signature' or j->>'target_locale' is distinct from t->>'locale' or not exists(select 1 from jsonb_array_elements(j->'translation_call'->'segment_refs') x where x->>'ref'=ref and x->'source_sha256'=s->'source_sha256') or not exists(select 1 from jsonb_array_elements(j->'resultat'->'segments') x where x->>'ref'=ref and x->>'issue'='admis' and x->'text'=s->'text') or not exists(select 1 from jsonb_array_elements(j->'translation_resolutions') x where x->>'ref'=ref and x->>'decision'='adopte' and x->>'text_sha256'=public.l5_sha256(s->'text')) then perform public.l5_fail('journal_change');end if;
 end loop;
end $$;
create or replace function public.l6_resolve_journals(c jsonb,t jsonb default null) returns jsonb language plpgsql set search_path='' as $$
declare x jsonb;j jsonb;old jsonb;d jsonb;dec jsonb;s jsonb;cap jsonb;ref text;refs text[];seen text[]:='{}';prev text;allrows jsonb:='[]';res jsonb;receipts jsonb;status text;begin
 if jsonb_typeof(c->'journal_read_set') is distinct from 'array' or jsonb_array_length(c->'journal_read_set')>499 then perform public.l5_fail('forme_invalide');end if;
 for x in select value from jsonb_array_elements(c->'journal_read_set') loop
  if not public.l5_exact_keys(x,array['journal_id','reading_sha256','resolution_sha256','base_resolution_revision','decisions']) or not public.l6_id(x->'journal_id') or not public.l6_hash(x->'reading_sha256') or not public.l6_hash(x->'resolution_sha256') or not(x->'base_resolution_revision'='null'::jsonb or public.l6_op(x->'base_resolution_revision')) or jsonb_typeof(x->'decisions') is distinct from 'array' or jsonb_array_length(x->'decisions') not between 1 and 24 or (prev is not null and convert_to(prev,'UTF8')>=convert_to(x->>'journal_id','UTF8')) then perform public.l5_fail('forme_invalide');end if;prev:=x->>'journal_id';
  old:=public.l6_get('imports',x->>'journal_id');if old is null or old->>'deleted_at' is not null then perform public.l5_fail('journal_change');end if;j:=old->'data';
  if not public.l6_valid_journal(j) or j->>'owner_id' is distinct from auth.uid()::text or public.l5_sha256(public.l6_project_reading(j)) is distinct from x->>'reading_sha256' or public.l5_sha256(public.l6_project_resolution(j)) is distinct from x->>'resolution_sha256' or j->'translation_resolution_revision' is distinct from x->'base_resolution_revision' then perform public.l5_fail('journal_change');end if;
  res:=j->'translation_resolutions';refs:='{}';
  for dec in select value from jsonb_array_elements(x->'decisions') loop
   ref:=dec->>'ref';if not public.l5_exact_keys(dec,array['ref','decision','text_sha256']) or not public.l6_ref(dec->'ref') or not(dec->>'decision' in ('adopte','ecarte')) or ref=any(refs) or array_length(refs,1)>0 and convert_to(refs[array_length(refs,1)],'UTF8')>=convert_to(ref,'UTF8') or exists(select 1 from jsonb_array_elements(res) r where r->>'ref'=ref) then perform public.l5_fail('resolution_changee');end if;refs:=array_append(refs,ref);
   select value into cap from jsonb_array_elements(j->'translation_call'->'segment_refs') where value->>'ref'=ref;if not found then perform public.l5_fail('resolution_changee');end if;
   if dec->>'decision'='ecarte' then if dec->'text_sha256'<>'null'::jsonb then perform public.l5_fail('forme_invalide');end if;
   else
    if t is null or not public.l6_hash(dec->'text_sha256') or j->>'source_version_id' is distinct from t->>'recipe_version_id' or j->>'target_locale' is distinct from t->>'locale' or j->>'translation_source_signature' is distinct from t->>'source_signature' then perform public.l5_fail('journal_change');end if;
    select value into s from jsonb_array_elements(t->'translated_content'->'segments') where public.l6_segment_ref(t->>'recipe_version_id',value->>'kind',value->>'source_id',value->>'field')=ref;
    if not found or s->'text'='null'::jsonb or public.l5_sha256(s->'text') is distinct from dec->>'text_sha256' or not exists(select 1 from jsonb_array_elements(j->'resultat'->'segments') r where r->>'ref'=ref and r->>'issue'='admis') then perform public.l5_fail('journal_change');end if;
   end if;res:=res||jsonb_build_array(dec);
  end loop;
  select jsonb_agg(value order by convert_to(value->>'ref','UTF8')) into res from jsonb_array_elements(res);
  status:=case when jsonb_array_length(res)=jsonb_array_length(j->'translation_call'->'segment_refs') then case when exists(select 1 from jsonb_array_elements(res) r where r->>'decision'='adopte') then 'enregistre' else 'ignore' end else 'a_verifier' end;
  receipts:=j->'translation_resolution_receipts'||jsonb_build_array(jsonb_build_object('operation_id',c->'operation_id','payload_sha256',c->'payload_sha256'));
  d:=j||jsonb_build_object('translation_resolutions',res,'translation_resolution_revision',c->'operation_id','translation_resolution_receipts',receipts,'status',status);if not public.l6_valid_journal(d) then perform public.l5_fail('journal_change');end if;allrows:=allrows||jsonb_build_array(public.l6_put('imports',j->>'id',d));
 end loop;return allrows;
end $$;
create or replace function public.l6_translation(c jsonb) returns jsonb language plpgsql set search_path='' as $$
declare common text[]:=array['protocol','op','mode','store','id','operation_id','payload_sha256','nonce'];ctxkeys text[]:=array['recipe_id','recipe_version_id','edition_id','base_cycle_id','base_edition_cycle_id'];mode text:=c->>'mode';old jsonb;context jsonb;r jsonb;v jsonb;t jsonb;expected jsonb;actual jsonb;source jsonb;s jsonb;b jsonb;seg jsonb;ref text;changed jsonb:='[]';rows jsonb:='[]';i integer:=0;newrow jsonb;entry jsonb;replay boolean;begin
 old:=public.l6_get(c->>'store',c->>'id');
 if old is not null and old->>'deleted_at' is not null then perform public.l5_fail('operation_obsolete');end if;
 if mode in ('publish','restore') then
  if c->>'store'<>'recipe_translations' or not public.l5_exact_keys(c,common||ctxkeys||case when mode='publish' then array['locale','source_signature','title_sha256','expected_translations','changed_refs','journal_read_set','translation'] else array['purpose','expected_target_sha256','target'] end) then perform public.l5_fail('forme_invalide');end if;
  if old is not null and public.l6_valid_translation(old->'data') and public.l6_has_receipt(old->'data',c) then
   rows:=jsonb_build_array(old);for entry in select value from jsonb_array_elements(coalesce(c->'journal_read_set','[]')) loop newrow:=public.l6_get('imports',entry->>'journal_id');if newrow is null or newrow->>'deleted_at' is not null then perform public.l5_fail('journal_change');end if;rows:=rows||jsonb_build_array(newrow);end loop;
   return jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','already_applied',true,'server_rows',rows);end if;
  context:=public.l6_context(c,mode='restore');r:=context->'recipe';v:=context->'version';
 else
  if mode<>'resolve' or c->>'store'<>'imports' or not public.l5_exact_keys(c,common||array['journal_read_set']) or jsonb_typeof(c->'journal_read_set') is distinct from 'array' or jsonb_array_length(c->'journal_read_set')=0 or c->>'id' is distinct from c->'journal_read_set'->0->>'journal_id' then perform public.l5_fail('forme_invalide');end if;
  replay:=true;for entry in select value from jsonb_array_elements(c->'journal_read_set') loop newrow:=public.l6_get('imports',entry->>'journal_id');if newrow is null or newrow->>'deleted_at' is not null or newrow->'data'->>'owner_id' is distinct from auth.uid()::text or not public.l6_has_receipt(newrow->'data',c,'translation_resolution_receipts') then replay:=false;end if;rows:=rows||case when newrow is null then '[]'::jsonb else jsonb_build_array(newrow) end;end loop;
  if replay and jsonb_array_length(rows)>0 then return jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','already_applied',true,'server_rows',rows);end if;
  rows:=public.l6_resolve_journals(c,null);return jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','server_rows',rows);
 end if;
 if mode='restore' then
  t:=c->'target';if c->>'purpose' not in ('archive','bootstrap') or not public.l6_valid_translation(t) or t->>'id' is distinct from c->>'id' or t->>'recipe_version_id' is distinct from c->>'recipe_version_id' or not(c->'expected_target_sha256'='null'::jsonb or public.l6_hash(c->'expected_target_sha256')) then perform public.l5_fail('forme_invalide');end if;
  if old is null then if c->'expected_target_sha256'<>'null'::jsonb then perform public.l5_fail('traductions_changees');end if;
  elsif public.l5_sha256(public.l6_project_seed(old->'data')) is distinct from c->>'expected_target_sha256' or public.l6_project_seed(old->'data') is distinct from public.l6_project_seed(t) then perform public.l5_fail('traductions_changees');end if;
  perform public.l6_check_alignment(t,r,v);perform public.l6_check_ai(t);t:=public.l6_add_receipt(t,c,true);
 else
  t:=c->'translation';if t?'publication_receipts' or t?'publication_receipt_floor' then perform public.l5_fail('forme_invalide');end if;
  t:=t||jsonb_build_object('publication_receipts',coalesce(old->'data'->'publication_receipts','[]'),'publication_receipt_floor',coalesce(old->'data'->'publication_receipt_floor','0'));if not public.l6_valid_translation(t) or t->>'id' is distinct from c->>'id' or t->>'recipe_version_id' is distinct from c->>'recipe_version_id' or t->'revision' is distinct from c->'operation_id' or t->'locale' is distinct from c->'locale' or t->'source_signature' is distinct from c->'source_signature'  then perform public.l5_fail('forme_invalide');end if;
  if t->>'source_locale' is distinct from public.l6_locale(r->>'original_language') then perform public.l5_fail('source_changee');end if;source:=public.l6_check_alignment(t,r,v);
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'revision',x.data->'revision','row_sha256',public.l5_sha256(public.l6_project_candidate(x.data))) order by convert_to(x.id,'UTF8')),'[]') into actual from public.recipe_translations x where x.owner_id=auth.uid() and x.deleted_at is null and x.data->>'recipe_version_id'=c->>'recipe_version_id' and x.data->>'locale'=c->>'locale';
  if actual is distinct from c->'expected_translations' then perform public.l5_fail('traductions_changees');end if;
  for s in select value from jsonb_array_elements(source) loop seg:=t->'translated_content'->'segments'->i;b:=old->'data'->'translated_content'->'segments'->i;ref:=s->>'ref';
   if b is null then b:=jsonb_build_object('kind',s->'kind','source_id',s->'source_id','field',s->'field','source_sha256',s->'source_sha256','text',null,'origin',null,'journal_id',null);end if;
   if seg is distinct from b then
    changed:=changed||jsonb_build_array(ref);
    if s->>'kind'='title' and seg->'text'<>'null'::jsonb and (c->>'title_sha256' is distinct from public.l5_sha256(public.l6_project_title(r,v)) or seg->'source_sha256' is distinct from s->'source_sha256') then perform public.l5_fail('source_changee');end if;
    if seg->>'origin'='ai' and not exists(select 1 from jsonb_array_elements(c->'journal_read_set') j cross join lateral jsonb_array_elements(j->'decisions') d where j->>'journal_id'=seg->>'journal_id' and d->>'ref'=ref and d->>'decision'='adopte') then perform public.l5_fail('journal_change');end if;
   end if;i:=i+1;
  end loop;
  select coalesce(jsonb_agg(value order by convert_to(value#>>'{}','UTF8')),'[]') into changed from jsonb_array_elements(changed);
  if changed is distinct from c->'changed_refs' or jsonb_array_length(changed)=0 and jsonb_array_length(c->'journal_read_set')=0 then perform public.l5_fail('sans_changement');end if;
  rows:=public.l6_resolve_journals(c,t);perform public.l6_check_ai(t);t:=public.l6_add_receipt(t,c,false);
 end if;
 if not public.l6_valid_translation(t) then perform public.l5_fail('bornes');end if;rows:=jsonb_build_array(public.l6_put('recipe_translations',c->>'id',t))||rows;
 return jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','server_rows',rows);
end $$;


create or replace function public.l6_journal_date(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s text:=v#>>'{}';d timestamptz;begin
 if jsonb_typeof(v) is distinct from 'string' or s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$' then return false;end if;
 d:=s::timestamptz;
 return to_char(d at time zone 'UTC',case when length(s)=20 then 'YYYY-MM-DD"T"HH24:MI:SS"Z"' else 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"' end)=s;
 exception when data_exception then return false;
end $$;

create or replace function public.l6_valid_journal(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;c jsonb;a jsonb;t jsonb;p jsonb;r jsonb;s jsonb;x jsonb;refs text[]:='{}';resolved text[]:='{}';receipts text[]:='{}';has_title boolean:=false;i integer:=0;terminal boolean;begin
 if not public.l5_exact_keys(d,array['id','kind','recipe_id','source_version_id','target_locale','owner_id','edition_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id','started_at','finished_at','model','translation_source_signature','translation_capture','translation_call','resultat','translation_resolution_revision','translation_resolutions','translation_resolution_receipts','status','erreur','scan_session_id','page_ids','created_at','updated_at'])
 or d->>'kind' is distinct from 'traduction' or not public.l6_id(d->'id') or not public.l6_id(d->'recipe_id') or not public.l6_id(d->'source_version_id')
 or coalesce(d->>'target_locale','') not in ('fr','en') or coalesce(d->>'status','') not in ('a_lancer','en_cours','a_verifier','echec','enregistre','ignore')
 or d->'expected_edition_id' is distinct from d->'edition_id' or d->'edition_id'='null'::jsonb and d->'expected_edition_cycle_id'<>'null'::jsonb
 or d->'scan_session_id' is distinct from 'null'::jsonb or d->'page_ids' is distinct from '[]'::jsonb or not public.l6_hash(d->'translation_source_signature')
 or not public.l6_journal_date(d->'created_at') or not public.l6_journal_date(d->'updated_at') or octet_length(d::text)>524288 then return false;end if;
 foreach k in array array['owner_id','edition_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id'] loop if d->k<>'null'::jsonb and not public.l6_id(d->k) then return false;end if;end loop;
 foreach k in array array['started_at','finished_at'] loop if d->k<>'null'::jsonb and not public.l6_journal_date(d->k) then return false;end if;end loop;
 if d->'model'<>'null'::jsonb and (jsonb_typeof(d->'model') is distinct from 'string' or length(d->>'model')>80) or d->'erreur'<>'null'::jsonb and jsonb_typeof(d->'erreur') is distinct from 'string' then return false;end if;
 c:=d->'translation_capture';a:=d->'translation_call';
 if not public.l5_exact_keys(c,array['format','source_locale','title_capture']) or c->'format' is distinct from '1'::jsonb
 or c->'source_locale'<>'null'::jsonb and (jsonb_typeof(c->'source_locale') is distinct from 'string' or public.l6_locale(c->>'source_locale') is distinct from c->>'source_locale')
 or not public.l5_exact_keys(a,array['format','series_id','ordinal','segment_refs']) or a->'format' is distinct from '1'::jsonb or not public.l6_id(a->'series_id')
 or not public.l5_index_int(a->'ordinal',0,31) or jsonb_typeof(a->'segment_refs') is distinct from 'array' or jsonb_array_length(a->'segment_refs') not between 1 and 24 then return false;end if;
 for r in select value from jsonb_array_elements(a->'segment_refs') loop
  if not public.l5_exact_keys(r,array['ref','kind','source_id','field','source_sha256','output_max_points']) or not public.l6_ref(r->'ref') or r->>'ref'=any(refs)
  or not public.l6_id(r->'source_id') or not public.l6_hash(r->'source_sha256') or public.l6_segment_bound(r) is null
  or not public.l5_index_int(r->'output_max_points',1,public.l6_segment_bound(r)) then return false;end if;
  refs:=array_append(refs,r->>'ref');has_title:=has_title or r->>'kind'='title';
 end loop;
 t:=c->'title_capture';
 if has_title then
  if not public.l5_exact_keys(t,array['projection','recipe_id','recipe_version_id','fields']) or t->>'projection' is distinct from 'translation-title-v1' or t->'recipe_id' is distinct from d->'recipe_id' or t->'recipe_version_id' is distinct from d->'source_version_id'
  or jsonb_typeof(t->'fields') is distinct from 'array' or jsonb_array_length(t->'fields')<>2 then return false;end if;
  for i in 0..1 loop p:=t->'fields'->i;
   if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p)<>2 or p->>0 is distinct from (case when i=0 then 'display_title' else 'original_title' end) then return false;end if;
   p:=p->1;if jsonb_typeof(p) is distinct from 'array' or not(p='[false]'::jsonb or jsonb_array_length(p)=2 and p->0='true'::jsonb and (jsonb_typeof(p->1)='string' or p->1='null'::jsonb)) then return false;end if;
  end loop;
 elsif t is distinct from 'null'::jsonb then return false;end if;
 if d->'resultat'<>'null'::jsonb then
  x:=d->'resultat';if not public.l5_exact_keys(x,array['format','segments']) or x->'format' is distinct from '1'::jsonb or jsonb_typeof(x->'segments') is distinct from 'array' or jsonb_array_length(x->'segments')<>cardinality(refs) then return false;end if;
  i:=0;for s in select value from jsonb_array_elements(x->'segments') loop r:=a->'segment_refs'->i;
   if not public.l5_exact_keys(s,array['ref','text','issue']) or s->'ref' is distinct from r->'ref' or coalesce(s->>'issue','') not in ('admis','manquant','refuse')
   or s->>'issue'='admis' and (jsonb_typeof(s->'text') is distinct from 'string' or length(s->>'text')>(r->>'output_max_points')::integer)
   or s->>'issue'<>'admis' and s->'text' is distinct from 'null'::jsonb then return false;end if;i:=i+1;
  end loop;
 end if;
 if not(d->'translation_resolution_revision'='null'::jsonb or public.l6_op(d->'translation_resolution_revision')) or jsonb_typeof(d->'translation_resolutions') is distinct from 'array' or jsonb_array_length(d->'translation_resolutions')>cardinality(refs)
 or jsonb_typeof(d->'translation_resolution_receipts') is distinct from 'array' or jsonb_array_length(d->'translation_resolution_receipts')>24 then return false;end if;
 for x in select value from jsonb_array_elements(d->'translation_resolutions') loop
  if not public.l5_exact_keys(x,array['ref','decision','text_sha256']) or not(coalesce(x->>'ref','')=any(refs)) or x->>'ref'=any(resolved) or coalesce(x->>'decision','') not in ('adopte','ecarte')
  or x->>'decision'='ecarte' and x->'text_sha256' is distinct from 'null'::jsonb or x->>'decision'='adopte' and not public.l6_hash(x->'text_sha256') then return false;end if;
  resolved:=array_append(resolved,x->>'ref');
 end loop;
 for x in select value from jsonb_array_elements(d->'translation_resolution_receipts') loop
  if not public.l5_exact_keys(x,array['operation_id','payload_sha256']) or not public.l6_op(x->'operation_id') or not public.l6_hash(x->'payload_sha256') or x->>'operation_id'=any(receipts) then return false;end if;
  receipts:=array_append(receipts,x->>'operation_id');
 end loop;
 if cardinality(resolved)=0 and (d->'translation_resolution_revision'<>'null'::jsonb or cardinality(receipts)>0)
 or cardinality(resolved)>0 and (not(coalesce(d->>'translation_resolution_revision','')=any(receipts)) or d->'resultat'='null'::jsonb)
 or cardinality(receipts)>cardinality(resolved) then return false;end if;
 terminal:=cardinality(resolved)=cardinality(refs);
 if terminal then
  if d->>'status' is distinct from (case when exists(select 1 from jsonb_array_elements(d->'translation_resolutions') as decisions(value) where decisions.value->>'decision'='adopte') then 'enregistre' else 'ignore' end) then return false;end if;
 elsif d->>'status' in ('enregistre','ignore') then return false;end if;
 if d->>'status' in ('a_lancer','en_cours') and (d->'resultat'<>'null'::jsonb or cardinality(resolved)>0)
 or d->>'status'='a_lancer' and d->'started_at'<>'null'::jsonb or d->>'status'='en_cours' and d->'started_at'='null'::jsonb then return false;end if;
 perform public.l5_canonical(d);return true;
 exception when data_exception then return false;
end $$;

create or replace function public.l6_check_journal_source(uid uuid,d jsonb,historique boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare r jsonb;v jsonb;e jsonb;source jsonb;s jsonb;ref jsonb;p jsonb;k text;begin
 if uid is null or uid is distinct from auth.uid() or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 if not public.l6_valid_journal(d) then perform public.l5_fail('journal_invalide');end if;
 select data into r from public.recipes where owner_id=uid and id=d->>'recipe_id' and deleted_at is null;
 select data into v from public.recipe_versions where owner_id=uid and id=d->>'source_version_id' and deleted_at is null;
 if r is null or v is null then if historique then return;else perform public.l5_fail('source_changee');end if;end if;
 if v->>'recipe_id' is distinct from r->>'id' then perform public.l5_fail('association_changee');end if;
 if not historique then
  if d->>'owner_id' is distinct from uid::text or coalesce(r->'edition_id','null'::jsonb) is distinct from d->'edition_id'
  or coalesce(r->'lifecycle_id','null'::jsonb) is distinct from d->'expected_cycle_id' then perform public.l5_fail('cycle_change');end if;
  if r->>'edition_id' is not null then select data into e from public.book_editions where owner_id=uid and id=r->>'edition_id' and deleted_at is null;
   if e is null or coalesce(e->'lifecycle_id','null'::jsonb) is distinct from d->'expected_edition_cycle_id' then perform public.l5_fail('cycle_change');end if;
  end if;
  if not public.l2_recipe_active(r,e) or public.l6_locale(r->>'original_language') is distinct from d->'translation_capture'->>'source_locale' then perform public.l5_fail('source_changee');end if;
  if d->'translation_capture'->'title_capture'<>'null'::jsonb and public.l6_project_title(r,v) is distinct from d->'translation_capture'->'title_capture' then perform public.l5_fail('source_changee');end if;
 elsif d->'translation_capture'->'title_capture'<>'null'::jsonb then
  for p in select value from jsonb_array_elements(d->'translation_capture'->'title_capture'->'fields') loop
   k:=p->>0;if p->1->0='true'::jsonb then r:=jsonb_set(r,array[k],p->1->1,true);else r:=r-k;end if;
  end loop;
 end if;
 if public.l5_sha256(public.l6_project_source(r,v,d->'translation_capture'->>'source_locale')) is distinct from d->>'translation_source_signature' then perform public.l5_fail('source_changee');end if;
 source:=public.l6_source_segments(r,v,d->'translation_capture'->>'source_locale');
 for ref in select value from jsonb_array_elements(d->'translation_call'->'segment_refs') loop
  select value into s from jsonb_array_elements(source) x where x->>'ref'=ref->>'ref';
  if s is null or (s-array['text']) is distinct from (ref-array['output_max_points']) then perform public.l5_fail('source_changee');end if;
 end loop;
end $$;

-- Seul helper élevé accessible : lecture sous propriétaire authentifié, aucune écriture.
create or replace function public.l6_validate_journal_write(uid uuid,d jsonb,operation text) returns void language plpgsql security definer set search_path='' as $$
declare before_data jsonb;deleted timestamptz;begin
 if uid is null or uid is distinct from auth.uid() or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 if operation not in ('INSERT','UPDATE') or not public.l6_valid_journal(d) then raise check_violation using message='translation_reserved';end if;
 select data,deleted_at into before_data,deleted from public.imports where owner_id=uid and id=d->>'id';
 if deleted is not null then raise check_violation using message='translation_reserved';end if;
 if before_data is null then
  if operation<>'INSERT' or d->>'status'<>'a_lancer' or d->'finished_at'<>'null'::jsonb or d->'model'<>'null'::jsonb or d->'erreur'<>'null'::jsonb then raise check_violation using message='translation_reserved';end if;
  perform public.l6_check_journal_source(uid,d,false);return;
 end if;
 if before_data-'updated_at'=d-'updated_at' then return;end if;
 if before_data->>'kind' is distinct from 'traduction' or not public.l6_valid_journal(before_data)
 or before_data->'translation_resolutions' is distinct from d->'translation_resolutions' or before_data->'translation_resolution_receipts' is distinct from d->'translation_resolution_receipts' or before_data->'translation_resolution_revision' is distinct from d->'translation_resolution_revision' then raise check_violation using message='translation_reserved';end if;
 if before_data->>'status'='a_lancer' and d->>'status'='en_cours'
 and before_data-array['updated_at','status','started_at']=d-array['updated_at','status','started_at'] then
  perform public.l6_check_journal_source(uid,d,false);return;
 end if;
 if before_data->>'status'='en_cours' and d->>'status' in ('a_verifier','echec') and before_data->'resultat'='null'::jsonb and d->'resultat'<>'null'::jsonb and d->'finished_at'<>'null'::jsonb
 and before_data-array['updated_at','status','finished_at','model','resultat','erreur']=d-array['updated_at','status','finished_at','model','resultat','erreur'] then
  perform public.l6_check_journal_source(uid,d,true);return;
 end if;
 raise check_violation using message='translation_reserved';
end $$;
create or replace function public.l6_guard_journal() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;d jsonb;managed boolean;begin
 perform public.l2_lock_owner();
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l6_apply_translation_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='INSERT' then select data into before_data from public.imports where owner_id=new.owner_id and id=new.id;else before_data:=old.data;end if;
 d:=case when tg_op='DELETE' then '{}'::jsonb else new.data end;
 managed:=before_data->>'kind'='traduction' or d->>'kind'='traduction' or before_data ?| array['translation_capture','translation_call','translation_resolutions'] or d ?| array['translation_capture','translation_call','translation_resolutions'];
 if not coalesce(managed,false) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' or new.deleted_at is not null or new.id is distinct from d->>'id' or new.owner_id is distinct from auth.uid()
 or tg_op='UPDATE' and (old.owner_id is distinct from new.owner_id or old.id is distinct from new.id) then raise check_violation using message='translation_reserved';end if;
 perform public.l6_validate_journal_write(new.owner_id,d,tg_op);return new;
end $$;
revoke all on function public.l6_journal_date(jsonb),public.l6_valid_journal(jsonb),public.l6_check_journal_source(uuid,jsonb,boolean),public.l6_validate_journal_write(uuid,jsonb,text),public.l6_guard_journal() from public,anon,authenticated;
grant execute on function public.l6_validate_journal_write(uuid,jsonb,text) to authenticated;

create or replace function public.l5_transfer(c jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare uid uuid:=auth.uid();h private.mistu_source_transfers%rowtype;p private.mistu_source_transfer_parts%rowtype;phase text:=c->>'phase';tid text:=c->>'transfer_id';oid text:=c->>'operation_id';hash text:=c->>'payload_sha256';expected text;header jsonb;cur jsonb;d jsonb;r jsonb;x jsonb;partrows jsonb:='[]';keys jsonb:='[]';allrows jsonb:='[]';ack jsonb:='[]';target jsonb;chain text;stamp timestamptz:=clock_timestamp();ordinal integer;purpose text;manifest jsonb;newstate text;next_count integer;doc jsonb;old_target jsonb;k text;ref_count integer:=0;store text;rid text;common text[]:=array['protocol','op','operation_id','store','id','edition_id','base_edition_cycle_id','payload_sha256','transfer_id','phase'];
begin
 if phase not in ('begin','part','finish','abandon') or c->>'store' not in ('scan_sessions','imports') or not public.l5_id(c->'transfer_id') then perform public.l5_fail('invalid_shape');end if;
 expected:='st_op_'||public.l5_sha256(jsonb_build_object('projection','source-transfer-operation-v1','command',c-'operation_id'-'payload_sha256'));if oid is distinct from expected then perform public.l5_fail('invalid_shape');end if;
 select * into h from private.mistu_source_transfers t where t.owner_id=uid and t.transfer_id=tid for update;
 if phase='begin' then
  if not public.l5_exact_keys(c,common||array['purpose','nonce','requested_at','not_after','base_target_sha256','target_sha256','manifest_sha256','part_count','row_count']) or c->>'purpose' not in ('bootstrap','archive','attach','index_result') or (c->>'purpose'='index_result' and c->>'store'<>'imports') or (c->>'purpose'='attach' and c->>'store'<>'scan_sessions') or not public.l5_id(c->'nonce') or not public.l5_index_int(c->'part_count',0,4096) or not public.l5_index_int(c->'row_count',0,499*(c->>'part_count')::integer) or ((c->>'part_count')::integer=0)<>((c->>'row_count')::integer=0) or (c->>'not_after')::timestamptz-(c->>'requested_at')::timestamptz<>interval '720 hours' or (c->>'requested_at')::timestamptz>stamp+interval '5 minutes' then perform public.l5_fail('invalid_shape');end if;
  if not public.l5_index_hash(c->'target_sha256') or not public.l5_index_hash(c->'manifest_sha256') or not(c->'base_target_sha256'='null'::jsonb or public.l5_index_hash(c->'base_target_sha256')) then perform public.l5_fail('invalid_shape');end if;
  header:=jsonb_build_object('projection','source-transfer-intent-v1','purpose',c->'purpose','owner_id',uid::text,'nonce',c->'nonce','requested_at',c->'requested_at','not_after',c->'not_after','store',c->'store','id',c->'id','edition_id',c->'edition_id','base_edition_cycle_id',c->'base_edition_cycle_id','base_target_sha256',c->'base_target_sha256','target_sha256',c->'target_sha256','manifest_sha256',c->'manifest_sha256','part_count',c->'part_count','row_count',c->'row_count');
  if tid is distinct from 'st_'||public.l5_sha256(header) then perform public.l5_fail('owner_changed');end if;
  if h.transfer_id is not null then if h.begin_operation_id<>oid or h.begin_payload_sha256<>hash then perform public.l5_fail('transfer_changed');end if;if h.state='expired' or stamp>=(h.header->>'not_after')::timestamptz then perform public.l5_fail('transfer_expired');end if;return jsonb_build_object('store',c->'store','id',c->'id','operation_id',oid,'payload_sha256',hash,'server_rows','[]'::jsonb,'already_applied',true);end if;
  if stamp>=(c->>'not_after')::timestamptz then perform public.l5_fail('transfer_expired');end if;
  update private.mistu_source_transfers t set state='expired',closed_at=stamp,updated_at=stamp where t.owner_id=uid and t.state='receiving' and (t.header->>'not_after')::timestamptz<=stamp;
  if (select count(*) from private.mistu_source_transfers t where t.owner_id=uid and t.state='receiving')>=32 then perform public.l5_fail('too_large');end if;
  if exists(select 1 from private.mistu_source_transfers t where t.owner_id=uid and t.store=c->>'store' and t.id=c->>'id' and t.state='receiving') then perform public.l5_fail('transfer_changed');end if;
  if not(c->>'store'='imports' and c->>'purpose' in ('archive','bootstrap') and c->'part_count'='0'::jsonb and c->'row_count'='0'::jsonb) then perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',c->>'purpose' in ('archive','bootstrap','index_result'));end if;
  cur:=public.l5_get(c->>'store',c->>'id');if cur->>'deleted_at' is not null or (cur is null and c->>'base_target_sha256' is not null) or (cur is not null and public.l5_sha256(public.l5_project_transfer_base(cur->'data')) is distinct from c->>'base_target_sha256') then perform public.l5_fail('source_changed');end if;
  if c->>'store'='imports' then
   if c->>'purpose'='index_result' then
    if cur is null or coalesce(cur->'data'->>'status','') not in ('en_cours','a_verifier') or cur->'data'->>'owner_id' is distinct from uid::text or cur->'data'->>'kind' is distinct from 'index' or not(cur->'data'?'source_capture') then perform public.l5_fail('result_changed');end if;
   elsif cur is not null and public.l5_sha256(jsonb_build_object('projection','target-index-result-v1','data',(cur->'data')-'created_at'-'updated_at')) is distinct from c->>'target_sha256' then perform public.l5_fail('result_changed');end if;
  end if;
  chain:=public.l5_sha256(jsonb_build_array('source-transfer-chain-v1',hash));
  insert into private.mistu_source_transfers(owner_id,transfer_id,store,id,purpose,header,begin_operation_id,begin_payload_sha256,chain_sha256) values(uid,tid,c->>'store',c->>'id',c->>'purpose',c,oid,hash,chain);
  return jsonb_build_object('store',c->'store','id',c->'id','operation_id',oid,'payload_sha256',hash,'server_rows','[]'::jsonb);
 end if;
 if h.transfer_id is null then perform public.l5_fail('transfer_changed');end if;
 if h.store is distinct from c->>'store' or h.id is distinct from c->>'id' or h.header->'edition_id' is distinct from c->'edition_id' or h.header->'base_edition_cycle_id' is distinct from c->'base_edition_cycle_id' then perform public.l5_fail('transfer_changed');end if;
 if stamp>=(h.header->>'not_after')::timestamptz or h.state='expired' then perform public.l5_fail('transfer_expired');end if;
 purpose:=h.purpose;
 if phase='abandon' then
  if not public.l5_exact_keys(c,common||array['expected_next_part','expected_chain_sha256']) or not public.l5_index_int(c->'expected_next_part',0,4096) or not public.l5_index_hash(c->'expected_chain_sha256') or h.next_part is distinct from (c->>'expected_next_part')::integer or h.chain_sha256 is distinct from c->>'expected_chain_sha256' or h.state not in ('receiving','abandoned') then perform public.l5_fail('transfer_changed');end if;
  update private.mistu_source_transfers t set state='abandoned',closed_at=coalesce(t.closed_at,stamp),updated_at=stamp where t.owner_id=uid and t.transfer_id=tid;
  return jsonb_build_object('store',c->'store','id',c->'id','operation_id',oid,'payload_sha256',hash,'server_rows','[]'::jsonb);
 end if;
 if phase='part' then
  if not public.l5_exact_keys(c,common||array['ordinal','previous_chain_sha256','rows']) or jsonb_typeof(c->'rows') is distinct from 'array' or jsonb_array_length(c->'rows') not between 1 and 499 or not public.l5_index_int(c->'ordinal',0,4095) or not public.l5_index_hash(c->'previous_chain_sha256') then perform public.l5_fail('invalid_shape');end if;ordinal:=(c->>'ordinal')::integer;
  if ordinal<h.next_part then
   select * into p from private.mistu_source_transfer_parts t where t.owner_id=uid and t.transfer_id=tid and t.ordinal=(c->>'ordinal')::integer;
   if p.operation_id is distinct from oid or p.payload_sha256 is distinct from hash then perform public.l5_fail('transfer_changed');end if;
   select coalesce(jsonb_agg(jsonb_build_object('store',x->>0,'id',x->>1)),'[]') into keys from jsonb_array_elements(p.rows) x;return jsonb_build_object('store',c->'store','id',c->'id','operation_id',oid,'payload_sha256',hash,'server_rows',public.l5_ack_rows(keys),'already_applied',true);
  end if;
  if h.state<>'receiving' or ordinal<>h.next_part or ordinal>=(h.header->>'part_count')::integer or c->>'previous_chain_sha256' is distinct from h.chain_sha256 or h.row_count+jsonb_array_length(c->'rows')>(h.header->>'row_count')::integer then perform public.l5_fail('transfer_changed');end if;
  perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',purpose in ('archive','bootstrap','index_result'));
  for x in select * from jsonb_array_elements(c->'rows') loop
   store:=x->>'store';rid:=x->>'id';d:=x->'data';
   if not public.l5_exact_keys(x,array['store','id','data']) or not public.l5_id(x->'id') or d->>'id' is distinct from rid or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>524288 or d->>'edition_id' is distinct from c->>'edition_id' or (h.store='imports' and store not in ('imports','recipes')) or (h.store='scan_sessions' and store not in ('source_pages','source_documents')) or (store='recipes' and purpose not in ('archive','bootstrap')) then perform public.l5_fail('invalid_shape');end if;
   if exists(select 1 from jsonb_array_elements(partrows) y where y->>0=store and y->>1=rid) or exists(select 1 from private.mistu_source_transfer_parts t cross join lateral jsonb_array_elements(t.rows) y where t.owner_id=uid and t.transfer_id=tid and y->>0=store and y->>1=rid) then perform public.l5_fail('invalid_shape');end if;
   if store='source_documents' and d->>'scan_session_id' is distinct from h.id then perform public.l5_fail('invalid_shape');end if;
   if store='source_pages' then
    if not public.l5_valid_page(d) then perform public.l5_fail('invalid_shape');end if;
    if d->>'document_id' is not null then doc:=public.l5_get('source_documents',d->>'document_id')->'data';if doc is null or doc->>'scan_session_id' is distinct from h.id then perform public.l5_fail('invalid_shape');end if;end if;
   end if;
   if store='imports' and (d->'index_storage'->>'role'<>'result_fragment' or d->'index_storage'->>'manifest_id' is distinct from h.id) then perform public.l5_fail('invalid_shape');end if;
   if store='recipes' then
    if d->>'index_import_id' is distinct from h.id or not public.l5_ids(coalesce(d->'source_page_ids','[]')) or (d->>'availability' is not null and d->>'availability' not in ('available','partial','reference_only','unknown')) or not public.l2_valid_exception(d) then perform public.l5_fail('invalid_shape');end if;
    for rid in select jsonb_array_elements_text(coalesce(d->'source_page_ids','[]')||case when d->>'index_page_id' is not null then jsonb_build_array(d->>'index_page_id') else '[]'::jsonb end) loop
     doc:=public.l5_get('source_pages',rid);if doc is null or doc->>'deleted_at' is not null or doc->'data'->>'edition_id' is distinct from c->>'edition_id' then perform public.l5_fail('source_changed');end if;
    end loop;rid:=x->>'id';
    perform set_config('app.l1_write',jsonb_build_object('archive_import',true,'edition_contexts',jsonb_build_array(jsonb_build_object('edition_id',c->'edition_id','expected_cycle_id',c->'base_edition_cycle_id')))::text,true);
   end if;
   if store in ('source_pages','source_documents') then perform public.l5_check_copy(store,d);end if;
   cur:=public.l5_get(store,rid);if cur is not null then if cur->>'deleted_at' is not null or public.l5_project_seed(cur->'data')<>public.l5_project_seed(d) then perform public.l5_fail('id_collision');end if;else perform public.l5_put(store,rid,d);end if;
   perform set_config('app.l1_write','',true);
   if store='source_pages' then perform public.l5_closure(jsonb_build_array(rid),c->>'edition_id');end if;
   partrows:=partrows||jsonb_build_array(jsonb_build_array(store,rid,public.l5_sha256(public.l5_project_seed(d))));keys:=keys||jsonb_build_array(jsonb_build_object('store',store,'id',rid));
  end loop;
  chain:=public.l5_sha256(jsonb_build_array('source-transfer-chain-v1',h.chain_sha256,ordinal,hash));
  insert into private.mistu_source_transfer_parts(owner_id,transfer_id,ordinal,operation_id,payload_sha256,previous_chain_sha256,chain_sha256,rows) values(uid,tid,ordinal,oid,hash,h.chain_sha256,chain,partrows);
  update private.mistu_source_transfers t set next_part=t.next_part+1,row_count=t.row_count+jsonb_array_length(c->'rows'),chain_sha256=chain,updated_at=stamp where t.owner_id=uid and t.transfer_id=tid;
  return jsonb_build_object('store',c->'store','id',c->'id','operation_id',oid,'payload_sha256',hash,'server_rows',public.l5_ack_rows(keys));
 end if;
 if not public.l5_exact_keys(c,common||array['last_chain_sha256','target']) or not public.l5_index_hash(c->'last_chain_sha256') or jsonb_typeof(c->'target') is distinct from 'object' then perform public.l5_fail('invalid_shape');end if;
 if h.state='completed' then if h.receipt->>'operation_id' is distinct from oid or h.receipt->>'payload_sha256' is distinct from hash then perform public.l5_fail('transfer_changed');end if;return h.receipt||jsonb_build_object('already_applied',true,'server_rows',public.l5_ack_rows(jsonb_build_array(jsonb_build_object('store',h.store,'id',h.id))));end if;
 if h.state<>'receiving' or h.next_part<>(h.header->>'part_count')::integer or h.row_count<>(h.header->>'row_count')::integer or h.chain_sha256 is distinct from c->>'last_chain_sha256' then perform public.l5_fail('transfer_changed');end if;
 select coalesce(jsonb_agg(x order by t.ordinal,e.n),'[]') into manifest from private.mistu_source_transfer_parts t cross join lateral jsonb_array_elements(t.rows) with ordinality e(x,n) where t.owner_id=uid and t.transfer_id=tid;
 if public.l5_sha256(manifest) is distinct from h.header->>'manifest_sha256' then perform public.l5_fail('transfer_changed');end if;
 target:=c->'target';if target->>'id' is distinct from h.id or target->>'edition_id' is distinct from c->>'edition_id' then perform public.l5_fail('invalid_shape');end if;
 expected:=public.l5_sha256(case when h.store='scan_sessions' then public.l5_project_target(target) else jsonb_build_object('projection','target-index-result-v1','data',target) end);if expected is distinct from h.header->>'target_sha256' then perform public.l5_fail('transfer_changed');end if;
 cur:=public.l5_get(h.store,h.id);old_target:=cur->'data';if cur->>'deleted_at' is not null or (cur is null and h.header->>'base_target_sha256' is not null) or (cur is not null and public.l5_sha256(public.l5_project_transfer_base(cur->'data')) is distinct from h.header->>'base_target_sha256') then perform public.l5_fail('source_changed');end if;
 if not(h.store='imports' and purpose in ('archive','bootstrap') and target->>'kind'='traduction' and h.row_count=0 and (h.header->>'part_count')::integer=0 and public.l5_get('book_editions',c->>'edition_id') is null) then perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',purpose in ('archive','bootstrap','index_result'));end if;
 if h.store='scan_sessions' then
  if target?'source_receipts' or not public.l5_exact_keys(target->'source_state',array['format','active_page_ids']) or target->'source_state'->'format'<>'1'::jsonb or not public.l5_ids(target->'page_ids') or not public.l5_ids(target->'document_ids') then perform public.l5_fail('invalid_shape');end if;
  target:=jsonb_set(target,'{source_state,revision}',to_jsonb(oid));target:=jsonb_set(target,'{source_receipts}',coalesce(old_target->'source_receipts','[]'));if purpose='attach' then target:=jsonb_set(target,'{source_receipts}',jsonb_build_array(jsonb_build_object('operation_id',oid,'payload_sha256',hash,'result_revision',oid,'committed_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));end if;perform public.l5_valid_selection(target);perform public.l5_check_copy('scan_sessions',target);
  for x in select * from jsonb_array_elements(manifest) loop
   d:=public.l5_get(x->>0,x->>1)->'data';if public.l5_sha256(public.l5_project_seed(d)) is distinct from x->>2 then perform public.l5_fail('source_changed');end if;
   if not(coalesce(target->case when x->>0='source_pages' then 'page_ids' else 'document_ids' end,'[]')?(x->>1)) then perform public.l5_fail('invalid_shape');end if;
   if x->>0='source_documents' and d?'source_copy' then doc:=public.l5_get('source_documents',d->'source_copy'->>'source_id')->'data';if target->'source_copy'->>'source_id' is distinct from doc->>'scan_session_id' or target->'source_copy'->>'operation_id' is distinct from d->'source_copy'->>'operation_id' then perform public.l5_fail('source_changed');end if;
    if doc->>'replaces_document_id' is null then if d->>'replaces_document_id' is not null then perform public.l5_fail('source_changed');end if;
    elsif public.l5_get('source_documents',d->>'replaces_document_id')->'data'->'source_copy'->>'source_id' is distinct from doc->>'replaces_document_id' then perform public.l5_fail('source_changed');end if;end if;
  end loop;
  if jsonb_array_length(target->'page_ids')+jsonb_array_length(target->'document_ids')<>h.row_count then perform public.l5_fail('invalid_shape');end if;
 elsif target->>'kind'='traduction' then
  if purpose not in ('archive','bootstrap') or h.row_count<>0 or (h.header->>'part_count')::integer<>0 then perform public.l5_fail('invalid_shape');end if;
  target:=target||jsonb_build_object('created_at',coalesce(old_target->'created_at',to_jsonb(to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'updated_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  if not public.l6_valid_journal(target) then perform public.l5_fail('invalid_shape');end if;
  perform public.l6_check_journal_source(uid,target,true);
 else
  if target->>'kind' is distinct from 'index' or target->>'recipe_id' is not null then perform public.l5_fail('invalid_shape');end if;
  if purpose='index_result' then
   if old_target is null or old_target->>'owner_id' is distinct from uid::text or target->>'owner_id' is distinct from uid::text or target->>'status' is distinct from 'a_verifier' or coalesce(old_target->>'status','') not in ('en_cours','a_verifier') then perform public.l5_fail('result_changed');end if;
   if public.l5_project_fields(old_target,'index-target-identity',array['id','kind','recipe_id','edition_id','scan_session_id','page_ids','started_at','owner_id','expected_edition_id','expected_edition_cycle_id','expected_cycle_id','index_call','source_capture','sources_attendues']) is distinct from public.l5_project_fields(target,'index-target-identity',array['id','kind','recipe_id','edition_id','scan_session_id','page_ids','started_at','owner_id','expected_edition_id','expected_edition_cycle_id','expected_cycle_id','index_call','source_capture','sources_attendues']) then perform public.l5_fail('source_changed');end if;
   foreach k in array array['index_decisions','index_resolved_occurrences','index_application_receipts','index_decision_revision'] loop if old_target->k is distinct from target->k then perform public.l5_fail('result_changed');end if;end loop;
   if old_target->>'status'='a_verifier' and (old_target->>'index_storage' is not null or old_target->'resultat' is distinct from 'null'::jsonb and old_target?'resultat') and public.l5_project_reading(old_target,public.l5_index_result(old_target)) is distinct from public.l5_project_reading(target,public.l5_index_result(target)) then perform public.l5_fail('result_changed');end if;
  elsif old_target is not null and public.l5_project_seed(old_target) is distinct from public.l5_project_seed(target) then perform public.l5_fail('result_changed');end if;
  if target->>'source_capture' is not null or target->>'index_storage' is not null then
   perform public.l5_check_capture(target->'source_capture',false);
   if purpose in ('archive','bootstrap') and target->>'index_storage' is null and (not(target?'resultat') or target->'resultat'='null'::jsonb) and target->>'status' in ('a_lancer','en_cours','echec','ignore') then
    perform public.l5_index_result(target||jsonb_build_object('resultat',jsonb_build_object('format',2,'pages',jsonb_build_array(jsonb_build_object('page_id',target->'index_call'->'page_id','etat','echec','sorte_page',null,'page_imprimee',null,'entrees','[]'::jsonb,'incertain','[]'::jsonb)))));
   else perform public.l5_index_result(target);end if;
  elsif purpose='index_result' then perform public.l5_fail('invalid_shape');
  else
   if target->>'scan_session_id' is not null then doc:=public.l5_get('scan_sessions',target->>'scan_session_id');if doc is null or doc->>'deleted_at' is not null or doc->'data'->>'edition_id' is distinct from target->>'edition_id' then perform public.l5_fail('source_changed');end if;end if;
  end if;
  ref_count:=0;
  for x in select value from jsonb_array_elements(manifest) loop
   d:=public.l5_get(x->>0,x->>1)->'data';if public.l5_sha256(public.l5_project_seed(d)) is distinct from x->>2 then perform public.l5_fail('source_changed');end if;
   if x->>0='recipes' then
    if purpose not in ('archive','bootstrap') or d->>'index_import_id' is distinct from h.id then perform public.l5_fail('invalid_shape');end if;ref_count:=ref_count+1;
   elsif x->>0='imports' then
    if not exists(select 1 from jsonb_array_elements(coalesce(target->'index_storage'->'fragments','[]')) f where f->>'id'=x->>1) then perform public.l5_fail('invalid_shape');end if;
   else perform public.l5_fail('invalid_shape');end if;
  end loop;
  if target->>'index_storage' is not null then
   if target->'index_storage'->>'role' is distinct from 'page_manifest' or jsonb_array_length(target->'index_storage'->'fragments')+ref_count<>h.row_count then perform public.l5_fail('invalid_shape');end if;
  elsif ref_count<>h.row_count then perform public.l5_fail('invalid_shape');end if;
 end if;
 perform public.l5_put(h.store,h.id,target);ack:=jsonb_build_object('store',h.store,'id',h.id,'operation_id',oid,'payload_sha256',hash,'server_rows',public.l5_ack_rows(jsonb_build_array(jsonb_build_object('store',h.store,'id',h.id))));
 update private.mistu_source_transfers t set state='completed',closed_at=stamp,updated_at=stamp,receipt=ack-'server_rows' where t.owner_id=uid and t.transfer_id=tid;
 return ack;
end $$;
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
