import {capturerSourceTraduction,signerCommandeTraduction,ajouterRecuPublication,empreinteTexteTraduction} from '../src/domain/traductions-format.js';
import {composerLots} from '../src/sync/lots.js';
import {installCapture,retirerEnvoi} from '../src/sync/outbox.js';
import {withRepo} from './sync-fixture.js';
import {createPush} from '../src/sync/push.js';
import {createTransport} from '../src/sync/transport.js';
import {createPull} from '../src/sync/pull.js';
import {ignorerRenvoye,purgerAnciens} from '../src/sync/conflits.js';
import {envoiInitial} from '../src/sync/backfill.js';
import {abandonnerEnvoi} from '../src/ui/settings.js';
export async function fixtureCommandeTraduction(){
  const recipe={id:'r6sync',original_title:'Bread',original_language:'en'},version={id:'v6sync',recipe_id:'r6sync',ingredients:[],steps:[]},source=await capturerSourceTraduction({recipe,version}),at='2026-10-30T00:00:00Z';
  const translation={id:'tr6sync',recipe_version_id:version.id,locale:'fr',alignment_format:2,source_signature:source.source_signature,source_locale:source.source_locale,translated_content:{format:2,segments:source.segments.map(s=>({kind:s.kind,source_id:s.source_id,field:s.field,source_sha256:s.source_sha256,text:'Pain\u0001',origin:'manual',journal_id:null}))},verification_state:'unverified',created_at:at,updated_at:at};
  const commande=await signerCommandeTraduction({protocol:1,op:'translation_apply',mode:'publish',store:'recipe_translations',id:translation.id,nonce:'intention6',recipe_id:recipe.id,recipe_version_id:version.id,edition_id:null,base_cycle_id:null,base_edition_cycle_id:null,locale:'fr',source_signature:source.source_signature,title_sha256:source.title_sha256,expected_translations:[],changed_refs:source.segments.map(s=>s.ref),journal_read_set:[],translation});
  return{recipe,version,source,commande,row:ajouterRecuPublication({...commande.translation,publication_receipts:[],publication_receipt_floor:0},commande)};
}
export async function runL6SyncTraductionsTests({eq,ok}){
  const {preparerCommandesTraduction}=await import('../src/sync/commandes-traduction.js'),f=await fixtureCommandeTraduction(),c=f.commande;
  eq([...preparerCommandesTraduction({puts:{recipe_translations:[f.row]},commandes:[c]})],['recipe_translations:tr6sync'],'L6 sync : commande couvre publication exacte');
  for(const puts of [{recipe_translations:[f.row]},{imports:[{id:'j-bypass',kind:'traduction',translation_resolution_revision:c.operation_id,translation_resolutions:[],translation_resolution_receipts:[]}]},{imports:[{id:'j-bypass',kind:'traduction',translation_resolution_revision:null,translation_resolutions:[{ref:f.source.segments[0].ref,decision:'ecarte',text_sha256:null}],translation_resolution_receipts:[]}]}]){let refuse=false;try{preparerCommandesTraduction({puts});}catch{refuse=true;}ok(refuse,'L6 sync : aucun put réservé sans commande de publication/résolution');}
  const resolution=await signerCommandeTraduction({protocol:1,op:'translation_apply',mode:'resolve',store:'imports',id:'j-resolve',nonce:'discard-sync',journal_read_set:[{journal_id:'j-resolve',reading_sha256:'a'.repeat(64),resolution_sha256:'b'.repeat(64),base_resolution_revision:null,decisions:[{ref:f.source.segments[0].ref,decision:'ecarte',text_sha256:null}]}]});
  const resolved={id:'j-resolve',kind:'traduction',translation_resolution_revision:resolution.operation_id,translation_resolutions:resolution.journal_read_set[0].decisions,translation_resolution_receipts:[]};let sansRecu=false;try{preparerCommandesTraduction({puts:{imports:[resolved]},commandes:[resolution]});}catch{sansRecu=true;}ok(sansRecu,'L6 sync : résolution sans reçu exact refusée');
  resolved.translation_resolution_receipts=[{operation_id:resolution.operation_id,payload_sha256:resolution.payload_sha256}];ok(preparerCommandesTraduction({puts:{imports:[resolved]},commandes:[resolution]}).has('imports:j-resolve'),'L6 sync : résolution exacte avec reçu admise');
  for(const puts of [{},{recipe_translations:[{...f.row,revision:'tr_op_'+'a'.repeat(64)}]},{recipe_translations:[{...f.row,publication_receipts:[]}]}]){let refuse=false;try{preparerCommandesTraduction({puts,commandes:[c]});}catch{refuse=true;}ok(refuse,'L6 sync : mutation non couverte refuse avant capture');}
  const restore=await signerCommandeTraduction({protocol:1,op:'translation_apply',mode:'restore',store:c.store,id:c.id,nonce:'restore-sync',recipe_id:c.recipe_id,recipe_version_id:c.recipe_version_id,edition_id:null,base_cycle_id:null,base_edition_cycle_id:null,purpose:'bootstrap',expected_target_sha256:null,target:f.row});
  const restored={...ajouterRecuPublication(f.row,restore,{restore:true}),revision:restore.operation_id};let validRestore=false;try{validRestore=preparerCommandesTraduction({puts:{recipe_translations:[restored]},commandes:[restore]}).has(c.store+':'+c.id);}catch{}ok(validRestore,'L6 sync : restore copie historique avec nouvelle révision/receipt exacts');
  const db={};installCapture(db,{getUserId:()=> 'u'});const e=db.onMutate({puts:{recipe_translations:[f.row]},translation_commands:[c]});eq(e.outbox.map(x=>x.op),['translation_apply'],'L6 sync : commande unique, aucun put traduction concurrent');eq(e.outbox[0].payload,c,'L6 sync : intention immuable capturée dans transaction');
  const signed={id:'journal6',kind:'traduction',translation_capture:{source_signature:'a'.repeat(64)},translation_call:{format:1},resultat:{text:'A\u0001B'}};const snap=db.onMutate({puts:{imports:[signed]}}).outbox[0];eq(snap.snapshot,signed,'L6 sync : journal signé photographié au commit');
  const entry={...e.outbox[0],seq:2};let r=await composerLots([entry],async()=>({...f.row,translated_content:{}}));eq(r.lots[0]?.elements,[c],'L6 sync : commande envoyée verbatim et non relue');
  const sourceExacte={...f.version,notes:'Garder\u0001cette instruction'},enqueue=db.onMutate({puts:{recipe_versions:[sourceExacte]}}).outbox[0];eq(enqueue.snapshot,sourceExacte,'L6 sync : toute version source photographiée avant une future traduction');
  const versionEntry={...enqueue,seq:1};r=await composerLots([versionEntry,entry],async()=>sourceExacte);eq(r.lots[0]?.elements[0]?.data.notes,sourceExacte.notes,'L6 sync : version référencée par publication conserve tous les octets signés');
  r=await composerLots([versionEntry],async()=>sourceExacte,{versionsSources:new Set([f.version.id])});eq(r.lots[0]?.elements[0]?.data.notes,sourceExacte.notes,'L6 sync : source référencée en base reste exacte après vidage des commandes');
  r=await composerLots([versionEntry],async()=>sourceExacte);eq(r.lots[0]?.elements[0]?.data.notes,'Gardercette instruction','L6 sync : nettoyage historique conservé hors source signée');
  const phases=['a_lancer','en_cours','a_verifier'].map((status,i)=>({...snap,seq:i+1,snapshot:{...signed,source_version_id:f.version.id,status,started_at:i?'2026-10-30T00:00:00Z':null,resultat:i===2?signed.resultat:null}}));
  await withRepo(async(repo,db)=>{
    for(const reservee of [{...entry,seq:1},{...phases[0],seq:1}]){
      await db.mutate({origin:'remote',puts:{outbox:[reservee]}});
      eq(await abandonnerEnvoi({db,seq:1,confirm:async()=>true}),false,'L6 sync : geste Abandonner reflète refus de commande ou phase réservée');
      eq(await db.get('outbox',1),reservee,'L6 sync : refus affiché conserve intention exacte');
    }
  });
  r=await composerLots(phases,async()=>phases[2].snapshot);eq(r.lots.flatMap(l=>l.elements.map(e=>e.data.status)),['a_lancer'],'L6 sync : journal hors ligne envoie sa première phase sans coalescer');eq(r.retenues.map(x=>x.seq),[2,3],'L6 sync : début et réponse attendent accusé de phase précédente');
  const enfant={seq:1,op:'put',store:'recipe_versions',id:'child',snapshot:{id:'child',recipe_id:'r6sync',parent_version_id:f.version.id,ingredients:[],steps:[]}},parent={...versionEntry,seq:9};
  r=await composerLots([enfant,parent],async()=>null);eq(r.lots.flatMap(l=>l.elements.map(e=>e.id)),[f.version.id],'L6 sync : parent version envoyé avant enfant même si séquence inversée');
  r=await composerLots([{...phases[0],seq:1},parent],async()=>null);eq(r.lots.flatMap(l=>l.elements.map(e=>e.id)),[f.version.id],'L6 sync : journal attend version source même si capturé avant sa mise en file');
  r=await composerLots([{seq:1,user_id:'u',store:'recipe_versions',id:f.version.id,op:'put',snapshot:f.version},entry],async()=>null);eq(r.lots.flatMap(l=>l.elements.map(e=>e.store)),['recipe_versions'],'L6 sync : version source avant publication');eq(r.retenues.map(x=>x.seq),[2],'L6 sync : traduction attend source confirmée');
  const ordinary={...snap,seq:1};r=await composerLots([ordinary],async()=>({...signed,resultat:{text:'Autre'}}));eq(r.lots[0]?.elements[0]?.data,signed,'L6 sync : journal signé jamais nettoyé ni remplacé au départ');
  const rpc=[];await createTransport({rpc:async(name,args)=>{rpc.push({name,args});return{data:{accepted:[],rejected:[]},error:null};}}).pousser([c]);eq(rpc[0].name,'sync_push_v2','L6 sync : commande emprunte RPC transactionnel');
  await withRepo(async(repo,db)=>{
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],recipe_translations:[f.row],outbox:[entry]}});let appels=0;
    const absent=createPush({db,getUserId:()=> 'u',transport:{capacites:async()=>({capacites:{source_revisions:1}}),pousser:async()=>{appels++;return{reponse:{accepted:[],rejected:[]}};}}});const ar=await absent.envoyer();eq([appels,ar.erreur?.type],[0,'incompatible'],'L6 sync : serveur sans capacité ne reçoit pas ancien put');
    const ack={store:c.store,id:c.id,operation_id:c.operation_id,payload_sha256:c.payload_sha256,server_rows:[{store:c.store,id:c.id,data:f.row,server_seq:7,updated_at:'2026-10-30T01:00:00Z',deleted_at:null}]};
    const transport={capacites:async()=>({capacites:{recipe_language:1}}),pousser:async()=>{appels++;return{reponse:{accepted:[{...ack,payload_sha256:'b'.repeat(64)}],rejected:[],server_time:'2026-10-30T01:00:00Z'}};}};
    const push=createPush({db,getUserId:()=> 'u',transport});await push.envoyer();eq((await repo.all('outbox')).length,1,'L6 sync : mauvais reçu garde intention exacte');
    transport.pousser=async()=>({reponse:{accepted:[ack],rejected:[],server_time:'2026-10-30T01:00:00Z'}});await push.envoyer();eq((await repo.all('outbox')).length,0,'L6 sync : bon reçu retire intention');eq(await repo.get('recipe_translations',c.id),f.row,'L6 sync : accusé ne réécrit pas une version locale ultérieure');
  });
  await withRepo(async(repo,db)=>{
    const remote={...structuredClone(f.row),updated_at:'2026-10-30T02:00:00Z'};remote.translated_content.segments[0].text='Autre pain';
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],recipe_translations:[f.row],outbox:[entry]}});
    await createPull({db,getUserId:()=> 'u',transport:{lire:async(table)=>({lignes:table===c.store?[{id:c.id,data:remote,server_seq:9,updated_at:remote.updated_at,deleted_at:null}]:[],encore:false})}}).recevoir();
    eq(await repo.get(c.store,c.id),f.row,'L6 sync : réception concurrente garde publication locale non accusée');eq((await repo.get('sync_state','source_confirmed:'+c.store+':'+c.id))?.value.data,remote,'L6 sync : copie serveur conservée pour comparaison explicite');
    const conflit={id:'translation:'+c.operation_id,kind:'translation',store:c.store,record_id:c.id,user_id:'u',local:c,server:null,at:'2020-01-01T00:00:00Z'};await db.mutate({origin:'remote',puts:{sync_conflicts:[conflit]}});eq(await ignorerRenvoye(db,conflit),false,'L6 sync : geste générique ne dissout pas conflit de publication');await purgerAnciens(db);ok(await repo.get('sync_conflicts',conflit.id),'L6 sync : conflit publication ne disparaît pas par ancienneté');
  });
  await withRepo(async(repo,db)=>{
    const initiales=phases.map((e,i)=>({...e,seq:i+1,updated_at:'2026-10-30T00:00:0'+i+'Z',snapshot:{...e.snapshot,updated_at:'2026-10-30T00:00:0'+i+'Z'}}));
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],imports:[initiales[2].snapshot],outbox:initiales}});let now=100000,perdu=true;const envoyes=[];
    const push=createPush({db,getUserId:()=> 'u',maintenant:()=>now,transport:{capacites:async()=>({capacites:{recipe_language:1}}),pousser:async xs=>{envoyes.push(xs.map(e=>e.data.status));if(perdu){perdu=false;return{erreur:{type:'reseau'}};}return{reponse:{accepted:xs.map(({store,id})=>({store,id})),adjusted:[],rejected:[]}};}}});
    await push.envoyer();eq(envoyes,[['a_lancer']],'L6 sync réel : premier accusé perdu garde phase exacte');await push.envoyer();eq(envoyes,[['a_lancer']],'L6 sync réel : recul ne laisse pas passer la phase suivante');
    now+=100000;for(let i=0;i<3;i++)await push.envoyer();eq(envoyes,[['a_lancer'],['a_lancer'],['en_cours'],['a_verifier']],'L6 sync réel : accusé perdu rejoue seulement la même phase puis poursuit');eq((await db.getAll('outbox')).length,0,'L6 sync réel : chaque phase a son propre accusé');eq(await db.get('imports','journal6'),initiales[2].snapshot,'L6 sync réel : accusés intermédiaires ne rétrogradent pas la réponse locale');
    await db.mutate({origin:'remote',puts:{outbox:[initiales[0]]}});eq(await retirerEnvoi(db,1),false,'L6 sync : abandon générique ne supprime pas une phase réservée');
  });
  await withRepo(async(repo,db)=>{
    const first={...phases[0],seq:1},latest={...phases[2].snapshot,updated_at:first.snapshot.updated_at};
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],imports:[latest],outbox:[first]}});
    const transport={capacites:async()=>({capacites:{recipe_language:1}}),pousser:async()=>({reponse:{accepted:[],adjusted:[{store:'imports',id:signed.id,updated_at:'2026-10-30T02:00:00Z'}],rejected:[]}})};
    const push=createPush({db,getUserId:()=> 'u',transport});await push.envoyer();eq(await db.get('imports',signed.id),latest,'L6 sync : ajustement horloge phase initiale ne rétrograde jamais résultat de même milliseconde');
    await db.mutate({origin:'remote',puts:{outbox:[first]}});transport.pousser=async()=>({reponse:{accepted:[],adjusted:[],rejected:[{store:'imports',id:signed.id,reason:'conflit',server:{data:{...latest,status:'ignore'},updated_at:'2026-10-30T02:00:00Z'}}]}});await push.envoyer();
    ok((await db.get('outbox',1))?.lifecycle_blocked,'L6 sync : refus journal conserve phase et bloque suivantes');const conflicts=await db.getAll('sync_conflicts');eq(conflicts[0]?.kind,'translation','L6 sync : refus journal exige comparaison spécialisée');eq(conflicts[0]?.local,first.snapshot,'L6 sync : copie du conflit garde phase exacte envoyée');
  });
  await withRepo(async(repo,db)=>{
    const latest={...phases[2].snapshot,updated_at:'2026-10-30T00:00:00Z'},remote={...latest,status:'ignore',updated_at:'2026-10-30T02:00:00Z'};
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],imports:[latest],outbox:phases}});
    await createPull({db,getUserId:()=> 'u',transport:{lire:async table=>({lignes:table==='imports'?[{id:signed.id,data:remote,server_seq:10,updated_at:remote.updated_at,deleted_at:null}]:[],encore:false})}}).recevoir();
    eq(await db.get('imports',signed.id),latest,'L6 sync : réception distante conserve réponse avec phases encore en attente');eq((await db.getAll('outbox')).map(e=>e.snapshot.status),['a_lancer','en_cours','a_verifier'],'L6 sync : réception ne refile ni ne fusionne les phases capturées');
  });
  await withRepo(async(repo,db)=>{
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:[f.row]}});
    await envoiInitial({db,getUserId:()=> 'u'});const file=await db.getAll('outbox'),restores=file.filter(e=>e.op==='translation_apply');
    eq(restores.map(e=>[e.payload.mode,e.payload.purpose,e.payload.expected_target_sha256]),[['restore','bootstrap',null]],'L6 sync : bibliothèque historique démarre par restore explicite sans put format2');
    ok(!file.some(e=>e.store==='recipe_translations'&&e.op==='put'),'L6 sync : bootstrap ne double pas la commande par un put');
    eq((await repo.get('recipe_translations',f.row.id)).revision,restores[0]?.payload.operation_id,'L6 sync : reçu bootstrap et révision locale changent ensemble');
    const before=await db.getAll('outbox');await envoiInitial({db,getUserId:()=> 'u'});eq(await db.getAll('outbox'),before,'L6 sync : reprise bootstrap ne fabrique aucune intention supplémentaire');
  });
  await withRepo(async(repo,db)=>{
    const at='2026-10-30T00:00:00Z',op='tr_op_'+'e'.repeat(64),ref=f.source.segments[0],text=f.row.translated_content.segments[0].text;
    const j={id:'j-bootstrap-ai',kind:'traduction',recipe_id:f.recipe.id,source_version_id:f.version.id,target_locale:'fr',owner_id:'u',edition_id:null,expected_cycle_id:null,expected_edition_id:null,expected_edition_cycle_id:null,started_at:at,finished_at:at,model:null,translation_source_signature:f.source.source_signature,translation_capture:{format:1,source_locale:f.source.source_locale,title_capture:f.source.title_capture},translation_call:{format:1,series_id:'serie-bootstrap',ordinal:0,segment_refs:[{ref:ref.ref,kind:ref.kind,source_id:ref.source_id,field:ref.field,source_sha256:ref.source_sha256,output_max_points:200}]},resultat:{format:1,segments:[{ref:ref.ref,text,issue:'admis'}]},translation_resolution_revision:op,translation_resolutions:[{ref:ref.ref,decision:'adopte',text_sha256:await empreinteTexteTraduction(text)}],translation_resolution_receipts:[{operation_id:op,payload_sha256:'f'.repeat(64)}],status:'enregistre',erreur:null,scan_session_id:null,page_ids:[],created_at:at,updated_at:at};
    const tr=structuredClone(f.row);Object.assign(tr.translated_content.segments[0],{origin:'ai',journal_id:j.id});
    await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u'}],recipes:[f.recipe],recipe_versions:[f.version],imports:[j],recipe_translations:[tr]}});await envoiInitial({db,getUserId:()=> 'u'});let file=await db.getAll('outbox');const ordre=[];
    for(let i=0;i<10&&file.length;i++){const c=await composerLots(file,(store,id)=>db.get(store,id));if(!c.lots.length)break;const done=new Set(c.lots.flatMap(l=>l.seqs));ordre.push(...c.lots.flatMap(l=>l.elements.map(e=>e.op==='source_transfer'?e.phase:e.op||e.store)));file=file.filter(e=>!done.has(e.seq));}
    eq(file.length,0,'L6 sync : bootstrap assistant complet sans dépendance circulaire');
    ok(ordre.indexOf('recipes')<ordre.indexOf('begin')&&ordre.indexOf('recipe_versions')<ordre.indexOf('begin'),'L6 sync : sources métier avant transfert journal historique');ok(ordre.indexOf('begin')<ordre.indexOf('finish')&&ordre.indexOf('finish')<ordre.indexOf('translation_apply'),'L6 sync : provenance durable avant restore traduction assistant');
  });
}
