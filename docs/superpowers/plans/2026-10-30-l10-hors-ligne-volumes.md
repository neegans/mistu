# L10 — Plan de construction et réception hors ligne

**30 octobre 2026 — réception locale terminée après contrat `145ccf1`, publication en préparation.** [Spec](../specs/2026-10-29-l10-hors-ligne-volumes-design.md), plan directeur §17. Base reçue : **L9 0.31.0, DB6, archive7**, code `ed454203`, reçu `14cc996` ; cible **L10 0.32.0, DB6, archive7**, sans migration SQL. Réception L9 acquise ; le GO technique du §6 a suivi le commit des signatures. Les sections 1–5 décrivent le plan initial ; les reçus ci-dessous consignent les résultats effectivement lus. La poursuite globale est autorisée ; aucune relecture personnelle de Neegan n’est revendiquée.

Construire après GO explicite sur le contrat fermé. Annexes : [livraison A](../specs/2026-10-30-l10-protocole-livraison.md), [hors ligne B](../specs/2026-10-30-l10-protocole-hors-ligne.md), [conservation et diagnostic C](../specs/2026-10-30-l10-protocole-conservation.md). Le lot réutilise les repas, versions, traductions, fichiers, archives et gardes existants. Pas de second moteur de synchronisation, nouveau magasin synchronisé, migration SQL ou format d’archive pour le diagnostic local.

## 1. Fermer les raccords avant code

Consigner le commit de départ et les API effectivement livrées. Confirmer le choix de version de repas L8, la langue/candidate L6, l’accès aux séances/minuteurs L7 et le point commun de sortie L4/L6. Aucun remplacement par la version courante d’une recette lors d’un bilan.

Figer l’inventaire de coquille : format fermé, génération reproductible, identifiant unique de livraison, chemins et SHA attendus. Définir son empreinte sans auto-référence et les chemins du petit démarrage contrôlé. Vérifier que les imports dynamiques et ressources nécessaires y figurent ; conserver ES natifs, sans nouveau bundler. L’outil de génération éventuel produit un artefact vérifiable, pas une liste entretenue différemment par deux chemins.

Retenir l’activation naturelle et le message de fermeture/réouverture, conformément à §4 de la spec. Aucun vote de consentement entre fenêtres, aucun message qui force un reload. Les caches étrangers et la livraison utilisée restent intacts.

| Zone | Fichiers principaux | Contrat |
|---|---|---|
| Coquille et worker | `sw.js`, `sw-rules.js`, `index.html`, petite entrée de démarrage et inventaire | Une livraison immuable, installation vérifiée, pas de claim forcé |
| Présentation de mise à jour | `app.js`, `core/router.js`, `ui/sortie-editeur.js`, raccords L6/L7 | Même garde, DOM conservé, réponse payée jamais assimilée à un brouillon durable |
| Diagnostic du repas | `ui/meals.js`, domaine pur local éventuel, `sync/moteur.js`, helpers fichiers | Instantané choisi exact, moteur existant, bilan relu |
| Réglages et réception | `ui/settings.js`, archive existante, styles/i18n/tests | Diagnostic expurgé, mesures et limites factuelles |

Répartition proposée en trois volets indépendants après fermeture des API :

- **A, livraison cohérente** : générateur et modèle du worker, manifeste généré, `sw.js`, `sw-rules.js`, `index.html`, module de démarrage et `core/livraison.js`, tests de worker sur origine jetable. A expose seulement le diagnostic `shell_status` à B/C ; aucune donnée métier dans ce protocole.
- **B, repas disponible localement** : `domain/hors-ligne.js`, `ui/hors-ligne-repas.js`, raccord `ui/meals.js` et lecture exacte des paramètres dans `ui/recipe.js`, option CAS de réessai dans `sync/moteur.js`, tests T1/T2. Réutiliser le moteur sans changer son autorité. Un défaut prouvé dans un helper de fichiers est attribué avant édition, jamais contourné par un second téléchargement.
- **C, présentation et conservation** : demande explicite de garde dans `core/router.js`/`ui/sortie-editeur.js`, inventaire readonly des protections montées dans `ui/state.js`, statut de mise à jour dans `app.js`, diagnostic de `ui/settings.js`, tests T4. C consomme A et les contrôleurs existants ; aucun nouveau vote entre onglets ni rechargement métier.

