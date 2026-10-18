// Capture des écritures dans la même transaction que la donnée (spec § 5.2) : une seule porte, db.mutate.
// Aucun envoi ici : la file est seulement remplie ; la vider est le travail de L3 (src/sync/push.js).
import { SYNC_STORES } from '../model/schema.js';
import { keyOf } from './tables.js';
import { syncNow } from './clock.js';

// R-L3-22 : en L3, AUCUNE ligne « files » n'entre en file — ni une image parfaitement synchronisable, ni un type
// hors liste. Les octets des fichiers sont L4 (R55), donc rien ne pouvait envoyer ces entrées avant L4 : dès la
// première photo, « À envoyer : N » et la pastille affichaient en permanence un nombre qui ne redescendait plus, et
// le motif « fichier en attente » posé par `push.js` n'était affiché nulle part. C'est exactement l'attente que
// personne ne tient que R52 a voulu éviter — et c'est le compteur que le parcours § 7.3 n° 1 demande de regarder.
// L4 remettra `files` en file, avec son envoi initial (dont le marqueur n'est volontairement pas posé ici) et la
// liste blanche de types de `src/sync/mime.js`, qui décide ce qui part vers le serveur.
// Les entrées `files` DÉJÀ en file, capturées par L2, sont retirées une fois par `repo.init()` (même ruling).
const SYNCHRONISEES = SYNC_STORES.filter((store) => store !== 'files');

// Copie de la fiche au moment de la suppression, sans laisser une clé héritée du prototype passer pour un payload.
function payloadFor(payloads, store, key) {
  const bag = payloads?.[store];
  return bag && Object.hasOwn(bag, key) ? bag[key] || null : null;
}

export function installCapture(db, { getUserId = () => null, isActivitySynced = () => false, configSuitLeCompte = () => false } = {}) {
  db.onMutate = ({ puts = {}, deletes = {}, origin = 'local', payloads = {} }) => {
    // Réception, ajustement du serveur et vidage d'appareil ne repartent jamais vers le serveur.
    if (origin !== 'local') return null;
    const rows = [];
    const user_id = getUserId();
    const wanted = (store) => SYNCHRONISEES.includes(store) && (store !== 'library_activity' || isActivitySynced()) && (store !== 'assistant_config' || configSuitLeCompte());
    for (const [store, list] of Object.entries(puts)) {
      if (!wanted(store)) continue;
      for (const r of list) {
        rows.push({ user_id, store, id: keyOf(store, r), op: 'put', updated_at: r.updated_at || null, tries: 0 });
      }
    }
    for (const [store, keys] of Object.entries(deletes)) {
      if (!wanted(store)) continue;
      for (const k of keys) {
        const payload = payloadFor(payloads, store, k);
        // R-L3-21 : une suppression est un ÉVÉNEMENT, et sa tombale porte l'instant de SON GESTE — jamais l'heure de
        // la dernière écriture de la fiche, que le serveur possède déjà. Avec celle du payload, `sync_push` voyait
        // `u = cur_updated` et `cur_deleted is null` : aucune de ses deux branches d'écriture ne s'appliquait, la
        // réponse était `rejected{conflit}` et la suppression ne quittait jamais l'appareil (toutes les autres
        // copies gardaient la fiche, sans que rien ne l'annonce). Le `payload`, lui, garde sa propre heure : c'est
        // la copie de la fiche au moment de la suppression (spec § 5.1), pas l'heure de l'événement.
        // Conséquence voulue : supprimer une fiche déjà absente (payload nul) ne produit plus une entrée sans heure,
        // que le serveur refusait avec le motif « updated_at » et qui finissait en quarantaine pour rien.
        rows.push({ user_id, store, id: k, op: 'delete', updated_at: syncNow(), payload, tries: 0 });
      }
    }
    return rows.length ? { outbox: rows } : null;
  };
}

export const uninstallCapture = (db) => { db.onMutate = null; };

// --- La file d'un compte (spec § 4.1, R-L3-24) -------------------------------
// « Chaque entrée d'outbox porte `user_id` et n'est jamais envoyée sous un autre compte. » Le `user_id` était bien
// écrit (capture, envoi initial, remise en file de la réception), mais personne ne le relisait : la seule barrière
// était la garde de compte, ailleurs — la pire conséquence imaginable du lot (les données d'une personne écrites
// sous un autre compte) ne tenait qu'à une comparaison lointaine. Une seule définition, ici, pour les trois
// lecteurs : l'envoi (`push.js`), les compteurs du moteur et « À envoyer » de Réglages. Un `user_id` nul = écrit
// avant la connexion : c'est l'envoi initial voulu, il part sous le compte qui vient d'arriver.
export const estDeCeCompte = (entree, userId = null) => entree?.user_id == null || entree.user_id === userId;

export async function fileDe(db, userId = null) {
  return (await db.getAll('outbox')).filter((e) => estDeCeCompte(e, userId));
}

// --- Les deux gestes de la personne sur la file (spec § 4.2) -----------------
// Appelés par Réglages sur une entrée mise en quarantaine. Ils n'écrivent que dans « outbox » et portent l'origine
// 'device' : la fiche elle-même n'est jamais touchée, et rien de ceci ne repart au serveur.
// Les deux signatures ne se ressemblent pas, et c'est voulu : reprendre RÉÉCRIT la ligne entière, il faut donc la
// ligne telle que l'appelant l'a lue (`entree`) ; retirer n'a besoin que de sa clé (`seq`).

// « Réessayer » remet l'entrée dans l'état qu'elle avait avant son premier échec : plus de quarantaine, plus de
// motif, plus d'essais comptés, plus d'attente de recul — sans quoi le recul exponentiel la retiendrait encore.
export async function reprendreEnvoi(db, entree) {
  await db.mutate({ puts: { outbox: [{ ...entree, quarantined_at: null, last_error: null, tries: 0, next_try_at: null }] }, origin: 'device' });
}

// « Abandonner cet envoi » retire l'entrée et RIEN d'autre : la fiche reste sur cet appareil, simplement elle n'ira
// pas au serveur. Une écriture ultérieure de cette fiche la remettra en file, comme n'importe quelle écriture.
export async function retirerEnvoi(db, seq) {
  await db.mutate({ deletes: { outbox: [seq] }, origin: 'device' });
}
