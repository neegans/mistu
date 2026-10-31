import {withRepo} from './sync-fixture.js';
import {fixtureThermomixHistorique} from './fixtures/thermomix-0.23.1.js';
import {fixtureSoeursThermomixHistorique} from './fixtures/thermomix-0.23.1-soeurs.js';
import {creerServiceCuisine} from '../src/domain/cuisine-persistance.js';
import {adopterProgressionCuisine} from '../src/domain/cuisine-format.js';
import {ligneMinuteurL7} from './l7-minuteurs-ecran.js';
import {renderCook} from '../src/ui/cook.js';
import {getData,getSyncGeneration} from '../src/ui/state.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const DATE='2026-10-30T10:00:00.000Z',OP='ck_op_'+ 'a'.repeat(64);
const attendre=async fn=>{const fin=performance.now()+15000;while(!await fn()){if(performance.now()>fin)throw Error('Reprise de séance non terminée');await new Promise(r=>setTimeout(r,10));}};
async function semer(db,{soeurs=false,portionsDifferentes=false}={}){
 const f=soeurs?fixtureSoeursThermomixHistorique():fixtureThermomixHistorique(),versions=[f.version,...(soeurs?[f.soeur]:[])];
 const base={id:'ancienne-seance-tm7',recipe_id:f.recipe.id,meal_id:null,selected_version_ids:versions.map(v=>v.id),active_version_id:f.version.id,servings:f.version.servings,servings_by_version:Object.fromEntries(versions.map((v,i)=>[v.id,v.servings+(i&&portionsDifferentes?1:0)])),units:'original',lang:'fr',status:'active',started_at:DATE,progress:{current_step_id:f.version.steps[0].id,done_step_ids:[f.version.steps[0].id]}};
 const session=adopterProgressionCuisine(base,versions,OP),timer=ligneMinuteurL7({id:'suivi-de-l-ancienne-seance',cook_session_id:session.id,recipe_version_id:f.version.id,step_id:f.version.steps[0].id});
 await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.original,...versions],cook_sessions:[session],timer_launches:[timer],sync_state:[{key:'user_id',value:'u1'}]}});
 return{...f,session,timer};
}
async function serviceDe(repo,session,options={}){
 let ids=0;const service=creerServiceCuisine({repo,getGeneration:getSyncGeneration,maintenant:()=>DATE,newId:prefix=>prefix+'-nouvelle-seance-'+(++ids),...options});
 const capture=await service.capturerPortee({owner_id:'u1'}),portee=capture.portee,lecture=await service.lireSession({portee,sessionId:session.id});
 return{service,portee,lecture,ids:()=>ids};
}
async function preparer(s){return await s.service.preparerRepriseOriginale?.({portee:s.portee,lecture:s.lecture.lecture})??{issue:'fonction_absente'};}

