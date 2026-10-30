// Portée de la vue capturée avant tout dialogue ; les fusions restent synchrones dans IDB.
import {getSyncGeneration} from './state.js';
const CLE_EPOQUE='editor_library_epoch:v1';
export function creerGardeRepas(repo,ctx,estCourante=()=>true){
 const base=repo.db,generation=getSyncGeneration(),ownerAttendu=ctx?.proprietaireDonnees;
 const verifier=()=>{if(repo.db!==base||getSyncGeneration()!==generation||!estCourante())throw Object.assign(Error('contexte_change'),{code:'contexte_change'});};
 const capture=(async()=>{const [owner,epoch]=await Promise.all([repo.get('sync_state','user_id'),repo.get('sync_state',CLE_EPOQUE)]);verifier();const id=owner?.value??null;if(ownerAttendu!==undefined&&ownerAttendu!==id)throw Error('compte_change');return{id,epoch:structuredClone(epoch??null)};})();capture.catch(()=>{});
 return{async options(conditions={},recettes=[]){const c=await capture;verifier();return{recettes,conditions:{...conditions,sync_state:[...(conditions.sync_state||[]),{key:'user_id',fusion:r=>{verifier();if((r?.value??null)!==c.id)throw Error('compte_change');return null;}},{key:CLE_EPOQUE,fusion:r=>{verifier();if(JSON.stringify(r??null)!==JSON.stringify(c.epoch))throw Error('bibliotheque_remplacee');return null;}}]}};},verifier};
}

// Saisie gardée en mémoire : aucun faux brouillon durable ni sauvegarde au départ.
export function protectionFormulaireRepas(root,lireTexte){
 const sales=new Map(),abonnees=new Set();let sequence=0;
 const etat=()=>({sale:sales.size>0,enCours:false,id:null,publie:false});
 const notifier=()=>abonnees.forEach(fn=>fn(etat()));
 const controleur={etat,lireTexte,souscrire(fn){abonnees.add(fn);fn(etat());return()=>abonnees.delete(fn);},async flush(){return sales.size?{issue:'refuse',raison:'saisie_locale'}:{issue:'ok'};}};
 return{controleur,modifier(key){const n=++sequence;sales.set(key,n);notifier();return n;},confirmer(key,n=sales.get(key)){if(sales.get(key)===n)sales.delete(key);notifier();},generation:key=>sales.get(key)};
}
