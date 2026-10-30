// Journaux L6 : validation fermée, capture relue et phases reçues sans publication implicite.
export const traductionsJournauxSql=String.raw`
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
`;
