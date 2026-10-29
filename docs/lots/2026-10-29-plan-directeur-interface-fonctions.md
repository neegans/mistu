# Mistu — plan directeur pour l’interface, les recettes et la cuisine

**Document de travail destiné à Neegan et à Claude Code**  
**Base examinée : version 0.21.1 — recherche et revue arrêtées au 29 octobre 2026**  
**Périmètre : web, téléphone, tablette, gestion des livres et recettes, import, français, cuisine, synchronisation et Thermomix.**


**Accès rapide :**

- [Décisions principales](#1-la-direction-que-je-recommande)
- [Arbitrage de Gemini](#4-mon-arbitrage-des-propositions-de-gemini)
- [Correctifs confirmés](#5-les-correctifs-concrets-à-traiter-avant-les-grands-ajouts)
- [Interface et navigation](#6-organisation-de-linterface--moins-de-recherche-plus-de-continuité)
- [Suppression et restauration](#8-supprimer-restaurer-et-conserver-les-liens-utiles)
- [Pages d’index](#10-ajouter-et-gérer-les-pages-dindex)
- [Français et assistant](#12-français-simple-versions-et-assistant)
- [Mode cuisine](#13-mode-cuisine--fiable-lisible-et-facile-à-reprendre)
- [Thermomix et Cookidoo](#15-thermomix-et-cookidoo--ce-qui-est-possible-et-ce-quil-faut-tester)
- [Animations et accessibilité](#16-animations-et-accessibilité--de-la-présence-sans-gêner-la-lecture)
- [Feuille de route](#20-feuille-de-route-proposée)
- [Validation](#21-plan-de-validation-et-critères-de-livraison)
- [Consignes à Claude Code](#23-consignes-de-passage-à-claude-code)
- [Sources](#24-sources-et-repères-de-code)

## 1. La direction que je recommande

Mistu devrait donner l’impression d’un carnet de cuisine personnel que l’on peut toujours corriger : je trouve une recette, je l’ajoute, je la retrouve, je la cuisine, puis je conserve ce que j’ai appris. Le travail administratif doit rester discret.

La priorité est de rendre les gestes ordinaires évidents : **modifier, supprimer, restaurer, compléter un livre et ajouter des pages d’index**. Les animations viennent accompagner ces gestes. Elles ne résolvent pas un bouton absent, une traduction qui décale les ingrédients ou une suppression qui réapparaît après synchronisation.

La lecture du code change plusieurs recommandations de la première recherche. Les versions de recettes, le repas multi-recettes, le plan commun, l’inventaire, les photos synchronisées, les repères de durée et la préparation d’un texte Cookidoo existent déjà. Il faut souvent les améliorer et les rendre visibles, plutôt que construire un deuxième système.

### Les dix décisions principales

1. **Conserver le socle JavaScript natif actuel.** Les besoins décrits ne justifient pas une migration vers React ou une réécriture générale.
2. **Livrer une vraie corbeille durable.** Une suppression doit fonctionner hors ligne, survivre à la fermeture et permettre une restauration sans perdre les sources.
3. **Mettre les actions près du contenu.** Une recette et un livre ont un accès clair à Modifier et à leurs actions de gestion, depuis leur fiche comme depuis la bibliothèque.
4. **Réunir les portes d’entrée de modification.** Un espace cohérent peut contenir plusieurs sections; il n’a pas besoin de devenir un formulaire immense.
5. **Faire de l’index un contenu utile.** Une référence « dans ce livre, page 74 » est une information réussie, pas une recette constamment signalée comme défectueuse.
6. **Séparer original, traduction et adaptation.** Corriger une lecture, traduire fidèlement et simplifier la méthode sont trois opérations différentes.
7. **Corriger les problèmes de données avant le décor.** Traductions partielles, horaires locaux, remplacement d’une source et enregistrement après suppression méritent une livraison dédiée.
8. **Améliorer le mode cuisine autour du repas réel.** Ingrédients accessibles, quantités lisibles, minuteurs persistants, écran maintenu allumé quand le navigateur le permet.
9. **Faire progresser Thermomix par niveaux.** D’abord une bonne variante et un export lisible; ensuite un prototype Cookidoo; le suivi de l’appareil reste un chantier distinct.
10. **Valider avec les données réelles et les appareils réels.** Une recette ancienne sans photo, un livre partiellement indexé et un iPhone hors ligne comptent davantage qu’une capture de démonstration parfaitement remplie.

### Ce qui rendra l’application plus agréable au quotidien

| Situation | Expérience cible |
|---|---|
| « Cette recette web ne m’intéresse plus » | Menu Actions → Mettre à la corbeille → possibilité d’annuler, sans devoir ouvrir un éditeur |
| « Je veux corriger une quantité » | Modifier → ingrédient concerné → enregistrer; l’original reste consultable |
| « J’ai photographié deux autres pages d’index » | Ouvrir le livre → Ajouter des pages d’index → relire uniquement les nouvelles entrées ou les changements |
| « Je reviens de la fiche à ma recherche » | Même recherche, mêmes filtres et position conservée |
| « Cette recette est en anglais » | Choisir une traduction disponible ou demander explicitement une traduction; aucune confusion avec la langue des menus |
| « Je prépare le plat et sa sauce » | Une session de repas avec les deux recettes, les minuteurs et un plan commun |
| « Le réseau disparaît » | Les contenus effectivement présents restent utilisables; l’état local et l’état synchronisé sont distincts |
| « Je veux la faire avec mon TM7 » | Variante adaptée, vérifiable, puis préparation pour Cookidoo; aucun statut appareil inventé |

## 2. Ce qui a été examiné et ce que ce document ne prétend pas prouver

### 2.1 Corpus et version

Ce document croise :

- `Mistu_Code_source_0.21.1.md`, export du code fourni;
- `Mistu_Guide_de_revue_0.21.1.md`, qui précise les invariants et les limites connues;
- `revue_code_et_ux_mistu_0_21_1 (1).md`, la revue et les propositions de Gemini;
- le PDF joint reprenant les commentaires d’interface et des propositions de code;
- la recherche documentaire précédente sur les applications de recettes, les interfaces, les animations et Thermomix;
- les difficultés exprimées par Neegan et les captures discutées dans le contexte précédent.

**Référence de l’export :** commit `cd8c7f2e85e1333ab720b7eaca1461cd81d81225`. Le guide identifie `fe241e1` comme dernier commit applicatif de cette version. La version de schéma IndexedDB est 4; la version applicative est 0.21.1.

Les **131 fichiers de l’export ont été extraits et leurs empreintes SHA-256 comparées à celles du document : elles correspondent**. Cela vérifie la fidélité de l’extraction, pas l’absence de défauts dans ces fichiers. La revue est ciblée sur les parcours demandés et leurs dépendances.

### 2.2 Niveau de preuve

Les formulations de ce rapport distinguent quatre niveaux :

| Mention | Signification |
|---|---|
| **Confirmé dans le code** | Le comportement ou la structure est directement lisible dans l’export |
| **Reproduction locale limitée** | Une fonction pure ou une expression a été exécutée isolément; ce n’est pas un test de l’application complète |
| **À vérifier en usage** | La gravité, la fréquence, le rendu ou la compatibilité exigent un essai réel |
| **Proposition** | Comportement cible à concevoir et implémenter; ce n’est pas une fonction livrée |

L’application n’a pas été démarrée dans cette revue. Aucun compte Supabase ou Cookidoo n’a été connecté, aucun TM7 n’a été commandé, et aucune suite complète du dépôt n’a été exécutée. L’export ne fournit pas tout l’environnement de travail et ses tests. Les fichiers `AGENTS.md`, `STATE.md` et les maquettes cités par le guide devront être lus dans le dépôt par l’agent chargé de l’implémentation; leur contenu complet n’a pas été audité ici.

La recherche externe décrit les fonctions annoncées ou documentées par leurs éditeurs. Elle ne mesure pas leur qualité réelle. Les informations Thermomix sont datées et doivent être revérifiées au moment du prototype.

### 2.3 Noms de produit

Le dossier est nommé Mistu; la recherche précédente emploie Mito; la coquille actuelle affiche Cuisine OS. Je conserve **Mistu** pour ce document. Il faut choisir un nom affiché cohérent dans l’interface, l’installation et l’aide. Ce travail ne demande pas de renommer les clés de stockage, la base IndexedDB ou les formats d’archive existants.

## 3. Cartographie : ce qui existe, ce qui manque, ce qui doit être corrigé

| Domaine | État de la version examinée | Travail recommandé |
|---|---|---|
| Bibliothèque et livres | Recherche, filtres, fiches et ajout contextuel de livre présents | Rendre la gestion visible, conserver le contexte au retour, ajouter la sélection multiple après la corbeille |
| Suppression d’un livre | Fonction `supprimerLivreVide` présente; limitée au livre réellement vide | Étendre le parcours aux livres contenant des données par une corbeille, sans cascade aveugle |
| Suppression des recettes | Pas de parcours de gestion complet répondant à la demande | Ajouter suppression/restauration, avec protection des versions, historiques et écritures tardives |
| Modification | Éditeur et versions présents; fonctions réparties entre plusieurs écrans | Un point d’entrée cohérent et des sections adaptées au type de changement |
| Index de livre | Ajout de page, lecture, consolidation, dédoublonnage et reprise partielle présents | Exposer le parcours et invalider correctement une lecture quand la photo source change |
| Sources et photos | Documents/pages/fichiers séparés; synchronisation des octets déjà implémentée | Rendre les états compréhensibles, préserver l’historique des sources, mesurer les gros volumes |
| Français | Interface traduisible, repères en français et traduction manuelle par version | Corriger l’alignement des traductions partielles; ajouter une traduction automatique explicite |
| Versions | Original, corrections et adaptations modélisés | Les présenter comme Original / Ma version / Thermomix, avec une source et un statut clairs |
| Mode cuisine | Multi-recettes, progression, plan commun et lecture à voix haute présents | Corriger la disposition desktop, la sélection active et les minuteurs; ajouter Wake Lock |
| Repas et courses | Repas, horaires, courses consolidées et inventaire présents | Corriger l’heure locale et le partage; raccourcir les parcours quotidiens |
| Thermomix | Adaptation contrôlée et préparation d’un texte Cookidoo présentes | Améliorer ce parcours; prototype de connexion séparé et facultatif |
| Hors ligne et sauvegarde | IndexedDB, service worker, synchronisation et archive ZIP présents | Clarifier ce qui est réellement disponible localement; renforcer validation et reprise |
| Animations | Base CSS et rendu DOM natif | Petites transitions utiles, accessibles, sans changement de framework |

**Conséquence pour Claude Code :** commencer chaque lot par vérifier ce que fait déjà la version courante du dépôt. L’export peut avoir été dépassé depuis cette revue. Adapter l’existant avant de créer un module parallèle.

## 4. Mon arbitrage des propositions de Gemini

L’intention générale de Gemini est bonne : moins de friction, gestion accessible, meilleur espace de travail sur ordinateur, import plus direct. Plusieurs extraits techniques ne correspondent toutefois pas au code livré. Ils constituent des pistes de conception, pas des correctifs à copier.

| Proposition ou affirmation | Arbitrage | Motif et adaptation |
|---|---|---|
| Menu Actions sur cartes et fiches | **Retenir** | Ajouter les mêmes actions et libellés partout, accessibles au toucher et au clavier |
| Menu révélé seulement au survol | **Corriger** | Le survol peut renforcer un bouton; il ne doit pas être nécessaire pour découvrir la gestion |
| Corbeille avec Annuler | **Retenir** | La mise à la corbeille doit être écrite durablement; un `setTimeout` en mémoire n’est pas un stockage |
| Supprimer après quelques secondes pour permettre Annuler | **Remplacer** | Écrire tout de suite une suppression logique; Annuler restaure. Fermer la page ne doit pas changer le résultat |
| Cascade supprimant versions, photos et historique | **Rejeter en l’état** | Les références croisées et les fichiers partagés dépassent la fiche visible; préserver l’historique par défaut |
| Utiliser `src/storage/*`, OPFS, `repo.put`, `listByIndex` ou `by_recipe` | **Ne pas appliquer** | Ces chemins et interfaces ne correspondent pas à cet export. Le dépôt réel est `src/model/repo.js`; l’accès indexé est `byIndex` avec les index déclarés |
| `removeBatch` pour mélanger suppressions et modifications | **Corriger** | Cette fonction refuse patch et fusion. Les primitives transactionnelles existantes doivent être utilisées selon leur contrat |
| L’export ZIP serait systématiquement bloqué par un orphelin | **Nuancer** | L’export peut signaler un problème; l’inspection/restauration refuse les références invalides. Ce sont deux étapes différentes |
| Ajouter des filtres au livre | **Améliorer l’existant** | Toutes / Disponibles / À importer / Favoris existent déjà dans `book.js` |
| Créer un bouton Ajouter un livre dans la bibliothèque | **Améliorer sa visibilité** | L’entrée contextuelle existe déjà dans `library.js` |
| Créer le mode repas multi-recettes | **Améliorer l’existant** | `cook.js` possède déjà les onglets et Plan commun |
| Réparer le desktop en passant seulement `.cook` en grille | **Insuffisant** | La structure DOM contient un seul enfant principal; il faut séparer les panneaux avant de régler la grille |
| Wake Lock serait déjà présent | **Non confirmé, absent de l’export recherché** | Ajouter cette capacité explicitement et prévoir l’échec ou la révocation par le navigateur |
| Un bouton « Tout valider » après OCR | **Limiter fortement** | Une lecture techniquement complète n’est pas une recette relue. Ne marquer que les éléments réellement vérifiés |
| Corriger les traductions avec des tableaux filtrés | **Rejeter** | Supprimer les lignes vides décale les associations par position |
| Fusionner extraction, traduction et repères en un appel IA | **Expérimenter plus tard** | L’extraction web peut déjà fonctionner sans modèle; qualité, schéma, reprise et coût doivent être mesurés |
| Transformer toute ligne commençant par Sauce ou Pour en section | **Rejeter comme règle automatique** | « Sauce soja » peut être un ingrédient. Proposer un type de bloc avec correction humaine |
| Identifier « 50 portions » comme une erreur certaine | **Non démontré** | Le rendement peut désigner 50 pièces. Afficher le texte original et son unité avant de conclure |
| Raccourcis clavier globaux sur Espace et flèches | **Corriger** | Actifs uniquement dans le contexte voulu, sans intercepter formulaires, dialogues ou composition de texte |
| Collage intercepté sur tout le document | **Rejeter** | Réserver le traitement à une zone d’import explicite; préserver le collage normal dans les champs |
| Chiffrer des gains de 60 %, 90 % ou un délai de quelques heures | **Ne pas reprendre** | Aucun protocole de mesure ni estimation du dépôt complet ne justifie ces nombres |

La première recherche contenait aussi des recommandations conditionnelles qui changent avec le code disponible : **Motion for React n’est pas pertinent pour la pile actuelle**, et plusieurs fonctions proposées comme nouvelles sont déjà présentes. Ce plan les requalifie.

## 5. Les correctifs concrets à traiter avant les grands ajouts

La priorité indique l’ordre recommandé dans ce projet, pas une classification de sécurité. Les références détaillées sont réunies en fin de document.

### C01 — Une traduction partielle peut déplacer les ingrédients

**Confirmé dans le code; reproduction locale limitée de l’expression.** Dans `recipe-edit.js`, les champs de traduction sont divisés par saut de ligne puis filtrés avec `filter(Boolean)`. L’affichage dans `recipe.js` associe ensuite les traductions à la source par position.

Exemple : source `[salt, sugar, butter]`, traduction saisie `[sel, vide, beurre]`. Le filtrage produit `[sel, beurre]`; « beurre » peut alors être présenté à la position de « sugar ».

**Correction immédiate :** préserver toutes les positions et représenter explicitement une traduction manquante. Ne pas transformer un saut de paragraphe dans une étape en nouvelle étape. Afficher le texte source comme repli seulement pour l’élément manquant, avec une indication discrète.

**Évolution :** stocker les correspondances par identifiants stables d’ingrédients et d’étapes liés à la version exacte. Prévoir une migration des anciennes traductions; ne pas prétendre reconstituer automatiquement une association déjà perdue.

**Acceptation :** une traduction du premier et du troisième ingrédient laisse le deuxième à sa place; les étapes multilignes gardent leur identité; une traduction ancienne ambiguë demande une vérification.

### C02 — Une édition peut recréer une recette supprimée

**Confirmé dans le code.** `recipe-edit.js` utilise une fusion qui retombe sur l’objet chargé initialement lorsque la recette courante a disparu. Le commentaire décrit cette résurrection comme volontaire.

**Correction avant livraison de la corbeille :** à l’enregistrement, relire la recette dans la transaction et refuser la modification si elle a été supprimée ou mise à la corbeille. Conserver le texte de travail dans le formulaire; proposer explicitement « Enregistrer comme nouvelle recette » ou « Ouvrir la corbeille ».

Cette règle doit aussi s’appliquer aux retours tardifs de l’assistant, aux photos, aux repères et aux synchronisations. Un simple contrôle au moment de l’ouverture de l’écran ne suffit pas.

**Acceptation :** ouvrir une recette dans deux onglets, la supprimer dans le premier, enregistrer dans le second : aucun retour silencieux dans la bibliothèque.

### C03 — L’heure de service peut changer à la réouverture

**Confirmé dans le code; reproduction locale limitée du traitement de date.** La saisie `datetime-local` est convertie en date ISO, puis réaffichée avec une découpe de la chaîne UTC. Sous `America/Toronto`, le 29 octobre 2026 à 19 h devient 23 h lors de cette restitution.

**Correction :** décider explicitement si le rendez-vous représente un instant ou une heure locale attachée à un fuseau; formater la valeur du contrôle avec les composantes locales appropriées. Ne pas utiliser `toISOString().slice(0,16)` pour restituer une heure locale.

**Acceptation :** créer, enregistrer et rouvrir un repas à 19 h conserve 19 h; tester aussi un changement d’heure et un appareil dans un autre fuseau selon la règle produit choisie.

### C04 — Remplacer une photo d’index peut laisser son ancienne lecture active

**Confirmé dans le code.** `import.js` remplace les données d’une page en conservant son identifiant. `index-livre.js` retrouve les lectures par `page_id`, sans identifier de façon suffisante la nouvelle empreinte de l’image.

**Correction :** lier un résultat de lecture à la révision exacte de sa source : empreinte, document ou identifiant de révision. Une image remplacée doit être signalée comme changée et proposer une nouvelle lecture avec comparaison. Ne pas supprimer automatiquement les corrections faites sur les entrées de l’index.

**Enjeu historique :** une version de recette ne doit pas prétendre avoir été extraite d’une nouvelle photo alors qu’elle provient de l’ancienne. L’ancien document peut encore exister; le constat n’établit pas une perte physique des octets. Il révèle une ambiguïté de provenance à corriger.

### C05 — Le mode cuisine perd des repères lors du changement de recette

**Confirmé dans la structure du rendu.** Les boutons d’onglet et le lien Fiche sont construits avant les mises à jour de la zone centrale. Le changement de recette ne reconstruit pas ces éléments. Le style actif, la destination de Fiche et la persistance de la sélection doivent suivre la recette réellement affichée.

**Acceptation :** ouvrir un repas à deux recettes, passer à la sauce, ouvrir Fiche et revenir : titre, onglet, version et étape concordent.

### C06 — Les minuteurs demandent des corrections de précision et de continuité

**Reproductions locales limitées :** `siriPhrase(30)` demande une minute et `siriPhrase(90)` deux minutes, alors que le raccourci reçoit respectivement 30 et 90 secondes. Le parseur d’une instruction « Leave for 4–6 hours » ne retient que 6 heures dans le cas testé.

**Confirmé dans le rendu :** le compte à rebours indicatif est recréé dans la carte d’une étape; un changement d’étape ou de panneau détruit son état local d’affichage.

**Correction :** conserver une durée exacte et, lorsqu’elle existe, une plage minimale/maximale; générer une phrase Siri exacte; reconstruire les compteurs à partir de lancements persistés et d’un instant de fin. Maintenir la distinction entre affichage indicatif et alarme système. L’application ne déclenche pas Siri et ne reçoit pas de confirmation automatique d’Horloge.

**Acceptation :** 30 secondes, 90 secondes et 4–6 heures sont correctement représentées; quitter l’étape puis revenir n’efface pas un lancement; un retour d’arrière-plan recalcule le temps restant.

### C07 — Le retour à la bibliothèque perd le contexte

**Confirmé dans le code.** Le rendu de `app.js` force le défilement en haut. Plusieurs filtres et recherches vivent dans des variables locales à l’écran.

**Correction :** conserver recherche, filtre, tri et position par vue. Une navigation volontaire vers une nouvelle destination et un retour à une liste ne doivent pas avoir le même comportement. Distinguer changement de route, rafraîchissement de données et retour arrière.

**Acceptation :** filtrer un livre, ouvrir la douzième recette, revenir : le même résultat reste visible, au même endroit raisonnable.

### C08 — Le partage d’une liste de courses perd son état

**Confirmé dans le code analysé.** La représentation partagée n’exprime pas l’état coché des éléments.

**Correction :** proposer par défaut « Partager ce qu’il reste à acheter », et une option « Liste complète » qui conserve les marques ou leur équivalent textuel. Ne pas annoncer une synchronisation collaborative si le mécanisme partage seulement du texte.

### C09 — La suppression du livre vide est utile, mais son contrôle doit être renforcé

`supprimerLivreVide` relit des dépendances et refuse certains imports actifs. Le code documente lui-même une vérification de vacuité hors de la transaction finale et un cas d’import au statut inconnu entre deux phases.

**Action :** conserver ce parcours tant que nécessaire, mais renforcer les conditions atomiques. Ne pas simplement ouvrir ce bouton aux livres remplis. La suppression générale requiert le modèle de corbeille de la section 8.

## 6. Organisation de l’interface : moins de recherche, plus de continuité

### 6.1 Partir de la navigation réelle

La coquille actuelle contient **Aujourd’hui, Bibliothèque, Ma semaine, Ma cuisine et Ajouter**. Elle n’a pas trois entrées. Je recommande de conserver cette structure pour la première livraison et d’améliorer le contenu de chaque destination. Changer toutes les habitudes de navigation en même temps que la gestion des données compliquerait la validation.

Une évolution possible est de renommer Ma semaine en **Repas**, afin d’y inclure les envies sans date, le calendrier et les courses. Ce renommage est une proposition à tester. Les routes existantes peuvent rester stables.

| Destination | Rôle principal proposé | Ce qui doit être immédiatement accessible |
|---|---|---|
| Aujourd’hui | Reprendre ou choisir quoi cuisiner | Session active, prochain repas, quelques envies, import interrompu |
| Bibliothèque | Retrouver et gérer ses contenus | Recettes, livres, recherche, filtres, tri, gestion |
| Ma semaine / Repas | Organiser les repas | À cuisiner bientôt, calendrier, courses, modèles de menus |
| Ma cuisine | Ce qui est personnel et matériel | Inventaire, appareils, préférences, retours de cuisson |
| Ajouter | Faire entrer un contenu | Lien, photos, PDF, texte, livre ou saisie manuelle |

Les courses doivent aussi être accessibles directement depuis le repas courant et l’accueil. Il faut mesurer si leur fréquence d’usage justifie ensuite une destination principale dédiée; ne pas multiplier les onglets avant cet essai.

### 6.2 Ordinateur

- Utiliser la largeur pour comparer ou travailler : liste et aperçu, source et correction, ingrédients et préparation.
- Garder une largeur de lecture confortable pour les paragraphes; l’espace gagné sert aux panneaux complémentaires.
- Proposer une grille pour explorer et une liste compacte pour gérer. Le choix est mémorisé.
- Conserver recherche, filtres et nombre de résultats dans une zone stable.
- Ouvrir la modification approfondie dans un espace large; réserver les petits panneaux aux changements courts.
- Rendre la sélection multiple explicite, avec une barre d’actions contextuelle et un nombre d’éléments sélectionnés.

### 6.3 Téléphone

- Un objectif principal par écran; formulaires organisés en sections plutôt qu’en colonnes comprimées.
- Actions principales dans une zone atteignable, avec une marge pour les barres système et le clavier.
- Un panneau inférieur pour choisir une variante, une portion ou une action; un écran complet pour corriger une longue recette.
- Le menu Actions reste visible. Le balayage peut devenir un raccourci, jamais le seul moyen de supprimer.
- Éviter les boutons qui changent d’emplacement lorsque les données ou les photos arrivent.
- Garder une commande Retour cohérente qui conserve le brouillon et le contexte.

### 6.4 Tablette et cuisine

La tablette mérite un vrai mode de travail : ingrédients à gauche, étape à droite, minuteurs dans une zone persistante. En portrait étroit, les ingrédients peuvent devenir un panneau accessible sans perdre l’étape. Une rotation ne doit pas remettre la session au début.

### 6.5 La densité et la hiérarchie visuelle

Conserver l’identité crème et olive si elle convient à Neegan. La modernisation passe surtout par une meilleure hiérarchie : titres clairs, contraste, espaces cohérents et photos utiles.

Une carte de recette devrait répondre à quatre questions : **qu’est-ce que c’est, où est la source, est-ce disponible, quelle est l’action suivante ?** Les métadonnées secondaires apparaissent dans la fiche ou au moyen de filtres. Ne pas empiler plusieurs avertissements pour un même manque facultatif.

Les entrées d’index sans photo peuvent avoir une présentation textuelle soignée. Un grand cadre vide ou une illustration générique répétée consomme de l’espace sans ajouter d’information.

### 6.6 États et vocabulaire

| Dimension | Exemples de libellés utilisateur | Règle |
|---|---|---|
| Disponibilité du contenu | Référence dans un livre / Lien web · Recette partielle · Recette disponible | `reference_only`, avec libellé adapté à la source; `partial`; `available` |
| Vérification | À relire · Relue par moi | Ne pas confondre extraction réussie et validation humaine |
| Expérience de cuisine | Pas encore cuisinée · Cuisinée · À refaire | S’appuyer sur le carnet réel, pas sur le seul statut de version |
| Variante | Original · Ma correction · Avec mon TM7 | Conserver la lignée et la version exacte |
| Enregistrement | Enregistré sur cet appareil · En attente d’envoi | Dire où le résultat existe réellement |
| Photos | À télécharger · Disponible ici · Image illisible | Ne pas réduire tous les problèmes à « pas de photo » |
| Thermomix | Texte préparé · Recette créée dans Cookidoo · État reçu de l’appareil | Chaque niveau nécessite sa propre preuve |

Les valeurs techniques actuelles de vérification sont `unverified`, `to_verify` et `verified`; celles des versions comprennent `proposed` et `tested`. Ne pas introduire dans le code le vocabulaire fictif `canonical_status: valide/propose` issu d’un exemple de revue.

## 7. Bibliothèque et fiches : rendre la gestion évidente

### 7.1 Bibliothèque

L’onglet Livres mélange actuellement des livres, des liens web gardés et des recettes créées avec l’assistant. Il faut clarifier le modèle mental : **Livres contient des livres; Recettes contient les recettes et références, quelle que soit leur source**. Un filtre Source permet ensuite de choisir livre, site web, création personnelle ou assistance IA. Une collection de liens peut rester accessible sans les présenter comme des livres.

La barre d’outils propose recherche, filtres, tri et vue grille/liste. Les filtres doivent se combiner et montrer leur état actif. Une commande Effacer les filtres apparaît seulement si nécessaire. Les résultats vides expliquent si la collection est vide ou si les filtres ne trouvent rien.

Les filtres utiles pour Neegan sont : à cuisiner bientôt, favoris, recette disponible, référence dans un livre, à relire, source web, livre précis, appareil, durée connue et ingrédient. Les filtres de durée ne doivent pas traiter une durée inconnue comme zéro. Le critère Rapide déjà défini par les repères mérite d’être réutilisé.

La sélection multiple arrive après la gestion individuelle fiable. Elle sert à classer, ajouter à une collection et mettre à la corbeille. Ne pas en faire un moyen de valider automatiquement des centaines de lignes OCR.

### 7.2 Carte et ligne de recette

**Contenu de base :** titre, photo si disponible, provenance courte, durée connue et disponibilité lorsque celle-ci change l’action suivante. Une référence d’index montre sa page. Une recette partielle reste explicitement partielle.

**Actions :** ouvrir, favori facultatif, bouton Actions. Ajouter une photo, estimer les durées et compléter une description appartiennent au menu ou à l’éditeur. Ils ne doivent pas occuper trois lignes sur chaque carte incomplète.

Le composant partagé de repères peut avoir des variantes explicites : compact, fiche et édition. Il faut éviter qu’un réglage destiné à alléger une carte supprime aussi une information utile dans l’éditeur. Ne pas faire dépendre cette différence d’une cascade de sélecteurs CSS difficiles à suivre.

### 7.3 Fiche de recette

En haut : titre, source, variante sélectionnée, disponibilité, puis **Cuisiner**, **Modifier** et **Actions**. Les portions sont visibles lorsqu’elles ont un sens et peuvent être changées; les restrictions propres à une adaptation Thermomix restent proches du contrôle.

Le contenu principal privilégie ingrédients et préparation. Les sources, notes, photos, versions et historique sont accessibles dans des sections nommées. Le grand panneau actuel « Portions, versions et autres gestes » ne doit plus être la seule porte d’accès à des opérations ordinaires.

Une recette vérifiée reste modifiable. Une modification substantielle crée la version appropriée; le statut vérifié n’a pas pour fonction de cacher l’éditeur.

### 7.4 Fiche de livre

En-tête : couverture, titre, auteur, édition/langue quand pertinents, **Modifier le livre**, **Ajouter des pages d’index**, **Ajouter une recette** et Actions.

Les compteurs distinguent références, recettes partielles et recettes disponibles. Le code actuel assimile parfois les valeurs autres que `reference_only` à du disponible; les mots de l’interface doivent éviter de promettre une recette prête alors que sa méthode manque.

Les filtres existants restent présents et sont mémorisés. L’utilisateur peut passer de la liste des recettes à la gestion des sources sans perdre son livre ou sa sélection. Les reprises d’import doivent retourner à la bonne séance, pas seulement à une liste générale où il faut chercher à nouveau.

## 8. Supprimer, restaurer et conserver les liens utiles

### 8.1 Contrat utilisateur

La première livraison doit offrir une **corbeille durable, consultable et synchronisable**. L’action ordinaire s’appelle Mettre à la corbeille. Une action Annuler restaure l’élément; la corbeille permet aussi de le retrouver après disparition du message.

Pour une recette, la suppression réversible ne nécessite pas une succession de confirmations. Pour un livre contenant des données, un choix est nécessaire parce que les conséquences diffèrent :

| Choix | Ce qui disparaît de la bibliothèque active | Ce qui reste conservé |
|---|---|---|
| Retirer le livre, garder mes recettes | La fiche de livre dans la collection active | Recettes, édition et sources archivées nécessaires à leur attribution |
| Mettre le livre et ses recettes dans la corbeille | Le livre et les recettes concernées par ce groupe | Versions, traductions, pages, photos et historique, restaurables selon le groupe |
| Annuler | Rien | Tout reste en place |

Le dialogue montre des **comptages calculés**, pas des valeurs de démonstration : recettes complètes, références, pages et imports actifs concernés. Il explique aussi les éléments partagés ou conservés. Les anciennes cuissons et les repas passés restent lisibles.

Pour la première version, ne pas mettre en place de purge automatique. Une durée de conservation ne doit apparaître que si le mécanisme correspondant existe et est vérifiable.

### 8.2 Modèle minimal proposé

Un champ optionnel comme `trashed_at` sur les recettes et éditions peut constituer le premier modèle. **C’est une proposition nouvelle.** L’absence du champ signifie actif. Un identifiant d’opération de groupe peut faciliter la restauration d’un livre avec ses recettes; le choix exact doit être spécifié avant l’implémentation. Restaurer le groupe ne restaure que les objets retirés par cette opération : ni les recettes déjà dans la corbeille auparavant, ni celles retirées indépendamment ensuite. Il faut conserver l’état antérieur utile et définir la règle de concurrence; un identifiant de groupe seul ne suffit pas.

Ne pas réutiliser `availability`, le statut d’import ou le `deleted_at` des tombales de synchronisation. Ces états ont d’autres significations. Une tombale serveur qui conduit à supprimer physiquement la ligne locale n’est pas une corbeille utilisateur.

La mise à la corbeille doit :

1. Relire les objets concernés et vérifier les traitements concurrents.
2. Écrire les marqueurs et la capture de synchronisation dans la même transaction locale appropriée.
3. Retirer les objets des recherches ordinaires, de la redécouverte et des choix pour un nouveau repas.
4. Garder les références nécessaires aux anciens repas, historiques et sources.
5. Afficher le succès après réussite de l’écriture locale; en cas d’échec, laisser l’objet utilisable et expliquer le résultat.

Une recette dans la corbeille peut encore être visible depuis un ancien repas avec une mention et une action Restaurer. La disparition de la bibliothèque ne doit pas casser la consultation d’un repas passé.

### 8.3 Règle de concurrence indispensable

**Modifier ne restaure jamais implicitement.** Les enregistrements ordinaires doivent préserver le cycle de vie courant et refuser un objet retiré. La restauration est une commande explicite. Cela couvre l’éditeur ouvert, les imports tardifs, les repères, les changements de photo et les appareils qui reviennent hors ligne.

Le serveur peut transporter un champ JSON supplémentaire, mais les mises à jour actuelles remplacent les données complètes. Un ancien client peut ignorer le marqueur dans ses listes ou l’effacer lors d’une réécriture. La compatibilité doit donc être assurée par un protocole de version, une règle serveur ou un autre mécanisme démontré. **Ajouter le champ dans l’interface seule ne garantit pas une corbeille multiappareil.**

Le choix de conflit doit être documenté : une édition ancienne ne gagne pas silencieusement contre une mise à la corbeille; une restauration volontaire doit être distinguable d’un enregistrement ordinaire. Tester la convergence avant d’annoncer cette garantie.

### 8.4 Utiliser les transactions existantes correctement

Le dépôt dispose de `saveBatch` avec fusions conditionnelles, de `transitionner` avec statut attendu et mutations associées, et de `removeBatch` pour des suppressions avec gardes. Le bas niveau `db.mutate` sait effectuer des mutations mixtes.

Pour une simple mise à la corbeille, une fusion conditionnelle peut convenir. Pour une opération plus complexe sans transition naturelle, créer une primitive métier limitée au-dessus du dépôt. Ne pas contourner les états d’import pour entrer artificiellement dans `transitionner`, ni appeler `db.mutate` depuis chaque écran.

Une transaction IndexedDB garantit l’unité **locale**. Les lots de synchronisation sont fractionnés et reçus par tables; cela ne donne pas automatiquement une unité globale à une grande cascade sur plusieurs appareils. Le modèle réversible réduit la nécessité de détruire tout un graphe d’un coup.

### 8.5 Les fichiers demandent trois commandes différentes

- **Retirer une photo de la recette :** retirer le lien, sans présumer que les octets ne servent plus ailleurs.
- **Libérer la copie locale :** récupérer de l’espace après avoir vérifié la copie distante et sa qualité. Le code envoie par défaut une copie réduite quand la réduction s’applique; pouvoir retélécharger cette copie ne permet pas de retrouver l’original supprimé. Proposer de conserver, sauvegarder ou envoyer l’original avant de le libérer.
- **Supprimer définitivement un fichier inutilisé :** vérifier toutes les références, les corbeilles, les historiques, les opérations en cours et les règles de synchronisation.

Réutiliser `referencesFichiers` dans `src/sync/fichiers.js`. Les images sont partagées par empreinte SHA-256; une photo peut être couverture, photo de recette et souvenir de cuisson. Le registre des relations d’archive ne contient volontairement pas tous ces liens souples.

### 8.6 La purge définitive : un lot ultérieur

Avant une purge, produire un plan de conséquences : objets retirés, historiques conservés, références à détacher, sources nécessaires à d’autres versions et fichiers candidats. Revalider au moment d’écrire. Ne jamais interpréter « tout ce qui est accessible depuis cette recette » comme « tout ce qu’il faut détruire ».

La purge doit couvrir notamment `parent_version_id`, `provenance.derived_from`, les substitutions, les sessions multi-recettes, les minuteurs, les repas, les listes et les liens depuis des versions conservées. Son annulation ne peut pas être promise si les fichiers ont effectivement été détruits.

## 9. Modifier une recette ou un livre sans recommencer

### 9.1 Un point d’entrée, plusieurs sections

**Modifier la recette** ouvre un espace organisé en Informations, Ingrédients, Préparation, Photos et Sources. Chaque section peut aussi être ouverte depuis son contexte. La version et la source restent visibles.

| Type de changement | Comportement cible |
|---|---|
| Corriger un titre affiché ou une catégorie | Modification de métadonnées, sans fabriquer une nouvelle méthode culinaire |
| Corriger une erreur OCR dans une quantité | Correction attribuée et traçable, avec l’original consultable |
| Changer les ingrédients ou la méthode pour soi | Nouvelle variante clairement nommée |
| Traduire fidèlement | Traduction liée à la version exacte, sans changement culinaire |
| Adapter au Thermomix | Nouvelle version avec contrat et réglages contrôlés |
| Remplacer une image source | Nouvelle révision de source; ne pas réécrire le passé |

Le choix entre correction et variante ne doit pas être un examen technique. Expliquer avec des verbes : « Corriger une erreur de lecture » et « Créer ma version ». Préremplir à partir de la version sélectionnée et garder un résumé des changements.

### 9.2 Éditeur de recette

Sur ordinateur, garder source et correction côte à côte. Sur téléphone, alterner Source et Modification sans perdre la position ou le champ actif. La source peut s’agrandir, se tourner et être consultée à la page utile.

Pour chaque ingrédient : quantité, unité, nom et préparation, avec accès au texte original. Une ligne incertaine peut être corrigée sans dérouler toute la recette. Les boutons Ajouter une ligne et Ajouter un groupe sont distincts.

Pour les étapes : un bloc par étape, texte multiligne, déplacement et commandes Monter/Descendre. Le glisser-déposer reste facultatif. Ajouter ou retirer une étape ne doit pas réaffecter les traductions existantes sans contrôle.

Le rendement conserve son texte original et son unité : portions, pièces, pains, pots, etc. Une valeur « 50 » ne devient pas automatiquement 50 personnes. Les conversions dépendent des données vérifiées et des conventions existantes.

### 9.3 Brouillons et sauvegarde

Le code actuel utilise une sauvegarde explicite. Ajouter un brouillon local durable est pertinent, à condition de distinguer **brouillon enregistré sur cet appareil** et **version enregistrée dans la bibliothèque**.

Un brouillon ne doit pas marquer des ingrédients comme vérifiés, synchroniser une version incomplète comme définitive ou déclencher une requête IA. À la reprise, comparer sa base avec la recette actuelle et proposer une résolution si elle a changé.

Quitter un formulaire modifié doit soit préserver un brouillon, soit demander un choix clair. Une fermeture de dialogue par Échap, retour mobile ou clic extérieur ne doit pas effacer silencieusement la saisie.

### 9.4 Éditeur de livre

Réunir titre, auteur, langue, édition, ISBN, couverture et notes dans un même espace. La couverture peut se modifier directement depuis cet espace. Conserver la stratégie actuelle qui fusionne les seuls champs réellement changés, plutôt que réécrire toute une édition depuis un écran ancien.

Séparer les informations bibliographiques du contenu numérisé. Ajouter des pages n’exige pas de modifier le titre ou l’ISBN; corriger l’auteur n’exige pas de relire l’index.

## 10. Ajouter et gérer les pages d’index

### 10.1 Le parcours principal

1. Ouvrir le livre et choisir **Ajouter des pages d’index**.
2. Photographier ou sélectionner plusieurs images; le livre est déjà choisi.
3. Vérifier ordre, orientation et lisibilité; retirer une image accidentelle.
4. Lancer la lecture des pages sélectionnées avec son besoin de connexion et son coût éventuel clairement indiqués.
5. Consulter un bilan : nouvelles entrées, déjà présentes, compléments, ambiguïtés et échecs.
6. Résoudre les ambiguïtés restantes, puis revenir dans le livre avec un résumé de ce qui a changé. Conserver l’enregistrement automatique actuel des références certaines et des compléments après lecture : ne pas ajouter une validation générale inutile. Une référence enregistrée ne devient pas pour autant une recette complète relue.

Le moteur existant sait déjà reprendre des lectures partielles et consolider les entrées. La refonte doit améliorer ce parcours sans perdre ses protections contre le double clic, les conflits et l’écrasement des recettes complètes.

### 10.2 Gestion des pages

Chaque page montre sa miniature, son ordre de capture, sa page imprimée lorsqu’elle est connue, son type et son état de lecture. Les opérations sont Ajouter, Remplacer la photo, Tourner, Relire et Retirer. Leur effet doit être explicite : retirer une photo de la sélection n’est pas supprimer toutes les recettes qui en proviennent.

Conserver séparément **position dans le fichier**, **ordre de capture** et **numéro imprimé**. Un PDF peut avoir des pages préliminaires non numérotées; un index peut renvoyer à plusieurs pages non consécutives.

### 10.3 Compléter un index existant

Le comportement par défaut est l’ajout et le complément, pas le remplacement global. Une entrée absente d’une nouvelle photographie n’est pas une preuve qu’elle doit disparaître du livre.

Les doublons se comparent avec le livre, l’édition, le titre normalisé et les pages, tout en conservant les rubriques. Deux recettes de même titre sur des pages différentes peuvent être distinctes. Les corrections personnelles, favoris et recettes complètes ne doivent pas être supprimés au nom du nettoyage de l’index.

Une action Remplacer tout l’index, si elle devient nécessaire, doit être séparée et présenter un diff compréhensible : ajouts, modifications et retraits proposés.

### 10.4 Révision des sources

Le résultat OCR doit enregistrer l’identité de la révision lue. Une nouvelle image ou une transformation qui change l’image envoyée ne peut pas hériter automatiquement de la validation précédente. Une réponse tardive portant sur l’ancienne image reste liée à cette ancienne image.

Proposition : conserver les révisions immuables et lier les lectures et versions à ces révisions. Définir la migration des anciennes pages avant de changer les références. Les documents déjà reliés par `replaces_document_id` sont une base utile, pas un historique complet à supposer acquis.

### 10.5 PDF et EPUB

Le code conserve des PDF et EPUB comme documents, mais l’OCR d’index identifié travaille sur des pages image. **Accepter un PDF ne prouve pas que toutes ses pages sont automatiquement lisibles par ce parcours.**

À court terme, rendre la limite explicite et fournir un chemin utile vers des images ou la saisie manuelle. À terme, proposer un sélecteur de pages PDF avec vignettes et rasterisation des seules pages choisies, en préservant leur numéro dans le fichier et leur numéro imprimé. Ne pas charger systématiquement un livre entier en mémoire ni facturer une lecture de toutes ses pages.

## 11. Import web, photos et qualité de lecture

### 11.1 Un point d’entrée simple, des traitements adaptés

Le bouton Ajouter propose lien, photos, PDF, texte, livre et saisie manuelle. La détection peut faciliter le choix après sélection, mais l’utilisateur garde le contrôle du type de contenu : recette, index ou couverture.

Pour un lien web, conserver le chemin déterministe qui exploite les données structurées Recipe. Dans le code serveur examiné, ce chemin peut fonctionner avec **zéro appel au modèle**. Si les données manquent, le parcours assisté devient pertinent. Éviter de transformer tous les imports en génération IA systématique.

### 11.2 États d’import compréhensibles

Les états affichés doivent refléter une opération réelle : fichiers reçus, lecture en cours, résultat à relire, enregistrement terminé ou échec reprenable. Un pourcentage ne doit être utilisé que si le dénominateur est connu; « 2 pages sur 4 » est plus honnête qu’une barre qui avance arbitrairement jusqu’à 95 %.

L’import garde sa source, ses résultats partiels et une reprise. L’utilisateur peut quitter la vue si le traitement le permet, mais l’interface ne doit pas prétendre que le navigateur continuera indéfiniment après fermeture. Au retour, distinguer traitement actif, interrompu et terminé.

Les transitions réelles de `import-cible.js` sont fermées. Ne pas passer un import en cours à `ignore` si cette transition est interdite. Expliquer le blocage et proposer d’ouvrir ou d’arrêter le traitement selon un mécanisme prévu.

### 11.3 Groupes d’ingrédients

Le parseur actuel traite une ligne comme « For the sourdough starter » comme un ingrédient à vérifier. Il faut un modèle permettant un **titre de groupe** distinct d’une ligne consommable.

Cette évolution touche l’extraction, le validateur, l’éditeur, l’affichage, les traductions, le calcul de portions, les courses, les substitutions et les contrôles alimentaires. Ajouter seulement `is_heading` dans un prompt ne suffit pas si le validateur retire le champ ou si les autres fonctions le traitent comme un aliment.

Le titre de groupe reste fidèle à la source, peut être traduit et ne part pas dans la liste de courses. Une action Transformer en titre de groupe permet la correction. Des heuristiques peuvent proposer un classement, mais « Sauce soja », « Pâte miso » et « Levain » restent des ingrédients possibles.

### 11.4 Vérification sans bruit permanent

Montrer un résumé « 6 lignes à relire » avec accès direct aux lignes concernées. Conserver les indices d’incertitude là où ils aident à décider. Masquer un détail n’équivaut jamais à valider une donnée.

La vérification groupée concerne uniquement une sélection explicite montrée à l’écran. Les identités d’ingrédients ambiguës ne doivent pas devenir certaines parce que l’utilisateur a confirmé le titre de la recette.

### 11.5 Doublons

Les protections existantes normalisent les URL et comparent certains titres/pages. Les améliorer avec **Ouvrir l’existante**, **Comparer** et **Garder les deux**. Une ressemblance n’autorise pas une fusion automatique des variantes.

Tester les créations concurrentes depuis deux onglets et deux séances. Un contrôle fait sur une liste chargée avant l’opération ne garantit pas l’unicité au moment de l’écriture. Le résultat attendu doit être défini avant d’ajouter des contraintes ou de fusionner des objets.

### 11.6 Photos

Séparer photo du plat, page de recette et couverture. Une image choisie sur le web conserve sa provenance; une illustration générée éventuelle doit être clairement identifiée et ne doit jamais remplacer l’original documentaire.

Réduire les dimensions pour les vignettes lorsque c’est utile, tout en gardant une source lisible pour la comparaison. Gérer explicitement image absente, référence distante, téléchargement, décodage impossible et fichier remplacé. Une extension HEIC acceptée ne prouve pas que chaque navigateur saura la décoder.

## 12. Français simple, versions et assistant

### 12.1 Définition produit

« Français simple » doit vouloir dire : **la recette entière est lisible en français clair, avec ses quantités, durées, températures, étapes, conditions et avertissements conservés**. Ce n’est ni un résumé ni une adaptation culinaire.

Les trois fonctions actuelles restent distinctes : langue de l’interface via `t()`, repères du plat dans `recipes.reperes`, traduction d’une version dans `recipe_translations`. Changer la langue des menus ne traduit pas une recette.

### 12.2 Parcours cible

- Choix de lecture Français / Original près de la recette.
- Si une traduction compatible existe, elle devient le texte principal; l’original reste accessible.
- Sinon, action explicite Traduire en français, avec indication de connexion et de coût éventuel.
- Une proposition incomplète affiche les segments manquants à leur place, sans déplacer les autres.
- Corriger la traduction ouvre les segments concernés.
- Le mode cuisine et la lecture à voix haute utilisent la même langue que celle affichée.

Le code stocke déjà une langue dans la session de cuisine, mais le rendu examiné emploie encore le texte original des étapes et la langue originale pour la voix. Cette incohérence doit être corrigée avec le contrat global de traduction, pas par une rustine indépendante dans `cook.js`.

### 12.3 Protéger les associations

Une traduction appartient à une version précise. Les ingrédients et étapes d’une nouvelle version peuvent recevoir de nouveaux identifiants; ne pas réappliquer l’ancienne traduction par simple numéro de ligne.

À court terme, préserver les tableaux positionnels sans filtrage et éditer chaque segment séparément. À moyen terme, adopter une correspondance par identifiant avec une version de format et un lecteur compatible des données anciennes. Les traductions déjà ambiguës demandent une vérification; leur réparation ne peut pas être garantie automatiquement.

### 12.4 Réutiliser les repères existants

Le domaine des repères possède déjà une signature de source, une distinction courant/périmé/invalide et des contrôles d’enregistrement. Le critère Rapide tient compte d’une recette complète, de durées connues et des attentes. Préserver ces garanties.

Sur les cartes, ne montrer que les repères connus et utiles. Dans la fiche ou l’éditeur, proposer Compléter les informations. Pour une bibliothèque ancienne, offrir une préparation à la demande ou un lot choisi, avec bilan et budget; ne pas générer silencieusement des descriptions pour tout le catalogue.

### 12.5 Contrôles de qualité de l’assistant

| Contrôle | Ce qu’il peut vérifier | Ce qu’il ne prouve pas seul |
|---|---|---|
| Schéma de réponse | Champs, types, structure, références | Fidélité culinaire |
| Comparaison des nombres/unités | Nombres manquants ou modifiés, conversions suspectes | Bonne association d’un nombre au bon ingrédient |
| Couverture des segments | Chaque ingrédient/étape source possède un résultat ou un manque explicite | Qualité du sens |
| Version et signature | La proposition correspond à la bonne source | Exactitude du contenu proposé |
| Exemples bilingues relus | Erreurs de vocabulaire, omissions, contresens | Garantie universelle pour toutes les recettes |
| Essai de cuisine | Comportement observé pour une recette et des quantités données | Validité de toutes les variantes |

Prévoir refus, reprise et conservation partielle. Un bloc de traduction invalide ne doit pas jeter une extraction correcte déjà obtenue. Les quantités structurées doivent être préservées autant que possible plutôt que réécrites librement.

### 12.6 Regrouper les appels : expérience, pas promesse

Après correction des données, un orchestrateur peut demander extraction, traduction et repères ensemble lorsque le parcours le justifie. Chaque bloc garde ses validations et sa possibilité de reprise. L’application attribue les identifiants et calcule les signatures; le modèle ne les rend pas fiables en les imprimant.

Comparer séparément nombre d’appels au service, appels au modèle, jetons, coût, latence, erreurs et corrections humaines. Conserver l’import JSON-LD sans modèle. Le gain « divisé par deux » n’est pas établi dans ce dossier.

## 13. Mode cuisine : fiable, lisible et facile à reprendre

### 13.1 Corriger le DOM et le CSS ensemble

La grille desktop actuelle est neutralisée par une règle CSS, mais son conteneur n’a aussi qu’un enfant principal. Créer deux zones réelles : ingrédients et étape. Sur grand écran, elles sont côte à côte. Sur téléphone, l’étape reste principale et les ingrédients s’ouvrent sans quitter la session.

Conserver l’état d’ouverture des ingrédients entre les étapes. Afficher les portions réellement utilisées. Une photo du plat reste secondaire pendant l’exécution; une note personnelle comme « La dernière fois, 5 minutes de moins » peut être beaucoup plus utile.

### 13.2 Quantités au moment de l’action

Lorsque l’association est fiable, toucher un ingrédient cité dans une étape peut montrer sa quantité et sa préparation, comme dans Crouton. [S04] C’est une amélioration à introduire progressivement : une simple correspondance textuelle peut confondre le beurre de la pâte et celui de la sauce. En cas d’ambiguïté, ouvrir la liste du groupe concerné plutôt qu’afficher une quantité avec une certitude injustifiée.

La conversion de portions doit préserver les garde-fous existants, notamment les quantités pour lesquelles une adaptation TM7 a été préparée. Une portion inconnue ne devient pas 1 par commodité d’interface.

### 13.3 Minuteurs persistants

Créer une zone Minuteurs de la session indépendante du panneau d’étape. Chaque minuteur porte un nom de recette et de tâche, une durée exacte ou une plage, un instant de référence et son état.

Les parcours actuels vers Siri/Raccourcis sont utiles. Siri doit être sollicité par la personne : l’application affiche une phrase, elle ne déclenche pas Siri. Utiliser des états précis comme À demander à Siri, Ouverture de Raccourcis demandée et Miroir indicatif. Il n’existe pas de confirmation automatique d’Horloge dans ce parcours. Un miroir qui atteint zéro ne prouve pas que l’alarme système a sonné.

À la reprise, recalculer à partir des horodatages. Ne pas compter sur le nombre de déclenchements de `setInterval`. Les navigateurs ralentissent les onglets inactifs, et un service worker n’est pas une tâche permanente. [S21], [S25]

### 13.4 Écran allumé, voix et clavier

Ajouter une option Garder l’écran allumé avec Screen Wake Lock lorsqu’il est disponible. Gérer refus, libération par le système, retour au premier plan et sortie du mode cuisine. WebKit documente cette capacité pour les applications web de l’écran d’accueil depuis iOS/iPadOS 18.4; cela ne remplace pas un essai sur les appareils visés. [S19], [S20]

La lecture à voix haute existe. Aligner son texte et sa voix avec la langue sélectionnée, et arrêter proprement la lecture en quittant ou en changeant d’étape. Les commandes vocales de reconnaissance restent un chantier distinct, dépendant du navigateur et de l’environnement sonore. Elles ne doivent pas être nécessaires pour cuisiner.

Des raccourcis Précédent/Suivant peuvent aider sur ordinateur. Ils doivent s’appliquer seulement au mode cuisine actif et ne pas intercepter un champ, un bouton, un dialogue ou une saisie en composition.

### 13.5 Le plan commun doit dire ce qu’il sait

Le plan actuel regroupe les étapes par recette. Il ne calcule pas encore un horaire optimal vers l’heure de service. Une minuterie de dix minutes ne signifie pas automatiquement dix minutes libres : on peut devoir remuer ou surveiller.

Avant de proposer un vrai rétroplanning, distinguer travail actif, cuisson surveillée, attente passive et durée inconnue. Associer les besoins aux appareils réels. Une température TM7 de 100 °C n’est pas une température de four; deux températures différentes ne prouvent pas un conflit sans chevauchement sur le même appareil.

À court terme, préférer « Températures à vérifier » lorsqu’il s’agit d’une heuristique. À terme, construire les dépendances et créneaux avec possibilité de correction humaine. Un horaire incomplet doit rester une estimation, pas une précision fabriquée.

## 14. Repas, courses, inventaire et carnet personnel

### 14.1 Simplifier les repas existants

Les repas savent déjà contenir plusieurs recettes, adapter certaines quantités, produire une liste commune et démarrer une session. Mettre en évidence **Ajouter un plat**, **Voir mes courses**, **Cuisiner ensemble** et **Refaire ce repas**.

La vue Ma semaine actuelle est surtout une liste. Un regroupement simple par jour peut suffire avant un calendrier complexe. Une section **À cuisiner bientôt**, sans date obligatoire, répond à un besoin différent du planning : garder une envie sans organiser immédiatement un rendez-vous. AnyList a explicitement développé cette approche dans sa mise à jour du 1er janvier 2026. [S05]

### 14.2 Courses

Préserver le moteur de regroupement par identité vérifiée et unités compatibles. Ne pas additionner masse et volume sans conversion fondée; garder le détail par recette quand une somme n’est pas justifiée.

Améliorations proposées :

- Affichage Encore à acheter et Acheté, sans perte des cases au changement de vue.
- Ajout d’une ligne libre et classement par rayon, modifiable.
- Commandes Copier et Partager reposant sur la même préparation des données.
- Choix entre liste complète et éléments restants.
- Retour direct vers le repas et la recette à l’origine d’une ligne.

Une vraie liste collaborative nécessite un contrat de synchronisation et de conflit; partager un texte ne donne pas ces propriétés.

### 14.3 Inventaire

**Formulaire cible :** demander d’abord **Quoi, Combien, Où**. Recette source, qualité, réchauffage et notes deviennent des détails facultatifs. Le formulaire actuel présente déjà ces champs supplémentaires. Ajouter Modifier et Annuler après Consommé; harmoniser cette annulation avec les règles de données durables.

Clarifier quantité initiale et quantité restante. Le code décrémente des portions sans nécessairement réviser le texte libre de quantité; « 3 portions » ne doit pas cohabiter avec une ancienne mention « 4 portions » sans explication. Ne pas déduire une masse restante au gramme près si la donnée n’est pas structurée.

Une date choisie par l’utilisateur doit rester une date civile et être présentée comme telle. Elle ne constitue pas une évaluation automatique de la durée de conservation. L’origine utilisateur déjà enregistrée est utile.

### 14.4 Après cuisson

Le carnet existe déjà : note, photo, temps réel, portions et envie de refaire. Le rendre léger : **À refaire ?**, **Une chose à retenir**, photo facultative. Les détails restent disponibles pour les recettes qui le méritent.

Ajouter ensuite « Il reste… » avec proposition d’enregistrer un lot au frigo ou au congélateur. L’utilisateur confirme les quantités et les ingrédients épuisés. Ne pas retirer automatiquement de l’inventaire toutes les quantités théoriques d’une recette.

Sur la fiche suivante, faire remonter une information utile : « La dernière fois : moins de sel, cuisson 8 minutes ». Elle doit rester attachée à la cuisson et à la version concernées.

### 14.5 Fonctions supplémentaires à considérer

| Idée | Valeur pour Neegan | État ou ordre recommandé |
|---|---|---|
| À cuisiner bientôt, sans date | Conserver les envies avec presque aucune saisie | Proposition après gestion de bibliothèque |
| Recherches enregistrées | Retrouver « rapide + poisson + disponible » | Extension des filtres, après persistance de leur état |
| Index d’abord, recette à la demande | Exploiter les livres sans tout scanner | Capacité centrale déjà engagée; améliorer sa découverte |
| La dernière fois… | Retenir les ajustements qui ont réellement marché | S’appuyer sur le carnet existant |
| Menu réutilisable | Refaire un souper réussi avec les bons plats | Améliorer Refaire ce repas, puis ajouter des modèles si utile |
| Préparer ce repas hors ligne | Cuisiner sans dépendre du réseau | Nouveau contrôle de disponibilité, sur le socle existant |
| Comparer deux variantes | Choisir original, correction ou Thermomix | Après clarification des versions et traductions |
| Repas selon ce qui reste | Réduire la recherche et utiliser l’inventaire | Propositions expliquées; aucune quantité supposée disponible |
| Comparaison avant fusion de doublons | Nettoyer la bibliothèque sans perdre les adaptations | Après corbeille et règles de provenance |
| Export lisible d’une recette et de ses notes | Réutiliser ses données ailleurs | Réutiliser les exporteurs, compléter selon les formats réellement supportés |

Je reporterais un fil social, une génération automatique massive de menus, un contrôle vocal complet et une télécommande Thermomix. Ils ajoutent beaucoup de surface avant de résoudre les gestes qui gênent déjà Neegan.

## 15. Thermomix et Cookidoo : ce qui est possible et ce qu’il faut tester

### 15.1 Dans Mistu aujourd’hui

L’export contient une adaptation TM7 par sélection d’étapes, un profil de capacités limité, des validations structurées, une comparaison et la création d’une version. Il contient aussi une page qui copie titre, ingrédients, étapes ou texte complet pour la saisie dans Cookidoo, avec solution de repli si le presse-papiers n’est pas disponible.

Le profil logiciel actuel vise le TM7 Amérique du Nord 120 V avec un ensemble volontairement restreint de modes et de réglages. **Ces limites décrivent le contrat de Mistu, pas toutes les capacités physiques du TM7.** Les élargir demande une spécification, des sources constructeur et des essais; pas simplement une liste de températures plus longue.

Le parcours actuel devrait être présenté ainsi : **Préparer une adaptation TM7 → Comparer et garder → Copier pour Cookidoo**. Ne pas afficher Connecté au Thermomix pour une fonction de copie.

### 15.2 Ce que documente l’écosystème officiel

| Capacité | Fait documenté au 29 octobre 2026 | Conséquence |
|---|---|---|
| Recipe Handover | Bluetooth pour la proximité, Internet pour les données; documentation technique limitée aux recettes officielles | Ne pas assimiler cet envoi immédiat aux créations personnelles [S26] |
| Created Recipes | Création/import/édition dans Cookidoo; page canadienne annonçant jusqu’à 100 créations avec abonnement actif | Vérifier compte, quota et parcours réel de Neegan [S27] |
| Créations sur TM7 | Synchronisation des recettes créées documentée séparément | Une création peut rejoindre la bibliothèque sans relever du même Handover [S28] |
| Remote Monitoring | Suivi des étapes longues d’au moins trois minutes avec Cookidoo 3.0; état, temps restant et arrêt du signal | Le suivi ne donne pas la modification distante des réglages de cuisson [S29] |
| Région canadienne | `cookidoo.ca` rattaché à la région technique United States dans la documentation | Un essai français ne valide pas la compatibilité du compte canadien [S31] |
| Firmware TM7 | Historique 2026 publié, avec différences de fonctions et de versions | Lire la version installée; ne pas annoncer une fonction décrite au futur comme livrée [S32] |

### 15.3 Comment les applications tierces semblent y parvenir

| Solution | Ce que la source primaire décrit | Ce qu’on ne peut pas en déduire |
|---|---|---|
| Dlishe | Conversion de recette, vérification puis création dans Cookidoo; conditions décrivant compte connecté ou compte Dlishe avec lien temporaire | Pas de preuve d’un contrôle matériel direct ni d’une API publique partenaire [S33], [S34] |
| Dlishe, confidentialité | Déclaration de conservation chiffrée des identifiants Cookidoo pour les actions demandées | Le protocole d’intégration exact n’est pas publié; ce n’est pas une architecture à recopier aveuglément [S35] |
| Bananarium | Adaptation et ouverture dans Cookidoo; absence de contrôle de l’appareil annoncée | Pas de validation de disponibilité canadienne ou de tous les réglages [S36] |
| Home Assistant | Listes de courses, calendrier et informations d’abonnement | Pas une télécommande de cuisson [S37] |
| Clients communautaires Cookidoo/MCP | Interfaces non officielles, créations annoncées par certains projets, suivi push décrit par un client | Fonctions non testées ici, dépendantes de protocoles pouvant changer [S38], [S39] |

**Conclusion de recherche :** aucune documentation d’API publique officielle ouverte à tous les développeurs tiers n’a été trouvée. Cela ne prouve pas l’absence d’accords privés. Un flux OAuth présent dans un client communautaire ne transforme pas ce client en intégration officielle.

### 15.4 Améliorer d’abord l’export manuel

- Afficher la variante et les quantités exactes à exporter.
- Proposer Copier puis Champ suivant, avec progression facultative des champs copiés.
- Garder un bouton vers l’éditeur officiel et un texte sélectionnable en repli.
- Distinguer Copié de Enregistré dans Cookidoo; la copie ne permet pas de connaître le résultat sur l’autre site.
- Montrer les réglages qui devront être saisis ou vérifiés manuellement.
- Conserver la trace de la version préparée, sans affirmer qu’elle a été cuisinée ou reçue par l’appareil.

### 15.5 Prototype de passerelle, séparé de la refonte

Une future expérience doit démontrer, sur une seule recette personnelle, la création dans le compte canadien, la conservation des ingrédients/étapes, le traitement des réglages et la visibilité réelle sur le TM7. Aucun besoin de synchroniser toute la bibliothèque pour apprendre si ce parcours fonctionne.

Critères de sortie :

1. Région, abonnement, modèle et firmware explicitement identifiés.
2. Une création unique malgré double clic, réseau interrompu et nouvelle tentative, si le protocole fournit une idempotence ou une réconciliation démontrée. Sinon, afficher Résultat à vérifier après une coupure et vérifier la création distante avant de réessayer; aucune relance aveugle.
3. Quantités, unités, étapes et accessoires comparés à la version source.
4. État de résultat précis, avec lien vers la création quand il existe.
5. Déconnexion et révocation effectives; aucun secret dans le code client, le journal ou l’archive.
6. L’échec du connecteur ne bloque jamais la recette locale et l’export manuel.
7. Les limites et la dépendance à une interface non officielle sont documentées avant généralisation.

Ne pas demander ni stocker des identifiants Cookidoo dans le cadre de cette revue. Le choix d’authentification sera une décision du prototype après examen des mécanismes réellement disponibles.

### 15.6 États proposés pour une connexion future

Préparée dans Mistu, création demandée, créée dans Cookidoo et état appareil reçu sont des faits différents. Le dernier état n’apparaît que si un mécanisme réellement validé fournit une observation de l’appareil; il n’est jamais déduit d’une création Cookidoo. Ajouter alors sa date de réception. Une perte de connexion ne signifie pas cuisson terminée. Supprimer une recette dans Mistu ne doit pas supprimer silencieusement sa copie Cookidoo.

Le suivi à distance reste indépendant de l’export. Le pilotage de chauffe ou de moteur n’est pas une promesse de ce plan.

## 16. Animations et accessibilité : de la présence, sans gêner la lecture

### 16.1 Ce que les interfaces récentes apportent d’utile

Les références Apple et Material mettent l’accent sur le mouvement intentionnel, la continuité entre états et la hiérarchie. Material 3 Expressive a fait évoluer ses recommandations en 2025; cela ne signifie pas qu’une application de cuisine doive rebondir à chaque interaction. [S14], [S15]

Le modèle liste–détail adaptatif est particulièrement pertinent : plusieurs panneaux quand l’espace le permet, un seul sur petit écran, avec préservation de l’état. Il s’agit d’un principe de conception applicable au web, pas d’une obligation d’utiliser les composants Android. [S12]

### 16.2 Plan de mouvement proposé

Les durées ci-dessous sont des **valeurs initiales de design à essayer**, pas une norme ni une mesure d’usage.

| Action | Mouvement | Durée initiale | Condition |
|---|---|---|---|
| Favori ou case cochée | Changement de couleur et petite variation d’échelle facultative | 120–180 ms | L’état reste compréhensible sans animation |
| Panneau d’actions | Apparition courte avec faible déplacement | 160–220 ms | Focus immédiatement utilisable |
| Ouverture d’une recette | Continuité discrète de carte vers fiche | 180–250 ms | Seulement si le rendu et la navigation restent stables |
| Mise à la corbeille | Retrait court et réorganisation | 160–220 ms | Après réussite locale, avec Annuler |
| Changement d’étape | Transition courte dans la zone principale | 160–240 ms | Ne pas déplacer les minuteurs ou perdre le focus |
| Réorganisation de pages | Déplacement cohérent des miniatures | Selon geste | Alternative Monter/Descendre disponible |
| Import | Affichage des résultats réellement disponibles | Sans attente artificielle | Aucune progression simulée |

Éviter animation permanente, grandes parallaxes, compteurs qui roulent à chaque seconde, effet de verre sous du texte dense et transitions qui retardent l’action.

### 16.3 Réalisation adaptée au code

CSS suffit pour les petits changements d’état. View Transitions peut enrichir certains changements de vue avec détection de capacité et repli immédiat. Les fonctionnalités annexes et navigateurs ne sont pas tous équivalents; ne pas conditionner la navigation au succès d’une animation. [S16]

Le code dispose déjà d’une règle `prefers-reduced-motion`. L’étendre aux animations déclenchées en JavaScript et aux changements de préférence pendant la session. Ne pas ajouter Motion for React à une application qui n’utilise pas React. Une bibliothèque n’est justifiée que par un besoin mesuré que les mécanismes natifs ne couvrent pas simplement.

Pour les menus/dialogues, préférer les primitives et helpers déjà présents lorsqu’ils répondent au besoin. Les nouvelles API de fermeture ou de positionnement peuvent être des améliorations progressives; elles ne doivent pas devenir une dépendance sans solution de repli. Plusieurs menus de cartes ne doivent pas partager une ancre ambiguë.

### 16.4 Accessibilité à compléter

Les styles de focus, les zones tactiles, les dialogues natifs, les zones sûres et les annonces de toast constituent une base à conserver.

- Ajouter `aria-current` à la destination principale active.
- Utiliser des boutons à état pressé pour des filtres, ou implémenter entièrement les vrais onglets avec relations et clavier; éviter un `tablist` incomplet.
- Donner un nom accessible aux dialogues et un label aux champs.
- Après suppression, placer le focus sur un élément utile; après navigation, permettre d’identifier le nouveau contenu.
- Rendre toutes les actions disponibles sans survol, sans glisser et sans animation.
- Vérifier contraste, zoom texte, défilement et absence de commandes cachées derrière le clavier.
- Garder Annuler assez accessible et proposer la corbeille comme recours durable, sans dépendre d’un toast éphémère.

Le W3C documente notamment l’alternative aux mouvements de glisser. [S18] Les objectifs de taille, de contraste et de comportement doivent être vérifiés sur le rendu réel; le présent document ne certifie pas une conformité WCAG complète.

## 17. Hors ligne, synchronisation, photos et mises à jour

### 17.1 Ce qui fonctionne déjà comme architecture

L’application utilise IndexedDB, un service worker et une synchronisation avec Supabase. Les fichiers sont des blobs identifiés par empreinte; leurs octets sont déjà pris en charge par le code de synchronisation. Certains passages historiques du README disent le contraire : ils doivent être mis à jour.

Ne pas construire une seconde synchronisation pour la corbeille, les photos ou les traductions. Étendre les chemins existants et leurs protections de compte.

### 17.2 Dire ce qui est réellement enregistré

Un enregistrement local, une ligne synchronisée et des octets téléchargés sont trois étapes différentes. La pastille de modifications en attente ne prouve pas que toutes les photos sont disponibles sur un autre appareil.

Proposer un détail simple : contenu enregistré ici, changements à envoyer, fichier à télécharger, téléchargement en cours ou image non décodable. Les diagnostics techniques plus longs appartiennent aux réglages, avec une action Copier le diagnostic expurgée des secrets.

Le message Synchronisé ne doit être utilisé qu’avec un périmètre clair. Pour une recette, préciser si cela couvre seulement la fiche ou également les médias sélectionnés.

### 17.3 Préparer un repas hors ligne

La commande vérifie les recettes, versions, traductions utilisées, photos et pages sources choisies. Elle télécharge les éléments manquants puis affiche un bilan exact. Les médias facultatifs peuvent être exclus pour limiter le volume.

La preuve d’acceptation est concrète : mode avion, ouverture du repas, de chaque recette, des ingrédients, des notes et des médias annoncés. Les fonctions d’assistance et de recherche en ligne restent indisponibles sans réseau. Le cache navigateur ne remplace pas une sauvegarde indépendante. [S21], [S22]

### 17.4 Partage vers l’application

Sur les configurations Android compatibles, une PWA installée peut recevoir un contenu via `share_target`. Les données de compatibilité consultées ne donnent pas ce mécanisme à Safari/iOS. [S23], [S24]

À court terme sur iPhone : Coller un lien et sélectionner des photos doivent être excellents. Une extension native de partage ou un raccourci spécifique est une étude distincte. Ne pas promettre que l’ajout d’une propriété au manifeste donnera automatiquement la feuille de partage iPhone.

### 17.5 Mises à jour de la PWA

Un onglet ouvert conserve son JavaScript jusqu’au rechargement. Une nouvelle version du service worker ne signifie pas que chaque écran utilise déjà le nouveau code.

Prévoir une information Mise à jour disponible au moment opportun, préserver les brouillons et éviter un rechargement au milieu d’une cuisson ou d’une saisie. La compatibilité des nouvelles données avec un ancien onglet doit être étudiée, notamment pour la corbeille et les traductions structurées.

### 17.6 Sauvegarde

Conserver l’archive avec inspection avant restauration et un bilan de sa complétude réelle. Le code prévoit déjà les cas de fichiers non téléchargés, de copies du serveur et d’octets d’origine inconnue. Une copie du serveur peut être réduite : une archive contenant cette copie ne doit pas être présentée comme préservant nécessairement l’original. Distinguer aussi avertissements d’export et erreurs empêchant la restauration. Un export de secours peut rester utile même si un problème de relations doit être réparé.

Les nouveaux états de corbeille, groupes d’ingrédients et révisions de sources doivent participer au contrat d’archive. Tester archive ancienne, archive nouvelle, restauration sur base vide, fichiers partagés et absence de secrets. Le code exclut déjà certaines configurations sensibles; préserver ces exclusions.

### 17.7 Volumes et performance

Mesurer avant d’optimiser : taille et nombre de photos, mémoire maximale, temps d’ouverture, temps de restauration et comportement sous quota. Le chargement agrégé du contexte et les archives ZIP en mémoire méritent une attention sur téléphone, sans présumer qu’ils échouent aujourd’hui.

Utiliser les miniatures pour les listes, limiter les décodages simultanés, révoquer les URL de blobs et conserver la reprise par lots. Tester les fichiers volumineux et les formats réellement utilisés par Neegan. Une bibliothèque de démonstration ne permet pas d’estimer le comportement d’un livre photographié intégralement.

## 18. Ce que la recherche récente apporte réellement

La recherche ne recommande pas de copier une application complète. Elle repère des solutions à des gestes précis. Les fonctions ci-dessous sont documentées par les éditeurs; elles n’ont pas été testées dans cette revue.

| Référence | Élément vérifié | Décision pour Mistu |
|---|---|---|
| Paprika 3 | Gestion des recettes, édition, suppression, portions et usage local | La gestion doit être une fonction normale de la bibliothèque [S02] |
| Paprika 4, bêta ouverte annoncée le 28 septembre 2026 | Scan, import social, dédoublonnage et recherches enregistrées | Retenir doublons et filtres favoris; ne pas présenter ces nouveautés comme celles de Paprika 3 stable [S01] |
| Recipe Keeper | Import web/photo/PDF, édition et usage hors ligne sur plusieurs plateformes | Unifier l’entrée sans cacher les limites de chaque format [S03] |
| Crouton | Quantités accessibles pendant l’étape et minuteurs multiples | Réduire les allers-retours entre ingrédients et méthode [S04] |
| AnyList, mise à jour du 1er janvier 2026 | Envies sans date, idées, modèles de menus et restes | Ajouter une organisation légère avant un calendrier complexe [S05] |
| Mela | Vérification du type des blocs OCR, groupes d’ingrédients et mode multi-recettes | Donner de bons outils de correction; améliorer le mode repas existant [S06], [S07] |
| Eat Your Books | Index personnel de livres et renvoi vers les pages, sans exiger la méthode complète | Assumer la valeur d’une référence d’index [S08], [S09] |
| Samsung Food | Inventaire et retrait proposé après cuisine avec choix utilisateur; renvoi à la source pour des instructions web | Confirmer les changements d’inventaire et être précis sur le contenu réellement disponible [S10], [S11] |

Les tendances utiles sont donc la **collecte facile, la correction visible, la continuité entre appareils et la cuisine sans navigation excessive**. Le nombre de fonctions IA ou d’effets visuels ne constitue pas une mesure d’ergonomie.

## 19. Architecture de mise en œuvre

### 19.1 Conserver les responsabilités existantes

| Couche réelle | Responsabilité à préserver | Évolution conseillée |
|---|---|---|
| `src/ui/*` | Rendu et interactions | Petits composants et modèles de vue partagés, sans logique de purge dans les boutons |
| `src/domain/*` | Règles culinaires et parcours | Cycle de vie, traductions, sources et plan de repas explicitement définis |
| `src/model/repo.js` | Écritures métier, nettoyage, horodatage, notifications | Mutations conditionnelles et protections post-suppression cohérentes |
| `src/core/db.js` | Transactions IndexedDB et capture | Garder l’unité des écritures sensibles; ne pas exposer ce détail à chaque vue |
| `src/sync/*` | Transport, conflits, fichiers, changement de compte | Compatibilité des nouveaux états et reprise; aucun second moteur parallèle |
| `src/model/schema.js` | Entités, index, relations, versions | Évolution explicite, compatible et testée |
| `supabase/*` | Traitements distants et contrat de synchronisation | Alignement des nouveaux formats et des règles de conflit |

### 19.2 Découper par usage, pas par taille arbitraire

Les gros écrans peuvent être séparés progressivement en en-tête, actions, contenu principal, éditeur et modèle de vue. Un composant Actions partagé limite les divergences entre carte et fiche. Un présentateur de recette central peut choisir version, langue et repères courants, puis être utilisé par la fiche et la cuisine.

Éviter une réorganisation massive de dossiers en même temps qu’un changement de données. Chaque extraction de composant doit conserver le comportement puis permettre un changement limité. Le nombre de lignes seul n’est pas un critère de qualité.

Noms possibles pour de **nouveaux** modules, à ajuster aux conventions du dépôt : `src/domain/corbeille.js`, un service de traduction versionnée, un modèle de vue de recette et un composant de menu d’actions. Ces noms sont des propositions, pas des fichiers trouvés dans l’export.

### 19.3 Contrat de migration pour chaque changement de modèle

Avant implémentation, préciser :

1. Forme des nouvelles données et signification des champs absents.
2. Lecture des anciennes données et comportement des anciennes archives.
3. Écriture, fusion, synchronisation et conflits.
4. Compatibilité d’un ancien onglet ou appareil.
5. Registre des relations et références de fichiers à compléter.
6. Retour arrière logiciel sans interprétation trompeuse des nouvelles données.

Un champ JSON optionnel ne nécessite pas à lui seul une nouvelle version IndexedDB. Un nouvel index ou magasin, oui. Un nouveau magasin synchronisé peut aussi exiger tables/migrations serveur, règles d’accès, ordre de réception et contrat d’archive. Ne pas augmenter des numéros de version mécaniquement sans décrire ce qui change.

### 19.4 Mutations tardives et changement de compte

Le code possède déjà des protections de génération de session et de traitement. Les étendre aux nouveaux parcours : résultat d’assistant, téléchargement, import et enregistrement ne doivent pas atteindre une autre recette, une autre révision ou un autre compte après navigation.

La vue peut disparaître sans que l’opération métier disparaisse; inversement, une opération devenue invalide ne doit pas être appliquée parce que son ancienne vue attend encore une réponse. Chaque résultat porte sa cible, sa révision et son contexte de propriétaire.

### 19.5 Mesures utiles

Mesurer les tâches plutôt que collectionner des événements : temps pour supprimer/restaurer, corriger un ingrédient, ajouter deux pages, retrouver une recette et reprendre une cuisson. Conserver aussi nombre d’écrans traversés, erreurs et reprises nécessaires.

Pour la technique : latence d’import, taux d’extraction sans modèle, blocs à corriger, temps de synchronisation des fichiers, mémoire de sauvegarde et conflits observés. Ne pas envoyer le contenu des recettes, les photos ou les secrets dans une télémétrie par défaut. Une première campagne peut rester locale et manuelle.

## 20. Feuille de route proposée

Les lots ci-dessous sont ordonnés par dépendances et utilité. Ils ne constituent pas une estimation de durée. Les tâches d’un lot peuvent être livrées séparément si chacune conserve un état cohérent.

| Lot | Résultat utilisateur | Fichiers principalement concernés | Dépendances et sortie attendue |
|---|---|---|---|
| **L0 — Référence et correctifs** | Données et contrôles cessent de produire les incohérences confirmées | `recipe-edit.js`, `recipe.js`, `timers.js`, `lines.js`, `meals.js`, `cook.js`, `grocery.js` | Reproductions ciblées avant/après; aucun changement de framework |
| **L1 — Corbeille individuelle** | Supprimer et restaurer une recette web ou personnelle | Nouveau domaine de cycle de vie, `repo.js`, `schema.js`, vues recette/bibliothèque, sync | Anti-résurrection, fermeture immédiate, hors ligne, archive et ancien client traités |
| **L2 — Livre et groupe** | Retirer un livre rempli en choisissant le sort de ses recettes | `book.js`, domaine de corbeille, relations, imports | Dépend de L1; sources et historiques conservés, restauration de groupe définie |
| **L3 — Gestion visible** | Modifier et gérer depuis cartes et fiches; retrouver sa recherche | `components.js`, `library.js`, `book.js`, `recipe.js`, `router.js`, `app.js`, `coquille.js` | Peut commencer en parallèle; les actions non livrées ne sont pas simulées |
| **L4 — Éditeurs et brouillons** | Corriger sans recommencer et reprendre une saisie | `recipe-edit.js`, `book.js`, helpers de formulaire, dépôt | Dépend des gardes de L0/L1; source/version et conflits conservés |
| **L5 — Sources et index** | Ajouter/remplacer des pages sans perdre l’index ni sa provenance | `import.js`, `index-livre.js`, domaine index, `repo.js`, schéma | Révisions de source définies; reprise, comparaison et absence de doublons |
| **L6 — Lecture structurée et FR** | Groupes corrects et recette entièrement lisible en français | `lines.js`, `llm.js`, traductions, éditeur, fiche, cuisine, serveur assistant | Correction positionnelle d’abord; nouveau format validé dans tous les consommateurs |
| **L7 — Cuisine confortable** | Ingrédients, bonne recette active, minuteurs et reprise fiables | `cook.js`, `timers.js`, `styles.css`, modèle de session | Scénario deux recettes sur appareils réels; Wake Lock avec repli |
| **L8 — Repas et inventaire** | Envies sans date, courses cohérentes, restes faciles à conserver | `meals.js`, `grocery.js`, `kitchen.js`, `cuisson.js`, domaines associés | Heures et quantités corrigées; aucune consommation implicite |
| **L9 — Confort et mouvement** | Interface plus fluide et accessible | CSS, composants, navigation, dialogues | États stabilisés; clavier, réduction du mouvement et petits écrans vérifiés |
| **L10 — Hors ligne et volumes** | Savoir qu’un repas est prêt sur l’appareil | `fichiers.js`, `state.js`, sauvegarde, UI repas/réglages, service worker | Mode avion réel, quotas et photos représentatives, archive restaurée |
| **E1 — Expérience Cookidoo** | Démontrer ou écarter un export automatisé | Module expérimental séparé, exporteur et configuration appropriée | Indépendant des lots UX; une recette canadienne de bout en bout et absence de doublon |

**Ordre pratique pour les premières livraisons :** L0, puis L1 et les parties de L3 qui n’en dépendent pas; ensuite L2, L4 et L5. Les correctifs cuisine simples de L0 ne doivent pas attendre toute la refonte. L6 et L7 se coordonnent pour la langue. Les petites améliorations d’accessibilité peuvent accompagner chaque lot; L9 n’est pas une raison de les remettre à plus tard.

### Première tranche concrète à remettre à Claude Code

- Corriger l’alignement des traductions et le comportement de sauvegarde après disparition de la recette.
- Corriger durée Siri, heure de repas, onglet/lien de cuisson et partage des courses.
- Définir puis implémenter la corbeille d’une recette avec restauration et contrat multiappareil.
- Ajouter Modifier et Actions dans la fiche et la carte; rendre l’entrée Ajouter des pages d’index directe.
- Conserver recherche et position au retour.

Ne pas tenter dans cette même tranche la purge physique, un nouveau framework, le calendrier intelligent, la traduction groupée universelle et un connecteur Cookidoo. Ces travaux ont des contrats différents et peuvent être évalués séparément.

## 21. Plan de validation et critères de livraison

### 21.1 Les cinq parcours utilisateur obligatoires

| Parcours | Données de départ | Résultat à observer |
|---|---|---|
| **1. Supprimer puis restaurer une recette web** | Recette avec version, photo et note | Suppression trouvée sans aide, fermeture possible, restauration complète, pas de résurrection par un ancien éditeur |
| **2. Retirer un livre rempli** | Livre avec index, recette complète, photos et ancien repas | Choix des conséquences compréhensible; recettes gardées avec source; retour arrière/restauration cohérent |
| **3. Modifier une recette et la lire en français** | Recette anglaise avec groupe, étape multiligne et traduction partielle | Correction simple, aucune ligne décalée, original conservé, cuisine et voix cohérentes |
| **4. Ajouter deux pages d’index** | Livre déjà partiellement indexé, une page remplacée | Relecture des bonnes révisions, bilan d’ajouts/doublons, reprise après interruption, aucune perte des recettes complètes |
| **5. Préparer puis reprendre un repas** | Deux recettes, heure de service, deux minuteurs, courses | Heure correcte, bonne recette active, ingrédients accessibles, reprise après arrière-plan et essai hors ligne |

Mesurer d’abord une référence sur la version courante, puis refaire ces tâches. Fixer les objectifs avec ces mesures; ne pas annoncer un gain de 60 % avant l’essai.

### 21.2 Données de test significatives

- Bibliothèque vide et bibliothèque ancienne sans enrichissements récents.
- Livre avec seulement un index, livre avec recettes complètes et deux éditions d’un même titre.
- Recette partielle, recette web sans image, URL répétée et titres identiques sur pages différentes.
- Traduction dont le deuxième ingrédient est vide, étape à deux paragraphes, changement de version après traduction.
- Groupes « Pour la sauce » et ingrédients « Sauce soja », « Pâte miso », « Levain ».
- Même photo utilisée comme couverture, photo de recette et photo d’historique.
- Repas à 19 h à Toronto, changement d’heure, durée de 30/61/90 secondes et plage 4–6 heures.
- Import interrompu, réponse tardive, quota de stockage atteint et fichier non décodable.
- Objet dans la corbeille encore référencé par repas, courses, inventaire et ancienne cuisson.

Les recettes de démonstration ne doivent pas injecter dans les vraies données des durées, descriptions ou quantités inventées pour rendre la capture plus belle.

### 21.3 Matrice de concurrence

| Concurrence | Invariant attendu |
|---|---|
| Deux onglets, édition contre corbeille | Pas de restauration implicite; brouillon récupérable |
| Réponse IA après remplacement d’une source | Résultat attaché à la révision lue, jamais validé sur la nouvelle |
| Double clic sur enregistrement d’import | Une décision durable, pas deux recettes |
| Deux appareils dont un hors ligne | Convergence selon la règle explicite, pas selon un effet de rendu |
| Ancien client après nouveau modèle | Comportement bloqué ou compatible selon contrat; marqueur de corbeille non perdu |
| Déconnexion/changement de compte pendant transfert | Aucune application du résultat au mauvais propriétaire |
| Réseau coupé au milieu d’une synchronisation | Reprise sans fausse promesse de transaction globale |
| Restauration simultanée avec changement de livre | Résolution définie, attribution et contenu conservés |

### 21.4 Supports et accessibilité

Tester un ordinateur avec souris et clavier, un iPhone/Safari et une PWA installée, puis Android/Chrome si ce support fait partie des usages visés. La tablette doit être testée en portrait et paysage. Une émulation de largeur ne prouve ni le clavier mobile, ni Wake Lock, ni le retour d’arrière-plan.

Largeurs de contrôle proposées : 320, 390, 768, 900 et 1280 px, ainsi qu’un zoom texte à 200 %. Tester le lecteur d’écran pertinent, le focus après suppression, les dialogues, le glisser avec alternative et la réduction du mouvement. Ce sont des critères à exécuter, pas des tests déjà passés.

### 21.5 Commandes et preuve de validation

Le guide fourni mentionne notamment les commandes suivantes, à exécuter **dans le dépôt complet et un environnement adapté**, après lecture de ses instructions :

```bash
python3 -m http.server 8080
```

Puis ouvrir `/tests/` dans un profil dédié, et utiliser selon le lot :

```bash
node --test --test-concurrency=1 tools/*.test.mjs
node tools/generer-migrations.mjs --check
```

Vérifier les noms et commandes réels du dépôt avant exécution. L’export source seul n’est pas un paquet prêt à lancer; certaines dépendances et les suites ne sont pas fournies. Un échec de lancement de cet export ne démontrerait pas un défaut de production.

Chaque livraison décrit : comportement changé, fichiers touchés, migrations, tests réellement exécutés, résultat et limites restantes. Pour les changements de données, conserver une preuve de sauvegarde/restauration et de concurrence. Pour un ajustement visuel réversible, une vérification ciblée du rendu suffit souvent; éviter les tests qui recopient simplement l’implémentation.

## 22. Réponses aux huit questions du guide de revue

| Question réelle du guide | Réponse et décision |
|---|---|
| **1. Français** | Trois mécanismes distincts existent; aucune traduction automatique intégrale n’est livrée. Corriger les correspondances, puis introduire une traduction fidèle par version et l’appliquer à la cuisine. Section 12. |
| **2. Interface et fidélité** | La gestion et les états restent trop dispersés; le desktop cuisson présente un problème DOM/CSS. La fidélité exacte aux maquettes ne peut pas être certifiée sans rendre la version et examiner les actifs. Sections 6–10, 13 et 16. |
| **3. Organisation du code** | Garder les couches natives; extraire les responsabilités par parcours et des modèles de vue communs. Éviter réécriture générale et nouveau moteur de sync. Section 19. |
| **4. Concurrence** | Des primitives conditionnelles existent, mais l’éditeur accepte actuellement une résurrection et la suppression de livre a des limites documentées. La corbeille exige aussi un contrat avec les anciens clients. Sections 5, 8 et 21. |
| **5. Photos et volumes** | Les octets sont synchronisés dans le code actuel; états de fiche, octets, téléchargement et décodage doivent être séparés. Les gros volumes sur téléphone restent à mesurer. Section 17. |
| **6. Traductions partielles** | Le filtrage des lignes vides décale les positions; les retours internes d’étape sont aussi ambigus. Correction immédiate par segments, puis format stable. Sections 5 et 12. |
| **7. Assistant et confiance** | Le schéma JSON ne prouve pas la fidélité. Contrôler nombres, couverture, langue, source, sémantique et reprise partielle; ne jamais assimiler extraction et vérification. Sections 11–12. |
| **8. Tests et maintenance** | Les cinq parcours de la section 21 deviennent les critères utilisateur. Tenir un document d’état court qui indique ce qui est livré et testé; conserver les décisions historiques séparément. |

## 23. Consignes de passage à Claude Code

Le bloc suivant peut accompagner ce fichier lors de l’implémentation.

> Travaille à partir du dépôt actuel de Mistu, après lecture de `AGENTS.md`, `STATE.md` et des instructions de test. Ce rapport concerne l’export 0.21.1 au commit `cd8c7f2e85e1333ab720b7eaca1461cd81d81225`; vérifie les écarts avec la branche courante.
>
> Commence par la première tranche de la section 20. Distingue correctifs confirmés, améliorations de fonctions existantes et nouvelles fonctions. Réutilise les primitives transactionnelles, les états d’import, les versions, les références de fichiers et la synchronisation actuels.
>
> Avant toute modification du modèle, écris le contrat minimal de compatibilité et de migration. Une suppression doit être réversible, ne pas ressusciter par un ancien éditeur et conserver les sources. N’implémente pas la cascade Gemini telle quelle. Les noms de fichiers proposés dans ce rapport sont marqués comme nouveaux; vérifie tous les autres dans le dépôt.
>
> Ne migre pas le framework pour cette refonte. Ne crée pas une seconde implémentation d’index, de repas multi-recettes, de variantes, de photos synchronisées ou d’export Cookidoo si le parcours existe déjà. Améliore sa visibilité et ses limites.
>
> N’affiche pas de durées inventées, de progression fictive, de traduction automatique inexistante, de synchronisation de photos non vérifiée ou de connexion Thermomix déduite d’une copie de texte. Les résultats d’assistant restent des propositions rattachées à leur source exacte.
>
> Pour chaque lot, livre un comportement cohérent, les vérifications proportionnées et une courte description de ce qui a changé. Indique les tests réellement exécutés et les essais physiques encore nécessaires. Ne prétends pas avoir testé Cookidoo, Siri ou un appareil simplement parce qu’une fonction JavaScript passe.

### Définition de terminé pour un lot

- Le parcours fonctionne avec données vides, anciennes et partielles, pas seulement avec un exemple enrichi.
- Retour arrière, rechargement et erreurs conservent les informations utiles.
- Les écritures sensibles résistent aux scénarios de concurrence qui les concernent.
- Les nouveaux champs sont couverts par synchronisation, archives et lecture des anciennes données.
- L’interface est utilisable au toucher et au clavier, avec texte lisible et états compréhensibles.
- Les limites sont exprimées au bon endroit et les libellés correspondent aux capacités livrées.
- La documentation d’état décrit la version réellement livrée; les anciens documents ne la contredisent pas.

## 24. Sources et repères de code

### 24.1 Documents fournis et recherche antérieure

- [Code source Mistu 0.21.1](https://chatgpt.com/library?file_id=libfile_0d8334f8d4b881919c3b1115dd2e4232&account_id=personal).
- [Guide de revue Mistu 0.21.1](https://chatgpt.com/library?file_id=libfile_b1f539bf63c48191aecb3013b8d8f45e&account_id=personal).
- [Revue Gemini du code et de l’UX](https://chatgpt.com/library?file_id=libfile_101f4feb134c8191a12f39ff5d9037a2&account_id=personal).
- [PDF de commentaires d’interface fourni](https://chatgpt.com/library?file_id=libfile_e57ff720e7408191a9ff73faac7899be&account_id=personal).
- [Recherche UX, animations et Thermomix du 29 octobre 2026](https://chatgpt.com/library?file_id=libfile_1abed51a334081919cfd4dbd38d3644e&account_id=personal). Elle a précédé la lecture du code; les qualifications de l’existant dans le présent document la remplacent lorsqu’elles diffèrent.

### 24.2 Repères dans l’export source

Les liens suivants sont figés sur le commit de l’export. Les lignes servent de points d’entrée, pas de garantie que le dépôt accessible aujourd’hui n’a pas évolué. Les preuves de cette revue proviennent des fichiers joints extraits, et non d’une certification du dépôt distant.




| Sujet | Point d’entrée | Utilisation dans la revue |
|---|---|---|
| Version, magasins, relations et états | [src/model/schema.js:4](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/model/schema.js#L4) | Base réelle à faire évoluer; ne pas inventer des index. |
| Transaction et capture locale | [src/core/db.js:95](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/core/db.js#L95) | Relecture et conditions dans la mutation. |
| Fusions conditionnelles | [src/model/repo.js:403](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/model/repo.js#L403) | Contrat réel de saveBatch. |
| Transitions avec mutations associées | [src/model/repo.js:439](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/model/repo.js#L439) | Puts/deletes et statut attendu; pas une mutation générique sans garde. |
| Suppression groupée | [src/model/repo.js:482](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/model/repo.js#L482) | removeBatch refuse patch et fusion. |
| Capture des suppressions | [src/sync/outbox.js:25](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/sync/outbox.js#L25) | Payload de suppression; puts relus à l’envoi. |
| Suppression du livre vide | [src/ui/book.js:48](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/book.js#L48) | Limites documentées puis fonction et gardes. |
| Éditeur et résurrection | [src/ui/recipe-edit.js:345](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/recipe-edit.js#L345) | Repli sur targetRecipe quand la ligne courante a disparu. |
| Traductions positionnelles | [src/ui/recipe-edit.js:396](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/recipe-edit.js#L396) | Édition en grands champs et filtrage des lignes vides. |
| Lecture des traductions | [src/ui/recipe.js:326](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/recipe.js#L326) | Traduction de version, puis accès aux éléments par position. |
| Préférence de langue de session | [src/ui/recipe.js:398](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/recipe.js#L398) | À aligner avec le rendu et la voix de cuisine. |
| Remplacement de source | [src/ui/import.js:222](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/import.js#L222) | Nouvelle image avec même identifiant de page. |
| Lectures de pages d’index | [src/ui/index-livre.js:21](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/index-livre.js#L21) | Regroupement par page; sélection des pages à lire plus loin. |
| Ajout de page d’index | [src/ui/index-livre.js:248](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/index-livre.js#L248) | Capacité existante à rendre plus accessible. |
| Consolidation d’index | [src/domain/index-livre.js:197](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/index-livre.js#L197) | Doublons, contradictions, références et compléments. |
| Documents PDF et pages image | [src/model/repo.js:655](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/model/repo.js#L655) | Distinguer document importé et pages image générées. |
| Groupes et minuteries | [src/domain/lines.js:49](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/lines.js#L49) | Parseur de lignes; plages horaires dans detectTimers plus bas. |
| Repères et signature | [src/domain/reperes.js:204](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/reperes.js#L204) | Valeurs courantes, priorité manuelle et critère rapide. |
| Import web sans modèle | [supabase/functions/assistant/index.ts:255](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/supabase/functions/assistant/index.ts#L255) | Chemin JSON-LD avec usage modèle nul. |
| Contexte de bibliothèque | [src/ui/library.js:75](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/library.js#L75) | Recherche et filtres locaux au rendu. |
| Défilement après rendu | [src/app.js:68](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/app.js#L68) | Retour systématique en haut. |
| Navigation réelle | [src/ui/coquille.js:10](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/coquille.js#L10) | Les cinq destinations actuelles. |
| Carte de recette | [src/ui/components.js:295](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/components.js#L295) | Métadonnées et action photo dans le composant partagé. |
| Repères manquants affichés | [src/ui/reperes-affichage.js:17](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/reperes-affichage.js#L17) | Alléger les variantes compactes sans perdre les données. |
| État actif en cuisine | [src/ui/cook.js:49](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/cook.js#L49) | Lien Fiche puis onglets construits hors redraw. |
| Structure cuisine | [src/ui/cook.js:95](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/cook.js#L95) | Zone redessinée, ingrédients et étape dans le même enfant. |
| Règle CSS cuisine | [styles.css:520](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/styles.css#L520) | Règle qui force la disposition block. |
| Minuteur indicatif | [src/ui/cook.js:145](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/cook.js#L145) | État et intervalle locaux à la carte. |
| Siri et précision des durées | [src/domain/timers.js:21](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/timers.js#L21) | Arrondi de la phrase et limites de confirmation. |
| Heure du repas | [src/ui/meals.js:78](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/meals.js#L78) | Conversion ISO et réaffichage datetime-local. |
| Copie/partage des courses | [src/ui/grocery.js:14](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/grocery.js#L14) | Traitement différent de l’état coché. |
| Heuristiques d’appareils | [src/domain/pairing.js:63](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/pairing.js#L63) | Extraction de température sans ressource explicite. |
| Profil Thermomix actuel | [src/domain/thermomix.js:8](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/thermomix.js#L8) | Périmètre du contrat logiciel. |
| Export Cookidoo manuel | [src/ui/cookidoo.js:23](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/cookidoo.js#L23) | Copie par champ et texte sélectionnable. |
| Bilan de cuisson | [src/ui/cuisson.js:32](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/cuisson.js#L32) | Notes, photo et retour utilisateur déjà présents. |
| Inventaire actuel | [src/ui/kitchen.js:50](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/kitchen.js#L50) | Formulaire, portions et commandes disponibles. |
| Références de fichiers | [src/sync/fichiers.js:24](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/sync/fichiers.js#L24) | Registre à réutiliser pour les images partagées. |
| Qualité des octets envoyés | [src/sync/fichiers.js:190](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/sync/fichiers.js#L190) | Réduction par défaut lorsque les conditions s’appliquent. |
| Bilan de l’archive | [src/ui/settings.js:379](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/ui/settings.js#L379) | Fichiers manquants et copies du serveur distincts des originaux. |
| Export et validation des relations | [src/domain/backup.js:141](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/src/domain/backup.js#L141) | Avertissements d’export; inspection/restauration ailleurs dans le module. |
| Remplacement des données serveur | [supabase/migrations/0005_imports.sql:67](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/supabase/migrations/0005_imports.sql#L67) | Transport JSON et nécessité d’un contrat avec les anciens clients. |
| Coquille hors ligne | [sw.js:8](https://github.com/neegans/mistu/blob/cd8c7f2e85e1333ab720b7eaca1461cd81d81225/sw.js#L8) | Précache des modules; ne garantit pas les médias de chaque recette. |

### 24.3 Sources Internet

Sources primaires consultées le 29 octobre 2026 pendant la recherche préparatoire. Les documents d’éditeurs décrivent leurs propres produits; les projets communautaires décrivent leurs propres implémentations. Une mention de disponibilité exige encore une validation dans la région, la version et l’appareil concernés.

#### Applications et structure des recettes

- **S01.** Paprika, annonce du 28 septembre 2026 : [Paprika 4 Is Now in Open Beta](https://www.paprikaapp.com/news/2026/09/28/paprika-4-is-now-in-open-beta/).
- **S02.** Paprika, guide de la version 3, non daté : [Guide iOS](https://www.paprikaapp.com/help/ios/).
- **S03.** Recipe Keeper, non daté : [Fonctions officielles](https://recipekeeperonline.com/).
- **S04.** Crouton, description publiée par l’éditeur, non daté : [App Store Canada](https://apps.apple.com/ca/app/crouton-recipe-manager/id1461650987).
- **S05.** AnyList, 1er janvier 2026 : [Meal Planning Update](https://blog.anylist.com/2026/01/meal-plan-update/).
- **S06.** Mela, non daté : [Guide officiel](https://mela.recipes/help/).
- **S07.** Mela, non daté : [Mode cuisine et fonctionnalités](https://mela.recipes/).
- **S08.** Eat Your Books, mis à jour le 25 juillet 2026 : [Set up your Bookshelf](https://support.eatyourbooks.com/article/259-step-1-setting-up-your-bookshelf).
- **S09.** Eat Your Books, mis à jour le 25 juillet 2026 : [Pourquoi les recettes complètes ne sont pas affichées](https://support.eatyourbooks.com/article/120-why-can-i-only-see-a-list-of-ingredients-where-is-the-recipe).
- **S10.** Samsung Food, mis à jour le 15 mai 2025 : [Food List](https://support.samsungfood.com/hc/en-us/articles/30025317487508-Getting-Started-with-Food-List).
- **S11.** Samsung Food, mis à jour le 1er août 2025 : [Recipes FAQs](https://support.samsungfood.com/hc/en-us/articles/18588391246740-Recipes-Made-Its-and-Review-FAQs).
- **S12.** Android Developers, documentation actuelle : [Canonical layouts](https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts).
- **S13.** Schema.org, documentation actuelle : [Recipe](https://schema.org/Recipe).

#### Animation, accessibilité et web mobile

- **S14.** Apple, documentation actuelle; contenu consulté via indexation du site : [Motion](https://developer.apple.com/design/human-interface-guidelines/motion).
- **S15.** Material Design, section introduite en mai 2025; contenu indexé : [Motion](https://m3.material.io/styles/motion).
- **S16.** MDN, état de compatibilité actuel : [ViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition). Contexte daté du 8 octobre 2025 : [Chrome, View transitions in 2025](https://developer.chrome.com/blog/view-transitions-in-2025).
- **S17.** Motion, documentation actuelle : [Accessibility](https://motion.dev/docs/react-accessibility).
- **S18.** W3C WAI, documentation WCAG 2.2 : [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).
- **S19.** WebKit, 31 mars 2025 : [Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).
- **S20.** MDN, documentation actuelle : [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
- **S21.** MDN, documentation actuelle : [Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).
- **S22.** web.dev : [Offline data](https://web.dev/learn/pwa/offline-data?hl=en).
- **S23.** MDN, documentation actuelle : [share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target).
- **S24.** Web Platform DX, compatibilité actuelle : [Share targets](https://web-platform-dx.github.io/web-features-explorer/features/app-share-targets/).
- **S25.** MDN, documentation actuelle : [setTimeout et onglets inactifs](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout).

#### Thermomix et passerelles

- **S26.** Vorwerk, mis à jour le 8 septembre 2026 : [Recipe Handover](https://globalsupport.vorwerk.com/hc/en-us/articles/23238724724764-How-to-send-Cookidoo-recipes-from-your-smartphone-to-Thermomix-TM7).
- **S27.** Cookidoo Canada, non daté : [Created Recipes et limite de 100 créations](https://cookidoo.ca/foundation/en-CA/pages/discover-created-recipes).
- **S28.** Vorwerk UK, 28 mars 2025 : [Synchronisation des recettes créées sur TM7](https://support-gb.vorwerk.com/hc/en-gb/articles/19200758508700-Can-recipes-be-created-rated-and-translated-directly-on-the-TM7). Utilisé pour la synchronisation uniquement; les déclarations de lancement sur la traduction peuvent avoir vieilli.
- **S29.** Vorwerk, 18 septembre 2025 : [Remote Monitoring](https://globalsupport.vorwerk.com/hc/en-us/articles/21973787037724-How-Can-I-Use-Remote-Monitoring-to-Track-My-Thermomix-TM7-Cooking-from-My-Smartphone).
- **S30.** Cookidoo Canada, non daté : [Fonctions récentes](https://cookidoo.ca/foundation/en-CA/articles/cookidoo-releases). Le texte marketing sur « any recipe » est précisé par la limite de S26.
- **S31.** Vorwerk, mis à jour le 7 juillet 2026 : [Régions Cookidoo](https://globalsupport.vorwerk.com/hc/en-us/articles/360020979740-Access-to-Cookidoo-platform-internationally).
- **S32.** Vorwerk UK, mis à jour le 8 octobre 2026 : [Historique firmware TM7 2026](https://support-gb.vorwerk.com/hc/en-gb/articles/30901753049756-Thermomix-TM7-firmware-update-history-2026).
- **S33.** Dlishe, non daté : [Conversion Thermomix](https://www.dlishe.com/fr/convertir-recette-thermomix).
- **S34.** Dlishe, conditions du 25 septembre 2026 : [Terms](https://www.dlishe.com/terms).
- **S35.** Dlishe, page affichant une mise à jour au 29 octobre 2026 lors de la lecture finale : [Privacy](https://www.dlishe.com/privacy).
- **S36.** Bananarium, description publiée par l’éditeur : [App Store](https://apps.apple.com/sa/app/bananarium-recipe-keeper/id6788481955). Cette page ne démontre pas sa disponibilité ou sa compatibilité au Canada.
- **S37.** Home Assistant, documentation actuelle : [Cookidoo integration](https://www.home-assistant.io/integrations/cookidoo/).
- **S38.** Développeur communautaire, README actuel : [miaucl/cookidoo-api](https://github.com/miaucl/cookidoo-api). Source du projet pour ses capacités annoncées; aucun essai réalisé.
- **S39.** Développeur communautaire, README actuel : [danielkliem/mcp-cookidoo](https://github.com/danielkliem/mcp-cookidoo). Interface non officielle et annotations rétroconçues; la description d’authentification peut différer des versions récentes de la bibliothèque sous-jacente.

[S01]: https://www.paprikaapp.com/news/2026/09/28/paprika-4-is-now-in-open-beta/
[S02]: https://www.paprikaapp.com/help/ios/
[S03]: https://recipekeeperonline.com/
[S04]: https://apps.apple.com/ca/app/crouton-recipe-manager/id1461650987
[S05]: https://blog.anylist.com/2026/01/meal-plan-update/
[S06]: https://mela.recipes/help/
[S07]: https://mela.recipes/
[S08]: https://support.eatyourbooks.com/article/259-step-1-setting-up-your-bookshelf
[S09]: https://support.eatyourbooks.com/article/120-why-can-i-only-see-a-list-of-ingredients-where-is-the-recipe
[S10]: https://support.samsungfood.com/hc/en-us/articles/30025317487508-Getting-Started-with-Food-List
[S11]: https://support.samsungfood.com/hc/en-us/articles/18588391246740-Recipes-Made-Its-and-Review-FAQs
[S12]: https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts
[S13]: https://schema.org/Recipe
[S14]: https://developer.apple.com/design/human-interface-guidelines/motion
[S15]: https://m3.material.io/styles/motion
[S16]: https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition
[S17]: https://motion.dev/docs/react-accessibility
[S18]: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
[S19]: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
[S20]: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
[S21]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
[S22]: https://web.dev/learn/pwa/offline-data?hl=en
[S23]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
[S24]: https://web-platform-dx.github.io/web-features-explorer/features/app-share-targets/
[S25]: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
[S26]: https://globalsupport.vorwerk.com/hc/en-us/articles/23238724724764-How-to-send-Cookidoo-recipes-from-your-smartphone-to-Thermomix-TM7
[S27]: https://cookidoo.ca/foundation/en-CA/pages/discover-created-recipes
[S28]: https://support-gb.vorwerk.com/hc/en-gb/articles/19200758508700-Can-recipes-be-created-rated-and-translated-directly-on-the-TM7
[S29]: https://globalsupport.vorwerk.com/hc/en-us/articles/21973787037724-How-Can-I-Use-Remote-Monitoring-to-Track-My-Thermomix-TM7-Cooking-from-My-Smartphone
[S30]: https://cookidoo.ca/foundation/en-CA/articles/cookidoo-releases
[S31]: https://globalsupport.vorwerk.com/hc/en-us/articles/360020979740-Access-to-Cookidoo-platform-internationally
[S32]: https://support-gb.vorwerk.com/hc/en-gb/articles/30901753049756-Thermomix-TM7-firmware-update-history-2026
[S33]: https://www.dlishe.com/fr/convertir-recette-thermomix
[S34]: https://www.dlishe.com/terms
[S35]: https://www.dlishe.com/privacy
[S36]: https://apps.apple.com/sa/app/bananarium-recipe-keeper/id6788481955
[S37]: https://www.home-assistant.io/integrations/cookidoo/
[S38]: https://github.com/miaucl/cookidoo-api
[S39]: https://github.com/danielkliem/mcp-cookidoo
