// Données de référence initiales : unités, conventions et un petit vocabulaire d'ingrédients FR/EN.
// Aucune densité « universelle » n'est fournie : une équivalence volume→masse doit être documentée (spec §29.2).

const u = (id, dimension, factor, aliases, fr, en, source, extra = {}) => ({
  id, dimension, factor, reference_unit: dimension === 'mass' ? 'g' : dimension === 'volume' ? 'ml' : null,
  aliases, labels: { fr, en }, source, convention_dependent: false, revision: 1, ...extra,
});

export const UNIT_DEFINITIONS = [
  // Masse (référence : gramme)
  u('g', 'mass', 1, ['g', 'gr', 'gramme', 'grammes', 'gram', 'grams'], 'g', 'g', 'SI'),
  u('kg', 'mass', 1000, ['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes', 'kilogram', 'kilograms'], 'kg', 'kg', 'SI'),
  u('mg', 'mass', 0.001, ['mg', 'milligramme', 'milligrammes', 'milligram', 'milligrams'], 'mg', 'mg', 'SI'),
  u('oz_mass', 'mass', 28.349523125, ['oz', 'once', 'onces', 'ounce', 'ounces'], 'oz', 'oz', 'NIST SP 811 — once avoirdupois = 28,349523125 g', { ambiguous_with: 'fl_oz' }),
  u('lb', 'mass', 453.59237, ['lb', 'lbs', 'livre', 'livres', 'pound', 'pounds'], 'lb', 'lb', 'NIST SP 811 — livre avoirdupois = 453,59237 g'),
  // Volume (référence : millilitre)
  u('ml', 'volume', 1, ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'mL'], 'ml', 'ml', 'SI'),
  u('l', 'volume', 1000, ['l', 'litre', 'litres', 'liter', 'liters', 'L'], 'l', 'l', 'SI'),
  u('dl', 'volume', 100, ['dl', 'décilitre', 'décilitres', 'deciliter'], 'dl', 'dl', 'SI'),
  u('cl', 'volume', 10, ['cl', 'centilitre', 'centilitres', 'centiliter'], 'cl', 'cl', 'SI'),
  u('tsp', 'volume', null, ['c. à thé', 'c. à café', 'c. à c.', 'c.à.c.', 'c.à.c', 'cc', 'cuillère à thé', 'cuillères à thé', 'cuillère à café', 'cuillères à café', 'cuillerée à café', 'tsp', 'tsp.', 'teaspoon', 'teaspoons', 'c. thé'], 'c. à thé', 'tsp', 'Dépend de la convention de l’édition', { convention_dependent: true }),
  u('tbsp', 'volume', null, ['c. à soupe', 'c. à s.', 'c.à.s.', 'c.à.s', 'cs', 'cuillère à soupe', 'cuillères à soupe', 'cuillerée à soupe', 'c. à table', 'tbsp', 'tbsp.', 'tbs', 'tablespoon', 'tablespoons', 'c. soupe'], 'c. à soupe', 'tbsp', 'Dépend de la convention de l’édition', { convention_dependent: true }),
  u('cup', 'volume', null, ['tasse', 'tasses', 'cup', 'cups'], 'tasse', 'cup', 'Dépend de la convention de l’édition', { convention_dependent: true }),
  u('fl_oz', 'volume', null, ['fl oz', 'fl. oz', 'fl. oz.', 'fl.oz', 'oz liq', 'oz liq.', 'once liquide', 'onces liquides', 'fluid ounce', 'fluid ounces'], 'oz liq.', 'fl oz', 'Dépend de la convention de l’édition', { convention_dependent: true, ambiguous_with: 'oz_mass' }),
  // Température
  u('celsius', 'temperature', null, ['°c', '° c', 'c', 'celsius', 'degrés c', 'degrés celsius'], '°C', '°C', 'SI'),
  u('fahrenheit', 'temperature', null, ['°f', '° f', 'f', 'fahrenheit', 'degrés f'], '°F', '°F', 'Usage États-Unis'),
  // Nombre et mesures d'origine non convertibles (spec §29.2 : « garder la mesure d’origine »)
  u('piece', 'count', null, ['unité', 'unités', 'pièce', 'pièces', 'piece', 'pieces', 'pc', 'pcs'], 'unité', 'piece', '—'),
  u('pinch', 'count', null, ['pincée', 'pincées', 'pinch', 'pinches'], 'pincée', 'pinch', '—'),
  u('clove', 'count', null, ['gousse', 'gousses', 'clove', 'cloves'], 'gousse', 'clove', '—'),
  u('bunch', 'count', null, ['botte', 'bottes', 'bouquet', 'bouquets', 'bunch', 'bunches'], 'botte', 'bunch', '—'),
  u('can', 'count', null, ['boîte', 'boîtes', 'boite', 'boites', 'conserve', 'conserves', 'can', 'cans', 'tin', 'tins'], 'boîte', 'can', '—'),
  u('slice', 'count', null, ['tranche', 'tranches', 'slice', 'slices'], 'tranche', 'slice', '—'),
  u('leaf', 'count', null, ['feuille', 'feuilles', 'leaf', 'leaves'], 'feuille', 'leaf', '—'),
  u('sprig', 'count', null, ['brin', 'brins', 'branche', 'branches', 'sprig', 'sprigs'], 'brin', 'sprig', '—'),
  u('stalk', 'count', null, ['tige', 'tiges', 'stalk', 'stalks', 'stick', 'sticks', 'bâton', 'bâtons'], 'tige', 'stalk', '—'),
  u('package', 'count', null, ['paquet', 'paquets', 'sachet', 'sachets', 'package', 'packages', 'packet', 'packets', 'pkg'], 'paquet', 'package', '—'),
  u('handful', 'count', null, ['poignée', 'poignées', 'handful', 'handfuls'], 'poignée', 'handful', '—'),
  u('dash', 'count', null, ['trait', 'traits', 'filet', 'filets', 'dash', 'dashes', 'splash'], 'trait', 'dash', '—'),
];

