// Capture des écritures dans la même transaction que la donnée (spec § 5.2) : une seule porte, db.mutate.
// Aucun envoi ici : la file est seulement remplie ; la vider est le travail de L3 (src/sync/push.js).
import { SYNC_STORES } from '../model/schema.js';
import { keyOf } from './tables.js';

// Une ligne « files » non synchronisable reste locale et n'entre jamais en file (spec § 5.3, § 5.4).
const syncableRow = (store, row) => store !== 'files' || row?.syncable !== false;

// Copie de la fiche au moment de la suppression, sans laisser une clé héritée du prototype passer pour un payload.
function payloadFor(payloads, store, key) {
  const bag = payloads?.[store];
  return bag && Object.hasOwn(bag, key) ? bag[key] || null : null;
}

export function installCapture(db, { getUserId = () => null, isActivitySynced = () => false } = {}) {
  db.onMutate = ({ puts = {}, deletes = {}, origin = 'local', payloads = {} }) => {
    // Réception, ajustement du serveur et vidage d'appareil ne repartent jamais vers le serveur.
    if (origin !== 'local') return null;
    const rows = [];
    const user_id = getUserId();
    const wanted = (store) => SYNC_STORES.includes(store) && (store !== 'library_activity' || isActivitySynced());
    for (const [store, list] of Object.entries(puts)) {
      if (!wanted(store)) continue;
      for (const r of list) {
        if (!syncableRow(store, r)) continue;
        rows.push({ user_id, store, id: keyOf(store, r), op: 'put', updated_at: r.updated_at || null, tries: 0 });
      }
    }
    for (const [store, keys] of Object.entries(deletes)) {
      if (!wanted(store)) continue;
      for (const k of keys) {
        const payload = payloadFor(payloads, store, k);
        if (!syncableRow(store, payload)) continue;
        rows.push({ user_id, store, id: k, op: 'delete', updated_at: payload?.updated_at || null, payload, tries: 0 });
      }
    }
    return rows.length ? { outbox: rows } : null;
  };
}

export const uninstallCapture = (db) => { db.onMutate = null; };
