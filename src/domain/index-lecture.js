// Une réponse payée par appel et par zone ; la fusion reste une vue des journaux exacts.
import { fusionnerMoities, relireResultatIndex, modelesValides } from './index-livre.js';
import { pagePourEnvoi, LIMITES_ENVOI } from './llm.js';
import { dimensionsImage, ErreurImage } from '../core/image.js';
import { sha256Hex } from '../core/hash.js';
import { empreinteSources, projectionIdentitePage, projectionAnnotationPage, pagesActivesSeance, validerCaptureSources, rotationSource } from './sources-format.js';

const copie = x => structuredClone(x);
const sortes = ['full', 'left_half', 'right_half'];
const reussi = row => ['a_verifier', 'enregistre'].includes(row?.status) && row?.resultat != null;
const coupe = row => row?.status === 'echec' && row?.erreur?.raison === 'coupe';
const identite = row => JSON.stringify([row?.scan_session_id, row?.edition_id ?? null, row?.owner_id ?? null, row?.expected_edition_id ?? null, row?.expected_edition_cycle_id ?? null,
  row?.source_capture?.session_id, row?.source_capture?.source_state_revision ?? null, row?.source_capture?.selected_page_ids,
  row?.source_capture?.pages?.map(p => [p.id, p.identity_sha256, p.annotation_sha256, p.preparation_version, p.zone?.source_width, p.zone?.source_height])]);

export class ErreurLectureIndex extends Error {
  constructor(raison) { super(raison); this.name = 'ErreurLectureIndex'; this.raison = raison; this.code = raison; }
}
const refus = raison => { throw new ErreurLectureIndex(raison); };

