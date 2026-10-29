# L0 — Référence et correctifs de cohérence

**29 octobre 2026 — Approuvée par Neegan sur « go ». Construction sur `l0-reference-correctifs`, base `cd8c7f2`.**

## 1. Base et résultat attendu

Source : [plan directeur fourni par Neegan](../../lots/2026-10-29-plan-directeur-interface-fonctions.md), notamment § 5, 12, 20 et 21.
Sa copie dans le dépôt est identique au fichier fourni dans Downloads.

Base vérifiée : `main`, commit `cd8c7f2e85e1333ab720b7eaca1461cd81d81225`, application **0.21.1**, schéma **4**, cache `cuisine-os-v0.21.1-1`.
Le dernier commit applicatif est `fe241e1`. La branche correspond exactement à la base examinée dans le plan.

Ce lot corrige six incohérences existantes : traduction partielle, sauvegarde d’une recette disparue, heure du repas, recette active en cuisine,
précision des durées et état des courses copiées/partagées. Il fournit des reproductions et des critères de réception avant les ajouts plus larges.

Le besoin produit du § 12 est retenu comme cible du programme : **une recette entièrement lisible en français clair, sans changer ses quantités,
durées, températures, étapes, conditions ou avertissements**. La courte description `recipes.reperes` ne remplit pas ce besoin.
L0 prépare la fiabilité des traductions manuelles ; la demande de traduction automatique et la lecture française commune fiche/cuisine/voix relèvent de L6/L7.

## 2. Périmètre et répartition du plan

| Constat du plan | Décision pour L0 | Suite identifiée |
|---|---|---|
| C01 — Traductions décalées | Édition par segment, positions vides conservées, anciennes données explicites | L6 : traduction assistée et correspondances par identifiants |
| C02 — Recette recréée après suppression | Refus atomique de l’éditeur et de l’écriture de traduction, saisie conservée | L1 : corbeille et contrat de tous les clients/écritures tardives |
| C03 — Heure locale décalée | Conserver l’instant ISO, corriger sa saisie et sa restitution locales | L8 : organisation des repas |
| C04 — Ancienne lecture après remplacement de photo | Constat confirmé, aucun correctif partiel de provenance dans L0 | L5 : révisions de source et comparaison des lectures |
| C05 — Recette active incohérente | Onglet, lien Fiche, contenu et sélection persistée cohérents | L7 : disposition et confort de cuisine |
| C06 — Durées et minuteurs | Corriger précision Siri/affichage et plages en heures | L7 : échéances persistantes et zone Minuteurs |
| C07 — Contexte de liste perdu | Dépendance documentée, traitement dans le lot de navigation | L3 : recherche, filtres, tri et position |
| C08 — État des courses perdu au partage | Même texte préparé pour Copier/Partager, choix restants/complet | L8 : autres améliorations des courses |
| C09 — Course lors de suppression du livre vide | Limite documentée ; ne pas étendre cette suppression aux livres remplis | L1/L2 : gardes atomiques puis retrait de livre |

Cette répartition précise le tableau général du plan : la persistance complète des minuteurs et les révisions des sources nécessitent leur contrat propre.
Elles ne seront pas déclarées corrigées à la livraison de L0.

La corbeille, la purge, les brouillons durables, les menus Actions, les groupes d’ingrédients, la refonte des cartes, Wake Lock et Cookidoo ne sont pas inclus.
Aucun changement de framework, nouveau moteur de synchronisation ou appel réel à l’assistant n’est nécessaire à ce lot.

## 3. Constats vérifiés dans cette base

