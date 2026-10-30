// Métier réel, sans SDK ni métadonnée de livraison : exclusivement sur une base jetable nommée.
const params=new URL(location.href).searchParams,name=params.get('base'),langue=params.get('langue');
async function preparer(){
 if(!/^audit-version-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(name||'')||!['fr-CA','en-CA'].includes(langue))throw Error('Paramètres de fixture invalides');
 const erreurs=[],exceptions=[];
 console.error=(code,details)=>erreurs.push({code,name:details?.name});
 addEventListener('error',e=>exceptions.push(e.error?.name||e.message));
 addEventListener('unhandledrejection',e=>exceptions.push(e.reason?.name||String(e.reason)));
 Object.defineProperty(navigator,'language',{value:langue,configurable:true});
 Object.defineProperty(navigator,'storage',{value:undefined,configurable:true});
 const repo=await import('../../src/model/repo.js');
 const {Database}=await import('../../src/core/db.js');
 const {DB_VERSION,STORES}=await import('../../src/model/schema.js');
 const bus=await import('../../src/core/bus.js');
 const racine=await import('../../src/core/racine-application.js');
 const db=new Database(name,DB_VERSION,STORES);repo.bindDatabase(db);
 window.fixture={name,repo,db,bus,racine,erreurs,exceptions,documentInitial:document};
 frameElement?.dispatchEvent(new Event('audit-pret'));
 await import('../../src/app.js');
}
void preparer().catch(error=>{
 window.fixtureErreur={name,message:error.message};
 frameElement?.dispatchEvent(new Event('audit-echec'));
});