export async function preparerImageAppelIndex({ page, session, blob, kind = 'full' }) {
  if (!sortes.includes(kind) || !page?.id || !session?.id || !(blob instanceof Blob) || !pagesActivesSeance(session).includes(page.id)
    || (page.edition_id ?? null) !== (session.edition_id ?? null)) refus('source_changed');
  if (blob.size > LIMITES_ENVOI.octets) throw new ErreurImage('trop_grande');
  if (await sha256Hex(blob) !== page.sha256) refus('source_changed');
  const header = await dimensionsImage(blob);
  if (header && header.largeur * header.hauteur > LIMITES_ENVOI.pixels) throw new ErreurImage('trop_grande');
  let bitmap;
  try { bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { try { bitmap = await createImageBitmap(blob); } catch { throw new ErreurImage('indecodable'); } }
  let w, h;
  try {
    if (bitmap.width * bitmap.height > LIMITES_ENVOI.pixels) throw new ErreurImage('trop_grande');
    const tourne = [90, 270].includes(rotationSource(page));
    w = tourne ? bitmap.height : bitmap.width; h = tourne ? bitmap.width : bitmap.height;
  } finally { bitmap.close?.(); }
  const recadrage = kind === 'left_half' ? { debut: 0, fin: 0.55 } : kind === 'right_half' ? { debut: 0.45, fin: 1 } : null;
  const x = recadrage ? Math.max(0, Math.min(w - 1, Math.round(w * recadrage.debut))) : 0;
  const fin = recadrage ? Math.max(x + 1, Math.min(w, Math.round(w * recadrage.fin))) : w;
  const image = await pagePourEnvoi(blob, { rotation: rotationSource(page), recadrage });
  const octets = Uint8Array.from(atob(image.base64), c => c.charCodeAt(0));
  const capture = { format: 2, session_id: session.id, source_state_revision: session.source_state?.revision ?? null, selected_page_ids: [page.id],
    pages: [{ id: page.id, identity_sha256: await empreinteSources(projectionIdentitePage(page)), annotation_sha256: await empreinteSources(projectionAnnotationPage(page)),
      preparation_version: 'index-image-v1', zone: { kind, x, y: 0, width: fin - x, height: h, source_width: w, source_height: h }, sent_image_sha256: await sha256Hex(octets) }] };
  validerCaptureSources(capture);
  return { image, capture };
}

function appelValide(row) {
  const c = row?.index_call;
  if (!row || typeof row.id !== 'string' || !row.id || row.kind !== 'index' || !c || c.format !== 1 || !sortes.includes(c.kind)
    || typeof c.series_id !== 'string' || !c.series_id || typeof c.page_id !== 'string' || !c.page_id
    || Object.keys(c).some(k => !['format', 'series_id', 'page_id', 'kind', 'parent_call_id'].includes(k))
    || (c.kind === 'full' ? c.parent_call_id !== null : typeof c.parent_call_id !== 'string' || !c.parent_call_id)) refus('lecture_invalide');
  const capture = row.source_capture;
  validerCaptureSources(capture);
  if (!capture || capture.format !== 2 || capture.session_id !== row.scan_session_id || capture.selected_page_ids?.length !== 1
    || capture.selected_page_ids[0] !== c.page_id || capture.pages?.length !== 1 || capture.pages[0]?.id !== c.page_id
    || capture.pages[0]?.zone?.kind !== c.kind) refus('capture_invalide');
  return row;
}

function contenu(row) {
  if (!reussi(row)) return null;
  const p = relireResultatIndex(row.resultat, [row.index_call.page_id], { modeleLigne: row.model ?? null }).pages;
  if (p.length !== 1 || !['lue', 'partielle'].includes(p[0].etat)) refus('resultat_invalide');
  return p[0];
}

export function reconstruirePageIndex(vue, journaux) {
  if (!vue || vue.format !== 1 || typeof vue.page_id !== 'string' || !vue.page_id || !Array.isArray(journaux)
    || Object.keys(vue).some(k => !['format', 'page_id', 'full_call_id', 'left_call_id', 'right_call_id'].includes(k))) refus('lecture_invalide');
  const ids = [vue.full_call_id, vue.left_call_id, vue.right_call_id].filter(x => x != null);
  if (new Set(ids).size !== ids.length) refus('lecture_invalide');
  const trouver = (id, kind) => {
    if (id == null) return null;
    const rows = journaux.filter(r => r?.id === id);
    if (rows.length !== 1) refus('lecture_incomplete');
    const row = appelValide(rows[0]);
    if (row.index_call.kind !== kind || row.index_call.page_id !== vue.page_id) refus('lecture_invalide');
    return row;
  };
  const full = trouver(vue.full_call_id, 'full');
  if (!full) refus('lecture_incomplete');
  // Le plein format réussi n’adopte aucune autre lecture, même si des moitiés historiques sont fournies.
  const entier = contenu(full);
  if (entier) return { ...copie(entier), ligne_id: full.id, lecture_ids: [full.id], vue: copie(vue), modeleValide: modelesValides([entier]) };
  const left = trouver(vue.left_call_id, 'left_half'), right = trouver(vue.right_call_id, 'right_half');
  for (const row of [left, right].filter(Boolean)) {
    if (row.index_call.parent_call_id !== full.id || row.index_call.series_id !== full.index_call.series_id || identite(row) !== identite(full)) refus('capture_changee');
  }
  const g = left ? contenu(left) : null, d = right ? contenu(right) : null;
  const fusion = fusionnerMoities(g, d);
  return { ...fusion, page_id: vue.page_id, etat: g && d ? 'lue' : g || d ? 'partielle' : 'echec', moities: 2,
    modele: g?.modele ?? d?.modele ?? null, modeleValide: modelesValides([g, d].filter(Boolean)),
    ligne_id: (right && reussi(right) ? right : left && reussi(left) ? left : full).id,
    lecture_ids: [full, left, right].filter(Boolean).map(r => r.id), vue: copie(vue) };
}

function appelsDe({ page_id, series_id, appels }) {
  if (typeof page_id !== 'string' || !page_id || typeof series_id !== 'string' || !series_id || !Array.isArray(appels)) refus('lecture_invalide');
  const rows = appels.filter(r => r?.index_call?.page_id === page_id && r.index_call.series_id === series_id).map(appelValide);
  // L’appelant fournit la capture affichée. Aucun journal frais n’est recherché pendant l’exécution.
  const parSorte = new Map();
  for (const row of rows) {
    const previous = parSorte.get(row.index_call.kind);
    if (previous && previous.id !== row.id) refus('lecture_ambigue');
    parSorte.set(row.index_call.kind, copie(row));
  }
  const full = parSorte.get('full');
  for (const row of rows.filter(r => r.index_call.kind !== 'full')) {
    if (!full || row.index_call.parent_call_id !== full.id || identite(row) !== identite(full)) refus('capture_changee');
  }
  return parSorte;
}

export function maximumAppelsIndex(args) {
  const rows = appelsDe(args), full = rows.get('full');
  if (reussi(full)) return 0;
  if (!coupe(full)) return 3;
  return ['left_half', 'right_half'].filter(kind => !reussi(rows.get(kind))).length;
}

// effectuer prépare/lance UN appel ; conserver doit confirmer sa transaction avant le retour.
// Sur quota, la réponse exacte revient en mémoire et aucun appel suivant n’est lancé.
export async function executerAppelsIndex({ page_id, series_id, appels = [], effectuer, conserver, signal, estCourante = () => true }) {
  if (typeof effectuer !== 'function' || typeof conserver !== 'function') refus('lecture_invalide');
  const rows = appelsDe({ page_id, series_id, appels });
  let appelsEffectues = 0;
  const bilan = (issue, extra = {}) => ({ issue, appelsEffectues, appels: [...rows.values()].map(copie), ...extra });
  async function appeler(kind) {
    if (signal?.aborted || !estCourante()) return bilan('interrompu', { raison: 'annule' });
    let result;
    try {
      appelsEffectues++;
      result = await effectuer({ kind, page_id, series_id, parent_call_id: kind === 'full' ? null : rows.get('full')?.id ?? null, precedent: copie(rows.get(kind) ?? null), signal });
    } catch (e) { return bilan('interrompu', { raison: typeof e?.message === 'string' ? e.message : 'interne' }); }
    if (!result?.journal) return bilan('interrompu', { raison: result?.raison ?? 'lecture_invalide' });
    const row = appelValide(result.journal);
    if (row.index_call.kind !== kind || row.index_call.page_id !== page_id || row.index_call.series_id !== series_id
      || kind !== 'full' && (row.index_call.parent_call_id !== rows.get('full')?.id || identite(row) !== identite(rows.get('full')))) refus('capture_changee');
    try { await conserver(result); }
    catch (e) { return bilan('conservation_echec', { raison: e?.name === 'QuotaExceededError' ? 'quota' : 'ecriture', reponseNonConservee: copie(result) }); }
    rows.set(kind, copie(row));
    if (result.issue !== 'a_verifier' && !coupe(row)) return bilan('interrompu', { raison: result.raison ?? row.erreur?.raison ?? 'interne' });
    return null;
  }
  if (reussi(rows.get('full'))) return bilan('termine');
  if (!coupe(rows.get('full'))) { const stop = await appeler('full'); if (stop) return stop; }
  if (reussi(rows.get('full'))) return bilan('termine');
  for (const kind of ['left_half', 'right_half']) {
    if (reussi(rows.get(kind))) continue;
    const stop = await appeler(kind); if (stop) return stop;
  }
  return bilan(['left_half', 'right_half'].every(kind => reussi(rows.get(kind))) ? 'termine' : 'partiel');
}
