-- L2 : cycle des éditions et restauration individuelle depuis un groupe.
-- Aucun contenu existant réécrit. Migration unique, à appliquer après 0008.
-- Un verrou de bibliothèque par propriétaire précède les verrous de lignes, y compris en REST.
create or replace function public.l2_lock_owner() returns void
language sql volatile security invoker set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':library-write',0))
$$;
create or replace function public.l2_guard_statement() returns trigger
language plpgsql security invoker set search_path='' as $$
begin perform public.l2_lock_owner();return null;end $$;
create trigger books_l2_statement before insert or update or delete on public.books for each statement execute function public.l2_guard_statement();
create trigger book_editions_l2_statement before insert or update or delete on public.book_editions for each statement execute function public.l2_guard_statement();
create trigger source_documents_l2_statement before insert or update or delete on public.source_documents for each statement execute function public.l2_guard_statement();
create trigger source_pages_l2_statement before insert or update or delete on public.source_pages for each statement execute function public.l2_guard_statement();
create trigger scan_sessions_l2_statement before insert or update or delete on public.scan_sessions for each statement execute function public.l2_guard_statement();
create trigger dishes_l2_statement before insert or update or delete on public.dishes for each statement execute function public.l2_guard_statement();
create trigger dish_recipe_links_l2_statement before insert or update or delete on public.dish_recipe_links for each statement execute function public.l2_guard_statement();
create trigger recipes_l2_statement before insert or update or delete on public.recipes for each statement execute function public.l2_guard_statement();
create trigger recipe_versions_l2_statement before insert or update or delete on public.recipe_versions for each statement execute function public.l2_guard_statement();
create trigger recipe_translations_l2_statement before insert or update or delete on public.recipe_translations for each statement execute function public.l2_guard_statement();
create trigger ingredients_l2_statement before insert or update or delete on public.ingredients for each statement execute function public.l2_guard_statement();
create trigger unit_definitions_l2_statement before insert or update or delete on public.unit_definitions for each statement execute function public.l2_guard_statement();
create trigger unit_conventions_l2_statement before insert or update or delete on public.unit_conventions for each statement execute function public.l2_guard_statement();
create trigger substitutions_l2_statement before insert or update or delete on public.substitutions for each statement execute function public.l2_guard_statement();
create trigger appliances_l2_statement before insert or update or delete on public.appliances for each statement execute function public.l2_guard_statement();
create trigger cook_history_l2_statement before insert or update or delete on public.cook_history for each statement execute function public.l2_guard_statement();
create trigger cook_sessions_l2_statement before insert or update or delete on public.cook_sessions for each statement execute function public.l2_guard_statement();
create trigger inventory_l2_statement before insert or update or delete on public.inventory for each statement execute function public.l2_guard_statement();
create trigger meals_l2_statement before insert or update or delete on public.meals for each statement execute function public.l2_guard_statement();
create trigger meal_feedback_l2_statement before insert or update or delete on public.meal_feedback for each statement execute function public.l2_guard_statement();
create trigger shopping_lists_l2_statement before insert or update or delete on public.shopping_lists for each statement execute function public.l2_guard_statement();
create trigger library_activity_l2_statement before insert or update or delete on public.library_activity for each statement execute function public.l2_guard_statement();
create trigger rediscovery_prefs_l2_statement before insert or update or delete on public.rediscovery_prefs for each statement execute function public.l2_guard_statement();
create trigger timer_launches_l2_statement before insert or update or delete on public.timer_launches for each statement execute function public.l2_guard_statement();
create trigger files_l2_statement before insert or update or delete on public.files for each statement execute function public.l2_guard_statement();
create trigger assistant_config_l2_statement before insert or update or delete on public.assistant_config for each statement execute function public.l2_guard_statement();
create trigger imports_l2_statement before insert or update or delete on public.imports for each statement execute function public.l2_guard_statement();
create or replace function public.l2_valid_edition(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare token text:=d->>'lifecycle_id';stamp text:=d->>'trashed_at';mode text:=d->>'trash_mode';
begin
  if d is null or jsonb_typeof(d)<>'object' then return false;end if;
  if token is null and stamp is null and mode is null then return true;end if;
  if jsonb_typeof(d->'lifecycle_id') is distinct from 'string' or token !~ '^[A-Za-z0-9_-]{1,200}$' or not(d?'trashed_at') or not(d?'trash_mode') then return false;end if;
  if stamp is null then return mode is null;end if;
  if jsonb_typeof(d->'trashed_at') is distinct from 'string' or mode is null or mode not in ('keep_recipes','with_recipes') then return false;end if;
  begin return to_char(stamp::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=stamp;exception when others then return false;end;
end $$;
create or replace function public.l2_valid_exception(d jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(d->'restored_from_edition','null')='null'::jsonb or
 (jsonb_typeof(d->'restored_from_edition')='object' and jsonb_typeof(d#>'{restored_from_edition,edition_id}')='string'
 and d#>>'{restored_from_edition,edition_id}'=d->>'edition_id'
 and btrim(d#>>'{restored_from_edition,edition_id}')<>'' and ((d->'restored_from_edition')-array['edition_id','lifecycle_id'])='{}'::jsonb
 and jsonb_typeof(d#>'{restored_from_edition,lifecycle_id}')='string'
 and d#>>'{restored_from_edition,lifecycle_id}' ~ '^[A-Za-z0-9_-]{1,200}$')
$$;
create or replace function public.l2_recipe_active(r jsonb,e jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(r is not null and r->>'trashed_at' is null and public.l2_valid_exception(r) and
 (r->>'edition_id' is null or (public.l2_valid_edition(e) and (e->>'trashed_at' is null or e->>'trash_mode'='keep_recipes' or
 (r#>>'{restored_from_edition,edition_id}'=r->>'edition_id' and r#>>'{restored_from_edition,lifecycle_id}'=e->>'lifecycle_id')))),false)
$$;
create or replace function public.l2_edition_ids(s text,d jsonb) returns text[]
language plpgsql stable security invoker set search_path='' as $$
declare ids text[]:='{}';rid text;eid text;
begin
 if s='book_editions' then return array[d->>'id'];end if;
 if s='books' then select coalesce(array_agg(id),'{}') into ids from public.book_editions where owner_id=auth.uid() and data->>'book_id'=d->>'id' and deleted_at is null;return ids;end if;
 if s in ('recipes','source_documents','source_pages','scan_sessions','library_activity','rediscovery_prefs','imports') then ids:=array_append(ids,d->>'edition_id');end if;
 if s='source_pages' then select data->>'edition_id' into eid from public.source_documents where owner_id=auth.uid() and id=d->>'document_id';ids:=array_append(ids,eid);end if;
 for rid in select unnest(public.l1_recipe_ids(s,d)) loop
  select data->>'edition_id' into eid from public.recipes where owner_id=auth.uid() and id=rid;ids:=array_append(ids,eid);
 end loop;
 return ids;
end $$;
create or replace function public.l2_lock_rows(rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb;x jsonb;old_data jsonb;rids text[]:='{}';eids text[]:='{}';v text;s text;
begin
 perform public.l2_lock_owner();
 for r in select * from jsonb_array_elements(rows) loop
  s:=r->>'store';old_data:=null;
  if s=any(array['books','book_editions','source_documents','source_pages','scan_sessions','dishes','dish_recipe_links','recipes','recipe_versions','recipe_translations','ingredients','unit_definitions','unit_conventions','substitutions','appliances','cook_history','cook_sessions','inventory','meals','meal_feedback','shopping_lists','library_activity','rediscovery_prefs','timer_launches','files','assistant_config','imports']) then execute format('select data from public.%I where owner_id=auth.uid() and id=$1',s) into old_data using r->>'id';end if;
  rids:=rids||public.l1_recipe_ids(s,r->'data')||public.l1_recipe_ids(s,old_data)||array[r->>'recipe_id'];
  eids:=eids||public.l2_edition_ids(s,r->'data')||public.l2_edition_ids(s,old_data)||array[r->>'edition_id'];
  for x in select * from jsonb_array_elements(coalesce(r->'recipe_contexts','[]')) loop rids:=array_append(rids,x->>'recipe_id');end loop;
  for x in select * from jsonb_array_elements(coalesce(r->'edition_contexts','[]')) loop eids:=array_append(eids,x->>'edition_id');if x->>'recipe_id' is not null then rids:=array_append(rids,x->>'recipe_id');end if;end loop;
 end loop;
 for v in select distinct a from unnest(rids) a where a is not null order by a loop
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||v,0));
  select data->>'edition_id' into s from public.recipes where owner_id=auth.uid() and id=v;eids:=array_append(eids,s);
 end loop;
 for v in select distinct a from unnest(eids) a where a is not null order by a loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':edition:'||v,0));end loop;
end $$;

create or replace function public.l2_guard_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;d jsonb;before_data jsonb;ids text[];eid text;ed jsonb;ed_deleted timestamptz;ec jsonb;rc jsonb;rid text;recipe jsonb;
 lifecycle boolean;archive_insert boolean;historical boolean;can_complete boolean;source_group jsonb;
begin
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
create trigger book_editions_l2_cycle before insert or update or delete on public.book_editions for each row execute function public.l2_guard_write();
create trigger books_l2_cycle before insert or update or delete on public.books for each row execute function public.l2_guard_write();
create trigger recipes_l2_cycle before insert or update or delete on public.recipes for each row execute function public.l2_guard_write();
create trigger recipe_versions_l2_cycle before insert or update or delete on public.recipe_versions for each row execute function public.l2_guard_write();
create trigger recipe_translations_l2_cycle before insert or update or delete on public.recipe_translations for each row execute function public.l2_guard_write();
create trigger substitutions_l2_cycle before insert or update or delete on public.substitutions for each row execute function public.l2_guard_write();
create trigger dish_recipe_links_l2_cycle before insert or update or delete on public.dish_recipe_links for each row execute function public.l2_guard_write();
create trigger meals_l2_cycle before insert or update or delete on public.meals for each row execute function public.l2_guard_write();
create trigger shopping_lists_l2_cycle before insert or update or delete on public.shopping_lists for each row execute function public.l2_guard_write();
create trigger cook_sessions_l2_cycle before insert or update or delete on public.cook_sessions for each row execute function public.l2_guard_write();
create trigger inventory_l2_cycle before insert or update or delete on public.inventory for each row execute function public.l2_guard_write();
create trigger source_documents_l2_cycle before insert or update or delete on public.source_documents for each row execute function public.l2_guard_write();
create trigger source_pages_l2_cycle before insert or update or delete on public.source_pages for each row execute function public.l2_guard_write();
create trigger scan_sessions_l2_cycle before insert or update or delete on public.scan_sessions for each row execute function public.l2_guard_write();

-- L'ancien point d'entrée conserve ses règles de contenu ; il préverrouille aussi le lot entier.
create or replace function public.sync_push(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config', 'imports'];
  keys constant jsonb := '{"books":"id","book_editions":"id","source_documents":"id","source_pages":"id","scan_sessions":"id","dishes":"id","dish_recipe_links":"id","recipes":"id","recipe_versions":"id","recipe_translations":"id","ingredients":"id","unit_definitions":"id","unit_conventions":"id","substitutions":"id","appliances":"id","cook_history":"id","cook_sessions":"id","inventory":"id","meals":"id","meal_feedback":"id","shopping_lists":"id","library_activity":"id","rediscovery_prefs":"edition_id","timer_launches":"id","files":"sha256","assistant_config":"id","imports":"id"}'::jsonb;
  required constant jsonb := '{"books":[],"book_editions":["book_id"],"source_documents":[],"source_pages":["document_id"],"scan_sessions":[],"dishes":[],"dish_recipe_links":["dish_id","recipe_id"],"recipes":[],"recipe_versions":["recipe_id"],"recipe_translations":["recipe_version_id"],"ingredients":[],"unit_definitions":[],"unit_conventions":[],"substitutions":["recipe_version_id"],"appliances":[],"cook_history":["recipe_id","recipe_version_id"],"cook_sessions":["recipe_id"],"inventory":[],"meals":[],"meal_feedback":["meal_id"],"shopping_lists":[],"library_activity":["edition_id"],"rediscovery_prefs":[],"timer_launches":[],"files":[],"assistant_config":[],"imports":[]}'::jsonb;
  r jsonb; s text; i text; d jsonb; u timestamptz; del boolean; adj boolean; bad text; f text;
  cur_updated timestamptz; cur_data jsonb; cur_deleted timestamptz;
  accepted jsonb := '[]'; adjusted jsonb := '[]'; rejected jsonb := '[]';
  now_ts timestamptz := now();
begin
  if rows is null or jsonb_typeof(rows) <> 'array' then raise exception 'rows : tableau attendu'; end if;
  if jsonb_array_length(rows) > 500 then raise exception 'rows : 500 éléments au plus'; end if;
  if pg_column_size(rows) > 1048576 then raise exception 'rows : 1 Mo au plus'; end if;
  -- Autorisation vérifiée une fois, ici : une adresse retirée de private.allowed_users pendant la session doit
  -- donner un échec franc, pas 500 rejets « forme » que le client lirait comme « mes fiches sont mal formées ».
  if not public.is_allowed() then raise exception 'adresse non autorisée'; end if;
  -- S2 : seule cette fonction a le droit d'écrire la tombale deleted_at (le déclencheur la fige partout ailleurs).
  -- Drapeau LOCAL à la transaction ; via PostgREST, un appel de RPC est une transaction (voir la limite connue du
  -- § 11 sur app.purge : la portée est la même, et elle vaut ici pour la même raison).
  perform public.l2_lock_rows(rows);
  perform set_config('app.sync_push', 'on', true);
  for r in select * from jsonb_array_elements(rows) loop
    s := r->>'store'; i := r->>'id'; d := r->'data'; adj := false; bad := null;
    if s is null or not (s = any(stores)) then raise exception 'store inconnu'; end if;
    -- Clé absente : rejetée ici pour tous les éléments, tombale comprise (la colonne id est not null en base).
    if i is null or i = '' then bad := 'cle'; end if;
    -- « deleted » et « updated_at » sont analysés sous protection : un élément mal formé ne doit pas emporter le lot.
    begin del := coalesce((r->>'deleted')::boolean, false); exception when others then del := false; if bad is null then bad := 'forme'; end if; end;
    begin u := (r->>'updated_at')::timestamptz; exception when others then u := null; end;
    if bad is null and u is null then bad := 'updated_at'; end if;
    if bad is null and u > now_ts + interval '5 minutes' then u := now_ts; adj := true; end if;
    -- Deux seuils de taille, volontairement distincts (R14) : 512 Ko par élément, rejeté SEUL avec le motif
    -- « taille » ; 1 Mo pour le lot entier, qui lève plus haut. Au même seuil, « taille » serait inatteignable —
    -- un élément de plus de 1 Mo rend forcément le lot plus gros que 1 Mo, donc l'appel serait refusé avant la boucle.
    if bad is null then
      if d is null or jsonb_typeof(d) = 'null' then
        d := null; if not del then bad := 'forme'; end if;
      elsif jsonb_typeof(d) <> 'object' then bad := 'forme';
      elsif (d->>(keys->>s)) is distinct from i then bad := 'cle';
      elsif pg_column_size(d) > 524288 then bad := 'taille';
      else
        for f in select jsonb_array_elements_text(coalesce(required->s, '[]'::jsonb)) loop
          if d->>f is null then bad := 'forme'; end if;
          exit when bad is not null;
        end loop;
        -- Contraintes propres à public.files, vérifiées avant l'écriture pour que le motif soit clair.
        if bad is null and s = 'files' then
          if d ? 'blob' then bad := 'forme';
          elsif d->>'size' is not null and d->>'size' !~ '^[0-9]+$' then bad := 'forme';
          end if;
        end if;
      end if;
    end if;
    if bad is not null then
      rejected := rejected || jsonb_build_object('store', s, 'id', i, 'reason', bad); continue;
    end if;
    cur_updated := null; cur_data := null; cur_deleted := null;
    execute format('select updated_at, data, deleted_at from public.%I where owner_id = auth.uid() and id = $1', s) into cur_updated, cur_data, cur_deleted using i;
    -- Sous-bloc par élément (un point de reprise, 500 au plus) : une contrainte de table refuse l'élément, jamais le
    -- lot. Le retour en arrière du sous-bloc annule l'écriture, pas les variables plpgsql : accepted, adjusted et
    -- rejected déjà posés sont conservés. Aucun « continue » ici : il reste au niveau de la boucle externe.
    begin
      if cur_updated is null then
        execute format('insert into public.%I (owner_id, id, data, updated_at, deleted_at) values (auth.uid(), $1, $2, $3, $4)', s)
          using i, coalesce(d, '{}'::jsonb), u, case when del then now_ts end;
      elsif u > cur_updated then
        execute format('update public.%I set data = $2, updated_at = $3, deleted_at = $4 where owner_id = auth.uid() and id = $1', s)
          using i, coalesce(d, cur_data), u, case when del then coalesce(cur_deleted, now_ts) end;
      elsif u = cur_updated and ((del and cur_deleted is not null) or (not del and cur_deleted is null and d = cur_data)) then
        null; -- réessai idempotent : rien n'est écrit, server_seq inchangé
      else
        bad := 'conflit';
      end if;
    exception when others then
      -- Refus d'une règle (42501), sérialisation ou verrou mortel (40001, 40P01), ressource épuisée (53100, 53200,
      -- 57P03) : rien de tout cela n'est imputable à l'élément. Ces échecs remontent ; le reste devient un rejet.
      if sqlstate in ('42501','40001','40P01','53100','53200','57P03') then raise; end if;
      bad := 'forme';
    end;
    if bad = 'conflit' then
      rejected := rejected || jsonb_build_object('store', s, 'id', i, 'reason', 'conflit',
        'server', jsonb_build_object('data', cur_data, 'updated_at', cur_updated, 'deleted_at', cur_deleted));
      continue;
    elsif bad is not null then
      rejected := rejected || jsonb_build_object('store', s, 'id', i, 'reason', bad); continue;
    end if;
    if adj then adjusted := adjusted || jsonb_build_object('store', s, 'id', i, 'updated_at', u);
    else accepted := accepted || jsonb_build_object('store', s, 'id', i); end if;
  end loop;
  return jsonb_build_object('server_time', now_ts, 'accepted', accepted, 'adjusted', adjusted, 'rejected', rejected);
end $$;
alter function public.sync_push_v2(jsonb) rename to l1_sync_push_v2;
create or replace function public.l1_sync_push_v2(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; c jsonb; cur jsonb; d jsonb; response jsonb; result jsonb;
  rid text; opid text; base text; action text; stamp timestamptz; old_stamp timestamptz; deleted timestamptz; seq bigint;
  accepted jsonb:='[]';adjusted jsonb:='[]';rejected jsonb:='[]';seed_used boolean; bad text;
begin
  perform public.l2_lock_owner();
  if not public.is_allowed() then raise exception 'adresse non autorisée'; end if;
  if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    rid:=coalesce(r->>'recipe_id',case when r->>'store'='recipes' then r->>'id' end);
    opid:=r->>'operation_id';seed_used:=false;cur:=null;deleted:=null;bad:=null;
    if rid is not null then perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||rid,0)); end if;
    select data,updated_at,deleted_at,server_seq into cur,old_stamp,deleted,seq from public.recipes where owner_id=auth.uid() and id=rid;
    begin
      if r->>'op'='lifecycle' then
        action:=r->>'action';base:=r->>'base_cycle_id';
        if r->>'store' is distinct from 'recipes' or jsonb_typeof(r->'id') is distinct from 'string' or jsonb_typeof(r->'recipe_id') is distinct from 'string' or btrim(rid)='' or r->>'id' is distinct from rid
          or jsonb_typeof(r->'operation_id') is distinct from 'string' or opid !~ '^[A-Za-z0-9_-]{1,200}$'
          or jsonb_typeof(r->'action') is distinct from 'string' or action not in ('trash','restore')
          or not(r?'base_cycle_id') or (base is not null and (jsonb_typeof(r->'base_cycle_id') is distinct from 'string' or base !~ '^[A-Za-z0-9_-]{1,200}$'))
          or jsonb_typeof(r->'at') is distinct from 'string' then raise check_violation using message='cycle'; end if;
        stamp:=(r->>'at')::timestamptz;
        if to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from r->>'at' then raise check_violation using message='cycle';end if;
        if stamp is null or r->>'at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or deleted is not null or cur->>'edition_id' is not null then raise check_violation using message='cycle'; end if;
        if cur->>'lifecycle_id'=opid then
          if (action='trash') is distinct from (cur->>'trashed_at' is not null) then raise check_violation using message='cycle';end if;
          -- Accusé perdu : la création couverte peut sortir de file si son contenu est toujours confirmé.
          seed_used:=jsonb_typeof(r->'seed')='object' and (cur-'lifecycle_id'-'trashed_at'-'updated_at')=((r->'seed')-'lifecycle_id'-'trashed_at'-'updated_at');
        else
          if cur is null then
            d:=r->'seed';
            if action<>'trash' or base is not null or jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'id') is distinct from 'string' or d->>'id' is distinct from rid or d->>'edition_id' is not null or pg_column_size(d)>524288 then raise check_violation using message='cycle'; end if;
            seed_used:=true;
          else
            if base is distinct from cur->>'lifecycle_id' or (action='trash' and cur->>'trashed_at' is not null) or (action='restore' and cur->>'trashed_at' is null) then raise check_violation using message='cycle'; end if;
            d:=cur;
          end if;
          d:=d||jsonb_build_object('lifecycle_id',opid,'trashed_at',case when action='trash' then r->>'at' else null end);
          old_stamp:=greatest(clock_timestamp(),coalesce(old_stamp,clock_timestamp())+interval '1 microsecond');
          d:=d||jsonb_build_object('updated_at',old_stamp);
          perform set_config('app.l1_write',r::text,true);
          if seed_used then insert into public.recipes(owner_id,id,data,updated_at) values(auth.uid(),rid,d,old_stamp);
          else update public.recipes set data=d,updated_at=old_stamp where owner_id=auth.uid() and id=rid;end if;
        end if;
        select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into result from public.recipes where owner_id=auth.uid() and id=rid;
        accepted:=accepted||jsonb_build_object('store','recipes','id',rid,'operation_id',opid,'server',result,'seed_used',seed_used);
      else
        if r->>'store'='recipes' then
          if deleted is not null then raise check_violation using message='cycle';end if;
          if cur is not null and r->>'archive_import'='true' and ((r->'data')->>'lifecycle_id' is distinct from cur->>'lifecycle_id' or (r->'data')->>'trashed_at' is distinct from cur->>'trashed_at') then raise check_violation using message='cycle';end if;
          if cur is not null and ((cur->>'lifecycle_id' is not null and not (r ? 'expected_cycle_id')) or r->>'expected_cycle_id' is distinct from cur->>'lifecycle_id' or cur->>'trashed_at' is not null) then raise check_violation using message='cycle';end if;
          if cur is not null then
            if cur ? 'lifecycle_id' or cur ? 'trashed_at' then r:=jsonb_set(r,'{data}',(r->'data')||jsonb_build_object('lifecycle_id',cur->'lifecycle_id','trashed_at',cur->'trashed_at'));
            else r:=jsonb_set(r,'{data}',(r->'data')-'lifecycle_id'-'trashed_at');end if;
          elsif r->>'archive_import' is distinct from 'true' then r:=jsonb_set(r,'{data}',(r->'data')-'lifecycle_id'-'trashed_at');end if;
        end if;
        perform set_config('app.l1_write',r::text,true);
        response:=public.sync_push(jsonb_build_array(r));
        accepted:=accepted||coalesce(response->'accepted','[]');adjusted:=adjusted||coalesce(response->'adjusted','[]');
        for c in select * from jsonb_array_elements(coalesce(response->'rejected','[]')) loop
          if c->>'reason'='forme' and (rid is not null or r?'recipe_contexts') then c:=c||jsonb_build_object('reason','cycle','server',case when cur is null then null else jsonb_build_object('data',cur,'updated_at',old_stamp,'deleted_at',deleted) end);end if;
          rejected:=rejected||c;
        end loop;
      end if;
    exception when check_violation or invalid_datetime_format or datetime_field_overflow then
      rejected:=rejected||jsonb_build_object('store',r->>'store','id',r->>'id','operation_id',opid,'reason','cycle','server',case when cur is null then null else jsonb_build_object('data',cur,'updated_at',old_stamp,'deleted_at',deleted) end);
    end;
    perform set_config('app.l1_write','',true);
  end loop;
  return jsonb_build_object('server_time',clock_timestamp(),'accepted',accepted,'adjusted',adjusted,'rejected',rejected);
end $$;

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

create function public.sync_push_v2(rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare r jsonb;cur jsonb;parent jsonb;d jsonb;result jsonb;response jsonb;rejet jsonb;edstate jsonb;old_stamp timestamptz;deleted timestamptz;parent_deleted timestamptz;stamp timestamptz;
 target text;id text;eid text;opid text;action text;base text;mode text;seed_used boolean;accepted jsonb:='[]';adjusted jsonb:='[]';rejected jsonb:='[]';
begin
 if not public.is_allowed() then raise exception 'adresse non autorisée';end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>500 or pg_column_size(rows)>1048576 then raise exception 'rows : lot invalide';end if;
 perform public.l2_lock_rows(rows);
 for r in select * from jsonb_array_elements(rows) loop
  id:=r->>'id';target:=r->>'store';eid:=r->>'edition_id';opid:=r->>'operation_id';action:=r->>'action';base:=r->>'base_cycle_id';mode:=r->>'mode';seed_used:=false;cur:=null;parent:=null;deleted:=null;parent_deleted:=null;old_stamp:=null;
  if target='book_editions' then select data,updated_at,deleted_at into cur,old_stamp,deleted from public.book_editions where owner_id=auth.uid() and book_editions.id=id;
  elsif target='recipes' then select data,updated_at,deleted_at into cur,old_stamp,deleted from public.recipes where owner_id=auth.uid() and recipes.id=id;end if;
  if eid is null and r->>'op' is distinct from 'lifecycle' then eid:=case when target='book_editions' then id else coalesce(cur->>'edition_id',r->'data'->>'edition_id',r->'edition_contexts'->0->>'edition_id') end;end if;
  if eid is not null then select data,deleted_at into parent,parent_deleted from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;end if;
  begin
   if r->>'op'='source_batch' then
    accepted:=accepted||public.l2_sync_sources(r);
   elsif r->>'op'='lifecycle' and (target='book_editions' or eid is not null or action='restore_from_edition') then
    if jsonb_typeof(r->'id') is distinct from 'string' or btrim(id)='' or jsonb_typeof(r->'operation_id') is distinct from 'string' or opid !~ '^[A-Za-z0-9_-]{1,200}$'
     or not(r?'base_cycle_id') or (base is not null and (jsonb_typeof(r->'base_cycle_id') is distinct from 'string' or base !~ '^[A-Za-z0-9_-]{1,200}$'))
     or action is null or action not in ('trash','restore','restore_from_edition') or jsonb_typeof(r->'at') is distinct from 'string' then raise check_violation using message='cycle';end if;
    stamp:=(r->>'at')::timestamptz;if to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from r->>'at' or deleted is not null then raise check_violation using message='cycle';end if;
    if target='book_editions' then
     if r->>'entity' is distinct from 'edition' or eid is distinct from id or action='restore_from_edition' or (action='trash' and (mode is null or mode not in ('keep_recipes','with_recipes'))) then raise check_violation using message='cycle';end if;
     if cur is not null and not public.l2_valid_edition(cur) then raise check_violation using message='cycle';end if;
     if cur->>'lifecycle_id'=opid then
      if (action='trash') is distinct from (cur->>'trashed_at' is not null) or (action='trash' and mode is distinct from cur->>'trash_mode') then raise check_violation using message='cycle';end if;
     else
      if cur is null then
       d:=r->'seed';if action<>'trash' or base is not null or jsonb_typeof(d) is distinct from 'object' or d->>'id' is distinct from id or pg_column_size(d)>524288 or not exists(select 1 from public.books where owner_id=auth.uid() and books.id=d->>'book_id' and deleted_at is null) then raise check_violation using message='cycle';end if;seed_used:=true;
      else
       if base is distinct from cur->>'lifecycle_id' or (action='trash')=(cur->>'trashed_at' is not null) then raise check_violation using message='cycle';end if;d:=cur;
      end if;
      old_stamp:=greatest(clock_timestamp(),coalesce(old_stamp,clock_timestamp())+interval '1 microsecond');
      d:=d||jsonb_build_object('lifecycle_id',opid,'trashed_at',case when action='trash' then r->>'at' else null end,'trash_mode',case when action='trash' then mode else null end,'updated_at',old_stamp);
      perform set_config('app.l1_write',r::text,true);
      if seed_used then insert into public.book_editions(owner_id,id,data,updated_at) values(auth.uid(),id,d,old_stamp);else update public.book_editions set data=d,updated_at=old_stamp where owner_id=auth.uid() and book_editions.id=id;end if;
     end if;
     select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into result from public.book_editions where owner_id=auth.uid() and book_editions.id=id;
     accepted:=accepted||jsonb_build_object('store',target,'id',id,'operation_id',opid,'server',result,'seed_used',seed_used);
    else
     if target<>'recipes' or cur is null or cur->>'edition_id' is distinct from eid or parent is null or parent_deleted is not null or not public.l2_valid_edition(parent) or not(r?'base_edition_cycle_id') then raise check_violation using message='cycle';end if;
     if cur->>'lifecycle_id'=opid then
      if (action='trash') is distinct from (cur->>'trashed_at' is not null) or (action='restore_from_edition' and (cur#>>'{restored_from_edition,edition_id}' is distinct from eid or cur#>>'{restored_from_edition,lifecycle_id}' is distinct from r->>'base_edition_cycle_id')) then raise check_violation using message='cycle';end if;
     else
      if base is distinct from cur->>'lifecycle_id' or r->>'base_edition_cycle_id' is distinct from parent->>'lifecycle_id' then raise check_violation using message='cycle';end if;
      if action='restore_from_edition' then if parent->>'trashed_at' is null or parent->>'trash_mode'<>'with_recipes' then raise check_violation using message='cycle';end if;
      elsif action='trash' then if not public.l2_recipe_active(cur,parent) then raise check_violation using message='cycle';end if;
      else if cur->>'trashed_at' is null or not public.l2_recipe_active(cur||'{"trashed_at":null}'::jsonb,parent) then raise check_violation using message='cycle';end if;end if;
      old_stamp:=greatest(clock_timestamp(),old_stamp+interval '1 microsecond');
      d:=cur||jsonb_build_object('lifecycle_id',opid,'trashed_at',case when action='trash' then r->>'at' else null end,'restored_from_edition',case when action='restore_from_edition' then jsonb_build_object('edition_id',eid,'lifecycle_id',r->>'base_edition_cycle_id') else null end,'updated_at',old_stamp);
      perform set_config('app.l1_write',r::text,true);update public.recipes set data=d,updated_at=old_stamp where owner_id=auth.uid() and recipes.id=id;
     end if;
     select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into result from public.recipes where owner_id=auth.uid() and recipes.id=id;
     select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into response from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;
     accepted:=accepted||jsonb_build_object('store',target,'id',id,'operation_id',opid,'server',result,'edition_server',response);
    end if;
   else
    response:=public.l1_sync_push_v2(jsonb_build_array(r));accepted:=accepted||coalesce(response->'accepted','[]');adjusted:=adjusted||coalesce(response->'adjusted','[]');
    for rejet in select * from jsonb_array_elements(coalesce(response->'rejected','[]')) loop
     if rejet->>'reason'='forme' and jsonb_array_length(coalesce(r->'edition_contexts','[]'))>0 then rejet:=rejet||'{"reason":"cycle"}'::jsonb;end if;
     if rejet->>'reason'='cycle' and eid is not null then
      select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into edstate from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;
      rejet:=rejet||jsonb_build_object('edition_server',edstate);
     end if;
     rejected:=rejected||rejet;
    end loop;
   end if;
  exception when check_violation or invalid_datetime_format or datetime_field_overflow then
   if target=any(array['books','book_editions','source_documents','source_pages','scan_sessions','dishes','dish_recipe_links','recipes','recipe_versions','recipe_translations','ingredients','unit_definitions','unit_conventions','substitutions','appliances','cook_history','cook_sessions','inventory','meals','meal_feedback','shopping_lists','library_activity','rediscovery_prefs','timer_launches','files','assistant_config','imports']) then execute format('select jsonb_build_object(''data'',data,''updated_at'',updated_at,''deleted_at'',deleted_at,''server_seq'',server_seq) from public.%I where owner_id=auth.uid() and id=$1',target) into result using id;else result:=null;end if;
   select jsonb_build_object('data',data,'updated_at',updated_at,'deleted_at',deleted_at,'server_seq',server_seq) into response from public.book_editions where owner_id=auth.uid() and book_editions.id=eid;
   rejected:=rejected||jsonb_build_object('store',target,'id',id,'operation_id',opid,'reason','cycle','server',result,'edition_server',response);
  end;
  perform set_config('app.l1_write','',true);perform set_config('app.l2_sources','',true);
 end loop;
 return jsonb_build_object('server_time',clock_timestamp(),'accepted',accepted,'adjusted',adjusted,'rejected',rejected);
end $$;
create or replace function public.sync_capabilities() returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when public.is_allowed() then '{"recipe_lifecycle":1,"edition_lifecycle":1}'::jsonb else '{}'::jsonb end
$$;
revoke all on function public.l2_lock_owner() from public,anon;
grant execute on function public.l2_lock_owner() to authenticated;
revoke all on function public.l2_sync_sources(jsonb) from public,anon;
grant execute on function public.l2_sync_sources(jsonb) to authenticated;
revoke all on function public.l2_valid_edition(jsonb) from public,anon;
grant execute on function public.l2_valid_edition(jsonb) to authenticated;
revoke all on function public.l2_valid_exception(jsonb) from public,anon;
grant execute on function public.l2_valid_exception(jsonb) to authenticated;
revoke all on function public.l2_recipe_active(jsonb,jsonb) from public,anon;
grant execute on function public.l2_recipe_active(jsonb,jsonb) to authenticated;
revoke all on function public.l2_edition_ids(text,jsonb) from public,anon;
grant execute on function public.l2_edition_ids(text,jsonb) to authenticated;
revoke all on function public.l2_lock_rows(jsonb) from public,anon;
grant execute on function public.l2_lock_rows(jsonb) to authenticated;
revoke all on function public.l1_sync_push_v2(jsonb) from public,anon;
grant execute on function public.l1_sync_push_v2(jsonb) to authenticated;
revoke all on function public.sync_push_v2(jsonb) from public,anon;
grant execute on function public.sync_push_v2(jsonb) to authenticated;
revoke all on function public.sync_capabilities() from public,anon;
grant execute on function public.sync_capabilities() to authenticated;
revoke all on function public.l2_guard_write() from public,anon,authenticated;
revoke all on function public.l2_guard_statement() from public,anon,authenticated;
