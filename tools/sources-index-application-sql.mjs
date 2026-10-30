// Application des décisions déjà affichées : le serveur vérifie les preuves, sans reconsolider par titre.
export const sourcesIndexApplicationSql=String.raw`
create or replace function public.l5_index_scope(eid text) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(public.l5_project_recipe(data) order by convert_to(id,'UTF8')),'[]'::jsonb) from public.recipes where owner_id=auth.uid() and deleted_at is null and data->>'edition_id'=eid;
$$;
create or replace function public.l5_index_sorted_ids(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare sorted jsonb;begin if not public.l5_ids(v) then return false;end if;select coalesce(jsonb_agg(x order by convert_to(x#>>'{}','UTF8')),'[]') into sorted from jsonb_array_elements(v) x;return sorted=v;end $$;
create or replace function public.l5_index_ranges(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb;last integer:=0;begin
 if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>9999 then return false;end if;
 for p in select value from jsonb_array_elements(v) loop
  if not public.l5_exact_keys(p,array['debut','fin']) or not public.l5_index_int(p->'debut',1,9999) or not public.l5_index_int(p->'fin',1,9999) then return false;end if;
  if (p->>'fin')::integer<(p->>'debut')::integer or (p->>'debut')::integer<=last then return false;end if;last:=(p->>'debut')::integer;
 end loop;return true;end $$;
create or replace function public.l5_index_changes(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb;begin
 if not public.l5_index_keys(v,array['index_rubriques','printed_pages']) or v='{}'::jsonb then return false;end if;
 if v?'printed_pages' and not public.l5_index_ranges(v->'printed_pages') then return false;end if;
 if v?'index_rubriques' then
  if jsonb_typeof(v->'index_rubriques') is distinct from 'array' or jsonb_array_length(v->'index_rubriques')>12 then return false;end if;
  for x in select value from jsonb_array_elements(v->'index_rubriques') loop if not public.l5_index_line(x,1,120) then return false;end if;end loop;
 end if;return true;end $$;
create or replace function public.l5_index_parent_coupe(r jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(r->>'kind'='index' and r->'index_call'->>'kind'='full' and r->'resultat'='null'::jsonb and r->'erreur'->>'raison'='coupe' and r->>'status' in ('echec','enregistre'),false);
$$;
create or replace function public.l5_index_apply(c jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare r jsonb;j jsonb;logical jsonb;leader jsonb;read jsonb;d jsonb;e jsonb;o jsonb;p jsonb;old jsonb;rr jsonb;receipt jsonb;stamp text;
 js jsonb:='{}';results jsonb:='{}';coverage jsonb:='{}';after_journals jsonb:='{}';revisions jsonb:='{}';refs jsonb:='[]';pairs jsonb:='[]';targets jsonb:='[]';
 allids jsonb:='[]';claimed jsonb:='[]';previous text;previous_home text;sid text;session jsonb;eid text:=c->>'edition_id';n integer;ordinal integer;last_ordinal integer;all_places text[]:='{}';place text;
 home text;id text;resolved text[]:='{}';arr jsonb;compact jsonb;decisions jsonb;cnt integer:=0;parent jsonb;leftrow jsonb;rightrow jsonb;k text;cap jsonb;othercap jsonb;part jsonb;
begin
 if not public.l5_exact_keys(c,array['protocol','op','store','id','operation_id','edition_id','base_edition_cycle_id','payload_sha256','application_id','portion_id','predecessor_operation_id','terminal','read_set','read_set_sha256','source_capture_sha256','displayed_result_sha256','base_decision_revision','base_session_sha256','recipe_scope_sha256','creates','patches','decisions'])
 or c->>'op'<>'index_apply' or c->>'store'<>'imports' or not public.l5_id(c->'application_id') or c->'portion_id' is distinct from c->'operation_id' or not(c->'predecessor_operation_id'='null'::jsonb or public.l5_id(c->'predecessor_operation_id'))
 or jsonb_typeof(c->'terminal') is distinct from 'boolean' or not(c->'base_decision_revision'='null'::jsonb or public.l5_id(c->'base_decision_revision')) or not public.l5_id(c->'edition_id') then perform public.l5_fail('invalid_shape');end if;
 foreach k in array array['read_set_sha256','source_capture_sha256','displayed_result_sha256','base_session_sha256','recipe_scope_sha256'] loop if not public.l5_index_hash(c->k) then perform public.l5_fail('invalid_shape');end if;end loop;
 foreach k in array array['read_set','creates','patches','decisions'] loop if jsonb_typeof(c->k) is distinct from 'array' then perform public.l5_fail('invalid_shape');end if;end loop;
 if jsonb_array_length(c->'read_set')<1 or jsonb_array_length(c->'decisions')<1 or jsonb_array_length(c->'creates')+jsonb_array_length(c->'patches')+jsonb_array_length(c->'decisions')>500 then perform public.l5_fail('too_large');end if;
 if c->'read_set'->0->>'journal_id' is distinct from c->>'id' then perform public.l5_fail('invalid_shape');end if;
 leader:=public.l5_get('imports',c->>'id');if leader is null or leader->>'deleted_at' is not null then perform public.l5_fail('result_changed');end if;leader:=leader->'data';
 for r in select value from jsonb_array_elements(coalesce(leader->'index_application_receipts','[]')) loop
  if r->>'operation_id'=c->>'operation_id' then
   if r->>'payload_sha256' is distinct from c->>'payload_sha256' then perform public.l5_fail('id_collision');end if;
   select coalesce(jsonb_agg(jsonb_build_object('store','recipes','id',x->>'id')),'[]') into refs from jsonb_array_elements((c->'creates')||(c->'patches')) x;
   select refs||coalesce(jsonb_agg(jsonb_build_object('store','imports','id',x->>'journal_id')),'[]') into refs from jsonb_array_elements(c->'decisions') x;
   return jsonb_build_object('store','imports','id',c->>'id','operation_id',c->>'operation_id','payload_sha256',c->>'payload_sha256','already_applied',true,'server_rows',public.l5_ack_rows(refs));
  end if;
 end loop;
 perform public.l5_cycle(eid,c->>'base_edition_cycle_id');
 sid:=leader->>'scan_session_id';session:=public.l5_get('scan_sessions',sid);
 if session is null or session->>'deleted_at' is not null or session->'data'->>'edition_id' is distinct from eid or public.l5_sha256(public.l5_project_session(session->'data','[]')) is distinct from c->>'base_session_sha256' then perform public.l5_fail('session_changed');end if;session:=session->'data';
 previous:=null;
 for read in select value from jsonb_array_elements(c->'read_set') loop
  if not public.l5_exact_keys(read,array['journal_id','result_sha256','source_capture_sha256']) or not public.l5_id(read->'journal_id') or not public.l5_index_hash(read->'result_sha256') or not public.l5_index_hash(read->'source_capture_sha256') or (previous is not null and convert_to(previous,'UTF8')>=convert_to(read->>'journal_id','UTF8')) then perform public.l5_fail('invalid_shape');end if;previous:=read->>'journal_id';
  j:=public.l5_get('imports',previous);if j is null or j->>'deleted_at' is not null then perform public.l5_fail('result_changed');end if;j:=j->'data';
  if j->>'kind' is distinct from 'index' or j->>'recipe_id' is not null or j->>'owner_id' is distinct from auth.uid()::text or j->>'edition_id' is distinct from eid or j->>'scan_session_id' is distinct from sid or j->>'expected_edition_cycle_id' is distinct from c->>'base_edition_cycle_id' then perform public.l5_fail('owner_changed');end if;
  if not public.l5_index_parent_coupe(j) and coalesce(j->>'status','') not in ('a_verifier','enregistre') then perform public.l5_fail('result_changed');end if;
  logical:=public.l5_index_result(j);
  if public.l5_sha256(j->'source_capture') is distinct from read->>'source_capture_sha256' or public.l5_sha256(public.l5_project_reading(j,logical)) is distinct from read->>'result_sha256' then perform public.l5_fail('result_changed');end if;
  perform public.l5_check_capture(j->'source_capture',false);
  for cap in select value from jsonb_array_elements(j->'source_capture'->'pages') loop
   p:=public.l5_get('source_pages',cap->>'id')->'data';
   if not(public.l5_active(session)?(cap->>'id')) or public.l5_sha256(public.l5_project_annotation(p)) is distinct from cap->>'annotation_sha256' then perform public.l5_fail('source_changed');end if;
  end loop;
  js:=jsonb_set(js,array[previous],j,true);results:=jsonb_set(results,array[previous],logical,true);
  arr:=coalesce(j->'index_resolved_occurrences','[]');if jsonb_typeof(arr) is distinct from 'array' or jsonb_array_length(arr)>600 then perform public.l5_fail('invalid_shape');end if;
  last_ordinal:=-1;for o in select value from jsonb_array_elements(arr) loop if not public.l5_index_int(o,0,599) or (o::text)::integer<=last_ordinal then perform public.l5_fail('invalid_shape');end if;last_ordinal:=(o::text)::integer;end loop;
  coverage:=jsonb_set(coverage,array[previous],arr,true);
 end loop;
 if public.l5_sha256(c->'read_set') is distinct from c->>'read_set_sha256' then perform public.l5_fail('invalid_shape');end if;
 select jsonb_agg(jsonb_build_array(x->>'journal_id',x->>'source_capture_sha256') order by ord) into pairs from jsonb_array_elements(c->'read_set') with ordinality r(x,ord);
 if public.l5_sha256(pairs) is distinct from c->>'source_capture_sha256' then perform public.l5_fail('invalid_shape');end if;
 select jsonb_agg(jsonb_build_array(x->>'journal_id',x->>'result_sha256') order by ord) into pairs from jsonb_array_elements(c->'read_set') with ordinality r(x,ord);
 if public.l5_sha256(pairs) is distinct from c->>'displayed_result_sha256' then perform public.l5_fail('invalid_shape');end if;
 if public.l5_sha256(public.l5_index_scope(eid)) is distinct from c->>'recipe_scope_sha256' then perform public.l5_fail('index_changed');end if;
 previous_home:=null;
 for d in select value from jsonb_array_elements(c->'decisions') loop
  if not public.l5_exact_keys(d,array['journal_id','expected_decision_revision','entries']) or not public.l5_id(d->'journal_id') or not(c->'read_set' @> jsonb_build_array(jsonb_build_object('journal_id',d->'journal_id'))) or not(d->'expected_decision_revision'='null'::jsonb or public.l5_id(d->'expected_decision_revision')) or jsonb_typeof(d->'entries') is distinct from 'array' or (previous_home is not null and convert_to(previous_home,'UTF8')>=convert_to(d->>'journal_id','UTF8')) then perform public.l5_fail('invalid_shape');end if;
  home:=d->>'journal_id';previous_home:=home;j:=js->home;
  if j->>'index_decision_revision' is distinct from d->>'expected_decision_revision' then perform public.l5_fail('index_changed');end if;
  if home=c->>'id' and d->'expected_decision_revision' is distinct from c->'base_decision_revision' then perform public.l5_fail('invalid_shape');end if;
  last_ordinal:=-1;
  for e in select value from jsonb_array_elements(d->'entries') loop
   cnt:=cnt+1;
   if not public.l5_exact_keys(e,array['occurrences','occurrence_ordinal','unit_sha256','action','option_sha256','applied_ids_sha256','applied_ids']) or not public.l5_index_int(e->'occurrence_ordinal',0,599) or not public.l5_index_hash(e->'unit_sha256') or not public.l5_index_hash(e->'applied_ids_sha256') or not public.l5_index_sorted_ids(e->'applied_ids') or jsonb_array_length(e->'applied_ids')>500 or coalesce(e->>'action','') not in ('auto','garder_option','garder_toutes','ajouter','ecarter','est_recette') then perform public.l5_fail('invalid_shape');end if;
   ordinal:=(e->>'occurrence_ordinal')::integer;if ordinal<=last_ordinal then perform public.l5_fail('invalid_shape');end if;last_ordinal:=ordinal;
   if e->>'action'='garder_option' then if not public.l5_index_hash(e->'option_sha256') then perform public.l5_fail('invalid_shape');end if;elsif e->'option_sha256' is distinct from 'null'::jsonb then perform public.l5_fail('invalid_shape');end if;
   if e->>'action'='ecarter' and e->'applied_ids'<>'[]'::jsonb then perform public.l5_fail('invalid_shape');end if;
   if public.l5_sha256(e->'applied_ids') is distinct from e->>'applied_ids_sha256' or jsonb_typeof(e->'occurrences') is distinct from 'array' or jsonb_array_length(e->'occurrences')<1 then perform public.l5_fail('invalid_shape');end if;
   if e->'occurrences'->0->>'journal_id' is distinct from home or e->'occurrences'->0->'ordinal' is distinct from e->'occurrence_ordinal' or public.l5_sha256(jsonb_build_object('projection','index-unit-v1','edition_id',eid,'occurrences',e->'occurrences')) is distinct from e->>'unit_sha256' then perform public.l5_fail('invalid_shape');end if;
   previous:=null;n:=-1;
   for o in select value from jsonb_array_elements(e->'occurrences') loop
    if not public.l5_exact_keys(o,array['journal_id','ordinal','result_sha256']) or not public.l5_id(o->'journal_id') or not public.l5_index_int(o->'ordinal',0,599) or not public.l5_index_hash(o->'result_sha256') then perform public.l5_fail('invalid_shape');end if;
    id:=o->>'journal_id';ordinal:=(o->>'ordinal')::integer;
    if previous is not null and (convert_to(previous,'UTF8')>convert_to(id,'UTF8') or previous=id and n>=ordinal) then perform public.l5_fail('invalid_shape');end if;previous:=id;n:=ordinal;
    if not exists(select 1 from jsonb_array_elements(c->'read_set') x where x->>'journal_id'=id and x->'result_sha256'=o->'result_sha256') or not exists(select 1 from jsonb_array_elements(c->'decisions') x where x->>'journal_id'=id) then perform public.l5_fail('invalid_shape');end if;
    if results->id->'pages'->0->'entrees'->ordinal is null then perform public.l5_fail('result_changed');end if;
    place:=id||':'||ordinal::text;if place=any(all_places) then perform public.l5_fail('invalid_shape');end if;all_places:=array_append(all_places,place);
    if (coverage->id) @> jsonb_build_array(ordinal) then perform public.l5_fail('index_changed');end if;
    coverage:=jsonb_set(coverage,array[id],(coverage->id)||jsonb_build_array(ordinal),true);
   end loop;
   if exists(select 1 from jsonb_array_elements(coalesce(j->'index_decisions','[]')) x where x->'occurrence_ordinal'=e->'occurrence_ordinal') then perform public.l5_fail('index_changed');end if;
   claimed:=claimed||(e->'applied_ids');
  end loop;
 end loop;
 if not exists(select 1 from jsonb_array_elements(c->'decisions') x where x->>'journal_id'=c->>'id') then perform public.l5_fail('invalid_shape');end if;
 if c->>'predecessor_operation_id' is not null and not exists(select 1 from jsonb_array_elements(coalesce(leader->'index_application_receipts','[]')) x where x->'operation_id'=c->'predecessor_operation_id' and x->'application_id'=c->'application_id' and x->'result_decision_revision'=c->'base_decision_revision' and x->'scope_after_sha256'=c->'recipe_scope_sha256') then perform public.l5_fail('index_changed');end if;
 for r in select value from jsonb_array_elements(c->'creates') loop
  if not public.l5_index_keys(r,array['id','edition_id','original_title','original_language','availability','verification_state','printed_page','printed_pages','section','index_rubriques','type','tags','cuisines','favorite','source_page_ids','current_version_id','ingredient_ids','index_page_id','raw_entry','index_uncertain','index_import_id','created_at','updated_at'],array['id','edition_id','original_title','availability','verification_state','favorite','current_version_id','source_page_ids','index_import_id'])
  or not public.l5_id(r->'id') or r->>'edition_id' is distinct from eid or r->>'availability' is distinct from 'reference_only' or r->>'verification_state' is distinct from 'unverified' or r->'current_version_id' is distinct from 'null'::jsonb or r->'favorite' is distinct from 'false'::jsonb or not public.l5_index_line(r->'original_title',1,200) or not public.l5_ids(r->'source_page_ids') then perform public.l5_fail('invalid_shape');end if;
  if coalesce(r->'tags','[]')<>'[]'::jsonb or coalesce(r->'cuisines','[]')<>'[]'::jsonb or coalesce(r->'ingredient_ids','[]')<>'[]'::jsonb or r->>'type' is not null then perform public.l5_fail('invalid_shape');end if;
  if r?'printed_pages' and not public.l5_index_ranges(r->'printed_pages') then perform public.l5_fail('invalid_shape');end if;
  if r?'index_rubriques' and not public.l5_index_changes(jsonb_build_object('index_rubriques',r->'index_rubriques')) then perform public.l5_fail('invalid_shape');end if;
  if not(js?(r->>'index_import_id')) or not(public.l5_active(session) @> (r->'source_page_ids')) or (r->>'index_page_id' is not null and not(r->'source_page_ids'?(r->>'index_page_id'))) then perform public.l5_fail('invalid_shape');end if;
  if public.l5_get('recipes',r->>'id') is not null then perform public.l5_fail('id_collision');end if;
  allids:=allids||jsonb_build_array(r->>'id');
 end loop;
 for p in select value from jsonb_array_elements(c->'patches') loop
  if not public.l5_exact_keys(p,array['id','base_sha256','changes']) or not public.l5_id(p->'id') or not public.l5_index_hash(p->'base_sha256') or not public.l5_index_changes(p->'changes') then perform public.l5_fail('invalid_shape');end if;
  old:=public.l5_get('recipes',p->>'id');if old is null or old->>'deleted_at' is not null then perform public.l5_fail('index_changed');end if;old:=old->'data';
  if old->>'edition_id' is distinct from eid or old->>'availability' is distinct from 'reference_only' or old->>'current_version_id' is not null or old->>'trashed_at' is not null or not public.l2_valid_exception(old) or public.l5_sha256(public.l5_project_recipe(old)) is distinct from p->>'base_sha256' then perform public.l5_fail('index_changed');end if;
  allids:=allids||jsonb_build_array(p->>'id');
 end loop;
 if not public.l5_ids(allids) or not public.l5_ids(claimed) then perform public.l5_fail('invalid_shape');end if;
 select coalesce(jsonb_agg(x order by convert_to(x#>>'{}','UTF8')),'[]') into allids from jsonb_array_elements(allids) x;
 select coalesce(jsonb_agg(x order by convert_to(x#>>'{}','UTF8')),'[]') into claimed from jsonb_array_elements(claimed) x;
 if allids is distinct from claimed then perform public.l5_fail('invalid_shape');end if;
 -- Toutes les preuves sont vérifiées avant la première écriture. La RPC englobe ces écritures dans un sous-bloc atomique.
 for r in select value from jsonb_array_elements(c->'creates') loop
  perform set_config('app.l1_write',jsonb_build_object('recipe_id',r->>'id','expected_cycle_id',null,'expected_edition_id',eid,'expected_edition_cycle_id',c->'base_edition_cycle_id','edition_contexts',jsonb_build_array(jsonb_build_object('edition_id',eid,'expected_cycle_id',c->'base_edition_cycle_id')))::text,true);
  perform public.l5_put('recipes',r->>'id',r);refs:=refs||jsonb_build_array(jsonb_build_object('store','recipes','id',r->>'id'));
 end loop;
 for p in select value from jsonb_array_elements(c->'patches') loop
  old:=public.l5_get('recipes',p->>'id')->'data';
  perform set_config('app.l1_write',jsonb_build_object('recipe_id',p->>'id','expected_cycle_id',old->'lifecycle_id','expected_edition_id',eid,'expected_edition_cycle_id',c->'base_edition_cycle_id','edition_contexts',jsonb_build_array(jsonb_build_object('edition_id',eid,'expected_cycle_id',c->'base_edition_cycle_id')))::text,true);
  perform public.l5_put('recipes',p->>'id',old||(p->'changes'));refs:=refs||jsonb_build_array(jsonb_build_object('store','recipes','id',p->>'id'));
 end loop;
 perform set_config('app.l1_write','',true);
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 receipt:=jsonb_build_object('application_id',c->'application_id','operation_id',c->'operation_id','predecessor_operation_id',c->'predecessor_operation_id','payload_sha256',c->'payload_sha256','result_sha256',c->'displayed_result_sha256','base_decision_revision',c->'base_decision_revision','result_decision_revision',c->'operation_id','scope_after_sha256',public.l5_sha256(public.l5_index_scope(eid)),'committed_at',stamp,'counts',jsonb_build_object('creates',jsonb_array_length(c->'creates'),'patches',jsonb_array_length(c->'patches'),'decisions',cnt),'applied_ids_sha256',public.l5_sha256(allids));
 for id,logical in select key,value from jsonb_each(results) loop
  if logical->'pages'->0->>'etat'='lue' and not exists(select 1 from jsonb_array_elements(logical->'pages'->0->'entrees') with ordinality x(v,i) where v->>'sorte'<>'autre' and not((coverage->id) @> jsonb_build_array(i-1))) then resolved:=array_append(resolved,id);end if;
 end loop;
 for id,parent in select key,value from jsonb_each(js) loop
  if public.l5_index_parent_coupe(parent) then
   leftrow:=null;rightrow:=null;
   for j in select value from jsonb_each(js) loop
    if j->'index_call'->>'parent_call_id'=id and j->'index_call'->'series_id'=parent->'index_call'->'series_id' and j->'index_call'->'page_id'=parent->'index_call'->'page_id' and (j->>'id')=any(resolved) then
     if j->'index_call'->>'kind'='left_half' then if leftrow is not null then perform public.l5_fail('invalid_shape');end if;leftrow:=j;end if;
     if j->'index_call'->>'kind'='right_half' then if rightrow is not null then perform public.l5_fail('invalid_shape');end if;rightrow:=j;end if;
    end if;
   end loop;
   if leftrow is not null and rightrow is not null then
    foreach part in array array[leftrow,rightrow] loop
     if part->'source_capture'->'source_state_revision' is distinct from parent->'source_capture'->'source_state_revision' then perform public.l5_fail('source_changed');end if;
     cap:=parent->'source_capture'->'pages'->0;othercap:=part->'source_capture'->'pages'->0;
     foreach k in array array['id','identity_sha256','annotation_sha256','preparation_version'] loop if cap->k is distinct from othercap->k then perform public.l5_fail('source_changed');end if;end loop;
     foreach k in array array['source_width','source_height'] loop if cap->'zone'->k is distinct from othercap->'zone'->k then perform public.l5_fail('source_changed');end if;end loop;
    end loop;resolved:=array_append(resolved,id);
   end if;
  end if;
 end loop;
 for d in select value from jsonb_array_elements(c->'decisions') loop
  home:=d->>'journal_id';j:=js->home;
  select coalesce(jsonb_agg(x order by (x->>'occurrence_ordinal')::integer),'[]') into decisions from jsonb_array_elements(coalesce(j->'index_decisions','[]')||coalesce((select jsonb_agg(v-'occurrences'-'applied_ids') from jsonb_array_elements(d->'entries') v),'[]')) x;
  select coalesce(jsonb_agg(x order by (x::text)::integer),'[]') into arr from jsonb_array_elements(coverage->home) x;
  j:=j||jsonb_build_object('index_decisions',decisions,'index_decision_revision',c->'operation_id','index_resolved_occurrences',arr);
  if home=any(resolved) then j:=j||jsonb_build_object('status','enregistre','finished_at',stamp);end if;
  if home=c->>'id' then select coalesce(jsonb_agg(v order by ord),'[]') into rr from jsonb_array_elements(coalesce(j->'index_application_receipts','[]')||jsonb_build_array(receipt)) with ordinality x(v,ord) where ord>greatest(0,jsonb_array_length(coalesce(j->'index_application_receipts','[]'))+1-128);j:=j||jsonb_build_object('index_application_receipts',rr);end if;
  perform public.l5_put('imports',home,j);refs:=refs||jsonb_build_array(jsonb_build_object('store','imports','id',home));
 end loop;
 return jsonb_build_object('store','imports','id',c->>'id','operation_id',c->>'operation_id','payload_sha256',c->>'payload_sha256','server_rows',public.l5_ack_rows(refs));
end $$;
`;
