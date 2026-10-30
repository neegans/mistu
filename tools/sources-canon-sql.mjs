// Projections SQL du contrat L5. Le générateur principal incorpore cette chaîne ; aucun accès réseau.
import { CHAMPS_IDENTITE_PAGE, CHAMPS_ANNOTATION_PAGE, CHAMPS_IDENTITE_DOCUMENT, CHAMPS_SESSION_SOURCE, CHAMPS_RECETTE_INDEX, CHAMPS_LECTURE_INDEX } from '../src/domain/sources-format.js';
const literal = s => "'" + s.replaceAll("'", "''") + "'";
const champs = xs => 'array[' + xs.map(literal).join(',') + ']::text[]';
const projection = (nom, tag, keys, suite = '', source = 'row_data') => `
create or replace function public.${nom}(row_data jsonb${suite ? ", extra jsonb default '[]'::jsonb" : ''}) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(${source},${literal(tag)},${champs(keys)})${suite};
$fn$;
`;

export const sourcesCanonSql = `
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
${projection('l5_project_page','page-identity-v1',CHAMPS_IDENTITE_PAGE,'','public.l5_page_rotation(row_data)')}
${projection('l5_project_annotation','page-annotation-v1',CHAMPS_ANNOTATION_PAGE)}
${projection('l5_project_document','document-identity-v1',CHAMPS_IDENTITE_DOCUMENT)}
${projection('l5_project_session','source-session-v1',CHAMPS_SESSION_SOURCE,"||pg_catalog.jsonb_build_object('sources',extra)")}
${projection('l5_project_session_identity','session-identity-v1',['id','edition_id','source_copy'])}
${projection('l5_project_recipe','index-recipe-v1',CHAMPS_RECETTE_INDEX)}
create or replace function public.l5_project_reading(row_data jsonb, logical_result jsonb) returns jsonb
language sql immutable set search_path = '' as $fn$
 select public.l5_project_fields(row_data,'index-reading-v1',${champs(CHAMPS_LECTURE_INDEX)})||pg_catalog.jsonb_build_object('resultat',logical_result);
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
`;
