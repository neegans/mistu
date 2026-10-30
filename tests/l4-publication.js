import {withRepo} from './sync-fixture.js';
import {creerServiceBrouillons} from '../src/domain/brouillons-editeur.js';
import {mettreALaCorbeille,restaurerRecette} from '../src/domain/corbeille.js';
const fixture=()=>{const recipe={id:'pub-r',original_title:'Original',display_title:'Soupe',availability:'available',current_version_id:'pub-v',source_page_ids:[]};return{recipe,version:{id:'pub-v',recipe_id:recipe.id,kind:'extraction',servings:2,ingredients:[{id:'i',source_text:'1 tomate',verification_state:'verified'}],steps:[{id:'s',text:'Cuire.',timers:[]}],verification_state:'verified',provenance:{}}};};
async function ouvrir(repo,db){const f=fixture();await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version]}});const s=creerServiceBrouillons({repo,getGeneration:()=>0}),{portee}=await s.capturerPortee({owner_id:null}),o=await s.ouvrirBrouillon({kind:'recipe_version',intention:'correction',portee,affiche:f});return{...f,s,portee,...o};}
async function conserver(f,changer){changer(f.modele);const c=await f.s.conserverBrouillon({session:f.session,expectedRevision:null,payload:f.modele});if(c.issue!=='ok')throw Error(JSON.stringify(c));return c;}
export async function runL4PublicationTests({eq,ok}){
 const run=async(n,fn)=>{try{await withRepo(fn);}catch(e){ok(false,'L4 publication '+n+' : '+(e.stack||e));}};
 await run('métadonnées',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.metadata.display_title='Potage');
  const p=await f.s.preparerPublication({id:c.id,portee:f.portee,expectedRevision:c.revision});eq(p.issue,'ok','L4 metadata : publication préparée');if(!p.plan)return;
  await db.mutate({origin:'remote',puts:{recipes:[{...f.recipe,photo_sha256:'photo',personal_notes:'Concurrente',favorite:true}]}});
  const pub=await f.s.publierBrouillon({plan:p.plan});eq(pub.issue,'publie','L4 metadata : commit réel');const r=await repo.get('recipes',f.recipe.id);
  eq([r.original_title,r.display_title,r.photo_sha256,r.personal_notes,r.favorite,r.current_version_id],['Original','Potage','photo','Concurrente',true,'pub-v'],'L4 metadata : original et champs non touchés intacts');
  eq((await repo.all('recipe_versions')).length,1,'L4 metadata : aucune version inutile');
  eq((await f.s.lireBrouillon({id:c.id,portee:f.portee})).etat,'committed','L4 publication : reçu durable sans saisie');
 });
 await run('double publication',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.contenu.steps[0].text='Cuire doucement.');
  const args={id:c.id,portee:f.portee,expectedRevision:c.revision},a=await f.s.preparerPublication(args),b=await f.s.preparerPublication(args);
  eq((await f.s.publierBrouillon({plan:a.plan})).issue,'publie','L4 correction : première publication');const before=await repo.all('outbox');
  eq((await f.s.publierBrouillon({plan:b.plan})).issue,'deja_publie','L4 reçu : second plan déjà préparé ne rejoue rien');
  eq(await repo.all('outbox'),before,'L4 reçu : aucun nouvel événement pour réessai');eq((await repo.all('recipe_versions')).length,2,'L4 correction : une seule version ajoutée');
  eq((await f.s.preparerPublication(args)).issue,'deja_publie','L4 reçu : rechargement retrouve accusé perdu');
 });
 await run('source tardive',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.contenu.steps[0].text='Nouvelle saisie');const p=await f.s.preparerPublication({id:c.id,portee:f.portee,expectedRevision:c.revision});
  await db.mutate({origin:'remote',puts:{recipe_versions:[{...f.version,steps:[{id:'s',text:'Source changée'}]}]}});const before=await repo.all('outbox'),r=await f.s.publierBrouillon({plan:p.plan});eq(r.issue,'refuse','L4 source : modification entre préparation/commit refuse');eq((await repo.all('recipe_versions')).length,1,'L4 source : aucune version partielle');eq(await repo.all('outbox'),before,'L4 source : aucune outbox partielle');const lu=await f.s.lireBrouillon({id:c.id,portee:f.portee});eq(lu.brouillon?.payload.contenu.steps[0].text,'Nouvelle saisie','L4 source : saisie récupérable');eq(lu.etat,'bloque','L4 source : reprise périmée annoncée avant Enregistrer');
 });
 await run('pointeur ancien',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.contenu.steps[0].text='Correction');const autre={...f.version,id:'autre-v'};await db.mutate({origin:'remote',puts:{recipe_versions:[autre],recipes:[{...f.recipe,current_version_id:autre.id}]}});
  eq((await f.s.preparerPublication({id:c.id,portee:f.portee,expectedRevision:c.revision})).raison,'pointeur_change','L4 pointeur : nouveau courant signalé');const comparaison=await f.s.comparerBrouillon({id:c.id,portee:f.portee,expectedRevision:c.revision});
  const retired=(await mettreALaCorbeille(await repo.get('recipes',f.recipe.id),{repo})).recipe;await restaurerRecette(retired,{repo});
  const choix=await f.s.choisirVersionCourante({session:f.session,expectedRevision:c.revision,comparaison:comparaison.comparaison,choix:'preserve'});
  eq(choix.issue,'refuse','L4 pointeur : choix ne recapture pas cycle après restauration');eq(choix.raison,'cycle_change','L4 pointeur : refus vient du cycle effectivement contrôlé');
 });
 await run('deux onglets',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.metadata.display_title='Local');const s2=creerServiceBrouillons({repo,getGeneration:()=>0}),lu=await s2.lireBrouillon({id:c.id,portee:f.portee});
  const a=structuredClone(f.modele),b=structuredClone(lu.brouillon.payload);a.metadata.display_title='Onglet A';b.metadata.display_title='Onglet B';
  const rs=await Promise.all([f.s.conserverBrouillon({session:f.session,expectedRevision:c.revision,payload:a}),s2.conserverBrouillon({session:lu.session,expectedRevision:c.revision,payload:b})]);
  eq(rs.map(r=>r.issue).sort(),['ok','refuse'],'L4 CAS : un seul écrivain concurrent');
  const cp=await s2.copierBrouillon({session:lu.session,payload:b});eq(cp.issue,'ok','L4 CAS : copie volontaire du texte concurrent');
  const sauve=await s2.conserverBrouillon({session:cp.session,expectedRevision:null,payload:cp.modele});ok(sauve.id!==c.id,'L4 copie : identifiant distinct sans écraser premier brouillon');
  const originale=(await f.s.lireBrouillon({id:c.id,portee:f.portee})).brouillon,nouvelle=(await s2.lireBrouillon({id:sauve.id,portee:f.portee})).brouillon;
  eq(nouvelle.base_source_signature,originale.base_source_signature,'L4 copie : bases originales intactes sans relecture');ok(nouvelle.publication.operation_id!==originale.publication.operation_id,'L4 copie : nouvelle intention réservée');
 });
 await run('borne publication',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.contenu.notes='é'.repeat(270000)),avant=await repo.all('outbox'),p=await f.s.preparerPublication({id:c.id,portee:f.portee,expectedRevision:c.revision}),r=p.plan?await f.s.publierBrouillon({plan:p.plan}):p;
  eq(r.raison,'limite_publication','L4 publication : ligne métier trop grande refusée avant écriture');eq((await repo.all('recipe_versions')).length,1,'L4 publication : aucune version bloquée dans synchronisation');eq(await repo.all('outbox'),avant,'L4 publication : aucune capture pour contenu trop grand');eq((await f.s.lireBrouillon({id:c.id,portee:f.portee})).brouillon?.payload.contenu.notes.length,270000,'L4 publication : grand brouillon intégral récupérable');
 });
 await run('panne avant commit',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.contenu.steps[0].text='À conserver'),p=await f.s.preparerPublication({id:c.id,portee:f.portee,expectedRevision:c.revision}),avant=await repo.all('outbox'),capture=db.onMutate;
  db.onMutate=args=>{const out=capture(args);if(args.origin==='local'&&args.puts.recipe_versions?.length)throw new DOMException('Panne injectée','QuotaExceededError');return out;};
  try{eq((await f.s.publierBrouillon({plan:p.plan})).issue,'echec','L4 commit : panne réelle indiquée');}finally{db.onMutate=capture;}
  eq((await repo.all('recipe_versions')).length,1,'L4 commit : version annulée avec panne');eq(await repo.all('outbox'),avant,'L4 commit : capture annulée avec panne');eq((await f.s.lireBrouillon({id:c.id,portee:f.portee})).etat,'reprenable','L4 commit : pas de reçu fictif');eq((await f.s.publierBrouillon({plan:p.plan})).issue,'publie','L4 commit : même intention réessayable après panne');
 });
 await run('association livre',async(repo,db)=>{const book={id:'b',title:'Livre'},edition={id:'e',book_id:'b'},s=creerServiceBrouillons({repo,getGeneration:()=>0});await db.mutate({origin:'remote',puts:{books:[book,{id:'b2',title:'Autre'}],book_editions:[edition]}});const {portee}=await s.capturerPortee({owner_id:null}),o=await s.ouvrirBrouillon({kind:'book_metadata',intention:'metadata',portee,affiche:{book,edition}});o.modele.book.title='Saisie';const c=await s.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele}),p=await s.preparerPublication({id:c.id,portee,expectedRevision:c.revision});await db.mutate({origin:'remote',puts:{book_editions:[{...edition,book_id:'b2'}]}});const avant=await repo.all('outbox'),r=await s.publierBrouillon({plan:p.plan});eq(r.raison,'association_changee','L4 livre : parent changé après préparation refusé au commit');eq((await repo.get('books','b')).title,'Livre','L4 livre : ancien parent intact');eq(await repo.all('outbox'),avant,'L4 livre : aucune capture partielle');eq((await s.lireBrouillon({id:c.id,portee})).brouillon.payload.book.title,'Saisie','L4 livre : saisie retenue après refus');
 });
 await run('forme altérée',async(repo,db)=>{const f=await ouvrir(repo,db),c=await conserver(f,p=>p.contenu.steps[0].text='Texte récupérable'),key='editor_draft:v1:'+c.id,initial=await db.get('sync_state',key);
  for(const [nom,alterer] of [['magasin',r=>r.base_source_signature.records[0].store='magasin_inconnu'],['projection',r=>r.base_source_signature.records[0].projection='autre'],['champ',r=>r.changed_fields=['contenu.intrus']],['association',r=>r.base_association.alarme='intrus']]){const row=structuredClone(initial);alterer(row.value);await db.mutate({origin:'device',puts:{sync_state:[row]}});eq((await f.s.lireBrouillon({id:c.id,portee:f.portee})).etat,'invalide','L4 format : '+nom+' altéré récupérable');eq((await f.s.listerBrouillons({portee:f.portee})).brouillons?.[0]?.etat,'invalide','L4 format : '+nom+' ne masque pas liste');}
 });

 for(const mode of ['compte','epoque','generation'])await run('contexte tardif '+mode,async(repo,db)=>{let generation=0;const f=await ouvrir(repo,db),sauve=await conserver(f,p=>p.metadata.display_title='Tardif');f.s=creerServiceBrouillons({repo,getGeneration:()=>generation});const lu=await f.s.lireBrouillon({id:sauve.id,portee:f.portee});f.session=lu.session;const c={id:lu.brouillon.id,revision:lu.brouillon.revision},p=await f.s.preparerPublication({id:c.id,portee:f.portee,expectedRevision:c.revision}),avant=await repo.all('outbox'),mutate=db.mutate.bind(db);let once=true;db.mutate=async args=>{if(once&&args.origin==='local'){once=false;if(mode==='generation')generation++;else await mutate({origin:'device',puts:{sync_state:[{key:mode==='compte'?'user_id':'editor_library_epoch:v1',value:'nouveau'}]}});}return mutate(args);};let r;try{r=await f.s.publierBrouillon({plan:p.plan});}finally{db.mutate=mutate;}eq(r.raison,mode==='compte'?'compte_change':mode==='epoque'?'bibliotheque_remplacee':'contexte_change','L4 transaction : '+mode+' changé au dernier moment refuse exactement');eq((await repo.get('recipes',f.recipe.id)).display_title,'Soupe','L4 transaction : '+mode+' ne modifie pas recette');eq(await repo.all('outbox'),avant,'L4 transaction : '+mode+' ne produit pas capture');
 });

}
