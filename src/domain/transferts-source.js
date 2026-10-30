// Préparation portable d’un transfert. Aucune écriture, aucun réseau, aucune nouvelle lecture payée.
import {newId,nowIso} from '../core/ids.js';
import {canoniqueSources,empreinteSources,projectionSeedSource,projectionCibleSources,projectionBaseTransfertSources,projectionSessionSources,projectionLectureIndex,pagesActivesSeance,validerEtatSources,signerCommandeSources,octetsJsonbSources,LIMITES_SOURCES,ErreurSources,comparerUtf8} from './sources-format.js';
const clone=x=>structuredClone(x),fail=c=>{throw new ErreurSources(c);};
export const projectionIntentionTransfert=c=>({projection:'source-transfer-intent-v1',purpose:c.purpose,owner_id:c.owner_id,nonce:c.nonce,requested_at:c.requested_at,not_after:c.not_after,store:c.store,id:c.id,edition_id:c.edition_id,base_edition_cycle_id:c.base_edition_cycle_id,base_target_sha256:c.base_target_sha256,target_sha256:c.target_sha256,manifest_sha256:c.manifest_sha256,part_count:c.part_count,row_count:c.row_count});
export const chaineInitialeTransfert=begin=>empreinteSources(['source-transfer-chain-v1',begin.payload_sha256]);
export const chainePartieTransfert=(previous,ordinal,payload)=>empreinteSources(['source-transfer-chain-v1',previous,ordinal,payload]);
async function commande(c){const sans=clone(c);delete sans.operation_id;delete sans.payload_sha256;const operation_id='st_op_'+await empreinteSources({projection:'source-transfer-operation-v1',command:sans});return signerCommandeSources({...sans,operation_id});}
export async function preparerTransfertSources({purpose,owner_id,target,store:storeCible=purpose==='index_result'?'imports':'scan_sessions',rows=[],baseTarget=null,edition_id=target?.edition_id??null,base_edition_cycle_id=null,nonce=newId('transfert'),requested_at=nowIso()}={}){
 if(!['bootstrap','archive','attach','index_result'].includes(purpose)||!target?.id||!Array.isArray(rows)||rows.length>499*4096)fail('invalid_shape');
 const store=storeCible,cible=clone(target);if(!['scan_sessions','imports'].includes(store)||purpose==='attach'&&store!=='scan_sessions'||purpose==='index_result'&&store!=='imports')fail('invalid_shape');delete cible.created_at;delete cible.updated_at;
 if(store==='scan_sessions'){const active=pagesActivesSeance(target);cible.source_state={format:1,active_page_ids:active};delete cible.source_receipts;}
 if(store==='imports'&&['archive','bootstrap'].includes(purpose)&&baseTarget!==null&&canoniqueSources(projectionSeedSource(baseTarget))!==canoniqueSources(projectionSeedSource(target)))fail('result_changed');
 const vus=new Set(),ordered=clone(rows);for(const r of ordered){if(!r||!['source_documents','source_pages','imports','recipes'].includes(r.store)||r.id!==r.data?.id||vus.has(r.store+':'+r.id)||(store==='imports'?(r.store==='imports'?r.data.index_storage?.role!=='result_fragment':r.store!=='recipes'||!['archive','bootstrap'].includes(purpose)||r.data.index_import_id!==target.id||(r.data.edition_id??null)!==edition_id):!['source_documents','source_pages'].includes(r.store)))fail('invalid_shape');vus.add(r.store+':'+r.id);if(octetsJsonbSources(r.data)>LIMITES_SOURCES.ligne)fail('too_large');}
 const manifeste=[];for(const r of ordered)manifeste.push([r.store,r.id,await empreinteSources(projectionSeedSource(r.data))]);
 const manifest_sha256=await empreinteSources(manifeste),target_sha256=await empreinteSources(store==='scan_sessions'?projectionCibleSources(cible):{projection:'target-index-result-v1',data:cible}),base_target_sha256=baseTarget===null?null:await empreinteSources(projectionBaseTransfertSources(baseTarget));
 const not_after=new Date(Date.parse(requested_at)+30*86400000).toISOString(),common={protocol:1,op:'source_transfer',store,id:target.id,edition_id,base_edition_cycle_id};
 // Les identités finales ont des longueurs fixes : le découpage peut être calculé avant leurs empreintes.
 const placeholder={...common,operation_id:'st_op_'+'0'.repeat(64),payload_sha256:'0'.repeat(64),transfer_id:'st_'+'0'.repeat(64),phase:'part',ordinal:4095,previous_chain_sha256:'0'.repeat(64),rows:[]};
 const parties=[],baseOctets=octetsJsonbSources(placeholder);let courant=[],octets=baseOctets;for(const r of ordered){const taille=octetsJsonbSources(r);if(courant.length&&(courant.length>=499||octets+taille+2>LIMITES_SOURCES.commande)){parties.push(courant);courant=[];octets=baseOctets;}octets+=taille+(courant.length?2:0);courant.push(r);if(octets>LIMITES_SOURCES.commande)fail('too_large');}if(courant.length)parties.push(courant);if(parties.length>4096)fail('too_large');
 const header={purpose,owner_id,nonce,requested_at,not_after,store,id:target.id,edition_id,base_edition_cycle_id,base_target_sha256,target_sha256,manifest_sha256,part_count:parties.length,row_count:ordered.length},transfer_id='st_'+await empreinteSources(projectionIntentionTransfert(header));delete header.owner_id;delete header.store;delete header.id;delete header.edition_id;delete header.base_edition_cycle_id;
 const begin=await commande({...common,transfer_id,phase:'begin',...header}),commandes=[begin];let chain=await chaineInitialeTransfert(begin);
 for(let ordinal=0;ordinal<parties.length;ordinal++){const part=await commande({...common,transfer_id,phase:'part',ordinal,previous_chain_sha256:chain,rows:parties[ordinal]});commandes.push(part);chain=await chainePartieTransfert(chain,ordinal,part.payload_sha256);}
 const finish=await commande({...common,transfer_id,phase:'finish',last_chain_sha256:chain,target:cible});commandes.push(finish);
 const resultat=store==='scan_sessions'?{...clone(target),source_state:{format:1,revision:finish.operation_id,active_page_ids:clone(cible.source_state.active_page_ids)},source_receipts:clone(baseTarget?.source_receipts||[])}:clone(target);
 return{commandes,cible:resultat,manifest:manifeste,transfer_id};
}

