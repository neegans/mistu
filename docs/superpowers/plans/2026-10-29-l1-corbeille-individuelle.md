# L1 — construction et preuves de la corbeille individuelle

29 octobre 2026. [Spec approuvée](../specs/2026-10-29-l1-corbeille-individuelle-design.md) sur « ok ».
Branche `l1-corbeille-individuelle`, base de spec `cf539fb`, contenant L0 `9c823b0`.
Version construite localement : application 0.23.0, IndexedDB 5, archive 2 (lecture 1 et 2), cache `cuisine-os-v0.23.0-1`.
La construction était initialement locale. Neegan a ensuite autorisé la publication sur « deploy avant » ;
application 0.23.0 et migration 0008 publiées le 29 octobre, détails ci-dessous.

## Construction

- Domaine de cycle strict, retrait et restauration conditionnés, identifiant d’opération conservé et Annuler limité au retrait concerné.
- Index local `recipes.trashed_at` utilisé pour la corbeille ; états mal formés consultables dans À vérifier.
- Garde commune du dépôt : cycle, existence, propriétaire et génération du geste, y compris pour les enfants seuls et les suppressions.
- Contexte pris avant un formulaire, une image, un dialogue ou un appel assistant. Les octets préparés et leur lien sont enregistrés ensemble.
- Bibliothèque active séparée des données historiques. Les préparations nouvelles excluent les recettes retirées ; les anciennes sessions, courses et observations restent utilisables.
- Résultats payés conservés dans le journal après retrait. Une nouvelle relecture explicite est nécessaire après restauration ; une relecture dans un autre onglet ne valide pas l’ancien formulaire.
- Commandes de synchronisation distinctes des écritures de contenu, accusés liés aux opérations, barrières sur les écritures dépendantes et arbitrage du cycle séparé des dates de contenu.
- Copies des conflits consultables dans Réglages. L’abandon d’une intention de recette réconcilie le dernier état confirmé. Les copies des enfants refusés restent conservées et bloquées ; les modifications voulues sont reprises explicitement depuis la fiche.
- Export complet en archive 2 ; refus intégral d’une fusion ou d’un remplacement divergent, y compris les collisions de clés d’enfants et les changements entre inspection et transaction.
- Migration additive `0008_corbeille_recettes.sql`, générée sans réécriture des anciennes migrations. Aucun nouvel outil assistant ni dépendance de l’application.

## Méthode et preuves locales

Les tests de cycle, archives, écrans et synchronisation ont été écrits rouges puis relus verts.
La revue croisée a ajouté des scénarios adverses : mutation de l’objet pendant une capture, suppression par transition,
réattribution d’un enfant dans une archive valide, arrivée sous un autre propriétaire, changement de cycle pendant un dialogue,
barrière de file en recul/quarantaine et validation SQL des valeurs nulles ou mal formées.
Après déconnexion, les boutons suivent le propriétaire des données et sa capacité serveur confirmée :
sans preuve de compatibilité ils restent désactivés avec une explication ; une capacité connue permet les gestes locaux.

Les fixtures anciennes déclarent désormais leurs créations et sèment leurs parents réels. Les espions de photos observent
l’écriture atomique des octets et du lien ; ils n’attendent plus un appel `putFile` séparé. Les assertions de version,
d’index local et de commandes disponibles suivent le nouveau contrat. Aucune assertion de régression n’a été supprimée.

Les preuves exécutées sont conservées localement dans `.superpowers/sdd/2026-10-29-l1/` (répertoire ignoré par Git).
Les tests reproductibles sont dans `tests/l1-corbeille-*.js`, `supabase/proofs/0008_corbeille_recettes.sql`
et `supabase/proofs/0008_corbeille_concurrence.cjs`.

**Bilans relus : navigateur 7656/7656**, épingle 7655, +259 assertions depuis L0 sans retrait ; **Node 231/231**,
générateur `--check` 0, syntaxe de 93 fichiers et diff propres. Suites L1 : domaine 61, archives 24,
synchronisation 58, écrans 79, mutations 30. Régressions sync L3 538/538 et L4 403/403.
Les cinq dimensions contrôlées sont 320, 390, 768, 900 et 1280 pixels ; le texte à 200 % ne déborde pas.
Le retrait au clavier a été exécuté ; les captures corbeille/fiche retirée ont été relues.
Zéro erreur JavaScript ou requête externe dans la suite et les parcours navigateur.