Le responsable d’intégration garde styles, i18n, versions, runner, documents de réception et publication. Le petit module de démarrage reste chez A, le montage métier et ses gardes chez C : un seul propriétaire par fichier. Les noms proposés au §8 de la spec sont à figer avant le premier test dépendant. Aucun de ces volets n’est autorisé à coder par la rédaction du présent plan.

## 2. Tranches avec rouges causaux

### T1 — Diagnostic de disponibilité

Créer `tests/l10-hors-ligne.js` pour un lecteur pur de l’instantané capturé, puis `tests/l10-hors-ligne-ecran.js` pour la commande réelle du repas.

Fixtures : plusieurs recettes/versions, deux candidates de traduction et une partielle, notes, pages source, photo du plat, PDF, SHA partagé et média exclu. Vérifier les IDs/langues réellement choisis, les manques documentaires L6, la déduplication des téléchargements et les totaux du périmètre. Une recette retirée ou version disparue ne se restaure pas pour le diagnostic. Une référence d’index seule n’est pas une recette complète. Les occurrences gardent leur position/IDs présents, les portions null restent null, et les notes effectivement offertes sont indispensables ; aucune nouvelle identité métier n’est créée pour le bilan.

Le choix du panneau reste en mémoire. Tester l’ouverture réelle du lien `v/lang/translation` puis son rechargement hors ligne : la fiche doit consommer le paramètre de candidate, aujourd’hui ignoré, et le valider contre version/langue/ensemble L6. Candidate absente, d’une autre version, d’une autre langue ou périmée : signaler sans remplacer. Version `v` explicitement absente/étrangère : état indisponible et geste Voir la version courante ; sans `v`, garder le comportement actuel. Conserver les anciens scénarios de lien forgé en adaptant seulement leur repli devenu volontaire. Après reload du repas, aucun badge ni candidate n’est restauré silencieusement ; le panneau recapture et redemande le choix, même offline. Le bouton ordinaire Cuisiner ensemble conserve son contrat L7/L8 : aucune promesse de transmettre ce choix de consultation à la séance.

Fichier déclaré sans blob, blob valide, copie réduite, original inconnu, image corrompue et erreur de lecture locale. Le simple `instanceof Blob` et la taille ne prouvent pas un décodage. Un PDF conservé n’est pas une page image décodable. La corruption d’un blob déjà présent reste « illisible » : pas de bouton qui relance inutilement `telecharger`, pas d’effacement automatique.

### T2 — Téléchargement et invalidation du bilan

Appeler le vrai moteur avec un transport injecté, sans accès direct au stockage depuis l’écran. Source distante absente, refus de propriétaire, réseau, quota, réception partielle, SHA partagé et téléchargement simultané déjà en cours. Le nombre de réceptions HTTP ne remplace pas la relecture finale des fichiers utilisables. Le réessai d’une erreur de réception relue utilise `moteur.reessayerFichier(sha,{erreurAttendue,sensAttendu:'reception'})` ; rappeler `telecharger` seul ne franchit pas `file_error`. Ne pas proposer ce recours pour un blob corrompu déjà présent. Poser le rouge où file_error devient envoi/motif différent/disparaît entre affichage et transaction : refus sans suppression ni envoi. Garder le scénario de l’appel historique sans option et les gardes arrêt/compte. Propriétaire absent/distant incompatible : diagnostic exact, sans faux démarrage de téléchargement.

Changer compte/base/génération, cycle, repas, version, candidate ou sélection pendant l’attente. Les octets correctement obtenus restent dans leur portée ; aucun ancien bilan n’est présenté comme le choix actuel. Refaire Vérifier sans appel payé. Contrôler les URLs de blob créées/révoquées et au plus deux décodages en vol, sans révoquer celles d’une autre vue. Annuler arrête la planification future ; les réceptions déjà parties restent sous les gardes du moteur. Un résultat tardif ne modifie pas un panneau démonté.

Cache absent/incomplet ou vérification impossible : la fiche reste consultable selon ses données, mais aucun « Prêt sur cet appareil » trompeur. Les médias exclus restent nommés comme exclus.

### T3 — Inventaire et cache immuables

