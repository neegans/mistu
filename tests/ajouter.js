import {lireLivraison} from './livraison-fixture.js';
// Tests du lot « page Ajouter et flux des livres » (spec docs/superpowers/specs/2026-10-13-ajouter-et-livres-ux-design.md).
// Modèles purs et rendus DOM à gestes injectés ; bases jetables seulement ; aucun réseau ; aucun history.* réel.

// Filet i18n (F13) : chaque t('…') de ces modules doit avoir son entrée en.js. Exportées : tests/import-cible.js vérifie que son module y figure.
// MODULES_NEUFS : les modules créés par les lots (lien.js de R-UX-11 et isbn.js inclus) + add.js réécrit + l'écran d'import ciblé (lot A, tâche 4)
// + le module des fichiers du lot G + l'écran de la table des matières (lot C) + le panneau et l'écran de regroupement (lot D, tâche 2)
// + la photo du plat (lot F, tâche 3, P-8) + le domaine des aperçus des résultats web (lot UI-2, tâche 2) + icones.js (lot UI-1 « Carnet », tâche 1 : aucun t(), mais S14 — ni innerHTML, ni html:).
// Lot UI-1, vague finale (constat 13) : UNE lecture des clés t() pour les filets i18n — t('…'), t("…") et t(`…`) sans ${…} (un gabarit à expression n'est pas
// une clé, et une variable non plus) ; F13 la lit sur MODULES_NEUFS, tests/carnet.js (T6) sur ses modules. Son témoin, sur les trois formes, est au bloc F13.
export const clesT = (src) => [...src.matchAll(/\bt\((['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].filter((m) => !(m[1] === '`' && m[2].includes('${'))).map((m) => m[2]);
export const MODULES_NEUFS = ["../src/ui/version-base.js", "../src/domain/cuisine-avertissements.js", "../src/ui/mise-a-jour.js", "../src/ui/hors-ligne-repas.js", '../src/ui/inventaire.js', '../src/ui/inventaire-texte.js', '../src/ui/inventaire-formulaire.js', '../src/ui/inventaire-comparaison.js', '../src/ui/inventaire-restes.js', '../src/ui/meals.js', '../src/ui/grocery.js', '../src/ui/comparaison-cuisine.js', '../src/ui/minuteurs-session.js','../src/ui/ecran-allume.js','../src/ui/voix-cuisine.js', '../src/ui/traduction-editeur.js', '../src/domain/lecture-recette.js', '../src/ui/index-vol.js', '../src/ui/revisions-source.js', '../src/ui/brouillon-editeur.js', '../src/ui/livre-editeur.js', '../src/ui/recette-editeur.js', '../src/ui/sortie-editeur.js', '../src/ui/brouillons-liste.js', '../src/ui/navigation-contexte.js', '../src/ui/actions-contenu.js', '../src/ui/bibliotheque-liste.js', '../src/ui/reprise-import.js', '../src/ui/recipe-edit.js', '../src/ui/corbeille.js', '../src/domain/reperes.js', '../src/domain/reperes-parcours.js', '../src/ui/reperes.js', '../src/ui/reperes-affichage.js', '../src/ui/photos-visibles.js', '../src/ui/photo-gestion.js', '../src/ui/thermomix.js', '../src/ui/cookidoo.js', '../src/ui/thermomix-garde.js', '../src/domain/thermomix.js','../src/ui/cuisson.js', '../src/ui/livre-sans-saisie.js', '../src/ui/photo-page.js', '../src/ui/index-livre.js', '../src/domain/index-livre.js', '../src/ui/coquille.js', '../src/ui/puces.js', '../src/ui/livre-ajout.js', '../src/ui/accueil-livre.js', '../src/ui/signet.js', '../src/core/image.js', '../src/core/blob-urls.js', '../src/core/lien.js', '../src/core/isbn.js', '../src/ui/add.js', '../src/ui/import-cible.js', '../src/domain/lecture-web.js', '../src/ui/import-web.js', '../src/ui/vol.js', '../src/sync/fichiers.js', '../src/ui/table-matieres.js', '../src/ui/regroupement.js', '../src/ui/photo-plat.js', '../src/domain/apercu-web.js', '../src/ui/icones.js'];
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
// Lot E, tâche 3a : le refus du geste « Supprimer » d’un livre (book.js) et le bilan des traces de consultation écartées de la sauvegarde
// (settings.js, AJOUTÉES à la liste du lot G : une seconde clé homonyme la remplacerait). Ronde 1 de la tâche 3a : le refus d’un import encore lié au
// livre (book.js) ; le refus « non vide » dit la phrase de main (« Un livre avec des recettes… »), sans entrée en.js jusqu’ici : l’entrée est posée, la
// chaîne n’est pas neuve.
export const CHAINES_NEUVES_AILLEURS = {
  '../src/core/dom.js': ['Confirmer', 'Annuler', 'OK', 'Choisir'],
  '../src/ui/book.js': ['Voir plus', 'Filtrer les recettes de ce livre', 'Filtrer les pages source', 'Ajouter une recette', 'Ajouter des pages d’index', 'Pages source', 'Recettes', 'Mots-clés', 'Autre mot-clé', 'Séance en cours : {n} page(s)', 'Reprendre', 'Couverture', 'Couverture enregistrée.', 'Couverture retirée.', 'La couverture n’est pas sur cet appareil.', 'Cette image est trop lourde (25 Mo au plus).', 'Cette image ne peut pas être lue ici. Essaie une autre photo.', 'Choisir des photos ou un PDF', 'Photographier', 'Importer', '{n} import à reprendre', '{n} imports à reprendre',
    // Lot G, tâche 6 : la couverture par état (§ 4.2).
    'La couverture n’est pas sur cet appareil. Connecte-toi pour la télécharger.', 'La couverture n’est pas sur cet appareil : l’appareil qui l’a prise ne l’a pas encore envoyée.', 'Fichier illisible reçu du serveur.', 'Le téléchargement n’a pas abouti.',
    // Lot E, tâche 3a : le refus du geste « Supprimer » quand une lecture tient une ligne du journal de l’édition (D-E23).
    'Une lecture est déjà en cours : annule-la d’abord.',
    // Lot E, tâche 3a, ronde 1 : le refus quand une ligne du journal ne se détache pas de l’édition (statut illisible, ou arrivée entre les deux temps).
    'Un import est encore lié à ce livre : rien n’a été supprimé.',
    // Lot UI-1, tâche 4 : la fiche livre recomposée (D-UI-7, D-UI-10) — menus renommés, « Sommaire », la liste compacte et son compteur, « Voir les {n} recettes ».
    'Ajouter des recettes', 'Ajouter des pages de sommaire', 'Sommaire', 'Reprendre la séance', 'Les recettes de ce livre', '{n} disponible(s) · {m} à importer', 'À importer', 'Voir les {n} recettes',
    // Lot UI-1, tâche 6 : complément (A-9) — le retour « ← Bibliothèque » (T1). Ronde 1 : « Toutes » et « Disponibles » retirées d'ici — book.js les
    // écrivait déjà à f3672be (règle d'en-tête : écartées) ; leurs entrées en.js (T2, T4) sont épinglées par la table de tests/carnet.js.
    'Bibliothèque'],
  '../src/ui/import.js': ['Les références n’ont pas pu être créées. Réessaie.',
    // Lot G, tâche 6 : la phrase de séance (§ 4.3, F-21).
    'Sans compte, ces photos restent sur cet appareil : sauvegarde via Réglages', 'Photos : {n}/{m} sauvegardées sur le serveur',
    // Lot C, tâche 4 : les chaînes neuves du panneau d'index.
    'Relire remplace la lecture reçue ({n} entrées non créées) et coûte un appel. Continuer ?', 'Relire', 'Les photos de cette séance ne sont pas sur cet appareil.', 'Revenir à la lecture'],
  '../src/ui/recipe.js': ["Traduction demandée indisponible", "Version demandée indisponible", "La version indiquée par ce lien n’est pas disponible dans cette recette.", "Voir la version courante", "Voir l’original", 'Lien web gardé.', 'Adresse non reconnue : ', 'Importer cette recette', 'Relire les pages',
    // Lot B, tâche 5 : la fiche d'un lien gardé (blocSignet), le bandeau d'une version lue sur le web, la relecture (B-27 : l'ancienne phrase est retirée).
    'L’app n’a pas encore lu la page.', 'Lecture de la page en cours…', 'Voir', 'Lecture reçue : vérifie-la et enregistre.', 'Vérifier et enregistrer', 'Contenu non récupéré : ouvre la page.',
    'Lire la recette avec l’assistant', 'Réessayer', 'Une lecture = un appel à l’assistant, compté dans ton quota du jour.', 'Lors de la recherche, l’assistant disait : {p}', 'Estimé par l’assistant : {r}',
    'Tu es hors ligne.', 'Lue sur {h} le {d} · {m} — vérifie.', 'Lue sur {h} · {m} — vérifie.', 'données de la page', 'texte lu par l’assistant', 'Selon la page : {s}', 'Relire la page avec l’assistant',
    'Lue par l’assistant le {d}', 'Lue par l’assistant', '{n} ligne(s) incertaine(s)', 'page possiblement manquante', 'lecture incomplète', 'Incertain : {t}', 'Vérifiée', 'À vérifier', '1 ligne à vérifier', '{n} lignes à vérifier', 'Photo du plat',
    // Lot C, tâche 5 : la section d’une référence sur sa fiche (D-C6).
    'Section : {s}',
    // Lot UI-1, tâche 3 : les gestes repliés et les repères de l'en-tête (D-UI-6).
    'Portions, versions et autres gestes',
    // Lot UI-1, tâche 6 : complément (A-9) — le retour « ← Bibliothèque » (T1) et « 1 portion » des repères (T3 ; clé d'en.js antérieure, neuve dans
    // recipe.js). Ronde 1 : « {n} portions » retirée d'ici — recipe.js l'écrivait déjà à f3672be (règle d'en-tête : écartée).
    'Bibliothèque', '1 portion'],
  '../src/ui/components.js': ["Préparer Raccourcis", "Le clic sur Raccourcis n’a pas pu être conservé. Vérifie dans Horloge.", "Ouvrir Raccourcis", "Préparer une autre demande", 'Lien web', 'Adresse non reconnue', 'incertain', 'Ligne incertaine selon l’assistant',
    // Lot B, tâche 4 : la ligne de repères déménagée de search.js (ligneReperes, mêmes textes).
    '≈ {n} min', '≈ {h} h', '≈ {h} h {m}', 'facile', 'moyen', 'exigeant', '1 ingrédient', '{n} ingrédients',
    // Lot G, tâche 6 : vignettePage, gesteTelechargement, boutonTelechargerPages, pdfFrame (§ 4.3-4.5).
    'Page', 'Télécharger', 'Téléchargement…', 'Télécharger les {n} pages', 'Le téléchargement n’a pas abouti.', 'Pas encore sur cet appareil', 'Connecte-toi pour la télécharger', 'Pas encore envoyée par l’appareil qui l’a prise', 'Pas encore reçue', 'Fichier illisible reçu du serveur.',
    // Lot UI-1, tâche 2 : la ligne de source de la carte-plat (ligneSource).
    'Du web', 'De mon livre', // fidélité aux maquettes (28 octobre) : la ligne de source ne nomme plus l'hôte ni le livre
    // Lot UI-1, tâche 3 : « Voir la page d’origine » (D-UI-10, I-B5), une définition pour la fiche, le bloc du signet et l'écran d'import web.
    'Voir la page d’origine',
    // Lot UI-1 « Carnet », tâche 5 : les textes courts d'availabilityBadge (D-UI-10).
    'À importer', 'À importer · p. {p}', 'Disponible', 'Partielle'],
  // Lot B, tâche 4 : « Garder et lire » et le doublon sur une carte de l'onglet Web.
  '../src/ui/search.js': ['Mode de recherche', 'Garder et lire', 'Tu as déjà gardé cette adresse.', 'Ouvrir la fiche', 'Adresse non reconnue.', 'Le lien n’a pas pu être gardé. Réessaie.'],
  // Lot UI-1, tâche 2 : la Bibliothèque — en-tête (« Bibliothèque » : clé posée par la tâche 1), segments, filtre, puces, grille bornée, pied et liste « à importer ».
  '../src/ui/library.js': ['Bibliothèque', 'Tes livres, tes trouvailles, tes recettes.', 'Recettes', 'Ajouter une recette', 'Une recette, un ingrédient…', 'Toutes', 'De mes livres', 'Du web',
    'Recettes de mes livres à importer', 'Voir plus', 'À importer', 'Aucune recette pour l’instant.',
    // Ronde 1 (D-T2-c) : l'état vide de ?tab=a-importer.
    'Rien à importer pour l’instant.',
    // Lot UI-1, tâche 5 : le compteur de la grille Livres (library.js, « {n} à importer »).
    '{n} à importer',
    // Lot UI-1, vague finale (constat 4) : un filtre ou une puce du segment Recettes qui ne retient aucune fiche.
    'Aucune recette ne correspond.'],
  // Lot UI-1 « Carnet », tâche 5 : le sous-titre d'Aujourd'hui (§ 4.4).
  '../src/ui/home.js': ["Séance de cuisine", "Progression partielle", "Un suivi de durée est encore en cours.", "Séance terminée · suivi de durée encore en cours.", "Les suivis de durée n’ont pas pu être relus. Ouvre ta séance pour réessayer.", 'Cherche une recette, un ingrédient, une envie.'],
  '../src/ui/cook.js': ["La bibliothèque a changé. Rouvre la séance de cuisine.", "Cuisine", "Recette active", "Cette séance est terminée. Les suivis de durée restent consultables.", "Le changement n’a pas été conservé. Ta séance reste disponible ; relis son état avant de réessayer.", "Version indisponible", "Une version de cette séance est indisponible. Les autres contenus et les suivis restent conservés.", "Certaines étapes anciennes ne peuvent pas être attribuées à une seule recette. Leur historique est conservé.", "La version active est indisponible. Choisis une autre recette de cette séance.", "Portions inconnues", "Étape de la recette", "Étape {n} sur {total}", "Préparation", "Revenir à l’étape", "La traduction choisie a changé. L’original reste affiché jusqu’à ta relecture.", "Relire la traduction mise à jour", "Progression partielle", "{d}/{n} étapes", "L’étape conservée est indisponible. Choisis une étape de cette version.", "Choisir une étape", "Étape {n}", "Durée indiquée : {d}", "Durées indiquées dans chaque recette. Vérifie leur déroulement avant de les combiner.", 'Lue par l’assistant, non relue'],
  '../src/ui/grocery.js': ['Lue par l’assistant, non relue'],
  '../src/ui/recipe-edit.js': ['Une étape par paragraphe (ligne vide entre deux étapes).', 'La recette n’a pas pu être enregistrée. Réessaie.', 'Une lecture est déjà en cours : annule-la d’abord.', 'page possiblement manquante', 'lecture incomplète'],
  // Lot G, tâche 2 : bilans d'archive (création, inspection, restauration — § 4.6).
  '../src/ui/settings.js': ['Stockage protégé contre l’éviction : oui', 'Stockage protégé contre l’éviction : non', 'Stockage protégé contre l’éviction : inconnu', "Diagnostic expurgé", "Lecture du diagnostic…", "Diagnostic copié.", "Copie impossible. Tu peux sélectionner le diagnostic ci-dessous.", "Le diagnostic n’a pas pu être relu. Réessaie sur cet écran.", "Copier le diagnostic", "Diagnostic à partager", "Ce diagnostic contient des versions, des compteurs et des états, sans texte de recette, photo ni identité du compte. Les tailles du navigateur sont des estimations.", "Les fichiers comptés sont ceux référencés dans cette bibliothèque. Leur présence ne certifie pas leur lecture hors ligne. Une valeur inconnue reste indiquée comme telle.", 'Cet envoi de stock reste conservé. Revois les copies dans l’inventaire.', 'La copie locale du lot reste récupérable sur cet appareil.', 'Une modification de stock attend ta comparaison.', 'Comparer le stock', "Cet envoi de cuisine reste conservé. Revois les copies depuis la séance.", "Comparer les copies de cuisine", "La copie locale de cuisine reste récupérable sur cet appareil.", "Une modification de cette séance n’a pas été acceptée. Revois les copies avant de continuer.", "Cet envoi reste conservé. Consulte la recette pour reprendre les changements.", "Copies à consulter", "Cette modification n’a pas été acceptée. Ta copie reste consultable ici. Reprends les changements depuis le contenu concerné.", "Les copies brutes des réponses de traduction restent aussi sur cet appareil. Récupère-les dans leur écran de traduction avant d’effacer cet appareil : elles ne sont ni synchronisées ni dans l’archive.", "Les brouillons de saisie restent sur cet appareil et ne sont pas dans cette archive.", "Retrouver mes brouillons et télécharger leur texte", "Effacer cet appareil supprime aussi ses brouillons. Télécharge leur texte avant de continuer : l’archive ne les contient pas.", "Les brouillons seront perdus : ils ne sont pas dans l’archive. Télécharge leur texte avant de continuer.", "Les brouillons actuels resteront récupérables en texte, sans pouvoir modifier directement la bibliothèque restaurée.", '{n} pages ne sont pas encore téléchargées sur cet appareil et ne sont pas dans l’archive.', '1 page n’est pas encore téléchargée sur cet appareil et n’est pas dans l’archive.', '{n} fichier(s) archivé(s) sont des copies du serveur, pas l’original.', '{n} fichier(s) archivé(s) ont des octets qui ne sont ni l’original ni la copie du serveur connue : archivés tels quels.', 'pages manquantes : {n}', 'copies du serveur : {n}', 'Cette archive renvoie à {n} pages qui ne sont pas dedans : celles qui sont sur le serveur pourront être téléchargées (sur la fiche, ou Réglages → Télécharger toutes les pages).', 'Les pages de cet appareil absentes de l’archive seront retirées d’ici.', '{n} originaux de cet appareil conservés (l’archive portait des copies).', '1 original de cet appareil conservé (l’archive portait une copie).',
    'Réponses conservées après clôture',
    'Ce brouillon est terminé. Une autre copie reste consultable sur cet appareil, sans être appliquée.',
    'Les recettes à revoir sont conservées comme documents. Leurs anciens réglages TM7 ne sont pas des instructions de cuisson validées.',
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
    'Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur, sauf les photos et documents pas encore envoyés (une photo envoyée en qualité réduite n’y garde que sa copie réduite).',
    // Lot E, tâche 3a : le bilan de la sauvegarde, les traces de consultation écartées de l’archive (R-E-11).
    '{n} trace de consultation orpheline ignorée', '{n} traces de consultation orphelines ignorées'],
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
    // --- Lot E (couverture lue), tâche 1 : Open Library par titre ET auteur (spec couverture § 3.4). Mêmes délais, reprise et lecteurs que lookupIsbn ;
    // fiches d'ŒUVRE : ISBN, éditeur, année et langue seulement pour une œuvre à UNE édition (R-E-1). Fixtures mesurées le 19 octobre.
    const { OL_DOCS, OL_STASIO, OL_BERBER, OL_JERUSALEM, reponse: rep } = await import('./couverture-fixture.js');
    const URL_STASIO = 'https://openlibrary.org/search.json?title=%C3%80%20la%20di%20Stasio&author=Jos%C3%A9e%20Di%20Stasio&fields=title,author_name,publisher,first_publish_year,language,subject,isbn,edition_count&limit=3';
    const jamais = async () => { throw new Error('attendre ne doit pas être appelée'); };
    const chercher = (fetch, titre = 'À la di Stasio', auteur = 'Josée Di Stasio', options = {}) => LA.chercherParTitreAuteur(titre, auteur, { fetch, attendre: async () => {}, tentativeMs: 50, ...options });
    const urls = [];
    const r1 = await chercher(async (u, o) => { urls.push([u, o]); return rep(200, OL_STASIO); }, undefined, undefined, { attendre: jamais });
    eq([urls[0][0], LA.URL_OL_TITRE_AUTEUR('À la di Stasio', 'Josée Di Stasio')], [URL_STASIO, URL_STASIO], 'titre+auteur : adresse exacte, title= et author= encodés, fields avec isbn ET edition_count, limit=3 (mutant : limit=1 → rouge)');
    ok(urls[0][1].signal instanceof AbortSignal && urls[0][1].mode === 'cors' && urls[0][1].credentials === 'omit' && urls[0][1].cache === 'no-store' && urls[0][1].referrerPolicy === 'no-referrer', 'titre+auteur : options S12 et un signal par tentative');
    eq([r1.statut, r1.appels, r1.fiches.length], ['trouve', 1, 3], 'titre+auteur : trouvé en un appel, trois fiches au plus');
    eq(r1.fiches[0], { title: 'À la di Stasio', authors: ['Josée Di Stasio'], author: 'Josée Di Stasio', publisher: 'Flammarion Québec', year: 2004, language: 'fr', motsCles: ['Cooking', 'Cuisine'], isbn13: '9782890772816', editionUnique: true }, 'titre+auteur : une œuvre à UNE édition porte son ISBN-13, son éditeur, son année et sa langue');
    eq(r1.fiches[1].publisher, 'n/a', 'titre+auteur : « n/a » reste un éditeur (limite nommée § 11)');
    const rB = await chercher(async () => rep(200, OL_BERBER), 'Berber & Q', 'Josh Katz');
    eq([rB.fiches[1].title, rB.fiches[1].editionUnique, rB.fiches[1].isbn13, rB.fiches[1].publisher, rB.fiches[1].year, rB.fiches[1].language, rB.fiches[1].authors, rB.fiches[1].motsCles], ['Berber and Q', false, null, '', '', null, ['Josh Katz'], ['Barbecuing']], 'titre+auteur : deux éditions → ni ISBN, ni éditeur, ni année, ni langue ; auteurs et mots-clés gardés (mutant : publisher[0] pris → rouge)');
    eq([rB.fiches[0].isbn13, rB.fiches[0].year, rB.fiches[0].publisher], ['9780857839879', 2022, 'Octopus Publishing Group'], 'titre+auteur : « Berber&Q » (une édition) porte son ISBN');
    const rJ = await chercher(async () => rep(200, OL_JERUSALEM), 'Jerusalem', 'Yotam Ottolenghi');
    eq([rJ.fiches[0].isbn13, rJ.fiches[0].editionUnique, rJ.fiches[0].publisher, rJ.fiches[0].author, rJ.fiches[0].motsCles.includes('nyt:hardcover-advice=2012-11-04')], [null, false, '', 'Yotam Ottolenghi, Sami Tamimi', false], 'titre+auteur : Jerusalem → isbn13 null (mutant : isbn[0] → 9788416295029 → rouge) ; sujet technique écarté');
    for (const [titre, auteur] of [['', 'X'], ['T', ''], ['   ', 'X'], [null, 'X'], ['T', 42], ['\u{D800}', 'X']]) {
      let e = null, n = 0;
      try { await LA.chercherParTitreAuteur(titre, auteur, { fetch: async () => { n += 1; return rep(200, OL_STASIO); } }); } catch (x) { e = x; }
      eq([e instanceof TypeError, n], [true, 0], `titre+auteur : ${JSON.stringify([titre, auteur])} → TypeError, aucun appel`);
    }
    eq((await chercher(async () => rep(200, { numFound: 0, docs: [] }))).statut, 'rien', 'titre+auteur : docs vide → rien');
    const rS = await chercher(async () => rep(200, {}));
    eq([rS.statut, rS.motif], ['indisponible', 'serveur'], 'titre+auteur : pas de liste docs → serveur');
    let attentes = 0;
    const r429 = await chercher(async () => rep(429, {}), undefined, undefined, { attendre: async () => { attentes += 1; } });
    eq([r429.statut, r429.motif, r429.appels, attentes], ['indisponible', 'limite', 1, 0], 'titre+auteur : 429 → limite, jamais de reprise ni d’attente (I-R)');
    for (const statut of [500, 503]) {
      let att = 0, n5 = 0;
      const r5 = await chercher(async () => { n5 += 1; return rep(statut, {}); }, undefined, undefined, { attendre: async () => { att += 1; } });
      eq([r5.statut, r5.motif, r5.appels, n5, att], ['indisponible', 'serveur', 1, 1, 0], `titre+auteur : ${statut} → serveur, une seule requête, jamais d’attente ni de reprise (I-R ; ronde 1 ; mutant : reprise sur serveur → rouge)`);
    }
    { const ctl = new AbortController(); ctl.abort(); let nA = 0;
      const rA = await chercher(async () => { nA += 1; return rep(200, OL_STASIO); }, undefined, undefined, { signal: ctl.signal });
      eq([rA.statut, rA.motif, rA.appels, nA], ['indisponible', 'delai', 0, 0], 'titre+auteur : signal déjà levé → delai, AUCUNE requête (signal lu avant chaque tentative, § 3.4 ; ronde 1 ; mutant : lecture retirée → rouge)'); }
    { const ctl = new AbortController(); let nP = 0;
      const rP = await chercher(async () => { nP += 1; throw new TypeError('reseau'); }, undefined, undefined, { signal: ctl.signal, attendre: async () => { ctl.abort(); } });
      eq([rP.statut, rP.motif, rP.appels, nP], ['indisponible', 'delai', 1, 1], 'titre+auteur : abandon pendant l’attente de la reprise (« Saisir à la main ») → delai, aucune seconde requête (ronde 1 ; mutant : signal non relu après attendre → rouge)'); }
    { const vus = [];
      await chercher(async (u) => { vus.push(u); return rep(200, { docs: [] }); }, 't'.repeat(299) + '\u{202E}' + '\u{1F600}'.repeat(100), 'a'.repeat(400));
      const p = new URL(vus[0]).searchParams;
      eq([p.get('title') === 't'.repeat(299) + '\u{1F600}', Array.from(p.get('title')).length, p.get('author') === 'a'.repeat(300)], [true, 300, true], 'titre+auteur : titre et auteur passés par borner(·, 300) avant l’adresse — Cf retiré, coupe en POINTS DE CODE (§ 3.4 ; ronde 1 ; mutant : borner retiré → rouge)'); }
    { const vus = []; let e = null;
      try { await chercher(async (u) => { vus.push(u); return rep(200, { docs: [] }); }, 'A\u{D800}B', 'Ka\u{DC00}tz'); } catch (x) { e = x; }
      const p = vus[0] ? new URL(vus[0]).searchParams : null;
      eq([e?.name ?? null, vus.length, p?.get('title'), p?.get('author')], [null, 1, 'AB', 'Katz'], 'titre+auteur : une demi-paire de substitution (Cs) est retirée avant l’adresse — jamais d’URIError, un statut rendu (ronde 1)'); }
    let n2 = 0;
    const rR = await chercher(async () => { n2 += 1; if (n2 === 1) throw new TypeError('reseau'); return rep(200, OL_STASIO); });
    eq([rR.statut, rR.appels], ['trouve', 2], 'titre+auteur : une reprise sur un échec muet');
    let annule = false;
    const flux = () => ({ ok: true, status: 200, headers: new Headers(), body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(100 * 1024) }), cancel: async () => { annule = true; } }) } });
    const rF = await chercher(async () => flux());
    eq([rF.motif, annule, rF.appels], ['serveur', true, 1], 'titre+auteur : un corps en flux au-delà de 256 Kio est coupé (cancel) → serveur, sans reprise (ronde 1 : appels épinglé)');
    eq(LA.lireSearchListe({ docs: 'x' }), { repondu: false }, 'lireSearchListe : docs qui n’est pas un tableau → repondu false');
    eq(LA.lireSearchListe({ docs: [OL_DOCS[0], OL_DOCS[1], OL_DOCS[2], OL_DOCS[3]] }).fiches.map((f) => f.title), ['À la di Stasio', 'À LA DI STASIO 3', 'Pasta Et Cetera a la Di Stasio'], 'lireSearchListe : quatre documents lisibles → les TROIS premiers, dans l’ordre (mutant : limite de trois retirée → rouge)');
    eq(LA.lireSearchListe({ docs: [null, 7, { title: '' }, { title: 'T', edition_count: '1', isbn: ['9782890772816'], publisher: ['P'], first_publish_year: 2004, language: ['fre'] }] }).fiches,
      [{ title: 'T', authors: [], author: '', publisher: '', year: '', language: null, motsCles: [], isbn13: null, editionUnique: false }], 'lireSearchListe : formes hostiles écartées ; edition_count non entier → editionUnique false, rien de l’édition');
    eq(LA.lireSearchListe({ docs: [{ title: 'T', author_name: ['A'], edition_count: 1, publisher: ['P1', 'P2'] }, { title: 'U', author_name: ['B'], edition_count: 1, publisher: ['P'], first_publish_year: 2004, language: ['fre'] }] }).fiches.map((f) => [f.publisher, f.year, f.language, f.isbn13, f.editionUnique]),
      [['', '', null, null, true], ['P', 2004, 'fr', null, true]], 'lireSearchListe : une édition unique listée sous DEUX éditeurs n’en propose aucun (mutant : le premier pris dès qu’il y en a un → rouge) ; une édition unique SANS ISBN garde éditeur, année et langue, isbn13 null (lecture du § 3.4, ronde 1 : R-E-1 et D-E4 à aligner à la clôture)');
    { const f = LA.lireSearchListe({ docs: [{ title: 'Ti\u{D800}tre', author_name: ['Jo\u{DC00}sh'], edition_count: 1, publisher: ['Ed\u{D800}'], subject: ['Cui\u{DC00}sine'] }] }).fiches[0];
      eq([f?.title, f?.authors, f?.author, f?.publisher, f?.motsCles], ['Titre', ['Josh'], 'Josh', 'Ed', ['Cuisine']], 'lireSearchListe : les demi-paires de substitution (Cs) reçues sont retirées du titre, des auteurs, de l’éditeur et des mots-clés — le jsonb les refuserait à l’envoi (ronde 1)'); }
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
    const faux = { newId: (p) => `${p}-x`, get: async () => undefined, saveBatch: async () => { appels += 1; throw new Error('quota'); } };
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
      const gestes = [...fiche.querySelectorAll('header [data-action]')].filter(n => ['ajouter-index', 'ajouter-recette'].includes(n.dataset.action));
      eq(gestes.map(n => n.textContent), ['Ajouter des pages d’index', 'Ajouter une recette'], 'L3 fiche : les deux gestes d’ajout sont directs en en-tête');
      const panneaux = await Promise.all(['index', 'recette'].map(panel => renderBook({id:'e1'}, {panel}, ctxDe())));
      const menus = panneaux.map(n => n.querySelector('[data-role=ajout-livre]'));
      eq([...menus[0].querySelectorAll('button, a')].map(n=>n.textContent), ['Photographier', 'Choisir des photos ou un PDF'], 'L3 livre : index expose les deux sources sans sélecteur automatique');
      eq([...menus[1].querySelectorAll('button, a')].map(n=>n.textContent), ['Photographier', 'Choisir des photos ou un PDF', 'Saisir à la main'], 'L3 livre : recette offre aussi la saisie manuelle');
      eq(menus[1].querySelector('a').getAttribute('href'), '#/recipes/new?edition=e1', 'L3 livre : la saisie manuelle conserve l’édition');
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
      await repo.saveBatch({ books: [livre], book_editions: [edition] }, { conditions: { book_editions: [{key:edition.id,absente:true}] } });
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
    eq(availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, 'À importer · p. 12', 'pastille : une référence d’index dit « À importer · p. 12 » (D-UI-10, lot Carnet T5)');
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
    eq([a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.textContent], ['https://a.test/x', '_blank', 'noopener noreferrer', 'Voir la page d’origine'], 'signet : lien revalidé au rendu, noopener noreferrer, lien texte « Voir la page d’origine »');
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
      await Promise.all([avec, anonyme].flatMap((n) => [...n.querySelectorAll('img')]).map((i) => { i.loading = 'eager'; return i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }); }));
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
      eq([avec.querySelector('a').textContent, anonyme.querySelector('a').textContent], ['T', 'Sans titre'],
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
  {
    // Lot F (spec plats-en-images § 4.1.2) : deux options de plus, défauts inchangés — la fiche du livre appelle toujours à deux arguments.
    const gestes = { photographier: () => {}, choisir: () => {}, retirer: () => {} };
    const sans = LA.renderZoneCouverture({ sha256: 'x', apercu: null, message: null, enCours: false }, gestes);
    eq([sans.querySelector(':scope > span')?.textContent, [...sans.querySelectorAll('button')].find((b) => b.textContent === 'Retirer')?.hasAttribute('aria-label')], ['Couverture', false],
      'renderZoneCouverture sans troisième argument : « Couverture », « Retirer » sans aria-label (inchangé)');
    const avec = LA.renderZoneCouverture({ sha256: 'x', apercu: null, message: null, enCours: false }, gestes, { libelle: 'Photo du plat', nomRetirer: 'Retirer la photo du plat' });
    eq([avec.querySelector(':scope > span')?.textContent, [...avec.querySelectorAll('button')].map((b) => b.textContent), [...avec.querySelectorAll('button')].find((b) => b.textContent === 'Retirer')?.getAttribute('aria-label')],
      ['Photo du plat', ['Photographier', 'Choisir une image', 'Retirer'], 'Retirer la photo du plat'], 'renderZoneCouverture avec { libelle, nomRetirer } : « Photo du plat », les mêmes boutons dans le même ordre, « Retirer » nommé « Retirer la photo du plat »');
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
    const attendreImages = (n) => Promise.all([...n.querySelectorAll('img')].map((i) => { i.loading = 'eager'; return i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }); }));
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
        const repoRefus = { ...repo, saveBatch: async () => { throw new Error('quota'); } };
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
  // --- La ROUTE, partie C : la couverture lue (lot E, spec couverture § 4, § 7). Base jetable, fausse fetch qui aiguille et honore le signal, pickFiles
  // injecté, scène HORS ÉCRAN mais visible (le focus s'y pose). Chaque scénario part d'une base neuve et d'une scène vide ; une exception y devient une
  // assertion rouge NOMMÉE (la suite continue). Jamais le réseau, jamais la bibliothèque de la personne, jamais le navigateur MCP.
  {
    const { withRepo } = await import('./sync-fixture.js');
    const F = await import('./couverture-fixture.js');
    const UI = await import('../src/ui/import-cible.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr');
    const NOW = '2026-10-19T12:00:00.000Z';
    const PHRASE_D_E9 = 'La couverture est en cours de lecture : attends la réponse ou annule-la.';
    const scene = document.createElement('div');
    scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px';
    document.body.append(scene);
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const role = (root, r) => root.querySelector(`[data-role="${r}"]`);
    const bouton = (root, texte) => [...root.querySelectorAll('button')].find((b) => b.textContent === texte) || null;
    const titreDe = (root) => [...root.querySelectorAll('input[type="text"]')].find((i) => i.name !== 'isbn') || null;
    const champ = (root, libelle) => [...root.querySelectorAll('label.field')].find((f) => f.querySelector('span')?.textContent === libelle)?.querySelector('input, select') || null;
    const rappel = (root) => [...root.querySelectorAll('span.muted')].find((s) => s.textContent.startsWith('ISBN'))?.textContent ?? null;
    const bandeau = (root) => role(root, 'proposition-ol')?.querySelector('p')?.textContent ?? null;
    const suggestions = (root) => [...root.querySelectorAll('button.puce.suggestion')].map((b) => b.textContent);
    const cuisine = (root) => [...root.querySelectorAll('div.field')].find((f) => f.querySelector(':scope > span')?.textContent === 'Cuisines')?.querySelector('button.puce');
    const taper = (input, v) => { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); };
    const lue = (root) => root.etatRoute().lecture?.statut === 'lue';
    const PDF = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'livre.pdf', { type: 'application/pdf' });
    // La route, dépendances injectées, racine posée dans la scène. `pick` : pickFiles (défaut : un sélecteur refermé sans fichier). Par défaut, on attend
    // que la session de l'assistant soit résolue (D-E8 : le bloc du pas 1 dit « Vérification… » jusque-là, sans bouton) — un FAIT, jamais un délai.
    // `tentativeMs` (50 par défaut : une panne d'Open Library se dit vite) passe à 5 000 dans un scénario qui tient une requête Open Library SUSPENDUE
    // (ol: null) : sinon la tentative est abandonnée avant que le test la résolve sur une machine chargée (faux rouge).
    // Ronde 1 de T5 : `veilleMs` (la veille d'une ligne en vol ailleurs, VF-15) et `delaiSessionMs` (la borne de sessionAssistant) passent tels quels ; non
    // donnés, ils valent `undefined` et la route prend ses défauts.
    const monter = async (repo, { ctx = F.ctxDe(), ff = F.fauxFetch(), fetch = null, pick = async () => [], enLigne = () => true, query = {}, nav = null, attendreSession = true, tentativeMs = 50, veilleMs, delaiSessionMs } = {}) => {
      const dits = [], navs = [];
      const root = await LA.renderLivreAjoutRoute({}, query, ctx, { repo, fetch: fetch ?? ff.fetch, enLigne, attendre: async () => {}, tentativeMs, navigate: nav ?? ((p) => navs.push(p)), toast: (m) => dits.push(m), pickFiles: pick, maintenant: () => NOW, veilleMs, delaiSessionMs });
      scene.append(root);
      if (attendreSession) await attendre(() => root.etatRoute().session !== 'verification', 'session de l’assistant résolue');
      return { root, dits, navs };
    };
    const scenario = (nom, fn) => withRepo(async (repo, db) => {
      scene.replaceChildren();
      try { await fn(repo, db); }
      catch (e) { ok(false, `couverture, route — ${nom} : ${e?.name || 'Erreur'} — ${e?.message || String(e)}`); }
      finally { if (UI.volEnCours()) UI.reinitialiserImportCible(); }
    });
    try {
      await scenario('pas 1 sans compte (D-E1, D-E8, F-7)', async (repo, db) => {
        let jetons = 0;
        const ff = F.fauxFetch();
        const pick = { n: 0, fn: async () => { pick.n += 1; return []; } };
        const { root } = await monter(repo, { ctx: F.ctxDe(null, { jeton: async () => { jetons += 1; return null; } }), ff, pick: pick.fn });
        const bloc = role(root, 'couverture-pas1');
        eq([!!bloc, bloc?.querySelector('p')?.textContent, role(root, 'connexion-ia')?.textContent.includes('Connecte-toi pour utiliser l’assistant.'), !!role(root, 'se-connecter'), role(root, 'photographier-couverture'), role(root, 'choisir-couverture'), bloc?.textContent.includes('Vérification de l’assistant…')],
          [true, 'Ou photographie la couverture : l’assistant lit le titre et l’auteur.', true, true, null, null, false], 'pas 1 sans compte : le bloc dit le but, la carte « Connecte-toi… » + « Se connecter », AUCUN bouton de photo, aucun état « Vérification »');
        await tick();
        eq([pick.n, ff.appels.length, jetons, await db.count('imports')], [0, 0, 0, 0], 'pas 1 sans compte : ni sélecteur, ni fetch, ni jeton demandé, rien d’écrit');
        eq([root.querySelector('section p').textContent, bloc.querySelector('small')?.textContent, [...root.querySelectorAll('button')].filter((b) => b.textContent === 'Saisir à la main').length],
          ['Scanne le code-barres, tape l’ISBN, ou saisis le livre à la main.', 'Une photo de la couverture = un appel à l’assistant, compté dans ton quota du jour.', 1], 'pas 1 : la première ligne ne bouge pas, le coût est dit, « Saisir à la main » reste UN (F17)');
        const garde = await monter(repo, { ctx: F.ctxDe(null, { guard: { ok: false, message: 'Cet appareil est lié à un autre compte.' } }), ff });
        eq([role(garde.root, 'connexion-ia')?.textContent, role(garde.root, 'se-connecter')], ['Cet appareil est lié à un autre compte.', null], 'pas 1, garde de compte refusée : le message de la garde, sans « Se connecter » (F-7)');
      });

      await scenario('pas 1 : la session ne retient jamais l’écran (D-E8)', async (repo, db) => {
        let liberer = null;
        const pick = { appels: [], fn: async (o) => { pick.appels.push(o); return []; } };
        const { root } = await monter(repo, { ctx: F.ctxDe(F.SESSION, { jeton: () => new Promise((r) => { liberer = () => r(F.SESSION); }) }), pick: pick.fn, attendreSession: false });
        const isbn = root.querySelector('input[name="isbn"]');
        eq([!!isbn, role(root, 'couverture-pas1')?.querySelector('.status[role="status"]')?.textContent, role(root, 'photographier-couverture')], [true, 'Vérification de l’assistant…', null], 'pas 1 rendu TOUT DE SUITE : champ ISBN présent, « Vérification de l’assistant… » dans le bloc, aucun bouton de photo (mutant : await de la session avant le rendu → rouge)');
        isbn.focus(); taper(isbn, '978030640');
        await attendre(() => typeof liberer === 'function', 'jeton() demandé');
        liberer();
        await attendre(() => !!role(root, 'photographier-couverture'), 'le bloc seul rend les deux boutons');
        eq([root.querySelector('input[name="isbn"]') === isbn, isbn.value, document.activeElement === isbn], [true, '978030640', true], 'à la résolution, le bloc SEUL change : le champ ISBN, sa valeur et son focus survivent (mutant : dessiner() → rouge)');
        const [b1, b2] = [role(root, 'photographier-couverture'), role(root, 'choisir-couverture')];
        eq([b1.className, b2.className, b1.disabled, b2.disabled, b1.textContent, b2.textContent], ['btn', 'btn', false, false, 'Photographier la couverture', 'Choisir une image'], 'pas 1 : deux .btn secondaires (D-E17), actifs');
        b1.click(); b2.click();
        await attendre(() => pick.appels.length === 2, 'deux sélecteurs');
        eq([pick.appels, await db.count('imports')], [[{ accept: 'image/*', multiple: false, capture: 'environment' }, { accept: 'image/*', multiple: false }], 0], 'pas 1 : « Photographier la couverture » ouvre l’appareil photo, « Choisir une image » sans capture ; un sélecteur refermé n’écrit rien');
      });

      await scenario('image refusée : rien n’est écrit, rien ne part (I-E2)', async (repo, db) => {
        const ff = F.fauxFetch();
        const { root } = await monter(repo, { ff, pick: async () => [PDF()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'refus_image', 'refus dit');
        eq([role(root, 'lecture-message')?.textContent, await db.count('imports'), ff.posts().length, root.etatRoute().importId, root.etatRoute().pas, !!role(root, 'choisir-couverture')],
          ['Cette image ne peut pas être lue ici. Essaie une autre photo.', 0, 0, null, 1, true], 'image refusée : messageErreurImage dans le bloc, AUCUNE ligne du journal, aucun POST, pas 1, boutons de retour (mutant : journal écrit avant poserCouverture → rouge)');
      });

      await scenario('photo → lecture → pas 2 → Open Library → « Ajouter ce livre » (I-E2, I-E4, D-E4, D-E12)', async (repo, db) => {
        const ev = [];
        const lotsLivre = [];
        const ff = F.fauxFetch({ assistant: null, ol: null });
        const image = await F.imageDe('stasio.jpg', '#a33');
        const capture = db.onMutate;
        db.onMutate = (m) => {
          if (m.puts?.files) ev.push('files');
          for (const l of m.puts?.imports || []) ev.push('imports:' + l.status);
          if (m.puts?.books) { ev.push('books'); lotsLivre.push(Object.keys(m.puts).sort()); }
          return capture ? capture(m) : null;
        };
        let obs = null;
        // Un espion des lectures d'octets : relireMaintenant lit la ligne puis getFile — la promesse de getFile est le FAIT qu'une relecture a eu lieu
        // (idempotence, plus bas). Open Library est SUSPENDU ici (ol: null) : tentativeMs 5 000, jamais 50.
        const lus = [];
        const espion = { ...repo, getFile: (...a) => { const p = repo.getFile(...a); lus.push(p); return p; } };
        try {
          const { root, dits } = await monter(espion, { ff, tentativeMs: 5000, fetch: (u, o) => { if (String(u).endsWith('/functions/v1/assistant')) ev.push('POST'); return ff.fetch(u, o); }, pick: async () => [image], nav: (p) => ev.push('nav:' + p) });
          obs = new MutationObserver(() => { if (!ev.includes('dom:lu') && root.querySelector('.status.info')?.textContent === 'Lu sur la couverture — vérifie.') ev.push('dom:lu'); });
          obs.observe(root, { childList: true, subtree: true, characterData: true });
          role(root, 'choisir-couverture').click();
          await attendre(() => ff.posts().length === 1, 'le POST est parti');
          const [ligne] = await db.getAll('imports');
          const [fichier] = await db.getAll('files');
          eq([await db.count('imports'), ligne.kind, ligne.status, ligne.cover_sha256, ligne.page_ids, ligne.appels, ligne.document_id_vol, ligne.edition_id, ligne.device_id, typeof ligne.device_id], [1, 'couverture', 'en_cours', fichier.sha256, [], 1, UI.DOCUMENT_ID, null, repo.deviceId(), 'string'], 'vol : UNE ligne couverture, cover_sha256 = le JPEG écrit, appels 1, tenue par CE document, device_id de CET appareil (ronde 1 ; mutant : deviceId null → la section Imports la dirait d’un autre appareil → rouge)');
          eq(ev.slice(0, 5), ['files', 'imports:a_lancer', 'imports:en_cours', 'imports:en_cours', 'POST'], 'ordre (I-E2) : les octets, puis la ligne a_lancer, puis le vol — le POST en dernier (mutant : POST avant la ligne → rouge)');
          const statut = role(root, 'couverture-pas1').querySelector('.status[role="status"]');
          eq([statut?.textContent, statut?.nextElementSibling?.classList.contains('row'), statut?.nextElementSibling?.textContent, role(root, 'photographier-couverture'), role(root, 'choisir-couverture')], ['Lecture de la couverture par l’assistant…', true, 'Annuler', null, null], 'pendant le vol : le statut puis la rangée « Annuler » (R-VIS-8), boutons de photo absents');
          ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
          await attendre(() => lue(root), 'lecture appliquée');
          eq([ev.indexOf('imports:a_verifier') >= 0, ev.indexOf('imports:a_verifier') < ev.indexOf('dom:lu'), root.etatRoute().lecturesRecues], [true, true, 1], 'I-E4 : la lecture est écrite dans le journal AVANT que l’écran la rende (mutant : rendu avant l’écriture → rouge)');
          eq([titreDe(root).value, champ(root, 'Auteur / chef').value, champ(root, 'Éditeur').value, champ(root, 'Langue du livre').value, root.querySelector('.status.info')?.textContent, !!root.querySelector('.zone-couverture img'), root.etatRoute().couverture.sha256],
            ['À la di Stasio', 'Josée Di Stasio', 'Flammarion Québec', 'fr', 'Lu sur la couverture — vérifie.', true, fichier.sha256], 'pas 2 : les champs lus, la provenance, la photo comme couverture de l’édition');
          eq([role(root, 'proposition-ol')?.textContent, ff.vers('openlibrary.org/search.json').length], ['Recherche d’une fiche chez Open Library…', 1], 'rattrapage : « Recherche d’une fiche chez Open Library… » (le tiers est nommé), une requête');
          const url = ff.vers('openlibrary.org/search.json')[0].url;
          eq([url.includes('title=%C3%80%20la%20di%20Stasio'), url.includes('&author=Jos%C3%A9e%20Di%20Stasio&'), ff.vers('covers.openlibrary.org').length], [true, true, 0], 'rattrapage : le titre et le PREMIER auteur ; aucune couverture distante avant la fiche (recomptée après « Utiliser » et après « Ajouter ce livre »)');
          ff.rendreOl.shift()(200, F.OL_STASIO);
          await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
          eq([bandeau(root), role(root, 'plusieurs-editions'), !!bouton(root, 'Utiliser ces renseignements'), bouton(root, 'Ignorer')?.className], ['Proposé par Open Library : À la di Stasio, Josée Di Stasio, Flammarion Québec, 2004, ISBN 9782890772816', null, true, 'btn link'], 'bandeau : œuvre à une édition → titre, auteur, éditeur, année, ISBN ; deux gestes (D-E11)');
          bouton(root, 'Utiliser ces renseignements').click();
          eq([titreDe(root).value, champ(root, 'Auteur / chef').value, champ(root, 'Éditeur').value, champ(root, 'Année').value, rappel(root), root.querySelector('.status.info')?.textContent, suggestions(root), root.etatRoute().couverture.sha256, role(root, 'proposition-ol'), root.etatRoute().isbn, root.etatRoute().propositionsRecues],
            ['À la di Stasio', 'Josée Di Stasio', 'Flammarion Québec', '2004', 'ISBN 9782890772816', 'Renseigné par Open Library — vérifie et corrige.', ['Cooking', 'Cuisine'], fichier.sha256, null, '9782890772816', 1],
            '« Utiliser ces renseignements » : champs repris, ISBN posé (aucun n’était là), provenance Open Library, mots-clés proposés, la PHOTO reste la couverture, bandeau parti');
          // I-E4 (idempotence de relire) : un `online` après « Utiliser » relit la ligne (a_verifier, lecture DÉJÀ appliquée) et ne fait RIEN — ni la
          // lecture rejouée par-dessus « Utiliser », ni l'état `recue`, ni une seconde recherche. Attendu sur un FAIT : la relecture a lu les octets.
          const [nLus, nOlAvant] = [lus.length, ff.vers('openlibrary.org/search.json').length];
          window.dispatchEvent(new Event('online'));
          await attendre(() => lus.length > nLus, 'online : la ligne et les octets relus');
          await lus.at(-1); await tick(); await tick();
          eq([root.etatRoute().lecture?.statut, root.etatRoute().provenance, root.etatRoute().propositionsRecues, ff.vers('openlibrary.org/search.json').length, role(root, 'proposition-ol'), titreDe(root).value, rappel(root), ff.vers('covers.openlibrary.org').length],
            ['lue', 'openlibrary', 1, nOlAvant, null, 'À la di Stasio', 'ISBN 9782890772816', 0],
            'online après « Utiliser » : la lecture déjà appliquée ne l’est pas une seconde fois — statut lue, provenance Open Library, aucune seconde recherche, rien de rendu par-dessus (mutant : lectureAppliquee jamais posée → rouge) ; aucune couverture distante après « Utiliser » (D-E18 ; mutant : couverture demandée pour la fiche → rouge)');
          const nOl = ff.vers('openlibrary.org/search.json').length;
          cuisine(root).click(); await tick();
          eq([ff.vers('openlibrary.org/search.json').length, root.etatRoute().provenance, root.etatRoute().pas, titreDe(root).value], [nOl, 'openlibrary', 2, 'À la di Stasio'], 'un redessin (puce de cuisine) ne relance pas Open Library : zéro requête de plus, provenance et pas intacts (mutant : rattrapage relancé par dessiner() → rouge ; « relire() dans dessiner() » est tué pendant le vol, au bloc du pas 1)');
          bouton(root, 'Ajouter ce livre').click();
          await attendre(() => ev.some((x) => x.startsWith('nav:')), 'navigation');
          const [ed] = await db.getAll('book_editions');
          const fermee = await db.get('imports', ligne.id);
          eq([lotsLivre, ed.cover_sha256, ed.isbn, fermee.status, fermee.edition_id, fermee.reponse_brute, fermee.finished_at, await db.count('books')], [[['book_editions', 'books', 'imports']], fichier.sha256, '9782890772816', 'enregistre', ed.id, null, NOW, 1],
            '« Ajouter ce livre » : UNE transaction pour le livre, l’édition et la fermeture du journal (mutant : deux écritures → rouge) ; la ligne enregistre, pointe l’édition, réponse brute effacée');
          eq([ev.indexOf('books') < ev.findIndex((x) => x.startsWith('nav:')), ev.find((x) => x.startsWith('nav:')), dits.at(-1), ff.vers('covers.openlibrary.org').length], [true, `nav:/books/${ed.id}?nouveau=1`, 'Livre ajouté', 0], '« Livre ajouté » et la fiche ?nouveau=1 APRÈS l’écriture seulement (I-E5) ; toujours aucune couverture distante (D-E18)');
        } finally { db.onMutate = capture; obs?.disconnect(); }
      });

      await scenario('sans « Utiliser », puis « Retirer » : isbn null ; la couverture quitte l’édition, jamais le journal', async (repo, db) => {
        const { root } = await monter(repo, { pick: async () => [await F.imageDe('r.jpg', '#3a3')] }); // Open Library : « rien »
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'lecture et rattrapage');
        eq(role(root, 'proposition-ol'), null, 'Open Library « rien » : aucun bandeau, la mention « Recherche… » disparaît (silencieux)');
        const [ligne] = await db.getAll('imports');
        bouton(root, 'Retirer').click();
        bouton(root, 'Ajouter ce livre').click();
        await attendre(async () => (await db.count('books')) === 1, 'livre écrit');
        const [ed] = await db.getAll('book_editions');
        const l = await db.get('imports', ligne.id);
        eq([ed.isbn, ed.cover_sha256, l.status, l.cover_sha256, l.edition_id], [null, null, 'enregistre', ligne.cover_sha256, ed.id], 'sans « Utiliser » : isbn null ; « Retirer » vide la couverture de l’ÉDITION, jamais celle du journal (la photo reste la preuve de la lecture)');
      });

      await scenario('double tape → UNE ligne, UN POST (N1, I-E3 ; Review Focus 2)', async (repo, db) => {
        const ff = F.fauxFetch();
        const image = await F.imageDe('d.jpg', '#3a3');
        const ouverts = [];
        const { root } = await monter(repo, { ff, pick: () => new Promise((r) => ouverts.push(r)) });
        const b = role(root, 'choisir-couverture');
        b.click(); b.click();
        await attendre(() => ouverts.length === 2, 'deux sélecteurs ouverts (aucun verrou pendant le choix)');
        ouverts.forEach((r) => r([image])); // résolus au même tour
        await attendre(() => lue(root), 'lecture appliquée');
        const lignes = await db.getAll('imports');
        eq([lignes.length, ff.posts().length, root.etatRoute().importId === lignes[0].id], [1, 1, true], 'double tape : une ligne, un POST, importId stable (mutants : relecture synchrone retirée → deux lignes ; await glissé avant « preparation » → deux lignes)');
      });

      await scenario('sélecteur annulé : rien ne se fige (N1 ; Review Focus 2)', async (repo, db) => {
        const ff = F.fauxFetch();
        let choisir = () => new Promise(() => {}); // une annulation ne résout jamais pickFiles (src/core/dom.js n'écoute que change)
        const { root } = await monter(repo, { ff, pick: (o) => choisir(o) });
        role(root, 'choisir-couverture').click(); await tick();
        eq([!!role(root, 'choisir-couverture'), role(root, 'choisir-couverture')?.disabled, role(root, 'photographier-couverture')?.disabled, await db.count('imports')], [true, false, false, 0], 'sélecteur annulé : les deux boutons restent là et actifs, rien d’écrit (mutant : verrou posé avant pickFiles → boutons éteints → rouge)');
        const image = await F.imageDe('s.jpg', '#a3a');
        choisir = async () => [image];
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root), 'seconde tape : lecture');
        eq([await db.count('imports'), ff.posts().length], [1, 1], 'seconde tape : une ligne, un POST, lecture appliquée');
      });

      await scenario('vol de l’import ciblé pris pendant le choix (N1, I-E3)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null });
        const recette = (await repo.ajouterPages([await F.imageDe('p.jpg', '#777')], { import: { id: repo.newId('imp'), kind: 'recette', recipe_id: 'rc_n1' } })).importId;
        await repo.db.put('recipes', { id: 'rc_n1', original_title: 'Recette à lire', availability: 'reference_only' }, { origin: 'device' });
        const [nFiles, nImports] = [await db.count('files'), await db.count('imports')];
        let resoudre = null;
        const { root, dits } = await monter(repo, { ff, pick: () => new Promise((r) => { resoudre = r; }) });
        role(root, 'choisir-couverture').click();
        await attendre(() => typeof resoudre === 'function', 'sélecteur ouvert');
        const vol = UI.lancerExtraction(recette, { ctx: F.ctxDe(), repo, fetch: ff.fetch, enLigne: () => true });
        await attendre(() => ff.posts().length === 1, 'le vol de l’import ciblé est parti');
        resoudre([await F.imageDe('c.jpg', '#a3a')]);
        await attendre(() => dits.length > 0, 'le refus est dit');
        eq([dits.at(-1), await db.count('imports'), await db.count('files'), ff.posts().length], ['Une lecture est déjà en cours : annule-la d’abord.', nImports, nFiles, 1], 'vol pris pendant le choix : le toast, AUCUNE ligne, AUCUNE photo posée, un seul POST (mutant : volEnCours() lu seulement avant pickFiles → une ligne a_lancer → rouge)');
        await UI.annulerVol(recette); await vol;
      });

      await scenario('vol d’une autre route tenu avant la tape, puis avant le montage (§ 4.1, § 4.5 ; ronde 1)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null });
        const recette = (await repo.ajouterPages([await F.imageDe('pt.jpg', '#777')], { import: { id: repo.newId('imp'), kind: 'recette', recipe_id: 'rc_tenu' } })).importId;
        await repo.db.put('recipes', { id: 'rc_tenu', original_title: 'Recette à lire', availability: 'reference_only' }, { origin: 'device' });
        const pick = { n: 0, fn: async () => { pick.n += 1; return [await F.imageDe('vt.jpg', '#a3a')]; } };
        const r1 = await monter(repo, { ff, pick: pick.fn });
        const nImports = await db.count('imports');
        // Vague finale (constat 3) : la route suit désormais les avis du vol (ecouterVol) même sans import — un vol qui NOTIFIE éteint ses boutons. La garde
        // DANS le geste reste nécessaire pour un vol qui ne notifie pas (une lecture web du lot B, dette R-B-27) : simulé ici par la tenue nue de ./vol.js.
        const V = await import('../src/ui/vol.js');
        const web = { importId: 'imp_web_nu', controller: new AbortController(), repo };
        V.prendreVol(web);
        eq(role(r1.root, 'choisir-couverture')?.disabled, false, 'garde du garde : le bouton, rendu avant un vol qui ne notifie pas (lecture web, R-B-27), est encore actif');
        role(r1.root, 'choisir-couverture').click(); await tick();
        eq([pick.n, r1.dits.at(-1), await db.count('imports'), ff.posts().length], [0, 'Une lecture est déjà en cours : annule-la d’abord.', nImports, 0], 'vol tenu AVANT la tape : le toast, AUCUN sélecteur ouvert, rien d’écrit (mutant : les deux gardes avant pickFiles retirées → sélecteur ouvert → rouge)');
        V.libererVol(web);
        const vol = UI.lancerExtraction(recette, { ctx: F.ctxDe(), repo, fetch: ff.fetch, enLigne: () => true });
        await attendre(() => ff.posts().length === 1, 'le vol de l’import ciblé est parti');
        const r2 = await monter(repo, { ff, pick: pick.fn });
        const eteints = (r) => [role(r.root, 'photographier-couverture')?.disabled, role(r.root, 'choisir-couverture')?.disabled];
        eq([eteints(r2), eteints(r1)], [[true, true], [true, true]], 'vol tenu AVANT le montage : les deux boutons du pas 1 rendus éteints (volAilleurs ; mutants : eteint = false, eteint sans volAilleurs → rouge) ; la route montée AVANT le vol a suivi son avis (vague finale, constat 3)');
        await UI.annulerVol(recette); await vol;
        await attendre(() => [...eteints(r1), ...eteints(r2)].every((x) => x === false), 'fin du vol d’une autre route : les boutons rallumés');
        eq([eteints(r1), eteints(r2), r2.root.querySelector('input[name="isbn"]') !== null], [[false, false], [false, false], true], 'fin du vol d’une autre route, SANS import de couverture : les deux boutons des deux routes se rallument, sans geste ni navigation (vague finale, constat 3 ; mutant : écouteur muet sans import → rouge)');
      });

      await scenario('vol d’une autre route pris PENDANT la préparation : le toast, la ligne a_lancer, un seul POST (§ 4.5 ; ronde 1)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null });
        const recette = (await repo.ajouterPages([await F.imageDe('pp.jpg', '#777')], { import: { id: repo.newId('imp'), kind: 'recette', recipe_id: 'rc_prep' } })).importId;
        await repo.db.put('recipes', { id: 'rc_prep', original_title: 'Recette à lire', availability: 'reference_only' }, { origin: 'device' });
        let libererPut = null;
        const espion = { ...repo, saveBatch: (...a) => a[1]?.fichiers?.length ? new Promise((r) => { libererPut = () => r(repo.saveBatch(...a)); }) : repo.saveBatch(...a) };
        const { root, dits } = await monter(espion, { ff, pick: async () => [await F.imageDe('vp.jpg', '#a3a')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'preparation' && typeof libererPut === 'function', 'préparation');
        const vol = UI.lancerExtraction(recette, { ctx: F.ctxDe(), repo, fetch: ff.fetch, enLigne: () => true });
        await attendre(() => ff.posts().length === 1, 'le vol de l’import ciblé est parti');
        libererPut();
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer' && root.etatRoute().pas === 2, 'ligne a_lancer relue');
        const ligne = (await db.getAll('imports')).find((l) => l.kind === 'couverture');
        eq([dits.at(-1), ligne?.status, root.etatRoute().importId === ligne?.id, ff.posts().length], ['Une lecture est déjà en cours : annule-la d’abord.', 'a_lancer', true, 1], 'vol pris pendant la préparation : la photo posée, la ligne a_lancer de la route, le toast, un seul POST (mutant : toast vol_tenu retiré d’apresVol → rouge)');
        await UI.annulerVol(recette); await vol;
      });

      await scenario('« Identifier » en vol : les deux boutons de la couverture éteints (§ 4.1 ; ronde 1)', async (repo) => {
        const ff = F.fauxFetch({ ol: null });
        const { root } = await monter(repo, { ff, tentativeMs: 5000 });
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => ff.vers('openlibrary.org/search.json').length === 1, 'identification partie');
        eq([root.etatRoute().recherche, role(root, 'photographier-couverture')?.disabled, role(root, 'choisir-couverture')?.disabled], [true, true, true], 'pendant « Recherche… » : un geste à la fois au pas 1, les deux boutons de la couverture éteints (mutant : eteint sans recherche → rouge)');
        ff.rendreOl.shift()(200, { numFound: 0, docs: [] });
        await attendre(() => !root.etatRoute().recherche, 'identification finie');
      });

      await scenario('incertains : vides, « Lu : … ? », « Utiliser « … » », sous-titre (D-E15, D-E16)', async (repo) => {
        const ff = F.fauxFetch({ assistant: [200, F.corpsOk({ ...F.LECTURE, subtitle: 'Recettes de tous les jours', uncertain: ['title', 'language'] })] });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('i.jpg', '#a3a')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root), 'lecture appliquée');
        const titre = titreDe(root);
        eq([titre.value, titre.getAttribute('placeholder'), role(root, 'incertain-title')?.textContent, role(root, 'utiliser-lu-title')?.textContent, role(root, 'utiliser-lu-title')?.className, role(root, 'utiliser-lu-title')?.closest('label')],
          ['', 'Lu : À la di Stasio ?', 'illisible sur la couverture', 'Utiliser « À la di Stasio »', 'btn link', null], 'titre incertain : vide, indice « Lu : … ? », la mention, le geste « Utiliser « … » » HORS du label (R-UX-8)');
        eq([!!role(root, 'incertain-language'), role(root, 'utiliser-lu-language'), champ(root, 'Langue du livre').getAttribute('placeholder'), role(root, 'incertain-author'), champ(root, 'Auteur / chef').value, role(root, 'sous-titre')?.textContent],
          [true, null, null, null, 'Josée Di Stasio', 'Sous-titre lu : Recettes de tous les jours'], 'langue incertaine : la mention seule (<select>) ; l’auteur lu, sans mention ; le sous-titre en mention, jamais écrit');
        eq(ff.vers('openlibrary.org').length, 0, 'titre incertain : AUCUNE requête Open Library (D-E4)');
        role(root, 'utiliser-lu-title').click();
        eq([titreDe(root).value, root.etatRoute().champs.title, role(root, 'incertain-title'), role(root, 'utiliser-lu-title'), root.etatRoute().champsLus?.title], ['À la di Stasio', 'À la di Stasio', null, null, 'À la di Stasio'], '« Utiliser « … » » : la valeur posée d’UN geste, mention et bouton partis (mutant : valeur posée sans geste → rouge)');
      });

      await scenario('auteur et éditeur incertains, lecture appliquée hors ligne, éditeur incertain puis « Utiliser ces renseignements » (D-E4, D-E16 ; ronde 1)', async (repo) => {
        {
          // (a) Auteur ET éditeur incertains : les deux mentions et les deux « Utiliser « … » » ; le titre est lu et sûr, donc seule la garde « auteur
          // incertain » coupe le rattrapage (l'éditeur n'y entre pas).
          const ff = F.fauxFetch({ assistant: [200, F.corpsOk({ ...F.LECTURE, uncertain: ['authors', 'publisher'] })], ol: [200, F.OL_STASIO] });
          const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('ia.jpg', '#a33')] });
          role(root, 'choisir-couverture').click();
          await attendre(() => lue(root), 'lecture appliquée');
          await tick(); await tick();
          eq([titreDe(root).value, champ(root, 'Auteur / chef').value, role(root, 'incertain-author')?.textContent, role(root, 'utiliser-lu-author')?.textContent, champ(root, 'Éditeur').value, role(root, 'incertain-publisher')?.textContent, role(root, 'utiliser-lu-publisher')?.textContent],
            ['À la di Stasio', '', 'illisible sur la couverture', 'Utiliser « Josée Di Stasio »', '', 'illisible sur la couverture', 'Utiliser « Flammarion Québec »'], 'auteur et éditeur incertains : vides, chacun sa mention et son geste (mutants : mentions(author), mentions(publisher) retirées → rouge)');
          eq([ff.vers('openlibrary.org').length, root.etatRoute().propositionsRecues, role(root, 'proposition-ol')], [0, 0, null], 'auteur incertain (titre lu, sûr) : rattraper() ne tourne pas, aucune requête Open Library (D-E4 ; mutant : garde « authors incertain » retirée → rouge)');
          role(root, 'utiliser-lu-publisher').click();
          eq([champ(root, 'Éditeur').value, role(root, 'incertain-publisher'), role(root, 'utiliser-lu-publisher'), root.etatRoute().champsLus?.publisher, !!role(root, 'incertain-author')], ['Flammarion Québec', null, null, 'Flammarion Québec', true], '« Utiliser « Flammarion Québec » » : l’éditeur posé d’un geste, sa mention partie, celle de l’auteur reste');
        }
        {
          // (b) La réponse arrive quand l'appareil est passé hors ligne : la lecture est appliquée, aucune recherche ne part.
          scene.replaceChildren();
          let enLigne = true;
          const ff = F.fauxFetch({ assistant: null, ol: [200, F.OL_STASIO] });
          const { root } = await monter(repo, { ff, enLigne: () => enLigne, pick: async () => [await F.imageDe('ib.jpg', '#33a')] });
          role(root, 'choisir-couverture').click();
          await attendre(() => ff.posts().length === 1, 'vol parti');
          enLigne = false;
          ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
          await attendre(() => lue(root), 'lecture appliquée hors ligne');
          await tick(); await tick();
          eq([titreDe(root).value, ff.vers('openlibrary.org').length, root.etatRoute().propositionsRecues, role(root, 'proposition-ol')], ['À la di Stasio', 0, 0, null], 'lecture appliquée hors ligne : les champs lus, AUCUNE recherche ni mention « Recherche… » (D-E4 ; mutant : enLigne() retiré de la garde → rouge)');
        }
        {
          // (c) Éditeur seul incertain, fiche trouvée : « Utiliser ces renseignements » remplit l'éditeur et retire sa mention.
          scene.replaceChildren();
          const ff = F.fauxFetch({ assistant: [200, F.corpsOk({ ...F.LECTURE, uncertain: ['publisher'] })], ol: [200, F.OL_STASIO] });
          const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('ic.jpg', '#3a3')] });
          role(root, 'choisir-couverture').click();
          await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
          eq([!!role(root, 'incertain-publisher'), champ(root, 'Éditeur').value], [true, ''], 'éditeur incertain : vide et nommé avant « Utiliser »');
          bouton(root, 'Utiliser ces renseignements').click();
          eq([champ(root, 'Éditeur').value, role(root, 'incertain-publisher'), role(root, 'utiliser-lu-publisher')], ['Flammarion Québec', null, null], '« Utiliser ces renseignements » : l’éditeur repris de la fiche n’est plus incertain — ni mention ni geste (mutant : incertains gardés après « Utiliser » → rouge)');
        }
      });

      await scenario('Jerusalem : une œuvre à huit éditions ne pose ni ISBN ni éditeur (R-E-1 ; Review Focus 1)', async (repo) => {
        const ff = F.fauxFetch({ assistant: [200, F.corpsOk(F.LECTURE_JERUSALEM)], ol: [200, F.OL_JERUSALEM] });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('j.jpg', '#33a')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
        eq([bandeau(root), role(root, 'plusieurs-editions')?.textContent, ff.vers('openlibrary.org/search.json')[0].url.includes('&author=Yotam%20Ottolenghi&')],
          ['Proposé par Open Library : Jerusalem, Yotam Ottolenghi, Sami Tamimi', 'Plusieurs éditions chez Open Library : scanne le code-barres pour l’ISBN exact.', true], 'bandeau sans ISBN, éditeur ni année, et le renvoi au code-barres ; la requête porte le PREMIER auteur seul');
        taper(champ(root, 'Éditeur'), 'Appetite by Random House');
        bouton(root, 'Utiliser ces renseignements').click();
        eq([root.etatRoute().isbn, rappel(root), champ(root, 'Éditeur').value, champ(root, 'Langue du livre').value], ['', null, 'Appetite by Random House', 'en'], '« Utiliser » : AUCUN ISBN posé (mutant : isbn[0] → 9788416295029 → rouge), aucun rappel ISBN, l’éditeur tapé conservé');
      });

      await scenario('ISBN introuvable puis couverture : l’ISBN tapé reste, rien d’une autre édition (N3, R-E-9)', async (repo) => {
        for (const [lecture, reponseOl, attendu, couleur] of [[F.LECTURE, F.OL_STASIO, 'Proposé par Open Library : À la di Stasio, Josée Di Stasio', '#a33'], [F.LECTURE_JERUSALEM, F.OL_JERUSALEM, 'Proposé par Open Library : Jerusalem, Yotam Ottolenghi, Sami Tamimi', '#33a']]) {
          scene.replaceChildren();
          const ff = F.fauxFetch({ assistant: [200, F.corpsOk(lecture)], ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 0, docs: [] }] : [200, reponseOl]) });
          const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('n3.jpg', couleur)] });
          taper(root.querySelector('input[name="isbn"]'), '9780306406157');
          bouton(root, 'Identifier').click();
          await attendre(() => root.etatRoute().pas === 2 && root.etatRoute().provenance === 'aucune', 'introuvable → pas 2');
          bouton(root, '← Changer d’ISBN').click();
          role(root, 'choisir-couverture').click();
          await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
          eq([bandeau(root), role(root, 'plusieurs-editions')], [attendu, null], `${lecture.title} sous un ISBN valide déjà là : bandeau SANS « ISBN … », sans éditeur ni année (R-E-9 ; mutant : bandeau avec ISBN → rouge), sans renvoi au code-barres (N3)`);
          bouton(root, 'Utiliser ces renseignements').click();
          eq([root.etatRoute().isbn, rappel(root), root.etatRoute().champs.year, root.etatRoute().provenance, titreDe(root).value], ['9780306406157', 'ISBN 9780306406157', '', 'openlibrary', lecture.title],
            `${lecture.title} : « Utiliser » ne remplace ni ne vide l’ISBN tapé (mutant : etat.isbn = fiche.isbn13 ?? '' → rouge) ; aucune année d’une autre édition (mutant : ficheSelonIsbn retirée → '2004' → rouge)`);
          if (lecture === F.LECTURE) eq(suggestions(root), ['Cooking', 'Cuisine'], 'les mots-clés de la fiche restent proposés');
        }
      });

      await scenario('langue choisie à la main : ni la lecture, ni « Utiliser », ni une seconde photo ne la changent (C2, § 7)', async (repo) => {
        // Le câblage de langueTouchee dans la ROUTE (le domaine est éprouvé en tâche 1) : appliquerLecture, utiliserOl et la seconde photo. La lecture
        // et la fiche de Stasio disent « fr » ; la personne a choisi « English » au pas 2 AVANT la première photo.
        const ff = F.fauxFetch({ assistant: [200, F.corpsOk(F.LECTURE)], ol: [200, F.OL_STASIO] });
        const images = [await F.imageDe('l1.jpg', '#a33'), await F.imageDe('l2.jpg', '#33a')];
        const { root } = await monter(repo, { ff, pick: async () => [images.shift()] });
        bouton(root, 'Saisir à la main').click();
        const menu = champ(root, 'Langue du livre');
        menu.value = 'en'; menu.dispatchEvent(new Event('change')); // un <select> exige le change dispatché, même attaché
        eq([root.etatRoute().langueTouchee, root.etatRoute().champs.language], [true, 'en'], 'garde du garde : le menu « Langue du livre » est touché (English)');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'lecture « fr » et bandeau');
        eq([champ(root, 'Langue du livre').value, titreDe(root).value], ['en', 'À la di Stasio'], 'lecture « fr » : la langue choisie reste, le titre lu est posé (mutant : appliquerLecture sans { langueTouchee } → « fr » → rouge)');
        bouton(root, 'Utiliser ces renseignements').click();
        eq([champ(root, 'Langue du livre').value, root.etatRoute().provenance], ['en', 'openlibrary'], '« Utiliser » (fiche « fr ») : la langue choisie reste (mutant : langueTouchee ignoré par « Utiliser » → « fr » → rouge)');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 2, 'seconde lecture « fr » et son rattrapage');
        eq(champ(root, 'Langue du livre').value, 'en', 'seconde photo : la langue touchée n’est ni rendue par remettreChampsLus ni reposée par la seconde lecture (C2)');
      });

      await scenario('seconde photo : un autre livre (N4, I-E10)', async (repo, db) => {
        const lectures = [F.LECTURE, F.LECTURE_BERBER];
        const ff = F.fauxFetch({ assistant: () => [200, F.corpsOk(lectures.shift())], ol: (a) => [200, new URL(a.url).searchParams.get('title') === 'Berber & Q' ? F.OL_BERBER : F.OL_STASIO] });
        const images = [await F.imageDe('s.jpg', '#a33'), await F.imageDe('b.jpg', '#33a')];
        const { root } = await monter(repo, { ff, pick: async () => [images.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'première lecture et son bandeau');
        const premiere = root.etatRoute().importId;
        bouton(root, 'Utiliser ces renseignements').click();
        eq(root.etatRoute().isbn, '9782890772816', 'première couverture : l’ISBN posé par « Utiliser »');
        taper(champ(root, 'Auteur / chef'), 'Josée D.');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 2, 'seconde lecture et son rattrapage');
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value, champ(root, 'Éditeur').value, champ(root, 'Année').value, root.etatRoute().isbn, root.etatRoute().champsLus],
          ['Berber & Q', 'Josée D.', '', '', '', { title: 'Berber & Q', language: 'en' }], 'seconde photo : ce que la première lecture et « Utiliser » avaient posé est vidé, la saisie de la personne reste, la seconde lecture remplit (mutants : remettreChampsLus omise → « À la di Stasio » ; champ tapé vidé ; ISBN posé gardé → rouge)');
        const p = await db.get('imports', premiere);
        eq([p.status, p.finished_at, root.etatRoute().importId !== premiere, await db.count('imports')], ['ignore', NOW, true, 2], 'seconde photo après une LECTURE : la précédente, a_verifier, passe ignore avec finished_at (D-E22 ; ronde 1, mutants : attendus [echec] ou [a_lancer, echec] → elle resterait a_verifier → rouge)');
      });

      await scenario('seconde photo : un ISBN tapé reste, un titre pris par « Utiliser « … » » est vidé (N4)', async (repo) => {
        const lectures = [{ ...F.LECTURE, uncertain: ['title'] }, F.LECTURE_BERBER];
        const ff = F.fauxFetch({ assistant: () => [200, F.corpsOk(lectures.shift())] });
        const images = [await F.imageDe('s.jpg', '#a33'), await F.imageDe('b.jpg', '#33a')];
        const { root } = await monter(repo, { ff, pick: async () => [images.shift()] });
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root), 'première lecture');
        role(root, 'utiliser-lu-title').click();
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root) && root.etatRoute().lecture.lecture?.title === 'Berber & Q', 'seconde lecture');
        eq([titreDe(root).value, root.etatRoute().isbn], ['Berber & Q', '9780306406157'], 'seconde photo : le titre pris d’un geste sur la première couverture est vidé puis relu ; l’ISBN TAPÉ avant la première photo reste');
      });

      await scenario('ISBN identifié puis couverture : la fiche d’ISBN ne survit pas à un autre livre (N4, C3)', async (repo) => {
        const ff = F.fauxFetch({ ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 1, docs: [F.OL_DOCS[4]] }] : [200, F.OL_STASIO]) });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('s.jpg', '#a33')] });
        taper(root.querySelector('input[name="isbn"]'), '9781785035289');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().pas === 2 && titreDe(root)?.value === 'Berber and Q', 'ISBN identifié');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'lecture et bandeau');
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value, root.etatRoute().isbn, bandeau(root)], ['À la di Stasio', 'Josée Di Stasio', '9781785035289', 'Proposé par Open Library : À la di Stasio, Josée Di Stasio'],
          'les champs reçus pour l’ISBN et non touchés sont rendus avant la lecture (mutant : oublierDistants() retiré → « Berber and Q » gardé → rouge) ; l’ISBN identifié reste ; bandeau sans ISBN ni « Flammarion Québec, 2004 » (R-E-9)');
      });

      await scenario('ISBN identifié puis couverture en ÉCHEC : la fiche d’ISBN ne reste pas, sans étiquette, sur le pas 2 vide (C3, I-B ; ronde 1)', async (repo) => {
        // Depuis la ronde 1, appliquerLecture rend aussi les champs d'une fiche d'ISBN : le chemin « lue » ne garde plus seul la remise de la seconde photo.
        const ff = F.fauxFetch({ assistant: [502, { erreur: 'serveur' }], ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 1, docs: [F.OL_DOCS[4]] }] : [200, { numFound: 0, docs: [] }]) });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('se.jpg', '#a33')] });
        taper(root.querySelector('input[name="isbn"]'), '9781785035289');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().pas === 2 && titreDe(root)?.value === 'Berber and Q', 'ISBN identifié');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().pas === 2, 'échec 502');
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value, root.querySelector('.status.info'), root.etatRoute().isbn], ['', '', null, '9781785035289'],
          'photo après une identification, lecture en échec : les champs de la fiche d’ISBN non touchés sont rendus — jamais affichés sans étiquette sur le pas 2 vide (C3, I-B) ; l’ISBN tapé reste (ronde 1 ; mutant : oublierDistants() retiré de la seconde photo → rouge)');
      });

      await scenario('Open Library : ignorer, rien, autre auteur, panne, sans auteur, tout incertain (D-E4, D-E11)', async (repo) => {
        const vraiErreur = console.error;
        const erreurs = [];
        console.error = (...a) => erreurs.push(String(a[0]));
        try {
          for (const [nom, ol, avecBandeau] of [['« Ignorer »', [200, F.OL_STASIO], true], ['aucune correspondance de titre', [200, { numFound: 1, docs: [F.OL_DOCS[2]] }], false],
            ['titre égal, auteur étranger', [200, { numFound: 1, docs: [{ ...F.OL_DOCS[0], author_name: ['Ricardo'] }] }], false], ['panne (deux rejets)', () => { throw new TypeError('reseau coupe'); }, false]]) {
            scene.replaceChildren();
            const ff = F.fauxFetch({ assistant: [200, F.corpsOk(F.LECTURE)], ol });
            const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('o.jpg', '#a33')] });
            role(root, 'choisir-couverture').click();
            await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, nom);
            eq([bandeau(root) !== null, role(root, 'proposition-ol') === null || bandeau(root) !== null], [avecBandeau, true], `Open Library — ${nom} : ${avecBandeau ? 'le bandeau' : 'aucun bandeau, aucune mention restée (mutant : contrôle d’auteur retiré → rouge)'}`);
            if (avecBandeau) {
              bouton(root, 'Ignorer').click();
              eq([role(root, 'proposition-ol'), titreDe(root).value, root.etatRoute().provenance], [null, 'À la di Stasio', 'couverture'], '« Ignorer » : le bandeau part, les champs lus restent (D-E11)');
            }
            if (nom.startsWith('panne')) eq(ff.vers('openlibrary.org/search.json').length, 2, 'panne : une reprise sur l’échec muet, puis silence');
          }
          for (const [nom, lecture] of [['lecture sans auteur', { ...F.LECTURE, authors: [] }], ['tout incertain, sans éditeur', { ...F.LECTURE, publisher: null, uncertain: ['title', 'subtitle', 'authors', 'publisher', 'language'] }]]) {
            scene.replaceChildren();
            const ff = F.fauxFetch({ assistant: [200, F.corpsOk(lecture)], ol: [200, F.OL_STASIO] });
            const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('o.jpg', '#a33')] });
            role(root, 'choisir-couverture').click();
            await attendre(() => lue(root), nom);
            await tick(); await tick();
            // propositionsRecues est le FAIT que rattraper() a tourné : la garde de chercherParTitreAuteur (tâche 1, TypeError avant tout fetch) masquerait
            // à elle seule une garde de la route retirée — zéro requête ne suffit pas à le prouver.
            eq([ff.vers('openlibrary.org').length, role(root, 'proposition-ol'), root.etatRoute().pas, root.etatRoute().propositionsRecues], [0, null, 2, 0], `${nom} : rattraper() ne tourne pas, AUCUNE requête Open Library (B1 : jamais le seul titre ; mutant : garde « sans auteur » retirée → propositionsRecues 1 → rouge), pas 2`);
          }
        } finally { console.error = vraiErreur; }
        eq(erreurs, [], 'Open Library : silencieux — aucun logError, aucune carte rouge (mutant : logError ajouté → rouge)');
      });

      await scenario('« Ajouter ce livre » : ignore sans lecture, statut relu dans la transaction, ligne prise ailleurs (D-E12, I-E5 ; Review Focus 4)', async (repo, db) => {
        const couleurs = ['#a11', '#1a1', '#11a', '#aa1', '#1aa', '#a1a'];
        const vu = async (assistant, { enLigne = () => true } = {}) => {
          scene.replaceChildren();
          const ff = F.fauxFetch({ assistant });
          const image = await F.imageDe('e.jpg', couleurs.shift());
          const r = await monter(repo, { ff, enLigne, pick: async () => [image] });
          role(r.root, 'choisir-couverture').click();
          // Vague finale : `pas === 2` attend aussi la RELECTURE qui suit le vol — un refus (hors ligne) pose a_lancer dès apresVol, avant elle ; sans ce terme,
          // une machine chargée lisait le pas 1 (titreDe nul : un rouge de bruit vu sous mutants, R-E-29).
          await attendre(() => r.root.etatRoute().lecturesRecues === 1 && ['lue', 'echec', 'a_lancer'].includes(r.root.etatRoute().lecture?.statut) && r.root.etatRoute().pas === 2, 'issue du vol, écran relu');
          r.ligne = (await db.getAll('imports')).find((l) => l.id === r.root.etatRoute().importId);
          return r;
        };
        const a = await vu([502, { erreur: 'serveur' }]);
        taper(titreDe(a.root), 'Livre tapé');
        bouton(a.root, 'Ajouter ce livre').click();
        await attendre(async () => (await db.get('imports', a.ligne.id)).status !== 'echec', 'fermée');
        const la = await db.get('imports', a.ligne.id);
        eq([la.status, !!(await db.get('book_editions', la.edition_id)), a.navs.at(-1)], ['ignore', true, `/books/${la.edition_id}?nouveau=1`], 'après un echec et un titre tapé : la ligne passe IGNORE avec edition_id — aucune lecture reçue (mutant : enregistre → rouge)');
        const b = await vu([200, F.corpsOk(F.LECTURE)], { enLigne: () => false });
        taper(titreDe(b.root), 'Livre hors ligne');
        bouton(b.root, 'Ajouter ce livre').click();
        await attendre(async () => (await db.get('imports', b.ligne.id)).status === 'ignore', 'fermée');
        const livreB = (await db.getAll('books')).find((x) => x.title === 'Livre hors ligne');
        const edB = (await db.getAll('book_editions')).find((x) => x.book_id === livreB?.id);
        eq([(await db.get('imports', b.ligne.id)).edition_id, !!edB], [edB?.id, true], 'après a_lancer (hors ligne) : ignore, avec l’edition_id de l’édition RÉELLEMENT écrite (ronde 1 : plus un simple typeof)');
        const c = await vu([200, F.corpsOk(F.LECTURE)]);
        const vraiMutate = db.mutate;
        let bascule = true;
        db.mutate = async (args) => {
          if (bascule && args?.conditions?.imports && args?.puts?.books) {
            bascule = false;
            await vraiMutate.call(db, { puts: { imports: [{ ...(await db.get('imports', c.ligne.id)), status: 'echec', erreur: { raison: 'interne', extra: {} } }] }, origin: 'device' });
          }
          return vraiMutate.call(db, args);
        };
        try { bouton(c.root, 'Ajouter ce livre').click(); await attendre(() => c.navs.length === 1, 'livre écrit'); }
        finally { db.mutate = vraiMutate; }
        eq([(await db.get('imports', c.ligne.id)).status, bascule], ['ignore', false], 'statut basculé a_verifier → echec juste avant la transaction : IGNORE écrit, jamais enregistre — le statut est relu DANS la transaction (mutant : vers calculé hors transaction → rouge)');
        const d = await vu([200, F.corpsOk(F.LECTURE)]);
        await db.put('imports', { ...(await db.get('imports', d.ligne.id)), status: 'en_cours', document_id_vol: 'autre-document', battement_at: NOW });
        const livresAvant = await db.count('books');
        bouton(d.root, 'Ajouter ce livre').click();
        await attendre(() => d.dits.includes(PHRASE_D_E9), 'refus dit');
        eq([await db.count('books'), (await db.get('imports', d.ligne.id)).status], [livresAvant, 'en_cours'], 'ligne passée en_cours par un autre document avant le clic : RIEN d’écrit, la phrase D-E9');
        await attendre(() => !!role(d.root, 'lecture')?.textContent.includes('En cours sur un autre écran'), 'écran relu après le refus');
        eq(bouton(d.root, 'Ajouter ce livre')?.disabled, true, 'refus lecture_en_cours : l’écran est RELU — « En cours sur un autre écran », « Ajouter ce livre » éteint (ronde 1 ; mutant : relire() retiré du refus → rouge)');
        const e = await vu([200, F.corpsOk(F.LECTURE)]);
        await db.put('imports', { ...(await db.get('imports', e.ligne.id)), status: 'ignore', finished_at: NOW });
        const n0 = await db.count('books');
        bouton(e.root, 'Ajouter ce livre').click();
        await attendre(() => e.navs.length === 1, 'livre écrit');
        const le = await db.get('imports', e.ligne.id);
        eq([await db.count('books'), le.status, le.edition_id, e.dits.at(-1)], [n0 + 1, 'ignore', null, 'Livre ajouté'], 'ligne fermée IGNORE par un autre onglet : le livre est écrit seul (saveBatch), le journal intact');
        // La branche `dejaAjoute` d'enregistrerLivre, écrite dans CETTE tâche, a ici son test (le cas « deux routes sur le même ?import= » suit en tâche 4) :
        // la ligne a été fermée ENREGISTRE par un autre onglet, avec une édition présente.
        const dejaLa = await LA.enregistrerLivre({ champs: { title: 'Déjà là' }, isbn: '' }, { repo });
        const f = await vu([200, F.corpsOk(F.LECTURE)]);
        await db.put('imports', { ...(await db.get('imports', f.ligne.id)), status: 'enregistre', edition_id: dejaLa.id, finished_at: NOW });
        const nf = await db.count('books');
        bouton(f.root, 'Ajouter ce livre').click();
        await attendre(() => f.navs.length === 1, 'navigation');
        eq([await db.count('books'), f.dits.at(-1), f.navs[0], (await db.get('imports', f.ligne.id)).edition_id], [nf, 'Ce livre a déjà été ajouté.', `/books/${dejaLa.id}`, dejaLa.id],
          'ligne fermée ENREGISTRE ailleurs, édition présente : AUCUN second livre, « Ce livre a déjà été ajouté. », la fiche existante sans ?nouveau (mutant : saveBatch sur enregistre → deux livres → rouge)');
      });

      await scenario('raisons d’échec → textes et « Relire » (§ 4.5, D-E10, R-E-3)', async (repo, db) => {
        const GEN = 'L’assistant n’a pas répondu. Réessaie.';
        const LISIBLE = 'L’assistant n’a pas répondu lisiblement. Réessaie.';
        const CAS = [
          [403, { erreur: 'non_admis' }, 'non_admis', 'Ce compte n’a pas accès à l’assistant.'],
          [413, { erreur: 'trop_lourd' }, 'requete', 'La demande est trop lourde.'],
          [429, { erreur: 'quota', quota: 60 }, 'quota', 'Tu as atteint la limite du jour pour l’assistant (60 appels).'],
          [429, {}, 'trop_de_demandes', 'Trop de demandes pour l’instant. Réessaie dans une minute.'],
          [401, { erreur: 'non_connecte' }, 'non_connecte', 'Connecte-toi pour utiliser l’assistant.'],
          [502, { erreur: 'serveur' }, 'serveur', GEN + ' Code : serveur'],
          [504, {}, 'delai', GEN + ' Code : delai'],
          [200, F.corpsOk(F.LECTURE, { stop_reason: 'max_tokens' }), 'coupe', LISIBLE],
          [200, F.corpsOk('pas du json'), 'illisible', LISIBLE],
          [200, F.corpsOk({ ...F.LECTURE, title: 'x'.repeat(301) }), 'hors_bornes', LISIBLE],
          ['reseau', null, 'reseau', GEN + ' Code : reseau'],
          [200, F.corpsOk({}), 'vide', 'La couverture ne se lit pas : saisis le titre.'],
        ];
        const ff = F.fauxFetch();
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('cas.jpg', '#a33')] });
        let n = 0, id = null;
        for (const [statut, corps, raison, attendu] of CAS) {
          ff.assistant = statut === 'reseau' ? () => { throw new TypeError('reseau coupe'); } : [statut, corps]; n += 1;
          if (n === 1) role(root, 'choisir-couverture').click(); else role(root, 'relire').click();
          await attendre(async () => { id = id ?? (await db.getAll('imports'))[0]?.id ?? null; const l = id ? await db.get('imports', id) : null; return ff.posts().length === n && l?.erreur?.raison === raison && root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().lecture.erreur?.raison === raison; }, `cas ${raison}`);
          const bloc = role(root, 'lecture');
          const code = ['coupe', 'illisible', 'hors_bornes'].includes(raison);
          eq([root.etatRoute().pas, titreDe(root).value, !!root.querySelector('.zone-couverture img'), bloc?.textContent.includes(attendu), code ? bloc.textContent.includes('Code : ' + raison) : true, role(root, 'relire')?.textContent ?? null, await db.count('imports'), root.querySelector('.status.info'), root.etatRoute().provenance],
            [2, '', true, true, true, raison === 'vide' ? null : 'Relire la couverture', 1, null, null], `raison ${raison} (${statut}) : pas 2 vide avec la couverture, « ${attendu} »${code ? ' + « Code : ' + raison + ' »' : ''}, ${raison === 'vide' ? 'SANS « Relire » (mutant : Relire offert sur vide → rouge)' : '« Relire la couverture » (mutant : refusé sur illisible → rouge)'} ; une seule ligne ; AUCUNE provenance « Lu sur la couverture » sur une lecture qui n’a rien lu (I-E1 ; ronde 1, mutant M05b : provenance posée au rendu qui précède l’appel → rouge)`);
          if (raison === 'requete') ok(!bloc.textContent.includes('choisis moins de pages'), '413 : « La demande est trop lourde. », jamais « choisis moins de pages » (mutant : texteEchecAssistant direct → rouge)');
          if (raison === 'illisible') eq((await db.get('imports', id)).reponse_brute, 'pas du json', 'illisible : la réponse brute est gardée au journal (bornée par contexteDe)');
        }
      });

      await scenario('« Annuler » pendant la lecture (§ 4.5)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('a.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        role(root, 'annuler-lecture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'annulée');
        const [l] = await db.getAll('imports');
        eq([l.status, l.erreur?.raison, ff.posts()[0].options.signal.aborted, role(root, 'lecture')?.textContent.includes('Lecture annulée. L’appel a peut-être été compté ; relancer en coûtera un autre.'), titreDe(root).value, !!role(root, 'relire'), UI.volEnCours()],
          ['echec', 'annule', true, true, '', true, null], '« Annuler » : echec(annule), fetch abandonné, la phrase I-4, aucune lecture appliquée, « Relire la couverture » offert, vol libéré');
      });

      await scenario('hors ligne au clic, puis retour en ligne ; une route démontée n’écoute plus (§ 4.7, F-17)', async (repo, db) => {
        let enLigne = false, lectures = 0;
        const espion = { ...repo, get: (s, k) => { if (s === 'imports') lectures += 1; return repo.get(s, k); } };
        const ff = F.fauxFetch();
        const { root } = await monter(espion, { ff, enLigne: () => enLigne, pick: async () => [await F.imageDe('h.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer' && root.etatRoute().pas === 2, 'a_lancer');
        const [l] = await db.getAll('imports');
        eq([l.status, ff.posts().length, role(root, 'lecture')?.textContent.includes('Tu es hors ligne.'), role(root, 'relire')?.textContent, role(root, 'relire')?.disabled, !!root.querySelector('.zone-couverture img'), !!titreDe(root), root.querySelector('.status.info'), root.etatRoute().provenance],
          ['a_lancer', 0, true, 'Lire la couverture', true, true, true, null, null], 'hors ligne : la couverture posée, la ligne a_lancer, « Tu es hors ligne. », « Lire la couverture » éteint, la saisie possible ; aucune provenance « Lu sur la couverture » (I-E1 ; ronde 1, mutant M05b → rouge)');
        enLigne = true;
        const lecturesAvantOnline = lectures;
        window.dispatchEvent(new Event('online'));
        await attendre(() => role(root, 'relire')?.disabled === false, '« Lire » rallumé');
        eq([role(root, 'lecture')?.textContent.includes('La couverture n’a pas encore été lue.'), lectures > lecturesAvantOnline], [true, true], 'online (dispatché APRÈS le rendu) : la route MONTÉE relit le journal (garde du garde de l’assertion suivante : un simple redessin rallumerait aussi « Lire »), « La couverture n’a pas encore été lue. », « Lire la couverture » rallumé');
        // Ronde 1 : `offline` (§ 4.7, table § 4.5) éteint « Lire » et le dit, dès l'événement (mutant : offline sans effet → rouge) ; puis un vol d'une AUTRE
        // route éteint « Lire » au redessin suivant (§ 4.3.6, volAilleurs ; mutant : `peut` sans volAilleurs → rouge).
        enLigne = false;
        window.dispatchEvent(new Event('offline'));
        eq([role(root, 'relire')?.disabled, role(root, 'lecture')?.textContent.includes('Tu es hors ligne.')], [true, true], 'offline (dispatché APRÈS le rendu) : « Lire la couverture » éteint et « Tu es hors ligne. » sans attendre un redessin (ronde 1 ; mutant : offline sans effet → rouge)');
        enLigne = true;
        window.dispatchEvent(new Event('online'));
        await attendre(() => role(root, 'relire')?.disabled === false, '« Lire » rallumé une seconde fois');
        const ffVol = F.fauxFetch({ assistant: null });
        const recette = (await repo.ajouterPages([await F.imageDe('pv.jpg', '#777')], { import: { id: repo.newId('imp'), kind: 'recette', recipe_id: 'rc_lire' } })).importId;
        await repo.db.put('recipes', { id: 'rc_lire', original_title: 'Recette à lire', availability: 'reference_only' }, { origin: 'device' });
        const vol = UI.lancerExtraction(recette, { ctx: F.ctxDe(), repo, fetch: ffVol.fetch, enLigne: () => true });
        await attendre(() => ffVol.posts().length === 1, 'le vol d’une autre route est parti');
        cuisine(root).click(); await tick();
        eq([role(root, 'relire')?.disabled, ff.posts().length], [true, 0], 'pas 2, ligne a_lancer : un vol d’une AUTRE route tenu → « Lire la couverture » éteint au redessin (ronde 1 ; mutant : peut sans volAilleurs → rouge), aucun POST de la route');
        await UI.annulerVol(recette); await vol;
        root.remove();
        const n = lectures;
        window.dispatchEvent(new Event('online')); await tick(); await tick();
        eq(lectures, n, 'route démontée : online ne relit plus rien (l’écouteur s’est retiré)');
      });

      await scenario('session disparue entre le rendu et le clic → carte, a_lancer (§ 4.5)', async (repo, db) => {
        let session = F.SESSION;
        const ff = F.fauxFetch();
        const { root } = await monter(repo, { ff, ctx: F.ctxDe(F.SESSION, { jeton: async () => session }), pick: async () => [await F.imageDe('s.jpg', '#a33')] });
        await attendre(() => !!role(root, 'choisir-couverture'), 'session prête');
        session = null;
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer' && root.etatRoute().pas === 2, 'a_lancer');
        eq([(await db.getAll('imports'))[0]?.status, ff.posts().length, !!role(root, 'connexion-ia'), role(root, 'relire')?.disabled, !!root.querySelector('.zone-couverture img')], ['a_lancer', 0, true, true, true], 'jeton nul au clic : aucun POST, la ligne a_lancer, la carte « Connecte-toi… » revient, « Lire » éteint, la couverture gardée');
      });

      await scenario('le réseau bascule pendant la saisie : ni offline ni online ne reconstruisent le formulaire (R-UX-9, § 4.7 ; ronde 1)', async (repo) => {
        let enLigne = true;
        const ff = F.fauxFetch({ assistant: [502, { erreur: 'serveur' }] });
        const { root } = await monter(repo, { ff, enLigne: () => enLigne, pick: async () => [await F.imageDe('rb.jpg', '#a33')] });
        // Sans import de couverture (« Saisir à la main ») : un événement réseau ne touche à rien.
        bouton(root, 'Saisir à la main').click();
        let titre = titreDe(root);
        titre.focus(); taper(titre, 'Mon');
        enLigne = false; window.dispatchEvent(new Event('offline'));
        enLigne = true; window.dispatchEvent(new Event('online')); await tick(); await tick();
        eq([titreDe(root) === titre, document.activeElement === titre, titre.value], [true, true, 'Mon'], 'sans import de couverture : offline puis online ne reconstruisent rien — le nœud du titre, sa valeur et son focus survivent (ronde 1 ; avant : offline → dessiner())');
        // Avec une lecture en échec au pas 2 : « Relire » suit le réseau, le formulaire reste.
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().pas === 2, 'échec 502');
        titre = titreDe(root);
        titre.focus(); taper(titre, 'Tit');
        enLigne = false; window.dispatchEvent(new Event('offline'));
        eq([titreDe(root) === titre, document.activeElement === titre, titre.value, role(root, 'relire')?.disabled], [true, true, 'Tit', true], 'offline au pas 2 en échec : « Relire la couverture » éteint, le titre (nœud, valeur, focus) intact (ronde 1)');
        enLigne = true; window.dispatchEvent(new Event('online'));
        await attendre(() => role(root, 'relire')?.disabled === false, 'online : « Relire » rallumé par la relecture');
        eq([titreDe(root) === titre, document.activeElement === titre, titre.value], [true, true, 'Tit'], 'online au pas 2 en échec : la relecture ne remplace que le bloc lecture — le titre (nœud, valeur, focus) survit (ronde 1 ; avant : relire() → dessiner())');
      });

      await scenario('seconde et troisième photos : la précédente passe ignore quel que soit son statut, rien de la première lecture ne reste (D-E22, N4, I-E1 ; ronde 1)', async (repo, db) => {
        let enLigne = true;
        const reponses = [[200, F.corpsOk(F.LECTURE)], [502, { erreur: 'serveur' }]];
        const ff = F.fauxFetch({ assistant: () => reponses.shift() });
        const images = [await F.imageDe('t1.jpg', '#a33'), await F.imageDe('t2.jpg', '#33a'), await F.imageDe('t3.jpg', '#3a3')];
        const { root } = await monter(repo, { ff, enLigne: () => enLigne, pick: async () => [images.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root), 'première lecture');
        const premiere = root.etatRoute().importId;
        bouton(root, '← Changer d’ISBN').click();
        enLigne = false;
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer' && root.etatRoute().importId !== premiere && root.etatRoute().pas === 2, 'seconde photo, hors ligne');
        const seconde = root.etatRoute().importId;
        const p1 = await db.get('imports', premiere);
        eq([p1.status, p1.finished_at, (await db.get('imports', seconde)).status, root.querySelector('.status.info'), root.etatRoute().provenance, titreDe(root).value, champ(root, 'Auteur / chef').value],
          ['ignore', NOW, 'a_lancer', null, null, '', ''], 'seconde photo (hors ligne) après une LECTURE : la précédente a_verifier passe ignore avec finished_at (D-E22) ; le pas 2 a_lancer n’a ni « Lu sur la couverture » ni les champs de la première (I-E1, N4 ; mutant M05c : provenance non remise à la seconde photo → rouge)');
        enLigne = true;
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().importId !== seconde, 'troisième photo, en échec');
        const p2 = await db.get('imports', seconde);
        eq([p2.status, p2.finished_at, await db.count('imports'), root.querySelector('.status.info'), root.etatRoute().provenance], ['ignore', NOW, 3, null, null], 'troisième photo : la précédente a_lancer passe ignore à son tour (D-E22 ; ronde 1) ; l’échec n’a pas de provenance (I-E1)');
      });

      await scenario('« Saisir à la main » pendant le vol : la lecture reçue n’écrase rien (I-E4, N2-a, D-E9, D-E18 ; Review Focus 3)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('m.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        const sha = root.etatRoute().couverture.sha256;
        bouton(root, 'Saisir à la main').click();
        const [ligne] = await db.getAll('imports');
        eq([root.etatRoute().pas, root.etatRoute().couverture.sha256, UI.volEnCours()?.importId, bouton(root, 'Ajouter ce livre').disabled, role(root, 'enregistrer-bloque')?.hidden, role(root, 'enregistrer-bloque')?.textContent, role(root, 'lecture')?.textContent.includes('Lecture de la couverture par l’assistant…'), !!role(root, 'annuler-lecture')],
          [2, sha, ligne.id, true, false, PHRASE_D_E9, true, true], '« Saisir à la main » pendant le vol : pas 2 AVEC la couverture (mutant : garde de saisirMain retirée → rouge), le vol continue, « Ajouter ce livre » éteint avec la phrase D-E9, le statut et « Annuler »');
        const titre = titreDe(root);
        titre.focus(); taper(titre, 'Mon titre');
        ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
        await attendre(() => root.etatRoute().lecture?.statut === 'recue', 'lecture reçue');
        eq([(await db.get('imports', ligne.id)).status, titreDe(root) === titre, titre.value, document.activeElement === titre, champ(root, 'Auteur / chef').value, bouton(root, 'Ajouter ce livre').disabled, role(root, 'enregistrer-bloque')?.hidden, role(root, 'lecture'), role(root, 'annuler-lecture')],
          ['a_verifier', true, 'Mon titre', true, '', false, true, null, null], 'réponse après le geste : journal a_verifier, champs intacts, valeur ET focus du titre survivent, bouton rallumé, phrase cachée, statut et « Annuler » RETIRÉS (N2-a ; mutants : recue absent → champs remplis ; retrait omis → « Annuler » reste)');
        cuisine(root).click(); cuisine(root).click(); await tick();
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value], ['Mon titre', ''], 'deux redessins de suite : les champs restent ceux de la personne (une lecture n’est jamais appliquée par dessiner())');
        bouton(root, 'Ajouter ce livre').click();
        await attendre(async () => (await db.get('imports', ligne.id)).status === 'enregistre', 'fermée avec le livre');
        eq((await db.get('imports', ligne.id)).edition_id, (await db.getAll('book_editions'))[0]?.id, '« Ajouter ce livre » ferme la lecture reçue ENREGISTRE avec l’édition (D-E12)');
      });

      await scenario('« Identifier » après la photo : la couverture photographiée reste, aucune couverture distante (D-E18)', async (repo) => {
        const ff = F.fauxFetch({ ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 1, docs: [{ title: 'Livre identifié', author_name: ['X'], language: ['fre'] }] }] : [200, { numFound: 0, docs: [] }]) });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('d.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root), 'lecture');
        const sha = root.etatRoute().couverture.sha256;
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().pas === 2, 'identifié');
        await tick(); await tick();
        eq([root.etatRoute().couverture.sha256, !!root.querySelector('.zone-couverture img'), ff.vers('covers.openlibrary.org').length], [sha, true, 0], 'la photo reste la couverture, et AUCUNE requête covers.openlibrary.org ne part (pré-garde ; mutant : pré-garde retirée → une requête → rouge)');
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value, champ(root, 'Éditeur').value, root.querySelector('.status.info')?.textContent, role(root, 'incertain-title'), root.etatRoute().lecture?.statut, root.etatRoute().champsLus],
          ['Livre identifié', 'X', '', 'Renseigné par Open Library — vérifie et corrige.', null, 'recue', null], 'identification après une lecture : les champs lus et non touchés sont rendus AVANT la fusion (C3, I-E10) — jamais le titre lu sous la fiche d’un autre ISBN étiquetée « Renseigné par Open Library » (I-B) ; la lecture reste au journal, état recue (ronde 1, choix à ratifier)');
        bouton(root, '← Changer d’ISBN').click();
        bouton(root, 'Saisir à la main').click();
        eq([root.etatRoute().couverture.sha256, root.etatRoute().pas], [sha, 2], '« ← Changer d’ISBN » puis « Saisir à la main » : la couverture photographiée est toujours là (D-E18)');
      });

      await scenario('« ← Changer d’ISBN » pendant le vol : au pas 1, la réponse rend les deux boutons, la saisie survit (N2-a)', async (repo) => {
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('c.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        bouton(root, 'Saisir à la main').click();
        bouton(root, '← Changer d’ISBN').click();
        eq([role(root, 'couverture-pas1')?.querySelector('.status[role="status"]')?.textContent, !!role(root, 'annuler-lecture'), role(root, 'choisir-couverture')], ['Lecture de la couverture par l’assistant…', true, null], 'pas 1 pendant le vol : le statut et « Annuler »');
        const isbn = root.querySelector('input[name="isbn"]');
        isbn.focus(); taper(isbn, '978');
        ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
        await attendre(() => root.etatRoute().lecture?.statut === 'recue', 'reçue');
        eq([!!role(root, 'choisir-couverture'), role(root, 'annuler-lecture'), root.querySelector('input[name="isbn"]') === isbn, isbn.value, document.activeElement === isbn, root.etatRoute().pas],
          [true, null, true, '978', true, 1], 'réponse reçue au pas 1 : le bloc rend les deux boutons, plus d’« Annuler », valeur et focus du champ ISBN intacts (mutants : majBlocCouverture omis ; dessiner() → focus perdu)');
      });

      await scenario('« ← Changer d’ISBN » pendant le vol, puis un ÉCHEC : l’écran reste au pas 1, la saisie survit (P-6, R-UX-9 ; ronde 1)', async (repo) => {
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('p6.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        bouton(root, 'Saisir à la main').click();
        bouton(root, '← Changer d’ISBN').click();
        const isbn = root.querySelector('input[name="isbn"]');
        isbn.focus(); taper(isbn, '978');
        ff.rendre.shift()(502, { erreur: 'serveur' });
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'échec relu');
        eq([root.etatRoute().pas, root.querySelector('input[name="isbn"]') === isbn, isbn.value, document.activeElement === isbn, !!role(root, 'choisir-couverture'), role(root, 'annuler-lecture')], [1, true, '978', true, true, null],
          'échec après un geste : le pas reste celui choisi (P-6 ; mutant : memeVol ignoré → pas 2 → rouge), le bloc rend ses deux boutons, le champ ISBN (nœud, valeur, focus) survit (ronde 1 ; avant : dessiner())');
      });

      await scenario('« Relire la couverture » après une identification : la fiche d’ISBN ne reste pas sous « Lu sur la couverture » (C3, I-B ; ronde 1)', async (repo) => {
        const ff = F.fauxFetch({ assistant: [502, { erreur: 'serveur' }], ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 1, docs: [{ title: 'Livre identifié', author_name: ['X'], publisher: ['Éditions Y'], language: ['eng'] }] }] : [200, { numFound: 0, docs: [] }]) });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('ri.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().pas === 2, 'échec 502');
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().pas === 2 && !root.etatRoute().recherche, 'identifié');
        eq([titreDe(root).value, champ(root, 'Éditeur').value, !!role(root, 'relire')], ['Livre identifié', 'Éditions Y', true], 'garde du garde : la fiche d’ISBN est posée, « Relire la couverture » est offert');
        ff.assistant = [200, F.corpsOk(F.LECTURE)];
        role(root, 'relire').click();
        await attendre(() => lue(root), '« Relire » réussi : lecture appliquée');
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value, champ(root, 'Éditeur').value, root.querySelector('.status.info')?.textContent, root.etatRoute().isbn],
          ['À la di Stasio', 'Josée Di Stasio', 'Flammarion Québec', 'Lu sur la couverture — vérifie.', '9780306406157'], '« Relire » après une identification : les champs de la fiche d’ISBN non touchés sont rendus avant la lecture (C3), l’étiquette dit la seule source, l’ISBN tapé reste ; et un « Relire » après un geste qui avance la génération est appliqué (ronde 1 ; mutant : generationLecture non reposée par lireCouverture → recue → rouge)');
      });

      await scenario('« Relire la couverture » : en_cours rendu AVANT l’appel, même ligne (N2-b, D-E10)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: [502, { erreur: 'serveur' }] });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('r.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'echec');
        taper(titreDe(root), 'Titre tapé');
        ff.assistant = null;
        role(root, 'relire').click();
        await attendre(() => ff.posts().length === 2, 'second appel parti');
        const [l] = await db.getAll('imports');
        eq([await db.count('imports'), l.status, l.appels, role(root, 'lecture')?.textContent.includes('Lecture de la couverture par l’assistant…'), !!role(root, 'annuler-lecture'), bouton(root, 'Ajouter ce livre').disabled, role(root, 'enregistrer-bloque')?.hidden],
          [1, 'en_cours', 2, true, true, true, false], 'pendant « Relire » : la MÊME ligne echec → en_cours, appels 2 ; le bloc dit la lecture et offre « Annuler » ; « Ajouter ce livre » éteint avec la phrase (mutants : rendu après l’await → « Annuler » absent ; etat.lecture non posé → bouton allumé)');
        role(root, 'annuler-lecture').click();
        await attendre(async () => (await db.get('imports', l.id)).erreur?.raison === 'annule', 'annulée');
        eq(root.etatRoute().importId, l.id, '« Annuler » → echec(annule), sur la même ligne');
        // Ronde 1 : un « Relire » RÉUSSI est suivi jusqu'à l'application — ici après « Retirer » (avancer() : la génération avance), donc la lecture
        // n'appartient à l'écran que parce que « Relire » a reposé generationLecture (mutants : ligne retirée, ou generationLecture faussée → recue → rouge).
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().lecture.erreur?.raison === 'annule' && !!role(root, 'relire'), 'écran relu après « Annuler »');
        bouton(root, 'Retirer').click();
        ff.assistant = [200, F.corpsOk(F.LECTURE)];
        role(root, 'relire').click();
        await attendre(() => lue(root), '« Relire » réussi : lecture appliquée');
        eq([titreDe(root).value, champ(root, 'Auteur / chef').value, root.etatRoute().provenance, root.querySelector('.status.info')?.textContent, (await db.get('imports', l.id)).status, await db.count('imports'), ff.posts().length],
          ['Titre tapé', 'Josée Di Stasio', 'couverture', 'Lu sur la couverture — vérifie.', 'a_verifier', 1, 3], '« Relire » réussi : la lecture remplit ce qui est vide (le titre tapé reste), « Lu sur la couverture — vérifie. », même ligne, un troisième POST');
      });

      await scenario('seconde photo après un échec : une nouvelle ligne, la précédente ignorée (D-E22)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: () => (ff.posts().length === 1 ? [502, { erreur: 'serveur' }] : [200, F.corpsOk(F.LECTURE)]) });
        const images = [await F.imageDe('1.jpg', '#a33'), await F.imageDe('2.jpg', '#33a')];
        const { root } = await monter(repo, { ff, pick: async () => [images.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'premier échec');
        const premiere = root.etatRoute().importId;
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root), 'seconde lecture');
        const p = await db.get('imports', premiere);
        const seconde = root.etatRoute().importId;
        eq([await db.count('imports'), p.status, p.finished_at, seconde !== premiere, (await db.get('imports', seconde)).status, await db.count('files')], [2, 'ignore', NOW, true, 'a_verifier', 2], 'seconde photo : DEUX lignes, la précédente ignore avec finished_at, la seconde a volé ; les deux photos restent dans files (mutant : précédente laissée echec → rouge)');
      });

      await scenario('seconde photo quand la précédente a été fermée ailleurs : ni erreur ni journal', async (repo, db) => {
        const vraiErreur = console.error;
        const erreurs = [];
        console.error = (...a) => erreurs.push(String(a[0]));
        try {
          const ff = F.fauxFetch({ assistant: [502, { erreur: 'serveur' }] });
          const images = [await F.imageDe('1.jpg', '#a33'), await F.imageDe('2.jpg', '#33a')];
          const { root } = await monter(repo, { ff, pick: async () => [images.shift()] });
          role(root, 'choisir-couverture').click();
          await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'échec');
          const premiere = root.etatRoute().importId;
          await db.put('imports', { ...(await db.get('imports', premiere)), status: 'ignore', finished_at: NOW });
          ff.assistant = [200, F.corpsOk(F.LECTURE)];
          bouton(root, '← Changer d’ISBN').click();
          role(root, 'choisir-couverture').click();
          await attendre(() => lue(root), 'seconde lecture');
          eq([erreurs, (await db.get('imports', premiere)).status], [[], 'ignore'], 'la précédente déjà fermée ailleurs : TransitionRefusee muette, aucun logError');
        } finally { console.error = vraiErreur; }
      });

      await scenario('seconde photo refusée : la ligne précédente reste celle de la route (M3)', async (repo, db) => {
        const fichiers = [await F.imageDe('1.jpg', '#a33'), PDF()];
        const ff = F.fauxFetch();
        const lus = [];
        const espion = { ...repo, getFile: (...a) => { const p = repo.getFile(...a); lus.push(p); return p; } };
        const { root } = await monter(espion, { ff, pick: async () => [fichiers.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'lecture et rattrapage');
        const premiere = root.etatRoute().importId;
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'refus_image', 'refus');
        eq([await db.count('imports'), root.etatRoute().importId, (await db.get('imports', premiere)).status], [1, premiere, 'a_verifier'], 'image refusée en seconde photo : aucune ligne créée, la précédente gardée par la route, toujours a_verifier (mutant : importId laissé à null → rouge)');
        // C1 (ronde 1) : la ligne précédente revient à la route SANS que sa lecture redevienne applicable — un événement réseau (bascule Wi-Fi / LTE) ne
        // la réapplique pas sans geste (I-E4 : une fois ; § 4.5 « Image refusée … rien d’autre ne change »).
        const [nOl, nLus] = [ff.vers('openlibrary.org/search.json').length, lus.length];
        window.dispatchEvent(new Event('online'));
        await attendre(() => lus.length > nLus, 'online : la ligne précédente relue');
        await lus.at(-1); await tick(); await tick();
        eq([root.etatRoute().pas, root.etatRoute().lecture?.statut, role(root, 'lecture-message')?.textContent, root.etatRoute().provenance, root.etatRoute().champs.title, ff.vers('openlibrary.org/search.json').length],
          [1, 'refus_image', 'Cette image ne peut pas être lue ici. Essaie une autre photo.', null, '', nOl], 'refus de la seconde photo puis online : pas 1, le refus reste dit, la première lecture n’est PAS réappliquée (titre vide, aucune provenance), aucune requête Open Library (C1 ; avant : lectureAppliquee et generationLecture non rendus → pas 2 forcé → rouge)');
        bouton(root, 'Saisir à la main').click();
        taper(titreDe(root), 'Mon livre');
        bouton(root, 'Ajouter ce livre').click();
        await attendre(async () => (await db.get('imports', premiere)).status === 'enregistre', 'fermée');
        eq((await db.get('imports', premiere)).edition_id, (await db.getAll('book_editions'))[0]?.id, '« Ajouter ce livre » ferme cette ligne ENREGISTRE avec l’édition (D-E12)');
      });

      await scenario('écriture du journal impossible : aucun octet orphelin, aucun appel ; la ligne précédente reste (R-E-10)', async (repo, db) => {
        const vraiErreur = console.error;
        const erreurs = [];
        console.error = (...a) => erreurs.push(String(a[0]));
        try {
          let rejeter = true;
          const lus = [];
          const espion = { ...repo, saveBatch: (b, o) => (b?.imports && rejeter ? Promise.reject(new Error('QuotaExceededError')) : repo.saveBatch(b, o)), getFile: (...a) => { const p = repo.getFile(...a); lus.push(p); return p; } };
          const ff = F.fauxFetch();
          const images = [await F.imageDe('1.jpg', '#a33'), await F.imageDe('2.jpg', '#33a'), await F.imageDe('3.jpg', '#3a3')];
          const r1 = await monter(espion, { ff, pick: async () => [images.shift()] });
          role(r1.root, 'choisir-couverture').click();
          await attendre(() => r1.root.etatRoute().lecture?.statut === 'refus_image', 'refus');
          eq([role(r1.root, 'lecture-message')?.textContent, await db.count('files'), await db.count('imports'), ff.posts().length, !!r1.root.etatRoute().couverture.sha256, erreurs.some((x) => x.includes('livre.couverture.journal'))],
            ['Le livre n’a pas pu être enregistré. Réessaie.', 0, 0, 0, false, true], 'journal impossible : le message, aucun octet ou journal, aucun POST, échec journalisé');
          scene.replaceChildren();
          rejeter = false;
          const r2 = await monter(espion, { ff, pick: async () => [images.shift()] });
          role(r2.root, 'choisir-couverture').click();
          await attendre(() => lue(r2.root), 'première lecture');
          const premiere = r2.root.etatRoute().importId;
          bouton(r2.root, '← Changer d’ISBN').click();
          rejeter = true;
          role(r2.root, 'choisir-couverture').click();
          await attendre(() => r2.root.etatRoute().lecture?.statut === 'refus_image', 'refus de la seconde');
          eq([await db.count('imports'), r2.root.etatRoute().importId, (await db.get('imports', premiere)).status], [1, premiere, 'a_verifier'], 'même rejet sur une seconde photo : la ligne précédente reste celle de la route, a_verifier (mutant : importId laissé à null → rouge)');
          // C1 (ronde 1) : puis un événement réseau ne pose pas la lecture de la PREMIÈRE couverture sous la photo de la seconde.
          const [nOl, nLus, shaB] = [ff.vers('openlibrary.org/search.json').length, lus.length, r2.root.etatRoute().couverture.sha256];
          window.dispatchEvent(new Event('online'));
          await attendre(() => lus.length > nLus, 'online : la ligne précédente relue');
          await lus.at(-1); await tick(); await tick();
          eq([r2.root.etatRoute().pas, r2.root.etatRoute().lecture?.statut, r2.root.etatRoute().provenance, r2.root.etatRoute().champs.title, shaB, r2.root.etatRoute().couverture.sha256, ff.vers('openlibrary.org/search.json').length],
            [1, 'refus_image', null, '', null, null, nOl], 'journal refusé à la seconde photo puis online : pas 1, la lecture de la première couverture n’est PAS posée sous la photo de la seconde, aucune requête Open Library (C1 ; avant : pas 2 « Lu sur la couverture » avec le livre A et la photo B → rouge)');
          rejeter = false;
          bouton(r2.root, 'Saisir à la main').click();
          taper(titreDe(r2.root), 'Mon livre');
          bouton(r2.root, 'Ajouter ce livre').click();
          await attendre(async () => (await db.get('imports', premiere)).status === 'enregistre', 'fermée');
          eq((await db.get('imports', premiere)).edition_id, (await db.getAll('book_editions'))[0]?.id, '« Ajouter ce livre » ferme la ligne précédente ENREGISTRE avec l’edition_id de l’édition RÉELLEMENT écrite (ronde 1 : plus un simple typeof)');
        } finally { console.error = vraiErreur; }
      });

      await scenario('rejets imprévus (stockage plein, IndexedDB) : dits, journalisés, jamais un écran figé (#21, #29 ; ronde 1)', async (repo, db) => {
        const vraiErreur = console.error;
        const erreurs = [], rejets = [];
        const surRejet = (e) => rejets.push(e);
        console.error = (...a) => erreurs.push(String(a[0]));
        window.addEventListener('unhandledrejection', surRejet);
        try {
          // (a) L'écriture atomique rejette (quota) : ce n'est pas une image illisible — la phrase du journal impossible, journalisée.
          const e1 = { ...repo, saveBatch: () => Promise.reject(new Error('QuotaExceededError')) };
          const a = await monter(e1, { pick: async () => [await F.imageDe('q1.jpg', '#a33')] });
          role(a.root, 'choisir-couverture').click();
          await attendre(() => a.root.etatRoute().lecture?.statut === 'refus_image', 'refus dit');
          eq([role(a.root, 'lecture-message')?.textContent, erreurs.some((x) => x.includes('livre.couverture.journal')), await db.count('imports'), await db.count('files')], ['Le livre n’a pas pu être enregistré. Réessaie.', true, 0, 0], 'stockage plein à la pose : « Le livre n’a pas pu être enregistré. Réessaie. », journalisé, aucune ligne (ronde 1, #21 ; avant : « Cette image ne peut pas être lue ici… », sans journal)');
          // (b) Une condition rejette pendant la transaction : journal et octets refusés ensemble, écran débloqué.
          scene.replaceChildren();
          const e2 = { ...repo, saveBatch: (b,o) => repo.saveBatch(b,{...o,conditions:{...o.conditions,imports:[{key:b.imports[0].id,fusion:()=>{throw new Error('IDB morte');}}]}}) };
          const b = await monter(e2, { pick: async () => [await F.imageDe('q2.jpg', '#33a')] });
          role(b.root, 'choisir-couverture').click();
          await attendre(() => b.root.etatRoute().lecture?.statut === 'refus_image' || rejets.length > 0, 'préparation terminée (refus dit, ou rejet non géré)');
          await tick();
          eq([b.root.etatRoute().lecture?.statut, role(b.root, 'lecture-message')?.textContent, !!role(b.root, 'choisir-couverture'), await db.count('imports'), await db.count('files'), rejets.length], ['refus_image', 'Le livre n’a pas pu être enregistré. Réessaie.', true, 0, 0, 0], 'transaction refusée : dit, les deux boutons rendus, aucun journal ou octet, aucun rejet non géré (ronde 1, #29)');
          // (c) le vol rejette (transition de départ impossible) : journalisé, l'écran suit la ligne relue (a_lancer), jamais « Lecture… » sans vol.
          scene.replaceChildren();
          const e3 = { ...repo, transitionner: (s, k, o) => (Array.isArray(o?.attendus) && o.attendus.join() === 'a_lancer,echec' ? Promise.reject(new Error('IDB morte')) : repo.transitionner(s, k, o)) };
          const c = await monter(e3, { pick: async () => [await F.imageDe('q3.jpg', '#3a3')] });
          role(c.root, 'choisir-couverture').click();
          await attendre(() => c.root.etatRoute().lecture?.statut === 'a_lancer' || rejets.length > 0, 'vol terminé');
          await tick();
          eq([c.root.etatRoute().lecture?.statut, c.root.etatRoute().pas, role(c.root, 'relire')?.textContent, role(c.root, 'annuler-lecture'), erreurs.some((x) => x.includes('livre.couverture.vol')), rejets.length], ['a_lancer', 2, 'Lire la couverture', null, true, 0], 'vol rejeté : journalisé, la ligne relue a_lancer avec « Lire la couverture », plus d’« Annuler » sans vol, aucun rejet non géré (ronde 1, #29)');
        } finally { console.error = vraiErreur; window.removeEventListener('unhandledrejection', surRejet); }
      });

      await scenario('seconde photo refusée après un ÉCHEC, puis online : l’écran reste au pas 1 (C1 ; ronde 1)', async (repo) => {
        const fichiers = [await F.imageDe('e1.jpg', '#a33'), PDF()];
        const lus = [];
        const espion = { ...repo, getFile: (...a) => { const p = repo.getFile(...a); lus.push(p); return p; } };
        const { root } = await monter(espion, { ff: F.fauxFetch({ assistant: [502, { erreur: 'serveur' }] }), pick: async () => [fichiers.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().pas === 2, 'échec 502');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'refus_image', 'refus');
        const n = lus.length;
        window.dispatchEvent(new Event('online'));
        await attendre(() => lus.length > n, 'online : la ligne précédente relue');
        await lus.at(-1); await tick(); await tick();
        eq([root.etatRoute().pas, !!root.querySelector('input[name="isbn"]'), role(root, 'lecture')], [1, true, null], 'refus après un échec puis online : la ligne précédente (echec) est relue SANS faire passer l’écran au pas 2 — elle n’appartient plus à la génération de l’écran (C1 ; mutant : generationLecture non mise à null → pas 2 → rouge)');
      });

      await scenario('résultat relu invalide pendant un geste : le pas choisi gagne (P-6, #26 ; ronde 1)', async (repo) => {
        let libererT = null, hostile = false;
        const espion = { ...repo,
          get: async (s, k) => { const l = await repo.get(s, k); return hostile && s === 'imports' && l?.status === 'a_verifier' ? { ...l, resultat: { title: 5 } } : l; },
          transitionner: (s, k, o) => (hostile && Array.isArray(o?.attendus) && o.attendus.join() === 'a_verifier' ? new Promise((res, rej) => { libererT = () => repo.transitionner(s, k, o).then(res, rej); }) : repo.transitionner(s, k, o)) };
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(espion, { ff, pick: async () => [await F.imageDe('h26.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        hostile = true;
        ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
        await attendre(() => typeof libererT === 'function', 'revalidation : écriture en cours');
        bouton(root, 'Saisir à la main').click();
        bouton(root, '← Changer d’ISBN').click();
        libererT();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'échec illisible posé');
        eq([root.etatRoute().pas, root.etatRoute().lecture.erreur?.raison, !!role(root, 'choisir-couverture')], [1, 'illisible', true], 'résultat relu invalide, geste pendant l’écriture de l’échec : l’écran reste au pas 1 choisi, le bloc rend ses boutons (ronde 1, #26 ; avant : pas 2 forcé)');
      });

      await scenario('une relecture en vol quand une nouvelle photo prend la route : la préparation n’est pas écrasée (#20 ; ronde 1)', async (repo) => {
        let suspendreSha = null, libererGet = null, libererPut = null, suspendrePut = false;
        const espion = { ...repo,
          getFile: (sha) => (sha === suspendreSha ? new Promise((res) => { libererGet = () => { const p = repo.getFile(sha); res(p); return p; }; }) : repo.getFile(sha)),
          saveBatch: (...a) => (suspendrePut && a[1]?.fichiers?.length ? new Promise((res) => { libererPut = () => res(repo.saveBatch(...a)); }) : repo.saveBatch(...a)) };
        const images = [await F.imageDe('a20.jpg', '#a33'), await F.imageDe('b20.jpg', '#33a')];
        const { root } = await monter(espion, { pick: async () => [images.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'première lecture');
        suspendreSha = root.etatRoute().couverture.sha256;
        window.dispatchEvent(new Event('online'));
        await attendre(() => typeof libererGet === 'function', 'relecture suspendue sur les octets');
        suspendrePut = true;
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'preparation' && typeof libererPut === 'function', 'seconde photo en préparation');
        await libererGet(); await tick(); await tick();
        eq(root.etatRoute().lecture?.statut, 'preparation', 'relecture de l’ancienne ligne reprise APRÈS le choix d’une nouvelle photo : rien n’écrase la préparation (ronde 1, #20 ; mutant : garde importId retirée après getFile → recue → la garde de la double tape tombe → rouge)');
        suspendrePut = false; libererPut();
        await attendre(() => lue(root) && root.etatRoute().lecture.lecture?.title === 'À la di Stasio' && root.etatRoute().importId !== null, 'seconde lecture');
      });

      await scenario('résultat relu invalide quand une nouvelle photo prend la route : la préparation n’est pas écrasée (#20 ; ronde 1)', async (repo, db) => {
        let libererT = null, libererPut = null, suspendre = false;
        const espion = { ...repo,
          transitionner: (s, k, o) => (suspendre && Array.isArray(o?.attendus) && o.attendus.join() === 'a_verifier' ? new Promise((res, rej) => { libererT = () => repo.transitionner(s, k, o).then(res, rej); }) : repo.transitionner(s, k, o)),
          saveBatch: (...a) => (suspendre && libererT && a[1]?.fichiers?.length ? new Promise((res) => { libererPut = () => res(repo.saveBatch(...a)); }) : repo.saveBatch(...a)) };
        const images = [await F.imageDe('hv1.jpg', '#a33'), await F.imageDe('hv2.jpg', '#33a')];
        const { root } = await monter(espion, { ff: F.fauxFetch({ assistant: [502, { erreur: 'serveur' }] }), pick: async () => [images.shift()] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && root.etatRoute().pas === 2, 'échec 502');
        const id = root.etatRoute().importId;
        await db.put('imports', { ...(await db.get('imports', id)), status: 'a_verifier', resultat: { title: 5 }, erreur: null }); // reçue d'ailleurs, refusée par la revalidation (I-E1)
        suspendre = true;
        window.dispatchEvent(new Event('online'));
        await attendre(() => typeof libererT === 'function', 'revalidation : écriture de l’échec en cours');
        bouton(root, '← Changer d’ISBN').click();
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'preparation' && typeof libererPut === 'function', 'nouvelle photo en préparation');
        libererT();
        await attendre(async () => (await db.get('imports', id)).status === 'echec', 'échec illisible écrit');
        await tick(); await tick();
        eq(root.etatRoute().lecture?.statut, 'preparation', 'revalidation achevée APRÈS le choix d’une nouvelle photo : l’échec de l’ancienne ligne n’écrase pas la préparation (ronde 1, #20 ; mutant : importId non relu après l’écriture → rouge)');
        suspendre = false; libererPut();
        await attendre(() => !!root.etatRoute().importId && root.etatRoute().importId !== id && root.etatRoute().lecture?.statut !== 'preparation', 'seconde photo posée');
      });

      await scenario('« Identifier » l’ISBN posé par « Utiliser ces renseignements » : l’ISBN reste, la fiche d’ISBN remplace la lecture (C3 ; ronde 1)', async (repo) => {
        const ff = F.fauxFetch({ ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 1, docs: [F.OL_DOCS[0]] }] : [200, F.OL_STASIO]) });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('ui.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
        bouton(root, 'Utiliser ces renseignements').click();
        bouton(root, '← Changer d’ISBN').click();
        eq(root.querySelector('input[name="isbn"]')?.value, '9782890772816', 'garde du garde : le champ ISBN porte l’ISBN posé par « Utiliser »');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().pas === 2 && !root.etatRoute().recherche, 'identifié');
        eq([root.etatRoute().isbn, rappel(root), titreDe(root).value, root.querySelector('.status.info')?.textContent, root.etatRoute().lecture?.statut], ['9782890772816', 'ISBN 9782890772816', 'À la di Stasio', 'Renseigné par Open Library — vérifie et corrige.', 'recue'],
          'identifier l’ISBN qu’« Utiliser » avait posé : l’ISBN identifié reste (la remise des champs lus ne le vide pas), la fiche d’ISBN remplit, une seule étiquette (ronde 1 ; mutant : remettreChampsLus() sans { isbn: false } → ISBN vidé → rouge)');
      });

      await scenario('retour en ligne sans import, et pendant la préparation : rien n’est lu (R-E-10)', async (repo) => {
        let lectures = 0, libererPut = null;
        const rejets = [];
        const surRejet = (e) => rejets.push(e);
        window.addEventListener('unhandledrejection', surRejet);
        try {
          const espion = { ...repo, get: (s, k) => { if (s === 'imports') lectures += 1; return repo.get(s, k); }, saveBatch: (...a) => a[1]?.fichiers?.length ? new Promise((r) => { libererPut = () => r(repo.saveBatch(...a)); }) : repo.saveBatch(...a) };
          const { root } = await monter(espion, { pick: async () => [await F.imageDe('p.jpg', '#a33')] });
          window.dispatchEvent(new Event('online')); await tick(); await tick();
          bouton(root, 'Saisir à la main').click();
          taper(titreDe(root), 'Tapé');
          window.dispatchEvent(new Event('online')); await tick(); await tick();
          eq([lectures, rejets.length, root.etatRoute().pas, titreDe(root).value], [0, 0, 2, 'Tapé'], 'sans import de couverture : online ne lit RIEN (aucun r.get), aucun rejet non géré, état et champs intacts');
          bouton(root, '← Changer d’ISBN').click();
          role(root, 'choisir-couverture').click();
          await attendre(() => root.etatRoute().lecture?.statut === 'preparation' && typeof libererPut === 'function', 'préparation');
          window.dispatchEvent(new Event('online')); await tick(); await tick();
          eq([root.etatRoute().lecture?.statut, lectures, rejets.length], ['preparation', 0, 0], 'pendant la préparation : online ne lit rien, la préparation survit (mutant : garde !etat.importId retirée → r.get(imports, null) → rouge)');
          libererPut();
          await attendre(() => lue(root), 'lecture après la préparation');
        } finally { window.removeEventListener('unhandledrejection', surRejet); }
      });

      await scenario('pendant la préparation : « Ajouter ce livre » attend, « Identifier » garde la photo et ne demande aucune couverture distante (D-E9, D-E18 ; ronde 1)', async (repo) => {
        let libererPut = null;
        const espion = { ...repo, saveBatch: (...a) => a[1]?.fichiers?.length ? new Promise((r) => { libererPut = () => r(repo.saveBatch(...a)); }) : repo.saveBatch(...a) };
        const ff = F.fauxFetch({ ol: (a) => (new URL(a.url).searchParams.has('isbn') ? [200, { numFound: 1, docs: [{ title: 'Livre identifié', author_name: ['X'], language: ['fre'] }] }] : [200, { numFound: 0, docs: [] }]) });
        const { root } = await monter(espion, { ff, pick: async () => [await F.imageDe('pr.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'preparation' && typeof libererPut === 'function', 'préparation');
        bouton(root, 'Saisir à la main').click();
        taper(titreDe(root), 'Mon titre');
        eq([root.etatRoute().pas, bouton(root, 'Ajouter ce livre')?.disabled, role(root, 'enregistrer-bloque')?.hidden, role(root, 'enregistrer-bloque')?.textContent], [2, true, false, PHRASE_D_E9],
          'préparation : « Ajouter ce livre » éteint avec la phrase D-E9 (mutant : preparation retirée d’enregistrementBloque → un livre écrit sans couverture, la ligne orpheline → rouge)');
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().pas === 2 && !root.etatRoute().recherche, 'identifié pendant la préparation');
        await tick(); await tick();
        eq([root.etatRoute().couverture.touchee, ff.vers('covers.openlibrary.org').length], [true, 0], '« Identifier » pendant la préparation : la couverture de la route reste touchée, AUCUNE requête covers.openlibrary.org (D-E18 ; ronde 1 : importId nul pendant le ré-encodage ne vaut plus « sans photo »)');
        libererPut();
        await attendre(() => ['recue', 'lue'].includes(root.etatRoute().lecture?.statut), 'lecture après la préparation');
        eq([root.etatRoute().lecture?.statut, !!root.etatRoute().couverture.sha256, ff.vers('covers.openlibrary.org').length, titreDe(root).value], ['recue', true, 0, 'Mon titre'], 'puis la photo devient la couverture, la lecture arrive après des gestes (recue, I-E4), toujours aucune couverture distante');
      });

      await scenario('route démontée pendant le vol : la lecture reste au journal, rien n’est appliqué, Open Library n’est pas appelée (I-E4, I-E7 ; ronde 1)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null, ol: [200, F.OL_STASIO] });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('dm.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        root.remove();
        ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
        await attendre(async () => (await db.getAll('imports'))[0]?.status === 'a_verifier' && ['lue', 'recue'].includes(root.etatRoute().lecture?.statut), 'réponse traitée');
        await tick(); await tick();
        eq([root.isConnected, root.etatRoute().lecture?.statut, root.etatRoute().champs.title, root.etatRoute().lectureAppliquee, root.etatRoute().propositionsRecues, ff.vers('openlibrary.org').length], [false, 'recue', '', null, 0, 0],
          'route démontée : état recue, aucun champ rempli, aucune requête Open Library sans écran pour la nommer (I-E4, I-E7 ; avant : la lecture appliquée à l’état mort et titre + auteur envoyés → rouge)');
      });

      {
        // #27 (ronde 1) : la ligne rouverte entre la transaction refusée et sa relecture (deux routes sur le même ?import=, tâche 5) — la fermeture est
        // rejouée UNE fois avec le livre, jamais un livre écrit seul à côté d'une ligne restée ouverte (une reprise en écrirait un second).
        const { TransitionRefusee } = await import('../src/core/db.js');
        let transitions = 0, lots = 0, n = 0;
        const faux = { newId: (p) => `${p}_r${(n += 1)}`, transitionner: async () => { transitions += 1; if (transitions === 1) throw new TransitionRefusee('imports', 'imp_r', 'en_cours'); }, get: async () => ({ id: 'imp_r', status: 'a_verifier' }), saveBatch: async () => { lots += 1; } };
        let ed = null;
        try { ed = await LA.enregistrerLivre({ champs: { title: 'Rouverte' }, isbn: '' }, { repo: faux, importId: 'imp_r', maintenant: () => NOW }); } catch (e) { ed = { erreur: String(e?.message || e) }; }
        eq([transitions, lots, typeof ed?.id], [2, 0, 'string'], 'enregistrerLivre : une ligne relue OUVERTE après un refus → la fermeture rejouée une fois avec le livre, aucun saveBatch du livre seul (ronde 1, #27)');
      }

      {
        // S14 : un titre lu hostile reste du TEXTE — placeholder, bouton « Utiliser « … » », mention de sous-titre, bandeau. Puis les filets statiques.
        const hostile = '<img src=x onerror="void 0">';
        const m = LA.livreAjoutModel({ pas: 2, champs: { title: '' }, provenance: 'couverture', lecture: { statut: 'lue', incertains: ['title'], placeholders: { title: hostile }, sousTitre: hostile, lecture: {} }, proposition: { statut: 'trouvee', fiche: { title: hostile, authors: [hostile], author: hostile, publisher: '', year: '', language: null, motsCles: [], isbn13: null, editionUnique: false } } });
        const n = LA.renderLivreAjout(m, {});
        eq([n.querySelectorAll('img').length, titreDe(n)?.getAttribute('placeholder'), role(n, 'utiliser-lu-title')?.textContent, role(n, 'sous-titre')?.textContent, bandeau(n)],
          [0, `Lu : ${hostile} ?`, `Utiliser « ${hostile} »`, `Sous-titre lu : ${hostile}`, `Proposé par Open Library : ${hostile}, ${hostile}`], 'S14 : un titre lu hostile ne crée aucun élément, il reste du texte partout');
        const repLA = await fetch('../src/ui/livre-ajout.js', { cache: 'no-store' });
        const srcLA = repLA.ok ? await repLA.text() : '';
        ok(repLA.ok && srcLA.length > 1000 && !/anthropic|supabase/i.test(srcLA), 'livre-ajout.js (lu : HTTP 2xx, plus de 1 000 caractères) ne nomme ni le fournisseur ni la base, en toute casse (R-E-28 ; test de source admis ; un 404 ou un corps vide est rouge)');
        const etatUi = await import('../src/ui/state.js');
        eq([etatUi.ROUTES_DE_SAISIE.includes('/add/livre'), etatUi.estRouteDeSaisie('/add/livre'), etatUi.estRouteDeSaisie('/add/signet')], [true, true, false], 'ROUTES_DE_SAISIE (D-E19) : /add/livre — une passe de synchro ne reconstruit pas le pas 1 en plein vol ; /add/signet reste dehors (dette nommée)');
      }

      // --- Reprise (§ 4.6) : #/add/livre?import=<imp>. Une ligne du journal dans l'état voulu, avec (ou sans) sa couverture dans files.
      const C = await import('../src/domain/couverture.js');
      const ligneDe = async (repo, db, over = {}, { octets = true } = {}) => {
        let sha = 'f'.repeat(64);
        if (octets) ({ sha256: sha } = await LA.poserCouverture(await F.imageDe('r.jpg', '#a33'), { origine: 'locale', repo }));
        const l = { ...C.fabriquerImportCouverture({ id: repo.newId('imp'), coverSha256: sha, deviceId: repo.deviceId() }), created_at: NOW, updated_at: NOW, ...over };
        await db.mutate({ puts: { imports: [l] }, origin: 'device' });
        return l;
      };

      await scenario('reprise ?import= sur a_verifier : pas 2 prérempli, sans appel à l’assistant (D-E5, D-E13)', async (repo, db) => {
        const l = await ligneDe(repo, db, { status: 'a_verifier', resultat: { ...F.LECTURE }, started_at: NOW });
        const ff = F.fauxFetch({ assistant: () => { throw new Error('aucun appel attendu'); }, ol: [200, F.OL_STASIO] });
        const { root, navs } = await monter(repo, { ff, query: { import: l.id } });
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'lecture reprise et rattrapage');
        eq([root.etatRoute().importId, root.etatRoute().pas, titreDe(root).value, root.querySelector('.status.info')?.textContent, ff.posts().length, ff.vers('openlibrary.org/search.json').length, !!root.querySelector('.zone-couverture img'), bandeau(root), ff.vers('covers.openlibrary.org').length],
          [l.id, 2, 'À la di Stasio', 'Lu sur la couverture — vérifie.', 0, 1, true, 'Proposé par Open Library : À la di Stasio, Josée Di Stasio, Flammarion Québec, 2004, ISBN 9782890772816', 0],
          'reprise : la lecture du journal, revalidée, remplit le pas 2 ; ZÉRO appel à l’assistant, UNE requête Open Library (hors quota, D-E13) ; aucune couverture distante (D-E18)');
        eq([root.etatRoute().couverture.touchee, root.etatRoute().couverture.message, root.querySelector('.zone-couverture')?.textContent.includes('Couverture enregistrée.')], [true, 'Couverture enregistrée.', true],
          'reprise, octets présents : la couverture est « touchée » et dit « Couverture enregistrée. » (§ 4.6 ; ronde 1 de T5 : mutants touchee faux, message nul → rouges)');
        const capture = db.onMutate;
        const lots = [];
        db.onMutate = (m) => { if (m.puts?.books) lots.push(Object.keys(m.puts).sort()); return capture ? capture(m) : null; };
        try { bouton(root, 'Ajouter ce livre').click(); await attendre(() => navs.length === 1, 'livre écrit'); } finally { db.onMutate = capture; }
        const [ed] = await db.getAll('book_editions');
        eq([lots, (await db.get('imports', l.id)).status, (await db.get('imports', l.id)).edition_id, ff.vers('covers.openlibrary.org').length], [[['book_editions', 'books', 'imports']], 'enregistre', ed.id, 0], '?import= puis « Ajouter ce livre » : une transaction, la ligne enregistre et pointe l’édition ; toujours aucune couverture distante (D-E18)');
      });

      await scenario('reprise : un résultat hostile est revalidé → echec(illisible) (I-E1)', async (repo, db) => {
        const l = await ligneDe(repo, db, { status: 'a_verifier', resultat: { ...F.LECTURE, title: 'x'.repeat(400) }, started_at: NOW });
        const { root } = await monter(repo, { ff: F.fauxFetch({ ol: [200, F.OL_STASIO] }), query: { import: l.id } });
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'revalidée');
        const lu = await db.get('imports', l.id);
        eq([lu.status, lu.erreur?.raison, lu.resultat, titreDe(root).value, role(root, 'lecture')?.textContent.includes('L’assistant n’a pas répondu lisiblement. Réessaie.'), role(root, 'relire')?.textContent],
          ['echec', 'illisible', null, '', true, 'Relire la couverture'], 'résultat hostile (titre de 400) : a_verifier → echec(illisible), résultat effacé, rien n’atteint les champs, « Relire » offert (mutant : revalidation retirée → rouge)');
      });

      await scenario('reprise : empreinte hostile ou octets absents → « La couverture n’est pas sur cet appareil. », « Lire » éteint', async (repo, db) => {
        const rejets = [];
        const surRejet = (e) => rejets.push(e);
        window.addEventListener('unhandledrejection', surRejet);
        try {
          const hostile = await ligneDe(repo, db, { cover_sha256: { x: 1 } }, { octets: false });
          const r1 = await monter(repo, { query: { import: hostile.id } });
          await attendre(() => r1.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
          await tick();
          eq([r1.root.textContent.includes('La couverture n’est pas sur cet appareil.'), role(r1.root, 'relire')?.disabled, rejets.length], [true, true, 0], 'cover_sha256 { x: 1 } : le message, « Lire » éteint, aucune exception (mutant : shaBornee retirée → getFile lève → rouge)');
          scene.replaceChildren();
          const absente = await ligneDe(repo, db, {}, { octets: false });
          const r2 = await monter(repo, { query: { import: absente.id } });
          await attendre(() => r2.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
          eq([r2.root.textContent.includes('La couverture n’est pas sur cet appareil.'), role(r2.root, 'relire')?.disabled, r2.root.etatRoute().couverture.sha256], [true, true, absente.cover_sha256], 'empreinte valide sans ligne files : le message, « Lire » éteint, l’empreinte gardée');
          // Ronde 1 de T5 : une relecture qui n'apprend rien (octets toujours absents) ne reconstruit pas le formulaire — la saisie et le focus survivent (R-UX-9 ;
          // les avis du vol, ecouterVol, relisent désormais aussi). Vague finale (constat 12, R-D-10) : la relecture est ATTENDUE (relecturesFaites), jamais
          // un nombre fixe d'allers-retours de la base.
          const titre2 = titreDe(r2.root);
          titre2.focus();
          const faites2 = r2.root.etatRoute().relecturesFaites;
          window.dispatchEvent(new Event('online'));
          await attendre(() => r2.root.etatRoute().relecturesFaites === faites2 + 1, 'la relecture du retour en ligne est faite');
          eq([titreDe(r2.root) === titre2, document.activeElement === titre2], [true, true], 'octets toujours absents : une relecture (online) ne reconstruit pas le pas 2 — même champ Titre, focus gardé (ronde 1 de T5 ; mutant : couverture réécrite à chaque relecture → rouge)');
          // Ronde 1 de T5 (constats 13 et 14) : une empreinte hostile qui EST une chaîne (majuscules) passe aussi par shaBornee ; et `touchee` (§ 4.6) ferme la
          // couverture distante après « ← Changer d’ISBN » puis « Identifier » (D-E18).
          scene.replaceChildren();
          const majuscules = await ligneDe(repo, db, { cover_sha256: 'F'.repeat(64) }, { octets: false });
          const ff3 = F.fauxFetch({ ol: [200, F.OL_STASIO] });
          const r3 = await monter(repo, { ff: ff3, query: { import: majuscules.id } });
          await attendre(() => r3.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
          const couv = r3.root.etatRoute().couverture;
          bouton(r3.root, '← Changer d’ISBN').click();
          taper(r3.root.querySelector('input[name="isbn"]'), '9782890772816');
          bouton(r3.root, 'Identifier').click();
          await attendre(() => r3.root.etatRoute().reponsesRecues === 1 && !r3.root.etatRoute().recherche, 'fiche d’ISBN reçue');
          await tick();
          eq([couv.sha256, couv.touchee, r3.root.etatRoute().pas, ff3.vers('covers.openlibrary.org').length], [null, true, 2, 0],
            'cover_sha256 « F… » (chaîne hors forme) : revalidée, empreinte nulle (mutant : typeof seul → rouge) ; touchee posé : « Identifier » ne demande aucune couverture distante (D-E18 ; mutant : touchee faux → rouge)');
          // Ronde 1 de T5 (constat 23) : des octets qui ne sont pas une IMAGE de la liste blanche (un blob text/html sous l'empreinte) valent des octets absents —
          // ni aperçu, ni « Couverture enregistrée. », « Lire » éteint.
          scene.replaceChildren();
          const sha = 'a'.repeat(64);
          await db.mutate({ puts: { files: [{ sha256: sha, blob: new Blob(['<p>x</p>'], { type: 'text/html' }), mime: 'text/html', size: 8, created_at: NOW }] }, origin: 'device' });
          const pasImage = await ligneDe(repo, db, { cover_sha256: sha }, { octets: false });
          const r4 = await monter(repo, { query: { import: pasImage.id } });
          await attendre(() => r4.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
          eq([!!r4.root.querySelector('.zone-couverture img'), r4.root.textContent.includes('Couverture enregistrée.'), r4.root.textContent.includes('La couverture n’est pas sur cet appareil.'), role(r4.root, 'relire')?.disabled],
            [false, false, true, true], 'octets hors liste blanche (text/html) sous l’empreinte : traités comme absents — aucun aperçu, aucun « Couverture enregistrée. », « Lire » éteint (ronde 1 de T5)');
        } finally { window.removeEventListener('unhandledrejection', surRejet); }
      });

      await scenario('reprise : echec(quota), a_lancer puis « Lire la couverture », en_cours d’un autre document', async (repo, db) => {
        const q = await ligneDe(repo, db, { status: 'echec', erreur: { raison: 'quota', extra: { quota: 60 } } });
        const r1 = await monter(repo, { query: { import: q.id } });
        await attendre(() => r1.root.etatRoute().lecture?.statut === 'echec', 'relue');
        eq([r1.root.etatRoute().pas, role(r1.root, 'lecture')?.textContent.includes('Tu as atteint la limite du jour pour l’assistant (60 appels).'), role(r1.root, 'relire')?.textContent, role(r1.root, 'relire')?.disabled], [2, true, 'Relire la couverture', false], 'echec(quota) : pas 2, le refus en clair avec son nombre, « Relire la couverture »');
        scene.replaceChildren();
        const a = await ligneDe(repo, db);
        const ff = F.fauxFetch({ assistant: null });
        const r2 = await monter(repo, { ff, query: { import: a.id } });
        await attendre(() => r2.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        eq([r2.root.etatRoute().pas, role(r2.root, 'lecture')?.textContent.includes('La couverture n’a pas encore été lue.'), role(r2.root, 'relire')?.textContent, role(r2.root, 'relire')?.disabled], [2, true, 'Lire la couverture', false], 'a_lancer : « La couverture n’a pas encore été lue. » + « Lire la couverture »');
        const n = await db.count('imports');
        role(r2.root, 'relire').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        eq([role(r2.root, 'lecture')?.textContent.includes('Lecture de la couverture par l’assistant…'), !!role(r2.root, 'annuler-lecture'), (await db.get('imports', a.id)).status, await db.count('imports')], [true, true, 'en_cours', n], '« Lire la couverture » sur une ligne a_lancer : en_cours rendu AVANT l’appel, sur la MÊME ligne (N2-b)');
        role(r2.root, 'annuler-lecture').click();
        await attendre(async () => (await db.get('imports', a.id)).erreur?.raison === 'annule', 'annulée');
        scene.replaceChildren();
        // battement_at = NOW : VIVANT à l'horloge de la route (`maintenant` injecté), que la passe `interrompu` de la route lit (ronde 1 de T5, comme les écrans du
        // lot A) — pas à l'horloge réelle, qui la dirait vieille de plusieurs jours.
        const v = await ligneDe(repo, db, { status: 'en_cours', document_id_vol: 'autre-document', battement_at: NOW });
        const r3 = await monter(repo, { query: { import: v.id } });
        await attendre(() => r3.root.etatRoute().lecture?.statut === 'en_cours', 'relue');
        eq([role(r3.root, 'lecture')?.textContent, role(r3.root, 'annuler-lecture')], ['En cours sur un autre écran', null], 'en_cours d’un autre document : « En cours sur un autre écran », sans « Annuler » (I-7)');
      });

      // Ronde 1 de T5 (constats 5, 17, 26 ; sonde SONDE-2) : une ligne en vol sur un AUTRE document n'est plus figée tant que la route est montée — la passe
      // `interrompu` est rejouée à l'affichage puis par la veille (VF-15 du lot A, transposé), et chaque passe relit la ligne.
      await scenario('reprise : en vol ailleurs, la veille relit la ligne — finie ailleurs, elle est appliquée ; document mort, elle est interrompue', async (repo, db) => {
        const v = await ligneDe(repo, db, { status: 'en_cours', document_id_vol: 'autre-document', battement_at: NOW, started_at: NOW });
        // Un espion compte les passes : la ligne ne finit « ailleurs » qu'APRÈS la deuxième (celle de la veille) — la passe de l'affichage ne peut donc pas
        // l'avoir vue, et c'est bien la veille qui la relit (mutant : veille retirée → une seule passe → rouge).
        const passes = [];
        const espion = { ...repo, marquerInterrompus: (...a) => { const p = repo.marquerInterrompus(...a); passes.push(p); return p; } };
        const r1 = await monter(espion, { query: { import: v.id }, veilleMs: 40 });
        await attendre(() => r1.root.etatRoute().lecture?.statut === 'en_cours', 'relue en vol ailleurs');
        await attendre(() => passes.length >= 2, 'la veille a rejoué la passe `interrompu`');
        await Promise.all(passes);
        const bloque = [role(r1.root, 'lecture')?.textContent, bouton(r1.root, 'Ajouter ce livre')?.disabled, (await db.get('imports', v.id)).status];
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', v.id)), status: 'a_verifier', resultat: { ...F.LECTURE }, document_id_vol: null }] }, origin: 'device' }); // l'autre onglet a fini
        await attendre(() => lue(r1.root), 'lecture finie ailleurs, vue par la veille');
        eq([bloque, titreDe(r1.root).value, bouton(r1.root, 'Ajouter ce livre')?.disabled, (await db.get('imports', v.id)).status], [['En cours sur un autre écran', true, 'en_cours'], 'À la di Stasio', false, 'a_verifier'],
          'en vol ailleurs puis fini ailleurs : la veille relit la ligne et applique la lecture, « Ajouter ce livre » rallumé (mutant : veille retirée → figé → rouge)');
        scene.replaceChildren();
        const mort = await ligneDe(repo, db, { status: 'en_cours', document_id_vol: 'document-mort', battement_at: '2026-10-19T11:57:00.000Z', started_at: '2026-10-19T11:57:00.000Z' });
        const r2 = await monter(repo, { query: { import: mort.id } });
        await attendre(() => r2.root.etatRoute().lecture?.statut === 'echec', 'interrompue à l’affichage');
        eq([(await db.get('imports', mort.id)).erreur?.raison, role(r2.root, 'lecture')?.textContent.includes('La lecture a été interrompue.'), role(r2.root, 'relire')?.textContent, role(r2.root, 'enregistrer-bloque')?.hidden], ['interrompu', true, 'Relire la couverture', true],
          'en vol sur un document MORT (battement de 3 min) : la passe `interrompu` est rejouée à l’affichage — echec(interrompu), « Relire la couverture », la phrase D-E9 levée (mutant : passe retirée → rouge)');
      });

      // Ronde 1 de T5 (constats 1, 4, 7 ; sonde P1) : une route REMONTÉE pendant le vol de sa ligne tenu par CE document (« Lire la couverture », « ← Ajouter »,
      // puis le retour du navigateur) suit ce vol (ecouterVol) : à sa fin, elle relit la ligne — jamais figée sur « Lecture… » avec un « Annuler » qui appliquerait.
      await scenario('reprise : une route remontée pendant le vol de CE document voit la fin du vol (ecouterVol)', async (repo, db) => {
        const a = await ligneDe(repo, db);
        const ff = F.fauxFetch({ assistant: null });
        const r1 = await monter(repo, { ff, query: { import: a.id } });
        await attendre(() => r1.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        role(r1.root, 'relire').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        scene.replaceChildren(); // la route qui vole quitte le document (retour arrière)
        const r2 = await monter(repo, { ff, query: { import: a.id } });
        await attendre(() => r2.root.etatRoute().lecture?.statut === 'en_cours', 'relue en vol');
        const pendant = [role(r2.root, 'lecture')?.textContent.includes('Lecture de la couverture par l’assistant…'), !!role(r2.root, 'annuler-lecture')];
        ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
        await attendre(() => lue(r2.root), 'fin du vol vue par la route remontée');
        eq([pendant, (await db.get('imports', a.id)).status, titreDe(r2.root).value, role(r2.root, 'annuler-lecture'), bouton(r2.root, 'Ajouter ce livre')?.disabled], [[true, true], 'a_verifier', 'À la di Stasio', null, false],
          'route remontée pendant le vol de CE document : statut et « Annuler » pendant le vol, puis la lecture appliquée à sa fin, « Annuler » retiré, « Ajouter ce livre » rallumé (mutant : écoute retirée → figée → rouge)');
      });

      // Ronde 1 de T5 : la route qui VOLE ignore les avis de son propre vol jusqu'à sa fin — pendant les gardes (session relue, photo réduite), l'écran reste
      // « Lecture de la couverture… » avec « Annuler » (N2-b : en_cours rendu AVANT l'appel), jamais la ligne encore a_lancer relue. Vague finale (constats 4
      // et 12) : un `online` reçu pendant les gardes est ignoré lui aussi, et le scénario COMPTE les relectures (relecturesFaites, R-D-10) — la seule
      // attendue est celle de la fin du vol ; une relecture d'un avis ou d'un `online` en ajouterait au moins une, quelle que soit la charge de la machine.
      await scenario('reprise : pendant les gardes de son propre vol, la route reste « Lecture… » (N2-b ; avis du vol et online ignorés par la route qui vole)', async (repo, db) => {
        let jetons = 0, liberer = null;
        const ctx = F.ctxDe(F.SESSION, { jeton: () => ((jetons += 1) === 1 ? Promise.resolve(F.SESSION) : new Promise((r) => { liberer = () => r(F.SESSION); })) });
        const a = await ligneDe(repo, db);
        const { root } = await monter(repo, { ctx, query: { import: a.id } });
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        const faites = root.etatRoute().relecturesFaites;
        role(root, 'relire').click();
        await attendre(() => typeof liberer === 'function', 'session relue par le vol (gardes)');
        window.dispatchEvent(new Event('online'));
        await tick();
        const pendant = [root.etatRoute().lecture?.statut, !!role(root, 'annuler-lecture'), (await db.get('imports', a.id)).status];
        liberer();
        await attendre(() => lue(root), 'lecture appliquée');
        eq([pendant, root.etatRoute().relecturesFaites - faites], [['en_cours', true, 'a_lancer'], 1], 'pendant les gardes du vol (ligne encore a_lancer) : l’écran reste « Lecture… » avec « Annuler », et la SEULE relecture est celle de la fin du vol (mutants : la route relit à chaque avis de son propre vol, ou sur un `online` pendant les gardes → une relecture de plus → rouge)');
      });

      // Ronde 1 de T5 (constats 2, 6, 8 ; sondes P2, SONDE-3) : une couverture d'un AUTRE appareil relancée ici devient celle de CET appareil (device_id réécrit au
      // départ du vol, comme le classement du lot D et R-B-8 pour le web) — son appareil d'origine ne la juge plus à 90 s sur un battement qu'il ne voit pas.
      await scenario('reprise : une couverture d’un autre appareil relancée ici prend le device_id d’ici', async (repo, db) => {
        const a = await ligneDe(repo, db, { device_id: 'appareil-B' });
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(repo, { ff, query: { import: a.id } });
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        role(root, 'relire').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        const enVol = await db.get('imports', a.id);
        eq([enVol.status, enVol.device_id === repo.deviceId(), enVol.document_id_vol === UI.DOCUMENT_ID], ['en_cours', true, true], 'couverture d’un autre appareil relancée ici : en vol, son device_id est celui de CET appareil (mutant : `ici` du classement seul → rouge)');
        role(root, 'annuler-lecture').click();
        await attendre(async () => (await db.get('imports', a.id)).erreur?.raison === 'annule', 'annulée');
      });

      // Ronde 1 de T5 (constat 16 ; sonde P4) : des octets arrivés APRÈS la reprise (L4) — la relecture suivante rend l'aperçu et « Couverture enregistrée. »,
      // jamais « Lire » rallumé sous une phrase qui dit la couverture absente.
      await scenario('reprise : des octets arrivés après la reprise rendent l’aperçu et « Couverture enregistrée. »', async (repo, db) => {
        const { sha256 } = await LA.poserCouverture(await F.imageDe('l4.jpg', '#3a3'), { origine: 'locale', repo });
        const fichier = await db.get('files', sha256);
        await db.mutate({ deletes: { files: [sha256] }, origin: 'device' });
        const a = await ligneDe(repo, db, { cover_sha256: sha256 }, { octets: false });
        const { root } = await monter(repo, { query: { import: a.id } });
        await attendre(() => root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        const avant = [role(root, 'relire')?.disabled, !!root.querySelector('.zone-couverture img'), root.textContent.includes('La couverture n’est pas sur cet appareil.')];
        await db.mutate({ puts: { files: [fichier] }, origin: 'device' });
        window.dispatchEvent(new Event('online'));
        await attendre(() => role(root, 'relire')?.disabled === false, 'octets relus');
        await tick();
        eq([avant, !!root.querySelector('.zone-couverture img'), root.textContent.includes('Couverture enregistrée.'), root.textContent.includes('La couverture n’est pas sur cet appareil.')], [[true, false, true], true, true, false],
          'octets arrivés après la reprise : « Lire » rallumé AVEC l’aperçu et « Couverture enregistrée. », la phrase d’absence retirée (ronde 1 de T5)');
      });

      await scenario('reprise : import terminé, d’une autre sorte, ou inconnu → toast, pas 1', async (repo, db) => {
        const fini = await ligneDe(repo, db, { status: 'enregistre' });
        const r1 = await monter(repo, { query: { import: fini.id } });
        const ignoree = await ligneDe(repo, db, { status: 'ignore' });
        const r1b = await monter(repo, { query: { import: ignoree.id } });
        eq([r1.dits, r1.root.etatRoute().pas, r1.root.etatRoute().importId, r1b.dits, r1b.root.etatRoute().pas, r1b.root.etatRoute().importId], [['Cet import est terminé.'], 1, null, ['Cet import est terminé.'], 1, null],
          'enregistre OU ignore (§ 4.5, IMPORTS_TERMINES) : « Cet import est terminé. », pas 1 ordinaire (ronde 1 de T5 : mutant « enregistre seul » → rouge)');
        const recette = (await repo.ajouterPages([await F.imageDe('p.jpg', '#777')], { import: { id: repo.newId('imp'), kind: 'recette', recipe_id: 'rc_d5' } })).importId;
        const r2 = await monter(repo, { query: { import: recette } });
        const r3 = await monter(repo, { query: { import: 'imp_inconnu' } });
        eq([r2.dits, r3.dits, r2.root.etatRoute().pas, r3.root.etatRoute().importId], [['Import introuvable.'], ['Import introuvable.'], 1, null], 'kind recette ou identifiant inconnu : « Import introuvable. », pas 1 ordinaire');
      });

      await scenario('deux routes sur le même ?import= : UN livre (I-E5, S-3 ; Review Focus 4)', async (repo, db) => {
        const l = await ligneDe(repo, db, { status: 'a_verifier', resultat: { ...F.LECTURE }, started_at: NOW });
        const r1 = await monter(repo, { query: { import: l.id } });
        const r2 = await monter(repo, { query: { import: l.id } });
        await attendre(() => lue(r1.root) && lue(r2.root), 'deux lectures reprises');
        bouton(r1.root, 'Ajouter ce livre').click();
        await attendre(() => r1.navs.length === 1, 'premier livre');
        bouton(r2.root, 'Ajouter ce livre').click();
        await attendre(() => r2.navs.length === 1, 'second geste');
        const [ed] = await db.getAll('book_editions');
        eq([await db.count('books'), r2.dits.at(-1), r2.navs[0], r1.navs[0]], [1, 'Ce livre a déjà été ajouté.', `/books/${ed.id}`, `/books/${ed.id}?nouveau=1`], 'deux « Ajouter ce livre » sur le même import : UN livre ; le second dit « Ce livre a déjà été ajouté. » et ouvre la fiche sans ?nouveau (mutant : saveBatch sur enregistre → deux livres → rouge)');
      });

      // Ronde 1 de la tâche 4 (MD, laissé à la tâche 5) : le bloc lecture d'une reprise existe AVANT que la session soit résolue (D-E8) — à la résolution, il est
      // remplacé SEUL : « Relire la couverture » s'allume, le formulaire du pas 2 n'est pas reconstruit (R-UX-9).
      await scenario('reprise : la session résolue APRÈS le montage rallume « Relire la couverture », sans reconstruire le pas 2 (D-E8)', async (repo, db) => {
        let liberer = null;
        const q = await ligneDe(repo, db, { status: 'echec', erreur: { raison: 'quota', extra: { quota: 60 } } });
        // Ronde 1 de T5 (constat 27) : la borne de sessionAssistant est portée à 60 s ici — sur une machine chargée, plus de 2 s entre le montage et liberer()
        // rendait la session nulle (un rouge de bruit) ; le scénario attend un FAIT, la résolution qu'il provoque lui-même.
        const { root } = await monter(repo, { ctx: F.ctxDe(F.SESSION, { jeton: () => new Promise((r) => { liberer = () => r(F.SESSION); }) }), query: { import: q.id }, attendreSession: false, delaiSessionMs: 60000 });
        await attendre(() => root.etatRoute().lecture?.statut === 'echec' && typeof liberer === 'function', 'relue, jeton demandé');
        const titre = titreDe(root);
        eq([root.etatRoute().session, role(root, 'relire')?.textContent, role(root, 'relire')?.disabled], ['verification', 'Relire la couverture', true], 'reprise, session en cours de lecture : « Relire la couverture » rendu éteint (D-E8)');
        liberer();
        await attendre(() => root.etatRoute().session === 'prete', 'session résolue');
        eq([role(root, 'relire')?.disabled, titreDe(root) === titre], [false, true], 'reprise, session résolue après le montage : « Relire la couverture » s’allume, le champ Titre reste le même nœud (mutant : majBlocLecture retiré de la résolution → rouge)');
      });

      // Ronde 1 de la tâche 4 (MP, laissé à la tâche 5) : la ligne disparaît entre la lecture du montage et celle de relire() (purge, tombale reçue) — l'écran ne la
      // dit plus, rien ne lève, la couverture reste, et « Ajouter ce livre » écrit le livre seul (le journal n'est plus à nous, § 4.4).
      await scenario('reprise : la ligne disparue avant la relecture → plus d’import, rien ne lève, le livre s’écrit seul', async (repo, db) => {
        const l = await ligneDe(repo, db, { status: 'a_verifier', resultat: { ...F.LECTURE }, started_at: NOW });
        let lectures = 0;
        const espion = { ...repo, get: async (store, cle) => { const v = await repo.get(store, cle); if (store === 'imports' && cle === l.id && (lectures += 1) === 1) await db.mutate({ deletes: { imports: [l.id] }, origin: 'device' }); return v; } };
        const { root, navs } = await monter(espion, { query: { import: l.id } });
        eq([lectures, root.etatRoute().importId, root.etatRoute().lecture, root.etatRoute().pas, !!root.querySelector('.zone-couverture img'), role(root, 'lecture')], [2, null, null, 2, true, null],
          'ligne disparue avant la relecture : importId nul, aucun bloc lecture, la couverture de la reprise reste (mutant : branche « ligne absente » retirée → relire lève, importId gardé → rouge)');
        taper(titreDe(root), 'Seul');
        bouton(root, 'Ajouter ce livre').click();
        await attendre(() => navs.length === 1, 'livre écrit');
        eq([await db.count('books'), await db.count('imports'), (await db.getAll('book_editions'))[0]?.cover_sha256 === l.cover_sha256], [1, 0, true], 'ligne disparue : « Ajouter ce livre » écrit le livre seul, avec la couverture de la reprise ; aucune ligne d’import recréée');
      });

      // --- Vague finale du lot E (revue finale de branche) : chaque scénario a été vu ROUGE sur le src/ d'avant la vague (rapport final-fix-report.md).
      // Constat 1 : sans ISBN (œuvre à plusieurs éditions), « Utiliser ces renseignements » puis « ← Changer d’ISBN » et « Saisir à la main » — aucun ISBN avant
      // comme après : les champs repris et leur étiquette restent (§ 4.3.5). Une couverture en capitales rend le titre de la fiche différent du titre lu.
      await scenario('vague finale : sans ISBN, « Utiliser ces renseignements », « ← Changer d’ISBN » puis « Saisir à la main » gardent les champs repris et leur étiquette (§ 4.3.5)', async (repo) => {
        const capitales = { title: 'JERUSALEM', subtitle: null, authors: ['YOTAM OTTOLENGHI'], publisher: null, language: 'en', uncertain: [] };
        const ff = F.fauxFetch({ assistant: [200, F.corpsOk(capitales)], ol: [200, F.OL_JERUSALEM] });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('jc.jpg', '#3a3')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
        bouton(root, 'Utiliser ces renseignements').click();
        const apres = [titreDe(root).value, champ(root, 'Auteur / chef').value, root.querySelector('.status.info')?.textContent, root.etatRoute().isbn];
        bouton(root, '← Changer d’ISBN').click();
        bouton(root, 'Saisir à la main').click();
        eq([apres, root.etatRoute().pas, titreDe(root).value, champ(root, 'Auteur / chef').value, root.querySelector('.status.info')?.textContent],
          [['Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', 'Renseigné par Open Library — vérifie et corrige.', ''], 2, 'Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', 'Renseigné par Open Library — vérifie et corrige.'],
          'sans ISBN avant comme après : « Saisir à la main » garde le titre et l’auteur repris d’Open Library ET leur étiquette (vague finale, constat 1 ; avant : champs vidés, étiquette tombée)');
      });

      // Constats 2 et 5 : une lecture APPLIQUÉE n'est rendue qu'à une fiche d'ISBN TROUVÉE (option 1 du constat 7 de la tâche 4, appliquée à la branche
      // `trouve` seule) — un ISBN introuvable ou une panne d'Open Library laissent les champs lus, la lecture `lue` et « Lu sur la couverture — vérifie. » ;
      // « ← Changer d’ISBN » puis « Saisir à la main » garde l'étiquette de la lecture qui est encore à l'écran (I-B), avec ses mentions.
      await scenario('vague finale : une lecture appliquée survit à « Saisir à la main », à un ISBN introuvable et à une panne d’Open Library (I-B, C3)', async (repo) => {
        let panne = false;
        const rien = { numFound: 0, docs: [] };
        const ff = F.fauxFetch({ assistant: [200, F.corpsOk({ ...F.LECTURE, uncertain: ['publisher'] })], ol: (a) => (new URL(a.url).searchParams.has('isbn') && panne ? [503, ''] : [200, rien]) });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('ki.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'lecture appliquée, rattrapage fini');
        const vu = () => [root.etatRoute().pas, titreDe(root)?.value, champ(root, 'Auteur / chef')?.value, root.etatRoute().lecture?.statut, root.querySelector('.status.info')?.textContent ?? null, !!role(root, 'incertain-publisher')];
        bouton(root, '← Changer d’ISBN').click();
        bouton(root, 'Saisir à la main').click();
        eq(vu(), [2, 'À la di Stasio', 'Josée Di Stasio', 'lue', 'Lu sur la couverture — vérifie.', true], '« ← Changer d’ISBN » puis « Saisir à la main » après une lecture : champs lus, mention de l’éditeur incertain ET « Lu sur la couverture — vérifie. » (vague finale, constat 5 ; avant : étiquette tombée)');
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && !root.etatRoute().recherche, 'ISBN introuvable');
        eq([...vu(), rappel(root)], [2, 'À la di Stasio', 'Josée Di Stasio', 'lue', 'Lu sur la couverture — vérifie.', true, 'ISBN 9780306406157'], 'ISBN introuvable après une lecture : la lecture reste appliquée, ses champs et son étiquette aussi, l’ISBN tapé est rappelé (vague finale, constat 2 ; avant : champs vidés, lecture « recue »)');
        bouton(root, '← Changer d’ISBN').click();
        panne = true;
        taper(root.querySelector('input[name="isbn"]'), '9782890772816');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 2 && !root.etatRoute().recherche, 'Open Library en panne');
        const enPanne = [root.etatRoute().pas, !!role(root, 'indisponible'), root.etatRoute().lecture?.statut];
        bouton(root, 'Saisir à la main').click();
        eq([enPanne, ...vu()], [[1, true, 'lue'], 2, 'À la di Stasio', 'Josée Di Stasio', 'lue', 'Lu sur la couverture — vérifie.', true], 'Open Library en panne après une lecture : le pas 1 dit la panne, la lecture reste ; « Saisir à la main » rend ses champs et son étiquette (vague finale, constats 2 et 5 ; avant : champs vides)');
      });

      // Constat 6 : une lecture a_verifier DÉJÀ appliquée (reprise) dont les octets arrivent après (L4) — la relecture suivante rend l'aperçu dans la zone
      // Couverture seule, sans reconstruire le formulaire (le constat 16 de T5 n'éprouvait que a_lancer).
      await scenario('vague finale : reprise d’une lecture a_verifier, des octets arrivés après rendent l’aperçu, saisie et focus gardés', async (repo, db) => {
        const { sha256 } = await LA.poserCouverture(await F.imageDe('av.jpg', '#33a'), { origine: 'locale', repo });
        const fichier = await db.get('files', sha256);
        await db.mutate({ deletes: { files: [sha256] }, origin: 'device' });
        const l = await ligneDe(repo, db, { cover_sha256: sha256, status: 'a_verifier', resultat: { ...F.LECTURE }, started_at: NOW }, { octets: false });
        const { root } = await monter(repo, { query: { import: l.id } });
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'lecture reprise');
        const zoneTexte = () => root.querySelector('.zone-couverture')?.textContent ?? '';
        const avant = [!!root.querySelector('.zone-couverture img'), zoneTexte().includes('La couverture n’est pas sur cet appareil.')];
        const titre = titreDe(root);
        titre.focus();
        const faites = root.etatRoute().relecturesFaites;
        await db.mutate({ puts: { files: [fichier] }, origin: 'device' });
        window.dispatchEvent(new Event('online'));
        await attendre(() => root.etatRoute().relecturesFaites === faites + 1, 'relecture du retour en ligne faite');
        eq([avant, !!root.querySelector('.zone-couverture img'), zoneTexte().includes('Couverture enregistrée.'), root.textContent.includes('La couverture n’est pas sur cet appareil.'), titreDe(root) === titre, document.activeElement === titre, titre.value],
          [[false, true], true, true, false, true, true, 'À la di Stasio'], 'a_verifier appliquée, octets arrivés après la reprise : l’aperçu et « Couverture enregistrée. » rendus dans la zone seule, la phrase d’absence retirée, le champ Titre (nœud, focus) intact (vague finale, constat 6)');
        // L'autre branche (lecture REÇUE après un geste, `recue`) : une ligne en vol sur un autre document, reprise sans ses octets ; « ← Changer d’ISBN » puis
        // « Saisir à la main » (un geste) ; l'autre onglet finit (a_verifier) et les octets arrivent — la relecture du retour en ligne garde la lecture au
        // journal (`recue`) ET rend l'aperçu dans la zone seule.
        scene.replaceChildren();
        const { sha256: sha2 } = await LA.poserCouverture(await F.imageDe('av2.jpg', '#a3a'), { origine: 'locale', repo });
        const fichier2 = await db.get('files', sha2);
        await db.mutate({ deletes: { files: [sha2] }, origin: 'device' });
        const v = await ligneDe(repo, db, { cover_sha256: sha2, status: 'en_cours', document_id_vol: 'autre-document', battement_at: NOW, started_at: NOW }, { octets: false });
        const r2 = await monter(repo, { query: { import: v.id } });
        await attendre(() => r2.root.etatRoute().lecture?.statut === 'en_cours' && r2.root.etatRoute().relecturesFaites === 2, 'relue en vol ailleurs, et la relecture de la passe `interrompu` de l’affichage faite');
        bouton(r2.root, '← Changer d’ISBN').click();
        bouton(r2.root, 'Saisir à la main').click();
        const titre2 = titreDe(r2.root);
        titre2.focus(); taper(titre2, 'Le mien');
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', v.id)), status: 'a_verifier', resultat: { ...F.LECTURE }, document_id_vol: null }], files: [fichier2] }, origin: 'device' });
        const faites2 = r2.root.etatRoute().relecturesFaites;
        window.dispatchEvent(new Event('online'));
        await attendre(() => r2.root.etatRoute().relecturesFaites === faites2 + 1, 'relecture du retour en ligne faite');
        eq([r2.root.etatRoute().lecture?.statut, !!r2.root.querySelector('.zone-couverture img'), (r2.root.querySelector('.zone-couverture')?.textContent ?? '').includes('Couverture enregistrée.'), titreDe(r2.root) === titre2, document.activeElement === titre2, titre2.value],
          ['recue', true, true, true, true, 'Le mien'], 'lecture reçue après un geste (recue), octets arrivés : l’aperçu rendu dans la zone seule, la saisie (nœud, valeur, focus) intacte (vague finale, constat 6, seconde branche)');
      });

      // Constat 7 : un geste sur la SEULE zone Couverture du pas 2 (« Retirer », « Choisir une image ») pendant « Relire » ne change pas de livre — la lecture
      // payée qui arrive reste celle de l'écran et est appliquée (I-E4 ne vise que les gestes qui changent le livre) ; la couverture de l'édition suit le geste.
      await scenario('vague finale : « Retirer » ou « Choisir une image » de la zone Couverture pendant « Relire » ne détachent pas la lecture payée (I-E4, § 4.3.3)', async (repo, db) => {
        for (const geste of ['Retirer', 'Choisir une image']) {
          scene.replaceChildren();
          const q = await ligneDe(repo, db, { status: 'echec', erreur: { raison: 'quota', extra: { quota: 60 } } });
          const ff = F.fauxFetch({ assistant: null });
          const { root } = await monter(repo, { ff, query: { import: q.id }, pick: async () => [await F.imageDe('zc.jpg', '#3aa')] });
          await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'relue');
          const sha = root.etatRoute().couverture.sha256;
          const faites = root.etatRoute().relecturesFaites;
          role(root, 'relire').click();
          await attendre(() => ff.posts().length === 1, 'vol parti');
          bouton(root, geste).click();
          if (geste !== 'Retirer') await attendre(() => root.etatRoute().couverture.sha256 && root.etatRoute().couverture.sha256 !== sha && !root.etatRoute().couverture.enCours, 'nouvelle image posée dans la zone');
          ff.rendre.shift()(200, F.corpsOk(F.LECTURE));
          await attendre(() => root.etatRoute().lecturesRecues === 1 && root.etatRoute().relecturesFaites === faites + 1, 'lecture reçue et relue');
          const couv = root.etatRoute().couverture.sha256;
          eq([root.etatRoute().lecture?.statut, titreDe(root).value, root.querySelector('.status.info')?.textContent, (await db.get('imports', q.id)).status, (await db.get('imports', q.id)).cover_sha256 === sha, geste === 'Retirer' ? couv === null : (couv !== null && couv !== sha)],
            ['lue', 'À la di Stasio', 'Lu sur la couverture — vérifie.', 'a_verifier', true, true], `« ${geste} » dans la zone Couverture pendant « Relire » : la lecture payée est appliquée, la ligne garde sa photo, l’édition suit le geste (vague finale, constat 7 ; avant : lecture « recue », rien à l’écran)`);
        }
      });

      // Constat 8 : la préparation d'une photo qui finit APRÈS « Saisir à la main » (et la saisie du titre) ne reconstruit pas le pas 2 — les blocs seuls sont
      // rendus (lecture, zone Couverture, « Ajouter ce livre ») ; un refus de la préparation, de même (I-E4 : « les champs tapés et le focus restent »).
      await scenario('vague finale : la préparation finie après « Saisir à la main » rend les blocs seuls — saisie et focus gardés (I-E4, R-UX-9)', async (repo, db) => {
        const ff = F.fauxFetch({ assistant: null });
        let libererPut = null;
        const espion = { ...repo, saveBatch: (...a) => a[1]?.fichiers?.length ? new Promise((r) => { libererPut = () => r(repo.saveBatch(...a)); }) : repo.saveBatch(...a) };
        const { root } = await monter(espion, { ff, pick: async () => [await F.imageDe('fp.jpg', '#a3a')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().lecture?.statut === 'preparation' && typeof libererPut === 'function', 'préparation');
        bouton(root, 'Saisir à la main').click();
        const titre = titreDe(root);
        titre.focus(); taper(titre, 'Mon li');
        libererPut();
        await attendre(() => ff.posts().length === 1, 'le vol est parti après la préparation');
        eq([titreDe(root) === titre, titre.value, document.activeElement === titre, role(root, 'lecture')?.textContent.includes('Lecture de la couverture par l’assistant…'), !!role(root, 'annuler-lecture'), !!root.querySelector('.zone-couverture img'), bouton(root, 'Ajouter ce livre')?.disabled, role(root, 'enregistrer-bloque')?.hidden],
          [true, 'Mon li', true, true, true, true, true, false], 'préparation finie après « Saisir à la main » : le champ Titre (nœud, valeur, focus) survit ; le bloc lecture et « Annuler », l’aperçu et la phrase D-E9 sont rendus (vague finale, constat 8 ; avant : dessiner() → focus perdu)');
        const [ligne] = await db.getAll('imports');
        role(root, 'annuler-lecture').click();
        await attendre(async () => (await db.get('imports', ligne.id)).erreur?.raison === 'annule' && !UI.volEnCours(), 'annulée, vol libéré');
        scene.replaceChildren();
        const vraiErreur = console.error;
        console.error = () => {};
        try {
          let rejeter = null;
          const e2 = { ...repo, saveBatch: () => new Promise((_, rej) => { rejeter = () => rej(new Error('QuotaExceededError')); }) };
          const b = await monter(e2, { pick: async () => [await F.imageDe('fq.jpg', '#aa3')] });
          role(b.root, 'choisir-couverture').click();
          await attendre(() => b.root.etatRoute().lecture?.statut === 'preparation' && typeof rejeter === 'function', 'préparation (refus à venir)');
          bouton(b.root, 'Saisir à la main').click();
          const t2 = titreDe(b.root);
          t2.focus(); taper(t2, 'Mon li');
          rejeter();
          await attendre(() => b.root.etatRoute().lecture?.statut === 'refus_image', 'refus de la préparation');
          eq([titreDe(b.root) === t2, t2.value, document.activeElement === t2, bouton(b.root, 'Ajouter ce livre')?.disabled, role(b.root, 'enregistrer-bloque')?.hidden], [true, 'Mon li', true, false, true],
            'refus de la préparation après « Saisir à la main » : le champ Titre (nœud, valeur, focus) survit, « Ajouter ce livre » se rallume, la phrase D-E9 se cache (vague finale, constat 8)');
        } finally { console.error = vraiErreur; }
      });

      // Constat 11 (faux-verts T5q, P1, P2) : le message d'un vol REFUSÉ est lu dans le bloc lecture lui-même, jamais dans root.textContent (que la zone
      // Couverture peut remplir de la même phrase) — des octets typés image mais non décodables (refus `image`), des octets disparus au moment du vol
      // (refus `octets_absents`) ; aucun POST, la ligne reste a_lancer.
      await scenario('vague finale : le message d’un vol refusé (image, octets_absents) est celui du bloc lecture (§ 4.2, pas 5)', async (repo, db) => {
        const shaC = 'c'.repeat(64);
        await db.mutate({ puts: { files: [{ sha256: shaC, blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02, 0x03])], { type: 'image/jpeg' }), mime: 'image/jpeg', size: 8, created_at: NOW }] }, origin: 'device' });
        const l1 = await ligneDe(repo, db, { cover_sha256: shaC }, { octets: false });
        const ff1 = F.fauxFetch();
        const r1 = await monter(repo, { ff: ff1, query: { import: l1.id } });
        await attendre(() => r1.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        const allume1 = role(r1.root, 'relire')?.disabled;
        const faites1 = r1.root.etatRoute().relecturesFaites;
        role(r1.root, 'relire').click();
        await attendre(() => r1.root.etatRoute().lecturesRecues === 1 && r1.root.etatRoute().relecturesFaites === faites1 + 1, 'vol refusé puis relu');
        eq([allume1, role(r1.root, 'lecture')?.querySelector('.status')?.textContent, ff1.posts().length, (await db.get('imports', l1.id)).status], [false, 'Cette image ne peut pas être lue ici. Essaie une autre photo.', 0, 'a_lancer'],
          'octets typés image mais non décodables : « Lire » allumé, puis le refus `image` dit dans le bloc lecture, aucun POST, la ligne a_lancer (vague finale, constat 11 ; mutant P1 : message du refus image nul → rouge)');
        scene.replaceChildren();
        const l2 = await ligneDe(repo, db);
        let sansOctets = false;
        const espion = { ...repo, getFile: (...a) => (sansOctets ? Promise.resolve(null) : repo.getFile(...a)) };
        const ff2 = F.fauxFetch();
        const r2 = await monter(espion, { ff: ff2, query: { import: l2.id } });
        await attendre(() => r2.root.etatRoute().lecture?.statut === 'a_lancer', 'relue');
        const allume2 = role(r2.root, 'relire')?.disabled;
        const faites2 = r2.root.etatRoute().relecturesFaites;
        sansOctets = true;
        role(r2.root, 'relire').click();
        await attendre(() => r2.root.etatRoute().lecturesRecues === 1 && r2.root.etatRoute().relecturesFaites === faites2 + 1, 'vol refusé puis relu');
        eq([allume2, role(r2.root, 'lecture')?.querySelector('.status')?.textContent, role(r2.root, 'relire')?.disabled, ff2.posts().length, (await db.get('imports', l2.id)).status], [false, 'La couverture n’est pas sur cet appareil.', true, 0, 'a_lancer'],
          'octets disparus au moment du vol : le refus `octets_absents` dit dans le bloc lecture, « Lire » éteint, aucun POST, la ligne a_lancer (vague finale, constat 11 ; mutants T5q : message nul, P2 : octets_absents hors de la liste → rouge)');
      });

      // Constat 11 bis (faux-vert T5r) : enregistrerLivre, exportée, borne ELLE-MÊME l'empreinte de couverture (I-E1) — un appelant futur qui lui passe un
      // pointeur relu du journal sans le borner n'écrit jamais une édition au pointeur hostile.
      await scenario('vague finale : enregistrerLivre borne elle-même l’empreinte de couverture (I-E1)', async (repo, db) => {
        const ed1 = await LA.enregistrerLivre({ champs: { title: 'x' }, isbn: '', coverSha256: 'F'.repeat(64) }, { repo });
        const ed2 = await LA.enregistrerLivre({ champs: { title: 'y' }, isbn: '', coverSha256: { x: 1 } }, { repo });
        eq([ed1.cover_sha256, ed2.cover_sha256, (await db.get('book_editions', ed1.id))?.cover_sha256, (await db.get('book_editions', ed2.id))?.cover_sha256], [null, null, null, null],
          'enregistrerLivre : une empreinte hors forme (« F… », objet) donne une édition sans couverture (vague finale, constat 11 bis ; mutant T5r : shaBornee retirée d’enregistrerLivre → rouge)');
      });

      // --- Ronde de clôture du lot E (R-E-30) : chaque scénario a été vu ROUGE sur le src/ de 8934f07 (rapport ronde-cloture-report.md).
      // Constat 1 (re-revue de la vague, Important) : les champs repris par « Utiliser ces renseignements » SANS ISBN (œuvre à plusieurs éditions : isbnDistant
      // nul) n'appartiennent à aucun ISBN — « Identifier » ne les rend qu'à une fiche TROUVÉE ; un ISBN introuvable, ou une panne d'Open Library puis « Saisir
      // à la main », les gardent avec leur étiquette (sourceDistante). La couverture imprime le titre en capitales : la fiche le remplace (champ « repris »).
      await scenario('ronde de clôture : sans ISBN, « Utiliser ces renseignements » puis un ISBN introuvable, ou une panne et « Saisir à la main », gardent les champs repris et leur étiquette (constat 1)', async (repo) => {
        const capitales = { title: 'JERUSALEM', subtitle: null, authors: ['YOTAM OTTOLENGHI'], publisher: null, language: 'en', uncertain: [] };
        const OL = 'Renseigné par Open Library — vérifie et corrige.';
        const parIsbn = { introuvable: [200, { numFound: 0, docs: [] }], panne: [503, ''], trouve: [200, { numFound: 1, docs: [F.OL_DOCS[0]] }] };
        for (const issue of ['introuvable', 'panne', 'trouve']) {
          scene.replaceChildren();
          const ff = F.fauxFetch({ assistant: [200, F.corpsOk(capitales)], ol: (a) => (new URL(a.url).searchParams.has('isbn') ? parIsbn[issue] : [200, F.OL_JERUSALEM]) });
          const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('rc1.jpg', { introuvable: '#a3a', panne: '#3a3', trouve: '#aa3' }[issue])] });
          role(root, 'choisir-couverture').click();
          await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
          bouton(root, 'Utiliser ces renseignements').click();
          const vu = () => [root.etatRoute().pas, titreDe(root)?.value, champ(root, 'Auteur / chef')?.value, root.querySelector('.status.info')?.textContent ?? null];
          const apres = vu();
          bouton(root, '← Changer d’ISBN').click();
          taper(root.querySelector('input[name="isbn"]'), '9780306406157');
          bouton(root, 'Identifier').click();
          await attendre(() => root.etatRoute().reponsesRecues === 1 && !root.etatRoute().recherche, `ISBN ${issue}`);
          if (issue === 'introuvable') {
            eq([apres, ...vu(), root.etatRoute().lecture?.statut, rappel(root), role(root, 'introuvable')?.textContent ?? null],
              [[2, 'Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', OL], 2, 'Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', OL, 'lue', 'ISBN 9780306406157', 'Aucune fiche chez Open Library pour cet ISBN. Complète à la main.'],
              'sans ISBN, « Utiliser », puis un ISBN valide INTROUVABLE : pas 2, titre et auteur repris d’Open Library gardés avec leur étiquette, lecture toujours lue, l’ISBN tapé rappelé et la ligne discrète du résultat (ronde de clôture, constat 1 ; avant : titre et auteur vidés par oublierDistants() avant l’appel ; mutant : oublierDistants() remis avant l’appel → rouge)');
          } else if (issue === 'trouve') {
            eq([apres, ...vu(), root.etatRoute().lecture?.statut, rappel(root), role(root, 'introuvable'), root.etatRoute().champsDistants?.title ?? null],
              [[2, 'Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', OL], 2, 'À la di Stasio', 'Josée Di Stasio', OL, 'recue', 'ISBN 9780306406157', null, 'À la di Stasio'],
              'sans ISBN, « Utiliser », puis un ISBN valide TROUVÉ : les champs repris de l’œuvre (et ceux de la lecture) sont rendus avant la fusion, la fiche de cet ISBN remplit, une seule étiquette, la lecture reste au journal (recue) ; aucune ligne « Aucune fiche » (ronde de clôture, constat 1 : rendus dans la seule branche `trouve`)');
          } else {
            const enPanne = [root.etatRoute().pas, !!role(root, 'indisponible')];
            bouton(root, 'Saisir à la main').click();
            eq([apres, enPanne, ...vu(), root.etatRoute().lecture?.statut],
              [[2, 'Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', OL], [1, true], 2, 'Jerusalem', 'Yotam Ottolenghi, Sami Tamimi', OL, 'lue'],
              'sans ISBN, « Utiliser », puis une PANNE d’Open Library sur un ISBN valide tapé et « Saisir à la main » : titre et auteur repris gardés avec leur étiquette (ronde de clôture, constat 1 ; mutants : oublierDistants() remis avant l’appel, ou l’ancienne formule de memeIsbn dans saisirMain → rouge)');
          }
        }
      });

      // Constat 1, la branche `trouve` SANS lecture appliquée : la ligne fermée AILLEURS (un autre onglet l'ignore, ou ajoute le livre) — la relecture la dit
      // `termine`, plus de remise de lecture ; les champs gardés de l'œuvre ne sont rendus que par oublierDistants() de `trouve`, avant la fusion.
      await scenario('ronde de clôture : sans ISBN, « Utiliser », la ligne fermée ailleurs, puis un ISBN TROUVÉ — la fiche de cet ISBN remplace les champs de l’œuvre (constat 1)', async (repo, db) => {
        const capitales = { title: 'JERUSALEM', subtitle: null, authors: ['YOTAM OTTOLENGHI'], publisher: null, language: 'en', uncertain: [] };
        const ff = F.fauxFetch({ assistant: [200, F.corpsOk(capitales)], ol: (a) => [200, new URL(a.url).searchParams.has('isbn') ? { numFound: 1, docs: [F.OL_DOCS[0]] } : F.OL_JERUSALEM] });
        const { root } = await monter(repo, { ff, pick: async () => [await F.imageDe('rc5.jpg', '#5a5')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => root.etatRoute().propositionsRecues === 1 && bandeau(root) !== null, 'bandeau');
        bouton(root, 'Utiliser ces renseignements').click();
        const id = root.etatRoute().importId;
        await db.mutate({ puts: { imports: [{ ...(await db.get('imports', id)), status: 'ignore' }] }, origin: 'device' }); // fermée ailleurs
        const faites = root.etatRoute().relecturesFaites;
        window.dispatchEvent(new Event('online'));
        await attendre(() => root.etatRoute().relecturesFaites === faites + 1, 'ligne relue : fermée ailleurs');
        const ferme = [root.etatRoute().lecture?.statut, titreDe(root)?.value];
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().pas === 2 && !root.etatRoute().recherche, 'ISBN trouvé');
        eq([ferme, titreDe(root)?.value, champ(root, 'Auteur / chef')?.value, root.querySelector('.status.info')?.textContent ?? null, role(root, 'introuvable')],
          [['termine', 'Jerusalem'], 'À la di Stasio', 'Josée Di Stasio', 'Renseigné par Open Library — vérifie et corrige.', null],
          'ligne fermée ailleurs (plus de lecture à rendre), puis un ISBN trouvé : les champs gardés de l’œuvre sont rendus dans la branche `trouve`, la fiche de cet ISBN remplit (ronde de clôture, constat 1 ; mutant : oublierDistants() retiré de `trouve` → « Jerusalem » gardé → rouge)');
      });

      // Constat neuf de la re-revue (Minor) : une lecture APPLIQUÉE garde son étiquette sur un ISBN introuvable, ET une ligne discrète tirée du résultat
      // (etat.resultat, statut introuvable) dit que l'ISBN n'a rien donné — le texte EXISTANT de la provenance « aucune », selon google (aucune chaîne neuve).
      await scenario('ronde de clôture : une lecture appliquée puis un ISBN introuvable — « Lu sur la couverture — vérifie. » ET la ligne discrète « Aucune fiche… » (constat neuf de la re-revue)', async (repo) => {
        const { root } = await monter(repo, { pick: async () => [await F.imageDe('rc2.jpg', '#a33')] });
        role(root, 'choisir-couverture').click();
        await attendre(() => lue(root) && root.etatRoute().propositionsRecues === 1, 'lecture appliquée, rattrapage fini');
        const avant = role(root, 'introuvable');
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), '9780306406157');
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && !root.etatRoute().recherche, 'ISBN introuvable');
        const ligne = role(root, 'introuvable');
        eq([avant, root.etatRoute().pas, root.querySelector('.status.info')?.textContent ?? null, ligne?.textContent ?? null, ligne?.tagName ?? null, ligne?.className ?? null, titreDe(root)?.value, root.etatRoute().lecture?.statut],
          [null, 2, 'Lu sur la couverture — vérifie.', 'Aucune fiche chez Open Library pour cet ISBN. Complète à la main.', 'SMALL', 'muted', 'À la di Stasio', 'lue'],
          'lecture appliquée puis ISBN introuvable : la provenance de la couverture reste, ET une ligne discrète dit qu’Open Library n’a aucune fiche pour cet ISBN (ronde de clôture ; mutant : ligne omise → rouge)');
        bouton(root, '← Changer d’ISBN').click();
        bouton(root, 'Saisir à la main').click();
        eq([root.etatRoute().pas, role(root, 'introuvable')], [2, null], 'un geste qui efface le résultat (« ← Changer d’ISBN ») retire la ligne : elle ne dit que le résultat de CETTE identification');
        // Le modèle (pur) : le texte suit google (non_appele, rien, echec), exactement celui de la provenance « aucune » ; rien quand l'étiquette le dit déjà
        // (« aucune »), ni hors d'un résultat introuvable.
        const M = (provenance, resultat) => LA.livreAjoutModel({ pas: 2, champs: { title: 'X' }, provenance, resultat }).messages.introuvable ?? null;
        const intr = (google) => ({ statut: 'introuvable', motif: null, google });
        eq([M('couverture', intr('non_appele')), M('couverture', intr('rien')), M('openlibrary', intr('echec')), M('aucune', intr('rien')), M('couverture', { statut: 'indisponible', motif: 'serveur', google: 'non_appele' }), M('couverture', null)],
          ['Aucune fiche chez Open Library pour cet ISBN. Complète à la main.', 'Aucune fiche chez Open Library ni Google Books pour cet ISBN. Complète à la main.', 'Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la main.', null, null, null],
          'modèle : la ligne discrète reprend le texte de « aucune » selon google (non_appele, rien, echec) ; absente sous l’étiquette « aucune » (qui le dit déjà), sur une panne, sans résultat');
      });

      // Observation résiduelle (a) de la vague : un vol HORS journal (tenirVol : une lecture de « Corriger », importId nul) tient le document — la route SANS
      // import le compte comme un vol ailleurs (null !== null était faux) : ses deux boutons s'éteignent, et se rallument à la libération (constat 3 de la vague).
      await scenario('ronde de clôture : un vol hors journal (tenirVol, sans identifiant) éteint les boutons d’une route sans import ; libéré, il les rallume (observation (a))', async (repo, db) => {
        const pick = { n: 0, fn: async () => { pick.n += 1; return []; } };
        const r1 = await monter(repo, { pick: pick.fn });
        const eteints = (r) => [role(r.root, 'photographier-couverture')?.disabled, role(r.root, 'choisir-couverture')?.disabled];
        const avant = eteints(r1);
        const jeton = UI.tenirVol();
        const r2 = await monter(repo, { pick: pick.fn });
        const pendant = [!!jeton, UI.volEnCours(), r1.root.etatRoute().importId, eteints(r1), eteints(r2)];
        UI.libererVol(jeton);
        await attendre(() => [...eteints(r1), ...eteints(r2)].every((x) => x === false), 'vol hors journal libéré : les boutons rallumés');
        eq([avant, pendant, eteints(r1), eteints(r2), pick.n, await db.count('imports')], [[false, false], [true, { importId: null }, null, [true, true], [true, true]], [false, false], [false, false], 0, 0],
          'vol hors journal (importId nul) pendant une route sans import : les deux boutons éteints, sur la route montée avant (avis du vol) comme sur celle montée pendant ; rallumés à la libération (ronde de clôture, observation (a) ; mutant : l’ancienne condition v.importId !== etat.importId → rouge)');
      });

      // T5-R1, doute 3, remède (a) ratifié : le chemin RÉEL d'une couverture d'un autre appareil — une a_verifier dont la section offre « Reprendre » (le
      // résultat est là), hostile à la revalidation (echec illisible), puis « Relire la couverture » — vole avec le device_id de CET appareil.
      await scenario('ronde de clôture : une couverture a_verifier HOSTILE d’un autre appareil, reprise par ?import=, passe echec ; « Relire » la fait voler avec le device_id d’ici (constat 4)', async (repo, db) => {
        const a = await ligneDe(repo, db, { status: 'a_verifier', device_id: 'appareil-B', resultat: { ...F.LECTURE, title: 'x'.repeat(400) }, started_at: NOW });
        const ff = F.fauxFetch({ assistant: null });
        const { root } = await monter(repo, { ff, query: { import: a.id } });
        await attendre(() => root.etatRoute().lecture?.statut === 'echec', 'revalidée : echec(illisible)');
        const echec = await db.get('imports', a.id);
        role(root, 'relire').click();
        await attendre(() => ff.posts().length === 1, 'vol parti');
        const enVol = await db.get('imports', a.id);
        eq([echec.status, echec.erreur?.raison, echec.device_id, enVol.status, enVol.device_id === repo.deviceId(), enVol.document_id_vol === UI.DOCUMENT_ID],
          ['echec', 'illisible', 'appareil-B', 'en_cours', true, true],
          'a_verifier hostile d’un autre appareil : la revalidation écrit echec(illisible) sans toucher device_id, puis « Relire la couverture » vole avec le device_id de CET appareil (ronde de clôture, constat 4 ; mutant : `ici` sans couverture → rouge)');
        role(root, 'annuler-lecture').click();
        await attendre(async () => (await db.get('imports', a.id)).erreur?.raison === 'annule', 'annulée');
      });

      // --- Ronde de clôture 2 du lot E (R-E-31, tests seuls). La condition `etat.isbnDistant === null` de `garderDistants` (identifier, src/ui/livre-ajout.js)
      // n'était épinglée par aucun test : le mutant RA5 (`garderDistants = !!etat.champsDistants`) laissait la suite verte et rouvrait C3 / I-B — les champs
      // d'un ISBN A restaient affichés sous un ISBN B introuvable, avec l'étiquette « Renseigné par Open Library ». Le code commis est juste : ces deux scénarios
      // sont verts à la tête et ROUGES sous RA5 (copie servie à part, rapport ronde-cloture-2-report.md). Sans couverture : aucune lecture, aucun POST.
      await scenario('ronde de clôture 2 : sans couverture, ISBN A trouvé, « ← Changer d’ISBN », ISBN B introuvable — rien de A ne reste sous B (C3, I-B)', async (repo) => {
        const A = '9782890772816', B = '9780306406157';
        const ff = F.fauxFetch({ assistant: null, ol: (a) => [200, new URL(a.url).searchParams.get('isbn') === A ? { numFound: 1, docs: [F.OL_DOCS[0]] } : { numFound: 0, docs: [] }] });
        const { root } = await monter(repo, { ff });
        const vu = () => [root.etatRoute().pas, titreDe(root)?.value ?? null, champ(root, 'Auteur / chef')?.value ?? null, root.querySelector('.status.info')?.textContent ?? null, !!role(root, 'introuvable'), root.etatRoute().champsDistants];
        taper(root.querySelector('input[name="isbn"]'), A);
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().passagesCouverture === 1 && !root.etatRoute().recherche, `ISBN ${A} trouvé, couverture demandée`);
        const apresA = vu();
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), B);
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 2 && !root.etatRoute().recherche, `ISBN ${B} introuvable`);
        eq([apresA, vu(), rappel(root), ff.posts().length],
          [[2, 'À la di Stasio', 'Josée Di Stasio', 'Renseigné par Open Library — vérifie et corrige.', false, { title: 'À la di Stasio', author: 'Josée Di Stasio', publisher: 'Flammarion Québec', year: '2004' }],
            [2, '', '', 'Aucune fiche chez Open Library pour cet ISBN. Complète à la main.', false, null], `ISBN ${B}`, 0],
          'sans couverture, ISBN A trouvé puis « ← Changer d’ISBN » et ISBN B INTROUVABLE : pas 2, titre et auteur de A rendus vides, l’étiquette dit « Aucune fiche… » (provenance aucune), pas de ligne discrète, aucun champ distant gardé (ronde de clôture 2, R-E-31 ; mutant RA5 : garderDistants sans `isbnDistant === null` → titre et auteur de A sous l’ISBN B, étiquette Open Library → rouge)');
      });

      // Variante panne : la PREMIÈRE réponse pour B est un 503 (pas 1, « Réessayer ») — les champs de A sont déjà rendus avant l'appel ; « Réessayer » trouve B
      // et la fiche de B remplit seule (une fiche de B complète : un champ de A gardé y resterait, la fusion ne remplit que les champs vides).
      await scenario('ronde de clôture 2 : ISBN A trouvé, « ← Changer d’ISBN », ISBN B en panne puis « Réessayer » qui le trouve — rien de A ne reste (C3, I-B)', async (repo) => {
        const A = '9782890772816', B = '9780306406157';
        let appelsB = 0;
        const ff = F.fauxFetch({ assistant: null, ol: (a) => {
          if (new URL(a.url).searchParams.get('isbn') === A) return [200, { numFound: 1, docs: [F.OL_DOCS[0]] }];
          appelsB += 1;
          return appelsB === 1 ? [503, ''] : [200, { numFound: 1, docs: [F.OL_DOCS[4]] }];
        } });
        const { root } = await monter(repo, { ff });
        const champs = () => [titreDe(root)?.value ?? null, champ(root, 'Auteur / chef')?.value ?? null, champ(root, 'Éditeur')?.value ?? null, champ(root, 'Année')?.value ?? null, champ(root, 'Langue du livre')?.value ?? null];
        taper(root.querySelector('input[name="isbn"]'), A);
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 1 && root.etatRoute().passagesCouverture === 1 && !root.etatRoute().recherche, `ISBN ${A} trouvé, couverture demandée`);
        const apresA = champs();
        bouton(root, '← Changer d’ISBN').click();
        taper(root.querySelector('input[name="isbn"]'), B);
        bouton(root, 'Identifier').click();
        await attendre(() => root.etatRoute().reponsesRecues === 2 && !root.etatRoute().recherche, `ISBN ${B} en panne`);
        const e = root.etatRoute();
        const enPanne = [e.pas, !!role(root, 'indisponible'), !!role(root, 'reessayer'), e.champs.title, e.champs.author, e.champs.publisher, e.champs.year, e.champsDistants];
        role(root, 'reessayer').click();
        await attendre(() => root.etatRoute().reponsesRecues === 3 && root.etatRoute().passagesCouverture === 2 && !root.etatRoute().recherche, `ISBN ${B} trouvé par « Réessayer »`);
        eq([apresA, enPanne, root.etatRoute().pas, ...champs(), root.querySelector('.status.info')?.textContent ?? null, !!role(root, 'introuvable'), root.etatRoute().champsDistants?.title ?? null, root.etatRoute().isbnDistant, rappel(root), appelsB, ff.posts().length],
          [['À la di Stasio', 'Josée Di Stasio', 'Flammarion Québec', '2004', 'fr'], [1, true, true, '', '', '', '', null], 2, 'Berber and Q', 'Josh Katz', 'Ebury Publishing', '2018', 'en', 'Renseigné par Open Library — vérifie et corrige.', false, 'Berber and Q', B, `ISBN ${B}`, 2, 0],
          'ISBN A trouvé, « ← Changer d’ISBN », ISBN B en PANNE (503) : pas 1, « Réessayer » offert, les champs de A déjà rendus vides, aucun champ distant gardé ; « Réessayer » trouve B : la fiche de B seule (titre, auteur, éditeur, année, langue), une seule étiquette, pas de ligne discrète (ronde de clôture 2, R-E-31 ; mutant RA5 : les champs de A gardés pendant la panne → rouge)');
      });
    } finally { scene.remove(); setUiLocale(localeAvant); }
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
      const gaucheLivre = ficheAvec.querySelector('.two-col.livre')?.firstElementChild;
      eq([!!gaucheLivre?.querySelector(':scope > .cover-wrap img.cover-img'), !!blocCouverture(ficheAvec), blocCouverture(ficheAvec)?.querySelector('small')],
        [true, true, null], 'fiche : la couverture ouvre la colonne de gauche (lot UI-1, D-UI-7), le bloc « Couverture » est visible, et rien n’est signalé (§ 6)');
      const biblio = await renderLibrary({}, { tab: 'books' }, ctx); // UI-1 T2 : la bibliothèque s'ouvre sur Recettes ; ce bloc affirme la grille des couvertures
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
      await Promise.all([...[fichePointeur, ficheAvec, biblio].flatMap((n) => [...n.querySelectorAll('img')])].map((i) => { i.loading = 'eager'; return i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }); }));
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
      // L3 : Livres contient les éditions ; les signets restent retrouvables par source Web dans Recettes.
      const bloc = n => n.querySelector('.bibliotheque-resultats');
      const titres = n => [...n.querySelectorAll('.bibliotheque-item h3')].map(n=>n.textContent);
      const recettesWeb = recipes => renderLibrary({}, {tab:'recettes', sources:'web'}, ctxDe(recipes));
      const seul = signet('rS', 'Saumon au fenouil', {created_at:'2026-10-17T10:00:00.000Z'});
      let n = await renderLibrary({}, {tab:'books'}, ctxDe([seul]));
      const seuleRecette = await recettesWeb([seul]);
      eq([n.textContent.includes('Aucun livre pour l’instant.'), !!bloc(n), titres(seuleRecette), seuleRecette.querySelector('.bibliotheque-item h3 a')?.getAttribute('href'), !!bloc(seuleRecette)],
        [true, false, ['Saumon au fenouil'], '#/recipes/rS', true], 'L3 : aucun livre inventé ; signet accessible dans Recettes avec sa fiche');
      n = await recettesWeb([{id:'rT', original_title:'Tapée',availability:'available',edition_id:null},signet('rL','Rangé',{edition_id:'eX'}),signet('rV','Vide',{source_url:''})]);
      eq([titres(n), n.textContent.includes('Aucune recette ne correspond.')], [[],true], 'L3 : filtre Web exclut saisie, adresse vide et parent absent');
      const ancien=signet('r1','Ancien',{created_at:'2026-10-01T10:00:00.000Z'}), recent=signet('r2','Récent',{created_at:'2026-10-15T10:00:00.000Z'});
      eq(titres(await recettesWeb([ancien,recent])), ['Récent','Ancien'], 'L3 Web : ordre temporel sans date de modification');
      eq(titres(await recettesWeb([{...ancien,updated_at:'2026-10-16T10:00:00.000Z'},recent])), ['Ancien','Récent'], 'L3 Web : tri explicite dernière modification, commun aux sources');
      eq(titres(await recettesWeb([signet('r0','Sans date'),signet('r3','Modifié seulement',{updated_at:'2026-10-10T10:00:00.000Z'}),ancien,recent])), ['Récent','Modifié seulement','Ancien','Sans date'], 'L3 Web : modification sans création et date inconnue gérées');
      n = await renderLibrary({}, {tab:'dishes'}, ctxDe([seul]));
      eq(n.querySelectorAll('.bibliotheque-item').length,0,'L3 : Plats ne duplique pas les signets');
      n = await renderLibrary({}, {tab:'recettes',sources:'web'}, ctxDe([seul],{sansDoc:['rS']}));
      {const a=n.querySelector('.bibliotheque-item h3 a');eq([titres(n),a?.getAttribute('href'),a?.textContent],[['Saumon au fenouil'],'#/recipes/rS','Saumon au fenouil'],'L3 : signet sans document projeté, lien et titre conservés');}
      await withRepo(async()=>{
        const ed={id:'eG',book_id:'bG',year:2020,cover_sha256:null},livre={id:'bG',title:'Grille',author:'G.',cuisines:[]};
        const ctx=ctxDe([seul,signet('rL','Rangé',{edition_id:'eG'})],{editions:[ed],books:[livre]});
        const m=await renderLibrary({},{tab:'books'},ctx),web=await renderLibrary({},{tab:'recettes',sources:'web'},ctx);
        eq([m.textContent.includes('Aucun livre pour l’instant.'),titres(web),!!m.querySelector('.grid')],[false,['Saumon au fenouil','Rangé'],true],'L3 : édition visible dans Livres ; signets autonome et rangé accessibles dans Recettes');
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
      for (const cle of clesT(src)) if (!(cle in EN)) manquantes.push(`${m}: ${cle}`); // lot UI-1, vague finale : t('…'), t("…") et t(`…`) sans ${…}
      ok(!/\bhtml:\s/.test(src) && !/innerHTML\s*=/.test(src) && !/window\.open\(/.test(src), `statique ${m} : ni html:, ni innerHTML, ni window.open (S14)`);
    }
    for (const [m, cles] of Object.entries(CHAINES_NEUVES_AILLEURS)) for (const cle of cles) if (!(cle in EN)) manquantes.push(`${m}: ${cle}`);
    eq(manquantes, [], 'i18n : chaque t() des modules neufs a son entrée en.js (F13)');
    // Le détecteur lui-même (lot UI-1, vague finale, constat 13 ; le motif du témoin de tests/creer-ia.js) : les trois formes de littéral sont vues, un gabarit à
    // expression et une variable ne le sont pas (avant, F13 ne lisait que les guillemets simples : un t("…") ou un t(`…`) neuf sans anglais passait).
    eq(clesT("t('simples') + t(\"doubles\") + t(`accents graves`) + t(`gabarit ${x}`) + t(variable) + t('Échappée l\\'a')"), ['simples', 'doubles', 'accents graves', "Échappée l\\'a"],
      'F13 : le détecteur lit t(\'…\'), t("…") et t(`…`) sans ${…} ; ni un gabarit à expression ni une variable (lot UI-1, vague finale)');
  }
  {
    // Rendu hostile : une chaîne <img onerror> reste du TEXTE dans les rendus neufs. F6 : plus de drapeau sur
    // `window` — un `window.__x` resté `undefined` ne prouve rien de plus que le compte d'<img>, et laisse une
    // trace globale derrière le test. Le contrôle positif est que le texte est bien là, affiché tel quel.
    const hostile = '<img src=x onerror="void 0">';
    const n1 = renderGrille({ cartes: [{ action: 'pages', ico: 'appareil-photo', titre: hostile, sousTitre: hostile }] }, { pages: () => {} }); // lot Carnet T5 : ico = un nom d'icône (icone(nom) lève sur un inconnu)
    const n2 = renderPuces(pucesModel({ choisies: [hostile] }), {});
    const n3 = S.renderSignet({ ...S.signetModel({ adresse: 'https://a.test/', titre: hostile }), livres: [] }, {});
    eq([n1.querySelectorAll('img').length, n2.querySelectorAll('img').length, n3.querySelectorAll('img').length], [0, 0, 0], 'statique : une chaîne hostile ne crée aucun élément (S14)');
    eq([n1.textContent.includes(hostile), n2.textContent.includes('<img src=x')], [true, true], 'statique : … et elle reste du texte affiché, pas du balisage avalé (S14)');
  }
  {
    const sw = await lireLivraison();
    ok(sw.octets > 300 && sw.chemins.length > 30, `manifeste : inventaire bien lu (${sw.octets} octets, inventaire présent) — sans quoi les inclusions ci-dessous ne prouveraient rien (S4)`);
    for (const m of ['./src/ui/puces.js', './src/ui/livre-ajout.js', './src/ui/accueil-livre.js', './src/ui/signet.js', './src/core/image.js', './src/core/blob-urls.js', './src/core/lien.js', './src/core/isbn.js', './src/domain/lecture-web.js']) ok(sw.chemins.includes(m), `SHELL : ${m}`);
    ok(/^0\.32\.4-[1-9]\d*$/.test(sw.release), 'manifeste : livraison 0.32.4');
    const { APP_VERSION } = await import('../src/model/schema.js');
    eq(APP_VERSION, '0.32.4', 'APP_VERSION 0.32.4 (lot UI-1, carnet)');
    const { GOOGLE_BOOKS } = await import('../src/sync/config.js');
    ok(typeof GOOGLE_BOOKS?.key === 'string' && (GOOGLE_BOOKS.key === '' || /^AIza[0-9A-Za-z_-]{35}$/.test(GOOGLE_BOOKS.key)), 'config : la clé Google Books est vide ou au format d’une clé d’API publique — un test de forme, jamais de valeur (S2/F2)');
  }
}
