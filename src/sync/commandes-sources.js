// Cohérence entre l'enveloppe immuable L5 et les lignes du même commit.
import {validerCommandeSources,canoniqueSources,octetsJsonbSources,LIMITES_SOURCES,ErreurSources} from '../domain/sources-format.js';
export const estCommandeSources=x=>['source_revision','index_apply','source_transfer'].includes(x?.op);
export const CLE_SOURCE_CONFIRMEE=(store,id)=>'source_confirmed:'+store+':'+id;
export function ciblesCommandeSources(c){
 if(!estCommandeSources(c))return[];let rows=[{store:c.store,id:c.id}];
 if(c.op==='source_revision')rows.push(...(c.new_pages||[]).map(r=>({store:'source_pages',id:r.id})),...(c.new_documents||[]).map(r=>({store:'source_documents',id:r.id})));
 if(c.op==='index_apply')rows.push(...[...(c.creates||[]),...(c.patches||[])].map(r=>({store:'recipes',id:r.id})),...(c.decisions||[]).map(r=>({store:'imports',id:r.journal_id})));
 if(c.op==='source_transfer')rows.push(...(c.rows||[]).map(r=>({store:r.store,id:r.id})));
 return [...new Map(rows.map(r=>[r.store+':'+r.id,r])).values()];
}
const normaliser=r=>{const c=structuredClone(r);delete c.created_at;delete c.updated_at;return c;};
const egal=(a,b)=>canoniqueSources(normaliser(a))===canoniqueSources(normaliser(b));
export function preparerCommandesSources({puts={},commandes=[]}={}){
 if(!Array.isArray(commandes))throw new ErreurSources('invalid_shape');const groupes=new Set(),ids=new Set();
 const prendre=(store,id)=>{const rs=(puts[store]||[]).filter(r=>r.id===id);if(rs.length!==1)throw new ErreurSources('invalid_shape');groupes.add(store+':'+id);if(octetsJsonbSources(rs[0])>LIMITES_SOURCES.ligne)throw new ErreurSources('too_large');return rs[0];};
 for(const c of commandes){validerCommandeSources(c);if(ids.has(c.operation_id))throw new ErreurSources('invalid_shape');ids.add(c.operation_id);
  if(c.op==='source_revision'){
   for(const [store,xs] of [['source_documents',c.new_documents],['source_pages',c.new_pages]])for(const x of xs)if(!egal(prendre(store,x.id),x.data))throw new ErreurSources('invalid_shape');
   const s=prendre('scan_sessions',c.id);if(s.edition_id!==c.edition_id||s.source_state?.revision!==c.operation_id||canoniqueSources(s.source_state.active_page_ids)!==canoniqueSources(c.active_page_ids)||!s.source_receipts?.some(r=>r.operation_id===c.operation_id&&r.payload_sha256===c.payload_sha256))throw new ErreurSources('invalid_shape');
  }else if(c.op==='index_apply'){
   for(const r of c.creates)if(!egal(prendre('recipes',r.id),r))throw new ErreurSources('invalid_shape');
   for(const p of c.patches){const r=prendre('recipes',p.id);for(const [k,v] of Object.entries(p.changes))if(canoniqueSources(r[k])!==canoniqueSources(v))throw new ErreurSources('invalid_shape');}
   for(const d of c.decisions)prendre('imports',d.journal_id);
  }else{
   if(c.phase==='part')for(const r of c.rows)if(!egal(prendre(r.store,r.id),r.data))throw new ErreurSources('invalid_shape');
   if(c.phase==='finish')prendre(c.store,c.id);
  }
 }
 return groupes;
}
