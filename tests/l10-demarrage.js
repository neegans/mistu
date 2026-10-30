export async function runL10DemarrageTests({eq,ok}){
 let api;try{api=await import('../src/demarrage.js')}catch{ok(false,'L10 démarrage : module disponible');return}
 const {obtenirControleLivraison}=await import('../src/core/livraison.js');
 const base='https://example.test/mistu/',hash='a'.repeat(64);
 class Canal{constructor(){const a={start(){},close(){this.ferme=true}},b={...a};a.postMessage=data=>queueMicrotask(()=>!b.ferme&&b.onmessage?.({data}));b.postMessage=data=>queueMicrotask(()=>!a.ferme&&a.onmessage?.({data}));this.port1=a;this.port2=b}}
 async function scenario({controller=true,stockage=true,ancienMarqueur=false,muet=false,mismatch=false,indisponible=false,registerAttente=false}={}){
  const doc=document.implementation.createHTMLDocument('Test'),app=doc.createElement('div');app.id='app';doc.body.append(app);const meta=doc.createElement('meta');meta.name='mistu-release';meta.content='0.32.0-1';doc.head.append(meta);
  const w=new EventTarget(),reg=new EventTarget(),sw=new EventTarget(),mounts=[],navigations=[],entries=new Map();let busyAuMontage;if(ancienMarqueur)entries.set('mistu-demarrage-v1:'+base,'1');
  Object.assign(w,{scriptURL:base+'sw.js',state:'activated',postMessage(req,ports){if(!muet)ports[0].postMessage({protocol:1,type:'shell_status',request_id:req.request_id,release:mismatch?'0.31.0-1':'0.32.0-1',manifest_sha256:hash,complete:true})}});Object.assign(reg,{scope:base,active:w,waiting:null,installing:null});Object.assign(sw,{controller:controller?w:null,getRegistration:async()=>reg,register:async(url,options)=>{if(registerAttente)return new Promise(()=>{});eq([url,options],[base+'sw.js',{scope:base,updateViaCache:'none'}],'L10 register exact sans activation forcée');return reg}});
  const service=await api.demarrerApplication({document:doc,baseURL:base,location:{href:base+'?code=secret#/x',reload(){navigations.push(base+'?code=secret#/x')}},sessionStorage:{getItem(k){if(!stockage)throw Error('interdit');return entries.get(k)},setItem(k,v){if(!stockage)throw Error('interdit');entries.set(k,v)},removeItem(k){entries.delete(k)}},serviceWorker:indisponible?null:sw,MessageChannel:Canal,delaiMs:5,delaiInstallation:5,chargerMetier:async({avantImport})=>{await avantImport();busyAuMontage=app.getAttribute('aria-busy');mounts.push(obtenirControleLivraison()?.etat()?.execution.mode)}});
  return{service,mounts,navigations,entries,doc,busyAuMontage,dispose(){obtenirControleLivraison()?.dispose();service.controle?.dispose()}};
 }
 let s=await scenario();eq(s.mounts,['controlee'],'L10 aucun métier avant preuve et admission');eq(s.busyAuMontage,null,'L10 la disponibilité du métier ne reste pas masquée par le chargement initial');eq(s.entries.size,0,'L10 preuve contrôlée efface seulement marqueur');s.dispose();
 s=await scenario({controller:false});eq([s.service.etat,s.mounts.length,s.navigations.length],['reprise',0,1],'L10 première visite reprend une fois sans monter métier');ok([...s.entries].every(([k,v])=>!k.includes('secret')&&v==='1'),'L10 marqueur ne contient ni URL complète ni jeton');s.dispose();
 s=await scenario({controller:false,ancienMarqueur:true});eq([s.service.etat,s.navigations.length,s.mounts.length],['choix',0,0],'L10 reprise déjà tentée sans boucle');await s.service.continuerEnLigne();eq(s.mounts,['en_ligne_non_verifiee'],'L10 continuer en ligne exige geste explicite');s.dispose();
 s=await scenario({controller:false,stockage:false});eq([s.service.etat,s.navigations.length],['choix',0],'L10 stockage interdit ne provoque pas reprise automatique');s.dispose();
 s=await scenario({mismatch:true});eq([s.service.etat,s.mounts.length,s.navigations.length],['reprise',0,1],'L10 HTML B contrôlé A reprend document sans mélange');s.dispose();
 s=await scenario({muet:true});eq([s.service.etat,s.mounts.length,s.navigations.length],['choix',0,0],'L10 ancien worker muet ne certifie ni ne boucle');s.dispose();
 s=await scenario({registerAttente:true});eq(s.mounts,['controlee'],'L10 register suspendu : contrôleur déjà valide utilisable après borne');s.dispose();
 s=await scenario({indisponible:true});eq([s.service.etat,s.mounts.length],['choix',0],'L10 API absente reste choix explicite');s.dispose();
}
