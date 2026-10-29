import { withDatabase } from './backup.js';
import { installCapture } from '../src/sync/outbox.js';
import { composerLots } from '../src/sync/lots.js';
import { creerTransportFactice } from './transport-factice.js';
import { createPush } from '../src/sync/push.js';
import { createPull } from '../src/sync/pull.js';
import { garderIci, garderAilleurs, abandonnerConflitCycle } from '../src/sync/conflits.js';

export async function runL2CorbeilleSyncTests({eq,ok}) {
  const at='2026-10-29T12:00:00.000Z',edition={id:'l2-ed',book_id:'l2-book',updated_at:at};
  const recipe={id:'l2-r',edition_id:edition.id,original_title:'Pain',updated_at:at};
  const command=(operation_id,base_cycle_id,action='trash')=>({entity:'edition',edition_id:edition.id,operation_id,base_cycle_id,action,at,...(action==='trash'?{mode:'with_recipes',seed:edition}:{})});
  const entry=(payload,seq)=>({seq,store:payload.entity==='edition'?'book_editions':'recipes',id:payload.edition_id&&payload.entity==='edition'?payload.edition_id:payload.recipe_id,user_id:'u',op:'lifecycle',payload});
  const retirer=entry(command('edition-trash',null),1),membre=entry({entity:'recipe',action:'restore_from_edition',recipe_id:recipe.id,edition_id:edition.id,operation_id:'member-restore',base_cycle_id:null,base_edition_cycle_id:'edition-trash',at},2),retour=entry(command('edition-restore','edition-trash','restore'),3);
  await withDatabase(async db=>{
    installCapture(db,{getUserId:()=> 'u'});
    await db.mutate({puts:{book_editions:[{...edition,lifecycle_id:'edition-trash',trashed_at:at,trash_mode:'with_recipes'}]},lifecycle:retirer.payload});
    const rows=await db.getAll('outbox');
    eq(rows.map(x=>[x.store,x.id,x.op]),[['book_editions',edition.id,'lifecycle']],'L2 capture : commande édition distincte, sans put ordinaire de sa cible');
    const captures=db.onMutate({puts:{recipe_versions:[{id:'v'}]},recettes:[{recipe_id:recipe.id,expected_cycle_id:null,expected_edition_id:edition.id,records:[{store:'recipe_versions',id:'v'}]}],editions:[{edition_id:edition.id,expected_cycle_id:'edition-restore',records:[{store:'recipe_versions',id:'v'}]}]});
    eq(captures.outbox[0].edition_contexts?.[0]?.expected_cycle_id,'edition-restore','L2 capture : base édition conservée sur enfant');
    eq(captures.outbox[0].expected_edition_id,edition.id,'L2 capture : association antérieure conservée');
  });
  const lots=await composerLots([retirer,membre,retour],async()=>edition);
  eq(lots.lots.flatMap(l=>l.elements).map(e=>[e.store,e.operation_id]),[['book_editions','edition-trash']],'L2 barrières croisées : édition E1 puis membre R1 puis édition E2 attendent leurs accusés');
  const blocked=await composerLots([{...retirer,lifecycle_blocked:true},membre,retour],async()=>edition);
  eq(blocked.lots.length,0,'L2 refus parent bloque les commandes du membre et le retour parent');
  const init=await composerLots([
    {seq:1,store:'book_editions',id:edition.id,op:'put',edition_contexts:[{edition_id:edition.id,expected_cycle_id:null}]},
    {seq:2,store:'recipes',id:recipe.id,op:'put',recipe_id:recipe.id,expected_cycle_id:null,expected_edition_id:edition.id,edition_contexts:[{edition_id:edition.id,expected_cycle_id:null}]},
    {...retirer,seq:3}
  ],async store=>store==='recipes'?recipe:{...edition,lifecycle_id:'edition-trash',trashed_at:at,trash_mode:'with_recipes'});
  eq(init.lots.flatMap(l=>l.elements).map(e=>[e.store,e.op??'put',e.data?.lifecycle_id??null]),[['book_editions','put',null]],'L2 premier envoi : parent initial seul avant enfants et commande, sans réattribuer le cycle');
  const serveur=creerTransportFactice({serveur:true});
  await serveur.pousser([{store:'books',id:'l2-book',data:{id:'l2-book'},updated_at:at},{store:'book_editions',id:edition.id,data:edition,updated_at:at},{store:'recipes',id:recipe.id,data:recipe,updated_at:at}]);
  const rpc=e=>({store:e.store,id:e.id,op:'lifecycle',...e.payload});
  const trash=await serveur.pousser([rpc(retirer)]);
  eq(trash.reponse.accepted[0]?.operation_id,'edition-trash','L2 serveur : retrait édition accusé');
  eq(serveur.ligne('book_editions',edition.id)?.data.trash_mode,'with_recipes','L2 serveur : politique portée par édition sans cascade recette');
  const stale=await serveur.pousser([{store:'recipes',id:recipe.id,data:{...recipe,original_title:'Ancien appareil'},updated_at:'2099-01-01T00:00:00.000Z'}]);
  eq(stale.reponse.rejected[0]?.reason,'cycle','L2 serveur : ancien client ne contourne pas le retrait du parent');
  const restore=await serveur.pousser([rpc(membre)]);
  eq(restore.reponse.accepted[0]?.operation_id,'member-restore','L2 serveur : membre restauré explicitement sur les deux bases');
  eq(serveur.ligne('recipes',recipe.id)?.data.restored_from_edition,{edition_id:edition.id,lifecycle_id:'edition-trash'},'L2 serveur : exception précise conserve association et livre retiré');
  eq(restore.reponse.accepted[0]?.edition_server?.data?.lifecycle_id,'edition-trash','L2 accusé membre : état confirmé du parent joint');
  const intact=serveur.ligne('book_editions',edition.id)?.data;
  ok(!!intact?.trashed_at,'L2 restauration membre ne restaure pas tout le livre');
  // Deux vraies bases, transactions IndexedDB et modules de réception/envoi de production.
  await withDatabase(async db=>withDatabase(async autre=>{
    const distant=creerTransportFactice({serveur:true});
    await distant.pousser([{store:'books',id:'l2-book',data:{id:'l2-book'},updated_at:at},{store:'book_editions',id:edition.id,data:edition,updated_at:at},{store:'recipes',id:recipe.id,data:recipe,updated_at:at}]);
    await db.putBatch({book_editions:[{...edition,lifecycle_id:'edition-restore',trashed_at:null,trash_mode:null}],recipes:[{...recipe,lifecycle_id:'member-restore',trashed_at:null,restored_from_edition:{edition_id:edition.id,lifecycle_id:'edition-trash'}}],outbox:[retirer,membre,retour],sync_state:[{key:'user_id',value:'u'}]},{origin:'remote'});
    const push=createPush({db,transport:distant,getUserId:()=> 'u'});
    await push.envoyer();
    eq((await db.getAll('outbox')).map(e=>e.payload.operation_id),['member-restore','edition-restore'],'L2 vrai push : seul le premier accusé retire sa commande');
    eq((await db.get('book_editions',edition.id)).lifecycle_id,'edition-restore','L2 vrai push : accusé ancien conserve restauration locale postérieure');
    await push.envoyer();
    eq((await db.get('sync_state',`lifecycle:${recipe.id}`))?.value?.data?.restored_from_edition?.lifecycle_id,'edition-trash','L2 vrai push : accusé membre confirme exception');
    eq((await db.get('sync_state',`edition-lifecycle:${edition.id}`))?.value?.data?.lifecycle_id,'edition-trash','L2 vrai push : accusé membre confirme aussi parent');
    await push.envoyer();
    eq((await db.getAll('outbox')).length,0,'L2 vrai push : troisième passe confirme le retour parent');
    await createPull({db:autre,transport:distant,getUserId:()=> 'u'}).recevoir();
    eq([(await autre.get('book_editions',edition.id))?.lifecycle_id,(await autre.get('recipes',recipe.id))?.lifecycle_id],['edition-restore','member-restore'],'L2 deux bases : cycles parent et membre reçus');
    const courant=await autre.get('book_editions',edition.id);
    const ancien={id:`book_editions:${edition.id}`,store:'book_editions',record_id:edition.id,kind:'donnees',local:edition,server:{data:edition,updated_at:at}};
    await autre.putBatch({sync_conflicts:[ancien]},{origin:'remote'});
    eq(await garderIci(autre,ancien),false,'L2 ancien conflit ordinaire : garder ici ne retire pas le cycle parent');
    eq(await garderAilleurs(autre,ancien),false,'L2 ancien conflit ordinaire : garder ailleurs ne retire pas le cycle parent');
    await autre.putBatch({book_editions:[courant],sync_state:[{key:'user_id',value:'u'},{key:`edition-lifecycle:${edition.id}`,value:{user_id:'u',data:courant}}],sync_conflicts:[{...ancien,kind:'cycle'}]},{origin:'remote'});
    eq(await abandonnerConflitCycle(autre,{...ancien,kind:'cycle'}),true,'L2 abandon parent : état confirmé réconcilié et copie explicitement retirée');
  }));
  await withDatabase(async db=>{
    const snapshot={...recipe,original_title:'Avant la commande'};
    installCapture(db,{getUserId:()=> 'u'});
    await db.mutate({puts:{recipes:[snapshot]},recettes:[{recipe_id:recipe.id,expected_cycle_id:null,expected_edition_id:edition.id,records:[{store:'recipes',id:recipe.id}]}],editions:[{edition_id:edition.id,expected_cycle_id:null,records:[{store:'recipes',id:recipe.id}]}]});
    await db.putBatch({recipes:[{...recipe,original_title:'Texte postérieur'}]},{origin:'remote'});
    const compose=await composerLots(await db.getAll('outbox'),(s,id)=>db.get(s,id));
    eq(compose.lots[0]?.elements[0]?.data?.original_title,'Avant la commande','L2 base capturée : envoi utilise contenu immuable antérieur à la commande');
  });

}
