-- 0004 — journal de la passerelle de l'assistant (spec 2026-10-18-passerelle-assistant § 4). Compteurs seulement : jamais de contenu.
-- Aucun client ne lit ni n'écrit cette table : RLS activée SANS règle + revoke ; seule la fonction « assistant » écrit, par la clé secrète du projet.
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
commit;
