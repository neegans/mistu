// Vraie application dans un document isolé, uniquement sur une base jetable nommée.
const name=new URL(location.href).searchParams.get('base');
async function preparer(){
 if(!/^audit-import-route-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(name||''))throw Error('Base de fixture invalide');
 const repo=await import('../../src/model/repo.js'),{Database}=await import('../../src/core/db.js'),{STORES,DB_VERSION}=await import('../../src/model/schema.js');
 const {sourceEditeurL4}=await import('../l4-editeur-recette.js'),router=await import('../../src/core/router.js'),importUI=await import('../../src/ui/import.js'),state=await import('../../src/ui/state.js');
 const db=new Database(name,DB_VERSION,STORES);repo.bindDatabase(db);await repo.init();await repo.choisirSansCompte();await repo.setSetting('ui_locale','fr');
 const f=sourceEditeurL4(),sessionId='séance/+?é';
 await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],scan_sessions:[{id:sessionId,status:'open',page_ids:[],document_ids:[],recipe_ids:[],started_at:'2026-10-30T12:00:00.000Z'}]}});
 const exceptions=[],journal=[],vueImporter=[],dialogues=new Set();
 addEventListener('error',e=>exceptions.push(e.error?.name||e.message));addEventListener('unhandledrejection',e=>exceptions.push(e.reason?.name||String(e.reason)));
 console.error=(...args)=>journal.push(args.map(x=>typeof x==='string'?x:x?.name||x?.error?.name||'detail'));
 Object.defineProperty(navigator,'storage',{value:undefined,configurable:true});
 const fixture={name,db,repo,router,recipe:f.recipe,version:f.version,sessionId,importUI,state,exceptions,journal,vueImporter,dialogues,quota:false,refusQuota:0,posts:0,choixFichier:0,documentInitial:document};
 const muter=db.mutate.bind(db);db.mutate=args=>muter({...args,conditions:{...args.conditions,...(args.conditions?.sync_state?{sync_state:args.conditions.sync_state.map(c=>typeof c.fusion==='function'&&c.key?.startsWith('editor_draft:v1:')?{...c,fusion:(...lectures)=>{const r=c.fusion(...lectures);if(fixture.quota&&r!=null){fixture.refusQuota++;throw new DOMException('quota de fixture','QuotaExceededError');}return r;}}:c)}:{})}});
 const fetchOriginal=fetch;window.fetch=(url,options)=>{if(String(options?.method||'GET').toUpperCase()==='POST')fixture.posts++;return fetchOriginal(url,options);};
 const clic=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file')fixture.choixFichier++;return clic.call(this);};
 const observer=new MutationObserver(()=>{for(const d of document.querySelectorAll('[data-role=sortie-editeur]'))dialogues.add(d);if(document.querySelector('main h1')?.textContent==='Importer')vueImporter.push(location.hash);});observer.observe(document.body,{childList:true,subtree:true});
 fixture.fermer=()=>{document.querySelector('main')?.firstElementChild?.dispose?.();observer.disconnect();db.idb?.close();db.idb=null;};
 window.fixture=fixture;frameElement?.dispatchEvent(new Event('audit-pret'));
 await import('../../src/app.js');
}
void preparer().catch(error=>{window.fixtureErreur={name,message:error.stack||error.message};frameElement?.dispatchEvent(new Event('audit-echec'));});
