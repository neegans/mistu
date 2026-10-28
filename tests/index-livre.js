// Tests du lot I1 « index fiable » (spec docs/superpowers/specs/2026-10-28-index-fiable-design.md, rév. 2). Fonctions pures sur des fixtures fixes ;
// la fixture TRINITY est transcrite À LA MAIN d'après les photos de Neegan des pages d'index 310, 311 et 312 de « Trinity: The Cookbook » (Adam
// Byatt), telle qu'une lecture par page la rendrait (format compact de D-I3). Aucun réseau ; chaque assertion dit ce qu'elle protège.

// --- Fixture : une entrée = [titre, renvois imprimés, rubrique, sorte, incertain] ; R() pose la rubrique sur un groupe ; T() une entrée de premier niveau.
const R = (rubrique, lignes) => lignes.map(([titre, renvois]) => [titre, renvois, rubrique, 'recette', false]);
const T = (titre, renvois) => [[titre, renvois, null, 'recette', false]];
const A = (titre, renvois) => [[titre, renvois, null, 'autre', false]];
const BROCCOLI = 'charred purple sprouting broccoli, toasted hazelnuts and anchovy dressing';
const BASS = 'steamed fillet of sea bass, English asparagus, caviar and beurre blanc';
const SALMON = 'semi-smoked salmon, beurre blanc, dulse, roe and pickled cucumber';
const TURBOT = 'steamed turbot, courgette flower and fig leaf velouté';
const PORK = 'roast rack of pork, steamed hispi cabbage, bramley apple sauce';
const TARTARE = 'beef tartare, pickled mushrooms, bone marrow and Oscietra caviar';
const SHORTRIB = 'slow-cooked short rib, pommes duchesse and smoked bone marrow sauce';
const CHOUX = 'choux à la crème, hazelnuts and cacao sorbet';
const RASP = 'raspberry tartlets, blackcurrant leaf crème mousseline';
const P310 = { page_imprimee: 310, sorte_page: 'index', suite_rubrique: false, incertain: [], entrees: [
  ...R('almonds', [['brown butter financiers', '62']]),
  ...R('anchovies', [[BROCCOLI, '126'], ['devilled egg gougères', '41'], ['pissaladière', '74']]),
  ...R('apples', [['crispy pig’s head with condiments', '124'], [PORK, '144–6'], ['tarte tatin', '284–8']]),
  ...R('Armagnac', [['Tête de Moine cheese with Armagnac prunes', '304']]),
  ...R('asparagus', [['roast chicken and pommes purée', '116–19'], [BASS, '94'], ['vol-au-vent of English asparagus, sauce divine', '158']]),
  ...R('avocados', [['prawn cocktail', '294']]),
  ...R('bacon', [['veal sweetbreads en crépinette with petits pois à la Française', '206–8']]),
  ...T('baguettes', '28–9'), ...T('balsamic-braised lamb shoulder', '219'),
  ...R('basil', [['lobster and tomato salad, elderflower, melon and basil', '112'], ['sardine bolognese dumpling', '192–5'], [TURBOT, '90–1']]),
  ...R('bee pollen', [['milk and honey', '48–50']]),
  ...R('beef', [[TARTARE, '200–2'], ['sirloin steak on the bone with chimichurri', '203'], [SHORTRIB, '276–8']]),
  ...R('beeswax', [['beeswax madeleines', '58–9'], ['canelés', '44']]),
  ...R('beurre blanc', [[SALMON, '110'], [BASS, '94']]),
  ...R('blackcurrant leaves', [[RASP, '56–7']]),
  ...R('blanquette sauce', [['blanquette of rabbit, prunes and pilaf rice', '138–9'], ['poached leg of mutton with blanquette sauce', '153–4']]),
  ...R('bone marrow', [[TARTARE, '200–2'], [SHORTRIB, '276–8']]),
  ...R('bread', [['baguettes', '28–9'], ['re-formed Trinity bread', '27'], ['Trinity bread', '24–6']]),
  ...R('broad beans', [['lamb double cutlet farci, broad beans and feta', '196–7']]),
  ...R('broccoli', [[BROCCOLI, '126']]),
  ...R('butter', [['scallop-stuffed courgette flower with tomato butter sauce', '108'], [SALMON, '110'], [BASS, '94']]),
  ...A('Byatt, Vicki', '36–8, 98, 100'),
  ...R('cabbage', [[PORK, '144–6']]),
  ...R('cacao beans', [['raw cacao sorbet', '239']]),
  ...R('cacio e pepe', [['salt-baked celeriac, cacio e pepe', '252–4']]),
  ...R('cakes', [['beeswax madeleines', '58–9'], ['brown butter financiers', '62'], ['canelés', '44'], ['milk and honey', '48–50'], ['plum savarins', '225–6']]),
  ...A('Camilla, Princess of Wales', '98–101'),
  ...R('canapés', [['Comté and truffle gougères', '41'], ['devilled egg gougères', '41'], ['gougères', '40'], ['pumpkin or squash gougères', '41'], ['radishes and roe', '72–3']]),
  ...T('canelés', '44'),
  ...R('cauliflower', [['Dover sole bonne femme', '222–4']]),
  ...R('caviar', [[TARTARE, '200–2'], [BASS, '94']]),
  ...R('celeriac', [['crispy pig’s head with condiments', '124'], ['duck galantine and wild mushroom charlotte', '267–9'], ['roast pigeon, spiced pear, salsify and walnut', '214–17'], ['saddle of hare and celeriac purée', '274'], ['salt-baked celeriac, cacio e pepe', '252–4']]),
] };
const P311 = { page_imprimee: 311, sorte_page: 'index', suite_rubrique: true, incertain: [], entrees: [
  ...[['scallop crudo, hazelnut and pear', '96'], ['tarte fine of quince', '60'], ['chamomile soft-serve ice cream', '130']].map(([t, r]) => [t, r, '^', 'recette', false]),
  ...R('Champagne', [['leeks vinaigrette', '92'], ['oysters, salsify and chives', '262'], [RASP, '56–7'], [TURBOT, '90–1']]),
  ...R('Champagne vinegar', [['leeks vinaigrette', '92'], [SALMON, '110']]),
  ...R('Chardonnay vinegar', [[SALMON, '110']]),
  ...A('Charles, Prince of Wales', '98–101'),
  ...R('chicken', [['chicken vin jaune', '150–2'], ['consommé dôme d’or', '180–3'], ['duck galantine and wild mushroom charlotte', '267–9'], ['roast chicken and pommes purée', '116–19']]),
  ...R('chickpeas', [['braised octopus with spiced hummus', '258'], ['pumpkin hummus, sage and olive oil', '80']]),
  ...R('chillies', [['cured sea bass, blood orange, chilli and olive oil', '34']]),
  ...R('chimichurri', [['sirloin steak on the bone with chimichurri', '203']]),
  ...R('chives', [['leeks vinaigrette', '92'], ['oysters, salsify and chives', '262']]),
  ...R('chocolate', [['chocolate cremosa, extra virgin olive oil and sea salt', '232–3'], ['chocolate hot pots', '168'], ['chocolate tart', '234'], [CHOUX, '236–8'], ['gâteau opéra', '163–6'], ['Rosie’s chocolate mousse', '51–2']]),
  ...R('choux pastry', [[CHOUX, '40–1']]),
  ...R('cocktails', [['The Trinity', '306']]),
  ...R('Coco de Paimpol beans', [['turbot with coco beans and tomato leaves', '187–90']]),
  ...R('coconut milk', [['curried monkfish', '260']]),
  ...R('cod', [['pot-braised cod, summer sauce and frisseline', '86–7']]),
  ...R('coffee', [['gâteau opéra', '163–6'], ['Saverio’s tiramisu', '228']]),
  ...T('Comté and truffle gougères', '41'),
  ...R('courgettes', [['curried crab and courgette tartlet', '82–3'], [TURBOT, '90–1']]),
  ...R('crab', [['crab raviolo, dulse and crab bisque', '184–6'], ['curried crab and courgette tartlet', '82–3']]),
  ...R('cream', [['chicken vin jaune', '150–2'], ['honey soufflé', '128–9'], ['peaches and cream', '46'], ['roast chicken and pommes purée', '116–19'], ['smoked eel, Jersey royals, salad cream', '84'], ['trifle', '160–2']]),
  ...R('crème fraîche', [['gin-cured salmon', '76'], ['Gratte-Paille cheesecake', '230'], ['smoked salmon and garnishes', '30–2']]),
  ...R('custard', [['salt caramel custard tart', '282'], ['trifle', '160–2']]),
  ...T('Dauphinoise potatoes', '156'),
  ...R('desserts', [['chamomile soft-serve ice cream', '130']]),
] };
const P312 = { page_imprimee: 312, sorte_page: 'index', suite_rubrique: true, incertain: [], entrees: [
  ...[['chocolate cremosa, extra virgin olive oil and sea salt', '232–3'], ['chocolate hot pots', '168'], [CHOUX, '236–8'], ['gâteau opéra', '163–6'], ['plum savarins', '225–6'], ['raw cacao sorbet', '239'], ['Trinity mince pies', '300–1']].map(([t, r]) => [t, r, '^', 'recette', false]),
  ...T('devilled egg gougères', '41'), ...T('Dover sole bonne femme', '222–4'),
  ...R('dried fruit', [['malt loaf and dried figs', '302'], ['Trinity mince pies', '300–1']]),
  ...R('dulse', [['crab raviolo, dulse and crab bisque', '184–6'], [SALMON, '110']]),
  ...R('eggs', [['devilled egg gougères', '41'], ['Gratte-Paille cheesecake', '230']]),
  ...A('equipment', '123'),
  ...R('fennel', [['red mullet in orzo', '256']]),
  ...R('focaccia', [['re-formed Trinity bread', '27']]),
  ...T('gâteau opéra', '163–6'),
  ...R('globe artichokes', [['artichoke barigoule salad', '178']]),
  ...T('gougères', '40–1'),
  ...R('hazelnuts', [[BROCCOLI, '126'], [CHOUX, '236–8'], ['scallop crudo, hazelnut and pear', '96']]),
  ...T('honey soufflé', '128–9'), ...T('John Dory with coq au vin sauce', '250'),
] };
const pageLue = (p, id) => ({ page_id: id, etat: 'lue', ...p, entrees: p.entrees.map(([titre, renvois, rubrique, sorte, incertain]) => (rubrique === '^' ? { titre, renvois, rubrique: null, sorte, incertain, suite: true } : { titre, renvois, rubrique, sorte, incertain })) });
export const TRINITY = [pageLue(P310, 'pg310'), pageLue(P311, 'pg311'), pageLue(P312, 'pg312')];

