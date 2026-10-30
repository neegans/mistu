// Conservation exacte d’un résultat payé ; les fragments techniques ne sont jamais des appels.
import { canoniqueSources, empreinteSources, octetsJsonbSources, validerCaptureSources, presenceSource, ErreurSources } from './sources-format.js';
import { validerPageIndex, BORNES_PAGE_INDEX } from './index-livre.js';
import { sha256Hex } from '../core/hash.js';
import { newId as nouvelId } from '../core/ids.js';

export const LIMITES_STOCKAGE_INDEX = Object.freeze({ resultat: 4194304, fragments: 64, fragment: 262144, journal: 524288 });
const clone = x => structuredClone(x), enc = new TextEncoder(), taille = s => enc.encode(s).length;
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const id = x => typeof x === 'string' && x.length > 0 && [...x].length <= 200;
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const ferme = (x, keys) => obj(x) && Object.keys(x).every(k => keys.includes(k));
const requis = (x, keys) => keys.every(k => Object.hasOwn(x, k));
const fail = code => { throw new ErreurSources(code); };
const MEMOIRE = ['kind', 'recipe_id', 'edition_id', 'scan_session_id', 'page_ids', 'owner_id', 'expected_edition_id', 'expected_edition_cycle_id', 'expected_cycle_id', 'source_capture', 'index_call'];
// Le dépôt et les archives ajoutent ces deux champs après préparation. Réserver leur enveloppe avant de découper.
const enveloppeStockee=row=>octetsJsonbSources({created_at:'2026-10-29T23:59:59.999Z',updated_at:'2026-10-29T23:59:59.999Z',...row});
// Réserver la place des décisions compactes et des128 reçus. Une réponse qui tient seule
// ne doit pas devenir impossible à appliquer après le paiement. Les écritures mesurent aussi
// la ligne finale ; les identifiants de commandes produits ici sont des UUID ASCII.
function enveloppeAvecDecisions(row,resultat){
  if(!row.index_call||!row.source_capture)return enveloppeStockee(row);
  const h='f'.repeat(64),identifiant='i'.repeat(200),n=resultat.pages[0].entrees.length;
  const decision=i=>({occurrence_ordinal:i,unit_sha256:h,action:'garder_option',option_sha256:h,applied_ids_sha256:h});
  const recu={application_id:identifiant,operation_id:identifiant,predecessor_operation_id:identifiant,payload_sha256:h,result_sha256:h,base_decision_revision:identifiant,result_decision_revision:identifiant,scope_after_sha256:h,committed_at:'2026-10-29T23:59:59.999Z',counts:{creates:500,patches:500,decisions:600},applied_ids_sha256:h};
  return enveloppeStockee({...row,index_decisions:Array.from({length:n},(_,i)=>decision(i)),index_resolved_occurrences:Array.from({length:n},(_,i)=>i),index_decision_revision:identifiant,index_application_receipts:Array.from({length:128},()=>recu)});
}
const contexte = row => canoniqueSources(MEMOIRE.map(k => [k, presenceSource(row, k)]));
const pageId = journal => journal.index_call?.page_id ?? (journal.page_ids?.length === 1 ? journal.page_ids[0] : null);

// Le résultat conservé est déjà validé. Ce contrôle le refuse s’il faudrait le normaliser.
export function validerResultatStockeIndex(resultat, expectedPageId) {
  if (!ferme(resultat, ['format', 'pages']) || !requis(resultat, ['format', 'pages']) || resultat.format !== 2 || !Array.isArray(resultat.pages) || resultat.pages.length !== 1) fail('invalid_shape');
  const p = resultat.pages[0];
  if (!ferme(p, ['page_id', 'etat', 'moities', 'moitiesCoupees', 'modele', 'sorte_page', 'page_imprimee', 'suite_rubrique', 'entrees', 'incertain', 'ecartees', 'raison'])
    || p.page_id !== expectedPageId || !['lue', 'partielle', 'echec'].includes(p.etat) || !Array.isArray(p.entrees) || p.entrees.length > BORNES_PAGE_INDEX.entrees
    || !Array.isArray(p.incertain) || p.incertain.length > 20 || p.incertain.some(s => typeof s !== 'string' || [...s].length > 200)
    || p.modele != null && (typeof p.modele !== 'string' || [...p.modele].length > 80)
    || p.raison != null && (typeof p.raison !== 'string' || [...p.raison].length > 40)
    || p.moities != null && ![0, 2].includes(p.moities)
    || p.moitiesCoupees != null && (!Array.isArray(p.moitiesCoupees) || p.moitiesCoupees.length > 2 || p.moitiesCoupees.some(s => !['gauche', 'droite'].includes(s)))) fail('invalid_shape');
  for (const e of p.entrees) if (!ferme(e, ['titre', 'renvois', 'rubrique', 'sorte', 'incertain', 'suite'])
    || !requis(e, ['titre', 'renvois', 'rubrique', 'sorte', 'incertain']) || typeof e.incertain !== 'boolean' || e.suite != null && typeof e.suite !== 'boolean') fail('invalid_shape');
  const v = validerPageIndex({ sorte_page: p.sorte_page, page_imprimee: p.page_imprimee,
    entrees: p.entrees.map(e => [e.titre, e.renvois, e.suite ? '^' : e.rubrique, e.sorte, e.incertain]), incertain: p.incertain });
  if (canoniqueSources(v.entrees) !== canoniqueSources(p.entrees) || canoniqueSources(v.incertain) !== canoniqueSources(p.incertain)
    || (p.sorte_page ?? null) !== v.sorte_page || (p.page_imprimee ?? null) !== v.page_imprimee
    || p.suite_rubrique != null && p.suite_rubrique !== v.suite_rubrique) fail('invalid_shape');
  if (p.ecartees != null && (!ferme(p.ecartees, ['adresse', 'longueur', 'forme']) || !requis(p.ecartees, ['adresse', 'longueur', 'forme'])
    || Object.values(p.ecartees).some(n => !Number.isInteger(n) || n < 0 || n > 600))) fail('invalid_shape');
  const text = canoniqueSources(resultat);
  if (taille(text) > LIMITES_STOCKAGE_INDEX.resultat) fail('too_large');
  return resultat;
}

