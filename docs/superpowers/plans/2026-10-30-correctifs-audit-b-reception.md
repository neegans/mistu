# Correctifs de l’audit — lot B

Référence : [plan fourni par Neegan](2026-10-30-correctifs-audit-L0-L10.md), tâches6 et7 ; lentille [livraison](../../audits/2026-10-30-audit-codex-L0-L10/lentilles/livraison.md). Branche `correctifs-audit-b`, base `8fd8ed2` (reçu de publication A). Autorisation : « go et enchaine ». A a été publié ; B est construit localement, avec publication séparée selon le plan. Baseline11913 tests navigateur ; APP_VERSION0.32.2, DB6/archive7 inchangés.

## Tâche 6 — démarrage

Le correctif7696ed6 concerne la découverte des mises à jour après montage. Il ne corrige pas les courses de la frontière de démarrage : les reproductions actuelles restaient en choix, sans ouverture. Dix échecs causaux sont reçus avant code ; un second témoin atteint la dernière vérification avant import.

Une nouvelle lecture bornée est maintenant faite après un changement de worker, avant la décision initiale et avant import. Un contrôleur incomplet reste refusé. Sans API, ou après refus de register, l’app monte en mode `en_ligne_non_verifiee`, sans écran de choix intermédiaire. Les textes de cette frontière sont FR/EN selon la langue du navigateur, sans importer i18n avant admission.

Le montage métier remplace #app plus tard, après import : un helper préserve explicitement le même nœud d’information aux trois remplacements de racine (porte, coquille, erreur). Pas d’observateur permanent. Le premier placement après coquille était hors premier écran mobile (y844) ; témoin d’ordre rouge puis avis placé avant la coquille (y0/48px sur390×844). Les textes restent en texte DOM et la langue du navigateur est conservée après changement de langue de l’interface.

Ciblé **42/42**, soit **+24** depuis18. Une attente historique a changé : l’absence d’API ouvre désormais en ligne, comme demandé ; aucune assertion retirée. Suite complète **11937/11937**, zéro erreur JavaScript/requête extérieure. Parcours réels indépendants **49/49** sur quatre scénarios absent/refusé ×FR/EN : vraie porte, admission, Réglages/Bibliothèque, langue, recharge ; ligne unique visible, mode non vérifié exact, largeur390 sans débordement. Captures relues. Une première tentative de harnais utilisait une classe .shell inexistante ; son timeout a été corrigé vers .coquille et n’est pas compté comme succès produit.

Preuves : `.superpowers/sdd/2026-10-30-audit-b/t6-*.log`, `t6-parcours.json`, `parcours-demarrage/sans-worker.resultat.json` et captures. Syntaxe, diff et générateur conformes. Livraison locale **0.32.2-1**,211 fichiers /3 649 291 octets, SHA256 `16b9eb6b6e5bd42cf6b31db78bc7d6d947d1b7db7af0b7427ab08adab1418529`. Tâche7 restante. Aucun push B ni changement serveur.
