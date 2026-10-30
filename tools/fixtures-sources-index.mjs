// Données synthétiques produites par les vrais planners ; aucun fichier local ignoré requis.
import * as F from '../src/domain/sources-format.js';
import * as M from '../src/domain/index-application.js';
import {validerPageIndex} from '../src/domain/index-livre.js';
import {reconstruirePageIndex} from '../src/domain/index-lecture.js';
const owner='00000000-0000-0000-0000-000000000001',date='2026-10-29T23:00:00.000Z';
async function scenario(prefix,halves=false,count=600){
 const book={id:prefix+'book',title:'Index SQL'},edition={id:prefix+'ed',book_id:book.id,language:'fr'},doc={id:prefix+'doc',scan_session_id:prefix+'session',edition_id:edition.id,source_type:'photo',sha256:'a'.repeat(64)},page={id:prefix+'page',edition_id:edition.id,document_id:doc.id,sha256:doc.sha256,rotation:0,printed_page:10,position:1},session={id:prefix+'session',edition_id:edition.id,status:'open',page_ids:[page.id],document_ids:[doc.id],recipe_ids:[]};
 const capture=async(kind)=>({format:2,session_id:session.id,source_state_revision:null,selected_page_ids:[page.id],pages:[{id:page.id,identity_sha256:await F.empreinteSources(F.projectionIdentitePage(page)),annotation_sha256:await F.empreinteSources(F.projectionAnnotationPage(page)),preparation_version:'index-image-v1',zone:{kind,x:kind==='right_half'?450:0,y:0,width:kind==='full'?1000:550,height:700,source_width:1000,source_height:700},sent_image_sha256:(kind==='full'?'b':kind==='left_half'?'c':'d').repeat(64)}]});
 async function row(kind,n){return{id:prefix+kind,kind:'index',status:halves&&kind==='full'?'echec':'a_verifier',recipe_id:null,edition_id:edition.id,scan_session_id:session.id,page_ids:[page.id],owner_id:owner,expected_edition_id:edition.id,expected_edition_cycle_id:null,started_at:date,created_at:date,updated_at:date,index_call:{format:1,series_id:prefix+'series',page_id:page.id,kind,parent_call_id:kind==='full'?null:prefix+'full'},source_capture:await capture(kind),model:'claude-sonnet-5-5',resultat:halves&&kind==='full'?null:{format:2,pages:[{...validerPageIndex({sorte_page:'index',page_imprimee:10,entrees:Array.from({length:n},(_,i)=>[`${kind} recette ${i}`,String(i+1),null,'recette',false]),incertain:[]}),page_id:page.id,etat:'lue',moities:0,modele:'claude-sonnet-5-5'}]},erreur:halves&&kind==='full'?{raison:'coupe'}:null};}
 const imports=halves?[await row('full',0),await row('left_half',1),await row('right_half',1)]:[await row('full',count)];
 const vue={format:1,page_id:page.id,full_call_id:prefix+'full',left_call_id:halves?prefix+'left_half':null,right_call_id:halves?prefix+'right_half':null};
 const lecture={lignes:imports,pages:[reconstruirePageIndex(vue,imports)],modeleValide:true};
 const projection=await M.projeterIndexAffiche({lecture,edition,recettes:[]});let n=0;const newId=p=>`${prefix}${p}_${++n}`;
 const unites=await M.unitesApplicationIndex({projection},{newId}),plan=await M.preparerPortionsIndex({edition,journaux:imports,recettes:[],unites,session,session_id:session.id,application_id:prefix+'application'},{newId});
 const stores={books:[book],book_editions:[edition],source_documents:[doc],source_pages:[page],scan_sessions:[session],imports};
 return{name:halves?'parent_coupe_deux_moities':'six_cents_deux_portions',owner_id:owner,rows:Object.entries(stores).flatMap(([store,rs])=>rs.map(data=>({store,id:data.id,data}))),commands:plan.commands,expected:{recipes:halves?2:count,journals_closed:imports.map(r=>r.id),portions:plan.commands.length},measures:plan.commands.map(c=>({operation_id:c.operation_id,jsonb_bytes:F.octetsJsonbSources(c),creates:c.creates.length,touched_journals:c.decisions.length}))};
}
export const creerScenariosIndex = async()=>[await scenario('sql600_'),await scenario('sqlhalf_',true)];
export async function creerFixtureIndex() {
 const s=await scenario('sql_one_',false,1),get=store=>s.rows.find(r=>r.store===store).data;
 return {edition:get('book_editions'),session:get('scan_sessions'),page:get('source_pages'),document:get('source_documents'),journal:get('imports'),c:s.commands[0]};
}
