// Internationalisation : le français est la langue de référence et sert de clé.
// t('Mes livres') retourne la traduction anglaise si elle existe, sinon la chaîne française.
// Trois préférences distinctes (spec §29.1) : langue de l'interface, langue de lecture, unités.

import { EN } from '../i18n/en.js';

let uiLocale = 'fr';

export function setUiLocale(locale) {
  uiLocale = locale === 'en' ? 'en' : 'fr';
  document.documentElement.lang = uiLocale === 'en' ? 'en-CA' : 'fr-CA';
}

export const getUiLocale = () => uiLocale;

export function t(fr, vars = null) {
  let s = uiLocale === 'en' ? (EN[fr] ?? fr) : fr;
  // Remplacement par FONCTION : une chaîne de remplacement interpréterait $&, $$, $` et $' venus d'une valeur (V-C2).
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, () => String(v));
  return s;
}

// Libellés des états du schéma.
const STATE_LABELS = {
  availability: {
    reference_only: 'Repérée dans ton livre',
    partial: 'Partiellement disponible',
    available: 'Recette disponible',
  },
  verification: { unverified: 'Non vérifiée', to_verify: 'À vérifier', verified: 'Vérifiée' },
  version_kind: { extraction: 'Extraction', correction: 'Correction', adaptation: 'Adaptation', translation: 'Traduction', synthesis: 'Synthèse' },
  version_status: { proposed: 'Proposée', tested: 'Testée par Neegan' },
  link_state: { proposed: 'Proposé', confirmed: 'Confirmé', refused: 'Refusé' },
  recipe_type: {
    plat_principal: 'Plat principal', entree: 'Entrée', salade: 'Salade', soupe: 'Soupe', legumes: 'Légumes', feculent: 'Féculent',
    sauce: 'Sauce ou condiment', dessert: 'Dessert', boulangerie: 'Boulangerie', boisson: 'Boisson', autre: 'Autre',
  },
  meal_role: { plat_principal: 'Plat principal', entree: 'Entrée', accompagnement: 'Accompagnement', dessert: 'Dessert', autre: 'Autre' },
  diet: {
    sans_gluten: 'Sans gluten', vegetarien: 'Végétarien', vegetalien: 'Végétalien', sans_lactose: 'Sans lactose', sans_noix: 'Sans noix',
    sans_oeufs: 'Sans œufs', sans_fruits_de_mer: 'Sans fruits de mer', sans_porc: 'Sans porc', sans_alcool: 'Sans alcool',
  },
  diet_assessment: {
    compatible: 'Compatible selon les ingrédients vérifiés', adaptation: 'Adaptation nécessaire', to_verify: 'À vérifier', incompatible: 'Incompatible',
  },
  capability: {
    weigh: 'Peser', chop: 'Hacher', blend: 'Mixer', emulsify: 'Émulsionner', steam: 'Cuire à la vapeur', slow_cook: 'Mijoter lentement',
    sous_vide: 'Sous vide', controlled_heating: 'Chauffe contrôlée', knead: 'Pétrir', bake: 'Cuire au four', convection: 'Convection',
    broil: 'Gril du four', grill: 'Griller', smoke: 'Fumer', fry: 'Frire', air_fry: 'Friteuse à air', pressure_cook: 'Cuisson sous pression',
    rice_cook: 'Cuire le riz', vacuum_seal: 'Sceller sous vide', stir_fry: 'Sauter au wok', boil: 'Bouillir', simmer: 'Frémir',
    ferment: 'Fermenter', dehydrate: 'Déshydrater',
  },
  timer_state: {
    requested: 'Demande enregistrée', opening: 'Ouverture de Raccourcis…', unconfirmed: 'À vérifier dans Horloge',
    failed: 'Signalée comme non démarrée', siri: 'Demande à faire à Siri',
  },
  source_type: { photo: 'Photo', pdf: 'PDF', epub: 'EPUB', image: 'Image', other: 'Fichier' },
};

export function label(group, value) {
  const fr = STATE_LABELS[group]?.[value] ?? String(value ?? '');
  return t(fr);
}

export function optionsFor(group, values) {
  return values.map((v) => ({ value: v, label: label(group, v) }));
}
