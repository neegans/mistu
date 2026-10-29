# L2 — Corbeille des livres et restauration de groupe

**Statut : spec préparée sous autorisation globale, revue technique avant construction.** Neegan demande « deploy avant », puis
« et enchaine sur le restant des lots ». Cette autorisation globale n'est pas présentée comme une relecture de ce nouveau texte.
La revue technique a retenu le cycle d'édition et l'exception individuelle ; les preuves de réalisation restent à produire.
Base de travail : branche `l2-corbeille-livres`, issue de `752566d`. L0/L1 sont publiés en **0.23.1** (`d6b4488`), avec
IndexedDB 5, archive 2 et migration serveur 0008. La publication et ses preuves sont suivies dans `STATE.md` ; ce document n'annonce
aucune réalisation de L2.

Références : [plan directeur, notamment § 5 C09, 8, 19–21](../../lots/2026-10-29-plan-directeur-interface-fonctions.md),
[spec L1](2026-10-29-l1-corbeille-individuelle-design.md),
[bilan L1](../plans/2026-10-29-l1-corbeille-individuelle.md).

## 1. Résultat attendu et limites

Depuis la fiche d'un livre, Neegan peut retirer ce livre en choisissant de conserver ses recettes actives ou de les mettre avec lui
dans la corbeille. Le livre, ses recettes, les pages, les versions et les photos restent conservés. Une restauration ultérieure ne
défait pas un retrait individuel. Une ancienne modification, un import ou un autre appareil ne peut pas restaurer implicitement le livre.

Le « livre » du parcours est **une édition possédée**, identifiée par `book_editions.id`, comme la route actuelle `#/books/<id>`.
Deux éditions peuvent partager la fiche bibliographique `books` ; retirer l'une ne retire jamais l'autre. Le « groupe » est le retrait
de cette édition avec ses recettes. Ce n'est ni un Plat (`dishes`), ni une sélection multiple, ni une collection arbitraire.

L2 comprend aussi le retrait et la restauration individuels d'une recette liée à un livre : ils sont nécessaires pour consulter un
ancien repas et pour expliquer les exceptions à une restauration de groupe. L1 reste inchangé pour les recettes autonomes.

Hors périmètre : purge physique et libération des fichiers, suppression de Plat, sélection multiple, refonte générale des cartes L3,
nouvel éditeur L4, révisions de source L5, traduction intégrale L6 et connecteur Cookidoo E1. Aucun nouveau moteur de synchronisation,
magasin synchronisé ou appel assistant n'est nécessaire pour mettre à la corbeille ou restaurer.

## 2. Base réelle et C09

L1 fournit déjà les commandes explicites de cycle, la capture du propriétaire et de la génération de document, les gardes atomiques
du dépôt, les écritures de fichiers avec leurs liens, les conflits durables, la capacité serveur, la projection active et l'archive
complète. Ses jetons survivent à une restauration : une saisie antérieure au retrait reste périmée après le retour de la recette.

`src/ui/book.js::supprimerLivreVide` relit actuellement la vacuité hors de la transaction finale, détache les imports en plusieurs
écritures, puis supprime l'édition et parfois `books`. Sa condition finale ne couvre pas un import arrivé avec un statut inconnu.
Un refus tardif peut donc suivre des détachements déjà effectués. Ce chemin ne doit pas simplement accepter des livres remplis.

**Décision L2 pour C09 :** le livre vide utilise lui aussi la corbeille réversible. Retirer le bouton de suppression physique et
remplacer ses appelants par la commande d'édition. Aucun import n'est ignoré, aucune réponse brute effacée, aucune relation détachée
pour retirer un livre. Les suppressions génériques d'éditions et les anciens chemins serveur sont gardés : la faille ne doit pas
rester accessible derrière un ancien bouton. L'effacement explicite du compte conserve son contrat séparé.

## 3. Parcours, comptages et retour

### 3.1 Choisir les conséquences

L'action **Mettre à la corbeille** est dans les actions de la fiche du livre. Un livre contenant des données ouvre un dialogue :

| Choix | Effet visible | Conservation |
|---|---|---|
| **Retirer le livre, garder mes recettes** | Le livre quitte Livres ; les recettes actives restent dans Recettes et les sélections | Édition, attribution, sources, versions et historique |
| **Mettre le livre et ses recettes dans la corbeille** | Le livre et ses recettes actives quittent les nouvelles sélections | Même contenu, consultable et restaurable |
| **Annuler** | Aucun changement | Tout |