| Constat | Point d’entrée actuel | Niveau de preuve avant construction |
|---|---|---|
| C01 | `src/ui/recipe-edit.js:408`, `src/ui/recipe.js:340` et `:368` | Lecture du code et exécution isolée : `sel\n\nbeurre` devient deux entrées ; les lecteurs les associent par position |
| C02 | `src/ui/recipe-edit.js:358` et `:409` | Fusion utilisant `c ?? targetRecipe` ; traduction écrite sans garde de recette/version |
| C03 | `src/ui/meals.js:78` | Reproduction isolée sous Toronto : 19 h → stockage 23 h UTC → contrôle réaffiché 23 h |
| C04 | `src/ui/import.js:222`, `src/ui/index-livre.js:21` | Identifiant de page conservé malgré nouvelle empreinte ; lectures regroupées par identifiant de page |
| C05 | `src/ui/cook.js:49`, `:73`, `:89` et `:95` | Lien et onglets hors du rendu central ; changement de sélection non persisté au clic |
| C06 | `src/domain/timers.js:17` et `:21`, `src/domain/lines.js:95` | Fonctions exécutées isolément : 30/61/90 s arrondies ; 3661 s perd sa seconde à l’affichage ; plage 4–6 h réduite à 6 h |
| C08 | `src/ui/grocery.js:15` et `:16`, `src/domain/grocery.js:66` | Copier transmet les cases ; Partager ne les transmet pas |
| C09 | `src/ui/book.js:48` | Limites nommées dans le code : vacuité hors transaction finale et statut d’import inconnu non couvert |

Les numéros de ligne sont des repères de la base, pas des contrats de test.
Aucune suite complète ni reproduction navigateur de ces défauts n’a été exécutée pour écrire cette spec.
La dernière validation publiée indiquée par `STATE.md` est **7118/7118 assertions navigateur**, **230/230 tests Node**, migrations `--check` **0**.

## 4. Traductions manuelles sans déplacement — C01

### 4.1 Écran et comportement

- Un champ de traduction par ingrédient, un champ multiligne par étape, avec son texte source visible et son numéro.
- Un retour à la ligne dans une étape reste à l’intérieur de cette étape. Il ne crée jamais un nouveau segment ; le rendu conserve aussi visuellement ses paragraphes.
- Un champ vide est enregistré comme `""` à sa position. Le nombre et l’ordre des éléments restent ceux de la version source.
- À la lecture, un segment manquant conserve son texte source avec une mention « Traduction à compléter ». Aucune traduction voisine ne le remplace.
- La traduction reste liée à `recipe_version_id` et à la langue choisie. Aucun changement de l’original, de ses quantités ou de sa vérification.
- Le titre traduit et sa recherche restent disponibles ; L0 ne transforme pas la traduction en nouvelle version culinaire.
- Les champs conservent un label accessible, leur focus et leur saisie en cas d’échec. Les textes passent par `t()` et possèdent leur entrée anglaise.

### 4.2 Format et anciennes données

Conserver `translated_content.title`, `ingredients` et `steps`. Ajouter un marqueur optionnel **`alignment_format: 1`** sur la ligne de traduction,
écrit uniquement par l’éditeur segmenté après validation. Ce marqueur atteste un format positionnel préservé, pas une traduction exacte ni vérifiée.

Une traduction au format 1 doit avoir exactement autant d’éléments que sa version source, tous de type chaîne ; les vides sont admis.
Le lecteur refuse un format inconnu ou une structure incohérente et garde la source lisible. Il ne tronque ni ne complète silencieusement un tableau reçu.
Bornes proposées propres à ce parcours, en points de code Unicode : 200 ingrédients, 200 étapes, titre de 1000 caractères,
2000 caractères par ingrédient, 10000 par étape et 200000 au total. Les validateurs d’extraction et Thermomix ont des limites différentes ;
le contenu JSON encodé en UTF-8 est également borné à 500000 octets pour tenir sous la limite de 524288 octets par fiche du transport existant.
Ce complément technique empêche qu’un texte valide en nombre de caractères (notamment des emoji) soit enregistré puis bloqué à l’envoi.
La saisie manuelle historique n’a pas ces plafonds. Ne pas assimiler ces contrats ni appliquer une troncature pour faire entrer un texte dans une borne.
Vérifier les tailles avant de construire les champs. Une source ou traduction ancienne hors bornes reste conservée et consultable ;
l’éditeur segmenté explique sa limite et refuse son enregistrement sans rien écraser. Aucun contenu reçu n’est cru sur son seul marqueur.

