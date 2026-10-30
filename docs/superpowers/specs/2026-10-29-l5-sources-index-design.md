# L5 — Sources et index : révisions et lectures fidèles

**État : contrat relu techniquement — construction autorisée par poursuite globale.** Préparé le 29 octobre 2026, puis relu par A, B et l’intégration après réception publique de L4 ; leurs trois avis techniques sont favorables. Cette revue ne constitue pas une relecture personnelle de Neegan. Aucun code L5 ni SQL appliqué à ce stade. Base L4 reçue : code `39a890a`, reçu documentaire `db085ee`, branche `l5-sources-index`. Pages a publié le code le 30 octobre à 00:10:04 UTC (29 octobre à 20:10 HAE) ; réception publique 8880/8880, 61 fichiers identiques, parcours 28 + 12 mesures. Cibles de construction : application 0.27.0, archive4, DB6 tant qu’aucun index nouveau n’est nécessaire ; ce document ne modifie aucune de ces versions.

Périmètre : C04, §10 et lot L5 du [plan directeur](../../lots/2026-10-29-plan-directeur-interface-fonctions.md). Ce L5 ne désigne pas l’ancien lot de purge des fichiers distants. Les sources d’architecture consultées sont le code local actuel, notamment `ui/import.js`, `ui/index-livre.js`, `domain/index-livre.js`, `domain/sources-import.js`, `model/repo.js`, `core/db.js`, `sync/lot-sources.js`, `sync/outbox.js`, `sync/push.js`, `sync/pull.js`, `sync/transport.js` et migration `0009`.

## 1. Résultat et limites

Depuis un livre partiellement indexé, Neegan ajoute deux photos ou remplace une photo floue. Les recettes et corrections déjà gardées restent. L’application montre quelles images ont été lues, quels résultats sont anciens et ce qui a été ajouté ou complété. Elle ne facture que les pages explicitement choisies qui demandent une lecture.

Les références certaines et les compléments admissibles continuent de s’enregistrer automatiquement après lecture. Les contradictions et les résultats devenus anciens exigent un geste précis. Une référence dans un livre est un contenu utile ; elle n’est pas présentée comme une recette complète vérifiée.

Inclus : ajout, remplacement et rotation des pages image ; séparation révision active/historique ; lecture exacte, reprise, comparaison et consolidation ; dédoublonnage ; protections locales et serveur ; archive et raccord aux sources des versions/brouillons L4 ; interface Sources/Index et bilans.

PDF/EPUB : conserver les documents et les chemins actuels de consultation, expliquer la limite, proposer images et saisie manuelle. Aucun rendu automatique de toutes les pages, rasteriseur PDF, lecteur EPUB complet, OCR local ou nouveau fournisseur assistant dans L5. Une extension de rasterisation demande sa propre spec. Aucune purge de fichiers, aucun remplacement global de l’index, aucune réécriture des originaux, aucune refonte de L6/L7.

## 2. Constat de départ

1. `replacePage` crée un nouveau document mais change `document_id` et `sha256` sur la page existante. Les gardes L2 interdisent désormais le déplacement du parent d’une page, côté dépôt et serveur. Rétablir ce geste en retirant cette garde ferait perdre la provenance : L5 crée une autre page.
2. Pivoter modifie `rotation` sous le même ID. Miniature et image préparée suivent la rotation, mais les anciennes versions n’ont pas une révision indépendante.
3. `signaturePageImport` et `conditionsSourcesImport` protègent déjà les sept valeurs page/édition/document/empreinte/rotation/numéro/position. Les réponses tardives restent dans le journal ; L2 exige une relecture après changement de cycle. Ces protections sont conservées.
4. `lectureDeSeance` choisit la dernière lecture réussie par `page_id`, puis fusionne des décisions de plusieurs journaux. Elle ne constitue pas à elle seule un historique immuable d’image ni une preuve qu’une décision s’applique au résultat actuel.
5. Les moteurs `consolider`, `fabriquerReferenceIndex`, `completerExistante` et `referenceIntacte` existent. L5 les fait évoluer ; il ne crée pas un second moteur d’index.
6. `source_batch` est un complément atomique réservé à une séance exclusive à une recette : une recette active, une édition, nouvelles sources appendues, CAS de la séance. `0009::l2_sync_sources` vérifie ces contraintes, les garde sous verrou de propriétaire et rend un accusé portant les lignes. Ce contrat ne peut pas représenter l’index général d’un livre ni son remplacement. Il reste inchangé.

## 3. Invariants

- L’ID de `source_pages` désigne une révision d’image. Une nouvelle image ou transformation envoyée à l’assistant reçoit un nouvel ID. Les versions/lectures existantes continuent de citer l’ancien ID.
- Une révision ne change ni document, ni édition, ni empreinte, ni rotation, ni parent de révision. Les octets référencés restent accessibles suivant le contrat de fichiers existant.
- La sélection active et l’historique sont distincts. Retirer de la sélection ne retire pas les références, versions ou résultats payés.
- Une réponse porte la capture réellement envoyée. Une réponse tardive peut être conservée mais ne devient pas la lecture d’une autre image.
- Enregistrer s’appuie sur les copies affichées et revalidées en transaction. Aucun changement de source, de propriétaire, d’époque, de cycle ou de réponse n’est adopté silencieusement.
- Un doublon est évalué dans l’édition, avec titre normalisé et plages imprimées ; une rubrique reste conservée. Même titre avec pages différentes n’est pas fusionné automatiquement.
- Les favoris, notes, titres personnalisés, recettes complètes et états de corbeille ne sont jamais écrasés ou réactivés par consolidation.
- La conservation locale, l’envoi et la disponibilité distante des octets sont trois états distincts. Une erreur ne produit aucun succès fictif.
- Aucune purge physique des anciennes pages/documents/fichiers, même après remplacement ou retrait.

## 4. Modèle de révision

### 4.1 Réutiliser les magasins

Aucun nouveau magasin synchronisé. `source_pages`, `source_documents`, `scan_sessions`, `imports` et `recipes` reçoivent des champs JSON optionnels explicitement validés. Les noms ci-dessous constituent le contrat proposé ; toute variation décidée à la relecture mettra à jour la spec avant code.

Une page nouvellement gérée porte :

```js
source_revision: {
  format: 1,
  family_id: 'id-de-la-premiere-page',
  parent_page_id: 'id-revision-remplacee-ou-null',
  operation_id: 'intention-de-creation',
  reason: 'capture' | 'replace' | 'rotate' | 'attach'
}
```

Les identifiants ne contiennent aucun titre, URL ou donnée de compte. Chaque objet est fermé. `family_id` est l’ID de la première page de la chaîne ; la première capture a `family_id === id`, parent null. Une page ancienne sans cet objet se lit comme sa propre première révision. On ne lui attribue pas une capture, une date ou une lecture inexistante.

Projection d’identité immuable : `id`, `edition_id`, `document_id`, `sha256`, rotation normalisée parmi 0/90/180/270, `source_revision` et éventuelle position dans un document multipage. Une date technique `updated_at` n’en fait pas partie. `printed_page`, classification, problèmes signalés et annotations peuvent évoluer, sous CAS distinct ; ils ne changent pas les octets lus. Une lecture peut néanmoins dépendre de ces annotations : sa capture les garde séparément et refuse une application qui les aurait remplacées sans relecture.

Remplacer crée un document photo neuf avec `replaces_document_id` lorsque pertinent, et une page neuve. Pivoter crée une page neuve citant le même document/empreinte, avec la rotation demandée et l’ancienne page comme parent ; pas de recopie du fichier original. La préparation pour l’assistant reste celle du parcours existant.

Un parent appartient à la même édition et famille, existe, n’est pas une tombale et n’est pas la nouvelle page. La chaîne est sans boucle. `family_id === id` est une racine valide ; seul `parent_page_id` participe au contrôle de cycle. Une limite de profondeur à 256 est contrôlée avant mutation et à l’import ; au-delà, conserver la source et refuser une nouvelle révision avec un message exact, sans aplatir le passé. Cette limite porte l’historique d’une même image, pas le nombre de pages d’un livre.

### 4.2 Pages actives et historique d’une séance

`scan_sessions.page_ids` devient, pour une séance gérée, la liste dédoublonnée des révisions connues de cette séance. Elle conserve les anciens IDs. Un champ distinct porte la sélection courante :

```js
source_state: {
  format: 1,
  revision: 'operation-id-du-dernier-choix',
  active_page_ids: ['revision-courante-1', 'revision-courante-2']
}
```

Sans ce champ, les pages actives sont exactement les `page_ids` existants. La première commande L5 introduit `source_state` dans la même transaction que son geste. `active_page_ids` ne contient que des IDs présents dans `page_ids`, une seule révision par famille et aucun doublon. L’ordre de cette liste est l’ordre choisi pour la lecture. `document_ids` garde les documents nécessaires à toutes les révisions. Aucun nettoyage implicite.

Les lecteurs passent par `pagesActivesSeance(session)` ; ils ne réinterprètent pas `page_ids` comme la sélection actuelle d’une séance gérée. Ceci concerne Importer, Index, Classement, les reprises et la création depuis des pages. Les sources d’une version, elles, utilisent ses IDs exacts et ne passent jamais par le résolveur de pages actives.

