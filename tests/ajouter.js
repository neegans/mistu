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
      eq((await db.getAll('outbox')).map((o) => o.store).sort(), ['book_editions', 'books'], 'livre : une transaction, deux lignes en file');
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
    const racine = await LA.renderLivreAjoutRoute({}, {}, { books: [{ cuisines: ['italienne'] }], recipes: [] });
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

  // --- § 7 Éditeur de recette : même geste pour les cuisines
  const { cuisinesDepuis } = await import('../src/ui/recipe-edit.js');
  eq(cuisinesDepuis({ cuisines: ['italienne', 'thaïe'] }), ['italienne', 'thaïe'], 'éditeur : un tableau est repris tel quel');
  eq(cuisinesDepuis({ cuisines: ' italienne , Thaïe ,' }), ['italienne', 'thaïe'], 'éditeur : une ancienne chaîne CSV est découpée, en minuscules');
  eq(cuisinesDepuis({}), [], 'éditeur : rien → tableau vide');
  {
    const src = await (await fetch('../src/ui/recipe-edit.js?v=' + Date.now(), { cache: 'no-store' })).text();
    ok(!/Cuisines \/ régions'\), el\('input'/.test(src), 'éditeur : le champ texte « Cuisines / régions » a disparu');
    ok(/renderPuces\(/.test(src), 'éditeur : les puces sont rendues');
  }

  // --- § 11 Signet web
  const S = await import('../src/ui/signet.js');
  eq(S.LIMITES_SIGNET, { adresse: 2048, titre: 300 }, 'signet : bornes (S13)');
  eq(S.lienSignet('https://ricardocuisine.com/recettes/1'), { ok: true, href: 'https://ricardocuisine.com/recettes/1', hote: 'ricardocuisine.com' }, 'signet : lien https accepté, hôte recalculé');
  eq(S.lienSignet('http://user:pw@exemple.test/x'), { ok: true, href: 'http://user:pw@exemple.test/x', hote: 'exemple.test' }, 'signet : userinfo hors de l’hôte affiché');
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
    // La route entière, rendue sur un ctx de papier : rien n'est écrit tant que « Garder le lien » n'est pas touché.
    const ctx = { book_editions: [{ id: 'e1', book_id: 'b1', year: 2020 }], booksById: new Map([['b1', { title: 'B', author: 'A' }]]), books: [{ cuisines: ['italienne'] }], recipes: [] };
    const root = await S.renderSignetRoute({}, {}, ctx);
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
    saisir('Adresse *', 'https://a.test/x');
    saisir('Titre *', 'Pad');
    eq([petit('adresse').textContent, petit('adresse').hidden, garder().disabled], ['', true, false], 'signet : l’adresse corrigée efface l’erreur et le bouton s’allume — l’écran ne contredit jamais l’état');
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
    eq(provenanceText({ source_url: 'https://a.test/x', source_label: 'ment.test', printed_page: 12 }, { title: 'B', author: 'A' }, null), 'B — A · page 12', 'provenance : un signet rattaché à un livre garde la provenance du livre (F22)');
    eq(provenanceText({}, null, null), 'Source personnelle', 'provenance : rien du tout → source personnelle');
    const { blocSignet } = await import('../src/ui/recipe.js');
    const sain = blocSignet({ source_url: 'https://a.test/x', source_label: 'ment.test' });
    const a = sain.querySelector('a');
    eq([a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.textContent], ['https://a.test/x', '_blank', 'noopener noreferrer', 'Ouvrir le lien'], 'signet : lien revalidé au rendu, noopener noreferrer');
    ok(sain.textContent.includes('a.test') && !sain.textContent.includes('ment.test'), 'signet : l’hôte affiché vient de l’adresse, jamais du libellé stocké (S7)');
    ok(sain.textContent.includes('Lien web gardé.') && !sain.textContent.includes('Scanner cette recette'), 'signet : texte propre, aucun geste de scan');
    const hostile = blocSignet({ source_url: 'javascript:alert(1)' });
    eq([hostile.querySelectorAll('a').length, hostile.textContent.includes('javascript:alert(1)')], [0, true], 'signet : adresse hostile en base → aucun <a>, texte inerte (S6)');
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
  eq(IM.LIMITES_COUVERTURE, { octetsDistants: 5242880, octetsLocaux: 26214400, pixels: 50000000, maxCote: 1200, qualite: 0.85 }, 'image : bornes de la spec');
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
    const revoques = [];
    const orig = URL.revokeObjectURL;
    URL.revokeObjectURL = (u) => { revoques.push(u); return orig.call(URL, u); };
    try {
      const u1 = BU.urlDeBlob(new Blob(['a'])), u2 = BU.urlDeBlob(new Blob(['b']));
      ok(u1.startsWith('blob:') && u2.startsWith('blob:'), 'blob-urls : des URL d’objet');
      eq([BU.revoquerUrlsDeBlob(), revoques.sort(), BU.revoquerUrlsDeBlob()], [2, [u1, u2].sort(), 0], 'blob-urls : tout révoqué une fois, puis plus rien (F4/S15)');
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
    // « AVANT de lire le corps » est une affirmation : elle se mesure par un espion sur blob(), pas par le résultat.
    let lectures = 0;
    const espion = (longueur) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-length': String(longueur) }), blob: async () => { lectures += 1; return bonPng; } });
    await LA.recupererCouvertureParIsbn('978', { fetch: async () => espion(6 * 1024 * 1024) });
    const apresRefus = lectures;
    await LA.recupererCouvertureParIsbn('978', { fetch: async () => espion(bonPng.size) });
    eq([apresRefus, lectures], [0, 1], 'couverture : le corps d’une réponse trop lourde n’est JAMAIS lu, celui d’une réponse bornée l’est');
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
      let code = null;
      try { await LA.poserCouverture(new Blob(['x'], { type: 'image/png' }), { origine: 'locale', repo }); } catch (e) { code = e.code; }
      eq(code, 'indecodable', 'couverture : indécodable → refus nommé (F11)');
      // bookCover avec et sans fichier
      const { bookCover } = await import('../src/ui/components.js');
      const avec = bookCover({ id: 'e1', cover_sha256: sha256 }, { title: 'T' }, { fichier: ligne });
      ok(avec.querySelector('img.cover-img') && avec.querySelector('.cover').classList.contains('with-img'), 'bookCover : fichier présent → <img>');
      // Poser un src lance le chargement même hors document : révoquer avant la fin donnerait une erreur console
      // (net::ERR_FILE_NOT_FOUND). On attend donc la fin réelle du chargement avant de rendre les URL.
      await new Promise((r) => { const img = avec.querySelector('img.cover-img'); if (img.complete) r(); else { img.onload = r; img.onerror = r; } });
      const sans = bookCover({ id: 'e1', cover_sha256: sha256 }, { title: 'T' }, {});
      eq([sans.querySelector('img'), sans.querySelector('.title').textContent], [null, 'T'], 'bookCover : pointeur sans fichier (autre appareil avant L4) → vignette texte, sans message');
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
    eq(appels, ['retirer'], 'couverture : « Retirer » n’efface que le pointeur (le geste), jamais la ligne files');
  }
}
