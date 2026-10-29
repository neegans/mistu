// Envoi initial (spec § 5.2) : tout ce qui existait AVANT la connexion est mis en file, table par table, commandé
// par des marqueurs — pas par user_id. Reprenable : une table interrompue est rejouée en entier (le dédoublonnage de
// l'envoi absorbe les doublons) ; le marqueur part dans la MÊME transaction que le dernier morceau.
import { SYNC_STORES } from '../model/schema.js';
import { keyOf, remoteDeCeCompte } from './tables.js';
import { porteCycle, idCycle } from './cycle.js';

const MARQUEUR = (table) => `backfill:${table}`;

// L4 (D-G8) : `files` est candidate — mais seules ses lignes syncables à remote valide de CE compte entrent en file (les
// octets sont déjà au serveur) ; son marqueur `backfill:files` est posé comme les autres. (R-L3-22, L3 : `files` en était
// écartée, faute d'octets à envoyer.) Les tables candidates sont nommées une fois, et c'est aussi elles que compte la
// progression affichée.
// Spec assistant-par-le-compte K-3 : `assistant_config` n'est candidate que sur un appareil de production
// (`configSuitLeCompte`, faux par défaut — R-CPT-1).
export function tablesCandidates({ isActivitySynced = () => false, configSuitLeCompte = () => false } = {}) {
  return SYNC_STORES.filter((t) => (t !== 'library_activity' || isActivitySynced()) && (t !== 'assistant_config' || configSuitLeCompte()));
}

export function tablesAEnvoyer({ marqueurs = {}, isActivitySynced = () => false, configSuitLeCompte = () => false }) {
  return tablesCandidates({ isActivitySynced, configSuitLeCompte }).filter((t) => marqueurs[MARQUEUR(t)] !== 'fait');
}

export async function lireMarqueurs(db) {
  const lignes = await db.getAll('sync_state');
  return Object.fromEntries(lignes.filter((l) => String(l.key).startsWith('backfill:')).map((l) => [l.key, l.value]));
}

export async function retirerMarqueur(db, table) {
  await db.mutate({ deletes: { sync_state: [MARQUEUR(table)] }, origin: 'device' });
}

export async function envoiInitial({ db, getUserId, isActivitySynced = () => false, configSuitLeCompte = () => false, surProgression = () => {}, tailleMorceau = 500 }) {
  const tables = tablesAEnvoyer({ marqueurs: await lireMarqueurs(db), isActivitySynced, configSuitLeCompte });
  const total = tablesCandidates({ isActivitySynced, configSuitLeCompte }).length;
  let mises = 0;
  const user_id = getUserId();
  const file=await db.getAll('outbox');
  const pending=new Set(file.filter(e=>e.op==='lifecycle').map(e=>e.id));
  const captures=new Set(file.filter(e=>Object.hasOwn(e,'expected_cycle_id')||e.recipe_contexts||e.op==='lifecycle').map(e=>`${e.store}:${e.id}`));
  const recipes=new Map((await db.getAll('recipes')).map(r=>[r.id,r]));
  const versions=new Map((await db.getAll('recipe_versions')).map(r=>[r.id,r]));
  const contexte=(table,r)=>{
    const ids=new Set([table==='recipes'?r.id:null,r.recipe_id,r.source_recipe_id,...(r.recipe_ids||[]),...(r.items||[]).map(x=>x.recipe_id)].filter(Boolean));
    for(const id of [r.recipe_version_id,r.source_recipe_version_id,...(r.selected_version_ids||[]),...(r.items||[]).map(x=>x.recipe_version_id)].filter(Boolean)) {const parent=versions.get(id)?.recipe_id;if(parent)ids.add(parent);}
    if(![...ids].some(id=>porteCycle(recipes.get(id)))) return {};
    const contexts=[...ids].map(id=>({recipe_id:id,expected_cycle_id:idCycle(recipes.get(id))}));
    return {...(contexts.length===1?contexts[0]:{recipe_contexts:contexts}),archive_import:true};
  };
  for (const [i, table] of tables.entries()) {
    surProgression({ phase: 'envoi_initial', table, n: i + 1, total });
    const lignes = (await db.getAll(table)).filter((r) => !captures.has(`${table}:${keyOf(table,r)}`)&&(table!=='recipes'||!pending.has(r.id))&&(table !== 'files' || (r?.syncable !== false && remoteDeCeCompte(r?.remote, user_id))));
    for (let debut = 0; debut < Math.max(lignes.length, 1); debut += tailleMorceau) {
      const morceau = lignes.slice(debut, debut + tailleMorceau);
      const dernier = debut + tailleMorceau >= lignes.length;
      const puts = { outbox: morceau.map((r) => ({ user_id, store: table, id: keyOf(table, r), op: 'put', updated_at: r.updated_at || null, tries: 0,...contexte(table,r) })) };
      if (!puts.outbox.length) delete puts.outbox;
      if (dernier) puts.sync_state = [{ key: MARQUEUR(table), value: 'fait' }];
      await db.mutate({ puts, origin: 'device' });
      mises += morceau.length;
    }
  }
  return { tables, mises };
}
