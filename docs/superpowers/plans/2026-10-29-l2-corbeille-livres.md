# L2 — construction et réception de la corbeille des livres

29 octobre 2026. [Spec](../specs/2026-10-29-l2-corbeille-livres-design.md) écrite sous l’autorisation
« et enchaine sur le restant des lots », puis revue techniquement. Neegan n’est pas présenté comme ayant déjà relu ce texte.
Branche `l2-corbeille-livres`, base initiale `752566d`. Correctif urgent public **0.23.2** `5412745`
intégré par `74af562` avant la reprise L2 ; documentation publique `5b1c5fa` conservée.

## Construction reçue localement

| Bloc | Résultat à vérifier |
|---|---|
| Domaine et dépôt | Cycle d’édition, deux bases capturées, retrait/restauration, exception individuelle, bilan revalidé et C09 fermé |
| Mutateurs | Livre, couverture, import, index et sources ne réappliquent pas un ancien geste ; journaux conservés |
| Écrans | Deux choix compréhensibles, corbeille groupée, restauration d’un membre, historique et sources lisibles |
| Synchronisation et SQL | Capacité distincte, dépendances parent/membre, accusés exacts, conflits durables et protection des anciens clients |
| Archives | Format3 complet, lecture1/2, parent et exception validés, divergence refusée avant toute écriture |
| Réception | Trois moteurs, SQL réel, vrai passage DB5→6, application hors ligne, clavier et dimensions représentatives |

Les tests rouges précèdent les changements de comportement. Les contrats partagés sont coordonnés avant les modifications
du dépôt et du transport. La migration0009 est additive ; les migrations0001–0008 déjà appliquées restent inchangées.
Les journaux de preuve seront conservés dans `.superpowers/sdd/2026-10-29-l2/` ; les résultats exécutés seront consignés ici.

## Versions et limites

Cible : application0.24.0, cache `cuisine-os-v0.24.0-1`, DB6 pour l’index `book_editions.trashed_at`, archive3.
La version publique reste **0.23.2**. Les preuves ciblées ci-dessous ne valent pas encore réception globale ni publication L2.
Les essais physiques iPhone/Safari, lecteur d’écran et deux appareils réels devront être distingués des preuves automatiques.
Les lots L3–L10 et l’expérience E1 restent à réaliser ; leur périmètre est rappelé dans la spec.

## Reprise et contrôles ciblés

Les fichiers L2 antérieurs au correctif urgent sont conservés dans une sauvegarde avec empreintes et un stash ;
les six conflits de réintégration ont été résolus en gardant les protections 0.23.2 et celles des livres.
L’export documentaire Thermomix, les repères par version, la clôture des brouillons et les comparaisons de proposition affichée restent présents.

| Contrôle exécuté | Résultat lu |
|---|---|
| Domaine L2 | 51/51 |
| Archives L2 | 57/57 ; collisions de clés et changements de parent des imports, cuissons et repas refusés atomiquement |
| Archives générales / L1 | 89/89 et 24/24 |
| Contextes d’import | 25/25 ; séance revalidée au commit et limites des ajouts refusées même sans crochet de synchronisation |
| Mutations recette L2 | 22/22 ; ancien éditeur et ajout de photo refusés après retrait du livre |
| Mutations livre L2 / UI L2 | 28/28 et 54/54 |
| Sources et provenance | 46/46 après reproduction de déplacements de pages vers un autre parent ou aucun parent |
| I2 livre / couverture / carnet | 57/57, 206/206, 300/300 |
| Ajouter / intégration I2 | 888/888 et 30/30 |
| Lecture web / création IA / synchronisation générale | 284/284, 606/606, 318/318 |
| UI L1 / mutations L1 | 87/87 et 30/30 |

Le contrôle des archives couvre également les liens directs page/document et document/séance, en fusion, remplacement et concurrence finale.

Ces suites utilisent des bases jetables et ont zéro erreur JavaScript ou requête externe. Le bilan global sera mesuré après gel,
puis l’épingle ajustée au nombre effectivement exécuté. Les fixtures anciennes ont reçu leur édition active ou leur condition de création.
Les 34 assertions de suppression physique C09 ont été remplacées par des contrôles de refus et conservation ; l’opération métier devient
réversible et son dialogue est testé séparément. L’ancien test générique `removeBatch` utilise deux magasins encore supprimables,
les livres disposant de leurs propres contrôles de refus. Aucune garde de production n’est désactivée pour obtenir ces bilans.

