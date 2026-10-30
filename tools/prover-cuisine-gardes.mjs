// Les lignes réservées sont des fixtures privilégiées ; les actes testés utilisent le rôle authenticated.
const q=s=>"'"+s.replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
const op='ck_op_'+'a'.repeat(64),date='2026-10-30T12:00:00.000Z',uid='00000000-0000-0000-0000-000000000001';
const timer={id:'l7-guard-t',timer_format:1,cook_session_id:'l7-guard-c',recipe_version_id:'v',step_id:'s',device_id:'d',duration_seconds:90,channel:'shortcut',requested_at:date,handoff_state:'requested',source_timer:{ordinal:0,seconds:90,seconds_max:null,sha256:'b'.repeat(64)},legacy_launch_id:null,recipe_title_snapshot:'Pain',task_label_snapshot:'Attendre',mirror:{format:1,started_at:date,deadline_at:'2026-10-30T12:01:30.000Z'},cooking_incarnation:op,cooking_revision:op,cooking_receipts:[],cooking_receipt_floor:0,created_at:date,updated_at:date};
const session={id:'l7-guard-c',status:'active',selected_version_ids:[],progress:{format:2,by_version:{}},cooking_state:{format:1,incarnation:op,active_revision:op,lang_revision:op,receipts:[],receipt_floor:0}};
let sql=String.raw`\set ON_ERROR_STOP on
begin;
set app.proof_uid='00000000-0000-0000-0000-000000000001';
insert into private.allowed_users(email)values('l1@example.test')on conflict do nothing;
insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000001','l1@example.test')on conflict do nothing;
-- Seulement le semis de fixtures : aucune commande utilisateur ne bénéficie de cette dérogation.
do $$declare r record;begin for r in select tgrelid::regclass tab,tgname from pg_trigger where tgname='l7_cooking_guard' loop execute format('alter table %s disable trigger %I',r.tab,r.tgname);end loop;end$$;
`;
for(const [store,row]of [['timer_launches',timer],['cook_sessions',session]])sql+=`insert into public.${store}(owner_id,id,data,updated_at) values('${uid}',${q(row.id)},${j(row)},clock_timestamp());\n`;
sql+=String.raw`do $$declare r record;begin for r in select tgrelid::regclass tab,tgname from pg_trigger where tgname='l7_cooking_guard' loop execute format('alter table %s enable trigger %I',r.tab,r.tgname);end loop;end$$;
create function pg_temp.refused(statement text,reason text)returns void language plpgsql security invoker as $$begin
 begin execute statement;exception when check_violation then if sqlerrm=reason then return;end if;raise;end;
 raise exception 'Garde non atteinte : %',statement;
end$$;
-- Politiques jetables : atteindre réellement le trigger DELETE, normalement masqué par RLS.
create policy l7_proof_delete on public.timer_launches for delete to authenticated using(owner_id=auth.uid());
create policy l7_proof_delete on public.cook_sessions for delete to authenticated using(owner_id=auth.uid());
set role authenticated;
`;
let n=0;const refuse=(statement,reason='cooking_reserved')=>{sql+=`select pg_temp.refused(${q(statement)},${q(reason)});\n`;n++;};
refuse("update public.timer_launches set data=data-'mirror' where id='l7-guard-t'");
refuse("update public.timer_launches set data=jsonb_set(data,'{mirror,deadline_at}','\"2026-10-30T12:02:30.000Z\"') where id='l7-guard-t'");
refuse("update public.timer_launches set data=jsonb_set(data,'{handoff_state}','\"opening\"') where id='l7-guard-t'");
refuse("update public.timer_launches set deleted_at=clock_timestamp() where id='l7-guard-t'");
refuse("delete from public.timer_launches where id='l7-guard-t'");
refuse("update public.cook_sessions set data=data-'cooking_state' where id='l7-guard-c'");
refuse("update public.cook_sessions set data=jsonb_set(data,'{status}','\"done\"') where id='l7-guard-c'");
refuse("update public.cook_sessions set deleted_at=clock_timestamp() where id='l7-guard-c'");
refuse("delete from public.cook_sessions where id='l7-guard-c'");
refuse(`insert into public.timer_launches(owner_id,id,data,updated_at)values(auth.uid(),'l7-guard-new',${j({...timer,id:'l7-guard-new'})},clock_timestamp())`);
refuse(`insert into public.cook_sessions(owner_id,id,data,updated_at)values(auth.uid(),'l7-guard-new-c',${j({...session,id:'l7-guard-new-c'})},clock_timestamp())`);
sql+=`update public.timer_launches set data=jsonb_set(data,'{updated_at}',${j('2026-10-30T12:02:00.000Z')}) where id='l7-guard-t';\nupdate public.cook_sessions set data=data where id='l7-guard-c';\n`;
refuse("update public.timer_launches set data=jsonb_set(data,'{created_at}','\"2026-10-30T12:02:00.000Z\"') where id='l7-guard-t'");
sql+="set app.purge='on';set app.l1_purge_all='on';\n";
refuse("delete from public.timer_launches where id='l7-guard-t'");
refuse("delete from public.cook_sessions where id='l7-guard-c'");
sql+="set app.purge='';set app.l1_purge_all='';\n";
sql+=`insert into public.timer_launches(owner_id,id,data,updated_at)values(auth.uid(),'l7-legacy-t','{"id":"l7-legacy-t","duration_seconds":90}',clock_timestamp());\nupdate public.timer_launches set data=data||'{"handoff_state":"siri"}'::jsonb where id='l7-legacy-t';\ndelete from public.timer_launches where id='l7-legacy-t';\ninsert into public.cook_sessions(owner_id,id,data,updated_at)values(auth.uid(),'l7-legacy-c','{"id":"l7-legacy-c","status":"active","selected_version_ids":[],"progress":{}}',clock_timestamp());\nupdate public.cook_sessions set data=data||'{"lang":"fr"}'::jsonb where id='l7-legacy-c';\n`;
sql+=String.raw`do $$declare f record;response jsonb;mutation jsonb;leg jsonb;counted integer:=0;begin
 for f in select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_push','sync_push_v2','l1_sync_push_v2','l2_sync_push_v2','l5_sync_push_v2','l6_sync_push_v2') loop
  leg:=jsonb_build_object('store','timer_launches','op','put','id','l7-rpc-'||f.proname,'data',jsonb_build_object('id','l7-rpc-'||f.proname,'duration_seconds',90),'updated_at',clock_timestamp()+interval '1 minute');
  execute format('select public.%I($1)',f.proname) into response using jsonb_build_array(leg);
  if jsonb_array_length(response->'accepted')<>1 or jsonb_array_length(response->'rejected')<>0 then raise exception 'Témoin legacy rejeté avant garde : % %',f.proname,response;end if;
  select jsonb_build_object('store','timer_launches','op','put','id',id,'data',data-'mirror','updated_at',clock_timestamp()+interval '1 minute') into mutation from public.timer_launches where owner_id=auth.uid() and id='l7-guard-t';
  execute format('select public.%I($1)',f.proname) into response using jsonb_build_array(mutation);
  if jsonb_array_length(response->'accepted')<>0 or jsonb_array_length(response->'rejected')<>1 or response->'rejected'->0->>'reason' is distinct from 'forme' then raise exception 'Ancien RPC non protégé : % %',f.proname,response;end if;
  if not exists(select 1 from public.timer_launches where owner_id=auth.uid() and id='l7-guard-t' and data?'mirror') then raise exception 'Ancre perdue par ancien RPC';end if;
  counted:=counted+3;
 end loop;
 raise notice '% contrôles anciens RPC et alias',counted;
end$$;
-- La vraie purge élevée garde son exception ; aucun drapeau utilisateur ne suffisait ci-dessus.
select public.sync_purge_all();
do $$begin if exists(select 1 from public.timer_launches where owner_id=auth.uid()) or exists(select 1 from public.cook_sessions where owner_id=auth.uid()) then raise exception 'Purge du propriétaire incomplète';end if;end$$;
`;
sql+=`reset role;rollback;select '${n} refus causaux + 7 écritures legacy/écho L7 vérifiés' as bilan;\n`;process.stdout.write(sql);
