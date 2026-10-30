// À exécuter après la migration 0011 entière, jamais après des modules réinstallés séparément.
// Le catalogue n'est pas modifié ; la vraie écriture de témoin est annulée.
const sql=String.raw`\set ON_ERROR_STOP on
begin;
do $$declare f record;autorise boolean;n integer:=0;begin
 for f in select p.oid,p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l6_%' loop
  autorise:=f.signature::text in ('l6_validate_version_write(uuid,jsonb,jsonb)','l6_validate_journal_write(uuid,jsonb,text)','l6_apply_translation_command(jsonb)');
  if has_function_privilege('authenticated',f.oid,'execute') is distinct from autorise then raise exception 'ACL authenticated incorrecte : %',f.signature;end if;
  if has_function_privilege('anon',f.oid,'execute') or exists(select 1 from aclexplode(coalesce((select proacl from pg_proc where oid=f.oid),acldefault('f',(select proowner from pg_proc where oid=f.oid)))) a where a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'ACL anonyme/publique : %',f.signature;end if;
  n:=n+3;
 end loop;
 if n=0 then raise exception 'Migration0011 absente';end if;
 for f in select p.oid,p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_push_v2','l5_sync_push_v2','sync_capabilities') loop
  if not has_function_privilege('authenticated',f.oid,'execute') or has_function_privilege('anon',f.oid,'execute') or exists(select 1 from aclexplode(coalesce((select proacl from pg_proc where oid=f.oid),acldefault('f',(select proowner from pg_proc where oid=f.oid)))) a where a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'ACL RPC incorrecte : %',f.signature;end if;n:=n+3;
 end loop;
 raise notice '% contrôles ACL L6 réussis',n;
end $$;
set app.proof_uid='00000000-0000-0000-0000-000000000001';
insert into private.allowed_users(email)values('l1@example.test')on conflict do nothing;
insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000001','l1@example.test')on conflict do nothing;
set role authenticated;
insert into public.recipes(owner_id,id,data,updated_at)values(auth.uid(),'l6-acl-r','{"id":"l6-acl-r","availability":"available","original_title":"Pain"}',clock_timestamp());
insert into public.recipe_versions(owner_id,id,data,updated_at)values(auth.uid(),'l6-acl-v','{"id":"l6-acl-v","recipe_id":"l6-acl-r","ingredients":[],"ingredient_structure":{"format":1,"blocks":[]},"steps":[],"status":"proposed"}',clock_timestamp());
update public.recipe_versions set data=data||'{"status":"tested"}'::jsonb where id='l6-acl-v' and owner_id=auth.uid();
do $$begin if not exists(select 1 from public.recipe_versions where id='l6-acl-v' and data->>'status'='tested')then raise exception 'Garde version non exécutée';end if;end $$;
reset role;
rollback;
select 'L6 ACL : catalogue et écriture authenticated vérifiés' as bilan;
`;
process.stdout.write(sql);
