# Correctifs de l’audit — lot A

Base de travail : `169a08e` (audit et plan reçus après la livraison0.32.0-7). Branche `correctifs-audit-a`. Référence : [plan d’exécution](2026-10-30-correctifs-audit-L0-L10.md), tâches1 à5, et [rapport d’audit](../../audits/2026-10-30-audit-codex-L0-L10/rapport-audit.md), §0,2,3. Le plan impose une publication par lot sur un « go » distinct ; ce reçu prépare le lot A pour cette décision, sans publication ni modification serveur.

Le lot traite la résolution des conflits, la conservation et la récupération des imports gérés, la copie des éditions hors ligne refusées pour un changement de cycle, la lecture des minutes après les heures et les avertissements avant cuisson. Les tâches sont exécutées dans l’ordre, avec preuve d’échec avant correction. Les prélectures et revues indépendantes peuvent se dérouler en parallèle.

Baseline :11684 assertions navigateur. Le nombre final et ses deltas seront mesurés. Les tests Node couvrent les outils ; ils ne remplacent pas les essais de l’application. Aucun scénario physique sur iPhone, compte privé ni appel assistant payé n’est revendiqué.

## Tâche1 — conflits

Six reproductions rouges : Ici/Ailleurs sur recette, suppression locale conservée, import Thermomix, édition de livre et purge de deux conflits ; tous échouaient sur le doublon `sync_state/user_id`. Le test historique de changement de compte était également rouge avec son motif exact.

`fusionnerConditions` compose les gardes de même clé et les contrôles de magasin, dans leur ordre et sur le même instantané transactionnel. Une garde sans écriture conserve l’écriture de l’autre fusion. Deux écritures concurrentes de la même fiche sont refusées explicitement ; aucun appel actuel ne les produit. Les protections sources et métier restent actives.

Nouveau module **35/35** ; régressions imports67/67, sources22/22 et réception37/37. Suite complète **11719/11719**, soit+35. Première passe11718/11719 : une ancienne épingle de version dans `sync-l3.js` attendait encore0.32.0 ; corrigée pour0.32.1 puis suite entière rejouée, sans retirer d’assertion. Node271/271, syntaxe, deux générateurs et diff conformes.

Parcours Chrome profil neuf, modules réels, vrais boutons Réglages : **49/49** à320/1280, choix Ici/Ailleurs, fiche puis rechargement ; seule la copie locale repart en file, version culinaire originale intacte. Zéro erreur JS/HTTP/requête extérieure. Captures relues par l’agent de réception ; lisibilité des colonnes à320px insuffisante, constat consigné pour le lotF sans modification d’interface dans T1.

Préparation locale0.32.1-1,208 fichiers /3 637 897 octets, empreinte `a08fe2a870360eca39c7ccc79cf0c208e3739230b9b452a6c9b48724ecd58fa6`. Preuves dans `.superpowers/sdd/2026-10-30-audit-a/t1-*.log` et `parcours-conflits/`. Aucun push ni changement serveur. Tâches2–5 encore à exécuter.

## Tâche2 — imports gérés et récupération

La reproduction avant code atteint la suppression du manifeste, de ses fragments et d’un journal de traduction, avec émission de tombales. Elle atteint aussi les courses entre sélection et purge, puis entre remise à zéro du curseur et réception déjà en vol.

Le prédicat protège tous les marqueurs présents dans les gardes SQL, même si leur valeur est nulle : le plan initial n’en énumérait qu’une partie. La purge recontrôle le corps de la ligne dans sa transaction. La réparation au démarrage retire les suppressions interdites du même compte et remet une seule fois le curseur des imports à zéro. Elle préserve les autres opérations, les réponses brutes et les données locales plus récentes. Le marqueur est vérifié avant de charger la file et les brouillons lors des lancements suivants.

Deux compléments nécessaires au plan : les suppressions gérées encore en attente sont aussi retirées, sinon elles seraient mises en quarantaine après consommation du marqueur ; la réception contrôle ce marqueur dans sa transaction et reprend au plus deux fois depuis le curseur réparé. Une reprise ne change jamais le propriétaire de la requête d’origine.

Nouveau module ciblé **86/86**. Contre-épreuves indépendantes **17/17** : compte/époque changés avant mutation, réponses pleine et vide parties de50 reprenant depuis0, absence d’écriture d’une ancienne réponse après changement de compte. La fenêtre de changement de compte introduite par la nouvelle lecture asynchrone a été reproduite puis fermée avant commit. Preuves `t2-*.log`, `revue-t2-owner-rouge.json`, `revue-t2.resultat.json`. Suite complète **11805/11805**, soit+86 depuis T1 ; zéro erreur JavaScript/requête extérieure. Régressions ciblées import-cible712/712, synchronisation538/538, reprise46/46. Syntaxe et générateur conformes. Préparation0.32.1-2,209 fichiers /3 643 609 octets, empreinte `b18418a7902f9b6c26e0fffe439111dbda24c5249e3cecfaa9b3884872143c1f`. Tâches3–5 restantes ; aucun push ni changement serveur.

## Tâche 3 — copie hors ligne et conflits de cycle

Les tests rouges reproduisent la perte de l’instantané des recettes/éditions, son remplacement par une copie serveur et l’écrasement d’un conflit déjà présent. La correction capture les deux magasins et choisit la plus grande séquence du lot dédoublonné : `seqs[0]` proposé dans le plan pouvait désigner une modification plus ancienne.

