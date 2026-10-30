# L8 — Protocole des mutations d’inventaire

30 octobre 2026. Revue A du code et de la spec L8, sans code L8 ni SQL distant. Base publiée L7 : code8fb0784, reçu f7e836a,0.29.0/DB6/archive6/SQL0012, suite publique10653/10653. Cible L8 :0.30.0/DB6/archive7/SQL0013. Contrat relu techniquement A/B/C/root avant code, dans l’autorisation de poursuivre le plan ; aucune relecture personnelle de Neegan attribuée.

Références : `docs/superpowers/specs/2026-10-29-l8-repas-inventaire-design.md`, son plan, `src/ui/kitchen.js`, `repo.js`, `schema.js`, `sync/pull.js`, gardes SQL0008/0009 et protocole L7.

## 1. Périmètre et nécessité de la commande

Le magasin `inventory` existe, synchronisé et archivé. Aucun magasin, table de journal, index IndexedDB, appel assistant ni serveur supplémentaire n’est nécessaire. Une mutation de stock utilise une commande `inventory_change`, une ligne cible et un reçu borné. La quantité est un résultat absolu préparé depuis la copie affichée ; le serveur vérifie ce résultat et la base avant d’écrire.

Une RPC est nécessaire pour empêcher deux appareils de consommer chacun depuis le même restant : les puts ordinaires ne transmettent pas leur base métier, et un déclencheur ne peut pas distinguer deux diminutions intentionnelles d’un ancien instantané. La commande porte cette base. Le déclencheur invoker suffit ensuite à interdire les contournements ordinaires, anciens RPC, REST, tombales et effacement des nouveaux marqueurs. Il ne remplace pas la commande.

Repas/courses restent sous les gardes L1/L2 existantes et le CAS local ciblé de L8. Aucune RPC nouvelle pour une date civile, un rayon, une ligne libre ou une case. **Limite explicite : le transport ordinaire reste un arbitrage de lignes horodatées entre appareils.** `decider()` dans pull adopte une ligne distante plus récente sans conflit ; deux cases cochées sur deux appareils ne sont donc pas promises fusionnées ni toutes deux conservées par le seul CAS local. La réception « deux cases simultanées » doit distinguer deux onglets sur la même base (fusion locale) et deux appareils (limite existante). Si le produit exige l’absence de perte distante de ces champs, une extension doit être spécifiée et prouvée avant de la revendiquer ; ne pas l’ajouter sous couvert d’`inventory_change`.

## 2. Quantité fermée et calcul exact

`stock` conserve exactement la forme proposée : `{format:1,unit,initial,remaining,state}`. Unité parmi `portion,piece,g,kg,ml,l` ou null. État `available|finished`. Quantité inconnue : unité/initial/restant null. Quantité connue : unité non nulle, restant numérique, initial numérique ou null pour l’adoption/correction explicitement confirmée d’un historique dont l’initial est inconnu. Initial connu ≥ restant. Création neuve connue : initial=restant>0. Terminé connu : restant0 ; terminé inconnu : restantnull. Disponible connu : restant>0.

Bornes de la spec : portions/pièces≤1000, autres unités≤10^9, précision≤6 décimales. Pas de `Number(x)||1`, pas de tolérance flottante, pas de saturation. L’analyse d’une saisie décimale transforme son texte validé en millionièmes entiers (BigInt en JS, numeric entier en SQL), maximum10^15. Pour les nombres JSON, développer la notation décimale canonique/exponentielle sans multiplication flottante avant le contrôle de précision. Le résultat exact est reformé depuis l’entier décimal ; le stockage JSON reste un nombre, pas un nouveau format d’unité. Les vecteurs doivent couvrir0,000001,1,000001,999999999,999999,10^9, les exposants admissibles et la septième décimale.

`consume` exige une quantité >0 dans l’unité conservée et ≤restant ; il vérifie que l’après fourni est l’exacte soustraction, sans changer initial/unité. Consommer tout passe explicitement à finished. `finish` accepte aussi l’inconnu et produit le terminé correspondant. Ni l’un ni l’autre ne lit les ingrédients ou les portions théoriques de la recette.

Dates `_on` : calendrier grégorien valide `YYYY-MM-DD`, années0001..9999, sans conversion UTC. Dates techniques et de mouvement : ISO UTC millisecondes strict de L7. Les anciens `prepared_at/use_by` restent documentaires ; aucune normalisation au chargement. Une date civile nouvelle ne réécrit pas l’ancien champ. La priorité de `_on` dépend de la présence de la clé, jamais de sa valeur vraie/fausse : clé présente avec date → date civile ; clé présente avec null → date explicitement retirée, sans repli vers ancien ISO ; clé absente → ancien prepared_at/use_by documentaire si présent. Toute projection (inventaire, accueil, filtres, export) utilise cette même règle. Un edit peut donc retirer une date avec prepared_on:null ou use_by_on:null sans que l’ancienne date réapparaisse.

