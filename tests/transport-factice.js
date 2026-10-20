// Transport factice de la suite L3 : aucun réseau. Deux modes, et un seul journal.
//
// 1. SCRIPTÉ (par défaut) : chaque appel consomme la réponse suivante de sa liste ; au-delà, la dernière est
//    répétée. `lire` est scripté par table : { books: [[lignes page 1], [lignes page 2]] }.
// 2. SERVEUR (R-L3-21) : `creerTransportFactice({ serveur: true })` tient les lignes EN MÉMOIRE et ARBITRE comme
//    `app.sync_push` (supabase/migrations/0001_tables_et_regles.sql, l. 545-634). Raison : sans arbitre, le factice
//    accusait TOUT et aucune divergence de contrat client ↔ serveur n'était détectable par la suite — c'est ce qui
//    avait laissé passer C1 (une tombale partant avec l'heure que le serveur possède déjà est refusée en « conflit »).
//    La comparaison de contenu est écrite ICI, indépendante de `identiques` de `src/sync/pull.js` : un arbitre qui
//    emprunterait la règle du client ne pourrait jamais le contredire.
//
// Tout appel est journalisé dans les deux modes.

// Clé primaire par table, comme la constante `keys` de `sync_push`. Les deux seules exceptions à « id ».
const CLES = { files: 'sha256', rediscovery_prefs: 'edition_id' };
const clePrimaire = (table) => CLES[table] || 'id';

// Un instant, jamais une chaîne : « 2026-10-13T11:00:00+00:00 » et « …:00.000Z » sont le MÊME instant (R-L3-11).
const instant = (valeur) => { const ms = Date.parse(valeur); return Number.isFinite(ms) ? ms : null; };

// jsonb réordonne les clés d'un objet : l'égalité `d = cur_data` de `sync_push` ne dépend pas de leur ordre.
// L'ordre d'un TABLEAU, lui, est du contenu.
function trie(valeur) {
  if (Array.isArray(valeur)) return valeur.map(trie);
  if (valeur && typeof valeur === 'object') {
    const sortie = {};
    for (const cle of Object.keys(valeur).sort()) sortie[cle] = trie(valeur[cle]);
    return sortie;
  }
  return valeur;
}
const memeContenu = (a, b) => JSON.stringify(trie(a ?? null)) === JSON.stringify(trie(b ?? null));

