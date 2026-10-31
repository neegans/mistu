import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scanner = fileURLToPath(new URL('./verifier-secrets.mjs', import.meta.url));
const anthropic = ['sk', 'ant', 'FAUX_CONTROLE_CI_0123456789'].join('-');
const supabase = ['sbp', 'FAUX_CONTROLE_CI_0123456789'].join('_');
const jwt = 'ey' + 'J' + 'A'.repeat(32) + '.FAUX_CONTROLE_CI.signature_factice';
const sentinelle = ['sk', 'ant', 'cle', 'test', 'sentinelle'].join('-');
const plan = 'docs/superpowers/plans/2026-10-17-chercher-sur-le-web.md';

function depot(fichiers, action, { git = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mistu-scan-secrets-'));
  const commande = args => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10_000 });
    assert.equal(r.status, 0, 'Préparation du dépôt Git jetable');
  };
  try {
    if (git) commande(['init', '--quiet']);
    for (const [nom, texte] of Object.entries(fichiers)) {
      const chemin = join(root, nom);
      mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, texte);
    }
    if (git) commande(['add', '--', '.']);
    return action(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const lancer = cwd => spawnSync(process.execPath, [scanner], { cwd, encoding: 'utf8', timeout: 15_000 });
const sortie = r => r.stdout + r.stderr;
function refuse(r, fichier, type, valeurs) {
  assert.equal(r.status, 1);
  assert.ok(sortie(r).includes(fichier + ':1'), 'Le refus désigne le fichier et sa ligne');
  assert.ok(sortie(r).includes(type), 'Le refus désigne le type de candidat');
  for (const valeur of valeurs) assert.ok(!sortie(r).includes(valeur), 'Aucun candidat complet dans les journaux');
}

test('scan : dépôt suivi sans candidat', () => depot({ 'src/exemple.js': 'export const valeur = 1;\n' }, root => {
  const r = lancer(root); assert.equal(r.status, 0); assert.match(r.stdout, /aucune valeur interdite/);
}));

test('scan : mentions documentaires exactes et seule sentinelle à son chemin', () => depot({
  'README.md': "Motifs : 'sk-" + "ant-[A-Za-z0-9_-]+' et 'sb" + "p_' ; 'sk-" + "ant-…'.\n",
  [plan]: `const CLE = '${sentinelle}';\n`,
}, root => { assert.equal(lancer(root).status, 0); }));

for (const [fichier, valeur, type] of [
  ['tests/exemple.js', anthropic, 'Anthropic'],
  ['docs/exemple.md', supabase, 'Supabase'],
  ['assets/exemple.bin', '\0' + jwt + '\0', 'JWT'],
]) test('scan : aucun dossier ni contenu binaire exclu — ' + type, () => depot({ [fichier]: valeur }, root => {
  refuse(lancer(root), fichier, type, [anthropic, supabase, jwt]);
}));

test('scan : sentinelle exacte refusée dans un autre fichier', () => depot({ 'tests/sentinelle.js': sentinelle }, root => {
  refuse(lancer(root), 'tests/sentinelle.js', 'Anthropic', [sentinelle]);
}));

test('scan : prolonger une sentinelle autorisée ne conserve pas son exception', () => depot({ [plan]: sentinelle + '_PROLONGEE' }, root => {
  refuse(lancer(root), plan, 'Anthropic', [sentinelle, sentinelle + '_PROLONGEE']);
}));

test('scan : second candidat sur une ligne contenant une sentinelle autorisée', () => depot({ [plan]: `'${sentinelle}' '${supabase}'` }, root => {
  refuse(lancer(root), plan, 'Supabase', [sentinelle, supabase]);
}));

test('scan : mention de préfixe ne blanchit pas sa valeur prolongée sur la même ligne', () => depot({
  'docs/prefixes.md': "'sk-" + "ant-' 'sb" + "p_' " + anthropic + ' ' + supabase,
}, root => { refuse(lancer(root), 'docs/prefixes.md', 'Anthropic', [anthropic, supabase]); assert.ok(sortie(lancer(root)).includes('Supabase')); }));

test('scan : lancement depuis un sous-dossier couvre aussi les autres fichiers suivis', () => depot({
  'tools/ci/voisin.txt': 'sans candidat', 'docs/ailleurs.md': anthropic,
}, root => { refuse(lancer(join(root, 'tools/ci')), 'docs/ailleurs.md', 'Anthropic', [anthropic]); }));

test('scan : les chemins avec séparateurs inhabituels gardent leur ligne exacte', () => depot({ 'docs/nom:avec espace.md': anthropic }, root => {
  refuse(lancer(root), 'docs/nom:avec espace.md', 'Anthropic', [anthropic]);
}));

test('scan : une erreur Git échoue sans donner les données du processus', () => depot({ 'lecture.txt': anthropic }, root => {
  const r = lancer(root); assert.equal(r.status, 1); assert.match(sortie(r), /Vérification impossible/); assert.ok(!sortie(r).includes(anthropic));
}, { git: false }));
