# L2 — construction et réception de la corbeille des livres

29 octobre 2026. [Spec](../specs/2026-10-29-l2-corbeille-livres-design.md) écrite sous l’autorisation
« et enchaine sur le restant des lots », puis revue techniquement. Neegan n’est pas présenté comme ayant déjà relu ce texte.
Branche `l2-corbeille-livres`, base `752566d`, code public 0.23.1 `d6b4488`.

## Construction en cours

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
Aucun résultat de test L2, SQL distant ou déploiement L2 n’est encore annoncé. La version publique reste0.23.1.
Les essais physiques iPhone/Safari, lecteur d’écran et deux appareils réels devront être distingués des preuves automatiques.
Les lots L3–L10 et l’expérience E1 restent à réaliser ; leur périmètre est rappelé dans la spec.