Pour une ancienne traduction sans marqueur :

1. Conserver intégralement ses textes et son statut. Ne pas la réécrire automatiquement au chargement, à la synchronisation ou à la restauration.
2. Afficher l’original et un accès « Vérifier l’ancienne traduction ». Les anciens textes restent consultables dans un panneau distinct, sans association présumée aux lignes sources.
3. Dans l’éditeur, si les longueurs correspondent, proposer les correspondances actuelles comme **à vérifier**, sans prétendre qu’elles sont établies.
4. Si les longueurs diffèrent, montrer les anciens textes à côté des segments sources pour réattribution manuelle ; aucun remplissage des trous par devinette.
5. Le geste explicite d’enregistrement après revue produit le format 1. La vérification linguistique demeure `unverified`, comme aujourd’hui.

Cette règle prudente évite qu’une ancienne donnée déjà décalée continue d’être présentée comme une traduction correctement associée.
Elle ne prétend pas réparer automatiquement les informations perdues par l’ancien filtrage.

### 4.3 Garde d’écriture

L’écriture doit relire dans la même transaction la recette, la version cible et la traduction éventuellement modifiée.
La version doit encore appartenir à la recette et ses ingrédients/étapes doivent correspondre au contenu montré lors de l’ouverture.
La comparaison de cette projection est synchrone dans la transaction ; aucun calcul asynchrone ni réseau ne s’y insère.
Si une traduction a changé depuis l’ouverture, refuser son écrasement et conserver la saisie pour comparaison/rechargement explicite.

Deux créations concurrentes avec des identifiants différents pour la même version/langue constituent un autre cas : L0 ne promet pas leur unicité.
L6 devra définir l’identité des traductions et le traitement des doublons anciens. L’index actuel porte seulement sur `recipe_version_id` ;
une condition d’absence sur tout cet index empêcherait à tort la création d’une autre langue.

Un changement du pointeur de version courante ne rend pas nécessairement l’ancienne version intraduisible : elle reste traduisible si elle existe,
appartient à la même recette et est toujours exactement la source affichée. Ne jamais appliquer cette traduction à la nouvelle version par position.

## 5. Enregistrer ne recrée pas une recette disparue — C02

Pour une édition/correction/adaptation d’une recette existante, supprimer le repli sur l’ancienne copie lorsque la recette manque dans la transaction.
Lever un refus qui annule **tout le lot** : recette, version, pages, séance associée et capture de synchronisation.

Attention au contrat existant : une fusion qui renvoie `null` saute seulement cette écriture ; les autres `puts` restent exécutables.
Le chemin de refus doit lever `TransitionRefusee` ou l’erreur métier équivalente effectivement prise en charge pour annuler la transaction entière.
Réutiliser les conditions de `repo.saveBatch` ; ne pas introduire d’écriture directe de la vue dans IndexedDB.

Après refus : afficher « Cette recette n’est plus disponible. Tes modifications restent dans ce formulaire. » ; conserver les champs et ne pas naviguer.
Ne pas afficher de succès, de lien vers une corbeille absente ni de commande de restauration fictive.
La saisie reste récupérable dans l’écran ; sa conservation après fermeture/rechargement relève des brouillons durables de L4.
Une création volontaire d’une nouvelle recette reste possible par le parcours Ajouter existant, sans réutiliser l’identifiant supprimé.

La garde identique s’applique à l’enregistrement manuel d’une traduction, avec contrôle de sa version cible.
Les modifications concurrentes de photo, note personnelle, favoris et repères qui ne sont pas édités doivent rester préservées.
Le scénario où la recette existe mais sa base a changé doit être distingué du scénario où elle a disparu ; une version parente disparue ne doit pas créer d’orphelin.

