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

  // --- Lots (spec § 5.3) : ordre, dédoublonnage, relecture, bornes 500 / 1 Mo / 512 Ko, fichiers retenus
  const { nettoyerChaines, tailleJson, dedoublonner, composerLots, LIMITES } = await import('../src/sync/lots.js');
  eq(nettoyerChaines({ a: 'x\u0000y', b: ['\u0007z', 1], c: { d: 't\u001f' } }), { a: 'xy', b: ['z', 1], c: { d: 't' } }, 'lots : les caractères de contrôle sont retirés partout');
  eq(nettoyerChaines('é\n'), 'é\n', 'lots : les sauts de ligne et les accents restent');
  eq(tailleJson({ a: 'é' }), 10, 'lots : taille en octets UTF-8 du JSON');
  eq(LIMITES, { elements: 500, lot: 1048576, element: 524288 }, 'lots : bornes de la spec (§ 3.4, R14)');

  const entrees = [
    { seq: 1, store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:00:00Z', tries: 0 },
    { seq: 2, store: 'books', id: 'b2', op: 'delete', updated_at: '2026-10-13T10:01:00Z', payload: { id: 'b2', title: 'X', updated_at: '2026-10-13T10:01:00Z' }, tries: 0 },
    { seq: 3, store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:02:00Z', tries: 0 },
    { seq: 4, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:03:00Z', tries: 0 },
    { seq: 5, store: 'books', id: 'b3', op: 'put', updated_at: '2026-10-13T10:04:00Z', tries: 0 },
  ];
  const d = dedoublonner(entrees);
  eq(d.map((x) => [x.cle, x.entree.seq, x.seqs]), [['books:b1', 3, [1, 3]], ['books:b2', 2, [2]], ['files:' + 'f'.repeat(64), 4, [4]], ['books:b3', 5, [5]]], 'lots : une clé par (store, id), la plus récente gardée, tous les seq retenus');

  const fiches = { 'books:b1': { id: 'b1', title: 'Un\u0000', updated_at: '2026-10-13T10:02:00Z' } };
  const relire = async (store, id) => fiches[store + ':' + id];
  const c = await composerLots(entrees, relire);
  eq(c.lots.length, 1, 'lots : un seul lot pour quatre éléments');
  eq(c.lots[0].elements.map((e) => [e.store, e.id, e.deleted]), [['books', 'b1', false], ['books', 'b2', true], ['books', 'b3', true]], 'lots : put relu, delete avec payload, put disparu → delete');
  eq(c.lots[0].elements[0].data.title, 'Un', 'lots : la fiche relue est nettoyée');
  eq(c.lots[0].elements[1].data.title, 'X', 'lots : le payload d’une suppression part avec elle');
  eq(c.lots[0].elements[2].data, null, 'lots : un put dont la fiche a disparu sans payload part comme tombale sans data');
  eq(c.lots[0].seqs, [1, 3, 2, 5], 'lots : les seq de chaque clé suivent le lot');
  eq(c.retenues, [{ seq: 4, raison: 'fichier en attente' }], 'lots : une ligne files est retenue tant que l’empreinte distante n’est pas confirmée (L4)');

  const gros = Array.from({ length: 1200 }, (_, i) => ({ seq: i + 1, store: 'books', id: 'g' + i, op: 'put', updated_at: '2026-10-13T10:00:00Z', tries: 0 }));
  const cg = await composerLots(gros, async (s, id) => ({ id, updated_at: '2026-10-13T10:00:00Z' }));
  eq(cg.lots.map((l) => l.elements.length), [500, 500, 200], 'lots : 500 éléments au plus par lot, dans l’ordre');
  const lourd = [{ seq: 1, store: 'books', id: 'l1', op: 'put', updated_at: 't', tries: 0 }, { seq: 2, store: 'books', id: 'l2', op: 'put', updated_at: 't', tries: 0 }];
  const cl = await composerLots(lourd, async (s, id) => ({ id, updated_at: '2026-10-13T10:00:00Z', texte: 'x'.repeat(600000) }));
  eq(cl.lots.map((l) => l.elements.length), [1, 1], 'lots : une fiche de plus de 512 Ko part seule (le serveur la refuse pour sa taille, nommée)');
  const moyens = Array.from({ length: 3 }, (_, i) => ({ seq: i + 1, store: 'books', id: 'm' + i, op: 'put', updated_at: 't', tries: 0 }));
  const cm = await composerLots(moyens, async (s, id) => ({ id, updated_at: '2026-10-13T10:00:00Z', texte: 'x'.repeat(450000) }));
  eq(cm.lots.map((l) => l.elements.length), [2, 1], 'lots : la borne de 1 Mo par lot coupe avant 500 éléments');
  eq(cl.lots[0].elements[0].updated_at, '2026-10-13T10:00:00Z', 'lots : updated_at de l’élément = celui de la fiche relue');
}
