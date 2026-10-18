// Enveloppe IndexedDB à promesses. Un seul magasin d'objets par entité (spec §14 : « structures simples dans une seule base »).

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    let requestError = null;
    tx.oncomplete = () => resolve();
    // L'événement error précède le rollback : attendre abort avant de rejeter.
    tx.onerror = (event) => { requestError = event.target?.error || requestError; };
    tx.onabort = () => reject(tx.error || requestError || new Error('Transaction annulée'));
  });
}

// Refus nommé d'une écriture conditionnée (spec import-cible § 3.6, I-10) : le statut lu n'est pas parmi les attendus, ou la fiche
// n'existe pas (statut indéfini). La transaction entière a été annulée : RIEN n'a été écrit, pas même les puts qui l'accompagnaient.
export class TransitionRefusee extends Error {
  constructor(store, key, statut) {
    super(`Transition refusée : ${store}/${String(key)} au statut ${String(statut)}`);
    this.name = 'TransitionRefusee';
    this.store = store;
    this.key = key;
    this.statut = statut;
  }
}

// Aplatit et vérifie la forme des conditions : { [store]: [{ key, attendus, patch? }] } → liste. `patch` est un objet ou une fonction
// du courant ; absent, la fiche est seulement vérifiée (pas réécrite).
function listeConditions(conditions) {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) throw new TypeError('Les conditions doivent associer chaque magasin à un tableau');
  const liste = [];
  for (const [store, items] of Object.entries(conditions)) {
    if (!Array.isArray(items)) throw new TypeError('Les conditions de ' + store + ' doivent être un tableau');
    for (const c of items) {
      if (!c || typeof c !== 'object' || c.key == null) throw new TypeError('Condition sans clé sur ' + store);
      if (!Array.isArray(c.attendus)) throw new TypeError('Condition sans statuts attendus sur ' + store);
      if (c.patch != null && typeof c.patch !== 'object' && typeof c.patch !== 'function') throw new TypeError('Le patch d’une condition est un objet ou une fonction (' + store + ')');
      liste.push({ store, key: c.key, attendus: c.attendus, patch: c.patch ?? null });
    }
  }
  return liste;
}

// Écriture conditionnée (spec import-cible § 3.6, I-10) : dans UNE transaction readwrite, chaque fiche conditionnée est lue (get), son
// statut vérifié parmi `attendus`, la fiche fusionnée { ...courant, ...patch(courant) } ajoutée aux puts ; puis, DANS LE RAPPEL onsuccess
// de la dernière lecture (aucun await : IndexedDB valide la transaction dès que la file est vide), onMutate est appelé de façon synchrone
// (capture d'outbox) et tout est écrit. Une condition fausse → tx.abort() et TransitionRefusee, capturée dans la fermeture et relancée à
// la place du rejet générique « Transaction annulée » de done() ; une exception du patch ou d'un put est relancée de même. La portée
// inclut `outbox` seulement si la base la possède : la capture écrit là, et les bases de test TEST_STORES n'en ont pas.
async function ecrireConditionne(db, { puts, deletes, clearStores, origin, payloads, liste }) {
  const toClear = knownStoreNames(db.stores, clearStores);
  const portee = knownStoreNames(db.stores, [...toClear, ...Object.keys(puts), ...Object.keys(deletes), ...liste.map((c) => c.store), ...(db.stores.outbox ? ['outbox'] : [])]);
  const tx = await db.tx(portee, 'readwrite');
  let refus = null;
  const completion = runTransaction(tx, () => {
    const lus = new Array(liste.length);
    let restants = liste.length;
    const ecrire = () => {
      try {
        const allPuts = { ...puts };
        for (const [i, c] of liste.entries()) {
          const courant = lus[i];
          const statut = courant?.status;
          if (courant == null || !c.attendus.includes(statut)) { refus = new TransitionRefusee(c.store, c.key, statut); tx.abort(); return; }
          if (c.patch == null) continue; // vérification seule : la fiche n'est pas réécrite
          const modif = typeof c.patch === 'function' ? c.patch(courant) : c.patch;
          allPuts[c.store] = [...(allPuts[c.store] || []), { ...courant, ...modif }];
        }
        const extra = db.onMutate ? (db.onMutate({ puts: allPuts, deletes, clearStores, origin, payloads }) || {}) : {};
        for (const [name, rows] of Object.entries(extra)) allPuts[name] = [...(allPuts[name] || []), ...rows];
        for (const name of toClear) tx.objectStore(name).clear();
        for (const [name, rows] of Object.entries(allPuts)) { const os = tx.objectStore(name); for (const row of rows) os.put(row); }
        for (const [name, keys] of Object.entries(deletes)) { const os = tx.objectStore(name); for (const key of keys) os.delete(key); }
      } catch (error) {
        refus = error;
        try { tx.abort(); } catch (_) { /* transaction déjà terminée */ }
      }
    };
    for (const [i, c] of liste.entries()) {
      const request = tx.objectStore(c.store).get(c.key);
      request.onsuccess = () => { lus[i] = request.result; if (--restants === 0) ecrire(); };
    }
  });
  try { await completion; } catch (error) { throw refus || error; }
}

