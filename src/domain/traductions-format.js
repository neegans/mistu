// Feuille L6 : identité et alignement des traductions. Aucun dépôt, DOM, appel ou crypto en transaction.
import {canoniqueSources,empreinteSources,presenceSource,identifiantSource,comparerUtf8,octetsJsonbSources} from './sources-format.js';
import {porteUneAdresse} from '../core/bornes.js';
export const LIMITES_TRADUCTION_V2=Object.freeze({ingredients:200,etapes:200,titres:100,segments:903,portion:24,portions:32,sourcePoints:6000,portionPoints:24000,portionOctets:131072,totalPoints:200000,ligne:524288,commande:786432,lot:921600,recus:128,reponse:2097152,reservation:3145728,reserveTotale:8388608,reponses:8});
export const BORNES_SEGMENT_TRADUCTION=Object.freeze({title:1000,'ingredient/name':2000,'ingredient/preparation':2000,'ingredient/source':2000,heading:300,step:10000,notes:10000,yield:200});
export const CHAMPS_SOURCE_TRADUCTION=Object.freeze(['servings','yield_text','ingredients','ingredient_structure','steps','notes','constraints','convention_snapshot','provenance.thermomix','provenance.thermomix_invalide','provenance.convention_snapshot','plan_invalide']);
export const CHAMPS_LECTURE_TRADUCTION=Object.freeze(['id','kind','recipe_id','source_version_id','target_locale','owner_id','edition_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id','started_at','model','translation_source_signature','translation_capture','translation_call','resultat']);
export const dateTraduction=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$(?![\s\S])/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x.replace(/Z$/,x.includes('.')?'Z':'.000Z');
export class ErreurTraduction extends Error{constructor(code,details=null){super(code);this.name='ErreurTraduction';this.code=code;this.details=details;}}
const fail=(code='forme_invalide')=>{throw new ErreurTraduction(code);},clone=structuredClone,own=(o,k)=>Object.hasOwn(o||{},k),obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const closed=(x,keys)=>obj(x)&&Object.keys(x).every(k=>keys.includes(k))&&keys.every(k=>own(x,k));
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x),operation=x=>typeof x==='string'&&/^tr_op_[0-9a-f]{64}$/.test(x),integer=(x,max)=>Number.isInteger(x)&&x>=0&&x<=max;
const result=fn=>{try{return{ok:true,valeur:fn()};}catch(e){return{ok:false,raison:e instanceof ErreurTraduction?e.code:'forme_invalide'};}};
const points=s=>typeof s==='string'?[...s].length:Infinity;
const text=(s,max)=>{if(typeof s!=='string'||points(s)>max)fail('bornes');try{canoniqueSources(s);}catch{fail();}return s;};
export function normaliserLocaleSource(value){if(typeof value!=='string'||!/^([A-Za-z]{2,3})(?:-([A-Za-z]{2}))?$(?![\s\S])/.test(value))return null;const[a,b]=value.split('-');return a.toLowerCase()+(b?'-'+b.toUpperCase():'');}
const field=(row,path)=>{const ks=path.split('.');let r=row;for(const k of ks.slice(0,-1)){if(!obj(r)||!own(r,k))return[false];r=r[k];}return presenceSource(r,ks.at(-1));};
export function projectionSourceTraductionV2({recipe,version,source_locale=normaliserLocaleSource(recipe?.original_language)}){return{projection:'translation-source-v2',recipe_id:recipe?.id,recipe_version_id:version?.id,source_locale,fields:CHAMPS_SOURCE_TRADUCTION.map(k=>[k,field(version,k)])};}
export const projectionTitreTraduction=({recipe,version})=>({projection:'translation-title-v1',recipe_id:recipe.id,recipe_version_id:version.id,fields:['display_title','original_title'].map(k=>[k,presenceSource(recipe,k)])});
export const projectionLectureTraduction=row=>({projection:'translation-reading-v1',fields:CHAMPS_LECTURE_TRADUCTION.map(k=>[k,presenceSource(row,k)])});
export const projectionResolutionTraduction=row=>({projection:'translation-resolution-v1',revision:row.translation_resolution_revision??null,resolutions:clone(row.translation_resolutions||[]).sort((a,b)=>comparerUtf8(a.ref,b.ref))});
export function projectionCandidateTraduction(row){const data=clone(row);delete data.created_at;delete data.updated_at;delete data.publication_receipts;return{projection:'translation-candidate-v1',data};}
export function projectionSeedTraduction(row){const data=clone(row);delete data.created_at;delete data.updated_at;return{projection:'translation-seed-v1',data};}
export const refSegmentTraduction=({recipe_version_id,kind,source_id,field})=>empreinteSources(['translation-ref-v1',recipe_version_id,kind,source_id,field]).then(h=>'ts_'+h);
export const empreinteTexteTraduction=texte=>empreinteSources(texte);
const refValide=x=>typeof x==='string'&&/^ts_[0-9a-f]{64}$/.test(x);
const key=s=>s.kind+'\0'+s.source_id+'\0'+s.field;
const formeSegment=s=>closed(s,['kind','source_id','field','source_sha256','text','origin','journal_id'])&&identifiantSource(s.source_id)&&hash(s.source_sha256)&&((['title','heading','step','notes','yield'].includes(s.kind)&&s.field==='text')||(s.kind==='ingredient'&&['name','preparation','source'].includes(s.field)));
export const borneSegmentTraduction=s=>BORNES_SEGMENT_TRADUCTION[s.kind==='ingredient'?s.kind+'/'+s.field:s.kind];
export async function capturerSourceTraduction({recipe,version}={}){
 recipe=clone(recipe);version=clone(version); // Copier avant le premier await : le formulaire ne peut déplacer cette base.
 if(!obj(recipe)||!obj(version)||!identifiantSource(recipe.id)||!identifiantSource(version.id)||version.recipe_id!==recipe.id||!Array.isArray(version.ingredients)||!Array.isArray(version.steps))fail('source_invalide');
 if(version.ingredients.length>200||version.steps.length>200||octetsJsonbSources(version)>LIMITES_TRADUCTION_V2.ligne)fail('bornes');
 for(const rows of [version.ingredients,version.steps]){const ids=new Set();for(const row of rows){if(!obj(row)||!identifiantSource(row.id)||ids.has(row.id))fail('identites_invalides');ids.add(row.id);}}
 if(own(version,'ingredient_structure')){const {validerStructureIngredients}=await import('./structure-ingredients.js'),v=validerStructureIngredients(version.ingredient_structure,version.ingredients);if(!v.ok)fail(v.raison);}
 const source_locale=normaliserLocaleSource(recipe.original_language),projection=projectionSourceTraductionV2({recipe,version,source_locale}),title_capture=projectionTitreTraduction({recipe,version});
 const base={recipe_id:recipe.id,recipe_version_id:version.id,source_locale},raw=[];
 const add=(kind,source_id,field,texte)=>{if(typeof texte!=='string')fail('source_invalide');canoniqueSources(texte);raw.push({kind,source_id,field,text:texte});};
 add('title',version.id,'text',recipe.display_title||recipe.original_title||'');
 for(const row of version.ingredients)for(const[k,f]of [['name_text','name'],['preparation','preparation'],['source_text','source']]){if(row[k]!==undefined&&row[k]!==null&&typeof row[k]!=='string')fail('source_invalide');if(row[k])add('ingredient',row.id,f,row[k]);}
 for(const block of version.ingredient_structure?.blocks||[])if(block.kind==='heading')add('heading',block.id,'text',block.text);
 for(const step of version.steps)add('step',step.id,'text',step.text);
 for(const[k,kind]of [['notes','notes'],['yield_text','yield']]){if(version[k]!==undefined&&version[k]!==null&&typeof version[k]!=='string')fail('source_invalide');if(version[k])add(kind,version.id,'text',version[k]);}
 if(raw.length>LIMITES_TRADUCTION_V2.segments)fail('bornes');
 const segments=await Promise.all(raw.map(async s=>({...s,ref:await refSegmentTraduction({...s,recipe_version_id:version.id}),source_sha256:await empreinteSources({projection:'translation-segment-v1',recipe_version_id:version.id,kind:s.kind,source_id:s.source_id,field:s.field,text:s.text,source_locale})})));
 return Object.freeze({...base,projection,source_signature:await empreinteSources(projection),title_capture,title_sha256:await empreinteSources(title_capture),segments:Object.freeze(segments.map(Object.freeze))});
}
// Vérifier la capture conservée contre ses propres octets, sans adopter la source courante.
export async function verifierCaptureTraduction(source){
 if(!obj(source)||!obj(source.projection)||!obj(source.title_capture)||!Array.isArray(source.projection.fields)||!Array.isArray(source.title_capture.fields))fail('source_invalide');
 const recipe={id:source.recipe_id,original_language:source.source_locale},version={id:source.recipe_version_id,recipe_id:source.recipe_id};
 const poser=(target,fields,names)=>{if(fields.length!==names.length)fail('source_invalide');for(let i=0;i<names.length;i++){const pair=fields[i];if(!Array.isArray(pair)||pair.length!==2||pair[0]!==names[i]||!Array.isArray(pair[1]))fail('source_invalide');const v=pair[1];if(v[0]===false&&v.length===1)continue;if(v[0]!==true||v.length!==2)fail('source_invalide');const path=names[i].split('.');let row=target;for(const k of path.slice(0,-1))row=row[k]??={};row[path.at(-1)]=clone(v[1]);}};
 poser(version,source.projection.fields,CHAMPS_SOURCE_TRADUCTION);poser(recipe,source.title_capture.fields,['display_title','original_title']);
 const expected=await capturerSourceTraduction({recipe,version});if(canoniqueSources(source)!==canoniqueSources(expected))fail('source_invalide');return true;
}
const ligneKeys=['id','recipe_version_id','locale','alignment_format','source_signature','source_locale','revision','translated_content','verification_state','publication_receipts','publication_receipt_floor','created_at','updated_at'];
export function validerLigneTraductionV2(row){return result(()=>{
 if(!closed(row,ligneKeys)||!identifiantSource(row.id)||!identifiantSource(row.recipe_version_id)||!['fr','en'].includes(row.locale)||row.alignment_format!==2||!hash(row.source_signature)||row.source_locale!==null&&normaliserLocaleSource(row.source_locale)!==row.source_locale||!operation(row.revision)||row.verification_state!=='unverified'||!closed(row.translated_content,['format','segments'])||row.translated_content.format!==2||!Array.isArray(row.translated_content.segments)||row.translated_content.segments.length>LIMITES_TRADUCTION_V2.segments||![row.created_at,row.updated_at].every(dateTraduction))fail();
 if(!Array.isArray(row.publication_receipts)||row.publication_receipts.length>128||!integer(row.publication_receipt_floor,row.publication_receipts.length))fail();const ids=new Set();for(const r of row.publication_receipts){if(!closed(r,['operation_id','payload_sha256'])||!operation(r.operation_id)||!hash(r.payload_sha256)||ids.has(r.operation_id))fail();ids.add(r.operation_id);}
 let total=0;const vus=new Set();for(const s of row.translated_content.segments){if(!formeSegment(s)||vus.has(key(s)))fail('alignement');vus.add(key(s));if(s.text===null){if(s.origin!==null||s.journal_id!==null)fail('provenance_invalide');}else{total+=points(text(s.text,borneSegmentTraduction(s)));if(s.origin==='manual'?s.journal_id!==null:s.origin!=='ai'||!identifiantSource(s.journal_id))fail('provenance_invalide');}}
 if(total>LIMITES_TRADUCTION_V2.totalPoints||octetsJsonbSources(row)>LIMITES_TRADUCTION_V2.ligne)fail('bornes');return clone(row);
 });}
