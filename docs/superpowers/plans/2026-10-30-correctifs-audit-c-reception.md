# Correctifs de l’audit — lot C

Référence : [plan fourni par Neegan](2026-10-30-correctifs-audit-L0-L10.md), tâche 8 ; [lentille SQL/RLS](../../audits/2026-10-30-audit-codex-L0-L10/lentilles/sql-rls.md). Branche `correctifs-audit-c`, base `402f5bb` (reçu public de B). Le reçu local ci-dessous précédait l’autorisation de publication. Le nouveau « deploy et enchaine ensuite le reste » de Neegan autorise maintenant la publication de C ; **0014 appliquée le 30 octobre à 21:08:02.695270 UTC**, postflight conforme. Voir la réception distante ajoutée en fin de document.

## Périmètre et décisions de construction

Le lot prépare `0014_maintenance_et_bornes.sql`, générée depuis `tools/maintenance-sql.mjs`, avec les corps complets des gardes de maintenance. Les treize migrations historiques restent identiques. Le générateur compose leurs définitions versionnées à la construction, avec bornes de lecture explicites ; le SQL livré contient les corps complets et ne réécrit aucune définition par introspection dans la base cible. Les gardes L1/L2 doivent conserver leurs exceptions L6, L7 et L8 sans réécriture par expression régulière dans la base.

La prélecture a confirmé une insuffisance du pseudocode du plan : poser seulement les deux drapeaux de purge ne permet pas la suppression administrative sans JWT. L6 exige encore le propriétaire authentifié, et L7/L8 vérifient la session avant leur exception de purge. La construction ajoute une dérogation limitée à DELETE, au propriétaire de la fonction administrative, aux deux drapeaux et au compte explicitement ciblé. Aucun JWT du compte n’est fabriqué. Les tests doivent couvrir un compte non admis, un second compte conservé, et les drapeaux forgés par un client.

La suppression administrative prend le verrou du propriétaire ciblé avant les écritures et restaure le contexte de transaction. Une session portant un UID tiers est refusée avant tout verrou (`42501`, `contexte administrateur incompatible`) ; sans JWT ou avec le même UID, l’appel administratif reste possible. La borne de 2 000 compte les verrous distincts de recettes et d’éditions séparément, y compris les éditions dérivées, avant les verrous de lignes. Une précondition refuse la migration si les transferts privés contiennent des propriétaires orphelins ; la migration ne les efface pas silencieusement.

APP_VERSION monte à **0.32.3**, conformément à la règle par lot d’AGENTS.md. DB6/archive7 restent inchangés ; l’application n’acquiert aucune dépendance nouvelle à 0014. La livraison locale **0.32.3-1** compte 212 fichiers / 3 655 921 octets, manifeste SHA256 `41490477c3f91056f4067afec8ca788fce3fc842bdf960883fa3d79ba8301c96`. La version publique reste B **0.32.2-2**.

## Rouges avant correction

Sur PostgreSQL 17.11 UTF8 neuf, migrations 0001 à 0013 : 14 scénarios, 4 verts et 10 rouges. Chaque type de tombale est isolé pour que la première garde ne masque pas les autres :

| Scénario | Résultat avant 0014 |
| --- | --- |
| Recette à cycle | `23514`, `cycle`, garde L1 |
| Édition de livre | `23514`, `cycle`, garde L2 |
| Version de recette | `42501`, `adresse non autorisée`, validation L6 |
| Séance de cuisine | `42501`, `adresse non autorisée`, garde L7 |
| Minuterie | `42501`, `adresse non autorisée`, garde L7 |
| Inventaire | `42501`, `adresse non autorisée`, garde L8 |
| Ensemble des six tombales | Purge annulée |
| 501 lignes / 2 001 verrous | Acceptés indûment |
| Purge administrative | Fonction absente |

Les imports gérés et les séances de scan sont déjà acceptés par leur garde sous l’autorité propriétaire ; aucun faux échec n’est revendiqué pour ces cas. Les limites autorisées 500/2 000 passent. Les semis sont distincts des actes testés et les gardes sont actives au moment de la purge. Preuve : `.superpowers/sdd/2026-10-30-audit-c/preuves-rouges-initiales.json`.

Deux nouveaux tests du générateur sont rouges avant son intégration : `--dir` ne produit pas 0014. Ils doivent ensuite prouver le refus d’un fichier 0014 absent ou modifié. Le contrôle ajouté des treize empreintes historiques est vert.

## Réception finale

La migration générée compte **43 341 octets**, SHA256 **`94b168bb1543ec544a35854b45c09b558342db551eca7ba2ce2c6b5d66c7ab7a`**. Elle a été appliquée exclusivement sur des clones PostgreSQL locaux neufs après 0001–0013.

