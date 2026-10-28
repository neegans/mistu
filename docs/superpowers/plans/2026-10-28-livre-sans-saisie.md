# Lot I2 — plan de construction

Spec : [livre sans saisie](../specs/2026-10-28-livre-sans-saisie-design.md), révision 1 approuvée par Neegan (« ok go enchaine »).
Base `baa7822`, branche `livre-sans-saisie`, serveur local de vérification prévu sur 8102. Aucun push ni geste serveur.

## Travail et responsabilités

1. **Départ et garde-fous (coordinateur)** : mesurer les suites navigateur et Node, confirmer le contrôle des migrations ;
   fournir le lanceur de tests ciblés, la garde ISBN en transaction et les intégrations partagées.
2. **Livre (agent livre)** : tests L01–L10 d'abord ; domaine bibliographique, lecture de couverture étendue,
   relais Web, provenance, brouillon durable/reprise, formulaire et compléments de fiche livre. Garder l'ancien format lisible.
3. **Cuissons et notes (agent cuisine)** : tests C01–C06/N01–N02 d'abord ; formulaire par recette, dates civiles,
   photos personnelles, observation modifiable, Mes notes sur fiche et mode cuisine. Exporter une sélection de photo pure.
4. **Image imprimée (agent cadrage)** : tests P01–P04 d'abord ; rectangle, validation indépendante de la recette,
   proposition après import et cadrage manuel, consentement avant écriture, provenance de la page.
5. **Intégration (coordinateur)** : fichiers référencés et noms, photos des cartes et dates partagées, archives,
   vocabulaire du journal, dictionnaire anglais, `SHELL`, version `0.19.0`, épingles mesurées ; tests S01–S03/U01.
6. **Clôture (coordinateur et revue indépendante)** : suites complètes et parcours navigateur avec réseau injecté,
   corriger les défauts observés ; documenter état local, limitations réelles, preuves non jouées, gestes de Neegan.

Les agents travaillent sur des fichiers/sections attribués, sans commit ni modification des fichiers d'intégration partagés.
Les tests ciblés observent les données et le DOM dans des bases jetables. Aucun appel réel à l'assistant, aucune donnée personnelle lue.
Chaque tâche apporte le test en échec avant le comportement, puis sa preuve verte. Les essais réels de Trinity et sur iPhone restent
distincts des fixtures ; aucune annonce de preuve réelle sur leur seule base.

## Contrôles de fin

- Suite navigateur après rechargement sans cache ; épingle = assertions avant le bilan.
- `node --test --test-concurrency=1 tools/*.test.mjs`.
- `node tools/generer-migrations.mjs --check`.
- Écrans aux largeurs prévues, notes et images récupérées, absence d'appels externes pendant les tests.
- Diff limité au lot, aucune modification de serveur/SQL, documentation `STATE.md`, `CLAUDE.md`, architecture.

## Réalisation

Les six tâches sont construites. Les trois volets ont été implémentés en parallèle, puis relus : champs incertains et reprise de livre,
courses de cadrage, conservation des notes lors d’un import et d’une correction, saisie pendant synchronisation, aperçu et annulation des photos.
Les régressions ont d’abord été observées en rouge, puis corrigées. Aucune assertion ancienne n’a été retirée ; les attentes de forme sont adaptées
aux nouveaux champs, au journal `livre` et au bilan d’import conservé à l’écran.

**Bilan : navigateur 6503/6503**, épingle 6502, soit 257 assertions supplémentaires par rapport au départ 6246/6246.
Les nouvelles suites I2 comptent 208 assertions (livre 57, cuisine 65, cadrage 56, intégration 30) ; les autres ajouts renforcent les suites
existantes et les contrôles des nouveaux modules. Node **230/230**, migrations `--check` **0**, `git diff --check` propre. Zéro erreur JavaScript
ou requête externe dans les vérifications navigateur. Captures 320/390/768/1280 pixels sans débordement ; ajout et rechargement d’un livre
dans la vraie application locale réussis.

Le registre local de preuves est
`.superpowers/sdd/2026-10-28-livre-sans-saisie/` (résultats JSON, lanceur navigateur, captures et preuves rouges de concurrence).
Les ajustements de construction sont consignés dans la spec, §15. Après le bilan local, Neegan a autorisé la publication par « go » en réponse
à la confirmation que le lot n’était pas encore déployé. **Publication terminée :** commit de code `455b192`, fusion en avance rapide dans
`main`, push et build GitHub Pages réussis. Suite publique **6503/6503**, zéro erreur JavaScript ou requête externe ; dix fichiers servis
identiques, cache `cuisine-os-v0.19.0-1` installé. Ajout, rechargement et rechargement hors ligne d’un livre réussis dans un profil jetable.
Preuves : `suite-publique.resultat.json` et `publication.resultat.json` dans le registre. Aucune fonction déployée ou migration appliquée.
