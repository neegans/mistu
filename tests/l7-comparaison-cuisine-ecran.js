import {withRepo} from './sync-fixture.js';
import {fixtureComparaisonCuisine} from './l7-comparaison-cuisine.js';
import {adopterProgressionCuisine} from '../src/domain/cuisine-format.js';
const attendre=async f=>{for(let i=0;i<150;i++){if(await f())return;await new Promise(r=>setTimeout(r,10));}throw Error('Comparaison attendue absente');};
export async function runL7ComparaisonCuisineEcranTests({eq,ok}){
 let creer;try{({creerPanneauComparaisonCuisine:creer}=await import('../src/ui/comparaison-cuisine.js'));}catch{ok(false,'L7 écran comparaison : panneau explicite disponible');return;}
 await withRepo(async(repo,db)=>{
  const f=await fixtureComparaisonCuisine(repo,db);let actualise=0;
  const node=creer({sessionId:'cc',repo,ctx:{proprietaireDonnees:'u1'},getGeneration:()=>0,onConserve:()=>{actualise++;throw Error('affichage injecté');}});document.body.append(node);
  try{
   await node.actualiser();const avant=await db.getSnapshot();eq(node.querySelector('[data-role=confirmer-cuisine]'),null,'L7 écran comparaison : aucun choix sans copies affichées');
   node.querySelector('[data-role=comparer-cuisine]').click();await attendre(()=>node.querySelector('[data-role=confirmer-cuisine]'));
   eq(await db.getSnapshot(),avant,'L7 écran comparaison : ouverture sans écriture');ok(node.textContent.includes('2')&&node.textContent.includes('modifications'),'L7 écran comparaison : commandes dépendantes annoncées');ok(node.textContent.includes(f.timer.mirror.started_at),'L7 écran comparaison : vrai départ local visible');
   node.querySelector('[data-role=annuler-comparaison-cuisine]').click();eq(await db.getSnapshot(),avant,'L7 écran comparaison : annulation sans mutation');
   node.querySelector('[data-role=comparer-cuisine]').click();await attendre(()=>node.querySelector('[data-role=confirmer-cuisine]'));
   node.querySelector('[data-role=confirmer-cuisine]').click();await attendre(()=>actualise===1);
   ok(!node.textContent.includes('n’a pas pu être conservée'),'L7 écran comparaison : panne après commit ne prétend pas perdre le choix');
   eq(await db.get('cook_sessions','cc'),f.confirmee,'L7 écran comparaison : bouton utilise confirmation réellement montrée');ok(node.querySelector('[data-role=recuperation-cuisine]'),'L7 écran comparaison : accès réel à la copie conservée');ok(node.textContent.includes(f.timer.mirror.deadline_at),'L7 écran comparaison : échéance historique lisible après choix');
  }finally{node.dispose();node.remove();}
  const repris=creer({sessionId:'cc',repo,ctx:{proprietaireDonnees:'u1'},getGeneration:()=>0});document.body.append(repris);
  try{await repris.actualiser();ok(repris.querySelector('[data-role=recuperation-cuisine]'),'L7 écran comparaison : copie encore accessible après remontage');eq(repris.querySelector('a[href^="shortcuts:"]'),null,'L7 écran comparaison : aucune demande système relancée');}finally{repris.dispose();repris.remove();}
 });
 await withRepo(async(repo,db)=>{
  const f=await fixtureComparaisonCuisine(repo,db),a={id:'cv',recipe_id:'cr',kind:'original',ingredients:[],steps:[{id:'cs',text:'Pétrir.'},{id:'fin-pain',text:'Cuire le pain.'}]},b={id:'version-sauce',recipe_id:'recette-sauce',kind:'original',ingredients:[],steps:[{id:'sauce-debut',text:'Couper.'},{id:'sauce-fin',text:'Verser la sauce.'}]};
  const base={...f.legacy,selected_version_ids:[a.id,b.id],progress:{by_version:{[a.id]:{current_step_id:'cs',done_step_ids:['cs']},[b.id]:{current_step_id:'sauce-debut',done_step_ids:[]}}}};
  const locale=adopterProgressionCuisine({...base,active_version_id:a.id},[a,b],'ck_op_'+'d'.repeat(64)),confirmee=adopterProgressionCuisine({...base,active_version_id:b.id,progress:{by_version:{[a.id]:{current_step_id:'fin-pain',done_step_ids:[]},[b.id]:{current_step_id:'sauce-fin',done_step_ids:['sauce-debut']}}}},[a,b],'ck_op_'+'e'.repeat(64));
  await db.mutate({origin:'remote',puts:{recipes:[{id:b.recipe_id,original_title:'Sauce au citron'}],recipe_versions:[a,b],cook_sessions:[locale],sync_state:[{...f.confirmation,value:{...f.confirmation.value,data:confirmee}}]}});
  const node=creer({sessionId:'cc',repo,ctx:{proprietaireDonnees:'u1'},getGeneration:()=>0});document.body.append(node);
  try{await node.actualiser();node.querySelector('[data-role=comparer-cuisine]').click();await attendre(()=>node.querySelector('[data-role=confirmer-cuisine]'));
   const ici=node.querySelector('[data-role=copie-cuisine-locale]'),ailleurs=node.querySelector('[data-role=copie-cuisine-confirmee]');
   ok(ici?.textContent.includes('Recette active : Pain')&&ailleurs?.textContent.includes('Recette active : Sauce au citron'),'L7 comparaison visible : même total coché mais recette active distincte');
   ok(ici?.textContent.includes('Étape 1 : Pétrir.')&&ailleurs?.textContent.includes('Étape 2 : Cuire le pain.')&&ailleurs?.textContent.includes('Étape 2 : Verser la sauce.'),'L7 comparaison visible : pointeurs qualifiés par recette avec vrais numéros et textes');
   ok(!node.querySelector('[data-role=comparaison-cuisine-detail]').textContent.includes('ck_op_'),'L7 comparaison visible : aucun identifiant opérationnel brut');
   await db.mutate({origin:'remote',deletes:{recipe_versions:[b.id]}});node.querySelector('[data-role=annuler-comparaison-cuisine]').click();node.querySelector('[data-role=comparer-cuisine]').click();await attendre(()=>node.querySelector('[data-role=confirmer-cuisine]'));
   ok(node.querySelector('[data-role=comparaison-cuisine-detail]').textContent.includes('Source indisponible'),'L7 comparaison visible : source absente nommée sans inventer une étape');
  }finally{node.dispose();node.remove();}
 });
 const {syncSectionModel,syncSectionL3}=await import('../src/ui/settings.js');
 const c={id:'conflit-cuisine',kind:'cooking',store:'timer_launches',record_id:'timer',local:{op:'cooking_apply',action:'anchor',store:'timer_launches',id:'timer',change:{mirror:{started_at:'date-locale'}}},at:'2026-10-30T10:00:00.000Z'};
 const q={seq:4,op:'cooking_apply',store:'timer_launches',id:'timer',payload:c.local,last_error:'ancre_changee'};
 const model=syncSectionModel({available:true,user:{id:'u1'},guard:{ok:true},moteur:{enCours:false},conflits:[c],quarantaine:[q],snapshot:{timer_launches:[{id:'timer',cook_session_id:'cc'}]}}),vue=document.createElement('div');vue.append(...syncSectionL3(model,{reessayer:()=>{},abandonner:()=>{},garderIci:()=>{},garderAilleurs:()=>{},ignorerConflit:()=>{}}));
 eq([...vue.querySelectorAll('button')].filter(b=>/Garder celle|Abandonner|Ignorer/.test(b.textContent)).length,0,'L7 réglages : gestes génériques absents pour une intention cuisine');
 ok(!!vue.querySelector('a[href="#/cook/cc"]'),'L7 réglages : accès réel à la comparaison de la séance');
 ok(vue.textContent.includes('date-locale'),'L7 réglages : copie conservée consultable avant navigation');
}
