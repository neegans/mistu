import { withRepo } from './sync-fixture.js';

const SESSION = { access_token: 'fixture', user: { id: 'i3-user' } };
const CONFIG = { url: 'https://assistant.example', anonKey: 'publique-factice' };
const NOW = '2026-10-28T23:00:00.000Z';
const reponse = (resultat, extra = {}) => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(resultat) }], stop_reason: 'end_turn', model: 'modele-test', usage: { input_tokens: 10, output_tokens: 20 }, ...extra }), { status: 200 });
const proposition = () => ({ type: 'proposition', blocs: [{ source_step_id: 's-i3-1', raison: 'Mélanger avec le robot.', actions: [
  { type: 'preparation', operation: 'ajouter', ingredients: ['i1'], contenant: 'bol' },
  { type: 'reglage', mode: 'manuel', secondes: 10, temperature: null, vitesse: 1, sens: 'normal', accessoire: 'couteau', ingredients: ['i1'] },
] }] });
const seed = async (repo) => {
  const recipe = { id: 'r-i3-p', original_title: 'Tomates', availability: 'available', personal_notes: 'Ne pas envoyer cette note', favorite: true };
  const version = { id: 'v-i3-p', recipe_id: recipe.id, kind: 'extraction', status: 'proposed', servings: 2,
    ingredients: [{ id: 'ri-i3-1', source_text: '200 g de tomates', name_text: 'tomates', quantity: { value: 200 }, unit_id: 'g' }],
    steps: [{ id: 's-i3-1', text: 'Mélanger les tomates.' }, { id: 's-i3-2', text: 'Servir.' }], provenance: {} };
  await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] });
  return { recipe, version };
};
const options = (repo, extra = {}) => ({ repo, config: CONFIG, enLigne: () => true, maintenant: () => NOW, ...extra });
const entree = (selection = ['s-i3-1']) => ({ recipeId: 'r-i3-p', versionId: 'v-i3-p', selection, demande: 'Faire cette partie au TM7.' });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

