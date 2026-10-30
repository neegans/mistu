export const sourcesPrimitivesSql=String.raw`
create or replace function public.l5_fail(reason text) returns void language plpgsql set search_path='' as $$
begin raise check_violation using message=reason;end $$;
create or replace function public.l5_exact_keys(d jsonb,ks text[]) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(d)='object' and coalesce((select array_agg(k order by k) from jsonb_object_keys(d) k),'{}'::text[])=coalesce((select array_agg(k order by k) from unnest(ks) k),'{}'::text[]),false);
$$;
create or replace function public.l5_id(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}') between 1 and 200 and (v#>>'{}') !~ '[[:cntrl:]]',false);
$$;
create or replace function public.l5_ids(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin if jsonb_typeof(v) is distinct from 'array' then return false;end if;return not exists(select 1 from jsonb_array_elements(v) x where not public.l5_id(x)) and jsonb_array_length(v)=(select count(distinct x) from jsonb_array_elements(v) x);end $$;
create or replace function public.l5_get(s text,k text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r jsonb;begin
 if s not in ('source_documents','source_pages','scan_sessions','imports','recipes','book_editions') then perform public.l5_fail('invalid_shape');end if;
 execute format('select jsonb_build_object(''store'',$2,''id'',id,''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',s) into r using k,s;
 return r;end $$;
create or replace function public.l5_put(s text,k text,d jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz:=clock_timestamp();v jsonb;begin
 if s not in ('source_documents','source_pages','scan_sessions','imports','recipes') or not public.l5_id(to_jsonb(k)) or d->>'id' is distinct from k or jsonb_typeof(d) is distinct from 'object' then perform public.l5_fail('invalid_shape');end if;
 v:=d||jsonb_build_object('updated_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 if not(v?'created_at') then v:=v||jsonb_build_object('created_at',v->'updated_at');end if;
 if octet_length(v::text)>524288 then perform public.l5_fail('too_large');end if;
 execute format('insert into public.%I(owner_id,id,data,updated_at) values(auth.uid(),$1,$2,$3) on conflict(owner_id,id) do update set data=excluded.data,updated_at=excluded.updated_at',s) using k,v,stamp;
 return public.l5_get(s,k);end $$;
create or replace function public.l5_ack_rows(xs jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare x jsonb;r jsonb;rs jsonb:='[]';begin for x in select * from jsonb_array_elements(xs) loop r:=public.l5_get(x->>'store',x->>'id');if r is null or r->>'deleted_at' is not null then perform public.l5_fail('source_changed');end if;rs:=rs||jsonb_build_array(r);end loop;return rs;end $$;
create or replace function public.l5_cycle(eid text,base text,historique boolean default false) returns void language plpgsql set search_path='' as $$
declare e jsonb;begin
 if eid is null then if base is not null then perform public.l5_fail('invalid_shape');end if;return;end if;
 e:=public.l5_get('book_editions',eid);
 if e is null or e->>'deleted_at' is not null or not public.l2_valid_edition(e->'data') or e->'data'->>'lifecycle_id' is distinct from base or (not historique and e->'data'->>'trashed_at' is not null) then perform public.l5_fail('edition_cycle');end if;
end $$;
create or replace function public.l5_active(s jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare a jsonb;begin
 if not public.l5_ids(coalesce(s->'page_ids','[]')) then perform public.l5_fail('invalid_shape');end if;
 if not(s?'source_state') then return coalesce(s->'page_ids','[]');end if;
 if not public.l5_exact_keys(s->'source_state',array['format','revision','active_page_ids']) or s->'source_state'->'format'<>'1'::jsonb or not public.l5_id(s->'source_state'->'revision') then perform public.l5_fail('invalid_shape');end if;
 a:=s->'source_state'->'active_page_ids';if not public.l5_ids(a) or not(coalesce(s->'page_ids','[]') @> a) then perform public.l5_fail('invalid_shape');end if;return a;end $$;
create or replace function public.l5_valid_page(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb:=p->'source_revision';begin
 if p->>'rotation' is not null and p->'rotation' not in ('0'::jsonb,'90'::jsonb,'180'::jsonb,'270'::jsonb) then return false;end if;
 if r is null then return true;end if;
 return public.l5_exact_keys(r,array['format','family_id','parent_page_id','operation_id','reason']) and r->'format'='1'::jsonb and public.l5_id(r->'family_id') and public.l5_id(r->'operation_id') and r->>'reason' in ('capture','replace','rotate','attach') and (r->>'parent_page_id' is null and r->>'family_id'=p->>'id' and r->>'reason' in ('capture','attach') or public.l5_id(r->'parent_page_id') and r->>'parent_page_id'<>p->>'id' and r->>'family_id'<>p->>'id' and r->>'reason' in ('replace','rotate'));end $$;
create or replace function public.l5_closure(ids jsonb,eid text) returns jsonb language plpgsql stable set search_path='' as $$
declare id text;parent text;p jsonb;d jsonb;fam text;seen text[];n integer;r jsonb:='[]';ks text[]:='{}';begin
 for id in select jsonb_array_elements_text(ids) loop
  seen:='{}';fam:=null;n:=0;
  while id is not null loop
   n:=n+1;if id=any(seen) or n>256 then perform public.l5_fail('invalid_shape');end if;seen:=array_append(seen,id);
   p:=public.l5_get('source_pages',id);if p is null or p->>'deleted_at' is not null or p->'data'->>'edition_id' is distinct from eid then perform public.l5_fail('source_changed');end if;p:=p->'data';
   if not public.l5_valid_page(p) then perform public.l5_fail('invalid_shape');end if;
   if fam is null then fam:=coalesce(p->'source_revision'->>'family_id',id);elsif fam is distinct from coalesce(p->'source_revision'->>'family_id',id) then perform public.l5_fail('invalid_shape');end if;
   if not(('source_pages:'||id)=any(ks)) then ks:=array_append(ks,'source_pages:'||id);r:=r||jsonb_build_array(jsonb_build_object('store','source_pages','id',id,'identity_sha256',public.l5_sha256(public.l5_project_page(p)),'annotation_sha256',public.l5_sha256(public.l5_project_annotation(p))));end if;
   if p->>'document_id' is not null then d:=public.l5_get('source_documents',p->>'document_id');if d is null or d->>'deleted_at' is not null or d->'data'->>'edition_id' is distinct from eid then perform public.l5_fail('source_changed');end if;d:=d->'data';
   if not(('source_documents:'||(d->>'id'))=any(ks)) then ks:=array_append(ks,'source_documents:'||(d->>'id'));r:=r||jsonb_build_array(jsonb_build_object('store','source_documents','id',d->>'id','identity_sha256',public.l5_sha256(public.l5_project_document(d)),'annotation_sha256',null));end if;end if;
   parent:=p->'source_revision'->>'parent_page_id';if parent is null and id is distinct from fam then perform public.l5_fail('invalid_shape');end if;id:=parent;
  end loop;
 end loop;
 select coalesce(jsonb_agg(x order by convert_to(x->>'store','UTF8'),convert_to(x->>'id','UTF8')),'[]') into r from jsonb_array_elements(r) x;return r;
end $$;
create or replace function public.l5_valid_selection(s jsonb) returns void language plpgsql stable set search_path='' as $$
declare a jsonb:=public.l5_active(s);x text;p jsonb;d jsonb;node jsonb;closure jsonb;f text;fs text[]:='{}';begin
 if not public.l5_ids(coalesce(s->'document_ids','[]')) then perform public.l5_fail('invalid_shape');end if;
 closure:=public.l5_closure(coalesce(s->'page_ids','[]'),s->>'edition_id');
 for node in select value from jsonb_array_elements(closure) loop
  if node->>'store'='source_pages' then if not(coalesce(s->'page_ids','[]')?(node->>'id')) then perform public.l5_fail('invalid_shape');end if;
  elsif not(coalesce(s->'document_ids','[]')?(node->>'id')) then perform public.l5_fail('invalid_shape');end if;
 end loop;
 for x in select jsonb_array_elements_text(coalesce(s->'document_ids','[]')) loop
  d:=public.l5_get('source_documents',x);if d is null or d->>'deleted_at' is not null then perform public.l5_fail('source_changed');end if;d:=d->'data';
  if d->>'edition_id' is distinct from s->>'edition_id' or d->>'scan_session_id' is distinct from s->>'id' or (d->>'replaces_document_id' is not null and not(coalesce(s->'document_ids','[]')?(d->>'replaces_document_id'))) then perform public.l5_fail('invalid_shape');end if;
 end loop;
 for x in select jsonb_array_elements_text(a) loop p:=public.l5_get('source_pages',x)->'data';f:=coalesce(p->'source_revision'->>'family_id',x);if f=any(fs) then perform public.l5_fail('invalid_shape');end if;fs:=array_append(fs,f);end loop;
end $$;
`;