Commencer par des tests du générateur : ordre stable, doublon de chemin, traversée/encodage de séparateur, source manquante, mauvais MIME, import dynamique hors inventaire, dépassement des bornes, aucun hash auto-référent. `--check` vérifie l’artefact sans le réécrire. Relever le manifeste avec chaque preuve et mesurer le total réel contre les bornes de la spec ; celles-ci ne sont pas des performances observées.

Créer des tests de worker sur une origine/profil jetables, distincts de la suite générale. Servir deux livraisons A/B avec octets différents et un import dynamique observable. Les tests unitaires de règles restent utiles, mais une recherche de chaîne dans `sw.js` ne prouve pas le cycle réel.

Installer A complète, puis offrir B partielle, mauvais SHA, réponse 200 contenant d’autres octets, erreur réseau et quota. B ne devient pas disponible ; A continue. Les fichiers de A ne sont jamais remplacés par B dans son cache, même en ligne. Une entrée de A évincée ne peut recevoir que ses octets attendus ; sinon échec honnête. Aucune recherche globale ne masque le manque avec un autre cache. Vérifier aussi une entrée présente mais altérée : le hit est contrôlé avant livraison. Deux manifests différents ne partagent pas de cache malgré un libellé de livraison accidentellement identique.

Éprouver l’interruption de l’installation et de l’activation : toute donnée indispensable est déjà vérifiée avant installation terminée. Nettoyage limité au cache précédent dont la propriété et l’usage sont démontrés ; métadonnée absente/ambiguë garde les caches inconnus. Un cache de waiting/install n’est jamais supprimé par un diagnostic ou une autre activation. Mesurer la coexistence A/B et son coût de quota ; aucun effacement d’IndexedDB pour faire de la place.

Préserver un cache étranger à Mistu. Refuser la mise en cache des réponses privées/paramètres OAuth et des chemins hors inventaire. Vérifier navigation profonde avec fragment, route inconnue et retour de connexion sans enregistrer d’URL sensible.

### T4 — Plusieurs fenêtres et reprise explicite

Deux onglets A, dont un avec saisie L4/L6, puis B complète en attente. Continuer des imports tardifs dans A : seuls les modules A s’exécutent. Aucun `controllerchange`, message ou onglet muet n’autorise le reload ni la fermeture des autres fenêtres.

La bannière dit prête et explique fermeture/réouverture, sans dire installée dans l’écran courant. Le geste Conserver mon travail traverse la même garde : HTTP en vol refusé, quota garde réponse brute en mémoire et récupération disponible, réessai mêmes octets sans nouveau POST. Aucun dispose avant le résultat ; un accord de quitter sans conserver ne devient pas un badge de conservation réussie. Réponse tardive, demande dupliquée et mauvais worker/registration/request_id ignorés. Éprouver le MessageChannel et sa fermeture sur succès/timeout/dispose, la forme fermée, les bornes et le partage de promesse ; aucun polling permanent. Un timeout reste inconnu, pas un faux cache absent.

Ajouter les formulaires L8 seulement en mémoire, conservation en vol, bilan de cuisson avec notes/photos non confirmées et réponse L6 payée reçue pendant le refus quota. Une protection de refresh ne vaut pas flush : capturer racine, portée et toutes protections montées ; refuser si une autre saisie protégée existe ou s’ouvre pendant le flush. Exclure seulement la racine exacte conservée, ne pas confirmer depuis un autre formulaire. Ni le flush, ni le diagnostic, ni la bannière ne cliquent un bouton métier, ne font un POST assistant ou ne désinstallent la garde. Distinguer conserver confirmé, aucune saisie suivie, refus et décision explicite de quitter sans conservation. Vérifier les mêmes octets récupérés après le refus.

Garder une cuisson et un minuteur actifs pendant l’attente : pas de reprise forcée, échéances intactes. Fermer humainement les fenêtres dans le profil jetable puis rouvrir : B devient la livraison exécutée, les données durables se reprennent normalement. Un simple reload d’un onglet restant ne doit pas être annoncé comme succès certain de mise à jour.

### T5 — Première visite et transition historique