Conserver séparément l’ordre de sélection, l’ordre de capture et la position dans le fichier. `position` conserve le sens historique d’ordre de capture ; un remplacement garde le rang de sélection de la famille, mais sa capture est nouvelle. Un éventuel `document_page_number` est un numéro de page dans le fichier fourni, jamais déduit du numéro imprimé. L5 ne crée ce champ que si un parcours possède cette information.

### 4.3 Retirer et restaurer dans la séance

« Retirer de la séance » enlève la famille de `active_page_ids`, en conservant page, document et octets. Un résumé précise que les recettes déjà créées restent. Annuler rétablit la sélection précédente si son CAS est encore valable. L’historique propose « Utiliser cette révision » ; c’est un nouveau choix explicite, sans déplacement des références des recettes. Une révision ancienne sélectionnée ne reçoit pas automatiquement une ancienne validation de lecture devenue indémontrable.

Ces gestes changent `source_state.revision` et la sélection, pas l’identité des pages. Il n’existe pas de bouton « supprimer toutes les recettes provenant de cette photo » dans ce lot. Le retrait des références intactes déjà offert par l’index reste le flux corbeille L2, avec bilan et gardes.

### 4.4 Associer des sources à un livre

Le sélecteur actuel qui réécrit `edition_id` sur séance/documents/pages est remplacé par un geste `attach` explicite. Aucune exception générale null→édition et aucun déplacement de parent des anciens objets. Le livre cible doit être actif et son cycle capturé.

`preparerRattachementSources({capture,editionCibleAffichee})` réserve une séance, des documents et des pages neufs pour la fermeture complète du graphe affiché. Les octets sont réutilisés par SHA ; les chaînes, dates de capture connues, annotations et sélection sont copiées. Les parents/familles, les remplacements de documents et l’opération commune de copie sont vérifiés au dépôt, en archive et au serveur : un enfant ne peut devenir racine en conservant seulement son image. Les parents/familles sont remappés : les nouvelles racines ont leurs propres IDs et reason=attach. Les descendants restent une chaîne interne à la nouvelle famille. Ce geste n’est pas une nouvelle photographie ni une nouvelle lecture.

Chaque objet copié peut porter `source_copy:{format:1,operation_id,source_id,source_identity_sha256}`. Forme fermée, origine du même magasin et propriétaire, ID différent. C’est une provenance historique de copie, distincte du parent de révision ; elle ne donne aucune permission de muter l’origine. Le plan garde la projection exacte et contrôle sa présence/identité avant copie. Le contrat d’archive conserve ces références historiques avec leur fermeture ; elles peuvent traverser des éditions, contrairement au parent de famille.

La nouvelle séance a `recipe_ids:[]`. Recettes, versions et journaux existants gardent leurs anciens IDs/sources. L’interface annonce cette conséquence avant le geste : associer ces sources ne déplace pas automatiquement les recettes déjà créées. Le reçu renvoie la nouvelle séance, l’ancienne reste consultable. Un autre rattachement crée une autre intention/copie. Petits et grands graphes peuvent utiliser le même transfert §9.2 ; aucun raccourci par puts non gardés.

### 4.5 Compléments de recette L2

Si `repo.ajouterPages` trouve une séance déjà gérée par `source_state`, créer une nouvelle séance exclusive à la recette, sans source_state, puis utiliser `source_batch` L2 inchangé. Les IDs sont réservés une fois dans l’intention, donc un réessai ne crée pas une deuxième séance. La consultation relie les séances par la recette et leurs sources exactes ; aucun ancien journal payé n’est reparenté ou recapturé.

Si la lecture contient déjà une réponse payée, le bouton annonce une nouvelle lecture avant le choix de fichiers. Le geste confirmé clôt l’ancien journal et crée le nouveau journal/séance/fichiers dans une transaction ; le résultat, la capture et les pages de l’ancien restent exacts et récupérables. Aucun appel ne part lors de cet ajout. Le réessai après quota conserve les mêmes fichiers et IDs.

Sur livre actif, cette nouvelle séance peut passer ultérieurement au contrat L5 par un geste explicite. Sur livre retiré avec recette restaurée, seule l’exception étroite de complément L2 demeure. Aucune commande générale L5 n’est autorisée sur le livre retiré. Tester deux compléments hors ligne et la reprise du même geste.

## 5. Commandes de sources locales

Nouveau module domaine proposé `domain/revisions-source.js`, avec modèles purs de validation/résolution séparés des effets. API minimale :

```js
capturerSources({session, pages, documents, contexte}) // copies affichées -> capture opaque
preparerRevision({capture, action, pageId?, fichier?, rotation?, activePageIds?})
appliquerRevision({plan}) // reçu après commit, ou refus structuré
pagesActivesSeance(session)
historiquePage(pageId, pagesById)
```

Actions fermées : `append`, `replace`, `rotate`, `select`, `hide`. `select` inclut la restauration de sélection ou le choix après conflit. Préparer réserve des IDs et calcule les empreintes, décode l’image si nécessaire et construit les nouvelles lignes. Il ne modifie aucune source et n’écrit pas le fichier avant les gardes.

Au commit local, vérifier ensemble : propriétaire durable, DB/époque, édition active et cycle exact lorsqu’elle existe, séance et état des sources capturés, identités des pages/documents, absence des IDs réservés, et champs de sélection réellement affichés. Les cinq actions sont aussi admises avant rattachement à un livre : `edition_id` et `base_edition_cycle_id` sont alors tous deux null, sans retirer les gardes de propriétaire/époque/séance/sources. Une édition retirée reste consultable ; L5 n’accorde pas au livre retiré une permission générale d’ajout. Les exceptions de complément d’une recette restaurée restent dans `source_batch` L2.

Dans une seule transaction `repo`/`db.mutate` : octets locaux nouveaux, documents/pages, séance, capture d’intention d’outbox et reçu local éventuel. Préparer les blobs en mémoire ; réutiliser la porte `fichiers` conditionnée et ne pas faire de `putFile` séparé avant le CAS. Échec/quota annule le geste entier. L’image choisie en mémoire reste retentable tant que l’écran existe ; ne pas annoncer sa conservation avant commit.

Un double clic rejoue la même intention. Un même ID d’opération avec contenu différent refuse. Un ancien plan après une modification concurrente refuse ; « Réessayer » réseau ne recapture jamais de nouvelles bases. Un nouveau choix après comparaison réserve une nouvelle intention.

## 6. Lecture exacte et résultats payés

### 6.1 Capture de départ

Le journal index conserve une capture versionnée : révision de `source_state`, IDs des pages réellement choisies, projection immuable de chaque révision, annotations employées, contexte propriétaire/cycles/édition/séance et version du préparateur d’image. Après préparation, chaque image envoyée porte l’empreinte des octets réellement envoyés. Le résultat ne duplique ni l’image, ni le texte d’une autre réponse.

La capture nouvelle est `source_capture` de forme fermée : `{format:2, session_id, source_state_revision, selected_page_ids, pages:[{id, identity_sha256, annotation_sha256, preparation_version, zone, sent_image_sha256}]}`. L’ordre de `pages` correspond à `selected_page_ids`, sans doublon ; toutes les empreintes sont SHA-256 hexadécimal. Pour un appel index, une seule page/zone. `zone` est fermé : `{kind, x, y, width, height, source_width, source_height}`, kind=full/left_half/right_half, dimensions et coordonnées entières contrôlées dans l’image orientée avant compression ; l’empreinte est celle des octets réellement envoyés. Le plein format est le rectangle entier. Chaque appel de moitié possède sa propre capture, pas l’empreinte du plein format. `source_state_revision` est null pour une séance ancienne, sinon le token affiché. Le propriétaire et les cycles restent dans les champs de journal L2, inclus dans la signature de lecture. La capture coexiste avec les anciens `sources_attendues` pour leur lecture historique ; un module feuille valide ces deux formats et les vecteurs de signature. Une capture ancienne reste vérifiable par son ancien format ; une nouvelle capture n’est pas reconstruite aujourd’hui pour donner une preuve à une lecture ancienne. La limite actuelle de 1000 sources capturées reste une borne de validation, pas une permission de lancer 1000 appels sans choix.

Les IDs des pages et la signature de réponse réellement affichée (`id`, `started_at`, résultat exact, cibles, propriétaire et cycles) doivent être liés à chaque application. Même ID et même date avec un résultat différent invalident l’application précédente. Les signatures sont bornées ; préférer SHA-256 de projections canoniques aux chaînes contenant une seconde copie complète du résultat.

### 6.2 États et reprise

États lisibles séparés : « Pas encore lue », « Lecture en cours », « Lecture interrompue », « Lecture partielle », « Résultat à relire », « Résultat conservé », « L’image a changé ». Un traitement interrompu ne prétend pas continuer après fermeture du navigateur. Une erreur réseau/serveur ne demande pas de corriger la saisie.

Une reprise du même journal lit seulement les pages absentes/échouées de la même capture. Changer la sélection, l’image ou sa transformation crée une nouvelle capture et un nouvel appel explicitement demandé ; ne pas recycler la progression d’une autre révision. Le bouton annonce le nombre maximal réel d’appels correspondant à la sélection. Conserver le comportement existant qui peut lire deux moitiés après coupure, mais l’inclure dès le consentement de départ : **jusqu’à3 appels par page neuve** (plein format, puis gauche/droite si nécessaires). Une reprise calcule son maximum depuis les appels manquants conservés : aucune moitié déjà réussie n’est relancée. Le reçu et le bilan comptent les appels réellement effectués. Ne jamais annoncer un appel puis en effectuer trois. Aucun appel à l’ouverture, au retour, au redessin ou à la comparaison.

