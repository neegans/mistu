// Connexions réservées au cluster jetable créé par tools/prouver.mjs.
// Une validation du manifeste ne remplace jamais la garde de la connexion physique.
import { execFileSync, spawn } from 'node:child_process';
import { constants, openSync, closeSync, fstatSync, readFileSync, lstatSync, realpathSync, accessSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const MAX_SORTIE = 32 * 1024 * 1024;
const DELAI = 60_000;
const CHAMPS = ['format', 'nonce', 'root', 'data', 'socket', 'pgBin', 'port', 'host', 'owner', 'uid', 'databases'];
const nomBase = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,62}$/.test(value);
const citer = value => "'" + String(value).replaceAll("'", "''") + "'";
const refuser = message => { const erreur = new Error('Contexte PostgreSQL local refusé : ' + message); erreur.code = 'PREUVE_CONTEXTE_INVALIDE'; throw erreur; };

function dossierPrive(chemin, uid) {
  if (typeof chemin !== 'string' || !chemin || resolve(chemin) !== chemin) refuser('chemin non absolu');
  const stat = lstatSync(chemin);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(chemin) !== chemin || stat.uid !== uid || (stat.mode & 0o777) !== 0o700) refuser('dossier non privé ou non canonique');
}

function lireManifeste(database) {
  if (process.env.L1_PROOF_LOCAL !== '1' || !process.env.MISTU_PROOF_CONTEXT) refuser('L1_PROOF_LOCAL=1 et MISTU_PROOF_CONTEXT requis');
  if (!nomBase(database) || typeof process.getuid !== 'function') refuser('base ou utilisateur local invalide');
  const chemin = process.env.MISTU_PROOF_CONTEXT;
  if (resolve(chemin) !== chemin || basename(chemin) !== 'contexte.json' || realpathSync(chemin) !== chemin) refuser('manifeste non canonique');
  const fd = openSync(chemin, constants.O_RDONLY | constants.O_NOFOLLOW);
  let manifeste;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.size > 65536) refuser('manifeste non privé');
    manifeste = JSON.parse(readFileSync(fd, 'utf8'));
  } finally { closeSync(fd); }
  if (!manifeste || Array.isArray(manifeste) || typeof manifeste !== 'object' || Object.keys(manifeste).length !== CHAMPS.length || CHAMPS.some(c => !Object.hasOwn(manifeste, c))) refuser('format du manifeste');
  const m = manifeste;
  if (m.format !== 1 || typeof m.nonce !== 'string' || !/^[a-f0-9]{32,128}$/.test(m.nonce) || m.host !== '127.0.0.1' || m.owner !== 'postgres' || m.uid !== process.getuid()
    || !Number.isInteger(m.port) || m.port < 1024 || m.port > 65535 || !Array.isArray(m.databases) || !m.databases.length || m.databases.length > 256
    || m.databases.some(n => !nomBase(n)) || new Set(m.databases).size !== m.databases.length || !m.databases.includes(database)) refuser('identité déclarée');
  dossierPrive(m.root, m.uid);
  if (dirname(m.root) !== realpathSync('/tmp') || !/^mistu-preuves-[A-Za-z0-9_-]+$/.test(basename(m.root)) || chemin !== join(m.root, 'contexte.json')) refuser('racine non réservée aux preuves');
  if (m.data !== join(m.root, 'data') || m.socket !== join(m.root, 'socket')) refuser('données ou socket hors de la racine');
  dossierPrive(m.data, m.uid); dossierPrive(m.socket, m.uid);
  if (typeof m.pgBin !== 'string' || resolve(m.pgBin) !== m.pgBin || realpathSync(m.pgBin) !== m.pgBin || !lstatSync(m.pgBin).isDirectory()) refuser('répertoire PostgreSQL non canonique');
  const pg = join(m.pgBin, 'psql'), executable = lstatSync(pg);
  if (!executable.isFile() || executable.isSymbolicLink()) refuser('exécutable PostgreSQL invalide');
  accessSync(pg, constants.X_OK);
  return { m, pg };
}

const projectionIdentite = `pg_catalog.json_build_object(
  'nonce',current_setting('mistu.proof_nonce',true),'data',current_setting('data_directory'),
  'port',inet_server_port(),'owner',current_user,'session_owner',session_user,
  'database',current_database(),'encoding',current_setting('server_encoding'))`;

