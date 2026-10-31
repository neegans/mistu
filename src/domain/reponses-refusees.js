// Dernier refus reçu sur cet appareil. Aucun octet brut ne rejoint le journal synchronisé.
import {sha256Hex} from '../core/hash.js';
import {newId,nowIso} from '../core/ids.js';
import {TransitionRefusee} from '../core/db.js';
import {CLE_EPOQUE_EDITEUR,ligneEpoqueEditeur,idEditeur} from './brouillons-format.js';
import {canoniqueSources,octetsJsonbSources} from './sources-format.js';

export const PREFIXE_REPONSE_REFUSEE='assistant_rejected:v1:';
const LIMITES=Object.freeze({thermomix:1024*1024,reperes:128*1024});
// Les objets synchronisés peuvent revenir de JSONB avec leurs clés dans un autre ordre.
const copy=structuredClone,canon=v=>canoniqueSources(JSON.parse(JSON.stringify(v??null))),egal=(a,b)=>canon(a)===canon(b);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const ferme=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
const motifValide=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);};
const comparable=row=>{if(!row)return null;const r=copy(row);delete r.updated_at;delete r.battement_at;return r;};
const erreur=e=>({issue:typeof e?.code==='string'||e instanceof TransitionRefusee?'refuse':'echec',raison:typeof e?.code==='string'?e.code:e instanceof TransitionRefusee?'tentative_perimee':e?.name==='QuotaExceededError'?'quota_stockage':'stockage_indisponible',reessayable:!(typeof e?.code==='string'||e instanceof TransitionRefusee)});
function journalValide(j){if(!j||!idEditeur(j.id)||!Object.hasOwn(LIMITES,j.kind)||!idEditeur(j.recipe_id)||!(idEditeur(j.source_version_id)||j.kind==='reperes'&&j.source_version_id===null))fail('journal_change');}
function referenceValide(r,kind){return ferme(r,['format','reference','tentative_id','motif','byte_length','sha256','saved_at'])&&r.format===1&&idEditeur(r.reference)&&idEditeur(r.tentative_id)&&motifValide(r.motif)&&Number.isSafeInteger(r.byte_length)&&r.byte_length>=0&&r.byte_length<=LIMITES[kind]&&hash(r.sha256)&&date(r.saved_at);}
function memeIdentite(a,b){return ['id','kind','recipe_id','source_version_id','owner_id','device_id'].every(k=>egal(a?.[k],b?.[k]));}