Le parcours d’application natif crée un livre, recharge, retire le groupe, restaure un membre puis le groupe hors ligne ;
les notes et un retrait individuel préexistant sont préservés. Dix-huit mesures à320/390/1280, Échap et retour du focus,
20 captures dont une sélection effectivement relue. Un débordement vertical de couverture a été corrigé après test rouge.

Passage réel DB5→6 dans un profil jetable : ancien code5412745 ouvert dans deux onglets de même origine,31 magasins et octets conservés,
fermeture sur `versionchange`, indexISBN intact et index`trashed_at` exploitable. La réouverture deDB5 rend `VersionError` sans erreur non gérée.

Le préflight distant, uniquement en lecture, retrouve les sept corps exacts de0008, neuf triggers avec RLS et les droits attendus.
La sauvegarde physique du29octobre06:29UTC est `COMPLETED`. Aucune migration0009 n’est encore appliquée à la production.
Les preuves SQL et de synchronisation L2 en cours seront ajoutées après réception et revue.

## Réception finale locale

**8366/8366** navigateur, épingle **8365** mesurée avant la dernière assertion ; +414 depuis0.23.2 :
412 assertions L2 et deux cas de classement supplémentaires. Aucun cas retiré pour faire passer le compteur.
Node **232/232**, générateur `--check`0, syntaxe ES module de87 fichiers et diff propres.
La première mesure complète a retrouvé un ancien écho de cycle régressif, corrigé avec tests de réception/accusé concurrents.
Une mesure de couverture sans le CSS de l’application a été corrigée dans le harnais de suite ; le style de production était déjà valide.
La revue finale a aussi reproduit huit pertes par suppression de recette/version après restauration du livre : refus au motif exact,
instantané complet inchangé, mêmes protections dans les suppressions ordinaires et les transitions de journal.

Synchronisation ciblée :23 tests L2 de base,46 de reprise et20 de groupes sources. Trois vrais moteurs,501 membres,
photos transférées et archive3 reprise sur un troisième appareil ; transport/stockage simulés, pas de compte privé.
Installation PostgreSQL neuve0001→0009 : **121 assertions** (20 cycles +26 sources +33 tombales +42 régressionL1).
Deux sessions réelles prouvent l’ordre RPC/REST, l’aliasL1 direct et cinq cas CAS/association/sources. Le deadlock initial reste archivé.
Revue indépendante : provenance source/archives, création par fusion, CAS séance et tombales reproduits avant correction puis revérifiés.

Parcours de publication local avec service worker réel : **24 mesures**,320/390/768/1280, aucun débordement, texte parasite,
erreur JavaScript ou requête extérieure. Six modules nouveaux et deux modifiés en cache unique ; base réelleDB6.
Retrait groupé, restauration individuelle puis du groupe ; deux rechargements complets livre/fiche avec réseau toujours coupé.
Trois recettes/versions, notes, historique, retrait individuel préexistant et SHA/longueur/pointeur de photo conservés ; photo décodée hors ligne.
Clavier Entrée/Tab/Échap et retour du focus vérifiés. Captures relues par deux agents.

Preuves : `.superpowers/sdd/2026-10-29-l2/` et `.superpowers/sdd/2026-10-29-l2-publication/`.
Les anciens journaux sans propriétaire explicite sont considérés anonymes ; ils restent lisibles et abandonnables mais ne sont pas
adoptés silencieusement par un compte connecté. La sérialisation SQL est par compte ; les débits d’écritures massivement concurrentes
ne sont pas mesurés. L’envoi initial complet reste progressif, seul un groupe de nouvelles sources est atomique côté serveur.
Essais physiques iPhone/Safari, lecteur d’écran et synchronisation HTTP authentifiée sur deux appareils personnels non exécutés.
À cette réception locale, **aucune migration0009 ni publication0.24.0 n’est encore effectuée** ; la suite du rapport consignera les gestes réels.