Une réponse de l’ancienne image arrivée après remplacement reste liée et conservée dans son journal. Elle est affichable avec l’ancienne miniature. Elle ne produit pas d’enregistrement automatique pour la nouvelle sélection. Réutiliser des éléments après comparaison est un geste distinct, avec nouvelle intention d’application et provenance de l’ancienne lecture conservée ; elle n’est jamais rebaptisée « lecture de la nouvelle image ».

### 6.3 Décisions et relecture

Les nouvelles décisions utilisent une clé comprenant l’édition, l’ID et la signature exacte de lecture, la révision source et l’identité de l’entrée (titre normalisé/plages). Les décisions de titres homonymes sur d’autres réponses ne sont pas fusionnées par `Object.assign`.

Conserver la lecture brute validée dans son journal et les corrections de la personne comme décisions séparées. Une nouvelle lecture peut proposer un complément ; elle n’efface pas le titre corrigé ni les renvois personnellement retenus. Les anciennes décisions non attribuables à une capture exacte restent historiques et visibles, sans adoption automatique.

### 6.4 Conservation bornée des réponses de grande taille

La voie normale conserve un journal par appel/page/zone exacte, regroupé pour l’interface par `index_call:{format:1,series_id,page_id,kind,parent_call_id}`. `kind` est full/left_half/right_half ; parent null pour plein format, ID du plein format interrompu pour ses moitiés. L’UI regroupe ces journaux en une page utile, sans afficher trois tâches à relancer indistinctement. Chaque réponse reste attachée à son appel, image et zone. Une réponse de série n’est pas dupliquée sur tous ses journaux. La conservation confirmée de chaque réponse précède le prochain appel : notamment la moitié gauche doit être durable avant de lancer la droite. Un échec réseau à droite conserve donc la gauche payée ; un échec de conservation à gauche arrête la série et propose une reprise d’écriture, sans nouvel appel.

Le validateur d’un appel garde sa borne600 entrées. La fusion de deux moitiés conserve jusqu’à1200 entrées avant consolidation/dédoublonnage, sans repasser par le `slice(0,600)` du lecteur actuel. Preuve locale : deux réponses de400 entrées fusionnent en800, que l’ancien lecteur ramenait à600. La vue dérivée fermée est `{format:1,page_id,full_call_id,left_call_id,right_call_id}`, IDs nullables ; les appels appartiennent à la même série et révision, full étant le parent exact des moitiés. Si full a réussi, utiliser seulement son contenu ; sinon utiliser `fusionnerMoities` existant sur les deux réponses validées individuellement, gauche puis droite, dédoublonnage du chevauchement exact conservé. Une moitié absente/échouée rend la page partielle. Le lecteur accepte cette vue jusqu’à1200 entrées ; aucun second moteur ni résultat fusionné persisté en double. Aucun retour au découpage ne vaut nouvelle facturation à la reprise de l’affichage. Une page admissible par le validateur peut déjà dépasser512Kio : un vecteur synthétique local de600 entrées Unicode accepté par `relireResultatIndex` mesure799420 octets JSONB. Cela ne prouve pas qu’un fournisseur produit ce volume sous sa limite actuelle de6000 tokens. La fragmentation est un repli conditionnel sur la taille réellement mesurée ; un résultat ordinaire tient dans son journal normal. La série ou les portions de recettes ne résolvent donc pas la conservation du résultat payé.

Conserver dans `imports`, avec `kind:'index'`, un manifeste et des fragments immuables. Le champ réservé fermé `index_storage` distingue :

- Manifeste : `{format:1,role:'page_manifest',series_id,page_id,capture_sha256,logical_result_sha256,logical_bytes,fragments:[{id,ordinal,sha256,utf8_bytes}]}`. Ordinals contigus commençant à0, IDs uniques, hashes SHA-256 hex, ordre fixé par ordinal. `resultat` est null pour cette forme ; le lecteur reconstruit un unique résultat logique validé, jamais un résultat vide par défaut.
- Fragment : `{format:1,role:'result_fragment',manifest_id,ordinal,sha256,utf8_bytes,text}`. `text` est une tranche de la sérialisation canonique du résultat validé, coupée entre points de code ; pas de blob caché dans `files`. Même édition/séance/propriétaire/capture que le manifeste. Statut technique existant `enregistre`, sans signifier qu’une recette a été créée. Les fragments sont exclus des cartes, reprises, compteurs et exclusivités des journaux utilisateur.

Chaque ligne fragment est mesurée avec sa vraie enveloppe JSONB et reste≤262144 octets ; chaque manifeste/journal≤524288. Limites de page : résultat logique canonique≤4194304 octets et64 fragments au maximum. Elles couvrent les champs actuellement admis par appel (600 entrées, titre200, renvoi80, rubrique120 points de code,20 incertitudes200) et la projection fusionnée jusqu’à1200 entrées sans réduire leur borne. Les vecteurs locaux de maximum Unicode mesurent1014600 octets canoniques par appel et2013000 pour deux moitiés ; guillemets et antislashs sont aussi mesurés. Ce sont des fixtures du validateur, sans fournisseur appelé ni estimation de tokens. Toute évolution de ces limites de champs revalide cette couverture avant un appel. Une ancienne série est répartie par pages sans inventer de capture inconnue ; ses contenus logiques et provenances sont conservés.

Les fragments et le manifeste récupérable sont écrits localement atomiquement avant effacement de la progression de lecture. Quota : toute progression déjà confirmée reste présente ; si aucune conservation n’a encore réussi, dire précisément que la réponse est encore en mémoire et proposer copie/téléchargement tant que la vue reste ouverte. Ne pas prétendre qu’elle survit à la fermeture. Aucun nouvel appel automatique. La conversion d’une grande réponse ancienne ne supprime son ancienne copie qu’après vérification de reconstruction complète et des empreintes ; sa transformation ne revalide aucun ancien brouillon L4.

Envoi : registre privé `source_transfer`, purpose `index_result` (§9.2). `begin` fixe la base exacte du journal en cours (ID, started_at, capture), le hash du manifeste final, le nombre de parties/lignes. `part` transporte seulement des lignes `imports` de rôle result_fragment ; `finish` vérifie présence, empreintes, concaténation UTF-8, JSON et validation du résultat logique, puis CAS et activation du manifeste. Une source changée permet la conservation historique de cette réponse, sans application automatique. Une partie manquante donne « Résultat en cours de réception », pas un index partiel amputé.

Les décisions et reçus ne sont pas ajoutés dans un journal déjà proche de512Kio jusqu’à provoquer une troncature. Le préparateur mesure la ligne entière ; les formes de conservation sont séparées du résultat logique. Une mutation de contenu des fragments ou de manifeste terminal est refusée, y compris REST/anciens clients. Réessayer leur transfert ne relance pas l’assistant.

## 7. Consolidation et application

### 7.1 Un seul moteur

Faire évoluer `consolider` et les fabriques existantes. Le service prépare un plan pur à partir des pages lues admissibles, des recettes actuelles de l’édition et des décisions exactes. Le bilan distingue : ajouts, déjà présentes, compléments, ambiguïtés et pages échouées. Les chiffres proviennent du plan puis du reçu réel ; un échec partiel n’est pas annoncé comme un succès complet.

Ne pas supprimer une entrée absente d’une nouvelle photographie. Même titre et mêmes pages : déjà présent, éventuellement complément de rubrique/plage. Même titre et pages différentes : contradiction ou recettes distinctes après choix. Page inconnue, lecture incertaine ou modèle non admis : relecture. Une recette retirée est reconnue comme déjà existante retirée, sans restauration ni doublon de remplacement.

Un complément ne touche que les champs autorisés d’une référence encore admissible. Il est recalculé/fusionné sur la ligne relue, après CAS des champs sur lesquels le plan s’appuyait. Une recette devenue complète, favorite ou personnellement modifiée pendant l’attente n’est pas réécrite depuis la vieille copie. Une modification concurrente pertinente refuse le plan et garde le résultat ; les champs sans rapport peuvent être préservés par fusion.

La provenance d’une référence nouvellement créée garde `index_page_id`, `source_page_ids` et `index_import_id`, avec une projection versionnée des révisions/entrées appliquées si les champs actuels ne suffisent pas. Elle ne contient pas la réponse entière. Les corrections manuelles ne changent pas le titre original ni les anciennes sources.

### 7.2 Transaction d’application d’index

API proposée : `preparerApplicationIndex({lectureAffichee,captureSources,decisions,recettesAffichees})` puis `appliquerIndex({plan})`. La préparation ne relance pas l’assistant et ne recapture aucune autre réponse. Elle capture un `read_set` fermé et trié par ID journal en octets UTF-8, sans doublons, de toutes les lectures effectivement utilisées : `{journal_id,result_sha256,source_capture_sha256}`. Le CAS d’un seul journal serait insuffisant quand une autre lecture apporte une rubrique, un doublon ou une contradiction. L’ensemble complet figure dans chaque commande, avec son empreinte ; chaque élément est revérifié localement et au serveur. Il n’existe pas de manifeste de read_set implicite. Si ce contexte dépasse la borne de commande, proposer un sous-ensemble explicite de lectures déjà conservées, sans nouvel appel. L’application relit en une transaction : journaux exacts, révisions de décision, sélection/capture source, propriétaire/cycles, ensemble des recettes dont dépend la détection de doublons et lignes modifiées.

