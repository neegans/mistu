-- 0012_cuisine_minuteurs.sql — généré, aucune exécution distante automatique.

create or replace function public.l7_op(v jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')=70 and v#>>'{}' ~ '^ck_op_[a-f0-9]{64}$',false)$$;
create or replace function public.l7_date_value(v jsonb) returns timestamptz language sql immutable set search_path='' as $$select case when left(v#>>'{}',4)='0000' then ('0001'||substring(v#>>'{}' from 5 for 19)||'+00 BC')::timestamptz else (v#>>'{}')::timestamptz end$$;
create or replace function public.l7_date(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s text:=v#>>'{}';d timestamptz;back text;begin
 if jsonb_typeof(v) is distinct from 'string' or length(s)<>24 or s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then return false;end if;
 d:=public.l7_date_value(v);back:=to_char(d at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');if left(s,4)='0000' then back:='0000'||substring(back from 5);end if;return back=s;
 exception when others then return false;
end$$;
create or replace function public.l7_duration(v jsonb) returns integer language plpgsql immutable set search_path='' as $$
declare n numeric;begin
 if jsonb_typeof(v) is distinct from 'number' then return null;end if;n:=(v::text)::numeric;if n<=0 or n>86400 or floor(n+0.5)<1 then return null;end if;return floor(n+0.5)::integer;
 exception when others then return null;
end$$;
create or replace function public.l7_ids(v jsonb,ordered boolean default false,unique_ids boolean default true) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb;seen text[]:='{}';previous text;value text;begin
 if jsonb_typeof(v) is distinct from 'array' then return false;end if;
 for x in select * from jsonb_array_elements(v) loop
  if not public.l6_id(x) then return false;end if;value:=x#>>'{}';
  if unique_ids and value=any(seen) or ordered and previous is not null and convert_to(previous,'UTF8')>=convert_to(value,'UTF8') then return false;end if;
  seen:=array_append(seen,value);previous:=value;
 end loop;return true;
end$$;
create or replace function public.l7_valid_receipts(rs jsonb,floor_value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare r jsonb;seen text[]:='{}';begin
 if jsonb_typeof(rs) is distinct from 'array' or jsonb_array_length(rs)>128 or not public.l5_index_int(floor_value,0,jsonb_array_length(rs)) then return false;end if;
 for r in select * from jsonb_array_elements(rs) loop
  if not public.l5_exact_keys(r,array['operation_id','payload_sha256']) or not public.l7_op(r->'operation_id') or not public.l6_hash(r->'payload_sha256') or (r->>'operation_id')=any(seen) then return false;end if;seen:=array_append(seen,r->>'operation_id');
 end loop;return true;
 exception when others then return false;
end$$;
create or replace function public.l7_project_timer_identity(r jsonb) returns jsonb language sql immutable set search_path='' as $$select public.l5_project_fields(r,'cooking-timer-identity-v1',array['id','timer_format','cook_session_id','recipe_version_id','step_id','device_id','duration_seconds','channel','requested_at','source_timer','legacy_launch_id','recipe_title_snapshot','task_label_snapshot','cooking_incarnation']::text[])$$;
create or replace function public.l7_project_session_context(r jsonb) returns jsonb language sql immutable set search_path='' as $$select public.l5_project_fields(r,'cooking-session-context-v1',array['id','recipe_id','meal_id','status','selected_version_ids','servings','servings_by_version','units','started_at']::text[])||jsonb_build_object('incarnation',coalesce(r->'cooking_state'->'incarnation','null'::jsonb))$$;
create or replace function public.l7_project_session_full(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','cooking-session-full-v1','data',r-'created_at'-'updated_at')$$;
create or replace function public.l7_project_version_source(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','cooking-version-v1','data',r-'created_at'-'updated_at'-'status')$$;
create or replace function public.l7_project_seed(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','cooking-seed-v1','data',r-'created_at'-'updated_at')$$;
create or replace function public.l7_valid_timer(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb:=r->'source_timer';m jsonb:=r->'mirror';k text;begin
 if not public.l5_exact_keys(r,array['id','timer_format','cook_session_id','recipe_version_id','step_id','device_id','duration_seconds','channel','requested_at','source_timer','legacy_launch_id','recipe_title_snapshot','task_label_snapshot','cooking_incarnation','handoff_state','mirror','cooking_revision','cooking_receipts','cooking_receipt_floor','created_at','updated_at']::text[]) or r->'timer_format' is distinct from '1'::jsonb or not public.l5_index_int(r->'duration_seconds',1,86400) or coalesce(r->>'channel','') not in ('mirror','shortcut','siri') or not public.l7_op(r->'cooking_incarnation') or not public.l7_op(r->'cooking_revision') or not public.l7_date(r->'created_at') or not public.l7_date(r->'updated_at') then return false;end if;
 foreach k in array array['id','cook_session_id','recipe_version_id','device_id'] loop if not public.l6_id(r->k) then return false;end if;end loop;
 foreach k in array array['step_id','legacy_launch_id'] loop if r->k<>'null'::jsonb and not public.l6_id(r->k) then return false;end if;end loop;
 foreach k in array array['recipe_title_snapshot','task_label_snapshot'] loop if jsonb_typeof(r->k) is distinct from 'string' or char_length(r->>k)>300 then return false;end if;end loop;
 if s='null'::jsonb then if not public.l6_id(r->'legacy_launch_id') then return false;end if;
 else
  if not public.l5_exact_keys(s,array['ordinal','seconds','seconds_max','sha256']) or jsonb_typeof(s->'ordinal') is distinct from 'number' or (s->>'ordinal')::numeric<0 or trunc((s->>'ordinal')::numeric)<>(s->>'ordinal')::numeric or public.l7_duration(s->'seconds') is null or not public.l6_hash(s->'sha256') or r->'legacy_launch_id'<>'null'::jsonb or not public.l6_id(r->'step_id') then return false;end if;
  if s->'seconds_max'<>'null'::jsonb and (public.l7_duration(s->'seconds_max') is null or (s->>'seconds_max')::numeric<(s->>'seconds')::numeric) then return false;end if;
  if (r->>'duration_seconds')::integer is distinct from public.l7_duration(s->'seconds') and (r->>'duration_seconds')::integer is distinct from public.l7_duration(s->'seconds_max') then return false;end if;
 end if;
 if r->>'channel'='mirror' then if r->'requested_at'<>'null'::jsonb or r->'handoff_state'<>'null'::jsonb or m='null'::jsonb then return false;end if;
 elsif not public.l7_date(r->'requested_at') or (r->>'channel'='siri' and coalesce(r->>'handoff_state','') not in ('siri','failed')) or (r->>'channel'='shortcut' and coalesce(r->>'handoff_state','') not in ('requested','opening','unconfirmed','failed')) then return false;end if;
 if m<>'null'::jsonb then
  if not public.l5_exact_keys(m,array['format','started_at','deadline_at']) or m->'format' is distinct from '1'::jsonb or not public.l7_date(m->'started_at') or not public.l7_date(m->'deadline_at') then return false;end if;
  if extract(epoch from (public.l7_date_value(m->'deadline_at')-public.l7_date_value(m->'started_at')))*1000<>(r->>'duration_seconds')::numeric*1000 then return false;end if;
 end if;
 if not public.l7_valid_receipts(r->'cooking_receipts',r->'cooking_receipt_floor') or octet_length(r::text)>524288 then return false;end if;perform public.l5_canonical(r);return true;
 exception when others then return false;
end$$;
create or replace function public.l7_valid_session(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb:=r->'cooking_state';e record;begin
 if jsonb_typeof(r) is distinct from 'object' or not public.l6_id(r->'id') or not public.l7_ids(r->'selected_version_ids') or coalesce(r->>'status','') not in ('active','done') or jsonb_typeof(r->'progress') is distinct from 'object' or r->'progress'->'format' is distinct from '2'::jsonb or jsonb_typeof(r->'progress'->'by_version') is distinct from 'object' or not public.l5_exact_keys(s,array['format','incarnation','active_revision','lang_revision','receipts','receipt_floor']) or s->'format' is distinct from '1'::jsonb or not public.l7_op(s->'incarnation') or (s->'active_revision'<>'null'::jsonb and not public.l7_op(s->'active_revision')) or (s->'lang_revision'<>'null'::jsonb and not public.l7_op(s->'lang_revision')) or not public.l7_valid_receipts(s->'receipts',s->'receipt_floor') then return false;end if;
 for e in select * from jsonb_each(r->'progress'->'by_version') loop
  if not (r->'selected_version_ids' @> jsonb_build_array(e.key)) or jsonb_typeof(e.value) is distinct from 'object' or coalesce(e.value->'current_step_id'<>'null'::jsonb,true) and not public.l6_id(e.value->'current_step_id') or not public.l7_ids(e.value->'done_step_ids',true) or coalesce(e.value->'revision'<>'null'::jsonb,true) and not public.l7_op(e.value->'revision') then return false;end if;
 end loop;
 if r->'active_version_id' is not null and r->'active_version_id'<>'null'::jsonb and not(r->'selected_version_ids' @> jsonb_build_array(r->'active_version_id')) then return false;end if;
 if octet_length(r::text)>524288 then return false;end if;perform public.l5_canonical(r);return true;
 exception when others then return false;
end$$;
create or replace function public.l7_adopt_progress(session jsonb,versions jsonb,opid text) returns jsonb language plpgsql immutable set search_path='' as $$
declare legacy jsonb;next_progress jsonb;version_map jsonb:='{}';steps_map jsonb:='{}';counts jsonb:='{}';by_version jsonb:='{}';v jsonb;entry jsonb;vid text;sid text;steps jsonb;old_entry jsonb;done_ids jsonb;pointer jsonb;complete boolean:=true;begin
 if jsonb_typeof(session) is distinct from 'object' or not public.l6_id(session->'id') or not public.l7_ids(session->'selected_version_ids') or session->>'status' is distinct from 'active' or session?'cooking_state' or session->'progress'?'format' or session->'progress'?'legacy_by_version' or not public.l7_op(to_jsonb(opid)) or jsonb_typeof(versions) is distinct from 'array' then perform public.l5_fail('forme_invalide');end if;
 legacy:=case when session->'progress' is null or session->'progress'='null'::jsonb then '{}'::jsonb else session->'progress' end;
 if jsonb_typeof(legacy) is distinct from 'object' or legacy?'by_version' and jsonb_typeof(legacy->'by_version') is distinct from 'object' then perform public.l5_fail('forme_invalide');end if;
 for entry in select legacy union all select value from jsonb_each(coalesce(legacy->'by_version','{}'::jsonb)) loop
  if jsonb_typeof(entry) is distinct from 'object' or entry?'current_step_id' and entry->'current_step_id'<>'null'::jsonb and not public.l6_id(entry->'current_step_id') or entry?'done_step_ids' and not public.l7_ids(entry->'done_step_ids',false,false) then perform public.l5_fail('forme_invalide');end if;
 end loop;
 for v in select * from jsonb_array_elements(versions) loop if jsonb_typeof(v)='object' and public.l6_id(v->'id') then version_map:=version_map||jsonb_build_object(v->>'id',v);end if;end loop;
 for vid in select jsonb_array_elements_text(session->'selected_version_ids') loop
  v:=version_map->vid;if v is null then complete:=false;continue;end if;
  if jsonb_typeof(v->'steps') is distinct from 'array' then perform public.l5_fail('source_invalide');end if;
  select coalesce(jsonb_agg(s.value->'id' order by s.ordinality),'[]'::jsonb) into steps from jsonb_array_elements(v->'steps') with ordinality s(value,ordinality);
  if not public.l7_ids(steps) then perform public.l5_fail('source_invalide');end if;
  steps_map:=steps_map||jsonb_build_object(vid,steps);
  for sid in select jsonb_array_elements_text(steps) loop counts:=counts||jsonb_build_object(sid,coalesce((counts->>sid)::integer,0)+1);end loop;
 end loop;
 next_progress:=(legacy-'by_version')||jsonb_build_object('format',2);if legacy?'by_version' then next_progress:=next_progress||jsonb_build_object('legacy_by_version',legacy->'by_version');end if;
 for vid in select jsonb_array_elements_text(session->'selected_version_ids') loop
  steps:=steps_map->vid;if steps is null then continue;end if;
  old_entry:=coalesce(legacy->'by_version'->vid,'{}'::jsonb);
  select coalesce(jsonb_agg(x order by convert_to(x,'UTF8')),'[]'::jsonb) into done_ids from (
   select jsonb_array_elements_text(coalesce(old_entry->'done_step_ids','[]'::jsonb)) x
   union select g.x from jsonb_array_elements_text(coalesce(legacy->'done_step_ids','[]'::jsonb)) g(x) where complete and counts->>g.x='1'
  ) d where steps @> jsonb_build_array(x);
  pointer:=case when old_entry?'current_step_id' then old_entry->'current_step_id' when complete and steps @> jsonb_build_array(legacy->'current_step_id') and counts->>(legacy->>'current_step_id')='1' then legacy->'current_step_id' else 'null'::jsonb end;
  by_version:=by_version||jsonb_build_object(vid,old_entry||jsonb_build_object('current_step_id',pointer,'done_step_ids',done_ids,'revision',opid));
 end loop;
 return session||jsonb_build_object('progress',next_progress||jsonb_build_object('by_version',by_version),'cooking_state',jsonb_build_object('format',1,'incarnation',opid,'active_revision',opid,'lang_revision',opid,'receipts','[]'::jsonb,'receipt_floor',0));
end$$;

create or replace function public.l7_get(s text,k text) returns jsonb language plpgsql stable set search_path='' as $$declare r jsonb;begin
 if s not in ('recipes','book_editions','recipe_versions','cook_sessions','timer_launches','cook_history') then perform public.l5_fail('forme_invalide');end if;
 execute format('select jsonb_build_object(''store'',$2,''id'',id,''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',s) into r using k,s;return r;
end$$;
create or replace function public.l7_put(s text,k text,d jsonb) returns jsonb language plpgsql set search_path='' as $$declare stamp timestamptz:=clock_timestamp();v jsonb;begin
 if s not in ('cook_sessions','timer_launches') or d->>'id' is distinct from k then perform public.l5_fail('forme_invalide');end if;
 v:=d||jsonb_build_object('updated_at',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));if not(v?'created_at') then v:=v||jsonb_build_object('created_at',v->'updated_at');end if;
 if octet_length(v::text)>524288 or not(case when s='timer_launches' then public.l7_valid_timer(v) else public.l7_valid_session(v) end) then perform public.l5_fail('bornes');end if;
 execute format('insert into public.%I(owner_id,id,data,updated_at) values(auth.uid(),$1,$2,$3) on conflict(owner_id,id) do update set data=excluded.data,updated_at=excluded.updated_at',s) using k,v,stamp;return public.l7_get(s,k);
end$$;
create or replace function public.l7_receipt(d jsonb,c jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare rs jsonb;f integer;r jsonb;begin
 if d is null then return false;end if;if c->>'store'='cook_sessions' then rs:=d->'cooking_state'->'receipts';f:=coalesce((d->'cooking_state'->>'receipt_floor')::integer,0);else rs:=d->'cooking_receipts';f:=coalesce((d->>'cooking_receipt_floor')::integer,0);end if;
 for r in select value from jsonb_array_elements(coalesce(rs,'[]')) with ordinality where ordinality>f loop if r->'operation_id'=c->'operation_id' then if r->'payload_sha256' is distinct from c->'payload_sha256' then perform public.l5_fail('operation_invalide');end if;return true;end if;end loop;return false;
end$$;
create or replace function public.l7_add_receipt(d jsonb,c jsonb,restore boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$declare rs jsonb;f integer;n integer;begin
 if c->>'store'='cook_sessions' then rs:=coalesce(d->'cooking_state'->'receipts','[]');f:=coalesce((d->'cooking_state'->>'receipt_floor')::integer,0);else rs:=coalesce(d->'cooking_receipts','[]');f:=coalesce((d->>'cooking_receipt_floor')::integer,0);end if;
 if restore then f:=jsonb_array_length(rs);end if;rs:=rs||jsonb_build_array(jsonb_build_object('operation_id',c->'operation_id','payload_sha256',c->'payload_sha256'));n:=greatest(0,jsonb_array_length(rs)-128);select coalesce(jsonb_agg(value order by ordinality),'[]') into rs from jsonb_array_elements(rs) with ordinality where ordinality>n;f:=greatest(0,f-n);
 if c->>'store'='cook_sessions' then return jsonb_set(d,'{cooking_state}',d->'cooking_state'||jsonb_build_object('receipts',rs,'receipt_floor',f));end if;return d||jsonb_build_object('cooking_revision',c->'operation_id','cooking_receipts',rs,'cooking_receipt_floor',f);
end$$;
create or replace function public.l7_validate_command(c jsonb) returns void language plpgsql immutable set search_path='' as $$declare b jsonb:=c->'base';x jsonb:=c->'change';r jsonb;prior text;names jsonb;begin
 if not public.l5_exact_keys(c,array['protocol','op','store','id','action','operation_id','nonce','payload_sha256','base','change','contexts']) or c->'protocol' is distinct from '1'::jsonb or c->>'op' is distinct from 'cooking_apply' or coalesce(c->>'store','') not in ('cook_sessions','timer_launches') or not public.l6_id(c->'id') or not public.l6_id(c->'nonce') or not public.l7_op(c->'operation_id') or not public.l6_hash(c->'payload_sha256') or public.l5_sha256(c-'payload_sha256') is distinct from c->>'payload_sha256' or c->>'operation_id' is distinct from 'ck_op_'||public.l5_sha256(jsonb_build_object('projection','cooking-intent-v1','command',c-'operation_id'-'payload_sha256')) then perform public.l5_fail('operation_invalide');end if;
 if octet_length(c::text)>786432 or octet_length(jsonb_build_object('rows',jsonb_build_array(c))::text)>921600 then perform public.l5_fail('bornes');end if;
 if not public.l5_exact_keys(c->'contexts',array['recipes','editions']) or jsonb_typeof(c->'contexts'->'recipes') is distinct from 'array' or jsonb_typeof(c->'contexts'->'editions') is distinct from 'array' then perform public.l5_fail('forme_invalide');end if;
 for r in select value from jsonb_array_elements(c->'contexts'->'recipes') loop
  if not public.l5_exact_keys(r,array['recipe_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id','historique']) or not public.l6_id(r->'recipe_id') or not(r->'expected_cycle_id'='null'::jsonb or public.l6_id(r->'expected_cycle_id')) or not(r->'expected_edition_id'='null'::jsonb or public.l6_id(r->'expected_edition_id')) or not(r->'expected_edition_cycle_id'='null'::jsonb or public.l6_id(r->'expected_edition_cycle_id')) or jsonb_typeof(r->'historique') is distinct from 'boolean' or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'recipe_id','UTF8') or r->'expected_edition_id'='null'::jsonb and r->'expected_edition_cycle_id'<>'null'::jsonb then perform public.l5_fail('forme_invalide');end if;prior:=r->>'recipe_id';
 end loop;prior:=null;
 for r in select value from jsonb_array_elements(c->'contexts'->'editions') loop
  if not public.l5_exact_keys(r,array['edition_id','expected_cycle_id','historique']) or not public.l6_id(r->'edition_id') or not(r->'expected_cycle_id'='null'::jsonb or public.l6_id(r->'expected_cycle_id')) or jsonb_typeof(r->'historique') is distinct from 'boolean' or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'edition_id','UTF8') then perform public.l5_fail('forme_invalide');end if;prior:=r->>'edition_id';
 end loop;
 if c->>'action'='restore' then
  if not public.l5_exact_keys(b,array['expected_target_sha256']) or not(b->'expected_target_sha256'='null'::jsonb or public.l6_hash(b->'expected_target_sha256')) or not public.l5_exact_keys(x,array['purpose','target']) or coalesce(x->>'purpose','') not in ('archive','bootstrap') or x->'target'->>'id' is distinct from c->>'id' or not(case when c->>'store'='timer_launches' then public.l7_valid_timer(x->'target') else public.l7_valid_session(x->'target') end) then perform public.l5_fail('forme_invalide');end if;return;
 end if;
 if c->>'store'='timer_launches' then
  case c->>'action'
  when 'create' then if not public.l5_exact_keys(b,array['target','session_sha256','source_sha256','legacy_launch_sha256']) or b->'target'<>'null'::jsonb or not public.l6_hash(b->'session_sha256') or not public.l6_hash(b->'source_sha256') or not(b->'legacy_launch_sha256'='null'::jsonb or public.l6_hash(b->'legacy_launch_sha256')) or not public.l5_exact_keys(x,array['timer']) or x->'timer' ?| array['cooking_incarnation','cooking_revision','cooking_receipts','cooking_receipt_floor'] or x->'timer'->>'id' is distinct from c->>'id' or not public.l7_valid_timer(x->'timer'||jsonb_build_object('cooking_incarnation',c->'operation_id','cooking_revision',c->'operation_id','cooking_receipts','[]'::jsonb,'cooking_receipt_floor',0)) then perform public.l5_fail('forme_invalide');end if;
  when 'anchor' then if not public.l5_exact_keys(b,array['identity_sha256','mirror','session_sha256','source_sha256']) or not public.l6_hash(b->'identity_sha256') or b->'mirror'<>'null'::jsonb or not public.l6_hash(b->'session_sha256') or not public.l6_hash(b->'source_sha256') or not public.l5_exact_keys(x,array['mirror']) or not public.l5_exact_keys(x->'mirror',array['format','started_at','deadline_at']) or x->'mirror'->'format'<>'1'::jsonb or not public.l7_date(x->'mirror'->'started_at') or not public.l7_date(x->'mirror'->'deadline_at') then perform public.l5_fail('forme_invalide');end if;
  when 'handoff' then if not public.l5_exact_keys(b,array['identity_sha256','handoff_state']) or not public.l6_hash(b->'identity_sha256') or coalesce(b->>'handoff_state','') not in ('requested','opening','unconfirmed','siri','failed') or not public.l5_exact_keys(x,array['handoff_state']) or coalesce(x->>'handoff_state','') not in ('opening','unconfirmed','failed') then perform public.l5_fail('forme_invalide');end if;
  else perform public.l5_fail('forme_invalide');end case;
 else
  case c->>'action'
  when 'adopt_progress' then
   if not public.l5_exact_keys(b,array['session_sha256','legacy_progress_sha256','versions']) or not public.l6_hash(b->'session_sha256') or not public.l6_hash(b->'legacy_progress_sha256') or not public.l5_exact_keys(x,array[]::text[]) or jsonb_typeof(b->'versions') is distinct from 'array' then perform public.l5_fail('forme_invalide');end if;prior:=null;
   for r in select value from jsonb_array_elements(b->'versions') loop if not public.l5_exact_keys(r,array['id','sha256']) or not public.l6_id(r->'id') or not(r->'sha256'='null'::jsonb or public.l6_hash(r->'sha256')) or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'id','UTF8') then perform public.l5_fail('forme_invalide');end if;prior:=r->>'id';end loop;
  when 'progress' then if not public.l5_exact_keys(b,array['session_context_sha256','version_id','progress_revision','source_sha256']) or not public.l6_hash(b->'session_context_sha256') or not public.l6_id(b->'version_id') or not(b->'progress_revision'='null'::jsonb or public.l7_op(b->'progress_revision')) or not public.l6_hash(b->'source_sha256') or not public.l5_exact_keys(x,array['current_step_id','done_add']) or not(x->'current_step_id'='null'::jsonb or public.l6_id(x->'current_step_id')) or not public.l7_ids(x->'done_add',true) then perform public.l5_fail('forme_invalide');end if;
  when 'active' then if not public.l5_exact_keys(b,array['session_context_sha256','active_revision','source_sha256']) or not public.l6_hash(b->'source_sha256') or not public.l6_hash(b->'session_context_sha256') or not(b->'active_revision'='null'::jsonb or public.l7_op(b->'active_revision')) or not public.l5_exact_keys(x,array['active_version_id']) or not public.l6_id(x->'active_version_id') then perform public.l5_fail('forme_invalide');end if;
  when 'language' then if not public.l5_exact_keys(b,array['session_context_sha256','lang_revision','versions']) or jsonb_typeof(b->'versions') is distinct from 'array' or not public.l6_hash(b->'session_context_sha256') or not(b->'lang_revision'='null'::jsonb or public.l7_op(b->'lang_revision')) or not public.l5_exact_keys(x,array['lang']) or coalesce(x->>'lang','') not in ('original','fr','en') then perform public.l5_fail('forme_invalide');end if;
  when 'finish' then
   if not public.l5_exact_keys(b,array['session_context_sha256','progress','history','versions']) or jsonb_typeof(b->'versions') is distinct from 'array' or not public.l6_hash(b->'session_context_sha256') or jsonb_typeof(b->'progress') is distinct from 'array' or jsonb_typeof(b->'history') is distinct from 'array' or not public.l5_exact_keys(x,array['ended_at','done_add']) or not public.l7_date(x->'ended_at') or jsonb_typeof(x->'done_add') is distinct from 'array' then perform public.l5_fail('forme_invalide');end if;prior:=null;
   for r in select value from jsonb_array_elements(b->'progress') loop if not public.l5_exact_keys(r,array['version_id','revision']) or not public.l6_id(r->'version_id') or not(r->'revision'='null'::jsonb or public.l7_op(r->'revision')) or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'version_id','UTF8') then perform public.l5_fail('forme_invalide');end if;prior:=r->>'version_id';end loop;prior:=null;
   for r in select value from jsonb_array_elements(b->'history') loop if not public.l5_exact_keys(r,array['id','sha256']) or not public.l6_id(r->'id') or not public.l6_hash(r->'sha256') or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'id','UTF8') then perform public.l5_fail('forme_invalide');end if;prior:=r->>'id';end loop;prior:=null;
   for r in select value from jsonb_array_elements(x->'done_add') loop if not public.l5_exact_keys(r,array['version_id','step_ids']) or not public.l6_id(r->'version_id') or not public.l7_ids(r->'step_ids',true) or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'version_id','UTF8') then perform public.l5_fail('forme_invalide');end if;prior:=r->>'version_id';end loop;
  else perform public.l5_fail('forme_invalide');end case;
 end if;
 if c->>'action' in ('finish','language') then prior:=null;for r in select value from jsonb_array_elements(b->'versions') loop
  if not public.l5_exact_keys(r,array['id','sha256']) or not public.l6_id(r->'id') or not(public.l6_hash(r->'sha256') or c->>'action'='language' and r->'sha256'='null'::jsonb) or prior is not null and convert_to(prior,'UTF8')>=convert_to(r->>'id','UTF8') then perform public.l5_fail('forme_invalide');end if;prior:=r->>'id';end loop;
 end if;
end$$;
create or replace function public.l7_contexts(c jsonb,s jsonb,historical boolean default false) returns void language plpgsql stable set search_path='' as $$declare r jsonb;e jsonb;x jsonb;ids text[]:='{}';rid text;vid text;v jsonb;begin
 for x in select value from jsonb_array_elements(c->'contexts'->'recipes') loop
  if not historical and (x->>'historique')::boolean then perform public.l5_fail('forme_invalide');end if;r:=public.l7_get('recipes',x->>'recipe_id');if r is null or r->>'deleted_at' is not null then perform public.l5_fail('source_changee');end if;r:=r->'data';ids:=array_append(ids,r->>'id');
  if r->>'lifecycle_id' is distinct from x->>'expected_cycle_id' or r->>'edition_id' is distinct from x->>'expected_edition_id' or not public.l2_valid_exception(r) or not (x->>'historique')::boolean and r->>'trashed_at' is not null then perform public.l5_fail('cycle_change');end if;
  if r->>'edition_id' is not null then e:=public.l7_get('book_editions',r->>'edition_id');if e is null then if not historical then perform public.l5_fail('cycle_change');end if;else if e->>'deleted_at' is not null or not public.l2_valid_edition(e->'data') or e->'data'->>'lifecycle_id' is distinct from x->>'expected_edition_cycle_id' then perform public.l5_fail('cycle_change');end if;e:=e->'data';if not (x->>'historique')::boolean and e->>'trashed_at' is not null and e->>'trash_mode'<>'keep_recipes' and r->'restored_from_edition'->>'lifecycle_id' is distinct from e->>'lifecycle_id' then perform public.l5_fail('cycle_change');end if;end if;end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'contexts'->'editions') loop
  if not historical and (x->>'historique')::boolean then perform public.l5_fail('forme_invalide');end if;e:=public.l7_get('book_editions',x->>'edition_id');if e is null or e->>'deleted_at' is not null or not public.l2_valid_edition(e->'data') or e->'data'->>'lifecycle_id' is distinct from x->>'expected_cycle_id' then perform public.l5_fail('cycle_change');end if;
 end loop;
 for vid in select value#>>'{}' from jsonb_array_elements(coalesce(s->'selected_version_ids',jsonb_build_array(s->'recipe_version_id'))) loop
  if vid is null then continue;end if;v:=public.l7_get('recipe_versions',vid);if v is null or v->>'deleted_at' is not null then continue;end if;rid:=v->'data'->>'recipe_id';r:=public.l7_get('recipes',rid);if r is not null and r->>'deleted_at' is null and not(rid=any(ids)) then perform public.l5_fail('cycle_change');end if;
 end loop;
end$$;
create or replace function public.l7_steps(v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare ids jsonb;begin if jsonb_typeof(v->'steps') is distinct from 'array' then perform public.l5_fail('source_invalide');end if;select coalesce(jsonb_agg(value->'id' order by ordinality),'[]') into ids from jsonb_array_elements(v->'steps') with ordinality;if not public.l7_ids(ids) then perform public.l5_fail('source_invalide');end if;return ids;end$$;
create or replace function public.l7_union(a jsonb,b jsonb) returns jsonb language sql immutable set search_path='' as $$select coalesce(jsonb_agg(value order by convert_to(value#>>'{}','UTF8')),'[]') from (select distinct value from jsonb_array_elements(a||b)) x$$;
create or replace function public.l7_cooking(c jsonb) returns jsonb language plpgsql set search_path='' as $$
declare old jsonb;d jsonb;b jsonb:=c->'base';x jsonb:=c->'change';action text:=c->>'action';s jsonb;v jsonb;legacy jsonb;timer jsonb;step jsonb;entry jsonb;ids jsonb;expected jsonb;versions jsonb:='[]';r jsonb;vid text;rows jsonb;begin
 perform public.l7_validate_command(c);old:=public.l7_get(c->>'store',c->>'id');if old is not null and old->>'deleted_at' is not null then perform public.l5_fail('operation_obsolete');end if;d:=old->'data';
 if d is not null and (case when c->>'store'='timer_launches' then public.l7_valid_timer(d) else public.l7_valid_session(d) end) and public.l7_receipt(d,c) then return jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','already_applied',true,'server_rows',jsonb_build_array(old));end if;
 if action='restore' then
  if d is null then if b->'expected_target_sha256'<>'null'::jsonb then perform public.l5_fail('restauration_changee');end if;elsif public.l5_sha256(public.l7_project_seed(d)) is distinct from b->>'expected_target_sha256' or public.l7_project_seed(d) is distinct from public.l7_project_seed(x->'target') then perform public.l5_fail('restauration_changee');end if;
  d:=x->'target';perform public.l7_contexts(c,d,true);
  if c->>'store'='timer_launches' then d:=d||jsonb_build_object('cooking_incarnation',c->'operation_id','cooking_revision',c->'operation_id');else d:=jsonb_set(d,'{cooking_state}',d->'cooking_state'||jsonb_build_object('incarnation',c->'operation_id','active_revision',c->'operation_id','lang_revision',c->'operation_id'));for vid in select jsonb_object_keys(d->'progress'->'by_version') loop d:=jsonb_set(d,array['progress','by_version',vid,'revision'],c->'operation_id');end loop;end if;
  d:=public.l7_add_receipt(d,c,true);
 elsif c->>'store'='timer_launches' then
  if action='create' then if old is not null then perform public.l5_fail('identite_changee');end if;d:=x->'timer'||jsonb_build_object('cooking_incarnation',c->'operation_id','cooking_revision',c->'operation_id','cooking_receipts','[]'::jsonb,'cooking_receipt_floor',0);
  else if d is null or not public.l7_valid_timer(d) or public.l5_sha256(public.l7_project_timer_identity(d)) is distinct from b->>'identity_sha256' then perform public.l5_fail('ancre_changee');end if;end if;
  if action<>'handoff' then
   s:=public.l7_get('cook_sessions',d->>'cook_session_id');v:=public.l7_get('recipe_versions',d->>'recipe_version_id');if s is null or v is null or s->>'deleted_at' is not null or v->>'deleted_at' is not null then perform public.l5_fail('source_changee');end if;s:=s->'data';v:=v->'data';
   if s->>'status' is distinct from 'active' then perform public.l5_fail('session_terminee');end if;if not public.l7_valid_session(s) or public.l5_sha256(public.l7_project_session_context(s)) is distinct from b->>'session_sha256' or not(s->'selected_version_ids' ? (v->>'id')) then perform public.l5_fail('session_changee');end if;
   if public.l5_sha256(public.l7_project_version_source(v)) is distinct from b->>'source_sha256' then perform public.l5_fail('source_changee');end if;perform public.l7_contexts(c,s,true);
   if action='create' then
    if d->'source_timer'='null'::jsonb then legacy:=public.l7_get('timer_launches',d->>'legacy_launch_id');if legacy is null or legacy->>'deleted_at' is not null or legacy->'data' ?| array['timer_format','mirror'] or public.l5_sha256(public.l7_project_seed(legacy->'data')) is distinct from b->>'legacy_launch_sha256' or legacy->'data'->>'cook_session_id' is distinct from d->>'cook_session_id' or legacy->'data'->>'recipe_version_id' is distinct from d->>'recipe_version_id' or public.l7_duration(legacy->'data'->'duration_seconds') is distinct from (d->>'duration_seconds')::integer then perform public.l5_fail('source_changee');end if;
    else if b->'legacy_launch_sha256'<>'null'::jsonb then perform public.l5_fail('forme_invalide');end if;perform public.l7_steps(v);select value into step from jsonb_array_elements(v->'steps') where value->'id'=d->'step_id';timer:=step->'timers'->((d->'source_timer'->>'ordinal')::integer);if timer is null or public.l5_sha256(timer) is distinct from d->'source_timer'->>'sha256' or timer->'seconds' is distinct from d->'source_timer'->'seconds' or coalesce(timer->'seconds_max','null') is distinct from d->'source_timer'->'seconds_max' then perform public.l5_fail('source_changee');end if;end if;
   else if d->'mirror'<>'null'::jsonb then perform public.l5_fail('ancre_changee');end if;if d->'source_timer'<>'null'::jsonb then perform public.l7_steps(v);select value into step from jsonb_array_elements(v->'steps') where value->'id'=d->'step_id';timer:=step->'timers'->((d->'source_timer'->>'ordinal')::integer);if timer is null or public.l5_sha256(timer) is distinct from d->'source_timer'->>'sha256' then perform public.l5_fail('source_changee');end if;end if;d:=d||jsonb_build_object('mirror',x->'mirror');end if;
  else
   if d->'handoff_state' is distinct from b->'handoff_state' or not(case b->>'handoff_state' when 'requested' then x->>'handoff_state' in ('opening','failed') when 'opening' then x->>'handoff_state' in ('unconfirmed','failed') when 'unconfirmed' then x->>'handoff_state'='failed' when 'siri' then x->>'handoff_state'='failed' else false end) then perform public.l5_fail('handoff_change');end if;d:=d||jsonb_build_object('handoff_state',x->'handoff_state');
  end if;d:=public.l7_add_receipt(d,c,false);
 else
  if d is null or d->>'status' is distinct from 'active' then perform public.l5_fail('session_terminee');end if;perform public.l7_contexts(c,d,true);
  if action='adopt_progress' then
   if public.l5_sha256(public.l7_project_session_full(d)) is distinct from b->>'session_sha256' or public.l5_sha256(coalesce(d->'progress','null')) is distinct from b->>'legacy_progress_sha256' then perform public.l5_fail('progression_changee');end if;
   select coalesce(jsonb_agg(value order by convert_to(value#>>'{}','UTF8')),'[]') into expected from jsonb_array_elements(d->'selected_version_ids');select coalesce(jsonb_agg(value->'id' order by convert_to(value->>'id','UTF8')),'[]') into ids from jsonb_array_elements(b->'versions');if ids is distinct from expected then perform public.l5_fail('source_changee');end if;
   for r in select value from jsonb_array_elements(b->'versions') loop v:=public.l7_get('recipe_versions',r->>'id');if v is null or v->>'deleted_at' is not null then if r->'sha256'<>'null'::jsonb then perform public.l5_fail('source_changee');end if;else if public.l5_sha256(public.l7_project_version_source(v->'data')) is distinct from r->>'sha256' then perform public.l5_fail('source_changee');end if;versions:=versions||jsonb_build_array(v->'data');end if;end loop;d:=public.l7_adopt_progress(d,versions,c->>'operation_id');
  else
   if not public.l7_valid_session(d) or public.l5_sha256(public.l7_project_session_context(d)) is distinct from b->>'session_context_sha256' then perform public.l5_fail('session_changee');end if;
   if action in ('language','finish') then
    select coalesce(jsonb_agg(value order by convert_to(value#>>'{}','UTF8')),'[]') into expected from jsonb_array_elements(d->'selected_version_ids');select coalesce(jsonb_agg(value->'id' order by convert_to(value->>'id','UTF8')),'[]') into ids from jsonb_array_elements(b->'versions');if ids is distinct from expected then perform public.l5_fail('source_changee');end if;
    for r in select value from jsonb_array_elements(b->'versions') loop v:=public.l7_get('recipe_versions',r->>'id');if v is null or v->>'deleted_at' is not null then if r->'sha256'<>'null'::jsonb then perform public.l5_fail('source_changee');end if;else if public.l5_sha256(public.l7_project_version_source(v->'data')) is distinct from r->>'sha256' then perform public.l5_fail('source_changee');end if;end if;end loop;
   end if;
   case action
   when 'progress' then
    vid:=b->>'version_id';entry:=d->'progress'->'by_version'->vid;if entry is null or entry->'revision' is distinct from b->'progress_revision' then perform public.l5_fail('progression_changee');end if;v:=public.l7_get('recipe_versions',vid);if v is null or v->>'deleted_at' is not null or public.l5_sha256(public.l7_project_version_source(v->'data')) is distinct from b->>'source_sha256' then perform public.l5_fail('source_changee');end if;ids:=public.l7_steps(v->'data');if x->'current_step_id'<>'null'::jsonb and not(ids ? (x->>'current_step_id')) or exists(select 1 from jsonb_array_elements(x->'done_add') z where not(ids ? (z#>>'{}'))) then perform public.l5_fail('source_changee');end if;d:=jsonb_set(d,array['progress','by_version',vid],entry||jsonb_build_object('current_step_id',x->'current_step_id','done_step_ids',public.l7_union(entry->'done_step_ids',x->'done_add'),'revision',c->'operation_id'));
   when 'active' then v:=public.l7_get('recipe_versions',x->>'active_version_id');if v is null or v->>'deleted_at' is not null or public.l5_sha256(public.l7_project_version_source(v->'data')) is distinct from b->>'source_sha256' then perform public.l5_fail('source_changee');end if;if d->'cooking_state'->'active_revision' is distinct from b->'active_revision' or not(d->'selected_version_ids' ? (x->>'active_version_id')) then perform public.l5_fail('progression_changee');end if;d:=jsonb_set(d||jsonb_build_object('active_version_id',x->'active_version_id'),'{cooking_state,active_revision}',c->'operation_id');
   when 'language' then if d->'cooking_state'->'lang_revision' is distinct from b->'lang_revision' then perform public.l5_fail('progression_changee');end if;d:=jsonb_set(d||jsonb_build_object('lang',x->'lang'),'{cooking_state,lang_revision}',c->'operation_id');
   when 'finish' then
    select coalesce(jsonb_agg(value order by convert_to(value#>>'{}','UTF8')),'[]') into ids from jsonb_array_elements(d->'selected_version_ids');select coalesce(jsonb_agg(value->'version_id' order by convert_to(value->>'version_id','UTF8')),'[]') into expected from jsonb_array_elements(b->'progress');if expected is distinct from ids then perform public.l5_fail('historique_incomplet');end if;
    for r in select value from jsonb_array_elements(b->'progress') loop if d->'progress'->'by_version'->(r->>'version_id')->'revision' is distinct from r->'revision' then perform public.l5_fail('progression_changee');end if;end loop;expected:='[]';
    for r in select value from jsonb_array_elements(b->'history') loop legacy:=public.l7_get('cook_history',r->>'id');if legacy is null or legacy->>'deleted_at' is not null or public.l5_sha256(public.l7_project_seed(legacy->'data')) is distinct from r->>'sha256' or legacy->'data'->>'cook_session_id' is distinct from d->>'id' then perform public.l5_fail('historique_change');end if;v:=public.l7_get('recipe_versions',legacy->'data'->>'recipe_version_id');if v is null or v->>'deleted_at' is not null or v->'data'->>'recipe_id' is distinct from legacy->'data'->>'recipe_id' then perform public.l5_fail('historique_change');end if;expected:=expected||jsonb_build_array(legacy->'data'->'recipe_version_id');end loop;select coalesce(jsonb_agg(value order by convert_to(value#>>'{}','UTF8')),'[]') into expected from jsonb_array_elements(expected);if expected is distinct from ids then perform public.l5_fail('historique_incomplet');end if;
    for r in select value from jsonb_array_elements(x->'done_add') loop vid:=r->>'version_id';entry:=d->'progress'->'by_version'->vid;v:=public.l7_get('recipe_versions',vid);if entry is null or v is null or v->>'deleted_at' is not null then perform public.l5_fail('source_changee');end if;ids:=public.l7_steps(v->'data');if exists(select 1 from jsonb_array_elements(r->'step_ids') z where not(ids ? (z#>>'{}'))) then perform public.l5_fail('source_changee');end if;d:=jsonb_set(d,array['progress','by_version',vid],entry||jsonb_build_object('done_step_ids',public.l7_union(entry->'done_step_ids',r->'step_ids'),'revision',c->'operation_id'));end loop;d:=d||jsonb_build_object('status','done','ended_at',x->'ended_at');
   else perform public.l5_fail('forme_invalide');end case;
  end if;d:=public.l7_add_receipt(d,c,false);
 end if;
 if not(case when c->>'store'='timer_launches' then public.l7_valid_timer(d) else public.l7_valid_session(d) end) then perform public.l5_fail('forme_invalide');end if;
 rows:=jsonb_build_array(public.l7_put(c->>'store',c->>'id',d));return jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','server_rows',rows);
end$$;

create or replace function public.l7_apply_cooking_command(c jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;server jsonb;motif text;previous text:=coalesce(current_setting('app.l1_write',true),'');begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;perform public.l2_lock_owner();
 begin
  perform set_config('app.l1_write',jsonb_build_object('archive_import',c->>'action'='restore','recipe_contexts',c->'contexts'->'recipes','edition_contexts',c->'contexts'->'editions')::text,true);
  result:=public.l7_cooking(c);perform set_config('app.l1_write',previous,true);return jsonb_build_object('accepted',jsonb_build_array(result),'adjusted','[]'::jsonb,'rejected','[]'::jsonb,'server_time',clock_timestamp());
 exception when check_violation or data_exception then
  motif:=sqlerrm;if motif not in ('forme_invalide','operation_invalide','operation_obsolete','bornes','restauration_changee','identite_changee','ancre_changee','source_changee','source_invalide','session_changee','session_terminee','cycle_change','progression_changee','historique_incomplet','historique_change','handoff_change') then motif:='forme_invalide';end if;
  if c->>'store' in ('timer_launches','cook_sessions') then server:=public.l7_get(c->>'store',c->>'id');end if;perform set_config('app.l1_write',previous,true);return jsonb_build_object('accepted','[]'::jsonb,'adjusted','[]'::jsonb,'rejected',jsonb_build_array(jsonb_build_object('store',c->'store','id',c->'id','operation_id',c->'operation_id','payload_sha256',c->'payload_sha256','reason',motif,'server',server)),'server_time',clock_timestamp());
 end;
end$$;

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

-- Les contextes sont contrôlés par la commande fermée ; l'exception reste limitée à sa table de session.
do $patch$ declare nom text;definition text;clause text;begin
 foreach nom in array array['l1_guard_recipe','l2_guard_write'] loop
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=nom and p.pronargs=0;
  clause:='begin'||chr(10)||' if tg_table_name=''cook_sessions'' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid=''public.l7_apply_cooking_command(jsonb)''::regprocedure) then if tg_op=''DELETE'' then return old;else return new;end if;end if;'||chr(10);
  definition:=regexp_replace(definition,'begin[[:space:]]',clause,'i');execute definition;
 end loop;
end $patch$;
alter function public.sync_push_v2(jsonb) rename to l6_sync_push_v2;
create function public.sync_push_v2(rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;perform public.l2_lock_owner();
 if exists(select 1 from jsonb_array_elements(rows) r where r->>'op'='cooking_apply') then if jsonb_array_length(rows)<>1 or octet_length(jsonb_build_object('rows',rows)::text)>921600 then raise exception 'rows : commande isolée requise';end if;return public.l7_apply_cooking_command(rows->0);end if;return public.l6_sync_push_v2(rows);
end$$;
create or replace function public.sync_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$select jsonb_build_object('recipe_lifecycle',1,'edition_lifecycle',1,'source_batches',1,'source_revisions',1,'recipe_language',1,'cooking_persistence',1)$$;
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l7_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end$$;
revoke all on function public.sync_push_v2(jsonb),public.l6_sync_push_v2(jsonb),public.sync_capabilities() from public,anon,authenticated;
grant execute on function public.l7_validate_cooking_write(text,jsonb,jsonb),public.l7_apply_cooking_command(jsonb),public.sync_push_v2(jsonb),public.l6_sync_push_v2(jsonb),public.sync_capabilities() to authenticated;