export function validerTraductionV2(row,source,{historique=false}={}){return result(()=>{
 const v=validerLigneTraductionV2(row);if(!v.ok)fail(v.raison);if(!source||row.recipe_version_id!==source.recipe_version_id||row.translated_content.segments.length!==source.segments.length)fail('alignement');
 for(let i=0;i<source.segments.length;i++){const a=source.segments[i],b=row.translated_content.segments[i];if(key(a)!==key(b))fail('alignement');if(!historique&&a.kind!=='title'&&a.source_sha256!==b.source_sha256)fail('source_changee');}
 if(!historique&&(row.source_signature!==source.source_signature||row.source_locale!==source.source_locale))fail('source_changee');return clone(row);
 });}
export function lireTraductionV2(row,source){
 const coverage={attendus:source?.segments?.length||0,traduits:0,manquants:0,perimes:0};
 const fallback=(etat,raison=null)=>({etat,raison,couverture:{...coverage,manquants:coverage.attendus},segments:(source?.segments||[]).map(s=>({...s,source_text:s.text,translation_text:null,origin:null,journal_id:null,etat:'manquant',langue:source.source_locale}))});
 if(row==null)return fallback('absente');if(row.alignment_format!==2)return fallback(row.alignment_format===undefined||row.alignment_format===1?'ancienne':'invalide','format');
 const valid=validerTraductionV2(row,source,{historique:true});if(!valid.ok)return fallback('invalide',valid.raison);
 const globalPerime=row.source_signature!==source.source_signature||row.source_locale!==source.source_locale;
 const segments=source.segments.map((s,i)=>{const t=row.translated_content.segments[i],perime=globalPerime||s.source_sha256!==t.source_sha256,etat=t.text===null?'manquant':perime?'perime':'traduit';if(etat==='manquant')coverage.manquants++;else if(etat==='perime')coverage.perimes++;else coverage.traduits++;return{ref:s.ref,kind:s.kind,source_id:s.source_id,field:s.field,source_sha256:s.source_sha256,source_text:s.text,translation_text:etat==='traduit'?t.text:null,origin:etat==='traduit'?t.origin:null,journal_id:etat==='traduit'?t.journal_id:null,etat,langue:etat==='traduit'?row.locale:source.source_locale};});
 return{etat:globalPerime?'perimee':coverage.traduits===coverage.attendus?'courante':coverage.perimes===coverage.attendus?'perimee':'partielle',raison:globalPerime?'source_changee':null,couverture:coverage,segments};
}
// Les valeurs opérationnelles et les sauts de ligne restent des littéraux de la source.
const valeursProtegees=()=>/\r\n|\r|\n|(?:[0-9]+(?:[.,][0-9]+)?(?:[ \u00a0]*(?:\/|[–—-]|à|to)[ \u00a0]*[0-9]+(?:[.,][0-9]+)?)?|[¼½¾⅐-⅞])(?:[ \u00a0]*(?:°[ \u00a0]*[CF]|(?:kg|mg|g|ml|cl|dl|l|mm|cm|m|min(?:utes?)?|sec(?:onds?|ondes?)?|s|h(?:ours?|eures?)?|rpm|tr\/min)\b))?/gi;
const jetonsDans=()=>/⟦M6:[0-9a-f]{12}:[0-9]+⟧/g;
export function protegerTexteTraduction(texte,{ref}={}){
 if(typeof texte!=='string'||!refValide(ref)||texte.includes('⟦M6:'))fail('jeton_source_invalide');canoniqueSources(texte);const jetons=[];
 const protege=texte.replace(valeursProtegees(),literal=>{const jeton='⟦M6:'+ref.slice(-12)+':'+jetons.length+'⟧';jetons.push({jeton,texte:literal});return jeton;});return{texte:protege,jetons};
}
export function restaurerTexteTraduction(texte,{source,ref}={}){
 if(typeof texte!=='string')fail('jeton_invalide');const protection=protegerTexteTraduction(source,{ref}),attendus=new Map(protection.jetons.map(j=>[j.jeton,j.texte]));
 for(const j of protection.jetons)if(texte.split(j.jeton).length!==2)fail('jeton_invalide');
 const sans=texte.replace(jetonsDans(),j=>{if(!attendus.has(j))fail('jeton_invalide');return '';});
 if(sans.includes('⟦M6:')||valeursProtegees().test(sans))fail('jeton_invalide');
 return texte.replace(jetonsDans(),j=>attendus.get(j));
}
export function validerPortionTraduction(reponse,portion){return result(()=>{
 const refs=portion?.segment_refs;if(!Array.isArray(refs)||!refs.length||refs.length>24||refs.some(s=>!refValide(s.ref)||!integer(s.output_max_points,borneSegmentTraduction(s))||!s.output_max_points)||new Set(refs.map(s=>s.ref)).size!==refs.length)fail();
 if(!closed(reponse,['format','segments'])||reponse.format!==1||!Array.isArray(reponse.segments)||reponse.segments.length!==refs.length)fail('reponse_invalide');const by=new Map();for(const s of reponse.segments){if(!closed(s,['ref','text'])||!refs.some(r=>r.ref===s.ref)||by.has(s.ref)||s.text!==null&&typeof s.text!=='string')fail('reponse_invalide');by.set(s.ref,s.text);}
 let total=0,bytes=0;const segments=refs.map(s=>{const value=by.get(s.ref);if(value===null)return{ref:s.ref,text:null,issue:'manquant'};try{const restored=restaurerTexteTraduction(value,{source:s.text,ref:s.ref});text(restored,s.output_max_points);if(porteUneAdresse(restored))fail('adresse');total+=points(restored);bytes+=new TextEncoder().encode(restored).byteLength;return{ref:s.ref,text:restored,issue:'admis'};}catch{return{ref:s.ref,text:null,issue:'refuse'};}});
 if(total>24000||bytes>131072)return{format:1,segments:segments.map(s=>s.issue==='admis'?{...s,text:null,issue:'refuse'}:s)};return{format:1,segments};
 });}