export async function runI3ParcoursTests({ eq, ok }) {
  const P = await import('../src/domain/thermomix-parcours.js');
  const run = async (nom, f) => { try { await withRepo(f); } catch (e) { ok(false, `I3 parcours — ${nom} : ${e.code || e.message}`); } };
  const refuse = async (fn, code, nom) => { try { await fn(); ok(false, nom); } catch (e) { eq(e.code, code, nom); } };

  await run('brouillon durable et original intact', async (repo) => {
    await seed(repo); const avant = await repo.get('recipe_versions', 'v-i3-p');
    let row = await P.ouvrirThermomix(entree([]), options(repo));
    eq([row.kind, row.status, row.device_id, row.contexte.selection], ['thermomix', 'a_lancer', repo.deviceId(), []], 'I3 brouillon vide sans présélection');
    row = await P.modifierThermomix(row.id, { selection: ['s-i3-1'], demande: 'Seulement cette étape.' }, options(repo));
    const reprise = await P.lireBrouillonThermomix(row.id, options(repo));
    eq([reprise.contexte.selection, reprise.contexte.demande, reprise.lecture_seule], [['s-i3-1'], 'Seulement cette étape.', false], 'I3 sélection et demande durables');
    eq(await repo.get('recipe_versions', 'v-i3-p'), avant, 'I3 sauvegarde de brouillon sans réécrire source');
    eq((await repo.get('recipes', 'r-i3-p')).personal_notes, 'Ne pas envoyer cette note', 'I3 note personnelle préservée');
  });

  await run('ouvertures concurrentes et exclusivité de recette', async (repo) => {
    await seed(repo); const d = options(repo);
    const rs = await Promise.allSettled([P.ouvrirThermomix(entree(), d), P.ouvrirThermomix(entree(), d)]);
    eq(rs.filter(x => x.status === 'fulfilled').length, 1, 'I3 deux ouvertures : une seule création');
    eq((await repo.all('imports')).length, 1, 'I3 un journal ouvert au total');
    await refuse(() => P.ouvrirThermomix(entree(), d), 'import_ouvert', 'I3 journal déjà ouvert expliqué');
    const row = (await repo.all('imports'))[0]; await P.ignorerThermomix(row.id, d);
    const other = { ...row, id: repo.newId('imp'), kind: 'recette', status: 'a_lancer' }; await repo.save('imports', other);
    await refuse(() => P.ouvrirThermomix(entree(), d), 'import_ouvert', 'I3 import de pages déjà ouvert conservé');
    eq((await repo.get('imports', other.id)).status, 'a_lancer', 'I3 autre sorte jamais fermée implicitement');
  });

  await run('appel fermé et résultat relu', async (repo) => {
    await seed(repo); let appels = 0; let req;
    const d = options(repo, { fetch: async (_u, init) => { appels++; req = JSON.parse(init.body); return reponse(proposition()); } });
    const row = await P.ouvrirThermomix(entree(), d);
    const lu = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc-i3' }, d);
    eq([appels, req.outil, lu.status, lu.resultat.type, lu.model], [1, 'creation', 'a_verifier', 'proposition', 'modele-test'], 'I3 un appel creation suivi d’une proposition vérifiable');
    eq(req.corps.max_tokens, 16000, 'I3 plafond sortie explicite');
    ok(req.corps.system.includes('Thermomix'), 'I3 consigne propre au chef');
    ok(!JSON.stringify(req.corps).includes('Ne pas envoyer cette note'), 'I3 note personnelle absente de la demande');
    ok(!JSON.stringify(lu).includes(SESSION.access_token), 'I3 jeton absent du journal');
    eq(lu.reponse_brute, null, 'I3 réponse brute non conservée');
    eq((await P.lireBrouillonThermomix(row.id, d)).resultat, lu.resultat, 'I3 relecture sans deuxième appel');
    eq(appels, 1, 'I3 reprise ne lance aucun réseau');
  });

  await run('questions persistantes et refus', async (repo) => {
    await seed(repo); let appels = 0;
    const d = options(repo, { fetch: async (_u, init) => { appels++; if (appels === 1) return reponse({ type: 'questions', questions: ['Le bol est-il froid ?'] });
      const corps = JSON.parse(init.body).corps; ok(corps.messages[0].content.includes('Le bol est-il froid ?'), 'I3 deuxième appel réexpédie la question');
      ok(corps.messages[0].content.includes('Oui'), 'I3 deuxième appel réexpédie la réponse'); return reponse({ type: 'refus', raison: 'Cette opération sort du profil disponible.' }); } });
    let row = await P.ouvrirThermomix(entree(), d); row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    eq([row.status, row.resultat.type], ['a_verifier', 'questions'], 'I3 questions à vérifier');
    await refuse(() => P.garderThermomix({ importId: row.id, relu: true }, d), 'proposition_requise', 'I3 questions non conservables comme recette');
    row = await P.modifierThermomix(row.id, { precisions: { reponses: ['Oui'] } }, d);
    eq([row.status, row.questions, row.resultat], ['a_lancer', ['Le bol est-il froid ?'], null], 'I3 questions gardées malgré invalidation du résultat');
    row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    eq([row.status, row.resultat.type], ['a_verifier', 'refus'], 'I3 refus distinct d’une panne');
    await refuse(() => P.garderThermomix({ importId: row.id, relu: true }, d), 'proposition_requise', 'I3 refus non conservable');
  });

  await run('conditions avant réseau', async (repo) => {
    await seed(repo); let appels = 0; const d = options(repo, { fetch: async () => { appels++; return reponse(proposition()); } });
    let row = await P.ouvrirThermomix(entree([]), d);
    await refuse(() => P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d), 'selection_requise', 'I3 sélection vide refusée avant appel');
    row = await P.modifierThermomix(row.id, { selection: ['s-i3-1'] }, d);
    await refuse(() => P.proposerThermomix({ importId: row.id, session: null, documentId: 'doc' }, d), 'non_connecte', 'I3 session requise avant réseau');
    await refuse(() => P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, { ...d, enLigne: () => false }), 'hors_ligne', 'I3 hors ligne sans appel');
    eq([appels, (await repo.get('imports', row.id)).status], [0, 'a_lancer'], 'I3 gardes préalables ne consomment ni ne changent le brouillon');
  });

  await run('double appel et annulation tardive', async (repo) => {
    await seed(repo); const attente = deferred(), parti = deferred(); let appels = 0;
    const d = options(repo, { fetch: async () => { appels++; parti.resolve(); await attente.promise; return reponse(proposition()); } });
    const row = await P.ouvrirThermomix(entree(), d);
    const p = P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d); await parti.promise;
    await refuse(() => P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'autre' }, d), 'appel_en_cours', 'I3 second onglet sans deuxième appel');
    await refuse(() => P.annulerThermomix(row.id, { ...d, documentId: 'autre' }), 'autre_onglet', 'I3 autre onglet ne peut annuler le vol');
    await P.annulerThermomix(row.id, { ...d, documentId: 'doc' }); attente.resolve(); await p;
    const apres = await repo.get('imports', row.id);
    eq([appels, apres.status, apres.erreur.raison, apres.resultat, apres.reponse_brute], [1, 'echec', 'annule', null, null], 'I3 réponse tardive ignorée après annulation');
    eq((await repo.all('recipe_versions')).length, 1, 'I3 annulation ne crée aucune version');
  });

  await run('source modifiée pendant appel', async (repo) => {
    const { version } = await seed(repo); const attente = deferred(), parti = deferred();
    const d = options(repo, { fetch: async () => { parti.resolve(); await attente.promise; return reponse(proposition()); } });
    const row = await P.ouvrirThermomix(entree(), d);
    const p = P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d); await parti.promise;
    await repo.save('recipe_versions', { ...version, servings: 3 }); attente.resolve(); await p;
    const apres = await repo.get('imports', row.id);
    eq([apres.status, apres.resultat, apres.erreur.raison], ['echec', null, 'source_modifiee'], 'I3 source modifiée invalide réponse tardive');
  });

  await run('changement de compte pendant appel', async (repo) => {
    await seed(repo); const attente = deferred(), parti = deferred(); let session = SESSION;
    const d = options(repo, { sessionCourante: () => session, fetch: async () => { parti.resolve(); await attente.promise; return reponse(proposition()); } });
    const row = await P.ouvrirThermomix(entree(), d);
    const p = P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d); await parti.promise;
    const avant = await repo.get('imports', row.id); session = { access_token: 'fixture-autre', user: { id: 'autre' } }; attente.resolve();
    await p.catch(() => {});
    eq(await repo.get('imports', row.id), avant, 'I3 aucune écriture tardive après changement de compte');
  });

  await run('réponses invalides et transport', async (repo) => {
    await seed(repo); let row = await P.ouvrirThermomix(entree(), options(repo));
    const mauvais = proposition(); mauvais.blocs[0].actions[1].vitesse = 99;
    row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, options(repo, { fetch: async () => reponse(mauvais) }));
    eq([row.status, row.resultat, row.reponse_brute], ['echec', null, null], 'I3 résultat hostile non persisté');
    row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, options(repo, { fetch: async () => reponse(proposition(), { stop_reason: 'max_tokens' }) }));
    eq([row.status, row.erreur.raison], ['echec', 'interrompu'], 'I3 réponse tronquée refusée');
    row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, options(repo, { fetch: async () => new Response(JSON.stringify({ erreur: 'quota', quota: 60 }), { status: 429 }) }));
    eq([row.status, row.erreur.raison, row.erreur.extra.quota], ['echec', 'quota', 60], 'I3 quota de passerelle conservé sans texte brut');
  });

  await run('conservation atomique idempotente', async (repo) => {
    await seed(repo); const d = options(repo, { fetch: async () => reponse(proposition()) });
    const sourceAvant = await repo.get('recipe_versions', 'v-i3-p'), recetteAvant = await repo.get('recipes', 'r-i3-p');
    let row = await P.ouvrirThermomix(entree(), d); row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    await refuse(() => P.garderThermomix({ importId: row.id, relu: false }, d), 'relecture_requise', 'I3 relecture nécessaire avant écriture');
    const versions = await Promise.all([P.garderThermomix({ importId: row.id, relu: true }, d), P.garderThermomix({ importId: row.id, relu: true }, d)]);
    eq(versions[0].id, versions[1].id, 'I3 deux onglets gardent la même version');
    eq((await repo.all('recipe_versions')).length, 2, 'I3 une seule adaptation ajoutée');
    eq(await repo.get('recipe_versions', 'v-i3-p'), sourceAvant, 'I3 source totalement intacte après conservation');
    eq(await repo.get('recipes', 'r-i3-p'), recetteAvant, 'I3 recette, notes et favoris intacts après conservation');
    const journal = await repo.get('imports', row.id);
    eq([journal.status, journal.version_id, versions[0].parent_version_id, versions[0].status], ['enregistre', versions[0].id, 'v-i3-p', 'proposed'], 'I3 clôture et version exacte ensemble');
    await repo.remove('imports', row.id);
    const D = await import('../src/domain/thermomix.js');
    eq(D.lireThermomix(await repo.get('recipe_versions', versions[0].id)).ok, true, 'I3 version autonome après purge journal');
  });

  await run('revalidation des données synchronisées', async (repo) => {
    await seed(repo); const d = options(repo, { fetch: async () => reponse(proposition()) });
    let row = await P.ouvrirThermomix(entree(), d); row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    row.resultat.blocs[0].actions[1].temperature = 160;
    await repo.save('imports', row);
    const lu = await P.lireBrouillonThermomix(row.id, d);
    eq(lu.resultat, null, 'I3 réponse synchronisée invalide jamais rendue comme proposition');
    ok(!!lu.validation_erreur, 'I3 revalidation donne une erreur contrôlée');
    let refusee = false; try { await P.garderThermomix({ importId: row.id, relu: true }, d); } catch { refusee = true; }
    ok(refusee, 'I3 relecture cochée ne contourne pas la validation');
    eq((await repo.all('recipe_versions')).length, 1, 'I3 réponse falsifiée ne produit pas de version');
  });

  await run('course source entre lecture et conservation', async (repo) => {
    const { version } = await seed(repo); const d = options(repo, { fetch: async () => reponse(proposition()) });
    let row = await P.ouvrirThermomix(entree(), d); row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    let collision = false;
    const concurrent = { ...repo, transitionner: async (store, id, args) => {
      if (args.puts?.recipe_versions && !collision) { collision = true; await repo.save('recipe_versions', { ...version, servings: 6 }); }
      return repo.transitionner(store, id, args);
    } };
    await refuse(() => P.garderThermomix({ importId: row.id, relu: true }, { ...d, repo: concurrent }), 'source_modifiee', 'I3 source relue dans la transaction finale');
    eq((await repo.get('imports', row.id)).status, 'a_verifier', 'I3 conservation refusée ne clôture pas le journal');
    eq((await repo.all('recipe_versions')).length, 1, 'I3 transaction refusée sans adaptation orpheline');
  });

  await run('source partielle et modification indépendante', async (repo) => {
    const { recipe } = await seed(repo); await repo.save('recipes', { ...recipe, availability: 'partial' });
    const d = options(repo, { fetch: async () => reponse(proposition()) });
    let row = await P.ouvrirThermomix(entree(), d); row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    eq(row.contexte.source.incomplete, true, 'I3 caractère partiel de la fiche figé dans contexte');
    await repo.save('recipes', { ...await repo.get('recipes', recipe.id), personal_notes: 'Note concurrente' });
    const v = await P.garderThermomix({ importId: row.id, relu: true }, d);
    eq(v.provenance.incomplete, true, 'I3 adaptation garde sa source incomplète');
    eq((await repo.get('recipes', recipe.id)).personal_notes, 'Note concurrente', 'I3 note concurrente préservée sans invalider la recette');
  });

  await run('révision invalide résultat, appareil distant et copie', async (repo) => {
    await seed(repo); const d = options(repo, { fetch: async () => reponse(proposition()) });
    let row = await P.ouvrirThermomix(entree(), d); row = await P.proposerThermomix({ importId: row.id, session: SESSION, documentId: 'doc' }, d);
    row = await P.modifierThermomix(row.id, { demande: 'Modifier ma demande' }, d);
    eq([row.status, row.resultat], ['a_lancer', null], 'I3 modification invalide résultat précédent');
    await refuse(() => P.garderThermomix({ importId: row.id, relu: true }, d), 'proposition_requise', 'I3 ancien résultat ne peut plus être gardé');
    await repo.save('imports', { ...row, device_id: 'appareil-distant' });
    eq((await P.lireBrouillonThermomix(row.id, d)).lecture_seule, true, 'I3 journal reçu consultable seulement');
    await refuse(() => P.modifierThermomix(row.id, { demande: 'Changer ailleurs' }, d), 'autre_appareil', 'I3 demande distante non modifiée');
    await refuse(() => P.copierBrouillonThermomix(row.id, d), 'brouillon_ouvert', 'I3 copie distante attend clôture reçue');
    await repo.save('imports', { ...await repo.get('imports', row.id), status: 'ignore' });
    const copie = await P.copierBrouillonThermomix(row.id, d);
    eq([copie.device_id, copie.status, copie.contexte.demande], [repo.deviceId(), 'a_lancer', 'Modifier ma demande'], 'I3 copie fermée indépendante sur nouvel appareil');
    ok(copie.id !== row.id, 'I3 copie porte un nouvel identifiant');
  });

  await run('pointeur idempotent restauré vers une autre adaptation', async (repo) => {
    await seed(repo); const d = options(repo, { fetch: async () => reponse(proposition()) });
    let premier = await P.ouvrirThermomix(entree(), d);
    premier = await P.proposerThermomix({ importId: premier.id, session: SESSION, documentId: 'doc' }, d);
    const versionPremiere = await P.garderThermomix({ importId: premier.id, relu: true }, d);
    let second = await P.ouvrirThermomix({ ...entree(), demande: 'Une autre proposition.' }, d);
    second = await P.proposerThermomix({ importId: second.id, session: SESSION, documentId: 'doc' }, d);
    const versionSeconde = await P.garderThermomix({ importId: second.id, relu: true }, d);
    const cloture = await repo.get('imports', premier.id);
    await repo.save('imports', { ...cloture, version_id: versionSeconde.id });
    await refuse(() => P.garderThermomix({ importId: premier.id, relu: true }, d), 'version_invalide', 'I3 journal restauré ne peut désigner une autre adaptation valide');
    await repo.save('imports', { ...cloture, resultat: { type: 'refus', raison: 'Cette proposition est abandonnée.' } });
    await refuse(() => P.garderThermomix({ importId: premier.id, relu: true }, d), 'version_invalide', 'I3 retour idempotent lie résultat et version');
    await repo.save('imports', { ...cloture, contexte: { ...cloture.contexte, demande: 'Une demande remplacée.' } });
    await refuse(() => P.garderThermomix({ importId: premier.id, relu: true }, d), 'version_invalide', 'I3 retour idempotent lie contexte et version');
    await repo.save('imports', cloture);
    eq((await P.garderThermomix({ importId: premier.id, relu: true }, d)).id, versionPremiere.id, 'I3 vrai retour idempotent reste disponible');
    eq((await repo.all('recipe_versions')).length, 3, 'I3 faux pointeur ne crée aucune troisième adaptation');
  });
}
