// Épreuves du contrôle réel et de la frontière réelle, sans worker réseau ni données privées.
export async function runAuditLivraisonEchecTests({eq,ok}){
 const api=await import('../src/core/livraison.js'),{demarrerApplication}=await import('../src/demarrage.js');
 const base='https://example.test/mistu/',hash='a'.repeat(64),suivant='b'.repeat(64),pause=()=>new Promise(r=>setTimeout(r,0));
 class Canal{constructor(){const a={start(){},close(){this.ferme=true}},b={...a};a.postMessage=data=>queueMicrotask(()=>!b.ferme&&b.onmessage?.({data}));b.postMessage=data=>queueMicrotask(()=>!a.ferme&&a.onmessage?.({data}));this.port1=a;this.port2=b}}
 const worker=(release='0.32.0-2',manifest_sha256=suivant,state='installing')=>{const w=new EventTarget();Object.assign(w,{scriptURL:base+'sw.js',state,complete:true,postMessage(req,ports){ports[0].postMessage({protocol:1,type:'shell_status',request_id:req.request_id,release,manifest_sha256,complete:w.complete})}});return w};
 const message=(sw,source,data)=>{const e=new Event('message');Object.defineProperties(e,{source:{value:source},data:{value:data}});sw.dispatchEvent(e)};
 const dto=extra=>({type:'livraison_echec',scope:base,release:'0.32.0-2',manifest_sha256:suivant,raison:'shell_invalid',...extra});
 function fixture(){const actif=worker('0.32.0-1',hash,'activated'),reg=new EventTarget(),sw=new EventTarget();Object.assign(reg,{scope:base,active:actif,waiting:null,installing:null});Object.assign(sw,{controller:actif,getRegistration:async()=>reg});const controle=api.creerControleLivraison({releasePage:'0.32.0-1',baseURL:base,serviceWorker:sw,MessageChannel:Canal,delaiMs:10});return{controle,reg,sw,actif}}
 const premier=fixture();premier.sw.controller=null;premier.sw.getRegistration=async()=>undefined;
 try{
  message(premier.sw,worker(),dto());let vue=await premier.controle.verifier();eq(vue.echec,{raison:'shell_invalid'},'audit I5 : premier échec avant lecture de registration conservé');
  eq((await premier.controle.verifier()).echec,{raison:'shell_invalid'},'audit I5 : relecture sans worker conserve le motif de cette page');
  ok(!!vue.echec&&Object.isFrozen(vue.echec),'audit I5 : motif public immuable');eq(Object.keys(vue.echec||{}),['raison'],'audit I5 : observation ne transporte ni worker ni portée ni texte libre');
 }finally{premier.controle.dispose()}
 const sain=fixture();try{
  await sain.controle.verifier();api.installerControleLivraison(sain.controle,{mode:'controlee',manifest_sha256:hash});await sain.controle.verifier();
  const rate=worker();sain.reg.installing=rate;sain.reg.dispatchEvent(new Event('updatefound'));await sain.controle.verifier();
  const notifications=[];sain.controle.observer(v=>notifications.push(v.etat));rate.state='redundant';sain.reg.installing=null;
  message(sain.sw,rate,dto());let vue=await sain.controle.verifier();eq([vue.etat,vue.echec?.raison,vue.controleur?.complete],['verifiee','shell_invalid',true],'audit I5 : échec B ne dégrade pas la preuve saine A');
  ok(notifications.every(v=>v==='verifiee'),'audit I5 : notification d’échec ne prétend pas changer de contrôleur');
  sain.sw.dispatchEvent(new Event('controllerchange'));vue=await sain.controle.verifier();eq(vue.echec?.raison,'shell_invalid','audit I5 : motif conservé après changement et relecture du contrôleur');
  const c=worker('0.32.0-3','c'.repeat(64));sain.reg.installing=c;sain.reg.dispatchEvent(new Event('updatefound'));await sain.controle.verifier();
  c.complete=false;c.state='installed';sain.reg.installing=null;sain.reg.waiting=c;c.dispatchEvent(new Event('statechange'));vue=await sain.controle.verifier();eq(vue.echec?.raison,'shell_invalid','audit I5 : état installed seul sans preuve complète ne retire pas l’échec');
  c.complete=true;vue=await sain.controle.verifier();eq(vue.echec,null,'audit I5 : tentative suivante complète retire l’échec obsolète');eq([vue.attente?.release,vue.etat],['0.32.0-3','verifiee'],'audit I5 : succès de C garde A contrôleur vérifié');
 }finally{sain.controle.dispose()}
 const ordre=fixture();try{
  await ordre.controle.verifier();const b=worker(),c=worker('0.32.0-3','c'.repeat(64));
  ordre.reg.installing=b;ordre.reg.dispatchEvent(new Event('updatefound'));await ordre.controle.verifier();message(ordre.sw,b,dto());
  ordre.reg.installing=c;ordre.reg.dispatchEvent(new Event('updatefound'));await ordre.controle.verifier();message(ordre.sw,c,dto({release:'0.32.0-3',manifest_sha256:'c'.repeat(64),raison:'quota'}));
  eq(ordre.controle.etat().echec?.raison,'quota','audit I5 : motif de la tentative C reçu avant le message ancien');
  message(ordre.sw,b,dto());eq(ordre.controle.etat().echec?.raison,'quota','audit I5 : ancien message B ne remplace pas le motif plus récent de C');
  ordre.reg.installing=null;ordre.reg.waiting=c;c.state='installed';c.dispatchEvent(new Event('statechange'));await ordre.controle.verifier();
  eq(ordre.controle.etat().echec,null,'audit I5 : réussite relue de C retire son erreur');
  message(ordre.sw,b,dto());eq(ordre.controle.etat().echec,null,'audit I5 : ancien message B ne ressuscite pas après réussite prouvée de C');
  await ordre.controle.verifier();message(ordre.sw,worker(),dto());eq(ordre.controle.etat().echec,null,'audit I5 : source inconnue refusée après réussite d’une tentative suivie');
 }finally{ordre.controle.dispose()}
 const meme=fixture();try{
  await meme.controle.verifier();const rate=worker();meme.reg.installing=rate;meme.reg.dispatchEvent(new Event('updatefound'));await meme.controle.verifier();message(meme.sw,rate,dto());
  meme.reg.installing=null;meme.reg.waiting=worker('0.32.0-2',suivant,'installed');eq((await meme.controle.verifier()).echec,null,'audit I5 : mêmes octets installés lors d’un nouvel essai retirent le motif');
 }finally{meme.controle.dispose()}
 const hostiles=[
  ['portée voisine',dto({scope:base+'autre/'}),worker()],['portée préfixe',dto({scope:base.slice(0,-1)+'-autre/'}),worker()],
  ['motif libre',dto({raison:'<img src=x onerror=alert(1)>'}),worker()],['release libre',dto({release:'secret'}),worker()],
  ['hash invalide',dto({manifest_sha256:'a'.repeat(64)+'\n'}),worker()],['champ supplémentaire',dto({secret:'non'}),worker()],
  ['champ manquant',(({scope,...v})=>v)(dto()),worker()],['type autre',dto({type:'shell_status'}),worker()],
  ['source absente',dto(),null],['script autre',dto(),Object.assign(worker(),{scriptURL:base+'autre.js'})],
  ['script avec query',dto(),Object.assign(worker(),{scriptURL:base+'sw.js?secret'})]
 ];
 for(const[nom,data,source]of hostiles){const f=fixture();try{message(f.sw,source,data);eq((await f.controle.verifier()).echec,null,'audit I5 : message refusé — '+nom)}finally{f.controle.dispose()}}
 const identite=fixture();try{
  await identite.controle.verifier();const attendu=worker();identite.reg.installing=attendu;identite.reg.dispatchEvent(new Event('updatefound'));await identite.controle.verifier();
  message(identite.sw,worker(),dto());eq((await identite.controle.verifier()).echec,null,'audit I5 : identité différente refusée quand la tentative est connue');
  for(const raison of ['shell_invalid','shell_incomplete','quota','indisponible']){message(identite.sw,attendu,dto({raison}));eq((await identite.controle.verifier()).echec,{raison},'audit I5 : motif fermé admis — '+raison)}
  const avant=identite.controle.etat();identite.controle.dispose();message(identite.sw,attendu,dto({raison:'quota'}));ok(identite.controle.etat()===avant,'audit I5 : dispose retire l’écoute des messages');
 }finally{identite.controle.dispose()}
 async function ecran(langue,pendantRegister=true,suspendreMetier=false){
  const doc=document.implementation.createHTMLDocument('Échec test'),app=doc.createElement('div'),meta=doc.createElement('meta');app.id='app';doc.body.append(app);meta.name='mistu-release';meta.content='0.32.0-1';doc.head.append(meta);
  const sw=new EventTarget(),reg=new EventTarget(),source=worker();let monte=0,recharges=0,terminerMetier;Object.assign(reg,{scope:base,active:null,waiting:null,installing:null});Object.assign(sw,{controller:null,getRegistration:async()=>reg,register:async()=>{if(pendantRegister)message(sw,source,dto());return reg}});
  const resultat=await demarrerApplication({document:doc,baseURL:base,langue,serviceWorker:sw,MessageChannel:Canal,sessionStorage:null,location:{reload(){recharges++}},delaiMs:10,delaiInstallation:1,chargerMetier:async({avantImport})=>{await avantImport();monte++;app.replaceChildren(doc.createElement('main'));if(suspendreMetier&&await new Promise(r=>terminerMetier=r))throw Error('import_indisponible')}});
  return{doc,app,sw,source,resultat,monte,recharges,terminerMetier:refus=>terminerMetier?.(refus)};
 }
 for(const langue of ['fr-CA','en-CA']){const f=await ecran(langue);try{
  eq([f.resultat.etat,f.monte,f.recharges],['choix',0,0],'audit I5 : premier échec laisse le choix sans métier ni reprise — '+langue);
  eq(f.app.querySelector('[data-role="livraison-echec"]')?.textContent,langue.startsWith('en')?'Offline installation failed (shell_invalid).':'Installation hors ligne impossible (shell_invalid).','audit I5 : raison réelle visible avant le métier — '+langue);
 }finally{f.resultat.controle.dispose()}}
 const tardif=await ecran('fr',false);try{
  const bouton=tardif.app.querySelector('button');message(tardif.sw,tardif.source,dto({raison:'quota'}));await pause();
  eq(tardif.app.querySelector('[data-role="livraison-echec"]')?.textContent,'Installation hors ligne impossible (quota).','audit I5 : motif tardif ajouté au choix déjà affiché');
  ok(tardif.app.querySelector('button')===bouton,'audit I5 : motif tardif préserve les gestes déjà affichés');
 }finally{tardif.resultat.controle.dispose()}
 const monte=await ecran('fr',true,true),montage=monte.resultat.continuerEnLigne();try{
  await pause();ok(!!monte.app.querySelector('main'),'audit I5 : import métier engagé après choix de continuer');
  message(monte.sw,monte.source,dto({raison:'quota'}));ok(!monte.app.querySelector('[data-role="livraison-echec"]'),'audit I5 : échec tardif ne s’insère pas dans le métier déjà monté');
  monte.terminerMetier(true);await montage;eq(monte.resultat.etat,'choix','audit I5 : import refusé revient au choix');
  eq(monte.app.querySelector('[data-role="livraison-echec"]')?.textContent,'Installation hors ligne impossible (quota).','audit I5 : retour au choix réaffiche le motif reçu pendant le montage');
 }finally{monte.terminerMetier();await montage;monte.resultat.controle.dispose()}
}