Afficher les nombres réellement calculés : recettes disponibles, recettes partielles, références, recettes déjà retirées, pages
source et imports ouverts/en cours. Réutiliser les définitions de disponibilité ; ne pas appeler « complète » toute valeur différente
de `reference_only`. Les imports au statut inconnu restent comptés comme « état à vérifier », jamais assimilés à terminés.
Les sources partagées et les anciens repas sont annoncés comme conservés, sans promettre une économie de stockage.

Le dialogue capture l'édition et le propriétaire à son ouverture. Avant l'écriture, la transaction relit le cycle et les dépendances
qui ont produit le bilan. Si le bilan local a changé, actualiser le dialogue et demander de reprendre le choix ; aucune mutation
partielle ne précède cette relecture. Ce bilan est celui des données connues sur l'appareil. La politique porte sur cette édition
et ses membres, pas sur une liste finie promise comme exhaustive de tous les appareils déconnectés.

Le livre réellement vide peut être retiré directement, comme une recette L1. Sa vacuité est revalidée dans la transaction ; s'il
s'est rempli, afficher le choix ci-dessus. Aucun chiffre fictif et aucune durée de conservation ne sont affichés.

### 3.2 Après le geste et dans la corbeille

Afficher la réussite après la transaction locale, fermer le dialogue, déplacer le focus vers un repère restant et proposer **Annuler**.
Annuler restaure uniquement si le jeton du retrait est encore courant. L'état de synchronisation distingue l'écriture locale de
l'acceptation distante. Une intention refusée reste consultable ; elle n'est jamais présentée comme synchronisée.

La corbeille existante accueille les éditions et les recettes. Une édition retirée avec ses recettes est une entrée de groupe
ouvrable, avec le détail des recettes et les exceptions. Éviter de compter une recette héritée deux fois dans le total annoncé.
Les retraits individuels restent identifiables et restaurables. Les états invalides restent visibles dans une zone à vérifier.

**Restaurer le livre** remet l'édition dans Livres. Avec le mode de retrait groupé, cela réactive les membres qui n'ont pas de retrait
individuel courant. Le bilan distingue ceux rétablis, ceux déjà actifs par restauration individuelle et ceux laissés dans la corbeille.
Une restauration ne remet pas en route un import ni un ancien appel assistant.

### 3.3 Consultation historique et recette conservée

Une route directe, un ancien repas, une liste ou une cuisson garde accès au contenu et aux sources. Une édition retirée porte la
mention **Livre dans la corbeille**. Une recette héritant du retrait porte **Recette dans la corbeille avec son livre**, avec
**Restaurer cette recette** et un accès au livre. Cette première action ne restaure pas tout le livre et ne détache pas sa provenance.

Une recette gardée ou restaurée seule peut être cuisinée, planifiée, annotée et complétée. Sa source indique que le livre est retiré.
Une recette effectivement retirée ne peut pas alimenter un nouveau repas, une nouvelle session ou une nouvelle ligne d'inventaire.
Les progressions, observations, photos et gestes d'inventaire d'un usage historique déjà créé suivent les exceptions strictes de L1.

Les ajouts de membres, l'index et l'administration du livre demandent sa restauration. Compléter une recette active déjà liée au
livre reste possible, y compris ajouter des pages nouvelles exclusivement rattachées à cette recette : son contexte explicite est
obligatoire et la mutation ne doit créer aucun autre membre. Modifier ou remplacer une page existante, même propre à cette recette,
demande d'abord de restaurer le livre ; une page partagée n'est jamais modifiée par cette exception. Ce parcours borné ne reprend pas
les permissions de l'import général. L2 n'invente pas une révision de source avant L5.

## 4. Modèle minimal : cycle d'édition et état effectif

### 4.1 Champs et lecteurs

Conserver le cycle propre des recettes (`lifecycle_id`, `trashed_at`) et ajouter sur `book_editions` :

```text
lifecycle_id : null | identifiant d'opération
trashed_at   : null | date ISO UTC canonique
trash_mode   : null | "keep_recipes" | "with_recipes"
```

