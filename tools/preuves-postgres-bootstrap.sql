-- Uniquement dans le cluster jetable identifié par le lanceur local.
-- Ces fonctions simulent le contexte des preuves ; elles ne vérifient aucun JWT réel.
begin;
create role anon nologin;
create role authenticated nologin;
create role supabase_auth_admin nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path='' as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub',
    nullif(current_setting('app.proof_uid',true),''))::uuid
$$;
create function auth.jwt() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,
    (select jsonb_build_object('sub',u.id::text,'email',u.email) from auth.users u where u.id=auth.uid()),
    '{}'::jsonb)
$$;
grant usage on schema auth to anon, authenticated, service_role;
revoke all on all functions in schema auth from public;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Droits de socle Supabase nécessaires aux migrations et aux preuves RLS réelles.
alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(bucket_id text, name text, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;

-- Registre seul : aucune tâche n’est planifiée ni exécutée automatiquement.
create schema cron;
create table cron.job(jobid bigserial primary key, jobname text unique not null, schedule text not null, command text not null);
create function cron.schedule(nom text, expression text, commande text) returns bigint language plpgsql as $$
declare resultat bigint;
begin
  insert into cron.job(jobname,schedule,command) values(nom,expression,commande)
  on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command
  returning jobid into resultat;
  return resultat;
end
$$;
commit;
