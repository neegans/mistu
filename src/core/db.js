import {preparerCommandesInventaire} from '../sync/commandes-inventaire.js';
import {preparerCommandesCuisine} from '../sync/commandes-cuisine.js';
import {preparerCommandesTraduction} from '../sync/commandes-traduction.js';
import {preparerCommandesSources} from '../sync/commandes-sources.js';
import {signalerCommit} from './observations-base.js';
import {emit} from './bus.js';
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
// Le statut vient de la base (ligne reçue du serveur ou restaurée d'une archive : hostile) : le message n'en recopie que 80 points de
// code, ou le type ; la valeur entière reste en propriété `statut`.
const decrireStatut = (statut) => (typeof statut === 'string' ? [...statut].slice(0, 80).join('') : (statut === null || ['number', 'boolean', 'undefined'].includes(typeof statut) ? String(statut) : typeof statut));

export class TransitionRefusee extends Error {
  constructor(store, key, statut) {
    super(`Transition refusée : ${store}/${String(key)} au statut ${decrireStatut(statut)}`);
    this.name = 'TransitionRefusee';
    this.store = store;
    this.key = key;
    this.statut = statut;
  }
}

// Aplatit et vérifie la forme des conditions : { [store]: [condition, …] } → liste. Trois formes (spec § 3.6 ; les deux dernières : ronde 1 de
// la tâche 3, pour que la CRÉATION d'une ligne du journal soit conditionnée comme ses transitions, I-10 et I-2) :
// - { key, attendus, patch? } : la fiche existe et `status ∈ attendus` ; `attendus` : des chaînes non vides, au moins une (`[undefined]`
//   laisserait passer une ligne SANS statut, reçue ou restaurée) ; `patch` est un objet ou une fonction du courant ; absent, la fiche est
//   seulement vérifiée (pas réécrite) ;
// - { key, absente: true } : la fiche N'EXISTE PAS (une création ne doit jamais écraser une ligne, quel que soit son statut) ;
// - { index, valeur, exclus } : AUCUNE fiche de l'index `index` à cette `valeur` n'a un statut parmi `exclus` (chaînes non vides, au moins une) ;
// - { index, valeur, absente: true } : AUCUNE fiche à cette valeur d'index (I2 : ISBN, même si la fiche n'a pas de statut) ;
// - { key, fusion } (lot G, ronde 1 de la tâche 1) : la fiche est relue DANS la transaction et `fusion(courant)` (courant : la fiche, ou null si
//   elle n'existe pas) rend la fiche à écrire, sous la même clé, ou null (rien d'écrit pour elle) ; aucun statut (une ligne `files` n'en a pas) :
//   une écriture calculée sur une lecture antérieure ne perd jamais ce qui est arrivé depuis (un blob local, I-G3).
// Deux conditions sur la même fiche (ou le même index/valeur) sont refusées (la seconde écraserait la première en silence). `null` ou absent :
// aucune condition.
const statutsValides = (xs) => Array.isArray(xs) && xs.length > 0 && xs.every((a) => typeof a === 'string' && a);
function listeConditions(conditions) {
  if (conditions == null) return [];
  if (typeof conditions !== 'object' || Array.isArray(conditions)) throw new TypeError('Les conditions doivent associer chaque magasin à un tableau');
  const liste = [];
  const vues = new Set();
  const unique = (fiche) => { if (vues.has(fiche)) throw new TypeError('Deux conditions sur la même fiche ' + fiche); vues.add(fiche); };
  for (const [store, items] of Object.entries(conditions)) {
    if (!Array.isArray(items)) throw new TypeError('Les conditions de ' + store + ' doivent être un tableau');
    for (const c of items) {
      if (!c || typeof c !== 'object') throw new TypeError('Condition sans clé sur ' + store);
      // Archive L1 : contrôler l'ensemble courant avant un remplacement, sans fenêtre entre contrôle et vidage.
      if (c.toutes === true) {
        if (typeof c.verifier !== 'function' || Object.keys(c).some(k => !['toutes', 'verifier'].includes(k))) throw new TypeError('Condition de magasin invalide sur ' + store);
        unique(store + '/#all'); liste.push({ store, toutes: true, verifier: c.verifier }); continue;
      }
      if (c.index != null) {
        if(typeof c.verifier==='function'){
          if(typeof c.index!=='string'||!c.index||c.valeur==null||Object.keys(c).some(k=>!['index','valeur','verifier'].includes(k)))throw new TypeError('Contrôle index invalide');
          unique(store+'/#'+c.index+'='+String(c.valeur));liste.push({store,index:c.index,valeur:c.valeur,verifier:c.verifier});continue;
        }
        const absence = c.absente === true && c.exclus == null;
        if (typeof c.index !== 'string' || !c.index || c.valeur == null || c.key != null || c.patch != null || c.fusion != null || c.attendus != null || (!absence && (!statutsValides(c.exclus) || c.absente != null))) throw new TypeError('Une condition d’index porte index, valeur et des statuts exclus ou absente: true, sans clé ni écriture (' + store + ')');
        unique(store + '/#' + c.index + '=' + String(c.valeur));
        liste.push({ store, index: c.index, valeur: c.valeur, exclus: c.exclus, absente: absence });
        continue;
      }
      if (c.key == null) throw new TypeError('Condition sans clé sur ' + store);
      unique(store + '/' + String(c.key));
      if (c.fusion != null) {
        if (typeof c.fusion !== 'function' || c.attendus != null || c.patch != null || c.absente != null) throw new TypeError('Une condition de fusion porte une clé et une fonction, sans statuts, patch ni « absente » (' + store + ')');
        liste.push({ store, key: c.key, fusion: c.fusion });
        continue;
      }
      if (c.absente === true) {
        if (c.attendus != null || c.patch != null) throw new TypeError('Une condition « absente » ne porte ni attendus ni patch (' + store + ')');
        liste.push({ store, key: c.key, absente: true });
        continue;
      }
      if (!statutsValides(c.attendus)) throw new TypeError('Les statuts attendus d’une condition sont des chaînes non vides, au moins une (' + store + ')');
      if (c.patch != null && typeof c.patch !== 'object' && typeof c.patch !== 'function') throw new TypeError('Le patch d’une condition est un objet ou une fonction (' + store + ')');
      liste.push({ store, key: c.key, attendus: c.attendus, patch: c.patch ?? null });
    }
  }
  return liste;
}