L0 garantit ce comportement pour les éditeurs corrigés. Il ne prétend pas protéger tous les anciens onglets/appareils ou retours tardifs d’import.
L1 devra définir la corbeille, la restauration explicite et leur compatibilité serveur/client avant d’en annoncer une garantie multiappareil.

## 6. Heure du repas — C03

**Décision proposée :** `serve_at` reste un **instant ISO UTC**. Le contrôle `datetime-local` le présente dans le fuseau de l’appareil.
Une saisie à 19 h à Toronto se rouvre à 19 h à Toronto ; un appareil dans un autre fuseau affiche l’heure locale correspondant au même instant.
L0 n’ajoute pas de fuseau propre au repas ni de calendrier à heure flottante.

- Remplir le contrôle à partir des composantes locales de `Date`, jamais par une découpe de la chaîne UTC.
- Accepter un champ vide selon le contrat existant des repas ; aucune date de remplacement inventée.
- Refuser une date non valide et une heure locale inexistante lors du passage à l’heure d’été ; conserver la saisie et expliquer le refus.
- Pour une heure répétée à l’automne, la première occurrence est la proposition par défaut ; montrer le décalage UTC retenu et permettre de choisir la seconde occurrence avant l’enregistrement.
- Lors de la simple réouverture d’un instant déjà enregistré dans la seconde occurrence, conserver cet instant s’il n’est pas modifié : ne pas le convertir silencieusement vers la première occurrence.
- Ne pas corriger en masse les anciennes dates : leur intention initiale n’est pas déductible du stockage.

## 7. Bonne recette active en cuisine — C05

Le changement de recette met à jour comme un même état visible : onglet actif, titre, contenu, lien **Fiche** avec version précise, portions et étape.
Le lien ne doit plus rester lié à la première recette du repas.

Persister `active_version_id` au changement par fusion sur une session relue et encore active, sans réécrire une vieille copie de sa progression.
Vérifier aussi dans cette transaction que la version choisie figure encore dans `selected_version_ids`, existe et appartient à la recette encore présente.
Un retour depuis Fiche et un rechargement reprennent cette recette et l’étape déjà enregistrée pour elle.
Une session terminée ou supprimée pendant le geste n’est jamais recréée ou réactivée ; le refus est traité et le dernier état valide reste consultable.
Si la persistance échoue, le changement local peut rester visible mais aucun message ne prétend qu’il sera repris après rechargement.

Les changements rapides A → B → A doivent garder le dernier choix ; les écritures sont sérialisées ou protégées par le mécanisme adapté.
Le test vérifie aussi qu’une progression écrite par un autre onglet n’est pas effacée par une simple sélection de recette.
L0 conserve la structure d’affichage existante ; les deux panneaux desktop et les minuteurs indépendants de l’étape sont prévus dans L7.

## 8. Durées exactes — C06, première partie

- Générer une phrase Siri FR/EN exprimant exactement heures, minutes **et secondes** après la même normalisation en secondes entières que le raccourci.
- Valider avant normalisation : nombre fini strictement positif, au plus 86400 secondes ; arrondir ensuite à la seconde et refuser si l’arrondi produit zéro.
  Une valeur nulle ou négative ne doit pas devenir une seconde par un plancher artificiel.
- Cas de référence : 30 s, 61 s, 90 s, 3601 s et 3661 s. Ne pas arrondir à la minute ni supprimer les secondes dès qu’une heure existe.
- Conserver une plage détectée : `seconds` est la borne basse, `seconds_max` la borne haute, `label` contient l’expression source complète.
- Couvrir les heures FR/EN avec `-`, `–`, `à` et `to`, ainsi que les minutes/secondes et `1 h 30` déjà reconnus.
- Préserver les bornes existantes (24 heures, quatre minuteurs proposés au maximum), sans modification rétroactive des versions déjà enregistrées.
  Conformément au contrat actuel, une borne haute seule supérieure à 24 h devient `seconds_max: null` si la borne basse est valide ;
  cela ne rejette pas la borne basse. Un maximum inférieur au minimum ne constitue pas une plage valide et ne doit pas être inversé silencieusement.