// Archive/bootstrap : capture tous les octets métier AVANT la transaction. Le caller joint ses propres CAS.
export async function preparerSourcesArchive({batch,snapshot={},owner_id,purpose='archive',maintenant=nowIso,newId:ids=newId}={}){
 const normalise=clone(batch),commandes=[],couvertes=new Set(),transferts=[];
 const pages=new Map([...(snapshot.source_pages||[]),...(normalise.source_pages||[])].map(r=>[r.id,r])),documents=new Map([...(snapshot.source_documents||[]),...(normalise.source_documents||[])].map(r=>[r.id,r]));
 const sessions=normalise.scan_sessions||[],sessionsParId=new Map(sessions.map(s=>[s.id,s])),seanceParPage=new Map(sessions.flatMap(s=>(s.page_ids||[]).map(id=>[id,s.id]))),ordre=[],visite=new Set(),enCours=new Set();
 // L'ordre d'un fichier d'archive n'est pas un ordre de dépendances. Les copies attendent leurs origines.
 const visiter=session=>{if(visite.has(session.id))return;if(enCours.has(session.id))fail('invalid_shape');enCours.add(session.id);
  const dependances=[session.source_copy?.source_id,...(session.document_ids||[]).map(id=>documents.get(documents.get(id)?.source_copy?.source_id)?.scan_session_id),...(session.page_ids||[]).map(id=>seanceParPage.get(pages.get(id)?.source_copy?.source_id))];
  for(const id of dependances)if(id&&id!==session.id&&sessionsParId.has(id))visiter(sessionsParId.get(id));enCours.delete(session.id);visite.add(session.id);ordre.push(session);
 };for(const session of sessions)visiter(session);
 for(const session of ordre){const i=sessions.findIndex(s=>s.id===session.id);if(!session.source_state&&!session.source_copy&&!(session.page_ids||[]).some(id=>pages.get(id)?.source_revision||pages.get(id)?.source_copy))continue;
  validerEtatSources(session,pages);const rows=[],seen=new Set(),docsEnAttente=new Map((session.document_ids||[]).map(id=>[id,documents.get(id)]));
  while(docsEnAttente.size){let progress=false;for(const[id,data]of docsEnAttente){if(!data||data.scan_session_id!==session.id)fail('source_changed');if(data.replaces_document_id&&docsEnAttente.has(data.replaces_document_id))continue;rows.push({store:'source_documents',id,data});seen.add('source_documents:'+id);docsEnAttente.delete(id);progress=true;}if(!progress)fail('invalid_shape');}
  const pend=new Map((session.page_ids||[]).map(id=>[id,pages.get(id)]));while(pend.size){let progress=false;for(const[id,data]of pend){if(!data)fail('source_changed');const parent=data.source_revision?.parent_page_id;if(parent&&pend.has(parent))continue;rows.push({store:'source_pages',id,data});seen.add('source_pages:'+id);pend.delete(id);progress=true;}if(!progress)fail('invalid_shape');}
  const edition=(normalise.book_editions||[]).find(e=>e.id===session.edition_id)||(snapshot.book_editions||[]).find(e=>e.id===session.edition_id),baseTarget=(snapshot.scan_sessions||[]).find(s=>s.id===session.id)||null;
  const p=await preparerTransfertSources({purpose,owner_id,target:session,rows,baseTarget,edition_id:session.edition_id??null,base_edition_cycle_id:edition?.lifecycle_id??null,nonce:ids('transfert'),requested_at:maintenant()});sessions[i]=p.cible;commandes.push(...p.commandes);transferts.push({id:p.transfer_id,command_ids:p.commandes.map(c=>c.operation_id)});for(const k of seen)couvertes.add(k);couvertes.add('scan_sessions:'+session.id);
 }
 const imports=new Map([...(snapshot.imports||[]),...(normalise.imports||[])].map(r=>[r.id,r])),toutesSessions=new Map([...(snapshot.scan_sessions||[]),...sessions].map(r=>[r.id,r]));
 const references=normalise.recipes||[],candidats=new Map((normalise.imports||[]).map(r=>[r.id,r]));
 for(const reference of references){const journal=imports.get(reference.index_import_id);if(journal)candidats.set(journal.id,journal);}
 for(const journal of candidats.values()){
  if(journal.kind!=='index'||journal.index_storage?.role==='result_fragment')continue;
  const seance=toutesSessions.get(journal.scan_session_id),refs=references.filter(r=>r.index_import_id===journal.id);
  const geree=!!seance&&(!!seance.source_state||!!seance.source_copy||(seance.page_ids||[]).some(id=>pages.get(id)?.source_revision||pages.get(id)?.source_copy));
  if(journal.index_storage?.role!=='page_manifest'&&!journal.source_capture&&!journal.index_call&&!(refs.length&&geree))continue;
  const rows=(journal.index_storage?.fragments||[]).map(f=>{const data=imports.get(f.id);if(!data||data.index_storage?.role!=='result_fragment'||data.index_storage.manifest_id!==journal.id)fail('source_changed');return{store:'imports',id:data.id,data};});
 for(const r of refs){const courante=(snapshot.recipes||[]).find(x=>x.id===r.id);if(courante&&canoniqueSources(projectionSeedSource(courante))!==canoniqueSources(projectionSeedSource(r)))fail('id_collision');}
  rows.push(...refs.map(data=>({store:'recipes',id:data.id,data})));
  const edition=(normalise.book_editions||[]).find(e=>e.id===journal.edition_id)||(snapshot.book_editions||[]).find(e=>e.id===journal.edition_id),baseTarget=(snapshot.imports||[]).find(r=>r.id===journal.id)||null;
  const p=await preparerTransfertSources({purpose,store:'imports',owner_id,target:journal,rows,baseTarget,edition_id:journal.edition_id??null,base_edition_cycle_id:edition?.lifecycle_id??null,nonce:ids('transfert'),requested_at:maintenant()});
  if(!(normalise.imports||[]).some(r=>r.id===journal.id))(normalise.imports||=[]).push(clone(journal));
  commandes.push(...p.commandes);transferts.push({id:p.transfer_id,command_ids:p.commandes.map(c=>c.operation_id)});couvertes.add('imports:'+journal.id);for(const r of rows)couvertes.add(r.store+':'+r.id);
 }

 return{batch:normalise,source_commands:commandes,internes:[],conditions:{},couvertes:[...couvertes],transferts};
}