Une ancienne édition sans ces champs est active, au cycle `null`. Après un premier geste, le jeton reste présent, même restaurée.
Une édition retirée exige une date et un mode valides. Une édition restaurée garde le jeton et porte `trashed_at: null`, `trash_mode: null`.
Identifiants d'opération et dates reprennent strictement les validations L1 ; les identifiants d'entités historiques restent des
chaînes non vides, sans leur imposer le format des nouveaux jetons. Toute combinaison inconnue est invalide, pas active par défaut.

Le lecteur pur `lireCycleEdition` reprend la forme L1 `{ etat, id, trashed_at }`, avec le mode. Un lecteur commun d'état effectif
réunit la recette, son édition et son éventuelle exception. Il sert au dépôt, aux vues, aux sélections et à la synchronisation.
Les cartes ne doivent pas chacune réinterpréter les marqueurs. Le lecteur propre `lireCycleRecette` demeure disponible pour le CAS.

### 4.2 Restauration d'un membre sans restaurer son livre

Ajouter sur une recette un champ réservé optionnel :

```text
restored_from_edition : null | { edition_id, lifecycle_id }
```

Il signifie : cette recette a été restaurée explicitement depuis ce retrait précis de l'édition. Seule une commande métier peut
le poser ou l'effacer. La commande exige l'association `recipe.edition_id` exacte, le cycle propre attendu, le cycle d'édition attendu,
et une édition actuellement retirée en mode `with_recipes`. Elle écrit un nouveau cycle propre actif et l'exception dans une transaction.
Si la recette avait aussi un retrait propre, la même restauration volontaire lève ce retrait et pose l'exception.

Un nouveau retrait individuel change le cycle propre et efface l'exception. Un retrait ultérieur du livre a un nouveau jeton : les
anciennes exceptions ne lui donnent aucun droit. Restaurer le livre ne réécrit ni les cycles propres ni les exceptions ; les exceptions
qui ne correspondent plus au retrait courant sont sans effet. Leurs identités restent validées, sans exiger que leur jeton soit courant.

| Cycle propre | Édition courante | Exception | État effectif et nouveaux usages |
|---|---|---|---|
| Actif | Aucune association | Sans objet | Actif |
| Actif | Active | Sans effet | Actif |
| Actif | Retirée, `keep_recipes` | Sans effet | Actif, source archivée |
| Actif | Retirée, `with_recipes` | Correspond exactement au retrait | Actif, restauré individuellement |
| Actif | Retirée, `with_recipes` | Absente ou ancien jeton | Retiré par le livre |
| Retiré | N'importe quel état valide | N'importe laquelle | Retiré individuellement |
| Invalide | N'importe laquelle | N'importe laquelle | À vérifier ; aucune mutation ordinaire |
| Actif | Association annoncée, édition absente ou invalide | N'importe laquelle | Incomplet/à vérifier ; non sélectionnable |

Un champ d'exception mal formé est invalide. Une exception pointant une autre édition que `recipe.edition_id` est refusée.
La conservation de sources et de snapshots historiques ne dépend pas de l'éligibilité aux nouveaux usages.

### 4.3 Pourquoi aucune cascade de marqueurs

Le retrait du livre change **une édition**. Il ne réécrit pas N recettes, ne fabrique pas N commandes et n'exige pas de manifeste
fractionné. Son jeton identifie le groupe et sa politique. Les cycles individuels inchangés constituent l'état antérieur utile :
une recette retirée avant le livre ou retirée séparément après sa restauration reste retirée quand le livre revient.

L'ensemble est défini par les associations validées à l'édition. Une association créée avant le retrait accepté en fait partie.
Une tentative concurrente après ce retrait est refusée par le même verrou et la même base d'édition. Aucune nouvelle recette ne peut
se rattacher à une édition retirée, même en mode `keep_recipes`.

Une recette effectivement retirée ne peut pas être détachée pour contourner sa corbeille : la restaurer d'abord. Une recette active
peut être déplacée seulement par le parcours d'association explicite, avec gardes sur recette, édition source et édition cible.
La cible doit être active ; l'exception est effacée dans la transaction. L'original et ses références de provenance restent intacts.
Si le livre est rétabli puis la recette déplacée, un retrait suivant de l'ancien livre ne la reprend pas.

## 5. Mutations locales, sources et compte

Étendre la capture L1 par un contexte d'édition `{ edition_id, expected_cycle_id, owner_id, generation }`, pris au début du geste depuis
l'état affiché. Pour une recette liée, capturer les deux bases et son association. Une écriture qui change d'édition capture les deux
éditions. Une relecture pour l'envoi, un retour d'assistant ou un remontage après navigation ne doit pas adopter une base nouvelle.

