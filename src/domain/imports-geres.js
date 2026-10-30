// Les gardes SQL L5/L6 protègent une présence de clé, même à null.
// Ces journaux et fragments font partie des sources durables, pas du journal jetable à 30 jours.
const MARQUEURS=['source_revision','source_state','source_copy','index_storage','source_capture','index_call','translation_capture','translation_call','translation_resolutions'];
export const CLE_REPARATION_IMPORTS_GERES='reparation_imports_geres';
export function estImportGere(ligne){
 return !!ligne&&typeof ligne==='object'&&!Array.isArray(ligne)&&(ligne.kind==='traduction'||MARQUEURS.some(cle=>Object.hasOwn(ligne,cle)));
}
