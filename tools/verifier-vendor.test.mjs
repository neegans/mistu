// Tests du vérificateur de dépendance embarquée (spec § 6.1). Aucun réseau ici : seuls les chemins de
// validation des arguments sont couverts — ils s'exécutent avant tout fetch, donc jamais atteints par ces tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPT = path.join(RACINE, 'tools', 'verifier-vendor.mjs');

function lancer(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: RACINE, encoding: 'utf8' });
}

test('--local sans version : code 2, message explicite (jamais de trace Node brute)', () => {
  const r = lancer(['--local', 'src/vendor/supabase-2.117.3.umd.js']);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes('version'), 'stderr doit mentionner la version manquante');
  assert.doesNotMatch(r.stderr, /at file:|ENOENT/);
});

test('--local avec un fichier umd introuvable et une version : code 2', () => {
  const r = lancer(['--local', 'src/vendor/absent-pour-le-test.js', '2.117.3']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /introuvable/);
  assert.doesNotMatch(r.stderr, /at file:|ENOENT/);
});

test('mode complet sans argument : code 2', () => {
  const r = lancer([]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes('version'), 'stderr doit mentionner la version manquante');
});

// F3 : la comparaison elle-meme est une fonction pure, exportee, et c'est elle que le script utilise. Avant cela,
// « verifie » n'etait qu'une expression booleenne au milieu d'une fonction qui faisait du reseau : aucun test ne
// pouvait dire ce que le script conclut, ni POURQUOI il conclut non. Le reseau reste hors test.
import { comparerEmpreintes } from './verifier-vendor.mjs';

test('F3 : tout concorde -> ok, aucune raison', () => {
  assert.deepEqual(comparerEmpreintes({
    localSha256: 'a'.repeat(64), unpkgSha256: 'a'.repeat(64),
    integriteRegistre: 'sha512-xyz', integriteAttendue: 'sha512-xyz',
  }), { ok: true, raisons: [] });
});
test('F3 : une empreinte sha256 differente -> la raison est nommee', () => {
  const r = comparerEmpreintes({ localSha256: 'a'.repeat(64), unpkgSha256: 'b'.repeat(64) });
  assert.equal(r.ok, false);
  assert.deepEqual(r.raisons, ['umd']);
});
test('F3 : une integrite d archive differente -> la raison est nommee', () => {
  const r = comparerEmpreintes({
    localSha256: 'a'.repeat(64), unpkgSha256: 'a'.repeat(64),
    integriteRegistre: 'sha512-du-registre', integriteAttendue: 'sha512-de-larchive-locale',
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.raisons, ['archive']);
});
test('F3 : une empreinte absente n est jamais prise pour une concordance', () => {
  assert.deepEqual(comparerEmpreintes({ localSha256: '', unpkgSha256: '' }), { ok: false, raisons: ['umd'] });
});
