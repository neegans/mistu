# L4 — Modifier une recette ou un livre sans perdre sa saisie

**29 octobre 2026 — spécification, revue technique terminée avant construction.** Neegan a autorisé la poursuite et la publication du plan après les lots précédents. Ce document ne prétend pas avoir été relu par Neegan. Base : L3 publié `ea25232`, réception publique consignée par `9ecf826`, branche `l4-editeurs-brouillons`. Cible **0.26.0**, cache `cuisine-os-v0.26.0-1` ; DB6 et archive3 inchangées, aucun SQL nouveau. Contrat écrit par A, relu et corrigé par C puis relu par le responsable d’intégration ; aucune construction L4 avant cette revue.

Références : [plan directeur §9](../../lots/2026-10-29-plan-directeur-interface-fonctions.md), [L1](2026-10-29-l1-corbeille-individuelle-design.md), [L2](2026-10-29-l2-corbeille-livres-design.md), [L3](2026-10-29-l3-gestion-visible-design.md), [correctifs urgents](2026-10-29-correctifs-thermomix-fiabilite-design.md).

## 1. Résultat attendu et limites

Modifier ouvre un espace clair, avec source et version visibles. Une saisie confirmée comme conservée reste disponible après fermeture/rechargement, sur cet appareil. Une correction culinaire crée une nouvelle version ; modifier seulement des métadonnées ne fabrique pas une recette ou une méthode supplémentaire. Enregistrer reste un geste explicite distinct de la conservation du brouillon.

L4 comprend :

- Métadonnées d’une recette existante ; correction d’une version affichée et création d’une variante personnelle.
- Saisie manuelle d’une nouvelle recette, autonome ou rattachée à une édition admissible ; reprise d’une lecture déjà présente dans le journal sans nouvel appel.
- Métadonnées bibliographiques d’un livre/édition, avec les contrôles de provenance et de fusion existants.
- Brouillons locaux de ces trois familles ; protection des sorties, détection des modifications concurrentes et reprise explicite.
- Organisation Source/Modification, ingrédients par ligne, étapes par bloc et accès aux parcours photo/source déjà construits.

Les journaux Thermomix, repères, lecture web, extraction et import ciblé gardent leurs propres modèles durables et leur exclusivité. L4 ne les remplace pas par des brouillons génériques et ne copie pas leurs réponses dans un second historique. Le formulaire de traduction manuelle reste disponible, avec sa structure par segments et ses gardes L0 ; sa refonte, ses brouillons spécialisés et la traduction automatique complète appartiennent à L6. Les groupes d’ingrédients relèvent de L6 ; les nouvelles révisions de sources et PDF/EPUB de L5. Aucun groupe artificiel encodé comme ingrédient, aucune nouvelle commande Cookidoo, aucune relance assistant automatique.

## 2. État du code et conséquence

| Élément inspecté | Comportement actuel | Conséquence L4 |
|---|---|---|
| `ui/recipe-edit.js` | Formulaire en mémoire ; blocs texte reparsés ; nouvelle RecipeVersion à l’enregistrement | Extraire un modèle d’édition sérialisable, conserver les ID et états des lignes inchangées |
| `recipe-edit.js` / `recette-garde.js` | Recette/version contrôlées, compte/génération/DB capturés, photos/notes/favori/repères relus dans la transaction | Réutiliser ces gardes ; ne pas sérialiser leurs fonctions dans un brouillon |
| `ui/book.js` | Formulaire de métadonnées ; seuls champs modifiés fusionnés, provenance manuelle par champ | Extraire ce formulaire sans remplacer les valeurs concurrentes des champs non touchés ; ajouter conflit sur champ réellement concurrent |
| `imports` | Journal synchronisé de lectures/repères/TM, états terminaux et identités strictes | Ne pas y ajouter les brouillons manuels et ne pas réouvrir un import terminé |
| `sync_state` | Magasin local existant, clé primaire `key`, exclu de SYNC_STORES et des archives | Namespace de brouillons locaux possible sans magasin/index neuf |
| `backup.js::applyArchive` | Remplacement exclut les magasins internes ; ils restent présents | Changer une époque locale dans la transaction de remplacement, afin de rendre les anciens brouillons inapplicables |
| L3 navigation | Mémoire de route/ancre en sessionStorage, époque de navigation, aucun contenu éditable | Réutiliser les retours ; ne pas y déposer de texte de recette ou de brouillon |

L’absence actuelle de brouillon manuel durable est un constat de lecture, pas un test déjà réalisé. Les reproductions rouges précèdent la construction.

## 3. Éditeur de recette

### 3.1 Informations et actions

L’en-tête nomme la recette, la version source et le geste : **Modifier les informations**, **Corriger une erreur de lecture**, **Créer ma version**. L’intention et la version réellement sélectionnée sont capturées à l’ouverture ; un paramètre d’adresse inconnu ne crée pas de nouveau type de version.

Sections : Informations, Ingrédients, Préparation, Photos et Sources. Photos/Sources donnent accès aux gestionnaires existants avec retour L3. Ces gestes explicites conservent leurs propres transactions et indications de succès ; ils ne sont pas présentés comme inclus dans une sauvegarde globale du formulaire. Avant de partir vers un gestionnaire, terminer l’écriture du brouillon ou conserver le formulaire si elle échoue.

Un titre d’affichage utilise `display_title` ; les métadonnées manuelles n’écrasent pas le titre original importé. Catégorie, cuisines et métadonnées actuellement admises sont fusionnées champ par champ. Un enregistrement sans modification est inactif et ne crée aucune version. Pour une création, le titre original est saisi explicitement et les identifiants futurs sont réservés dans le brouillon.

La correction crée une version `correction` enfant de la base affichée. La variante crée une version `adaptation`, avec résumé des changements, et laisse la version courante inchangée. Aucune version source ni provenance historique n’est réécrite. Une recette vérifiée reste modifiable ; une correction ne se déclare pas vérifiée par le seul fait qu’un brouillon a été conservé.

