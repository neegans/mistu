// Suite L3 — envoi et réception (spec § 5.3, § 5.5). Transport factice : aucun réseau.
import { classerErreur, createTransport } from '../src/sync/transport.js';
import { createAuth } from '../src/sync/auth.js';
import { creerTransportFactice } from './transport-factice.js';
import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';

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
  // R-L3-25 : un Blob traverse sans être touché — ses octets ne sont pas du texte, et il n'est jamais parcouru.
  // Une Date non plus : parcourue comme un objet nu, elle ressortait en `{}` — une perte muette de donnée.
  {
    const octets = new Blob(['\u0000x'], { type: 'image/jpeg' });
    const quand = new Date('2026-10-13T11:00:00.000Z');
    const nettoye = nettoyerChaines({ blob: octets, quand, mime: 'image/jpeg\u0000' });
    eq([nettoye.blob === octets, nettoye.mime], [true, 'image/jpeg'], 'R-L3-25 : un Blob traverse nettoyerChaines intact (ses octets ne sont pas du texte)');
    ok(nettoye.quand instanceof Date && nettoye.quand.getTime() === quand.getTime(), 'nettoyerChaines : une Date traverse intacte (parcourue comme un objet nu, elle ressortait en {})');
  }
  eq(tailleJson({ a: 'é' }), 10, 'lots : taille en octets UTF-8 du JSON');
  eq(LIMITES, { elements: 500, lot: 921600, element: 524288 }, 'lots : bornes de la spec (§ 3.4, R14), le lot avec marge sous le seuil serveur (R-L3-6)');

  // R-L3-21 : l'entrée d'une suppression porte l'instant DU GESTE, le payload garde l'heure de la dernière écriture
  // de la fiche. Les deux sont donc volontairement différentes ici — c'est ce qui permet de voir laquelle part.
  const entrees = [
    { seq: 1, store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:00:00Z', tries: 0 },
    { seq: 2, store: 'books', id: 'b2', op: 'delete', updated_at: '2026-10-13T10:01:00Z', payload: { id: 'b2', title: 'X', updated_at: '2026-10-13T09:00:00Z' }, tries: 0 },
    { seq: 3, store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:02:00Z', tries: 0 },
    { seq: 4, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:03:00Z', tries: 0 },
    { seq: 5, store: 'books', id: 'b3', op: 'put', updated_at: '2026-10-13T10:04:00Z', tries: 0 },
  ];
  const d = dedoublonner(entrees);
  eq(d.map((x) => [x.cle, x.entree.seq, x.seqs]), [['books:b1', 3, [1, 3]], ['books:b2', 2, [2]], ['files:' + 'f'.repeat(64), 4, [4]], ['books:b3', 5, [5]]], 'lots : une clé par (store, id), la plus récente gardée, tous les seq retenus');

  const fiches = { 'books:b1': { id: 'b1', title: 'Un\u0000', updated_at: '2026-10-13T10:02:00Z' } };
  const relire = async (store, id) => fiches[store + ':' + id];
  const c = await composerLots(entrees, relire);
  eq(c.lots.length, 1, 'lots : un seul lot');
  eq(c.lots[0].elements.map((e) => [e.store, e.id, e.deleted]), [['books', 'b1', false], ['books', 'b2', true]], 'lots : put relu, delete avec payload — et R-L3-28 : le put dont la fiche a disparu n’est PAS envoyé');
  eq(c.lots[0].elements[0].data.title, 'Un', 'lots : la fiche relue est nettoyée');
  eq(c.lots[0].elements[1].data.title, 'X', 'lots : le payload d’une suppression part avec elle');
  // R-L3-21 (ancien test retourné) : l'heure de l'ENTRÉE gagne, jamais celle du payload. Avec l'heure du payload, la
  // tombale partait avec l'instant que le serveur possède DÉJÀ — `u = cur_updated`, `cur_deleted is null` : aucune
  // branche de `sync_push` ne s'applique, la réponse est `rejected{conflit}` et la suppression ne quitte jamais
  // l'appareil. Une suppression est un ÉVÉNEMENT : elle porte l'instant de son geste.
  eq(c.lots[0].elements[1].updated_at, '2026-10-13T10:01:00Z', 'R-L3-21 : updated_at d’une suppression = celui de l’ENTRÉE (le geste), jamais celui du payload');
  eq(c.lots[0].elements[1].data.updated_at, '2026-10-13T09:00:00Z', 'R-L3-21 : … et le payload envoyé garde sa propre heure (la fiche au moment de la suppression)');
  // R-L3-28 : un `put` dont la fiche n'existe plus ICI est ABANDONNÉ, pas transformé en tombale. Elle a disparu
  // soit par une réception (origine 'remote', jamais capturée — le serveur connaît déjà cette suppression), soit
  // par un vidage d'appareil. L'envoyer en tombale avec l'heure de la dernière écriture ÉCRIVAIT une ligne
  // supprimée au serveur pour une fiche qu'il ne connaissait peut-être même pas. Une suppression LOCALE explicite,
  // elle, a sa propre entrée `delete` : elle gagne au dédoublonnage et part avec l'heure de son geste (R57).
  eq(c.abandonnees, [{ seq: 5, seqs: [5], raison: 'fiche disparue' }], 'R-L3-28 : un put dont la fiche a disparu est abandonné, avec tous les seq de sa clé');
  eq(c.lots[0].seqs, [1, 3, 2], 'lots : les seq de chaque clé suivent le lot (celle de la fiche disparue n’y est plus)');
  eq(c.retenues, [{ seq: 4, seqs: [4], raison: 'fichier en attente' }], 'lots : une ligne files est retenue tant que l’empreinte distante n’est pas confirmée (L4), tous les seq du groupe (R-L3-5)');

  const fichiersRepetes = [
    { seq: 4, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:03:00Z', tries: 0 },
    { seq: 6, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:05:00Z', tries: 0 },
  ];
  const cf = await composerLots(fichiersRepetes, async () => undefined);
  eq([cf.lots, cf.abandonnees], [[], []], 'lots : deux put du même fichier ne produisent aucun lot — et la retenue passe AVANT la relecture (une ligne files n’est pas « disparue »)');
  eq(cf.retenues, [{ seq: 6, seqs: [4, 6], raison: 'fichier en attente' }], 'lots : deux put du même fichier dédoublonnés → une seule retenue, tous les seq (R-L3-5)');

  const recreation = [
    { seq: 10, store: 'books', id: 'bx', op: 'delete', updated_at: '2026-10-13T11:00:00Z', payload: { id: 'bx', title: 'Ancien', updated_at: '2026-10-13T11:00:00Z' }, tries: 0 },
    { seq: 11, store: 'books', id: 'bx', op: 'put', updated_at: '2026-10-13T11:05:00Z', tries: 0 },
  ];
  const dr = dedoublonner(recreation);
  eq(dr.map((x) => [x.cle, x.entree.seq, x.entree.op, x.seqs]), [['books:bx', 11, 'put', [10, 11]]], 'lots : suppression puis recréation de la même clé → le put (plus récent) gagne, les deux seq suivent');
  const cr = await composerLots(recreation, async (s, id) => ({ id, title: 'Nouveau', updated_at: '2026-10-13T11:05:00Z' }));
  eq(cr.lots[0].elements.map((e) => [e.id, e.deleted, e.data.title]), [['bx', false, 'Nouveau']], 'lots : la fiche recréée part comme put, pas comme suppression');
  eq(cr.lots[0].seqs, [10, 11], 'lots : les deux seq de la clé recréée suivent le lot');

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

  // --- Réponses (spec § 5.3) : accepted → retrait ; adjusted → retrait + réécriture non capturée ; rejected par motif
  const { appliquerReponse } = await import('../src/sync/reponses.js');
  const lot = { elements: [
    { store: 'books', id: 'a', data: { id: 'a', updated_at: 'ta' }, updated_at: 'ta', deleted: false },
    { store: 'books', id: 'b', data: { id: 'b', updated_at: 'tb' }, updated_at: 'tb', deleted: false },
    { store: 'books', id: 'c', data: { id: 'c', updated_at: 'tc' }, updated_at: 'tc', deleted: false },
    { store: 'books', id: 'd', data: { id: 'd', updated_at: 'td' }, updated_at: 'td', deleted: false },
    { store: 'books', id: 'e', data: { id: 'e', updated_at: 'te' }, updated_at: 'te', deleted: true },
  ], seqs: [1, 2, 3, 4, 5] };
  const entreesParSeq = new Map([[1, { seq: 1, store: 'books', id: 'a' }], [2, { seq: 2, store: 'books', id: 'b' }], [3, { seq: 3, store: 'books', id: 'c' }], [4, { seq: 4, store: 'books', id: 'd' }], [5, { seq: 5, store: 'books', id: 'e', op: 'delete', payload: { id: 'e' } }]]);
  const reponse = { server_time: '2026-10-13T20:00:00Z', accepted: [{ store: 'books', id: 'a' }, { store: 'books', id: 'e' }], adjusted: [{ store: 'books', id: 'b', updated_at: '2026-10-13T20:00:00+00:00' }], rejected: [{ store: 'books', id: 'c', reason: 'conflit', server: { data: { id: 'c', titre: 'serveur' }, updated_at: '2026-10-14T00:00:00Z', deleted_at: null } }, { store: 'books', id: 'd', reason: 'taille' }] };
  const effets = appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales: { 'books:c': { id: 'c', titre: 'ici', updated_at: 'tc' } } });
  eq(effets.retirer.sort(), [1, 2, 3, 5], 'réponses : accepted, adjusted et conflit retirés de la file ; la quarantaine reste');
  eq(effets.reecrire, { books: [{ id: 'b', updated_at: '2026-10-13T20:00:00+00:00' }] }, 'réponses : adjusted → fiche réécrite avec EXACTEMENT le updated_at renvoyé');
  eq(effets.conflits.map((c2) => [c2.id, c2.store, c2.record_id, c2.local.titre, c2.server.data.titre, c2.kind]), [['books:c', 'books', 'c', 'ici', 'serveur', 'donnees']], 'réponses : rejected{conflit} → conflit journalisé avec les deux versions');
  eq(effets.quarantaine, [{ seq: 4, motif: 'taille' }], 'réponses : rejected{taille} → quarantaine immédiate avec motif');
  const inconnu = appliquerReponse({ lot: { elements: [], seqs: [] }, reponse: { server_time: 't', accepted: [{ store: 'books', id: 'zz' }], adjusted: [], rejected: [] }, entreesParSeq: new Map(), fichesLocales: {} });
  eq(inconnu.retirer, [], 'réponses : un accusé pour une clé hors du lot ne retire rien');

  // R-L3-8 : une clé que le serveur nomme sans qu'elle soit dans le lot n'est JAMAIS crue, dans aucune des trois
  // listes — sinon un serveur bavard (ou compromis) ferait retirer, réécrire ou mettre en conflit n'importe quoi.
  const horsLot = appliquerReponse({
    lot: { elements: [{ store: 'books', id: 'a', data: { id: 'a', updated_at: 'ta' }, updated_at: 'ta', deleted: false }], seqs: [1] },
    reponse: { server_time: 't', accepted: [{ store: 'books', id: 'zz' }], adjusted: [{ store: 'books', id: 'yy', updated_at: 'tz' }], rejected: [{ store: 'books', id: 'xx', reason: 'conflit', server: { data: { id: 'xx' }, updated_at: 'tz', deleted_at: null } }, { store: 'books', id: 'ww', reason: 'taille' }] },
    entreesParSeq: new Map([[1, { seq: 1, store: 'books', id: 'a' }]]),
    fichesLocales: {},
  });
  eq([horsLot.retirer, horsLot.reecrire, horsLot.conflits, horsLot.quarantaine], [[], {}, [], []], 'R-L3-8 : accepted, adjusted et rejected hors du lot → aucun effet');

  // R-L3-7 : un ajustement ne réécrit la fiche que si elle n'a pas bougé ici pendant l'aller-retour.
  const lotB = { elements: [{ store: 'books', id: 'b', data: { id: 'b', titre: 'envoye', updated_at: 'tb' }, updated_at: 'tb', deleted: false }], seqs: [2] };
  const seqsB = new Map([[2, { seq: 2, store: 'books', id: 'b' }]]);
  const reponseB = { server_time: 't', accepted: [], adjusted: [{ store: 'books', id: 'b', updated_at: 'tserveur' }], rejected: [] };
  const ajusteIntacte = appliquerReponse({ lot: lotB, reponse: reponseB, entreesParSeq: seqsB, fichesLocales: { 'books:b': { id: 'b', titre: 'envoye', updated_at: 'tb' } } });
  eq([ajusteIntacte.reecrire, ajusteIntacte.retirer], [{ books: [{ id: 'b', titre: 'envoye', updated_at: 'tserveur' }] }, [2]], 'R-L3-7 : fiche inchangée depuis l’envoi → réécrite avec le updated_at du serveur');
  const ajusteBougee = appliquerReponse({ lot: lotB, reponse: reponseB, entreesParSeq: seqsB, fichesLocales: { 'books:b': { id: 'b', titre: 'change ici', updated_at: 'tb2' } } });
  eq([ajusteBougee.reecrire, ajusteBougee.retirer], [{}, [2]], 'R-L3-7 : fiche modifiée ici pendant l’aller-retour → RIEN n’est réécrit (sa propre entrée de file repartira)');
  const ajusteSupprimee = appliquerReponse({ lot: lotB, reponse: reponseB, entreesParSeq: seqsB, fichesLocales: { 'books:b': null } });
  eq([ajusteSupprimee.reecrire, ajusteSupprimee.retirer], [{}, [2]], 'R-L3-7 : fiche supprimée ici → l’ajustement ne la ressuscite pas');

  // R-L3-29 : un accusé pour une clé dont le conflit est RENVOYÉ range ce conflit — la version d'ici est arrivée,
  // il n'y a plus rien à trancher. Un conflit ORDINAIRE, lui, attend la personne : un accusé ne le range pas.
  const accuseB = { server_time: 't', accepted: [{ store: 'books', id: 'b' }], adjusted: [], rejected: [] };
  eq(appliquerReponse({ lot: lotB, reponse: accuseB, entreesParSeq: seqsB, fichesLocales: {}, conflitsRenvoyes: new Set(['books:b']) }).retirerConflits,
    ['books:b'], 'R-L3-29 : accepted sur une clé au conflit renvoyé → le conflit est rangé');
  eq(appliquerReponse({ lot: lotB, reponse: reponseB, entreesParSeq: seqsB, fichesLocales: {}, conflitsRenvoyes: new Set(['books:b']) }).retirerConflits,
    ['books:b'], 'R-L3-29 : … un adjusted le range aussi (le serveur a bien pris cette version)');
  eq(appliquerReponse({ lot: lotB, reponse: accuseB, entreesParSeq: seqsB, fichesLocales: {}, conflitsRenvoyes: new Set() }).retirerConflits,
    [], 'R-L3-29 : … et un conflit ordinaire n’est JAMAIS rangé par un accusé (il attend la personne)');
  eq(appliquerReponse({ lot: lotB, reponse: accuseB, entreesParSeq: seqsB, fichesLocales: {} }).retirerConflits,
    [], 'R-L3-29 : sans contexte de conflits (appel unitaire), rien n’est rangé');

  // --- Horloge (spec § 5.3) : décalage mesuré à chaque réponse, plancher, avertissement unique au-delà de 5 min
  const { appliquerHeureServeur, getClockOffset, syncNow, setClockOffset } = await import('../src/sync/clock.js');
  try {
    const h1 = appliquerHeureServeur('2026-10-13T20:00:00Z', Date.parse('2026-10-13T19:50:00Z'));
    eq([h1.decalageMs, h1.avertir, h1.minutes], [600000, true, 10], 'horloge : décalage de 10 min mesuré, avertissement');
    eq(getClockOffset(), 600000, 'horloge : le décalage est appliqué à syncNow');
    const h2 = appliquerHeureServeur('2026-10-13T20:00:01Z', Date.parse('2026-10-13T19:59:59Z'));
    eq([h2.decalageMs, h2.avertir], [2000, false], 'horloge : 2 s de décalage, pas d’avertissement');
    ok(syncNow() >= '2026-10-13T20:00:01.000Z', 'horloge : syncNow ne descend jamais sous le dernier server_time vu');
    eq(appliquerHeureServeur('pas une date', Date.parse('2026-10-13T19:59:59Z')).avertir, false, 'horloge : une heure illisible ne change rien et n’avertit pas');
    eq(getClockOffset(), 2000, 'horloge : une heure illisible laisse le décalage mesuré en place');
  } finally { setClockOffset(0); }

  // --- Envoi : une passe (spec § 5.3) — chemin heureux sur une base temporaire
  // Chaque réponse du factice applique une heure serveur : le décalage global est remis à 0 dans tous les cas.
  const { createPush } = await import('../src/sync/push.js');
  try {
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'b1', title: 'Un' });
      await repo.save('books', { id: 'b2', title: 'Deux' });
      await repo.remove('books', 'b2');
      eq(await db.count('outbox'), 3, 'envoi : trois entrées capturées (put, put, delete)');
      const tf = creerTransportFactice();
      const heures = [];
      const push = createPush({ db, transport: tf, getUserId: () => 'u1', surHeure: (h) => heures.push(h) });
      const r = await push.envoyer();
      eq([r.envoyes, r.conflits, r.quarantaine, r.erreur], [2, 0, 0, null], 'envoi : deux clés envoyées (b1 put, b2 delete), aucun conflit');
      eq(await db.count('outbox'), 0, 'envoi : la file est vide après l’accusé (I5 : envoyé = accusé)');
      eq(tf.journal[0].rows.map((e) => [e.store, e.id, e.deleted]), [['books', 'b1', false], ['books', 'b2', true]], 'envoi : le lot envoyé est dédoublonné et ordonné');
      ok(heures.length === 1 && typeof heures[0].decalageMs === 'number', 'envoi : l’heure du serveur est appliquée à chaque réponse');
      eq((await push.envoyer()).envoyes, 0, 'envoi : file vide → aucun appel');
      eq(tf.journal.length, 1, 'envoi : file vide → aucun appel réseau');
    });

    // --- Envoi : effets d'une réponse mêlée, en UNE transaction d'origine 'remote' (spec § 5.3)
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'ok1', title: 'Accepte' });
      await repo.save('books', { id: 'aj1', title: 'Ajuste' });
      await repo.save('books', { id: 'cf1', title: 'Ici' });
      await repo.save('books', { id: 'qt1', title: 'Trop gros' });
      const tf = creerTransportFactice({ pousser: [{ reponse: {
        server_time: '2026-10-13T20:00:00Z',
        accepted: [{ store: 'books', id: 'ok1' }],
        adjusted: [{ store: 'books', id: 'aj1', updated_at: '2026-10-13T20:00:00+00:00' }],
        rejected: [
          { store: 'books', id: 'cf1', reason: 'conflit', server: { data: { id: 'cf1', title: 'Serveur' }, updated_at: '2026-10-14T00:00:00Z', deleted_at: null } },
          { store: 'books', id: 'qt1', reason: 'taille' },
        ],
      } }] });
      const origines = [];
      const vraiMutate = db.mutate.bind(db);
      db.mutate = (arg) => { origines.push(arg?.origin); return vraiMutate(arg); };
      let r;
      try { r = await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:05Z') }).envoyer(); }
      finally { db.mutate = vraiMutate; }
      eq([r.envoyes, r.ajustes, r.conflits, r.quarantaine, r.erreur], [1, 1, 1, 1, null], 'envoi : le bilan compte accusés, ajustements, conflits et quarantaines');
      eq(origines, ['remote'], 'envoi : UNE seule transaction pour tous les effets d’un lot, origine remote (jamais capturée)');
      eq((await db.get('books', 'aj1')).updated_at, '2026-10-13T20:00:00+00:00', 'envoi : la fiche ajustée porte le updated_at du serveur');
      eq(await db.count('outbox'), 1, 'envoi : seule la quarantaine reste en file (accusé, ajusté et conflit retirés)');
      const restante = (await db.getAll('outbox'))[0];
      eq([restante.store, restante.id, restante.last_error, restante.quarantined_at], ['books', 'qt1', 'taille', '2026-10-13T20:00:05.000Z'], 'envoi : l’entrée en quarantaine est nommée, motif et heure posés');
      const conflit = (await db.getAll('sync_conflicts'))[0];
      eq([conflit.id, conflit.store, conflit.record_id, conflit.local.title, conflit.server.data.title, conflit.kind, conflit.at], ['books:cf1', 'books', 'cf1', 'Ici', 'Serveur', 'donnees', '2026-10-13T20:00:00Z'], 'envoi : le conflit garde les deux versions, la locale lue avant la transaction');
      // Une quarantaine n'est pas relue à la passe suivante : elle attend un geste de la personne (Réglages).
      eq([(await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer()).envoyes, tf.journal.length], [0, 1], 'envoi : une entrée en quarantaine n’est plus jamais tentée');
    });

    // --- R-L3-25 : les caractères de contrôle sont retirés À L'ÉCRITURE locale, pas seulement à l'envoi
    // Nettoyés seulement dans la copie envoyée, ils faisaient un conflit PERPÉTUEL : au prochain écho les instants
    // sont égaux, `identiques` voit deux contenus différents → conflit ; et « Garder celle d'ici » renvoyait la
    // version sale, que le serveur renettoyait — le conflit revenait à chaque passe. Nettoyer à l'écriture rend la
    // fiche locale et la copie du serveur identiques, et il n'y a plus rien à trancher.
    await withRepo(async (repo, db) => {
      const ecrite = await repo.save('books', { id: 'ctrl', title: 'a\u0000b', notes: ['x\u000by', { z: 't\u001f' }], garde: 'é\n\tÀ' });
      const relue = await db.get('books', 'ctrl');
      eq([relue.title, relue.notes], ['ab', ['xy', { z: 't' }]], 'R-L3-25 : repo.save nettoie les caractères de contrôle de la fiche LOCALE, partout en profondeur');
      eq([ecrite.title, relue.garde], ['ab', 'é\n\tÀ'], 'R-L3-25 : … la fiche rendue par save est celle qui est écrite, et accents, sauts de ligne et tabulations restent');
      const lot = await composerLots(await db.getAll('outbox'), (s, id) => db.get(s, id));
      const element = lot.lots[0].elements.find((e) => e.id === 'ctrl');
      eq(element.data, relue, 'R-L3-25 : … donc l’élément envoyé est IDENTIQUE à la fiche locale (plus de conflit perpétuel à heure égale)');
      // L'écriture ne passe pas que par save : saveBatch écrit par lots (import d'un index, amorçage, rattrapages).
      await repo.saveBatch({ books: [{ id: 'ctrl2', title: 'c\u0007d' }] });
      eq((await db.get('books', 'ctrl2')).title, 'cd', 'R-L3-25 : saveBatch nettoie aussi');
      // Un magasin HORS SYNC_STORES n'est pas touché : les réglages et l'archive ne vont pas au serveur.
      await repo.save('settings', { key: 'essai_ctrl', value: 'g\u0000h' });
      eq((await db.get('settings', 'essai_ctrl'))?.value, 'g\u0000h', 'R-L3-25 : un magasin hors SYNC_STORES n’est pas nettoyé (rien n’en part)');
    });

    // --- Envoi : R-L3-28 — un put dont la fiche a disparu d'ici est RETIRÉ de la file, sans aucun envoi
    // Elle a disparu par une RÉCEPTION (origine 'remote', jamais capturée : aucune entrée `delete` n'existe) ou
    // par un vidage d'appareil. L'envoyer en tombale avec l'heure de sa dernière écriture écrivait au serveur une
    // ligne supprimée pour une fiche qu'il ne connaissait peut-être même pas — et, si une autre copie l'avait
    // modifiée depuis, cette tombale plus ancienne revenait en conflit à trancher pour rien.
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'parti', title: 'Reçu, puis supprimé ailleurs' });
      eq((await db.getAll('outbox')).map((e) => [e.id, e.op]), [['parti', 'put']], 'R-L3-28 : le put est bien en file au départ');
      // La suppression vient d'ailleurs : origine 'remote', donc rien n'est capturé.
      await db.mutate({ deletes: { books: ['parti'] }, origin: 'remote' });
      const tf = creerTransportFactice({ serveur: true });
      const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      eq([r.envoyes, r.conflits, r.quarantaine, r.abandonnees, r.erreur], [0, 0, 0, 1, null], 'R-L3-28 : l’entrée est abandonnée — rien d’envoyé, rien en conflit, rien en quarantaine');
      eq(tf.journal.length, 0, 'R-L3-28 : AUCUN appel réseau — le serveur connaît déjà cette suppression (ou n’a jamais eu la fiche)');
      eq([await db.count('outbox'), await db.count('sync_conflicts')], [0, 0], 'R-L3-28 : la file se vide de cette entrée, et aucun conflit n’est journalisé');
      ok(!tf.ligne('books', 'parti'), 'R-L3-28 : … et rien n’a été écrit au serveur');
    });

    // --- Envoi : R-L3-28 (b) — une suppression LOCALE explicite part toujours, avec l'heure de son geste (R57)
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'supp', title: 'Supprimée ici' });
      await repo.remove('books', 'supp');
      const enFile = await db.getAll('outbox');
      eq(enFile.map((e) => e.op), ['put', 'delete'], 'R-L3-28 (b) : le put et le delete de la clé sont tous deux en file');
      const tf = creerTransportFactice({ serveur: true });
      const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      eq([r.envoyes, r.abandonnees, r.erreur], [1, 0, null], 'R-L3-28 (b) : une suppression locale explicite part bien — son entrée delete gagne au dédoublonnage');
      eq(tf.journal[0].rows.map((e) => [e.id, e.deleted]), [['supp', true]], 'R-L3-28 (b) : … comme une tombale');
      eq(tf.journal[0].rows[0].updated_at, enFile.find((e) => e.op === 'delete').updated_at, 'R-L3-28 (b) : … avec l’heure de son GESTE (R57 inchangé)');
      eq(await db.count('outbox'), 0, 'R-L3-28 (b) : les deux entrées de la clé quittent la file ensemble');
    });

    // --- Envoi : R-L3-24 — la file est filtrée par user_id (DOIT de la spec § 4.1)
    // « Chaque entrée d'outbox porte `user_id` et n'est jamais envoyée sous un autre compte. » Le user_id était bien
    // écrit, mais personne ne le relisait : la seule barrière était la garde de compte, AILLEURS. La pire
    // conséquence imaginable du lot (les données d'une personne écrites sous un autre compte) ne tenait qu'à une
    // comparaison lointaine. `user_id` nul = écrit avant la connexion, c'est l'envoi initial voulu.
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'mien', title: 'À moi' });
      await db.mutate({ puts: { outbox: [
        { user_id: 'autre', store: 'books', id: 'sien', op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 },
        { user_id: null, store: 'books', id: 'avant', op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 },
      ] }, origin: 'device' });
      await db.mutate({ puts: { books: [{ id: 'sien', title: 'À l’autre', updated_at: '2026-10-12T10:00:00Z' }, { id: 'avant', title: 'Avant la connexion', updated_at: '2026-10-12T10:00:00Z' }] }, origin: 'device' });
      const tf = creerTransportFactice();
      const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      eq(tf.journal[0].rows.map((e) => e.id).sort(), ['avant', 'mien'], 'R-L3-24 : l’entrée d’un AUTRE compte n’est jamais envoyée ; celle d’avant la connexion (user_id nul) part');
      eq([r.envoyes, (await db.getAll('outbox')).map((e) => e.id)], [2, ['sien']], 'R-L3-24 : … et elle reste en file, intacte');
      // Comptée nulle part non plus : le moteur et « À envoyer » doivent dire ce qui va partir, pas plus.
      const { fileDe } = await import('../src/sync/outbox.js');
      eq((await fileDe(db, 'u1')).map((e) => e.id), [], 'R-L3-24 : fileDe() ne rend aucune entrée d’un autre compte');
      eq((await fileDe(db, 'autre')).map((e) => e.id), ['sien'], 'R-L3-24 : … et elle est bien rendue sous SON compte');
    });

    // --- Envoi : R-L3-22 — une ligne files n'entre PLUS en file en L3 (ses octets sont L4)
    // Avant R-L3-22, chaque photo capturée laissait une entrée que rien ne pouvait envoyer avant L4 : « À envoyer »
    // et la pastille affichaient en permanence un nombre qui ne redescendait jamais, et le motif « fichier en
    // attente » n'était affiché nulle part. La retenue de `lots.js` reste comme garde-fou (éprouvée sur
    // `composerLots`, plus haut) ; elle n'est simplement plus atteignable depuis la capture.
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'b9', title: 'Neuf' });
      const sha = 'a'.repeat(64);
      await repo.putFile(sha, new Blob(['x'], { type: 'image/jpeg' }), { original_filename: 'x.jpg' });
      eq((await db.getAll('outbox')).map((e) => e.store), ['books'], 'R-L3-22 : une photo capturée n’entre PAS en file (« À envoyer » ne compte pas les fichiers avant L4)');
      ok((await db.get('files', sha))?.blob instanceof Blob, 'R-L3-22 : … et la photo est bel et bien gardée sur cet appareil');
      const tf = creerTransportFactice();
      const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      eq([r.envoyes, r.retenues, r.erreur], [1, 0, null], 'R-L3-22 : le livre part, et il n’y a plus aucune retenue à compter');
      eq(tf.journal[0].rows.map((e) => e.store), ['books'], 'R-L3-22 : aucun appel réseau ne contient de ligne files');
      eq(await db.count('outbox'), 0, 'R-L3-22 : la file se vide ENTIÈREMENT — le compteur « À envoyer » redescend à zéro');
    });

    // --- R-L3-22 : les entrées files DÉJÀ en file (capturées par L2) sont retirées UNE fois, à l'init
    await withRepo(async (repo, db) => {
      // La fixture a déjà joué init() : la garde est posée. On la retire pour rejouer la migration.
      await db.mutate({ deletes: { sync_state: ['purge_files_outbox'] }, origin: 'device' });
      await db.mutate({ puts: { outbox: [
        { user_id: 'u1', store: 'files', id: 'a'.repeat(64), op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 },
        { user_id: 'u1', store: 'files', id: 'b'.repeat(64), op: 'put', updated_at: '2026-10-12T10:00:00Z', last_error: 'fichier en attente', tries: 0 },
        { user_id: 'u1', store: 'books', id: 'garde', op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 },
      ] }, origin: 'device' });
      await repo.init();
      eq((await db.getAll('outbox')).map((e) => [e.store, e.id]), [['books', 'garde']], 'R-L3-22 : init() retire les entrées files d’avant ce lot, et rien d’autre');
      eq((await db.get('sync_state', 'purge_files_outbox'))?.value, 1, 'R-L3-22 : la garde de la purge est posée');
      // La garde tient : une entrée files replacée à la main n'est pas re-purgée au prochain démarrage.
      await db.mutate({ puts: { outbox: [{ user_id: 'u1', store: 'files', id: 'c'.repeat(64), op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 }] }, origin: 'device' });
      await repo.init();
      eq((await db.getAll('outbox')).map((e) => e.store), ['books', 'files'], 'R-L3-22 : la purge ne se rejoue pas (garde), et aucune transaction inutile au démarrage');
    });

    // --- Envoi : une entrée dont l'heure de reprise n'est pas venue attend (next_try_at, spec § 5.3)
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'ba', title: 'Attend' });
      const entree = (await db.getAll('outbox'))[0];
      await db.mutate({ puts: { outbox: [{ ...entree, next_try_at: '2026-10-13T21:00:00Z', tries: 1, last_error: 'reseau' }] }, origin: 'remote' });
      const tf = creerTransportFactice();
      eq((await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer()).envoyes, 0, 'envoi : avant next_try_at, l’entrée n’est pas relue');
      eq(tf.journal.length, 0, 'envoi : aucune entrée prête → aucun appel réseau');
      eq((await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T21:00:00Z') }).envoyer()).envoyes, 1, 'envoi : à next_try_at, l’entrée repart');
      // Un next_try_at illisible garerait l'entrée pour toujours : elle est éligible maintenant.
      await repo.save('books', { id: 'bn', title: 'Illisible' });
      const neuve = (await db.getAll('outbox')).find((e) => e.id === 'bn');
      await db.mutate({ puts: { outbox: [{ ...neuve, next_try_at: 'pas une date', tries: 2 }] }, origin: 'remote' });
      eq((await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer()).envoyes, 1, 'envoi : un next_try_at illisible n’immobilise pas l’entrée pour toujours');
    });

    // --- Envoi : R-L3-8 de bout en bout — un serveur qui nomme des clés hors du lot n'obtient rien
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'br', title: 'Reste' });
      const tf = creerTransportFactice({ pousser: [{ reponse: {
        server_time: '2026-10-13T20:00:00Z',
        accepted: [{ store: 'books', id: 'inconnu1' }],
        adjusted: [{ store: 'books', id: 'inconnu2', updated_at: '2026-10-13T20:00:00+00:00' }],
        rejected: [
          { store: 'books', id: 'inconnu3', reason: 'conflit', server: { data: { id: 'inconnu3' }, updated_at: '2026-10-14T00:00:00Z', deleted_at: null } },
          { store: 'books', id: 'inconnu4', reason: 'taille' },
        ],
      } }] });
      const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      eq([r.envoyes, r.ajustes, r.conflits, r.quarantaine, r.erreur], [0, 0, 0, 0, null], 'R-L3-8 : le bilan se compte depuis les effets, des clés hors du lot ne comptent pour rien');
      eq([await db.count('outbox'), await db.count('sync_conflicts'), await db.count('books')], [1, 0, 1], 'R-L3-8 : rien n’est retiré, aucun conflit journalisé, aucune fiche inventée');
    });

    // --- Envoi : R-L3-7 de bout en bout — la fiche change ICI pendant l'aller-retour
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'aj2', title: 'Envoye' });
      const transport = { async pousser() {
        // La personne modifie la fiche pendant que l'appel est en vol : nouvelle entrée de file, nouveau updated_at.
        await repo.save('books', { id: 'aj2', title: 'Change pendant l’aller-retour' });
        return { reponse: { server_time: '2026-10-13T20:00:00Z', accepted: [], adjusted: [{ store: 'books', id: 'aj2', updated_at: '2026-10-13T20:00:00+00:00' }], rejected: [] }, erreur: null };
      } };
      const r = await createPush({ db, transport, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:05Z') }).envoyer();
      const fiche = await db.get('books', 'aj2');
      eq([fiche.title, fiche.updated_at === '2026-10-13T20:00:00+00:00'], ['Change pendant l’aller-retour', false], 'R-L3-7 : l’ajustement du serveur n’écrase pas la modification locale');
      eq([r.ajustes, (await db.getAll('outbox')).map((e) => e.id)], [0, ['aj2']], 'R-L3-7 : aucune fiche réécrite, et la version locale garde sa propre entrée de file');
    });

    // --- Envoi : une réponse vide sans erreur ne retire rien (I5), et une passe sur file vide n'écrit rien
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'bv', title: 'Vide' });
      const transport = { async pousser() { return { reponse: null, erreur: null }; } };
      const t = Date.parse('2026-10-13T20:00:00Z');
      const vraiConsole = console.error;
      let journalises = 0;
      console.error = () => { journalises += 1; };
      let r;
      try { r = await createPush({ db, transport, getUserId: () => 'u1', maintenant: () => t }).envoyer(); } finally { console.error = vraiConsole; }
      eq([r.erreur.type, r.envoyes, journalises], ['inconnu', 0, 1], 'envoi : réponse vide sans erreur → inconnu, journalisé une fois');
      eq(await db.count('outbox'), 1, 'envoi : réponse vide → la file est intacte (I5 : envoyé = accusé)');
      // R-L3-9 : une réponse qu'on n'a pas comprise RECULE, elle ne parque rien.
      const e = (await db.getAll('outbox'))[0];
      eq([r.recul, r.quarantaine, e.tries, e.next_try_at, !!e.quarantined_at], [2000, 0, 1, new Date(t + 2000).toISOString(), false], 'R-L3-9 : réponse vide → recul de 2 s, essai compté, aucune quarantaine');
    });

    await withRepo(async (repo, db) => {
      eq(await db.count('outbox'), 0, 'envoi : la base temporaire démarre avec une file vide');
      const origines = [];
      const vraiMutate = db.mutate.bind(db);
      db.mutate = (arg) => { origines.push(arg?.origin); return vraiMutate(arg); };
      const tf = creerTransportFactice();
      let r;
      try { r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer(); } finally { db.mutate = vraiMutate; }
      eq([r.envoyes, origines, tf.journal.length], [0, [], 0], 'envoi : une passe sur file vide n’ouvre aucune transaction et n’appelle rien');
    });

    // --- Envoi : erreurs (spec § 5.3) — recul, 401, quota, dichotomie, refus d’adresse
    const { reculMs } = await import('../src/sync/push.js');
    eq([reculMs(0), reculMs(1), reculMs(2), reculMs(10)], [2000, 4000, 8000, 300000], 'envoi : recul 2 s, 4 s, 8 s … plafond 5 min');
    // Chaque échec passe par logError, donc par console.error : le stub est posé en try/finally (la page reste à
    // zéro erreur console) et il COMPTE les appels — un échec est journalisé, jamais montré.
    const vraiConsoleErreur = console.error;
    const journalErreurs = [];
    console.error = (...args) => { journalErreurs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
    try {
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'r1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'reseau', status: 503, message: 'x' } }, { erreur: { type: 'reseau', status: 0, message: 'x' } }] });
        let t = Date.parse('2026-10-13T20:00:00Z');
        const push = createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => t });
        const r1 = await push.envoyer();
        eq([r1.erreur.type, r1.recul], ['reseau', 2000], 'envoi : échec réseau → recul de 2 s annoncé');
        const e1 = (await db.getAll('outbox'))[0];
        eq([e1.tries, e1.next_try_at, e1.last_error], [1, new Date(t + 2000).toISOString(), 'reseau'], 'envoi : l’entrée compte l’essai, son heure de reprise et le motif');
        eq((await push.envoyer()).erreur, null, 'envoi : avant l’heure de reprise, rien n’est tenté');
        eq(tf.journal.length, 1, 'envoi : aucun appel avant l’heure de reprise');
        t += 2000;
        const r2 = await push.envoyer();
        eq([r2.erreur.type, r2.recul], ['reseau', 4000], 'envoi : deuxième échec → recul doublé');
        eq((await db.getAll('outbox'))[0].tries, 2, 'envoi : deux essais comptés');
        eq(await db.count('outbox'), 1, 'envoi : un échec réseau ne perd rien (I5)');
      });
      await withRepo(async (repo, db) => {
        // R-L3-9 : un 404 ou un cache de schéma PostgREST périmé (PGRST202) arrive en « inconnu ». Il RECULE comme
        // une panne passagère ; le parquer en quarantaine enterrerait toute la file pour un déploiement en retard.
        await repo.save('books', { id: 'i1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'inconnu', status: 404, message: 'x' } }] });
        const t = Date.parse('2026-10-13T20:00:00Z');
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => t }).envoyer();
        eq([r.erreur?.type, r.recul, r.quarantaine], ['inconnu', 2000, 0], 'R-L3-9 : un type « inconnu » recule, il ne parque rien');
        const e = (await db.getAll('outbox'))[0];
        eq([e.tries, e.next_try_at, e.last_error, !!e.quarantined_at], [1, new Date(t + 2000).toISOString(), 'inconnu', false], 'R-L3-9 : l’entrée compte l’essai et son heure de reprise, jamais de quarantaine');
        eq(await db.count('outbox'), 1, 'R-L3-9 : rien n’est perdu sur un « inconnu »');
      });
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'a1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'auth', status: 401, message: 'x' } }] });
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        eq([r.attenteConnexion, r.erreur.type, (await db.getAll('outbox'))[0].tries], [true, 'auth', 0], 'envoi : 401 → en attente de connexion, sans compter d’essai');
      });
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'q1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'quota', status: 507, message: 'x' } }] });
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer();
        eq(r.pause, true, 'envoi : refus de quota → pause');
        eq((await db.get('sync_state', 'pause'))?.value?.raison, 'quota', 'envoi : la pause est écrite dans sync_state');
        eq((await db.get('sync_state', 'pause'))?.value?.at, '2026-10-13T20:00:00.000Z', 'envoi : la pause est horodatée');
        eq(await db.count('outbox'), 1, 'envoi : rien n’est perdu en pause');
      });
      await withRepo(async (repo, db) => {
        for (const id of ['d1', 'd2', 'd3', 'd4']) await repo.save('books', { id, title: id });
        // d3 enregistrée deux fois : DEUX entrées de file pour la même clé. L’isolement doit emporter le doublon.
        await repo.save('books', { id: 'd3', title: 'd3 deux fois' });
        eq(await db.count('outbox'), 5, 'envoi : cinq entrées de file pour quatre clés (d3 enregistrée deux fois)');
        // Le serveur refuse tout lot contenant d3 (règle simulée) ; la dichotomie doit l’isoler et envoyer les autres.
        const tf = { journal: [], async pousser(rows) { tf.journal.push({ appel: 'pousser', rows: rows.map(({ store, id }) => ({ store, id })) }); if (rows.some((r) => r.id === 'd3')) return { reponse: null, erreur: { type: 'refus', status: 400, message: 'regle simulee' } }; return { reponse: { server_time: '2026-10-13T20:00:00Z', accepted: rows.map(({ store, id }) => ({ store, id })), adjusted: [], rejected: [] }, erreur: null }; }, async lire() { return { lignes: [], erreur: null }; } };
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer();
        eq([r.envoyes, r.quarantaine], [3, 1], 'envoi : dichotomie → trois envoyées, une en quarantaine');
        eq(tf.journal.map((a) => a.rows.map((x) => x.id)), [['d1', 'd2', 'd3', 'd4'], ['d1', 'd2'], ['d3', 'd4'], ['d3'], ['d4']], 'envoi : le lot entier d’abord, puis des moitiés, jusqu’à isoler la fiche fautive');
        const reste = await db.getAll('outbox');
        eq(reste.map((e) => [e.seq, e.id, e.last_error, e.quarantined_at]), [[5, 'd3', 'refus', '2026-10-13T20:00:00.000Z']], 'envoi : seul le seq le plus haut de la clé isolée reste, en quarantaine, motif et heure posés');
        eq(await db.count('outbox'), 1, 'envoi : le doublon plus ancien de la clé isolée est retiré avec elle');
        // La quarantaine est permanente : la passe suivante ne retente rien et n’appelle plus le serveur.
        const appels = tf.journal.length;
        eq([(await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer()).envoyes, tf.journal.length], [0, appels], 'envoi : après la dichotomie, l’entrée isolée n’est plus jamais tentée');
      });
      await withRepo(async (repo, db) => {
        // Un échec réseau au milieu d’une dichotomie arrête tout : rien n’est mis en quarantaine par accident.
        for (const id of ['x1', 'x2']) await repo.save('books', { id, title: id });
        const tf = { journal: [], async pousser(rows) { tf.journal.push({ appel: 'pousser', rows: rows.map(({ store, id }) => ({ store, id })) }); return { reponse: null, erreur: rows.length > 1 ? { type: 'refus', status: 400, message: 'x' } : { type: 'reseau', status: 0, message: 'x' } }; } };
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1', maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer();
        eq([r.erreur.type, r.quarantaine, r.recul], ['reseau', 0, 2000], 'envoi : un échec réseau pendant la dichotomie arrête la passe, sans quarantaine');
        eq([tf.journal.map((a) => a.rows.map((x) => x.id)), await db.count('outbox')], [[['x1', 'x2'], ['x1']], 2], 'envoi : la moitié droite n’est pas tentée, la file est intacte');
      });
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'n1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'auth', status: 400, message: 'adresse non autorisée' } }] });
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        eq(r.attenteConnexion, true, 'envoi : « adresse non autorisée » → attente (la garde est refaite par le moteur), rien n’est perdu');
        eq([(await db.getAll('outbox'))[0].tries, await db.count('outbox')], [0, 1], 'envoi : un refus d’adresse ne compte aucun essai et ne perd rien');
      });
    } finally { console.error = vraiConsoleErreur; }
    eq(journalErreurs.length, 11, 'envoi : chaque échec est journalisé une fois, par un code');
    ok(!journalErreurs.some((t) => t.includes('"x"') || t.includes('regle simulee') || t.includes('adresse non autoris')), 'envoi : aucun texte venu du fournisseur n’entre dans le journal (seulement un code et un statut)');
  } finally { setClockOffset(0); }

  // --- Envoi initial par marqueurs (spec § 5.2) : complet, reprenable, déclenché sur un appareil déjà connecté
  const { tablesAEnvoyer, envoiInitial, retirerMarqueur } = await import('../src/sync/backfill.js');
  const { SYNC_STORES } = await import('../src/model/schema.js');
  // R-L3-22 : `files` n'est PAS de l'envoi initial en L3 (les octets sont L4), et son marqueur n'est pas posé —
  // L4 trouvera donc la table entière à envoyer, sans rattrapage à faire.
  // Assistant par le compte (K-3, R-CPT-1) : `assistant_config` est dans SYNC_STORES mais n'est candidate que sur un
  // appareil de production (`configSuitLeCompte`, faux par défaut) : ces décomptes restent 23/24 sans lui ; les
  // 24/25 avec lui sont éprouvés dans tests/assistant-compte.js.
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).length, 23, 'envoi initial : 23 tables sans l’historique ni les fichiers (R-L3-22), ni assistant_config (hors production par défaut)');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true }).length, 24, 'envoi initial : 24 tables avec l’historique');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true }).includes('files'), false, 'R-L3-22 : « files » n’est jamais de l’envoi initial en L3');
  eq(tablesAEnvoyer({ marqueurs: { 'backfill:books': 'fait' }, isActivitySynced: () => false }).includes('books'), false, 'envoi initial : une table marquée « fait » ne repart pas');
  await withRepo(async (repo, db) => {
    // Bibliothèque d’AVANT la connexion : écrite sans capture (comme en L1, ou restaurée), puis compte connecté.
    await db.mutate({ puts: { books: [{ id: 'v1', title: 'Vieux', updated_at: '2026-10-01T00:00:00Z' }, { id: 'v2', title: 'Vieux 2', updated_at: '2026-10-01T00:00:00Z' }], files: [{ sha256: 'a'.repeat(64), mime: 'image/jpeg', size: 1, updated_at: '2026-10-01T00:00:00Z', syncable: true }, { sha256: 'b'.repeat(64), mime: 'application/octet-stream', size: 1, updated_at: '2026-10-01T00:00:00Z', syncable: false }] }, origin: 'device' });
    eq(await db.count('outbox'), 0, 'envoi initial : rien en file avant');
    const progression = [];
    const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, surProgression: (p) => progression.push(p), tailleMorceau: 1 });
    eq(r.tables.length, 23, 'envoi initial : les 23 tables sont parcourues (ni l’historique, ni les fichiers, ni assistant_config hors production)');
    const file = await db.getAll('outbox');
    const refs = (await db.count('ingredients')) + (await db.count('unit_definitions')) + (await db.count('unit_conventions')); // amorçage mesuré : ingredients, unit_definitions, unit_conventions
    eq(file.length, refs + 2, 'envoi initial : références amorcées + 2 livres en file (R-L3-22 : aucun fichier)');
    ok(file.every((e) => e.op === 'put' && e.user_id === 'u1'), 'envoi initial : des put, au nom du compte');
    ok(!file.some((e) => e.store === 'files'), 'R-L3-22 : aucune ligne files n’est mise en file par l’envoi initial, synchronisable ou non');
    eq(await db.get('sync_state', 'backfill:files'), undefined, 'R-L3-22 : le marqueur « backfill:files » n’est PAS posé — L4 trouvera la table entière à envoyer');
    eq((await db.get('sync_state', 'backfill:books'))?.value, 'fait', 'envoi initial : marqueur posé après la table');
    ok(progression.some((p) => p.table === 'books' && p.n >= 1 && p.total === 23), 'envoi initial : progression « table n/23 »');
    // Une table vide (aucune ligne) reçoit quand même son marqueur, sans aucune entrée en file pour elle.
    eq((await db.get('sync_state', 'backfill:dishes'))?.value, 'fait', 'envoi initial : une table vide est marquée « fait »');
    ok(!file.some((e) => e.store === 'dishes'), 'envoi initial : une table vide ne met jamais rien en file');
    const r2 = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false });
    eq([r2.mises, await db.count('outbox')], [0, refs + 2], 'envoi initial : rejoué → rien de plus (marqueurs)');
    await retirerMarqueur(db, 'books');
    const r3 = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false });
    eq(r3.tables, ['books'], 'envoi initial : marqueur retiré → seule cette table repart (rattrapage, R27)');
  });

  // --- Transport factice : une page de lecture scriptée (R-L3-4)
  // Une page est un tableau de lignes OU un objet { erreur } — rien d'autre. L'ancien test `page && page.erreur`
  // acceptait les deux formes utiles mais laissait TOUTE autre forme filer jusqu'à `page.filter is not a function`,
  // une panne nommée très loin de sa cause (le script de lecture d'un test).
  const fl = creerTransportFactice({ lire: { books: [{ erreur: { type: 'reseau', status: 0, message: 'x' } }, [{ id: 'b1', data: { id: 'b1' }, updated_at: 't', deleted_at: null, server_seq: 1 }]] } });
  const flErreur = await fl.lire('books', 0);
  eq([flErreur.lignes, flErreur.erreur.type], [null, 'reseau'], 'factice (R-L3-4) : une page scriptée { erreur } rend une erreur de transport');
  eq((await fl.lire('books', 0)).lignes.map((l) => l.id), ['b1'], 'factice (R-L3-4) : la page suivante rend bien ses lignes');
  const fm = creerTransportFactice({ lire: { books: [{ lignes: [] }] } });
  let messageForme = '';
  try { await fm.lire('books', 0); } catch (error) { messageForme = String(error?.message || error); }
  ok(/page scriptée/.test(messageForme) && !/filter/.test(messageForme), 'factice (R-L3-4) : une page scriptée d’une autre forme est refusée en nommant la page, pas par un « filter is not a function »');

  // --- Réception (spec § 5.5) : décision I7, tombale, curseur atomique, conflits, files sans octets, pointeur
  const { decider, estAncetre, identiques, createPull } = await import('../src/sync/pull.js');
  const L = (u, extra = {}) => ({ id: 'x', updated_at: u, ...extra });
  eq(decider({ locale: undefined, distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'ecrire', 'réception : absent localement → écrit');
  eq(decider({ locale: L('t1'), distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'ecrire', 'réception : distant plus récent → écrit');
  eq(decider({ locale: L('t3'), distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'conflit_renvoyer', 'réception : local plus récent → conservé, conflit, renvoyé');
  eq(decider({ locale: L('t2', { a: 1 }), distante: { data: L('t2', { a: 1 }), updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : égalité identique → rien');
  eq(decider({ locale: L('t2', { a: 1 }), distante: { data: L('t2', { a: 2 }), updated_at: 't2', deleted_at: null } }), 'conflit', 'réception : égalité différente → conflit sans remise en file');
  eq(decider({ locale: L('t1'), distante: { data: {}, updated_at: 't2', deleted_at: 't2' } }), 'supprimer', 'réception : tombale → suppression');
  eq(decider({ locale: undefined, distante: { data: {}, updated_at: 't2', deleted_at: 't2' } }), 'ignorer', 'réception : tombale d’une fiche inconnue → rien');
  // R-L3-26 (amende § 5.5) : une tombale reçue obéit à I7 comme tout le reste. La lettre de § 5.5 disait « ligne
  // reçue avec deleted_at → suppression locale », sans comparer les instants : une tombale du 10 octobre effaçait
  // une version locale du 12, sans conflit et sans trace. L'ordre du moteur (envoi puis réception, réception sautée
  // si l'envoi a buté) masquait le cas général — sauf que `lireFile` écarte les entrées EN QUARANTAINE sans
  // produire d'erreur : l'envoi « réussit », la réception se poursuit, et la tombale venue d'ailleurs effaçait la
  // fiche locale plus récente dont l'envoi était justement bloqué (une fiche grossie au-delà de 512 Ko, motif
  // « taille »). I7 est l'invariant, donc c'est § 5.5 qui cède.
  const T = (u) => ({ data: null, updated_at: u, deleted_at: u });
  eq(decider({ locale: L('2026-10-12T10:00:00Z'), distante: T('2026-10-10T10:00:00Z') }), 'conflit_renvoyer', 'R-L3-26 : une tombale PLUS ANCIENNE que la fiche locale ne supprime pas — la personne tranche');
  eq(decider({ locale: L('2026-10-10T10:00:00Z'), distante: T('2026-10-10T10:00:00Z') }), 'supprimer', 'R-L3-26 : à instant ÉGAL la tombale gagne (une suppression est le dernier mot sur cette heure)');
  eq(decider({ locale: L('2026-10-10T10:00:00.000Z'), distante: T('2026-10-10T10:00:00+00:00') }), 'supprimer', 'R-L3-26 : … et les deux écritures du même instant ne font pas un faux conflit (R-L3-11)');
  eq(decider({ locale: L('2026-10-10T10:00:00Z'), distante: T('2026-10-12T10:00:00Z') }), 'supprimer', 'R-L3-26 : une tombale plus récente supprime, comme avant');
  eq(decider({ locale: L('t3'), distante: T('t2') }), 'conflit_renvoyer', 'R-L3-26 : heures illisibles → repli sur la chaîne, pour rester déterministe');
  eq(decider({ locale: undefined, distante: T('2026-10-10T10:00:00Z') }), 'ignorer', 'R-L3-26 : une tombale d’une fiche inconnue ne dit toujours rien');
  // jsonb RÉORDONNE les clés : la copie du serveur revient presque toujours dans un autre ordre que la fiche locale.
  // Comparées par JSON brut, deux fiches identiques feraient un conflit à chaque égalité d'updated_at.
  eq(decider({ locale: { id: 'x', a: 1, b: 2, updated_at: 't2' }, distante: { data: { updated_at: 't2', b: 2, a: 1, id: 'x' }, updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : mêmes champs dans un autre ordre (jsonb réordonne) → identiques, rien');
  eq(decider({ locale: { id: 'x', updated_at: 't2', meta: { z: 1, liste: [{ q: 1, p: 2 }] } }, distante: { data: { meta: { liste: [{ p: 2, q: 1 }], z: 1 }, id: 'x', updated_at: 't2' }, updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : ordre des clés différent EN PROFONDEUR → identiques (tri récursif)');
  eq(decider({ locale: { id: 'x', updated_at: 't2', liste: [1, 2] }, distante: { data: { id: 'x', updated_at: 't2', liste: [2, 1] }, updated_at: 't2', deleted_at: null } }), 'conflit', 'réception : l’ordre d’un TABLEAU reste une différence (une liste d’étapes a un ordre)');
  // R-L3-11 : PostgREST rend « +00:00 », et des microsecondes quand il y en a ; le local porte « .000Z ». Comparées
  // comme des CHAÎNES, ces deux écritures du MÊME instant donnent `l > d` ('.' > '+', 'Z' > un chiffre) : l'écho de
  // nos propres envois revenait en conflit à chaque réception. La comparaison porte donc sur des INSTANTS.
  eq(decider({ locale: { id: 'x', titre: 'Pareil', updated_at: '2026-10-13T11:00:00.000Z' }, distante: { data: { id: 'x', titre: 'Pareil', updated_at: '2026-10-13T11:00:00+00:00' }, updated_at: '2026-10-13T11:00:00+00:00', deleted_at: null } }), 'ignorer', 'R-L3-11 : le même instant écrit « .000Z » ici et « +00:00 » là → identiques, rien');
  eq(decider({ locale: { id: 'x', updated_at: '2026-10-13T11:00:00.123Z' }, distante: { data: { id: 'x', updated_at: '2026-10-13T11:00:00.123456+00:00' }, updated_at: '2026-10-13T11:00:00.123456+00:00', deleted_at: null } }), 'ignorer', 'R-L3-11 : les microsecondes du serveur ne font pas un conflit (égalité à la milliseconde)');
  eq(decider({ locale: { id: 'x', updated_at: '2026-10-13T11:00:00.124Z' }, distante: { data: { id: 'x', updated_at: '2026-10-13T11:00:00.123456+00:00' }, updated_at: '2026-10-13T11:00:00.123456+00:00', deleted_at: null } }), 'conflit_renvoyer', 'R-L3-11 : une milliseconde de plus ici reste plus récent');
  eq(decider({ locale: { id: 'x', updated_at: '2026-10-13T11:00:00Z' }, distante: { data: { id: 'x', updated_at: '2026-10-13T11:00:01+00:00' }, updated_at: '2026-10-13T11:00:01+00:00', deleted_at: null } }), 'ecrire', 'R-L3-11 : une seconde de plus là-bas → écrit');
  eq(identiques({ id: 'x', updated_at: 'tA' }, { id: 'x', updated_at: 'tB' }), true, 'R-L3-11 : identiques ne compare PAS updated_at (l’égalité d’instant est déjà établie avant l’appel)');
  eq([identiques({ a: 1, b: undefined }, { a: 1 }), identiques({ a: 1, b: null }, { a: 1 })], [true, false], 'R-L3-11 : identiques — un champ undefined équivaut à l’absence, un champ null non');
  const versions = [{ id: 'v1', parent_version_id: null }, { id: 'v2', parent_version_id: 'v1' }, { id: 'v3', parent_version_id: 'v2' }, { id: 'w1', parent_version_id: 'v1' }];
  eq([estAncetre(versions, 'v1', 'v3'), estAncetre(versions, 'v2', 'v3'), estAncetre(versions, 'w1', 'v3'), estAncetre(versions, 'v3', 'v3')], [true, true, false, true], 'réception : ancêtre de version (chaîne parent_version_id)');
  const boucle = [{ id: 'c1', parent_version_id: 'c2' }, { id: 'c2', parent_version_id: 'c1' }];
  eq([estAncetre(boucle, 'c1', 'c2'), estAncetre(boucle, 'zz', 'c2')], [true, false], 'réception : une chaîne de versions bouclée (fiche bricolée, archive) ne fait pas tourner estAncetre sans fin');

  await withRepo(async (repo, db) => {
    // Les deux fiches sont écrites par `db.mutate` d'origine 'device', et c'est voulu : `repo.save` REMPLACE
    // l'`updated_at` reçu par `syncNow()`, donc les deux dates ci-dessous n'étaient pas celles que la base portait
    // — p3 était en réalité datée de maintenant, et la tombale du 13 octobre n'était plus la plus récente. Le
    // décalage ne se voyait pas tant qu'une tombale gagnait sans comparer les instants ; R-L3-26 le révèle. Écrites
    // ainsi, les dates du test sont celles de la base, et l'origine 'device' n'est de toute façon pas capturée.
    await db.mutate({ puts: { books: [
      { id: 'p1', title: 'Ici plus récent', updated_at: '2026-10-13T12:00:00Z' },
      { id: 'p3', title: 'À supprimer', updated_at: '2026-10-13T10:00:00Z' },
    ] }, origin: 'device' });
    eq(await db.count('outbox'), 0, 'réception : la file est vide avant la page (les écritures d’origine « device » ne sont pas capturées)');
    const page1 = [
      { id: 'p1', data: { id: 'p1', title: 'Ailleurs plus vieux', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 10 },
      { id: 'p2', data: { id: 'p2', title: 'Nouveau', updated_at: '2026-10-13T11:30:00Z' }, updated_at: '2026-10-13T11:30:00Z', deleted_at: null, server_seq: 11 },
    ];
    const page2 = [{ id: 'p3', data: {}, updated_at: '2026-10-13T12:30:00Z', deleted_at: '2026-10-13T12:30:00Z', server_seq: 12 }];
    const tf = creerTransportFactice({ lire: { books: [page1, page2, []] } });
    const pull = createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', limite: 2 });
    const r = await pull.recevoir();
    eq([r.recues, r.supprimees, r.conflits, r.erreur], [1, 1, 1, null], 'réception : une écrite, une supprimée, un conflit');
    eq((await db.get('books', 'p1')).title, 'Ici plus récent', 'réception : le local plus récent est conservé');
    eq((await db.get('books', 'p2')).title, 'Nouveau', 'réception : la fiche nouvelle est écrite');
    eq(await db.get('books', 'p3'), undefined, 'réception : la tombale supprime localement');
    eq((await db.get('sync_state', 'cursor:books'))?.value, 12, 'réception : le curseur = dernier server_seq écrit');
    const file = await db.getAll('outbox');
    eq(file.map((e) => [e.store, e.id, e.op]), [['books', 'p1', 'put']], 'réception : le local plus récent est remis en file (le serveur l’acceptera) ; la suppression reçue ne repart pas');
    eq(file.map((e) => [e.user_id, e.updated_at]), [['u1', (await db.get('books', 'p1')).updated_at]], 'réception : l’entrée remise en file est au nom du compte, avec le updated_at local');
    const conflit = await db.get('sync_conflicts', 'books:p1');
    eq([conflit.local.title, conflit.server.data.title, conflit.kind], ['Ici plus récent', 'Ailleurs plus vieux', 'donnees'], 'réception : conflit journalisé avec les deux versions');
    eq(conflit.renvoye, true, 'R-L3-29 : … et marqué RENVOYÉ (la version d’ici est repartie : il n’y a plus rien à trancher)');
    const appels = tf.journal.filter((a) => a.appel === 'lire' && a.table === 'books').map((a) => a.apres);
    eq(appels, [0, 11, 12], 'réception : paginée par le curseur avancé après chaque page écrite');
    ok(!tf.journal.some((a) => a.appel === 'lire' && a.table === 'library_activity'), 'réception : l’historique n’est pas lu sans le réglage');
  });
  // Les deux blocs suivants journalisent par logError, donc par console.error : le stub est posé en try/finally (la
  // page reste à zéro erreur console) et il COMPTE les appels — un refus est journalisé, jamais montré.
  const vraiConsoleReception = console.error;
  const journalReception = [];
  console.error = (...args) => { journalReception.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
  try {
    await withRepo(async (repo, db) => {
      // Curseur atomique : une page dont l’écriture échoue n’avance pas le curseur.
      const tf = creerTransportFactice({ lire: { books: [[{ id: 'bad', data: { id: 'autre' }, updated_at: 't', deleted_at: null, server_seq: 5 }], []] } });
      const pull = createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' });
      const r = await pull.recevoir();
      ok(r.erreur && r.erreur.type === 'forme', 'réception : une ligne dont data.id ≠ id est refusée (forme), rien d’écrit');
      eq(await db.get('sync_state', 'cursor:books'), undefined, 'réception : le curseur n’a pas avancé');
      eq([await db.count('books'), await db.count('sync_conflicts')], [0, 0], 'réception : une page refusée pour sa forme n’écrit AUCUNE de ses lignes');
    });
    await withRepo(async (repo, db) => {
      // Une erreur de transport (R-L3-4, enfin scriptable) arrête la passe : rien d’écrit, curseur intact.
      const tf = creerTransportFactice({ lire: { books: [{ erreur: { type: 'reseau', status: 0, message: 'x' } }] } });
      const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
      eq([r.erreur.type, r.recues, await db.get('sync_state', 'cursor:books')], ['reseau', 0, undefined], 'réception : une erreur de transport arrête la passe, rien n’est écrit, le curseur reste');
      eq(tf.journal.filter((a) => a.appel === 'lire').map((a) => a.table), ['recipe_versions', 'books'], 'réception : la table en erreur arrête la passe, les suivantes ne sont pas lues (R-L3-12 : les versions passent d’abord)');
    });
  } finally { console.error = vraiConsoleReception; }
  eq(journalReception.length, 2, 'réception : un refus de forme et une erreur de transport, journalisés une fois chacun');
  ok(!journalReception.some((t) => t.includes('autre') || t.includes('"bad"') || t.includes('"x"')), 'réception : le journal ne porte ni contenu de fiche ni texte du fournisseur');

  await withRepo(async (repo, db) => {
    // files reçue sans octets : ligne écrite remote:true ; une ligne locale qui a déjà le blob le garde.
    const sha = 'c'.repeat(64);
    await repo.putFile(sha, new Blob(['x'], { type: 'image/jpeg' }), { original_filename: 'x.jpg' });
    const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: { sha256: sha, mime: 'image/jpeg', size: 1, updated_at: '2030-01-01T00:00:00Z' }, updated_at: '2030-01-01T00:00:00Z', deleted_at: null, server_seq: 3 }, { id: 'd'.repeat(64), data: { sha256: 'd'.repeat(64), mime: 'image/png', size: 2, updated_at: '2030-01-01T00:00:00Z' }, updated_at: '2030-01-01T00:00:00Z', deleted_at: null, server_seq: 4 }], []] } });
    await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    const avecBlob = await db.get('files', sha);
    ok(avecBlob.blob instanceof Blob, 'réception : une ligne files reçue n’efface jamais le blob local');
    eq([avecBlob.original_filename, avecBlob.syncable, typeof avecBlob.created_at], ['x.jpg', true, 'string'], 'réception : les métadonnées locales d’une ligne files (nom d’origine, syncable, created_at) survivent à la réception');
    const sans = await db.get('files', 'd'.repeat(64));
    eq([sans.remote, 'blob' in sans], [true, false], 'réception : une ligne files inconnue arrive remote:true, sans octets (L4 les téléchargera)');
  });
  await withRepo(async (repo, db) => {
    // R-L3-11 de bout en bout : l’écho de notre propre envoi (même instant, rendu « +00:00 » avec des microsecondes)
    // n’est ni réécrit ni mis en conflit — et une page entièrement « ignorée » fait quand même avancer le curseur,
    // sinon elle serait relue à chaque passe pour toujours.
    await db.mutate({ puts: { books: [{ id: 's1', title: 'Pareil', updated_at: '2026-10-13T11:00:00.000Z' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { books: [[{ id: 's1', data: { id: 's1', title: 'Pareil', updated_at: '2026-10-13T11:00:00.000123+00:00' }, updated_at: '2026-10-13T11:00:00.000123+00:00', deleted_at: null, server_seq: 7 }], []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq([r.recues, r.conflits, await db.count('outbox'), await db.count('sync_conflicts')], [0, 0, 0, 0], 'R-L3-11 : l’écho de notre propre envoi (« +00:00 » et microsecondes) n’est ni réécrit ni mis en conflit');
    eq((await db.get('books', 's1')).updated_at, '2026-10-13T11:00:00.000Z', 'R-L3-11 : rien n’étant réécrit, la fiche garde sa propre chaîne');
    eq((await db.get('sync_state', 'cursor:books'))?.value, 7, 'réception : une page entièrement ignorée fait quand même avancer le curseur');
  });
  await withRepo(async (repo, db) => {
    // R-L3-11 : quand la fiche EST écrite, la chaîne du serveur est stockée VERBATIM — microsecondes et décalage
    // compris. Un renvoi doit être égal, côté serveur, à la microseconde.
    const tf = creerTransportFactice({ lire: { books: [[{ id: 's2', data: { id: 's2', title: 'Neuf', updated_at: 'autre chose' }, updated_at: '2026-10-13T11:00:00.654321+00:00', deleted_at: null, server_seq: 8 }], []] } });
    await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq((await db.get('books', 's2')).updated_at, '2026-10-13T11:00:00.654321+00:00', 'R-L3-11 : la fiche écrite porte la chaîne du serveur VERBATIM (microsecondes comprises)');
  });
  await withRepo(async (repo, db) => {
    // Le curseur ne RECULE jamais : une page dont les server_seq sont sous le curseur est écrite, mais le curseur
    // garde sa valeur — sinon tout ce qui est déjà reçu repartirait en boucle.
    await db.mutate({ puts: { sync_state: [{ key: 'cursor:books', value: 50 }] }, origin: 'device' });
    let appels = 0;
    const transport = { async lire(table) {
      if (table !== 'books') return { lignes: [], erreur: null };
      appels += 1;
      return { lignes: appels === 1 ? [{ id: 'retard', data: { id: 'retard', title: 'En retard' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 5 }] : [], erreur: null };
    } };
    const r = await createPull({ db, transport, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq([(await db.get('sync_state', 'cursor:books')).value, r.recues, appels], [50, 1, 1], 'réception : un server_seq sous le curseur ne le fait pas reculer, et la table s’arrête là');
    eq((await db.get('books', 'retard')).title, 'En retard', 'réception : la ligne en retard est quand même écrite');
  });
  await withRepo(async (repo, db) => {
    // R-L3-12 : une adaptation faite ailleurs crée une version FILLE de celle qu’on a ici. Les versions sont reçues
    // AVANT les recettes, donc le pointeur reçu désigne une version déjà connue : aucun conflit. Sans cet ordre,
    // chaque adaptation venue d’un autre appareil ressortait en faux conflit de pointeur.
    await db.mutate({ puts: { recipes: [{ id: 'r2', current_version_id: 'w1', updated_at: '2026-10-13T10:00:00Z' }], recipe_versions: [{ id: 'v1', recipe_id: 'r2', parent_version_id: null, updated_at: 't' }, { id: 'w1', recipe_id: 'r2', parent_version_id: 'v1', updated_at: 't' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: {
      recipe_versions: [[{ id: 'v2', data: { id: 'v2', recipe_id: 'r2', parent_version_id: 'w1', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 8 }], []],
      recipes: [[{ id: 'r2', data: { id: 'r2', current_version_id: 'v2', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 9 }], []],
    } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    const ordre = tf.journal.filter((a) => a.appel === 'lire').map((a) => a.table);
    eq([ordre[0], ordre.indexOf('recipe_versions') < ordre.indexOf('recipes')], ['recipe_versions', true], 'réception (R-L3-12) : les versions sont lues AVANT les recettes');
    eq([r.conflits, (await db.get('recipes', 'r2')).current_version_id, await db.count('recipe_versions')], [0, 'v2', 3], 'réception (R-L3-12) : le pointeur avance vers une version FILLE déjà reçue → aucun conflit');
  });
  await withRepo(async (repo, db) => {
    // R-L3-12 : la version pointée par la fiche reçue n’est pas encore arrivée ici → RIEN n’est signalé. Un conflit
    // annoncé sur une chaîne qu’on ne connaît pas encore serait faux, et il masquerait le vrai quand il viendrait.
    await db.mutate({ puts: { recipes: [{ id: 'r3', current_version_id: 'w1', updated_at: '2026-10-13T10:00:00Z' }], recipe_versions: [{ id: 'v1', recipe_id: 'r3', parent_version_id: null, updated_at: 't' }, { id: 'w1', recipe_id: 'r3', parent_version_id: 'v1', updated_at: 't' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { recipes: [[{ id: 'r3', data: { id: 'r3', current_version_id: 'v9', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 9 }], []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq([r.conflits, (await db.get('recipes', 'r3')).current_version_id, await db.get('sync_conflicts', 'recipes:r3')], [0, 'v9', undefined], 'réception (R-L3-12) : une version pointée encore inconnue ici n’est JAMAIS un conflit');
  });
  await withRepo(async (repo, db) => {
    // Vraie divergence : les deux versions sont connues ici, et celle d’ici n’est PAS un ancêtre de celle qu’on reçoit.
    await db.mutate({ puts: { recipes: [{ id: 'r1', current_version_id: 'w1', updated_at: '2026-10-13T10:00:00Z' }], recipe_versions: [{ id: 'v1', recipe_id: 'r1', parent_version_id: null, updated_at: 't' }, { id: 'w1', recipe_id: 'r1', parent_version_id: 'v1', updated_at: 't' }, { id: 'v2', recipe_id: 'r1', parent_version_id: 'v1', updated_at: 't' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { recipes: [[{ id: 'r1', data: { id: 'r1', current_version_id: 'v2', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 9 }], []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq((await db.get('recipes', 'r1')).current_version_id, 'v2', 'réception : la fiche recette reçue (plus récente) est écrite');
    const c = await db.get('sync_conflicts', 'recipes:r1');
    eq([c?.kind, r.conflits], ['version', 1], 'réception : conflit « version » journalisé — aucune version masquée');
    eq(await db.count('recipe_versions'), 3, 'réception : aucune version n’est masquée ni retirée par le conflit de pointeur');
    eq((await db.getAll('outbox')).length, 0, 'réception : un conflit de pointeur ne remet rien en file (la fiche reçue a gagné)');
  });

  // --- Conflits : gestes (spec § 5.5)
  const { garderIci, garderAilleurs, ignorerRenvoye, purgerAnciens } = await import('../src/sync/conflits.js');
  await withRepo(async (repo, db) => {
    // L’heure locale de la fiche est posée loin dans le passé : l’assertion « updated_at neuf » ne dépend alors ni
    // de l’heure réelle du Mac ni du plancher laissé par le bloc « Horloge ».
    const conflit = { id: 'books:k1', store: 'books', record_id: 'k1', local: { id: 'k1', title: 'ici', updated_at: '2020-01-01T00:00:00.000Z' }, server: { data: { id: 'k1', title: 'ailleurs', updated_at: '2020-01-01T00:00:00.000Z' }, updated_at: '2020-01-01T00:00:00.000Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees' };
    await db.mutate({ puts: { sync_conflicts: [conflit], books: [conflit.server.data] }, origin: 'device' });
    await garderIci(db, conflit);
    const k = await db.get('books', 'k1');
    ok(k.title === 'ici' && k.updated_at > conflit.local.updated_at, 'conflits : « Garder celle d’ici » restaure la version locale avec un updated_at neuf');
    eq((await db.getAll('outbox')).map((e) => e.id), ['k1'], 'conflits : … et la met en file');
    eq(await db.get('sync_conflicts', 'books:k1'), undefined, 'conflits : le conflit est effacé');
    await db.mutate({ puts: { sync_conflicts: [conflit] }, deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    await garderAilleurs(db, conflit);
    eq((await db.get('books', 'k1')).title, 'ailleurs', 'conflits : « Garder celle d’ailleurs » écrit la version du serveur');
    eq([await db.count('outbox'), await db.get('sync_conflicts', 'books:k1')], [0, undefined], 'conflits : … sans remise en file, conflit effacé');
    // Une tombale gardée « d’ailleurs » supprime la fiche localement, et ne la remet pas en file.
    const tombale = { ...conflit, id: 'books:k2', record_id: 'k2', local: { id: 'k2', title: 'ici', updated_at: '2026-10-13T12:00:00Z' }, server: { data: null, updated_at: '2026-10-13T12:30:00Z', deleted_at: '2026-10-13T12:30:00Z' } };
    await db.mutate({ puts: { sync_conflicts: [tombale], books: [tombale.local] }, origin: 'device' });
    await garderAilleurs(db, tombale);
    eq([await db.get('books', 'k2'), await db.count('outbox'), await db.get('sync_conflicts', 'books:k2')], [undefined, 0, undefined], 'conflits : « Garder celle d’ailleurs » sur une tombale supprime ici, sans remise en file');
    // Un conflit venu de l’envoi peut porter local:null (la fiche a été supprimée ici pendant l’aller-retour).
    // « Garder celle d’ici » garde alors la suppression : aucune fiche sans clé n’est écrite dans la base.
    const sansLocale = { ...conflit, id: 'books:k3', record_id: 'k3', local: null };
    await db.mutate({ puts: { sync_conflicts: [sansLocale] }, origin: 'device' });
    ok(await garderIci(db, sansLocale), 'conflits : « Garder celle d’ici » s’applique aussi quand la fiche a été supprimée ici');
    eq([await db.get('books', 'k3'), await db.get('sync_conflicts', 'books:k3')], [undefined, undefined], 'conflits : la fiche reste supprimée ici, et le conflit est effacé');
    const entreeK3 = (await db.getAll('outbox'))[0];
    // Sans updated_at, la tombale repartirait et le serveur la refuserait (motif « updated_at ») : quarantaine.
    eq([entreeK3?.store, entreeK3?.id, entreeK3?.op, !!entreeK3?.updated_at, entreeK3?.payload?.id], ['books', 'k3', 'delete', true, 'k1'], 'conflits : la suppression d’ici repart en file AVEC un updated_at neuf et un payload (sinon le serveur la refuse)');
    ok(entreeK3.updated_at > sansLocale.server.updated_at, 'conflits : l’updated_at de la suppression renvoyée est plus récent que la version du serveur');
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    // Un conflit dont le serveur n’a pas joint sa version : rien n’est inventé, et le conflit reste à trancher.
    const sansServeur = { ...conflit, id: 'books:k4', record_id: 'k4', server: null };
    await db.mutate({ puts: { sync_conflicts: [sansServeur] }, origin: 'device' });
    eq([await garderAilleurs(db, sansServeur), await db.get('books', 'k4'), !!(await db.get('sync_conflicts', 'books:k4'))], [false, undefined, true], 'conflits : sans version du serveur, « Garder celle d’ailleurs » n’invente rien et le conflit reste');
    await db.mutate({ deletes: { sync_conflicts: ['books:k4'] }, origin: 'device' });
    await db.mutate({ puts: { sync_conflicts: [{ ...conflit, id: 'books:vieux', at: '2026-09-01T00:00:00Z' }, { ...conflit, id: 'books:recent', at: '2026-10-12T00:00:00Z' }] }, origin: 'device' });
    eq(await purgerAnciens(db, Date.parse('2026-10-13T00:00:00Z')), 1, 'conflits : plus de 30 jours → retiré');
    eq((await db.getAll('sync_conflicts')).map((c) => c.id), ['books:recent'], 'conflits : le récent reste');
    const vraiMutate = db.mutate.bind(db);
    let transactions = 0;
    db.mutate = (arg) => { transactions += 1; return vraiMutate(arg); };
    let restant;
    try { restant = await purgerAnciens(db, Date.parse('2026-10-13T00:00:00Z')); } finally { db.mutate = vraiMutate; }
    eq([restant, transactions], [0, 0], 'conflits : une purge sans rien à retirer n’ouvre aucune transaction');
  });

  // --- R-L3-26 de bout en bout : une tombale plus ancienne que la fiche locale ne l'efface pas en silence
  await withRepo(async (repo, db) => {
    // Écrite sans capture : la file doit ne porter QUE ce que la réception y remet.
    await db.mutate({ puts: { books: [{ id: 'tb', title: 'Plus récent ici', updated_at: '2026-10-13T12:00:00Z' }] }, origin: 'device' });
    const page = [{ id: 'tb', data: { id: 'tb', title: 'Ailleurs' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: '2026-10-13T11:00:00Z', server_seq: 20 }];
    const tf = creerTransportFactice({ lire: { books: [page, []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq([r.recues, r.supprimees, r.conflits, r.erreur], [0, 0, 1, null], 'R-L3-26 : la tombale plus ancienne n’efface rien et journalise un conflit');
    eq((await db.get('books', 'tb'))?.title, 'Plus récent ici', 'R-L3-26 : la fiche locale, plus récente, est conservée');
    const c = await db.get('sync_conflicts', 'books:tb');
    eq([c.server.data, c.server.updated_at, c.server.deleted_at, c.kind], [null, '2026-10-13T11:00:00Z', '2026-10-13T11:00:00Z', 'donnees'], 'R-L3-26 : le conflit porte server = { data: null, updated_at, deleted_at } — jamais une fiche que le serveur n’a plus');
    eq((await db.getAll('outbox')).map((e) => [e.store, e.id, e.op, e.updated_at]), [['books', 'tb', 'put', '2026-10-13T12:00:00Z']], 'R-L3-26 : … et la fiche locale repart en file (le serveur l’acceptera, elle est plus récente)');
    eq((await db.get('sync_state', 'cursor:books'))?.value, 20, 'R-L3-26 : le curseur avance quand même — la page a bien été traitée');
    // Le geste de la personne : « Garder celle d'ailleurs » sur ce conflit applique la suppression ici.
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    ok(await garderAilleurs(db, c), 'R-L3-26 : « Garder celle d’ailleurs » s’applique à un conflit de tombale');
    eq([await db.get('books', 'tb'), await db.count('outbox'), await db.get('sync_conflicts', 'books:tb')], [undefined, 0, undefined], 'R-L3-26 : … la fiche est supprimée ici, sans remise en file, conflit effacé');
  });

  // --- R-L3-27 : fermer la boucle I4 là où une fiche SALE est déjà en base
  // R61 nettoie à l'écriture (`repo.save`/`saveBatch`) et à la restauration (`applyArchive`), mais une fiche écrite
  // AVANT cette vague est encore sale en base. Son écho propre (le serveur reçoit ce que `lots.js` nettoie) fait un
  // conflit à instants égaux, et « Garder celle d'ici » renvoyait la version SALE : le serveur la renettoyait, le
  // conflit revenait, indéfiniment. Deux portes à fermer : le geste, et une passe unique au démarrage.
  await withRepo(async (repo, db) => {
    // Posée par `db.mutate` d'origine 'device' : hors `repo.save`, donc non nettoyée — et après l'`init()` de la
    // fixture, donc la passe unique est déjà passée. C'est exactement l'état d'un appareil d'avant la vague dont une
    // fiche a échappé à la passe (écrite par un autre chemin, ou restaurée d'une archive plus ancienne).
    await db.mutate({ puts: { books: [{ id: 'bcl', title: 'a\u0000b', updated_at: '2026-10-13T11:00:00Z' }] }, origin: 'device' });
    const page = [{ id: 'bcl', data: { id: 'bcl', title: 'ab', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 30 }];
    const tf = creerTransportFactice({ lire: { books: [page, []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq([r.conflits, r.recues, r.supprimees], [1, 0, 0], 'R-L3-27 : à instant égal, la fiche locale sale et la copie propre du serveur font bien un conflit');
    const conflit = await db.get('sync_conflicts', 'books:bcl');
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    ok(await garderIci(db, conflit), 'R-L3-27 : « Garder celle d’ici » s’applique');
    const relue = await db.get('books', 'bcl');
    eq(relue.title, 'ab', 'R-L3-27 : … et elle écrit une fiche NETTOYÉE (sinon le serveur la renettoie et le conflit revient)');
    const lot = await composerLots(await db.getAll('outbox'), (s, id) => db.get(s, id));
    const element = lot.lots[0].elements.find((e) => e.id === 'bcl');
    eq(element.data, relue, 'R-L3-27 : … donc l’élément renvoyé est IDENTIQUE à la fiche locale — la boucle est fermée');
  });

  // --- R-L3-27 (b) : la passe unique de nettoyage au démarrage
  await withRepo(async (repo, db) => {
    // La fixture a déjà joué init() : la garde est posée. On la retire pour rejouer la migration.
    await db.mutate({ deletes: { sync_state: ['nettoyage_chaines'] }, origin: 'device' });
    await db.mutate({ puts: { books: [{ id: 'vieille', title: 'a\u0000b', notes: ['x\u000by', { z: 't\u001f' }], garde: 'é\n\tÀ', updated_at: '2026-10-01T00:00:00Z' }] }, origin: 'device' });
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    await repo.init();
    const relue = await db.get('books', 'vieille');
    eq([relue.title, relue.notes, relue.garde], ['ab', ['xy', { z: 't' }], 'é\n\tÀ'], 'R-L3-27 : init() nettoie en profondeur les fiches d’avant la vague, accents et sauts de ligne gardés');
    eq(relue.updated_at, '2026-10-01T00:00:00Z', 'R-L3-27 : … SANS toucher à leur updated_at (ce n’est pas une modification : rien ne doit gagner contre le serveur)');
    eq(await db.count('outbox'), 0, 'R-L3-27 : … et rien n’entre en file (origine device : jamais capturée)');
    eq((await db.get('sync_state', 'nettoyage_chaines'))?.value, 1, 'R-L3-27 : la garde de la passe est posée');
    // La garde tient : une fiche sale reposée à la main n'est pas renettoyée, et un démarrage ordinaire n'écrit rien.
    await db.mutate({ puts: { books: [{ id: 'apres', title: 'c\u0007d', updated_at: '2026-10-01T00:00:00Z' }] }, origin: 'device' });
    const vraiMutate = db.mutate.bind(db);
    let transactions = 0;
    db.mutate = (arg) => { transactions += 1; return vraiMutate(arg); };
    try { await repo.init(); } finally { db.mutate = vraiMutate; }
    eq([(await db.get('books', 'apres')).title, transactions], ['c\u0007d', 0], 'R-L3-27 : la passe ne se rejoue pas (garde), et un démarrage ordinaire n’ouvre aucune transaction');
  });

  // --- R-L3-29 de bout en bout : un conflit renvoyé se range tout seul quand le serveur accuse
  await withRepo(async (repo, db) => {
    await db.mutate({ puts: { books: [{ id: 'rv', title: 'Ici plus récent', updated_at: '2026-10-13T12:00:00Z' }] }, origin: 'device' });
    const page = [{ id: 'rv', data: { id: 'rv', title: 'Ailleurs', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 40 }];
    const tf = creerTransportFactice({ lire: { books: [page, []] } });
    eq((await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir()).conflits, 1, 'R-L3-29 : le local plus récent fait un conflit…');
    const c = await db.get('sync_conflicts', 'books:rv');
    eq([c.renvoye, (await db.getAll('outbox')).map((e) => [e.id, e.op])], [true, [['rv', 'put']]], 'R-L3-29 : … journalisé RENVOYÉ, avec son entrée de file');
    // L'envoi part et le serveur accepte (la version d'ici est plus récente) : le conflit n'a plus de raison d'être.
    const tfServeur = creerTransportFactice({ serveur: true });
    const envoi = await createPush({ db, transport: tfServeur, getUserId: () => 'u1' }).envoyer();
    eq([envoi.envoyes, await db.count('sync_conflicts'), await db.count('outbox')], [1, 0, 0], 'R-L3-29 : l’accusé du serveur RANGE le conflit renvoyé — plus rien à trancher, sans geste de la personne');
    // Un conflit ORDINAIRE (instants égaux, contenus différents) n'est PAS rangé par un accusé : il attend la personne.
    await db.mutate({ puts: {
      books: [{ id: 'ord', title: 'Ici', updated_at: '2026-10-13T13:00:00Z' }],
      sync_conflicts: [{ id: 'books:ord', store: 'books', record_id: 'ord', local: { id: 'ord', title: 'Ici' }, server: { data: { id: 'ord', title: 'Ailleurs' }, updated_at: '2026-10-13T13:00:00Z', deleted_at: null }, at: '2026-10-13T13:01:00Z', kind: 'donnees' }],
      outbox: [{ user_id: 'u1', store: 'books', id: 'ord', op: 'put', updated_at: '2026-10-13T13:00:00Z', tries: 0 }],
    }, origin: 'device' });
    const envoi2 = await createPush({ db, transport: tfServeur, getUserId: () => 'u1' }).envoyer();
    eq([envoi2.envoyes, (await db.getAll('sync_conflicts')).map((x) => x.id)], [1, ['books:ord']], 'R-L3-29 : un conflit ORDINAIRE survit à l’accusé — il attend la personne');
  });

  // --- Cycle complet entre deux appareils, arbitré comme le serveur (R-L3-21)
  // Le factice en mode `serveur` applique les règles de `app.sync_push` : c'est le seul moyen d'éprouver le contrat
  // client ↔ serveur avant la première passe réelle. Appareil A = la base de `withRepo` (repo + capture) ;
  // appareil B = une seconde base temporaire, qui ne fait que recevoir.
  try {
    await withRepo(async (repo, db) => {
      const tf = creerTransportFactice({ serveur: true });
      const pousser = () => createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      await withDatabase(async (dbB) => {
        const recevoirB = () => createPull({ db: dbB, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();

        // 1. Une fiche écrite sur A arrive sur B.
        await repo.save('books', { id: 'cyc1', title: 'Un' });
        eq([(await pousser()).envoyes, await db.count('outbox')], [1, 0], 'cycle : la fiche neuve est acceptée par le serveur, la file se vide');
        eq((await recevoirB()).recues, 1, 'cycle : B reçoit la fiche');
        eq((await dbB.get('books', 'cyc1'))?.title, 'Un', 'cycle : B porte la fiche');

        // 2. Le miroir : A MODIFIE une fiche déjà synchronisée → acceptée (son instant est plus récent), pas conflit.
        await repo.save('books', { id: 'cyc1', title: 'Deux' });
        const rModif = await pousser();
        eq([rModif.envoyes, rModif.conflits, rModif.quarantaine], [1, 0, 0], 'cycle : une modification d’une fiche synchronisée est ACCEPTÉE (jamais un conflit)');
        eq([(await recevoirB()).recues, (await dbB.get('books', 'cyc1'))?.title], [1, 'Deux'], 'cycle : B reçoit la modification');

        // 3. C1 : A SUPPRIME une fiche déjà synchronisée → la tombale doit être acceptée et se propager.
        await repo.remove('books', 'cyc1');
        const rSupp = await pousser();
        eq([rSupp.envoyes, rSupp.conflits, rSupp.quarantaine], [1, 0, 0], 'C1 : la tombale d’une fiche déjà synchronisée est ACCEPTÉE (aucun conflit, aucune quarantaine)');
        eq([await db.count('outbox'), await db.count('sync_conflicts')], [0, 0], 'C1 : la file est vide et aucun conflit n’est journalisé');
        ok(tf.ligne('books', 'cyc1')?.deleted_at, 'C1 : le serveur porte bien la tombale (deleted_at posé)');
        const rB = await recevoirB();
        eq([rB.supprimees, rB.conflits, rB.erreur], [1, 0, null], 'C1 : B applique la suppression, sans conflit');
        eq(await dbB.get('books', 'cyc1'), undefined, 'C1 : la fiche est partie de B — la suppression s’est propagée');

        // 4. Rejouer la même tombale ne change rien (réessai idempotent : même instant, déjà supprimée).
        const entree = { user_id: 'u1', store: 'books', id: 'cyc1', op: 'delete', updated_at: tf.ligne('books', 'cyc1').updated_at, payload: { id: 'cyc1', title: 'Deux' }, tries: 0 };
        await db.mutate({ puts: { outbox: [entree] }, origin: 'device' });
        const seqServeur = tf.ligne('books', 'cyc1').server_seq;
        const rRejeu = await pousser();
        eq([rRejeu.envoyes, rRejeu.conflits, tf.ligne('books', 'cyc1').server_seq], [1, 0, seqServeur], 'C1 : la même tombale rejouée est acceptée sans rien réécrire (server_seq inchangé)');
      });
    });
  } finally { setClockOffset(0); }

  // --- Moteur (spec § 5.3, § 5.5, § 4.2) : ordre envoi initial → envoi → réception, un seul vol, état, déclencheurs
  const { createMoteur } = await import('../src/sync/moteur.js');
  // Fenêtre et bus muets : le moteur s’abonne, et c’est le test qui tient les déclencheurs.
  const fenetreMuette = () => ({ addEventListener() {}, removeEventListener() {}, document: { visibilityState: 'visible' } });
  const busMuet = { on: () => () => {} };
  // Toutes les tables marquées « fait » : la file ne porte alors QUE ce que le test vient d’écrire. L’envoi initial
  // des références amorcées est couvert plus haut ; ici il ne ferait que brouiller les comptes d’appels.
  const toutDejaEnvoye = (db) => db.mutate({ puts: { sync_state: SYNC_STORES.map((t) => ({ key: `backfill:${t}`, value: 'fait' })) }, origin: 'device' });
  // Chaque réponse du factice applique une heure serveur : le décalage global est remis à 0 dans tous les cas.
  try {
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { books: [{ id: 'm1', title: 'Avant', updated_at: '2026-10-01T00:00:00Z' }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: { books: [[{ id: 'm9', data: { id: 'm9', title: 'Reçu', updated_at: '2026-10-13T00:00:00Z' }, updated_at: '2026-10-13T00:00:00Z', deleted_at: null, server_seq: 1 }], []] } });
      const etats = [];
      const ecouteurs = {};
      const fenetre = { addEventListener: (ev, fn) => { ecouteurs[ev] = fn; }, removeEventListener: (ev) => { delete ecouteurs[ev]; }, document: { visibilityState: 'visible' } };
      const abonnes = {};
      const bus = { on: (ev, fn) => { abonnes[ev] = fn; return () => delete abonnes[ev]; } };
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre, bus, delaiRegroupementMs: 10 });
      moteur.onEtat((e) => etats.push({ ...e }));
      const e0 = moteur.etat();
      eq([e0.enCours, e0.aEnvoyer, e0.dernierEchange], [false, 0, null], 'moteur : état initial');
      const fin = await moteur.executer('test');
      eq([fin.enCours, fin.phase, fin.aEnvoyer, fin.conflits, fin.attenteConnexion], [false, null, 0, 0, false], 'moteur : après une passe complète, plus rien à envoyer');
      ok(fin.dernierEchange !== null, 'moteur : « Dernier échange » posé après un appel réussi');
      eq((await db.get('sync_state', 'last_exchange_at'))?.value, fin.dernierEchange, 'moteur : dernier échange persisté');
      ok(Object.isFrozen(fin), 'moteur : l’état sort figé — un abonné garde l’objet reçu sans le voir changer sous lui');
      const ordre = tf.journal.map((a) => a.appel);
      ok(ordre.indexOf('pousser') < ordre.indexOf('lire'), 'moteur : envoi (initial inclus) AVANT réception');
      eq((await db.get('books', 'm9'))?.title, 'Reçu', 'moteur : la réception a écrit la fiche');
      ok(etats.some((e) => e.phase === 'envoi_initial') && etats.some((e) => e.phase === 'reception'), 'moteur : les phases sont annoncées');
      // Un seul vol : deux exécutions concurrentes → une passe, la seconde REJOINT la première (la même promesse).
      // m5 : l'assertion est ÉPINGLÉE sur le nombre exact d'appels — une borne molle (« au plus 25 ») tiendrait
      // encore avec deux passes courtes, donc elle ne prouvait pas ce qu'elle annonçait.
      const avant = tf.journal.length;
      const p1 = moteur.executer('a');
      const p2 = moteur.executer('b');
      ok(p1 === p2, 'moteur : un appel pendant un vol rend la MÊME promesse (pas une seconde passe)');
      await Promise.all([p1, p2]);
      const depuis = tf.journal.slice(avant);
      eq(depuis.filter((a) => a.appel === 'lire' && a.table === 'books').length, 1, 'm5 : exécutions concurrentes → UN seul vol (la table books est lue exactement une fois, pas deux)');
      eq(depuis.filter((a) => a.appel === 'pousser').length, 0, 'm5 : … et la file étant vide, aucun envoi n’est tenté');
      // Déclencheurs : écriture regroupée, online, premier plan.
      moteur.demarrer();
      ok(['online', 'visibilitychange'].every((ev) => ecouteurs[ev]) && abonnes.change, 'moteur : écoute online, visibilitychange et le bus « change »');
      const n0 = tf.journal.length;
      await repo.save('books', { id: 'm2', title: 'Nouveau' });
      abonnes.change({ store: 'books' }); abonnes.change({ store: 'books' });
      await new Promise((r) => setTimeout(r, 60));
      ok(tf.journal.filter((a, i) => i >= n0 && a.appel === 'pousser').length === 1, 'moteur : deux écritures rapprochées → un seul envoi (regroupement)');
      const fini = moteur.arreter();
      eq(Object.keys(ecouteurs).length, 0, 'moteur : arrêt → plus d’écoute');
      // L’arrêt rend la passe en vol : la base temporaire ne se referme pas sous une passe encore en cours.
      await fini;
    });

    // R-L3-24 : les compteurs du moteur comptent le MÊME sous-ensemble que l'envoi — ce qui va partir, pas plus.
    // Une entrée d'un autre compte afficherait « À envoyer : 1 » et une pastille pour un envoi qui n'aura jamais lieu.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await db.mutate({ puts: { outbox: [{ user_id: 'autre', store: 'books', id: 'sien', op: 'put', updated_at: '2026-10-12T10:00:00Z', tries: 0 }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: {} });
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
      const fin = await moteur.executer('test');
      eq([fin.aEnvoyer, fin.enQuarantaine, await db.count('outbox')], [0, 0, 1], 'R-L3-24 : le moteur ne compte pas l’entrée d’un autre compte (elle reste en file, intacte)');
      await moteur.arreter();
    });

    // m2 : une reprise programmée par une passe encore EN VOL ne doit pas survivre à `arreter()`. L'arrêt annule
    // bien la minuterie existante à cet instant — mais `passe()` pose la sienne APRÈS, quand l'envoi annonce son
    // recul, et plus personne ne l'annulait. Après « Effacer les données de cet appareil » (arrêt → clearDevice),
    // cet `executer('reprise')` tardif lançait une passe sur une base vidée : réception complète d'une
    // bibliothèque sur un appareil qu'on vient d'effacer, si la déconnexion avait échoué.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'rep', title: 'x' });
      let lacher = null;
      const enVol = new Promise((resolve) => { lacher = resolve; });
      const transport = {
        async pousser() { await enVol; return { reponse: null, erreur: { type: 'reseau', status: 0, message: 'x' } }; },
        async lire() { return { lignes: [], erreur: null }; },
      };
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport, fenetre: fenetreMuette(), bus: busMuet });
      const vol = moteur.executer('t');
      const arret = moteur.arreter(); // l'arrêt tombe PENDANT le vol
      const vraiSetTimeout = globalThis.setTimeout;
      const vraiConsoleM2 = console.error;
      const minuteries = [];
      globalThis.setTimeout = (fn, ms) => { minuteries.push(ms); return vraiSetTimeout(fn, ms); };
      console.error = () => {}; // l'échec réseau est journalisé par un code : la page reste à zéro erreur
      try {
        lacher();
        await vol;
        await arret;
      } finally { globalThis.setTimeout = vraiSetTimeout; console.error = vraiConsoleM2; }
      // Seules les minuteries d'au moins une seconde sont des reculs ; les `setTimeout(…, 0)` sont les relectures
      // de réglages demandées par le bus (R-L3-17), qui n'ont rien à voir avec une reprise.
      eq(minuteries.filter((ms) => ms >= 1000), [], 'm2 : une passe encore en vol ne programme plus de reprise après arreter() (plus de passe sur une base vidée)');
    });

    // Déclencheurs : seul un retour à « visible » relance une passe ; le retour du réseau en relance une.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const tf = creerTransportFactice({ lire: {} });
      const ecouteurs = {};
      let abonnements = 0;
      const fenetre = { addEventListener: (ev, fn) => { abonnements += 1; ecouteurs[ev] = fn; }, removeEventListener: (ev) => { delete ecouteurs[ev]; }, document: { visibilityState: 'hidden' } };
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre, bus: busMuet });
      await moteur.demarrer();
      await moteur.demarrer();
      eq(abonnements, 2, 'moteur : demarrer() deux fois → un seul jeu d’écouteurs (online + visibilitychange)');
      const n0 = tf.journal.length;
      ok(n0 > 0, 'moteur : demarrer() charge l’état puis lance une première passe');
      await ecouteurs.visibilitychange();
      eq(tf.journal.length, n0, 'moteur : passer en arrière-plan ne déclenche aucune passe');
      fenetre.document.visibilityState = 'visible';
      await ecouteurs.visibilitychange();
      ok(tf.journal.length > n0, 'moteur : revenir au premier plan déclenche une passe');
      const n1 = tf.journal.length;
      await ecouteurs.online();
      ok(tf.journal.length > n1, 'moteur : le retour du réseau déclenche une passe');
      await moteur.arreter();
    });

    // Sans compte, puis pause de quota (spec § 5.3, R-L3-14, R-L3-15) : l’ENVOI est suspendu, la réception continue.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'q1', title: 'x' });
      // R-L3-24 : une écriture faite SANS compte porte `user_id: null` (c'est ce que rend la capture) — la fixture,
      // elle, capture toujours sous « u1 ». L'entrée est remise au nom qu'elle aurait vraiment, sans quoi ce bloc
      // éprouverait un arrangement qui n'existe nulle part : une file au nom d'un compte et un moteur sans compte.
      await db.mutate({ puts: { outbox: (await db.getAll('outbox')).map((e) => ({ ...e, user_id: null })) }, origin: 'device' });
      const tfSans = creerTransportFactice({ lire: {} });
      const sansCompte = createMoteur({ db, getUserId: () => null, isActivitySynced: () => false, transport: tfSans, fenetre: fenetreMuette(), bus: busMuet });
      const eSans = await sansCompte.executer('t');
      eq([tfSans.journal.length, eSans.aEnvoyer, eSans.enCours], [0, 1, false], 'moteur : sans compte, aucun appel réseau et la file reste comptée');
      // R-L3-14 (a) : la pause est écrite DIRECTEMENT dans sync_state, et aucun charger() ne la lit — c’est le cas
      // d’un autre onglet, d’un « online » arrivé pendant le chargement, ou d’un executer() sans demarrer().
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: '2026-10-13T00:00:00Z' } }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: { books: [[{ id: 'qr', data: { id: 'qr', title: 'Reçu en pause', updated_at: '2026-10-13T00:00:00Z' }, updated_at: '2026-10-13T00:00:00Z', deleted_at: null, server_seq: 1 }], []] } });
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
      const ePause = await moteur.executer('t');
      ok(!tf.journal.some((a) => a.appel === 'pousser'), 'moteur (R-L3-14) : pause relue dans sync_state → aucun envoi, même sans charger()');
      ok(tf.journal.some((a) => a.appel === 'lire'), 'moteur (R-L3-15) : en pause de quota, la réception continue — lire ne consomme pas d’espace');
      eq([(await db.get('books', 'qr'))?.title, ePause.pause?.raison, ePause.aEnvoyer], ['Reçu en pause', 'quota', 1], 'moteur (R-L3-15) : ce qui vient des autres appareils est écrit, et la file reste entière et comptée');
      ok(Object.isFrozen(ePause.pause), 'moteur : la pause rendue par l’état est figée elle aussi');
      ok(ePause.dernierEchange !== null, 'moteur (R-L3-15) : une réception aboutie date l’échange, même en pause');
      await moteur.envoyerMaintenant();
      eq([await db.get('sync_state', 'pause'), moteur.etat().pause], [undefined, null], 'moteur : « Envoyer maintenant » retire la pause de sync_state');
      ok(tf.journal.some((a) => a.appel === 'pousser'), 'moteur : … et l’envoi part alors pour de vrai');
      // « Envoyer maintenant » pendant un vol DÉJÀ court-circuité par la pause : le rejoindre ne ferait rien partir,
      // donc le geste attend ce vol et enchaîne une passe neuve, pause levée.
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: '2026-10-13T00:00:00Z' } }] }, origin: 'device' });
      await repo.save('books', { id: 'q2', title: 'y' });
      await Promise.all([moteur.executer('online'), moteur.envoyerMaintenant()]);
      eq([await db.get('sync_state', 'pause'), await db.count('outbox')], [undefined, 0], 'moteur : « Envoyer maintenant » pendant un vol en pause → la pause tombe et la file part pour de vrai');
      await moteur.arreter();
    });

    // R-L3-14 (c) : un décalage mesuré SOUS le seuil est quand même gardé — c’est lui qui corrige syncNow() au
    // prochain démarrage, avant le premier appel. Sans avertir la personne : 2 min ne se voient pas à l’usage.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'd1', title: 'x' });
      const base = Date.parse('2026-10-13T00:00:00Z');
      const tf = creerTransportFactice({ pousser: [{ reponse: { server_time: new Date(base + 2 * 60000).toISOString(), accepted: [{ store: 'books', id: 'd1' }], adjusted: [], rejected: [] } }], lire: {} });
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet, maintenant: () => base });
      const e = await moteur.executer('t');
      eq([(await db.get('sync_state', 'clock_offset_ms'))?.value, await db.get('sync_state', 'clock_warned_at'), e.horloge], [120000, undefined, null], 'moteur (R-L3-14) : un décalage de 2 min est persisté, sans avertissement');
      setClockOffset(0);
      const m2 = createMoteur({ db, getUserId: () => null, isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet, maintenant: () => base });
      await m2.demarrer();
      eq([getClockOffset(), m2.etat().horloge], [120000, null], 'moteur (R-L3-14) : … et relu au démarrage, toujours sans avertissement');
      await m2.arreter();
    });

    // Un envoi en échec réseau : la réception n’est PAS tentée, la file reste entière, une reprise est programmée.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'n1', title: 'x' });
      const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'reseau', status: 0, message: 'x' } }], lire: {} });
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
      const vraiConsole = console.error;
      console.error = () => {};
      let e;
      try { e = await moteur.executer('t'); } finally { console.error = vraiConsole; }
      eq([e.derniereErreur?.type, e.attenteConnexion, e.aEnvoyer], ['reseau', false, 1], 'moteur : envoi en échec réseau → erreur portée, file entière, aucune attente de connexion');
      ok(!tf.journal.some((a) => a.appel === 'lire'), 'moteur : un envoi en échec n’enchaîne JAMAIS sur la réception');
      eq(e.dernierEchange, null, 'moteur : un appel en échec ne date aucun échange');
      // La reprise programmée (2 s) est annulée par l’arrêt : rien ne tourne après la fermeture de la base.
      await moteur.arreter();
    });

    // I5 : une passe qui n’aboutit à AUCUN appel réussi ne date aucun échange — même sans erreur à l’envoi.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      // File vide : l’envoi ne fait aucun appel. La réception échoue dès sa première table (recipe_versions, R-L3-12).
      const tf = creerTransportFactice({ lire: { recipe_versions: [{ erreur: { type: 'reseau', status: 0, message: 'x' } }] } });
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
      const vraiConsole = console.error;
      console.error = () => {};
      let e;
      try { e = await moteur.executer('t'); } finally { console.error = vraiConsole; }
      eq([e.dernierEchange, await db.get('sync_state', 'last_exchange_at')], [null, undefined], 'moteur (I5) : aucun appel réussi → aucun « Dernier échange » daté');
      eq(e.derniereErreur?.type, 'reseau', 'moteur : l’erreur classée de la réception est portée par l’état');
      eq(tf.journal.map((a) => a.appel), ['lire'], 'moteur : file vide → aucun appel d’envoi, et la réception s’arrête à la première erreur');
      await moteur.arreter();
    });

    // Horloge (spec § 5.3) : au-delà de 5 min, avertissement UNIQUE, décalage persistant, relu au démarrage.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'h1', title: 'x' });
      // `maintenant()` est injecté dans le passé : le server_time scripté reste lui aussi dans le passé réel, donc le
      // plancher de clock.js n’est jamais poussé dans le futur. L’écart mesuré vaut 11 min dans les deux passes.
      const base = Date.parse('2026-10-13T00:00:00Z');
      let ms = base;
      const accuse = (t, id) => ({ reponse: { server_time: new Date(t + 11 * 60000).toISOString(), accepted: [{ store: 'books', id }], adjusted: [], rejected: [] } });
      const tf = creerTransportFactice({ pousser: [accuse(base, 'h1'), accuse(base + 60000, 'h2')], lire: {} });
      const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet, maintenant: () => ms });
      const e = await moteur.executer('t');
      eq(e.horloge?.minutes, 11, 'moteur : horloge fausse de 11 min → avertissement porté par l’état');
      const marque = (await db.get('sync_state', 'clock_warned_at'))?.value;
      eq(typeof marque, 'string', 'moteur : avertissement unique mémorisé');
      eq((await db.get('sync_state', 'clock_offset_ms'))?.value, 11 * 60000, 'moteur : le décalage mesuré est persisté');
      ms = base + 60000;
      await repo.save('books', { id: 'h2', title: 'y' });
      const e2 = await moteur.executer('t');
      eq(e2.horloge?.minutes, 11, 'moteur : l’avertissement reste affiché, pas répété');
      eq((await db.get('sync_state', 'clock_warned_at'))?.value, marque, 'moteur : … et il n’est pas réhorodaté à chaque passe');
      // Au démarrage, le décalage mesuré est relu : l’horloge reste corrigée sans attendre un premier appel.
      setClockOffset(0);
      const m2 = createMoteur({ db, getUserId: () => null, isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet, maintenant: () => ms });
      await m2.demarrer();
      eq(getClockOffset(), 11 * 60000, 'moteur : charger() relit clock_offset_ms et réapplique le décalage');
      eq(m2.etat().horloge?.minutes, 11, 'moteur : … et l’avertissement déjà donné reste affiché au démarrage');
      await m2.arreter();
    });

    // R-L3-14 (b) : executer() ne REJETTE jamais. Réglages et la pastille appellent sans filet ; une base devenue
    // illisible doit rendre un état, pas une promesse rejetée (et surtout pas un rejet non traité au démarrage).
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'z1', title: 'x' });
      const tf = creerTransportFactice({ lire: {} });
      // Retour court (sans compte) : le compte de la file est lu HORS du try de la passe — c’est le chemin qui
      // rejetait. Puis la même panne avec un compte : la passe va au bout et nomme l’incident.
      const sansCompte = createMoteur({ db, getUserId: () => null, isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
      const avecCompte = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
      const vraiConsole = console.error;
      let p1; let p2; let eCourt; let eLongue;
      try {
        db.getAll = () => { throw new Error('base illisible'); };
        console.error = () => {};
        p1 = sansCompte.executer('t');
        p2 = sansCompte.executer('t');
        eCourt = await p1;
        await p2;
        eLongue = await avecCompte.executer('t');
      } finally { delete db.getAll; console.error = vraiConsole; }
      ok(p1 === p2, 'moteur (R-L3-14) : le vol reste unique même quand la lecture jette');
      eq([typeof eCourt, eCourt?.enCours], ['object', false], 'moteur (R-L3-14) : une lecture qui jette dans un retour court → executer() résout sur un état');
      eq([eLongue.enCours, eLongue.derniereErreur?.type], [false, 'inconnu'], 'moteur (R-L3-14) : la même panne pendant la passe → erreur « inconnu » portée, passe terminée');
      eq(tf.journal.length, 0, 'moteur (R-L3-14) : … et rien n’a été tenté sur le réseau');
    });
  } finally { setClockOffset(0); }

  // --- Réglages L3 (spec § 4.2) : dernier échange, quarantaine, conflits, Envoyer maintenant, progression, pause
  // Le modèle reste pur : il reçoit l'état du moteur, les entrées en quarantaine et les conflits, et rend ce que la
  // section dit et ce qu'elle offre. Rien de L3 n'apparaît hors de l'état « connectée + garde ok » — avant lui le
  // moteur n'existe pas — et rien du tout sans moteur : c'est ce qui garde les tests L2 vrais mot pour mot.
  const reglages = await import('../src/ui/settings.js');
  const { syncSectionModel, syncSectionL3 } = reglages;
  const base = { available: true, user: { id: 'u', email: 'x@exemple.invalid' }, guard: { ok: true }, pending: 3 };
  const etatMoteur = (sur = {}) => ({ enCours: false, phase: null, progression: null, dernierEchange: null, aEnvoyer: 3, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: false, horloge: null, derniereErreur: null, ...sur });
  const fileQuarantaine = [
    { seq: 4, store: 'books', id: 'b4', op: 'put', last_error: 'taille', quarantined_at: '2026-10-13T20:00:00Z' },
    { seq: 5, store: 'recipes', id: 'r5', op: 'put', last_error: 'forme', quarantined_at: '2026-10-13T20:00:00Z' },
  ];
  const unConflit = { id: 'books:k1', store: 'books', record_id: 'k1', local: { title: 'Ici', updated_at: '2026-10-13T12:00:00Z' }, server: { data: { title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z' }, at: '2026-10-13T12:01:00Z', kind: 'donnees' };

  const m1 = syncSectionModel({ ...base, moteur: etatMoteur({ dernierEchange: '2026-10-13T20:05:00Z', enQuarantaine: 2, conflits: 1 }), quarantaine: fileQuarantaine, conflits: [unConflit] });
  ok(m1.lines.some((l) => l.startsWith('Dernier échange')), 'réglages L3 : « Dernier échange : <heure> »');
  ok(m1.lines.includes('En quarantaine : 2') && m1.lines.includes('Conflits : 1'), 'réglages L3 : quarantaine et conflits comptés');
  ok(m1.lines.includes('À envoyer : 3'), 'réglages L3 : « À envoyer » reste la file entière, jamais additionnée à la quarantaine');
  ok(m1.buttons.some((b) => b.action === 'envoyerMaintenant'), 'réglages L3 : « Envoyer maintenant » offert quand connecté');
  eq(m1.quarantaine.map((q) => [q.seq, q.motif]), [[4, 'Fiche trop grosse (plus de 512 Ko)'], [5, 'Fiche mal formée']], 'réglages L3 : chaque entrée en quarantaine, avec son motif en clair');
  ok(m1.quarantaine[0].libelle.includes('b4') && m1.quarantaine[0].libelle.includes('books'), 'réglages L3 : la fiche est nommée');
  eq(m1.conflits.length, 1, 'réglages L3 : chaque conflit listé');
  ok(m1.conflits[0].libelle.includes('Ici'), 'réglages L3 : le conflit nomme la fiche');
  ok(!!m1.conflits[0].dateIci && !!m1.conflits[0].dateAilleurs, 'réglages L3 : les deux versions du conflit sont datées');

  // Vocabulaire des motifs (R9) : les jetons ASCII du serveur ne sortent jamais du modèle.
  const jetons = ['taille', 'updated_at', 'cle', 'forme', 'refus', 'conflit'];
  const motifs = syncSectionModel({ ...base, moteur: etatMoteur({ enQuarantaine: 6 }), quarantaine: jetons.map((code, i) => ({ seq: i, store: 'books', id: 'b' + i, last_error: code })) }).quarantaine.map((q) => q.motif);
  eq(motifs, ['Fiche trop grosse (plus de 512 Ko)', 'Fiche sans date', 'Clé incohérente', 'Fiche mal formée', 'Refusée par le serveur', 'Envoi refusé'],
    'réglages L3 : chaque jeton du serveur devient une phrase, et un jeton inattendu tombe sur « Envoi refusé »');
  ok(!motifs.some((m) => jetons.includes(m)), 'réglages L3 : aucun jeton ASCII ne sort du modèle');
  eq(syncSectionModel({ ...base, moteur: etatMoteur({ enQuarantaine: 1 }), quarantaine: [{ seq: 9, store: 'books', id: 'b9' }] }).quarantaine[0].motif,
    'Envoi refusé', 'réglages L3 : une entrée sans motif enregistré est dite refusée, sans rien inventer');
  eq(syncSectionModel({ ...base, moteur: etatMoteur({ enQuarantaine: 1 }), quarantaine: [{ seq: 1, store: 'files', id: 'f'.repeat(64), last_error: 'taille' }] }).quarantaine[0].libelle,
    'files · ' + 'f'.repeat(12) + '…', 'réglages L3 : un identifiant long est tronqué à 12 caractères, et la coupe se voit');

  const m2 = syncSectionModel({ ...base, moteur: etatMoteur({ enCours: true, phase: 'envoi_initial', progression: { table: 'recipes', n: 8, total: 24 } }) });
  eq(m2.progression, 'Envoi initial : recipes 8/24', 'réglages L3 : progression de l’envoi initial');
  const m3 = syncSectionModel({ ...base, moteur: etatMoteur({ enCours: true, phase: 'reception', progression: { table: 'books', n: 1, total: 24 } }) });
  eq(m3.progression, 'Réception : books 1/24', 'réglages L3 : progression de la réception');
  eq(syncSectionModel({ ...base, moteur: etatMoteur({ enCours: false, phase: 'reception', progression: { table: 'books', n: 1, total: 24 } }) }).progression,
    null, 'réglages L3 : une passe terminée n’affiche plus de progression');
  const m4 = syncSectionModel({ ...base, moteur: etatMoteur({ pause: { raison: 'quota', at: 't' }, horloge: { minutes: 12 } }) });
  ok(m4.pause && m4.pause.includes('1 Go'), 'réglages L3 : pause quota nommée (rien n’est perdu)');
  ok(m4.lines.some((l) => l.includes('12')), 'réglages L3 : avertissement d’horloge avec les minutes');
  eq(syncSectionModel({ ...base, moteur: etatMoteur({ pause: { raison: 'autre', at: 't' } }) }).pause, null, 'réglages L3 : seule la pause de quota a une phrase');
  const m5 = syncSectionModel({ ...base, moteur: etatMoteur({ attenteConnexion: true }) });
  ok(m5.lines.some((l) => l.includes('En attente de connexion')), 'réglages L3 : 401 → « En attente de connexion »');
  eq(syncSectionModel({ ...base, moteur: etatMoteur() }).lines.filter((l) => l.includes('En attente de connexion')), [], 'réglages L3 : … et rien de tel sans l’événement');
  ok(syncSectionModel({ ...base, moteur: etatMoteur() }).lines.includes('Aucun échange encore.'), 'réglages L3 : sans échange réel, aucune heure inventée');

  // Dates du conflit : chacune porte la sienne, et la nature du conflit est conservée.
  const mDates = syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [{ ...unConflit, kind: 'version', server: { data: { title: 'Ailleurs' }, updated_at: '2026-10-14T18:45:00Z' } }] });
  ok(mDates.conflits[0].dateIci !== mDates.conflits[0].dateAilleurs, 'réglages L3 : chaque version est datée de SA date, jamais celle de l’autre');
  eq(mDates.conflits[0].kind, 'version', 'réglages L3 : la nature du conflit est conservée');
  eq(syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [{ id: 'books:k9', store: 'books', record_id: 'k9', local: null, server: { data: {}, updated_at: '2026-10-13T12:00:00Z' }, at: '2026-10-13T12:00:00Z', kind: 'donnees' }] }).conflits[0].libelle,
    'books · k9', 'réglages L3 : sans version locale (fiche supprimée ici), le conflit se nomme par sa clé');

  // R-L3-29 : un conflit DÉJÀ RENVOYÉ n'est pas à trancher — la version d'ici est partie, le serveur l'acceptera.
  // Lui offrir « Garder celle d'ici » (qui réhorodate et renvoie encore) ou « Garder celle d'ailleurs » (qui écrase
  // la version qu'on vient d'envoyer par celle, plus ancienne, qui a perdu) n'a aucun sens : le seul geste est de
  // ranger l'entrée de journal. La ligne dit donc CE QUI S'EST PASSÉ, pas une question.
  const mRenvoye = syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [{ ...unConflit, renvoye: true }] });
  eq(mRenvoye.conflits[0].renvoye, true, 'R-L3-29 : le modèle porte « renvoyé » tel que la réception l’a journalisé');
  eq(syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [unConflit] }).conflits[0].renvoye, false, 'R-L3-29 : … et faux pour un conflit ordinaire (jamais deviné)');

  // Sans moteur, le modèle est EXACTEMENT celui de L2 : pas une clé de plus, sinon les tests L2 deviendraient faux.
  const m6 = syncSectionModel({ ...base, moteur: null });
  eq(m6, { title: 'Synchronisation', lines: ['Connectée : x@exemple.invalid', 'À envoyer : 3'], buttons: [{ action: 'signOut', label: 'Se déconnecter', tone: '' }] },
    'réglages L3 : sans moteur (L2), le modèle est mot pour mot celui de L2');
  ok(!m6.buttons.some((b) => b.action === 'envoyerMaintenant') && (m6.progression ?? null) === null, 'réglages L3 : sans moteur, ni « Envoyer maintenant » ni progression');
  const m7 = syncSectionModel({ available: true, guard: { ok: false, message: 'Cet appareil ne peut pas vérifier le compte.' }, moteur: etatMoteur({ enQuarantaine: 2 }), quarantaine: fileQuarantaine, conflits: [unConflit] });
  eq([m7.lines, m7.buttons.map((b) => b.action), m7.progression ?? null, m7.quarantaine ?? null],
    [['Cet appareil ne peut pas vérifier le compte.'], ['signOut', 'changeAccount'], null, null],
    'réglages L3 : garde refusée → aucun chiffre et aucune liste de L3, le compte n’est pas établi');
  eq(syncSectionModel({ available: true, enAttente: true, moteur: etatMoteur({ enQuarantaine: 2 }) }).progression ?? null, null, 'réglages L3 : pendant la vérification du compte, rien de L3 non plus');

  // --- Rendu de l'ensemble L3 : ce que la personne lit et touche. La suite tourne dans un navigateur, donc le
  // rendu est éprouvé pour de vrai — sans cela un modèle juste pourrait n'être affiché nulle part.
  {
    const vus = [];
    const boite = document.createElement('div');
    for (const n of syncSectionL3(m1, { reessayer: (seq) => vus.push(['reessayer', seq]), abandonner: (seq) => vus.push(['abandonner', seq]), garderIci: (id) => vus.push(['garderIci', id]), garderAilleurs: (id) => vus.push(['garderAilleurs', id]) })) boite.append(n);
    const texte = boite.textContent;
    ok(texte.includes('books · b4') && texte.includes('Fiche trop grosse (plus de 512 Ko)'), 'rendu L3 : la quarantaine nomme la fiche et dit le motif en clair');
    const mots = texte.split(/[^0-9A-Za-zÀ-ÿ_]+/);
    ok(!jetons.some((j) => mots.includes(j)), 'rendu L3 : aucun jeton brut du serveur à l’écran');
    const libelles = [...boite.querySelectorAll('button')].map((b) => b.textContent);
    ok(libelles.includes('Réessayer') && libelles.includes('Abandonner cet envoi'), 'rendu L3 : les deux gestes de la quarantaine');
    ok(libelles.some((l) => l.startsWith('Garder celle d’ici (')) && libelles.includes('Garder celle d’ailleurs'), 'rendu L3 : les deux issues du conflit, la date portée par celle d’ici');
    ok(texte.includes('version d’ici du') && texte.includes('version d’ailleurs du'), 'rendu L3 : le conflit dit les deux dates en une phrase');
    for (const b of boite.querySelectorAll('button')) b.click();
    eq(vus, [['reessayer', 4], ['abandonner', 4], ['reessayer', 5], ['abandonner', 5], ['garderIci', 'books:k1'], ['garderAilleurs', 'books:k1']],
      'rendu L3 : chaque bouton appelle son geste avec la bonne clé');
  }
  // R-L3-29, rendu : un conflit renvoyé dit ce qui s'est passé et n'offre QUE « Ignorer ».
  {
    const vus = [];
    const boite = document.createElement('div');
    const gestes = { garderIci: (id) => vus.push(['garderIci', id]), garderAilleurs: (id) => vus.push(['garderAilleurs', id]), ignorerConflit: (id) => vus.push(['ignorerConflit', id]) };
    for (const n of syncSectionL3(mRenvoye, gestes)) boite.append(n);
    const libelles = [...boite.querySelectorAll('button')].map((b) => b.textContent);
    eq(libelles, ['Ignorer'], 'R-L3-29 : un conflit renvoyé n’offre QUE « Ignorer » — ni « Garder celle d’ici », ni « Garder celle d’ailleurs »');
    // I5 : la ligne ne dit pas plus que ce qui s'est produit. « renvoyée » affirmait un accusé que personne n'a
    // encore vu — et si l'envoi tombe en quarantaine, il n'y aura pas d'accusé du tout (la quarantaine nomme la
    // fiche à côté, avec ses propres gestes). « en cours de renvoi » est exactement l'état : l'entrée est en file.
    ok(boite.textContent.includes('Version d’ici en cours de renvoi au serveur.'), 'R-L3-29 (I5) : la ligne dit l’état réel — un renvoi EN COURS, jamais un accusé que personne n’a vu');
    ok(!boite.textContent.includes('renvoyée au serveur'), 'R-L3-29 (I5) : … et elle n’affirme plus un envoi abouti');
    for (const b of boite.querySelectorAll('button')) b.click();
    eq(vus, [['ignorerConflit', 'books:k1']], 'R-L3-29 : « Ignorer » appelle son geste avec la clé du conflit');
    // R-L3-30 : renvoyé ET supprimé ailleurs — l'issue de R-L3-26 doit EXISTER dans l'interface, sinon la décision
    // qu'on a donnée à la personne n'est nulle part et « Ignorer » annule la suppression sans un mot.
    const tombale = document.createElement('div');
    const mTombale = syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [{ ...unConflit, renvoye: true, server: { data: null, updated_at: '2026-10-13T11:00:00Z', deleted_at: '2026-10-13T11:00:00Z' } }] });
    eq([mTombale.conflits[0].renvoye, mTombale.conflits[0].suppressionAilleurs], [true, true], 'R-L3-30 : le modèle dit que la version d’ailleurs est une tombale');
    eq(syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [{ ...unConflit, renvoye: true }] }).conflits[0].suppressionAilleurs, false, 'R-L3-30 : … et faux quand elle n’en est pas une');
    for (const n of syncSectionL3(mTombale, gestes)) tombale.append(n);
    eq([...tombale.querySelectorAll('button')].map((b) => b.textContent), ['Supprimer ici aussi', 'Ignorer'], 'R-L3-30 : une tombale renvoyée garde son issue — « Supprimer ici aussi », plus « Ignorer »');
    ok(tombale.textContent.includes('Supprimée ailleurs'), 'R-L3-30 : … et la ligne dit que la fiche a été supprimée ailleurs');
    tombale.querySelector('button').click();
    eq(vus.at(-1), ['garderAilleurs', 'books:k1'], 'R-L3-30 : « Supprimer ici aussi » appelle bien le geste qui applique la suppression');

    // Et un conflit ordinaire garde ses deux issues, sans « Ignorer ».
    const ordinaire = document.createElement('div');
    for (const n of syncSectionL3(syncSectionModel({ ...base, moteur: etatMoteur({ conflits: 1 }), conflits: [unConflit] }), gestes)) ordinaire.append(n);
    const libellesOrdinaires = [...ordinaire.querySelectorAll('button')].map((b) => b.textContent);
    ok(libellesOrdinaires.some((l) => l.startsWith('Garder celle d’ici (')) && libellesOrdinaires.includes('Garder celle d’ailleurs') && !libellesOrdinaires.includes('Ignorer'),
      'R-L3-29 : un conflit ordinaire garde ses deux issues, et n’offre PAS « Ignorer »');
  }
  {
    const boite = document.createElement('div');
    for (const n of syncSectionL3(m4, {})) boite.append(n);
    ok(boite.querySelector('.warn')?.textContent.includes('1 Go'), 'rendu L3 : la pause de quota est un avertissement visible');
    const boite2 = document.createElement('div');
    for (const n of syncSectionL3(m2, {})) boite2.append(n);
    eq(boite2.textContent, 'Envoi initial : recipes 8/24', 'rendu L3 : la progression seule, sans liste vide ni titre orphelin');
    eq(syncSectionL3(m6, {}).length, 0, 'rendu L3 : sans moteur (L2), la section n’a rien de plus');
  }

  // --- Les gestes de la file et des conflits (spec § 4.2, § 5.5) : extraits de leurs gestionnaires DOM, à
  // dépendances injectées, éprouvés sur une base jetable. Ce sont des décisions, pas du rendu.
  const { reessayerEnvoi, abandonnerEnvoi, garderVersionDIci, garderVersionDAilleurs, rangerConflitRenvoye, suivreMoteur } = reglages;
  const { reglerHistorique: reglerHistoriqueL3, effacerDonnees: effacerDonneesL3 } = reglages;
  await withRepo(async (repoTemp, db) => {
    await db.mutate({ puts: { outbox: [{ user_id: 'u1', store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:00:00Z', tries: 3, last_error: 'taille', quarantined_at: '2026-10-13T11:00:00Z', next_try_at: '2026-10-13T12:00:00Z' }] }, origin: 'device' });
    const [entree] = await db.getAll('outbox');
    const appels = [];
    const moteurFactice = { executer: (r) => { appels.push(['executer', r]); return Promise.resolve(); }, planifier: () => appels.push(['planifier']) };
    eq(await reessayerEnvoi({ db, seq: entree.seq, moteur: moteurFactice }), true, 'geste L3 : « Réessayer » s’applique sur une entrée existante');
    const apres = await db.getAll('outbox');
    eq(apres.length, 1, 'geste L3 : « Réessayer » ne duplique pas l’entrée (origine device, jamais capturée)');
    eq([apres[0].seq, apres[0].quarantined_at, apres[0].last_error, apres[0].tries, apres[0].next_try_at], [entree.seq, null, null, 0, null],
      'geste L3 : la quarantaine, le motif, les essais comptés et l’attente de recul sont effacés');
    eq(appels, [['executer', 'reessai']], 'geste L3 : … et une passe est demandée tout de suite');
    eq(await reessayerEnvoi({ db, seq: 99999, moteur: moteurFactice }), false, 'geste L3 : « Réessayer » sur une entrée disparue ne fait rien');

    await repoTemp.save('books', { id: 'b1', title: 'Resté ici' });
    const demandes = [];
    eq(await abandonnerEnvoi({ db, seq: entree.seq, confirm: async (m) => { demandes.push(m); return false; } }), false, 'geste L3 : « Abandonner » refusé → rien');
    eq((await db.getAll('outbox')).some((e) => e.seq === entree.seq), true, 'geste L3 : … l’entrée est toujours en file');
    ok(demandes[0]?.includes('la fiche reste sur cet appareil'), 'geste L3 : la confirmation dit ce qui est abandonné et ce qui reste');
    eq(await abandonnerEnvoi({ db, seq: entree.seq, confirm: async () => true }), true, 'geste L3 : « Abandonner » confirmé');
    eq((await db.getAll('outbox')).some((e) => e.seq === entree.seq), false, 'geste L3 : … l’entrée quitte la file');
    eq((await db.get('books', 'b1'))?.title, 'Resté ici', 'geste L3 : … et la fiche reste sur cet appareil');
    eq(await abandonnerEnvoi({ db, seq: entree.seq, confirm: async () => { throw new Error('jamais demandé'); } }), false, 'geste L3 : une entrée déjà partie ne redemande rien');
  });

  await withRepo(async (repoTemp, db) => {
    await repoTemp.save('books', { id: 'k1', title: 'Ici' });
    const local = await db.get('books', 'k1');
    await db.mutate({ puts: { sync_conflicts: [{ id: 'books:k1', store: 'books', record_id: 'k1', local, server: { data: { id: 'k1', title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees' }] }, origin: 'remote' });
    const appels = [];
    eq(await garderVersionDIci({ db, id: 'books:k1', moteur: { planifier: () => appels.push('planifier') } }), true, 'geste L3 : « Garder celle d’ici » s’applique');
    eq([await db.count('sync_conflicts'), (await db.get('books', 'k1'))?.title, appels], [0, 'Ici', ['planifier']],
      'geste L3 : le conflit disparaît, la version d’ici reste, et une passe est planifiée (elle doit repartir)');
    eq(await garderVersionDIci({ db, id: 'books:k1' }), false, 'geste L3 : un conflit déjà tranché ne fait rien');
  });

  // R-L3-29 : « Ignorer » ne touche RIEN d'autre que l'entrée de journal, et refuse un conflit non renvoyé.
  await withRepo(async (repoTemp, db) => {
    await repoTemp.save('books', { id: 'ig', title: 'Ici' });
    const avant = await db.get('books', 'ig');
    const modele = (id, renvoye) => ({ id, store: 'books', record_id: 'ig', local: avant, server: { data: { id: 'ig', title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees', ...(renvoye ? { renvoye: true } : {}) });
    await db.mutate({ puts: { sync_conflicts: [modele('books:ig', true)] }, origin: 'remote' });
    const filesAvant = (await db.getAll('outbox')).length;
    eq(await rangerConflitRenvoye({ db, id: 'books:ig' }), true, 'R-L3-29 : « Ignorer » s’applique à un conflit renvoyé');
    eq([await db.count('sync_conflicts'), (await db.get('books', 'ig'))?.title, (await db.getAll('outbox')).length], [0, 'Ici', filesAvant],
      'R-L3-29 : … il retire l’entrée de journal et RIEN d’autre (ni la fiche, ni la file)');
    // Défense en profondeur : même appelé sur un conflit ordinaire, il refuse — ce conflit attend une décision.
    await db.mutate({ puts: { sync_conflicts: [modele('books:ig2', false)] }, origin: 'remote' });
    eq([await rangerConflitRenvoye({ db, id: 'books:ig2' }), await db.count('sync_conflicts')], [false, 1], 'R-L3-29 : … et il REFUSE un conflit ordinaire (il attend la personne)');
    eq(await rangerConflitRenvoye({ db, id: 'books:disparu' }), false, 'R-L3-29 : … et un conflit déjà rangé ne fait rien');
  });

  // R-L3-30 : les deux gestes « Garder… » REFUSENT un conflit renvoyé, et le drapeau est relu À L'EXÉCUTION.
  // Course réelle : un conflit ordinaire est affiché avec ses deux boutons ; avant le clic, une passe de réception
  // upgrade ce MÊME id en `renvoye: true` (la version d'ici vient d'être remise en file) ; le geste relit le conflit
  // et « Garder celle d'ailleurs » écrivait alors la version du serveur — celle qui a PERDU l'arbitrage I7 — par
  // dessus la version d'ici qui part. Exactement ce que R64 interdit, par un chemin que R64 n'avait pas fermé.
  await withRepo(async (repoTemp, db) => {
    await repoTemp.save('books', { id: 'course', title: 'Ici' });
    const locale = await db.get('books', 'course');
    const renvoye = { id: 'books:course', store: 'books', record_id: 'course', local: locale, server: { data: { id: 'course', title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees', renvoye: true };
    await db.mutate({ puts: { sync_conflicts: [renvoye] }, origin: 'remote' });
    const filesAvant = (await db.getAll('outbox')).length;
    const vraiMutate = db.mutate.bind(db);
    let transactions = 0;
    db.mutate = (arg) => { transactions += 1; return vraiMutate(arg); };
    let dAilleurs;
    let dIci;
    try {
      dAilleurs = await garderAilleurs(db, renvoye);
      dIci = await garderIci(db, renvoye);
    } finally { db.mutate = vraiMutate; }
    eq([dAilleurs, dIci, transactions], [false, false, 0], 'R-L3-30 : les deux gestes « Garder… » refusent un conflit renvoyé — et n’ouvrent pas même une transaction');
    eq([(await db.get('books', 'course')).title, (await db.getAll('outbox')).length, !!(await db.get('sync_conflicts', 'books:course'))],
      ['Ici', filesAvant, true], 'R-L3-30 : … la fiche locale est INTACTE, la file inchangée, et le conflit reste');
    // La porte n'est pas fermée pour tout le monde : « Ignorer », lui, s'applique.
    eq([await ignorerRenvoye(db, renvoye), await db.count('sync_conflicts')], [true, 0], 'R-L3-30 : … seul « Ignorer » touche un conflit renvoyé');

    // R-L3-30, l'exception : une TOMBALE venue d'ailleurs reste acceptable, même sur un conflit renvoyé. C'est la
    // seule décision que R-L3-26 ait laissée à la personne quand une tombale plus ancienne que la fiche locale
    // arrive ; la lui retirer annulerait la suppression venue d'ailleurs sans un mot.
    await repoTemp.save('books', { id: 'tomb', title: 'Ici plus récent' });
    const tombaleRenvoyee = { id: 'books:tomb', store: 'books', record_id: 'tomb', local: await db.get('books', 'tomb'), server: { data: null, updated_at: '2026-10-13T11:00:00Z', deleted_at: '2026-10-13T11:00:00Z' }, at: '2026-10-13T12:01:00Z', kind: 'donnees', renvoye: true };
    await db.mutate({ puts: { sync_conflicts: [tombaleRenvoyee] }, origin: 'remote' });
    eq(await garderIci(db, tombaleRenvoyee), false, 'R-L3-30 : « Garder celle d’ici » reste refusé sur une tombale renvoyée (la fiche part déjà)');
    eq([await garderAilleurs(db, tombaleRenvoyee), await db.get('books', 'tomb'), await db.get('sync_conflicts', 'books:tomb')],
      [true, undefined, undefined], 'R-L3-30 (exception) : « Garder celle d’ailleurs » ACCEPTE la suppression venue d’ailleurs — l’issue de R-L3-26 vit encore');

    // R-L3-30 ↔ R-L3-28 : ce que devient l'entrée de file laissée derrière. « Garder celle d'ailleurs » supprime la
    // fiche par une origine 'remote' (donc sans capturer de tombale), mais le `put` que `pull.js` avait remis en
    // file pour cette clé est TOUJOURS là. Sans R-L3-28, la passe suivante l'enverrait en tombale — et le serveur
    // écrirait une ligne pour la fiche qu'on vient d'accepter de supprimer : une résurrection par le chemin même
    // du geste qui l'a supprimée. L'entrée doit donc être abandonnée sans aucun appel réseau.
    const autres = (await db.getAll('outbox')).filter((e) => e.id !== 'tomb').map((e) => e.seq);
    if (autres.length) await db.mutate({ deletes: { outbox: autres }, origin: 'device' });
    eq((await db.getAll('outbox')).map((e) => [e.store, e.id, e.op]), [['books', 'tomb', 'put']], 'R-L3-30 ↔ R-L3-28 : le put de la clé supprimée est bien resté en file');
    const { fileDe: fileDeBoucle } = await import('../src/sync/outbox.js'); // la même définition que l'envoi relit
    const tfBoucle = creerTransportFactice({ serveur: true });
    let bilanBoucle;
    try {
      bilanBoucle = await createPush({ db, transport: tfBoucle, getUserId: () => 'u1' }).envoyer();
    } finally { setClockOffset(0); }
    eq([tfBoucle.journal.length, bilanBoucle.envoyes, bilanBoucle.abandonnees], [0, 0, 1], 'R-L3-30 ↔ R-L3-28 : AUCUN appel réseau — l’entrée est abandonnée, pas envoyée en tombale');
    eq([await db.count('outbox'), (await fileDeBoucle(db, 'u1')).length], [0, 0], 'R-L3-30 ↔ R-L3-28 : … la file est vidée de cette entrée');
    eq([await db.get('books', 'tomb'), tfBoucle.ligne('books', 'tomb')], [undefined, null], 'R-L3-30 ↔ R-L3-28 : … la fiche reste absente ICI, et rien n’a été écrit au serveur (aucune résurrection)');
  });

  await withRepo(async (repoTemp, db) => {
    await repoTemp.save('books', { id: 'k2', title: 'Ici' });
    await db.mutate({ puts: { sync_conflicts: [{ id: 'books:k2', store: 'books', record_id: 'k2', local: { id: 'k2', title: 'Ici' }, server: { data: { id: 'k2', title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees' }] }, origin: 'remote' });
    eq(await garderVersionDAilleurs({ db, id: 'books:k2' }), true, 'geste L3 : « Garder celle d’ailleurs » s’applique');
    eq([await db.count('sync_conflicts'), (await db.get('books', 'k2'))?.title], [0, 'Ailleurs'], 'geste L3 : … la version d’ailleurs est écrite et le conflit disparaît');
    await db.mutate({ puts: { sync_conflicts: [{ id: 'books:k3', store: 'books', record_id: 'k3', local: null, server: null, at: '2026-10-13T12:01:00Z', kind: 'donnees' }] }, origin: 'remote' });
    eq([await garderVersionDAilleurs({ db, id: 'books:k3' }), await db.count('sync_conflicts')], [false, 1],
      'geste L3 : sans version du serveur, le geste échoue et le conflit RESTE — jamais une perte muette');
  });

  // « Synchroniser mon historique » : à l'activation, le marqueur d'envoi initial est retiré (rattrapage).
  await withRepo(async (repoTemp, db) => {
    await db.mutate({ puts: { sync_state: [{ key: 'backfill:library_activity', value: 'fait' }] }, origin: 'device' });
    const appels = [];
    eq(await reglerHistoriqueL3(true, { db, moteur: { planifier: () => appels.push('planifier') } }), 0, 'réglages L3 : activer l’historique n’enlève rien de la file');
    eq(await db.get('sync_state', 'backfill:library_activity'), undefined, 'réglages L3 : activer l’historique retire son marqueur (rattrapage)');
    eq(appels, ['planifier'], 'réglages L3 : … et le rattrapage est demandé au moteur');
    eq((await repoTemp.getSettings()).sync_activity, true, 'réglages L3 : le consentement est écrit');
    await db.mutate({ puts: { sync_state: [{ key: 'backfill:library_activity', value: 'fait' }] }, origin: 'device' });
    await reglerHistoriqueL3(false, { db });
    eq((await db.get('sync_state', 'backfill:library_activity'))?.value, 'fait', 'réglages L3 : décocher (R27) ne touche pas au marqueur');
  });

  // « Effacer les données de cet appareil » : la quarantaine ne se videra pas d'elle-même, donc elle est nommée
  // avec sa sortie. Sans quarantaine, les phrases de L2 sont inchangées.
  {
    const journal = () => { const vus = []; return { vus, toast: (m) => vus.push(m), clearDevice: async () => vus.push('EFFACÉ'), reload: () => vus.push('reload') }; };
    const g1 = journal();
    await effacerDonneesL3({ user: { id: 'u' }, pending: async () => 5, enQuarantaine: async () => 2, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: g1.toast, clearDevice: g1.clearDevice, reload: g1.reload });
    eq(g1.vus, ['5 éléments ne sont pas encore envoyés (dont 2 en quarantaine : « Abandonner » d’abord).'], 'effacer L3 : la quarantaine est nommée avec sa sortie, et rien n’est effacé');
    const g2 = journal();
    await effacerDonneesL3({ user: { id: 'u' }, pending: async () => 1, enQuarantaine: async () => 1, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: g2.toast, clearDevice: g2.clearDevice, reload: g2.reload });
    eq(g2.vus, ['1 élément n’est pas encore envoyé, et il est en quarantaine : « Abandonner » d’abord.'], 'effacer L3 : un seul élément, en quarantaine → la phrase au singulier');
    const g3 = journal();
    await effacerDonneesL3({ user: { id: 'u' }, pending: async () => 3, enQuarantaine: async () => 0, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: g3.toast, clearDevice: g3.clearDevice, reload: g3.reload });
    eq(g3.vus, ['3 éléments ne sont pas encore envoyés.'], 'effacer L3 : sans quarantaine, la phrase de L2 est inchangée');
  }

  // --- L'abonnement à l'état du moteur : regroupé, et surtout RETIRÉ dès que la vue affichée n'est plus Réglages.
  // Le routeur ne démonte pas les vues : sans ce retrait, chaque navigation laisserait un abonné de plus, et
  // chaque passe rafraîchirait un écran qui ne parle pas de synchronisation.
  {
    const fauxMoteur = () => { const fns = new Set(); return { fns, onEtat: (fn) => { fns.add(fn); return () => fns.delete(fn); }, emettre: () => { for (const fn of [...fns]) fn(); } }; };
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const a = fauxMoteur();
    let rendus = 0;
    const arreter = suivreMoteur({ moteur: a, surReglages: () => true, rafraichir: () => { rendus += 1; }, delaiMs: 10 });
    a.emettre(); a.emettre(); a.emettre();
    eq(rendus, 0, 'abonnement L3 : rien n’est rendu dans l’instant (regroupement)');
    await pause(40);
    eq(rendus, 1, 'abonnement L3 : trois changements rapprochés → un seul rendu');
    a.emettre();
    await pause(40);
    eq(rendus, 2, 'abonnement L3 : un changement plus tard → un autre rendu');
    arreter();
    eq(a.fns.size, 0, 'abonnement L3 : l’arrêt retire l’abonné');
    a.emettre();
    await pause(40);
    eq(rendus, 2, 'abonnement L3 : … et plus rien n’est rendu ensuite');

    const b = fauxMoteur();
    let rendusB = 0;
    let surReglages = true;
    suivreMoteur({ moteur: b, surReglages: () => surReglages, rafraichir: () => { rendusB += 1; }, delaiMs: 10 });
    surReglages = false;
    b.emettre();
    await pause(40);
    eq([rendusB, b.fns.size], [0, 0], 'abonnement L3 : la vue a changé → l’abonné se retire lui-même, aucun rendu volé');

    const c = fauxMoteur();
    let rendusC = 0;
    const arreterC = suivreMoteur({ moteur: c, surReglages: () => true, rafraichir: () => { rendusC += 1; }, delaiMs: 10 });
    c.emettre();
    arreterC();
    await pause(40);
    eq(rendusC, 0, 'abonnement L3 : l’arrêt annule aussi le rendu déjà regroupé');
    eq(suivreMoteur({ moteur: null, surReglages: () => true, rafraichir: () => {} }), null, 'abonnement L3 : sans moteur, aucun abonnement');
  }

  // --- Ronde 1 (R-L3-16) ---------------------------------------------------
  // 1. Critical : une opération d'archive est longue, et son écran porte un état qui ne vit que dans le DOM
  // (contrôles désactivés, bilan de restauration, bouton « Recharger »). Un rendu demandé par l'état du moteur au
  // milieu reconstruirait la page et emporterait tout cela. L'abonnement se tait donc tant que l'archive travaille.
  {
    const fns = new Set();
    const faux = { onEtat: (fn) => { fns.add(fn); return () => fns.delete(fn); } };
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    let rendus = 0;
    let occupe = true;
    suivreMoteur({ moteur: faux, surReglages: () => true, occupe: () => occupe, rafraichir: () => { rendus += 1; }, delaiMs: 10 });
    for (const fn of [...fns]) fn();
    await pause(40);
    eq(rendus, 0, 'ronde 1 : pendant une opération d’archive (archiveOperation), aucun rendu n’est volé à la page');
    occupe = false;
    for (const fn of [...fns]) fn();
    await pause(40);
    eq(rendus, 1, 'ronde 1 : … et le rendu reprend dès que l’archive est terminée');
  }

  // 2. Le conflit dit SA nature : « même heure, contenus différents » et « une autre version a été créée ailleurs »
  // ne demandent pas la même décision. La phrase vient du kind, jamais d'une cause devinée.
  {
    const texteDe = (kind) => {
      const d = document.createElement('div');
      for (const n of syncSectionL3(syncSectionModel({ ...base, moteur: etatMoteur(), conflits: [{ ...unConflit, kind }] }), {})) d.append(n);
      return d.textContent;
    };
    const donnees = texteDe('donnees');
    const version = texteDe('version');
    ok(donnees.includes('Deux versions portent la même heure.') && !donnees.includes('créée ailleurs'), 'ronde 1 : conflit « donnees » → « Deux versions portent la même heure. »');
    ok(version.includes('Une autre version de cette recette a été créée ailleurs.') && !version.includes('la même heure'), 'ronde 1 : conflit « version » → sa propre phrase, pas celle des données');
    ok(texteDe('inattendu').includes('Deux versions existent pour cette fiche.'), 'ronde 1 : un kind inattendu reçoit une phrase neutre, jamais une cause inventée');
  }

  // 3. Les deux comptes viennent des LISTES affichées : un instantané pris à un autre instant contredirait la liste
  // juste en dessous, et c'est la liste que la personne peut compter.
  {
    const incoherent = syncSectionModel({ ...base, moteur: etatMoteur({ enQuarantaine: 99, conflits: 42 }), quarantaine: [fileQuarantaine[0]], conflits: [unConflit] });
    ok(incoherent.lines.includes('En quarantaine : 1') && incoherent.lines.includes('Conflits : 1'), 'ronde 1 : les deux comptes viennent des listes AFFICHÉES, pas de l’instantané du moteur');
    eq([incoherent.quarantaine.length, incoherent.conflits.length], [1, 1], 'ronde 1 : … et chaque ligne dit exactement ce que sa liste montre');
    const vide = syncSectionModel({ ...base, moteur: etatMoteur({ enQuarantaine: 7, conflits: 7 }) });
    ok(vide.lines.includes('En quarantaine : 0') && vide.lines.includes('Conflits : 0'), 'ronde 1 : listes vides → zéro, même si l’instantané prétend le contraire');
  }

  // 6. Le libellé d'un conflit est borné lui aussi : une clé opaque comme celle de la quarantaine, un titre d'un peu
  // plus long (il est fait pour être lu). Dans les deux cas la coupe se voit.
  {
    const conflitNomme = (local, record_id = 'k1') => syncSectionModel({ ...base, moteur: etatMoteur(), conflits: [{ ...unConflit, record_id, local }] }).conflits[0].libelle;
    eq(conflitNomme(null, 'r'.repeat(40)), 'books · ' + 'r'.repeat(12) + '…', 'ronde 1 : sans titre, la clé du conflit est tronquée comme celle de la quarantaine');
    eq(conflitNomme({ title: 'T'.repeat(80), updated_at: '2026-10-13T12:00:00Z' }), 'books · ' + 'T'.repeat(40) + '…', 'ronde 1 : un titre très long est borné sans être rendu illisible');
    eq(conflitNomme({ title: 'Tarte aux pommes', updated_at: '2026-10-13T12:00:00Z' }), 'books · Tarte aux pommes', 'ronde 1 : un titre ordinaire n’est pas coupé');
  }

  // 4. Le cache de lecture de state.js ne sait RIEN des écritures faites par db.mutate (aucun bus) : sans
  // invalidation, les vues garderaient la version que la personne vient justement d'écarter.
  await withRepo(async (repoTemp, db) => {
    const conflitPour = (record) => ({ id: 'books:' + record, store: 'books', record_id: record, local: { id: record, title: 'Ici' }, server: { data: { id: record, title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees' });
    await repoTemp.save('books', { id: 'k4', title: 'Ici' });
    await repoTemp.save('books', { id: 'k5', title: 'Ici' });
    await db.mutate({ puts: { sync_conflicts: [conflitPour('k4'), conflitPour('k5')] }, origin: 'remote' });
    const vus = [];
    await garderVersionDAilleurs({ db, id: 'books:k4', invalider: () => vus.push('ailleurs') });
    await garderVersionDIci({ db, id: 'books:k5', invalider: () => vus.push('ici') });
    eq(vus, ['ailleurs', 'ici'], 'ronde 1 : les deux issues d’un conflit invalident le cache de lecture (l’écriture ne passe par aucun bus)');
    const rien = [];
    await garderVersionDAilleurs({ db, id: 'books:disparu', invalider: () => rien.push('ailleurs') });
    await garderVersionDIci({ db, id: 'books:disparu', invalider: () => rien.push('ici') });
    eq(rien, [], 'ronde 1 : … et rien n’est invalidé quand il n’y avait rien à appliquer');
  });

  // 6. La file n'est lue qu'UNE fois par rendu : le compte affiché et la liste de quarantaine doivent venir du même
  // instant, sinon la ligne et la liste peuvent se contredire sous les yeux de la personne.
  await withRepo(async (repoTemp, db) => {
    const { renderSettings } = reglages;
    const vraiGetAll = db.getAll;
    const lectures = [];
    db.getAll = function (store) { lectures.push(store); return vraiGetAll.call(this, store); };
    try { await renderSettings({}, {}, { settings: await repoTemp.getSettings(), sync: {} }); }
    finally { delete db.getAll; }
    eq(lectures.filter((s) => s === 'outbox').length, 1, 'ronde 1 : un rendu de Réglages lit la file d’envoi exactement une fois');
    eq(lectures.filter((s) => s === 'sync_conflicts').length, 1, 'ronde 1 : … et les conflits exactement une fois');
  });

  // 5. Les gestes L3 sont nommés et le câblage réel n'expose qu'eux. Le rendu ne câble que ce qu'il a reçu : un
  // geste absent donne un bouton ABSENT (visible), jamais un bouton muet. Et aucun ne laisse échapper un rejet.
  {
    const { SYNC_L3_ACTIONS, gestesL3Pour } = reglages;
    const muet = { db: null, obtenirMoteur: () => null, confirm: async () => false, dire: () => {}, rafraichir: () => {}, invalider: () => {}, journaliser: () => {} };
    const cables = gestesL3Pour(muet);
    eq([...SYNC_L3_ACTIONS].sort(), ['abandonner', 'envoyerMaintenant', 'garderAilleurs', 'garderIci', 'ignorerConflit', 'reessayer'], 'ronde 1 : six gestes L3 nommés (R-L3-29 ajoute « Ignorer »)');
    eq(Object.keys(cables).sort(), [...SYNC_L3_ACTIONS].sort(), 'ronde 1 : le câblage réel expose exactement les gestes nommés, pas un de plus');
    ok(SYNC_L3_ACTIONS.every((a) => typeof cables[a] === 'function'), 'ronde 1 : … et chacun est bien une fonction');

    const sansGeste = document.createElement('div');
    for (const n of syncSectionL3(m1, {})) sansGeste.append(n);
    eq(sansGeste.querySelectorAll('button').length, 0, 'ronde 1 : sans geste câblé, aucun bouton muet n’est rendu');
    const partiel = document.createElement('div');
    for (const n of syncSectionL3(m1, { reessayer: () => {} })) partiel.append(n);
    eq([...partiel.querySelectorAll('button')].map((b) => b.textContent), ['Réessayer', 'Réessayer'], 'ronde 1 : seuls les gestes reçus deviennent des boutons');

    const journal = [];
    const bon = gestesL3Pour({ ...muet, obtenirMoteur: () => ({ envoyerMaintenant: async () => journal.push('envoye') }), rafraichir: () => journal.push('rendu') });
    await bon.envoyerMaintenant();
    eq(journal, ['envoye', 'rendu'], 'ronde 1 : « Envoyer maintenant » envoie PUIS rend la page');

    const dits = [];
    const codes = [];
    const casse = gestesL3Pour({ ...muet, db: { get: async () => { throw new Error('base illisible'); } }, confirm: async () => true, dire: (m) => dits.push(m), journaliser: (code) => codes.push(code) });
    await casse.reessayer(1);
    await casse.abandonner(1);
    await casse.garderIci('x');
    await casse.garderAilleurs('x');
    const casseEnvoi = gestesL3Pour({ ...muet, obtenirMoteur: () => ({ envoyerMaintenant: async () => { throw new Error('refus'); } }), dire: (m) => dits.push(m), journaliser: (code) => codes.push(code) });
    await casseEnvoi.envoyerMaintenant();
    eq(dits.length, 5, 'ronde 1 : chacun des cinq gestes attrape son échec — aucun rejet non traité dans un onClick');
    ok(dits.every((m) => m === 'Ce geste n’a pas abouti.'), 'ronde 1 : … dit par une phrase fixe, jamais le message du fournisseur');
    ok(codes.length === 5 && codes.every((c) => /^sync\.geste\./.test(c)), 'ronde 1 : … et journalisé par un code, jamais avec du contenu de fiche');
  }

  // --- Câblage (spec § 4.2, § 5.2, § 5.5) : pastille, fusion horodatée, conflit de version dans la vue recette
  // JAMAIS importer src/app.js dans les tests : il lance boot() à l'import (remplace #app, enregistre le SW).
  // Tout ce que le câblage DÉCIDE vit donc hors de app.js — la pastille dans state.js (le modèle) et components.js
  // (son nœud et sa mise à jour), la règle du rendu après une passe dans state.js. app.js ne garde que le fil.
  const etatUi = await import('../src/ui/state.js');
  const { pastilleModel: pm, doitRendreApresPasse, getSyncState: lireEtatSync } = etatUi;
  const connecte = true;
  eq([pm({ aEnvoyer: 0, connecte }), pm({ aEnvoyer: 1, connecte }), pm({ aEnvoyer: 12, connecte })], [null, '1 non envoyé', '12 non envoyés'], 'pastille : « N non envoyés » seulement si N > 0 (singulier à part)');
  eq([pm(), pm({ aEnvoyer: null, connecte }), pm({ aEnvoyer: -1, connecte })], [null, null, null], 'pastille : rien n’est affiché sans un nombre lisible et positif');
  ok(Object.hasOwn(lireEtatSync(), 'moteur'), 'câblage : l’état de connexion porte le moteur (null tant que le démarrage ne l’a pas posé)');

  // Le nœud de la pastille et sa mise à jour : elle RETROUVE son nœud par id à chaque appel, parce que la coquille
  // est reconstruite au changement de langue (app.js remet `current = null`) — une référence gardée serait orpheline.
  {
    const { pastille, majPastille, PASTILLE_ID } = await import('../src/ui/components.js');
    const hote = document.createElement('div');
    document.body.append(hote);
    try {
      hote.append(pastille());
      const vu = () => { const n = document.getElementById(PASTILLE_ID); return [n.hidden, n.textContent]; };
      eq(vu(), [true, ''], 'pastille : au repos le nœud existe et reste caché — rien n’est affirmé sans file');
      majPastille({ aEnvoyer: 3 }, true);
      eq(vu(), [false, '3 non envoyés'], 'pastille : trois en attente → la pastille se montre dans la barre du haut');
      majPastille({ aEnvoyer: 0 }, true);
      eq(vu(), [true, ''], 'pastille : file vidée → la pastille se recache');
      hote.replaceChildren(pastille()); // changement de langue : la coquille entière est refaite
      majPastille({ aEnvoyer: 1 }, true);
      eq(vu(), [false, '1 non envoyé'], 'pastille : après une reconstruction de la coquille, le nœud NEUF est retrouvé par id');
      majPastille({ aEnvoyer: 3 }, false);
      eq(vu(), [true, ''], 'R-L3-20 : sans compte, la pastille ne dit rien — la file ne partira pas, elle n’attend personne');
      majPastille(null, true);
      eq(vu(), [true, ''], 'pastille : un état illisible ne montre rien');
    } finally { hote.remove(); }
  }

  // R-L3-16 : l'écran affiché doit montrer ce qui vient d'arriver de l'autre appareil — donc un rendu à la FIN
  // d'une passe qui a écrit, et seulement là. Une opération d'archive l'interdit : son écran porte un état qui ne
  // vit que dans le DOM (contrôles désactivés, bilan, bouton « Recharger »), qu'un rendu emporterait.
  {
    const effets = (sur = {}) => ({ recues: 0, supprimees: 0, ajustes: 0, conflits: 0, ...sur });
    const fin = (sur = {}) => ({ enCours: false, derniersEffets: effets(sur) });
    ok(doitRendreApresPasse({ avant: true, etat: fin({ recues: 1 }) }), 'R-L3-16 : une passe terminée qui a reçu une fiche demande un rendu');
    ok(doitRendreApresPasse({ avant: true, etat: fin({ supprimees: 1 }) }), 'R-L3-16 : … une suppression venue d’ailleurs aussi');
    ok(doitRendreApresPasse({ avant: true, etat: fin({ ajustes: 1 }) }), 'R-L3-16 : … une fiche réécrite par un ajustement du serveur aussi');
    ok(doitRendreApresPasse({ avant: true, etat: fin({ conflits: 1 }) }), 'R-L3-16 : … et un conflit neuf aussi (la vue recette le dit)');
    ok(!doitRendreApresPasse({ avant: true, etat: fin() }), 'R-L3-16 : une passe qui n’a RIEN écrit ne vole aucun rendu');
    ok(!doitRendreApresPasse({ avant: false, etat: fin({ recues: 1 }) }), 'R-L3-16 : seule la FIN d’une passe déclenche un rendu, pas un état de plus');
    ok(!doitRendreApresPasse({ avant: true, etat: { enCours: true, derniersEffets: effets({ recues: 1 }) } }), 'R-L3-16 : une passe encore en cours n’en déclenche pas');
    ok(!doitRendreApresPasse({ avant: true, etat: fin({ recues: 1 }), archive: true }), 'R-L3-16 : pendant une opération d’archive, aucun rendu n’est volé à l’écran de restauration');
    ok(!doitRendreApresPasse({ avant: true, etat: { enCours: false, derniersEffets: null } }), 'R-L3-16 : sans bilan d’effets, rien n’est supposé');
    ok(!doitRendreApresPasse(), 'R-L3-16 : appelée à vide, la règle ne demande aucun rendu');
  }

  // Le moteur doit DIRE ce qu'une passe a écrit : sans ce bilan, personne ne peut distinguer une passe qui a reçu
  // une fiche d'une passe qui n'a rien trouvé, et l'écran afficherait l'état d'avant.
  await withRepo(async (repoTemp, db) => {
    await toutDejaEnvoye(db);
    const recue = { id: 'c9', data: { id: 'c9', title: 'Venue d’ailleurs', updated_at: '2026-10-13T00:00:00Z' }, updated_at: '2026-10-13T00:00:00Z', deleted_at: null, server_seq: 1 };
    const tf = creerTransportFactice({ lire: { books: [[recue], []] } });
    const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: fenetreMuette(), bus: busMuet });
    const e = await moteur.executer('t');
    eq(e.derniersEffets, { recues: 1, supprimees: 0, ajustes: 0, conflits: 0 }, 'moteur (R-L3-16) : la fin d’une passe dit ce qu’elle a écrit');
    ok(Object.isFrozen(e.derniersEffets), 'moteur (R-L3-16) : … et ce bilan sort figé comme le reste de l’état');
    await moteur.arreter();
    const vide = creerTransportFactice({ lire: {} });
    const m2 = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: vide, fenetre: fenetreMuette(), bus: busMuet });
    eq((await m2.executer('t')).derniersEffets, { recues: 0, supprimees: 0, ajustes: 0, conflits: 0 }, 'moteur (R-L3-16) : une passe qui n’écrit rien le dit aussi — zéro partout');
    await m2.arreter();
  });

  // --- Restauration d'archive et synchronisation (spec § 5.2) --------------
  const sauvegarde = await import('../src/domain/backup.js');
  const { applyArchive, inspectArchive, createArchive, verifyRestored, compterFichesSynchronisees } = sauvegarde;
  eq(compterFichesSynchronisees({ payload: { stores: { books: [{ id: 'a' }, { id: 'b' }], settings: [{ key: 'ui_locale' }] }, files: [{ sha256: 'x' }] } }), 3,
    'bilan : deux livres et un fichier font trois fiches à renvoyer — les réglages ne sont pas synchronisés');
  eq([compterFichesSynchronisees(null), compterFichesSynchronisees({ payload: { stores: {}, files: [] } })], [0, 0], 'bilan : sans fiche synchronisée, rien à annoncer');

  await withRepo(async (repoTemp, db) => {
    await db.mutate({
      puts: {
        books: [{ id: 'z1', title: 'Archivé', updated_at: '2026-10-01T00:00:00Z' }, { id: 'z2', title: 'Sans date' }],
        settings: [{ key: 'device_name', value: 'Poste de test' }], // sans updated_at : « settings » n’est pas synchronisé
      },
      origin: 'device',
    });
    const archive = await createArchive(db);
    const insp = await inspectArchive(await archive.blob.arrayBuffer());
    ok(insp.ok, 'archive : la copie de la base de test est acceptée à l’inspection');
    eq((insp.payload.stores.books.find((b) => b.id === 'z2') || {}).updated_at, undefined, 'archive : une fiche d’avant le lot voyage sans updated_at');
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });

    // R-L3-10 (complétude) : sans compte et sans horodatage demandé, une fiche sans date en reçoit quand même une —
    // sinon sync_push la rejetterait (jeton « updated_at ») et elle partirait droit en quarantaine.
    await applyArchive(db, insp, { mode: 'merge' });
    ok(typeof (await db.get('books', 'z2')).updated_at === 'string', 'R-L3-10 : restaurée sans compte, une fiche sans date reçoit un updated_at (jamais rejetée pour ça)');
    eq((await db.get('books', 'z1')).updated_at, '2026-10-01T00:00:00Z', 'fusion sans compte : l’updated_at de l’archive est conservé (comportement d’avant)');

    // Avec un compte, la fusion est un RENVOI voulu : chaque fiche repart avec une heure neuve, sinon le serveur
    // garderait sa version (I7 : updated_at strictement supérieur gagne) et la restauration ne se verrait nulle part.
    await applyArchive(db, insp, { mode: 'merge', horodater: () => '2030-01-01T00:00:00.000Z' });
    eq((await db.get('books', 'z1')).updated_at, '2030-01-01T00:00:00.000Z', 'fusion horodatée : chaque fiche fusionnée reçoit un updated_at neuf');
    ok((await db.getAll('outbox')).some((e) => e.store === 'books' && e.id === 'z1'), 'fusion horodatée : … et part en file (capturée, origin local)');
    eq((await db.get('settings', 'device_name')).updated_at, undefined, 'fusion horodatée : les réglages ne sont pas horodatés — ils ne sont pas synchronisés');

    // Le bilan de restauration doit rester VRAI après ce renvoi : sans cette tolérance étroite, chaque fiche
    // réhorodatée serait annoncée comme un écart et toute restauration d’un compte connecté finirait en rouge.
    ok((await verifyRestored(db, insp, { mode: 'merge', horodate: true })).ok, 'fusion horodatée : le bilan de restauration reste vérifié (seul l’updated_at diffère)');
    const strict = await verifyRestored(db, insp, { mode: 'merge' });
    ok(!strict.ok && strict.diffs.length > 0, 'fusion horodatée : … et la tolérance reste étroite — sans elle l’écart d’heure est bien signalé');
    eq(compterFichesSynchronisees(insp) > 90, true, 'bilan : les références amorcées comptent parmi les fiches renvoyées (' + compterFichesSynchronisees(insp) + ')');
  });

  // --- R61 (complément) : la RESTAURATION nettoie aussi les caractères de contrôle
  // R61 les retire à l'écriture (`repo.save` / `repo.saveBatch`), mais `applyArchive` écrit par `db.putBatch` sans
  // passer par `repo` : une archive d'AVANT cette vague ramenait donc des fiches sales. Restaurées telles quelles,
  // la fiche locale (sale) et la copie du serveur (que `lots.js` nettoie à l'envoi) diffèrent à instants ÉGAUX —
  // le conflit perpétuel que R61 vient de supprimer sur le chemin ordinaire, revenu par la porte de l'archive.
  await withRepo(async (repoTemp, db) => {
    // Écrite par `db.mutate` d'origine 'device' : elle ne passe pas par `repo.save`, donc elle entre SALE dans la
    // base — c'est exactement une fiche d'avant cette vague, telle qu'une vieille archive en porte.
    await db.mutate({ puts: { books: [{ id: 'sale', title: 'a\u0000b', notes: ['x\u000by', { z: 't\u001f' }], garde: 'é\n\tÀ', updated_at: '2026-10-01T00:00:00Z' }] }, origin: 'device' });
    const insp = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
    ok(insp.ok, 'R61 archive : la copie d’une base portant un caractère de contrôle est acceptée à l’inspection');
    eq(insp.payload.stores.books.find((b) => b.id === 'sale')?.title, 'a\u0000b', 'R61 archive : l’archive porte bien le caractère de contrôle (rien n’est réécrit à l’export)');
    // La fiche sale est retirée de la base AVANT la restauration : ce qui sera relu ne peut venir que d'elle.
    await db.mutate({ clearStores: ['books'], origin: 'device' });
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    await applyArchive(db, insp, { mode: 'merge' });
    const relue = await db.get('books', 'sale');
    eq([relue.title, relue.notes, relue.garde], ['ab', ['xy', { z: 't' }], 'é\n\tÀ'], 'R61 archive : la restauration nettoie les caractères de contrôle, en profondeur, et garde accents et sauts de ligne');
    ok((await verifyRestored(db, insp, { mode: 'merge' })).ok, 'R61 archive : … et le bilan de restauration reste VÉRIFIÉ — un nettoyage voulu n’est pas un écart à signaler');
    // Avec un compte, la fiche repart — et ce qui part est identique à ce qui est écrit ici.
    await applyArchive(db, insp, { mode: 'merge', horodater: () => '2032-01-01T00:00:00.000Z' });
    ok((await verifyRestored(db, insp, { mode: 'merge', horodate: true })).ok, 'R61 archive : le bilan d’une restauration horodatée reste vérifié lui aussi');
    const lot = await composerLots(await db.getAll('outbox'), (s, id) => db.get(s, id));
    const element = lot.lots[0].elements.find((e) => e.id === 'sale');
    eq(element.data, await db.get('books', 'sale'), 'R61 archive : l’élément envoyé est IDENTIQUE à la fiche restaurée (plus de conflit perpétuel)');
  });

  // La phrase du bilan : deux chaînes, jamais un pluriel calculé sur une chaîne traduite, et rien du tout à zéro.
  {
    const { messageRenvoi } = reglages;
    eq([messageRenvoi(0), messageRenvoi(1), messageRenvoi(4)], [null, '1 fiche sera renvoyée au serveur.', '4 fiches seront renvoyées au serveur.'],
      'bilan : « N fiches seront renvoyées au serveur. » — singulier à part, rien à zéro');
  }

  // --- Arrêt du moteur sur les deux gestes qui ferment la session (spec § 4.1)
  {
    const { arreterMoteur } = reglages;
    const journal = [];
    const faux = { arreter: async () => { journal.push('arrete'); return null; } };
    let pose = null;
    const pastilles = [];
    const pastille = (etat) => { pastilles.push(etat); journal.push('pastille'); };
    eq(await arreterMoteur({ obtenir: () => faux, poser: (p) => { pose = p; journal.push('pose'); }, pastille }), true, 'déconnexion : le moteur est arrêté');
    eq([journal, pose], [['arrete', 'pose', 'pastille'], { moteur: null }], 'déconnexion : … arrêté PUIS retiré de l’état PUIS la pastille redessinée, dans cet ordre');
    // m1 : sans cette redessine, « Se déconnecter » laissait « N non envoyés » dans la barre du haut SANS compte,
    // jusqu'au prochain rechargement — contraire à R52.
    eq(pastilles, [null], 'm1 : la pastille est remise à muette à l’arrêt du moteur (plus de compteur sans compte)');
    eq(await arreterMoteur({ obtenir: () => null, poser: () => journal.push('pose'), pastille }), false, 'déconnexion : sans moteur, rien n’est posé');
    eq(journal.length, 3, 'déconnexion : … et ni l’état ni la pastille ne sont touchés pour rien');
    // Et le mécanisme lui-même : majPastille(null) cache et vide le nœud (jamais un « 0 » affiché).
    {
      const { pastille: fabriquer, majPastille } = await import('../src/ui/components.js');
      const noeud = fabriquer();
      document.body.append(noeud);
      try {
        eq(majPastille({ aEnvoyer: 3 }, true), '3 non envoyés', 'm1 : avec un compte, la pastille dit ce qui attend');
        ok(!noeud.hidden && noeud.textContent === '3 non envoyés', 'm1 : … et son nœud est visible');
        eq(majPastille(null), null, 'm1 : majPastille(null) — ce que pose l’arrêt du moteur — ne dit rien');
        ok(noeud.hidden && noeud.textContent === '', 'm1 : … et le nœud est caché ET vidé');
      } finally { noeud.remove(); }
    }

    const { changerDeCompte } = reglages;
    const ordre = [];
    const fait = await changerDeCompte({
      confirm: async () => true, toast: () => {}, pending: async () => 0,
      archiveCreated: () => '2026-10-13T00:00:00Z',
      arreterSync: async () => ordre.push('moteur arrete'),
      clearDevice: async () => ordre.push('appareil vide'),
      reload: () => ordre.push('recharge'),
    });
    eq([fait, ordre], [true, ['moteur arrete', 'appareil vide', 'recharge']], 'changer de compte : le moteur est arrêté AVANT que l’appareil soit effacé');
    const refuse = [];
    await changerDeCompte({
      confirm: async () => false, toast: () => {}, pending: async () => 0, archiveCreated: () => 't',
      arreterSync: async () => refuse.push('moteur arrete'), clearDevice: async () => refuse.push('vide'), reload: () => {},
    });
    eq(refuse, [], 'changer de compte : un geste refusé n’arrête pas le moteur');
  }

  // --- Vue recette (spec § 5.5) : une autre version a été créée ailleurs ---
  // Aucune version n'est masquée : la liste reste entière, seule une ligne le dit, et la décision vit dans Réglages.
  {
    const { renderRecipe } = await import('../src/ui/recipe.js');
    await withRepo(async (repoTemp, db) => {
      const recette = { id: 'rc9', edition_id: null, original_title: 'Tarte aux pommes', availability: 'reference_only', printed_page: 58, source_page_ids: [] };
      const ctx = {
        recipesById: new Map([['rc9', recette]]), versionsByRecipe: new Map(), versionsById: new Map(),
        editionsById: new Map(), booksById: new Map(), pagesById: new Map(), dishesById: new Map(),
        cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: [], ingredientsById: new Map(), dishes: [],
        settings: { units: 'original', reading_locale: 'original' }, conventionFor: () => null,
      };
      const PHRASE = 'Une autre version a été créée ailleurs — les deux versions sont conservées.';
      const conflitPour = (kind) => ({ id: 'recipes:rc9', store: 'recipes', record_id: 'rc9', local: recette, server: { data: recette, updated_at: '2026-10-14T00:00:00Z', deleted_at: null }, at: '2026-10-14T00:01:00Z', kind });
      ok(!(await renderRecipe({ id: 'rc9' }, {}, ctx)).textContent.includes(PHRASE), 'vue recette : sans conflit, aucune ligne n’est affichée');
      await db.mutate({ puts: { sync_conflicts: [conflitPour('donnees')] }, origin: 'remote' });
      ok(!(await renderRecipe({ id: 'rc9' }, {}, ctx)).textContent.includes(PHRASE), 'vue recette : un conflit de données ne parle pas d’une version créée ailleurs');
      await db.mutate({ puts: { sync_conflicts: [conflitPour('version')] }, origin: 'remote' });
      const avec = await renderRecipe({ id: 'rc9' }, {}, ctx);
      ok(avec.textContent.includes(PHRASE), 'vue recette : conflit de version → la ligne le dit, sans masquer aucune version');
      eq([...avec.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '#/settings').length, 1, 'vue recette : … avec un seul lien vers Réglages pour trancher');
    });
  }

  // --- Service worker : les modules du câblage deviennent atteignables depuis app.js --------
  // Un module atteignable et absent de SHELL fait répondre 404 à cache.addAll : l'installation du service worker
  // échoue EN ENTIER et il n'y a plus aucune consultation hors connexion.
  {
    const source = await (await fetch('../sw.js', { cache: 'no-store' })).text();
    const liste = [...(source.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    ok(liste.length > 30, 'SHELL lu : ' + liste.length + ' entrées à relire avant de conclure');
    eq(['./src/sync/transport.js', './src/sync/lots.js', './src/sync/reponses.js', './src/sync/push.js', './src/sync/pull.js', './src/sync/conflits.js', './src/sync/backfill.js', './src/sync/moteur.js']
      .filter((c) => !liste.includes(c)), [], 'SHELL : les modules d’envoi et de réception, désormais atteignables depuis app.js, sont servis hors connexion');
    ok(/VERSION = 'cuisine-os-v0\.7\.0-\d+'/.test(source), 'sw.js : VERSION incrémentée (format cuisine-os-vMAJOR.MINOR.PATCH-N), l’ancien cache est purgé à l’activation');
    // Le nom du cache et la version affichée dans Réglages doivent dire la MÊME chose : deux versions qui se
    // contredisent rendent impossible de savoir ce qui est servi (un cache « 0.2.0 » pour une app qui s'annonce
    // « 0.3.0 » est exactement le genre de doute qu'un marqueur de version existe pour lever). Le contrôle porte
    // sur le MAJOR.MINOR.PATCH (pas le suffixe -N, qui avance à chaque tâche touchant un fichier servi) : il reste
    // vrai tâche après tâche sans retouche, tant que les deux ne divergent jamais (R-UX-5).
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(source.match(/VERSION = 'cuisine-os-v([0-9]+\.[0-9]+\.[0-9]+)-[0-9]+'/)?.[1], APP_VERSION,
      'sw.js et APP_VERSION disent la même version');
  }

  // --- Ronde 1 du câblage --------------------------------------------------
  // 1. Critical (R-L3-19) : une passe du moteur ne vole JAMAIS une saisie. Les écrans d'édition portent un état
  // qui ne vit que dans le DOM — texte tapé, lignes analysées, étape de cuisson en cours, photos choisies — et un
  // rendu demandé par le moteur au milieu le remplacerait sans que personne l'ait demandé.
  {
    const { ROUTES_DE_SAISIE, estRouteDeSaisie, passeAEcrit } = etatUi;
    eq(ROUTES_DE_SAISIE, ['/recipes/new', '/recipes/creer', '/recipes/*/edit', '/import', '/cook/*', '/add'], 'R-L3-19 : les routes de saisie sont nommées une fois, en un seul endroit (F2 du lot création IA : /recipes/creer, sa saisie et son vol)');
    eq(['/recipes/new', '/recipes/creer', '/recipes/rc1/edit', '/import', '/cook/cs1', '/add'].filter((p) => !estRouteDeSaisie(p)), [], 'R-L3-19 : les six écrans de saisie sont reconnus');
    eq(['/', '/library', '/recipes/rc1', '/settings', '/meals', '/kitchen', '/cook', '/add/livre', '/recipes'].filter((p) => estRouteDeSaisie(p)), [],
      'R-L3-19 : … et rien d’autre — le motif « * » vaut UN segment, jamais une arborescence');
    eq([estRouteDeSaisie(''), estRouteDeSaisie(null), estRouteDeSaisie(undefined)], [false, false, false], 'R-L3-19 : une route absente n’est pas une saisie');

    const effets = (sur = {}) => ({ recues: 0, supprimees: 0, ajustes: 0, conflits: 0, ...sur });
    const fin = (sur = {}) => ({ enCours: false, derniersEffets: effets(sur) });
    ok(!doitRendreApresPasse({ avant: true, etat: fin({ recues: 1 }), route: '/recipes/rc1/edit' }), 'R-L3-19 : sur un écran d’édition, aucun rendu n’est volé à la saisie');
    ok(!doitRendreApresPasse({ avant: true, etat: fin({ recues: 3 }), route: '/cook/cs1' }), 'R-L3-19 : … ni pendant une cuisson en cours');
    ok(doitRendreApresPasse({ avant: true, etat: fin({ recues: 1 }), route: '/library' }), 'R-L3-19 : sur la bibliothèque, une passe qui a écrit demande bien un rendu');
    ok(!doitRendreApresPasse({ avant: true, etat: fin({ recues: 1 }), route: '/settings' }), 'ronde 1 : sur Réglages, le rendu est laissé à l’abonnement de la section — pas deux rendus pour une passe');

    // 2. Important : le cache de lecture est périmé dès que la passe a ÉCRIT, qu'un rendu suive ou non. Sinon le
    // prochain rendu — une navigation, un geste — relirait un cache d’avant la passe et montrerait l’état d’hier.
    ok(passeAEcrit({ avant: true, etat: fin({ recues: 1 }) }), 'ronde 1 : « la passe a écrit » est une question à part, indépendante de l’écran affiché');
    ok(passeAEcrit({ avant: true, etat: fin({ conflits: 1 }) }), 'ronde 1 : … un conflit neuf compte comme une écriture');
    eq([passeAEcrit({ avant: true, etat: fin() }), passeAEcrit({ avant: false, etat: fin({ recues: 1 }) }), passeAEcrit({ avant: true, etat: { enCours: true, derniersEffets: effets({ recues: 1 }) } }), passeAEcrit()],
      [false, false, false, false], 'ronde 1 : … et elle reste fausse sans écriture, hors fin de passe, ou à vide');
  }

  // 3. Important : un seul moteur par appareil. Un compte qui arrive pendant la porte d’entrée en démarre un
  // (auth.onChange), puis le démarrage en démarrerait un second : deux jeux d’écouteurs, deux passes, deux fois
  // les appels. La garde vit dans state.js, pour être éprouvée — app.js ne peut pas être importé par un test.
  {
    const { poserMoteur, setSyncState: poserEtat, getSyncState: lire } = etatUi;
    const avant = lire().moteur;
    try {
      poserEtat({ moteur: null });
      let fabriques = 0;
      const premier = poserMoteur(() => { fabriques += 1; return { nom: 'premier' }; });
      const second = poserMoteur(() => { fabriques += 1; return { nom: 'second' }; });
      eq([fabriques, premier.nom, second === premier], [1, 'premier', true], 'ronde 1 : poserMoteur ne fabrique que s’il n’y a pas de moteur — le second appel rend le premier');
      eq(lire().moteur, premier, 'ronde 1 : … et c’est celui-là qui vit dans l’état');
      poserEtat({ moteur: null });
      eq([poserMoteur(() => null), lire().moteur], [null, null], 'ronde 1 : une fabrique qui ne rend rien (aucun client) ne pose rien dans l’état');
      // R-L3-23 : poser le moteur ne fait PAS avancer le compteur de générations de R32. Au démarrage hors ligne,
      // la borne de 8 s (R28) est dépassée, le démarrage retient `generationQuittee`, puis `demarrerMoteur()`
      // appelle `poserMoteur` : avec `setSyncState`, la génération avançait et le résultat tardif de `getSession()`
      // était JETÉ — « Vérification du compte… » restait figé, sans aucun geste (l'impasse que R32 a supprimée).
      poserEtat({ moteur: null });
      const generationAvant = etatUi.getSyncGeneration();
      const pose = poserMoteur(() => ({ nom: 'sans generation' }));
      eq([etatUi.getSyncGeneration(), lire().moteur === pose], [generationAvant, true],
        'R-L3-23 : poserMoteur écrit le moteur dans l’état SANS faire avancer la génération (R32)');
      // Et le travail tardif du démarrage est bel et bien appliqué après une pose de moteur.
      const tardif = { auth: null, user: { id: 'u-tardif', email: 'x' }, guard: { ok: true }, retour: null, enAttente: false };
      if (etatUi.getSyncGeneration() === generationAvant) poserEtat(tardif);
      eq([lire().enAttente, lire().user?.id, lire().moteur === pose], [false, 'u-tardif', true],
        'R-L3-23 : … donc le résultat tardif du démarrage s’applique encore, et il ne perd pas le moteur');
    } finally { poserEtat({ moteur: avant, user: null, guard: null, enAttente: false }); }
  }

  // 4. Important (R-L3-20) : la pastille n’apparaît qu’avec un compte. Sans compte rien ne part jamais — « 3 non
  // envoyés » serait une attente que personne ne tient, sur un appareil qui fonctionne exactement comme prévu.
  eq([pm({ aEnvoyer: 3 }), pm({ aEnvoyer: 3, connecte: false }), pm({ aEnvoyer: 3, connecte: true })], [null, null, '3 non envoyés'],
    'R-L3-20 : la pastille ne se montre qu’avec un compte — sans compte, la file n’attend personne');
  eq(pm({ aEnvoyer: 1, connecte: true }), '1 non envoyé', 'R-L3-20 : … et le singulier reste une chaîne à part');

  // 5. Important (R-L3-18) : en mode « remplacement » aussi, une bibliothèque restaurée avec un compte doit
  // repartir. Sans heure neuve, le serveur garderait ses versions (I7) et le remplacement ne se verrait nulle part.
  await withRepo(async (repoTemp, db) => {
    await db.mutate({ puts: { books: [{ id: 'y1', title: 'Remplacé', updated_at: '2026-10-01T00:00:00Z' }, { id: 'y2', title: 'Sans date' }] }, origin: 'device' });
    const insp = await inspectArchive(await (await createArchive(db)).blob.arrayBuffer());
    ok(insp.ok, 'R-L3-18 : la copie est acceptée à l’inspection');
    await applyArchive(db, insp, { mode: 'replace', horodater: () => '2031-01-01T00:00:00.000Z' });
    eq((await db.get('books', 'y1')).updated_at, '2031-01-01T00:00:00.000Z', 'R-L3-18 : en remplacement avec un compte, chaque fiche reçoit une heure neuve');
    ok((await db.getAll('outbox')).some((e) => e.store === 'books' && e.id === 'y1'), 'R-L3-18 : … et part en file');
    ok((await verifyRestored(db, insp, { mode: 'replace', horodate: true })).ok, 'R-L3-18 : le bilan du remplacement horodaté reste vérifié');
    // Complétude en remplacement, sans compte : la fiche sans date en reçoit une quand même (R-L3-10).
    await applyArchive(db, insp, { mode: 'replace' });
    ok(typeof (await db.get('books', 'y2')).updated_at === 'string', 'R-L3-10 : en remplacement sans compte aussi, une fiche sans date reçoit un updated_at');
    eq((await db.get('books', 'y1')).updated_at, '2026-10-01T00:00:00Z', 'R-L3-10 : … et les heures de l’archive sont conservées telles quelles');
    ok((await verifyRestored(db, insp, { mode: 'replace' })).ok, 'R-L3-10 : le bilan d’un remplacement sans compte reste vérifié');
  });

  // Ce qu’un remplacement ne fait PAS : il ne supprime rien chez le fournisseur. Dit à côté du bouton qui décide.
  {
    const { messageRemplacementServeur } = reglages;
    eq([messageRemplacementServeur(true), messageRemplacementServeur(false)], ['Les fiches absentes de l’archive restent sur le serveur.', null],
      'R-L3-18 : le remplacement dit qu’il ne supprime rien sur le serveur — et seulement quand il y a un serveur');
  }

  // 6. Mineur : « Effacer les données de cet appareil » arrête le moteur avant de vider la base — sinon une passe
  // déclenchée entre les deux écrirait dans une base qu’on vient d’effacer, ou enverrait ce qui n’existe plus.
  {
    const ordre = [];
    const fait = await effacerDonneesL3({
      user: null, pending: async () => 2, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: () => {},
      arreterSync: async () => ordre.push('moteur arrete'),
      clearDevice: async () => ordre.push('appareil vide'),
      reload: () => ordre.push('recharge'),
    });
    eq([fait, ordre], [true, ['moteur arrete', 'appareil vide', 'recharge']], 'ronde 1 : « Effacer » arrête le moteur AVANT de vider la base');
    const refuse = [];
    await effacerDonneesL3({
      user: { id: 'u' }, pending: async () => 1, enQuarantaine: async () => 0, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: () => {},
      arreterSync: async () => refuse.push('moteur arrete'), clearDevice: async () => refuse.push('vide'), reload: () => {},
    });
    eq(refuse, [], 'ronde 1 : un effacement refusé (file non vide avec un compte) n’arrête pas le moteur');
  }

  // --- R-L3-17 : le faux rouge intermittent du montage de tests ------------
  // Diagnostiqué à la tâche 8 : « Nettoyage de la base temporaire bloqué : cuisine-os-backup-test-… », vu 3 fois
  // en ~15 passages, toujours AVANT la section qui le subissait. Deux causes, les deux corrigées ici.
  // 1) `withDatabase` traitait `deleteDatabase().onblocked` comme TERMINAL. En IndexedDB cet événement est
  //    informatif : la requête reste en attente et aboutit dès que la dernière connexion gênante se ferme.
  // 2) Une relecture de réglages lancée par le bus et que PERSONNE n'attend rouvrait la base jetable juste après
  //    sa fermeture (`Database.open()` rouvre dès que `idb` est nul) — connexion gênante, nettoyage bloqué.
  {
    const { withDatabase } = await import('./backup.js');
    const repoModule = await import('../src/model/repo.js');
    const { emit } = await import('../src/core/bus.js');

    // 1) Un blocage RÉEL, provoqué sans détour : une seconde connexion à la base jetable qui ne se ferme qu'après
    //    la demande de suppression. `onblocked` arrive, puis `onsuccess` : le nettoyage doit aboutir, pas rejeter.
    let nom = null;
    let erreur = null;
    try {
      await withDatabase(async (temp) => {
        nom = temp.name;
        const genante = await new Promise((resolve, reject) => {
          const r = indexedDB.open(temp.name, temp.version);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        // Exactement ce que fait `src/core/db.js` sur une connexion qu'il possède, mais retardé : c'est ce délai
        // qui rendait le faux rouge intermittent.
        genante.onversionchange = () => setTimeout(() => genante.close(), 150);
      });
    } catch (e) { erreur = e?.message || String(e); }
    eq(erreur, null, 'R-L3-17 : une connexion gênante qui se ferme tard ne fait plus échouer le nettoyage (onblocked est informatif)');
    ok(nom && !(await indexedDB.databases()).some((d) => d.name === nom), 'R-L3-17 : … et la base jetable est bel et bien supprimée');

    // 2) La relecture lancée par le bus ne lit QUE si une base est ouverte. Base fictive : aucune vraie base n'est
    //    touchée, et la règle se mesure sur l'appel lui-même.
    const etat = await import('../src/ui/state.js');
    ok(typeof etat.relectureEnCours === 'function', 'R-L3-17 : la relecture lancée par le bus est observable (relectureEnCours)');
    const origine = repoModule.db;
    try {
      const appels = [];
      const base = (ouverte) => ({ idb: ouverte ? {} : null, getAll: async (store) => { appels.push(store); return []; }, get: async () => undefined });
      repoModule.bindDatabase(base(false));
      emit('settings', { key: 'device_name', value: 'base fermée' });
      await etat.relectureEnCours();
      eq(appels, [], 'R-L3-17 : aucune base ouverte → le bus ne lit rien (une lecture rouvrirait la base)');
      repoModule.bindDatabase(base(true));
      emit('settings', { key: 'device_name', value: 'base ouverte' });
      await etat.relectureEnCours();
      eq(appels, ['settings'], 'R-L3-17 : base ouverte → les réglages sont relus, comme en production');
      emit('change', { store: 'settings' });
      await etat.relectureEnCours();
      eq(appels, ['settings', 'settings'], 'R-L3-17 : … et une écriture annoncée sur le magasin settings les relit aussi');
      emit('change', { store: 'books' });
      await etat.relectureEnCours();
      eq(appels, ['settings', 'settings'], 'R-L3-17 : une écriture qui ne touche pas les réglages ne les relit pas');
    } finally { repoModule.bindDatabase(origine); }

    // 3) Le scénario réel du faux rouge, de bout en bout : une écriture de réglages annoncée juste avant le
    //    nettoyage, personne n'attend la relecture. Ni blocage, ni base fantôme ressuscitée après la suppression.
    let nomReel = null;
    let erreurReelle = null;
    const avant = repoModule.db;
    try {
      await withDatabase(async (temp) => {
        nomReel = temp.name;
        repoModule.bindDatabase(temp);
        await temp.mutate({ puts: { settings: [{ key: 'device_name', value: 'base jetable' }] }, origin: 'device' });
        emit('settings', { key: 'device_name', value: 'base jetable' }); // relecture flottante : rien ne l'attend
      });
    } catch (e) { erreurReelle = e?.message || String(e); } finally { repoModule.bindDatabase(avant); }
    eq(erreurReelle, null, 'R-L3-17 : une écriture de réglages annoncée juste avant le nettoyage ne le bloque plus');
    await etat.relectureEnCours();
    ok(nomReel && !(await indexedDB.databases()).some((d) => d.name === nomReel), 'R-L3-17 : … et la base jetable n’est pas ressuscitée après sa suppression');
  }
}
