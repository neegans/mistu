// À exécuter exclusivement dans une base PostgreSQL jetable : éprouve aussi la purge explicite du compte.
import * as F from '../src/domain/sources-format.js';
import {SYNC_STORES} from '../src/model/schema.js';
const lit=s=>"'"+s.replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';
const owner='00000000-0000-0000-0000-000000000001',autre='00000000-0000-0000-0000-000000000002';
const page={id:'guard-page',edition_id:null,document_id:null,sha256:'a'.repeat(64),rotation:0};
const session={id:'guard-session',edition_id:null,status:'open',page_ids:[page.id],document_ids:[],source_state:{format:1,revision:'guard-token',active_page_ids:[page.id]}};
const capture={format:2,session_id:session.id,source_state_revision:'guard-token',selected_page_ids:[page.id],pages:[{id:page.id,identity_sha256:await F.empreinteSources(F.projectionIdentitePage(page)),annotation_sha256:await F.empreinteSources(F.projectionAnnotationPage(page)),preparation_version:'index-image-v1',zone:{kind:'full',x:0,y:0,width:100,height:100,source_width:100,source_height:100},sent_image_sha256:'b'.repeat(64)}]};
const journal={id:'guard-index',kind:'index',recipe_id:null,edition_id:null,scan_session_id:session.id,page_ids:[page.id],owner_id:owner,status:'a_lancer',source_capture:capture,index_call:{format:1,series_id:'guard-series',page_id:page.id,kind:'full',parent_call_id:null},resultat:null};
const resultat={format:2,pages:[{page_id:page.id,etat:'lue',sorte_page:'index',page_imprimee:null,suite_rubrique:false,entrees:[{titre:'Pain',renvois:'12',rubrique:null,sorte:'recette',incertain:false}],incertain:[]}]};
let n=0,sql=`\\set ON_ERROR_STOP on\nbegin;\ninsert into private.allowed_users(email) values('l1@example.test'),('l2@example.test') on conflict do nothing;\ninsert into auth.users(id,email) values('${owner}','l1@example.test'),('${autre}','l2@example.test') on conflict do nothing;\nset app.proof_uid='${owner}';\n`;
const insert=(store,row,uid=owner)=>`insert into public.${store}(owner_id,id,data,updated_at) values('${uid}'::uuid,${lit(row.id)},${json(row)},clock_timestamp());`;
sql+=insert('source_pages',page)+insert('scan_sessions',session)+insert('source_pages',{...page,id:'guard-autre'},autre)+'\n';
const accepted=(body,label)=>{n++;sql+=`set local role authenticated;\ndo $$begin ${body.replace(/;\s*$/,'')};end $$;\nreset role;\n-- ${label}\n`;};
const refused=(body,label)=>{n++;sql+=`set local role authenticated;\ndo $$begin begin ${body.replace(/;\s*$/,'')};raise exception ${lit('Refus absent : '+label)};exception when check_violation then if sqlerrm not in ('source_reserved','invalid_shape','source_changed','too_large','edition_cycle') then raise;end if;end;end $$;\nreset role;\n`;};
accepted(insert('imports',journal),'ouvrir une lecture capturée exacte');
accepted(`update public.imports set data=data||'{"status":"en_cours","started_at":"2026-10-29T00:00:00Z"}'::jsonb where owner_id=auth.uid() and id='guard-index'`,'progression du même appel');
accepted(`update public.imports set data=data||${json({status:'a_verifier',resultat})} where owner_id=auth.uid() and id='guard-index'`,'conservation du résultat inline');
for(const [label,patch]of [['capture détachée',{source_capture:{...capture,source_state_revision:'autre'}}],['appel remplacé',{index_call:{...journal.index_call,series_id:'autre'}}],['propriétaire changé',{owner_id:autre}],['séance changée',{scan_session_id:'autre'}],['version close sans preuve',{status:'enregistre'}],['résultat payé effacé',{resultat:null}],['résolutions falsifiées',{index_resolved_occurrences:[0]}],['décisions falsifiées',{index_decisions:[]}],['reçu falsifié',{index_application_receipts:[]}]])refused(`update public.imports set data=data||${json(patch)} where owner_id=auth.uid() and id='guard-index'`,label);
for(const [label,patch]of [['propriétaire initial différent',{owner_id:autre}],['initial terminal',{status:'enregistre'}],['capture sans appel',{index_call:null}],['zone initiale impossible',{source_capture:{...capture,pages:[{...capture.pages[0],zone:{...capture.pages[0].zone,width:101}}]}}]])refused(insert('imports',{...journal,id:'guard-forge-'+n,...patch}),label);
refused(insert('imports',{...journal,id:'guard-grand',extension:'x'.repeat(524288)}),'ligne capturée trop grande');
refused(insert('imports',{...journal,id:'guard-contexte',expected_edition_id:'autre'}),'contexte édition différent de la capture');
refused(insert('imports',{...journal,id:'guard-cycle',expected_edition_cycle_id:'cycle-invente'}),'cycle inventé sans édition');
refused(`update public.source_pages set data=jsonb_set(data,'{sha256}',${json('c'.repeat(64))}) where owner_id=auth.uid() and id='guard-page'`,'identité source par REST');
refused(`perform set_config('app.purge','on',true);delete from public.source_pages where owner_id=auth.uid() and id='guard-page'`,'suppression source gérée');
refused(`update public.scan_sessions set data=jsonb_set(data,'{source_state,revision}','"faux"'::jsonb) where owner_id=auth.uid() and id='guard-session'`,'token par REST');
accepted(`update public.source_pages set data=jsonb_set(data,'{printed_page}','12'::jsonb) where owner_id=auth.uid() and id='guard-page'`,'annotation ordinaire autorisée');
const ref={id:'guard-ref',edition_id:null,availability:'reference_only',current_version_id:null,index_import_id:journal.id,index_page_id:page.id,source_page_ids:[page.id],printed_pages:[{from:12,to:12}],index_rubriques:['Pains']};
sql+=insert('recipes',ref)+'\n';
refused(insert('recipes',{...ref,id:'guard-ref-forgee'}),'référence gérée créée sans décisions');
refused(insert('recipes',{...ref,id:'guard-ref-fausse-complete',availability:'available',current_version_id:'version-inventee'}),'fausse complétion ne contourne pas insertion réservée');
for(const patch of [{printed_pages:[{from:14,to:14}]},{index_rubriques:['Faux']},{index_import_id:'autre'},{index_page_id:'autre'},{source_page_ids:[]}])refused(`update public.recipes set data=data||${json(patch)} where owner_id=auth.uid() and id='guard-ref'`,'référence gérée réécrite sans décisions');
accepted(`update public.recipes set data=data||${json({display_title:'Mon pain',printed_page:13,favorite:true,personal_notes:'Mon essai'})} where owner_id=auth.uid() and id='guard-ref'`,'corrections personnelles restent autorisées');
accepted(`update public.recipes set data=data||${json({current_version_id:'version-extraite',availability:'available',source_page_ids:['photo-recette']})} where owner_id=auth.uid() and id='guard-ref'`,'référence peut devenir une recette complète');
refused(`update public.recipes set data=data||${json({index_rubriques:['Faux']})} where owner_id=auth.uid() and id='guard-ref'`,'origine index protégée après complétion');
for(const rpc of ['sync_push','l1_sync_push_v2','l2_sync_push_v2','sync_push_v2']) {
 n++;sql+=`set local role authenticated;do $$declare r jsonb;v jsonb;begin select data into v from public.source_pages where owner_id=auth.uid() and id='guard-page';r:=public.${rpc}(jsonb_build_array(jsonb_build_object('op','put','store','source_pages','id','guard-page','data',v||'{"rotation":90}'::jsonb,'updated_at',clock_timestamp())));if jsonb_array_length(r->'accepted')<>0 or r->'rejected'->0->>'reason' is distinct from 'forme' then raise exception 'Ancienne RPC contourne la garde : %',r;end if;if (select data from public.source_pages where owner_id=auth.uid() and id='guard-page') is distinct from v then raise exception 'Identité modifiée';end if;end $$;reset role;\n`;
}
sql+="set app.l1_purge_all='on';set app.purge='on';set app.maintenance='on';set app.l5_source_write='on';\n";
refused(`delete from public.source_pages where owner_id=auth.uid() and id='guard-page'`,'GUC forgés sans autorité');
sql+="set app.l1_purge_all='';set app.purge='';set app.maintenance='';\n";
accepted(`perform public.sync_purge_all()`,'purge explicite reste disponible');
for(const store of SYNC_STORES){n++;sql+=`do $$begin if exists(select 1 from public.${store} where owner_id='${owner}'::uuid) then raise exception ${lit('Purge incomplète '+store)};end if;end $$;\n`;}
n++;sql+=`do $$begin if not exists(select 1 from public.source_pages where owner_id='${autre}'::uuid and id='guard-autre') then raise exception 'Autre propriétaire effacé';end if;if current_setting('app.l1_purge_all',true)<>'' or current_setting('app.purge',true)<>'' then raise exception 'Marqueur de purge laissé actif';end if;end $$;\n`;
sql+=`rollback;\nselect ${lit('L5 gardes et purge : '+n+' assertions réussies')} as bilan;\n`;process.stdout.write(sql);