Chaque portion atomique (§7.3) écrit les seules références/compléments/décisions prévues et son reçu d’application. Elle garde les fusions du dépôt, la corbeille et la capture d’outbox. Pas de suppression préalable ni de seconde écriture « enregistré » après le commit.

Une décision de groupe a un `journal_home` déterministe : première occurrence du groupe selon l’ordre canonique immuable `(journal_id,ordinal_d_occurrence)` du read_set, sans tri de titre, locale ou date. Sa place est cet ordinal d’origine, de0 à599 dans un journal d’appel, même quand la page reconstruite contient1200 entrées. La valeur garde `unit_sha256` du groupe exact ; une ancienne décision ne s’applique jamais silencieusement à un groupe changé. Reconsolider n’ajoute donc pas indéfiniment de nouvelles clés pour la même occurrence. Le leader est le premier journal du read_set, fixé pour toute la chaîne ; il porte la révision globale et les reçus. Chaque home touché, ainsi que le leader, est relu avec sa révision attendue et écrit dans la transaction de la portion. Tous ces journaux comptent dans la limite de500 lignes.

Le contrôle des doublons doit couvrir l’absence : une autre référence équivalente créée juste avant le commit invalide le plan. Un simple CAS des IDs nouveaux est insuffisant. Contrôle local du magasin par édition ; contrôle serveur sous le verrou du propriétaire, avec empreinte déterministe du périmètre de comparaison (§8.3). Un écart provoque une comparaison/reconsolidation explicite du résultat conservé, jamais un nouvel appel automatique.

### 7.3 Grandes lectures : portions métier explicites

Une grande lecture n’est pas refusée simplement parce que toutes ses références dépassent 500 lignes. L’unité indivisible est un **groupe consolidé complet**, avec toutes ses créations/compléments et sa décision. Le préparateur répartit les groupes, dans un ordre déterministe, en plusieurs commandes `index_apply` chacune sous les bornes. Il ne découpe jamais une commande lors du transport ni un groupe entre deux transactions. Si un seul groupe dépasse la borne, il reste conservé et explicitement non appliqué ; la personne peut résoudre cette ambiguïté ou conserver le texte, sans nouvelle lecture automatique.

Avant la première portion, conserver les choix manuels, leurs textes, les IDs réservés, les captures et l’ordre des groupes dans un brouillon interne `index_application:v1:<id>`, format1. Portée propriétaire/DB/époque, CAS de révision et écriture via dépôt ; aucune synchronisation ni archive de ce brouillon. Bornes explicites :32 applications non terminées,2Mio par enveloppe complète,8Mio au total. Il référence les résultats durables plutôt que recopier images ou bibliothèque. Si une sélection dépasse ces bornes, proposer de traiter un sous-ensemble de pages déjà lues ; garder tous les résultats et les décisions non conservées affichées/récupérables. Quota avant première conservation : aucune portion ne part.

Chaque commit local conserve ensemble effets métier, reçu, outbox et progression de ce brouillon. Rechargement entre deux portions reprend les mêmes IDs et intentions ; il ne réserve pas d’autres IDs tant qu’un reçu reste à réconcilier. Les nombres « sur cet appareil » et « accepté par le serveur » restent distincts.

Une application porte `application_id`. Chaque portion a `portion_id === operation_id`, et `predecessor_operation_id` null pour la première, sinon l’opération précédente. Les portions conservent capture source et réponse exactes. Avant chaque portion : `base_decision_revision` et `recipe_scope_sha256` attendus ; après commit : `result_decision_revision === operation_id` et `scope_after_sha256` calculé à partir des seuls effets autorisés de cette portion. La suivante utilise cet état attendu, pas une relecture adoptant des changements extérieurs. En synchronisation, elle attend l’accusé exact de la précédente.

Un conflit bloque les portions restantes. Les portions commises demeurent, avec leur bilan ; la réponse payée reste conservée. La reprise explicite reconsolide uniquement ce qui reste, sans nouvel appel, puis crée une nouvelle chaîne d’intentions. Le bilan distingue enregistré / à appliquer / à comparer. Un indicateur `terminal` est informatif : le journal ne passe `enregistre` que lorsque ses obligations sont réellement résolues, pas seulement parce qu’une commande prétend être la dernière.

Les reçus sont compacts : nombres et empreinte des IDs appliqués, jamais une liste de 500 IDs multipliée par 128 reçus. L’accusé reconstruit les lignes admissibles depuis la requête immuable d’empreinte identique et les lignes serveur actuelles ; cette reconstruction ne réexécute aucune écriture. Un reçu évincé ou une requête différente refuse le rejeu.

## 8. Synchronisation et migration indispensables

### 8.1 Décision

Une migration nouvelle après `0009`, proposée `0010_source_revisions.sql`, est nécessaire. Aucun nouveau magasin synchronisé, mais un nouveau protocole de mutations, des champs réservés et des gardes serveur. Ne modifier ni réexécuter `0009` déjà déployée. Ne pas appliquer `0010` pendant la construction sans l’autorisation de publication applicable.

Ajouter la capacité `source_revisions:1` à `sync_capabilities`. Un registre privé serveur de transfert est autorisé pour les grandes archives/bootstrap ; il ne constitue pas un nouveau magasin synchronisé et son protocole fermé est défini au §9.2. Un client L5 peut conserver hors ligne une intention locale, mais ne la dégrade jamais en `put` ordinaire si cette capacité manque. La file indique que la mise à jour du serveur est requise. Préserver les chemins L1/L2 existants.

Nouvelles commandes de `sync_push_v2` : `source_revision`, `index_apply` et `source_transfer`, chacune isolée dans son lot, jamais dédoublonnée avec un simple `put` de la séance. Une RPC helper directement exposée doit obtenir elle-même le verrou propriétaire et refaire toute validation ; préférer ne pas lui accorder EXECUTE aux clients si elle n’a pas à être appelée directement. Aucune confiance dans un marqueur transactionnel fourni par le client.

### 8.2 Commande source_revision

Enveloppe fermée : version du protocole, propriétaire implicite `auth.uid()`, ID d’opération, séance/édition, action, cycle de l’édition, empreinte de la base de séance pertinente, état source attendu, nouvelles pages/documents bornés, et sélection active résultante. Le client enregistre l’enveloppe immuable au commit local ; l’envoi ne relit pas une autre intention sous le même ID.

Le serveur prend le verrou `l2_lock_owner` avant les lectures et verrous de lignes. Il vérifie l’édition active et son cycle lorsqu’elle existe, ou la paire édition/cycle null pour une séance sans livre, puis la séance et les sources de base, les nouveaux IDs absents, les parents/révisions et les octets référencés suivant le contrat de fichiers. Il écrit ensemble documents/pages/séance et produit un accusé exact. Aucune modification d’identité d’une ancienne page.

La base de séance compare les champs utiles à cette opération, avec présence/absence explicites ; elle ne transporte pas deux copies complètes de la séance. Les lectures synchrones de la transaction locale sont comparées à des projections hachées avant transaction. Le protocole serveur utilise la même projection canonique et les mêmes vecteurs. Ne pas confondre un `updated_at` réajusté par le serveur avec un changement de sélection.

Deux appareils hors ligne, même base : le premier commit serveur est accepté ; le second reçoit un conflit, sans ajout partiel. Son image, ses révisions et son intention restent sur l’appareil d’origine, signalées comme non envoyées. Le serveur ne choisit pas un gagnant par heure et le client ne remplace pas l’image locale par l’accusé de la première intention. Le conflit affiche les deux sélections quand leurs octets sont disponibles.

Après comparaison, « Utiliser ma photo » crée une nouvelle intention sur l’état confirmé. La page locale conserve sa famille et son parent historique ; une action `select` peut adopter cette branche explicitement, avec les lignes encore absentes du serveur. Le parent d’une révision refusée n’est pas changé pour simuler qu’elle avait été créée depuis la nouvelle image. « Garder l’autre photo » abandonne uniquement l’intention d’activation, après choix ; le contenu local reste récupérable. L’abandon ne supprime pas les octets.

Accusé perdu : si les IDs/identités et l’opération sont déjà enregistrés exactement, rendre déjà effectué sans modifier le dernier choix courant. Une opération ancienne ne doit pas réactiver sa sélection après un choix ultérieur. Le champ réservé `source_receipts` garde au plus 128 reçus de cette séance, de forme fermée `{operation_id,payload_sha256,committed_at,result_revision}`. Il ne contient aucun blob, résultat assistant ou copie de séance. Garder le reçu de la commande courante ; évincer les plus anciens après insertion dans la même transaction. Une fois évincé, un vieux plan refuse plutôt que déduire un succès depuis des IDs seuls. Un simple `put` ou une ancienne archive fusionnée ne peut effacer ces reçus.

### 8.3 Commande index_apply

