// 0014 : composition au build depuis les migrations historiques immuables. Le SQL livré contient
// les corps entiers : aucune lecture/réécriture de définition dans la base cible.
import {readFileSync} from 'node:fs';
import {SYNC_STORES} from '../src/model/schema.js';

function definition(nom,migration){
 const source=readFileSync(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8');
 const debut='create or replace function public.'+nom+'() returns trigger';
 const morceaux=source.split(debut);
 if(morceaux.length!==2)throw Error('Définition historique absente ou ambiguë : '+nom);
 const fin=morceaux[1].indexOf('$$;',morceaux[1].indexOf('$$')+2);
 if(fin<0)throw Error('Fin de définition historique absente : '+nom);
 return debut+morceaux[1].slice(0,fin+3);
}
function ajouterEnTete(corps,clauses){
 const debut=/\bbegin\b/i.exec(corps);
 if(!debut)throw Error('Corps de garde sans BEGIN');
 const fin=debut.index+debut[0].length;
 return corps.slice(0,fin)+'\n'+clauses+corps.slice(fin);
}

const maintenance=String.raw`
 -- Le ménage ne fait que vider le contenu d'une tombale : aucune identité, date ou séquence ne bouge.
 if tg_op='UPDATE' and pg_catalog.current_setting('app.maintenance',true)='on'
 and new.data='{}'::jsonb and old.deleted_at is not null
 and new.owner_id is not distinct from old.owner_id and new.id is not distinct from old.id
 and new.updated_at is not distinct from old.updated_at and new.deleted_at is not distinct from old.deleted_at
 and new.server_seq is not distinct from old.server_seq
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.purge_tombstones()'::pg_catalog.regprocedure)
 then return new;end if;
`;
const administration=String.raw`
 -- Les flags ne suffisent pas : rôle effectif du propriétaire et cible exacte de la purge administrative.
 if tg_op='DELETE' and pg_catalog.current_setting('app.purge',true)='on'
 and pg_catalog.current_setting('app.l1_purge_all',true)='on'
 and old.owner_id::text=pg_catalog.current_setting('app.admin_purge_owner',true)
 and current_user=(select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.admin_purge_owner(uuid)'::pg_catalog.regprocedure)
 then return old;end if;
`;
// 0013, puis 0012, puis 0011 ont chacun préfixé BEGIN : cet ordre est celui du catalogue 0013.
const exceptionsL6L8=[['inventory','l8_apply_inventory_command'],['cook_sessions','l7_apply_cooking_command'],['recipe_translations','l6_apply_translation_command']]
 .map(([table,fonction])=>` if tg_table_name='${table}' and current_user=(select pg_get_userbyid(proowner) from pg_proc where oid='public.${fonction}(jsonb)'::regprocedure) then if tg_op='DELETE' then return old;else return new;end if;end if;\n`).join('');

const verrouillage=String.raw`
-- Même fermeture de références que 0009, bornée avant tout verrou de recette/édition.
create or replace function public.l2_lock_rows(rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb;x jsonb;old_data jsonb;rids text[]:='{}';eids text[]:='{}';v text;s text;
begin
 if jsonb_typeof(rows) is distinct from 'array' then raise exception 'rows : lot invalide' using errcode='22023';end if;
 if jsonb_array_length(rows)>500 or octet_length(rows::text)>1048576 then raise exception 'trop de lignes' using errcode='22023';end if;
 perform public.l2_lock_owner();
 for r in select * from jsonb_array_elements(rows) loop
  if jsonb_typeof(r) is distinct from 'object'
  or r?'recipe_contexts' and jsonb_typeof(r->'recipe_contexts') is distinct from 'array'
  or r?'edition_contexts' and jsonb_typeof(r->'edition_contexts') is distinct from 'array'
  then raise exception 'rows : contexte invalide' using errcode='22023';end if;
  s:=r->>'store';old_data:=null;
  if s=any(array[/*__MAGASINS__*/]) then execute format('select data from public.%I where owner_id=auth.uid() and id=$1',s) into old_data using r->>'id';end if;
  rids:=rids||public.l1_recipe_ids(s,r->'data')||public.l1_recipe_ids(s,old_data)||array[r->>'recipe_id'];
  eids:=eids||public.l2_edition_ids(s,r->'data')||public.l2_edition_ids(s,old_data)||array[r->>'edition_id'];
  for x in select * from jsonb_array_elements(coalesce(r->'recipe_contexts','[]')) loop rids:=array_append(rids,x->>'recipe_id');end loop;
  for x in select * from jsonb_array_elements(coalesce(r->'edition_contexts','[]')) loop eids:=array_append(eids,x->>'edition_id');if x->>'recipe_id' is not null then rids:=array_append(rids,x->>'recipe_id');end if;end loop;
 end loop;
 rids:=array(select distinct a from unnest(rids) a where a is not null order by a);
 -- Le verrou de bibliothèque protège ces lectures ; leurs éditions comptent avant la première prise de ligne.
 eids:=eids||array(select data->>'edition_id' from public.recipes where owner_id=auth.uid() and id=any(rids));
 eids:=array(select distinct a from unnest(eids) a where a is not null order by a);
 -- Un même texte dans les deux espaces désigne deux verrous différents.
 if cardinality(rids)+cardinality(eids)>2000 then raise exception 'trop de lignes' using errcode='22023';end if;
 foreach v in array rids loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||v,0));end loop;
 foreach v in array eids loop perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':edition:'||v,0));end loop;
end $$;
revoke all on function public.l2_lock_rows(jsonb) from public,anon;
grant execute on function public.l2_lock_rows(jsonb) to authenticated;
`;

export function maintenanceSQL(){
 const magasins=SYNC_STORES.map(s=>"'"+s+"'").join(',');
 const gardes=[
  ['l1_guard_recipe','0008_corbeille_recettes.sql',exceptionsL6L8],
  ['l2_guard_write','0010_sources_index.sql',exceptionsL6L8],
  ['l5_guard_write','0010_sources_index.sql',''],
  ['l6_guard_version','0011_ingredients_traductions.sql',''],
  ['l6_guard_journal','0011_ingredients_traductions.sql',''],
  ['l7_guard_cooking','0012_cuisine_minuteurs.sql',''],
  ['l8_guard_inventory','0013_inventaire.sql',''],
 ].map(([nom,fichier,exceptions])=>ajouterEnTete(definition(nom,fichier),maintenance+administration+exceptions)).join('\n\n');
 return String.raw`-- 0014_maintenance_et_bornes.sql — généré par tools/generer-migrations.mjs.
-- Audit L0-L10, tâche 8. Fichier préparé seulement : aucune application distante automatique.
-- Corps complets composés au build ; migrations 0001–0013 inchangées.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Refus atomique avant tout changement si d'anciens transferts n'ont plus de compte.
-- Le préflight doit les signaler ; cette migration n'efface jamais silencieusement leur contenu.
do $$begin
 if exists(select 1 from private.mistu_source_transfers t where not exists(select 1 from auth.users u where u.id=t.owner_id))
 or exists(select 1 from private.mistu_source_transfer_parts p where not exists(select 1 from auth.users u where u.id=p.owner_id))
 then raise exception 'transferts orphelins : resoudre le preflight avant 0014' using errcode='23503';end if;
end $$;

-- L'administrateur purge explicitement une cible même retirée de allowed_users, sans usurper son JWT.
-- Le DELETE auth.users reste un geste séparé, après le succès de cette fonction.
create or replace function public.admin_purge_owner(uid uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare s text;n integer:=0;k integer;
 avant_purge text:=coalesce(pg_catalog.current_setting('app.purge',true),'');
 avant_l1 text:=coalesce(pg_catalog.current_setting('app.l1_purge_all',true),'');
 avant_cible text:=coalesce(pg_catalog.current_setting('app.admin_purge_owner',true),'');
begin
 if uid is null then raise exception 'proprietaire requis' using errcode='22023';end if;
 -- Un JWT tiers ferait ensuite verrouiller son propriétaire par les triggers statement : refuser
 -- avant toute prise de verrou, sans changer le JWT ni le verrouillage des écritures ordinaires.
 if auth.uid() is not null and auth.uid() is distinct from uid then raise exception 'contexte administrateur incompatible' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text||':library-write',0));
 perform pg_catalog.set_config('app.purge','on',true);
 perform pg_catalog.set_config('app.l1_purge_all','on',true);
 perform pg_catalog.set_config('app.admin_purge_owner',uid::text,true);
 begin
  delete from private.mistu_source_transfer_parts where owner_id=uid;get diagnostics k=row_count;n:=n+k;
  delete from private.mistu_source_transfers where owner_id=uid;get diagnostics k=row_count;n:=n+k;
  foreach s in array array[`+magasins+String.raw`] loop
   execute pg_catalog.format('delete from public.%I where owner_id=$1',s) using uid;
   get diagnostics k=row_count;n:=n+k;
  end loop;
 exception when others then
  perform pg_catalog.set_config('app.purge',avant_purge,true);
  perform pg_catalog.set_config('app.l1_purge_all',avant_l1,true);
  perform pg_catalog.set_config('app.admin_purge_owner',avant_cible,true);
  raise;
 end;
 perform pg_catalog.set_config('app.purge',avant_purge,true);
 perform pg_catalog.set_config('app.l1_purge_all',avant_l1,true);
 perform pg_catalog.set_config('app.admin_purge_owner',avant_cible,true);
 return n;
end $$;
revoke all on function public.admin_purge_owner(uuid) from public,anon,authenticated;
grant execute on function public.admin_purge_owner(uuid) to service_role;

`+gardes+'\n\n'+verrouillage.replace('/*__MAGASINS__*/',magasins)+String.raw`
-- Les déclencheurs existants restent attachés aux mêmes signatures ; aucune garde n'est désactivée.
revoke all on function public.l1_guard_recipe(),public.l2_guard_write(),public.l5_guard_write(),public.l6_guard_version(),public.l6_guard_journal(),public.l7_guard_cooking(),public.l8_guard_inventory() from public,anon,authenticated;

alter table private.mistu_source_transfers add constraint mistu_source_transfers_owner_fkey foreign key(owner_id) references auth.users(id) on delete cascade;
alter table private.mistu_source_transfer_parts add constraint mistu_source_transfer_parts_owner_fkey foreign key(owner_id) references auth.users(id) on delete cascade;
-- Le lien composite parts→header existant reste protégé ; les purges explicites suppriment les parts d'abord.
revoke all on private.mistu_source_transfers,private.mistu_source_transfer_parts from public,anon,authenticated;
revoke all on function public.l5_cleanup_transfers() from public,anon,authenticated;
grant execute on function public.l5_cleanup_transfers() to service_role;
select cron.schedule('cuisine-os-transferts','30 4 * * *','select public.l5_cleanup_transfers()');
notify pgrst,'reload schema';
commit;
`;
}