## 3. Champs réservés, historique et annulation

Une ligne devient protégée dès qu’elle porte l’un des champs réservés, même si la forme est malformée :

```js
stock
stock_revision                 // iv_op_ + SHA256
stock_last_action              // null ou forme ci-dessous
stock_receipts                 // 0..128 reçus
stock_receipt_floor            // entier 0..length
```

Forme de dernière action :

```js
{operation_id,type:'consume'|'finish'|'undo',at,
 before:Stock,after:Stock,undo_of:null|OperationId}
```

`operation_id` est la révision de résultat du mouvement. `consume/finish` ont undo_of=null. `undo` nomme l’opération annulée et garde sa propre preuve avant/après ; aucun bouton d’annulation d’annulation. L’annulation est admissible seulement si la dernière action est consume/finish, son operation_id=stock_revision et le stock courant égale son after. Elle remet son before exactement, uniquement dans stock. Tout edit/adopt met last_action ànull et avance la révision, y compris une seule note. Un second mouvement remplace la dernière action.

Pas d’incarnation supplémentaire : **tous** les gestes sur ligne protégée comparent stock_revision, et restore en réserve une nouvelle. Cela invalide aussi une ancienne annulation, même si l’import conserve la dernière action historique octet pour octet. Cette preuve historique ne devient jamais une autorisation d’annuler après restore.

Reçus compacts `{operation_id,payload_sha256}` FIFO128, comme L6/L7. Même ID/autres octets refuse. Un reçu exact encore fiable rend `already_applied` avec la ligne serveur **courante**, sans appliquer le vieux résultat, même après une action ultérieure. Après éviction, l’ancienne base ne correspond plus : refus, aucune réapplication. Restore importe les reçus comme documentaires, pose le floor à leur longueur puis ajoute son propre reçu fiable avec l’éviction bornée habituelle. Le floor provenant de l’archive n’est jamais adopté comme autorité.

Les champs non réservés historiques inconnus restent intacts. La mutation n’accepte pas un remplacement arbitraire de la ligne. La correction explicite porte seulement les clés admises ci-dessous. Les références `ingredient_id/source_recipe_id/source_recipe_version_id/source_cook_history_id` sont fixées à create/adopt, puis immuables : changer la provenance de restes ne réattribue pas un ancien lot. Un autre lot reste un geste séparé.

## 4. Commande et actions exactes

Enveloppe fermée, une cible :

```js
{protocol:1,op:'inventory_change',store:'inventory',id,
 action:'create'|'adopt'|'edit'|'consume'|'finish'|'undo'|'restore',
 operation_id,nonce,payload_sha256,base,change,source}
```

IDs et SHA utilisent les validateurs/canonicalisation L5/L6, tri UTF8, présence distincte de null, sans nettoyage de texte signé. `operation_id='iv_op_'+SHA256({projection:'inventory-intent-v1',command})` où command exclut operation_id/payload_sha256 ; payload_sha256 signe l’enveloppe avec operation_id, sans lui-même. Le nonce vient du geste réservé. Propriétaire et époque ne sont pas inventés dans le lot : portée locale durable et owner_id SQL/RLS restent l’autorité ; la commande ne contient aucun secret.

Projection `inventory-seed-v1` : ligne complète, hors created_at/updated_at seulement, avec absence/null préservés. Elle inclut donc révision, reçu, dernière action et toutes extensions historiques. Bases différentes ne sont jamais rendues égales en ignorant les champs nouveaux. Les dates techniques sont protégées par le fabricant/guard, non modifiables par un patch utilisateur.

| Action | base, fermée | change, fermé | Effet |
|---|---|---|---|
| create | `{target:null}` | `{lot}` | Cible absente, lot neuf sans champs réservés autres que stock ; stock initial=restant. Révision/reçu calculés par service/SQL |
| adopt | `{legacy_sha256}` | `{stock,patch}` | Ligne legacy exacte, sans aucun marqueur réservé ; quantité explicitement confirmée, sans lecture automatique du texte. Préserve tous autres champs, last_action=null |
| edit | `{revision,seed_sha256}` | `{patch,stock}` | stock=null signifie ne pas le changer, sinon Stock validé et explicitement confirmé. Patch non vide ou stock différent ; last_action=null |
| consume | `{revision,seed_sha256}` | `{amount,after,at}` | Stock connu disponible, calcul exact vérifié ; seule mutation métier : stock et nouvelle action |
| finish | `{revision,seed_sha256}` | `{after,at}` | Disponible, terminé connu/inconnu vérifié ; nouvelle action |
| undo | `{revision,seed_sha256,action_id}` | `{at}` | Recalcule uniquement le before de la dernière action admissible ; aucun before arbitraire fourni par l’appelant |
| restore | `{expected_target_sha256:null|hash}` | `{purpose:'archive'|'bootstrap',target}` | Cible absente ou seed strictement identique au target historique ; nouvelle révision, reçus documentaires, aucune consommation |

