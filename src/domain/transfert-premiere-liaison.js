// Première liaison uniquement : mêmes enveloppes conservées, aucun contenu courant adopté.
import {ErreurSources,verifierEmpreinteCommandeSources,signerCommandeSources,empreinteSources,projectionSeedSource,projectionCibleSources,identifiantSource} from './sources-format.js';
import {projectionIntentionTransfert,chaineInitialeTransfert,chainePartieTransfert} from './transferts-source.js';
const fail=()=>{throw new ErreurSources('premiere_liaison_refusee');};
async function resigner(c){const x=structuredClone(c);delete x.operation_id;delete x.payload_sha256;return signerCommandeSources({...x,operation_id:'st_op_'+await empreinteSources({projection:'source-transfer-operation-v1',command:x})});}
export async function preparerPremiereLiaisonTransfert({commandes,owner_id}={}){
 if(!identifiantSource(owner_id)||!Array.isArray(commandes)||commandes.length<2)fail();const xs=structuredClone(commandes),debut=xs[0],fin=xs.at(-1),parts=xs.slice(1,-1);
 if(debut?.op!=='source_transfer'||debut.phase!=='begin'||!['archive','bootstrap','attach'].includes(debut.purpose)||!['scan_sessions','imports'].includes(debut.store)||debut.store==='imports'&&!['archive','bootstrap'].includes(debut.purpose)||fin?.phase!=='finish'||fin.target?.id!==debut.id||parts.length!==debut.part_count||xs.length>4098)fail();
 for(const c of xs){await verifierEmpreinteCommandeSources(c);if(c.op!=='source_transfer'||c.transfer_id!==debut.transfer_id||c.id!==debut.id||c.store!==debut.store||c.edition_id!==debut.edition_id||c.base_edition_cycle_id!==debut.base_edition_cycle_id||(await resigner(c)).operation_id!==c.operation_id)fail();}
 if(debut.transfer_id!=='st_'+await empreinteSources(projectionIntentionTransfert({...debut,owner_id:null})))fail();
 let chaine=await chaineInitialeTransfert(debut);const manifeste=[];for(const [i,c]of parts.entries()){if(c.phase!=='part'||c.ordinal!==i||c.previous_chain_sha256!==chaine)fail();for(const r of c.rows){if(debut.store==='scan_sessions'?!['source_pages','source_documents'].includes(r.store):r.store==='imports'?r.data.index_storage?.role!=='result_fragment'||r.data.index_storage.manifest_id!==debut.id:r.store!=='recipes'||r.data.index_import_id!==debut.id)fail();manifeste.push([r.store,r.id,await empreinteSources(projectionSeedSource(r.data))]);}chaine=await chainePartieTransfert(chaine,i,c.payload_sha256);}
 const cible=debut.store==='scan_sessions'?projectionCibleSources(fin.target):{projection:'target-index-result-v1',data:fin.target};
 if(fin.last_chain_sha256!==chaine||manifeste.length!==debut.row_count||await empreinteSources(manifeste)!==debut.manifest_sha256||await empreinteSources(cible)!==debut.target_sha256)fail();
 const transfer_id='st_'+await empreinteSources(projectionIntentionTransfert({...debut,owner_id})),result=[await resigner({...debut,transfer_id})];chaine=await chaineInitialeTransfert(result[0]);
 for(const c of parts){const p=await resigner({...c,transfer_id,previous_chain_sha256:chaine});result.push(p);chaine=await chainePartieTransfert(chaine,p.ordinal,p.payload_sha256);}
 result.push(await resigner({...fin,transfer_id,last_chain_sha256:chaine}));return{commandes:result,revisionAvant:fin.operation_id,revisionApres:result.at(-1).operation_id};
}
