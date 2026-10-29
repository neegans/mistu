import { idCycle, gardeCompteCycle } from './cycle.js';

export const CLE_CAPACITE_EDITION = owner => `edition-lifecycle-capability:${owner}`;
export const CLE_EDITION_CONFIRMEE = id => `edition-lifecycle:${id}`;
export const commandeEdition = e => e?.op==='lifecycle'&&(e.store==='book_editions'||e.payload?.entity==='edition');
export const editionsDe = e => [...new Set([
  ...(e?.edition_contexts||[]).map(c=>c.edition_id),
  ...(e?.recipe_contexts||[]).map(c=>c.expected_edition_id),
  e?.expected_edition_id,e?.payload?.edition_id,
  e?.store==='book_editions'?e.id:null,
  ...(e?.dependency_editions||[])
].filter(Boolean))];
export const ciblesDe = e => [...new Set([
  ...(e?.recipe_contexts||[]).map(c=>`recipes:${c.recipe_id}`),
  e?.recipe_id?`recipes:${e.recipe_id}`:null,
  e?.payload?.recipe_id?`recipes:${e.payload.recipe_id}`:null,
  e?.store==='recipes'?`recipes:${e.id}`:null,
  ...editionsDe(e).map(id=>`book_editions:${id}`)
].filter(Boolean))];
export const cibleCommune = (a,b) => ciblesDe(a).some(id=>ciblesDe(b).includes(id));

export async function capaciteEditionConnue(db,owner) {
  if(!owner) return true;
  return (await db.get('sync_state',CLE_CAPACITE_EDITION(owner)))?.value?.protocol===1;
}
export async function verifierCapaciteEdition({db,transport,userId,getUserId=()=>userId}) {
  if(!userId) return {ok:true,erreur:null};
  if(typeof transport?.capacites!=='function') return {ok:false,erreur:{type:'incompatible'}};
  const r=await transport.capacites(),ok=!r.erreur&&r.capacites?.edition_lifecycle===1;
  if(ok) await db.mutate({puts:{sync_state:[{key:CLE_CAPACITE_EDITION(userId),value:{protocol:1}}]},conditions:{sync_state:[gardeCompteCycle(userId,getUserId)]},origin:'remote'});
  return {ok,erreur:r.erreur||(ok?null:{type:'incompatible'})};
}
export function superposerEditions(serveur,commandes) {
  let row={...serveur};const bloquees=[];
  for(const e of [...commandes].sort((a,b)=>a.seq-b.seq)) {
    const c=e.payload;
    if(!c||e.quarantined_at||e.lifecycle_blocked){bloquees.push(e);continue;}
    if(idCycle(row)===c.operation_id)continue;
    if(idCycle(row)!==(c.base_cycle_id??null)||(c.action==='trash'?!!row.trashed_at:!row.trashed_at)){bloquees.push(e);continue;}
    row={...row,lifecycle_id:c.operation_id,trashed_at:c.action==='trash'?c.at:null,trash_mode:c.action==='trash'?c.mode:null};
  }
  return {row,bloquees};
}
export function fusionEdition(locale,serveur,commandes=[]) {
  const overlay=superposerEditions(serveur,commandes),meme=idCycle(locale)===idCycle(overlay.row);
  const contenuLocal=meme&&Date.parse(locale?.updated_at)>Date.parse(serveur?.updated_at);
  return {row:contenuLocal?{...locale,lifecycle_id:overlay.row.lifecycle_id??null,trashed_at:overlay.row.trashed_at??null,trash_mode:overlay.row.trash_mode??null}:overlay.row,
    bloquees:overlay.bloquees,conflit:!!locale&&!meme&&!commandes.some(e=>e.payload?.operation_id===idCycle(locale))};
}
