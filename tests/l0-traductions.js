// L0 : données jetables, vrais transactions IndexedDB, aucun assistant ou compte privé.
import { withRepo } from './sync-fixture.js';
import { Database } from '../src/core/db.js';
import { STORES, DB_VERSION } from '../src/model/schema.js';
import { renderRecipeEdit } from '../src/ui/recipe-edit.js';
import { getData } from '../src/ui/state.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const bouton = (node, texte) => [...node.querySelectorAll('button')].find(b => b.textContent === texte);
const saisir = (node, texte) => { node.value = texte; node.dispatchEvent(new Event('input', { bubbles: true })); };
const contexte = async () => ({ ...await getData(true), sync: {} });
const source = () => ({
  recipe: { id: 'l0-recette', original_title: 'Bread', original_language: 'en', availability: 'available', current_version_id: 'l0-version', source_page_ids: [], favorite: false },
  version: { id: 'l0-version', recipe_id: 'l0-recette', kind: 'extraction', servings: 2, ingredients: ['salt', 'sugar', 'butter'].map((s, i) => ({ id: 'i' + i, source_text: s, name_text: s })), steps: [{ id: 's1', position: 1, text: 'Mix.\n\nRest.', timers: [] }, { id: 's2', position: 2, text: 'Bake.', timers: [] }] },
});
async function attendre(fn) { for (let i = 0; i < 100; i++) { if (await fn()) return; await pause(5); } throw Error('L0 : attente dépassée'); }
async function cliquerSauver(node, label) {
  const toast = document.querySelector('.toast'); if (toast) toast.textContent = '';
  bouton(node, label).click();
  await attendre(() => document.querySelector('.toast')?.textContent || node.querySelector('[data-role="erreur-enregistrement"]')?.textContent || node.querySelector('[data-role="etat-traduction"]')?.textContent);
}

