import { withRepo } from './sync-fixture.js';
import { getData } from '../src/ui/state.js';
import { renderLivreSansSaisieRoute } from '../src/ui/livre-sans-saisie.js';
import { fabriquerImportLivre, enregistrerLivreI2, brouillonDepuisEdition, garderBrouillonLivre } from '../src/domain/livre-parcours.js';
import { brouillonLivre } from '../src/domain/livre-bibliographie.js';
const at='2026-10-29T18:00:00.000Z';
const seed=async(db)=>{const book={id:'livre-garde',title:'Cuisine témoin',author:'Auteur'},edition={id:'edition-garde',book_id:book.id,isbn:'9781837836222'};await db.mutate({origin:'remote',puts:{books:[book],book_editions:[edition]}});return{book,edition};};
const attendre=async fn=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Attente du livre dépassée');};
const boutons=r=>[...r.querySelectorAll('button')];
export async function runL2LivreMutationsTests({eq,ok}){
 const run=async(n,fn)=>{try{await withRepo(fn);}catch(e){ok(false,n+': '+(e.stack||e));}};
 await run('Création explicite',async(repo)=>{
  const d=brouillonLivre({fields:{title:'Livre nouveau'}}),id='imp-livre-neuf';await repo.save('imports',fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}));
  const ed=await enregistrerLivreI2({importId:id,brouillon:d},{repo});eq((await repo.get('books',ed.book_id)).title,'Livre nouveau','L2 livre : création explicite autorisée');
 });
 for(const retour of [false,true])await run('Ancien complément '+retour,async(repo,db)=>{
  const {book,edition}=await seed(db),base=brouillonDepuisEdition(book,edition),d=brouillonLivre(base);d.fields.title='Titre saisi';
  const contexteEdition=await repo.capturerContexteEdition(edition),id='imp-livre-ancien';await repo.save('imports',{...fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}),edition_id:edition.id,expected_edition_cycle_id:null});
  await db.put('book_editions',{...edition,lifecycle_id:retour?'retour':'retrait',trashed_at:retour?null:at,trash_mode:retour?null:'keep_recipes'},{origin:'remote'});
  let refus=false;try{await enregistrerLivreI2({importId:id,brouillon:d,base},{repo,contexteEdition});}catch{refus=true;}
  ok(refus,'L2 livre : ancien complément refusé après '+(retour?'restauration':'retrait'));
  eq((await repo.get('books',book.id)).title,book.title,'L2 livre : refus conserve les métadonnées');
  eq((await repo.get('imports',id)).status,'a_lancer','L2 livre : refus conserve le brouillon ouvert');
 });
 await run('Couverture et journal atomiques',async(repo,db)=>{
  const {book,edition}=await seed(db),d=brouillonDepuisEdition(book,edition),id='imp-photo-livre';await repo.save('imports',{...fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}),edition_id:edition.id});
  const contexteEdition=await repo.capturerContexteEdition(edition),fichier={sha256:'a'.repeat(64),blob:new Blob(['photo'],{type:'image/jpeg'})};d.cover_sha256=fichier.sha256;
  await db.put('book_editions',{...edition,lifecycle_id:'apres-photo',trashed_at:null,trash_mode:null},{origin:'remote'});
  const avant=await repo.get('imports',id);let refus=false;try{await garderBrouillonLivre(id,d,{repo,contexteEdition,fichiers:[fichier]});}catch{refus=true;}
  ok(refus,'L2 livre : couverture ancienne refuse le changement de cycle');
  eq([await repo.getFile(fichier.sha256),await repo.get('imports',id)],[undefined,avant],'L2 livre : aucun octet ou lien après refus de couverture');
 });
 await run('Doublon retiré visible',async(repo,db)=>{
  const {edition}=await seed(db);await db.put('book_editions',{...edition,lifecycle_id:'retire',trashed_at:at,trash_mode:'with_recipes'},{origin:'remote'});
  const vue=await renderLivreSansSaisieRoute({},{},await getData(true),{repo,remplacerAdresse:()=>{},enLigne:()=>false});document.body.append(vue);
  try{const isbn=vue.querySelector('[name=isbn]');isbn.value=edition.isbn;isbn.dispatchEvent(new Event('input',{bubbles:true}));await vue.attendreEcritures();vue.querySelector('[data-role=identifier-livre]').click();await attendre(()=>vue.textContent.includes('déjà dans ta bibliothèque')||vue.textContent.includes('corbeille'));
   ok(vue.textContent.includes('Livre dans la corbeille'),'L2 ISBN : édition retirée explicitement signalée');
   eq(vue.querySelectorAll('[data-role=completer-edition-garde]').length,0,'L2 ISBN : pas de complément sur édition retirée');
   ok(vue.querySelector('a[href="#/books/edition-garde"]'),'L2 ISBN : lien vers restauration de l’édition existante');
   eq((await repo.all('book_editions')).length,1,'L2 ISBN : aucun doublon ni restauration implicite');
  }finally{vue.dispose();vue.remove();}
 });
 await run('Écran retiré en lecture seule',async(repo,db)=>{
  const {edition}=await seed(db);await db.put('book_editions',{...edition,lifecycle_id:'retire',trashed_at:at,trash_mode:'keep_recipes'},{origin:'remote'});
  const vue=await renderLivreSansSaisieRoute({},{edition:edition.id},await getData(true),{repo});
  ok(vue.textContent.includes('Livre dans la corbeille'),'L2 complément direct : état retiré expliqué');eq(vue.querySelectorAll('input,textarea,[data-role=enregistrer-livre]').length,0,'L2 complément direct : aucune administration du livre retiré');vue.dispose?.();
 });
 await run('Photo préparée après changement de compte',async(repo,db)=>{
  const {edition}=await seed(db);const canvas=new OffscreenCanvas(8,8);canvas.getContext('2d').fillRect(0,0,8,8);const photo=await canvas.convertToBlob({type:'image/jpeg'});
  let termine;const choisi=new Promise(r=>{termine=r;});const vue=await renderLivreSansSaisieRoute({},{edition:edition.id},await getData(true),{repo,pickFiles:()=>choisi,remplacerAdresse:()=>{}});document.body.append(vue);
  try{vue.querySelector('[data-role=changer-couverture]').click();await db.put('sync_state',{key:'user_id',value:'autre-owner'});termine([photo]);await attendre(()=>!vue.querySelector('[data-role=changer-couverture]').disabled);
   await vue.attendreEcritures().catch(()=>{});eq((await repo.all('files')).length,0,'L2 couverture : changement de compte ne pose aucun octet');eq((await repo.all('imports')).length,0,'L2 couverture : changement de compte ne pose aucun journal');
  }finally{vue.dispose();vue.remove();}
 });
 await run('Résultat payé ancien relu explicitement',async(repo,db)=>{
  const {book,edition}=await seed(db),d=brouillonDepuisEdition(book,edition),id='imp-livre-paye';
  const ligne={...fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}),edition_id:edition.id,expected_edition_cycle_id:null,owner_id:null,status:'a_verifier',resultat:{format:1,lecture_photo:{lecture:{title:'Titre lu sur la photo'},date:at}}};
  await repo.save('imports',ligne);await db.put('book_editions',{...edition,lifecycle_id:'restaure',trashed_at:null,trash_mode:null},{origin:'remote'});
  let appels=0;const vue=await renderLivreSansSaisieRoute({},{import:id},await getData(true),{repo,fetch:async()=>{appels++;throw Error('Pas de nouvel appel');},remplacerAdresse:()=>{}});document.body.append(vue);
  try{
   eq(vue.querySelectorAll('[data-role=utiliser-title]').length,0,'L2 reprise : résultat de l’ancien cycle non appliqué automatiquement');
   ok(vue.querySelector('[data-role=enregistrer-livre]').disabled,'L2 reprise : ancien complément ne peut pas être gardé sans relecture');
   const relire=vue.querySelector('[data-role=relire-brouillon-livre]');ok(relire,'L2 reprise : relecture explicite offerte pour le livre restauré');
   relire?.click();await vue.attendreEcritures();
   ok(vue.querySelector('[data-role=utiliser-title]'),'L2 reprise : résultat payé proposé après relecture explicite');
   eq((await repo.get('imports',id)).expected_edition_cycle_id,'restaure','L2 reprise : seul le geste explicite adopte le cycle affiché');
   eq([(await repo.get('books',book.id)).title,appels],[book.title,0],'L2 reprise : relecture ne modifie pas le livre et ne paie aucun appel');
  }finally{vue.dispose();vue.remove();}
 });
 await run('Relecture du journal devenue périmée',async(repo,db)=>{
  const {book,edition}=await seed(db),d=brouillonDepuisEdition(book,edition),id='imp-livre-relecture';
  const ligne={...fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}),edition_id:edition.id,expected_edition_cycle_id:null,owner_id:null,status:'a_verifier'};await repo.save('imports',ligne);
  const attendu=await repo.get('imports',id),restauree={...edition,lifecycle_id:'restaure',trashed_at:null,trash_mode:null};await db.put('book_editions',restauree,{origin:'remote'});
  const contexteEdition=await repo.capturerContexteEdition(restauree);const autre={...attendu,resultat:{format:1,lecture_photo:{lecture:{title:'Autre résultat'},date:at}}};await db.put('imports',autre,{origin:'remote'});
  const {relireBrouillonLivre}=await import('../src/domain/livre-parcours.js');let refus=false;try{await relireBrouillonLivre(id,{repo,contexteEdition,attendu});}catch{refus=true;}
  ok(typeof relireBrouillonLivre==='function'&&refus,'L2 relecture : refuse un journal modifié depuis son affichage');
  eq(await repo.get('imports',id),autre,'L2 relecture : journal concurrent préservé intégralement');
 });
 await run('Relecture concurrente au commit',async(repo,db)=>{
  const {book,edition}=await seed(db),d=brouillonDepuisEdition(book,edition),id='imp-livre-commit';
  await repo.save('imports',{...fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}),edition_id:edition.id,expected_edition_cycle_id:null,owner_id:null,status:'a_verifier'});
  const attendu=await repo.get('imports',id),restauree={...edition,lifecycle_id:'restaure',trashed_at:null,trash_mode:null};await db.put('book_editions',restauree,{origin:'remote'});
  const contexteEdition=await repo.capturerContexteEdition(restauree),autre={...attendu,brouillon:{...d,fields:{...d.fields,title:'Saisie sur l’autre écran'}}};
  const proxy={...repo,saveBatch:async(...args)=>{await db.put('imports',autre,{origin:'remote'});return repo.saveBatch(...args);}};
  const {relireBrouillonLivre}=await import('../src/domain/livre-parcours.js');let refus=false;try{await relireBrouillonLivre(id,{repo:proxy,contexteEdition,attendu});}catch{refus=true;}
  ok(refus,'L2 relecture : garde vérifiée pendant la transaction');eq(await repo.get('imports',id),autre,'L2 relecture : aucune écriture partielle au conflit final');
 });
 await run('Complément actuel du livre restauré',async(repo,db)=>{
  const {book,edition}=await seed(db),restauree={...edition,lifecycle_id:'restaure',trashed_at:null,trash_mode:null};await db.put('book_editions',restauree,{origin:'remote'});
  const contexteEdition=await repo.capturerContexteEdition(restauree),base=brouillonDepuisEdition(book,restauree),d=brouillonLivre(base);d.fields.title='Complément après relecture';const id='imp-livre-actuel';
  await repo.save('imports',{...fabriquerImportLivre({id,deviceId:repo.deviceId(),brouillon:d}),edition_id:edition.id,expected_edition_cycle_id:'restaure',owner_id:null},{editions:[contexteEdition]});
  await enregistrerLivreI2({importId:id,brouillon:d,base},{repo,contexteEdition});
  eq([(await repo.get('books',book.id)).title,(await repo.get('imports',id)).status],['Complément après relecture','enregistre'],'L2 livre : complément actuel enregistré avec cycle de restauration');
 });
}
