// Modèle du formulaire bibliographique : aucune écriture et aucune réponse assistant.
import { validerIsbn } from '../core/isbn.js';
import { getConvention } from './units.js';

export const CHAMPS_LIVRE=Object.freeze(['title','author','cuisines','tags']);
export const CHAMPS_EDITION=Object.freeze(['isbn','publisher','year','language','unit_convention_id']);
const texte=x=>x==null?'':String(x);
const objet=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const bytes=x=>new TextEncoder().encode(x).length;
export function creerModeleLivre({book={},edition={}}={}){
 return {book:{title:texte(book.title),author:texte(book.author),cuisines:structuredClone(book.cuisines||[]),tags:structuredClone(book.tags||[])},
  edition:Object.fromEntries(CHAMPS_EDITION.map(k=>[k,texte(edition[k])]))};
}
export function validerModeleLivre(payload,{publication=false,maintenant=new Date().toISOString()}={}){
 const erreurs=[],erreur=(champ,raison='contenu_invalide')=>erreurs.push({champ,raison});
 if(!objet(payload)||Object.keys(payload).some(k=>!['book','edition'].includes(k)))return{ok:false,erreurs:[{champ:'',raison:'contenu_invalide'}]};
 for(const [groupe,champs]of[['book',CHAMPS_LIVRE],['edition',CHAMPS_EDITION]]){
  const row=payload[groupe];if(!objet(row)){erreur(groupe);continue;}
  if(Object.keys(row).some(k=>!champs.includes(k)))erreur(groupe);
  for(const k of champs){const v=row[k],champ=groupe+'.'+k;
   if(['cuisines','tags'].includes(k)){if(!Array.isArray(v)||v.length>4096||v.some(s=>typeof s!=='string'||bytes(s)>524288))erreur(champ);}
   else if(typeof v!=='string'||bytes(v)>524288)erreur(champ);
  }
 }
 if(erreurs.length)return{ok:false,erreurs};
 const modele=structuredClone(payload);
 if(publication){
  for(const groupe of ['book','edition'])for(const [k,v]of Object.entries(modele[groupe]))if(typeof v==='string')modele[groupe][k]=v.trim();
  if(!modele.book.title)erreur('book.title','titre_requis');
  const e=modele.edition,annee=new Date(typeof maintenant==='function'?maintenant():maintenant).getUTCFullYear();
  if(e.year&&(!/^\d{4}$/.test(e.year)||Number(e.year)<1000||Number(e.year)>annee+2))erreur('edition.year','annee_invalide');
  const isbn=validerIsbn(e.isbn);if(e.isbn&&!isbn.ok)erreur('edition.isbn','isbn_invalide');
  if(e.unit_convention_id&&!getConvention(e.unit_convention_id))erreur('edition.unit_convention_id','convention_invalide');
  e.year=e.year?Number(e.year):null;e.isbn=e.isbn&&isbn.ok?isbn.isbn13:null;
  for(const k of ['publisher','language','unit_convention_id'])e[k]=e[k]||null;
 }
 return{ok:!erreurs.length,modele,erreurs};
}
export function decrireChangementsLivre({base,payload}){
 return [['book',CHAMPS_LIVRE],['edition',CHAMPS_EDITION]].flatMap(([groupe,champs])=>champs.filter(k=>JSON.stringify(base?.[groupe]?.[k])!==JSON.stringify(payload?.[groupe]?.[k])).map(k=>groupe+'.'+k));
}
