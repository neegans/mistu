import { withRepo } from './sync-fixture.js';

export async function runI2CuisineTests({ eq, ok }) {
  const run = async (nom, f) => { try { await f(); } catch (e) { ok(false, `I2 cuisine — ${nom} : ${e.message}`); } };
  const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
  const now = '2026-10-28T12:00:00.000Z';
  const seed = async (repo) => {
    const recipe = { id: 'r-i2', original_title: 'Soupe', personal_notes: 'Moins de sel', photo_sha256: C, favorite: true };
    const version = { id: 'v-i2', recipe_id: recipe.id, servings: 2, ingredients: [], steps: [], kind: 'extraction' };
    await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, {conditions:{recipes:[{key:recipe.id,absente:true}]}}); return { recipe, version };
  };
  await run('dates, limites et sélection', async () => {
    const d = await import('../src/domain/cuisine-personnelle.js');
    eq(d.dateCuisson('2026-10-27'), '2026-10-27', 'I2 date civile sans conversion UTC');
    eq(d.dateCuisson('2026-02-30'), null, 'I2 jour inexistant refusé');
    eq(d.dateCuisson('pas une date'), null, 'I2 date hostile ignorée');
    eq(d.photosDeCuisson({ photos: [A, A, null, 'https://exemple.invalid', B] }), [A, B], 'I2 photos : empreintes uniques seulement');
    const history = [
      { id: 'a', recipe_id: 'r', cooked_at: '2026-10-20', created_at: '2026-10-28', photos: [A] },
      { id: 'b', recipe_id: 'r', cooked_at: '2026-10-22', created_at: '2026-10-22', photos: [A, B] },
      { id: 'c', recipe_id: 'autre', cooked_at: '2026-10-28', photos: [C] },
    ];
    eq(d.photoPrincipale({ id: 'r', photo_sha256: C }, history), { sha256: B, personnelle: true, cuisson_id: 'b' }, 'I2 dernière cuisson illustrée, non dernier ajout rétroactif');
    eq(d.photoPrincipale({ id: 'r', photo_sha256: C }, []), { sha256: C, personnelle: false, cuisson_id: null }, 'I2 repli photo du livre');
    eq(d.photoPrincipale({ id: 'r' }, []), null, 'I2 absence de photo ne crée rien');
    eq(d.photoPrincipale({ id: 'r' }, d.photosPersonnellesParRecette(history))?.sha256, B, 'I2 index partagé des photos');
    const good = { date: '2026-10-27', notes: 'Très bon', servings: '2.5', actual: '0', rating: 5, redo: false, photos: [A] };
    const parsed = d.validerCuisson(good, { aujourdHui: '2026-10-28' });
    eq([parsed.servings, parsed.actual_minutes, parsed.redo], [2.5, 0, false], 'I2 zéro minute et non à refaire conservés');
    for (const delta of [{ date: '2026-10-29' }, { date: '2026-02-30' }, { rating: 6 }, { actual: '1.5' }, { servings: '-2' }, { notes: 'x'.repeat(10001) }, { photos: [A, B, C, 'd'.repeat(64), 'e'.repeat(64), 'f'.repeat(64), '1'.repeat(64)] }]) {
      let refused = false; try { d.validerCuisson({ ...good, ...delta }, { aujourdHui: '2026-10-28' }); } catch { refused = true; }
      ok(refused, `I2 saisie hors limites refusée : ${Object.keys(delta)[0]}`);
    }
  });
  await run('écritures et concurrence', () => withRepo(async (repo) => {
    const { enregistrerCuissons, enregistrerTextePersonnel, modifierPhotosCuisson } = await import('../src/ui/cuisson.js');
    const { recipe, version } = await seed(repo);
    const item = { recipe, version, id: 'h-i2', form: { date: '2026-10-27', notes: 'Goût fin', actual: '0', photos: [] } };
    await enregistrerCuissons([item], { repo, maintenant: () => now });
    await enregistrerCuissons([item], { repo, maintenant: () => now });
    eq((await repo.all('cook_history')).filter(h => h.recipe_id === recipe.id).length, 1, 'I2 brouillon de cuisson idempotent');
    const h = await repo.get('cook_history', item.id);
    eq([h.recipe_version_id, h.cooked_at, h.actual_minutes, h.quantities_snapshot], [version.id, '2026-10-27', 0, []], 'I2 version exacte, date civile, aucune quantité inventée');
    await enregistrerTextePersonnel('recipes', recipe.id, 'personal_notes', 'Moins de sel', '<img src=x>\nExcellent', { repo });
    const after = await repo.get('recipes', recipe.id);
    eq([after.personal_notes, after.favorite, after.photo_sha256], ['<img src=x>\nExcellent', true, C], 'I2 note permanente indépendante');
    let conflict = false;
    try { await enregistrerTextePersonnel('recipes', recipe.id, 'personal_notes', 'Moins de sel', 'Écrasement', { repo }); } catch (e) { conflict = e.code === 'conflit'; }
    ok(conflict, 'I2 conflit du même texte refusé');
    await enregistrerTextePersonnel('cook_history', item.id, 'notes', 'Goût fin', '', { repo });
    eq((await repo.get('cook_history', item.id)).notes, '', 'I2 observation vidée sans nouvelle cuisson');
    await repo.putFile(A, new Blob(['photo-a'], { type: 'image/jpeg' }), { mime: 'image/jpeg' });
    await repo.putFile(B, new Blob(['photo-b'], { type: 'image/jpeg' }), { mime: 'image/jpeg' });
    await modifierPhotosCuisson(item.id, { ajouter: [A, A, B] }, { repo });
    await modifierPhotosCuisson(item.id, { retirer: [A] }, { repo });
    eq((await repo.get('cook_history', item.id)).photos, [B], 'I2 ajout fusionné puis retrait du lien seul');
    ok(!!await repo.getFile(A), 'I2 fichier retiré conservé pour les autres références');
    eq((await repo.get('recipe_versions', version.id)).ingredients, [], 'I2 version intacte');
  }));
  await run('repas, clôture atomique et références', () => withRepo(async (repo) => {
    const { enregistrerCuissons } = await import('../src/ui/cuisson.js');
    const { recipe, version } = await seed(repo);
    const r2 = { id: 'r2-i2', original_title: 'Pain' }, v2 = { id: 'v2-i2', recipe_id: r2.id, ingredients: [], steps: [] };
    const session = { id: 'cs-i2', recipe_id: recipe.id, status: 'active', selected_version_ids: [version.id, v2.id], progress: {} };
    await repo.saveBatch({ recipes: [r2], recipe_versions: [v2], cook_sessions: [session] }, {conditions:{recipes:[{key:r2.id,absente:true}]}});
    const items = [
      { recipe, version, id: 'h1', form: { date: '2026-10-28', notes: 'Soupe bonne', photos: [] }, scaled: { ingredients: [] } },
      { recipe: r2, version: v2, id: 'h2', form: { date: '2026-10-28', notes: 'Pain sec', rating: 2, photos: [] }, scaled: { ingredients: [] } },
    ];
    await Promise.all([enregistrerCuissons(items, { repo, session, maintenant: () => now }), enregistrerCuissons(items, { repo, session, maintenant: () => now })]);
    eq((await repo.all('cook_history')).filter(h => h.cook_session_id === session.id).map(h => h.notes).sort(), ['Pain sec', 'Soupe bonne'], 'I2 observations distinctes, clôture concurrente sans doublon');
    eq((await repo.get('cook_sessions', session.id)).status, 'done', 'I2 session clôturée');
    let refused = false; try { await enregistrerCuissons([{ recipe: r2, version: null, id: 'h-ref', form: { date: '2026-10-28' } }], { repo, maintenant: () => now }); } catch { refused = true; }
    ok(refused, 'I2 référence sans version : aucune cuisson ni fausse version');
  }));
  await run('formulaire et texte inerte', () => withRepo(async (repo) => {
    const { creerFormulaireCuisson, monterNotesPersonnelles } = await import('../src/ui/cuisson.js');
    const { recipe, version } = await seed(repo);
    const f = creerFormulaireCuisson({ recipe, version, id: 'form-i2' }, { repo, maintenant: () => now });
    eq(f.root.querySelector('input[type=date]').value, '2026-10-28', 'I2 formulaire date par défaut');
    f.root.querySelector('textarea').value = 'Note propre';
    eq(f.lire().notes, 'Note propre', 'I2 formulaire lit ses propres observations');
    const notes = await monterNotesPersonnelles({ ...recipe, personal_notes: '<img src=x onerror=alert(1)>' }, { repo });
    eq(notes.querySelectorAll('img').length, 0, 'I2 note permanente rendue en texte');
    ok(notes.textContent.includes('<img src=x'), 'I2 texte personnel visible et inerte');
    f.detruire();
  }));
  await run('parcours fiche, photo personnelle et repas', () => withRepo(async (repo, db) => {
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { renderCook } = await import('../src/ui/cook.js');
    const { monterPhotoPlat, reinitialiserPhotoPlat } = await import('../src/ui/photo-plat.js');
    const { recipe, version } = await seed(repo);
    const reference = { id: 'ref-i2', original_title: 'Livre à importer', availability: 'reference_only', personal_notes: 'À essayer dimanche' };
    await repo.save('recipes', reference, {conditions:{recipes:[{key:reference.id,absente:true}]}});
    const ctx = async () => {
      const recipes = await repo.all('recipes'), vs = await repo.all('recipe_versions');
      return { recipes, recipesById: new Map(recipes.map(r => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map(v => [v.id, v])),
        editionsById: new Map(), booksById: new Map(), pagesById: new Map(), dishesById: new Map(), books: [], book_editions: [], dishes: [], imports: [], cook_history: await repo.all('cook_history'),
        cook_sessions: await repo.all('cook_sessions'), dish_recipe_links: [], recipe_translations: [], ingredients: [], ingredientsById: new Map(), source_documents: [], source_pages: [], scan_sessions: [],
        rediscovery_prefs: [], docsByRecipe: new Map(), meals: [], meal_feedback: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr' }, conventionFor: () => null, sync: {} };
    };
    const scene = document.createElement('div'); document.body.append(scene);
    const attendre = async f => { for (let n = 0; n < 150; n++) { if (await f()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('attente du comportement'); };
    try {
      const ficheRef = await renderRecipe({ id: reference.id }, {}, await ctx(), { repo, toast: () => {} }); scene.append(ficheRef);
      ok(ficheRef.querySelector('[data-role=notes-personnelles]')?.textContent.includes(reference.personal_notes), 'I2 notes présentes avant le retour référence sans version');
      eq(ficheRef.querySelector('[data-role=jai-cuisine]'), null, 'I2 aucune cuisson implicite sur une référence');
      const canvas = document.createElement('canvas'); canvas.width = 12; canvas.height = 12; canvas.getContext('2d').fillRect(0, 0, 12, 12);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      await repo.putFile(A, blob, { mime: 'image/jpeg' }); await repo.putFile(C, blob, { mime: 'image/jpeg' });
      const h = { id: 'photo-i2', recipe_id: recipe.id, recipe_version_id: version.id, cooked_at: '2026-10-27', photos: [A] };
      await repo.save('cook_history', h);
      const photo = await monterPhotoPlat(recipe, await ctx(), { repo, toast: () => {} }); scene.append(photo.entete, photo.zone);
      eq(photo.entete.querySelector('img')?.alt, 'Ma photo du plat', 'I2 tête de fiche montre la photo personnelle');
      ok(!!photo.zone.querySelector('[data-role=photo-source] img'), 'I2 photo du livre reste visible séparément');
      await repo.save('cook_history', { ...h, photos: [] }); await photo.redessiner();
      eq(photo.entete.querySelector('img')?.alt, 'Photo du plat', 'I2 retirer la dernière photo revient au livre');
      const r2 = { id: 'rp-i2', original_title: 'Pain', personal_notes: 'Couvrir le saladier' }, v2 = { id: 'vp-i2', recipe_id: 'rp-i2', ingredients: [], steps: [] };
      const session = { id: 'repas-i2', recipe_id: recipe.id, selected_version_ids: [version.id, v2.id], status: 'active', progress: {} };
      await repo.saveBatch({ recipes: [r2], recipe_versions: [v2], cook_sessions: [session] }, {conditions:{recipes:[{key:r2.id,absente:true}]}});
      const sorties = [];
      const cook = await renderCook({ id: session.id }, {}, await ctx(), { repo, maintenant: () => now, toast: () => {}, navigate: url => sorties.push(url) }); scene.append(cook);
      ok(cook.querySelector('[data-role=notes-personnelles-cuisine]')?.textContent.includes(recipe.personal_notes), 'I2 note personnelle visible à côté des étapes');
      [...cook.querySelectorAll('button')].find(b => b.textContent === 'Terminer').click();
      [...cook.querySelectorAll('button')].find(b => b.textContent === 'Terminer').click();
      await attendre(() => document.querySelector('[data-role=dialogue-cuissons]'));
      eq(document.querySelectorAll('[data-role=dialogue-cuissons]').length, 1, 'I2 double tape Terminer n’ouvre qu’un bilan');
      const dlg = document.querySelector('[data-role=dialogue-cuissons]');
      eq(dlg.querySelectorAll('[data-role=formulaire-cuisson]').length, 2, 'I2 un formulaire par recette du repas');
      const notes = dlg.querySelectorAll('textarea'); notes[0].value = 'La soupe'; notes[1].value = 'Le pain';
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Enregistrer').click();
      await attendre(async () => (await repo.get('cook_sessions', session.id)).status === 'done');
      eq((await repo.all('cook_history')).filter(row => row.cook_session_id === session.id).map(row => row.notes).sort(), ['La soupe', 'Le pain'], 'I2 parcours DOM conserve les observations par recette');
      await attendre(() => document.querySelector('[data-role=restes-cuisson]'));
      document.querySelector('[data-role=fermer-restes]').click();
      await attendre(() => sorties.length === 1);
      eq(document.querySelector('[data-role=dialogue-cuissons]'), null, 'I2 bilan fermé après écriture réelle');
    } finally { for (const cuisine of scene.querySelectorAll('.mode-cuisine')) cuisine.dispose?.(); scene.remove(); for (const dlg of document.querySelectorAll('[data-role=dialogue-cuissons], [data-role=dialogue-note], [data-role=restes-cuisson]')) dlg.remove(); reinitialiserPhotoPlat(); }
  }));
  await run('saisie conservée, confirmation et échec atomique', () => withRepo(async repo => {
    const { ouvrirTextePersonnel, creerFormulaireCuisson, enregistrerCuissons } = await import('../src/ui/cuisson.js');
    const { recipe, version } = await seed(repo);
    const attendre = async f => { for (let n = 0; n < 150; n++) { if (await f()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('attente du comportement'); };
    const dlg = ouvrirTextePersonnel({ store: 'recipes', id: recipe.id, champ: 'personal_notes', valeur: recipe.personal_notes, titre: 'Mes notes' }, { repo, toast: () => {} });
    try {
      dlg.querySelector('textarea').value = 'Ma correction';
      await repo.save('recipes', { ...(await repo.get('recipes', recipe.id)), personal_notes: 'Autre onglet', favorite: false });
      const enregistrer = [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Enregistrer'); enregistrer.click();
      await attendre(() => dlg.textContent.includes('Garder ma saisie'));
      eq((await repo.get('recipes', recipe.id)).personal_notes, 'Autre onglet', 'I2 conflit affiché sans écraser le texte distant');
      eq(dlg.querySelector('textarea').value, 'Ma correction', 'I2 conflit garde ma saisie');
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Garder ma saisie').click();
      enregistrer.click(); await attendre(() => !dlg.isConnected);
      eq([(await repo.get('recipes', recipe.id)).personal_notes, (await repo.get('recipes', recipe.id)).favorite], ['Ma correction', false], 'I2 résolution explicite touche seulement le texte');
    } finally { dlg.remove(); }
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20; canvas.getContext('2d').fillRect(0, 0, 20, 20);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const before = (await repo.all('files')).length;
    const item = { recipe, version, id: 'h-photo-i2' };
    const form = creerFormulaireCuisson(item, { repo, maintenant: () => now, pickFiles: async () => [blob, blob] });
    document.body.append(form.root);
    try {
      [...form.root.querySelectorAll('button')].find(b => b.textContent === 'Choisir des photos').click();
      await attendre(() => form.lire().photos.length === 1 && !form.occupe());
      eq((await repo.all('files')).length, before, 'I2 prévisualisation ne sauvegarde aucun fichier ni cuisson');
      eq(form.root.querySelectorAll('img').length, 1, 'I2 même photo choisie deux fois : un aperçu');
      await enregistrerCuissons([{ ...item, form: form.lire(), fichiers: form.fichiers }], { repo, maintenant: () => now });
      const h = await repo.get('cook_history', item.id);
      ok(!!(await repo.getFile(h.photos[0]))?.blob, 'I2 octets réellement présents avant lien de la cuisson');
      const missing = { ...item, id: 'h-manquant-i2', form: { date: '2026-10-27', photos: ['9'.repeat(64)] } };
      let rejected = false; try { await enregistrerCuissons([missing], { repo, maintenant: () => now }); } catch { rejected = true; }
      ok(rejected, 'I2 ajout de pointeur sans fichier refusé');
      eq(await repo.get('cook_history', missing.id), undefined, 'I2 refus de fichier annule toute la cuisson');
    } finally { form.root.remove(); form.detruire(); }
  }));
  await run('ajout de photos à une cuisson avec aperçu et confirmation', () => withRepo(async repo => {
    const { monterMesPhotos } = await import('../src/ui/cuisson.js');
    const { recipe, version } = await seed(repo);
    const h = { id: 'h-apercu-i2', recipe_id: recipe.id, recipe_version_id: version.id, cooked_at: '2026-10-28', notes: 'À garder', photos: [] };
    await repo.save('cook_history', h);
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 40; canvas.getContext('2d').fillRect(0, 0, 40, 40);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const avant = (await repo.all('files')).length;
    const vue = await monterMesPhotos(recipe, [h], { repo, toast: () => {}, pickFiles: async () => [blob] }); document.body.append(vue);
    const attendre = async f => { for (let n = 0; n < 150; n++) { if (await f()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('attente aperçu cuisson'); };
    let dlg;
    try {
      [...vue.querySelectorAll('button')].find(b => b.textContent === 'Ajouter une photo à cette cuisson').click();
      await attendre(async () => document.querySelector('[data-role=dialogue-photos-cuisson] img') || (await repo.get('cook_history', h.id)).photos.length);
      eq((await repo.get('cook_history', h.id)).photos, [], 'I2 ajout à une cuisson : aucun pointeur avant confirmation');
      eq((await repo.all('files')).length, avant, 'I2 ajout à une cuisson : aucun fichier avant confirmation');
      dlg = document.querySelector('[data-role=dialogue-photos-cuisson]');
      ok(!!dlg, 'I2 ajout à une cuisson : aperçu modifiable dans le dialogue');
      if (!dlg) return;
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Retirer cette photo').click();
      eq(dlg.querySelectorAll('img').length, 0, 'I2 nouvelle photo retirable avant enregistrement');
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Choisir des photos').click();
      await attendre(() => !!dlg.querySelector('img'));
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Annuler').click();
      eq((await repo.get('cook_history', h.id)).photos, [], 'I2 annuler les aperçus ne modifie pas la cuisson');
      eq((await repo.all('files')).length, avant, 'I2 annuler les aperçus ne conserve aucun nouveau fichier');
      const { doitRendreApresPasse } = await import('../src/ui/state.js');
      await attendre(() => doitRendreApresPasse({ avant: true, etat: { enCours: false, derniersEffets: { recues: 1 } }, route: '/recipes/' + recipe.id }));
      [...vue.querySelectorAll('button')].find(b => b.textContent === 'Ajouter une photo à cette cuisson').click();
      await attendre(() => document.querySelector('[data-role=dialogue-photos-cuisson] img'));
      dlg = document.querySelector('[data-role=dialogue-photos-cuisson]');
      await repo.save('cook_history', { ...(await repo.get('cook_history', h.id)), notes: 'Observation concurrente' });
      [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Enregistrer').click();
      await attendre(() => !dlg.isConnected);
      const relue = await repo.get('cook_history', h.id);
      eq([relue.photos.length, relue.notes], [1, 'Observation concurrente'], 'I2 ajout confirmé fusionne la photo sans perdre l’observation concurrente');
      ok(!!(await repo.getFile(relue.photos[0]))?.blob, 'I2 photo confirmée possède ses octets');
    } finally { dlg?.remove(); vue.remove(); }
  }));
  await run('réception sync pendant une saisie montée', () => withRepo(async repo => {
    const { ouvrirTextePersonnel, ouvrirCuissons, monterMesPhotos } = await import('../src/ui/cuisson.js');
    const { doitRendreApresPasse } = await import('../src/ui/state.js');
    const { recipe, version } = await seed(repo);
    const passe = { avant: true, etat: { enCours: false, derniersEffets: { recues: 1 } }, route: '/recipes/' + recipe.id };
    const annuler = dlg => [...dlg.querySelectorAll('button')].find(b => b.textContent === 'Annuler').click();
    eq(doitRendreApresPasse(passe), true, 'I2 la fiche sans saisie montre les arrivées sync');
    const note = ouvrirTextePersonnel({ store: 'recipes', id: recipe.id, champ: 'personal_notes', valeur: recipe.personal_notes, titre: 'Mes notes' }, { repo, toast: () => {} });
    try {
      note.querySelector('textarea').value = 'Ma saisie encore locale';
      eq(doitRendreApresPasse(passe), false, 'I2 la réception sync ne remonte pas la fiche pendant la note');
      eq(note.querySelector('textarea').value, 'Ma saisie encore locale', 'I2 la note locale reste disponible');
    } finally { annuler(note); }
    eq(doitRendreApresPasse(passe), true, 'I2 la fermeture de la note libère le rafraîchissement');
    const bilan = ouvrirCuissons([{ recipe, version }], { repo, maintenant: () => now, toast: () => {} });
    const dlg = document.querySelector('[data-role=dialogue-cuissons]');
    try { eq(doitRendreApresPasse(passe), false, 'I2 le bilan de cuisson protège ses observations et aperçus'); }
    finally { annuler(dlg); await bilan; }
    const h = { id: 'h-sync-i2', recipe_id: recipe.id, recipe_version_id: version.id, cooked_at: '2026-10-28', photos: [] };
    await repo.save('cook_history', h);
    let choisir;
    const vue = await monterMesPhotos(recipe, [h], { repo, toast: () => {}, pickFiles: () => new Promise(resolve => { choisir = resolve; }) }); document.body.append(vue);
    try {
      [...vue.querySelectorAll('button')].find(b => b.textContent === 'Ajouter une photo à cette cuisson').click();
      eq(doitRendreApresPasse(passe), false, 'I2 la sélection de fichier en cours protège la fiche');
      for (let n=0;n<100 && !choisir;n++) await new Promise(resolve=>setTimeout(resolve,5));
      choisir([]);
      for (let n = 0; n < 100 && !doitRendreApresPasse(passe); n++) await new Promise(resolve => setTimeout(resolve, 10));
      eq(doitRendreApresPasse(passe), true, 'I2 annuler le choix de fichier libère le rafraîchissement');
      choisir = null;
      [...vue.querySelectorAll('button')].find(b => b.textContent === 'Ajouter une photo à cette cuisson').click();
      for (let n=0;n<100 && !choisir;n++) await new Promise(resolve=>setTimeout(resolve,5));
      vue.remove();
      eq(doitRendreApresPasse(passe), true, 'I2 une vue quittée ne bloque pas la synchronisation des suivantes');
      choisir([]); await new Promise(resolve => setTimeout(resolve, 0));
    } finally { vue.remove(); }
  }));
}
