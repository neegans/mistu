import {withRepo} from './sync-fixture.js';
import {fixtureCuisineL7} from './l7-cuisine-ecran.js';
import {getData,getSyncGeneration} from '../src/ui/state.js';
import {renderCook} from '../src/ui/cook.js';
import {creerServiceCuisine} from '../src/domain/cuisine-persistance.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const attendre = pred => new Promise((resolve,reject) => {
 let timer,obs;const verifier=()=>{if(!pred())return false;clearTimeout(timer);obs?.disconnect();resolve();return true;};
 if(verifier())return;obs=new MutationObserver(verifier);obs.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
 timer=setTimeout(()=>{obs.disconnect();reject(Error('Le geste de cuisine n’a pas atteint son état attendu'));},4000);verifier();
});

export async function runConfortCuisineTests({eq,ok}) {
 const locale=getUiLocale();setUiLocale('fr');
 try { await withRepo(async(repo,db)=>{
  const f=fixtureCuisineL7();f.session.progress={done_step_ids:[],by_version:{}};
  f.a.version.steps[0].text='Préparer la veille, puis mélanger.';
  const tr={id:'confort-cuisine-fr',recipe_version_id:f.a.version.id,locale:'fr',alignment_format:1,translated_content:{title:'Pain traduit',ingredients:['Farine','Eau'],steps:['Préparer le mélange traduit.','Fin française.']},verification_state:'unverified'};
  await db.mutate({origin:'remote',puts:{recipes:[f.a.recipe,f.b.recipe],recipe_versions:[f.a.version,f.b.version],recipe_translations:[tr],cook_sessions:[f.session]}});
  const sources=await db.getAll('recipe_versions');let demandes=0,liberations=0;
  const sentinelle={released:false,addEventListener(){},removeEventListener(){},async release(){this.released=true;liberations++;}};
  const service=creerServiceCuisine({repo,getGeneration:getSyncGeneration});
  const root=await renderCook({id:f.session.id},{},await getData(true),{repo,service,wakeLock:{request:async()=>{demandes++;return sentinelle;}}});document.body.append(root);
  try {
   const options=root.querySelector('[data-role=options-cuisson]'),summary=options?.querySelector(':scope > summary');
   const langues=root.querySelector('[data-role=langue-cuisine]'),ecran=root.querySelector('[data-role=commande-ecran]'),panneau=root.querySelector('.cuisine-minuteurs'),onglets=root.querySelector('.cuisine-recettes');
   eq(options?.tagName,'DETAILS','Confort cuisine : options dans un volet natif');
   eq(options?.open,false,'Confort cuisine : options repliées au premier affichage');
   eq(summary?.textContent,'Options de cuisson','Confort cuisine : accès aux options clairement nommé');
   ok(options?.contains(langues)&&options.contains(ecran)&&options.contains(onglets),'Confort cuisine : langue, recette active et écran allumé regroupés');
   ok(!root.querySelector('[data-role=fiche-cuisine]')?.closest('[data-role=options-cuisson]')&&![...root.querySelectorAll('.cuisine-entete button')].find(b=>b.textContent==='Terminer')?.closest('[data-role=options-cuisson]'),'Confort cuisine : Fiche et Terminer restent hors options');
   const avertissement=root.querySelector('[data-role=avant-de-commencer]'),etape=root.querySelector('[data-role=cuisine-etape]');
   ok(!!avertissement&&!avertissement.closest('[data-role=options-cuisson]')&&!!(avertissement.compareDocumentPosition(etape)&Node.DOCUMENT_POSITION_FOLLOWING),'Confort cuisine : avertissement visible dans le flux avant l’étape, hors volet');
   ok(!!root.querySelector('[data-role=ingredients-cuisine]')&&!root.querySelector('[data-role=ingredients-cuisine]').closest('[data-role=options-cuisson]'),'Confort cuisine : ingrédients toujours accessibles séparément');
   eq(await db.get('cook_sessions',f.session.id),f.session,'Confort cuisine : lecture initiale sans modification de séance');
   summary?.focus();summary?.click();
   eq(options?.open,true,'Confort cuisine : le résumé ouvre réellement les options');
   eq(document.activeElement===summary,true,'Confort cuisine : ouverture conserve le focus sur le résumé');
   eq(await db.get('cook_sessions',f.session.id),f.session,'Confort cuisine : ouvrir les options ne crée aucune écriture métier');
   const francais=[...langues.querySelectorAll('button')].find(b=>b.textContent==='Français');francais.focus();francais.click();
   await attendre(()=>root.querySelector('[data-role=texte-etape]')?.textContent==='Préparer le mélange traduit.');
   eq((await db.get('cook_sessions',f.session.id)).lang,'fr','Confort cuisine : choix de langue réellement conservé');
   eq(document.activeElement===francais,true,'Confort cuisine : contrôle de langue et focus conservés après son geste');
   eq(options?.open,true,'Confort cuisine : changement de langue ne referme pas les options');
   const preparer=service.preparerLangue;let entrer,liberer;const entree=new Promise(r=>{entrer=r;}),suite=new Promise(r=>{liberer=r;});
   service.preparerLangue=async args=>{entrer();await suite;return preparer(args);};
   try{
    const original=[...langues.querySelectorAll('button')].find(b=>b.textContent==='Original');original.focus();original.click();await entree;
    const fiche=root.querySelector('[data-role=fiche-cuisine]');fiche.focus();liberer();
    await attendre(()=>root.querySelector('[data-role=texte-etape]')?.textContent===f.a.version.steps[0].text);
    eq((await db.get('cook_sessions',f.session.id)).lang,'original','Confort cuisine : geste différé de langue réellement conservé');
    eq(document.activeElement===fiche,true,'Confort cuisine : résultat tardif ne vole pas le focus déplacé vers Fiche');
   }finally{liberer();service.preparerLangue=preparer;}
   ecran.querySelector('button').click();await attendre(()=>ecran.querySelector('[data-role=etat-ecran]').textContent.includes('Actif'));
   eq([demandes,ecran.querySelector('button').getAttribute('aria-pressed')],[1,'true'],'Confort cuisine : commande écran allumé accessible et activée seulement par geste');
   summary?.click();
   eq([options?.open,demandes,liberations],[false,1,0],'Confort cuisine : fermer les options conserve le contrôleur écran actif');
   summary?.click();const sauce=onglets.querySelector(`[data-version-id="${f.b.version.id}"]`);sauce.focus();sauce.click();
   await attendre(()=>root.querySelector('[data-role=texte-etape]')?.textContent==='Première étape B.');
   eq((await db.get('cook_sessions',f.session.id)).active_version_id,f.b.version.id,'Confort cuisine : autre recette sélectionnée et conservée');
   eq(document.activeElement?.dataset.versionId,f.b.version.id,'Confort cuisine : focus rendu au choix de recette après son actualisation');
   eq(options?.open,true,'Confort cuisine : choix de recette conserve le volet ouvert');
   eq([root.querySelector('[data-role=options-cuisson]')===options,root.querySelector('[data-role=commande-ecran]')===ecran,root.querySelector('[data-role=langue-cuisine]')===langues,root.querySelector('.cuisine-minuteurs')===panneau],[true,true,true,true],'Confort cuisine : options et contrôleurs gardent leurs nœuds');
   summary?.click();root.querySelector('[data-role=suivant-cuisine]').click();await attendre(()=>root.querySelector('[data-role=texte-etape]')?.textContent==='Dernière étape B.');
   eq((await db.get('cook_sessions',f.session.id)).progress.by_version[f.b.version.id].done_step_ids,['commun'],'Confort cuisine : progression utilisable lorsque les options sont fermées');
   eq(options?.open,false,'Confort cuisine : progression ne rouvre pas les options');
   await root.actualiserCuisine();eq([root.querySelector('[data-role=options-cuisson]')===options,root.querySelector('[data-role=commande-ecran]')===ecran,demandes],[true,true,1],'Confort cuisine : actualisation sans remonter les options ni redemander écran allumé');
   eq(await db.getAll('recipe_versions'),sources,'Confort cuisine : versions sources intactes après tous les gestes');
  } finally {root.dispose();root.remove();}
  eq(liberations,1,'Confort cuisine : fermeture de la vue libère le contrôleur écran une seule fois');
 }); } finally {setUiLocale(locale);}
}
