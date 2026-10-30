# L10 — Contrat opérationnel B, 30 octobre 2026

Documentation uniquement, aucun code/test de production L10. Base reçue : L9 0.31.0/DB6/archive7, code ed454203 et reçu14cc996 ; cible L10 0.32.0/DB6/archive7. La construction attend encore le commit du contrat et le GO. Spec et plan L10 font autorité ; ce document ferme les raccords B avec A et C.

## 1. Fichiers et API

B possède `src/domain/hors-ligne.js`, `src/ui/hors-ligne-repas.js`, raccord `src/ui/meals.js`, lecture des paramètres exacts dans `src/ui/recipe.js` et tests dédiés. B possède aussi le seul raccord facultatif reessayerFichier de `src/sync/moteur.js` défini au §3 ; aucun autre changement de transport. Le domaine est pur ; IndexedDB, moteur, livraison et décodage restent dans l’orchestrateur UI. Aucun nouveau magasin, clé durable, format d’archive, service distant ou commande métier.

Exports du domaine :

- `preparerPerimetreHorsLigne({meal,donnees,choix})` construit une copie bornée du périmètre et ses usages ; il ne substitue aucune version et n’effectue aucun IO. Retour `{issue:'ok',capture}` ou `{issue:'refuse',raison}`.
- `projeterPreparationHorsLigne(capture,observations)` retourne le bilan pur décrit au §4 ; aucune fonction d’horloge/réseau implicite.
- `diagnosticPreparationHorsLigne(observation)` retourne uniquement le DTO expurgé convenu avec C (§8).

Export UI : `creerPreparationHorsLigne({meal,ctx,repo,moteur,estCourante,livraison})` retourne un nœud avec `verifier()`, `telechargerSelection()`, `reessayer(sha)`, `etat()`, `dispose()`. `livraison` est l’instance de A obtenue par `obtenirControleLivraison()` ; injectable en test. Les trois gestes asynchrones retournent leur bilan structuré, sans navigation/refresh implicite. `etat()` expose une copie d’affichage, jamais la capsule de portée ni un objet réutilisable pour écrire.

La commande Préparer hors ligne monte le panneau et vérifie les données locales sans téléchargement. Les choix sont explicites et seulement en mémoire. La fermeture/reload supprime le bilan, pas les fichiers ; aucun ancien prêt ne revient tout seul. Le bouton ordinaire Cuisiner ensemble conserve son contrat L7/L8 et ne reçoit aucune candidate de traduction implicite.

## 2. Capture, portée et relecture

Au montage, copier le repas réellement affiché avant le premier await, son identité et les références choisies. Garder en privé l’instance `repo.db`, son nom, la génération `getSyncGeneration()`, le propriétaire durable `sync_state.user_id` (confronté à `ctx.proprietaireDonnees`), et la ligne `editor_library_epoch:v1`. L’authentification courante et le moteur servent seulement à savoir si la réception est possible ; ils ne réattribuent jamais la bibliothèque à un autre compte.

Avant la première preuve puis après chaque réception, relire le repas et la fermeture exacte avec les index déjà présents : recettes/versions par ID, traductions par `recipe_version_id`, cuissons par `recipe_id`, pages par les IDs de la recette et documents correspondants. Pour les index de cardinalité inconnue, parcours borné par curseur plutôt que getAll non borné ; arrêt explicite lorsque la limite de contrôle est dépassée. Utiliser une transaction readonly `db.tx` pour la fermeture lorsque les requêtes dépendantes sont enchaînées dans les callbacks IndexedDB ; aucun await crypto/décodage dans cette transaction. Ne pas lire tous les blobs de la bibliothèque avec getSnapshot(files). Les blobs sont lus séparément par SHA et libérés au fur et à mesure.

La première relecture confronte le repas affiché à la ligne en base. S’il diffère, le panneau ne s’auto-rebase pas : message périmé et geste explicite Revoir le repas, puis nouvelle capture. À la fin d’une passe, une fermeture changée invalide la preuve ; les octets reçus restent conservés sous leur propriétaire. Tout changement de sélection incrémente un numéro de passe et invalide immédiatement le bilan précédent. Une résolution ancienne ne peut toucher le panneau ni le nouveau bilan.

La capture de domaine contient :