Le dépôt ajoute ces contextes aux options de `saveBatch`, `transitionner` et des commandes métier. Dans la même transaction : relire
propriétaire, génération, cycles, associations, admissibilité effective, dépendances et conditions de l'écriture ; écrire les lignes,
les octets et la capture de synchronisation. Une création d'édition ou de recette exige une création explicite comme en L1.
Les champs réservés de cycle, de mode et d'exception ne sont jamais fournis librement par un `put` ordinaire.

Gardes à couvrir, y compris lorsqu'aucune ligne `recipes` n'est écrite :

| Mutation | Condition spécifique L2 |
|---|---|
| Version, traduction, repères, note, photo de recette | Recette effectivement active ; bases recette et édition capturées |
| Nouveau repas, liste, session, inventaire | Tous les membres réellement utilisés sont éligibles ; contextes multiples conservés |
| Édition, couverture, tags, index, nouvelle séance de livre | Édition active et base capturée |
| Nouvelle référence, regroupement, association/déplacement | Édition cible active ; association et bases source/cible relues |
| Pages et documents nouveaux pour compléter un membre déjà actif | Contexte recette explicite ; rattachement exclusif ; garde d'édition ; liens et octets atomiques |
| Résultat d'import ou journal de scan | Journal conservable sous son propriétaire ; application au contenu conditionnée |
| Historique déjà créé | Exception L1 limitée à cet historique, sans modifier le contenu ni créer un nouvel usage |
| Suppression générique d'édition, recette protégée ou dépendance conservée | Refus ; aucune purge sous couvert de retrait |

Les références `imports`/`scan_sessions` restent des journaux de sources ; leur lecture historique ne réactive aucune recette.
Les réponses déjà payées sont conservées dans le mécanisme de relecture existant. Persister également la base d'édition à côté
du contexte recette des brouillons. Après retrait, même suivi de restauration, ni OCR, ni couverture, ni extraction d'index, ni
regroupement, ni import ciblé ne s'applique automatiquement. Reprendre signifie relire volontairement sur la nouvelle base.
Une réponse reçue après changement de compte ne va jamais dans la base du nouveau propriétaire.

`books` demeure une fiche bibliographique partagée. Ne jamais la supprimer parce qu'une édition est retirée. La modification de
métadonnées partagées depuis une autre édition active reste autorisée sous son contexte ; elle ne change aucun cycle. Les documents,
pages, versions, activités de consultation et préférences restent stockés. Aucun changement de cycle ne détache leurs relations.

## 6. Synchronisation et compatibilité

### 6.1 Commandes et capacité

Étendre le protocole existant avec une commande d'édition dont la charge utile immuable porte :

```text
action: trash | restore
edition_id, operation_id, base_cycle_id, at
mode: keep_recipes | with_recipes       // requis pour trash seulement
seed?                                 // édition jamais envoyée, création seulement
```

La restauration individuelle depuis le groupe est une commande distincte, portant `recipe_id`, `edition_id`, les deux bases,
`operation_id` et `at`. Les commandes individuelles L1 sont étendues aux membres de livres avec leur contexte d'édition ; elles ne
deviennent pas des `put`. Une restauration d'édition ou de membre ne crée jamais une entité absente ni ne contourne une tombale.

Utiliser l'outbox actuelle, avec une discrimination d'entité explicite et un accusé qui nomme l'opération exacte. Une commande par
cible en vol ; garder l'ordre des commandes dépendantes et leurs bases initiales. Les barrières portent sur l'ensemble des entités
concernées, même si les cibles diffèrent : retrait d'édition E1, restauration individuelle R1 basée sur E1, puis restauration d'édition
E2 attendent leurs accusés dans cet ordre. Un refus ou un recul de l'une bloque les suivantes concernées. Les contenus capturent leurs contextes recette
**et édition**, y compris les écritures d'enfants et les agrégats multirecettes. Ne pas dédupliquer une commande comme un instantané.
Une capacité nouvelle, par exemple `edition_lifecycle: 1`, est requise pour L2 ; `recipe_lifecycle: 1` seule ne suffit pas.
Une capacité déjà confirmée permet l'usage hors ligne ; un compte non compatible ne reçoit pas de nouvelle commande d'édition.

### 6.2 Arbitrage et nouveaux membres

