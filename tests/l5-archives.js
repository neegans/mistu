import { withDatabase } from './backup.js';
import { createArchive, inspectArchive, applyArchive, verifyRestored } from '../src/domain/backup.js';
import { createZip, readZip, textOf } from '../src/core/zip.js';
import { sha256Hex } from '../src/core/hash.js';
import { empreinteSources, projectionIdentitePage, projectionAnnotationPage, projectionIdentiteDocument, projectionIdentiteSeance } from '../src/domain/sources-format.js';
import { preparerStockageIndex, reconstruireResultatIndex } from '../src/domain/index-stockage.js';
import { validerPageIndex } from '../src/domain/index-livre.js';

const refuse=async fn=>{try{await fn();return false;}catch{return true;}};
async function fixture(db) {
  const blob=new Blob(['Source L5 à conserver'],{type:'image/png'}),sha256=await sha256Hex(blob);
  const p={id:'p-source',edition_id:'e-source',document_id:'d-source',sha256,rotation:0,position:1,source_revision:{format:1,family_id:'p-source',parent_page_id:null,operation_id:'op-capture',reason:'capture'}};
  const s={id:'s-source',edition_id:'e-source',status:'open',page_ids:['p-source','p-tournee'],document_ids:['d-source'],recipe_ids:['r-source'],source_state:{format:1,revision:'op-tourner',active_page_ids:['p-tournee']}};
  const stores={books:[{id:'b-source',title:'Livre sauvegardé'}],book_editions:[{id:'e-source',book_id:'b-source'}],scan_sessions:[s],source_documents:[{id:'d-source',edition_id:'e-source',scan_session_id:s.id,source_type:'photo',sha256}],source_pages:[p,{...p,id:'p-tournee',rotation:90,position:2,source_revision:{format:1,family_id:p.id,parent_page_id:p.id,operation_id:'op-tourner',reason:'rotate'}}],recipes:[{id:'r-source',edition_id:'e-source',source_page_ids:[p.id],current_version_id:'v-source',original_title:'Pain',favorite:true}],recipe_versions:[{id:'v-source',recipe_id:'r-source',kind:'extraction',ingredients:[],steps:[],provenance:{source_page_ids:[p.id]}}],files:[{sha256,blob,size:blob.size,mime:blob.type}]};
  await db.mutate({origin:'remote',puts:stores});return stores;
}
async function transformer(archive,fn) {
  const zip=readZip(new Uint8Array(await archive.blob.arrayBuffer())),manifest=JSON.parse(textOf(zip.get('manifest.json'))),stores={};
  for(const df of manifest.data_files)stores[df.store]=JSON.parse(textOf(zip.get(df.path)));
  await fn(stores,manifest);
  const donnees=new Map();
  for(const df of manifest.data_files){const bytes=new TextEncoder().encode(JSON.stringify(stores[df.store]));df.sha256=await sha256Hex(bytes);df.count=stores[df.store].length;manifest.counts[df.store]=df.count;donnees.set(df.path,bytes);}
  return inspectArchive(createZip([...zip].map(([path,entry])=>({path,data:path==='manifest.json'?JSON.stringify(manifest):donnees.get(path)||entry.data}))));
}