`lot` neuf : champs autorisés `id,label,ingredient_id,source_recipe_id,source_recipe_version_id,source_cook_history_id,quantity_text,portions,location,prepared_at,use_by,use_by_origin,prepared_on,use_by_on,reheat_method,expected_quality,notes,stock,created_at,updated_at`. Le fabricant neuf n’invente pas portions/prepared_at/use_by : null si aucune donnée réelle. Label obligatoire≤1000points, notes/texte libre/réchauffage/qualité≤10000points chacun, emplacement parmi congelateur/frigo/garde_manger. Dates/source/références ont leurs validateurs dédiés.

`patch` fermé : `label,quantity_text,location,prepared_on,use_by_on,use_by_origin,reheat_method,expected_quality,notes`. Une clé absente n’est pas touchée, null admis seulement pour les dates/origine. La mention libre peut être corrigée explicitement mais n’est jamais fabriquée à partir de remaining. `portions` ancien n’est plus décrémenté. Aucune provenance/identité/date technique/extension inconnue dans le patch. Adoption vide permise pour confirmer seulement le Stock ; edit sans changement est un résultat sans écriture, pas une fausse nouvelle action.

## 5. Sources et contexte de cuisson

`source` est fermé :

```js
{mode:'none'|'active'|'historical'|'restore',
 recipe:null|{id,sha256:null|hash},
 edition:null|{id,sha256:null|hash},
 version:null|{id,sha256:null|hash},
 history:null|{id,sha256:null|hash}}
```

Les IDs doivent couvrir exactement les liens du lot, pas une liste libre. Les hashes sont des projections de liens/cycles, **pas** des titres ou notes : recipe = présence de id,lifecycle_id,trashed_at,edition_id,restored_from_edition ; edition = id,lifecycle_id,trashed_at,trash_mode ; version = id,recipe_id ; history = id,recipe_id,recipe_version_id. Discriminants respectifs `inventory-recipe-v1`, `inventory-edition-v1`, `inventory-version-v1`, `inventory-history-v1`. Les valeurs sont représentées par `[champ,[false]]` ou `[champ,[true,valeur]]` comme L5. Hash null signifie absence effectivement capturée, jamais joker. Une tombale est traitée comme absence documentaire mais interdit une nouvelle référence active.

Mode déduit de l’action, jamais permission libre :

- Sans références : none, toutes les entrées null.
- create lié à une recette sans reçu de cuisson : active, recipe/version présentes et association exacte ; cycles L1/L2 et exception recette gardée active L2 valides.
- create avec source_cook_history_id : historical seulement si la cuisson existe et le tuple histoire/recette/version correspond exactement. La recette peut être retirée mais demeure historique ; on ne la réactive pas. Le tuple garde le même propriétaire SQL. Le transport attend l’historique, pas la version courante. Si la source a disparu, ne pas fabriquer un nouveau lot lié sans preuve : accès documentaire et saisie manuelle d’un lot sans référence restent explicites.
- adopt/edit/consume/finish/undo existants : historical, identités héritées inchangées. Retrait n’interdit pas de consommer un lot réel ; source absente déjà capturée reste documentaire, sans fausse réassociation. Tout changement d’existence/association/cycle entre préparation et commit refuse et demande comparaison, même en historique.
- restore : documentaire, projections des liens présents ou absents capturées depuis l’archive+base prévue ; aucune exigence d’activité. Signature/identités/texte du target restent historiques. Une cuisson présente doit toujours correspondre au tuple ; une relation manquante est signalée selon les règles d’archive existantes, pas remplacée par une autre cuisson.

Le hook de cuisson `onEnregistre({deja,rows})` capture le reçu synchroniquement après le commit vérifié et **avant** la résolution de `fermer(true)`. Il ne monte aucun formulaire et ne navigue pas. Son rôle est uniquement de transférer au caller une copie des lignes confirmées et leurs IDs dans la portée capturée. Le caller reprend après `await ouvrirCuissons(...)`, possède alors le reçu exact et contrôle une éventuelle suite Restes avant sa navigation finale. Le booléen historique reste inchangé. Le callback ne transforme jamais un commit réussi en échec si son consommateur lève ; l’erreur de présentation est séparée. Sans reçu exact, sans geste Restes ou après dispose/changement de portée : aucun lot ni formulaire tardif. Une session déjà terminée sans IDs de cuisson ne fabrique pas de reçu par tri des historiques.

Les gardes L1/L2 courantes permettent déjà UPDATE historique à liens inchangés. La nouvelle création historique de restes exige l’exception étroite validée dans l’entrée L8 : le serveur relit le tuple, puis les triggers n’accordent l’écriture élevée qu’au vrai propriétaire de la fonction L8 sous son contexte borné. Aucun GUC seul, booléen historical ou ancien `source_batch` ne peut fabriquer cet accès.

## 6. Dépôt, synchronisation et refus