Profil sans worker : observer les requêtes et le DOM pour prouver qu’aucun CSS/vendor/app métier n’est chargé avant la décision du petit démarrage externe. Garder la CSP actuelle, enregistrer avec `updateViaCache:none`, identifier le contrôleur réel et sa coquille, préserver chemin/query OAuth/fragment sans les copier dans cache ou diagnostic. Première installation : une seule reprise de la même URL avant montage ; deuxième absence de contrôleur ou sessionStorage refusé : recours explicite, jamais boucle. Worker A compatible déjà actif avec B en attente : servir HTML et modules A ensemble, pas HTML B/modules A. Worker indisponible/installation refusée : bouton explicite Continuer en ligne, limite de cohérence annoncée, aucune certification hors ligne et aucune suppression de base. Ce repli initial n’est jamais activé automatiquement après le montage d’une saisie/cuisson.

Preuve distincte avec le worker historique réseau prioritaire. Observer qu’un onglet déjà chargé ne peut pas être corrigé rétroactivement. Le parcours de réception conserve sa saisie/réponse avant fermeture, puis vérifie la nouvelle coquille après réouverture. Ne pas attribuer à cette transition les garanties déjà acquises entre A et B compatibles L10 ; documenter la limite dans le reçu.

### T6 — Diagnostic expurgé, archive et volumes

Créer les témoins du diagnostic copiable : versions page/worker actif/en attente, état réseau, comptes de lignes/médias, codes d’erreur et tailles disponibles. Injecter jeton, URL privée, identité de compte et texte de recette/réponse dans la fixture : aucun n’apparaît dans le texte copié. Un propriétaire n’est qu’un état. Le DTO B reçoit uniquement compteurs/état/date/tailles ; absence de panneau actuel = null, notamment après navigation vers Réglages. Aucun bus ni certificat durable pour retenir ce constat.

Réutiliser inspection/export/restauration d’archive. Contrôler fichier manquant, copie réduite, original inconnu et avertissements de brouillons/bruts locaux exclus. Une archive de secours partielle reste utile avec son bilan réel ; pas de nouveau format pour le diagnostic.

Fixer les volumes du harnais avant les mesures : au moins 120 recettes pour dépasser la première pagination, un livre de 100 pages image, médias partagés, au moins 3 grandes images et un PDF, traductions partielles et candidates concurrentes. Noter les tailles compressées/décodées et le matériel ; le résultat ne généralise pas à tous les téléphones. La coquille L8 documentaire mesurée comporte 201 fichiers et 3 503 608 octets ; refaire cette référence sur L9 et l’artefact L10, sans présenter cette mesure statique comme une preuve de performance.

Mesurer sur ces données synthétiques l’ouverture de bibliothèque/livre, la préparation de repas et le cycle complet d’archive. Consigner nombres, octets, navigateur/matériel, durée de l’ouverture, préparation, décodage, export et restauration ; répéter seulement pour expliquer une variance ou valider une correction. `storage.estimate` reste une approximation, pas une allocation garantie. Optimiser uniquement un coût mesuré, en préservant originaux et copies serveur.

## 3. Parcours réel local puis public

Profils isolés, aucune donnée privée et aucun appel assistant réel. Le serveur de preuve local doit pouvoir servir A/B sans modifier les fichiers de production pendant l’essai. Le parcours public vérifie la livraison effectivement publiée ; il n’invente pas une seconde publication pour faire semblant de tester un cycle.

1. Choisir un repas de plusieurs versions, une candidate précise, notes, photos et pages ; exclure un média, préparer et relire le bilan.
2. Couper réellement le réseau, recharger le lien de fiche exact issu du bilan puis ingrédients, groupes, étapes, notes, candidate, photos et pages. Revenir au repas et le recharger : aucune sélection de préparation cachée ne revient ; relancer Vérifier hors ligne, choisir la candidate et consulter à nouveau. Le média exclu ne devient pas manquant inattendu. Reprendre séparément une séance L7 durable sans modifier ses choix, IDs ou échéances.
3. Restaurer une archive dans une base jetable et refaire la vérification ; contrôler copies réduites et manques affichés.
4. Exécuter la matrice A/B, installation interrompue et onglets décrite en T3/T4 ; relever les identités des modules réellement exécutés, caches et workers séparément.
5. Exécuter la première adoption historique et la première visite de T5 avec leurs limites propres.
6. Ouvrir le détail de disponibilité et le diagnostic sur 320/390/768/1280px et texte 200 % ; bilan, erreurs et commande de reprise lisibles, focus cohérent avec L9.