Une correction de la version qui est toujours courante devient courante après publication, sous comparaison transactionnelle du pointeur capturé. Si la base était déjà ancienne à l’ouverture, la correction est conservée comme une nouvelle version sans remplacer la courante, par défaut. Si le pointeur a changé pendant la saisie, le formulaire signale ce changement et demande de revoir le choix : garder la nouvelle courante est le choix proposé ; **Utiliser ma correction comme version courante** exige un geste explicite après affichage des deux versions concernées. Ce choix mémorise le pointeur exactement relu et ne vaut que tant qu’il reste identique dans la transaction (§7). Aucun retour, rechargement ou simple clic Enregistrer ne renouvelle cette décision.

### 3.2 Ingrédients et étapes

Chaque ligne d’ingrédient expose quantité, unité, nom et préparation, avec son texte original accessible. Les identités confirmées, valeurs inconnues et incertitudes restent distinctes. Une modification pertinente invalide la confirmation de cette ligne seulement ; les lignes intactes conservent leurs ID et leur état. Le parseur reste un outil de saisie explicite, sans réanalyse automatique destructive de toutes les lignes à chaque ouverture.

Une étape est un bloc multiligne avec commandes Ajouter, Retirer, Monter et Descendre. Le glisser-déposer est facultatif. Le modèle du brouillon conserve les ID et l’ordre ; supprimer une étape ne déplace pas une traduction pour la faire correspondre à une autre. La nouvelle version n’hérite d’aucune traduction validée de la version précédente par simple position.

L4 ne crée pas de modèle de groupes. Le bouton Ajouter un groupe n’est pas simulé avec une ligne d’ingrédient vide ou une étape spéciale ; cette partie du plan attend le contrat L6.

Les durées conservent leurs valeurs et la provenance déjà portées ; les repères estimés ne deviennent pas des corrections manuelles sans modification explicite du champ. L’éditeur ne reconstruit pas les repères de toutes les versions à partir d’une seule saisie.

### 3.3 Rendement

Le nombre existant `servings` reste un nombre de portions seulement lorsqu’il est présenté et confirmé comme tel. Aucun texte « 50 pains » ne devient 50 personnes. L4 peut préserver un rendement textuel manuel dans un champ optionnel `yield_text` de la **nouvelle** RecipeVersion : texte verbatim borné à 200 points de code, sans conversion ni usage dans les calculateurs. Le champ absent reste absent ; aucune valeur n’est extraite ou inventée à partir d’un nombre seul. Ce champ de contenu JSON ne demande pas d’index. Les lecteurs de portions continuent à utiliser uniquement `servings` ; compatibilité archive/sync et absence de conversion sont testées avant adoption du champ.

### 3.4 Sources, mobile et Thermomix

Ordinateur : source et modification côte à côte. Téléphone : Source/Modification, sans perdre saisie, sélection de champ ni position. Zoom/rotation de consultation ne réécrit pas la photo source et ne lance pas d’OCR.

Une correction d’un document TM7 suit le chemin actuel de version personnelle et ses signatures. Une signature de réglages invalidée reste invalidée ; aucun nouvel éditeur ni brouillon ne réactive Cuisiner ou Copier pour Cookidoo. La source personnelle sans réglages conserve son contrôle de chaîne d’ancêtres. L4 ne modifie aucun validateur de sécurité.

## 4. Éditeur de livre

Réunir titre, auteur, langue, édition, ISBN, convention, cuisines et mots-clés actuellement pris en charge. La couverture et les notes existantes sont accessibles depuis cet espace ; elles restent des gestes explicites séparés s’ils ne font pas partie du formulaire. Ne pas inventer un champ partagé de notes bibliographiques sans lecteur défini.

Séparer `books` partagé (titre/auteur/cuisines/mots-clés) de `book_editions` (ISBN/éditeur/année/langue/convention). Les champs non modifiés sont relus et préservés dans la transaction. Si un champ modifié a changé depuis l’ouverture, proposer une comparaison sur ce champ ; le dernier clic ne remplace pas silencieusement l’autre valeur. Une modification bibliographique partagée annonce qu’elle concerne les éditions du même livre.

Le formulaire reste soumis à l’édition capturée et à son cycle L2. Un retrait/restauration entre ouverture et validation impose une reprise explicite. Ajouter des pages ou une recette n’exige pas de modifier les métadonnées et n’entraîne aucune nouvelle identification payante.

## 5. Stockage local : décision et alternatives

### 5.1 Décision pour ce lot

Utiliser des lignes internes `sync_state` sous `editor_draft:v1:<id>` et une clé `editor_library_epoch:v1`. L’API domaine masque ce détail ; les vues ne lisent ni n’écrivent ce namespace directement. Une ligne reste `{key, value}` et les conditions `fusion` portent son contenu exact/révision. Écritures de brouillon via le dépôt, origine `device`, sans outbox. La publication métier utilise une transaction locale normale : le brouillon et sa marque de publication restent internes, seuls les enregistrements métier entrent dans la capture.

Pas de magasin neuf, pas d’index neuf, pas de DB_VERSION ni de SQL pour ce stockage. `getAll('sync_state')` suivi du filtre de namespace suffit pour une liste bornée à 32 brouillons. Les lectures métier ordinaires restent inchangées. `createArchive()` prend aujourd’hui un snapshot de tous les magasins puis exclut les internes : mesurer le coût des brouillons bornés pendant ce snapshot, sans les inclure dans l’archive.

`settings` est inadapté car archivé ; `imports` serait synchronisé et bloquerait les parcours existants ; sessionStorage/localStorage n’offrent pas la transaction commune avec les versions et la file. Un magasin `editor_drafts` séparé serait plus descriptif mais demanderait une migration IndexedDB et une liste explicite des magasins locaux pour ne pas être synchronisé/archivé automatiquement. Aucun besoin de requête ni volume de L4 ne le justifie. Si les limites mesurées rendent ce choix insuffisant, revoir la spec avant construction, sans ajout opportuniste d’index.

### 5.2 Enveloppe version1

Le brouillon contient uniquement :

