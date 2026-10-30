// Format local des éditeurs : indépendant du dépôt, des vues et de la synchronisation.
import {validerBrouillonTraduction} from './traductions-locales-format.js';
import { sha256Hex } from '../core/hash.js';
import { newId } from '../core/ids.js';
export const PREFIXE_BROUILLON='editor_draft:v1:';
export const CLE_EPOQUE_EDITEUR='editor_library_epoch:v1';
export const LIMITES_BROUILLONS=Object.freeze({nombre:32,ligne:2097152,total:8388608,recus:128});
export class ErreurBrouillon extends Error{constructor(code,details=null){super(code);this.name='ErreurBrouillon';this.code=code;this.details=details;}}
export const objet=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export const idEditeur=x=>typeof x==='string'&&x.length>0&&x.length<=200&&!/[\u0000-\u001f\u007f]/.test(x);
export const cleBrouillon=id=>{if(!idEditeur(id))throw new ErreurBrouillon('contenu_invalide');return PREFIXE_BROUILLON+id;};
export const estCleEditeur=key=>key===CLE_EPOQUE_EDITEUR||typeof key==='string'&&key.startsWith(PREFIXE_BROUILLON)&&idEditeur(key.slice(PREFIXE_BROUILLON.length));
export const ligneEpoqueEditeur=(valeur=newId('epoque'))=>{if(!idEditeur(valeur))throw new ErreurBrouillon('contenu_invalide');return{key:CLE_EPOQUE_EDITEUR,value:valeur};};
export function canoniqueEditeur(value){
 const parcourir=(v,depth)=>{
  if(depth>64)throw new ErreurBrouillon('contenu_invalide');
  if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);
  if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(x=>parcourir(x,depth+1)).join(',')+']';
  if(objet(v)){if(Object.keys(v).some(k=>['__proto__','constructor','prototype'].includes(k)))throw new ErreurBrouillon('contenu_invalide');return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+parcourir(v[k],depth+1)).join(',')+'}';}
  throw new ErreurBrouillon('contenu_invalide');
 };return parcourir(value,0);
}
export const empreinteEditeur=value=>sha256Hex(canoniqueEditeur(value));
export const projectionVersionEditeur=version=>{if(!version)return null;const c=structuredClone(version);delete c.updated_at;return c;};
export const octetsEditeur=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export const valeurChamp=(record,key)=>Object.hasOwn(record||{},key)?{present:true,value:record[key]}:{present:false};
const kinds=['recipe_metadata','recipe_version','recipe_new','book_metadata'];
const isDate=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const ferme=(x,keys)=>objet(x)&&Object.keys(x).every(k=>keys.includes(k));
const idOuNull=x=>x===null||idEditeur(x);
const ids=x=>Array.isArray(x)&&x.every(idEditeur)&&new Set(x).size===x.length;
const cheminsRecette=['display_title','original_title','original_language','type','cuisines','tags','printed_page','source_label'].map(k=>'metadata.'+k).concat(['servings','yield_text','prep_minutes','cook_minutes','active_minutes','total_minutes','ingredients','ingredient_structure','steps','changes','notes','status'].map(k=>'contenu.'+k),'source_sans_thermomix');
const cheminsLivre=['book.title','book.author','book.cuisines','book.tags','edition.isbn','edition.publisher','edition.year','edition.language','edition.unit_convention_id'];
const projections={recipe_versions:'version-v1',source_pages:'source-v1',source_documents:'source-v1',scan_sessions:'session-v1',imports:'journal-v1'};
export function estRecuEditeur(row){try{return validerLigneEditeur(row).value.state==='committed';}catch{return false;}}

