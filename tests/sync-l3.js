// Suite L3 — envoi et réception (spec § 5.3, § 5.5). Transport factice : aucun réseau.
import { classerErreur, createTransport } from '../src/sync/transport.js';
import { createAuth } from '../src/sync/auth.js';
import { creerTransportFactice } from './transport-factice.js';
import { withRepo } from './sync-fixture.js';

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
  eq(LIMITES, { elements: 500, lot: 921600, element: 524288 }, 'lots : bornes de la spec (§ 3.4, R14), le lot avec marge sous le seuil serveur (R-L3-6)');

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
  eq(c.lots[0].elements[1].updated_at, '2026-10-13T10:01:00Z', 'lots : updated_at d’une suppression avec payload = celui du payload');
  eq(c.lots[0].elements[2].updated_at, '2026-10-13T10:04:00Z', 'lots : updated_at d’un put disparu sans payload = celui de l’entrée de la file');
  eq(c.lots[0].seqs, [1, 3, 2, 5], 'lots : les seq de chaque clé suivent le lot');
  eq(c.retenues, [{ seq: 4, seqs: [4], raison: 'fichier en attente' }], 'lots : une ligne files est retenue tant que l’empreinte distante n’est pas confirmée (L4), tous les seq du groupe (R-L3-5)');

  const fichiersRepetes = [
    { seq: 4, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:03:00Z', tries: 0 },
    { seq: 6, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:05:00Z', tries: 0 },
  ];
  const cf = await composerLots(fichiersRepetes, async () => undefined);
  eq(cf.lots, [], 'lots : deux put du même fichier ne produisent aucun lot');
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
      const push = createPush({ db, transport: tf, surHeure: (h) => heures.push(h) });
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
      try { r = await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T20:00:05Z') }).envoyer(); }
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
      eq([(await createPush({ db, transport: tf }).envoyer()).envoyes, tf.journal.length], [0, 1], 'envoi : une entrée en quarantaine n’est plus jamais tentée');
    });

    // --- Envoi : lignes files retenues (R-L3-5) — marquées, jamais retirées, jamais envoyées
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'b9', title: 'Neuf' });
      const sha = 'a'.repeat(64);
      await repo.putFile(sha, new Blob(['x'], { type: 'image/jpeg' }), { original_filename: 'x.jpg' });
      eq((await db.getAll('outbox')).map((e) => e.store), ['books', 'files'], 'retenues : la ligne files est bien en file au départ');
      const tf = creerTransportFactice();
      const r = await createPush({ db, transport: tf }).envoyer();
      eq([r.envoyes, r.retenues, r.erreur], [1, 1, null], 'retenues : la ligne files est comptée retenue, le livre part quand même');
      eq(tf.journal[0].rows.map((e) => e.store), ['books'], 'retenues : aucun appel réseau ne contient la ligne files (R-L3-5)');
      const file = await db.getAll('outbox');
      eq(file.map((e) => [e.store, e.id, e.last_error, e.quarantined_at]), [['files', sha, 'fichier en attente', undefined]], 'retenues : l’entrée reste en file, marquée « fichier en attente », pas en quarantaine (R-L3-5)');
      // Marquée sans être retirée : la passe suivante la retient encore, et ne l'envoie toujours pas.
      const r2 = await createPush({ db, transport: tf }).envoyer();
      eq([r2.envoyes, r2.retenues, tf.journal.length], [0, 1, 1], 'retenues : une passe où tout est retenu ne fait aucun appel réseau');
    });

    // --- Envoi : une entrée dont l'heure de reprise n'est pas venue attend (next_try_at, spec § 5.3)
    await withRepo(async (repo, db) => {
      await repo.save('books', { id: 'ba', title: 'Attend' });
      const entree = (await db.getAll('outbox'))[0];
      await db.mutate({ puts: { outbox: [{ ...entree, next_try_at: '2026-10-13T21:00:00Z', tries: 1, last_error: 'reseau' }] }, origin: 'remote' });
      const tf = creerTransportFactice();
      eq((await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer()).envoyes, 0, 'envoi : avant next_try_at, l’entrée n’est pas relue');
      eq(tf.journal.length, 0, 'envoi : aucune entrée prête → aucun appel réseau');
      eq((await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T21:00:00Z') }).envoyer()).envoyes, 1, 'envoi : à next_try_at, l’entrée repart');
      // Un next_try_at illisible garerait l'entrée pour toujours : elle est éligible maintenant.
      await repo.save('books', { id: 'bn', title: 'Illisible' });
      const neuve = (await db.getAll('outbox')).find((e) => e.id === 'bn');
      await db.mutate({ puts: { outbox: [{ ...neuve, next_try_at: 'pas une date', tries: 2 }] }, origin: 'remote' });
      eq((await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer()).envoyes, 1, 'envoi : un next_try_at illisible n’immobilise pas l’entrée pour toujours');
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
      const r = await createPush({ db, transport: tf }).envoyer();
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
      const r = await createPush({ db, transport, maintenant: () => Date.parse('2026-10-13T20:00:05Z') }).envoyer();
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
      try { r = await createPush({ db, transport, maintenant: () => t }).envoyer(); } finally { console.error = vraiConsole; }
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
      try { r = await createPush({ db, transport: tf }).envoyer(); } finally { db.mutate = vraiMutate; }
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
        const push = createPush({ db, transport: tf, maintenant: () => t });
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
        const r = await createPush({ db, transport: tf, maintenant: () => t }).envoyer();
        eq([r.erreur?.type, r.recul, r.quarantaine], ['inconnu', 2000, 0], 'R-L3-9 : un type « inconnu » recule, il ne parque rien');
        const e = (await db.getAll('outbox'))[0];
        eq([e.tries, e.next_try_at, e.last_error, !!e.quarantined_at], [1, new Date(t + 2000).toISOString(), 'inconnu', false], 'R-L3-9 : l’entrée compte l’essai et son heure de reprise, jamais de quarantaine');
        eq(await db.count('outbox'), 1, 'R-L3-9 : rien n’est perdu sur un « inconnu »');
      });
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'a1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'auth', status: 401, message: 'x' } }] });
        const r = await createPush({ db, transport: tf }).envoyer();
        eq([r.attenteConnexion, r.erreur.type, (await db.getAll('outbox'))[0].tries], [true, 'auth', 0], 'envoi : 401 → en attente de connexion, sans compter d’essai');
      });
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'q1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'quota', status: 507, message: 'x' } }] });
        const r = await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer();
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
        const r = await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer();
        eq([r.envoyes, r.quarantaine], [3, 1], 'envoi : dichotomie → trois envoyées, une en quarantaine');
        eq(tf.journal.map((a) => a.rows.map((x) => x.id)), [['d1', 'd2', 'd3', 'd4'], ['d1', 'd2'], ['d3', 'd4'], ['d3'], ['d4']], 'envoi : le lot entier d’abord, puis des moitiés, jusqu’à isoler la fiche fautive');
        const reste = await db.getAll('outbox');
        eq(reste.map((e) => [e.seq, e.id, e.last_error, e.quarantined_at]), [[5, 'd3', 'refus', '2026-10-13T20:00:00.000Z']], 'envoi : seul le seq le plus haut de la clé isolée reste, en quarantaine, motif et heure posés');
        eq(await db.count('outbox'), 1, 'envoi : le doublon plus ancien de la clé isolée est retiré avec elle');
        // La quarantaine est permanente : la passe suivante ne retente rien et n’appelle plus le serveur.
        const appels = tf.journal.length;
        eq([(await createPush({ db, transport: tf }).envoyer()).envoyes, tf.journal.length], [0, appels], 'envoi : après la dichotomie, l’entrée isolée n’est plus jamais tentée');
      });
      await withRepo(async (repo, db) => {
        // Un échec réseau au milieu d’une dichotomie arrête tout : rien n’est mis en quarantaine par accident.
        for (const id of ['x1', 'x2']) await repo.save('books', { id, title: id });
        const tf = { journal: [], async pousser(rows) { tf.journal.push({ appel: 'pousser', rows: rows.map(({ store, id }) => ({ store, id })) }); return { reponse: null, erreur: rows.length > 1 ? { type: 'refus', status: 400, message: 'x' } : { type: 'reseau', status: 0, message: 'x' } }; } };
        const r = await createPush({ db, transport: tf, maintenant: () => Date.parse('2026-10-13T20:00:00Z') }).envoyer();
        eq([r.erreur.type, r.quarantaine, r.recul], ['reseau', 0, 2000], 'envoi : un échec réseau pendant la dichotomie arrête la passe, sans quarantaine');
        eq([tf.journal.map((a) => a.rows.map((x) => x.id)), await db.count('outbox')], [[['x1', 'x2'], ['x1']], 2], 'envoi : la moitié droite n’est pas tentée, la file est intacte');
      });
      await withRepo(async (repo, db) => {
        await repo.save('books', { id: 'n1', title: 'Un' });
        const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'auth', status: 400, message: 'adresse non autorisée' } }] });
        const r = await createPush({ db, transport: tf }).envoyer();
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
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).length, 24, 'envoi initial : 24 tables sans l’historique');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true }).length, 25, 'envoi initial : 25 tables avec l’historique');
  eq(tablesAEnvoyer({ marqueurs: { 'backfill:books': 'fait' }, isActivitySynced: () => false }).includes('books'), false, 'envoi initial : une table marquée « fait » ne repart pas');
  await withRepo(async (repo, db) => {
    // Bibliothèque d’AVANT la connexion : écrite sans capture (comme en L1, ou restaurée), puis compte connecté.
    await db.mutate({ puts: { books: [{ id: 'v1', title: 'Vieux', updated_at: '2026-10-01T00:00:00Z' }, { id: 'v2', title: 'Vieux 2', updated_at: '2026-10-01T00:00:00Z' }], files: [{ sha256: 'a'.repeat(64), mime: 'image/jpeg', size: 1, updated_at: '2026-10-01T00:00:00Z', syncable: true }, { sha256: 'b'.repeat(64), mime: 'application/octet-stream', size: 1, updated_at: '2026-10-01T00:00:00Z', syncable: false }] }, origin: 'device' });
    eq(await db.count('outbox'), 0, 'envoi initial : rien en file avant');
    const progression = [];
    const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, surProgression: (p) => progression.push(p), tailleMorceau: 1 });
    eq(r.tables.length, 24, 'envoi initial : les 24 tables sont parcourues');
    const file = await db.getAll('outbox');
    const refs = (await db.count('ingredients')) + (await db.count('unit_definitions')) + (await db.count('unit_conventions')); // amorçage mesuré : ingredients, unit_definitions, unit_conventions
    eq(file.length, refs + 2 + 1, 'envoi initial : références amorcées + 2 livres + 1 fichier synchronisable en file');
    ok(file.every((e) => e.op === 'put' && e.user_id === 'u1'), 'envoi initial : des put, au nom du compte');
    ok(!file.some((e) => e.store === 'files' && e.id === 'b'.repeat(64)), 'envoi initial : une ligne files syncable:false n’est jamais mise en file');
    eq((await db.get('sync_state', 'backfill:books'))?.value, 'fait', 'envoi initial : marqueur posé après la table');
    ok(progression.some((p) => p.table === 'books' && p.n >= 1 && p.total === 24), 'envoi initial : progression « table n/24 »');
    // Une table vide (aucune ligne) reçoit quand même son marqueur, sans aucune entrée en file pour elle.
    eq((await db.get('sync_state', 'backfill:dishes'))?.value, 'fait', 'envoi initial : une table vide est marquée « fait »');
    ok(!file.some((e) => e.store === 'dishes'), 'envoi initial : une table vide ne met jamais rien en file');
    const r2 = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false });
    eq([r2.mises, await db.count('outbox')], [0, refs + 3], 'envoi initial : rejoué → rien de plus (marqueurs)');
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
  const { decider, estAncetre, createPull } = await import('../src/sync/pull.js');
  const L = (u, extra = {}) => ({ id: 'x', updated_at: u, ...extra });
  eq(decider({ locale: undefined, distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'ecrire', 'réception : absent localement → écrit');
  eq(decider({ locale: L('t1'), distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'ecrire', 'réception : distant plus récent → écrit');
  eq(decider({ locale: L('t3'), distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'conflit_renvoyer', 'réception : local plus récent → conservé, conflit, renvoyé');
  eq(decider({ locale: L('t2', { a: 1 }), distante: { data: L('t2', { a: 1 }), updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : égalité identique → rien');
  eq(decider({ locale: L('t2', { a: 1 }), distante: { data: L('t2', { a: 2 }), updated_at: 't2', deleted_at: null } }), 'conflit', 'réception : égalité différente → conflit sans remise en file');
  eq(decider({ locale: L('t1'), distante: { data: {}, updated_at: 't2', deleted_at: 't2' } }), 'supprimer', 'réception : tombale → suppression');
  eq(decider({ locale: undefined, distante: { data: {}, updated_at: 't2', deleted_at: 't2' } }), 'ignorer', 'réception : tombale d’une fiche inconnue → rien');
  // jsonb RÉORDONNE les clés : la copie du serveur revient presque toujours dans un autre ordre que la fiche locale.
  // Comparées par JSON brut, deux fiches identiques feraient un conflit à chaque égalité d'updated_at.
  eq(decider({ locale: { id: 'x', a: 1, b: 2, updated_at: 't2' }, distante: { data: { updated_at: 't2', b: 2, a: 1, id: 'x' }, updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : mêmes champs dans un autre ordre (jsonb réordonne) → identiques, rien');
  eq(decider({ locale: { id: 'x', updated_at: 't2', meta: { z: 1, liste: [{ q: 1, p: 2 }] } }, distante: { data: { meta: { liste: [{ p: 2, q: 1 }], z: 1 }, id: 'x', updated_at: 't2' }, updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : ordre des clés différent EN PROFONDEUR → identiques (tri récursif)');
  eq(decider({ locale: { id: 'x', updated_at: 't2', liste: [1, 2] }, distante: { data: { id: 'x', updated_at: 't2', liste: [2, 1] }, updated_at: 't2', deleted_at: null } }), 'conflit', 'réception : l’ordre d’un TABLEAU reste une différence (une liste d’étapes a un ordre)');
  const versions = [{ id: 'v1', parent_version_id: null }, { id: 'v2', parent_version_id: 'v1' }, { id: 'v3', parent_version_id: 'v2' }, { id: 'w1', parent_version_id: 'v1' }];
  eq([estAncetre(versions, 'v1', 'v3'), estAncetre(versions, 'v2', 'v3'), estAncetre(versions, 'w1', 'v3'), estAncetre(versions, 'v3', 'v3')], [true, true, false, true], 'réception : ancêtre de version (chaîne parent_version_id)');

  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'p1', title: 'Ici plus récent', updated_at: '2026-10-13T12:00:00Z' });
    await repo.save('books', { id: 'p3', title: 'À supprimer', updated_at: '2026-10-13T10:00:00Z' });
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
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
      eq(tf.journal.filter((a) => a.appel === 'lire').length, 1, 'réception : la table en erreur arrête la passe, les suivantes ne sont pas lues');
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
    ok((await db.get('files', sha)).blob instanceof Blob, 'réception : une ligne files reçue n’efface jamais le blob local');
    const sans = await db.get('files', 'd'.repeat(64));
    eq([sans.remote, 'blob' in sans], [true, false], 'réception : une ligne files inconnue arrive remote:true, sans octets (L4 les téléchargera)');
  });
  await withRepo(async (repo, db) => {
    // Pointeur de version : la version locale pointée n’est pas un ancêtre de la version reçue → conflit « version ».
    await db.mutate({ puts: { recipes: [{ id: 'r1', current_version_id: 'w1', updated_at: '2026-10-13T10:00:00Z' }], recipe_versions: [{ id: 'v1', recipe_id: 'r1', parent_version_id: null, updated_at: 't' }, { id: 'w1', recipe_id: 'r1', parent_version_id: 'v1', updated_at: 't' }, { id: 'v2', recipe_id: 'r1', parent_version_id: 'v1', updated_at: 't' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { recipes: [[{ id: 'r1', data: { id: 'r1', current_version_id: 'v2', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 9 }], []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq((await db.get('recipes', 'r1')).current_version_id, 'v2', 'réception : la fiche recette reçue (plus récente) est écrite');
    const c = await db.get('sync_conflicts', 'recipes:r1');
    eq([c?.kind, r.conflits], ['version', 1], 'réception : conflit « version » journalisé — aucune version masquée');
    eq(await db.count('recipe_versions'), 3, 'réception : aucune version n’est masquée ni retirée par le conflit de pointeur');
    eq((await db.getAll('outbox')).length, 0, 'réception : un conflit de pointeur ne remet rien en file (la fiche reçue a gagné)');
  });
  await withRepo(async (repo, db) => {
    // Le pointeur qui AVANCE dans la même chaîne n’est pas un conflit : c’est l’adaptation faite ailleurs.
    await db.mutate({ puts: { recipes: [{ id: 'r2', current_version_id: 'v1', updated_at: '2026-10-13T10:00:00Z' }], recipe_versions: [{ id: 'v1', recipe_id: 'r2', parent_version_id: null, updated_at: 't' }, { id: 'v2', recipe_id: 'r2', parent_version_id: 'v1', updated_at: 't' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { recipes: [[{ id: 'r2', data: { id: 'r2', current_version_id: 'v2', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 9 }], []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq([r.conflits, (await db.get('recipes', 'r2')).current_version_id], [0, 'v2'], 'réception : un pointeur qui avance dans la même chaîne n’est pas un conflit');
  });

  // --- Conflits : gestes (spec § 5.5)
  const { garderIci, garderAilleurs, purgerAnciens } = await import('../src/sync/conflits.js');
  await withRepo(async (repo, db) => {
    const conflit = { id: 'books:k1', store: 'books', record_id: 'k1', local: { id: 'k1', title: 'ici', updated_at: '2026-10-13T12:00:00Z' }, server: { data: { id: 'k1', title: 'ailleurs', updated_at: '2026-10-13T12:00:00Z' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees' };
    await db.mutate({ puts: { sync_conflicts: [conflit], books: [conflit.server.data] }, origin: 'device' });
    await garderIci(db, conflit);
    const k = await db.get('books', 'k1');
    ok(k.title === 'ici' && k.updated_at > '2026-10-13T12:00:00Z', 'conflits : « Garder celle d’ici » restaure la version locale avec un updated_at neuf');
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
    eq([await db.get('books', 'k3'), (await db.getAll('outbox')).map((e) => [e.store, e.id, e.op]), await db.get('sync_conflicts', 'books:k3')], [undefined, [['books', 'k3', 'delete']], undefined], 'conflits : la suppression d’ici repart en file, et le conflit est effacé');
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
}
