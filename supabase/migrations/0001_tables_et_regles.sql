-- 0001_tables_et_regles.sql — généré par tools/generer-migrations.mjs ; ne pas éditer à la main.
-- Spec : docs/spec-compte-et-stockage-distant.md (v3). Aucune valeur personnelle ici : les adresses vont dans private.allowed_users par l'éditeur SQL.

create extension if not exists pg_cron;
create schema if not exists private;
create sequence if not exists public.sync_seq;

-- Liste des personnes autorisées (spec § 3.2) : écrite seulement par l'éditeur SQL, en minuscules.
create table if not exists private.allowed_users (
  email text primary key check (email = lower(email) and email like '%@%'),
  added_at timestamptz not null default now()
);
alter table private.allowed_users enable row level security;
revoke all on all tables in schema private from anon, authenticated;
revoke usage on schema private from anon, authenticated;

create or replace function public.is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.allowed_users a where a.email = lower(coalesce(auth.jwt()->>'email', '')));
$$;
revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

-- B1 : crochet « Before User Created » (branché par Neegan dans Authentication → Hooks ; preuve 0001_hook.md).
create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e text := lower(coalesce(event->'user'->>'email', ''));
begin
  if e = '' or not exists (select 1 from private.allowed_users a where a.email = e) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'adresse non autorisée'));
  end if;
  return '{}'::jsonb;
end $$;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

-- B1 secondaire : déclencheur sur auth.users.
create or replace function public.enforce_allowed_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (select 1 from private.allowed_users a where a.email = lower(new.email)) then
    raise exception 'adresse non autorisée';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_allowed_user() from public, anon, authenticated;
grant execute on function public.enforce_allowed_user() to supabase_auth_admin;
drop trigger if exists enforce_allowed_user on auth.users;
create trigger enforce_allowed_user before insert on auth.users for each row execute function public.enforce_allowed_user();

-- Ordre de réception : une séquence globale, posée seulement quand le contenu change et hors maintenance (spec § 3.1).
create or replace function public.touch_server_seq() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.server_seq := nextval('public.sync_seq'); return new; end if;
  if current_setting('app.maintenance', true) = 'on' then return new; end if;
  if new.data is distinct from old.data or new.updated_at is distinct from old.updated_at or new.deleted_at is distinct from old.deleted_at then
    new.server_seq := nextval('public.sync_seq');
  end if;
  return new;
end $$;

create table public.books (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index books_recv on public.books (owner_id, server_seq);
alter table public.books enable row level security;
create policy books_select on public.books for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy books_insert on public.books for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy books_update on public.books for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy books_delete on public.books for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger books_seq before insert or update on public.books for each row execute function public.touch_server_seq();

create table public.book_editions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  book_id text generated always as (data->>'book_id') stored,
  isbn text generated always as (data->>'isbn') stored
);
create index book_editions_recv on public.book_editions (owner_id, server_seq);
create index book_editions_book_id on public.book_editions (owner_id, book_id);
create index book_editions_isbn on public.book_editions (owner_id, isbn);
alter table public.book_editions enable row level security;
create policy book_editions_select on public.book_editions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy book_editions_insert on public.book_editions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy book_editions_update on public.book_editions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy book_editions_delete on public.book_editions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger book_editions_seq before insert or update on public.book_editions for each row execute function public.touch_server_seq();

create table public.source_documents (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  edition_id text generated always as (data->>'edition_id') stored,
  sha256 text generated always as (data->>'sha256') stored,
  scan_session_id text generated always as (data->>'scan_session_id') stored
);
create index source_documents_recv on public.source_documents (owner_id, server_seq);
create index source_documents_edition_id on public.source_documents (owner_id, edition_id);
create index source_documents_sha256 on public.source_documents (owner_id, sha256);
create index source_documents_scan_session_id on public.source_documents (owner_id, scan_session_id);
alter table public.source_documents enable row level security;
create policy source_documents_select on public.source_documents for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy source_documents_insert on public.source_documents for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy source_documents_update on public.source_documents for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy source_documents_delete on public.source_documents for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger source_documents_seq before insert or update on public.source_documents for each row execute function public.touch_server_seq();

create table public.source_pages (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  document_id text generated always as (data->>'document_id') stored,
  edition_id text generated always as (data->>'edition_id') stored
);
create index source_pages_recv on public.source_pages (owner_id, server_seq);
create index source_pages_document_id on public.source_pages (owner_id, document_id);
create index source_pages_edition_id on public.source_pages (owner_id, edition_id);
alter table public.source_pages enable row level security;
create policy source_pages_select on public.source_pages for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy source_pages_insert on public.source_pages for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy source_pages_update on public.source_pages for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy source_pages_delete on public.source_pages for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger source_pages_seq before insert or update on public.source_pages for each row execute function public.touch_server_seq();

