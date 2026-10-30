// L8 : quantités explicitement confirmées, commandes fermées et preuves bornées.
import {canoniqueSources,empreinteSources,presenceSource,identifiantSource,octetsJsonbSources} from './sources-format.js';
export const LIMITES_INVENTAIRE=Object.freeze({ligne:524288,commande:786432,lot:921600,recus:128,reserve:32768,texte:10000,label:1000,decimales:6});
export const UNITES_INVENTAIRE=Object.freeze(['portion','piece','g','kg','ml','l']);
export const EMPLACEMENTS_INVENTAIRE=Object.freeze(['congelateur','frigo','garde_manger']);
export const CHAMPS_STOCK=Object.freeze(['format','unit','initial','remaining','state']);
export const CHAMPS_RESERVES_INVENTAIRE=Object.freeze(['stock','stock_revision','stock_last_action','stock_receipts','stock_receipt_floor']);
export const CHAMPS_PATCH_INVENTAIRE=Object.freeze(['label','quantity_text','location','prepared_on','use_by_on','use_by_origin','reheat_method','expected_quality','notes']);
export const CHAMPS_SOURCE_INVENTAIRE=Object.freeze({recipe:['id','lifecycle_id','trashed_at','edition_id','restored_from_edition'],edition:['id','lifecycle_id','trashed_at','trash_mode'],version:['id','recipe_id'],history:['id','recipe_id','recipe_version_id']});
export class ErreurInventaire extends Error{constructor(code){super(code);this.name='ErreurInventaire';this.code=code;}}
const fail=(c='forme_invalide')=>{throw new ErreurInventaire(c);},obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x||{},k),copy=structuredClone;
const closed=(x,ks)=>obj(x)&&Object.keys(x).length===ks.length&&ks.every(k=>own(x,k)),subset=(x,ks)=>obj(x)&&Object.keys(x).every(k=>ks.includes(k)),result=f=>{try{return{ok:true,valeur:f()};}catch(e){return{ok:false,raison:e.code||'forme_invalide'};}},id=identifiantSource;
export const egalesInventaire=(a,b)=>canoniqueSources(a??null)===canoniqueSources(b??null);
export const hashInventaire=x=>typeof x==='string'&&/^[a-f0-9]{64}$(?![\s\S])/.test(x);
export const operationInventaire=x=>typeof x==='string'&&/^iv_op_[a-f0-9]{64}$(?![\s\S])/.test(x);
export const dateInventaire=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$(?![\s\S])/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export const dateCivileInventaire=x=>typeof x==='string'&&/^(?!0000)\d{4}-\d\d-\d\d$(?![\s\S])/.test(x)&&dateInventaire(x+'T00:00:00.000Z');
export const estLotProtege=r=>CHAMPS_RESERVES_INVENTAIRE.some(k=>own(r,k));
export const projectionInventaireSeed=r=>{const data=copy(r);delete data.created_at;delete data.updated_at;return{projection:'inventory-seed-v1',data};};
export const projectionSourceInventaire=(type,r)=>{if(!own(CHAMPS_SOURCE_INVENTAIRE,type))fail();return{projection:`inventory-${type}-v1`,fields:CHAMPS_SOURCE_INVENTAIRE[type].map(k=>[k,presenceSource(r,k)])};};
// Le nombre JSON est une décimale canonique : ne jamais multiplier son flottant par10^6.
export function microQuantiteInventaire(value,unit){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||!UNITES_INVENTAIRE.includes(unit))fail('stock_invalide');
 const m=/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));if(!m)fail('stock_invalide');
 const digits=m[1]+(m[2]||''),power=6+Number(m[3]||0)-(m[2]||'').length;
 let n;if(power<0){const cut=-power;if(cut>digits.length||/[^0]/.test(digits.slice(-cut)))fail('precision_invalide');n=BigInt(digits.slice(0,-cut)||'0');}else{if(power>21)fail('bornes');n=BigInt(digits)*10n**BigInt(power);}
 const max=['portion','piece'].includes(unit)?1000000000n:1000000000000000n;if(n>max)fail('bornes');return n;
}
export const nombreMicroInventaire=n=>{if(typeof n!=='bigint'||n<0n||n>1000000000000000n)fail('bornes');const t=n.toString().padStart(7,'0');return Number(t.slice(0,-6)+'.'+t.slice(-6));};
export function lireQuantiteInventaire(texte,unit){return result(()=>{if(typeof texte!=='string')fail('stock_invalide');const s=texte.trim();if(!/^\d+(?:[.,]\d{1,6})?$(?![\s\S])/.test(s))fail(s.match(/^\d+[.,]\d{7,}$/)?'precision_invalide':'stock_invalide');const value=Number(s.replace(',','.'));microQuantiteInventaire(value,unit);return value;});}
export function validerStock(s){return result(()=>{
 if(!closed(s,CHAMPS_STOCK)||s.format!==1||!['available','finished'].includes(s.state))fail('stock_invalide');
 if(s.unit===null){if(s.initial!==null||s.remaining!==null)fail('stock_invalide');}
 else{const rem=microQuantiteInventaire(s.remaining,s.unit),initial=s.initial===null?null:microQuantiteInventaire(s.initial,s.unit);if(initial!==null&&rem>initial||s.state==='available'&&rem===0n||s.state==='finished'&&rem!==0n)fail('stock_invalide');}
 return copy(s);
});}
function stock(s){const r=validerStock(s);if(!r.ok)fail(r.raison);return r.valeur;}
function receipts(rs,floor){if(!Array.isArray(rs)||rs.length>128||!Number.isInteger(floor)||floor<0||floor>rs.length||new Set(rs.map(r=>r?.operation_id)).size!==rs.length||rs.some(r=>!closed(r,['operation_id','payload_sha256'])||!operationInventaire(r.operation_id)||!hashInventaire(r.payload_sha256)))fail();}
export function stockApresConsommation(before,amount){stock(before);if(before.state!=='available')fail('lot_termine');if(before.unit===null)fail('quantite_inconnue');const n=microQuantiteInventaire(amount,before.unit),r=microQuantiteInventaire(before.remaining,before.unit);if(n===0n)fail('stock_invalide');if(n>r)fail('quantite_depassee');return{...copy(before),remaining:nombreMicroInventaire(r-n),state:n===r?'finished':'available'};}
export function stockApresFin(before){stock(before);if(before.state!=='available')fail('lot_termine');return{...copy(before),remaining:before.unit===null?null:0,state:'finished'};}
function action(a){if(a===null)return;if(!closed(a,['operation_id','type','at','before','after','undo_of'])||!operationInventaire(a.operation_id)||!['consume','finish','undo'].includes(a.type)||!dateInventaire(a.at))fail();stock(a.before);stock(a.after);
 if(a.type==='undo'){if(!operationInventaire(a.undo_of)||a.undo_of===a.operation_id)fail();}
 else{if(a.undo_of!==null||a.before.state!=='available'||a.before.unit!==a.after.unit||a.before.initial!==a.after.initial)fail();if(a.type==='finish'){if(!egalesInventaire(stockApresFin(a.before),a.after))fail();}else if(a.before.unit===null||microQuantiteInventaire(a.after.remaining,a.after.unit)>=microQuantiteInventaire(a.before.remaining,a.before.unit))fail();}
}
export function validerLotInventaire(row){return result(()=>{
 if(!obj(row)||!id(row.id)||!CHAMPS_RESERVES_INVENTAIRE.every(k=>own(row,k))||!operationInventaire(row.stock_revision))fail();stock(row.stock);action(row.stock_last_action);receipts(row.stock_receipts,row.stock_receipt_floor);
 for(const k of ['ingredient_id','source_recipe_id','source_recipe_version_id','source_cook_history_id'])if(own(row,k)&&row[k]!==null&&!id(row[k]))fail();
 for(const k of ['prepared_on','use_by_on'])if(own(row,k)&&row[k]!==null&&!dateCivileInventaire(row[k]))fail();
 if(row.source_cook_history_id!=null&&(!id(row.source_recipe_id)||!id(row.source_recipe_version_id)))fail('source_changee');
 canoniqueSources(row);if(octetsJsonbSources(row)>524288)fail('bornes');return copy(row);
});}
export function validerPatchInventaire(patch){return result(()=>{if(!subset(patch,CHAMPS_PATCH_INVENTAIRE))fail();for(const[k,v]of Object.entries(patch)){
 if(['prepared_on','use_by_on'].includes(k)){if(v!==null&&!dateCivileInventaire(v))fail();}
 else if(k==='use_by_origin'){if(v!==null&&v!=='user')fail();}
 else if(k==='location'){if(!EMPLACEMENTS_INVENTAIRE.includes(v))fail();}
 else if(typeof v!=='string'||[...v].length>(k==='label'?1000:10000)||k==='label'&&!v.trim())fail('bornes');
 }canoniqueSources(patch);return copy(patch);});}
