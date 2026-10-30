// Lecteur fermé des résultats payés : mêmes formes et bornes que index-stockage.js.
import { MOTIF_ADRESSE, MOTIF_HOTE } from '../src/core/bornes.js';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
function classeUnicode(motif){
  const ranges=[];let start=null,last=null;
  const flush=()=>{if(start!==null)ranges.push(String.fromCodePoint(start)+(last===start?'':'-'+String.fromCodePoint(last)));start=last=null;};
  for(let cp=1;cp<=0x10ffff;cp++){
    if(cp>=0xd800&&cp<=0xdfff){flush();continue;}
    if(motif.test(String.fromCodePoint(cp))){if(start===null)start=cp;last=cp;}else flush();
  }
  flush();return ranges.join('');
}
const lettresNombres=classeUnicode(/[\p{L}\p{N}]/u);
const invisibles='['+classeUnicode(/[\p{Cc}\p{Cf}\u2028\u2029]/u)+']';
const blancs=Array.from({length:0x10000},(_,cp)=>String.fromCodePoint(cp)).filter(c=>/\s/u.test(c)).join('');
const blancsSql="U&'"+[...blancs].map(c=>'\\'+c.codePointAt(0).toString(16).padStart(4,'0')).join('')+"'";
const adresse=MOTIF_ADRESSE.source.replaceAll('\\/','/');
const hote=MOTIF_HOTE.source.replaceAll('\\p{L}\\p{N}',lettresNombres);

export const sourcesIndexResultSql=String.raw`
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
 select translate(pg_catalog.normalize(v,'NFKC'),'。｡∕⁄','..//') ~* `+literal(adresse)+String.raw`
 or translate(pg_catalog.normalize(v,'NFKC'),'。｡∕⁄','..//') ~* `+literal(hote)+String.raw`;
$$;
create or replace function public.l5_index_line(v jsonb,minimum integer,maximum integer,address_allowed boolean default false) returns boolean
language plpgsql immutable set search_path='' as $$
declare s text;begin
 if jsonb_typeof(v) is distinct from 'string' then return false;end if;s:=v#>>'{}';
 return length(s) between minimum and maximum and s !~ `+literal(invisibles)+String.raw`
 and s=btrim(s,`+blancsSql+String.raw`) and position('  ' in s)=0
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
`;