Le serveur ne refait pas l’OCR ni le moteur de consolidation. Il valide le plan déjà calculé : capture source, journal/résultat exacts, décision attendue, et empreinte du périmètre d’édition utilisé pour repérer les doublons. Cette empreinte couvre une projection déterministe des recettes de l’édition : ID, titres original/personnel, plages, disponibilité, version courante, état de cycle, provenance d’index et champs intervenant dans l’admissibilité des compléments. Pour chaque ligne modifiée, les champs écrits sont en plus vérifiés et fusionnés sans effacer les autres.

Sérialisation canonique commune JS/SQL : arbre JSON fermé, clés d’objet triées par octets UTF-8, tableaux dans leur ordre métier, chaîne rendue en JSON UTF-8 sans normalisation Unicode, nombres finis en écriture décimale sans exposant ni zéro final inutile (zéro négatif rendu 0), séparateurs sans espace. Refuser les chaînes contenant un surrogate isolé ou U+0000 avant hachage et avant mutation : JSONB ne les conserve pas, aucune normalisation silencieuse. Les champs projetés sont des couples présence/valeur pour distinguer absent et null. Trier les recettes par ID comparé en octets UTF-8 avant hachage SHA-256. Vecteurs partagés obligatoires : Unicode/accents, clés U+E000 face à U+10000 pour distinguer le tri d’octets du `.sort()` UTF-16 de JavaScript, clés absentes/null, plages, nombres décimaux/exposants, caractères échappés, surrogate isolé et U+0000 refusés. Ne pas comparer un `JSON.stringify` arbitraire à `jsonb::text`. Une empreinte du périmètre évite de placer la bibliothèque entière dans l’enveloppe. La requête serveur reste sous verrou du propriétaire et ne lit que son édition.

Une nouvelle référence concurrente, une correction de titre/page ou un retrait depuis la préparation invalide cette empreinte. La réponse garde le résultat payé et demande une reconsolidation explicite. Elle ne demande pas de relancer la lecture. Les données métier, la clôture éventuelle et le reçu d’application sont atomiques au serveur comme localement. Deux plans sur le même journal/révision ne peuvent créer deux jeux de références.

Chaque journal touché porte `index_decision_revision` (token d’opération, null pour ancien format). Le leader porte `index_application_receipts`, au plus128 reçus fermés `{application_id,operation_id,predecessor_operation_id,payload_sha256,result_sha256,base_decision_revision,result_decision_revision,scope_after_sha256,committed_at,counts,applied_ids_sha256}`. `counts` est fermé `{creates,patches,decisions}`, nombres entiers non négatifs effectivement appliqués, sans listes d’IDs. `result_sha256` est l’empreinte displayed_result_sha256 de la commande. L’empreinte des IDs porte la liste triée/dédoublonnée de créations et compléments avec le même canon. Aucun payload de recette ou résultat complet dans le reçu. Leur bornage ne permet aucun rejeu d’un ancien plan : l’ancienne révision devient inadmissible. Un reçu absent n’autorise pas la reconstruction de l’intention. Les réponses `accepted/rejected` identifient l’opération ; un accusé incomplet n’efface pas sa file.

Les décisions compactes par home gardent seulement `{occurrence_ordinal,unit_sha256,action,option_sha256,applied_ids_sha256}`, au plus600 places ; aucun titre, option complète, tableau d’IDs ou operation_id par décision. Les textes de choix non appliqués demeurent dans le brouillon local. Le vecteur mesuré600 décisions+128 reçus avec IDs ASCII200 occupe391297 octets JSONB avant enveloppe/manifeste :132991 restent sous512Kio, mais ne constituent pas une permission de négliger l’enveloppe réelle. Mesurer le journal complet ; convertir son résultat inline en manifeste avant application si nécessaire, sans perdre ni changer le résultat logique. Les nouveaux IDs sont ASCII bornés ; les anciens IDs restent lisibles.

### 8.4 Gardes contre les anciens clients et REST

La migration protège l’identité de source même via REST, `sync_push`, alias L1 et RPC v2. Une ancienne page modifiée en place sur l’empreinte ou la rotation est refusée ; les métadonnées autorisées restent fusionnables. L’introduction/changement de `source_revision` et `source_state`, ainsi que les listes historiques d’une séance gérée, passent uniquement par une commande validée ou une restauration d’archive contrôlée.

Un ancien client peut encore lire les lignes et afficher imparfaitement leur historique ; il ne doit pas pouvoir effacer les champs réservés en renvoyant une vieille copie. Une mutation d’index qui applique une lecture sur une séance gérée exige le contexte `index_apply`. Protéger les créations/compléments de références et les transitions d’application du journal ; permettre la conservation d’une réponse tardive comme résultat historique sans autoriser son application.

Ne pas bloquer une correction personnelle sans rapport avec l’index uniquement parce qu’une recette cite une ancienne page. Les sources historiques sont autorisées ; c’est la réinterprétation d’une lecture ou le déplacement d’identité qui est protégé. Tests séparés obligatoires pour cette distinction.

### 8.5 Bornes, réception et outbox

Nouvelles commandes L5 :500 lignes métier au maximum et786432 octets JSONB (768Kio), mesurés avec un calcul client équivalent au serveur. Chaque ligne métier reste≤524288 octets (512Kio), et le lot de transport≤921600 octets (900Kio). Le `source_batch` L2 demeure à524288 octets ; aucune hausse implicite de son contrat. Compter toutes les lignes écrites, journal compris :499 créations et1 journal font déjà500. Aucun blob dans l’enveloppe. Refuser avant mutation locale un plan non transportable ; ne pas découper une opération atomique en bouts indépendants. Une séance trop volumineuse reçoit un message et une proposition explicite de nouvelle séance, sans perdre l’ancienne.

`outbox`, composition des lots, transport, accusés, conflits, remise en file et envoi initial doivent reconnaître les commandes. Aucun chemin de backfill ne transforme une révision gérée en put permettant de contourner son contrat. L’upload des fichiers conserve sa porte et son identité de compte existantes ; un refus de commande ne provoque aucune purge Storage.

La réception peut arriver par tables/pagination. Une sélection dont une page/document manque reste « sources en cours de réception » : pas de reprise de lecture, pas de consolidation, pas de substitution par une autre révision. Le curseur n’est confirmé qu’après la transaction habituelle. Les nouveaux IDs et l’intention locale en conflit restent protégés d’un ancien écho.

### 8.6 Formes fermées de transport

Les deux commandes emploient `{protocol:1,op,operation_id,store,id,edition_id,base_edition_cycle_id,payload_sha256,...}`. `store/id` désignent la séance pour `source_revision`, le journal pour `index_apply`. `payload_sha256` porte tous les champs métier de l’enveloppe sauf lui-même, sans heure technique ajustable par le serveur. IDs bornés à 200 caractères, enums fermés, clés inconnues refusées. Le propriétaire vient de la file locale et de l’authentification serveur, jamais d’une cible libre de l’enveloppe.

`source_revision` ajoute exactement `{action,base_session_sha256,base_source_revision,base_sources,new_documents,new_pages,active_page_ids}`. Action parmi append/replace/rotate/select/hide ; store=scan_sessions ; id=séance existante. `base_source_revision` est null pour une séance ancienne, sinon son token exact. `new_documents` et `new_pages` sont des tableaux de wrappers fermés `{id,data}`, avec id===data.id ; data est la fiche métier admise existante, JSON borné avec champs réservés fermés. Les extensions historiques admises ne sont pas effacées. `active_page_ids` est la sélection ordonnée finale du §4.2. Les champs ordinaires inchangés de la séance ne sont pas transportés comme un remplacement : le serveur fusionne les nouvelles références et la sélection après contrôle de la base.

`base_sources` est un tableau fermé `{store,id,identity_sha256,annotation_sha256}`, trié par store/id en octets UTF-8 et sans doublon ; store=source_pages|source_documents, annotation_sha256=null pour document. Le serveur déduit la fermeture exigée et refuse les omissions. Append ajoute seulement des racines neuves, ou des documents PDF/EPUB sans page, et a une fermeture de base vide. Replace/rotate dérivent les pages remplacées des parent_page_id neufs, puis contrôlent ces pages, documents et chaînes de parents/famille. Select/hide contrôlent les actifs avant/après et leur fermeture de parents/documents. Les lignes neuves sont validées séparément, pas comparées comme déjà présentes. Select peut transporter une branche locale encore absente du serveur : son parent et son operation_id de création restent historiques, même si la commande de sélection porte une nouvelle opération. Les opérations de reprise explicitement comparées constituent de nouvelles bases, jamais une modification du payload d’une entrée existante.

Les projections sont versionnées et fermées ; chaque champ utilise présence/valeur. `source-session-v1` porte les champs id,edition_id,status,page_ids,document_ids,recipe_ids,source_state,source_copy,but,started_at,device_id et la liste base_sources. `page-identity-v1` porte id,edition_id,document_id,sha256,rotation normalisée,file_position,locator,document_page_number,source_revision,source_copy. `page-annotation-v1` porte printed_page,printed_page_range,position,kind,role,issues. `document-identity-v1` porte id,edition_id,scan_session_id,source_type,sha256,blob_path,size,mime,original_filename,captured_at,replaces_document_id,source_copy. Le discriminant de projection est inclus dans chaque empreinte ; dates techniques created_at/updated_at et reçus sont exclus. Un champ supplémentaire utilisé pour décider impose une nouvelle projection et des vecteurs, jamais une exclusion tacite.

