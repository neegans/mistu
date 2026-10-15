// Tests du lot « page Ajouter et flux des livres » (spec docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md).
// Modèles purs et rendus DOM à gestes injectés ; bases jetables seulement ; aucun réseau ; aucun history.* réel.
export async function runAjouterTests({ eq, ok }) {
  // Attendre un FAIT, jamais un délai (F4) : rend true dès que la condition tient, false au bout de 3 s — l'appelant
  // affirme ensuite, pour qu'un dépassement soit une assertion rouge nommée et non une suite interrompue.
  const attendreFait = async (condition) => {
    for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); }
    return false;
  };
  // --- § 7 Puces « Cuisines »
  const { normaliser, capitaliser, GRAINE_CUISINES, LIMITES_PUCES, pucesModel, basculerPuce, ajouterPuce, cuisinesExistantes, renderPuces } = await import('../src/ui/puces.js');
  eq(LIMITES_PUCES, { longueur: 60, nombre: 50 }, 'puces : bornes d’une valeur libre (S10)');
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
  // S10 : « Autre… » est un champ texte libre. Sans borne, une valeur de 10 000 caractères partait dans la fiche du
  // livre, dans l'archive et au serveur ; et une liste de puces n'est plus un choix passé cinquante entrées.
  eq(ajouterPuce(['italienne'], 'x'.repeat(60)).length, 2, 'puces : 60 caractères, la borne exacte, passe (S10)');
  eq(ajouterPuce(['italienne'], 'x'.repeat(61)), ['italienne'], 'puces : au-delà de 60 caractères, refusé — rien n’est tronqué en silence (S10)');
  {
    const cinquante = Array.from({ length: 50 }, (_, i) => `cuisine ${i}`);
    eq(ajouterPuce(cinquante, 'une de trop').length, 50, 'puces : la 51e puce est refusée (S10)');
    eq(ajouterPuce(cinquante.slice(0, 49), 'la cinquantieme').length, 50, 'puces : la 50e passe (la borne est un plafond, pas un seuil)');
  }
  {
    // S10 : seule la GRAINE passe par t() — une valeur libre n'est pas une clé de traduction. En français les deux
    // chemins rendent le même texte ; mesuré ici en ANGLAIS, où la graine est traduite et la valeur libre non.
    const { setUiLocale } = await import('../src/core/i18n.js');
    try {
      setUiLocale('en');
      eq(pucesModel({ choisies: [], existantes: [], graine: ['italienne'] }).puces[0].libelle, 'Italian', 'puces : une valeur de la graine est traduite (en.js)');
      eq(pucesModel({ choisies: ['Italienne'], existantes: [], graine: ['italienne'] }).puces[0].libelle, 'Italian', 'puces : une valeur déjà choisie, autrement orthographiée, est traduite par sa clé de graine');
      eq(pucesModel({ choisies: ['italienne'], existantes: [], graine: ['grecque'] }).puces[0].libelle, 'Italienne', 'puces : hors graine, la valeur est affichée telle quelle, jamais cherchée dans le dictionnaire (S10)');
    } finally { setUiLocale('fr'); }
  }
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
    eq(champ.value, '', 'puces : Entrée vide le champ « Autre… » (la valeur est partie, l’écran ne la garde pas en double)');
    // F8 : le bouton « Ajouter » à côté du champ — le seul chemin pour qui ne tape pas Entrée (téléphone).
    champ.value = 'Marocaine';
    [...noeud.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter').click();
    eq([appels[2], champ.value], [['ajouter', 'Marocaine'], ''], 'puces : le bouton « Ajouter » envoie le texte tapé et vide le champ (F8)');
    champ.value = '   ';
    [...noeud.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter').click();
    eq(appels.length, 3, 'puces : « Ajouter » sur un champ blanc n’appelle rien');
  }
  {
    const hostile = renderPuces(pucesModel({ choisies: ['<img src=x onerror="alert(1)">'] }), {});
    eq(hostile.querySelectorAll('img').length, 0, 'puces : une valeur hostile ne crée aucun élément <img>');
    ok([...hostile.querySelectorAll('button.puce')].some((b) => b.textContent.includes('<img')), 'puces : la valeur hostile reste du TEXTE affiché, pas du balisage');
  }

  // --- § 4 Grille et § 10 sélecteur avant scan
  const { grilleModel, GRILLE_ACTIONS, renderGrille, selecteurScanModel, renderSelecteurScan, parametresDeScan, ACCEPT_PHOTOS, ACCEPT_FICHIERS } = await import('../src/ui/add.js');
  const { libelleLivre, carte } = await import('../src/ui/components.js');
  eq(GRILLE_ACTIONS, ['ajouterLivre', 'pages', 'saisir', 'signet', 'congelateur'], 'grille : cinq gestes nommés, dans l’ordre des cartes');
  // RF-m14 : `grilleModel` ne prend AUCUN argument — l'appeler avec `{}` laissait croire à une option qui n'existe pas.
  eq(grilleModel().cartes.map((c) => c.action), GRILLE_ACTIONS, 'grille : une carte par geste, même ordre');
  eq(grilleModel().cartes.map((c) => c.titre), ['Ajouter un livre', 'Photographier ou importer des pages', 'Saisir une recette', 'Garder un lien web', 'Ajouter un lot au congélateur'], 'grille : les cinq titres de la spec');
  {
    const appels = [];
    const gestes = Object.fromEntries(GRILLE_ACTIONS.map((a) => [a, () => appels.push(a)]));
    const noeud = renderGrille(grilleModel(), gestes);
    const cartes = [...noeud.querySelectorAll('button.carte')];
    eq(cartes.length, 5, 'grille : cinq cartes rendues, aucun formulaire');
    eq(noeud.querySelectorAll('input, select, textarea').length, 0, 'grille : plus aucun champ de formulaire sur la page Ajouter');
    cartes[3].click(); cartes[0].click();
    eq(appels, ['signet', 'ajouterLivre'], 'grille : chaque carte appelle son geste');
    eq(renderGrille(grilleModel(), { pages: () => {} }).querySelectorAll('button.carte').length, 1, 'grille : une carte sans geste câblé n’est pas rendue');
  }
  eq(libelleLivre({ year: 2019 }, { title: 'Mon livre', author: 'A. B.' }), 'Mon livre · A. B. · 2019', 'libelleLivre : titre · auteur · année');
  eq(libelleLivre({}, null), 'Sans titre', 'libelleLivre : sans livre → « Sans titre »');
  ok(carte('x', 'T', 'S', () => {}).classList.contains('carte'), 'carte : composant partagé');
  {
    const livres = [{ edition: { id: 'e1', year: 2019 }, book: { title: 'B', author: 'x' }, recence: 5 }, { edition: { id: 'e2' }, book: { title: 'A' }, recence: 0 }, { edition: { id: 'e3' }, book: { title: 'C' }, recence: 9 }];
    const m = selecteurScanModel({ livres, livreChoisi: '', genre: 'recette' });
    eq(m.options.map((o) => o.value), ['', 'e3', 'e1', 'e2'], 'sélecteur : « sans livre » d’abord, puis par récence décroissante, puis titre (C8)');
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
    const livres = [{ edition: { id: 'e1' }, book: { title: 'B' }, recence: 1 }, { edition: { id: 'e2' }, book: { title: 'A' }, recence: 0 }];
    eq(parametresDeScan({ livres, livreChoisi: '', genre: 'index' }), { edition_id: null, intention: 'recette' }, 'scan : un genre « index » laissé derrière par un livre retiré ne part PAS — l’écran dit « recette », le scan aussi');
    eq(parametresDeScan({ livres, livreChoisi: 'e1', genre: 'index' }), { edition_id: 'e1', intention: 'index' }, 'scan : un index avec son livre part bien comme index');
    eq(parametresDeScan({ livres, editionImposee: 'e2', livreChoisi: '', genre: 'recette' }), { edition_id: 'e2', intention: 'recette' }, 'scan : une édition imposée porte le livre (I-F), même si l’état ne l’a jamais reçue');
    eq(parametresDeScan({ livres, editionImposee: 'inconnue', livreChoisi: '', genre: 'index' }), { edition_id: null, intention: 'recette' }, 'scan : un ?edition inconnu ne devient pas un edition_id (S9), et l’index retombe sur recette');
  }
  // La page « Ajouter » entière (C5/R-UX-16, C8), sur un ctx de papier : renderAdd ne lit ni n'écrit aucune base.
  {
    const { renderAdd } = await import('../src/ui/add.js');
    const eds = [{ id: 'e1', book_id: 'b1' }, { id: 'e2', book_id: 'b2' }, { id: 'e3', book_id: 'b3' }];
    const ctxAdd = {
      book_editions: eds, booksById: new Map([['b1', { title: 'Alpha' }], ['b2', { title: 'Beta' }], ['b3', { title: 'Gamma' }]]),
      editionsById: new Map(eds.map((e) => [e.id, e])), books: [], recipes: [],
      library_activity: [
        { edition_id: 'e1', event_type: 'open_book', occurred_at: '2026-01-02T00:00:00Z' },
        { edition_id: 'e1', event_type: 'open_book', occurred_at: '2026-01-03T00:00:00Z' },
        { edition_id: 'e2', event_type: 'open_book', occurred_at: '2026-10-13T00:00:00Z' },
        { edition_id: 'e3', event_type: 'open_book', occurred_at: 'pas une date' },
      ],
    };
    const grille = await renderAdd({}, {}, ctxAdd);
    eq([grille.querySelectorAll('button.carte').length, grille.querySelector('.selecteur-scan')], [5, null], 'page Ajouter : sans ?edition, la grille des cinq cartes et aucun sélecteur');
    const impose = await renderAdd({}, { edition: 'e1' }, ctxAdd);
    const sel = impose.querySelector('.selecteur-scan select');
    eq([!!impose.querySelector('.selecteur-scan'), impose.querySelectorAll('button.carte').length, sel.disabled, sel.value], [true, 0, true, 'e1'],
      'page Ajouter : un ?edition connu ouvre DIRECTEMENT le sélecteur, livre fixé — plus de grille à traverser (C5, R-UX-16)');
    [...impose.querySelectorAll('button')].find((b) => b.textContent === '← Retour').click();
    eq([impose.querySelectorAll('button.carte').length, impose.querySelector('.selecteur-scan')], [5, null], 'page Ajouter : « ← Retour » ramène à la grille, pour qui voulait autre chose');
    eq((await renderAdd({}, { edition: 'jamais vue' }, ctxAdd)).querySelectorAll('button.carte').length, 5, 'page Ajouter : un ?edition inconnu est traité comme absent — la grille, pas un sélecteur sur un livre fantôme (S9)');
    // C8 : deux ouvertures de janvier ne passent plus devant une ouverture d'hier, et une date illisible ne vaut
    // pas « 1970 » — elle ne compte pas du tout.
    const grille2 = await renderAdd({}, {}, ctxAdd);
    [...grille2.querySelectorAll('button.carte')][1].click(); // « Photographier ou importer des pages » : aucun navigate
    eq([...grille2.querySelectorAll('.selecteur-scan select option')].map((o) => o.value), ['', 'e2', 'e1', 'e3'],
      'page Ajouter : les livres sont rangés par RÉCENCE de la dernière activité, jamais par nombre d’ouvertures (C8)');
  }

  // --- § 10 L'intention voyage dans l'adresse (F6)
  const { adresseSeance, appliquerIntention } = await import('../src/ui/import.js');
  const { remplacerAdresse } = await import('../src/core/router.js');
  eq(adresseSeance('ss1', 'index'), '/import?session=ss1&intention=index', 'intention : portée par l’adresse');
  eq(adresseSeance('ss1', null), '/import?session=ss1', 'intention : absente → adresse d’aujourd’hui');
  eq(adresseSeance('ss1', 'autre'), '/import?session=ss1', 'intention : une valeur inconnue n’entre pas dans l’adresse');
  eq(appliquerIntention({ intention: 'index', pageIds: ['p1', 'p2'] }), { selection: ['p1', 'p2'], ouvrirIndex: true, consommee: true }, 'intention index : pages présélectionnées, panneau ouvert');
  eq(appliquerIntention({ intention: 'recette', pageIds: ['p1'] }), { selection: ['p1'], ouvrirIndex: false, consommee: true }, 'intention recette : pages présélectionnées, panneau fermé');
  eq(appliquerIntention({ intention: undefined, pageIds: ['p1'] }), { selection: [], ouvrirIndex: false, consommee: false }, 'sans intention : rien n’est appliqué (un refresh() ultérieur ne réapplique rien)');
  eq(typeof remplacerAdresse, 'function', 'router : remplacerAdresse existe (history.replaceState enveloppé, jamais appelé par la suite)');
  eq(adresseSeance('ss 1&x=2', 'index'), '/import?session=ss%201%26x%3D2&intention=index', 'intention : l’identifiant de séance est encodé dans l’adresse (S9)');
  {
    // C7 : la réécriture d'adresse (retirer l'intention consommée) n'a lieu que si l'adresse AFFICHÉE est encore
    // celle de cette séance. Un refresh() arrivé après une navigation rendait encore cette vue, et réécrivait
    // alors l'adresse de l'écran SUIVANT avec celle d'une séance qu'on venait de quitter.
    const { peutRetirerIntention } = await import('../src/ui/import.js');
    eq(peutRetirerIntention({ consommee: true }, 'ss1', { session: 'ss1' }), true, 'intention : réécrite quand l’adresse montre encore CETTE séance (C7)');
    eq(peutRetirerIntention({ consommee: true }, 'ss1', { session: 'ss2' }), false, 'intention : jamais réécrite quand l’adresse a déjà changé de séance (C7)');
    eq(peutRetirerIntention({ consommee: true }, 'ss1', {}), false, 'intention : ni quand l’adresse ne porte plus de séance du tout (C7)');
    eq(peutRetirerIntention({ consommee: false }, 'ss1', { session: 'ss1' }), false, 'intention : rien à consommer, rien à réécrire');
  }

  // --- § 5 Ajouter un livre en deux pas
  const LA = await import('../src/ui/livre-ajout.js');
  // --- § 4 ISBN (spec 2026-10-14-identifier-un-livre-fiable)
  const ISBN = await import('../src/core/isbn.js');
  eq(ISBN.nettoyerIsbn(' 978-2-7619-5000-1 '), '9782761950001', 'isbn : nettoyage = chiffres et X seulement');
  eq(ISBN.nettoyerIsbn('080442957x'), '080442957X', 'isbn : le x minuscule devient X (F23)');
  ok(LA.nettoyerIsbn === ISBN.nettoyerIsbn, 'isbn : livre-ajout ré-exporte la même fonction');
  eq(ISBN.validerIsbn('0306406152'), { ok: true, isbn13: '9780306406157', isbn10: '0306406152' }, 'isbn : ISBN-10 valide → 13 recalculé');
  eq(ISBN.validerIsbn('080442957x'), { ok: true, isbn13: '9780804429573', isbn10: '080442957X' }, 'isbn : contrôle X admis, en majuscule');
  eq(ISBN.validerIsbn('9782890772816'), { ok: true, isbn13: '9782890772816', isbn10: '2890772810' }, 'isbn : 13 → 10 (978)');
  eq(ISBN.validerIsbn('9791234567896'), { ok: true, isbn13: '9791234567896', isbn10: null }, 'isbn : 979 n’a pas de forme à dix chiffres');
  eq(ISBN.validerIsbn('9781785035280'), { ok: false, motif: 'controle' }, 'isbn : chiffre de contrôle faux');
  eq(ISBN.validerIsbn('5901234123457'), { ok: false, motif: 'pas_isbn' }, 'isbn : EAN valide hors 978/979 = pas un ISBN (préfixe lu avant le contrôle)');
  eq(ISBN.validerIsbn('978X785035289'), { ok: false, motif: 'longueur' }, 'isbn : un X dans un 13 → longueur');
  eq(ISBN.validerIsbn('978178503528'), { ok: false, motif: 'longueur' }, 'isbn : douze chiffres');
  eq(ISBN.validerIsbn(' 978-1-78503-528-9 '), { ok: true, isbn13: '9781785035289', isbn10: '1785035282' }, 'isbn : tirets et espaces nettoyés');
  eq(ISBN.validerIsbn(''), { ok: false, motif: 'vide' }, 'isbn : vide');
  eq(ISBN.validerIsbn('12345678X9'), { ok: false, motif: 'longueur' }, 'isbn : X hors dernière position');
  eq(ISBN.codeBarresVersIsbn([{ rawValue: '5901234123457' }, { rawValue: '9781785035289' }]), '9781785035289', 'isbn : le premier code au motif 978/979 est retenu');
  eq(ISBN.codeBarresVersIsbn([]), null, 'isbn : aucun code → null');
  eq(ISBN.codeBarresVersIsbn(null), null, 'isbn : entrée absente → null');
  eq(LA.LIMITES_ISBN, { champ: 300, corps: 262144, delaiMs: 10000 }, 'livre : bornes S3');
  eq(LA.OPTIONS_FETCH, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, 'livre : options de fetch explicites (S12)');
  eq(LA.nettoyerIsbn(' 978-2-7619-5000-1 '), '9782761950001', 'livre : ISBN sans tirets ni espaces');
  {
    // fetch injecté : Open Library répond, Google jamais appelé
    const appels = [];
    const reponse = (status, corps) => ({ ok: status < 400, status, text: async () => corps });
    const fetchOL = async (url, options) => { appels.push([url, options]); return reponse(200, JSON.stringify({ 'ISBN:9782761950001': { title: 'T'.repeat(400), authors: [{ name: 'A' }, { name: 'B' }], publishers: [{ name: 'P' }], publish_date: 'March 2019' } })); };
    const r = await LA.lookupIsbn('9782761950001', { fetch: fetchOL });
    eq(r.source, 'openlibrary', 'livre : Open Library d’abord');
    eq([r.fiche.title.length, r.fiche.author, r.fiche.publisher, r.fiche.year, r.fiche.language], [300, 'A, B', 'P', 2019, null], 'livre : champs tronqués à 300, année entière, langue inconnue → null');
    eq(appels.length, 1, 'livre : Google Books pas appelé quand Open Library répond');
    // Les QUATRE champs, pas seulement credentials : une option S12 perdue en route ne se verrait pas autrement.
    eq(appels[0][1], { ...LA.OPTIONS_FETCH, signal: undefined }, 'livre : les options S12 sont passées au fetch, toutes les quatre');
    // Open Library vide → Google Books ; les deux appels dans un try
    const fetchG = async (url) => url.includes('openlibrary') ? reponse(200, '{}') : reponse(200, JSON.stringify({ items: [{ volumeInfo: { title: 'G', authors: ['X'], publisher: 'Q', publishedDate: '2001-02', language: 'fr' } }] }));
    const g = await LA.lookupIsbn('9782761950001', { fetch: fetchG });
    eq([g.source, g.fiche.title, g.fiche.language, g.fiche.year], ['googlebooks', 'G', 'fr', 2001], 'livre : repli Google Books');
    eq(await LA.lookupIsbn('9782761950001', { fetch: async () => { throw new Error('reseau'); } }), { fiche: null, source: null }, 'livre : un fetch qui rejette → aucune fiche, aucune exception');
    eq(await LA.lookupIsbn('9782761950001', { fetch: async (u) => u.includes('openlibrary') ? reponse(200, '{}') : reponse(429, '{}') }), { fiche: null, source: null }, 'livre : 429 Google Books = échec ordinaire');
    eq(await LA.lookupIsbn('9782761950001', { fetch: async () => reponse(200, 'x'.repeat(262145)) }), { fiche: null, source: null }, 'livre : corps > 256 Ko abandonné avant JSON.parse');
    eq((await LA.lookupIsbn('9782761950001', { fetch: async () => reponse(200, JSON.stringify({ 'ISBN:9782761950001': { title: 'T', publish_date: 'vers 19' } })) })).fiche.year, null, 'livre : une année qui n’est pas quatre chiffres → vide');
    // délai : le signal fourni est transmis
    let signalVu = null;
    await LA.lookupIsbn('9782761950001', { fetch: async (u, o) => { signalVu = o.signal; return reponse(200, '{}'); }, signal: new AbortController().signal });
    ok(signalVu instanceof AbortSignal, 'livre : le signal d’abandon est transmis au fetch');
    // RF-m6 : nettoyerIsbn ne laisse passer que chiffres et X, mais l'ISBN entre dans trois adresses — il y est
    // encodé, pour qu'aucun appelant futur ne puisse y glisser un « & » ou un « / ».
    const vus = [];
    await LA.lookupIsbn('97/8 x', { fetch: async (u) => { vus.push(u); return reponse(404, ''); } });
    eq([vus.length, vus[0].includes('ISBN:97%2F8%20x'), vus[1].includes('q=isbn:97%2F8%20x'), vus.some((u) => u.includes('97/8'))], [2, true, true, false], 'livre : l’ISBN est encodé dans les deux adresses de métadonnées (RF-m6)');
    eq(LA.URL_COUVERTURE_OL('97/8 x'), 'https://covers.openlibrary.org/b/isbn/97%2F8%20x-L.jpg?default=false', 'couverture : l’ISBN est encodé dans l’adresse de la couverture (RF-m6)');
  }
  {
    // S1/F1 : le corps des métadonnées est lu EN FLUX et coupé à 256 Ko, comme celui d'une couverture (R-UX-12).
    // Sans cela, `await r.text()` tirait TOUT le corps avant de regarder sa taille : un serveur qui répond sans fin
    // remplissait la mémoire de l'appareil, et le contrôle d'après ne servait à rien.
    const espion = { emis: 0, annule: 0 };
    const sansFin = () => new ReadableStream({
      pull(c) {
        if (espion.emis >= 64 * 16 * 1024) { c.close(); return; } // garde-fou : sans coupure le test échoue, il ne boucle pas
        espion.emis += 16 * 1024;
        c.enqueue(new Uint8Array(16 * 1024));
      },
      cancel() { espion.annule += 1; },
    });
    const sansTexte = (body) => ({ ok: true, status: 200, body, text: async () => { throw new Error('text() ne doit pas etre appele quand il y a un flux'); } });
    eq(await LA.lookupIsbn('978', { fetch: async () => sansTexte(sansFin()) }), { fiche: null, source: null }, 'livre : un corps de métadonnées sans fin → aucune fiche (S1)');
    eq([espion.annule, espion.emis <= 2 * 300 * 1024], [2, true], 'livre : la lecture est ANNULÉE dès 256 Ko, sur les deux appels — jamais les 1 Mo du corps sans fin (S1)');
    // Un corps VALIDE mais trop gros : refusé par la BORNE, pas par le catch de JSON.parse (la preuve : il parse).
    // 1 Mo, pas 300 Ko : un corps à peine au-delà de la borne se termine dans le morceau même qui la dépasse, donc
    // le flux se ferme de lui-même et « la lecture a été coupée » ne se mesure plus (cancel() sur un flux déjà
    // clos ne touche pas la source).
    const gros = JSON.stringify({ 'ISBN:978': { title: 'T'.repeat(1000000) } });
    ok(JSON.parse(gros)['ISBN:978'].title.length === 1000000, 'livre : le corps de 1 Mo du test est bien du JSON valide');
    const octetsGros = new TextEncoder().encode(gros);
    const grosEspion = { emis: 0, annule: 0 };
    const fluxGros = () => { let reste = octetsGros; return new ReadableStream({ pull(c) { if (!reste.length) { c.close(); return; } const m = reste.slice(0, 64 * 1024); reste = reste.slice(64 * 1024); grosEspion.emis += m.length; c.enqueue(m); }, cancel() { grosEspion.annule += 1; } }); };
    eq(await LA.lookupIsbn('978', { fetch: async () => sansTexte(fluxGros()) }), { fiche: null, source: null }, 'livre : un corps JSON VALIDE de 1 Mo est refusé par la borne, pas par une erreur d’analyse (S1)');
    // Les DEUX appels ensemble ont tiré moins d'octets qu'UN seul corps entier : la lecture est bien coupée (un
    // flux tire un morceau d'avance, d'où une marge au lieu d'un compte exact).
    eq([grosEspion.annule, grosEspion.emis < octetsGros.length, grosEspion.emis > 0], [2, true, true], 'livre : le corps trop gros est coupé — les deux appels ensemble tirent moins qu’UN corps entier, et la source est annulée deux fois (S1)');
    // Et un 429 PORTEUR d'une fiche parfaitement valide reste un échec : c'est `!r.ok` qui tranche, pas le contenu.
    const corpsValide = JSON.stringify({ 'ISBN:978': { title: 'Vrai titre', authors: [{ name: 'A' }], publishers: [], publish_date: '2020' } });
    eq(await LA.lookupIsbn('978', { fetch: async () => ({ ok: false, status: 429, text: async () => corpsValide }) }), { fiche: null, source: null }, 'livre : un 429 porteur d’une fiche valide reste un échec — `!r.ok` est lu avant le corps (S1)');
  }
  {
    // C2 : `language` a un défaut NON VIDE — « ne remplir que ce qui est vide » ne l'atteignait jamais, et un livre
    // anglais identifié par Google Books était écrit « fr » dans l'édition.
    const vides = { title: '', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] };
    eq(LA.fusionnerFiche(vides, { title: 'T', language: 'en' }).language, 'en', 'livre : une langue reconnue de la fiche distante gagne sur le défaut « fr » (C2)');
    eq(LA.fusionnerFiche(vides, { title: 'T', language: 'en' }, { langueTouchee: true }).language, 'fr', 'livre : … sauf si la personne a touché au menu Langue — son choix est sa saisie (C2)');
    eq(LA.fusionnerFiche(vides, { title: 'T', language: 'de' }).language, 'fr', 'livre : une langue hors fr/en (le menu n’en a que deux) ne remplace rien');
    eq(LA.fusionnerFiche(vides, { title: 'T', language: null }).language, 'fr', 'livre : une fiche sans langue laisse le défaut');
  }
  {
    // C9/S11 : AbortSignal.timeout n'existe pas avant Safari 16. Son absence ne doit pas emporter l'identification.
    ok(LA.signalDelai(50) instanceof AbortSignal, 'livre : le délai rend un signal d’abandon');
    const vrai = AbortSignal.timeout;
    let pose = false;
    try { AbortSignal.timeout = () => { throw new Error('non offert'); }; pose = AbortSignal.timeout !== vrai; } catch { pose = false; }
    try {
      const s = LA.signalDelai(50);
      eq([pose, s instanceof AbortSignal, s.aborted], [true, true, false], 'livre : AbortSignal.timeout qui lève (Safari < 16) → repli AbortController, signal vivant (C9)');
    } finally { if (pose) AbortSignal.timeout = vrai; }
  }
  eq(LA.fusionnerFiche({ title: 'Déjà', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] }, { title: 'T', author: 'A', publisher: null, year: 2019, language: null }),
    { title: 'Déjà', author: 'A', publisher: '', year: '2019', language: 'fr', convention: '', cuisines: [] }, 'livre : la fusion ne remplit que les champs vides, l’année devient texte de formulaire');
  {
    const m = LA.livreAjoutModel({ pas: 1, isbn: '', champs: { title: '' }, provenance: null, recherche: false, lecteurDisponible: false });
    eq([m.pas, m.peutEnregistrer, m.messages.lecteur], [1, false, 'Le lecteur de code-barres n’est pas offert dans ce navigateur.'], 'livre : pas 1, lecteur absent nommé');
    const m2 = LA.livreAjoutModel({ pas: 2, isbn: '978', champs: { title: 'X' }, provenance: 'openlibrary', recherche: false, lecteurDisponible: true });
    eq([m2.peutEnregistrer, m2.messages.provenance], [true, 'Renseigné par Open Library — vérifie et corrige.'], 'livre : pas 2, provenance étiquetée (I-A)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: 'aucune' }).messages.provenance, 'Aucune fiche trouvée pour cet ISBN. Complète à la main.', 'livre : échec dit après la réponse (I-B)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: null }).messages.provenance, null, 'livre : saisie à la main → aucune provenance');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: '   ' } }).peutEnregistrer, false, 'livre : sans titre, pas d’enregistrement');
    eq(LA.livreAjoutModel({ pas: 1, recherche: true }).messages.recherche, 'Recherche…', 'livre : pendant l’appel');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, enCours: true }).peutEnregistrer, false, 'livre : pendant l’enregistrement, on ne peut pas enregistrer une seconde fois (double clic)');
  }
  {
    let n = 0;
    const { book, edition } = LA.fabriquerLivre({ champs: { title: ' Titre ', author: 'A', publisher: '', year: '2019', language: 'fr', convention: 'metric_ca', cuisines: ['italienne'] }, isbn: '9782761950001', coverSha256: null }, { newId: (p) => `${p}-${++n}` });
    eq(book, { id: 'bk-1', title: 'Titre', author: 'A', cuisines: ['italienne'], tags: [] }, 'livre : book comme avant, cuisines en tableau');
    eq(edition, { id: 'ed-2', book_id: 'bk-1', isbn: '9782761950001', publisher: null, year: 2019, language: 'fr', unit_convention_id: 'metric_ca', convention_evidence: 'confirmed_by_user', owned: true, cover_sha256: null }, 'livre : edition comme avant + cover_sha256 (pointeur souple)');
  }
  {
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo, db) => {
      const edition = await LA.enregistrerLivre({ champs: { title: 'Propre\u0001', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: [] }, isbn: '', coverSha256: null }, { repo });
      const book = await db.get('books', edition.book_id);
      eq(book.title, 'Propre', 'livre : écrit par repo.saveBatch → R61 nettoie le caractère de contrôle (S2)');
      // F10 : ce qui est MESURÉ ici, c'est que les deux lignes sont en file — pas que l'écriture fut une seule
      // transaction (ce que cette assertion affirmait sans le voir ; le contrat d'atomicité est celui de db.mutate).
      eq((await db.getAll('outbox')).map((o) => o.store).sort(), ['book_editions', 'books'], 'livre : deux lignes en file, books et book_editions');
    });
  }
  {
    // Le contrat sur lequel repose le try/catch du geste « enregistrer » de la route : une écriture refusée REMONTE,
    // elle n'est pas avalée ici. Sans ça, la route croirait avoir enregistré et naviguerait vers une fiche absente.
    let appels = 0;
    const faux = { newId: (p) => `${p}-x`, saveBatch: async () => { appels += 1; throw new Error('quota'); } };
    let nom = null;
    try { await LA.enregistrerLivre({ champs: { title: 'T' }, isbn: '', coverSha256: null }, { repo: faux }); } catch (e) { nom = e.message; }
    eq([appels, nom], [1, 'quota'], 'livre : un saveBatch refusé remonte (c’est ce que la route attrape avant de dire quoi que ce soit)');
  }
  {
    const appels = [];
    const gestes = { changerIsbn: (v) => appels.push(['isbn', v]), scanner: () => appels.push(['scanner']), identifier: () => appels.push(['identifier']), saisirMain: () => appels.push(['main']), changerChamp: (k, v) => appels.push(['champ', k, v]), basculerCuisine: (v) => appels.push(['cuisine', v]), ajouterCuisine: (v) => appels.push(['ajout', v]), retourIsbn: () => appels.push(['retour']), enregistrer: () => appels.push(['enregistrer']) };
    const p1 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '', champs: {}, lecteurDisponible: false }), gestes);
    eq(p1.querySelector('p').textContent, 'Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.', 'livre : première ligne du pas 1 = le but');
    ok(p1.textContent.includes('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'), 'livre : les tiers sont nommés (S12)');
    ok([...p1.querySelectorAll('button')].find((b) => b.textContent === 'Scanner le code-barres').disabled, 'livre : lecteur absent → bouton désactivé');
    // RF-m8 : pendant « Recherche… », taper un autre ISBN dans un champ resté actif ferait croire que la réponse
    // qui arrive est celle du nouvel ISBN. Le champ se ferme avec les boutons.
    const pRecherche = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '978', recherche: true }), gestes);
    eq([pRecherche.querySelector('input[name="isbn"]').disabled, [...pRecherche.querySelectorAll('button')].find((b) => b.textContent === 'Identifier').disabled], [true, true], 'livre : pendant « Recherche… », le champ ISBN est fermé comme le bouton (RF-m8)');
    eq(p1.querySelector('input[name="isbn"]').disabled, false, 'livre : hors recherche, le champ ISBN est ouvert');
    [...p1.querySelectorAll('button')].find((b) => b.textContent === 'Saisir à la main').click();
    const p2 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '978', champs: { title: 'T', author: '', publisher: '', year: '', language: 'fr', convention: '', cuisines: ['italienne'] }, provenance: 'openlibrary' }), gestes);
    eq(p2.querySelectorAll('input[name="isbn"]').length, 0, 'livre : l’ISBN ne se modifie pas au pas 2 (F23)');
    ok(p2.querySelector('details') && p2.querySelector('details summary').textContent === 'Plus de détails', 'livre : éditeur/année/convention repliés');
    ok(p2.querySelectorAll('button.puce').length >= 1, 'livre : puces Cuisines au pas 2');
    ok([...p2.querySelectorAll('button, a')].some((b) => b.textContent === '← Changer d’ISBN'), 'livre : retour au pas 1 offert');
    eq(p2.querySelector('.zone-couverture'), null, 'livre : sans geste couverture (tâche 9), aucune zone couverture');
    [...p2.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter ce livre').click();
    eq(appels, [['main'], ['enregistrer']], 'livre : les gestes sont appelés');
    // Le pas 2 SANS ISBN — ce que voit quiconque a pris « Saisir à la main » sans rien taper. Le rendu y prend une
    // autre branche (pas de ligne « ISBN … » à côté du retour) : sans ces deux assertions, cette branche partait
    // livrée sans qu'aucun test ne l'exerce, et la perdre retirerait le seul chemin de retour au pas 1.
    const p2SansIsbn = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '', champs: { title: 'T' }, provenance: null }), gestes);
    ok(![...p2SansIsbn.querySelectorAll('span.muted')].some((s) => s.textContent.startsWith('ISBN')), 'livre : sans ISBN, le pas 2 n’affiche pas une mention « ISBN » vide');
    [...p2SansIsbn.querySelectorAll('button')].find((b) => b.textContent === '← Changer d’ISBN').click();
    eq(appels, [['main'], ['enregistrer'], ['retour']], 'livre : sans ISBN, « ← Changer d’ISBN » est bien là et son geste part');
  }
  {
    // R-UX-9. Le chemin le plus fréquent (saisie à la main, ou identification sans fiche) ouvre le pas 2 à champs
    // vides : « Ajouter ce livre » est alors désactivé, et `disabled` n'est posé qu'UNE fois, à la construction.
    // Taper le titre doit le réveiller — sans redessiner la page, sinon le curseur sauterait à chaque frappe.
    const noeud = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '978', champs: { title: '' }, provenance: null }), {});
    const bouton = noeud.querySelector('[data-role="enregistrer"]');
    ok(bouton && bouton.textContent === 'Ajouter ce livre' && bouton.disabled, 'livre : au pas 2 sans titre, « Ajouter ce livre » est désactivé et se retrouve par son data-role');
    LA.majBoutonEnregistrer(noeud, LA.livreAjoutModel({ pas: 2, champs: { title: 'X' } }));
    ok(!bouton.disabled, 'livre : le titre tapé réveille le bouton, sur le nœud DÉJÀ rendu (R-UX-9)');
    LA.majBoutonEnregistrer(noeud, LA.livreAjoutModel({ pas: 2, champs: { title: '  ' } }));
    ok(bouton.disabled, 'livre : un titre effacé le redésactive');
    LA.majBoutonEnregistrer(noeud, LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, enCours: true }));
    ok(bouton.disabled, 'livre : pendant l’enregistrement le bouton reste fermé (pas de second envoi)');
    // Le pas 1 n'a pas ce bouton : le helper y passe sans lever (la route l'appelle à chaque frappe, pas 1 compris).
    let leve = null;
    try { LA.majBoutonEnregistrer(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1 }), {}), LA.livreAjoutModel({ pas: 2, champs: { title: 'X' } })); } catch (e) { leve = String(e); }
    eq(leve, null, 'livre : sur une zone sans ce bouton, le helper ne lève pas');
  }
  {
    // La ROUTE elle-même, sans réseau et sans écriture : ses gestes sont câblés, et une saisie à la main
    // n'étiquette RIEN (I-B — aucune provenance à annoncer, personne n'a interrogé personne).
    // F12 : base JETABLE et `fetch` remplacé par un refus — « sans réseau et sans écriture » est ainsi une garantie
    // du montage, pas une promesse du commentaire ; le vrai fetch est rendu dans le finally.
    const { withRepo } = await import('./sync-fixture.js');
    const vraiFetch = globalThis.fetch;
    let appelsReseau = 0;
    try {
      globalThis.fetch = async (u) => { appelsReseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
      await withRepo(async (repo, db) => {
    const racine = await LA.renderLivreAjoutRoute({}, {}, { books: [{ cuisines: ['italienne'] }], recipes: [] }, { repo });
    const ecrituresAvant = (await db.getAll('files')).length + (await db.getAll('books')).length;
    const bouton = (nom) => [...racine.querySelectorAll('button')].find((b) => b.textContent === nom);
    const champ = racine.querySelector('input[name="isbn"]');
    champ.value = ' 978-2-7619-5000-1 ';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    bouton('Saisir à la main').click();
    eq(racine.querySelector('.status.info'), null, 'route livre : une saisie à la main n’étiquette aucune provenance (I-B)');
    eq([...racine.querySelectorAll('span.muted')].filter((s) => s.textContent.startsWith('ISBN')).map((s) => s.textContent), ['ISBN 9782761950001'], 'route livre : l’ISBN tapé est nettoyé et rappelé au pas 2');
    // Le défaut de R-UX-9, vu du côté de la personne : taper le titre réveille le bouton.
    const titre = [...racine.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const boutonAvant = racine.querySelector('[data-role="enregistrer"]');
    ok(boutonAvant.disabled, 'route livre : pas 2 à champs vides → « Ajouter ce livre » fermé');
    titre.value = 'Un titre'; titre.dispatchEvent(new Event('input', { bubbles: true }));
    ok(!racine.querySelector('[data-role="enregistrer"]').disabled, 'route livre : le titre tapé ouvre « Ajouter ce livre » (R-UX-9, le défaut corrigé)');
    ok(racine.querySelector('[data-role="enregistrer"]') === boutonAvant, 'route livre : c’est le MÊME nœud bouton après la frappe — rien n’a été redessiné (l’identité, pas seulement « encore au pas 2 »)');
    eq(racine.querySelector('input[name="isbn"]'), null, 'route livre : on est bien resté au pas 2 (aucun redessin qui ferait sauter le curseur)');
    bouton('← Changer d’ISBN').click();
    eq(racine.querySelector('input[name="isbn"]').value, '9782761950001', 'route livre : le retour au pas 1 garde l’ISBN nettoyé');
    eq([appelsReseau, (await db.getAll('files')).length + (await db.getAll('books')).length - ecrituresAvant], [0, 0], 'route livre : ce parcours n’appelle AUCUN réseau et n’écrit rien (F12, mesuré sur base jetable)');
      });
    } finally { globalThis.fetch = vraiFetch; }
  }

  // --- § 8 Accueil du livre, § 9 fiche livre
  const { accueilLivreModel, ACCUEIL_ACTIONS, renderAccueilLivre } = await import('../src/ui/accueil-livre.js');
  const { seancesOuvertes } = await import('../src/ui/book.js');
  eq(ACCUEIL_ACTIONS, ['index', 'recette', 'plusTard'], 'accueil : trois gestes');
  eq(accueilLivreModel({ nouveau: undefined }).afficher, false, 'accueil : sans ?nouveau, rien');
  eq(accueilLivreModel({ nouveau: '' }).afficher, false, 'accueil : « ?nouveau » sans valeur (ce que rend URLSearchParams) n’affiche rien non plus');
  {
    const m = accueilLivreModel({ nouveau: '1' });
    eq([m.afficher, m.titre], [true, 'Le livre est dans ta bibliothèque. Et maintenant ?'], 'accueil : la première ligne dit où on est et pose la question');
    eq(m.cartes.map((c) => c.action), ACCUEIL_ACTIONS, 'accueil : les trois cartes dans l’ordre');
    eq(m.cartes[0].titre, 'Photographier l’index ou la table des matières', 'accueil : carte index');
    const appels = [];
    const noeud = renderAccueilLivre(m, { photographier: (i) => appels.push(['photo', i]), choisir: (i) => appels.push(['choisir', i]), plusTard: () => appels.push(['plusTard']), fermer: () => appels.push(['fermer']) });
    const cartes = [...noeud.querySelectorAll('button.carte')];
    eq(cartes.length, 3, 'accueil : trois cartes rendues');
    cartes[0].click();
    const sources = [...noeud.querySelectorAll('.sources button')].map((b) => b.textContent);
    eq(sources, ['Photographier', 'Choisir des photos ou un PDF'], 'accueil : toucher « index » dévoile les deux sources');
    [...noeud.querySelectorAll('.sources button')][1].click();
    cartes[1].click();
    [...noeud.querySelectorAll('.sources button')][0].click();
    cartes[2].click();
    noeud.querySelector('button.fermer').click();
    eq(appels, [['choisir', 'index'], ['photo', 'recette'], ['plusTard'], ['fermer']], 'accueil : l’intention suit la carte touchée, « Plus tard » et « × » appellent leurs gestes');
    ok(!noeud.querySelector('.accueil-livre'), 'accueil : le « × » retire vraiment le panneau du DOM (pas seulement un geste appelé)');
    ok(!renderAccueilLivre(accueilLivreModel({}), {}).hasChildNodes(), 'accueil : modèle fermé → nœud vide');
    // Un geste absent ne doit pas faire planter une carte touchée (même garde que la grille et la porte d'entrée).
    let leve = null;
    try { const nu = renderAccueilLivre(accueilLivreModel({ nouveau: '1' }), {}); [...nu.querySelectorAll('button.carte')].forEach((b) => b.click()); nu.querySelector('button.fermer').click(); } catch (e) { leve = String(e); }
    eq(leve, null, 'accueil : sans aucun geste câblé, toucher les cartes et le « × » ne lève pas');
  }
  eq(seancesOuvertes({ scan_sessions: [{ id: 's1', status: 'open', edition_id: 'e1', page_ids: ['a'] }, { id: 's2', status: 'done', edition_id: 'e1', page_ids: [] }, { id: 's3', status: 'open', edition_id: 'e2', page_ids: [] }] }, 'e1').map((s) => s.id), ['s1'], 'fiche : séances ouvertes de CETTE édition seulement');
  eq(seancesOuvertes({}, 'e1'), [], 'fiche : un contexte sans scan_sessions ne lève pas');
  eq(seancesOuvertes({ scan_sessions: [
    { id: 'vieille', status: 'open', edition_id: 'e1', started_at: '2026-10-01T08:00:00Z' },
    { id: 'hier', status: 'open', edition_id: 'e1', started_at: '2026-10-13T20:00:00Z' },
    { id: 'sansDate', status: 'open', edition_id: 'e1' }] }, 'e1').map((s) => s.id), ['hier', 'vieille', 'sansDate'],
    'fiche : la séance la plus RÉCENTE d’abord — la fiche n’en rappelle qu’une, et « Reprendre » doit mener à celle qu’on vient de laisser (C8)');

  // La fiche livre elle-même, rendue sur une base JETABLE (withRepo) : ses deux menus de source, le panneau
  // d'accueil, la séance en cours, les puces « Cuisines ». Aucun scan n'est déclenché — pickFiles ouvrirait un
  // vrai sélecteur de fichiers — et le « × » du panneau n'est pas touché ici : son geste réel appelle
  // remplacerAdresse (history.replaceState), interdit dans la suite.
  {
    const { withRepo } = await import('./sync-fixture.js');
    const { renderBook } = await import('../src/ui/book.js');
    const edition = { id: 'e1', book_id: 'b1', year: 2019 };
    const book = { id: 'b1', title: 'Mon livre', author: 'A. B.', cuisines: ['italienne'] };
    const ctxDe = (extra = {}) => ({
      editionsById: new Map([['e1', edition]]), booksById: new Map([['b1', book]]), books: [book],
      recipes: [], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [],
      book_editions: [edition], docsByRecipe: new Map(), scan_sessions: [], settings: {}, ...extra,
    });
    await withRepo(async (repo, db) => {
      const compterActivites = async () => (await db.getAll('library_activity')).length;
      const avant = await compterActivites();
      const fiche = await renderBook({ id: 'e1' }, {}, ctxDe());
      eq((await compterActivites()) - avant, 1, 'fiche : une ouverture volontaire reste journalisée (open_book)');
      const menus = [...fiche.querySelectorAll('details.menu-source')];
      eq(menus.map((d) => d.querySelector('summary').textContent), ['+ Pages d’index', '+ Recette'], 'fiche : deux gestes nommés en en-tête (§ 9), le verbe avant l’outil');
      eq([...menus[0].querySelectorAll('button, a')].map((b) => b.textContent), ['Photographier', 'Choisir des photos ou un PDF'], 'fiche : « + Pages d’index » dévoile les deux sources');
      eq([...menus[1].querySelectorAll('button, a')].map((b) => b.textContent), ['Photographier', 'Choisir des photos ou un PDF', 'Saisir à la main'], 'fiche : « + Recette » offre aussi la saisie à la main');
      eq(menus[1].querySelector('a').getAttribute('href'), '#/recipes/new?edition=e1', 'fiche : la saisie à la main partie d’ici porte le livre (I-F)');
      ok(![...fiche.querySelectorAll('button')].some((b) => b.textContent === 'Photographier des pages'), 'fiche : l’ancien bouton unique « Photographier des pages » a disparu');
      eq(fiche.querySelector('.accueil-livre'), null, 'fiche : sans ?nouveau, aucun panneau d’accueil');
      eq([...fiche.querySelectorAll('a')].filter((a) => a.textContent === 'Reprendre').length, 0, 'fiche : sans séance ouverte, rien à reprendre');

      const apres = await compterActivites();
      const nouvelle = await renderBook({ id: 'e1' }, { nouveau: '1' }, ctxDe());
      eq((await compterActivites()) - apres, 0, 'fiche : l’arrivée après création n’est pas une ouverture volontaire — rien n’est journalisé (S16)');
      const panneau = nouvelle.querySelector('.accueil-livre');
      ok(panneau, 'fiche : ?nouveau=1 pose le panneau d’accueil au-dessus de la fiche (pas une modale)');
      eq(panneau.querySelector('h2').textContent, 'Le livre est dans ta bibliothèque. Et maintenant ?', 'fiche : la première ligne du panneau dit où on est');
      eq([...panneau.querySelectorAll('button.carte h3')].map((h) => h.textContent), ['Photographier l’index ou la table des matières', 'Photographier ou importer des pages de recettes', 'Plus tard'], 'fiche : les trois cartes de la spec § 8');

      // R-UX-10 : un seul fait, une seule condition — c'est le MODÈLE qui décide. « ?nouveau » sans valeur
      // n'affiche pas le panneau : l'arrivée est donc une ouverture ordinaire, et elle se journalise comme telle.
      const avantVide = await compterActivites();
      const vide = await renderBook({ id: 'e1' }, { nouveau: '' }, ctxDe());
      eq((await compterActivites()) - avantVide, 1, 'fiche : « ?nouveau » sans valeur n’est pas une arrivée après création — l’ouverture se journalise comme les autres (R-UX-10)');
      eq(vide.querySelector('.accueil-livre'), null, 'fiche : … et aucun panneau n’est posé — une seule décision pour les deux');

      const avecSeance = await renderBook({ id: 'e1' }, {}, ctxDe({ scan_sessions: [
        { id: 's1', status: 'open', edition_id: 'e1', page_ids: ['p1', 'p2'] },
        { id: 's2', status: 'open', edition_id: 'autre', page_ids: ['p3'] },
        { id: 's3', status: 'done', edition_id: 'e1', page_ids: ['p4'] }] }));
      ok(avecSeance.textContent.includes('Séance en cours : 2 page(s)'), 'fiche : une séance ouverte de CE livre est rappelée avec son compte de pages');
      eq([...avecSeance.querySelectorAll('a')].filter((a) => a.textContent === 'Reprendre').map((a) => a.getAttribute('href')), ['#/import?session=s1'], 'fiche : « Reprendre » mène à la séance de CE livre, et à elle seule');
      // Une ligne scan_sessions venue d'ailleurs peut arriver sans page_ids (I-G : le distant est borné, pas
      // supposé bien formé) : la fiche entière ne doit pas blanchir pour autant.
      const sansPages = await renderBook({ id: 'e1' }, {}, ctxDe({ scan_sessions: [{ id: 's9', status: 'open', edition_id: 'e1' }] }));
      ok(sansPages.textContent.includes('Séance en cours : 0 page(s)'), 'fiche : une séance sans page_ids compte 0 page au lieu de faire tomber tout le rendu');

      // R-UX-8 : le champ « Cuisines » n'est pas un <label> — sinon un clic sur le mot « Cuisines » activerait
      // la première puce. Et un clic sur une puce ne doit re-rendre QUE le conteneur des puces.
      const champ = [...avecSeance.querySelectorAll('.field')].find((f) => f.querySelector('span')?.textContent === 'Cuisines');
      ok(champ, 'fiche : le champ « Cuisines » garde l’habillage .field');
      eq(champ.tagName, 'DIV', 'fiche : « Cuisines » est un <div class="field">, jamais un <label> (R-UX-8)');
      eq(champ.querySelectorAll('input[type="text"]').length, 1, 'fiche : plus de liste séparée par des virgules — seul le champ « Autre… » des puces reste');
      const italienne = () => [...champ.querySelectorAll('button.puce')].find((b) => b.textContent === 'Italienne');
      eq(italienne().getAttribute('aria-pressed'), 'true', 'fiche : la cuisine déjà enregistrée du livre arrive cochée');
      const enregistrer = [...avecSeance.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer');
      italienne().click();
      eq(italienne().getAttribute('aria-pressed'), 'false', 'fiche : un clic décoche la puce');
      ok([...avecSeance.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer') === enregistrer, 'fiche : le clic ne redessine que les puces — « Enregistrer » est le MÊME nœud');
    });
  }

  // C4 : les deux gestes de la fiche écrivent la MÊME ligne `book_editions`. Chacun la RELIT juste avant d'écrire et
  // ne touche que son champ — sinon « Enregistrer » les métadonnées remettait le `cover_sha256` lu au RENDU (la
  // couverture posée entre-temps disparaissait), et « Retirer » la couverture remettait les métadonnées d'avant.
  // Le geste « Photographier » n'est pas touché ici : il ouvrirait un vrai sélecteur de fichiers. C'est la MÊME
  // fonction d'écriture (ecrirePointeur) que « Retirer » exerce.
  {
    const { withRepo } = await import('./sync-fixture.js');
    const { renderBook } = await import('../src/ui/book.js');
    await withRepo(async (repo, db) => {
      const edition = { id: 'eZ', book_id: 'bZ', isbn: null, publisher: 'Avant', year: 2019, language: 'fr', unit_convention_id: null, convention_evidence: null, owned: true, cover_sha256: null };
      const livre = { id: 'bZ', title: 'Deux gestes', author: 'A', cuisines: [], tags: [] };
      await repo.saveBatch({ books: [livre], book_editions: [edition] });
      const ctxDeux = (ed) => ({ editionsById: new Map([['eZ', ed]]), booksById: new Map([['bZ', livre]]), books: [livre],
        recipes: [], recipe_versions: [], source_documents: [], source_pages: [], rediscovery_prefs: [],
        book_editions: [ed], docsByRecipe: new Map(), scan_sessions: [], settings: {} });
      const champ = (noeud, libelle) => [...noeud.querySelectorAll('label.field')].find((f) => f.querySelector('span')?.textContent === libelle)?.querySelector('input');
      // 1. « Enregistrer » les métadonnées APRÈS qu'une couverture a été posée (autre onglet, ou le geste
      // « Photographier » de cette même fiche, qui écrit puis refresh()).
      const fiche = await renderBook({ id: 'eZ' }, {}, ctxDeux(edition));
      await repo.save('book_editions', { ...edition, cover_sha256: 'empreinte-posee-entre-temps' });
      const editeur = champ(fiche, 'Éditeur');
      editeur.value = 'Après';
      editeur.dispatchEvent(new Event('input'));
      [...fiche.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer').click();
      eq(await attendreFait(async () => (await db.get('book_editions', 'eZ'))?.publisher === 'Après'), true, 'fiche : « Enregistrer » écrit bien les métadonnées');
      const apres = await db.get('book_editions', 'eZ');
      eq([apres.publisher, apres.cover_sha256], ['Après', 'empreinte-posee-entre-temps'],
        'fiche : « Enregistrer » les métadonnées GARDE la couverture posée entre-temps — l’édition est relue avant l’écriture (C4)');
      // 2. L'inverse : « Retirer » la couverture après que les métadonnées ont été écrites ailleurs.
      const fiche2 = await renderBook({ id: 'eZ' }, {}, ctxDeux(apres));
      await repo.save('book_editions', { ...apres, publisher: 'Encore après' });
      const retirer = [...fiche2.querySelectorAll('button')].find((b) => b.textContent === 'Retirer');
      ok(retirer, 'fiche : une couverture pointée offre « Retirer »');
      retirer.click();
      eq(await attendreFait(async () => (await db.get('book_editions', 'eZ'))?.cover_sha256 === null), true, 'fiche : « Retirer » écrit bien le pointeur à null');
      const apres2 = await db.get('book_editions', 'eZ');
      eq([apres2.cover_sha256, apres2.publisher], [null, 'Encore après'],
        'fiche : « Retirer » la couverture GARDE les métadonnées écrites entre-temps — même relecture (C4)');
    });
  }

  // --- § 7 Éditeur de recette : même geste pour les cuisines
  const { cuisinesDepuis } = await import('../src/ui/recipe-edit.js');
  eq(cuisinesDepuis({ cuisines: ['italienne', 'thaïe'] }), ['italienne', 'thaïe'], 'éditeur : un tableau est repris tel quel');
  eq(cuisinesDepuis({ cuisines: ' italienne , Thaïe ,' }), ['italienne', 'thaïe'], 'éditeur : une ancienne chaîne CSV est découpée, en minuscules');
  eq(cuisinesDepuis({}), [], 'éditeur : rien → tableau vide');
  {
    // F5/RF-I3 : l'éditeur est RENDU (une base jetable, un ctx minimal), plus cherché au grep dans son source —
    // deux regex restaient vertes si le champ était commenté, ou si `renderPuces` n'était appelé que dans une
    // branche morte. Ici le champ « Cuisines / régions » porte de vraies puces, et un clic les bascule.
    const { withRepo } = await import('./sync-fixture.js');
    const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
    await withRepo(async () => {
      const ctxEd = { recipesById: new Map(), versionsByRecipe: new Map(), versionsById: new Map(), editionsById: new Map(), booksById: new Map(),
        pagesById: new Map(), source_documents: [], scan_sessions: [], recipes: [], books: [], ingredients: [], ingredientsById: new Map(), settings: {} };
      const editeur = await renderRecipeEdit({ id: null }, {}, ctxEd);
      const champCuisines = [...editeur.querySelectorAll('.field')].find((f) => f.querySelector('span')?.textContent === 'Cuisines / régions');
      eq([champCuisines?.tagName, champCuisines?.querySelectorAll('input[type="text"]').length], ['DIV', 1], 'éditeur : « Cuisines / régions » est un <div class="field"> et n’a plus qu’un champ (« Autre… » des puces), jamais la liste à virgules (R-UX-8)');
      const puces = [...champCuisines.querySelectorAll('button.puce')];
      ok(puces.length >= 15, `éditeur : la graine des quinze cuisines est rendue en puces (${puces.length})`);
      eq(puces.map((b) => b.getAttribute('aria-pressed')).filter((v) => v === 'true').length, 0, 'éditeur : une recette neuve n’a aucune cuisine cochée');
      const premiere = puces[0].textContent;
      puces[0].click();
      const apres = [...champCuisines.querySelectorAll('button.puce')];
      eq([apres[0].textContent, apres[0].getAttribute('aria-pressed'), apres.filter((b) => b.getAttribute('aria-pressed') === 'true').length], [premiere, 'true', 1],
        'éditeur : un clic coche la puce et une seule — le formulaire a vraiment reçu la cuisine (F5)');
      apres[0].click();
      eq([...champCuisines.querySelectorAll('button.puce')].filter((b) => b.getAttribute('aria-pressed') === 'true').length, 0, 'éditeur : un second clic la décoche');
    });
  }

  // --- § 11 Signet web
  const S = await import('../src/ui/signet.js');
  eq(S.LIMITES_SIGNET, { adresse: 2048, titre: 300 }, 'signet : bornes (S13)');
  eq(S.lienSignet('https://ricardocuisine.com/recettes/1'), { ok: true, href: 'https://ricardocuisine.com/recettes/1', hote: 'ricardocuisine.com' }, 'signet : lien https accepté, hôte recalculé');
  // D-T7 : on ne garde JAMAIS un mot de passe collé dans une adresse — `username`/`password` sont retirés de l'href
  // RENDU, et comme c'est cet href qui est écrit dans la fiche, l'identifiant ne part ni en base, ni dans l'archive,
  // ni au serveur, ni dans un Referer. La page reste joignable.
  eq(S.lienSignet('http://user:pw@exemple.test/x'), { ok: true, href: 'http://exemple.test/x', hote: 'exemple.test' }, 'signet : l’identifiant collé dans l’adresse est RETIRÉ de l’href (D-T7)');
  eq(S.fabriquerSignet(S.signetModel({ adresse: 'https://u:motdepasse@a.test/p', titre: 'T' }), { newId: () => 'rc-9', langue: 'fr' }).source_url, 'https://a.test/p', 'signet : la fiche écrite ne porte pas le mot de passe (D-T7)');
  for (const mauvais of ['javascript:alert(1)', 'data:text/html,x', 'blob:https://x/y', 'ftp://x.test/f', 'file:///etc/passwd', 'ricardocuisine.com/recettes', '', null])
    eq(S.lienSignet(mauvais).ok, false, `signet : refusé au rendu — ${JSON.stringify(mauvais)}`);
  eq(S.lienSignet('https://xn--caf-dma.test/').hote, 'xn--caf-dma.test', 'signet : hôte IDN en punycode (jamais trompeur)');
  {
    const bon = S.signetModel({ adresse: ' https://exemple.test/r?x=1 ', titre: ' Pâtes ', editionId: '', cuisines: ['italienne'] });
    eq([bon.valide, bon.href, bon.hote, bon.titre, bon.erreurs], [true, 'https://exemple.test/r?x=1', 'exemple.test', 'Pâtes', {}], 'signet : modèle valide, adresse normalisée par URL, titre taillé');
    eq(S.signetModel({ adresse: 'javascript:x', titre: 'T' }).erreurs.adresse, 'Adresse non reconnue.', 'signet : schéma refusé à la saisie');
    eq(S.signetModel({ adresse: 'https://a.test/' + 'x'.repeat(2048), titre: 'T' }).erreurs.adresse, 'Adresse trop longue.', 'signet : > 2 048 refusé dans le modèle');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: '  ' }).erreurs.titre, 'Donne un titre au lien.', 'signet : titre requis');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: 'x'.repeat(301) }).erreurs.titre, 'Titre trop long.', 'signet : titre > 300 refusé');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: 'T' }).valide, true, 'signet : adresse + titre suffisent');
    // D-T7 : `enCours` vit DANS l'état, comme livre-ajout — le bouton se ferme parce que le MODÈLE le dit. `valide`
    // reste la validité de la SAISIE (ce que l'écriture revérifie, S13) ; `peutEnregistrer` est ce que suit le bouton.
    const pendant = S.signetModel({ adresse: 'https://a.test/', titre: 'T', enCours: true });
    eq([pendant.valide, pendant.enCours, pendant.peutEnregistrer], [true, true, false], 'signet : pendant l’écriture, la saisie reste valide mais on ne peut pas enregistrer deux fois (D-T7)');
    eq(S.signetModel({ adresse: 'https://a.test/', titre: 'T' }).peutEnregistrer, true, 'signet : hors écriture, le bouton suit la validité');
    ok([...S.renderSignet({ ...pendant, livres: [] }, {}).querySelectorAll('button')].find((b) => b.textContent === 'Garder le lien').disabled, 'signet : … et le bouton rendu est fermé');
  }
  {
    const rec = S.fabriquerSignet(S.signetModel({ adresse: 'https://a.test/p', titre: 'T', editionId: 'e1', cuisines: ['thaïe'] }), { newId: () => 'rc-1', langue: 'fr' });
    eq(rec, { id: 'rc-1', edition_id: 'e1', original_title: 'T', original_language: 'fr', availability: 'reference_only', verification_state: 'unverified', printed_page: null, section: null, type: null, tags: [], cuisines: ['thaïe'], favorite: false, source_page_ids: [], current_version_id: null, ingredient_ids: [], source_url: 'https://a.test/p', source_label: 'a.test' }, 'signet : une recette-référence, aucune version (I-E)');
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo, db) => {
      const avant = await db.count('recipe_versions');
      const r = await S.enregistrerSignet({ adresse: 'https://a.test/p', titre: 'T', editionId: '', cuisines: [] }, { repo, langue: 'fr' });
      eq([(await db.get('recipes', r.id))?.source_url, await db.count('recipe_versions')], ['https://a.test/p', avant], 'signet : écrit par repo.save, aucune version créée');
      let refuse = false;
      try { await S.enregistrerSignet({ adresse: 'javascript:alert(1)', titre: 'T' }, { repo, langue: 'fr' }); } catch (e) { refuse = e.message === 'signet_invalide'; }
      eq([refuse, (await db.getAll('recipes')).filter((x) => String(x.source_url || '').startsWith('javascript')).length], [true, 0], 'signet : une adresse hostile est refusée à l’ÉCRITURE aussi (S13), rien n’est écrit');
      let refuseLong = false;
      try { await S.enregistrerSignet({ adresse: 'https://a.test/' + 'x'.repeat(2048), titre: 'T' }, { repo, langue: 'fr' }); } catch (e) { refuseLong = e.message === 'signet_invalide'; }
      eq([refuseLong, (await db.getAll('recipes')).filter((x) => String(x.source_url || '').length > 2048).length], [true, 0], 'signet : la BORNE de 2 048 tient aussi à l’écriture (S13), rien n’est écrit');
    });
  }
  {
    const appels = [];
    const m = S.signetModel({ adresse: 'https://a.test/', titre: 'T', editionId: '', cuisines: [] });
    const noeud = S.renderSignet({ ...m, livres: [{ value: '', label: 'Aucun — recette indépendante' }, { value: 'e1', label: 'B · x' }] }, { changerAdresse: (v) => appels.push(['adresse', v]), changerTitre: (v) => appels.push(['titre', v]), changerLivre: (v) => appels.push(['livre', v]), basculerCuisine: () => {}, ajouterCuisine: () => {}, enregistrer: () => appels.push(['enregistrer']) });
    ok(noeud.textContent.includes('L’app n’ouvre pas la page : donne-lui le titre.'), 'signet : l’écran dit qu’aucune page n’est lue');
    const bouton = [...noeud.querySelectorAll('button')].find((b) => b.textContent === 'Garder le lien');
    eq(bouton.disabled, false, 'signet : modèle valide → bouton actif');
    bouton.click();
    eq(appels, [['enregistrer']], 'signet : le geste d’enregistrement');
    const invalide = S.renderSignet({ ...S.signetModel({ adresse: 'x', titre: '' }), livres: [] }, {});
    ok([...invalide.querySelectorAll('button')].find((b) => b.textContent === 'Garder le lien').disabled, 'signet : modèle invalide → bouton désactivé');
    ok(invalide.textContent.includes('Adresse non reconnue.'), 'signet : l’erreur est affichée');
    // R-UX-8 : les puces ne vivent pas dans un <label> — un clic sur le mot « Cuisines » cocherait la première puce.
    const champCuisines = [...noeud.querySelectorAll('.field')].find((f) => f.querySelector('span')?.textContent === 'Cuisines');
    eq([champCuisines?.tagName, !!champCuisines?.querySelector('button.puce')], ['DIV', true], 'signet : « Cuisines » est un <div class="field"> qui porte bien les puces (R-UX-8)');
    eq([...noeud.querySelectorAll('label.field > span')].map((s) => s.textContent), ['Adresse *', 'Titre *', 'Livre (facultatif)'], 'signet : seuls les champs texte et le menu restent des <label>');
    // Taper une adresse invalide doit DIRE pourquoi au lieu de juste éteindre le bouton : l'écran ne contredit
    // jamais l'état réel (une erreur affichée sous un bouton actif, ou l'inverse, serait un mensonge).
    const zone = document.createElement('div');
    zone.append(noeud);
    const boutonMaj = S.majSignet(zone, S.signetModel({ adresse: 'pas une adresse', titre: 'T' }));
    eq([boutonMaj === bouton, bouton.disabled, zone.querySelector('[data-erreur="adresse"]').textContent, zone.querySelector('[data-erreur="adresse"]').hidden], [true, true, 'Adresse non reconnue.', false], 'signet : la frappe met à jour l’erreur ET le bouton, sur place');
    S.majSignet(zone, S.signetModel({ adresse: 'https://b.test/', titre: 'T' }));
    eq([bouton.disabled, zone.querySelector('[data-erreur="adresse"]').textContent, zone.querySelector('[data-erreur="adresse"]').hidden], [false, '', true], 'signet : une adresse redevenue bonne efface l’erreur et rallume le bouton');
  }
  {
    // La route entière (F12 : base JETABLE, `fetch` remplacé par un refus — l'app n'ouvre pas la page, et c'est
    // le montage qui le garantit ; le vrai fetch est rendu dans le finally). I-H : navigate et toast injectés,
    // donc « Garder le lien » est mesurable de bout en bout sans toucher à l'adresse.
    const { withRepo } = await import('./sync-fixture.js');
    const vraiFetch = globalThis.fetch;
    let appelsReseau = 0;
    try {
      globalThis.fetch = async (u) => { appelsReseau += 1; throw new Error(`aucun reseau attendu ici : ${u}`); };
      await withRepo(async (repo, db) => {
    const navs = []; const dits = [];
    const ctx = { book_editions: [{ id: 'e1', book_id: 'b1', year: 2020 }], booksById: new Map([['b1', { title: 'B', author: 'A' }]]), books: [{ cuisines: ['italienne'] }], recipes: [] };
    const root = await S.renderSignetRoute({}, {}, ctx, { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m) });
    ok(root.textContent.includes('Garder un lien web') && root.textContent.includes('Une recette ou une page que tu veux retrouver dans ta bibliothèque.'), 'signet : la route dit d’abord à quoi l’écran sert');
    eq([...root.querySelectorAll('select option')].map((o) => o.textContent), ['Aucun — recette indépendante', 'B · A · 2020'], 'signet : le menu offre « aucun livre » puis les éditions, libellées comme ailleurs');
    ok([...root.querySelectorAll('button.puce')].some((b) => b.textContent === 'Italienne'), 'signet : les cuisines déjà dans la bibliothèque sont offertes en puces');
    const petit = (cle) => root.querySelector(`[data-erreur="${cle}"]`);
    const garder = () => root.querySelector('[data-role="enregistrer"]');
    eq([petit('adresse').textContent, petit('adresse').hidden, petit('titre').textContent, petit('titre').hidden, garder().disabled], ['', true, '', true, true], 'signet : un formulaire vierge n’accuse personne — bouton éteint, aucune erreur affichée');
    const saisir = (libelle, valeur) => {
      const champ = [...root.querySelectorAll('label.field')].find((f) => f.querySelector('span')?.textContent === libelle).querySelector('input');
      champ.value = valeur;
      champ.dispatchEvent(new Event('input'));
    };
    saisir('Adresse *', 'pas une adresse');
    eq([petit('adresse').textContent, petit('adresse').hidden, garder().disabled], ['Adresse non reconnue.', false, true], 'signet : une adresse tapée et illisible le dit tout de suite, le bouton reste éteint');
    const boutonAvant = garder();
    saisir('Adresse *', 'https://a.test/x');
    saisir('Titre *', 'Pad');
    eq([petit('adresse').textContent, petit('adresse').hidden, garder().disabled], ['', true, false], 'signet : l’adresse corrigée efface l’erreur et le bouton s’allume — l’écran ne contredit jamais l’état');
    ok(garder() === boutonAvant, 'signet : c’est le MÊME nœud bouton après la frappe — rien n’a été redessiné, le curseur n’a pas sauté (D-T7)');
    // D-T7/I-H : le geste réel, de bout en bout. Une recette-référence est écrite, et on part vers sa fiche.
    const avantRecettes = await db.count('recipes');
    garder().click();
    eq(await attendreFait(async () => navs.length > 0), true, 'signet : « Garder le lien » mène quelque part');
    const gardee = (await db.getAll('recipes')).find((r) => r.source_url === 'https://a.test/x');
    eq([(await db.count('recipes')) - avantRecettes, gardee?.original_title, gardee?.availability, navs, dits, appelsReseau],
      [1, 'Pad', 'reference_only', [`/recipes/${gardee?.id}`], ['Lien gardé'], 0],
      'signet : « Garder le lien » écrit UNE recette-référence, le dit, mène à sa fiche, et n’appelle aucun réseau (RF-I1, F12)');
      });
    } finally { globalThis.fetch = vraiFetch; }
  }
  {
    // Vue recette : pastille et branche « Lien web gardé » (F8, S6, S7)
    const { availabilityBadge, provenanceText } = await import('../src/ui/components.js');
    eq(availabilityBadge({ availability: 'reference_only', source_url: 'https://a.test/' }).textContent, 'Lien web', 'pastille : un signet n’est pas « Repérée dans ton livre »');
    eq(availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, 'Repérée dans ton livre — page 12', 'pastille : les références d’index inchangées');
    // R-UX-11 (S7) : dans les CARTES DE LISTE aussi, l'hôte vient de l'adresse — jamais du libellé stocké, qu'une
    // archive ou le serveur peut avoir rempli avec n'importe quoi. La vue recette le faisait déjà, pas les listes.
    eq(provenanceText({ source_url: 'https://a.test/x', source_label: 'ment.test' }, null, null), 'a.test', 'provenance : un signet montre l’hôte recalculé depuis l’adresse (S7)');
    const faux = provenanceText({ source_url: 'javascript:alert(1)', source_label: 'ment.test' }, null, null);
    eq([faux, faux.includes('ment.test')], ['Adresse non reconnue', false], 'provenance : une adresse hostile ne laisse pas le libellé stocké prendre sa place');
    eq(provenanceText({ source_label: 'Recette de famille' }, null, null), 'Recette de famille', 'provenance : sans source_url, le libellé libre d’une recette saisie à la main est intact');
    // C10 : un signet rattaché à un livre portait le livre et PERDAIT son hôte — alors que c'est une page web
    // rangée dans un livre, pas une page du livre (F22 demandait les deux). Les deux s'affichent, hôte recalculé.
    eq(provenanceText({ source_url: 'https://a.test/x', source_label: 'ment.test', printed_page: 12 }, { title: 'B', author: 'A' }, null), 'B — A · page 12 · a.test', 'provenance : un signet rattaché à un livre montre le livre ET son hôte recalculé (C10, F22)');
    eq(provenanceText({ source_url: 'javascript:alert(1)', source_label: 'ment.test' }, { title: 'B' }, null), 'B · Adresse non reconnue', 'provenance : avec un livre aussi, une adresse hostile ne laisse pas le libellé stocké prendre sa place (C10, S7)');
    eq(provenanceText({ printed_page: 7 }, { title: 'B', author: 'A' }, null), 'B — A · page 7', 'provenance : une recette de livre sans adresse est inchangée');
    eq(provenanceText({}, null, null), 'Source personnelle', 'provenance : rien du tout → source personnelle');
    const { blocSignet } = await import('../src/ui/recipe.js');
    const sain = blocSignet({ source_url: 'https://a.test/x', source_label: 'ment.test' });
    const a = sain.querySelector('a');
    eq([a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.textContent], ['https://a.test/x', '_blank', 'noopener noreferrer', 'Ouvrir le lien'], 'signet : lien revalidé au rendu, noopener noreferrer');
    ok(sain.textContent.includes('a.test') && !sain.textContent.includes('ment.test'), 'signet : l’hôte affiché vient de l’adresse, jamais du libellé stocké (S7)');
    ok(sain.textContent.includes('Lien web gardé.') && !sain.textContent.includes('Scanner cette recette'), 'signet : texte propre, aucun geste de scan');
    const hostile = blocSignet({ source_url: 'javascript:alert(1)' });
    eq([hostile.querySelectorAll('a').length, hostile.textContent.includes('javascript:alert(1)')], [0, true], 'signet : adresse hostile en base → aucun <a>, texte inerte (S6)');
    // S7 : une adresse refusée est affichée INERTE et BORNÉE — une fiche venue d'une archive peut en porter
    // 100 000 caractères, qui pousseraient la fiche entière hors de l'écran.
    const { adresseInerte } = await import('../src/ui/recipe.js');
    eq([adresseInerte('x'.repeat(200)).length, adresseInerte('x'.repeat(201)).length, adresseInerte('x'.repeat(201)).endsWith('…'), adresseInerte(null)], [200, 201, true, ''], 'signet : l’adresse refusée est coupée à 200 caractères, suivie d’un signe de coupe (S7)');
    const tresLongue = blocSignet({ source_url: 'tel:' + '9'.repeat(5000) });
    eq([tresLongue.querySelectorAll('a').length, tresLongue.textContent.length < 400], [0, true], 'signet : une adresse de 5 000 caractères n’emporte pas l’écran (S7)');
    // S8 : les surfaces qui n'affichent qu'un TEXTE (repas, exports) recalculent l'hôte elles aussi.
    const { libelleSource } = await import('../src/core/lien.js');
    eq([libelleSource({ source_url: 'https://a.test/x', source_label: 'ment.test' }), libelleSource({ source_url: 'javascript:x', source_label: 'ment.test' }), libelleSource({ source_label: 'Recette de famille' }), libelleSource({}), libelleSource(null)],
      ['a.test', '', 'Recette de famille', '', ''], 'source : hôte recalculé dès qu’une adresse existe, rien du tout si elle est illisible, et le libellé libre d’une saisie à la main intact (S8)');
    const { toPaprikaYaml } = await import('../src/domain/exporters.js');
    const yamlSignet = toPaprikaYaml([{ recipe: { id: 'r9', original_title: 'Pad', source_url: 'https://a.test/x', source_label: 'ment.test' }, version: null, book: null, edition: {} }]);
    eq([yamlSignet.includes('source: "a.test"'), yamlSignet.includes('ment.test')], [true, false], 'export Paprika : la source d’un signet est l’hôte recalculé, jamais le libellé stocké (S8)');
  }
  {
    const { buildDocs, searchDocs, parseQuery } = await import('../src/domain/search.js');
    // R-UX-2, mesuré ici : « thaïe » n'est ni un type, ni un régime, ni un ingrédient — il reste du TEXTE.
    const p = parseQuery('thaïe');
    eq([p.terms, p.filters.type, p.filters.diets, p.filters.include], [['thaie'], null, [], []], 'recherche : « thaïe » reste du texte, aucun filtre (R-UX-2)');
    const docs = buildDocs({ recipes: [{ id: 'r1', original_title: 'Pad', availability: 'reference_only', cuisines: ['thaïe'], source_url: 'https://a.test/' }], versions: [], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
    eq(searchDocs(docs, parseQuery('thaïe'), { mode: 'all' }).references.map((r) => r.doc.recipe.id), ['r1'], 'recherche : un signet se trouve par une cuisine (F7)');
    // Une référence d'index n'a pas de cuisines : la ligne touchée ne doit rien changer pour elle.
    const idx = buildDocs({ recipes: [{ id: 'r2', original_title: 'Pad', availability: 'reference_only', printed_page: 12, cuisines: [] }], versions: [], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
    eq(searchDocs(idx, parseQuery('thaïe'), { mode: 'all' }).references.length, 0, 'recherche : une référence d’index sans cuisine ne remonte pas par une cuisine');
  }
  // --- § 6 Images : en-têtes lus avant tout décodage, ré-encodage systématique (S4, S5, F11)
  const IM = await import('../src/core/image.js');
  const { COVER_INPUT_MIME } = await import('../src/sync/mime.js');
  eq(COVER_INPUT_MIME, ['image/jpeg', 'image/png', 'image/webp'], 'image : types admis pour une couverture reçue du réseau (F20)');
  // S6 : 16 Mpx (4 000 × 4 000) et non 50 — au-delà, aucune couverture de livre n'a de raison d'être, et le canvas
  // d'un téléphone renonce bien avant (une photo de 48 Mpx est un cas réel, pas une couverture).
  eq(IM.LIMITES_COUVERTURE, { octetsDistants: 5242880, octetsLocaux: 26214400, pixels: 16000000, maxCote: 1200, qualite: 0.85 }, 'image : bornes de la spec (16 Mpx, S6)');
  // En-têtes fabriqués à la main : aucun décodeur n'est appelé.
  const u8 = (...a) => new Uint8Array(a);
  const png = (w, h) => new Blob([u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, h >>> 24, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, 8, 2, 0, 0, 0)], { type: 'image/png' });
  const jpeg = (w, h) => new Blob([u8(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1)], { type: 'image/jpeg' });
  const webpVp8x = (w, h) => { const W = w - 1, H = h - 1; return new Blob([u8(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0, W & 255, (W >> 8) & 255, (W >> 16) & 255, H & 255, (H >> 8) & 255, (H >> 16) & 255)], { type: 'image/webp' }); };
  eq(await IM.dimensionsImage(png(640, 480)), { largeur: 640, hauteur: 480, type: 'image/png' }, 'image : IHDR PNG');
  eq(await IM.dimensionsImage(jpeg(1200, 800)), { largeur: 1200, hauteur: 800, type: 'image/jpeg' }, 'image : SOF0 JPEG après un segment APP0');
  eq(await IM.dimensionsImage(webpVp8x(300, 200)), { largeur: 300, hauteur: 200, type: 'image/webp' }, 'image : VP8X WebP');
  eq(await IM.dimensionsImage(png(20000, 20000)), { largeur: 20000, hauteur: 20000, type: 'image/png' }, 'image : un PNG 20 000 × 20 000 est MESURÉ sans être décodé (S4)');
  eq(await IM.dimensionsImage(new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })), null, 'image : en-tête inconnu → null');
  eq(await IM.dimensionsImage(new Blob([u8(0xff, 0xd8, 0xff)], { type: 'image/jpeg' })), null, 'image : JPEG tronqué → null, pas d’exception');
  {
    // Vraie image générée au canvas : 2 000 px de large → JPEG ≤ 1 200 ; une petite image est ré-encodée QUAND MÊME.
    const canvas = document.createElement('canvas'); canvas.width = 2000; canvas.height = 1000;
    const c2 = canvas.getContext('2d'); c2.fillStyle = '#4a7'; c2.fillRect(0, 0, 2000, 1000); c2.fillStyle = '#fff'; c2.fillRect(100, 100, 600, 300);
    const grand = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const reduit = await IM.reduireImage(grand, { maxCote: 1200, qualite: 0.85 });
    const dims = await IM.dimensionsImage(reduit);
    eq([reduit.type, dims.largeur, dims.hauteur], ['image/jpeg', 1200, 600], 'image : réduit au grand côté 1 200, proportions gardées, JPEG');
    const petit = document.createElement('canvas'); petit.width = 40; petit.height = 30;
    petit.getContext('2d').fillRect(0, 0, 40, 30);
    const petitPng = await new Promise((r) => petit.toBlob(r, 'image/png'));
    const petitReduit = await IM.reduireImage(petitPng);
    eq([petitReduit.type, (await IM.dimensionsImage(petitReduit)).largeur], ['image/jpeg', 40], 'image : une petite image passe au canvas quand même (type prouvé, métadonnées retirées)');
    let code = null;
    try { await IM.reduireImage(new Blob(['pas une image'], { type: 'image/png' })); } catch (e) { code = e.code; }
    eq(code, 'indecodable', 'image : un blob indécodable lève ErreurImage(indecodable)');
  }
  // --- § 6 Couverture : réception bornée, ré-encodage, pointeur souple, affichage, URL blob révoquées
  const BU = await import('../src/core/blob-urls.js');
  {
    // F13 : le compte de ce bloc ne vaut que si le registre part VIDE — un test d'avant peut avoir laissé une URL
    // vivante, et « 2 révoquées » devenait alors un hasard.
    BU.revoquerUrlsDeBlob();
    const revoques = [];
    const orig = URL.revokeObjectURL;
    URL.revokeObjectURL = (u) => { revoques.push(u); return orig.call(URL, u); };
    try {
      const u1 = BU.urlDeBlob(new Blob(['a'])), u2 = BU.urlDeBlob(new Blob(['b']));
      ok(u1.startsWith('blob:') && u2.startsWith('blob:'), 'blob-urls : des URL d’objet');
      eq([BU.revoquerUrlsDeBlob(), revoques.sort(), BU.revoquerUrlsDeBlob()], [2, [u1, u2].sort(), 0], 'blob-urls : tout révoqué une fois, puis plus rien (F4/S15)');
      // D-T9 : révoquer UNE URL connue (le cas de library.js, qui remplace sa grille à chaque touche du filtre et
      // ne peut pas « tout » révoquer sans emporter les vignettes qu'il vient de créer).
      const u3 = BU.urlDeBlob(new Blob(['c']));
      const inconnue = URL.createObjectURL(new Blob(['d']));
      try {
        eq([BU.revoquerUrlDeBlob(u3), BU.revoquerUrlDeBlob(u3), BU.revoquerUrlDeBlob(inconnue), BU.revoquerUrlsDeBlob()], [true, false, false, 0],
          'blob-urls : une URL connue est révoquée une seule fois, et celle d’autrui n’est jamais touchée (D-T9)');
        ok(revoques.includes(u3) && !revoques.includes(inconnue), 'blob-urls : … mesuré sur l’espion, pas sur la valeur de retour seule');
      } finally { URL.revokeObjectURL = orig; URL.revokeObjectURL(inconnue); }
    } finally { URL.revokeObjectURL = orig; }
  }
  {
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo) => {
      await repo.putFile('aaa', new Blob(['x'], { type: 'image/jpeg' }), { mime: 'image/jpeg' });
      const m = await repo.getFiles(['aaa', 'absent']);
      eq([m.size, m.get('aaa')?.mime, m.has('absent')], [1, 'image/jpeg', false], 'repo.getFiles : une transaction, les absents ne figurent pas');
    });
  }
  eq(LA.URL_COUVERTURE_OL('9782761950001'), 'https://covers.openlibrary.org/b/isbn/9782761950001-L.jpg?default=false', 'couverture : adresse Open Library avec default=false');
  {
    const reponseBlob = (status, blob, ct = blob.type, longueur = blob.size) => ({ ok: status < 400, status, headers: new Headers({ 'content-type': ct, 'content-length': String(longueur) }), blob: async () => blob });
    const bonPng = png(400, 600);
    ok((await LA.recupererCouvertureParIsbn('978', { fetch: async (u, o) => { eq(o.credentials, 'omit', 'couverture : options S12'); return reponseBlob(200, bonPng); } })) instanceof Blob, 'couverture : 200 image/png → blob');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(404, new Blob([''], { type: 'image/jpeg' })) }), null, 'couverture : 404 → null');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, new Blob(['<html>'], { type: 'text/html' })) }), null, 'couverture : type hors liste → null');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, bonPng, 'image/png', 6 * 1024 * 1024) }), null, 'couverture : Content-Length 6 Mo → null AVANT de lire le corps');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, png(20000, 20000)) }), null, 'couverture : 400 Mpx annoncés par l’en-tête → null, jamais décodé');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => { throw new Error('cors'); } }), null, 'couverture : rejet (CORS/réseau) → null, aucune exception');
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => reponseBlob(200, png(400, 600), 'image/webp') }), null, 'couverture : le type ANNONCÉ doit être celui du conteneur réel, sinon null');
    // « AVANT de lire le corps » est une affirmation : elle se mesure par un espion sur blob(), pas par le résultat.
    let lectures = 0;
    const espion = (longueur) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-length': String(longueur) }), blob: async () => { lectures += 1; return bonPng; } });
    await LA.recupererCouvertureParIsbn('978', { fetch: async () => espion(6 * 1024 * 1024) });
    const apresRefus = lectures;
    await LA.recupererCouvertureParIsbn('978', { fetch: async () => espion(bonPng.size) });
    eq([apresRefus, lectures], [0, 1], 'couverture : le corps d’une réponse trop lourde n’est JAMAIS lu, celui d’une réponse bornée l’est');
  }
  {
    // R-UX-12 : Open Library n’envoie PAS de Content-Length (mesuré le 14 octobre, [200, image/jpeg], en-tête absent).
    // Sans en-tête, la borne « avant lecture » n’existe pas : le corps doit être lu EN FLUX et la lecture COUPÉE dès
    // le dépassement. Aucun blob() ici — y tomber ferait échouer les deux cas (le stub lève).
    const enFlux = (body) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png' }), body, blob: async () => { throw new Error('blob() ne doit pas etre appele quand il y a un flux'); } });
    // Corps sans fin, 1 Mo par morceau. Garde-fou à 64 morceaux : sans coupure le test ÉCHOUE au lieu de boucler.
    const espion = { octetsEmis: 0, morceaux: 0, annule: false };
    const sansFin = new ReadableStream({
      pull(c) {
        if (espion.morceaux >= 64) { c.close(); return; }
        espion.morceaux += 1; espion.octetsEmis += 1024 * 1024;
        c.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel() { espion.annule = true; },
    });
    eq(await LA.recupererCouvertureParIsbn('978', { fetch: async () => enFlux(sansFin) }), null, 'couverture : sans Content-Length, un corps au-delà de 5 Mo → null (R-UX-12)');
    eq([espion.annule, espion.octetsEmis <= 7 * 1024 * 1024, espion.octetsEmis >= 5 * 1024 * 1024], [true, true, true], 'couverture : la lecture est ANNULÉE dès le dépassement — au plus 7 Mo tirés d’un corps sans fin, jamais les 64 (R-UX-12)');
    // Un vrai PNG découpé en trois morceaux : rassemblé tel quel, et ses dimensions restent lisibles dans l’en-tête.
    const octets = new Uint8Array(await png(400, 600).arrayBuffer());
    const tiers = new ReadableStream({ start(c) { c.enqueue(octets.slice(0, 10)); c.enqueue(octets.slice(10, 20)); c.enqueue(octets.slice(20)); c.close(); } });
    const recu = await LA.recupererCouvertureParIsbn('978', { fetch: async () => enFlux(tiers) });
    eq([recu instanceof Blob, recu?.size, recu?.type], [true, octets.length, 'image/png'], 'couverture : un corps en flux est rassemblé octet pour octet, type posé (R-UX-12)');
  }
  {
    const { withRepo } = await import('./sync-fixture.js');
    await withRepo(async (repo, db) => {
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 2000;
      canvas.getContext('2d').fillRect(0, 0, 1600, 2000);
      const photo = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const { sha256 } = await LA.poserCouverture(photo, { origine: 'locale', repo });
      const ligne = await db.get('files', sha256);
      eq([ligne.mime, ligne.blob.type, (await IM.dimensionsImage(ligne.blob)).hauteur], ['image/jpeg', 'image/jpeg', 1200], 'couverture : stockée ré-encodée en JPEG 1 200 px, ligne files locale');
      eq((await db.getAll('outbox')).filter((o) => o.store === 'files').length, 0, 'couverture : la ligne files n’entre pas en file (R58)');
      const encore = await LA.poserCouverture(photo, { origine: 'locale', repo });
      eq(encore.sha256, sha256, 'couverture : putFile idempotent (F10)');
      eq(await db.count('files'), 1, 'couverture : putFile idempotent — la seconde pose n’a écrit AUCUNE ligne de plus (F10, mesuré)');
      let code = null;
      try { await LA.poserCouverture(new Blob(['x'], { type: 'image/png' }), { origine: 'locale', repo }); } catch (e) { code = e.code; }
      eq(code, 'indecodable', 'couverture : indécodable → refus nommé (F11)');
      // S2 : le mur de pixels ne gardait que la couverture REÇUE. Une image CHOISIE de 20 000 × 20 000 (400 Mpx,
      // 1,6 Go décompressés) allait droit à createImageBitmap. L'en-tête est lu avant, et le décodeur n'est jamais
      // appelé : mesuré par un compteur qui remplace createImageBitmap, remis en place dans le finally.
      const vraiBitmap = globalThis.createImageBitmap;
      let decodages = 0;
      let codeGrande = null;
      let ecritures = 0;
      const repoCompteur = { putFile: async () => { ecritures += 1; } };
      try {
        globalThis.createImageBitmap = async (...a) => { decodages += 1; return vraiBitmap.call(globalThis, ...a); };
        try { await LA.poserCouverture(png(20000, 20000), { origine: 'locale', repo: repoCompteur }); } catch (e) { codeGrande = e.code; }
      } finally { globalThis.createImageBitmap = vraiBitmap; }
      eq([codeGrande, decodages, ecritures], ['trop_grande', 0, 0], 'couverture : 400 Mpx choisis ici → refus nommé AVANT tout décodage, createImageBitmap jamais appelé (S2)');
      // RF-m10 : les deux autres refus de poserCouverture, chacun par son chemin.
      let codeType = null;
      try { await LA.poserCouverture(new Blob(['<html>'], { type: 'text/html' }), { origine: 'locale', repo: repoCompteur }); } catch (e) { codeType = e.code; }
      let codeLourd = null;
      try { await LA.poserCouverture(new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/jpeg' }), { origine: 'distante', repo: repoCompteur }); } catch (e) { codeLourd = e.code; }
      eq([codeType, codeLourd, ecritures], ['type', 'trop_lourde', 0], 'couverture : un type hors liste blanche et un corps au-delà de la borne sont refusés nommément, sans écrire (RF-m10)');
      const { messageErreurImage } = LA;
      eq([messageErreurImage({ code: 'trop_grande' }), messageErreurImage({ code: 'trop_lourde' }), messageErreurImage({ code: 'indecodable' }), messageErreurImage(null)],
        ['Cette image est trop grande.', 'Cette image est trop lourde (25 Mo au plus).', 'Cette image ne peut pas être lue ici. Essaie une autre photo.', 'Cette image ne peut pas être lue ici. Essaie une autre photo.'],
        'couverture : chaque refus a sa phrase, et une cause inconnue ne se déguise pas en « trop lourde » (S2)');
      // bookCover avec et sans fichier
      const { bookCover } = await import('../src/ui/components.js');
      const avec = bookCover({ id: 'e1', cover_sha256: sha256 }, { title: 'T' }, { fichier: ligne });
      ok(avec.querySelector('img.cover-img') && avec.querySelector('.cover').classList.contains('with-img'), 'bookCover : fichier présent → <img>');
      eq(avec.querySelector('img.cover-img').getAttribute('alt'), 'T', 'bookCover : l’image PORTE le nom du livre — le texte est caché, le lien doit rester nommé (R-UX-14)');
      const anonyme = bookCover({ id: 'e2' }, null, { fichier: ligne });
      eq(anonyme.querySelector('img').getAttribute('alt'), '', 'bookCover : sans titre connu, l’image reste décorative (alt vide), jamais un nom inventé');
      // Poser un src lance le chargement même hors document : révoquer avant la fin donnerait une erreur console
      // (net::ERR_FILE_NOT_FOUND). On attend donc la fin réelle du chargement avant de rendre les URL.
      await Promise.all([avec, anonyme].flatMap((n) => [...n.querySelectorAll('img')]).map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
      const sans = bookCover({ id: 'e1', cover_sha256: sha256 }, { title: 'T' }, {});
      eq([sans.querySelector('img'), sans.querySelector('.title').textContent], [null, 'T'], 'bookCover : pointeur sans fichier (autre appareil avant L4) → vignette texte, sans message');
      // S3 : une ligne files peut venir d'une archive ou du serveur et porter n'importe quel `mime` sur n'importe
      // quel blob. Le type d'affichage passe par la liste blanche ET doit être une image — sinon vignette texte,
      // jamais une URL d'objet posée sur un blob text/html.
      const menteuse = { sha256: 'xyz', mime: 'application/octet-stream', blob: new Blob(['<html><p>x</p></html>'], { type: 'text/html' }) };
      const vignette = bookCover({ id: 'e3' }, { title: 'Menteuse' }, { fichier: menteuse });
      eq([vignette.querySelectorAll('img').length, vignette.querySelector('.title').textContent, vignette.querySelector('.cover').classList.contains('with-img')], [0, 'Menteuse', false],
        'bookCover : un mime hors liste blanche sur un blob text/html → aucune image, vignette texte (S3)');
      eq(bookCover({ id: 'e4' }, { title: 'PDF' }, { fichier: { mime: 'application/pdf', blob: new Blob(['%PDF-'], { type: 'application/pdf' }) } }).querySelectorAll('img').length, 0,
        'bookCover : un PDF est dans la liste blanche mais n’est pas une image — pas de vignette (S3)');
      eq([avec.getAttribute('aria-label'), anonyme.getAttribute('aria-label')], ['T', 'Sans titre'],
        'bookCover : l’ancre porte toujours un nom, même quand l’image reste décorative (D-T9)');
      BU.revoquerUrlsDeBlob();
    });
  }
  {
    const appels = [];
    const zone = LA.renderZoneCouverture({ sha256: null, apercu: null, message: 'Aucune couverture reçue. Tu peux la photographier.', enCours: false }, { photographier: () => appels.push('photo'), choisir: () => appels.push('choisir'), retirer: () => appels.push('retirer') });
    ok(zone.classList.contains('zone-couverture') && zone.textContent.includes('Aucune couverture reçue.'), 'couverture : la zone dit l’état réel (I-B)');
    eq([...zone.querySelectorAll('button')].map((b) => b.textContent), ['Photographier', 'Choisir une image'], 'couverture : sans image, pas de « Retirer »');
    // Un aperçu factice doit être une image que le navigateur sait charger : « blob:fake » ferait une erreur console
    // (« Not allowed to load local resource »), et la suite exige 0 erreur. GIF 1 × 1 transparent, autorisé par la CSP.
    const APERCU = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const avecImg = LA.renderZoneCouverture({ sha256: 'x', apercu: APERCU, message: null, enCours: false }, { photographier: () => {}, choisir: () => {}, retirer: () => appels.push('retirer') });
    eq(avecImg.querySelector('img')?.getAttribute('src'), APERCU, 'couverture : avec une image, l’aperçu est affiché tel qu’il est donné');
    [...avecImg.querySelectorAll('button')].find((b) => b.textContent === 'Retirer').click();
    eq(appels, ['retirer'], 'couverture : « Retirer » appelle son geste (ce qu’il écrit est mesuré plus bas, sur une base jetable)');
    // F9/RF-m4 : pendant le ré-encodage d'une photo de téléphone, AUCUN des trois boutons ne répond — « Retirer »
    // compris, sinon le pointeur partait à null pendant qu'une écriture de couverture était en vol.
    const pendant = LA.renderZoneCouverture({ sha256: 'x', apercu: null, message: null, enCours: true }, { photographier: () => {}, choisir: () => {}, retirer: () => {} });
    eq([...pendant.querySelectorAll('button')].map((b) => [b.textContent, b.disabled]), [['Photographier', true], ['Choisir une image', true], ['Retirer', true]], 'couverture : pendant une écriture, les trois boutons sont fermés (F9, RF-m4)');
  }
  // --- § 6 Couverture, la ROUTE : une couverture appartient à l’ISBN qui l’a demandée (R-UX-13)
  {
    const { withRepo } = await import('./sync-fixture.js');
    const vraiFetch = globalThis.fetch;
    // La route lit globalThis.fetch (elle ne prend pas de fetch injecté) : il est stubbé ici, restauré en finally.
    // Aucun réseau : chaque adresse attendue a sa réponse factice, et toute autre répond 404.
    // F4 : on n'attend plus un DÉLAI, on attend un FAIT. `etatRoute()` (posé par la route pour les tests) compte
    // les passages du rappel de couverture : le rappel ENTRÉ est le dernier moment où la garde peut encore céder,
    // donc affirmer après lui n'est plus une course gagnée par chance.
    const attendre = async (condition, quoi) => {
      for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); }
      throw new Error(`attente dépassée (3 s) : ${quoi}`);
    };
    const attendreImages = (n) => Promise.all([...n.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
    try {
      await withRepo(async (repo, db) => {
        // De VRAIES images : poserCouverture décode par createImageBitmap, un en-tête fabriqué échouerait (F11).
        // Une taille DIFFÉRENTE par ISBN : les empreintes diffèrent, donc « aucune ligne files écrite » est un fait
        // mesurable (avec la même image partout, putFile serait idempotent et le compte ne bougerait jamais).
        const imageDe = async (w, h) => {
          const toile = document.createElement('canvas'); toile.width = w; toile.height = h;
          toile.getContext('2d').fillRect(0, 0, w, h);
          return new Promise((r) => toile.toBlob(r, 'image/png'));
        };
        const [img111, img333, img555a, img555b, img777, img999, img1234] = await Promise.all([imageDe(120, 160), imageDe(130, 170), imageDe(140, 180), imageDe(150, 190), imageDe(160, 200), imageDe(170, 210), imageDe(180, 220)]);
        const urls = [];
        const couvertures = new Map(); // isbn → fonction qui rend la réponse (le test maîtrise le moment)
        const fichesLentes = new Map(); // isbn → promesse à libérer AVANT la réponse d'identification
        const sansFicheOl = new Set();
        const r404 = { ok: false, status: 404, headers: new Headers(), text: async () => '', blob: async () => new Blob([]) };
        const reponseImage = (png) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-length': String(png.size) }), blob: async () => png });
        globalThis.fetch = async (url) => {
          const u = String(url);
          urls.push(u);
          if (u.startsWith('https://covers.openlibrary.org/')) {
            const isbn = u.slice(u.indexOf('/b/isbn/') + 8).split('-L')[0];
            const donner = couvertures.get(isbn);
            return donner ? await donner() : r404;
          }
          if (u.startsWith('https://openlibrary.org/api/books')) {
            const isbn = u.split('ISBN:')[1].split('&')[0];
            const lente = fichesLentes.get(isbn);
            if (lente) await lente;
            if (sansFicheOl.has(isbn)) return r404;
            return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ [`ISBN:${isbn}`]: { title: `Livre ${isbn}`, authors: [], publishers: [], publish_date: '2020' } }) };
          }
          if (u.startsWith('https://www.googleapis.com/books/')) {
            return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ items: [{ volumeInfo: { title: 'Livre de Google', authors: [], publishedDate: '2019', language: 'en' } }] }) };
          }
          return r404;
        };
        const zone = (root) => root.querySelector('.zone-couverture');
        const image = (root) => !!zone(root)?.querySelector('img');
        const message = (root) => zone(root)?.querySelector('small')?.textContent || null;
        const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
        const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); return b; };
        const saisirTitre = (root, v) => { const i = [...root.querySelectorAll('input[type="text"]')].find((x) => x.name !== 'isbn'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
        const passages = (root) => root.etatRoute().passagesCouverture;
        const compterFiles = async () => (await db.getAll('files')).length;
        const RIEN = 'Aucune couverture reçue. Tu peux la photographier.';
        const ILLISIBLE = 'La couverture reçue n’a pas pu être lue.';

        // 1. Une couverture reçue ne survit pas à l’ISBN qui l’a produite.
        couvertures.set('111', async () => reponseImage(img111));
        const r1 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r1, '111'); cliquer(r1, 'Identifier');
        await attendre(() => image(r1), 'la couverture de 111 est affichée');
        eq(message(r1), 'Couverture reçue d’Open Library.', 'route : la couverture reçue d’Open Library est annoncée, image à l’appui (I-B)');
        cliquer(r1, '← Changer d’ISBN');
        taper(r1, '222'); cliquer(r1, 'Identifier');
        await attendre(() => message(r1) === RIEN, 'la réponse pour 222 (aucune couverture)');
        eq(image(r1), false, 'route : la couverture de l’ISBN précédent ne survit pas à une nouvelle identification (R-UX-13)');
        await attendreImages(r1);

        // 2. Une réponse tardive appartient à SA demande : celle d’un ISBN abandonné est ignorée.
        let libererA = null;
        couvertures.set('333', async () => { await new Promise((r) => { libererA = r; }); return reponseImage(img333); });
        const r2 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r2, '333'); cliquer(r2, 'Identifier');
        await attendre(() => zone(r2) && libererA, 'la demande de couverture de 333 est en vol');
        cliquer(r2, '← Changer d’ISBN');
        taper(r2, '444'); cliquer(r2, 'Identifier');
        await attendre(() => message(r2) === RIEN, 'la réponse pour 444 (aucune couverture)');
        const files333 = await compterFiles();
        libererA();
        // F4 : le FAIT attendu est le rappel de la réponse tardive ENTRÉ (compté avant toute garde) — plus un délai.
        await attendre(() => passages(r2) >= 2, 'le rappel de la réponse tardive de 333 est entré');
        eq([image(r2), message(r2), await compterFiles()], [false, RIEN, files333],
          'route : la réponse tardive d’un ISBN abandonné n’écrit RIEN — ni à l’écran, ni une ligne files (R-UX-13)');
        await attendreImages(r2);

        // 3. « Retirer » tient devant une réponse tardive du MÊME ISBN (touchee) : ici l’ISBN ne peut rien trancher.
        let libererB = null;
        let tours = 0;
        couvertures.set('555', async () => { tours += 1; if (tours === 1) { await new Promise((r) => { libererB = r; }); return reponseImage(img555a); } return reponseImage(img555b); });
        const r3 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r3, '555'); cliquer(r3, 'Identifier');
        await attendre(() => zone(r3) && libererB, 'la 1re demande de couverture de 555 est en vol');
        cliquer(r3, '← Changer d’ISBN');
        taper(r3, '555'); cliquer(r3, 'Identifier');
        await attendre(() => image(r3), 'la 2e demande de 555 a posé la couverture');
        cliquer(r3, 'Retirer');
        eq([image(r3), message(r3)], [false, null], 'route : « Retirer » vide la zone sur-le-champ');
        const files555 = await compterFiles();
        libererB();
        await attendre(() => passages(r3) >= 2, 'le rappel de la réponse tardive de la 1re demande est entré');
        eq([image(r3), await compterFiles()], [false, files555],
          'route : une réponse tardive ne remet pas une couverture que la personne vient de retirer, et n’écrit aucune ligne files (R-UX-13)');
        await attendreImages(r3);

        // 5. Dernière porte : revenir changer l’ISBN SANS le changer, laisser la réponse de l’ancien arriver
        // (invisible au pas 1), puis « Saisir à la main » — une fiche saisie à la main n’a jamais de couverture reçue.
        let libererC = null;
        couvertures.set('777', async () => { await new Promise((r) => { libererC = r; }); return reponseImage(img777); });
        const r5 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r5, '777'); cliquer(r5, 'Identifier');
        await attendre(() => zone(r5) && libererC, 'la demande de couverture de 777 est en vol');
        cliquer(r5, '← Changer d’ISBN');
        const files777 = await compterFiles();
        libererC();
        await attendre(() => passages(r5) >= 1, 'le rappel de la réponse tardive de 777 est entré');
        cliquer(r5, 'Saisir à la main');
        eq([image(r5), message(r5), await compterFiles()], [false, null, files777],
          'route : une fiche saisie à la main ne porte jamais la couverture reçue pour l’ISBN abandonné (R-UX-13)');
        await attendreImages(r5);

        // 4. La couverture n’est demandée QUE si Open Library a identifié le livre (I-A : provenance étiquetée).
        // RF-m9 : le fait attendu est l’adresse Google Books APPARUE dans les appels — pas 200 ms au hasard.
        sansFicheOl.add('666');
        const avant = urls.length;
        const r4 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r4, '666'); cliquer(r4, 'Identifier');
        await attendre(() => urls.slice(avant).some((u) => u.startsWith('https://www.googleapis.com/books/')), 'l’appel de repli à Google Books');
        await attendre(() => zone(r4), 'le pas 2 pour 666');
        const depuis = urls.slice(avant);
        eq([depuis.some((u) => u.startsWith('https://covers.openlibrary.org/')), depuis.some((u) => u.startsWith('https://www.googleapis.com/books/')), r4.textContent.includes('Renseigné par Google Books')],
          [false, true, true], 'route : une fiche venue de Google Books ne demande AUCUNE couverture à Open Library (I-A)');
        eq([message(r4), passages(r4)], [null, 0], 'route : sans demande de couverture, la zone ne raconte rien et aucun rappel n’est entré (I-B)');

        // 6. F3 : « Saisir à la main » PENDANT « Recherche… ». La réponse d’identification est encore en vol et
        // n’appartient plus à cet écran : ni ses champs, ni son étiquette, ni la couverture qu’elle aurait demandée.
        let libererFiche = null;
        fichesLentes.set('888', new Promise((r) => { libererFiche = r; }));
        couvertures.set('888', async () => reponseImage(img111));
        const r6 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r6, '888'); cliquer(r6, 'Identifier');
        await attendre(() => r6.etatRoute().recherche, 'la recherche de 888 est annoncée');
        cliquer(r6, 'Saisir à la main');
        eq([r6.etatRoute().pas, !!zone(r6)], [2, true], 'route : « Saisir à la main » pendant la recherche ouvre le pas 2 tout de suite');
        const files888 = await compterFiles();
        libererFiche();
        await attendre(() => r6.etatRoute().recherche === false, 'la réponse de 888 est traitée');
        eq([r6.etatRoute().champs.title, r6.etatRoute().provenance, r6.querySelector('.status.info'), passages(r6), await compterFiles()],
          ['', null, null, 0, files888],
          'route : la fiche arrivée après « Saisir à la main » n’écrit RIEN — aucun champ, aucune étiquette, aucune couverture demandée (F3, C1)');
        await attendreImages(r6);

        // 7. C1 : la garde était évaluée AVANT poserCouverture et jamais relue. Deux gestes PENDANT le ré-encodage
        // (qui dure : createImageBitmap, canvas, JPEG, SHA-256) arrivaient donc trop tard, et la couverture d’un
        // ISBN abandonné se posait sur une fiche saisie à la main. Le ré-encodage est tenu par un stub de
        // createImageBitmap, rendu dans le finally.
        couvertures.set('999', async () => reponseImage(img999));
        const r7 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        const vraiBitmap = globalThis.createImageBitmap;
        let ouvrirPorte = null;
        const porte = new Promise((r) => { ouvrirPorte = r; });
        let encodages = 0;
        const files999 = await compterFiles();
        try {
          globalThis.createImageBitmap = async (...a) => { encodages += 1; await porte; return vraiBitmap.call(globalThis, ...a); };
          taper(r7, '999'); cliquer(r7, 'Identifier');
          await attendre(() => encodages > 0, 'le ré-encodage de la couverture de 999 a commencé');
          cliquer(r7, '← Changer d’ISBN');
          cliquer(r7, 'Saisir à la main');
        } finally { ouvrirPorte(); globalThis.createImageBitmap = vraiBitmap; }
        // Le fait attendu : la ligne files du ré-encodage interrompu est écrite (c’est le dernier instant où la
        // garde d’avant aurait cédé — elle n’était plus relue après ce `await`).
        await attendre(async () => (await compterFiles()) > files999, 'la ligne files du ré-encodage interrompu est écrite');
        eq([image(r7), r7.etatRoute().couverture.sha256, r7.etatRoute().couverturesAppliquees, (await compterFiles()) - files999],
          [false, null, 0, 1],
          'route : deux gestes pendant le ré-encodage gagnent — aucune couverture affichée ni pointée ; la ligne files ré-encodée reste derrière (orphelin assumé, L4) (C1)');
        await attendreImages(r7);

        // 8. S12 : une couverture REÇUE puis refusée au ré-encodage ne se raconte pas « aucune couverture reçue » —
        // ce n’est pas le même fait, et la personne n’a pas la même chose à faire.
        couvertures.set('1010', async () => reponseImage(png(400, 600))); // en-tête valide, aucun pixel : indécodable
        const r8 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r8, '1010'); cliquer(r8, 'Identifier');
        await attendre(() => message(r8) !== null, 'le message de la couverture de 1010');
        eq([message(r8), image(r8)], [ILLISIBLE, false], 'route : une couverture reçue mais illisible le DIT (S12), sans image');
        await attendreImages(r8);

        // 9. C3 : une seconde identification ne fusionne plus par-dessus les champs du PREMIER ISBN (titre A + ISBN B).
        const r9 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r9, '1112'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du premier ISBN');
        eq([r9.etatRoute().champs.title, r9.etatRoute().isbn], ['Livre 1112', '1112'], 'route : le titre du premier ISBN est posé');
        cliquer(r9, '← Changer d’ISBN');
        taper(r9, '2223'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du second ISBN'); // `isbn` est posé par la FRAPPE : attendre dessus ne prouverait rien
        eq([r9.etatRoute().champs.title, r9.etatRoute().isbn], ['Livre 2223', '2223'], 'route : le titre suit le NOUVEL ISBN — plus de titre A affiché avec l’ISBN B (C3)');
        // Variante : ce que la personne a corrigé reste à elle.
        cliquer(r9, '← Changer d’ISBN');
        taper(r9, '3334'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du troisième ISBN');
        saisirTitre(r9, 'Mon titre à moi');
        cliquer(r9, '← Changer d’ISBN');
        taper(r9, '4445'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du quatrième ISBN');
        eq(r9.etatRoute().champs.title, 'Mon titre à moi', 'route : un titre corrigé à la main survit au changement d’ISBN — c’est sa saisie, pas celle d’un service (C3)');
        // C3 bis : un titre tapé AVANT toute identification. `fusionnerFiche` le garde (il n'est pas vide), mais
        // `champsDistants` enregistrait l'état d'APRÈS fusion : ce titre-là passait pour distant, et
        // l'identification SUIVANTE le vidait. Seules les clés que la fusion a réellement reprises comptent.
        const r9b = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        cliquer(r9b, 'Saisir à la main');
        saisirTitre(r9b, 'Mon livre à moi');
        cliquer(r9b, '← Changer d’ISBN');
        taper(r9b, '1230'); cliquer(r9b, 'Identifier');
        await attendre(() => r9b.etatRoute().pas === 2, 'le pas 2 du premier ISBN après une saisie à la main');
        eq([r9b.etatRoute().champs.title, r9b.etatRoute().champs.year], ['Mon livre à moi', '2020'], 'route : la fiche distante ne touche pas au titre déjà tapé, mais remplit l’année vide');
        cliquer(r9b, '← Changer d’ISBN');
        taper(r9b, '2340'); cliquer(r9b, 'Identifier');
        await attendre(() => r9b.etatRoute().pas === 2, 'le pas 2 du second ISBN');
        eq(r9b.etatRoute().champs.title, 'Mon livre à moi', 'route : un titre tapé AVANT la première identification survit à la seconde — il n’a jamais été « distant » (C3)');
        await attendreImages(r9b);
        await attendreImages(r9);

        // 10. C2 vue de la route : un livre anglais identifié par Google Books n’est plus écrit « fr ».
        sansFicheOl.add('5556'); sansFicheOl.add('6667');
        const r10 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo });
        taper(r10, '5556'); cliquer(r10, 'Identifier');
        await attendre(() => r10.etatRoute().pas === 2, 'le pas 2 pour 5556');
        eq([r10.etatRoute().champs.language, r10.querySelector('select').value], ['en', 'en'], 'route : la langue de la fiche Google Books est reprise, et le menu Langue le montre (C2)');
        const choisirLangue = (root, v) => { const s = root.querySelector('select'); s.value = v; s.dispatchEvent(new Event('change')); };
        choisirLangue(r10, 'fr');
        cliquer(r10, '← Changer d’ISBN');
        taper(r10, '6667'); cliquer(r10, 'Identifier');
        await attendre(() => r10.etatRoute().pas === 2, 'le pas 2 pour 6667');
        eq(r10.etatRoute().champs.language, 'fr', 'route : la langue choisie par la personne n’est plus écrasée par la fiche suivante (C2)');
        await attendreImages(r10);

        // 11. RF-I1 : la charnière § 5 → § 8, jamais exercée. « Ajouter ce livre » écrit le livre ET son édition
        // (pointeur de couverture compris), dit ce qui s’est passé, puis mène à l’accueil du livre. Mesuré par un
        // `navigate` et un `toast` injectés : aucune adresse touchée.
        const navs = []; const dits = [];
        couvertures.set('1234', async () => reponseImage(img1234));
        const r11 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo, navigate: (p) => navs.push(p), toast: (m) => dits.push(m) });
        taper(r11, '1234'); cliquer(r11, 'Identifier');
        await attendre(() => r11.etatRoute().couverture.sha256, 'la couverture de 1234 est posée');
        saisirTitre(r11, 'Le grand livre');
        const empreinteCouv = r11.etatRoute().couverture.sha256;
        cliquer(r11, 'Ajouter ce livre');
        await attendre(() => navs.length > 0, 'la navigation après l’écriture');
        const edEcrite = (await db.getAll('book_editions')).find((e) => e.isbn === '1234');
        const bkEcrit = edEcrite ? await db.get('books', edEcrite.book_id) : null;
        eq([bkEcrit?.title, edEcrite?.cover_sha256 === empreinteCouv, navs, dits], ['Le grand livre', true, [`/books/${edEcrite?.id}?nouveau=1`], ['Livre ajouté']],
          'route : « Ajouter ce livre » écrit books + book_editions avec le pointeur de couverture, le dit, et mène à /books/<id>?nouveau=1 (RF-I1)');
        await attendreImages(r11);

        // 12. RF-I1, l’autre côté : une écriture refusée ne s’annonce pas et ne mène nulle part — le bouton se
        // rouvre, la saisie reste. console.error est remplacé (logError) et rendu dans le finally.
        const navsR = []; const ditsR = [];
        const repoRefus = { newId: repo.newId, putFile: repo.putFile, getFile: repo.getFile, saveBatch: async () => { throw new Error('quota'); } };
        const r12 = await LA.renderLivreAjoutRoute({}, {}, {}, { repo: repoRefus, navigate: (p) => navsR.push(p), toast: (m) => ditsR.push(m) });
        cliquer(r12, 'Saisir à la main');
        saisirTitre(r12, 'Refusé');
        const vraiErreur = console.error;
        const journal = [];
        try {
          console.error = (...a) => journal.push(a[0]);
          cliquer(r12, 'Ajouter ce livre');
          await attendre(() => ditsR.length > 0, 'le refus est dit');
        } finally { console.error = vraiErreur; }
        eq([navsR, ditsR, journal.length > 0, r12.querySelector('[data-role="enregistrer"]').disabled, r12.etatRoute().champs.title],
          [[], ['Le livre n’a pas pu être enregistré. Réessaie.'], true, false, 'Refusé'],
          'route : un saveBatch refusé ne navigue pas, le dit, journalise, rouvre le bouton et garde la saisie (RF-I1)');
        BU.revoquerUrlsDeBlob();
      });
    } finally { globalThis.fetch = vraiFetch; }
  }
  // --- § 6 Couverture : ce que la fiche livre et Mes livres MONTRENT, sur une base jetable
  {
    const { withRepo } = await import('./sync-fixture.js');
    const { renderBook } = await import('../src/ui/book.js');
    const { renderLibrary } = await import('../src/ui/library.js');
    await withRepo(async (repo) => {
      const toile = document.createElement('canvas'); toile.width = 600; toile.height = 800;
      toile.getContext('2d').fillRect(0, 0, 600, 800);
      const photo = await new Promise((r) => toile.toBlob(r, 'image/png'));
      const { sha256 } = await LA.poserCouverture(photo, { origine: 'locale', repo });
      const avecOctets = { id: 'eC', book_id: 'bC', year: 2020, cover_sha256: sha256 };
      const sansOctets = { id: 'eD', book_id: 'bD', year: 2021, cover_sha256: 'empreinte-jamais-recue' };
      const livreC = { id: 'bC', title: 'Avec sa couverture', author: 'A. Autrice', cuisines: [] };
      const livreD = { id: 'bD', title: 'Pointeur seul', author: 'B. Auteur', cuisines: [] };
      const ctx = {
        book_editions: [avecOctets, sansOctets], recipes: [], recipe_versions: [], source_documents: [], source_pages: [],
        rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(), docsByRecipe: new Map(),
        scan_sessions: [], settings: {}, books: [livreC, livreD],
        booksById: new Map([['bC', livreC], ['bD', livreD]]),
        editionsById: new Map([['eC', avecOctets], ['eD', sansOctets]]),
        editionLabel: (e) => (e.book_id === 'bC' ? livreC.title : livreD.title),
      };
      const blocCouverture = (n) => [...n.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Couverture');
      const fichePointeur = await renderBook({ id: 'eD' }, {}, ctx);
      eq([blocCouverture(fichePointeur)?.querySelector('small')?.textContent, fichePointeur.querySelectorAll('img.cover-img').length],
        ['La couverture n’est pas sur cet appareil.', 0], 'fiche : un pointeur sans ligne files le DIT, et n’affiche aucune image (§ 6)');
      const ficheAvec = await renderBook({ id: 'eC' }, {}, ctx);
      const enTete = [...ficheAvec.querySelectorAll('.row.top')].find((r) => r.querySelector('header'));
      eq([!!enTete?.querySelector('img.cover-img'), !!blocCouverture(ficheAvec), blocCouverture(ficheAvec)?.querySelector('small')],
        [true, true, null], 'fiche : la couverture est dans l’en-tête, le bloc « Couverture » est visible, et rien n’est signalé (§ 6)');
      const biblio = await renderLibrary({}, {}, ctx);
      eq([biblio.querySelectorAll('img.cover-img').length, biblio.textContent.includes('pas sur cet appareil')],
        [1, false], 'Mes livres : une image pour l’édition dont les octets sont là, et la grille reste muette pour l’autre (§ 6)');
      // RF-I2 / D-T9 : la révocation au point d'appel n'était pas prouvée (seul le module blob-urls l'était). Un
      // espion autour d'un REDESSIN (une touche dans le filtre) : l'URL de la génération précédente est révoquée —
      // APRÈS le remplacement des nœuds — et la vignette affichée en ce moment garde, elle, une URL vivante.
      const filtre = biblio.querySelector('input[type="search"]');
      const revoquees = [];
      const vraiRevoke = URL.revokeObjectURL;
      const avantFiltre = biblio.querySelector('img.cover-img').src;
      const encoreAffichees = [];
      try {
        // L'espion regarde AUSSI, au moment même de la révocation, si un <img> de la grille porte encore cette URL :
        // c'est l'ORDRE qui se mesure là (révoquer avant de remplacer les nœuds laisse une image sur une URL morte,
        // ce que la console rapporte en net::ERR_FILE_NOT_FOUND).
        URL.revokeObjectURL = (u) => {
          revoquees.push(u);
          if ([...biblio.querySelectorAll('img.cover-img')].some((i) => i.src === u)) encoreAffichees.push(u);
          return vraiRevoke.call(URL, u);
        };
        filtre.value = 'Avec';
        filtre.dispatchEvent(new Event('input'));
      } finally { URL.revokeObjectURL = vraiRevoke; }
      const apresFiltre = [...biblio.querySelectorAll('img.cover-img')];
      eq([revoquees, encoreAffichees, apresFiltre.length, apresFiltre.every((i) => i.src.startsWith('blob:') && !revoquees.includes(i.src))], [[avantFiltre], [], 1, true],
        'Mes livres : un redessin révoque l’URL de la génération précédente — APRÈS avoir remplacé les nœuds, et pas celle de la vignette qu’il vient de poser (RF-I2, D-T9)');
      await Promise.all([...[fichePointeur, ficheAvec, biblio].flatMap((n) => [...n.querySelectorAll('img')])].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
      BU.revoquerUrlsDeBlob();
    });
  }

  // --- § 12 CSP, § 13.10 statique (tâche 10, clôture). S10 RETIRÉE par R-UX-15 : l'assistant IA (src/domain/llm.js)
  // accepte une URL de base LIBRE (compatible OpenAI, configurée dans Réglages) — aucune liste fermée ne peut la
  // couvrir sans casser cette fonctionnalité antérieure au lot. connect-src reste donc `'self' https:` (dos-d'âne
  // assumé, pas un mur) ; les vrais murs sont script-src 'self', img-src fermé (aucune image externe : les
  // couvertures passent par blob: après ré-encodage) et object-src 'none'.
  const lire = async (chemin) => (await fetch(chemin + '?v=' + Date.now(), { cache: 'no-store' })).text();
  for (const page of ['../index.html', './index.html']) {
    const html = await lire(page);
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
    eq(csp.match(/connect-src ([^;]+)/)?.[1], "'self' https:", `CSP ${page} : connect-src inchangée (S10 retirée, R-UX-15)`);
    eq(csp.match(/img-src ([^;]+)/)?.[1], "'self' blob: data:", `CSP ${page} : img-src fermé (aucune image externe)`);
    eq(csp.match(/script-src ([^;]+)/)?.[1], "'self'", `CSP ${page} : script-src 'self'`);
    eq(csp.match(/object-src ([^;]+)/)?.[1], "'none'", `CSP ${page} : object-src 'none'`);
    eq(csp.match(/default-src ([^;]+)/)?.[1], "'self'", `CSP ${page} : default-src 'self' (repli qui couvre tout ce qui n'est pas listé)`);
    eq(csp.match(/base-uri ([^;]+)/)?.[1], "'none'", `CSP ${page} : base-uri 'none'`);
    eq(csp.match(/form-action ([^;]+)/)?.[1], "'none'", `CSP ${page} : form-action 'none'`);
    // D-T10 : les deux dernières directives, pour que « toute la CSP » soit vrai et non presque vrai.
    eq(csp.match(/style-src ([^;]+)/)?.[1], "'self' 'unsafe-inline'", `CSP ${page} : style-src (les styles en ligne posés par el() en ont besoin)`);
    eq(csp.match(/frame-src ([^;]+)/)?.[1], "'self' blob:", `CSP ${page} : frame-src 'self' blob: (le cadre PDF isolé, sandbox vide)`);
    eq(csp.split(';').map((d) => d.trim().split(' ')[0]).filter(Boolean).sort(), ['base-uri', 'connect-src', 'default-src', 'form-action', 'frame-src', 'img-src', 'object-src', 'script-src', 'style-src'],
      `CSP ${page} : la liste des directives est épinglée — aucune ne peut être ajoutée ou retirée sans qu’un test tombe (D-T10)`);
  }
  // MODULES_NEUFS : les sept modules créés par le lot (R-UX-11 en ajoute un huitième, lien.js) + add.js réécrit.
  const MODULES_NEUFS = ['../src/ui/puces.js', '../src/ui/livre-ajout.js', '../src/ui/accueil-livre.js', '../src/ui/signet.js', '../src/core/image.js', '../src/core/blob-urls.js', '../src/core/lien.js', '../src/core/isbn.js', '../src/ui/add.js'];
  // CHAINES_NEUVES_AILLEURS reconstituée depuis le code réel (git diff main...HEAD, ensemble main vs HEAD des clés t(),
  // pas seulement les lignes ajoutées : une ligne réécrite pour une autre raison peut porter une chaîne déjà sur main —
  // book.js:'Cuisines', recipe-edit.js:'Cuisines / régions' et import.js:'— Aucun livre (à associer plus tard) —'
  // existaient déjà mot pour mot sur main, donc ÉCARTÉES d'ici malgré une ligne « + » dans le diff).
  const CHAINES_NEUVES_AILLEURS = {
    '../src/ui/book.js': ['+ Pages d’index', '+ Recette', 'Séance en cours : {n} page(s)', 'Reprendre', 'Couverture', 'Couverture enregistrée.', 'Couverture retirée.', 'La couverture n’est pas sur cet appareil.', 'Cette image est trop lourde (25 Mo au plus).', 'Cette image ne peut pas être lue ici. Essaie une autre photo.', 'Choisir des photos ou un PDF', 'Photographier'],
    '../src/ui/recipe.js': ['Lien web gardé.', 'L’app n’a pas lu la page : ouvre-la pour cuisiner.', 'Ouvrir le lien', 'Adresse non reconnue : '],
    '../src/ui/components.js': ['Lien web', 'Adresse non reconnue'],
  };
  {
    const { EN } = await import('../src/i18n/en.js');
    const manquantes = [];
    for (const m of MODULES_NEUFS) {
      const src = await lire(m);
      // S4 : une assertion NÉGATIVE sur un source vide (404, chemin faux, fichier renommé) serait verte pour rien.
      // Deux contrôles positifs d'abord : le source est bien arrivé, et c'est bien un module.
      ok(src.length > 300, `statique ${m} : le source est bien lu (${src.length} caractères)`);
      ok(/\bexport\b/.test(src), `statique ${m} : c’est bien le module (un export y figure)`);
      for (const [, cle] of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) if (!(cle in EN)) manquantes.push(`${m}: ${cle}`);
      ok(!/\bhtml:\s/.test(src) && !/innerHTML\s*=/.test(src) && !/window\.open\(/.test(src), `statique ${m} : ni html:, ni innerHTML, ni window.open (S14)`);
    }
    for (const [m, cles] of Object.entries(CHAINES_NEUVES_AILLEURS)) for (const cle of cles) if (!(cle in EN)) manquantes.push(`${m}: ${cle}`);
    eq(manquantes, [], 'i18n : chaque t() des modules neufs a son entrée en.js (F13)');
  }
  {
    // Rendu hostile : une chaîne <img onerror> reste du TEXTE dans les rendus neufs. F6 : plus de drapeau sur
    // `window` — un `window.__x` resté `undefined` ne prouve rien de plus que le compte d'<img>, et laisse une
    // trace globale derrière le test. Le contrôle positif est que le texte est bien là, affiché tel quel.
    const hostile = '<img src=x onerror="void 0">';
    const n1 = renderGrille({ cartes: [{ action: 'pages', ico: 'x', titre: hostile, sousTitre: hostile }] }, { pages: () => {} });
    const n2 = renderPuces(pucesModel({ choisies: [hostile] }), {});
    const n3 = S.renderSignet({ ...S.signetModel({ adresse: 'https://a.test/', titre: hostile }), livres: [] }, {});
    eq([n1.querySelectorAll('img').length, n2.querySelectorAll('img').length, n3.querySelectorAll('img').length], [0, 0, 0], 'statique : une chaîne hostile ne crée aucun élément (S14)');
    eq([n1.textContent.includes(hostile), n2.textContent.includes('<img src=x')], [true, true], 'statique : … et elle reste du texte affiché, pas du balisage avalé (S14)');
  }
  {
    const sw = await lire('../sw.js');
    ok(sw.length > 300 && sw.includes('SHELL'), `statique sw.js : le source est bien lu (${sw.length} caractères, SHELL présent) — sans quoi les inclusions ci-dessous ne prouveraient rien (S4)`);
    for (const m of ['./src/ui/puces.js', './src/ui/livre-ajout.js', './src/ui/accueil-livre.js', './src/ui/signet.js', './src/core/image.js', './src/core/blob-urls.js', './src/core/lien.js', './src/core/isbn.js']) ok(sw.includes(`'${m}'`), `SHELL : ${m}`);
    ok(/VERSION = 'cuisine-os-v0\.4\.1-\d+'/.test(sw), 'sw.js : VERSION 0.4.1');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.4.1', 'APP_VERSION 0.4.1');
  }
}
