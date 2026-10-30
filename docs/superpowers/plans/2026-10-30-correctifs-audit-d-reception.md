# Correctifs de l’audit — lot D

Référence : [plan fourni et autorisé par Neegan](2026-10-30-correctifs-audit-L0-L10.md), tâche 9 ; lentille [synchronisation](../../audits/2026-10-30-audit-codex-L0-L10/lentilles/synchro.md). Branche `correctifs-audit-d`, base `fd84739`, après publication C / 0.32.3-1 et application reçue de 0014.

Le « deploy et enchaine ensuite le reste » autorise la construction des lots restants. Le lot D est en construction locale : APP_VERSION **0.32.4**, DB6/archive7 inchangés. Les tâches 9.1 à 9.7 sont exécutées dans l’ordre, avec rouge causal, réception et commit séparés. Aucune nouvelle migration SQL prévue.

## 9.1 — Envois bloqués

Première réception rouge avant code : **47/105 assertions vertes, 58 rouges**, zéro erreur JavaScript/requête extérieure. Les quatre types de commande refusent leur abandon confirmé ; copies documentaires absentes, entrées suivantes retenues, refus HTTP sans conflit lisible, accusés sans clôture de copie et bouton protégé absent. Annulation et conservation des fiches locales sont déjà vertes. Preuves ignorées : `.superpowers/sdd/2026-10-30-audit-d/9.1/rouge.json` et `rouge.log`. Les gardes de compte, bibliothèque et intention doivent rester atomiques ; annulation, quota et modifications concurrentes ne doivent rien perdre.

Les tâches 9.2 à 9.7 restent à implémenter. C est reçu publiquement à 12063/12063 ; ses deux messages de révocation d’images de test sont qualifiés au reçu C. Les nouveaux tests de D ne lui sont pas attribués.


### Réception de 9.1

L’abandon confirmé conserve l’enveloppe, la modification et la fiche locale, sans réécrire cette dernière. La copie reste consultable dans Réglages et porte la décision d’abandon. Un refus HTTP crée une copie active ; seul l’accusé exact de la même intention peut la résoudre, sans l’effacer. Le compteur des conflits exclut les copies résolues.

Les premiers compléments avant code donnent **62/126 verts, 64 rouges** (fenêtres avant transaction et statuts HTTP distincts inclus). Après première correction, **126/126**. La revue indépendante a ensuite reproduit trois courses : changement de dépôt pendant confirmation, réponse 503 tardive réinsérant l’ancienne intention, réponse 413 tardive posant une pause dans la nouvelle bibliothèque. Avec les témoins d’accusé concurrent et de compteur, **137/144 verts, 7 rouges** précèdent la dernière correction ; puis **144/144 verts**, et contre-rejeu indépendant **3/3**. Ces refus conservent exactement l’état concurrent, avec `SYNC_ENVOI_CHANGED` sur les réponses tardives. Le quota du test dédié est une exception simulée avant `db.mutate`, pas une saturation réelle du navigateur.

Régressions ciblées : 841/842 avant la génération de la livraison, seul écart sur l’ancienne version du manifeste. Aucun ancien scénario ni attente comportementale retiré. Première suite globale : **12200/12207** ; six épingles de version sous forme d’expressions régulières n’avaient pas encore suivi 0.32.4, et le compteur attendait toujours 12062. Les six épingles sont corrigées et le compteur fixé à la valeur mesurée **12206** (bilan attendu12207, +144). Le code métier n’a pas changé après cette mesure. La seconde passe globale est reçue : **12207/12207**, zéro exception JavaScript/requête extérieure.

Node **281/281**, générateurs `--check` et syntaxe conformes. Livraison **0.32.4-1**, 212 fichiers /3 664 318 octets, manifeste SHA256 `ec32123d69fc400452bff88136a4b141516838b9261424941b7c602a69260c1e`. DB6/archive7 inchangés. Preuves dans `audit-d/9.1/` : `rouge.json`, `rouge-complet.json`, `portee-rouge.json`, témoins verts, régressions et suites globales ; aucune requête extérieure ni session privée.