export async function runIndexLivreTests({ eq, ok }) {
  let M;
  try { M = await import('../src/domain/index-livre.js'); }
  catch (e) { ok(false, `index-livre : module illisible — ${e?.message || e}`); return; }
  const bloc = async (nom, f) => { try { await f(); } catch (error) { ok(false, `Index — bloc « ${nom} » interrompu : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); } };

  await bloc('renvois imprimés (§ 4)', async () => {
    const r = (s) => M.renvoisDe(s).plages.map(M.textePlage).join(', ');
    eq(['94', '24–6', '116–19', '187–90', '200–2', '98–101', '279–80', '300–1', '114–15, 213', '36–8, 98, 100', '12-3', '214–17', '51 — 2', 41].map(r),
      ['94', '24–26', '116–119', '187–190', '200–202', '98–101', '279–280', '300–301', '114–115, 213', '36–38, 98, 100', '12–13', '214–217', '51–52', '41'],
      'renvoisDe : plages abrégées développées (116–19 → 116–119), renvois multiples, tirets variés, nombre JSON — la table du document de Neegan');
    eq(['', '41 (variante)', '10000', '5–60', 'xii', '1, 2, 3, 4, 5, 6, 7, 8, 9'].map((s) => [M.renvoisDe(s).incertain, M.renvoisDe(s).plages.length]),
      [[true, 0], [true, 0], [true, 0], [true, 0], [true, 0], [true, 0]], 'renvoisDe : vide, morceau non numérique, page > 9 999, plage de plus de 40 pages, chiffres romains, plus de 8 renvois → incertain, aucune plage (rien d’inventé)');
    eq([M.renvoisDe('116–19').incertain, M.renvoisDe('41, x').plages.map(M.textePlage)], [false, ['41']], 'renvoisDe : une plage lisible n’est pas incertaine ; un morceau illisible ne jette pas les autres');
  });

  await bloc('réponse hostile (I-I4)', async () => {
    let raison = null;
    try { M.validerPageIndex([]); } catch (e) { raison = e?.raison; }
    eq(raison, 'illisible', 'validerPageIndex : un tableau à la place de l’objet → illisible');
    raison = null; try { M.validerPageIndex({ sorte_page: 'index' }); } catch (e) { raison = e?.raison; }
    eq(raison, 'illisible', 'validerPageIndex : sans « entrees » → illisible');
    raison = null; try { M.validerPageIndex({ entrees: Array.from({ length: 601 }, () => ['x', '1', null, 'recette', false]) }); } catch (e) { raison = e?.raison; }
    eq(raison, 'hors_bornes', 'validerPageIndex : plus de 600 entrées → hors_bornes');
    const v = M.validerPageIndex({ sorte_page: 'index', page_imprimee: 310, suite_rubrique: true, incertain: ['photo floue', 'voir https://evil.test/x'], entrees: [
      ['Tarte tatin', '284–8', 'apples', 'recette', false], ['clique https://evil.test/a', '12', null, 'recette', false], ['x'.repeat(201), '12', null, 'recette', false],
      'pas un tableau', ['seul'], ['Pain', 24, 'r'.repeat(121), 'plat', false], ['Byatt, Vicki', '36–8', null, 'autre', true], ['trifle', '160–2', '^', 'recette', false],
    ] });
    eq([v.sorte_page, v.page_imprimee, v.suite_rubrique && v.entrees[3].suite === true && v.entrees[0].suite === undefined, v.entrees.map((e) => [e.titre, e.renvois, e.rubrique, e.sorte, e.incertain]), v.ecartees, v.incertain],
      ['index', 310, true, [['Tarte tatin', '284–8', 'apples', 'recette', false], ['Pain', '24', null, 'recette', true], ['Byatt, Vicki', '36–8', null, 'autre', true], ['trifle', '160–2', null, 'recette', false]], { adresse: 1, longueur: 1, forme: 2 }, ['photo floue']],
      'validerPageIndex : titre à adresse et titre de 201 caractères écartés et COMPTÉS (jamais tronqués) ; entrées mal formées comptées ; rubrique trop longue → null + incertain ; sorte inconnue → recette + incertain ; renvoi nombre → texte ; « ^ » marque une entrée qui continue une rubrique (champ suite, jamais le champ suite_rubrique reçu) ; incertitude à adresse retirée');
    eq([M.validerPageIndex({ sorte_page: 'roman', page_imprimee: 'x', entrees: [] }).sorte_page, M.validerPageIndex({ page_imprimee: 0, entrees: [] }).page_imprimee], [null, null], 'validerPageIndex : sorte de page hors liste → null ; page imprimée illisible ou 0 → null');
  });

  await bloc('rubriques raccordées (D-I8, D-I2)', async () => {
    const lues = M.raccorderRubriques(TRINITY);
    const tete312 = lues[2].entrees.slice(0, 7).map((e) => [e.rubrique, e.rubriqueDeduite === true]);
    eq(tete312.every(([r, d]) => r === 'desserts' && d), true, '312 commence sous « desserts », ouverte au bas de 311 : ses sept entrées de tête reçoivent « desserts » (déduite)');
    eq(lues[1].entrees.slice(0, 3).map((e) => e.rubrique), ['celeriac', 'celeriac', 'celeriac'], '311 commence sous la dernière rubrique de 310 (celeriac)');
    eq(lues[2].entrees.slice(7).every((e) => !e.rubriqueDeduite), true, 'seules les entrées de TÊTE sans rubrique sont raccordées (une entrée de premier niveau plus loin reste sans rubrique)');
    const melangees = M.raccorderRubriques([TRINITY[2], TRINITY[0], TRINITY[1]]);
    eq(melangees[0].entrees[0].rubrique, 'desserts', 'l’ordre de capture ne compte pas : 312 lue avant 311 reçoit quand même « desserts »');
    const sans311 = M.raccorderRubriques([TRINITY[0], TRINITY[2]]);
    eq([sans311[1].entrees[0].rubrique, sans311[1].entrees[0].rubriqueInconnue === true], [null, true], 'sans la page 311, les entrées de tête de 312 gardent une rubrique INCONNUE (jamais la dernière vue ailleurs)');
    const g = { sorte_page: 'index', page_imprimee: 311, suite_rubrique: false, incertain: [], ecartees: { adresse: 0, longueur: 0, forme: 0 }, entrees: [{ titre: 'gin-cured salmon', renvois: '76', rubrique: 'crème fraîche', sorte: 'recette', incertain: false }, { titre: 'trifle', renvois: '160–2', rubrique: 'custard', sorte: 'recette', incertain: false }] };
    const d = { sorte_page: 'index', page_imprimee: null, suite_rubrique: true, incertain: [], ecartees: { adresse: 0, longueur: 1, forme: 0 }, entrees: [{ titre: 'trifle', renvois: '160–2', rubrique: null, sorte: 'recette', incertain: false, suite: true }, { titre: 'salt caramel custard tart', renvois: '282', rubrique: null, sorte: 'recette', incertain: false, suite: true }, { titre: 'peaches and cream', renvois: '46', rubrique: 'desserts', sorte: 'recette', incertain: false }] };
    const f = M.fusionnerMoities(g, d);
    eq([f.page_imprimee, f.entrees.map((e) => `${e.titre}|${e.rubrique}`), f.ecartees.longueur], [311, ['gin-cured salmon|crème fraîche', 'trifle|custard', 'salt caramel custard tart|custard', 'peaches and cream|desserts'], 1],
      'deux moitiés → une page : la droite raccordée à la dernière rubrique de la gauche ; le doublon du chevauchement (trifle sous custard) réuni ; numéro et écartées gardés');
  });

  await bloc('consolider Trinity (D-I5, D-I6, D-I7, D-I4)', async () => {
    const c = M.consolider(TRINITY);
    const titre = (t) => c.certaines.find((x) => x.titre === t);
    const poulet = titre('roast chicken and pommes purée');
    eq([c.certaines.filter((x) => x.titre === 'roast chicken and pommes purée').length, poulet && M.textePlages(poulet.plages), poulet?.rubriques, poulet?.sources.length],
      [1, '116–119', ['asparagus', 'chicken', 'cream'], 3], 'le poulet cité sous asparagus (310), chicken et cream (311) → UNE référence, 116–119, trois rubriques, trois sources');
    eq(['Comté and truffle gougères', 'devilled egg gougères', 'pumpkin or squash gougères', 'gougères'].map((t) => titre(t) && M.textePlages(titre(t).plages)), ['41', '41', '41', '40–41'],
      'les trois gougères de la page 41 restent trois références ; « gougères » (40 sous canapés, 40–1 au premier niveau) en fait une, 40–41 (la plus longue)');
    const choux = c.aVerifier.find((x) => x.titre === 'choux à la crème, hazelnuts and cacao sorbet');
    eq([!!choux, choux?.raison, choux?.options.map((o) => [M.textePlages(o.plages), o.occurrences]), c.certaines.some((x) => x.titre === 'choux à la crème, hazelnuts and cacao sorbet')],
      [true, 'contradiction', [['236–238', 3], ['40–41', 1]], false], 'les choux : 236–8 (chocolate 311, desserts et hazelnuts 312) contre 40–1 (choux pastry 311) → « À vérifier », les DEUX montrées, aucune enregistrée d’office');
    eq(c.ecartees.map((e) => e.titre).sort(), ['Byatt, Vicki', 'Camilla, Princess of Wales', 'Charles, Prince of Wales', 'equipment'].sort(), 'personnes et matériel écartés, jamais des recettes (et gardés à part)');
    const pages = c.certaines.map((x) => x.plages[0].debut);
    eq([pages.every((p, i) => i === 0 || pages[i - 1] <= p), c.certaines.slice(0, 6).map((x) => `${M.textePlages(x.plages)} ${x.titre}`)],
      [true, ['24–26 Trinity bread', '27 re-formed Trinity bread', '28–29 baguettes', '30–32 smoked salmon and garnishes', '34 cured sea bass, blood orange, chilli and olive oil', '40–41 gougères']],
      'trié par première page (nombre), puis par titre : le début de la liste attendue par Neegan (24–26, 27, 28–29, 30–32, 34)');
    const cles = c.certaines.map((x) => x.cle);
    eq([new Set(cles).size === cles.length, c.certaines.every((x) => x.plages.length > 0), c.chapitres, c.dejaDans], [true, true, [], []], 'aucune recette deux fois ; chaque référence certaine a ses pages ; aucune page de chapitres ; rien de déjà dans le livre');
    const melange = M.consolider([TRINITY[2], TRINITY[0], TRINITY[1]]);
    eq(melange.certaines.map((x) => x.cle), c.certaines.map((x) => x.cle), 'ordre de capture mélangé (312, 310, 311) → la même liste');
    const avecChoux = M.consolider(TRINITY, { existantes: [{ id: 'rc_choux', original_title: 'Choux à la crème, hazelnuts and cacao sorbet', availability: 'reference_only', printed_page: 236, printed_pages: [{ debut: 236, fin: 238 }] }] });
    const chouxBis = avecChoux.aVerifier.find((x) => x.titre === CHOUX);
    eq([chouxBis?.raison, chouxBis?.options.map((o) => [M.textePlages(o.plages), o.existanteId ?? null])], ['contradiction', [['236–238', 'rc_choux'], ['40–41', null]]],
      'une contradiction dont une page est déjà dans le livre : l’option existante porte son existanteId (l’écran ne la recrée jamais)');
    const desserts = titre('raw cacao sorbet');
    eq(desserts?.rubriques, ['cacao beans', 'desserts'], 'une entrée de tête de 312 porte la rubrique raccordée « desserts » (en plus de cacao beans, 310)');
  });

  await bloc('table, index, les deux ; chapitres ; déjà dans le livre ; modèle (rév. 2)', async () => {
    const table = { page_id: 'tdm1', etat: 'lue', sorte_page: 'table', page_imprimee: 5, suite_rubrique: false, entrees: [
      { titre: 'Trinity Bread', renvois: '24', rubrique: 'Breads', sorte: 'recette', incertain: false }, { titre: 'Baguettes', renvois: '28', rubrique: 'Breads', sorte: 'recette', incertain: false },
      { titre: 'Canelés', renvois: '44', rubrique: 'Pastry', sorte: 'recette', incertain: false }] };
    const seule = M.consolider([table]);
    eq(seule.certaines.map((x) => [x.titre, M.textePlages(x.plages), x.section, x.rubriques]), [['Trinity Bread', '24', 'Breads', []], ['Baguettes', '28', 'Breads', []], ['Canelés', '44', 'Pastry', []]],
      'table des matières seule : une référence par ligne, la partie en section (pas en rubrique d’ingrédient), triée par page');
    const deux = M.consolider([table, ...TRINITY]);
    const pain = deux.certaines.find((x) => x.cle === M.cleTitre('Trinity bread'));
    eq([deux.certaines.filter((x) => x.cle === M.cleTitre('Trinity bread')).length, pain && M.textePlages(pain.plages), pain?.section, pain?.rubriques],
      [1, '24–26', 'Breads', ['bread']], 'table + index : une recette des deux sources = UNE référence, la plage la plus longue (24–26), la partie de la table ET la rubrique de l’index');
    const chap = { page_id: 'chap', etat: 'lue', sorte_page: 'chapitres', page_imprimee: 3, suite_rubrique: false, entrees: [{ titre: 'Breads', renvois: '20', rubrique: null, sorte: 'recette', incertain: false }] };
    const c2 = M.consolider([chap]);
    eq([c2.chapitres, c2.certaines.length, c2.aVerifier.length], [['chap'], 0, 0], 'une page de chapitres seulement : aucune référence, la page dite (D-I17)');
    // Une photo qui n'est ni une table ni un index (une page de recette, un portrait) : ses entrées éventuelles ne deviennent jamais des références.
    const autreP = { page_id: 'px', etat: 'lue', sorte_page: 'autre', page_imprimee: 55, suite_rubrique: false, entrees: [{ titre: 'Tarte fine', renvois: '55', rubrique: null, sorte: 'recette', incertain: false }] };
    const cAutre = M.consolider([autreP]);
    eq([cAutre.certaines.length, cAutre.aVerifier.length, cAutre.ecartees.length, cAutre.chapitres], [0, 0, 0, []], 'une page « autre » : rien n’entre dans la liste du livre, ni certaine, ni à vérifier, ni écartée');
    const existantes = [{ id: 'rx1', original_title: 'Trinity bread', printed_page: 24, availability: 'reference_only', index_rubriques: [] }, { id: 'rx2', original_title: 'Baguettes', printed_page: 30, availability: 'reference_only' }];
    const c3 = M.consolider(TRINITY, { existantes });
    const deja = c3.dejaDans.find((x) => x.existanteId === 'rx1');
    eq([!!deja, deja?.plageAllongee, deja?.rubriquesNeuves, c3.certaines.some((x) => x.cle === M.cleTitre('Trinity bread'))], [true, true, ['bread'], false],
      'déjà dans le livre à la même page : rien de recréé ; la plage s’allonge (24 → 24–26) et la rubrique neuve est proposée');
    const bag = c3.aVerifier.find((x) => x.cle === M.cleTitre('baguettes'));
    eq([bag?.raison, bag?.options.map((o) => [M.textePlages(o.plages), o.existanteId ?? null])], ['contradiction_existante', [['28–29', null], ['30', 'rx2']]],
      'même titre déjà dans le livre à une AUTRE page : « À vérifier », les deux pages montrées (jamais une seconde référence d’office)');
    const c4 = M.consolider(TRINITY, { modeleValide: false });
    eq([c4.certaines.length, c4.aVerifier.filter((x) => x.raison === 'modele').length > 50], [0, true], 'lue par un modèle hors liste : RIEN d’enregistrable d’office, tout va « À vérifier » (D-I16)');
    const inconnue = M.consolider([{ page_id: 'p', etat: 'lue', sorte_page: 'index', page_imprimee: 1, entrees: [{ titre: 'Tarte', renvois: '', rubrique: null, sorte: 'recette', incertain: true }, { titre: 'Flan', renvois: '12', rubrique: null, sorte: 'recette', incertain: true }] }]);
    eq(inconnue.aVerifier.map((x) => [x.titre, x.raison]), [['Flan', 'incertain'], ['Tarte', 'page_inconnue']], 'page illisible → « À vérifier » à la fin (jamais 0) ; une entrée que toutes ses occurrences disent incertaine → « À vérifier »');
    eq(M.consolider([{ ...TRINITY[0], etat: 'echec' }]).certaines.length, 0, 'une page en échec ne compte pas');
  });

  await bloc('écrire (D-I19, D-I10, D-I20)', async () => {
    let n = 0; const newId = (p) => `${p}_${++n}`;
    const c = M.consolider(TRINITY);
    const poulet = c.certaines.find((x) => x.titre === 'roast chicken and pommes purée');
    const f = M.fabriquerReferenceIndex(poulet, { edition: { id: 'ed1', language: 'en' }, newId, importId: 'imp1' });
    eq([f.original_title, f.availability, f.printed_page, f.printed_pages, f.index_rubriques, f.edition_id, f.index_import_id, f.raw_entry, f.source_page_ids, f.index_page_id, f.verification_state],
      ['Roast chicken and pommes purée', 'reference_only', 116, [{ debut: 116, fin: 119 }], ['asparagus', 'chicken', 'cream'], 'ed1', 'imp1', 'roast chicken and pommes purée — 116–19', ['pg310', 'pg311'], 'pg310', 'unverified'],
      'fabriquerReferenceIndex : titre du livre, première lettre en capitale ; « À importer » ; première page + plages ; rubriques ; l’entrée imprimée gardée ; sa lecture nommée');
    eq([M.titreEnregistre('re-formed Trinity bread'), M.titreEnregistre('élan de mer'), M.titreEnregistre('  The Trinity ')], ['Re-formed Trinity bread', 'Élan de mer', 'The Trinity'], 'titreEnregistre : seule la première lettre change');
    eq(M.completerExistante({ availability: 'reference_only', index_rubriques: ['bread'], printed_page: 24 }, { rubriquesNeuves: ['bread', 'sourdough'], plageAllongee: true, plages: [{ debut: 24, fin: 26 }] }),
      { index_rubriques: ['bread', 'sourdough'], printed_pages: [{ debut: 24, fin: 26 }] }, 'completerExistante : union des rubriques (sans doublon) et plage allongée');
    eq([M.completerExistante({ availability: 'available' }, { rubriquesNeuves: ['x'] }), M.completerExistante({ availability: 'reference_only', index_rubriques: ['x'] }, { rubriquesNeuves: ['X'], plageAllongee: false })], [null, null],
      'completerExistante : une recette importée n’est jamais touchée ; rien de neuf → null');
    const intacte = { index_import_id: 'imp1', availability: 'reference_only', current_version_id: null, favorite: false, created_at: 'a', updated_at: 'a' };
    eq([M.referenceIntacte(intacte, 'imp1'), M.referenceIntacte({ ...intacte, updated_at: 'b' }, 'imp1'), M.referenceIntacte({ ...intacte, favorite: true }, 'imp1'), M.referenceIntacte(intacte, 'imp2'), M.referenceIntacte({ ...intacte, current_version_id: 'v' }, 'imp1')],
      [true, false, false, false, false], 'referenceIntacte (D-I20) : seulement de CETTE lecture, jamais modifiée, sans favori ni version');
  });
}
