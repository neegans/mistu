// Base jetable pour les tests de repo.js : le module est lié à une base temporaire v2, la capture est posée,
// et la base d'origine est remise en place dans tous les cas. Jamais la bibliothèque de l'utilisateur.
import * as repo from '../src/model/repo.js';
import { installCapture, uninstallCapture } from '../src/sync/outbox.js';
import { withDatabase } from './backup.js';

const DEVICE_KEY = 'cuisineos.device';

export function withRepo(test) {
  const original = repo.db;
  const storedDevice = localStorage.getItem(DEVICE_KEY); // init() reflète l'identité ici : état rendu intact ensuite
  return withDatabase(async (tempDb) => {
    repo.bindDatabase(tempDb);
    try {
      // init() avant la capture, comme au démarrage de l'app : l'amorçage des références n'a pas à partir au serveur.
      await repo.init();
      installCapture(tempDb, { getUserId: () => 'u1', isActivitySynced: () => false });
      return await test(repo, tempDb);
    } finally {
      uninstallCapture(tempDb);
      repo.bindDatabase(original);
      if (storedDevice === null) localStorage.removeItem(DEVICE_KEY);
      else localStorage.setItem(DEVICE_KEY, storedDevice);
    }
  });
}