Feuilles proposées `domain/inventaire-format.js`, `inventaire-mutations.js`, service `inventaire-persistance.js`. Portée identique L7 : owner durable de sync_state, base/nom, library_epoch, génération et vue ; copie affichée capturée avant dialogue/await. Préparation hors transaction, crypto hors IDB. Porte `repo.muterInventaire` fermée à inventory et ses gardes de lecture ; un commit unique lot+outbox+reçu. Le contrôleur garde le même plan opaque et les mêmes IDs après quota. Aucun commit de cook_history dans cette porte.

API proposée : `creerServiceInventaire({repo,getGeneration,maintenant,newId})`, `capturerPortee`, `lireLot({portee,id})`, `ouvrirCreation({portee})` puis `preparerCreation({portee,creation,affiche,payload})`, `preparerModification({portee,lecture,patch,stock})`, `preparerConsommation({portee,lecture,amount})`, `preparerFin({portee,lecture})`, `preparerAnnulation({portee,lecture})`, `appliquer({intention})`. Sur legacy, seule preparerModification peut préparer adopt, avec stock explicitement confirmé (unité/quantités ou inconnu) ; elle ne prépare aucune consommation. preparerConsommation, preparerFin et preparerAnnulation refusent adoption_requise sur legacy. Le premier geste Modifier confirme donc le stock, puis un nouveau geste consume/finish capture la ligne structurée réellement affichée. Aucun portions/quantity_text historique ne devient une base numérique sans cette confirmation. Aucune adoption à lireLot. `affiche` création porte les copies effectivement montrées de recipe/version/edition/history ou null, et non un simple ID recapturé après attente. Les retours restent `ok/conserve/deja_conserve/refuse/echec`, motif précis, réessayable seulement pour panne d’écriture/réseau.

Outbox immuable, snapshots legacy inventory dès capture, pas de coalescence des commandes. Ancien put initial avant adopt ; chaque commande suivante attend la précédente de la même cible. Cook_history avant create qui le cite, indépendamment de seq matérielle. L’ACK comprend op/hash exacts, reçu et ligne serveur courante ; ne jamais remplacer un overlay local plus récent par l’ACK ancien. Pull écrit copie confirmée et curseur atomiquement, préserve overlay et intentions pendantes. Dates data/signatures restent exactes, séparées de l’enveloppe SQL ; aucun nettoyage des caractères signés. Aucun tick/rendu n’écrit.

Refus serveur : conflit `kind:'inventory'`, file conservée et bloquée, copie confirmée sous namespace partagé `source_confirmed:inventory:<id>`. Pas de « Garder ici » générique, d’abandon de file ni purge30jours. Comparaison explicite montre quantité, état, dernière action et copies locales/confirmées. Adopter la confirmation retire seulement la chaîne de cette cible réellement présentée, sous CAS exact owner/époque/inventaire/file/conflits/confirmation ; ancienne chaîne et lot gardés en récupération durable. Si aucune cible confirmée n’existe, le lot refusé quitte l’inventaire actif vers cette récupération. Aucun delta ni undo recalculé. Reprendre un besoin de consommation signifie **nouveau geste** depuis le stock confirmé affiché, avec quantité demandée à nouveau ; conserver la saisie ancienne comme proposition ne l’applique pas automatiquement.

## 7. SQL, compatibilité et archive

Migration additive0013 après réception L7, capacité `inventory_changes:1`, une entrée réservée `l8_apply_inventory_command(jsonb)` dispatchée par sync_push_v2. Auth/is_allowed/ownerlock avant toute lecture/verrou de ligne ; rôles et search_path fermés, révoquer PUBLIC/anon et helpers, regrant uniquement RPC/validateur readonly nécessaire au trigger invoker. Alias anciens conservent leurs gardes, y comprisSECDEF L5/L6/L7 limités à leurs magasins. Tests sous authenticated après composition complète, pas seulement modules rechargés.

Trigger inventory : legacy sans marqueur reste compatible ; nouveau stock/marker via put ordinaire refusé ; modification/suppression/tombale d’une ligne protégée refusée même si l’ancien client retire tous les marqueurs. Écho strict hors updated_at technique peut passer si forme valide et created_at inchangée. Purge propriétaire explicitement autorisée utilise le même contrôle d’autorité réel que L7, pas un drapeau client. Une suppression individuelle ne remplace pas « Tout consommé ».

Archive7 nécessaire : un lecteur archive6 ne sait pas respecter ce stock ; formats≤6 contenant un marqueur réservé sont refusés comme forme incohérente, anciens formats sans marqueur toujours recevables. Ajout relation `inventory.source_cook_history_id -> cook_history`, validation de son tuple et provenance. DB6 demeure.

Restore/bootstrap via inventory_change restore, jamais put réservé. Une transaction locale prépare tous les tokens, CAS snapshot et écrit batch+époque+intentions ensemble. Ordre serveur sources/versions/historiques nécessaires puis lot. Réimport d’un vieux ZIP après restore frais peut refuser parce que le seed courant a changé : ne pas effacer les nouveaux tokens pour feindre l’identité. Même plan rejoué reste idempotent. Ancres cuisson, traduction, texte source et historiques ne sont pas normalisés par ce lot.

