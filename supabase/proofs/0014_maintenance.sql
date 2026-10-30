-- Exclusivement dans le clone PostgreSQL local audit C (appelé par prover-purge-tombales.mjs).
-- Le prouveur fournit deux comptes factices, pg_temp.assertion et une transaction annulée.
select pg_temp.assertion(to_regprocedure('public.admin_purge_owner(uuid)') is not null,'admin_purge_owner disponible');
select pg_temp.assertion(not has_function_privilege('authenticated','public.admin_purge_owner(uuid)','execute'),'admin interdit a authenticated');
select pg_temp.assertion(not has_function_privilege('anon','public.admin_purge_owner(uuid)','execute'),'admin interdit a anon');
select pg_temp.assertion(has_function_privilege('service_role','public.admin_purge_owner(uuid)','execute'),'admin autorise au service');
select pg_temp.assertion((select prosecdef and (proconfig @> array['search_path=""'] or proconfig @> array['search_path=']) from pg_proc where oid='public.admin_purge_owner(uuid)'::regprocedure),'admin definer au search_path ferme');
select pg_temp.assertion(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.admin_purge_owner(uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'admin sans droit PUBLIC implicite');
select pg_temp.assertion(not pg_has_role('authenticated',(select proowner from pg_proc where oid='public.admin_purge_owner(uuid)'::regprocedure),'MEMBER') and not pg_has_role('anon',(select proowner from pg_proc where oid='public.admin_purge_owner(uuid)'::regprocedure),'MEMBER'),'clients sans appartenance au propriétaire');
select set_config('app.proof_uid','00000000-0000-0000-0000-000000000141',true),set_config('app.proof_email','audit-a@example.test',true);
set local role authenticated;
set local app.purge='on';set local app.l1_purge_all='on';set local app.admin_purge_owner='00000000-0000-0000-0000-000000000141';
select pg_temp.refus('select public.admin_purge_owner(''00000000-0000-0000-0000-000000000141''::uuid)','42501');
reset role;
select pg_temp.assertion((select count(*)=1 from cron.job where jobname='cuisine-os-transferts' and schedule='30 4 * * *' and command='select public.l5_cleanup_transfers()'),'nettoyage transferts planifié une fois');
select pg_temp.assertion((select count(distinct conrelid)=2 from pg_constraint where contype='f' and confrelid='auth.users'::regclass and conrelid in('private.mistu_source_transfers'::regclass,'private.mistu_source_transfer_parts'::regclass) and confdeltype='c'),'cascade auth sur les deux tables privées');