Le prouveur final compte **35 scénarios** : avant correction, 17 verts et 18 rouges ; après correction, **35/35 verts**, rejoués indépendamment sur un autre clone neuf. Les témoins supplémentaires distinguent la frontière de 90 jours, les tombales récentes et les lignes vivantes, l’idempotence, les dates et séquences inchangées, les deux comptes, les limites combinées et éditions dérivées, les refus client avec drapeaux falsifiés, la purge administrative d’un compte retiré, la restauration du contexte après erreur et les cascades privées.

Les sorties élevées déjà présentes dans L5 et le journal L6 pouvaient masquer la nouvelle dérogation de maintenance. Une modification temporaire du propriétaire de leur helper, dans la transaction jetable annulée, fait atteindre chacune de ces deux gardes : rouges `source_reserved` et `translation_reserved` avant correction, verts après. Les sept gardes ont ainsi un témoin causal. Le semis privilégie les fixtures et désactive certaines gardes seulement pour les insérer ; toutes sont réactivées avant les actes testés.

| Vérification | Résultat reçu |
| --- | --- |
| Scénarios dédiés de maintenance, dont rejoués sur clone neuf indépendant | **35/35** |
| Anciens prouveurs SQL non concurrents | **27/27** |
| Revue indépendante L6–L8, normale puis avec drapeaux falsifiés | **18/18 groupes** |
| Bornes et refus avant verrou de ligne occupé | **10/10** |
| Session administrative tierce | **3 rouges → 3 verts**, refus exact avant les verrous de la cible et du tiers |
| Migration sur transferts orphelins | **7/7**, refus exact `23503` et absence de changement |
| Suite navigateur 0.32.3-1 | **12063/12063**, zéro erreur JavaScript/requête extérieure |
| Ensemble des outils Node | **281/281** |

Le catalogue confirme que les sept gardes conservent intégralement leurs lignes historiques, propriétaire, ACL, `security invoker` et `search_path`. Les dérogations nouvelles sont ajoutées en tête ; les trois exceptions L6/L7/L8 des gardes L1/L2 restent présentes. La contre-épreuve sur transfert orphelin vérifie les contenus privés, fonctions et droits, contraintes et tâches cron inchangés ; la nouvelle fonction administrative n’est pas installée après l’échec.

Une première version de la fonction administrative acceptait un JWT tiers et attendait son verrou : les trois témoins rouges ont précédé le refus précoce. Après cette correction, les groupes sans rapport n’ont pas été répétés ; la différence finale est limitée à cette garde et aux délais de migration. Le prouveur de maintenance et les 27 anciens prouveurs ont porté sur le SQL final.

Node gagne trois tests : génération de 0014, refus d’une sortie absente ou modifiée, empreintes des treize migrations antérieures. La première suite globale affichait 280/281 parce qu’un ancien test de documentation attendait encore « cinq migrations générées » ; l’attente a été actualisée à onze, comme le README demandé par le plan, puis **281/281** reçus. Aucune assertion navigateur ajoutée ou retirée, épingle 12062 inchangée ; seules les épingles de version changent.

Générateurs, syntaxe et diff conformes. Aucun changement applicatif métier ni de schéma IndexedDB. Le lot n’exige pas d’appel réel à l’assistant et aucune session privée n’est utilisée.

## Rejouer et retrouver les preuves locales

Cluster distinct sur `127.0.0.1:55449`, propriétaire `postgres`, répertoire `.superpowers/sdd/2026-10-30-audit-c/postgres` ; le cluster historique 55439 n’est pas modifié. Le prouveur contrôle le nom de clone, le port, le propriétaire, l’encodage et le répertoire réel avant toute mutation. Le socle `mistu_audit_c_0013` est refusé comme cible du prouveur et conservé intact.

Sur un clone local contenant les treize migrations historiques puis 0014, la commande est :

```sh
MISTU_PSQL=/chemin/local/psql node tools/prover-purge-tombales.mjs mistu_audit_c_vert
```

Cette commande n’accepte que le cluster de preuve attendu. Le préparateur local `.superpowers/sdd/2026-10-30-audit-c/preparer-postgres.mjs` crée les fixtures et clone ce socle ; il reste un harnais de réception ignoré par Git. Le lanceur général rejouable `tools/prouver.sh` reste prévu au lot G. `supabase/proofs/0014_maintenance.sql` est appelé par le prouveur dans sa transaction annulée et ne doit pas être collé sur le serveur.

Les identités Auth et Storage sont des fixtures locales. `cron.schedule` enregistre les tâches dans une table de preuve : la commande et son unicité sont contrôlées, mais aucun ordonnanceur réel n’est revendiqué. Les scripts mutateurs ne sont jamais envoyés au serveur.

Preuves dans `.superpowers/sdd/2026-10-30-audit-c/` : `preuves-rouges-finales.json`, `preuves-vertes-finales.json`, `application-vert.json`, `migrations-avant.json`, `regressions-root.json`, `preflight-orphelin.json`, `revue/reception-independante.json`, `suite-locale.log`, `generateur-rouge.log`, `node-final.log`. Les empreintes 0001–0013 sont aussi épinglées dans le test du générateur.