// Écriture conditionnée (spec import-cible § 3.6, I-10) : dans UNE transaction readwrite, chaque fiche conditionnée est lue (get ; ou les
// fiches d'un index par getAll(valeur)), son statut vérifié parmi `attendus` (ou son ABSENCE ; ou l'absence de tout statut `exclus` sur l'index),
// la fiche fusionnée { ...courant, ...patch(courant) } ajoutée aux puts ; puis, DANS LE RAPPEL onsuccess
// (capture d'outbox) et tout est écrit. Une condition fausse → tx.abort() et TransitionRefusee, capturée dans la fermeture et relancée à
// la place du rejet générique « Transaction annulée » de done() ; une exception du patch ou d'un put est relancée de même. Un patch ne
// change jamais la clé (TypeError, transaction annulée) : la fiche fusionnée s'écrirait sinon À CÔTÉ de l'originale. La portée inclut
// `outbox` seulement si la base la possède : la capture écrit là, et les bases de test TEST_STORES n'en ont pas.
// Rend les fiches fusionnées, par magasin ({ [store]: [fiche, …] }) : l'appelant n'a pas à relire la base dans une autre transaction.
async function ecrireConditionne(db, { puts, deletes, clearStores, origin, payloads, liste, recettes, editions, lifecycle, archive_import, source_batch, source_commands, translation_commands, cooking_commands, inventory_commands }) {
  const toClear = knownStoreNames(db.stores, clearStores);
  const portee = knownStoreNames(db.stores, [...toClear, ...Object.keys(puts), ...Object.keys(deletes), ...liste.map((c) => c.store), ...(db.stores.outbox ? ['outbox'] : [])]);
  const tx = await db.tx(portee, 'readwrite');
  let refus = null;
  let magasinsEcrits = [];
  const fusionnees = {};
  const completion = runTransaction(tx, () => {
    const lus = new Array(liste.length);
    let restants = liste.length;
    const ecrireTout = () => {
      try {
        // Les gardes de parent et d'enfant voient le même instantané, indépendamment de leur ordre.
        const lecture = (store, key) => { const i = liste.findIndex(c => c.store === store && (c.key === key || c.toutes)); return i < 0 ? undefined : liste[i].toutes ? lus[i].find(r => r[db.stores[store].keyPath] === key) : lus[i]; };
        const allPuts = { ...puts };
        for (const [i, c] of liste.entries()) {
          const courant = lus[i];
          if (c.toutes) {
            const verdict = c.verifier(courant);
            if (verdict?.then) throw new TypeError('Une vérification transactionnelle reste synchrone');
            continue;
          }
          if (c.index) { // aucune fiche de l'index à cette valeur n'a un statut exclu (I-2 : un seul import ouvert par recette)
            if(c.verifier){const verdict=c.verifier(courant);if(verdict?.then)throw new TypeError('Une vérification transactionnelle reste synchrone');continue;}
            const fautive = (Array.isArray(courant) ? courant : []).find((r) => r && (c.absente || c.exclus.includes(r.status)));
            if (fautive) { refus = new TransitionRefusee(c.store, c.index + '=' + String(c.valeur), fautive.status); tx.abort(); return; }
            continue;
          }
          if (c.fusion) { // la fiche à écrire est calculée sur la fiche RELUE ici ; null : rien pour elle
            const fiche = c.fusion(courant ?? null, lecture);
            if (fiche == null) continue;
            const keyPath = db.stores[c.store].keyPath;
            if (fiche[keyPath] !== c.key) throw new TypeError('La fusion de ' + c.store + '/' + String(c.key) + ' change la clé ' + keyPath);
            allPuts[c.store] = [...(allPuts[c.store] || []), fiche];
            fusionnees[c.store] = [...(fusionnees[c.store] || []), fiche];
            continue;
          }
          if (c.absente) { // la fiche n'existe pas : une création n'écrase jamais une ligne, quel que soit son statut
            if (courant != null) { refus = new TransitionRefusee(c.store, c.key, courant.status); tx.abort(); return; }
            continue;
          }
          const statut = courant?.status;
          if (courant == null || !c.attendus.includes(statut)) { refus = new TransitionRefusee(c.store, c.key, statut); tx.abort(); return; }
          if (c.patch == null) continue; // vérification seule : la fiche n'est pas réécrite
          const fusion = { ...courant, ...(typeof c.patch === 'function' ? c.patch(courant) : c.patch) };
          const keyPath = db.stores[c.store].keyPath;
          if (fusion[keyPath] !== courant[keyPath]) throw new TypeError('Le patch de ' + c.store + '/' + String(c.key) + ' change la clé ' + keyPath);
          allPuts[c.store] = [...(allPuts[c.store] || []), fusion];
          fusionnees[c.store] = [...(fusionnees[c.store] || []), fusion];
        }
        if(origin==='local'){preparerCommandesSources({puts:allPuts,commandes:source_commands});preparerCommandesTraduction({puts:allPuts,commandes:translation_commands,source_commands});preparerCommandesInventaire({puts:allPuts,commandes:typeof inventory_commands==='function'?inventory_commands(allPuts):inventory_commands,lecture});preparerCommandesCuisine({puts:allPuts,commandes:typeof cooking_commands==='function'?cooking_commands(allPuts):cooking_commands,lecture});}
        const extra = db.onMutate ? (db.onMutate({ puts: allPuts, deletes, clearStores, origin, payloads, recettes, editions, lifecycle: typeof lifecycle === 'function' ? lifecycle() : lifecycle, archive_import, source_batch, source_commands, translation_commands, cooking_commands:typeof cooking_commands==='function'?cooking_commands(allPuts):cooking_commands,inventory_commands:typeof inventory_commands==='function'?inventory_commands(allPuts):inventory_commands,lecture }) || {}) : {};
        for (const [name, rows] of Object.entries(extra)) allPuts[name] = [...(allPuts[name] || []), ...rows];
        ecrire(tx, toClear, allPuts, deletes);
        magasinsEcrits = [...toClear,...Object.keys(allPuts).filter(s=>allPuts[s].length),...Object.keys(deletes).filter(s=>deletes[s].length)];
      } catch (error) {
        refus = error;
        try { tx.abort(); } catch (_) { /* transaction déjà terminée */ }
      }
    };
    for (const [i, c] of liste.entries()) {
      const request = c.toutes ? tx.objectStore(c.store).getAll() : c.index ? tx.objectStore(c.store).index(c.index).getAll(c.valeur) : tx.objectStore(c.store).get(c.key);
      request.onsuccess = () => { lus[i] = request.result; if (--restants === 0) ecrireTout(); };
    }
  });
  try { await completion; } catch (error) { throw refus || error; }
  signalerCommit(db,magasinsEcrits);
  return fusionnees;
}

