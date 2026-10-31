import * as T from '../src/domain/thermomix.js';
import * as P from '../src/domain/thermomix-parcours.js';
import { sourceThermomix } from './i3-thermomix.js';
import { withRepo } from './sync-fixture.js';

const clone = v => structuredClone(v);
const pointsDe = texte => [...texte].length;
const motif = fn => { try { fn(); return null; } catch (e) { return e.raison || e.code || e.message; } };
const date = '2026-10-30T12:00:00.000Z';
const session = { access_token: 'fixture', user: { id: 'tm7-demande' } };
const config = { url: 'https://assistant.example', anonKey: 'publique-factice' };
const blocDe = (source_step_id, ingredients = ['i1']) => ({ source_step_id, raison: 'Mélange à relire.', actions: [
  { type: 'preparation', operation: 'ajouter', ingredients, contenant: 'bol' },
  { type: 'reglage', mode: 'manuel', secondes: 10, temperature: null, vitesse: 1, sens: 'normal', accessoire: 'couteau', ingredients },
] });
const reponse = resultat => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(resultat) }], stop_reason: 'end_turn', model: 'modele-test' }), { status: 200 });

// Le texte cible est fabriqué par le vrai formateur; aucune signature ni instruction historique n’est recopiée.
export function fixtureDemandeThermomix({ points = 2001, langue = 'fr', premier = true } = {}) {
  const source = sourceThermomix();
  source.ingredients = [{ ...source.ingredients[0], source_text: '100 g de tomate 🍅 ', quantity: { value: 100 } }];
  const bloc = blocDe(premier ? 's1' : 's2');
  const resultat = { type: 'proposition', blocs: premier ? [bloc] : [
    { source_step_id: 's1', raison: 'Vérification à l’arrêt.', actions: [{ type: 'preparation', operation: 'verifier_texture', ingredients: [], contenant: 'bol' }] }, bloc,
  ] };
  const construire = () => T.construireContexteThermomix({ version: source, selection: resultat.blocs.map(b => b.source_step_id), langue });
  let contexte = construire();
  const manque = points - pointsDe(T.formaterBlocThermomix(bloc, contexte, { locale: langue }));
  if (!Number.isSafeInteger(manque) || manque < 0) throw Error('Fixture de longueur trop courte');
  source.ingredients[0].source_text += 'a'.repeat(manque);
  contexte = construire();
  return { source, contexte, resultat, bloc, texte: T.formaterBlocThermomix(bloc, contexte, { locale: langue }) };
}

