# L5 — Sources et index : construction et réception

Base publique : code `39a890a`, reçu `db085ee`, application 0.26.0. Branche `l5-sources-index`.
[Contrat](../specs/2026-10-29-l5-sources-index-design.md).

La poursuite et la publication sont autorisées par les demandes de Neegan « et enchaine sur le restant des lots » puis « continu ».
La revue technique du contrat ne constitue pas une relecture personnelle de Neegan.

## Construction

1. Figer les projections, commandes et vecteurs communs JavaScript/SQL après revue croisée.
2. Écrire les reproductions rouges : identité d’image, résultat exact, reprise sans nouvelle dépense, absence de doublons et limites.
3. Construire les révisions et le transfert atomique : domaine, dépôt, archive4, file de synchronisation et migration additive0010.
4. Conserver chaque réponse d’index avant le prochain appel ; appliquer les références par portions gardées et reprenables.
5. Raccorder Importer, miniatures, éditeur, livre et classement à la sélection active et aux sources historiques exactes.
6. Vérifier les parcours réels, la réception entre appareils simulés, les archives, les limites et la concurrence PostgreSQL.
7. Compléter la réception, les documents et la publication autorisée, puis contrôler les fichiers et le site publics.

Répartition : A possède formats/domaine de révisions/dépôt/DB/archive/synchronisation/SQL ; B possède lectures d’index/consolidation/application et panneau Index ; C possède écran Importer et panneau de révisions ; intégration possède lecteurs secondaires, orientation commune, styles, traductions, versions et réception générale.

## Cible

Application 0.27.0 ; cache `cuisine-os-v0.27.0-1` ; DB6, archive4. Aucun nouveau magasin synchronisé.
Migration0010 à tester localement avant publication. Ne jamais réappliquer0009 en production.
Aucun compte privé ni appel assistant réel dans les tests ; réponses injectées et bases jetables.

## Réception locale

Les révisions d’image ont des identifiants immuables. Rotation, remplacement, sélection et retrait conservent les originaux et les lectures déjà payées. Le rattachement copie le graphe avec provenance vérifiée ; les anciennes recettes gardent leurs pages. Les pages sans document issues des anciennes versions restent consultables.

La lecture conserve chaque résultat avant l’appel suivant. Les deux moitiés peuvent donner1200 entrées, toutes conservées ; l’application se fait par portions gardées, avec décision et reçu exacts. La clôture porte sur les occurrences réellement résolues. Reprendre l’enregistrement ou comparer les sources ne relance pas l’assistant. Les réponses restent conservées même si l’écran se ferme.

La réception serveur conserve séparément les sources confirmées et les modifications locales refusées. Le choix explicite et la récupération après rechargement sont éprouvés, y compris une chaîne de gestes. Un complément après réponse payée ouvre une nouvelle lecture confirmée ; l’ancien résultat et ses images restent exacts. La première connexion peut rattacher les transferts historiques jamais envoyés, sans adopter un propriétaire de journal ou une décision payée.

### Preuves causales et volumes

- Sources, classement et lecteurs : rotation réelle dans les deux modes de miniature et l’éditeur ; sélection modifiée avant clic, pendant transaction et retirée puis remise. Anciennes recettes et versions exactes.
- Index :600 références en deux portions et1200 en trois ; plein format coupé puis deux moitiés, quota/reprise, réconciliation explicite, fermeture de vue, décision d’un autre journal et même titre sur pages différentes.
- Archives :64 assertions, incluant formats1–4, copies entre éditions, parents/familles/opération exacte, images historiques sans document, résultat Unicode fragmenté, journal inline clos, références déjà complètes, collisions et course avant commit. Quatre défauts de copie et une identité de capture erronée reproduits rouges avant correction.
- Compléments :28 domaine +13 écran ; anciennes réponses payées et saisies préservées. Relecture legacy après restauration :45 assertions, dont trois nouvelles gardes et un refus concurrent sans erreur JavaScript.
- PostgreSQL : installation UTF8 neuve0001→0010. Fixture auth/storage locale, remplacement uniquement de pg_cron par un ordonnanceur inactif ; aucun test de planification réelle revendiqué. 327 assertions sur cette base : canon71, lecture/résultat64, protections67, index30, volumes12, transferts27, révisions20, copies7 et archives29. Deux vraies connexions simultanées passent10 contrôles supplémentaires : attente du verrou observée, seconde base ancienne refusée et aucune écriture perdue. Les protections tentent réellement les écritures réservées, les quatre anciennes entrées RPC, les marqueurs GUC forgés et l’effacement volontaire du seul propriétaire.
- Comparaison indépendante :369 vecteurs JavaScript/PostgreSQL concordants ; revues du parent externe, d’une réponse déjà payée inline/fragmentée et de la restauration historique. Les refus ont leur motif attendu et leur témoin admissible.