Première liaison sans compte : réutiliser la règle durable déjà reçue, pas de nouvel adopteur de comptes. Une outbox ownernull ne peut être envoyée que sous première identité autorisée de cette bibliothèque ; un owner nonnull ne migre jamais. Les commandes ne portent pas owner dans leur hash ; pas de re-signature ni relecture/rebase nécessaire. Un conflit nommé exact autorise la comparaison locale de sa chaîne anonyme comme L7. Changement explicite de compte passe par clearDevice, donc aucune intention survivante transférée.

## 8. Bornes et réception minimale

Limites transport réutilisées : ligne JSONB≤524288octets, commande≤786432, lot≤921600 enveloppe comprise. Réserver l’espace des128reçus et dernière action avant tout create/adopt/edit : proposition32Kio, à recalculer depuis le fabricant exact. Mesure exploratoire avec les clés ci-dessus :23429octets JSONB pour stock+révision+128reçus+floor+dernière action ; la réserve32Kio couvre aussi undo_of et chiffres aux bornes. Aucun paiement ici, mais un historique déjà proche512Kio peut rester lisible/exportable et refuser adoption avec motif taille ; pas de troncature. Les limites proposées de la spec s’appliquent aux champs saisis, pas rétroactivement aux extensions historiques intactes.

Preuves causales à ajouter avant code :

1.4portions→consume1→3 ; inconnu fini ; texte initial jamais présenté comme restant. Précision décimale exacte et limites/+1.
2. consume→note/quantité/finish puis ancienundo ; doubleundo ; compte/époque ; quota atomicité.
3. Deux connexions réelles même base : un commit, un refus avec proposition récupérable. ACK perdu/rejeu courant, vieille commande après128reçus, mêmeIDautreshash, restore désactive ancienundo/consume même quantité.
4. REST/anciensRPC effacementmarqueurs/tombale/DELETE refusés au bon garde ; legacy autorisé, purge propriétaire isolée ; ACL composition complète.
5. Cuisson tuple changé entre préparation et commit, retrait aprèscuisson, historique manquant, ordre outbox inversé ; aucune création de stock par callback seul.
6. Deux vrais moteurs : création/adoption/consume/refus/récupération, archive/bootstrap/secondappareil, zéroécho. Sources Unicode exactes.

La présente note ne prétend aucun de ces tests L8 réussi. Elle ferme la proposition technique pour revue, sans construction L8.


## 9. Répartition proposée après réception L7, sans permission de coder ici

- **A — stock et protocole** : feuilles `domain/inventaire-format.js` et `inventaire-mutations.js`, service `inventaire-persistance.js`, préparateur pur `inventaire-archive.js`, porte fermée dans `model/repo.js`, métadonnée transaction dans `core/db.js`, raccord outbox/synchronisation `inventory_change`, générateurs SQL0013 et preuves métier/SQL/concurrence. A transmet les exports, la forme de lecture et les plans opaques avant les raccords C. Aucun code repas/courses ni détail d’écran dans ces feuilles.
- **B — repas et courses** : `ui/meals.js`, `ui/grocery.js`, `domain/grocery.js`, raccords bornés recette/recherche et `portionsRepas` si nécessaire, projections de planning/conventions et tests. CAS local par champs/éléments ; dates civiles et portions null explicites ; pas d’extension de protocole distant ni de promesse de fusion interappareils. B coordonne avec C l’emplacement précis du callback dans `ui/cuisson.js` sans écrire ce bloc en parallèle.
- **C — inventaire, restes et archives** : portion inventaire de `ui/kitchen.js` (appareils hors périmètre), composants/dialogues de lot et comparaison, callback/reçu `ui/cuisson.js` et callers de Restes, `domain/backup.js`, seules constantes/relations archive de `model/schema.js`, tests archive/écran. C consomme le préparateur de restauration A ; ne duplique ni hash, ni validation de stock, ni règles de reçu. La reprise après conflit est explicite, avec copie locale récupérable. Les callbacks de bilan ne montent pas d’écran après destruction.
- **Root — intégration** : version/cache/runner/i18n/CSS/navigation globale, coordination du gel de fichiers partagés, réception réelle et publique, documents suivis. Les seules lignes APP_VERSION restent chez root ; C possède le format d’archive/relations après signal.

Avant GO, A ferme les signatures de service nécessaires à C et le contrat de préparation archive avec batch/snapshot/owner/purpose, sans mutation séparée. Les autres modules peuvent construire leurs tests rouges depuis ce contrat. Si la charge sync/SQL A devient le chemin critique, transférer explicitement un bloc autonome à B/root, sans édition concurrente tacite.

## 10. APIs de construction figées pour les consommateurs