```text
id, format:1, kind:recipe_metadata|recipe_version|recipe_new|book_metadata
owner_id, database_name, library_epoch
revision, state:editing|blocked|committed, created_at, saved_at
entity_id, base_version_id?, edition_id?, book_id?, import_id?
base_recipe_cycle_id?, base_edition_cycle_id?, base_association
base_source_signature, base_fields, changed_fields
pointer_decision?: {mode:preserve|replace, expected_current_version_id, reviewed:boolean}
payload: modèle sérialisable admis pour ce kind
publication: {operation_id, recipe_id?, version_id?, committed_at?} | null
```

Les fonctions de garde, tokens d’authentification, sessions, URLs blob, objets DOM, sélection multiple et configuration assistant sont interdits. Les références de fichiers/pages existants sont des identifiants ; aucun blob photo n’est copié dans le brouillon. Un fichier choisi mais pas encore sauvegardé par son parcours ne porte jamais la mention « conservé » après fermeture.

Le corps est hostile à la lecture : validation complète, champs admis, tailles, types, références et version de format. Une forme inconnue est présentée comme non reprenable avec possibilité de conserver/exporter le texte sûr ; elle n’est ni migrée silencieusement ni appliquée à une recette.

**Représentation sans copie de la source.** `payload` conserve une seule représentation des valeurs du formulaire, dans des objets/tableaux JSON ; ni bloc JSON sérialisé dans une chaîne, ni seconde copie complète des ingrédients/étapes sous « original ». Les textes sources consultables viennent de leur version/page/journal référencés. Les champs de source déjà indispensables dans une ligne métier, tel `source_text`, restent présents une fois. `base_fields` mémorise, pour chaque champ éditable capturé, sa présence et une empreinte de sa valeur ; la publication compare seulement les champs réellement modifiés. Il ne contient pas une copie complète de `recipes`, `books`, `book_editions` ou de la réponse assistant. La comparaison affiche la saisie conservée et la valeur actuelle ; elle ne dépend pas de la conservation d’une troisième copie de l’ancienne valeur.

`base_source_signature` est une structure versionnée de références et d’empreintes SHA-256 de 64 caractères hexadécimaux, calculées sur une projection JSON canonique : clés d’objet triées, ordre des tableaux et textes exacts conservés, sans raccourci sur la date, sans troncature ni normalisation du texte. Chaque empreinte nomme sa projection et sa version de contrat. La présence d’un champ reste distinguée de sa valeur `null`. Une signature n’embarque jamais le JSON complet qu’elle résume.

| Kind | Bases et projections à conserver dans la signature |
|---|---|
| `recipe_metadata` | Identité de la recette, association aux sources/à l’édition ; empreintes par champ de métadonnées dans `base_fields`. Un changement de photo, note, favori ou autre champ non touché ne rend pas ces métadonnées périmées. |
| `recipe_version` | Identité et contenu de la version exactement affichée, y compris ingrédients, étapes, contraintes et provenance qui autorisent son usage ; aucune substitution par la version courante. Les ancêtres nécessaires à une reprise sans réglages TM portent chacun leur empreinte. Seul l’horodatage technique `updated_at` est exclu de la projection d’une version. Les champs de recette modifiés et le pointeur suivent leurs comparaisons distinctes. |
| `recipe_new` | Identifiants réservés dont l’absence sera contrôlée, association prévue et contexte d’édition/sources si présents ; sans import, aucun résultat assistant implicite. Avec un import, ajouter l’identité exacte de la lecture décrite ci-dessous. |
| `book_metadata` | Identités du livre et de l’édition, lien `book_id`, association et convention source utilisée ; empreintes par champ dans `base_fields`, séparées entre `books` et `book_editions`. Ni couverture ni champ partagé non touché ne sont remplacés à partir du brouillon. |

Pour tout `import_id`, l’empreinte de lecture est calculée **à partir du résultat réellement posé dans le formulaire**, pas de la dernière ligne relue au moment de conserver ou reprendre le brouillon. Elle couvre au minimum le triplet actuellement comparé par `cleLecture` (`id`, `started_at`, `resultat` exact), le type de lecture, ses cibles, le propriétaire du journal et les contextes de cycle/source attendus par le parcours existant ; le statut attendu de publication est `a_verifier`. Les valeurs inconnues d’un ancien journal ne sont pas remplacées par celles du compte courant. L’enveloppe garde cette empreinte et les références nécessaires, jamais la réponse brute ou une seconde copie du résultat. Le préremplissage modifiable reste dans `payload`. Après rechargement, une nouvelle réponse sous le même identifiant, même avec la même date, rend cette liaison périmée ; elle n’est ni affichée comme déjà relue ni fermée à la place de la première. La saisie reste récupérable et l’adoption du nouveau résultat exige une comparaison et un nouveau brouillon explicites.

### 5.3 Portée et époque atomique

`owner_id` provient de `sync_state.user_id`, pas seulement de la session. La base est identifiée durablement par son nom ; son objet vivant et `getSyncGeneration()` restent des gardes avant/après attentes, jamais des identités sérialisées.

Créer `editor_library_epoch:v1` une seule fois sous contrôle d’absence. Un remplacement d’archive doit changer cette époque **dans la transaction de remplacement** ; `clearDevice()` la supprime avec tous les brouillons. L’époque de navigation L3 reste séparée et est invalidée après réussite du geste ; sa valeur en localStorage ne suffit pas à autoriser la publication d’une version.

Une déconnexion gardant le propriétaire des données ne change pas la portée. Les brouillons d’un autre propriétaire ne sont pas listés, même par titre. Un premier rattachement d’une bibliothèque sans compte ne réattribue pas silencieusement ses brouillons : proposer une reprise volontaire des seuls brouillons anonymes de ce même appareil et de cette même époque, avec validation de leurs bases, dans un nouveau brouillon sous le compte accepté. Cette règle ne s’applique jamais à un brouillon d’un autre compte nommé.

Après remplacement d’archive, les anciens brouillons du même propriétaire restent récupérables en lecture comme saisies détachées, marquées « bibliothèque remplacée ». Ils ne peuvent pas publier dans la nouvelle époque sans une nouvelle ouverture explicite et une comparaison. L’effacement de l’appareil, lui, les supprime ; le dialogue le dit clairement.

## 6. Conservation, concurrence et quotas

### 6.1 Écriture locale du brouillon

