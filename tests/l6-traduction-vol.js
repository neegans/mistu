import {prendreVol,libererVol,reinitialiserVol} from '../src/ui/vol.js';
export async function runL6TraductionVolTests({eq,ok}){
  const {creerLectureTraduction}=await import('../src/domain/lecture-traduction.js');
  const events=[],calls=[],conserves=[],lectures=[];let quota=false,refus=null;
  const depot={
    reserverPortionTraduction:async({ordinal})=>{events.push('reserve'+ordinal);return refus?{issue:'refuse',raison:refus}:{issue:'ok',reservation:{ordinal},journalId:'j'+ordinal,portion:{ordinal}};},
    commencerPortionTraduction:async({reservation})=>{events.push('start'+reservation.ordinal);return{issue:'ok',vol:reservation,portion:{ordinal:reservation.ordinal,system:'x',messages:[],maxTokens:8000}};},
    conserverReponseTraduction:async({vol,reponse})=>{events.push('conserve'+vol.ordinal);conserves.push(reponse);if(quota)return{issue:'echec',raison:'stockage_indisponible'};return{issue:'conserve',journalId:'j'+vol.ordinal,lecture:{id:'j'+vol.ordinal},manquants:[],refuses:[]};},
  };
  const provider={completeTranslation:async p=>{events.push('http'+p.messages[0]?.ordinal);calls.push(p);return{text:'{}',model:null,stopReason:null,raison:null,reponseBrute:new Uint8Array([123,125])};}};
  const vol=creerLectureTraduction({depot,provider,onLecture:r=>lectures.push(r)}),plan={};
  const r=await vol.lancer({plan,ordinals:[0,1]});eq(r.issue,'termine','L6 vol : série terminée après commits');eq(events.map(x=>x.replace('undefined','')),['reserve0','start0','http','conserve0','reserve1','start1','http','conserve1'],'L6 vol : moitié/portion durable avant suivante');eq(lectures.length,2,'L6 vol : affiche seulement lectures confirmées');
  const count=calls.length;await vol.lancer({plan,ordinals:[0,1]});eq(calls.length,count,'L6 vol : double geste ne répète pas portions reçues');
  quota=true;const failed=await vol.lancer({plan,ordinals:[2,3]});eq(failed.issue,'a_conserver','L6 vol : erreur écriture garde réponse en attente');eq(calls.length,count+1,'L6 vol : pas de portion suivante après perte durabilité');const exact=conserves.at(-1);
  await vol.lancer({plan,ordinals:[2]});eq(calls.length,count+1,'L6 vol : bouton relancer ne refait pas appel payé en attente');
  quota=false;const retried=await vol.reessayerConservation();eq(retried.issue,'conserve','L6 vol : réessai écrit sans appeler');ok(conserves.at(-1)===exact,'L6 vol : même objet réponse rejoué pour conservation');eq(calls.length,count+1,'L6 vol : zéro coût réessai stockage');
  refus='compte_change';await vol.lancer({plan,ordinals:[3]});eq(calls.length,count+1,'L6 vol : refus de portée avant POST');refus=null;
  const other={importId:'photo',controller:new AbortController()};prendreVol(other);const occupe=await vol.lancer({plan,ordinals:[3]});eq(occupe.raison,'vol_en_cours','L6 vol : mutex commun photo/web/traduction');libererVol(other);
  const waiting={};waiting.promise=new Promise(resolve=>waiting.resolve=resolve);let fetched=0;
  const slow=creerLectureTraduction({depot:{...depot,reserverPortionTraduction:async()=>{await waiting.promise;return{issue:'ok',reservation:{ordinal:4},journalId:'j4',portion:{ordinal:4}};}},provider:{completeTranslation:async()=>{fetched++;return{};}}});
  const pending=slow.lancer({plan:{},ordinals:[4]});slow.annuler();waiting.resolve();await pending;eq(fetched,0,'L6 vol : annuler pendant réserve ne démarre pas HTTP');
  let sequence,states=[];sequence=creerLectureTraduction({depot,provider:{completeTranslation:async()=>{states.push(sequence.etat().statut);return{text:'{}',reponseBrute:new Uint8Array([123,125])};}}});await sequence.lancer({plan:{},ordinals:[0,1]});eq(states,['en_cours','en_cours'],'L6 vol : chaque portion protège la sortie pendant son appel');
  let replayCalls=0,replayShown=0;const replay=creerLectureTraduction({depot:{...depot,commencerPortionTraduction:async()=>({issue:'deja_conserve',journalId:'j0',lecture:{id:'j0'}})},provider:{completeTranslation:async()=>{replayCalls++;}},onLecture:()=>replayShown++});const replayResult=await replay.lancer({plan:{},ordinals:[0]});eq([replayResult.issue,replayCalls,replayShown],['termine',0,1],'L6 vol : réponse durable découverte au départ affichée sans nouvel appel');sequence.detruire();replay.detruire();
  vol.detruire();slow.detruire();reinitialiserVol();
}
