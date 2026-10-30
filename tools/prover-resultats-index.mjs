// Vecteurs JavaScript réels contre le lecteur PostgreSQL L5, sur une base jetable seulement.
import * as F from '../src/domain/sources-format.js';
import { validerPageIndex } from '../src/domain/index-livre.js';
import { preparerStockageIndex, validerResultatStockeIndex } from '../src/domain/index-stockage.js';
const lit=s=>"'"+s.replaceAll("'","''")+"'", json=v=>lit(JSON.stringify(v))+'::jsonb';
const hash='a'.repeat(64),owner='00000000-0000-0000-0000-000000000001';
const page={id:'proof-page',edition_id:null,document_id:null,sha256:hash,rotation:0,printed_page:10};
const session={id:'proof-session',edition_id:null,status:'open',page_ids:[page.id],document_ids:[],source_state:{format:1,revision:'proof-current',active_page_ids:[page.id]}};
const capture={format:2,session_id:session.id,source_state_revision:session.source_state.revision,selected_page_ids:[page.id],pages:[{id:page.id,identity_sha256:await F.empreinteSources(F.projectionIdentitePage(page)),annotation_sha256:await F.empreinteSources(F.projectionAnnotationPage(page)),preparation_version:'index-image-v1',zone:{kind:'full',x:0,y:0,width:100,height:200,source_width:100,source_height:200},sent_image_sha256:hash}]};
const journal={id:'proof-journal',kind:'index',status:'a_verifier',owner_id:owner,recipe_id:null,edition_id:null,scan_session_id:session.id,page_ids:[page.id],source_capture:capture,index_call:{format:1,series_id:'proof-series',page_id:page.id,kind:'full',parent_call_id:null}};
const result=entries=>({format:2,pages:[{page_id:page.id,etat:'lue',moities:0,modele:'modele-preuve',...validerPageIndex({sorte_page:'index',page_imprimee:10,entrees:entries,incertain:[]})}]});
const normal=result([['Soupe de pois','20 à 25','Légumes','recette',false],['Pain','50','^','recette',true],['Cuisine','1',null,'autre',false]]);
const gros=result(Array.from({length:600},(_,i)=>['🍞'.repeat(196)+String(i).padStart(4,'0'),'🍐'.repeat(80),'🍎'.repeat(120),'recette',false]));
let n=0;const packed=await preparerStockageIndex({journal,resultat:gros},{newId:()=>`proof-fragment-${++n}`});
let assertions=0,sql=`\\set ON_ERROR_STOP on\nbegin;\nset app.proof_uid=${lit(owner)};\ninsert into private.allowed_users(email) values('l1@example.test') on conflict do nothing;\ninsert into auth.users(id,email) values(${lit(owner)}::uuid,'l1@example.test') on conflict do nothing;\n`;
const seed=(store,row)=>`insert into public.${store}(owner_id,id,data,updated_at) values(${lit(owner)}::uuid,${lit(row.id)},${json(row)},clock_timestamp()) on conflict(owner_id,id) do update set data=excluded.data,deleted_at=null;\n`;
sql+=seed('scan_sessions',session)+seed('source_pages',page)+packed.fragments.map(r=>seed('imports',r)).join('');
const ok=(expr,want,label)=>{assertions++;sql+=`do $$begin if (${expr}) is distinct from (${want}) then raise exception ${lit(label)};end if;end $$;\n`;};
const refuses=(expr,label)=>{assertions++;sql+=`do $$begin begin perform ${expr};raise exception ${lit('Refus manquant : '+label)};exception when check_violation or invalid_parameter_value or invalid_text_representation then null;end;end $$;\n`;};
ok(`public.l5_index_result(${json({...journal,resultat:normal})})`,json(normal),'résultat inline exact');
ok(`public.l5_index_result(${json({...journal,index_storage:null,index_call:null,resultat:normal})})`,json(normal),'anciens champs optionnels nuls');
ok(`public.l5_index_result(${json(packed.journal)})`,json(gros),'600 entrées reconstruites exactement');
ok(`public.l5_index_result(${json({...journal,status:'echec',erreur:{raison:'coupe'},resultat:null})})`,"'null'::jsonb",'parent coupé sans résultat');
for(const [label,change] of [
 ['type résultat',r=>{r.format=1;}],['page étrangère',r=>{r.pages[0].page_id='autre';}],['champ inconnu',r=>{r.pages[0].secret='x';}],
 ['601 entrées',r=>{r.pages[0].entrees=Array.from({length:601},()=>structuredClone(r.pages[0].entrees[0]));}],
 ['titre trop long',r=>{r.pages[0].entrees[0].titre='x'.repeat(201);}],['titre non normalisé',r=>{r.pages[0].entrees[0].titre='Pain  doré';}],
 ['rubrique masquée',r=>{r.pages[0].entrees[0].rubrique='www.exemple.fr';}],['hôte Unicode',r=>{r.pages[0].entrees[0].titre='ｅｘｅｍｐｌｅ。ｃｏｍ';}],
 ['titre nul',r=>{r.pages[0].entrees[0].titre=null;}],['suite false impossible',r=>{r.pages[0].entrees[0].suite=false;}],
 ['rubrique suite incohérente',r=>{r.pages[0].entrees[1].rubrique='Autre';}],['sorte étrangère',r=>{r.pages[0].entrees[0].sorte='invente';}],
 ['renvoi trop long',r=>{r.pages[0].entrees[0].renvois='x'.repeat(81);}],['incertitude vide',r=>{r.pages[0].incertain=[''];}],
 ['nombre écartées fraction',r=>{r.pages[0].ecartees.forme=0.5;}],['moitié inconnue',r=>{r.pages[0].moitiesCoupees=['haut'];}],
 ['caractère invisible',r=>{r.pages[0].entrees[0].titre='Pa\u200bin';}],['espacement bord',r=>{r.pages[0].entrees[0].titre='\u00a0Pain';}],
 ]){
  const bad=structuredClone(normal);change(bad);let refused=false;try{validerResultatStockeIndex(bad,page.id);}catch{refused=true;}if(!refused)throw Error('Vecteur JS accepté '+label);
  refuses(`public.l5_index_result(${json({...journal,resultat:bad})})`,label);
 }