Première modification : créer un brouillon avec bases capturées au montage. Les saisies suivantes sont regroupées avec un délai maximal de 400 ms ; écrire aussi avant une sortie contrôlée ou un changement de section qui remplace le formulaire. Afficher **Enregistrement sur cet appareil…**, puis **Brouillon conservé sur cet appareil** seulement après réussite de la transaction. Ne pas annoncer un enregistrement serveur.

Chaque écriture compare propriétaire, époque, base vivante et révision attendue du brouillon. La révision augmente de façon monotone. Deux onglets ne s’écrasent pas : le second écrivain périmé conserve sa saisie en mémoire, voit le conflit et peut ouvrir une copie locale séparée. Pas de verrou temporel susceptible d’expirer pendant une frappe ni de reprise de possession silencieuse.

La disparition ou le retrait de la recette ne doit pas empêcher de conserver le texte déjà saisi dans son brouillon local sous le même propriétaire/époque ; il devient bloqué à la publication. Changement de propriétaire/époque pendant l’écriture refuse la transaction entière, sans sauver le texte sous la nouvelle identité.

### 6.2 Limites concrètes

Au plus **32 brouillons non publiés**, bloqués compris, **2 Mio (2097152 octets) par ligne complète `{key,value}`**, et **8 Mio (8388608 octets) au total** pour le namespace de brouillons/reçus de la base. La mesure locale est `TextEncoder().encode(JSON.stringify(ligne)).length` ; ce n’est ni un nombre de caractères ni la mesure JSONB serveur d’un lot de sources. Les champs et références restent validés selon leur contrat métier. Contrôler nombre et tailles dans la transaction, avant écriture, y compris avec deux onglets concurrents ; ne pas se fier au compteur d’écran.

La borne initialement envisagée de 256 Kio est abandonnée : `sync/lots.js` admet jusqu’à 524288 octets de JSON pour une ligne métier, et un éditeur peut réunir recette + version, ou livre + édition. Deux lignes de 512 Kio représentent déjà 1 Mio avant l’enveloppe. La limite de 2 Mio laisse un second Mio pour les valeurs transitoires de saisie, références, états de lignes et empreintes, sans stocker les sources en double (§5.2). Le plafond global reste 8 Mio pour borner le snapshot d’archive et les lectures de `sync_state` ; les 32 emplacements ne promettent donc pas 32 brouillons à leur taille maximale.

Une recette existante admissible proche de la borne de 512 Kio doit pouvoir être ouverte, corrigée, conservée puis reprise sans raccourcissement imposé par L4, y compris avec du texte multioctet. L’éditeur ne réapplique pas les limites d’une nouvelle extraction IA à des lignes manuelles déjà admises. Avant construction parallèle, mesurer des modèles complets proches de la borne pour chaque kind, avec une modification et toutes les références requises : si la représentation choisie dépasse 2 Mio pour ces données admises, corriger cette représentation ou revoir explicitement la borne, jamais tronquer les données ni désactiver leur édition. Les limites de publication/synchronisation restent distinctes : un brouillon conservé n’affirme pas que sa future ligne métier pourra être envoyée ; un dépassement à la publication garde le brouillon et donne son motif réel.

Aucune éviction automatique d’une saisie non publiée. Quota atteint, QuotaExceededError, base fermée ou stockage privé bloqué : garder le formulaire, dire ce qui n’a pas pu être conservé, offrir Copier ma saisie / Télécharger mon texte, puis permettre d’écarter explicitement un ancien brouillon. Aucun message « enregistré » optimiste.

Les brouillons publiés peuvent devenir de petits reçus sans payload ; conserver au plus 128 reçus, puis retirer les plus anciens uniquement lorsque leur publication métier est confirmée localement. Ce nettoyage ne retire aucune version et ne transforme pas un échec en succès.

### 6.3 Sorties et reprise

Quitter par Retour, lien, navigation principale ou changement de route attend l’écriture locale en cours. Si elle réussit, continuer avec le retour L3 ; sinon proposer **Rester**, **Copier ma saisie**, **Quitter sans la conserver**, ce dernier choix explicite. Échap et clic extérieur suivent la même règle pour un dialogue modifié.

Le routeur doit traiter séparément le retour navigateur déjà effectué : garder l’ancien formulaire jusqu’à résolution, et restaurer l’entrée exacte si la personne reste, sans créer une boucle popstate/hashchange ni une entrée artificielle à chaque refus. Les clics modifiés/nouveaux onglets ne doivent pas être convertis en navigation de l’onglet courant.

`beforeunload` ne permet pas d’attendre fiablement IndexedDB ; l’utiliser uniquement comme avertissement quand une saisie n’a pas encore été confirmée. Un arrêt brutal pendant les 400 ms peut perdre les dernières touches non confirmées. Ne pas promettre leur récupération ; le statut distingue ce cas du dernier brouillon confirmé.

À la réouverture, proposer Reprendre ou Écarter le brouillon exact, avec date et cible. Ne pas écraser d’abord le formulaire neuf ni lancer une extraction/description/traduction pour le préremplir. Une création manuelle reprend ses identifiants réservés ; elle ne crée pas une nouvelle recette à chaque rechargement.

## 7. Publication et changement de base

Au clic Enregistrer, relire dans une même transaction : propriétaire, époque, révision du brouillon, recette/édition, association, source sélectionnée, champs réellement modifiés, décision de pointeur et identité/résultat du journal éventuellement fermé. Recréer des fonctions de garde depuis les bases persistées validées ; ne pas simplement recapturer le cycle courant et considérer l’ancien brouillon comme compatible.

Le hachage SHA-256 est préparé avant cette transaction : lire les sources, comparer leurs empreintes aux empreintes persistées et garder ces projections exactes en mémoire. Dans la transaction, les relire et comparer synchroniquement leurs projections canoniques à ces copies déjà vérifiées, en plus du CAS de la révision du brouillon. Aucun `await` WebCrypto dans une condition IndexedDB ; aucune source ou réponse reçue entre ces deux phases n’est adoptée. Une projection différente annule toute la publication. Cette préparation n’écrit ni ne ferme le journal et ne modifie pas les bases du brouillon.