Relire les captures et consigner le nombre réel de mesures. L’état prêt est vérifié depuis une coquille contrôlante complète de la livraison exécutée, des données indispensables exactes et des médias sélectionnés réellement utilisables ; les changements à envoyer sont un axe indépendant. Une simple lecture des caches ou le mode offline du navigateur ne prouve pas que les photos se décodent. L’essai Chrome hors connexion est nommé ainsi. Le mode avion iPhone/Safari/PWA, l’éviction réelle par l’OS et les très gros volumes sur l’appareil sont des preuves séparées ; sans essai physique, les laisser non vérifiés. Aucun service worker ne garantit ici alarme système ou téléchargement continu en arrière-plan.

## 4. Réception et livraison

Ciblés puis suite complète, Node/générateur applicables, syntaxe/diff, inventaire de coquille vérifié, cache/version/textes EN et compteur mesuré. Vérifier les anciennes suites fichiers/synchronisation/archive et les gardes L1/L2/L4/L6. Ne pas affaiblir un cycle ou une provenance pour obtenir « prêt ».

Après revue indépendante et réception locale : publication selon l’autorisation du contexte, Pages réellement construit, fichiers publics comparés, parcours public hors ligne et diagnostic de livraison. Une migration n’est pas attendue ; toute nécessité nouvelle doit être motivée avant d’être réservée.

Conserver preuves sous `.superpowers/sdd/2026-10-30-l10/`, puis STATE et rapport sur faits observés. Aucun résultat de ce plan n’est déclaré acquis par sa rédaction.


## 5. Revue avant GO

Le responsable ne lance pas la construction sur un contrat ambigu : reçu public L9 `14cc996` identifié, trois propriétaires et exports figés, manifeste/démarrage sans auto-référence, branche historique distinguée, liens exacts de consultation et sélection mémoire explicités, conservation de réponse payée sans appel confirmée dans les interfaces. Revue A du choix mémoire/URL favorable le 30 octobre ; revue C de §4.4/8 et T4/T5 favorable sur les gardes et la reprise initiale. Rapports préparatoires dans `.superpowers/sdd/2026-10-30-l10/` ; réception de l’implémentation entièrement à faire. La revue finale doit relire aussi l’échec sans `sessionStorage`, l’interruption d’activation et le fait que l’ancien worker ne peut pas être corrigé rétroactivement.

Chaque défaut causal trouvé en construction reçoit un témoin rouge avant correction. Les comportements anciens gardent leurs scénarios ; une nouvelle attente doit correspondre à un changement explicite du contrat, jamais à la suppression d’une assertion. Aucune affirmation physique Safari/iPhone sans appareil et parcours identifiés.


## 6. GO technique de construction — 30 octobre

Base publique L9 code `ed454203`, reçu `14cc996`, 11262/11262 publics. Les trois annexes opérationnelles sont relues A/B/C/root et figées avec la spec ; aucune relecture personnelle attribuée à Neegan. La poursuite et publication sont autorisées par les demandes de session.

- A possède livraison, démarrage, générateur, worker et leurs preuves. La compatibilité de `sw-rules.js` avec le worker historique reste explicite.
- B possède disponibilité du repas, liens exacts de recette et raccord facultatif conditionnel de `reessayerFichier`, avec leurs tests.
- C possède garde explicite, observation readonly des protections, bannière et diagnostic ; le montage métier est séparé du démarrage A.
- Root possède CSS, i18n, version, runner, mesures de volume, revue indépendante, intégration et publication.

Aucun commit ni déploiement par les agents. Pas d'édition simultanée d'un même fichier sans transfert explicite. Les témoins causaux précèdent les corrections. Aucun SQL, changement de DB6 ou d'archive7 prévu. Les résultats d'implémentation restent à recevoir.

Mesure de référence L9 sur données synthétiques, avant construction L10 : 123 recettes, 124 versions, 100 pages, 103 images dont trois3200×2400 et un PDF, 18 266 307 octets. Pagination réelle123, export/inspection/restauration et décodage des103 images réussis dans Chrome156 sur Apple M3 Pro ; aucun essai physique iPhone. Artefacts `volumes-l9/resultat.json` et harnais dans `.superpowers/sdd/2026-10-30-l10/`. Ce reçu de référence ne certifie pas la préparation hors ligne L10.


