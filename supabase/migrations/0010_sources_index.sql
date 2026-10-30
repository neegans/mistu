-- 0010_sources_index.sql — généré par tools/generer-migrations.mjs.
-- Protocole L5 : commandes immuables ; aucune application distante automatique.

-- Les clés sont triées par octets UTF-8 ; aucun tri dépendant de la locale.
create or replace function public.l5_canonical_depth(value jsonb, depth integer) returns text
language plpgsql immutable set search_path = '' as $fn$
declare kind text; answer text; numeric_value numeric;
begin
 if value is null or depth is null or depth < 0 or depth > 64 then raise exception 'invalid_shape' using errcode='22023'; end if;
 kind:=pg_catalog.jsonb_typeof(value);
 if kind in ('null','boolean','string') then return value::text; end if;
 if kind='number' then
  numeric_value:=(value::text)::numeric;
  if numeric_value=0 then return '0'; end if;
  return pg_catalog.trim_scale(numeric_value)::text;
 end if;
 if kind='array' then
  select '['||coalesce(pg_catalog.string_agg(public.l5_canonical_depth(e.value,depth+1),',' order by e.ordinality),'')||']'
    into answer from pg_catalog.jsonb_array_elements(value) with ordinality as e(value,ordinality);
  return answer;
 end if;
 if kind='object' then
  if value ?| array['__proto__','constructor','prototype'] then raise exception 'invalid_shape' using errcode='22023'; end if;
  select '{'||coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(e.key)::text||':'||public.l5_canonical_depth(e.value,depth+1),',' order by pg_catalog.convert_to(e.key,'UTF8')),'')||'}'
    into answer from pg_catalog.jsonb_each(value) as e(key,value);
  return answer;
 end if;
 raise exception 'invalid_shape' using errcode='22023';
end;
$fn$;
create or replace function public.l5_canonical(value jsonb) returns text
language sql immutable set search_path = '' as $fn$ select public.l5_canonical_depth(value,0); $fn$;
create or replace function public.l5_sha256(value jsonb) returns text
language sql immutable set search_path = '' as $fn$
 select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(public.l5_canonical(value),'UTF8')),'hex');
$fn$;
create or replace function public.l5_project_fields(row_data jsonb, tag text, field_names text[]) returns jsonb
language sql immutable set search_path = '' as $fn$
 select pg_catalog.jsonb_build_object('projection',tag,'fields',coalesce(pg_catalog.jsonb_agg(
  pg_catalog.jsonb_build_array(f.name,case when row_data ? f.name then pg_catalog.jsonb_build_array(true,row_data->f.name) else pg_catalog.jsonb_build_array(false) end)
  order by f.ordinality),'[]'::jsonb))
 from pg_catalog.unnest(field_names) with ordinality as f(name,ordinality);