La transaction écrit ensemble la nouvelle version ou le patch de métadonnées, la fermeture éventuelle du journal, les dépendances admissibles, la capture d’outbox et le reçu interne `committed`. L’ID d’opération et l’ID de version réservés rendent le réessai après accusé local perdu idempotent. Un brouillon ne disparaît pas avant cette réussite. Une autre révision de brouillon refuse l’ensemble.

Les versions anciennes sont immuables. Les champs hors formulaire (photo, notes, favori, repères d’autres versions, pointeurs non concernés) sont relus et conservés. Un import terminal reste terminal ; un brouillon manuel périmé ne peut pas le réouvrir. Aucun fichier/source partagé n’est déplacé ou supprimé pour adapter les anciennes références du brouillon.

Si source, cycle, association ou champ modifié diffère : conserver la saisie, comparer **Votre saisie** / **Valeur actuelle**, puis proposer une reprise depuis l’état actuel. Ce geste crée un nouveau brouillon avec nouvelles bases et copie seulement les choix explicitement repris ; il ne rebase pas automatiquement l’ancien. Un champ non touché par la personne n’est pas recopié depuis son ancienne ouverture.

Une recette retirée doit d’abord être restaurée par la commande L1/L2 existante. Même après restauration, l’ancien brouillon reste périmé jusqu’à cette reprise. Une recette disparue n’est jamais recréée par Enregistrer ; Copier ma saisie demeure disponible.

Pour une correction, `pointer_decision.expected_current_version_id` nomme la courante capturée, y compris `null`. En mode `preserve`, la publication laisse ce pointeur et ses champs dérivés (`availability`, `verification_state`, `ingredient_ids`) intacts ; elle crée seulement la version enfant et les métadonnées explicitement modifiées. En mode `replace`, elle les actualise avec la nouvelle correction seulement si le pointeur relu est égal à celui attendu. Le remplacement est proposé initialement uniquement si la base sélectionnée était courante ; il exige `reviewed:true` si elle était ancienne ou si le pointeur a changé. Un nouveau changement entre comparaison et transaction refuse l’ensemble, même en mode `preserve`, afin de représenter la courante exacte avant de publier. La saisie est conservée, le choix est présenté à nouveau avec **Garder la version courante** par défaut et les bases source restent celles de la version corrigée. Ce CAS ne constitue pas un rebasage de contenu. Une adaptation ou une modification de métadonnées ne change jamais le pointeur, et une nouvelle recette publie son identifiant de version réservé dans sa création atomique.

## 8. Synchronisation, archives et nettoyage

Les brouillons et reçus restent sur cet appareil : aucun paquet d’outbox, backfill, archive3 ou Storage ne les transporte. Un test inspecte le contenu réel d’une archive et les paquets de deux moteurs, pas seulement une constante de schéma. Aucun secret ni réponse payée du journal n’apparaît dans les clés ou événements de diagnostic.

Les métadonnées et versions publiées suivent les règles de synchronisation existantes, y compris conflits de contenu et cycles L1/L2. L4 n’annonce pas qu’une réussite locale est déjà reçue sur l’autre appareil. Deux publications concurrentes de versions restent deux versions traçables ; le conflit de pointeur conserve son mécanisme existant.

Une sauvegarde d’archive complète est une sauvegarde de bibliothèque, pas des brouillons. Avant effacement/changement de compte/remplacement, dire que les brouillons ne sont pas dedans et permettre leur export textuel volontaire. L’export de brouillon est un document local de récupération, pas une archive importable appliquée directement au dépôt.

## 9. Interfaces et construction

### 9.1 Frontières et résultats

Contrat figé avant construction, après lecture des portes réelles `repo.saveBatch`, `repo.transitionner`, `db.mutate`, `backup.applyArchive` et `repo.clearDevice`. Module de service : `domain/brouillons-editeur.js`. Module de format/portée : `domain/brouillons-format.js`, indépendant du dépôt, des vues et du routeur ; il porte le namespace, les bornes, la validation, les projections canoniques et la construction de la ligne d’époque. Aucun de ces modules ne dépend de l’assistant.

```ts
creerServiceBrouillons({
  repo,                         // dépôt injecté ; repo.db reste une propriété vivante
  getGeneration: () => number,  // garde en vol, fournie par le raccord UI
  maintenant?: () => string,
  newId?: (prefix: string) => string
}) => ServiceBrouillons

type PorteeEditeur = { owner_id: string | null, database_name: string,
  library_epoch: string };      // valeurs persistables, distinctes de la portée L3
// SessionEditeur, ComparaisonEditeur et PlanPublication sont des objets opaques,
// propres à cette instance du service ; ni sérialisés ni construits par la vue.
```

Les méthodes rendent `{issue:'ok', ...}` pour leurs résultats ordinaires, `{issue:'refuse', raison, conflits?}` pour un refus attendu, ou `{issue:'echec', raison, reessayable:true}` pour une panne de stockage. Publication rend les issues spécifiques du §9.4. Les résultats ne contiennent ni secret, ni réponse brute, ni copie d’un autre propriétaire. Motifs communs : `compte_change`, `bibliotheque_remplacee`, `contexte_change`, `revision_changee`, `source_changee`, `cycle_change`, `association_changee`, `champ_change`, `pointeur_change`, `journal_change`, `journal_terminal`, `absent`, `format_inconnu`, `contenu_invalide`, `limite_brouillon`, `limite_nombre`, `limite_totale`, `limite_publication`, `quota_stockage`, `stockage_indisponible`. L’UI traduit le motif ; le domaine ne fabrique pas un succès pour une exception DOMException numérique.

Une session associe une copie validée des bases affichées, les identifiants réservés, la portée, la révision connue, l’objet de base capturé et la génération en vol. Le service recoupe propriétaire et époque dans IndexedDB. Un objet passé par une vue ne constitue jamais, à lui seul, une autorisation ; après chaque attente et dans la transaction, les gardes vérifient encore la portée. Le retrait d’une cible peut bloquer sa publication sans empêcher de conserver le texte sous la même portée.

### 9.2 Ouverture, conservation et reprise

