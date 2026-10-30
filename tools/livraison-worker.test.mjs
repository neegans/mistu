import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {construireLivraison} from './generer-livraison.mjs';

const scope='https://exemple.test/mistu/';
function fixture(release='0.32.0-1') {
 const files=new Map(Object.entries({'index.html':`<meta name="mistu-release" content="${release}">`,'a.js':'export const a=1;','b.js':'export const b=2;'}).map(([k,v])=>[k,Buffer.from(v)]));
 const livraison=construireLivraison({files,roots:[...files.keys()],appVersion:'0.32.0'});
 return {files,...livraison};
}
function environnement(f=fixture(),options={}) {
 const stores=new Map(),events=new Map(),actions=[],notifications=[];let requetes=0;
 const caches={async has(n){await options.has?.(n);return stores.has(n)},async keys(){return [...stores.keys()]},async open(n){await options.open?.(n);if(!stores.has(n))stores.set(n,new Map());const rows=stores.get(n);return{async match(k){return rows.get(String(k))?.clone()},async put(k,r){await options.put?.(String(k),r);rows.set(String(k),r.clone());actions.push(['put',n,String(k)])},async keys(){await options.keys?.(n);return [...rows.keys()].map(k=>new Request(k))}}},async delete(n){await options.delete?.(n);actions.push(['delete',n]);return stores.delete(n)}};
 const self={registration:{scope},clients:{async matchAll(params){notifications.push(params);return options.clients||[]}},addEventListener(n,f){events.set(n,f)}};
 const context=vm.createContext({self,caches,crypto:webcrypto,TextEncoder,TextDecoder,URL,Request,Response,Headers,Map,Set,console,fetch:async request=>{requetes++;const path=new URL(request.url).pathname.slice('/mistu/'.length);if(options.fetch)return options.fetch(path,request,f);const e=f.manifest.entries.find(e=>e.path===path);return new Response(f.files.get(path),{headers:{'content-type':e.mime}})}});
 vm.runInContext(f.worker,context);
 async function dispatch(type,extra={}){let promise,response;events.get(type)({...extra,waitUntil(p){promise=p},respondWith(p){response=p}});await promise;return response?await response:undefined}
 return {stores,caches,actions,notifications,dispatch,context,requetes:()=>requetes,cache:()=>[...stores.keys()].find(n=>n.startsWith('mistu-shell-v1:'))};
}
test('installation relue puis statuts sans accès réseau, réponses strictes',async()=>{
 const e=environnement();await e.dispatch('install');assert.equal(e.stores.get(e.cache()).size,3);const before=e.requetes();let reply,closed=0;
 await e.dispatch('message',{data:{protocol:1,type:'shell_status',request_id:'test'},source:{type:'window',url:scope+'?secret=ne_pas_copier'},ports:[{postMessage(v){reply=v},close(){closed++}}]});
 assert.equal(reply.complete,true);assert.equal(e.requetes(),before);assert.equal(closed,1);assert.equal(Object.keys(reply).length,6);
 e.stores.get(e.cache()).delete(scope+'b.js');await e.dispatch('message',{data:{protocol:1,type:'shell_status',request_id:'test2'},source:{type:'window',url:scope},ports:[{postMessage(v){reply=v},close(){}}]});assert.equal(reply.complete,false);assert.equal(e.requetes(),before);
});
test('hit revérifié et query résolue vers les seuls octets attendus',async()=>{
 const e=environnement();await e.dispatch('install');let before=e.requetes();const r=await e.dispatch('fetch',{request:new Request(scope+'a.js?revision=B')});assert.equal(await r.text(),'export const a=1;');assert.equal(e.requetes(),before);
 e.stores.get(e.cache()).set(scope+'a.js',new Response('corruption',{headers:{'content-type':'text/javascript'}}));const repare=await e.dispatch('fetch',{request:new Request(scope+'a.js')});assert.equal(await repare.text(),'export const a=1;');assert.equal(e.requetes(),before+1);assert([...e.stores.get(e.cache()).keys()].every(k=>!k.includes('?')));
});
test('échec installation attend tous travaux avant suppression de sa tentative',async()=>{
 let liberer,commence,putTermine=false;const attente=new Promise(r=>liberer=r),enVol=new Promise(r=>commence=r);const e=environnement(fixture(),{async fetch(path,request,f){if(path==='a.js')throw Error('reseau');commence();await attente;return new Response(f.files.get(path),{headers:{'content-type':'text/javascript'}})},async put(){putTermine=true}});
 let fini=false;const install=e.dispatch('install').catch(()=>{fini=true});await enVol;await new Promise(r=>setImmediate(r));assert.equal(fini,false,'ne termine pas avant le lecteur restant');liberer();await install;assert.equal(putTermine,true);assert.equal([...e.stores.keys()].some(k=>k.startsWith('mistu-shell-v1:')),false);assert.equal(e.actions.at(-1)[0],'delete');
});
for(const type of ['mime','taille','sha','status','quota'])test('refus '+type+' sans suppression de cache étranger',async()=>{
 const e=environnement(fixture(),{async fetch(path,request,f){const data=f.files.get(path),entry=f.manifest.entries.find(x=>x.path===path);return new Response(type==='taille'?Buffer.concat([data,Buffer.from('x')]):type==='sha'?Buffer.alloc(data.length,120):data,{status:type==='status'?201:200,headers:{'content-type':type==='mime'?'application/json':entry.mime}})},async put(){if(type==='quota')throw new DOMException('quota','QuotaExceededError')}});e.stores.set('cache-inconnu',new Map());await assert.rejects(e.dispatch('install'));assert(e.stores.has('cache-inconnu'));assert.equal([...e.stores.keys()].filter(k=>k.startsWith('mistu-shell-v1:')).length,0);
});
test('activation naturelle ne supprime que précédent actif exact et garde étrangers',async()=>{
 const e=environnement();await e.dispatch('install');await e.dispatch('activate');const meta=[...e.stores.keys()].find(k=>k.startsWith('mistu-shell-meta-v1:'));const r=await e.stores.get(meta).values().next().value.clone().json();e.stores.set('étranger',new Map());const ancien='mistu-shell-v1:'+r.scope_sha256+':'+('a'.repeat(64));e.stores.set(ancien,new Map());r.active_cache=ancien;r.active_manifest_sha256='a'.repeat(64);e.stores.get(meta).set(scope+'.mistu-shell-meta',new Response(JSON.stringify(r)));await e.dispatch('activate');assert(!e.stores.has(ancien));assert(e.stores.has('étranger'));assert(e.stores.has(e.cache()));
});
for(const release of [null,'0.32.0-secret','0.32.0-1\n'])test('métadonnée release inconnue conservée '+JSON.stringify(release),async()=>{
 const e=environnement();await e.dispatch('install');await e.dispatch('activate');const meta=[...e.stores.keys()].find(k=>k.startsWith('mistu-shell-meta-v1:')),r=await e.stores.get(meta).values().next().value.clone().json();const ancien='mistu-shell-v1:'+r.scope_sha256+':'+('a'.repeat(64));e.stores.set(ancien,new Map());r.active_cache=ancien;r.active_manifest_sha256='a'.repeat(64);r.active_release=release;e.stores.get(meta).set(scope+'.mistu-shell-meta',new Response(JSON.stringify(r)));await e.dispatch('activate');assert(e.stores.has(ancien));
});

