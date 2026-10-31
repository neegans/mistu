import {withRepo} from './sync-fixture.js';
import {fixtureThermomixHistorique} from './fixtures/thermomix-0.23.1.js';
import {fixtureChaineThermomixHistorique} from './fixtures/thermomix-0.23.1-chaine.js';
import {renderThermomixRoute} from '../src/ui/thermomix.js';
import {renderCopieCookidoo} from '../src/ui/cookidoo.js';
import * as P from '../src/domain/thermomix-parcours.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
const clone=structuredClone;
const input=(node,value)=>{if(node){node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}};
const options=repo=>({repo,remplacerAdresse(){},navigate(){},toast(){},enLigne:()=>true,sessionAssistant:async()=>({access_token:'fixture-reparation-thermomix',user:{id:'u1'}})});
async function semer(repo,db,f){
 const journal={id:'journal-historique',kind:'thermomix',recipe_id:f.recipe.id,source_version_id:f.original.id,device_id:repo.deviceId(),status:'enregistre',version_id:f.version.id,contexte:clone((f.parent||f.version).provenance.thermomix.contexte),resultat:clone((f.parent||f.version).provenance.thermomix.resultat),revision_brouillon:1};
 await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.original,...(f.parent?[f.parent]:[]),f.version],imports:[journal]}});return journal;
}
export async function runAuditThermomixReparationTests({eq,ok}){
 const locale=getUiLocale();setUiLocale('fr');
 const cas=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,'10.1 réparation '+nom+' : '+e.stack);}};
 try{
  for(const [nom,fabrique,attendus] of [['simple',fixtureThermomixHistorique,['s1']],['deux générations',fixtureChaineThermomixHistorique,['s1','s2']]])await cas(nom,async(repo,db)=>{
   const f=fabrique(),journal=await semer(repo,db,f),avant=await db.getSnapshot(['recipes','recipe_versions','imports','outbox']);let appels=0;
   const root=await renderThermomixRoute({id:f.recipe.id},{v:f.version.id},{}, {...options(repo),parcours:{...P,proposerThermomix:async()=>{appels++;throw Error('appel explicite témoin');}}});document.body.append(root);
   try{
    eq([...root.querySelectorAll('[name=etape]')].map(n=>n.value),f.original.steps.map(s=>s.id),'10.1 '+nom+' : étapes du vrai parent ordinaire');
    eq([...root.querySelectorAll('[name=etape]:checked')].map(n=>n.value),attendus,'10.1 '+nom+' : seuls les blocs concernés remontés par correspondance');
    const eau=root.querySelector('[name=eau_vapeur_g]');eq(eau?.value,'3000','10.1 '+nom+' : ancienne eau visible sans plafonnement');eq(eau?.getAttribute('aria-invalid'),'true','10.1 '+nom+' : eau refusée signalée dès montage');eq(root.querySelector('[data-role=proposer-tm7]')?.disabled,true,'10.1 '+nom+' : aucun appel possible avant correction');
    ok(root.textContent.includes('recette d’origine'),'10.1 '+nom+' : réparation depuis origine expliquée');eq(appels,0,'10.1 '+nom+' : montage sans appel payé');eq(await db.getSnapshot(['recipes','recipe_versions','imports','outbox']),avant,'10.1 '+nom+' : montage ne réécrit aucun plan ni journal');
    input(root.querySelector('[name=demande]'),'Revoir ces étapes.');await root.attendreEcritures?.().catch(()=>{});
    eq((await repo.all('imports')).length,1,'10.1 '+nom+' : valeur historique refusée jamais envoyée au constructeur strict');
    input(eau,'1000');await root.attendreEcritures?.().catch(()=>{});const nouveau=(await repo.all('imports')).find(r=>r.id!==journal.id);
    eq(nouveau?.source_version_id,f.original.id,'10.1 '+nom+' : nouveau brouillon lié au vrai parent');eq(nouveau?.contexte.selection,attendus,'10.1 '+nom+' : sélection exacte conservée');eq(nouveau?.contexte.precisions.eau_vapeur_g,1000,'10.1 '+nom+' : quantité corrigée uniquement par geste');eq(nouveau?.contexte.demande,'Revoir ces étapes.','10.1 '+nom+' : demande conservée pendant correction');eq(appels,0,'10.1 '+nom+' : sauvegarde sans appel payé');
    eq(await repo.get('imports',journal.id),journal,'10.1 '+nom+' : proposition payée et journal historique intacts');eq(await repo.get('recipe_versions',f.version.id),f.version,'10.1 '+nom+' : ancien plan intact après nouveau brouillon');
    root.querySelector('[data-role=proposer-tm7]')?.click();await root.attendreEcritures?.().catch(()=>{});eq(appels,1,'10.1 '+nom+' : appel seulement au clic explicite');
   }finally{root.dispose?.();root.remove();}
  });
  for(const cible of ['version','parent','original'])await cas('garde ouverture '+cible,async(repo,db)=>{
   const f=fixtureChaineThermomixHistorique();await semer(repo,db,f);const muter=db.mutate.bind(db);let atteint=0;
   db.mutate=async args=>{if(!atteint&&(args.puts?.imports||[]).some(r=>r.id!=='journal-historique')){atteint++;await muter({origin:'remote',puts:{recipe_versions:[{...f[cible],notes:'Modification concurrente avant ouverture'}]}});}return muter(args);};
   let raison=null;try{await P.ouvrirThermomix({recipeId:f.recipe.id,versionId:f.original.id,selection:['s1'],precisions:{eau_vapeur_g:1000},ancetresThermomix:[f.version,f.parent,f.original]},{repo});}catch(e){raison=e.code||e.raison||e.message;}finally{db.mutate=muter;}
   eq(atteint,1,'10.1 '+cible+' : course atteint le commit du brouillon');eq(raison,'source_modifiee','10.1 '+cible+' : ascendance exacte gardée dans transaction');eq((await repo.all('imports')).length,1,'10.1 '+cible+' : course sans demi-brouillon');eq((await repo.all('outbox')).length,0,'10.1 '+cible+' : course sans nouvel envoi');
  });
  await cas('copie origine',async(repo,db)=>{
   const f=fixtureChaineThermomixHistorique();await semer(repo,db,f);const before=await db.getSnapshot(['recipes','recipe_versions','imports','outbox']),copied=[];
   const panel=renderCopieCookidoo({recipe:f.recipe,version:f.version},{repo,portions:8,clipboard:{writeText:async texte=>{copied.push(texte);}}});document.body.append(panel);
   try{
    await panel.attendreLecture?.();ok(panel.textContent.includes('recette d’origine'),'10.1 Cookidoo : origine explicitement annoncée');ok(panel.textContent.includes('4 portions'),'10.1 Cookidoo : rendement réel du parent annoncé');ok(panel.textContent.includes('quantités de la recette d’origine'),'10.1 Cookidoo : changement de portions expliqué sans faux rendement');
    const b=panel.querySelector('[data-role=copier-tout]');ok(!!b,'10.1 Cookidoo : copie origine disponible');b?.click();await panel.attendreCopie();eq(copied.length,1,'10.1 Cookidoo : vraie porte presse-papiers atteinte');
    ok(f.original.steps.every(s=>copied[0]?.includes(s.text)),'10.1 Cookidoo : étapes ordinaires exactes copiées');ok(!copied[0]?.includes('TM7')&&!copied[0]?.includes('3 000')&&!copied[0]?.includes('3000')&&!copied[0]?.includes('8 portions'),'10.1 Cookidoo : aucun réglage refusé ni portions imaginaires');ok(copied[0]?.includes('Recette d’origine')&&copied[0]?.includes('4 portions'),'10.1 Cookidoo : texte copié nommé avec portions réellement copiées');
    eq(await db.getSnapshot(['recipes','recipe_versions','imports','outbox']),before,'10.1 Cookidoo : copie sans écriture métier ni envoi');
   }finally{panel.dispose?.();panel.remove();}
  });
  for(const mutation of ['parent','enfant','recette','compte','époque'])await cas('copie concurrence '+mutation,async(repo,db)=>{
   const f=fixtureThermomixHistorique();await semer(repo,db,f);const copied=[],panel=renderCopieCookidoo({recipe:f.recipe,version:f.version},{repo,clipboard:{writeText:async texte=>copied.push(texte)}});document.body.append(panel);
   try{
    await panel.attendreLecture?.();ok(!!panel.querySelector('[data-role=copier-tout]'),'10.1 copie '+mutation+' : copie prête avant course');
    if(mutation==='parent'||mutation==='enfant'){const v=mutation==='parent'?f.original:f.version;await db.mutate({origin:'remote',puts:{recipe_versions:[{...v,notes:'Concurrent'}]}});}
    else if(mutation==='recette')await db.mutate({origin:'remote',puts:{recipes:[{...f.recipe,availability:'partial'}]}});
    else if(mutation==='compte')await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'autre-compte'}]}});
    else {const {CLE_EPOQUE_EDITEUR}=await import('../src/domain/brouillons-format.js');await db.mutate({origin:'device',puts:{sync_state:[{key:CLE_EPOQUE_EDITEUR,value:'epoque-remplacee'}]}});}
    panel.querySelector('[data-role=copier-tout]')?.click();await panel.attendreCopie();eq(copied.length,0,'10.1 copie '+mutation+' : refus avant presse-papiers');ok(panel.textContent.includes('ne correspondent plus'),'10.1 copie '+mutation+' : refus visible');
   }finally{panel.dispose?.();panel.remove();}
  });
  await cas('copie manuelle et course transactionnelle',async(repo,db)=>{
   const f=fixtureThermomixHistorique();await semer(repo,db,f);let tentatives=0;
   const panel=renderCopieCookidoo({recipe:f.recipe,version:f.version},{repo,clipboard:{writeText:async()=>{tentatives++;throw Error('presse-papiers refusé');}}});document.body.append(panel);const muter=db.mutate.bind(db);
   try{
    await panel.attendreLecture?.();panel.querySelector('[data-role=copier-tout]')?.click();await panel.attendreCopie();
    eq(tentatives,1,'10.1 copie manuelle : vrai refus du presse-papiers atteint');ok(panel.querySelector('textarea')?.value.includes(f.original.steps[0].text),'10.1 copie manuelle : original sélectionnable');
    let atteint=0;db.mutate=async args=>{if(!atteint&&args.conditions?.recipe_versions?.length){atteint++;await muter({origin:'remote',puts:{recipe_versions:[{...f.original,notes:'Course au dernier contrôle'}]}});}return muter(args);};
    panel.querySelector('[data-role=copier-tout]')?.click();await panel.attendreCopie();eq(atteint,1,'10.1 copie : course atteint contrôle transactionnel');eq(tentatives,1,'10.1 copie : aucune seconde tentative après changement pendant contrôle');eq(panel.querySelector('textarea')?.value,'','10.1 copie : ancienne copie manuelle retirée après refus concurrent');
   }finally{db.mutate=muter;panel.dispose?.();panel.remove();}
  });
  await cas('formulaire corrompu',async(repo,db)=>{
   const f=fixtureThermomixHistorique();f.version.steps[0].text+=' Texte modifié sans signature.';await semer(repo,db,f);
   const root=await renderThermomixRoute({id:f.recipe.id},{v:f.version.id},{},options(repo));document.body.append(root);
   try{eq(root.querySelectorAll('[name=etape]').length,0,'10.1 plan corrompu : aucune instruction proposée comme source de réparation');eq(root.querySelector('[data-role=proposer-tm7]'),null,'10.1 plan corrompu : aucun appel proposé');eq((await repo.all('imports')).length,1,'10.1 plan corrompu : journal historique seul et intact');}
   finally{root.dispose?.();root.remove();}
  });
  for(const probleme of ['partielle','parent absent','plan corrompu'])await cas('refus '+probleme,async(repo,db)=>{
   const f=fixtureThermomixHistorique();if(probleme==='partielle')f.recipe.availability='partial';if(probleme==='plan corrompu')f.version.steps[0].text+=' Modification non signée.';await semer(repo,db,f);if(probleme==='parent absent')await db.mutate({origin:'remote',deletes:{recipe_versions:[f.original.id]}});
   const panel=renderCopieCookidoo({recipe:f.recipe,version:f.version},{repo});document.body.append(panel);try{await panel.attendreLecture?.();eq(panel.querySelectorAll('button[data-role^=copier]').length,0,'10.1 '+probleme+' : aucune copie disponible');}finally{panel.dispose?.();panel.remove();}
  });
 }finally{setUiLocale(locale);}
}
