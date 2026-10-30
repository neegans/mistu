// Le bilan est une observation locale, jamais un certificat conservé ni une commande métier.
import {portionsRepas} from './thermomix-session.js';
import {lireEtatRecette} from './cycle-edition.js';
import {projectionCandidateTraduction} from './traductions-format.js';
export const LIMITES_HORS_LIGNE=Object.freeze({occurrences:1000,lignes:10000,octets:16*1024*1024,detail:50,ids:64,decodages:2,delai:30000});
const copie=x=>structuredClone(x),sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function egalesLecturesHorsLigne(a,b){
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a)&&a.length!==b.length)return false;const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&egalesLecturesHorsLigne(a[k],b[k]));
}
const champs=(row,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(row,k)).map(k=>[k,copie(row[k])]));
const sansTechnique=row=>{const r=copie(row);delete r.updated_at;return r;};
export function projectionDonneesHorsLigne(donnees){
 const d=copie(donnees),ordre=rows=>(rows||[]).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 d.recettes=ordre((d.recettes||[]).map(r=>champs(r,['id','edition_id','original_title','display_title','original_language','availability','source_page_ids','source_url','photo_sha256','photo_origin','personal_notes','lifecycle_id','trashed_at','removed_by_edition','restored_from_edition'])));
 d.versions=ordre((d.versions||[]).map(sansTechnique));d.traductions=ordre(d.traductions).map(projectionCandidateTraduction);
 for(const k of ['editions','cuissons','pages','documents'])d[k]=ordre((d[k]||[]).map(sansTechnique));return d;
}
export function projectionRepasHorsLigne(meal){return champs(meal,['id','title','servings','serve_at','planned_on','archived_at','items']);}
export function preparerPerimetreHorsLigne({meal,donnees={},choix={}}={}){
 if(!meal||!Array.isArray(meal.items))return{issue:'refuse',raison:'repas_invalide'};
 if(meal.items.length>LIMITES_HORS_LIGNE.occurrences||Object.values(donnees).filter(Array.isArray).reduce((n,r)=>n+r.length,0)>LIMITES_HORS_LIGNE.lignes)return{issue:'refuse',raison:'volume_non_verifie'};
 let taille;try{taille=new TextEncoder().encode(JSON.stringify({meal,donnees})).length;}catch{return{issue:'refuse',raison:'donnees_invalides'};}if(taille>LIMITES_HORS_LIGNE.octets)return{issue:'refuse',raison:'volume_non_verifie'};
 const c={format:1,passe:Number.isSafeInteger(choix.passe)?choix.passe:0,capture_le:choix.capture_le??null,meal:projectionRepasHorsLigne(meal),...copie(donnees),choix:copie(choix),occurrences:[],usages:[],manques:[]};
 for(const k of ['recettes','versions','editions','traductions','cuissons','pages','documents'])c[k]??=[];
 const recettes=new Map(c.recettes.map(r=>[r.id,r])),versions=new Map(c.versions.map(r=>[r.id,r])),editions=new Map(c.editions.map(r=>[r.id,r]));
 const usage=(role,owner,ref)=>{if(ref==null||ref==='')return;if(!sha(ref)){c.manques.push({raison:'reference_media_invalide',id:owner});return;}c.usages.push({role,id:owner,sha256:ref});};
 c.occurrences=meal.items.map((it,ordinal)=>{const r=recettes.get(it.recipe_id),v=versions.get(it.recipe_version_id),choisi=choix.lectures?.[ordinal],locale=['original','fr','en'].includes(choisi?.locale)?choisi.locale:'original';
  let raison=null;if(!r)raison='recette_absente';else if(!v||v.recipe_id!==r.id)raison='version_absente';else if(r.availability==='reference_only'||!(v.ingredients?.length||v.steps?.length))raison='contenu_absent';else if(lireEtatRecette(r,editions.get(r.edition_id)).etat!=='active')raison='recette_retiree';
  return{ordinal,item_id:it.id??null,recipe_id:it.recipe_id,version_id:it.recipe_version_id??null,servings:portionsRepas(it,meal),locale,translation_id:choisi?.translation_id??null,raison};});
 for(const r of c.recettes){usage('photo_plat',r.id,r.photo_sha256);for(const id of r.source_page_ids||[])if(!c.pages.some(p=>p.id===id))c.manques.push({raison:'page_absente',id});}
 for(const h of c.cuissons)for(const p of h.photos||[])usage('photo_cuisson',h.id,typeof p==='string'?p:p?.sha256);
 for(const p of c.pages){usage('page_source',p.id,p.sha256);if(p.document_id&&!c.documents.some(d=>d.id===p.document_id))c.manques.push({raison:'document_absent',id:p.document_id});}
 for(const d of c.documents)usage('document_source',d.id,d.sha256);
 return{issue:'ok',capture:c};
}
export function projeterPreparationHorsLigne(capture,observations={}){
 const raisons=[],obs=observations,selection=capture.choix.medias,shas=[...new Set(capture.usages.map(u=>u.sha256))];
 const recettes=capture.occurrences.map((o,i)=>{const r=obs.lectures?.[i],raison=o.raison||r?.raison;return{...o,etat:o.raison?'indisponible':r?.etat||'inconnue',raison:raison??null,mixte:!!r?.mixte};});
 const medias=shas.map(id=>{const selected=!Array.isArray(selection)||selection.includes(id),lu=obs.medias?.find(m=>m.sha256===id);return{sha256:id,selectionne:selected,usages:capture.usages.filter(u=>u.sha256===id),...(lu||{etat:'inconnu'})};});
 if(obs.passe!==capture.passe)raisons.push('passe_changee');if(obs.fermeture!=='courante')raisons.push(obs.fermeture==='perimee'?'donnees_changees':'donnees_non_verifiees');
 if(obs.livraison?.etat!=='verifiee')raisons.push('coquille_'+(obs.livraison?.etat||'inconnue'));raisons.push(...capture.manques.map(m=>m.raison));
 const choisis=medias.filter(m=>m.selectionne),perime=obs.passe!==capture.passe||obs.fermeture==='perimee'||obs.livraison?.courante===false;
 const partiel=capture.manques.length>0||recettes.some(r=>r.etat==='indisponible')||choisis.some(m=>['manquant','illisible'].includes(m.etat))||obs.livraison?.etat==='incomplete';
 const inconnu=obs.fermeture!=='courante'||recettes.some(r=>r.etat!=='disponible')||choisis.some(m=>m.etat!=='utilisable')||obs.livraison?.etat!=='verifiee'||obs.livraison?.courante!==true;
 return{format:1,etat:perime?'perime':partiel?'partiel':inconnu?'inconnu':'pret',observe_le:obs.observe_le??null,recettes,medias,limites:[],raisons};
}
export function diagnosticPreparationHorsLigne(observation){
 if(!observation||!['pret','partiel','perime','inconnu'].includes(observation.etat))return null;
 const rs=observation.recettes||[],ms=observation.medias||[],selected=ms.filter(x=>x.selectionne),sum=selected.reduce((n,m)=>Number.isSafeInteger(n)&&Number.isSafeInteger(m.octets)&&m.octets>=0&&Number.isSafeInteger(n+m.octets)?n+m.octets:null,0);
 return{format:1,etat:observation.etat,observe_le:observation.observe_le??null,recettes:{total:rs.length,disponibles:rs.filter(x=>x.etat==='disponible').length,indisponibles:rs.filter(x=>x.etat==='indisponible').length,inconnues:rs.filter(x=>!['disponible','indisponible'].includes(x.etat)).length},medias:{selectionnes:selected.length,exclus:ms.length-selected.length,utilisables:selected.filter(x=>x.etat==='utilisable').length,manquants:selected.filter(x=>x.etat==='manquant').length,illisibles:selected.filter(x=>x.etat==='illisible').length,inconnus:selected.filter(x=>!['utilisable','manquant','illisible'].includes(x.etat)).length},octets_connus:sum};
}