## 7. Réception de volume et de présentation — locale

Jeu synthétique : **123 recettes, 124 versions, 100 pages image, 103 images au total dont trois 3200×2400, un PDF valide et quatre traductions**, dont une partielle et deux candidates pour la même version. Les trois grandes images représentent chacune 30 720 000 octets RGBA après décodage ; les 100 autres pages font 512×768. Fichiers compressés : **18 266 307 octets**. La version demandée par le repas diffère volontairement de la version courante.

Chrome **156.0.8078.76**, macOS arm64, **Apple M3 Pro**, RAM système 19 327 352 832 octets ; profil isolé et service worker bloqué pour cette mesure. Aucun résultat « prêt hors ligne » n’est revendiqué par ce harnais : le cycle réel est reçu séparément.

| Mesure locale | Résultat |
| --- | --- |
| Bibliothèque avec rechargement | 253 ms ; pagination réelle 60 → 120 → 123 |
| Livre de 100 pages | 126 ms |
| Repas de trois recettes | 71 ms |
| Préparation de trois recettes et sept médias | 211 ms ; relecture 169 ms |
| Médias du repas | Six images décodées, PDF conservé ; 16 084 130 octets connus |
| Export ZIP / inspection | 107,6 / 74 ms |
| Restauration / vérification | 84,6 / 47,1 ms |
| Décodage des 103 images restaurées | 253,6 ms |
| ZIP complet | 18 577 123 octets, 104 fichiers ; aucun manque ni avertissement |
| Tas JavaScript observé | Pic échantillonné 26 528 884 octets ; tas alloué 51 609 600 octets |

La mémoire a été échantillonnée toutes les 50 ms (74 observations) ; elle exclut la mémoire native des images et du processus. Ces durées sont des observations sur cet ordinateur, pas une garantie de performance sur téléphone. La vérification garde au plus deux décodages en cours ; les blobs ne sont pas conservés dans le résultat du panneau.

Une seconde archive contient une copie réduite connue, une copie dont l’original est inconnu et un fichier manquant : chacun conserve son état après restauration. Les images des copies sont décodées ; le manque reste sans blob. Le brouillon local et la réponse brute synthétique sont effectivement exclus, sans les effacer de la base source. Archive partielle : 18 624 127 octets, 106 entrées de fichiers.

Présentation : **24 configurations** (repas, bannière, diagnostic × 320/390/768/1280 px × texte 100/200 %), sans débordement horizontal et avec commandes d’au moins 44 px. La bannière est injectée uniquement pour mesurer l’affichage ; elle ne constitue pas une preuve de mise à jour réelle. Le refus simulé du presse-papiers affiche le diagnostic sélectionnable, sans texte de recette, note, identifiant ou empreinte privée. Les captures ont conduit à réduire les marges imbriquées du panneau et à corriger le débordement de certains textes/boutons historiques de Réglages.

## 8. Contre-vérifications causales et revues

Root a reproduit puis relu quatre contre-épreuves indépendantes sur B : notification de livraison pendant la vérification, portée initiale incompatible, deux vérifications concurrentes et note modifiée durant la relecture finale. Les défauts initiaux (auto-invalidation, seconde passe acceptant une portée incompatible et quatre décodages simultanés) ont reçu des témoins permanents avant correction. Les résultats finaux gardent le bon état et au plus deux décodages.

La revue C du worker a prouvé que des métadonnées anciennes mal formées pouvaient autoriser un nettoyage : les trois formes null/suffixe texte/saut de ligne sont désormais refusées sans effacement. La revue du démarrage a reproduit l’enregistrement suspendu qui empêchait l’accès au contrôleur déjà disponible ; les délais et recours sont désormais éprouvés. Le générateur a reçu un témoin causal pour les expressions régulières contenant des guillemets, puis la lecture de tous les modules réels. Aucun module métier n’a été réécrit pour contourner le scanner.

La conservation explicite réutilise les gardes montées et vérifie leur portée. Le défaut de seconde boîte de sortie pendant une conservation et le vol de focus après refus tardif du presse-papiers ont chacun reçu leur reproduction puis leur correction. Les résultats complets, le cycle réel A/B et la réception publique restent à ajouter avant de déclarer L10 terminé.


