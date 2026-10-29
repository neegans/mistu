-- Base de test seulement : données factices, transaction intégralement annulée.
begin;
do $$
declare r jsonb;stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');refused boolean;
begin
 if auth.uid() is null or not public.is_allowed() then raise exception 'Compte de preuve autorisé requis';end if;
 if exists(select 1 from public.books where owner_id=auth.uid() and id='proof-l2-book') then raise exception 'Fixture déjà présente';end if;
 r:=public.sync_push(jsonb_build_array(
  jsonb_build_object('store','books','id','proof-l2-book','data','{"id":"proof-l2-book","title":"Livre de preuve"}'::jsonb,'updated_at',stamp),
  jsonb_build_object('store','book_editions','id','proof-l2-ed','data','{"id":"proof-l2-ed","book_id":"proof-l2-book"}'::jsonb,'updated_at',stamp),
  jsonb_build_object('store','recipes','id','proof-l2-r','data','{"id":"proof-l2-r","edition_id":"proof-l2-ed","original_title":"Pain"}'::jsonb,'updated_at',stamp)));
 assert jsonb_array_length(r->'accepted')=3,'01 : création initiale parents avant membre';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','book_editions','id','proof-l2-ed','op','lifecycle','entity','edition','edition_id','proof-l2-ed','action','trash','operation_id','l2-trash','base_cycle_id',null,'mode','with_recipes','at',stamp)));
 assert r->'accepted'->0->>'operation_id'='l2-trash','02 : retrait parent';
 assert (select data->>'trash_mode'='with_recipes' from public.book_editions where owner_id=auth.uid() and id='proof-l2-ed'),'03 : mode conservé';
 assert (select data->>'lifecycle_id' is null from public.recipes where owner_id=auth.uid() and id='proof-l2-r'),'04 : aucun cycle enfant modifié';
 r:=public.sync_push(jsonb_build_array(jsonb_build_object('store','recipes','id','proof-l2-r','data','{"id":"proof-l2-r","edition_id":"proof-l2-ed","original_title":"Ancienne copie"}'::jsonb,'updated_at',clock_timestamp()+interval '1 minute')));
 assert jsonb_array_length(r->'accepted')=0,'05 : ancien client refusé après retrait parent';
 refused:=false;begin update public.book_editions set data=data-'lifecycle_id'-'trashed_at'-'trash_mode' where owner_id=auth.uid() and id='proof-l2-ed';exception when check_violation then refused:=true;end;
 assert refused,'06 : REST ne restaure pas parent';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','recipes','id','proof-l2-r','op','lifecycle','entity','recipe','recipe_id','proof-l2-r','edition_id','proof-l2-ed','action','restore_from_edition','operation_id','l2-member','base_cycle_id',null,'base_edition_cycle_id','l2-trash','at',stamp)));
 assert r->'accepted'->0->>'operation_id'='l2-member','07 : restauration membre';
 assert r->'accepted'->0->'edition_server'->'data'->>'lifecycle_id'='l2-trash','08 : état parent joint';
 assert (select data#>>'{restored_from_edition,lifecycle_id}'='l2-trash' from public.recipes where owner_id=auth.uid() and id='proof-l2-r'),'09 : exception liée au retrait exact';
 assert (select data->>'trashed_at' is not null from public.book_editions where owner_id=auth.uid() and id='proof-l2-ed'),'10 : parent reste retiré';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','recipes','id','proof-l2-r','recipe_id','proof-l2-r','expected_cycle_id','l2-member','expected_edition_id','proof-l2-ed','edition_contexts','[{"edition_id":"proof-l2-ed","expected_cycle_id":"l2-trash"}]'::jsonb,'data','{"id":"proof-l2-r","edition_id":"proof-l2-ed","original_title":"Correction"}'::jsonb,'updated_at',clock_timestamp()+interval '1 second')));
 assert jsonb_array_length(r->'accepted')=1,'11 : membre restauré éditable';
 assert (select data#>>'{restored_from_edition,lifecycle_id}'='l2-trash' from public.recipes where owner_id=auth.uid() and id='proof-l2-r'),'12 : put ne retire pas exception';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','book_editions','id','proof-l2-ed','op','lifecycle','entity','edition','edition_id','proof-l2-ed','action','restore','operation_id','l2-return','base_cycle_id','l2-trash','at',stamp)));
 assert jsonb_array_length(r->'accepted')=1,'13 : restauration groupe';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','book_editions','id','proof-l2-ed','op','lifecycle','entity','edition','edition_id','proof-l2-ed','action','trash','operation_id','l2-second','base_cycle_id','l2-return','mode','with_recipes','at',stamp)));
 assert jsonb_array_length(r->'accepted')=1,'14 : nouveau retrait';
 assert not (select public.l2_recipe_active(r.data,e.data) from public.recipes r join public.book_editions e on e.owner_id=r.owner_id and e.id=r.data->>'edition_id' where r.owner_id=auth.uid() and r.id='proof-l2-r'),'15 : ancienne exception inopérante';
 r:=public.sync_push_v2(jsonb_build_array(jsonb_build_object('store','recipes','id','proof-l2-r','op','lifecycle','entity','recipe','recipe_id','proof-l2-r','edition_id','proof-l2-ed','action','restore_from_edition','operation_id','l2-member','base_cycle_id',null,'base_edition_cycle_id','l2-trash','at',stamp)));
 assert r->'accepted'->0->>'operation_id'='l2-member' and r->'accepted'->0->'edition_server'->'data'->>'lifecycle_id'='l2-second','16 : réessai accuse sans réactiver ancienne exception';
 refused:=false;begin perform public.sync_purge('books','proof-l2-book');exception when check_violation then refused:=true;end;
 assert refused,'17 : ancien C09 ne détruit pas parent bibliographique';
 refused:=false;begin perform public.sync_purge('book_editions','proof-l2-ed');exception when check_violation then refused:=true;end;
 assert refused,'18 : purge individuelle édition refusée';
 assert public.sync_capabilities()->>'edition_lifecycle'='1','19 : capacité distincte';
 assert public.sync_purge_all()>0,'20 : effacement global explicite conservé';
 raise notice 'L2 SQL : 20 assertions réussies';
end $$;
rollback;