function knownStoreNames(stores, names) {
  if (!Array.isArray(names)) throw new TypeError('La liste des magasins doit être un tableau');
  const unique = [...new Set(names)];
  for (const name of unique) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(stores, name)) {
      throw new Error('Magasin inconnu : ' + String(name));
    }
  }
  return unique;
}

// enqueue reste synchrone : toutes les requêtes sont mises en file avant le premier await.
async function runTransaction(tx, enqueue) {
  const completion = done(tx);
  let result;
  try {
    result = enqueue(tx);
  } catch (error) {
    // Une exception synchrone de put/delete n'annule pas les requêtes déjà en file.
    try { tx.abort(); } catch (_) { /* transaction déjà terminée */ }
    try { await completion; } catch (_) { /* rejet consommé ; conserver l'erreur initiale */ }
    throw error;
  }
  await completion;
  return result;
}

export class Database {
  constructor(name, version, stores) {
    this.name = name;
    this.version = version;
    this.stores = stores; // { storeName: { keyPath, indexes: [[name, keyPath, options?]] } }
    this.idb = null;
    this.onMutate = null;
  }

  async open() {
    if (this.idb) return this.idb;
    if (!('indexedDB' in globalThis)) throw new Error('IndexedDB indisponible dans ce navigateur');
    const request = indexedDB.open(this.name, this.version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, def] of Object.entries(this.stores)) {
        let store;
        if (!db.objectStoreNames.contains(name)) store = db.createObjectStore(name, { keyPath: def.keyPath || 'id', autoIncrement: !!def.autoIncrement });
        else store = request.transaction.objectStore(name);
        for (const [idxName, keyPath, options] of def.indexes || []) {
          if (!store.indexNames.contains(idxName)) store.createIndex(idxName, keyPath, options || {});
        }
      }
    };
    this.idb = await req(request);
    this.idb.onversionchange = () => { this.idb.close(); this.idb = null; };
    return this.idb;
  }

  async tx(names, mode = 'readonly') {
    const selected = knownStoreNames(this.stores, names);
    const db = await this.open();
    return db.transaction(selected, mode);
  }

  // Photographie cohérente : lectures mises en file ensemble dans une transaction readonly.
  async getSnapshot(names = Object.keys(this.stores)) {
    const selected = knownStoreNames(this.stores, names);
    const snapshot = {};
    if (!selected.length) return snapshot;
    const tx = await this.tx(selected, 'readonly');
    return runTransaction(tx, () => {
      for (const name of selected) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { snapshot[name] = request.result; };
      }
      return snapshot;
    });
  }

  async get(store, key) {
    const tx = await this.tx([store]);
    return req(tx.objectStore(store).get(key));
  }

  async getMany(store, keys) {
    const tx = await this.tx([store]);
    const os = tx.objectStore(store);
    const results = await Promise.all(keys.map((k) => req(os.get(k))));
    return results;
  }

  async getAll(store) {
    const tx = await this.tx([store]);
    return req(tx.objectStore(store).getAll());
  }

  async byIndex(store, index, value) {
    const tx = await this.tx([store]);
    return req(tx.objectStore(store).index(index).getAll(value));
  }

  async count(store) {
    const tx = await this.tx([store]);
    return req(tx.objectStore(store).count());
  }

  async put(store, value) {
    await this.putBatch({ [store]: [value] });
    return value;
  }

  async putMany(store, values) {
    await this.putBatch({ [store]: values });
    return values;
  }

  // Vidages et écritures multi-magasins dans une transaction : tout réussit ou tout est annulé.
  async putBatch(batch, { clearStores = [], origin = 'local' } = {}) {
    if (!batch || typeof batch !== 'object' || Array.isArray(batch)) {
      throw new TypeError('Le lot doit associer chaque magasin à un tableau');
    }
    for (const [name, rows] of Object.entries(batch)) {
      if (!Array.isArray(rows)) throw new TypeError('Les données de ' + name + ' doivent être un tableau');
    }
    return this.mutate({ puts: batch, clearStores, origin });
  }

  async delete(store, key) {
    await this.deleteMany(store, [key]);
  }

  async deleteMany(store, keys) {
    if (!Array.isArray(keys)) throw new TypeError('Les clés à supprimer doivent être un tableau');
    return this.mutate({ deletes: { [store]: keys } });
  }

  async clear(store) {
    await this.mutate({ clearStores: [store] });
  }

  async clearAll() {
    await this.mutate({ clearStores: Object.keys(this.stores) });
  }

  // Porte unique d'écriture (spec § 5.1) : puts, deletes et vidages dans UNE transaction ; le crochet onMutate peut
  // ajouter des lignes (capture d'outbox) écrites dans la même transaction. origin : 'local' | 'remote' | 'device'.
  // `conditions` (spec import-cible § 3.6) : { [store]: [{ key, attendus, patch }] } — la fiche est lue, son statut vérifié et le
  // patch fusionné dans la MÊME transaction que tout le reste ; condition fausse → TransitionRefusee, rien d'écrit (ecrireConditionne).
  async mutate({ puts = {}, deletes = {}, clearStores = [], origin = 'local', payloads = {}, conditions = {} } = {}) {
    for (const [name, rows] of Object.entries(puts)) if (!Array.isArray(rows)) throw new TypeError('Les données de ' + name + ' doivent être un tableau');
    for (const [name, keys] of Object.entries(deletes)) if (!Array.isArray(keys)) throw new TypeError('Les clés de ' + name + ' doivent être un tableau');
    // K-6 / S6 : un magasin `noDelete` (assistant_config) n'accepte aucune suppression d'origine locale ou device —
    // une suppression copie la fiche dans la file (payload), et ce magasin porte un secret. L'origine 'remote' =
    // donnée reçue du serveur, seule exemptée ; ne l'employer pour rien d'autre (la garde se fie à l'étiquette).
    // `clearStores` reste permis (vidage d'appareil).
    for (const [name, keys] of Object.entries(deletes)) {
      if (keys.length && this.stores[name]?.noDelete && origin !== 'remote') {
        throw new Error(`Suppression interdite sur ${name} (noDelete) : écrire une ligne vide à la place`);
      }
    }
    const liste = listeConditions(conditions);
    if (liste.length) return ecrireConditionne(this, { puts, deletes, clearStores, origin, payloads, liste });
    const extra = this.onMutate ? (this.onMutate({ puts, deletes, clearStores, origin, payloads }) || {}) : {};
    const allPuts = { ...puts };
    for (const [name, rows] of Object.entries(extra)) allPuts[name] = [...(allPuts[name] || []), ...rows];
    const toClear = knownStoreNames(this.stores, clearStores);
    const names = knownStoreNames(this.stores, [...toClear, ...Object.keys(allPuts), ...Object.keys(deletes)]);
    if (!names.length) return;
    const tx = await this.tx(names, 'readwrite');
    await runTransaction(tx, () => {
      for (const name of toClear) tx.objectStore(name).clear();
      for (const [name, rows] of Object.entries(allPuts)) { const os = tx.objectStore(name); for (const row of rows) os.put(row); }
      for (const [name, keys] of Object.entries(deletes)) { const os = tx.objectStore(name); for (const key of keys) os.delete(key); }
    });
  }

  async isEmpty(ignore = []) {
    for (const name of Object.keys(this.stores)) {
      if (ignore.includes(name)) continue;
      if ((await this.count(name)) > 0) return false;
    }
    return true;
  }
}

// Méthodes qui écrivent dans la base, toutes rabattues sur mutate() : la porte unique d'écriture.
export const MUTATING_METHODS = ['put', 'putMany', 'putBatch', 'delete', 'deleteMany', 'clear', 'clearAll', 'mutate'];