create table public.scan_sessions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index scan_sessions_recv on public.scan_sessions (owner_id, server_seq);
alter table public.scan_sessions enable row level security;
create policy scan_sessions_select on public.scan_sessions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy scan_sessions_insert on public.scan_sessions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy scan_sessions_update on public.scan_sessions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy scan_sessions_delete on public.scan_sessions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger scan_sessions_seq before insert or update on public.scan_sessions for each row execute function public.touch_server_seq();

create table public.dishes (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index dishes_recv on public.dishes (owner_id, server_seq);
alter table public.dishes enable row level security;
create policy dishes_select on public.dishes for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy dishes_insert on public.dishes for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy dishes_update on public.dishes for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy dishes_delete on public.dishes for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger dishes_seq before insert or update on public.dishes for each row execute function public.touch_server_seq();

create table public.dish_recipe_links (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  dish_id text generated always as (data->>'dish_id') stored,
  recipe_id text generated always as (data->>'recipe_id') stored
);
create index dish_recipe_links_recv on public.dish_recipe_links (owner_id, server_seq);
create index dish_recipe_links_dish_id on public.dish_recipe_links (owner_id, dish_id);
create index dish_recipe_links_recipe_id on public.dish_recipe_links (owner_id, recipe_id);
alter table public.dish_recipe_links enable row level security;
create policy dish_recipe_links_select on public.dish_recipe_links for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy dish_recipe_links_insert on public.dish_recipe_links for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy dish_recipe_links_update on public.dish_recipe_links for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy dish_recipe_links_delete on public.dish_recipe_links for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger dish_recipe_links_seq before insert or update on public.dish_recipe_links for each row execute function public.touch_server_seq();

create table public.recipes (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  edition_id text generated always as (data->>'edition_id') stored
);
create index recipes_recv on public.recipes (owner_id, server_seq);
create index recipes_edition_id on public.recipes (owner_id, edition_id);
alter table public.recipes enable row level security;
create policy recipes_select on public.recipes for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy recipes_insert on public.recipes for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy recipes_update on public.recipes for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy recipes_delete on public.recipes for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger recipes_seq before insert or update on public.recipes for each row execute function public.touch_server_seq();

create table public.recipe_versions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  recipe_id text generated always as (data->>'recipe_id') stored
);
create index recipe_versions_recv on public.recipe_versions (owner_id, server_seq);
create index recipe_versions_recipe_id on public.recipe_versions (owner_id, recipe_id);
alter table public.recipe_versions enable row level security;
create policy recipe_versions_select on public.recipe_versions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy recipe_versions_insert on public.recipe_versions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy recipe_versions_update on public.recipe_versions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy recipe_versions_delete on public.recipe_versions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger recipe_versions_seq before insert or update on public.recipe_versions for each row execute function public.touch_server_seq();

create table public.recipe_translations (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  recipe_version_id text generated always as (data->>'recipe_version_id') stored
);
create index recipe_translations_recv on public.recipe_translations (owner_id, server_seq);
create index recipe_translations_recipe_version_id on public.recipe_translations (owner_id, recipe_version_id);
alter table public.recipe_translations enable row level security;
create policy recipe_translations_select on public.recipe_translations for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy recipe_translations_insert on public.recipe_translations for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy recipe_translations_update on public.recipe_translations for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy recipe_translations_delete on public.recipe_translations for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger recipe_translations_seq before insert or update on public.recipe_translations for each row execute function public.touch_server_seq();

