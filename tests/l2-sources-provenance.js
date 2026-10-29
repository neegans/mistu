import { withRepo } from './sync-fixture.js';

const at='2026-10-29T12:00:00.000Z';
const retiree={id:'edition-retiree',book_id:'livre',lifecycle_id:'retrait',trashed_at:at,trash_mode:'with_recipes'};
const active={id:'edition-active',book_id:'livre'};
const associations={source_documents:['edition_id','scan_session_id'],source_pages:['edition_id','document_id'],scan_sessions:['edition_id']};
const fixture=edition_id=>({
 books:[{id:'livre',title:'Cuisine'}],book_editions:[retiree,active],
 scan_sessions:[{id:'session-source',edition_id,page_ids:['page-source'],document_ids:['document-source'],recipe_ids:['recette-source'],status:'done'}],
 source_documents:[{id:'document-source',edition_id,scan_session_id:'session-source',source_type:'photo',sha256:'a'.repeat(64)}],
 source_pages:[{id:'page-source',edition_id,document_id:'document-source',printed_page:10,sha256:'a'.repeat(64)}],
 recipes:[{id:'recette-source',edition_id,source_page_ids:['page-source']}],
});
const magasins=['books','book_editions','recipes','source_documents','source_pages','scan_sessions','files','outbox'];
export async function runL2SourcesProvenanceTests({eq,ok}) {
 const scenario=async(n,fn)=>{try{await withRepo(fn);}catch(e){ok(false,n+': '+(e.stack||e));}};
 for(const store of Object.keys(associations))for(const [origine,cible] of [[retiree.id,active.id],[retiree.id,null],[active.id,retiree.id],[active.id,null]])await scenario(store+' '+origine+' → '+cible,async(repo,db)=>{
  const donnees=fixture(origine);await db.mutate({puts:donnees,origin:'remote'});const ligne=donnees[store][0],avant=await db.getSnapshot(magasins);
  let erreur=null;try{await repo.saveBatch({[store]:[{...ligne,edition_id:cible}]},{fichiers:[{sha256:'b'.repeat(64),blob:new Blob(['pas d’octet orphelin'],{type:'image/jpeg'})}]});}catch(e){erreur=e.code;}
  eq(erreur,'source_modifiee',`L2 provenance ${store} : ${origine} vers ${String(cible)} refusé nommément`);
  eq(await db.getSnapshot(magasins),avant,`L2 provenance ${store} : source, relations, octets et file inchangés après refus`);
 });
 for(const [store,champ] of [['source_documents','scan_session_id'],['source_pages','document_id']])for(const cible of['autre-parent',null])await scenario(store+' '+champ,async(repo,db)=>{
  const donnees=fixture(active.id);await db.mutate({puts:donnees,origin:'remote'});const ligne=donnees[store][0],avant=await db.getSnapshot(magasins);
  let erreur=null;try{await repo.saveBatch({},{conditions:{[store]:[{key:ligne.id,fusion:current=>({...current,[champ]:cible})}]}});}catch(e){erreur=e.code;}
  eq(erreur,'source_modifiee',`L2 provenance ${store} : fusion ne change pas ${champ} vers ${String(cible)}`);
  eq(await db.getSnapshot(magasins),avant,'L2 provenance : aucun déplacement par fusion ni capture partielle');
 });
 await scenario('Copie ne portant plus son parent',async(repo,db)=>{
  const donnees=fixture(retiree.id);await db.mutate({puts:donnees,origin:'remote'});const avant=await db.getSnapshot(magasins);let refuse=false;
  try{await repo.save('source_pages',{id:'page-source',printed_page:99});}catch(e){refuse=e.code==='source_modifiee';}
  ok(refuse,'L2 provenance : omission du parent dans un put ne détache pas une source retirée');eq(await db.getSnapshot(magasins),avant,'L2 provenance : put incomplet ne perd aucune relation');
 });
 await scenario('Association changée pendant préparation',async(repo,db)=>{
  const donnees=fixture(active.id);await db.mutate({puts:donnees,origin:'remote'});const ligne=donnees.source_pages[0],mutate=db.mutate.bind(db);let touche=false;
  db.mutate=async args=>{if(!touche){touche=true;await mutate({puts:{source_pages:[{...ligne,document_id:'arrive-ailleurs'}]},origin:'remote'});}return mutate(args);};
  let refuse=false;try{await repo.save('source_pages',{...ligne,printed_page:99});}catch(e){refuse=e.code==='source_modifiee';}
  ok(refuse,'L2 provenance : association revalidée dans la transaction finale');eq((await repo.get('source_pages',ligne.id)).document_id,'arrive-ailleurs','L2 provenance : parent concurrent non écrasé');eq((await repo.get('source_pages',ligne.id)).printed_page,10,'L2 provenance : aucun champ appliqué après conflit de parent');
 });
 await scenario('Correction ordinaire sous mêmes parents',async(repo,db)=>{
  const donnees=fixture(active.id);await db.mutate({puts:donnees,origin:'remote'});
  await repo.save('source_pages',{...donnees.source_pages[0],printed_page:11});
  await repo.saveBatch({},{conditions:{source_documents:[{key:'document-source',fusion:r=>({...r,original_filename:'photo corrigée.jpg'})}]}});
  eq([(await repo.get('source_pages','page-source')).printed_page,(await repo.get('source_documents','document-source')).original_filename],[11,'photo corrigée.jpg'],'L2 provenance : correction active conservant ses parents autorisée');
 });
 for(const store of Object.keys(associations))await scenario('Création par fusion seule '+store,async(repo,db)=>{
  const donnees=fixture(retiree.id);await db.mutate({puts:donnees,origin:'remote'});const avant=await db.getSnapshot(magasins);let type=null;
  try{await repo.saveBatch({},{conditions:{[store]:[{key:'source-nouvelle',fusion:()=>({...donnees[store][0],id:'source-nouvelle'})}]}});}catch(e){type=e.name;}
  eq(type,'TypeError',`L2 provenance ${store} : fusion seule d’une source absente refusée`);eq(await db.getSnapshot(magasins),avant,'L2 provenance : création non déclarée n’écrit aucune source ni envoi');
 });
 await scenario('Création déclarée modifiée par fusion',async(repo,db)=>{
  const donnees=fixture(active.id);await db.mutate({puts:donnees,origin:'remote'});const neuve={id:'page-nouvelle',edition_id:null,document_id:'doc-libre'},avant=await db.getSnapshot(magasins);let refuse=false;
  try{await repo.saveBatch({source_pages:[neuve]},{conditions:{source_pages:[{key:neuve.id,fusion:()=>({...neuve,edition_id:retiree.id})}]}});}catch(e){refuse=e.code==='source_modifiee';}
  ok(refuse,'L2 provenance : fusion d’une création ne remplace pas le parent déclaré');eq(await db.getSnapshot(magasins),avant,'L2 provenance : parent substitué ne crée aucun lien hors garde');
 });
}