export const CHAMPS_COMMUNS_COMMANDE_TRADUCTION=Object.freeze(['protocol','op','mode','store','id','operation_id','payload_sha256','nonce']);
export const CHAMPS_CONTEXTE_TRADUCTION=Object.freeze(['recipe_id','recipe_version_id','edition_id','base_cycle_id','base_edition_cycle_id']);
const commandeKeys=Object.freeze({publish:[...CHAMPS_CONTEXTE_TRADUCTION,'locale','source_signature','title_sha256','expected_translations','changed_refs','journal_read_set','translation'],resolve:['journal_read_set'],restore:[...CHAMPS_CONTEXTE_TRADUCTION,'purpose','expected_target_sha256','target']});
const nullableId=x=>x===null||identifiantSource(x),nullableHash=x=>x===null||hash(x);
const sorted=(xs,k)=>xs.every((x,i)=>i===0||comparerUtf8(k(xs[i-1]),k(x))<0);
function validerReadSetTraduction(xs,{resolve=false}={}){
 if(!Array.isArray(xs)||xs.length>499||!sorted(xs,x=>x.journal_id))fail();let nb=0;
 for(const j of xs){if(!closed(j,['journal_id','reading_sha256','resolution_sha256','base_resolution_revision','decisions'])||!identifiantSource(j.journal_id)||!hash(j.reading_sha256)||!hash(j.resolution_sha256)||j.base_resolution_revision!==null&&!operation(j.base_resolution_revision)||!Array.isArray(j.decisions)||j.decisions.length>24||!sorted(j.decisions,d=>d.ref))fail();
  for(const d of j.decisions){if(!closed(d,['ref','decision','text_sha256'])||!refValide(d.ref)||!['adopte','ecarte'].includes(d.decision)||(d.decision==='adopte'?!hash(d.text_sha256):d.text_sha256!==null)||resolve&&d.decision!=='ecarte')fail();nb++;}
 }return nb;
}
export function validerCommandeTraduction(c){return result(()=>{
 if(!obj(c)||!commandeKeys[c.mode]||!closed(c,[...CHAMPS_COMMUNS_COMMANDE_TRADUCTION,...commandeKeys[c.mode]])||c.protocol!==1||c.op!=='translation_apply'||!identifiantSource(c.id)||!identifiantSource(c.nonce)||!operation(c.operation_id)||!hash(c.payload_sha256))fail();
 if(c.mode!=='resolve'&&(!identifiantSource(c.recipe_id)||!identifiantSource(c.recipe_version_id)||!nullableId(c.edition_id)||!nullableId(c.base_cycle_id)||!nullableId(c.base_edition_cycle_id)||c.edition_id===null&&c.base_edition_cycle_id!==null))fail('contexte_invalide');
 if(c.mode==='publish'){
  if(c.store!=='recipe_translations'||!['fr','en'].includes(c.locale)||!hash(c.source_signature)||!nullableHash(c.title_sha256)||!Array.isArray(c.expected_translations)||!sorted(c.expected_translations,x=>x.id)||!Array.isArray(c.changed_refs)||c.changed_refs.length>903||!c.changed_refs.every(refValide)||!sorted(c.changed_refs,x=>x))fail();
  for(const r of c.expected_translations)if(!closed(r,['id','revision','row_sha256'])||!identifiantSource(r.id)||!nullableId(r.revision)||!hash(r.row_sha256))fail();
  const n=validerReadSetTraduction(c.journal_read_set);if(!n&&!c.changed_refs.length)fail('sans_changement');
  if(!closed(c.translation,ligneKeys.filter(k=>!['publication_receipts','publication_receipt_floor'].includes(k)))||c.translation.id!==c.id||c.translation.recipe_version_id!==c.recipe_version_id||c.translation.locale!==c.locale||c.translation.source_signature!==c.source_signature||c.translation.revision!==c.operation_id)fail();
  const v=validerLigneTraductionV2({...c.translation,publication_receipts:[],publication_receipt_floor:0});if(!v.ok)fail(v.raison);
 }else if(c.mode==='resolve'){
  const n=validerReadSetTraduction(c.journal_read_set,{resolve:true});if(c.store!=='imports'||!n||c.id!==c.journal_read_set[0]?.journal_id)fail();
 }else{
  if(c.store!=='recipe_translations'||!['archive','bootstrap'].includes(c.purpose)||!nullableHash(c.expected_target_sha256)||c.target?.id!==c.id||c.target?.recipe_version_id!==c.recipe_version_id)fail();const v=validerLigneTraductionV2(c.target);if(!v.ok)fail(v.raison);
 }
 if(octetsJsonbSources(c)>LIMITES_TRADUCTION_V2.commande||octetsJsonbSources({rows:[c]})>LIMITES_TRADUCTION_V2.lot)fail('bornes');return clone(c);
 });}