// Les trois écritures de la porte unique, dans cet ordre — vidages, puts, suppressions — pour les DEUX chemins de mutate.
function ecrire(tx, toClear, allPuts, deletes) {
  for (const name of toClear) tx.objectStore(name).clear();
  for (const [name, rows] of Object.entries(allPuts)) { const os = tx.objectStore(name); for (const row of rows) os.put(row); }
  for (const [name, keys] of Object.entries(deletes)) { const os = tx.objectStore(name); for (const key of keys) os.delete(key); }
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
    let connexion;
    try { connexion = await req(request); }
    catch (error) {
      if (error?.name === 'VersionError') emit('versionchange_bloquee', { db: this });
      throw error;
    }
    this.idb = connexion;
    connexion.onversionchange = event => {
      // Deux open simultanés peuvent avoir rendu deux handles : chacun ferme le sien.
      connexion.close();
      if (this.idb === connexion) this.idb = null;
      // deleteDatabase envoie null ; ce n'est pas une version supérieure de l'application.
      if (event.newVersion !== null && event.newVersion > connexion.version) emit('versionchange_bloquee', { db: this });
    };
    return connexion;
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
  // patch fusionné dans la MÊME transaction que tout le reste ; condition fausse → TransitionRefusee, rien d'écrit (ecrireConditionne) ;
  // ce chemin rend les fiches fusionnées par magasin. `null` ou absent : aucune condition, et le chemin ordinaire ne rend rien. Les quatre
  // formes (dont `{ key, fusion }`, lot G) sont décrites au-dessus de listeConditions.
  async mutate({ puts = {}, deletes = {}, clearStores = [], origin = 'local', payloads = {}, conditions = null, recettes = [], editions = [], lifecycle = null, archive_import = false, source_batch = null, source_commands = [], translation_commands = [], cooking_commands = [], inventory_commands = [] } = {}) {
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
    if (liste.length) return ecrireConditionne(this, { puts, deletes, clearStores, origin, payloads, liste, recettes, editions, lifecycle, archive_import, source_batch, source_commands, translation_commands, cooking_commands, inventory_commands });
    if(origin==='local'){preparerCommandesSources({puts,commandes:source_commands});preparerCommandesTraduction({puts,commandes:translation_commands,source_commands});preparerCommandesCuisine({puts,commandes:cooking_commands});preparerCommandesInventaire({puts,commandes:inventory_commands});}
    const extra = this.onMutate ? (this.onMutate({ puts, deletes, clearStores, origin, payloads, recettes, editions, lifecycle: typeof lifecycle === 'function' ? lifecycle() : lifecycle, archive_import, source_batch, source_commands, translation_commands, cooking_commands, inventory_commands }) || {}) : {};
    const allPuts = { ...puts };
    for (const [name, rows] of Object.entries(extra)) allPuts[name] = [...(allPuts[name] || []), ...rows];
    const toClear = knownStoreNames(this.stores, clearStores);
    const names = knownStoreNames(this.stores, [...toClear, ...Object.keys(allPuts), ...Object.keys(deletes)]);
    if (!names.length) return;
    const tx = await this.tx(names, 'readwrite');
    await runTransaction(tx, () => ecrire(tx, toClear, allPuts, deletes));
    signalerCommit(this,[...toClear,...Object.keys(allPuts).filter(s=>allPuts[s].length),...Object.keys(deletes).filter(s=>deletes[s].length)]);
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
