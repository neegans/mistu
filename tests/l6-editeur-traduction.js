import {capturerSourceTraduction} from '../src/domain/traductions-format.js';
import {withRepo} from './sync-fixture.js';
export async function runL6EditeurTraductionTests({eq,ok}){
  const {renderTraductionEditeur}=await import('../src/ui/traduction-editeur.js');
  const recipe={id:'r6',original_title:'Bread',original_language:'en'},version={id:'v6',recipe_id:'r6',ingredients:[{id:'i6',name_text:'flour',source_text:'200 g flour'}],steps:[{id:'s6',text:'Do not cover.\nBake for 20 min.'}]};
  const source=await capturerSourceTraduction({recipe,version});let saved=null,posts=0,publies=0;const session={};
  const modele={locale:'fr',segments:source.segments.map(s=>({ref:s.ref,text:s.kind==='title'?'Pain':null})),adoptions:[],ecarts:[]};
  const depot={capturerPortee:async()=>({issue:'ok',portee:{}}),ouvrirTraduction:async()=>({issue:'ok',session,source,modele:structuredClone(modele),revision:null}),listerBrouillons:async()=>({issue:'ok',brouillons:[]}),conserverBrouillon:async({payload})=>{saved=structuredClone(payload);return{issue:'ok',id:'draft6',revision:1,saved_at:'2026-10-29T00:00:00Z'};},preparerPublicationTraduction:async()=>({issue:'ok',plan:{},bilan:{}}),publierTraduction:async()=>{publies++;return{issue:'publie',id:'tr6'};},preparerLectureTraduction:async()=>({issue:'ok',plan:{},portions:[],bilan:{appelsMax:2}})};
  const ctx={recipesById:new Map([[recipe.id,recipe]]),versionsById:new Map([[version.id,version]]),versionsByRecipe:new Map([[recipe.id,[version]]]),recipe_translations:[],proprietaireDonnees:null};
  const n=await renderTraductionEditeur({id:recipe.id},{kind:'translation',format:'2',v:version.id,locale:'fr'},ctx,{depot,provider:{configured:true,completeTranslation:async()=>{posts++;}},confirmer:async()=>true,naviguer:()=>{}});document.body.append(n);
  try{
    eq(posts,0,'L6 traduction écran : ouverture ne paie rien');eq(n.querySelectorAll('[data-role=segment-traduction]').length,source.segments.length,'L6 traduction écran : source complète, y compris texte documentaire');
    const champs=[...n.querySelectorAll('[data-role=segment-traduction] textarea')];eq(champs[0].value,'Pain','L6 traduction écran : proposition déjà présente gardée');
    champs[1].value='farine';champs[1].dispatchEvent(new Event('input',{bubbles:true}));await n.flushEditeur();eq(saved.segments[0].text,'Pain','L6 traduction écran : corriger une valeur garde les autres');eq(saved.segments[1].text,'farine','L6 traduction écran : saisie corrigée durable');
    eq(n.querySelector('[data-role=publier-traduction]').textContent,'Garder la traduction partielle','L6 traduction écran : publication partielle nommée');
    ok(n.querySelector('[data-role=preparer-traduction]'),'L6 traduction écran : appel proposé explicitement');
    n.querySelector('[data-role=preparer-traduction]').click();await new Promise(r=>setTimeout(r,20));eq(posts,0,'L6 traduction écran : afficher coût ne lance rien');ok(n.textContent.includes('2'),'L6 traduction écran : coût maximal affiché');
    n.querySelector('[data-role=publier-traduction]').click();await new Promise(r=>setTimeout(r,20));eq(publies,1,'L6 traduction écran : geste garde publie une fois');
    eq((await n.flushEditeur()).issue,'ok','L6 traduction écran : publication libère sortie');
  }finally{n.dispose();n.remove();}
  let ouvert=0;const attente=await renderTraductionEditeur({id:recipe.id},{kind:'translation',format:'2',v:version.id,locale:'fr'},ctx,{depot:{...depot,listerBrouillons:async()=>({issue:'ok',brouillons:[{id:'ancien-draft',entity_id:recipe.id,recipe_version_id:version.id,locale:'fr',saved_at:'2026-10-29T00:00:00Z'}]}),ouvrirTraduction:async a=>{ouvert++;return depot.ouvrirTraduction(a);}},provider:{configured:true}});document.body.append(attente);
  try{eq(ouvert,0,'L6 traduction écran : brouillon existant proposé avant formulaire neuf');ok(attente.querySelector('a[href*="draft=ancien-draft"]'),'L6 traduction écran : retour après sauvegarde en vol retrouve brouillon exact');}finally{attente.dispose();attente.remove();}
  let adoptes=null;const resultat={format:1,segments:source.segments.map(s=>({ref:s.ref,text:'Proposé '+s.kind,issue:'admis'}))},lecture={journalId:'j-ui',resultat,remaining_refs:source.segments.map(s=>s.ref)};
  const partiel=await renderTraductionEditeur({id:recipe.id},{kind:'translation',format:'2',v:version.id,locale:'fr',import:'j-ui'},ctx,{depot:{...depot,lireLectureTraduction:async()=>({issue:'ok',lecture}),adopterLectureTraduction:async({refs})=>{adoptes=refs;return{issue:'ok',session,source,modele};}},provider:{configured:true},confirmer:async()=>true});document.body.append(partiel);
  try{const cases=[...partiel.querySelectorAll('[data-role=adopter-segment]')];eq(cases.length,resultat.segments.length,'L6 traduction écran : chaque segment proposé peut être choisi explicitement');for(const c of cases)c.checked=c.dataset.ref===source.segments[0].ref;[...partiel.querySelectorAll('button')].find(b=>b.textContent==='Utiliser cette proposition').click();for(let i=0;i<100&&!adoptes;i++)await new Promise(r=>setTimeout(r,5));eq(adoptes,[source.segments[0].ref],'L6 traduction écran : adoption partielle ne prend que les segments cochés');}finally{partiel.dispose();partiel.remove();}
  await withRepo(async()=>{
    const attendre=async test=>{for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,5));}throw Error('État du parcours de traduction attendu absent');};
    let appel=0,conservations=0,repondre,signalAppel;
    const provider={configured:true,completeTranslation:({signal})=>{appel++;signalAppel=signal;return new Promise(resolve=>{repondre=resolve;});}};
    const depotVol={...depot,preparerLectureTraduction:async()=>({issue:'ok',plan:{},portions:[{ordinal:0}],bilan:{appelsMax:1}}),reserverPortionTraduction:async()=>({issue:'ok',journalId:'j-parcours',reservation:{}}),commencerPortionTraduction:async()=>({issue:'ok',portion:{},vol:{}}),conserverReponseTraduction:async()=>++conservations===1?{issue:'echec',raison:'quota_stockage'}:{issue:'conserve',journalId:'j-parcours'},lireLectureTraduction:async()=>({issue:'ok',lecture:{resultat:{segments:[]},remaining_refs:[]}})};
    const assiste=await renderTraductionEditeur({id:recipe.id},{kind:'translation',format:'2',v:version.id,locale:'fr',assistant:'1'},ctx,{depot:depotVol,provider});document.body.append(assiste);
    const bouton=texte=>[...assiste.querySelectorAll('button')].find(b=>b.textContent===texte),actif=texte=>{const b=bouton(texte);return !!b&&!b.disabled&&!b.closest('[hidden]');};
    const commandes=()=>['Annuler l’appel','Réessayer de conserver la réponse','Récupérer la réponse non conservée'].map(actif);
    const avantChamps=node=>!!(node.compareDocumentPosition(assiste.querySelector('[data-role=segment-traduction]'))&Node.DOCUMENT_POSITION_FOLLOWING);
    try{
      ok(avantChamps(assiste.querySelector('[data-role=preparer-traduction]')),'Correctif traduction : entrée assistant propose la préparation avant les champs');
      eq(commandes(),[false,false,false],'Correctif traduction : aucune commande de vol active avant un appel');
      eq(appel,0,'Correctif traduction : entrée assistant ne lance aucun appel');
      assiste.querySelector('[data-role=preparer-traduction]').click();await attendre(()=>assiste.querySelector('[data-role=lancer-traduction]'));
      ok(avantChamps(assiste.querySelector('[data-role=lancer-traduction]')),'Correctif traduction : coût et lancement restent avant les champs');
      eq(appel,0,'Correctif traduction : préparer le coût ne lance aucun appel');
      assiste.querySelector('[data-role=lancer-traduction]').click();await attendre(()=>signalAppel);
      eq(commandes(),[true,false,false],'Correctif traduction : seul annuler est actif pendant le vol');
      bouton('Annuler l’appel').click();eq(signalAppel.aborted,true,'Correctif traduction : annuler arrête le signal du vrai contrôleur');
      eq(commandes(),[false,false,false],'Correctif traduction : après annulation aucune récupération sans réponse');
      repondre({text:'Réponse tardive',stopReason:'end_turn',reponseBrute:new Uint8Array([1,2,3])});await attendre(()=>conservations===1);await attendre(()=>assiste.textContent.includes('La réponse est reçue'));
      eq(commandes(),[false,true,true],'Correctif traduction : échec de conservation expose les deux gestes utiles');
      bouton('Réessayer de conserver la réponse').click();await attendre(()=>conservations===2);await attendre(()=>!assiste.etatEditeur().sale);
      eq(commandes(),[false,false,false],'Correctif traduction : réponse conservée retire les commandes de récupération');
      eq(appel,1,'Correctif traduction : conserver à nouveau ne relance pas le fournisseur');
    }finally{repondre?.({raison:'annule'});assiste.dispose();assiste.remove();}
  });
}
