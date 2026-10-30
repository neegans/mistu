// Masques synchrones ; l'empreinte de la base et des références est vérifiée avant le CAS du dépôt.
import {ErreurInventaire,egalesInventaire,estLotProtege,validerLotInventaire,validerCommandeInventaire,projectionInventaireSeed,stockApresConsommation,stockApresFin,annulationInventaire,ajouterRecuInventaire,lireRecuInventaire,CHAMPS_RESERVES_INVENTAIRE,LIMITES_INVENTAIRE} from './inventaire-format.js';
import {empreinteSources,octetsJsonbSources} from './sources-format.js';
const copy=structuredClone,fail=code=>{throw new ErreurInventaire(code);};
export function verifierReserveInventaire(row){const data=copy(row);for(const k of CHAMPS_RESERVES_INVENTAIRE)delete data[k];if(octetsJsonbSources(data)+LIMITES_INVENTAIRE.reserve>LIMITES_INVENTAIRE.ligne)fail('bornes');}
export async function verifierBaseInventaire(c,avant){
 if(lireRecuInventaire(avant,c))return;
 if(c.action==='create'){if(avant)fail('stock_change');return;}
 const h=avant?await empreinteSources(projectionInventaireSeed(avant)):null;
 if(c.action==='restore'){if(h!==c.base.expected_target_sha256||avant&&!egalesInventaire(projectionInventaireSeed(avant),projectionInventaireSeed(c.change.target)))fail('restauration_changee');}
 else if(!avant||h!==(c.action==='adopt'?c.base.legacy_sha256:c.base.seed_sha256))fail('stock_change');
}
export function appliquerTransitionInventaire(c,avant,{attendue=null}={}){
 const v=validerCommandeInventaire(c);if(!v.ok)fail(v.raison);if(lireRecuInventaire(avant,c))return copy(avant);const x=c.change;let next;
 if(c.action==='create'){if(avant)fail('stock_change');next={...copy(x.lot),stock_revision:c.operation_id,stock_last_action:null,stock_receipts:[],stock_receipt_floor:0};}
 else if(c.action==='restore'){
  if(avant&&(!attendue||!egalesInventaire(projectionInventaireSeed(avant),projectionInventaireSeed(attendue))||!egalesInventaire(projectionInventaireSeed(avant),projectionInventaireSeed(x.target)))||!avant&&c.base.expected_target_sha256!==null)fail('restauration_changee');next=ajouterRecuInventaire(x.target,c,{restore:true});
 }else{
  if(!avant||!attendue||!egalesInventaire(projectionInventaireSeed(avant),projectionInventaireSeed(attendue)))fail('stock_change');
  if(c.action==='adopt'){if(estLotProtege(avant))fail('stock_change');next={...copy(avant),...copy(x.patch),stock:copy(x.stock),stock_revision:c.operation_id,stock_last_action:null,stock_receipts:[],stock_receipt_floor:0};}
  else{
   if(!validerLotInventaire(avant).ok||avant.stock_revision!==c.base.revision)fail('stock_change');next=copy(avant);
   if(c.action==='edit'){Object.assign(next,copy(x.patch));if(x.stock!==null)next.stock=copy(x.stock);next.stock_last_action=null;}
   else if(c.action==='undo'){const a=annulationInventaire(avant);if(!a||a.operation_id!==c.base.action_id)fail('annulation_indisponible');next.stock=copy(a.before);next.stock_last_action={operation_id:c.operation_id,type:'undo',at:x.at,before:copy(avant.stock),after:copy(next.stock),undo_of:a.operation_id};}
   else{const after=c.action==='consume'?stockApresConsommation(avant.stock,x.amount):stockApresFin(avant.stock);if(!egalesInventaire(after,x.after))fail('stock_invalide');next.stock=after;next.stock_last_action={operation_id:c.operation_id,type:c.action,at:x.at,before:copy(avant.stock),after:copy(after),undo_of:null};}
  }
 }
 if(c.action!=='restore')next=ajouterRecuInventaire(next,c);const valid=validerLotInventaire(next);if(!valid.ok)fail(valid.raison);if(['create','adopt','edit'].includes(c.action))verifierReserveInventaire(next);return next;
}