La migration additive protège RPC actuelle/ancienne, REST direct, changements d'association et suppressions génériques. Elle refuse
aussi la suppression ou tombale d'un `books` encore référencé par une édition conservée : un ancien C09 ne doit pas supprimer le
parent bibliographique après le refus de supprimer son édition. Les règles
de propriétaire et de fichiers de L1 demeurent. Une commande CAS ne dépend pas de `updated_at`. Un réessai encore courant est accusé
sans nouvel effet ; une autre base est refusée avec l'état courant, sans rebasage automatique. Le réessai d'un retrait d'édition
vérifie aussi le mode exact. Celui d'une exception individuelle exige le cycle propre de l'opération, l'association et l'exception
exactes ; il accuse sans réécrire et renvoie les deux états confirmés. Si l'édition a changé entre-temps, son nouvel état est réconcilié
et l'ancienne exception reste inopérante. Si l'association ou l'exception ne correspond plus, refuser avec les états courants.

Le retrait d'édition et les écritures de ses membres verrouillent la même édition. Définir un ordre unique compatible avec le
verrou de recette L1 : recettes concernées dans l'ordre stable, puis éditions concernées dans l'ordre stable ; une commande parent
verrouille seulement son édition et ne recherche ensuite aucun verrou enfant. Les opérations multiples doivent préverrouiller
leur ensemble ou utiliser une primitive équivalente démontrée, pour éviter les interblocages.

Un client antérieur à L2 sans contexte d'édition ne peut modifier une édition ayant connu un cycle, ses associations ni ses contenus
gardés. Cela vaut même si l'édition a été restaurée ou si une recette est effectivement active grâce à `keep_recipes`. Les écritures
sur des éditions anciennes n'ayant jamais changé de cycle restent compatibles si les autres gardes sont satisfaites.
Un `put` récent ne peut pas effacer les marqueurs, l'exception ou restaurer un contenu retiré.

### 6.3 Premier envoi et réception fractionnée

Pour une édition jamais envoyée avec des membres ou des sources en attente, publier d'abord `books`, puis l'édition dans son état
initial, puis les créations et contenus admissibles capturés avant le retrait, enfin la commande d'édition qui change sa base.
Chaque étape attend l'acceptation de ses dépendances. Les bases capturées restent initiales ; aucun rebasage et aucun abandon global
de séquences. Si le serveur possède déjà une édition avec un cycle divergent, arrêter cette chaîne et conserver le conflit.

Le `seed` de commande peut initialiser directement une édition absente seulement s'il ne court-circuite aucune mutation dépendante
capturée sous son cycle initial ; il ne contient pas toutes les recettes/pages et n'écrase jamais une édition déjà présente.
Une restauration ne se sert pas du `seed`. Les parents bibliographiques requis existent avant cette initialisation.
Ce premier envoi ordonné ne constitue pas une transaction globale : un autre appareil peut recevoir l'état initial avant le retrait.
Le succès global n'est annoncé qu'après l'accusé de la commande. L'édition absente ne donne aucune permission générale de création
ou de modification de membres ; les écritures attendent son initialisation confirmée.

Les contenus déjà reçus dont l'édition annoncée manque restent non sélectionnables. Le lecteur d'état effectif retire immédiatement
les membres lorsque l'édition retirée est reçue, quel que soit l'ordre des tables ou des pages. Il n'est pas nécessaire de recevoir
une cascade de marqueurs enfants. Le groupe ne doit pas être présenté comme intégralement disponible si ses sources sont encore absentes.

Comme L1, conserver le dernier cycle confirmé séparément des intentions en attente, puis les réconcilier avec le curseur dans une
transaction. Un écho plus ancien ne gagne pas contre un cycle confirmé récent. Un refus bloque les commandes dépendantes et conserve
le travail pour relecture. « Garder celle d'ici » ne modifie aucun cycle ni exception. Une réponse manquante ou tronquée n'est pas un accusé.

Un appareil réellement déconnecté peut continuer d'afficher son ancien état jusqu'à sa mise à jour. La garantie porte sur le refus
de résurrection partagée à la reconnexion ; ne pas promettre un effet instantané sur un appareil hors ligne.

## 7. Archives, copies et fichiers