- `format:1`, `passe` entier local, `capture_le` fourni, `meal` avec ID/titre/portions/planification/état d’archive/items réellement affichés ; les champs absents et null restent distincts dans les copies.
- `occurrences` dans l’ordre du repas : `{ordinal,item_id,recipe_id,version_id,servings,locale,translation_id}`. `item_id` vaut l’ID existant ou null ; ordinal n’est qu’une position locale. Aucun ID métier inventé pour un ancien item. `servings` vient de `portionsRepas` et peut être null.
- `recettes`, `versions`, `editions`, `traductions`, `cuissons`, `pages`, `documents` : fermeture des seules occurrences. Les recettes et éditions comprennent leur cycle ; les versions gardent les identités et contenu d’origine ; les pages restent celles explicitement citées, même historiques. Aucun téléchargement récursif de tout le livre ou de toute une famille L5.
- `usages` : rôle `photo_plat`, `photo_cuisson`, `page_source` ou `document_source`, référence locale à son contenu et SHA réellement porté. Les SHA communs sont vérifiés/téléchargés une seule fois. Une référence mal formée n’est ni réparée ni prise comme URL.
- `choix` : langue et candidate par occurrence, ensemble de médias sélectionnés. Original/fr/en sont les langues de lecture L6 ; aucune détection de langue du texte. Une case de fichier partagé vaut pour ses usages, et le détail nomme ce partage.

Les notes indispensables sont celles réellement proposées par la fiche : notes de version, notes personnelles de recette et observations des cuissons de cette recette. Les groupes et textes traduits passent uniquement par `preparerLectureRecette` puis `projeterLectureRecette`. Une traduction courante partielle reste consultable avec les passages originaux et le même avertissement L6 ; elle n’est jamais présentée comme un français complet. Candidate invalidée/périmée ou ambiguë sans choix : pas de certification de cette lecture.

Comparaison des données lues : projections explicites des champs consommés, pas JSON.stringify brut. Ne pas confondre propriété absente/undefined ou trous/null ; ne pas nettoyer un texte pour rendre sa base égale. Ignorer uniquement les horodatages techniques/reçus qui ne changent pas la lecture. La candidate utilise `projectionCandidateTraduction` (révision réelle conservée, updated_at/receipts exclus). La version exclut son seul updated_at technique ; son contenu/provenance/IDs restent exacts. Ajout ou retrait d’une candidate, note, photo, page ou cuisson offerte invalide la fermeture de lecture. Favori ou compteur d’envoi ne rend pas une recette indisponible.

## 3. Observation des fichiers et réception

Une observation de fichier est rattachée au SHA demandé et à la passe : présence relue, type rendu par `typeAffichage`, taille du blob, classification de copie, résultat de lecture/décodage et erreur locale effectivement relue. Elle ne réutilise pas un ancien succès pour un blob arrivé/remplacé entre-temps. Une exception de lecture de base donne inconnu, jamais absent.

Pour une image, utiliser le chemin d’affichage accepté (`displayUrl` avec `urlDeBlob`) et attendre son décodage réel. Révoquer uniquement les URLs de cette vérification sur succès/échec/annulation ; pas le registre entier de l’application. Au plus deux décodages en vol. Pour PDF/EPUB : fichier présent et conservé, non certifié comme image ou comme document intégralement rendu ; son accès proposé utilise le téléchargement local existant. Ne pas ajouter de parseur PDF ou de conversion d’image.

Ne pas confondre copie utilisable et preuve d’original. `estOriginalIci` est actuellement une comparaison de taille, avec limite connue : même taille ne prouve pas l’empreinte. Le bilan hors ligne n’affirme donc jamais « original vérifié » sur ce seul test. Une copie locale ou réduite décodable peut être déclarée disponible pour cette copie, avec original inconnu/non préservé selon les métadonnées existantes ; le lot ne redéfinit pas les écritures de fichiers. Une empreinte locale éventuellement calculée sert à relire les mêmes octets dans la passe, pas à fabriquer une provenance absente.

Ordre de décision de réception :

1. Blob présent : vérifier et afficher son résultat. `telecharger` le saute ; un blob illisible n’a pas de bouton Réessayer le téléchargement sans effet. Conserver ses octets et l’accès Télécharger le fichier, aucune suppression/réparation implicite.
2. Blob absent, `file_error` de sens réception, remote valide du propriétaire : geste Réessayer explicite via **`moteur.reessayerFichier(sha,{erreurAttendue,sensAttendu:'reception'})`**. Un simple telecharger ignore cette erreur. Les sens envoi restent un diagnostic de synchronisation ; ce panneau ne les transforme pas en réception.
3. Blob absent, remote du propriétaire, pas d’erreur bloquante, moteur courant connecté et non en pause : télécharger via **`moteur.telecharger([sha])`**. Aucun appel direct stockage/Supabase.
4. Remote absent/mal formé/autre propriétaire, compte non connecté, pause ou arrêt : message correspondant ; aucun faux téléchargement lancé. Une erreur passagère réseau/quota est distincte d’une absence effectivement relue.

