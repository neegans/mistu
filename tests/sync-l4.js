// Suite du lot G « Les photos voyagent entre appareils » (spec 2026-10-19, rév. 4) : données, projection, réception et capture (tâche 1),
// archive (2), Storage factice et passe fichiers (3), moteur (4), Réglages (5), écrans (6). Bases jetables, aucun réseau, aucune clé.
// Chaque assertion nomme le mutant qu'elle tue (rejoués sur une copie à la clôture).
import { withRepo } from './sync-fixture.js';
import { creerTransportFactice } from './transport-factice.js';
import { resetClock } from '../src/sync/clock.js';
import { sha256Hex } from '../src/core/hash.js';
import { withDatabase, rewriteArchive } from './backup.js';

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
      // Ronde 1 : owner de 65, taille non entière, uploaded_at de 41 points de code, remote gonflé au-delà de 4 Kio (sinon renvoyé dans la projection).
      [R({ owner: 'o'.repeat(64) }), true], [R({ owner: 'o'.repeat(65) }), false], [R({ size: 1.5 }), false], [R({ uploaded_at: 'x'.repeat(40) }), true],
      [R({ uploaded_at: 'x'.repeat(41) }), false], [{ ...R(), note: 'n'.repeat(3800) }, true], [{ ...R(), note: 'n'.repeat(5000) }, false],
    ];
    eq(formes.map(([r]) => T.remoteValide(r)), formes.map(([, v]) => v), 'remoteValide : 21 formes — valide ; champ en plus ignoré (F-23) ; true, null, prototype étranger, empreinte courte, taille 0 et 52 428 801, svg, qualité inconnue, owner vide, uploaded_at nombre, tableau, chaîne refusés ; ronde 1 : owner de 64 admis et de 65 refusé, taille 1,5 refusée, uploaded_at ≤ 40 points de code, remote sérialisé ≤ 4 Kio (mutants : borne de taille retirée ; champ en plus refusé ; borne owner retirée ; typeof size number ; uploaded_at ou taille totale non bornés)');
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
    eq([F.copiePerimee({ ...orig, blob: octets('vieille'), remote: R({ size: 3 }) }), F.copiePerimee(reduite), F.copiePerimee(orig), F.copiePerimee({ ...orig, blob: octets('vieille'), remote: null })], [true, false, false, false], 'copiePerimee : copie dont la taille n’est plus celle du serveur ; copie fidèle ; original ; copie sans remote → faux sans lever (ronde 1, mutant : garde remoteValide retirée → TypeError)');
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
    eq(F.fusionnerOctetsRecus({ ...existante, mime: 'application/octet-stream', syncable: true }, recue).syncable, false, 'fusionnerOctetsRecus : un mime hors liste → syncable faux (ronde 1, mutant : syncable: true en dur)');
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
        { sha256: H('d'), mime: 'image/jpeg', size: 4, remote: R({ sha256: H('d'), size: 4 }), updated_at: '2026-10-04T00:00:00.000Z' }, // ronde 1 : un remote objet reste
      ], sync_state: [{ key: 'cursor:files', value: 12 }] }, origin: 'device' });
      await db.mutate({ deletes: { sync_state: ['files_remote_v2'] }, origin: 'device' }); // la fixture a déjà joué init() : la garde est retirée pour rejouer
      const vues = [];
      const vrai = db.mutate;
      db.mutate = function (args) { vues.push(args); return vrai.call(this, args); };
      // Ronde 1 (#4) : des octets arrivent sur H('b') ENTRE la lecture des lignes et l'écriture de la passe — la réécriture se fait sur la ligne relue
      // DANS la transaction : le blob survit (mutant : lignes lues hors transaction réécrites telles quelles → blob perdu).
      const vraiGetAll = db.getAll;
      const recu = octets('octets-arrives-pendant-la-passe');
      db.getAll = async function (store, ...reste) {
        const r = await vraiGetAll.call(this, store, ...reste);
        if (store === 'files' && !recu.vu) { recu.vu = true; await vrai.call(this, { puts: { files: [{ ...(await this.get('files', H('b'))), blob: recu }] }, origin: 'remote' }); }
        return r;
      };
      try {
        await repo.init();
        const [la, lb, lc, ld] = await Promise.all([H('a'), H('b'), H('c'), H('d')].map((s) => db.get('files', s)));
        eq(['remote' in la, 'remote' in lb, la.updated_at, lb.updated_at, lc.updated_at], [false, false, '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-03T00:00:00.000Z'], 'passe unique : le booléen retiré des deux lignes de L3, updated_at conservé (mutant : updated_at réécrit)');
        eq([ld.remote, ld.updated_at, lb.blob instanceof Blob && lb.blob.size === recu.size], [R({ sha256: H('d'), size: 4 }), '2026-10-04T00:00:00.000Z', true], 'passe unique (ronde 1) : un remote objet valide reste intact (mutant : tout remote non vide retiré) ; un blob arrivé pendant la passe survit (relecture en transaction)');
        const ecritures = vues.filter((m) => m.conditions?.files || m.puts?.files);
        const passe = ecritures[0];
        eq([ecritures.length, passe?.origin, (passe?.conditions?.files || []).map((c) => c.key).sort(), (passe?.puts?.sync_state || []).some((l) => l.key === 'files_remote_v2'), (passe?.deletes?.sync_state || []).includes('cursor:files'), (await db.get('sync_state', 'files_remote_v2'))?.value, await db.get('sync_state', 'cursor:files'), await db.count('outbox')],
          [1, 'device', [H('a'), H('b')], true, true, 1, undefined, 0], 'passe unique : UNE transaction d’origine device, la garde DANS la même transaction que les lignes, la ligne saine non réécrite, rien en file (mutant : garde écrite par un second mutate) ; ronde 1 (#2) : cursor:files retiré dans la MÊME transaction — toute ligne files reçue par un client d’avant G est relue (mutant : curseur gardé)');
        vues.length = 0;
        await repo.init();
        eq(vues.filter((m) => m.conditions?.files || m.puts?.files || (m.puts?.sync_state || []).some((l) => l.key === 'files_remote_v2') || (m.deletes?.sync_state || []).includes('cursor:files')).length, 0, 'passe unique : au second démarrage, aucune transaction (garde)');
      } finally { delete db.mutate; delete db.getAll; }
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
      eq([ecrite.size, ecrite.mime, ecrite.updated_at, ecrite.syncable, ecrite.remote, ecrite.blob instanceof Blob && ecrite.blob.size === recue.size, await db.count('outbox')], [999, 'image/heic', DATE, true, R({ mime: 'image/jpeg' }), true, 0], 'putFile origin remote = fusionnerOctetsRecus (F-20 : une règle, deux appelants ; valeurs littérales, ronde 1 ; mutant : putFile ordinaire → size réécrit)');
      // Ronde 1 (#4) : un original importé ici ENTRE la lecture de putFile et son écriture n'est jamais remplacé par la copie reçue (I-G3 : le serveur ne
      // réécrit jamais un blob local) — l'écriture d'origine remote relit la ligne DANS sa transaction.
      const copie = octets('copie-reduite'); const shaO = H('8');
      await db.mutate({ puts: { files: [{ sha256: shaO, mime: 'image/jpeg', size: 30, updated_at: DATE, remote: R({ sha256: H('e'), size: copie.size }) }] }, origin: 'remote' });
      const originalImporte = octets('x'.repeat(30));
      const vraiGet = db.get;
      db.get = async function (store, cle) {
        const r = await vraiGet.call(this, store, cle);
        if (store === 'files' && cle === shaO && !originalImporte.vu) { originalImporte.vu = true; await this.mutate({ puts: { files: [{ ...r, blob: originalImporte, syncable: true }] }, origin: 'local' }); }
        return r;
      };
      try { await repo.putFile(shaO, copie, { origin: 'remote' }); } finally { delete db.get; }
      eq([(await db.get('files', shaO))?.blob?.size, originalImporte.size !== copie.size], [originalImporte.size, true], 'putFile origin remote (ronde 1) : un original arrivé entre la lecture et l’écriture reste — la copie reçue ne le remplace pas (mutant : écriture hors transaction → copie écrite sur l’original)');
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
      eq([await db.get('sync_state', 'file_error:' + H('7')), vues.filter((m) => (m.conditions?.files || m.puts?.files) && (m.deletes?.sync_state || []).includes('file_error:' + H('7'))).length], [undefined, 1], 'F-7 : remote changé → la clé file_error de réception retirée dans la MÊME transaction (mutant : clé gardée)');
    });
    // Ronde 1 : les deux conditions de F-7 (remote INCHANGÉ → clé gardée ; sens « envoi » → clé gardée) et la tombale (remote → null : levée aussi).
    await withRepo(async (repo, db) => {
      const T2 = '2030-01-01T00:00:00.000Z';
      const err = (sens) => ({ motif: sens === 'envoi' ? 'trop_gros' : 'introuvable', sens, at: DATE });
      await db.mutate({ puts: {
        files: [
          { sha256: H('1'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('1'), size: 5 }) }, // remote reçu identique
          { sha256: H('2'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, // remote change, mais erreur d'ENVOI
          { sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, // tombale : remote → null
          { sha256: H('4'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, // tombale, erreur d'envoi
        ],
        sync_state: [{ key: 'file_error:' + H('1'), value: err('reception') }, { key: 'file_error:' + H('2'), value: err('envoi') }, { key: 'file_error:' + H('3'), value: err('reception') }, { key: 'file_error:' + H('4'), value: err('envoi') }],
      }, origin: 'device' });
      const ligne = (sha, sur, seq) => ({ id: sha, data: { sha256: sha, mime: 'image/jpeg', size: 5, updated_at: T2, ...sur }, updated_at: T2, deleted_at: null, server_seq: seq });
      const tombale = (sha, seq) => ({ id: sha, data: null, updated_at: T2, deleted_at: T2, server_seq: seq });
      const tf = creerTransportFactice({ lire: { files: [[ligne(H('1'), { original_filename: 'nouveau-nom.jpg', remote: R({ sha256: H('1'), size: 5 }) }, 1), ligne(H('2'), { remote: R({ sha256: H('d') }) }, 2), tombale(H('3'), 3), tombale(H('4'), 4)], []] } });
      const vraiConsole = console.error; console.error = () => {};
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { console.error = vraiConsole; }
      const cles = await Promise.all([1, 2, 3, 4].map(async (i) => !!(await db.get('sync_state', 'file_error:' + H(String(i))))));
      eq([cles, (await db.get('files', H('1')))?.original_filename, (await db.get('files', H('3')))?.remote], [[true, true, false, true], 'nouveau-nom.jpg', null],
        'F-7 (ronde 1) : remote reçu identique → clé de réception GARDÉE (mutant : levée toujours) ; clé de sens « envoi » gardée même si remote change (mutant : sens ignoré) ; tombale qui met remote à null → clé de réception levée (§ 3.2), clé d’envoi gardée');
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

  // === Tâche 1, ronde 1 — constats de la revue adverse. Un comportement neuf rougissait sur 84ab222 ; une épingle nomme le mutant qu'elle tue.

  await run('ronde 1 — db.mutate : condition « fusion » (la ligne relue DANS la transaction)', async () => {
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('a'), mime: 'image/jpeg', size: 1, updated_at: DATE }] }, origin: 'device' });
      const lus = [];
      const rendu = await db.mutate({ conditions: { files: [
        { key: H('a'), fusion: (courant) => { lus.push(courant?.sha256 ?? null); return { ...courant, original_filename: 'relue.jpg' }; } },
        { key: H('b'), fusion: (courant) => { lus.push(courant ?? null); return null; } },
      ] }, origin: 'device' });
      eq([lus, (await db.get('files', H('a')))?.original_filename, await db.get('files', H('b')), (rendu?.files || []).map((f) => f.sha256)], [[H('a'), null], 'relue.jpg', undefined, [H('a')]],
        'fusion : la fiche courante est remise à la fonction (null si absente) ; la fiche rendue est écrite et rendue ; null → rien d’écrit pour elle');
      const formes = [];
      for (const c of [{ key: H('a'), fusion: 'pas une fonction' }, { key: H('a'), fusion: () => null, attendus: ['x'] }, { key: H('a'), fusion: () => null, patch: {} }, { key: H('a'), fusion: () => null, absente: true }, { key: H('a'), fusion: (courant) => ({ ...courant, sha256: H('c') }) }]) {
        try { await db.mutate({ conditions: { files: [c] }, origin: 'device' }); formes.push('écrit'); } catch (e) { formes.push(e.name); }
      }
      eq([formes, await db.get('files', H('c')), (await db.get('files', H('a')))?.original_filename], [['TypeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError'], undefined, 'relue.jpg'],
        'fusion : une fonction seule (ni attendus, ni patch, ni absente) ; une fiche rendue sous une autre clé → TypeError, rien d’écrit');
    });
  });

  await run('ronde 1 — mise à jour mêlée (#2) : la passe unique fait relire files, un remote serveur valide est adopté à instant égal', async () => {
    const { createPull, decider } = await import('../src/sync/pull.js');
    const T0 = '2026-10-19T03:00:00.000Z';
    const loc = (remote, sur = {}) => ({ sha256: H('a'), mime: 'image/jpeg', size: 3, updated_at: T0, ...(remote === undefined ? {} : { remote }), ...sur });
    const dist = (remote) => ({ id: H('a'), data: { sha256: H('a'), mime: 'image/jpeg', size: 3, remote, updated_at: '2026-10-19T03:00:00+00:00' }, updated_at: '2026-10-19T03:00:00+00:00', deleted_at: null });
    eq([decider({ locale: loc(undefined), distante: dist(R()), table: 'files' }), decider({ locale: loc(true), distante: dist(R()), table: 'files' }), decider({ locale: loc(null, { blob: octets('abc') }), distante: dist(R()), table: 'files' }),
      decider({ locale: loc(R({ sha256: H('d') })), distante: dist(R()), table: 'files' }), decider({ locale: loc(null, { original_filename: 'x' }), distante: dist(null), table: 'files' }), decider({ locale: loc(undefined), distante: dist(R()) })],
      ['ecrire', 'ecrire', 'ecrire', 'conflit', 'conflit', 'conflit'], 'decider (files, instant égal) : remote local absent, true ou nul et remote serveur valide → écrire, jamais « conflit » (mutant : règle retirée → conflit sur chaque ligne relue) ; remote local valide différent → conflit (I7) ; deux remotes invalides et une autre différence → conflit ; sans table, rien ne change');
    await withRepo(async (repo, db) => {
      // Ce qu'un client d'avant G (ficheFichier de L3) a écrit en recevant deux lignes envoyées par un appareil déjà en 0.11.0 : sans blob → remote: true ;
      // avec blob (l'original est ici aussi) → remote effacé ; l'updated_at du serveur, tel quel ; et le curseur est déjà passé.
      const photo = octets('original-des-deux-cotes'); const shaY = await sha256Hex(photo);
      await repo.putFile(shaY, photo, {});
      const y = await db.get('files', shaY);
      const TS = '2026-10-19T04:00:00.000Z';
      await db.mutate({ puts: {
        files: [{ sha256: H('7'), mime: 'image/jpeg', size: 5, remote: true, updated_at: TS }, { ...y, updated_at: TS }],
        source_pages: [{ id: 'pgY', document_id: 'dY', sha256: shaY, updated_at: DATE }],
        sync_state: [{ key: 'cursor:files', value: 12 }],
      }, origin: 'device' });
      await db.mutate({ deletes: { sync_state: ['files_remote_v2'] }, origin: 'device' }); // la passe se rejoue : c'est le premier démarrage en 0.11.0
      await repo.init();
      const rX = R({ sha256: H('e'), size: 4 }), rY = R({ sha256: shaY, size: photo.size, quality: 'originale' });
      const ts = '2026-10-19T04:00:00+00:00';
      const tf = creerTransportFactice({ lire: { files: [[
        { id: H('7'), data: { sha256: H('7'), mime: 'image/jpeg', size: 5, remote: rX, updated_at: ts }, updated_at: ts, deleted_at: null, server_seq: 3 },
        { id: shaY, data: { sha256: shaY, mime: 'image/jpeg', size: photo.size, remote: rY, updated_at: ts }, updated_at: ts, deleted_at: null, server_seq: 11 },
      ], []] } });
      const bilan = await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      const [x2, y2] = [await db.get('files', H('7')), await db.get('files', shaY)];
      eq([tf.journal.find((a) => a.appel === 'lire' && a.table === 'files')?.apres, x2?.remote, F.etatFichier(x2, { uid: 'u1' }), y2?.blob instanceof Blob, y2?.remote, F.candidatsEnvoi(await db.getSnapshot(MAGASINS_SNAPSHOT), { uid: 'u1' }).length, bilan.conflits, await db.count('sync_conflicts')],
        [0, rX, 'distant', true, rY, 0, 0, 0], 'mise à jour mêlée (#2) : après la passe, files est relue depuis 0 ; la ligne qui avait perdu son remote (true) le retrouve et redevient distante ; celle dont l’original est ici garde son blob ET le remote — plus candidate, aucun conflit (mutants : curseur gardé ; règle d’adoption retirée)');
    });
  });

  await run('ronde 1 — fusionnerFichier ne prend de data que les champs du serveur (#3, #9, #10, #15)', async () => {
    const orig = await original('fusion-bornee', { original_filename: 'ici.jpg' });
    const hostile = { sha256: H('b'), size: 999999, mime: 'image/png', original_filename: 'ailleurs.jpg', syncable: false, created_at: '1970-01-01T00:00:00.000Z', blob: { faux: 1 }, remote: true, updated_at: 'corps' };
    const f = F.fusionnerFichier(orig, hostile, '2030-01-01T00:00:00.000Z');
    eq([f.blob === orig.blob, f.sha256, f.size, f.mime, f.syncable, f.created_at, f.original_filename, f.remote, f.updated_at, F.estOriginalIci(f)],
      [true, orig.sha256, orig.size, 'image/jpeg', true, DATE, 'ailleurs.jpg', null, '2030-01-01T00:00:00.000Z', true],
      'avec blob local : clé, taille et type locaux gardés (l’original reste un original), syncable et created_at locaux, nom d’origine du serveur, remote true → nul, jamais un blob de data (mutants : spread nu ; { ...data, ...meta })');
    const sans = F.fusionnerFichier(sansBlob(orig), { ...hostile, sha256: orig.sha256, remote: R() }, DATE);
    eq([sans.sha256, sans.mime, sans.size, sans.original_filename, sans.syncable, sans.created_at, 'blob' in sans, sans.remote], [orig.sha256, 'image/png', 999999, 'ailleurs.jpg', true, DATE, false, R()],
      'sans blob local : type, taille et nom du serveur gagnent (D-G16, l’ordre épinglé) ; syncable et created_at locaux ; aucun blob venu de data');
    const neuve = F.fusionnerFichier(null, { ...hostile, sha256: H('b'), remote: R() }, DATE);
    eq(Object.keys(neuve).sort(), ['mime', 'original_filename', 'remote', 'sha256', 'size', 'updated_at'], 'ligne neuve : exactement les champs du serveur (ni syncable, ni created_at, ni blob reçus)');
  });

  await run('ronde 1 — réception : un blob écrit pendant la page n’est jamais effacé (#4)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      // (a) B importe la même photo que A pendant qu'une page qui porte la ligne de A est appliquée : la ligne n'existait pas à la lecture.
      const photo = octets('meme-photo-pendant-la-page'); const shaB = await sha256Hex(photo);
      // (b) la copie d'une ligne distante est téléchargée pendant la page (putFile d'origine remote : updated_at inchangé).
      const copie = octets('copie-pendant-la-page'); const shaC = H('c');
      await db.mutate({ puts: { files: [{ sha256: shaC, mime: 'image/jpeg', size: 99, updated_at: DATE, remote: R({ sha256: H('e'), size: copie.size }) }] }, origin: 'remote' });
      const vraiGet = db.get;
      const faits = new Set();
      db.get = async function (store, cle) {
        const r = await vraiGet.call(this, store, cle);
        if (store === 'files' && !faits.has(cle)) {
          faits.add(cle);
          if (cle === shaB) await repo.putFile(shaB, photo, { original_filename: 'b.jpg' });
          if (cle === shaC) await repo.putFile(shaC, copie, { origin: 'remote' });
        }
        return r;
      };
      const T2 = '2030-01-01T00:00:00.000Z';
      const rA = R({ sha256: H('a'), size: 7 }), rC = R({ sha256: H('d'), size: 5 });
      const tf = creerTransportFactice({ lire: { files: [[
        { id: shaB, data: { sha256: shaB, mime: 'image/jpeg', size: photo.size, remote: rA, updated_at: T2 }, updated_at: T2, deleted_at: null, server_seq: 1 },
        { id: shaC, data: { sha256: shaC, mime: 'image/jpeg', size: 99, remote: rC, updated_at: T2 }, updated_at: T2, deleted_at: null, server_seq: 2 },
      ], []] } });
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { delete db.get; }
      const [b, c] = [await db.get('files', shaB), await db.get('files', shaC)];
      eq([b?.blob instanceof Blob && b.blob.size === photo.size, b?.remote, F.estOriginalIci(b), c?.blob instanceof Blob && c.blob.size === copie.size, c?.remote, c?.size],
        [true, rA, true, true, rC, 99], 'réception (#4) : la fusion se fait sur la ligne relue DANS la transaction — un original importé et une copie téléchargée pendant la page restent, le remote reçu est posé (mutant : fusion sur l’instantané → blobs effacés)');
    });
  });

  await run('ronde 1 — adjusted : un blob arrivé pendant l’aller-retour survit (#4)', async () => {
    const { createPush } = await import('../src/sync/push.js');
    await withRepo(async (repo, db) => {
      const copie = octets('copie-pendant-envoi'); const sha = H('5');
      const remote = R({ sha256: H('e'), size: copie.size });
      await db.mutate({ puts: { files: [{ sha256: sha, mime: 'image/jpeg', size: 77, updated_at: '2026-10-19T02:00:00.000Z', remote }] }, origin: 'local' }); // capturée : une entrée files
      const tf = creerTransportFactice({ pousser: [{ reponse: { server_time: '2026-10-19T02:00:01.000Z', accepted: [], adjusted: [{ store: 'files', id: sha, updated_at: '2026-10-19T02:00:00.500Z' }], rejected: [] } }] });
      const vraiGetAll = db.getAll;
      let fait = false;
      db.getAll = async function (store, ...reste) {
        if (store === 'sync_conflicts' && !fait) { fait = true; await repo.putFile(sha, copie, { origin: 'remote' }); } // après la lecture des fiches locales
        return vraiGetAll.call(this, store, ...reste);
      };
      try { await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer(); } finally { delete db.getAll; }
      const apres = await db.get('files', sha);
      eq([fait, apres?.blob instanceof Blob && apres.blob.size === copie.size, apres?.updated_at, apres?.remote], [true, true, '2026-10-19T02:00:00.500Z', remote], 'adjusted (#4) : la réécriture relit la ligne DANS la transaction — la copie téléchargée pendant l’aller-retour reste, l’updated_at du serveur est posé (mutant : reecrire.files écrit tel quel → blob perdu)');
    });
  });

  await run('ronde 1 — adjusted sur files : garde R-L3-7 et contexte (#5, #8, #11)', async () => {
    const { appliquerReponse } = await import('../src/sync/reponses.js');
    const orig = await original('ajuste-garde', { remote: R() });
    const element = { store: 'files', id: orig.sha256, data: T.projectionFichier(orig), updated_at: orig.updated_at, deleted: false };
    const k = 'files:' + orig.sha256;
    const appel = (contexte) => appliquerReponse({ lot: { seqs: [1], elements: [element] }, reponse: { accepted: [], adjusted: [{ store: 'files', id: orig.sha256, updated_at: '2026-10-19T05:00:00.000Z' }], rejected: [] },
      entreesParSeq: new Map([[1, { seq: 1, store: 'files', id: orig.sha256, op: 'put', updated_at: orig.updated_at, tries: 0 }]]), ...contexte }).reecrire.files || [];
    const inchangee = appel({ fichesLocales: { [k]: orig } });
    eq([inchangee.length, inchangee[0]?.blob === orig.blob, inchangee[0]?.updated_at, appel({ fichesLocales: { [k]: { ...orig, remote: R({ sha256: H('d') }), updated_at: '2026-10-19T04:00:00.000Z' } } }).length, appel({ fichesLocales: { [k]: null } }).length, appel({}).length],
      [1, true, '2026-10-19T05:00:00.000Z', 0, 0, 0], 'adjusted files : ligne inchangée → réécrite, blob gardé ; ligne réécrite ici pendant l’aller-retour (nouveau remote, nouvel updated_at) → rien (mutant : garde updated_at retirée → l’ancien remote revient) ; ligne disparue → rien ; sans contexte fichesLocales → rien');
  });

  await run('ronde 1 — R56 de bout en bout : l’écho d’une ligne files envoyée ne fait jamais de conflit (#6)', async () => {
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const photo = octets('echo-r56'); const sha = await sha256Hex(photo);
      await repo.putFile(sha, photo, { original_filename: 'e.jpg' });
      const ligne = await db.get('files', sha);
      const remote = R({ sha256: sha, size: photo.size, quality: 'originale' });
      await db.mutate({ puts: { files: [{ ...ligne, remote, updated_at: '2026-10-19T07:00:00.000Z' }] }, origin: 'device' });
      const ts = '2026-10-19T07:00:00.000000+00:00';
      const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: { ...T.projectionFichier({ ...ligne, remote }), updated_at: ts }, updated_at: ts, deleted_at: null, server_seq: 5 }], []] } });
      const bilan = await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir();
      const apres = await db.get('files', sha);
      eq([bilan.conflits, await db.count('sync_conflicts'), apres.blob instanceof Blob, apres.syncable, apres.created_at, apres.updated_at, apres.remote, (await db.get('sync_state', 'cursor:files'))?.value],
        [0, 0, true, true, ligne.created_at, '2026-10-19T07:00:00.000Z', remote, 5], 'R56 (#6) : la fiche d’ici porte blob, syncable, created_at et remote ; le serveur rend sa projection au même instant (« +00:00 », microsecondes) → ni conflit ni réécriture, curseur avancé (mutant : appliquerPage sans `table` vers decider → un conflit par photo)');
    });
  });

  await run('ronde 1 — conflits files : la ligne relue gagne sur l’instantané (#1, #7, #16, #23, #33) et F-7 (#14)', async () => {
    const { garderAilleurs, garderIci } = await import('../src/sync/conflits.js');
    await withRepo(async (repo, db) => {
      const photo = octets('arrivee-apres-le-conflit'); const sha = await sha256Hex(photo);
      const remoteIci = R({ sha256: sha, size: photo.size, quality: 'originale' });
      const instantane = { sha256: sha, mime: 'image/jpeg', size: photo.size, updated_at: DATE, remote: remoteIci }; // le conflit est noté SANS blob
      await db.mutate({ puts: { files: [instantane], sync_state: [{ key: 'file_error:' + sha, value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'remote' });
      await repo.putFile(sha, photo, { origin: 'remote' }); // puis les octets arrivent (updated_at inchangé)
      const conflit = (id, server, sur = {}) => ({ id, store: 'files', record_id: sha, local: instantane, server, at: DATE, kind: 'donnees', ...sur });
      const poser = async (c) => { await db.mutate({ puts: { sync_conflicts: [c] }, origin: 'remote' }); return c; };
      const remoteAilleurs = R({ sha256: H('d'), size: 9 });
      const donnees = { data: { sha256: sha, mime: 'image/jpeg', size: photo.size, remote: remoteAilleurs, updated_at: DATE }, updated_at: DATE, deleted_at: null };
      const tombale = { data: null, updated_at: '2030-01-01T00:00:00.000Z', deleted_at: '2030-01-01T00:00:00.000Z' };
      const okA = await garderAilleurs(db, await poser(conflit('files:a', donnees)));
      const a = await db.get('files', sha);
      eq([okA, a.blob instanceof Blob && a.blob.size === photo.size, a.remote, await db.get('sync_state', 'file_error:' + sha)], [true, true, remoteAilleurs, undefined],
        'garderAilleurs (données) : instantané SANS blob, ligne en base AVEC → blob gardé (mutant : ici = conflit.local) ; remote changé → file_error de réception levée (F-7, § 3.2)');
      await garderAilleurs(db, await poser(conflit('files:t', tombale, { renvoye: true })));
      const t2 = await db.get('files', sha);
      eq([t2.blob instanceof Blob && t2.blob.size === photo.size, t2.remote], [true, null], 'garderAilleurs (tombale) : instantané sans blob → le blob en base reste, remote nul');
      const okI = await garderIci(db, await poser(conflit('files:i', donnees)));
      const i = await db.get('files', sha);
      eq([okI, i.blob instanceof Blob && i.blob.size === photo.size, i.remote], [true, true, remoteIci], 'garderIci : l’instantané (sans blob) est réécrit SUR la ligne relue — le blob arrivé depuis reste (mutant : instantané écrit tel quel → blob perdu)');
      const okN = await garderIci(db, await poser(conflit('files:n', tombale, { local: null })));
      eq([okN, (await db.get('files', sha))?.blob instanceof Blob, !!(await db.get('sync_conflicts', 'files:n'))], [false, true, true], 'garderIci, local nul sur files : refusé — aucune suppression locale de files (D-G15) ; ligne et blob intacts, le conflit reste (mutant : deletes[files] → blob perdu)');
      let leve = null; let okV = null;
      try { okV = await garderAilleurs(db, await poser({ id: 'files:v', store: 'files', record_id: H('9'), local: null, server: tombale, at: DATE, kind: 'donnees' })); } catch (e) { leve = e; }
      eq([leve, okV, await db.get('files', H('9')), await db.get('sync_conflicts', 'files:v')], [null, true, undefined, undefined], 'garderAilleurs, tombale sans ligne ni instantané : conflit retiré, rien d’écrit, aucune levée (mutant : garde de ligne retirée)');
    });
  });

  await run('ronde 1 — lots : projection relue nettoyée, updated_at de la fiche (#13, #32)', async () => {
    const { composerLots } = await import('../src/sync/lots.js');
    const fiche = { sha256: H('a'), mime: 'image/jpeg', size: 3, original_filename: 'p' + String.fromCharCode(0) + 'q.jpg', blob: octets('abc'), syncable: true, created_at: DATE, updated_at: '2026-10-19T06:00:00.000Z', remote: R({ sha256: H('a'), size: 3 }) };
    const c = await composerLots([{ seq: 1, user_id: 'u1', store: 'files', id: H('a'), op: 'put', updated_at: DATE, tries: 0 }], async () => fiche);
    const el = c.lots[0]?.elements[0];
    eq([el?.data.original_filename, el?.updated_at, el?.data.updated_at], ['pq.jpg', '2026-10-19T06:00:00.000Z', '2026-10-19T06:00:00.000Z'], 'lots : la projection d’une entrée files passe par nettoyerChaines (U+0000 retiré) et l’élément porte l’updated_at de la fiche relue, pas celui de l’entrée (mutants : nettoyerChaines retiré ; updated_at de l’entrée)');
  });

  await run('ronde 1 — une définition (#19, #20)', async () => {
    eq(F.HASH_FICHIER === T.HASH_FICHIER && F.HASH_FICHIER instanceof RegExp, true, 'I-G10 : HASH_FICHIER défini une fois (tables.js), réexporté par fichiers.js');
    const snap = { books: [{ id: 'b1', title: 'L' }], book_editions: [{ id: 'e1', book_id: 'b1' }], source_documents: [{ id: 'd1', edition_id: 'e1', sha256: H('1') }], source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12 }, { id: 'p2', document_id: 'd1', sha256: H('1'), printed_page: 99 }] };
    eq([F.nomFichier(H('1'), snap), F.nomFichier(H('1'), snap), F.nomFichier(H('2'), snap)], ['Page 12 · L', 'Page 12 · L', H('2').slice(0, 12)], 'nomFichier : la PREMIÈRE page de l’empreinte nomme le fichier (comme find), deux appels sur le même snapshot rendent le même nom (index par snapshot)');
  });

  // === Tâche 2 — archive (D-G3, D-G7, S-1, R-G-6, N-1)
  const B = await import('../src/domain/backup.js');
  const ouvrir = async (archive) => B.inspectArchive(await archive.blob.arrayBuffer());
  const pageVers = (sha256) => ({ source_documents: [{ id: 'd1', sha256, updated_at: DATE }], source_pages: [{ id: 'pg1', document_id: 'd1', sha256, updated_at: DATE }] });

  await run('archive : pages manquantes et copie réduite (a)', async () => {
    const orig = await original('original-archive-a');
    const copieOctets = octets('copie-reduite-a');
    const shaCopie = await sha256Hex(copieOctets);
    const remoteManquante = R({ sha256: H('d'), size: 5 });
    const remoteCopie = R({ sha256: shaCopie, size: copieOctets.size });
    const lignes = [
      { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: remoteManquante },             // sans blob, à remote
      { sha256: H('2'), mime: 'image/png', size: 11, updated_at: DATE },                                         // sans blob, sans remote
      orig,                                                                                                      // l'original
      { sha256: H('4'), mime: 'image/heic', size: 99999, blob: copieOctets, updated_at: DATE, remote: remoteCopie }, // copie réduite reçue
    ];
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: lignes, ...pageVers(H('1')) }); archive = await B.createArchive(db); });
    const m = archive.manifest;
    const copie = m.files.find((f) => f.sha256 === H('4'));
    eq([m.missing_files.map((x) => x.sha256).sort(), m.files.length, archive.missingFiles, archive.copies, m.counts.files, 'missing_files' in m.counts, m.missing_files.find((x) => x.sha256 === H('1'))?.remote],
      [[H('1'), H('2')], 2, 2, { serveur: 1, inconnues: 0 }, 2, false, remoteManquante], 'createArchive (D-G7, S-1) : deux lignes sans blob dans missing_files (remote gardé s’il est valide), deux fichiers, copies { serveur: 1 }, missing_files hors counts');
    eq([copie?.path, copie?.bytes_sha256, copie?.bytes_size, copie?.bytes_mime, copie?.size, copie?.mime, copie?.remote, 'bytes_sha256' in m.files.find((f) => f.sha256 === orig.sha256)],
      ['files/' + H('4') + '.jpg', shaCopie, copieOctets.size, 'image/jpeg', 99999, 'image/heic', remoteCopie, false], 'createArchive : la copie porte bytes_* (ce qui est dans le ZIP) et la ligne (clé, taille et type de l’original) ; chemin selon bytes_mime ; l’original n’a pas de bytes_*');
    const insp = await ouvrir(archive);
    eq([insp.ok, insp.summary.files_distants, insp.summary.files_copies, insp.errors], [true, 2, 1, []], 'inspectArchive : acceptée, files_distants 2, files_copies 1, relation source_pages → missing tenue (mutant : bytes_sha256 ignoré → « endommagé »)');
    for (const mode of ['merge', 'replace']) {
      await withDatabase(async (db) => {
        await B.applyArchive(db, insp, { mode });
        const parSha = new Map((await db.getAll('files')).map((r) => [r.sha256, r]));
        const v = await B.verifyRestored(db, insp, { mode });
        eq([parSha.size, [...parSha.values()].filter((r) => r.blob instanceof Blob).length, await sha256Hex(parSha.get(H('4')).blob), parSha.get(H('4')).remote, parSha.get(H('1')).remote, parSha.get(H('2')).remote, v.ok, v.diffs],
          [4, 2, shaCopie, remoteCopie, remoteManquante, null, true, []], `applyArchive (${mode}) : 4 lignes dont 2 sans blob, la copie sous sa clé avec son remote ; verifyRestored vert (mutants : comparableFiles compte les lignes sans blob ; requireInspection compare size à bytes.length → « Archive non validée »)`);
      });
    }
  });

  await run('archive : copie sans remote, copie périmée (b, b2)', async () => {
    const copie = octets('copie-sans-remote');
    let archive = null;
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ sha256: H('5'), mime: 'image/jpeg', size: 5000, blob: copie, updated_at: DATE }, { sha256: H('6'), mime: 'image/jpeg', size: 6000, blob: octets('copie-perimee'), updated_at: DATE, remote: R({ size: 77 }) }] });
      archive = await B.createArchive(db);
    });
    const e5 = archive.manifest.files.find((f) => f.sha256 === H('5'));
    eq([archive.copies, 'remote' in e5, e5.bytes_sha256 === await sha256Hex(copie)], [{ serveur: 0, inconnues: 2 }, false, true], 'createArchive : une copie SANS remote et une copie périmée (bytes_sha256 ≠ remote.sha256) réussissent, archivées telles quelles, comptées « inconnues » (mutant : levée « Fichier source endommagé » réintroduite)');
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => { await B.applyArchive(db, insp, { mode: 'merge' }); eq([insp.ok, (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [true, true], 'archive (b) : inspectée et restaurée'); });
  });

  await run('archive fabriquée : formes refusées, relation vers une page manquante (c)', async () => {
    const copie = octets('copie-c'); const shaCopie = await sha256Hex(copie);
    let archive = null;
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ sha256: H('4'), mime: 'image/jpeg', size: 900, blob: copie, updated_at: DATE, remote: R({ sha256: shaCopie, size: copie.size }) }, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }], ...pageVers(H('1')) });
      archive = await B.createArchive(db);
    });
    const fabriquer = async (edit) => B.inspectArchive(await rewriteArchive(archive.blob, edit));
    const seul = await fabriquer(({ manifest }) => { delete manifest.files[0].bytes_sha256; delete manifest.files[0].bytes_mime; });
    const repete = await fabriquer(({ manifest }) => { manifest.missing_files.push({ sha256: H('4'), mime: 'image/jpeg', size: 900 }); });
    const remoteFaux = await fabriquer(({ manifest }) => { manifest.missing_files[0].remote = { sha256: 'court' }; });
    eq([seul.ok, seul.errors.includes('Description de fichier invalide'), repete.ok, repete.errors.some((e) => e.startsWith('Empreinte de fichier répétée')), remoteFaux.ok, remoteFaux.errors.includes('Description de fichier invalide')],
      [false, true, false, true, false, true], 'inspectArchive : bytes_size seul → « Description de fichier invalide » ; même empreinte dans files et missing_files → refusée ; un remote invalide dans missing_files → refusé');
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'merge' });
      eq([insp.ok, (await db.get('source_pages', 'pg1'))?.sha256, (await db.get('files', H('1')))?.remote], [true, H('1'), R({ sha256: H('d'), size: 5 })], 'B-6 : une source_page qui pointe une entrée de missing_files est inspectée ET appliquée (mutant : requireInspection sans missing → « introuvable »)');
    });
  });

  await run('archive figée d’avant le lot (d)', async () => {
    const zip = await (await fetch(new URL('./fixtures/archive-0.8.1-sans-imports.zip', import.meta.url), { cache: 'no-store' })).arrayBuffer();
    const insp = await B.inspectArchive(zip);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'merge' });
      eq([insp.ok, insp.summary.files_distants, insp.summary.files_copies, (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [true, 0, 0, true], 'archive figée (sans missing_files ni bytes_*) : inspectée et restaurée, rien de manquant (mutant : missing_files exigé)');
    });
  });

  await run('restauration en fusion : blob et remote locaux (e, e2, e3)', async () => {
    const orig = await original('original-e2');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [orig, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE }] }); archive = await B.createArchive(db); }); // faite AVANT l'envoi : aucun remote
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      const blobLocal = octets('octets-locaux-de-la-page');
      const remoteO = R({ sha256: orig.sha256, size: orig.size });
      await db.putBatch({ files: [{ ...orig, remote: remoteO }, { sha256: H('1'), mime: 'image/jpeg', size: 10, blob: blobLocal, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }] });
      await B.applyArchive(db, insp, { mode: 'merge' });
      const o = await db.get('files', orig.sha256);
      const p = await db.get('files', H('1'));
      eq([o.remote, p.remote, await sha256Hex(p.blob), (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [remoteO, R({ sha256: H('d'), size: 5 }), await sha256Hex(blobLocal), true], 'fusion (e, e2, e3 ; N-1) : une ligne de missing_files garde le blob local ; une entrée sans remote laisse le remote local, et verifyRestored est vert (mutant : remote comparé sans condition → « contenu différent »)');
    });
    let archive2 = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ ...orig, remote: R({ sha256: orig.sha256, size: orig.size }) }] }); archive2 = await B.createArchive(db); });
    const insp2 = await ouvrir(archive2);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp2, { mode: 'merge' });
      const ecrite = await db.get('files', orig.sha256);
      await db.putBatch({ files: [{ ...ecrite, remote: R({ sha256: H('c') }) }] }); // écart posé APRÈS la restauration
      const v = await B.verifyRestored(db, insp2, { mode: 'merge' });
      eq([v.ok, v.diffs.some((d) => d.startsWith('Copie serveur différente'))], [false, true], 'verifyRestored : là où l’entrée porte un remote, un écart est dit (le contrôle tient là où l’archive affirme quelque chose)');
    });
  });

  // R-G-6 : une archive dont l'entrée est une COPIE (bytes_*) ne remplace jamais l'original local, ni en fusion ni en remplacement.
  const archiveDeCopie = async (shaO, tailleO, copie, remote, mime = 'image/jpeg') => {
    let a = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ sha256: shaO, mime, size: tailleO, blob: copie, updated_at: DATE, remote }] }); a = await B.createArchive(db); });
    return a;
  };
  for (const mode of ['merge', 'replace']) {
    await run(`restauration (${mode}) : l’original local survit à une copie d’archive (e4, e5)`, async () => {
      const orig = await original('original-e4-de-cette-page');
      const copie = octets('copie-e4'); const shaC = await sha256Hex(copie);
      const R1 = R({ sha256: H('d'), size: 7 }); const R2 = R({ sha256: shaC, size: copie.size });
      // Ronde 1 (#26) : la ligne de l'archive dit image/heic, l'original d'ici image/jpeg — la source du type gardé se lit.
      const insp = await ouvrir(await archiveDeCopie(orig.sha256, orig.size, copie, R2, 'image/heic'));
      await withDatabase(async (db) => {
        await db.putBatch({ files: [{ ...orig, remote: R1 }] });
        const bilan = await B.applyArchive(db, insp, { mode });
        const row = await db.get('files', orig.sha256);
        const v = await B.verifyRestored(db, insp, { mode });
        eq([await sha256Hex(row.blob), row.blob.size, row.remote, row.mime, row.size, bilan.originauxConserves, F.estOriginalIci(row), v.ok, v.diffs],
          [orig.sha256, orig.size, R2, 'image/jpeg', orig.size, 1, true, true, []], `R-G-6 (${mode}) : blob INCHANGÉ (l’original), avec sa taille et son type d’ici (ronde 1, #6) ; remote pris de l’archive ; originauxConserves 1, verifyRestored vert (mutants : « blob tel quel » ; comparaison brute bytes_sha256 ?? sha256 dans verifyRestored ; existingFiles vide en remplacement ; mime de l’archive écrit sur l’original gardé)`);
      });
    });
  }

  await run('restauration : une copie locale cède à l’original de l’archive (e6)', async () => {
    const orig = await original('original-e6-de-cette-page');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [orig] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ ...orig, blob: octets('copie-locale-e6'), remote: R({ sha256: H('d'), size: 15 }) }] });
      const bilan = await B.applyArchive(db, insp, { mode: 'merge' });
      const row = await db.get('files', orig.sha256);
      eq([await sha256Hex(row.blob), row.blob.size, bilan.originauxConserves, (await B.verifyRestored(db, insp, { mode: 'merge' })).ok], [orig.sha256, orig.size, 0, true], 'R-G-6 symétrique : la copie locale est remplacée par l’original que l’archive porte');
    });
    await withDatabase(async (db) => {
      await db.putBatch({ files: [orig] });
      eq((await B.applyArchive(db, insp, { mode: 'merge' })).originauxConserves, 0, 'R-G-6 : original ici + original dans l’archive → rien de « conservé » (mutant : garder sans !entreeOriginale → 1)');
    });
  });

  await run('bilans d’archive : textes, renvoi, README, inspection (e7, f, f2, g, h)', async () => {
    const S = await import('../src/ui/settings.js');
    eq([0, 1, 3].map((n) => S.messageOriginauxConserves(n)), [null, '1 original de cet appareil conservé (l’archive portait une copie).', '3 originaux de cet appareil conservés (l’archive portait des copies).'], 'messageOriginauxConserves (e7) : rien à 0, singulier à 1, pluriel (le câblage dans appliquerArchive reste à la revue : confirmDialog y est importé, pas injecté)');
    eq([S.messagesArchive({ missingFiles: 1, copies: { serveur: 0, inconnues: 0 } }), S.messagesArchive({ missingFiles: 0, copies: { serveur: 0, inconnues: 0 } })],
      [['1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.'], []], 'messagesArchive : le singulier à 1 page ; rien à dire, rien de dit');
    eq(S.phrasesInspection({ files_distants: 3, files_copies: 2 }), { puces: ['pages manquantes : 3', 'copies du serveur : 2'], phrases: ['Cette archive renvoie à 3 pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages).'] }, 'phrasesInspection (§ 4.6, B-8) : puces et phrase d’inspection ; rien n’est promis comme « se téléchargera »');
    eq(S.phrasesInspection({ files_distants: 0, files_copies: 0 }), { puces: [], phrases: [] }, 'phrasesInspection : une archive complète ne dit rien de plus');
    eq(S.phrasesInspection({ files_distants: 1, files_copies: 0 }).phrases, ['Cette archive renvoie à 1 page qui n’est pas dedans : si elle est sur le serveur, elle pourra être téléchargée (sur la fiche, ou Réglages → Télécharger toutes les pages).'], 'phrasesInspection (ronde 1, #35) : le singulier à 1 page — jamais « 1 pages »');
    eq(B.compterFichesSynchronisees({ payload: { stores: { books: [{ id: 'a' }] }, files: [{ sha256: H('1') }], missing: [{ sha256: H('2') }, { sha256: H('3') }] } }), 4, 'compterFichesSynchronisees (B-25, g) : files + missing (mutant : missing oublié)');
    let archive = null;
    await withDatabase(async (db) => { archive = await B.createArchive(db); });
    const { readZip, textOf } = await import('../src/core/zip.js');
    ok(textOf(readZip(await archive.blob.arrayBuffer()).get('README.txt')).includes('Le manifeste peut porter l\'identifiant technique du compte qui a envoyé un fichier (un uuid, pas un secret).'), 'README_TXT (S-9, h) : l’identifiant du compte est dit');
    const S0 = await import('../src/ui/state.js');
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
    try {
      await withRepo(async (repo, dbRepo) => {
        const faux = async () => ({ blob: new Blob(['zip'], { type: 'application/zip' }), manifest: { created_at: DATE, counts: {}, files: [] }, bytes: 3, filesBytes: 0, warnings: [], missingFiles: 2, copies: { serveur: 1, inconnues: 1 } });
        const enregistres = [];
        const page = await S.renderSettings({}, {}, { settings: await repo.getSettings(), sync: {} }, { createArchive: faux, telechargerArchive: (blob, nom) => enregistres.push(nom) });
        scene.append(page);
        [...page.querySelectorAll('button')].find((b) => b.textContent === 'Sauvegarder toute ma bibliothèque').click();
        let bilan = null;
        for (let i = 0; i < 300 && !(bilan = page.querySelector('[data-role="bilan-archive"]')); i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([...(bilan?.querySelectorAll('p') || [])].map((p) => p.textContent), ['2 pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.', '1 fichier(s) archivé(s) sont des copies du serveur, pas l’original.', '1 fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.'],
          'Réglages (f, F-15) : avec createArchive injecté, le bilan de création dit les pages manquantes, les copies du serveur et les octets inconnus — une phrase chacun');
        eq(enregistres.length, 1, 'Réglages (f) : l’archive passe par telechargerArchive injecté — aucun téléchargement réel dans le Chrome sans tête (doute 12 de la rév. 1, tranché)');
        // Ronde 1 (#16, #21, #31) : un second clic ne pose qu'UN bilan ; un suivi impossible (setSetting qui lève) ne fait pas taire le bilan.
        const pause = () => new Promise((r) => setTimeout(r, 10));
        const sauvegarder = async () => {
          for (let i = 0; i < 300 && S.archiveEnCours(); i += 1) await pause();
          [...page.querySelectorAll('button')].find((b) => b.textContent === 'Sauvegarder toute ma bibliothèque').click();
          for (let i = 0; i < 300 && S.archiveEnCours(); i += 1) await pause();
        };
        await sauvegarder();
        eq([enregistres.length, page.querySelectorAll('[data-role="bilan-archive"]').length], [2, 1], 'Réglages (f, #16) : deux archives de suite → un seul bilan (mutant : l’ancien bilan jamais retiré)');
        page.querySelector('[data-role="bilan-archive"]').remove();
        dbRepo.mutate = async () => { throw new Error('quota simulé'); }; // repo.setSetting('last_backup') passe par db.mutate : le suivi échoue
        try { await sauvegarder(); } finally { delete dbRepo.mutate; }
        eq([enregistres.length, page.querySelectorAll('[data-role="bilan-archive"]').length], [3, 1], 'Réglages (f, #16, #21) : l’archive est téléchargée mais son suivi ne s’écrit pas → le bilan est dit quand même (posé juste après le téléchargement)');
        // (f2) Le VRAI rapport d'inspection (restoreReport n'est pas exporté) : pickFiles injecté rend une archive à pages manquantes et à copie.
        let archiveF2 = null;
        await withDatabase(async (db2) => {
          const copieF2 = octets('copie-f2'); const shaF2 = await sha256Hex(copieF2);
          await db2.putBatch({ files: [{ sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }, { sha256: H('2'), mime: 'image/png', size: 11, updated_at: DATE }, { sha256: H('4'), mime: 'image/heic', size: 99999, blob: copieF2, updated_at: DATE, remote: R({ sha256: shaF2, size: copieF2.size }) }], ...pageVers(H('1')) });
          archiveF2 = await B.createArchive(db2);
        });
        const zipF2 = new File([await archiveF2.blob.arrayBuffer()], 'f2.zip', { type: 'application/zip' });
        const page2 = await S.renderSettings({}, {}, { settings: await repo.getSettings(), sync: {} }, { pickFiles: async () => [zipF2] });
        scene.append(page2);
        [...page2.querySelectorAll('button')].find((b) => b.textContent === 'Restaurer une sauvegarde…').click();
        let puces = null;
        for (let i = 0; i < 300 && !(puces = [...page2.querySelectorAll('.chips')].find((c) => c.textContent.includes('fichiers vérifiés'))); i += 1) await new Promise((r) => setTimeout(r, 10));
        const textesPuces = [...(puces?.querySelectorAll('.chip') || [])].map((c) => c.textContent);
        eq([textesPuces.includes('pages manquantes : 2'), textesPuces.includes('copies du serveur : 1'), page2.textContent.includes('Cette archive renvoie à 2 pages qui ne sont pas dedans'), page2.textContent.includes('Les pages de cet appareil absentes de l’archive seront retirées d’ici.')], [true, true, true, true],
          'Réglages (f2) : le vrai rapport d’inspection (pickFiles injecté) porte les puces « pages manquantes : 2 » et « copies du serveur : 1 », la phrase de § 4.6 et, le remplacement offert (base non vide), la phrase de B-28 (mutants : puces non rendues ; phrase de remplacement retirée)');
        // Ronde 1 : un rapport rendu par une page neuve de Réglages, pickFiles injecté ; rend la page une fois `attendu(page)` vrai.
        const rapport = async (zip, attendu) => {
          const p = await S.renderSettings({}, {}, { settings: await repo.getSettings(), sync: {} }, { pickFiles: async () => [zip] });
          scene.append(p);
          [...p.querySelectorAll('button')].find((b) => b.textContent === 'Restaurer une sauvegarde…').click();
          for (let i = 0; i < 300 && !attendu(p); i += 1) await pause();
          return p;
        };
        // (#15, #22, #32) Une archive REFUSÉE ne promet rien : ni la phrase « pourront être téléchargées », ni la puce « pages manquantes ».
        const refusee = new File([await rewriteArchive(archiveF2.blob, ({ manifest }) => { manifest.files[0].remote = true; })], 'refusee.zip', { type: 'application/zip' });
        const pageRefus = await rapport(refusee, (p) => p.textContent.includes('Archive refusée'));
        eq([pageRefus.textContent.includes('Archive refusée'), pageRefus.textContent.includes('Cette archive renvoie à'), pageRefus.textContent.includes('pages manquantes :')], [true, false, false],
          'Réglages (#15, #22, #32) : sur une archive refusée, ni la phrase d’inspection ni ses puces (I5 : rien n’est annoncé sans fait)');
        // (#31, S2) Base vide : le remplacement n'est pas offert, la phrase B-28 n'est pas dite.
        dbRepo.isEmpty = async () => true;
        let pageVide = null;
        try { pageVide = await rapport(zipF2, (p) => p.textContent.includes('Restaurer dans cette base vide')); } finally { delete dbRepo.isEmpty; }
        eq([pageVide.textContent.includes('Restaurer dans cette base vide'), pageVide.textContent.includes('Les pages de cet appareil absentes de l’archive seront retirées d’ici.')], [true, false],
          'Réglages (#31) : base vide → « Restaurer dans cette base vide » seul, sans la phrase B-28 (mutant : phrase dite aussi sur base vide)');
        // (#30, S3) Le câblage de messageOriginauxConserves : une vraie fusion, confirmDialog cliqué, sur un original d'ici face à une copie d'archive.
        const origW = await original('original-r1-cablage');
        const copieW = octets('copie-r1-cablage');
        await dbRepo.putBatch({ files: [origW] });
        const archiveW = await archiveDeCopie(origW.sha256, origW.size, copieW, R({ sha256: await sha256Hex(copieW), size: copieW.size }));
        const pageW = await rapport(new File([await archiveW.blob.arrayBuffer()], 'w.zip', { type: 'application/zip' }), (p) => [...p.querySelectorAll('button')].some((b) => b.textContent === 'Fusionner avec la bibliothèque actuelle'));
        [...pageW.querySelectorAll('button')].find((b) => b.textContent === 'Fusionner avec la bibliothèque actuelle').click();
        let dialogue = null;
        for (let i = 0; i < 300 && !(dialogue = document.querySelector('dialog[open]')); i += 1) await pause();
        [...(dialogue?.querySelectorAll('button') || [])].find((b) => b.textContent === 'Restaurer')?.click();
        for (let i = 0; i < 300 && !pageW.textContent.includes('Recharge l’application'); i += 1) await pause();
        eq([pageW.textContent.includes('Restauration vérifiée'), pageW.textContent.includes('1 original de cet appareil conservé (l’archive portait une copie).'), await sha256Hex((await dbRepo.get('files', origW.sha256)).blob)], [true, true, origW.sha256],
          'Réglages (#30) : après une vraie fusion, le bilan dit « 1 original de cet appareil conservé » sous « Restauration vérifiée », et l’original est là (mutant : câblage de messageOriginauxConserves retiré)');
        await S0.relectureEnCours(); // le clic a écrit last_backup : la relecture différée par le bus finit AVANT la fermeture de la base jetable (R-L3-17)
      });
    } finally { scene.remove(); try { sessionStorage.removeItem('cuisineos.archive_created'); } catch { /* stockage indisponible */ } await S0.relireReglages(); }
  });

  // === Tâche 2, ronde 1 — constats de la revue adverse (numéros du rapport, section « Ronde 1 »)

  await run('ronde 1 — remplacement : la ligne d’ici ne sert qu’à la décision ; les octets d’une page manquante restent (#1, #4, #8, #10)', async () => {
    const VIEUX = '2001-01-01T00:00:00.000Z';
    const orig = await original('original-r1-remplacement');
    const origM = await original('original-r1-page-manquante');
    const copieM = octets('copie-r1-page-manquante');
    const RM = R({ sha256: H('d'), size: 5 });
    let archive = null; // faite AVANT l'envoi : l'original sans remote ; deux pages sans octets là-bas (H('1') à remote, origM sans)
    await withDatabase(async (db) => { await db.putBatch({ files: [orig, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: RM }, sansBlob(origM)] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      const local = { created_at: VIEUX, original_filename: 'local.jpg', syncable: false };
      await db.putBatch({ files: [
        { ...orig, ...local, remote: R({ sha256: orig.sha256, size: orig.size }) },
        { sha256: H('1'), mime: 'image/jpeg', size: 10, blob: copieM, updated_at: DATE, ...local, remote: R({ sha256: H('c'), size: 3 }) },
        { ...origM, ...local, remote: R({ sha256: origM.sha256, size: origM.size }) },
        await original('page-absente-de-l-archive'),
      ] });
      const bilan = await B.applyArchive(db, insp, { mode: 'replace' });
      const o = await db.get('files', orig.sha256); const p = await db.get('files', H('1')); const m = await db.get('files', origM.sha256);
      const empreinte = async (r) => (r?.blob instanceof Blob ? sha256Hex(r.blob) : null);
      eq([o.remote, o.created_at === VIEUX, 'original_filename' in o, o.syncable, await empreinte(o)], [null, false, false, true, orig.sha256],
        'remplacement (#1, #10) : entrée sans remote → remote null (jamais celui d’ici), created_at neuf, aucun champ local, syncable selon le type (#24) (mutants : ...existing, existing.remote, existing.created_at gardés en remplacement)');
      eq([await empreinte(p), p.remote, p.created_at === VIEUX, 'original_filename' in p, p.size, p.mime], [await sha256Hex(copieM), RM, false, false, 10, 'image/jpeg'],
        'remplacement (#4, #10, ruling à ratifier) : une page de missing_files garde les octets d’ici ; remote de l’archive, created_at neuf, aucun champ local (mutant : existing.remote gardé pour missing_files)');
      eq([await empreinte(m), F.estOriginalIci(m), m.remote, bilan.originauxConserves], [origM.sha256, true, null, 0],
        'remplacement (#8, I-G3) : l’original d’ici d’une page que l’archive nomme sans ses octets n’est pas effacé et reste un original ; aucun remote gardé d’ici ; rien de « conservé » au sens de R-G-6 (l’archive ne portait pas de copie)');
      eq([(await db.getAll('files')).length, (await B.verifyRestored(db, insp, { mode: 'replace' })).diffs], [3, []],
        'remplacement : la page absente de l’archive est retirée d’ici ; verifyRestored vert (le décompte ne compte pas le blob gardé d’une page manquante)');
    });
  });

  await run('ronde 1 — une page manquante ne fait jamais d’un original une « copie » (#5, P1)', async () => {
    const orig = await original('original-r1-p1-de-cette-page');
    let sansTaille = null; // B a reçu la ligne sans `size` : createArchive l'écrit dans missing_files avec size 0 (et un type faux)
    await withDatabase(async (db) => { await db.putBatch({ files: [{ sha256: orig.sha256, mime: 'image/png', updated_at: DATE, remote: R({ sha256: orig.sha256, size: orig.size }) }] }); sansTaille = await B.createArchive(db); });
    const insp1 = await ouvrir(sansTaille);
    const copie = octets('copie-r1-p1');
    const insp2 = await ouvrir(await archiveDeCopie(orig.sha256, orig.size, copie, R({ sha256: await sha256Hex(copie), size: copie.size })));
    for (const mode of ['merge', 'replace']) {
      await withDatabase(async (db) => {
        await db.putBatch({ files: [orig] });
        await B.applyArchive(db, insp1, { mode });
        const apres1 = await db.get('files', orig.sha256);
        const v1 = await B.verifyRestored(db, insp1, { mode });
        const bilan2 = await B.applyArchive(db, insp2, { mode: 'merge' });
        const apres2 = await db.get('files', orig.sha256);
        eq([sansTaille.manifest.missing_files[0]?.size, apres1.size, apres1.mime, F.estOriginalIci(apres1), v1.ok, bilan2.originauxConserves, await sha256Hex(apres2.blob)], [0, orig.size, 'image/jpeg', true, true, 1, orig.sha256],
          `#5 (${mode}) : le blob d’ici gardé pour une page manquante garde sa taille et son type ; l’original le reste, et une copie d’archive restaurée ensuite ne le remplace pas (mutant : size et mime pris de l’archive)`);
      });
    }
  });

  await run('ronde 1 — une taille d’archive menteuse ne fait pas d’un original une copie (#6, #33 ; P2, P4)', async () => {
    const orig = await original('original-r1-p2-de-cette-page');
    const copie = octets('copie-r1-p2');
    const archive = await archiveDeCopie(orig.sha256, orig.size, copie, R({ sha256: await sha256Hex(copie), size: copie.size }));
    const menteuse = await B.inspectArchive(await rewriteArchive(archive.blob, ({ manifest }) => { manifest.files[0].size = 7; }));
    await withDatabase(async (db) => {
      await db.putBatch({ files: [orig] });
      const bilan = await B.applyArchive(db, menteuse, { mode: 'merge' });
      const row = await db.get('files', orig.sha256);
      eq([menteuse.ok, bilan.originauxConserves, row.size, F.estOriginalIci(row), (await B.verifyRestored(db, menteuse, { mode: 'merge' })).ok], [true, 1, orig.size, true, true],
        'P2 : original gardé → la taille de SES octets, jamais celle que l’archive écrit ; il reste un original, verifyRestored vert (mutant : size de l’archive écrite sur l’original gardé)');
    });
    let archiveO = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [orig] }); archiveO = await B.createArchive(db); });
    const p4 = await B.inspectArchive(await rewriteArchive(archiveO.blob, ({ manifest }) => { Object.assign(manifest.files[0], { bytes_sha256: orig.sha256, bytes_size: orig.size, bytes_mime: 'image/jpeg', size: 3 }); }));
    eq([p4.ok, p4.errors.includes('Description de fichier invalide')], [false, true], 'P4 : une entrée qui se dit l’original (bytes_sha256 === sha256) et dont la taille n’est pas celle de ses octets est refusée');
  });

  await run('ronde 1 — une copie sans taille valide ne passe jamais pour l’original (#7, P3)', async () => {
    const copie = octets('copie-r1-p3-sans-taille');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ sha256: H('8'), mime: 'image/jpeg', blob: copie, updated_at: DATE }] }); archive = await B.createArchive(db); });
    const e = archive.manifest.files[0];
    const insp = await ouvrir(archive);
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'merge' });
      const row = await db.get('files', H('8'));
      const v = await B.verifyRestored(db, insp, { mode: 'merge' });
      eq([e.size, e.bytes_size, F.estOriginalIci(row), v.ok, v.diffs], [0, copie.size, false, true, []], 'P3 : l’entrée d’une copie sans taille valide porte size 0, jamais la longueur des octets ; restaurée, elle reste une copie et le bilan est vert');
    });
  });

  await run('ronde 1 — un original arrivé pendant la restauration n’est jamais remplacé (#9, P6)', async () => {
    const orig = await original('original-r1-p6-de-cette-page');
    const copie = octets('copie-r1-p6');
    const insp = await ouvrir(await archiveDeCopie(orig.sha256, orig.size, copie, R({ sha256: await sha256Hex(copie), size: copie.size })));
    await withDatabase(async (db) => {
      // Un autre onglet importe l'original ENTRE toute lecture d'applyArchive et son écriture : la décision doit se prendre sur la ligne relue.
      const entrelace = { stores: db.stores, getSnapshot: (n) => db.getSnapshot(n), getAll: (s) => db.getAll(s),
        putBatch: (batch, o = {}) => entrelace.mutate({ ...o, puts: batch }),
        mutate: async (args) => { await db.putBatch({ files: [orig] }); return db.mutate(args); } };
      const bilan = await B.applyArchive(entrelace, insp, { mode: 'merge' });
      const row = await db.get('files', orig.sha256);
      eq([await sha256Hex(row.blob), bilan.originauxConserves, F.estOriginalIci(row)], [orig.sha256, 1, true], 'P6 : la décision R-G-6 se prend DANS la transaction d’écriture (condition fusion de db.mutate) : l’original importé entre-temps reste (mutant : décision sur un instantané lu avant)');
    });
  });

  await run('ronde 1 — verifyRestored relit chaque page manquante (#2, #14)', async () => {
    const RM = R({ sha256: H('d'), size: 5 });
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: RM }] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    for (const mode of ['merge', 'replace']) {
      await withDatabase(async (db) => {
        await B.applyArchive(db, insp, { mode });
        const vert = await B.verifyRestored(db, insp, { mode });
        const ecrite = await db.get('files', H('1'));
        await db.putBatch({ files: [{ ...ecrite, remote: R({ sha256: H('c'), size: 5 }) }] });
        const autreCopie = await B.verifyRestored(db, insp, { mode });
        await db.putBatch({ files: [{ ...ecrite, mime: 'image/png' }] });
        const autreType = await B.verifyRestored(db, insp, { mode });
        await db.delete('files', H('1'));
        const absente = await B.verifyRestored(db, insp, { mode });
        eq([vert.diffs, autreCopie.diffs, autreType.diffs, absente.diffs], [[], ['Copie serveur différente : ' + H('1')], ['Métadonnées de fichier différentes : ' + H('1')], ['Fichier absent : ' + H('1')]],
          `verifyRestored (${mode}) : une page manquante est relue — remote écrit ≠ celui de l’archive, type changé, ligne absente (mutants : comparaison du remote retirée ; « Fichier absent » muet ; taille et type non relus)`);
      });
    }
  });

  await run('ronde 1 — formes du manifeste (#3, #12, #13, #29)', async () => {
    const orig = await original('original-r1-formes');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ ...orig, remote: true }, { sha256: H('7'), mime: '', size: 4, updated_at: DATE, remote: { sha256: 'court' } }] }); archive = await B.createArchive(db); });
    const eo = archive.manifest.files.find((f) => f.sha256 === orig.sha256);
    const em = archive.manifest.missing_files.find((f) => f.sha256 === H('7'));
    eq(['remote' in eo, 'remote' in em, em.mime, (await ouvrir(archive)).ok], [false, false, 'application/octet-stream', true],
      'createArchive : un remote invalide n’entre pas dans le manifeste (avec ou sans blob), un type absent devient application/octet-stream, et l’archive reste restaurable (mutants : file.remote || undefined ; mime brut)');
    const copie = octets('copie-r1-formes');
    const archiveC = await archiveDeCopie(H('4'), 900, copie, R({ sha256: await sha256Hex(copie), size: copie.size }));
    const formes = [
      [({ manifest }) => { manifest.files[0].bytes_size += 1; }, 'Taille différente : ' + archiveC.manifest.files[0].path],
      [({ manifest }) => { manifest.files[0].remote = true; }, 'Description de fichier invalide'],
      [({ manifest }) => { manifest.files[0].remote = { sha256: 'court' }; }, 'Description de fichier invalide'],
      [({ manifest }) => { manifest.missing_files = {}; }, 'Description de fichier invalide'],
    ];
    const issues = [];
    for (const [edit, attendue] of formes) { const r = await B.inspectArchive(await rewriteArchive(archiveC.blob, edit)); issues.push([r.ok, r.errors.includes(attendue)]); }
    eq(issues, formes.map(() => [false, true]), 'inspectArchive : bytes_size menteur → « Taille différente » ; remote true ou tronqué dans files → « Description de fichier invalide » ; missing_files qui n’est pas un tableau → refusé (mutants : taille non comparée ; remote des files non validé ; missing_files non-tableau admis)');
  });

  await run('ronde 1 — requireInspection revalide une inspection fabriquée (#18, #25, #28)', async () => {
    const copie = octets('copie-r1-forgee');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ sha256: H('4'), mime: 'image/jpeg', size: 900, blob: copie, updated_at: DATE }, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    const forger = (change) => ({ ...insp, payload: { ...insp.payload, ...change(insp.payload) } });
    const f0 = insp.payload.files[0];
    const forgees = [
      forger((p) => ({ missing: [{ ...p.missing[0], remote: true }] })),
      forger((p) => ({ missing: [...p.missing, { sha256: H('4'), mime: 'image/jpeg', size: 1 }] })),
      forger(() => ({ files: [{ ...f0, remote: { sha256: 'court' } }] })),
      forger(() => ({ files: [{ ...f0, bytes_mime: '' }] })),
      forger(() => ({ missing: 'abc' })),
      forger(() => ({ missing: {} })),
    ];
    const refus = [];
    for (const f of forgees) {
      await withDatabase(async (db) => {
        let message = null;
        try { await B.applyArchive(db, f, { mode: 'merge' }); } catch (e) { message = e.message; }
        refus.push([String(message).startsWith('Archive non validée'), (await db.getAll('files')).length]);
      });
    }
    eq(refus, forgees.map(() => [true, 0]), 'requireInspection : remote invalide ou empreinte commune dans missing, remote ou bytes_mime invalide dans files, missing qui n’est pas un tableau → « Archive non validée », rien d’écrit (mutants : missing ou files non revalidés)');
  });

  await run('ronde 1 — des octets modifiés après l’inspection ne sont jamais écrits (#27)', async () => {
    const orig = await original('original-r1-modifie');
    let archive = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [orig] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    insp.payload.files[0].bytes[0] ^= 1;
    await withDatabase(async (db) => {
      let message = null;
      try { await B.applyArchive(db, insp, { mode: 'merge' }); } catch (e) { message = e.message; }
      eq([message, (await db.getAll('files')).length], ['Fichier modifié depuis la validation : ' + orig.sha256, 0], 'applyArchive : un octet changé entre l’inspection et l’application → refus nommé, rien d’écrit (mutant : contrôle retiré)');
    });
  });

  await run('ronde 1 — le blob d’une copie restaurée a le type de ses octets (#11, #19)', async () => {
    const copie = octets('copie-r1-type');
    const insp = await ouvrir(await archiveDeCopie(H('4'), 99999, copie, R({ sha256: await sha256Hex(copie), size: copie.size }), 'image/heic'));
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'merge' });
      const row = await db.get('files', H('4'));
      eq([row.mime, row.blob.type], ['image/heic', 'image/jpeg'], 'copie restaurée : la ligne garde le type de l’original (image/heic), le blob celui de ses octets (bytes_mime, image/jpeg) — F-9 sert le blob (mutant : type: entry.mime)');
    });
  });

  await run('ronde 1 — les lignes files restaurées sont normalisées comme toute fiche synchronisée (R61, R-L3-10, R-L3-18)', async () => {
    const orig = await original('original-r1-normalise');
    let archive = null; // une entrée avec octets (l'original) et une page manquante
    await withDatabase(async (db) => { await db.putBatch({ files: [orig, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, remote: R({ sha256: H('d'), size: 5 }) }] }); archive = await B.createArchive(db); });
    const insp = await ouvrir(archive);
    const HEURE = '2030-01-02T03:04:05.000Z';
    const sale = 'page' + String.fromCharCode(0) + '.jpg';
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ ...orig, original_filename: sale }, { sha256: H('1'), mime: 'image/jpeg', size: 10, updated_at: DATE, original_filename: sale }] });
      await B.applyArchive(db, insp, { mode: 'merge', horodater: () => HEURE });
      const o = await db.get('files', orig.sha256); const p = await db.get('files', H('1'));
      eq([o.updated_at, p.updated_at, o.original_filename, p.original_filename, (await B.verifyRestored(db, insp, { mode: 'merge', horodate: true })).ok], [HEURE, HEURE, 'page.jpg', 'page.jpg', true],
        'fusion, compte connecté : chaque ligne files écrite (avec ou sans octets) reçoit l’heure du renvoi et ses chaînes sont nettoyées (R61) (mutant : lignes files non normalisées dans la transaction)');
    });
    await withDatabase(async (db) => {
      await B.applyArchive(db, insp, { mode: 'replace' });
      const lignes = await db.getAll('files');
      eq([lignes.length, lignes.every((r) => typeof r.updated_at === 'string' && r.updated_at.length > 0)], [2, true], 'remplacement sans compte : une ligne files restaurée sans heure en reçoit une (R-L3-10) (même mutant)');
    });
  });

  // === Tâche 3 — Storage injecté, octetsAEnvoyer, passe fichiers
  const TR = await import('../src/sync/transport.js');
  const { ErreurImage, dimensionsImage } = await import('../src/core/image.js');
  const { creerStockageFactice } = await import('./stockage-factice.js');
  // Une image dont l'EN-TÊTE PNG dit largeur × hauteur (lu par dimensionsImage, jamais décodé) ; `graine` rend chaque photo unique.
  const entetePng = (largeur, hauteur, { taille = 64, graine = '' } = {}) => {
    const b = new Uint8Array(Math.max(taille, 32));
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const dv = new DataView(b.buffer); dv.setUint32(16, largeur); dv.setUint32(20, hauteur);
    b.set(new TextEncoder().encode(graine).slice(0, b.length - 24), 24);
    return new Blob([b], { type: 'image/png' });
  };
  // Un réducteur injecté : il note ses appels et rend un « JPEG » minuscule et unique (jpeg-1, jpeg-2…), plus petit que toute photo de test.
  const reducteur = () => { const appels = []; return { appels, reduire: async (blob, opts) => { appels.push(opts); return octets('jpeg-' + appels.length); } }; };
  const empreinte = (texte) => sha256Hex(octets(texte));
  async function poserPhoto(repo, db, graine, { largeur = 3000, hauteur = 2000, taille = 64, page = true, type = 'image/png', nom = 'p.png' } = {}) {
    const brut = entetePng(largeur, hauteur, { taille, graine });
    const blob = type === 'image/png' ? brut : new Blob([brut], { type });
    const sha256 = await sha256Hex(blob);
    await repo.putFile(sha256, blob, { original_filename: nom });
    if (page) await db.mutate({ puts: { source_pages: [{ id: 'pg_' + graine, document_id: 'doc_' + graine, sha256, updated_at: DATE }] }, origin: 'device' });
    return sha256;
  }
  const passe = (db, stockage, sur = {}) => F.createFichiers({ db, stockage, getUserId: () => 'u1', qualite: () => 'reduite', ...sur });
  const snapshot = (db) => db.getSnapshot(MAGASINS_SNAPSHOT);
  const sansConsole = async (fn) => { const vrai = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = vrai; } };
  const lireCles = async (db, prefixe) => (await db.getAll('sync_state')).filter((l) => String(l.key).startsWith(prefixe));

  await run('Storage : createStockage, dejaPresent, introuvable (§ 6, B-3)', async () => {
    const appels = [];
    const seau = {
      upload: async (chemin, corps, opts) => { appels.push(['upload', chemin, corps.type, opts]); return { data: null, error: { status: 400, statusCode: '409', code: undefined, message: 'The resource already exists' } }; }, // StorageApiError d'un corps { statusCode: '409', error: 'Duplicate' } : code = corps.code, absent (vendor 2.117.3)
      download: async (chemin) => { appels.push(['download', chemin]); return { data: null, error: { status: 400, statusCode: '404', code: 'not_found', message: 'Object not found' } }; },
      list: async (prefixe, opts) => { appels.push(['list', prefixe, opts]); return { data: [{ name: H('a'), metadata: { size: 3, mimetype: 'image/jpeg' } }], error: null }; },
    };
    const st = TR.createStockage({ storage: { from: (nom) => { appels.push(['from', nom]); return seau; } } });
    const e1 = (await st.envoyer('u1/' + H('a'), octets('abc'), { upsert: false })).erreur;
    const e2 = (await st.recevoir('u1/' + H('a'))).erreur;
    const l = await st.lister('u1', { limit: 1, offset: 0, search: H('a') });
    eq([e1.type, e1.status, e1.statusCode, e1.code, TR.dejaPresent(e1), TR.introuvable(e2), e2.statusCode, l.objets.length, l.erreur],
      ['refus', 400, '409', null, true, true, '404', 1, null], 'createStockage : erreurs classées par classerErreur, statusCode recopié, code absent → null ; « déjà présent » reconnu par statusCode SEUL, introuvable sous la forme 400 + statusCode (mutant : statusCode ignoré → faux)');
    eq(appels.filter((a) => a[0] === 'from').map((a) => a[1]).every((n) => n === 'pages') && appels.find((a) => a[0] === 'upload')[3].upsert === false && appels.find((a) => a[0] === 'list')[2].search === H('a'), true, 'createStockage : seau pages, upsert explicite, list avec search');
    eq([TR.dejaPresent({ status: 409 }), TR.dejaPresent({ code: 'Duplicate' }), TR.dejaPresent({ status: 400, statusCode: '409' }), TR.dejaPresent({ status: 400, statusCode: '409', code: 'KeyAlreadyExists' }), TR.dejaPresent({ status: 400, statusCode: '400' }), TR.introuvable({ status: 404 }), TR.introuvable({ code: 'KeyNotFound' }), TR.introuvable({ code: 'NoSuchKey' }), TR.introuvable({ status: 400, statusCode: '404' }), TR.introuvable({ status: 400 })],
      [true, true, true, true, false, true, true, true, true, false], 'dejaPresent / introuvable : les trois champs lus — 400 + statusCode « 409 » sans code Duplicate est « déjà présent » (mutant : statusCode ignoré → faux)');
    const leve = TR.createStockage({ storage: { from: () => ({ upload: async () => { throw new Error('Failed to fetch'); } }) } });
    eq([(await leve.envoyer('u1/x', octets('a'))).erreur.type, (await TR.createStockage(null).envoyer('u1/x', octets('a'))).erreur.type], ['reseau', 'auth'], 'createStockage : une levée → reseau ; sans client → auth (rien n’est tenté)');
  });

  await run('octetsAEnvoyer : qualité, seuils, mur de 16 Mpx (R-G-4)', async () => {
    const appel = (blob, mime, qualite, reduire) => F.octetsAEnvoyer({ sha256: H('a'), mime, size: blob.size, blob }, { qualite, reduire });
    const r1 = reducteur();
    const grande = entetePng(3000, 200, { graine: 'g' });
    const o1 = await appel(grande, 'image/png', 'originale', r1.reduire);
    const o2 = await appel(octets('%PDF-1.4', 'application/pdf'), 'application/pdf', 'reduite', r1.reduire);
    eq([o1.blob === grande, o1.mime, o2.mime, r1.appels.length], [true, 'image/png', 'application/pdf', 0], 'octetsAEnvoyer : Originale → tel quel ; PDF → tel quel ; reduire jamais appelé');
    const o3 = await appel(grande, 'image/png', 'reduite', r1.reduire);
    eq([o3.mime, o3.blob.type, r1.appels], ['image/jpeg', 'image/jpeg', [{ maxCote: 2000, qualite: 0.8 }]], 'octetsAEnvoyer : 3 000 px → reduire({ maxCote: 2000, qualite: 0.8 }), sortie JPEG');
    const r2 = reducteur();
    const petite = entetePng(1200, 800, { taille: 300 * 1024 });
    const lourde = entetePng(1200, 800, { taille: 900 * 1024 });
    const o4 = await appel(petite, 'image/png', 'reduite', r2.reduire);
    const o5 = await appel(lourde, 'image/png', 'reduite', r2.reduire);
    eq([o4.blob === petite, o5.mime, r2.appels.length], [true, 'image/jpeg', 1], 'octetsAEnvoyer : 1 200 px et 300 Ko → tel quel ; 1 200 px et 900 Ko → réduite (mutant : seuil octetsTelQuel retiré)');
    const o6 = await appel(octets('heic-brut', 'image/heic'), 'image/heic', 'reduite', async () => { throw new ErreurImage('indecodable'); });
    const o7 = await appel(grande, 'image/png', 'reduite', async () => octets('x'.repeat(5000)));
    eq([o6.mime, o6.blob.type, o7.blob === grande], ['image/heic', 'image/heic', true], 'octetsAEnvoyer : HEIC indécodable (Chrome) → tel quel (mutant : refusé) ; réduite plus grosse que l’original → l’original');
    const r3 = reducteur();
    const vingt = entetePng(5000, 4000, { graine: '20mpx' });
    const o8 = await appel(vingt, 'image/png', 'reduite', r3.reduire);
    eq([o8.blob === vingt, o8.tropGrande, o8.pixels, r3.appels.length], [true, true, 20000000, 0], 'octetsAEnvoyer : en-tête de 20 Mpx → tel quel, SANS décodage (R-G-4 ; mutant : mur de pixels retiré → reduire appelé)');
    const toile = new OffscreenCanvas(3000, 200);
    const cx = toile.getContext('2d');
    const img = cx.createImageData(3000, 200);
    let graine = 7;
    for (let i = 0; i < img.data.length; i += 1) { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; img.data[i] = i % 4 === 3 ? 255 : graine >>> 24; }
    cx.putImageData(img, 0, 0);
    const bruit = await toile.convertToBlob({ type: 'image/png' }); // du bruit : le PNG ne se comprime pas, la réduction est plus légère
    const o9 = await F.octetsAEnvoyer({ sha256: H('a'), mime: 'image/png', size: bruit.size, blob: bruit }, { qualite: 'reduite' });
    const dims = await dimensionsImage(o9.blob);
    eq([o9.mime, dims?.largeur, dims?.hauteur], ['image/jpeg', 2000, 133], 'octetsAEnvoyer : une vraie image de 3 000 × 200 (reduireImage réel, canvas) → JPEG de 2 000 × 133');
  });

  await run('passe : trois photos réduites, une telle quelle, un HEIC sans type (a, a2, a3)', async () => {
    await withRepo(async (repo, db) => {
      const s1 = await poserPhoto(repo, db, 'un');
      const s2 = await poserPhoto(repo, db, 'deux');
      const s3 = await poserPhoto(repo, db, 'trois');
      const orpheline = await poserPhoto(repo, db, 'orpheline', { page: false });
      const inconnue = await poserPhoto(repo, db, 'inconnue', { type: '', nom: 'notes.txt' });
      const sf = creerStockageFactice();
      const red = reducteur();
      let lectures = 0;
      const bilan = await passe(db, sf, { reduire: red.reduire, qualite: () => { lectures += 1; return 'reduite'; } }).envoyer({ snapshot: await snapshot(db) });
      const h = await Promise.all([1, 2, 3].map((n) => empreinte('jpeg-' + n)));
      eq([sf.journal.filter((j) => j.methode === 'envoyer').map((j) => [j.chemin, j.type, j.upsert]), bilan.confirmes, bilan.restants, lectures], [h.map((x) => ['u1/' + x, 'image/jpeg', false]), 3, 0, 3], 'passe (a) : trois envois dans l’ordre created_at, le Blob envoyé typé image/jpeg (S-2), qualite() appelée à CHAQUE fichier (B-16)');
      const lignes = await Promise.all([s1, s2, s3].map((s) => db.get('files', s)));
      eq(lignes.map((l) => ({ ...l.remote, uploaded_at: typeof l.remote?.uploaded_at })), h.map((x, i) => ({ sha256: x, size: ('jpeg-' + (i + 1)).length, mime: 'image/jpeg', quality: 'reduite', uploaded_at: 'string', owner: 'u1' })), 'passe (a) : remote = { empreinte et taille des octets envoyés, image/jpeg, quality — le FAIT —, uploaded_at, owner }');
      eq([(await db.getAll('outbox')).filter((e) => e.store === 'files').map((e) => e.id).sort(), (await db.get('files', orpheline)).remote, (await db.get('files', inconnue)).remote], [[s1, s2, s3].sort(), undefined, undefined], 'passe (a) : trois entrées files en file (capture D-G8) ; l’orpheline et le type inconnu intacts (mutant : orpheline envoyée)');
    });
    await withRepo(async (repo, db) => {
      const petite = await poserPhoto(repo, db, 'petite', { largeur: 1200, hauteur: 800 });
      await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      const lp = await db.get('files', petite);
      eq([lp.remote?.sha256, lp.remote?.quality, F.candidatsEnvoi(await snapshot(db), { uid: 'u1', renvoi: true }).some((l) => l.sha256 === petite)], [petite, 'originale', false], 'passe (a2) : une image sous les seuils part telle quelle → quality « originale » (le fait), et n’est pas candidate au renvoi');
    });
    await withRepo(async (repo, db) => {
      const heic = await poserPhoto(repo, db, 'heic', { type: '', nom: 'IMG.HEIC' });
      const sf = creerStockageFactice();
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      const lh = await db.get('files', heic);
      eq([sf.journal.find((j) => j.chemin === 'u1/' + heic)?.type, lh.remote?.mime, lh.remote?.quality, lh.mime], ['image/heic', 'image/heic', 'originale', 'image/heic'], 'passe (a3) : en Originale, un HEIC dont File.type était vide part en copie retypée image/heic (mutant : blob non retypé → type vide → 415 sur le factice)');
    });
  });

  await run('passe : déjà présent (b, b2, c, d)', async () => {
    for (const forme409 of ['status', 'statusCode']) {
      await withRepo(async (repo, db) => {
        const s = await poserPhoto(repo, db, 'deja-' + forme409);
        const h = await empreinte('jpeg-1');
        const sf = creerStockageFactice({ forme409, objets: { ['u1/' + h]: octets('jpeg-1') } });
        const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
        eq([sf.journal.map((j) => [j.methode, j.methode === 'lister' ? j.options.search : j.upsert]), bilan.confirmes, (await db.get('files', s)).remote?.sha256], [[['envoyer', false], ['lister', h]], 1, h], `passe (b, forme ${forme409}) : déjà présent → lister(search = h), taille égale → confirmé sans second envoi (mutants : 409 confirmé sans lister ; statusCode ignoré → file_error type)`);
      });
    }
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'tronquee');
      const h = await empreinte('jpeg-1');
      const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('jpeg-1-tronque') } });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.map((j) => [j.methode, j.methode === 'lister' ? j.options.search : j.upsert]), bilan.confirmes, sf.octets('u1/' + h).size, (await db.get('files', s)).remote?.sha256], [[['envoyer', false], ['lister', h], ['envoyer', true], ['lister', h]], 1, 6, h], 'passe (c) : déjà présent, taille différente → upsert: true puis lister → confirmé');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'menteur');
      const h = await empreinte('jpeg-1');
      const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('ancien') } });
      const menteur = { ...sf, lister: async (prefixe, options) => { const r = await sf.lister(prefixe, options); return { ...r, objets: r.objets.map((o) => ({ ...o, metadata: { ...o.metadata, size: o.metadata.size + 1 } })) }; } };
      const bilan = await passe(db, menteur, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, bilan.erreurs, (await db.get('sync_state', 'file_error:' + s))?.value?.motif, (await db.get('files', s)).remote], [0, 1, 'verification', undefined], 'passe (d) : déjà présent puis deux tailles différentes → file_error verification, rien d’écrit sur la ligne (mutant : remote écrit quand même)');
    });
  });

  await run('passe : erreurs classées (e, f, g, h, i)', async () => {
    await withRepo(async (repo, db) => {
      const jpeg = await poserPhoto(repo, db, 'refusee');
      const pdfBlob = octets('%PDF-1.4 e', 'application/pdf'); const pdf = await sha256Hex(pdfBlob);
      await repo.putFile(pdf, pdfBlob, { original_filename: 'm.pdf' });
      await db.mutate({ puts: { source_documents: [{ id: 'doc_pdf', sha256: pdf, updated_at: DATE }] }, origin: 'device' });
      const bilan = await passe(db, creerStockageFactice({ types: ['application/pdf'] }), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      const e = (await db.get('sync_state', 'file_error:' + jpeg))?.value;
      eq([e?.motif, e?.sens, (await db.get('files', pdf)).remote?.quality, bilan.confirmes, bilan.erreurs], ['type', 'envoi', 'originale', 1, 1], 'passe (e) : 415 → file_error type (envoi), la passe continue sur le suivant (un PDF part tel quel)');
    });
    await withRepo(async (repo, db) => {
      const onze = octets('onze-octets'); const sha = await sha256Hex(onze);
      await repo.putFile(sha, onze, {});
      await db.mutate({ puts: { source_pages: [{ id: 'pg_onze', document_id: 'd', sha256: sha, updated_at: DATE }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const bilan = await passe(db, sf, { qualite: () => 'originale', limites: { ...F.LIMITES_FICHIERS, octetsMax: 10 } }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.length, (await db.get('sync_state', 'file_error:' + sha))?.value?.motif, bilan.erreurs], [0, 'trop_gros', 1], 'passe (f, F-14) : un vrai Blob de 11 octets sous une borne de 10 → aucun appel réseau, file_error trop_gros (mutant : borne retirée)');
    });
    await withRepo(async (repo, db) => {
      const [p1, p2, p3] = [await poserPhoto(repo, db, 'g1'), await poserPhoto(repo, db, 'g2'), await poserPhoto(repo, db, 'g3')];
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', chemin: 'u1/' + await empreinte('jpeg-2'), erreur: { type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' } }] });
      const bilan = await sansConsole(async () => passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) }));
      eq([bilan.confirmes, bilan.restants, bilan.recul, bilan.erreur?.type, sf.journal.filter((j) => j.methode === 'envoyer').length, !!(await db.get('files', p1)).remote, (await db.get('files', p2)).remote, (await db.get('files', p3)).remote, (await lireCles(db, 'file_error:')).length],
        [1, 2, 2000, 'reseau', 2, true, undefined, undefined, 0], 'passe (g) : réseau au deuxième → arrêt, recul 2 s, le premier confirmé, deux restants, rien de marqué (mutant : la passe continue après reseau)');
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'h1');
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: { type: 'auth', status: 401, statusCode: '401', code: null, message: 'x' } }] });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.attenteConnexion, bilan.confirmes, bilan.pauseFichiers, (await lireCles(db, 'file_error:')).length, await db.get('sync_state', 'pause_fichiers')], [true, 0, false, 0, undefined], 'passe (h) : auth → attenteConnexion, rien d’autre');
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'i1');
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: { type: 'quota', status: 413, statusCode: '413', code: null, message: 'exceeded' } }] });
      const p = passe(db, sf, { reduire: reducteur().reduire });
      const bilan = await p.envoyer({ snapshot: await snapshot(db) });
      const encore = await p.envoyer({ snapshot: await snapshot(db) });
      eq([bilan.pauseFichiers, (await db.get('sync_state', 'pause_fichiers'))?.value?.raison, await db.get('sync_state', 'pause'), encore.pause, sf.journal.length], [true, 'stockage', undefined, true, 1], 'passe (i, B-5/S-4) : quota → sync_state.pause_fichiers posé, sync_state.pause ABSENT ; la passe suivante ne tente rien (mutant : clé pause posée)');
    });
  });

  await run('passe : bornes et arrêt (j, k)', async () => {
    await withRepo(async (repo, db) => {
      for (let i = 0; i < 25; i += 1) await poserPhoto(repo, db, 'borne' + i);
      const bilan = await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, bilan.restants], [20, 5], 'passe (j) : 25 candidates → 20 envoyées, 5 restantes (parPasse)');
    });
    await withRepo(async (repo, db) => {
      for (let i = 0; i < 3; i += 1) await poserPhoto(repo, db, 'temps' + i);
      let horloge = 0;
      const sf = creerStockageFactice({ avant: async (methode) => { if (methode === 'envoyer') horloge += 61000; } });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire, maintenant: () => horloge }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, bilan.restants], [1, 2], 'passe (j) : maintenant() saute de 61 s après le premier → confirmes 1 (mutant : borne de temps retirée)');
      const sf2 = creerStockageFactice();
      const bilan2 = await passe(db, sf2, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db), stop: () => sf2.journal.length >= 1 });
      eq([bilan2.confirmes, sf2.journal.filter((j) => j.methode === 'envoyer').length], [1, 1], 'passe (k) : stop() vrai après le premier → arrêt');
    });
  });

  await run('passe : garde de relecture (l, l2, l3, l4 ; N-2)', async () => {
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'disparue');
      const sf = creerStockageFactice({ avant: async (methode) => { if (methode === 'envoyer') await db.mutate({ deletes: { files: [s] }, origin: 'device' }); } });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([await db.get('files', s), bilan.confirmes, await db.count('outbox')], [undefined, 0, 0], 'passe (l) : ligne supprimée pendant l’envoi → rien n’est écrit (mutant : fiche fantôme)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'recue-pendant');
      const recu = R({ sha256: H('c'), size: 9 });
      const sf = creerStockageFactice({ avant: async (methode) => {
        if (methode !== 'envoyer') return;
        const l = await db.get('files', s);
        await db.mutate({ puts: { files: [{ ...l, remote: recu, updated_at: '2030-01-01T00:00:00.000Z' }] }, origin: 'remote' });
      } });
      await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      const l = await db.get('files', s);
      eq([l.remote, l.updated_at, await db.count('outbox')], [recu, '2030-01-01T00:00:00.000Z', 0], 'passe (l2) : une réception pendant l’envoi (updated_at neuf) n’est pas écrasée (mutants : écriture écrasante ; updated_at ignoré)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'renvoi');
      const ligne = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ sha256: H('d'), size: 6 }) }], sync_state: [{ key: 'renvoi_originale', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { ['u1/' + H('d')]: octets('ancien') } });
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      const l = await db.get('files', s);
      eq([l.remote.sha256, l.remote.quality, l.remote.size, !!sf.octets('u1/' + H('d'))], [s, 'originale', ligne.size, true], 'passe (l3) : renvoi en originale → remote originale écrit, l’ancienne copie reste au serveur (orphelin, L5) (mutant : garde de la rév. 2 « autre empreinte → rien » → jamais écrit)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'autre-compte');
      const ligne = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ owner: 'u2' }) }] }, origin: 'device' });
      await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq((await db.get('files', s)).remote.owner, 'u1', 'passe (l4) : ré-envoi sous ce compte → remote de u1 écrit (même mutant)');
    });
  });

  await run('passe : renvoyer en originale, copie sans serveur (m, n)', async () => {
    await withRepo(async (repo, db) => {
      const x = await poserPhoto(repo, db, 'm-original');
      const y = await poserPhoto(repo, db, 'm-copie');
      const z = await poserPhoto(repo, db, 'm-telquel');
      const [lx, ly, lz] = await Promise.all([x, y, z].map((s) => db.get('files', s)));
      await db.mutate({ puts: { files: [{ ...lx, remote: R({ sha256: H('d'), size: 6 }) }, { ...ly, blob: octets('copie-de-y'), remote: R({ sha256: H('b'), size: 10 }) }, { ...lz, remote: R({ sha256: z, size: lz.size, quality: 'originale' }) }], sync_state: [{ key: 'renvoi_originale', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice();
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.filter((j) => j.methode === 'envoyer').map((j) => j.chemin), (await db.get('files', x)).remote.sha256, (await db.get('files', y)).remote.sha256, !!(await db.get('sync_state', 'renvoi_originale'))], [['u1/' + x], x, H('b'), true], 'passe (m) : seule la ligne réduite dont l’ORIGINAL est ici repart, sous sa clé ; une copie réduite sans original ici ne repart pas ; une ligne partie telle quelle non plus (mutant : estOriginalIci ignoré → la copie repart)');
      await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      eq(await db.get('sync_state', 'renvoi_originale'), undefined, 'passe (m) : plus aucune candidate de renvoi → la clé est retirée');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'n-copie');
      const l = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...l, blob: octets('copie-sans-serveur'), remote: null }] }, origin: 'device' });
      const snap = await snapshot(db);
      eq([F.candidatsEnvoi(snap, { uid: 'u1' }).length, F.compterFichiers(snap, { uid: 'u1' }).copiesSansServeur], [0, 1], 'passe (n, S-3) : une copie sans remote n’est PAS candidate (elle partirait « originale ») et compte en copiesSansServeur (mutant : candidate)');
    });
  });

  await run('compterFichiers : les compteurs de Réglages (§ 3.6)', async () => {
    const orig = await original('c-orig');
    const renv = await original('c-renvoi', { remote: R({ sha256: H('d') }) });
    const telq = await original('c-telquel'); telq.remote = R({ sha256: telq.sha256, size: telq.size });
    const dist = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ size: 300 }) };
    const etr = { sha256: H('8'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ owner: 'u2', size: 999 }) };
    const err = await original('c-erreur');
    const inco = await original('c-inconnu', { syncable: false });
    const sans = { ...(await original('c-sans')), blob: octets('copie') };
    const peri = { ...(await original('c-perimee')), blob: octets('vieille'), remote: R({ size: 3 }) };
    const tous = [orig, renv, telq, dist, etr, err, inco, sans, peri];
    const snap = { source_pages: tous.map((l, i) => ({ id: 'p' + i, sha256: l.sha256 })), files: [...tous, await original('c-orpheline')] };
    eq(F.compterFichiers(snap, { uid: 'u1', erreurs: new Set([err.sha256]) }), { aEnvoyer: 1, aTelecharger: 1, octetsATelecharger: 300, enErreur: 1, typeInconnu: 1, copiesPerimees: 1, copiesSansServeur: 1, aRenvoyer: 1 },
      'compterFichiers : un de chaque — un remote d’un autre owner n’est ni à télécharger ni compté en octets (mutant : compté) ; l’orpheline ne compte pas');
  });

  await run('téléchargement sur une tape (§ 4.8, I-G7)', async () => {
    const copie = octets('copie-telechargee'); const shaC = await sha256Hex(copie);
    const ligneDistante = (sha256, sur = {}) => ({ sha256, mime: 'image/heic', size: 999, updated_at: DATE, remote: R({ sha256: shaC, size: copie.size }), ...sur });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [ligneDistante(H('7'))] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: copie } });
      const r = await passe(db, sf).telecharger([H('7')]);
      const l = await db.get('files', H('7'));
      eq([r.recus, sf.journal.map((j) => [j.methode, j.chemin]), l.blob.type, await sha256Hex(l.blob), l.size, l.mime, l.updated_at, l.syncable, await db.count('outbox')],
        [1, [['recevoir', 'u1/' + shaC]], 'image/jpeg', shaC, 999, 'image/heic', DATE, true, 0], 'télécharger : recevoir(u1/remote.sha256), blob écrit typé remote.mime ; size, mime, updated_at de la ligne inchangés ; origine remote (mutant : putFile ordinaire → size réécrit)');
      eq([(await passe(db, sf).telecharger([H('7')])).recus, sf.journal.length], [0, 1], 'télécharger : blob déjà là → aucun appel');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [
        ligneDistante(H('1')),
        ligneDistante(H('2'), { remote: R({ sha256: H('c'), size: copie.size }) }),
        ligneDistante(H('3'), { remote: R({ mime: 'image/svg+xml' }) }),
        ligneDistante(H('4'), { remote: true }),
        ligneDistante(H('5'), { remote: R({ owner: 'u2' }) }),
        ligneDistante(H('6'), { remote: R({ sha256: H('a'), size: 5 }) }),
        ligneDistante(H('8'), { remote: R({ sha256: H('b'), size: 5 }) }),
        ligneDistante(H('9')),
      ], sync_state: [{ key: 'file_error:' + H('9'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: octets('copie-telechargeX'), ['u1/' + H('c')]: octets('court') } });
      const p = passe(db, sf);
      for (const s of [H('1'), H('2'), H('3'), H('4'), H('5'), H('6'), H('9')]) await sansConsole(() => p.telecharger([s]));
      const motif = async (s) => (await db.get('sync_state', 'file_error:' + s))?.value?.motif ?? null;
      eq(await Promise.all([H('1'), H('2'), H('3'), H('4'), H('5'), H('6')].map(motif)), ['empreinte', 'taille', 'forme', 'forme', null, 'introuvable'],
        'télécharger : même taille autres octets → empreinte ; taille fausse → taille ; remote hors liste ou true → forme ; autre compte → aucune erreur (B-4) ; 404 → introuvable');
      eq(sf.journal.map((j) => j.chemin), ['u1/' + shaC, 'u1/' + H('c'), 'u1/' + H('a')], 'télécharger : un remote invalide, un autre compte et une file_error posée ne font AUCUN appel (mutant : owner ignoré → 404 → introuvable)');
      ok(!(await Promise.all([H('1'), H('2'), H('6')].map((s) => db.get('files', s)))).some((l) => l.blob), 'télécharger : un écart n’écrit rien');
      await sansConsole(() => passe(db, creerStockageFactice({ forme404: 'statusCode' })).telecharger([H('8')]));
      eq(await motif(H('8')), 'introuvable', 'télécharger : 404 sous la forme 400 + statusCode « 404 » → introuvable (le mutant « statusCode ignoré » est tué par le test pur d’introuvable)');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [ligneDistante(H('7')), ligneDistante(H('8'))] }, origin: 'remote' });
      let lacher = null;
      const tenu = new Promise((r) => { lacher = r; });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: copie }, avant: async (methode) => { if (methode === 'recevoir') await tenu; } });
      const p = passe(db, sf);
      const a1 = p.telecharger([H('7')]);
      const a2 = p.telecharger([H('7')]);
      lacher();
      const [r1, r2] = await Promise.all([a1, a2]);
      eq([sf.journal.filter((j) => j.methode === 'recevoir').length, r1.recus + r2.recus], [1, 1], 'télécharger : deux appels concurrents sur la même clé → un seul recevoir (mutant : enVol retiré)');
      const sf2 = creerStockageFactice({ objets: { ['u1/' + shaC]: copie }, avant: async (methode) => {
        if (methode !== 'recevoir') return;
        const l = await db.get('files', H('8'));
        await db.mutate({ puts: { files: [{ ...l, updated_at: '2030-01-01T00:00:00.000Z' }] }, origin: 'remote' });
      } });
      const r3 = await passe(db, sf2).telecharger([H('8')]);
      eq([r3.recus, (await db.get('files', H('8'))).blob, await db.get('sync_state', 'file_error:' + H('8'))], [0, undefined, undefined], 'télécharger (N-2) : ligne modifiée pendant la descente → rien d’écrit, aucune file_error (mutant : écriture malgré le changement)');
    });
  });

  await run('télécharger toutes les pages : bornes, reprise, clé', async () => {
    await withRepo(async (repo, db) => {
      const objets = {}; const lignes = []; const pages = [];
      for (let i = 0; i < 25; i += 1) {
        const copie = octets('page-distante-' + i); const sha = await sha256Hex(copie);
        objets['u1/' + sha] = copie;
        const cle = (i + 1).toString(16).padStart(64, '0');
        lignes.push({ sha256: cle, mime: 'image/jpeg', size: 5000, updated_at: DATE, created_at: '2026-10-19T00:00:' + String(i).padStart(2, '0') + '.000Z', remote: R({ sha256: sha, size: copie.size }) });
        pages.push({ id: 'pt' + i, sha256: cle, updated_at: DATE });
      }
      lignes.push({ sha256: H('e'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }); // orpheline
      lignes.push({ sha256: H('f'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ owner: 'u2' }) }); // autre compte
      pages.push({ id: 'ptf', sha256: H('f'), updated_at: DATE });
      const erreur = (sha256) => ({ key: 'file_error:' + sha256, value: { motif: 'introuvable', sens: 'reception', at: DATE } });
      await db.mutate({ puts: { files: lignes, source_pages: pages, sync_state: [erreur(lignes[0].sha256), erreur(lignes[1].sha256), { key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      const snap = await snapshot(db);
      const c = F.compterFichiers(snap, { uid: 'u1', erreurs: new Set([lignes[0].sha256, lignes[1].sha256]) });
      eq([c.aTelecharger, c.octetsATelecharger], [23, lignes.slice(2, 25).reduce((n, l) => n + l.remote.size, 0)], 'compterFichiers : 23 pages à télécharger, octets = Σ remote.size — l’autre owner ignoré (mutant : compté)');
      const sf = creerStockageFactice({ objets });
      const p = passe(db, sf);
      const b0 = await p.telechargerTout({ snapshot: snap, stop: () => sf.journal.length >= 1 });
      const b1 = await p.telechargerTout({ snapshot: await snapshot(db) });
      const cleGardee = !!(await db.get('sync_state', 'telecharger_tout'));
      const b2 = await p.telechargerTout({ snapshot: await snapshot(db) });
      eq([b0.recus, b0.restants, b1.recus, b1.restants, cleGardee, b2.recus, b2.restants, await db.get('sync_state', 'telecharger_tout'), sf.journal.every((j) => Object.hasOwn(objets, j.chemin))],
        [1, 22, 20, 2, true, 2, 0, undefined, true], 'telechargerTout : arrêt sur stop, 20 par passe, reprise à la passe suivante, clé retirée quand plus rien ne manque ; ni orpheline, ni autre owner, ni file_error (mutant : clé jamais retirée)');
    });
  });

  await run('espace serveur : mesure paginée du dossier de ce compte (§ 4.9)', async () => {
    await withRepo(async (repo, db) => {
      const objets = {}; let total = 0;
      for (let i = 0; i < 1250; i += 1) { const o = octets('x'.repeat(1 + (i % 7))); objets['u1/' + String(i).padStart(64, '0')] = o; total += o.size; }
      objets['u2/' + H('a')] = octets('autre-compte');
      const sf = creerStockageFactice({ objets });
      const m = await passe(db, sf).mesurerEspace();
      eq([m.octets, m.objets, m.tronque, typeof m.at, sf.journal.filter((j) => j.methode === 'lister').map((j) => [j.prefixe, j.options.limit, j.options.offset])],
        [total, 1250, false, 'string', [['u1', 1000, 0], ['u1', 1000, 1000]]], 'mesurerEspace : deux pages (offset 0 puis 1000), somme exacte du dossier de CE compte (mutant : pagination retirée → une seule page)');
      const pleine = Array.from({ length: 1000 }, (_, i) => ({ name: String(i), metadata: { size: 2 } }));
      let appels = 0;
      const t = await passe(db, { lister: async () => { appels += 1; return { objets: pleine, erreur: null }; } }).mesurerEspace();
      eq([t.tronque, t.objets, t.octets, appels], [true, 20000, 40000, 20], 'mesurerEspace : 20 pages pleines → tronque: true, 20 appels au plus');
      eq((await passe(db, { lister: async () => ({ objets: [], erreur: { type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' } }) }).mesurerEspace()).erreur?.type, 'reseau', 'mesurerEspace : une erreur rend { erreur }, rien d’autre');
    });
  });

  await run('statique tâche 3 (I-G4, I-G6, R53)', async () => {
    const src = await lire('../src/sync/transport.js');
    ok(src.length > 1000 && src.includes('export function createStockage'), 'statique : transport.js est lu et porte createStockage (garde contre un source vide)');
    eq(['.getPublicUrl(', '.createSignedUrl(', '.remove('].filter((m) => src.includes(m)), [], 'I-G6 : ni URL publique, ni URL signée, ni suppression dans le seul module qui tient client.storage (test de texte, faible, admis)');
    const sw = await lire('../sw.js');
    const modules = [...sw.matchAll(/'\.\/(src\/[^']+\.js)'/g)].map((m) => m[1]).filter((m) => !m.includes('/vendor/'));
    const porteurs = []; const lisentEnLigne = [];
    for (const m of modules) {
      const s = await lire('../' + m);
      if (s.includes('getClient')) porteurs.push(m);
      if (m.startsWith('src/sync/') && s.includes('navigator.onLine')) lisentEnLigne.push(m);
    }
    eq([modules.length > 30, porteurs.sort(), lisentEnLigne], [true, ['src/app.js', 'src/sync/auth.js'], []], 'R53 : getClient n’est nommé que par auth.js (définition) et app.js (seul appelant) ; I-G4 : navigator.onLine n’est lu nulle part dans src/sync/');
  });
}
