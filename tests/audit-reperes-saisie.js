import { withRepo } from './sync-fixture.js';
import { recetteReperesTest, versionReperesTest, reponseReperesTest } from './visuel-parcours.js';
import { renderReperesRoute } from '../src/ui/reperes.js';
import { construireContexteReperes, lireReperes, validerReponseReperes } from '../src/domain/reperes.js';
import { getUiLocale, setUiLocale } from '../src/core/i18n.js';

const input = (node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); };
const changer = (node, value) => { node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); };
async function scenario(fn) {
  await withRepo(async (repo, db) => {
    const recipe = recetteReperesTest(), source = versionReperesTest();
    recipe.created_at = '2026-10-30T12:00:00.000Z';
    source.steps[0].text = 'Faire mijoter les tomates.\nSurveiller\tla cuisson pendant 20 minutes.';
    source.provenance = { note_importee: 'Source\u200Bbrute\u0007 à conserver.' };
    await db.mutate({ origin: 'remote', puts: { recipes: [recipe], recipe_versions: [source] } });
    let root, posts = 0, messages = [], navigations = [];
    const fermer = () => { root?.dispose(); root?.remove(); root = null; };
    const monter = async query => {
      root = await renderReperesRoute({ id: recipe.id }, query || {}, {}, {
        repo, enLigne: () => false, sessionAssistant: async () => null,
        fetch: async () => { posts++; throw Error('Aucun appel autorisé'); },
        toast: texte => messages.push(texte), navigate: url => navigations.push(url), remplacerAdresse: () => {},
      });
      document.body.append(root); await root.attendreEcritures(); return root;
    };
    try { await monter(); await fn({ repo, db, recipe, source, root: () => root, monter, fermer, posts: () => posts, messages, navigations }); }
    finally { fermer(); }
  });
}