export async function runL5ArchivesTests({eq,ok}) {
  let archive,source;
  await withDatabase(async db=>{source=await fixture(db);archive=await createArchive(db);});
  eq(archive.manifest.format_version,7,'L5 / L7 archive : format7 conserve les sources, groupes et traductions');
  const inspection=await inspectArchive(await archive.blob.arrayBuffer());
  ok(inspection.ok,'L5 archive : chaîne source et fichier complet sont inspectés');
  for(const mode of ['merge','replace'])await withDatabase(async db=>{
    const restauration=await applyArchive(db,inspection,{mode});
    eq((await db.getAll('source_pages')).map(p=>[p.id,p.rotation]).sort(),[['p-source',0],['p-tournee',90]],'L5 archive '+mode+' : toutes les révisions conservées');
    eq((await db.get('recipe_versions','v-source')).provenance.source_page_ids,['p-source'],'L5 archive '+mode+' : ancienne version cite encore son image exacte');
    eq((await db.get('scan_sessions','s-source')).source_state.active_page_ids,['p-tournee'],'L5 archive '+mode+' : sélection séparée de l’historique');
    ok((await verifyRestored(db,inspection,{mode})).ok,'L5 archive '+mode+' : contenu restauré vérifié');
    const session=await db.get('scan_sessions','s-source');
    ok(session.source_state.revision!=='op-tourner','L5 archive '+mode+' : jeton d’activation neuf, jamais réutilisé depuis la sauvegarde');
    eq(restauration.normalisationsSources.find(s=>s.id===session.id).source_state,session.source_state,'L5 archive '+mode+' : normalisation annoncée correspond à l’écriture');
    await db.mutate({origin:'remote',puts:{scan_sessions:[{...session,source_state:{...session.source_state,revision:'jeton-altere'}}]}});
    ok(!(await verifyRestored(db,inspection,{mode,normalisationsSources:restauration.normalisationsSources})).ok,'L5 archive '+mode+' : un jeton altéré après écriture reste détecté');
  });
  for(const [nom,changer] of [
    ['parent absent',s=>{s.source_pages[1].source_revision.parent_page_id='absente';}],
    ['boucle',s=>{s.source_pages[0].source_revision.parent_page_id='p-tournee';}],
    ['famille étrangère',s=>{s.source_pages[1].source_revision.family_id='autre';}],
    ['deux actifs de la même famille',s=>{s.scan_sessions[0].source_state.active_page_ids=['p-source','p-tournee'];}],
    ['actif hors historique',s=>{s.scan_sessions[0].source_state.active_page_ids=['absente'];}],
    ['copie historique absente',s=>{s.source_pages[0].source_copy={format:1,operation_id:'copie',source_id:'absente',source_identity_sha256:'a'.repeat(64)};}],
    ['format3 avec champs L5',(s,m)=>{m.format_version=3;}],
  ]) {
    const resultat=await transformer(archive,changer);
    ok(!resultat.ok,'L5 archive : '+nom+' refuse avant écriture');
  }
  for(const champ of ['rotation','sha256','source_revision'])await withDatabase(async db=>{
    await fixture(db);
    const p=await db.get('source_pages','p-tournee');
    p[champ]=champ==='rotation'?180:champ==='sha256'?'b'.repeat(64):{...p.source_revision,operation_id:'autre-intention'};
    await db.mutate({origin:'remote',puts:{source_pages:[p]}});
    const avant=await db.getSnapshot();
    ok(await refuse(()=>applyArchive(db,inspection)),'L5 archive : collision d’identité '+champ+' refusée');
    eq(await db.getSnapshot(),avant,'L5 archive : collision '+champ+' garde toute la base');
  });
  for(const format of [1,2,3])await withDatabase(async db=>{
    await db.mutate({origin:'remote',puts:{books:[{id:'b-ancien'}]}});
    const ancien=await transformer(await createArchive(db),(s,m)=>{m.format_version=format;});
    ok(ancien.ok,'L5 archive : ancien format '+format+' reste accepté sans champs réservés');
  });
  await withDatabase(async db=>{
    await fixture(db);let apresCourse,atteinte=false;
    const facade=Object.assign(Object.create(db),{mutate:async opts=>{
      if(opts.archive_import&&!atteinte){atteinte=true;const s=await db.get('scan_sessions','s-source');await db.mutate({origin:'remote',puts:{scan_sessions:[{...s,source_state:{...s.source_state,revision:'choix-autre-onglet',active_page_ids:['p-source']}}]}});apresCourse=await db.getSnapshot();}
      return db.mutate(opts);
    }});
    ok(await refuse(()=>applyArchive(facade,inspection)),'L5 archive : une sélection changée après préparation refuse le commit');
    ok(atteinte,'L5 archive : la course atteint vraiment la transaction finale');
    eq(await db.getSnapshot(),apresCourse,'L5 archive : refus atomique conserve tout le changement concurrent sans restauration partielle');
  });
  let copieArchive;
  await withDatabase(async db=>{
    const f=await fixture(db),s=f.scan_sessions[0],d=f.source_documents[0];
    d.original_filename='Photo\u0001source.png';await db.mutate({origin:'remote',puts:{source_documents:[d]}});
    const copier=async(row,projection,id)=>({...row,id,edition_id:'e-copie',source_copy:{format:1,operation_id:'copie-sources',source_id:row.id,source_identity_sha256:await empreinteSources(projection(row))}});
    const pages=[];
    for(const p of f.source_pages){const c=await copier(p,projectionIdentitePage,p.id+'-copie');c.document_id='d-copie';c.source_revision={...p.source_revision,family_id:'p-source-copie',parent_page_id:p.source_revision.parent_page_id?'p-source-copie':null,operation_id:'copie-sources',reason:p.source_revision.parent_page_id?p.source_revision.reason:'attach'};pages.push(c);}
    const doc=await copier(d,projectionIdentiteDocument,'d-copie');doc.scan_session_id='s-copie';doc.original_filename='Photo\u0001source.png';
    const seance=await copier(s,projectionIdentiteSeance,'s-copie');Object.assign(seance,{document_ids:['d-copie'],page_ids:pages.map(p=>p.id),recipe_ids:[],source_state:{format:1,revision:'copie-sources',active_page_ids:['p-tournee-copie']}});
    await db.mutate({origin:'remote',puts:{book_editions:[{id:'e-copie',book_id:'b-source'}],source_documents:[doc],source_pages:pages,scan_sessions:[seance]}});
    copieArchive=await createArchive(db);
  });
  const copie=await inspectArchive(await copieArchive.blob.arrayBuffer());
  ok(copie.ok,'L5 archive : copies entre éditions gardent leurs origines complètes');
  await withDatabase(async db=>{
    await applyArchive(db,copie);
    eq((await db.get('source_documents','d-copie')).original_filename,'Photo\u0001source.png','L5 archive : aucun nettoyage silencieux des octets signés d’une source');
    ok((await verifyRestored(db,copie)).ok,'L5 archive : provenance de copie vérifiée après réactivation avec nouveau jeton');
  });
  const copieAltere=await transformer(copieArchive,stores=>{stores.source_pages.find(p=>p.id==='p-tournee-copie').source_copy.source_identity_sha256='f'.repeat(64);});
  ok(!copieAltere.ok,'L5 archive : empreinte d’origine erronée refusée avant écriture');
  for(const [nom,changer] of [
    ['enfant promu racine',stores=>{const p=stores.source_pages.find(p=>p.id==='p-tournee-copie');p.source_revision={...p.source_revision,family_id:p.id,parent_page_id:null,reason:'attach'};}],
    ['opération de page différente',stores=>{stores.source_pages.find(p=>p.id==='p-tournee-copie').source_revision.operation_id='autre-copie';}],
    ['opération de document différente',stores=>{stores.source_documents.find(d=>d.id==='d-copie').source_copy.operation_id='autre-copie';}],
    ['opération de séance différente',stores=>{stores.scan_sessions.find(s=>s.id==='s-copie').source_copy.operation_id='autre-copie';}],
  ]) {
    const resultat=await transformer(copieArchive,changer);
    ok(!resultat.ok,'L5 archive : copie avec '+nom+' refusée avant écriture');
  }
  const copieAutreImage=await transformer(copieArchive,stores=>{stores.source_pages.find(p=>p.id==='p-tournee-copie').rotation=180;});
  ok(!copieAutreImage.ok,'L5 archive : citer la bonne origine ne permet pas de changer silencieusement l’image copiée');
  const copieAutreDocument=await transformer(copieArchive,stores=>{stores.source_documents.find(d=>d.id==='d-copie').original_filename='Autre.png';});
  ok(!copieAutreDocument.ok,'L5 archive : le document copié conserve aussi son identité originale');
  const sansDocument=await transformer(archive,stores=>{
    stores.source_documents=[];stores.scan_sessions[0].document_ids=[];
    for(const p of stores.source_pages)p.document_id=null;
    delete stores.source_pages[0].source_revision;
  });
  ok(sansDocument.ok,'L5 archive : rotation et historique d’une ancienne page sans document restent lisibles');
  const captureSansDocument=await transformer(archive,stores=>{
    stores.source_documents=[];stores.scan_sessions[0].document_ids=[];
    for(const p of stores.source_pages)p.document_id=null;
  });
  ok(!captureSansDocument.ok,'L5 archive : une capture neuve doit désigner son document réel');
  let archiveInline,journalInline,refInline;
  await withDatabase(async db=>{
    const f=await fixture(db),page=f.source_pages[1];
    journalInline={id:'j-index-inline',kind:'index',recipe_id:null,status:'enregistre',edition_id:'e-source',scan_session_id:'s-source',page_ids:[page.id],owner_id:null,
      index_call:{format:1,series_id:'lecture-inline',page_id:page.id,kind:'full',parent_call_id:null},
      source_capture:{format:2,session_id:'s-source',source_state_revision:'op-tourner',selected_page_ids:[page.id],pages:[{id:page.id,identity_sha256:await empreinteSources(projectionIdentitePage(page)),annotation_sha256:await empreinteSources(projectionAnnotationPage(page)),preparation_version:'index-image-v1',zone:{kind:'full',x:0,y:0,width:100,height:100,source_width:100,source_height:100},sent_image_sha256:'c'.repeat(64)}]},
      resultat:{format:2,pages:[{page_id:page.id,etat:'lue',...validerPageIndex({sorte_page:'table',entrees:[['Pain','12',null,'recette',false]],incertain:[]})}]}};
    refInline={id:'r-index-inline',edition_id:'e-source',original_title:'Pain',availability:'reference_only',current_version_id:null,source_page_ids:[page.id],index_page_id:page.id,index_import_id:journalInline.id};
    await db.mutate({origin:'remote',puts:{imports:[journalInline],recipes:[refInline,{...f.recipes[0],index_import_id:journalInline.id,index_page_id:page.id}]}});
    archiveInline=await createArchive(db);
  });
  const inline=await inspectArchive(await archiveInline.blob.arrayBuffer());
  ok(inline.ok,'L5 archive : réponse inline close et références complètes ou non restent lisibles');
  const inlineSansManifest=await transformer(archiveInline,stores=>{stores.imports[0].index_storage=null;});
  ok(inlineSansManifest.ok,'L5 archive : absence explicite de manifeste reste un résultat inline');
  const ancienneSansCapture=await transformer(archiveInline,stores=>{Object.assign(stores.imports[0],{source_capture:null,index_call:null,index_storage:null});});
  ok(ancienneSansCapture.ok,'L5 archive : champs optionnels nuls d’un journal ancien ne fabriquent pas de capture');

  await withDatabase(async db=>{
    let commandes=[];
    const facade=Object.assign(Object.create(db),{mutate:async opts=>{if(opts.archive_import)commandes=opts.source_commands;return db.mutate(opts);}});
    await applyArchive(facade,inline);
    const graphe=commandes.findIndex(c=>c.store==='scan_sessions'&&c.phase==='finish'),journal=commandes.findIndex(c=>c.store==='imports'&&c.id===journalInline.id&&c.phase==='begin');
    ok(graphe>=0&&journal>graphe,'L5 archive : le graphe des images précède la restauration du journal inline');
    ok(commandes.filter(c=>c.store==='imports'&&c.phase==='begin').every(c=>c.purpose==='archive'),'L5 archive : un ancien résultat utilise le transfert historique et non une réponse payée nouvelle');
    eq(commandes.flatMap(c=>c.rows||[]).filter(r=>r.store==='recipes').map(r=>r.id).sort(),['r-index-inline','r-source'],'L5 archive : références et recettes déjà complètes liées à cet index voyagent avec leur journal');
    eq((await db.get('imports',journalInline.id)).resultat,journalInline.resultat,'L5 archive : résultat inline exact préservé');
    eq((await db.get('imports',journalInline.id)).status,'enregistre','L5 archive : réponse inline close jamais rouverte');
    ok((await verifyRestored(facade,inline)).ok,'L5 archive : résultat inline et références restaurés vérifiés');
  });
  await withDatabase(async db=>{
    await fixture(db);await db.mutate({origin:'remote',puts:{recipes:[{...refInline,original_title:'Correction concurrente'}]}});const avant=await db.getSnapshot();
    ok(await refuse(()=>applyArchive(db,inline)),'L5 archive : collision de référence gérée refusée avant restauration');
    eq(await db.getSnapshot(),avant,'L5 archive : collision de référence conserve toute la bibliothèque');
  });
  let grosseArchive,logique,journalId;
  await withDatabase(async db=>{
    const sources=await fixture(db),page=sources.source_pages[1];
    const journal={id:'j-index-long',kind:'index',status:'enregistre',edition_id:'e-source',scan_session_id:'s-source',page_ids:['p-tournee'],owner_id:null,index_call:{format:1,series_id:'lecture-longue',page_id:'p-tournee',kind:'full',parent_call_id:null},source_capture:{format:2,session_id:'s-source',source_state_revision:'op-tourner',selected_page_ids:['p-tournee'],pages:[{id:'p-tournee',identity_sha256:await empreinteSources(projectionIdentitePage(page)),annotation_sha256:await empreinteSources(projectionAnnotationPage(page)),preparation_version:'index-image-v1',zone:{kind:'full',x:0,y:0,width:100,height:100,source_width:100,source_height:100},sent_image_sha256:'c'.repeat(64)}]}};
    logique={format:2,pages:[{page_id:'p-tournee',etat:'lue',moities:0,modele:'modele-test',...validerPageIndex({sorte_page:'table',entrees:Array.from({length:600},(_,i)=>['🍞'.repeat(196)+String(i).padStart(4,'0'),'🍐'.repeat(80),'🍎'.repeat(120),'recette',false]),incertain:[]})}]};
    let id=0;const packed=await preparerStockageIndex({journal,resultat:logique},{newId:()=>`fragment-archive-${++id}`});journalId=journal.id;
    await db.mutate({origin:'remote',puts:{imports:[packed.journal,...packed.fragments]}});
    grosseArchive=await createArchive(db);
  });
  const grosse=await inspectArchive(await grosseArchive.blob.arrayBuffer());
  ok(grosse.ok,'L5 archive : gros résultat payé avec tous ses fragments accepté');
  await withDatabase(async db=>{
    await applyArchive(db,grosse);
    const journal=await db.get('imports',journalId),imports=await db.getAll('imports');
    eq(await empreinteSources(await reconstruireResultatIndex({journal,imports})),await empreinteSources(logique),'L5 archive :600 entrées Unicode restaurées sans perte');
    eq(journal.status,'enregistre','L5 archive : restaurer un résultat historique ne le rouvre pas');
    ok((await verifyRestored(db,grosse)).ok,'L5 archive : vérification complète du manifeste restauré');
  });
  const ancienneCapture=await transformer(grosseArchive,stores=>{stores.source_pages.find(p=>p.id==='p-tournee').rotation=180;});
  ok(!ancienneCapture.ok,'L5 archive : capture liée à une autre identité source refusée même si le résultat et ses fragments restent exacts');
  const fragmentAltere=await transformer(grosseArchive,stores=>{stores.imports.find(j=>j.index_storage?.role==='result_fragment').index_storage.text+='x';});
  ok(!fragmentAltere.ok,'L5 archive : fragment altéré refuse toute restauration');
}
