// I2 : journal et écriture de fiches. Les réponses réseau n'entrent ici qu'après validation.
import { validerIsbn } from '../core/isbn.js';
import { ligneImportNeuve } from './import-cible.js';
import { brouillonLivre, shaLivre, CHAMPS_LIVRE_I2 } from './livre-bibliographie.js';
import { TransitionRefusee } from '../core/db.js';

export function fabriquerImportLivre({ id, deviceId, brouillon } = {}) {
  return { ...ligneImportNeuve({ id, kind: 'livre', device_id: deviceId }), phase: 'relecture', brouillon: brouillonLivre(brouillon), source_photo_sha256: shaLivre(brouillon?.source_photo_sha256) };
}
export async function trouverEditionsLivre(isbn, repo) {
  const v = validerIsbn(isbn); if (!v.ok) return [];
  return (await repo.all('book_editions')).filter((e) => validerIsbn(e?.isbn).isbn13 === v.isbn13);
}
export async function garderBrouillonLivre(id, brouillon, { repo, phase } = {}) {
  const d = brouillonLivre(brouillon);
  await repo.saveBatch({}, { conditions: { imports: [{ key: id, fusion: (row) => {
    if (!row || row.kind !== 'livre' || ['enregistre', 'ignore'].includes(row.status)) throw new Error('brouillon_ferme');
    return { ...row, brouillon: d, source_photo_sha256: d.source_photo_sha256, photo_sha256: d.cover_sha256, ...(phase ? { phase } : {}) };
  } }] } });
}
const CHAMPS_LIVRE = ['title', 'subtitle', 'author', 'description', 'cuisines', 'tags', 'cuisine_facets'];
const CHAMPS_EDITION = ['isbn', 'publisher', 'year', 'language'];
export function brouillonDepuisEdition(book, edition) {
  const d = brouillonLivre({ fields: { ...book, ...edition, title: book?.title || '', subtitle: book?.subtitle || '', author: book?.author || '',
    description: book?.description || '', cuisines: book?.cuisines || [], tags: book?.tags || [], cuisine_facets: book?.cuisine_facets || {}, year: edition?.year ? String(edition.year) : '', convention: edition?.unit_convention_id || '' },
    edition_id: edition.id, book_id: book.id, cover_sha256: edition.cover_sha256, source_photo_sha256: edition.source_photo_sha256,
    provenance: { ...book.metadata_provenance, ...edition.metadata_provenance } });
  // Les valeurs historiques, provenance inconnue comprise, appartiennent à la personne.
  for (const k of CHAMPS_LIVRE_I2) d.touched[k] = true;
  return d;
}
export class ConflitLivre extends Error {
  constructor(fields, valeurs = {}) { super('conflit_livre'); this.name = 'ConflitLivre'; this.fields = fields; this.valeurs = valeurs; }
}
export async function enregistrerLivreI2({ importId, brouillon, base = null, resolutions = [] }, { repo, maintenant = () => new Date().toISOString() } = {}) {
  const d = brouillonLivre(brouillon), f = d.fields;
  if (!f.title.trim()) throw new Error('titre_requis');
  if (f.year && (!/^\d{4}$/.test(f.year) || Number(f.year) < 1000 || Number(f.year) > new Date(maintenant()).getUTCFullYear() + 2)) throw new Error('annee_invalide');
  const v = validerIsbn(f.isbn); if (f.isbn && !v.ok) throw new Error('isbn_invalide');
  const importLu = await repo.get('imports', importId);
  if (importLu?.status === 'enregistre' && importLu.edition_id) {
    const ed = await repo.get('book_editions', importLu.edition_id); if (ed) return { ...ed, dejaAjoute: true };
  }
  const edId = d.edition_id || repo.newId('ed'); const bookId = d.book_id || repo.newId('bk');
  const vieuxBook = d.book_id ? await repo.get('books', d.book_id) : null;
  if (d.book_id && !vieuxBook) throw new Error('livre_absent');
  if (!d.edition_id && v.ok) { const existantes = await trouverEditionsLivre(v.isbn13, repo); if (existantes.length) return { ...existantes[0], dejaAjoute: true }; }
  const editionValues = { isbn: v.ok ? v.isbn13 : null, publisher: f.publisher || null, year: f.year ? Number(f.year) : null, language: f.language || null,
    unit_convention_id: f.convention || null, convention_evidence: f.convention ? 'confirmed_by_user' : null, cover_sha256: d.cover_sha256,
    source_photo_sha256: d.source_photo_sha256, source_photo_rotation: d.rotation };
  const livreValues = Object.fromEntries(CHAMPS_LIVRE.map((k) => [k, f[k]]));
  const bProv = Object.fromEntries(CHAMPS_LIVRE.filter((k) => d.provenance[k]).map((k) => [k, d.provenance[k]]));
  const eProv = Object.fromEntries(CHAMPS_EDITION.filter((k) => d.provenance[k]).map((k) => [k, d.provenance[k]]));
  const conditions = {};
  const puts = {};
  if (d.edition_id) {
    const ed = await repo.get('book_editions', d.edition_id); if (!ed || ed.book_id !== bookId) throw new Error('edition_absente');
    const initial = base ? brouillonLivre(base) : brouillonDepuisEdition(vieuxBook, ed);
    const changed = CHAMPS_LIVRE_I2.filter((k) => JSON.stringify(f[k]) !== JSON.stringify(initial.fields[k]));
    const verify = (current, keys) => {
      if (!current) throw new Error('fiche_absente');
      const valeurs = brouillonLivre({ fields: { ...current, year: Number.isInteger(current.year) ? String(current.year) : current.year } }).fields;
      const conflicts = keys.filter((k) => changed.includes(k) && !resolutions.includes(k) && JSON.stringify(valeurs[k]) !== JSON.stringify(initial.fields[k]) && JSON.stringify(valeurs[k]) !== JSON.stringify(f[k]));
      if (conflicts.length) throw new ConflitLivre(conflicts, Object.fromEntries(conflicts.map((k) => [k, current[k]])));
    };
    conditions.books = [{ key: bookId, fusion: (current) => { verify(current, CHAMPS_LIVRE); return { ...current, ...Object.fromEntries(CHAMPS_LIVRE.filter((k) => changed.includes(k)).map((k) => [k, f[k]])), metadata_provenance: { ...current.metadata_provenance, ...Object.fromEntries(Object.entries(bProv).filter(([k]) => changed.includes(k))) } }; } }];
    conditions.book_editions = [{ key: edId, fusion: (current) => {
      verify(current, CHAMPS_EDITION);
      if (changed.includes('convention') && !resolutions.includes('convention') && (current.unit_convention_id || '') !== initial.fields.convention && (current.unit_convention_id || '') !== f.convention)
        throw new ConflitLivre(['convention'], { convention: current.unit_convention_id || '' });
      const photoChange = ['cover_sha256', 'source_photo_sha256'].some((k) => d[k] !== initial[k]);
      if (photoChange && !resolutions.includes('cover_sha256') && ((current.cover_sha256 ?? null) !== initial.cover_sha256 || (current.source_photo_sha256 ?? null) !== initial.source_photo_sha256)) throw new ConflitLivre(['cover_sha256']);
      return { ...current, ...Object.fromEntries(CHAMPS_EDITION.filter((k) => changed.includes(k)).map((k) => [k, editionValues[k]])),
        ...(changed.includes('convention') ? { unit_convention_id: editionValues.unit_convention_id, convention_evidence: editionValues.convention_evidence } : {}),
        ...(photoChange ? { cover_sha256: d.cover_sha256, source_photo_sha256: d.source_photo_sha256, source_photo_rotation: d.rotation } : {}),
        metadata_provenance: { ...current.metadata_provenance, ...Object.fromEntries(Object.entries(eProv).filter(([k]) => changed.includes(k))) } };
    } }];
    if (v.ok && validerIsbn(initial.fields.isbn).isbn13 !== v.isbn13) {
      const autres = (await trouverEditionsLivre(v.isbn13, repo)).filter((e) => e.id !== edId);
      if (autres.length) return { ...autres[0], dejaAjoute: true };
      conditions.book_editions.push(...[...new Set([v.isbn13, v.isbn10].filter(Boolean))].map((isbn) => ({ index: 'isbn', valeur: isbn, absente: true })));
    }
  } else {
    // Le rattachement à un livre existant ne modifie jamais ses métadonnées partagées.
    if (!vieuxBook) puts.books = [{ id: bookId, ...livreValues, metadata_provenance: bProv }];
    puts.book_editions = [{ id: edId, book_id: bookId, owned: true, ...editionValues, metadata_provenance: eProv }];
    if (v.ok) conditions.book_editions = [...new Set([v.isbn13, v.isbn10].filter(Boolean))].map((isbn) => ({ index: 'isbn', valeur: isbn, absente: true }));
  }
  try {
    await repo.transitionner('imports', importId, { attendus: ['a_lancer', 'a_verifier', 'echec'], patch: { status: 'enregistre', phase: 'relecture', edition_id: edId, brouillon: d, reponse_brute: null, finished_at: maintenant() }, puts, conditions });
    return await repo.get('book_editions', edId);
  } catch (e) {
    if (e instanceof TransitionRefusee) {
      const current = await repo.get('imports', importId);
      if (current?.status === 'enregistre' && current.edition_id) { const ed = await repo.get('book_editions', current.edition_id); if (ed) return { ...ed, dejaAjoute: true }; }
      if (!d.edition_id && v.ok) { const es = await trouverEditionsLivre(v.isbn13, repo); if (es.length) return { ...es[0], dejaAjoute: true }; }
    }
    throw e;
  }
}
