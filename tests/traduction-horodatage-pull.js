import {withRepo} from './sync-fixture.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {traductionLectureL6} from './l6-lecture-recette.js';
import {fixtureCommandeTraduction} from './l6-sync-traductions.js';
import {createPull} from '../src/sync/pull.js';
import {createPush} from '../src/sync/push.js';
import {CLE_SOURCE_CONFIRMEE} from '../src/sync/commandes-sources.js';
import {validerLigneTraductionV2,validerJournalTraduction,projectionLectureTraduction} from '../src/domain/traductions-format.js';
import {creerDepotTraductions} from '../src/domain/depot-traductions.js';
import {preparerLectureRecette,projeterLectureRecette} from '../src/domain/lecture-recette.js';
import {getData} from '../src/ui/state.js';
import {renderRecipe} from '../src/ui/recipe.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';

const metierAt='2099-10-31T17:17:48.168Z';
const transportAt='2099-10-31T17:17:48.168346+00:00';
function reception(db,store,row,stamp=transportAt,seq=10,deleted_at=null){
  return createPull({db,getUserId:()=> 'u1',transport:{lire:async(table,curseur)=>({lignes:table===store&&curseur<seq?[{id:row.id,data:structuredClone(row),server_seq:seq,updated_at:stamp,deleted_at}]:[],encore:false})}}).recevoir();
}
const confirmation=(store,row,stamp,seq=10,deleted_at=null)=>({key:CLE_SOURCE_CONFIRMEE(store,row.id),value:{user_id:'u1',data:deleted_at?null:row,server_seq:seq,updated_at:stamp,deleted_at}});

