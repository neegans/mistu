-- Preuve 0002 — spec § 7.2 (partie stockage). À coller dans l'éditeur SQL APRÈS `0002_stockage.sql`.
-- Aucun jeton à remplacer : rien ici ne touche à une adresse.
--
-- Cette preuve est DÉCLARATIVE par nature, et c'est voulu : elle lit le seau, ses limites, les quatre règles et la
-- vue. Les refus RÉELS — objet déposé hors de son dossier `<owner_id>/`, type hors de la liste blanche, fichier de
-- plus de 50 Mo — sont prononcés par l'API de téléversement, pas par une requête SQL : ils se jouent DEPUIS L'APP,
-- au lot L4 (§ 8), et c'est là qu'ils seront consignés. Ne pas conclure d'ici qu'ils fonctionnent.
--
-- R12 : ni `sync_purge` ni `sync_purge_all` ne suppriment d'objet. L'app supprime l'objet par l'API de
-- téléversement (règle `pages_delete`) PUIS appelle la fonction de purge : c'est le seul ordre qui ne laisse pas
-- d'octets orphelins dans le seau. Rien à prouver en SQL, tout à prouver en L5.
--
-- L'éditeur SQL n'affiche qu'UN tableau : celui du dernier `select`. Ce script n'en a donc qu'un, à la fin.
-- Colle-le dans `supabase/proofs/RESULTATS-<projet>.md`.

begin;
create temporary table preuve (ordre numeric primary key, etape text, attendu text, obtenu text, ok boolean);

-- 1. Le seau.
insert into pg_temp.preuve
select 1.01, 'seau pages : prive, 50 Mo, six types', 'false / 52428800 / 6',
  b.public::text || ' / ' || b.file_size_limit::text || ' / ' || coalesce(array_length(b.allowed_mime_types, 1), 0)::text,
      b.public = false
  and b.file_size_limit = 52428800
  and b.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip']
from storage.buckets b where b.id = 'pages';
insert into pg_temp.preuve
select 1.02, 'liste blanche des types, dans lordre de src/sync/mime.js', 'informatif',
  array_to_string(b.allowed_mime_types, ', '), true
from storage.buckets b where b.id = 'pages';
insert into pg_temp.preuve
select 1.03, 'un seul seau nomme pages', '1', count(*)::text, count(*) = 1 from storage.buckets where id = 'pages';

-- 2. Les quatre règles. Un seau privé sans règle n'est pas « fermé » : il est inutilisable. Un seau privé avec une
--    règle trop large est ouvert à tout le monde. Les deux se lisent ici.
insert into pg_temp.preuve
select 2.01, 'les quatre regles pages_* existent', '4',
  count(*) || ' : ' || coalesce(string_agg(policyname, ', ' order by policyname), 'aucune'), count(*) = 4
from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pages_%';
insert into pg_temp.preuve
select 2.02, 'les quatre commandes sont couvertes, pour authenticated seulement', 'DELETE, INSERT, SELECT, UPDATE / authenticated',
  coalesce(string_agg(cmd, ', ' order by cmd), 'aucune') || ' / ' || coalesce(string_agg(distinct roles::text, ' '), 'aucun'),
  count(distinct cmd) = 4 and bool_and(roles::text[] = array['authenticated'])
from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pages_%';
insert into pg_temp.preuve
select 2.03, 'chaque regle pages_* porte is_allowed ET le dossier du proprietaire', 'true',
  bool_and(cond)::text, bool_and(cond)
from (
  select coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%is_allowed%'
     and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%foldername%'
     and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%uid%' as cond
  from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'pages_%'
) t;
insert into pg_temp.preuve
select 2.04, 'RLS active sur storage.objects (sinon les regles ne servent a rien)', 'true',
  relrowsecurity::text, relrowsecurity from pg_class where oid = 'storage.objects'::regclass;
insert into pg_temp.preuve
select 2.05, 'aucune autre regle que les quatre sur storage.objects (informatif : Supabase en pose parfois)', 'informatif',
  coalesce(string_agg(policyname, ', ' order by policyname), 'aucune'), true
from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname not like 'pages_%';

-- 3. La vue de suivi de l'espace.
insert into pg_temp.preuve
select 3.01, 'la vue private.storage_usage existe', '1', count(*)::text, count(*) = 1
from pg_views where schemaname = 'private' and viewname = 'storage_usage';
-- Si 3.02 est faux : `0002` crée la vue APRÈS le « revoke all on all tables in schema private » de `0001`, qui ne
-- peut donc pas la couvrir. Correctif à demander à la tâche 3 : ajouter en fin de `0002`
--   revoke all on private.storage_usage from anon, authenticated;
insert into pg_temp.preuve
select 3.02, 'la vue nest pas exposee a lAPI', 'false / false',
  has_table_privilege('authenticated', 'private.storage_usage', 'select')::text || ' / ' || has_table_privilege('anon', 'private.storage_usage', 'select')::text,
      not has_table_privilege('authenticated', 'private.storage_usage', 'select')
  and not has_table_privilege('anon', 'private.storage_usage', 'select');
insert into pg_temp.preuve
select 3.03, 'etat du seau (informatif : vide avant L4)', 'aucune ligne tant quaucune page nest televersee',
  coalesce((select string_agg(owner || ' : ' || objets || ' objets, ' || octets || ' octets', ' | ') from private.storage_usage), 'aucune ligne'),
  true;

-- BILAN : une seule ligne à lire.
insert into pg_temp.preuve
select 999, 'BILAN', 'aucun verdict faux',
  (select count(*) from pg_temp.preuve where ok is not true)::text || ' faux sur ' || (select count(*) from pg_temp.preuve)::text,
  (select count(*) from pg_temp.preuve where ok is not true) = 0;

select ordre, etape, attendu, obtenu, ok from pg_temp.preuve order by ordre;

-- Lecture seule : rien n'a été écrit. Le rollback ne fait que retirer la table des verdicts.
rollback;
