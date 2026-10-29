import { withRepo } from './sync-fixture.js';
import { withDatabase } from './backup.js';
import { getData } from '../src/ui/state.js';
import { renderRecipe } from '../src/ui/recipe.js';
import { setUiLocale, getUiLocale } from '../src/core/i18n.js';
import { createArchive, inspectArchive, applyArchive, verifyRestored } from '../src/domain/backup.js';
import { createMoteur } from '../src/sync/moteur.js';
import { creerTransportFactice } from './transport-factice.js';

export const recetteL0 = () => ({ id: 'l0-integration-r', original_title: 'Bread', original_language: 'en', current_version_id: 'l0-integration-v', availability: 'available', source_page_ids: [] });
export const versionL0 = () => ({ id: 'l0-integration-v', recipe_id: 'l0-integration-r', kind: 'extraction', servings: 2,
  ingredients: ['salt', 'sugar', 'butter'].map((name, i) => ({ id: `l0-i${i}`, source_text: name, name_text: name })),
  steps: [{ id: 'l0-s1', position: 1, text: 'Mix.\n\nLeave to rest.', timers: [] }, { id: 'l0-s2', position: 2, text: 'Bake.', timers: [] }] });
export const traductionL0 = () => ({ id: 'l0-integration-tr', recipe_version_id: 'l0-integration-v', locale: 'fr', origin: 'manual', verification_state: 'unverified', alignment_format: 1,
  translated_content: { title: 'Pain', ingredients: ['sel', '', 'beurre'], steps: ['Mélanger.\n\nLaisser reposer.', ''] } });

