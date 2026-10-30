import {renderKitchen} from '../src/ui/kitchen.js';
const attendre=async f=>{for(let i=0;i<150;i++){if(await f())return;await new Promise(r=>setTimeout(r,10));}throw Error('Écran inventaire attendu absent');};
export function fixtureInventaireEcran(){
 const legacy={id:'ancien',label:'Bœuf ancien',location:'frigo',quantity_text:'4 portions /800g',portions:3};
 const lot={id:'lot',label:'Soupe',location:'frigo',quantity_text:'4 portions',stock:{format:1,unit:'portion',initial:4,remaining:3,state:'available'}};
 const projection={id:'lot',etat:'available',adoption_requise:false,label:'Soupe',location:'frigo',quantite:{mode:'connue',unit:'portion',initial:4,remaining:3,mention_origine:'4 portions',portions_anciennes:null},dates:{prepared:{origine:'aucune',valeur:null,depassee:null},use_by:{origine:'aucune',valeur:null,depassee:null}},source:{etat:'aucune'},actions:{modifier:true,adopter:false,consommer:true,terminer:true,annuler:false},annulation:null,synchronisation:{etat:'en_attente'},raison:null};
 const lu={lecture:{},affiche:{lot,recipe:null,version:null,edition:null,history:null,synchronisation:projection.synchronisation},projection};
 const historique={lecture:{},affiche:{lot:legacy,recipe:null,version:null,edition:null,history:null,synchronisation:{etat:'locale'}},projection:{...projection,id:legacy.id,label:legacy.label,etat:'legacy',adoption_requise:true,quantite:{mode:'legacy',unit:null,initial:null,remaining:null,mention_origine:legacy.quantity_text,portions_anciennes:3},actions:{modifier:true,adopter:true,consommer:false,terminer:false,annuler:false}}};
 const service={capturerPortee:async()=>({issue:'ok',portee:{}}),listerLots:async()=>({issue:'ok',lots:[lu,historique],compteurs:{available:1,finished:0,legacy:1,invalid:0},total:2}),lireConflits:async()=>({issue:'ok',conflits:[]}),lireRecuperations:async()=>({issue:'ok',recuperations:[]})};
 const ctx={inventory:[lot,legacy],recipes:[],recipe_versions:[],recipesById:new Map(),versionsById:new Map(),editionsById:new Map(),settings:{ui_locale:'fr'},proprietaireDonnees:null};return{lot,legacy,lu,historique,service,ctx};
}
export async function runL8InventaireEcranTests({eq,ok}){
 {const f=fixtureInventaireEcran();f.service.listerLots=async()=>({issue:'ok',lots:[],total:0});const root=await renderKitchen({},{tab:'inventory'},f.ctx,{service:f.service,getGeneration:()=>0});try{ok(!!root.querySelector('.empty .ico svg')&&root.querySelector('.empty').textContent.includes('Aucun lot'),'L8 inventaire vide : état illustré conservé');}finally{root.dispose?.();root.remove();}}
 const f=fixtureInventaireEcran(),root=await renderKitchen({}, {tab:'inventory'}, f.ctx,{service:f.service,getGeneration:()=>0});document.body.append(root);
 try{await root.actualiser?.();const textes=[...root.querySelectorAll('button')].map(x=>x.textContent);
  ok(textes.includes('Modifier'),'L8 inventaire : correction du lot disponible');
  ok(!textes.includes('−1 portion')&&!textes.includes('Consommé'),'L8 inventaire : aucun mouvement ou effacement implicite sur ancien lot');
  ok(root.querySelector('[data-role=restant-lot]')?.textContent.includes('3'),'L8 inventaire : restant structuré principal distinct du texte initial');
  const ancien=root.querySelector('[data-lot-id=ancien]');ok(ancien?.textContent.includes('À confirmer')&&!ancien.querySelector('[data-role=consommer-lot]'),'L8 inventaire : ancien restant proposé sans consommation avant adoption');
  eq(f.lot.stock.remaining,3,'L8 inventaire : rendre écran ne change aucun stock');
 }finally{root.dispose?.();root.remove();}
 {
  const f=fixtureInventaireEcran(),preparations=[],commits=[],intention={};let quota=true;
  f.service.preparerConsommation=async a=>{preparations.push(a);return{issue:'ok',intention,apercu:{after:{...f.lu.projection,quantite:{...f.lu.projection.quantite,remaining:2}}}};};
  f.service.appliquer=async a=>{commits.push(a);if(quota)return{issue:'echec',raison:'quota_stockage',reessayable:true};f.lu.projection.quantite.remaining=2;return{issue:'conserve',...f.lu};};
  const root=await renderKitchen({}, {tab:'inventory'}, f.ctx,{service:f.service,getGeneration:()=>0});document.body.append(root);
  try{root.querySelector('[data-lot-id=lot] [data-role=consommer-lot]').click();const dlg=document.querySelector('[data-role=mouvement-lot]'),input=dlg.querySelector('[name=amount]'),bouton=dlg.querySelector('[data-role=confirmer-mouvement]');input.value='1';input.dispatchEvent(new Event('input'));bouton.click();await attendre(()=>bouton.textContent==='Confirmer'&&!bouton.disabled);
   eq(commits.length,0,'L8 utilisation : aperçu sans mouvement avant confirmation');eq(preparations[0].lecture,f.lu.lecture,'L8 utilisation : base exactement affichée avant dialogue');
   ok(dlg.textContent.includes('Après confirmation : 2 portions'),'L8 utilisation : résultat absolu montré avant commit');bouton.click();await attendre(()=>!bouton.disabled&&!dlg.querySelector('[role=alert]').hidden);eq(input.value,'1','L8 utilisation : quota garde la quantité saisie');ok(dlg.textContent.includes('Pas assez de place'),'L8 utilisation : quota ne blâme pas la saisie');
   quota=false;bouton.click();await attendre(()=>!dlg.isConnected);eq(preparations.length,1,'L8 utilisation : réessai ne recapture aucune base');ok(commits.length===2&&commits.every(c=>c.intention===intention),'L8 utilisation : même intention au réessai');await root.actualiser();ok(root.querySelector('[data-lot-id=lot] [data-role=restant-lot]').textContent.includes('2'),'L8 utilisation : restant mis à jour après commit seulement');
  }finally{root.dispose();root.remove();document.querySelector('[data-role=mouvement-lot]')?.dispatchEvent(new Event('cancel',{cancelable:true}));}
 }
 {
  const f=fixtureInventaireEcran(),preparations=[];f.service.preparerModification=async a=>{preparations.push(a);return{issue:'ok',intention:{}};};f.service.appliquer=async()=>({issue:'conserve',...f.historique});
  const root=await renderKitchen({}, {tab:'inventory'}, f.ctx,{service:f.service,getGeneration:()=>0});document.body.append(root);
  try{root.querySelector('[data-lot-id=ancien] [data-role=modifier-lot]').click();await attendre(()=>document.querySelector('[data-role=formulaire-lot]'));const dlg=document.querySelector('[data-role=formulaire-lot]');eq(preparations.length,0,'L8 ancien lot : ouvrir Modifier n’adopte rien');eq(dlg.querySelector('[name=remaining]').value,'3','L8 ancien lot : anciennes portions proposées à confirmer');eq(dlg.querySelector('[name=initial]').value,'','L8 ancien lot : quantité initiale inconnue préservée');dlg.querySelector('[data-role=enregistrer-lot]').click();await attendre(()=>!dlg.isConnected);eq(preparations[0].stock,{format:1,unit:'portion',initial:null,remaining:3,state:'available'},'L8 ancien lot : adoption explicitement confirmée seule');eq(preparations[0].patch,{},'L8 ancien lot : texte d’origine non reparsé ni réécrit');
  }finally{root.dispose();root.remove();}
 }
 {
  const f=fixtureInventaireEcran(),preparations=[];f.historique.affiche.lot.prepared_at='2026-10-20T16:00:00.000Z';f.historique.projection.dates.prepared={origine:'legacy',valeur:f.historique.affiche.lot.prepared_at,depassee:null};
  f.service.preparerModification=async a=>{preparations.push(a);return{issue:'ok',intention:{}};};f.service.appliquer=async()=>({issue:'conserve',...f.historique});
  const root=await renderKitchen({}, {tab:'inventory'}, f.ctx,{service:f.service,getGeneration:()=>0});document.body.append(root);
  try{root.querySelector('[data-lot-id=ancien] [data-role=modifier-lot]').click();await attendre(()=>document.querySelector('[data-role=formulaire-lot]'));const dlg=document.querySelector('[data-role=formulaire-lot]'),retirer=dlg.querySelector('[data-role=retirer-prepared_on]');ok(!!retirer,'L8 date héritée : geste explicite de retrait disponible');retirer?.click();dlg.querySelector('[data-role=enregistrer-lot]').click();await attendre(()=>!dlg.isConnected);ok(Object.hasOwn(preparations[0].patch,'prepared_on')&&preparations[0].patch.prepared_on===null,'L8 date héritée : retrait écrit null présent sans modifier ancien ISO');
  }finally{root.dispose();root.remove();}
 }
 {
  const f=fixtureInventaireEcran(),fin=structuredClone(f.lu);fin.projection.label='Lot terminé';fin.projection.etat='finished';fin.projection.quantite.remaining=0;fin.projection.actions={modifier:true,adopter:false,consommer:false,terminer:false,annuler:false};let liberer,appels=0;const attente=new Promise(r=>liberer=r),filtres=[];
  f.service.listerLots=async({filtre})=>{filtres.push(filtre);if(++appels===2)await attente;return{issue:'ok',lots:filtre==='termines'?[fin]:[f.lu],total:1};};const root=await renderKitchen({},{tab:'inventory'},f.ctx,{service:f.service,getGeneration:()=>0});document.body.append(root);
  try{const enCours=root.actualiser();await attendre(()=>appels===2);const filtre=root.querySelector('select[aria-label="Afficher les lots"]');filtre.value='termines';filtre.dispatchEvent(new Event('change'));liberer();await enCours;eq(filtres.at(-1),'termines','L8 filtres : dernier choix relu après lecture déjà en cours');ok(root.querySelector('[data-lot-id]')?.textContent.includes('Lot terminé'),'L8 filtres : contenu correspond au filtre affiché après changement rapide');}finally{liberer();root.dispose();root.remove();}
 }

}
