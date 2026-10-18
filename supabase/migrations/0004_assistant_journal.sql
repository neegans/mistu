-- 0004 — journal de la passerelle de l'assistant (spec 2026-10-18-passerelle-assistant § 4). Compteurs seulement : jamais de contenu.
-- Aucun client ne lit ni n'écrit cette table : RLS activée SANS règle + revoke ; seule la fonction « assistant » écrit, par la clé secrète du projet.
-- La réservation d'un appel (verrou, comptage, insertion) est UNE fonction SQL atomique, assistant_reserver : sans elle, deux appels simultanés passent le même comptage.
begin;
create table public.assistant_journal (
  id bigserial primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  outil text not null check (outil in ('recherche-web', 'creation', 'extraction')),
  statut integer not null,
  jetons_entree integer,
  jetons_sortie integer,
  duree_ms integer not null default 0,
  octets integer,
  jour date not null,
  cree_le timestamptz not null default now()
);
create index assistant_journal_owner_jour on public.assistant_journal (owner_id, jour);
alter table public.assistant_journal enable row level security;
revoke all on public.assistant_journal from anon, authenticated;
revoke all on sequence public.assistant_journal_id_seq from anon, authenticated;
create view public.assistant_usage_jour with (security_invoker = true) as
  select owner_id, jour, count(*) as appels, coalesce(sum(jetons_entree), 0) as jetons_entree, coalesce(sum(jetons_sortie), 0) as jetons_sortie
  from public.assistant_journal group by owner_id, jour;
revoke all on public.assistant_usage_jour from anon, authenticated;
-- Réservation atomique d'un appel : verrou consultatif par compte, comptage du jour UTC, insertion de la ligne « en vol » (statut 0).
-- security INVOKER : seule la clé secrète (service_role) a les droits sur la table ; un EXECUTE qui fuirait tomberait en 42501.
create function public.assistant_reserver(p_owner uuid, p_outil text, p_octets integer, p_quota integer)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_jour date := (now() at time zone 'utc')::date; v_n bigint; v_id bigint;
begin
  if p_owner is null or p_quota is null or p_quota < 1 then return null; end if;
  perform pg_advisory_xact_lock(hashtext('assistant_journal'), hashtext(p_owner::text));
  select count(*) into v_n from public.assistant_journal where owner_id = p_owner and jour = v_jour;
  if v_n >= p_quota then return null; end if;
  insert into public.assistant_journal (owner_id, outil, statut, octets, jour) values (p_owner, p_outil, 0, p_octets, v_jour) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.assistant_reserver(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.assistant_reserver(uuid, text, integer, integer) to service_role;
commit;
