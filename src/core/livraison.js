import {ErreurLivraison,LIMITES_LIVRAISON,normaliserPorteeLivraison,releaseValide,validerReponseCoquille} from './livraison-format.js';
// Chaque preuve conserve ses objets Worker en privé. Les diagnostics ne transportent que des données fermées.
const internes=new WeakMap();let singleton=null,numero=0;
const figer=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))figer(v);Object.freeze(x)}return x};
export const obtenirControleLivraison=()=>singleton;
export function installerControleLivraison(instance,{mode,manifest_sha256}={}){
 const i=internes.get(instance);if(!i||i.detruit()||singleton&&singleton!==instance||!['controlee','en_ligne_non_verifiee'].includes(mode))throw new ErreurLivraison('execution_invalide');
 i.admettre(mode,manifest_sha256);singleton=instance;return instance;
}
export function creerControleLivraison({releasePage,baseURL,serviceWorker=globalThis.navigator?.serviceWorker,MessageChannel=globalThis.MessageChannel,maintenant=()=>new Date().toISOString(),delaiMs=LIMITES_LIVRAISON.delai}={}){
 const base=normaliserPorteeLivraison(baseURL);if(!releaseValide(releasePage))throw new ErreurLivraison('livraison_incompatible');
 const delai=Number.isFinite(delaiMs)?Math.max(1,Math.min(LIMITES_LIVRAISON.delaiMax,delaiMs)):LIMITES_LIVRAISON.delai;
 let registration=null,epoch=0,detruit=false,observation=null,verification=null,admis=false,relireApres=false;
 let execution={release:releasePage,mode:'en_ligne_non_verifiee',manifest_sha256:null};
 const callbacks=new Set(),preuves=new WeakMap(),requêtes=new Map(),terminer=new Set(),abonnements=new Map();
 const cibles=()=>[serviceWorker?.controller||null,registration?.active||null,registration?.waiting||null,registration?.installing||null];
 const sameTargets=(a,b)=>a.every((x,i)=>x===b[i]);
 const inconnu=w=>w?{release:null,manifest_sha256:null,complete:null}:null;
 const notifier=()=>{for(const cb of callbacks){try{cb(observation)}catch{/* Un écran ne bloque pas les autres abonnés. */}}};
 function poser(etat,raison,stats){const targets=cibles();observation=figer({etat,execution:{...execution},controleur:stats?.[0]??inconnu(targets[0]),actif:stats?.[1]??inconnu(targets[1]),attente:stats?.[2]??inconnu(targets[2]),raison,verifieLe:maintenant()});preuves.set(observation,{epoch,registration,targets});notifier();return observation;}
 const estCourante=obs=>{const p=preuves.get(obs);return !detruit&&obs===observation&&p?.epoch===epoch&&p.registration===registration&&sameTargets(p.targets,cibles())};
 const invalider=()=>{if(detruit)return;epoch++;for(const fin of [...terminer])fin({data:null,raison:'worker_change'});poser('inconnue','worker_change');ecouter();if(verification)relireApres=true;else void verifier();};
 function ecouter(){const prochains=new Map();if(serviceWorker)prochains.set(serviceWorker,['controllerchange']);if(registration)prochains.set(registration,['updatefound']);for(const w of cibles())if(w)prochains.set(w,['statechange']);for(const [objet,events] of abonnements)if(!prochains.has(objet)){for(const event of events)objet.removeEventListener?.(event,invalider);abonnements.delete(objet)}for(const [objet,events] of prochains)if(!abonnements.has(objet)){for(const event of events)objet.addEventListener?.(event,invalider);abonnements.set(objet,events)}}
 function demander(worker){
  if(!worker)return Promise.resolve({data:null,raison:null});
  if(worker.scriptURL!==new URL('sw.js',base).href||worker.state==='redundant')return Promise.resolve({data:null,raison:'portee_incompatible'});
  if(requêtes.has(worker))return requêtes.get(worker);
  const promesse=Promise.resolve().then(()=>new Promise(resolve=>{
   if(detruit){resolve({data:null,raison:'dispose'});return}
   let canal,timer,termine=false;
   const fin=value=>{if(termine)return;termine=true;clearTimeout(timer);terminer.delete(fin);if(canal){canal.port1.onmessage=null;canal.port1.close();canal.port2.close()}resolve(value)};
   terminer.add(fin);
   try{canal=new MessageChannel();const request_id='shell-'+(++numero)+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36));
    canal.port1.onmessage=event=>{if(event.data?.request_id!==request_id)return;try{const data=validerReponseCoquille(event.data,{request_id});fin({data,raison:null})}catch{fin({data:null,raison:'reponse_invalide'})}};
    canal.port1.start?.();timer=setTimeout(()=>fin({data:null,raison:'delai'}),delai);worker.postMessage({protocol:1,type:'shell_status',request_id},[canal.port2]);
   }catch{fin({data:null,raison:'indisponible'})}
  })).finally(()=>requêtes.delete(worker));requêtes.set(worker,promesse);return promesse;
 }
 async function lire(){
  if(detruit)return poser('inconnue','dispose');
  if(!serviceWorker?.getRegistration||!MessageChannel)return poser('inconnue','indisponible');
  const lecture=await new Promise(resolve=>{let fini=false;const fin=value=>{if(fini)return;fini=true;clearTimeout(timer);terminer.delete(fin);resolve(value)};const timer=setTimeout(()=>fin({raison:'delai'}),delai);terminer.add(fin);Promise.resolve().then(()=>serviceWorker.getRegistration(base)).then(reg=>fin({reg}),()=>fin({raison:'indisponible'}))});
  if(lecture.raison)return poser('inconnue',lecture.raison);const reg=lecture.reg;
  if(detruit)return poser('inconnue','dispose');
  if(reg&&reg.scope!==base)return poser('incompatible','portee_incompatible');
  if(registration!==reg){registration=reg||null;epoch++;ecouter()}
  const depart=epoch,targets=cibles();const resultats=await Promise.all(targets.slice(0,3).map(demander));
  if(detruit)return poser('inconnue','dispose');
  if(depart!==epoch||registration!==reg&&!!reg||!sameTargets(targets,cibles()))return poser('inconnue','worker_change');
  const stats=resultats.map((r,i)=>!targets[i]?null:r.data?{release:r.data.release,manifest_sha256:r.data.manifest_sha256,complete:r.data.complete}:inconnu(targets[i]));
  const ctrl=stats[0];let etat,raison=null;
  if(!admis||execution.mode==='en_ligne_non_verifiee'||!targets[0]){etat='non_controlee';raison='non_controlee'}
  else if(!ctrl?.release){etat='inconnue';raison=resultats[0].raison||'indisponible'}
  else if(targets[0]!==targets[1]||ctrl.release!==releasePage||ctrl.manifest_sha256!==execution.manifest_sha256){etat='incompatible';raison='livraison_incompatible'}
  else if(!ctrl.complete){etat='incomplete';raison='cache_incomplet'}else etat='verifiee';
  return poser(etat,raison,stats);
 }
 function verifier(){if(verification)return verification;verification=Promise.resolve().then(lire).finally(()=>{verification=null;if(relireApres&&!detruit){relireApres=false;queueMicrotask(()=>{if(!detruit)void verifier()})}});return verification;}
 const service={verifier,etat:()=>observation,estCourante,observer:cb=>{if(typeof cb!=='function'||detruit)return()=>{};callbacks.add(cb);return()=>callbacks.delete(cb)},dispose(){if(detruit)return;detruit=true;epoch++;for(const fin of [...terminer])fin({data:null,raison:'dispose'});for(const [objet,events]of abonnements)for(const event of events)objet.removeEventListener?.(event,invalider);abonnements.clear();callbacks.clear();if(singleton===service)singleton=null;}};
 internes.set(service,{detruit:()=>detruit,admettre(mode,manifest){if(admis){if(mode!==execution.mode||manifest!==execution.manifest_sha256)throw new ErreurLivraison('execution_invalide');return}if(mode==='controlee'){const p=preuves.get(observation);if(!estCourante(observation)||!observation.controleur?.complete||observation.controleur.release!==releasePage||observation.controleur.manifest_sha256!==manifest||p.targets[0]!==p.targets[1])throw new ErreurLivraison('execution_invalide')}else if(manifest!==null)throw new ErreurLivraison('execution_invalide');execution={release:releasePage,mode,manifest_sha256:manifest};admis=true;epoch++;observation=null;}});
 ecouter();return service;
}