export async function runAuditThermomixDemandeTests({ eq, ok }) {
  for (const langue of ['fr', 'en']) for (const premier of [true, false]) for (const points of [1999, 2000, 2001]) {
    const f = fixtureDemandeThermomix({ points, langue, premier }), avant = clone(f);
    const nom = `10.5 TM7 longueur ${langue}/${premier ? 'premier' : 'suivant'}/${points}`;
    eq(pointsDe(f.texte), points, `${nom} : texte final mesuré en points de code`);
    const attendu = points > 2000 ? 'etape_trop_longue' : null;
    eq(motif(() => T.validerReponseThermomix(f.resultat, f.contexte)), attendu, `${nom} : validation avant Garder au motif exact`);
    eq(f, avant, `${nom} : réponse et source jamais tronquées ou modifiées`);
    let n = 0; const construire = () => T.fabriquerVersionThermomix({ source: f.source, contexte: f.contexte, resultat: f.resultat, id: 'rv-limite', newId: () => 'st-limite-' + (++n), maintenant: date });
    if (points > 2000) eq(motif(construire), 'etape_trop_longue', `${nom} : constructeur refuse avant signature finale`);
    else {
      let version; const erreur = motif(() => { version = construire(); });
      eq([erreur, version?.steps[premier ? 0 : 1].text], [null, f.texte], `${nom} : texte validé exactement conservé`);
      eq(version ? T.lireThermomix(version)?.ok : null, true, `${nom} : version limite toujours relisible`);
    }
  }
  for (const langue of ['fr', 'en']) for (const points of [2000, 2001]) {
    const f = fixtureDemandeThermomix({ points, langue, premier: false });
    const contexteParent = T.construireContexteThermomix({ version: f.source, selection: ['s1'], langue: 'fr' });
    let n = 0;
    const parent = T.fabriquerVersionThermomix({ source: f.source, contexte: contexteParent, resultat: { type: 'proposition', blocs: [f.resultat.blocs[0]] },
      id: 'rv-parent-longueur', newId: () => 'st-parent-' + (++n), maintenant: date });
    const avant = clone(parent), id = parent.steps[1].id;
    const contexte = T.construireContexteThermomix({ version: parent, selection: [id], langue });
    const bloc = { ...clone(f.bloc), source_step_id: id }, resultat = { type: 'proposition', blocs: [bloc] };
    const texte = T.formaterBlocThermomix(bloc, contexte, { locale: langue });
    const nom = `10.5 TM7 ancien premier bloc ${langue}/${points}`;
    eq(pointsDe(texte), points, `${nom} : pas de second préfixe pour la première étape nouvellement sélectionnée`);
    eq(motif(() => T.validerReponseThermomix(resultat, contexte)), points > 2000 ? 'etape_trop_longue' : null, `${nom} : limite après un bloc hérité au motif exact`);
    eq(parent, avant, `${nom} : parent et preuve historique inchangés`);
    if (points <= 2000) {
      n = 0; let suivante;
      const erreur = motif(() => { suivante = T.fabriquerVersionThermomix({ source: parent, contexte, resultat, id: 'rv-seconde-longueur', newId: () => 'st-seconde-' + (++n), maintenant: date }); });
      eq([erreur, suivante?.steps[1].text], [null, texte], `${nom} : texte sans préfixe supplémentaire effectivement conservé`);
      eq(suivante ? T.lireThermomix(suivante)?.ok : null, true, `${nom} : chaîne avec deux langues toujours relisible`);
    }
  }
  const astral = fixtureDemandeThermomix({ points: 2000 });
  ok(astral.texte.length > pointsDe(astral.texte), '10.5 TM7 : témoin astral distingue unités UTF-16 et points de code');
  const sansPrefixe = fixtureDemandeThermomix({ points: 2000, premier: false });
  ok(pointsDe(T.formaterBlocThermomix(sansPrefixe.bloc, sansPrefixe.contexte, { locale: 'fr', initialisation: true })) > 2000,
    '10.5 TM7 : le formateur commun reste libre et un préfixe ajouté à tort dépasserait la limite');
  await withRepo(async repo => {
    const source = sourceThermomix();
    source.ingredients[0].id = 'ingredient-z'; source.ingredients[1].id = 'ingredient-a';
    source.ingredients.push({ id: 'ingredient-3', source_text: '10 g de persil', name_text: 'persil', quantity: { value: 10 }, unit_id: 'g' });
    const recipe = { id: source.recipe_id, original_title: 'Sauce témoin', availability: 'available', current_version_id: source.id };
    await repo.saveBatch({ recipes: [recipe], recipe_versions: [source] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
    const sourceAvant = await repo.get('recipe_versions', source.id);
    let corps, appels = 0;
    const resultat = { type: 'proposition', blocs: [blocDe('s1', ['i2'])] };
    const deps = { repo, config, maintenant: () => date, enLigne: () => true, fetch: async (_url, init) => { appels++; corps = JSON.parse(init.body); return reponse(resultat); } };
    const row = await P.ouvrirThermomix({ recipeId: recipe.id, versionId: source.id, selection: ['s1'] }, deps), contexteAvant = clone(row.contexte);
    const proposee = await P.proposerThermomix({ importId: row.id, session, documentId: 'doc-demande' }, deps);
    const envoyee = JSON.parse(corps.corps.messages[0].content).contexte;
    eq([appels, proposee.status], [1, 'a_verifier'], '10.5 TM7 réseau : vrai POST capturé et proposition relue');
    eq(envoyee.source.ingredients.map(i => i.ref), ['i1', 'i2', 'i3'], '10.5 TM7 réseau : références explicites dans chaque ingrédient');
    eq(envoyee.source.ingredients.map(({ ref, ...i }) => i), contexteAvant.source.ingredients, '10.5 TM7 réseau : mêmes identités, ordre, quantités et textes');
    eq(envoyee.source_signature, contexteAvant.source_signature, '10.5 TM7 réseau : signature JSON persistée inchangée');
    eq((await repo.get('imports', row.id)).contexte, contexteAvant, '10.5 TM7 réseau : projection ne réécrit pas le contexte du journal');
    eq(await repo.get('recipe_versions', source.id), sourceAvant, '10.5 TM7 réseau : version originale inchangée après appel');
    const texte = T.formaterBlocThermomix(proposee.resultat.blocs[0], proposee.contexte);
    ok(texte.includes(source.ingredients[1].source_text) && !texte.includes(source.ingredients[0].source_text), '10.5 TM7 réseau : réponse i2 correspond bien au deuxième ingrédient');
    for (const refs of [['i4'], ['i2', 'i2']]) {
      const hostile = { type: 'proposition', blocs: [blocDe('s1', refs)] };
      eq(motif(() => T.validerReponseThermomix(hostile, contexteAvant)), 'ingredient', '10.5 TM7 réseau : référence inconnue ou doublon toujours refusé');
    }
  });
}
