// Suite réelle dans un profil neuf. Aucun serveur, compte ou navigateur personnel.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const depot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fichiersRacine = new Set(['index.html', 'styles.css', 'sw.js', 'sw-rules.js', 'manifest.webmanifest', 'livraison-manifeste.json', 'README.md']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8' };
// Incidents injectés par sync, import-cible et index-livre-ecran. Ni préfixe
// générique, ni TypeError/ReferenceError ne constituent une exception admise.
const journauxAttendus = new Set([
  '[cuisine-os] sync.push {reason: reseau}',
  // audit-commandes-protegees : erreurs HTTP explicites du transport injecté.
  '[cuisine-os] sync.push {status: 401, reason: auth}',
  '[cuisine-os] sync.push {status: 413, reason: quota}',
  '[cuisine-os] sync.push {status: 503, reason: reseau}',
  '[cuisine-os] sync.push {status: 404, reason: inconnu}',
  '[cuisine-os] sync.push {status: 400, reason: refus}',
  '[cuisine-os] index_livre.saisie {name: ErreurCycleRecette}',
  '[cuisine-os] index_livre.relecture {name: ErreurCycleRecette}',
  '[cuisine-os] index_livre.retirer {name: ErreurCycleRecette}',
  '[cuisine-os] import_cible.incertain {id: imp-vol-compte, name: ErreurCycleRecette}',
  '[cuisine-os] sync.pull.forme {table: inventory}',
]);

async function serveurStatique(racine, erreur) {
  const base = await realpath(racine);
  const serveur = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const refuser = code => { erreur('http', `${code} ${new URL(req.url, 'http://localhost').pathname}`); res.writeHead(code).end(); };
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { refuser(405); return; }
      let chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
      if (chemin === 'favicon.ico') { res.writeHead(204).end(); return; }
      if (!chemin || chemin.endsWith('/')) chemin += 'index.html';
      const morceaux = chemin.split('/');
      if (morceaux.some(m => !m || m.startsWith('.') || m.includes('\\')) || (!['src', 'tests', 'icons'].includes(morceaux[0]) && !fichiersRacine.has(chemin))) { refuser(404); return; }
      const fichier = await realpath(join(base, chemin)), rel = relative(base, fichier);
      if (rel.startsWith('..' + sep) || isAbsolute(rel) || rel.split(sep).some(m => m.startsWith('.')) || !(await stat(fichier)).isFile()) { refuser(404); return; }
      const contenu = await readFile(fichier);
      res.writeHead(200, { 'Content-Type': mime[extname(fichier)] || 'application/octet-stream', 'Content-Length': contenu.length });
      res.end(req.method === 'HEAD' ? undefined : contenu);
    } catch { refuser(404); }
  });
  await new Promise((ok, non) => { serveur.once('error', non); serveur.listen(0, '127.0.0.1', ok); });
  return { serveur, origine: `http://127.0.0.1:${serveur.address().port}` };
}

