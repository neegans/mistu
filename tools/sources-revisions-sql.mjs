export const sourcesRevisionsSql=String.raw`
create or replace function public.l5_revision(c jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare ss jsonb;old_ss jsonb;d jsonb;p jsonb;r jsonb;old jsonb;active jsonb;closure jsonb;ids jsonb:='[]';targets jsonb:='[]';receipts jsonb;rec jsonb;rows jsonb:='[]';x jsonb;key text;store text;eid text:=c->>'edition_id';sid text:=c->>'id';op text:=c->>'operation_id';action text:=c->>'action';seen text[]:='{}';baseids jsonb:='[]';newids jsonb:='[]';parent jsonb;
begin
 if not public.l5_exact_keys(c,array['protocol','op','operation_id','store','id','edition_id','base_edition_cycle_id','payload_sha256','action','base_session_sha256','base_source_revision','base_sources','new_documents','new_pages','active_page_ids']) or c->>'store'<>'scan_sessions' or action not in ('append','replace','rotate','select','hide') or jsonb_typeof(c->'new_documents') is distinct from 'array' or jsonb_typeof(c->'new_pages') is distinct from 'array' or jsonb_array_length(c->'new_documents')+jsonb_array_length(c->'new_pages')+1>500 or not public.l5_ids(c->'active_page_ids') then perform public.l5_fail('invalid_shape');end if;
 r:=public.l5_get('scan_sessions',sid);if r is null or r->>'deleted_at' is not null then perform public.l5_fail('session_changed');end if;old_ss:=r->'data';
 targets:=jsonb_build_array(jsonb_build_object('store','scan_sessions','id',sid));
 for store in select unnest(array['source_documents','source_pages']) loop
  for x in select * from jsonb_array_elements(c->case when store='source_documents' then 'new_documents' else 'new_pages' end) loop
   if not public.l5_exact_keys(x,array['id','data']) or not public.l5_id(x->'id') or x->>'id' is distinct from x->'data'->>'id' or jsonb_typeof(x->'data') is distinct from 'object' or (store||':'||(x->>'id'))=any(seen) or octet_length((x->'data')::text)>524288 then perform public.l5_fail('invalid_shape');end if;
   seen:=array_append(seen,store||':'||(x->>'id'));targets:=targets||jsonb_build_array(jsonb_build_object('store',store,'id',x->>'id'));
  end loop;
 end loop;
 select x into rec from jsonb_array_elements(coalesce(old_ss->'source_receipts','[]')) x where x->>'operation_id'=op;
 if rec is not null then if rec->>'payload_sha256' is distinct from c->>'payload_sha256' then perform public.l5_fail('invalid_shape');end if;return jsonb_build_object('store','scan_sessions','id',sid,'operation_id',op,'payload_sha256',c->>'payload_sha256','already_applied',true,'server_rows',public.l5_ack_rows(targets));end if;
 perform public.l5_cycle(eid,c->>'base_edition_cycle_id',false);
 if old_ss->>'edition_id' is distinct from eid or old_ss->'source_state'->>'revision' is distinct from c->>'base_source_revision' or old_ss->>'status' not in ('open','done') then perform public.l5_fail('session_changed');end if;
 active:=public.l5_active(old_ss);
 if action in ('replace','rotate') then
  if jsonb_array_length(c->'new_pages')=0 then perform public.l5_fail('invalid_shape');end if;
  for x in select * from jsonb_array_elements(c->'new_pages') loop key:=x->'data'->'source_revision'->>'parent_page_id';if key is null or not(active?key) then perform public.l5_fail('source_changed');end if;baseids:=baseids||to_jsonb(key);end loop;
 elsif action in ('select','hide') then
  select coalesce(jsonb_agg(distinct x),'[]') into baseids from jsonb_array_elements(active||(c->'active_page_ids')) x where not exists(select 1 from jsonb_array_elements(c->'new_pages') p where p->'id'=x);
  for x in select * from jsonb_array_elements(c->'new_pages') loop if x->'data'->'source_revision'->>'parent_page_id' is not null then baseids:=baseids||(x->'data'->'source_revision'->'parent_page_id');end if;end loop;
 end if;
 closure:=public.l5_closure(baseids,eid);
 if closure is distinct from c->'base_sources' or public.l5_sha256(public.l5_project_session(old_ss,closure)) is distinct from c->>'base_session_sha256' then perform public.l5_fail('source_changed');end if;
 if action='hide' and (jsonb_array_length(c->'new_pages')<>0 or jsonb_array_length(c->'new_documents')<>0 or not(active @> (c->'active_page_ids'))) then perform public.l5_fail('invalid_shape');end if;
 if action='rotate' and jsonb_array_length(c->'new_documents')<>0 then perform public.l5_fail('invalid_shape');end if;
 ss:=old_ss;
 for x in select * from jsonb_array_elements(c->'new_documents') loop
  d:=x->'data';if d->>'edition_id' is distinct from eid or d->>'scan_session_id' is distinct from sid or d?'source_copy' then perform public.l5_fail('invalid_shape');end if;
  old:=public.l5_get('source_documents',d->>'id');if old is not null then if old->>'deleted_at' is not null or public.l5_project_seed(old->'data')<>public.l5_project_seed(d) then perform public.l5_fail('id_collision');end if;else perform public.l5_put('source_documents',d->>'id',d);end if;
  if not(coalesce(ss->'document_ids','[]')?(d->>'id')) then ss:=jsonb_set(ss,'{document_ids}',coalesce(ss->'document_ids','[]')||to_jsonb(d->>'id'));end if;
 end loop;
 for x in select * from jsonb_array_elements(c->'new_pages') loop
  p:=x->'data';r:=p->'source_revision';if p->>'edition_id' is distinct from eid or not public.l5_valid_page(p) or r is null or p?'source_copy' or (p->>'document_id' is not null and not(coalesce(ss->'document_ids','[]')?(p->>'document_id'))) then perform public.l5_fail('invalid_shape');end if;
  if action='append' and (p->>'document_id' is null or r->>'reason'<>'capture' or r->>'parent_page_id' is not null or r->>'operation_id'<>op) then perform public.l5_fail('invalid_shape');end if;
  if action in ('replace','rotate') then
   parent:=public.l5_get('source_pages',r->>'parent_page_id')->'data';
   if parent is null or r->>'reason'<>action or r->>'operation_id'<>op or r->>'family_id'<>coalesce(parent->'source_revision'->>'family_id',parent->>'id') or public.l5_project_annotation(parent)<>public.l5_project_annotation(p) then perform public.l5_fail('invalid_shape');end if;
   if action='rotate' and (p->>'document_id' is distinct from parent->>'document_id' or p->>'sha256' is distinct from parent->>'sha256') then perform public.l5_fail('invalid_shape');end if;
   if action='replace' and not exists(select 1 from jsonb_array_elements(c->'new_documents') doc where doc->>'id'=p->>'document_id' and doc->'data'->>'replaces_document_id' is not distinct from parent->>'document_id') then perform public.l5_fail('invalid_shape');end if;
  end if;
  -- Une branche réessayée par select conserve aussi l’identité de son geste initial.
  if r->>'parent_page_id' is not null then
   parent:=public.l5_get('source_pages',r->>'parent_page_id')->'data';
   if parent is null or parent->>'edition_id' is distinct from eid or r->>'family_id' is distinct from coalesce(parent->'source_revision'->>'family_id',parent->>'id') then perform public.l5_fail('invalid_shape');end if;
   if r->>'reason'='rotate' and public.l5_project_fields(parent,'same-rotation-source',array['edition_id','document_id','sha256','file_position','locator','document_page_number']) is distinct from public.l5_project_fields(p,'same-rotation-source',array['edition_id','document_id','sha256','file_position','locator','document_page_number']) then perform public.l5_fail('invalid_shape');end if;
   if r->>'reason'='replace' and not exists(select 1 from jsonb_array_elements(c->'new_documents') doc where doc->>'id'=p->>'document_id' and doc->'data'->>'replaces_document_id' is not distinct from parent->>'document_id') then perform public.l5_fail('invalid_shape');end if;
  end if;
  old:=public.l5_get('source_pages',p->>'id');if old is not null then if old->>'deleted_at' is not null or public.l5_project_seed(old->'data')<>public.l5_project_seed(p) then perform public.l5_fail('id_collision');end if;else perform public.l5_put('source_pages',p->>'id',p);end if;
  newids:=newids||to_jsonb(p->>'id');if not(coalesce(ss->'page_ids','[]')?(p->>'id')) then ss:=jsonb_set(ss,'{page_ids}',coalesce(ss->'page_ids','[]')||to_jsonb(p->>'id'));end if;
 end loop;
 if action='append' and c->'active_page_ids' is distinct from active||newids then perform public.l5_fail('invalid_shape');end if;
 if action in ('replace','rotate') then
  select coalesce(jsonb_agg(coalesce((select p->'id' from jsonb_array_elements(c->'new_pages') p where p->'data'->'source_revision'->'parent_page_id'=a limit 1),a) order by n),'[]') into ids from jsonb_array_elements(active) with ordinality e(a,n);
  if ids is distinct from c->'active_page_ids' then perform public.l5_fail('invalid_shape');end if;
 end if;
 ss:=jsonb_set(ss,'{source_state}',jsonb_build_object('format',1,'revision',op,'active_page_ids',c->'active_page_ids'));perform public.l5_valid_selection(ss);
 rec:=jsonb_build_object('operation_id',op,'payload_sha256',c->>'payload_sha256','result_revision',op,'committed_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 select coalesce(jsonb_agg(x order by n),'[]') into receipts from jsonb_array_elements(coalesce(ss->'source_receipts','[]')||jsonb_build_array(rec)) with ordinality e(x,n) where n>greatest(0,jsonb_array_length(coalesce(ss->'source_receipts','[]'))+1-128);
 ss:=jsonb_set(ss,'{source_receipts}',receipts);perform public.l5_put('scan_sessions',sid,ss);
 return jsonb_build_object('store','scan_sessions','id',sid,'operation_id',op,'payload_sha256',c->>'payload_sha256','server_rows',public.l5_ack_rows(targets));
end $$;
`;
