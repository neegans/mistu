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
