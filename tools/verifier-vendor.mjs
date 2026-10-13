#!/usr/bin/env node
// Vérifie la dépendance embarquée (spec § 6.1) : (1) l'archive npm contre dist.integrity du registre ;
// (2) le fichier extrait (ou commité) contre le même fichier servi par unpkg.
// Usage :
//   node tools/verifier-vendor.mjs <version> <chemin du .tgz> <chemin du fichier umd extrait>
//   node tools/verifier-vendor.mjs --local <chemin du fichier umd commité> <version>
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha512b64 = (buf) => 'sha512-' + createHash('sha512').update(buf).digest('base64');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function verifierLocal(umd, version) {
  const local = readFileSync(umd);
  const remote = new Uint8Array(await (await fetch(`https://unpkg.com/@supabase/supabase-js@${version}/dist/umd/supabase.js`)).arrayBuffer());
  const okUmd = sha256(local) === sha256(Buffer.from(remote));
  const resultat = { version, umd_sha256: sha256(local), unpkg_sha256: sha256(Buffer.from(remote)), umd_ok: okUmd };
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(okUmd ? 0 : 1);
}

async function verifierComplet(version, tgz, umd) {
  const meta = await (await fetch(`https://registry.npmjs.org/@supabase/supabase-js/${version}`)).json();
  const okTgz = meta.dist.integrity === sha512b64(readFileSync(tgz));
  const local = readFileSync(umd);
  const remote = new Uint8Array(await (await fetch(`https://unpkg.com/@supabase/supabase-js@${version}/dist/umd/supabase.js`)).arrayBuffer());
  const okUmd = sha256(local) === sha256(Buffer.from(remote));
  const resultat = {
    version,
    integrity_registre: meta.dist.integrity,
    archive_ok: okTgz,
    umd_sha256: sha256(local),
    unpkg_sha256: sha256(Buffer.from(remote)),
    umd_ok: okUmd,
  };
  console.log(JSON.stringify(resultat, null, 2));
  process.exit(okTgz && okUmd ? 0 : 1);
}

const args = process.argv.slice(2);
if (args[0] === '--local') {
  await verifierLocal(args[1], args[2]);
} else {
  const [version, tgz, umd] = args;
  await verifierComplet(version, tgz, umd);
}