// Une convention fixe la valeur en ml des unités dépendantes (tsp, tbsp, cup, fl_oz). Révision immuable.
export const UNIT_CONVENTIONS = [
  { id: 'metric_ca', revision: 1, labels: { fr: 'Métrique — Canada (250 ml / 15 ml / 5 ml)', en: 'Metric — Canada (250 ml / 15 ml / 5 ml)' },
    values: { tsp: 5, tbsp: 15, cup: 250, fl_oz: 30 }, source: 'Usage métrique courant dans les livres canadiens; tasse de 250 ml' },
  { id: 'us_customary', revision: 1, labels: { fr: 'Usuelle — États-Unis (236,6 ml / 14,8 ml / 4,9 ml)', en: 'US customary (236.6 ml / 14.8 ml / 4.9 ml)' },
    values: { tsp: 4.92892159375, tbsp: 14.78676478125, cup: 236.5882365, fl_oz: 29.5735295625 }, source: 'NIST SP 811, annexe B — unités usuelles américaines' },
  { id: 'us_legal', revision: 1, labels: { fr: 'Légale — États-Unis, étiquetage (240 ml / 15 ml / 5 ml)', en: 'US legal, labeling (240 ml / 15 ml / 5 ml)' },
    values: { tsp: 5, tbsp: 15, cup: 240, fl_oz: 30 }, source: 'FDA, 21 CFR 101.9(b)(5)(viii)' },
  { id: 'uk_imperial', revision: 1, labels: { fr: 'Impériale — Royaume-Uni (284 ml / 17,8 ml / 5,9 ml)', en: 'UK imperial (284 ml / 17.8 ml / 5.9 ml)' },
    values: { tsp: 5.91939, tbsp: 17.7582, cup: 284.130625, fl_oz: 28.4130625 }, source: 'Unités impériales : tasse de 10 onces liquides impériales' },
  { id: 'au_metric', revision: 1, labels: { fr: 'Métrique — Australie (250 ml / 20 ml / 5 ml)', en: 'Metric — Australia (250 ml / 20 ml / 5 ml)' },
    values: { tsp: 5, tbsp: 20, cup: 250, fl_oz: 30 }, source: 'Cuillère à soupe australienne de 20 ml (usage documenté)' },
];