// L'arbitre : les lignes du serveur et les cinq issues de `sync_push` pour un élément.
function creerServeur() {
  const lignes = {}; // lignes[store][id] = { data, updated_at, deleted_at, server_seq }
  let sequence = 0;  // server_seq GLOBAL et croissant, posé par le serveur à chaque écriture (R25)

  function arbitrer(element, maintenantIso) {
    const { store, id } = element;
    const tombale = element.deleted === true;
    const data = element.data ?? null;
    // Clé absente : rejetée pour tous les éléments, tombale comprise (la colonne id est not null en base).
    if (!id) return { store, id: id ?? null, reason: 'cle' };
    const u = instant(element.updated_at);
    if (u === null) return { store, id, reason: 'updated_at' };
    // La clé primaire portée par `data` doit valoir `id`, comme `d->>(keys->>s) is distinct from i`.
    if (data && data[clePrimaire(store)] !== id) return { store, id, reason: 'cle' };
    if (store === 'files' && data && Object.hasOwn(data, 'blob')) return { store, id, reason: 'forme' }; // check (not (data ? 'blob')) de 0001 : les octets ne voyagent jamais dans data
    const table = (lignes[store] ||= {});
    const courante = table[id];
    if (!courante) {
      sequence += 1;
      table[id] = { data: data || {}, updated_at: element.updated_at, deleted_at: tombale ? maintenantIso : null, server_seq: sequence };
      return { store, id };
    }
    const base = instant(courante.updated_at);
    // Plus récent que la base : la ligne est écrite. Une tombale pose `deleted_at` (et le garde s'il y était déjà) ;
    // une écriture ordinaire le remet à null — c'est le `case when del then coalesce(cur_deleted, now_ts) end` du SQL.
    if (base !== null && u > base) {
      sequence += 1;
      table[id] = {
        data: data || courante.data,
        updated_at: element.updated_at,
        deleted_at: tombale ? (courante.deleted_at || maintenantIso) : null,
        server_seq: sequence,
      };
      return { store, id };
    }
    // Réessai idempotent : même instant, et rien à changer. Rien n'est écrit, server_seq inchangé.
    const idempotent = base !== null && u === base
      && ((tombale && courante.deleted_at) || (!tombale && !courante.deleted_at && memeContenu(data, courante.data)));
    if (idempotent) return { store, id };
    return { store, id, reason: 'conflit', server: { data: courante.data, updated_at: courante.updated_at, deleted_at: courante.deleted_at } };
  }

  return {
    // Ce que le serveur porte pour une clé : lu par les tests, jamais par le client.
    ligne: (store, id) => (lignes[store] || {})[id] || null,
    pousser(rows) {
      const maintenantIso = new Date().toISOString();
      const accepted = []; const adjusted = []; const rejected = [];
      for (const element of rows || []) {
        const verdict = arbitrer(element, maintenantIso);
        if (verdict.reason) rejected.push(verdict);
        else accepted.push({ store: verdict.store, id: verdict.id });
      }
      return { server_time: maintenantIso, accepted, adjusted, rejected };
    },
    lire(table, apres, limite) {
      return Object.entries(lignes[table] || {})
        .map(([id, l]) => ({ id, data: l.data, updated_at: l.updated_at, deleted_at: l.deleted_at, server_seq: l.server_seq }))
        .filter((l) => l.server_seq > apres)
        .sort((a, b) => a.server_seq - b.server_seq)
        .slice(0, limite);
    },
  };
}

export function creerTransportFactice({ pousser = [], lire = {}, serveur = false } = {}) {
  const journal = [];
  const filesLire = Object.fromEntries(Object.entries(lire).map(([t, pages]) => [t, [...pages]]));
  const arbitre = serveur ? creerServeur() : null;
  let iPousser = 0;
  return {
    journal,
    // Mode serveur seulement : ce que le serveur porte pour une clé (null en mode scripté).
    ligne: (store, id) => (arbitre ? arbitre.ligne(store, id) : null),
    async pousser(rows) {
      journal.push({ appel: 'pousser', rows: structuredClone(rows) });
      if (arbitre) return { reponse: structuredClone(arbitre.pousser(rows)), erreur: null };
      const r = pousser[Math.min(iPousser, pousser.length - 1)] || { reponse: { server_time: new Date().toISOString(), accepted: rows.map(({ store, id }) => ({ store, id })), adjusted: [], rejected: [] } };
      iPousser += 1;
      return { reponse: r.reponse ? structuredClone(r.reponse) : null, erreur: r.erreur || null };
    },
    async lire(table, apres, limite = 1000) {
      journal.push({ appel: 'lire', table, apres, limite });
      if (arbitre) return { lignes: structuredClone(arbitre.lire(table, apres, limite)), erreur: null };
      const pages = filesLire[table] || [];
      const page = pages.length ? pages.shift() : [];
      // R-L3-4 : une page scriptée est un tableau de lignes OU un objet { erreur } — rien d'autre. Sans ce garde,
      // toute autre forme filait jusqu'à « page.filter is not a function », une panne nommée très loin de sa cause.
      if (!Array.isArray(page)) {
        if (page && typeof page === 'object' && page.erreur) return { lignes: null, erreur: page.erreur };
        throw new TypeError('transport factice : page scriptée de forme inconnue pour ' + table + ' (un tableau de lignes, ou { erreur })');
      }
      return { lignes: structuredClone(page.filter((l) => l.server_seq > apres).slice(0, limite)), erreur: null };
    },
  };
}
