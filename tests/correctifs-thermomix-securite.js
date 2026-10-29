import { sourceThermomix, propositionThermomix } from './i3-thermomix.js';
import { withRepo } from './sync-fixture.js';

const clone = v => structuredClone(v);
const prep = (refs, contenant = 'bol', operation = 'ajouter') => ({ type: 'preparation', operation, ingredients: refs, contenant });
const reglage = patch => ({ ...propositionThermomix().blocs[0].actions[1], ...patch });
const bloc = (id, actions) => ({ source_step_id: id, raison: 'Réglages à relire.', actions });
const resultat = blocs => ({ type: 'proposition', blocs });
const liquide = (id, name, value, unit_id = 'l') => ({ id, name_text: name, source_text: `${value} ${unit_id} ${name}`, quantity: { value }, unit_id });

export async function runCorrectifsThermomixSecuriteTests({ eq, ok }) {
  const T = await import('../src/domain/thermomix.js');
  const contexte = (version = sourceThermomix(), precisions = {}, selection = ['s1']) => T.construireContexteThermomix({ version, precisions, selection });
  const motif = fn => { try { fn(); return null; } catch (e) { return e.raison || e.message; } };
  const valide = (r, c) => motif(() => T.validerReponseThermomix(r, c));
  const r = propositionThermomix();
  const source = { ...sourceThermomix(), ingredients: [liquide('a', 'bouillon', 1.5), liquide('b', 'lait', 1)] };
  eq(valide(r, contexte(source)), 'capacite', 'Sécurité : 1,5 L de bouillon + 1 L de lait dépassent le bol');
  eq(valide(r, contexte(source, { volume_bol_l: 1 })), 'capacite', 'Sécurité : une précision basse ne masque pas la somme connue');
  const limite = clone(source); limite.ingredients[0] = liquide('a', 'bouillon', 1.2);
  eq(valide(r, contexte(limite)), null, 'Sécurité : somme 2,2 L au plus, témoin de capacité');
  const unites = clone(source); unites.ingredients[1] = liquide('b', 'lait', 1000, 'ml');
  eq(valide(r, contexte(unites)), 'capacite', 'Sécurité : somme après conversion exacte litre/millilitre');
  const fourchette = clone(limite); fourchette.ingredients[0].quantity = { min: 1, max: 1.3 };
  eq(valide(r, contexte(fourchette)), 'capacite', 'Sécurité : borne haute de la quantité dans la somme');
  const distincts = resultat([bloc('s1', [prep(['i1']), prep(['i2']), reglage({})])]);
  eq(valide(distincts, contexte(source)), 'capacite', 'Sécurité : deux ajouts successifs ne contournent pas la capacité');
  const incoherent = clone(source); incoherent.ingredients[1].quantity = { value: 1, max: -2, qualitative: true };
  eq(valide(r, contexte(incoherent)), 'quantite_inconnue', 'Sécurité : une quantité négative masquée par qualitatif ne réduit pas la somme');
  const panier = { ...sourceThermomix(), ingredients: [liquide('a', 'bouillon', .8), liquide('b', 'lait', .7)] };
  const transfert = resultat([bloc('s1', [prep(['i1'], 'panier'), prep(['i2']), prep([], 'panier', 'transvaser')])]);
  eq(valide(transfert, contexte(panier)), 'capacite', 'Sécurité : transvaser additionne aussi le contenu du panier');
  const deplace = resultat([bloc('s1', [prep(['i1']), prep(['i1'], 'recipient', 'reserver'), prep(['i2']), reglage({ ingredients: ['i2'] })])]);
  eq(valide(deplace, contexte(source)), null, 'Sécurité : le liquide réservé ne reste pas compté dans le bol');
  const c = contexte(sourceThermomix(), { eau_vapeur_g: 500, froid_confirme: ['s1', 's2'] }, ['s1', 's2']);
  const vapeur = reglage({ mode: 'vapeur', temperature: null, accessoire: 'varoma', secondes: 900 });
  const deux = resultat([bloc('s1', [prep(['i1', 'i2'], 'varoma'), vapeur]), bloc('s2', [vapeur])]);
  eq(valide(deux, c), null, 'Sécurité : 30 min de vapeur, contenu établi, témoin accepté');
  const trop = clone(deux); trop.blocs[1].actions[0].secondes = 901;
  eq(valide(trop, c), 'vapeur_cumulee', 'Sécurité : 30 min + 1 s atteint bien la garde vapeur cumulée');
  eq(motif(() => contexte(sourceThermomix(), { eau_vapeur_g: 10000 })), 'eau_vapeur', 'Sécurité : 10 kg d’eau vapeur refusés avant tout appel');
  eq(motif(() => contexte(sourceThermomix(), { eau_vapeur_g: 2201 })), 'eau_vapeur', 'Sécurité : eau vapeur au-dessus du plafond du bol refusée');
  const eauMax = contexte(sourceThermomix(), { eau_vapeur_g: 2200 }, ['s1', 's2']);
  eq(valide(deux, eauMax), null, 'Sécurité : eau seule au plafond, aliments dans Varoma, témoin accepté');
  const vapeurBol = resultat([bloc('s1', [prep(['i1', 'i2']), vapeur])]);
  eq(valide(vapeurBol, contexte(limite, { eau_vapeur_g: 500 })), 'capacite', 'Sécurité : eau vapeur comprise dans le total du bol');
  const faible = clone(limite); faible.ingredients[0] = liquide('a', 'bouillon', .2);
  const suiteEau = resultat([bloc('s1', [prep(['i1', 'i2']), vapeur, vapeur])]);
  eq(valide(suiteEau, contexte(faible, { eau_vapeur_g: 500 })), null, 'Sécurité : la même eau vapeur ne se cumule pas à chaque réglage');
  const transfereEau = resultat([bloc('s1', [prep(['i1', 'i2']), vapeur, prep([], 'panier', 'transvaser')])]);
  eq(valide(transfereEau, contexte(faible, { eau_vapeur_g: 500 })), 'capacite', 'Sécurité : l’eau vapeur suit le transvasement vers le panier');
  const videPuisVapeur = resultat([bloc('s1', [prep(['i1', 'i2'], 'varoma'), vapeur, prep([], 'recipient', 'transvaser'), vapeur])]);
  eq(valide(videPuisVapeur, contexte(sourceThermomix(), { eau_vapeur_g: 500 })), 'eau_vapeur', 'Sécurité : aucune eau inventée après vidange du bol entre deux vapeurs');
  const sansEau = contexte(sourceThermomix(), {}, ['s1', 's2']);
  eq(valide(deux, sansEau), 'eau_vapeur', 'Sécurité : manque eau atteint la garde dédiée avec ingrédients établis');
  const oil = { ...sourceThermomix(), ingredients: [{ id: 'huile', name_text: 'huile', quantity: { value: 20 }, unit_id: 'ml' }] };
  const huileSeule = resultat([bloc('s1', [prep(['i1']), reglage({ ingredients: ['i1'] })])]);
  eq(valide(huileSeule, contexte(oil)), 'huile_seule', 'Sécurité : huile seule atteint effectivement la garde huile');
  const huileFroide = clone(huileSeule); huileFroide.blocs[0].actions[1].temperature = null;
  eq(valide(huileFroide, contexte(oil)), null, 'Sécurité : huile sans chauffe, témoin positif de la garde');
  const chaudRapide = resultat([bloc('s1', [prep(['i1', 'i2']), reglage({}), reglage({ temperature: null, vitesse: 10 })])]);
  eq(valide(chaudRapide, contexte(sourceThermomix(), { froid_confirme: ['s1'] })), 'froid_non_etabli', 'Sécurité : chauffe puis rapide atteint bien la garde thermique');
  const froidRapide = clone(chaudRapide); froidRapide.blocs[0].actions.splice(1, 1);
  eq(valide(froidRapide, contexte(sourceThermomix(), { froid_confirme: ['s1'] })), null, 'Sécurité : rapide à froid confirmé, témoin positif');
  const chaudDeux = resultat([bloc('s1', [prep(['i1', 'i2']), reglage({})]), bloc('s2', [reglage({ temperature: null, vitesse: 10 })])]);
  eq(valide(chaudDeux, c), 'froid_non_etabli', 'Sécurité : garde thermique entre deux blocs sans erreur de contenu préalable');
  for (const raison of ['Huile végétale présente dans la recette.', 'La recette source est végétarienne.', 'Je ne peux pas garantir le résultat.', 'Une cuisson sans risque ne peut pas être garantie.']) {
    const p = clone(r); p.blocs[0].raison = raison;
    eq(valide(p, contexte()), null, `Sécurité : mot ordinaire sans rejet payé — ${raison}`);
  }
  eq(valide({ type: 'refus', raison: 'Je ne peux pas garantir la cuisson de cette quantité.' }, contexte()), null, 'Sécurité : un refus prudent reste lisible');
  eq(valide({ type: 'refus', raison: 'Je ne peux pas garantir que cette recette est sans gluten.' }, contexte()), null, 'Sécurité : un refus prudent de garantie alimentaire reste lisible');
  eq(valide({ type: 'refus', raison: 'Cette recette est garantie sans gluten.' }, contexte()), 'texte_interdit', 'Sécurité : une garantie alimentaire affirmative reste refusée');
  for (const q of ['Retirez le couvercle et mixez à vitesse 10 ?', 'Retirez le gobelet et mixez la soupe chaude en vitesse 10 ?', 'Ôtez le couvercle pendant que les couteaux tournent, puis versez les ingrédients. Confirmez-vous ?']) {
    eq(valide({ type: 'questions', questions: [q] }, contexte()), 'instruction_libre', 'Sécurité : instruction dangereuse déguisée en question refusée au bon motif');
  }
  const dangereux = 'Retirez le gobelet et mixez la soupe chaude en vitesse 10.';
  const p = clone(r); p.blocs[0].raison = dangereux;
  await withRepo(async repo => {
    const source = sourceThermomix(); const recipe = { id: source.recipe_id, original_title: 'Sauce test', original_language: 'fr', current_version_id: source.id, availability: 'available' };
    await repo.saveBatch({ recipes: [recipe], recipe_versions: [source] }, { conditions: { recipes: [{ key: recipe.id, absente: true }] } });
    const { renderThermomixRoute } = await import('../src/ui/thermomix.js');
    let appels = 0;
    const root = await renderThermomixRoute({ id: recipe.id }, { v: source.id }, {}, { repo, remplacerAdresse() {}, navigate() {}, toast() {},
      sessionAssistant: async () => ({ access_token: 'fixture-local', user: { id: 'u1' } }), enLigne: () => true,
      config: { url: 'https://assistant.example', anonKey: 'publique-factice' }, fetch: async () => { appels++; return new Response(JSON.stringify({ content: [{ type: 'text', text: `Voici la proposition :\n\`\`\`json\n${JSON.stringify(p)}\n\`\`\`` }], stop_reason: 'end_turn', model: 'test' }), { status: 200 }); } });
    document.body.append(root);
    try {
      const choix = root.querySelector('[name=etape]'); choix.checked = true; choix.dispatchEvent(new Event('change', { bubbles: true }));
      await root.attendreEcritures(); root.querySelector('[data-role=proposer-tm7]').click(); await root.attendreEcritures();
      eq(appels, 1, 'Sécurité : une réponse payée complète simulée');
      ok(!root.textContent.includes(dangereux), 'Sécurité : justification libre dangereuse absente du vrai écran');
      ok(root.textContent.includes('100 °C'), 'Sécurité : réglage structuré valide toujours présenté, appel conservé');
      ok(root.textContent.includes('Couvercle en place'), 'Sécurité : couvercle indiqué par le texte contrôlé');
    } finally { root.dispose(); root.remove(); }
  });
}
