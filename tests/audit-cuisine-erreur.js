import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { fixtureCuisineL7 } from './l7-cuisine-ecran.js';
import { renderCook } from '../src/ui/cook.js';
import { creerServiceCuisine } from '../src/domain/cuisine-persistance.js';
import { getData, getSyncGeneration, getSyncState, setSyncState } from '../src/ui/state.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { CLE_EPOQUE_EDITEUR } from '../src/domain/brouillons-format.js';

const refus = () => ({ issue: 'echec', raison: 'stockage_indisponible', reessayable: true });
const attendre = async predicate => { const fin = performance.now() + 4000; while (!predicate()) { if (performance.now() > fin) throw Error('Reprise de cuisine non observée'); await new Promise(r => setTimeout(r, 5)); } };
const sortie = root => root.querySelector('[data-role=retour-erreur-cuisine]');
const rouvrir = root => root.querySelector('[data-role=reouvrir-cuisine]');
const snapshot = db => db.getSnapshot(['recipes', 'recipe_versions', 'cook_sessions', 'timer_launches', 'cook_history', 'outbox']);

export async function runAuditCuisineErreurTests({ eq, ok }) {
  const locale = getUiLocale(), sync = getSyncState(), adresse = location.href, histoire = history.state, scene = document.createElement('div'); document.body.append(scene);
  const router = await import('../src/core/router.js?audit-cuisine-erreur');
  let handlerCourant = null; router.route('/cook/:id', (...args) => handlerCourant?.(...args));
  const run = async (nom, fn) => { try { await withRepo(async (repo, db) => {
    const f = fixtureCuisineL7(); f.session.id = 'séance/a?b'; f.session.active_version_id = f.b.version.id; f.b.recipe.current_version_id = 'version-courante-distincte';
    f.session.progress = { done_step_ids: [], by_version: { [f.b.version.id]: { current_step_id: 'commun', done_step_ids: [] } } };
    await db.mutate({ origin: 'remote', puts: { recipes: [f.a.recipe, f.b.recipe], recipe_versions: [f.a.version, f.b.version], cook_sessions: [f.session] } });
    const ctx = await getData(true), service = creerServiceCuisine({ repo, getGeneration: getSyncGeneration });
    await service.capturerPortee({ owner_id: ctx.proprietaireDonnees });
    await fn({ repo, db, f, ctx, service });
  }); } catch (e) { ok(false, `Cuisine erreur11.3 ${nom} : ${e.stack || e}`); } finally { scene.firstChild?.dispose?.(); scene.replaceChildren(); setSyncState(sync); } };
  try {
    setUiLocale('fr');
    for (const phase of ['capture', 'lecture']) await run('réouverture réelle ' + phase, async x => {
      const avant = await snapshot(x.db), compteurs = { captures: 0, lectures: 0, panneaux: 0, disposes: 0, ecrans: 0, voix: 0, renders: 0 };
      const capture = x.service.capturerPortee, lire = x.service.lireSession;
      x.service.capturerPortee = args => { compteurs.captures++; return phase === 'capture' && compteurs.captures === 1 ? Promise.resolve(refus()) : capture(args); };
      x.service.lireSession = args => { compteurs.lectures++; return phase === 'lecture' && compteurs.lectures === 1 ? Promise.resolve(refus()) : lire(args); };
      const deps = { repo: x.repo, service: x.service,
        creerPanneauMinuteurs: () => { compteurs.panneaux++; const n = document.createElement('section'); n.actualiser = async () => {}; n.dispose = () => { compteurs.disposes++; }; return n; },
        creerControleurEcran: () => ({ detruire: () => { compteurs.ecrans++; } }), creerCommandeEcranAllume: () => document.createElement('span'),
        creerControleurVoix: () => ({ arreter() {}, detruire() { compteurs.voix++; }, souscrire() { return () => {}; } }),
      };
      const route = '/cook/' + encodeURIComponent(x.f.session.id) + '?origine=preuve'; history.replaceState(null, '', '#' + route);
      let root, erreur, pending = Promise.resolve(), arreter;
      handlerCourant = async (params, query) => {
        root?.dispose(); const suivante = await renderCook(params, query, await getData(true), deps); scene.replaceChildren(suivante); root = suivante; compteurs.renders++;
      };
      arreter = router.start(r => { pending = r.handler(r.params, r.query).catch(e => { erreur = e; }); });
      try {
        await pending; if (erreur) throw erreur; const initial = root;
        eq(rouvrir(root)?.textContent, 'Rouvrir la séance', `Cuisine erreur11.3 ${phase} : issue de reprise visible`);
        eq(sortie(root)?.textContent, phase === 'capture' ? 'Bibliothèque' : 'Fiche', `Cuisine erreur11.3 ${phase} : sortie honnêtement nommée`);
        eq(sortie(root)?.getAttribute('href'), phase === 'capture' ? '#/library' : `#/recipes/${x.f.b.recipe.id}?v=${x.f.b.version.id}`, `Cuisine erreur11.3 ${phase} : aucune recette inventée depuis la séance`);
        eq(compteurs.panneaux, phase === 'capture' ? 0 : 1, `Cuisine erreur11.3 ${phase} : contrôleurs montés au moment prévu`);
        if (phase === 'lecture') ok([...root.querySelectorAll('button')].find(b => b.textContent === 'Terminer')?.disabled, 'Cuisine erreur11.3 : Terminer reste désactivé après refus de lecture');
        const lecturesAvant = compteurs.lectures; let notification;
        try { notification = await root.actualiserCuisine(); } catch (e) { notification = e.name; }
        eq(notification, false, `Cuisine erreur11.3 ${phase} : notification sur écran non admis sans exception`);
        eq(compteurs.lectures, lecturesAvant, `Cuisine erreur11.3 ${phase} : notification ne remplace pas le geste Rouvrir`);
        rouvrir(root)?.click(); if (rouvrir(root)) await attendre(() => compteurs.renders === 2 || erreur); if (erreur) throw erreur;
        eq(compteurs.renders, 2, `Cuisine erreur11.3 ${phase} : vrai routeur réexécute la route identique`);
        ok(root !== initial && !!root.querySelector('[data-role=texte-etape]'), `Cuisine erreur11.3 ${phase} : nouvelle vue de séance réellement lisible`);
        eq(location.hash, '#' + route, `Cuisine erreur11.3 ${phase} : identifiant encodé et query conservés`);
        eq([compteurs.disposes, compteurs.ecrans, compteurs.voix], phase === 'capture' ? [0, 0, 0] : [1, 1, 1], `Cuisine erreur11.3 ${phase} : anciens contrôleurs détruits une fois`);
        initial.dispose(); eq(compteurs.disposes, phase === 'capture' ? 0 : 1, `Cuisine erreur11.3 ${phase} : destruction ancienne idempotente`);
        eq(await snapshot(x.db), avant, `Cuisine erreur11.3 ${phase} : aucune séance, progression ou commande ajoutée`);
      } finally { arreter?.(); root?.dispose(); handlerCourant = null; }
    });
    for (const forme of ['active_hors_selection', 'version_absente', 'recette_incoherente', 'session_absente', 'active_inconnue']) await run(forme, async x => {
      const ctx = { ...x.ctx, cook_sessions: structuredClone(x.ctx.cook_sessions), versionsById: structuredClone(x.ctx.versionsById), recipesById: structuredClone(x.ctx.recipesById) }; if (forme === 'active_hors_selection') ctx.cook_sessions[0].selected_version_ids = [x.f.a.version.id];
      if (forme === 'version_absente') ctx.versionsById.delete(x.f.b.version.id);
      if (forme === 'recette_incoherente') ctx.versionsById.get(x.f.b.version.id).recipe_id = 'absente';
      if (forme === 'session_absente') ctx.cook_sessions = [];
      if (forme === 'active_inconnue') ctx.cook_sessions[0].active_version_id = null;
      const avant = await snapshot(x.db); x.service.lireSession = async () => refus();
      const root = await renderCook({ id: x.f.session.id }, {}, ctx, { repo: x.repo, service: x.service }); scene.append(root);
      eq([sortie(root)?.textContent, sortie(root)?.getAttribute('href')], ['Bibliothèque', '#/library'], `Cuisine erreur11.3 ${forme} : repli sûr sans choisir une autre version`);
      eq(await snapshot(x.db), avant, `Cuisine erreur11.3 ${forme} : consultation sans mutation`);
    });
    for (const course of ['owner', 'epoque', 'generation', 'connexion', 'selection', 'version']) await run('Fiche périmée ' + course, async x => {
      const sorties = []; x.service.lireSession = async () => refus();
      const root = await renderCook({ id: x.f.session.id }, {}, x.ctx, { repo: x.repo, service: x.service, navigate: (...args) => sorties.push(args) }); scene.append(root);
      eq(sortie(root)?.textContent, 'Fiche', `Cuisine erreur11.3 ${course} : cible connue au montage`);
      if (course === 'owner') await x.db.mutate({ origin: 'device', puts: { sync_state: [{ key: 'user_id', value: 'autre-compte' }] } });
      if (course === 'epoque') await x.db.mutate({ origin: 'device', puts: { sync_state: [{ key: CLE_EPOQUE_EDITEUR, value: 'autre-epoque' }] } });
      if (course === 'generation') setSyncState({});
      if (course === 'connexion') { x.db.idb.close(); x.db.idb = null; await x.db.open(); }
      if (course === 'selection') await x.db.mutate({ origin: 'remote', puts: { cook_sessions: [{ ...x.f.session, active_version_id: x.f.a.version.id }] } });
      if (course === 'version') await x.db.mutate({ origin: 'remote', puts: { recipe_versions: [{ ...x.f.b.version, recipe_id: x.f.a.recipe.id }] } });
      const avant = await snapshot(x.db); sortie(root)?.click(); if (sortie(root)) await attendre(() => sorties.length > 0);
      eq(sorties[0]?.[0], '/library', `Cuisine erreur11.3 ${course} : clic ne réutilise pas Fiche périmée`);
      rouvrir(root)?.click();
      eq(sorties.at(-1), ['/cook/' + encodeURIComponent(x.f.session.id), { replace: true }], `Cuisine erreur11.3 ${course} : Rouvrir reste disponible malgré contexte ancien`);
      eq(await snapshot(x.db), avant, `Cuisine erreur11.3 ${course} : récupération sans écriture métier`);
    });
    await run('base changée', async x => {
      const sorties = []; x.service.lireSession = async () => refus();
      const root = await renderCook({ id: x.f.session.id }, {}, x.ctx, { repo: x.repo, service: x.service, navigate: (...args) => sorties.push(args) }); scene.append(root);
      await withDatabase(async autre => {
        let lectures = 0; const get = autre.get.bind(autre); autre.get = (...args) => { lectures++; return get(...args); }; x.repo.bindDatabase(autre);
        try { sortie(root)?.click(); if (sortie(root)) await attendre(() => sorties.length > 0); eq(sorties[0]?.[0], '/library', 'Cuisine erreur11.3 : base changée donne Bibliothèque'); eq(lectures, 0, 'Cuisine erreur11.3 : ancien écran ne lit jamais la nouvelle base'); }
        finally { x.repo.bindDatabase(x.db); }
      });
    });
    await run('anglais et vue détruite', async x => {
      setUiLocale('en'); const sorties = []; x.service.capturerPortee = async () => refus();
      const root = await renderCook({ id: x.f.session.id }, {}, x.ctx, { repo: x.repo, service: x.service, navigate: (...args) => sorties.push(args) }); scene.append(root);
      eq([rouvrir(root)?.textContent, sortie(root)?.textContent], ['Reopen session', 'Library'], 'Cuisine erreur11.3 : sorties traduites');
      root.dispose(); rouvrir(root)?.click(); sortie(root)?.click(); await Promise.resolve(); eq(sorties, [], 'Cuisine erreur11.3 : vue détruite ne navigue plus');
    });
  } finally { scene.firstChild?.dispose?.(); scene.remove(); handlerCourant = null; history.replaceState(histoire, '', adresse); setUiLocale(locale); setSyncState(sync); }
}
