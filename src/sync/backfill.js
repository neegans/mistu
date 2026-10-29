// Envoi initial (spec § 5.2) : tout ce qui existait AVANT la connexion est mis en file, table par table, commandé
// par des marqueurs — pas par user_id. Reprenable : une table interrompue est rejouée en entier (le dédoublonnage de
// l'envoi absorbe les doublons) ; le marqueur part dans la MÊME transaction que le dernier morceau.
import { SYNC_STORES } from '../model/schema.js';
import { keyOf, remoteDeCeCompte } from './tables.js';
import { gardeCompteCycle } from './cycle.js';
import { capturerContextesInitiaux, contexteInitialPour } from './contexte-initial.js';
import { estDeCeCompte } from './outbox.js';

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
  const snapshot = await db.getSnapshot();
  const file = (snapshot.outbox || []).filter(e => estDeCeCompte(e, user_id));
  // Une intention déjà capturée garde son contenu et sa base, même incomplète : jamais de second put rebasé.
  const captures = new Set(file.flatMap(e => [`${e.store}:${e.id}`, ...(e.op === 'source_batch' ? (e.payload?.rows || []).map(r => `${r.store}:${r.id}`) : [])]));
  const capture = capturerContextesInitiaux(snapshot, { owner_id: user_id });
  const identique = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const garde = attendu => current => { if (!identique(current, attendu)) throw new Error('Données initiales modifiées pendant la capture'); return null; };
  // Ancienne file L1 : ne compléter que les bases initiales démontrables. Une entrée périmée reste
  // conservée, bloquée et nommée, plutôt que recevoir les droits du livre tel qu'il est aujourd'hui.
  const anciens = [], copies = [];
  for (const e of file) {
    if (['lifecycle', 'source_batch'].includes(e.op) || e.edition_contexts || e.lifecycle_blocked || e.store === 'files') continue;
    const contexte = contexteInitialPour(capture, e.store, e.id);
    if (!contexte.edition_contexts?.length) continue;
    const current = (snapshot[e.store] || []).find(r => keyOf(e.store, r) === e.id);
    let contenu = e.snapshot || (e.op === 'delete' ? e.payload : current), sur = e.op === 'put';
    const editions = contexte.edition_contexts.map(c => {
      const premiere = file.filter(x => x.op === 'lifecycle' && x.store === 'book_editions' && x.id === c.edition_id)
        .sort((a, b) => a.seq - b.seq)[0];
      const avant = premiere && e.seq < premiere.seq && premiere.payload?.seed && premiere.payload.base_cycle_id === null;
      if (avant) {
        if (e.store === 'book_editions' && e.id === c.edition_id) contenu = premiere.payload.seed;
        return { ...c, expected_cycle_id: null };
      }
      if (c.expected_cycle_id !== null) sur = false;
      return c;
    });
    const recettes = contexte.recipe_contexts || (contexte.recipe_id ? [contexte] : []);
    for (const r of recettes) {
      const ancien = e.recipe_contexts?.find(c => c.recipe_id === r.recipe_id) || (e.recipe_id === r.recipe_id && Object.hasOwn(e, 'expected_cycle_id') ? e : null);
      if (r.expected_cycle_id !== (ancien?.expected_cycle_id ?? null)) sur = false;
      if (ancien && Object.hasOwn(ancien, 'expected_edition_id') && ancien.expected_edition_id !== r.expected_edition_id) sur = false;
    }
    if (!contenu || (!e.snapshot && e.store !== 'book_editions' && contenu.updated_at !== e.updated_at)) sur = false;
    if (sur) anciens.push({ ...e, ...contexte, edition_contexts: editions, snapshot: structuredClone(contenu) });
    else {
      anciens.push({ ...e, lifecycle_blocked: true, last_error: 'cycle' });
      const id = `${e.store}:${e.id}`;
      if (!(snapshot.sync_conflicts || []).some(c => c.id === id)) copies.push({ id, store: e.store, record_id: e.id,
        local: structuredClone(contenu ?? null), server: null, at: new Date().toISOString(), user_id, kind: 'cycle' });
    }
  }
  if (anciens.length) await db.mutate({ puts: { outbox: anciens, ...(copies.length ? { sync_conflicts: copies } : {}) }, origin: 'device',
    conditions: { outbox: anciens.map(e => ({ key: e.seq, fusion: garde(file.find(x => x.seq === e.seq)) })),
      sync_state: [gardeCompteCycle(user_id, getUserId)],
      book_editions: (snapshot.book_editions || []).map(r => ({ key: r.id, fusion: garde(r) })),
      recipes: (snapshot.recipes || []).map(r => ({ key: r.id, fusion: garde(r) })) } });
  for (const [i, table] of tables.entries()) {
    surProgression({ phase: 'envoi_initial', table, n: i + 1, total });
    const lignes = (snapshot[table] || []).filter(r => !captures.has(`${table}:${keyOf(table, r)}`) && (table !== 'files' || (r?.syncable !== false && remoteDeCeCompte(r?.remote, user_id))));
    for (let debut = 0; debut < Math.max(lignes.length, 1); debut += tailleMorceau) {
      const morceau = lignes.slice(debut, debut + tailleMorceau);
      const dernier = debut + tailleMorceau >= lignes.length;
      const puts = { outbox: morceau.map(r => {
        const contexte = contexteInitialPour(capture, table, keyOf(table, r));
        return { user_id, store: table, id: keyOf(table, r), op: 'put', updated_at: r.updated_at || null, tries: 0,
          ...contexte, ...(contexte.edition_contexts ? { snapshot: structuredClone(r) } : {}) };
      }) };
      if (!puts.outbox.length) delete puts.outbox;
      if (dernier) puts.sync_state = [{ key: MARQUEUR(table), value: 'fait' }];
      const conditions = { sync_state: [gardeCompteCycle(user_id, getUserId)],
        [table]: morceau.map(r => ({ key: keyOf(table, r), fusion: garde(r) })) };
      for (const parent of ['recipes', 'book_editions', 'recipe_versions', 'source_documents', 'scan_sessions', 'meals', 'cook_sessions']) {
        if (parent === table) continue;
        conditions[parent] = (snapshot[parent] || []).map(r => ({ key: keyOf(parent, r), fusion: garde(r) }));
      }
      await db.mutate({ puts, conditions, origin: 'device' });
      mises += morceau.length;
    }
  }
  return { tables, mises };
}
