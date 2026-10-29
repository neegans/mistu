import { withRepo } from './sync-fixture.js';
import * as P from '../src/domain/thermomix-parcours.js';
import { renderThermomixRoute, texteErreurThermomix } from '../src/ui/thermomix.js';
import { lignesImports } from '../src/domain/import-cible.js';
const SESSION={access_token:'fixture',user:{id:'fixture-user'}};
const options=repo=>({repo,config:{url:'https://assistant.example',anonKey:'publique-factice'},enLigne:()=>true});
const response=q=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify({type:'questions',questions:q})}],stop_reason:'end_turn',model:'fixture'}));
const plan=()=>({type:'proposition',blocs:[{source_step_id:'s1',raison:'Mélanger dans le bol.',actions:[{type:'preparation',operation:'ajouter',ingredients:['i1'],contenant:'bol'},{type:'reglage',mode:'manuel',secondes:10,temperature:null,vitesse:1,sens:'normal',accessoire:'couteau',ingredients:['i1']}]}]});
const entree={recipeId:'r-brouillon',versionId:'v-brouillon',selection:['s1'],precisions:{eau_vapeur_g:700}};
async function seed(repo){await repo.saveBatch({recipes:[{id:entree.recipeId,original_title:'Tomates',availability:'available',current_version_id:entree.versionId}],recipe_versions:[{id:entree.versionId,recipe_id:entree.recipeId,kind:'extraction',status:'proposed',ingredients:[{id:'i-source',source_text:'200 g de tomates',name_text:'tomates',quantity:{value:200},unit_id:'g'}],steps:[{id:'s1',text:'Mélanger les tomates.'}],provenance:{}}]},{conditions:{recipes:[{key:entree.recipeId,absente:true}]}});}
const later=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(v)=>resolve(v)};};
export async function runCorrectifsBrouillonsTests({eq,ok}){
 const run=async(n,fn)=>{try{await withRepo(fn);}catch(e){ok(false,`${n} : ${e.code||e.stack||e.message}`);}};
 const refuse=async(fn,code,n)=>{try{await fn();ok(false,n);}catch(e){eq(e.code,code,n);}};
 await run('Autre appareil et réinstallation',async(repo)=>{
  await seed(repo);let row=await P.ouvrirThermomix(entree,options(repo));
  row={...await repo.get('imports',row.id),device_id:'ancien-appareil',status:'a_verifier',resultat:{type:'questions',questions:['Le bol est-il froid ?']},reponse_brute:'copie payée',contexte:{invalide:true}};await repo.save('imports',row);row=await repo.get('imports',row.id);
  const fini=await P.ignorerThermomix(row.id,{...options(repo),attendu:row});
  eq([fini.status,fini.resultat,fini.reponse_brute],['ignore',row.resultat,'copie payée'],'Ancien brouillon illisible abandonné sans perte de copie');
  eq((await repo.all('recipe_versions')).length,1,'Abandon ne change aucune version');
 });
 await run('Abandon en cours et réponse tardive',async(repo)=>{
  await seed(repo);const parti=later(),fin=later();let appels=0;
  const deps={...options(repo),fetch:async()=>{appels++;parti.resolve();await fin.promise;return response(['Le bol est-il froid ?']);}};
  const row=await P.ouvrirThermomix(entree,deps);const pending=P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);await parti.promise;
  await refuse(()=>P.proposerThermomix({importId:row.id,session:SESSION,documentId:'autre'},deps),'appel_en_cours','Pas de second appel en cours');
  let abandon;try{abandon=await P.ignorerThermomix(row.id,{...deps,attendu:await repo.get('imports',row.id)});}finally{fin.resolve();await pending;}
  eq([abandon.status,abandon.tentative_id],['ignore',null],'Abandon explicite invalide la tentative');
  eq([(await repo.get('imports',row.id)).status,appels],['ignore',1],'Réponse tardive sans résurrection ni relance');
 });
 await run('CAS journal contradictoire',async(repo)=>{
  await seed(repo);const row=await P.ouvrirThermomix(entree,options(repo)),attendu=await repo.get('imports',row.id);
  await repo.save('imports',{...attendu,revision_brouillon:17,demande:'ailleurs'});
  await refuse(()=>P.ignorerThermomix(row.id,{...options(repo),attendu}),'reprise_modifiee','Journal changé depuis affichage refusé');
  eq((await repo.get('imports',row.id)).status,'a_lancer','Contradiction ne clôture pas le journal');
 });
 await run('Compte changé dans transaction',async(repo,db)=>{
  await seed(repo);const row=await P.ouvrirThermomix(entree,options(repo));const contexteRecette=await repo.capturerContexteRecette(await repo.get('recipes',entree.recipeId));
  const autre={...repo,saveBatch:async(...args)=>{await db.put('sync_state',{key:'user_id',value:'autre-compte'});return repo.saveBatch(...args);}};
  await refuse(()=>P.ignorerThermomix(row.id,{repo:autre,contexteRecette,attendu:row}),'compte_change','Compte changé après confirmation refusé atomiquement');
  eq((await repo.get('imports',row.id)).status,'a_lancer','Compte changé laisse journal intact');
 });
 await run('Deux tours de questions',async(repo)=>{
  await seed(repo);let n=0;const deps={...options(repo),fetch:async()=>response([++n===1?'Le bol est-il froid ?':'Le panier est-il installé ?'])};
  let row=await P.ouvrirThermomix(entree,deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);const ancienTour=row.questions_tour_id;
  row=await P.modifierThermomix(row.id,{precisions:{...row.contexte.precisions,reponses:['Oui, très froid.']}},{...deps,questionsAttendues:ancienTour});
  row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);
  eq(row.contexte.precisions.reponses,[],'Nouveau tour sans réponse du précédent');
  eq(row.contexte.precisions.eau_vapeur_g,700,'Précision indépendante conservée');
  ok(!!row.questions_tour_id&&row.questions_tour_id!==ancienTour,'Deux tours ont des identités différentes');
  await refuse(()=>P.modifierThermomix(row.id,{precisions:{...row.contexte.precisions,reponses:['Oui']}},{...deps,questionsAttendues:ancienTour}),'questions_modifiees','Réponse périmée refusée');
 });
 await run('Question remplacée pendant sauvegarde',async(repo,db)=>{
  await seed(repo);const deps={...options(repo),fetch:async()=>response(['Le bol est-il froid ?'])};let row=await P.ouvrirThermomix(entree,deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);
  const concurrent={...repo,transitionner:async(...args)=>{await db.put('imports',{...await repo.get('imports',row.id),questions_tour_id:'autre-tour'});return repo.transitionner(...args);}};
  await refuse(()=>P.modifierThermomix(row.id,{precisions:{...row.contexte.precisions,reponses:['Oui']}},{repo:concurrent,questionsAttendues:row.questions_tour_id}),'brouillon_modifie','CAS lie réponse au tour exact dans transaction');
  eq((await repo.get('imports',row.id)).contexte.precisions.reponses,[],'Réponse ancienne ne rejoint pas question concurrente');
 });
 await run('UI brouillon illisible autre appareil',async(repo)=>{
  await seed(repo);const row=await P.ouvrirThermomix(entree,options(repo));await repo.save('imports',{...await repo.get('imports',row.id),device_id:'desinstalle',contexte:{...row.contexte,precisions:{...row.contexte.precisions,eau_vapeur_g:10000}}});
  let consent=false,confirmations=0;const vue=await renderThermomixRoute({id:entree.recipeId},{import:row.id},{},{...options(repo),sessionAssistant:()=>null,confirmer:async()=>{confirmations++;return consent;}});document.body.append(vue);
  try{const b=vue.querySelector('[data-role=ignorer-tm7]');ok(b&&!b.disabled,'Brouillon illisible : abandon accessible');if(b){b.click();await vue.attendreEcritures();eq((await repo.get('imports',row.id)).status,'a_lancer','Confirmation refusée sans écriture');consent=true;b.click();await vue.attendreEcritures();eq([(await repo.get('imports',row.id)).status,confirmations],['ignore',2],'Abandon confirmé depuis écran illisible');}}finally{vue.dispose?.();vue.remove();}
 });
 await run('UI eau et journal',async(repo)=>{
  await seed(repo);const row=await P.ouvrirThermomix(entree,options(repo));const vue=await renderThermomixRoute({id:entree.recipeId},{import:row.id},{},{...options(repo),sessionAssistant:()=>null});document.body.append(vue);
  try{eq(vue.querySelector('[name=eau_vapeur_g]').max,'2200','Eau vapeur bornée dans le champ');ok(vue.textContent.includes('distincte des ingrédients'),'Eau de service explicitement distincte');}finally{vue.dispose();vue.remove();}
  const model=lignesImports({imports:[{...row,status:'en_cours',device_id:'autre'}],recipesById:new Map([[entree.recipeId,await repo.get('recipes',entree.recipeId)]])},{deviceId:repo.deviceId(),documentId:'doc',maintenant:new Date().toISOString()});
  ok(model[0]?.gestes.includes('ignorer'),'Ajouter expose Ignorer pour proposition en cours ailleurs');
 });
 await run('Résultat payé conservé pendant correction et panne',async(repo)=>{
  await seed(repo);let appels=0;const deps={...options(repo),fetch:async()=>{if(++appels===1)return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(plan())}],stop_reason:'end_turn'}));throw Error('réseau');}};
  let row=await P.ouvrirThermomix(entree,deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);const resultat=row.resultat;
  row=await P.modifierThermomix(row.id,{demande:'Réviser la proposition'},deps);
  eq(row.proposition_precedente?.resultat,resultat,'Résultat payé conservé dès la première saisie');
  row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);
  eq([row.status,row.proposition_precedente?.resultat],['echec',resultat],'Panne conserve la proposition précédente');
  await refuse(()=>P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps),'proposition_precedente','Pas de troisième appel sans choix explicite');
  eq(appels,2,'Blocage précédent sans appel supplémentaire');
  row=await P.reprendrePropositionThermomix(row.id,{...deps,attendu:row});
  eq([row.status,row.resultat,row.proposition_precedente],['a_verifier',resultat,null],'Reprise explicite du résultat payé sans appel');
  eq(appels,2,'Reprise locale ne consomme pas un appel');
 });
 await run('Slot précédent ne contourne pas source et cycle',async(repo,db)=>{
  await seed(repo);const deps={...options(repo),fetch:async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(plan())}],stop_reason:'end_turn'}))};let row=await P.ouvrirThermomix(entree,deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);row=await P.modifierThermomix(row.id,{demande:'Révision'},deps);
  const source=await repo.get('recipe_versions',entree.versionId);await db.put('recipe_versions',{...source,servings:7});
  await refuse(()=>P.reprendrePropositionThermomix(row.id,{...deps,attendu:row}),'source_modifiee','Ancien résultat non adopté sur source modifiée');
  ok(!!(await repo.get('imports',row.id)).proposition_precedente,'Résultat conservé malgré refus de reprise');
 });
 await run('Deux propositions payées sans écrasement',async(repo)=>{
  await seed(repo);let n=0;const deps={...options(repo),fetch:async()=>{const p=plan();p.blocs[0].actions[1].secondes=++n===1?10:20;return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(p)}],stop_reason:'end_turn'}));}};
  let row=await P.ouvrirThermomix(entree,deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);const a=row.resultat;
  row=await P.modifierThermomix(row.id,{demande:'Deuxième proposition'},deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);const b=row.resultat;
  await refuse(()=>P.modifierThermomix(row.id,{demande:'Troisième'},deps),'proposition_precedente','Saisie ne détruit pas deuxième proposition quand slot occupé');
  row=await P.reprendrePropositionThermomix(row.id,{...deps,attendu:row});eq([row.resultat,row.proposition_precedente.resultat],[a,b],'Reprise échange A et B sans perdre un résultat payé');
  const stale=row;row=await P.ignorerPropositionPrecedenteThermomix(row.id,{...deps,attendu:row});eq([row.resultat,row.proposition_precedente],[a,null],'Écarter précédent garde résultat courant');
  await refuse(()=>P.reprendrePropositionThermomix(row.id,{...deps,attendu:stale}),'proposition_precedente','Ancien écran ne ressuscite pas le slot écarté');
 });
 await run('UI résultat précédent sans nouvel appel',async(repo)=>{
  await seed(repo);let appels=0;const deps={...options(repo),fetch:async()=>{if(++appels===1)return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(plan())}],stop_reason:'end_turn'}));throw Error('réseau');},sessionAssistant:()=>SESSION,remplacerAdresse:()=>{},confirmer:async()=>true};
  const row=await P.ouvrirThermomix(entree,deps),vue=await renderThermomixRoute({id:entree.recipeId},{import:row.id},{},deps);document.body.append(vue);
  try{vue.querySelector('[data-role=proposer-tm7]').click();await vue.attendreEcritures();const d=vue.querySelector('[name=demande]');d.value='Revoir le mélange';d.dispatchEvent(new Event('input',{bubbles:true}));await vue.attendreEcritures();ok(!!vue.querySelector('[data-role=reprendre-resultat-tm7]'),'Résultat précédent consultable dès correction');vue.querySelector('[data-role=proposer-tm7]').click();await vue.attendreEcritures();ok(vue.querySelector('[data-role=proposer-tm7]').disabled,'Après panne choix explicite avant autre appel');const b=vue.querySelector('[data-role=reprendre-resultat-tm7]');if(b){b.click();await vue.attendreEcritures();eq([appels,vue.querySelector('[name=relecture]')?.checked],[2,false],'Reprise sans nouvel appel ni relecture cochée');}else ok(false,'Reprise précédente visible après panne');}finally{vue.dispose();vue.remove();}
 });
 await run('Panneau ancien compte sans owner historique',async(repo,db)=>{
  await seed(repo);let row=await P.ouvrirThermomix(entree,options(repo));row=await repo.get('imports',row.id);delete row.owner_id;await db.put('imports',row);
  const {panneauAbandonProposition}=await import('../src/ui/reprise-import.js');const panneau=panneauAbandonProposition(row,{repo,confirmer:async()=>true});document.body.append(panneau);
  await db.put('sync_state',{key:'user_id',value:'nouveau'});panneau.querySelector('button').click();await panneau.attendreEcritures();
  eq((await repo.get('imports',row.id)).status,'a_lancer','Ancien écran ne capture pas silencieusement le nouveau propriétaire');panneau.remove();
 });
 await run('Abandon depuis écran qui appelle',async(repo)=>{
  await seed(repo);const parti=later(),fin=later(),tente=later();let appels=0;
  const deps={...options(repo),fetch:async()=>{appels++;parti.resolve();await fin.promise;return response(['Le bol est-il froid ?']);},sessionAssistant:()=>SESSION,remplacerAdresse:()=>{},confirmer:async()=>true,
    parcours:{...P,ignorerThermomix:async(...args)=>{try{return await P.ignorerThermomix(...args);}finally{tente.resolve();}}}};
  const row=await P.ouvrirThermomix(entree,deps),vue=await renderThermomixRoute({id:entree.recipeId},{import:row.id},{},deps);document.body.append(vue);
  try{vue.querySelector('[data-role=proposer-tm7]').click();await parti.promise;const b=vue.querySelector('[data-role=ignorer-tm7]');ok(!b.disabled,'Écran en appel permet abandon explicite');b.click();await tente.promise;fin.resolve();await vue.attendreEcritures();eq([(await repo.get('imports',row.id)).status,appels],['ignore',1],'Écran clôture son appel actif sans réponse tardive');}finally{fin.resolve();vue.dispose();vue.remove();}
 });
 await run('Erreur tardive après changement de propriétaire',async(repo,db)=>{
  await seed(repo);const parti=later(),fin=later();const deps={...options(repo),fetch:async()=>{parti.resolve();await fin.promise;throw Error('connexion coupée');}};
  const row=await P.ouvrirThermomix(entree,deps),pending=P.proposerThermomix({importId:row.id,session:SESSION,documentId:'doc'},deps);await parti.promise;
  const avant=await repo.get('imports',row.id);await db.put('sync_state',{key:'user_id',value:'autre-compte'});fin.resolve();await pending.catch(()=>{});
  eq(await repo.get('imports',row.id),avant,'Panne tardive ne modifie pas les données liées à un autre compte');
 });
 await run('Cycle changé pendant confirmation',async(repo,db)=>{
  await seed(repo);const row=await P.ouvrirThermomix(entree,options(repo)),recipe=await repo.get('recipes',entree.recipeId),contexteRecette=await repo.capturerContexteRecette(recipe);
  const concurrent={...repo,saveBatch:async(...args)=>{await db.put('recipes',{...recipe,lifecycle_id:'restore-2',trashed_at:null});return repo.saveBatch(...args);}};
  await refuse(()=>P.ignorerThermomix(row.id,{repo:concurrent,contexteRecette,attendu:row}),'cycle_change','Cycle changé avant clôture refusé');
  eq((await repo.get('imports',row.id)).status,'a_lancer','Cycle changé conserve le brouillon');
  await P.ignorerThermomix(row.id,{repo,attendu:row});eq((await repo.get('imports',row.id)).status,'ignore','Nouvelle confirmation peut abandonner le journal ancien cycle');
 });
 await run('Questions UI et JSON enveloppé',async(repo)=>{
  await seed(repo);let n=0;const deps={...options(repo),fetch:async()=>new Response(JSON.stringify({content:[{type:'text',text:'```json\n'+JSON.stringify({type:'questions',questions:[++n===1?'Le bol est-il froid ?':'Le bol est-il froid ?']})+'\n```'}],stop_reason:'end_turn'})),sessionAssistant:()=>SESSION,remplacerAdresse:()=>{}};
  const row=await P.ouvrirThermomix(entree,deps),vue=await renderThermomixRoute({id:entree.recipeId},{import:row.id},{},deps);document.body.append(vue);
  try{vue.querySelector('[data-role=proposer-tm7]').click();await vue.attendreEcritures();const a=vue.querySelector('[name=reponse-0]');ok(!!a,'Objet JSON clôturé lisible sur vrai écran');if(a){a.value='Oui';a.dispatchEvent(new Event('input',{bubbles:true}));await vue.attendreEcritures();vue.querySelector('[data-role=proposer-tm7]').click();await vue.attendreEcritures();eq(vue.querySelector('[name=reponse-0]').value,'','Même texte nouveau tour sans ancienne réponse');eq(vue.querySelector('[name=eau_vapeur_g]').value,'700','Eau indépendante reste affichée');eq(n,2,'Deux clics explicites produisent deux appels seulement');}}finally{vue.dispose();vue.remove();}
 });
 await run('Entrées Ajouter et import ciblé',async(repo)=>{
  await seed(repo);let row=await P.ouvrirThermomix(entree,options(repo));await repo.save('imports',{...await repo.get('imports',row.id),device_id:'autre',status:'en_cours'});row=await repo.get('imports',row.id);
  const recipe=await repo.get('recipes',entree.recipeId),ctx={imports:[row],scan_sessions:[],recipesById:new Map([[recipe.id,recipe]]),book_editions:[],booksById:new Map()};
  const {renderImportCible}=await import('../src/ui/import-cible.js');
  const cible=await renderImportCible({id:recipe.id},{},ctx,{repo,navigate:()=>{},toast:()=>{},confirmer:async()=>false});document.body.append(cible);
  try{ok(!!cible.querySelector('[data-role=ignorer-proposition]'),'Import ciblé montre le brouillon qui bloque');ok(cible.querySelector('a[href*=thermomix]'),'Import ciblé propose la reprise précise');}finally{cible.remove();}
  const {renderAdd}=await import('../src/ui/add.js');const vue=await renderAdd({}, {},ctx,{repo,navigate:()=>{},toast:()=>{},confirmer:async()=>true,veilleMs:1});document.body.append(vue);
  try{const b=vue.querySelector('[data-geste=ignorer]');ok(!!b,'Ajouter offre Ignorer');b?.click();await vue.attendreEcritures?.();eq((await repo.get('imports',row.id)).status,'ignore','Ajouter clôture une proposition en cours sur ancien appareil');}finally{vue.remove();}
 });
 for(const moment of ['avant-clic','transaction']) await run('Garder ne valide que la proposition affichée '+moment,async(repo,db)=>{
  await seed(repo);let appels=0;
  const deps={...options(repo),fetch:async()=>{const p=plan();p.blocs[0].actions[1].secondes=++appels===1?10:20;return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(p)}],stop_reason:'end_turn'}));},sessionAssistant:()=>SESSION,remplacerAdresse:()=>{},navigate:()=>{},toast:()=>{}};
  let row=await P.ouvrirThermomix(entree,deps);row=await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'premier'},deps);
  const affichee=structuredClone(row),vue=await renderThermomixRoute({id:entree.recipeId},{import:row.id},{},deps);document.body.append(vue);
  try{
   for(const nom of ['relecture','montage']){const c=vue.querySelector('[name='+nom+']');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));}
   if(moment==='avant-clic'){
    await P.modifierThermomix(row.id,{demande:'Nouvelle proposition dans un autre onglet'},deps);
    await P.proposerThermomix({importId:row.id,session:SESSION,documentId:'second'},deps);
    vue.querySelector('[data-role=garder-tm7]').click();await vue.attendreEcritures();
    ok(vue.querySelector('[data-role=etat-tm7]').textContent.includes('proposition a changé'),'Garder périmé explique la nouvelle relecture nécessaire');
   }else{
    const concurrent={...repo,transitionner:async(...args)=>{const suivante=structuredClone(affichee);suivante.resultat.blocs[0].actions[1].secondes=20;await db.put('imports',suivante,{origin:'remote'});return repo.transitionner(...args);}};
    let refuse=false;try{await P.garderThermomix({importId:row.id,relu:true,attendu:affichee},{...deps,repo:concurrent});}catch{refuse=true;}
    ok(refuse,'Garder refuse le changement du résultat dans la transaction');
   }
   eq((await repo.all('recipe_versions')).length,1,'Garder périmé ne crée aucune adaptation');
   eq((await repo.get('imports',row.id)).status,'a_verifier','Garder périmé conserve la proposition concurrente à relire');
   ok(vue.querySelector('[data-role=proposition-tm7]').textContent.includes('10 s /'),'Proposition affichée conservée sans remplacement silencieux');
  }finally{vue.dispose();vue.remove();}
 });
 const reseau=texteErreurThermomix({raison:'reseau'}),serveur=texteErreurThermomix({raison:'serveur'}),delai=texteErreurThermomix({raison:'delai'});
 ok(reseau!==serveur&&serveur!==delai,'Réseau, serveur et délai distingués');
 ok(![reseau,serveur,delai].some(s=>s.includes('Vérifie la sélection')),'Panne sans conseil erroné de changer la sélection');
}
