import {withDatabase} from './backup.js';
import {createArchive,inspectArchive,applyArchive,verifyRestored} from '../src/domain/backup.js';
import {createZip,readZip,textOf} from '../src/core/zip.js';
import {sha256Hex} from '../src/core/hash.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {traductionLectureL6} from './l6-lecture-recette.js';
import {capturerSourceTraduction,empreinteTexteTraduction,lireRecuPublication,validerJournalTraduction,verifierCommandeTraduction} from '../src/domain/traductions-format.js';
import {withRepo} from './sync-fixture.js';
const clone=x=>structuredClone(x),refuse=async f=>{try{await f();return false;}catch{return true;}};

async function fixture(db) {
 const f=fixtureLectureL6(),translation=await traductionLectureL6(f);
 translation.publication_receipts=[{operation_id:'tr_op_'+'b'.repeat(64),payload_sha256:'c'.repeat(64)}];
 // Les titres et la langue peuvent changer après la traduction ; leur histoire doit rester exacte.
 f.recipe.display_title='Mon pain';f.recipe.original_language='it';f.recipe.personal_notes='Ma note personnelle.';
 f.version.notes+='\u0001';
 // Une seconde capture rend le caractère de contrôle légitime dans les empreintes culinaires.
 const recipeHistorique={...f.recipe,original_language:'en'};delete recipeHistorique.display_title;
 const historique=await traductionLectureL6({...f,recipe:recipeHistorique});
 historique.publication_receipts=translation.publication_receipts;
 const blob=new Blob(['Photo de contrôle L6'],{type:'image/png'}),sha256=await sha256Hex(blob);f.recipe.photo_sha256=sha256;
 const puts={unit_definitions:[{id:'g'},{id:'ml'}],recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:[historique],files:[{sha256,blob,size:blob.size,mime:blob.type}],sync_state:[{key:'translation_response:v1:test',value:{secret_local:'réponse brute uniquement locale'}}]};
 await db.mutate({origin:'remote',puts});return{...f,translation:historique,puts};
}
async function transformer(archive,changer){
 const zip=readZip(new Uint8Array(await archive.blob.arrayBuffer())),manifest=JSON.parse(textOf(zip.get('manifest.json'))),stores={};
 for(const f of manifest.data_files)stores[f.store]=JSON.parse(textOf(zip.get(f.path)));await changer(stores,manifest);
 const donnees=new Map();for(const f of manifest.data_files){const bytes=new TextEncoder().encode(JSON.stringify(stores[f.store]));f.sha256=await sha256Hex(bytes);f.count=stores[f.store].length;manifest.counts[f.store]=f.count;donnees.set(f.path,bytes);}
 return inspectArchive(createZip([...zip].map(([path,e])=>({path,data:path==='manifest.json'?JSON.stringify(manifest):donnees.get(path)||e.data}))));
}
export async function runL6ArchivesTests({eq,ok}) {
 let archive,source;await withDatabase(async db=>{source=await fixture(db);archive=await createArchive(db);});
 eq(archive.manifest.format_version,5,'L6 archive : format5 protège les champs réservés');
 const inspection=await inspectArchive(await archive.blob.arrayBuffer());ok(inspection.ok,'L6 archive : historique de langue et titre accepté sans réinterprétation');
 eq(inspection.payload.stores.recipe_translations[0],source.translation,'L6 archive : texte, empreintes et reçus historiques exacts');
 ok(!Object.hasOwn(inspection.payload.stores,'sync_state'),'L6 archive : réponses brutes et brouillons internes absents');
 for(const mode of ['merge','replace'])await withDatabase(async db=>{
  let resultat;try{resultat=await applyArchive(db,inspection,{mode});}catch(e){ok(false,'L6 archive '+mode+' : restauration possible — '+e.message);return;}
  const tr=await db.get('recipe_translations',source.translation.id);
  ok(tr.revision!==source.translation.revision,'L6 archive '+mode+' : révision neuve à la restauration');
  eq(tr.translated_content,source.translation.translated_content,'L6 archive '+mode+' : aucun segment perdu ou nettoyé');
  eq([tr.source_signature,tr.source_locale],[source.translation.source_signature,'en'],'L6 archive '+mode+' : langue historique conservée malgré langue actuelle italienne');
  eq(tr.publication_receipt_floor,1,'L6 archive '+mode+' : ancien reçu exclu de la zone fiable');
  eq(lireRecuPublication(tr,source.translation.publication_receipts[0]),null,'L6 archive '+mode+' : reçu archivé ne prouve pas une publication actuelle');
  ok((await verifyRestored(db,inspection,{mode})).ok,'L6 archive '+mode+' : vérification relit les normalisations annoncées');
  eq((await db.get('recipe_versions',source.version.id)).notes,source.version.notes,'L6 archive '+mode+' : octets source signés intacts');
  ok(!!(await db.get('files',source.puts.files[0].sha256))?.blob,'L6 archive '+mode+' : photo conservée');
  eq((await db.get('recipes',source.recipe.id)).personal_notes,'Ma note personnelle.','L6 archive '+mode+' : note personnelle intacte');
  const avant=await db.getSnapshot();ok(await refuse(()=>applyArchive(db,inspection,{mode})),'L6 archive '+mode+' : nouvel import historique divergent exige comparaison');eq(await db.getSnapshot(),avant,'L6 archive '+mode+' : refus sans écriture partielle');
  await db.mutate({origin:'remote',puts:{recipe_translations:[{...tr,revision:'tr_op_'+'f'.repeat(64)}]}});
  ok(!(await verifyRestored(db,inspection,{mode,normalisationsTraductions:resultat.normalisationsTraductions})).ok,'L6 archive '+mode+' : révision altérée après restauration détectée');
 });
 for(const [nom,changer]of[
  ['format4 avec champs L6',(s,m)=>m.format_version=4],
  ['source culinaire différente',s=>s.recipe_versions[0].notes='Autres notes'],
  ['signature falsifiée',s=>s.recipe_translations[0].source_signature='d'.repeat(64)],
  ['hash de segment falsifié',s=>s.recipe_translations[0].translated_content.segments.find(x=>x.kind==='step').source_sha256='d'.repeat(64)],
  ['segment étranger',s=>s.recipe_translations[0].translated_content.segments.find(x=>x.kind==='step').source_id='absent'],
  ['provenance assistant absente',s=>Object.assign(s.recipe_translations[0].translated_content.segments[0],{origin:'ai',journal_id:'absent'})],
  ['groupes incomplets',s=>s.recipe_versions[0].ingredient_structure.blocks.pop()],
 ])ok(!(await transformer(archive,changer)).ok,'L6 archive : '+nom+' refusé avant écriture');
 for(const format of[1,2,3,4])await withDatabase(async db=>{await db.mutate({origin:'remote',puts:{books:[{id:'ancien'}]}});ok((await transformer(await createArchive(db),(s,m)=>m.format_version=format)).ok,'L6 archive : ancien format'+format+' sans champs réservés reste accepté');});
 await withDatabase(async db=>{
  await fixture(db);let atteinte=false,apres;
  const facade=Object.assign(Object.create(db),{mutate:async opts=>{if(opts.archive_import&&!atteinte){atteinte=true;const t=await db.get('recipe_translations',source.translation.id);t.translated_content.segments[0].text='Pain changé ailleurs';await db.mutate({origin:'remote',puts:{recipe_translations:[t]}});apres=await db.getSnapshot();}return db.mutate(opts);}});
  ok(await refuse(()=>applyArchive(facade,inspection)),'L6 archive : traduction changée après préparation refuse le commit');ok(atteinte,'L6 archive : course atteint la vraie transaction');eq(await db.getSnapshot(),apres,'L6 archive : aucune restauration partielle après la course');
 });
}