## 9. Réception locale finale — livraison 0.32.0-2

**11498/11498** assertions navigateur (épingle11497), **271/271** tests Node, générateurs migrations et livraison `--check` à0, syntaxe49 fichiers et diff propres. Zéro erreur JavaScript ou requête extérieure. Progression **+236** depuis L9 ; aucun scénario retiré. Les anciens filets de sources lisent désormais le manifeste validé ; le test Aperçus web conserve son blocage réseau métier et utilise le lecteur réseau original pour cet inventaire documentaire. Le contrôle Node du README suit sa nouvelle structure tout en gardant le contrat compte/clé côté serveur. Ces adaptations n’affaiblissent pas les comportements métier testés.

Livraison finale : **208 fichiers, 3 605 171 octets**, SHA256 du manifeste `500570fb449db2090cd7a43d28e0a70e90dca687a9dedbe6d3fc0bea7e83cf86`. `0.32.0-1` n’a jamais été publiée ; le suffixe2 ferme le chargement accessible du démarrage et la largeur du titre repas. Le générateur refuse de réécrire une identité de livraison avec d’autres octets. Les79 nouvelles entrées EN sont intégrées ; le petit recours de démarrage reste en français avant le montage des traductions et des données métier.

| Réception | Résultat et portée |
| --- | --- |
| Ciblés B | 99/99 ; diagnostic, fermetures exactes, médias, concurrence, réessai conditionné, protection d’actualisation |
| Régression synchronisation | 318/318, inventaire adapté, mêmes assertions historiques |
| Ciblés C | 98/98 ; conservation, réponse L6 réellement montée avec quota/fournisseur injectés, formulaires et diagnostic |
| Démarrage | 18/18, dont rouge puis vert du chargement accessible ; reprise après erreur contre-vérifiée |
| Cycle A/B réel | 14 contrôles : deux fenêtres, B incomplète, import tardif A, B en attente, fermeture puis B, éviction/réparation et reload hors ligne |
| Transition historique réelle | 14 contrôles : worker L9 exact, dépendance reçue lors d’un update, ancien cache conservé, adoption explicite et nouvelle livraison après fermeture |
| Application finale réelle | 14 contrôles : première visite, véritable diagnostic copié, cache208 ressources, deux onglets et reload hors ligne |
| Repas réel final | 34 contrôles /5 mesures, ancienne version et candidateB exactes, média exclu, traduction partielle nommée, note/photo/page512×768 décodée après reload hors ligne |
| Présentation | 24 configurations, quatre largeurs et texte100/200 %, captures relues |

Le cycle A/B utilise de petites applications synthétiques avec les vrais modules/protocole ; la transition historique utilise le vrai worker L9 et sa dépendance avec métier synthétique. Ils sont distincts des parcours de la véritable application et de la vraie base de recettes synthétiques. Aucun compte utilisateur ni appel payé réel n’est utilisé.

Le dernier défaut B reproduit était la perte des choix du panneau au refresh de synchronisation : sa protection montée empêche ce remontage et se libère avec **Fermer la préparation** ou à la navigation volontaire, sans déclarer une saisie enregistrée. Quatre rouges causaux puis cinq contrôles verts. La conservation globale refuse honnêtement cette autre protection connue tant qu’elle est présente.

Le démarrage retirait trop tard `aria-busy` : l’écran de connexion était déjà disponible mais restait annoncé occupé. Le témoin causal précède sa correction ; la vraie porte, la vraie application et le reload hors ligne sont maintenant reçus. Le titre d’un plat à320px/texte200% disposait de quelques pixels à côté de sa vignette ; il passe désormais sous la photo avec **124px** de largeur. La preuve historique375px/texte normal reste verte. Captures finales relues par root/B/C.

**APP_VERSION0.32.0, DB6 et archive7 inchangés ; aucune migration SQL.** README et AGENTS décrivent désormais l’inventaire généré et les vérifications exécutables. Publication autorisée par la poursuite/déploiement du contexte ; son résultat doit être ajouté après comparaison des fichiers publics et parcours réels. Aucun essai physique iPhone/Safari/PWA, lecteur vocal, éviction OS ou transfert Cookidoo/TM7 n’est revendiqué.
