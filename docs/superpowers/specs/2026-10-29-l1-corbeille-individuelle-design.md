# L1 — Corbeille individuelle, durable et synchronisable

**29 octobre 2026 — Spec approuvée par Neegan sur « ok ». Construction locale autorisée ; publication et migration distante restent des gestes séparés.**

## 1. Base, besoin et périmètre

Suite du [plan directeur](../../lots/2026-10-29-plan-directeur-interface-fonctions.md), sections 8, 19, 20 et 21.
Base de construction : `9c823b0`, lot L0 terminé localement, application **0.22.0**, IndexedDB **4**, archive **1**.
Branche de préparation : `l1-corbeille-individuelle`. Dernière publication documentée : **0.21.1**.
L0 est conservé dans cette branche ; il n’a pas été publié entre les deux lots.

Résultat attendu : retirer une recette de la bibliothèque, fermer l’application immédiatement après la confirmation locale,
puis la retrouver dans une corbeille et la restaurer avec ses versions, photos, notes et sources. Un ancien éditeur ne doit jamais la rétablir.

**Premier périmètre proposé : les recettes autonomes**, dont `edition_id` est absent ou nul : signets web, recettes web lues,
saisies personnelles et créations IA. Le code ne possède pas de type fiable « recette personnelle » ; une adresse invalide ne doit pas
empêcher le retrait. Une recette liée à une édition reste hors de ce geste, même si elle possède aussi une URL.
Ce choix limite L1 ; il ne transforme pas les recettes de livres en données supprimables par cascade.

Inclus : entrée de corbeille depuis la bibliothèque, geste depuis la fiche, Annuler, consultation et restauration,
gardes des écritures tardives, synchronisation, compatibilité des anciens clients et sauvegardes.
Exclus : retrait de livre ou de groupe, sélection multiple, purge, durée de conservation, suppression d’octets,
refonte générale des cartes/menus, brouillons durables, traduction automatique et Cookidoo.
L2 traitera les livres et le renforcement de C09 ; L3 élargira la gestion depuis les cartes.

## 2. Ce qui existe et les preuves de préparation

| Point actuel | Conséquence pour L1 |
|---|---|
| `repo.save`, `saveBatch`, `transitionner` nettoient et horodatent les écritures | Ajouter une garde commune de cycle de vie, y compris lorsqu’un lot n’écrit que des versions ou traductions |
| Les gardes L0 contrôlent l’existence et la source | Une recette mise à la corbeille existe toujours : étendre ces gardes |
| `sync_push` remplace les données complètes selon `updated_at` | Un champ JSON seul peut être effacé ; règle serveur nécessaire |
| `pull.decider` et `conflits.garderIci` peuvent renvoyer une copie locale plus récente | Séparer les conflits de contenu des commandes de corbeille |
| `lots.js` déduplique les entrées par fiche et relit sa valeur actuelle | Ne pas traiter corbeille → restauration comme deux simples `put` |
| `state.getData` construit des maps exhaustives utilisées par les anciens repas | Ajouter des projections actives, conserver les maps historiques |
| `applyArchive` réécrit et réhorodate les recettes | Une sauvegarde ne doit pas devenir une restauration implicite d’une recette |
| `db.open` ferme sa connexion sur `versionchange` | Tester une migration avec index réel et le refus de réouverture par l’ancien code |

Reproduction isolée sur le code de L0 : une copie active locale plus récente face à un marqueur distant de corbeille produit
`conflit_renvoyer` ; une copie active distante plus récente face à ce marqueur local produit `ecrire`.
Cela confirme la limite de l’arbitrage actuel ; ce n’est pas un essai de corbeille déjà construite.

Essai IndexedDB en profil Chrome jetable : ouverture d’une base témoin en version 4, passage en 5 avec index `trashed_at`,
fermeture de l’ancienne connexion, puis réouverture en 4 refusée par `VersionError`.
Preuve locale ignorée : `.superpowers/sdd/2026-10-29-l1-spec/preuves.json`.
Aucune suite applicative relancée pour rédiger cette spec. Dernier bilan L0 : **7397/7397**, Node **230/230**.

