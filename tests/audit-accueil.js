import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { renderHome } from '../src/ui/home.js';
import { getData, getSyncGeneration, getSyncState, setSyncState } from '../src/ui/state.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';
import { formatDate } from '../src/core/dom.js';
import { creerServiceBrouillons } from '../src/domain/brouillons-editeur.js';
import { creerDepotTraductions } from '../src/domain/depot-traductions.js';
import { fixtureLectureL6 } from './l6-lecture-ecrans.js';
const EPOQUE = 'editor_library_epoch:v1', PREFIXE = 'editor_draft:v1:';
const JOUR = '2026-10-30', MAINTENANT = () => new Date(2026, 9, 30, 12).getTime();
const iso = (h, jour = 30) => new Date(2026, 9, jour, h).toISOString();
const select = (root, role) => root.querySelector(`[data-role=${role}]`);
const liens = (root, role) => [...(select(root, role)?.querySelectorAll('a') || [])].map(a => a.getAttribute('href'));
const exiger = r => { if (!['ok', 'publie'].includes(r?.issue)) throw Error('Fixture refusée : ' + (r?.raison || r?.issue)); return r; };
async function brouillons(repo, db) {
  const f = fixtureLectureL6(); for (const i of f.version.ingredients) i.verification_state = 'to_verify';
  await db.mutate({ origin: 'remote', puts: { recipes: [f.recipe], recipe_versions: [f.version] } });
  const s = creerServiceBrouillons({ repo, getGeneration: getSyncGeneration }), p = exiger(await s.capturerPortee({ owner_id: null })).portee;
  const ouvert = exiger(await s.ouvrirBrouillon({ kind: 'recipe_version', intention: 'correction', portee: p, affiche: f }));
  ouvert.modele.metadata.display_title = 'Saisie locale accueil';
  const editeur = exiger(await s.conserverBrouillon({ session: ouvert.session, expectedRevision: null, payload: ouvert.modele }));
  const tr = creerDepotTraductions({ repo, getGeneration: getSyncGeneration }), pt = exiger(await tr.capturerPortee({ owner_id: null })).portee;
  const ot = exiger(await tr.ouvrirTraduction({ portee: pt, affiche: { ...f, traductions: [] }, locale: 'fr' }));
  ot.modele.segments[0].text = 'Pain à traduire';
  const traduction = exiger(await tr.conserverBrouillon({ session: ot.session, expectedRevision: null, payload: ot.modele }));
  return { s, p, editeur, tr, pt, traduction, ...f };
}
export async function runAuditAccueilTests({ eq, ok }) {
  const roots = [], langue = getUiLocale(), sync = getSyncState();
  const run = async (nom, f) => { try { await withRepo(f); } catch (e) { ok(false, `Accueil11.1 ${nom} : ${e.stack || e}`); } finally { for (const root of roots.splice(0)) { root.dispose?.(); root.remove(); } } };
  const rendre = async (repo, extra = {}, maintenant = MAINTENANT) => {
    const ctx = { ...await getData(true), ...extra, settings: { rediscover_enabled: false } };
    const root = await renderHome({}, {}, ctx, { repo, maintenant }); roots.push(root); document.body.append(root); return root;
  };
  try {
    setUiLocale('fr');
    await run('vide', async (repo, db) => {
      const avant = await db.getAll('outbox'), root = await rendre(repo);
      for (const role of ['prochain-repas', 'courses-du-jour', 'brouillons-accueil', 'import-interrompu']) eq(select(root, role), null, 'Accueil11.1 : aucune section vide ' + role);
      ok(root.textContent.includes('Bienvenue'), 'Accueil11.1 : bienvenue historique conservée');
      eq(await db.getAll('outbox'), avant, 'Accueil11.1 : affichage vide sans écriture métier ou envoi');
    });
    await run('repas et ordre', async repo => {
      const meals = [
        { id: 'passe', title: 'Passé', serve_at: iso(11) }, { id: 'hier', title: 'Hier', planned_on: '2026-10-29' },
        { id: 'archive', title: 'Archivé', planned_on: JOUR, archived_at: iso(10) }, { id: 'envie', title: 'Envie sans date' },
        { id: 'invalide', title: 'Invalide', serve_at: 'pas une date', planned_on: JOUR },
        { id: 'demain', title: 'Demain', planned_on: '2026-10-31' }, { id: 'tard', title: 'Soir', serve_at: iso(19) },
        { id: 'tot?x=1', title: '<b>Déjeuner</b>', serve_at: iso(13) },
      ];
      let root = await rendre(repo, { meals });
      eq(liens(root, 'prochain-repas'), ['#/meals/tot%3Fx%3D1'], 'Accueil11.1 : prochain vrai horaire après maintenant, lien exact encodé');
      ok(select(root, 'prochain-repas')?.textContent.includes(formatDate(iso(13), { withTime: true })), 'Accueil11.1 : véritable heure locale affichée');
      eq(select(root, 'prochain-repas')?.querySelector('b') ?? null, null, 'Accueil11.1 : titre repas rendu en texte');
      const sansHeure = [{ id: 'sans-z', title: 'A', planned_on: JOUR }, { id: 'sans-a', title: 'A', planned_on: JOUR }, { id: 'sans-b', title: 'B', planned_on: JOUR }];
      root = await rendre(repo, { meals: [...meals, ...sansHeure] });
      eq(liens(root, 'prochain-repas'), ['#/meals/sans-a'], 'Accueil11.1 : jour sans heure avant horaires puis titre/id stables');
      ok(select(root, 'prochain-repas')?.textContent.includes('Heure non précisée'), 'Accueil11.1 : aucune heure inventée pour un jour civil');
      root = await rendre(repo, { meals: [...meals, ...sansHeure].reverse() });
      eq(liens(root, 'prochain-repas'), ['#/meals/sans-a'], 'Accueil11.1 : ordre indépendant de celui du stockage');
      root = await rendre(repo, { meals: meals.slice(0, 5) });
      eq(select(root, 'prochain-repas'), null, 'Accueil11.1 : passé, archive, envie et date invalide ne fabriquent pas de prochain repas');
    });
    await run('jour local', async repo => {
      // Construction en heure locale : valable aussi sous le fuseau du navigateur de la suite.
      const maintenant = () => new Date(2026, 9, 30, 23, 30).getTime(), fin = new Date(2026, 9, 30, 23, 45).toISOString();
      const root = await rendre(repo, { meals: [{ id: 'local', title: 'Fin de journée', serve_at: fin }, { id: 'demain', title: 'Demain', planned_on: '2026-10-31' }] }, maintenant);
      eq(liens(root, 'prochain-repas'), ['#/meals/local'], 'Accueil11.1 : jour et heure locale, pas le jour UTC du texte ISO');
      ok(select(root, 'prochain-repas')?.textContent.includes(formatDate(fin, { withTime: true })), 'Accueil11.1 : date locale conservée à proximité de minuit');
    });
    await run('courses du jour', async (repo, db) => {
      const meals = [{ id: 'sans', title: 'Sans heure', planned_on: JOUR }, { id: 'passe', title: 'Passé aujourd’hui', serve_at: iso(10) }, { id: 'futur', title: 'Demain', planned_on: '2026-10-31' }, { id: 'archive', planned_on: JOUR, archived_at: iso(10) }];
      const shopping_lists = [
        { id: 'z', meal_id: 'sans', title: 'Même liste', created_at: '2020-01-01T00:00:00Z' }, { id: 'a?x=1', meal_id: 'sans', title: 'Même liste' },
        { id: 'passe', meal_id: 'passe', title: 'Encore utile' }, { id: 'future', meal_id: 'futur', title: 'Créée aujourd’hui', created_at: iso(12) },
        { id: 'archive', meal_id: 'archive', title: 'Archivée' }, { id: 'orpheline', meal_id: 'absent', created_at: iso(12) },
      ];
      await db.mutate({ origin: 'remote', puts: { meals, shopping_lists } }); const avant = await db.getAll('shopping_lists');
      const root = await rendre(repo);
      eq(liens(root, 'courses-du-jour'), ['#/lists/a%3Fx%3D1', '#/lists/z', '#/lists/passe'], 'Accueil11.1 : toutes les vraies listes du jour, ordre stable et repas passé aujourd’hui inclus');
      eq(await db.getAll('shopping_lists'), avant, 'Accueil11.1 : affichage ne réécrit aucune liste ni case');
      const reverse = await rendre(repo, { meals: [...meals].reverse(), shopping_lists: [...shopping_lists].reverse() });
      eq(liens(reverse, 'courses-du-jour'), liens(root, 'courses-du-jour'), 'Accueil11.1 : listes multiples triées indépendamment de la lecture');
    });
    await run('brouillons réels et reçus', async (repo, db) => {
      const f = await brouillons(repo, db), copie = structuredClone(await db.get('sync_state', PREFIXE + f.editeur.id));
      copie.key = PREFIXE + 'etranger'; copie.value.id = 'etranger'; copie.value.owner_id = 'autre-compte';
      await db.mutate({ origin: 'device', puts: { sync_state: [copie] } });
      let root = await rendre(repo);
      eq(liens(root, 'brouillons-accueil'), ['#/add?section=brouillons'], 'Accueil11.1 : vrais brouillons éditeur et traduction ouvrent la section exacte');
      ok(select(root, 'brouillons-accueil')?.textContent.includes('2 brouillons'), 'Accueil11.1 : deux dépôts lus, autre propriétaire exclu');
      const plan = exiger(await f.s.preparerPublication({ id: f.editeur.id, portee: f.p, expectedRevision: f.editeur.revision })); exiger(await f.s.publierBrouillon({ plan: plan.plan }));
      root = await rendre(repo); ok(select(root, 'brouillons-accueil')?.textContent.includes('1 brouillon'), 'Accueil11.1 : reçu committed réellement produit non compté');
      exiger(await f.tr.ecarterBrouillon({ id: f.traduction.id, portee: f.pt, expectedRevision: f.traduction.revision }));
      root = await rendre(repo); eq(select(root, 'brouillons-accueil'), null, 'Accueil11.1 : reçu et brouillon étranger seuls ne créent pas de section');
      eq(await db.getAll('recipe_translations'), [], 'Accueil11.1 : lire les résumés ne publie aucune traduction');
    });
    await run('lecture impossible', async (repo, db) => {
      await brouillons(repo, db); const ctx = { ...await getData(true), settings: { rediscover_enabled: false } }, getAll = db.getAll.bind(db);
      db.getAll = async store => { if (store === 'sync_state') throw new Error('lecture refusée de fixture'); return getAll(store); };
      try { const root = await renderHome({}, {}, ctx, { repo, maintenant: MAINTENANT }); roots.push(root);
        ok(root.textContent.includes('La liste des brouillons n’a pas pu être lue.'), 'Accueil11.1 : échec de lecture visible sans annoncer aucun brouillon');
        eq(select(root, 'brouillons-accueil'), null, 'Accueil11.1 : pas de section vide quand aucune famille n’a pu être lue');
      } finally { db.getAll = getAll; }
    });
    for (const changement of ['owner', 'epoque', 'generation', 'base']) await run('portée ' + changement, async (repo, db) => {
      await brouillons(repo, db); const ctx = { ...await getData(true), settings: { rediscover_enabled: false } }, getAll = db.getAll.bind(db); let lectures = 0, injections = 0;
      await withDatabase(async autre => {
        db.getAll = async store => {
          const rows = await getAll(store);
          if (store === 'sync_state' && ++lectures === 2) {
            injections++;
            if (changement === 'owner' || changement === 'epoque') await db.mutate({ origin: 'device', puts: { sync_state: [{ key: changement === 'owner' ? 'user_id' : EPOQUE, value: changement === 'owner' ? 'autre-compte' : 'autre-bibliotheque' }] } });
            if (changement === 'generation') setSyncState({});
            if (changement === 'base') repo.bindDatabase(autre);
          }
          return rows;
        };
        try { const root = await renderHome({}, {}, ctx, { repo, maintenant: MAINTENANT }); roots.push(root);
          eq(injections, 1, `Accueil11.1 ${changement} : changement réellement atteint pendant les résumés`);
          eq(select(root, 'brouillons-accueil'), null, `Accueil11.1 ${changement} : aucun ancien résumé tardif`);
        } finally { db.getAll = getAll; repo.bindDatabase(db); }
      });
    });
    await run('imports interrompus', async repo => {
      const base = { kind: 'reperes', recipe_id: 'absente', device_id: repo.deviceId(), updated_at: iso(12), status: 'echec' };
      const imports = [
        { ...base, id: 'vrai', erreur: { raison: 'interrompu' } },
        ...['reseau', 'capacite', 'texte_interdit', 'refus'].map((raison, n) => ({ ...base, id: 'echec-' + n, erreur: { raison } })),
        { ...base, id: 'vivant', status: 'en_cours', erreur: null }, { ...base, id: 'clos', status: 'ignore', erreur: { raison: 'interrompu' } },
      ];
      let root = await rendre(repo, { imports });
      eq(liens(root, 'import-interrompu'), ['#/add?section=imports'], 'Accueil11.1 : interruption documentée ouvre Ajouter sans relancer');
      ok(select(root, 'import-interrompu')?.textContent.includes('Import interrompu'), 'Accueil11.1 : interruption nommée sans inventer sa cause');
      root = await rendre(repo, { imports: imports.slice(1) });
      eq(select(root, 'import-interrompu'), null, 'Accueil11.1 : réseau, refus, terminé et vol vivant ne deviennent pas interrompus');
    });
    await run('anglais', async (repo, db) => {
      await brouillons(repo, db); setUiLocale('en');
      const root = await rendre(repo, { meals: [{ id: 'm', title: 'Meal', planned_on: JOUR }], shopping_lists: [{ id: 'l', title: 'Shopping', meal_id: 'm' }], imports: [{ id: 'i', kind: 'reperes', status: 'echec', erreur: { raison: 'interrompu' } }] });
      for (const [role, texte] of [['prochain-repas', 'Next meal'], ['courses-du-jour', 'Groceries'], ['brouillons-accueil', 'Drafts on this device'], ['import-interrompu', 'Interrupted import']]) ok(select(root, role)?.textContent.includes(texte), 'Accueil11.1 EN : ' + texte);
      ok(select(root, 'prochain-repas')?.textContent.includes('Time not specified'), 'Accueil11.1 EN : heure inconnue explicitement traduite');
      setUiLocale('fr');
    });
  } finally { setUiLocale(langue); setSyncState(sync); }
}
