#!/usr/bin/env node
// Vérifie la dépendance embarquée (spec § 6.1) : (1) l'archive npm contre dist.integrity du registre ;
// (2) le fichier extrait (ou commité) contre le même fichier servi par unpkg.
// Usage :
//   node tools/verifier-vendor.mjs <version> <chemin du .tgz> <chemin du fichier umd extrait>
//   node tools/verifier-vendor.mjs --local <chemin du fichier umd commité> <version>
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const USAGE = `Usage :
  node tools/verifier-vendor.mjs <version> <chemin du .tgz> <chemin du fichier umd extrait>
  node tools/verifier-vendor.mjs --local <chemin du fichier umd commité> <version>`;

const VERSION_RE = /^\d+\.\d+\.\d+$/;

function echouer(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

const sha512b64 = (buf) => 'sha512-' + createHash('sha512').update(buf).digest('base64');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Ce que « vérifié » veut dire (F3) : fonction pure, sans réseau ni fichier, utilisée par les deux modes du script.
// Les raisons sont des jetons ASCII comparables par une machine (même règle que les motifs de sync_push, R9) :
//   'umd'     = le fichier embarqué n'est pas celui que sert unpkg pour cette version ;
//   'archive' = l'archive .tgz ne correspond pas au dist.integrity du registre.
// Une empreinte vide ou manquante n'est JAMAIS prise pour une concordance : deux absences ne se valent pas.
// L'intégrité n'est examinée que si elle est demandée (mode --local : seule la vérification (2) existe).
export function comparerEmpreintes({ localSha256, unpkgSha256, integriteRegistre = null, integriteAttendue = null }) {
  const raisons = [];
  if (!localSha256 || !unpkgSha256 || localSha256 !== unpkgSha256) raisons.push('umd');
  if (integriteAttendue !== null || integriteRegistre !== null) {
    if (!integriteRegistre || !integriteAttendue || integriteRegistre !== integriteAttendue) raisons.push('archive');
  }
  return { ok: raisons.length === 0, raisons };
}

async function telechargerUmd(version) {
  const reponse = await fetch(`https://unpkg.com/@supabase/supabase-js@${version}/dist/umd/supabase.js`);
  return new Uint8Array(await reponse.arrayBuffer());
}

async function verifierLocal(umd, version) {
  if (!umd) echouer('Chemin du fichier umd manquant.');
  if (!version) echouer('Version manquante.');
  if (!VERSION_RE.test(version)) echouer(`Version invalide : « ${version} » (attendu x.y.z).`);
  if (!existsSync(umd)) echouer(`Fichier umd introuvable : ${umd}`);

  const local = readFileSync(umd);
  const remote = await telechargerUmd(version);
  const umdSha256 = sha256(local);
  const unpkgSha256 = sha256(remote);
  const verdict = comparerEmpreintes({ localSha256: umdSha256, unpkgSha256 });
  const resultat = {
    version, umd_sha256: umdSha256, unpkg_sha256: unpkgSha256,
    umd_ok: !verdict.raisons.includes('umd'), raisons: verdict.raisons,
  };
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(verdict.ok ? 0 : 1);
}

async function verifierComplet(version, tgz, umd) {
  if (!version) echouer('Version manquante.');
  if (!VERSION_RE.test(version)) echouer(`Version invalide : « ${version} » (attendu x.y.z).`);
  if (!tgz) echouer('Chemin du .tgz manquant.');
  if (!existsSync(tgz)) echouer(`Archive .tgz introuvable : ${tgz}`);
  if (!umd) echouer('Chemin du fichier umd manquant.');
  if (!existsSync(umd)) echouer(`Fichier umd introuvable : ${umd}`);

  const meta = await (await fetch(`https://registry.npmjs.org/@supabase/supabase-js/${version}`)).json();
  const local = readFileSync(umd);
  const remote = await telechargerUmd(version);
  const umdSha256 = sha256(local);
  const unpkgSha256 = sha256(remote);
  const verdict = comparerEmpreintes({
    localSha256: umdSha256,
    unpkgSha256,
    integriteRegistre: meta.dist.integrity,
    integriteAttendue: sha512b64(readFileSync(tgz)),
  });
  const resultat = {
    version,
    integrity_registre: meta.dist.integrity,
    archive_ok: !verdict.raisons.includes('archive'),
    umd_sha256: umdSha256,
    unpkg_sha256: unpkgSha256,
    umd_ok: !verdict.raisons.includes('umd'),
    raisons: verdict.raisons,
  };
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(verdict.ok ? 0 : 1);
}

// Exécution directe seulement : importé par le test (pour comparerEmpreintes), le module ne touche à rien.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--local') {
    await verifierLocal(args[1], args[2]);
  } else {
    const [version, tgz, umd] = args;
    await verifierComplet(version, tgz, umd);
  }
}
