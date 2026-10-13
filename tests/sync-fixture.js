// Base jetable pour les tests de repo.js : le module est lié à une base temporaire v2, la capture est posée,
// et la base d'origine est remise en place dans tous les cas. Jamais la bibliothèque de l'utilisateur.
import * as repo from '../src/model/repo.js';
import { installCapture, uninstallCapture } from '../src/sync/outbox.js';
import { withDatabase } from './backup.js';

export function withRepo(test) {
  const original = repo.db;
  return withDatabase(async (tempDb) => {
    repo.bindDatabase(tempDb);
    installCapture(tempDb, { getUserId: () => 'u1', isActivitySynced: () => false });
    // Un appareil réel porte son identité dans sync_state (posée par init ou par la migration) : clearDevice doit la préserver.
    await tempDb.mutate({ puts: { sync_state: [{ key: 'device_id', value: 'dev_test' }] }, origin: 'device' });
    try {
      return await test(repo, tempDb);
    } finally {
      uninstallCapture(tempDb);
      repo.bindDatabase(original);
    }
  });
}