create table public.ingredients (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index ingredients_recv on public.ingredients (owner_id, server_seq);
alter table public.ingredients enable row level security;
create policy ingredients_select on public.ingredients for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy ingredients_insert on public.ingredients for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy ingredients_update on public.ingredients for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy ingredients_delete on public.ingredients for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger ingredients_seq before insert or update on public.ingredients for each row execute function public.touch_server_seq();

create table public.unit_definitions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index unit_definitions_recv on public.unit_definitions (owner_id, server_seq);
alter table public.unit_definitions enable row level security;
create policy unit_definitions_select on public.unit_definitions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy unit_definitions_insert on public.unit_definitions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy unit_definitions_update on public.unit_definitions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy unit_definitions_delete on public.unit_definitions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger unit_definitions_seq before insert or update on public.unit_definitions for each row execute function public.touch_server_seq();

create table public.unit_conventions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index unit_conventions_recv on public.unit_conventions (owner_id, server_seq);
alter table public.unit_conventions enable row level security;
create policy unit_conventions_select on public.unit_conventions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy unit_conventions_insert on public.unit_conventions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy unit_conventions_update on public.unit_conventions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy unit_conventions_delete on public.unit_conventions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger unit_conventions_seq before insert or update on public.unit_conventions for each row execute function public.touch_server_seq();

create table public.substitutions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  recipe_version_id text generated always as (data->>'recipe_version_id') stored
);
create index substitutions_recv on public.substitutions (owner_id, server_seq);
create index substitutions_recipe_version_id on public.substitutions (owner_id, recipe_version_id);
alter table public.substitutions enable row level security;
create policy substitutions_select on public.substitutions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy substitutions_insert on public.substitutions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy substitutions_update on public.substitutions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy substitutions_delete on public.substitutions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger substitutions_seq before insert or update on public.substitutions for each row execute function public.touch_server_seq();

