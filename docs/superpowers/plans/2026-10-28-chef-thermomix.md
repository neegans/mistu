# Construction I3 — Chef Thermomix

Spec : [révision 1 approuvée sur « go »](../specs/2026-10-28-chef-thermomix-design.md).
Base `34105d2`, branche `chef-thermomix`, dépôt `~/projects/mistu`.

1. Domaine et tests : profil matériel fermé, réponse hostile, sélection/quantités, fabricant de version, lecteur et formats.
2. Journal et tests : brouillon durable, appel explicite, conditions atomiques, annulation, reprise, conservation idempotente.
3. Écrans et tests : sélection, questions, comparaison, relecture, copie Cookidoo et repli presse-papiers.
4. Intégration et tests : routes/journal, fiche, édition, repas, cuisine, exporteurs, portions et ascendance IA.
5. Vérification : suite navigateur mesurée, Node en série, migrations `--check`, navigation réelle et hors ligne, captures FR/EN.
6. Revue adverse, corrections et documentation des preuves/limites. Publication traitée séparément de l’approbation de spec.

Les tâches 1–3 se font en parallèle dans des modules distincts. Les API sont coordonnées entre agents ; la tâche 4 et les fichiers
partagés restent au chef. Tests ciblés écrits avant implémentation, avec réseau injecté et bases jetables. Aucun appel assistant réel.
Les preuves locales sont conservées sous `.superpowers/sdd/2026-10-28-chef-thermomix/` (ignoré par Git).

Version locale `0.20.0`, DB 4, aucun changement serveur/SQL. Les sources matérielles de la spec sont la référence ; aucun élargissement
implicite de température, de mode ou d’accessoire. Les réglages estimés restent distincts des faits de la recette.

## Résultat de construction

Les six tâches sont terminées. Domaine **132/132**, journal **66/66**, écrans **55/55**, intégration **52/52** en exécution ciblée.
Les tests ont d’abord exposé les comportements manquants, puis les correctifs de revue. Le bilan global après le dernier
correctif d’export est **6820/6820** (épingle **6819**, contre **6503/6503** en I2, aucune assertion retirée), sans erreur JavaScript
ni requête externe. Syntaxe des 36 fichiers JS vérifiée et `git diff --check` propre. Bilan publié/local distinct dans `STATE.md`.

La revue croisée a fait corriger deux contournements du validateur (ingrédient déclaré sans ajout réel ; durée d’un ancien bloc altérée),
le retour idempotent d’un journal vers une autre version, la condition de session avec une version présente deux fois, la conservation des
contraintes lors d’une correction manuelle, du texte « null » parasite et le refus silencieux des exports globaux. Rulings : spec § 11.

Preuves : réponse assistant injectée, bases jetables, absence d’accès externe ; parcours dans les vraies routes de l’app jusqu’à la cuisine
hors ligne ; rechargement de fiche, cache actif, copie complète des étapes adaptées et non adaptées ; captures à quatre largeurs et fiche EN.
Les sauvegardes ZIP conservent un plan lisible même après purge de son journal. Node **230/230** en série, générateur de migrations **0**.
Aucun changement serveur/SQL, aucun appel réel à l’assistant, aucun essai TM7/Cookidoo ou à deux appareils réels.

Publication réalisée sur « promote tout » de Neegan : commit `9fb825d`, intégration en avance rapide dans `main`, push et build Pages
réussis. Site public **0.20.0**, suite **6820/6820**, neuf fichiers publics identiques, six modules en cache, adaptation conservée et copiée,
fiche rechargée et cuisine hors ligne vérifiées. Zéro erreur JavaScript et zéro requête hors origine. Preuves :
`suite-publique.resultat.json` et `publication.resultat.json` dans le registre ignoré. L’essai matériel reste à faire.
