import {withDatabase} from './backup.js';
import {withRepo} from './sync-fixture.js';
import {creerTransportFactice} from './transport-factice.js';
import {installCapture} from '../src/sync/outbox.js';
import {composerLots} from '../src/sync/lots.js';
import {appliquerReponse} from '../src/sync/reponses.js';
import {createPull} from '../src/sync/pull.js';
import {createPush} from '../src/sync/push.js';

const at='2026-10-29T12:00:00.000Z',later='2026-10-29T15:00:00.000Z';
const recipe={id:'audit-cycle-r',original_title:'Pain original',updated_at:at};
const premiere={...recipe,original_title:'Première correction hors ligne',updated_at:'2026-10-29T14:00:00.000Z'};
const derniere={...recipe,original_title:'Dernière correction hors ligne',updated_at:later};
const entree=(seq,snapshot)=>({seq,user_id:'u',store:'recipes',id:recipe.id,op:'put',recipe_id:recipe.id,expected_cycle_id:null,updated_at:snapshot.updated_at,snapshot});
const conflit={id:'recipes:'+recipe.id,store:'recipes',record_id:recipe.id,kind:'cycle',local:premiere,server:{data:recipe,updated_at:at},at,note:'Copie à conserver entière'};
const owner={key:'user_id',value:'u'};
const retrait={store:'recipes',id:recipe.id,op:'lifecycle',recipe_id:recipe.id,operation_id:'audit-cycle-trash',base_cycle_id:null,action:'trash',at,seed:recipe};
const ecrire=(db,puts)=>db.mutate({origin:'remote',puts});

// Le second onglet écrit avec la même vraie base juste avant l'ouverture de la transaction testée.
async function intercaler(db,quand,faire,test){
  const mutate=db.mutate.bind(db);let n=0;
  db.mutate=async options=>{if(quand(options,n)){n++;await faire(mutate,n);}return mutate(options);};
  try{return await test(()=>n);}finally{db.mutate=mutate;}
}
const ecritConflit=(o,id)=>o.puts?.sync_conflicts?.some(c=>c.id===id)||o.conditions?.sync_conflicts?.some(c=>c.key===id);