`index_apply` ajoute exactement `{base_session_sha256,application_id,portion_id,predecessor_operation_id,terminal,read_set,read_set_sha256,source_capture_sha256,displayed_result_sha256,base_decision_revision,recipe_scope_sha256,creates,patches,decisions}`. Store=imports, id=leader. `base_session_sha256` porte la projection de la séance affichée au geste, sans base_sources supplémentaire. Les anciennes captures ne suffisent jamais à adopter implicitement une nouvelle sélection. `portion_id` égale `operation_id`, predecessor est null ou l’opération précédente ; `terminal` est booléen et ne suffit jamais à clôturer les journaux. Read_set est la liste complète §7.2, non vide ; read_set_sha256 porte son canon, source_capture_sha256 le tableau ordonné `[journal_id,source_capture_sha256]`, displayed_result_sha256 le tableau ordonné `[journal_id,result_sha256]`. Le result_sha256 de chaque journal est l’empreinte de **lecture exacte** du §6.1 : id,started_at,cibles,propriétaire,cycles et résultat logique, pas le seul index_storage.logical_result_sha256. Les empreintes ne changent pas selon le stockage inline ou fragmenté ; aucune substitution par une dernière réponse. `base_decision_revision` est celle du leader et doit aussi correspondre à son entrée dans decisions.

`creates` porte les fiches entières validées produites par `fabriquerReferenceIndex`, IDs nouveaux réservés et édition exacte, disponibilité reference_only, état unverified, aucun contenu culinaire/version/favori créé. `patches` porte des objets fermés `{id,base_sha256,changes}` ; changes non vide contient seulement index_rubriques et/ou printed_pages. Aucun titre, source, champ personnel ou pointeur n’est patchable. Base_sha256 porte la projection de recette admissible du §8.3 avec présence/valeur. L’admissibilité et le cycle sont revérifiés sous transaction, pas déduits du seul hash envoyé.

`decisions` est un tableau trié de groupes fermés `{journal_id,expected_decision_revision,entries}` ; chaque journal appartient au read_set, sans doublon. Entries reprend la forme compacte du §8.3 **avec les champs supplémentaires applied_ids et occurrences dans le transport seulement**, ordinals uniques0..599 dans le home exact. Le leader figure même si entries est vide, afin de CAS sa révision globale. Actions fermées : auto (certaine ou complément), garder_option (Garder p), garder_toutes (Les deux), ajouter (entrée à vérifier), ecarter, est_recette (C’est une recette). Option_sha256 est un hash d’option exact pour garder_option, null sinon. Applied_ids est une liste triée d’au plus500 IDs, incluse dans la borne globale768Kio. Le serveur exige des listes sans doublon, disjointes entre unités, dont l’union est exactement les IDs de creates et patches, puis recalcule applied_ids_sha256. Le journal ne conserve que ce hash, jamais la liste. Occurrences est la liste fermée et triée `{journal_id,ordinal,result_sha256}` de toutes les entrées du groupe, liée au read_set ; unit_sha256 porte son canon avec l’édition. La première détermine le home. Tous les journaux de ces occurrences figurent dans decisions et comptent parmi les écritures. `index_resolved_occurrences` conserve au plus600 ordinals uniques par appel ; seules les entrées recettes entièrement couvertes permettent sa clôture. Le parent plein format coupé est clos uniquement lorsque les deux moitiés exactes sont closes. Le booléen terminal ne remplace aucune de ces preuves. Deux unités revendiquant le même patch rendent le plan incohérent dès la préparation ; reconsolidation explicite, pas de double mutation. Unités/homes et options sont liés au résultat exact affiché ; leurs hashes ne dépendent ni de la locale ni de l’heure.

Les champs dont dépend `recipe_scope_sha256` sont exactement ceux lus par le moteur et les conditions d’admissibilité ; la liste versionnée fait partie du module de projections, testée avec une modification de chacun de ces champs. Les commandes ne transportent aucune suppression de recette. Les identités, homes, révisions et empreintes ne sont jamais recalculés depuis une nouvelle lecture pendant l’envoi.

Un refus structuré utilise un motif fermé : `source_changed`, `session_changed`, `edition_cycle`, `owner_changed`, `result_changed`, `index_changed`, `id_collision`, `invalid_shape`, `too_large`, `capability_missing`. Le motif et les copies courantes autorisées permettent une comparaison ; aucun SQL, secret ou donnée d’un autre propriétaire dans la réponse. Une panne réseau/quota reste distincte et réessayable sans changement de l’intention.

## 9. Compatibilité, archives et L4

Une page et une séance anciennes restent lisibles sans transformation de masse. Aucun `DB_VERSION` supplémentaire n’est nécessaire pour de simples champs JSON ; en ajouter un seulement si la construction démontre le besoin d’un index. La préparation des cartes de révision peut charger les pages d’une édition avec l’index existant ; borner l’affichage et mesurer les volumes plutôt que répliquer un historique entier par page.

Fixer `ARCHIVE_FORMAT_VERSION = 4` à la construction : archive4 déclare les champs/relations nouveaux et leur format. Conserver les lecteurs archive1/2/3. Les clients limités à archive3 doivent refuser clairement archive4 ; ne pas exporter ces chaînes comme une archive3 que leur lecteur pourrait interpréter de travers. Ajouter la relation page→parent/famille et les actifs de séance. Vérifier fermeture des dépendances, familles cohérentes, absence de boucle, documents et fichiers. Un ancien format demeure accepté ; le nouvel export n’abandonne aucune ancienne révision. Import merge : collision sur un ID de révision et identité différente refuse avant tout write, puis en transaction. Remplacement : conserve l’époque L4 changée atomiquement et rend les anciens brouillons détachés comme prévu.

Les anciennes lectures sans capture exacte sont nommées « Lecture ancienne — image non vérifiée ». Elles restent consultables/récupérables ; aucun auto-enregistrement nouveau ne les réassocie à l’image présente. Une relecture humaine explicite peut conserver des éléments avec leur provenance ancienne, jamais fabriquer rétroactivement une preuve d’image.

L4 continue de capturer ses versions, pages, documents et journaux exacts. Une page remplacée n’est pas réécrite, donc la source d’un ancien brouillon demeure consultable. Les changements de sélection n’autorisent pas à remplacer les `affiche.pages` persistées ni à renouveler les bases pendant une reprise. Une correction issue d’une réponse conserve son journal exact et sa clôture atomique. Adapter les projections L4 aux champs réservés sans requalifier les anciens formats comme courants.

Aucune exportation des brouillons locaux ou secrets dans l’archive/synchronisation. Les restrictions culinaires Thermomix restent entièrement dans leurs parcours ; une révision d’image n’autorise aucune compatibilité culinaire.

### 9.1 Raccord L4 et limites d’un ancien client

La projection L4 `session-v1` inclut un nouveau champ source_state : son introduction peut donc rendre un vieux brouillon bloqué, avec texte/source récupérables. C’est le comportement conservé ; ne pas élargir silencieusement sa signature pour faire passer le brouillon. Une reconstruction logique strictement identique d’un format de résultat reconnu peut rester lisible ; sinon comparaison explicite et nouvelles bases, jamais réécriture de `editor_source_signature` ou des copies affichées.

Les triggers ne peuvent empêcher à eux seuls toute dépense d’un vieux client qui envoie déjà une image à l’assistant sans capture serveur vérifiable. L5 protège la conservation et l’application ; il exige la mise à jour de l’interface pour le parcours géré. Il ne prétend pas avoir ajouté une garde avant facturation à la passerelle. Un tel contrôle nécessiterait une extension dédiée, hors cette spec.

### 9.2 Transfert progressif : archive, bootstrap, rattachement et grand résultat

API domaine : `preparerTransfertSources({purpose,portee,contexte,baseCibleAffichee,cibleFinale,records,origineAffichee})` rend un plan opaque sans écriture ; `conserverTransfertSources({plan})` conserve localement contenu/intention/outbox atomiquement ; `reprendreTransfertSources({captureLocale,etatServeurAffiche})` reprend la même intention admissible, ou demande une comparaison avant une nouvelle. `origineAffichee` est réservé à attach. Aucun nouvel appel assistant.

`source_transfer` est une union fermée. Champs communs : `{protocol:1,op:'source_transfer',operation_id,payload_sha256,transfer_id,phase,store,id,edition_id,base_edition_cycle_id}`. Phases : begin/part/finish/abandon. Matrice fermée : attach cible scan_sessions ; index_result cible imports et transporte seulement des fragments du résultat payé ; archive/bootstrap ciblent scan_sessions pour le graphe ou imports pour un journal historique et ses références.

