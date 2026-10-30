import {newId as idDefaut} from '../core/ids.js';
import {ErreurInventaire,estLotProtege,validerLotInventaire,projectionInventaireSeed,egalesInventaire,signerCommandeInventaire} from './inventaire-format.js';
import {appliquerTransitionInventaire} from './inventaire-mutations.js';
import {referencesInventaire,capturerSourceInventaire} from './inventaire-sources.js';
import {empreinteSources} from './sources-format.js';
const clone=structuredClone,fail=c=>{throw new ErreurInventaire(c);};
export const contientInventaireProtege=stores=>(stores.inventory||[]).some(estLotProtege);
export function validerFormesInventaireArchive({stores,archiveVersion}){
 const avertissements=[];for(const r of stores.inventory||[])if(estLotProtege(r)){if(!Number.isInteger(archiveVersion)||archiveVersion<7)fail('forme_invalide');const v=validerLotInventaire(r);if(!v.ok)fail(v.raison);}return{avertissements};
}
function effectif(batch,snapshot){const out={};for(const store of ['inventory','recipes','recipe_versions','book_editions','cook_history'])out[store]=[...new Map([...(snapshot[store]||[]),...(batch[store]||[])].map(r=>[r.id,r])).values()];return out;}
export async function verifierIdentitesInventaireArchive({batch,snapshot}){
 const avertissements=[],stores=effectif(batch,snapshot),courants=new Map((snapshot.inventory||[]).map(r=>[r.id,r]));
 for(const row of batch.inventory||[])if(estLotProtege(row)){
  const v=validerLotInventaire(row);if(!v.ok)fail(v.raison);const old=courants.get(row.id);if(old&&!egalesInventaire(projectionInventaireSeed(old),projectionInventaireSeed(row)))fail('restauration_changee');
  const refs=referencesInventaire(row,stores);await capturerSourceInventaire(row,refs,'restore');
  if(row.source_recipe_id&&!refs.recipe||row.source_recipe_version_id&&!refs.version||row.source_cook_history_id&&!refs.history)avertissements.push({store:'inventory',id:row.id,raison:'source_absente'});
 }return{avertissements};
}
export async function preparerInventaireArchive({batch,snapshot,owner_id,purpose='archive',newId=idDefaut}){
 const cible=clone(batch),avant=clone(snapshot);if(!['archive','bootstrap'].includes(purpose)||owner_id!==null&&typeof owner_id!=='string')fail('forme_invalide');validerFormesInventaireArchive({stores:cible,archiveVersion:7});const {avertissements}=await verifierIdentitesInventaireArchive({batch:cible,snapshot:avant}),stores=effectif(cible,avant),current=new Map((avant.inventory||[]).map(r=>[r.id,r])),inventory_commands=[],couvertes=new Set();
 for(let i=0;i<(cible.inventory||[]).length;i++){const row=cible.inventory[i];if(!estLotProtege(row))continue;const old=current.get(row.id)??null,source=await capturerSourceInventaire(row,referencesInventaire(row,stores),'restore'),c=await signerCommandeInventaire({protocol:1,op:'inventory_change',store:'inventory',id:row.id,action:'restore',nonce:newId('stock'),base:{expected_target_sha256:old?await empreinteSources(projectionInventaireSeed(old)):null},change:{purpose,target:row},source});cible.inventory[i]=appliquerTransitionInventaire(c,old,{attendue:old});inventory_commands.push(c);couvertes.add('inventory:'+row.id);}
 return{batch:cible,inventory_commands,couvertes,avertissements};
}