## 3. Parcours et textes d’écran

### 3.1 Retirer depuis la fiche

La fiche éligible propose **Mettre à la corbeille**, sans succession de confirmations.
Pendant l’écriture, le bouton est désactivé. Le succès n’apparaît qu’après validation de la transaction locale.
La fiche reste ouverte, en consultation, avec un bandeau **Recette mise à la corbeille** et **Annuler**.
Annuler est une vraie restauration conditionnée par l’opération qui vient de réussir ; ce n’est ni un délai en mémoire ni un effacement différé.

Le bandeau est un élément accessible avec bouton, pas un bouton fictif dans le toast textuel actuel de 2,8 secondes.
Une erreur laisse l’état précédent intact et affiche **La recette n’a pas pu être mise à la corbeille. Réessaie.**
Si la fiche a changé, expliquer qu’il faut la recharger, sans perdre un formulaire déjà ouvert.

### 3.2 Retrouver et restaurer

Lien permanent **Corbeille** dans la bibliothèque ; route proposée `#/corbeille`.
Liste triée par date de retrait, titre en départage : titre, provenance disponible, date, **Consulter**, **Restaurer**.
La liste et son état vide reposent sur les données réelles. Pas de bouton Vider, de purge ni de délai annoncé.

Restaurer conserve les identifiants, les versions et tous les liens. Depuis la corbeille, la ligne disparaît après l’écriture réussie ;
le focus passe à la ligne suivante ou au titre de l’état vide. Depuis la fiche, le bandeau disparaît et ses commandes redeviennent disponibles.
Une restauration devenue périmée est refusée : Annuler ne doit pas défaire une mise à la corbeille indépendante plus récente.

### 3.3 Bibliothèque active et consultation historique

Les listes ordinaires, favoris, recherche, redécouverte, suggestions de plats, choix de nouveau repas et choix de source d’inventaire
excluent les recettes retirées. Les exports culinaires globaux portent sur la bibliothèque active ; la sauvegarde complète inclut la corbeille.

Les anciennes URL de fiche, y compris une version précise, restent consultables avec **Cette recette est dans la corbeille** et **Restaurer**.
Les versions, ingrédients, étapes, sources, traductions, notes et photos restent lisibles.
Pas de favori, correction, traduction, changement de photo, repères, adaptation ou nouvel import appliqué à une recette retirée.

Les éléments d’anciens repas, listes de courses, inventaires et historiques restent présents avec une mention ; aucune référence n’est retirée automatiquement.
Les courses existantes restent cochables. Un nouveau repas, une nouvelle liste issue d’un repas, « Refaire ce repas » ou une nouvelle session
qui comporte une recette retirée demande sa restauration ou son retrait explicite de la nouvelle sélection ; aucune omission silencieuse.

**Session de cuisine déjà créée :** consultation, progression, minuteurs et bilan restent utilisables ; ils ne restaurent pas la recette et
ne modifient pas ses versions. Les observations et photos d’une cuisson existante restent éditables comme historique.
Les notes permanentes portées par `recipes` attendent la restauration. Les gardes de compte s’appliquent aussi aux écritures historiques.

Une URL web déjà conservée dans la corbeille donne **Cette recette est dans la corbeille**, **Consulter**, **Restaurer**.
Le dédoublonnage examine les données exhaustives : aucun doublon ou nouvel appel assistant automatique.

## 4. Modèle proposé et migration locale

Deux champs réservés sur `recipes`, distincts de `availability` et des tombales serveur :

| Champ | Contrat |
|---|---|
| `trashed_at` | Date ISO UTC valide du geste de retrait, ou `null` pour une recette active |
| `lifecycle_id` | Identifiant opaque de la dernière commande de cycle de vie ; conservé après restauration |

