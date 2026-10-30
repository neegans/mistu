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
  // Un départ ancien sans device_id reste vivant si le contrôleur entretient son battement local.
  const {withRepo}=await import('./sync-fixture.js'),{creerDepotTraductions}=await import('../src/domain/depot-traductions.js');
  await withRepo(async(repo,db)=>{
    await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'vol-traduction'}]}});
    const recipe={id:'vol-r',original_title:'Soup',original_language:'en',availability:'available',current_version_id:'vol-v'},version={id:'vol-v',recipe_id:'vol-r',ingredients:[],steps:[{id:'vol-s',text:'Mix.'}]};
    await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
    const depotReel=creerDepotTraductions({repo,getGeneration:()=>0,maintenant:()=>new Date(Date.now()-11*60*1000).toISOString()}),portee=(await depotReel.capturerPortee({owner_id:'vol-traduction'})).portee,ouvert=await depotReel.ouvrirTraduction({portee,affiche:{recipe,version,traductions:[]},locale:'fr'}),prepare=await depotReel.preparerLectureTraduction({session:ouvert.session,selection:ouvert.source.segments.map(s=>s.ref)});
    let terminer,appels=0;const reponse={text:JSON.stringify({format:1,segments:prepare.portions[0].segment_refs.map(s=>({ref:s.ref,text:s.kind==='title'?'Soupe':'Mélanger.'}))}),stopReason:'end_turn',reponseBrute:new Uint8Array([123,125])};
    const actif=creerLectureTraduction({depot:depotReel,repo,provider:{completeTranslation:()=>{appels++;return new Promise(resolve=>terminer=resolve);}}}),enCours=actif.lancer({plan:prepare.plan,ordinals:[0]});
    try{
      let journal,hb;for(let i=0;i<100;i++){journal=(await repo.all('imports')).find(j=>j.kind==='traduction');hb=journal&&await db.get('sync_state','battement:'+journal.id);if(hb&&terminer)break;await new Promise(resolve=>setTimeout(resolve,5));}
      ok(typeof hb?.value==='string'&&Number.isFinite(Date.parse(hb.value))&&new Date(hb.value).toISOString()===hb.value,'L6 vol : battement local daté en ISO, compatible avec la récupération des appels interrompus');
      eq(await repo.marquerInterrompus(),0,'L6 vol : battement vivant protège un appel même si son départ a plus de dix minutes');
      eq((await repo.get('imports',journal.id)).status,'en_cours','L6 vol : la récupération ne coupe pas le journal du POST vivant');
      terminer(reponse);eq((await enCours).issue,'termine','L6 vol : la réponse du POST protégé reste conservable');
      eq([appels,(await repo.get('imports',journal.id)).status],[1,'a_verifier'],'L6 vol : une seule réponse reçue, aucun appel payé relancé après la vérification');
    }finally{terminer?.(reponse);await enCours;actif.detruire();reinitialiserVol();}
  });
}
