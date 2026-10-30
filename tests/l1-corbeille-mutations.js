// L1 : vrais formulaires et écritures associées, bases jetables ; aucun appel assistant.
import { withRepo } from './sync-fixture.js';
import { renderRecipeEdit } from '../src/ui/recipe-edit.js';
import { getData, getSyncGeneration } from '../src/ui/state.js';
import { creerServiceBrouillons } from '../src/domain/brouillons-editeur.js';
import { enregistrerPhotoPage } from '../src/domain/photo-page.js';
import { recetteReperesTest, versionReperesTest } from './visuel-parcours.js';
import * as reperes from '../src/domain/reperes-parcours.js';
import * as thermomix from '../src/domain/thermomix-parcours.js';
import { enregistrerLecture } from '../src/ui/import-web.js';
import { fabriquerImportWeb } from '../src/domain/lecture-web.js';
import { revoirLectureImport } from '../src/domain/contexte-import.js';
import { rapatrierPhotoWeb } from '../src/ui/photo-plat.js';
import { renderCreerIA, reinitialiserCreation, etatCreation } from '../src/ui/creer-ia.js';

const attendre = async f => { for (let i = 0; i < 200; i++) { if (await f()) return; await new Promise(r => setTimeout(r, 5)); } throw Error('L1 : attente de sauvegarde'); };
const donnees = () => ({
  recipes: [{ id: 'l1-m-recette', original_title: 'Bread', original_language: 'en', availability: 'available', current_version_id: 'l1-m-version', source_page_ids: ['l1-m-page'] }],
  recipe_versions: [{ id: 'l1-m-version', recipe_id: 'l1-m-recette', kind: 'extraction', ingredients: [{ id: 'i1', source_text: 'salt', name_text: 'salt' }], steps: [{ id: 's1', position: 1, text: 'Mix.', timers: [] }] }],
  source_pages: [{ id: 'l1-m-page', sha256: 'a'.repeat(64), role: 'recipe', rotation: 0 }],
});
const lire = async (repo, db) => ({ recettes: await repo.all('recipes'), versions: await repo.all('recipe_versions'), traductions: await repo.all('recipe_translations'), fichiers: await repo.all('files'), file: await db.getAll('outbox') });