Raccord approuvé root après lecture du moteur actuel : l’option est facultative. `erreurAttendue` est la copie exacte de la ligne `sync_state` relue et présentée, pas seulement son motif. Avec cette option, le moteur confronte présence, ligne complète et sens réception dans la même transaction que la suppression conditionnelle, sous ses gardes d’arrêt/propriétaire. Erreur supprimée/remplacée ou devenue envoi : `{refuse:true,raison:'erreur_fichier_changee'}`, aucune suppression, réception ni relance d’envoi. Le panneau propose Vérifier à nouveau. Sans option, le contrat historique reste inchangé. Un précheck UI seul ne tient pas lieu de ce CAS. Témoins : changement de sens entre affichage/geste, changement de motif/date, disparition, arrêt/compte changé et succès exact, plus ancien appel sans option.

Les appels de réception sont en série, un SHA par appel, pour pouvoir arrêter la planification entre fichiers et montrer les résultats confirmés. Le moteur conserve son enVol par SHA et peut rendre recus:0 si une autre réception a gagné ; seule la relecture du blob tranche le succès. `dispose` et Annuler ne demandent jamais arreterTelechargement global ni l’arrêt d’un autre écran. L’appel déjà parti garde les protections du moteur ; B n’écrit aucune clé sync_state, même pour effacer file_error.

## 4. Bilan pur et priorités

`observations` contient `passe`, `observe_le`, la relecture de portée/fermeture (`courante`, `perimee` ou `inconnue` et motifs), les résultats de lecture L6, les observations de médias et l’observation opaque de livraison A. La projection n’accepte pas un bilan d’une autre passe.

Retour : `{format:1,etat,observe_le,recettes,medias,limites,raisons}`. Chaque occurrence garde son identité locale, son lien de consultation, son état de lecture et ses manques nommés ; chaque fichier garde les usages, sélection/exclusion, observation et geste possible. Le DOM rend les textes via t(), jamais à partir de HTML reçu.

Priorités globales :

- `perime` si sélection/portée/fermeture ou observation de livraison n’est plus actuelle ; aucun prêt conservé.
- `partiel` s’il existe un manque certain : version absente, référence d’index seule, usage culinaire retiré, candidate non adoptable, média sélectionné absent/illisible ou coquille démontrée incomplète. Les inconnues supplémentaires restent détaillées.
- `inconnu` si aucune impossibilité certaine n’a été relevée mais une vérification requise n’est pas terminée ou observable : erreur/timeout, volume non vérifié, livraison inconnue/non contrôlée/incompatible.
- `pret` seulement si toutes les lectures indispensables sont consultables, les médias sélectionnés effectivement utilisables selon leur type et la coquille A vérifiée/courante. Le détail mentionne lecture mixte/partielle L6, copies réduites et exclusions ; prêt ne veut jamais dire synchronisé, traduit entièrement ou original sauvegardé.

Une recette retirée peut être consultée historiquement ; sa présence locale est détaillée, sans nouvelle autorisation de cuisine ni bilan global Prêt à cuisiner. Le diagnostic n’appelle aucune commande de restauration ou d’adoption.

## 5. Bornes de travail à éprouver

Le périmètre est borné sans tronquer les données :1000 occurrences de repas (la création L8 est déjà limitée à100, les anciens repas ne sont pas réécrits),10000 lignes de fermeture textuelle/références cumulées et16Mio de snapshot textuel de travail. Au dépassement, bilan inconnu avec raison volume_non_verifie ; aucune ligne ignorée silencieusement et aucun objet métier modifié. Ces bornes de diagnostic sont à mesurer sur le harnais annoncé, pas des bornes de stockage ou une promesse de mémoire physique.

Lectures par petits groupes d’au plus64 IDs, affichage des détails par50 éléments avec compte total ; pagination d’affichage distincte du périmètre vérifié. Réception série, décodages au plus2. Une image/lecture locale n’aboutissant pas au bout de30secondes donne inconnu, jamais illisible supposé ; ses callbacks tardifs sont neutralisés, URLs libérées. La preuve de coquille suit le timeout A, sans second timeout contradictoire.

Pour les tailles : addition d’entiers sûrs uniquement ; un volume absent donne null/« inconnu », pas zéro. `octets_connus` additionne les seuls fichiers sélectionnés uniques dont une taille utilisable est observée ; null si un seul demeure inconnu. Ne pas promettre qu’une estimation StorageManager constitue de l’espace réservé. Aucun téléchargement automatique provoqué par le choix d’une catégorie.

Ces limites appartiennent au contrôle local et pourront seulement être ajustées sur mesure causale avant gel ; un dépassement reste visible. Le harnais couvre une bibliothèque dépassant120 recettes,100 pages, SHA communs et au moins3 grandes images, sans transformer ces données en un repas gigantesque artificiel.

## 6. Livraison A

`obtenirControleLivraison()` retourne une instance ou null. `verifier()` rend une observation figée : `{etat,execution,controleur,actif,attente,raison,verifieLe}` ; états `verifiee`, `incomplete`, `inconnue`, `incompatible`, `non_controlee`. B ne lit pas CacheStorage directement et ne réinterprète pas le manifeste.