Anciennes recettes sans ces deux champs : actives, cycle initial `null`. Absence et `null` sont normalisés par un lecteur unique.
Une recette portant un jeton non nul doit porter explicitement `trashed_at`, nul ou date ; pas de paire partiellement comprise.
Une paire mal formée ou un format futur inconnu n’est pas interprété comme actif : état à vérifier, conservation des données, mutations refusées.
Ces fiches restent retrouvables dans une section **À vérifier** de la corbeille, en lecture seule, même si leur date ne peut pas figurer dans l’index.
Les identifiants et dates sont validés et bornés ; les textes reçus restent rendus comme texte.

Le jeton après restauration distingue une fiche active d’une fiche redevenue active : une réponse commencée avant le retrait reste périmée,
même si la recette a été restaurée entre-temps. Une écriture de contenu ne modifie jamais ces deux champs depuis sa copie de formulaire.
La date sert à l’affichage et au tri, pas à départager des commandes concurrentes.

Ajouter et **utiliser réellement** l’index `recipes.trashed_at` pour le chargement de la corbeille. Les valeurs nulles/absentes n’y sont pas listées.
Cela justifie **DB_VERSION 5** ; aucun nouveau magasin métier synchronisé. Migration sans réécriture des versions ni modification des identifiants.
Le modèle réservé de groupe de L2 n’est pas anticipé par des champs inutilisés.

## 5. Écritures métier et compte propriétaire

Créer un domaine de cycle de vie, par exemple `src/domain/corbeille.js`, et une primitive conditionnée commune au niveau du dépôt.
La commande capture au départ : recette, cycle attendu, contexte de compte/appareil et, si nécessaire, version source.
Dans la transaction, relire la recette et le propriétaire, vérifier existence, état actif, cycle attendu et préconditions du parcours.
Une création volontaire est distincte d’une modification d’objet existant : aucun repli sur une vieille copie si la cible manque.

Composer ces vérifications avec la fusion existante en **une seule condition par recette**, car le bas niveau refuse les conditions dupliquées.
Un refus lève une erreur métier et annule le lot entier, capture comprise ; retourner `null` ne suffit pas à annuler les autres écritures.
La règle couvre aussi un lot n’écrivant que `recipe_versions`, `recipe_translations`, substitutions ou rattachements.
Un helper facultatif utilisé uniquement par les nouveaux boutons ne remplit pas ce contrat.

Les commandes `mettreALaCorbeille` et `restaurerRecette` relisent le cycle attendu et n’écrivent que le cycle de vie sur la fiche courante.
Vérifier aussi l’éligibilité sans édition dans la transaction : un rattachement concurrent à un livre fait refuser le geste L1.
`trash` exige l’état actif ; `restore` exige l’état retiré. Un réessai reconnu de la même opération reste sans nouvel effet.
Elles préservent photo, favori, note, repères, sources et version courante reçus entre-temps. Marqueur et commande à envoyer sont durables dans la même transaction.
Les traitements ne doivent pas écrire sous le nouveau propriétaire si le compte a changé pendant l’attente ; la génération du document seul ne suffit pas entre onglets.

### Chemins à couvrir explicitement

- Édition et traduction L0, favori, notes permanentes, « Marquer testée », substitutions et rattachement à un plat.
- Import ciblé, lecture web **y compris « Ajouter sans remplacer »**, adaptation IA, Thermomix et repères.
- Photo du plat, photo issue d’une page et résultat tardif de téléchargement. Préparer/réencoder/hacher hors transaction ; conserver octets et lien
  dans une transaction conditionnée, ou conserver un fichier déjà partagé sans modifier sa propriété. Aucun nettoyage automatique des fichiers dans L1.
- Nouvel ajout à un repas, nouvelle liste, nouvelle session et nouvelle source d’inventaire depuis un écran ancien.
- Fusion/restauration d’archive, réception et résolution des conflits : aucun chemin de contournement du cycle.

Un import déjà en cours peut finir de conserver son résultat dans son journal sous le même compte, sans l’appliquer à la recette retirée.
Après restauration, une relecture explicite vérifie à nouveau cible/source/cycle avant conservation ; aucun résultat ancien n’est appliqué automatiquement.
Les formulaires refusés conservent leur texte dans l’écran. Leur survie à la fermeture relève de L4, pas d’une promesse de L1.