La protection transactionnelle couvre les réceptions, les envois ordinaires, les commandes de cycle, les lots de sources et les créations non adoptées. Une suppression de conflit après accusé est conditionnée ; si le conflit change, le rangement local reprend au plus trois fois, sans nouvel envoi et avec le propriétaire d’origine. Les contre-épreuves ont aussi reproduit puis fermé la course de changement de compte pendant cette reprise.

Nouveau module **43/43**, contre-épreuves indépendantes **20/20** (9 rouges avant correction), régressions corbeille58/58 et reprise46/46. Suite complète **11848/11848**, soit+43 ; zéro erreur JavaScript/requête extérieure. Preuves `t3-*.log` et `revue-t3.apres.json`. Syntaxe, diff et générateur conformes. Livraison locale **0.32.1-3**,209 fichiers /3 645 099 octets, SHA256 `8dc3e8f0b945384bbf455afc4a83c6e71c3e97f12a92e5b29141f1f836f64983`. Tâches4–5 restantes, aucune publication.

## Tâche 4 — minutes après les heures

Neuf échecs causaux avant correction, dont « 1 h 30 à 180 °C » réduit à3600 secondes. Le parseur accepte maintenant les minutes abrégées devant une préposition, avec une borne de0 à59. Les unités explicites de quantité/température et les plages de durées restent indépendantes. La lecture explicite de60/99 minutes est conservée ; une abréviation sans unité au-delà de59 n’est plus assimilée à des minutes.

**31 assertions ajoutées**, ciblé cuisine143/143 et contre-épreuves indépendantes26/26. Suite complète **11879/11879**, zéro erreur JavaScript/requête extérieure. Preuves `t4-rouge.log`, `t4-vert.log`, `t4-suite.log`, `revue-t4.resultat.json`. Syntaxe, diff et générateur conformes. Livraison locale **0.32.1-4**,209 fichiers /3 645 498 octets, SHA256 `9ef27076ae60fb75e2d2180bfd5ba3b0c38738d63755072b34cbadd30a3e94d8`. Reste la tâche5 ; aucune publication.

## Tâche 5 — avertissements avant cuisson

Avant code : le nouveau module pur était absent et six contrôles d’écran échouaient, notamment la présence du rappel, son maintien après quota et la version exacte de la séance. Le bloc montre maintenant les attentes écrites et les durées longues, une ligne par étape. Il n’utilise que les versions exécutables choisies dans la séance : aucune instruction Thermomix bloquée n’est réintroduite. Une étape réellement faite dans n’importe quelle recette du repas retire le bloc ; une preuve héritée ambiguë ou un échec de stockage ne le retire pas. Le contrôleur de minuteries reste monté.

Ciblés cuisine **159/159**, écran **75/75** ; contre-épreuves indépendantes T4/T5 **40/40**. **34 assertions ajoutées** depuis T4 :16 de domaine,15 d’écran et3 contrôles d’inscription du nouveau module. Suite complète **11913/11913**, zéro erreur JavaScript/requête extérieure. Node **271/271**, syntaxe et deux générateurs `--check` conformes. Preuves `t5-pur-rouge.log`, `t5-ecran-rouge.log`, `t5-*-vert.log`, `t5-suite.log`, `t5-node.log`, `revue-t4-t5.resultat.json`.

Parcours sur la vraie route de cuisine, profil Chrome neuf et base jetable : **29/29 contrôles,4 mesures**. Captures320/390/1280 et reprise hors ligne390 relues ; rappel lisible sans débordement horizontal. La minuterie créée garde5400 secondes. Le quota atteint le vrai commit de progression et conserve le rappel ; le réessai réussi le retire dans les deux onglets. Le rechargement réellement hors ligne garde l’étape2/3, la note et l’identité/échéance du suivi. Le nouveau module est présent dans le cache de la livraison attendue. Reçus et captures : `.superpowers/sdd/2026-10-30-audit-a/parcours-cuisine/`.

## État final du lot A

**Les tâches1–5 sont terminées localement et commitées séparément sur `correctifs-audit-a`.** Livraison préparée **0.32.1-5**, APP_VERSION0.32.1, DB6/archive7 inchangés. Manifeste généré : **210 fichiers /3 647 407 octets**, SHA256 `5f24df4ab32bb6e0362fdd458ee5ed6ea915cfff487a080b2ddb6751652a3cd2`.

Bilan navigateur : **11913/11913**, soit **+229** depuis11684 :35+86+43+31+34. Aucune assertion existante supprimée dans ce lot ; les épingles de version et l’attente du motif exact de changement de compte ont été ajustées. Ce constat porte sur ce lot seulement et ne remplace pas le relevé historique des scénarios modifiés dans l’audit. Node271/271 couvre les outils ; les parcours décrits ci-dessus couvrent l’application.

**Aucun push, aucune migration SQL ni modification serveur.** Dernière livraison publique reçue :0.32.0-7. Le lot A attend le « go » explicite par lot prévu par le plan avant promotion/publication. Les lotsB àG restent à exécuter ; la migration0014 du lotC sera écrite seulement. Les essais sont locaux, avec transports simulés lorsque nécessaire : aucun compte privé, appel assistant payé, essai physique iPhone/Safari ou alarme système n’est revendiqué.
