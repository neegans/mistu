// I2 : propositions de photo imprimée. Une zone défectueuse n'invalide jamais une recette.
import { rectangleValide, reduireImage, dimensionsImage, ErreurImage, MIME_PHOTO_LOCALE } from '../core/image.js';
import { sha256Hex } from '../core/hash.js';
import { TransitionRefusee } from '../core/db.js';

const HASH = /^[a-f0-9]{64}$/;
const rotationDe = (x) => [90, 180, 270].includes(x) ? x : 0;
const idValide = (x) => typeof x === 'string' && x.length > 0 && x.length <= 200;
const rectDe = (r) => ({ x: r.x, y: r.y, largeur: r.largeur, hauteur: r.hauteur });

export function validerZonesPhoto(zones, nbImages) {
  if (!Array.isArray(zones) || !Number.isInteger(nbImages) || nbImages < 1) return [];
  const propres = [], vues = new Set();
  for (const z of zones.slice(0, 30)) {
    if (!z || typeof z !== 'object' || !Object.hasOwn(z, 'photo') || !Number.isInteger(z.photo) || z.photo < 1 || z.photo > nbImages ||
      !Object.hasOwn(z, 'rectangle') || !rectangleValide(z.rectangle) || !Object.hasOwn(z, 'incertain') || z.incertain !== false) continue;
    const p = { photo: z.photo, rectangle: rectDe(z.rectangle), incertain: false }; const cle = JSON.stringify(p);
    if (!vues.has(cle)) { vues.add(cle); propres.push(p); }
    if (propres.length === 3) break;
  }
  return propres;
}

function sourceDe(s) {
  if (!s || typeof s !== 'object' || !['page_id', 'sha256', 'rotation', 'largeur', 'hauteur'].every((k) => Object.hasOwn(s, k)) || !idValide(s.page_id) || typeof s.sha256 !== 'string' || !HASH.test(s.sha256) ||
      ![0, 90, 180, 270].includes(s.rotation) || !Number.isInteger(s.largeur) || !Number.isInteger(s.hauteur) ||
      s.largeur < 1 || s.hauteur < 1 || s.largeur * s.hauteur > 50_000_000) return null;
  return { page_id: s.page_id, sha256: s.sha256, rotation: s.rotation, largeur: s.largeur, hauteur: s.hauteur };
}

export const provenancePhotoPageValide = (p) => !!sourceDe(p) && rectangleValide(p.rectangle);

export function lierZonesPhoto(zones, sources) {
  return validerZonesPhoto(zones, sources?.length).flatMap((z) => { const s = sourceDe(sources[z.photo - 1]); return s ? [{ ...s, rectangle: z.rectangle }] : []; });
}

export function sourcePhotoIntacte(source, page) {
  return !!sourceDe(source) && page?.id === source.page_id && page.sha256 === source.sha256 && rotationDe(page.rotation) === source.rotation;
}

export function relirePhotosPage(resultat, pageIds = []) {
  const ids = new Set(Array.isArray(pageIds) ? pageIds.filter(idValide) : []);
  const sources = (Array.isArray(resultat?.photo_sources) ? resultat.photo_sources : []).slice(0, 100).map(sourceDe).filter((s) => s && ids.has(s.page_id));
  const propositions = [];
  for (const p of (Array.isArray(resultat?.photo_propositions) ? resultat.photo_propositions : []).slice(0, 3)) {
    const source = sourceDe(p);
    if (source && rectangleValide(p.rectangle) && sources.some((s) => JSON.stringify(s) === JSON.stringify(source))) propositions.push({ ...source, rectangle: rectDe(p.rectangle) });
  }
  return { sources, propositions, choix: ['utilisee', 'ignoree'].includes(resultat?.photo_choice) ? resultat.photo_choice : null };
}

export const clePhotoLecture = (i) => JSON.stringify([i?.id ?? null, i?.started_at ?? null, i?.resultat ?? null]);

export async function preparerRecadragePage(blob, { rotation = 0, rectangle = null } = {}) {
  if (!(blob instanceof Blob)) throw new ErreurImage('indecodable');
  if (blob.size > 50 * 1024 * 1024) throw new ErreurImage('trop_lourde');
  if (blob.type && !MIME_PHOTO_LOCALE.includes(blob.type)) throw new ErreurImage('type');
  const dims = await dimensionsImage(blob);
  if (dims && dims.largeur * dims.hauteur > 50_000_000) throw new ErreurImage('trop_grande');
  return reduireImage(blob, { maxCote: 1200, rotation: rotationDe(rotation), rectangle });
}

// Résolution d'une image envoyée vers sa page : dimensions de l'image réencodée, donc EXIF et rotation déjà appliqués.
export async function sourceDepuisEnvoi(page, image) {
  if (!page || !HASH.test(page.sha256 || '') || typeof image?.base64 !== 'string') return null;
  const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
  const dims = await dimensionsImage(new Blob([bytes], { type: image.mime }));
  return dims ? sourceDe({ page_id: page.id, sha256: page.sha256, rotation: rotationDe(page.rotation), largeur: dims.largeur, hauteur: dims.hauteur }) : null;
}

export async function enregistrerPhotoPage({ repo, recipe, source, blob, importId = null, lectureKey = null }) {
  if (!recipe?.id || !sourceDe(source) || !rectangleValide(source.rectangle) || !(blob instanceof Blob) || blob.type !== 'image/jpeg') throw new Error('recadrage');
  const page = await repo.get('source_pages', source.page_id);
  if (!sourcePhotoIntacte(source, page)) throw new Error('page_modifiee');
  const sha256 = await sha256Hex(blob);
  await repo.putFile(sha256, blob, { original_filename: 'photo-du-livre.jpg' });
  const photoAvant = recipe.photo_sha256 ?? null;
  const conditions = {
    source_pages: [{ key: source.page_id, fusion: (p) => { if (!sourcePhotoIntacte(source, p)) throw new Error('page_modifiee'); return null; } }],
    recipes: [{ key: recipe.id, fusion: (r) => {
      if (!r || (r.photo_sha256 ?? null) !== photoAvant) throw new TransitionRefusee('recipes', recipe.id, r?.status);
      if (!Array.isArray(r.source_page_ids) || !r.source_page_ids.includes(source.page_id)) throw new Error('page_etrangere');
      return { ...r, photo_sha256: sha256, photo_origin: 'image', photo_source_url: null, photo_provenance: { ...sourceDe(source), rectangle: rectDe(source.rectangle) } };
    } }],
  };
  if (importId) conditions.imports = [{ key: importId, fusion: (i) => {
    if (!i || i.recipe_id !== recipe.id || i.kind !== 'recette' || !['enregistre', 'a_verifier'].includes(i.status) ||
      (lectureKey !== null && clePhotoLecture(i) !== lectureKey) ||
      !relirePhotosPage(i.resultat, i.page_ids).sources.some((s) => JSON.stringify(s) === JSON.stringify(sourceDe(source)))) throw new Error('lecture_modifiee');
    return { ...i, resultat: { ...i.resultat, photo_choice: 'utilisee' } };
  } }];
  await repo.saveBatch({}, { conditions });
  return sha256;
}
