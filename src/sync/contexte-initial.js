// Capture d'un graphe déjà conservé (première connexion ou archive validée).
// Ce lecteur ne transforme jamais une intention en attente en une nouvelle base.
import { STORES, SYNC_STORES } from '../model/schema.js';
import { lireCycleRecette } from '../domain/cycle-recette.js';
import { lireCycleEdition } from '../domain/cycle-edition.js';

// Lectures locales de la capture, jamais ajoutées aux contextes envoyés ou archivés.
const lecturesCaptures = new WeakMap();
const cle = (store, id) => store + ':' + id;

export function capturerContextesInitiaux(snapshot, { owner_id = null } = {}) {
  const index = Object.fromEntries(Object.entries(snapshot).filter(([store, rows]) => STORES[store] && Array.isArray(rows))
    .map(([store, rows]) => [store, new Map(rows.map(row => [row[STORES[store].keyPath], row]))]));
  const recette = new Map(), edition = new Map(), dependances = new Map();
  let lectures;
  const ligne = (store, id) => {
    const row = index[store]?.get(id);
    // Une absence lue fait aussi partie du contexte : une insertion doit invalider la capture.
    lectures.lignes.set(cle(store, id), { store, id, row });
    return row;
  };
  const ajouter = (map, id, record, creer) => {
    if (typeof id !== 'string' || !id) return;
    if (!map.has(id)) map.set(id, { ...creer(id), records: [] });
    const c = map.get(id);
    if (!c.records.some(r => r.store === record.store && r.id === record.id)) c.records.push(record);
  };
  const contexteRecette = id => {
    const row = ligne('recipes', id), eid = row?.edition_id ?? null;
    return { recipe_id: id, expected_cycle_id: lireCycleRecette(row).id, expected_edition_id: eid,
      expected_edition_cycle_id: eid ? lireCycleEdition(ligne('book_editions', eid)).id : null, owner_id, archive_import: true };
  };
  const contexteEdition = id => ({ edition_id: id, expected_cycle_id: lireCycleEdition(ligne('book_editions', id)).id, owner_id, archive_import: true });
  for (const store of SYNC_STORES) for (const row of snapshot[store] || []) {
    const record = { store, id: row[STORES[store].keyPath] }, rids = new Set(), eids = new Set(), vus = new Set();
    lectures = { lignes: new Map(), livres: new Map() };
    dependances.set(cle(store, record.id), lectures);
    const explorer = (s, r) => {
      if (!r) return;
      const cle = s + ':' + r[STORES[s].keyPath]; if (vus.has(cle)) return; vus.add(cle);
      if (s === 'recipes') { rids.add(r.id); if (r.edition_id) eids.add(r.edition_id); return; }
      if (s === 'book_editions') { eids.add(r.id); return; }
      if (s === 'books') {
        const ids = [];
        for (const ed of index.book_editions?.values() || []) if (ed.book_id === r.id) { eids.add(ed.id); ids.push(ed.id); }
        // Des gardes de fiches seules ne détectent pas une nouvelle édition rattachée au livre.
        lectures.livres.set(r.id, { book_id: r.id, ids: ids.sort() });
        return;
      }
      if (r.edition_id) eids.add(r.edition_id);
      for (const id of [r.recipe_id, r.source_recipe_id, ...(r.recipe_ids || []), ...(r.items || []).map(x => x.recipe_id)].filter(Boolean)) rids.add(id);
      for (const id of [r.recipe_version_id, r.source_recipe_version_id, r.active_version_id, ...(r.selected_version_ids || []), ...(r.version_ids || []), ...(r.items || []).map(x => x.recipe_version_id)].filter(Boolean)) {
        const rid = ligne('recipe_versions', id)?.recipe_id; if (rid) rids.add(rid);
      }
      if (r.meal_id) explorer('meals', ligne('meals', r.meal_id));
      if (r.cook_session_id) explorer('cook_sessions', ligne('cook_sessions', r.cook_session_id));
      if (['source_documents', 'source_pages', 'scan_sessions', 'imports'].includes(s)) {
        if (r.scan_session_id) explorer('scan_sessions', ligne('scan_sessions', r.scan_session_id));
        for (const id of [r.document_id, ...(r.document_ids || [])].filter(Boolean)) explorer('source_documents', ligne('source_documents', id));
        for (const id of r.page_ids || []) explorer('source_pages', ligne('source_pages', id));
      }
    };
    explorer(store, row);
    for (const id of rids) {
      ajouter(recette, id, record, contexteRecette);
      const eid = ligne('recipes', id)?.edition_id; if (eid) eids.add(eid);
    }
    for (const id of eids) {
      // ajouter réutilise les contextes en cache ; chaque record conserve néanmoins cette lecture.
      ligne('book_editions', id);
      ajouter(edition, id, record, contexteEdition);
    }
  }
  const capture = { recettes: [...recette.values()], editions: [...edition.values()] };
  lecturesCaptures.set(capture, dependances);
  return capture;
}

export function dependancesInitialesPour(capture, store, id) {
  const lectures = lecturesCaptures.get(capture)?.get(cle(store, id));
  return { lignes: [...(lectures?.lignes.values() || [])], livres: [...(lectures?.livres.values() || [])] };
}

export function contexteInitialPour(capture, store, id) {
  const contient = c => c.records.some(r => r.store === store && r.id === id);
  const recettes = capture.recettes.filter(contient).map(c => ({ recipe_id: c.recipe_id, expected_cycle_id: c.expected_cycle_id,
    expected_edition_id: c.expected_edition_id }));
  const editions = capture.editions.filter(contient).map(c => ({ edition_id: c.edition_id, expected_cycle_id: c.expected_cycle_id }));
  return { ...(recettes.length === 1 ? recettes[0] : recettes.length ? { recipe_contexts: recettes } : {}),
    ...(editions.length ? { edition_contexts: editions } : {}), ...((recettes.length || editions.length) ? { archive_import: true } : {}) };
}