// Ingrédients : identité neutre + libellés FR/EN. « contains » liste des catégories connues pour les filtres
// alimentaires ; null = inconnu (jamais assimilé à « sans »). Feuilles et graines restent des identités distinctes.
const ing = (id, category, fr, en, contains, frAliases = [], enAliases = []) => ({
  id, category, contains,
  labels: { fr: { label: fr, aliases: frAliases }, en: { label: en, aliases: enAliases } },
  equivalences: [], created_at: '2026-09-07T00:00:00.000Z', seed: true,
});

export const INGREDIENTS = [
  ing('ing_salt', 'condiment', 'sel', 'salt', [], ['sel de mer', 'fleur de sel', 'gros sel'], ['sea salt', 'kosher salt', 'flaky salt']),
  ing('ing_black_pepper', 'epice', 'poivre noir', 'black pepper', [], ['poivre', 'poivre du moulin'], ['pepper', 'freshly ground pepper']),
  ing('ing_olive_oil', 'huile', 'huile d’olive', 'olive oil', [], ["huile d'olive", 'huile d’olive extra vierge', "huile d'olive extra-vierge"], ['extra virgin olive oil', 'evoo']),
  ing('ing_butter', 'laitier', 'beurre', 'butter', ['dairy'], ['beurre non salé', 'beurre salé', 'beurre doux'], ['unsalted butter', 'salted butter']),
  ing('ing_garlic', 'legume', 'ail', 'garlic', [], ['gousse d’ail', "gousses d'ail", 'gousses d’ail', "gousse d'ail", 'ail haché'], ['garlic clove', 'garlic cloves', 'minced garlic']),
  ing('ing_onion', 'legume', 'oignon', 'onion', [], ['oignons', 'oignon jaune', 'oignon rouge'], ['onions', 'yellow onion', 'red onion']),
  ing('ing_shallot', 'legume', 'échalote', 'shallot', [], ['échalotes', 'echalote', 'échalote française'], ['shallots']),
  ing('ing_lemon', 'fruit', 'citron', 'lemon', [], ['citrons', 'jus de citron', 'zeste de citron'], ['lemons', 'lemon juice', 'lemon zest']),
  ing('ing_lime', 'fruit', 'lime', 'lime', [], ['limes', 'citron vert', 'jus de lime'], ['limes', 'lime juice']),
  ing('ing_tomato', 'legume', 'tomate', 'tomato', [], ['tomates', 'tomates fraîches', 'tomates cerises'], ['tomatoes', 'cherry tomatoes']),
  ing('ing_canned_tomato', 'conserve', 'tomates en conserve', 'canned tomatoes', [], ['tomates en boîte', 'tomates broyées', 'tomates concassées', 'tomates italiennes en conserve'], ['crushed tomatoes', 'diced tomatoes', 'whole peeled tomatoes', 'tinned tomatoes']),
  ing('ing_wheat_pasta', 'feculent', 'pâtes (blé)', 'pasta (wheat)', ['gluten'], ['pâtes', 'spaghetti', 'spaghettis', 'linguine', 'penne', 'rigatoni', 'tagliatelle', 'pates'], ['spaghetti', 'linguine', 'penne', 'rigatoni', 'dried pasta']),
  ing('ing_black_olive', 'condiment', 'olives noires', 'black olives', [], ['olives', 'olives kalamata', 'olives de Kalamata', 'olives taggiasca'], ['olives', 'kalamata olives']),
  ing('ing_caper', 'condiment', 'câpres', 'capers', [], ['capres', 'câpres au sel', 'câpres au vinaigre'], ['salted capers']),
  ing('ing_anchovy', 'poisson', 'anchois', 'anchovies', ['fish'], ['filets d’anchois', "filets d'anchois", 'anchois à l’huile'], ['anchovy', 'anchovy fillets']),
  ing('ing_chili_flakes', 'epice', 'piment broyé', 'chili flakes', [], ['flocons de piment', 'piment de Cayenne', 'piment séché', 'piment'], ['red pepper flakes', 'crushed red pepper', 'chilli flakes', 'dried chili']),
  ing('ing_parsley', 'herbe', 'persil', 'parsley', [], ['persil plat', 'persil italien', 'persil frisé'], ['flat-leaf parsley', 'italian parsley']),
  ing('ing_basil', 'herbe', 'basilic', 'basil', [], ['basilic frais', 'feuilles de basilic'], ['fresh basil', 'basil leaves']),
  ing('ing_coriander_leaves', 'herbe', 'coriandre (feuilles)', 'coriander leaves', [], ['coriandre', 'coriandre fraîche', 'feuilles de coriandre'], ['cilantro', 'fresh coriander', 'coriander']),
  ing('ing_coriander_seeds', 'epice', 'graines de coriandre', 'coriander seeds', [], ['coriandre moulue', 'coriandre en graines'], ['ground coriander', 'coriander seed']),
  ing('ing_fennel_bulb', 'legume', 'fenouil (bulbe)', 'fennel bulb', [], ['fenouil', 'bulbe de fenouil', 'fenouil frais'], ['fennel', 'fresh fennel']),
  ing('ing_fennel_seeds', 'epice', 'graines de fenouil', 'fennel seeds', [], ['fenouil en graines'], ['fennel seed']),
  ing('ing_cumin_ground', 'epice', 'cumin moulu', 'ground cumin', [], ['cumin', 'cumin en poudre'], ['cumin', 'cumin powder']),
  ing('ing_cumin_seeds', 'epice', 'graines de cumin', 'cumin seeds', [], ['cumin en graines', 'cumin entier'], ['whole cumin', 'cumin seed']),
  ing('ing_cucumber', 'legume', 'concombre', 'cucumber', [], ['concombres', 'concombre libanais', 'concombre anglais'], ['cucumbers', 'english cucumber', 'persian cucumbers']),
  ing('ing_salmon', 'poisson', 'saumon', 'salmon', ['fish'], ['filet de saumon', 'filets de saumon', 'pavé de saumon'], ['salmon fillet', 'salmon fillets']),
  ing('ing_chicken', 'viande', 'poulet', 'chicken', ['meat'], ['poitrine de poulet', 'poitrines de poulet', 'cuisses de poulet', 'hauts de cuisse'], ['chicken breast', 'chicken breasts', 'chicken thighs']),
  ing('ing_beef', 'viande', 'bœuf', 'beef', ['meat'], ['boeuf', 'bœuf haché', 'boeuf haché', 'bœuf à braiser'], ['ground beef', 'beef chuck', 'braising beef']),
  ing('ing_pork', 'viande', 'porc', 'pork', ['meat', 'pork'], ['porc haché', 'filet de porc', 'épaule de porc'], ['ground pork', 'pork shoulder', 'pork tenderloin']),
  ing('ing_duck_breast', 'viande', 'magret de canard', 'duck breast', ['meat'], ['magret', 'magrets de canard'], ['duck breasts', 'magret']),
  ing('ing_cream', 'laitier', 'crème', 'cream', ['dairy'], ['crème 35 %', 'crème 35%', 'crème à cuisson', 'crème fraîche', 'crème épaisse', 'crème 15 %'], ['heavy cream', 'double cream', 'whipping cream', 'single cream']),
  ing('ing_milk', 'laitier', 'lait', 'milk', ['dairy'], ['lait entier', 'lait 2 %', 'lait 3,25 %'], ['whole milk', '2% milk']),
  ing('ing_yogurt', 'laitier', 'yogourt', 'yogurt', ['dairy'], ['yaourt', 'yogourt grec', 'yogourt nature'], ['yoghurt', 'greek yogurt', 'plain yogurt']),
  ing('ing_parmesan', 'laitier', 'parmesan', 'parmesan', ['dairy'], ['parmigiano reggiano', 'parmesan râpé', 'grana padano'], ['parmigiano-reggiano', 'grated parmesan', 'grana padano']),
  ing('ing_feta', 'laitier', 'feta', 'feta', ['dairy'], ['fromage feta'], ['feta cheese']),
  ing('ing_egg', 'oeuf', 'œuf', 'egg', ['egg'], ['oeuf', 'œufs', 'oeufs', 'gros œufs', 'gros oeufs'], ['eggs', 'large eggs', 'large egg']),
  ing('ing_ap_flour', 'feculent', 'farine tout usage (blé)', 'all-purpose flour (wheat)', ['gluten'], ['farine', 'farine tout usage', 'farine blanche', 'farine de blé', 'farine T55'], ['flour', 'all-purpose flour', 'plain flour', 'ap flour']),
  ing('ing_sugar', 'sucre', 'sucre', 'sugar', [], ['sucre blanc', 'sucre granulé', 'sucre semoule'], ['white sugar', 'granulated sugar', 'caster sugar']),
  ing('ing_brown_sugar', 'sucre', 'cassonade', 'brown sugar', [], ['sucre brun', 'sucre roux'], ['light brown sugar', 'dark brown sugar']),
  ing('ing_honey', 'sucre', 'miel', 'honey', ['honey'], [], []),
  ing('ing_rice', 'feculent', 'riz', 'rice', [], ['riz basmati', 'riz jasmin', 'riz à grain long', 'riz arborio'], ['basmati rice', 'jasmine rice', 'long-grain rice', 'arborio rice']),
  ing('ing_potato', 'legume', 'pomme de terre', 'potato', [], ['pommes de terre', 'patates', 'pommes de terre grelots'], ['potatoes', 'baby potatoes', 'yukon gold potatoes']),
  ing('ing_carrot', 'legume', 'carotte', 'carrot', [], ['carottes'], ['carrots']),
  ing('ing_leek', 'legume', 'poireau', 'leek', [], ['poireaux', 'blanc de poireau'], ['leeks']),
  ing('ing_celery', 'legume', 'céleri', 'celery', [], ['celeri', 'branches de céleri', 'céleri-branche'], ['celery stalks', 'celery sticks']),
  ing('ing_lettuce', 'legume', 'laitue', 'lettuce', [], ['laitue romaine', 'laitue frisée', 'laitue Boston', 'salade verte'], ['romaine lettuce', 'butter lettuce', 'salad greens']),
  ing('ing_arugula', 'legume', 'roquette', 'arugula', [], ['roquette sauvage'], ['rocket', 'rucola']),
  ing('ing_red_onion', 'legume', 'oignon rouge', 'red onion', [], ['oignons rouges'], ['red onions']),
  ing('ing_wine_vinegar', 'condiment', 'vinaigre de vin', 'wine vinegar', [], ['vinaigre de vin rouge', 'vinaigre de vin blanc', 'vinaigre'], ['red wine vinegar', 'white wine vinegar', 'vinegar']),
  ing('ing_mustard', 'condiment', 'moutarde', 'mustard', [], ['moutarde de Dijon', 'moutarde forte'], ['dijon mustard', 'whole-grain mustard']),
  ing('ing_mint', 'herbe', 'menthe', 'mint', [], ['menthe fraîche', 'feuilles de menthe'], ['fresh mint', 'mint leaves']),
  ing('ing_dill', 'herbe', 'aneth', 'dill', [], ['aneth frais'], ['fresh dill']),
  ing('ing_water', 'liquide', 'eau', 'water', [], ['eau froide', 'eau tiède', 'eau bouillante'], ['cold water', 'warm water', 'boiling water']),
  ing('ing_chicken_stock', 'liquide', 'bouillon de poulet', 'chicken stock', ['meat'], ['bouillon de volaille', 'fond de volaille', 'bouillon'], ['chicken broth', 'stock', 'broth']),
  ing('ing_vegetable_stock', 'liquide', 'bouillon de légumes', 'vegetable stock', [], ['fond de légumes'], ['vegetable broth']),
  ing('ing_white_wine', 'alcool', 'vin blanc', 'white wine', ['alcohol'], ['vin blanc sec'], ['dry white wine']),
  ing('ing_soy_sauce', 'condiment', 'sauce soya', 'soy sauce', ['gluten'], ['sauce soja', 'shoyu'], ['soya sauce', 'shoyu']),
  ing('ing_cinnamon', 'epice', 'cannelle', 'cinnamon', [], ['cannelle moulue', 'bâton de cannelle'], ['ground cinnamon', 'cinnamon stick']),
  ing('ing_baking_powder', 'levure', 'poudre à pâte', 'baking powder', null, ['levure chimique'], []),
  ing('ing_baking_soda', 'levure', 'bicarbonate de soude', 'baking soda', [], ['bicarbonate', 'bicarbonate de sodium'], ['bicarbonate of soda']),
  ing('ing_oats', 'cereale', 'avoine', 'oats', null, ['flocons d’avoine', "flocons d'avoine", 'gruau'], ['rolled oats', 'oatmeal']),
  ing('ing_lentils', 'legumineuse', 'lentilles', 'lentils', [], ['lentilles vertes', 'lentilles du Puy', 'lentilles corail'], ['green lentils', 'red lentils', 'puy lentils']),
  ing('ing_chickpeas', 'legumineuse', 'pois chiches', 'chickpeas', [], ['pois chiche'], ['garbanzo beans']),
  ing('ing_cherries', 'fruit', 'cerises', 'cherries', [], ['cerise', 'cerises fraîches', 'griottes'], ['cherry', 'fresh cherries', 'sour cherries']),
];