Les outils de preuve SQL génèrent leurs fixtures via les planners suivis dans Git ; aucun fichier ignoré n’est requis. Node232/232 et générateur0 sont vérifiés. Suite mesurée après gel :9471 contrôles fonctionnels réussis, seule l’ancienne épingle était rouge. Épingle portée à9471 ; dernière relance **9472/9472**, zéro erreur JavaScript/requête extérieure, soit592 contrôles de plus que L4 sans retrait de scénario. Syntaxe91 fichiers et diff propres.

La preuve indépendante de transfert utilise deux vrais createMoteur et la RPC PostgreSQL locale sous rôle authenticated. Même archive avec501 pages originales et501 copies, journal sans livre, file normale puis volontairement inversée :10 commandes/11 appels, confirmation finale perdue puis rejeu reconnu, aucun refus/conflit. Le second moteur reçoit1009 lignes et sa passe suivante ne produit ni effet ni renvoi. Cette preuve porte sur le graphe et les métadonnées, sans transfert de fichiers photo. Les photos réelles sont couvertes par le parcours hors ligne ci-dessous.

### Parcours et présentation

Parcours Chrome avec service worker réel :16 mesures à320/390/768/1280, texte200 %,12 gestes, zéro débordement, erreur JavaScript ou requête extérieure. Rotation/remplacement/retrait/annulation, historique, deux onglets et reprise avec parent exact. Après coupure réseau et rechargement complet : images décodées, révisions et références historiques intactes. Douze modules nouveaux présents dans le cache unique0.27.0-1. Captures390 et historique320 ouvertes et relues.

Parcours de comparaison après refus transport injecté :12 mesures, trois choix, vrai moteur d’envoi, rechargement et récupération. Aucun appel serveur réel dans ces parcours. Maquettes d’import mobile/web et fiche Pain relues ; grille mobile lisible, une colonne quand largeur/texte l’exigent, rotation sans double transformation.

### Vérifications et limites

Aucun appel assistant réel, compte privé, JWT utilisateur ou donnée de recette serveur consultée. Les essais physiques iPhone/Safari et Cookidoo/TM7 restent non attestés. PDF/EPUB conservés avec limite de lecture et chemin manuel annoncés ; aucun rasteriseur automatique ajouté.

Les migrations0001–0009 restent identiques. Aucun cron supplémentaire ni purge automatique de données/fichiers. L’archive n’exporte pas les brouillons internes. Le registre de transfert est privé, avec rétention et nettoyage bornés explicites.

### Publication

Pas encore effectuée. Précontrôle distant en lecture seule : projet mitsu actif ; cinq définitions serveur de base identiques à0009 locale, aucune fonction L5. Sauvegarde physique du29octobre06:29UTC terminée. La migration0010 sera appliquée une seule fois sous transaction et contrôle de la base exacte, puis le site publié et vérifié.

Preuves locales ignorées par Git : `.superpowers/sdd/2026-10-29-l5/`. Rapports de revue B et C, scripts causaux, résultats PostgreSQL, captures, traces et reçus de publication y sont conservés. Le travail L6–L10 et E1 reste à réaliser après cette livraison.
