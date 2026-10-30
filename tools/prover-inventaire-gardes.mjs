// Fixtures privilégiées, actes causaux sous authenticated ; aucune donnée privée.
const q=s=>"'"+s.replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
const uid='00000000-0000-0000-0000-000000000001',op='iv_op_'+'a'.repeat(64),date='2026-10-30T12:00:00.000Z';
const lot={id:'l8-guard-i',label:'Soupe',stock:{format:1,unit:'portion',initial:4,remaining:3,state:'available'},stock_revision:op,stock_last_action:null,stock_receipts:[],stock_receipt_floor:0,created_at:date,updated_at:date};
let sql=String.raw`\set ON_ERROR_STOP on
begin;
set app.proof_uid='00000000-0000-0000-0000-000000000001';
insert into private.allowed_users(email)values('l1@example.test')on conflict do nothing;
insert into auth.users(id,email)values('00000000-0000-0000-0000-000000000001','l1@example.test')on conflict do nothing;
-- Dérogation du semis uniquement, retirée avant toute action testée.
do $$declare r record;begin for r in select tgname from pg_trigger where tgrelid='public.inventory'::regclass and tgname='l8_inventory_guard' loop execute format('alter table public.inventory disable trigger %I',r.tgname);end loop;end$$;
`;
for(const row of [lot,{id:'l8-guard-invalid',stock:null}])sql+=`insert into public.inventory(owner_id,id,data,updated_at) values('${uid}',${q(row.id)},${j(row)},clock_timestamp());\n`;
sql+=String.raw`do $$declare r record;begin for r in select tgname from pg_trigger where tgrelid='public.inventory'::regclass and tgname='l8_inventory_guard' loop execute format('alter table public.inventory enable trigger %I',r.tgname);end loop;end$$;
create function pg_temp.refused(statement text,reason text)returns void language plpgsql security invoker as $$begin
 begin execute statement;exception when check_violation then if sqlerrm=reason then return;end if;raise;end;
 raise exception 'Garde non atteinte : %',statement;
end$$;
-- Atteindre le DELETE réel : une RLS qui ne sélectionne rien ne prouve pas le garde.
create policy l8_proof_delete on public.inventory for delete to authenticated using(owner_id=auth.uid());
set role authenticated;
`;
let n=0;const refuse=(statement,reason='inventory_reserved')=>{sql+=`select pg_temp.refused(${q(statement)},${q(reason)});\n`;n++;};
refuse("update public.inventory set data=data-'stock' where id='l8-guard-i'");
refuse("update public.inventory set data=data-array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'] where id='l8-guard-i'");
refuse("update public.inventory set data=jsonb_set(data,'{stock,remaining}','2') where id='l8-guard-i'");
refuse("update public.inventory set data=data||'{\"notes\":\"Nouvelle note\"}' where id='l8-guard-i'");
refuse("update public.inventory set data=jsonb_set(data,'{created_at}','\"2026-10-30T12:02:00.000Z\"') where id='l8-guard-i'");
refuse("update public.inventory set deleted_at=clock_timestamp() where id='l8-guard-i'");
refuse("delete from public.inventory where id='l8-guard-i'");
refuse("update public.inventory set data=data where id='l8-guard-invalid'");
refuse("update public.inventory set data=data-'stock' where id='l8-guard-invalid'");
refuse("delete from public.inventory where id='l8-guard-invalid'");
refuse(`insert into public.inventory(owner_id,id,data,updated_at)values(auth.uid(),'l8-guard-new',${j({...lot,id:'l8-guard-new'})},clock_timestamp())`);
for(const marker of ['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'])refuse(`insert into public.inventory(owner_id,id,data,updated_at)values(auth.uid(),'l8-guard-marker',${j({id:'l8-guard-marker',[marker]:null})},clock_timestamp())`);
sql+=`update public.inventory set data=jsonb_set(data,'{updated_at}',${j('2026-10-30T12:02:00.000Z')}) where id='l8-guard-i';\nupdate public.inventory set data=data where id='l8-guard-i';\n`;
sql+="set app.purge='on';set app.l1_purge_all='on';\n";
refuse("delete from public.inventory where id='l8-guard-i'");
sql+="set app.purge='';set app.l1_purge_all='';\n";
sql+=`insert into public.inventory(owner_id,id,data,updated_at)values(auth.uid(),'l8-legacy-i','{"id":"l8-legacy-i","label":"Ancien lot","quantity_text":"3 boîtes"}',clock_timestamp());\nupdate public.inventory set data=data||'{"notes":"Documentaire"}'::jsonb where id='l8-legacy-i';\ndelete from public.inventory where id='l8-legacy-i';\n`;
sql+=String.raw`do $$declare f record;response jsonb;mutation jsonb;leg jsonb;counted integer:=0;begin
 for f in select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sync_push','sync_push_v2','l1_sync_push_v2','l2_sync_push_v2','l5_sync_push_v2','l6_sync_push_v2','l7_sync_push_v2') loop
  leg:=jsonb_build_object('store','inventory','op','put','id','l8-rpc-'||f.proname,'data',jsonb_build_object('id','l8-rpc-'||f.proname,'label','Ancien lot'),'updated_at',clock_timestamp()+interval '1 minute');
  execute format('select public.%I($1)',f.proname) into response using jsonb_build_array(leg);
  if jsonb_array_length(response->'accepted')<>1 or jsonb_array_length(response->'rejected')<>0 then raise exception 'Témoin legacy rejeté avant garde : % %',f.proname,response;end if;
  select jsonb_build_object('store','inventory','op','put','id',id,'data',data-array['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor'],'updated_at',clock_timestamp()+interval '1 minute') into mutation from public.inventory where owner_id=auth.uid() and id='l8-guard-i';
  execute format('select public.%I($1)',f.proname) into response using jsonb_build_array(mutation);
  if jsonb_array_length(response->'accepted')<>0 or jsonb_array_length(response->'rejected')<>1 or response->'rejected'->0->>'reason' is distinct from 'forme' then raise exception 'Ancien RPC non protégé : % %',f.proname,response;end if;
  if not exists(select 1 from public.inventory where owner_id=auth.uid() and id='l8-guard-i' and data?'stock') then raise exception 'Stock perdu par ancien RPC';end if;
  counted:=counted+3;
 end loop;
 raise notice '% contrôles anciens RPC et alias',counted;
end$$;
select public.sync_purge_all();
do $$begin if exists(select 1 from public.inventory where owner_id=auth.uid()) then raise exception 'Purge du propriétaire incomplète';end if;end$$;
`;
sql+=`reset role;rollback;select '${n} refus causaux + 5 écritures legacy/écho L8 vérifiés' as bilan;\n`;process.stdout.write(sql);
