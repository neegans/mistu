import * as repo from '../model/repo.js';
import {TransitionRefusee} from '../core/db.js';
import {newId,nowIso} from '../core/ids.js';

export const CLE_STOCKAGE_PERSISTANT='stockage_persistant';
const CLE_EPOQUE='editor_library_epoch:v1';
const valeur=v=>typeof v==='boolean'?v:null;
const identique=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const contexteChange=()=>Object.assign(Error('stockage_contexte_change'),{code:'STORAGE_CONTEXT_CHANGED'});

// Une réservation IndexedDB précède l'API : deux onglets ne demandent jamais simultanément.
// Un navigateur muet laisse une valeur inconnue ; le démarrage n'attend pas cette promesse.
export async function demanderStockagePersistant({depot=repo,stockage=globalThis.navigator?.storage,maintenant=nowIso}={}){
 if(typeof stockage?.persist!=='function')return null;
 const base=depot.db,verifierBase=()=>{if(depot.db!==base)throw contexteChange();};
 const [ancienne,epoque]=await Promise.all([base.get('sync_state',CLE_STOCKAGE_PERSISTANT),base.get('sync_state',CLE_EPOQUE)]);
 verifierBase();if(ancienne)return valeur(ancienne.value);
 const reservation={key:CLE_STOCKAGE_PERSISTANT,value:null,at:maintenant(),demande_id:newId('stockage')};
 const gardeEpoque={key:CLE_EPOQUE,fusion:courante=>{verifierBase();if(!identique(courante,epoque))throw contexteChange();return null;}};
 try{
  await depot.saveBatch({sync_state:[reservation]},{origin:'device',conditions:{sync_state:[gardeEpoque,{key:CLE_STOCKAGE_PERSISTANT,absente:true}]}});
 }catch(error){
  verifierBase();
  if(!(error instanceof TransitionRefusee)||error.store!=='sync_state'||error.key!==CLE_STOCKAGE_PERSISTANT)throw error;
  const courante=await base.get('sync_state',CLE_STOCKAGE_PERSISTANT);verifierBase();return valeur(courante?.value);
 }
 verifierBase();
 let resultat=null;try{resultat=valeur(await stockage.persist())}catch{/* Refus de l'API : aucune protection affirmée. */}
 verifierBase();
 await depot.saveBatch({sync_state:[{...reservation,value:resultat}]},{origin:'device',conditions:{sync_state:[gardeEpoque,
  {key:CLE_STOCKAGE_PERSISTANT,fusion:courante=>{verifierBase();if(courante?.demande_id!==reservation.demande_id)throw contexteChange();return null;}}
 ]}});
 return resultat;
}