export async function runTraductionHorodatagePullTests({eq,ok}){
  const langue=getUiLocale();setUiLocale('fr');
  try{
    for(const stamp of [metierAt,'2099-10-31T17:17:48.168+00:00',transportAt])await withRepo(async(repo,db)=>{
      const f=fixtureLectureL6(),tr=await traductionLectureL6(f),serveur={...tr,updated_at:metierAt};
      await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:stamp===metierAt?[]:[tr],sync_state:[{key:'user_id',value:'u1'}]}});
      ok(validerLigneTraductionV2(serveur).ok,'Horodatage pull : traduction métier valide avant réception '+stamp);
      const sources=await db.getSnapshot(['recipes','recipe_versions']);
      eq(await reception(db,'recipe_translations',serveur,stamp),{recues:1,supprimees:0,conflits:0,erreur:null},'Horodatage pull : page reçue sans conflit '+stamp);
      const apres=await db.get('recipe_translations',tr.id);
      eq(apres,serveur,'Horodatage pull : JSON métier exact, reçus et dates compris '+stamp);
      eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE('recipe_translations',tr.id)),confirmation('recipe_translations',serveur,stamp),'Horodatage pull : confirmation sépare date métier et transport '+stamp);
      const lecture=projeterLectureRecette(await preparerLectureRecette({...f,traductions:[apres]}),{locale:'fr',translationId:tr.id});
      eq([lecture.etat,lecture.etapes[0].texte],['courante','Mélanger.\n\nLaisser reposer 10 minutes.'],'Horodatage pull : traduction reste courante et française '+stamp);
      const root=await renderRecipe({id:f.recipe.id},{v:f.version.id,lang:'fr',translation:tr.id},await getData(true),{repo});document.body.append(root);
      try{eq(root.querySelector('[data-role=texte-etape]')?.textContent,'Mélanger.\n\nLaisser reposer 10 minutes.','Horodatage pull : adresse de candidate exacte reste lisible après relecture '+stamp);}finally{root.dispose?.();root.remove();}
      eq(await db.getSnapshot(['recipes','recipe_versions']),sources,'Horodatage pull : original, quantités et minuteries inchangés '+stamp);
      eq([await db.getAll('outbox'),(await db.get('sync_state','cursor:recipe_translations'))?.value],[[],10],'Horodatage pull : curseur reçu sans nouvel envoi '+stamp);
    });
    await withRepo(async(repo,db)=>{
      const f=await fixtureCommandeTraduction(),c=f.commande,serveur={...f.row,updated_at:metierAt};
      await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],sync_state:[{key:'user_id',value:'u1'}]}});
      // La vraie capture produit la commande, puis le vrai push reçoit son accusé exact.
      await db.mutate({origin:'local',puts:{recipe_translations:[f.row]},translation_commands:[c]});
      const file=await db.getAll('outbox'),envoyees=[];
      eq(file.map(e=>[e.op,e.payload]),[['translation_apply',c]],'Horodatage ACK : capture réelle de la commande signée');
      const ack={store:c.store,id:c.id,operation_id:c.operation_id,payload_sha256:c.payload_sha256,server_rows:[{store:c.store,id:c.id,data:serveur,server_seq:10,updated_at:transportAt,deleted_at:null}]};
      await createPush({db,getUserId:()=> 'u1',transport:{capacites:async()=>({capacites:{recipe_language:1}}),pousser:async xs=>{envoyees.push(...xs);return{reponse:{accepted:[ack],rejected:[]}};}}}).envoyer();
      eq(envoyees,[c],'Horodatage ACK : intention envoyée sans changement de signature');
      eq(await db.getAll('outbox'),[],'Horodatage ACK : reçu exact retire la commande');
      eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE(c.store,c.id)),confirmation(c.store,serveur,transportAt),'Horodatage ACK : confirmation initiale contient déjà le JSON serveur exact');
      await reception(db,c.store,serveur);
      eq(await db.get(c.store,c.id),serveur,'Horodatage ACK : écho suivant adopte le JSON métier sans date de transport');
      eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE(c.store,c.id)),confirmation(c.store,serveur,transportAt),'Horodatage ACK : écho ne corrompt pas une confirmation valide');
      ok(validerLigneTraductionV2(await db.get(c.store,c.id)).ok,'Horodatage ACK : traduction strictement valide après accusé puis écho');
      eq(await reception(db,c.store,serveur),{recues:0,supprimees:0,conflits:0,erreur:null},'Horodatage ACK : curseur avancé ne redemande pas la traduction');
    });
    await withRepo(async(repo,db)=>{
      const recipe={id:'horloge-r',original_title:'Bread',original_language:'en',availability:'available',current_version_id:'horloge-v'},version={id:'horloge-v',recipe_id:recipe.id,ingredients:[],steps:[{id:'horloge-s',text:'Mix.'}]};
      await db.mutate({origin:'remote',puts:{recipes:[recipe],recipe_versions:[version],sync_state:[{key:'user_id',value:'u1'}]}});
      const depot=creerDepotTraductions({repo,getGeneration:()=>0}),portee=(await depot.capturerPortee({owner_id:'u1'})).portee,ouvert=await depot.ouvrirTraduction({portee,affiche:{recipe,version,traductions:[]},locale:'fr'});
      const plan=await depot.preparerLectureTraduction({session:ouvert.session,selection:ouvert.source.segments.map(s=>s.ref)}),reservation=await depot.reserverPortionTraduction({plan:plan.plan,ordinal:0}),depart=await depot.commencerPortionTraduction({reservation:reservation.reservation});
      const resultat={format:1,segments:depart.portion.segment_refs.map(s=>({ref:s.ref,text:s.kind==='title'?'Pain':'Mélanger.'}))};
      await depot.conserverReponseTraduction({vol:depart.vol,reponse:{text:JSON.stringify(resultat),stopReason:'end_turn',model:null,reponseBrute:new TextEncoder().encode(JSON.stringify(resultat))}});
      const j=await db.get('imports',depart.journalId),brut=await db.get('sync_state','translation_response:v1:'+j.id);
      ok(validerJournalTraduction(j).ok,'Horodatage journal : vraie réponse conservée valide avant réseau');
      const push=createPush({db,getUserId:()=> 'u1',transport:{capacites:async()=>({capacites:{recipe_language:1}}),pousser:async xs=>({reponse:{accepted:xs.map(({store,id})=>({store,id})),adjusted:[],rejected:[]}})}});
      for(let n=0;n<3;n++)await push.envoyer();
      eq(await db.getAll('outbox'),[],'Horodatage journal : trois phases réellement accusées avant écho');
      const serveur={...j,updated_at:metierAt};await reception(db,'imports',serveur);
      const apres=await db.get('imports',j.id);
      eq(apres,serveur,'Horodatage journal : JSON reçu exact avec dates, capture et résultat');
      ok(validerJournalTraduction(apres).ok,'Horodatage journal : date externe ne rend pas la réponse invalide');
      eq(projectionLectureTraduction(apres),projectionLectureTraduction(j),'Horodatage journal : empreinte de lecture signée inchangée');
      eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE('imports',j.id)),confirmation('imports',serveur,transportAt),'Horodatage journal : confirmation conserve les deux dates séparément');
      const reprise=await depot.lireLectureTraduction({portee,journalId:j.id});
      eq([reprise.issue,reprise.lecture.resultat,reprise.recuperationDisponible],['ok',j.resultat,true],'Horodatage journal : réponse relue avec sa récupération disponible');
      eq(await db.get('sync_state','translation_response:v1:'+j.id),brut,'Horodatage journal : aucun octet ni reçu brut réécrit');
    });
    await withRepo(async(repo,db)=>{
      const f=await fixtureCommandeTraduction(),serveur={...structuredClone(f.row),updated_at:metierAt};serveur.translated_content.segments[0].text='Autre pain';
      await db.mutate({origin:'remote',puts:{sync_state:[{key:'user_id',value:'u1'}]}});
      await db.mutate({origin:'local',puts:{recipe_translations:[f.row]},translation_commands:[f.commande]});
      const file=await db.getAll('outbox');await reception(db,'recipe_translations',serveur);
      eq(await db.get('recipe_translations',f.row.id),f.row,'Horodatage pendant : commande non accusée garde sa traduction locale');
      eq(await db.getAll('outbox'),file,'Horodatage pendant : payload et signature de commande inchangés');
      eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE('recipe_translations',f.row.id)),confirmation('recipe_translations',serveur,transportAt),'Horodatage pendant : comparaison conserve le JSON distant canonique');
      await reception(db,'recipe_translations',serveur,transportAt,11,transportAt);
      eq(await db.get('recipe_translations',f.row.id),f.row,'Horodatage tombale : intention en attente protège toujours la ligne');
      eq(await db.getAll('outbox'),file,'Horodatage tombale : suppression distante ne dissout pas la commande');
      eq(await db.get('sync_state',CLE_SOURCE_CONFIRMEE('recipe_translations',f.row.id)),confirmation('recipe_translations',serveur,transportAt,11,transportAt),'Horodatage tombale : confirmation n’invente pas de JSON vivant');
    });
    await withRepo(async(repo,db)=>{
      const f=fixtureLectureL6(),tr=await traductionLectureL6(f);
      await db.mutate({origin:'remote',puts:{recipe_translations:[tr],sync_state:[{key:'user_id',value:'u1'}]}});
      eq(await reception(db,'recipe_translations',tr,transportAt,10,transportAt),{recues:0,supprimees:1,conflits:0,erreur:null},'Horodatage tombale : suppression sans intention reste appliquée');
      eq([await db.get('recipe_translations',tr.id),await db.getAll('outbox')],[undefined,[]],'Horodatage tombale : aucun retour à la vie ni envoi inventé');
      const legacy={...f.translation,updated_at:'2026-10-29T12:00:00.000Z'};
      await reception(db,'recipe_translations',legacy,transportAt,11);
      eq(await db.get('recipe_translations',legacy.id),{...legacy,updated_at:transportAt},'Horodatage voisin : contrat de date des anciennes traductions conservé');
      const ordinaire={id:'horloge-import-simple',kind:'manuel',updated_at:metierAt};
      await reception(db,'imports',ordinaire);
      eq(await db.get('imports',ordinaire.id),{...ordinaire,updated_at:transportAt},'Horodatage voisin : import non signé garde sa date de transport');
    });
  }finally{setUiLocale(langue);}
}