export async function runAuditThermomixSeancesTests({eq,ok}){
 const langue=getUiLocale();setUiLocale('fr');
 try{
  await withRepo(async(repo,db)=>{
   const f=await semer(db),s=await serviceDe(repo,f.session),avant=await db.getSnapshot(['recipes','recipe_versions','cook_sessions','timer_launches']);
   eq(s.lecture.projection.versions[0].execution_autorisee,false,'10.1 séance : ancien plan ne devient jamais exécutable');
   eq(s.lecture.projection.versions[0].thermomix_a_revoir,true,'10.1 séance : projection distingue adaptation à revoir');
   const p=await preparer(s);eq(p.issue,'ok','10.1 séance : préparer une vraie reprise sur l’original');if(p.issue!=='ok')return;
   eq(await db.getSnapshot(['recipes','recipe_versions','cook_sessions','timer_launches']),avant,'10.1 séance : préparation seule ne réécrit rien');
   const r=await s.service.conserverRepriseOriginale({intention:p.intention});eq(r.issue,'conserve','10.1 séance : nouvelle séance réellement conservée');
   const nouveau=await db.get('cook_sessions',r.session_id);
   ok(nouveau.id!==f.session.id,'10.1 séance : identité distincte de la séance signée');
   eq(nouveau.selected_version_ids,[f.original.id],'10.1 séance : références réelles du parent ordinaire');
   eq(nouveau.active_version_id,f.original.id,'10.1 séance : version active du parent');
   eq(nouveau.servings_by_version,{[f.original.id]:f.version.servings},'10.1 séance : portions explicites transférées par version réelle');
   eq(nouveau.progress,{done_step_ids:[]},'10.1 séance : aucune case ni indice de progression recopié');
   eq(nouveau.cooking_state,undefined,'10.1 séance : aucune signature de l’ancienne séance recopiée');
   eq(await db.get('cook_sessions',f.session.id),f.session,'10.1 séance : progression et reçus de l’ancienne séance intacts');
   eq(await db.get('timer_launches',f.timer.id),f.timer,'10.1 séance : minuterie reste sur son ancienne séance');
   eq(await db.get('recipe_versions',f.version.id),f.version,'10.1 séance : ancien plan inchangé');
   eq(await db.get('recipes',f.recipe.id),f.recipe,'10.1 séance : pointeur courant de la recette inchangé');
   const file=await db.getAll('outbox');eq(file.map(e=>[e.store,e.id]),[['cook_sessions',nouveau.id]],'10.1 séance : seul le nouveau document part en synchronisation');
   eq((await s.service.conserverRepriseOriginale({intention:p.intention})).issue,'deja_conserve','10.1 séance : même intention reconnue');
   eq(await db.getAll('outbox'),file,'10.1 séance : aucun second envoi au réessai reconnu');
  });
  for(const cible of ['enfant','parent','seance','compte','epoque','quota'])await withRepo(async(repo,db)=>{
   const f=await semer(db),s=await serviceDe(repo,f.session),p=await preparer(s);eq(p.issue,'ok','10.1 séance '+cible+' : intention préparée avant concurrence');if(p.issue!=='ok')return;
   const mutate=db.mutate.bind(db);let atteint=0;
   db.mutate=async args=>{
    if(args.puts?.cook_sessions?.some(row=>row.id!==f.session.id)){
     atteint++;
     if(atteint===1){
      if(cible==='quota')throw new DOMException('quota injecté','QuotaExceededError');
      const puts=cible==='enfant'?{recipe_versions:[{...f.version,notes:'Autre saisie'}]}:cible==='parent'?{recipe_versions:[{...f.original,notes:'Autre saisie'}]}:cible==='seance'?{cook_sessions:[{...f.session,lang:'en'}]}:{sync_state:[{key:cible==='compte'?'user_id':'editor_library_epoch:v1',value:'ailleurs'}]};
      await mutate({origin:'remote',puts});
     }
    }
    return mutate(args);
   };
   try{
    const r=await s.service.conserverRepriseOriginale({intention:p.intention});
    eq(atteint,1,'10.1 séance '+cible+' : fenêtre transactionnelle réellement atteinte');
    eq(r.raison,{enfant:'source_modifiee',parent:'version_modifiee',seance:'session_changee',compte:'compte_change',epoque:'bibliotheque_remplacee',quota:'quota_stockage'}[cible],'10.1 séance '+cible+' : motif exact');
    eq((await db.getAll('cook_sessions')).length,1,'10.1 séance '+cible+' : aucune nouvelle séance partielle');
    eq((await db.getAll('outbox')).length,0,'10.1 séance '+cible+' : aucun envoi partiel');
    if(cible==='quota'){
     const reserve=s.ids();const rr=await s.service.conserverRepriseOriginale({intention:p.intention});eq(rr.issue,'conserve','10.1 séance quota : même intention réessayable');eq(s.ids(),reserve,'10.1 séance quota : aucune nouvelle identité réservée');eq((await db.get('cook_sessions',rr.session_id)).started_at,DATE,'10.1 séance quota : départ initial conservé');
    }
   }finally{db.mutate=mutate;}
  });
  for(const differentes of [false,true])await withRepo(async(repo,db)=>{
   const f=await semer(db,{soeurs:true,portionsDifferentes:differentes}),s=await serviceDe(repo,f.session),p=await preparer(s);
   eq(p.issue,differentes?'refuse':'ok','10.1 séance collision : décision selon les portions réellement choisies');
   if(differentes){eq(p.raison,'portions_incompatibles','10.1 séance collision : refus exact sans addition inventée');eq((await db.getAll('cook_sessions')).length,1,'10.1 séance collision : ancienne séance conservée seule');}
   else if(p.issue==='ok'){const r=await s.service.conserverRepriseOriginale({intention:p.intention});eq((await db.get('cook_sessions',r.session_id)).selected_version_ids,[f.original.id],'10.1 séance collision : même parent et mêmes portions dédupliqués');}
  });
  await withRepo(async(repo,db)=>{
   const f=await semer(db),s=await serviceDe(repo,f.session);await db.mutate({origin:'remote',deletes:{recipe_versions:[f.original.id]}});
   const p=await preparer(s);eq(p.raison,'source_absente','10.1 séance : parent manquant ne devient pas un snapshot inventé');eq((await db.getAll('cook_sessions')).length,1,'10.1 séance : parent absent ne crée aucune copie');
  });
  await withRepo(async(repo,db)=>{
   const f=await semer(db),corrompue={...f.session,cooking_state:{...f.session.cooking_state,incarnation:'invalide'}};
   await db.mutate({origin:'remote',puts:{cook_sessions:[corrompue]}});const s=await serviceDe(repo,corrompue),p=await preparer(s);
   eq(p.raison,'progression_invalide','10.1 séance : une séance signée corrompue ne prépare pas une reprise réputée sûre');
   eq(s.lecture.projection.versions[0].thermomix_a_revoir,undefined,'10.1 séance : aucun geste de reprise proposé depuis une séance corrompue');
  });
  await withRepo(async(repo,db)=>{
   const f=await semer(db);let generation=0;const s=await serviceDe(repo,f.session,{getGeneration:()=>generation}),p=await preparer(s);
   eq(p.issue,'ok','10.1 séance portée : intention préparée dans la génération initiale');if(p.issue!=='ok')return;
   generation++;eq((await s.service.conserverRepriseOriginale({intention:p.intention})).raison,'contexte_change','10.1 séance portée : ancienne génération refusée');
   eq((await db.getAll('cook_sessions')).length,1,'10.1 séance portée : aucune copie dans une autre génération');
  });
  await withRepo(async(repo,db)=>{
   const f=await semer(db),navigations=[],root=await renderCook({id:f.session.id},{},await getData(true),{repo,navigate:path=>navigations.push(path)});document.body.append(root);
   const mutate=db.mutate.bind(db);let quota=true,atteint=0;
   db.mutate=async args=>{if(args.puts?.cook_sessions?.some(r=>r.id!==f.session.id)){atteint++;if(quota)throw new DOMException('quota injecté','QuotaExceededError');}return mutate(args);};
   try{
    const b=root.querySelector('[data-role=reprise-originale] button');ok(!!b,'10.1 écran cuisine : geste explicite pour ouvrir l’original');
    eq((await db.getAll('cook_sessions')).length,1,'10.1 écran cuisine : aucun démarrage automatique au montage');
    ok(!!root.querySelector('[data-role=panneau-minuteurs]'),'10.1 écran cuisine : anciens suivis restent consultables');
    if(!b)return;b.click();b.click();await attendre(()=>root.querySelector('[data-role=etat-reprise-originale]')?.textContent.includes('stockage'));
    eq(atteint,1,'10.1 écran cuisine : double clic ne prépare pas deux reprises');eq(navigations,[],'10.1 écran cuisine : quota ne navigue pas vers une séance absente');
    quota=false;b.click();await attendre(()=>navigations.length===1);
    const nouvelles=(await db.getAll('cook_sessions')).filter(s=>s.id!==f.session.id);eq(nouvelles.length,1,'10.1 écran cuisine : un seul original ouvert après réessai');
    eq(navigations,['/cook/'+nouvelles[0].id],'10.1 écran cuisine : navigation vers la nouvelle identité conservée');
    eq(nouvelles[0].selected_version_ids,[f.original.id],'10.1 écran cuisine : parent réel dans la nouvelle route');
    eq(await db.get('cook_sessions',f.session.id),f.session,'10.1 écran cuisine : ancienne séance signée intacte après navigation');
    eq(await db.get('timer_launches',f.timer.id),f.timer,'10.1 écran cuisine : aucun transfert de suivi à la nouvelle séance');
   }finally{db.mutate=mutate;root.dispose();root.remove();}
  });
 }finally{setUiLocale(langue);}
}
