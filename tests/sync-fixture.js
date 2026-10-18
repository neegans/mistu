// Base jetable pour les tests de repo.js : le module est lié à une base temporaire v2, la capture est posée,
// et la base d'origine est remise en place dans tous les cas. Jamais la bibliothèque de l'utilisateur.
import * as repo from '../src/model/repo.js';
import { installCapture, uninstallCapture } from '../src/sync/outbox.js';
import { withDatabase } from './backup.js';

const DEVICE_KEY = 'cuisineos.device';

export function withRepo(test) {
  const original = repo.db;
  // Depuis R20, init() ne reflète plus rien : il RETIRE cette clé (migration). On la replante par hygiène,
  // pour qu'un test de migration ne laisse pas la clé d'un autre derrière lui.
  const storedDevice = localStorage.getItem(DEVICE_KEY);
  return withDatabase(async (tempDb) => {
    repo.bindDatabase(tempDb);
    try {
      // init() sur une base vide, AVANT la capture : l'amorçage des références (origine 'device') n'a rien à partir au serveur. (L'app, elle, pose
      // la capture avant init() — l'effacement de la clé locale est une écriture 'local' qui doit partir : Passerelle T4, tests/assistant-compte.js.)
      await repo.init();
      installCapture(tempDb, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true }); // R-CPT-2 : un appareil de production
      return await test(repo, tempDb);
    } finally {
      uninstallCapture(tempDb);
      repo.bindDatabase(original);
      if (storedDevice === null) localStorage.removeItem(DEVICE_KEY);
      else localStorage.setItem(DEVICE_KEY, storedDevice);
    }
  });
}
