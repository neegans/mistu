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

## Réception

À renseigner avec les résultats effectivement lus. La présence de ce document ne déclare ni code terminé, ni migration appliquée, ni livraison publique.

- Tests ciblés rouges puis verts : en attente.
- Suite navigateur complète, Node et générateur : en attente.
- PostgreSQL, deux sessions et anciens chemins d’écriture : en attente.
- Parcours Chrome, largeurs320/390/768/1280, texte200 %, reprise et hors ligne : en attente.
- Publication et contrôles publics : en attente.

Les essais physiques iPhone/Safari et la transmission Cookidoo/TM7 ne sont pas attestés par les émulations navigateur.