## 6. Synchronisation : commande explicite et convergence

**Une migration serveur additive est nécessaire**, même sans nouvelle table métier : le remplacement JSON actuel ne garantit pas la corbeille.
Modifier le transport existant, pas créer un second moteur de synchronisation.

### 6.1 Commandes et file locale

Une entrée durable de cycle de vie porte au minimum `action` (`trash` ou `restore`), `recipe_id`, `operation_id`, `base_cycle_id`, `at`
et le propriétaire de la file. Le marqueur local prend `operation_id` ; restaurer conserve ce jeton avec `trashed_at: null`.
La charge utile de la commande est immuable. L’outbox peut porter une nouvelle sorte d’opération, sans nouveau magasin.
L’accusé nomme `operation_id` et retire seulement ses séquences ; un accusé par simple couple magasin/identifiant serait insuffisant.

Ces commandes **ne sont pas dédupliquées comme les `put`**. Conserver leur ordre et une seule commande en vol par recette ; attendre son accusé
avant la suivante. Les écritures ordinaires capturent leur cycle attendu au moment du geste, jamais au moment d’une relecture pour l’envoi.
Définir des barrières par recette, y compris pour les versions/traductions : un contenu préparé sous un ancien cycle ne reçoit pas rétroactivement le nouveau jeton.
L’envoi initial et la reprise après fermeture respectent les mêmes barrières.

Pour une recette jamais envoyée, une commande `trash` peut porter un instantané de création validé, utilisé **seulement si la recette serveur est absente**.
Le serveur la crée directement retirée ; pas de passage actif visible obligatoire. Si elle existe, cet instantané n’écrase pas son contenu.
Les anciennes séquences de création couvertes par cet instantané ne sont retirées qu’avec son accusé ; les autres écritures sont réconciliées,
jamais abandonnées en bloc parce qu’une commande de corbeille existe.
Une commande `restore` ne crée jamais une recette absente et ne réutilise pas une tombale physique.

### 6.2 Arbitrage serveur

Sous verrou par propriétaire/recette, vérifier le cycle courant avant toute écriture :
le chemin proposé est une RPC versionnée `sync_push_v2`, avec les contrôles centraux couvrant aussi l’ancienne RPC.
Les écritures d’enfants portent leur contexte recette/cycle attendu ; il ne se déduit pas d’un jeton ajouté après le geste.
La transition doit aussi être cohérente : actif → retiré pour `trash`, retiré → actif pour `restore`, avec éligibilité relue côté serveur.

| Requête | Décision |
|---|---|
| Commande avec base égale au cycle courant | Appliquer uniquement la transition de cycle et l’accuser |
| Réessai de l’opération qui est encore courante | Accuser sans nouvel effet |
| Commande avec une autre base | Refuser avec état courant ; aucune restauration ou nouvelle base automatique |
| Écriture ordinaire avec cycle courant, recette active | Appliquer les règles existantes de contenu, conserver le cycle courant |
| Écriture ordinaire sur recette retirée ou avec cycle périmé | Refuser, même avec un `updated_at` plus récent |
| Ancien client sans contrat de cycle sur une recette ayant déjà changé de cycle | Refuser la mutation et préserver l’état serveur |

La première transition validée fait foi ; une intention concurrente perdante doit être revue sur l’état reçu.
Si une commande échoue, ses commandes dépendantes et contenus dépendants restent conservés mais bloqués, sans changement silencieux de base.
Une commande Annuler périmée ne peut donc pas restaurer une autre opération de retrait.

Protéger également les écritures directes REST, les suppressions génériques et les RPC de purge existantes : un ancien chemin ne doit pas
effacer la fiche protégée ou modifier ses champs réservés. La protection serveur couvre les mutations d’enfants qui modifient une recette ;
elle distingue les écritures autorisées d’historique. Conserver les contrôles d’accès par propriétaire et les protections de fichiers déjà présentes.
L’effacement global explicite du compte reste un contrat séparé : L1 ne le transforme pas en corbeille et n’en supprime pas l’accès.
Le détail des fonctions et privilèges doit être couvert par des preuves SQL exécutables, pas seulement un serveur JavaScript simulé.