`estCourante(observation)` est requis immédiatement avant le bilan final. `observer(listener)` retourne unsubscribe ; controllerchange/updatefound/statechange invalident l’époque de preuve et notifient inconnu avant la vérification partagée. B invalide sa preuve de coquille immédiatement et peut revalider la même capture encore courante ; pas de rebase métier ni polling. Seul verifiee avec observation encore actuelle permet pret. Une livraison en attente ne remplace pas la livraison exécutée.

## 7. Liens exacts et rechargement

Depuis le bilan : vraie URL `#/recipes/<id>?v=<version>&lang=<locale>&translation=<candidate>` (translation omis pour Original/absence de candidate), via lienAvecOrigine. Aucun paramètre de certification, ID de passe ou texte privé dans l’URL. Le rechargement garde ces paramètres et les revérifie contre les données locales ; le panneau lui-même ne persiste rien.

**Arbitrage root accepté le30octobre :** un v explicite absent/étranger ne retombe plus silencieusement sur la version courante. Afficher Version demandée indisponible et le geste volontaire Voir la version courante. Sans v explicite, le contrat de fiche actuel reste inchangé. Une translation explicite doit appartenir à cette version, cette langue et à une lecture encore valable selon L6 ; sinon signalement puis choix volontaire Original ou autre candidate validée. Ne jamais sélectionner une autre candidate pour faire réussir la navigation. Adapter les anciens scénarios de lien forgé en gardant leur contrôle d’association et la preuve du recours explicite.

La préparation certifie la disponibilité du contenu, pas un recalcul durable de portions/unités. Les portions null du repas restent inconnues ; la fiche montre ses quantités d’origine selon son contrat lorsque aucun objectif n’est fourni. Aucun changement de repas, convention, version courante ou séance n’est nécessaire pour consulter.

Réception : préparer, ouvrir réellement la fiche exacte, couper réseau, recharger la même URL, vérifier titre/groupes/ingrédients/étapes/notes/candidate/photos/pages annoncées. Retour au repas puis reload : bilan et choix de préparation absents ; Vérifier hors ligne recapture et redemande les choix ambigus. Cuisine se reçoit séparément avec ses seuls choix propres.

## 8. Diagnostic C et absence de fuite

`diagnosticPreparationHorsLigne(observation)` retourne uniquement :

```js
{format:1, etat:'pret'|'partiel'|'perime'|'inconnu', observe_le:string|null,
 recettes:{total,disponibles,indisponibles,inconnues},
 medias:{selectionnes,exclus,utilisables,manquants,illisibles,inconnus},
 octets_connus:number|null}
```

Compteurs entiers sûrs non négatifs. Les recettes sont les occurrences (doublons voulus conservés), médias les fichiers uniques (un SHA partagé compte une fois), exclus seulement ceux qui ne sont inclus par aucun usage sélectionné. C revalide le DTO avant inclusion ; absence de panneau actuel = null, notamment après navigation vers Réglages. Aucun état global ne transporte un ancien bilan pour remplir ce diagnostic. Aucun SHA/ID/titre/nom de fichier/URL/owner/texte de note/réponse assistant ; aucun bus ni stockage durable ajouté pour ce diagnostic.

C possède seul le raccord readonly ui/state pour l’inventaire des protections de saisie. Une protection connue montée hors de la seule racine réellement consultée par flush oblige Conserver mon travail à refuser et à demander de terminer/annuler par les commandes existantes. Capturer montage/portée/protections avant attente, les relire après flush. Un autre formulaire ouvert entre-temps interdit un succès. Les protections de refresh ne sont jamais prises pour un flush ou une permission de quitter.

## 9. Premiers rouges, puis preuves attendues

Fermeture repas changée, version explicitement disparue, candidate étrangère/périmée/doublon, notes ajoutées pendant réception, compte/époque changés ; blob absent, réception gagnée ailleurs avec recus0, erreur file_error et réessai dédié, blob corrompu présent sans nouveau GET, SHA partagé, exclusions, PDF conservé non image, quota/timeout/annulation. Anciennes données undefined/trous comparées sans normalisation ; métadonnée technique d’ACK seule sans faux changement de lecture.

Vrai moteur avec transport injecté, pas d’appel privé ni d’assistant. Vrai lecteur de destination après reload offline et pas simple href. Contrôles observés de décodage/URL révoquée et compteurs précis. Shell A inconnu/incomplet/controller remplacé invalide prêt. Diagnostic copiable expurgé. Tests bibliothèque/volumes et captures320/390/768/1280+texte200, puis public sur livraison réellement construite.

Aucune preuve d’iPhone/Safari/PWA physique ni de maintien permanent des fichiers n’est déduite de Chrome ou de ce document.
