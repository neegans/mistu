// Storage factice du lot G (spec § 7) : aucun réseau. Mémoire `objets[chemin] = Blob` ; il rend des erreurs DÉJÀ classées, de la forme de
// createStockage (src/sync/transport.js) — { type, status, statusCode, code, message } —, sous les deux formes vues chez le fournisseur pour
// un « déjà présent » (409, ou 400 + statusCode '409' SANS code : la forme que StorageApiError prend d'un corps sans `code`, vendor 2.117.3)
// et un introuvable (404, ou 400 + statusCode '404'). Tout appel est journalisé.
import { ALLOWED_MIME } from '../src/sync/mime.js';

const erreur = (type, status, statusCode, code, message = '') => ({ type, status, statusCode, code, message });

export function creerStockageFactice({ objets = {}, limiteOctets = 52428800, types = ALLOWED_MIME, pannes = [], forme409 = 'status', forme404 = 'status', avant = null } = {}) {
  const memoire = new Map(Object.entries(objets));
  const restantes = [...pannes];
  const journal = [];
  // Une panne scriptée est consommée UNE fois : la première dont la méthode (et le chemin, s'il est donné) correspond.
  const panne = (methode, chemin) => {
    const i = restantes.findIndex((p) => p.methode === methode && (p.chemin == null || p.chemin === chemin));
    return i < 0 ? null : restantes.splice(i, 1)[0].erreur;
  };
  return {
    journal,
    octets: (chemin) => memoire.get(chemin) ?? null,
    async envoyer(chemin, blob, { upsert = false } = {}) {
      journal.push({ methode: 'envoyer', chemin, type: blob.type, taille: blob.size, upsert });
      if (avant) await avant('envoyer', chemin);
      const p = panne('envoyer', chemin);
      if (p) return { erreur: p };
      if (!types.includes(blob.type)) return { erreur: erreur('refus', 415, '415', 'InvalidMimeType') }; // S-2 : le type du BLOB, jamais une option
      if (blob.size > limiteOctets) return { erreur: erreur('quota', 413, '413', 'EntityTooLarge') };
      if (memoire.has(chemin) && !upsert) {
        return { erreur: forme409 === 'statusCode' ? erreur('refus', 400, '409', null, 'The resource already exists') : erreur('refus', 409, '409', 'Duplicate', 'The resource already exists') };
      }
      memoire.set(chemin, blob);
      return { erreur: null };
    },
    async recevoir(chemin) {
      journal.push({ methode: 'recevoir', chemin });
      if (avant) await avant('recevoir', chemin);
      const p = panne('recevoir', chemin);
      if (p) return { blob: null, erreur: p };
      if (!memoire.has(chemin)) {
        return { blob: null, erreur: forme404 === 'statusCode' ? erreur('refus', 400, '404', 'not_found', 'Object not found') : erreur('inconnu', 404, '404', 'KeyNotFound', 'Object not found') };
      }
      const b = memoire.get(chemin);
      return { blob: new Blob([b], { type: b.type }), erreur: null };
    },
    async lister(prefixe, options = {}) {
      const { limit = 100, offset = 0, search = '' } = options;
      journal.push({ methode: 'lister', prefixe, options: { limit, offset, search } });
      if (avant) await avant('lister', prefixe);
      const p = panne('lister', prefixe);
      if (p) return { objets: [], erreur: p };
      const tete = prefixe + '/';
      const dossier = [...memoire.entries()].filter(([c]) => c.startsWith(tete))
        .map(([c, b]) => ({ name: c.slice(tete.length), metadata: { size: b.size, mimetype: b.type } }))
        .filter((o) => o.name.startsWith(search))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      return { objets: dossier.slice(offset, offset + limit), erreur: null };
    },
  };
}