Cette section ne change pas le protocole des§2–8. Toutes les données locales restent dans **IndexedDB**, via `repo` et `db.mutate` ; ni SQLite ni nouveau stockage parallèle. Root prend `tools/inventaire-canon-sql.mjs` (export inventaireCanonSql), `tools/inventaire-gardes-sql.mjs` (export inventaireGardesSql) et les preuves correspondantes/ACL/composition ; A inclut ces deux exports dans le générateur0013 et garde publication SQL, domaine, porte repo/DB. Aucun de ces modules ne sera écrit avant GO. B peut recevoir le bloc sync après gel repas/courses par transfert explicite de propriété.

### 10.1 Types et portée

```js
creerServiceInventaire({repo,getGeneration,maintenant=nowIso,newId}) -> Service
Service.capturerPortee({owner_id,estCourante=()=>true})
  -> {issue:'ok',portee}
```

`owner_id` vient du propriétaire durable de la bibliothèque (`ctx.proprietaireDonnees`/lecture sync_state), jamais du seul état d’authentification. Le service vérifie owner, objet de base/nom, library_epoch, génération et vue à chaque attente puis dans la transaction. Les capacités `portee/lecture/creation/intention/comparaison` sont opaques, propres à l’instance, non sérialisables et non forgeables par objets ordinaires. Elles ne contiennent pas d’accès SQL.

Les succès sont discriminés : lecture/préparation `ok`, commit `conserve`, reçu exact déjà appliqué `deja_conserve`. Les autres retours sont :

```js
{issue:'refuse',raison,reessayable:false}
{issue:'echec',raison:'quota_stockage'|'stockage_indisponible',reessayable:true}
```

Motifs domaine fermés pour C : `forme_invalide`, `stock_invalide`, `bornes`, `lot_absent`, `lot_termine`, `quantite_inconnue`, `quantite_depassee`, `precision_invalide`, `adoption_requise`, `annulation_indisponible`, `stock_change`, `source_changee`, `cycle_change`, `compte_change`, `contexte_change`, `bibliotheque_remplacee`, `conflit_absent`, `confirmation_incomplete`, `operations_dependantes`, `restauration_changee`. Le UI peut garder un message général pour un motif inconnu futur, sans le transformer en erreur de saisie. `sans_changement` est un succès de préparation distinct ci-dessous, jamais une écriture annoncée.

### 10.2 Lecture, liste et projection

```js
Service.lireLot({portee,id})
  -> {issue:'ok',lecture,affiche,projection}
Service.listerLots({portee,filtre='disponibles'}) // disponibles | termines | tous
  -> {issue:'ok',lots:[{lecture,affiche,projection}],compteurs,total}
projeterLotInventaire(affiche,{aujourdhui:null|'YYYY-MM-DD'})
  -> ProjectionLot
```

La liste lit les lots présents et produit les mêmes capsules que lireLot. Par défaut disponibles comprend available/legacy/invalid ; les lots finished ne sont rendus que par filtre explicite termines ou tous. C peut filtrer l’emplacement sans nouvelle écriture ; aucun lot n’est caché parce que sa source manque ou son stock est invalide. Les compteurs `{available,finished,legacy,invalid}` portent sur les catégories de tout l’inventaire lu, `total` sur les capsules renvoyées pour le filtre. Legacy reste affiché comme lot non structuré, pas prétendu stock numérique confirmé. Une future pagination ne change pas le contrat métier mais n’est pas nécessaire à L8 et n’ajoute aucun index.

`affiche` contient des copies, jamais les objets vivants de ctx :

```js
{lot,recipe:null|Recipe,version:null|RecipeVersion,
 edition:null|BookEdition,history:null|CookHistory,
 synchronisation:{etat:'locale'|'en_attente'|'confirmee'|'conflit',
   operation_id:null|string,raison:null|string}}
```

Le service ne remplace pas un lien absent par la version courante. Les snapshots de références proviennent d’une même lecture cohérente ; ils sont ensuite revérifiés par les projections fermées du§5. Les copies affichées peuvent servir à un lien documentaire, jamais à une écriture directe.

```js
ProjectionLot = {
 id,etat:'legacy'|'available'|'finished'|'invalid',adoption_requise:boolean,
 label:string|null,location:string|null,
 quantite:{mode:'connue'|'inconnue'|'legacy'|'invalide',
   unit:null|string,initial:null|number,remaining:null|number,
   mention_origine:string|null,portions_anciennes:null|number},
 dates:{prepared:DateLot,use_by:DateLot},
 source:{recipe_id:null|string,version_id:null|string,history_id:null|string,
   etat:'aucune'|'disponible'|'retiree'|'absente'|'incoherente'},
 actions:{modifier:boolean,adopter:boolean,consommer:boolean,
   terminer:boolean,annuler:boolean},
 annulation:null|{operation_id,type:'consume'|'finish',at,before,after},
 raison:null|string,synchronisation:affiche.synchronisation
}
DateLot = {origine:'civil'|'legacy'|'aucune'|'invalide',
 valeur:null|string,depassee:null|boolean}
```

