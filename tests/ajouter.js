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
}
