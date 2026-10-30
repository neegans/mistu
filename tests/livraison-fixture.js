// Inventaire réellement servi : les anciens filets gardent leur périmètre depuis le manifeste L10.
import {validerManifesteLivraison} from '../src/core/livraison-format.js';
export async function lireLivraison(fetcher=globalThis.fetch){
 const response=await fetcher(new URL('../livraison-manifeste.json',import.meta.url),{cache:'no-store'});
 if(!response.ok)throw Error('Manifeste de livraison : HTTP '+response.status);
 const texte=await response.text(),manifeste=validerManifesteLivraison(JSON.parse(texte));
 return{...manifeste,octets:new TextEncoder().encode(texte).length,chemins:manifeste.entries.map(e=>'./'+e.path),modules:manifeste.entries.map(e=>e.path).filter(p=>p.startsWith('src/')&&p.endsWith('.js'))};
}