La projection n’écrit pas, ne lit pas l’horloge globale et ne formate pas de traduction : C fournit le jour civil de son affichage pour `depassee`, ou null si non calculé. Null explicite `_on` donne aucune date même si ancien ISO existe. Legacy donne adoption_requise:true et seule action adopter/modifier, sans mouvement ni undo. Une forme réservée invalide donne invalid/actions fausses et copie documentaire disponible ; elle n’est jamais rétrogradée en legacy adoptable. `annulation` n’apparaît que si la dernière action est réellement recevable sous la révision courante. Une source retirée/absente ne désactive pas une diminution documentaire d’un stock valide déjà lié.

### 10.3 Création et références réellement affichées

```js
Service.ouvrirCreation({portee})
  -> {issue:'ok',creation,id}
Service.preparerCreation({portee,creation,affiche:ReferencesCreation,payload})
  -> {issue:'ok',intention,apercu}
ReferencesCreation = {recipe:null|Recipe,version:null|RecipeVersion,
 edition:null|BookEdition,history:null|CookHistory}
```

Ouvrir réserve l’ID de lot et la capsule avant toute attente. Le formulaire conserve cette même capsule jusqu’à réussite/abandon ; un autre lot demande une nouvelle ouverture. Les références de la sélection source sont copiées **au geste qui les affiche** (sélection de recette ou reçu Restes), puis passées intactes à preparerCreation ; le préparateur les copie à nouveau synchroniquement avant son premier await. Il compare au dépôt, sans adopter de nouvelles copies à la place. Un changement explicite du sélecteur capture de nouvelles références montrées, en gardant l’ID du formulaire ; une simple réception sync ne change jamais ces références.

`payload` est fermé : `{label,quantity_text,location,prepared_on,use_by_on,reheat_method,expected_quality,notes,stock}` avec les validations§2/4. Champs texte facultatifs représentés par chaîne vide, dates par null. Les IDs source, la provenance de date user et les champs historiques techniques sont fabriqués uniquement depuis la capsule/références valides ; aucun lien source fourni librement dans payload. Aucun ingredient_id nouveau n’est fabriqué par l’UI L8 (null sur lot neuf, conservé sur legacy). Si history nonnull, recipe/version doivent correspondre à ce reçu exact ; le formulaire ne sélectionne pas un autre couple en gardant la même histoire.

### 10.4 Modifier/adopter, mouvements et commit

```js
Service.preparerModification({portee,lecture,patch,stock:null|Stock})
Service.preparerConsommation({portee,lecture,amount})
Service.preparerFin({portee,lecture})
Service.preparerAnnulation({portee,lecture})
  -> {issue:'ok',intention,apercu}
  |  {issue:'sans_changement',lecture,projection}
Service.appliquer({intention})
  -> {issue:'conserve'|'deja_conserve',lecture,affiche,projection}
```

Sur legacy, modification exige Stock explicitement confirmé (stock ne peut être null), fabrique adopt seul et garde les références historiques exactement. Sur structuré, stocknull garde le stock courant ; patch ne contient que les clés§4. Les autres préparateurs refusent adoption_requise sur legacy. `amount` est le nombre décimal déjà validé par la feuille commune ; un helper pur `lireQuantiteInventaire(texte,unit)` rend `{ok:true,valeur}` ou `{ok:false,raison}` sans coercition ni écriture. C garde le texte saisi si refus.

`apercu` : `{id,action,before:null|ProjectionLot,after:ProjectionLot,quantite_utilisee:null|number}`. Dates de mouvement, IDs et nonce sont réservés avant attente. Les préparateurs sont mémorisés par capsule de lecture/création et entrée exacte : réappeler avec la même base et les mêmes champs rend la même intention ; changer explicitement la saisie crée une autre intention, jamais une base neuve. Un double clic d’appliquer partage le même commit en cours et le même reçu. Les échecs réessayables conservent la capacité ; aucun POST assistant et aucun nouveau mouvement pour réessayer.

Après réussite, le retour porte une nouvelle lecture de la ligne réellement conservée. La UI remplace sa base uniquement sur ce succès. Après conflit/source/cycle, elle garde l’ancienne saisie et propose comparaison/relecture explicite. Aucun `repo.save`/`remove` direct dans l’UI d’inventaire structuré.

### 10.5 Comparaison et récupération sans nouvelle consommation

Ces méthodes appartiennent au même service, avec helper pur isolé `domain/comparaison-inventaire.js` si la taille l’exige :

