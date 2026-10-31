import {validerLigneTraductionV2,validerJournalTraduction} from './traductions-format.js';

// Ancien pull : updated_at de transport remplaçait la date du JSON métier.
// La conversion ne peut réparer ni les textes, ni une autre date, ni un autre défaut.
export function reparerHorodatageTraduction(store,row){
 const valider=store==='recipe_translations'&&row?.alignment_format===2?validerLigneTraductionV2:store==='imports'&&row?.kind==='traduction'?validerJournalTraduction:null;
 if(!valider||valider(row).ok||typeof row.updated_at!=='string')return null;
 const date=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,6})?(?:\+00:00|Z)$(?![\s\S])/.exec(row.updated_at);
 if(!date)return null;
 const temps=Date.parse(row.updated_at);if(!Number.isFinite(temps))return null;
 const updated_at=new Date(temps).toISOString();
 // Date.parse normalise notamment le 30 février et 24:00 : ce ne sont pas des échos UTC recevables.
 if(updated_at.slice(0,19)!==date[1])return null;
 const corrigee={...row,updated_at};
 return valider(corrigee).ok?structuredClone(corrigee):null;
}
