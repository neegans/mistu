-- 0002_stockage.sql — généré par tools/generer-migrations.mjs ; ne pas éditer à la main.
-- Spec : docs/spec-compte-et-stockage-distant.md (v3). Aucune valeur personnelle ici : les adresses vont dans private.allowed_users par l'éditeur SQL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pages', 'pages', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Chaque personne ne voit et n'écrit que son dossier <owner_id>/ ; delete réservé aux fonctions de purge et à la réécriture d'un objet corrompu (spec § 3.6).
create policy pages_select on storage.objects for select to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_insert on storage.objects for insert to authenticated with check (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_update on storage.objects for update to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text) with check (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_delete on storage.objects for delete to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace view private.storage_usage as
  select (storage.foldername(name))[1] as owner, count(*) as objets, sum((metadata->>'size')::bigint) as octets
  from storage.objects where bucket_id = 'pages' group by 1;
