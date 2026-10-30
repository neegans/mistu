// Archive/bootstrap : conserver les captures historiques et préparer les commandes avant la transaction.
import {newId,nowIso} from '../core/ids.js';
import {canoniqueSources,empreinteSources,projectionSeedSource} from './sources-format.js';
import {capturerSourceTraduction,validerLigneTraductionV2,validerTraductionV2,validerJournalTraduction,refSegmentTraduction,empreinteTexteTraduction,projectionSeedTraduction,signerCommandeTraduction,ajouterRecuPublication,ErreurTraduction} from './traductions-format.js';
import {validerTransitionVersionStructuree} from './versions-structurees.js';
import {preparerTransfertSources} from './transferts-source.js';
const own=(o,k)=>Object.hasOwn(o||{},k),clone=structuredClone,fail=code=>{throw new ErreurTraduction(code);};
const map=xs=>new Map((xs||[]).map(r=>[r.id,r]));
const v2=r=>r?.alignment_format===2||r?.translated_content?.format===2;
const journal=r=>r?.kind==='traduction'||own(r,'translation_call')||own(r,'translation_capture');
const combiner=(snapshot,batch)=>Object.fromEntries([...new Set([...Object.keys(snapshot),...Object.keys(batch)])].map(k=>[k,[...new Map([...(snapshot[k]||[]),...(batch[k]||[])].map(r=>[r.id,r])).values()]]));
export const contientTraductionsExactes=stores=>(stores.recipe_versions||[]).some(v=>own(v,'ingredient_structure'))||(stores.recipe_translations||[]).some(v2)||(stores.imports||[]).some(journal);
export const estLigneTraductionReservee=(store,row)=>store==='recipe_versions'?own(row,'ingredient_structure'):store==='recipe_translations'?v2(row):store==='imports'&&journal(row);

export function validerFormesTraductionsArchive(stores) {
 const versions=map(stores.recipe_versions);
 for(const row of versions.values())validerTransitionVersionStructuree(null,row,{parents:versions});
 for(const row of stores.recipe_translations||[])if(v2(row)){const r=validerLigneTraductionV2(row);if(!r.ok)fail(r.raison);}
 for(const row of stores.imports||[])if(journal(row)){const r=validerJournalTraduction(row);if(!r.ok)fail(r.raison);}
}

function recetteHistorique(recipe,source_locale,title_capture=null){
 const r={...recipe,original_language:source_locale};
 if(title_capture)for(const[k,p]of title_capture.fields){if(p[0])r[k]=p[1];else delete r[k];}
 return r;
}
export async function verifierPreuvesTraductionsArchive(stores) {
 validerFormesTraductionsArchive(stores);
 const recettes=map(stores.recipes),versions=map(stores.recipe_versions),journaux=map(stores.imports);
 for(const j of journaux.values())if(j.kind==='traduction'){
  const recipe=recettes.get(j.recipe_id),version=versions.get(j.source_version_id);
  // Un journal orphelin reste documentaire. On ne prétend pas vérifier sa source disparue.
  if(!recipe||!version)continue;
  if(version.recipe_id!==recipe.id)fail('association_changee');
  const source=await capturerSourceTraduction({recipe:recetteHistorique(recipe,j.translation_capture.source_locale,j.translation_capture.title_capture),version});
  const valide=validerJournalTraduction(j,{source});if(!valide.ok)fail(valide.raison);
  for(const segment of j.translation_call.segment_refs){const s=source.segments.find(s=>s.ref===segment.ref);if(!s||s.source_sha256!==segment.source_sha256)fail('source_changee');}
 }
 for(const tr of stores.recipe_translations||[])if(v2(tr)){
  const version=versions.get(tr.recipe_version_id),recipe=recettes.get(version?.recipe_id);
  if(!recipe||!version)fail('source_absente');
  const source=await capturerSourceTraduction({recipe:recetteHistorique(recipe,tr.source_locale),version});
  const valide=validerTraductionV2(tr,source);if(!valide.ok)fail(valide.raison);
  for(const segment of tr.translated_content.segments)if(segment.origin==='ai'){
   const j=journaux.get(segment.journal_id),ref=await refSegmentTraduction({...segment,recipe_version_id:tr.recipe_version_id}),r=j?.resultat?.segments.find(s=>s.ref===ref),s=j?.translation_call?.segment_refs.find(s=>s.ref===ref),resolution=j?.translation_resolutions?.find(s=>s.ref===ref);
   if(j?.kind!=='traduction'||j.source_version_id!==tr.recipe_version_id||j.target_locale!==tr.locale||j.translation_source_signature!==tr.source_signature||s?.source_sha256!==segment.source_sha256||r?.issue!=='admis'||r.text!==segment.text||resolution?.decision!=='adopte'||resolution.text_sha256!==await empreinteTexteTraduction(segment.text))fail('provenance_invalide');
  }
 }
}