Exporter le graphe complet, jamais les seules projections actives : `books`, éditions, cycles, exceptions, sources, versions,
traductions, historiques et fichiers partagés. Un même SHA-256 utilisé comme couverture, photo de recette et photo de cuisson reste
présent une seule fois. Retirer ou restaurer n'efface aucun octet ; les politiques de cache existantes ne deviennent pas une purge.

Proposer le **format d'archive 3**, lisible avec 1 et 2. Les anciens lecteurs refusent 3 plutôt que d'ignorer les nouveaux états.
Les formats 1/2 sans cycle d'édition décrivent une édition active initiale ; ils ne peuvent donc écraser une édition ayant changé
de cycle dans la base courante. Les recettes conservent leur interprétation L1. Ne jamais faire passer des marqueurs L2 malformés
pour des champs absents d'une archive ancienne.

Étendre le refus intégral L1 : cycle/état/mode d'édition divergent, exception réservée différente sur une recette existante,
association incompatible, dépendance manquante, collision d'enfant ou omission d'une édition protégée en remplacement => aucune
écriture de l'archive. Comparer également les cycles propres L1, puis revalider dans la transaction finale. Ne pas accepter une
édition courante avec les sources d'un autre cycle sous prétexte que sa seule ligne a été conservée.

Une exception valide inclut une identité d'édition correspondant à l'association et une cible présente dans le graphe. Une archive
partielle qui omet le parent annoncé est refusée ; ne pas fabriquer une édition active. Une exception ancienne bien formée reste
conservée et sans effet si son jeton n'est plus courant. Une archive d'un groupe retiré avec un membre restauré restitue exactement
cette différence sur une base vide.

Après import sur base vide puis connexion, réconcilier les cycles d'édition et de recette et les exceptions **avant** l'envoi des
instantanés. Les initialiser depuis l'archive seulement si les entités sont absentes du serveur et sans tombale ; sinon une
différence produit un conflit explicite. Une sauvegarde ne prouve pas l'acceptation d'une commande sur le compte.

La copie sélective de groupe n'est pas ajoutée en L2. Les parcours existants qui créent une nouvelle recette depuis un contenu
exigent un nouvel identifiant, une création explicite, une source effectivement active et la conservation de sa provenance ; ils
ne copient pas les marqueurs de cycle ou l'exception comme des métadonnées ordinaires. Restaurer d'abord une source retirée.

## 8. Évolution technique et découpage de construction

Versions proposées : application **0.24.0**, premier cache `cuisine-os-v0.24.0-1`, **IndexedDB 6** pour un index réellement utilisé
`book_editions.trashed_at`, archive **3**, migration additive **0009_corbeille_livres.sql**. Les seuls champs JSON ne justifieraient
pas DB6 ; l'index alimente la corbeille des éditions. La fermeture des anciennes connexions 5 et leur refus de réouverture doivent
être prouvés avec le vrai code L1. Ajouter les éventuels modules au cache et les textes à la traduction française/anglaise existante.

| Bloc | Changements à prévoir |
|---|---|
| Lecteurs et modèle | Cycle d'édition, exception réservée, état effectif commun, index et relations d'archive |
| Domaine et dépôt | Commandes, bilan et garde atomiques, contextes d'édition, association, fichiers, remplacement de C09 |
| Mutateurs | Livre/ISBN/couverture, import et index, regroupement, pages, membre individuel, repas et historiques |
| Synchronisation | Capacité distincte, capture, barrières, premier envoi, réception, conflits, migration et preuves SQL |
| Écrans | Actions du livre, dialogue, corbeille groupée, mention de source archivée, restauration d'un membre, projections actives |
| Sauvegarde et livraison | Archive 3, refus de collision, vraie mise à jour DB5→6, tests et preuves de réception |

Principaux repères réels : `src/domain/cycle-recette.js`, `corbeille.js`, `contexte-import.js`, `index-livre.js`,
`src/model/repo.js`, `schema.js`, `src/core/db.js`, `src/ui/book.js`, `livre-ajout.js`, `livre-sans-saisie.js`, `import.js`,
`index-livre.js`, `regroupement.js`, `import-cible.js`, `recette-garde.js`, `corbeille.js`, `state.js`, les mutateurs et sélections L1,
`src/domain/backup.js`, `src/sync/*`, `supabase/migrations/` et le générateur de migrations. Les noms des petits modules neufs restent
à choisir pendant la construction ; les contrats et comportements de ce document priment sur leur découpage.

