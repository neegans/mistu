-- 0005_imports.sql — généré par tools/generer-migrations.mjs ; ne pas éditer à la main.
-- Spec : docs/superpowers/specs/2026-10-18-import-cible-design.md (rév. 3.1, § 3.5). Aucune valeur personnelle ici : les adresses vont dans private.allowed_users par l'éditeur SQL.

-- Migration À AJOUT SEUL : 1 table(s) neuve(s) et les quatre fonctions recréées avec la liste des 27 magasins.
-- À coller APRÈS 0001, 0002 et 0003 (0004 est indépendante), une seule fois. Les droits des fonctions sont rejoués (idempotents).

create table public.imports (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  edition_id text generated always as (data->>'edition_id') stored,
  recipe_id text generated always as (data->>'recipe_id') stored,
  status text generated always as (data->>'status') stored
);
create index imports_recv on public.imports (owner_id, server_seq);
create index imports_edition_id on public.imports (owner_id, edition_id);
create index imports_recipe_id on public.imports (owner_id, recipe_id);
create index imports_status on public.imports (owner_id, status);
alter table public.imports enable row level security;
create policy imports_select on public.imports for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy imports_insert on public.imports for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy imports_update on public.imports for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy imports_delete on public.imports for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger imports_seq before insert or update on public.imports for each row execute function public.touch_server_seq();
-- S4 : la révocation générale pour anon, en 0001, n'a couvert que les tables d'alors ; chaque table neuve est révoquée ici.
revoke all on public.imports from anon;

-- Envoi (spec § 3.4) : sous RLS, par élément, idempotent, jamais d'exception pour une ligne.
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
revoke execute on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- Suppression réelle (spec § 3.5, amendée R12) : la règle delete n'est franchissable que sous app.purge, posé
-- localement ici. Ces deux fonctions ne touchent QUE les lignes. Pour un fichier, l'app supprime d'abord l'objet par
-- l'API de téléversement (règle pages_delete) puis appelle cette fonction : un delete SQL sur la table des objets
-- laisserait les octets orphelins dans le seau.
create or replace function public.sync_purge(store text, id text) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer; stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config', 'imports'];
begin
  if not (store = any(stores)) then raise exception 'store inconnu'; end if;
  perform set_config('app.purge', 'on', true);
  execute format('delete from public.%I where owner_id = auth.uid() and id = $1', store) using id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.sync_purge(text, text) from public, anon;
grant execute on function public.sync_purge(text, text) to authenticated;

create or replace function public.sync_purge_all() returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer := 0; k integer; s text; stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config', 'imports'];
begin
  perform set_config('app.purge', 'on', true);
  foreach s in array stores loop
    execute format('delete from public.%I where owner_id = auth.uid()', s);
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.sync_purge_all() from public, anon;
grant execute on function public.sync_purge_all() to authenticated;

-- Tombales : data vidé après 90 jours, sous maintenance (ne réémet rien) — spec § 3.1.
-- Les deux valeurs passent par « using » : aucune apostrophe à doubler dans le format().
create or replace function public.purge_tombstones() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; k integer; s text; stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files', 'assistant_config', 'imports'];
begin
  perform set_config('app.maintenance', 'on', true);
  foreach s in array stores loop
    execute format('update public.%I set data = $1 where deleted_at < $2 and data <> $1', s)
      using '{}'::jsonb, now() - interval '90 days';
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.purge_tombstones() from public, anon, authenticated;
