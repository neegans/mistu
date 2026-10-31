// Rejeu local uniquement : chaque lancement possède son cluster et ses clones.
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { chargerContextePreuve } from './preuves-postgres-contexte.mjs';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length > 2) {
  if (process.argv.length === 3 && process.argv[2] === '--aide') {
    console.log('Usage : [MISTU_PGBIN=/repertoire/postgresql17/bin] sh tools/prouver.sh\nCrée un cluster temporaire local, rejoue les 14 migrations et tous les prover-*.mjs, puis ferme et retire sa base. Les reçus sont conservés.');
    process.exit(0);
  }
  throw Error('Argument inconnu ; utiliser --aide.');
}
if (process.getuid?.() === 0) throw Error('PostgreSQL initdb doit être lancé par un utilisateur ordinaire, pas root.');
if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Node 24 requis pour ce rejeu.');
const envPropre = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('PG') && k !== 'MISTU_PROOF_CONTEXT' && k !== 'L1_PROOF_LOCAL'));
const binaires = () => {
  let dossier = process.env.MISTU_PGBIN;
  if (!dossier) {
    try { dossier = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8', env: envPropre, timeout: 5000 }).trim(); }
    catch { throw Error('PostgreSQL 17 requis : indiquer MISTU_PGBIN ou rendre pg_config disponible dans PATH.'); }
  }
  const bin = realpathSync(dossier);
  for (const nom of ['initdb', 'pg_ctl', 'psql']) {
    const outil = join(bin, nom);
    if (!statSync(outil).isFile()) throw Error('Binaire PostgreSQL manquant : ' + nom);
    const version = execFileSync(outil, ['--version'], { encoding: 'utf8', env: envPropre, timeout: 5000 }).trim();
    if (!/\(PostgreSQL\) 17(?:\.\d+)*(?:\s|$)/.test(version)) throw Error('PostgreSQL 17 requis pour ' + nom);
  }
  return bin;
};
const pgBin = binaires();
const root = realpathSync(mkdtempSync('/tmp/mistu-preuves-'));
const data = join(root, 'data'), socket = join(root, 'socket'), logs = join(root, 'logs');
mkdirSync(socket, { mode: 0o700 }); mkdirSync(logs, { mode: 0o700 });
const cheminContexte = join(root, 'contexte.json'), cheminResultat = join(root, 'resultat.json');
const programmes = readdirSync(join(racine, 'tools')).filter(n => /^prover-[a-z0-9-]+\.mjs$/.test(n)).sort();
const directs = new Map([
  ['prover-cuisine-concurrence.mjs', 'mistu_l7_rejeu'],
  ['prover-inventaire-concurrence.mjs', 'mistu_l8_rejeu'],
  ['prover-purge-tombales.mjs', 'mistu_audit_c_rejeu'],
]);
const base = 'mistu_preuves_socle';
const clones = programmes.map((nom, i) => directs.get(nom) || 'mistu_preuves_' + String(i + 1).padStart(2, '0'));
const manifeste = { format: 1, nonce: randomBytes(24).toString('hex'), root, data, socket, pgBin, port: null, host: '127.0.0.1', owner: 'postgres', uid: process.getuid(), databases: ['postgres', base, ...clones] };
const bilan = { format: 1, debut: new Date().toISOString(), root, statut: 'en_cours', migrations: [], programmes, preuves: [], cron: 'Registre simulé : commandes enregistrées, jamais planifiées ni exécutées par un ordonnanceur.', clusterArrete: false, dataSupprime: false };
const sauvegarder = () => writeFileSync(cheminResultat, JSON.stringify(bilan, null, 2) + '\n', { mode: 0o600 });
const enfants = new Set(); let interruption = null;
const interrompre = signal => { interruption = signal; for (const enfant of enfants) enfant.kill('SIGTERM'); };
const surInterrupt = () => interrompre('SIGINT'), surTerm = () => interrompre('SIGTERM');
process.on('SIGINT', surInterrupt); process.on('SIGTERM', surTerm);
console.log('Reçus : ' + root); sauvegarder();

function executer(outil, args, { input, log, timeout = 120000, env = envPropre } = {}) {
  if (interruption) return Promise.reject(Error('Interrompu par ' + interruption));
  return new Promise((resoudre, rejeter) => {
    const enfant = spawn(outil, args, { cwd: racine, env, stdio: ['pipe', 'pipe', 'pipe'] });
    enfant.stdout.setEncoding('utf8'); enfant.stderr.setEncoding('utf8');
    enfants.add(enfant); let out = '', err = '', probleme = null, tuer;
    const arreter = motif => { probleme ||= motif; enfant.kill('SIGTERM'); tuer ||= setTimeout(() => enfant.kill('SIGKILL'), 2000); };
    const delai = setTimeout(() => arreter('Délai dépassé'), timeout);
    if (log) writeFileSync(log, '', { mode: 0o600 });
    enfant.stdout.on('data', x => { out += x; if (log) appendFileSync(log, x); if (Buffer.byteLength(out) > 64 * 1024 * 1024) arreter('Sortie trop volumineuse'); });
    enfant.stderr.on('data', x => { err += x; if (log) appendFileSync(log, x); if (Buffer.byteLength(err) > 8 * 1024 * 1024) arreter('Erreur trop volumineuse'); });
    enfant.on('error', e => { probleme = e.message; });
    enfant.stdin.on('error', e => { if (e.code !== 'EPIPE') probleme = e.message; });
    enfant.on('close', (code, signal) => {
      clearTimeout(delai); clearTimeout(tuer); enfants.delete(enfant);
      if (code === 0 && !probleme && !interruption) resoudre(out);
      else rejeter(Object.assign(Error(`${probleme || interruption || 'Commande refusée'} : ${outil.split('/').at(-1)} (code ${code}, signal ${signal || 'aucun'})`), { stdout: out, stderr: err }));
    });
    enfant.stdin.end(input);
  });
}
const portLibre = async () => {
  for (let essai = 0; essai < 10; essai++) {
    const port = await new Promise((resoudre, rejeter) => {
      const serveur = net.createServer(); serveur.once('error', rejeter);
      serveur.listen(0, '127.0.0.1', () => { const n = serveur.address().port; serveur.close(error => error ? rejeter(error) : resoudre(n)); });
    });
    if (![55439, 55449].includes(port)) return port;
  }
  throw Error('Aucun port de preuve disponible hors des ports historiques.');
};
const empreinte = texte => createHash('sha256').update(texte).digest('hex');
const qIdent = nom => { if (!/^[a-z][a-z0-9_]{0,62}$/.test(nom)) throw Error('Nom de base invalide'); return '"' + nom + '"'; };
let lance = false;
try {
  if (programmes.length !== 30 || [...directs.keys()].some(n => !programmes.includes(n))) throw Error('Inventaire attendu : 27 générateurs SQL et trois exécuteurs. Mettre à jour le contrat si un prouveur est ajouté.');
  await executer(join(pgBin, 'initdb'), ['-D', data, '-U', 'postgres', '--encoding=UTF8', '--locale=C', '--auth=trust'], { log: join(logs, 'initdb.log') });
  manifeste.port = await portLibre();
  writeFileSync(cheminContexte, JSON.stringify(manifeste, null, 2) + '\n', { mode: 0o600 });
  await executer(join(pgBin, 'pg_ctl'), ['-D', data, '-l', join(logs, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${manifeste.port} -k ${socket} -c mistu.proof_nonce=${manifeste.nonce}`, '-w', '-t', '20', 'start'], { log: join(logs, 'demarrage.log'), timeout: 30000 });
  lance = true;
  process.env.MISTU_PROOF_CONTEXT = cheminContexte; process.env.L1_PROOF_LOCAL = '1';
  const env = { ...envPropre, MISTU_PROOF_CONTEXT: cheminContexte, L1_PROOF_LOCAL: '1' };
  const admin = chargerContextePreuve('postgres'); bilan.identite = admin.identite;
  admin.run(`create database ${qIdent(base)} template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C';`);
  const socle = chargerContextePreuve(base);
  writeFileSync(join(logs, 'bootstrap.log'), socle.run(readFileSync(join(racine, 'tools/preuves-postgres-bootstrap.sql'), 'utf8')));
  const migrations = readdirSync(join(racine, 'supabase/migrations')).filter(n => /^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
  if (migrations.length !== 14 || migrations.some((n, i) => Number(n.slice(0, 4)) !== i + 1)) throw Error('Migrations 0001 à0014 requises, sans trou ni doublon.');
  for (const nom of migrations) {
    const original = readFileSync(join(racine, 'supabase/migrations', nom), 'utf8'); let sql = original;
    if (nom.startsWith('0001_')) {
      const cible = 'create extension if not exists pg_cron;';
      if (sql.split(cible).length !== 2) throw Error('Adaptation locale pg_cron absente ou ambiguë.');
      sql = sql.replace(cible, '-- pg_cron : registre local de preuve, sans ordonnanceur.');
    }
    writeFileSync(join(logs, nom + '.log'), socle.run(sql));
    bilan.migrations.push({ nom, sha256: empreinte(original), adaptation: nom.startsWith('0001_') ? 'Extension remplacée uniquement en mémoire par le registre local cron.' : null });
    sauvegarder();
  }
  bilan.cronEnregistres = JSON.parse(socle.run("select coalesce(json_agg(j order by jobname),'[]') from cron.job j;"));
  for (const [i, nom] of programmes.entries()) {
    const database = clones[i], debut = Date.now(), prefixe = join(logs, nom);
    const recu = { nom, database, mode: directs.has(nom) ? 'executeur' : 'sql', statut: 'en_cours' };
    bilan.preuves.push(recu); sauvegarder(); console.log(`${i + 1}/${programmes.length} ${nom}`);
    try {
      admin.run(`create database ${qIdent(database)} template ${qIdent(base)};`);
      // Chaque clone est revérifié avant de confier sa connexion à la preuve.
      const contexte = chargerContextePreuve(database);
      if (directs.has(nom)) {
        const stdout = await executer(process.execPath, [join(racine, 'tools', nom), database], { env, log: prefixe + '.log' });
        const preuve = JSON.parse(stdout), controles = preuve.proofs ?? preuve.preuves;
        if (preuve.database !== database || !Array.isArray(controles) || !controles.length || controles.some(c => c.ok !== true)) throw Error('Bilan de prouveur incomplet ou refusé : ' + nom);
        recu.controles = controles.length;
      } else {
        const sql = await executer(process.execPath, [join(racine, 'tools', nom)], { env, log: prefixe + '.generation.log' });
        if (!sql.trim()) throw Error('Le générateur ne produit aucun SQL : ' + nom);
        writeFileSync(prefixe + '.sql.log', contexte.run(sql));
      }
      recu.statut = 'reussi';
    } catch (error) { recu.statut = 'echec'; recu.erreur = error.message; if (error.stderr) writeFileSync(prefixe + '.erreur.log', error.stderr); throw error; }
    finally { recu.duree_ms = Date.now() - debut; sauvegarder(); }
  }
  bilan.statut = 'reussi';
} catch (error) {
  bilan.statut = interruption ? 'interrompu' : 'echec'; bilan.erreur = error.message;
  if (error.stderr) writeFileSync(join(logs, 'erreur.log'), error.stderr);
  process.exitCode = 1;
} finally {
  // Ni recherche par port, ni arrêt d'un serveur préexistant : uniquement notre PGDATA.
  try {
    if (existsSync(join(data, 'postmaster.pid'))) {
      const garde = JSON.parse(readFileSync(cheminContexte, 'utf8'));
      const pidData = readFileSync(join(data, 'postmaster.pid'), 'utf8').split('\n')[1];
      if (garde.nonce !== manifeste.nonce || garde.root !== root || garde.data !== data || statSync(root).uid !== process.getuid() || realpathSync(pidData) !== data) throw Error('Nettoyage refusé : propriété du cluster non confirmée.');
      // execFileSync ici seulement pour le nettoyage, même après un signal.
      const stopArgs = ['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop'];
      try { execFileSync(join(pgBin, 'pg_ctl'), stopArgs, { env: envPropre, encoding: 'utf8', timeout: 25000, stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (error) { writeFileSync(join(logs, 'arret-rapide-erreur.log'), String(error.stderr || error.message)); execFileSync(join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', '-t', '10', 'stop'], { env: envPropre, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }); }
    }
    bilan.clusterArrete = !existsSync(join(data, 'postmaster.pid'));
    if (!bilan.clusterArrete) throw Error('Le cluster temporaire est encore actif.');
    rmSync(data, { recursive: true, force: true }); rmSync(socket, { recursive: true, force: true }); bilan.dataSupprime = true;
  } catch (error) { bilan.nettoyageErreur = error.message; bilan.statut = 'echec'; process.exitCode = 1; }
  bilan.clusterLance = lance; bilan.fin = new Date().toISOString(); sauvegarder();
  process.removeListener('SIGINT', surInterrupt); process.removeListener('SIGTERM', surTerm);
  const reussies = bilan.preuves.filter(p => p.statut === 'reussi').length;
  console.log(`${bilan.statut === 'reussi' ? '✓' : '✗'} ${reussies}/${programmes.length} prouveurs réussis ; ${bilan.preuves.length} tentés. Reçu : ${cheminResultat}`);
  if (bilan.erreur) console.error(bilan.erreur);
}