- Présenter les deux bornes ; le lancement doit correspondre à la borne choisie explicitement, jamais à une borne haute déduite silencieusement.
  Appliquer cette règle à la fiche (`timerBlock` dans `components.js`) comme à la cuisine : texte, phrase Siri, URL Raccourcis et
  `timer_launches.duration_seconds`, lorsqu’un lancement est enregistré, utilisent la même valeur choisie.
- Une proposition invalide ne lance rien. L’application continue de distinguer demande à Siri, ouverture de Raccourcis et absence d’accusé d’Horloge.

La durée corrigée ne rend pas le miroir persistant : ses lancements sont déjà dans `timer_launches`, mais sa reconstruction après navigation reste L7.
Ce futur lot devra définir identité, relance, appareil et échéance en réutilisant ce magasin. Aucun second registre de minuteurs n’est créé dans L0.

## 9. Copier et partager les mêmes courses — C08

Un choix visible commun aux deux boutons : **Ce qu’il reste à acheter** (défaut) / **Liste complète**.
Copier et Partager utilisent une même préparation des lignes et le même état des cases courant.

- Mode restants : inclure seulement les lignes non cochées, avec leurs quantités et détails utiles inchangés.
- Mode complet : inclure toutes les lignes en conservant les marques `[x]` et `[ ]` déjà prises en charge par le domaine.
- Si tout est coché en mode restants : afficher « Rien à acheter » et permettre de choisir Liste complète ; ne pas copier/partager un texte vide annoncé comme réussi.
- En l’absence de partage natif, Copier reste disponible. Une annulation du partage ne devient ni une erreur affichée ni un succès.
- Un échec réel de copie/partage conserve la liste et le choix ; les succès ne sont annoncés qu’après résolution de l’action correspondante.
- Aucun changement de modèle ou promesse de liste collaborative ; cette fonctionnalité transmet du texte.

## 10. Contrat de compatibilité et architecture

| Donnée | Écriture L0 | Lecture ancienne / synchronisation / archive |
|---|---|---|
| Traduction | Tableaux complets avec vides + `alignment_format: 1` | Champ absent = ancien format à vérifier ; champs inconnus non réputés valides ; les tableaux et textes doivent survivre au transport et au ZIP |
| Heure de repas | Même champ `serve_at` et même instant ISO | Pas de migration des dates ; changement de formatage de l’éditeur seulement |
| Session cuisine | Fusion conditionnelle du champ existant `active_version_id` | Aucun nouveau magasin ; progression concurrente conservée |
| Durées | Contrat existant `seconds` / `seconds_max` | Versions précédentes intactes ; pas de réinterprétation automatique des anciennes durées |
| Courses | Aucun nouveau champ métier | Cases existantes et liste inchangées ; choix de sortie limité à la vue |

Un ancien éditeur peut reconstruire une traduction sans conserver le marqueur : le nouveau lecteur la requalifie comme ancienne, sans lui accorder d’alignement fiable.
En revanche, l’ancien éditeur redécoupe une étape multiligne lors de l’enregistrement ; l’ancien lecteur conserve son index mais aplatit visuellement les paragraphes.
La publication doit inviter à recharger les clients concernés ; L0 ne promet pas leur correction à distance.
Une version inconnue du marqueur reste consultable comme texte à vérifier ; un retour logiciel en arrière n’est pas présenté comme une solution conservant toutes les garanties.

Fichiers principalement concernés : `src/ui/recipe-edit.js`, `recipe.js`, `meals.js`, `cook.js`, `components.js`, `grocery.js`, `src/domain/timers.js`, `lines.js`, `grocery.js` et `src/i18n/en.js`.
Un petit lecteur/validateur partagé de traductions peut être ajouté sous `src/domain/` pour éviter des règles différentes entre éditeur et fiche.
Le contrat des primitives existantes de `src/model/repo.js` / `src/core/db.js` suffit a priori ; le modifier seulement si une reproduction établit un manque précis.