### 6.3 Réception, conflits et états visibles

Le cycle confirmé du serveur s’applique indépendamment du seul horodatage de contenu. Les opérations locales en attente ne sont pas effacées par un écho ancien.
Réconcilier la base confirmée et les opérations encore valides dans une transaction, avec le curseur de réception.
Conserver une copie de travail refusée dans le mécanisme de conflit ; ne jamais renvoyer automatiquement un ancien état actif pour « gagner » avec une date neuve.
Les conflits de cycle non résolus échappent à la purge automatique actuelle des conflits après 30 jours.
**Garder celle d’ici** peut traiter un conflit de contenu compatible, mais ne restaure pas une recette. La restauration passe par sa commande dédiée.

Le succès local signifie **sur cet appareil**. La file et les états existants indiquent l’attente d’envoi, l’échec ou le besoin de relecture.
Une réponse tronquée, une panne ou un refus de protocole ne vaut pas accusé ; aucune commande n’est retirée de la file sur cette base.
L’abandon manuel d’un envoi ne transforme pas une intention non confirmée en état synchronisé : réconcilier son marqueur avec le dernier état confirmé.

## 7. Anciennes installations et publication

Sur une même origine, la migration IndexedDB 4 → 5 ferme les connexions précédentes ; leur réouverture en 4 échoue.
Tester cela avec le vrai ancien code L0 et une saisie ouverte, pas seulement avec la preuve isolée de préparation.
Afficher un besoin de mise à jour dans les nouveaux parcours ; préserver les saisies tant que l’ancien écran reste ouvert.

Sur un autre appareil resté hors ligne, aucun serveur ne peut changer le code déjà chargé : il peut encore montrer une ancienne bibliothèque.
**La garantie porte sur l’absence de résurrection des données partagées après reconnexion**, pas sur l’affichage immédiat d’un appareil déconnecté.
Ses écritures périmées restent récupérables après mise à jour et réconciliation ; elles ne sont pas adoptées comme restauration.

Prévoir une capacité serveur vérifiable pour le contrat L1 et traiter son absence comme une incompatibilité, sans quarantaine trompeuse des recettes.
Avant activation sur un compte, vérifier cette capacité ; une capacité déjà confirmée permet les gestes hors ligne avec mise en attente.
Sans compte, la corbeille reste locale. Une connexion ultérieure utilise le même contrôle avant envoi.

Déploiement envisagé : migration additive et preuves d’abord, puis application compatible ; aucune suppression de données ou remise à zéro des files.
Fichier proposé : `supabase/migrations/0008_corbeille_recettes.sql`, avec preuves dédiées et procédure de publication.
Le générateur doit produire cette migration explicitement sans réécrire les anciennes migrations appliquées.
Ne pas revenir à une application antérieure à L1 sur une bibliothèque contenant ces états ; conserver les protections serveur lors d’un retour arrière logiciel.
La construction et la préparation SQL ne constituent pas une application de migration ni une publication autorisée par cette spec.

## 8. Archives et sauvegardes

La sauvegarde complète conserve recettes actives/retirées, versions, sources, traductions, historiques et fichiers partagés.
Ne pas utiliser les projections actives pour construire l’archive. Aucun octet n’est supprimé lors d’un retrait ou d’une restauration.

Proposition : **format d’archive 2** à l’export, lecture des formats **1 et 2**. L’ancien lecteur refuse le format 2 plutôt que d’ignorer le cycle de vie.
Une archive 1 restaurée sur une base vide crée des recettes actives ; une archive 2 restitue ses états de cycle validés.
Les archives n’embarquent pas les secrets, le propriétaire de la file ni les magasins internes de synchronisation.

