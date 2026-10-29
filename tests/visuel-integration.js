import { withRepo } from './sync-fixture.js';

export async function runVisuelIntegrationTests({ eq, ok }) {
  const run = async (nom, fn) => { try { await fn(); } catch (e) { ok(false, `Visuel intégration ${nom} : ${e.message}`); } };
  const recipe = { id: 'visuel-r', original_title: 'Trinity bread', display_title: 'Mon pain', availability: 'partial', source_page_ids: [], current_version_id: 'visuel-v' };
  const version = { id: 'visuel-v', recipe_id: recipe.id, kind: 'extraction', servings: 4, ingredients: [], steps: [{ id: 'visuel-s1', position: 1, text: 'Mélanger les ingrédients.', timers: [] }, { id: 'visuel-s2', position: 2, text: 'Laisser lever.', timers: [] }], provenance: {} };
  await run('ligne du livre', async () => {
    const { ligneCompacte } = await import('../src/ui/book.js');
    const root = ligneCompacte(recipe, { version });
    eq(root.querySelector('a.titre')?.textContent, 'Trinity bread', 'Visuel : titre original préservé dans la liste du livre');
    ok(!!root.querySelector('.recette-ligne-entete') && !!root.querySelector('.recette-ligne-actions'), 'Visuel : informations et actions occupent des blocs distincts');
    ok([...root.querySelectorAll('a')].some(a => a.textContent === 'Compléter'), 'Visuel : recette partielle propose Compléter');
    eq(root.querySelector('[data-role=gerer-photo]')?.getAttribute('href'), '#/recipes/visuel-r/photo', 'Visuel : gestion photo depuis une ligne du livre');
    ok(root.textContent.includes('Description à compléter') && root.textContent.includes('Niveau à estimer') && root.textContent.includes('Temps à estimer'), 'Visuel : repères inconnus nommés sans inventer de données');
  });
  await run('accès à la description française', async () => {
    const { resumeReperes } = await import('../src/ui/reperes-affichage.js');
    const { construireContexteReperes, fabriquerCorrectionsReperes, fusionnerReperes } = await import('../src/domain/reperes.js');
    const vide = resumeReperes(recipe, version, { detail: true, modifier: true });
    const action = vide.querySelector('[data-role=modifier-reperes]');
    eq(action?.textContent, 'Compléter les informations — 1 appel', 'Description : fiche ancienne propose explicitement de compléter les informations');
    eq(action?.getAttribute('href'), '#/recipes/visuel-r/reperes?v=visuel-v', 'Description : accès conserve la version affichée');
    ok(action && !action.closest('details') && (action.compareDocumentPosition(vide.querySelector('.reperes-badges')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Description : action visible sous le texte, avant les badges et détails repliables');
    ok(vide.textContent.includes('Une courte description en français') && vide.textContent.includes('saisie manuelle sans compte'), 'Description : accès explique le résultat français et la possibilité sans compte');
    const contexte = construireContexteReperes({ recipe, version });
    const avec = { ...recipe, reperes: fusionnerReperes(null, { corrections: fabriquerCorrectionsReperes({ description_fr: { texte: 'Ma description française.' } }, contexte, '2026-10-29T12:00:00Z') }) };
    const renseigne = resumeReperes(avec, version, { detail: true, modifier: true });
    eq(renseigne.querySelector('[data-role=modifier-reperes]').textContent, 'Actualiser les informations — 1 appel', 'Description : informations présentes proposent Actualiser');
    eq(renseigne.querySelector('.description-recette').textContent, 'Ma description française.', 'Description : nouvelle action préserve la correction existante');
    ok((renseigne.querySelector('.details-reperes').compareDocumentPosition(renseigne.querySelector('[data-role=modifier-reperes]')) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !renseigne.textContent.includes('Une courte description en français'), 'Description : informations renseignées gardent un accès après les détails, sans aide répétée');
    avec.reperes = fusionnerReperes(avec.reperes, { corrections: fabriquerCorrectionsReperes({ description_fr: null }, contexte, '2026-10-29T12:01:00Z') });
    const efface = resumeReperes(avec, version, { modifier: true });
    eq([efface.querySelector('.description-recette').textContent, efface.querySelector('[data-role=modifier-reperes]').textContent], ['Description à compléter', 'Actualiser les informations — 1 appel'], 'Description : effacement manuel reste inconnu et peut être actualisé volontairement');
    const reference = resumeReperes({ ...recipe, availability: 'reference_only', current_version_id: null }, null, { modifier: true });
    eq(reference.querySelector('[data-role=modifier-reperes]').getAttribute('href'), '#/recipes/visuel-r/reperes', 'Description : référence sans version garde son accès propre');
    eq(resumeReperes(recipe, version).querySelector('[data-role=modifier-reperes]'), null, 'Description : résumé de liste ne duplique pas les commandes de fiche');
  });
  await run('photo personnelle distante', async () => {
    const { fichierPhoto } = await import('../src/ui/components.js');
    const { photosPersonnellesParRecette } = await import('../src/domain/cuisine-personnelle.js');
    const perso = 'b'.repeat(64), livre = 'a'.repeat(64);
    const historique = photosPersonnellesParRecette([{ id: 'ch', recipe_id: recipe.id, cooked_on: '2026-10-28', cooked_at: '2026-10-28T12:00:00Z', photos: [perso] }]);
    const distante = { sha256: perso, mime: 'image/jpeg', remote: {} };
    const files = new Map([[perso, distante], [livre, { sha256: livre, mime: 'image/jpeg', blob: new Blob(['livre'], { type: 'image/jpeg' }) }]]);
    eq(fichierPhoto({ ...recipe, photo_sha256: livre }, historique, files), distante, 'Visuel : photo personnelle distante non remplacée silencieusement par le livre');
  });
  await run('référence sans version', () => withRepo(async repo => {
    const r = { ...recipe, current_version_id: null, availability: 'reference_only' };
    await repo.save('recipes', r, { conditions: { recipes: [{ key: r.id, absente: true }] } });
    const { getData } = await import('../src/ui/state.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const root = await renderRecipe({ id: r.id }, {}, await getData(true), { repo });
    try {
      eq(root.querySelector('h1')?.textContent, 'Trinity bread', 'Visuel : fiche porte le titre original');
      ok(!!root.querySelector('[data-role=gerer-photo]'), 'Visuel : référence sans version donne accès au gestionnaire photo');
      ok(!!root.querySelector('[data-role=modifier-reperes]'), 'Visuel : référence permet description et saisie manuelle');
      eq((await repo.all('recipe_versions')).length, 0, 'Visuel : présentation ne fabrique pas de version culinaire');
    } finally { root.dispose?.(); root.remove(); }
  }));
  await run('cuisine étape prioritaire', () => withRepo(async repo => {
    await repo.saveBatch({ recipes: [{ ...recipe, availability: 'available' }], recipe_versions: [version], cook_sessions: [{ id: 'visuel-cs', recipe_id: recipe.id, selected_version_ids: [version.id], servings: 4, status: 'active', progress: {} }] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
    const { getData } = await import('../src/ui/state.js');
    const { renderCook } = await import('../src/ui/cook.js');
    const root = await renderCook({ id: 'visuel-cs' }, {}, await getData(true), { repo });
    try {
      const step = root.querySelector('[data-role=texte-etape]'), ingredients = root.querySelector('details[data-role=ingredients-cuisine]');
      ok(!!ingredients && !ingredients.open, 'Visuel : ingrédients repliés au début de cuisine');
      ok(!!step && !!ingredients && !!(step.compareDocumentPosition(ingredients) & Node.DOCUMENT_POSITION_FOLLOWING), 'Visuel : étape avant ingrédients dans le DOM');
      ok(!!root.querySelector('[data-role=photo-cuisine]'), 'Visuel : photo accessible sans quitter la cuisine');
      ok(!!root.querySelector('.navigation-cuisine'), 'Visuel : navigation de cuisine distincte du contenu long');
    } finally { root.dispose?.(); root.remove(); }
  }));
  await run('saisie protégée', async () => {
    const { estRouteDeSaisie } = await import('../src/ui/state.js');
    eq(estRouteDeSaisie('/recipes/r/reperes'), true, 'Visuel : édition des repères protégée des rafraîchissements');
    eq(estRouteDeSaisie('/recipes/r/photo'), true, 'Visuel : gestion photo protégée des rafraîchissements');
  });
  await run('badge rapide', async () => {
    const { construireContexteReperes, fabriquerCorrectionsReperes, fusionnerReperes } = await import('../src/domain/reperes.js');
    const { resumeReperes } = await import('../src/ui/reperes-affichage.js');
    const { recipeCard } = await import('../src/ui/components.js');
    const r = { ...recipe, availability: 'available' };
    const v = { ...version, ingredients: [{ source_text: 'Farine', name_text: 'farine' }] };
    const temps = { total: { min: 20, max: 25, origine: 'manuel', complet: true }, actif: null, cuisson: null, attentes: null, attentes_incluses: true, explication: '' };
    r.reperes = fusionnerReperes(null, { corrections: fabriquerCorrectionsReperes({ temps }, construireContexteReperes({ recipe: r, version: v }), '2026-10-28T12:00:00Z') });
    eq(resumeReperes(r, v).querySelector('[data-role=badge-rapide]')?.textContent, 'Rapide', 'Visuel : total complet admissible porte le badge Rapide');
    eq(resumeReperes({ ...r, availability: 'partial' }, v).querySelector('[data-role=badge-rapide]'), null, 'Visuel : recette partielle ne porte jamais le badge Rapide');
    const carte = recipeCard({ recipe: r, version: v });
    eq(carte.querySelector('[data-role=badge-rapide]')?.textContent, 'Rapide', 'Visuel : les résultats de recherche affichent le même badge Rapide');
    ok(!!carte.querySelector('.description-recette'), 'Visuel : la carte horizontale affiche aussi la description ou son état inconnu');
  });
  await run('durée effacée sur tous les emplacements', () => withRepo(async repo => {
    const { construireContexteReperes, fabriquerCorrectionsReperes, fusionnerReperes } = await import('../src/domain/reperes.js');
    const v = { ...version, total_minutes: 60, active_minutes: 20 };
    const r = { ...recipe, availability: 'available' };
    r.reperes = fusionnerReperes(null, { corrections: fabriquerCorrectionsReperes({ temps: null }, construireContexteReperes({ recipe: r, version: v }), '2026-10-28T12:00:00Z') });
    await repo.saveBatch({ recipes: [r], recipe_versions: [v] }, { conditions: { recipes: [{ key: r.id, absente: true }] } });
    const { getData } = await import('../src/ui/state.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { recipeCard } = await import('../src/ui/components.js');
    const root = await renderRecipe({ id: r.id }, {}, await getData(true), { repo });
    const carte = recipeCard({ recipe: r, version: v });
    eq(root.textContent.includes('Temps à estimer'), true, 'Visuel : correction nulle affiche temps inconnu sur la fiche');
    ok(!/60 min|20 min|1 h/.test([...root.querySelectorAll('.fiche-tete, [data-role=section-ingredients] .row.between > .muted')].map(n => n.textContent).join(' ')), 'Visuel : aucun ancien temps ne réapparaît dans les ingrédients ou les gestes');
    ok(!/60 min|20 min|1 h/.test(carte.textContent), 'Visuel : carte horizontale utilise aussi la correction nulle');
    root.dispose?.();
  }));
}