export async function verifierNavigateur({ racine = depot, dossierResultats = join(depot, 'artifacts/ci-navigateur'), delaiMs = 1_800_000 } = {}) {
  if (!Number.isSafeInteger(delaiMs) || delaiMs <= 0) throw new TypeError('Délai positif requis');
  await mkdir(dossierResultats, { recursive: true });
  const sortie = await mkdtemp(join(dossierResultats, 'passage-'));
  const resultat = { succes: false, debut: new Date().toISOString(), node: process.version, versionNavigateur: null, bilan: null, assertions: 0, echecs: [], erreurs: [], consoleAttendue: 0, serveurFerme: false, navigateurFerme: false, sortie };
  const journal = [];
  let serveur, navigateur, page, minuteur;
  let signaler;
  const incident = new Promise(resoudre => { signaler = resoudre; });
  const erreur = (type, message) => {
    const entree = { type, message: String(message).slice(0, 4000) };
    resultat.erreurs.push(entree); journal.push(entree); signaler();
  };
  const cheminSur = url => { try { const u = new URL(url); return u.protocol === 'blob:' ? 'blob:temporaire' : u.pathname; } catch { return 'adresse illisible'; } };
  try {
    const local = await serveurStatique(racine, erreur); serveur = local.serveur;
    const pret = await fetch(local.origine + '/tests/');
    if (!pret.ok || !(pret.headers.get('content-type') || '').startsWith('text/html')) throw Error('Page de tests absente du serveur local');
    await pret.arrayBuffer();
    navigateur = await chromium.launch({ headless: true });
    resultat.versionNavigateur = navigateur.version();
    const contexte = await navigateur.newContext({ serviceWorkers: 'block', timezoneId: 'America/Toronto' });
    await contexte.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(local.origine + '/') || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
      erreur('reseau-exterieur', 'Requête extérieure bloquée (' + route.request().resourceType() + ')');
      return route.abort();
    });
    page = await contexte.newPage();
    page.on('pageerror', e => erreur('javascript', e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      if (journauxAttendus.has(m.text()) && m.location().url === local.origine + '/src/core/log.js') { resultat.consoleAttendue++; journal.push({ type: 'console-attendue', message: m.text() }); return; }
      erreur('console', m.text());
    });
    page.on('requestfailed', r => erreur('reseau', cheminSur(r.url()) + ' : ' + r.failure()?.errorText));
    page.on('response', r => { if (r.status() >= 400) erreur('http', `${r.status()} ${cheminSur(r.url())}`); });
    minuteur = setTimeout(() => erreur('delai', 'La suite ne produit pas son bilan dans le délai prévu'), delaiMs);
    const terminer = async () => {
      await page.goto(local.origine + '/tests/', { waitUntil: 'load', timeout: 60_000 });
      await page.waitForFunction(() => document.querySelector('#out h2') || document.querySelector('#out > .ko'), null, { timeout: delaiMs });
      const lu = await page.evaluate(() => ({
        bilan: document.querySelector('#out h2')?.textContent || '',
        verts: document.querySelectorAll('#out > .ok').length,
        echecs: [...document.querySelectorAll('#out .ko')].map(n => n.textContent),
      }));
      resultat.bilan = lu.bilan; resultat.echecs = lu.echecs;
      const nombres = /^✅ ([1-9]\d*)\/([1-9]\d*) tests réussis$/.exec(lu.bilan);
      if (!nombres || nombres[1] !== nombres[2] || lu.echecs.length || lu.verts !== Number(nombres[2])) erreur('bilan', 'Bilan incomplet, contradictoire ou comportant un échec');
      else resultat.assertions = Number(nombres[2]);
    };
    // La panne d'une ressource ou de JavaScript interrompt l'attente du bilan.
    await Promise.race([terminer().catch(e => erreur('execution', e.message)), incident]);
    if (!resultat.erreurs.length) {
      // Laisser remonter les événements réseau/console déjà émis par les dernières assertions.
      await page.waitForTimeout(100);
    }
    resultat.succes = !!resultat.assertions && !resultat.erreurs.length;
  } catch (e) { erreur('execution', e.message); }
  finally {
    clearTimeout(minuteur);
    if (page && !page.isClosed()) {
      try { await page.screenshot({ path: join(sortie, 'bilan.png'), timeout: 5000 }); }
      catch (e) { journal.push({ type: 'capture', message: e.message.slice(0, 1000) }); }
    }
    if (navigateur) { try { await navigateur.close(); resultat.navigateurFerme = true; } catch (e) { erreur('nettoyage', e.message); } }
    else resultat.navigateurFerme = true;
    if (serveur) {
      serveur.closeAllConnections();
      await new Promise(ok => serveur.close(e => { if (e) erreur('nettoyage', e.message); else resultat.serveurFerme = true; ok(); }));
    } else resultat.serveurFerme = true;
    resultat.succes &&= !resultat.erreurs.length;
    resultat.fin = new Date().toISOString();
    await writeFile(join(sortie, 'journal.json'), JSON.stringify(journal, null, 2) + '\n');
    await writeFile(join(sortie, 'resultat.json'), JSON.stringify(resultat, null, 2) + '\n');
  }
  return resultat;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await verifierNavigateur();
  console.log(r.bilan || 'Aucun bilan navigateur');
  for (const e of r.erreurs) console.error(e.type + ' : ' + e.message);
  console.log('Reçu : ' + r.sortie);
  process.exitCode = r.succes ? 0 : 1;
}
