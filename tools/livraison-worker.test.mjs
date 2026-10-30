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
 const stores=new Map(),events=new Map(),actions=[];let requetes=0;
 const caches={async has(n){return stores.has(n)},async open(n){if(!stores.has(n))stores.set(n,new Map());const rows=stores.get(n);return{async match(k){return rows.get(String(k))?.clone()},async put(k,r){await options.put?.(String(k),r);rows.set(String(k),r.clone());actions.push(['put',n,String(k)])},async keys(){return [...rows.keys()].map(k=>new Request(k))}}},async delete(n){actions.push(['delete',n]);return stores.delete(n)}};
 const self={registration:{scope},addEventListener(n,f){events.set(n,f)}};
 const context=vm.createContext({self,caches,crypto:webcrypto,TextEncoder,TextDecoder,URL,Request,Response,Headers,Map,Set,console,fetch:async request=>{requetes++;const path=new URL(request.url).pathname.slice('/mistu/'.length);if(options.fetch)return options.fetch(path,request,f);const e=f.manifest.entries.find(e=>e.path===path);return new Response(f.files.get(path),{headers:{'content-type':e.mime}})}});
 vm.runInContext(f.worker,context);
 async function dispatch(type,extra={}){let promise,response;events.get(type)({...extra,waitUntil(p){promise=p},respondWith(p){response=p}});await promise;return response?await response:undefined}
 return {stores,caches,actions,dispatch,context,requetes:()=>requetes,cache:()=>[...stores.keys()].find(n=>n.startsWith('mistu-shell-v1:'))};
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
