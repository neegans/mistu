// Comparaison persistée : base serveur de la commande et base locale du commit restent distinctes.
import {newId as idDefaut,nowIso} from '../core/ids.js';
import {CLE_EPOQUE_EDITEUR} from './brouillons-format.js';
import {lireCycleEdition} from './cycle-edition.js';
import {CLE_SOURCE_CONFIRMEE,estCommandeSources} from '../sync/commandes-sources.js';
import {ErreurSources,canoniqueSources,empreinteSources,projectionSessionSources,projectionIdentitePage,projectionAnnotationPage,projectionIdentiteDocument,pagesActivesSeance,historiquePage,validerEtatSources,signerCommandeSources,comparerUtf8} from './sources-format.js';
const copie=x=>structuredClone(x),egal=(a,b)=>canoniqueSources(a??null)===canoniqueSources(b??null),refuser=c=>{throw new ErreurSources(c);};
// Le geste ne décide que les familles examinées par l'ancienne commande.
export function selectionRepriseConfirmee(commande,session,pages){
 const famille=id=>{const p=pages.get(id);if(!p)refuser('source_changed');return p.source_revision?.family_id||id;};
 const touchees=new Set((['append','rotate','replace'].includes(commande.action)?commande.new_pages.map(x=>x.id):commande.base_sources.filter(x=>x.store==='source_pages').map(x=>x.id)).map(famille));
 const choix=new Map();for(const id of commande.active_page_ids)if(touchees.has(famille(id)))choix.set(famille(id),id);
 const ids=[],vus=new Set();for(const id of pagesActivesSeance(session)){const f=famille(id),next=touchees.has(f)?choix.get(f):id;if(next){ids.push(next);vus.add(f);}}
 for(const [f,id]of choix)if(!vus.has(f))ids.push(id);return ids;
}
export function creerServiceComparaisonSources({repo,getGeneration,newId=idDefaut,maintenant=nowIso}={}){
 const comparaisons=new WeakMap(),plans=new WeakMap();
 const encadrer=f=>async(...a)=>{try{return await f(...a);}catch(e){return typeof e?.code==='string'?{issue:'refuse',raison:e.code}:{issue:'echec',raison:e?.name==='QuotaExceededError'?'quota_stockage':'stockage_indisponible',reessayable:true};}};
 function verifier(d){if(repo.db!==d.base||getGeneration()!==d.generation||!d.estCourante())refuser('contexte_change');}
 async function portee(d){verifier(d);const [o,e]=await Promise.all([d.base.get('sync_state','user_id'),d.base.get('sync_state',CLE_EPOQUE_EDITEUR)]);verifier(d);if((o?.value??null)!==d.owner_id)refuser('compte_change');if(e?.value!==d.epoch)refuser('bibliotheque_remplacee');}
 async function lireComparaisonSources({sessionId,contexte={}}={}){
  const d={base:repo.db,generation:getGeneration(),owner_id:contexte.owner_id,estCourante:contexte.estCourante||(()=>true)};verifier(d);
  const [owner,epoque,file,conflits,session]=await Promise.all([d.base.get('sync_state','user_id'),d.base.get('sync_state',CLE_EPOQUE_EDITEUR),d.base.getAll('outbox'),d.base.getAll('sync_conflicts'),d.base.get('scan_sessions',sessionId)]);
  if((owner?.value??null)!==d.owner_id)refuser('compte_change');d.epoch=epoque?.value;const recuperations=conflits.filter(c=>c.kind==='source'&&c.user_id===d.owner_id&&c.resolution&&c.recovery?.session?.id===sessionId).map(c=>({id:c.id,choix:c.resolution.choix,...copie(c.recovery)}));
  const operations=file.filter(e=>(e.user_id===d.owner_id||e.user_id==null)&&estCommandeSources(e)&&e.store==='scan_sessions'&&e.id===sessionId).sort((a,b)=>a.seq-b.seq);
  const operation=operations.find(e=>e.lifecycle_blocked&&e.op==='source_revision'&&conflits.some(c=>c.id==='source:'+e.payload?.operation_id&&c.kind==='source'&&c.user_id===d.owner_id&&!c.resolution));
  if(!operation){verifier(d);return{issue:'ok',comparaison:null,recuperations};}
  if(!session||!d.epoch)refuser('reception_incomplete');d.operations=copie(operations);d.operation=copie(operation);d.conflit=copie(conflits.find(c=>c.id==='source:'+operation.payload.operation_id));d.conflits=operations.map(e=>({id:'source:'+e.payload.operation_id,row:copie(conflits.find(c=>c.id==='source:'+e.payload.operation_id)||null)}));d.confirmations=[];
  async function conf(store,id){const row=await d.base.get('sync_state',CLE_SOURCE_CONFIRMEE(store,id)),v=row?.value;if(v?.user_id!==d.owner_id||!Number.isSafeInteger(v?.server_seq)||v.server_seq<0||v.deleted_at||v.data?.id!==id)refuser('reception_incomplete');d.confirmations.push(copie(row));return copie(v.data);}
  const distante=await conf('scan_sessions',sessionId);if((distante.edition_id??null)!==(session.edition_id??null))refuser('source_changed');
  const pages=await Promise.all((distante.page_ids||[]).map(id=>conf('source_pages',id))),documents=await Promise.all((distante.document_ids||[]).map(id=>conf('source_documents',id)));
  const localePages=await Promise.all((session.page_ids||[]).map(id=>d.base.get('source_pages',id))),localeDocs=await Promise.all((session.document_ids||[]).map(id=>d.base.get('source_documents',id)));
  if(localePages.some(x=>!x)||localeDocs.some(x=>!x))refuser('reception_incomplete');
  const edition=session.edition_id?await d.base.get('book_editions',session.edition_id):null;
  if(session.edition_id&&(!edition||lireCycleEdition(edition).etat!=='active'||(edition.lifecycle_id??null)!==operation.payload.base_edition_cycle_id))refuser('edition_retiree');
  for(const [s,rows,projection]of [['source_pages',pages,projectionIdentitePage],['source_documents',documents,projectionIdentiteDocument]])for(const r of rows){const local=await d.base.get(s,r.id);if(!local||!egal(projection(local),projection(r)))refuser('reception_incomplete');if((r.edition_id??null)!==(session.edition_id??null)||s==='source_documents'&&r.scan_session_id!==sessionId)refuser('source_changed');}
  validerEtatSources(distante,new Map(pages.map(p=>[p.id,p])));validerEtatSources(session,new Map(localePages.map(p=>[p.id,p])));
  d.locale={session:copie(session),pages:copie(localePages),documents:copie(localeDocs),edition:copie(edition)};d.confirmee={session:distante,pages,documents,edition:copie(edition)};
  await portee(d);const comparaison={};comparaisons.set(comparaison,d);return{issue:'ok',comparaison,locale:copie(d.locale),confirmee:copie(d.confirmee),operations:copie(operations),recuperations};
 }
 function reprendreDonnees(comparaison){const d=comparaisons.get(comparaison);if(!d)refuser('contexte_change');if(d.operations.length!==1||d.locale.session.source_state?.revision!==d.operation.payload.operation_id)refuser('operations_dependantes');return d;}
 function reconciliation(d,decision,operation_id=null){return{session_id:d.locale.session.id,owner_id:d.owner_id,library_epoch:d.epoch,attendue:copie(d.operation),file:copie(d.operations),conflit:copie(d.conflit),conflits:copie(d.conflits),confirmations:copie(d.confirmations),locale:copie(d.locale),decision,operation_id};}
 function conditions(d){const metier={};for(const [store,rows]of [['scan_sessions',[d.locale.session]],['source_pages',d.locale.pages],['source_documents',d.locale.documents],['book_editions',d.locale.edition?[d.locale.edition]:[]]])metier[store]=rows.map(r=>({key:r.id,fusion:actuel=>{if(!egal(actuel,r))refuser(store==='book_editions'?'edition_retiree':'source_changed');return null;}}));return metier;}
 async function preparerRepriseConfirmee({comparaison}={}){
  const d=reprendreDonnees(comparaison);await portee(d);const c=d.operation.payload,serveur=d.confirmee,local=d.locale,op=newId('source'),connues=new Set(serveur.pages.map(p=>p.id)),docsConnus=new Set(serveur.documents.map(p=>p.id));
  const newPages=(c.new_pages||[]).map(x=>local.pages.find(p=>p.id===x.id)).filter(p=>p&&!connues.has(p.id)),newDocs=(c.new_documents||[]).map(x=>local.documents.find(p=>p.id===x.id)).filter(p=>p&&!docsConnus.has(p.id));
  for(const [xs,original,proj]of [[newPages,c.new_pages,projectionIdentitePage],[newDocs,c.new_documents,projectionIdentiteDocument]])for(const r of xs)if(!egal(proj(r),proj(original.find(x=>x.id===r.id).data)))refuser('source_changed');
  const map=new Map([...serveur.pages,...newPages].map(p=>[p.id,p])),documents=new Map([...serveur.documents,...newDocs].map(p=>[p.id,p])),sources=new Map();
  for(const id of new Set([...pagesActivesSeance(serveur.session),...c.active_page_ids]))for(const p of historiquePage(id,map)){if(connues.has(p.id))sources.set('source_pages:'+p.id,{store:'source_pages',row:p});const doc=documents.get(p.document_id);if(!doc)refuser('source_changed');if(docsConnus.has(doc.id))sources.set('source_documents:'+doc.id,{store:'source_documents',row:doc});}
  const base_sources=[];for(const {store,row}of sources.values())base_sources.push({store,id:row.id,identity_sha256:await empreinteSources(store==='source_pages'?projectionIdentitePage(row):projectionIdentiteDocument(row)),annotation_sha256:store==='source_pages'?await empreinteSources(projectionAnnotationPage(row)):null});base_sources.sort((a,b)=>comparerUtf8(a.store+'\0'+a.id,b.store+'\0'+b.id));
  const active=selectionRepriseConfirmee(c,serveur.session,map);
  const command=await signerCommandeSources({protocol:1,op:'source_revision',operation_id:op,store:'scan_sessions',id:serveur.session.id,edition_id:serveur.session.edition_id??null,base_edition_cycle_id:serveur.edition?.lifecycle_id??null,action:'select',base_session_sha256:await empreinteSources(projectionSessionSources(serveur.session,base_sources)),base_source_revision:serveur.session.source_state?.revision??null,base_sources,new_documents:newDocs.map(data=>({id:data.id,data})),new_pages:newPages.map(data=>({id:data.id,data})),active_page_ids:copie(active)});
  const recu={operation_id:op,payload_sha256:command.payload_sha256,result_revision:op,committed_at:maintenant()},session={...copie(serveur.session),page_ids:[...new Set([...serveur.session.page_ids,...newPages.map(p=>p.id)])],document_ids:[...new Set([...serveur.session.document_ids,...newDocs.map(p=>p.id)])],source_state:{format:1,revision:op,active_page_ids:copie(active)},source_receipts:[...(serveur.session.source_receipts||[]),recu].slice(-128)};
  validerEtatSources(session,map);await portee(d);const plan={};plans.set(plan,{d,command,session,newPages,newDocs,recu});return{issue:'ok',plan,apercu:{session:copie(session),pages:copie([...map.values()])}};
 }
 async function appliquerRepriseConfirmee({plan}={}){const p=plans.get(plan);if(!p)refuser('contexte_change');const{d}=p;await portee(d);const deja=await d.base.get('scan_sessions',p.session.id);if(deja?.source_receipts?.some(r=>r.operation_id===p.recu.operation_id&&r.payload_sha256===p.recu.payload_sha256))return{issue:'deja_applique',session:deja,recu:copie(p.recu)};
  const cs=conditions(d);cs.scan_sessions[0].fusion=r=>{if(!egal(r,d.locale.session))refuser('source_changed');return copie(p.session);};
  const result=await repo.muterSources({metier:{puts:{source_pages:p.newPages,source_documents:p.newDocs},conditions:cs,editions:d.locale.edition?[{edition_id:d.locale.edition.id,expected_cycle_id:d.locale.edition.lifecycle_id??null,owner_id:d.owner_id}]:[]},commandes:[p.command],reconciliation:reconciliation(d,'reprendre',p.command.operation_id)},{origin:'local',baseAttendue:d.base,contexteValide:()=>{verifier(d);return true;}});
  return{issue:'applique',session:result.metier.scan_sessions[0],recu:copie(p.recu)};
 }
 async function garderConfirmation({comparaison,conserverSuiteAPart=false}={}){const d=comparaisons.get(comparaison);if(!d)refuser('contexte_change');if(d.operations.some(e=>e.op!=='source_revision')||d.operations.length>1&&!conserverSuiteAPart)refuser('operations_dependantes');await portee(d);const cs=conditions(d);cs.scan_sessions[0].fusion=r=>{if(!egal(r,d.locale.session))refuser('source_changed');return copie(d.confirmee.session);};const result=await repo.muterSources({metier:{conditions:cs},reconciliation:reconciliation(d,'garder_serveur')},{origin:'local',baseAttendue:d.base,contexteValide:()=>{verifier(d);return true;}});return{issue:'applique',session:result.metier.scan_sessions[0]};}
 return{lireComparaisonSources:encadrer(lireComparaisonSources),preparerRepriseConfirmee:encadrer(preparerRepriseConfirmee),appliquerRepriseConfirmee:encadrer(appliquerRepriseConfirmee),garderConfirmation:encadrer(garderConfirmation)};
}
