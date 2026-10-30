import {withRepo} from './sync-fixture.js';
import {creerServiceBrouillons} from '../src/domain/brouillons-editeur.js';
import {LIMITES_BROUILLONS,octetsEditeur,CLE_EPOQUE_EDITEUR,PREFIXE_BROUILLON} from '../src/domain/brouillons-format.js';
import {createArchive,inspectArchive,applyArchive} from '../src/domain/backup.js';
const date='2026-10-29T12:00:00.000Z';
async function brouillon(repo){const s=creerServiceBrouillons({repo,getGeneration:()=>0,maintenant:()=>date}),{portee}=await s.capturerPortee({owner_id:null}),o=await s.ouvrirBrouillon({kind:'recipe_new',intention:'extraction',portee,affiche:{}});o.modele.metadata.original_title='Manuelle';o.modele.contenu.notes='a';const c=await s.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});if(c.issue!=='ok')throw Error(JSON.stringify(c));return{s,portee,o,c,row:await repo.get('sync_state',PREFIXE_BROUILLON+c.id)};}
function remplir(row,taille){const r=structuredClone(row);r.value.payload.contenu.notes='';const n=taille-octetsEditeur(r);if(n<0)throw Error('Borne impossible');r.value.payload.contenu.notes='é'.repeat(Math.floor(n/2))+'x'.repeat(n%2);return r;}
const tenter=async fn=>{try{await fn();return'ok';}catch(e){return typeof e.code==='string'?e.code:e.name;}};
export async function runL4LimitesArchivesTests({eq,ok}){
 const run=async(n,fn)=>{try{await withRepo(fn);}catch(e){ok(false,'L4 limites '+n+' : '+(e.stack||e));}};
 await run('ligne exacte',async(repo,db)=>{const f=await brouillon(repo),r=remplir(f.row,LIMITES_BROUILLONS.ligne);r.value.revision=2;
  eq(octetsEditeur(r),LIMITES_BROUILLONS.ligne,'L4 quota : enveloppe multioctet exacte 2Mio');
  const c=await f.s.conserverBrouillon({session:f.o.session,expectedRevision:1,payload:r.value.payload});eq(c.issue,'ok','L4 quota : borne exacte conservée');eq(octetsEditeur(await repo.get('sync_state',f.row.key)),LIMITES_BROUILLONS.ligne,'L4 quota : aucune date ajoutée après mesure');
  r.value.payload.contenu.notes+='x';eq((await f.s.conserverBrouillon({session:f.o.session,expectedRevision:2,payload:r.value.payload})).raison,'limite_brouillon','L4 quota : borne+1 refuse sans troncature');
  eq((await repo.get('sync_state',f.row.key)).value.revision,2,'L4 quota : refus garde dernière révision');
 });
 await run('total concurrent',async(repo,db)=>{const f=await brouillon(repo),rows=[];let reste=LIMITES_BROUILLONS.total;
  for(let i=0;i<5;i++){const r=structuredClone(f.row);r.key=PREFIXE_BROUILLON+'total-'+i;r.value.id='total-'+i;const taille=i===4?reste:Math.floor(LIMITES_BROUILLONS.total/5);rows.push(remplir(r,taille));reste-=taille;}
  await repo.muterEditeur({internes:{puts:rows,deletes:[f.row.key]}},{origin:'device',baseAttendue:db,contexteValide:()=>true});eq((await repo.all('sync_state')).filter(r=>r.key.startsWith(PREFIXE_BROUILLON)).reduce((n,r)=>n+octetsEditeur(r),0),LIMITES_BROUILLONS.total,'L4 total : borne exacte 8Mio');
  const plus=structuredClone(rows[0]);plus.value.payload.contenu.notes+='x';eq(await tenter(()=>repo.muterEditeur({internes:{puts:[plus]}},{origin:'device',baseAttendue:db,contexteValide:()=>true})),'limite_totale','L4 total : +1 refus atomique');
  const petits=rows.map(r=>remplir(r,1500000));await repo.muterEditeur({internes:{puts:petits}},{origin:'device',baseAttendue:db,contexteValide:()=>true});
  const candidats=['A','B'].map(id=>{const r=structuredClone(f.row);r.key=PREFIXE_BROUILLON+id;r.value.id=id;return remplir(r,600000);});
  const result=await Promise.all(candidats.map(r=>tenter(()=>repo.muterEditeur({internes:{puts:[r]}},{origin:'device',baseAttendue:db,contexteValide:()=>true}))));eq(result.sort(),['limite_totale','ok'],'L4 quota : deux clés concurrentes ne franchissent pas ensemble total');
  const debut=performance.now();await createArchive(db);ok(performance.now()-debut<20000,'L4 archive : snapshot environ8Mio termine sous20s');
 });
 await run('nombre',async(repo,db)=>{const f=await brouillon(repo),rows=Array.from({length:32},(_,i)=>{const r=structuredClone(f.row);r.key=PREFIXE_BROUILLON+'n-'+i;r.value.id='n-'+i;return r;});await repo.muterEditeur({internes:{puts:rows,deletes:[f.row.key]}},{origin:'device',baseAttendue:db,contexteValide:()=>true});
  const r=structuredClone(f.row);eq(await tenter(()=>repo.muterEditeur({internes:{puts:[r]}},{origin:'device',baseAttendue:db,contexteValide:()=>true})),'limite_nombre','L4 quota : 33e brouillon refusé sans éviction');
 });
 await run('archive époque',async(repo,db)=>{const f=await brouillon(repo),archive=await createArchive(db),inspection=await inspectArchive(await archive.blob.arrayBuffer());
  ok(inspection.ok,'L4 archive : bibliothèque inspectée');ok(!JSON.stringify(inspection.payload).includes(PREFIXE_BROUILLON),'L4 archive : aucun brouillon dans contenu réel');
  await applyArchive(db,inspection,{mode:'merge'});eq((await repo.get('sync_state',CLE_EPOQUE_EDITEUR)).value,f.portee.library_epoch,'L4 archive : fusion préserve époque');
  await applyArchive(db,inspection,{mode:'replace'});ok((await repo.get('sync_state',CLE_EPOQUE_EDITEUR)).value!==f.portee.library_epoch,'L4 archive : remplacement change époque dans transaction');
  eq((await f.s.conserverBrouillon({session:f.o.session,expectedRevision:1,payload:f.o.modele})).raison,'bibliotheque_remplacee','L4 archive : ancienne saisie ne se sauve pas sur nouvelle époque');
  const {portee}=await f.s.capturerPortee({owner_id:null});eq((await f.s.lireBrouillon({id:f.c.id,portee})).etat,'detache','L4 archive : ancien texte récupérable détaché');
  await repo.clearDevice();eq((await repo.all('sync_state')).filter(r=>r.key.startsWith(PREFIXE_BROUILLON)||r.key===CLE_EPOQUE_EDITEUR),[],'L4 effacement : brouillons et époque supprimés ensemble');
 });
 await run('sources près512Kio',async(repo,db)=>{const recipe={id:'grand-r',original_title:'Original',display_title:'é'.repeat(245000),availability:'available',current_version_id:'grand-v',source_page_ids:[]},version={id:'grand-v',recipe_id:'grand-r',kind:'extraction',ingredients:[],steps:[{id:'s',text:'"\né'.repeat(80000)}]};
  ok(octetsEditeur(recipe)<524288&&octetsEditeur(version)<524288,'L4 grande recette : chaque ligne source sous512Kio');await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version]}});
  const s=creerServiceBrouillons({repo,getGeneration:()=>0}),{portee}=await s.capturerPortee({owner_id:null}),o=await s.ouvrirBrouillon({kind:'recipe_version',intention:'correction',portee,affiche:{recipe,version}});o.modele.contenu.steps[0].text+=' Fin.';const c=await s.conserverBrouillon({session:o.session,expectedRevision:null,payload:o.modele});eq(c.issue,'ok','L4 grande recette : correction complète conservée');
  const lu=await s.lireBrouillon({id:c.id,portee});eq(lu.brouillon?.payload.contenu.steps[0].text,version.steps[0].text+' Fin.','L4 grande recette : reprise sans troncature');ok(c.octets<2097152,'L4 grande recette : modèle complet sous2Mio');
  const book={id:'grand-b',title:'é'.repeat(245000)},edition={id:'grand-e',book_id:'grand-b',publisher:'é'.repeat(245000),language:'fr'};await db.mutate({origin:'remote',puts:{books:[book],book_editions:[edition]}});const ob=await s.ouvrirBrouillon({kind:'book_metadata',intention:'metadata',portee,affiche:{book,edition}});ob.modele.book.author='Auteur';const cb=await s.conserverBrouillon({session:ob.session,expectedRevision:null,payload:ob.modele});eq(cb.issue,'ok','L4 grand livre : livre+édition complets conservés');ok(cb.octets<2097152,'L4 grand livre : modèle sous2Mio sans sources en double');
 });
 await run('rétention reçus',async(repo,db)=>{const f=await brouillon(repo);f.o.modele.contenu.steps=[{id:'s',text:'Cuire.'}];const sauve=await f.s.conserverBrouillon({session:f.o.session,expectedRevision:1,payload:f.o.modele}),p=await f.s.preparerPublication({id:f.c.id,portee:f.portee,expectedRevision:sauve.revision}),pub=await f.s.publierBrouillon({plan:p.plan}),rows=[];for(let i=0;i<128;i++){const d=structuredClone(pub.recu);d.id='recu-'+String(i).padStart(3,'0');d.publication.operation_id='op-'+i;rows.push({key:PREFIXE_BROUILLON+d.id,value:d});}await db.mutate({origin:'device',puts:{sync_state:rows},deletes:{sync_state:[PREFIXE_BROUILLON+pub.recu.id]}});
  const autre=await brouillon(repo);autre.o.modele.contenu.steps=[{id:'s',text:'Autre.'}];const c=await autre.s.conserverBrouillon({session:autre.o.session,expectedRevision:1,payload:autre.o.modele}),pr=await autre.s.preparerPublication({id:c.id,portee:autre.portee,expectedRevision:c.revision}),r=await autre.s.publierBrouillon({plan:pr.plan});eq(r.issue,'publie','L4 reçus : nouvelle publication réussie à capacité');eq((await repo.all('sync_state')).filter(r=>r.value?.state==='committed').length,128,'L4 reçus : au plus128 reçus locaux après commit');eq((await autre.s.publierBrouillon({plan:pr.plan})).issue,'deja_publie','L4 reçus : reçu courant conservé pour accusé perdu');
 });

 await run('archive refusée atomique',async(repo,db)=>{const f=await brouillon(repo),archive=await createArchive(db),inspection=await inspectArchive(await archive.blob.arrayBuffer()),avant=await db.getSnapshot(),capture=db.onMutate;db.onMutate=args=>{const extra=capture(args);if(args.puts.sync_state?.some(r=>r.key===CLE_EPOQUE_EDITEUR))throw new DOMException('Panne archive','QuotaExceededError');return extra;};try{eq(await tenter(()=>applyArchive(db,inspection,{mode:'replace'})),'QuotaExceededError','L4 archive : panne pendant capture refuse commit');}finally{db.onMutate=capture;}eq(await db.getSnapshot(),avant,'L4 archive : refus conserve bibliothèque, époque, brouillons et outbox');eq((await f.s.lireBrouillon({id:f.c.id,portee:f.portee})).etat,'reprenable','L4 archive : brouillon reste utilisable après panne');
 });

}
