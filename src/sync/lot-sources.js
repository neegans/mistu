// Publication atomique d'un complément de sources réservé à une seule recette.
import { identifiantCycleValide } from '../domain/cycle-recette.js';

export const LIMITES_LOT_SOURCES = Object.freeze({ lignes: 500, octets: 524288 });
export const estLotSources = e => e?.op === 'source_batch';
const tableau = x => Array.isArray(x) ? x : [];
const memeListe = (a, b) => a.length === b.length && a.every(x => b.includes(x)) && new Set(a).size === a.length;
const fail = () => { throw new Error('Lot de sources incomplet, modifié ou trop volumineux'); };
// jsonb::text ajoute une espace après chaque séparateur et développe les exposants numériques.
// La même mesure sert à la borne avant écriture locale et dans 0009.
export function octetsLotSources(value) {
  const decimal = n => {
    const texte = JSON.stringify(n); if (!texte.includes('e')) return texte;
    const [mantisse, exposant] = texte.split('e'), negatif = mantisse.startsWith('-'), chiffres = mantisse.replace('-', '').replace('.', '');
    const point = mantisse.replace('-', '').split('.')[0].length + Number(exposant);
    return (negatif ? '-' : '') + (point <= 0 ? '0.' + '0'.repeat(-point) + chiffres : point >= chiffres.length ? chiffres + '0'.repeat(point - chiffres.length) : chiffres.slice(0, point) + '.' + chiffres.slice(point));
  };
  const rendre = x => x === null ? 'null' : typeof x === 'number' ? decimal(x) : Array.isArray(x) ? '[' + x.map(rendre).join(', ') + ']'
    : typeof x === 'object' ? '{' + Object.entries(x).map(([k, v]) => JSON.stringify(k) + ': ' + rendre(v)).join(', ') + '}' : JSON.stringify(x);
  return new TextEncoder().encode(rendre(JSON.parse(JSON.stringify(value)))).length;
}


export function preparerLotSources({ puts = {}, recettes = [], editions = [], source_batch = null } = {}) {
  if (!source_batch) return null;
  const { operation_id, session_id, base_session } = source_batch;
  if (!identifiantCycleValide(operation_id) || typeof session_id !== 'string' || !session_id || !Object.hasOwn(source_batch, 'base_session')) fail();
  const sessions = tableau(puts.scan_sessions), docs = tableau(puts.source_documents), pages = tableau(puts.source_pages);
  if (sessions.length !== 1 || sessions[0].id !== session_id || !docs.length) fail();
  const session = sessions[0], ids = tableau(session.recipe_ids);
  if (ids.length !== 1 || typeof ids[0] !== 'string') fail();
  const ec = editions.find(c => c.recipe_id === ids[0] && c.edition_id === session.edition_id);
  const rc = recettes.find(c => c.recipe_id === ids[0] && c.expected_edition_id === session.edition_id);
  if (!ec || !rc || rc.expected_edition_cycle_id !== ec.expected_cycle_id || (base_session != null && (base_session.id !== session_id || base_session.edition_id !== session.edition_id || !memeListe(tableau(base_session.recipe_ids), ids)))) fail();
  const anciensDocs = tableau(base_session?.document_ids), anciennesPages = tableau(base_session?.page_ids);
  if (JSON.stringify(tableau(session.document_ids)) !== JSON.stringify([...anciensDocs, ...docs.map(d => d.id)]) || JSON.stringify(tableau(session.page_ids)) !== JSON.stringify([...anciennesPages, ...pages.map(p => p.id)]) || new Set(session.document_ids).size !== session.document_ids.length || new Set(session.page_ids).size !== session.page_ids.length) fail();
  if (docs.some(d => typeof d.id !== 'string' || !d.id || d.edition_id !== ec.edition_id || d.scan_session_id !== session_id || anciensDocs.includes(d.id))) fail();
  if (pages.some(p => typeof p.id !== 'string' || !p.id || p.edition_id !== ec.edition_id || !docs.some(d => d.id === p.document_id) || anciennesPages.includes(p.id))) fail();
  const rows = [['scan_sessions', sessions], ['source_documents', docs], ['source_pages', pages]].flatMap(([store, values]) => values.map(data => ({ store, id: data.id, data: structuredClone(data), updated_at: data.updated_at || null })));
  const payload = { store: 'scan_sessions', id: session_id, op: 'source_batch', operation_id, recipe_id: rc.recipe_id, edition_id: ec.edition_id,
    base_cycle_id: rc.expected_cycle_id ?? null, base_edition_cycle_id: ec.expected_cycle_id ?? null, base_session: structuredClone(base_session ?? null), rows };
  if (rows.length > LIMITES_LOT_SOURCES.lignes || octetsLotSources(payload) > LIMITES_LOT_SOURCES.octets) fail();
  return payload;
}
