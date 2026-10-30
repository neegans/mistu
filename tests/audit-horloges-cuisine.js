import {withRepo} from './sync-fixture.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {ligneMinuteurL7} from './l7-minuteurs-ecran.js';
import {creerServiceCuisine} from '../src/domain/cuisine-persistance.js';
import {creerPanneauMinuteurs} from '../src/ui/minuteurs-session.js';
import {renderCook} from '../src/ui/cook.js';
import {renderHome} from '../src/ui/home.js';
import {getData,getSyncGeneration} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {syncNow,setClockOffset,resetClock} from '../src/sync/clock.js';

const DEPART='2026-10-30T10:00:00.000Z',T=Date.parse(DEPART),HEURE=3600000;
const bouton=(node,texte)=>[...node.querySelectorAll('button')].find(b=>b.textContent===texte);
function attendreDOM(node,predicate){
 return new Promise((resolve,reject)=>{let timer;const observer=new MutationObserver(verifier);function verifier(){const valeur=predicate();if(valeur){observer.disconnect();clearTimeout(timer);resolve(valeur);}}timer=setTimeout(()=>{observer.disconnect();reject(Error('État cuisine attendu absent'));},15000);observer.observe(node,{subtree:true,childList:true,attributes:true,characterData:true});verifier();});
}
async function horloge(test){
 const OriginalDate=globalThis.Date;let local=T+HEURE;
 globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[local]));}static now(){return local;}};
 resetClock();setClockOffset(-HEURE);
 try{return await test({local:()=>local,fixer:ms=>{local=ms;},avancer:ms=>{local+=ms;},OriginalDate});}
 finally{globalThis.Date=OriginalDate;resetClock();}
}
async function semer(db,{terminee=false,timers=[]}={}){
 const f=fixtureLectureL6();f.version.steps=[{id:'horloge-etape',position:1,text:'Laisser reposer.',timers:[{seconds:90,label:'Repos'}]}];
 const session={id:'horloge-session',recipe_id:f.recipe.id,meal_id:null,selected_version_ids:[f.version.id],active_version_id:f.version.id,servings:4,units:'original',lang:'original',status:terminee?'done':'active',started_at:DEPART,progress:{done_step_ids:[]}};
 await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],cook_sessions:[session],...(timers.length?{timer_launches:timers.map(r=>({...r,cook_session_id:session.id,recipe_version_id:f.version.id,step_id:'horloge-etape'}))}:{})}});
 return{...f,session};
}
async function ouvrirService(repo,session,options={}){
 const service=creerServiceCuisine({repo,getGeneration:getSyncGeneration,...options}),capture=await service.capturerPortee({owner_id:null}),portee=capture.portee,lecture=await service.lireSession({portee,sessionId:session.id});
 if(capture.issue!=='ok'||lecture.issue!=='ok')throw Error('Portée de cuisine invalide');return{service,portee,lecture};
}
function fenetrePilotee(){const fenetre=new EventTarget(),callbacks=new Map();let id=0,effaces=0;fenetre.setInterval=fn=>{callbacks.set(++id,fn);return id;};fenetre.clearInterval=n=>{if(callbacks.delete(n))effaces++;};return{fenetre,tick:()=>{for(const fn of callbacks.values())fn();},compter:()=>callbacks.size,effaces:()=>effaces};}