function validerFragment(row) {
  const s = row?.index_storage;
  if (row?.kind !== 'index' || row.status !== 'enregistre' || row.resultat !== null || !id(row.id)
    || !ferme(s, ['format', 'role', 'manifest_id', 'ordinal', 'sha256', 'utf8_bytes', 'text'])
    || !requis(s, ['format', 'role', 'manifest_id', 'ordinal', 'sha256', 'utf8_bytes', 'text']) || s.format !== 1 || s.role !== 'result_fragment'
    || !id(s.manifest_id) || s.manifest_id === row.id || !Number.isInteger(s.ordinal) || s.ordinal < 0 || s.ordinal >= 64
    || !hash(s.sha256) || typeof s.text !== 'string' || !s.text || !Number.isInteger(s.utf8_bytes) || s.utf8_bytes !== taille(s.text)
    || octetsJsonbSources(row) > LIMITES_STOCKAGE_INDEX.fragment) fail('invalid_shape');
  return s;
}

function validerManifeste(row) {
  const s = row?.index_storage;
  if (row?.kind !== 'index' || row.resultat !== null || !id(row.id)
    || !ferme(s, ['format', 'role', 'series_id', 'page_id', 'capture_sha256', 'logical_result_sha256', 'logical_bytes', 'fragments'])
    || !requis(s, ['format', 'role', 'series_id', 'page_id', 'capture_sha256', 'logical_result_sha256', 'logical_bytes', 'fragments'])
    || s.format !== 1 || s.role !== 'page_manifest' || !id(s.series_id) || s.page_id !== pageId(row)
    || s.series_id !== (row.index_call?.series_id ?? row.id) || !hash(s.capture_sha256) || !hash(s.logical_result_sha256)
    || !Number.isInteger(s.logical_bytes) || s.logical_bytes < 1 || s.logical_bytes > LIMITES_STOCKAGE_INDEX.resultat
    || !Array.isArray(s.fragments) || !s.fragments.length || s.fragments.length > LIMITES_STOCKAGE_INDEX.fragments
    || new Set(s.fragments.map(f => f?.id)).size !== s.fragments.length || octetsJsonbSources(row) > LIMITES_STOCKAGE_INDEX.journal) fail('invalid_shape');
  for (const [i, f] of s.fragments.entries()) if (!ferme(f, ['id', 'ordinal', 'sha256', 'utf8_bytes']) || !requis(f, ['id', 'ordinal', 'sha256', 'utf8_bytes'])
    || !id(f.id) || f.id === row.id || f.ordinal !== i || !hash(f.sha256) || !Number.isInteger(f.utf8_bytes) || f.utf8_bytes < 1) fail('invalid_shape');
  return s;
}