export async function runAuditReperesSaisieTests({ eq, ok }) {
  const locale = getUiLocale(); setUiLocale('fr');
  try {
    for (const [name, champ, brut, propre] of [
      ['description_fr', 'description_fr', 'Une\u0000 soupe\u200B de\ttomates\nmûres\u007F.', 'Une soupe de tomates mûres.'],
      ['raison', 'difficulte', 'Des\u2066 gestes\u2069 simples\u0007 et\rprécis.', 'Des gestes simples et précis.'],
      ['explication', 'temps', 'Une\uFEFF durée\vmesurée\fpendant\u0085la cuisson\u009F.', 'Une durée mesurée pendant la cuisson.'],
    ]) await scenario(async s => {
      const nom = `10.6 saisie ${name}`;
      if (name === 'raison') changer(s.root().querySelector('[name=niveau]'), 'facile');
      if (name === 'explication') for (const borne of ['min', 'max']) input(s.root().querySelector(`[name=cuisson_${borne}]`), '20');
      await s.root().attendreEcritures();
      input(s.root().querySelector(`[name=${name}]`), brut);
      eq(s.root().querySelector(`[name=${name}]`).value, propre, `${nom} : champ nettoyé au geste`);
      eq(s.root().etatRoute().saisie[name], propre, `${nom} : état mémoire concordant immédiatement`);
      await s.root().attendreEcritures();
      const id = s.root().etatRoute().importId, row = await s.repo.get('imports', id);
      eq(row?.saisie[name], propre, `${nom} : brouillon durable sans Cc/Cf`);
      eq(row?.status, 'a_lancer', `${nom} : saisie ne lance pas l’assistant`);
      eq(await s.repo.get('recipe_versions', s.source.id), s.source, `${nom} : source importée brute intacte`);
      eq(await s.repo.get('recipes', s.recipe.id), s.recipe, `${nom} : fiche intacte avant conservation volontaire`);
      s.fermer(); await s.monter({ import: id });
      eq(s.root().querySelector(`[name=${name}]`).value, propre, `${nom} : réouverture retrouve le brouillon propre`);
      eq(s.root().etatRoute().saisie[name], propre, `${nom} : réouverture garde la même saisie`);
      s.root().querySelector('[data-role=enregistrer-reperes]').click(); await s.root().attendreEcritures();
      const gardee = await s.repo.get('recipes', s.recipe.id), lecture = lireReperes(gardee, s.source);
      eq((await s.repo.get('imports', id)).status, 'enregistre', `${nom} : conservation réellement terminée`);
      const valeur = lecture.champs[champ].valeur;
      eq(name === 'description_fr' ? valeur?.texte : name === 'raison' ? valeur?.raison : valeur?.explication, propre, `${nom} : information manuelle relisible`);
      eq(lecture.champs[champ].origine, 'manuel', `${nom} : origine manuelle conservée`);
      eq(s.messages, ['Informations enregistrées'], `${nom} : succès affiché après écriture`);
      eq(s.navigations.length, 1, `${nom} : retour après vraie conservation`);
      const { reperes, updated_at, ...culinaire } = gardee;
      eq(culinaire, s.recipe, `${nom} : seul ajout des repères à la fiche`);
      eq(await s.repo.get('recipe_versions', s.source.id), s.source, `${nom} : conservation ne nettoie jamais la source`);
      eq((await s.repo.all('recipe_versions')).length, 1, `${nom} : aucune nouvelle version culinaire`);
      eq(s.posts(), 0, `${nom} : aucun POST à la saisie, reprise ou conservation`);
    });
    await scenario(async s => {
      const description = s.root().querySelector('[name=description_fr]');
      for (const [brut, propre, nom] of [
        ['Tomates\tpoivrons', 'Tomates poivrons', 'tabulation'],
        ['Tomates\r\npoivrons', 'Tomates poivrons', 'retour Windows'],
        ['Tomates\u2028poivrons\u2029oignons', 'Tomates poivrons oignons', 'séparateurs Unicode'],
        ['  Crème d’été 🍅\u00a0: déjà prête.  ', '  Crème d’été 🍅\u00a0: déjà prête.  ', 'texte valide et blancs de frappe'],
      ]) {
        input(description, brut); await s.root().attendreEcritures();
        eq(description.value, propre, `10.6 ${nom} : valeur visible conservée sans collage`);
        eq((await s.repo.get('imports', s.root().etatRoute().importId)).saisie.description_fr, propre, `10.6 ${nom} : même valeur durable`);
      }
      const min = s.root().querySelector('[name=cuisson_min]'), max = s.root().querySelector('[name=cuisson_max]');
      input(min, '1\u200B2'); input(max, '12'); await s.root().attendreEcritures();
      eq(min.value, '12', '10.6 durée : caractère de format retiré dans le champ');
      eq((await s.repo.get('imports', s.root().etatRoute().importId)).saisie.cuisson_min, '12', '10.6 durée : nettoyage durable');
      input(min, '1\t2'); await s.root().attendreEcritures();
      eq(min.value, '1 2', '10.6 durée : séparateur conservé comme blanc, jamais transformé en 12');
      eq(s.root().etatRoute().saisie.cuisson_min, '1 2', '10.6 durée : mémoire ne colle pas les chiffres');
      s.root().querySelector('[data-role=enregistrer-reperes]').click(); await s.root().attendreEcritures();
      eq((await s.repo.get('imports', s.root().etatRoute().importId)).status, 'a_lancer', '10.6 durée : saisie ambiguë refusée avant conservation');
      eq((await s.repo.get('recipes', s.recipe.id)).reperes ?? null, null, '10.6 durée : aucune valeur inventée dans la fiche');
      eq(s.navigations.length, 0, '10.6 durée : aucun faux succès');
      eq(s.posts(), 0, '10.6 séparateurs : aucun appel assistant');
    });
    const contexte = construireContexteReperes({ recipe: recetteReperesTest(), version: versionReperesTest() });
    for (const invisible of ['\u0000', '\u200B', '\u2066']) {
      const reponse = reponseReperesTest(); reponse.description_fr.texte += invisible;
      let raison = null; try { validerReponseReperes(reponse, contexte); } catch (e) { raison = e.raison; }
      eq(raison, 'texte', '10.6 assistant : Cc/Cf restent refusés au motif exact');
      ok(reponse.description_fr.texte.endsWith(invisible), '10.6 assistant : réponse hostile non nettoyée pour la rendre acceptable');
    }
  } finally { setUiLocale(locale); }
}
