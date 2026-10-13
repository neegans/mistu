// Envoi initial (spec § 5.2) : tout ce qui existait AVANT la connexion est mis en file, table par table, commandé
// par des marqueurs — pas par user_id. Reprenable : une table interrompue est rejouée en entier (le dédoublonnage de
// l'envoi absorbe les doublons) ; le marqueur part dans la MÊME transaction que le dernier morceau.
import { SYNC_STORES } from '../model/schema.js';
import { keyOf } from './tables.js';
import { isAllowed } from './mime.js';

const MARQUEUR = (table) => `backfill:${table}`;

export function tablesAEnvoyer({ marqueurs = {}, isActivitySynced = () => false }) {
  return SYNC_STORES.filter((t) => (t !== 'library_activity' || isActivitySynced()) && marqueurs[MARQUEUR(t)] !== 'fait');
}

const synchronisable = (table, row) => table !== 'files' || (row?.syncable !== false && isAllowed(row?.mime));

export async function lireMarqueurs(db) {
  const lignes = await db.getAll('sync_state');
  return Object.fromEntries(lignes.filter((l) => String(l.key).startsWith('backfill:')).map((l) => [l.key, l.value]));
}

export async function retirerMarqueur(db, table) {
  await db.mutate({ deletes: { sync_state: [MARQUEUR(table)] }, origin: 'device' });
}

export async function envoiInitial({ db, getUserId, isActivitySynced = () => false, surProgression = () => {}, tailleMorceau = 500 }) {
  const tables = tablesAEnvoyer({ marqueurs: await lireMarqueurs(db), isActivitySynced });
  const total = SYNC_STORES.length - (isActivitySynced() ? 0 : 1);
  let mises = 0;
  const user_id = getUserId();
  for (const [i, table] of tables.entries()) {
    surProgression({ phase: 'envoi_initial', table, n: i + 1, total });
    const lignes = (await db.getAll(table)).filter((r) => synchronisable(table, r));
    for (let debut = 0; debut < Math.max(lignes.length, 1); debut += tailleMorceau) {
      const morceau = lignes.slice(debut, debut + tailleMorceau);
      const dernier = debut + tailleMorceau >= lignes.length;
      const puts = { outbox: morceau.map((r) => ({ user_id, store: table, id: keyOf(table, r), op: 'put', updated_at: r.updated_at || null, tries: 0 })) };
      if (!puts.outbox.length) delete puts.outbox;
      if (dernier) puts.sync_state = [{ key: MARQUEUR(table), value: 'fait' }];
      await db.mutate({ puts, origin: 'device' });
      mises += morceau.length;
    }
  }
  return { tables, mises };
}
