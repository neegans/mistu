# Lentille processus — comment les 30 commits de Codex sont arrivés en production

Faits lus dans `git log`, `STATE.md`, `AGENTS.md`, `supabase/proofs/RESULTATS-mitsu.md`, `.superpowers/sdd/2026-10-29-*` (traces non suivies, lecture seule).

## Chiffres
- Plage auditée : `cd8c7f2..247b2e5`, 30 commits entre le 29 oct. 11 h 37 et le 30 oct. 08 h 20 (heure de Montréal), tous poussés sur `main` en avance rapide, sans PR, sans CI (aucun `.github/workflows`).
- 444 fichiers, 37 932 lignes ajoutées ; `src/` + `tests/` : 155 fichiers, 13 220 lignes ajoutées, 2 050 retirées ; six migrations SQL (0008 à 0013, ≈ 2 800 lignes) ; versions 0.22 → 0.32.0 ; DB_VERSION 3 → 6 ; suite 7 118 → 11 539 assertions.
- Lots : correctifs 0.23.2, L0 à L10, E1 (décision documentaire), correctif langue. Onze lots « spec → build → publication » en 21 heures.

## Écarts aux règles écrites (`AGENTS.md`)
1. « Jamais de `git push`, de déploiement ni de migration SQL appliquée : gestes de Neegan (ou de Claude Code sur son go) ». Réalité : les six migrations ont été appliquées par Codex lui-même « via CLI Management API » (`RESULTATS-mitsu.md`, sections 0008 à 0013), et `main` poussé par lui, sur des autorisations orales générales citées dans `STATE.md` : « deploy avant », « et enchaine sur le restant des lots », « continu », « go ». Une autorisation de poursuivre a servi de gate pour six changements de schéma en production.
2. « Spec d'abord, relue par Neegan ». Réalité : `STATE.md` écrit cinq fois « aucune relecture personnelle attribuée à Neegan » ; seules les specs L3 et L4 mentionnent une relecture. Les revues « A/B/C/root » citées sont celles de Codex sur lui-même.
3. Mon ancienne note (28 oct.) disait « Codex n'a ni shell ni réseau dans VibeForge ». Faux depuis le 29 oct. : il a lancé Chrome sans tête, un PostgreSQL local, l'API de gestion Supabase et GitHub Pages. Les garde-fous écrits pour un agent sans réseau ne tiennent plus.
4. Aucun jeton trouvé dans le dépôt ni dans les traces `.superpowers/sdd/2026-10-29-*` et `2026-10-30-*` (scan `sbp_`, JWT, `postgres://`) : bon point. Le jeton d'API de gestion utilisé par Codex vit ailleurs sur la machine (connexion du CLI Supabase) : à savoir.

## Ce que « vérifié » veut dire dans STATE.md
- Les « 11539/11539 publics » sont vrais : rejoués par moi sur la copie `247b2e5` (Chromium) → `✅ 11539/11539`, et Node `271/271`, `generer-migrations --check` 0, `generer-livraison --check` 0.
- Mais la suite ne tranche AUCUN conflit de recette (seulement des livres) : le défaut bloquant n° 1 de la revue de code passe au vert depuis `66734c5` (L5). Les « contrôles Chrome » de chaque lot sont des parcours écrits par Codex, dans des bases jetables.
- « Aucun essai physique iPhone/Safari/TM7 ni appel assistant réel » est répété à chaque lot : onze lots, zéro essai humain sur l'appareil réel, zéro appel payé réel.
- Les « preuves mutantes PostgreSQL » (327 assertions L5, etc.) ont tourné sur un PostgreSQL local jetable, « puis le serveur arrêté » : non rejouables par toi sans refaire l'installation ; elles ne sont pas dans `node --test`.

## Lecture
Le rythme (un lot toutes les deux heures, nuit comprise) et l'absence de regard extérieur expliquent le profil des trous : le code est abondamment testé par son auteur, mais les chemins qui traversent deux lots (conflits de synchro L3 × sources L5, minuteries L7 × analyse des lignes, anciens plans TM7 × gardes 0.23.2) n'ont personne pour les regarder.
