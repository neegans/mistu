-- PostgreSQL local, compte factice autorisé. Toutes les lignes sont annulées.
begin;
do $$
declare r jsonb;c jsonb;ss jsonb;doc jsonb;page jsonb;base jsonb;stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');seq bigint;n integer:=0;refused boolean;
begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'Compte de preuve autorisé requis';end if;
 assert not public.l2_valid_exception('{"edition_id":"e","restored_from_edition":{"edition_id":"e","lifecycle_id":"c","extra":true}}'::jsonb),'sources 25 : exception à champs supplémentaires refusée comme le client';
 assert not public.l2_valid_exception('{"edition_id":"","restored_from_edition":{"edition_id":"","lifecycle_id":"c"}}'::jsonb),'sources 26 : association vide refusée comme le client';
 r:=public.sync_push(jsonb_build_array(
  jsonb_build_object('store','books','id','proof-s-book','data','{"id":"proof-s-book","title":"Livre"}'::jsonb,'updated_at',stamp),
  jsonb_build_object('store','book_editions','id','proof-s-ed','data','{"id":"proof-s-ed","book_id":"proof-s-book"}'::jsonb,'updated_at',stamp),
  jsonb_build_object('store','book_editions','id','proof-s-ed2','data','{"id":"proof-s-ed2","book_id":"proof-s-book"}'::jsonb,'updated_at',stamp),
  jsonb_build_object('store','recipes','id','proof-s-r','data','{"id":"proof-s-r","edition_id":"proof-s-ed"}'::jsonb,'updated_at',stamp)));
 assert jsonb_array_length(r->'accepted')=4,'sources 01 : parents et deux éditions';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','book_editions','id','proof-s-ed','op','lifecycle','entity','edition','edition_id','proof-s-ed','action','trash','operation_id','proof-s-trash','base_cycle_id',null,'mode','keep_recipes','at',stamp)));
 assert jsonb_array_length(r->'accepted')=1,'sources 02 : livre retiré, membre conservé';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','books','id','proof-s-book','data','{"id":"proof-s-book","title":"Correction depuis édition active"}'::jsonb,'updated_at',clock_timestamp()+interval '1 second','edition_contexts','[{"edition_id":"proof-s-ed2","expected_cycle_id":null}]'::jsonb)));
 assert jsonb_array_length(r->'accepted')+jsonb_array_length(r->'adjusted')=1,'sources 03 : bibliographie partagée reste modifiable depuis édition active';
 ss:='{"id":"proof-s-ss","edition_id":"proof-s-ed","recipe_ids":["proof-s-r"],"document_ids":["proof-s-doc"],"page_ids":["proof-s-page"]}'::jsonb;
 doc:='{"id":"proof-s-doc","edition_id":"proof-s-ed","scan_session_id":"proof-s-ss"}'::jsonb;
 page:='{"id":"proof-s-page","edition_id":"proof-s-ed","document_id":"proof-s-doc"}'::jsonb;
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','source_documents','id','proof-s-alone','data',doc||'{"id":"proof-s-alone"}'::jsonb,'updated_at',stamp,'recipe_id','proof-s-r','expected_cycle_id',null,'expected_edition_id','proof-s-ed','edition_contexts','[{"edition_id":"proof-s-ed","expected_cycle_id":"proof-s-trash","recipe_id":"proof-s-r"}]'::jsonb)));
 assert jsonb_array_length(r->'accepted')=0,'sources 04 : document isolé refusé même avec contexte membre';
 assert not exists(select 1 from public.source_documents where owner_id=auth.uid() and id='proof-s-alone'),'sources 05 : aucun document orphelin';
 c:=jsonb_build_object('store','scan_sessions','id','proof-s-ss','op','source_batch','operation_id','proof-s-op','recipe_id','proof-s-r','edition_id','proof-s-ed','base_cycle_id',null,'base_edition_cycle_id','proof-s-trash','base_session',null,'rows',jsonb_build_array(
  jsonb_build_object('store','scan_sessions','id','proof-s-ss','data',ss,'updated_at',stamp),jsonb_build_object('store','source_documents','id','proof-s-doc','data',doc,'updated_at',stamp),jsonb_build_object('store','source_pages','id','proof-s-page','data',page,'updated_at',stamp)));
 c:=jsonb_set(c,'{rows,1,data,texte}','""');
 c:=jsonb_set(c,'{rows,1,data,texte}',to_jsonb(repeat('x',524288-octet_length(c::text))));
 assert octet_length(c::text)=524288,'sources 23 : borne SQL exactement 512 Kio';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_set(c,'{rows,1,data,texte}',to_jsonb((c#>>'{rows,1,data,texte}')||'x'))));
 assert jsonb_array_length(r->'accepted')=0 and not exists(select 1 from public.scan_sessions where owner_id=auth.uid() and id='proof-s-ss'),'sources 24 : borne plus un octet refuse avant toute écriture';
 r:=public.sync_push_v2(jsonb_build_array(c));
 assert r->'accepted'->0->>'operation_id'='proof-s-op','sources 06 : groupe atomique accepté';
 assert jsonb_array_length(r->'accepted'->0->'server_rows')=3,'sources 07 : accusé porte trois états réels';
 assert exists(select 1 from public.source_documents where owner_id=auth.uid() and id='proof-s-doc') and exists(select 1 from public.source_pages where owner_id=auth.uid() and id='proof-s-page') and exists(select 1 from public.scan_sessions where owner_id=auth.uid() and id='proof-s-ss'),'sources 08 : trois écritures présentes';
 select server_seq into seq from public.source_pages where owner_id=auth.uid() and id='proof-s-page';
 r:=public.sync_push_v2(jsonb_build_array(c));
 assert jsonb_array_length(r->'accepted')=1,'sources 09 : réessai après accusé perdu accepté';
 assert (select server_seq=seq from public.source_pages where owner_id=auth.uid() and id='proof-s-page'),'sources 10 : réessai sans nouvelle écriture';
 select data into base from public.scan_sessions where owner_id=auth.uid() and id='proof-s-ss';
 ss:=base||'{"document_ids":["proof-s-doc","proof-s-doc2"],"page_ids":["proof-s-page","proof-s-page2"]}'::jsonb;
 doc:=doc||'{"id":"proof-s-doc2"}'::jsonb;page:=page||'{"id":"proof-s-page2","document_id":"proof-s-doc2"}'::jsonb;
 c:=c||jsonb_build_object('operation_id','proof-s-op2','base_session',base,'rows',jsonb_build_array(
  jsonb_build_object('store','scan_sessions','id','proof-s-ss','data',ss,'updated_at',clock_timestamp()+interval '1 second'),jsonb_build_object('store','source_documents','id','proof-s-doc2','data',doc,'updated_at',stamp),jsonb_build_object('store','source_pages','id','proof-s-page2','data',page,'updated_at','date invalide')));
 r:=public.sync_push_v2(jsonb_build_array(c));
 assert jsonb_array_length(r->'accepted')=0,'sources 11 : une date invalide refuse tout';
 assert not exists(select 1 from public.source_documents where owner_id=auth.uid() and id='proof-s-doc2') and (select data=base from public.scan_sessions where owner_id=auth.uid() and id='proof-s-ss'),'sources 12 : séance et document ne sont pas partiellement écrits';
 c:=jsonb_set(c,'{rows,2,updated_at}',to_jsonb(stamp));
 r:=public.sync_push_v2(jsonb_build_array(c));
 assert jsonb_array_length(r->'accepted')=1,'sources 13 : second complément même séance après CAS';
 assert (select jsonb_array_length(data->'page_ids')=2 from public.scan_sessions where owner_id=auth.uid() and id='proof-s-ss'),'sources 14 : anciennes et nouvelles pages conservées';
 r:=public.sync_push_v2(jsonb_build_array(c));assert jsonb_array_length(r->'accepted')=1,'sources 15 : second réessai idempotent';
 refused:=false;begin update public.source_pages set data=data||'{"printed_page":99}' where owner_id=auth.uid() and id='proof-s-page';exception when check_violation then refused:=true;end;
 assert refused,'sources 16 : REST ne remplace pas une ancienne page';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_set(c,'{base_edition_cycle_id}','"autre-cycle"')));
 assert r->'rejected'->0->>'reason'='cycle','sources 17 : base parent périmée refuse même réessai';
 assert r->'rejected'->0->'edition_server'->>'server_seq' is not null and r->'rejected'->0->'edition_server'->>'updated_at' is not null,'sources 18 : refus joint parent confirmé complet';
 refused:=false;begin update public.source_pages set data=data||'{"document_id":"proof-s-doc2"}' where owner_id=auth.uid() and id='proof-s-page';exception when check_violation then refused:=true;end;
 assert refused,'sources 19 : page existante ne change pas de document';
 refused:=false;begin update public.source_documents set data=data||'{"scan_session_id":null}' where owner_id=auth.uid() and id='proof-s-doc';exception when check_violation then refused:=true;end;
 assert refused,'sources 20 : document existant ne perd pas sa séance';
 r:=public.sync_push(jsonb_build_array(jsonb_build_object('store','scan_sessions','id','proof-s-ss','data',ss||'{"edition_id":null}'::jsonb,'updated_at',clock_timestamp()+interval '1 minute')));
 assert jsonb_array_length(r->'accepted')=0,'sources 21 : ancienne RPC ne détache pas séance du livre';
 r:=public.l1_sync_push_v2(jsonb_build_array(jsonb_build_object('store','source_pages','id','proof-s-page','data',page||'{"id":"proof-s-page","edition_id":null}'::jsonb,'updated_at',clock_timestamp()+interval '1 minute','recipe_id','proof-s-r','expected_cycle_id',null,'expected_edition_id','proof-s-ed','edition_contexts','[{"edition_id":"proof-s-ed","expected_cycle_id":"proof-s-trash"}]'::jsonb)));
 assert jsonb_array_length(r->'accepted')=0,'sources 22 : alias L1 ne détache pas une page';
 raise notice 'L2 sources SQL : 26 assertions réussies';
end $$;
rollback;