Sur une base contenant déjà la même recette, l’import de sauvegarde ne modifie jamais son cycle implicitement.
**Choix borné pour L1 : si un cycle diffère, refuser toute l’écriture de l’archive, en fusion comme en remplacement.**
Montrer les recettes concernées et permettre la consultation de l’archive sans écriture. Ne pas conserver seulement la ligne `recipes`
tout en remplaçant ses versions, traductions, photos ou sources : cela fabriquerait un contenu hybride ou supprimerait ses dépendances.
Comparer jeton et état, puis revalider dans la transaction finale ; un changement après inspection annule l’ensemble.
Ce refus n’efface ni la base ni l’archive ; une fusion sélective d’agrégats nécessiterait un contrat ultérieur.
Le bilan et `verifyRestored` doivent distinguer une opération refusée d’une restauration réussie.

Après import sur une base vide puis connexion à un compte existant, réconcilier les cycles avec le serveur avant tout envoi d’instantané.
Un état de sauvegarde n’autorise pas une restauration d’une recette du compte. Une différence devient un conflit explicite.
Le démarrage depuis un instantané de cycle n’est permis que pour une recette réellement absente du serveur, jamais sur une tombale.
Tester séparément archive d’une commande encore hors ligne, import local et connexion ultérieure : ne pas confondre sauvegarde du contenu
et preuve que cette commande avait déjà été acceptée sur le compte.

## 9. Fichiers, versions et lots de construction

| Ensemble | Évolution attendue |
|---|---|
| Domaine et dépôt | Nouveau domaine corbeille ; lecteur/validateurs de cycle ; garde commune de mutation et création explicite |
| Schéma et base | Champs documentés, index `trashed_at`, migration DB5 ; transactions et capture conservées |
| Synchronisation | `outbox`, `lots`, `push`, `pull`, `reponses`, `conflits`, `backfill`, transport et serveur factice : commande distincte, base attendue, reprises |
| Serveur | Migration additive, protection RPC/REST, capacité et preuves SQL ; aucun outil assistant nouveau |
| Contexte et vues | Projections actives dans `state.js`, parcours de fiche/bibliothèque/corbeille, filtres des nouveaux choix, historique lisible |
| Mutations associées | Imports, éditeur, IA, repères, Thermomix, photo, repas et inventaire : même garde de cycle/compte |
| Sauvegarde | Format2, lecture1/2, arbitrage de fusion et bilan fidèle |

Version applicative cible **0.23.0**, cache `cuisine-os-v0.23.0-1` au premier commit applicatif du lot.
Ces valeurs sont appliquées dans la construction locale. Les modules sont ajoutés à `SHELL`, les nouveaux textes à `t()`/anglais et les modules d’affichage à `MODULES_NEUFS`.

Ordre proposé après relecture :

1. Figer les fixtures, le contrat de cycle et les reproductions rouges ; prouver l’index et les refus locaux.
2. Construire commandes, capture, serveur et réconciliation ; tests croisés anciens/nouveaux clients avant exposition de l’action.
3. Étendre les mutations associées et les archives ; vérifier compte, photos et imports tardifs.
4. Exposer la corbeille et les projections actives ; vérifier les parcours historiques et l’accessibilité.
5. Exécuter les validations complètes, mettre à jour l’état et préparer une publication distincte avec sa preuve serveur.

## 10. Critères de réception