Écrire d'abord les tests rouges des lecteurs, commandes et races ; construire dépôt et serveur de façon coordonnée ; brancher les
parcours sur les API communes ; terminer par archives, ancien client et preuves de groupe multiappareil. Aucun contournement de garde
en production pour satisfaire un faux dépôt de test. Les fixtures déclarent leurs créations explicitement.

La publication prépare d'abord la migration et ses preuves, puis l'application compatible ; conserver les protections serveur en
cas de retour arrière logiciel. Ne pas revenir à un client L1 pour une bibliothèque ayant des cycles d'édition. La spec seule ne
constitue ni une migration appliquée ni une publication. L'autorisation de publication déjà donnée pour L0/L1 n'est pas une preuve
que L2 a été construit, validé ou publié.

## 9. Critères de réception

Ces critères sont à exécuter ; aucun résultat L2 n'est encore acquis.

1. Livre avec références, recette partielle, recette complète, pages, import et ancien repas : choix et comptages vrais ; les deux
   modes donnent leurs effets annoncés ; Annuler sans mutation et Annuler après retrait conditionné.
2. Livre vide : même corbeille réversible ; arrivée d'une recette, d'une page ou d'un import entre bilan et validation => nouveau
   bilan, aucune suppression ni détachement. Import à statut inconnu conservé.
3. Deux éditions du même `books` : une seule retirée ; autre édition, bibliographie, couverture et sources partagées intactes.
4. Retrait `keep_recipes` : livre absent des listes actives, membres actifs utilisables ; ajout d'une nouvelle référence au livre
   refusé, complément du membre existant autorisé avec ses gardes et sans altérer les autres membres.
5. Retrait `with_recipes` : recherche, redécouverte et nouveaux choix excluent le groupe ; routes, repas et historiques restent lisibles.
6. Recette déjà retirée avant le livre : restauration du groupe ne la restaure pas. Membre restauré seul, puis retiré individuellement :
   il reste retiré quand le livre revient.
7. Restaurer une recette depuis un ancien repas garde le livre retiré, l'association et toutes les sources ; nouveau retrait du livre
   invalide l'ancienne exception. Annuler périmé et double clic n'appliquent aucune autre opération.
8. Deux onglets : ancien éditeur, couverture, photo, index, regroupement ou import après retrait puis restauration => refus, saisie
   ou résultat payé conservé ; aucun octet orphelin créé par un échec de garde.
9. Association/déplacement concurrent avec retrait/restauration : une issue valide selon les bases et le verrou, jamais une recette
   échappant à sa corbeille ; exception non transportée vers une autre édition.
10. Retrait/restore/exception avec changement de compte au montage, pendant capture, dialogue, appel, transfert et transaction :
    aucune adoption du nouveau propriétaire ; une session assistant ne désigne pas le propriétaire de la bibliothèque.
11. Trois bases et vrais moteurs : édition jamais envoyée, enfants en attente, retrait puis restauration hors ligne, accusé perdu,
    commandes concurrentes et refus. Vérifier la reprise après fermeture et le maintien des séquences non couvertes.
12. Réception interrompue/table séparée : membre reçu avant édition non sélectionnable ; édition retirée reçue avant membre ne produit
    aucun membre actif parasite. Le volume dépasse la borne d'un lot (500 éléments) sans cascade de cycle ni faux succès global.
13. SQL réel, y compris deux sessions : CAS parent, restauration individuelle, ordre des verrous, association concurrente, RPC
    ancienne/nouvelle, REST, suppressions et contenus enfants. Une capacité recette seule est insuffisante ; ancienne écriture refusée.
14. Archive 3 aller-retour : deux modes, exception courante/ancienne, retrait propre, photos partagées, liens et hashes identiques.
    Formats 1/2 compatibles sur base vide ; divergences ou parent manquant refusés intégralement, en fusion comme en remplacement.
15. Archive d'un retrait hors ligne puis connexion à un compte divergent : aucune restauration ni remplacement implicite du groupe.
16. Reprise d'une cuisson/repas historique et correction de ses observations/photos autorisées ; création d'un nouvel usage et
    modification permanente d'une recette effectivement retirée refusées.
17. Livre retiré retrouvé par ISBN ou couverture : ne pas créer silencieusement un doublon ni réactiver l'ancien ; proposer d'ouvrir
    sa fiche et de restaurer. Une autre édition réellement distincte reste ajoutable.