Version applicative cible proposée : **0.22.0**. `DB_VERSION` reste **4** : aucun index ni magasin nouveau.
Pas de SQL ni déploiement de fonction assistant attendu. Vérifier néanmoins dans les tests que le transport et les archives préservent le nouveau champ et les positions vides.
Le cache sera `cuisine-os-v0.22.0-1` au premier commit applicatif du lot, puis son suffixe sera incrémenté à chaque commit de code comme l’exige `AGENTS.md`.
Tout nouveau module sera ajouté à `SHELL` et, s’il affiche des textes, à `MODULES_NEUFS`.

## 11. Vérifications et critères d’acceptation

Écrire d’abord les reproductions comportementales ciblées et lire leur échec sur la base, puis les faire passer avec le correctif.
Utiliser des bases et profils jetables, des horloges contrôlées et des interfaces navigateur injectées. Aucun compte privé ni appel assistant nécessaire.

| ID | Scénario | Résultat exigé |
|---|---|---|
| L0-T01 | Traduire le premier et le troisième ingrédient, laisser le deuxième vide | Le deuxième reste à sa place ; le troisième ne s’affiche jamais en deuxième |
| L0-T02 | Traduire une étape à deux paragraphes puis une autre étape | Deux étapes, paragraphes internes conservés après sauvegarde/rechargement/réédition |
| L0-T03 | Anciennes traductions : tableaux courts, longs et de même longueur | Aucun texte perdu ; pas de fausse réparation ; réattribution/revue explicite |
| L0-T04 | Source modifiée, mauvaise version, format inconnu, données invalides ou hors bornes | Refus ou repli source explicite sans perte ; aucune application à une autre version |
| L0-T05 | Supprimer la recette dans une deuxième connexion avant sauvegarde de l’éditeur | Aucune résurrection, version/page/séance ni capture supplémentaire ; formulaire intact |
| L0-T06 | Supprimer recette/version ou modifier traduction pendant une saisie de traduction | Écriture entière refusée ; pas de traduction orpheline ni d’écrasement silencieux |
| L0-T07 | Photo, note ou favoris modifiés pendant l’édition | Les données non éditées concurrentes survivent au correctif |
| L0-T08 | Repas à 19 h à Toronto, en été/hiver ; autre fuseau | Même instant, heure locale attendue et aucun décalage à la réouverture |
| L0-T09 | Champ vide/invalide, heure inexistante, heure répétée et seconde occurrence déjà enregistrée | Règles du § 6 observées, aucune normalisation silencieuse |
| L0-T10 | Repas A/B, choisir B, ouvrir sa fiche puis revenir et recharger | Onglet, recette, version, portions et étape concordent |
| L0-T11 | Choix A/B/A rapide, progression concurrente, session terminée/supprimée, version retirée de la session | Dernier choix valide conservé ; ni perte de progression ni réactivation ni sélection disparue |
| L0-T12 | 30/61/90/3601/3661 s et plages FR/EN dans la fiche et la cuisine | Même borne pour phrase, texte, raccourci et lancement enregistré ; plage fidèle |
| L0-T13 | Bornes excessives, durée invalide, plus de quatre propositions | Garde-fous conservés ; aucune durée inventée ou lancement invalide |
| L0-T14 | Courses partiellement/toutes cochées ; deux modes | Texte Copier/Partager identique, état et cas vide exacts |
| L0-T15 | Partage indisponible, annulé ou rejeté ; presse-papiers refusé | Repli et message appropriés ; aucune modification de la liste |
| L0-T16 | Traduction format 1 avec vides synchronisée puis archivée/restaurée | Positions, textes, version et marqueur identiques ; ancienne archive toujours lisible |

