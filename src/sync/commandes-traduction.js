import {estCommandeInventaire,ciblesCommandeInventaire} from './commandes-inventaire.js';
// Les commandes L6 et leurs lignes finales doivent faire partie du même commit.
import {validerCommandeTraduction,validerLigneTraductionV2,ErreurTraduction} from '../domain/traductions-format.js';
import {canoniqueSources,octetsJsonbSources} from '../domain/sources-format.js';
import {estCommandeSources,ciblesCommandeSources,preparerCommandesSources} from './commandes-sources.js';
import {estCommandeCuisine,ciblesCommandeCuisine} from './commandes-cuisine.js';
export const estCommandeTraduction=x=>x?.op==='translation_apply';
export const estCommandeProtegee=x=>estCommandeSources(x)||estCommandeTraduction(x)||estCommandeCuisine(x)||estCommandeInventaire(x);
export const ciblesCommandeProtegee=c=>estCommandeInventaire(c)?ciblesCommandeInventaire(c):estCommandeCuisine(c)?ciblesCommandeCuisine(c):estCommandeTraduction(c)?ciblesCommandeTraduction(c):ciblesCommandeSources(c);
export const estLectureTraductionSignee=(store,row)=>store==='imports'&&!!row&&(row.translation_capture!==undefined||row.translation_call!==undefined)||store==='recipe_translations'&&row?.alignment_format===2||store==='recipe_versions'&&Object.hasOwn(row||{},'ingredient_structure');
export const estPhaseJournalTraduction=e=>e?.op==='put'&&e.store==='imports'&&e.snapshot?.kind==='traduction';
export function idsVersionsSourcesTraduction(stores={},entrees=[]){
  const ids=new Set(),lire=(store,row)=>{if(store==='imports'&&row?.kind==='traduction'&&row.source_version_id)ids.add(row.source_version_id);if(store==='recipe_translations'&&row?.alignment_format===2&&row.recipe_version_id)ids.add(row.recipe_version_id);};
  for(const store of ['imports','recipe_translations'])for(const row of stores[store]||[])lire(store,row);
  for(const e of entrees){lire(e.store,e.snapshot||e.payload);const c=e.payload;if(estCommandeTraduction(c)&&c.recipe_version_id)ids.add(c.recipe_version_id);if(c?.op==='source_transfer'){lire(c.store,c.target);for(const r of c.rows||[])lire(r.store,r.data);}}
  return ids;
}
export function ciblesCommandeTraduction(c){if(!estCommandeTraduction(c))return[];return[...new Map([{store:c.store,id:c.id},...(c.journal_read_set||[]).map(j=>({store:'imports',id:j.journal_id}))].map(r=>[r.store+':'+r.id,r])).values()];}
export function lecturesCommandeTraduction(c){if(!estCommandeTraduction(c))return[];return[...(c.recipe_id?[{store:'recipes',id:c.recipe_id}]:[]),...(c.recipe_version_id?[{store:'recipe_versions',id:c.recipe_version_id}]:[]),...(c.edition_id?[{store:'book_editions',id:c.edition_id}]:[]),...(c.journal_read_set||[]).map(j=>({store:'imports',id:j.journal_id})),...(c.target?.translated_content?.segments||[]).filter(s=>s.origin==='ai').map(s=>({store:'imports',id:s.journal_id})),...(c.expected_translations||[]).map(t=>({store:'recipe_translations',id:t.id}))];}
const fail=()=>{throw new ErreurTraduction('commande_non_couverte');};
const contenu=x=>{const c=structuredClone(x);delete c.created_at;delete c.updated_at;delete c.publication_receipts;delete c.publication_receipt_floor;return c;};
export function preparerCommandesTraduction({puts={},commandes=[],source_commands=[]}={}){
  if(!Array.isArray(commandes))fail();const groupe=new Set(),ids=new Set();
  const sources=preparerCommandesSources({puts,commandes:source_commands});
  const prendre=(store,id)=>{const rs=(puts[store]||[]).filter(r=>r.id===id);if(rs.length!==1||octetsJsonbSources(rs[0])>524288)fail();groupe.add(store+':'+id);return rs[0];};
  for(const c of commandes){const v=validerCommandeTraduction(c);if(!v.ok||ids.has(c.operation_id))fail();ids.add(c.operation_id);
    if(c.mode==='publish'||c.mode==='restore'){
      const row=prendre('recipe_translations',c.id),cible=c.mode==='publish'?c.translation:{...c.target,revision:c.operation_id};
      if(!validerLigneTraductionV2(row).ok||canoniqueSources(contenu(row))!==canoniqueSources(contenu(cible))||!row.publication_receipts.some(r=>r.operation_id===c.operation_id&&r.payload_sha256===c.payload_sha256))fail();
    }
    for(const j of c.journal_read_set||[]){const row=prendre('imports',j.journal_id);if(row.kind!=='traduction'||row.translation_resolution_revision!==c.operation_id||!Array.isArray(row.translation_resolutions)||!row.translation_resolution_receipts?.some(r=>r.operation_id===c.operation_id&&r.payload_sha256===c.payload_sha256))fail();for(const d of j.decisions)if(!row.translation_resolutions.some(x=>canoniqueSources(x)===canoniqueSources(d)))fail();}
  }
  for(const r of puts.recipe_translations||[])if((r.alignment_format===2||r.translated_content?.format===2)&&!groupe.has('recipe_translations:'+r.id))fail();
  for(const r of puts.imports||[])if(r.kind==='traduction'&&(r.translation_resolution_revision!=null||r.translation_resolutions?.length||r.translation_resolution_receipts?.length)&&!groupe.has('imports:'+r.id)&&!sources.has('imports:'+r.id))fail();
  return groupe;
}
