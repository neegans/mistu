import { withRepo } from './sync-fixture.js';
const appeler=async fn=>{try{return await fn();}catch(e){return {erreur:e.code||e.name};}};
export async function runL4BrouillonsTests({eq,ok}){
 await withRepo(async(repo,db)=>{
  ok(typeof repo.muterEditeur==='function','L4 porte : mutation atomique métier et brouillon disponible');
  if(typeof repo.muterEditeur!=='function')return;
  const ligne={key:'editor_library_epoch:v1',value:'epoque-test'};
  await repo.muterEditeur({internes:{puts:[ligne]}},{origin:'device',baseAttendue:db,contexteValide:()=>true});
  eq(await db.get('sync_state',ligne.key),ligne,'L4 porte : internes sans horodatage ajouté');
  const avant=await db.getAll('outbox');
  const r=await appeler(()=>repo.muterEditeur({internes:{puts:[{key:'user_id',value:'intrus'}]}},{origin:'device',baseAttendue:db,contexteValide:()=>true}));
  ok(r.erreur,'L4 porte : écriture propriétaire interdite');eq(await db.getAll('outbox'),avant,'L4 porte : interne jamais dans outbox');
  const refus=await appeler(()=>repo.muterEditeur({internes:{puts:[{...ligne,value:'autre'}]}},{origin:'device',baseAttendue:db,contexteValide:()=>false}));
  ok(refus.erreur,'L4 porte : contexte périmé refusé');eq((await db.get('sync_state',ligne.key)).value,'epoque-test','L4 porte : refus atomique');
 });
 await withRepo(async(repo,db)=>{
  const recipe={id:'lecture-editeur',original_title:'Recette',availability:'available',current_version_id:'source-editeur'};
  const version={id:recipe.current_version_id,recipe_id:recipe.id,ingredients:[],steps:[{text:'Cuire.'}]};await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
  const ligne=await repo.ouvrirImport({kind:'recette',recipe_id:recipe.id,editeur:{base_version_id:version.id,source_signature:'a'.repeat(64)}});
  eq([ligne.editor_base_version_id,ligne.editor_source_signature],[version.id,'a'.repeat(64)],'L4 journal : cible éditeur durable dès ouverture');
  const invalide=await appeler(()=>repo.ouvrirImport({kind:'index',editeur:{base_version_id:'x',source_signature:'x'}}));
  ok(invalide.erreur,'L4 journal : extension éditeur rejetée sur autre type');
 });
 let creer;try{({creerServiceBrouillons:creer}=await import('../src/domain/brouillons-editeur.js'));}catch{ok(false,'L4 service : brouillon durable disponible');return;}
 await withRepo(async(repo,db)=>{
  const recipe={id:'l4-r',original_title:'Titre original',display_title:'Soupe',availability:'available',current_version_id:'l4-v',source_page_ids:[]};
  const version={id:'l4-v',recipe_id:recipe.id,kind:'extraction',servings:2,ingredients:[{id:'i',source_text:'1 tomate',verification_state:'verified'}],steps:[{id:'s',text:'Cuire.',timers:[]}]};
  await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
  const service=creer({repo,getGeneration:()=>0}),scope=await service.capturerPortee({owner_id:null});ok(scope.issue==='ok','L4 ouverture : portée locale capturée');
  const o=await service.ouvrirBrouillon({kind:'recipe_version',intention:'correction',portee:scope.portee,affiche:{recipe,version}});ok(o.issue==='ok','L4 ouverture : modèle depuis source exacte');if(o.issue!=='ok')return;
  o.modele.metadata.display_title='Potage';
  const c=await service.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});eq(c.issue,'ok','L4 conservation : première transaction réussie');
  const relu=await creer({repo,getGeneration:()=>0}).lireBrouillon({id:c.id,portee:scope.portee});eq(relu.brouillon?.payload.metadata.display_title,'Potage','L4 reprise : saisie durable exacte');
  eq((await repo.get('recipes',recipe.id)).display_title,'Soupe','L4 brouillon : recette non publiée intacte');
  const concurrent=await service.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});eq(concurrent.raison,'revision_changee','L4 conservation : ancien écrivain refusé');
 });
 await withRepo(async(repo,db)=>{
  const s=creer({repo,getGeneration:()=>0}),{portee}=await s.capturerPortee({owner_id:null});
  const inconnu={key:'editor_draft:v1:futur',value:{format:99,id:'futur',owner_id:null,database_name:db.name,library_epoch:portee.library_epoch,revision:4,payload:{metadata:{display_title:'Texte à récupérer'},contenu:{steps:[{text:'Remuer.'}]},secret:'NON EXPORTABLE'}}};
  await db.mutate({origin:'device',puts:{sync_state:[inconnu,{...inconnu,key:'editor_draft:v1:autre',value:{...inconnu.value,id:'autre',owner_id:'autre-compte'}}]}});
  const liste=await s.listerBrouillons({portee,inclureDetaches:true});eq(liste.brouillons?.map(x=>[x.id,x.etat]),[['futur','invalide']],'L4 récupération : ancien format visible, autre propriétaire caché');
  const texte=await s.exporterTexteBrouillon({id:'futur',portee});ok(texte.texte?.includes('Texte à récupérer')&&!texte.texte.includes('NON EXPORTABLE'),'L4 récupération : texte connu seul exporté');
  const item=liste.brouillons?.[0];if(item){eq((await s.ecarterBrouillon({id:item.id,portee,expectedRevision:item.revision,attendu:item.attendu})).issue,'ok','L4 récupération : abandon exact du format inconnu');eq(await db.get('sync_state',inconnu.key),undefined,'L4 récupération : quota libéré par abandon explicite');}
 });
 await withRepo(async(repo,db)=>{const s=creer({repo,getGeneration:()=>0}),{portee}=await s.capturerPortee({owner_id:null}),o=await s.ouvrirBrouillon({kind:'recipe_new',intention:'extraction',portee,affiche:{}});o.modele.metadata.original_title='Avant compte';o.modele.contenu.steps=[{id:'s',text:'Texte anonyme'}];const c=await s.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'premier'}]}});const nouveau=(await s.capturerPortee({owner_id:'premier'})).portee,liste=await s.listerBrouillons({portee:nouveau}),lu=await s.lireBrouillon({id:c.id,portee:nouveau});eq(liste.brouillons?.[0]?.etat,'anonyme','L4 premier compte : ancien brouillon proposé sans réattribution');eq([lu.etat,!!lu.session],['anonyme',false],'L4 premier compte : aucune session directement publiable');const comp=await s.comparerBrouillon({id:c.id,portee:nouveau,expectedRevision:c.revision});if(!comp.comparaison)return;
  eq((await s.reprendreSurBaseCourante({comparaison:comp.comparaison,choixRepris:['metadata.original_title','contenu.steps'],portee:nouveau})).raison,'compte_change','L4 premier compte : reprise exige consentement explicite');const reprise=await s.reprendreSurBaseCourante({comparaison:comp.comparaison,choixRepris:['metadata.original_title','contenu.steps'],portee:nouveau,reprendreAnonyme:true});eq(reprise.issue,'ok','L4 premier compte : choix explicite crée session nouvelle');const saved=await s.conserverBrouillon({session:reprise.session,expectedRevision:null,payload:reprise.modele});eq((await repo.get('sync_state','editor_draft:v1:'+saved.id)).value.owner_id,'premier','L4 premier compte : copie détenue par compte accepté');eq((await repo.get('sync_state','editor_draft:v1:'+c.id)).value.owner_id,null,'L4 premier compte : original anonyme conservé');
 });

}
