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

  // --- § 5 Ajouter un livre en deux pas
  const LA = await import('../src/ui/livre-ajout.js');
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
    eq(appels[0][1].credentials, 'omit', 'livre : les options S12 sont passées au fetch');
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
      eq((await db.getAll('outbox')).map((o) => o.store).sort(), ['book_editions', 'books'], 'livre : une transaction, deux lignes en file');
    });
  }
  {
    const appels = [];
    const gestes = { changerIsbn: (v) => appels.push(['isbn', v]), scanner: () => appels.push(['scanner']), identifier: () => appels.push(['identifier']), saisirMain: () => appels.push(['main']), changerChamp: (k, v) => appels.push(['champ', k, v]), basculerCuisine: (v) => appels.push(['cuisine', v]), ajouterCuisine: (v) => appels.push(['ajout', v]), retourIsbn: () => appels.push(['retour']), enregistrer: () => appels.push(['enregistrer']) };
    const p1 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '', champs: {}, lecteurDisponible: false }), gestes);
    eq(p1.querySelector('p').textContent, 'Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.', 'livre : première ligne du pas 1 = le but');
    ok(p1.textContent.includes('L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'), 'livre : les tiers sont nommés (S12)');
    ok([...p1.querySelectorAll('button')].find((b) => b.textContent === 'Scanner le code-barres').disabled, 'livre : lecteur absent → bouton désactivé');
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
}