## Geste distant restant au reçu local (historique)

**0014 écrite, non appliquée : geste de Neegan, après son postflight de 0011–0013.** La procédure est dans [supabase/README.md](../../../supabase/README.md), étape 15. Les traces historiques de 0011–0013 ont été rapprochées dans [RESULTATS-mitsu.md](../../../supabase/proofs/RESULTATS-mitsu.md), avec des sections explicitement laissées à compléter par Neegan pour le contrôle actuel. Ce rapprochement documentaire n’est pas une nouvelle vérification du serveur.

**Lot C terminé localement, non publié.** Le code et les preuves sont prêts pour relecture ; les lots D à G restent à traiter. La version publique demeure B 0.32.2-2.


## Publication du lot C

Sur l’autorisation « deploy et enchaine ensuite le reste », **0014 appliquée le 30 octobre 2026 à 21:08:02.695270 UTC**. Sauvegarde quotidienne Supabase `COMPLETED` à 06:29:06.782 UTC ; préflight complet de 0001–0013 conforme. Une différence de locale dans le tri du harnais a été isolée en lecture seule, puis corrigée par `COLLATE "C"` explicite ; aucun SQL métier n’a changé. Application atomique avec gardes de catalogue avant/après, puis postflight dans une transaction distincte : **zéro écart produit**, droits serveur supplémentaires distingués, deux FK privées validées, nettoyage des transferts actif à 04:30 UTC. Revue indépendante **10/10**. [Reçu SQL détaillé](../../../supabase/proofs/RESULTATS-mitsu.md).

Code **`98a02d3740e1a75d311891c40d835935473e6ce3`** promu par avance rapide et publié ; Pages construit à **21:08:49 UTC (17 h 08 HAE)**. **0.32.3-1**, manifeste et 251 fichiers publics identiques au commit, octets/empreintes/MIME conformes. **Suite publique complète 12063/12063**, identique au bilan local, release 0.32.3-1 vérifiée. Zéro exception JavaScript et zéro requête extérieure.

Parcours public ciblé **13/13**, deux mesures 390/1280 sans débordement et quatre captures relues : démarrage, cache exact de 212 ressources plus métadonnée séparée, API native de persistance appelée une fois et refus correctement affiché, deux onglets, recette et note conservées après rechargement réellement hors ligne. Zéro erreur JavaScript/requête extérieure. Les 105 scénarios simulés de B ne sont pas attribués à cette nouvelle réception. Aucun compte privé, appel payé ou appareil physique utilisé.

Preuves : `.superpowers/sdd/2026-10-30-audit-c/publication/`, `publication-fichiers.json`, `reception/public-c.resultat.json`, quatre PNG et `parcours-public.log`. La construction autorisée se poursuit avec D, puis E–G.


### Bilan final de la suite publique

La passe complète finale compte **12063/12063 assertions réussies** en 174,9 s ; aucune erreur HTTP ni reprise d’import pendant cette passe. Le premier lanceur avait dépassé 600 s sans bilan. Une relance diagnostique a ensuite montré un **HTTP503** sur `recipe-edit.js`, empêchant toute évaluation des tests ; elle a été arrêtée explicitement sans lui attribuer de résultat. Après retour HTTP200, la dernière passe a chargé le graphe et exécuté toutes les assertions. Le harnais diagnostique dispose maintenant de trois tentatives bornées pour les imports JS/CSS avant démarrage, avec arrêt immédiat si elles échouent ; aucune source locale n’est substituée aux fichiers publics.

Deux messages console `ERR_FILE_NOT_FOUND` concernent des URL `blob:` d’images détruites par les fixtures. Le ciblé **SyncL4 figé au commit C, 403/403**, reproduit exactement ces deux messages : cas « séance — bouton groupé… abonnés qui ne survivent pas à l’écran », création puis révocation par le MutationObserver de `photos-visibles.js` lorsque le test remplace/retire ses vues. Les piles création/révocation et les URL exactes sont conservées dans `preuve-blobs-sync-l4.json`. Ce sont deux messages réseau de destruction de fixtures, pas des exceptions JavaScript ni des échecs d’assertion. Le reçu brut diagnostique garde son drapeau global `success:false`, car ce nouveau harnais classait encore ces messages comme inattendus ; il n’a pas été réécrit pour masquer l’observation.

Réception finale : bilan navigateur **12063/12063**, parcours public **13/13**, fichiers **251/251**. Traces supplémentaires : `suite-publique.log` (timeout initial), `suite-publique-503.log`, `suite-publique-diagnostic.log`, `suite-publique-diagnostic.resultat.json`, `preuve-blobs-sync-l4.json`. Les limites physiques iPhone/Safari et les tâches cron futures restent celles du reçu ci-dessus.