export function verifierIdentitesTraductionsArchive(batch,snapshot) {
 const versions=map(snapshot.recipe_versions),combined=combiner(snapshot,batch),parents=map(combined.recipe_versions);
 const protegees=new Set([...(combined.recipe_translations||[]).filter(v2).map(t=>t.recipe_version_id),...(combined.imports||[]).filter(journal).map(j=>j.source_version_id)]);
 for(const row of batch.recipe_versions||[]){const ancien=versions.get(row.id);if(!ancien)continue;validerTransitionVersionStructuree(ancien,row,{parents,protegee:protegees.has(row.id)});}
 const traductions=map(snapshot.recipe_translations);
 for(const row of batch.recipe_translations||[]){const ancien=traductions.get(row.id);if((v2(row)||v2(ancien))&&ancien&&canoniqueSources(projectionSeedTraduction(row))!==canoniqueSources(projectionSeedTraduction(ancien)))fail('traduction_changee');}
 const journals=map(snapshot.imports);
 for(const row of batch.imports||[]){const ancien=journals.get(row.id);if((journal(row)||journal(ancien))&&ancien&&canoniqueSources(projectionSeedSource(row))!==canoniqueSources(projectionSeedSource(ancien)))fail('journal_change');}
}

export async function preparerTraductionsArchive({batch,snapshot={},owner_id,purpose='archive',maintenant=nowIso,newId:ids=newId}={}) {
 const normalise=clone(batch),avant=clone(snapshot);if(!['archive','bootstrap'].includes(purpose))fail('forme_invalide');
 verifierIdentitesTraductionsArchive(normalise,avant);
 const combined=combiner(avant,normalise);await verifierPreuvesTraductionsArchive(combined);
 const recettes=map(combined.recipes),versions=map(combined.recipe_versions),editions=map(combined.book_editions),traductionsAvant=map(avant.recipe_translations),journauxAvant=map(avant.imports);
 const translation_commands=[],source_commands=[],couvertes=new Set();
 for(const j of normalise.imports||[])if(j.kind==='traduction'){
  const p=await preparerTransfertSources({purpose,owner_id,store:'imports',target:j,baseTarget:journauxAvant.get(j.id)||null,rows:[],edition_id:j.edition_id??null,base_edition_cycle_id:editions.get(j.edition_id)?.lifecycle_id??null,nonce:ids('transfert'),requested_at:maintenant()});
  source_commands.push(...p.commandes);couvertes.add('imports:'+j.id);
 }
 for(const [i,tr] of (normalise.recipe_translations||[]).entries())if(v2(tr)){
  const version=versions.get(tr.recipe_version_id),recipe=recettes.get(version.recipe_id),edition=editions.get(recipe.edition_id),old=traductionsAvant.get(tr.id);
  const c=await signerCommandeTraduction({protocol:1,op:'translation_apply',mode:'restore',store:'recipe_translations',id:tr.id,nonce:ids('tr-restore'),purpose,recipe_id:recipe.id,recipe_version_id:version.id,edition_id:recipe.edition_id??null,base_cycle_id:recipe.lifecycle_id??null,base_edition_cycle_id:edition?.lifecycle_id??null,expected_target_sha256:old?await empreinteSources(projectionSeedTraduction(old)):null,target:clone(tr)});
  const ligne=ajouterRecuPublication({...tr,revision:c.operation_id},c,{restore:true}),v=validerLigneTraductionV2(ligne);if(!v.ok)fail(v.raison);
  normalise.recipe_translations[i]=ligne;translation_commands.push(c);couvertes.add('recipe_translations:'+tr.id);
 }
 return{batch:normalise,translation_commands,source_commands,couvertes};
}