- `begin` ajoute `{purpose,nonce,requested_at,not_after,base_target_sha256,target_sha256,manifest_sha256,part_count,row_count}`. Base null exige absence ; base non nulle exige la projection pertinente exacte de la cible. Aucune comparaison par heure et aucun LWW. Le registre garde ces engagements, pas les lignes complètes.
- `part` ajoute `{ordinal,previous_chain_sha256,rows}`. Ligne fermée `{store,id,data}`. Magasins autorisés : documents/pages pour une cible scan_sessions ; imports de rôle result_fragment seulement pour index_result ; fragments imports et recipes exactement liés au journal pour une cible imports archive/bootstrap. Les recettes liées peuvent être références ou déjà complètes ; leurs versions suivent le chemin de restauration existant. Aucun put ordinaire ne peut insérer une référence d’index gérée, même avec un faux pointeur de version complète. Dépendances avant descendants, parties dans l’ordre ; au plus499 lignes de données quand la commande écrit une ligne métier supplémentaire, et toujours≤500 écritures métier/768Kio. Une ligne ne se fractionne pas comme mutation métier.
- `finish` ajoute `{last_chain_sha256,target}`. Cible séance finale validée ou patch fermé du journal manifeste. Vérifier la chaîne complète, compte, fermeture, identités et CAS de cible, puis activer sélection/manifeste dans la transaction finale. Seul cet accusé atteste l’activation.
- `abandon` ajoute `{expected_next_part,expected_chain_sha256}`. Geste explicite sur la capture actuelle du transfert. Arrêter l’intention conserve les sources actives antérieures, les lignes déjà présentes et leurs octets ; aucune suppression métier.

`manifest_sha256` est SHA-256 de la liste ordonnée des tuples `[store,id,seed_sha256]`. La projection seed inclut données métier/relations et exclut seulement les dates techniques normalisées. Chaîne de partie : `SHA256(canon(['source-transfer-chain-v1',precedente,ordinal,payload_sha256]))`. La première chaîne a un seed déterministe dérivé du begin versionné. Le serveur garde les tuples/hashes de parties dans le registre et les recalcule à finish depuis les lignes présentes ; les compteurs seuls ne suffisent pas.

Bornes de registre : `part_count` entier de1 à4096, `row_count` entier positif et au plus499×part_count,32 transferts receiving au maximum par propriétaire. Une cible valide sans dépendance autorise uniquement la paire part_count=0,row_count=0 : manifeste vide, chaîne finale égale au seed, finish juste après begin, sans partie vide artificielle. Les limites de ligne/commande/lot restent applicables à chaque partie ; aucun nombre ne permet de les contourner. Refuser avant conservation d’un nouveau transfert non transportable, en gardant archive, résultat et intention récupérables. Un refus de capacité ne remplace ni ne supprime une intention déjà conservée.

Une partie insère des IDs absents ou reconnaît des identités/projections exactement identiques. Collision différente : refus, pas de put de réparation. Les lignes en cours de transfert sont immuables et protégées contre REST/anciennes RPC. Les pages/documents peuvent être reçus avant la séance finale : « Sources en cours de réception », sans lecture/consolidation depuis ce sous-graphe. Une séance existante conserve ses sources actives tant que finish n’a pas réussi.

Le bootstrap est admis seulement si la cible est absente ou entièrement identique. Le backfill reprend en priorité toute intention conservée ; il ne la remplace jamais par un transfert déduit de la dernière ligne. Sans intention, il capture un instantané initial démontrable. L’archive utilise le même chemin contrôlé pour les champs réservés ; `archive_import:true` n’est jamais une autorisation suffisante. Un graphe supérieur à500 lignes est transmis par parties puis activé, sans gonfler une ligne séance ni revenir à des puts.

Archive/bootstrap peuvent restituer les sources historiques d’un livre déjà retiré, sous son état et cycle exacts, sans réactiver le livre ou ses recettes. Seuls des objets historiques démontrés sont insérés/reconnus, sans permission de nouveau scan, lecture ou application d’index. Cette exception est distincte de source_revision et de la cible attach, qui exigent un livre actif. Le cycle est revérifié à finish ; un changement intervenu pendant le transfert refuse l’activation et conserve la sélection antérieure et les sources déjà reçues.

Une restauration/initialisation activée donne à `source_state.revision` le token frais du finish, réservé dans le plan local dès sa conservation. Pour éviter une circularité d’identités, `target_source-v1` porte un template : copie JSON complète de la séance, extensions historiques conservées, dont seuls created_at,updated_at,source_receipts et source_state.revision sont retirés. Source_state porte `{format:1,active_page_ids}`. La cible transportée n’admet aucun de ces champs dérivés. Le serveur injecte `revision=finish.operation_id` au commit, conserve les reçus existants valides (ou[] si cible absente) et conserve/date les champs techniques selon les règles ordinaires. `target_sha256` porte ce template avec son discriminant, jamais un token dérivé de lui-même. La sélection et les images restent celles archivées ; anciennes captures/tokens restent historiques. Cette normalisation est déclarée dans verifyRestored4 : elle empêche un vieux choix hors ligne de redevenir admissible par réintroduction d’un ancien token. Aucun hash d’image ni journal ancien n’est changé. Pour attach, réserver un nonce d’intention indépendant avant les lignes et employer ce token dans `source_copy.operation_id` et `source_revision.operation_id` ; ne jamais y placer un transfer_id dérivé de ces mêmes lignes.

Une archive envoie le graphe avant les journaux et recettes qui le citent. Un journal historique ancien sans capture reste conservé sans devenir applicable L5. Les nouveaux formats contrôlent toujours l’identité historique exacte des images ; ancien jeton ou anciennes annotations sont permis pour la conservation seule. Les collisions de journal/référence sont refusées avant mutation locale puis au serveur ; les contrôles locaux portent aussi sur le snapshot des recettes.

Pour index_result, finish conserve un résultat à vérifier et ne peut inventer statut enregistre, décision, résolution ou reçu d’application. Un résultat déjà payé, inline ou fragmenté, ne peut être remplacé ; une conversion strictement identique reste permise. Finish vérifie ordre/hashes/concaténation UTF-8/parsing/validation de la réponse, puis CAS du journal exact : ID, started_at, source_capture, propriétaire et cible. Une source/cycle devenus anciens autorisent la conservation historique mais jamais l’application automatique. Un journal terminal ou remplacé n’est pas rouvert : intention/réponse locale récupérables et comparaison. Tous fragments sont techniques, non relançables/facturables dans l’UI.

### 9.3 Registre privé : droits, reprise, rétention

Deux tables techniques hors schéma PostgREST exposé, proposées `private.mistu_source_transfers` et `private.mistu_source_transfer_parts`. Aucune dans SYNC_STORES, IndexedDB ou archive.

Header fermé : owner_id, transfer_id, purpose, target_store/id, édition/cycle, hashes begin/base/target/manifest, part_count/row_count, next_part/chain_sha256, state, created_at/last_progress_at/not_after, reçu final compact. États receiving/completed/abandoned/expired/rejected. Une seule intention receiving par cible. Une autre intention ne ferme pas arbitrairement la première.

Partie : ordinal, operation_id/payload_sha256, chaîne avant/après, liste bornée store/id/seed_sha256. Aucun blob, secret, texte de résultat ou copie de recette dans ce registre. Les sources restent dans les magasins métier et leurs fichiers dans le contrat de fichiers existant.

RLS owner=auth.uid, tables sans droits directs anon/authenticated/public, schéma non exposé. Les helpers DML prennent eux-mêmes `l2_lock_owner` avant toute lecture, exigent auth.uid non nul, filtrent chaque requête par ce propriétaire. Tout SECURITY DEFINER nécessaire a search_path fixe/vide et aucun owner libre ni GUC client d’autorisation. L’entrée publique `source_transfer_status({transfer_id})` retourne seulement l’état, dates, hashes et compteurs du propriétaire authentifié ; l’ID d’un autre propriétaire répond absent. Les helpers internes non destinés aux clients n’ont pas EXECUTE public.

`transfer_id = 'st_' + SHA256(canon(tuple_begin_versionne))`, tuple comprenant propriétaire authentifié, nonce aléatoire, dates de validité, cible/contexte et engagements. Le serveur recalcule cette identité. Les IDs d’opération lient transfert, phase/ordinal et contenu logique. Calculer d’abord l’ID sur le contenu sans ID/hash, puis payload_sha256 sur l’enveloppe avec ID et sans hash : aucune circularité. Un même ID prétendu avec un contenu différent refuse, même après nettoyage du registre.

Durée fermée : requested_at au plus5minutes dans le futur après correction d’horloge ; not_after=requested_at+30jours. Les dates serveur de progression sont conservées séparément. Après échéance, aucune activation tardive : comparaison et nouvelle intention réutilisant les lignes/octet exacts déjà présents, sans nouvel appel. Une panne réseau reprend la même intention tant qu’elle est valide.

Completed/abandoned/expired/rejected et parties sont nettoyables90jours après fermeture, par fonction réservée au rôle de maintenance, au plus50headers et500parties par invocation. Ne retirer le header qu’après ses parties. La date liée cryptographiquement laisse refuser les commandes expirées même après nettoyage. Cette fonction n’a aucun DELETE sur sources, séances, imports, files ou Storage. Les éléments métier d’une intention abandonnée restent récupérables comme sources incomplètes ; nettoyage du registre ne signifie jamais purge d’images ou de réponses.

## 10. Interface

Le livre conserve ses actions L3. « Ajouter des pages d’index » ouvre la séance avec édition connue. Une page active montre miniature/état de fichier, ordre de sélection, numéro imprimé connu, type et état de lecture. Actions : Remplacer la photo, Pivoter, Relire, Retirer de la séance, Historique. Le sens du retrait est visible avant confirmation.

