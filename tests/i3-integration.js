import { withRepo } from './sync-fixture.js';

export async function runI3IntegrationTests({ eq, ok }) {
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `I3 intégration ${nom} : ${e.message}`); } };
  const recipe = { id: 'i3-r', original_title: 'Sauce', availability: 'available' };
  const invalide = { id: 'i3-v', recipe_id: recipe.id, kind: 'adaptation', servings: 2, status: 'proposed', ingredients: [], steps: [{ id: 's1', text: 'Réglage corrompu', position: 1 }], provenance: { generated_by: 'ai', thermomix: {} } };
  await run('reprise journal', async () => {
    const { cibleReprise, lignesImports } = await import('../src/domain/import-cible.js');
    const row = { id: 'i&3', kind: 'thermomix', recipe_id: recipe.id, status: 'a_verifier', device_id: 'ici' };
    eq(cibleReprise(row), '/recipes/i3-r/thermomix?import=i%263', 'I3 : journal sans pages ouvre le bon écran');
    const ctx = { imports: [row], recipesById: new Map([[recipe.id, recipe]]) };
    eq(lignesImports(ctx, { deviceId: 'ici' })[0]?.gestes, ['reprendre'], 'I3 : recette disponible conserve la reprise TM7 sur son écran dédié');
    eq(lignesImports(ctx, { deviceId: 'ailleurs' })[0]?.gestes, ['reprendre'], 'I3 : autre appareil consulte sans action générique de clôture');
  });
  await run('exports invalides', async () => {
    const { toJsonLd, toPaprikaYaml, toReadableSite } = await import('../src/domain/exporters.js');
    for (const [nom, fn] of [['JSON-LD', b => toJsonLd(b)], ['Paprika', b => toPaprikaYaml([b])], ['HTML', b => toReadableSite([b], new Map())]]) {
      let refuse = false; try { fn({ recipe, version: invalide }); } catch { refuse = true; }
      eq(refuse, true, `I3 : ${nom} refuse un plan reçu invalide`);
    }
  });
  await run('reprise cuisine invalide', () => withRepo(async repo => {
    const { renderCook } = await import('../src/ui/cook.js');
    const session = { id: 'cs-i3', recipe_id: recipe.id, selected_version_ids: [invalide.id], servings: 2, status: 'active', progress: {} };
    const ctx = { cook_sessions: [session], recipesById: new Map([[recipe.id, recipe]]), versionsById: new Map([[invalide.id, invalide]]), ingredientsById: new Map(), conventionFor: () => null };
    const root = await renderCook({ id: session.id }, {}, ctx, { repo });
    try {
      ok(root.matches('[data-role=thermomix-bloque]') || !!root.querySelector('[data-role=thermomix-bloque]'), 'I3 : session restaurée invalide bloquée avant rendu des commandes');
      eq(root.querySelectorAll('[data-role=texte-etape]').length, 0, 'I3 : aucun réglage invalide en cuisine');
    } finally { root.remove(); }
  }));
  await run('route saisie', async () => {
    const { estRouteDeSaisie } = await import('../src/ui/state.js');
    eq(estRouteDeSaisie('/recipes/i3-r/thermomix'), true, 'I3 : rafraîchissement sync protège la saisie Thermomix');
  });
  await run('interruption sur appareil créateur seulement', () => withRepo(async repo => {
    const row = { id: 'imp-i3-lointain', kind: 'thermomix', recipe_id: 'r', status: 'en_cours', device_id: 'autre-appareil', started_at: '2026-01-01T00:00:00Z', document_id_vol: 'ancien-document' };
    await repo.save('imports', row);
    await repo.marquerInterrompus(Date.parse('2026-10-28T22:00:00Z'));
    eq((await repo.get('imports', row.id)).status, 'en_cours', 'I3 : réception d’un ancien vol ne modifie pas le brouillon distant');
  }));
  const fixture = async (servings = 4) => {
    const T = await import('../src/domain/thermomix.js');
    const { sourceThermomix, propositionThermomix } = await import('./i3-thermomix.js');
    const source = sourceThermomix(); source.servings = servings; source.provenance = {};
    const contexte = T.construireContexteThermomix({ version: source, selection: ['s1'] });
    const resultat = T.validerReponseThermomix(propositionThermomix(), contexte);
    let n = 0;
    const version = T.fabriquerVersionThermomix({ source, contexte, resultat, id: 'rv-i3-adaptee', newId: p => p + '-i3-' + ++n, maintenant: '2026-10-28T22:00:00Z', modele: 'fixture' });
    const recipe = { id: source.recipe_id, original_title: 'Sauce aux tomates', availability: 'available', current_version_id: source.id, source_page_ids: [] };
    return { source, version, recipe };
  };
  const seed = async (repo, servings = 4) => {
    const f = await fixture(servings);
    await repo.saveBatch({ recipes: [f.recipe], recipe_versions: [f.source, f.version] });
    return f;
  };
  const attendre = async fn => { for (let n = 0; n < 100; n++) { if (await fn()) return; await new Promise(r => setTimeout(r, 10)); } throw Error('comportement non observé'); };
  await run('portions explicites et session atomique', () => withRepo(async repo => {
    const { enregistrerSessionCuisine, portionsSession } = await import('../src/domain/thermomix-session.js');
    const f = await seed(repo, null);
    const session = { id: 'cs-sans-portions', recipe_id: f.recipe.id, selected_version_ids: [f.version.id], servings_by_version: { [f.version.id]: null }, servings: 4, status: 'active' };
    eq(portionsSession(session, f.version), null, 'I3 : null par version ne retombe pas sur les portions globales du repas');
    await enregistrerSessionCuisine(session, { repo });
    eq((await repo.get('cook_sessions', session.id)).servings_by_version[f.version.id], null, 'I3 : session inconnue garde réellement null');
    await enregistrerSessionCuisine({ ...session, id: 'cs-partagee', selected_version_ids: [f.version.id, f.version.id] }, { repo });
    ok(!!await repo.get('cook_sessions', 'cs-partagee'), 'I3 : version partagée par deux éléments ne duplique pas les conditions transactionnelles');
    let refuse = false;
    try { await enregistrerSessionCuisine({ ...session, id: 'cs-fausse', servings_by_version: { [f.version.id]: 4 } }, { repo }); } catch { refuse = true; }
    eq(refuse, true, 'I3 : nombre inventé refusé même avec ingrédients inchangés');
    eq(await repo.get('cook_sessions', 'cs-fausse'), undefined, 'I3 : aucune session invalide enregistrée');
    const avant = await repo.get('recipe_versions', f.version.id);
    let change = false;
    const concurrent = { ...repo, get: async (store, id) => { const lu = await repo.get(store, id); if (store === 'recipe_versions' && !change) { change = true; await repo.save(store, { ...lu, servings: 8 }); } return lu; } };
    refuse = false; try { await enregistrerSessionCuisine({ ...session, id: 'cs-concurrente' }, { repo: concurrent }); } catch { refuse = true; }
    eq(refuse, true, 'I3 : mutation entre validation et transaction refusée');
    eq(await repo.get('cook_sessions', 'cs-concurrente'), undefined, 'I3 : transaction concurrente ne laisse aucune session');
    eq((await repo.get('recipe_versions', f.version.id)).steps, avant.steps, 'I3 : garde ne réécrit aucune étape');
  }));
  await run('fiche et portions depuis URL', () => withRepo(async repo => {
    const f = await seed(repo);
    const { getData } = await import('../src/ui/state.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const messages = [], routes = [];
    const root = await renderRecipe({ id: f.recipe.id }, { v: f.version.id, servings: '8' }, await getData(true), { repo, toast: x => messages.push(x), navigate: x => routes.push(x) });
    document.body.append(root);
    try {
      ok(root.querySelector('[data-role=adapter-thermomix]')?.getAttribute('href').includes('v=rv-i3-adaptee'), 'I3 : adapter prend la version affichée');
      ok(root.querySelector('[data-role=adapter-thermomix]')?.getAttribute('href').includes('servings=8'), 'I3 : portions affichées transmises explicitement');
      ok(!!root.querySelector('[data-role=thermomix-portions]'), 'I3 : divergence URL visible');
      root.querySelector('[data-role=geste-principal] button').click();
      await attendre(() => messages.length);
      eq((await repo.all('cook_sessions')).length, 0, 'I3 : fiche ne démarre pas aux portions divergentes');
      [...root.querySelectorAll('button')].find(b => b.textContent === 'Revenir aux quantités adaptées').click();
      eq(root.querySelector('[data-role=thermomix-portions]'), null, 'I3 : retour explicite aux quantités enlève le blocage');
      root.querySelector('[data-role=geste-principal] button').click();
      await attendre(() => routes.length);
      eq((await repo.all('cook_sessions'))[0]?.servings, 4, 'I3 : session créée aux quantités adaptées seulement');
    } finally { root.cleanup?.(); root.dispose?.(); root.remove(); }
  }));
  await run('repas divergence et reprise', () => withRepo(async repo => {
    const f = await seed(repo);
    const { getData } = await import('../src/ui/state.js');
    const { renderMeal } = await import('../src/ui/meals.js');
    const meal = { id: 'meal-i3', title: 'Mon repas', servings: 8, items: [{ id: 'item', recipe_id: f.recipe.id, recipe_version_id: f.version.id, servings: 8, role: 'plat_principal' }], constraints_snapshot: { diets: [] } };
    await repo.save('meals', meal);
    const messages = [], routes = [];
    const root = await renderMeal({ id: meal.id }, {}, await getData(true), { repo, toast: x => messages.push(x), navigate: x => routes.push(x) });
    document.body.append(root);
    try {
      const lancer = [...root.querySelectorAll('button')].find(b => b.textContent === 'Commencer la préparation');
      lancer.click(); await attendre(() => messages.length);
      eq((await repo.all('cook_sessions')).length, 0, 'I3 : repas refuse portions divergentes');
      await repo.save('meals', { ...meal, items: [{ ...meal.items[0], servings: 4, servings_custom: true }] });
      lancer.click(); await attendre(() => routes.length);
      const session = (await repo.all('cook_sessions'))[0];
      eq(session.servings_by_version[f.version.id], 4, 'I3 : lancement relit le repas avant sa garde');
      const { renderCook } = await import('../src/ui/cook.js');
      await repo.save('cook_sessions', { ...session, servings_by_version: { [f.version.id]: 8 } });
      const reprise = await renderCook({ id: session.id }, {}, await getData(true));
      ok(reprise.matches('[data-role=thermomix-bloque]'), 'I3 : session modifiée reçue refusée à la reprise');
    } finally { root.remove(); }
  }));
  await run('exports et marquage testé', async () => {
    const f = await fixture();
    const { toJsonLd, toPaprikaYaml, toReadableSite } = await import('../src/domain/exporters.js');
    const json = toJsonLd(f);
    eq(json.cookTime, undefined, 'I3 : aucune ancienne durée dans JSON-LD');
    ok(json.description.includes('TM7') && json.description.includes('non testée'), 'I3 : export signale adaptation IA non testée');
    const en = toJsonLd(f, { locale: 'en' });
    ok(en.description.includes('TM7') && !en.description.includes('non testée'), 'I3 : étiquette de l’export anglais traduite');
    ok(!en.description.includes('Réglages proposés'), 'I3 : avertissement de l’export anglais traduit');
    ok(json.recipeInstructions[0].text.includes('100 °C'), 'I3 : réglages conservés dans JSON-LD');
    ok(toPaprikaYaml([f]).includes('100 °C'), 'I3 : réglages conservés dans Paprika');
    ok(toReadableSite([f], new Map()).entries.some(e => typeof e.data === 'string' && e.data.includes('100 °C')), 'I3 : réglages conservés dans HTML');
    f.version.status = 'tested';
    ok(!toJsonLd(f).description.includes('non testée'), 'I3 : export ne contredit pas état réellement marqué testé');
    f.version.provenance.thermomix_invalide = true;
    let refuse = false; try { toJsonLd(f); } catch { refuse = true; }
    eq(refuse, true, 'I3 : origine conservée mais approbation invalidée bloque export');
  });
  await run('exports globaux des réglages bloqués explicitement', () => withRepo(async repo => {
    const f = await seed(repo);
    const { getData } = await import('../src/ui/state.js');
    const { renderSettings } = await import('../src/ui/settings.js');
    const ctx = await getData(true);
    const version = { ...f.version, provenance: { ...f.version.provenance, thermomix_invalide: true } };
    ctx.docs = [{ recipe: f.recipe, version }];
    let telechargements = 0; const erreurs = [];
    const erreur = e => { erreurs.push(e.message || String(e.reason)); e.preventDefault(); };
    window.addEventListener('error', erreur); window.addEventListener('unhandledrejection', erreur);
    const root = await renderSettings({}, {}, ctx, { fetch: async () => { throw Error('aucun réseau'); }, telechargerRecettes: () => { telechargements++; } });
    document.body.append(root);
    try {
      for (const nom of ['Recipe / JSON-LD', 'YAML compatible Paprika', 'Créer une copie lisible (HTML)']) {
        [...root.querySelectorAll('button')].find(b => b.textContent === nom).click();
        await new Promise(resolve => setTimeout(resolve, 20));
        const statut = root.querySelector('[data-role=etat-export-recettes]');
        ok(statut?.textContent.includes('L’export est bloqué'), `I3 : ${nom} dit pourquoi l’export entier est bloqué`);
        ok(statut?.querySelector('a')?.getAttribute('href').includes(encodeURIComponent(version.id)), `I3 : ${nom} donne accès à la version concernée`);
      }
      eq(telechargements, 0, 'I3 : aucun téléchargement partiel en écartant silencieusement la recette');
      eq(erreurs, [], 'I3 : aucun échec non géré dans les gestes d’export des Réglages');
    } finally {
      window.removeEventListener('error', erreur); window.removeEventListener('unhandledrejection', erreur); root.remove();
    }
  }));
  await run('édition générique invalide le plan', () => withRepo(async repo => {
    const f = await seed(repo);
    const avant = await repo.get('recipe_versions', f.version.id);
    const { getData } = await import('../src/ui/state.js');
    const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
    const { gardeThermomix, etiquetteThermomix } = await import('../src/domain/thermomix.js');
    const root = await renderRecipeEdit({ id: f.recipe.id }, { v: f.version.id, kind: 'correction' }, await getData(true));
    document.body.append(root);
    try {
      const champ = [...root.querySelectorAll('label')].find(n => n.textContent.includes('Ingrédients (une ligne par ingrédient'))?.querySelector('textarea');
      if (!champ) throw Error('champ ingrédients absent');
      champ.value = champ.value.replace('400', '500'); champ.dispatchEvent(new Event('input', { bubbles: true }));
      [...root.querySelectorAll('button')].find(b => b.textContent === 'Enregistrer une nouvelle version').click();
      await attendre(async () => (await repo.all('recipe_versions')).length === 3);
      const enfant = (await repo.all('recipe_versions')).find(v => v.id !== f.source.id && v.id !== f.version.id);
      eq(enfant.provenance.thermomix_invalide, true, 'I3 : correction manuelle conserve une invalidation explicite');
      eq(gardeThermomix(enfant).ok, false, 'I3 : changement de quantité dans éditeur retire approbation');
      eq(enfant.constraints, f.version.constraints, 'I3 : correction manuelle ne retire pas les restrictions de la version TM7');
      ok(etiquetteThermomix(enfant).includes('d’après une adaptation TM7'), 'I3 : ascendance IA demeure visible');
      eq(await repo.get('recipe_versions', f.version.id), avant, 'I3 : édition ne réécrit pas adaptation parente');
    } finally { root.remove(); }
  }));
  await run('archive du plan autonome', () => withRepo(async (repo, db) => {
    const f = await seed(repo);
    const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
    const { withDatabase } = await import('./backup.js');
    const { gardeThermomix } = await import('../src/domain/thermomix.js');
    const archive = await createArchive(db);
    const inspection = await inspectArchive(await archive.blob.arrayBuffer());
    await withDatabase(async destination => {
      const bilan = await applyArchive(destination, inspection, { mode: 'replace' });
      eq(bilan.recipe_versions, 2, 'I3 : ZIP de la version et de son contexte restauré');
      const recu = await destination.get('recipe_versions', f.version.id);
      eq(gardeThermomix(recu).ok, true, 'I3 : plan relu après restauration sans journal');
      const verification = await verifyRestored(destination, inspection, { mode: 'replace' });
      eq(verification.ok, true, 'I3 : contenu restauré identique');
    });
  }));
}