| Preuve | Portée |
|---|---|
| `parcours/resultat.json`, captures associées | Application réelle, profil jetable : retrait, fermeture/rechargement, restauration, photos/notes intactes, ancien éditeur sur un second onglet refusé, corbeille hors ligne et modules présents dans le cache |
| `migration-ancien.resultat.json` | Vrai code L0 `9c823b0` en 0.22.0/DB4, éditeur ouvert ; nouveau code en DB5, ancien ouvreur refusé par `VersionError`, saisie et données conservées |
| `l1-corbeille-sync.js.resultat.json` | 58 assertions ; trois vraies bases et trois moteurs, concurrence hors ligne, commandes et accusés perdus, archive sur un troisième appareil puis connexion, photos conservées ; transport et Storage simulés |
| `sql-preuve.log` | 42 assertions PostgreSQL 17 local jetable, rôles authentifiés/RLS, RPC anciennes et nouvelles, protections SQL des écritures directes, enfants, archives et effacement global |
| `sql-concurrence.resultat.json` | Deux connexions PostgreSQL concurrentes : attente observée dans `pg_locks`, une commande acceptée, l’autre refusée sur sa base périmée |
| `suite.resultat.json`, `suite-finale.log`, `node-final.log` | Navigateur 7656/7656 ; Node 231/231 ; bilan complet après gel des fichiers et mise à jour de l’épingle |

L’environnement SQL est local, construit à partir des binaires officiels de [Postgres.app](https://postgresapp.com/downloads.html).
La base de test utilise une identité synthétique, des fonctions d’authentification de test et un substitut local pour la planification `pg_cron` des anciennes migrations.
Les triggers, verrous, transactions et politiques de la migration L1 sont réellement exécutés par PostgreSQL ; le serveur JavaScript simulé ne remplace pas cette preuve.
Le cluster a été arrêté et le volume de binaires démonté après les essais. L’intégration PostgREST, Auth et Storage
Supabase distante n’a pas été exécutée par cette preuve locale.

## Publication du 29 octobre 2026

Autorisation : « deploy avant », puis « et enchaine sur le restant des lots ».
Sauvegarde physique de 06:29 UTC observée `COMPLETED`, préflight en lecture seule puis migration 0008 exacte
appliquée une fois en transaction avec délais bornés et notification PostgREST. Postflight : 7 corps de fonctions
exacts, 9 triggers avec RLS, droits attendus, capacité 1 sous rôle `authenticated` autorisé. Les deux RPC refusent
les requêtes HTTP anonymes en 401/42501. Aucun contenu métier lu ou modifié.
[Résultats serveur](../../../supabase/proofs/RESULTATS-mitsu.md).

Code `52338ec` intégré en avance rapide dans `main` ; GitHub Pages construit à 20:09 UTC (16 h 09 HAE).
Public **0.23.0**, **59 fichiers** identiques, **7656/7656** tests navigateur. Le parcours public vérifie traduction
partielle, heure répétée Toronto, courses, note/photo ajoutées par l’interface, retrait/restauration, ancien éditeur
refusé, huit modules en cache et hors ligne. **26 mesures** sans débordement ; zéro erreur JS/requête externe.

La relecture visuelle a révélé un texte littéral `null` dans courses/cuisine pour les recettes actives.
Le correctif **0.23.1** filtre les mentions absentes sans retirer celles des recettes dans la corbeille.
Huit assertions supplémentaires : **7664/7664**, épingle 7663, Node **231/231**. Répétition locale : **31 mesures**,
zéro texte parasite, débordement, erreur JS ou requête externe. Le harnais de suite utilise 1280 px comme le runner
historique : le test de comparaison attend sa variante tableau, la variante en cartes à 390 px n’est pas un défaut.

Traces : `.superpowers/sdd/2026-10-29-l1-publication/`, dont `migration-0008.log`, `postflight-0008-resultat.json`,
`postgrest-anonyme.json`, `pages-build-code.json`, `fichiers-publics.resultat.json`, `public/suite.json`, `public/parcours.json`.

## Contrôles de publication et essais physiques

1. Conserver une sauvegarde du compte et relever la version réellement installée sur les deux appareils.
2. Migration et capacité vérifiées sur autorisation de publication, comme décrit ci-dessus.
3. Application L0+L1 publiée ; fichiers publics, cache, version et bilan navigateur vérifiés.
4. Vérifier le parcours sur un iPhone/Safari physique et deux appareils du même compte : retrait hors ligne, reconnexion, convergence, restauration, note et photo conservées.

Ne pas rétrograder une bibliothèque DB5 avec une ancienne application. Conserver la protection serveur du cycle même lors d’un retour arrière du logiciel.
Les tests sur le compte privé, le matériel physique et le service de production ne sont pas remplacés par les preuves locales.

## Limites

L1 porte sur les recettes autonomes. Les livres, groupes, suppressions multiples et purges restent hors de ce lot.
La traduction automatique complète et les refontes des lots suivants ne sont pas livrées par cette corbeille.
Aucun vrai appel assistant, JWT utilisateur emprunté ou contenu de compte privé consulté.
La migration et le site sont publiés ; l’échange HTTP authentifié et Storage restent à vérifier sur les appareils réels.
Les captures mobiles sont des dimensions de navigateur de bureau, pas une validation de Safari/iPhone physique.
Le lecteur d’écran n’a pas été testé. La réception multiappareil exige encore les essais physiques décrits dans la spec.