export function chargerContextePreuve(database) {
  const { m, pg } = lireManifeste(database);
  // Aucun PGHOST/PGSERVICE/PGOPTIONS/PGPASSWORD hérité ne choisit la destination ou le nonce.
  const env = Object.freeze({ ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('PG'))),
    PGSERVICEFILE: '/dev/null', PGPASSFILE: '/dev/null', PGCONNECT_TIMEOUT: '5', PGCLIENTENCODING: 'UTF8',
    PGOPTIONS: '-c statement_timeout=60000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=60000' });
  const args = Object.freeze(['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', m.host, '-p', String(m.port), '-U', m.owner, '-d', database]);
  const brut = sql => execFileSync(pg, args, { input: sql, encoding: 'utf8', env, timeout: DELAI, killSignal: 'SIGKILL', maxBuffer: MAX_SORTIE, stdio: ['pipe', 'pipe', 'pipe'] });
  const identite = JSON.parse(brut(`begin read only; select ${projectionIdentite}; rollback;`));
  if (identite.nonce !== m.nonce || identite.data !== m.data || identite.port !== m.port || identite.owner !== m.owner || identite.session_owner !== m.owner || identite.database !== database || identite.encoding !== 'UTF8') refuser('serveur différent du cluster jetable');
  const garde = `do $mistu_preuve$ begin
    if current_setting('mistu.proof_nonce',true) is distinct from ${citer(m.nonce)}
      or current_setting('data_directory') is distinct from ${citer(m.data)}
      or inet_server_port() is distinct from ${m.port}
      or current_user is distinct from 'postgres' or session_user is distinct from 'postgres'
      or current_database() is distinct from ${citer(database)} or current_setting('server_encoding') is distinct from 'UTF8'
    then raise exception using errcode='55000',message='Serveur de preuve local différent'; end if;
  end $mistu_preuve$;\n`;
  const run = sql => { if (typeof sql !== 'string') throw new TypeError('SQL de preuve attendu'); return brut(garde + sql); };

  function client(name) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,63}$/.test(name)) throw new TypeError('Nom de connexion de preuve invalide');
    const p = spawn(pg, args, { env: { ...env, PGAPPNAME: name }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '', termine = false, octets = 0, cloture = null, escalation = null;
    const arreter = () => {
      if (termine) return;
      p.kill('SIGTERM');
      if (!escalation) escalation = setTimeout(() => { if (!termine) p.kill('SIGKILL'); }, 1000);
    };
    const recevoir = (type, texte) => {
      octets += Buffer.byteLength(texte, 'utf8');
      if (octets > MAX_SORTIE) { if (!err.includes('Sortie de preuve trop grande')) err += '\nSortie de preuve trop grande'; arreter(); return; }
      if (type === 'out') out += texte; else err += texte;
    };
    p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8');
    p.stdout.on('data', b => recevoir('out', b)); p.stderr.on('data', b => recevoir('err', b));
    p.stdin.on('error', e => { if (!termine && e.code !== 'EPIPE') err += '\n' + e.message; });
    p.on('error', e => { err += '\n' + e.message; });
    const delai = setTimeout(() => { err += '\nDélai de connexion de preuve dépassé'; arreter(); }, DELAI);
    const done = new Promise(resoudre => p.on('close', (code, signal) => {
      termine = true; clearTimeout(delai); if (escalation) clearTimeout(escalation);
      resoudre({ code, signal, out, err });
    }));
    const ecrire = (sql, finir) => {
      if (typeof sql !== 'string' || termine || p.stdin.destroyed || p.stdin.writableEnded) throw new Error('Connexion de preuve fermée ou SQL invalide');
      if (finir) p.stdin.end(sql + '\n'); else p.stdin.write(sql + '\n');
    };
    // Une fois par connexion : les commandes suivantes peuvent passer sous authenticated.
    p.stdin.write(garde);
    const fermer = () => { if (!cloture) { arreter(); cloture = done; } return cloture; };
    return { send: sql => ecrire(sql, false), finish: sql => ecrire(sql, true), done, get out() { return out; }, get err() { return err; }, fermer };
  }
  return { pg, args, env, identite: Object.freeze(identite), run, client };
}