export function creerConservationReponseRefusee({repo,maintenant=nowIso}={}){
 if(!repo?.db||typeof repo.transitionner!=='function')throw new TypeError('Dépôt requis');
 const captures=new WeakMap(),lectures=new WeakMap(),pending=new Map(),commits=new Map();
 const encadrer=fn=>async(...args)=>{try{return await fn(...args)}catch(e){return erreur(e)}};
 async function portee(estCourante=()=>true){
  const base=repo.db,initiale=base.idb;
  await base.open();
  if(repo.db!==base||initiale&&base.idb!==initiale||!estCourante())fail('contexte_change');
  const connexion=base.idb,g={base,connexion,estCourante,verifier(){if(repo.db!==base||base.idb!==connexion||!connexion||!estCourante())fail('contexte_change')}};
  const [owner,epoque]=await Promise.all([base.get('sync_state','user_id'),base.get('sync_state',CLE_EPOQUE_EDITEUR)]);g.verifier();
  return{...g,owner_id:owner?.value??null,library_epoch:epoque?.value??null};
 }
 async function verifierPortee(g){
  g.verifier();const [owner,epoque]=await Promise.all([g.base.get('sync_state','user_id'),g.base.get('sync_state',CLE_EPOQUE_EDITEUR)]);g.verifier();
  if((owner?.value??null)!==g.owner_id)fail('compte_change');if((epoque?.value??null)!==g.library_epoch)fail('bibliotheque_remplacee');
 }
 const conditionsPortee=g=>[
  {key:'user_id',fusion:r=>{g.verifier();if((r?.value??null)!==g.owner_id)fail('compte_change');return null;}},
  {key:CLE_EPOQUE_EDITEUR,fusion:r=>{g.verifier();if((r?.value??null)!==g.library_epoch)fail('bibliotheque_remplacee');return null;}},
 ];
 function verifierProprietaire(j,g){if(Object.hasOwn(j,'owner_id')&&(j.owner_id??null)!==g.owner_id)fail('compte_change');}
 async function capturer({journal,estCourante=()=>true}){
  const j=copy(journal);journalValide(j);if(pending.has(j.id))fail('conservation_en_attente');
  const g=await portee(estCourante);verifierProprietaire(j,g);
  if(g.library_epoch===null){
   const e=ligneEpoqueEditeur();await repo.muterEditeur({internes:{conditions:[conditionsPortee(g)[0],{key:e.key,fusion:r=>{g.verifier();return r?null:e;}}]}},{origin:'device',baseAttendue:g.base,contexteValide:()=>{g.verifier();return true;}});
   g.verifier();g.library_epoch=(await g.base.get('sync_state',e.key))?.value??null;
  }
  if(!idEditeur(g.library_epoch))fail('bibliotheque_remplacee');
  const key=PREFIXE_REPONSE_REFUSEE+j.id,[current,raw]=await Promise.all([g.base.get('imports',j.id),g.base.get('sync_state',key)]);await verifierPortee(g);
  if(!egal(comparable(current),comparable(j)))fail('journal_change');
  const ref=j.reponse_refusee??null;if(ref&&!referenceValide(ref,j.kind))fail('reponse_changee');
  const capture=Object.freeze({});captures.set(capture,{g,journal:j,key,raw:copy(raw??null),ref:copy(ref)});return{issue:'ok',capture};
 }
 async function preparerDepart({capture}){
  const c=captures.get(capture);if(!c)fail('contexte_change');
  await verifierPortee(c.g);
  // Réutilise la portée d'avant l'attente ; ces gardes rejoignent la transition de départ.
  return{issue:'ok',verifier(current){c.g.verifier();if(current!==undefined&&!egal(comparable(current),comparable(c.journal)))fail('journal_change');},
   conditions:[...conditionsPortee(c.g),{key:c.key,fusion:r=>{c.g.verifier();if(!egal(r,c.raw))fail('reponse_changee');return null;}}]};
 }
 async function preparer(p){
  if(p.local)return;
  const empreinte=await sha256Hex(p.octets);
  p.reference={format:1,reference:p.id,tentative_id:p.journal.tentative_id,motif:p.motif,byte_length:p.octets.length,sha256:empreinte,saved_at:p.date};
  p.local={key:p.capture.key,value:{format:1,journal_id:p.journal.id,kind:p.journal.kind,recipe_id:p.journal.recipe_id,source_version_id:p.journal.source_version_id,owner_id:p.capture.g.owner_id,database_name:p.capture.g.base.name,library_epoch:p.capture.g.library_epoch,reference:copy(p.reference),saved_at:p.date,body:{encoding:'base64',byte_length:p.octets.length,sha256:empreinte,data:base64(p.octets)}}};
 }
 function verifierJournal(current,p){
  if(!current||!memeIdentite(current,p.journal))fail('journal_change');
  if(current.tentative_id!==p.journal.tentative_id)fail('tentative_perimee');
  if(!egal(current.reponse_refusee,p.capture.ref))fail('reponse_changee');
  if(!egal(comparable(current),comparable(p.journal)))fail('journal_change');
 }
 function enregistrer(importId){
  if(commits.has(importId))return commits.get(importId);
  const p=pending.get(importId);if(!p)return Promise.resolve({issue:'refuse',raison:'reponse_absente',reessayable:false});
  const promesse=(async()=>{
   try{
    await preparer(p);await verifierPortee(p.capture.g);
    // Un accusé local perdu ne doit pas recréer ni remplacer un reçu déjà conservé.
    const [deja,local]=await Promise.all([p.capture.g.base.get('imports',importId),p.capture.g.base.get('sync_state',p.capture.key)]);await verifierPortee(p.capture.g);
    if(egal(deja?.reponse_refusee,p.reference)&&egal(local,p.local)){if(!memeIdentite(deja,p.journal))fail('reponse_changee');if(pending.get(importId)===p)pending.delete(importId);return{issue:'conserve',journal:deja};}
    const journal=await repo.transitionner('imports',importId,{attendus:[...p.transition.attendus],recettes:p.transition.recettes||[],patch:current=>{
     p.capture.g.verifier();verifierJournal(current,p);
     const patch=typeof p.transition.patch==='function'?p.transition.patch(current):p.transition.patch;
     if(!patch||patch.status!=='echec'||patch.resultat!==null)fail('forme_invalide');
     const final={...patch,reponse_brute:null,reponse_refusee:copy(p.reference)};
     if(octetsJsonbSources({...current,...final})>524288)fail('hors_bornes');return final;
    },autres:{sync_state:[...conditionsPortee(p.capture.g),{key:p.capture.key,fusion:r=>{p.capture.g.verifier();if(!egal(r,p.capture.raw))fail('reponse_changee');return copy(p.local);}}]}});
    await verifierPortee(p.capture.g);if(pending.get(importId)===p)pending.delete(importId);return{issue:'conserve',journal};
   }catch(e){return{...erreur(e),issue:'a_conserver'};}
  })().finally(()=>commits.delete(importId));commits.set(importId,promesse);return promesse;
 }
 async function conserver({capture,journal,octets,motif,transition}){
  const c=captures.get(capture);if(!c)fail('contexte_change');
  if(!(octets instanceof Uint8Array)||octets.length>LIMITES[c.journal.kind])fail('limite_reponse');
  if(!motifValide(motif)||!transition||!Array.isArray(transition.attendus)||!transition.attendus.length||transition.attendus.some(x=>x!=='en_cours'))fail('forme_invalide');
  journalValide(journal);if(!memeIdentite(journal,c.journal)||journal.status!=='en_cours'||!idEditeur(journal.tentative_id)||!egal(journal.reponse_refusee,c.ref))fail('journal_change');
  let p=pending.get(journal.id);
  if(p){if(p.capture!==c||p.motif!==motif||!egal(p.journal,journal)||p.octets.length!==octets.length||p.octets.some((x,i)=>x!==octets[i]))fail('conservation_en_attente');}
  else{
   const at=maintenant();if(!date(at))fail('forme_invalide');
   p={capture:c,journal:copy(journal),octets:octets.slice(),motif,transition:{...transition,attendus:[...transition.attendus],recettes:[...(transition.recettes||[])]},id:newId('refus'),date:at,reference:null,local:null};
   pending.set(journal.id,p); // avant SHA et toute attente : une erreur d'écriture ne perd jamais les octets reçus
  }
  return enregistrer(journal.id);
 }
 async function reponseEnAttente({importId}){
  const p=pending.get(importId);if(!p)return{issue:'ok',etat:'aucune',motif:null};
  await verifierPortee(p.capture.g);await preparer(p);await verifierPortee(p.capture.g);
  return{issue:'ok',etat:'en_attente',motif:p.motif,reference:copy(p.reference),octets:p.octets.slice()};
 }
 async function lire({importId}){
  if(!idEditeur(importId))fail('journal_change');const g=await portee(),j=await g.base.get('imports',importId);g.verifier();
  if(!j)return{issue:'ok',etat:'aucune',motif:null};journalValide(j);verifierProprietaire(j,g);
  const ref=j.reponse_refusee;if(ref==null)return{issue:'ok',etat:'aucune',motif:null};if(!referenceValide(ref,j.kind))fail('reponse_changee');
  const key=PREFIXE_REPONSE_REFUSEE+importId,row=await g.base.get('sync_state',key);await verifierPortee(g);
  if(!row)return{issue:'ok',etat:'absente',motif:ref.motif,reference:copy(ref)};
  const v=row.value,b=v?.body;
  if(!ferme(v,['format','journal_id','kind','recipe_id','source_version_id','owner_id','database_name','library_epoch','reference','saved_at','body'])||v.format!==1||row.key!==key||v.journal_id!==j.id||v.kind!==j.kind||v.recipe_id!==j.recipe_id||v.source_version_id!==j.source_version_id||v.owner_id!==g.owner_id||v.database_name!==g.base.name||v.library_epoch!==g.library_epoch||!egal(v.reference,ref)||v.saved_at!==ref.saved_at)fail('reponse_changee');
  if(!ferme(b,['encoding','byte_length','sha256','data'])||b.encoding!=='base64'||b.byte_length!==ref.byte_length||b.sha256!==ref.sha256||typeof b.data!=='string'||b.data.length!==4*Math.ceil(ref.byte_length/3)||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.data))fail('reponse_changee');
  let octets;try{octets=Uint8Array.from(atob(b.data),x=>x.charCodeAt(0));}catch{fail('reponse_changee');}
  if(octets.length!==ref.byte_length||base64(octets)!==b.data||await sha256Hex(octets)!==ref.sha256)fail('reponse_changee');await verifierPortee(g);
  const attendu=Object.freeze({});lectures.set(attendu,{g,journal:copy(j),row:copy(row)});
  return{issue:'ok',etat:'disponible',motif:ref.motif,reference:copy(ref),octets,attendu};
 }
 async function abandonner({attendu}){
  const l=lectures.get(attendu);if(!l)fail('contexte_change');if(pending.has(l.journal.id))fail('conservation_en_attente');if(l.journal.status==='en_cours')fail('appel_en_cours');
  await verifierPortee(l.g);
  const journal=await repo.transitionner('imports',l.journal.id,{attendus:[l.journal.status],patch:current=>{l.g.verifier();if(!egal(current,l.journal))fail('reponse_changee');return{reponse_refusee:null};},deletes:{sync_state:[l.row.key]},autres:{sync_state:[...conditionsPortee(l.g),{key:l.row.key,fusion:r=>{l.g.verifier();if(!egal(r,l.row))fail('reponse_changee');return null;}}]}});
  await verifierPortee(l.g);lectures.delete(attendu);return{issue:'abandonne',journal};
 }
 return{capturer:encadrer(capturer),preparerDepart:encadrer(preparerDepart),conserver:encadrer(conserver),lire:encadrer(lire),abandonner:encadrer(abandonner),reponseEnAttente:encadrer(reponseEnAttente),presenceEnAttente:({importId})=>pending.has(importId),reessayerConservation:({importId})=>enregistrer(importId)};
}