Signatures publiques du service ; `portee` vient exclusivement de `capturerPortee`, et chaque résultat contient les seules valeurs effectivement confirmées :

```ts
capturerPortee({owner_id, estCourante?: () => boolean})
  => {issue:'ok', portee}

ouvrirBrouillon({kind, intention, portee, affiche})
  => {issue:'ok', session, modele, revision:null}

listerBrouillons({portee, inclureDetaches?: boolean})
  => {issue:'ok', brouillons: ResumeBrouillon[]}
lireBrouillon({id, portee})
  => {issue:'ok', etat:'reprenable'|'bloque'|'detache'|'committed',
      brouillon?, session?, recu?, raisons: string[]}

conserverBrouillon({session, expectedRevision: number | null, payload})
  => {issue:'ok', id, revision, saved_at, state, octets}
ecarterBrouillon({id, portee, expectedRevision})
  => {issue:'ok', id}

comparerBrouillon({id, portee, expectedRevision})
  => {issue:'ok', comparaison, conflits, courantAffichable}
choisirVersionCourante({session, expectedRevision, comparaison,
  choix:'preserve'|'replace'})
  => {issue:'ok', revision, pointer_decision}
reprendreSurBaseCourante({comparaison, choixRepris, portee,
  reprendreAnonyme?: boolean})
  => {issue:'ok', session, modele, revision:null}
```

`capturerPortee` contrôle le propriétaire des données demandé, puis initialise l’époque absente par CAS dans une écriture `device`. Deux premiers appels concurrents utilisent finalement la même époque relue ; aucun appel ne remplace une époque existante. `ouvrirBrouillon` ne conserve pas encore une ligne : il capture immédiatement le contenu réellement affiché, prépare les empreintes et réserve `draft_id`, `operation_id` et, selon le kind, `recipe_id`/`version_id`. La première modification appelle `conserverBrouillon` avec `expectedRevision:null`, donc sous condition d’absence ; la première révision écrite vaut 1. Ouvrir un écran sans le modifier n’occupe pas d’emplacement.

`affiche` a une forme fermée : `{recipe?, version?, edition?, book?, pages?, document?, sessionScan?, journal?, ancetres?}`. Chaque objet est la copie qui a fourni le formulaire, non une relecture tardive. Le kind fixe les présences admissibles et les associations ; une version doit appartenir à la recette. Les ancêtres sont admis uniquement pour le chemin personnel TM existant. `journal` est admis pour la création issue de la lecture de recette déjà gérée par cet éditeur (`kind:'recette'`, `recipe_id:null`, résultat posé et statut `a_verifier`) ; les journaux TM, repères, web et import ciblé restent dans leurs parcours spécialisés. Aucune session ou réponse plus récente n’est substituée sous un même identifiant.

`payload` est le modèle validé par kind, avec un seul exemplaire des valeurs. Les champs métier éditables sont nommés dans le modèle pur, pas par une fonction de fusion fournie par l’UI. Métadonnées recette : `display_title`, `original_language`, `type`, `cuisines`, `tags`, `printed_page`, `source_label`, sous leurs contrats existants ; `original_title` n’est éditable que pour `recipe_new`. Contenu de version : portions/rendement, durées déjà admises, lignes d’ingrédients, étapes, résumé, notes et statut de variante. Identités, parent, provenance, contraintes héritées, vérification, pointeur et champs dérivés sont construits/contrôlés par le domaine. Livre : `books.title/author/cuisines/tags` et `book_editions.isbn/publisher/year/language/unit_convention_id`. Photos, favoris, notes personnelles et repères restent hors du patch du formulaire. Une ligne inchangée garde ses identités et sa vérification ; une ligne touchée suit la règle explicite du modèle, jamais un booléen « tout vérifié » de la vue.

Le service calcule `changed_fields` à partir des bases et du payload validé ; la vue ne choisit pas les champs à soustraire au CAS. Conserver remplace uniquement le payload, les champs dérivés du brouillon, sa révision et sa date. Cela ne renouvelle jamais une base, un cycle, une signature de journal ou une décision de pointeur. L’UI sérialise ses appels de conservation ; une réponse en retard ne remplace pas sa saisie plus récente. Le retour `saved_at/revision` est produit après le commit, pas depuis l’objet avant écriture.

`lireBrouillon` reconstruit les gardes depuis les bases persistées et classe l’état courant ; il n’écrit pas automatiquement une nouvelle base. Un brouillon d’époque précédente du même propriétaire est `detache` : texte récupérable, aucune session publiable. Un autre propriétaire nommé donne le même refus qu’un identifiant absent, sans titre. `ecarterBrouillon` compare propriétaire, identité et révision, même pour un brouillon détaché ; une saisie concurrente n’est pas supprimée.

`comparerBrouillon` prépare un objet opaque contenant la révision de brouillon, la saisie, les seules valeurs actuelles pertinentes et les bases relues, pour présentation explicite. `choisirVersionCourante` accepte uniquement une comparaison encore exacte, vérifie transactionnellement le pointeur représenté et augmente la révision en enregistrant la décision ; les bases du contenu corrigé restent intactes. Une correction initialement courante utilise `replace, reviewed:false` ; une ancienne base commence par `preserve, reviewed:false`. Le geste explicite sur la comparaison produit `reviewed:true`. Adaptation et métadonnées n’ont pas de décision de remplacement.

`reprendreSurBaseCourante` crée une nouvelle session et de nouveaux identifiants à partir de la comparaison montrée, après contrôle qu’elle est encore exacte. `choixRepris` est une liste de champs/lignes/blocs du modèle à recopier volontairement, pas un remplacement complet par le vieux payload. La première conservation de la copie suit les mêmes quotas et ne supprime pas l’ancien brouillon. Une reprise anonyme exige le booléen explicite, le premier rattachement admissible décrit au §5.3 et la validation des bases ; aucune reprise d’un autre compte nommé. Détacher une lecture devenue terminale exige une nouvelle création manuelle explicitement choisie ; aucune méthode ne ferme ce journal ni ne l’adopte comme une nouvelle réponse déjà relue.

### 9.3 Porte transactionnelle du dépôt

Le dépôt ajoute une seule porte étroite, utilisée par le service et non appelée directement par les formulaires :

