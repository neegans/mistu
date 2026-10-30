import { withRepo } from './sync-fixture.js';

export async function runL0CuisineTests({ eq, ok }) {
  const { siriPhrase, describeDuration, shortcutUrl, createTimerLaunch } = await import('../src/domain/timers.js');
  const { detectTimers } = await import('../src/domain/lines.js');
  const { timerBlock } = await import('../src/ui/components.js');
  const { renderCook } = await import('../src/ui/cook.js');
  const { getData } = await import('../src/ui/state.js');
  const run = async (name, fn) => { try { await fn(); } catch (e) { ok(false, `L0 cuisine ${name} : ${e.message}`); } };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const attendre = async predicate => { for (let i = 0; i < 40; i++) { if (await predicate()) return true; await pause(10); } return false; };
  const button = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent === text);
  const fiche = root => [...root.querySelectorAll('a')].find(a => a.textContent === 'Fiche');
  const recipes = ['a', 'b'].map(id => ({ id: `l0-r-${id}`, original_title: id === 'a' ? 'Plat' : 'Sauce', availability: 'available', current_version_id: `l0-v-${id}`, source_page_ids: [] }));
  const versions = recipes.map((r, i) => ({ id: r.current_version_id, recipe_id: r.id, servings: i ? 2 : 4, ingredients: [], steps: [{ id: `l0-s-${i}-1`, position: 1, text: i ? 'Préparer la sauce.' : 'Préparer le plat.', timers: [{ label: '30 à 90 secondes', seconds: 30, seconds_max: 90 }] }, { id: `l0-s-${i}-2`, position: 2, text: i ? 'Servir la sauce.' : 'Servir le plat.' }] }));
  const session = () => ({ id: 'l0-session', status: 'active', selected_version_ids: versions.map(v => v.id), active_version_id: versions[0].id, servings: 4, progress: { by_version: { [versions[1].id]: { current_step_id: versions[1].steps[1].id } }, done_step_ids: [] } });
  const fixture = (name, fn) => run(name, () => withRepo(async repo => {
    await repo.saveBatch({ recipes, recipe_versions: versions, cook_sessions: [session()] }, { conditions: { recipes: recipes.map(r => ({ key: r.id, absente: true })) } });
    const root = await renderCook({ id: 'l0-session' }, {}, await getData(true), { repo });
    document.body.append(root);
    try { await fn(root, repo); } finally { root.dispose?.(); root.remove(); }
  }));

  for (const [seconds, fr, en, display] of [
    [30, '30 secondes', '30 seconds', '30 s'], [61, '1 minute et 1 seconde', '1 minute and 1 second', '1 min 1 s'],
    [90, '1 minute et 30 secondes', '1 minute and 30 seconds', '1 min 30 s'],
    [3601, '1 heure et 1 seconde', '1 hour and 1 second', '1 heure 1 s'],
    [3661, '1 heure et 1 minute et 1 seconde', '1 hour and 1 minute and 1 second', '1 heure 1 min 1 s'],
  ]) {
    eq(siriPhrase(seconds), `Dis Siri, mets une minuterie de ${fr}`, `L0 durée : Siri FR exact ${seconds}`);
    eq(siriPhrase(seconds, 'en'), `Hey Siri, set a timer for ${en}`, `L0 durée : Siri EN exact ${seconds}`);
    eq(describeDuration(seconds), display, `L0 durée : affichage exact ${seconds}`);
    eq(new URL(shortcutUrl(seconds)).searchParams.get('text'), String(seconds), `L0 durée : raccourci exact ${seconds}`);
  }
  for (const invalid of [0, -1, NaN, Infinity, 86401, 0.1, '30']) {
    eq(shortcutUrl(invalid), null, `L0 durée : raccourci invalide refusé ${String(invalid)}`);
    let refused = false;
    try { createTimerLaunch({ duration_seconds: invalid }); } catch { refused = true; }
    ok(refused, `L0 durée : aucune demande invalide ${String(invalid)}`);
  }
  for (const text of ['Leave for 4–6 hours', 'Leave for 4 to 6 hours', 'Repos 4-6 h', 'Repos 4 à 6 heures']) {
    const timers = detectTimers(text).timers || [];
    eq(timers.map(tm => [tm.seconds, tm.seconds_max]), [[14400, 21600]], `L0 durée : plage heures ${text}`);
    ok(timers[0]?.label.includes('4'), `L0 durée : libellé conserve la borne basse ${text}`);
  }
  eq(detectTimers('Cuire 1 h 30 puis attendre 30 à 90 secondes').timers.map(tm => [tm.seconds, tm.seconds_max ?? null]), [[5400, null], [30, 90]], 'L0 durée : heures composées et secondes');
  eq(detectTimers('Repos 6 à 4 heures'), {}, 'L0 durée : plage inversée refusée');
  eq((detectTimers('Repos 12 à 30 heures').timers || []).map(tm => [tm.seconds, tm.seconds_max]), [[43200, null]], 'L0 durée : borne haute excessive écartée sans supprimer le minimum');
  eq(detectTimers('24 h 1 min'), {}, 'L0 durée : plus de 24 heures refusé');
  eq(detectTimers('1 s 2 s 3 s 4 s 5 s').timers.length, 4, 'L0 durée : quatre propositions maximum');
  eq((detectTimers('Repos 12 à ' + '9'.repeat(400) + ' heures').timers || []).map(tm => [tm.seconds, tm.seconds_max]), [[43200, null]], 'L0 durée : débordement de la borne haute conserve le minimum connu');
  eq(new URL(shortcutUrl(30.6)).searchParams.get('text'), '31', 'L0 durée : normalisation commune à la seconde');
  eq(siriPhrase(30.6), 'Dis Siri, mets une minuterie de 31 secondes', 'L0 durée : phrase après même normalisation');
  for (const [texte, attendu] of [
    ['Bake for 5 mins', [300]], ['Wait 30 secs', [30]], ['Wait 2 hrs', [7200]],
    ['Wait 1 hour 30 seconds', [3600, 30]], ['Attendre 1 h 30 secondes', [3600, 30]],
    ['Repos 1 h 30 g de beurre', [3600]], ['Attendre 1 h 30 minutes', [5400]],
    ['Repos 1 h 30', [5400]], ['Repos 1 h 30.', [5400]], ['Wait 1 hr 30 mins', [5400]], ['Rest 4–6 hrs', [14400]],
  ]) eq((detectTimers(texte).timers || []).map(tm => tm.seconds), attendu, 'L0 durée : unités explicites respectées — ' + texte);

  await run('choix partagé', async () => {
    const calls = [];
    const root = timerBlock(30, { seconds_max: 90, onRequest: (...args) => calls.push(args) });
    document.body.append(root);
    try {
      const select = root.querySelector('select');
      ok(!!select, 'L0 minuteur : choix explicite de la borne');
      eq(calls.length, 0, 'L0 minuteur : affichage sans lancement');
      const siri = button(root, 'J’ai demandé à Siri');
      ok(siri?.disabled, 'L0 minuteur : aucune demande sans choix de durée');
      if (select) {
        select.value = '90'; select.dispatchEvent(new Event('change', { bubbles: true }));
        ok(root.textContent.includes('1 minute et 30 secondes'), 'L0 minuteur : phrase correspondant à la borne haute choisie');
        siri.click(); await pause(0);
        eq(calls, [['siri', 90]], 'L0 minuteur : callback reçoit la durée choisie');
        select.value = '30'; select.dispatchEvent(new Event('change', { bubbles: true }));
        siri.click(); await pause(0);
        eq(calls[1], ['siri', 30], 'L0 minuteur : retour explicite à la borne basse');
      }
      const invalide = timerBlock(0, { onRequest: () => calls.push('invalide') });
      eq(invalide.querySelectorAll('button, a[href]').length, 0, 'L0 minuteur : valeur invalide sans commande de lancement');
      for (const maximum of [20, NaN, Infinity, 86401]) eq(timerBlock(30, { seconds_max: maximum }).querySelectorAll('button, a[href]').length, 0, 'L0 minuteur : plage reçue invalide sans lancement ' + String(maximum));
    } finally { root.remove(); }
  });
  await run('raccourci et erreur de demande', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
    try {
      let refus = true;
      const root = timerBlock(30, { seconds_max: 90, onRequest: async () => { if (refus) throw new Error('écriture refusée'); return { id: 'demande-documentaire' }; } });
      const select = root.querySelector('select'), link = root.querySelector('a');
      eq(link?.hasAttribute('href'), false, 'L0 minuteur : aucun lien Raccourcis avant un choix explicite');
      if (select) {
        select.value = '90'; select.dispatchEvent(new Event('change', { bubbles: true }));
        eq(link.hasAttribute('href'), false, 'L0 minuteur : choix seul ne prépare pas une demande durable');
        button(root, 'J’ai demandé à Siri').click();
        await attendre(() => root.textContent.includes('n’a pas été enregistrée'));
        ok(root.textContent.includes('n’a pas été enregistrée'), 'L0 minuteur : refus d’écriture expliqué sans succès');
        eq(select.value, '90', 'L0 minuteur : échec garde le choix');
        refus = false;
        button(root, 'Préparer Raccourcis').click();
        await attendre(() => link.hasAttribute('href'));
        eq(new URL(link.href).searchParams.get('text'), '90', 'L0 minuteur : URL Raccourcis porte la borne choisie après préparation conservée');
        root.dispose();
      }
    } finally {
      if (original) Object.defineProperty(navigator, 'userAgent', original); else delete navigator.userAgent;
    }
  });

  await fixture('sélection et reprise', async (root, repo) => {
    button(root, 'Sauce').click();
    await attendre(() => fiche(root)?.getAttribute('href') === '#/recipes/l0-r-b?v=l0-v-b');
    eq(button(root, 'Sauce').classList.contains('active'), true, 'L0 cuisine : onglet sauce actif');
    eq(fiche(root).getAttribute('href'), '#/recipes/l0-r-b?v=l0-v-b', 'L0 cuisine : lien vers la bonne version de sauce');
    eq(root.querySelector('[data-role=texte-etape]').textContent, 'Servir la sauce.', 'L0 cuisine : étape propre à la sauce conservée');
    eq((await repo.get('cook_sessions', 'l0-session')).active_version_id, versions[1].id, 'L0 cuisine : sélection enregistrée sans geste Suivant');
    const reprise = await renderCook({ id: 'l0-session' }, {}, await getData(true), { repo });
    try { eq(fiche(reprise).getAttribute('href'), '#/recipes/l0-r-b?v=l0-v-b', 'L0 cuisine : reprise de la recette sélectionnée'); } finally { reprise.dispose?.(); }
  });
  await fixture('progression concurrente et clics rapides', async (root, repo) => {
    const current = await repo.get('cook_sessions', 'l0-session');
    const progress = { by_version: { [versions[0].id]: { current_step_id: versions[0].steps[1].id } }, done_step_ids: ['autre-onglet'] };
    await repo.save('cook_sessions', { ...current, progress });
    await root.actualiserCuisine();
    button(root, 'Sauce').click(); button(root, 'Plat').click(); button(root, 'Sauce').click();
    await attendre(async () => (await repo.get('cook_sessions', 'l0-session'))?.active_version_id === versions[1].id);
    await pause(40);
    const saved = await repo.get('cook_sessions', 'l0-session');
    eq(saved.active_version_id, versions[1].id, 'L0 cuisine : dernier clic conservé');
    eq([saved.progress.current_step_id??null,saved.progress.done_step_ids,saved.progress.legacy_by_version],[progress.current_step_id??null,progress.done_step_ids,progress.by_version], 'L0 cuisine : sélection après relecture préserve progression legacy concurrente lors adoption');
  });
  await fixture('version retirée avant progression', async (root, repo) => {
    button(root, 'Sauce').click();
    await attendre(() => fiche(root)?.getAttribute('href') === '#/recipes/l0-r-b?v=l0-v-b');
    button(root, '← Précédent').click();
    await attendre(async () => (await repo.get('cook_sessions', 'l0-session'))?.progress.by_version[versions[1].id]?.current_step_id === versions[1].steps[0].id);
    await attendre(() => !!button(root, 'Suivant →'));
    const current = await repo.get('cook_sessions', 'l0-session');
    await repo.db.mutate({origin:'remote',puts:{cook_sessions:[{ ...current, selected_version_ids: [versions[0].id], active_version_id: versions[0].id }]}});
    const before = await repo.get('cook_sessions', 'l0-session'), outbox = await repo.all('outbox');
    button(root, 'Suivant →').click();
    await attendre(() => root.textContent.includes('progression'));
    eq(await repo.get('cook_sessions', 'l0-session'), before, 'L0 cuisine : progression ne réactive pas une version retirée ailleurs');
    eq(await repo.all('outbox'), outbox, 'L0 cuisine : progression refusée sans capture');
    ok(root.textContent.includes('progression'), 'L0 cuisine : progression devenue invalide expliquée');
    eq(root.querySelector('[data-role=texte-etape]').textContent, 'Préparer la sauce.', 'L0 cuisine : progression refusée garde la dernière étape affichée');
  });
  for (const change of ['terminée', 'supprimée', 'version retirée', 'version supprimée', 'recette supprimée', 'version réattribuée']) await fixture(change, async (root, repo) => {
    const before = await repo.get('cook_sessions', 'l0-session');
    if (change === 'terminée') await repo.save('cook_sessions', { ...before, status: 'finished' });
    else if (change === 'supprimée') await repo.remove('cook_sessions', before.id);
    else if (change === 'version retirée') await repo.save('cook_sessions', { ...before, selected_version_ids: [versions[0].id] });
    else if (change === 'version supprimée') await repo.remove('recipe_versions', versions[1].id);
    else if (change === 'version réattribuée') await repo.db.put('recipe_versions', { ...versions[1], recipe_id: recipes[0].id }, { origin: 'device' }); // arrivée concurrente hors garde locale
    else await repo.remove('recipes', recipes[1].id);
    const expected = await repo.get('cook_sessions', before.id);
    const outbox = await repo.all('outbox');
    button(root, 'Sauce').click();
    await attendre(() => root.textContent.includes('sélection') || root.textContent.includes('séance est terminée'));
    eq(await repo.get('cook_sessions', before.id), expected, `L0 cuisine : ${change}, aucune modification de session`);
    eq(await repo.all('outbox'), outbox, `L0 cuisine : ${change}, aucune capture d’écriture refusée`);
    ok(root.textContent.includes('sélection') || root.textContent.includes('séance est terminée'), `L0 cuisine : ${change}, refus expliqué`);
  });
  await fixture('lancement durée choisie', async (root, repo) => {
    const select = root.querySelector('select');
    ok(!!select, 'L0 cuisine : plage propose un choix de durée');
    if (!select) return;
    select.value = '90'; select.dispatchEvent(new Event('change', { bubbles: true }));
    button(root, 'J’ai demandé à Siri').click();
    await attendre(async () => (await repo.all('timer_launches')).length === 1);
    const launches = await repo.all('timer_launches');
    eq(launches.map(l => [l.duration_seconds, l.recipe_version_id, l.step_id, l.cook_session_id, l.channel]), [[90, versions[0].id, versions[0].steps[0].id, 'l0-session', 'siri']], 'L0 cuisine : demande réelle liée à la bonne étape et durée');
  });
  await run('sélections sérialisées malgré latence', () => withRepo(async repo => {
    await repo.saveBatch({ recipes, recipe_versions: versions, cook_sessions: [session()] }, { conditions: { recipes: recipes.map(r => ({ key: r.id, absente: true })) } });
    let calls = 0, parallel = 0, maximum = 0;
    const delayed = { ...repo, muterCuisine: async (...args) => {
      const n = calls++; parallel++; maximum = Math.max(maximum, parallel);
      try { await pause(n === 0 ? 60 : 2); return await repo.muterCuisine(...args); } finally { parallel--; }
    } };
    const root = await renderCook({ id: 'l0-session' }, {}, await getData(true), { repo: delayed });
    try {
      button(root, 'Sauce').click(); button(root, 'Plat').click();
      await attendre(() => calls === 2 && parallel === 0);
      eq((await repo.get('cook_sessions', 'l0-session')).active_version_id, versions[0].id, 'L0 cuisine : écriture lente ne remplace pas le dernier choix');
      eq(maximum, 1, 'L0 cuisine : une seule écriture de sélection à la fois');
    } finally { root.dispose?.(); }
  }));
  await run('vue quittée pendant demande', () => withRepo(async repo => {
    await repo.saveBatch({ recipes, recipe_versions: versions, cook_sessions: [session()] }, { conditions: { recipes: recipes.map(r => ({ key: r.id, absente: true })) } });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let entree = false;
    const delayed = { ...repo, muterCuisine: async (...args) => { entree = true; await gate; return repo.muterCuisine(...args); } };
    const root = await renderCook({ id: 'l0-session' }, {}, await getData(true), { repo: delayed });
    const select = root.querySelector('select'); select.value = '30'; select.dispatchEvent(new Event('change', { bubbles: true }));
    const originalInterval = window.setInterval, originalClear = window.clearInterval, intervals = new Set();
    window.setInterval = (...args) => { const id = originalInterval(...args); intervals.add(id); return id; };
    window.clearInterval = id => { intervals.delete(id); originalClear(id); };
    try {
      button(root, 'J’ai demandé à Siri').click(); ok(await attendre(() => entree), 'L0 cuisine : demande atteint la vraie transaction avant fermeture'); root.dispose?.(); release();
      await pause(30);
      eq(intervals.size, 0, 'L0 cuisine : demande tardive ne redémarre pas un miroir de vue détruite');
    } finally { for (const id of intervals) originalClear(id); window.setInterval = originalInterval; window.clearInterval = originalClear; }
  }));
}
