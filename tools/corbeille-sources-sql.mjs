// Partie atomique de 0009 ; aucun magasin ou champ métier de journal supplémentaire.
export function sourcesCorbeilleSQL() { return `
create or replace function public.l2_sync_sources(c jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare rows jsonb:=c->'rows';x jsonb;d jsonb;ss jsonb;old_ss jsonb;parent jsonb;recipe jsonb;existing jsonb;del timestamptz;
 docs jsonb:='[]';pages jsonb:='[]';result jsonb;ack jsonb:='[]';r jsonb;seen text[]:='{}';deja boolean:=true;session_id text:=c->>'id';eid text:=c->>'edition_id';rid text:=c->>'recipe_id';store text;key text;
begin
 if not public.is_allowed() then raise exception 'adresse non autorisée';end if;
 if c->>'store' is distinct from 'scan_sessions' or c->>'op' is distinct from 'source_batch' or jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)<2 or jsonb_array_length(rows)>500 or octet_length(c::text)>524288 or c->>'operation_id' is null or c->>'operation_id' !~ '^[A-Za-z0-9_-]{1,200}$' or not(c?'base_session' and c?'base_cycle_id' and c?'base_edition_cycle_id') then raise check_violation using message='cycle';end if;
 perform public.l2_lock_rows(jsonb_build_array(c));
 select data,deleted_at into parent,del from public.book_editions where owner_id=auth.uid() and id=eid;
 if parent is null or del is not null or not public.l2_valid_edition(parent) or parent->>'lifecycle_id' is distinct from c->>'base_edition_cycle_id' then raise check_violation using message='cycle';end if;
 select data,deleted_at into recipe,del from public.recipes where owner_id=auth.uid() and id=rid;
 if recipe is null or del is not null or recipe->>'edition_id' is distinct from eid or recipe->>'lifecycle_id' is distinct from c->>'base_cycle_id' or not public.l2_recipe_active(recipe,parent) then raise check_violation using message='cycle';end if;
 select data,deleted_at into old_ss,del from public.scan_sessions where owner_id=auth.uid() and id=session_id;
 if del is not null then raise check_violation using message='cycle';end if;
 for x in select * from jsonb_array_elements(rows) loop
  store:=x->>'store';key:=x->>'id';d:=x->'data';
  if store is null or store not in ('scan_sessions','source_documents','source_pages') or jsonb_typeof(d) is distinct from 'object' or key is null or btrim(key)='' or d->>'id' is distinct from key or d->>'edition_id' is distinct from eid or x->>'updated_at' is null or (store||':'||key)=any(seen) then raise check_violation using message='cycle';end if;
  perform (x->>'updated_at')::timestamptz;seen:=array_append(seen,store||':'||key);
  if store='scan_sessions' then
   if ss is not null or key is distinct from session_id or d->'recipe_ids' is distinct from jsonb_build_array(rid) then raise check_violation using message='cycle';end if;ss:=d;
  elsif store='source_documents' then
   if d->>'scan_session_id' is distinct from session_id then raise check_violation using message='cycle';end if;docs:=docs||to_jsonb(key);
  else pages:=pages||to_jsonb(key);end if;
 end loop;
 if ss is null or jsonb_array_length(docs)=0 or jsonb_typeof(ss->'document_ids') is distinct from 'array' or jsonb_typeof(ss->'page_ids') is distinct from 'array' then raise check_violation using message='cycle';end if;
 for x in select * from jsonb_array_elements(rows) where value->>'store'='source_pages' loop
  if not(docs ? (x->'data'->>'document_id')) then raise check_violation using message='cycle';end if;
 end loop;
 -- Un accusé perdu peut revenir après une autre extension de la même séance ; les sources déjà présentes
 -- doivent être identiques et la séance doit toujours leur appartenir. Aucun ancien contenu n'est réécrit.
 if old_ss is null or old_ss->'recipe_ids' is distinct from jsonb_build_array(rid) or not(coalesce(old_ss->'document_ids','[]') @> docs) or not(coalesce(old_ss->'page_ids','[]') @> pages) then deja:=false;end if;
 for x in select * from jsonb_array_elements(rows) where value->>'store'<>'scan_sessions' loop
  execute format('select data,deleted_at from public.%I where owner_id=auth.uid() and id=$1',x->>'store') into existing,del using x->>'id';
  if existing is null or del is not null or (existing-'updated_at') is distinct from ((x->'data')-'updated_at') then deja:=false;end if;
 end loop;
 if not deja then
  if (old_ss is null and c->'base_session'<>'null'::jsonb) or (old_ss is not null and (old_ss-'updated_at') is distinct from ((c->'base_session')-'updated_at')) then raise check_violation using message='cycle';end if;
  if old_ss is not null and (old_ss->>'edition_id' is distinct from eid or old_ss->'recipe_ids' is distinct from jsonb_build_array(rid)) then raise check_violation using message='cycle';end if;
  if ss->'document_ids' is distinct from (coalesce(old_ss->'document_ids','[]')||docs) or ss->'page_ids' is distinct from (coalesce(old_ss->'page_ids','[]')||pages) then raise check_violation using message='cycle';end if;
  for x in select * from jsonb_array_elements(rows) where value->>'store'<>'scan_sessions' loop
   execute format('select data from public.%I where owner_id=auth.uid() and id=$1',x->>'store') into existing using x->>'id';
   if existing is not null then raise check_violation using message='cycle';end if;
  end loop;
  perform set_config('app.l2_sources',c::text,true);
  for x in select * from jsonb_array_elements(rows) order by case value->>'store' when 'scan_sessions' then 0 when 'source_documents' then 1 else 2 end loop
   r:=jsonb_build_object('store',x->>'store','id',x->>'id','data',x->'data','updated_at',x->>'updated_at','recipe_id',rid,'expected_cycle_id',c->'base_cycle_id','expected_edition_id',eid,'edition_contexts',jsonb_build_array(jsonb_build_object('edition_id',eid,'expected_cycle_id',c->'base_edition_cycle_id','recipe_id',rid)));
   result:=public.l1_sync_push_v2(jsonb_build_array(r));
   if jsonb_array_length(coalesce(result->'rejected','[]'))>0 or jsonb_array_length(coalesce(result->'accepted','[]'))+jsonb_array_length(coalesce(result->'adjusted','[]'))<>1 then raise check_violation using message='cycle';end if;
  end loop;
  perform set_config('app.l2_sources','',true);
 end if;
 for x in select * from jsonb_array_elements(rows) loop
  execute format('select jsonb_build_object(''store'',$2,''id'',id,''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',x->>'store') into result using x->>'id',x->>'store';
  ack:=ack||result;
 end loop;
 return jsonb_build_object('store','scan_sessions','id',session_id,'operation_id',c->>'operation_id','server_rows',ack);
end $$;
`;
}