export function projectionIntentionTraduction(input){const c=clone(input);delete c.operation_id;delete c.payload_sha256;if(c.mode==='publish'&&c.translation)delete c.translation.revision;return{projection:'translation-intent-v1',command:c};}
export async function signerCommandeTraduction(input){const c=clone(input);delete c.operation_id;delete c.payload_sha256;c.operation_id='tr_op_'+await empreinteSources(projectionIntentionTraduction(c));if(c.mode==='publish')c.translation.revision=c.operation_id;c.payload_sha256=await empreinteSources(c);const r=validerCommandeTraduction(c);if(!r.ok)fail(r.raison);return r.valeur;}
export async function verifierCommandeTraduction(command){const r=validerCommandeTraduction(command);if(!r.ok)fail(r.raison);const c=clone(command);delete c.payload_sha256;if(await empreinteSources(c)!==command.payload_sha256||'tr_op_'+await empreinteSources(projectionIntentionTraduction(command))!==command.operation_id)fail('operation_invalide');return clone(command);}
export function lireRecuPublication(row,command){
 const rs=row?.publication_receipts;if(!Array.isArray(rs)||!integer(row.publication_receipt_floor,rs.length))return null;
 const r=rs.slice(row.publication_receipt_floor).find(r=>r.operation_id===command.operation_id);if(r&&r.payload_sha256!==command.payload_sha256)fail('operation_invalide');return r?clone(r):null;
}
export function ajouterRecuPublication(row,command,{restore=false}={}){
 const next=clone(row);if(!Array.isArray(next.publication_receipts)||!integer(next.publication_receipt_floor,next.publication_receipts.length)||!operation(command.operation_id)||!hash(command.payload_sha256))fail();
 if(!restore&&lireRecuPublication(next,command))return next;
 const before=next.publication_receipts.length;next.publication_receipts.push({operation_id:command.operation_id,payload_sha256:command.payload_sha256});const removed=Math.max(0,next.publication_receipts.length-128);next.publication_receipts=next.publication_receipts.slice(removed);next.publication_receipt_floor=Math.max(0,(restore?before:next.publication_receipt_floor)-removed);return next;
}
export async function capturerCandidatesTraduction(rows){rows=clone(rows);if(!Array.isArray(rows)||rows.some(r=>!identifiantSource(r?.id))||new Set(rows.map(r=>r.id)).size!==rows.length)fail();return Promise.all([...rows].sort((a,b)=>comparerUtf8(a.id,b.id)).map(async r=>({id:r.id,revision:r.revision??null,row_sha256:await empreinteSources(projectionCandidateTraduction(r))})));}

