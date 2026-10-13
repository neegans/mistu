#!/usr/bin/env node
// Génère les migrations SQL du lot « compte et stockage distant » depuis src/sync/tables.js (spec § 3.1-3.7).
// Usage : node tools/generer-migrations.mjs            → écrit supabase/migrations/0001_*.sql et 0002_*.sql
//         node tools/generer-migrations.mjs --check    → code 1 si les fichiers commités diffèrent du généré
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TABLES } from '../src/sync/tables.js';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

// En-tête volontairement sans date : la sortie doit être déterministe (le test le vérifie, et --check sert de garde).
const ENTETE = (nom) => `-- ${nom} — généré par tools/generer-migrations.mjs ; ne pas éditer à la main.
-- Spec : docs/spec-compte-et-stockage-distant.md (v3). Aucune valeur personnelle ici : les adresses vont dans private.allowed_users par l'éditeur SQL.

`;
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const list = (arr) => arr.map(q).join(', ');

function table(store) {
  const t = TABLES[store];
  const gen = t.generated.map((g) => `,\n  ${g.name} ${g.type} generated always as ${g.sql} stored`).join('');
  const extra = store === 'files' ? `,\n  check (not (data ? 'blob'))` : '';
  const idx = t.generated
    .filter((g) => g.name !== 'size' && g.name !== 'mime')
    .map((g) => `create index ${store}_${g.name} on public.${store} (owner_id, ${g.name});\n`)
    .join('');
  const cond = `public.is_allowed() and owner_id = auth.uid()`;
  return `create table public.${store} (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)${gen}${extra}
);
create index ${store}_recv on public.${store} (owner_id, server_seq);
${idx}alter table public.${store} enable row level security;
create policy ${store}_select on public.${store} for select to authenticated using (${cond});
create policy ${store}_insert on public.${store} for insert to authenticated with check (${cond});
create policy ${store}_update on public.${store} for update to authenticated using (${cond}) with check (${cond});
create policy ${store}_delete on public.${store} for delete to authenticated using (${cond} and current_setting('app.purge', true) = 'on');
create trigger ${store}_seq before insert or update on public.${store} for each row execute function public.touch_server_seq();
`;
}

export function renderMigrations() {
  const stores = SYNC_STORES;
  const keys = JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s].key])));
  const required = JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s].required])));
  const tables = ENTETE('0001_tables_et_regles.sql') + `create extension if not exists pg_cron;
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

-- Ordre de réception (spec § 3.1, amendé R25) : une séquence globale, posée par le SERVEUR à chaque insert et à
-- chaque update, hors maintenance. La valeur fournie par l'appelant n'est jamais lue, donc jamais conservée : la
-- règle *_update n'autorise que par ligne, jamais par colonne, et le rôle authenticated a le privilège update sur
-- les 25 tables. Sans cette pose inconditionnelle, un PATCH direct écrirait server_seq — le curseur de réception de
-- TOUS les appareils (spec § 5.5) — et la réception s'arrêterait en silence. Une écriture qui ne change rien coûte
-- donc un numéro de séquence : c'est le prix de la garantie, et sync_push n'écrit déjà rien sur un réessai identique.
create or replace function public.touch_server_seq() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.server_seq := nextval('public.sync_seq'); return new; end if;
  if current_setting('app.maintenance', true) = 'on' then return new; end if;
  new.server_seq := nextval('public.sync_seq');
  return new;
end $$;

${stores.map(table).join('\n')}
revoke all on all tables in schema public from anon;
-- Personne ne l'appelle directement : les 25 déclencheurs ci-dessus sont déjà créés, et PostgreSQL ne revérifie pas
-- le droit d'exécution d'une fonction de déclencheur au moment où il se déclenche.
revoke execute on function public.touch_server_seq() from public, anon, authenticated;

-- Envoi (spec § 3.4) : sous RLS, par élément, idempotent, jamais d'exception pour une ligne.
create or replace function public.sync_push(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stores constant text[] := array[${list(stores)}];
  keys constant jsonb := ${q(keys)}::jsonb;
  required constant jsonb := ${q(required)}::jsonb;
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
declare n integer; stores constant text[] := array[${list(stores)}];
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
declare n integer := 0; k integer; s text; stores constant text[] := array[${list(stores)}];
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
declare n integer := 0; k integer; s text; stores constant text[] := array[${list(stores)}];
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
`;
  const storage = ENTETE('0002_stockage.sql') + `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pages', 'pages', false, 52428800, array[${list(ALLOWED_MIME)}])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Chaque personne ne voit et n'écrit que son dossier <owner_id>/ ; delete réservé aux fonctions de purge et à la réécriture d'un objet corrompu (spec § 3.6).
create policy pages_select on storage.objects for select to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_insert on storage.objects for insert to authenticated with check (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_update on storage.objects for update to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text) with check (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_delete on storage.objects for delete to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace view private.storage_usage as
  select (storage.foldername(name))[1] as owner, count(*) as objets, sum((metadata->>'size')::bigint) as octets
  from storage.objects where bucket_id = 'pages' group by 1;
-- R15 : le « revoke all on all tables in schema private » de 0001 est antérieur à cette vue, il ne peut donc pas la
-- couvrir. Sans cette ligne, un projet dont les privilèges par défaut ne sont pas bornés au schéma public exposerait
-- par l'API les uuid des propriétaires et leur consommation.
revoke all on private.storage_usage from anon, authenticated;
`;
  return { tables, storage };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'supabase', 'migrations');
// Exécution directe seulement : importé par le test, le module n'écrit rien.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { tables, storage } = renderMigrations();
  const targets = [['0001_tables_et_regles.sql', tables], ['0002_stockage.sql', storage]];
  if (process.argv.includes('--check')) {
    let differ = false;
    for (const [name, content] of targets) {
      let current = null; try { current = readFileSync(path.join(dir, name), 'utf8'); } catch { /* absent */ }
      if (current !== content) { differ = true; console.error('différent du généré : ' + name); }
    }
    process.exit(differ ? 1 : 0);
  }
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of targets) { writeFileSync(path.join(dir, name), content); console.log('écrit : ' + name); }
}
