import { panneauCycleRecette, panneauCycleLivre } from '../src/ui/corbeille.js';
import { getData, getSyncState, setSyncState } from '../src/ui/state.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';

const HORS_LIGNE = "Tu es hors ligne : impossible de vérifier pour l'instant.";
const ECHEC = 'La disponibilité n’a pas pu être vérifiée. Réessaie.';
const differe = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const bouton = (root, texte) => [...root.querySelectorAll('button')].find(n => n.textContent === texte);
const attendre = async condition => { const limite = performance.now() + 4000; while (!await condition()) { if (performance.now() > limite) throw Error('État de disponibilité non observé'); await new Promise(r => setTimeout(r, 5)); } };
const cle = type => (type === 'recette' ? 'lifecycle-capability:' : 'edition-lifecycle-capability:') + 'dispo-owner';
async function fixture(repo, db, type, moteur, owner = 'dispo-owner') {
  const edition = { id: 'dispo-ed', book_id: 'dispo-book' }, recipe = { id: 'dispo-r', original_title: 'Pain', availability: 'reference_only', ...(type === 'membre' ? { edition_id: edition.id } : {}) };
  await db.mutate({ origin: 'remote', puts: { books: [{ id: edition.book_id, title: 'Livre' }], book_editions: [edition], recipes: [recipe] } });
  await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: owner }] } });
  const ctx = { ...await getData(true), sync: { moteur } };
  const ouvrir = async (R = repo) => type === 'livre' ? panneauCycleLivre(edition, ctx, { repo: R }) : panneauCycleRecette(recipe, ctx, { repo: R });
  return { recipe, edition, ctx, ouvrir };
}