export async function reconstruireResultatIndex({ journal, imports = [] }) {
  if (!journal?.index_storage) return clone(journal?.resultat ?? null);
  const m = validerManifeste(journal);
  if (journal.source_capture != null) validerCaptureSources(journal.source_capture);
  if (await empreinteSources(journal.source_capture ?? null) !== m.capture_sha256) fail('source_changed');
  const vus = new Map();
  for (const r of imports) { if (vus.has(r?.id)) fail('invalid_shape'); vus.set(r?.id, r); }
  const parts = [];
  for (const f of m.fragments) {
    const row = vus.get(f.id); if (!row) fail('result_incomplete');
    const s = validerFragment(row);
    if (s.manifest_id !== journal.id || s.ordinal !== f.ordinal || s.sha256 !== f.sha256 || s.utf8_bytes !== f.utf8_bytes || contexte(row) !== contexte(journal)
      || await sha256Hex(s.text) !== s.sha256) fail('result_changed');
    parts.push(s.text);
  }
  const text = parts.join('');
  if (taille(text) !== m.logical_bytes || await sha256Hex(text) !== m.logical_result_sha256) fail('result_changed');
  let result; try { result = JSON.parse(text); } catch { fail('invalid_shape'); }
  if (canoniqueSources(result) !== text) fail('invalid_shape');
  validerResultatStockeIndex(result, m.page_id);
  return result;
}

export async function validerStockageIndex(imports, { autoriserIncomplets = false } = {}) {
  if (!Array.isArray(imports) || new Set(imports.map(r => r?.id)).size !== imports.length) fail('invalid_shape');
  const byId = new Map(imports.map(r => [r.id, r])), incomplete = new Set();
  for (const row of imports) {
    if (row.index_storage == null) continue;
    if (row.index_storage.role === 'result_fragment') {
      const s = validerFragment(row), parent = byId.get(s.manifest_id);
      if (await sha256Hex(s.text) !== s.sha256) fail('result_changed');
      if (!parent) { if (!autoriserIncomplets) fail('result_incomplete'); incomplete.add(s.manifest_id); continue; }
      const m = validerManifeste(parent);
      if (!m.fragments.some(f => f.id === row.id && f.ordinal === s.ordinal && f.sha256 === s.sha256 && f.utf8_bytes === s.utf8_bytes) || contexte(parent) !== contexte(row)) fail('invalid_shape');
    } else if (row.index_storage.role === 'page_manifest') {
      try { await reconstruireResultatIndex({ journal: row, imports }); }
      catch (e) { if (!autoriserIncomplets || e.code !== 'result_incomplete') throw e; incomplete.add(row.id); }
    } else fail('invalid_shape');
  }
  return { complet: incomplete.size === 0, incomplets: [...incomplete] };
}

export async function preparerStockageIndex({ journal, resultat }, { newId = nouvelId } = {}) {
  if (!id(journal?.id) || journal.kind !== 'index' || !id(pageId(journal))) fail('invalid_shape');
  validerResultatStockeIndex(resultat, pageId(journal));
  const normal = { ...clone(journal), resultat: clone(resultat) }; delete normal.index_storage;
  if (enveloppeAvecDecisions(normal,resultat) <= LIMITES_STOCKAGE_INDEX.journal) return { journal: normal, fragments: [] };
  const text = canoniqueSources(resultat), common = {};
  for (const k of MEMOIRE) if (Object.hasOwn(journal, k)) common[k] = clone(journal[k]);
  const points = [...text], fragments = []; let offset = 0;
  while (offset < points.length) {
    if (fragments.length >= LIMITES_STOCKAGE_INDEX.fragments) fail('too_large');
    const fragmentId = newId('if'), ordinal = fragments.length;
    const row = last => { const piece = points.slice(offset, last).join(''); return { ...clone(common), id: fragmentId, kind: 'index', status: 'enregistre', resultat: null,
      index_storage: { format: 1, role: 'result_fragment', manifest_id: journal.id, ordinal, sha256: '0'.repeat(64), utf8_bytes: taille(piece), text: piece } }; };
    let bas = offset + 1, haut = Math.min(points.length, offset + 131072), end = offset;
    while (bas <= haut) { const n = Math.floor((bas + haut) / 2); if (enveloppeStockee(row(n)) <= LIMITES_STOCKAGE_INDEX.fragment) { end = n; bas = n + 1; } else haut = n - 1; }
    if (end === offset) fail('too_large');
    const fragment = row(end); fragment.index_storage.sha256 = await sha256Hex(fragment.index_storage.text); fragments.push(fragment); offset = end;
  }
  const manifest = { ...clone(journal), resultat: null, index_storage: { format: 1, role: 'page_manifest', series_id: journal.index_call?.series_id ?? journal.id,
    page_id: pageId(journal), capture_sha256: await empreinteSources(journal.source_capture ?? null), logical_result_sha256: await sha256Hex(text), logical_bytes: taille(text),
    fragments: fragments.map(r => ({ id: r.id, ordinal: r.index_storage.ordinal, sha256: r.index_storage.sha256, utf8_bytes: r.index_storage.utf8_bytes })) } };
  if(enveloppeStockee(manifest)>LIMITES_STOCKAGE_INDEX.journal)fail('too_large');
  await validerStockageIndex([manifest, ...fragments]);
  return { journal: manifest, fragments };
}