test('audit I2 : purge historique limitée aux caches vides ou entièrement dans notre portée',async()=>{
 const e=environnement();await e.dispatch('install');const courant=e.cache(),locaux=['cuisine-os-v0.31.0-1','cuisine-os-v0.32.0-5'],gardes=['cuisine-os-meta','cache-inconnu','mistu-shell-v1:autre:attente','mistu-shell-v1:ici:installation','cuisine-os-vetranger','cuisine-os-vmixte','cuisine-os-vprefixe'];
 e.stores.set(locaux[0],new Map([[scope+'index.html',new Response('ancien')],[scope+'src/app.js',new Response('ancien')]]));e.stores.set(locaux[1],new Map());
 for(const n of gardes)e.stores.set(n,new Map());
 e.stores.set('cuisine-os-vetranger',new Map([['https://exemple.test/autre/index.html',new Response('autre')]]));
 e.stores.set('cuisine-os-vmixte',new Map([[scope+'index.html',new Response('ici')],['https://ailleurs.test/mistu/index.html',new Response('ailleurs')]]));
 e.stores.set('cuisine-os-vprefixe',new Map([['https://exemple.test/mistu-autre/index.html',new Response('autre')]]));
 await e.dispatch('activate');for(const n of locaux)assert(!e.stores.has(n),n+' purgé');for(const n of [...gardes,courant])assert(e.stores.has(n),n+' conservé');
});
test('audit I2 : une inspection ou suppression refusée ne bloque pas les autres caches',async()=>{
 const e=environnement(fixture(),{async keys(n){if(n==='cuisine-os-villisible')throw Error('interdit')},async delete(n){if(n==='cuisine-os-vrefuse')throw Error('interdit')},async open(n){if(n.startsWith('mistu-shell-meta-v1:'))throw Error('meta indisponible')}});
 await e.dispatch('install');for(const n of ['cuisine-os-villisible','cuisine-os-vrefuse','cuisine-os-vsuivant'])e.stores.set(n,new Map());
 await e.dispatch('activate');assert(e.stores.has('cuisine-os-villisible'));assert(e.stores.has('cuisine-os-vrefuse'));assert(!e.stores.has('cuisine-os-vsuivant'));assert(e.stores.has(e.cache()));
});
test('audit I5 : échec signalé aux fenêtres de la portée y compris non contrôlées',async()=>{
 const f=fixture(),recus=[],clients=[{type:'window',url:scope,postMessage(){throw Error('fenêtre fermée')}},{type:'window',url:scope+'?code=secret#recette',postMessage:d=>recus.push(d)},{type:'window',url:'https://exemple.test/autre/',postMessage:d=>recus.push({...d,etranger:true})},{type:'window',url:'https://ailleurs.test/mistu/',postMessage:d=>recus.push({...d,etranger:true})}];
 const e=environnement(f,{clients,fetch:async()=>new Response('invalide',{headers:{'content-type':'text/plain'}})});await assert.rejects(e.dispatch('install'),/shell_invalid/);
 assert.equal(e.notifications.length,1);assert.equal(JSON.stringify(e.notifications[0]),JSON.stringify({type:'window',includeUncontrolled:true}));
 assert.equal(JSON.stringify(recus),JSON.stringify([{type:'livraison_echec',scope,release:f.manifest.release,manifest_sha256:f.manifestSha,raison:'shell_invalid'}]));assert.equal(e.cache(),undefined);
});
for(const phase of ['open','put'])test('audit I5 : quota '+phase+' signalé sans texte de l’exception',async()=>{
 const recus=[],e=environnement(fixture(),{clients:[{type:'window',url:scope,postMessage:d=>recus.push(d)}],[phase]:async()=>{throw new DOMException('secret dans erreur','QuotaExceededError')}});
 await assert.rejects(e.dispatch('install'));assert.equal(recus[0]?.raison,'quota');assert(!JSON.stringify(recus).includes('secret'));assert.equal(e.cache(),undefined);
});
test('audit I5 : nettoyage refusé conserve le motif initial et notifie encore',async()=>{
 const recus=[],e=environnement(fixture(),{clients:[{type:'window',url:scope,postMessage:d=>recus.push(d)}],fetch:async()=>{throw Error('adresse privée')},delete:async()=>{throw Error('nettoyage privé')}});
 await assert.rejects(e.dispatch('install'),/adresse privée/);assert.equal(recus[0]?.raison,'indisponible');assert(!JSON.stringify(recus).includes('privée'));
});
test('audit I5 : lecture impossible ne supprime pas une coquille déjà complète inconnue',async()=>{
 const recus=[];let refuser=false;const e=environnement(fixture(),{clients:[{type:'window',url:scope,postMessage:d=>recus.push(d)}],has:async()=>{if(refuser)throw Error('lecture')}});await e.dispatch('install');const cache=e.cache();refuser=true;
 await assert.rejects(e.dispatch('install'),/lecture/);assert.equal(recus[0]?.raison,'indisponible');assert(e.stores.has(cache));
});