```ts
repo.muterEditeur({
  metier: { puts?: StoreRows, conditions?: Conditions,
            recettes?: ContexteRecette[], editions?: ContexteEdition[] },
  internes: { puts?: LigneEditeur[], deletes?: string[], conditions?: ConditionLocale[] }
}, {origin:'device'|'local', baseAttendue, contexteValide: () => boolean})
  => Promise<{metier: StoreRows, internes: LigneEditeur[]}> // après commit seulement
```

`LigneEditeur` est exactement `{key,value}`. Les écritures/suppressions internes sont limitées à `editor_draft:v1:*` et `editor_library_epoch:v1` ; les reçus remplacent leur brouillon sous la même clé. Une condition de lecture seule sur `sync_state.user_id` est permise mais ne peut jamais écrire/supprimer ce propriétaire. Une condition `{toutes:true, verifier}` sur `sync_state` sert au calcul transactionnel des quotas ; elle ne renvoie pas ces lignes à l’UI. Tout autre namespace interne ou magasin métier inconnu est refusé. `origin:'device'` exige un lot métier vide ; publication utilise `origin:'local'`.

Cette porte réemploie les gardes de `protegerMutationRecettes`, la normalisation/horodatage métier et `db.mutate`, avec la capture d’outbox dans la même transaction. Elle ne désactive ni le contrôle de propriétaire, ni les cycles, ni les conditions de source. Elle contrôle l’identité vivante de base/génération avant et après les lectures préparatoires ; les conditions finales la recontrôlent synchroniquement. Les contextes métier viennent des bases du brouillon, avec les fonctions en vol reconstruites ; ils ne sont pas recapturés sur le dernier cycle reçu.

La différence nécessaire avec `saveBatch` est explicite : celui-ci horodate actuellement tous les magasins, y compris `sync_state`, et retourne les puts préparés sans les fusions réellement écrites. `muterEditeur` conserve les internes bruts et retourne les lignes finales après commit ; il permet leurs suppressions conditionnées. Les fusions métier et internes restent distinguées jusqu’au passage dans la même mutation, sans ajouter un second write après la version. Les conditions sur une même clé sont composées une seule fois ; une source vérifiée par `fusion:()=>null` n’est pas réécrite ni réhorodatée.

Les quotas se calculent sur l’état initial relu plus la totalité des puts/fusions/suppressions internes projetés. Un remplacement de brouillon soustrait son ancienne taille avant d’ajouter la nouvelle. L’enveloppe complète, dates internes comprises, est mesurée exactement ; aucune date technique n’est ajoutée après ce calcul. Nombre, taille unitaire et total sont vérifiés avant `onMutate`, donc avant toute capture ou écriture. Deux onglets écrivant des clés distinctes sérialisent ce contrôle par le même magasin `sync_state` en transaction readwrite. Aucun `await` ni digest dans les callbacks IndexedDB.

### 9.4 Préparation et publication atomique

```ts
preparerPublication({id, portee, expectedRevision})
  => {issue:'ok', plan, apercu:{kind, cible, changements, versionCourante}}
   | {issue:'sans_changement'} | {issue:'deja_publie', recu, destination}
publierBrouillon({plan})
  => {issue:'publie'|'deja_publie', recu, destination}
```

Préparer relit le brouillon confirmé : une saisie non encore conservée n’entre pas dans la publication. Il valide modèles et tailles des futures lignes métier, vérifie les signatures persistées, prépare les projections exactes en mémoire, puis construit un plan opaque lié à cette base vivante, portée, révision, opération et empreinte de payload. Il n’écrit aucune ligne, ne ferme aucun journal, n’adopte aucune base et ne recalcule pas de décision de pointeur. Une nouvelle conservation rend l’ancien plan périmé. L’aperçu sert à présenter la décision, pas à fabriquer des puts dans l’UI.

`publierBrouillon` appelle une fois `muterEditeur` avec :

1. Conditions sur propriétaire, époque et copie exacte/révision du brouillon, plus ses champs de base persistés ; une révision seule ne suffit pas face à une ligne interne altérée.
2. Gardes L1/L2 de la recette et de l’édition, associations et projections synchrones exactes de la source/ancêtres. Pour les métadonnées, seuls les champs modifiés comparent leur valeur présente/absente puis fusionnent dans la fiche relue. Pour une correction, le pointeur doit encore égaler celui de `pointer_decision`, même en mode preserve ; replace modifie le pointeur et ses dérivés ensemble. Adaptation/métadonnées préservent le pointeur relu sans le verrouiller inutilement.
3. Absence des identifiants réservés de toute nouvelle recette/version ; aucune fiche manquante n’est recréée par fallback. La version source n’entre jamais dans les puts.
4. Si journal : état `a_verifier`, identité/cible/propriétaire/contextes et projection de lecture exactement vérifiés. Fermeture par fusion du journal relu vers `enregistre`, réponse brute effacée selon le parcours existant ; résultat validé et provenance de lecture conservés. Les pages/documents/séance liés sont vérifiés et leurs seuls champs nécessaires fusionnés dans cette même transaction. Aucun déplacement de parent, remplacement d’ordre ou recours à une ancienne copie de séance. Tout écart refuse le lot entier, sans détachement automatique au prochain clic.
5. Puts/fusions métier, reçu interne `committed`, contrôle du quota et capture d’outbox communs. Le formulaire ne se ferme et ne navigue qu’après la résolution réussie de cette transaction.

Le reçu conserve seulement `{format,id,owner_id,database_name,library_epoch,state:'committed',revision,created_at,saved_at,publication:{operation_id,published_revision,payload_sha256,kind,recipe_id?,version_id?,book_id?,edition_id?,import_id?,committed_at}}`. Il ne contient ni payload, ni bases, ni réponse assistant. `revision` vaut la révision publiée plus 1 ; `published_revision` et `payload_sha256` nomment exactement l’intention publiée. La destination est calculée depuis les identifiants confirmés du reçu, jamais depuis une URL libre stockée.