```js
Service.lireConflits({portee})
  -> {issue:'ok',conflits:[{id,raison,operation_id}]}
Service.capturerComparaison({portee,id})
  -> {issue:'ok',comparaison,affiche:{id,
      locale:null|{affiche:Affiche,projection:ProjectionLot},
      confirmee:null|{affiche:Affiche,projection:ProjectionLot},
      actions:[{action,nombre}],nombre_commandes,raison,
      effet:'adopter_confirmee'|'retirer_overlay',recuperation_conservee:true}}
Service.garderConfirme({comparaison})
  -> {issue:'conserve'|'deja_conserve',id,lecture:null|Lecture,
      affiche:null|Affiche,projection:null|ProjectionLot,recuperation_id}
Service.lireRecuperations({portee})
  -> {issue:'ok',recuperations:[{id,lot_id,at,label,raison,nombre_commandes}]}
Service.exporterRecuperation({portee,id})
  -> {issue:'ok',texte,nomFichier}
```

`locale/confirmee` portent chacune la même paire affichage/projection documentaire que§10.2 ou null ; affiche.lot fournit le stock et stock_last_action exacts pour comparer les deux. Les identités/opérations restent dans la capacité ; l’écran affiche le nombre de commandes et leurs actions, jamais leurs IDs techniques. C n’invente pas de confirmation depuis l’overlay. Le dépôt calcule lui-même la chaîne de toutes les commandes inventory_change de cette cible et exige les copies exactes file/conflits/confirmation/owner/époque au commit. Aucune commande d’un autre protocole/owner n’est retirée. Une telle dépendance inconnue refuse operations_dependantes. L’exception première liaison est uniquement celle du§7, prouvée par conflit nommé/payload exact.

Le geste approuvé garde la copie locale et les intentions en récupération durable avant de remplacer/supprimer l’overlay, origine remote sans écho. L’export produit un texte JSON de récupération borné, rendu/download comme texte, jamais du HTML ou une commande réexécutable automatiquement. Le succès ne crée aucun nouveau mouvement serveur. C peut ensuite afficher la confirmation reçue et proposer **un nouveau geste explicite** de quantité ; aucune méthode « rejouer ma diminution sur la nouvelle base » n’est fournie. Une création refusée dont l’overlay disparaît reste récupérable ; créer un autre lot passe par ouvrirCreation et une sélection source explicite.

### 10.6 Restauration et transaction unique

Exports de `domain/inventaire-archive.js` :

```js
contientInventaireProtege(stores) -> boolean
validerFormesInventaireArchive({stores,archiveVersion})
  -> {avertissements:[{store:'inventory',id,raison}]}
verifierIdentitesInventaireArchive({batch,snapshot})
  -> {avertissements:[{store:'inventory',id,raison}]}
preparerInventaireArchive({batch,snapshot,owner_id,purpose:'archive'|'bootstrap',
                           newId,maintenant})
  -> {batch,inventory_commands,couvertes:Set<string>,avertissements}
```

Ces helpers n’ouvrent pas la DB et n’écrivent rien. validerFormes est synchrone (forme et version d’archive) ; verifierIdentites est asynchrone (hashes, absence/identité et tuple du graphe effectif) et sert à l’inspection/préflight. preparerInventaireArchive rappelle les deux contrôles, donc un préflight ne remplace jamais la validation avant commit. Erreur ferme : `ErreurInventaire` avec code de forme/source/bornes/restauration, à traduire dans le contrat existant de backup. `stores/batch/snapshot` sont des objets de tableaux de lignes, pas des Maps de services. Le snapshot courant fournit au minimum inventory/recipes/book_editions/recipe_versions/cook_history. Le batch contient toutes les lignes proposées après les autres normalisations L1–L7 ; les liens de contexte utilisent ce graphe effectif, tandis que le CAS de cible utilise uniquement le snapshot avant import. Le helper vérifie forme, tuple présent, collisions absente/identique, puis signe les restores et renvoie des copies normalisées seulement pour les tokens/reçus.

Une relation historique absente demeure documentaire et signalée dans avertissements selon les règles archive ; une relation présente contradictoire refuse. Les formats≤6 avec marqueurs réservés refusent. Les lots legacy sont rendus inchangés et non couverts. `couvertes` contient `inventory:<id>` pour les lignes protégées effectivement couvertes ; aucun put ordinaire doublon. Le corps signé et les lignes normalisées gardent exactement les mêmes tokens réservés.

C branche le résultat dans **l’unique db.mutate de l’import**, avec batch métier/fichiers/époque, `inventory_commands` et CAS global des snapshots dont dépend le helper, owner/époque inclus. Ce helper ne fournit pas de fusion arbitraire qui permettrait une deuxième écriture hors gardes. A raccorde cette métadonnée au validateur DB/outbox. Le bootstrap utilise la même fonction et capture/revalide son snapshot dans sa propre transaction ; aucune étape de restauration séparée après un premier commit métier. Owner ne se substitue pas aux identités historiques présentes dans les données.

Ordre d’intégration : helpers archive L1–L7 et versions/histoires d’abord, préparation inventory en dernier sur leur graphe prévu, puis un seul commit local. Le transport assure les dépendances avant commande de stock même si les seq physiques sont inversées. A exporte le validateur et le fabricant uniques ; C ne recalcule pas les hashes, le floor ou la validité d’undo.