create table public.appliances (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index appliances_recv on public.appliances (owner_id, server_seq);
alter table public.appliances enable row level security;
create policy appliances_select on public.appliances for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy appliances_insert on public.appliances for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy appliances_update on public.appliances for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy appliances_delete on public.appliances for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger appliances_seq before insert or update on public.appliances for each row execute function public.touch_server_seq();

create table public.cook_history (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  recipe_version_id text generated always as (data->>'recipe_version_id') stored,
  recipe_id text generated always as (data->>'recipe_id') stored
);
create index cook_history_recv on public.cook_history (owner_id, server_seq);
create index cook_history_recipe_version_id on public.cook_history (owner_id, recipe_version_id);
create index cook_history_recipe_id on public.cook_history (owner_id, recipe_id);
alter table public.cook_history enable row level security;
create policy cook_history_select on public.cook_history for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy cook_history_insert on public.cook_history for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy cook_history_update on public.cook_history for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy cook_history_delete on public.cook_history for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger cook_history_seq before insert or update on public.cook_history for each row execute function public.touch_server_seq();

create table public.cook_sessions (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  recipe_id text generated always as (data->>'recipe_id') stored
);
create index cook_sessions_recv on public.cook_sessions (owner_id, server_seq);
create index cook_sessions_recipe_id on public.cook_sessions (owner_id, recipe_id);
alter table public.cook_sessions enable row level security;
create policy cook_sessions_select on public.cook_sessions for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy cook_sessions_insert on public.cook_sessions for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy cook_sessions_update on public.cook_sessions for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy cook_sessions_delete on public.cook_sessions for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger cook_sessions_seq before insert or update on public.cook_sessions for each row execute function public.touch_server_seq();

create table public.inventory (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index inventory_recv on public.inventory (owner_id, server_seq);
alter table public.inventory enable row level security;
create policy inventory_select on public.inventory for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy inventory_insert on public.inventory for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy inventory_update on public.inventory for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy inventory_delete on public.inventory for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger inventory_seq before insert or update on public.inventory for each row execute function public.touch_server_seq();

create table public.meals (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index meals_recv on public.meals (owner_id, server_seq);
alter table public.meals enable row level security;
create policy meals_select on public.meals for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy meals_insert on public.meals for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy meals_update on public.meals for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy meals_delete on public.meals for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger meals_seq before insert or update on public.meals for each row execute function public.touch_server_seq();

create table public.meal_feedback (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  meal_id text generated always as (data->>'meal_id') stored
);
create index meal_feedback_recv on public.meal_feedback (owner_id, server_seq);
create index meal_feedback_meal_id on public.meal_feedback (owner_id, meal_id);
alter table public.meal_feedback enable row level security;
create policy meal_feedback_select on public.meal_feedback for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy meal_feedback_insert on public.meal_feedback for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy meal_feedback_update on public.meal_feedback for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy meal_feedback_delete on public.meal_feedback for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger meal_feedback_seq before insert or update on public.meal_feedback for each row execute function public.touch_server_seq();

create table public.shopping_lists (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index shopping_lists_recv on public.shopping_lists (owner_id, server_seq);
alter table public.shopping_lists enable row level security;
create policy shopping_lists_select on public.shopping_lists for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy shopping_lists_insert on public.shopping_lists for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy shopping_lists_update on public.shopping_lists for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy shopping_lists_delete on public.shopping_lists for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger shopping_lists_seq before insert or update on public.shopping_lists for each row execute function public.touch_server_seq();

create table public.library_activity (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  edition_id text generated always as (data->>'edition_id') stored
);
create index library_activity_recv on public.library_activity (owner_id, server_seq);
create index library_activity_edition_id on public.library_activity (owner_id, edition_id);
alter table public.library_activity enable row level security;
create policy library_activity_select on public.library_activity for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy library_activity_insert on public.library_activity for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy library_activity_update on public.library_activity for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy library_activity_delete on public.library_activity for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger library_activity_seq before insert or update on public.library_activity for each row execute function public.touch_server_seq();

create table public.rediscovery_prefs (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)
);
create index rediscovery_prefs_recv on public.rediscovery_prefs (owner_id, server_seq);
alter table public.rediscovery_prefs enable row level security;
create policy rediscovery_prefs_select on public.rediscovery_prefs for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy rediscovery_prefs_insert on public.rediscovery_prefs for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy rediscovery_prefs_update on public.rediscovery_prefs for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy rediscovery_prefs_delete on public.rediscovery_prefs for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger rediscovery_prefs_seq before insert or update on public.rediscovery_prefs for each row execute function public.touch_server_seq();

create table public.timer_launches (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  cook_session_id text generated always as (data->>'cook_session_id') stored
);
create index timer_launches_recv on public.timer_launches (owner_id, server_seq);
create index timer_launches_cook_session_id on public.timer_launches (owner_id, cook_session_id);
alter table public.timer_launches enable row level security;
create policy timer_launches_select on public.timer_launches for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy timer_launches_insert on public.timer_launches for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy timer_launches_update on public.timer_launches for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy timer_launches_delete on public.timer_launches for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger timer_launches_seq before insert or update on public.timer_launches for each row execute function public.touch_server_seq();

create table public.files (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id),
  size bigint generated always as ((data->>'size')::bigint) stored,
  mime text generated always as (data->>'mime') stored,
  check (not (data ? 'blob'))
);
create index files_recv on public.files (owner_id, server_seq);
alter table public.files enable row level security;
create policy files_select on public.files for select to authenticated using (public.is_allowed() and owner_id = auth.uid());
create policy files_insert on public.files for insert to authenticated with check (public.is_allowed() and owner_id = auth.uid());
create policy files_update on public.files for update to authenticated using (public.is_allowed() and owner_id = auth.uid()) with check (public.is_allowed() and owner_id = auth.uid());
create policy files_delete on public.files for delete to authenticated using (public.is_allowed() and owner_id = auth.uid() and current_setting('app.purge', true) = 'on');
create trigger files_seq before insert or update on public.files for each row execute function public.touch_server_seq();

revoke all on all tables in schema public from anon;
-- Personne ne l'appelle directement : les 25 déclencheurs ci-dessus sont déjà créés, et PostgreSQL ne revérifie pas
-- le droit d'exécution d'une fonction de déclencheur au moment où il se déclenche.
revoke execute on function public.touch_server_seq() from public, anon, authenticated;

-- Envoi (spec § 3.4) : sous RLS, par élément, idempotent, jamais d'exception pour une ligne.
create or replace function public.sync_push(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files'];
  keys constant jsonb := '{"books":"id","book_editions":"id","source_documents":"id","source_pages":"id","scan_sessions":"id","dishes":"id","dish_recipe_links":"id","recipes":"id","recipe_versions":"id","recipe_translations":"id","ingredients":"id","unit_definitions":"id","unit_conventions":"id","substitutions":"id","appliances":"id","cook_history":"id","cook_sessions":"id","inventory":"id","meals":"id","meal_feedback":"id","shopping_lists":"id","library_activity":"id","rediscovery_prefs":"edition_id","timer_launches":"id","files":"sha256"}'::jsonb;
  required constant jsonb := '{"books":[],"book_editions":["book_id"],"source_documents":[],"source_pages":["document_id"],"scan_sessions":[],"dishes":[],"dish_recipe_links":["dish_id","recipe_id"],"recipes":[],"recipe_versions":["recipe_id"],"recipe_translations":["recipe_version_id"],"ingredients":[],"unit_definitions":[],"unit_conventions":[],"substitutions":["recipe_version_id"],"appliances":[],"cook_history":["recipe_id","recipe_version_id"],"cook_sessions":["recipe_id"],"inventory":[],"meals":[],"meal_feedback":["meal_id"],"shopping_lists":[],"library_activity":["edition_id"],"rediscovery_prefs":[],"timer_launches":[],"files":[]}'::jsonb;
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
declare n integer; stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files'];
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
declare n integer := 0; k integer; s text; stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files'];
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
declare n integer := 0; k integer; s text; stores constant text[] := array['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files'];
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
select cron.schedule('cuisine-os-tombales', '15 4 * * *', 'select public.purge_tombstones()');
