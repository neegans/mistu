// Tests du lot « page Ajouter et flux des livres » (spec docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md).
// Modèles purs et rendus DOM à gestes injectés ; bases jetables seulement ; aucun réseau ; aucun history.* réel.

// Filet i18n (F13) : chaque t('…') de ces modules doit avoir son entrée en.js. Exportées : tests/import-cible.js vérifie que son module y figure.
// MODULES_NEUFS : les modules créés par les lots (lien.js de R-UX-11 et isbn.js inclus) + add.js réécrit + l'écran d'import ciblé (lot A, tâche 4)
// + le module des fichiers du lot G + l'écran de la table des matières (lot C).
export const MODULES_NEUFS = ['../src/ui/puces.js', '../src/ui/livre-ajout.js', '../src/ui/accueil-livre.js', '../src/ui/signet.js', '../src/core/image.js', '../src/core/blob-urls.js', '../src/core/lien.js', '../src/core/isbn.js', '../src/ui/add.js', '../src/ui/import-cible.js', '../src/domain/lecture-web.js', '../src/ui/import-web.js', '../src/ui/vol.js', '../src/sync/fichiers.js', '../src/ui/table-matieres.js'];
// CHAINES_NEUVES_AILLEURS reconstituée depuis le code réel (git diff main...HEAD, ensemble main vs HEAD des clés t(),
// pas seulement les lignes ajoutées : une ligne réécrite pour une autre raison peut porter une chaîne déjà sur main —
// book.js:'Cuisines', recipe-edit.js:'Cuisines / régions' et import.js:'— Aucun livre (à associer plus tard) —'
// existaient déjà mot pour mot sur main, donc ÉCARTÉES d'ici malgré une ligne « + » dans le diff). Lot A, tâche 4 : les entrées de l'import ciblé
// sur la fiche du livre (« Importer ») et la fiche recette (« Importer cette recette », « Relire les pages »). Lot A, tâche 5 : le bandeau de
// lecture et l'état de la version affichée (recipe.js), la puce « incertain » (components.js), le bandeau D-3 (cook.js, grocery.js), l'aide
// « une étape par paragraphe » (recipe-edit.js). Tâche 5, ronde 1 : « Lue par l’assistant » (date illisible, recipe.js) ; « Une étape par ligne ou par
// paragraphe. » retirée d'ici (elle existait déjà sur main, sans entrée en.js : l'entrée a été ajoutée au passage, la chaîne n'est pas neuve). Lot A,
// tâche 6 : « {n} import(s) à reprendre » (book.js), les textes du journal du panneau d'index (import.js) et de l'éditeur (recipe-edit.js) ; la section
// « Imports » vit dans add.js, déjà scanné en entier (MODULES_NEUFS). Tâche 6, ronde 1 : la plomberie du journal (et ses phrases de refus) a rejoint
// src/ui/import-cible.js, scanné en entier ; l'éditeur dit en plus le vol tenu et ce que la lecture a dit d'incomplet (chaînes déjà traduites).
export const CHAINES_NEUVES_AILLEURS = {
  '../src/ui/book.js': ['Mots-clés', 'Autre mot-clé', '+ Pages d’index', '+ Recette', 'Séance en cours : {n} page(s)', 'Reprendre', 'Couverture', 'Couverture enregistrée.', 'Couverture retirée.', 'La couverture n’est pas sur cet appareil.', 'Cette image est trop lourde (25 Mo au plus).', 'Cette image ne peut pas être lue ici. Essaie une autre photo.', 'Choisir des photos ou un PDF', 'Photographier', 'Importer', '{n} import à reprendre', '{n} imports à reprendre',
    // Lot G, tâche 6 : la couverture par état (§ 4.2).
    'La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.', 'La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.', 'Fichier illisible reçu du serveur.', 'Le téléchargement n’a pas abouti.'],
  '../src/ui/import.js': ['Les références n’ont pas pu être créées. Réessaie.',
    // Lot G, tâche 6 : la phrase de séance (§ 4.3, F-21).
    'Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages', '{n}/{m} photos de cette séance envoyées au serveur'],
  '../src/ui/recipe.js': ['Lien web gardé.', 'Ouvrir le lien', 'Adresse non reconnue : ', 'Importer cette recette', 'Relire les pages',
    // Lot B, tâche 5 : la fiche d'un lien gardé (blocSignet), le bandeau d'une version lue sur le web, la relecture (B-27 : l'ancienne phrase est retirée).
    'L’app n’a pas encore lu la page.', 'Lecture de la page en cours…', 'Voir', 'Lecture reçue : vérifie-la et enregistre.', 'Vérifier et enregistrer', 'Contenu non récupéré : ouvre la page.',
    'Lire la recette avec l’assistant', 'Réessayer', 'Une lecture = un appel à l’assistant, compté dans ton quota du jour.', 'Lors de la recherche, l’assistant disait : {p}', 'Estimé par l’assistant : {r}',
    'Tu es hors ligne.', 'Lue sur {h} le {d} · {m} — vérifie.', 'Lue sur {h} · {m} — vérifie.', 'données de la page', 'texte lu par l’assistant', 'Selon la page : {s}', 'Relire la page avec l’assistant',
    'Lue par l’assistant le {d}', 'Lue par l’assistant', '{n} ligne(s) incertaine(s)', 'page possiblement manquante', 'lecture incomplète', 'Incertain : {t}', 'Vérifiée', 'À vérifier', '1 ligne à vérifier', '{n} lignes à vérifier', 'Photo du plat'],
  '../src/ui/components.js': ['Lien web', 'Adresse non reconnue', 'incertain', 'Ligne incertaine selon l’assistant',
    // Lot B, tâche 4 : la ligne de repères déménagée de search.js (ligneReperes, mêmes textes).
    '≈ {n} min', '≈ {h} h', '≈ {h} h {m}', 'facile', 'moyen', 'exigeant', '1 ingrédient', '{n} ingrédients',
    // Lot G, tâche 6 : vignettePage, gesteTelechargement, boutonTelechargerPages, pdfFrame (§ 4.3-4.5).
    'Page', 'Télécharger', 'Téléchargement…', 'Télécharger les {n} pages', 'Le téléchargement n’a pas abouti.', 'Pas encore sur cet appareil', 'Connecte-toi pour la télécharger', 'Pas encore envoyée par l’appareil qui l’a prise', 'Pas encore reçue', 'Fichier illisible reçu du serveur.'],
  // Lot B, tâche 4 : « Garder et lire » et le doublon sur une carte de l'onglet Web.
  '../src/ui/search.js': ['Garder et lire', 'Tu as déjà gardé cette adresse.', 'Ouvrir la fiche', 'Adresse non reconnue.', 'Le lien n’a pas pu être gardé. Réessaie.'],
  '../src/ui/cook.js': ['Lue par l’assistant, non relue'],
  '../src/ui/grocery.js': ['Lue par l’assistant, non relue'],
  '../src/ui/recipe-edit.js': ['Une étape par paragraphe (ligne vide entre deux étapes).', 'La recette n’a pas pu être enregistrée. Réessaie.', 'Une lecture est déjà en cours : annule-la d’abord.', 'page possiblement manquante', 'lecture incomplète'],
  // Lot G, tâche 2 : bilans d'archive (création, inspection, restauration — § 4.6).
  '../src/ui/settings.js': ['{n} pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.', '1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.', '{n} fichier(s) archivé(s) sont des copies du serveur, pas l’original.', '{n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.', 'pages manquantes : {n}', 'copies du serveur : {n}', 'Cette archive renvoie à {n} pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages).', 'Les pages de cet appareil absentes de l’archive seront retirées d’ici.', '{n} originaux de cet appareil conservés (l’archive portait des copies).', '1 original de cet appareil conservé (l’archive portait une copie).',
    // Lot G, tâche 2, ronde 1 (#35) : le singulier de la phrase d'inspection.
    'Cette archive renvoie à 1 page qui n’est pas dedans : si elle est sur le serveur, elle pourra être téléchargée (sur la fiche, ou Réglages → Télécharger toutes les pages).',
    // Lot G, tâche 5 ; pause L3 sans palier, P2.
    'Photos à envoyer : {n}',
    'Envoi des photos : {n}/{m}',
    'Pages à télécharger : {n} (~{m} Mo)',
    'Télécharger toutes les pages ({n} fichiers, ~{m} Mo)',
    'Arrêter le téléchargement',
    'Téléchargement des pages : {n}/{m}',
    'Tes photos sur le serveur : {x} Mo ({n} fichiers)',
    'Espace serveur : pas encore mesuré.',
    'au moins {x} Mo ({n} fichiers)',
    'Actualiser',
    'Espace photos plein sur le serveur : les photos attendent sur cet appareil, les fiches continuent de partir.',
    'Qualité d’envoi des photos',
    'Réduite (≈ 400 Ko, 2 000 px)',
    'Originale',
    'L’original reste toujours sur l’appareil qui a pris la photo. Réduite : JPEG de 2 000 px au plus, environ 400 Ko par page, métadonnées retirées, quand la réduction est possible et utile ; sinon le fichier part tel quel, métadonnées comprises : une image déjà petite (2 000 px et 600 Ko au plus), une photo de plus de 16 Mpx ou que ce navigateur ne sait pas lire, un PDF ou un EPUB. Originale : le fichier tel quel, avec ses métadonnées (dont la position GPS si la photo en porte).',
    'Renvoyer en originale les {n} photos de cet appareil envoyées en réduite',
    'Fichiers refusés : {n}',
    '{n} fichier(s) de type inconnu ne seront pas synchronisés.',
    '{n} copie(s) de photos ici dont le serveur n’a plus trace : l’appareil qui a l’original les renverra.',
    '{n} photo(s) ici sont une copie plus ancienne que celle du serveur.',
    'Plus de 50 Mo : ce fichier reste sur cet appareil seulement.',
    'Type de fichier refusé par le serveur.',
    'Empreinte différente après envoi.',
    'Ligne de fichier mal formée reçue du serveur.',
    'Ce fichier n’est plus sur le serveur.',
    'Fichier illisible reçu du serveur.',
    'Fichier refusé',
    'Envoi en cours…',
    'Espace serveur plein — rien n’est perdu, tout reste sur cet appareil.',
    // Lot G, ronde 1 de la tâche 5 : motifs d’envoi forme et illisible (l’aide de la qualité, réécrite, est à sa place ci-dessus).
    'Fichier vide ou mal formé : il reste sur cet appareil seulement.',
    'Fichier illisible sur cet appareil.',
    // Lot G, ronde 2 de la vague finale (R-G-28 bis) : les deux phrases de l'effacement (confirmation et section « Données », avec un compte).
    'Effacer les données de cet appareil ? Les photos et documents pas encore envoyés seront perdus ; une photo envoyée en qualité réduite ne garde que sa copie réduite. Fais d’abord une sauvegarde.',
    'Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur, sauf les photos et documents pas encore envoyés (une photo envoyée en qualité réduite n’y garde que sa copie réduite).'],
};

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
  eq(GRILLE_ACTIONS, ['ajouterLivre', 'pages', 'saisir', 'signet', 'creerIA', 'congelateur'], 'grille : six gestes nommés, dans l’ordre des cartes — « Créer avec l’IA » juste avant le congélateur (lot Créer avec l’IA, T4)');
  // RF-m14 : `grilleModel` ne prend AUCUN argument — l'appeler avec `{}` laissait croire à une option qui n'existe pas.
  eq(grilleModel().cartes.map((c) => c.action), GRILLE_ACTIONS, 'grille : une carte par geste, même ordre');
  eq(grilleModel().cartes.map((c) => c.titre), ['Ajouter un livre', 'Photographier ou importer des pages', 'Saisir une recette', 'Garder un lien web', 'Créer avec l’IA', 'Ajouter un lot au congélateur'], 'grille : les six titres de la spec');
  {
    const appels = [];
    const gestes = Object.fromEntries(GRILLE_ACTIONS.map((a) => [a, () => appels.push(a)]));
    const noeud = renderGrille(grilleModel(), gestes);
    const cartes = [...noeud.querySelectorAll('button.carte')];
    eq(cartes.length, 6, 'grille : six cartes rendues, aucun formulaire');
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
    eq([grille.querySelectorAll('button.carte').length, grille.querySelector('.selecteur-scan')], [6, null], 'page Ajouter : sans ?edition, la grille des six cartes et aucun sélecteur');
    // Lot A (import ciblé), D-8 : « Scanner cette recette » — le seul appelant de `#/add?edition=` — a disparu ; R-UX-16 est retiré et
    // l'adresse n'impose plus de livre (test RETOURNÉ : il affirmait le sélecteur ouvert d'office, livre fixé).
    const impose = await renderAdd({}, { edition: 'e1' }, ctxAdd);
    eq([impose.querySelectorAll('button.carte').length, impose.querySelector('.selecteur-scan')], [6, null], 'page Ajouter : un ?edition connu n’impose plus de livre — la grille, comme sans adresse (D-8 du lot import ciblé, R-UX-16 retiré)');
    [...impose.querySelectorAll('button.carte')][1].click(); // « Photographier ou importer des pages »
    const sel = impose.querySelector('.selecteur-scan select');
    eq([!!sel, sel?.disabled, sel?.value], [true, false, ''], 'page Ajouter : le sélecteur ouvert depuis la grille n’a aucun livre fixé — le ?edition de l’adresse n’est plus lu');
    [...impose.querySelectorAll('button')].find((b) => b.textContent === '← Retour').click();
    eq([impose.querySelectorAll('button.carte').length, impose.querySelector('.selecteur-scan')], [6, null], 'page Ajouter : « ← Retour » ramène à la grille, pour qui voulait autre chose');
    eq((await renderAdd({}, { edition: 'jamais vue' }, ctxAdd)).querySelectorAll('button.carte').length, 6, 'page Ajouter : un ?edition inconnu aussi — la grille, jamais un sélecteur sur un livre fantôme (S9)');
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
  eq(ISBN.validerIsbn('0306406153'), { ok: false, motif: 'controle' }, 'isbn : ISBN-10 au contrôle faux (une mutation controle10Ok → true tombe ici)');
  eq(ISBN.validerIsbn('2890772811'), { ok: false, motif: 'controle' }, 'isbn : ISBN-10 québécois au contrôle faux');
  eq(ISBN.validerIsbn('5901234123457'), { ok: false, motif: 'pas_isbn' }, 'isbn : EAN valide hors 978/979 = pas un ISBN (préfixe lu avant le contrôle)');
  eq(ISBN.validerIsbn('978X785035289'), { ok: false, motif: 'longueur' }, 'isbn : un X dans un 13 → longueur');
  eq(ISBN.validerIsbn('978178503528'), { ok: false, motif: 'longueur' }, 'isbn : douze chiffres');
  eq(ISBN.validerIsbn(' 978-1-78503-528-9 '), { ok: true, isbn13: '9781785035289', isbn10: '1785035282' }, 'isbn : tirets et espaces nettoyés');
  eq(ISBN.validerIsbn(''), { ok: false, motif: 'vide' }, 'isbn : vide');
  eq(ISBN.validerIsbn('12345678X9'), { ok: false, motif: 'longueur' }, 'isbn : X hors dernière position');
  // C3 (vague /verify) : une étiquette collée (« ISBN-13: … ») est retirée AVANT de garder les chiffres — sinon le 13 de
  // l’étiquette devient le début de l’ISBN. Le 13 ou le 10 d’une étiquette n’est mangé que s’il n’est pas suivi d’un chiffre.
  eq(ISBN.validerIsbn('ISBN-13: 9781785035289'), { ok: true, isbn13: '9781785035289', isbn10: '1785035282' }, 'isbn : « ISBN-13: … » collé est accepté (C3)');
  eq(ISBN.validerIsbn('ISBN-10 : 080442957X'), { ok: true, isbn13: '9780804429573', isbn10: '080442957X' }, 'isbn : « ISBN-10 : … » collé est accepté (C3)');
  eq(ISBN.nettoyerIsbn('ISBN 978-2-89077-281-6'), '9782890772816', 'isbn : « ISBN » suivi d’un espace est retiré (C3)');
  eq(ISBN.nettoyerIsbn('isbn:0306406152'), '0306406152', 'isbn : l’étiquette est lue sans égard à la casse (C3)');
  eq(ISBN.nettoyerIsbn('ISBN 1302345678'), '1302345678', 'isbn : le 13 d’un ISBN-10 qui commence par 13 n’est pas pris pour une étiquette (C3)');
  eq(ISBN.codeBarresVersIsbn([{ rawValue: '5901234123457' }, { rawValue: '9781785035289' }]), '9781785035289', 'isbn : le premier code au motif 978/979 est retenu');
  eq(ISBN.codeBarresVersIsbn([]), null, 'isbn : aucun code → null');
  eq(ISBN.codeBarresVersIsbn(null), null, 'isbn : entrée absente → null');
  eq(LA.LIMITES_ISBN, { champ: 300, corps: 262144, delaiMs: 10000, tentativeMs: 8000, repriseMs: 1500, totalMs: 20000 }, 'livre : bornes S3 + délais du lot ISBN (F24 : delaiMs de la couverture intact)');
  eq(LA.OPTIONS_FETCH, { mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }, 'livre : options de fetch explicites (S12)');
  eq(LA.nettoyerIsbn(' 978-2-7619-5000-1 '), '9782761950001', 'livre : ISBN sans tirets ni espaces');
  {
    // lookupIsbn : fetch, attente et délais injectés (aucune vraie attente). Une réponse factice sans body : lireBornee
    // rend false et le corps est lu par text(), comme sur main.
    const reponse = (status, corps) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => (typeof corps === 'string' ? corps : JSON.stringify(corps)) });
    const SEARCH = 'https://openlibrary.org/search.json?isbn=9781785035289&fields=title,author_name,publisher,first_publish_year,language,subject&limit=1';
    const LEGACY = 'https://openlibrary.org/api/books?bibkeys=ISBN:9781785035289&format=json&jscmd=data';
    const jamais = async () => { throw new Error('attendre ne doit pas être appelée'); };
    const sansAttente = async () => {};
    const chercher = (fetch, options = {}) => LA.lookupIsbn('9781785035289', { fetch, attendre: sansAttente, tentativeMs: 50, ...options });
    const VIDE = { title: 'T', author: '', publisher: '', year: null, language: null, motsCles: [] };
    // Garde S9 : une entrée qui n'est pas un ISBN-13 ne part jamais sur le réseau.
    let erreur = null; let appelsGarde = 0;
    try { await LA.lookupIsbn('9781&x=1', { fetch: async () => { appelsGarde += 1; return reponse(200, {}); } }); } catch (e) { erreur = e; }
    eq([erreur instanceof TypeError, appelsGarde], [true, 0], 'lookup : une entrée qui n’est pas un ISBN-13 lève avant tout appel (S9)');
    // Trouvé par search.json en un appel, fiche typée, mots-clés proposés (§ 12.2).
    const urls = [];
    const sujets = ['Barbecuing', 'barbecuing', 12, 'x'.repeat(80), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const r1 = await chercher(async (u, o) => { urls.push([u, o]); return reponse(200, { numFound: 1, docs: [{ title: 'Berber and Q', author_name: ['Josh Katz'], publisher: ['Ebury Publishing', 'Penguin Random House'], first_publish_year: 2018, language: ['eng', 'fre'], subject: sujets }] }); }, { attendre: jamais });
    eq([r1.statut, r1.source, r1.appels, r1.motif, r1.google], ['trouve', 'openlibrary', 1, null, 'non_appele'], 'lookup : search.json répond → trouvé en un appel');
    eq([r1.fiche.title, r1.fiche.author, r1.fiche.publisher, r1.fiche.year, r1.fiche.language], ['Berber and Q', 'Josh Katz', 'Ebury Publishing', 2018, 'fr'], 'lookup : fiche typée, premier éditeur, le français d’abord');
    eq([r1.fiche.motsCles.length, r1.fiche.motsCles[0], r1.fiche.motsCles[1].length, r1.fiche.motsCles.includes('barbecuing'), LA.MOTS_CLES_MAX], [10, 'Barbecuing', 60, false, 10], 'lookup : mots-clés proposés — 10 au plus, tronqués à 60, dédoublonnés par normaliser, chaînes seulement (§ 12.2)');
    eq(urls[0][0], SEARCH, 'lookup : adresse de l’API actuelle, fields avec subject, sans isbn (F13, § 12.2)');
    ok(urls[0][1].signal instanceof AbortSignal && urls[0][1].mode === 'cors' && urls[0][1].credentials === 'omit' && urls[0][1].cache === 'no-store' && urls[0][1].referrerPolicy === 'no-referrer', 'lookup : options S12 + un signal par tentative');
    // « Rien » sans numFound → legacy en filet, champs typés, sujets legacy.
    const urlsR2 = [];
    const r2 = await chercher(async (u) => { urlsR2.push(u); return u === SEARCH ? reponse(200, { docs: [] }) : u === LEGACY ? reponse(200, { 'ISBN:9781785035289': { title: 'Legacy', authors: [{ name: 'A' }, { nom: 'x' }], publishers: [{ name: 'P' }], publish_date: 'March 2018', subjects: [{ name: 'Grill' }, { nom: 'x' }] } }) : reponse(404, ''); }, { attendre: jamais });
    eq(urlsR2[1], LEGACY, 'lookup : adresse legacy exacte (jscmd=data, ISBN encodé)');
    eq([r2.statut, r2.source, r2.appels, r2.fiche], ['trouve', 'openlibrary', 2, { title: 'Legacy', author: 'A', publisher: 'P', year: 2018, language: null, motsCles: ['Grill'] }], 'lookup : « rien » (sans numFound) → legacy en filet, champs et sujets typés');
    // R-ISBN-6 : les sujets techniques d'Open Library (« clé:valeur », « clé=valeur ») ne sont pas proposés — et le
    // filtre passe AVANT le plafond de dix. Troncatures par points de code : jamais de demi-paire de substitution.
    const sujetsDe = async (sujets) => (await chercher(async () => reponse(200, { docs: [{ title: 'S', subject: sujets }] }), { attendre: jamais })).fiche;
    eq((await sujetsDe(['Barbecuing', 'Nyt:hardcover_fiction=2018-01-01', 'Series:Harry_Potter', 'cle=valeur', 'Cooking'])).motsCles, ['Barbecuing', 'Cooking'], 'lookup : les sujets techniques (deux-points ou égal) ne sont pas proposés (R-ISBN-6)');
    eq((await sujetsDe([...Array.from({ length: 10 }, (_, i) => `t${i}:a`), 'Grill'])).motsCles, ['Grill'], 'lookup : dix étiquettes techniques ne mangent pas le plafond — le filtre passe avant (R-ISBN-6)');
    const rLegacyTech = await chercher(async (u) => (u === SEARCH ? reponse(200, { docs: [] }) : u === LEGACY ? reponse(200, { 'ISBN:9781785035289': { title: 'L', subjects: [{ name: 'nyt:x' }, { name: 'Grill' }] } }) : reponse(404, '')), { attendre: jamais });
    eq(rLegacyTech.fiche.motsCles, ['Grill'], 'lookup : le filtre vaut aussi pour les sujets legacy (R-ISBN-6)');
    const emoji = String.fromCodePoint(0x1F600);
    const motCoupe = (await sujetsDe(['x'.repeat(59) + emoji + 'y'])).motsCles[0];
    eq([Array.from(motCoupe).length, /\p{Cs}/u.test(motCoupe)], [60, false], 'lookup : un mot-clé est tronqué à 60 points de code, sans demi-paire de substitution (R-ISBN-6)');
    const titreLong = (await chercher(async () => reponse(200, { docs: [{ title: 'é'.repeat(299) + emoji + 'z' }] }), { attendre: jamais })).fiche.title;
    eq([Array.from(titreLong).length, /\p{Cs}/u.test(titreLong)], [300, false], 'lookup : un champ est borné à 300 points de code, sans demi-paire de substitution (borner)');
    const r3 = await chercher(async (u) => reponse(200, u === SEARCH ? { numFound: 0, docs: [] } : {}), { attendre: jamais });
    eq([r3.statut, r3.appels, r3.motif, r3.google, r3.fiche, r3.source], ['introuvable', 2, null, 'non_appele', null, null], 'lookup : deux « rien » → introuvable');
    const r4 = await chercher(async (u) => { if (u === SEARCH) return reponse(200, { docs: [] }); throw new Error('reseau'); }, { attendre: jamais });
    eq([r4.statut, r4.appels], ['introuvable', 2], 'lookup : le legacy qui tombe ne change pas le statut (search a répondu)');
    // Reprise (I-R).
    const attentes = []; let surReprises = 0;
    const ctl5b = new AbortController();
    const r5 = await chercher(async () => { throw new Error('reseau'); }, { signal: ctl5b.signal, attendre: async (ms, s) => { attentes.push([ms, s === ctl5b.signal]); }, repriseMs: 1500, surReprise: () => { surReprises += 1; } });
    eq([r5.statut, r5.motif, r5.appels, attentes, surReprises], ['indisponible', 'reseau', 2, [[1500, true]], 1], 'lookup : échec muet → une reprise, attendre(repriseMs, LE signal extérieur), surReprise une fois (I-R)');
    let n6 = 0;
    const r6 = await chercher(async () => { n6 += 1; if (n6 === 1) throw new Error('reseau'); return reponse(200, { docs: [{ title: 'T' }] }); });
    eq([r6.statut, r6.appels, r6.fiche], ['trouve', 2, VIDE], 'lookup : la reprise peut trouver ; sans subject, motsCles vide');
    const r7 = await chercher(async () => reponse(429, {}), { attendre: jamais });
    eq([r7.statut, r7.motif, r7.appels], ['indisponible', 'limite', 1], 'lookup : 429 = limite, jamais réessayé par la machine (I-R)');
    const r8 = await chercher(async () => reponse(503, {}), { attendre: jamais });
    eq([r8.statut, r8.motif, r8.appels], ['indisponible', 'serveur', 1], 'lookup : 5xx = serveur, pas de reprise');
    eq((await chercher(async () => reponse(200, '<html>maintenance</html>'), { attendre: jamais })).motif, 'serveur', 'lookup : un 200 qui n’est pas du JSON = serveur, jamais une exception');
    // Délai : un fetch qui ne finit qu'à l'abandon de SON signal.
    const pendu = (u, o) => new Promise((resolve, reject) => o.signal.addEventListener('abort', () => reject(new DOMException('abandon', 'AbortError')), { once: true }));
    let signalVu = null;
    const r9 = await chercher(async (u, o) => { signalVu = signalVu || o.signal; return pendu(u, o); }, { tentativeMs: 1 });
    eq([r9.statut, r9.motif, r9.appels, signalVu.aborted], ['indisponible', 'delai', 2, true], 'lookup : chrono de tentative → delai, signal de la tentative abandonné, puis une reprise');
    const ctl1 = new AbortController();
    const r10 = await chercher(async (u, o) => { setTimeout(() => ctl1.abort(), 0); return pendu(u, o); }, { signal: ctl1.signal, tentativeMs: 5000, attendre: jamais });
    eq([r10.statut, r10.motif, r10.appels], ['indisponible', 'delai', 1], 'lookup : abandon extérieur pendant la tentative → delai, aucune reprise (S4)');
    const ctl2 = new AbortController();
    const r11 = await chercher(async () => { throw new Error('reseau'); }, { signal: ctl2.signal, attendre: async () => { ctl2.abort(); } });
    eq([r11.appels, r11.statut, r11.motif], [1, 'indisponible', 'delai'], 'lookup : abandon pendant l’attente → la seconde tentative ne part pas (S4a)');
    const ctl3 = new AbortController(); ctl3.abort();
    const r12 = await chercher(async () => reponse(200, { docs: [{ title: 'T' }] }), { signal: ctl3.signal });
    eq([r12.appels, r12.statut, r12.motif], [0, 'indisponible', 'delai'], 'lookup : signal déjà abandonné → zéro appel (S4b)');
    // Formes hostiles ou dégradées (S6/F13).
    eq((await chercher(async () => reponse(200, {}), { attendre: jamais })).motif, 'serveur', 'lookup : search sans docs = forme inattendue → serveur');
    const r13 = await chercher(async (u) => reponse(200, u === SEARCH ? { docs: [{ author_name: ['A'] }] } : {}), { attendre: jamais });
    eq([r13.statut, r13.appels], ['introuvable', 2], 'lookup : docs[0] sans titre = « rien », le legacy est consulté');
    eq((await chercher(async (u) => reponse(200, u === SEARCH ? { docs: [{ title: 12 }] } : {}), { attendre: jamais })).statut, 'introuvable', 'lookup : un titre qui n’est pas une chaîne n’est pas une fiche');
    const bidi = String.fromCodePoint(0x202e), sepLigne = String.fromCodePoint(0x2028);
    const r14 = await chercher(async () => reponse(200, { docs: [{ title: `T${bidi}${sepLigne}x`, author_name: 'x', publisher: [{}], language: 'french', first_publish_year: { a: 1 }, subject: 'x' }] }), { attendre: jamais });
    eq(r14.fiche, { title: 'Tx', author: '', publisher: '', year: null, language: null, motsCles: [] }, 'lookup : champs typés, Cc/Cf/U+2028 retirés, subject non tableau → [] (S6)');
    eq((await chercher(async () => reponse(200, { docs: [{ title: 'T', first_publish_year: '2018' }] }), { attendre: jamais })).fiche.year, 2018, 'lookup : une année reçue en chaîne reste une année');
    eq((await chercher(async () => reponse(200, { docs: [{ title: 'T'.repeat(400) }] }), { attendre: jamais })).fiche.title.length, 300, 'lookup : titre tronqué à 300 (S3)');
    // S1 (vague /verify) : un objet au toString hostile (JSON reçu tel quel) ne fait jamais lever lookupIsbn ; une année
    // est un entier de quatre chiffres ou se lit dans une chaîne, rien d’autre.
    const sansException = async (f) => { try { const r = await f(); return [r.statut, r.fiche?.year ?? null]; } catch (e) { return ['exception', String(e?.message)]; } };
    eq(await sansException(() => chercher(async () => reponse(200, { docs: [{ title: 'T', first_publish_year: { toString: 1 } }] }), { attendre: jamais })), ['trouve', null], 'lookup : first_publish_year au toString hostile → year null, aucune exception (S1)');
    eq(await sansException(() => chercher(async (u) => (u === SEARCH ? reponse(200, { docs: [] }) : u === LEGACY ? reponse(200, { 'ISBN:9781785035289': { title: 'L', publish_date: { toString: 1 } } }) : reponse(404, '')), { attendre: jamais })), ['trouve', null], 'lookup : publish_date legacy au toString hostile → year null, aucune exception (S1)');
    eq(await sansException(() => chercher(async () => reponse(200, { docs: [{ title: 'T', first_publish_year: 2018.5 }] }), { attendre: jamais })), ['trouve', null], 'lookup : une année non entière n’est pas une année (S1)');
    eq(await sansException(() => chercher(async () => reponse(200, { docs: [{ title: 'T', first_publish_year: 2018 }] }), { attendre: jamais })), ['trouve', 2018], 'lookup : une année entière reste une année (S1)');
    // V1 : le chemin de PRODUCTION — une vraie Response, corps en flux, lue par lireBornee puis Blob.text() (text() n’est
    // jamais appelée) ; les accents multi-octets restent intacts.
    const vraie = new Response(JSON.stringify({ docs: [{ title: 'Éé', subject: ['Cuisine'] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    Object.defineProperty(vraie, 'text', { value: async () => { throw new Error('text() ne doit pas être appelée quand il y a un flux'); } });
    const rV1 = await chercher(async () => vraie, { attendre: jamais });
    eq([rV1.statut, rV1.fiche?.title, rV1.fiche?.motsCles], ['trouve', 'Éé', ['Cuisine']], 'lookup : une vraie Response est lue en flux, accents intacts (V1)');
    // V2 : la borne de 256 Kio est EXACTE — un flux fini de 262 144 octets passe, 262 145 non ; un 429 porteur d’une fiche reste « limite ».
    const fluxJson = (total) => {
      const tete = '{"docs":[{"title":"', queue = '"}]}';
      const octets = new TextEncoder().encode(tete + 'x'.repeat(total - tete.length - queue.length) + queue);
      let i = 0;
      return { taille: octets.length, ok: true, status: 200, headers: new Headers(), body: { getReader: () => ({ read: async () => { if (i >= octets.length) return { done: true, value: undefined }; const v = octets.slice(i, i + 65536); i += 65536; return { done: false, value: v }; }, cancel: async () => {} }) } };
    };
    const fTrop = fluxJson(262145), fJuste = fluxJson(262144);
    eq([fTrop.taille, (await chercher(async () => fTrop, { attendre: jamais })).motif, fJuste.taille, (await chercher(async () => fJuste, { attendre: jamais })).statut], [262145, 'serveur', 262144, 'trouve'], 'lookup : 262 145 octets → serveur, 262 144 → trouvé (borne exacte, V2)');
    const r429 = await chercher(async () => reponse(429, { docs: [{ title: 'T' }] }), { attendre: jamais });
    eq([r429.statut, r429.motif, r429.fiche], ['indisponible', 'limite', null], 'lookup : un 429 porteur d’une fiche reste « limite », la fiche est ignorée (V2)');
    // Corps en flux > 256 Kio : coupé par cancel(), jamais gardé (S7, via lireBornee).
    let annule = false;
    const flux = () => ({ ok: true, status: 200, headers: new Headers(), body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(100 * 1024) }), cancel: async () => { annule = true; } }) } });
    const r15 = await chercher(async () => flux(), { attendre: jamais });
    eq([r15.motif, annule], ['serveur', true], 'lookup : un corps sans fin est coupé à 256 Kio (S7)');
    // attenteReelle : abandonnable, rend tout de suite si déjà abandonné.
    const ctl4 = new AbortController(); ctl4.abort();
    const t0 = performance.now(); await LA.attenteReelle(5000, ctl4.signal);
    ok(performance.now() - t0 < 100, 'lookup : attenteReelle rend tout de suite sur un signal déjà abandonné');
    const ctl5 = new AbortController(); setTimeout(() => ctl5.abort(), 5);
    const t1 = performance.now(); await LA.attenteReelle(5000, ctl5.signal);
    ok(performance.now() - t1 < 1000, 'lookup : attenteReelle est coupée par l’abandon');
    const t2 = performance.now(); await LA.attenteReelle(20); ok(performance.now() - t2 >= 15, 'lookup : attenteReelle sans signal rend après le délai');
    // Google Books : jamais sans clé ; avec clé, troisième appel, strict-origin, clé encodée ; jamais après un échec OL.
    const urls3 = [];
    const g0 = await chercher(async (u) => { urls3.push([u]); return reponse(200, u === SEARCH ? { docs: [] } : {}); }, { attendre: jamais });
    eq([g0.appels, urls3.some(([u]) => u.includes('googleapis'))], [2, false], 'lookup : sans clé, Google Books n’est jamais appelé');
    const stubGoogle = (reponseGoogle, search = { docs: [] }) => async (u, o) => { urls3.push([u, o]); if (u === SEARCH) return reponse(200, search); if (u === LEGACY) return reponse(200, {}); return reponseGoogle(u, o); };
    urls3.length = 0;
    const g1 = await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', authors: ['X', 3], publisher: 'Q', publishedDate: '2001-02', language: 'fr', categories: ['Cooking / BBQ', 'cooking / bbq'] } }] })), { cle: 'k&x', attendre: jamais });
    eq([g1.statut, g1.source, g1.appels, g1.google, g1.fiche], ['trouve', 'googlebooks', 3, 'trouve', { title: 'G', author: 'X', publisher: 'Q', year: 2001, language: 'fr', motsCles: ['Cooking / BBQ'] }], 'lookup : avec clé, Google Books est le troisième appel, champs et catégories typés');
    const [uG, oG] = urls3[2];
    eq(uG, 'https://www.googleapis.com/books/v1/volumes?q=isbn:9781785035289&maxResults=1&key=k%26x', 'lookup : adresse Google, clé encodée (S9)');
    eq([oG.referrerPolicy, urls3[0][1].referrerPolicy, urls3[1][1].referrerPolicy, oG.mode, oG.credentials, oG.cache, oG.signal instanceof AbortSignal], ['strict-origin', 'no-referrer', 'no-referrer', 'cors', 'omit', 'no-store', true], 'lookup : strict-origin pour Google seul (§ 7), no-referrer ailleurs');
    const g2 = await chercher(stubGoogle(async () => reponse(429, {})), { cle: 'k', attendre: jamais });
    eq([g2.statut, g2.google, g2.appels, g2.motif], ['introuvable', 'echec', 3, null], 'lookup : Google qui tombe après deux « rien » → introuvable, google = echec (S5)');
    const g3 = await chercher(stubGoogle(async () => reponse(200, { totalItems: 0 })), { cle: 'k', attendre: jamais });
    eq([g3.statut, g3.google], ['introuvable', 'rien'], 'lookup : Google « rien » (sans items) → google = rien');
    eq(await sansException(() => chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', publishedDate: { valueOf: 1 } } }] })), { cle: 'k', attendre: jamais })), ['trouve', null], 'lookup : publishedDate Google au valueOf hostile → year null (S1)');
    eq(await sansException(() => chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', publishedDate: { toString: 1 } } }] })), { cle: 'k', attendre: jamais })), ['trouve', null], 'lookup : publishedDate Google au toString hostile → year null, aucune exception (S1)');
    eq((await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: '' } }] })), { cle: 'k', attendre: jamais })).google, 'rien', 'lookup : un volume sans titre n’est pas une fiche');
    eq((await chercher(stubGoogle(async () => reponse(200, { items: [{ volumeInfo: { title: 'G', language: 'de' } }] })), { cle: 'k', attendre: jamais })).fiche.language, null, 'lookup : langue Google hors fr/en → null');
    urls3.length = 0;
    const g4 = await chercher(async (u) => { urls3.push([u]); return reponse(503, {}); }, { cle: 'k', attendre: jamais });
    eq([g4.statut, g4.motif, g4.appels, urls3.some(([u]) => u.includes('googleapis'))], ['indisponible', 'serveur', 1, false], 'lookup : Open Library muette → Google jamais appelé, « Réessayer » plutôt qu’un mensonge (S5/F6)');
    const ctl6 = new AbortController();
    urls3.length = 0;
    const g5 = await chercher(async (u, o) => { urls3.push([u, o]); if (u === SEARCH) return reponse(200, { docs: [] }); ctl6.abort(); return reponse(200, {}); }, { cle: 'k', signal: ctl6.signal, attendre: jamais });
    eq([g5.statut, g5.appels, g5.google], ['introuvable', 2, 'echec'], 'lookup : abandon après le legacy → Google jamais appelé, introuvable avec google = echec (S4c)');
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
    const m2 = LA.livreAjoutModel({ pas: 2, isbn: '9781785035289', champs: { title: 'X' }, provenance: 'openlibrary', recherche: false, lecteurDisponible: true });
    eq([m2.peutEnregistrer, m2.messages.provenance], [true, 'Renseigné par Open Library — vérifie et corrige.'], 'livre : pas 2, provenance étiquetée (I-A)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: 'aucune' }).messages.provenance, 'Aucune fiche chez Open Library pour cet ISBN. Complète à la main.', 'livre : « rien » dit après la réponse d’Open Library seule (I-B)');
    eq(LA.livreAjoutModel({ pas: 2, provenance: 'aucune', resultat: { statut: 'introuvable', motif: null, google: 'rien' } }).messages.provenance, 'Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.', 'livre : les deux sources ont répondu « rien »');
    eq(LA.livreAjoutModel({ pas: 2, provenance: 'aucune', resultat: { statut: 'introuvable', motif: null, google: 'echec' } }).messages.provenance, 'Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.', 'livre : Google muet n’est pas cité comme ayant répondu (S5)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance: null }).messages.provenance, null, 'livre : saisie à la main → aucune provenance');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: '   ' } }).peutEnregistrer, false, 'livre : sans titre, pas d’enregistrement');
    eq(LA.livreAjoutModel({ pas: 1, recherche: true }).messages.recherche, 'Recherche…', 'livre : pendant l’appel');
    eq(LA.livreAjoutModel({ pas: 1, recherche: true, reprise: true }).messages.recherche, 'Nouvel essai…', 'livre : la reprise est dite (S11)');
    eq(LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, enCours: true }).peutEnregistrer, false, 'livre : pendant l’enregistrement, on ne peut pas enregistrer une seconde fois (double clic)');
    eq([LA.livreAjoutModel({ pas: 1, validation: 'controle' }).messages.validation, LA.livreAjoutModel({ pas: 1, validation: 'longueur' }).messages.validation, LA.livreAjoutModel({ pas: 1, validation: 'pas_isbn' }).messages.validation, LA.livreAjoutModel({ pas: 1 }).messages.validation],
      ['Cet ISBN n’est pas valide, vérifie les chiffres.', 'Cet ISBN n’est pas valide, vérifie les chiffres.', 'Ce numéro n’est pas un ISBN : il doit commencer par 978 ou 979.', null], 'livre : un ISBN refusé est dit sous le champ (§ 4)');
    const TEXTES = { delai: 'Open Library n’a pas répondu à temps.', reseau: 'Impossible de joindre Open Library. Vérifie ta connexion.', limite: 'Open Library reçoit trop de demandes en ce moment. Attends quelques secondes.', serveur: 'Open Library est en panne pour le moment.', horsligne: 'Tu es hors ligne.' };
    for (const [motif, texte] of Object.entries(TEXTES)) {
      const mi = LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif } });
      eq([mi.messages.indisponible, mi.peutReessayer], [texte, true], `livre : indisponible/${motif} dit vrai et offre Réessayer`);
    }
    const mr = LA.livreAjoutModel({ pas: 1, recherche: true, resultat: { statut: 'indisponible', motif: 'limite' } });
    eq([mr.messages.indisponible, mr.peutReessayer], [null, false], 'livre : pendant la recherche, ni message indisponible ni Réessayer (F17)');
    eq(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif: '__proto__' } }).messages.indisponible, 'Open Library est en panne pour le moment.', 'livre : un motif inconnu ou hostile retombe sur « panne » (S12)');
    eq(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'introuvable', motif: null, google: 'non_appele' } }).peutReessayer, false, 'livre : introuvable n’offre pas Réessayer');
    eq([LA.livreAjoutModel({ pas: 1 }).messages.sources, LA.livreAjoutModel({ pas: 1, cleGoogle: true }).messages.sources], ['L’ISBN est envoyé à Open Library.', 'L’ISBN est envoyé à Open Library, puis à Google Books si besoin.'], 'livre : la phrase des sources dit ce qui est vrai (F12)');
    eq([LA.livreAjoutModel({ pas: 2, isbn: '9782890772816' }).isbnValide, LA.livreAjoutModel({ pas: 2, isbn: '12345' }).isbnValide, LA.livreAjoutModel({ pas: 2, isbn: '' }).isbnValide], [true, false, true], 'livre : isbnValide');
    eq([LA.livreAjoutModel({ pas: 2, isbn: '9782890772816' }).messages.rappelIsbn, LA.livreAjoutModel({ pas: 2, isbn: '12345' }).messages.rappelIsbn, LA.livreAjoutModel({ pas: 2, isbn: '' }).messages.rappelIsbn], ['ISBN 9782890772816', 'ISBN 12345 — non valide, ne sera pas enregistré', null], 'livre : rappel de l’ISBN au pas 2 (S8)');
    eq(LA.livreAjoutModel({ pas: 2, suggestions: { source: 'openlibrary', valeurs: ['bbq'] } }).suggestions, { source: 'openlibrary', valeurs: ['bbq'] }, 'livre : les suggestions passent telles quelles au rendu (§ 12.3)');
    eq(LA.livreAjoutModel({ pas: 2 }).champs.tags, [], 'livre : les champs vides portent tags: [] (§ 12.1)');
  }
  {
    let n = 0;
    const { book, edition } = LA.fabriquerLivre({ champs: { title: ' Titre ', author: 'A', publisher: '', year: '2019', language: 'fr', convention: 'metric_ca', cuisines: ['italienne'] }, isbn: '9782890772816', coverSha256: null }, { newId: (p) => `${p}-${++n}` });
    eq(book, { id: 'bk-1', title: 'Titre', author: 'A', cuisines: ['italienne'], tags: [] }, 'livre : book comme avant, cuisines en tableau');
    eq(edition, { id: 'ed-2', book_id: 'bk-1', isbn: '9782890772816', publisher: null, year: 2019, language: 'fr', unit_convention_id: 'metric_ca', convention_evidence: 'confirmed_by_user', owned: true, cover_sha256: null }, 'livre : edition comme avant + cover_sha256 (pointeur souple)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '0306406152' }, { newId: (p) => p }).edition.isbn, '9780306406157', 'livre : un ISBN-10 valide est enregistré en 13');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '12345' }, { newId: (p) => p }).edition.isbn, null, 'livre : un ISBN invalide n’est pas enregistré (S8)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '9'.repeat(10000) }, { newId: (p) => p }).edition.isbn, null, 'livre : une suite libre de chiffres n’atteint jamais la base ni son index (S8)');
    eq(LA.fabriquerLivre({ champs: { title: 'T' }, isbn: '' }, { newId: (p) => p }).edition.isbn, null, 'livre : sans ISBN, null');
    eq(LA.fabriquerLivre({ champs: { title: 'T', tags: ['bbq', 'charbon'] }, isbn: '' }, { newId: (p) => p }).book.tags, ['bbq', 'charbon'], 'livre : les mots-clés choisis sont écrits dans books.tags (§ 12.1)');
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
    ok(p1.textContent.includes('L’ISBN est envoyé à Open Library.') && !p1.textContent.includes('Google Books'), 'livre : sans clé, la phrase ne promet pas Google Books (F12)');
    ok(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, cleGoogle: true }), {}).textContent.includes('puis à Google Books si besoin.'), 'livre : avec clé, les deux tiers sont nommés (S12)');
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
    // Rendu du pas 1 : refus sous le champ, Réessayer, Entrée, champ fermé pendant la recherche (spec § 6, RF-m8).
    const appels = [];
    const gestes = { identifier: () => appels.push('identifier'), reessayer: () => appels.push('reessayer'), changerIsbn: () => {}, scanner: () => {}, saisirMain: () => {} };
    const p1 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '' }), gestes);
    const champ = p1.querySelector('input[name="isbn"]');
    eq([champ.getAttribute('maxlength'), champ.disabled], ['32', false], 'livre : champ borné à 32 (un « ISBN-13: … » collé tient entier, C3), ouvert hors recherche (S8)');
    eq(champ.getAttribute('inputmode'), null, 'livre : pas de clavier numérique forcé — le X d’un ISBN-10 doit rester tapable sur iPhone (R-ISBN-7)');
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
    champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    eq(appels, ['identifier'], 'livre : Entrée identifie une fois ; répétition, composition et autres touches non (S3)');
    const pr = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '9781785035289', recherche: true, resultat: { statut: 'indisponible', motif: 'limite' } }), gestes);
    eq([pr.querySelector('input[name="isbn"]').disabled, [...pr.querySelectorAll('button')].find((b) => b.textContent === 'Identifier').disabled, pr.querySelector('[data-role="reessayer"]'), pr.querySelector('[data-role="indisponible"]'), pr.textContent.includes('Recherche…')],
      [true, true, null, null, true], 'livre : pendant la recherche — champ fermé, Identifier fermé, ni Réessayer ni message, « Recherche… » (F17)');
    const pi = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, isbn: '9781785035289', resultat: { statut: 'indisponible', motif: 'limite' } }), gestes);
    eq([pi.querySelector('[data-role="indisponible"]')?.textContent.includes('trop de demandes'), [...pi.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length, pi.querySelectorAll('input[name="isbn"]').length, pi.querySelector('[data-role="reessayer"]')?.textContent],
      [true, 1, 1, 'Réessayer'], 'livre : indisponible → message + un seul « Saisir à la main » + Réessayer, toujours au pas 1');
    pi.querySelector('[data-role="reessayer"]').click();
    eq(appels, ['identifier', 'reessayer'], 'livre : « Réessayer » part par son geste');
    const pv = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, validation: 'controle' }), gestes);
    eq([pv.querySelector('[data-role="validation"]')?.textContent, pv.querySelector('.status.error, .error')], ['Cet ISBN n’est pas valide, vérifie les chiffres.', null], 'livre : le refus est sous le champ, sans carte rouge');
    const ph = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1, resultat: { statut: 'indisponible', motif: '<img src=x onerror="void 0">' } }), gestes);
    eq([ph.querySelectorAll('img').length, ph.querySelector('[data-role="indisponible"] > div')?.textContent], [0, 'Open Library est en panne pour le moment.'], 'livre : un motif hostile ne crée aucun élément et retombe sur le texte sûr (S12)');
    const p2 = LA.renderLivreAjout(LA.livreAjoutModel({ pas: 2, isbn: '12345', champs: { title: 'T' } }), gestes);
    ok([...p2.querySelectorAll('span.muted')].some((s) => s.textContent === 'ISBN 12345 — non valide, ne sera pas enregistré'), 'livre : au pas 2, un ISBN invalide est annoncé comme non enregistré (S8)');
    eq(LA.renderLivreAjout(LA.livreAjoutModel({ pas: 1 }), gestes).querySelector('[data-role="indisponible"], [data-role="validation"]'), null, 'livre : sans rien à dire, rien n’est affiché');
  }
  {
    // § 12.3 : suggestions de mots-clés — propositions étiquetées, jamais posées sans geste.
    const P = await import('../src/ui/puces.js');
    eq(P.motsClesExistants({ books: [{ tags: ['a', 'b'] }, { tags: ['b'] }, {}], recipes: [{ tags: ['z'] }] }), ['a', 'b', 'b'], 'mots-clés : existants = toutes les occurrences des tags des LIVRES (la fréquence fait l’ordre)');
    eq(P.motsClesExistants({ books: [{ tags: 'x' }, { tags: ['a', 3] }] }), ['a'], 'mots-clés : des tags qui ne sont pas un tableau de chaînes (archive, ligne reçue) ne font rien tomber (S2)');
    const s1 = P.suggestionsModel({ proposees: ['Barbecuing', 'BBQ', 'bbq', 'Charbon', '', 'Arabe'], source: 'openlibrary', choisies: ['BBQ'] });
    eq([s1.libelle, s1.puces.map((p) => p.valeur)], ['Proposé par Open Library', ['Barbecuing', 'Charbon', 'Arabe']], 'mots-clés : une suggestion déjà choisie (à la casse près) disparaît, les doublons aussi, le vide aussi');
    eq(P.suggestionsModel({ proposees: ['Bbq'], source: 'openlibrary', choisies: ['bbq'] }), null, 'mots-clés : plus rien à proposer → null, aucun bloc');
    eq(P.suggestionsModel({ proposees: ['Épice'], source: 'openlibrary', choisies: ['epice'] }), null, 'mots-clés : l’accent ne fait pas une proposition nouvelle (normaliser)');
    eq(P.suggestionsModel({ proposees: Array.from({ length: 14 }, (_, i) => `s${i}`), source: 'googlebooks' }).puces.length, 10, 'mots-clés : 10 suggestions au plus');
    eq(P.suggestionsModel({ proposees: ['x'], source: 'googlebooks' }).libelle, 'Proposé par Google Books', 'mots-clés : la source est nommée (I-A)');
    eq(P.suggestionsModel({ proposees: [], source: null }), null, 'mots-clés : sans proposition, null');
    const ajoutes = [];
    const n = P.renderSuggestions(s1, { ajouter: (v) => ajoutes.push(v) });
    eq([n.className, n.querySelector('small').textContent, [...n.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], ['suggestions', 'Proposé par Open Library', ['Barbecuing', 'Charbon', 'Arabe']], 'mots-clés : rendu = libellé + une puce par proposition, affichée capitalisée');
    n.querySelectorAll('button')[1].click();
    eq(ajoutes, ['Charbon'], 'mots-clés : un clic propose la valeur au geste ajouter — rien n’est écrit ici');
    eq(n.querySelector('label'), null, 'mots-clés : jamais dans un label (R-UX-8)');
    eq(P.renderPuces(P.pucesModel({ choisies: [] }), {}, { libelleAutre: 'Autre mot-clé' }).querySelector('input').getAttribute('aria-label'), 'Autre mot-clé', 'mots-clés : le champ libre est nommé pour les mots-clés');
    eq(P.renderPuces(P.pucesModel({ choisies: [] }), {}).querySelector('input').getAttribute('aria-label'), 'Autre cuisine', 'mots-clés : sans option, le champ libre reste « Autre cuisine »');
    // Pas 2 : le bloc « Mots-clés » avec ses gestes.
    const gestes = { basculerMotCle: (v) => ajoutes.push(['bascule', v]), ajouterMotCle: (v) => ajoutes.push(['ajout', v]) };
    const m = { ...LA.livreAjoutModel({ pas: 2, isbn: '9781785035289', champs: { title: 'T', tags: ['bbq'] }, provenance: 'openlibrary', suggestions: { source: 'openlibrary', valeurs: ['Barbecuing', 'bbq'] } }), existantes: ['italienne'], existantesMotsCles: ['charbon', 'charbon', 'arabe'] };
    const p2 = LA.renderLivreAjout(m, gestes);
    const bloc = p2.querySelector('[data-role="mots-cles"]');
    ok(bloc && bloc.querySelector('span').textContent === 'Mots-clés' && !bloc.closest('label'), 'livre : bloc « Mots-clés » au pas 2, hors label (R-UX-8)');
    eq([...bloc.querySelectorAll('button.puce:not(.suggestion)')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]), [['Bbq', 'true'], ['Charbon', 'false'], ['Arabe', 'false']], 'livre : mots-clés = choisis puis existants par fréquence, AUCUNE cuisine de graine (graine vide)');
    eq([...bloc.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent), ['Barbecuing'], 'livre : les suggestions excluent ce qui est déjà choisi');
    eq(bloc.querySelector('input').getAttribute('aria-label'), 'Autre mot-clé', 'livre : champ libre des mots-clés nommé');
    bloc.querySelector('button.puce.suggestion').click();
    [...bloc.querySelectorAll('button.puce:not(.suggestion)')][1].click();
    eq(ajoutes.slice(-2), [['ajout', 'Barbecuing'], ['bascule', 'charbon']], 'livre : suggestion → ajouterMotCle, puce → basculerMotCle');
    const sans = LA.renderLivreAjout({ ...LA.livreAjoutModel({ pas: 2, champs: { title: 'T' } }), existantes: [], existantesMotsCles: [] }, {});
    eq([!!sans.querySelector('[data-role="mots-cles"]'), sans.querySelector('.suggestions')], [true, null], 'livre : sans suggestion, le bloc existe (saisie libre) mais pas de ligne « Proposé par … »');
    const hostileSugg = '<img src=x onerror="void 0">';
    const nh = P.renderSuggestions(P.suggestionsModel({ proposees: [hostileSugg], source: 'openlibrary' }), {});
    eq([nh.querySelectorAll('img').length, nh.querySelector('button.puce.suggestion').textContent.includes('<img src=x')], [0, true], 'mots-clés : une proposition hostile reste du texte (S14) — seule surface neuve qui affiche une chaîne distante');
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
    champ.value = ' 978-2-8907-7281-6 ';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    bouton('Saisir à la main').click();
    eq(racine.querySelector('.status.info'), null, 'route livre : une saisie à la main n’étiquette aucune provenance (I-B)');
    eq([...racine.querySelectorAll('span.muted')].filter((s) => s.textContent.startsWith('ISBN')).map((s) => s.textContent), ['ISBN 9782890772816'], 'route livre : l’ISBN tapé est nettoyé et rappelé au pas 2');
    // Le défaut de R-UX-9, vu du côté de la personne : taper le titre réveille le bouton.
    const titre = [...racine.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const boutonAvant = racine.querySelector('[data-role="enregistrer"]');
    ok(boutonAvant.disabled, 'route livre : pas 2 à champs vides → « Ajouter ce livre » fermé');
    titre.value = 'Un titre'; titre.dispatchEvent(new Event('input', { bubbles: true }));
    ok(!racine.querySelector('[data-role="enregistrer"]').disabled, 'route livre : le titre tapé ouvre « Ajouter ce livre » (R-UX-9, le défaut corrigé)');
    ok(racine.querySelector('[data-role="enregistrer"]') === boutonAvant, 'route livre : c’est le MÊME nœud bouton après la frappe — rien n’a été redessiné (l’identité, pas seulement « encore au pas 2 »)');
    eq(racine.querySelector('input[name="isbn"]'), null, 'route livre : on est bien resté au pas 2 (aucun redessin qui ferait sauter le curseur)');
    bouton('← Changer d’ISBN').click();
    eq(racine.querySelector('input[name="isbn"]').value, '9782890772816', 'route livre : le retour au pas 1 garde l’ISBN nettoyé');
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
      // Import ciblé (lot A, tâche 6 ; spec import-cible § 4.1, N3) : la séance d'un import CIBLÉ non terminé n'est pas une « Séance en cours » de la
      // fiche (elle se reprend par la section « Imports ») ; elle revient après ignore ; celle de « Regrouper en recette » reste toujours rappelée.
      {
        const libre = { id: 's1b', status: 'open', edition_id: 'e1', page_ids: ['p1', 'p2'], started_at: '2026-10-18T10:00:00.000Z' };
        const ciblee = { id: 's5', status: 'open', edition_id: 'e1', page_ids: ['p5'], started_at: '2026-10-19T10:00:00.000Z' };
        const imp = { id: 'imp5', kind: 'recette', recipe_id: 'r5', edition_id: 'e1', scan_session_id: 's5', status: 'a_lancer' };
        const reprendre = (r) => [...r.querySelectorAll('a')].filter((a) => a.textContent === 'Reprendre').map((a) => a.getAttribute('href'));
        eq(reprendre(await renderBook({ id: 'e1' }, {}, ctxDe({ scan_sessions: [libre, ciblee], imports: [imp] }))), ['#/import?session=s1b'], 'fiche : la séance d’un import ciblé non terminé n’est pas « Séance en cours » — la plus récente des AUTRES est rappelée');
        eq(reprendre(await renderBook({ id: 'e1' }, {}, ctxDe({ scan_sessions: [libre, ciblee], imports: [{ ...imp, status: 'ignore' }] }))), ['#/import?session=s5'], 'fiche : … de retour après ignore (la plus récente)');
        eq(reprendre(await renderBook({ id: 'e1' }, {}, ctxDe({ scan_sessions: [libre, ciblee], imports: [{ ...imp, recipe_id: null }] }))), ['#/import?session=s5'], 'fiche : la séance où « Regrouper en recette » a écrit un import reste rappelée');
      }

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
      // § 12.4 : « Mots-clés » dans la fiche, écrits par « Enregistrer », sans toucher au reste.
      const fiche3 = await renderBook({ id: 'eZ' }, {}, ctxDeux(await db.get('book_editions', 'eZ')));
      const blocMots = [...fiche3.querySelectorAll('div.field')].find((f) => f.querySelector('span')?.textContent === 'Mots-clés');
      ok(blocMots && !blocMots.closest('label') && blocMots.querySelector('input').getAttribute('aria-label') === 'Autre mot-clé', 'fiche : bloc « Mots-clés » hors label, champ libre nommé (§ 12.4)');
      ok(![...blocMots.querySelectorAll('button.puce')].some((b) => b.textContent === 'Italienne'), 'fiche : aucune cuisine de graine parmi les mots-clés');
      const champLibre = blocMots.querySelector('input'); champLibre.value = 'BBQ';
      [...blocMots.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter').click();
      eq([...blocMots.querySelectorAll('button.puce')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]), [['Bbq', 'true']], 'fiche : « Ajouter » pose la puce choisie (minuscules)');
      await repo.save('book_editions', { ...(await db.get('book_editions', 'eZ')), cover_sha256: 'encore-posee' });
      [...fiche3.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer').click();
      eq(await attendreFait(async () => (await db.get('books', 'bZ'))?.tags?.length === 1), true, 'fiche : « Enregistrer » écrit les mots-clés');
      eq([(await db.get('books', 'bZ')).tags, (await db.get('book_editions', 'eZ')).cover_sha256], [['bbq'], 'encore-posee'], 'fiche : tags écrits, couverture relue intacte (C4, § 12.4)');
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
    // Lot B (D-B16, D-B7, § 4.6) : les repères de « Garder et lire » et le doublon d'adresse.
    const avecReperes = S.fabriquerSignet(S.signetModel({ adresse: 'https://a.test/p', titre: 'T' }), { newId: () => 'rc-2', langue: 'fr', reperes: { presentation: 'Un plat.', temps_min: 2000, difficulte: 'facile', ingredients: 7, autre: 'x' } });
    eq(avecReperes.web_reperes, { presentation: 'Un plat.', temps_min: null, difficulte: 'facile', ingredients: 7 }, 'signet (D-B16) : avec reperes, web_reperes posé et REVALIDÉ (2 000 min → null, champ inconnu écarté)');
    eq(Object.hasOwn(S.fabriquerSignet(S.signetModel({ adresse: 'https://a.test/p', titre: 'T' }), { newId: () => 'rc-3', langue: 'fr', reperes: { presentation: null, temps_min: null } }), 'web_reperes'), false, 'signet (D-B16) : des repères tous nuls ne posent rien (mutant « web_reperes posé même sans repères » : la forme épinglée plus haut rougit)');
    eq([S.signetModel({ adresse: 'https://a.test/', titre: 'T', doublon: { id: 'rc_x' } }).peutEnregistrer, S.signetModel({ adresse: 'https://a.test/', titre: 'T' }).doublon], [false, null], 'signet (D-B7) : un doublon éteint l’enregistrement ; sans doublon, null');
    const { withRepo } = await import('./sync-fixture.js');
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = async (u) => { throw new Error(`aucun reseau attendu ici : ${u}`); };
    try {
      await withRepo(async (repo, db) => {
        const existante = { id: 'rc_garde', original_title: 'Déjà là', availability: 'reference_only', source_url: 'https://a.test/x/' };
        await db.mutate({ puts: { recipes: [existante] }, origin: 'device' });
        let refus = null; try { await S.enregistrerSignet({ adresse: 'https://a.test/x?utm_source=y', titre: 'T' }, { repo, langue: 'fr', existantes: [existante] }); } catch (e) { refus = e.message; }
        eq([refus, (await db.getAll('recipes')).length], ['signet_doublon', 1], 'enregistrerSignet (D-B7, seconde porte) : une adresse déjà gardée → signet_doublon, rien d’écrit');
        const navs = [];
        const autre = { id: 'rc_garde_b', original_title: 'Autre', availability: 'reference_only', source_url: 'https://a.test/y' };
        const root = await S.renderSignetRoute({}, { adresse: 'https://A.test/x', titre: 'T' }, { book_editions: [], booksById: new Map(), books: [], recipes: [existante, autre] }, { repo, navigate: (p) => navs.push(p), toast: () => {} });
        const banniere = () => root.querySelector('[data-role="doublon-adresse"]');
        const garder = () => root.querySelector('[data-role="enregistrer"]');
        eq([banniere().hidden, banniere().textContent.includes('Tu as déjà gardé cette adresse.'), banniere().querySelector('a').getAttribute('href'), banniere().querySelector('a').textContent, garder().disabled], [false, true, '#/recipes/rc_garde', 'Ouvrir la fiche', true], 'route (D-B7) : adresse préremplie déjà gardée → bannière doublon-adresse, « Garder le lien » éteint, « Ouvrir la fiche » mène à la fiche');
        const champ = [...root.querySelectorAll('label.field')].find((f) => f.querySelector('span')?.textContent === 'Adresse *').querySelector('input');
        champ.value = 'https://a.test/libre'; champ.dispatchEvent(new Event('input'));
        eq([banniere().hidden, garder().disabled], [true, false], 'route (D-B7) : frappe vers une adresse libre → bannière cachée, bouton rallumé (sur place)');
        // Ronde 1 : vers une AUTRE adresse gardée → la bannière mène à CETTE fiche (majSignet réécrit l'href sur place).
        champ.value = 'https://a.test/y'; champ.dispatchEvent(new Event('input'));
        eq([banniere().hidden, banniere().querySelector('a').getAttribute('href'), garder().disabled], [false, '#/recipes/rc_garde_b', true], 'route (D-B7) : frappe vers une autre adresse gardée → « Ouvrir la fiche » mène à cette fiche-là (href mis à jour sur place), bouton éteint');
        champ.value = 'https://a.test/x#ancre'; champ.dispatchEvent(new Event('input'));
        eq([banniere().hidden, garder().disabled, navs], [false, true, []], 'route (D-B7) : retour vers l’adresse gardée → de nouveau, rien d’écrit ni de navigation');
      });
    } finally { globalThis.fetch = vraiFetch; }
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
    // § 12.5 : les mots-clés du livre comptent pour toutes ses recettes ; titleTokens pour les références seulement.
    const livreBbq = { id: 'bB', title: 'Berber and Q', author: 'Katz', cuisines: [], tags: ['bbq', 'charbon'] };
    const edBbq = { id: 'eB', book_id: 'bB' };
    const docsBbq = buildDocs({ recipes: [
      { id: 'c1', original_title: 'Agneau', edition_id: 'eB', availability: 'full' },
      { id: 'c2', original_title: 'Agneau', edition_id: 'eB', availability: 'reference_only', printed_page: 12, cuisines: [] },
      { id: 'c3', original_title: 'Agneau', edition_id: 'eB', availability: 'reference_only', source_url: 'https://a.test/', cuisines: [] },
      { id: 'c4', original_title: 'Agneau', availability: 'full' },
    ], versions: [], editions: [edBbq], books: [livreBbq], dishes: [], links: [], translations: [], history: [] });
    const par = (id) => docsBbq.find((d) => d.recipe.id === id);
    eq([par('c1').tokens.has('bbq'), par('c1').titleTokens.has('bbq'), par('c2').tokens.has('charbon'), par('c2').titleTokens.has('bbq'), par('c3').titleTokens.has('bbq'), par('c4').tokens.has('bbq')], [true, false, true, true, true, false], 'recherche : les tags du livre entrent dans les tokens de chaque recette, et dans les titleTokens des références seulement (§ 12.5)');
    const res = searchDocs(docsBbq, parseQuery('bbq'), { mode: 'all' });
    ok(res.references.some((x) => x.doc.recipe.id === 'c2') && res.references.some((x) => x.doc.recipe.id === 'c3'), 'recherche : une référence d’index et un signet d’un livre tagué « bbq » remontent sur « bbq »');
    // S2 (vague /verify) : des tags qui ne sont pas un tableau (archive restaurée, ligne reçue) ne font pas tomber la recherche.
    let docsS2 = null, erreurS2 = null;
    try {
      docsS2 = buildDocs({ recipes: [
        { id: 's1', original_title: 'Un', edition_id: 'e1', availability: 'reference_only', printed_page: 3, cuisines: [] },
        { id: 's2', original_title: 'Deux', edition_id: 'e2', availability: 'reference_only', printed_page: 4, cuisines: [] },
      ], versions: [], editions: [{ id: 'e1', book_id: 'b1' }, { id: 'e2', book_id: 'b2' }], books: [{ id: 'b1', title: 'L1', tags: 1 }, { id: 'b2', title: 'L2', tags: ['bbq', 7] }], dishes: [], links: [], translations: [], history: [] });
    } catch (e) { erreurS2 = String(e?.message); }
    eq([erreurS2, docsS2?.find((d) => d.recipe.id === 's2')?.tokens.has('bbq') ?? null, docsS2?.find((d) => d.recipe.id === 's2')?.titleTokens.has('bbq') ?? null], [null, true, true], 'recherche : tags 1 et [\'bbq\', 7] → aucune exception, « bbq » compte (S2)');
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
    ok((await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async (u, o) => { eq(o.credentials, 'omit', 'couverture : options S12'); return reponseBlob(200, bonPng); } })) instanceof Blob, 'couverture : 200 image/png → blob');
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => reponseBlob(404, new Blob([''], { type: 'image/jpeg' })) }), null, 'couverture : 404 → null');
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => reponseBlob(200, new Blob(['<html>'], { type: 'text/html' })) }), null, 'couverture : type hors liste → null');
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => reponseBlob(200, bonPng, 'image/png', 6 * 1024 * 1024) }), null, 'couverture : Content-Length 6 Mo → null AVANT de lire le corps');
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => reponseBlob(200, png(20000, 20000)) }), null, 'couverture : 400 Mpx annoncés par l’en-tête → null, jamais décodé');
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => { throw new Error('cors'); } }), null, 'couverture : rejet (CORS/réseau) → null, aucune exception');
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => reponseBlob(200, png(400, 600), 'image/webp') }), null, 'couverture : le type ANNONCÉ doit être celui du conteneur réel, sinon null');
    // « AVANT de lire le corps » est une affirmation : elle se mesure par un espion sur blob(), pas par le résultat.
    let lectures = 0;
    const espion = (longueur) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-length': String(longueur) }), blob: async () => { lectures += 1; return bonPng; } });
    await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => espion(6 * 1024 * 1024) });
    const apresRefus = lectures;
    await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => espion(bonPng.size) });
    eq([apresRefus, lectures], [0, 1], 'couverture : le corps d’une réponse trop lourde n’est JAMAIS lu, celui d’une réponse bornée l’est');
    // S5 (vague /verify) : une entrée qui n’est pas un ISBN-13 ne part jamais sur le réseau.
    let appelsS5 = 0;
    eq([await LA.recupererCouvertureParIsbn('abc', { fetch: async () => { appelsS5 += 1; return reponseBlob(200, bonPng); } }), appelsS5], [null, 0], 'couverture : une entrée qui n’est pas un ISBN-13 → null, aucun appel (S5)');
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
    eq(await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => enFlux(sansFin) }), null, 'couverture : sans Content-Length, un corps au-delà de 5 Mo → null (R-UX-12)');
    eq([espion.annule, espion.octetsEmis <= 7 * 1024 * 1024, espion.octetsEmis >= 5 * 1024 * 1024], [true, true, true], 'couverture : la lecture est ANNULÉE dès le dépassement — au plus 7 Mo tirés d’un corps sans fin, jamais les 64 (R-UX-12)');
    // Un vrai PNG découpé en trois morceaux : rassemblé tel quel, et ses dimensions restent lisibles dans l’en-tête.
    const octets = new Uint8Array(await png(400, 600).arrayBuffer());
    const tiers = new ReadableStream({ start(c) { c.enqueue(octets.slice(0, 10)); c.enqueue(octets.slice(10, 20)); c.enqueue(octets.slice(20)); c.close(); } });
    const recu = await LA.recupererCouvertureParIsbn('9782761950001', { fetch: async () => enFlux(tiers) });
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
    // La route reçoit son `fetch` par ses dépendances (F3) : le stub est INJECTÉ (depsRoute), le fetch global n'est jamais remplacé.
    // Aucun réseau : chaque adresse attendue a sa réponse factice, et toute autre répond 404.
    // F4 : on n'attend plus un DÉLAI, on attend un FAIT. `etatRoute()` (posé par la route pour les tests) compte
    // les passages du rappel de couverture : le rappel ENTRÉ est le dernier moment où la garde peut encore céder,
    // donc affirmer après lui n'est plus une course gagnée par chance.
    const attendre = async (condition, quoi) => {
      for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); }
      throw new Error(`attente dépassée (3 s) : ${quoi}`);
    };
    const attendreImages = (n) => Promise.all([...n.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
    {
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
        const languesOl = new Map(); // isbn → langues rendues par search.json (C2)
        const r404 = { ok: false, status: 404, headers: new Headers(), text: async () => '', blob: async () => new Blob([]) };
        const reponseImage = (png) => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'image/png', 'content-length': String(png.size) }), blob: async () => png });
        const fetchFactice = async (url) => {
          const u = String(url);
          urls.push(u);
          if (u.startsWith('https://covers.openlibrary.org/')) {
            const isbn = u.slice(u.indexOf('/b/isbn/') + 8).split('-L')[0];
            const donner = couvertures.get(isbn);
            return donner ? await donner() : r404;
          }
          if (u.startsWith('https://openlibrary.org/search.json')) {
            const isbn = new URL(u).searchParams.get('isbn');
            const lente = fichesLentes.get(isbn);
            if (lente) await lente;
            const corps = sansFicheOl.has(isbn) ? { numFound: 0, docs: [] } : { numFound: 1, docs: [{ title: `Livre ${isbn}`, author_name: [], publisher: [], first_publish_year: 2020, language: languesOl.get(isbn) || ['fre'] }] };
            return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(corps) };
          }
          if (u.startsWith('https://openlibrary.org/api/books')) {
            const isbn = u.split('ISBN:')[1].split('&')[0];
            if (sansFicheOl.has(isbn)) return r404;
            return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ [`ISBN:${isbn}`]: { title: `Livre ${isbn}`, authors: [], publishers: [], publish_date: '2020' } }) };
          }
          if (u.startsWith('https://www.googleapis.com/books/')) {
            return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ items: [{ volumeInfo: { title: 'Livre de Google', authors: [], publishedDate: '2019', language: 'en' } }] }) };
          }
          return r404;
        };
        const depsRoute = { repo, fetch: fetchFactice, enLigne: () => true, attendre: async () => {}, tentativeMs: 50 };
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
        couvertures.set('9780000001115', async () => reponseImage(img111));
        const r1 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r1, '9780000001115'); cliquer(r1, 'Identifier');
        await attendre(() => image(r1), 'la couverture de 111 est affichée');
        eq(message(r1), 'Couverture reçue d’Open Library.', 'route : la couverture reçue d’Open Library est annoncée, image à l’appui (I-B)');
        cliquer(r1, '← Changer d’ISBN');
        taper(r1, '9780000002228'); cliquer(r1, 'Identifier');
        await attendre(() => message(r1) === RIEN, 'la réponse pour 222 (aucune couverture)');
        eq(image(r1), false, 'route : la couverture de l’ISBN précédent ne survit pas à une nouvelle identification (R-UX-13)');
        await attendreImages(r1);

        // 2. Une réponse tardive appartient à SA demande : celle d’un ISBN abandonné est ignorée.
        let libererA = null;
        couvertures.set('9780000003331', async () => { await new Promise((r) => { libererA = r; }); return reponseImage(img333); });
        const r2 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r2, '9780000003331'); cliquer(r2, 'Identifier');
        await attendre(() => zone(r2) && libererA, 'la demande de couverture de 333 est en vol');
        cliquer(r2, '← Changer d’ISBN');
        taper(r2, '9780000004444'); cliquer(r2, 'Identifier');
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
        couvertures.set('9780000005557', async () => { tours += 1; if (tours === 1) { await new Promise((r) => { libererB = r; }); return reponseImage(img555a); } return reponseImage(img555b); });
        const r3 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r3, '9780000005557'); cliquer(r3, 'Identifier');
        await attendre(() => zone(r3) && libererB, 'la 1re demande de couverture de 555 est en vol');
        cliquer(r3, '← Changer d’ISBN');
        taper(r3, '9780000005557'); cliquer(r3, 'Identifier');
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
        couvertures.set('9780000007773', async () => { await new Promise((r) => { libererC = r; }); return reponseImage(img777); });
        const r5 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r5, '9780000007773'); cliquer(r5, 'Identifier');
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
        // Le fait attendu est la zone de couverture : elle n’apparaît qu’au pas 2, donc après la fin de lookupIsbn.
        sansFicheOl.add('9780000006660');
        const avant = urls.length;
        const r4 = await LA.renderLivreAjoutRoute({}, {}, {}, { ...depsRoute, cle: 'k' });
        taper(r4, '9780000006660'); cliquer(r4, 'Identifier');
        await attendre(() => zone(r4), 'le pas 2 pour 666');
        const depuis = urls.slice(avant);
        eq([depuis.some((u) => u.startsWith('https://covers.openlibrary.org/')), depuis.some((u) => u.startsWith('https://www.googleapis.com/books/')), r4.textContent.includes('Renseigné par Google Books')],
          [false, true, true], 'route : une fiche venue de Google Books (clé injectée) ne demande AUCUNE couverture à Open Library (I-A)');
        eq([message(r4), passages(r4)], [null, 0], 'route : sans demande de couverture, la zone ne raconte rien et aucun rappel n’est entré (I-B)');

        // 6. F3 : « Saisir à la main » PENDANT « Recherche… ». La réponse d’identification est encore en vol et
        // n’appartient plus à cet écran : ni ses champs, ni son étiquette, ni la couverture qu’elle aurait demandée.
        let libererFiche = null;
        fichesLentes.set('9780000008886', new Promise((r) => { libererFiche = r; }));
        couvertures.set('9780000008886', async () => reponseImage(img111));
        const r6 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r6, '9780000008886'); cliquer(r6, 'Identifier');
        await attendre(() => r6.etatRoute().recherche, 'la recherche de 888 est annoncée');
        cliquer(r6, 'Saisir à la main');
        eq([r6.etatRoute().pas, !!zone(r6)], [2, true], 'route : « Saisir à la main » pendant la recherche ouvre le pas 2 tout de suite');
        const files888 = await compterFiles();
        libererFiche();
        await attendre(() => r6.etatRoute().reponsesRecues === 1, 'la réponse de 888 est arrivée');
        eq([r6.etatRoute().champs.title, r6.etatRoute().provenance, r6.querySelector('.status.info'), passages(r6), await compterFiles()],
          ['', null, null, 0, files888],
          'route : la fiche arrivée après « Saisir à la main » n’écrit RIEN — aucun champ, aucune étiquette, aucune couverture demandée (F3, C1)');
        await attendreImages(r6);

        // 7. C1 : la garde était évaluée AVANT poserCouverture et jamais relue. Deux gestes PENDANT le ré-encodage
        // (qui dure : createImageBitmap, canvas, JPEG, SHA-256) arrivaient donc trop tard, et la couverture d’un
        // ISBN abandonné se posait sur une fiche saisie à la main. Le ré-encodage est tenu par un stub de
        // createImageBitmap, rendu dans le finally.
        couvertures.set('9780000009999', async () => reponseImage(img999));
        const r7 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        const vraiBitmap = globalThis.createImageBitmap;
        let ouvrirPorte = null;
        const porte = new Promise((r) => { ouvrirPorte = r; });
        let encodages = 0;
        const files999 = await compterFiles();
        try {
          globalThis.createImageBitmap = async (...a) => { encodages += 1; await porte; return vraiBitmap.call(globalThis, ...a); };
          taper(r7, '9780000009999'); cliquer(r7, 'Identifier');
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
        couvertures.set('9780000010100', async () => reponseImage(png(400, 600))); // en-tête valide, aucun pixel : indécodable
        const r8 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r8, '9780000010100'); cliquer(r8, 'Identifier');
        await attendre(() => message(r8) !== null, 'le message de la couverture de 1010');
        eq([message(r8), image(r8)], [ILLISIBLE, false], 'route : une couverture reçue mais illisible le DIT (S12), sans image');
        await attendreImages(r8);

        // 9. C3 : une seconde identification ne fusionne plus par-dessus les champs du PREMIER ISBN (titre A + ISBN B).
        const r9 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r9, '9780000011121'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du premier ISBN');
        eq([r9.etatRoute().champs.title, r9.etatRoute().isbn], ['Livre 9780000011121', '9780000011121'], 'route : le titre du premier ISBN est posé');
        cliquer(r9, '← Changer d’ISBN');
        taper(r9, '9780000022233'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du second ISBN'); // `isbn` est posé par la FRAPPE : attendre dessus ne prouverait rien
        eq([r9.etatRoute().champs.title, r9.etatRoute().isbn], ['Livre 9780000022233', '9780000022233'], 'route : le titre suit le NOUVEL ISBN — plus de titre A affiché avec l’ISBN B (C3)');
        // Variante : ce que la personne a corrigé reste à elle.
        cliquer(r9, '← Changer d’ISBN');
        taper(r9, '9780000033345'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du troisième ISBN');
        saisirTitre(r9, 'Mon titre à moi');
        cliquer(r9, '← Changer d’ISBN');
        taper(r9, '9780000044457'); cliquer(r9, 'Identifier');
        await attendre(() => r9.etatRoute().pas === 2, 'le pas 2 du quatrième ISBN');
        eq(r9.etatRoute().champs.title, 'Mon titre à moi', 'route : un titre corrigé à la main survit au changement d’ISBN — c’est sa saisie, pas celle d’un service (C3)');
        // C3 bis : un titre tapé AVANT toute identification. `fusionnerFiche` le garde (il n'est pas vide), mais
        // `champsDistants` enregistrait l'état d'APRÈS fusion : ce titre-là passait pour distant, et
        // l'identification SUIVANTE le vidait. Seules les clés que la fusion a réellement reprises comptent.
        const r9b = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        cliquer(r9b, 'Saisir à la main');
        saisirTitre(r9b, 'Mon livre à moi');
        cliquer(r9b, '← Changer d’ISBN');
        taper(r9b, '9780000012302'); cliquer(r9b, 'Identifier');
        await attendre(() => r9b.etatRoute().pas === 2, 'le pas 2 du premier ISBN après une saisie à la main');
        eq([r9b.etatRoute().champs.title, r9b.etatRoute().champs.year], ['Mon livre à moi', '2020'], 'route : la fiche distante ne touche pas au titre déjà tapé, mais remplit l’année vide');
        cliquer(r9b, '← Changer d’ISBN');
        taper(r9b, '9780000023407'); cliquer(r9b, 'Identifier');
        await attendre(() => r9b.etatRoute().pas === 2, 'le pas 2 du second ISBN');
        eq(r9b.etatRoute().champs.title, 'Mon livre à moi', 'route : un titre tapé AVANT la première identification survit à la seconde — il n’a jamais été « distant » (C3)');
        await attendreImages(r9b);
        await attendreImages(r9);

        // 10. C2 vue de la route : un livre anglais identifié via search.json n’est plus écrit « fr ».
        languesOl.set('9780000055569', ['eng']); languesOl.set('9780000066671', ['eng']);
        const r10 = await LA.renderLivreAjoutRoute({}, {}, {}, depsRoute);
        taper(r10, '9780000055569'); cliquer(r10, 'Identifier');
        await attendre(() => r10.etatRoute().pas === 2, 'le pas 2 pour 5556');
        eq([r10.etatRoute().champs.language, r10.querySelector('select').value], ['en', 'en'], 'route : la langue de la fiche (via search.json) est reprise, et le menu Langue le montre (C2)');
        const choisirLangue = (root, v) => { const s = root.querySelector('select'); s.value = v; s.dispatchEvent(new Event('change')); };
        choisirLangue(r10, 'fr');
        cliquer(r10, '← Changer d’ISBN');
        taper(r10, '9780000066671'); cliquer(r10, 'Identifier');
        await attendre(() => r10.etatRoute().pas === 2, 'le pas 2 pour 6667');
        eq(r10.etatRoute().champs.language, 'fr', 'route : la langue choisie par la personne n’est plus écrasée par la fiche suivante, via search.json (C2)');
        await attendreImages(r10);

        // 11. RF-I1 : la charnière § 5 → § 8, jamais exercée. « Ajouter ce livre » écrit le livre ET son édition
        // (pointeur de couverture compris), dit ce qui s’est passé, puis mène à l’accueil du livre. Mesuré par un
        // `navigate` et un `toast` injectés : aucune adresse touchée.
        const navs = []; const dits = [];
        couvertures.set('9780000012340', async () => reponseImage(img1234));
        const r11 = await LA.renderLivreAjoutRoute({}, {}, {}, { ...depsRoute, navigate: (p) => navs.push(p), toast: (m) => dits.push(m) });
        taper(r11, '9780000012340'); cliquer(r11, 'Identifier');
        await attendre(() => r11.etatRoute().couverture.sha256, 'la couverture de 1234 est posée');
        saisirTitre(r11, 'Le grand livre');
        const empreinteCouv = r11.etatRoute().couverture.sha256;
        cliquer(r11, 'Ajouter ce livre');
        await attendre(() => navs.length > 0, 'la navigation après l’écriture');
        const edEcrite = (await db.getAll('book_editions')).find((e) => e.isbn === '9780000012340');
        const bkEcrit = edEcrite ? await db.get('books', edEcrite.book_id) : null;
        eq([bkEcrit?.title, edEcrite?.cover_sha256 === empreinteCouv, navs, dits], ['Le grand livre', true, [`/books/${edEcrite?.id}?nouveau=1`], ['Livre ajouté']],
          'route : « Ajouter ce livre » écrit books + book_editions avec le pointeur de couverture, le dit, et mène à /books/<id>?nouveau=1 (RF-I1)');
        await attendreImages(r11);

        // 12. RF-I1, l’autre côté : une écriture refusée ne s’annonce pas et ne mène nulle part — le bouton se
        // rouvre, la saisie reste. console.error est remplacé (logError) et rendu dans le finally.
        const navsR = []; const ditsR = [];
        const repoRefus = { newId: repo.newId, putFile: repo.putFile, getFile: repo.getFile, saveBatch: async () => { throw new Error('quota'); } };
        const r12 = await LA.renderLivreAjoutRoute({}, {}, {}, { ...depsRoute, repo: repoRefus, navigate: (p) => navsR.push(p), toast: (m) => ditsR.push(m) });
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
    }
  }
  // --- La ROUTE, partie A : validation, trois issues, une identification à la fois, suggestions
  {
    // La route avec deps étendues (F3) : validation, hors ligne, indisponible → Réessayer, Entrée, une seule
    // identification (I-G), langue reçue (C2), sorties après un échec (F7), suggestions (§ 12). Aucun réseau, base jetable.
    const { withRepo } = await import('./sync-fixture.js');
    const reponseJson = (o, status = 200) => ({ ok: status < 300, status, headers: new Headers(), text: async () => JSON.stringify(o) });
    const r404 = { ok: false, status: 404, headers: new Headers(), text: async () => '', blob: async () => new Blob([]) };
    const attendre = async (condition, quoi) => { for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error(`attente dépassée (3 s) : ${quoi}`); };
    const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
    const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); };
    const entree = (root) => root.querySelector('input[name="isbn"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    await withRepo(async (repo) => {
      const urls = [];
      const recherches = () => urls.filter((u) => u.includes('/search.json')).length; // la couverture passe aussi par fetch
      let search = () => reponseJson({ docs: [{ title: 'Livre', language: ['eng'], subject: ['Barbecuing', 'Charcoal'] }] });
      const fetch = async (u) => { const s = String(u); urls.push(s); if (s.startsWith('https://openlibrary.org/search.json')) return search(); return r404; };
      const deps = { repo, fetch, enLigne: () => true, attendre: async () => {}, tentativeMs: 50, navigate: () => {} };
      // 1. ISBN faux : aucun appel, la saisie reste.
      const rA = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rA, '9781785035280'); cliquer(rA, 'Identifier');
      eq([urls.length, rA.querySelector('[data-role="validation"]')?.textContent, rA.querySelector('input[name="isbn"]')?.value], [0, 'Cet ISBN n’est pas valide, vérifie les chiffres.', '9781785035280'], 'route : un ISBN faux est refusé sans appel, la saisie reste (§ 4)');
      taper(rA, '5901234123457'); entree(rA);
      eq([urls.length, rA.querySelector('[data-role="validation"]')?.textContent], [0, 'Ce numéro n’est pas un ISBN : il doit commencer par 978 ou 979.'], 'route : un EAN qui n’est pas un livre est refusé sans appel, le texte dit la règle (C2)');
      // 2. Hors ligne : aucun appel ; Réessayer force (S13) ; langue reçue (C2) ; suggestions posées (§ 12).
      const rB = await LA.renderLivreAjoutRoute({}, {}, {}, { ...deps, enLigne: () => false });
      taper(rB, '9781785035289'); cliquer(rB, 'Identifier');
      eq([urls.length, rB.querySelector('[data-role="indisponible"]')?.textContent.includes('Tu es hors ligne.'), !!rB.querySelector('[data-role="reessayer"]')], [0, true, true], 'route : hors ligne → aucun appel, dit, Réessayer offert');
      cliquer(rB, 'Réessayer');
      await attendre(() => rB.querySelector('.status.info'), 'pas 2 après Réessayer');
      eq([recherches(), rB.querySelector('select').value, titreDe(rB).value, [...rB.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], [1, 'en', 'Livre', ['Barbecuing', 'Charcoal']], 'route : Réessayer force l’appel malgré onLine (S13) ; langue au sélecteur (C2) ; suggestions affichées (§ 12)');
      // 3. 429 → pas 1, message vrai, Réessayer ; deux clics = un appel ; puis 200 → pas 2.
      urls.length = 0; search = () => reponseJson({}, 429);
      const rC = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rC, '9782890772816'); entree(rC);
      await attendre(() => rC.querySelector('[data-role="reessayer"]'), 'indisponible après 429');
      eq([recherches(), rC.querySelector('[data-role="indisponible"]')?.textContent.includes('trop de demandes'), !!rC.querySelector('input[name="isbn"]'), [...rC.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length, rC.etatRoute().resultat?.motif], [1, true, true, 1, 'limite'], 'route : Entrée identifie ; 429 → pas 1, message vrai, Réessayer, un seul « Saisir à la main » (F17)');
      search = () => reponseJson({ docs: [{ title: 'Carnet', language: ['fre'] }] });
      // Le premier clic redessine (le bouton quitte l’écran pendant « Recherche… ») : le second clic vise le MÊME nœud,
      // détaché — son écouteur part quand même, et c’est la garde I-G de la route qui doit le refuser.
      { const b = [...rC.querySelectorAll('button')].find((x) => x.textContent === 'Réessayer'); b.click(); b.click(); }
      await attendre(() => rC.querySelector('.status.info'), 'pas 2 après Réessayer');
      eq([recherches(), rC.querySelector('.status.info').textContent, titreDe(rC).value, rC.querySelector('select').value, rappel(rC), rC.querySelector('.suggestions')], [2, 'Renseigné par Open Library — vérifie et corrige.', 'Carnet', 'fr', 'ISBN 9782890772816', null], 'route : deux clics sur Réessayer = un appel ; il relance et remplit ; sans subject, aucune suggestion');
      // 4. F7 : après un échec, « Saisir à la main » et « ← Changer d’ISBN » effacent le message.
      urls.length = 0; search = () => reponseJson({}, 503);
      const rD = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rD, '0306406152'); cliquer(rD, 'Identifier');
      await attendre(() => rD.querySelector('[data-role="reessayer"]'), 'indisponible après 503');
      ok(rD.querySelector('[data-role="indisponible"]').textContent.includes('en panne'), 'route : 503 = « en panne »');
      // Un ISBN faux tapé après l'échec : le message « indisponible » d'avant ne reste pas à côté du refus (aucun appel).
      const appelsAvantFaux = urls.length;
      taper(rD, '9781785035280'); cliquer(rD, 'Identifier');
      eq([rD.querySelector('[data-role="indisponible"]'), !!rD.querySelector('[data-role="validation"]'), urls.length - appelsAvantFaux], [null, true, 0], 'route : un ISBN faux après un échec efface « indisponible » et dit le refus, sans appel');
      taper(rD, '0306406152');
      cliquer(rD, 'Saisir à la main');
      eq([rD.querySelector('[data-role="indisponible"]'), rD.querySelector('.status.info'), rappel(rD)], [null, null, 'ISBN 9780306406157'], 'route : « Saisir à la main » après un échec → pas 2 muet, ISBN normalisé en 13 (F7, F22)');
      cliquer(rD, '← Changer d’ISBN');
      eq([rD.querySelector('[data-role="indisponible"]'), rD.querySelector('input[name="isbn"]').value, rD.querySelector('input[name="isbn"]').disabled], [null, '9780306406157', false], 'route : retour au pas 1 sans message, champ ouvert (F7)');
      // 5. I-G : une identification à la fois ; champ fermé pendant la recherche.
      urls.length = 0; let liberer = null; search = () => new Promise((r) => { liberer = () => r(reponseJson({ docs: [{ title: 'Lent' }] })); });
      const rE = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rE, '9780306406157'); entree(rE);
      await attendre(() => liberer, 'premier appel en vol');
      eq([rE.querySelector('input[name="isbn"]').disabled, rE.textContent.includes('Recherche…')], [true, true], 'route : champ fermé et « Recherche… » pendant l’appel (RF-m8)');
      entree(rE); cliquer(rE, 'Identifier');
      liberer();
      await attendre(() => rE.querySelector('.status.info'), 'pas 2');
      eq(recherches(), 1, 'route : Entrée et clic pendant la recherche ne partent pas (I-G)');
      // 6. « Nouvel essai… » visible pendant la reprise (S11/F26).
      urls.length = 0; let n = 0; let libererReprise = null;
      search = () => { n += 1; if (n === 1) throw new Error('reseau'); return new Promise((r) => { libererReprise = () => r(reponseJson({ docs: [{ title: 'Repris' }] })); }); };
      const rF = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(rF, '9780306406157'); cliquer(rF, 'Identifier');
      await attendre(() => libererReprise, 'seconde tentative en vol');
      ok(rF.textContent.includes('Nouvel essai…') && rF.etatRoute().reprise === true, 'route : la reprise est dite pendant qu’elle a lieu (S11)');
      libererReprise();
      await attendre(() => rF.querySelector('.status.info'), 'pas 2 après reprise');
      eq([recherches(), titreDe(rF).value, rF.etatRoute().reprise], [2, 'Repris', false], 'route : la reprise a trouvé, et reprise retombe');
    });
  }
  {
    // Réponses tardives et croisées (S3/I-G), écriture de l'édition et des mots-clés (F15, § 12), ISBN libre (S8).
    const { withRepo } = await import('./sync-fixture.js');
    const reponseJson = (o) => ({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(o) });
    const r404 = { ok: false, status: 404, headers: new Headers(), text: async () => '', blob: async () => new Blob([]) };
    const attendre = async (condition, quoi) => { for (let i = 0; i < 300; i += 1) { if (await condition()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error(`attente dépassée (3 s) : ${quoi}`); };
    const taper = (root, isbn) => { const i = root.querySelector('input[name="isbn"]'); i.value = isbn; i.dispatchEvent(new Event('input')); };
    const cliquer = (root, texte) => { const b = [...root.querySelectorAll('button')].find((x) => x.textContent === texte); if (!b) throw new Error(`bouton absent : ${texte}`); b.click(); };
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn');
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    await withRepo(async (repo, db) => {
      const urls = []; const rienPour = new Set(); const enVol = new Map(); // isbn → fonction qui libère la réponse search.json
      const fetch = async (u) => { const s = String(u); urls.push(s); if (s.startsWith('https://openlibrary.org/search.json')) { const isbn = new URL(s).searchParams.get('isbn'); if (rienPour.has(isbn)) return reponseJson({ numFound: 0, docs: [] }); return new Promise((r) => { enVol.set(isbn, () => r(reponseJson({ docs: [{ title: `Livre ${isbn}`, subject: ['Barbecuing', 'Charcoal'] }] }))); }); } return r404; };
      const liberer = (isbn) => { const f = enVol.get(isbn); enVol.delete(isbn); f(); };
      const navigations = [];
      const deps = { repo, fetch, enLigne: () => true, attendre: async () => {}, tentativeMs: 5000, navigate: (p) => navigations.push(p) };
      const A = '9780306406157', B = '9782890772816';
      // 1. « Saisir à la main » pendant la recherche : la réponse tardive n'écrit rien (I-G), pas même une suggestion.
      const r1 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r1, A); cliquer(r1, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol');
      cliquer(r1, 'Saisir à la main');
      liberer(A);
      await attendre(() => r1.etatRoute().reponsesRecues === 1, 'réponse tardive de A reçue (1)');
      await new Promise((r) => setTimeout(r, 0));
      eq([titreDe(r1).value, r1.querySelector('.status.info'), rappel(r1), r1.querySelector('.suggestions'), r1.etatRoute().recherche], ['', null, `ISBN ${A}`, null, false], 'route : la réponse d’une identification abandonnée par « Saisir à la main » n’écrit rien, et la recherche est libérée (I-G)');
      // 2. Croisement A puis B : seule B écrit ; une seule couverture demandée (B).
      const r2 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r2, A); cliquer(r2, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol (2)');
      cliquer(r2, 'Saisir à la main'); cliquer(r2, '← Changer d’ISBN');
      taper(r2, '2890772810'); cliquer(r2, 'Identifier');
      await attendre(() => enVol.has(B), 'B en vol');
      liberer(A);
      await attendre(() => r2.etatRoute().reponsesRecues === 1, 'réponse tardive de A reçue (2)');
      await new Promise((r) => setTimeout(r, 0));
      eq([r2.querySelector('.status.info'), !!r2.querySelector('input[name="isbn"]')], [null, true], 'route : la réponse de A, arrivée pendant B, n’écrit rien et ne quitte pas le pas 1 (S3)');
      liberer(B);
      await attendre(() => r2.querySelector('.status.info'), 'B remplie');
      eq([titreDe(r2).value, rappel(r2), urls.some((u) => u.includes('/b/isbn/' + B + '-L')) && !urls.some((u) => u.includes('/b/isbn/' + A)), [...r2.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], [`Livre ${B}`, `ISBN ${B}`, true, ['Barbecuing', 'Charcoal']], 'route : les champs et suggestions sont ceux de B seulement ; la couverture demandée est celle de B, jamais celle de A (S3, § 5, § 12, V3)');
      // 3. Une suggestion cliquée devient un mot-clé choisi ; « Ajouter ce livre » écrit isbn13 et tags (F15, § 12).
      r2.querySelector('button.puce.suggestion').click();
      eq([r2.etatRoute().champs.tags, [...r2.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent)], [['barbecuing'], ['Charcoal']], 'route : la suggestion cliquée devient une puce choisie (minuscules, comme ajouterPuce) et quitte les suggestions');
      cliquer(r2, 'Ajouter ce livre');
      await attendre(() => navigations.length === 1, 'navigation après enregistrement');
      const editions = await db.getAll('book_editions');
      const livre = await db.get('books', editions[0].book_id);
      eq([editions.length, editions[0].isbn, livre.tags, navigations[0] === `/books/${editions[0].id}?nouveau=1`], [1, B, ['barbecuing'], true], 'route : l’édition porte l’ISBN-13 (saisi en ISBN-10), le livre ses mots-clés, la navigation part vers la fiche (F15, § 12.1)');
      // 4. Saisie à la main invalide → édition sans ISBN ; 10 000 chiffres → rappel borné, rien en base (S8).
      const r3 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r3, '12345'); cliquer(r3, 'Saisir à la main');
      eq(rappel(r3), 'ISBN 12345 — non valide, ne sera pas enregistré', 'route : rappel « non valide » (S8)');
      titreDe(r3).value = 'Sans ISBN'; titreDe(r3).dispatchEvent(new Event('input', { bubbles: true }));
      cliquer(r3, 'Ajouter ce livre');
      await attendre(() => navigations.length === 2, 'navigation 2');
      ok((await db.getAll('book_editions')).some((e) => e.isbn === null), 'route : un ISBN invalide est enregistré null (S8)');
      const r4 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r4, '9'.repeat(10000)); cliquer(r4, 'Saisir à la main');
      eq(rappel(r4), `ISBN ${'9'.repeat(20)} — non valide, ne sera pas enregistré`, 'route : une saisie démesurée est bornée à l’affichage (S8)');
      titreDe(r4).value = 'Long'; titreDe(r4).dispatchEvent(new Event('input', { bubbles: true }));
      cliquer(r4, 'Ajouter ce livre');
      await attendre(() => navigations.length === 3, 'navigation 3');
      eq((await db.getAll('book_editions')).filter((e) => e.isbn === null).length, 2, 'route : la suite démesurée n’atteint pas la base (S8)');
      // 6. Open Library répond « rien » : le repli legacy est tenté, et sans clé Google Books ne l'est jamais.
      rienPour.add('9780000055569');
      const r6 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r6, '9780000055569'); cliquer(r6, 'Identifier');
      await attendre(() => r6.etatRoute().reponsesRecues === 1, 'réponse « rien » reçue');
      await new Promise((r) => setTimeout(r, 0));
      ok((r6.querySelector('.status.info')?.textContent ?? '').includes('Aucune fiche chez Open Library pour cet ISBN'), 'route : un « rien » d’Open Library est dit introuvable');
      eq(urls.filter((u) => u.includes('/api/books')).length, 1, 'route : le repli legacy a bien été tenté');
      ok(!urls.some((u) => u.includes('googleapis')), 'route : sans clé, un « rien » d’Open Library ne tente jamais Google Books');
      // 5. « ← Changer d’ISBN » vide les suggestions (elles appartiennent à l'ISBN qui les a produites, § 12.2).
      const r5 = await LA.renderLivreAjoutRoute({}, {}, {}, deps);
      taper(r5, A); cliquer(r5, 'Identifier');
      await attendre(() => enVol.has(A), 'A en vol (5)'); liberer(A);
      await attendre(() => r5.querySelector('.suggestions'), 'suggestions de A');
      cliquer(r5, '← Changer d’ISBN'); cliquer(r5, 'Saisir à la main');
      eq([r5.etatRoute().suggestions, r5.querySelector('.suggestions'), !!r5.querySelector('[data-role="mots-cles"]')], [null, null, true], 'route : revenir changer l’ISBN abandonne les suggestions de l’ancien — état ET écran, au pas 2 (§ 12.2)');
      // 7. R-ISBN-8 : « Saisir à la main » ABANDONNE la requête en vol (le fetch honore le signal, comme un vrai) —
      // la réponse est muette ET le réseau est libéré ; l'identification suivante part seule, sans reprise de A.
      const urls7 = []; const signaux = new Map();
      const fetch7 = (u, o) => { const s = String(u); urls7.push(s); if (s.startsWith('https://openlibrary.org/search.json')) signaux.set(new URL(s).searchParams.get('isbn'), o.signal); return new Promise((_, reject) => o.signal.addEventListener('abort', () => reject(new DOMException('abandon', 'AbortError')), { once: true })); };
      const rX = await LA.renderLivreAjoutRoute({}, {}, {}, { ...deps, fetch: fetch7 });
      taper(rX, A); cliquer(rX, 'Identifier');
      await attendre(() => signaux.has(A), 'signal de A vu');
      cliquer(rX, 'Saisir à la main');
      eq([signaux.get(A).aborted, await attendre(() => rX.etatRoute().reponsesRecues === 1, 'réponse abandonnée de A')], [true, true], 'route : « Saisir à la main » abandonne la requête en vol — réponse muette ET réseau libéré (R-ISBN-8)');
      cliquer(rX, '← Changer d’ISBN');
      taper(rX, B); cliquer(rX, 'Identifier');
      await attendre(() => signaux.has(B), 'signal de B vu');
      eq([urls7.filter((u) => u.includes('/search.json')).map((u) => new URL(u).searchParams.get('isbn')), signaux.get(B).aborted, rX.etatRoute().recherche], [[A, B], false, true], 'route : après l’abandon, une seule recherche B part, aucune reprise de A (R-ISBN-8)');
      cliquer(rX, 'Saisir à la main'); // libère B : rien ne reste en vol après le test
      await attendre(() => rX.etatRoute().reponsesRecues === 2, 'réponse abandonnée de B');
      // 8. C1 (vague /verify) : « ← Changer d’ISBN » garde les champs (F23) ; « Saisir à la main » sous un AUTRE ISBN (ou un
      // ISBN invalide) ne doit pas montrer les champs reçus pour le premier, ni sans étiquette ni avec. Même ISBN : les
      // champs sont encore ceux d’Open Library, l’étiquette reste.
      const fetch8 = async (u) => { const s = String(u); if (s.startsWith('https://openlibrary.org/search.json')) { const isbn = new URL(s).searchParams.get('isbn'); return reponseJson({ docs: [{ title: `Livre ${isbn}`, author_name: [`Auteur ${isbn}`] }] }); } return r404; };
      const d8 = { ...deps, fetch: fetch8 };
      const auteurDe = (root) => [...root.querySelectorAll('input[type="text"]')].filter((i) => i.name !== 'isbn')[1];
      const trouverA = async (root, quoi) => { taper(root, A); cliquer(root, 'Identifier'); await attendre(() => root.querySelector('.status.info'), quoi); };
      const r8a = await LA.renderLivreAjoutRoute({}, {}, {}, d8);
      await trouverA(r8a, 'A trouvé (8a)');
      cliquer(r8a, '← Changer d’ISBN'); taper(r8a, B); cliquer(r8a, 'Saisir à la main');
      eq([titreDe(r8a).value, auteurDe(r8a).value, r8a.querySelector('.status.info'), rappel(r8a)], ['', '', null, `ISBN ${B}`], 'route : A trouvé → « ← Changer d’ISBN » → B → « Saisir à la main » : rien de A sous l’ISBN B (C1)');
      const r8i = await LA.renderLivreAjoutRoute({}, {}, {}, d8);
      await trouverA(r8i, 'A trouvé (8i)');
      cliquer(r8i, '← Changer d’ISBN'); taper(r8i, '12345'); cliquer(r8i, 'Saisir à la main');
      eq([titreDe(r8i).value, r8i.querySelector('.status.info'), rappel(r8i)], ['', null, 'ISBN 12345 — non valide, ne sera pas enregistré'], 'route : … et sous un ISBN invalide non plus (C1)');
      const r8b = await LA.renderLivreAjoutRoute({}, {}, {}, d8);
      await trouverA(r8b, 'A trouvé (8b)');
      cliquer(r8b, '← Changer d’ISBN'); cliquer(r8b, 'Saisir à la main');
      eq([titreDe(r8b).value, auteurDe(r8b).value, r8b.querySelector('.status.info')?.textContent ?? null, rappel(r8b)], [`Livre ${A}`, `Auteur ${A}`, 'Renseigné par Open Library — vérifie et corrige.', `ISBN ${A}`], 'route : même ISBN → les champs reçus restent, ET leur étiquette (C1)');
      const r8c = await LA.renderLivreAjoutRoute({}, {}, {}, d8);
      await trouverA(r8c, 'A trouvé (8c)');
      cliquer(r8c, '← Changer d’ISBN'); taper(r8c, B); cliquer(r8c, 'Saisir à la main');
      titreDe(r8c).value = 'Mon titre'; titreDe(r8c).dispatchEvent(new Event('input', { bubbles: true }));
      cliquer(r8c, '← Changer d’ISBN'); taper(r8c, A); cliquer(r8c, 'Identifier');
      await attendre(() => r8c.etatRoute().reponsesRecues === 2 && r8c.querySelector('.status.info'), 'A retrouvé (8c)');
      eq([titreDe(r8c).value, auteurDe(r8c).value], ['Mon titre', `Auteur ${A}`], 'route : un titre tapé à la main survit à la réidentification de A ; le champ vide est rempli (C1, C3)');
    });
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

  // --- Confort après preuve (17 octobre, item 1) : « Liens web gardés » dans Mes livres. Un signet sans livre
  // (edition_id nul, source_url posé) n'apparaissait nulle part, et « ← Mes livres » de sa fiche ramenait à une liste vide.
  {
    const { renderLibrary } = await import('../src/ui/library.js');
    const { buildDocs } = await import('../src/domain/search.js');
    const { EN } = await import('../src/i18n/en.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const { withRepo } = await import('./sync-fixture.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr'); // ce bloc affirme des textes français (rendue dans le finally)
    try {
      const signet = (id, titre, quand = {}) => ({ id, original_title: titre, availability: 'reference_only', source_url: `https://a.test/${id}`, edition_id: null, ...quand });
      // Les docs sont ceux de buildDocs (la forme que recipeCard attend) ; `sansDoc` retire un doc pour le chemin de repli.
      const ctxDe = (recipes, { editions = [], books = [], sansDoc = [] } = {}) => {
        const docs = buildDocs({ recipes, versions: [], editions, books, dishes: [], links: [] });
        return {
          book_editions: editions, recipes, recipe_versions: [], source_documents: [], source_pages: [],
          rediscovery_prefs: [], dishes: [], dish_recipe_links: [], recipesById: new Map(recipes.map((r) => [r.id, r])),
          docsByRecipe: new Map(docs.filter((d) => !sansDoc.includes(d.recipe.id)).map((d) => [d.recipe.id, d])),
          scan_sessions: [], settings: {}, books, booksById: new Map(books.map((b) => [b.id, b])),
          editionsById: new Map(editions.map((e) => [e.id, e])), editionLabel: (e) => books.find((b) => b.id === e.book_id)?.title || '',
        };
      };
      const bloc = (n) => [...n.querySelectorAll('section.card')].find((s) => s.querySelector('h2')?.textContent === 'Liens web gardés') || null;
      const titres = (n) => [...(bloc(n)?.children || [])].filter((c) => c.tagName !== 'H2').map((c) => c.querySelector('h3')?.textContent ?? c.textContent);
      const apres = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
      // (a) aucun livre + un signet : l'état vide reste, ET la section suit, avec la carte du signet
      const seul = signet('rS', 'Saumon au fenouil', { created_at: '2026-10-17T10:00:00.000Z' });
      let n = await renderLibrary({}, {}, ctxDe([seul]));
      eq([n.textContent.includes('Aucun livre pour l’instant.'), !!bloc(n), titres(n), bloc(n)?.querySelector('a.item-link.card')?.getAttribute('href'), apres(n.querySelector('.empty'), bloc(n))],
        [true, true, ['Saumon au fenouil'], '#/recipes/rS', true], 'Mes livres sans livre : l’état vide ET la section « Liens web gardés » après lui, une carte au titre du signet vers sa fiche (confort, item 1)');
      // (b) aucun signet : ni une recette tapée sans livre, ni un signet rangé dans un livre, ni une adresse vide ne font une section
      n = await renderLibrary({}, {}, ctxDe([{ id: 'rT', original_title: 'Tapée', availability: 'available', edition_id: null }, signet('rL', 'Rangé', { edition_id: 'eX' }), signet('rV', 'Vide', { source_url: '' })]));
      eq([n.textContent.includes('Aucun livre pour l’instant.'), n.textContent.includes('Liens web gardés')], [true, false], 'Mes livres sans signet : aucune section « Liens web gardés » (rien n’est rendu)');
      // (c) le plus récent d'abord : created_at, sinon updated_at
      const ancien = signet('r1', 'Ancien', { created_at: '2026-10-01T10:00:00.000Z' });
      const recent = signet('r2', 'Récent', { created_at: '2026-10-15T10:00:00.000Z' });
      eq(titres(await renderLibrary({}, {}, ctxDe([ancien, recent]))), ['Récent', 'Ancien'], 'Liens web gardés : le plus récent d’abord (created_at)');
      eq(titres(await renderLibrary({}, {}, ctxDe([{ ...ancien, updated_at: '2026-10-16T10:00:00.000Z' }, recent]))), ['Récent', 'Ancien'], 'Liens web gardés : created_at prime — « dernier gardé », un favori touché (updated_at) ne réordonne pas la liste (ronde 1)');
      eq(titres(await renderLibrary({}, {}, ctxDe([signet('r0', 'Sans date'), signet('r3', 'Modifié seulement', { updated_at: '2026-10-10T10:00:00.000Z' }), ancien, recent]))), ['Récent', 'Modifié seulement', 'Ancien', 'Sans date'],
        'Liens web gardés : sans created_at, updated_at sert de repli ; sans aucun horodatage, aucune levée et en dernier (ronde 1)');
      // (d) l'onglet Plats n'a pas la section
      n = await renderLibrary({}, { tab: 'dishes' }, ctxDe([seul]));
      eq(n.textContent.includes('Liens web gardés'), false, 'Mes livres, onglet Plats : pas de section « Liens web gardés »');
      // Repli : un signet sans doc ne lève pas — un lien vers sa fiche, au titre du signet
      n = await renderLibrary({}, {}, ctxDe([seul], { sansDoc: ['rS'] }));
      { const a = bloc(n)?.querySelector('a.btn'); eq([titres(n), a?.getAttribute('href'), a?.textContent], [['Saumon au fenouil'], '#/recipes/rS', 'Saumon au fenouil'], 'Liens web gardés : sans doc, un lien a.btn vers la fiche, jamais une levée'); }
      // Avec des livres (grille sur une base jetable) : la section suit la grille, et le signet rangé dans un livre n'y est pas
      await withRepo(async () => {
        const ed = { id: 'eG', book_id: 'bG', year: 2020, cover_sha256: null };
        const livre = { id: 'bG', title: 'Grille', author: 'G.', cuisines: [] };
        const m = await renderLibrary({}, {}, ctxDe([seul, signet('rL', 'Rangé', { edition_id: 'eG' })], { editions: [ed], books: [livre] }));
        eq([m.textContent.includes('Aucun livre pour l’instant.'), titres(m), apres(m.querySelector('.grid'), bloc(m))], [false, ['Saumon au fenouil'], true], 'Mes livres avec un livre : la section suit la grille, le signet rangé dans un livre n’y est pas');
      });
      eq(EN['Liens web gardés'], 'Saved web links', 'en.js : « Liens web gardés »');
    } finally { setUiLocale(localeAvant); }
  }

  // --- § 12 CSP, § 13.10 statique (tâche 10, clôture). S10 RETIRÉE par R-UX-15 : l'assistant IA (src/domain/llm.js)
  // acceptait alors une URL de base LIBRE (compatible OpenAI, configurée dans Réglages ; ce fournisseur est retiré depuis la
  // passerelle) — et Open Library, Google Books et le projet Supabase restent des hôtes https que le navigateur appelle.
  // connect-src reste donc `'self' https:` (dos-d'âne assumé, pas un mur) ; les vrais murs sont script-src 'self', img-src fermé (aucune image externe : les
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
  // MODULES_NEUFS et CHAINES_NEUVES_AILLEURS : en tête de ce fichier (exportées, lot A tâche 4).
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
    for (const m of ['./src/ui/puces.js', './src/ui/livre-ajout.js', './src/ui/accueil-livre.js', './src/ui/signet.js', './src/core/image.js', './src/core/blob-urls.js', './src/core/lien.js', './src/core/isbn.js', './src/domain/lecture-web.js']) ok(sw.includes(`'${m}'`), `SHELL : ${m}`);
    ok(/VERSION = 'cuisine-os-v0\.12\.0-\d+'/.test(sw), 'sw.js : VERSION 0.12.0');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.12.0', 'APP_VERSION 0.12.0');
    const { GOOGLE_BOOKS } = await import('../src/sync/config.js');
    ok(typeof GOOGLE_BOOKS?.key === 'string' && (GOOGLE_BOOKS.key === '' || /^AIza[0-9A-Za-z_-]{35}$/.test(GOOGLE_BOOKS.key)), 'config : la clé Google Books est vide ou au format d’une clé d’API publique — un test de forme, jamais de valeur (S2/F2)');
  }
}
