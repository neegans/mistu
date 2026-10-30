// Contrat public de livraison, sans accès aux données de l'application.
export const LIMITES_LIVRAISON=Object.freeze({entrees:1024,manifeste:1048576,total:33554432,fichier:8388608,release:80,requestId:128,delai:5000,delaiMax:10000});
export class ErreurLivraison extends Error{constructor(raison){super(raison);this.name='ErreurLivraison';this.raison=raison;}}
const refuser=raison=>{throw new ErreurLivraison(raison)};
const objet=x=>x&&typeof x==='object'&&!Array.isArray(x);
const ferme=(x,cles)=>objet(x)&&Object.keys(x).length===cles.length&&cles.every(k=>Object.hasOwn(x,k));
const exact=(re,s)=>typeof s==='string'&&re.exec(s)?.[0]===s;
export const releaseValide=s=>typeof s==='string'&&s.length<=80&&exact(/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-[1-9]\d*$/,s);
export const tokenLivraisonValide=s=>typeof s==='string'&&s.length<=128&&exact(/^[A-Za-z0-9_-]+$/,s);
const hash=s=>exact(/^[a-f0-9]{64}$/,s);
const encodeur=new TextEncoder();
export function comparerCheminsLivraison(a,b){const aa=encodeur.encode(a),bb=encodeur.encode(b);for(let i=0;i<Math.min(aa.length,bb.length);i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return aa.length-bb.length;}
export function cheminLivraisonValide(path){return typeof path==='string'&&path.length>0&&!/[\u0000-\u0020\u007f%?#\\]/.test(path)&&!/[\uD800-\uDFFF]/u.test(path)&&path.split('/').every(s=>s&&s!=='.'&&s!=='..')&&!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path);}
export function mimeLivraison(path){return ({html:'text/html',css:'text/css',js:'text/javascript',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'})[path.split('.').at(-1)]||null;}
export function mimeLivraisonAdmis(recu,attendu){const essence=typeof recu==='string'?recu.split(';')[0].trim().toLowerCase():'';return essence===attendu||attendu==='text/javascript'&&essence==='application/javascript';}
export function validerManifesteLivraison(value){
 if(!ferme(value,['format','release','entries'])||value.format!==1||!releaseValide(value.release)||!Array.isArray(value.entries)||!value.entries.length||value.entries.length>LIMITES_LIVRAISON.entrees)refuser('manifeste_invalide');
 let total=0,precedent=null,index=0;const entries=[];
 for(const x of value.entries){if(!ferme(x,['path','bytes','sha256','mime'])||!cheminLivraisonValide(x.path)||['sw.js','livraison-manifeste.json'].includes(x.path)||!Number.isSafeInteger(x.bytes)||x.bytes<=0||x.bytes>LIMITES_LIVRAISON.fichier||!hash(x.sha256)||!mimeLivraison(x.path)||x.mime!==mimeLivraison(x.path)||precedent!==null&&comparerCheminsLivraison(precedent,x.path)>=0)refuser('entree_invalide');
  precedent=x.path;total+=x.bytes;if(x.path==='index.html')index++;entries.push({path:x.path,bytes:x.bytes,sha256:x.sha256,mime:x.mime});}
 const copie={format:1,release:value.release,entries};if(index!==1||total>LIMITES_LIVRAISON.total||encodeur.encode(JSON.stringify(copie)).length>LIMITES_LIVRAISON.manifeste)refuser('borne_manifeste');return copie;
}
export const serialiserManifesteLivraison=value=>JSON.stringify(validerManifesteLivraison(value));
export async function empreinteManifesteLivraison(value){const bytes=encodeur.encode(serialiserManifesteLivraison(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function normaliserPorteeLivraison(baseURL){let u;try{u=new URL(baseURL)}catch{refuser('portee_incompatible')};if(typeof baseURL!=='string'||!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||!u.pathname.endsWith('/')||u.href!==baseURL||/%2f|%5c/i.test(u.pathname))refuser('portee_incompatible');return u.href;}
export function validerReponseCoquille(value,{request_id}={}){if(!ferme(value,['protocol','type','request_id','release','manifest_sha256','complete'])||value.protocol!==1||value.type!=='shell_status'||!tokenLivraisonValide(value.request_id)||value.request_id!==request_id||!releaseValide(value.release)||!hash(value.manifest_sha256)||typeof value.complete!=='boolean')refuser('reponse_invalide');return{protocol:1,type:'shell_status',request_id:value.request_id,release:value.release,manifest_sha256:value.manifest_sha256,complete:value.complete};}
