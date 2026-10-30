import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderImport } from '../src/ui/import.js';
import { saisieIndexManuelle, enregistrerAuto, panneauIndex } from '../src/ui/index-livre.js';
import { panneauClassement } from '../src/ui/regroupement.js';
import { lancerVol } from '../src/ui/import-cible.js';
import { capturerEdition } from '../src/ui/recette-garde.js';
import * as sourcesImport from '../src/domain/sources-import.js';
import { restaurerRecette } from '../src/domain/corbeille.js';
import { MODELES_INDEX } from '../src/domain/index-livre.js';
import { sha256Hex } from '../src/core/hash.js';

const attendre = async fn => { for(let i=0;i<400;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Fait attendu absent'); };
const bouton = (root, texte) => [...root.querySelectorAll('button')].find(b=>b.textContent.trim()===texte);
const edition = (cycle=null, mode=null) => ({id:'ed-import-l2',book_id:'book-import-l2',...(cycle?{lifecycle_id:cycle,trashed_at:mode?'2026-10-29T12:00:00.000Z':null,trash_mode:mode}: {})});
const image = async nom => {const c=new OffscreenCanvas(32,32),x=c.getContext('2d');x.fillStyle=nom==='source.jpg'?'#321':'#a31';x.fillRect(0,0,32,32);return new File([await c.convertToBlob({type:'image/jpeg'})],nom,{type:'image/jpeg'});};
async function seed(repo,db,ed=edition()) {
  const file=await image('source.jpg'),sha=await sha256Hex(file);
  const page={id:'pg-import-l2',edition_id:ed.id,document_id:'doc-import-l2',sha256:sha,position:1,rotation:0,printed_page:null};
  const session={id:'ss-import-l2',edition_id:ed.id,status:'open',page_ids:[page.id],document_ids:[page.document_id],started_at:'2026-10-29T12:00:00.000Z',device_id:repo.deviceId()};
  await db.mutate({origin:'remote',puts:{books:[{id:ed.book_id,title:'Livre import'}],book_editions:[ed],source_pages:[page],source_documents:[{id:page.document_id,edition_id:ed.id,scan_session_id:session.id,source_type:'photo',sha256:sha}],scan_sessions:[session],files:[{sha256:sha,blob:file,mime:file.type}]}});
  return {ed,page,session};
}
const resultatIndex = pageId => ({format:2,pages:[{page_id:pageId,etat:'lue',sorte_page:'index',page_imprimee:1,suite_rubrique:false,modele:MODELES_INDEX[0],raison:null,moities:0,entrees:[{titre:'Soupe attendue',renvois:'12',rubrique:null,sorte:'recette',incertain:false}],incertain:[],ecartees:{adresse:0,longueur:0,forme:0}}]});
async function indexLu(repo,db,base) {
  const ligne={id:'index-l2',kind:'index',edition_id:base.ed.id,scan_session_id:base.session.id,status:'a_verifier',page_ids:[base.page.id],started_at:'2026-10-29T12:00:00.000Z',resultat:resultatIndex(base.page.id),model:MODELES_INDEX[0],sources_attendues:sourcesImport.memoireSourcesImport([base.page])};
  await db.put('imports',ligne);return ligne;
}
const snapshot = async db => db.getSnapshot(['recipes','imports','source_pages','source_documents','scan_sessions','files','outbox']);

export async function runL2CorbeilleImportsTests({eq,ok}) {
  const scene=document.createElement('div');document.body.append(scene);
  const run=async(nom,fn)=>{try{await withRepo(fn);}catch(e){ok(false,`L2 imports ${nom} : ${e.stack||e}`);}finally{scene.replaceChildren();document.querySelectorAll('input[type=file]').forEach(n=>n.remove());}};
  try {
    for(const change of [false,true])await run('saisie index '+change,async(repo,db)=>{
      const ed=edition(change?null:'cycle-restaure');await seed(repo,db,ed);const ctx=await getData(true);let message='';
      const root=saisieIndexManuelle(ed,{repo,ctx,toast:s=>{message=s;}});scene.append(root);root.querySelector('textarea').value='Ma soupe — 12';
      if(change)await db.mutate({origin:'remote',puts:{book_editions:[edition('cycle-suivant')]}});
      root.querySelector('[data-role=ajouter-saisie]').click();await attendre(()=>message);
      eq((await repo.all('recipes')).length,change?0:1,`L2 index : ${change?'ancienne saisie refusée après restauration':'nouvelle saisie acceptée après restauration'}`);
      eq(root.querySelector('textarea').value,change?'Ma soupe — 12':'',`L2 index : saisie ${change?'conservée au refus':'vidée après écriture'}`);
    });
    await run('rotation après restauration',async(repo,db)=>{
      const base=await seed(repo,db,edition('cycle-restaure'));const root=await renderImport({}, {session:base.session.id},await getData(true));scene.append(root);
      bouton(root,'↻ Pivoter').click();await new Promise(r=>setTimeout(r,80));
      const seance=await repo.get('scan_sessions',base.session.id),active=await repo.get('source_pages',seance.source_state.active_page_ids[0]);
      eq(active.rotation,90,'L2 sources : nouvelle rotation sur édition restaurée autorisée');
      ok(active.id!==base.page.id,'L5 sources restaurées : rotation dans une nouvelle révision active');
      eq((await repo.get('source_pages',base.page.id)).rotation,0,'L5 sources restaurées : ancienne révision préservée');
    });
    await run('remplacement tardif sans octet orphelin',async(repo,db)=>{
      const base=await seed(repo,db),root=await renderImport({}, {session:base.session.id},await getData(true));scene.append(root);
      const coche=root.querySelector('figure input[type=checkbox]');coche.checked=true;coche.dispatchEvent(new Event('change',{bubbles:true}));
      bouton(root,'Remplacer cette page').click();await attendre(()=>document.querySelector('input[type=file]'));
      await db.mutate({origin:'remote',puts:{book_editions:[edition('cycle-retire','keep_recipes')]}});
      const avant=await snapshot(db),f=await image('nouvelle.jpg'),choix=document.querySelector('input[type=file]');
      Object.defineProperty(choix,'files',{value:[f]});choix.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,100));
      eq(await snapshot(db),avant,'L2 sources : retrait pendant choix du fichier refuse octets, page et document ensemble');
      ok(root.isConnected,'L2 sources : ancien écran conservé après refus de remplacement');
    });
    await run('départ payé depuis ancien livre',async(repo,db)=>{
      const base=await seed(repo,db),ctx=await getData(true),capture=await capturerEdition(repo,base.ed,{ctx});
      ctx.sync={user:{id:'factice'},auth:{jeton:async()=>({access_token:'factice',user:{id:'factice'}})}};
      await db.mutate({origin:'remote',puts:{book_editions:[edition('cycle-suivant')]}});
      let executions=0;
      const avant=await snapshot(db),r=await lancerVol(null,async()=>{executions++;return {resultat:{pages:[]},texteBrut:'réponse',modele:'factice'};},{ctx,repo,enLigne:()=>true,contexteEdition:capture,lecture:{kind:'index',pageIds:[base.page.id],editionId:base.ed.id,sessionId:base.session.id}});
      eq(executions,0,'L2 index : aucun exécutant payé après changement de cycle du livre');
      eq(r.issue,'refuse','L2 index : départ périmé expliqué comme refus');
      eq(await snapshot(db),avant,'L2 index : départ périmé ne crée aucun journal ni envoi');
    });
    for(const changement of ['cycle','page','retrait'])await run('résultat payé '+changement,async(repo,db)=>{
      const base=await seed(repo,db),ctx=await getData(true),capture=await capturerEdition(repo,base.ed,{ctx});
      ctx.sync={user:{id:'factice'},auth:{jeton:async()=>({access_token:'factice',user:{id:'factice'}})}};
      let finir,parti=false,appels=0;const attente=new Promise(r=>{finir=r;});
      const resultat={format:2,pages:[{page_id:base.page.id,etat:'lue',sorte_page:'index',page_imprimee:1,suite_rubrique:false,modele:MODELES_INDEX[0],raison:null,moities:0,entrees:[{titre:'Soupe attendue',renvois:'12',rubrique:null,sorte:'recette',incertain:false}],incertain:[],ecartees:{adresse:0,longueur:0,forme:0}}]};
      const promesse=lancerVol(null,async()=>{appels++;parti=true;await attente;return {resultat,texteBrut:'lecture payée',modele:MODELES_INDEX[0]};},{ctx,repo,enLigne:()=>true,contexteEdition:capture,lecture:{kind:'index',pageIds:[base.page.id],editionId:base.ed.id,sessionId:base.session.id}});
      await attendre(()=>parti);
      await db.mutate({origin:'remote',puts:changement==='cycle'?{book_editions:[edition('cycle-restaure')]}:changement==='retrait'?{book_editions:[edition('cycle-retire','with_recipes')]}:{source_pages:[{...base.page,rotation:90}]}});finir();
      const retour=await promesse,ligne=await repo.get('imports',retour.importId);
      eq([retour.issue,ligne.resultat,appels],['a_verifier',resultat,1],`L2 index : résultat payé conservé après changement de ${changement}`);
      let refuse=false;try{await enregistrerAuto(ligne.id,{repo,ctx:await getData(true),session:base.session});}catch{refuse=true;}
      eq([refuse,(await repo.all('recipes')).length],[true,0],`L2 index : résultat ancien non appliqué après changement de ${changement}`);
      if(changement==='cycle'){
        const frais=await getData(true),nouveau=await capturerEdition(repo,edition('cycle-restaure'),{ctx:frais});
        await sourcesImport.revoirLectureEditionImport(ligne.id,{repo,contexte:nouveau,attendu:ligne});
        eq([(await repo.get('imports',ligne.id)).expected_edition_cycle_id,appels,(await repo.all('recipes')).length],['cycle-restaure',1,0],'L2 index : relecture explicite adopte le cycle sans appel ni recette');
        await enregistrerAuto(ligne.id,{repo,ctx:frais,session:base.session,contexteEdition:nouveau});
        eq((await repo.all('recipes')).map(r=>r.original_title),['Soupe attendue'],'L2 index : résultat payé utilisable après relecture explicite');
      }
    });
    await run('sources du journal mal formées',async(repo,db)=>{
      const base=await seed(repo,db),ligne=await indexLu(repo,db,base);await db.put('imports',{...ligne,sources_attendues:'invalide'});
      const root=panneauIndex(base.session,await getData(true),()=>base.session.page_ids,{repo,seanceIndex:true});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=relecture-index]'));
      eq((await repo.all('recipes')).length,0,'L2 index : sources de journal mal formées visibles sans création ni écran cassé');
    });
    await run('relecture index visible',async(repo,db)=>{
      const base=await seed(repo,db,edition('cycle-restaure'));await indexLu(repo,db,base);
      const ctx=await getData(true),messages=[];const root=panneauIndex(base.session,ctx,()=>base.session.page_ids,{repo,seanceIndex:true,toast:m=>messages.push(m)});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=relecture-index]'));
      eq((await repo.all('recipes')).length,0,'L2 index écran : ancien résultat montré sans application');
      ok(root.querySelector('[data-role=relecture-index]').textContent.includes('Soupe attendue'),'L2 index écran : résultat payé lisible avant adoption');
      eq(bouton(root,'Réutiliser ce résultat après relecture').disabled,false,'L2 index écran : changement de cycle autorise la relecture explicite du journal ancien de ce propriétaire');
      bouton(root,'Réutiliser ce résultat après relecture').click();await attendre(async()=>(await repo.all('recipes')).length===1);
      eq([(await repo.get('imports','index-l2')).expected_edition_cycle_id,(await repo.get('imports','index-l2')).resultat,(await repo.all('imports')).length,messages],['cycle-restaure',resultatIndex(base.page.id),1,[]],'L2 index écran : geste explicite réutilise le résultat exact sans erreur ni nouveau journal');
    });
    await run('relecture classement visible',async(repo,db)=>{
      const base=await seed(repo,db,edition('cycle-restaure')),page2={...base.page,id:'pg2-import-l2',position:2},session={...base.session,page_ids:[base.page.id,page2.id]};
      const resultat={groupes:[{page_ids:session.page_ids,title:'Soupe classée',printed_page:12,uncertain:false}],orphelines:[],non_classees:[],partagees:[],uncertain:[]};
      const ligne={id:'classement-l2',kind:'classement',edition_id:base.ed.id,scan_session_id:session.id,status:'a_verifier',page_ids:session.page_ids,resultat,started_at:'2026-10-29T12:00:00.000Z',device_id:repo.deviceId(),sources_attendues:sourcesImport.memoireSourcesImport([base.page,page2])};
      await db.mutate({origin:'remote',puts:{source_pages:[page2],scan_sessions:[session],imports:[ligne]}});
      const ctx=await getData(true);ctx.sync={user:{id:'factice'},auth:{jeton:async()=>({access_token:'factice',user:{id:'factice'}})}};
      const root=panneauClassement(session,ctx,()=>session.page_ids,{repo,importId:ligne.id,enLigne:()=>true});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=relecture-classement]'));
      eq([root.querySelector('[data-role=lire-recettes]').disabled,root.textContent.includes('Soupe classée')],[true,true],'L2 classement : ancien résultat visible mais départ payé bloqué');
      bouton(root,'Réutiliser ce résultat après relecture').click();await attendre(()=>!root.querySelector('[data-role=relecture-classement]'));
      eq([(await repo.get('imports',ligne.id)).expected_edition_cycle_id,(await repo.get('imports',ligne.id)).resultat,(await repo.all('imports')).length],['cycle-restaure',resultat,1],'L2 classement : relecture explicite conserve résultat et ne crée aucune lecture payée');
    });
    await run('relecture index autre propriétaire',async(repo,db)=>{
      const base=await seed(repo,db,edition('cycle-restaure')),ligne=await indexLu(repo,db,base);
      await db.mutate({origin:'remote',puts:{imports:[{...ligne,owner_id:'autre-proprietaire'}]}});
      const root=panneauIndex(base.session,await getData(true),()=>base.session.page_ids,{repo,seanceIndex:true});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=relecture-index]'));
      eq([bouton(root,'Réutiliser ce résultat après relecture').disabled,(await repo.all('recipes')).length],[true,0],'L2 index écran : relecture explicite ne peut adopter le journal d’un autre propriétaire');
      root.dispose?.();
    });
    await run('relecture index refusée à la transaction',async(repo,db)=>{
      const base=await seed(repo,db,edition('cycle-restaure')),ligne=await indexLu(repo,db,base),messages=[];
      const concurrente={...ligne,resultat:resultatIndex(base.page.id)};concurrente.resultat.pages[0].entrees[0].titre='Autre lecture arrivée';
      const espion={...repo,transitionner:async(store,id,options)=>{await db.mutate({origin:'remote',puts:{imports:[concurrente]}});return repo.transitionner(store,id,options);}};
      const root=panneauIndex(base.session,await getData(true),()=>base.session.page_ids,{repo:espion,seanceIndex:true,toast:m=>messages.push(m)});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=relecture-index]'));const geste=bouton(root,'Réutiliser ce résultat après relecture');geste.click();
      await attendre(()=>messages.length>0);
      eq([geste.disabled,(await repo.all('recipes')).length,(await repo.get('imports',ligne.id)).resultat],[false,0,concurrente.resultat],'L2 index écran : refus concurrent rend le bouton disponible sans appliquer ni écraser la réponse arrivée');
      root.dispose?.();
    });
    for(const changement of ['aucun','parent','compte','fiche'])await run('retrait index '+changement,async(repo,db)=>{
      const base=await seed(repo,db);await indexLu(repo,db,base);await enregistrerAuto('index-l2',{repo,ctx:await getData(true),session:base.session});
      const recette=(await repo.all('recipes'))[0],journal=await repo.get('imports','index-l2'),page=await repo.get('source_pages',base.page.id);
      let confirmer,questions=0,commandes=0;const attente=new Promise(r=>{confirmer=r;}),messages=[];
      const espion={...repo,commanderCycleRecette:async(op,c,o)=>{commandes++;if(changement==='fiche')await db.mutate({origin:'remote',puts:{recipes:[{...await repo.get('recipes',recette.id),favorite:true}]}});return repo.commanderCycleRecette(op,c,o);}};
      const ctx=await getData(true),root=panneauIndex(base.session,ctx,()=>base.session.page_ids,{repo:espion,seanceIndex:true,confirmer:()=>{questions++;return attente;},toast:m=>messages.push(m)});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=retirer]'));const retirer=root.querySelector('[data-role=retirer]');retirer.click();retirer.click();
      eq(questions,1,`L2 index retrait ${changement} : double clic ouvre une seule confirmation`);
      if(changement==='parent')await db.mutate({origin:'remote',puts:{book_editions:[edition('cycle-nouveau')]}});
      if(changement==='compte')await db.put('sync_state',{key:'user_id',value:'autre'});
      confirmer(true);await attendre(()=>messages.length>0);const apres=await repo.get('recipes',recette.id);
      eq([!!apres.trashed_at,commandes],changement==='aucun'?[true,1]:[false,1],`L2 index retrait ${changement} : seul le contexte affiché est retiré`);
      eq([await repo.get('imports','index-l2'),await repo.get('source_pages',base.page.id)],[journal,page],`L2 index retrait ${changement} : journal et source intégralement conservés`);
      if(changement==='aucun'){
        await restaurerRecette(apres,{repo,edition:base.ed});const restauree=await repo.get('recipes',recette.id);
        eq([restauree.original_title,!!restauree.trashed_at,restauree.index_import_id],[recette.original_title,false,'index-l2'],'L2 index retrait : restauration conserve référence et provenance');
      }
      if(changement==='fiche')eq(apres.favorite,true,'L2 index retrait : modification concurrente préservée');
    });
    await run('retrait partiel annoncé',async(repo,db)=>{
      const base=await seed(repo,db),ligne=await indexLu(repo,db,base);ligne.resultat.pages[0].entrees.push({titre:'Tarte attendue',renvois:'15',rubrique:null,sorte:'recette',incertain:false});await db.put('imports',ligne);
      await enregistrerAuto(ligne.id,{repo,ctx:await getData(true),session:base.session});
      const messages=[];let commandes=0;
      const espion={...repo,commanderCycleRecette:async(op,c,o)=>{if(++commandes===2)await db.mutate({origin:'remote',puts:{book_editions:[edition('cycle-nouveau')]}});return repo.commanderCycleRecette(op,c,o);}};
      const root=panneauIndex(base.session,await getData(true),()=>base.session.page_ids,{repo:espion,seanceIndex:true,confirmer:async()=>true,toast:m=>messages.push(m)});scene.append(root);
      await attendre(()=>root.querySelector('[data-role=retirer]'));root.querySelector('[data-role=retirer]').click();await attendre(()=>messages.some(m=>m.includes('Les autres')));
      eq([(await repo.all('recipes')).filter(r=>r.trashed_at).length,messages],[1,['1 sur 2 recettes retirées. Les autres sont restées.']],'L2 index : refus partiel dit dans un message unique avec le compte réel');
    });
    await run('relecture et journal concurrent',async(repo,db)=>{
      const base=await seed(repo,db,edition('cycle-restaure')),ctx=await getData(true),capture=await capturerEdition(repo,base.ed,{ctx});
      const ligne={id:'index-ancien',kind:'index',edition_id:base.ed.id,expected_edition_cycle_id:null,status:'a_verifier',page_ids:[base.page.id],resultat:{format:2,pages:[]},sources_attendues:sourcesImport.memoireSourcesImport([base.page])};
      await db.put('imports',ligne);const autre={...ligne,resultat:{format:2,pages:[{titre:'autre'}]}};await db.put('imports',autre);
      let refuse=false;try{await sourcesImport.revoirLectureEditionImport(ligne.id,{repo,contexte:capture,attendu:ligne});}catch{refuse=true;}
      eq([refuse,await repo.get('imports',ligne.id)],[true,autre],'L2 relecture : autre résultat arrivé depuis affichage conservé sans adoption');
    });
  } finally {scene.remove();}
}
