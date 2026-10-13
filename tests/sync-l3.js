// Suite L3 — envoi et réception (spec § 5.3, § 5.5). Transport factice : aucun réseau.
import { classerErreur, createTransport } from '../src/sync/transport.js';
import { createAuth } from '../src/sync/auth.js';
import { creerTransportFactice } from './transport-factice.js';

export async function runSyncL3Tests({ eq, ok }) {
  // --- Transport (spec § 5.3) : classification des erreurs, un seul chemin réseau
  eq(classerErreur({ status: 0, message: 'Failed to fetch' }).type, 'reseau', 'transport : échec réseau → reseau');
  eq(classerErreur({ status: 503, message: 'Service Unavailable' }).type, 'reseau', 'transport : 5xx → reseau (réessai)');
  eq(classerErreur({ status: 429, message: 'Too Many Requests' }).type, 'reseau', 'transport : 429 → reseau (recul)');
  eq(classerErreur({ status: 401, message: 'JWT expired' }).type, 'auth', 'transport : 401 → auth');
  eq(classerErreur({ status: 400, code: 'P0001', message: 'adresse non autorisée' }).type, 'auth', 'transport : refus d’adresse → auth (garde à refaire)');
  eq(classerErreur({ status: 413, message: 'Payload Too Large' }).type, 'quota', 'transport : 413 → quota');
  eq(classerErreur({ status: 507, message: 'Insufficient Storage' }).type, 'quota', 'transport : 507 → quota');
  eq(classerErreur({ status: 400, message: 'disk quota exceeded' }).type, 'quota', 'transport : message « exceeded » → quota');
  eq(classerErreur({ status: 400, code: 'P0001', message: 'rows : 500 éléments au plus' }).type, 'refus', 'transport : lot refusé entier → refus (dichotomie)');
  eq(classerErreur({ status: 404, message: 'not found' }).type, 'inconnu', 'transport : le reste → inconnu');
  ok(!('error' in classerErreur({ status: 401, message: 'secret' })), 'transport : l’erreur classée ne transporte pas l’objet brut');

  const fauxClient = {
    rpc: async (nom, args) => (nom === 'sync_push' ? { data: { server_time: '2026-10-13T20:00:00Z', accepted: [], adjusted: [], rejected: [] }, error: null, status: 200 } : { data: null, error: { message: 'x', code: 'PGRST202' }, status: 404 }),
    from: (table) => ({ select: () => ({ gt: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'b1', data: { id: 'b1' }, updated_at: '2026-10-13T19:00:00Z', deleted_at: null, server_seq: 7 }], error: null, status: 200 }) }) }) }) }),
  };
  const tr = createTransport(fauxClient);
  const p = await tr.pousser([]);
  eq([p.erreur, p.reponse.server_time], [null, '2026-10-13T20:00:00Z'], 'transport : pousser rend la réponse telle quelle');
  const l = await tr.lire('books', 0, 1000);
  eq([l.erreur, l.lignes.length, l.lignes[0].server_seq], [null, 1, 7], 'transport : lire rend les lignes');
  const sansClient = createTransport(null);
  eq((await sansClient.pousser([])).erreur.type, 'auth', 'transport : sans client → auth (rien n’est tenté)');

  const f = creerTransportFactice({ pousser: [{ reponse: { server_time: 't', accepted: [{ store: 'books', id: 'b1' }], adjusted: [], rejected: [] } }, { erreur: { type: 'reseau', status: 0, message: 'x' } }] });
  eq((await f.pousser([{ store: 'books', id: 'b1' }])).reponse.accepted.length, 1, 'factice : première réponse scriptée');
  eq((await f.pousser([])).erreur.type, 'reseau', 'factice : deuxième réponse scriptée');
  eq(f.journal.map((a) => a.appel), ['pousser', 'pousser'], 'factice : journal des appels');

  // auth.getClient : la seule sortie du client vers le transport (jamais vers l’interface).
  const auth = createAuth({ db: null, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: () => fauxClient, win: { location: { origin: 'http://localhost', pathname: '/', search: '', hash: '' }, history: { replaceState() {} } } });
  eq(auth.getClient(), fauxClient, 'auth : getClient rend le client créé');
  const sans = createAuth({ db: null, config: null, factory: () => fauxClient, win: { location: { origin: 'http://localhost', pathname: '/', search: '', hash: '' }, history: { replaceState() {} } } });
  eq(sans.getClient(), null, 'auth : sans configuration, getClient rend null');
}