Suites à compléter selon les comportements : `tests/tests.js`, `tests/carnet.js`, `tests/backup.js` et les harnais `tests/sync*.js`.
Un module ciblé L0 peut être ajouté si cela clarifie les scénarios ; ne pas inventer de suites `tests/timers.js` ou `tests/repas.js` déjà présentes.
Les tests observent rendu, écritures et résultat ; ils ne recherchent pas une chaîne dans le source.

Après les tests ciblés : suite navigateur complète, Node en série, migrations générées `--check`, syntaxe des fichiers modifiés et `git diff --check`.
Remettre l’épingle à la mesure réelle (base : 7117 avant assertion finale, bilan 7118). Toute assertion retirée doit être justifiée ; ne pas promettre un total avant exécution.

Vérifier les écrans touchés à 320, 390, 768, 900 et 1280 px, au clavier et avec zoom texte à 200 % : champs segmentés lisibles,
source et traduction identifiables, aucun débordement ou contrôle caché. Jouer réellement les parcours traduction, repas et courses dans un profil jetable.
Ces contrôles ne remplacent pas l’essai physique de Neegan sur son téléphone, ni un essai Siri/partage natif.

Les cinq parcours globaux du plan sont des critères du programme entier : L0 en couvre seulement les parties décrites ici.
Il ne sera pas déclaré « terminé tout le plan » après ces correctifs.

## 12. Ordre de réalisation après relecture

1. Fixer les données témoins et les reproductions rouges des six correctifs.
2. Construire ensemble C01/C02 : lecteur compatible, édition segmentée et gardes d’écriture.
3. Corriger C03 et vérifier les fuseaux/changements d’heure.
4. Corriger C05 puis la précision des durées C06, sans réécrire la session depuis une copie périmée.
5. Unifier la sortie des courses C08 et ses états d’échec.
6. Vérifier synchronisation/archives, régressions et parcours d’écran ; mettre à jour versions et documentation de l’état réellement atteint.

À chaque tranche, conserver un état cohérent. Aucune promesse de délai ni gain chiffré sans mesure.
La publication est une étape ultérieure : cette spec ne modifie pas le site actuellement en 0.21.1.

## 13. Suite du programme et décisions qui restent séparées

- L1 : corbeille individuelle, garde des anciens clients, restaurations et convergence ; renforcer C09 avant d’élargir la suppression.
- L3 : actions visibles et retour à la recherche, en parallèle des parties indépendantes de la corbeille.
- L5 : révisions de source pour C04 ; conserver les anciennes lectures et les corrections d’index.
- L6 : traduction complète explicite, qualité, coût, version exacte et français principal ; coordonner sa lecture avec L7.
- L7 : minuteurs persistants à partir de `timer_launches`, disposition cuisine, voix et maintien de l’écran.
- E1 Cookidoo : proposition expérimentale distincte. Le choix antérieur I3 excluait les interfaces non officielles ; le plan propose de les étudier.
  Cette différence n’est pas résolue implicitement par L0. Aucune collecte d’identifiants ni connexion Cookidoo n’est engagée.

Les références externes du plan ne sont pas revérifiées par cette spec de correctifs locaux. Les capacités des plateformes et du TM7 devront être revérifiées au lot concerné.

## 14. État de la construction

Plan lu, base comparée et principaux constats confrontés au code. Les reproductions isolées sont distinguées des essais de l’application.
Au stade de la préparation, aucun code applicatif n’avait changé et aucune suite complète n’avait été relancée.

Neegan a ensuite approuvé ce périmètre sur « go ». La construction et ses preuves sont suivies dans
[le plan d’exécution L0](../plans/2026-10-29-l0-reference-correctifs.md).

Construction locale réalisée en 0.22.0. La revue a également fait corriger les fusions heure/portions et cases de courses,
ainsi que la progression d’une version retirée de la session. Les contrôles de texte agrandi ont nécessité une adaptation
de la hauteur de navigation et des colonnes. Ces correctifs soutiennent les critères ci-dessus sans élargir L0 à la refonte.
La publication reste une étape distincte ; la dernière version publiée est 0.21.1.
