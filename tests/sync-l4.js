// Suite du lot G « Les photos voyagent entre appareils » (spec 2026-10-19, rév. 4) : données, projection, réception et capture (tâche 1),
// archive (2), Storage factice et passe fichiers (3), moteur (4), Réglages (5), écrans (6). Bases jetables, aucun réseau, aucune clé.
// Chaque assertion nomme le mutant qu'elle tue (rejoués sur une copie à la clôture).
import { withRepo } from './sync-fixture.js';
import { creerTransportFactice } from './transport-factice.js';
import { resetClock } from '../src/sync/clock.js';
import { sha256Hex } from '../src/core/hash.js';

const DATE = '2026-10-19T00:00:00.000Z';
const H = (c) => c.repeat(64); // une empreinte lisible : H('a') = « aaaa… » (64)
// Un `remote` valide de ce compte (u1, l'utilisateur de withRepo) ; chaque test surcharge ce qui le concerne.
const R = (sur = {}) => ({ sha256: H('e'), size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE, owner: 'u1', ...sur });
const octets = (texte, type = 'image/jpeg') => new Blob([texte], { type });
// Une ligne `files` qui porte son ORIGINAL : clé = empreinte des octets, taille = taille des octets.
async function original(texte, sur = {}) {
  const blob = octets(texte);
  return { sha256: await sha256Hex(blob), mime: 'image/jpeg', size: blob.size, blob, syncable: true, created_at: DATE, updated_at: DATE, ...sur };
}
const sansBlob = (ligne) => { const { blob: _octets, ...reste } = ligne; return reste; };
const MAGASINS_SNAPSHOT = ['source_pages', 'source_documents', 'book_editions', 'recipes', 'imports', 'files', 'books'];