export function validerLigneEditeur(row){
 if(!objet(row)||Object.keys(row).some(k=>!['key','value'].includes(k))||!estCleEditeur(row.key))throw new ErreurBrouillon('contenu_invalide');
 if(row.key===CLE_EPOQUE_EDITEUR){if(!idEditeur(row.value))throw new ErreurBrouillon('contenu_invalide');return row;}
 const d=row.value;
 if(d?.kind==='recipe_translation')return validerBrouillonTraduction(row);
 if(!objet(d)||d.format!==1)throw new ErreurBrouillon('format_inconnu');
 const communs=['id','format','kind','owner_id','database_name','library_epoch','revision','state','created_at','saved_at','publication'];
 const etendus=['entity_id','base_version_id','edition_id','book_id','import_id','base_recipe_cycle_id','base_edition_cycle_id','base_association','base_source_signature','base_fields','changed_fields','pointer_decision','payload','intention'];
 if(Object.keys(d).some(k=>![...communs,...(d.state==='committed'?[]:etendus)].includes(k))||row.key!==cleBrouillon(d.id)||!kinds.includes(d.kind)||!idEditeur(d.database_name)||!idEditeur(d.library_epoch)||!(d.owner_id===null||idEditeur(d.owner_id))||!Number.isSafeInteger(d.revision)||d.revision<1||!['editing','blocked','committed'].includes(d.state)||!isDate(d.created_at)||!isDate(d.saved_at)||!objet(d.publication)||!idEditeur(d.publication.operation_id))throw new ErreurBrouillon('contenu_invalide');
 if(d.state==='committed'){
  if(!ferme(d.publication,['operation_id','published_revision','payload_sha256','committed_at','kind','recipe_id','version_id','book_id','edition_id','import_id'])||d.publication.kind!==d.kind||!Number.isSafeInteger(d.publication.published_revision)||d.publication.published_revision<1||d.revision!==d.publication.published_revision+1||!hash(d.publication.payload_sha256)||!isDate(d.publication.committed_at)||Object.entries(d.publication).some(([k,v])=>k.endsWith('_id')&&!idEditeur(v)))throw new ErreurBrouillon('contenu_invalide');
 }else{
  const chemins=d.kind==='book_metadata'?cheminsLivre:cheminsRecette;
  if(!['metadata','correction','adaptation','extraction'].includes(d.intention)||!idEditeur(d.entity_id)||!['base_version_id','edition_id','book_id','import_id','base_recipe_cycle_id','base_edition_cycle_id'].every(k=>idOuNull(d[k]))||!objet(d.payload)||!objet(d.base_fields)||!ferme(d.base_association,['edition_id','book_id','source_page_ids','lecture_page_ids','source_document_id','scan_session_id'])||!ferme(d.base_source_signature,['format','records'])||d.base_source_signature.format!==1||!Array.isArray(d.base_source_signature.records)||!Array.isArray(d.changed_fields)||!d.changed_fields.every(p=>chemins.includes(p))||new Set(d.changed_fields).size!==d.changed_fields.length)throw new ErreurBrouillon('contenu_invalide');
  const ancienSansStructure=d.kind!=='book_metadata'&&!Object.hasOwn(d.base_fields,'contenu.ingredient_structure')&&!Object.hasOwn(d.payload.contenu||{},'ingredient_structure');
  if(Object.keys(d.base_fields).length!==chemins.length-(ancienSansStructure?1:0)||Object.keys(d.base_fields).some(p=>!chemins.includes(p)))throw new ErreurBrouillon('contenu_invalide');
  for(const f of Object.values(d.base_fields))if(!ferme(f,['present','sha256','modele_sha256'])||typeof f.present!=='boolean'||!hash(f.sha256)||!hash(f.modele_sha256))throw new ErreurBrouillon('contenu_invalide');
  const a=d.base_association;
  if(!['edition_id','book_id','source_document_id','scan_session_id'].every(k=>idOuNull(a[k]))||!ids(a.source_page_ids)||!ids(a.lecture_page_ids)||a.edition_id!==d.edition_id||a.book_id!==d.book_id)throw new ErreurBrouillon('contenu_invalide');
  const refs=new Set();for(const r of d.base_source_signature.records){if(!ferme(r,['store','id','projection','sha256',...(r.store==='scan_sessions'?['page_ids','recipe_ids','document_ids']:[])])||!Object.hasOwn(projections,r.store)||projections[r.store]!==r.projection||!idEditeur(r.id)||!hash(r.sha256)||refs.has(r.store+':'+r.id))throw new ErreurBrouillon('contenu_invalide');if(r.store==='scan_sessions'&&!['page_ids','recipe_ids','document_ids'].every(k=>ids(r[k])))throw new ErreurBrouillon('contenu_invalide');refs.add(r.store+':'+r.id);}
  if(d.base_version_id&&!refs.has('recipe_versions:'+d.base_version_id)||d.import_id&&!refs.has('imports:'+d.import_id)||d.kind==='book_metadata'&&(d.entity_id!==d.edition_id||!d.book_id)||!ferme(d.publication,['operation_id','recipe_id','version_id'])||Object.entries(d.publication).some(([,v])=>!idEditeur(v))||d.kind!=='book_metadata'&&(d.publication.recipe_id!==d.entity_id||!idEditeur(d.publication.version_id)))throw new ErreurBrouillon('contenu_invalide');
  if(d.kind==='recipe_version'){const p=d.pointer_decision;if(!ferme(p,['mode','expected_current_version_id','reviewed'])||!['preserve','replace'].includes(p.mode)||!idOuNull(p.expected_current_version_id)||typeof p.reviewed!=='boolean')throw new ErreurBrouillon('contenu_invalide');}else if(d.pointer_decision!==undefined)throw new ErreurBrouillon('contenu_invalide');
 }
 canoniqueEditeur(d);
 if(octetsEditeur(row)>LIMITES_BROUILLONS.ligne)throw new ErreurBrouillon('limite_brouillon');
 return row;
}
export function verifierQuotaEditeur(rows,puts=[],deletes=[]){
 const finales=new Map(rows.filter(r=>r.key?.startsWith(PREFIXE_BROUILLON)).map(r=>[r.key,r]));
 for(const r of puts){validerLigneEditeur(r);if(r.key.startsWith(PREFIXE_BROUILLON))finales.set(r.key,r);}
 for(const key of deletes)finales.delete(key);
 let total=0,nombre=0;
 for(const row of finales.values()){total+=octetsEditeur(row);if(!estRecuEditeur(row))nombre++;}
 if(nombre>LIMITES_BROUILLONS.nombre)throw new ErreurBrouillon('limite_nombre');
 if(total>LIMITES_BROUILLONS.total)throw new ErreurBrouillon('limite_totale');
 return {total,nombre};
}
