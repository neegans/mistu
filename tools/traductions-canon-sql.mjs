// L6 — projections exactes partagées avec la feuille JS. Réutilise la canonicité UTF-8 L5.
import {CHAMPS_SOURCE_TRADUCTION,CHAMPS_LECTURE_TRADUCTION} from '../src/domain/traductions-format.js';
const q=s=>"'"+s.replaceAll("'","''")+"'",array=xs=>'array['+xs.map(q).join(',')+']::text[]';
export const traductionsCanonSql=String.raw`
create or replace function public.l6_locale(value text) returns text language sql immutable set search_path='' as $$
 select case when value !~ '[^A-Za-z-]' and value ~ '^[A-Za-z]{2,3}(-[A-Za-z]{2})?$' then lower(split_part(value,'-',1))||case when position('-' in value)>0 then '-'||upper(split_part(value,'-',2)) else '' end else null end;
$$;
create or replace function public.l6_presence_path(row_data jsonb,path text) returns jsonb language sql immutable set search_path='' as $$
 select case when row_data #> string_to_array(path,'.') is null then jsonb_build_array(false) else jsonb_build_array(true,row_data #> string_to_array(path,'.')) end;
$$;
create or replace function public.l6_project_source(recipe jsonb,version jsonb,source_locale text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-source-v2','recipe_id',recipe->'id','recipe_version_id',version->'id','source_locale',source_locale,'fields',(select jsonb_agg(jsonb_build_array(k,public.l6_presence_path(version,k)) order by n) from unnest(${array(CHAMPS_SOURCE_TRADUCTION)}) with ordinality f(k,n)));
$$;
create or replace function public.l6_project_source(recipe jsonb,version jsonb) returns jsonb language sql immutable set search_path='' as $$
 select public.l6_project_source(recipe,version,public.l6_locale(recipe->>'original_language'));
$$;
create or replace function public.l6_project_title(recipe jsonb,version jsonb) returns jsonb language sql immutable set search_path='' as $$
 select public.l5_project_fields(recipe,'translation-title-v1',array['display_title','original_title'])||jsonb_build_object('recipe_id',recipe->'id','recipe_version_id',version->'id');
$$;
create or replace function public.l6_project_reading(journal jsonb) returns jsonb language sql immutable set search_path='' as $$
 select public.l5_project_fields(journal,'translation-reading-v1',${array(CHAMPS_LECTURE_TRADUCTION)});
$$;
create or replace function public.l6_project_resolution(journal jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-resolution-v1','revision',coalesce(journal->'translation_resolution_revision','null'::jsonb),'resolutions',coalesce((select jsonb_agg(x order by convert_to(x->>'ref','UTF8'),n) from jsonb_array_elements(coalesce(nullif(journal->'translation_resolutions','null'::jsonb),'[]'::jsonb)) with ordinality a(x,n)),'[]'::jsonb));
$$;
create or replace function public.l6_project_candidate(row_data jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-candidate-v1','data',row_data-array['created_at','updated_at','publication_receipts']);
$$;
create or replace function public.l6_project_seed(row_data jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('projection','translation-seed-v1','data',row_data-array['created_at','updated_at']);
$$;
create or replace function public.l6_segment_ref(version_id text,kind text,source_id text,field text) returns text language sql immutable set search_path='' as $$
 select 'ts_'||public.l5_sha256(jsonb_build_array('translation-ref-v1',version_id,kind,source_id,field));
$$;
create or replace function public.l6_source_segment(version_id text,kind text,source_id text,field text,source_text jsonb,source_locale text) returns jsonb language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(source_text) is distinct from 'string' then perform public.l5_fail('source_invalide');end if;
 return jsonb_build_object('ref',public.l6_segment_ref(version_id,kind,source_id,field),'kind',kind,'source_id',source_id,'field',field,'text',source_text,'source_sha256',public.l5_sha256(jsonb_build_object('projection','translation-segment-v1','recipe_version_id',version_id,'kind',kind,'source_id',source_id,'field',field,'text',source_text,'source_locale',source_locale)));
end $$;
create or replace function public.l6_source_segments(recipe jsonb,version jsonb,source_locale text) returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb:='[]';v jsonb;title jsonb;keys text[][]:=array[['name_text','name'],['preparation','preparation'],['source_text','source']];k text[];vid text:=version->>'id';
begin
 if jsonb_typeof(recipe) is distinct from 'object' or jsonb_typeof(version) is distinct from 'object' or not public.l6_id(recipe->'id') or not public.l6_id(version->'id') or version->>'recipe_id' is distinct from recipe->>'id' or jsonb_typeof(version->'ingredients') is distinct from 'array' or jsonb_typeof(version->'steps') is distinct from 'array' then perform public.l5_fail('source_invalide');end if;
 if jsonb_array_length(version->'ingredients')>200 or jsonb_array_length(version->'steps')>200 or octet_length(version::text)>524288 then perform public.l5_fail('bornes');end if;
 if version?'ingredient_structure' and not public.l6_valid_structure(version) then perform public.l5_fail('structure_invalide');end if;
 if exists(select 1 from jsonb_array_elements(version->'ingredients') x where not public.l6_id(x->'id')) or exists(select 1 from jsonb_array_elements(version->'steps') x where not public.l6_id(x->'id')) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(version->'ingredients')x) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(version->'steps')x) then perform public.l5_fail('identites_invalides');end if;
 -- Même choix que display_title || original_title || '', sans transformer nombre/objet en texte.
 title:=recipe->'display_title';if title is null or title in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) then title:=recipe->'original_title';end if;if title is null or title in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) then title:='""'::jsonb;end if;
 r:=r||jsonb_build_array(public.l6_source_segment(vid,'title',vid,'text',title,source_locale));
 for v in select * from jsonb_array_elements(version->'ingredients') loop
  foreach k slice 1 in array keys loop
   if v?k[1] and v->k[1]<>'null'::jsonb and jsonb_typeof(v->k[1]) is distinct from 'string' then perform public.l5_fail('source_invalide');end if;
   if coalesce(v->>k[1],'')<>'' then r:=r||jsonb_build_array(public.l6_source_segment(vid,'ingredient',v->>'id',k[2],v->k[1],source_locale));end if;
  end loop;
 end loop;
 for v in select * from jsonb_array_elements(coalesce(version->'ingredient_structure'->'blocks','[]'::jsonb)) loop if v->>'kind'='heading' then r:=r||jsonb_build_array(public.l6_source_segment(vid,'heading',v->>'id','text',v->'text',source_locale));end if;end loop;
 for v in select * from jsonb_array_elements(version->'steps') loop r:=r||jsonb_build_array(public.l6_source_segment(vid,'step',v->>'id','text',v->'text',source_locale));end loop;
 foreach k slice 1 in array array[['notes','notes'],['yield_text','yield']] loop
  if version?k[1] and version->k[1]<>'null'::jsonb and jsonb_typeof(version->k[1]) is distinct from 'string' then perform public.l5_fail('source_invalide');end if;
  if coalesce(version->>k[1],'')<>'' then r:=r||jsonb_build_array(public.l6_source_segment(vid,k[2],vid,'text',version->k[1],source_locale));end if;
 end loop;
 if jsonb_array_length(r)>903 then perform public.l5_fail('bornes');end if;return r;
end $$;
revoke all on function public.l6_locale(text),public.l6_presence_path(jsonb,text),public.l6_project_source(jsonb,jsonb,text),public.l6_project_source(jsonb,jsonb),public.l6_project_title(jsonb,jsonb),public.l6_project_reading(jsonb),public.l6_project_resolution(jsonb),public.l6_project_candidate(jsonb),public.l6_project_seed(jsonb),public.l6_segment_ref(text,text,text,text),public.l6_source_segment(text,text,text,text,jsonb,text),public.l6_source_segments(jsonb,jsonb,text) from public,anon,authenticated;
`;