export const DIET_RULES = {
  sans_gluten: { blocked: ['gluten'] },
  vegetarien: { blocked: ['meat', 'fish', 'pork'] },
  vegetalien: { blocked: ['meat', 'fish', 'pork', 'dairy', 'egg', 'honey'] },
  sans_lactose: { blocked: ['dairy'] },
  sans_noix: { blocked: ['nuts'] },
  sans_oeufs: { blocked: ['egg'] },
  sans_fruits_de_mer: { blocked: ['fish', 'shellfish'] },
  sans_porc: { blocked: ['pork'] },
  sans_alcool: { blocked: ['alcohol'] },
};

export const CONTAINS_CATEGORIES = ['gluten', 'dairy', 'egg', 'nuts', 'fish', 'shellfish', 'meat', 'pork', 'alcohol', 'honey', 'soy', 'sesame'];

// Appareils d'exemple proposés à la création du registre (spec §5). Aucun n'est créé sans action de l'utilisateur.
export const APPLIANCE_PRESETS = [
  { name: 'Thermomix TM7', brand: 'Vorwerk', model: 'TM7', capabilities: ['weigh', 'chop', 'blend', 'emulsify', 'steam', 'slow_cook', 'sous_vide', 'controlled_heating', 'knead'] },
  { name: 'Circulateur sous vide', brand: 'Anova', model: '', capabilities: ['sous_vide', 'controlled_heating'] },
  { name: 'Scelleuse sous vide', brand: '', model: '', capabilities: ['vacuum_seal'] },
  { name: 'Four (convection)', brand: '', model: '', capabilities: ['bake', 'convection', 'broil'] },
  { name: 'Cuisinière au gaz', brand: '', model: '', capabilities: ['boil', 'simmer', 'fry', 'stir_fry'] },
  { name: 'BBQ au charbon', brand: '', model: '', capabilities: ['grill', 'smoke'] },
  { name: 'Wok', brand: '', model: '', capabilities: ['stir_fry', 'fry', 'steam'] },
  { name: 'Cuiseur à riz', brand: '', model: '', capabilities: ['rice_cook', 'steam'] },
  { name: 'Mélangeur', brand: '', model: '', capabilities: ['blend', 'emulsify'] },
  { name: 'Robot culinaire', brand: '', model: '', capabilities: ['chop', 'blend', 'knead'] },
  { name: 'Friteuse à air', brand: '', model: '', capabilities: ['air_fry', 'bake'] },
  { name: 'Fumoir', brand: '', model: '', capabilities: ['smoke', 'slow_cook'] },
];
