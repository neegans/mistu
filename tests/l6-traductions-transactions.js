import {withRepo} from './sync-fixture.js';
import {creerDepotTraductions} from '../src/domain/depot-traductions.js';
import {protegerTexteTraduction,validerJournalTraduction} from '../src/domain/traductions-format.js';
export async function runL6TraductionsTransactionsTests({eq,ok}){
 await withRepo(async(repo,db)=>{
 const owner='u1',edition={id:'te',book_id:'tb',lifecycle_id:'cycle-ed',trashed_at:null,trash_mode:null},book={id:'tb',title:'Livre'},recipe={id:'tr',original_title:'Bread',original_language:'en',edition_id:'te',lifecycle_id:'cycle-rec',trashed_at:null,availability:'available',current_version_id:'tv',source_page_ids:[]},version={id:'tv',recipe_id:'tr',ingredients:[],steps:[{id:'st',text:'Mix.'}]};
 await db.mutate({origin:'remote',puts:{books:[book],book_editions:[edition],recipes:[recipe],recipe_versions:[version]}});await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:owner}]}});
 const d=creerDepotTraductions({repo,getGeneration:()=>0}),p=(await d.capturerPortee({owner_id:owner})).portee,o=await d.ouvrirTraduction({portee:p,affiche:{recipe,version,edition,traductions:[]},locale:'fr'});eq(o.issue,'ok','L6 transaction : livre et cycles capturés');if(o.issue!=='ok')return;
 const plan=await d.preparerLectureTraduction({session:o.session,selection:o.source.segments.map(s=>s.ref)});eq(plan.issue,'ok','L6 transaction : plan sur livre');if(plan.issue!=='ok')return;
 const reserve=await d.reserverPortionTraduction({plan:plan.plan,ordinal:0});eq(reserve.issue,'ok','L6 transaction : initialisation sous cycles nonnull');if(reserve.issue!=='ok')return;
 const started=await d.commencerPortionTraduction({reservation:reserve.reservation});eq(started.issue,'ok','L6 transaction : vol sous cycles nonnull');if(started.issue!=='ok')return;
 const text=JSON.stringify({format:1,segments:started.portion.segment_refs.map(s=>({ref:s.ref,text:s.kind==='title'?'Pain':'Mélanger.'}))}),response={text,model:'test',reponseBrute:new TextEncoder().encode('BRUT')},saved=await d.conserverReponseTraduction({vol:started.vol,reponse:response});eq(saved.issue,'conserve','L6 transaction : reçu payant sur livre');if(saved.issue!=='conserve')return;
 const adopted=await d.adopterLectureTraduction({session:o.session,lecture:saved.lecture,refs:[saved.lecture.remaining_refs[0]]});eq(adopted.issue,'ok','L6 transaction : adoption explicite');if(adopted.issue!=='ok')return;
 let draft=await d.conserverBrouillon({session:adopted.session,expectedRevision:null,payload:adopted.modele});eq(draft.issue,'ok','L6 transaction : adoption conservée sans publier');if(draft.issue!=='ok')return;
 const second=await d.adopterLectureTraduction({session:adopted.session,lecture:saved.lecture,refs:[saved.lecture.remaining_refs[1]]});eq(second.issue,'ok','L6 transaction : seconde adoption même journal');if(second.issue!=='ok')return;eq(second.modele.adoptions[0].refs.length,2,'L6 transaction : première adoption conservée');draft=await d.conserverBrouillon({session:second.session,expectedRevision:draft.revision,payload:second.modele});eq(draft.issue,'ok','L6 transaction : deux choix conservés');
 const prep=await d.preparerPublicationTraduction({session:second.session,expectedRevision:draft.revision,payload:second.modele});eq(prep.issue,'ok','L6 transaction : préparation journal exact');if(prep.issue!=='ok')return;
 const result=await d.publierTraduction({plan:prep.plan});eq(result.issue,'publie','L6 transaction : publication et résolutions atomiques');if(result.issue!=='publie')return;
 const row=(await db.getAll('recipe_translations'))[0],j=await db.get('imports',reserve.journalId);eq(row.translated_content.segments.map(s=>s.origin),['ai','ai'],'L6 transaction : provenance par segment exact');eq(j.status,'enregistre','L6 transaction : couverture clôture journal');ok(validerJournalTraduction(j).ok,'L6 transaction : journal terminal fermé');eq(j.translation_resolutions.length,2,'L6 transaction : deux résolutions');eq((await d.publierTraduction({plan:prep.plan})).issue,'deja_publie','L6 transaction : replay sans nouvelle résolution');
 });
 await withRepo(async(repo,db)=>{
 await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'u1'}]}});const recipe={id:'qr',original_title:'Title',availability:'available'},version={id:'qv',recipe_id:'qr',ingredients:[],steps:[]};await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
 const d=creerDepotTraductions({repo,getGeneration:()=>0}),p=(await d.capturerPortee({owner_id:'u1'})).portee,o=await d.ouvrirTraduction({portee:p,affiche:{recipe,version,traductions:[]},locale:'fr'}),plans=[];
 for(let i=0;i<3;i++){const x=await d.preparerLectureTraduction({session:o.session,selection:o.source.segments.map(s=>s.ref)});plans.push(x.plan);}
 eq((await d.reserverPortionTraduction({plan:plans[0],ordinal:0})).issue,'ok','L6 quota : première réserve');eq((await d.reserverPortionTraduction({plan:plans[1],ordinal:0})).issue,'ok','L6 quota : deux réserves3Mio dans8Mio');
 const before=await db.getAll('outbox'),failed=await d.reserverPortionTraduction({plan:plans[2],ordinal:0});eq(failed.raison,'reserve_pleine','L6 quota : troisième réserve refusée exactement');eq((await db.getAll('imports')).length,2,'L6 quota : journal refusé non écrit');eq(await db.getAll('outbox'),before,'L6 quota : outbox refusée atomiquement');
 });
}
