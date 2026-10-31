import { withRepo } from './sync-fixture.js';
import { TransitionRefusee } from '../src/core/db.js';
import { sha256Hex } from '../src/core/hash.js';

const MAGASINS = ['files', 'inventory', 'outbox'];
const STOCK = 'audit-absence-inventaire';
const erreur = async fn => { try { await fn(); return null; } catch (e) { return e; } };

async function preparer(repo, db) {
  await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'u1' }] } });
  await repo.saveBatch({ inventory: [{ id: STOCK, label: 'Avant le geste', quantity_text: '2 portions', location: 'frigo' }] });
  return db.get('inventory', STOCK);
}

export async function runAuditRepoAbsenceTests({ eq, ok }) {
  const octets = new Uint8Array([0, 255, 128, 13, 10, 42, 0]);
  const blob = new Blob([octets], { type: 'application/octet-stream' }), sha256 = await sha256Hex(blob);
  const enregistrer = (repo, stock) => repo.saveBatch({ inventory: [{ ...stock, label: 'Après le geste' }] }, {
    conditions: { files: [{ key: sha256, absente: true }] },
    fichiers: [{ sha256, blob, meta: { original_filename: 'preuve-absence.bin' } }],
  });

  await withRepo(async (repo, db) => {
    const stock = await preparer(repo, db), avant = await db.getSnapshot(MAGASINS);
    eq(await db.get('files', sha256), undefined, 'Absence dépôt : fichier réellement absent avant création');
    eq(avant.outbox.map(e => [e.user_id, e.store, e.id, e.op]), [['u1', 'inventory', STOCK, 'put']], 'Absence dépôt : intention antérieure réellement capturée');
    const refus = await erreur(() => enregistrer(repo, stock));
    eq(refus, null, 'Absence dépôt : absente true autorise le fichier neuf via fichiers');
    const fichier = await db.get('files', sha256), courant = await db.get('inventory', STOCK), file = await db.getAll('outbox');
    ok(fichier?.blob instanceof Blob, 'Absence dépôt : les octets du fichier neuf sont conservés');
    eq(fichier && [fichier.sha256, fichier.size, fichier.original_filename], [sha256, octets.length, 'preuve-absence.bin'], 'Absence dépôt : identité et métadonnées du fichier neuf');
    eq(fichier?.blob instanceof Blob ? [...new Uint8Array(await fichier.blob.arrayBuffer())] : null, [...octets], 'Absence dépôt : octets binaires relus exactement, hors comparaison JSON');
    eq(courant.label, 'Après le geste', 'Absence dépôt : écriture métier du même lot validée');
    eq(file.slice(0, avant.outbox.length), avant.outbox, 'Absence dépôt : intention antérieure conservée après succès');
    eq(file.slice(avant.outbox.length).map(e => [e.user_id, e.store, e.id, e.op, e.snapshot]), [['u1', 'inventory', STOCK, 'put', courant]], 'Absence dépôt : une seule nouvelle intention métier avec sa copie exacte');
    eq(file.filter(e => e.store === 'files'), [], 'Absence dépôt : fichier local sans copie serveur ne prétend pas être envoyé');
  });

  for (const tardive of [false, true]) await withRepo(async (repo, db) => {
    const nom = tardive ? 'collision tardive' : 'collision présente';
    const stock = await preparer(repo, db);
    // Sans Blob, la conservation d’octets déjà possédés ne peut masquer une garde d’absence retirée.
    const existant = { sha256, blob: null, mime: 'application/octet-stream', size: 19, original_filename: 'fichier-concurrent.bin', ...(tardive ? { status: 'concurrent' } : {}) };
    if (!tardive) await db.mutate({ origin: 'remote', puts: { files: [existant] } });
    const avant = await db.getSnapshot(MAGASINS);
    eq(avant.files.length, tardive ? 0 : 1, `Absence dépôt ${nom} : état initial discriminant`);
    const muter = db.mutate.bind(db); let appels = 0, enveloppee = false, concurrent = null;
    db.mutate = async options => {
      const condition = options.conditions?.files?.find(c => c.key === sha256);
      if (options.origin === 'local' && condition) {
        appels++;
        enveloppee = typeof condition.fusion === 'function' && condition.absente === undefined;
        if (tardive) {
          await muter({ origin: 'remote', puts: { files: [existant] } });
          concurrent = await db.getSnapshot(MAGASINS);
        }
      }
      return muter(options);
    };
    let refus;
    try { refus = await erreur(() => enregistrer(repo, stock)); }
    finally { db.mutate = muter; }
    eq(appels, 1, `Absence dépôt ${nom} : vraie transaction finale atteinte une fois`);
    ok(enveloppee, `Absence dépôt ${nom} : garde d’absence portée par la fusion du dépôt`);
    ok(refus instanceof TransitionRefusee, `Absence dépôt ${nom} : refus de transition réel, pas une erreur quelconque`);
    eq(refus && [refus.name, refus.store, refus.key, refus.message], [
      'TransitionRefusee', 'files', sha256,
      `Transition refusée : files/${sha256} au statut ${String(existant.status)}`,
    ], `Absence dépôt ${nom} : identité et message exacts du refus`);
    eq(refus?.statut, existant.status, `Absence dépôt ${nom} : statut exact, y compris undefined`);
    eq(await db.getSnapshot(MAGASINS), tardive ? concurrent : avant, `Absence dépôt ${nom} : fichier, métier et intentions conservés atomiquement`);
    eq(await db.get('files', sha256), existant, `Absence dépôt ${nom} : ligne concurrente jamais enrichie ni écrasée`);
    eq(await db.get('inventory', STOCK), stock, `Absence dépôt ${nom} : écriture métier du lot refusé annulée`);
    eq(await db.getAll('outbox'), avant.outbox, `Absence dépôt ${nom} : aucune intention nouvelle ni perte de la file antérieure`);
  });
}
