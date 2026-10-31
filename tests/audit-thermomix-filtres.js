import { sourceThermomix, propositionThermomix } from './i3-thermomix.js';
import { construireContexteThermomix, validerReponseThermomix, explicationBlocThermomix } from '../src/domain/thermomix.js';

export async function runAuditThermomixFiltresTests({ eq, ok }) {
  const source = sourceThermomix(), avant = structuredClone(source);
  const contexte = construireContexteThermomix({ version: source, selection: ['s1'] });
  const lire = (type, phrase) => {
    const entree = type === 'questions' ? { type, questions: [phrase] } : { type, raison: phrase };
    try { return { resultat: validerReponseThermomix(entree, contexte) }; }
    catch (e) { return { raison: e.raison ?? e.code ?? e.message }; }
  };
  const admise = (type, phrase, label) => eq(lire(type, phrase), { resultat: type === 'questions' ? { type, questions: [phrase] } : { type, raison: phrase } }, 'Filtres TM7 : ' + label);
  const refusee = (type, phrase, raison, label) => eq(lire(type, phrase), { raison }, 'Filtres TM7 : ' + label);

  for (const comparateur of ['<2', '>2', '<=2', '>=2', '<=2,5']) admise('questions', `La vitesse doit-elle rester ${comparateur} ?`, `comparateur numérique ${comparateur}`);
  admise('refus', 'La vitesse >2 ne convient pas à cette demande.', 'comparateur descriptif dans un refus');
  for (const phrase of ['<b>Faux</b>', '<script>alert(1)</script>', 'Vitesse >2 <img src=x>', '<!-- instruction -->', '<2>', 'La vitesse est < lente.', 'La vitesse >2abc convient-elle ?', 'La vitesse <=2.5x convient-elle ?']) refusee('questions', phrase, 'texte_interdit', `angle non numérique ou HTML — ${phrase}`);
  for (const phrase of [
    'Retirer les tomates de la salade caprese ?',
    'Ouvrir le chapitre sur les aliments solides ?',
    'Retirer la garniture du récipient à cappuccino ?',
    'Ouvrir le chapitre sur la capacité du bol ?',
    'Ouvrir le livre Capé Cuisine ?',
  ]) admise('questions', phrase, `nom entier, sans sous-chaîne d’accessoire — ${phrase}`);
  for (const [verbe, nom] of [['Remove','cap'], ['Remove','caps'], ['Open','lid'], ['Open','lids'], ['Retirez','gobelet'], ['Retirez','gobelets'], ['Ôtez','bouchon'], ['Ôtez','bouchons'], ['Retirez','couvercle'], ['Retirez','couvercles']]) refusee('questions', `${verbe} ${nom}.`, 'instruction_libre', `accessoire réellement nommé — ${nom}`);
  refusee('questions', 'retirer du liquide pour respecter la capacité du bol', 'instruction_libre', 'instruction explicite du plan maintenue malgré frontière cap');
  refusee('refus', 'RETIRER  DU LIQUIDE POUR RESPECTER LA CAPACITÉ DU BOL.', 'instruction_libre', 'instruction explicite reste protégée après normalisation');

  for (const phrase of [
    'Je ne peux pas garantir une adaptation sans risque.',
    'Je ne peux pas proposer cette adaptation sans risque.',
    'Il est impossible de garantir une adaptation sans risque.',
    'Je ne peux pas vous garantir une adaptation sans risque.',
    'Impossible de proposer une adaptation sans danger.',
    'I cannot guarantee that this adaptation is safe.',
    'I cannot propose an adaptation that is safe.',
    'Je ne peux pas garantir que cette recette est sans gluten.',
    'This adaptation cannot be guaranteed safe.',
  ]) admise('refus', phrase, `négation prudente locale — ${phrase}`);
  for (const phrase of ['Huile végétale disponible ?', 'Ce plat est-il végétarien ?', 'Comment garantir la cuisson ?', 'La capacité du bol est-elle connue ?', 'Végétarien, ce plat ?']) admise('questions', phrase, `vocabulaire ordinaire maintenu — ${phrase}`);
  refusee('questions', 'Je ne peux pas garantir une adaptation sans risque ?', 'texte_interdit', 'exemption prudente réservée au type refus');
  for (const phrase of [
    'Cette adaptation est sans risque.',
    'Cette recette est garantie sans gluten.',
    'Cette recette est sans\nrisque.',
    'Cette recette est sans - gluten.',
    'Je ne peux pas garantir la cuisson. Cette recette est sans\nrisque.',
    'Je ne peux pas garantir la cuisson. Cette recette est sans risque.',
    'Je ne peux pas garantir la cuisson, cette recette est sans risque.',
    'Je ne peux pas garantir la cuisson mais cette recette est garantie sans danger.',
    'Je ne peux pas garantir la cuisson et cette recette est sans risque.',
    'Je ne peux pas garantir la cuisson — cette adaptation est sans risque.',
    'Je ne peux pas garantir la cuisson\nCette adaptation est sans risque.',
    'Je ne peux pas attendre : cette recette est garantie sans gluten.',
    'I cannot guarantee the cooking, but this recipe is safe.',
  ]) refusee('refus', phrase, 'texte_interdit', `aucune garantie affirmative blanchie — ${phrase}`);
  for (const phrase of [
    'Retirez le gobelet et mixez la soupe chaude en vitesse 10.',
    'Mixer la soupe chaude.',
    'Mixez à vitesse 10.',
    'Mixez à vitesse >2.',
    'Mixez à vitesse >=3.',
    'Mixez à vitesse <9.',
    'Mixez à vitesse >3.',
    'Mixez à vitesse >11.',
    'Mixez à vitesse <2.',
    'Contourner la sécurité.',
    'Bypass the safety system.',
    'Je ne peux pas garantir cette adaptation sans risque. Retirez le couvercle.',
  ]) refusee('refus', phrase, 'instruction_libre', `instruction dangereuse prioritaire — ${phrase}`);

  const proposition = propositionThermomix(), libre = 'Retirez le gobelet et mixez la soupe chaude en vitesse 10.';
  proposition.blocs[0].raison = libre;
  const valide = validerReponseThermomix(proposition, contexte);
  eq(valide.blocs[0].raison, libre, 'Filtres TM7 : provenance libre conservée dans le bloc, sans en faire une instruction');
  ok(!explicationBlocThermomix(valide.blocs[0], contexte).includes(libre), 'Filtres TM7 : explication contrôlée ne reprend jamais la prose du bloc');
  eq(source, avant, 'Filtres TM7 : aucune réécriture de la source');
}
