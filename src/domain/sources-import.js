// Les pages affichées restent celles qui autorisent le départ et l'application d'une lecture.
import { ErreurCycleRecette } from './cycle-recette.js';

export const signaturePageImport = p => JSON.stringify([p?.id,p?.edition_id??null,p?.document_id??null,p?.sha256??null,p?.rotation??0,p?.printed_page??null,p?.position??null]);
export function memoireSourcesImport(pages) {
  if(!Array.isArray(pages)||pages.length>1000||pages.some(p=>!p?.id))throw new ErreurCycleRecette('source_absente');
  return pages.map(p=>({id:p.id,signature:signaturePageImport(p)}));
}
export function conditionsSourcesImport(sources) {
  if(sources==null)return {};
  if(!Array.isArray(sources)||sources.length>1000||new Set(sources.map(s=>s?.id)).size!==sources.length)throw new ErreurCycleRecette('source_modifiee');
  return {source_pages:sources.map(s=>{
    if(!s||typeof s.id!=='string'||!s.id||typeof s.signature!=='string'||s.signature.length>4000||Object.keys(s).some(k=>!['id','signature'].includes(k)))throw new ErreurCycleRecette('source_modifiee');
    let parsed;try{parsed=JSON.parse(s.signature);}catch{throw new ErreurCycleRecette('source_modifiee');}
    if(!Array.isArray(parsed)||parsed.length!==7||parsed[0]!==s.id)throw new ErreurCycleRecette('source_modifiee');
    return {key:s.id,fusion:p=>{if(!p||signaturePageImport(p)!==s.signature)throw new ErreurCycleRecette('source_modifiee');return null;}};
  })};
}

// Le geste vaut pour la copie affichée, pas pour un résultat arrivé depuis dans un autre onglet.
export async function revoirLectureEditionImport(importId, { repo, contexte, attendu } = {}) {
  if (!attendu || attendu.id !== importId || !['index','classement'].includes(attendu.kind)
    || attendu.recipe_id != null || attendu.status !== 'a_verifier' || !attendu.resultat
    || !contexte?.edition_id || attendu.edition_id !== contexte.edition_id) throw new ErreurCycleRecette('relecture_absente');
  if ((attendu.owner_id ?? null) !== (contexte.owner_id ?? null)) throw new ErreurCycleRecette('compte_change');
  const signature = JSON.stringify(attendu);
  return repo.transitionner('imports',importId,{
    attendus:['a_verifier'],editions:[contexte],conditions:conditionsSourcesImport(attendu.sources_attendues),
    patch:current=>{
      if (JSON.stringify(current)!==signature) throw new ErreurCycleRecette('lecture_changee');
      if (contexte.contexteValide && !contexte.contexteValide()) throw new ErreurCycleRecette('compte_change');
      return { expected_edition_id:contexte.edition_id,expected_edition_cycle_id:contexte.expected_cycle_id??null,
        owner_id:contexte.owner_id??null,relecture_cycle_at:new Date().toISOString() };
    },
  });
}
