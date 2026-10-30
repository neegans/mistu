import {withRepo} from './sync-fixture.js';
export async function runL6DepotTraductionsTests({eq,ok}){
 let creer;try{({creerDepotTraductions:creer}=await import('../src/domain/depot-traductions.js'));}catch{ok(false,'L6 dépôt : conservation durable disponible');return;}
 await withRepo(async(repo,db)=>{
  const recipe={id:'l6-r',original_title:'Bread',original_language:'en',availability:'available',current_version_id:'l6-v'},version={id:'l6-v',recipe_id:'l6-r',ingredients:[{id:'i',name_text:'flour',source_text:'100 g flour'}],steps:[{id:'s',text:'Mix.\nBake for 20 min.'}]};
  await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
  const d=creer({repo,getGeneration:()=>0}),p=await d.capturerPortee({owner_id:null});eq(p.issue,'ok','L6 dépôt : portée durable');
  const o=await d.ouvrirTraduction({portee:p.portee,affiche:{recipe,version,traductions:[]},locale:'fr'});eq(o.issue,'ok','L6 dépôt : ouverture source exacte');if(o.issue!=='ok')return;
  eq(o.modele.segments.length,4,'L6 dépôt : squelette complet');o.modele.segments[0].text='Pain';
  const saved=await d.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});eq(saved.issue,'ok','L6 dépôt : conservation initiale');
  eq((await db.getAll('recipe_translations')).length,0,'L6 dépôt : brouillon sans publication');
  const d2=creer({repo,getGeneration:()=>0}),p2=(await d2.capturerPortee({owner_id:null})).portee,lu=await d2.lireBrouillon({id:saved.id,portee:p2});eq(lu.modele?.segments[0].text,'Pain','L6 dépôt : reprise après nouveau service');
  eq((await d.listerBrouillons({portee:p.portee})).brouillons?.[0]?.kind,'recipe_translation','L6 dépôt : liste typée');
  const old=await d.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});eq(old.raison,'revision_changee','L6 dépôt : deux onglets CAS');
  const copy=await d2.copierBrouillon({session:lu.session,payload:{...lu.modele,segments:lu.modele.segments.map((s,i)=>i? s:{...s,text:'Mon pain'})}});eq(copy.issue,'ok','L6 dépôt : copie garde bases initiales');eq((await d2.conserverBrouillon({session:copy.session,expectedRevision:null,payload:copy.modele})).issue,'ok','L6 dépôt : copie indépendante durable');
  const prep=await d.preparerPublicationTraduction({session:o.session,expectedRevision:saved.revision,payload:o.modele});eq(prep.issue,'ok','L6 dépôt : préparer publication');if(prep.issue!=='ok')return;
  const pub=await d.publierTraduction({plan:prep.plan});eq(pub.issue,'publie','L6 dépôt : publication atomique');eq((await db.getAll('recipe_translations'))[0]?.translated_content.segments[0].text,'Pain','L6 dépôt : texte publié');eq((await repo.get('recipes',recipe.id)).original_title,'Bread','L6 dépôt : original intact');
  eq((await d.publierTraduction({plan:prep.plan})).issue,'deja_publie','L6 dépôt : reçu exact avant anciennes conditions');
 });
 await withRepo(async(repo,db)=>{
  const recipe={id:'cmp-r',original_title:'Bread',availability:'available'},version={id:'cmp-v',recipe_id:'cmp-r',ingredients:[],steps:[]};await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});const d=creer({repo,getGeneration:()=>0}),p=(await d.capturerPortee({owner_id:null})).portee,o=await d.ouvrirTraduction({portee:p,affiche:{recipe,version,traductions:[]},locale:'fr'});o.modele.segments[0].text='Mon pain';const save=await d.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});
  await db.mutate({origin:'device',puts:{sync_state:[{key:'user_id',value:'u1'}]}});const named=(await d.capturerPortee({owner_id:'u1'})).portee;eq((await d.lireBrouillon({id:save.id,portee:named})).etat,'anonyme','L6 comparaison : saisie anonyme récupérable');const comp=await d.comparerBrouillon({id:save.id,portee:named,expectedRevision:save.revision});eq(comp.anonyme,true,'L6 comparaison : consentement explicite annoncé');eq(comp.courantAffichable.champs[0].saisie,'Mon pain','L6 comparaison : saisie affichable');const reprise=await d.reprendreBrouillon({comparaison:comp.comparaison,choix:[o.source.segments[0].ref],portee:named,reprendreAnonyme:true});eq(reprise.issue,'ok','L6 comparaison : reprise volontaire permise');eq(reprise.modele?.segments[0].text,'Mon pain','L6 comparaison : texte repris exact');eq((await db.get('sync_state','editor_draft:v1:'+save.id)).value.owner_id,null,'L6 comparaison : ancien propriétaire inchangé');
 });

}