export async function runSyncL4Tests({ eq, ok }) {
  resetClock();
  const run = async (nom, test) => {
    try { await test(); }
    catch (error) { ok(false, `Lot G — ${nom} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); }
    finally { resetClock(); } // une heure serveur reçue (createPush) ne survit jamais à son test
  };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const T = await import('../src/sync/tables.js');
  const F = await import('../src/sync/fichiers.js');
  const { SYNC_STORES } = await import('../src/model/schema.js');

  // === Tâche 1 — données, projection, réception, capture

  await run('schéma et projection', async () => {
    eq([...T.CHAMPS_FILES_SERVEUR], ['sha256', 'mime', 'size', 'original_filename', 'remote', 'updated_at'], 'D-G8 : CHAMPS_FILES_SERVEUR exact');
    const ligne = { sha256: H('a'), mime: 'image/jpeg', size: 3, original_filename: 'p.jpg', blob: octets('abc'), syncable: true, created_at: DATE, updated_at: DATE, remote: R({ owner: 'u2' }) };
    const proj = T.projectionFichier(ligne);
    eq(Object.keys(proj).sort(), ['mime', 'original_filename', 'remote', 'sha256', 'size', 'updated_at'], 'projection : exactement les champs du serveur, ni blob, ni syncable, ni created_at (mutant : blob gardé → la projection porte un Blob)');
    eq(proj.remote, R({ owner: 'u2' }), 'projection : un remote d’un autre compte voyage tel quel (S-8 : l’écho doit se lire pareil des deux côtés)');
    eq([T.projectionFichier({ ...ligne, remote: true }).remote, T.projectionFichier({ sha256: H('a') }).remote], [null, null], 'projection : remote true (L3) ou absent → null');
    const etranger = Object.assign(Object.create({ herite: 1 }), R());
    const formes = [
      [R(), true], [{ ...R(), version: 2 }, true], [true, false], [null, false], [etranger, false], [R({ sha256: 'abc' }), false],
      [R({ size: 0 }), false], [R({ size: 52428801 }), false], [R({ mime: 'image/svg+xml' }), false], [R({ quality: 'haute' }), false],
      [R({ owner: '' }), false], [R({ uploaded_at: 5 }), false], [[R()], false], ['remote', false],
    ];
    eq(formes.map(([r]) => T.remoteValide(r)), formes.map(([, v]) => v), 'remoteValide : 14 formes — valide ; champ en plus ignoré (F-23) ; true, null, prototype étranger, empreinte courte, taille 0 et 52 428 801, svg, qualité inconnue, owner vide, uploaded_at nombre, tableau, chaîne refusés (mutants : borne de taille retirée ; champ en plus refusé)');
    eq([T.remoteDeCeCompte(R(), 'u1'), T.remoteDeCeCompte(R(), 'u2'), T.remoteDeCeCompte(R(), null)], [true, false, false], 'remoteDeCeCompte : même owner, autre owner, uid nul');
    eq([F.remoteValide === T.remoteValide, F.remoteDeCeCompte === T.remoteDeCeCompte], [true, true], 'I-G10 : fichiers.js réexporte les définitions de tables.js, il n’en écrit pas d’autres');
  });

  await run('originaux, copies, références, états, noms', async () => {
    const orig = await original('original-de-dix-huit');
    const reduite = { ...orig, blob: octets('jpg'), remote: R({ size: 3 }) };
    const fausseOriginale = { ...orig, blob: octets('jpg'), remote: R({ sha256: orig.sha256, size: 3 }) };
    const partieTelleQuelle = { ...orig, remote: R({ sha256: orig.sha256, size: orig.size }) };
    eq([F.estOriginalIci(orig), F.estOriginalIci(reduite), F.estOriginalIci(fausseOriginale), F.estOriginalIci(sansBlob(orig)), F.estOriginalIci(partieTelleQuelle)],
      [true, false, false, false, true], 'estOriginalIci : original ; copie réduite ; copie de la taille de remote dont remote.sha256 = clé (faux : la disjonction de la rév. 1 retirée, S-3) ; sans blob ; parti tel quel');
    eq([F.copiePerimee({ ...orig, blob: octets('vieille'), remote: R({ size: 3 }) }), F.copiePerimee(reduite), F.copiePerimee(orig)], [true, false, false], 'copiePerimee : copie dont la taille n’est plus celle du serveur ; copie fidèle ; original');
    const snap = { source_pages: [{ id: 'p1', sha256: H('1') }], source_documents: [{ id: 'd1', sha256: H('2') }], book_editions: [{ id: 'e1', cover_sha256: H('3') }], recipes: [{ id: 'r1', photo_sha256: H('4') }], imports: [{ id: 'i1', photo_sha256: H('5') }, { id: 'i2', photo_sha256: 'pas-une-empreinte' }], files: [{ sha256: H('6') }] };
    eq([...F.referencesFichiers(snap)].sort(), [H('1'), H('2'), H('3'), H('4'), H('5')], 'referencesFichiers : les cinq pointeurs, une valeur non HASH ignorée, l’orphelin exclu (mutant : imports.photo_sha256 retiré de la liste)');
    const distant = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    eq([F.etatFichier(orig, { uid: 'u1', erreurs: new Set([orig.sha256]) }), F.etatFichier(orig, { uid: 'u1' }), F.etatFichier(distant, { uid: 'u1' }), F.etatFichier({ ...distant, remote: R({ owner: 'u2' }) }, { uid: 'u1' }), F.etatFichier({ ...distant, remote: null }, { uid: 'u1' }), F.etatFichier(distant, { uid: null }), F.etatFichier(null, { uid: 'u1' })],
      ['erreur', 'present', 'distant', 'absent', 'absent', 'absent', 'absent'], 'etatFichier : erreur prime ; present ; distant ; remote d’un autre owner → absent (R-G-2 ; mutant : owner ignoré → distant) ; sans remote ; sans compte connu ; sans ligne');
    const snapNom = {
      books: [{ id: 'b1', title: 'Mon livre' }],
      book_editions: [{ id: 'e1', book_id: 'b1', cover_sha256: H('3') }],
      source_documents: [{ id: 'd1', edition_id: 'e1', sha256: H('1') }, { id: 'd2', edition_id: 'e1', sha256: H('2'), original_filename: 'menu.pdf' }, { id: 'd3', edition_id: null, sha256: H('8') }],
      source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12 }, { id: 'p2', document_id: 'd1', sha256: H('9'), printed_page: null }, { id: 'p3', document_id: 'd3', sha256: H('8'), printed_page: 4 }, { id: 'p4', document_id: 'd3', sha256: H('b'), printed_page: null }],
      recipes: [{ id: 'r1', original_title: 'Tarte', photo_sha256: H('4') }],
      imports: [{ id: 'i1', photo_sha256: H('5'), created_at: '2026-10-18T14:00:00.000Z' }],
    };
    eq([H('1'), H('9'), H('8'), H('b'), H('2'), H('3'), H('4'), H('5'), H('6')].map((s) => F.nomFichier(s, snapNom)),
      ['Page 12 · Mon livre', 'page non numérotée · Mon livre', 'Page 4', 'page non numérotée', 'menu.pdf', 'Couverture · Mon livre', 'Photo du plat · Tarte', 'Photo importée · 2026-10-18', H('6').slice(0, 12)],
      'nomFichier (B-23, I-G8) : page numérotée, page non numérotée, page sans livre, page sans livre ni numéro (« page non numérotée » : chaîne hors § 5, ruling de construction), nom d’origine d’un document, couverture, photo du plat, photo importée, repli sur l’empreinte tronquée à 12');
  });

  await run('candidats, fusions et gardes de relecture', async () => {
    const a = await original('candidat-a', { created_at: '2026-10-19T00:00:03.000Z' });
    const b = await original('candidat-b', { created_at: '2026-10-19T00:00:01.000Z' });
    const c = await original('candidat-c', { syncable: false });
    const d = await original('candidat-d', { created_at: '2026-10-19T00:00:02.000Z', remote: R({ sha256: H('d') }) }); // déjà partie réduite sous ce compte
    const e = await original('candidat-e', { created_at: '2026-10-19T00:00:04.000Z', remote: R({ owner: 'u2' }) }); // partie sous un autre compte
    const g = await original('candidat-g', { created_at: undefined, updated_at: '2026-10-19T00:00:00.500Z' }); // reçue : pas de created_at (B-20)
    const orpheline = await original('orpheline');
    const snap = { source_pages: [a, b, c, d, e, g].map((l, i) => ({ id: 'p' + i, sha256: l.sha256 })), files: [a, b, c, d, e, g, orpheline, { ...sansBlob(a), sha256: H('f') }] };
    eq(F.candidatsEnvoi(snap, { uid: 'u1' }).map((l) => l.sha256), [g.sha256, b.sha256, a.sha256, e.sha256], 'candidatsEnvoi : originaux référencés et syncables sans remote de ce compte (un autre owner repart sous ce compte), triés par created_at ?? updated_at ; ni orpheline, ni type inconnu, ni ligne sans octets');
    eq(F.candidatsEnvoi(snap, { uid: 'u1', renvoi: true }).map((l) => l.sha256), [g.sha256, b.sha256, d.sha256, a.sha256, e.sha256], 'candidatsEnvoi (renvoi) : la ligne partie réduite sous ce compte s’ajoute (B-21)');
    eq(F.candidatsEnvoi(snap, { uid: 'u1', erreurs: new Set([b.sha256]) }).map((l) => l.sha256), [g.sha256, a.sha256, e.sha256], 'candidatsEnvoi : une ligne en file_error n’est pas candidate');
    const locale = { ...a, original_filename: 'x.jpg', remote: R({ owner: 'u2' }) };
    const f1 = F.fusionnerFichier(locale, { sha256: a.sha256, mime: 'image/jpeg', size: a.size, original_filename: 'x.jpg', remote: R(), updated_at: 'celle-du-corps' }, '2026-10-20T00:00:00.000Z');
    eq([f1.blob === a.blob, f1.syncable, f1.created_at, f1.remote, f1.updated_at], [true, true, a.created_at, R(), '2026-10-20T00:00:00.000Z'], 'fusionnerFichier (D-G16) : blob, syncable et created_at locaux gardés ; remote de data ; updated_at du serveur');
    const f2 = F.fusionnerFichier(locale, { remote: null }, '2030-01-01T00:00:00.000Z');
    eq([f2.blob === a.blob, f2.remote, f2.mime, f2.size], [true, null, 'image/jpeg', a.size], 'fusionnerFichier : data = { remote: null } (tombale) → ligne et blob gardés, remote nul');
    const f3 = F.fusionnerFichier(sansBlob(locale), { sha256: a.sha256, mime: 'image/jpeg', size: a.size }, DATE);
    eq(['remote' in f3, 'blob' in f3], [false, false], 'fusionnerFichier : data sans remote → remote absent, ni true ni gardé du local (mutants : delete fiche.remote ; fiche.remote = true)');
    const existante = { sha256: H('7'), mime: 'image/heic', size: 999, updated_at: DATE, remote: R({ mime: 'image/jpeg' }) };
    const recue = octets('octets-recus');
    const fo = F.fusionnerOctetsRecus(existante, recue);
    eq([fo.blob === recue, fo.size, fo.mime, fo.updated_at, fo.syncable, fo.remote], [true, 999, 'image/heic', DATE, true, R({ mime: 'image/jpeg' })], 'fusionnerOctetsRecus : size, mime, updated_at et remote de la ligne intacts ; syncable résolu par la liste blanche');
    const avant = { ...a };
    const garde = { h: H('e'), uid: 'u1' };
    eq([
      F.peutEcrireRemote(avant, { ...avant }, garde),
      F.peutEcrireRemote(avant, { ...avant, updated_at: '2026-10-19T09:00:00.000Z' }, garde),
      F.peutEcrireRemote(avant, undefined, garde),
      F.peutEcrireRemote(avant, sansBlob(avant), garde),
      F.peutEcrireRemote(avant, { ...avant, remote: R({ sha256: H('e') }) }, garde),
      F.peutEcrireRemote(avant, { ...avant, remote: R({ sha256: H('d') }) }, garde),
      F.peutEcrireRemote(avant, { ...avant, remote: R({ sha256: H('e'), owner: 'u2' }) }, garde),
    ], [true, false, false, false, false, true, true], 'peutEcrireRemote (N-2) : inchangée → oui ; updated_at changé, disparue, sans blob, déjà posée pour CETTE empreinte sous CE compte → non ; renvoi en originale et ré-envoi sous ce compte → oui (mutants : garde de la rév. 2 « autre empreinte → rien » ; updated_at ignoré)');
    const aRecevoir = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    eq([F.peutEcrireOctets(aRecevoir, { ...aRecevoir, blob: octets('x') }), F.peutEcrireOctets(aRecevoir, { ...aRecevoir, updated_at: '2026-10-19T09:00:00.000Z' }), F.peutEcrireOctets(aRecevoir, undefined), F.peutEcrireOctets(aRecevoir, { ...aRecevoir })],
      [false, false, false, true], 'peutEcrireOctets : blob déjà là, ligne modifiée, ligne disparue → non ; sinon oui');
  });

  await run('passe unique : remote true retiré (D-G12)', async () => {
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [
        { sha256: H('a'), mime: 'image/jpeg', size: 1, remote: true, updated_at: '2026-10-01T00:00:00.000Z' },
        { sha256: H('b'), mime: 'image/png', size: 2, remote: true, updated_at: '2026-10-02T00:00:00.000Z' },
        { sha256: H('c'), mime: 'image/jpeg', size: 3, updated_at: '2026-10-03T00:00:00.000Z' },
      ] }, origin: 'device' });
      await db.mutate({ deletes: { sync_state: ['files_remote_v2'] }, origin: 'device' }); // la fixture a déjà joué init() : la garde est retirée pour rejouer
      const vues = [];
      const vrai = db.mutate;
      db.mutate = function (args) { vues.push(args); return vrai.call(this, args); };
      try {
        await repo.init();
        const [la, lb, lc] = await Promise.all([H('a'), H('b'), H('c')].map((s) => db.get('files', s)));
        eq(['remote' in la, 'remote' in lb, la.updated_at, lb.updated_at, lc.updated_at], [false, false, '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-03T00:00:00.000Z'], 'passe unique : le booléen retiré des deux lignes de L3, updated_at conservé (mutant : updated_at réécrit)');
        const ecritures = vues.filter((m) => m.puts?.files);
        eq([ecritures.length, ecritures[0]?.origin, (ecritures[0]?.puts.files || []).map((l) => l.sha256).sort(), (ecritures[0]?.puts.sync_state || []).some((l) => l.key === 'files_remote_v2'), (await db.get('sync_state', 'files_remote_v2'))?.value, await db.count('outbox')], [1, 'device', [H('a'), H('b')], true, 1, 0], 'passe unique : UNE transaction d’origine device, la garde DANS la même transaction que les lignes, la ligne saine non réécrite, rien en file (mutant : garde écrite par un second mutate)');
        vues.length = 0;
        await repo.init();
        eq(vues.filter((m) => m.puts?.files || (m.puts?.sync_state || []).some((l) => l.key === 'files_remote_v2')).length, 0, 'passe unique : au second démarrage, aucune transaction (garde)');
      } finally { delete db.mutate; }
    });
  });

  await run('putFile : métadonnées nettoyées, octets reçus par une seule règle', async () => {
    await withRepo(async (repo, db) => {
      const sale = octets('photo-sale'); const shaSale = await sha256Hex(sale);
      await repo.putFile(shaSale, sale, { original_filename: 'a' + String.fromCharCode(0) + 'b.jpg' });
      eq((await db.get('files', shaSale)).original_filename, 'ab.jpg', 'putFile (B-27) : les métadonnées passent par nettoyerChaines (classe R61)');
      const existante = { sha256: H('7'), mime: 'image/heic', size: 999, updated_at: DATE, remote: R({ mime: 'image/jpeg' }) };
      await db.mutate({ puts: { files: [existante] }, origin: 'remote' });
      const recue = octets('octets-recus');
      await repo.putFile(H('7'), recue, { origin: 'remote' });
      const ecrite = await db.get('files', H('7'));
      const attendue = F.fusionnerOctetsRecus(existante, recue);
      eq([ecrite.size, ecrite.mime, ecrite.updated_at, ecrite.syncable, ecrite.remote, ecrite.blob instanceof Blob, ecrite.blob.size, await db.count('outbox')], [attendue.size, attendue.mime, attendue.updated_at, attendue.syncable, attendue.remote, true, recue.size, 0], 'putFile origin remote = fusionnerOctetsRecus (F-20 : une règle, deux appelants ; mutant : putFile ordinaire → size réécrit)');
    });
  });

  await run('capture des lignes files (D-G8)', async () => {
    await withRepo(async (repo, db) => {
      const photo = octets('photo-capture'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, { original_filename: 'p.jpg' });
      eq(await db.count('outbox'), 0, 'capture : une photo posée n’entre pas en file (R-L3-22 tenu ; mutant : wanted sans la condition remote)');
      const ligne = await db.get('files', sha);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ sha256: sha, size: photo.size }), updated_at: '2026-10-19T01:00:00.000Z' }] }, origin: 'local' });
      eq((await db.getAll('outbox')).map((e) => [e.store, e.id, e.op, e.user_id]), [['files', sha, 'put', 'u1']], 'capture : la même ligne avec un remote valide de ce compte → UNE entrée files');
      await db.mutate({ puts: { files: [{ ...ligne, remote: true }] }, origin: 'local' });
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ owner: 'u2' }) }] }, origin: 'local' });
      await db.mutate({ puts: { files: [{ ...ligne, syncable: false, remote: R() }] }, origin: 'local' });
      eq(await db.count('outbox'), 1, 'capture : remote true, remote d’un autre compte, syncable false → aucune entrée de plus');
      await db.mutate({ deletes: { files: [sha] }, payloads: { files: { [sha]: ligne } }, origin: 'local' });
      eq(await db.count('outbox'), 1, 'capture : une suppression locale de files n’est JAMAIS capturée (D-G15 ; mutant : deletes capturés)');
    });
  });

  await run('lots : projection et retenue après relecture', async () => {
    const { composerLots } = await import('../src/sync/lots.js');
    const fiche = { sha256: H('a'), mime: 'image/jpeg', size: 3, original_filename: 'p.jpg', blob: octets('abc'), syncable: true, created_at: DATE, updated_at: DATE, remote: R({ sha256: H('a'), size: 3 }) };
    const entree = (seq) => ({ seq, user_id: 'u1', store: 'files', id: H('a'), op: 'put', updated_at: DATE, tries: 0 });
    const c1 = await composerLots([entree(1)], async () => fiche);
    eq([c1.lots.length, Object.keys(c1.lots[0]?.elements[0]?.data || {}).sort(), c1.retenues], [1, ['mime', 'original_filename', 'remote', 'sha256', 'size', 'updated_at'], []], 'lots : un remote de ce compte → l’élément porte exactement CHAMPS_FILES_SERVEUR, sans blob (mutant : projection non appliquée)');
    const c2 = await composerLots([entree(2)], async () => ({ ...fiche, remote: null }));
    const c3 = await composerLots([entree(3)], async () => ({ ...fiche, remote: R({ owner: 'u2' }) }));
    const c4 = await composerLots([{ ...entree(4), op: 'delete', payload: fiche }], async () => fiche);
    eq([c2.lots, c2.retenues.map((r) => r.raison), c3.lots, c3.retenues.map((r) => r.raison), c4.lots, c4.retenues.length], [[], ['fichier en attente'], [], ['fichier en attente'], [], 1], 'lots : sans remote de ce compte (aucun, ou d’un autre owner) → retenue « fichier en attente » ; une entrée delete de files ne part jamais');
    const tf = creerTransportFactice({ serveur: true });
    const reponse = (await tf.pousser([{ store: 'files', id: H('a'), data: { sha256: H('a'), blob: {} }, updated_at: DATE, deleted: false }])).reponse;
    eq(reponse.rejected.map((r) => r.reason), ['forme'], 'factice serveur : une ligne files qui porte blob est refusée « forme » (contrôle not (data ? blob) de 0001)');
  });

  await run('envoi initial de files filtré', async () => {
    const { tablesCandidates, envoiInitial } = await import('../src/sync/backfill.js');
    ok(tablesCandidates().includes('files'), 'envoi initial : files est candidate (D-G8)');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { sync_state: SYNC_STORES.filter((t) => t !== 'files').map((t) => ({ key: `backfill:${t}`, value: 'fait' })) }, origin: 'device' });
      await db.mutate({ puts: { files: [
        { sha256: H('1'), mime: 'image/jpeg', size: 1, syncable: true, updated_at: DATE, remote: R({ sha256: H('1'), size: 1 }) },
        { sha256: H('2'), mime: 'image/jpeg', size: 1, syncable: true, updated_at: DATE },
        { sha256: H('3'), mime: 'image/jpeg', size: 1, syncable: true, updated_at: DATE, remote: R({ owner: 'u2' }) },
        { sha256: H('4'), mime: 'application/octet-stream', size: 1, syncable: false, updated_at: DATE, remote: R() },
      ] }, origin: 'device' });
      await envoiInitial({ db, getUserId: () => 'u1' });
      eq([(await db.getAll('outbox')).map((e) => [e.store, e.id, e.user_id]), (await db.get('sync_state', 'backfill:files'))?.value], [[['files', H('1'), 'u1']], 'fait'], 'envoi initial : UNE entrée (seule la ligne syncable à remote valide de ce compte), marqueur posé (mutant : filtre retiré → quatre entrées)');
    });
  });

  await run('archive : une ligne sans octets ni remote ne fait plus lever (D-G12, dès la tâche 1)', async () => {
    // La passe unique retire le booléen : une ligne reçue sans octets n'a plus `remote: true`. Sans les deux lignes de backup.js remontées de la
    // tâche 2, createArchive lèverait « Fichier source invalide » sur elle entre les commits des tâches 1 et 2.
    const B1 = await import('../src/domain/backup.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('1'), mime: 'image/jpeg', size: 3, updated_at: DATE }] }, origin: 'device' });
      const a = await B1.createArchive(db);
      eq([a.missingFiles, a.manifest.files.some((f) => f.sha256 === H('1'))], [1, false], 'createArchive (D-G12) : une ligne sans octets ni remote est « manquante », jamais une levée (mutant : `file.remote` exigé → « Fichier source invalide »)');
    });
  });

  await run('réception : identiques sur la projection (R56)', async () => {
    const { decider } = await import('../src/sync/pull.js');
    const locale = { sha256: H('a'), mime: 'image/jpeg', size: 3, blob: octets('abc'), syncable: true, created_at: DATE, updated_at: DATE, remote: R() };
    const distante = { id: H('a'), data: { sha256: H('a'), mime: 'image/jpeg', size: 3, remote: R(), updated_at: DATE }, updated_at: DATE, deleted_at: null };
    eq([decider({ locale, distante, table: 'files' }), decider({ locale: { id: 'b1', title: 'x', updated_at: DATE }, distante: { id: 'b1', data: { id: 'b1', title: 'y', updated_at: DATE }, updated_at: DATE, deleted_at: null } })],
      ['ignorer', 'conflit'], 'R56 : à instant égal, une ligne files qui ne diffère que par blob, syncable et created_at est identique (mutant : identiques sans projection → conflit) ; decider à deux clés (L3) inchangé');
  });

  await run('réception : A et B ont le même original (B-1)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const photo = octets('meme-photo'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, {});
      await db.mutate({ puts: { source_pages: [{ id: 'pgAB', document_id: 'dAB', sha256: sha, updated_at: DATE }] }, origin: 'device' });
      const remoteA = R({ sha256: H('e'), size: 400 });
      const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: { sha256: sha, mime: 'image/jpeg', size: photo.size, remote: remoteA, updated_at: '2030-01-01T00:00:00.000Z' }, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: null, server_seq: 1 }], []] } });
      await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      const b = await db.get('files', sha);
      eq([b.blob instanceof Blob, b.remote, F.candidatsEnvoi(await db.getSnapshot(MAGASINS_SNAPSHOT), { uid: 'u1' }).length], [true, remoteA, 0], 'B-1 : B garde blob ET le remote reçu, et n’est plus candidat (mutant : delete fiche.remote réintroduit → renvoi perpétuel)');
    });
  });

  await run('réception : ligne sans remote', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const tf = creerTransportFactice({ lire: { files: [[{ id: H('d'), data: { sha256: H('d'), mime: 'image/png', size: 2, updated_at: '2030-01-01T00:00:00.000Z' }, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: null, server_seq: 4 }], []] } });
      await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      const sans = await db.get('files', H('d'));
      eq(['remote' in sans, 'blob' in sans, F.etatFichier(sans, { uid: 'u1' })], [false, false, 'absent'], 'D-G12 : une ligne reçue sans remote n’est plus marquée remote: true (mutant : fiche.remote = true réintroduit)');
    });
  });

  await run('réception : tombale files sur une ligne avec blob (D-G15, N-4)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const photo = octets('photo-tombale'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, { original_filename: 't.jpg' });
      const avant = await db.get('files', sha);
      await db.mutate({ puts: { files: [{ ...avant, remote: R({ sha256: sha, size: photo.size }) }] }, origin: 'device' });
      const journal = [];
      const vraiConsole = console.error;
      console.error = (...a) => journal.push(String(a[0]));
      let bilan = null;
      try {
        const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z', server_seq: 9 }], []] } });
        bilan = await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      } finally { console.error = vraiConsole; }
      const apres = await db.get('files', sha);
      eq([apres?.blob instanceof Blob, apres?.syncable, apres?.created_at, apres?.original_filename, apres?.remote, apres?.updated_at, await db.count('outbox'), (await db.get('sync_state', 'cursor:files'))?.value, bilan.recues, bilan.supprimees],
        [true, true, avant.created_at, 't.jpg', null, '2030-01-01T00:00:00.000Z', 0, 9, 1, 0], 'tombale files : ligne et blob gardés, syncable et created_at gardés, remote nul, updated_at de la tombale, rien en file, curseur avancé, comptée en recues et jamais en supprimees (mutants : deletes.files réintroduit → blob perdu ; tombale ignorée → remote gardé)');
      ok(journal.some((l) => l.includes('sync.pull.tombale_files')), 'tombale files : journalisée par son code');
    });
  });

  await run('réception : tombales files sans blob, inconnue, plus ancienne', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    const { composerLots } = await import('../src/sync/lots.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, { sha256: H('8'), mime: 'image/jpeg', size: 5, updated_at: '2031-01-01T00:00:00.000Z', remote: R({ sha256: H('8'), size: 5 }) }, { sha256: H('6'), mime: 'image/jpeg', size: 5, updated_at: '2031-01-01T00:00:00.000Z', remote: null }] }, origin: 'device' });
      const tombale = (id, seq) => ({ id, data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z', server_seq: seq });
      const tf = creerTransportFactice({ lire: { files: [[tombale(H('7'), 1), tombale(H('9'), 2), tombale(H('8'), 3), tombale(H('6'), 4)], []] } });
      const vraiConsole = console.error;
      console.error = () => {};
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { console.error = vraiConsole; }
      const sept = await db.get('files', H('7'));
      const file = await db.getAll('outbox');
      const conflits = await db.getAll('sync_conflicts');
      eq([sept?.remote, F.etatFichier(sept, { uid: 'u1' }), await db.get('files', H('9')), (await db.get('files', H('8')))?.remote, file.filter((e) => e.id === H('8')).map((e) => [e.store, e.id, e.op]), conflits.filter((c) => c.record_id === H('8')).map((c) => [c.store, c.record_id, c.renvoye])],
        [null, 'absent', undefined, R({ sha256: H('8'), size: 5 }), [['files', H('8'), 'put']], [['files', H('8'), true]]], 'tombales files : sans blob → ligne gardée, remote nul (état absent) ; clé inconnue → rien ; plus ancienne que la ligne → conflit_renvoyer comme en L3 (ligne intacte, remise en file)');
      // § 7 : une ligne SANS remote de ce compte, plus récente que la tombale, est remise en file comme en L3 — puis retenue à la composition.
      const six = file.filter((e) => e.store === 'files' && e.id === H('6'));
      const c6 = await composerLots(six, (store, id) => db.get(store, id));
      eq([six.length, (await db.get('files', H('6')))?.updated_at, conflits.some((c) => c.record_id === H('6') && c.renvoye === true), c6.lots, c6.retenues.map((r) => r.raison)], [1, '2031-01-01T00:00:00.000Z', true, [], ['fichier en attente']],
        'tombale plus ancienne sur une ligne SANS remote de ce compte : intacte et remise en file (L3), puis retenue « fichier en attente » à la composition — elle ne part jamais sans copie serveur (§ 7 ; mutant : elementFichier sans la garde remote → un lot part)');
    });
  });

  await run('réception : un remote qui change lève file_error de réception (F-7)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }], sync_state: [{ key: 'file_error:' + H('7'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: { files: [[{ id: H('7'), data: { sha256: H('7'), mime: 'image/jpeg', size: 5, remote: R({ sha256: H('d') }), updated_at: '2030-01-01T00:00:00.000Z' }, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: null, server_seq: 1 }], []] } });
      const vues = [];
      const vrai = db.mutate;
      db.mutate = function (args) { vues.push(args); return vrai.call(this, args); };
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { delete db.mutate; }
      eq([await db.get('sync_state', 'file_error:' + H('7')), vues.filter((m) => m.puts?.files && (m.deletes?.sync_state || []).includes('file_error:' + H('7'))).length], [undefined, 1], 'F-7 : remote changé → la clé file_error de réception retirée dans la MÊME transaction (mutant : clé gardée)');
    });
  });

  await run('ajustement du serveur sur une ligne files (D-G16)', async () => {
    const { createPush } = await import('../src/sync/push.js');
    await withRepo(async (repo, db) => {
      const photo = octets('photo-ajustee'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, {});
      const ligne = await db.get('files', sha);
      const remote = R({ sha256: sha, size: photo.size });
      await db.mutate({ puts: { files: [{ ...ligne, remote, updated_at: '2026-10-19T02:00:00.000Z' }] }, origin: 'local' }); // capturée : une entrée files
      const tf = creerTransportFactice({ pousser: [{ reponse: { server_time: '2026-10-19T02:00:01.000Z', accepted: [], adjusted: [{ store: 'files', id: sha, updated_at: '2026-10-19T02:00:00.500Z' }], rejected: [] } }] });
      await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
      const apres = await db.get('files', sha);
      eq([apres.blob instanceof Blob, apres.syncable, apres.created_at, apres.updated_at, apres.remote, 'blob' in tf.journal[0].rows[0].data], [true, true, ligne.created_at, '2026-10-19T02:00:00.500Z', remote, false], 'adjusted (pousser scripté : le factice serveur n’en émet jamais) : blob, syncable, created_at gardés, updated_at du serveur posé, l’élément envoyé sans blob (mutant : spread nu → blob perdu)');
    });
  });

  await run('conflits sur une ligne files : garder ici, garder ailleurs, tombale', async () => {
    const { garderAilleurs, garderIci } = await import('../src/sync/conflits.js');
    await withRepo(async (repo, db) => {
      const photo = octets('photo-conflit'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, {});
      const ligne = await db.get('files', sha);
      const remoteServeur = R({ sha256: H('d'), size: 9 });
      const conflit = { id: 'files:' + sha, store: 'files', record_id: sha, local: ligne, server: { data: { sha256: sha, mime: 'image/jpeg', size: photo.size, remote: remoteServeur, updated_at: ligne.updated_at }, updated_at: ligne.updated_at, deleted_at: null }, at: DATE, kind: 'donnees' };
      await db.mutate({ puts: { sync_conflicts: [conflit] }, origin: 'remote' });
      const applique = await garderAilleurs(db, conflit);
      const apres = await db.get('files', sha);
      eq([applique, apres.blob instanceof Blob, apres.remote, apres.created_at, await db.get('sync_conflicts', conflit.id)], [true, true, remoteServeur, ligne.created_at, undefined], 'garderAilleurs sur files : blob gardé, remote du serveur posé, conflit retiré (mutant : spread nu → blob perdu)');
      const conflitT = { ...conflit, server: { data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z' }, renvoye: true };
      await db.mutate({ puts: { sync_conflicts: [conflitT] }, origin: 'remote' });
      const appliqueT = await garderAilleurs(db, conflitT);
      const t2 = await db.get('files', sha);
      eq([appliqueT, t2?.blob instanceof Blob, t2?.remote, t2?.updated_at, await db.get('sync_conflicts', conflit.id), await db.count('outbox')], [true, true, null, '2030-01-01T00:00:00.000Z', undefined, 0], 'garderAilleurs, tombale files (« Supprimer ici aussi », N-4) : ligne et blob gardés, remote nul, updated_at de la tombale, conflit retiré, origine remote (mutant : deletes[conflit.store] → blob perdu)');
      const conflitIci = { ...conflit, local: t2 };
      await db.mutate({ puts: { sync_conflicts: [conflitIci] }, origin: 'remote' });
      await garderIci(db, conflitIci);
      ok((await db.get('files', sha))?.blob instanceof Blob, 'garderIci sur files : inchangé, le blob est dans conflit.local');
    });
  });

  await run('affichage : le type du blob, dans la liste, gagne (F-9)', async () => {
    const { displayUrl, typeAffichage } = await import('../src/sync/mime.js');
    eq([typeAffichage({ mime: 'image/heic', blob: octets('j', 'image/jpeg') }), typeAffichage({ mime: 'image/jpeg', blob: octets('<p>', 'text/html') }), typeAffichage({ mime: 'text/html', blob: octets('<p>', 'text/html') }), typeAffichage({ mime: 'image/jpeg' })],
      ['image/jpeg', 'image/jpeg', null, null], 'typeAffichage : copie JPEG sous une ligne HEIC → image/jpeg ; blob text/html sous image/jpeg → retypé (S3 tenu) ; text/html partout → rien (mutant : type du blob pris sans liste blanche) ; sans blob → rien');
    // Le Blob remis à creerUrl — jamais un fetch d'URL blob: (la CSP de tests/index.html, connect-src 'self' https:, ne couvre pas blob:).
    let remis = null;
    eq([displayUrl({ mime: 'image/heic', blob: octets('j', 'image/jpeg') }, (b) => { remis = b; return 'blob:espion'; }), remis?.type], ['blob:espion', 'image/jpeg'], 'displayUrl : une copie JPEG sous une ligne HEIC est remise image/jpeg à creerUrl (mutant : type de la ligne → image/heic)');
    // bookCover et poserImage créent leur URL par urlDeBlob → URL.createObjectURL : un espion lit le Blob remis, la vraie fonction est rendue en finally.
    const vraiCreer = URL.createObjectURL;
    const vus = [];
    URL.createObjectURL = (b) => { vus.push(b); return vraiCreer.call(URL, b); };
    try {
      const { bookCover } = await import('../src/ui/components.js');
      const toile = new OffscreenCanvas(2, 2); toile.getContext('2d').fillRect(0, 0, 2, 2);
      const jpeg = new Blob([await toile.convertToBlob({ type: 'image/png' })], { type: 'image/jpeg' });
      const couv = bookCover({ id: 'e1' }, { title: 'T' }, { fichier: { sha256: H('a'), mime: 'image/heic', blob: jpeg } });
      eq([!!couv.querySelector('img.cover-img'), vus.map((b) => b.type)], [true, ['image/jpeg']], 'bookCover : une copie JPEG reçue sous une ligne HEIC s’affiche, et le Blob affiché est image/jpeg (mutant : safeDisplayType(fichier.mime) gardé → image/heic)');
      // import-cible.js (poserImage) : la troisième lecture de la règle — vignette de page et aperçu de la photo du plat de l'import ciblé.
      vus.length = 0;
      const { renderImportCible } = await import('../src/ui/import-cible.js');
      await withRepo(async (repo, db) => {
        const ligneHeic = (sha256) => ({ sha256, mime: 'image/heic', size: 999, blob: jpeg, syncable: true, created_at: DATE, updated_at: DATE });
        await db.mutate({ puts: {
          files: [ligneHeic(H('a')), ligneHeic(H('b'))],
          source_pages: [{ id: 'pgIC', document_id: 'dIC', sha256: H('b'), updated_at: DATE }],
          recipes: [{ id: 'rIC', original_title: 'Tarte', availability: 'reference_only', edition_id: null, updated_at: DATE }],
          imports: [{ id: 'impIC', kind: 'recette', recipe_id: 'rIC', edition_id: null, scan_session_id: null, status: 'a_lancer', page_ids: ['pgIC'], photo_sha256: H('a'), photo_origin: 'image', created_at: DATE, updated_at: DATE }],
        }, origin: 'device' });
        const recette = await db.get('recipes', 'rIC');
        const ctxIC = { recipesById: new Map([['rIC', recette]]), editionsById: new Map(), booksById: new Map(), sync: {} };
        const root = await renderImportCible({ id: 'rIC' }, {}, ctxIC, { repo, navigate: () => {}, toast: () => {}, fetch: async () => { throw new Error('aucun réseau attendu'); }, pickFiles: async () => [] });
        for (let i = 0; i < 100 && vus.length < 2; i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([vus.map((b) => b.type), !!root.querySelector('.thumbs img'), !!root.querySelector('[data-role="apercu-plat"]')], [['image/jpeg', 'image/jpeg'], true, true], 'import ciblé (poserImage, F-9) : la vignette de page et l’aperçu du plat d’une copie JPEG sous une ligne HEIC sont servis image/jpeg (mutant : safeDisplayType(f?.mime) gardé → image/heic)');
      });
    } finally { URL.createObjectURL = vraiCreer; }
    (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
  });

  await run('réglage upload_quality et qualiteEnvoi (§ 3.3)', async () => {
    const S = await import('../src/ui/state.js');
    try {
      await withRepo(async (repo) => {
        eq(await repo.getSetting('upload_quality'), 'reduite', 'D-G3 : Réduite par défaut (DEFAULT_SETTINGS)');
        await S.relireReglages();
        const lu = [S.qualiteEnvoi()];
        await repo.setSetting('upload_quality', 'originale'); await S.relireReglages(); lu.push(S.qualiteEnvoi());
        await repo.setSetting('upload_quality', 'inconnue'); await S.relireReglages(); lu.push(S.qualiteEnvoi());
        await S.relectureEnCours();
        eq(lu, ['reduite', 'originale', 'reduite'], 'qualiteEnvoi : une fonction relue à chaque appel (B-16) ; une valeur inconnue vaut Réduite');
      });
    } finally { await S.relireReglages(); } // la base de l'app reprend la main (gabarit de tests/sync.js) : `reglages` ne garde pas l'état d'une base fermée
  });

  await run('statique tâche 1', async () => {
    const sw = await lire('../sw.js');
    ok(sw.includes("'./src/sync/fichiers.js'"), 'SHELL : ./src/sync/fichiers.js (atteignable par pull.js dès la tâche 1, F-5)');
    ok(/VERSION = 'cuisine-os-v0\.11\.0-\d+'/.test(sw), 'sw.js : VERSION 0.11.0');
    const { APP_VERSION, DB_VERSION } = await import('../src/model/schema.js');
    eq([APP_VERSION, DB_VERSION], ['0.11.0', 4], 'D-G11 : APP_VERSION 0.11.0, DB_VERSION inchangée');
    const { MODULES_NEUFS } = await import('./ajouter.js');
    ok(MODULES_NEUFS.includes('../src/sync/fichiers.js'), 'filet i18n : MODULES_NEUFS contient src/sync/fichiers.js');
  });
}