$fn$;
create or replace function public.l5_page_rotation(row_data jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $fn$
declare rotation jsonb:=row_data->'rotation';
begin
 if rotation is null or rotation='null'::jsonb then rotation:='0'::jsonb; end if;
 if rotation not in ('0'::jsonb,'90'::jsonb,'180'::jsonb,'270'::jsonb) then raise exception 'invalid_shape' using errcode='22023'; end if;
 return coalesce(row_data,'{}'::jsonb)||pg_catalog.jsonb_build_object('rotation',rotation);
end;
$fn$;

create or replace function public.l5_project_page(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(public.l5_page_rotation(row_data),'page-identity-v1',array['id','edition_id','document_id','sha256','rotation','file_position','locator','document_page_number','source_revision','source_copy']::text[]);
$fn$;


create or replace function public.l5_project_annotation(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'page-annotation-v1',array['printed_page','printed_page_range','position','kind','role','issues']::text[]);
$fn$;


create or replace function public.l5_project_document(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'document-identity-v1',array['id','edition_id','scan_session_id','source_type','sha256','blob_path','size','mime','original_filename','captured_at','replaces_document_id','source_copy']::text[]);
$fn$;


create or replace function public.l5_project_session(row_data jsonb, extra jsonb default '[]'::jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'source-session-v1',array['id','edition_id','status','page_ids','document_ids','recipe_ids','source_state','source_copy','but','started_at','device_id']::text[])||pg_catalog.jsonb_build_object('sources',extra);
$fn$;


create or replace function public.l5_project_session_identity(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'session-identity-v1',array['id','edition_id','source_copy']::text[]);
$fn$;


create or replace function public.l5_project_recipe(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'index-recipe-v1',array['id','edition_id','original_title','display_title','printed_page','printed_pages','availability','current_version_id','lifecycle_id','trashed_at','restored_from_edition','index_import_id','index_page_id','source_page_ids','index_rubriques','verification_state','raw_entry','index_uncertain','section']::text[]);
$fn$;

create or replace function public.l5_project_reading(row_data jsonb, logical_result jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'index-reading-v1',array['id','kind','recipe_id','edition_id','scan_session_id','page_ids','started_at','owner_id','expected_edition_id','expected_edition_cycle_id','expected_cycle_id','index_call','source_capture','sources_attendues','model']::text[])||pg_catalog.jsonb_build_object('resultat',logical_result);
$fn$;
create or replace function public.l5_project_seed(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select pg_catalog.jsonb_build_object('projection','source-seed-v1','data',row_data-'created_at'-'updated_at');
$fn$;
create or replace function public.l5_project_target(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select pg_catalog.jsonb_build_object('projection','target_source-v1','data',(row_data-'created_at'-'updated_at'-'source_receipts')#-'{source_state,revision}');
$fn$;
create or replace function public.l5_project_transfer_base(row_data jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select pg_catalog.jsonb_build_object('projection','source-transfer-base-v1','data',row_data-'created_at'-'updated_at'-'source_receipts');
$fn$;
revoke all on function public.l5_canonical_depth(jsonb,integer),public.l5_canonical(jsonb),public.l5_sha256(jsonb),public.l5_project_fields(jsonb,text,text[]),public.l5_page_rotation(jsonb),
 public.l5_project_page(jsonb),public.l5_project_annotation(jsonb),public.l5_project_document(jsonb),public.l5_project_session(jsonb,jsonb),public.l5_project_session_identity(jsonb),public.l5_project_recipe(jsonb),public.l5_project_reading(jsonb,jsonb),public.l5_project_seed(jsonb),public.l5_project_target(jsonb),public.l5_project_transfer_base(jsonb) from public;


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


create or replace function public.l5_index_keys(d jsonb,allowed text[],required text[] default '{}') returns boolean
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(d) is distinct from 'object' then return false;end if;
 return not exists(select 1 from jsonb_object_keys(d) k where not(k=any(allowed)))
 and not exists(select 1 from unnest(required) k where not(d?k));
end $$;
create or replace function public.l5_index_int(n jsonb,minimum numeric,maximum numeric) returns boolean
language plpgsql immutable set search_path='' as $$
declare v numeric;begin
 if jsonb_typeof(n) is distinct from 'number' then return false;end if;v:=(n::text)::numeric;
 return v=trunc(v) and v between minimum and maximum;
end $$;
create or replace function public.l5_index_hash(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='string' and (v#>>'{}') ~ '^[a-f0-9]{64}$',false);
$$;
create or replace function public.l5_index_address(v text) returns boolean language sql immutable set search_path='' as $$
 select translate(pg_catalog.normalize(v,'NFKC'),'。｡∕⁄','..//') ~* '(https?://|www\.|(?<![a-z0-9-])[a-z0-9-]+\.[a-z]{2,}/)'
 or translate(pg_catalog.normalize(v,'NFKC'),'。｡∕⁄','..//') ~* '(?<![0-9A-Za-zª²-³µ¹-º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶ-ͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-ي٠-٩ٮ-ٯٱ-ۓەۥ-ۦۮ-ۼۿܐܒ-ܯݍ-ޥޱ߀-ߪߴ-ߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-࢏ࢠ-ࣉऄ-हऽॐक़-ॡ०-९ॱ-ঀঅ-ঌএ-ঐও-নপ-রলশ-হঽৎড়-ঢ়য়-ৡ০-ৱ৴-৹ৼਅ-ਊਏ-ਐਓ-ਨਪ-ਰਲ-ਲ਼ਵ-ਸ਼ਸ-ਹਖ਼-ੜਫ਼੦-੯ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલ-ળવ-હઽૐૠ-ૡ૦-૯ૹଅ-ଌଏ-ଐଓ-ନପ-ରଲ-ଳଵ-ହଽଡ଼-ଢ଼ୟ-ୡ୦-୯ୱ-୷ஃஅ-ஊஎ-ஐஒ-கங-சஜஞ-டண-தந-பம-ஹௐ௦-௲అ-ఌఎ-ఐఒ-నప-హఽౘ-ౚ౜-ౝౠ-ౡ౦-౯౸-౾ಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ೜-ೞೠ-ೡ೦-೯ೱ-ೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖ൘-ൡ൦-൸ൺ-ൿඅ-ඖක-නඳ-රලව-ෆ෦-෯ก-ะา-ำเ-ๆ๐-๙ກ-ຂຄຆ-ຊຌ-ຣລວ-ະາ-ຳຽເ-ໄໆ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬྈ-ྌက-ဪဿ-၉ၐ-ၕၚ-ၝၡၥ-ၦၮ-ၰၵ-ႁႎ႐-႙Ⴀ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡸᢀ-ᢄᢇ-ᢨᢪᢰ-ᣵᤀ-ᤞ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨖᨠ-ᩔ᪀-᪉᪐-᪙ᪧᬅ-ᬳᭅ-ᭌ᭐-᭙ᮃ-ᮠᮮ-ᯥᰀ-ᰣ᱀-᱉ᱍ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵ-ᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰-ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛⓪-⓿❶-➓Ⰰ-ⳤⳫ-ⳮⳲ-ⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎ㆒-㆕ㆠ-ㆿㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-Ƛ꟱-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢ꠰-꠵ꡀ-ꡳꢂ-ꢳ꣐-꣙ꣲ-ꣷꣻꣽ-ꣾ꤀-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋ꩐-꩙ꩠ-ꩶꩺꩾ-ꪯꪱꪵ-ꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ𐀀-𐀋𐀍-𐀦𐀨-𐀺𐀼-𐀽𐀿-𐁍𐁐-𐁝𐂀-𐃺𐄇-𐄳𐅀-𐅸𐆊-𐆋𐊀-𐊜𐊠-𐋐𐋡-𐋻𐌀-𐌣𐌭-𐍊𐍐-𐍵𐎀-𐎝𐎠-𐏃𐏈-𐏏𐏑-𐏕𐐀-𐒝𐒠-𐒩𐒰-𐓓𐓘-𐓻𐔀-𐔧𐔰-𐕣𐕰-𐕺𐕼-𐖊𐖌-𐖒𐖔-𐖕𐖗-𐖡𐖣-𐖱𐖳-𐖹𐖻-𐖼𐗀-𐗳𐘀-𐜶𐝀-𐝕𐝠-𐝧𐞀-𐞅𐞇-𐞰𐞲-𐞺𐠀-𐠅𐠈𐠊-𐠵𐠷-𐠸𐠼𐠿-𐡕𐡘-𐡶𐡹-𐢞𐢧-𐢯𐣠-𐣲𐣴-𐣵𐣻-𐤛𐤠-𐤹𐥀-𐥙𐦀-𐦷𐦼-𐧏𐧒-𐨀𐨐-𐨓𐨕-𐨗𐨙-𐨵𐩀-𐩈𐩠-𐩾𐪀-𐪟𐫀-𐫇𐫉-𐫤𐫫-𐫯𐬀-𐬵𐭀-𐭕𐭘-𐭲𐭸-𐮑𐮩-𐮯𐰀-𐱈𐲀-𐲲𐳀-𐳲𐳺-𐴣𐴰-𐴹𐵀-𐵥𐵯-𐶅𐹠-𐹾𐺀-𐺩𐺰-𐺱𐻂-𐻇𐼀-𐼧𐼰-𐽅𐽑-𐽔𐽰-𐾁𐾰-𐿋𐿠-𐿶𑀃-𑀷𑁒-𑁯𑁱-𑁲𑁵𑂃-𑂯𑃐-𑃨𑃰-𑃹𑄃-𑄦𑄶-𑄿𑅄𑅇𑅐-𑅲𑅶𑆃-𑆲𑇁-𑇄𑇐-𑇚𑇜𑇡-𑇴𑈀-𑈑𑈓-𑈫𑈿-𑉀𑊀-𑊆𑊈𑊊-𑊍𑊏-𑊝𑊟-𑊨𑊰-𑋞𑋰-𑋹𑌅-𑌌𑌏-𑌐𑌓-𑌨𑌪-𑌰𑌲-𑌳𑌵-𑌹𑌽𑍐𑍝-𑍡𑎀-𑎉𑎋𑎎𑎐-𑎵𑎷𑏑𑏓𑐀-𑐴𑑇-𑑊𑑐-𑑙𑑟-𑑡𑒀-𑒯𑓄-𑓅𑓇𑓐-𑓙𑖀-𑖮𑗘-𑗛𑘀-𑘯𑙄𑙐-𑙙𑚀-𑚪𑚸𑛀-𑛉𑛐-𑛣𑜀-𑜚𑜰-𑜻𑝀-𑝆𑠀-𑠫𑢠-𑣲𑣿-𑤆𑤉𑤌-𑤓𑤕-𑤖𑤘-𑤯𑤿𑥁𑥐-𑥙𑦠-𑦧𑦪-𑧐𑧡𑧣𑨀𑨋-𑨲𑨺𑩐𑩜-𑪉𑪝𑪰-𑫸𑯀-𑯠𑯰-𑯹𑰀-𑰈𑰊-𑰮𑱀𑱐-𑱬𑱲-𑲏𑴀-𑴆𑴈-𑴉𑴋-𑴰𑵆𑵐-𑵙𑵠-𑵥𑵧-𑵨𑵪-𑶉𑶘𑶠-𑶩𑶰-𑷛𑷠-𑷩𑻠-𑻲𑼂𑼄-𑼐𑼒-𑼳𑽐-𑽙𑾰𑿀-𑿔𒀀-𒎙𒐀-𒑮𒒀-𒕃𒾐-𒿰𓀀-𓐯𓑁-𓑆𓑠-𔏺𔐀-𔙆𖄀-𖄝𖄰-𖄹𖠀-𖨸𖩀-𖩞𖩠-𖩩𖩰-𖪾𖫀-𖫉𖫐-𖫭𖬀-𖬯𖭀-𖭃𖭐-𖭙𖭛-𖭡𖭣-𖭷𖭽-𖮏𖵀-𖵬𖵰-𖵹𖹀-𖺖𖺠-𖺸𖺻-𖻓𖼀-𖽊𖽐𖾓-𖾟𖿠-𖿡𖿣𖿲-𖿶𗀀-𘳕𘳿-𘴞𘶀-𘷲𚿰-𚿳𚿵-𚿻𚿽-𚿾𛀀-𛄢𛄲𛅐-𛅒𛅕𛅤-𛅧𛅰-𛋻𛰀-𛱪𛱰-𛱼𛲀-𛲈𛲐-𛲙𜳰-𜳹𝋀-𝋓𝋠-𝋳𝍠-𝍸𝐀-𝑔𝑖-𝒜𝒞-𝒟𝒢𝒥-𝒦𝒩-𝒬𝒮-𝒹𝒻𝒽-𝓃𝓅-𝔅𝔇-𝔊𝔍-𝔔𝔖-𝔜𝔞-𝔹𝔻-𝔾𝕀-𝕄𝕆𝕊-𝕐𝕒-𝚥𝚨-𝛀𝛂-𝛚𝛜-𝛺𝛼-𝜔𝜖-𝜴𝜶-𝝎𝝐-𝝮𝝰-𝞈𝞊-𝞨𝞪-𝟂𝟄-𝟋𝟎-𝟿𝼀-𝼞𝼥-𝼪𞀰-𞁭𞄀-𞄬𞄷-𞄽𞅀-𞅉𞅎𞊐-𞊭𞋀-𞋫𞋰-𞋹𞓐-𞓫𞓰-𞓹𞗐-𞗭𞗰-𞗺𞛀-𞛞𞛠-𞛢𞛤-𞛥𞛧-𞛭𞛰-𞛴𞛾-𞛿𞟠-𞟦𞟨-𞟫𞟭-𞟮𞟰-𞟾𞠀-𞣄𞣇-𞣏𞤀-𞥃𞥋𞥐-𞥙𞱱-𞲫𞲭-𞲯𞲱-𞲴𞴁-𞴭𞴯-𞴽𞸀-𞸃𞸅-𞸟𞸡-𞸢𞸤𞸧𞸩-𞸲𞸴-𞸷𞸹𞸻𞹂𞹇𞹉𞹋𞹍-𞹏𞹑-𞹒𞹔𞹗𞹙𞹛𞹝𞹟𞹡-𞹢𞹤𞹧-𞹪𞹬-𞹲𞹴-𞹷𞹹-𞹼𞹾𞺀-𞺉𞺋-𞺛𞺡-𞺣𞺥-𞺩𞺫-𞺻🄀-🄌🯰-🯹𠀀-𪛟𪜀-𫠝𫠠-𬺭𬺰-𮯠𮯰-𮹝丽-𪘀𰀀-𱍊𱍐-𳑹@._-])[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|ca|quebec|fr|be|ch|io|co|info|app|blog|xyz|site|online|shop|me|tv|us|uk|ly|gl)(?![0-9A-Za-zª²-³µ¹-º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶ-ͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-ي٠-٩ٮ-ٯٱ-ۓەۥ-ۦۮ-ۼۿܐܒ-ܯݍ-ޥޱ߀-ߪߴ-ߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-࢏ࢠ-ࣉऄ-हऽॐक़-ॡ०-९ॱ-ঀঅ-ঌএ-ঐও-নপ-রলশ-হঽৎড়-ঢ়য়-ৡ০-ৱ৴-৹ৼਅ-ਊਏ-ਐਓ-ਨਪ-ਰਲ-ਲ਼ਵ-ਸ਼ਸ-ਹਖ਼-ੜਫ਼੦-੯ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલ-ળવ-હઽૐૠ-ૡ૦-૯ૹଅ-ଌଏ-ଐଓ-ନପ-ରଲ-ଳଵ-ହଽଡ଼-ଢ଼ୟ-ୡ୦-୯ୱ-୷ஃஅ-ஊஎ-ஐஒ-கங-சஜஞ-டண-தந-பம-ஹௐ௦-௲అ-ఌఎ-ఐఒ-నప-హఽౘ-ౚ౜-ౝౠ-ౡ౦-౯౸-౾ಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ೜-ೞೠ-ೡ೦-೯ೱ-ೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖ൘-ൡ൦-൸ൺ-ൿඅ-ඖක-නඳ-රලව-ෆ෦-෯ก-ะา-ำเ-ๆ๐-๙ກ-ຂຄຆ-ຊຌ-ຣລວ-ະາ-ຳຽເ-ໄໆ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬྈ-ྌက-ဪဿ-၉ၐ-ၕၚ-ၝၡၥ-ၦၮ-ၰၵ-ႁႎ႐-႙Ⴀ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡸᢀ-ᢄᢇ-ᢨᢪᢰ-ᣵᤀ-ᤞ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨖᨠ-ᩔ᪀-᪉᪐-᪙ᪧᬅ-ᬳᭅ-ᭌ᭐-᭙ᮃ-ᮠᮮ-ᯥᰀ-ᰣ᱀-᱉ᱍ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵ-ᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰-ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛⓪-⓿❶-➓Ⰰ-ⳤⳫ-ⳮⳲ-ⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎ㆒-㆕ㆠ-ㆿㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-Ƛ꟱-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢ꠰-꠵ꡀ-ꡳꢂ-ꢳ꣐-꣙ꣲ-ꣷꣻꣽ-ꣾ꤀-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋ꩐-꩙ꩠ-ꩶꩺꩾ-ꪯꪱꪵ-ꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ𐀀-𐀋𐀍-𐀦𐀨-𐀺𐀼-𐀽𐀿-𐁍𐁐-𐁝𐂀-𐃺𐄇-𐄳𐅀-𐅸𐆊-𐆋𐊀-𐊜𐊠-𐋐𐋡-𐋻𐌀-𐌣𐌭-𐍊𐍐-𐍵𐎀-𐎝𐎠-𐏃𐏈-𐏏𐏑-𐏕𐐀-𐒝𐒠-𐒩𐒰-𐓓𐓘-𐓻𐔀-𐔧𐔰-𐕣𐕰-𐕺𐕼-𐖊𐖌-𐖒𐖔-𐖕𐖗-𐖡𐖣-𐖱𐖳-𐖹𐖻-𐖼𐗀-𐗳𐘀-𐜶𐝀-𐝕𐝠-𐝧𐞀-𐞅𐞇-𐞰𐞲-𐞺𐠀-𐠅𐠈𐠊-𐠵𐠷-𐠸𐠼𐠿-𐡕𐡘-𐡶𐡹-𐢞𐢧-𐢯𐣠-𐣲𐣴-𐣵𐣻-𐤛𐤠-𐤹𐥀-𐥙𐦀-𐦷𐦼-𐧏𐧒-𐨀𐨐-𐨓𐨕-𐨗𐨙-𐨵𐩀-𐩈𐩠-𐩾𐪀-𐪟𐫀-𐫇𐫉-𐫤𐫫-𐫯𐬀-𐬵𐭀-𐭕𐭘-𐭲𐭸-𐮑𐮩-𐮯𐰀-𐱈𐲀-𐲲𐳀-𐳲𐳺-𐴣𐴰-𐴹𐵀-𐵥𐵯-𐶅𐹠-𐹾𐺀-𐺩𐺰-𐺱𐻂-𐻇𐼀-𐼧𐼰-𐽅𐽑-𐽔𐽰-𐾁𐾰-𐿋𐿠-𐿶𑀃-𑀷𑁒-𑁯𑁱-𑁲𑁵𑂃-𑂯𑃐-𑃨𑃰-𑃹𑄃-𑄦𑄶-𑄿𑅄𑅇𑅐-𑅲𑅶𑆃-𑆲𑇁-𑇄𑇐-𑇚𑇜𑇡-𑇴𑈀-𑈑𑈓-𑈫𑈿-𑉀𑊀-𑊆𑊈𑊊-𑊍𑊏-𑊝𑊟-𑊨𑊰-𑋞𑋰-𑋹𑌅-𑌌𑌏-𑌐𑌓-𑌨𑌪-𑌰𑌲-𑌳𑌵-𑌹𑌽𑍐𑍝-𑍡𑎀-𑎉𑎋𑎎𑎐-𑎵𑎷𑏑𑏓𑐀-𑐴𑑇-𑑊𑑐-𑑙𑑟-𑑡𑒀-𑒯𑓄-𑓅𑓇𑓐-𑓙𑖀-𑖮𑗘-𑗛𑘀-𑘯𑙄𑙐-𑙙𑚀-𑚪𑚸𑛀-𑛉𑛐-𑛣𑜀-𑜚𑜰-𑜻𑝀-𑝆𑠀-𑠫𑢠-𑣲𑣿-𑤆𑤉𑤌-𑤓𑤕-𑤖𑤘-𑤯𑤿𑥁𑥐-𑥙𑦠-𑦧𑦪-𑧐𑧡𑧣𑨀𑨋-𑨲𑨺𑩐𑩜-𑪉𑪝𑪰-𑫸𑯀-𑯠𑯰-𑯹𑰀-𑰈𑰊-𑰮𑱀𑱐-𑱬𑱲-𑲏𑴀-𑴆𑴈-𑴉𑴋-𑴰𑵆𑵐-𑵙𑵠-𑵥𑵧-𑵨𑵪-𑶉𑶘𑶠-𑶩𑶰-𑷛𑷠-𑷩𑻠-𑻲𑼂𑼄-𑼐𑼒-𑼳𑽐-𑽙𑾰𑿀-𑿔𒀀-𒎙𒐀-𒑮𒒀-𒕃𒾐-𒿰𓀀-𓐯𓑁-𓑆𓑠-𔏺𔐀-𔙆𖄀-𖄝𖄰-𖄹𖠀-𖨸𖩀-𖩞𖩠-𖩩𖩰-𖪾𖫀-𖫉𖫐-𖫭𖬀-𖬯𖭀-𖭃𖭐-𖭙𖭛-𖭡𖭣-𖭷𖭽-𖮏𖵀-𖵬𖵰-𖵹𖹀-𖺖𖺠-𖺸𖺻-𖻓𖼀-𖽊𖽐𖾓-𖾟𖿠-𖿡𖿣𖿲-𖿶𗀀-𘳕𘳿-𘴞𘶀-𘷲𚿰-𚿳𚿵-𚿻𚿽-𚿾𛀀-𛄢𛄲𛅐-𛅒𛅕𛅤-𛅧𛅰-𛋻𛰀-𛱪𛱰-𛱼𛲀-𛲈𛲐-𛲙𜳰-𜳹𝋀-𝋓𝋠-𝋳𝍠-𝍸𝐀-𝑔𝑖-𝒜𝒞-𝒟𝒢𝒥-𝒦𝒩-𝒬𝒮-𝒹𝒻𝒽-𝓃𝓅-𝔅𝔇-𝔊𝔍-𝔔𝔖-𝔜𝔞-𝔹𝔻-𝔾𝕀-𝕄𝕆𝕊-𝕐𝕒-𝚥𝚨-𝛀𝛂-𝛚𝛜-𝛺𝛼-𝜔𝜖-𝜴𝜶-𝝎𝝐-𝝮𝝰-𝞈𝞊-𝞨𝞪-𝟂𝟄-𝟋𝟎-𝟿𝼀-𝼞𝼥-𝼪𞀰-𞁭𞄀-𞄬𞄷-𞄽𞅀-𞅉𞅎𞊐-𞊭𞋀-𞋫𞋰-𞋹𞓐-𞓫𞓰-𞓹𞗐-𞗭𞗰-𞗺𞛀-𞛞𞛠-𞛢𞛤-𞛥𞛧-𞛭𞛰-𞛴𞛾-𞛿𞟠-𞟦𞟨-𞟫𞟭-𞟮𞟰-𞟾𞠀-𞣄𞣇-𞣏𞤀-𞥃𞥋𞥐-𞥙𞱱-𞲫𞲭-𞲯𞲱-𞲴𞴁-𞴭𞴯-𞴽𞸀-𞸃𞸅-𞸟𞸡-𞸢𞸤𞸧𞸩-𞸲𞸴-𞸷𞸹𞸻𞹂𞹇𞹉𞹋𞹍-𞹏𞹑-𞹒𞹔𞹗𞹙𞹛𞹝𞹟𞹡-𞹢𞹤𞹧-𞹪𞹬-𞹲𞹴-𞹷𞹹-𞹼𞹾𞺀-𞺉𞺋-𞺛𞺡-𞺣𞺥-𞺩𞺫-𞺻🄀-🄌🯰-🯹𠀀-𪛟𪜀-𫠝𫠠-𬺭𬺰-𮯠𮯰-𮹝丽-𪘀𰀀-𱍊𱍐-𳑹-])';
$$;
create or replace function public.l5_index_line(v jsonb,minimum integer,maximum integer,address_allowed boolean default false) returns boolean
language plpgsql immutable set search_path='' as $$
declare s text;begin
 if jsonb_typeof(v) is distinct from 'string' then return false;end if;s:=v#>>'{}';
 return length(s) between minimum and maximum and s !~ '[--­؀-؅؜۝܏࢐-࢑࣢᠎​-‏ -‮⁠-⁤⁦-⁯﻿￹-￻𑂽𑃍𓐰-𓐿𛲠-𛲣𝅳-𝅺󠀁󠀠-󠁿]'
 and s=btrim(s,U&'\0009\000a\000b\000c\000d\0020\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff') and position('  ' in s)=0
 and (address_allowed or not public.l5_index_address(s));
end $$;

create or replace function public.l5_validate_capture(c jsonb) returns void language plpgsql immutable set search_path='' as $$
declare p jsonb;z jsonb;i integer:=0;k text;begin
 if not public.l5_index_keys(c,array['format','session_id','source_state_revision','selected_page_ids','pages'],array['format','session_id','source_state_revision','selected_page_ids','pages'])
 or c->'format' is distinct from '2'::jsonb or not public.l5_id(c->'session_id')
 or not(c->'source_state_revision'='null'::jsonb or public.l5_id(c->'source_state_revision'))
 or not public.l5_ids(c->'selected_page_ids') or jsonb_typeof(c->'pages') is distinct from 'array' then perform public.l5_fail('invalid_shape');end if;
 if jsonb_array_length(c->'selected_page_ids')>1000 or jsonb_array_length(c->'pages')<>jsonb_array_length(c->'selected_page_ids') then perform public.l5_fail('invalid_shape');end if;
 for p in select value from jsonb_array_elements(c->'pages') loop
  if not public.l5_index_keys(p,array['id','identity_sha256','annotation_sha256','preparation_version','zone','sent_image_sha256'],array['id','identity_sha256','annotation_sha256','preparation_version','zone','sent_image_sha256'])
  or p->'id' is distinct from c->'selected_page_ids'->i or not public.l5_index_hash(p->'identity_sha256') or not public.l5_index_hash(p->'annotation_sha256')
  or not public.l5_index_hash(p->'sent_image_sha256') or not public.l5_id(p->'preparation_version') then perform public.l5_fail('invalid_shape');end if;
  z:=p->'zone';
  if not public.l5_index_keys(z,array['kind','x','y','width','height','source_width','source_height'],array['kind','x','y','width','height','source_width','source_height'])
  or coalesce(z->>'kind','') not in ('full','left_half','right_half') then perform public.l5_fail('invalid_shape');end if;
  foreach k in array array['x','y','width','height','source_width','source_height'] loop
   if not public.l5_index_int(z->k,0,100000) then perform public.l5_fail('invalid_shape');end if;
  end loop;
  if (z->>'width')::integer=0 or (z->>'height')::integer=0 or (z->>'x')::integer+(z->>'width')::integer>(z->>'source_width')::integer
  or (z->>'y')::integer+(z->>'height')::integer>(z->>'source_height')::integer
  or z->>'kind'='full' and ((z->>'x')::integer<>0 or (z->>'y')::integer<>0 or z->'width'<>z->'source_width' or z->'height'<>z->'source_height') then perform public.l5_fail('invalid_shape');end if;
  i:=i+1;
 end loop;
 perform public.l5_canonical(c);
end $$;

create or replace function public.l5_check_capture(capture jsonb,require_active boolean default true) returns void language plpgsql stable set search_path='' as $$
declare s jsonb;r jsonb;p jsonb;begin
 perform public.l5_validate_capture(capture);
 if require_active is null then perform public.l5_fail('invalid_shape');end if;
 s:=public.l5_get('scan_sessions',capture->>'session_id');
 if s is null or s->>'deleted_at' is not null then perform public.l5_fail('source_changed');end if;s:=s->'data';
 if require_active and (s->'source_state'->>'revision' is distinct from capture->>'source_state_revision'
 or not(public.l5_active(s) @> (capture->'selected_page_ids'))) then perform public.l5_fail('source_changed');end if;
 if not(coalesce(s->'page_ids','[]') @> (capture->'selected_page_ids')) then perform public.l5_fail('source_changed');end if;
 for p in select value from jsonb_array_elements(capture->'pages') loop
  r:=public.l5_get('source_pages',p->>'id');
  if r is null or r->>'deleted_at' is not null or r->'data'->>'edition_id' is distinct from s->>'edition_id' then perform public.l5_fail('source_changed');end if;
  if public.l5_sha256(public.l5_project_page(r->'data')) is distinct from p->>'identity_sha256'
  or require_active and public.l5_sha256(public.l5_project_annotation(r->'data')) is distinct from p->>'annotation_sha256' then perform public.l5_fail('source_changed');end if;
 end loop;
end $$;

create or replace function public.l5_index_logical(result jsonb,page_id text) returns jsonb language plpgsql immutable set search_path='' as $$
declare p jsonb;e jsonb;x jsonb;k text;suite boolean:=false;begin
 if not public.l5_index_keys(result,array['format','pages'],array['format','pages']) or result->'format' is distinct from '2'::jsonb
 or jsonb_typeof(result->'pages') is distinct from 'array' then perform public.l5_fail('invalid_shape');end if;
 if jsonb_array_length(result->'pages')<>1 then perform public.l5_fail('invalid_shape');end if;p:=result->'pages'->0;
 if not public.l5_index_keys(p,array['page_id','etat','moities','moitiesCoupees','modele','sorte_page','page_imprimee','suite_rubrique','entrees','incertain','ecartees','raison'],array['page_id','etat','entrees','incertain'])
 or p->'page_id' is distinct from to_jsonb(page_id) or coalesce(p->>'etat','') not in ('lue','partielle','echec')
 or jsonb_typeof(p->'entrees') is distinct from 'array' or jsonb_typeof(p->'incertain') is distinct from 'array' then perform public.l5_fail('invalid_shape');end if;
 if jsonb_array_length(p->'entrees')>600 or jsonb_array_length(p->'incertain')>20 then perform public.l5_fail('invalid_shape');end if;
 if p->>'modele' is not null and (jsonb_typeof(p->'modele')<>'string' or length(p->>'modele')>80)
 or p->>'raison' is not null and (jsonb_typeof(p->'raison')<>'string' or length(p->>'raison')>40)
 or p->>'moities' is not null and p->'moities' not in ('0'::jsonb,'2'::jsonb)
 or p->>'sorte_page' is not null and (jsonb_typeof(p->'sorte_page')<>'string' or p->>'sorte_page' not in ('table','index','chapitres','autre'))
 or p->>'page_imprimee' is not null and not public.l5_index_int(p->'page_imprimee',1,9999) then perform public.l5_fail('invalid_shape');end if;
 if p->>'moitiesCoupees' is not null then
  if jsonb_typeof(p->'moitiesCoupees')<>'array' then perform public.l5_fail('invalid_shape');end if;
  if jsonb_array_length(p->'moitiesCoupees')>2 or exists(select 1 from jsonb_array_elements(p->'moitiesCoupees') v where v not in ('"gauche"'::jsonb,'"droite"'::jsonb)) then perform public.l5_fail('invalid_shape');end if;
 end if;
 for e in select value from jsonb_array_elements(p->'entrees') loop
  if not public.l5_index_keys(e,array['titre','renvois','rubrique','sorte','incertain','suite'],array['titre','renvois','rubrique','sorte','incertain'])
  or not public.l5_index_line(e->'titre',1,200) or not public.l5_index_line(e->'renvois',0,80,true)
  or not(e->'rubrique'='null'::jsonb or public.l5_index_line(e->'rubrique',1,120))
  or e->'sorte' not in ('"recette"'::jsonb,'"autre"'::jsonb) or jsonb_typeof(e->'incertain') is distinct from 'boolean'
  or e?'suite' and (e->'suite' is distinct from 'true'::jsonb or e->'rubrique' is distinct from 'null'::jsonb)
  or not(e?'suite') and e->>'rubrique'='^' then perform public.l5_fail('invalid_shape');end if;
  suite:=suite or e->'suite'='true'::jsonb;
 end loop;
 if p->>'suite_rubrique' is not null and p->'suite_rubrique' is distinct from to_jsonb(coalesce(suite,false)) then perform public.l5_fail('invalid_shape');end if;
 for x in select value from jsonb_array_elements(p->'incertain') loop if not public.l5_index_line(x,1,200) then perform public.l5_fail('invalid_shape');end if;end loop;
 if p->>'ecartees' is not null then
  if not public.l5_index_keys(p->'ecartees',array['adresse','longueur','forme'],array['adresse','longueur','forme']) then perform public.l5_fail('invalid_shape');end if;
  foreach k in array array['adresse','longueur','forme'] loop if not public.l5_index_int(p->'ecartees'->k,0,600) then perform public.l5_fail('invalid_shape');end if;end loop;
 end if;
 if octet_length(public.l5_canonical(result))>4194304 then perform public.l5_fail('too_large');end if;
 return result;
end $$;

create or replace function public.l5_index_result(journal jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare m jsonb:=journal->'index_storage';f jsonb;r jsonb;s jsonb;call jsonb:=journal->'index_call';page text;series text;piece text;joined text:='';i integer:=0;ids text[]:='{}';result jsonb;
 memory constant text[]:=array['kind','recipe_id','edition_id','scan_session_id','page_ids','owner_id','expected_edition_id','expected_edition_cycle_id','expected_cycle_id','source_capture','index_call'];
begin
 if jsonb_typeof(journal) is distinct from 'object' or journal->>'kind' is distinct from 'index' or not public.l5_id(journal->'id') then perform public.l5_fail('invalid_shape');end if;
 if octet_length(journal::text)>524288 then perform public.l5_fail('too_large');end if;
 if journal->>'source_capture' is not null then perform public.l5_validate_capture(journal->'source_capture');end if;
 if journal->>'index_call' is not null then
  if not public.l5_index_keys(call,array['format','series_id','page_id','kind','parent_call_id'],array['format','series_id','page_id','kind','parent_call_id'])
  or call->'format' is distinct from '1'::jsonb or not public.l5_id(call->'series_id') or not public.l5_id(call->'page_id') or coalesce(call->>'kind','') not in ('full','left_half','right_half')
  or call->>'kind'='full' and call->'parent_call_id' is distinct from 'null'::jsonb
  or call->>'kind'<>'full' and not public.l5_id(call->'parent_call_id') then perform public.l5_fail('invalid_shape');end if;
  if journal->'source_capture'->'selected_page_ids' is distinct from jsonb_build_array(call->'page_id')
  or journal->'source_capture'->'session_id' is distinct from journal->'scan_session_id'
  or journal->'source_capture'->'pages'->0->'zone'->'kind' is distinct from call->'kind' then perform public.l5_fail('invalid_shape');end if;
  page:=call->>'page_id';series:=call->>'series_id';
 else
  if jsonb_typeof(journal->'page_ids') is distinct from 'array' then perform public.l5_fail('invalid_shape');end if;
  if jsonb_array_length(journal->'page_ids')<>1 or not public.l5_id(journal->'page_ids'->0) then perform public.l5_fail('invalid_shape');end if;
  page:=journal->'page_ids'->>0;series:=journal->>'id';
 end if;
 if journal->>'index_storage' is null then
  if journal->'resultat'='null'::jsonb and call->>'kind'='full' and journal->'erreur'->>'raison'='coupe' and journal->>'status' in ('echec','enregistre') then return 'null'::jsonb;end if;
  return public.l5_index_logical(journal->'resultat',page);
 end if;
 if journal->'resultat' is distinct from 'null'::jsonb
 or not public.l5_index_keys(m,array['format','role','series_id','page_id','capture_sha256','logical_result_sha256','logical_bytes','fragments'],array['format','role','series_id','page_id','capture_sha256','logical_result_sha256','logical_bytes','fragments'])
 or m->'format' is distinct from '1'::jsonb or m->>'role' is distinct from 'page_manifest' or m->>'series_id' is distinct from series or m->>'page_id' is distinct from page
 or not public.l5_index_hash(m->'capture_sha256') or not public.l5_index_hash(m->'logical_result_sha256') or not public.l5_index_int(m->'logical_bytes',1,4194304)
 or jsonb_typeof(m->'fragments') is distinct from 'array' then perform public.l5_fail('invalid_shape');end if;
 if jsonb_array_length(m->'fragments') not between 1 and 64 then perform public.l5_fail('invalid_shape');end if;
 if public.l5_sha256(coalesce(journal->'source_capture','null')) is distinct from m->>'capture_sha256' then perform public.l5_fail('source_changed');end if;
 for f in select value from jsonb_array_elements(m->'fragments') loop
  if not public.l5_index_keys(f,array['id','ordinal','sha256','utf8_bytes'],array['id','ordinal','sha256','utf8_bytes']) or not public.l5_id(f->'id')
  or f->>'id'=journal->>'id' or f->>'id'=any(ids) or f->'ordinal' is distinct from to_jsonb(i) or not public.l5_index_hash(f->'sha256')
  or not public.l5_index_int(f->'utf8_bytes',1,262144) then perform public.l5_fail('invalid_shape');end if;
  ids:=array_append(ids,f->>'id');r:=public.l5_get('imports',f->>'id');
  if r is null or r->>'deleted_at' is not null then perform public.l5_fail('result_incomplete');end if;r:=r->'data';s:=r->'index_storage';
  if r->>'kind' is distinct from 'index' or r->>'status' is distinct from 'enregistre' or r->'resultat' is distinct from 'null'::jsonb or r->'id' is distinct from f->'id'
  or not public.l5_index_keys(s,array['format','role','manifest_id','ordinal','sha256','utf8_bytes','text'],array['format','role','manifest_id','ordinal','sha256','utf8_bytes','text'])
  or s->'format' is distinct from '1'::jsonb or s->>'role' is distinct from 'result_fragment' or s->'manifest_id' is distinct from journal->'id'
  or s->'ordinal' is distinct from f->'ordinal' or s->'sha256' is distinct from f->'sha256' or s->'utf8_bytes' is distinct from f->'utf8_bytes'
  or jsonb_typeof(s->'text') is distinct from 'string' or octet_length(r::text)>262144
  or public.l5_project_fields(r,'index-fragment-context-v1',memory) is distinct from public.l5_project_fields(journal,'index-fragment-context-v1',memory) then perform public.l5_fail('invalid_shape');end if;
  piece:=s->>'text';
  if octet_length(piece)<>(s->>'utf8_bytes')::integer or encode(pg_catalog.sha256(convert_to(piece,'UTF8')),'hex')<>s->>'sha256' then perform public.l5_fail('result_changed');end if;
  joined:=joined||piece;if octet_length(joined)>4194304 then perform public.l5_fail('too_large');end if;i:=i+1;
 end loop;
 if octet_length(joined)<>(m->>'logical_bytes')::integer or encode(pg_catalog.sha256(convert_to(joined,'UTF8')),'hex')<>m->>'logical_result_sha256' then perform public.l5_fail('result_changed');end if;
 result:=joined::jsonb;
 if public.l5_canonical(result)<>joined then perform public.l5_fail('result_changed');end if;
 return public.l5_index_logical(result,page);
end $$;


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


create or replace function public.l5_apply_source_command(c jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;server jsonb;motif text;begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 begin
  if jsonb_typeof(c) is distinct from 'object' or c->'protocol'<>'1'::jsonb or not public.l5_id(c->'id') or not public.l5_id(c->'operation_id') or not(c?'edition_id' and c?'base_edition_cycle_id') or not(c->'edition_id'='null'::jsonb or public.l5_id(c->'edition_id')) or not(c->'base_edition_cycle_id'='null'::jsonb or public.l5_id(c->'base_edition_cycle_id')) or c->'edition_id'='null'::jsonb and c->'base_edition_cycle_id'<>'null'::jsonb or c->>'payload_sha256' !~ '^[a-f0-9]{64}$' or public.l5_sha256(c-'payload_sha256') is distinct from c->>'payload_sha256' then perform public.l5_fail('invalid_shape');end if;
  if octet_length(c::text)>786432 or octet_length(jsonb_build_object('rows',jsonb_build_array(c))::text)>921600 then perform public.l5_fail('too_large');end if;
  if c->>'op'='source_revision' then result:=public.l5_revision(c);
  elsif c->>'op'='index_apply' then result:=public.l5_index_apply(c);
  elsif c->>'op'='source_transfer' then result:=public.l5_transfer(c);
  else perform public.l5_fail('capability_missing');end if;
  return jsonb_build_object('accepted',jsonb_build_array(result),'adjusted','[]'::jsonb,'rejected','[]'::jsonb,'server_time',clock_timestamp());
 exception when check_violation or data_exception then
  motif:=sqlerrm;if motif not in ('source_changed','session_changed','edition_cycle','owner_changed','result_changed','index_changed','id_collision','invalid_shape','too_large','capability_missing','transfer_expired','transfer_changed') then motif:='invalid_shape';end if;
  if c->>'store' in ('source_documents','source_pages','scan_sessions','imports','recipes') then server:=public.l5_get(c->>'store',c->>'id');end if;
  return jsonb_build_object('accepted','[]'::jsonb,'adjusted','[]'::jsonb,'rejected',jsonb_build_array(jsonb_build_object('store',c->>'store','id',c->>'id','operation_id',c->>'operation_id','payload_sha256',c->>'payload_sha256','reason',motif,'server',server)),'server_time',clock_timestamp());
 end;
end $$;
create or replace function public.l2_guard_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;d jsonb;before_data jsonb;ids text[];eid text;ed jsonb;ed_deleted timestamptz;ec jsonb;rc jsonb;rid text;recipe jsonb;
 lifecycle boolean;archive_insert boolean;historical boolean;can_complete boolean;source_group jsonb;
begin
 if tg_table_name in ('source_documents','source_pages','scan_sessions','imports') and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l5_apply_source_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if current_setting('app.l1_purge_all',true)='on' then if tg_op='DELETE' then return old;else return new;end if;end if;
 ctx:=coalesce(nullif(current_setting('app.l1_write',true),''),'{}')::jsonb;
 source_group:=coalesce(nullif(current_setting('app.l2_sources',true),''),'{}')::jsonb;
 d:=case when tg_op='DELETE' then old.data else new.data end;before_data:=case when tg_op='INSERT' then null else old.data end;
 lifecycle:=coalesce(ctx->>'op'='lifecycle' and ctx->>'id'=d->>'id',false);
 archive_insert:=tg_op='INSERT' and coalesce(ctx->>'archive_import'='true',false);
 if tg_op='UPDATE' and (
  (tg_table_name='source_documents' and (d->>'edition_id' is distinct from before_data->>'edition_id' or d->>'scan_session_id' is distinct from before_data->>'scan_session_id')) or
  (tg_table_name='source_pages' and (d->>'edition_id' is distinct from before_data->>'edition_id' or d->>'document_id' is distinct from before_data->>'document_id')) or
  (tg_table_name='scan_sessions' and d->>'edition_id' is distinct from before_data->>'edition_id')) then raise check_violation using message='cycle';end if;
 ids:=public.l2_edition_ids(tg_table_name,d)||public.l2_edition_ids(tg_table_name,before_data);
 if tg_table_name='books' and (tg_op='DELETE' or new.deleted_at is not null) and exists(select 1 from unnest(ids) x where x is not null) then raise check_violation using message='cycle';end if;
 if tg_table_name='books' and tg_op<>'DELETE' and new.deleted_at is null then
  if not exists(select 1 from unnest(ids) x where x is not null) then return new;end if;
  if exists(select 1 from public.book_editions e where e.owner_id=auth.uid() and e.id=any(ids) and e.deleted_at is null and public.l2_valid_edition(e.data) and e.data->>'trashed_at' is null and
   (e.data->>'lifecycle_id' is null or exists(select 1 from jsonb_array_elements(coalesce(ctx->'edition_contexts','[]')) x where x->>'edition_id'=e.id and x->>'expected_cycle_id' is not distinct from e.data->>'lifecycle_id'))) then return new;end if;
  raise check_violation using message='cycle';
 end if;
 if tg_table_name='book_editions' then
  if tg_op='DELETE' or new.deleted_at is not null or (tg_op='UPDATE' and old.deleted_at is not null) then raise check_violation using message='cycle';end if;
  if not public.l2_valid_edition(d) then raise check_violation using message='cycle';end if;
  if (d->>'lifecycle_id' is distinct from before_data->>'lifecycle_id' or d->>'trashed_at' is distinct from before_data->>'trashed_at' or d->>'trash_mode' is distinct from before_data->>'trash_mode') and not(lifecycle or archive_insert) then raise check_violation using message='cycle';end if;
 end if;
 if tg_table_name='recipes' then
  if not coalesce(public.l2_valid_exception(d),false) then raise check_violation using message='cycle';end if;
  if not(lifecycle or archive_insert) then
   if tg_op='INSERT' and d->>'restored_from_edition' is not null then raise check_violation using message='cycle';end if;
   if tg_op='UPDATE' then
    if d->>'edition_id' is distinct from before_data->>'edition_id' then new.data:=new.data||jsonb_build_object('restored_from_edition',null);
    elsif before_data?'restored_from_edition' then new.data:=new.data||jsonb_build_object('restored_from_edition',before_data->'restored_from_edition');
    else new.data:=new.data-'restored_from_edition';end if;
    d:=new.data;
   end if;
  end if;
 end if;
 for eid in select distinct x from unnest(ids) x where x is not null order by x loop
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':edition:'||eid,0));
  select data,deleted_at into ed,ed_deleted from public.book_editions where owner_id=auth.uid() and id=eid;
  if tg_table_name='book_editions' then ed:=before_data;ed_deleted:=case when tg_op='INSERT' then null else old.deleted_at end;end if;
  if ed->>'lifecycle_id' is not null and tg_table_name in ('recipes','recipe_versions','recipe_translations','substitutions','dish_recipe_links','source_documents','source_pages','scan_sessions')
   and (tg_op='DELETE' or new.deleted_at is not null or (tg_op='UPDATE' and old.deleted_at is not null)) then raise check_violation using message='cycle';end if;
  if lifecycle then continue;end if;
  if tg_table_name='book_editions' and archive_insert then continue;end if;
  if ed is null and tg_table_name<>'book_editions' then raise check_violation using message='cycle';end if;
  if ed_deleted is not null or (ed is not null and not public.l2_valid_edition(ed)) then raise check_violation using message='cycle';end if;
  select x into ec from jsonb_array_elements(coalesce(ctx->'edition_contexts','[]')) x where x->>'edition_id'=eid;
  historical:=coalesce(ec->>'historique'='true',false);
  if historical and tg_op='UPDATE' and tg_table_name in ('meals','shopping_lists','cook_sessions','inventory') and public.l1_recipe_refs(d)=public.l1_recipe_refs(before_data) then continue;end if;
  if historical and tg_op='DELETE' and tg_table_name='inventory' then continue;end if;
  if tg_op='UPDATE' and tg_table_name='scan_sessions' and d->>'edition_id' is not distinct from before_data->>'edition_id' and d->'page_ids' is not distinct from before_data->'page_ids' and d->'recipe_ids' is not distinct from before_data->'recipe_ids' and d->'document_ids' is not distinct from before_data->'document_ids' then continue;end if;
  if ed->>'lifecycle_id' is not null and (ec is null or ec->>'expected_cycle_id' is distinct from ed->>'lifecycle_id') then raise check_violation using message='cycle';end if;
  if ec is not null and ec->>'expected_cycle_id' is distinct from ed->>'lifecycle_id' and not(tg_table_name='book_editions' and archive_insert) then raise check_violation using message='cycle';end if;
  if archive_insert then continue;end if;
  if tg_op<>'DELETE' and tg_table_name in ('scan_sessions','source_documents','source_pages') and source_group->>'edition_id'=eid and exists(select 1 from jsonb_array_elements(coalesce(source_group->'rows','[]')) x where x->>'store'=tg_table_name and x->>'id'=d->>'id') then continue;end if;
  if tg_table_name='recipes' then
   if ctx->>'recipe_id'=d->>'id' then rc:=ctx;else select x into rc from jsonb_array_elements(coalesce(ctx->'recipe_contexts','[]')) x where x->>'recipe_id'=d->>'id';end if;
   if ed->>'lifecycle_id' is not null and tg_op='UPDATE' and (not coalesce(rc?'expected_edition_id',false) or rc->>'expected_edition_id' is distinct from before_data->>'edition_id') then raise check_violation using message='cycle';end if;
   if tg_op='UPDATE' and d->>'edition_id' is distinct from before_data->>'edition_id' then
    if eid=before_data->>'edition_id' and not public.l2_recipe_active(before_data,ed) then raise check_violation using message='cycle';end if;
    if eid=d->>'edition_id' and ed->>'trashed_at' is not null then raise check_violation using message='cycle';end if;
   elsif ed->>'trashed_at' is not null and (tg_op='INSERT' or not public.l2_recipe_active(d,ed)) then raise check_violation using message='cycle';end if;
  elsif tg_table_name in ('recipe_versions','recipe_translations','substitutions','dish_recipe_links','meals','shopping_lists','cook_sessions','inventory') then
   for rid in select distinct x from unnest(public.l1_recipe_ids(tg_table_name,d)||public.l1_recipe_ids(tg_table_name,before_data)) x where x is not null loop
    select data into recipe from public.recipes where owner_id=auth.uid() and id=rid;
    if recipe->>'edition_id'=eid and not public.l2_recipe_active(recipe,ed) then raise check_violation using message='cycle';end if;
   end loop;
  elsif ed->>'trashed_at' is not null then
   can_complete:=false; -- le complément exige le groupe atomique vérifié ci-dessus
   if not can_complete then raise check_violation using message='cycle';end if;
  end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

-- Cette validation élevée ne fait que lire le graphe du propriétaire authentifié.
create or replace function public.l5_guard_validate_initial_index(d jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare c jsonb:=d->'index_call';begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();
 if octet_length(d::text)>524288 then perform public.l5_fail('too_large');end if;
 if d->>'kind' is distinct from 'index' or d->>'recipe_id' is not null or d->>'owner_id' is distinct from auth.uid()::text
 or coalesce(d->>'status','') not in ('a_lancer','en_cours','a_verifier','echec','ignore') then perform public.l5_fail('invalid_shape');end if;
 if d->>'expected_edition_id' is distinct from d->>'edition_id' or d->>'expected_cycle_id' is not null then perform public.l5_fail('invalid_shape');end if;
 perform public.l5_cycle(d->>'edition_id',d->>'expected_edition_cycle_id',true);
 perform public.l5_check_capture(d->'source_capture',false);
 if not public.l5_index_keys(c,array['format','series_id','page_id','kind','parent_call_id'],array['format','series_id','page_id','kind','parent_call_id'])
 or c->'format' is distinct from '1'::jsonb or not public.l5_id(c->'series_id') or not public.l5_id(c->'page_id')
 or coalesce(c->>'kind','') not in ('full','left_half','right_half')
 or c->>'kind'='full' and c->'parent_call_id' is distinct from 'null'::jsonb
 or c->>'kind'<>'full' and not public.l5_id(c->'parent_call_id')
 or d->'page_ids' is distinct from jsonb_build_array(c->'page_id')
 or d->'source_capture'->'selected_page_ids' is distinct from d->'page_ids'
 or d->'source_capture'->'session_id' is distinct from d->'scan_session_id'
 or d->'source_capture'->'pages'->0->'zone'->'kind' is distinct from c->'kind'
 or (public.l5_get('scan_sessions',d->>'scan_session_id')->'data'->>'edition_id') is distinct from d->>'edition_id' then perform public.l5_fail('invalid_shape');end if;
 if d->>'resultat' is not null or d->>'status'='a_verifier' then perform public.l5_index_result(d);end if;
end $$;

create or replace function public.l5_guard_write() returns trigger language plpgsql security invoker set search_path='' as $$
declare before_data jsonb;d jsonb;k text;managed boolean;initial_index boolean;begin
 perform public.l2_lock_owner();
 -- Le rôle du helper est inaccessible aux clients ; aucun GUC ne peut créer cette autorité.
 if current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.l5_apply_source_command(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;
 before_data:=case when tg_op='INSERT' then '{}'::jsonb else old.data end;d:=case when tg_op='DELETE' then '{}'::jsonb else new.data end;
 if public.l5_pending_source(tg_table_name,coalesce(before_data->>'id',d->>'id')) then raise check_violation using message='source_reserved';end if;
 if tg_table_name='recipes' then
  managed:=exists(select 1 from public.imports i left join public.scan_sessions s on s.owner_id=i.owner_id and s.id=i.data->>'scan_session_id'
   where i.owner_id=auth.uid() and i.id in (before_data->>'index_import_id',d->>'index_import_id') and i.data->>'kind'='index'
   and (i.data?'source_capture' or i.data?'index_storage' or s.data?'source_state'))
   or exists(select 1 from public.source_pages p where p.owner_id=auth.uid() and p.id in (before_data->>'index_page_id',d->>'index_page_id')
    and (p.data?'source_revision' or p.data?'source_copy' or exists(select 1 from public.scan_sessions s where s.owner_id=p.owner_id and s.data?'source_state' and coalesce(s.data->'page_ids','[]')?p.id)));
  if managed and tg_op='INSERT' then raise check_violation using message='source_reserved';end if;
  if managed and tg_op='UPDATE' then
   foreach k in array array['index_rubriques','printed_pages','index_import_id','index_page_id'] loop
    if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;
   end loop;
   -- La complétion conserve l’origine d’index et utilise les photos de la recette extraite.
   if (d->>'availability'='reference_only' or d->>'current_version_id' is null) and before_data->'source_page_ids' is distinct from d->'source_page_ids' then raise check_violation using message='source_reserved';end if;
  end if;
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 managed:=(before_data?'source_revision' or before_data?'source_state' or before_data?'source_copy' or before_data?'index_storage' or before_data?'source_capture' or before_data?'index_call');
 if tg_table_name='source_pages' and exists(select 1 from public.scan_sessions s where s.owner_id=auth.uid() and s.deleted_at is null and s.data?'source_state' and coalesce(s.data->'page_ids','[]')?(before_data->>'id')) then managed:=true;end if;
 if tg_table_name='source_documents' and exists(select 1 from public.scan_sessions s where s.owner_id=auth.uid() and s.deleted_at is null and s.data?'source_state' and coalesce(s.data->'document_ids','[]')?(before_data->>'id')) then managed:=true;end if;
 if managed and (tg_op='DELETE' or new.deleted_at is not null) then raise check_violation using message='source_reserved';end if;
 if tg_op='UPDATE' and tg_table_name='source_pages' and public.l5_project_page(before_data) is distinct from public.l5_project_page(d) then raise check_violation using message='source_reserved';end if;
 if tg_op='UPDATE' and tg_table_name='source_documents' and public.l5_project_document(before_data) is distinct from public.l5_project_document(d) then raise check_violation using message='source_reserved';end if;
 initial_index:=tg_table_name='imports' and tg_op='INSERT' and (d?'source_capture' or d?'index_call');
 for k in select unnest(case when tg_table_name='imports' then array['source_capture','index_call','index_storage','index_decision_revision','index_decisions','index_application_receipts','index_resolved_occurrences'] when tg_table_name='scan_sessions' then array['source_state','source_receipts','source_copy'] else array['source_revision','source_copy'] end) loop
  if initial_index and k in ('source_capture','index_call') then continue;end if;
  if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;
 end loop;
 if initial_index then perform public.l5_guard_validate_initial_index(d);end if;
 if tg_table_name='imports' and before_data?'source_capture' then
  foreach k in array array['id','kind','recipe_id','edition_id','scan_session_id','page_ids','owner_id','expected_edition_id','expected_edition_cycle_id','expected_cycle_id'] loop
   if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;
  end loop;
  if (d->>'status'='enregistre' or before_data->>'status'='enregistre') and before_data->'status' is distinct from d->'status' then raise check_violation using message='source_reserved';end if;
  if before_data->>'resultat' is not null or before_data->>'index_storage' is not null then
   foreach k in array array['resultat','model','started_at'] loop if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;end loop;
  elsif d->>'resultat' is not null then perform public.l5_guard_validate_initial_index(d);
  end if;
 end if;
 if tg_table_name='scan_sessions' and before_data?'source_state' then
  foreach k in array array['id','edition_id','page_ids','document_ids'] loop if before_data->k is distinct from d->k then raise check_violation using message='source_reserved';end if;end loop;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

-- Une purge volontaire reste possible, explicitement authentifiée et limitée à ce propriétaire.
-- Les anciens marqueurs L1 sont restaurés ; ils n'autorisent jamais seuls les écritures L5.
create or replace function public.sync_purge_all() returns integer
language plpgsql security definer set search_path='' as $$
declare s text;n integer:=0;k integer;before_purge text;before_l1 text;begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 perform public.l2_lock_owner();before_purge:=coalesce(current_setting('app.purge',true),'');before_l1:=coalesce(current_setting('app.l1_purge_all',true),'');
 perform set_config('app.purge','on',true);perform set_config('app.l1_purge_all','on',true);
 foreach s in array array['books','book_editions','source_documents','source_pages','scan_sessions','dishes','dish_recipe_links','recipes','recipe_versions','recipe_translations','ingredients','unit_definitions','unit_conventions','substitutions','appliances','cook_history','cook_sessions','inventory','meals','meal_feedback','shopping_lists','library_activity','rediscovery_prefs','timer_launches','files','assistant_config','imports'] loop
  execute format('delete from public.%I where owner_id=auth.uid()',s);get diagnostics k=row_count;n:=n+k;
 end loop;
 perform set_config('app.purge',before_purge,true);perform set_config('app.l1_purge_all',before_l1,true);return n;
end $$;
revoke all on function public.sync_purge_all() from public,anon;
grant execute on function public.sync_purge_all() to authenticated;

do $$declare s text;begin foreach s in array array['source_pages','source_documents','scan_sessions','imports','recipes'] loop execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.l5_guard_write()',s||'_l5_guard',s);end loop;end $$;
alter function public.sync_push_v2(jsonb) rename to l2_sync_push_v2;
create function public.sync_push_v2(rows jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'adresse non autorisée' using errcode='42501';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;
 perform public.l2_lock_owner();
 if exists(select 1 from jsonb_array_elements(rows) r where r->>'op' in ('source_revision','index_apply','source_transfer')) then
  if jsonb_array_length(rows)<>1 or octet_length(jsonb_build_object('rows',rows)::text)>921600 then raise exception 'rows : commande isolée requise';end if;
  return public.l5_apply_source_command(rows->0);
 end if;
 return public.l2_sync_push_v2(rows);
end $$;
create or replace function public.sync_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('recipe_lifecycle',1,'edition_lifecycle',1,'source_batches',1,'source_revisions',1);
$$;
-- Les helpers internes n’acceptent aucun appel client. Le seul helper exposé répète toutes les gardes de sa RPC.
do $$declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l5_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.signature);end loop;end $$;
grant execute on function public.l5_guard_validate_initial_index(jsonb),public.l5_apply_source_command(jsonb),public.l5_pending_source(text,text),public.source_transfer_status(text) to authenticated;
revoke all on function public.source_transfer_status(text),public.l5_cleanup_transfers() from public,anon;
revoke all on function public.l5_cleanup_transfers() from authenticated;
grant execute on function public.l5_cleanup_transfers() to service_role;
grant execute on function public.l5_project_page(jsonb), public.l5_project_document(jsonb), public.l5_project_fields(jsonb,text,text[]), public.l5_page_rotation(jsonb) to authenticated;
-- Les projections de trigger composent les helpers canon sans accéder aux données d’un compte.
grant execute on function public.sync_push_v2(jsonb),public.l2_sync_push_v2(jsonb),public.sync_capabilities() to authenticated;
