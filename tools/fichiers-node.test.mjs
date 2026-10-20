// Contrainte Node du lot G (spec § 3.1, F-12) : src/sync/fichiers.js et tout ce qu'il importe se chargent sous Node — aucun global du
// navigateur au niveau d'un module (createImageBitmap, OffscreenCanvas, document restent dans des fonctions).
import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteValide, remoteDeCeCompte, projectionFichier, CHAMPS_FILES_SERVEUR } from '../src/sync/tables.js';

const R = { sha256: 'e'.repeat(64), size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: '2026-10-19T00:00:00.000Z', owner: 'u1' };

test('fichiers.js se charge sous Node et réexporte remoteValide', async () => {
  const F = await import('../src/sync/fichiers.js');
  assert.equal(F.remoteValide, remoteValide);
  assert.equal(F.remoteValide(R), true);
  assert.equal(F.remoteValide(true), false);
  assert.equal(F.remoteDeCeCompte(R, 'u1'), true);
  assert.equal(remoteDeCeCompte(R, 'u2'), false);
});

test('tables.js : la projection serveur d’une ligne files', () => {
  assert.deepEqual([...CHAMPS_FILES_SERVEUR], ['sha256', 'mime', 'size', 'original_filename', 'remote', 'updated_at']);
  assert.deepEqual(projectionFichier({ sha256: 'a'.repeat(64), mime: 'image/png', size: 3, syncable: true, created_at: 'x', updated_at: 'y', remote: true }), { sha256: 'a'.repeat(64), mime: 'image/png', size: 3, updated_at: 'y', remote: null });
});
