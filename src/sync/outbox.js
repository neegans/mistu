import {preparerCommandesInventaire,estCommandeInventaire} from './commandes-inventaire.js';
import {preparerCommandesCuisine,estCommandeCuisine} from './commandes-cuisine.js';
import {estLectureSourceSignee} from './lots.js';
import {preparerCommandesSources} from './commandes-sources.js';
import {preparerCommandesTraduction,estCommandeTraduction,estPhaseJournalTraduction} from './commandes-traduction.js';
// Capture des écritures dans la même transaction que la donnée (spec § 5.2) : une seule porte, db.mutate.
// Aucun envoi ici : la file est seulement remplie ; la vider est le travail de L3 (src/sync/push.js).
import { SYNC_STORES } from '../model/schema.js';
import { keyOf, remoteDeCeCompte } from './tables.js';
import { syncNow } from './clock.js';
import { CLE_CYCLE_CONFIRME, idCycle } from './cycle.js';
import { preparerLotSources, estLotSources } from './lot-sources.js';
import { CLE_EDITION_CONFIRMEE, cibleCommune } from './cycle-edition.js';

// L4 (D-G8) : une ligne files n'entre en file QUE quand ses octets sont confirmés — remote valide de ce compte — et jamais une
// suppression. (R-L3-22, L3 : aucune ligne « files » n'entrait en file, faute d'octets à envoyer — « À envoyer : N » ne redescendait
// plus ; la capture ne retient toujours pas une photo posée sans copie serveur, ni un type hors liste — syncable faux.) Les entrées
// `files` capturées par L2 restent retirées une fois par `repo.init()` (même ruling). La liste lue est SYNC_STORES elle-même (ronde 1).

// Copie de la fiche au moment de la suppression, sans laisser une clé héritée du prototype passer pour un payload.
function payloadFor(payloads, store, key) {
  const bag = payloads?.[store];
  return bag && Object.hasOwn(bag, key) ? bag[key] || null : null;
}