export async function runL6TransfertsTraductionTests({eq,ok}) {
 let preparer;try{({preparerTraductionsArchive:preparer}=await import('../src/domain/traductions-archive.js'));}catch{ok(false,'L6 transfert : préparateur fermé disponible');return;}
 const f=fixtureLectureL6(),tr=await traductionLectureL6(f),batch={recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:[tr],imports:[]};
 const avant=clone(batch),p=await preparer({batch,snapshot:{},owner_id:null,purpose:'bootstrap'}),c=p.translation_commands[0];
 eq(batch,avant,'L6 transfert : préparation pure conserve son entrée');
 eq([c?.op,c?.mode,c?.purpose],['translation_apply','restore','bootstrap'],'L6 transfert : commande réservée, aucun put traduction');
 eq(c.target,tr,'L6 transfert : cible historique intégrale');ok(!!await verifierCommandeTraduction(c),'L6 transfert : intention et payload signés');
 eq(p.batch.recipe_translations[0].revision,c.operation_id,'L6 transfert : révision locale correspond à l’intention');
 eq([c.recipe_id,c.recipe_version_id,c.edition_id,c.base_cycle_id,c.base_edition_cycle_id],[f.recipe.id,f.version.id,null,null,null],'L6 transfert : association et cycles capturés');
 ok(p.couvertes.has('recipe_translations:'+tr.id),'L6 transfert : cible retirée des put ordinaires');
 const snapshot={recipe_translations:[{...clone(tr),translated_content:{...tr.translated_content,segments:tr.translated_content.segments.map((s,i)=>i?s:{...s,text:'Autre'})}}]};
 ok(await refuse(()=>preparer({batch,snapshot,owner_id:null})),'L6 transfert : collision locale refusée avant transaction');
}