Un réessai trouve ce reçu de même portée/opération/révision publiée et rend `deja_publie` sans réécrire métier, journal, dates ou outbox. Si deux plans concurrents passent la préparation, le perdant reconnaît le reçu exact dans le CAS et interrompt la mutation avant toute écriture ; ce refus interne contrôlé devient `deja_publie` seulement après revalidation de portée. Une collision d’ID, un reçu différent ou un brouillon absent n’est jamais traité comme un succès. Les reçus peuvent être réduits à 128 par un nettoyage `device` conditionné séparé après succès ; son échec ne change pas le résultat métier. Un ancien reçu évincé ne permet pas de rejouer un ancien plan : l’absence du brouillon refuse la publication. Aucune intention n’est reconstruite à partir de ses seuls identifiants.

### 9.5 Remplacement, effacement et propriété des fichiers

`backup.applyArchive` utilise le module de format/portée indépendant pour fabriquer une nouvelle ligne d’époque locale ; il ajoute ce put à sa transaction existante uniquement en mode `replace`. L’archive ne fournit jamais cette valeur. La garde de propriétaire et les gardes de graphe/cycle restent actives ; fusion et restauration refusée gardent l’époque. Les brouillons/reçus ne sont ni vidés ni importés. Le bilan d’archive et `verifyRestored` continuent à porter seulement sur la bibliothèque. Aucun import circulaire `backup → service → repo → backup`.

`repo.clearDevice` vide déjà tous les magasins puis préserve seulement `device_id` dans la même transaction : conserver ce contrat retire époque, brouillons et reçus ensemble, sans deuxième purge tardive. Les avertissements et l’export volontaire de texte précèdent ce geste ; le service de brouillon ne le lance pas. `createArchive` et la synchronisation continuent à exclure tous les internes.

Répartition prévue après publication L3, sans construction dans cette spec :

| Volet | Fichiers et responsabilité |
|---|---|
| **A — domaine, stockage, publication** | `domain/brouillons-format.js`, `domain/brouillons-editeur.js`, porte `model/repo.js`, raccord `domain/backup.js`, tests de quota/CAS/publication/archive/deux moteurs. Fournit les contrats aux formulaires, conserve l’unique propriété du namespace. |
| **B — modèle et éditeur recette** | Modèle pur d’édition recette, `ui/recipe-edit.js` et composants recette/source, tests de contenu, reprise et versions. N’écrit jamais directement le namespace ou une version hors de la porte de publication. |
| **C — livre et sorties** | Modèle/formulaire bibliographique extrait de `ui/book.js`, statut/reprise/comparaison partagés, garde de sortie asynchrone dans routeur/app et raccords des formulaires, tests d’historique et brouillons livre. Coordonne le composant partagé avec B avant de modifier ses appels. |
| **Responsable d’intégration** | Styles, français/anglais, modules du précache, versions/épingles, runner, régressions complètes, réception et publication. Aucun SQL pour ce lot. |

Construction : reproductions rouges et modèles proches des bornes ; contrat pur/stockage ; publication atomique ; intégration recette/livre ; sorties/reprise ; régression import/TM/traductions/photos/archives et vrais parcours petits écrans/hors ligne. A fournit des doubles conformes et les signatures figées pour permettre B/C en parallèle ; le contrat transactionnel reste unique. Aucun code L4 avant publication L3.

## 10. Réception obligatoire

1. Correction, variante, création et métadonnées : brouillon confirmé, fermeture/rechargement hors ligne, reprise exacte, ordre/ID de lignes/paragraphes/étapes et valeurs inconnues préservés.
2. Retour liste→fiche→éditeur→fiche→liste : saisie protégée, origine/version/langue/portions et ancre L3 conservées. Échap, clic extérieur, arrière/avance et refus de sortie sans boucle.
3. Deux onglets sur la même révision : un seul CAS accepté ; la seconde saisie demeure récupérable. Retard d’écriture, double clic et accusé local perdu ne doublent pas recette/version.
4. Retrait/restauration, changement d’association, source modifiée, base disparue, remplacement d’archive, compte A→B et garde refusée pendant une attente : aucune publication périmée, aucun texte appliqué au mauvais propriétaire.
5. Métadonnées concurrentes : un champ non touché conserve sa nouvelle valeur ; même champ changé déclenche comparaison. Livre partagé, couverture/notes ajoutées entre ouverture et publication conservées.
6. Quotas à la limite exacte et +1 sur la ligne complète ; deux créations concurrentes franchissant ensemble le total ; QuotaExceededError et stockage indisponible : aucun faux succès, aucun ancien brouillon évincé. Recette/version et livre/édition proches de 512 Kio par ligne, textes multioctets et caractères échappés : correction conservée/reprise sous 2 Mio sans duplication de source, coût du snapshot d’archive mesuré à 8 Mio.
7. Publication du brouillon et outbox dans la même transaction ; arrêt simulé avant/après commit ; réessai idempotent. Import déjà enregistré/ignoré, résultat changé sous le même id/date après rechargement et changement pendant le hachage/précontrôle : aucune fermeture de la réponse non affichée. Correction d’une ancienne version : pointeur préservé par défaut ; remplacement explicite relu ; changement du pointeur juste avant transaction refusé sans version ni reçu partiels.
8. Zéro appel assistant à l’ouverture/reprise/changement de section ; réponse payée originale conservée dans son journal, relecture toujours explicite. Brouillon TM invalide ne réactive aucune commande de cuisson/export robot.
9. Traductions L0, structure et trous de segments préservés ; modifier l’ordre d’étapes d’une nouvelle version ne réattribue pas les traductions de la précédente. Pas de groupes simulés, pas de conversion automatique de rendement.
10. Archive3 et paquets des moteurs ne contiennent ni brouillon ni reçu ; remplacement change l’époque atomiquement ; effacement retire les lignes internes et exige les avertissements annoncés.
11. Chrome réel à 320/390/768/1280, texte à 200 %, clavier, source côte à côte et bascule mobile, focus/position lors de reprise. Pas d’attente `waitForFunction` asynchrone donnant un faux positif.

La réception ne conclut pas à Safari/iPhone physique, à la survie d’un stockage supprimé par le système ou à une publication distante non testée. Ces limites restent explicites dans le bilan de livraison.
