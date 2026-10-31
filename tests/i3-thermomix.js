// I3 : comportement du profil et de l'adaptation partielle, sans réseau ni base persistante.
export function sourceThermomix() {
  return { id: 'rv-source', recipe_id: 'recipe-source', kind: 'extraction', status: null, servings: 4,
    prep_minutes: 10, cook_minutes: 20, total_minutes: 30, active_minutes: 12,
    ingredients: [
      { id: 'ri-tomate', source_text: '400 g de tomates', name_text: 'tomates', quantity: { value: 400, raw: '400' }, unit_id: 'g' },
      { id: 'ri-oignon', source_text: '100 g d’oignons', name_text: 'oignons', quantity: { value: 100, raw: '100' }, unit_id: 'g' },
    ],
    steps: [{ id: 's1', text: 'Préparer les tomates et les oignons.' }, { id: 's2', text: 'Faire cuire la sauce.' }, { id: 's3', text: 'Servir avec les pâtes.' }],
    constraints: { diets: ['vegetarien'] }, provenance: { source_page_ids: ['pg-1'], convention_snapshot: { id: 'metric_ca', revision: 1 } } };
}
export function propositionThermomix(step = 's1', actions = null) {
  return { type: 'proposition', blocs: [{ source_step_id: step, raison: 'Remuer la sauce dans le bol.', actions: actions || [
    { type: 'preparation', operation: 'ajouter', ingredients: ['i1', 'i2'], contenant: 'bol' },
    { type: 'reglage', mode: 'manuel', secondes: 480, temperature: 100, vitesse: 1, sens: 'normal', accessoire: 'couteau', ingredients: ['i1', 'i2'] },
  ] }] };
}
const copie = (x) => JSON.parse(JSON.stringify(x));
export async function runI3ThermomixTests({ eq, ok }) {
  const T = await import('../src/domain/thermomix.js');
  const src = sourceThermomix();
  const ctx = (opts = {}) => T.construireContexteThermomix({ version: src, selection: ['s1'], ...opts });
  const motif = fn => { try { fn(); return null; } catch (e) { return e?.raison ?? e?.code ?? e?.message; } };
  const refused = (fn, message, raison) => { eq(motif(fn), raison, 'I3 : ' + message); };
  const rule = (patch, options = {}) => { const p = propositionThermomix(); Object.assign(p.blocs[0].actions[1], patch); return T.validerReponseThermomix(p, ctx(options)); };
  eq(ctx().source.servings, 4, 'I3 : portions source explicites');
  eq(ctx({ selection: [] }).selection, [], 'I3 : brouillon sans présélection');
  eq(ctx({ selection: ['s3', 's1'] }).selection, ['s1', 's3'], 'I3 : sélection remise dans l’ordre source');
  eq(T.ingredientsContexteThermomix(ctx()).map(i => i.ref), ['i1', 'i2'], 'I3 : références client stables');
  refused(() => ctx({ selection: ['s1', 's1'] }), 'sélection doublonnée refusée', 'selection');
  refused(() => ctx({ selection: ['inventee'] }), 'étape étrangère refusée', 'selection');
  refused(() => ctx({ demande: 'a'.repeat(501) }), 'demande trop longue non tronquée', 'texte');
  const secret = { ...src, notes: 'note privée', provenance: { ...src.provenance, secret: 'texte privé' } };
  const secretCtx = T.construireContexteThermomix({ version: secret, selection: ['s1'] });
  ok(!JSON.stringify(secretCtx).includes('privé'), 'I3 : notes/provenance privée absentes du contexte');
  eq(T.validerReponseThermomix(propositionThermomix(), ctx()).type, 'proposition', 'I3 : proposition normale acceptée');
  eq(T.validerReponseThermomix({ type: 'questions', questions: ['Quelle quantité d’eau prévois-tu dans le bol ?'] }, ctx()).type, 'questions', 'I3 : question sans fabrication');
  eq(T.validerReponseThermomix({ type: 'refus', raison: 'Cette opération demande un mode hors du profil.' }, ctx()).type, 'refus', 'I3 : refus distinct des pannes');
  refused(() => T.validerReponseThermomix(propositionThermomix(), ctx({ selection: [] })), 'aucune proposition pour une sélection vide', 'selection');
  for (const [raw, raison] of [
    [null, 'structure'], [[], 'structure'], [{ type: 'proposition', blocs: [] }, 'limite'],
    [{ type: 'refus', raison: '' }, 'texte'], [{ type: 'questions', questions: [] }, 'limite'],
    [{ type: 'refus', raison: 'Voir https://evil.test' }, 'texte_interdit'],
    [{ type: 'refus', raison: '<b>Faux</b>' }, 'texte_interdit'],
    [{ type: 'refus', raison: 'Cuisson sans danger garantie.' }, 'texte_interdit'],
    [{ type: 'refus', raison: 'Motif', url: 'x' }, 'structure'],
  ]) {
    refused(() => T.validerReponseThermomix(raw, ctx()), 'réponse hostile/structure incomplète refusée', raison);
  }
  const inherited = Object.create({ type: 'refus' }); inherited.raison = 'Refus';
  refused(() => T.validerReponseThermomix(inherited, ctx()), 'propriétés héritées refusées', 'structure');
  const dup = propositionThermomix(); dup.blocs.push(copie(dup.blocs[0]));
  refused(() => T.validerReponseThermomix(dup, ctx()), 'bloc dupliqué refusé', 'selection');
  const other = propositionThermomix('s2');
  refused(() => T.validerReponseThermomix(other, ctx()), 'bloc hors sélection refusé', 'selection');
  for (const [patch, raison] of [
    [{ temperature: 99 }, 'temperature'], [{ temperature: '100' }, 'temperature'], [{ temperature: 'Varoma' }, 'temperature'],
    [{ vitesse: 0 }, 'reglage'], [{ vitesse: 2.5 }, 'reglage'], [{ vitesse: 6.5 }, 'reglage'],
    // Infinity est refusé par la lecture JSON avant la validation du réglage.
    [{ vitesse: Infinity }, 'nombre'],
    [{ secondes: 0 }, 'reglage'], [{ secondes: 1801 }, 'reglage'], [{ secondes: 1.5 }, 'reglage'],
    [{ accessoire: 'sensor' }, 'reglage'], [{ accessoire: 'cutter' }, 'reglage'], [{ mode: 'turbo' }, 'reglage'], [{ sens: 'reverse' }, 'reglage'],
    [{ ingredients: ['i3'] }, 'ingredient'], [{ ingredients: ['i1', 'i1'] }, 'ingredient'], [{ url: 'forbidden' }, 'structure'],
  ]) {
    refused(() => rule(patch), 'réglage hors contrat refusé', raison);
  }
  eq(rule({ secondes: 1 }).blocs[0].actions[1].secondes, 1, 'I3 : durée minimale inclusive');
  eq(rule({ secondes: 1800 }).blocs[0].actions[1].secondes, 1800, 'I3 : durée maximale inclusive');
  eq(rule({ vitesse: 2 }).blocs[0].actions[1].vitesse, 2, 'I3 : chauffe à vitesse 2 acceptée');
  refused(() => rule({ vitesse: 3 }), 'chauffe à vitesse 3 refusée par profil Mistu', 'vitesse');
  refused(() => rule({ temperature: null, vitesse: 5 }), 'sans chauffe ne prouve pas le froid', 'froid_non_etabli');
  eq(rule({ temperature: null, vitesse: 10 }, { precisions: { froid_confirme: ['s1'] } }).blocs[0].actions[1].vitesse, 10, 'I3 : froid explicitement confirmé, vitesse 10');
  refused(() => rule({ temperature: null, vitesse: 3, sens: 'inverse' }, { precisions: { froid_confirme: ['s1'] } }), 'inverse au-dessus de 2 refusé', 'vitesse');
  eq(rule({ temperature: null, vitesse: 4, accessoire: 'fouet' }, { precisions: { froid_confirme: ['s1'] } }).blocs[0].actions[1].accessoire, 'fouet', 'I3 : fouet à froid vitesse 4');
  refused(() => rule({ temperature: null, vitesse: 5, accessoire: 'fouet' }, { precisions: { froid_confirme: ['s1'] } }), 'fouet vitesse 5 refusé', 'accessoire');
  refused(() => rule({ accessoire: 'fouet', sens: 'inverse' }), 'fouet sens inverse refusé', 'accessoire');
  refused(() => rule({ accessoire: 'panier', vitesse: 2 }), 'panier au-dessus de 1 refusé', 'accessoire');
  refused(() => rule({ mode: 'vapeur', temperature: null, accessoire: 'varoma' }), 'vapeur sans eau explicitée refusée', 'eau_vapeur');
  eq(rule({ mode: 'vapeur', temperature: null, accessoire: 'panier_varoma' }, { precisions: { eau_vapeur_g: 500 } }).blocs[0].actions[1].mode, 'vapeur', 'I3 : eau et montage vapeur panier/Varoma');
  refused(() => rule({ mode: 'vapeur', temperature: 100, accessoire: 'varoma' }, { precisions: { eau_vapeur_g: 500 } }), 'pas de température numérique vapeur', 'temperature');
  refused(() => rule({ mode: 'vapeur', temperature: null, accessoire: 'fouet' }, { precisions: { eau_vapeur_g: 500 } }), 'pas de fouet en vapeur', 'accessoire');
  refused(() => ctx({ precisions: { volume_bol_l: 2.201 } }), 'bol au-dessus de 2,2 L refusé', 'nombre');
  refused(() => ctx({ precisions: { volume_panier_l: 1.401 } }), 'panier au-dessus de 1,4 L refusé', 'nombre');
  eq(ctx({ precisions: { volume_bol_l: 2.2, volume_panier_l: 1.4 } }).precisions.volume_bol_l, 2.2, 'I3 : capacités maximales inclusives');
  eq(ctx().precisions.volume_bol_l, null, 'I3 : volume inconnu reste inconnu');
  const both = ctx({ selection: ['s1', 's2'], precisions: { eau_vapeur_g: 500, froid_confirme: ['s1', 's2'] } });
  const vapeur = { ...propositionThermomix().blocs[0].actions[1], mode: 'vapeur', temperature: null, accessoire: 'varoma', secondes: 1000 };
  const twice = { type: 'proposition', blocs: [ { source_step_id: 's1', raison: 'Vapeur.', actions: [propositionThermomix().blocs[0].actions[0], vapeur] }, { source_step_id: 's2', raison: 'Suite.', actions: [vapeur] } ] };
  refused(() => T.validerReponseThermomix(twice, both), 'cumul vapeur sur plusieurs blocs refusé au-delà de 30 min', 'vapeur_cumulee');
  const hotFast = copie(twice); hotFast.blocs[0].actions = [...propositionThermomix().blocs[0].actions]; hotFast.blocs[1].actions = [{ ...vapeur, mode: 'manuel', accessoire: 'couteau', vitesse: 5 }];
  refused(() => T.validerReponseThermomix(hotFast, both), 'confirmation froide ne contourne pas une chauffe précédente', 'froid_non_etabli');
  const mixed = propositionThermomix(); mixed.blocs[0].actions.push({ ...mixed.blocs[0].actions[1], temperature: null, vitesse: 5 });
  refused(() => T.validerReponseThermomix(mixed, ctx({ precisions: { froid_confirme: ['s1'] } })), 'chauffe puis vitesse rapide dans le même bloc refusée', 'froid_non_etabli');
  const free = propositionThermomix(); free.blocs[0].actions[0] = { type: 'preparation', text: 'Ajouter deux œufs.' };
  refused(() => T.validerReponseThermomix(free, ctx()), 'préparation en prose libre refusée', 'structure');
  const adding = propositionThermomix(); adding.blocs[0].actions.push(copie(adding.blocs[0].actions[0]));
  refused(() => T.validerReponseThermomix(adding, ctx()), 'double ajout en quantité complète refusé', 'double_ajout');
  const oil = sourceThermomix(); oil.ingredients = [{ id: 'ri-oil', source_text: '100 ml d’huile', name_text: 'huile', quantity: { value: 100 }, unit_id: 'ml' }];
  refused(() => T.validerReponseThermomix(propositionThermomix('s1', [{ type: 'preparation', operation: 'ajouter', ingredients: ['i1'], contenant: 'bol' }, { ...propositionThermomix().blocs[0].actions[1], ingredients: ['i1'] }]), T.construireContexteThermomix({ version: oil, selection: ['s1'] })), 'chauffe d’huile seule refusée', 'huile_seule');
  const unknown = sourceThermomix(); unknown.ingredients[0].quantity = null;
  refused(() => T.validerReponseThermomix(propositionThermomix(), T.construireContexteThermomix({ version: unknown, selection: ['s1'] })), 'quantité utile absente exige une question', 'quantite_inconnue');
  let seq = 0; const make = (source = src, contexte = ctx(), resultat = propositionThermomix()) => T.fabriquerVersionThermomix({ source, contexte, resultat, id: 'rv-adaptee-' + (++seq), newId: () => 'step-new-' + (++seq), maintenant: '2026-10-28T23:00:00Z', modele: 'fixture' });
  const before = JSON.stringify(src); const child = make();
  eq(JSON.stringify(src), before, 'I3 : source intégralement intacte');
  eq(child.ingredients, src.ingredients, 'I3 : ingrédients exactement conservés');
  eq(child.steps.map(s => s.text).slice(1), src.steps.map(s => s.text).slice(1), 'I3 : étapes non sélectionnées identiques');
  eq(child.steps.length, src.steps.length, 'I3 : nombre extérieur d’étapes stable');
  ok(child.steps.every(s => !src.steps.some(x => x.id === s.id)), 'I3 : toutes les étapes ont des IDs neufs');
  eq([child.kind, child.status, child.parent_version_id, child.recipe_id], ['adaptation', 'proposed', src.id, src.recipe_id], 'I3 : version personnelle liée au bon parent');
  eq([child.prep_minutes, child.cook_minutes, child.total_minutes, child.active_minutes], [null, null, null, null], 'I3 : totaux source non affirmés');
  eq(child.provenance.source_page_ids, ['pg-1'], 'I3 : provenance du livre conservée');
  eq(T.lireThermomix(child)?.ok, true, 'I3 : plan gardé relisible');
  eq(T.lireThermomix(src), null, 'I3 : source ordinaire sans marqueur TM');
  eq(T.gardeThermomix(child, 4).ok, true, 'I3 : portions source admises');
  eq(T.gardeThermomix(child, 8).ok, false, 'I3 : portions modifiées refusées');
  const unknownServings = { ...src, servings: null }; const unknownCtx = ctx({ version: unknownServings }); const unknownChild = make(unknownServings, unknownCtx);
  eq(T.gardeThermomix(unknownChild, null).ok, true, 'I3 : portions inconnues sans nombre admises');
  eq(T.gardeThermomix(unknownChild, 4).ok, false, 'I3 : portions inconnues ne deviennent pas quatre');
  for (const mutate of [v => { v.ingredients[0].quantity.value++; }, v => { v.steps[1].text += ' Autre.'; }, v => { v.provenance.thermomix.profil = 'autre'; }, v => { v.servings = 3; }, v => { v.steps[0].id = 's1'; }]) {
    const altered = copie(child); mutate(altered); eq(T.lireThermomix(altered)?.ok, false, 'I3 : version altérée invalide son plan');
  }
  const tested = { ...child, status: 'tested' }; eq(T.lireThermomix(tested)?.ok, true, 'I3 : observation testée ne modifie pas le plan');
  ok(T.etiquetteThermomix(tested).includes('testée'), 'I3 : état testé lisible sans certificat');
  const secondCtx = T.construireContexteThermomix({ version: child, selection: [child.steps[1].id] });
  const second = make(child, secondCtx, propositionThermomix(child.steps[1].id, [{ ...propositionThermomix().blocs[0].actions[1], temperature: null, vitesse: 1 }]));
  eq(T.lireThermomix(second)?.ok, true, 'I3 : adaptation d’adaptation revalidée');
  eq(second.steps[0].text, child.steps[0].text, 'I3 : bloc TM non choisi conservé');
  const text = T.formaterBlocThermomix(propositionThermomix().blocs[0], ctx());
  ok(text.includes('8 min') && text.includes('100 °C'), 'I3 : notation rendue depuis paramètres');
  ok(!text.includes('Remuer la sauce'), 'I3 : raison du modèle non insérée dans instruction');
  const bundle = { recipe: { id: src.recipe_id, original_title: 'Sauce', availability: 'available' }, version: child, book: { title: 'Mon livre', author: 'Auteur' }, edition: { isbn: '9780000000000' } };
  const copied = T.copieCookidooThermomix(bundle);
  eq(copied.etapes.length, src.steps.length, 'I3 : un champ Cookidoo par étape source');
  eq(copied.ingredients, src.ingredients.map(i => i.source_text), 'I3 : copie quantités source exactes');
  ok(copied.texte.includes('non testée') && copied.texte.includes('Mon livre'), 'I3 : copie provenance et proposition non testée');
  refused(() => T.copieCookidooThermomix({ ...bundle, recipe: { ...bundle.recipe, availability: 'partial' } }), 'copie source partielle refusée', 'recette_incomplete');
  refused(() => T.copieCookidooThermomix(bundle, { portions: 8 }), 'copie avec portions étrangères refusée', 'portions');
  eq(T.lireThermomix(JSON.parse(JSON.stringify(child)))?.ok, true, 'I3 : restauration JSON conserve revalidation');
  const withExtra = sourceThermomix(); withExtra.steps[1].other_metadata = { imported: true };
  const extraChild = make(withExtra, ctx({ version: withExtra }));
  eq(T.lireThermomix(extraChild)?.ok, true, 'I3 : métadonnée source non opérationnelle ne casse pas la nouvelle version');
  const invalidManual = copie(child); invalidManual.provenance.thermomix_invalide = true;
  eq(T.gardeThermomix(invalidManual).ok, false, 'I3 : édition générique marquée invalide est bloquée');
  ok(T.etiquetteThermomix(invalidManual).includes('Version personnelle'), 'I3 : édition générique conserve ascendance sans approbation');
  const invalidCtx = T.construireContexteThermomix({ version: invalidManual, selection: [invalidManual.steps[0].id] });
  refused(() => T.validerReponseThermomix(propositionThermomix(invalidManual.steps[0].id), invalidCtx), 'réparation partielle ne laisse pas de vieux réglages invalidés', 'plan_invalide');
  const fullCtx = T.construireContexteThermomix({ version: invalidManual, selection: invalidManual.steps.map(s => s.id) });
  const fullReply = { type: 'proposition', blocs: invalidManual.steps.map(s => propositionThermomix(s.id, [{ type: 'preparation', operation: 'verifier_texture', ingredients: [], contenant: 'bol' }]).blocs[0]) };
  const repaired = make(invalidManual, fullCtx, fullReply);
  eq(T.lireThermomix(repaired)?.ok, true, 'I3 : réadaptation intégrale remplace le plan invalide');
  eq(repaired.provenance.thermomix_invalide, undefined, 'I3 : approbation réparée ne lègue pas marqueur invalide');
  const five = ctx({ selection: ['s1', 's2', 's3'] });
  const whisk = { ...propositionThermomix().blocs[0].actions[1], accessoire: 'fouet', secondes: 1800 };
  const longWhisk = { type: 'proposition', blocs: [
    { source_step_id: 's1', raison: 'Remuer.', actions: [propositionThermomix().blocs[0].actions[0], whisk, whisk] },
    { source_step_id: 's2', raison: 'Remuer.', actions: [whisk, whisk] },
    { source_step_id: 's3', raison: 'Remuer.', actions: [whisk] },
  ] };
  refused(() => T.validerReponseThermomix(longWhisk, five), 'cumul fouet >2 h refusé sur blocs distincts', 'fouet_cumule');
  longWhisk.blocs[2].actions = [{ type: 'preparation', operation: 'verifier_texture', ingredients: [], contenant: 'bol' }];
  eq(T.validerReponseThermomix(longWhisk, five).type, 'proposition', 'I3 : cumul fouet 2 h inclusif');
  const hotFat = sourceThermomix(); hotFat.ingredients[0] = { id: 'ri-oil', source_text: '100 ml d’huile chaude', name_text: 'huile chaude', quantity: { value: 100 }, unit_id: 'ml' };
  refused(() => T.validerReponseThermomix(propositionThermomix(), ctx({ version: hotFat })), 'graisse explicitement chaude ne se verse pas dans le bol', 'graisse_chaude');
  const badRef = sourceThermomix(); badRef.ingredients[0].ref = 'i99';
  eq(T.ingredientsContexteThermomix(ctx({ version: badRef }))[0].ref, 'i1', 'I3 : données source ne choisissent pas les références client');
  const badModel = copie(child); badModel.provenance.model = 'autre';
  eq(T.lireThermomix(badModel)?.ok, false, 'I3 : provenance modèle modifiée détectée');
  const changedConstraints = copie(child); changedConstraints.constraints = {};
  eq(T.lireThermomix(changedConstraints)?.ok, false, 'I3 : contraintes alimentaires modifiées détectées');
  const overLong = sourceThermomix(); overLong.steps[0].text = 'a'.repeat(2001);
  refused(() => ctx({ version: overLong }), 'texte source excessif jamais tronqué', 'texte');
  const tooMany = sourceThermomix(); tooMany.ingredients = Array.from({ length: 61 }, (_, i) => ({ ...src.ingredients[0], id: 'i-' + i }));
  refused(() => ctx({ version: tooMany }), 'contexte trop nombreux ingrédients refusé', 'limite');
  for (const claimed of ['Sans lactose.', 'Sans noix.', 'Vegan.', 'Allergen-free.']) refused(() => T.validerReponseThermomix({ type: 'refus', raison: claimed }, ctx()), 'aucune affirmation alimentaire générée', 'texte_interdit');
  const steamCtx = ctx({ precisions: { eau_vapeur_g: 700 } });
  const steamFirst = make(src, steamCtx, propositionThermomix('s1', [propositionThermomix().blocs[0].actions[0], { ...vapeur, secondes: 200 }]));
  const steamSecondCtx = T.construireContexteThermomix({ version: steamFirst, selection: [steamFirst.steps[1].id] });
  const slow = { ...propositionThermomix().blocs[0].actions[1], temperature: null, vitesse: 1 };
  const steamSecond = make(steamFirst, steamSecondCtx, propositionThermomix(steamFirst.steps[1].id, [slow]));
  const steamThirdCtx = T.construireContexteThermomix({ version: steamSecond, selection: [steamSecond.steps[2].id] });
  let steamThird = null;
  try { steamThird = make(steamSecond, steamThirdCtx, propositionThermomix(steamSecond.steps[2].id, [slow])); } catch (_) { /* le verdict ci-dessous constate le résultat */ }
  eq(T.lireThermomix(steamThird)?.ok, true, 'I3 : troisième adaptation conserve les conditions des blocs de première génération');
  eq(steamThird?.steps[0].text, steamFirst.steps[0].text, 'I3 : eau réellement renseignée du bloc initial conservée dans le texte');
  const hiddenOnion = sourceThermomix(); hiddenOnion.ingredients[0] = { id: 'oil', source_text: '100 ml d’huile', name_text: 'huile', quantity: { value: 100 }, unit_id: 'ml' };
  const hiddenReply = propositionThermomix(); hiddenReply.blocs[0].actions[0].ingredients = ['i1'];
  // Ces trois cas refusent d'abord les références hors du contenu réel du bol.
  // Le voisin cohérent « chauffe d’huile seule » atteint déjà huile_seule ci-dessus.
  refused(() => T.validerReponseThermomix(hiddenReply, ctx({ version: hiddenOnion })), 'ingrédient cité par réglage mais absent du bol refusé avant huile seule', 'contenu_incoherent');
  const otherContainer = propositionThermomix(); otherContainer.blocs[0].actions = [
    { type: 'preparation', operation: 'ajouter', ingredients: ['i1'], contenant: 'bol' },
    { type: 'preparation', operation: 'repartir_varoma', ingredients: ['i2'], contenant: 'varoma' },
    otherContainer.blocs[0].actions[1],
  ];
  refused(() => T.validerReponseThermomix(otherContainer, ctx({ version: hiddenOnion })), 'aliment dans Varoma cité à tort dans le réglage du bol refusé', 'contenu_incoherent');
  const removed = propositionThermomix(); removed.blocs[0].actions.splice(1, 0, { type: 'preparation', operation: 'reserver', ingredients: ['i2'], contenant: 'recipient' });
  refused(() => T.validerReponseThermomix(removed, ctx({ version: hiddenOnion })), 'ingrédient réservé cité à tort comme contenu du bol refusé', 'contenu_incoherent');
  const twiceVaroma = propositionThermomix('s1', [
    { type: 'preparation', operation: 'repartir_varoma', ingredients: ['i1'], contenant: 'varoma' },
    { type: 'preparation', operation: 'repartir_varoma', ingredients: ['i1'], contenant: 'varoma' },
  ]);
  refused(() => T.validerReponseThermomix(twiceVaroma, ctx()), 'répartir deux fois la même quantité dans Varoma refusé', 'double_ajout');
  const falsifiedOld = copie(second);
  falsifiedOld.provenance.thermomix.contexte.anciens_blocs[0].actions[1].secondes = 1;
  falsifiedOld.provenance.thermomix.blocs[0].actions[1].secondes = 1;
  eq(T.lireThermomix(falsifiedOld)?.ok, false, 'I3 : ancien réglage altéré ne conserve pas texte/timer contradictoire');
  eq(T.validerReponseThermomix(propositionThermomix('s2'), ctx({ selection: ['s2'] })).type, 'proposition', 'I3 : étape ultérieure seule avec ajout explicite et vitesse basse possible');
  let gapReason = null;
  try { T.validerReponseThermomix({ type: 'proposition', blocs: [propositionThermomix('s1').blocs[0], propositionThermomix('s3', [slow]).blocs[0]] }, ctx({ selection: ['s1', 's3'] })); }
  catch (e) { gapReason = e.raison; }
  eq(gapReason, 'contenu_non_etabli', 'I3 : intervalle source non sélectionné explique le contenu inconnu');
  const englishCtx = T.construireContexteThermomix({ version: child, selection: [child.steps[1].id], langue: 'en' });
  const englishChild = make(child, englishCtx, propositionThermomix(child.steps[1].id, [slow]));
  eq(T.lireThermomix(englishChild)?.ok, true, 'I3 : adaptation anglaise conserve preuve du bloc français');
  eq(englishChild.steps[0].text, child.steps[0].text, 'I3 : ancien bloc français non retraduit');
  const mixedCtx = T.construireContexteThermomix({ version: englishChild, selection: [englishChild.steps[2].id], langue: 'fr' });
  const multilingual = make(englishChild, mixedCtx, propositionThermomix(englishChild.steps[2].id, [slow]));
  eq(T.lireThermomix(multilingual)?.ok, true, 'I3 : trois générations FR EN FR relisent chaque bloc dans sa langue');
  const prep = (refs, contenant = 'bol', operation = 'ajouter') => ({ type: 'preparation', operation, ingredients: refs, contenant });
  const laterCtx = ctx({ selection: ['s2'] });
  const later = make(src, laterCtx, propositionThermomix('s2', [prep(['i1']), { ...slow, temperature: 100, ingredients: ['i1'] }]));
  const beforeCtx = T.construireContexteThermomix({ version: later, selection: [later.steps[0].id] });
  let inserted = null;
  try { inserted = make(later, beforeCtx, propositionThermomix(later.steps[0].id, [prep(['i2']), { ...slow, ingredients: ['i2'] }, prep(['i2'], 'recipient', 'reserver')])); } catch (_) { /* verdict ci-dessous */ }
  eq(T.lireThermomix(inserted)?.ok, true, 'I3 : adaptation avant un ancien bloc conserve son montage initial explicite');
  eq(inserted?.steps[1].text, later.steps[1].text, 'I3 : texte source ancien conservé même si un bloc TM7 est ajouté avant');
  const oversizeVolume = sourceThermomix(); oversizeVolume.ingredients[0] = { id: 'water', name_text: 'eau', source_text: '3 L d’eau', quantity: { value: 3 }, unit_id: 'l' };
  refused(() => T.validerReponseThermomix(propositionThermomix(), ctx({ version: oversizeVolume })), 'volume source individuel explicite au-dessus du bol refusé', 'capacite');
  oversizeVolume.ingredients[0] = { id: 'water', name_text: 'eau', source_text: '1 401 ml d’eau', quantity: { value: 1401 }, unit_id: 'ml' };
  refused(() => T.validerReponseThermomix(propositionThermomix('s1', [prep(['i1'], 'panier')]), ctx({ version: oversizeVolume })), 'volume source individuel au-dessus du panier refusé', 'capacite');
}
