import {withRepo} from './sync-fixture.js';
import {renderTraductionEditeur} from '../src/ui/traduction-editeur.js';
import {creerDepotTraductions} from '../src/domain/depot-traductions.js';
import {getData,getSyncGeneration,SYNC_ROUTE_KEY} from '../src/ui/state.js';
import {preparerLectureRecette,projeterLectureRecette} from '../src/domain/lecture-recette.js';

const attendre=async fn=>{for(let i=0;i<300;i++){if(await fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Parcours guidé : état attendu absent');};
const requete={kind:'translation',format:'2',locale:'fr',assistant:'1'};
const bouton=(node,role)=>node.querySelector(`[data-role="${role}"]`);
const reponse=p=>{const text=JSON.stringify({format:1,segments:p.segments.map(s=>({ref:s.ref,text:'Traduction : '+s.text}))});return{text,stopReason:'end_turn',model:null,raison:null,reponseBrute:new TextEncoder().encode(JSON.stringify({content:[{type:'text',text}]}))};};
async function fixture(repo,db,n=1){
 const recipe={id:'guide-r',original_title:'Bread',original_language:'en',availability:'available',current_version_id:'guide-v'},version={id:'guide-v',recipe_id:recipe.id,servings:2,ingredients:Array.from({length:n},(_,i)=>({id:'guide-i'+i,name_text:'flour',source_text:'200 g flour',quantity:{value:200,raw:'200'},unit_id:'g'})),steps:[{id:'guide-s',text:'Do not cover.\nBake for 20 min.',timers:[{label:'Bake',seconds:1200}]}]};
 await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],sync_state:[{key:'user_id',value:'guide-user'}]}});
 const appels=[];let produire=reponse;const provider={configured:true,completeTranslation:async({messages})=>{const p=JSON.parse(messages[0].content);appels.push(p);return produire(p);}};
 let destination=null;const deps={provider,confirmer:async()=>true,naviguer:x=>destination=x};
 return{recipe,version,appels,deps,produire:f=>produire=f,destination:()=>destination,async ouvrir(extra={},autres={}){const node=await renderTraductionEditeur({id:recipe.id},{...requete,v:version.id,...extra},await getData(true),{...deps,...autres});document.body.append(node);return node;}};
}
export async function runTraductionGuideeTests({eq,ok}){
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db,13),avant=JSON.stringify(await repo.get('recipe_versions',f.version.id));let node=await f.ouvrir();
  try{
   const lancer=bouton(node,'lancer-traduction');ok(!!lancer,'Traduction guidée : lancement et coût préparés dès l’ouverture');if(!lancer)return;
   eq(f.appels.length,0,'Traduction guidée : ouvrir et préparer ne paient rien');ok(node.textContent.includes('2 appels'),'Traduction guidée : coût réel de deux portions annoncé');
   const details=bouton(node,'corrections-traduction');ok(details?.tagName==='DETAILS'&&!details.open,'Traduction guidée : corrections manuelles repliées');
   ok(bouton(node,'enregistrer-version-francaise')?.disabled,'Traduction guidée : enregistrement complet indisponible avant résultat');
   lancer.click();lancer.click();await attendre(()=>f.appels.length===2&&bouton(node,'enregistrer-version-francaise')?.disabled===false);
   eq(f.appels.length,2,'Traduction guidée : double clic ne double pas les portions');eq((await repo.all('recipe_translations')).length,0,'Traduction guidée : réception seule ne publie rien');
   ok(bouton(node,'apercu-traduction-guidee').textContent.includes('Traduction :'),'Traduction guidée : aperçu français proposé en lecture');
   eq(bouton(node,'apercu-traduction-guidee').querySelectorAll('ul li').length,13,'Traduction guidée : aperçu contient une ligne par ingrédient sans doubler sa source');ok(bouton(node,'apercu-traduction-guidee').querySelector('ul li').textContent.includes('200 g'),'Traduction guidée : aperçu garde les quantités source');
   bouton(node,'enregistrer-version-francaise').click();await attendre(()=>f.destination());
   const trs=await repo.all('recipe_translations'),tr=trs[0];eq(trs.length,1,'Traduction guidée : un geste final publie une traduction');
   eq(tr.translated_content.segments.filter(s=>s.text!==null).length,28,'Traduction guidée : deux journaux adoptés sans perdre leurs segments');
   eq(tr.translated_content.segments.filter(s=>s.origin==='ai').length,28,'Traduction guidée : provenance assistant conservée pour toutes les portions');
   eq(new Set(tr.translated_content.segments.map(s=>s.journal_id)).size,2,'Traduction guidée : provenance précise des deux journaux');
   ok(f.destination().includes('lang=fr')&&f.destination().includes('translation='+tr.id)&&f.destination().includes('v='+f.version.id),'Traduction guidée : retour vise la version française exacte');
   eq(JSON.stringify(await repo.get('recipe_versions',f.version.id)),avant,'Traduction guidée : quantités, étapes et minuteurs originaux inchangés');eq((await repo.all('recipe_versions')).length,1,'Traduction guidée : aucune version culinaire dupliquée');
   eq((await repo.get('recipes',f.recipe.id)).original_title,'Bread','Traduction guidée : titre original intact');
   eq((await repo.all('imports')).filter(x=>x.kind==='traduction').map(x=>x.status),['enregistre','enregistre'],'Traduction guidée : journaux clôturés par la publication');
   node.dispose();node.remove();node=null;const ctx=await getData(true),lecture=await preparerLectureRecette({recipe:ctx.recipesById.get(f.recipe.id),version:ctx.versionsById.get(f.version.id),traductions:ctx.recipe_translations}),projection=projeterLectureRecette(lecture,{locale:'fr',translationId:tr.id});
   eq([projection.etat,projection.manque],['courante',false],'Traduction guidée : lecture reconstruite complète après fermeture');ok(projection.etapes[0].texte.includes('20 min.')&&projection.etapes[0].texte.includes('\n'),'Traduction guidée : nombres et paragraphes exacts après publication');eq(f.appels.length,2,'Traduction guidée : publication et relecture sans nouvel appel');
  }finally{node?.dispose();node?.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);let node=await f.ouvrir();try{
   const lancer=bouton(node,'lancer-traduction');ok(!!lancer,'Traduction guidée reprise : lancement direct disponible');if(!lancer)return;lancer.click();await attendre(()=>bouton(node,'enregistrer-version-francaise')?.disabled===false);eq(f.appels.length,1,'Traduction guidée reprise : réponse payée une fois');
   node.dispose();node.remove();node=await f.ouvrir();eq(f.appels.length,1,'Traduction guidée reprise : recharger ne relance pas');ok(!bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée reprise : réponses durables retrouvées');ok(!bouton(node,'lancer-traduction'),'Traduction guidée reprise : aucun nouvel appel proposé pour les passages reçus');
   bouton(node,'enregistrer-version-francaise').click();await attendre(()=>f.destination());eq((await repo.all('recipe_translations')).length,1,'Traduction guidée reprise : résultat retrouvé publiable en un geste');eq(f.appels.length,1,'Traduction guidée reprise : aucune portion payée deux fois');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);let manque=null;f.produire(p=>{manque=p.segments.at(-1).ref;const r=reponse(p),body=JSON.parse(r.text);body.segments.at(-1).text=null;return{...r,text:JSON.stringify(body)};});const node=await f.ouvrir();try{
   const lancer=bouton(node,'lancer-traduction');ok(!!lancer,'Traduction guidée manque : lancement direct disponible');if(!lancer)return;lancer.click();await attendre(()=>f.appels.length===1&&node.textContent.includes('1 passage reste à traduire'));
   ok(bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée manque : résultat partiel ne devient pas version complète');eq((await repo.all('recipe_translations')).length,0,'Traduction guidée manque : aucune publication partielle implicite');
   await attendre(()=>bouton(node,'lancer-traduction')&&!bouton(node,'lancer-traduction').disabled);f.produire(reponse);bouton(node,'lancer-traduction').click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);
   eq(f.appels[1].segments.map(s=>s.ref),[manque],'Traduction guidée manque : reprise paie seulement le passage manquant');bouton(node,'enregistrer-version-francaise').click();await attendre(()=>f.destination());eq(f.appels.length,2,'Traduction guidée manque : aucune relance automatique');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db),node=await f.ouvrir();try{
   const lancer=bouton(node,'lancer-traduction');ok(!!lancer,'Traduction guidée correction : lancement direct disponible');if(!lancer)return;lancer.click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);
   const titre=node.querySelector('[data-role=traduction-segment]');titre.value='Mon pain';titre.dispatchEvent(new Event('input',{bubbles:true}));await node.flushEditeur();bouton(node,'enregistrer-version-francaise').click();await attendre(()=>f.destination());const tr=(await repo.all('recipe_translations'))[0];eq([tr.translated_content.segments[0].text,tr.translated_content.segments[0].origin],['Mon pain','manual'],'Traduction guidée correction : saisie personnelle prime sur réponse reçue');eq(f.appels.length,1,'Traduction guidée correction : corriger et garder ne rappellent pas');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db),node=await f.ouvrir();try{
   const lancer=bouton(node,'lancer-traduction');ok(!!lancer,'Traduction guidée conflit : lancement direct disponible');if(!lancer)return;lancer.click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);
   await db.mutate({origin:'remote',puts:{recipe_versions:[{...f.version,notes:'Changed source'}]}});bouton(node,'enregistrer-version-francaise').click();await attendre(()=>node.textContent.includes('Le contenu a changé ailleurs'));
   eq((await repo.all('recipe_translations')).length,0,'Traduction guidée conflit : source changée refuse publication');eq((await repo.all('imports')).filter(x=>x.kind==='traduction')[0]?.status,'a_verifier','Traduction guidée conflit : réponse durable conservée');eq(f.appels.length,1,'Traduction guidée conflit : aucune réparation payante implicite');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db),depot=creerDepotTraductions({repo,getGeneration:getSyncGeneration});let tentatives=0;const conserver=depot.conserverReponseTraduction;depot.conserverReponseTraduction=async args=>++tentatives===1?{issue:'echec',raison:'quota_stockage'}:conserver(args);const node=await f.ouvrir({}, {depot});try{
   const lancer=bouton(node,'lancer-traduction');ok(!!lancer,'Traduction guidée quota : lancement direct disponible');if(!lancer)return;lancer.click();await attendre(()=>node.textContent.includes('La réponse est reçue, mais sa conservation a échoué'));
   ok(bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée quota : réponse non durable non publiable');[...node.querySelectorAll('button')].find(b=>b.textContent==='Réessayer de conserver la réponse').click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);eq([f.appels.length,tentatives],[1,2],'Traduction guidée quota : réessai conserve la même réponse sans payer');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);let node=await f.ouvrir();try{
   bouton(node,'lancer-traduction').click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);bouton(node,'enregistrer-version-francaise').click();await attendre(()=>f.destination());node.dispose();node.remove();
   await db.mutate({origin:'remote',puts:{recipe_versions:[{...f.version,steps:[{...f.version.steps[0],text:'Do not cover.\nBake for 30 min.'}]}]}});node=await f.ouvrir();
   ok(node.textContent.includes('La source de cette traduction a changé'),'Traduction guidée périmée : source modifiée expliquée');ok(!bouton(node,'lancer-traduction'),'Traduction guidée périmée : aucun appel sans comparaison');
   const brouillon=await node.flushEditeur();node.dispose();node.remove();node=await f.ouvrir({draft:brouillon.id});[...node.querySelectorAll('button')].find(b=>b.textContent==='Reprendre').click();await attendre(()=>bouton(node,'enregistrer-version-francaise'));
   ok(node.textContent.includes('La source de cette traduction a changé'),'Traduction guidée périmée : reprise du brouillon retrouve la péremption durable');ok(bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée périmée : rechargement ne transforme pas l’ancienne traduction en complète');
   [...node.querySelectorAll('button')].find(b=>b.textContent==='Comparer les valeurs').click();await attendre(()=>bouton(node,'comparaison-brouillon'));
   ok(!!bouton(node,'comparaison-brouillon'),'Traduction guidée périmée : comparer fonctionne sans saisie préalable');const caseReprise=bouton(node,'comparaison-brouillon').querySelector('input');caseReprise.checked=true;caseReprise.dispatchEvent(new Event('change',{bubbles:true}));
   [...node.querySelectorAll('button')].find(b=>b.textContent==='Créer un brouillon avec mes choix').click();await attendre(()=>!node.textContent.includes('La source de cette traduction a changé')&&!!bouton(node,'lancer-traduction'));
   ok(!!bouton(node,'lancer-traduction'),'Traduction guidée périmée : reprise explicite rétablit une demande sur la source courante');eq(f.appels.length,1,'Traduction guidée périmée : comparer et reprendre ne paient rien');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);let repondre;f.produire(()=>new Promise(resolve=>repondre=resolve));let node=await f.ouvrir(),autre=null;try{
   bouton(node,'lancer-traduction').click();await attendre(()=>repondre);ok(node.etatEditeur().enCours,'Traduction guidée annulation : sortie protégée pendant la lecture');
   autre=await f.ouvrir();ok(!bouton(autre,'lancer-traduction'),'Traduction guidée simultanée : journal en cours empêche de repayer');eq(f.appels.length,1,'Traduction guidée simultanée : un seul appel');
   [...node.querySelectorAll('button')].find(b=>b.textContent==='Annuler l’appel').click();repondre(reponse(f.appels[0]));await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);
   eq((await repo.all('imports')).filter(x=>x.kind==='traduction')[0]?.status,'a_verifier','Traduction guidée annulation : réponse tardive conservée');eq(f.appels.length,1,'Traduction guidée annulation : aucun appel supplémentaire');
   bouton(autre,'actualiser-reponses-traduction').click();await attendre(()=>bouton(autre,'enregistrer-version-francaise').disabled===false);ok(!bouton(autre,'actualiser-reponses-traduction').offsetParent,'Traduction guidée simultanée : actualiser quitte l’attente quand la réponse est conservée');eq(f.appels.length,1,'Traduction guidée simultanée : actualiser retrouve le résultat sans repayer');
  }finally{repondre?.({raison:'annule'});node.dispose();node.remove();autre?.dispose();autre?.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);f.produire(p=>{const r=reponse(p),body=JSON.parse(r.text);body.segments.at(-1).text='Cuire pendant 99 minutes.';return{...r,text:JSON.stringify(body)};});let node=await f.ouvrir();try{
   bouton(node,'lancer-traduction').click();await attendre(()=>node.textContent.includes('1 passage reste à traduire'));ok(bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée nombres : valeur changée refuse la version complète');
   const j=(await repo.all('imports')).filter(x=>x.kind==='traduction')[0];eq(j.resultat.segments.at(-1).issue,'refuse','Traduction guidée nombres : validateur protège chaque segment');ok((await repo.get('sync_state','translation_response:v1:'+j.id)).value.body,'Traduction guidée nombres : réponse refusée reste récupérable');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);f.produire(p=>({...reponse(p),stopReason:'max_tokens'}));let node=await f.ouvrir();try{
   bouton(node,'lancer-traduction').click();await attendre(async()=>(await repo.all('imports')).some(x=>x.kind==='traduction'&&x.finished_at));await attendre(()=>!node.etatEditeur().enCours);
   ok(bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée coupée : JSON admis ne suffit pas à annoncer une traduction complète');
   node.dispose();node.remove();node=await f.ouvrir();ok(bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée coupée : signal conservé après rechargement');
   ok(node.textContent.includes('La réponse a été interrompue'),'Traduction guidée coupée : relecture explicite demandée');eq(f.appels.length,1,'Traduction guidée coupée : aucun appel répété au retour');
   [...node.querySelectorAll('button')].find(b=>b.textContent==='Utiliser cette proposition').click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);ok(!bouton(node,'enregistrer-version-francaise').disabled,'Traduction guidée coupée : adoption après relecture explicite débloque la publication');bouton(node,'enregistrer-version-francaise').click();await attendre(()=>f.destination());eq((await repo.all('recipe_translations')).length,1,'Traduction guidée coupée : passages relus enregistrables sans nouvel appel');eq(f.appels.length,1,'Traduction guidée coupée : sortie du cas interrompu sans repayer');
  }finally{node.dispose();node.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db);await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:null}]}});let connexions=0;const routeAvant=sessionStorage.getItem(SYNC_ROUTE_KEY),hash=location.hash;
  const ctx={...await getData(true),sync:{auth:{signIn:async()=>{connexions++;return{};}},user:null}},node=await renderTraductionEditeur({id:f.recipe.id},{...requete,v:f.version.id},ctx,{provider:{configured:false}});document.body.append(node);
  try{node.querySelector('[data-role=connexion-ia] button').click();await attendre(()=>connexions===1);eq(connexions,1,'Traduction guidée connexion : commande atteint le vrai objet auth');eq(sessionStorage.getItem(SYNC_ROUTE_KEY),hash,'Traduction guidée connexion : route courante gardée avant le départ');eq(f.appels.length,0,'Traduction guidée connexion : aucun appel assistant avant connexion');}finally{node.dispose();node.remove();if(routeAvant===null)sessionStorage.removeItem(SYNC_ROUTE_KEY);else sessionStorage.setItem(SYNC_ROUTE_KEY,routeAvant);}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixture(repo,db),depot=creerDepotTraductions({repo,getGeneration:getSyncGeneration}),p=await depot.capturerPortee({owner_id:'guide-user'}),o=await depot.ouvrirTraduction({portee:p.portee,affiche:{recipe:f.recipe,version:f.version,traductions:[]},locale:'fr'}),ids=[];
  for(let i=0;i<2;i++){const plan=await depot.preparerLectureTraduction({session:o.session,selection:o.source.segments.map(s=>s.ref)}),reserve=await depot.reserverPortionTraduction({plan:plan.plan,ordinal:0});ids.push(reserve.journalId);await depot.commencerPortionTraduction({reservation:reserve.reservation});await repo.marquerInterrompus(Date.now()+11*60000);}
  const node=await f.ouvrir();try{
   eq(node.querySelectorAll('[data-role=liberer-reservation-traduction]').length,2,'Traduction guidée interrompue : réservations sans réponse visibles et libérables');const boutonLiberer=bouton(node,'liberer-reservation-traduction');if(!boutonLiberer)return;
   boutonLiberer.click();try{await attendre(()=>node.querySelectorAll('[data-role=liberer-reservation-traduction]').length===1);}catch(e){throw Error(e.message+' — '+node.textContent);}
   eq((await repo.all('sync_state')).filter(r=>ids.some(id=>r.key==='translation_response:v1:'+id)).length,1,'Traduction guidée interrompue : seul le geste choisi libère sa réservation');eq(f.appels.length,0,'Traduction guidée interrompue : libérer ne paie aucun appel');
   await attendre(()=>bouton(node,'lancer-traduction'));bouton(node,'lancer-traduction').click();await attendre(()=>bouton(node,'enregistrer-version-francaise').disabled===false);eq(f.appels.length,1,'Traduction guidée interrompue : place retrouvée pour un nouvel appel explicite');
   const recu=(await repo.all('imports')).find(j=>j.kind==='traduction'&&j.resultat);const refus=await depot.preparerLiberationReservationTraduction({session:o.session,journalId:recu.id});eq(refus.issue,'refuse','Traduction guidée interrompue : libération de réservation refuse une réponse reçue');ok((await repo.get('sync_state','translation_response:v1:'+recu.id)).value.body,'Traduction guidée interrompue : réponse reçue reste intacte');
   const restant=(await repo.all('sync_state')).find(r=>ids.some(id=>r.key==='translation_response:v1:'+id));const cap=await depot.preparerLiberationReservationTraduction({session:o.session,journalId:restant.value.journal_id});eq(cap.issue,'ok','Traduction guidée interrompue : capacité exacte préparée');
   await db.mutate({origin:'remote',puts:{recipe_versions:[{...f.version,steps:[{...f.version.steps[0],text:'Changed source.'}]}]}});const conflit=await depot.libererReponseTraduction({attendu:cap.attendu,portee:p.portee});eq(conflit.issue,'refuse','Traduction guidée interrompue : source changée après préparation refuse la suppression');ok(!!await repo.get('sync_state',restant.key),'Traduction guidée interrompue : réservation conservée après conflit');
  }finally{node.dispose();node.remove();}
 });
}
