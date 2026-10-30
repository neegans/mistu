import {withRepo} from './sync-fixture.js';
import {creerServiceInventaire} from '../src/domain/inventaire-persistance.js';
import {CLE_EPOQUE_EDITEUR} from '../src/domain/brouillons-format.js';
const payload={label:'Soupe',quantity_text:'4 portions',location:'frigo',prepared_on:null,use_by_on:null,reheat_method:'',expected_quality:'',notes:'Texte\u0001exact',stock:{format:1,unit:'portion',initial:4,remaining:4,state:'available'}};
export async function runL8InventaireTransactionsTests({eq,ok}){
 for(const scenario of ['quota','owner','epoch','version','history','edition','generation'])await withRepo(async(repo,db)=>{
  await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'u1'}]}});
  const recipe={id:'tx-r',edition_id:'tx-e'},version={id:'tx-v',recipe_id:'tx-r'},edition={id:'tx-e'},history={id:'tx-h',recipe_id:'tx-r',recipe_version_id:'tx-v'};
  await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],book_editions:[edition],cook_history:[history]}});
  let generation=0;const d=creerServiceInventaire({repo,getGeneration:()=>generation}),portee=(await d.capturerPortee({owner_id:'u1'})).portee,cr=await d.ouvrirCreation({portee}),pre=await d.preparerCreation({portee,creation:cr.creation,affiche:{recipe,version,edition,history},payload});
  eq(pre.issue,'ok','L8 transaction '+scenario+' : préparation valide atteint le commit');if(pre.issue!=='ok')return;
  const mutate=db.mutate.bind(db),hook=db.onMutate;let atteint=false;
  if(scenario==='quota')db.onMutate=args=>{if(args.inventory_commands?.length){atteint=true;throw new DOMException('quota injecté','QuotaExceededError');}return hook?.(args);};
  else db.mutate=async args=>{if(args.inventory_commands&&!atteint){atteint=true;
   if(scenario==='owner')await mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'u2'}]}});
   if(scenario==='epoch')await mutate({origin:'device',puts:{sync_state:[{key:CLE_EPOQUE_EDITEUR,value:'autre-epoque'}]}});
   if(scenario==='version')await mutate({origin:'remote',puts:{recipe_versions:[{...version,recipe_id:'autre-recette'}]}});
   if(scenario==='history')await mutate({origin:'remote',puts:{cook_history:[{...history,recipe_version_id:'autre-version'}]}});
   if(scenario==='edition')await mutate({origin:'remote',puts:{book_editions:[{...edition,lifecycle_id:'cycle',trashed_at:null,trash_mode:null}]}});
   if(scenario==='generation')generation++;
  }return mutate(args);};
  try{const result=await d.appliquer({intention:pre.intention}),reason={quota:'quota_stockage',owner:'compte_change',epoch:'bibliotheque_remplacee',version:'source_changee',history:'source_changee',edition:'source_changee',generation:'contexte_change'}[scenario];
   ok(atteint,'L8 transaction '+scenario+' : course/panne injectée après préparation');eq(result.raison,reason,'L8 transaction '+scenario+' : refus exact');eq(await db.getAll('inventory'),[],'L8 transaction '+scenario+' : aucun demi-lot');eq(await db.getAll('outbox'),[],'L8 transaction '+scenario+' : aucune intention partielle');
   if(scenario==='quota'){db.onMutate=hook;const retry=await d.appliquer({intention:pre.intention});eq(retry.issue,'conserve','L8 quota : même intention réessayée');eq((await db.getAll('outbox')).length,1,'L8 quota : un envoi seulement');eq(retry.affiche.lot.notes,payload.notes,'L8 quota : saisie signée exacte conservée');}
  }finally{db.mutate=mutate;db.onMutate=hook;}
 });
}

export async function runL8InventaireRejeuTransactionsTests({eq,ok}){await withRepo(async(repo,db)=>{
 await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'u1'}]}});const d=creerServiceInventaire({repo,getGeneration:()=>0}),portee=(await d.capturerPortee({owner_id:'u1'})).portee,cr=await d.ouvrirCreation({portee}),p=await d.preparerCreation({portee,creation:cr.creation,affiche:{recipe:null,version:null,edition:null,history:null},payload});await d.appliquer({intention:p.intention});
 const commande=(await db.getAll('outbox'))[0].payload,options={baseAttendue:db,owner_id:'u1',library_epoch:portee.library_epoch,contexteValide:()=>true};
 eq((await repo.muterInventaire({commande,attendue:null},options)).deja,true,'L8 reçu transaction : rejoue effectivement la porte');
 const mutate=db.mutate.bind(db);let atteint=false;db.mutate=async args=>{if(args.inventory_commands&&!atteint){atteint=true;await mutate({origin:'remote',deletes:{inventory:[cr.id]}});}return mutate(args);};
 try{let raison=null;try{await repo.muterInventaire({commande,attendue:null},options);}catch(e){raison=e.code;}ok(atteint,'L8 reçu transaction : suppression après lecture du reçu');eq(raison,'stock_change','L8 reçu transaction : reçu disparu interdit une nouvelle application sans gardes');eq(await db.get('inventory',cr.id),undefined,'L8 reçu transaction : aucun lot recréé après disparition concurrente');}finally{db.mutate=mutate;}
 });}