for(const title of ['Pain\u00a0doré','@chef.com','échef.com','Sel.caisson','Œuf 🍳','Le pain — 2']){
 const r=result([[title,'12',null,'recette',false]]);ok(`public.l5_index_result(${json({...journal,resultat:r})})`,json(r),'Unicode et adresse '+title);
}
for(const [label,change] of [['capture modifiée',r=>{r.source_capture.pages[0].annotation_sha256='b'.repeat(64);}],['hash complet faux',r=>{r.index_storage.logical_result_sha256='b'.repeat(64);}],['ordre faux',r=>{r.index_storage.fragments.reverse();}],['fragment absent',r=>{r.index_storage.fragments[0].id='absent';}]]){
 const bad=structuredClone(packed.journal);change(bad);refuses(`public.l5_index_result(${json(bad)})`,label);
}
const first=packed.fragments[0];
sql+=seed('imports',{...first,owner_id:'autre'});refuses(`public.l5_index_result(${json(packed.journal)})`,'propriétaire fragment différent');sql+=seed('imports',first);
sql+=seed('imports',{...first,index_storage:{...first.index_storage,text:first.index_storage.text+'x'}});refuses(`public.l5_index_result(${json(packed.journal)})`,'texte fragment modifié');sql+=seed('imports',first);
// La présence d’un champ de contexte fait partie de sa preuve, même si sa valeur est nulle.
for(const [label,change] of [
 ['recette omise',r=>{delete r.recipe_id;}],['édition omise',r=>{delete r.edition_id;}],
 ['cycle ajouté nul',r=>{r.expected_edition_cycle_id=null;}],['séance étrangère',r=>{r.scan_session_id='autre';}],
 ['page étrangère',r=>{r.page_ids=['autre'];}],['appel étranger',r=>{r.index_call.series_id='autre';}],
 ['capture étrangère',r=>{r.source_capture.pages[0].sent_image_sha256='b'.repeat(64);}],
 ['fragment à vérifier',r=>{r.status='a_verifier';}],['résultat ajouté',r=>{r.resultat=normal;}],
 ['champ technique inconnu',r=>{r.index_storage.extra=true;}],['ordinal changé',r=>{r.index_storage.ordinal++;}],
 ['nombre UTF-8 nul',r=>{r.index_storage.utf8_bytes=null;}],['texte nul',r=>{r.index_storage.text=null;}],
 ]){
 const bad=structuredClone(first);change(bad);sql+=seed('imports',bad);refuses(`public.l5_index_result(${json(packed.journal)})`,'contexte fragment : '+label);
}
sql+=seed('imports',first);
sql+=`select public.l5_check_capture(${json(capture)},true);\n`;assertions++;
const ancienne={...capture,source_state_revision:'ancienne'};refuses(`public.l5_check_capture(${json(ancienne)},true)`,'sélection ancienne active');sql+=`select public.l5_check_capture(${json(ancienne)},false);\n`;assertions++;
const annotation=structuredClone(capture);annotation.pages[0].annotation_sha256='b'.repeat(64);refuses(`public.l5_check_capture(${json(annotation)},true)`,'annotation changée');sql+=`select public.l5_check_capture(${json(annotation)},false);\n`;assertions++;
for(const [label,change] of [['identité modifiée',c=>{c.pages[0].identity_sha256='b'.repeat(64);}],['zone hors image',c=>{c.pages[0].zone.width=101;}],['page dupliquée',c=>{c.selected_page_ids.push(page.id);c.pages.push(c.pages[0]);}],['champ non fermé',c=>{c.extra=1;}],['hash absent',c=>{delete c.pages[0].sent_image_sha256;}]]){const bad=structuredClone(capture);change(bad);refuses(`public.l5_check_capture(${json(bad)},false)`,label);}
refuses(`public.l5_check_capture(${json(capture)},null)`,'mode de capture nul');
sql+=seed('scan_sessions',{...session,source_state:{...session.source_state,revision:'proof-hidden',active_page_ids:[]}});
refuses(`public.l5_check_capture(${json(capture)},true)`,'page retirée du choix actif');
sql+=`select public.l5_check_capture(${json(capture)},false);\n`;assertions++;
sql+=seed('scan_sessions',{...session,source_state:{...session.source_state,revision:'proof-restored'}});
refuses(`public.l5_check_capture(${json(capture)},true)`,'retrait puis remise ne réactive pas la capture ancienne');
sql+=`select public.l5_check_capture(${json(capture)},false);\n`;assertions++;
sql+=seed('scan_sessions',{...session,page_ids:[],source_state:{...session.source_state,active_page_ids:[]}});
refuses(`public.l5_check_capture(${json(capture)},false)`,'page absente même de la séance historique');
sql+=seed('scan_sessions',session)+seed('source_pages',{...page,sha256:'b'.repeat(64)});
refuses(`public.l5_check_capture(${json(capture)},false)`,'octets historiques modifiés');
sql+=seed('source_pages',page);
sql+=`rollback;\nselect ${lit('L5 résultat/capture : '+assertions+' assertions réussies')} as bilan;\n`;
process.stdout.write(sql);