export function installCapture(db, { getUserId = () => null, isActivitySynced = () => false, configSuitLeCompte = () => false } = {}) {
  db.onMutate = ({ puts = {}, deletes = {}, origin = 'local', payloads = {}, recettes = [], editions = [], lifecycle = null, archive_import = false, source_batch = null, source_commands = [], translation_commands=[], cooking_commands=[], inventory_commands=[], lecture }) => {
    // Réception, ajustement du serveur et vidage d'appareil ne repartent jamais vers le serveur.
    if (origin !== 'local') return null;
    const rows = [];
    const user_id = getUserId();
    const source = preparerLotSources({ puts, recettes, editions, source_batch });
    const groupes = preparerCommandesSources({puts,commandes:source_commands});
    for(const k of preparerCommandesTraduction({puts,commandes:translation_commands,source_commands}))groupes.add(k);
    for(const k of preparerCommandesInventaire({puts,commandes:inventory_commands,lecture}))groupes.add(k);
    for(const k of preparerCommandesCuisine({puts,commandes:cooking_commands,lecture}))groupes.add(k);
    for(const r of source?.rows||[])groupes.add(`${r.store}:${r.id}`);
    for(const c of source_commands)rows.push({user_id,store:c.store,id:c.id,op:c.op,payload:structuredClone(c),tries:0});
    for(const c of translation_commands)rows.push({user_id,store:c.store,id:c.id,op:c.op,payload:structuredClone(c),tries:0});
    for(const c of inventory_commands)rows.push({user_id,store:c.store,id:c.id,op:c.op,payload:structuredClone(c),tries:0});
    for(const c of cooking_commands)rows.push({user_id,store:c.store,id:c.id,op:c.op,payload:structuredClone(c),tries:0});
    if (source) rows.push({ user_id, store: 'scan_sessions', id: source.id, op: 'source_batch', payload: source, recipe_id: source.recipe_id, tries: 0 });
    const contexte = (store,id) => {
      const cs=recettes.filter(c => (store==='recipes'&&c.recipe_id===id)||c.records?.some(r=>r.store===store&&r.id===id));
      const projections=cs.map(c=>({recipe_id:c.recipe_id,expected_cycle_id:c.expected_cycle_id??null,...(Object.hasOwn(c,'expected_edition_id')?{expected_edition_id:c.expected_edition_id}:{}),...(c.historique?{historique:true}:{})}));
      const es=editions.filter(c=>(store==='book_editions'&&c.edition_id===id)||c.records?.some(r=>r.store===store&&r.id===id));
      return {...(projections.length>1?{recipe_contexts:projections}:projections[0]||{}),...(es.length?{edition_contexts:es.map(c=>({edition_id:c.edition_id,expected_cycle_id:c.expected_cycle_id??null,...(c.historique?{historique:true}:{}),...(c.recipe_id?{recipe_id:c.recipe_id}:{})}))}:{})};
    };
    const cible=lifecycle?.entity==='edition'?{store:'book_editions',id:lifecycle.edition_id}:{store:'recipes',id:lifecycle?.recipe_id};
    if (lifecycle) rows.push({user_id,...cible,op:'lifecycle',updated_at:lifecycle.at,payload:structuredClone(lifecycle),...(lifecycle.recipe_id?{recipe_id:lifecycle.recipe_id}:{}),tries:0});
    const wanted = (store) => SYNC_STORES.includes(store) && (store !== 'library_activity' || isActivitySynced()) && (store !== 'assistant_config' || configSuitLeCompte());
    for (const [store, list] of Object.entries(puts)) {
      if (!wanted(store)) continue;
      if (store === 'files') { for (const r of list) if (r?.syncable !== false && remoteDeCeCompte(r?.remote, user_id)) rows.push({ user_id, store, id: keyOf(store, r), op: 'put', updated_at: r.updated_at || null, tries: 0 }); continue; }
      for (const r of list) {
        const id=keyOf(store,r);
        if (groupes.has(`${store}:${id}`)) continue;
        if (lifecycle && store===cible.store && id===cible.id) continue;
        const ctx=contexte(store,id);
        rows.push({ user_id, store, id, op: 'put', updated_at: r.updated_at || null, tries: 0,...ctx,...((ctx.edition_contexts||['recipe_versions','source_pages','source_documents','scan_sessions','cook_sessions','timer_launches','cook_history','inventory'].includes(store)||estLectureSourceSignee(store,r))?{snapshot:structuredClone(r)}:{}),...(archive_import?{archive_import:true}:{}) });
      }
    }
    for (const [store, keys] of Object.entries(deletes)) {
      if (!wanted(store)) continue;
      if (store === 'files') continue; // D-G15 : une suppression locale de files n'est JAMAIS capturée
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
        rows.push({ user_id, store, id: k, op: 'delete', updated_at: syncNow(), payload, tries: 0,...contexte(store,k) });
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
  const e=await db.get('outbox',seq);
  if(estCommandeTraduction(e)||estPhaseJournalTraduction(e)||estCommandeCuisine(e)||estCommandeInventaire(e))return false;
  if (estLotSources(e)) {
    const owner = (await db.get('sync_state', 'user_id'))?.value ?? null;
    if (!estDeCeCompte(e, owner)) return false;
    const suite = (await db.getAll('outbox')).filter(x => x.seq > seq && estDeCeCompte(x, owner) && cibleCommune(x, e));
    await db.mutate({ deletes: { outbox: [seq] }, puts: suite.length ? { outbox: suite.map(x => ({ ...x, lifecycle_blocked: true, last_error: 'cycle' })) } : {},
      origin: 'remote', conditions: { outbox: [{ key: seq, fusion: row => { if (JSON.stringify(row) !== JSON.stringify(e)) throw Error('Intention de sources changée'); return null; } }],
        sync_state: [{ key: 'user_id', fusion: row => { if ((row?.value ?? null) !== owner) throw Error('Compte du conflit changé'); return null; } }] } });
    return true;
  }
  if(e?.op==='lifecycle') {
    const owner=(await db.get('sync_state','user_id'))?.value??null;
    if(e.user_id!=null&&e.user_id!==owner) return false;
    const edition=e.store==='book_editions',cle=(edition?CLE_EDITION_CONFIRMEE:CLE_CYCLE_CONFIRME)(e.id);
    const confirmation=await db.get('sync_state',cle);
    if(confirmation&&confirmation.value?.user_id!==owner) return false;
    const confirme=confirmation?.value?.data||e.payload?.seed;
    if(!confirme) return false;
    const locale=await db.get(e.store,e.id),suivants=(await db.getAll('outbox')).filter(x=>cibleCommune(x,e)&&x.seq>seq&&estDeCeCompte(x,owner));
    const garder=attendu=>row=>{if(JSON.stringify(row)!==JSON.stringify(attendu))throw Error('Intention de corbeille changée');return null;};
    try {await db.mutate({deletes:{outbox:[seq]},puts:suivants.length?{outbox:suivants.map(x=>({...x,lifecycle_blocked:true,last_error:'cycle'}))}:{},conditions:{
      [e.store]:[{key:e.id,fusion:row=>{garder(locale)(row);return row?{...row,lifecycle_id:idCycle(confirme),trashed_at:confirme.trashed_at??null,...(edition?{trash_mode:confirme.trash_mode??null}:{restored_from_edition:confirme.restored_from_edition??null})}:null;}}],
      outbox:[{key:seq,fusion:garder(e)},...suivants.map(x=>({key:x.seq,fusion:garder(x)}))],
      sync_state:[{key:'user_id',fusion:row=>{if((row?.value??null)!==owner)throw Error('Intention de corbeille changée');return null;}},{key:cle,fusion:garder(confirmation)}]
    },origin:'remote'});}catch(error){if(error.message==='Intention de corbeille changée')return false;throw error;}
    return true;
  }
  await db.mutate({ deletes: { outbox: [seq] }, origin: 'device' });
}
