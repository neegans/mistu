export const sourcesTransfertsSql=String.raw`
create table private.mistu_source_transfers(
 owner_id uuid not null,transfer_id text not null,store text not null,id text not null,purpose text not null,header jsonb not null,begin_operation_id text not null,begin_payload_sha256 text not null,
 next_part integer not null default 0,row_count integer not null default 0,chain_sha256 text not null,state text not null default 'receiving',created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),closed_at timestamptz,receipt jsonb,
 primary key(owner_id,transfer_id),check(state in ('receiving','completed','abandoned','expired','rejected')));
create table private.mistu_source_transfer_parts(owner_id uuid not null,transfer_id text not null,ordinal integer not null,operation_id text not null,payload_sha256 text not null,previous_chain_sha256 text not null,chain_sha256 text not null,rows jsonb not null,
 primary key(owner_id,transfer_id,ordinal),foreign key(owner_id,transfer_id) references private.mistu_source_transfers(owner_id,transfer_id));
create index mistu_source_transfers_target on private.mistu_source_transfers(owner_id,store,id,state);
alter table private.mistu_source_transfers enable row level security;
alter table private.mistu_source_transfer_parts enable row level security;
create policy mistu_source_transfers_owner on private.mistu_source_transfers using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy mistu_source_transfer_parts_owner on private.mistu_source_transfer_parts using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on private.mistu_source_transfers,private.mistu_source_transfer_parts from public,anon,authenticated;
create or replace function public.l5_pending_source(s text,k text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.mistu_source_transfer_parts p join private.mistu_source_transfers t using(owner_id,transfer_id) cross join lateral jsonb_array_elements(p.rows) r where p.owner_id=auth.uid() and t.state='receiving' and r->>0=s and r->>1=k);
$$;
create or replace function public.l5_check_copy(s text,d jsonb) returns void language plpgsql stable set search_path='' as $$
declare cp jsonb:=d->'source_copy';original jsonb;hash text;doc jsonb;session jsonb;parent jsonb;root_page jsonb;k text;begin
 if cp is null then return;end if;
 if not public.l5_exact_keys(cp,array['format','operation_id','source_id','source_identity_sha256']) or cp->'format'<>'1'::jsonb or not public.l5_id(cp->'operation_id') or not public.l5_id(cp->'source_id') or cp->>'source_id'=d->>'id' then perform public.l5_fail('invalid_shape');end if;
 original:=public.l5_get(s,cp->>'source_id');if original is null or original->>'deleted_at' is not null then perform public.l5_fail('source_changed');end if;original:=original->'data';
 hash:=public.l5_sha256(case s when 'source_pages' then public.l5_project_page(original) when 'source_documents' then public.l5_project_document(original) when 'scan_sessions' then public.l5_project_session_identity(original) else null end);
 if hash is distinct from cp->>'source_identity_sha256' then perform public.l5_fail('source_changed');end if;
 if s='source_pages' then
  if not public.l5_valid_page(d) or d->'source_revision' is null or d->'source_revision'->>'operation_id' is distinct from cp->>'operation_id' then perform public.l5_fail('source_changed');end if;
  if original->'source_revision'->>'parent_page_id' is null then
   if d->'source_revision'->>'parent_page_id' is not null or d->'source_revision'->>'family_id' is distinct from d->>'id' or d->'source_revision'->>'reason' is distinct from 'attach' then perform public.l5_fail('source_changed');end if;
  else
   parent:=public.l5_get('source_pages',d->'source_revision'->>'parent_page_id')->'data';root_page:=public.l5_get('source_pages',d->'source_revision'->>'family_id')->'data';
   if parent->'source_copy'->>'source_id' is distinct from original->'source_revision'->>'parent_page_id' or parent->'source_copy'->>'operation_id' is distinct from cp->>'operation_id' or root_page->'source_copy'->>'source_id' is distinct from original->'source_revision'->>'family_id' or d->'source_revision'->>'reason' is distinct from original->'source_revision'->>'reason' then perform public.l5_fail('source_changed');end if;
  end if;
  foreach k in array array['sha256','file_position','locator','document_page_number'] loop if public.l5_project_fields(d,'same',array[k])<>public.l5_project_fields(original,'same',array[k]) then perform public.l5_fail('source_changed');end if;end loop;
  if public.l5_page_rotation(d)->'rotation' is distinct from public.l5_page_rotation(original)->'rotation' then perform public.l5_fail('source_changed');end if;
  if original->>'document_id' is null then if d->>'document_id' is not null then perform public.l5_fail('source_changed');end if;
  else doc:=public.l5_get('source_documents',d->>'document_id')->'data';if doc->'source_copy'->>'source_id' is distinct from original->>'document_id' or doc->'source_copy'->>'operation_id' is distinct from cp->>'operation_id' then perform public.l5_fail('source_changed');end if;end if;
 elsif s='source_documents' then
  foreach k in array array['sha256','mime','size','source_type','blob_path','original_filename','captured_at'] loop if public.l5_project_fields(d,'same',array[k])<>public.l5_project_fields(original,'same',array[k]) then perform public.l5_fail('source_changed');end if;end loop;
  -- La séance copiée peut ne pas être activée avant finish ; son lien sera contrôlé alors.
 end if;
end $$;
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
  perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',c->>'purpose' in ('archive','bootstrap','index_result'));
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
 perform public.l5_cycle(c->>'edition_id',c->>'base_edition_cycle_id',purpose in ('archive','bootstrap','index_result'));
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
create or replace function public.source_transfer_status(transfer_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r private.mistu_source_transfers%rowtype;begin if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;select * into r from private.mistu_source_transfers t where t.owner_id=auth.uid() and t.transfer_id=source_transfer_status.transfer_id;if r.transfer_id is null then return jsonb_build_object('state','absent');end if;return jsonb_build_object('state',case when r.state='receiving' and clock_timestamp()>=(r.header->>'not_after')::timestamptz then 'expired' else r.state end,'next_part',r.next_part,'chain_sha256',r.chain_sha256,'receipt',r.receipt);end $$;
create or replace function public.l5_cleanup_transfers() returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;parts integer:=0;k integer;begin
 for r in select owner_id,transfer_id from private.mistu_source_transfers where (state='receiving' and (header->>'not_after')::timestamptz<clock_timestamp()) or (state in ('completed','abandoned','expired','rejected') and closed_at<clock_timestamp()-interval '90 days') order by owner_id,coalesce(closed_at,(header->>'not_after')::timestamptz),transfer_id limit 50 loop
  perform pg_advisory_xact_lock(hashtextextended(r.owner_id::text||':library-write',0));
  update private.mistu_source_transfers t set state='expired',closed_at=(t.header->>'not_after')::timestamptz,updated_at=clock_timestamp() where t.owner_id=r.owner_id and t.transfer_id=r.transfer_id and t.state='receiving' and (t.header->>'not_after')::timestamptz<clock_timestamp();
  if not exists(select 1 from private.mistu_source_transfers t where t.owner_id=r.owner_id and t.transfer_id=r.transfer_id and t.state in ('completed','abandoned','expired','rejected') and t.closed_at<clock_timestamp()-interval '90 days') then continue;end if;
  with xs as(select ordinal from private.mistu_source_transfer_parts p where p.owner_id=r.owner_id and p.transfer_id=r.transfer_id order by ordinal limit greatest(0,500-parts)) delete from private.mistu_source_transfer_parts p using xs where p.owner_id=r.owner_id and p.transfer_id=r.transfer_id and p.ordinal=xs.ordinal;get diagnostics k=row_count;parts:=parts+k;
  if not exists(select 1 from private.mistu_source_transfer_parts p where p.owner_id=r.owner_id and p.transfer_id=r.transfer_id) then delete from private.mistu_source_transfers t where t.owner_id=r.owner_id and t.transfer_id=r.transfer_id;n:=n+1;end if;if parts>=500 then exit;end if;
 end loop;return jsonb_build_object('headers',n,'parts',parts);
end $$;
`;
