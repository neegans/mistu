import {withRepo} from './sync-fixture.js';
import {fixtureLectureL6} from './l6-lecture-ecrans.js';
import {traductionLectureL6} from './l6-lecture-recette.js';
import {getData} from '../src/ui/state.js';
import {renderRecipe} from '../src/ui/recipe.js';
import {getUiLocale,setUiLocale} from '../src/core/i18n.js';
import {construireContexteReperes,fabriquerCorrectionsReperes,fusionnerReperes} from '../src/domain/reperes.js';

const magasins = ['recipes','recipe_versions','recipe_translations','timer_launches','outbox'];

export async function runFicheLisibleTests({eq,ok}) {
  const langue = getUiLocale();
  setUiLocale('fr');
  async function cas(nom, preparer, verifier) {
    await withRepo(async (repo, db) => {
      const f = fixtureLectureL6();
      await preparer(f);
      await db.mutate({origin:'remote',puts:{recipes:[f.recipe],recipe_versions:[f.version],recipe_translations:f.traductions || []}});
      const avant = await db.getSnapshot(magasins);
      const ctx = {...await getData(true),sync:{}};
      ctx.settings = {...ctx.settings,ui_locale:'fr',reading_locale:'fr',units:'original'};
      let root;
      try {
        root = await renderRecipe({id:f.recipe.id},{lang:'fr'},ctx,{repo,historique:{remplacer:()=>{}}});
        document.body.append(root);
        await verifier({root,f,db,avant});
      } finally { root?.dispose?.(); root?.remove(); }
    }).catch(e => ok(false, 'Fiche lisible '+nom+' : '+(e.stack || e)));
  }
  try {
    await cas('informations absentes', async () => {}, async ({root,db,avant}) => {
      const completer = root.querySelector('details[data-role=completer-reperes]');
      ok(!!completer && !completer.open && !!completer.querySelector('[data-role=modifier-reperes]'), 'Fiche lisible : informations manquantes et accès conservés dans un volet fermé');
      eq(root.querySelectorAll('.reperes-badges .neutre').length, 0, 'Fiche lisible : aucun badge de niveau ou temps vide');
      eq(root.querySelector('.details-reperes'), null, 'Fiche lisible : aucun détail de niveau ou temps entièrement vide');
      const notes = root.querySelector('details[data-role=notes-fiche]');
      ok(!!notes && !notes.open && !!notes.querySelector('[data-role=notes-personnelles] button'), 'Fiche lisible : notes vides repliées avec ajout accessible');
      const ingredients = root.querySelector('[data-role=section-ingredients]');
      const bouton = ingredients?.querySelector('button[data-role=details-ingredients]');
      eq(bouton?.getAttribute('aria-expanded'), 'false', 'Fiche lisible : bouton des détails ingrédients initialement fermé');
      const sources = [...ingredients.querySelectorAll('details.lecture-original')];
      const remplacer = [...ingredients.querySelectorAll('.remplacer')];
      ok(sources.length > 0 && remplacer.length === 2 && [...sources,...remplacer].every(n => n.hidden), 'Fiche lisible : provenance et remplacement conservés mais masqués au départ');
      eq(root.querySelectorAll('[data-role=traduction-manquante]').length, 0, 'Fiche lisible : aucune répétition locale du manque sans traduction affichée');
      ok(/texte original.{0,12}affiché/i.test(root.querySelector('[data-role=etat-lecture]')?.textContent || ''), 'Fiche lisible : absence de traduction annonce explicitement le texte original');
      eq(root.querySelector('[data-role=version-francaise]')?.textContent, 'Créer la version française', 'Fiche lisible : création française reste accessible quand elle manque');
      const minuteur = root.querySelector('[data-role=timer-block]');
      const voletMinuteur = minuteur?.matches('details') ? minuteur : minuteur?.closest('details');
      ok(!!voletMinuteur && !voletMinuteur.open && voletMinuteur.querySelector('summary')?.textContent === 'Minuterie — 10 min', 'Fiche lisible : durée réelle visible et commandes de minuterie repliées');
      const coche = ingredients.querySelector('input[type=checkbox]');
      coche.checked = true;
      coche.dispatchEvent(new Event('change',{bubbles:true}));
      bouton?.click();
      eq(bouton?.getAttribute('aria-expanded'), 'true', 'Fiche lisible : ouverture explicite annoncée par le bouton');
      ok(sources.length > 0 && [...sources,...remplacer].every(n => !n.hidden), 'Fiche lisible : ouverture rend les sources et remplacements accessibles');
      ok(ingredients.querySelector('input[type=checkbox]') === coche && coche.checked, 'Fiche lisible : ouverture garde le même champ et sa coche sans redessiner');
      bouton?.click();
      ok(bouton?.getAttribute('aria-expanded') === 'false' && [...sources,...remplacer].every(n => n.hidden) && coche.checked, 'Fiche lisible : fermeture remet les détails à l’écart et conserve la coche');
      eq(await db.getSnapshot(magasins), avant, 'Fiche lisible : lecture et deux bascules ne changent ni source, version, traduction, minuterie ni envoi');
    });
    await cas('informations et note connues', async f => {
      f.recipe.personal_notes = 'La dernière fois, surveiller la croûte.';
      const contexte = construireContexteReperes(f);
      const corrections = fabriquerCorrectionsReperes({description_fr:{texte:'Un pain à préparer puis laisser reposer.'},temps:{total:{min:20,max:25,origine:'manuel',complet:true},actif:null,cuisson:null,attentes:null,attentes_incluses:true,explication:''}},contexte,'2026-10-31T12:00:00.000Z');
      f.recipe.reperes = fusionnerReperes(null,{corrections});
    }, async ({root,f,db,avant}) => {
      ok(root.querySelector('.description-recette')?.textContent === 'Un pain à préparer puis laisser reposer.' && /20.*25/.test(root.querySelector('.reperes-badges')?.textContent || ''), 'Fiche lisible : description et durée connues restent affichées');
      eq(root.querySelector('details[data-role=completer-reperes]'), null, 'Fiche lisible : description connue ne crée pas un volet de manque');
      const note = root.querySelector('[data-role=notes-personnelles]'), ingredients = root.querySelector('[data-role=section-ingredients]');
      ok(note?.textContent.includes(f.recipe.personal_notes) && !note.closest('details:not([open])') && !!(note.compareDocumentPosition(ingredients) & Node.DOCUMENT_POSITION_FOLLOWING), 'Fiche lisible : note renseignée visible avant les ingrédients');
      eq(await db.getSnapshot(magasins), avant, 'Fiche lisible : repères et note connus restent intacts en lecture');
    });
    await cas('traduction partielle', async f => {
      f.traductions = [await traductionLectureL6(f, row => {
        const s = row.translated_content.segments.find(s => s.kind === 'ingredient' && s.source_id === 'l6-water' && s.field === 'name');
        s.text = null; s.origin = null;
      })];
    }, async ({root}) => {
      const eau = root.querySelector('[data-ingredient-id=l6-water]');
      ok(!!eau?.querySelector('[data-role=traduction-manquante]'), 'Fiche lisible : traduction partielle garde l’avis sur son ingrédient manquant');
      eq(root.querySelector('[data-ingredient-id=l6-flour] [data-role=traduction-manquante]'), null, 'Fiche lisible : ingrédient traduit sans faux avertissement local');
      eq(root.querySelector('[data-role=version-francaise]')?.textContent, 'Compléter la version française', 'Fiche lisible : traduction partielle garde son action de complément');
      ok([...eau.querySelectorAll('[lang=en]')].some(n => n.textContent.includes('water')), 'Fiche lisible : passage manquant garde sa langue originale');
    });
    await cas('traduction complète', async f => { f.traductions = [await traductionLectureL6(f)]; }, async ({root,f,db,avant}) => {
      eq(root.querySelector('[data-role=texte-etape]')?.textContent, f.traductions[0].translated_content.segments.find(s => s.kind === 'step').text, 'Fiche lisible : version française complète réellement affichée');
      eq(root.querySelector('[data-role=version-francaise]'), null, 'Fiche lisible : aucun bouton redondant pour lire le français déjà affiché');
      eq(await db.getSnapshot(magasins), avant, 'Fiche lisible : traduction complète consultée sans écriture');
    });
  } finally { setUiLocale(langue); }
}