export async function runL1CorbeilleMutationsTests({ eq, ok }) {
  const scene = document.createElement('div'); document.body.append(scene); const hash = location.hash;
  const bloc = async (nom, fn) => { try { await withRepo(fn); } catch (e) { ok(false, 'L1 mutation ' + nom + ': ' + (e.stack || e)); } finally { for(const vue of scene.children)vue.dispose?.();scene.replaceChildren(); } };
  try {
    await bloc('ancienne adaptation avant appel', async (repo, db) => {
      reinitialiserCreation();
      const batch = donnees(); batch.recipe_versions[0] = { ...batch.recipe_versions[0], kind: 'synthesis', status: 'proposed', servings: 2, provenance: { generated_by: 'ai', creation: { demande: 'Pain' } } };
      await db.mutate({ puts: batch, origin: 'remote' });
      const ctx = { ...await getData(true), sync: { user: { id: 'test' }, auth: { jeton: async () => ({ access_token: 'fixture-l1', user: { id: 'test' } }) } } };
      let appels = 0;
      const vue = await renderCreerIA({}, { adapter: batch.recipe_versions[0].id, changement: 'Mélanger autrement' }, ctx, { repo, creer: async () => { appels++; return {}; }, navigate: () => {}, remplacerAdresse: () => {}, enLigne: () => true }); scene.append(vue);
      await db.mutate({ puts: { recipes: [{ ...batch.recipes[0], lifecycle_id: 'retour-creation', trashed_at: null }] }, origin: 'remote' });
      vue.querySelector('[data-role=creer-ia]').click();
      await attendre(() => !etatCreation().enCours);
      eq(appels, 0, 'L1 : adaptation ouverte avant retrait/restauration refusée avant appel');
      eq((await repo.all('recipe_versions')).length, 1, 'L1 : aucune version ajoutée par le refus avant appel');
      reinitialiserCreation();
    });
    await bloc('photo web refusée avant appel', async (repo, db) => {
      const recipe = { ...donnees().recipes[0], photo_source_url: 'https://images.example/pain.jpg' };
      await db.mutate({ puts: { recipes: [recipe] }, origin: 'remote' });
      const contexte = await repo.capturerContexteRecette(recipe);
      await db.mutate({ puts: { recipes: [{ ...recipe, lifecycle_id: 'retour-photo', trashed_at: null }] }, origin: 'remote' });
      let appels = 0;
      const ctx = { sync: { user: { id: 'test' }, auth: { jeton: async () => ({ access_token: 'fixture-l1', user: { id: 'test' } }) } } };
      await rapatrierPhotoWeb(recipe.id, { repo, contexte, ctx, enLigne: () => true, fetch: async () => { appels++; throw Error('Aucun appel attendu'); } });
      eq(appels, 0, 'L1 : ancien geste de photo web refusé avant appel payant');
    });
    await bloc('lecture web après restauration', async (repo, db) => {
      const recipe = { ...donnees().recipes[0], source_url: 'https://exemple.test/pain' };
      const row = { ...fabriquerImportWeb({ id: 'imp-cycle-web', signet: recipe, deviceId: repo.deviceId() }), status: 'a_verifier',
        resultat: { source_kind: 'jsonld', page: { url_finale: recipe.source_url }, recette: { title: 'Pain', ingredients: [{ source_text: 'Sel' }], steps: [{ text: 'Mélanger.' }] } } };
      await db.mutate({ puts: { recipes: [{ ...recipe, lifecycle_id: 'restaure-web', trashed_at: null }], imports: [row] }, origin: 'remote' });
      const avant = await lire(repo, db);
      eq((await enregistrerLecture(row.id, { repo, remplacer: false })).issue, 'refuse', 'L1 web : Ajouter sans remplacer refuse un résultat d’avant retrait');
      eq(await lire(repo, db), avant, 'L1 web : refus sans version seule ni envoi');
      const contexte = await repo.capturerContexteRecette(await repo.get('recipes', recipe.id));
      await revoirLectureImport(row.id, { repo, contexte });
      eq((await repo.get('imports', row.id)).resultat, row.resultat, 'L1 relecture explicite : résultat payé conservé');
      eq((await enregistrerLecture(row.id, { repo, remplacer: false })).issue, 'enregistre', 'L1 web : conservation après nouvelle relecture explicite');
      eq((await repo.get('recipes', recipe.id)).lifecycle_id, 'restaure-web', 'L1 web : cycle restauré inchangé par la version ajoutée');
    });
    for (const parcours of ['repères', 'Thermomix']) await bloc(parcours + ' cycle du brouillon', async (repo, db) => {
      const recipe = recetteReperesTest(), version = versionReperesTest();
      await db.mutate({ puts: { recipes: [recipe], recipe_versions: [version] }, origin: 'remote' });
      const ouvrir = parcours === 'repères' ? reperes.ouvrirReperes : thermomix.ouvrirThermomix;
      const modifier = parcours === 'repères' ? reperes.modifierBrouillonReperes : thermomix.modifierThermomix;
      const row = await ouvrir({ recipeId: recipe.id, versionId: version.id }, { repo });
      await db.mutate({ puts: { recipes: [{ ...recipe, lifecycle_id: 'apres-restauration', trashed_at: null }] }, origin: 'remote' });
      const avant = await repo.get('imports', row.id);
      let refuse = false;
      try { await modifier(row.id, parcours === 'repères' ? { saisie: { description_fr: 'Ancienne saisie' } } : { demande: 'Ancienne demande' }, { repo }); } catch { refuse = true; }
      ok(refuse, `L1 ${parcours} : ancien brouillon refusé même après restauration`);
      eq(await repo.get('imports', row.id), avant, `L1 ${parcours} : saisie durable inchangée après refus`);
    });
    for (const kind of ['correction', 'translation']) for (const retour of [false, true]) {
      await bloc(kind + (retour ? ' après restauration' : ' retirée'), async (repo, db) => {
        const batch = donnees(); await db.mutate({ puts: batch, origin: 'remote' });
        const recipe = batch.recipes[0];
        const ed = await renderRecipeEdit({ id: recipe.id }, { kind, locale: 'fr' }, { ...await getData(true), sync: {} }); scene.append(ed);
        const champ = kind === 'translation' ? ed.querySelector('[data-role=traduction-ingredient]') : ed.querySelector('[data-role=editeur-etape-texte]');
        champ.value = 'Mon texte à conserver'; champ.dispatchEvent(new Event('input', { bubbles: true }));
        await db.mutate({ puts: { recipes: [{ ...recipe, lifecycle_id: retour ? 'cycle-restauration' : 'cycle-retrait', trashed_at: retour ? null : '2026-10-29T12:00:00.000Z' }] }, origin: 'remote' });
        const avant = await lire(repo, db), adresse = location.hash;
        const bouton = kind === 'translation' ? [...ed.querySelectorAll('button')].find(b => b.textContent === 'Enregistrer la traduction') : ed.querySelector('[data-role=enregistrer-editeur]');
        const toast = document.querySelector('.toast'); if (toast) toast.textContent = '';
        bouton.click(); await attendre(() => ed.querySelector('[data-role=erreur-enregistrement], [data-role=etat-traduction]')?.textContent || document.querySelector('.toast')?.textContent);
        eq(await lire(repo, db), avant, `L1 ${kind} : aucun objet ni envoi après ${retour ? 'changement de cycle' : 'corbeille'}`);
        eq(champ.value, 'Mon texte à conserver', `L1 ${kind} : texte gardé après refus`);
        eq(location.hash, adresse, `L1 ${kind} : aucune navigation après refus`);
        ok(!!ed.querySelector('[data-role=erreur-enregistrement], [data-role=etat-traduction]')?.textContent, `L1 ${kind} : motif visible`);
        if(kind==='correction'){
          const service=creerServiceBrouillons({repo,getGeneration:getSyncGeneration}),{portee}=await service.capturerPortee({owner_id:null}),e=ed.etatEditeur();
          eq((await service.preparerPublication({id:e.id,portee,expectedRevision:e.revision})).raison,'cycle_change',`L1 correction : refus dû exactement au cycle ${retour?'restauré':'retiré'}`);
        }
      });
    }
    await bloc('photo de page atomique', async (repo, db) => {
      const batch = donnees(); await db.mutate({ puts: batch, origin: 'remote' });
      const recipe = batch.recipes[0];
      await db.mutate({ puts: { recipes: [{ ...recipe, lifecycle_id: 'cycle-retrait', trashed_at: '2026-10-29T12:00:00.000Z' }] }, origin: 'remote' });
      const avant = await lire(repo, db); let refuse = false;
      try { await enregistrerPhotoPage({ repo, recipe, blob: new Blob(['image témoin'], { type: 'image/jpeg' }), source: { page_id: 'l1-m-page', sha256: 'a'.repeat(64), rotation: 0, largeur: 100, hauteur: 100, rectangle: { x: 0, y: 0, largeur: 1, hauteur: 1 } } }); } catch { refuse = true; }
      ok(refuse, 'L1 : une photo tardive de recette retirée est refusée');
      eq(await lire(repo, db), avant, 'L1 : refus photo sans octet ni lien ni capture orphelins');
    });
  } finally { scene.remove(); history.replaceState(null, '', hash || '#'); }
}