export async function runAuditCycleConflitsTests({eq,ok}){
  await withRepo(async(repo,db)=>{
    await ecrire(db,{sync_state:[{key:'user_id',value:'u1'}],books:[{id:'audit-cycle-book',title:'Livre'}],recipes:[recipe],book_editions:[{id:'audit-cycle-ed',book_id:'audit-cycle-book'}]});
    await repo.save('recipes',recipe);await repo.save('book_editions',{id:'audit-cycle-ed',book_id:'audit-cycle-book'});
    const saved=await db.get('recipes',recipe.id),edition=await db.get('book_editions','audit-cycle-ed');
    const file=await db.getAll('outbox');
    eq(file.find(e=>e.store==='recipes')?.snapshot,saved,'audit B3 : le put de recipes emporte un instantané égal à la fiche enregistrée');
    eq(file.find(e=>e.store==='book_editions')?.snapshot,edition,'audit B3 : le put de book_editions emporte un instantané égal à la fiche enregistrée');
  });
  const entries=[entree(7,derniere),entree(2,premiere)],lot=(await composerLots(entries,async()=>recipe)).lots[0];
  eq(lot.elements[0].data,derniere,'audit B3 : deux puts dédoublonnés envoient le dernier instantané');
  const rejection={rejected:[{store:'recipes',id:recipe.id,reason:'cycle',server:{data:recipe}}]};
  const effets=appliquerReponse({lot,reponse:rejection,entreesParSeq:new Map(entries.map(e=>[e.seq,e])),fichesLocales:{[conflit.id]:recipe}});
  eq(effets.conflits[0].local,derniere,'audit B3 : sans conflit existant, le refus cycle journalise le dernier instantané envoyé');
  const legacy={...entree(7,derniere)};delete legacy.snapshot;
  eq(appliquerReponse({lot:{...lot,seqs:[7]},reponse:rejection,entreesParSeq:new Map([[7,legacy]]),fichesLocales:{[conflit.id]:derniere}}).conflits[0].local,derniere,'audit B3 : ancienne entrée sans instantané garde la copie locale disponible');

  await withDatabase(async db=>{
    const distant=creerTransportFactice({serveur:true});await distant.pousser([retrait]);
    await ecrire(db,{sync_state:[owner]});installCapture(db,{getUserId:()=> 'u'});
    for(const row of[premiere,derniere])await db.mutate({puts:{recipes:[row]},recettes:[{recipe_id:recipe.id,expected_cycle_id:null,records:[{store:'recipes',id:recipe.id}]}]});
    await createPull({db,transport:distant,getUserId:()=> 'u'}).recevoir();const avant=await db.get('sync_conflicts',conflit.id);
    eq(avant?.local,derniere,'audit B3 : réception du retrait conserve les dernières modifications hors ligne');
    await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
    eq(await db.get('sync_conflicts',conflit.id),avant,'audit B3 : le refus cycle suivant ne remplace pas le conflit créé à la réception');
    eq((await db.get('recipes',recipe.id)).lifecycle_id,retrait.operation_id,'audit B3 : conserver le conflit ne restaure pas implicitement la recette');
    eq((await db.getAll('outbox')).map(e=>e.last_error),['cycle','cycle'],'audit B3 : les deux intentions refusées restent en quarantaine');
  });

  for(const race of[false,true])await withDatabase(async db=>{
    await ecrire(db,{recipes:[derniere],outbox:[entree(7,derniere)],sync_state:[owner],...(!race?{sync_conflicts:[conflit]}:{})});
    const distant=creerTransportFactice({serveur:true});await distant.pousser([retrait]);
    await intercaler(db,(o,n)=>race&&!n&&o.origin==='remote'&&ecritConflit(o,conflit.id),mutate=>mutate({origin:'remote',puts:{sync_conflicts:[conflit]}}),async nombre=>{
      await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
      eq(nombre(),race?1:0,`audit B3 : insertion concurrente avant refus ${race?'exercée':'absente'}`);
      eq(await db.get('sync_conflicts',conflit.id),conflit,`audit B3 : refus préserve le conflit cycle ${race?'arrivé dans la transaction':'préexistant'} entier`);
    });
  });

  for(const race of[false,true])await withDatabase(async db=>{
    const renvoye={...conflit,kind:'donnees',renvoye:true};
    await ecrire(db,{recipes:[derniere],outbox:[entree(7,derniere)],sync_state:[owner],sync_conflicts:[renvoye]});
    const distant=creerTransportFactice({serveur:true});let appels=0;
    await intercaler(db,(o,n)=>race&&!n&&o.origin==='remote'&&o.deletes?.outbox?.includes(7),mutate=>mutate({origin:'remote',puts:{sync_conflicts:[conflit]}}),async nombre=>{
      await createPush({db,transport:{pousser:rows=>{appels++;return distant.pousser(rows);}},getUserId:()=> 'u'}).envoyer();
      eq(nombre(),race?1:0,`audit B3 : remplacement du renvoyé ${race?'exercé':'absent'} avant accusé`);
      eq(await db.get('sync_conflicts',conflit.id),race?conflit:undefined,`audit B3 : accusé ${race?'conserve le cycle concurrent':'range le conflit renvoyé ordinaire'}`);
      eq(await db.get('outbox',7),undefined,'audit B3 : accusé retire son entrée après arbitrage du conflit');
      eq(appels,1,'audit B3 : relecture transactionnelle de l’accusé ne répète aucun envoi réseau');
    });
  });
  await withDatabase(async db=>{
    const renvoye={...conflit,kind:'donnees',renvoye:true};
    await ecrire(db,{recipes:[derniere],outbox:[entree(7,derniere)],sync_state:[owner],sync_conflicts:[renvoye]});
    const distant=creerTransportFactice({serveur:true});let appels=0,error;
    await intercaler(db,o=>o.origin==='remote'&&o.deletes?.outbox?.includes(7),(mutate,n)=>mutate({origin:'remote',puts:{sync_conflicts:[{...renvoye,revision:n}]}}),async nombre=>{
      try{await createPush({db,transport:{pousser:rows=>{appels++;return distant.pousser(rows);}},getUserId:()=> 'u'}).envoyer();}catch(e){error=e;}
      eq(error?.code,'SYNC_CONFLICT_CHANGED','audit B3 : conflit modifié à chaque tentative refuse avec le motif exact');
      eq(nombre(),4,'audit B3 : relecture de l’accusé bornée à trois reprises');
      eq(appels,1,'audit B3 : même en conflit persistant un seul POST est effectué');
      ok(!!await db.get('outbox',7),'audit B3 : échec d’arbitrage conserve l’entrée pour une reprise');
    });
  });
  await withDatabase(async db=>{
    await ecrire(db,{recipes:[derniere],outbox:[entree(7,derniere)],sync_state:[owner],sync_conflicts:[{...conflit,kind:'donnees',renvoye:true}]});
    const distant=creerTransportFactice({serveur:true});let user='u',appels=0,error;
    await intercaler(db,(o,n)=>!n&&o.origin==='remote'&&o.deletes?.outbox?.includes(7),async mutate=>{
      await mutate({origin:'remote',puts:{sync_conflicts:[conflit],sync_state:[{key:'user_id',value:'autre'}]}});user='autre';
    },async nombre=>{
      try{await createPush({db,transport:{pousser:rows=>{appels++;return distant.pousser(rows);}},getUserId:()=>user}).envoyer();}catch(e){error=e;}
      eq(nombre(),1,'audit B3 : changement de compte exercé avant reprise de l’accusé');
      eq(error?.message,'Compte de synchronisation changé','audit B3 : reprise de l’accusé conserve le propriétaire original');
      eq(await db.get('outbox',7),entree(7,derniere),'audit B3 : ancien accusé ne retire aucune entrée sous le nouveau compte');
      eq(await db.get('sync_conflicts',conflit.id),conflit,'audit B3 : changement de compte ne touche pas le conflit reçu');
      eq(appels,1,'audit B3 : changement de compte ne renvoie pas la charge du compte précédent');
    });
  });

  await withDatabase(async db=>{
    await ecrire(db,{recipes:[derniere],sync_state:[owner]});const distant=creerTransportFactice({serveur:true});await distant.pousser([retrait]);
    await intercaler(db,(o,n)=>!n&&o.origin==='remote'&&o.puts?.sync_state?.some(s=>s.key==='cursor:recipes'),mutate=>mutate({origin:'remote',puts:{sync_conflicts:[conflit]}}),async nombre=>{
      await createPull({db,transport:distant,getUserId:()=> 'u'}).recevoir();
      eq(nombre(),1,'audit B3 : insertion du conflit juste avant la transaction de réception exercée');
      eq(await db.get('sync_conflicts',conflit.id),conflit,'audit B3 : réception conserve le conflit cycle concurrent entier');
      eq((await db.get('recipes',recipe.id)).lifecycle_id,retrait.operation_id,'audit B3 : réception applique néanmoins le retrait confirmé');
    });
  });
  await withDatabase(async db=>{
    await ecrire(db,{recipes:[derniere],sync_state:[owner]});const distant=creerTransportFactice({serveur:true}),pull=createPull({db,transport:distant,getUserId:()=> 'u'});
    await distant.pousser([retrait]);await pull.recevoir();const avant=await db.get('sync_conflicts',conflit.id);
    await distant.pousser([{...retrait,operation_id:'audit-cycle-restore',base_cycle_id:retrait.operation_id,action:'restore',at:later}]);await pull.recevoir();
    eq(await db.get('sync_conflicts',conflit.id),avant,'audit B3 : une restauration reçue ensuite garde le premier conflit récupérable');
    eq((await db.get('recipes',recipe.id)).lifecycle_id,'audit-cycle-restore','audit B3 : la restauration distante continue de converger');
  });

  for(const edition of[false,true])await withDatabase(async db=>{
    const store=edition?'book_editions':'recipes',id=edition?'audit-cycle-ed':recipe.id,base=edition?{id,book_id:'audit-cycle-book',title:'Livre',updated_at:at}:recipe;
    const local={...base,lifecycle_id:'local-trash',trashed_at:later,...(edition?{trash_mode:'keep_recipes'}:{})};
    const c={...conflit,id:store+':'+id,store,record_id:id};
    const payload={...(edition?{entity:'edition',edition_id:id,mode:'keep_recipes'}:{recipe_id:id}),operation_id:'local-trash',base_cycle_id:null,action:'trash',at:later,seed:base};
    await ecrire(db,{[store]:[local],sync_state:[owner],sync_conflicts:[c],outbox:[{seq:7,user_id:'u',store,id,op:'lifecycle',payload}]});
    const distant=creerTransportFactice({serveur:true});if(edition)await distant.pousser([{store:'books',id:base.book_id,data:{id:base.book_id,title:'Livre'},updated_at:at}]);
    await distant.pousser([{store,id,op:'lifecycle',...payload,operation_id:'remote-trash'}]);
    await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
    eq(await db.get('sync_conflicts',c.id),c,`audit B3 : refus d’une commande ${edition?'édition':'recette'} conserve aussi le conflit antérieur`);
    eq((await db.get('outbox',7)).lifecycle_blocked,true,'audit B3 : commande refusée reste présente et bloquée');
  });
  await withDatabase(async db=>{
    const payload={recipe_id:recipe.id,operation_id:'local-trash',base_cycle_id:null,action:'trash',at:later,seed:derniere};
    await ecrire(db,{recipes:[{...derniere,lifecycle_id:'local-trash',trashed_at:later}],sync_state:[owner],sync_conflicts:[conflit],outbox:[entree(1,premiere),entree(2,derniere),{seq:7,user_id:'u',store:'recipes',id:recipe.id,op:'lifecycle',payload}]});
    const distant=creerTransportFactice({serveur:true});await distant.pousser([{store:'recipes',id:recipe.id,data:recipe,updated_at:at}]);
    await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
    eq(await db.get('sync_conflicts',conflit.id),conflit,'audit B3 : commande acceptée sans adopter son seed conserve le conflit antérieur');
    eq((await db.getAll('outbox')).map(e=>[e.seq,e.lifecycle_blocked]),[[1,true],[2,true]],'audit B3 : deux puts couverts par un seed non utilisé restent récupérables');
  });
  await withDatabase(async db=>{
    const book={id:'audit-cycle-source-book',title:'Livre'},edition={id:'audit-cycle-source-ed',book_id:book.id},r={...recipe,edition_id:edition.id};
    const session={id:'audit-cycle-session',edition_id:edition.id,recipe_ids:[r.id],document_ids:['audit-cycle-document'],page_ids:[]};
    const document={id:'audit-cycle-document',edition_id:edition.id,scan_session_id:session.id};
    const payload={store:'scan_sessions',id:session.id,op:'source_batch',operation_id:'audit-cycle-source-op',recipe_id:r.id,edition_id:edition.id,base_cycle_id:null,base_edition_cycle_id:null,base_session:null,rows:[{store:'scan_sessions',id:session.id,data:session,updated_at:at},{store:'source_documents',id:document.id,data:document,updated_at:at}]};
    const ancien={id:'source_batch:'+payload.operation_id,store:'scan_sessions',record_id:session.id,kind:'cycle',local:{...payload,description:'Copie ancienne à conserver'},at};
    await ecrire(db,{sync_state:[owner],sync_conflicts:[ancien],outbox:[{seq:7,user_id:'u',store:'scan_sessions',id:session.id,op:'source_batch',payload,recipe_id:r.id}]});
    const distant=creerTransportFactice({serveur:true});
    await distant.pousser([{store:'books',id:book.id,data:book,updated_at:at},{store:'book_editions',id:edition.id,data:edition,updated_at:at},{store:'recipes',id:r.id,data:r,updated_at:at}]);
    await distant.pousser([{store:'book_editions',id:edition.id,op:'lifecycle',entity:'edition',edition_id:edition.id,operation_id:'source-ed-trash',base_cycle_id:null,action:'trash',at:later,mode:'keep_recipes',seed:edition}]);
    await createPush({db,transport:distant,getUserId:()=> 'u'}).envoyer();
    eq(await db.get('sync_conflicts',ancien.id),ancien,'audit B3 : refus d’un lot de sources conserve aussi sa première copie');
    eq((await db.get('outbox',7)).lifecycle_blocked,true,'audit B3 : lot de sources refusé reste conservé dans la file');
  });
}
