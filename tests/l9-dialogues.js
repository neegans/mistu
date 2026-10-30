import {el,confirmDialog,promptDialog,chooseDialog} from '../src/core/dom.js';
const pause=()=>new Promise(r=>setTimeout(r,50));
const nom=n=>n?.getAttribute('aria-label')||n?.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||'';
const associe=n=>!!(n?.labels?.length||n?.getAttribute('aria-labelledby')?.split(/\s+/).every(id=>document.getElementById(id)?.textContent));
const dernier=()=>[...document.querySelectorAll('dialog')].at(-1);
const clic=(dlg,texte)=>[...dlg.querySelectorAll('button')].find(b=>b.textContent===texte)?.click();
function fermerRestants(){for(const d of document.querySelectorAll('dialog')){try{d.close();}catch{}d.remove();}}
export async function runL9DialoguesTests({eq,ok}){
 const zone=el('main',null,el('h1',{tabindex:-1},'Vue de test'),el('button',null,'Déclencheur'));document.body.append(zone);const trigger=zone.querySelector('button');
 try{
  trigger.focus();let p=confirmDialog('Retirer cette copie ?', {danger:true,okLabel:'Retirer'}),dlg=dernier();
  eq(nom(dlg),'Retirer cette copie ?','L9 confirmer : nom depuis titre visible');eq(document.activeElement?.textContent,'Annuler','L9 confirmer : décision destructive commence par Annuler');clic(dlg,'Annuler');eq(await p,false,'L9 confirmer : annulation inchangée');await pause();ok(document.activeElement===trigger,'L9 confirmer : retour au déclencheur');
  p=confirmDialog('Garder cette copie ?');dlg=dernier();clic(dlg,'Confirmer');eq(await p,true,'L9 confirmer : accord inchangé');await pause();
  p=promptDialog('Nom du repas',{value:'Souper',multiline:true});dlg=dernier();let input=dlg.querySelector('textarea');eq(nom(dlg),'Nom du repas','L9 prompt : dialogue nommé');ok(associe(input),'L9 prompt : champ associé à un label');input.value='Dîner';clic(dlg,'OK');eq(await p,'Dîner','L9 prompt : saisie exacte retournée');await pause();
  p=promptDialog('Fermer tout de suite');dlg=dernier();clic(dlg,'Annuler');eq(await p,null,'L9 prompt : fermeture avant délai annule');const next=el('button',null,'Nouvelle action');zone.append(next);next.focus();await pause();ok(document.activeElement===next,'L9 prompt : aucun focus retardé après fermeture');
  trigger.focus();p=chooseDialog('Choisir la recette',[{value:'a',label:'Pain'},{value:'b',label:'Soupe',hint:'Sans sel'}]);dlg=dernier();const select=dlg.querySelector('select');eq(nom(dlg),'Choisir la recette','L9 choix : dialogue nommé');ok(associe(select),'L9 choix : sélection possède un label');eq([...select.options].map(o=>o.textContent),['Pain','Soupe — Sans sel'],'L9 choix : toutes les options et indications conservées');select.value='b';clic(dlg,'Choisir');eq(await p,'b','L9 choix : valeur explicitement choisie retournée');await pause();
  trigger.focus();p=confirmDialog('Déclencheur retiré');dlg=dernier();trigger.remove();clic(dlg,'Annuler');await p;await pause();ok(document.activeElement===zone.querySelector('h1'),'L9 fermeture : repli sur titre si déclencheur disparu');
  zone.append(trigger);trigger.focus();p=confirmDialog('Déclencheur indisponible');dlg=dernier();trigger.disabled=true;clic(dlg,'Annuler');await p;await pause();ok(document.activeElement===zone.querySelector('h1'),'L9 fermeture : ne cible pas déclencheur désactivé');trigger.disabled=false;
  p=chooseDialog('Premier choix',[{value:'a',label:'A'}]);dlg=dernier();const titre1=dlg.getAttribute('aria-labelledby');clic(dlg,'Annuler');await p;await pause();p=chooseDialog('Second choix',[{value:'b',label:'B'}]);dlg=dernier();ok(!!titre1&&!!dlg.getAttribute('aria-labelledby')&&titre1!==dlg.getAttribute('aria-labelledby'),'L9 dialogues successifs : identifiants de titres distincts');dlg.close();eq(await p,null,'L9 fermeture native : annulation sans choisir le premier élément');await pause();
 }finally{fermerRestants();zone.remove();}
}
export async function runL9DialoguesRepliTests({eq,ok}){
 const proto=HTMLDialogElement.prototype,desc=Object.getOwnPropertyDescriptor(proto,'showModal'),confirm=window.confirm,prompt=window.prompt,zone=el('main',null,el('h1',{tabindex:-1},'Repli'),el('button',null,'Ouvrir'));document.body.append(zone);
 let confirms=0,prompts=0;window.confirm=()=>{confirms++;return false;};window.prompt=()=>{prompts++;return 'Saisie native';};
 try{
  Object.defineProperty(proto,'showModal',{configurable:true,value:undefined});
  eq(await confirmDialog('Confirmer ?').catch(()=> 'rejet'),false,'L9 repli : constructeur présent sans showModal garde annulation native');eq(confirms,1,'L9 repli : une confirmation native seulement');
  eq(await promptDialog('Titre').catch(()=> 'rejet'),'Saisie native','L9 repli : prompt natif quand showModal absent');eq(prompts,1,'L9 repli : un prompt natif seulement');
  let outcome,p=chooseDialog('Choix réel',[{value:'a',label:'A'},{value:'b',label:'B'}]).catch(()=>{outcome='rejet';return null;});await Promise.resolve();let dlg=dernier();ok(!!dlg?.open&&!!dlg.querySelector('select'),'L9 repli choix : présentation visible avec toutes les options');if(dlg?.open){dlg.querySelector('select').value='b';clic(dlg,'Choisir');}else fermerRestants();eq(await p,'b','L9 repli choix : sélection réelle, jamais première implicite');
  p=confirmDialog('Décision avec détail',{body:el('p',null,'Le texte conservé reste récupérable')}).catch(()=>null);await Promise.resolve();dlg=dernier();ok(!!dlg?.open&&dlg.textContent.includes('Le texte conservé reste récupérable'),'L9 repli : contenu supplémentaire conservé en ligne');if(dlg?.open)clic(dlg,'Annuler');else fermerRestants();eq(await p,false,'L9 repli détaillé : annulation explicite');
  Object.defineProperty(proto,'showModal',{configurable:true,value(){throw new DOMException('Indisponible','NotSupportedError');}});
  eq(await confirmDialog('Appel non utilisable').catch(()=> 'rejet'),false,'L9 repli : capacité réellement appelée peut échouer');
  p=chooseDialog('Annuler le choix',[{value:'a',label:'A'}]).catch(()=>null);await Promise.resolve();dlg=dernier();if(dlg?.open)clic(dlg,'Annuler');else fermerRestants();eq(await p,null,'L9 repli : annuler ne transforme pas la première option en choix');
 }finally{Object.defineProperty(proto,'showModal',desc);window.confirm=confirm;window.prompt=prompt;fermerRestants();zone.remove();}
}
export async function runL9DialoguesMetierTests({eq,ok}){
 const {withRepo}=await import('./sync-fixture.js'),{ouvrirCuissons,ouvrirTextePersonnel}=await import('../src/ui/cuisson.js'),{ouvrirFormulaireLot,ouvrirMouvementLot}=await import('../src/ui/inventaire-formulaire.js'),{ouvrirRestesApresCuisson}=await import('../src/ui/inventaire-restes.js');
 await withRepo(async repo=>{
  const recipe={id:'l9-r',original_title:'Pain',availability:'available'},version={id:'l9-v',recipe_id:recipe.id,ingredients:[],steps:[],servings:4};await repo.saveBatch({recipes:[recipe],recipe_versions:[version]},{conditions:{recipes:[{key:recipe.id,absente:true}]}});
  const zone=el('main',null,el('h1',{tabindex:-1},'Repas'),el('button',null,'Mon bilan'));document.body.append(zone);const trigger=zone.querySelector('button');
  try{
   trigger.focus();let p=ouvrirCuissons([{recipe,version}],{repo,toast:()=>{}}),dlg=dernier();eq(nom(dlg),'J’ai cuisiné ce plat','L9 cuisson : bilan possède un titre accessible');clic(dlg,'Annuler');eq(await p,false,'L9 cuisson : annulation conserve booléen historique');await pause();ok(document.activeElement===trigger,'L9 cuisson : focus revient au geste du bilan');
   dlg=ouvrirTextePersonnel({store:'recipes',id:recipe.id,champ:'personal_notes',valeur:'Note exacte',titre:'Mes notes'},{repo,recipe,toast:()=>{}});eq(nom(dlg),'Mes notes','L9 notes : dialogue nommé');eq(dlg.querySelector('textarea').value,'Note exacte','L9 notes : texte inchangé par présentation');clic(dlg,'Annuler');await pause();
   const service={ouvrirCreation:async()=>({issue:'ok',creation:{}})};
   p=ouvrirFormulaireLot({service,portee:{},ctx:{}});await Promise.resolve();await Promise.resolve();dlg=dernier();eq(nom(dlg),'Ajouter un lot','L9 stock : formulaire nommé');clic(dlg,'Annuler');eq(await p,null,'L9 stock : annulation ne fabrique aucune intention');await pause();
   const lu={affiche:{lot:{id:'l9-lot'}},lecture:{},projection:{label:'Pain',quantite:{mode:'connue',unit:'g',initial:500,remaining:400},dates:{}}};
   p=ouvrirMouvementLot({service,portee:{},lu,action:'finish'});dlg=dernier();eq(nom(dlg),'Tout consommé','L9 mouvement : dialogue nommé');eq(document.activeElement?.textContent,'Annuler','L9 mouvement : fin de stock commence sur annulation');clic(dlg,'Annuler');eq(await p,null,'L9 mouvement : aucun stock consommé au montage');await pause();
   p=ouvrirRestesApresCuisson({recu:{rows:[{id:'l9-h',recipe_id:recipe.id,recipe_version_id:version.id}]},repo,service:{capturerPortee:async()=>({issue:'ok',portee:{}})},ctx:{}});
   for(let i=0;i<100&&!document.querySelector('[data-role=restes-cuisson]');i++)await new Promise(r=>setTimeout(r,5));dlg=dernier();eq(nom(dlg),'Cuisson enregistrée','L9 restes : dialogue nommé');clic(dlg,'Terminer');eq(await p,false,'L9 restes : fermer ne crée aucun lot');eq((await repo.all('inventory')).length,0,'L9 dialogues : présentation seule ne modifie pas inventaire');
  }finally{fermerRestants();zone.remove();}
 });
}
export async function runL9DialoguesCycleTests({eq,ok}){
 const {ouvrirDialogue}=await import('../src/core/dom.js');
 const zone=el('main',null,el('h1',{tabindex:-1},'Cycle'),el('button',null,'Départ'),el('button',null,'Suite'));document.body.append(zone);const[avant,suite]=zone.querySelectorAll('button');
 try{
  avant.focus();const obsolete=el('dialog',null,el('h2',null,'Ancien contexte'),el('button',null,'Action ancienne')),ancien=ouvrirDialogue(obsolete,{estCourante:()=>false});ok(!obsolete.open&&!obsolete.isConnected,'L9 cycle : contexte déjà périmé ne monte pas de dialogue');ok(document.activeElement===avant,'L9 cycle : showModal périmé ne déplace jamais le focus');ancien.fermer();obsolete.remove();await pause();
  avant.focus();const exact=el('dialog',null,el('h2',null,'Retour'),el('button',null,'Fermer')),retour=ouvrirDialogue(exact);retour.fermer();exact.remove();suite.focus();await pause();ok(document.activeElement===suite,'L9 cycle : un focus explicite après fermeture prime sur restauration');
  avant.focus();let courant=true;let d=el('dialog',null,el('h2',null,'Garde'),el('button',null,'Fermer')),p=ouvrirDialogue(d,{estCourante:()=>courant});courant=false;p.fermer();d.remove();suite.focus();await pause();ok(document.activeElement===suite,'L9 cycle : portée périmée ne reprend pas focus');
  avant.focus();d=el('dialog',null,el('h2',null,'Démontage'),el('button',null,'Fermer'));p=ouvrirDialogue(d);p.fermer();p.dispose();d.remove();suite.focus();await pause();ok(document.activeElement===suite,'L9 cycle : dispose annule restauration tardive');
  avant.focus();d=el('dialog',null,el('h2',null,'Ancienne'),el('button',null,'Fermer'));p=ouvrirDialogue(d);p.fermer();d.remove();const d2=el('dialog',null,el('h2',null,'Nouvelle'),el('button',null,'Rester ici')),p2=ouvrirDialogue(d2);await pause();ok(d2.contains(document.activeElement),'L9 cycle : fermeture ancienne ne vole pas focus au nouveau dialogue');p2.fermer();d2.remove();await pause();
  let total=0;const prom=confirmDialog('Une décision').then(x=>{total++;return x;});d=dernier();d.dispatchEvent(new Event('cancel',{cancelable:true}));d.dispatchEvent(new Event('close'));eq(await prom,false,'L9 cycle : cancel et close restent une annulation');await pause();eq(total,1,'L9 cycle : une seule résolution observable');
  const constructeur=window.HTMLDialogElement,confirmer=window.confirm;try{window.HTMLDialogElement=undefined;let appels=0;window.confirm=()=>{appels++;return true;};const pending=confirmDialog('Navigateur ancien');await Promise.resolve();d=dernier();if(d?.open)clic(d,'Confirmer');eq(await pending,true,'L9 ancien navigateur : accord explicite gardé');eq(appels,1,'L9 ancien navigateur : absence constructeur utilise repli');}finally{window.HTMLDialogElement=constructeur;window.confirm=confirmer;}
  const old=location.hash;try{const pending=chooseDialog('Quitter la vue',[{value:'a',label:'A'}]);history.replaceState(history.state,'','#/l9-autre-vue');window.dispatchEvent(new Event('hashchange'));eq(await pending,null,'L9 cycle : changement de route annule choix ouvert');eq(document.querySelectorAll('dialog[open]').length,0,'L9 cycle : aucune boîte orpheline après route');}finally{history.replaceState(history.state,'',old||location.pathname);}
 }finally{fermerRestants();zone.remove();}
}
export async function runL9DialoguesMetierRepliTests({eq,ok}){
 const {ouvrirCuissons}=await import('../src/ui/cuisson.js'),{ouvrirFormulaireLot}=await import('../src/ui/inventaire-formulaire.js'),{withRepo}=await import('./sync-fixture.js'),desc=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:undefined});
 try{await withRepo(async repo=>{
  const recipe={id:'l9-inline-r',original_title:'Soupe',availability:'available'},version={id:'l9-inline-v',recipe_id:recipe.id,servings:2,ingredients:[],steps:[]};await repo.saveBatch({recipes:[recipe],recipe_versions:[version]},{conditions:{recipes:[{key:recipe.id,absente:true}]}});
  let p=ouvrirCuissons([{recipe,version}],{repo,toast:()=>{}}),d=dernier();ok(d.open&&d.getAttribute('aria-modal')==='false','L9 cuisson repli : présentation ouverte honnêtement non modale');ok(d.querySelector('textarea')&&d.textContent.includes('Soupe'),'L9 cuisson repli : recette et saisie gardées');d.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));eq(await p,false,'L9 cuisson repli : Échap annule sans écriture');eq((await repo.all('cook_history')).length,0,'L9 cuisson repli : aucun bilan inventé');
  let appels=0;p=ouvrirFormulaireLot({service:{ouvrirCreation:async()=>({issue:'ok',creation:{}}),preparerCreation:async()=>{appels++;return{issue:'refuse',raison:'contexte_change'};}},portee:{},ctx:{}});await Promise.resolve();await Promise.resolve();d=dernier();ok(d.open&&nom(d)==='Ajouter un lot','L9 stock repli : titre et formulaire disponibles');const field=d.querySelector('input[name=label]');field.value='Restes saisis';clic(d,'Enregistrer');await pause();eq(field.value,'Restes saisis','L9 stock repli : refus garde texte exact');eq(appels,1,'L9 stock repli : une intention par geste');ok(d.open,'L9 stock repli : refus laisse formulaire ouvert');clic(d,'Annuler');eq(await p,null,'L9 stock repli : annulation disponible après refus');
 });}finally{Object.defineProperty(HTMLDialogElement.prototype,'showModal',desc);fermerRestants();}
}