export const CHAMPS_LOT_NEUF=Object.freeze(['id','label','ingredient_id','source_recipe_id','source_recipe_version_id','source_cook_history_id','quantity_text','portions','location','prepared_at','use_by','use_by_origin','prepared_on','use_by_on','reheat_method','expected_quality','notes','stock','created_at','updated_at']);
export function validerLotNeufInventaire(row){return result(()=>{if(!closed(row,CHAMPS_LOT_NEUF)||!id(row.id)||![row.created_at,row.updated_at].every(dateInventaire)||row.portions!==null||row.prepared_at!==null||row.use_by!==null||row.ingredient_id!==null)fail();const v=validerPatchInventaire(Object.fromEntries(CHAMPS_PATCH_INVENTAIRE.map(k=>[k,row[k]])));if(!v.ok)fail(v.raison);stock(row.stock);if(row.stock.state!=='available'||row.stock.unit!==null&&row.stock.initial!==row.stock.remaining)fail('stock_invalide');for(const k of ['source_recipe_id','source_recipe_version_id','source_cook_history_id'])if(row[k]!==null&&!id(row[k]))fail();if((row.source_recipe_id===null)!==(row.source_recipe_version_id===null)||row.source_cook_history_id!==null&&row.source_recipe_id===null)fail('source_changee');return copy(row);});}
export function lireRecuInventaire(row,c){if(!validerLotInventaire(row).ok)return null;for(const r of row.stock_receipts.slice(row.stock_receipt_floor)){if(r.operation_id===c.operation_id){if(r.payload_sha256!==c.payload_sha256)fail('operation_invalide');return copy(r);}}return null;}
export function ajouterRecuInventaire(row,c,{restore=false}={}){const next=copy(row),rs=copy(next.stock_receipts||[]);let floor=restore?rs.length:next.stock_receipt_floor||0;if(!rs.some(r=>r.operation_id===c.operation_id))rs.push({operation_id:c.operation_id,payload_sha256:c.payload_sha256});const removed=Math.max(0,rs.length-128);next.stock_receipts=rs.slice(removed);next.stock_receipt_floor=Math.max(0,floor-removed);next.stock_revision=c.operation_id;return next;}
export function annulationInventaire(row){const a=row?.stock_last_action;return validerLotInventaire(row).ok&&a&&['consume','finish'].includes(a.type)&&a.operation_id===row.stock_revision&&egalesInventaire(row.stock,a.after)?copy(a):null;}
export function validerSourceInventaire(s){return result(()=>{if(!closed(s,['mode','recipe','edition','version','history'])||!['none','active','historical','restore'].includes(s.mode))fail();for(const k of Object.keys(CHAMPS_SOURCE_INVENTAIRE)){const v=s[k];if(v!==null&&(!closed(v,['id','sha256'])||!id(v.id)||v.sha256!==null&&!hashInventaire(v.sha256)))fail();}if(s.mode==='none'&&Object.keys(CHAMPS_SOURCE_INVENTAIRE).some(k=>s[k]!==null))fail();return copy(s);});}
const COMMON=['protocol','op','store','id','action','operation_id','nonce','payload_sha256','base','change','source'];
export function validerCommandeInventaire(c){return result(()=>{
 if(!closed(c,COMMON)||c.protocol!==1||c.op!=='inventory_change'||c.store!=='inventory'||!id(c.id)||!id(c.nonce)||!operationInventaire(c.operation_id)||!hashInventaire(c.payload_sha256)||!validerSourceInventaire(c.source).ok)fail();const b=c.base,x=c.change;
 if(c.action==='create'){if(!closed(b,['target'])||b.target!==null||!closed(x,['lot'])||x.lot?.id!==c.id||!validerLotNeufInventaire(x.lot).ok)fail();}
 else if(c.action==='adopt'){if(!closed(b,['legacy_sha256'])||!hashInventaire(b.legacy_sha256)||!closed(x,['stock','patch'])||!validerPatchInventaire(x.patch).ok)fail();stock(x.stock);}
 else if(c.action==='restore'){if(!closed(b,['expected_target_sha256'])||b.expected_target_sha256!==null&&!hashInventaire(b.expected_target_sha256)||!closed(x,['purpose','target'])||!['archive','bootstrap'].includes(x.purpose)||x.target?.id!==c.id||!validerLotInventaire(x.target).ok)fail();}
 else{if(!closed(b,c.action==='undo'?['revision','seed_sha256','action_id']:['revision','seed_sha256'])||!operationInventaire(b.revision)||!hashInventaire(b.seed_sha256))fail();
  if(c.action==='edit'){if(!closed(x,['patch','stock'])||!validerPatchInventaire(x.patch).ok)fail();if(x.stock!==null)stock(x.stock);}
  else if(c.action==='consume'){if(!closed(x,['amount','after','at'])||!dateInventaire(x.at))fail();stock(x.after);if(x.after.unit===null||microQuantiteInventaire(x.amount,x.after.unit)===0n)fail();}
  else if(c.action==='finish'){if(!closed(x,['after','at'])||!dateInventaire(x.at))fail();stock(x.after);if(x.after.state!=='finished')fail();}
  else if(c.action==='undo'){if(!operationInventaire(b.action_id)||!closed(x,['at'])||!dateInventaire(x.at))fail();}else fail();
 }
 canoniqueSources(c);if(octetsJsonbSources(c)>786432||octetsJsonbSources({rows:[c]})>921600)fail('bornes');return copy(c);
});}
export const projectionIntentionInventaire=c=>{const command=copy(c);delete command.operation_id;delete command.payload_sha256;return{projection:'inventory-intent-v1',command};};
export async function signerCommandeInventaire(input){const c=copy(input);delete c.operation_id;delete c.payload_sha256;c.operation_id='iv_op_'+await empreinteSources(projectionIntentionInventaire(c));c.payload_sha256=await empreinteSources(c);const v=validerCommandeInventaire(c);if(!v.ok)fail(v.raison);return c;}
export async function verifierCommandeInventaire(c){const v=validerCommandeInventaire(c);if(!v.ok)fail(v.raison);const data=copy(c);delete data.payload_sha256;if(await empreinteSources(data)!==c.payload_sha256||'iv_op_'+await empreinteSources(projectionIntentionInventaire(c))!==c.operation_id)fail('operation_invalide');return c;}