export async function runAuditCorbeilleDisponibiliteTests({ eq, ok }) {
  const locale = getUiLocale(), sync = getSyncState(), propre = Object.getOwnPropertyDescriptor(navigator, 'onLine'), roots = [];
  let enLigne = true;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => enLigne }); setUiLocale('fr');
  const monter = root => { document.body.append(root); roots.push(root); return root; };
  const run = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, `Disponibilité11.2 ${nom} : ${e.stack || e}`); } finally { for (const r of roots.splice(0)) { r.dispose?.(); r.remove(); } enLigne = true; } };
  const verifier = async root => { const b = bouton(root, 'Vérifier la disponibilité'); b.click(); await attendre(() => !b.disabled); return b; };
  try {
    for (const type of ['recette', 'membre', 'livre']) await run(type + ' hors ligne puis confirmation', async (repo, db) => {
      let appels = 0;
      const f = await fixture(repo, db, type, { envoyerMaintenant: async () => { appels++; await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle(type), value: { protocol: 1 } }] } }); } });
      const root = monter(await f.ouvrir()), action = bouton(root, 'Mettre à la corbeille'), avant = await db.getAll('outbox');
      eq(action.disabled, true, `Disponibilité11.2 ${type} : inconnue au départ`);
      enLigne = false; await verifier(root);
      eq(appels, 0, `Disponibilité11.2 ${type} : hors ligne sans envoyerMaintenant`);
      eq(root.querySelector('[role=status]').textContent, HORS_LIGNE, `Disponibilité11.2 ${type} : phrase hors ligne exacte`);
      eq(action.disabled, true, `Disponibilité11.2 ${type} : hors ligne n’autorise pas`);
      eq((await db.get('sync_state', cle(type))) ?? null, null, `Disponibilité11.2 ${type} : aucune capacité inventée hors ligne`);
      eq(await db.getAll('outbox'), avant, `Disponibilité11.2 ${type} : vérification sans commande métier`);
      enLigne = true;
      if (bouton(root, 'Vérifier la disponibilité')) await verifier(root);
      eq(appels, 1, `Disponibilité11.2 ${type} : retour en ligne lance une seule vérification`);
      eq((await db.get('sync_state', cle(type)))?.value?.protocol, 1, `Disponibilité11.2 ${type} : confirmation réellement durable`);
      eq([action.disabled, !!bouton(root, 'Vérifier la disponibilité'), document.activeElement === action], [false, false, true], `Disponibilité11.2 ${type} : activation et focus après confirmation`);
    });
    for (const type of ['recette', 'livre']) for (const mode of ['rejet', 'sans_capacite', 'protocole_invalide', 'autre_compte']) await run(type + ' ' + mode, async (repo, db) => {
      let appels = 0;
      const f = await fixture(repo, db, type, { envoyerMaintenant: async () => {
        appels++;
        if (mode === 'rejet') throw Error('serveur indisponible');
        if (mode === 'protocole_invalide') await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle(type), value: { protocol: '1' } }] } });
        if (mode === 'autre_compte') await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle(type).replace('dispo-owner', 'autre-owner'), value: { protocol: 1 } }] } });
        return { capacites: { recipe_lifecycle: 1, edition_lifecycle: 1 } };
      } });
      const root = monter(await f.ouvrir()); await verifier(root);
      eq(appels, 1, `Disponibilité11.2 ${type}/${mode} : vérification réellement tentée`);
      eq(root.querySelector('[role=status]').textContent, ECHEC, `Disponibilité11.2 ${type}/${mode} : échec visible sans conseil de connexion inventé`);
      eq(bouton(root, 'Mettre à la corbeille').disabled, true, `Disponibilité11.2 ${type}/${mode} : aucune autorisation sans preuve locale valide`);
    });
    for (const type of ['recette', 'livre']) await run(type + ' attente réelle', async (repo, db) => {
      const debut = differe(), fin = differe(); let appels = 0;
      const f = await fixture(repo, db, type, { envoyerMaintenant: async () => { appels++; debut.resolve(); await fin.promise; await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle(type), value: { protocol: 1 } }] } }); } });
      const root = monter(await f.ouvrir()), b = bouton(root, 'Vérifier la disponibilité'); b.click(); await debut.promise; b.click();
      eq([appels, b.disabled, bouton(root, 'Mettre à la corbeille').disabled], [1, true, true], `Disponibilité11.2 ${type} : un seul envoi et aucune activation pendant l’attente`);
      fin.resolve(); await attendre(() => !b.disabled);
      eq(bouton(root, 'Mettre à la corbeille').disabled, false, `Disponibilité11.2 ${type} : résultat durable attendu avant activation`);
    });
    for (const type of ['recette', 'livre']) for (const voisin of ['anonyme', 'connue']) await run(type + ' ' + voisin, async (repo, db) => {
      let appels = 0; const f = await fixture(repo, db, type, { envoyerMaintenant: async () => { appels++; } }, voisin === 'anonyme' ? null : 'dispo-owner');
      if (voisin === 'connue') await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle(type), value: { protocol: 1 } }] } });
      enLigne = false; const root = monter(await f.ouvrir());
      eq([bouton(root, 'Mettre à la corbeille').disabled, !!bouton(root, 'Vérifier la disponibilité'), appels], [false, false, 0], `Disponibilité11.2 ${type}/${voisin} : usage local préservé hors ligne sans nouveau réseau`);
    });
    for (const type of ['recette', 'livre']) for (const course of ['compte', 'generation', 'route', 'connexion']) await run(type + ' portée ' + course, async (repo, db) => {
      const debut = differe(), fin = differe();
      const f = await fixture(repo, db, type, { envoyerMaintenant: async () => { debut.resolve(); await fin.promise; } });
      const root = monter(await f.ouvrir()), b = bouton(root, 'Vérifier la disponibilité'), action = bouton(root, 'Mettre à la corbeille'); b.click(); await debut.promise;
      await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle(type), value: { protocol: 1 } }] } });
      if (course === 'compte') await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'autre-owner' }] } });
      if (course === 'generation') setSyncState({});
      if (course === 'route') root.remove();
      if (course === 'connexion') { db.idb.close(); db.idb = null; await db.open(); }
      const avant = await db.getAll('outbox'); fin.resolve(); await attendre(() => !b.disabled);
      eq(action.disabled, true, `Disponibilité11.2 ${type}/${course} : ancien panneau non réactivé par un retour tardif`);
      eq(await db.getAll('outbox'), avant, `Disponibilité11.2 ${type}/${course} : aucune écriture métier au retour tardif`);
    });
    await run('base remplacée', async (repo, db) => {
      const debut = differe(), fin = differe(), f = await fixture(repo, db, 'recette', { envoyerMaintenant: async () => { debut.resolve(); await fin.promise; } });
      const root = monter(await f.ouvrir()), b = bouton(root, 'Vérifier la disponibilité'); b.click(); await debut.promise;
      await withDatabase(async autre => {
        await autre.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'dispo-owner' }, { key: cle('recette'), value: { protocol: 1 } }] } }); repo.bindDatabase(autre);
        try { fin.resolve(); await attendre(() => !b.disabled); eq(bouton(root, 'Mettre à la corbeille').disabled, true, 'Disponibilité11.2 : nouvelle base ne réactive pas un ancien panneau'); }
        finally { repo.bindDatabase(db); }
      });
    });
    await run('compte changé pendant lecture de capacité', async (repo, db) => {
      let lectureTardive = false, atteint = false;
      const f = await fixture(repo, db, 'recette', { envoyerMaintenant: async () => { await db.mutate({ origin: 'remote', puts: { sync_state: [{ key: cle('recette'), value: { protocol: 1 } }] } }); lectureTardive = true; } });
      const dbLu = Object.create(db); dbLu.get = async (store, key) => { const row = await db.get(store, key); if (lectureTardive && key === cle('recette')) { atteint = true; await db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'autre-owner' }] } }); } return row; };
      const R = { ...repo, db: dbLu }, root = monter(await f.ouvrir(R)); await verifier(root);
      eq(atteint, true, 'Disponibilité11.2 : course atteint la vraie relecture durable de capacité');
      eq(bouton(root, 'Mettre à la corbeille').disabled, true, 'Disponibilité11.2 : propriétaire relu après le dernier await de capacité');
    });
  } finally {
    for (const r of roots) { r.dispose?.(); r.remove(); }
    if (propre) Object.defineProperty(navigator, 'onLine', propre); else delete navigator.onLine;
    setUiLocale(locale); setSyncState(sync);
  }
}
