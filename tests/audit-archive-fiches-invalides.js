import {withDatabase,rewriteArchive} from './backup.js';
import {createArchive,inspectArchive,applyArchive,verifyRestored} from '../src/domain/backup.js';
import {sha256Hex} from '../src/core/hash.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {traductionLectureL6} from './l6-lecture-recette.js';

const clone=structuredClone;
const resultat=async fn=>{try{return{valeur:await fn(),erreur:null};}catch(e){return{valeur:null,erreur:e.code||e.message};}};
// Reproduit une fiche héritée incohérente dans une vraie base : les écritures normales la refuseraient.
async function semer(db,stores){
 await db.open();await new Promise((resolve,reject)=>{const tx=db.idb.transaction(Object.keys(stores),'readwrite');for(const[s,rows]of Object.entries(stores))for(const r of rows)tx.objectStore(s).put(r);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
}
async function base(db){
 const blob=new Blob(['Original valable indépendant de la fiche invalide'],{type:'image/png'}),sha256=await sha256Hex(blob);
 await semer(db,{books:[{id:'livre',title:'Livre valable'}],recipes:[{id:'bonne',original_title:'Recette valable',current_version_id:'v-bonne'}],recipe_versions:[{id:'v-bonne',recipe_id:'bonne',ingredients:[],steps:[{id:'etape',text:'Préparation conservée'}]}],files:[{sha256,blob,mime:blob.type,size:blob.size}]});
 return{blob,sha256};
}
const lignes=inspection=>inspection?.exclues??[];
async function restaurer(archive){
 if(!archive)return{inspection:null,verification:false,fichier:null};
 const inspection=await inspectArchive(await archive.blob.arrayBuffer());let verification=false,fichier=null;
 if(inspection.ok)await withDatabase(async db=>{await applyArchive(db,inspection);verification=(await verifyRestored(db,inspection)).ok;fichier=(await db.getAll('files'))[0]?.blob;});
 return{inspection,verification,fichier};
}
export async function runAuditArchiveFichesInvalidesTests({eq,ok}){
 await withDatabase(async db=>{
  const f=await base(db);await semer(db,{recipes:[{id:'mauvaise',original_title:'Titre local conservé',lifecycle_id:'cycle',trashed_at:'pas une date'}]});
  const avant=await db.getSnapshot(),r=await resultat(()=>createArchive(db)),retour=await restaurer(r.valeur);
  eq(r.erreur,null,'B3 fiche : le cycle invalide n’empêche pas la sauvegarde valable');
  eq(r.valeur?.exclues,[{store:'recipes',id:'mauvaise',motif:'cycle_recette_invalide'}],'B3 fiche : exclusion précise à la création');
  eq(lignes(retour.inspection),r.valeur?.exclues??null,'B3 fiche : inspection relit les exclusions du manifeste');
  eq(retour.inspection?.payload?.stores.recipes.map(x=>x.id),['bonne'],'B3 fiche : recette valable présente, fiche invalide absente');
  ok(retour.verification,'B3 fiche : vraie restauration vérifiée sur base vide');
  eq(await retour.fichier?.text(),await f.blob.text(),'B3 fiche : octets valables conservés');
  eq(await db.getSnapshot(),avant,'B3 fiche : aucune suppression ni réécriture locale');
 });
 await withDatabase(async db=>{
  await base(db);await semer(db,{recipes:[{id:'dependante',current_version_id:'v-invalide'}],recipe_versions:[{id:'v-invalide',recipe_id:'dependante',ingredient_structure:{format:999},ingredients:[],steps:[]}],recipe_translations:[{id:'tr',recipe_version_id:'v-invalide'}],meals:[{id:'repas',items:[{recipe_id:'bonne',recipe_version_id:'v-bonne'},{recipe_id:'dependante',recipe_version_id:'v-invalide'}]}],shopping_lists:[{id:'liste',meal_id:'repas'}]});
  const avant=await db.getSnapshot(),r=await resultat(()=>createArchive(db)),retour=await restaurer(r.valeur);
  eq(r.erreur,null,'B3 dépendances : archive produite malgré version invalide');
  eq(lignes(retour.inspection).map(x=>[x.store,x.id,x.motif]).sort(),[['recipe_versions','v-invalide','version_invalide'],['recipes','dependante','dependance_exclue'],['recipe_translations','tr','dependance_exclue'],['meals','repas','dependance_exclue'],['shopping_lists','liste','dependance_exclue']].sort(),'B3 dépendances : fermeture exacte, sans couper un repas partagé');
  eq(retour.inspection?.payload?.stores.recipes.map(x=>x.id),['bonne'],'B3 dépendances : recette indépendante conservée');
  ok(retour.verification,'B3 dépendances : graphe réellement restaurable');
  eq(await db.getSnapshot(),avant,'B3 dépendances : tous les liens locaux restent intacts');
 });
 for(const [row,motif]of [[{id:'forme',source_page_ids:'pas un tableau'},'relation_invalide'],[{id:'orpheline',current_version_id:'absente'},'relation_absente']])await withDatabase(async db=>{
  await base(db);await semer(db,{recipes:[row]});const avant=await db.getSnapshot(),r=await resultat(()=>createArchive(db)),retour=await restaurer(r.valeur);
  eq(r.erreur,null,'B3 relation '+row.id+' : export disponible');
  eq(lignes(retour.inspection),[{store:'recipes',id:row.id,motif}],'B3 relation '+row.id+' : motif attribué');
  ok(retour.verification,'B3 relation '+row.id+' : restauration vérifiée');
  eq(await db.getSnapshot(),avant,'B3 relation '+row.id+' : source intacte');
 });
 await withDatabase(async db=>{
  const f=await base(db);await semer(db,{source_pages:[{id:'page',sha256:f.sha256,source_revision:{format:0}}],recipes:[{id:'photo',source_page_ids:['page']}]});
  const avant=await db.getSnapshot(),r=await resultat(()=>createArchive(db)),retour=await restaurer(r.valeur);
  eq(r.erreur,null,'B3 source : forme invalide attribuée à la page');
  eq(lignes(retour.inspection).map(x=>[x.store,x.id,x.motif]).sort(),[['source_pages','page','source_invalide'],['recipes','photo','dependance_exclue']].sort(),'B3 source : exclusions de la page et de sa dépendance');
  ok(retour.verification,'B3 source : reste de la bibliothèque restaurable');
  eq(await retour.fichier?.text(),await f.blob.text(),'B3 source : photo originale archivée même sans sa fiche');
  eq(await db.getSnapshot(),avant,'B3 source : page invalide toujours récupérable localement');
 });
 await withDatabase(async db=>{
  await base(db);await semer(db,{books:[{id:'big',valeur:10n},{id:17,title:'Clé numérique 17'},{id:18,title:'Clé numérique 18'}]});
  const r=await resultat(()=>createArchive(db)),retour=await restaurer(r.valeur);
  eq(r.erreur,null,'B3 sérialisation : une seule fiche BigInt n’empêche pas les autres');
  eq(lignes(retour.inspection),[{store:'books',id:null,motif:'cle_invalide'},{store:'books',id:null,motif:'cle_invalide'},{store:'books',id:'big',motif:'serialisation_invalide'}],'B3 métadonnée : deux fiches non identifiables sont comptées séparément');
  ok(retour.verification,'B3 sérialisation : archive filtrée restaurable');
  eq((await db.get('books','big')).valeur===10n,true,'B3 sérialisation : valeur locale BigInt intacte');
  eq((await db.getAll('books')).length,4,'B3 sérialisation : aucune fiche locale supprimée');
 });
 await withDatabase(async db=>{
  const f=await base(db);await semer(db,{files:[{sha256:'empreinte-invalide',blob:new Blob(['octets locaux']),mime:'image/png',size:13}],source_pages:[{id:'page-invalide',sha256:'empreinte-invalide'}]});
  const avant=await db.getSnapshot(),r=await resultat(()=>createArchive(db)),retour=await restaurer(r.valeur);
  eq(r.erreur,null,'B3 fichier : clé de fichier invalide attribuée');
  eq(lignes(retour.inspection).map(x=>[x.store,x.id,x.motif]).sort(),[['files','empreinte-invalide','fichier_invalide'],['source_pages','page-invalide','dependance_exclue']].sort(),'B3 fichier : exclusions précises et dépendance signalée');
  eq(await retour.fichier?.text(),await f.blob.text(),'B3 fichier : autre original intact dans le ZIP');
  ok(retour.verification,'B3 fichier : archive valide réellement restaurable');
  eq(await db.getSnapshot(),avant,'B3 fichier : tous les octets locaux conservés');
 });
 await withDatabase(async db=>{
  await base(db);const f=fixtureLectureL6(),tr=await traductionLectureL6(f);tr.source_signature='f'.repeat(64);
  await semer(db,{unit_definitions:[{id:'g'},{id:'ml'}],recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:[tr]});const avant=await db.getSnapshot();
  const r=await resultat(()=>createArchive(db));eq(r.erreur,'preuve_archive_non_attribuable','B3 preuve : une signature globale non attribuée refuse explicitement');
  eq(r.valeur,null,'B3 preuve : aucune archive prétendue restaurable');
  eq(await db.getSnapshot(),avant,'B3 preuve : aucun groupe arbitrairement effacé');
 });
 let saine;await withDatabase(async db=>{await base(db);saine=await createArchive(db);});
 for(const [label,exclues]of [
  ['forme',{}],['magasin inconnu',[{store:'outbox',id:'secret',motif:'cle_invalide'}]],['motif inconnu',[{store:'books',id:'absent',motif:'invente'}]],['copie brute',[{store:'books',id:'absent',motif:'cle_invalide',data:{secret:'jamais'}}]],['id mal formé',[{store:'books',id:42,motif:'cle_invalide'}]],['doublon identifié',[{store:'books',id:'absent',motif:'cle_invalide'},{store:'books',id:'absent',motif:'cle_invalide'}]],['fiche présente',[{store:'books',id:'livre',motif:'cle_invalide'}]],
 ]){
  const bytes=await rewriteArchive(saine.blob,({manifest})=>{manifest.exclues=exclues;}),inspection=await inspectArchive(bytes);
  eq(inspection.ok,false,'B3 manifeste hostile '+label+' : inspection refuse');
  ok(inspection.errors.includes('exclusions_archive_invalides'),'B3 manifeste hostile '+label+' : motif exact');
 }
 const ancienne=await inspectArchive(await rewriteArchive(saine.blob,({manifest})=>{delete manifest.exclues;}));
 ok(ancienne.ok,'B3 compatibilité : archive ancienne sans exclusions acceptée');
 eq(ancienne.exclues,[],'B3 compatibilité : absence descriptive vaut liste vide');
 await withDatabase(async db=>{
  const inspection=await inspectArchive(await saine.blob.arrayBuffer());inspection.manifest.exclues=[{store:'books',id:'livre',motif:'cle_invalide'}];const avant=await db.getSnapshot();
  eq((await resultat(()=>applyArchive(db,inspection))).erreur,'exclusions_archive_invalides','B3 manifeste : métadonnée relue avant application');
  eq(await db.getSnapshot(),avant,'B3 manifeste : falsification refusée sans écriture');
 });
}
