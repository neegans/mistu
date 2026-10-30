// L7 — mêmes projections et formes fermées que cuisine-format.js, sans accès réseau.
import {CHAMPS_IDENTITE_MINUTEUR,CHAMPS_CONTEXTE_SESSION,CHAMPS_MINUTEUR_CUISINE} from '../src/domain/cuisine-format.js';
const quote=s=>"'"+s.replaceAll("'","''")+"'",keys=xs=>'array['+xs.map(quote).join(',')+']::text[]';
export const cuisineCanonSql=String.raw`
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
create or replace function public.l7_project_timer_identity(r jsonb) returns jsonb language sql immutable set search_path='' as $$select public.l5_project_fields(r,'cooking-timer-identity-v1',${keys(CHAMPS_IDENTITE_MINUTEUR)})$$;
create or replace function public.l7_project_session_context(r jsonb) returns jsonb language sql immutable set search_path='' as $$select public.l5_project_fields(r,'cooking-session-context-v1',${keys(CHAMPS_CONTEXTE_SESSION)})||jsonb_build_object('incarnation',coalesce(r->'cooking_state'->'incarnation','null'::jsonb))$$;
create or replace function public.l7_project_session_full(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','cooking-session-full-v1','data',r-'created_at'-'updated_at')$$;
create or replace function public.l7_project_version_source(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','cooking-version-v1','data',r-'created_at'-'updated_at'-'status')$$;
create or replace function public.l7_project_seed(r jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('projection','cooking-seed-v1','data',r-'created_at'-'updated_at')$$;
create or replace function public.l7_valid_timer(r jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb:=r->'source_timer';m jsonb:=r->'mirror';k text;begin
 if not public.l5_exact_keys(r,${keys(CHAMPS_MINUTEUR_CUISINE)}) or r->'timer_format' is distinct from '1'::jsonb or not public.l5_index_int(r->'duration_seconds',1,86400) or coalesce(r->>'channel','') not in ('mirror','shortcut','siri') or not public.l7_op(r->'cooking_incarnation') or not public.l7_op(r->'cooking_revision') or not public.l7_date(r->'created_at') or not public.l7_date(r->'updated_at') then return false;end if;
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
`;
