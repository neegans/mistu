-- Protéger la conservation après un cycle du livre, y compris édition restaurée. Compte factice autorisé.
begin;
do $$
declare r jsonb;c jsonb;d jsonb;target text;key text;rpc text;refused boolean;preserved boolean;touched integer;n integer:=3; stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 r:=public.sync_push(jsonb_build_array(
 jsonb_build_object('store','books','id','review-t-book','data','{"id":"review-t-book"}'::jsonb,'updated_at',stamp),
 jsonb_build_object('store','book_editions','id','review-t-ed','data','{"id":"review-t-ed","book_id":"review-t-book"}'::jsonb,'updated_at',stamp),
 jsonb_build_object('store','recipes','id','review-t-r','data','{"id":"review-t-r","edition_id":"review-t-ed"}'::jsonb,'updated_at',stamp),
 jsonb_build_object('store','recipe_versions','id','review-t-v','data','{"id":"review-t-v","recipe_id":"review-t-r"}'::jsonb,'updated_at',stamp),
 jsonb_build_object('store','scan_sessions','id','review-t-ss','data','{"id":"review-t-ss","edition_id":"review-t-ed","recipe_ids":["review-t-r"],"document_ids":[],"page_ids":[]}'::jsonb,'updated_at',stamp),
 jsonb_build_object('store','source_documents','id','review-t-doc','data','{"id":"review-t-doc","edition_id":"review-t-ed"}'::jsonb,'updated_at',stamp),
 jsonb_build_object('store','source_pages','id','review-t-page','data','{"id":"review-t-page","edition_id":"review-t-ed","document_id":"review-t-doc"}'::jsonb,'updated_at',stamp)));
 assert jsonb_array_length(r->'accepted')=7,'setup';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','book_editions','id','review-t-ed','entity','edition','edition_id','review-t-ed','op','lifecycle','action','trash','mode','with_recipes','base_cycle_id',null,'operation_id','review-t-trash','at',stamp)));
 assert jsonb_array_length(r->'accepted')=1,'trash';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','book_editions','id','review-t-ed','entity','edition','edition_id','review-t-ed','op','lifecycle','action','restore','base_cycle_id','review-t-trash','operation_id','review-t-restore','at',stamp)));
 assert jsonb_array_length(r->'accepted')=1,'restore';
 for target,key in select * from (values ('recipes','review-t-r'),('recipe_versions','review-t-v'),('source_documents','review-t-doc'),('source_pages','review-t-page'),('scan_sessions','review-t-ss')) x loop
  execute format('select data from public.%I where owner_id=auth.uid() and id=$1',target) into d using key;
  c:=jsonb_build_object('store',target,'id',key,'data',d,'deleted',true,'updated_at',clock_timestamp()+interval '1 minute','recipe_id','review-t-r','expected_cycle_id',null,'expected_edition_id','review-t-ed','edition_contexts','[{"edition_id":"review-t-ed","expected_cycle_id":"review-t-restore"}]'::jsonb);
  foreach rpc in array array['sync_push_v2','l1_sync_push_v2','sync_push'] loop
   execute format('select public.%I($1)',rpc) into r using jsonb_build_array(c);
   assert jsonb_array_length(r->'accepted')+jsonb_array_length(r->'adjusted')=0,'Tombale RPC refusée : '||rpc||'/'||target;n:=n+1;
  end loop;
  refused:=false;begin execute format('update public.%I set deleted_at=clock_timestamp() where owner_id=auth.uid() and id=$1',target) using key;exception when check_violation then refused:=true;end;
  assert refused,'Tombale REST refusée : '||target;n:=n+1;
  refused:=false;touched:=0;begin execute format('delete from public.%I where owner_id=auth.uid() and id=$1',target) using key;get diagnostics touched=row_count;exception when check_violation then refused:=true;end;
  assert refused or touched=0,'DELETE REST refusé : '||target;n:=n+1;
  execute format('select deleted_at is null and data=$2 from public.%I where owner_id=auth.uid() and id=$1',target) into preserved using key,d;
  assert preserved,'Ligne et contenu conservés : '||target;n:=n+1;
 end loop;
 raise notice 'L2 tombales SQL : % assertions réussies',n;
end $$;
rollback;