18. Interface au clavier, Échap, retour mobile, focus après retrait/restauration ; texte à 200 %, 320/390/768/900/1280 px ; aucun
    débordement, piège de focus ou action masquée seulement par CSS. Français par `t()`, anglais complet, pas de faux état vide.
19. Vrai code L1/DB5 : ancienne connexion fermée, réouverture en 5 refusée, données intactes, mise à jour puis consultation hors ligne.
    Essais physiques Safari/PWA et lecteur d'écran consignés séparément des émulations, sans prétendre les avoir faits.
20. Suite navigateur complète avec épingle mesurée sans retrait d'assertions, outils Node, migrations `--check`, syntaxe/diff ; preuves
    des scénarios et limites dans le rapport du lot. Aucun vrai appel assistant requis pour ces essais.

## 10. Suite exacte du plan directeur

L0 et L1 sont construits ; leur publication est une opération distincte suivie dans l'état du projet. Les lots ci-dessous restent à
réaliser. L2 est le prochain lot préparé ici ; les autres ne sont pas annoncés terminés par l'ajout de quelques actions de L1/L2.

| Lot restant | Livrable et dépendance principale |
|---|---|
| **L2 — Livre et groupe** | Cette spec : corbeille d'édition, recettes gardées/retirées, restauration cohérente et C09 ; dépend de L1 |
| **L3 — Gestion visible** | Modifier/Actions depuis cartes et fiches, contexte recherche/filtres/position conservé (C07) ; peut avancer indépendamment des gestes non livrés |
| **L4 — Éditeurs et brouillons** | Corrections par sections, source/version visibles, brouillons locaux durables et résolution de base divergente ; gardes L0/L1/L2 |
| **L5 — Sources et index** | Ajout/remplacement/relecture des bonnes révisions, bilan d'ajouts/compléments/doublons et reprise (C04) ; définir la migration de provenance |
| **L6 — Lecture structurée et FR** | Groupes fiables et traduction fidèle de toute la recette, liés à la version exacte ; consommateurs et serveur alignés, socle positionnel C01 déjà corrigé |
| **L7 — Cuisine confortable** | Ingrédients accessibles, progression/reprise, minuteurs persistants et repli Wake Lock ; coordonné à L6 pour la langue, au-delà des correctifs C05/C06 de L0 |
| **L8 — Repas et inventaire** | Envies sans date, courses cohérentes, restes simples et quantités fiables ; heures/partage C03/C08 déjà corrigés, aucune consommation implicite |
| **L9 — Confort et mouvement** | États et navigation fluides, dialogues/accessibilité/réduction du mouvement ; les petites corrections d'accessibilité accompagnent déjà chaque lot |
| **L10 — Hors ligne et volumes** | Disponibilité réelle d'un repas sur l'appareil, photos/quota/volume et archive restaurée ; vérification en mode avion réel |
| **E1 — Expérience Cookidoo** | Démontrer ou écarter l'export automatisé d'une recette canadienne sans doublon ; indépendant des lots UX, expérimentation bornée |

Ordre de travail proposé après L2 : L3, L4 et L5 ; puis L6 et L7 coordonnés, L8, L9 et L10. L3 peut être préparé en parallèle, et
E1 demeure une piste indépendante. Ce séquencement n'oblige pas à attendre L9 pour corriger le clavier, ni L7 pour garder les correctifs
cuisine déjà livrés. La purge physique reste un futur contrat séparé, pas une tâche cachée de L10.

Décisions du plan déjà tranchées, à conserver dans les specs suivantes : modules ES natifs ; source originale intacte ; correction,
traduction fidèle et adaptation culinaire distinctes ; « français simple » = recette entière en français, pas seulement description ;
références d'index utiles et auto-enregistrement des entrées certaines préservé ; nouvelles sources reliées à leurs révisions ;
brouillon local distinct de la version publiée ; aucune quantité/durée inventée ; aucun lancement assistant implicite ; inventaire
sans consommation automatique ; cache différent d'une sauvegarde ; absence de contrôle du robot supposé ou annoncé sans expérience.

Les recherches sauvegardées, modèles de menus et suggestions supplémentaires évoquées par le plan ne deviennent pas automatiquement
des ajouts obligatoires de L2. Aucun arbitrage produit indispensable ne reste ouvert pour cette spec : les choix de cycle parent,
d'exception individuelle, de C09 réversible et d'archive sont explicites et doivent être vérifiés pendant sa relecture.
