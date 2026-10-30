export const traductionsPublicationSql=String.raw`
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
`;
