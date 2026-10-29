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
const MAGASINS_SNAPSHOT = ['source_pages', 'source_documents', 'book_editions', 'recipes', 'imports', 'files', 'books', 'cook_history'];

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

  await run('vague finale — un refus « conflit » de sync_push sur une ligne files ne fait aucune entrée de journal', async () => {
    const { appliquerReponse } = await import('../src/sync/reponses.js');
    const sha = H('6'); const cle = 'files:' + sha;
    const element = { store: 'files', id: sha, data: { sha256: sha, mime: 'image/jpeg', size: 4, remote: R({ sha256: sha, size: 4 }), updated_at: DATE }, updated_at: DATE, deleted: false };
    const serveur = { data: { sha256: sha, mime: 'image/jpeg', size: 4, remote: R({ sha256: sha, size: 4, owner: 'u1', uploaded_at: '2026-10-19T01:00:00.000Z' }), updated_at: '2026-10-19T01:00:00.000Z' }, updated_at: '2026-10-19T01:00:00.000Z', deleted_at: null };
    const effets = appliquerReponse({ lot: { seqs: [7], elements: [element] }, reponse: { server_time: 't', accepted: [], adjusted: [], rejected: [{ store: 'files', id: sha, reason: 'conflit', server: serveur }] },
      entreesParSeq: new Map([[7, { seq: 7, store: 'files', id: sha }]]), fichesLocales: { [cle]: { ...element.data, blob: octets('abcd'), updated_at: DATE } }, conflitsRenvoyes: new Set() });
    eq([effets.retirer, effets.conflits, effets.quarantaine], [[7], [], []], 'deux appareils, même original, poussées croisées : le refus « conflit » retire l’entrée SANS journal (mutant : conflit journalisé → « Conflits à trancher » nomme une empreinte, I-G8)');
    // Ronde 2 (R-G-24 bis) : la version du serveur est adoptée ICI (comme K-5 et l'ajustement), sans dépendre du curseur — blob gardé, remote et
    // updated_at du serveur ; push.js la refond par conditionFichier dans la transaction.
    const locale = { ...element.data, blob: octets('abcd'), updated_at: DATE };
    const ecrite = effets.reecrire.files?.[0];
    eq([Object.keys(effets.reecrire), effets.reecrire.files?.length, ecrite?.blob instanceof Blob, ecrite?.remote, ecrite?.updated_at, ecrite?.sha256, ecrite?.size],
      [['files'], 1, true, serveur.data.remote, serveur.updated_at, sha, 4], 'refus « conflit » files (ronde 2, R-G-24 bis) : la fiche inchangée pendant l’aller-retour reçoit la version du serveur par fusionnerFichier — blob, clé et taille d’ici, remote et updated_at du serveur (mutant : réécriture retirée → la ligne d’ici diverge en silence quand le curseur est déjà passé)');
    eq(JSON.stringify(ecrite), JSON.stringify(F.fusionnerFichier(locale, serveur.data, serveur.updated_at)), 'refus « conflit » files (ronde 2) : la réécriture est exactement fusionnerFichier(locale, server.data, server.updated_at) — une règle, D-G16');
    const reponseConflit = (server, id = sha) => ({ server_time: 't', accepted: [], adjusted: [], rejected: [{ store: 'files', id, reason: 'conflit', server }] });
    const appliquerFiles = (server, sur = {}) => appliquerReponse({ lot: { seqs: [7], elements: [element] }, reponse: reponseConflit(server, sur.id), entreesParSeq: new Map([[7, { seq: 7, store: 'files', id: sha }]]),
      fichesLocales: Object.hasOwn(sur, 'locale') ? { [cle]: sur.locale } : { [cle]: locale }, conflitsRenvoyes: new Set() });
    // Tombale du serveur (D-G15) : remote null, blob gardé, updated_at de la tombale.
    const tombale = appliquerFiles({ data: null, updated_at: '2026-10-19T01:00:00.000Z', deleted_at: '2026-10-19T01:00:00.000Z' }).reecrire.files?.[0];
    eq([tombale?.remote, tombale?.blob instanceof Blob, tombale?.updated_at, tombale?.sha256], [null, true, '2026-10-19T01:00:00.000Z', sha], 'refus « conflit » files sur une TOMBALE du serveur (ronde 2, D-G15) : la ligne d’ici garde son blob, remote passe à null (elle redevient candidate à l’envoi) — mutant : tombale ignorée → B croit sa photo envoyée');
    // Une ligne bougée pendant l'aller-retour (updated_at différent) n'est pas réécrite : sa version d'ici a sa propre entrée de file (R-L3-7).
    const bougee = appliquerFiles(serveur, { locale: { ...locale, updated_at: '2026-10-19T00:30:00.000Z' } });
    const disparue = appliquerFiles(serveur, { locale: null });
    eq([bougee.retirer, bougee.reecrire, disparue.retirer, disparue.reecrire], [[7], {}, [7], {}], 'refus « conflit » files (ronde 2, R-L3-7) : une fiche bougée ou disparue pendant l’aller-retour n’est pas réécrite (mutant : garde « inchangée » retirée)');
    // R-L3-8 : une clé hors du lot n'est jamais crue — ni retrait, ni réécriture.
    const horsLot = appliquerFiles(serveur, { id: H('9') });
    eq([horsLot.retirer, horsLot.reecrire, horsLot.conflits], [[], {}, []], 'refus « conflit » files (ronde 2, R-L3-8) : un id hors du lot envoyé n’a aucun effet');
    // Une version du serveur illisible (data pas un objet nu, heure illisible) ou plus ANCIENNE que celle d'ici n'est jamais adoptée (comme K-5).
    const formes = [{ ...serveur, data: 'chaine' }, { ...serveur, data: [1, 2] }, { ...serveur, updated_at: 'pas une date' }, { ...serveur, updated_at: '2026-10-18T00:00:00.000Z' }, null];
    eq(formes.map((s) => appliquerFiles(s).reecrire), [{}, {}, {}, {}, {}], 'refus « conflit » files (ronde 2) : data non objet, heure illisible, version plus ancienne qu’ici ou serveur absent → rien n’est réécrit (comme K-5)');
    // Un conflit sur un autre magasin reste journalisé (la règle K-5 ne s'étend qu'à files et assistant_config).
    const livre = { store: 'books', id: 'bq', data: { id: 'bq', title: 'ici', updated_at: DATE }, updated_at: DATE, deleted: false };
    const autre = appliquerReponse({ lot: { seqs: [8], elements: [livre] }, reponse: { server_time: 't', accepted: [], adjusted: [], rejected: [{ store: 'books', id: 'bq', reason: 'conflit', server: { data: { id: 'bq', title: 'là' }, updated_at: DATE, deleted_at: null } }] },
      entreesParSeq: new Map([[8, { seq: 8, store: 'books', id: 'bq' }]]), fichesLocales: { 'books:bq': livre.data }, conflitsRenvoyes: new Set() });
    eq(autre.conflits.map((c) => c.store), ['books'], 'un conflit books reste journalisé (mutant : tout conflit retiré sans journal)');
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
      const couv = bookCover({ id: 'e1', cover_sha256: H('a') }, { title: 'T' }, { fichier: { sha256: H('a'), mime: 'image/heic', blob: jpeg } });
      eq([!!couv.querySelector('.cover-photo img'), vus.map((b) => b.type)], [true, ['image/jpeg']], 'bookCover : une copie JPEG reçue sous une ligne HEIC s’affiche, et le Blob affiché est image/jpeg (le retypage ; la garde est épinglée par la ligne application/pdf ci-dessous)');
      // Vague finale (chef d'orchestre) : la garde `type` ne décide plus que l'AFFICHAGE depuis que displayUrl retype, et la fixture HEIC la passe dans les
      // deux cas (P1, comme photoDuPlat) : une ligne hors liste (application/pdf) dont les octets sont un vrai JPEG ne s'affiche que si la garde lit le
      // type affiché (celui du blob, dans la liste), pas le mime de la ligne.
      vus.length = 0;
      const couvPdf = bookCover({ id: 'e1p', cover_sha256: H('5') }, { title: 'T' }, { fichier: { sha256: H('5'), mime: 'application/pdf', blob: jpeg } });
      eq([!!couvPdf.querySelector('.cover-photo img'), vus.map((b) => b.type)], [true, ['image/jpeg']], 'bookCover (P1, vague finale) : une ligne application/pdf aux octets JPEG s’affiche image/jpeg — la garde lit le type affiché (mutant : garde sur safeDisplayType(fichier.mime) → aucune image)');
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
        eq([vus.map((b) => b.type), !!root.querySelector('.thumbs img'), !!root.querySelector('[data-role="apercu-plat"]')], [['image/jpeg', 'image/jpeg'], true, true], 'import ciblé (poserImage, F-9) : la vignette de page et l’aperçu du plat d’une copie JPEG sous une ligne HEIC sont servis image/jpeg (le retypage ; la garde est épinglée par les lignes application/pdf ci-dessous)');
      });
      // Vague finale (P1, poserImage) : les mêmes lignes sous un mime hors liste (application/pdf) avec des octets JPEG — la garde lit le type affiché.
      vus.length = 0;
      await withRepo(async (repo, db) => {
        const lignePdf = (sha256) => ({ sha256, mime: 'application/pdf', size: 999, blob: jpeg, syncable: true, created_at: DATE, updated_at: DATE });
        await db.mutate({ puts: {
          files: [lignePdf(H('a')), lignePdf(H('b'))],
          source_pages: [{ id: 'pgIP', document_id: 'dIP', sha256: H('b'), updated_at: DATE }],
          recipes: [{ id: 'rIP', original_title: 'Tarte', availability: 'reference_only', edition_id: null, updated_at: DATE }],
          imports: [{ id: 'impIP', kind: 'recette', recipe_id: 'rIP', edition_id: null, scan_session_id: null, status: 'a_lancer', page_ids: ['pgIP'], photo_sha256: H('a'), photo_origin: 'image', created_at: DATE, updated_at: DATE }],
        }, origin: 'device' });
        const recette = await db.get('recipes', 'rIP');
        const ctxIP = { recipesById: new Map([['rIP', recette]]), editionsById: new Map(), booksById: new Map(), sync: {} };
        const root = await renderImportCible({ id: 'rIP' }, {}, ctxIP, { repo, navigate: () => {}, toast: () => {}, fetch: async () => { throw new Error('aucun réseau attendu'); }, pickFiles: async () => [] });
        for (let i = 0; i < 100 && vus.length < 2; i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([vus.map((b) => b.type), !!root.querySelector('.thumbs img')], [['image/jpeg', 'image/jpeg'], true], 'import ciblé (poserImage, P1, vague finale) : vignette et aperçu d’une ligne application/pdf aux octets JPEG servis image/jpeg (mutant : garde sur safeDisplayType(f?.mime) → aucune URL créée)');
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
    ok(/VERSION = 'cuisine-os-v0\.24\.0-\d+'/.test(sw), 'sw.js : VERSION 0.24.0');
    const { APP_VERSION, DB_VERSION } = await import('../src/model/schema.js');
    eq([APP_VERSION, DB_VERSION], ['0.24.0', 6], 'T1 (lot UI-1, carnet) : APP_VERSION 0.24.0, DB_VERSION 6 (index corbeille des livres) (D-G11 : 0.11.0 au lot G ; 0.12.0 au lot C ; 0.13.0 au lot D ; 0.14.0 au lot E ; 0.15.0 au lot F ; 0.16.0 à UI-2)');
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

  await run('vague finale — conditionFichier : bougée ou disparue depuis la lecture → rien (I7)', async () => {
    const T2 = '2030-01-01T00:00:00.000Z';
    const avant = { sha256: H('1'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    const data = { sha256: H('1'), mime: 'image/jpeg', size: 5, remote: R({ sha256: H('f') }), updated_at: T2 };
    const c = F.conditionFichier(H('1'), avant, data, T2);
    eq([c.key, c.fusion({ ...avant, updated_at: '2029-01-01T00:00:00.000Z' }), c.fusion(null), c.fusion({ ...avant })?.remote, c.fusion({ ...avant })?.updated_at],
      [H('1'), null, null, R({ sha256: H('f') }), T2], 'conditionFichier : clé = sha256 ; ligne bougée depuis la lecture → null ; disparue depuis → null ; inchangée → fusion sur la ligne relue (mutants : garde « bougée » retirée ; garde « disparue » retirée)');
    const sansAvant = F.conditionFichier(H('1'), null, data, T2);
    eq([sansAvant.fusion(null)?.sha256, sansAvant.fusion({ ...avant })?.remote], [H('1'), R({ sha256: H('f') })], 'conditionFichier : absente avant et après → créée ; apparue depuis → fusion sur elle');
    // Réception : une ligne qui a bougé ICI pendant la page (version d'ici plus récente, qui a sa propre entrée de file) n'est pas réécrite.
    const { createPull } = await import('../src/sync/pull.js');
    await withRepo(async (repo, db) => {
      const sha = H('2'); const rIci = R({ sha256: H('8'), size: 3 }); const T3 = '2031-01-01T00:00:00.000Z';
      await db.mutate({ puts: { files: [{ sha256: sha, mime: 'image/jpeg', size: 9, updated_at: DATE, remote: R() }] }, origin: 'remote' });
      const vraiGet = db.get; let fait = false;
      db.get = async function (store, cle) {
        const r = await vraiGet.call(this, store, cle);
        if (store === 'files' && cle === sha && !fait) { fait = true; await db.mutate({ puts: { files: [{ ...r, remote: rIci, updated_at: T3 }] }, origin: 'device' }); }
        return r;
      };
      const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: { sha256: sha, mime: 'image/jpeg', size: 9, remote: R({ sha256: H('9') }), updated_at: T2 }, updated_at: T2, deleted_at: null, server_seq: 1 }], []] } });
      try { await createPull({ db, transport: tf, getUserId: () => 'u1' }).recevoir(); } finally { delete db.get; }
      const apres = await db.get('files', sha);
      eq([apres.updated_at, apres.remote], [T3, rIci], 'réception (vague finale) : la ligne bougée ici pendant la page garde son updated_at et son remote (mutant : garde « bougée depuis » retirée → la version du serveur écrase la plus récente)');
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
    eq(S.phrasesInspection({ files_distants: 3, files_copies: 2 }), { puces: ['pages manquantes : 3', 'copies du serveur : 2'], phrases: ['Cette archive renvoie à 3 pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les photos et fichiers).'] }, 'phrasesInspection (§ 4.6, B-8) : puces et phrase d’inspection ; rien n’est promis comme « se téléchargera »');
    eq(S.phrasesInspection({ files_distants: 0, files_copies: 0 }), { puces: [], phrases: [] }, 'phrasesInspection : une archive complète ne dit rien de plus');
    eq(S.phrasesInspection({ files_distants: 1, files_copies: 0 }).phrases, ['Cette archive renvoie à 1 page qui n’est pas dedans : si elle est sur le serveur, elle pourra être téléchargée (sur la fiche, ou Réglages → Télécharger toutes les photos et fichiers).'], 'phrasesInspection (ronde 1, #35) : le singulier à 1 page — jamais « 1 pages »');
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

  await run('vague finale — une copie ne prend jamais la taille de l’original (archive fabriquée, § 11)', async () => {
    const orig = await original('original-vague-archive-0');
    const copie = octets('copie-vague-archive');
    const archive = await archiveDeCopie(orig.sha256, orig.size, copie, R({ sha256: await sha256Hex(copie), size: copie.size }));
    const temoin = await ouvrir(archive);
    // L'attaque : une archive FABRIQUÉE dont la « copie » a EXACTEMENT la taille de l'original (octets quelconques de même longueur, empreinte différente).
    // Ses octets et sa description sont cohérents (bytes_size = longueur = size) : seule la règle « une copie ne prend jamais la taille de l'original »
    // la refuse — sinon estOriginalIci (la taille) la prendrait pour l'original à la restauration.
    // (createArchive lui-même ne produit jamais cette forme : une copie de la taille de l'original y est décrite size 0 — d'où la fabrication par rewriteArchive,
    // qui déclare à l'original la taille de la copie : octets, bytes_size et size cohérents, seule la règle neuve refuse.)
    const fausse = await B.inspectArchive(await rewriteArchive(archive.blob, ({ manifest }) => { manifest.files[0].size = manifest.files[0].bytes_size; }));
    eq([temoin.ok, fausse.ok], [true, false], 'inspectArchive (vague finale) : une copie (bytes_sha256 ≠ sha256) dont bytes_size vaut size est refusée même quand ses octets ont bien cette longueur ; la copie honnête d’une autre taille passe (mutant : règle d’avant → archive admise, octets pris pour l’original à la restauration)');
    // L'app elle-même : une ligne dont les octets ne sont pas l'original mais en ont la taille est archivée comme copie SANS taille (size 0), et reste restaurable.
    const memeTaille = octets('xyz-pas-original'); const shaDeclare = H('7');
    let archiveApp = null;
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ sha256: shaDeclare, mime: 'image/jpeg', size: memeTaille.size, blob: memeTaille, syncable: true, created_at: DATE, updated_at: DATE }] });
      archiveApp = await B.createArchive(db);
    });
    const entree = archiveApp.manifest.files.find((f) => f.sha256 === shaDeclare);
    const inspApp = await ouvrir(archiveApp);
    let restauree = null;
    await withDatabase(async (db) => { await B.applyArchive(db, inspApp, { mode: 'replace' }); restauree = await db.get('files', shaDeclare); });
    eq([entree?.size, entree?.bytes_size, entree?.bytes_sha256, inspApp.ok, restauree?.size, F.estOriginalIci(restauree)], [0, memeTaille.size, await sha256Hex(memeTaille), true, 0, false],
      'createArchive (vague finale) : une copie de la taille de l’original est décrite size 0 (comme une copie sans taille, #7), l’archive passe l’inspection et la ligne restaurée n’est pas prise pour l’original (mutant : size gardé → archive refusée par la nouvelle règle)');
  });

  await run('vague finale — upload_quality ne voyage pas dans l’archive (spec § 3.3 : par appareil)', async () => {
    let archive = null;
    await withDatabase(async (db) => {
      await db.putBatch({ settings: [{ key: 'upload_quality', value: 'originale', updated_at: DATE }, { key: 'ui_locale', value: 'fr', updated_at: DATE }] });
      archive = await B.createArchive(db);
    });
    const insp = await ouvrir(archive);
    const cles = (insp.payload.stores.settings || []).map((r) => r.key);
    let apres = null;
    await withDatabase(async (db) => {
      await db.putBatch({ settings: [{ key: 'upload_quality', value: 'reduite', updated_at: DATE }] });
      await B.applyArchive(db, insp, { mode: 'merge' }); // en remplacement, le magasin settings est vidé puis rempli des réglages publics : le réglage par appareil revient à sa valeur par défaut (dit au § 11)
      apres = await db.get('settings', 'upload_quality');
    });
    eq([cles.includes('upload_quality'), cles.includes('ui_locale'), apres?.value], [false, true, 'reduite'], 'archive (vague finale) : le réglage par appareil upload_quality n’est ni archivé ni écrasé à la restauration ; les autres réglages publics voyagent (mutant : filtre limité aux clés secrètes)');
    // Ronde 2 : le sens « restauration » épinglé sur une archive qui PORTE la ligne (fabriquée, ou produite par un build G de -5 à -12) — injectée par
    // rewriteRows, restaurée en fusion ET en remplacement. Mesuré : en fusion, la valeur d'ici reste ; en remplacement, le magasin settings est vidé
    // puis rempli des réglages publics de l'archive — la ligne est ABSENTE et l'app relit le défaut du dépôt (DEFAULT_SETTINGS : 'reduite').
    const injectee = await B.inspectArchive(await rewriteArchive(archive.blob, async ({ rewriteRows }) => { await rewriteRows('settings', (rows) => { rows.push({ key: 'upload_quality', value: 'originale', updated_at: DATE }); }); }));
    const restaurer = async (mode) => {
      let ligne = null; let lue = null;
      await withRepo(async (repo, db) => {
        await db.putBatch({ settings: [{ key: 'upload_quality', value: 'reduite', updated_at: DATE }] });
        await B.applyArchive(db, injectee, { mode });
        ligne = (await db.get('settings', 'upload_quality'))?.value ?? null;
        lue = await repo.getSetting('upload_quality');
      });
      return [ligne, lue];
    };
    eq([injectee.ok, (injectee.payload.stores.settings || []).some((r) => r.key === 'upload_quality'), await restaurer('merge'), await restaurer('replace')], [true, true, ['reduite', 'reduite'], [null, 'reduite']],
      'archive (ronde 2) : une archive qui porte upload_quality « originale » ne l’écrit jamais — fusion : la valeur d’ici reste ; remplacement : la ligne est absente, l’app relit le défaut « reduite » (mutants : filtre de restauration limité aux clés secrètes ; M9 à la création)');
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
      const entrelace = { stores: db.stores, get: (...a) => db.get(...a), getSnapshot: (n) => db.getSnapshot(n), getAll: (s) => db.getAll(s),
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
      const progres = [];
      const snapA = await snapshot(db);
      const bilan = await passe(db, sf, { reduire: red.reduire, qualite: () => { lectures += 1; return 'reduite'; } }).envoyer({ snapshot: snapA, surProgression: (p) => progres.push(p) });
      const h = await Promise.all([1, 2, 3].map((n) => empreinte('jpeg-' + n)));
      eq([sf.journal.filter((j) => j.methode === 'envoyer').map((j) => [j.chemin, j.type, j.upsert]), bilan.confirmes, bilan.restants, lectures], [h.map((x) => ['u1/' + x, 'image/jpeg', false]), 3, 0, 3], 'passe (a) : trois envois dans l’ordre created_at, le Blob envoyé typé image/jpeg (S-2), qualite() appelée à CHAQUE fichier (B-16)');
      eq([progres, F.compterFichiers(snapA, { uid: 'u1' }).aEnvoyer], [[1, 2, 3].map((n) => ({ sens: 'envoi', n, total: 3 })), 0], 'passe (a, ronde 1) : surProgression reçoit { sens: envoi, n, total } à chaque fichier (garde transfertEnCours de la tâche 5) ; les lignes écrites sont remplacées dans le snapshot de la passe, le compte final y lit 0 à envoyer (S-12 ; mutants : surProgression retiré ; snapshot non remplacé)');
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

  await run('vague finale — des octets tels quels qui ne sont pas l’original ne partent jamais (§ 11, archive fabriquée)', async () => {
    await withRepo(async (repo, db) => {
      const faux = octets('pas-l-original-mais-meme-taille'); const sha = H('4'); // clé ≠ empreinte des octets ; « taille de l'original » = celle des octets
      await repo.putFile(sha, faux, {});
      await db.mutate({ puts: { source_pages: [{ id: 'pg_faux', document_id: 'd', sha256: sha, updated_at: DATE }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const bilan = await passe(db, sf, { qualite: () => 'originale' }).envoyer({ snapshot: await snapshot(db) });
      const e = (await db.get('sync_state', 'file_error:' + sha))?.value;
      eq([sf.journal.length, e?.motif, e?.sens, bilan.erreurs, (await db.get('files', sha)).remote], [0, 'forme', 'envoi', 1, undefined], 'envoi (vague finale) : la ligne passe estOriginalIci par la taille, mais l’empreinte des octets n’est pas la clé → aucun appel réseau, file_error forme (envoi, sans Réessayer), aucun remote (mutant : filet retiré → la copie part sous la clé de l’original)');
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
      for (const g of ['h1', 'h2', 'h3']) await poserPhoto(repo, db, g);
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: { type: 'auth', status: 401, statusCode: '401', code: null, message: 'x' } }] });
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.attenteConnexion, bilan.confirmes, bilan.pauseFichiers, (await lireCles(db, 'file_error:')).length, await db.get('sync_state', 'pause_fichiers'), sf.journal.length, bilan.restants], [true, 0, false, 0, undefined, 1, 3], 'passe (h) : auth → attenteConnexion, rien d’autre — ARRÊT : trois photos, un seul envoi tenté, les trois restent (ronde 1 ; mutant : break → continue, les deux suivantes partiraient)');
    });
    await withRepo(async (repo, db) => {
      // Ronde 1 (B-3) : le refus d'accès de storage-api arrive en HTTP 400 + statusCode « 403 » — par le VRAI createStockage, jamais une erreur
      // déjà classée par le factice : il doit attendre la connexion, jamais marquer chaque photo « Type de fichier refusé ».
      for (const g of ['h403-1', 'h403-2', 'h403-3']) await poserPhoto(repo, db, g);
      const appels = [];
      const seau = { upload: async (chemin) => { appels.push(chemin); return { data: null, error: { status: 400, statusCode: '403', code: 'AccessDenied', message: 'new row violates row-level security policy' } }; } };
      const bilan = await passe(db, TR.createStockage({ storage: { from: () => seau } }), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.attenteConnexion, bilan.erreur?.type, appels.length, (await lireCles(db, 'file_error:')).length, bilan.restants], [true, 'auth', 1, 0, 3], 'passe (h, ronde 1) : 400 + statusCode « 403 » (RLS de storage-api) → attenteConnexion, un seul envoi, aucune file_error (mutant : statut HTTP seul → refus → trois « type »)');
    });
    await withRepo(async (repo, db) => {
      for (const g of ['i1', 'i2', 'i3']) await poserPhoto(repo, db, g);
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: { type: 'quota', status: 413, statusCode: '413', code: null, message: 'exceeded' } }] });
      const p = passe(db, sf, { reduire: reducteur().reduire });
      const bilan = await p.envoyer({ snapshot: await snapshot(db) });
      const encore = await p.envoyer({ snapshot: await snapshot(db) });
      eq([bilan.pauseFichiers, (await db.get('sync_state', 'pause_fichiers'))?.value?.raison, await db.get('sync_state', 'pause'), encore.pause, sf.journal.length, bilan.confirmes, bilan.restants], [true, 'stockage', undefined, true, 1, 0, 3], 'passe (i, B-5/S-4) : quota → sync_state.pause_fichiers posé, sync_state.pause ABSENT ; la passe suivante ne tente rien ; ARRÊT : trois photos, un seul envoi (mutants : clé pause posée ; break → continue, ronde 1)');
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
      eq([l.remote.sha256, l.remote.quality, l.remote.size, !!sf.octets('u1/' + H('d'))], [s, 'originale', ligne.size, true], 'passe (l3) : renvoi en originale → remote originale écrit (mutant : garde de la rév. 2 « autre empreinte → rien » → jamais écrit) ; « l’ancienne copie reste au serveur » est DIT, pas éprouvé : le factice n’a aucune suppression, la garantie est le test de source I-G6 (ronde 1)');
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
      // Ronde 1 : le seau rend des octets typés application/octet-stream (comme le Storage réel peut le faire) : le blob écrit est RETYPÉ par remote.mime.
      const sf = creerStockageFactice({ objets: { ['u1/' + shaC]: new Blob([copie], { type: 'application/octet-stream' }) } });
      const r = await passe(db, sf).telecharger([H('7')]);
      const l = await db.get('files', H('7'));
      eq([r.recus, sf.journal.map((j) => [j.methode, j.chemin]), l.blob.type, await sha256Hex(l.blob), l.size, l.mime, l.updated_at, l.syncable, await db.count('outbox')],
        [1, [['recevoir', 'u1/' + shaC]], 'image/jpeg', shaC, 999, 'image/heic', DATE, true, 0], 'télécharger : recevoir(u1/remote.sha256), blob écrit typé remote.mime alors que le seau rend application/octet-stream ; size, mime, updated_at de la ligne inchangés ; origine remote (mutants : putFile ordinaire → size réécrit ; octets reçus non retypés, ronde 1)');
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

  await run('ronde 2 — une copie reçue ne prend jamais la taille de l’original, quelle que soit l’origine de la ligne (R-G-31)', async () => {
    const { texteErreurFichier } = await import('../src/ui/components.js');
    const lireEtat = async (db, sha) => { const l = await db.get('files', sha); const erreurs = await F.lireErreursFichiers(db); return { l, erreurs, e: erreurs.get(sha) }; };
    const pagesDe = (sha, n) => ({ source_documents: [{ id: 'dq' + n, sha256: sha, updated_at: DATE }], source_pages: [{ id: 'pgq' + n, document_id: 'dq' + n, sha256: sha, updated_at: DATE }] });
    // (a1) Sonde 1 de la re-revue sécurité : une archive FABRIQUÉE par missing_files. La page X n'a pas d'octets ; seul son remote change, pour un objet
    // du dossier du compte (une autre page, lisible dans toute archive partagée) qui a EXACTEMENT la taille de X. bytesValides ne lit que `files` : admise.
    const X = await sha256Hex(octets('original-de-la-page-X-ronde-2'));
    const tailleX = 4321;
    const Y = octets('z'.repeat(tailleX)); const hY = await sha256Hex(Y);
    let archive1 = null;
    await withDatabase(async (db) => {
      await db.putBatch({ files: [{ sha256: X, mime: 'image/jpeg', size: tailleX, updated_at: DATE, remote: R({ sha256: H('d'), size: 900 }) }], ...pagesDe(X, 1) });
      archive1 = await B.createArchive(db);
    });
    const forgee1 = await B.inspectArchive(await rewriteArchive(archive1.blob, ({ manifest }) => { manifest.missing_files[0].remote = R({ sha256: hY, size: Y.size, quality: 'originale' }); }));
    await withDatabase(async (db) => {
      await B.applyArchive(db, forgee1, { mode: 'merge' });
      const sf = creerStockageFactice({ objets: { ['u1/' + hY]: Y } });
      const r = await passe(db, sf).telecharger([X]);
      const { l, erreurs, e } = await lireEtat(db, X);
      eq([forgee1.ok, sf.journal.map((j) => j.chemin), r.recus, r.erreurs, l.blob, l.size, e?.motif, e?.sens, F.etatFichier(l, { uid: 'u1', erreurs }), texteErreurFichier(X, erreurs), F.estOriginalIci(l)],
        [true, ['u1/' + hY], 0, 1, undefined, tailleX, 'taille', 'reception', 'erreur', 'Fichier illisible reçu du serveur.', false],
        'R-G-31 (sonde 1) : archive forgée par missing_files (remote d’un objet de la taille de l’original) — les octets reçus, d’une autre empreinte que la clé et de la taille de la ligne, ne sont JAMAIS écrits : file_error taille/reception, la page le dit (mutant : garde retirée → blob écrit, pris pour l’original à vie)');
    });
    // (a2) Sonde 2 : une entrée missing_files SANS remote dont la size est forgée à celle de la copie du serveur déjà connue ici (fusion).
    const X2 = await sha256Hex(octets('original-de-la-page-X2-ronde-2'));
    const copie = octets('c'.repeat(1234)); const hc = await sha256Hex(copie);
    const ligneIci = { sha256: X2, mime: 'image/jpeg', size: 9999, updated_at: DATE, remote: R({ sha256: hc, size: copie.size }) };
    let archive2 = null;
    await withDatabase(async (db) => { await db.putBatch({ files: [{ ...ligneIci, remote: undefined }], ...pagesDe(X2, 2) }); archive2 = await B.createArchive(db); });
    const forgee2 = await B.inspectArchive(await rewriteArchive(archive2.blob, ({ manifest }) => { manifest.missing_files[0].size = copie.size; delete manifest.missing_files[0].remote; }));
    await withDatabase(async (db) => {
      await db.putBatch({ files: [ligneIci], ...pagesDe(X2, 2) });
      await B.applyArchive(db, forgee2, { mode: 'merge' });
      const avant = await db.get('files', X2);
      const r = await passe(db, creerStockageFactice({ objets: { ['u1/' + hc]: copie } })).telecharger([X2]);
      const { l, erreurs, e } = await lireEtat(db, X2);
      eq([forgee2.ok, avant.size, F.remoteValide(avant.remote), r.recus, l.blob, e?.motif, e?.sens, F.etatFichier(l, { uid: 'u1', erreurs }), F.estOriginalIci(l)],
        [true, copie.size, true, 0, undefined, 'taille', 'reception', 'erreur', false],
        'R-G-31 (sonde 2) : une size forgée à celle de la copie connue ici — la vraie copie, téléchargée, aurait la taille de la ligne : refusée (taille/reception), jamais prise pour l’original');
    });
    // (b) Un téléchargement honnête (copie d'une AUTRE taille que l'original) s'écrit toujours ; (c) l'original au serveur (remote.sha256 = clé, même
    // taille : parti tel quel) s'écrit toujours — c'est l'original, qui a sa taille.
    await withDatabase(async (db) => {
      const honnete = octets('copie-honnete-ronde-2'); const hh = await sha256Hex(honnete);
      const O = octets('original-au-serveur-ronde-2'); const hO = await sha256Hex(O);
      await db.putBatch({ files: [
        { sha256: X, mime: 'image/jpeg', size: tailleX, updated_at: DATE, remote: R({ sha256: hh, size: honnete.size }) },
        { sha256: hO, mime: 'image/jpeg', size: O.size, updated_at: DATE, remote: R({ sha256: hO, size: O.size, quality: 'originale' }) },
      ] });
      const r = await passe(db, creerStockageFactice({ objets: { ['u1/' + hh]: honnete, ['u1/' + hO]: O } })).telecharger([X, hO]);
      const lb = await db.get('files', X); const lc = await db.get('files', hO);
      const empreinteDe = async (blob) => (blob instanceof Blob ? sha256Hex(blob) : null); // un blob absent (mutant) se lit, il ne fait pas lever
      eq([r.recus, r.erreurs, await empreinteDe(lb.blob), F.estOriginalIci(lb), await empreinteDe(lc.blob), F.estOriginalIci(lc), (await F.lireErreursFichiers(db)).size],
        [2, 0, hh, false, hO, true, 0], 'R-G-31 : (b) une copie d’une autre taille s’écrit (une copie) ; (c) l’original au serveur (remote.sha256 = clé, même taille) s’écrit et EST l’original (mutants : garde sur la seule empreinte → (b) refusée ; garde sur la seule taille → (c) refusée)');
    });
  });

  await run('ronde 2 — un refus « conflit » files converge sans dépendre du curseur (R-G-24 bis, sonde S1c de la re-revue)', async () => {
    const { installCapture, uninstallCapture } = await import('../src/sync/outbox.js');
    const { createPush } = await import('../src/sync/push.js');
    const { createPull } = await import('../src/sync/pull.js');
    const { setClockOffset } = await import('../src/sync/clock.js');
    const transport = creerTransportFactice({ serveur: true });
    const stockage = creerStockageFactice();
    await withDatabase((dbA) => withDatabase(async (dbB) => {
      const appareil = (db, sur = {}) => {
        installCapture(db, { getUserId: () => 'u1' });
        return { push: createPush({ db, transport, getUserId: () => 'u1' }), pull: createPull({ db, transport, getUserId: () => 'u1' }),
          fichiers: F.createFichiers({ db, stockage, getUserId: () => 'u1', ...sur }), snap: () => db.getSnapshot(F.MAGASINS_FICHIERS) };
      };
      try {
        // A envoie la photo RÉDUITE et pousse ; B la reçoit (sans octets), puis pose le même original sans rien capturer.
        const A = appareil(dbA, { qualite: () => 'reduite', reduire: async () => octets('jpeg-reduit-ronde-2') });
        const Bp = appareil(dbB, { qualite: () => 'reduite' });
        const photo = entetePng(3000, 2000, { taille: 96, graine: 'renvoi-ronde-2' });
        const sha = await sha256Hex(photo);
        const maintenant = new Date().toISOString();
        await dbA.mutate({ puts: { files: [{ sha256: sha, mime: photo.type, size: photo.size, blob: photo, syncable: true, original_filename: 'p.png', created_at: maintenant, updated_at: maintenant }] }, origin: 'local' });
        await dbA.mutate({ puts: { source_pages: [{ id: 'pg1', document_id: 'd_pg1', sha256: sha, updated_at: DATE }] }, origin: 'device' });
        const envA = await A.fichiers.envoyer({ snapshot: await A.snap() });
        await A.push.envoyer();
        await Bp.pull.recevoir();
        const recue = await dbB.get('files', sha);
        await dbB.mutate({ puts: { files: [{ ...recue, blob: photo, size: photo.size, mime: photo.type, syncable: true }] }, origin: 'device' });
        await dbB.mutate({ puts: { source_pages: [{ id: 'pg1', document_id: 'd_pg1', sha256: sha, updated_at: DATE }] }, origin: 'device' });
        // B : horloge 2 minutes en retard, pas encore corrigée ; « Renvoyer en originale » → un updated_at plus ANCIEN que celui du serveur.
        resetClock(); setClockOffset(-120000);
        await dbB.mutate({ puts: { sync_state: [{ key: 'renvoi_originale', value: true }] }, origin: 'device' });
        const envB = await Bp.fichiers.envoyer({ snapshot: await Bp.snap() });
        const pushB = await Bp.push.envoyer(); // refusé « conflit » par le serveur (u_B < u_serveur)
        const pullB = await Bp.pull.recevoir(); // curseur déjà passé : la réception ne rapporte rien
        const ligneB = await dbB.get('files', sha);
        const serveur = transport.ligne('files', sha);
        eq([envA.confirmes, envB.confirmes, pushB.conflits, pullB.recues, await dbB.count('outbox'), await dbB.count('sync_conflicts'), F.memeRemote(ligneB.remote, serveur.data.remote), ligneB.remote?.quality,
          ligneB.updated_at, await sha256Hex(ligneB.blob), F.estOriginalIci(ligneB), F.compterFichiers(await Bp.snap(), { uid: 'u1' }).aRenvoyer],
        [1, 1, 0, 0, 0, 0, true, 'reduite', serveur.updated_at, sha, true, 1],
        'R-G-24 bis (sonde S1c) : après le refus « conflit » d’un renvoi en originale sous une horloge en retard (curseur déjà passé), la ligne d’ici porte le remote et l’updated_at du SERVEUR, garde son original et redevient « à renvoyer » — aucun journal (mutant : réécriture retirée → B croit l’original envoyé, le serveur reste réduit, rien ne le dit)');
      } finally { uninstallCapture(dbA); uninstallCapture(dbB); }
    }));
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

  // === Tâche 3, ronde 1 — un test par constat de la revue adverse (rouge d'abord pour un comportement changé ; sinon le mutant nommé, rejoué sur copie)
  const reseau = () => ({ type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' });
  const envois = (sf) => sf.journal.filter((j) => j.methode === 'envoyer');
  const copieR1 = octets('copie-ronde-1'); const shaR1 = await sha256Hex(copieR1);
  const distante = (sha256, sur = {}) => ({ sha256, mime: 'image/jpeg', size: 999, updated_at: DATE, remote: R({ sha256: shaR1, size: copieR1.size }), ...sur });
  // Une écriture d'origine remote glissée JUSTE AVANT l'écriture de la passe sur `sha256` (espion sur db.mutate) ; l'appelant le retire en finally.
  const glisser = (db, sha256, sur) => {
    const vrai = db.mutate; let fait = false;
    db.mutate = async function (args) {
      const visees = [...(args?.conditions?.files || []).map((c) => c?.key), ...(args?.puts?.files || []).map((l) => l?.sha256)];
      if (!fait && visees.includes(sha256)) {
        fait = true;
        const l = await this.get('files', sha256);
        await vrai.call(this, { puts: { files: [{ ...l, ...sur }] }, origin: 'remote' });
      }
      return vrai.call(this, args);
    };
    return () => { delete db.mutate; };
  };

  await run('ronde 1 — la garde de relecture est relue DANS la transaction (envoi et réception ; sonde de la revue)', async () => {
    const neuf = R({ sha256: H('c'), size: 9 });
    const tard = '2030-01-01T00:00:00.000Z';
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'glisse-envoi');
      const snap = await snapshot(db);
      const retirer = glisser(db, s, { remote: neuf, updated_at: tard });
      let bilan = null;
      try { bilan = await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: snap }); } finally { retirer(); }
      const l = await db.get('files', s);
      eq([l.remote, l.updated_at, bilan.confirmes, await db.count('outbox')], [neuf, tard, 0, 0], 'passe (ronde 1) : une réception écrite entre la relecture et l’écriture de l’envoi n’est jamais écrasée — la garde est relue DANS la transaction (condition fusion) (mutant R9 : « db.get puis puts » du brief → remote et updated_at remplacés, ligne repartie en local)');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [distante(H('7'))] }, origin: 'remote' });
      const retirer = glisser(db, H('7'), { remote: neuf, updated_at: tard });
      let r = null;
      try { r = await passe(db, creerStockageFactice({ objets: { ['u1/' + shaR1]: copieR1 } })).telecharger([H('7')]); } finally { retirer(); }
      const l = await db.get('files', H('7'));
      eq([r.recus, l.blob, l.remote, l.updated_at], [0, undefined, neuf, tard], 'télécharger (ronde 1) : une réception écrite juste avant l’écriture des octets n’est pas écrasée par la ligne périmée (même mutant R9, à la réception)');
    });
  });

  await run('ronde 1 — « déjà présent » puis une liste qui échoue : une erreur d’envoi, jamais un upsert ni une « vérification » (§ 4.10)', async () => {
    const cas = [[reseau(), ['reseau', false, 2000]], [{ type: 'auth', status: 401, statusCode: '401', code: null, message: 'x' }, ['auth', true, null]], [{ type: 'refus', status: 400, statusCode: '400', code: null, message: 'x' }, ['inconnu', false, 2000]]];
    for (const [panne, attendu] of cas) {
      await withRepo(async (repo, db) => {
        const s = await poserPhoto(repo, db, 'liste-' + panne.type);
        const h = await empreinte('jpeg-1');
        const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('jpeg-1') }, pannes: [{ methode: 'lister', erreur: panne }, { methode: 'lister', erreur: panne }] });
        const bilan = await sansConsole(async () => passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) }));
        eq([sf.journal.map((j) => [j.methode, j.methode === 'lister' ? j.options.search : j.upsert]), [bilan.erreur?.type, bilan.attenteConnexion, bilan.recul], bilan.erreurs, bilan.confirmes, await db.get('sync_state', 'file_error:' + s), (await db.get('files', s)).remote],
          [[['envoyer', false], ['lister', h]], attendu, 0, 0, undefined, undefined], `passe (ronde 1, liste en ${panne.type}) : 409 puis lister en échec → arrêt (${attendu[0]}), ni upsert ni file_error « verification » ; une liste n’est qu’une lecture : seul auth y garde son sens, le reste est passager (mutant : verifierDistant rend « faux » sur une erreur)`);
      });
    }
  });

  await run('ronde 1 — createStockage : le vrai code sous l’enveloppe 400, upsert, offset, Blob rendu, sans client (B-3, § 6)', async () => {
    const formes = [
      [{ status: 400, statusCode: '403', code: 'AccessDenied', message: 'new row violates row-level security policy' }, 'auth'],
      [{ status: 400, statusCode: '403', message: 'new row violates row-level security policy' }, 'auth'],
      [{ status: 400, statusCode: '400', code: 'InvalidJWT', message: 'jwt expired' }, 'auth'],
      [{ status: 400, statusCode: '401' }, 'auth'], [{ status: 403, statusCode: '403' }, 'auth'],
      [{ status: 400, statusCode: '544', code: 'DatabaseTimeout' }, 'reseau'], [{ status: 400, statusCode: '503' }, 'reseau'], [{ status: 400, statusCode: '429' }, 'reseau'],
      [{ status: 400, statusCode: '413', code: 'EntityTooLarge' }, 'quota'],
      [{ status: 400, statusCode: '415', code: 'InvalidMimeType' }, 'refus'], [{ status: 400, statusCode: '400' }, 'refus'], [{ status: 400, statusCode: '409', code: 'Duplicate' }, 'refus'],
      [{ status: 400, statusCode: 'abc' }, 'refus'],
    ];
    const obtenus = [];
    for (const [error] of formes) obtenus.push((await TR.createStockage({ storage: { from: () => ({ upload: async () => ({ data: null, error }) }) } }).envoyer('u1/' + H('a'), octets('a'))).erreur);
    eq(obtenus.map((e) => e.type), formes.map(([, t]) => t), 'createStockage (ronde 1) : sous HTTP 400, un statusCode numérique classe (403/401 → auth, 544/503/429 → reseau, 413 → quota, 415/400 → refus) ; codes InvalidJWT et AccessDenied → auth ; 409 reste refus, lu par dejaPresent avant le type (mutant : statut HTTP seul → tout en refus)');
    eq([obtenus[0].status, obtenus[0].statusCode, obtenus[0].code, TR.dejaPresent(obtenus[11])], [400, '403', 'AccessDenied', true], 'createStockage (ronde 1) : statut HTTP, statusCode et code recopiés tels quels (mutant : code non recopié)');
    const appels = [];
    const rendu = octets('octets-du-seau', 'image/png');
    const seau = {
      upload: async (chemin, corps, opts) => { appels.push(['upload', opts]); return { data: { path: chemin }, error: null }; },
      download: async (chemin) => { appels.push(['download', chemin]); return { data: rendu, error: null }; },
      list: async (prefixe, opts) => { appels.push(['list', prefixe, opts]); return { data: null, error: { status: 500, message: 'panne' } }; },
    };
    const st = TR.createStockage({ storage: { from: () => seau } });
    const e = await st.envoyer('u1/x', octets('a'), { upsert: true });
    const r = await st.recevoir('u1/x');
    const l = await st.lister('u1', { limit: 1000, offset: 1000 });
    const nonBlob = await TR.createStockage({ storage: { from: () => ({ download: async () => ({ data: 'pas un blob', error: null }) }) } }).recevoir('u1/x');
    const sans = TR.createStockage(null);
    const [sr, sl] = [await sans.recevoir('u1/x'), await sans.lister('u1')];
    eq([e.erreur, appels[0][1], r.blob === rendu, r.erreur, appels[2][2].limit, appels[2][2].offset, l.objets, l.erreur?.type, nonBlob.blob, nonBlob.erreur?.type, [sr.blob, sr.erreur?.type], [sl.objets, sl.erreur?.type]],
      [null, { upsert: true }, true, null, 1000, 1000, [], 'reseau', null, 'inconnu', [null, 'auth'], [[], 'auth']], 'createStockage (ronde 1) : upsert: true transmis ; download rend le Blob du seau tel quel ; list reçoit limit ET offset ; une erreur de list est classée ; un corps qui n’est pas un Blob → inconnu ; sans client, recevoir et lister → auth sans appel (mutants : upsert toujours faux ; blob toujours nul ; contrôle Blob retiré ; offset perdu ; recevoir sans garde de client)');
  });

  await run('ronde 1 — un remote invalide ne s’écrit jamais : un original de 0 octet ne part pas, une fois marqué il ne repart plus', async () => {
    await withRepo(async (repo, db) => {
      const vide = new Blob([], { type: 'image/jpeg' }); const sha = await sha256Hex(vide);
      await repo.putFile(sha, vide, { original_filename: 'vide.jpg' });
      await db.mutate({ puts: { source_pages: [{ id: 'pg_vide', document_id: 'd', sha256: sha, updated_at: DATE }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const p = passe(db, sf, { qualite: () => 'originale' });
      const b1 = await p.envoyer({ snapshot: await snapshot(db) });
      const b2 = await p.envoyer({ snapshot: await snapshot(db) });
      const e = (await db.get('sync_state', 'file_error:' + sha))?.value;
      eq([sf.journal.length, b1.confirmes, b1.erreurs, e?.motif, e?.sens, (await db.get('files', sha)).remote, b2.confirmes + b2.erreurs, await db.count('outbox')],
        [0, 0, 1, 'forme', 'envoi', undefined, 0, 0], 'passe (ronde 1, sonde P2) : un fichier vide ne peut porter aucun remote valide (remoteValide : size ≥ 1) → aucun envoi, file_error forme (envoi) posée une fois, la passe suivante ne le reprend plus (mutant : remote non validé → envoyé et réécrit à chaque passe, à vie)');
    });
  });

  await run('ronde 1 — réception : panne passagère, nouvel essai, refus du seau, arrêt (§ 4.8)', async () => {
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [distante(H('1')), distante(H('2')), distante(H('3'))] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaR1]: copieR1 }, pannes: [{ methode: 'recevoir', erreur: reseau() }] });
      const p = passe(db, sf);
      const r = await sansConsole(() => p.telecharger([H('1'), H('2')]));
      eq([r.erreur?.type, r.recus, r.erreurs, (await lireCles(db, 'file_error:')).length, sf.journal.length], ['reseau', 0, 0, 0, 1], 'télécharger (ronde 1) : une panne réseau → arrêt avec erreur, rien de marqué, le second jamais demandé (mutants : réseau classé introuvable ; pas d’arrêt après reseau)');
      const r2 = await p.telecharger([H('1')]);
      eq([r2.recus, sf.journal.length, (await db.get('files', H('1'))).blob instanceof Blob], [1, 2, true], 'télécharger (ronde 1) : la même instance retente la même clé après un échec — enVol est vidé en finally (mutant : enVol jamais vidé → second appel sauté en silence jusqu’au redémarrage)');
      const r3 = await p.telecharger([H('2'), H('3')], { stop: () => sf.journal.length >= 3 });
      eq([r3.recus, sf.journal.length], [1, 3], 'télécharger (ronde 1) : stop() relu avant chaque clé (mutant : stop de telecharger ignoré)');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [distante(H('4'))] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaR1]: copieR1 }, pannes: [{ methode: 'recevoir', erreur: { type: 'refus', status: 400, statusCode: '400', code: null, message: 'x' } }] });
      const r = await sansConsole(() => passe(db, sf).telecharger([H('4')]));
      eq([r.erreurs, r.erreur, (await db.get('sync_state', 'file_error:' + H('4')))?.value?.motif], [1, null, 'introuvable'], 'télécharger (ronde 1) : un refus du seau (400 sans 404) → file_error introuvable, pas un arrêt (mutant : bras refus retiré)');
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [distante(H('5')), distante(H('6'))], source_pages: [{ id: 'pr5', sha256: H('5'), updated_at: DATE }, { id: 'pr6', sha256: H('6'), updated_at: DATE }], sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaR1]: copieR1 }, pannes: [{ methode: 'recevoir', erreur: reseau() }] });
      const b = await sansConsole(async () => passe(db, sf).telechargerTout({ snapshot: await snapshot(db) }));
      eq([b.erreur?.type, b.recus, b.restants, !!(await db.get('sync_state', 'telecharger_tout')), sf.journal.length, (await lireCles(db, 'file_error:')).length], ['reseau', 0, 2, true, 1, 0], 'telechargerTout (ronde 1) : une panne réseau arrête le téléchargement global, la clé telecharger_tout RESTE, rien de marqué (mutant : clé retirée malgré l’erreur)');
    });
  });

  await run('ronde 1 — envoi : file_error posée, renvoi forcé en originale, recul, upsert en échec, nom vérifié, chaînes nettoyées, levée de reduire', async () => {
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'deja-marquee');
      await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + s, value: { motif: 'type', sens: 'envoi', at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const bilan = await passe(db, sf, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([sf.journal.length, bilan.confirmes, bilan.restants, (await db.get('files', s)).remote], [0, 0, 0, undefined], 'passe (ronde 1) : une photo déjà marquée (file_error type) n’est pas renvoyée à chaque passe — envoyer lit les clés file_error (mutant : erreurs: new Map() dans envoyer)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'renvoi-reduite');
      const ligne = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...ligne, remote: R({ sha256: H('d'), size: 6 }) }], sync_state: [{ key: 'renvoi_originale', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const red = reducteur();
      await passe(db, sf, { qualite: () => 'reduite', reduire: red.reduire }).envoyer({ snapshot: await snapshot(db) });
      const l = await db.get('files', s);
      eq([envois(sf).map((j) => j.chemin), l.remote.sha256, l.remote.quality, red.appels.length], [['u1/' + s], s, 'originale', 0], 'passe (ronde 1) : « Renvoyer en originale » sous le réglage Réduite → l’original part quand même (mutant : le renvoi suit le réglage → une réduction renvoyée, 409, boucle)');
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'recul');
      const sf = creerStockageFactice({ pannes: [{ methode: 'envoyer', erreur: reseau() }, { methode: 'envoyer', erreur: reseau() }] });
      const p = passe(db, sf, { reduire: reducteur().reduire });
      const b1 = await sansConsole(async () => p.envoyer({ snapshot: await snapshot(db) }));
      const b2 = await sansConsole(async () => p.envoyer({ snapshot: await snapshot(db) }));
      const b3 = await p.envoyer({ snapshot: await snapshot(db) });
      eq([b1.recul, b2.recul, b3.confirmes, b3.recul], [2000, 4000, 1, null], 'passe (ronde 1) : deux échecs réseau consécutifs → recul 2 s puis 4 s ; la confirmation suivante l’efface (mutant : tentatives jamais incrémentées)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'upsert-panne');
      const h = await empreinte('jpeg-1');
      const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('ancien-plus-long') } }); // une autre taille que jpeg-1 (6 octets)
      const st = { ...sf, envoyer: async (chemin, corps, opts) => { if (!opts?.upsert) return sf.envoyer(chemin, corps, opts); sf.journal.push({ methode: 'envoyer', chemin, upsert: true }); return { erreur: reseau() }; } };
      const bilan = await sansConsole(async () => passe(db, st, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) }));
      eq([sf.journal.map((j) => [j.methode, j.methode === 'lister' ? j.options.search : j.upsert]), bilan.erreur?.type, bilan.recul, bilan.erreurs, await db.get('sync_state', 'file_error:' + s)], [[['envoyer', false], ['lister', h], ['envoyer', true]], 'reseau', 2000, 0, undefined], 'passe (ronde 1) : déjà présent, taille différente, puis l’upsert échoue en réseau → recul, jamais une file_error « verification » (mutant : upsert en échec classé verification)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'autre-nom');
      const h = await empreinte('jpeg-1');
      const sf = creerStockageFactice({ objets: { ['u1/' + h]: octets('jpeg-1') } });
      const st = { ...sf, lister: async (prefixe, options) => { const r = await sf.lister(prefixe, options); return { ...r, objets: r.objets.map((o) => ({ ...o, name: o.name + '.bak' })) }; } };
      const bilan = await passe(db, st, { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq([bilan.confirmes, (await db.get('sync_state', 'file_error:' + s))?.value?.motif], [0, 'verification'], 'passe (ronde 1) : un objet de même taille mais d’un AUTRE nom ne confirme rien (mutant : nom non vérifié dans verifierDistant)');
    });
    await withRepo(async (repo, db) => {
      const s = await poserPhoto(repo, db, 'controle');
      const l = await db.get('files', s);
      await db.mutate({ puts: { files: [{ ...l, original_filename: 'p' + String.fromCharCode(7) + '.png' }] }, origin: 'device' });
      await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) });
      eq((await db.get('files', s)).original_filename, 'p.png', 'passe (ronde 1) : la ligne écrite après confirmation est nettoyée des caractères de contrôle (R61 : sinon conflit perpétuel ; mutant : nettoyerChaines retiré)');
    });
    await withRepo(async (repo, db) => {
      for (const g of ['mpx-1', 'mpx-2']) await poserPhoto(repo, db, g, { largeur: 5000, hauteur: 4000 });
      const vus = []; const vrai = console.error;
      console.error = (...a) => { vus.push(a); };
      try { await passe(db, creerStockageFactice(), { reduire: reducteur().reduire }).envoyer({ snapshot: await snapshot(db) }); } finally { console.error = vrai; }
      eq(vus.filter((a) => String(a[0]).includes('sync.fichiers.trop_grande')).map((a) => a[1]), [{ count: '20000000' }], 'passe (ronde 1) : deux pages de 20 Mpx → logError trop_grande UNE fois par passe, le nombre de pixels seul (mutant : tropGrandeDite retiré)');
    });
    await withRepo(async (repo, db) => {
      const s1 = await poserPhoto(repo, db, 'leve-1');
      const s2 = await poserPhoto(repo, db, 'leve-2');
      let n = 0;
      const reduire = async () => { n += 1; if (n === 1) throw new DOMException('canvas', 'EncodingError'); return octets('jpeg-ok'); };
      const sf = creerStockageFactice();
      const bilan = await sansConsole(async () => passe(db, sf, { reduire }).envoyer({ snapshot: await snapshot(db) }));
      eq([bilan.confirmes, envois(sf).length, (await db.get('files', s1)).remote?.quality, (await db.get('files', s2)).remote?.quality], [2, 2, 'originale', 'reduite'], 'passe (ronde 1, sonde P5) : une levée de reduire qui n’est pas une ErreurImage (EncodingError, contexte 2D nul) n’arrête plus la passe : la photo part telle quelle, la suivante est réduite (mutant : levée relancée → envoyer rejette, plus rien ne part)');
    });
  });

  await run('ronde 1 — octetsAEnvoyer : le GRAND côté décide (portrait)', async () => {
    const r = reducteur();
    const portrait = entetePng(800, 3000, { graine: 'portrait' });
    const o = await F.octetsAEnvoyer({ sha256: H('a'), mime: 'image/png', size: portrait.size, blob: portrait }, { qualite: 'reduite', reduire: r.reduire });
    eq([o.mime, r.appels.length], ['image/jpeg', 1], 'octetsAEnvoyer (ronde 1) : une page portrait de 800 × 3 000 sous 600 Ko est réduite — le grand côté, pas la largeur (mutant : largeur seule)');
  });

  await run('ronde 1 — télécharger toutes les pages : ordre, borne de temps, progression, snapshot, pages encore manquantes', async () => {
    const poserDistantes = async (db, cles) => {
      const objets = {}; const lignes = [];
      for (const [i, cle] of cles.entries()) {
        const copie = octets('tout-r1-' + i); const sha = await sha256Hex(copie);
        objets['u1/' + sha] = copie;
        lignes.push({ sha256: cle, mime: 'image/jpeg', size: 5000, updated_at: DATE, created_at: '2026-10-19T00:00:0' + (cles.length - i) + '.000Z', remote: R({ sha256: sha, size: copie.size }) });
      }
      await db.mutate({ puts: { files: lignes, source_pages: cles.map((cle, i) => ({ id: 'ptr' + i, sha256: cle, updated_at: DATE })), sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      return { objets, lignes };
    };
    await withRepo(async (repo, db) => {
      const { objets, lignes } = await poserDistantes(db, [H('1'), H('2'), H('3')]);
      const snap = await snapshot(db);
      const avant = F.compterFichiers(snap, { uid: 'u1' }).aTelecharger;
      const progres = [];
      const sf = creerStockageFactice({ objets });
      const b = await passe(db, sf).telechargerTout({ snapshot: snap, surProgression: (p) => progres.push(p) });
      eq([avant, b.recus, b.restants, F.compterFichiers(snap, { uid: 'u1' }).aTelecharger, sf.journal.map((j) => j.chemin), progres],
        [3, 3, 0, 0, [...lignes].reverse().map((l) => 'u1/' + l.remote.sha256), [1, 2, 3].map((n) => ({ sens: 'reception', n, total: 3 }))], 'telechargerTout (ronde 1) : dans l’ordre created_at (pas celui des clés), surProgression en sens reception, et les lignes reçues remplacées dans le snapshot — le compte final y lit 0 à télécharger (mutants : tri retiré ; surProgression retiré ; snapshot non remplacé, S-12)');
    });
    await withRepo(async (repo, db) => {
      const { objets } = await poserDistantes(db, [H('1'), H('2'), H('3')]);
      let horloge = 0;
      const sf = creerStockageFactice({ objets, avant: async (methode) => { if (methode === 'recevoir') horloge += 61000; } });
      const b = await passe(db, sf, { maintenant: () => horloge }).telechargerTout({ snapshot: await snapshot(db) });
      eq([b.recus, b.restants, !!(await db.get('sync_state', 'telecharger_tout'))], [1, 2, true], 'telechargerTout (ronde 1) : maintenant() saute de 61 s → un seul fichier, deux restants, la clé reste (mutant : borne dureeMs retirée)');
    });
    await withRepo(async (repo, db) => {
      const { objets } = await poserDistantes(db, [H('9')]);
      const sf = creerStockageFactice({ objets, avant: async (methode) => {
        if (methode !== 'recevoir') return;
        const l = await db.get('files', H('9'));
        await db.mutate({ puts: { files: [{ ...l, updated_at: '2030-01-01T00:00:00.000Z' }] }, origin: 'remote' });
      } });
      const b = await passe(db, sf).telechargerTout({ snapshot: await snapshot(db) });
      eq([b.recus, b.restants, !!(await db.get('sync_state', 'telecharger_tout')), (await db.get('files', H('9'))).blob], [0, 1, true, undefined], 'telechargerTout (ronde 1, sonde P4) : la seule page manquante change pendant la descente (garde N-2) → elle manque ENCORE : restants 1, la clé « Télécharger toutes les photos et fichiers » reste (mutant : candidate refusée comptée comme traitée → clé retirée, page absente)');
    });
    await withRepo(async (repo, db) => {
      const { objets } = await poserDistantes(db, [H('8')]);
      let lacher = null; const tenu = new Promise((r) => { lacher = r; });
      let recus = 0; // seul le PREMIER recevoir (celui de la tape) est tenu : sous un mutant, le second ne bloque rien (pas d'interblocage)
      const sf = creerStockageFactice({ objets, avant: async (methode) => { if (methode === 'recevoir' && (recus += 1) === 1) await tenu; } });
      const p = passe(db, sf);
      const tape = p.telecharger([H('8')]);
      const b = await p.telechargerTout({ snapshot: await snapshot(db) });
      const cle = !!(await db.get('sync_state', 'telecharger_tout'));
      lacher();
      const t = await tape;
      eq([b.recus, b.restants, cle, t.recus, sf.journal.length], [0, 1, true, 1, 1], 'telechargerTout (ronde 1) : une page déjà en vol pour une tape (enVol) n’est pas comptée comme traitée — la clé reste tant qu’elle n’est pas arrivée (mutant : candidate sautée comptée)');
    });
  });

  await run('ronde 1 — sans compte, garde S-13, magasins du snapshot', async () => {
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'sans-compte');
      await db.mutate({ puts: { files: [distante(H('7'))] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { ['u1/' + shaR1]: copieR1 } });
      const p = F.createFichiers({ db, stockage: sf, getUserId: () => null });
      const snap = await snapshot(db);
      eq([(await p.envoyer({ snapshot: snap })).rien, (await p.telecharger([H('7')])).rien, (await p.telechargerTout({ snapshot: snap })).rien, (await p.mesurerEspace()).erreur?.type, sf.journal.length], [true, true, true, 'auth', 0], 'sans compte (ronde 1) : envoyer, telecharger et telechargerTout rendent { rien: true }, mesurerEspace une erreur auth — aucun appel au seau (mutants : garde de compte retirée)');
      await db.mutate({ puts: { files: [{ sha256: 'pas-une-empreinte', mime: 'image/jpeg', size: 5, updated_at: DATE, remote: true }] }, origin: 'remote' });
      const r = await sansConsole(() => passe(db, sf).telecharger(['pas-une-empreinte']));
      eq([r.erreurs, await db.get('sync_state', 'file_error:pas-une-empreinte'), sf.journal.length], [1, undefined, 0], 'S-13 (ronde 1) : une clé files qui n’est pas une empreinte ne devient jamais une clé sync_state file_error (mutant : garde de forme de poserErreur retirée)');
    });
    eq([...F.MAGASINS_FICHIERS], MAGASINS_SNAPSHOT, 'MAGASINS_FICHIERS (I2) : les huit magasins du snapshot, dont les photos des cuissons (mutant : un magasin retiré)');
  });

  // === Tâche 4 — moteur (D-G13, § 3.6, § 4.7)
  const { createMoteur } = await import('../src/sync/moteur.js');
  const fenetreMuette = () => ({ addEventListener() {}, removeEventListener() {}, document: { visibilityState: 'visible' } });
  const busMuet = { on: () => () => {} };
  // Toutes les tables marquées « fait » : la file ne porte que ce que le test écrit (comme tests/sync-l3.js).
  const toutDejaEnvoye = (db) => db.mutate({ puts: { sync_state: SYNC_STORES.map((t) => ({ key: `backfill:${t}`, value: 'fait' })) }, origin: 'device' });
  const moteurDe = (db, sur = {}) => createMoteur({ db, getUserId: () => 'u1', transport: creerTransportFactice({ lire: {} }), fenetre: fenetreMuette(), bus: busMuet, ...sur });
  const ligneDistanteDe = async (db, texte, cle = H('7')) => {
    const copie = octets(texte); const shaC = await sha256Hex(copie);
    // Ronde 2 (R-G-31) : la ligne déclare 99 octets — une copie ne prend jamais la taille de l'original ; avec 9, les copies de 9 octets (« global-10 »…) étaient refusées.
    await db.mutate({ puts: { files: [{ sha256: cle, mime: 'image/jpeg', size: 99, updated_at: DATE, remote: R({ sha256: shaC, size: copie.size }) }] }, origin: 'remote' });
    return { copie, chemin: 'u1/' + shaC };
  };

  await run('moteur sans stockage : L3 telle quelle, clés L4 au repos', async () => {
    await withRepo(async (repo, db) => {
      const m = moteurDe(db);
      const phases = []; m.onEtat((e) => phases.push(e.phase));
      const e0 = m.etat();
      const fin = await m.executer('t');
      eq([e0.fichiers, e0.progressionFichiers, e0.espaceServeur, e0.telechargementGlobal, e0.pauseFichiers, fin.derniersEffets.fichiersRecus, phases.includes('fichiers'), Object.isFrozen(fin.fichiers), await m.telecharger([H('a')])],
        [{ aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0 }, null, null, false, null, 0, false, true, { rien: true }],
        'moteur sans stockage : les clés L4 existent à leur valeur de repos, figées ; aucune phase fichiers ; fichiersRecus toujours présent (§ 3.6) ; une tape ne fait rien');
      await m.arreter();
    });
  });

  await run('moteur avec stockage : phases, compte final, espace, planifier', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'moteur-1');
      const tf = creerTransportFactice({ serveur: true });
      const m = moteurDe(db, { transport: tf, stockage: creerStockageFactice(), reduire: reducteur().reduire, delaiRegroupementMs: 1 });
      const phases = []; m.onEtat((e) => { if (e.phase && phases.at(-1) !== e.phase) phases.push(e.phase); });
      const fin = await m.executer('t');
      const phasesDeLaPasse = [...phases]; // relevées AVANT tout await : la passe suivante (planifier, 1 ms) en ajouterait
      eq([phasesDeLaPasse, fin.fichiers.aEnvoyer, fin.espaceServeur?.objets, (await db.get('sync_state', 'storage_usage'))?.value?.objets, fin.progressionFichiers], [['envoi_initial', 'envoi', 'reception', 'fichiers'], 0, 1, 1, null],
        'moteur : envoi initial → envoi → réception → fichiers ; fin.fichiers recompté (le snapshot mis à jour) ; espace mesuré après une confirmation ; progression retirée en fin de passe');
      let partie = false;
      for (let i = 0; i < 300 && !(partie = (await db.count('outbox')) === 0 && !!tf.ligne('files', s)); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([partie, tf.ligne('files', s)?.data?.remote?.sha256, 'blob' in (tf.ligne('files', s)?.data || {})], [true, await empreinte('jpeg-1'), false], 'moteur : confirmes > 0 → planifier() — la ligne files part à la passe suivante, sans blob (mutant : planifier non appelé → l’entrée attend)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 21; i += 1) await poserPhoto(repo, db, 'reprise' + i);
      const minuteries = []; const vrai = globalThis.setTimeout;
      globalThis.setTimeout = (fn, ms, ...reste) => { minuteries.push(ms); return vrai(fn, ms, ...reste); };
      let m = null;
      try { m = moteurDe(db, { stockage: creerStockageFactice(), reduire: reducteur().reduire, delaiRegroupementMs: 50000 }); await m.executer('t'); }
      finally { globalThis.setTimeout = vrai; }
      ok(minuteries.includes(1000), 'moteur : restants > 0 sans erreur, page visible → reprise programmée à 1 s (mutant : pas de reprise)');
      await m.arreter();
    });
  });

  await run('moteur : arrêt pendant la passe, pauses, sans compte', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 3; i += 1) await poserPhoto(repo, db, 'arret' + i);
      let m = null;
      const sf = creerStockageFactice({ avant: async (methode) => { if (methode === 'envoyer') m.arreter(); } }); // jamais attendu ici : arreter() attend la passe
      m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire });
      await m.executer('t');
      eq(sf.journal.filter((j) => j.methode === 'envoyer').length, 1, 'moteur : arreter() pendant la passe → stop() vrai, aucun envoi de plus');
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'en-pause');
      await repo.save('books', { id: 'bP', title: 'Part quand même' });
      await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ serveur: true }); const sf = creerStockageFactice();
      const m = moteurDe(db, { transport: tf, stockage: sf, reduire: reducteur().reduire });
      const fin = await m.executer('t');
      eq([tf.journal.some((j) => j.appel === 'pousser' && j.rows.some((r) => r.id === 'bP')), sf.journal.length, fin.pauseFichiers?.raison], [true, 0, 'stockage'], 'moteur (B-5, S-4) : pause_fichiers posée → les fiches partent, la passe fichiers n’est pas tentée (mutant : passe fichiers tentée)');
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: DATE } }] }, origin: 'device' });
      await m.envoyerMaintenant();
      eq([await db.get('sync_state', 'pause'), await db.get('sync_state', 'pause_fichiers'), m.etat().pause, m.etat().pauseFichiers], [undefined, undefined, null, null], 'envoyerMaintenant : lève pause ET pause_fichiers');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      // § 7 « pause (L3) posée » avec un stockage : l'envoi des fiches est sauté comme en L3 ; la passe fichiers, elle, tourne — le seau a son
      // propre quota (D-G4) : les octets montent, la ligne confirmée attend en file la levée de la pause (doute 14, ratifié par P3 : le stockage
      // n'est pas le quota des fiches).
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'pause-l3');
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ serveur: true }); const sf = creerStockageFactice();
      const m = moteurDe(db, { transport: tf, stockage: sf, reduire: reducteur().reduire });
      const fin = await m.executer('t');
      eq([tf.journal.filter((j) => j.appel === 'pousser').length, sf.journal.filter((j) => j.methode === 'envoyer').length, !!(await db.get('files', s)).remote, (await db.getAll('outbox')).filter((e) => e.store === 'files').map((e) => e.id), fin.pause?.raison],
        [0, 1, true, [s], 'quota'], 'moteur (pause L3 + stockage, P3 ratifié) : aucun pousser (comme en L3) ; la passe fichiers envoie et confirme ; la ligne files attend en file la levée de la pause (mutants : push appelé malgré la pause ; passe fichiers sautée sous pause)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'sans-compte');
      const sf = creerStockageFactice();
      const m = moteurDe(db, { getUserId: () => null, stockage: sf, reduire: reducteur().reduire });
      await m.executer('t');
      eq(sf.journal.length, 0, 'moteur : sans compte, la passe fichiers ne tente rien');
      await m.arreter();
    });
  });

  await run('moteur : vols tenus — tape puis arrêt (D-G13, B-9)', async () => {
    await withRepo(async (repo, db) => {
      const { copie, chemin } = await ligneDistanteDe(db, 'copie-tape');
      let lacher = null; const tenu = new Promise((r) => { lacher = r; });
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, avant: async (methode) => { if (methode === 'recevoir') await tenu; } });
      const m = moteurDe(db, { stockage: sf });
      const tape = m.telecharger([H('7')]);
      await new Promise((r) => setTimeout(r, 0));
      let arretFini = false;
      const arret = m.arreter().then(() => { arretFini = true; });
      await new Promise((r) => setTimeout(r, 20));
      const avantLacher = arretFini;
      lacher();
      await arret;
      const ecrite = await db.get('files', H('7'));
      const apres = await m.telecharger([H('7')]);
      eq([avantLacher, (await tape).recus, ecrite.blob instanceof Blob, apres, sf.journal.filter((j) => j.methode === 'recevoir').length], [false, 1, true, { erreur: { type: 'arrete' } }, 1],
        'D-G13 : arreter() ne se résout qu’après le téléchargement lancé par une tape ; après l’arrêt, telecharger rend { erreur: arrete } sans appel (mutant : vol non tenu → arreter() rendu avant l’écriture)');
      eq([await m.actualiserEspace(), await m.telechargerTout(), await m.reessayerFichier(H('7'))], [{ erreur: { type: 'arrete' } }, { erreur: { type: 'arrete' } }, { erreur: { type: 'arrete' } }], 'D-G13 : après l’arrêt, actualiserEspace, telechargerTout et reessayerFichier ne font rien');
    });
  });

  await run('moteur : une lecture de files par passe (S-12)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'snap');
      const m = moteurDe(db, { stockage: creerStockageFactice(), reduire: reducteur().reduire });
      const lectures = []; const vrai = db.getSnapshot;
      db.getSnapshot = function (noms) { lectures.push(noms); return vrai.call(this, noms); };
      try { await m.executer('t'); } finally { delete db.getSnapshot; }
      eq(lectures.filter((n) => (n || []).includes('files')).length, 1, 'S-12 : UNE lecture de files par passe, réutilisée par envoyer, telechargerTout et le compte final (mutant : compter relit)');
      await m.arreter();
    });
  });

  await run('moteur : gestes des fichiers (réessayer, télécharger tout, espace, dernier échange)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'copie-reessai');
      await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + H('7'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie } });
      const m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire });
      const r = await m.reessayerFichier(H('7'));
      eq([r.recus, await db.get('sync_state', 'file_error:' + H('7')), (await db.get('files', H('7'))).blob instanceof Blob, !!m.etat().dernierEchange], [1, undefined, true, true], 'reessayerFichier (réception) : la clé retirée, puis le téléchargement ; un téléchargement abouti compte pour « Dernier échange » (I5 ; mutant : stockage hors du compteur)');
      const s = await poserPhoto(repo, db, 'reessai-envoi');
      await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + s, value: { motif: 'type', sens: 'envoi', at: DATE } }] }, origin: 'device' });
      await m.reessayerFichier(s);
      eq([await db.get('sync_state', 'file_error:' + s), !!(await db.get('files', s)).remote], [undefined, true], 'reessayerFichier (envoi) : la clé retirée, puis une passe — la photo part');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const objets = {}; const pages = [];
      for (let i = 0; i < 3; i += 1) {
        const { copie, chemin } = await ligneDistanteDe(db, 'tout-' + i, H(String(i + 1)));
        objets[chemin] = copie; pages.push({ id: 'pt' + i, sha256: H(String(i + 1)), updated_at: DATE });
      }
      await db.mutate({ puts: { source_pages: pages }, origin: 'device' });
      let m = null;
      const sf = creerStockageFactice({ objets, avant: async (methode) => { if (methode === 'recevoir' && sf.journal.filter((j) => j.methode === 'recevoir').length === 1) await m.arreterTelechargement(); } });
      m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire });
      await m.telechargerTout();
      eq([sf.journal.filter((j) => j.methode === 'recevoir').length, await db.get('sync_state', 'telecharger_tout'), m.etat().telechargementGlobal], [1, undefined, false], 'telechargerTout puis « Arrêter le téléchargement » pendant : arrêt au fichier suivant, clé retirée');
      await m.telechargerTout();
      eq([sf.journal.filter((j) => j.methode === 'recevoir').length, (await Promise.all([H('1'), H('2'), H('3')].map((k) => db.get('files', k)))).every((l) => l.blob instanceof Blob), await db.get('sync_state', 'telecharger_tout'), m.etat().derniersEffets.fichiersRecus], [3, true, undefined, 2], 'telechargerTout : la reprise télécharge le reste, la clé tombe quand plus rien ne manque ; derniersEffets.fichiersRecus compte les pages arrivées');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      const sf = creerStockageFactice({ objets: { ['u1/' + H('a')]: octets('abc') } });
      const m = moteurDe(db, { stockage: sf });
      const vues = []; const vrai = db.mutate;
      db.mutate = function (a) { vues.push(a); return vrai.call(this, a); };
      try { await m.actualiserEspace(); } finally { delete db.mutate; }
      eq([m.etat().espaceServeur?.octets, (await db.get('sync_state', 'storage_usage'))?.value?.objets, vues.find((v) => (v.puts?.sync_state || []).some((l) => l.key === 'storage_usage'))?.origin], [3, 1, 'device'], 'actualiserEspace : storage_usage écrit (origine device), espaceServeur posé');
      const m2 = moteurDe(db, { stockage: { ...sf, lister: async () => ({ objets: [], erreur: { type: 'reseau', status: 0, statusCode: null, code: null, message: 'x' } }) } });
      await sansConsole(() => m2.actualiserEspace());
      eq((await db.get('sync_state', 'storage_usage'))?.value?.objets, 1, 'actualiserEspace : une erreur reseau laisse storage_usage inchangé');
      await m.arreter(); await m2.arreter();
    });
  });

  await run('rendu après une passe et câblage de app.js', async () => {
    const S = await import('../src/ui/state.js');
    const effets = (fichiersRecus) => ({ enCours: false, derniersEffets: { recues: 0, supprimees: 0, ajustes: 0, conflits: 0, fichiersRecus } });
    eq([S.passeAEcrit({ avant: true, etat: effets(2) }), S.passeAEcrit({ avant: true, etat: effets(0) })], [true, false], 'passeAEcrit : une page arrivée redessine la fiche affichée (fichiersRecus)');
    const app = await lire('../src/app.js');
    ok(app.length > 1000 && /stockage: createStockage\(client\)/.test(app) && /qualite: qualiteEnvoi/.test(app), 'app.js (lu au source, admis : jamais importé) : le moteur reçoit stockage: createStockage(client) et qualite: qualiteEnvoi');
  });

  // Hors brief, à ratifier (spec § 4.8 « Arrêt » : « telechargerTout par tape » entre dans `vols` ; D-G13 : « rien n'est écrit après ») : un geste
  // lancé juste AVANT arreter() — une tape suivie de « Effacer les données de cet appareil » — ne lance ni passe, ni appel, ni écriture APRÈS
  // l'arrêt, et arreter() attend l'écriture que le geste avait déjà lancée. Sur le bloc du brief, telechargerTout, renvoyerEnOriginale et
  // reessayerFichier lançaient une passe derrière l'arrêt (la classe de défaut que B-9 a fermée pour telecharger).
  await run('moteur : un geste lancé juste avant l’arrêt ne lance rien après lui (D-G13, § 4.8, hors brief)', async () => {
    const scenario = async (preparer, geste, cleApres) => {
      let sortie = null;
      await withRepo(async (repo, db) => {
        await toutDejaEnvoye(db);
        const { copie, chemin } = await ligneDistanteDe(db, 'copie-arret');
        await db.mutate({ puts: { source_pages: [{ id: 'pg-arret', sha256: H('7'), updated_at: DATE }] }, origin: 'device' });
        await preparer(db);
        const tf = creerTransportFactice({ lire: {} });
        const sf = creerStockageFactice({ objets: { [chemin]: copie } });
        const m = moteurDe(db, { transport: tf, stockage: sf });
        let ecrites = 0; const vrai = db.mutate; // écritures ABOUTIES, comptées dans l'ordre où elles finissent
        db.mutate = function (a) { const p = vrai.call(this, a); p.then(() => { ecrites += 1; }, () => {}); return p; };
        let aLArret = null; let r = null;
        try {
          const lance = geste(m); // pas attendu : l'arrêt arrive pendant sa première attente
          await m.arreter();
          aLArret = [tf.journal.length, sf.journal.length, ecrites];
          r = await lance;
          await new Promise((res) => setTimeout(res, 30));
        } finally { delete db.mutate; }
        sortie = [aLArret, [tf.journal.length, sf.journal.length, ecrites], !!(await db.get('sync_state', cleApres)), (await db.get('files', H('7'))).blob instanceof Blob, r?.erreur?.type ?? null];
      });
      return sortie;
    };
    const rien = async () => {};
    eq(await scenario(rien, (m) => m.telechargerTout(), 'telecharger_tout'), [[0, 0, 1], [0, 0, 1], true, false, 'arrete'],
      'telechargerTout puis arrêt : arreter() attend l’écriture de la clé, aucune passe ensuite (aucun appel, aucune écriture, aucune page reçue), réponse arrete (mutants : geste hors de vols ; arrete non relu avant executer)');
    eq(await scenario(rien, (m) => m.renvoyerEnOriginale(), 'renvoi_originale'), [[0, 0, 1], [0, 0, 1], true, false, 'arrete'],
      'renvoyerEnOriginale puis arrêt : arreter() attend l’écriture de la clé, aucune passe ensuite, réponse arrete');
    const erreurEnvoi = (db) => db.mutate({ puts: { sync_state: [{ key: 'file_error:' + H('9'), value: { motif: 'type', sens: 'envoi', at: DATE } }] }, origin: 'device' });
    eq(await scenario(erreurEnvoi, (m) => m.reessayerFichier(H('9')), 'file_error:' + H('9')), [[0, 0, 0], [0, 0, 0], true, false, 'arrete'],
      'reessayerFichier (envoi) puis arrêt : rien n’est écrit après l’arrêt (la clé reste), aucune passe, réponse arrete');
    const global = (db) => db.mutate({ puts: { sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
    eq(await scenario(global, (m) => m.arreterTelechargement(), 'telecharger_tout'), [[0, 0, 1], [0, 0, 1], false, false, 'arrete'],
      'arreterTelechargement puis arrêt : arreter() attend le retrait de la clé (geste tenu), réponse arrete');
  });

  // Épingles hors brief : des chemins du moteur que les tests du brief n'exercent pas (mutants survivants sur une copie, voir le rapport de la
  // tâche 4). Elles affirment un comportement déjà juste ; chacune nomme le mutant qu'elle tue.
  await run('moteur (épingle) : arreter() attend la mesure d’espace en vol (D-G13, Review Focus 5)', async () => {
    await withRepo(async (repo, db) => {
      let lacher = null; const tenu = new Promise((r) => { lacher = r; });
      const sf = creerStockageFactice({ objets: { ['u1/' + H('a')]: octets('abc') }, avant: async (methode) => { if (methode === 'lister') await tenu; } });
      const m = moteurDe(db, { stockage: sf });
      const mesure = m.actualiserEspace();
      await new Promise((r) => setTimeout(r, 0));
      let arretFini = false;
      const arret = m.arreter().then(() => { arretFini = true; });
      await new Promise((r) => setTimeout(r, 20));
      const avantLacher = arretFini;
      lacher();
      await arret;
      eq([avantLacher, await mesure, await db.get('sync_state', 'storage_usage'), m.etat().espaceServeur, sf.journal.filter((j) => j.methode === 'lister').length], [false, { erreur: { type: 'arrete' } }, undefined, null, 1],
        'D-G13 (épingle) : arreter() ne se résout qu’après la mesure en vol ; revenue après l’arrêt, elle n’écrit rien (storage_usage absent, espaceServeur nul) et rend arrete (mutants : actualiserEspace hors de vols ; appliquerEspace sans garde d’arrêt)');
    });
  });

  await run('moteur (épingle) : charger() pose les clés L4 connues avant tout appel (§ 3.6)', async () => {
    await withRepo(async (repo, db) => {
      await poserPhoto(repo, db, 'charger');
      const usage = { octets: 7, objets: 2, at: DATE, tronque: false };
      await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }, { key: 'storage_usage', value: usage }, { key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice();
      const m = moteurDe(db, { getUserId: () => null, stockage: sf }); // sans compte : la passe du démarrage ne touche à rien de L4
      const e = await m.demarrer();
      eq([e.pauseFichiers, e.espaceServeur, e.telechargementGlobal, e.fichiers.aEnvoyer, Object.isFrozen(e.fichiers), sf.journal.length], [{ raison: 'stockage', at: DATE }, usage, true, 1, true, 0],
        '§ 3.6 (épingle) : charger() lit pause_fichiers, storage_usage et telecharger_tout, et compte les fichiers, sans aucun appel au seau (mutant : charger ne pose pas les clés L4)');
      await m.arreter();
    });
  });

  // Ronde 1 : delaiRegroupementMs à 50 s — sans lui, la minuterie de planifier() (2 s par défaut) valait celle du recul de 2 s, et un mutant
  // « programmerReprise(recul) remplacé par planifier() » restait vert.
  await run('moteur (épingle) : effets d’un envoi de fichiers arrêté — auth, réseau, quota (§ 4.7)', async () => {
    const panne = (type, status) => ({ methode: 'envoyer', erreur: { type, status, statusCode: String(status), code: null, message: 'x' } });
    const passeEnPanne = async (type, status) => {
      let sortie = null;
      await withRepo(async (repo, db) => {
        await toutDejaEnvoye(db);
        await poserPhoto(repo, db, 'effet-' + type);
        const minuteries = []; const vrai = globalThis.setTimeout;
        globalThis.setTimeout = (fn, ms, ...reste) => { minuteries.push(ms); return vrai(fn, ms, ...reste); };
        let m = null; let fin = null;
        try { m = moteurDe(db, { stockage: creerStockageFactice({ pannes: [panne(type, status)] }), reduire: reducteur().reduire, delaiRegroupementMs: 50000 }); fin = await sansConsole(() => m.executer('t')); } // réseau : un logError est attendu, gardé hors de la console
        finally { globalThis.setTimeout = vrai; }
        sortie = [fin.attenteConnexion, fin.derniereErreur?.type ?? null, fin.pauseFichiers?.raison ?? null, minuteries.includes(2000), minuteries.includes(1000)];
        await m.arreter();
      });
      return sortie;
    };
    eq(await passeEnPanne('auth', 401), [true, 'auth', null, false, false], 'fichiers (épingle) : auth → attenteConnexion et derniereErreur auth, aucune reprise (mutants : attenteConnexion des fichiers non dite ; erreur non dite)');
    eq(await passeEnPanne('reseau', 503), [false, 'reseau', null, true, false], 'fichiers (épingle) : réseau → derniereErreur reseau et reprise au recul de 2 s, jamais à 1 s (mutants : recul ignoré ; erreur non dite)');
    eq(await passeEnPanne('quota', 413), [false, null, 'stockage', false, false], 'fichiers (épingle) : quota → pauseFichiers relue dans l’état, aucune erreur dite, aucune reprise (mutant : pause_fichiers relue après la passe ignorée)');
  });

  await run('moteur (épingle) : page cachée, aucune reprise à 1 s (§ 4.7)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 21; i += 1) await poserPhoto(repo, db, 'cachee' + i);
      const minuteries = []; const vrai = globalThis.setTimeout;
      globalThis.setTimeout = (fn, ms, ...reste) => { minuteries.push(ms); return vrai(fn, ms, ...reste); };
      let m = null;
      try { m = moteurDe(db, { fenetre: { ...fenetreMuette(), document: { visibilityState: 'hidden' } }, stockage: creerStockageFactice(), reduire: reducteur().reduire, delaiRegroupementMs: 50000 }); await m.executer('t'); }
      finally { globalThis.setTimeout = vrai; }
      ok(!minuteries.includes(1000), 'moteur (épingle) : restants > 0 mais page cachée → aucune reprise à 1 s (mutant : visibilité ignorée)');
      await m.arreter();
    });
  });

  await run('moteur (épingle) : une tape recompte les fichiers ; l’espace se mesure quand storage_usage manque', async () => {
    await withRepo(async (repo, db) => {
      const a = await ligneDistanteDe(db, 'recompte-1', H('1'));
      const b = await ligneDistanteDe(db, 'recompte-2', H('2'));
      await db.mutate({ puts: { source_pages: [{ id: 'rc1', sha256: H('1'), updated_at: DATE }, { id: 'rc2', sha256: H('2'), updated_at: DATE }] }, origin: 'device' });
      const m = moteurDe(db, { stockage: creerStockageFactice({ objets: { [a.chemin]: a.copie, [b.chemin]: b.copie } }) });
      await m.telecharger([H('1')]);
      const e = m.etat();
      eq([e.fichiers.aTelecharger, e.fichiers.octetsATelecharger, Object.isFrozen(e.fichiers)], [1, b.copie.size, true], 'tape (épingle) : après un téléchargement par tape, les compteurs sont recomptés et figés — une page reste à télécharger (mutants : recompte retiré ; fichiers non figé)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const sf = creerStockageFactice({ objets: { ['u1/' + H('a')]: octets('abcd') } });
      const m = moteurDe(db, { stockage: sf });
      const listes = () => sf.journal.filter((j) => j.methode === 'lister').length;
      const f1 = await m.executer('t');
      const apres1 = listes();
      await m.executer('t');
      eq([apres1, f1.espaceServeur?.octets, f1.espaceServeur?.objets, Object.isFrozen(f1.espaceServeur), Object.isFrozen(f1.fichiers), listes()], [1, 4, 1, true, true, 1],
        'moteur (épingle) : storage_usage absent → mesuré à la passe même sans confirmation ; présent → pas remesuré ; espaceServeur et fichiers figés (mutants : mesure seulement après une confirmation ; mesure à chaque passe ; fichiers non figé)');
      await m.arreter();
    });
  });

  // Remplaçant renforcé de l'assertion du brief (« rendu après une passe et câblage de app.js », qui reste : le brief l'exige). Ronde 1 : les
  // commentaires de bloc sont retirés aussi, et les deux expressions sont ancrées — `qualite: qualiteEnvoi()` (une chaîne passée au moteur :
  // chaque envoi lèverait) ne passe plus.
  await run('app.js (épingle) : câblage lu sans commentaires', async () => {
    const app = (await lire('../src/app.js')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    ok(/stockage: createStockage\(client\)\s*[,}\n]/.test(app) && /qualite: qualiteEnvoi\s*[,}\n]/.test(app), 'app.js (épingle, source admis) : les deux options restent hors de tout commentaire (// et /* */), la fonction qualiteEnvoi passée sans être appelée (mutants : stockage commenté ; qualite: qualiteEnvoi() — X29)');
  });

  // === Tâche 4, ronde 1 — constats de la revue adverse (spec, sécurité, faux-vert). Chaque assertion nomme le constat et le mutant qu'elle tue.
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const tenue = () => { let lacher = null; const p = new Promise((r) => { lacher = r; }); return { p, lacher: () => lacher() }; };
  const jusqua = async (cond) => { for (let i = 0; i < 300 && !(await cond()); i += 1) await attendre(10); return cond(); };
  const compteDe = (sf, methode) => sf.journal.filter((j) => j.methode === methode).length;
  // Les délais passés à setTimeout pendant `fn` (remis en finally) ; `attendre` n'y est jamais appelé.
  const espionMinuteries = async (fn) => {
    const ms = []; const vrai = globalThis.setTimeout;
    globalThis.setTimeout = (f, d, ...reste) => { ms.push(d); return vrai(f, d, ...reste); };
    try { await fn(); } finally { globalThis.setTimeout = vrai; }
    return ms;
  };
  // Les codes journalisés pendant `fn` (console.error remise en finally) : logError écrit « [cuisine-os] <code> ».
  const codesJournal = async (fn) => {
    const codes = []; const vrai = console.error;
    console.error = (premier) => codes.push(String(premier).replace('[cuisine-os] ', ''));
    let r = null;
    try { r = await fn(); } finally { console.error = vrai; }
    return { r, codes };
  };
  const ARR = { erreur: { type: 'arrete' } };
  const enPanne = { pousser: async () => ({ reponse: null, erreur: reseau() }), lire: async () => ({ lignes: null, erreur: reseau() }) };
  const pagesDe = (cles) => cles.map((sha256, i) => ({ id: 'pg-r1-' + sha256.slice(0, 8) + i, sha256, updated_at: DATE }));

  await run('ronde 1 — une tape terminée pendant la passe compte dans le compte final (spec I5, sonde P2)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const a = await ligneDistanteDe(db, 'course-1', H('1'));
      const b = await ligneDistanteDe(db, 'course-2', H('2'));
      await db.mutate({ puts: { source_pages: pagesDe([H('1'), H('2')]) }, origin: 'device' });
      await poserPhoto(repo, db, 'course-envoi');
      let m = null; let tape = null;
      const sf = creerStockageFactice({ objets: { [a.chemin]: a.copie, [b.chemin]: b.copie }, avant: async (methode) => { if (methode === 'envoyer' && !tape) { tape = m.telecharger([H('1')]); await tape; } } });
      m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const fin = await m.executer('t');
      eq([(await tape).recus, (await db.get('files', H('1'))).blob instanceof Blob, fin.fichiers.aTelecharger, m.etat().fichiers.aTelecharger, fin.fichiers.aEnvoyer], [1, true, 1, 1, 0],
        'I5 (ronde 1, sonde P2) : une page reçue par une tape PENDANT la passe n’est plus recomptée « à télécharger » par le compte final — le snapshot de la passe, périmé pour elle, cède à une relecture (mutant : compte final sur le seul snapshot)');
      await m.arreter();
    });
  });

  await run('ronde 1 — après l’arrêt, aucune API ne fait d’appel ni d’écriture (D-G13 ; MA, MB, X13 à X16)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'apres-arret');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [
        { key: 'file_error:' + H('9'), value: { motif: 'type', sens: 'envoi', at: DATE } },
        { key: 'file_error:' + H('8'), value: { motif: 'introuvable', sens: 'reception', at: DATE } },
        { key: 'telecharger_tout', value: { at: DATE } }, { key: 'pause', value: { raison: 'quota', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: {} }); const sf = creerStockageFactice({ objets: { [chemin]: copie } });
      const m = moteurDe(db, { transport: tf, stockage: sf });
      await m.arreter();
      let ecritures = 0; const vrai = db.mutate;
      db.mutate = function (a) { ecritures += 1; return vrai.call(this, a); };
      try {
        const reponses = [await m.telecharger([H('7')]), await m.telechargerTout(), await m.arreterTelechargement(), await m.actualiserEspace(), await m.renvoyerEnOriginale(), await m.reessayerFichier(H('9')), await m.reessayerFichier(H('8'))];
        eq([reponses, ecritures, tf.journal.length, sf.journal.length, (await db.get('sync_state', 'telecharger_tout'))?.value?.at, !!(await db.get('sync_state', 'file_error:' + H('9'))), !!(await db.get('sync_state', 'file_error:' + H('8'))), await db.get('sync_state', 'renvoi_originale')],
          [[ARR, ARR, ARR, ARR, ARR, ARR, ARR], 0, 0, 0, DATE, true, true, undefined],
          'D-G13 (ronde 1) : après l’arrêt, telecharger, telechargerTout, arreterTelechargement, actualiserEspace, renvoyerEnOriginale et reessayerFichier rendent arrete sans aucun db.mutate ni appel (mutants : garde de tête retirée d’un geste)');
        ecritures = 0;
        const r = await m.envoyerMaintenant();
        eq([r, ecritures, tf.journal.length, (await db.get('sync_state', 'pause'))?.value?.raison], [ARR, 0, 0, 'quota'],
          'D-G13 (ronde 1, envoyerMaintenant) : après l’arrêt, « Envoyer maintenant » ne lève aucune pause et ne lance aucune passe (mutant : geste hors des gardes)');
      } finally { delete db.mutate; }
    });
  });

  await run('ronde 1 — un geste lancé juste avant l’arrêt : envoyerMaintenant tenu comme les autres (D-G13)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'bE', title: 'E' });
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: DATE } }, { key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }] }, origin: 'device' });
      const tf = creerTransportFactice({ lire: {} }); const sf = creerStockageFactice();
      const m = moteurDe(db, { transport: tf, stockage: sf });
      let ecrites = 0; const vrai = db.mutate;
      db.mutate = function (a) { const p = vrai.call(this, a); p.then(() => { ecrites += 1; }, () => {}); return p; };
      let aLArret = null; let r = null;
      try {
        const lance = m.envoyerMaintenant();
        let regle = false; lance.then(() => { regle = true; });
        await m.arreter();
        aLArret = [tf.journal.length, sf.journal.length, ecrites, regle];
        r = await lance;
        await attendre(30);
      } finally { delete db.mutate; }
      eq([aLArret, [tf.journal.length, sf.journal.length, ecrites], !!(await db.get('sync_state', 'pause')), !!(await db.get('sync_state', 'pause_fichiers')), r?.erreur?.type ?? null], [[0, 0, 0, true], [0, 0, 0], true, true, 'arrete'],
        'D-G13 (ronde 1) : « Envoyer maintenant » touché juste avant « Effacer les données » est attendu par arreter() (déjà réglé quand l’arrêt rend la main), ne retire aucune pause et ne lance aucune passe après l’arrêt ; réponse arrete (mutants EM1 : geste hors de vols ; EM2 : arrete non relu)');
    });
  });

  await run('ronde 1 — l’arrêt pendant une passe ou une tape : rien de plus ensuite (MN, MO, X02, X11, X12, X30)', async () => {
    // Arrêt pendant l'envoi d'un fichier : ni mesure d'espace, ni téléchargement global, ni écriture d'espace ensuite.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 2; i += 1) await poserPhoto(repo, db, 'arret-mesure' + i);
      const { copie, chemin } = await ligneDistanteDe(db, 'arret-global');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      let m = null;
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, avant: async (methode) => { if (methode === 'envoyer') m.arreter(); } });
      m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      await m.executer('t');
      eq([compteDe(sf, 'envoyer'), compteDe(sf, 'lister'), compteDe(sf, 'recevoir'), await db.get('sync_state', 'storage_usage')], [1, 0, 0, undefined],
        'D-G13 (ronde 1) : arrêt pendant l’envoi → aucun lister (mesure d’espace) ni recevoir (téléchargement global) ensuite, storage_usage jamais écrit (mutant MN : mesure lancée après l’arrêt)');
    });
    // Arrêt pendant l'envoi des FICHES : la phase fichiers n'est pas même ouverte.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'arret-fiches');
      await repo.save('books', { id: 'bA', title: 'A' });
      const tf = creerTransportFactice({ serveur: true }); const sf = creerStockageFactice();
      let m = null;
      const transport = { pousser: async (rows) => { m.arreter(); return tf.pousser(rows); }, lire: (t, apres, limite) => tf.lire(t, apres, limite) };
      m = moteurDe(db, { transport, stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const phases = []; m.onEtat((e) => phases.push(e.phase));
      await m.executer('t');
      eq([tf.journal.some((j) => j.appel === 'pousser'), sf.journal.length, phases.includes('fichiers')], [true, 0, false],
        'D-G13 (ronde 1) : arrêt pendant l’envoi des fiches → la phase fichiers n’est pas ouverte, aucun appel au seau (mutant X02 : garde d’arrêt de la phase retirée)');
    });
    // Une tape de deux empreintes arrêtée pendant la première : la seconde ne part pas ; « Dernier échange » n'est pas écrit derrière l'arrêt.
    await withRepo(async (repo, db) => {
      const a = await ligneDistanteDe(db, 'deux-1', H('1'));
      const b = await ligneDistanteDe(db, 'deux-2', H('2'));
      const t1 = tenue();
      const sf = creerStockageFactice({ objets: { [a.chemin]: a.copie, [b.chemin]: b.copie }, avant: async (methode) => { if (methode === 'recevoir' && compteDe(sf, 'recevoir') === 1) await t1.p; } });
      const m = moteurDe(db, { stockage: sf });
      const tape = m.telecharger([H('1'), H('2')]);
      await jusqua(() => compteDe(sf, 'recevoir') === 1);
      const arret = m.arreter();
      t1.lacher();
      await arret;
      eq([compteDe(sf, 'recevoir'), (await tape).recus, (await db.get('files', H('2'))).blob instanceof Blob, await db.get('sync_state', 'last_exchange_at'), m.etat().dernierEchange], [1, 1, false, undefined, null],
        'D-G13 (ronde 1) : une tape de deux pages arrêtée pendant la première ne télécharge pas la seconde, et n’écrit pas « Dernier échange » après l’arrêt (mutants MO/X11 : tape sans stop ; X12 : tape sans garde d’arrêt)');
    });
    // arreter() attend la PASSE en vol (Review Focus 5) : retenue dans la réception, elle tient l'arrêt jusqu'à sa fin.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const t1 = tenue(); let lus = 0;
      const tf = creerTransportFactice({ lire: {} });
      const transport = { pousser: (rows) => tf.pousser(rows), lire: async (t, apres, limite) => { lus += 1; await t1.p; return tf.lire(t, apres, limite); } };
      const m = moteurDe(db, { transport, stockage: creerStockageFactice() });
      const passe = m.executer('t');
      await jusqua(() => lus > 0);
      let arretFini = false;
      const arret = m.arreter().then(() => { arretFini = true; });
      await attendre(20);
      const avantLacher = arretFini;
      t1.lacher();
      await arret; await passe;
      eq([avantLacher, arretFini], [false, true], 'D-G13 (ronde 1, Review Focus 5) : arreter() ne se résout qu’après la passe en vol (mutant X30 : la passe retirée de Promise.allSettled)');
    });
  });

  await run('ronde 1 — « Dernier échange » seulement sur un appel abouti du seau (I5 ; ME, MF, MI, X07 à X10)', async () => {
    // Pause L3 et lecture en panne : seul l'envoi au seau aboutit (la mesure d'espace échoue) → il date l'échange.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'i5-envoi');
      await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ pannes: [{ methode: 'lister', erreur: reseau() }] });
      const m = moteurDe(db, { transport: enPanne, stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const fin = await sansConsole(() => m.executer('t'));
      eq([compteDe(sf, 'envoyer'), compteDe(sf, 'lister'), !!fin.dernierEchange, !!(await db.get('sync_state', 'last_exchange_at'))], [1, 1, true, true],
        'I5 (ronde 1) : un envoi au seau abouti date « Dernier échange » même quand tout le reste échoue (mutant ME/X07 : envoyer hors du compteur)');
      await m.arreter();
    });
    // Rien à envoyer, lecture en panne : seule la mesure d'espace aboutit → elle date l'échange.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const sf = creerStockageFactice({ objets: { ['u1/' + H('a')]: octets('abc') } });
      const m = moteurDe(db, { transport: enPanne, stockage: sf, delaiRegroupementMs: 50000 });
      const fin = await sansConsole(() => m.executer('t'));
      eq([compteDe(sf, 'lister'), !!fin.dernierEchange], [1, true], 'I5 (ronde 1) : une mesure d’espace aboutie date « Dernier échange » (mutant MF/X08 : lister hors du compteur)');
      await m.arreter();
    });
    // Une tape sans appel abouti : réception en panne, puis une ligne d'un autre compte (aucun appel) — « Dernier échange » reste nul.
    await withRepo(async (repo, db) => {
      const { copie, chemin } = await ligneDistanteDe(db, 'i5-tape');
      await db.mutate({ puts: { files: [{ sha256: H('6'), mime: 'image/jpeg', size: 9, updated_at: DATE, remote: R({ owner: 'u2' }) }] }, origin: 'remote' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, pannes: [{ methode: 'recevoir', erreur: { ...reseau(), code: 'ECONNRESET', message: 'texte-du-fournisseur' } }] });
      const m = moteurDe(db, { stockage: sf });
      const r = await sansConsole(() => m.telecharger([H('7')]));
      await m.telecharger([H('6')]);
      eq([compteDe(sf, 'recevoir'), m.etat().dernierEchange, await db.get('sync_state', 'last_exchange_at')], [1, null, undefined],
        'I5 (ronde 1) : une tape dont la réception échoue, puis une tape sans appel (autre compte), ne datent aucun échange (mutants X09 : échec compté ; MI/X10 : toucherEchange sans condition)');
      eq(r.erreur, { type: 'reseau', status: 0 }, 'ronde 1 (sécurité) : l’erreur rendue par une tape est réduite à { type, status } — ni code ni texte du fournisseur (mutant : erreur brute)');
      await m.arreter();
    });
  });

  await run('ronde 1 — une levée dans la phase fichiers ne coûte rien à L3 (sécurité)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'leve');
      await repo.save('books', { id: 'bL', title: 'L' });
      await db.mutate({ puts: { sync_conflicts: [{ id: 'c-vieux', store: 'books', key: 'x', at: '2020-01-01T00:00:00.000Z' }] }, origin: 'remote' });
      const tf = creerTransportFactice({ serveur: true });
      const casse = { ...creerStockageFactice(), envoyer: async () => { throw new TypeError('stockage cassé'); } };
      const m = moteurDe(db, { transport: tf, stockage: casse, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const { r: fin, codes } = await codesJournal(() => m.executer('t'));
      eq([!!(await db.get('sync_state', 'last_exchange_at')), await db.get('sync_conflicts', 'c-vieux'), fin.derniereErreur, fin.progressionFichiers, codes.includes('sync.fichiers'), codes.includes('sync.passe')],
        [true, undefined, null, null, true, false],
        'ronde 1 (sécurité) : une levée dans la phase fichiers est journalisée (sync.fichiers) ; « Dernier échange » et la purge des conflits de 30 jours ont lieu, aucune « erreur inconnue » n’est dite (mutant : un seul try pour L3 et les fichiers)');
      await m.arreter();
    });
  });

  await run('ronde 1 — envoi : un original illisible ici est marqué une fois et ne bloque plus ceux qui le suivent (REVUE B)', async () => {
    const vieuxDabord = async (db, sha256) => db.mutate({ puts: { files: [{ ...(await db.get('files', sha256)), created_at: '2020-01-01T00:00:00.000Z' }] }, origin: 'device' });
    // (a) l'empreinte des octets lève (hacher).
    await withRepo(async (repo, db) => {
      const vieux = await poserPhoto(repo, db, 'illisible-a', { taille: 80 });
      const neuf = await poserPhoto(repo, db, 'lisible-a');
      await vieuxDabord(db, vieux);
      const sf = creerStockageFactice();
      const hacher = async (b) => { if (b.size === 80) throw new DOMException('illisible', 'NotReadableError'); return sha256Hex(b); };
      const bilan = await sansConsole(async () => passe(db, sf, { qualite: () => 'originale', hacher }).envoyer({ snapshot: await snapshot(db) }));
      eq([bilan.confirmes, bilan.erreurs, (await db.get('sync_state', 'file_error:' + vieux))?.value?.motif, (await db.get('sync_state', 'file_error:' + vieux))?.value?.sens, !!(await db.get('files', neuf)).remote, envois(sf).length],
        [1, 1, 'illisible', 'envoi', true, 1], 'REVUE B (a) : une empreinte qui lève sur l’original le marque illisible (envoi) et la photo suivante part (mutant : levée par fichier non attrapée)');
    });
    // (b) la lecture de l'en-tête lève (dimensionsImage : arrayBuffer rejeté, comme un blob IndexedDB illisible sous WebKit), sur deux passes.
    await withRepo(async (repo, db) => {
      const vieux = await poserPhoto(repo, db, 'illisible-b', { taille: 80 });
      const neuf = await poserPhoto(repo, db, 'lisible-b');
      await vieuxDabord(db, vieux);
      const sf = creerStockageFactice();
      const p = passe(db, sf, { reduire: reducteur().reduire });
      const vrai = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function () { return this.size === 80 ? Promise.reject(new DOMException('illisible', 'NotReadableError')) : vrai.call(this); };
      let b1 = null; let b2 = null;
      try {
        b1 = await sansConsole(async () => p.envoyer({ snapshot: await snapshot(db) }));
        b2 = await sansConsole(async () => p.envoyer({ snapshot: await snapshot(db) }));
      } finally { Blob.prototype.arrayBuffer = vrai; }
      eq([b1.confirmes, b1.erreurs, (await db.get('sync_state', 'file_error:' + vieux))?.value?.motif, !!(await db.get('files', neuf)).remote, b2.confirmes, b2.erreurs, envois(sf).length],
        [1, 1, 'illisible', true, 0, 0, 1], 'REVUE B (b) : un en-tête illisible marque l’original une fois ; la photo suivante part ; la passe suivante ne retente rien (mutant : la ligne fautive reste première candidate)');
    });
  });

  await run('ronde 1 — « Arrêter le téléchargement » pendant la lecture de la clé ; aucune reprise derrière l’arrêt (REVUE A, P1)', async () => {
    const troisDistantes = async (db, prefixe) => {
      const objets = {}; const cles = [];
      for (let i = 0; i < 3; i += 1) { const cle = H(String(i + 1)); const { copie, chemin } = await ligneDistanteDe(db, prefixe + i, cle); objets[chemin] = copie; cles.push(cle); }
      await db.mutate({ puts: { source_pages: pagesDe(cles) }, origin: 'device' });
      return objets;
    };
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const objets = await troisDistantes(db, 'revue-a-');
      await db.mutate({ puts: { sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets });
      const m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 });
      let touche = false; let fin = null; const vrai = db.get;
      // La lecture est DEMANDÉE avant le geste (sa transaction précède la suppression de la clé), puis « Arrêter » est touché pendant qu'elle court.
      db.get = function (store, cle) { const p = vrai.call(this, store, cle); if (!touche && store === 'sync_state' && cle === 'telecharger_tout') { touche = true; m.arreterTelechargement(); } return p; };
      const minuteries = await espionMinuteries(async () => { try { fin = await m.executer('t'); } finally { delete db.get; } });
      eq([touche, compteDe(sf, 'recevoir'), fin.telechargementGlobal], [true, 0, false], 'REVUE A (ronde 1) : « Arrêter le téléchargement » touché pendant la lecture de la clé arrête la passe — la génération est lue AVANT l’attente (mutant : génération lue après)');
      ok(!minuteries.includes(1000), 'P1 (ronde 1) : un téléchargement arrêté par la personne ne programme aucune reprise à 1 s (mutant : restants comptés malgré la génération changée)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const objets = await troisDistantes(db, 'sonde-p1-');
      let m = null;
      const sf = creerStockageFactice({ objets, avant: async (methode) => { if (methode === 'recevoir' && compteDe(sf, 'recevoir') === 1) await m.arreterTelechargement(); } });
      m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 });
      const minuteries = await espionMinuteries(() => m.telechargerTout());
      eq([compteDe(sf, 'recevoir'), minuteries.includes(1000)], [1, false], 'P1 (ronde 1, sonde) : telechargerTout puis « Arrêter » au premier recevoir → aucune passe relancée à 1 s (mutant MH : restants du téléchargement comptés)');
      await m.arreter();
    });
  });

  await run('ronde 1 — envoi des fiches bloqué : la phase fichiers ne touche pas au seau (§ 4.7 ; X01, MM)', async () => {
    const bloque = async (erreur) => {
      let sortie = null;
      await withRepo(async (repo, db) => {
        await toutDejaEnvoye(db);
        await poserPhoto(repo, db, 'bloque-' + erreur.type);
        await repo.save('books', { id: 'bB', title: 'B' });
        const tf = creerTransportFactice({ pousser: [{ erreur }] }); const sf = creerStockageFactice();
        let m = null;
        const minuteries = await espionMinuteries(async () => { m = moteurDe(db, { transport: tf, stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 }); await sansConsole(() => m.executer('t')); });
        sortie = [tf.journal.some((j) => j.appel === 'pousser'), sf.journal.length, minuteries.includes(1000)];
        await m.arreter();
      });
      return sortie;
    };
    eq(await bloque({ type: 'auth', status: 401, message: '' }), [true, 0, false], '§ 4.7 (ronde 1) : envoi des fiches en auth → aucun appel au seau, aucune reprise à 1 s (mutant X01/MM : !envoiBloque retiré)');
    eq(await bloque({ type: 'reseau', status: 0, message: '' }), [true, 0, false], '§ 4.7 (ronde 1) : envoi des fiches en recul réseau → aucun appel au seau, le recul de l’envoi n’est pas remplacé par 1 s (même mutant)');
  });

  await run('ronde 1 — téléchargement global dans la passe : reprise, erreur, envoi bloqué, snapshot (§ 4.7, S-12 ; X03 à X06, MG)', async () => {
    const global = { key: 'telecharger_tout', value: { at: DATE } };
    // 21 pages distantes : 20 par passe, une reprise à 1 s pour la dernière.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const objets = {}; const cles = [];
      for (let i = 0; i < 21; i += 1) { const cle = await empreinte('cle-global-' + i); const { copie, chemin } = await ligneDistanteDe(db, 'global-' + i, cle); objets[chemin] = copie; cles.push(cle); }
      await db.mutate({ puts: { source_pages: pagesDe(cles), sync_state: [global] }, origin: 'device' });
      const sf = creerStockageFactice({ objets });
      let m = null; let fin = null;
      const minuteries = await espionMinuteries(async () => { m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 }); fin = await m.executer('t'); });
      eq([compteDe(sf, 'recevoir'), fin.derniersEffets.fichiersRecus, fin.fichiers.aTelecharger, minuteries.includes(1000), !!(await db.get('sync_state', 'telecharger_tout'))], [20, 20, 1, true, true],
        '§ 4.7 (ronde 1) : téléchargement global de 21 pages → 20 reçues, une reste comptée, reprise à 1 s, la clé reste (mutant X05 : restants du global ignorés)');
      await m.arreter();
    });
    // Réception en panne réseau : l'erreur est dite, aucune reprise à 1 s.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'global-panne');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [global] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, pannes: [{ methode: 'recevoir', erreur: reseau() }] });
      let m = null; let fin = null;
      const minuteries = await espionMinuteries(async () => { m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 }); fin = await sansConsole(() => m.executer('t')); });
      eq([compteDe(sf, 'recevoir'), fin.derniereErreur?.type ?? null, minuteries.includes(1000)], [1, 'reseau', false], '§ 4.7 (ronde 1) : téléchargement global en panne réseau → derniereErreur reseau, aucune reprise à 1 s (mutant X04 : erreur du global ignorée)');
      await m.arreter();
    });
    // Envoi au seau en auth : le téléchargement global n'est pas tenté.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'global-auth');
      const { copie, chemin } = await ligneDistanteDe(db, 'global-auth-copie');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [global] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, pannes: [{ methode: 'envoyer', erreur: { type: 'auth', status: 401, statusCode: '401', code: null, message: 'x' } }] });
      const m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const fin = await m.executer('t');
      eq([compteDe(sf, 'envoyer'), compteDe(sf, 'recevoir'), fin.attenteConnexion], [1, 0, true], '§ 4.7 (ronde 1) : envoi au seau en auth → aucun recevoir du téléchargement global (mutants X03/MG : téléchargement tenté après un envoi bloqué)');
      await m.arreter();
    });
    // S-12 avec la clé posée : une lecture de files, et le compte final voit la page reçue.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'global-snap');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [global] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie } });
      const m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 });
      const lectures = []; const vrai = db.getSnapshot;
      db.getSnapshot = function (noms) { lectures.push(noms); return vrai.call(this, noms); };
      let fin = null;
      try { fin = await m.executer('t'); } finally { delete db.getSnapshot; }
      eq([lectures.filter((n) => (n || []).includes('files')).length, compteDe(sf, 'recevoir'), fin.fichiers.aTelecharger, fin.derniersEffets.fichiersRecus], [1, 1, 0, 1],
        'S-12 (ronde 1) : avec le téléchargement global, UNE lecture de files ; le compte final voit la page reçue (mutant X06 : telechargerTout sur un autre snapshot)');
      await m.arreter();
    });
  });

  await run('ronde 1 — un geste pendant une passe déjà au-delà de sa clé attend cette passe, puis en lance une (X18 à X20)', async () => {
    // La passe est retenue dans sa mesure d'espace (storage_usage absent) : elle a déjà lu telecharger_tout, renvoi_originale et les file_error.
    // Une retenue neuve à chaque `tenir()` : une promesse déjà résolue ne retiendrait plus rien.
    const retenueALaMesure = () => {
      let t = null;
      return { avant: async (methode) => { if (methode === 'lister' && t) await t.p; }, tenir: () => { t = tenue(); }, lacher: () => { const x = t; t = null; x?.lacher(); } };
    };
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'vol-global');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]) }, origin: 'device' });
      const ret = retenueALaMesure(); ret.tenir();
      const sf = creerStockageFactice({ objets: { [chemin]: copie }, avant: ret.avant });
      const m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 });
      const enVol = m.executer('t');
      await jusqua(() => compteDe(sf, 'lister') === 1);
      const g = m.telechargerTout();
      await jusqua(async () => !!(await db.get('sync_state', 'telecharger_tout')));
      ret.lacher();
      await enVol; await g;
      eq([compteDe(sf, 'recevoir'), (await db.get('files', H('7'))).blob instanceof Blob], [1, true], 'telechargerTout (ronde 1) : touché pendant une passe qui a déjà lu la clé, il attend cette passe puis en lance une qui télécharge (mutant X18 : la passe en vol rejointe)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'vol-renvoi');
      const ret = retenueALaMesure();
      const sf = creerStockageFactice({ avant: ret.avant });
      const m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      await m.executer('t'); // la photo part réduite (aucune retenue)
      await db.mutate({ deletes: { sync_state: ['storage_usage'] }, origin: 'device' });
      ret.tenir();
      const enVol = m.executer('t');
      await jusqua(() => compteDe(sf, 'lister') === 2);
      const g = m.renvoyerEnOriginale();
      await jusqua(async () => !!(await db.get('sync_state', 'renvoi_originale')));
      ret.lacher();
      await enVol; await g;
      eq([(await db.get('files', s)).remote?.quality, envois(sf).length], ['originale', 2], 'renvoyerEnOriginale (ronde 1) : touché pendant une passe qui a déjà lu la clé, il attend cette passe puis en lance une qui renvoie l’original (mutant X19 : la passe en vol rejointe)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'vol-reessai');
      await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + s, value: { motif: 'type', sens: 'envoi', at: DATE } }] }, origin: 'device' });
      const ret = retenueALaMesure(); ret.tenir();
      const sf = creerStockageFactice({ avant: ret.avant });
      const m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const enVol = m.executer('t');
      await jusqua(() => compteDe(sf, 'lister') === 1);
      const g = m.reessayerFichier(s);
      await jusqua(async () => !(await db.get('sync_state', 'file_error:' + s)));
      ret.lacher();
      await enVol; await g;
      eq([envois(sf).length, !!(await db.get('files', s)).remote], [1, true], 'reessayerFichier (envoi, ronde 1) : touché pendant une passe qui a déjà lu les erreurs, il attend cette passe puis en lance une — la photo part (mutant X20 : la passe en vol rejointe)');
      await m.arreter();
    });
  });

  await run('ronde 1 — compte final et mesure d’espace non triviaux (X33, X34, X36)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      for (let i = 0; i < 21; i += 1) await poserPhoto(repo, db, 'compte-final' + i);
      const { copie, chemin } = await ligneDistanteDe(db, 'compte-final-copie');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [{ key: 'storage_usage', value: { octets: 1, objets: 1, at: DATE, tronque: false } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie } });
      const m = moteurDe(db, { stockage: sf, reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const fin = await m.executer('t');
      eq([fin.fichiers.aEnvoyer, fin.fichiers.aTelecharger, envois(sf).length, compteDe(sf, 'lister'), fin.espaceServeur?.objets, (await db.get('sync_state', 'storage_usage'))?.value?.objets], [1, 1, 20, 1, 21, 21],
        '§ 3.6 (ronde 1) : le compte final de la passe est celui des fichiers (une photo encore à envoyer, une page à télécharger), pas le repos ; storage_usage déjà là → l’espace est quand même remesuré après une confirmation (mutants X33/X34 : compte final au repos ou périmé ; X36 : mesure seulement sans storage_usage)');
      await m.arreter();
    });
  });

  await run('ronde 1 — progression vue pendant la phase ; pause du seau, progression et ARRETE figés (X35, X25, X26, X37)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await poserPhoto(repo, db, 'progression');
      const m = moteurDe(db, { stockage: creerStockageFactice(), reduire: reducteur().reduire, delaiRegroupementMs: 50000 });
      const vues = []; m.onEtat((e) => { if (e.progressionFichiers) vues.push(e.progressionFichiers); });
      const fin = await m.executer('t');
      eq([vues[0] ?? null, vues.length > 0 && vues.every((v) => Object.isFrozen(v)), fin.progressionFichiers], [{ sens: 'envoi', n: 1, total: 1 }, true, null],
        '§ 3.6 (ronde 1) : progressionFichiers est posée pendant la phase ({ sens, n, total }), figée, puis retirée (mutants X35 : progression muette ; X25 : non figée)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }] }, origin: 'device' });
      const m = moteurDe(db, { stockage: creerStockageFactice() });
      const fin = await m.executer('t');
      await m.arreter();
      const r = await m.telecharger([H('1')]);
      eq([fin.pauseFichiers?.raison, Object.isFrozen(fin.pauseFichiers), Object.isFrozen(r), Object.isFrozen(r.erreur)], ['stockage', true, true, true],
        '§ 3.6 (ronde 1) : pauseFichiers rendue figée ; la réponse arrete et son erreur sont figées (mutants X26, X37)');
    });
  });

  await run('ronde 1 — poses immédiates de telechargementGlobal (X21, X22)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'pose-global');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]) }, origin: 'device' });
      const m = moteurDe(db, { stockage: creerStockageFactice({ objets: { [chemin]: copie } }), delaiRegroupementMs: 50000 });
      const vus = []; m.onEtat((e) => vus.push([e.phase, e.telechargementGlobal]));
      const fin = await m.telechargerTout();
      eq([vus.find(([phase]) => phase === 'envoi_initial')?.[1] ?? null, fin.telechargementGlobal], [true, false],
        'telechargerTout (ronde 1) : « Arrêter le téléchargement » est offert dès la tape, avant la phase fichiers ; la clé retirée une fois tout reçu (mutant X21 : pose immédiate retirée)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }] }, origin: 'device' });
      const m = moteurDe(db, { getUserId: () => null, stockage: creerStockageFactice() });
      const e0 = await m.demarrer();
      const e1 = await m.arreterTelechargement();
      eq([e0.telechargementGlobal, e1.telechargementGlobal, m.etat().telechargementGlobal, await db.get('sync_state', 'telecharger_tout')], [true, false, false, undefined],
        'arreterTelechargement (ronde 1) : hors passe, l’état passe à faux aussitôt (mutant X22 : pose immédiate retirée)');
      await m.arreter();
    });
  });

  await run('ronde 1 — qualité et réducteur transmis à la passe (X27, X28)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'qualite-originale');
      const red = reducteur();
      const m = moteurDe(db, { stockage: creerStockageFactice(), qualite: () => 'originale', reduire: red.reduire, delaiRegroupementMs: 50000 });
      await m.executer('t');
      eq([(await db.get('files', s)).remote?.quality, red.appels.length], ['originale', 0], 'moteur (ronde 1) : qualite: () => originale part telle quelle, sans réduction (mutant X28 : qualite non transmise)');
      await m.arreter();
    });
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const s = await poserPhoto(repo, db, 'sans-reducteur'); // l'en-tête PNG seul : indécodable → ErreurImage du réducteur par défaut, journal muet
      const m = moteurDe(db, { stockage: creerStockageFactice(), delaiRegroupementMs: 50000 });
      const { codes } = await codesJournal(() => m.executer('t'));
      eq([(await db.get('files', s)).remote?.quality, codes.filter((c) => c === 'sync.fichiers.reduction').length], ['originale', 0], 'moteur (ronde 1) : sans reduire injecté, le réducteur par défaut est celui de fichiers.js — une image indécodable part telle quelle sans journal (mutant X27 : reduire null transmis)');
      await m.arreter();
    });
  });

  await run('ronde 1 — envoyerMaintenant lève pause_fichiers seule, même quand la passe suivante est bloquée (B-5 ; X32, X24)', async () => {
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      await repo.save('books', { id: 'bQ', title: 'Q' });
      await db.mutate({ puts: { sync_state: [{ key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }] }, origin: 'device' });
      const auth = { erreur: { type: 'auth', status: 401, message: '' } };
      const tf = creerTransportFactice({ pousser: [auth, auth, auth] });
      const m = moteurDe(db, { transport: tf, stockage: creerStockageFactice(), delaiRegroupementMs: 50000 });
      const e0 = await sansConsole(() => m.demarrer());
      await sansConsole(() => m.envoyerMaintenant());
      eq([e0.pauseFichiers?.raison, await db.get('sync_state', 'pause_fichiers'), m.etat().pauseFichiers, m.etat().attenteConnexion], ['stockage', undefined, null, true],
        'envoyerMaintenant (ronde 1) : pause_fichiers seule est retirée de sync_state ET de l’état, même si la passe qui suit bute sur la connexion (mutants X32 : levée seulement sous pause ; X24 : état non remis à nul)');
      await m.arreter();
    });
  });

  await run('ronde 1 — réponses des gestes : erreur réduite, sans clé, pause relue (sécurité ; X23, REVUE D)', async () => {
    await withRepo(async (repo, db) => {
      const sf = creerStockageFactice({ pannes: [{ methode: 'lister', erreur: { ...reseau(), code: 'ECONNRESET', message: 'texte-du-fournisseur' } }] });
      const m = moteurDe(db, { stockage: sf });
      const r = await sansConsole(() => m.actualiserEspace());
      eq(r, { erreur: { type: 'reseau', status: 0 } }, 'actualiserEspace (ronde 1, sécurité) : une mesure en échec rend { erreur: { type, status } } — jamais le code ni le texte du fournisseur (mutant : erreur brute)');
      let ecritures = 0; const vrai = db.mutate;
      db.mutate = function (a) { ecritures += 1; return vrai.call(this, a); };
      let rien = null;
      try { rien = await m.reessayerFichier(H('5')); } finally { delete db.mutate; }
      eq([rien, ecritures, compteDe(sf, 'envoyer') + compteDe(sf, 'recevoir')], [{ rien: true }, 0, 0], 'reessayerFichier (ronde 1) : une empreinte sans clé file_error rend { rien: true } sans écriture ni appel (mutant X23 : garde retirée)');
      await m.arreter();
    });
    // REVUE D : pause_fichiers posée entre la lecture du moteur et celle de l'envoi (un autre onglet) — la passe fichiers entière est suspendue.
    await withRepo(async (repo, db) => {
      await toutDejaEnvoye(db);
      const { copie, chemin } = await ligneDistanteDe(db, 'revue-d');
      await db.mutate({ puts: { source_pages: pagesDe([H('7')]), sync_state: [{ key: 'telecharger_tout', value: { at: DATE } }, { key: 'pause_fichiers', value: { raison: 'stockage', at: DATE } }] }, origin: 'device' });
      const sf = creerStockageFactice({ objets: { [chemin]: copie } });
      const m = moteurDe(db, { stockage: sf, delaiRegroupementMs: 50000 });
      let lectures = 0; const vrai = db.get;
      db.get = function (store, cle) { if (store === 'sync_state' && cle === 'pause_fichiers' && (lectures += 1) === 1) return Promise.resolve(undefined); return vrai.call(this, store, cle); };
      let fin = null;
      try { fin = await m.executer('t'); } finally { delete db.get; }
      eq([compteDe(sf, 'recevoir'), fin.pauseFichiers?.raison ?? null], [0, 'stockage'], 'REVUE D (ronde 1) : envoyer() qui rend { pause: true } suspend aussi le téléchargement global, et la pause est dite (§ 3.2 ; mutant : réponse pause ignorée)');
      await m.arreter();
    });
  });

  // === Tâche 5 — Réglages, ensemble L4 (§ 4.1, § 4.10, R-G-5)
  const SR = await import('../src/ui/settings.js');
  const baseL4 = { available: true, user: { id: 'u1', email: 'x@exemple.invalid' }, guard: { ok: true }, pending: 0 };
  const fichiersL4 = (sur = {}) => ({ aEnvoyer: 0, aTelecharger: 0, octetsATelecharger: 0, enErreur: 0, typeInconnu: 0, copiesPerimees: 0, copiesSansServeur: 0, aRenvoyer: 0, ...sur });
  const moteurL4 = (sur = {}) => ({ enCours: false, phase: null, progression: null, dernierEchange: null, aEnvoyer: 0, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: false, horloge: null, derniereErreur: null, derniersEffets: null, fichiers: fichiersL4(), progressionFichiers: null, espaceServeur: null, telechargementGlobal: false, pauseFichiers: null, ...sur });
  const modele = (moteur, sur = {}) => SR.syncSectionModel({ ...baseL4, moteur, ...sur });
  const rendre = (model, gestes = {}, options = {}) => { const boite = document.createElement('div'); for (const n of SR.syncSectionL4(model, gestes, options)) boite.append(n); return boite; };
  const boutons = (boite) => [...boite.querySelectorAll('button')].map((b) => b.textContent);
  const snapNoms = { books: [{ id: 'b1', title: 'Mon livre' }], book_editions: [{ id: 'e1', book_id: 'b1', cover_sha256: H('3') }], source_documents: [{ id: 'd1', edition_id: 'e1', sha256: H('1') }], source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12 }], recipes: [{ id: 'r1', original_title: 'Tarte', photo_sha256: H('4') }], imports: [], files: [] };

  await run('Réglages L4 : rendu réel (§ 4.1)', async () => {
    eq(Object.keys(modele(null, { fichiersErreurs: [{ sha256: H('1'), motif: 'type', sens: 'envoi' }], qualite: 'originale', snapshot: snapNoms })).sort(), ['buttons', 'lines', 'title'], 'Réglages L4 : sans moteur, le modèle est celui de L2/L3 — pas une clé de plus');
    eq([SR.syncSectionL4(modele(null)), SR.syncSectionL4(SR.syncSectionModel({ available: true, guard: { ok: false, message: 'x' }, moteur: moteurL4() }))], [[], []], 'Réglages L4 : sans moteur ou sans compte établi, rien de rendu');
    const b1 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aEnvoyer: 3 }), progressionFichiers: { sens: 'envoi', n: 2, total: 3 } })));
    ok(b1.textContent.includes('Photos à envoyer : 3') && b1.textContent.includes('Envoi des photos : 2/3'), 'L4 : « Photos à envoyer : 3 » et la progression d’envoi');
    const b2 = rendre(modele(moteurL4({ pauseFichiers: { raison: 'stockage', at: DATE } })));
    eq(b2.querySelector('.card.warn')?.textContent, 'Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir.', 'L4 : seau plein → la phrase en card warn, sans aucun chiffre de plan (R-G-5)');
    const quatre = 4 * 419430; // 1 677 720 octets → « 1,6 Mo »
    const b3 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 4, octetsATelecharger: quatre }) })), { telechargerTout: () => {} });
    eq([b3.textContent.includes('Photos et fichiers à télécharger : 4 (~1,6 Mo)'), boutons(b3).includes('Télécharger toutes les photos et fichiers (4 fichiers, ~1,6 Mo)')], [true, true], 'L4 : 4 pages, ~1,6 Mo → la ligne et le bouton');
    const b4 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 4, octetsATelecharger: quatre }), telechargementGlobal: true, progressionFichiers: { sens: 'reception', n: 1, total: 4 } })), { telechargerTout: () => {}, arreterTelechargement: () => {} });
    eq([boutons(b4).includes('Arrêter le téléchargement'), boutons(b4).some((b) => b.startsWith('Télécharger toutes')), b4.textContent.includes('Téléchargement des pages : 1/4')], [true, false, true], 'L4 : pendant le téléchargement global → « Arrêter le téléchargement » et la progression');
    const espace = { octets: 850 * 1048576, objets: 312, at: DATE, tronque: false };
    const b5 = rendre(modele(moteurL4({ espaceServeur: espace })), { actualiserEspace: () => {} });
    eq([b5.textContent.includes('Tes photos sur le serveur : 850 Mo (312 fichiers)'), b5.querySelectorAll('progress').length, /Go|palier|\$/.test(b5.textContent), boutons(b5).includes('Actualiser')], [true, 0, false, true],
      'L4 (R-G-5) : « Tes photos sur le serveur : 850 Mo (312 fichiers) », aucun <progress>, ni « Go », ni « palier », ni « $ » (mutants : barre ou phrase de palier réintroduite ; objets ignoré → « (0 fichiers) »)');
    eq([rendre(modele(moteurL4({ espaceServeur: { ...espace, tronque: true } }))).textContent.includes('au moins 850 Mo (312 fichiers)'), rendre(modele(moteurL4())).textContent.includes('Espace serveur : pas encore mesuré.')], [true, true], 'L4 : tronque → « au moins … » ; sans mesure → « pas encore mesuré »');
    const choix = [];
    const b6 = rendre(modele(moteurL4()), {}, { choisirQualite: (v) => choix.push(v) });
    const seg = b6.querySelector('.segmented');
    const actif = seg?.querySelector('button.active')?.textContent;
    [...seg.querySelectorAll('button')].find((b) => b.textContent === 'Originale').click();
    eq([actif, seg.closest('label'), !!seg.closest('.field'), choix], ['Réduite (≈ 400 Ko, 2 000 px)', null, true, ['originale']], 'L4 : segmented « Réduite » actif, HORS de tout <label> (R-UX-8, B-15), habillé .field ; un clic sur « Originale » choisit originale');
    const r1 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aRenvoyer: 2 }) }), { qualite: 'originale' }), { renvoyerOriginale: () => {} });
    const r2 = rendre(modele(moteurL4({ fichiers: fichiersL4({ aRenvoyer: 2 }) }), { qualite: 'reduite' }), { renvoyerOriginale: () => {} });
    eq([boutons(r1).includes('Renvoyer en originale les 2 photos de cet appareil envoyées en réduite'), boutons(r2).some((b) => b.startsWith('Renvoyer'))], [true, false], 'L4 : « Renvoyer en originale … » seulement en Originale avec des candidates (B-21)');
    const errs = [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }, { sha256: H('3'), motif: 'trop_gros', sens: 'envoi' }, { sha256: H('4'), motif: 'nouveau-motif', sens: 'envoi' }, { sha256: H('9'), motif: 'type', sens: 'envoi' }];
    const vus = [];
    const b8 = rendre(modele(moteurL4({ fichiers: fichiersL4({ enErreur: 3 }) }), { fichiersErreurs: errs, snapshot: snapNoms }), { reessayerFichier: (sha) => vus.push(sha) });
    const lignes = [...b8.querySelectorAll('[data-fichier]')];
    eq([b8.textContent.includes('Fichiers refusés : 3'), lignes.map((l) => l.querySelector('p').textContent), lignes.map((l) => l.querySelectorAll('button').length)],
      [true, ['Page 12 · Mon livre — Ce fichier n’est plus sur le serveur.', 'Couverture · Mon livre — Plus de 50 Mo : ce fichier reste sur cet appareil seulement.', 'Photo du plat · Tarte — Fichier refusé'], [1, 0, 1]],
      'L4 : une ligne par file_error d’une ligne RÉFÉRENCÉE (H9, orpheline, n’est pas dite), nommée par nomFichier (I-G8), motif en phrase, motif inconnu → « Fichier refusé » ; trop_gros sans « Réessayer » (B-22 ; mutant : bouton rendu)');
    lignes[0].querySelector('button').click();
    eq(vus, [H('1')], 'L4 : « Réessayer » appelle gestes.reessayerFichier(sha256)');
    const b9 = rendre(modele(moteurL4({ fichiers: fichiersL4({ typeInconnu: 1, copiesSansServeur: 1, copiesPerimees: 1 }) })));
    ok(['1 fichier(s) de type inconnu ne seront pas synchronisés.', '1 copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra.', '1 photo(s) ici sont une copie plus ancienne que celle du serveur.'].every((p) => b9.textContent.includes(p)), 'L4 : type inconnu, copies sans serveur, copies périmées — leurs phrases (§ 4.1 items 7 et 8)');
    eq([SR.motifFichier('type', 'envoi'), SR.motifFichier('type', 'reception'), SR.motifFichier('forme', 'reception'), SR.motifFichier('__proto__', 'envoi')], ['Type de fichier refusé par le serveur.', 'Fichier illisible reçu du serveur.', 'Ligne de fichier mal formée reçue du serveur.', 'Fichier refusé'], 'motifFichier (§ 4.10) : le motif ET le sens décident la phrase ; un jeton inconnu ou hostile → « Fichier refusé », jamais le jeton');
    // R-G-5 et I-G8 sur un rendu où TOUTES les branches sont actives (pause, à télécharger, téléchargement global, renvoi, refusés, phrases),
    // pas sur le seul rendu de l'espace : une phrase de palier dans la carte pause ou le renvoi resterait verte sinon.
    const toutes = rendre(modele(moteurL4({ fichiers: fichiersL4({ aEnvoyer: 2, aTelecharger: 4, octetsATelecharger: quatre, aRenvoyer: 2, enErreur: 3, typeInconnu: 1, copiesSansServeur: 1, copiesPerimees: 1 }), progressionFichiers: { sens: 'reception', n: 1, total: 4 }, telechargementGlobal: true, pauseFichiers: { raison: 'stockage', at: DATE }, espaceServeur: { ...espace, tronque: true } }), { qualite: 'originale', fichiersErreurs: errs, snapshot: snapNoms }),
      { telechargerTout: () => {}, arreterTelechargement: () => {}, actualiserEspace: () => {}, renvoyerOriginale: () => {}, reessayerFichier: () => {} });
    const texteToutes = toutes.textContent;
    eq([texteToutes.includes('Espace photos plein'), texteToutes.includes('Photos et fichiers à télécharger : 4'), boutons(toutes).includes('Arrêter le téléchargement'), boutons(toutes).some((b) => b.startsWith('Renvoyer en originale')), toutes.querySelectorAll('[data-fichier]').length, /Go|palier|\$/.test(texteToutes), /supabase/i.test(texteToutes), toutes.querySelectorAll('progress').length],
      [true, true, true, true, 3, false, false, 0], 'L4 (R-G-5, I-G8) : sur un rendu où toutes les branches sont actives — pause, pages à télécharger, téléchargement global, renvoi, refusés, phrases —, ni « Go », ni « palier », ni « $ », ni le nom du fournisseur, aucun <progress> (mutants : phrase de palier dans la carte pause ou le renvoi ; fournisseur nommé)');
  });

  await run('Réglages L4 : gestes câblés, protégés ; qualité écrite ; « Envoi en cours… »', async () => {
    eq(SR.SYNC_L4_ACTIONS, ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerOriginale', 'reessayerFichier'], 'L4 : les cinq gestes nommés');
    const appels = [];
    const moteurFactice = Object.fromEntries(['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerEnOriginale', 'reessayerFichier'].map((nom) => [nom, async (x) => { appels.push(nom + (x ? ':' + x : '')); }]));
    const gestes = SR.gestesL4Pour({ obtenirMoteur: () => moteurFactice, dire: () => {}, rafraichir: () => {}, journaliser: () => {} });
    eq(Object.keys(gestes).sort(), [...SR.SYNC_L4_ACTIONS].sort(), 'gestesL4Pour : exactement les cinq gestes');
    const tout = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 1, octetsATelecharger: 10, aRenvoyer: 1, enErreur: 1 }) }), { qualite: 'originale', fichiersErreurs: [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }], snapshot: snapNoms }), gestes);
    for (const b of tout.querySelectorAll('button')) if (!b.closest('.segmented')) b.click();
    const arret = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 1 }), telechargementGlobal: true })), gestes);
    [...arret.querySelectorAll('button')].find((b) => b.textContent === 'Arrêter le téléchargement').click();
    await new Promise((r) => setTimeout(r, 0));
    eq(appels.sort(), ['actualiserEspace', 'arreterTelechargement', 'reessayerFichier:' + H('1'), 'renvoyerEnOriginale', 'telechargerTout'], 'L4 : chaque bouton appelle SON geste, chaque geste son API du moteur (mutant : action renommée → bouton manquant)');
    const dits = [];
    await SR.gestesL4Pour({ obtenirMoteur: () => ({ actualiserEspace: async () => { throw new Error('x'); } }), dire: (m) => dits.push(m), rafraichir: () => {}, journaliser: () => {} }).actualiserEspace();
    eq(dits, ['Ce geste n’a pas abouti.'], 'gestesL4Pour : un geste qui rejette est dit, jamais un rejet non traité');
    await withRepo(async (repo) => {
      const b = rendre(modele(moteurL4()));
      [...b.querySelectorAll('.segmented button')].find((x) => x.textContent === 'Originale').click();
      let lu = null;
      for (let i = 0; i < 100 && (lu = await repo.getSetting('upload_quality')) !== 'originale'; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq(lu, 'originale', 'L4 : le câblage par défaut écrit repo.setSetting(upload_quality, originale) (§ 3.3)');
      await (await import('../src/ui/state.js')).relectureEnCours();
    });
    await (await import('../src/ui/state.js')).relireReglages(); // la base de l'app reprend la main (même hygiène qu'en tâche 1)
    const ditsE = [];
    await SR.effacerDonnees({ user: null, pending: async () => 0, confirm: async () => true, demanderMot: async () => 'EFFACER', toast: (m) => ditsE.push(m), clearDevice: async () => {}, reload: () => {}, arreterSync: async () => {}, transfertEnCours: () => true });
    const ditsC = [];
    await SR.changerDeCompte({ confirm: async () => true, toast: (m) => ditsC.push(m), pending: async () => 0, archiveCreated: () => 'oui', clearDevice: async () => {}, reload: () => {}, arreterSync: async () => {}, transfertEnCours: () => true });
    eq([ditsE, ditsC], [['Envoi en cours…', 'Données effacées'], ['Envoi en cours…']], 'effacerDonnees et changerDeCompte : un envoi ou un téléchargement en vol se dit « Envoi en cours… » avant d’attendre l’arrêt (S-11/F-24 : non annulable)');
  });

  // Tâche 5 — épingles hors brief : chemins que le brief prescrit mais que ses tests n'exercent pas (mutants survivants de la série 1, rejoués
  // sur une copie) : la page entière (renderSettings → syncSection), l'ordre « dit, puis arrêt » de S-11, le défaut de transfertEnCours, le sens
  // de la progression, les valeurs hors forme et le rafraîchissement après chaque geste. Ronde 1 (revue adverse) : la page entière clique aussi
  // ses cinq boutons sur le moteur posé (R3, R3b, R16), place L4 entre L3 et l'historique (R5), nomme une erreur d'ENVOI référencée (R13) et
  // compte les refus sur les lignes (R10) ; S-11 journalise les confirmations et leurs refus (R11, R12) ; `objets` est typé (R9).
  await run('Réglages L4 (hors brief) : la page entière lit les file_error et le snapshot, passe la qualité du réglage, rend L4 entre L3 et l’historique, câble ses cinq boutons au moteur posé', async () => {
    const etat = await import('../src/ui/state.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: {
        books: [{ id: 'b1', title: 'Mon livre', updated_at: DATE }],
        book_editions: [{ id: 'e1', book_id: 'b1', cover_sha256: H('3'), updated_at: DATE }],
        source_documents: [{ id: 'd1', edition_id: 'e1', updated_at: DATE }],
        source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12, updated_at: DATE }],
        sync_state: [
          { key: 'file_error:' + H('1'), value: { motif: 'introuvable', sens: 'reception', at: DATE } },
          { key: 'file_error:' + H('3'), value: { motif: 'type', sens: 'envoi', at: DATE } },
          { key: 'file_error:' + H('9'), value: { motif: 'type', sens: 'envoi', at: DATE } },
        ],
        sync_conflicts: [{ id: 'c1', store: 'recipes', record_id: 'r9', kind: 'donnees', at: DATE, local: { id: 'r9', title: 'Tarte', updated_at: DATE }, server: { id: 'r9', title: 'Tarte bis', updated_at: DATE } }],
      }, origin: 'device' });
      await repo.setSetting('upload_quality', 'originale');
      const appels = [];
      let global = false;
      // Le moteur posé dans state.js porte les cinq API espionnées : le câblage PAR DÉFAUT de la page (gestesL4Pour() sans argument) est cliqué.
      const moteurPose = {
        etat: () => moteurL4({ fichiers: fichiersL4({ aTelecharger: 1, octetsATelecharger: 10, aRenvoyer: 1, enErreur: 5 }), telechargementGlobal: global }),
        ...Object.fromEntries(['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerEnOriginale', 'reessayerFichier'].map((nom) => [nom, async (x) => { appels.push(nom + (x ? ':' + x : '')); return {}; }])),
      };
      const contexte = { settings: await repo.getSettings(), sync: { auth: { available: true, reason: null }, user: { id: 'u1', email: 'x@exemple.invalid' }, guard: { ok: true } } };
      const avant = etat.getSyncState().moteur;
      let rafraichis = 0;
      const compter = () => { rafraichis += 1; };
      let page = null;
      window.addEventListener('cuisineos:refresh', compter);
      try {
        etat.setSyncState({ moteur: moteurPose });
        page = await SR.renderSettings({}, {}, contexte, {});
        for (const b of page.querySelectorAll('[data-role="sync-l4"] button')) if (!b.closest('.segmented')) b.click();
        global = true;
        const pageGlobale = await SR.renderSettings({}, {}, contexte, {});
        [...pageGlobale.querySelectorAll('[data-role="sync-l4"] button')].find((b) => b.textContent === 'Arrêter le téléchargement')?.click();
        for (let i = 0; i < 100 && (appels.length < 6 || rafraichis < 6); i += 1) await new Promise((r) => setTimeout(r, 10));
      } finally {
        window.removeEventListener('cuisineos:refresh', compter);
        etat.setSyncState({ moteur: avant });
      }
      const l4 = page.querySelector('[data-role="sync-l4"]');
      const conflit = page.querySelector('[data-conflit]');
      const historique = [...page.querySelectorAll('label.field > span')].find((s) => s.textContent === 'Historique de consultation');
      const suit = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      const lignes = [...page.querySelectorAll('[data-fichier]')];
      eq([!!l4, suit(conflit, l4), suit(l4, historique), lignes.map((l) => l.querySelector('p').textContent), lignes.map((l) => [...l.querySelectorAll('button')].map((b) => b.textContent)),
        !!l4?.textContent.includes('Fichiers refusés : 2'), l4?.querySelector('.segmented button.active')?.textContent],
      [true, true, true, ['Page 12 · Mon livre — Ce fichier n’est plus sur le serveur.', 'Couverture · Mon livre — Type de fichier refusé par le serveur.'], [['Réessayer'], ['Réessayer']], true, 'Originale'],
      'renderSettings (hors brief, § 4.1) : avec un compte et un moteur, la page rend l’ensemble L4 APRÈS L3 (un conflit) et AVANT « Historique de consultation », nomme les file_error de lignes référencées lues EN BASE, chacune selon SON sens (H9, orpheline, tue), compte « Fichiers refusés » sur ces lignes et non sur enErreur du moteur (5), montre la qualité du réglage (mutants : L4 non rendu ou avant L3 ; file_error, snapshot ou qualité non passés ; sens figé ; refuses lu dans le moteur)');
      eq([[...appels].sort(), rafraichis], [['actualiserEspace', 'arreterTelechargement', 'reessayerFichier:' + H('1'), 'reessayerFichier:' + H('3'), 'renvoyerEnOriginale', 'telechargerTout'], 6],
        'renderSettings (ronde 1, R3/R3b/R16) : dans la page réelle, les cinq boutons L4 existent, chacun appelle SON API sur le moteur posé dans state.js et redessine la page (cuisineos:refresh) — mutants : obtenirMoteur ou rafraichir par défaut muets, syncSection qui ne câble qu’un geste');
      await etat.relectureEnCours();
    });
    await etat.relireReglages(); // la base de l'app reprend la main (même hygiène que le bloc du brief)
  });

  await run('Réglages L4 (hors brief) : « Envoi en cours… » dit APRÈS les confirmations et AVANT l’arrêt, seulement pendant un transfert ; le défaut lit progressionFichiers du moteur (S-11/F-24)', async () => {
    const etat = await import('../src/ui/state.js');
    // Ronde 1 : les confirmations écrivent dans le même journal — la phrase ne vient qu'une fois le geste décidé, jamais pour un arrêt qui n'a pas lieu.
    const oui = (dits) => async () => { dits.push('<confirmé>'); return true; };
    const non = (dits) => async () => { dits.push('<refusé>'); return false; };
    const effacer = (dits, sur = {}) => SR.effacerDonnees({ user: null, pending: async () => 0, confirm: oui(dits), demanderMot: async () => { dits.push('<mot>'); return 'EFFACER'; }, toast: (m) => dits.push(m), clearDevice: async () => {}, reload: () => {}, arreterSync: async () => { dits.push('<arrêt>'); }, ...sur });
    // Vague finale du lot G : avec un compte, la question nomme la perte des photos pas encore envoyées (la file ne les compte pas, D-G8) ; sans compte, la phrase d'avant.
    const questions = [];
    const demande = async (q) => { questions.push(q); return false; };
    await SR.effacerDonnees({ user: { id: 'u1' }, pending: async () => 0, confirm: demande, demanderMot: async () => 'EFFACER', toast: () => {}, clearDevice: async () => {}, reload: () => {}, arreterSync: async () => {} });
    await SR.effacerDonnees({ user: null, pending: async () => 0, confirm: demande, demanderMot: async () => 'EFFACER', toast: () => {}, clearDevice: async () => {}, reload: () => {}, arreterSync: async () => {} });
    // Ronde 2 (R-G-28 bis) : la phrase nomme aussi les documents (PDF, EPUB) et la copie réduite d'une photo envoyée en qualité réduite.
    eq(questions, ['Effacer les données de cet appareil ? Les photos et documents pas encore envoyés seront perdus ; une photo envoyée en qualité réduite ne garde que sa copie réduite. Fais d’abord une sauvegarde.', 'Effacer les données de cet appareil ? Fais d’abord une sauvegarde.'],
      'effacer (vague finale, ronde 2) : avec un compte, la confirmation dit, mot pour mot, que les photos et documents pas encore envoyés seront perdus et qu’une photo envoyée en qualité réduite ne garde que sa copie réduite ; sans compte, la phrase d’avant (mutants : une seule phrase ; l’ancienne phrase « Les photos pas encore envoyées… »)');
    const changer = (dits, sur = {}) => SR.changerDeCompte({ confirm: oui(dits), toast: (m) => dits.push(m), pending: async () => 0, archiveCreated: () => 'oui', clearDevice: async () => {}, reload: () => {}, arreterSync: async () => { dits.push('<arrêt>'); }, ...sur });
    const vu = { effacerEnVol: [], effacerAuRepos: [], changerEnVol: [], changerAuRepos: [], effacerDefaut: [], changerDefaut: [], effacerDefautRepos: [], effacerRefuse: [], effacerMotFaux: [], changerSansArchive: [], changerRefuse: [], changerPerteRefusee: [] };
    const enVol = { transfertEnCours: () => true };
    await effacer(vu.effacerEnVol, enVol);
    await effacer(vu.effacerAuRepos, { transfertEnCours: () => false });
    await changer(vu.changerEnVol, enVol);
    await changer(vu.changerAuRepos, { transfertEnCours: () => false });
    await effacer(vu.effacerRefuse, { ...enVol, confirm: non(vu.effacerRefuse) });
    await effacer(vu.effacerMotFaux, { ...enVol, demanderMot: async () => { vu.effacerMotFaux.push('<mot>'); return 'non'; } });
    await changer(vu.changerSansArchive, { ...enVol, archiveCreated: () => null });
    await changer(vu.changerRefuse, { ...enVol, confirm: non(vu.changerRefuse) });
    let question = 0;
    await changer(vu.changerPerteRefusee, { ...enVol, confirm: async () => { question += 1; vu.changerPerteRefusee.push(question === 1 ? '<confirmé>' : '<refusé>'); return question === 1; } });
    const avant = etat.getSyncState().moteur;
    try {
      etat.setSyncState({ moteur: { etat: () => moteurL4({ progressionFichiers: { sens: 'reception', n: 1, total: 2 } }) } });
      await effacer(vu.effacerDefaut);
      await changer(vu.changerDefaut);
      etat.setSyncState({ moteur: { etat: () => moteurL4() } });
      await effacer(vu.effacerDefautRepos);
    } finally { etat.setSyncState({ moteur: avant }); }
    eq(vu, {
      effacerEnVol: ['<confirmé>', '<mot>', 'Envoi en cours…', '<arrêt>', 'Données effacées'],
      effacerAuRepos: ['<confirmé>', '<mot>', '<arrêt>', 'Données effacées'],
      changerEnVol: ['<confirmé>', '<confirmé>', 'Envoi en cours…', '<arrêt>'],
      changerAuRepos: ['<confirmé>', '<confirmé>', '<arrêt>'],
      effacerDefaut: ['<confirmé>', '<mot>', 'Envoi en cours…', '<arrêt>', 'Données effacées'],
      changerDefaut: ['<confirmé>', '<confirmé>', 'Envoi en cours…', '<arrêt>'],
      effacerDefautRepos: ['<confirmé>', '<mot>', '<arrêt>', 'Données effacées'],
      effacerRefuse: ['<refusé>'],
      effacerMotFaux: ['<confirmé>', '<mot>', 'Annulé'],
      changerSansArchive: ['Fais d’abord une archive sur cette page.'],
      changerRefuse: ['<refusé>'],
      changerPerteRefusee: ['<confirmé>', '<refusé>'],
    }, 'effacerDonnees et changerDeCompte (hors brief, S-11/F-24 ; ronde 1, R11/R12) : la phrase vient APRÈS les confirmations et AVANT l’attente de l’arrêt, rien n’est dit sans transfert, et un geste refusé (confirmation, mot, archive, perte) ne dit jamais « Envoi en cours… » pour un arrêt qui n’a pas lieu ; le défaut lit progressionFichiers du moteur posé (mutants : dit avant les confirmations ou après l’arrêt ; dit toujours ; défaut jamais vrai)');
  });

  await run('Réglages L4 (hors brief) : progression selon son sens, valeurs hors forme tues, chaque geste rafraîchit après son appel', async () => {
    const avecPages = (sens) => rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 2, octetsATelecharger: 10 }), progressionFichiers: { sens, n: 1, total: 2 } }))).textContent;
    const enEnvoi = avecPages('envoi');
    const enReception = avecPages('reception');
    eq([enEnvoi.includes('Envoi des photos : 1/2'), enEnvoi.includes('Téléchargement des pages'), enReception.includes('Téléchargement des pages : 1/2'), enReception.includes('Envoi des photos')], [true, false, true, false],
      'L4 (hors brief, § 4.1 items 1 et 2) : la progression d’envoi et celle du téléchargement ne se disent que dans leur sens (mutants : sens ignoré)');
    const hors = modele(moteurL4({ fichiers: fichiersL4({ aEnvoyer: -1, aTelecharger: Number.NaN, typeInconnu: 1.5, copiesPerimees: '2' }), espaceServeur: { octets: '850', objets: 312, at: DATE, tronque: false } }));
    eq([hors.fichiers.aEnvoyer, hors.fichiers.aTelecharger, hors.fichiers.typeInconnu, hors.fichiers.copiesPerimees, hors.espace], ['Photos à envoyer : 0', null, null, null, 'Espace serveur : pas encore mesuré.'],
      'L4 (hors brief) : un compteur qui n’est pas un entier positif vaut 0, une mesure dont les octets ne sont pas un nombre n’est pas dite (mutants : compteurs non bornés ; mesure non typée)');
    const mesure = { octets: 850 * 1048576, at: DATE, tronque: false };
    eq([modele(moteurL4({ espaceServeur: { ...mesure, objets: '312' } })).espace, modele(moteurL4({ espaceServeur: mesure })).espace], ['Espace serveur : pas encore mesuré.', 'Espace serveur : pas encore mesuré.'],
      'L4 (ronde 1, R9) : une mesure dont le nombre d’objets n’est pas un nombre (chaîne, absent) n’est pas dite (mutant : objets non typé → « (312 fichiers) », « (undefined fichiers) »)');
    const journal = [];
    const moteurJ = Object.fromEntries(['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerEnOriginale', 'reessayerFichier'].map((nom) => [nom, async () => { journal.push(nom); }]));
    const g = SR.gestesL4Pour({ obtenirMoteur: () => moteurJ, dire: () => {}, rafraichir: () => journal.push('rendu'), journaliser: () => {} });
    for (const a of SR.SYNC_L4_ACTIONS) await g[a](H('1'));
    eq(journal, ['telechargerTout', 'rendu', 'arreterTelechargement', 'rendu', 'actualiserEspace', 'rendu', 'renvoyerEnOriginale', 'rendu', 'reessayerFichier', 'rendu'],
      'gestesL4Pour (hors brief) : chaque geste rafraîchit l’écran APRÈS l’appel du moteur, comme gestesL3Pour (mutant : rafraîchissement retiré)');
  });

  // Ronde 1 de la tâche 5 (revue adverse) : la table de § 4.10 entière, les motifs d'envoi posés depuis le plan (forme : T3-R1 ; illisible : T4-R1),
  // un libellé borné, « Fichiers refusés » compté sur les lignes référencées, l'ordre des items, l'aide de la qualité (exceptions de R-G-4 nommées),
  // le seau plein sans « Télécharger toutes les photos et fichiers », la pause L3 hors de L4, aucun bouton sans geste, l'interface anglaise.
  const HINT_QUALITE = 'L’original reste toujours sur l’appareil qui a pris la photo. Réduite : JPEG de 2 000 px au plus, environ 400 Ko par page, métadonnées retirées, quand la réduction est possible et utile ; sinon le fichier part tel quel, métadonnées comprises : une image déjà petite (2 000 px et 600 Ko au plus), une photo de plus de 16 Mpx ou que ce navigateur ne sait pas lire, un PDF ou un EPUB. Originale : le fichier tel quel, avec ses métadonnées (dont la position GPS si la photo en porte).';
  const horsSegments = (boite) => [...boite.querySelectorAll('button')].filter((b) => !b.closest('.segmented')).map((b) => b.textContent);

  await run('Réglages L4 (ronde 1) : motifs, libellés bornés, refus comptés, ordre des items, aide de la qualité, pauses, boutons sans geste, anglais', async () => {
    const couples = [['trop_gros', 'envoi'], ['type', 'envoi'], ['verification', 'envoi'], ['forme', 'envoi'], ['illisible', 'envoi'], ['forme', 'reception'], ['introuvable', 'reception'], ['empreinte', 'reception'], ['taille', 'reception'], ['type', 'reception'],
      ['illisible', 'reception'], ['trop_gros', 'reception'], ['inconnu', 'envoi'], ['__proto__', 'envoi'], ['constructor', 'reception'], ['type', undefined], [undefined, undefined]];
    eq(couples.map(([m, s]) => SR.motifFichier(m, s)), ['Plus de 50 Mo : ce fichier reste sur cet appareil seulement.', 'Type de fichier refusé par le serveur.', 'Empreinte différente après envoi.', 'Fichier vide ou mal formé : il reste sur cet appareil seulement.', 'Fichier illisible sur cet appareil.',
      'Ligne de fichier mal formée reçue du serveur.', 'Ce fichier n’est plus sur le serveur.', 'Fichier illisible reçu du serveur.', 'Fichier illisible reçu du serveur.', 'Fichier illisible reçu du serveur.',
      'Fichier refusé', 'Fichier refusé', 'Fichier refusé', 'Fichier refusé', 'Fichier refusé', 'Fichier refusé', 'Fichier refusé'],
    'motifFichier (ronde 1, § 4.10) : les DIX couples sens:motif de MOTIFS_FICHIER mot pour mot — envoi:forme (fichier vide, T3-R1) et envoi:illisible (T4-R1) compris —, et tout autre couple (inconnu, sans sens, hostile) → « Fichier refusé » (mutants : une entrée retirée, reception:taille ou envoi:verification compris)');
    const errsEnvoi = [{ sha256: H('1'), motif: 'forme', sens: 'envoi' }, { sha256: H('3'), motif: 'illisible', sens: 'envoi' }, { sha256: H('4'), motif: 'trop_gros', sens: 'envoi' }];
    const bE = rendre(modele(moteurL4(), { fichiersErreurs: errsEnvoi, snapshot: snapNoms }), { reessayerFichier: () => {} });
    eq([...bE.querySelectorAll('[data-fichier]')].map((l) => [l.querySelector('p').textContent, l.querySelectorAll('button').length]),
      [['Page 12 · Mon livre — Fichier vide ou mal formé : il reste sur cet appareil seulement.', 0], ['Couverture · Mon livre — Fichier illisible sur cet appareil.', 1], ['Photo du plat · Tarte — Plus de 50 Mo : ce fichier reste sur cet appareil seulement.', 0]],
      'L4 (ronde 1, B-22) : un fichier vide ou mal formé à l’envoi n’offre pas « Réessayer » (les mêmes octets reposeraient la même clé, comme trop_gros) ; un fichier illisible ici l’offre (T4-R1 : « Réessayer » le retente)');
    const snapLong = { ...snapNoms, books: [{ id: 'b1', title: 'T'.repeat(400) }] };
    eq(modele(moteurL4(), { fichiersErreurs: [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }], snapshot: snapLong }).erreursFichiers.map((e) => e.texte), ['Page 12 · ' + 'T'.repeat(30) + '… — Ce fichier n’est plus sur le serveur.'],
      'L4 (ronde 1) : le libellé d’un fichier refusé vient de fiches reçues : il est BORNÉ comme ceux de L3 (NOM_MAX, la coupe se voit) — mutant : nomFichier brut');
    const seule = rendre(modele(moteurL4({ fichiers: fichiersL4({ enErreur: 0 }) }), { fichiersErreurs: [{ sha256: H('1'), motif: 'forme', sens: 'reception' }], snapshot: snapNoms }), { reessayerFichier: () => {} });
    eq([seule.textContent.includes('Fichiers refusés : 1'), seule.querySelectorAll('[data-fichier]').length], [true, 1],
      'L4 (ronde 1, R10) : « Fichiers refusés » compte les file_error RÉFÉRENCÉES, même sans ligne files (enErreur du moteur vaut 0 : une réception « forme » d’une page jamais arrivée) — mutant : refuses lu dans moteur.fichiers.enErreur');
    const quatre = 4 * 419430;
    const errs = [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }, { sha256: H('3'), motif: 'trop_gros', sens: 'envoi' }, { sha256: H('4'), motif: 'nouveau-motif', sens: 'envoi' }, { sha256: H('9'), motif: 'type', sens: 'envoi' }];
    const toutesModele = () => modele(moteurL4({ fichiers: fichiersL4({ aEnvoyer: 2, aTelecharger: 4, octetsATelecharger: quatre, aRenvoyer: 2, enErreur: 3, typeInconnu: 1, copiesSansServeur: 1, copiesPerimees: 1 }), progressionFichiers: { sens: 'reception', n: 1, total: 4 }, telechargementGlobal: true, pauseFichiers: { raison: 'stockage', at: DATE }, espaceServeur: { octets: 850 * 1048576, objets: 312, at: DATE, tronque: true } }), { qualite: 'originale', fichiersErreurs: errs, snapshot: snapNoms });
    const texte = rendre(toutesModele(), { telechargerTout: () => {}, arreterTelechargement: () => {}, actualiserEspace: () => {}, renvoyerOriginale: () => {}, reessayerFichier: () => {} }).textContent;
    const reperes = ['Photos à envoyer : 2', 'Espace photos plein', 'Photos et fichiers à télécharger : 4', 'Téléchargement des pages : 1/4', 'Arrêter le téléchargement', 'au moins 850 Mo', 'Actualiser', 'Qualité d’envoi des photos', 'Réduite (≈ 400 Ko', 'L’original reste toujours',
      'Renvoyer en originale', 'Fichiers refusés : 3', 'Page 12 · Mon livre', '1 fichier(s) de type inconnu', '1 copie(s) de photos ici', '1 photo(s) ici sont une copie'];
    const positions = reperes.map((r) => texte.indexOf(r));
    eq(reperes.filter((r, i) => !(positions[i] >= 0 && (i === 0 || positions[i] > positions[i - 1]))), [],
      'L4 (ronde 1, § 4.1 « dans cet ordre ») : sur un rendu à toutes branches, les items 1 à 8 se suivent dans l’ordre de la spec (mutants : ligne d’espace et « Actualiser » en fin de bloc ; refus avant la qualité)');
    eq(rendre(modele(moteurL4())).querySelector('.segmented')?.closest('.field')?.querySelector('small')?.textContent, HINT_QUALITE,
      'L4 (ronde 1, S-9, R-G-4) : l’aide de la qualité est là, mot pour mot, et nomme ce qui part TEL QUEL en « Réduite », métadonnées comprises (petite image, plus de 16 Mpx, illisible ici, PDF ou EPUB) — mutants : aide retirée ; « métadonnées retirées » promis sans exception');
    const pleine = (sur = {}) => modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 4, octetsATelecharger: quatre }), pauseFichiers: { raison: 'stockage', at: DATE }, ...sur }));
    const gestesTelechargement = { telechargerTout: () => {}, arreterTelechargement: () => {} };
    const bp = rendre(pleine(), gestesTelechargement);
    eq([bp.textContent.includes('Photos et fichiers à télécharger : 4 (~1,6 Mo)'), horsSegments(bp), horsSegments(rendre(pleine({ telechargementGlobal: true }), gestesTelechargement))], [true, [], ['Arrêter le téléchargement']],
      'L4 (ronde 1, § 3.2) : seau plein → la passe fichiers entière est suspendue, téléchargement global compris : « Télécharger toutes les photos et fichiers » n’est pas offert (il ne ferait rien descendre) ; « Arrêter le téléchargement » reste si le global était demandé');
    const sousQuotaL3 = rendre(modele(moteurL4({ pause: { raison: 'quota', at: DATE } })));
    eq([sousQuotaL3.querySelectorAll('.card.warn').length, sousQuotaL3.textContent.includes('Espace photos plein')], [0, false],
      'L4 (ronde 1, B-5) : la pause de quota des FICHES (L3) n’est pas celle du seau : aucune carte L4 ne dit « les fiches continuent de partir » sous une pause qui les arrête (mutant : pause || pauseFichiers)');
    eq(horsSegments(rendre(toutesModele())), [], 'L4 (ronde 1, R4) : sans geste câblé, aucun bouton — un bouton n’existe que si son geste existe (mutant : bouton toujours rendu, muet)');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const langue = getUiLocale();
    let en = null;
    try {
      setUiLocale('en');
      en = rendre(modele(moteurL4({ fichiers: fichiersL4({ aTelecharger: 4, octetsATelecharger: quatre }), espaceServeur: { octets: 850 * 1048576 + 3 * 104858, objets: 312, at: DATE, tronque: false } })), { telechargerTout: () => {} });
    } finally { setUiLocale(langue); }
    eq([en.textContent.includes('Photos and files to download: 4 (~1.6 MB)'), horsSegments(en), en.textContent.includes('Your photos on the server: 850.3 MB (312 files)')], [true, ['Download all photos and files (4 files, ~1.6 MB)'], true],
      'L4 (ronde 1, R8) : en interface anglaise, les mégaoctets portent le point décimal — enMo suit la langue de l’interface (mutant : enMo figé en fr-CA)');
  });

  await run('Réglages L4 (ronde 1) : un échec rendu EN VALEUR par le moteur est dit, un moteur absent aussi ; la qualité est écrite PUIS redessinée, et protégée', async () => {
    const API = ['telechargerTout', 'arreterTelechargement', 'actualiserEspace', 'renvoyerEnOriginale', 'reessayerFichier'];
    const ko = 'Ce geste n’a pas abouti.';
    const essayer = async (rendu) => {
      const journal = [];
      const m = rendu === null ? null : Object.fromEntries(API.map((nom) => [nom, async () => rendu]));
      const g = SR.gestesL4Pour({ obtenirMoteur: () => m, dire: (x) => journal.push(x), rafraichir: () => journal.push('rendu'), journaliser: (nom) => journal.push(nom) });
      for (const a of SR.SYNC_L4_ACTIONS) await g[a](H('1'));
      return journal;
    };
    eq([await essayer({ erreur: { type: 'reseau', status: null } }), await essayer({ recus: 1, erreurs: 0, erreur: null }), await essayer(null)], [
      ['rendu', ko, 'rendu', ko, 'rendu', ko, 'rendu', ko, 'rendu', ko],
      ['rendu', 'rendu', 'rendu', 'rendu', 'rendu'],
      ['sync.geste.telecharger_tout', ko, 'sync.geste.arreter_telechargement', ko, 'sync.geste.actualiser_espace', ko, 'sync.geste.renvoyer_originale', ko, 'sync.geste.reessayer_fichier', ko],
    ], 'gestesL4Pour (ronde 1) : l’API du moteur rend ses échecs EN VALEUR ({ erreur }, ARRETE) — ils sont dits après le redessin (un « Réessayer » hors réseau ne se lit plus comme un succès) ; un succès ne dit rien ; un moteur absent est journalisé et dit, jamais avalé par « ?. » (mutants : résultat ignoré ; moteur absent muet)');
    const jq = [];
    const deps = { rafraichir: () => jq.push('rendu'), dire: (x) => jq.push(x), journaliser: (nom) => jq.push(nom) };
    await SR.choisirQualitePour({ ...deps, ecrire: async (v) => { await new Promise((r) => setTimeout(r, 5)); jq.push('écrit:' + v); } })('originale');
    await SR.choisirQualitePour({ ...deps, ecrire: async () => { throw new Error('base fermée'); } })('reduite');
    eq(jq, ['écrit:originale', 'rendu', 'sync.geste.qualite', ko],
      'choisirQualitePour (ronde 1, § 4.1 item 4) : le réglage est écrit PUIS l’écran redessiné (le segmented n’a pas d’état propre) ; une écriture refusée est journalisée et dite, sans redessin (mutants : refresh retiré, ou avant l’écriture ; bascule non protégée)');
    await withRepo(async (repo) => {
      let rafraichis = 0;
      const compter = () => { rafraichis += 1; };
      let lu = null;
      window.addEventListener('cuisineos:refresh', compter);
      try {
        const b = rendre(modele(moteurL4()));
        [...b.querySelectorAll('.segmented button')].find((x) => x.textContent === 'Originale').click();
        for (let i = 0; i < 100 && ((lu = await repo.getSetting('upload_quality')) !== 'originale' || rafraichis < 1); i += 1) await new Promise((r) => setTimeout(r, 10));
      } finally { window.removeEventListener('cuisineos:refresh', compter); }
      eq([lu, rafraichis], ['originale', 1], 'L4 (ronde 1, R1) : le câblage PAR DÉFAUT de la bascule écrit upload_quality ET redessine la page une fois (cuisineos:refresh) — mutant : refresh() retiré du défaut');
      await (await import('../src/ui/state.js')).relectureEnCours();
    });
    await (await import('../src/ui/state.js')).relireReglages(); // la base de l'app reprend la main
  });

  await run('Réglages L4 (ronde 1) : sans erreur de fichier à nommer, un rendu de Réglages ne lit pas le snapshot des sept magasins', async () => {
    const etat = await import('../src/ui/state.js');
    await withRepo(async (repo, db) => {
      const vraiGetSnapshot = db.getSnapshot;
      const lus = [];
      db.getSnapshot = function (magasins) { lus.push(magasins); return vraiGetSnapshot.call(this, magasins); };
      const avant = etat.getSyncState().moteur;
      try {
        etat.setSyncState({ moteur: { etat: () => moteurL4({ progressionFichiers: { sens: 'reception', n: 1, total: 9 } }) } });
        await SR.renderSettings({}, {}, { settings: await repo.getSettings(), sync: { auth: { available: true, reason: null }, user: { id: 'u1', email: 'x@exemple.invalid' }, guard: { ok: true } } }, {});
      } finally { etat.setSyncState({ moteur: avant }); delete db.getSnapshot; }
      eq(lus, [], 'renderSettings (ronde 1) : sans file_error, aucun getSnapshot — le snapshot ne sert qu’à nommer un fichier refusé ; Réglages se redessine pendant une passe et relirait sinon `files` entier à chaque fois (S-12) — mutant : snapshot lu à chaque rendu');
      await etat.relectureEnCours();
    });
    await etat.relireReglages(); // la base de l'app reprend la main
  });

  await run('vague finale — Réglages : une ligne files en quarantaine ou en conflit est nommée par nomFichier (I-G8)', async () => {
    const { syncSectionModel } = await import('../src/ui/settings.js');
    const sha = H('3');
    const snapshot = { source_pages: [{ id: 'pgN', document_id: 'docN', sha256: sha, printed_page: 12, updated_at: DATE }], source_documents: [{ id: 'docN', edition_id: 'edN', updated_at: DATE }], book_editions: [{ id: 'edN', book_id: 'bkN', updated_at: DATE }], books: [{ id: 'bkN', title: 'Le livre', updated_at: DATE }], recipes: [], imports: [], files: [] };
    const base = { available: true, user: { id: 'u1', email: 'x@exemple.invalid' }, guard: { ok: true }, pending: 0,
      moteur: { enCours: false, phase: null, progression: null, dernierEchange: null, aEnvoyer: 0, enQuarantaine: 1, conflits: 1, pause: null, attenteConnexion: false, horloge: null, derniereErreur: null } };
    const avec = syncSectionModel({ ...base, quarantaine: [{ seq: 1, store: 'files', id: sha, last_error: 'taille' }], conflits: [{ id: 'files:' + sha, store: 'files', record_id: sha, local: null, server: null, at: DATE, kind: 'donnees' }], snapshot });
    const sans = syncSectionModel({ ...base, quarantaine: [{ seq: 1, store: 'files', id: sha, last_error: 'taille' }], snapshot: null });
    eq([avec.quarantaine[0].libelle, avec.conflits[0].libelle, sans.quarantaine[0].libelle.startsWith('files · ')], ['Page 12 · Le livre', 'Page 12 · Le livre', true],
      'réglages (vague finale) : quarantaine et conflit d’une ligne files nommés « Page 12 · Le livre », jamais l’empreinte (mutant : libellé store · id) ; sans snapshot, la forme bornée de L3 reste');
  });

  await run('ronde 2 — Réglages : la page entière nomme une ligne files en quarantaine sans file_error (câblage de renderSettings, I-G8)', async () => {
    const etat = await import('../src/ui/state.js');
    const sha = H('3');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: {
        books: [{ id: 'bkQ', title: 'Le livre', updated_at: DATE }],
        book_editions: [{ id: 'edQ', book_id: 'bkQ', updated_at: DATE }],
        source_documents: [{ id: 'docQ', edition_id: 'edQ', updated_at: DATE }],
        source_pages: [{ id: 'pgQ', document_id: 'docQ', sha256: sha, printed_page: 12, updated_at: DATE }],
        outbox: [{ user_id: 'u1', store: 'files', id: sha, op: 'put', updated_at: DATE, tries: 1, last_error: 'taille', quarantined_at: DATE }],
      }, origin: 'device' });
      const avant = etat.getSyncState().moteur;
      let page = null;
      try {
        etat.setSyncState({ moteur: { etat: () => moteurL4({ enQuarantaine: 1 }) } });
        page = await SR.renderSettings({}, {}, { settings: await repo.getSettings(), sync: { auth: { available: true, reason: null }, user: { id: 'u1', email: 'x@exemple.invalid' }, guard: { ok: true } } }, {});
      } finally { etat.setSyncState({ moteur: avant }); }
      const lignes = [...page.querySelectorAll('[data-quarantaine]')].map((n) => n.querySelector('p')?.textContent);
      eq([(await F.lireErreursFichiers(db)).size, lignes, page.textContent.includes(sha.slice(0, 12))], [0, ['Page 12 · Le livre — Fiche trop grosse (plus de 512 Ko)'], false],
        'renderSettings (ronde 2, R-G-24) : sans AUCUNE file_error, une entrée d’outbox files en quarantaine fait lire le snapshot — la page affiche « Page 12 · Le livre », jamais l’empreinte (mutant M12 : snapshot lu seulement s’il existe une file_error → « files · 333333333333 »)');
      await etat.relectureEnCours();
    });
    await etat.relireReglages(); // la base de l'app reprend la main
  });

  await run('ronde 2 — Réglages : « Données » avec et sans compte, « reception:taille » sans Réessayer, libellés sans contrôle bidi coupés par points de code', async () => {
    const etat = await import('../src/ui/state.js');
    // R-G-28 bis : la phrase de la section « Données » rendue par la page entière, avec et sans sync.user.
    const phraseDonnees = async (sync) => {
      let page = null;
      await withRepo(async (repo) => {
        page = await SR.renderSettings({}, {}, { settings: await repo.getSettings(), sync }, {});
        await etat.relectureEnCours();
      });
      const sec = [...page.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Données sur cet appareil');
      return [...(sec?.querySelectorAll('p.muted') || [])].map((p) => p.textContent).pop() ?? null;
    };
    eq([await phraseDonnees({ user: { id: 'u1', email: 'x@exemple.invalid' } }), await phraseDonnees({})],
      ['Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur, sauf les photos et documents pas encore envoyés (une photo envoyée en qualité réduite n’y garde que sa copie réduite).', 'Ces données ne sont que sur cet appareil : fais une sauvegarde avant de les effacer.'],
      'Réglages (ronde 2, R-G-28 bis) : la section « Données » dit, avec un compte, la perte des photos ET documents pas encore envoyés et la copie réduite ; sans compte, la phrase d’avant (mutants : ancienne phrase de la vague ; une seule phrase)');
    await etat.relireReglages();
    // R-G-31 : un refus « taille » à la réception ne s'offre pas « Réessayer » (le serveur rendrait les mêmes octets) ; « empreinte » le garde.
    const bT = rendre(modele(moteurL4(), { fichiersErreurs: [{ sha256: H('1'), motif: 'taille', sens: 'reception' }, { sha256: H('3'), motif: 'empreinte', sens: 'reception' }], snapshot: snapNoms }), { reessayerFichier: () => {} });
    eq([...bT.querySelectorAll('[data-fichier]')].map((l) => [l.querySelector('p').textContent, l.querySelectorAll('button').length]),
      [['Page 12 · Mon livre — Fichier illisible reçu du serveur.', 0], ['Couverture · Mon livre — Fichier illisible reçu du serveur.', 1]],
      'Réglages (ronde 2, R-G-31) : « reception:taille » sans « Réessayer » (une copie de la taille de l’original, ou des octets d’une autre taille que déclarée : le même objet reviendrait) ; « reception:empreinte » le garde (mutant : sansReessai sans reception:taille)');
    // Libellés (ronde 2, revue sécurité) : nomFichier retire les contrôles bidi des textes reçus ; le libellé est coupé par POINTS DE CODE.
    const cp = (n) => String.fromCodePoint(n);
    const aBidi = (s) => [...String(s)].some((c) => { const p = c.codePointAt(0); return (p >= 0x202a && p <= 0x202e) || (p >= 0x2066 && p <= 0x2069); });
    const snapBidi = { books: [{ id: 'b1', title: 'Livre ' + cp(0x202e) + 'gpj.exe' + cp(0x202c) }], book_editions: [{ id: 'e1', book_id: 'b1', cover_sha256: H('3') }],
      source_documents: [{ id: 'd1', edition_id: 'e1', sha256: H('1') }, { id: 'd2', sha256: H('2'), original_filename: cp(0x2066) + 'menu' + cp(0x2069) + '.pdf' }],
      source_pages: [{ id: 'p1', document_id: 'd1', sha256: H('1'), printed_page: 12 }], recipes: [{ id: 'r1', original_title: cp(0x202b) + 'Tarte' + cp(0x202a), photo_sha256: H('4') }], imports: [], files: [] };
    const noms = [H('1'), H('2'), H('3'), H('4')].map((s) => F.nomFichier(s, snapBidi));
    const texteBidi = modele(moteurL4(), { fichiersErreurs: [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }], snapshot: snapBidi }).erreursFichiers[0]?.texte;
    eq([noms, noms.some(aBidi), texteBidi, aBidi(texteBidi)], [['Page 12 · Livre gpj.exe', 'menu.pdf', 'Couverture · Livre gpj.exe', 'Photo du plat · Tarte'], false, 'Page 12 · Livre gpj.exe — Ce fichier n’est plus sur le serveur.', false],
      'nomFichier (ronde 2) : titre de livre, nom de fichier et titre de recette reçus perdent leurs contrôles bidi (U+202A-202E, U+2066-2069) — un U+202E ne retourne plus le motif dans Réglages (mutant : retrait retiré)');
    const pain = cp(0x1f35e);
    const snapLong = { ...snapBidi, books: [{ id: 'b1', title: 'T'.repeat(29) + pain + 'fin' }] };
    const texteLong = modele(moteurL4(), { fichiersErreurs: [{ sha256: H('1'), motif: 'introuvable', sens: 'reception' }], snapshot: snapLong }).erreursFichiers[0]?.texte;
    const bienForme = (s) => new TextDecoder().decode(new TextEncoder().encode(String(s))) === String(s);
    eq([texteLong, bienForme(texteLong)], ['Page 12 · ' + 'T'.repeat(29) + pain + '… — Ce fichier n’est plus sur le serveur.', true],
      'Réglages (ronde 2) : un libellé est coupé à 40 POINTS DE CODE — une paire de substitution en bord de coupe reste entière, jamais un demi-caractère (mutant : coupe par unités UTF-16)');
  });

  // === Tâche 6 — écrans (§ 4.2-4.5)
  const K = await import('../src/ui/components.js');
  // Une image `loading: 'lazy'` détachée ou dans une scène cachée ne se charge jamais (Chrome) : passée en `eager` avant d'attendre (rejeu, mesuré).
  const finDesImages = (racine) => Promise.all([...racine.querySelectorAll('img')].map((i) => { if (i.complete) return null; i.loading = 'eager'; return new Promise((r) => { i.onload = r; i.onerror = r; }); }));
  const pngMinuscule = async () => { const toile = new OffscreenCanvas(2, 2); toile.getContext('2d').fillRect(0, 0, 2, 2); return toile.convertToBlob({ type: 'image/png' }); };

  await run('vignettePage : les états d’une page (§ 4.3)', async () => {
    const page = { id: 'p1', sha256: H('7') };
    const distant = { sha256: H('7'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    const vus = [];
    const telecharger = async (sha, o) => { vus.push([sha, !!o?.reessayer]); };
    const img = K.vignettePage(page, { ...distant, mime: 'image/png', blob: await pngMinuscule() }, { connecte: true, uid: 'u1', telecharger });
    const etat = (f, o) => K.vignettePage(page, f, { uid: 'u1', telecharger, ...o });
    const v = [
      etat(distant, { connecte: true }),
      etat(distant, { connecte: false }),
      etat({ ...distant, remote: null }, { connecte: true }),
      etat({ ...distant, remote: R({ owner: 'u2' }) }, { connecte: true }),
      etat(undefined, { connecte: true }),
      etat(distant, { connecte: true, erreurs: new Set([H('7')]) }),
    ];
    const decrire = (n) => [n.tagName, n.dataset.etat, n.querySelector('small')?.textContent ?? null, [...n.querySelectorAll('button')].map((b) => b.textContent)];
    eq([img.tagName, ...v.map(decrire)], ['IMG',
      ['FIGURE', 'distant', 'Pas encore sur cet appareil', ['Télécharger']],
      ['FIGURE', 'distant', 'Connecte-toi pour la télécharger', []],
      ['FIGURE', 'absent', 'Pas encore envoyée par l’appareil qui l’a prise', []],
      ['FIGURE', 'absent', 'Pas encore envoyée par l’appareil qui l’a prise', []],
      ['FIGURE', 'pas_recue', 'Pas encore reçue', []],
      ['FIGURE', 'erreur', 'Fichier illisible reçu du serveur.', ['Réessayer']]],
      'vignettePage : avec octets → <img> ; distante (compte : « Télécharger » ; sans compte : « Connecte-toi ») ; absente ; d’un autre compte → absente (R-G-2) ; sans ligne → « Pas encore reçue » ; erreur → « Réessayer »');
    ok(v.every((n) => n.classList.contains('fichier-absent')), 'vignettePage : figure.fichier-absent, le gabarit 110 × 140 des miniatures');
    v[0].querySelector('button').click(); v[5].querySelector('button').click();
    await new Promise((r) => setTimeout(r, 0));
    eq(vus, [[H('7'), false], [H('7'), true]], 'vignettePage : « Télécharger » et « Réessayer » appellent telecharger(sha256, { reessayer }) — sur une tape seulement (R-G-1)');
    if (!img.complete) { img.loading = 'eager'; await new Promise((r) => { img.onload = r; img.onerror = r; }); } // lazy détachée : jamais chargée sinon
    URL.revokeObjectURL(img.src);
  });

  await run('pdfFrame : conteneur tout de suite, cadre ou bouton à la résolution (§ 4.5, B-24)', async () => {
    await withRepo(async (repo, db) => {
      const pdf = octets('%PDF-1.4 cadre', 'application/pdf'); const shaPdf = await sha256Hex(pdf);
      await repo.putFile(shaPdf, pdf, { original_filename: 'c.pdf' });
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'application/pdf', size: 9, updated_at: DATE, remote: R({ mime: 'application/pdf' }) }] }, origin: 'remote' });
      const vus = [];
      const sans = K.pdfFrame({ sha256: H('7'), filename: 'x.pdf', connecte: true, uid: 'u1', telecharger: async (sha) => { vus.push(sha); } }); // ronde 1 : uid, l'état se lit (etatFichier)
      const avec = K.pdfFrame({ sha256: shaPdf, filename: 'c.pdf' });
      const immediat = [sans.classList.contains('stack'), sans.querySelector('iframe'), avec.querySelector('iframe')];
      for (let i = 0; i < 100 && !(sans.querySelector('button') && avec.querySelector('iframe')); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([immediat, sans.querySelector('iframe'), [...sans.querySelectorAll('button')].map((b) => b.textContent), sans.textContent.includes('Ce fichier n’est pas encore sur cet appareil.'), !!avec.querySelector('iframe.pdf[sandbox]'), [...avec.querySelectorAll('button')].map((b) => b.textContent)],
        [[true, null, null], null, ['Télécharger'], true, true, ['Télécharger le fichier']], 'pdfFrame : conteneur rendu de suite et vide ; sans octets → la phrase et « Télécharger », jamais un cadre vide ; avec octets → le cadre sandbox et « Télécharger le fichier » (mutant : cadre rendu avant la résolution)');
      const pdf2 = octets('%PDF-1.4 recu', 'application/pdf');
      const apres = K.pdfFrame({ sha256: H('7'), filename: 'x.pdf', connecte: true, uid: 'u1', telecharger: async (sha) => { vus.push(sha); await db.mutate({ puts: { files: [{ ...(await db.get('files', sha)), blob: pdf2 }] }, origin: 'remote' }); } });
      for (let i = 0; i < 100 && !apres.querySelector('button'); i += 1) await new Promise((r) => setTimeout(r, 10));
      apres.querySelector('button').click();
      for (let i = 0; i < 100 && !apres.querySelector('iframe'); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([vus, !!apres.querySelector('iframe.pdf[sandbox]')], [[H('7')], true], 'pdfFrame : « Télécharger » appelle telecharger(sha256), puis le cadre remplace le bouton');
    });
  });

  await run('fiche du livre : couverture distante, sans compte, absente, en erreur, échec dit (§ 4.2)', async () => {
    const { renderBook } = await import('../src/ui/book.js');
    await withRepo(async (repo, db) => {
      const toile = new OffscreenCanvas(4, 6); toile.getContext('2d').fillRect(0, 0, 4, 6);
      const jpeg = await toile.convertToBlob({ type: 'image/jpeg' }); const shaJ = await sha256Hex(jpeg);
      const eD = { id: 'eD', book_id: 'bD', year: 2020, cover_sha256: H('7') };
      const eA = { id: 'eA', book_id: 'bD', year: 2021, cover_sha256: H('8') };
      const eE = { id: 'eE', book_id: 'bD', year: 2022, cover_sha256: H('9') };
      const livre = { id: 'bD', title: 'Distant', author: 'A', cuisines: [] };
      await db.mutate({ puts: { files: [{ sha256: H('7'), mime: 'image/jpeg', size: jpeg.size, updated_at: DATE, remote: R({ sha256: shaJ, size: jpeg.size }) }, { sha256: H('8'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: null }, { sha256: H('9'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('c'), size: 5 }) }], sync_state: [{ key: 'user_id', value: 'u1' }, { key: 'file_error:' + H('9'), value: { motif: 'empreinte', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const appels = [];
      const moteur = { telecharger: async (shas) => { appels.push(shas); const l = await db.get('files', shas[0]); await db.mutate({ puts: { files: [{ ...l, blob: jpeg }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; }, onEtat: () => () => {} };
      const ctx = (sync) => ({ book_editions: [eD, eA, eE], recipes: [], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(), docsByRecipe: new Map(), scan_sessions: [], settings: {}, books: [livre], booksById: new Map([['bD', livre]]), editionsById: new Map([['eD', eD], ['eA', eA], ['eE', eE]]), editionLabel: () => livre.title, sync });
      const bloc = (n) => [...n.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Couverture');
      const textesBoutons = (n) => [...(bloc(n)?.querySelectorAll('button') || [])].map((b) => b.textContent);
      const sansCompte = await renderBook({ id: 'eD' }, {}, ctx({}));
      const absente = await renderBook({ id: 'eA' }, {}, ctx({ user: { id: 'u1' }, moteur }));
      eq([bloc(sansCompte)?.querySelector('small')?.textContent, textesBoutons(sansCompte).includes('Télécharger'), bloc(absente)?.querySelector('small')?.textContent, textesBoutons(absente).includes('Télécharger')],
        ['La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.', false, 'La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.', false], 'couverture : distante sans compte → « Connecte-toi … », aucun bouton ; absente → « … ne l’a pas encore envoyée »');
      // Erreur et échec (faux-vert de la rév. 1) : une couverture en file_error offre « Réessayer », qui passe par reessayerFichier ; un
      // téléchargement qui n'aboutit pas (recus: 0) se DIT (toast) et laisse la zone telle quelle. Joué AVANT le succès : il donne ses octets à H('7').
      const reessais = [];
      const moteurEchec = { telecharger: async (shas) => ({ recus: 0, erreurs: 1, erreur: null, shas }), reessayerFichier: async (sha) => { reessais.push(sha); return { recus: 0, erreurs: 1, erreur: null }; }, onEtat: () => () => {} };
      const toastDit = () => document.querySelector('.toast')?.textContent ?? null;
      const viderToast = () => { const n = document.querySelector('.toast'); if (n) n.textContent = ''; };
      viderToast();
      const enErreur = await renderBook({ id: 'eE' }, {}, ctx({ user: { id: 'u1' }, moteur: moteurEchec }));
      const zoneE = bloc(enErreur);
      eq([zoneE?.querySelector('small')?.textContent, textesBoutons(enErreur).includes('Réessayer'), textesBoutons(enErreur).includes('Télécharger')], ['Fichier illisible reçu du serveur.', true, false], 'couverture en erreur : la phrase et « Réessayer », jamais « Télécharger »');
      [...zoneE.querySelectorAll('button')].find((b) => b.textContent === 'Réessayer').click();
      for (let i = 0; i < 100 && toastDit() !== 'Le téléchargement n’a pas abouti.'; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([reessais, toastDit(), !!zoneE.querySelector('img')], [[H('9')], 'Le téléchargement n’a pas abouti.', false], 'couverture : « Réessayer » appelle moteur.reessayerFichier(sha) ; sans octets reçus, l’échec est DIT et aucune image n’apparaît (mutants : Réessayer → telecharger ; toast retiré)');
      viderToast();
      const echec = await renderBook({ id: 'eD' }, {}, ctx({ user: { id: 'u1' }, moteur: moteurEchec }));
      const zoneEchec = bloc(echec);
      [...zoneEchec.querySelectorAll('button')].find((b) => b.textContent === 'Télécharger').click();
      for (let i = 0; i < 100 && toastDit() !== 'Le téléchargement n’a pas abouti.'; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([toastDit(), zoneEchec.querySelector('small')?.textContent, textesBoutons(echec).includes('Télécharger'), !!zoneEchec.querySelector('img')], ['Le téléchargement n’a pas abouti.', 'La couverture n’est pas sur cet appareil.', true, false], 'couverture : un téléchargement qui rend recus: 0 se dit (toast), la zone reste la même avec « Télécharger » (mutant : échec muet)');
      const fiche = await renderBook({ id: 'eD' }, {}, ctx({ user: { id: 'u1' }, moteur }));
      const zone = bloc(fiche);
      eq([zone?.querySelector('small')?.textContent, textesBoutons(fiche).includes('Télécharger')], ['La couverture n’est pas sur cet appareil.', true], 'couverture distante avec compte : le texte existant et « Télécharger »');
      [...zone.querySelectorAll('button')].find((b) => b.textContent === 'Télécharger').click();
      for (let i = 0; i < 100 && !zone.querySelector('img'); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([appels, !!zone.querySelector('img'), zone.querySelector('small')], [[[H('7')]], true, null], 'couverture : « Télécharger » → moteur.telecharger([sha]) puis la zone se redessine avec l’image (invalidate + refresh pour la fiche entière)');
      await finDesImages(fiche);
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('séance de scan : vignettes et phrase abonnée (§ 4.3, F-21)', async () => {
    const { renderImport } = await import('../src/ui/import.js');
    await withRepo(async (repo, db) => {
      const photo = new Blob([await pngMinuscule()], { type: 'image/png' }); const s1 = await sha256Hex(photo);
      await repo.putFile(s1, photo, {});
      await db.mutate({ puts: { files: [{ ...(await db.get('files', s1)), remote: R({ sha256: s1, size: photo.size, mime: 'image/png' }) }, { sha256: H('2'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() }, { sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE }] }, origin: 'remote' });
      const pages = [{ id: 'q1', document_id: 'dq', sha256: s1, position: 1 }, { id: 'q2', document_id: 'dq', sha256: H('2'), position: 2 }, { id: 'q3', document_id: 'dq', sha256: H('3'), position: 3 }];
      const seance = { id: 'ss1', status: 'open', started_at: DATE, page_ids: ['q1', 'q2', 'q3'], document_ids: [] };
      const abonnes = new Set();
      const moteur = { onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); }, telecharger: async () => ({ recus: 0, erreurs: 0, erreur: null }) };
      const ctx = { scan_sessions: [seance], pagesById: new Map(pages.map((p) => [p.id, p])), source_documents: [], book_editions: [], booksById: new Map(), editionsById: new Map(), editionLabel: () => '', recipes: [], settings: {}, sync: { user: { id: 'u1' }, moteur } };
      const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
      try {
        const root = await renderImport({}, { session: 'ss1' }, ctx);
        scene.append(root);
        const phrase = () => root.querySelector('[data-role="phrase-seance"]')?.textContent;
        const etats = [...root.querySelectorAll('.thumbs .fichier-absent, .thumbs .photo-visible:not(:has(img))')].map((f) => f.dataset.etat || 'distant');
        const avant = phrase();
        await db.mutate({ puts: { files: [{ sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('3'), size: 5 }) }] }, origin: 'remote' });
        for (const fn of abonnes) fn({ enCours: false });
        for (let i = 0; i < 100 && phrase() === avant; i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([avant, phrase(), etats, root.querySelectorAll('.thumbs img').length], ['Photos : 2/3 sauvegardées sur le serveur', 'Photos : 3/3 sauvegardées sur le serveur', ['distant', 'absent'], 1],
          'séance : « {n}/{m} photos … envoyées au serveur » compte les remote de CE compte — la page distante aussi, ses octets sont au serveur (I5 ; mutant : compte sur blob → 1/3) — et se redessine sur onEtat SANS re-rendu de la route (mutant : phrase non abonnée) ; vignettes : image, distante, absente');
        await finDesImages(root);
      } finally { scene.remove(); }
      const sansCompte = await renderImport({}, { session: 'ss1' }, { ...ctx, sync: {} });
      eq(sansCompte.querySelector('[data-role="phrase-seance"]')?.textContent, 'Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages', 'séance sans compte : la phrase de la sauvegarde (« Aucune synchronisation serveur configurée » était faux dès qu’un compte existe)');
      await finDesImages(sansCompte);
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('fiche recette : « Original » groupé et photo du plat distante (§ 4.4)', async () => {
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { INGREDIENTS } = await import('../src/model/seed.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: [{ sha256: H('1'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('a'), size: 5 }) }, { sha256: H('2'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('b'), size: 5 }) }, { sha256: H('3'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R({ sha256: H('c'), size: 5 }) }] }, origin: 'remote' });
      const pages = [{ id: 'o1', sha256: H('1'), printed_page: 10 }, { id: 'o2', sha256: H('2'), printed_page: 11 }];
      const recette = { id: 'rO', edition_id: null, original_title: 'Compote', availability: 'available', verification_state: 'verified', source_page_ids: ['o1', 'o2'], current_version_id: 'vO', photo_sha256: H('3'), tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE };
      const version = { id: 'vO', recipe_id: 'rO', kind: 'extraction', servings: 2, ingredients: [], steps: [{ id: 's1', position: 1, text: 'Cuire.' }], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: ['o1', 'o2'], generated_by: 'manual', model: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE };
      const appels = [];
      const moteur = { telecharger: async (shas) => { appels.push(shas); return { recus: 0, erreurs: 0, erreur: null }; }, onEtat: () => () => {} };
      const ctx = { recipes: [recette], recipesById: new Map([['rO', recette]]), recipe_versions: [version], versionsByRecipe: new Map([['rO', [version]]]), versionsById: new Map([['vO', version]]), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(pages.map((p) => [p.id, p])), imports: [], dishesById: new Map(), dishes: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: new Map(INGREDIENTS.map((i) => [i.id, i])), source_documents: [], source_pages: pages, scan_sessions: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: { user: { id: 'u1' }, moteur } };
      const page = await renderRecipe({ id: 'rO' }, {}, ctx);
      const original = [...page.querySelectorAll('section.plain')].find((s) => s.querySelector('h2')?.textContent === 'Original');
      const groupe = [...(original?.querySelectorAll('button') || [])].find((b) => b.textContent === 'Télécharger les 2 pages');
      eq([!!groupe, original?.querySelectorAll('.photo-visible').length, [...(page.querySelector('[data-role="photo-plat"]')?.querySelectorAll('button') || [])].map((b) => b.textContent)], [true, 2, ['Télécharger']],
        'fiche recette : deux pages distantes → deux vignettes et « Télécharger les 2 pages » sous le titre ; la photo du plat distante suit la règle de la couverture (« Télécharger »)');
      groupe.click();
      for (let i = 0; i < 100 && !appels.length; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq(appels[0], [H('1'), H('2')], 'fiche recette : le bouton groupé passe les deux clés à telecharger, dans l’ordre des pages');
      // F-9 sur la photo du plat (rév. 3, P1) : la fixture SÉPARE la garde de photoDuPlat du retypage de displayUrl. Sous une ligne image/heic
      // (rév. 2), le mutant « photoDuPlat garde safeDisplayType(fichier.mime) » passait la garde (heic est une image de la liste) et displayUrl
      // retypait quand même en image/jpeg : sortie identique, mutant vivant (rejoué sous Node). Ici la ligne dit application/pdf (dans la liste,
      // PAS une image) et les octets sont un vrai JPEG : le vrai code (typeAffichage, le type du blob gagne) montre la photo, le mutant ne montre
      // rien. Vert à l'écriture (la règle est posée en tâche 1) ; le mutant le rougit (rejoué à la clôture). Le Blob affiché se lit par l'espion
      // de URL.createObjectURL, jamais par fetch (CSP).
      const toileP = new OffscreenCanvas(2, 2); toileP.getContext('2d').fillRect(0, 0, 2, 2);
      const jpegP = await toileP.convertToBlob({ type: 'image/jpeg' }); // un vrai JPEG, décodable, typé image/jpeg
      await db.mutate({ puts: { files: [{ sha256: H('5'), mime: 'application/pdf', size: 999, blob: jpegP, syncable: true, created_at: DATE, updated_at: DATE }] }, origin: 'remote' });
      const recetteP = { ...recette, id: 'rP', photo_sha256: H('5'), source_page_ids: [], current_version_id: 'vP' };
      const versionP = { ...version, id: 'vP', recipe_id: 'rP', provenance: { ...version.provenance, source_page_ids: [] } };
      const ctxP = { ...ctx, recipes: [recetteP], recipesById: new Map([['rP', recetteP]]), recipe_versions: [versionP], versionsByRecipe: new Map([['rP', [versionP]]]), versionsById: new Map([['vP', versionP]]) };
      const remis = []; const vraiCreer = URL.createObjectURL;
      URL.createObjectURL = (b) => { remis.push(b); return vraiCreer.call(URL, b); };
      let pageP = null;
      try { pageP = await renderRecipe({ id: 'rP' }, {}, ctxP); } finally { URL.createObjectURL = vraiCreer; }
      eq([!!pageP.querySelector('[data-role="photo-plat"] img'), remis.some((b) => b.type === 'image/jpeg'), remis.some((b) => b.type === 'application/pdf')], [true, true, false], 'photo du plat (F-9, P1) : des octets JPEG sous une ligne application/pdf s’affichent, le Blob affiché est image/jpeg (mutant : safeDisplayType(fichier.mime) gardé dans photoDuPlat → application/pdf n’est pas une image → aucune photo, rouge)');
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('statique tâche 6', async () => {
    const sw = await lire('../sw.js');
    const v = /VERSION = 'cuisine-os-v0\.24\.0-(\d+)'/.exec(sw); // ronde 1 : le libellé dit ce que le test vérifie (le -\d+ seul acceptait -1)
    ok(!!v && Number(v[1]) >= 1, 'sw.js : VERSION 0.24.0-N avec N ≥ 1 (lot UI-1 ; le seuil N ≥ 6 de la clôture des écrans du lot G valait sous 0.11.0)');
    const { EN } = await import('../src/i18n/en.js');
    const neuves = ['Page', 'Télécharger', 'Télécharger les {n} pages', 'Téléchargement…', 'Le téléchargement n’a pas abouti.', 'Pas encore sur cet appareil', 'Connecte-toi pour la télécharger', 'Pas encore envoyée par l’appareil qui l’a prise', 'Pas encore reçue', 'La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.', 'La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.', 'Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages', 'Photos : {n}/{m} sauvegardées sur le serveur'];
    eq(neuves.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'en.js : chaque chaîne neuve des écrans a sa traduction (dont « Page », l’alt de vignettePage)');
    eq(neuves.filter((k) => /supabase/i.test(k) || /supabase/i.test(EN[k] || '')), [], 'I-G8 : aucune chaîne neuve des écrans ne nomme le fournisseur de stockage, ni en français ni en anglais');
  });

  // Tâche 6 — épingles hors brief (à ratifier) : des chemins que le brief prescrit et que ses tests n'exercent pas (survivants de la série 1 des mutants,
  // rejoués sur une copie). Chaque assertion nomme le mutant qu'elle tue.
  await run('écrans (épingles) : bouton groupé à partir de deux pages, geste par le moteur et échec dit, compte sans moteur, libellé pendant', async () => {
    const rien = async () => {};
    const groupe = (d, o) => K.boutonTelechargerPages(d, o);
    eq([groupe([H('1')], { connecte: true, telecharger: rien }), groupe([H('1'), H('2')], { connecte: false, telecharger: rien }), groupe([H('1'), H('2')], { connecte: true }), groupe([H('1'), H('2')], { connecte: true, telecharger: rien })?.querySelector('button')?.textContent],
      [null, null, null, 'Télécharger les 2 pages'], 'boutonTelechargerPages (§ 4.3) : rien pour UNE page, sans compte ou sans geste ; « Télécharger les 2 pages » à partir de deux (mutant : seuil à une page)');
    const appels = []; const redessins = []; const dits = [];
    // Ronde 1 : le succès est le FAIT relu (les octets de chaque clé demandée sont ici), plus le compte `recus` du moteur — un fichier déjà arrivé
    // (« Télécharger toutes les photos et fichiers » en fond) rend recus: 0 et n'est pas un échec. Le moteur factice écrit donc les octets dans une base jetable.
    await withRepo(async (repo, db) => {
      const ecrire = (shas) => db.mutate({ puts: { files: shas.map((s) => ({ sha256: s, mime: 'image/jpeg', size: 1, blob: octets('x'), updated_at: DATE })) }, origin: 'remote' });
      const moteur = { telecharger: async (l) => { appels.push(['telecharger', l]); await ecrire(l); return { recus: l.length, erreurs: 0, erreur: null }; }, reessayerFichier: async (s) => { appels.push(['reessayerFichier', s]); return { recus: 0, erreurs: 1, erreur: null }; } };
      const geste = K.gesteTelechargement({ moteur, redessiner: async (l) => { redessins.push(l); }, dire: (x) => dits.push(x) });
      await geste([H('1'), H('2')]);
      await geste(H('3'), { reessayer: true });
      await K.gesteTelechargement({ moteur: { telecharger: async () => { throw new Error('réseau'); } }, redessiner: async (l) => { redessins.push(l); }, dire: (x) => dits.push(x) })(H('4'));
      await K.gesteTelechargement({ moteur: null, dire: (x) => dits.push(x) })(H('5'));
      await ecrire([H('6')]);
      await K.gesteTelechargement({ moteur: { telecharger: async () => ({ recus: 0, erreurs: 0, erreur: null }) }, dire: (x) => dits.push(x) })(H('6'));
    });
    eq([appels, redessins, dits], [[['telecharger', [H('1'), H('2')]], ['reessayerFichier', H('3')]], [[H('1'), H('2')], [H('3')], [H('4')]], ['Le téléchargement n’a pas abouti.', 'Le téléchargement n’a pas abouti.', 'Le téléchargement n’a pas abouti.']],
      'gesteTelechargement (R-G-1, § 4.2) : « Télécharger » → moteur.telecharger(liste), « Réessayer » → moteur.reessayerFichier(sha), puis le redessin de ce qui a été demandé ; sans octets ici après le geste, une levée ou sans moteur, l’échec est DIT ; un succès ne dit rien, ni des octets déjà arrivés quand le moteur rend recus: 0 (mutants : échec muet ; « Réessayer » par telecharger ; ronde 1 : échec décidé par recus)');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { sync_state: [{ key: 'user_id', value: 'u9' }, { key: 'file_error:' + H('6'), value: { motif: 'empreinte', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const m = { telecharger: rien, onEtat: () => () => {} };
      const sansMoteur = await K.contexteFichiers({ sync: { user: { id: 'u1' } } });
      const avec = await K.contexteFichiers({ sync: { user: { id: 'u1' }, moteur: m } });
      const connu = await K.contexteFichiers({ sync: { moteur: m } });
      eq([[sansMoteur.connecte, sansMoteur.uid, sansMoteur.moteur], [avec.connecte, avec.uid, avec.moteur === m, [...avec.erreurs.keys()]], [connu.connecte, connu.uid]],
        [[false, 'u1', null], [true, 'u1', true, [H('6')]], [false, 'u9']], 'contexteFichiers : « connecté » exige le compte ET le moteur (seul le moteur télécharge, R53) ; sans session, le compte que l’appareil a connu (sync_state.user_id) ; les file_error lues (mutant : connecte sans moteur)');
    });
    const { renderZoneCouverture } = await import('../src/ui/livre-ajout.js');
    const boutons = (etat) => [...renderZoneCouverture({ sha256: H('7'), ...etat }, {}).querySelectorAll('button')].map((b) => [b.textContent, b.disabled]);
    // Ronde 1 : pendant un téléchargement, seul le premier bouton est épinglé — fermer aussi Photographier / Choisir / Retirer resterait légitime.
    eq([boutons({ telechargeable: true }), boutons({ telechargeable: true, telechargement: true }).slice(0, 1), boutons({ reessayable: true, telechargement: true }).slice(0, 1)],
      [[['Télécharger', false], ['Photographier', false], ['Choisir une image', false], ['Retirer', false]], [['Téléchargement…', true]], [['Réessayer', true]]],
      'renderZoneCouverture (§ 4.2) : « Télécharger » en tête ; pendant, « Téléchargement… » éteint ; « Réessayer » éteint pendant (mutant : libellé jamais changé)');
  });

  await run('écrans (épingles) : miniatures de la fiche du livre, rendu entier après la couverture, cadre PDF de la séance, pages d’index, erreurs relues', async () => {
    const { renderBook } = await import('../src/ui/book.js');
    const { renderImport } = await import('../src/ui/import.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { INGREDIENTS } = await import('../src/model/seed.js');
    await withRepo(async (repo, db) => {
      const jpeg = await pngMinuscule();
      await db.mutate({ puts: { files: [1, 2, 3].map((i) => ({ sha256: H(String(i)), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() })).concat([{ sha256: H('4'), mime: 'application/pdf', size: 9, updated_at: DATE, remote: R({ mime: 'application/pdf' }) }]) }, origin: 'remote' });
      const appels = [];
      const moteur = { onEtat: () => () => {}, telecharger: async (shas) => {
        appels.push(shas);
        if (shas[0] === H('3')) { await db.mutate({ puts: { files: [{ ...(await db.get('files', H('3'))), blob: jpeg }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; }
        if (shas[0] === H('4')) { await db.mutate({ puts: { files: [{ ...(await db.get('files', H('4'))), blob: octets('%PDF-1.4 x', 'application/pdf') }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; }
        return { recus: 0, erreurs: 0, erreur: null };
      } };
      // Fiche du livre : deux pages distantes (p. 2 puis p. 1 dans la base) et une couverture distante.
      const ed = { id: 'eP', book_id: 'bP', year: 2020, cover_sha256: H('3') };
      const livre = { id: 'bP', title: 'Pages', author: 'A', cuisines: [] };
      const doc = { id: 'dP', edition_id: 'eP', source_type: 'photo', sha256: H('1'), original_filename: 'a.jpg' };
      const pages = [{ id: 'pP1', edition_id: 'eP', document_id: 'dP', sha256: H('1'), printed_page: 2 }, { id: 'pP2', edition_id: 'eP', document_id: 'dP', sha256: H('2'), printed_page: 1 }];
      const ctxLivre = { book_editions: [ed], recipes: [], recipe_versions: [], source_documents: [doc], source_pages: pages, rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(), docsByRecipe: new Map(), scan_sessions: [], settings: {}, books: [livre], booksById: new Map([['bP', livre]]), editionsById: new Map([['eP', ed]]), editionLabel: () => livre.title, sync: { user: { id: 'u1' }, moteur } };
      let rendus = 0;
      const compter = () => { rendus += 1; };
      window.addEventListener('cuisineos:refresh', compter);
      try {
        const fiche = await renderBook({ id: 'eP' }, {}, ctxLivre);
        const sources = [...fiche.querySelectorAll('section.plain')].find((s) => s.querySelector('h2')?.textContent === 'Pages et fichiers sources');
        const groupe = [...(sources?.querySelectorAll('button') || [])].find((b) => b.textContent === 'Télécharger les 2 pages');
        eq([[...(sources?.querySelectorAll('.thumbs .fichier-absent, .thumbs .photo-visible:not(:has(img))') || [])].map((f) => f.dataset.etat || 'distant'), !!groupe], [['distant', 'distant'], true], 'fiche du livre (§ 4.3) : « Pages et fichiers sources » rend chaque page par vignettePage (distante) et offre « Télécharger les 2 pages » (mutant : miniatures sans vignettePage)');
        groupe.click();
        for (let i = 0; i < 100 && appels.length < 1; i += 1) await new Promise((r) => setTimeout(r, 10));
        const couv = [...fiche.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Couverture');
        [...couv.querySelectorAll('button')].find((b) => b.textContent === 'Télécharger').click();
        for (let i = 0; i < 100 && !couv.querySelector('img'); i += 1) await new Promise((r) => setTimeout(r, 10));
        eq([appels, !!couv.querySelector('img'), rendus], [[[H('2'), H('1')], [H('3')]], true, 1], 'fiche du livre : le bouton groupé suit l’ordre AFFICHÉ (p. 1 puis p. 2) sans rendre la route ; une couverture reçue rend la fiche entière UNE fois (refresh, § 4.2 : l’en-tête porte bookCover) — mutant : refresh retiré');
        await finDesImages(fiche);
      } finally { window.removeEventListener('cuisineos:refresh', compter); }
      // Séance : le cadre PDF d'un document distant offre « Télécharger », par le moteur (§ 4.5).
      const seance = { id: 'sP', status: 'open', started_at: DATE, page_ids: [], document_ids: ['dq'] };
      const ctxSeance = { scan_sessions: [seance], pagesById: new Map(), source_documents: [{ id: 'dq', source_type: 'pdf', sha256: H('4'), original_filename: 'm.pdf' }], book_editions: [], booksById: new Map(), editionsById: new Map(), editionLabel: () => '', recipes: [], settings: {}, sync: { user: { id: 'u1' }, moteur } };
      const vue = await renderImport({}, { session: 'sP' }, ctxSeance);
      const fichiers = [...vue.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Fichiers');
      const boutonTele = () => [...(fichiers?.querySelectorAll('button') || [])].find((x) => x.textContent === 'Télécharger');
      for (let i = 0; i < 100 && !boutonTele(); i += 1) await new Promise((r) => setTimeout(r, 10));
      const tele = boutonTele();
      tele?.click();
      for (let i = 0; i < 100 && !fichiers?.querySelector('iframe.pdf'); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([!!tele, appels.at(-1), !!fichiers?.querySelector('iframe.pdf[sandbox]')], [true, [H('4')], true], 'séance (§ 4.5) : le cadre PDF d’un document distant offre « Télécharger » avec un compte, par moteur.telecharger, puis le cadre remplace le bouton (mutant : pdfFrame de la séance sans telecharger)');
      // Fiche d'une référence d'index : ses pages par vignettePage, et le bouton groupé (§ 4.4).
      const ref = { id: 'rR', edition_id: null, original_title: 'Repérée', availability: 'reference_only', source_page_ids: ['pP1', 'pP2'], tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE };
      const ctxRef = { recipes: [ref], recipesById: new Map([['rR', ref]]), recipe_versions: [], versionsByRecipe: new Map(), versionsById: new Map(), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(pages.map((p) => [p.id, p])), imports: [], dishesById: new Map(), dishes: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: new Map(INGREDIENTS.map((i) => [i.id, i])), source_documents: [], source_pages: pages, scan_sessions: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: { user: { id: 'u1' }, moteur } };
      const pageRef = await renderRecipe({ id: 'rR' }, {}, ctxRef);
      const index = [...pageRef.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Pages d’index');
      eq([index?.querySelectorAll('.thumbs .photo-visible').length, [...(index?.querySelectorAll('button') || [])].map((b) => b.textContent).includes('Télécharger les 2 pages')], [2, true], 'référence d’index (§ 4.4) : « Pages d’index » rend chaque page par vignettePage et offre « Télécharger les 2 pages » (mutant : pages d’index sans vignettes)');
      // vignettesDePages : après un téléchargement qui pose un file_error, la place se redessine EN ERREUR (« Réessayer ») — les erreurs sont relues.
      const ctxF = { connecte: true, uid: 'u1', erreurs: new Set(), moteur: { telecharger: async () => {
        await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + H('1'), value: { motif: 'empreinte', sens: 'reception', at: DATE } }] }, origin: 'device' });
        return { recus: 0, erreurs: 1, erreur: null };
      } } };
      const v = await K.vignettesDePages([pages[0]], ctxF);
      v.places.get('pP1').querySelector('button').click();
      for (let i = 0; i < 100 && !v.places.get('pP1').textContent.includes('Le téléchargement de la photo a échoué.'); i += 1) await new Promise((r) => setTimeout(r, 10));
      eq([v.places.get('pP1').textContent.includes('Le téléchargement de la photo a échoué.'), [...v.places.get('pP1').querySelectorAll('button')].map((b) => b.textContent)], [true, ['Réessayer']], 'vignettesDePages : un téléchargement qui pose un file_error redessine la page en erreur, avec « Réessayer » (mutant : erreurs non relues)');
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  // === Tâche 6, ronde 1 — constats de la revue adverse. Chaque assertion nomme le constat ou le mutant qu'elle tue (rejoués sur une copie).
  const { INGREDIENTS: INGR_R1 } = await import('../src/model/seed.js');
  const ctxRecetteR1 = (recettes, versions, pages, sync) => ({ recipes: recettes, recipesById: new Map(recettes.map((r) => [r.id, r])), recipe_versions: versions, versionsByRecipe: new Map(recettes.map((r) => [r.id, versions.filter((v) => v.recipe_id === r.id)])), versionsById: new Map(versions.map((v) => [v.id, v])), editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map(pages.map((p) => [p.id, p])), imports: [], dishesById: new Map(), dishes: [], cook_history: [], dish_recipe_links: [], recipe_translations: [], ingredients: INGR_R1, ingredientsById: new Map(INGR_R1.map((i) => [i.id, i])), source_documents: [], source_pages: pages, scan_sessions: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync });
  const recetteR1 = (id, { pageIds = [], photo = null } = {}) => ({
    recette: { id, edition_id: null, original_title: 'Recette ' + id, availability: 'available', verification_state: 'verified', source_page_ids: pageIds, current_version_id: 'v' + id, photo_sha256: photo, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE },
    version: { id: 'v' + id, recipe_id: id, kind: 'extraction', servings: 2, ingredients: [], steps: [{ id: 's1', position: 1, text: 'Cuire.' }], constraints: {}, changes: '', notes: '', provenance: { source_page_ids: pageIds, generated_by: 'manual', model: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE },
  });
  const toastR1 = () => document.querySelector('.toast')?.textContent ?? null;
  const viderToastR1 = () => { const n = document.querySelector('.toast'); if (n) n.textContent = ''; };
  const ECHEC_R1 = 'Le téléchargement n’a pas abouti.';

  await run('ronde 1 : pdfFrame dit l’état du fichier et n’offre que le geste qui a un sens (§ 4.5, § 4.10)', async () => {
    await withRepo(async (repo, db) => {
      const ligne = (c, remote) => ({ sha256: H(c), mime: 'application/pdf', size: 9, updated_at: DATE, remote });
      await db.mutate({ puts: { files: [ligne('1', null), ligne('2', R({ mime: 'application/pdf' })), ligne('3', R({ mime: 'application/pdf', owner: 'u2' })), ligne('4', R({ mime: 'application/pdf' }))],
        sync_state: [{ key: 'file_error:' + H('4'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const vus = [];
      const telecharger = async (sha, o) => { vus.push([sha, !!o?.reessayer]); };
      const cadre = (c, connecte = true) => K.pdfFrame({ sha256: H(c), filename: 'x.pdf', connecte, uid: 'u1', telecharger });
      const cadres = [cadre('1'), cadre('2', false), cadre('3'), cadre('5'), cadre('4')];
      await jusqua(() => cadres.every((c) => c.querySelector('p')));
      const decrire = (c) => [[...c.querySelectorAll('small')].map((s) => s.textContent), [...c.querySelectorAll('button')].map((b) => b.textContent), !!c.querySelector('iframe'), c.textContent.includes('Ce fichier n’est pas encore sur cet appareil.')];
      eq(cadres.map(decrire), [
        [['Pas encore envoyée par l’appareil qui l’a prise'], [], false, true],
        [['Connecte-toi pour la télécharger'], [], false, true],
        [['Pas encore envoyée par l’appareil qui l’a prise'], [], false, true],
        [['Pas encore reçue'], [], false, true],
        [['Ce fichier n’est plus sur le serveur.'], ['Réessayer'], false, true]],
      'pdfFrame (ronde 1, § 4.10) : la phrase de repli, puis l’état — remote nul → « Pas encore envoyée … » sans geste (une tape y posait un faux file_error « forme ») ; sans compte → « Connecte-toi … » sans geste (mutant : garde `connecte` retirée) ; remote d’un autre compte → absente ; sans ligne → « Pas encore reçue » ; en erreur → la phrase de SON motif et « Réessayer » (mutants : etatFichier non lu ; motif jeté → « illisible » pour un 404)');
      // L'appelant qui ne câble pas le geste (recipe-edit.js, P4 : ni connecte ni telecharger) ne connaît pas le compte : la phrase de repli seule,
      // jamais « Connecte-toi … » dit à une personne peut-être connectée.
      const nonCable = K.pdfFrame({ sha256: H('2'), filename: 'x.pdf' });
      await jusqua(() => nonCable.querySelector('p'));
      eq(decrire(nonCable), [[], [], false, true], 'pdfFrame (ronde 1, P4) : sans geste câblé (écran « Corriger »), la phrase de repli seule — ni état deviné ni bouton (mutant : état dit sans compte connu → « Connecte-toi » à une personne connectée)');
      cadres[4].querySelector('button')?.click();
      await jusqua(() => vus.length > 0);
      eq([vus, (await db.get('sync_state', 'file_error:' + H('1'))) ?? null], [[[H('4'), true]], null], 'pdfFrame (ronde 1) : « Réessayer » appelle telecharger(sha, { reessayer: true }) ; la ligne sans remote n’offre aucune tape, aucun file_error n’est inventé');
      // Liste blanche (S3, spec § 7 : « pdfFrame … mutant : type du blob pris sans liste blanche »). Des octets ici d'un type hors liste : aucun cadre.
      const html = new Blob(['<p>x</p>'], { type: 'text/html' });
      await db.mutate({ puts: { files: [{ sha256: H('6'), mime: 'text/html', size: html.size, blob: html, syncable: false, created_at: DATE, updated_at: DATE }, { sha256: H('7'), mime: 'application/pdf', size: html.size, blob: html, syncable: true, created_at: DATE, updated_at: DATE }] }, origin: 'device' });
      const remis = []; const vraiCreer = URL.createObjectURL;
      URL.createObjectURL = (b) => { remis.push(b?.type); return vraiCreer.call(URL, b); };
      let horsListe = null; let retype = null;
      try {
        horsListe = K.pdfFrame({ sha256: H('6'), filename: 'h.html' });
        retype = K.pdfFrame({ sha256: H('7'), filename: 'r.pdf' });
        await jusqua(() => horsListe.querySelector('button') && retype.querySelector('iframe'));
      } finally { URL.createObjectURL = vraiCreer; }
      eq([!!horsListe.querySelector('iframe'), [...horsListe.querySelectorAll('button')].map((b) => b.textContent), horsListe.textContent.includes('pas encore sur cet appareil'), !!retype.querySelector('iframe.pdf[sandbox]'), remis.includes('application/pdf'), remis.includes('text/html')],
        [false, ['Télécharger le fichier'], false, true, true, false], 'pdfFrame (ronde 1, S3) : des octets text/html sous une ligne text/html → aucun cadre et « Télécharger le fichier » — jamais « pas encore sur cet appareil », ils SONT ici ; sous une ligne application/pdf → le cadre, et le Blob remis à createObjectURL est application/pdf (mutant : blob pris sans liste blanche → text/html dans le cadre)');
      const src = retype.querySelector('iframe')?.src; if (src) URL.revokeObjectURL(src);
    });
  });

  await run('ronde 1 : vignettePage — source blob: par la liste blanche, alt de l’écran, libellé pendant, « Réessayer » avec un compte, phrase du motif (§ 4.3)', async () => {
    const blobPng = await pngMinuscule();
    const remis = []; const vraiCreer = URL.createObjectURL;
    URL.createObjectURL = (b) => { remis.push(b?.type); return vraiCreer.call(URL, b); };
    let png = null; let retypee = null;
    try {
      png = K.vignettePage({ id: 'p1', sha256: H('7') }, { sha256: H('7'), mime: 'image/png', blob: blobPng }, { alt: 'Page 3' });
      retypee = K.vignettePage({ id: 'p2', sha256: H('8') }, { sha256: H('8'), mime: 'image/jpeg', blob: new Blob(['<p>x</p>'], { type: 'text/html' }) });
    } finally { URL.createObjectURL = vraiCreer; }
    eq([png.tagName, png.src.startsWith('blob:'), png.alt, retypee.src.startsWith('blob:'), retypee.alt, remis], ['IMG', true, 'Page 3', true, 'Page', ['image/png', 'image/jpeg']],
      'vignettePage (ronde 1) : la miniature a une source blob: (mutant : src jamais posée → miniature blanche, verte) créée depuis un Blob de la liste blanche — text/html sous une ligne image/jpeg est remis image/jpeg (mutant : createObjectURL(fichier.blob)) ; l’alt est celui que l’écran donne (« Page {position} » en séance), « Page » par défaut');
    let finir = null;
    const distanteR1 = { sha256: H('9'), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() };
    const enAttente = K.vignettePage({ id: 'p3', sha256: H('9') }, distanteR1, { connecte: true, uid: 'u1', telecharger: () => new Promise((r) => { finir = r; }) });
    const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene); scene.append(enAttente);
    try {
      const b = enAttente.querySelector('button');
      b.click();
      const pendant = [b.disabled, b.textContent];
      finir?.(); await new Promise((r) => setTimeout(r, 0));
      eq([pendant, [b.disabled, b.textContent]], [[true, 'Téléchargement…'], [false, 'Télécharger']], 'vignettePage (ronde 1) : pendant un téléchargement, le bouton est éteint et dit « Téléchargement… », puis se rallume (mutant : libellé jamais changé)');
    } finally { scene.remove(); }
    const enErreur = (connecte, motif) => K.vignettePage({ id: 'p4', sha256: H('a') }, { ...distanteR1, sha256: H('a') }, { connecte, uid: 'u1', erreurs: new Map([[H('a'), { motif, sens: 'reception', at: DATE }]]), telecharger: async () => {} });
    const decrire = (n) => [n.dataset.etat, n.querySelector('small')?.textContent ?? null, [...n.querySelectorAll('button')].map((x) => x.textContent)];
    eq([decrire(enErreur(false, 'empreinte')), decrire(enErreur(true, 'introuvable')), decrire(enErreur(true, 'forme'))],
      [['erreur', 'Fichier illisible reçu du serveur.', []], ['erreur', 'Ce fichier n’est plus sur le serveur.', ['Réessayer']], ['erreur', 'Ligne de fichier mal formée reçue du serveur.', ['Réessayer']]],
      'vignettePage (ronde 1) : sans compte, une page en erreur n’offre pas « Réessayer » (la tape effaçait le diagnostic sans rien retenter, R52) ; la phrase est celle du MOTIF, la table de Réglages (§ 4.10 : un 404 n’est pas « illisible reçu », rien n’a été reçu)');
  });

  await run('ronde 1 : couverture — échec qui pose un file_error, succès sans toast d’échec, double tape, « Réessayer » avec un compte seulement (§ 4.2)', async () => {
    const { renderBook } = await import('../src/ui/book.js');
    await withRepo(async (repo, db) => {
      const toile = new OffscreenCanvas(4, 6); toile.getContext('2d').fillRect(0, 0, 4, 6);
      const jpeg = await toile.convertToBlob({ type: 'image/jpeg' });
      const ed = (id, c) => ({ id, book_id: 'bC', year: 2020, cover_sha256: H(c) });
      const eF = ed('eF', '1'); const eS = ed('eS', '2'); const eR = ed('eR', '3');
      const livre = { id: 'bC', title: 'Couvertures', author: 'A', cuisines: [] };
      await db.mutate({ puts: { files: ['1', '2', '3'].map((c) => ({ sha256: H(c), mime: 'image/jpeg', size: jpeg.size, updated_at: DATE, remote: R({ size: jpeg.size }) })),
        sync_state: [{ key: 'file_error:' + H('3'), value: { motif: 'introuvable', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const ctx = (sync) => ({ book_editions: [eF, eS, eR], recipes: [], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(), docsByRecipe: new Map(), scan_sessions: [], settings: {}, books: [livre], booksById: new Map([['bC', livre]]), editionsById: new Map([['eF', eF], ['eS', eS], ['eR', eR]]), editionLabel: () => livre.title, sync });
      const bloc = (n) => [...n.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Couverture');
      const textes = (n) => [...(bloc(n)?.querySelectorAll('button') || [])].map((b) => b.textContent);
      const appels = [];
      const moteur = { onEtat: () => () => {}, reessayerFichier: async () => ({ recus: 0, erreurs: 0, erreur: null }), telecharger: async (shas) => {
        appels.push(shas);
        if (shas[0] === H('1')) { await db.mutate({ puts: { sync_state: [{ key: 'file_error:' + H('1'), value: { motif: 'empreinte', sens: 'reception', at: DATE } }] }, origin: 'device' }); return { recus: 0, erreurs: 1, erreur: null }; }
        await new Promise((r) => setTimeout(r, 30)); // la seconde tape tombe pendant la descente
        await db.mutate({ puts: { files: [{ ...(await db.get('files', shas[0])), blob: jpeg }] }, origin: 'remote' });
        return { recus: 1, erreurs: 0, erreur: null };
      } };
      viderToastR1();
      const fF = await renderBook({ id: 'eF' }, {}, ctx({ user: { id: 'u1' }, moteur }));
      [...(bloc(fF)?.querySelectorAll('button') || [])].find((b) => b.textContent === 'Télécharger')?.click();
      await jusqua(() => toastR1() === ECHEC_R1);
      eq([bloc(fF)?.querySelector('small')?.textContent, textes(fF).includes('Réessayer'), textes(fF).includes('Télécharger'), toastR1()], ['Fichier illisible reçu du serveur.', true, false, ECHEC_R1],
        'couverture (ronde 1, § 4.2) : un téléchargement qui pose un file_error (empreinte refusée) passe la zone à « Fichier illisible reçu du serveur. » + « Réessayer », jamais « Télécharger », et l’échec est dit (mutant : file_error non relus après l’échec)');
      viderToastR1();
      const fS = await renderBook({ id: 'eS' }, {}, ctx({ user: { id: 'u1' }, moteur }));
      const b = [...(bloc(fS)?.querySelectorAll('button') || [])].find((x) => x.textContent === 'Télécharger');
      b?.click(); b?.click(); // deux tapes rapprochées : la seconde tombe sur le bouton d'avant le redessin
      await jusqua(() => bloc(fS)?.querySelector('img'));
      for (let i = 0; i < 20 && toastR1() !== ECHEC_R1; i += 1) await new Promise((r) => setTimeout(r, 10)); // laisse au toast d'un succès mal fermé le temps de s'écrire
      eq([appels.filter((l) => l[0] === H('2')).length, !!bloc(fS)?.querySelector('img'), toastR1() === ECHEC_R1], [1, true, false],
        'couverture (ronde 1) : deux tapes rapprochées font UN appel au moteur (mutant : garde de double tape retirée) ; une couverture bien reçue ne dit jamais « Le téléchargement n’a pas abouti. » (mutant : return du succès retiré)');
      const sansMoteur = await renderBook({ id: 'eR' }, {}, ctx({ user: { id: 'u1' } }));
      const sansCompte = await renderBook({ id: 'eR' }, {}, ctx({ moteur }));
      eq([bloc(sansMoteur)?.querySelector('small')?.textContent, textes(sansMoteur).includes('Réessayer'), bloc(sansCompte)?.querySelector('small')?.textContent, textes(sansCompte).includes('Réessayer')], ['Ce fichier n’est plus sur le serveur.', false, 'Ce fichier n’est plus sur le serveur.', false],
        'couverture (ronde 1) : en erreur, la phrase de SON motif (un 404 n’est pas « illisible reçu ») ; « Réessayer » exige un compte ET le moteur — sans moteur il ne peut rien, sans compte il effaçait le diagnostic sans rien retenter (mutants : motif jeté ; reessayable vrai ; reessayable: !!moteur)');
      await finDesImages(fS);
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('ronde 1 : séance — bouton groupé des seules pages distantes, phrase sur les remote valides de CE compte, abonnés qui ne survivent pas à l’écran (§ 4.3, F-21, I5)', async () => {
    const { renderImport } = await import('../src/ui/import.js');
    await withRepo(async (repo, db) => {
      const photo = await pngMinuscule(); const s0 = await sha256Hex(photo);
      await repo.putFile(s0, photo, {});
      const ligne = (c, sur) => ({ sha256: H(c), mime: 'image/jpeg', size: 5, updated_at: DATE, ...sur });
      await db.mutate({ puts: { files: [ligne('1', { remote: R() }), ligne('2', { remote: R() }), ligne('3', {}), ligne('4', { remote: R() }), ligne('5', { remote: R({ owner: 'u2' }) }), ligne('6', { remote: true })],
        sync_state: [{ key: 'file_error:' + H('4'), value: { motif: 'empreinte', sens: 'reception', at: DATE } }] }, origin: 'device' });
      const pages = [s0, H('1'), H('2'), H('3'), H('4'), H('5'), H('6')].map((sha256, i) => ({ id: 'r1p' + i, document_id: 'dr', sha256, position: i + 1 }));
      const seance = { id: 'sr', status: 'open', started_at: DATE, page_ids: pages.map((p) => p.id), document_ids: [] };
      const abonnes = new Set(); const appels = [];
      const moteur = { onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); }, telecharger: async (shas) => { appels.push(shas); return { recus: 0, erreurs: 0, erreur: null }; } };
      const ctxS = (sync, s = seance) => ({ scan_sessions: [s], pagesById: new Map(pages.map((p) => [p.id, p])), source_documents: [], book_editions: [], booksById: new Map(), editionsById: new Map(), editionLabel: () => '', recipes: [], settings: {}, sync });
      const tour = () => new Promise((r) => setTimeout(r, 0));
      const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
      try {
        const root = await renderImport({}, { session: 'sr' }, ctxS({ user: { id: 'u1' }, moteur }));
        scene.replaceChildren(root);
        await tour();
        const groupe = [...root.querySelectorAll('button')].find((b) => /^Télécharger les \d+ pages$/.test(b.textContent));
        eq([groupe?.textContent ?? null, groupe?.closest('.row')?.nextElementSibling === root.querySelector('.thumbs'), root.querySelector('[data-role="phrase-seance"]')?.textContent, root.querySelector('.thumbs img')?.alt],
          ['Télécharger les 2 pages', true, 'Photos : 3/7 sauvegardées sur le serveur', 'Page 1'],
          'séance (ronde 1, § 4.3) : « Télécharger les 2 pages » au-dessus de .thumbs ne compte QUE les distantes de ce compte — ni l’absente, ni celle en erreur, ni celle d’un autre compte, ni l’ancien remote: true (mutants : bouton groupé jamais posé ; filtre d’état de `distantes` retiré → 6) ; la phrase compte les remote VALIDES de CE compte, celle en erreur comprise (mutant : !!remote → 5/7) ; l’alt dit la position');
        groupe?.click();
        await jusqua(() => appels.length > 0);
        eq(appels, [[H('1'), H('2')]], 'séance (ronde 1) : la tape passe les deux clés distantes au moteur, dans l’ordre des pages');
        // Fuite d'abonnés (constat Important) : deux rendus montés tour à tour SANS aucun onEtat, un troisième jamais monté, puis l'écran quitté.
        const avant = abonnes.size;
        const r2 = await renderImport({}, { session: 'sr' }, ctxS({ user: { id: 'u1' }, moteur }));
        scene.replaceChildren(r2); await tour();
        await renderImport({}, { session: 'sr' }, ctxS({ user: { id: 'u1' }, moteur })); // rendu dépassé : jamais inséré
        await tour();
        const pendant = abonnes.size;
        scene.replaceChildren();
        for (const fn of [...abonnes]) fn({ enCours: false });
        eq([avant, pendant, abonnes.size], [1, 2, 0], 'séance (ronde 1) : un rendu jamais monté se désabonne au tour qui suit (il retenait ctx à vie) ; un écran quitté, au premier onEtat qui le trouve détaché — même sans aucun onEtat pendant qu’il était monté (mutants : désabonnement seulement après un onEtat monté → 3 abonnés à vie ; retirer() jamais appelé)');
        await finDesImages(root); await finDesImages(r2);
      } finally { scene.remove(); }
      const sansPage = { id: 'sv', status: 'open', started_at: DATE, page_ids: [], document_ids: [] };
      const vide = await renderImport({}, { session: 'sv' }, ctxS({ user: { id: 'u1' } }, sansPage));
      eq(vide.querySelector('[data-role="phrase-seance"]')?.hidden, true, 'séance (ronde 1) : sans page photo, aucune phrase « 0/0 photos … envoyées au serveur » (une séance de documents seuls)');
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('ronde 1 : sans compte, aucun écran n’offre de geste de téléchargement — séance, fiche du livre, fiche recette (§ 4.3-4.5)', async () => {
    const { renderImport } = await import('../src/ui/import.js');
    const { renderBook } = await import('../src/ui/book.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    await withRepo(async (repo, db) => {
      await db.mutate({ puts: { files: ['1', '2', '3'].map((c) => ({ sha256: H(c), mime: 'image/jpeg', size: 5, updated_at: DATE, remote: R() })).concat([{ sha256: H('4'), mime: 'application/pdf', size: 9, updated_at: DATE, remote: R({ mime: 'application/pdf' }) }]),
        sync_state: [{ key: 'user_id', value: 'u1' }] }, origin: 'device' });
      // Un appareil lié et déconnecté : le moteur existe (app.js le démarre dès qu'un client existe), aucune session.
      const sync = { moteur: { onEtat: () => () => {}, telecharger: async () => ({ recus: 0, erreurs: 0, erreur: null }) } };
      const pages = [{ id: 'n1', edition_id: 'eN', document_id: 'dN', sha256: H('1'), printed_page: 1, position: 1 }, { id: 'n2', edition_id: 'eN', document_id: 'dN', sha256: H('2'), printed_page: 2, position: 2 }];
      const seance = { id: 'sN', status: 'open', started_at: DATE, page_ids: ['n1', 'n2'], document_ids: ['dpdf'] };
      const vue = await renderImport({}, { session: 'sN' }, { scan_sessions: [seance], pagesById: new Map(pages.map((p) => [p.id, p])), source_documents: [{ id: 'dpdf', source_type: 'pdf', sha256: H('4'), original_filename: 'n.pdf' }], book_editions: [], booksById: new Map(), editionsById: new Map(), editionLabel: () => '', recipes: [], settings: {}, sync });
      const ed = { id: 'eN', book_id: 'bN', year: 2020 };
      const livre = { id: 'bN', title: 'Sans compte', author: 'A', cuisines: [] };
      const fiche = await renderBook({ id: 'eN' }, {}, { book_editions: [ed], recipes: [], recipe_versions: [], source_documents: [{ id: 'dN', edition_id: 'eN', source_type: 'photo', sha256: H('1'), original_filename: 'a.jpg' }], source_pages: pages, rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(), docsByRecipe: new Map(), scan_sessions: [], settings: {}, books: [livre], booksById: new Map([['bN', livre]]), editionsById: new Map([['eN', ed]]), editionLabel: () => livre.title, sync });
      const { recette, version } = recetteR1('rN', { pageIds: ['n1', 'n2'], photo: H('3') });
      const fr = await renderRecipe({ id: 'rN' }, {}, ctxRecetteR1([recette], [version], pages, sync));
      const fichiers = [...vue.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Fichiers');
      await jusqua(() => fichiers?.querySelector('p'));
      const ecrans = [vue, fiche, fr];
      const c = 'Connecte-toi pour télécharger cette photo.';
      eq([ecrans.map((n) => [...n.querySelectorAll('.photo-visible small')].map((s) => s.textContent)), ecrans.map((n) => [...n.querySelectorAll('button')].map((b) => b.textContent).filter((x) => /^(Télécharger|Télécharger les \d+ pages|Réessayer)$/.test(x))), [...(fichiers?.querySelectorAll('small') || [])].map((s) => s.textContent)],
        [[[c, c], [c, c], [c, c, c]], [[], [], []], ['Connecte-toi pour la télécharger']],
        'sans compte (ronde 1) : chaque vignette distante dit « Connecte-toi … » — séance, fiche du livre, photo du plat et « Original » —, aucun « Télécharger » ni « Télécharger les {n} pages », et le cadre PDF de la séance n’a aucun bouton (mutants : connecte forcé dans vignettesDePages, dans le pdfFrame de la séance, dans la photo du plat, dans le bouton groupé du livre et dans celui d’« Original »)');
    });
  });

  await run('ronde 1 : photo du plat — « Télécharger » par le moteur puis l’image ; une ligne qui ne sera pas une image n’offre rien (§ 4.4)', async () => {
    const { renderRecipe } = await import('../src/ui/recipe.js');
    await withRepo(async (repo, db) => {
      const toile = new OffscreenCanvas(2, 2); toile.getContext('2d').fillRect(0, 0, 2, 2);
      const jpeg = await toile.convertToBlob({ type: 'image/jpeg' });
      await db.mutate({ puts: { files: [{ sha256: H('3'), mime: 'image/jpeg', size: jpeg.size, updated_at: DATE, remote: R({ size: jpeg.size }) }, { sha256: H('4'), mime: 'application/pdf', size: 9, updated_at: DATE, remote: R({ mime: 'application/pdf', size: 9 }) }] }, origin: 'remote' });
      const appels = [];
      const moteur = { onEtat: () => () => {}, telecharger: async (shas) => { appels.push(shas); await db.mutate({ puts: { files: [{ ...(await db.get('files', shas[0])), blob: jpeg }] }, origin: 'remote' }); return { recus: 1, erreurs: 0, erreur: null }; } };
      const sync = { user: { id: 'u1' }, moteur };
      const a = recetteR1('rJ', { photo: H('3') }); const b = recetteR1('rK', { photo: H('4') });
      viderToastR1();
      const page = await renderRecipe({ id: 'rJ' }, {}, ctxRecetteR1([a.recette], [a.version], [], sync));
      const figure = page.querySelector('[data-role="photo-plat"]');
      [...(figure?.querySelectorAll('button') || [])].find((x) => x.textContent === 'Télécharger')?.click();
      await jusqua(() => figure?.querySelector('img'));
      eq([appels, !!figure?.querySelector('img'), figure?.querySelector('.fichier-absent') ?? null, toastR1() === ECHEC_R1], [[[H('3')]], true, null, false],
        'photo du plat (ronde 1, § 4.4) : « Télécharger » → moteur.telecharger([sha]), puis l’image remplace la vignette, sans dire d’échec — la règle de la couverture (mutants : geste sans moteur ; redessin qui ne redessine plus)');
      const pdf = await renderRecipe({ id: 'rK' }, {}, ctxRecetteR1([b.recette], [b.version], [], sync));
      eq([pdf.querySelector('[data-role="photo-plat"]')?.textContent.includes('Ce fichier ne peut pas être affiché comme photo.'), pdf.querySelector('[data-role="photo-plat"] button')], [true, null], 'photo du plat (ronde 1) : une ligne distante qui ne sera pas une image (application/pdf) n’offre pas « Télécharger » — chaque tape réussissait sans que rien ne change à l’écran (boucle muette)');
      await finDesImages(page);
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    });
  });

  await run('ronde 1 : I-G8 lu dans les modules des écrans', async () => {
    const { EN } = await import('../src/i18n/en.js');
    const cles = [];
    for (const m of ['../src/ui/components.js', '../src/ui/book.js', '../src/ui/import.js', '../src/ui/recipe.js', '../src/ui/livre-ajout.js']) {
      for (const [, cle] of (await lire(m)).matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) cles.push(cle);
    }
    ok(cles.includes('Télécharger les {n} pages') && cles.includes('Le téléchargement n’a pas abouti.') && cles.length > 100, `I-G8 (ronde 1) : les t('…') des cinq modules des écrans sont bien lus (${cles.length} chaînes)`);
    eq(cles.filter((k) => /supabase/i.test(k) || /supabase/i.test(EN[k] || '')), [], 'I-G8 (ronde 1) : aucune chaîne t() des modules des écrans ne nomme le fournisseur de stockage, en français ni en anglais (le contrôle du brief ne relisait que sa propre liste)');
  });
}