Après remplacement : nouvelle miniature active et mention « Cette image n’a pas encore été lue ». L’ancienne lecture est accessible dans l’historique avec son ancienne image. En conflit : comparaison des sources et choix nommés ; texte récupérable même sans fichier distant. Ne pas montrer des IDs, empreintes ou codes techniques comme explication principale.

Le bilan après lecture présente les nombres exacts et les ambiguïtés restantes. Après interruption d’écriture, « Continuer l’enregistrement — aucun appel » se distingue de « Relire ces pages — N appels ». Ne pas additionner pages en échec, ambiguïtés et références restantes dans un pourcentage sans sens. Les références certaines ont déjà été enregistrées : ne pas ajouter un bouton général de validation. Un bouton de reprise indique les pages concernées et le nombre maximal d’appels. Une erreur d’enregistrement conserve la proposition et offre un réessai d’écriture, pas un nouvel appel.

La rotation de la révision doit être appliquée dans Importer, les miniatures et l’aperçu source de l’éditeur L4. La rotation supplémentaire de consultation demeure locale à la vue, sans mutation de source ; son état initial part de l’orientation réelle de la révision, pas de0. Sur ordinateur, image et comparaison peuvent être côte à côte ; sur mobile, alternance Image/Résultat garde sélection, défilement et champ actif. Les vrais liens de retour L3 reviennent à la bonne séance/livre. Dialogue fermable par Échap, focus restauré, boutons occupés pendant la transaction, état annoncé par live region. Aucun mouvement indispensable à la compréhension ; respecter la préférence de réduction.

PDF/EPUB : une phrase proche du document distingue « fichier conservé » et « pages prêtes à lire ». Accès à la saisie d’index et aux images. Aucun pourcentage inventé pour un traitement dont le total n’est pas connu.

## 11. Répartition de construction proposée

A. Modèle de révision, portes repo/DB, archive, commandes et SQL/client sync. Livrer d’abord formats, vecteurs canoniques et contrats atomiques à B/C. Aucun assouplissement de source_batch.

B. Domaine de lecture/consolidation et panneau Index : captures exactes, décisions versionnées, plan d’application, comparaison/bilans et tests de courses/absence de doublons. Réutiliser les moteurs existants, conserver les réponses payées.

C. Écran Importer et panneau de révisions : révisions actives et historique, remplacement/rotation/retrait, rattachement, comparaison de sources. Raccord au panneau Index de B après contrat A, navigation L3 et preuves visuelles.

Intégration : orientation des miniatures communes et de la source L4, pages actives dans Livre/Classement, styles/i18n/versions/SW/runner/docs, compatibilité des autres mutateurs de séance et réception générale. Aucun code L5 avant L4 public. L6/L7 et purge Storage ne sont pas des dépendances.

## 12. Preuves et réception

Tests rouges avant construction de chaque comportement, puis tests ciblés ; suite complète et contrôles Node existants à l’intégration. Tests de données en bases jetables, fetch injecté, aucun compte privé ni appel assistant réel dans la suite.

| Preuve | Résultat obligatoire |
|---|---|
| Deux pages ajoutées à un livre indexé | Anciennes références gardées, bilan exact, pages non choisies non lues |
| Photo remplacée et rotation | Nouveaux IDs, sources/versions anciennes inchangées, nouvelle image non validée ; orientation identique dans Importer, miniatures et source L4 |
| Réponse après remplacement ; résultat changé sous même ID/date | Résultat payé conservé, aucune application sur la nouvelle image |
| Interruption/rechargement | Reprise seulement des appels/pages/zones manquants de la capture, aucune relance implicite |
| Plein format coupé puis deux moitiés | Maximum3 appels annoncé avant départ, images/zones exactes capturées, conservation gauche avant appel droit ; panne à droite ne perd pas la gauche ;2×400 et2×600 entrées conservées sans troncature |
| Quota à chaque phase du commit | Zéro ligne/octet partiel et aucun statut enregistré fictif |
| Deux onglets créent le même ajout d’index | Une application admissible, l’autre garde le résultat et compare |
| Une lecture produit plus de 500 références | Portions métier atomiques, progression exacte, arrêt/reprise du reste sans appel ni doublon |
| Conflit entre deux portions | Portion commise conservée ; suite bloquée et résultat récupérable, aucun scope extérieur adopté |
| 128 reçus et résultat proche de la borne de ligne | Bornes nombre ET octets respectées ; reçus sans longues listes, aucune perte de la lecture |
| Deux moteurs hors ligne remplacent la même page | Premier accepté, second conflit récupérable ; choix explicite, pas de réécriture de parent |
| Accusé perdu, doublon, accusé étranger/tronqué | Idempotence exacte ; aucun effacement prématuré de file |
| Ancien client/REST/alias/RPC direct | Identité et sélection réservées non contournables, verrou propriétaire pris à l’entrée |
| Métadonnée personnelle sans rapport avec index | Écriture toujours possible si cycle admissible, sources historiques conservées |
| Livre retiré/restauré pendant lecture/écriture | Résultat gardé, ancienne intention refusée, aucune résurrection |
| Favori, note, titre corrigé, recette complète, référence retirée | Aucune perte ni doublon de remplacement |
| Rattachement déjà cité | Copie de graphe/identités, anciennes recettes et journaux intacts, mêmes octets, source_copy exacte |
| Transfert >500 lignes, doublon/ordre/finish incomplet | Activation uniquement après totalité vérifiée ; sources actives antérieures intactes |
| Échéance30j et nettoyage90j | Reprise explicite sans appel, aucun rejeu expiré ni suppression métier/octet |
| Archives anciennes/nouvelles et collisions | Round-trip complet ; boucle/parent étranger/identité modifiée refusés atomiquement |
| Archive/bootstrap de livre retiré ; cycle changé avant finish | Sources historiques consultables sans réactivation ni lecture nouvelle ; cycle concurrent refuse l’activation |
| Sources sans livre | Append/remplacement/rotation/retrait/sélection gardés sous CAS, sans exiger une édition fictive |
| Brouillon L4 depuis ancienne révision | Texte et image exacts récupérables, aucune nouvelle base silencieuse |
| Réception partielle entre tables et fragments | État incomplet honnête, reconstruction exacte, pas de source substituée ni d’application prématurée |
| Autre journal du read_set modifié | Toute la portion refuse, décisions affichées conservées ; aucun nouvel appel |
| JSONB UTF-8/limites/canonicité | Borne exacte acceptée, +1 refusé ; mêmes vecteurs JS/SQL |

Parcours réel obligatoire : livre avec index existant, deux ajouts, un remplacement, une rotation, relecture partielle simulée, conflit, recharge et hors ligne. Captures et mesures à 320/390/768/1280 et texte200 %, clavier et retours. Mesurer les images/pages chargées : pas de téléchargement du livre entier pour lire deux pages. Aucune affirmation de test physique sans essai réel de Neegan.

## 13. Conditions avant publication

- Contrats des champs, commandes, reçus et canonicalisation relus par un autre agent ; ambiguïtés levées dans cette spec avant code concerné.
- Preuves SQL en deux sessions avec interleavings forcés : commande contre REST et ancienne RPC, sans verrou manuel qui masquerait un oubli.
- Migration testée sur copie locale du schéma actuel et anciens formats. Sa présence ne vaut pas application en production.
- L4 publié et contrôlé ; anciens mutateurs de sources audités et raccordés. Aucun chemin d’écriture réservé oublié dans import ciblé, classement, couverture, archive ou backfill.
- Documentation publique de la limite PDF/EPUB et du conflit conservé localement ; état de progression et bilans conformes aux reçus réels.
- Réception générale, puis seulement les gestes de publication autorisés. Ce contrat ne constitue aucune déclaration de livraison de L5.

## 13. Précisions de réception technique

Les journaux d’appel capturés sont envoyés comme snapshots exacts de chaque état conservé, jamais recomposés depuis les décisions plus récentes au moment de l’envoi. Une entrée ancienne sans snapshot est retenue pour comparaison, sans réinterprétation automatique.

Lors de la première liaison sans compte vers un compte nommé, seuls des transferts archive/bootstrap/attach encore jamais envoyés peuvent être reconstruits atomiquement avec cette identité : mêmes données, nonce et dates, nouveaux engagements signés. Les résultats payés index_result et les commandes source_revision/index_apply dépendantes ne sont pas rebasés silencieusement.

Après un refus serveur, l’écran compare les sources confirmées avec la modification locale et ses dépendances. Garder les sources confirmées conserve les modifications et photos à part, récupérables après rechargement. Une décision d’index payée dépendante n’est jamais annulée par cascade. Une reprise choisie réserve une nouvelle intention et garde les anciens parents exacts.

La validation serveur d’une première capture d’index est un helper en lecture seule, autorisé au propriétaire authentifié. Les mutations réservées passent uniquement par le helper de commandes qui reprend les contrôles de compte et le verrou propriétaire. Les anciens alias RPC, REST et des marqueurs GUC forgés ne peuvent donner cette autorité. La purge explicite du compte reste autorisée, sous verrou et limitée au propriétaire ; aucun nettoyage automatique supplémentaire n’est installé.