export async function runAuditHorlogesCuisineTests({eq,ok}){
 const locale=getUiLocale();setUiLocale('fr');
 const cas=async(nom,fn)=>{try{await withRepo((repo,db)=>horloge(h=>fn(repo,db,h)));}catch(error){ok(false,'9.6 '+nom+' : '+(error.stack||error));}};
 try{
  await cas('service direct',async(repo,db,h)=>{
   const f=await semer(db),{service,portee,lecture}=await ouvrirService(repo,f.session);
   resetClock();setClockOffset(-HEURE);
   const args={portee,lecture:lecture.lecture,versionId:f.version.id,stepId:'horloge-etape',ordinal:0,channel:'mirror'};
   const plan=await service.preparerLancement(args);eq(plan.issue,'ok','9.6 dépôt : préparation atteint le vrai service par défaut');
   const conserve=await service.conserverLancement({intention:plan.intention}),row=conserve.affiche?.ligne;
   eq(conserve.issue,'conserve','9.6 dépôt : lancement réellement conservé');
   eq([row?.created_at,row?.mirror?.started_at,row?.mirror?.deadline_at],[DEPART,DEPART,'2026-10-30T10:01:30.000Z'],'9.6 dépôt : dates du lancement corrigées malgré appareil en avance');
   h.avancer(30000);const liste=await service.lireMinuteurs({portee,sessionId:f.session.id});
   eq([liste.actifs?.length,liste.actifs?.[0]?.affiche.reste_secondes,liste.observed_at],[1,60,'2026-10-30T10:00:30.000Z'],'9.6 dépôt : lecture corrigée et instant observé cohérents');
   const file=await db.getAll('outbox'),rejeu=await service.conserverLancement({intention:plan.intention});
   eq(rejeu.issue,'deja_conserve','9.6 dépôt : même intention reconnue sans nouveau lancement');eq(rejeu.affiche?.ligne.mirror,row.mirror,'9.6 dépôt : rejeu garde exactement son ancre');eq(await db.getAll('outbox'),file,'9.6 dépôt : rejeu ne crée aucun nouvel envoi');
   let moderne;
   for(const [channel,ms] of [['siri',40000],['shortcut',50000]]){
    h.fixer(T+HEURE+ms);const lu=await service.lireSession({portee,sessionId:f.session.id}),p=await service.preparerLancement({...args,lecture:lu.lecture,channel}),r=await service.conserverLancement({intention:p.intention});
    eq(r.issue,'conserve',`9.6 ${channel} : demande durable atteinte`);eq(r.affiche?.ligne.requested_at,new Date(T+ms).toISOString(),`9.6 ${channel} : requested_at corrigé`);eq(r.affiche?.ligne.mirror,null,`9.6 ${channel} : aucun suivi implicite`);moderne=r;
   }
   h.fixer(T+HEURE+70000);const lu=await service.lireSession({portee,sessionId:f.session.id}),ancre=await service.preparerAncre({portee,lecture:lu.lecture,lancement:moderne.lancement}),ancree=await service.conserverAncre({intention:ancre.intention});
   eq(ancree.issue,'conserve','9.6 ancre : geste distinct conservé');eq(ancree.affiche?.ligne.id,moderne.affiche.ligne.id,'9.6 ancre : identité moderne inchangée');eq(ancree.affiche?.ligne.mirror,{format:1,started_at:'2026-10-30T10:01:10.000Z',deadline_at:'2026-10-30T10:02:40.000Z'},'9.6 ancre : geste distinct utilise heure corrigée');
   const legacy={id:'ancienne-demande',cook_session_id:f.session.id,recipe_version_id:f.version.id,step_id:'horloge-etape',duration_seconds:90,channel:'siri',requested_at:DEPART};await db.put('timer_launches',legacy,{origin:'remote'});
   const legacyLu=(await service.lireMinuteurs({portee,sessionId:f.session.id})).demandes.find(x=>x.affiche.ligne.id===legacy.id);h.fixer(T+HEURE+80000);
   const legacyPlan=await service.preparerAncre({portee,lecture:lu.lecture,lancement:legacyLu.lancement}),legacyR=await service.conserverAncre({intention:legacyPlan.intention});
   eq(legacyR.issue,'conserve','9.6 ancienne demande : nouveau suivi conservé');eq(legacyR.affiche?.ligne.mirror?.started_at,'2026-10-30T10:01:20.000Z','9.6 ancienne demande : départ corrigé au geste');eq(legacyR.affiche?.ligne.legacy_launch_id,legacy.id,'9.6 ancienne demande : nouvelle identité liée à l’origine');eq(await db.get('timer_launches',legacy.id),legacy,'9.6 ancienne demande : ligne historique jamais redatée');
   const injectee='2026-10-30T09:59:30.000Z',i=await ouvrirService(repo,f.session,{maintenant:()=>injectee}),p=await i.service.preparerLancement({...args,portee:i.portee,lecture:i.lecture.lecture});
   eq(p.apercu?.mirror?.started_at,injectee,'9.6 dépôt : horloge explicitement injectée préservée');
  });
  await cas('lectures sans effet sur horloge',async(repo,db)=>{
   const rows=Array.from({length:64},(_,i)=>ligneMinuteurL7({id:'volume-heure-'+i})),f=await semer(db,{timers:rows}),s=await ouvrirService(repo,f.session);
   const muter=db.mutate.bind(db);let ecritures=0;db.mutate=(...args)=>{ecritures++;return muter(...args);};
   try{
    resetClock();setClockOffset(-HEURE);const avant=syncNow();let lu;
    for(let n=0;n<3;n++)lu=await s.service.lireMinuteurs({portee:s.portee,sessionId:f.session.id});
    eq([lu.actifs?.length,lu.totalHistorique],[64,0],'9.6 volume : tous les suivis corrigés restent actifs');eq(lu.observed_at,DEPART,'9.6 volume : heure observée corrigée sans avance par ligne');
    eq(Date.parse(syncNow())-Date.parse(avant),1,'9.6 volume : les seules lectures ne déplacent pas le plancher syncNow');eq(ecritures,0,'9.6 volume : aucune écriture pour relire les suivis');
    let appels=0;const injectee=await ouvrirService(repo,f.session,{maintenant:()=>new Date(T+1000*appels++).toISOString()});appels=0;
    const coh=await injectee.service.lireMinuteurs({portee:injectee.portee,sessionId:f.session.id});
    eq(appels,1,'9.6 volume : une lecture capture une seule heure injectée');eq([coh.observed_at,[...new Set(coh.actifs.map(x=>x.affiche.reste_secondes))]],[DEPART,[90]],'9.6 volume : observed_at et toutes les lignes partagent le même instant');
   }finally{db.mutate=muter;}
  });
  await cas('panneau et sauts',async(repo,db,h)=>{
   const f=await semer(db,{timers:[ligneMinuteurL7()]}),s=await ouvrirService(repo,f.session),pilote=fenetrePilotee();let monotone=0;
   const panneau=creerPanneauMinuteurs({sessionId:f.session.id,service:s.service,portee:s.portee,fenetre:pilote.fenetre,performanceNow:()=>monotone});document.body.append(panneau);
   const muter=db.mutate.bind(db);let ecritures=0;db.mutate=(...args)=>{ecritures++;return muter(...args);};
   try{
    await panneau.actualiser();const compteur=()=>panneau.querySelector('[data-role=minuteur-compteur]')?.textContent;
    eq(compteur(),'Suivi indicatif : 1 min 30 s','9.6 panneau : une ancre corrigée garde ses90secondes sur appareil avancé');eq(panneau.etat().suivisActifs,1,'9.6 panneau : état actif projeté avec décalage');
    const avant=await db.getSnapshot(['timer_launches','outbox']);h.avancer(30000);monotone+=30000;pilote.tick();eq(compteur(),'Suivi indicatif : 1 min','9.6 panneau : tick calcule le vrai temps restant');
    h.avancer(HEURE+500);setClockOffset(-2*HEURE);monotone+=500;pilote.tick();eq(compteur(),'Suivi indicatif : 1 min','9.6 panneau : saut local compensé sans fausse expiration');eq(panneau.querySelector('[data-role=horloge-minuteurs]').hidden,true,'9.6 panneau : compensation continue sans faux diagnostic de saut');
    h.avancer(500);setClockOffset(-2*HEURE+10000);monotone+=500;pilote.tick();eq(compteur(),'Suivi indicatif : 49 s','9.6 panneau : offset seul modifie estimation depuis échéance');eq(panneau.querySelector('[data-role=horloge-minuteurs]').hidden,false,'9.6 panneau : offset seul conserve diagnostic de discontinuité');
    eq(await db.getSnapshot(['timer_launches','outbox']),avant,'9.6 panneau : ticks et changements d’offset ne réécrivent aucune ancre ni file');eq(ecritures,0,'9.6 panneau : aucune mutation par tick');
   }finally{db.mutate=muter;panneau.dispose();panneau.remove();}eq(pilote.compter(),0,'9.6 panneau : intervalle retiré au démontage');eq(pilote.effaces(),1,'9.6 panneau : un seul intervalle effectivement nettoyé');
  });
  await cas('vrai écran et réessai',async(repo,db,h)=>{
   const f=await semer(db),ctx=await getData(true),pilote=fenetrePilotee(),commandes=[];let ids=0,panneau;
   const depot={...repo,newId:prefix=>prefix+'-horloge-'+(++ids),muterCuisine:(args,...options)=>{commandes.push(structuredClone(args.commandes));return repo.muterCuisine(args,...options);}},root=await renderCook({id:f.session.id},{},ctx,{repo:depot,creerPanneauMinuteurs:args=>(panneau=creerPanneauMinuteurs({...args,fenetre:pilote.fenetre,performanceNow:()=>0}))});document.body.append(root);
   const muter=db.mutate.bind(db);let quota=true,atteintes=0;
   db.mutate=async args=>{if(args.conditions?.timer_launches?.length){atteintes++;if(quota)throw new DOMException('quota injecté','QuotaExceededError');}return muter(args);};
   try{
    resetClock();setClockOffset(-HEURE);bouton(root,'Démarrer un suivi indicatif').click();await attendreDOM(root,()=>root.textContent.includes('stockage est insuffisant'));
    eq(atteintes,1,'9.6 vrai écran : refus quota atteint la transaction du lancement');eq((await db.getAll('timer_launches')).length,0,'9.6 vrai écran : refus ne laisse aucun lancement');eq((await db.get('cook_sessions',f.session.id)).progress,f.session.progress,'9.6 vrai écran : refus ne laisse aucune adoption partielle');
    const premiere=commandes[0].find(c=>c.store==='timer_launches'),reserve=ids;
    eq(premiere?.change.timer.mirror.started_at,DEPART,'9.6 vrai écran : défaut UI prépare une ancre corrigée');
    h.avancer(60000);quota=false;bouton(root,'Réessayer l’enregistrement').click();await attendreDOM(root,()=>root.querySelector('[data-role=minuteur-compteur]'));await panneau.actualiser();
    const rows=await db.getAll('timer_launches'),row=rows[0];eq(rows.length,1,'9.6 vrai écran : réessai conserve une seule ligne');eq(ids,reserve,'9.6 vrai écran : aucune identité réservée au réessai');eq(commandes[1],commandes[0],'9.6 vrai écran : commandes signées entières identiques après refus');
    eq([row.id,row.created_at,row.mirror.started_at,row.mirror.deadline_at],[premiere.id,DEPART,DEPART,'2026-10-30T10:01:30.000Z'],'9.6 vrai écran : réessai conserve identité et ancre du premier geste');eq(root.querySelector('[data-role=minuteur-compteur]').textContent,'Suivi indicatif : 30 s','9.6 vrai écran : réessai affiche30secondes restantes sans redémarrer');
    const avant=await db.getSnapshot(['timer_launches','outbox']);root.dispose();root.remove();
    const repris=await renderCook({id:f.session.id},{},await getData(true),{repo:depot,creerPanneauMinuteurs:args=>creerPanneauMinuteurs({...args,fenetre:pilote.fenetre})});document.body.append(repris);
    try{eq(repris.querySelector('[data-role=minuteur-ligne]')?.dataset.id,row.id,'9.6 vrai écran : remontage retrouve la même minuterie');eq(repris.querySelector('[data-role=minuteur-compteur]')?.textContent,'Suivi indicatif : 30 s','9.6 vrai écran : remontage garde le temps restant réel');eq(await db.getSnapshot(['timer_launches','outbox']),avant,'9.6 vrai écran : relecture sans nouvelle commande ni modification d’ancre');}finally{repris.dispose();repris.remove();}
   }finally{db.mutate=muter;root.dispose();root.remove();}eq(pilote.compter(),0,'9.6 vrai écran : tous les contrôleurs temporels sont démontés');
  });
  await cas('accueil et jours civils',async(repo,db,h)=>{
   const f=await semer(db,{terminee:true,timers:[ligneMinuteurL7()]});let root=await renderHome({},{},await getData(true),{repo});document.body.append(root);
   try{ok(!!root.querySelector('a[href="#/cook/horloge-session"]'),'9.6 accueil : séance terminée accessible tant que suivi corrigé actif');}finally{root.dispose();root.remove();}
   h.avancer(90001);root=await renderHome({},{},await getData(true),{repo});try{eq(root.querySelector('a[href="#/cook/horloge-session"]'),null,'9.6 accueil : séance terminée retirée après vraie échéance');}finally{root.dispose();}
   h.fixer(new h.OriginalDate(2026,9,31,0,30).getTime());setClockOffset(-HEURE);const ctx=await getData(true);ctx.inventory=[{id:'date-civile',label:'Repère civil',quantity_text:'1 portion',use_by_on:'2026-10-30'}];
   root=await renderHome({},{},ctx,{repo});try{ok(!!root.querySelector('li .chip.danger'),'9.6 accueil : inventaire garde le jour local après minuit malgré décalage serveur');}finally{root.dispose();}
   root=await renderHome({},{},ctx,{repo,maintenant:()=>new h.OriginalDate(2026,9,30,12).getTime()});try{eq(root.querySelector('li .chip.danger'),null,'9.6 accueil : horloge injectée reste prioritaire pour dates civiles');}finally{root.dispose();}
  });
 }finally{setUiLocale(locale);resetClock();}
}