export async function runL0TraductionsTests({ eq, ok }) {
  const hash = location.hash;
  const scene = document.createElement('div'); document.body.append(scene);
  const bloc = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, 'L0 ' + nom + ' : ' + (e.stack || e)); } finally { scene.replaceChildren(); } };
  try {
    await bloc('positions', async repo => {
      const { recipe, version } = source();
      await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const avant = [await repo.get('recipes', recipe.id), await repo.get('recipe_versions', version.id)];
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed);
      const ings = ed.querySelectorAll('[data-role="traduction-ingredient"]'), steps = ed.querySelectorAll('[data-role="traduction-etape"]');
      eq([ings.length, steps.length], [3, 2], 'L0 C01 : un champ par ingrédient/étape');
      if (ings.length !== 3 || steps.length !== 2) return;
      saisir(ed.querySelector('[data-role="traduction-titre"]'), 'Pain');
      saisir(ings[0], 'sel'); saisir(ings[2], 'beurre'); saisir(steps[0], 'Mélanger.\n\nLaisser reposer.'); saisir(steps[1], 'Cuire.');
      await cliquerSauver(ed, 'Enregistrer la traduction');
      const [tr] = await repo.all('recipe_translations');
      eq([tr.alignment_format, tr.translated_content], [1, { title: 'Pain', ingredients: ['sel', '', 'beurre'], steps: ['Mélanger.\n\nLaisser reposer.', 'Cuire.'] }], 'L0 C01 : positions vides et paragraphes conservés');
      eq([await repo.get('recipes', recipe.id), await repo.get('recipe_versions', version.id)], avant, 'L0 : garder la traduction ne réécrit ni recette ni original');
      const ed2 = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed2);
      eq([...ed2.querySelectorAll('[data-role="traduction-ingredient"]')].map(n => n.value), ['sel', '', 'beurre'], 'L0 C01 : réédition garde les positions');
      eq(ed2.querySelector('[data-role="traduction-etape"]')?.value, 'Mélanger.\n\nLaisser reposer.', 'L0 C01 : réédition garde les paragraphes');
    });
    await bloc('recette disparue', async (repo, db) => {
      const { recipe, version } = source();
      recipe.source_page_ids = ['l0-page'];
      await repo.saveBatch({ recipes: [recipe], recipe_versions: [version], source_pages: [{ id: 'l0-page', kind: 'index', role: 'index', sha256: 'b'.repeat(64), printed_page: null }], scan_sessions: [{ id: 'l0-seance', status: 'open', page_ids: ['l0-page'], recipe_ids: [] }] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'correction', session: 'l0-seance' }, await contexte()); scene.append(ed);
      saisir(ed.querySelector('input'), 'Mon pain');
      const autre = new Database(db.name, DB_VERSION, STORES);
      try { await autre.open(); await autre.delete('recipes', recipe.id); } finally { autre.idb?.close(); }
      const avant = { versions: await repo.all('recipe_versions'), pages: await repo.all('source_pages'), sessions: await repo.all('scan_sessions'), file: await db.getAll('outbox') };
      await cliquerSauver(ed, 'Enregistrer une nouvelle version');
      eq(await repo.get('recipes', recipe.id), undefined, 'L0 C02 : un autre onglet supprime, l’éditeur ne ressuscite rien');
      eq({ versions: await repo.all('recipe_versions'), pages: await repo.all('source_pages'), sessions: await repo.all('scan_sessions'), file: await db.getAll('outbox') }, avant, 'L0 C02 : refus atomique sans version, page, séance ou outbox');
      eq(ed.querySelector('input').value, 'Mon pain', 'L0 C02 : saisie conservée après refus');
      ok(ed.textContent.includes('Tes modifications restent dans ce formulaire.'), 'L0 C02 : refus visible dans le formulaire');
    });
    await bloc('fusions concurrentes', async repo => {
      const { recipe, version } = source(); await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'correction' }, await contexte()); scene.append(ed);
      const concurrente = { ...await repo.get('recipes', recipe.id), favorite: true, personal_notes: 'note récente', photo_sha256: 'a'.repeat(64), photo_origin: 'photo', reperes: { revision: 1 } };
      await repo.save('recipes', concurrente);
      await cliquerSauver(ed, 'Enregistrer une nouvelle version');
      const relue = await repo.get('recipes', recipe.id);
      eq([relue.favorite, relue.personal_notes, relue.photo_sha256, relue.reperes], [true, 'note récente', 'a'.repeat(64), { revision: 1 }], 'L0 C02 : favori/photo/note/repères concurrents conservés');
    });
    for (const cas of ['recette', 'version', 'contenu', 'titre', 'traduction', 'traduction-supprimee', 'version-etrangere']) {
      await bloc('garde traduction ' + cas, async (repo, db) => {
        const { recipe, version } = source();
        const tr = { id: 'l0-tr', recipe_version_id: version.id, locale: 'fr', alignment_format: 1, translated_content: { title: 'Pain', ingredients: ['sel', '', 'beurre'], steps: ['', 'Cuire.'] }, origin: 'manual', verification_state: 'unverified' };
        await repo.saveBatch({ recipes: [recipe], recipe_versions: [version], recipe_translations: [tr] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
        const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed);
        saisir(ed.querySelector('[data-role="traduction-ingredient"]'), 'Mon sel');
        if (cas === 'recette') await repo.remove('recipes', recipe.id);
        if (cas === 'version') await repo.remove('recipe_versions', version.id);
        if (cas === 'contenu') await repo.save('recipe_versions', { ...version, ingredients: [{ ...version.ingredients[0], source_text: 'pepper' }, ...version.ingredients.slice(1)] });
        if (cas === 'titre') await repo.save('recipes', { ...recipe, original_title: 'Autre titre' });
        if (cas === 'traduction') await repo.save('recipe_translations', { ...tr, translated_content: { ...tr.translated_content, title: 'Autre pain' } });
        if (cas === 'traduction-supprimee') await repo.remove('recipe_translations', tr.id);
        if (cas === 'version-etrangere') await repo.db.put('recipe_versions', { ...version, recipe_id: 'autre-recette' }, { origin: 'device' }); // arrivée concurrente, hors garde des gestes locaux
        const avant = { recipes: await repo.all('recipes'), versions: await repo.all('recipe_versions'), traductions: await repo.all('recipe_translations'), file: await db.getAll('outbox') };
        const hashAvant = location.hash;
        await cliquerSauver(ed, 'Enregistrer la traduction');
        eq({ recipes: await repo.all('recipes'), versions: await repo.all('recipe_versions'), traductions: await repo.all('recipe_translations'), file: await db.getAll('outbox') }, avant, 'L0 traduction : refus atomique, cas ' + cas);
        eq([ed.querySelector('[data-role="traduction-ingredient"]').value, location.hash], ['Mon sel', hashAvant], 'L0 traduction : saisie et écran gardés, cas ' + cas);
        ok(ed.querySelector('[data-role="etat-traduction"]').textContent.length > 0, 'L0 traduction : motif visible, cas ' + cas);
      });
    }
    await bloc('ancienne version encore présente', async repo => {
      const { recipe, version } = source(); await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed);
      await repo.saveBatch({ recipe_versions: [{ ...version, id: 'l0-v2' }], recipes: [{ ...recipe, current_version_id: 'l0-v2' }] });
      saisir(ed.querySelector('[data-role="traduction-ingredient"]'), 'Sel'); await cliquerSauver(ed, 'Enregistrer la traduction');
      eq((await repo.all('recipe_translations')).map(r => [r.recipe_version_id, r.translated_content.ingredients]), [[version.id, ['Sel', '', '']]], 'L0 traduction : une ancienne version exacte reste traduisible');
      eq((await repo.get('recipes', recipe.id)).current_version_id, 'l0-v2', 'L0 traduction : ne rétablit pas le pointeur ancien');
    });
    for (const nombre of [2, 3, 4]) await bloc('ancienne longueur ' + nombre, async repo => {
      const { recipe, version } = source();
      const tr = { id: 'l0-ancienne', recipe_version_id: version.id, locale: 'fr', translated_content: { title: 'Ancien pain', ingredients: ['sel', 'sucre', 'beurre', 'levure'].slice(0, nombre), steps: ['Mélanger.', 'Cuire.'] }, verification_state: 'unverified' };
      await repo.saveBatch({ recipes: [recipe], recipe_versions: [version], recipe_translations: [tr] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const avant = await repo.get('recipe_translations', tr.id);
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed);
      eq([...ed.querySelectorAll('[data-role="traduction-ingredient"]')].map(n => n.value), nombre === 3 ? tr.translated_content.ingredients : ['', '', ''], 'L0 ancienne : pas de réattribution devinée, longueur ' + nombre);
      ok(ed.textContent.includes('correspondances ne sont pas garanties'), 'L0 ancienne : relecture annoncée');
      const panneau = ed.querySelector('[data-role="ancienne-traduction"]'); panneau.open = true;
      await attendre(() => panneau.querySelector('textarea'));
      eq([...panneau.querySelectorAll('textarea')].map(n => n.value), [tr.translated_content.title, tr.translated_content.ingredients.join('\n\n'), tr.translated_content.steps.join('\n\n')], 'L0 ancienne : totalité des textes consultables sans JSON technique');
      eq(await repo.get('recipe_translations', tr.id), avant, 'L0 ancienne : consulter ne réécrit rien');
      if (nombre === 3) {
        await cliquerSauver(ed, 'Enregistrer la traduction');
        const garde = await repo.get('recipe_translations', tr.id);
        eq([garde.alignment_format, garde.verification_state, garde.translated_content], [1, 'unverified', tr.translated_content], 'L0 ancienne : revue explicite conserve les textes sans vérification inventée');
      }
    });
    await bloc('source parent disparue', async (repo, db) => {
      const { recipe, version } = source(); await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const ed = await renderRecipeEdit({ id: recipe.id }, {}, await contexte()); scene.append(ed);
      await repo.remove('recipe_versions', version.id);
      const avant = [await repo.all('recipe_versions'), await repo.get('recipes', recipe.id), await db.getAll('outbox')];
      await cliquerSauver(ed, 'Enregistrer une nouvelle version');
      eq([await repo.all('recipe_versions'), await repo.get('recipes', recipe.id), await db.getAll('outbox')], avant, 'L0 C02 : pas de version avec une parente disparue');
    });
    const D = await import('../src/domain/traductions.js');
    const { version } = source();
    const content = { title: 'Pain', ingredients: ['Sel', '', 'Beurre'], steps: ['Mélanger.\n\nReposer.', ''] };
    const row = { recipe_version_id: version.id, alignment_format: 1, translated_content: content };
    eq(D.lireTraduction(row, version), { etat: 'courante', raison: null, contenu: content }, 'L0 lecteur : positions vides valides');
    eq(D.lireTraduction({ ...row, alignment_format: 2 }, version).etat, 'invalide', 'L0 lecteur : format futur non présumé');
    eq(D.lireTraduction({ ...row, recipe_version_id: 'autre' }, version).etat, 'invalide', 'L0 lecteur : version exacte obligatoire');
    eq(D.lireTraduction({ recipe_version_id: version.id, translated_content: content }, version).etat, 'ancienne', 'L0 lecteur : ancien format ne fournit pas de correspondances fiables');
    eq(D.lireTraduction(null, version).etat, 'absente', 'L0 lecteur : absence explicite');
    eq(D.lireTraduction({ ...row, recipe_version_id: null }, { ...version, id: null }).etat, 'invalide', 'L0 lecteur : deux identifiants absents ne constituent pas une version exacte');
    for (const patch of [{ ingredients: ['Sel', 'Beurre'] }, { steps: ['a', 'b', 'c'] }, { title: 12 }, { ingredients: ['Sel', null, 'Beurre'] }, { steps: ['a', {}] }, { title: 'a'.repeat(1001) }, { ingredients: ['a'.repeat(2001), '', ''] }, { steps: ['a'.repeat(10001), ''] }]) {
      const mauvais = { ...content, ...patch };
      eq(D.lireTraduction({ ...row, translated_content: mauvais }, version).etat, 'invalide', 'L0 lecteur : données malformées/hors bornes refusées');
    }
    eq(D.validerContenuTraduction({ ...content, title: '🥖'.repeat(1000) }, version).ok, true, 'L0 limites : points de code Unicode et non unités UTF-16');
    eq(D.validerContenuTraduction({ ...content, title: '🥖'.repeat(1001) }, version).ok, false, 'L0 limites : borne Unicode exacte');
    eq(D.verifierSourceTraduction({ ...version, ingredients: Array.from({ length: 201 }, () => ({ source_text: '' })) }).ok, false, 'L0 limites : nombre de segments borné');
    eq(D.verifierSourceTraduction({ ...version, ingredients: [], steps: Array.from({ length: 21 }, () => ({ text: 'a'.repeat(10000) })) }).ok, false, 'L0 limites : budget total borné');
    const sourceLongue = { ...version, ingredients: [], steps: Array.from({ length: 13 }, (_, i) => ({ id: 'sl' + i, text: 'Step ' + i })) };
    const emoji = { title: '', ingredients: [], steps: Array(13).fill('🥖'.repeat(10000)) };
    const emojiAvant = structuredClone(emoji);
    eq(D.validerContenuTraduction(emoji, sourceLongue).ok, false, 'L0 limites : 130000 points de code mais plus de 500000 octets refusés avant synchronisation');
    eq(emoji, emojiAvant, 'L0 limites : refus en octets sans troncature des textes');
    eq(D.validerContenuTraduction({ ...emoji, steps: Array(13).fill('a'.repeat(10000)) }, sourceLongue).ok, true, 'L0 limites : même longueur en ASCII reste dans les bornes');
    const reordonnee = { ...version, ingredients: version.ingredients.map(i => Object.fromEntries(Object.entries(i).reverse())) };
    eq(D.projectionSourceTraduction(reordonnee), D.projectionSourceTraduction(version), 'L0 garde : ordre des propriétés sans effet');
    ok(D.projectionSourceTraduction({ ...version, ingredients: [...version.ingredients].reverse() }) !== D.projectionSourceTraduction(version), 'L0 garde : ordre culinaire protégé');
    await bloc('borne UI', async repo => {
      const { recipe, version } = source(); version.steps[0].text = 'a'.repeat(10001);
      await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const avant = await repo.get('recipe_versions', version.id);
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed);
      eq(ed.querySelectorAll('[data-role="traduction-etape"]').length, 0, 'L0 limites : vérification avant création des champs');
      ok(!bouton(ed, 'Enregistrer la traduction'), 'L0 limites : pas de sauvegarde qui tronque la source');
      eq(await repo.get('recipe_versions', version.id), avant, 'L0 limites : source hors borne conservée intégralement');
    });
    await bloc('source malformée', async repo => {
      const { recipe, version } = source(); await repo.saveBatch({ recipes: [recipe], recipe_versions: [version] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const ctx = await contexte(), malformee = { ...version, ingredients: { texte: 'Source ancienne à conserver' }, steps: null };
      ctx.versionsById.set(version.id, malformee); ctx.versionsByRecipe.set(recipe.id, [malformee]);
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr', v: version.id }, ctx); scene.append(ed);
      ok(ed.querySelector('[data-role="etat-traduction"]').textContent.includes('structure est invalide'), 'L0 source reçue : structure invalide expliquée avant les jointures de formulaire');
      eq(ed.querySelectorAll('[data-role="traduction-etape"]').length, 0, 'L0 source reçue : aucun contrôle de saisie depuis une structure invalide');
    });
    for (const cas of ['ancienne', 'modification', 'stockage']) await bloc('limite ou erreur ' + cas, async (repo, db) => {
      const { recipe, version } = source();
      const tr = { id: 'l0-ancienne', recipe_version_id: version.id, locale: 'fr', translated_content: { title: 'Pain', ingredients: ['a'.repeat(2001), '', ''], steps: ['', ''] } };
      await repo.saveBatch({ recipes: [recipe], recipe_versions: [version], ...(cas === 'ancienne' ? { recipe_translations: [tr] } : {}) }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
      const ed = await renderRecipeEdit({ id: recipe.id }, { kind: 'translation', locale: 'fr' }, await contexte()); scene.append(ed);
      const avant = [await repo.all('recipe_translations'), await db.getAll('outbox')];
      if (cas === 'ancienne') {
        eq(ed.querySelectorAll('[data-role="traduction-ingredient"]').length, 0, 'L0 limites : ancien texte trop long n’est pas tronqué ni chargé dans les champs');
        const panneau = ed.querySelector('[data-role="ancienne-traduction"]'); panneau.open = true;
        await attendre(() => panneau.querySelector('textarea'));
        ok([...panneau.querySelectorAll('textarea')].some(n => n.value.includes('a'.repeat(2001))), 'L0 limites : ancien texte hors borne consultable intégralement');
      } else {
        saisir(ed.querySelector('[data-role="traduction-ingredient"]'), cas === 'modification' ? 'a'.repeat(2001) : 'Mon sel');
        const mutate = db.mutate;
        try {
          if (cas === 'stockage') db.mutate = async () => { throw new DOMException('Test quota', 'QuotaExceededError'); };
          await cliquerSauver(ed, 'Enregistrer la traduction');
        } finally { db.mutate = mutate; }
        eq(ed.querySelector('[data-role="traduction-ingredient"]').value, cas === 'modification' ? 'a'.repeat(2001) : 'Mon sel', 'L0 erreur : saisie conservée, cas ' + cas);
        ok(ed.querySelector('[data-role="etat-traduction"]').textContent.length > 0, 'L0 erreur : raison visible, cas ' + cas);
      }
      eq([await repo.all('recipe_translations'), await db.getAll('outbox')], avant, 'L0 limite/erreur : aucune écriture, cas ' + cas);
    });
  } finally { scene.remove(); if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash); }
}
