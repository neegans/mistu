// Contrats du lanceur CI sur de petites pages synthétiques, jamais sur un compte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifierNavigateur } from './verifier-navigateur.mjs';

const vert = '<div id="out"><h2>✅ 1/1 tests réussis</h2><div class="ok">Témoin</div></div>';
async function scenario({ html = vert, script = '', css = true, delaiMs = 5000 } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mistu-ci-test-'));
  try {
    await mkdir(join(root, 'site/tests'), { recursive: true });
    await mkdir(join(root, 'site/src/core'), { recursive: true });
    await writeFile(join(root, 'site/src/core/log.js'), 'export function log(details = { reason: "reseau" }, code = "sync.push") { console.error("[cuisine-os] " + code, details); }');
    await writeFile(join(root, 'site/tests/index.html'), '<!doctype html><html><head><link rel="stylesheet" href="./tests.css"></head><body>' + html + '<script src="./scenario.js"></script></body></html>');
    if (css) await writeFile(join(root, 'site/tests/tests.css'), 'body { font-family: sans-serif; }');
    if (script !== null) await writeFile(join(root, 'site/tests/scenario.js'), script);
    return await verifierNavigateur({ racine: join(root, 'site'), dossierResultats: join(root, 'reçus'), delaiMs });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('CI navigateur : bilan positif exact et journal attendu', async () => {
  const r = await scenario({ script: 'import("/src/core/log.js").then(m => m.log());' });
  assert.equal(r.succes, true); assert.equal(r.assertions, 1); assert.equal(r.consoleAttendue, 1);
  assert.deepEqual(r.erreurs, []); assert.equal(r.serveurFerme, true); assert.equal(r.navigateurFerme, true);
});

test('CI navigateur : les cinq refus HTTP injectés restent des journaux attendus', async () => {
  const r = await scenario({ script: 'import("/src/core/log.js").then(m => { for (const [status, reason] of [["401","auth"],["413","quota"],["503","reseau"],["404","inconnu"],["400","refus"]]) m.log({status, reason}); });' });
  assert.equal(r.succes, true); assert.equal(r.consoleAttendue, 5); assert.deepEqual(r.erreurs, []);
});

for (const [nom, html] of [
  ['nombres différents', vert.replace('1/1', '1/2')],
  ['zéro assertion', vert.replace('1/1', '0/0')],
  ['texte supplémentaire', vert.replace('tests réussis', 'tests réussis mais incomplet')],
  ['ligne rouge malgré en-tête vert', vert.replace('class="ok"', 'class="ko"')],
  ['compte du DOM différent', vert.replace('1/1', '2/2')],
]) test('CI navigateur refuse ' + nom, async () => {
  const r = await scenario({ html }); assert.equal(r.succes, false);
  assert.equal(r.erreurs.some(e => e.type === 'bilan'), true);
});

for (const [nom, options, type] of [
  ['module absent', { html: '<div id="out">Exécution…</div>', script: null }, 'http'],
  ['CSS absent malgré ancien bilan vert', { css: false }, 'http'],
  ['exception JavaScript malgré bilan vert', { script: 'throw new Error("contre-épreuve CI");' }, 'javascript'],
  ['erreur console inattendue', { script: 'console.error("contre-épreuve CI");' }, 'console'],
  ['préfixe connu avec code inconnu', { script: 'import("/src/core/log.js").then(m => m.log({name: "TypeError"}, "inconnue"));' }, 'console'],
  ['code connu avec erreur différente', { script: 'import("/src/core/log.js").then(m => m.log({name: "TypeError"}));' }, 'console'],
  ['journal connu issu du mauvais fichier', { script: 'console.error("[cuisine-os] sync.push", { reason: "reseau" });' }, 'console'],
  ['requête extérieure bloquée', { script: 'fetch("https://interdit.invalid/sentinelle").catch(() => {});' }, 'reseau-exterieur'],
  ['image blob introuvable', { script: 'const i = new Image(); i.src = "blob:" + location.origin + "/00000000-0000-4000-8000-000000000000"; document.body.append(i);' }, 'reseau'],
]) test('CI navigateur refuse ' + nom, async () => {
  const r = await scenario(options); assert.equal(r.succes, false);
  assert.equal(r.erreurs.some(e => e.type === type), true, JSON.stringify(r.erreurs));
  assert.equal(r.serveurFerme, true); assert.equal(r.navigateurFerme, true);
});

test('CI navigateur : une page sans bilan expire', async () => {
  const r = await scenario({ html: '<div id="out">Exécution…</div>', delaiMs: 200 });
  assert.equal(r.succes, false); assert.equal(r.erreurs.some(e => e.type === 'delai'), true);
});