export async function runL6ArchivesJournauxTests({eq,ok}) {
 let archive,journal,translation;
 await withDatabase(async db=>{
  const f=await fixture(db),recipe={...f.recipe,original_language:'en'};delete recipe.display_title;
  const source=await capturerSourceTraduction({recipe,version:f.version});translation=clone(f.translation);
  const refs=source.segments.filter(s=>['title','step'].includes(s.kind)),operation_id='tr_op_'+'d'.repeat(64);
  journal={id:'l6-journal-archive',kind:'traduction',recipe_id:f.recipe.id,source_version_id:f.version.id,target_locale:'fr',owner_id:'ancien-proprietaire',edition_id:null,expected_cycle_id:'ancien-cycle',expected_edition_id:null,expected_edition_cycle_id:null,started_at:'2026-10-29T11:00:00.000Z',finished_at:'2026-10-29T11:01:00.000Z',model:'modele-test',translation_source_signature:source.source_signature,translation_capture:{format:1,source_locale:'en',title_capture:source.title_capture},translation_call:{format:1,series_id:'serie-archive',ordinal:0,segment_refs:refs.map(({ref,kind,source_id,field,source_sha256})=>({ref,kind,source_id,field,source_sha256,output_max_points:500}))},resultat:{format:1,segments:refs.map(s=>({ref:s.ref,text:translation.translated_content.segments.find(x=>x.kind===s.kind).text,issue:'admis'}))},translation_resolution_revision:operation_id,translation_resolutions:[],translation_resolution_receipts:[{operation_id,payload_sha256:'e'.repeat(64)}],status:'enregistre',erreur:null,scan_session_id:null,page_ids:[],created_at:'2026-10-29T10:59:00.000Z',updated_at:'2026-10-29T11:02:00.000Z'};
  for(const s of journal.resultat.segments)journal.translation_resolutions.push({ref:s.ref,decision:'adopte',text_sha256:await empreinteTexteTraduction(s.text)});
  for(const s of translation.translated_content.segments)if(['title','step'].includes(s.kind)){s.origin='ai';s.journal_id=journal.id;}
  ok(validerJournalTraduction(journal,{source}).ok,'L6 archive journal : témoin fermé valide avant corruption');
  await db.mutate({origin:'remote',puts:{imports:[journal],recipe_translations:[translation]}});archive=await createArchive(db);
 });
 const inspection=await inspectArchive(await archive.blob.arrayBuffer());eq(inspection.errors,[],'L6 archive journal : ancien titre, langue, propriétaire et cycle cohérents');
 await withRepo(async(repo,db)=>{
  const resultat=await applyArchive(db,inspection);const row=await db.get('imports',journal.id);
  const {projectionSeedSource}=await import('../src/domain/sources-format.js');eq(projectionSeedSource(row),projectionSeedSource(journal),'L6 archive journal : aucune capture actuelle inventée');
  const outbox=await db.getAll('outbox'),sources=outbox.filter(x=>x.op==='source_transfer'&&x.id===journal.id),trs=outbox.filter(x=>x.op==='translation_apply');
  eq(sources.map(x=>x.payload.phase),['begin','finish'],'L6 archive journal : transfert réservé sans parties');
  eq([sources[0]?.payload.part_count,sources[0]?.payload.row_count],[0,0],'L6 archive journal : zéro ligne cachée');
  eq(trs.length,1,'L6 archive journal : traduction capturée par une commande réservée');
  eq(outbox.filter(x=>x.op==='put'&&(x.id===journal.id||x.id===translation.id)).length,0,'L6 archive journal : aucun put ordinaire des lignes protégées');
  ok((await verifyRestored(db,inspection,{normalisationsTraductions:resultat.normalisationsTraductions})).ok,'L6 archive journal : résultat réel conforme après réception locale');
 });
 for(const[nom,changer]of[
  ['texte assistant différent',s=>s.recipe_translations[0].translated_content.segments.find(x=>x.origin==='ai').text='Autre proposition'],
  ['résolution absente',s=>{const j=s.imports[0];j.translation_resolutions=[];j.translation_resolution_receipts=[];j.translation_resolution_revision=null;j.status='a_verifier';}],
  ['hash de titre historique faux',s=>s.imports[0].translation_call.segment_refs.find(x=>x.kind==='title').source_sha256='f'.repeat(64)],
  ['capture de titre falsifiée',s=>s.imports[0].translation_capture.title_capture.fields[1][1][1]='Titre différent'],
 ])ok(!(await transformer(archive,changer)).ok,'L6 archive journal : '+nom+' refusé');
 const orpheline=await transformer(archive,s=>{s.recipes=[];s.recipe_versions=[];s.recipe_translations=[];});
 ok(orpheline.ok,'L6 archive journal : réponse orpheline encore récupérable sans source inventée');
 await withDatabase(async db=>{await applyArchive(db,orpheline);eq((await db.get('imports',journal.id)).resultat,journal.resultat,'L6 archive journal : résultat orphelin exact restauré');});
}
