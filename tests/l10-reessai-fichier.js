import {withRepo} from './sync-fixture.js';
import {createMoteur} from '../src/sync/moteur.js';
export async function runL10ReessaiFichierTests({eq,ok}){
 for(const changement of ['sens','motif','absente','compte','arret','exact'])await withRepo(async(repo,db)=>{
  const sha='a'.repeat(64),cle='file_error:'+sha,attendue={key:cle,value:{sens:'reception',motif:'reseau',at:'2026-10-30T00:00:00.000Z'}};
  await db.mutate({origin:'device',puts:{sync_state:[attendue,{key:'user_id',value:'u1'}]}});let uid='u1',writes=0,moteur,injecte=false;
  const wrapper={get:db.get.bind(db),getSnapshot:db.getSnapshot.bind(db),getAll:db.getAll.bind(db),mutate:async options=>{
   if(options.deletes?.sync_state?.includes(cle)&&!injecte){injecte=true;if(changement==='sens'||changement==='motif')await db.mutate({origin:'device',puts:{sync_state:[{...attendue,value:{...attendue.value,...(changement==='sens'?{sens:'envoi'}:{motif:'quota'})}}]}});if(changement==='absente')await db.mutate({origin:'device',deletes:{sync_state:[cle]}});if(changement==='compte')uid='u2';if(changement==='arret')void moteur.arreter();}
   const r=await db.mutate(options);if(options.deletes?.sync_state?.includes(cle))writes++;return r;
  }};
  moteur=createMoteur({db:wrapper,getUserId:()=>uid,transport:{lire:async()=>({lignes:[]}),pousser:async()=>({reponse:{accepted:[],rejected:[]}})}});
  const r=await moteur.reessayerFichier(sha,{erreurAttendue:attendue,sensAttendu:'reception'});
  if(changement==='exact'){eq(await db.get('sync_state',cle),undefined,'L10 réessai : erreur exacte retirée');eq(writes,1,'L10 réessai : une transaction exacte');}
  else{ok(r.refuse||r.erreur?.type==='arrete','L10 réessai : '+changement+' refuse causalement');eq(writes,0,'L10 réessai : '+changement+' ne supprime ni ne relance');if(changement==='sens')eq((await db.get('sync_state',cle))?.value?.sens,'envoi','L10 réessai : nouvelle erreur envoi reste entière');}
  await moteur.arreter();
 });
 await withRepo(async(repo,db)=>{const cle='file_error:'+'b'.repeat(64);await db.mutate({origin:'device',puts:{sync_state:[{key:cle,value:{sens:'reception'}}]}});const m=createMoteur({db,getUserId:()=> 'u1',transport:{}});await m.reessayerFichier('b'.repeat(64));eq(await db.get('sync_state',cle),undefined,'L10 : ancien appel sans options conserve son contrat');await m.arreter();});
}