| ID | Scénario et résultat attendu |
|---|---|
| L1-01 | Web avec version/photo/note → retrait → fermeture → réouverture hors ligne → restauration : mêmes identifiants et contenus |
| L1-02 | Signet sans version, saisie ancienne sans origine et création IA : geste disponible ; recette d’édition hors périmètre, y compris après rattachement concurrent |
| L1-03 | Transaction de retrait refusée/quota/double clic : aucun faux succès, marqueur et file cohérents |
| L1-04 | Deux connexions : éditeur, traduction, favori ou note ouverts avant retrait → sauvegarde refusée, saisie conservée, aucun enfant/outbox parasite |
| L1-05 | Import Web « Ajouter sans remplacer », IA, Thermomix, repères, substitution : résultat tardif non appliqué, journal conservé sans clôture trompeuse |
| L1-06 | Retrait → restauration → ancien résultat : refus du jeton périmé malgré l’état actif |
| L1-07 | Photo tardive et changement de compte : aucun lien ni octet écrit sous le nouveau propriétaire ; fichier partagé intact |
| L1-08 | Collections actives excluent la recette ; anciens repas/courses/inventaire/cuissons et versions directes restent lisibles |
| L1-09 | Ancien écran créant repas/liste/session : cible retirée refusée ; session déjà créée et son bilan restent utilisables |
| L1-10 | Même URL réajoutée : restauration proposée, aucun doublon ni appel assistant |
| L1-11 | Retrait/restauration rapides hors ligne, fermeture et reprise : ordre de commandes conservé, pas de déduplication destructive |
| L1-12 | Deux appareils, commandes concurrentes et Annuler périmé : base comparée, perdant conservé pour revue, aucune restauration implicite |
| L1-13 | Réessai après réponse perdue, réponse incomplète, interruption entre deux commandes : idempotence et aucune perte de file |
| L1-14 | Ancien client avec date plus récente, ancien `sync_push`, PATCH REST, suppression/purge : cycle serveur protégé |
| L1-15 | Ancien onglet DB4 pendant migration DB5 : fermeture, refus de réécriture ; données et saisie récupérables selon les limites annoncées |
| L1-16 | Recette jamais envoyée retirée hors ligne : création distante directement en corbeille ; restore ne crée jamais une cible absente |
| L1-17 | Réception et « Garder celle d’ici » : aucun renvoi automatique d’un état actif périmé, copie de travail consultable |
| L1-18 | Archive1/2 sur base vide ; fusion/remplacement sur base avec cycle divergent : refus intégral sans aucun objet/fichier effacé ou remplacé ; ancien lecteur refuse2 |
| L1-19 | Archive d’un état non encore envoyé puis connexion : pas de cycle imposé au compte sans arbitrage |
| L1-20 | Photo partagée couverture/recette/cuisson : empreintes, octets et toutes les références conservés |
| L1-21 | Serveur incompatible ou hors ligne sans capacité connue : aucune fausse annonce de synchronisation, actions et motif cohérents |
| L1-22 | Clavier, focus après restauration, lecteur d’écran, 320/390/768/900/1280 et texte200 % ; geste trouvable sans passer par l’éditeur |
| L1-23 | Cycle mal formé ou inconnu : fiche conservée et retrouvable dans À vérifier, sans restauration ni réparation supposée |

Tests comportementaux rouges puis verts, bases jetables, deux connexions et deux moteurs avec transport simulé ; preuve SQL séparée sur serveur de test.
Suite navigateur complète avec épingle mesurée, Node en série, migrations générées `--check`, syntaxe, diff et cache.
Préserver la distinction entre preuve JavaScript, preuve SQL et essais sur comptes/appareils réels.
Au moins un parcours physique iPhone/Safari et une convergence entre deux appareils seront nécessaires pour annoncer la réception multiappareil.
Pas d’accès à un compte privé ni d’application distante de SQL pendant la préparation de cette spec.

## 11. État et relecture

Neegan a approuvé ce périmètre sur « ok » le 29 octobre 2026. La construction locale suit cette spec ;
son bilan et ses limites sont consignés dans le [rapport de construction](../plans/2026-10-29-l1-corbeille-individuelle.md).
Construction locale : navigateur **7656/7656** (épingle **7655**), Node **231/231**, PostgreSQL local **42 assertions**
et concurrence entre deux sessions. Les essais physiques et l’intégration Supabase distante restent à faire.
L0 est inclus dans la branche. L’approbation initiale portait sur la construction locale.
Neegan a ensuite demandé « deploy avant » : migration 0008 puis application 0.23.0 publiées le 29 octobre.
Le rapport distingue les preuves publiques, le correctif visuel 0.23.1 et les essais physiques encore à faire.