// Journal historique fermé : l'absence de la source ne fabrique aucune preuve d'alignement.
export function validerJournalTraduction(row,{source=null}={}){return result(()=>{

 const keys=['id','kind','recipe_id','source_version_id','target_locale','owner_id','edition_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id','started_at','finished_at','model','translation_source_signature','translation_capture','translation_call','resultat','translation_resolution_revision','translation_resolutions','translation_resolution_receipts','status','erreur','scan_session_id','page_ids','created_at','updated_at'];
 if(!closed(row,keys)||row.kind!=='traduction'||!['id','recipe_id','source_version_id'].every(k=>identifiantSource(row[k]))||!['fr','en'].includes(row.target_locale)||!['owner_id','edition_id','expected_cycle_id','expected_edition_id','expected_edition_cycle_id'].every(k=>row[k]===null||identifiantSource(row[k]))||row.expected_edition_id!==row.edition_id||row.edition_id===null&&row.expected_edition_cycle_id!==null||row.scan_session_id!==null||!Array.isArray(row.page_ids)||row.page_ids.length||!hash(row.translation_source_signature)||!['a_lancer','en_cours','a_verifier','echec','enregistre','ignore'].includes(row.status)||!['created_at','updated_at'].every(k=>dateTraduction(row[k]))||!['started_at','finished_at'].every(k=>row[k]===null||dateTraduction(row[k]))||row.model!==null&&(typeof row.model!=='string'||points(row.model)>80)||row.erreur!==null&&typeof row.erreur!=='string')fail('journal_invalide');
 const c=row.translation_capture,a=row.translation_call;
 if(!closed(c,['format','source_locale','title_capture'])||c.format!==1||c.source_locale!==null&&normaliserLocaleSource(c.source_locale)!==c.source_locale||!closed(a,['format','series_id','ordinal','segment_refs'])||a.format!==1||!identifiantSource(a.series_id)||!integer(a.ordinal,31)||!Array.isArray(a.segment_refs)||a.segment_refs.length<1||a.segment_refs.length>24)fail('journal_invalide');
 const refs=new Set();for(const r of a.segment_refs){const {ref,output_max_points,...seg}=r;if(!closed(r,['ref','kind','source_id','field','source_sha256','output_max_points'])||!refValide(ref)||refs.has(ref)||!formeSegment({...seg,text:null,origin:null,journal_id:null})||!Number.isInteger(output_max_points)||output_max_points<1||output_max_points>borneSegmentTraduction(r))fail('journal_invalide');refs.add(ref);}
 const title=a.segment_refs.some(r=>r.kind==='title');if(title){const t=c.title_capture;if(!closed(t,['projection','recipe_id','recipe_version_id','fields'])||t.projection!=='translation-title-v1'||t.recipe_id!==row.recipe_id||t.recipe_version_id!==row.source_version_id||!Array.isArray(t.fields)||t.fields.length!==2||t.fields.some(x=>!Array.isArray(x)||x.length!==2)||t.fields[0]?.[0]!=='display_title'||t.fields[1]?.[0]!=='original_title')fail('journal_invalide');for(const[,v]of t.fields)if(!Array.isArray(v)||typeof v[0]!=='boolean'||(v[0]?(v.length!==2||(v[1]!==null&&typeof v[1]!=='string')):v.length!==1))fail('journal_invalide');}else if(c.title_capture!==null)fail('journal_invalide');
 if(row.resultat!==null){if(!closed(row.resultat,['format','segments'])||row.resultat.format!==1||!Array.isArray(row.resultat.segments)||row.resultat.segments.length!==refs.size)fail('journal_invalide');for(let i=0;i<a.segment_refs.length;i++){const s=row.resultat.segments[i],r=a.segment_refs[i];if(!closed(s,['ref','text','issue'])||s.ref!==r.ref||!['admis','manquant','refuse'].includes(s.issue)||s.issue==='admis'&&(typeof s.text!=='string'||points(s.text)>r.output_max_points)||s.issue!=='admis'&&s.text!==null)fail('journal_invalide');}}
 if(row.translation_resolution_revision!==null&&!operation(row.translation_resolution_revision)||!Array.isArray(row.translation_resolutions)||row.translation_resolutions.length>refs.size||!Array.isArray(row.translation_resolution_receipts)||row.translation_resolution_receipts.length>24)fail('journal_invalide');const resolved=new Set();for(const x of row.translation_resolutions){if(!closed(x,['ref','decision','text_sha256'])||!refs.has(x.ref)||resolved.has(x.ref)||!['adopte','ecarte'].includes(x.decision)||x.decision==='ecarte'&&x.text_sha256!==null||x.decision==='adopte'&&!hash(x.text_sha256))fail('journal_invalide');resolved.add(x.ref);}const receipts=new Set();for(const r of row.translation_resolution_receipts){if(!closed(r,['operation_id','payload_sha256'])||!operation(r.operation_id)||!hash(r.payload_sha256)||receipts.has(r.operation_id))fail('journal_invalide');receipts.add(r.operation_id);}
 if(!resolved.size&&(row.translation_resolution_revision!==null||receipts.size)||resolved.size&&(!receipts.has(row.translation_resolution_revision)||row.resultat===null)||receipts.size>resolved.size)fail('journal_invalide');const terminal=resolved.size===refs.size;if(terminal?row.status!==(row.translation_resolutions.some(x=>x.decision==='adopte')?'enregistre':'ignore'):['enregistre','ignore'].includes(row.status))fail('journal_invalide');if(['a_lancer','en_cours'].includes(row.status)&&(row.resultat!==null||resolved.size)||row.status==='a_lancer'&&row.started_at!==null||row.status==='en_cours'&&row.started_at===null)fail('journal_invalide');
 if(source){if(source.recipe_id!==row.recipe_id||source.recipe_version_id!==row.source_version_id||source.source_signature!==row.translation_source_signature)fail('source_changee');for(const r of a.segment_refs){const s=source.segments.find(s=>s.ref===r.ref);if(!s||s.kind!==r.kind||s.source_id!==r.source_id||s.field!==r.field||s.kind!=='title'&&s.source_sha256!==r.source_sha256)fail('source_changee');}}
 canoniqueSources(row);if(octetsJsonbSources(row)>524288)fail('bornes');return clone(row);
});}
