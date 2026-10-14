// Tests du lot « page Ajouter et flux des livres » (spec docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md).
// Modèles purs et rendus DOM à gestes injectés ; bases jetables seulement ; aucun réseau ; aucun history.* réel.
export async function runAjouterTests({ eq, ok }) {
  // --- § 7 Puces « Cuisines »
  const { normaliser, capitaliser, GRAINE_CUISINES, pucesModel, basculerPuce, ajouterPuce, cuisinesExistantes, renderPuces } = await import('../src/ui/puces.js');
  eq(normaliser('  Québécoise '), 'quebecoise', 'puces : normaliser = trim + minuscules + accents retirés');
  eq(capitaliser('italienne'), 'Italienne', 'puces : capitaliser la première lettre seulement');
  eq(capitaliser(''), '', 'puces : capitaliser une chaîne vide rend vide');
  eq(GRAINE_CUISINES, ['québécoise', 'autochtone', 'française', 'italienne', 'levantine', 'marocaine', 'mexicaine', 'indienne', 'chinoise', 'japonaise', 'thaïe', 'vietnamienne', 'grecque', 'espagnole', 'américaine'], 'puces : la graine fermée, en minuscules');
  {
    const m = pucesModel({ choisies: ['Italienne'], existantes: ['levantine', 'levantine', 'italienne', 'thaie'], graine: ['italienne', 'levantine', 'grecque'] });
    eq(m.puces.map((p) => p.valeur), ['Italienne', 'levantine', 'thaie', 'grecque'], 'puces : choisies d’abord, puis existantes par fréquence, puis la graine — la jumelle de graine d’une valeur existante est masquée');
    eq(m.puces.map((p) => p.choisie), [true, false, false, false], 'puces : seule la valeur choisie est marquée');
    eq(m.puces[0].libelle, 'Italienne', 'puces : le libellé affiché est capitalisé');
    eq(m.puces[2].cle, 'thaie', 'puces : la clé est la forme normalisée');
  }
  eq(basculerPuce(['a', 'b'], 'b'), ['a'], 'puces : basculer retire une valeur choisie');
  eq(basculerPuce(['a'], 'B'), ['a', 'B'], 'puces : basculer ajoute une valeur absente telle quelle');
  eq(ajouterPuce(['italienne'], ' Italienne '), ['italienne'], 'puces : un doublon par normalisation est refusé (même tableau)');
  eq(ajouterPuce(['italienne'], 'Thaïe'), ['italienne', 'thaïe'], 'puces : « Autre… » ajoute en minuscules, accents conservés');
  eq(ajouterPuce(['italienne'], '   '), ['italienne'], 'puces : le vide est ignoré');
  {
    const base = ['italienne'];
    ok(ajouterPuce(base, ' Italienne ') === base, 'puces : un refus par doublon rend le MÊME tableau (identité, pas copie)');
    ok(ajouterPuce(base, '  ') === base, 'puces : un refus par texte vide rend le MÊME tableau (identité, pas copie)');
    ok(ajouterPuce(base, 'thaïe') !== base, 'puces : un ajout accepté rend un tableau NEUF (jamais le même, pour que l’appelant re-rende)');
  }
  eq(cuisinesExistantes({ books: [{ cuisines: ['a', 'b'] }, {}], recipes: [{ cuisines: ['b'] }] }), ['a', 'b', 'b'], 'puces : existantes = toutes les occurrences des livres et des recettes (la fréquence compte)');
  {
    const appels = [];
    const m = pucesModel({ choisies: ['italienne'], existantes: [], graine: ['italienne', 'grecque'] });
    const noeud = renderPuces(m, { basculer: (v) => appels.push(['basculer', v]), ajouter: (v) => appels.push(['ajouter', v]) });
    const boutons = [...noeud.querySelectorAll('button.puce')];
    eq(boutons.map((b) => b.textContent), ['Italienne', 'Grecque'], 'puces : rendu dans l’ordre du modèle, libellés capitalisés');
    eq(boutons.map((b) => b.getAttribute('aria-pressed')), ['true', 'false'], 'puces : aria-pressed reflète le choix');
    boutons[1].click();
    const champ = noeud.querySelector('input[type="text"]');
    champ.value = 'Levantine';
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    eq(appels, [['basculer', 'grecque'], ['ajouter', 'Levantine']], 'puces : un clic bascule la VALEUR stockée, Entrée ajoute le texte tapé');
  }
  {
    const hostile = renderPuces(pucesModel({ choisies: ['<img src=x onerror="window.__p=1">'] }), {});
    eq(hostile.querySelectorAll('img').length, 0, 'puces : une valeur hostile ne crée aucun élément <img>');
    eq(window.__p, undefined, 'puces : aucun gestionnaire injecté ne s’exécute');
    ok([...hostile.querySelectorAll('button.puce')].some((b) => b.textContent.includes('<img')), 'puces : la valeur hostile reste du TEXTE affiché, pas du balisage');
  }

  // --- § 4 Grille et § 10 sélecteur avant scan
  const { grilleModel, GRILLE_ACTIONS, renderGrille, selecteurScanModel, renderSelecteurScan, parametresDeScan, ACCEPT_PHOTOS, ACCEPT_FICHIERS } = await import('../src/ui/add.js');
  const { libelleLivre, carte } = await import('../src/ui/components.js');
  eq(GRILLE_ACTIONS, ['ajouterLivre', 'pages', 'saisir', 'signet', 'congelateur'], 'grille : cinq gestes nommés, dans l’ordre des cartes');
  eq(grilleModel({}).cartes.map((c) => c.action), GRILLE_ACTIONS, 'grille : une carte par geste, même ordre');
  eq(grilleModel({}).cartes.map((c) => c.titre), ['Ajouter un livre', 'Photographier ou importer des pages', 'Saisir une recette', 'Garder un lien web', 'Ajouter un lot au congélateur'], 'grille : les cinq titres de la spec');
  {
    const appels = [];
    const gestes = Object.fromEntries(GRILLE_ACTIONS.map((a) => [a, () => appels.push(a)]));
    const noeud = renderGrille(grilleModel({}), gestes);
    const cartes = [...noeud.querySelectorAll('button.carte')];
    eq(cartes.length, 5, 'grille : cinq cartes rendues, aucun formulaire');
    eq(noeud.querySelectorAll('input, select, textarea').length, 0, 'grille : plus aucun champ de formulaire sur la page Ajouter');
    cartes[3].click(); cartes[0].click();
    eq(appels, ['signet', 'ajouterLivre'], 'grille : chaque carte appelle son geste');
    eq(renderGrille(grilleModel({}), { pages: () => {} }).querySelectorAll('button.carte').length, 1, 'grille : une carte sans geste câblé n’est pas rendue');
  }
  eq(libelleLivre({ year: 2019 }, { title: 'Mon livre', author: 'A. B.' }), 'Mon livre · A. B. · 2019', 'libelleLivre : titre · auteur · année');
  eq(libelleLivre({}, null), 'Sans titre', 'libelleLivre : sans livre → « Sans titre »');
  ok(carte('x', 'T', 'S', () => {}).classList.contains('carte'), 'carte : composant partagé');
  {
    const livres = [{ edition: { id: 'e1', year: 2019 }, book: { title: 'B', author: 'x' }, activite: 5 }, { edition: { id: 'e2' }, book: { title: 'A' }, activite: 0 }, { edition: { id: 'e3' }, book: { title: 'C' }, activite: 9 }];
    const m = selecteurScanModel({ livres, livreChoisi: '', genre: 'recette' });
    eq(m.options.map((o) => o.value), ['', 'e3', 'e1', 'e2'], 'sélecteur : « sans livre » d’abord, puis par activité décroissante, puis titre');
    eq(m.options[0].label, 'Recette indépendante (sans livre)', 'sélecteur : le défaut est nommé');
    eq(m.options[2].label, 'B · x · 2019', 'sélecteur : libellé = libelleLivre');
    eq([m.indexDisponible, m.messageIndex], [false, 'Un index appartient à un livre : choisis-le d’abord.'], 'sélecteur : sans livre, « Index » indisponible et la raison est dite');
    const m2 = selecteurScanModel({ livres, livreChoisi: 'e1', genre: 'index' });
    eq([m2.indexDisponible, m2.messageIndex, m2.genre], [true, null, 'index'], 'sélecteur : avec un livre, « Index » disponible');
    eq(selecteurScanModel({ livres, livreChoisi: '', genre: 'index' }).genre, 'recette', 'sélecteur : un genre « index » sans livre retombe sur « recette »');
    const m3 = selecteurScanModel({ livres, editionImposee: 'e2', livreChoisi: '', genre: 'recette' });
    eq([m3.livreImpose, m3.livreChoisi], [true, 'e2'], 'sélecteur : une édition imposée (?edition connu) fixe le livre');
    eq(selecteurScanModel({ livres, editionImposee: 'inconnue', livreChoisi: '', genre: 'recette' }).livreImpose, false, 'sélecteur : un ?edition inconnu est traité comme absent (S9)');
    const appels = [];
    const noeud = renderSelecteurScan(m, { changerLivre: (v) => appels.push(['livre', v]), changerGenre: (v) => appels.push(['genre', v]), photographier: () => appels.push(['photo']), choisir: () => appels.push(['choisir']), retour: () => appels.push(['retour']) });
    eq(noeud.querySelector('h2').textContent, 'Ces pages vont où ?', 'sélecteur : la première ligne dit le but');
    const radios = [...noeud.querySelectorAll('input[type="radio"]')];
    eq(radios.map((r) => [r.value, r.disabled, r.checked]), [['recette', false, true], ['index', true, false]], 'sélecteur : deux genres, « index » désactivé sans livre');
    // Les trois gestes que le reste du bloc ne touchait pas, déclenchés par un VRAI clic (un libellé présent ne
    // prouve rien : un bouton muet porte le même texte). Le livre est choisi, donc « Index » est cliquable.
    const gestesVus = [];
    const avecLivre = renderSelecteurScan(selecteurScanModel({ livres, livreChoisi: 'e1', genre: 'recette' }), { changerLivre: (v) => gestesVus.push(['livre', v]), changerGenre: (v) => gestesVus.push(['genre', v]), photographier: () => gestesVus.push(['photo']), choisir: () => gestesVus.push(['choisir']), retour: () => gestesVus.push(['retour']) });
    eq([...avecLivre.querySelectorAll('input[type="radio"]')].map((r) => r.name), ['genre', 'genre'], 'sélecteur : les deux radios forment UN seul groupe (name="genre"), donc un seul genre à la fois');
    // MESURÉ dans ce navigateur : un clic sur un radio DÉTACHÉ du document coche bien la case mais ne dispatche
    // que « click », jamais « change » — le geste ne serait donc jamais appelé et l'assertion mentirait sur ce que
    // la personne obtient. Le nœud est attaché le temps des clics, et retiré par le finally quoi qu'il arrive.
    document.body.append(avecLivre);
    try {
      [...avecLivre.querySelectorAll('input[type="radio"]')].find((r) => r.value === 'index').click();
      [...avecLivre.querySelectorAll('button.btn')].find((b) => b.textContent === 'Choisir des photos ou un PDF').click();
      [...avecLivre.querySelectorAll('button.btn')].find((b) => b.textContent === '← Retour').click();
    } finally { avecLivre.remove(); }
    eq(gestesVus, [['genre', 'index'], ['choisir'], ['retour']], 'sélecteur : cocher « Index », « Choisir des photos ou un PDF » et « ← Retour » appellent chacun son geste par un vrai clic');
    noeud.querySelector('select').value = 'e1'; noeud.querySelector('select').dispatchEvent(new Event('change'));
    [...noeud.querySelectorAll('button.btn')].find((b) => b.textContent === 'Photographier').click();
    eq(appels, [['livre', 'e1'], ['photo']], 'sélecteur : les gestes reçoivent la valeur choisie');
    const impose = renderSelecteurScan(m3, { changerLivre: () => {}, changerGenre: () => {}, photographier: () => {}, choisir: () => {}, retour: () => {} });
    const selImpose = impose.querySelector('select');
    eq([selImpose.disabled, selImpose.value, [...impose.querySelectorAll('button.btn')].some((b) => b.textContent === 'Photographier')], [true, 'e2', true],
      'sélecteur : un ?edition connu ouvre le MÊME sélecteur, livre fixé — select désactivé sur « e2 » et « Photographier » à une tape (F14, R-UX-6)');
  }
  eq([ACCEPT_PHOTOS, ACCEPT_FICHIERS], ['image/*', 'image/*,application/pdf,application/epub+zip'], 'sélecteur : les accept actuels sont conservés');

  // Ce qui part VRAIMENT au scan (R-UX-7) : l'état brut de la page peut porter un genre « index » devenu
  // impossible depuis (le livre a été remis à « sans livre »), alors que l'écran, lui, affiche déjà « recette ».
  // La séance ne doit jamais recevoir une intention que personne n'a vue cochée.
  {
    const livres = [{ edition: { id: 'e1' }, book: { title: 'B' }, activite: 1 }, { edition: { id: 'e2' }, book: { title: 'A' }, activite: 0 }];
    eq(parametresDeScan({ livres, livreChoisi: '', genre: 'index' }), { edition_id: null, intention: 'recette' }, 'scan : un genre « index » laissé derrière par un livre retiré ne part PAS — l’écran dit « recette », le scan aussi');
    eq(parametresDeScan({ livres, livreChoisi: 'e1', genre: 'index' }), { edition_id: 'e1', intention: 'index' }, 'scan : un index avec son livre part bien comme index');
    eq(parametresDeScan({ livres, editionImposee: 'e2', livreChoisi: '', genre: 'recette' }), { edition_id: 'e2', intention: 'recette' }, 'scan : une édition imposée porte le livre (I-F), même si l’état ne l’a jamais reçue');
    eq(parametresDeScan({ livres, editionImposee: 'inconnue', livreChoisi: '', genre: 'index' }), { edition_id: null, intention: 'recette' }, 'scan : un ?edition inconnu ne devient pas un edition_id (S9), et l’index retombe sur recette');
  }
}