export async function runL0IntegrationTests({ eq, ok }) {
  const locale = getUiLocale(); setUiLocale('fr');
  const run = async (name, test) => { try { await test(); } catch (e) { ok(false, `L0 intégration ${name} : ${e.stack || e}`); } };
  try {
    await run('lecture positionnelle', () => withRepo(async repo => {
      const r = recetteL0(), v = versionL0(), tr = traductionL0();
      await repo.saveBatch({ recipes: [r], recipe_versions: [v], recipe_translations: [tr] });
      const before = await repo.get('recipe_translations', tr.id);
      const root = await renderRecipe({ id: r.id }, { lang: 'fr' }, await getData(true));
      document.body.append(root);
      try {
        const lines = [...root.querySelectorAll('[data-role=section-ingredients] ul.coches > li')];
        eq(lines.length, 3, 'L0 fiche : trois ingrédients conservés');
        ok(lines[0].textContent.includes('sel') && !lines[1].textContent.includes('beurre') && lines[2].textContent.includes('beurre'), 'L0 fiche : seules les bonnes positions reçoivent sel et beurre');
        ok(lines[1].textContent.includes('sugar') && lines[1].textContent.includes('Traduction à compléter'), 'L0 fiche : manque au deuxième ingrédient explicite avec sa source');
        const steps = [...root.querySelectorAll('[data-role=section-preparation] ol.steps > li')];
        eq(steps.length, 2, 'L0 fiche : deux étapes malgré les paragraphes internes');
        const paragraph = [...steps[0].querySelectorAll('div')].find(n => n.textContent === tr.translated_content.steps[0]);
        ok(paragraph && ['pre-line', 'pre-wrap', 'break-spaces'].includes(getComputedStyle(paragraph).whiteSpace), 'L0 fiche : paragraphes traduits conservés visuellement');
        ok(steps[1].textContent.includes('Bake.') && steps[1].textContent.includes('Traduction à compléter'), 'L0 fiche : étape non traduite annoncée à sa position');
        eq(await repo.get('recipe_translations', tr.id), before, 'L0 fiche : lire ne migre ni ne réécrit la traduction');
      } finally { root.dispose?.(); root.remove(); }
    }));
    for (const type of ['ancienne', 'invalide', 'inconnue']) await run(type, () => withRepo(async repo => {
      const r = recetteL0(), v = versionL0(), tr = traductionL0();
      tr.translated_content.ingredients = ['sel', 'beurre'];
      if (type === 'ancienne') delete tr.alignment_format;
      if (type === 'inconnue') tr.alignment_format = 9;
      await repo.saveBatch({ recipes: [r], recipe_versions: [v], recipe_translations: [tr] });
      const before = await repo.get('recipe_translations', tr.id);
      const root = await renderRecipe({ id: r.id }, { lang: 'fr' }, await getData(true));
      document.body.append(root);
      try {
        const lines = [...root.querySelectorAll('[data-role=section-ingredients] ul.coches > li')];
        ok(!lines[1].textContent.includes('beurre'), `L0 ${type} : aucune association présumée à sugar`);
        const panel = root.querySelector('[data-role=ancienne-traduction]');
        ok(panel && panel.textContent.includes('beurre') && panel.textContent.includes('Laisser reposer.'), `L0 ${type} : anciens textes conservés dans un panneau distinct`);
        ok([...root.querySelectorAll('a')].some(a => a.textContent === 'Vérifier l’ancienne traduction' && a.getAttribute('href').includes('locale=fr')), `L0 ${type} : accès à une réattribution FR`);
        eq(await repo.get('recipe_translations', tr.id), before, `L0 ${type} : aucune réparation écrite à l'affichage`);
      } finally { root.dispose?.(); root.remove(); }
    }));
    await run('durée choisie depuis la fiche', () => withRepo(async repo => {
      const r = recetteL0(), v = versionL0();
      v.steps[0].timers = [{ label: '30–90 seconds', seconds: 30, seconds_max: 90 }];
      await repo.saveBatch({ recipes: [r], recipe_versions: [v] });
      const ctx = await getData(true); ctx.settings = { ...ctx.settings, ui_locale: 'en' };
      setUiLocale('en');
      const root = await renderRecipe({ id: r.id }, {}, ctx); document.body.append(root);
      try {
        const timer = root.querySelector('[data-role=timer-block]'), choix = timer?.querySelector('select'), bouton = timer?.querySelector('button');
        ok(choix && bouton.disabled, 'L0 fiche : plage transmise au composant et durée obligatoire avant demande');
        if (!choix || !bouton) return;
        choix.value = '90'; choix.dispatchEvent(new Event('change', { bubbles: true }));
        ok(timer.textContent.includes('Hey Siri, set a timer for 1 minute and 30 seconds'), 'L0 fiche anglaise : phrase Siri dans la langue de l’interface et durée exacte');
        bouton.click();
        let launches = [];
        for (let i=0; i<100; i++) { launches = await repo.all('timer_launches'); if (launches.length && !bouton.disabled) break; await new Promise(r => setTimeout(r,5)); }
        eq(launches.map(l => [l.recipe_version_id,l.step_id,l.duration_seconds,l.channel]), [[v.id,v.steps[0].id,90,'siri']], 'L0 fiche : la borne réellement choisie est enregistrée, sans demande réelle à Siri');
        choix.value='30'; choix.dispatchEvent(new Event('change',{bubbles:true}));
        ok(timer.textContent.includes('for 30 seconds'), 'L0 fiche : retour au minimum met à jour la phrase sans arrondi');
      } finally { root.dispose?.(); root.remove(); setUiLocale('fr'); }
    }));
    await run('transport et archive', () => withRepo(async (repo, source) => {
      const r = recetteL0(), v = versionL0(), tr = traductionL0();
      const ancienne = { ...tr, id: 'l0-ancienne', locale: 'en' }; delete ancienne.alignment_format;
      await repo.saveBatch({ recipes: [r], recipe_versions: [v], recipe_translations: [tr, ancienne] });
      const attendue = await repo.get('recipe_translations', tr.id), ancienneAttendue = await repo.get('recipe_translations', ancienne.id);
      const transport = creerTransportFactice({ serveur: true });
      const moteur = createMoteur({ db: source, getUserId: () => 'u1', transport, fenetre: { document: { visibilityState: 'hidden' } } });
      try {
        await moteur.executer('l0-envoi');
        eq(transport.ligne('recipe_translations', tr.id)?.data?.translated_content, attendue.translated_content, 'L0 sync : serveur simulé conserve positions vides et paragraphes');
        await withDatabase(async second => {
          const recepteur = createMoteur({ db: second, getUserId: () => 'u1', transport, fenetre: { document: { visibilityState: 'hidden' } } });
          try {
            await recepteur.executer('l0-reception');
            eq(await second.get('recipe_translations', tr.id), attendue, 'L0 sync : autre base reçoit toute la traduction et son format');
            eq(await second.get('recipe_translations', ancienne.id), ancienneAttendue, 'L0 sync : ancienne traduction préservée sans marqueur inventé');
            const archive = await createArchive(second), inspection = await inspectArchive(await archive.blob.arrayBuffer());
            ok(inspection.ok, 'L0 archive : traduction synchronisée inspectée sans erreur de relations');
            await withDatabase(async restored => {
              await applyArchive(restored, inspection, { mode: 'replace' });
              ok((await verifyRestored(restored, inspection, { mode: 'replace' })).ok, 'L0 archive : restauration vérifiée dans une base vide');
              eq(await restored.get('recipe_translations', tr.id), attendue, 'L0 archive : positions vides, paragraphes, version et marqueur restaurés');
              eq(await restored.get('recipe_translations', ancienne.id), ancienneAttendue, 'L0 archive : format historique toujours conservé');
            });
          } finally { await recepteur.arreter(); }
        });
      } finally { await moteur.arreter(); }
    }));
  } finally { setUiLocale(locale); }
}
