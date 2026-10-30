// Séquence d’un geste déjà confirmé. Le dépôt possède les bases/CAS ; ce contrôleur possède le vol HTTP.
import {prendreVol,libererVol,DOCUMENT_ID,BATTEMENT_MS} from '../ui/vol.js';

export function creerLectureTraduction({depot,provider,onEtat=()=>{},onLecture=()=>{},estCourante=()=>true,repo=null}={}){
  let courant={statut:'repos',journalId:null,conservees:0,raison:null},tenue=null,pending=null,dispose=false,conservation=null;
  const termines=new WeakMap();
  const etat=()=>({...courant,reponseAConserver:!!pending});
  const notifier=patch=>{courant={...courant,...patch};if(!dispose&&estCourante())onEtat(etat());};
  const enregistrer=()=>{
    if(conservation)return conservation;
    conservation=(async()=>{
    const capture=pending;if(!capture)return{issue:'refuse',raison:'reponse_absente'};
    let r;try{r=await depot.conserverReponseTraduction({vol:capture.vol,reponse:capture.reponse});}catch{r={issue:'echec',raison:'stockage_indisponible'};}
    if(r.issue!=='conserve'){notifier({statut:'a_conserver',raison:r.raison||'stockage_indisponible'});return{...r,issue:'a_conserver'};}
    if(pending===capture)pending=null;
    let set=termines.get(capture.plan);if(!set){set=new Set();termines.set(capture.plan,set);}set.add(capture.ordinal);
    notifier({statut:'pause',conservees:courant.conservees+1,raison:null});
    if(!dispose&&estCourante())await onLecture(r);
    return r;
    })().finally(()=>{conservation=null;});return conservation;
  };
  async function lancer({plan,ordinals}={}){
    if(dispose||!estCourante())return{issue:'refuse',raison:'contexte_change'};
    if(pending)return{issue:'a_conserver',raison:courant.raison};
    if(!plan||typeof plan!=='object'||!Array.isArray(ordinals)||ordinals.length>32||new Set(ordinals).size!==ordinals.length||ordinals.some(n=>!Number.isInteger(n)||n<0||n>31))return{issue:'refuse',raison:'selection_invalide'};
    const maTenue={importId:null,documentId:DOCUMENT_ID,controller:new AbortController(),repo};
    if(!prendreVol(maTenue))return{issue:'refuse',raison:'vol_en_cours'};
    tenue=maTenue;let battement=null;
    const courantAutorise=()=>!dispose&&estCourante()&&!maTenue.controller.signal.aborted;
    try{
      notifier({statut:'en_cours',raison:null});
      for(const ordinal of ordinals){
        if(termines.get(plan)?.has(ordinal))continue;
        if(!courantAutorise())return{issue:'refuse',raison:'annule'};
        notifier({statut:'en_cours',raison:null});
        const reserve=await depot.reserverPortionTraduction({plan,ordinal});
        if(reserve.issue==='deja_conserve'){let set=termines.get(plan);if(!set){set=new Set();termines.set(plan,set);}set.add(ordinal);if(reserve.lecture&&!dispose&&estCourante())await onLecture(reserve);continue;}
        if(reserve.issue!=='ok'){notifier({statut:'pause',raison:reserve.raison});return reserve;}
        maTenue.importId=reserve.journalId;notifier({journalId:reserve.journalId});
        if(!courantAutorise())return{issue:'refuse',raison:'annule'};
        const commence=await depot.commencerPortionTraduction({reservation:reserve.reservation});
        if(commence.issue==='deja_conserve'){let set=termines.get(plan);if(!set){set=new Set();termines.set(plan,set);}set.add(ordinal);if(commence.lecture&&!dispose&&estCourante())await onLecture(commence);continue;}
        if(commence.issue!=='ok'){notifier({statut:'pause',raison:commence.raison});return commence;}
        const battre=()=>repo?.battre?.(reserve.journalId,DOCUMENT_ID)?.catch?.(()=>{});
        battre();if(repo?.battre)battement=setInterval(battre,BATTEMENT_MS);
        let reponse;
        try{reponse=await provider.completeTranslation({...commence.portion,signal:maTenue.controller.signal});}
        catch{reponse={text:null,stopReason:null,model:null,reponseBrute:null,raison:maTenue.controller.signal.aborted?'annule':'interne'};}
        clearInterval(battement);battement=null;
        // Même une réponse tardive/illisible appartient à la portée capturée du dépôt.
        pending={plan,ordinal,vol:commence.vol,reponse};
        const conserve=await enregistrer();if(conserve.issue!=='conserve')return conserve;
        if(reponse.raison||reponse.stopReason==='max_tokens'){notifier({statut:'pause',raison:reponse.raison||'coupe'});return{issue:'pause',raison:reponse.raison||'coupe'};}
      }
      notifier({statut:'termine',raison:null});return{issue:'termine'};
    }catch{notifier({statut:pending?'a_conserver':'pause',raison:'interne'});return{issue:pending?'a_conserver':'echec',raison:'interne'};}
    finally{clearInterval(battement);libererVol(maTenue);if(tenue===maTenue)tenue=null;}
  }
  return{lancer,reessayerConservation:enregistrer,etat,reponseEnAttente:()=>pending?.reponse?.reponseBrute instanceof Uint8Array?pending.reponse.reponseBrute.slice():null,annuler(){tenue?.controller.abort();notifier({statut:pending?'a_conserver':'pause',raison:'annule'});},detruire(){dispose=true;tenue?.controller.abort();}};
}
