// Protocole de corbeille : le cycle est indépendant de l'horodatage du contenu.
export const CLE_CAPACITE_CYCLE = userId => `lifecycle-capability:${userId}`;
export const CLE_CYCLE_CONFIRME = id => `lifecycle:${id}`;
export const idCycle = row => row?.lifecycle_id ?? null;
export const porteCycle = row => row?.lifecycle_id != null || row?.trashed_at != null;
export const commandeCycle = entree => entree?.op === 'lifecycle';
export const recetteDe = entree => entree?.recipe_id || (entree?.store === 'recipes' ? entree.id : null);
export const recettesDe = entree => entree?.recipe_contexts?.map(c=>c.recipe_id) || [recetteDe(entree)].filter(Boolean);
export const gardeCompteCycle = (owner,getUserId) => ({key:'user_id',fusion:row=>{
  if(getUserId()!==owner || (row && (row.value??null)!==owner)) throw new Error('Compte de synchronisation changé');
  return null;
}});

export async function capaciteCycleConnue(db,userId) {
  if (!userId) return true;
  return (await db.get('sync_state',CLE_CAPACITE_CYCLE(userId)))?.value?.protocol === 1;
}

export async function verifierCapaciteCycle({db,transport,userId}) {
  if (!userId) return {ok:true,erreur:null};
  if (typeof transport?.capacites !== 'function') return {ok:false,erreur:{type:'incompatible',status:null}};
  const r=await transport.capacites();
  const ok=!r.erreur && r.capacites?.recipe_lifecycle === 1;
  if (ok) await db.mutate({puts:{sync_state:[{key:CLE_CAPACITE_CYCLE(userId),value:{protocol:1}}]},origin:'remote'});
  return {ok,erreur:r.erreur || (ok?null:{type:'incompatible',status:null})};
}

export function superposerCommandes(serveur,commandes) {
  let row={...serveur}; const bloquees=[];
  for (const e of [...commandes].sort((a,b)=>a.seq-b.seq)) {
    const c=e.payload;
    if (!c || e.quarantined_at || e.lifecycle_blocked) {bloquees.push(e);continue;}
    if (idCycle(row)===c.operation_id) continue;
    if (idCycle(row)!==(c.base_cycle_id??null) || (c.action==='trash' ? !!row.trashed_at : !row.trashed_at)) {bloquees.push(e);continue;}
    row={...row,lifecycle_id:c.operation_id,trashed_at:c.action==='trash'?c.at:null};
  }
  return {row,bloquees};
}

// Le contenu divergent reste récupérable, mais ne gagne jamais un autre cycle par sa date.
export function fusionCycle(locale,serveur,commandes=[]) {
  const overlay=superposerCommandes(serveur,commandes);
  const meme=idCycle(locale)===idCycle(overlay.row);
  const contenuLocal=meme && Date.parse(locale?.updated_at)>Date.parse(serveur?.updated_at);
  return {row:contenuLocal?{...locale,lifecycle_id:overlay.row.lifecycle_id??null,trashed_at:overlay.row.trashed_at??null}:overlay.row,bloquees:overlay.bloquees,
    conflit:!!locale && !meme && !commandes.some(e=>e.payload?.operation_id===idCycle(locale))};
}
