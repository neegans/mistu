// Composition complète 0001→0012, sans réinstaller un module isolé avant ce contrôle.
process.stdout.write(String.raw`\set ON_ERROR_STOP on
begin;
do $$declare f record;expected boolean;expected_execute boolean;n integer:=0;begin
 for f in select p.oid,p.oid::regprocedure as signature,p.prosecdef,p.proowner,p.proconfig,p.proname,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'l7_%' loop
  expected:=f.signature::text in ('l7_validate_cooking_write(text,jsonb,jsonb)','l7_apply_cooking_command(jsonb)');
  -- L8 conserve le dispatcher L7 sous cet alias invoker ; il ne devient pas un helper élevé.
  expected_execute:=expected or f.signature::text='l7_sync_push_v2(jsonb)';
  if has_function_privilege('authenticated',f.oid,'execute') is distinct from expected_execute then raise exception 'ACL authenticated incorrecte : %',f.signature;end if;
  if has_function_privilege('anon',f.oid,'execute') or exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'ACL anonyme/publique : %',f.signature;end if;
  if f.prosecdef is distinct from expected then raise exception 'Élévation inattendue : %',f.signature;end if;
  if f.proconfig is null or not ('search_path=""'=any(f.proconfig) or 'search_path='=any(f.proconfig)) then raise exception 'search_path non fermé : % %',f.signature,f.proconfig;end if;
  if pg_has_role('authenticated',f.proowner,'MEMBER') or pg_has_role('anon',f.proowner,'MEMBER') then raise exception 'Rôle client membre du propriétaire : %',f.signature;end if;
  n:=n+5;
 end loop;
 if n=0 then raise exception 'Migration0012 absente';end if;
 for f in select p.oid,p.oid::regprocedure as signature,p.proowner,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_push','sync_push_v2','l1_sync_push_v2','l2_sync_push_v2','l5_sync_push_v2','l6_sync_push_v2','sync_capabilities') loop
  if not has_function_privilege('authenticated',f.oid,'execute') or has_function_privilege('anon',f.oid,'execute') or exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'ACL RPC incorrecte : %',f.signature;end if;n:=n+3;
 end loop;
 if (select count(*) from pg_trigger where tgname='l7_cooking_guard' and tgenabled='O')<>2 then raise exception 'Deux gardes cuisine actives requises';end if;n:=n+1;
 raise notice '% contrôles ACL L7 réussis',n;
end$$;
set app.proof_uid='00000000-0000-0000-0000-000000000001';
insert into private.allowed_users(email)values('l1@example.test')on conflict do nothing;
insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000001','l1@example.test')on conflict do nothing;
set role authenticated;
do $$begin if public.sync_capabilities()->'cooking_persistence' is distinct from '1'::jsonb then raise exception 'Capacité cuisine absente';end if;end$$;
insert into public.timer_launches(owner_id,id,data,updated_at)values(auth.uid(),'l7-acl-legacy','{"id":"l7-acl-legacy","duration_seconds":90}',clock_timestamp());
update public.timer_launches set data=data||'{"handoff_state":"siri"}'::jsonb where id='l7-acl-legacy';
do $$begin if not exists(select 1 from public.timer_launches where owner_id=auth.uid() and id='l7-acl-legacy' and data->>'handoff_state'='siri') then raise exception 'Écriture réelle authenticated non exécutée';end if;end$$;
reset role;rollback;select 'ACL L7 : composition et écriture réelle authenticated vérifiées' as bilan;
`);
