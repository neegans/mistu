# STATE.md — Cuisine OS (mistu) — état au 18 octobre 2026 (lot « Créer une recette avec l'assistant » fini dans le worktree, sur le lot « l'assistant suit le compte », lui aussi fini et non fusionné)

## Où on en est
**Lot « Créer une recette avec l'assistant » (18 octobre) : FINI dans le worktree, PAS fusionné, PAS poussé** — branche
`creer-ia`, worktree `~/projects/mistu-ia` (serveur `python3 -m http.server 8084`), base = pointe d'`assistant-compte`
`ce9eb5d` (lot 1 ci-dessous, **lui-même non fusionné** ; commit de départ du lot `4fee65e` : spec et plan), registre
`.superpowers/sdd/2026-10-18-creer-avec-l-ia/`. Pour Neegan : tu décris ce que tu veux, l'assistant propose UNE recette, tu
la gardes ou pas ; une recette gardée dit partout « Créée avec l'IA · non testée » jusqu'à « Marquer testée », et « Adapter
avec l'IA » en fait une variante sans toucher l'original. Deux portes sur clic (carte « Créer avec l'IA » d'Ajouter, six
cartes ; bouton « Créer une recette avec ces critères » de l'onglet Web), un appel par clic, un seul vol pour toute l'app,
rien d'écrit sans « Garder ». Huit tâches (ordre T1, T2, T5, T3, T4, T6, T7, T8), une ronde de corrections au plus chacune,
13 commits sur `4fee65e` avant la clôture. Suite **2524/2524** (total épinglé **2523** dans `tests/tests.js` ; départ
remesuré sur `4fee65e` : 1967/1967, épinglé 1966), seul le 404 `/favicon.ico` en console ; `node --test tools/*.test.mjs`
45/45 ; `node tools/generer-migrations.mjs --check` 0. `APP_VERSION 0.7.0`, `DB_VERSION 3` (inchangé), `sw.js`
`cuisine-os-v0.7.0-10`, `SHELL` + `./src/domain/creation-ia.js` + `./src/ui/creer-ia.js`. **Aucun appel réel** pendant le
lot (`fetch` factice injecté partout). Décisions de nuit N-1 à N-10 **à confirmer par Neegan**, **N-8/N-9 en tête** : elles
changent l'app entière (une fiche de LIVRE aux lignes non vérifiées passe de « compatible » à « à vérifier » ; courses
groupées par le texte écrit). Spec `docs/superpowers/specs/2026-10-18-creer-avec-l-ia-design.md` (§ 11 : rulings R-CRE-1
à R-CRE-12 ; § 10 : gestes), plan `docs/superpowers/plans/2026-10-18-creer-avec-l-ia.md` (amendements P1-P29), section du
lot dans `CLAUDE.md` et dans `docs/architecture.md`. Revue finale de branche et `/verify` : au chef d'orchestre.

**Lot « La configuration de l'assistant suit le compte » (17-18 octobre) : FINI dans le worktree, PAS fusionné, PAS
poussé** — branche `assistant-compte`, worktree `~/projects/mistu-web` (serveur `python3 -m http.server 8083`), base
`main` `66c5d19`, registre `.superpowers/sdd/2026-10-17-assistant-par-le-compte/`. La configuration de l'assistant
(fournisseur, modèle, URL de base, clé) vit dans le magasin `assistant_config` (plus dans `settings`) et suit le compte
sur les hôtes de production seulement (jamais sur `localhost`) ; jamais de conflit à trancher, jamais de suppression
locale (« Aucun » écrit une ligne vide), jamais dans une archive ; passe unique depuis l'ancien `settings.llm`. Serveur
en fichiers seulement : `supabase/migrations/0003_assistant_config.sql` et sa preuve, **pas encore collées sur
`mitsu`**. Suite **1967/1967** (total épinglé **1966**), `APP_VERSION 0.6.0`, `sw.js` `cuisine-os-v0.6.0-10`. Spec
`docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` (§ 12 : R-CPT-1 à R-CPT-7), section du lot dans
`CLAUDE.md` (ordre des gestes, procédure « appareil perdu ou clé exposée »).

**Lots déjà en ligne** (`origin/main` = `66c5d19`, lu par `git ls-remote` le 18 octobre) : « confort après preuve »
(`confort-web` : « Liens web gardés », « Chercher à nouveau » sur la ligne K1, date de page en liste blanche ; suite
1802/1802) et « Chercher sur le web avec l'assistant » (LIVE depuis `dc7444a` ; un appel réel mesuré le 17 octobre sur le
site public, « puttanesca »). Sections dans `CLAUDE.md`.

## Ce qui n'est pas prouvé
- **Lot création** : **aucun appel réel** (chaque test passe par un `fetch` factice ; le parcours dans l'app réelle de la
  tâche 3 avait l'API Anthropic interceptée) — forme réelle d'une réponse, durée, jetons, coût, taux de refus `illisible`
  ou `affirmation` ; Safari et l'iPhone ; les minuteurs Siri d'une étape de création sur appareil ; l'effet de N-8/N-9
  sur la vraie bibliothèque de Neegan (fixtures seulement).
- **Lot assistant** : aucune passe réelle contre `mitsu` (ni `0003` ni sa preuve n'ont tourné ; leur syntaxe seulement
  est vérifiée hors ligne, par pglast v8.6) ; l'iPhone ; le chemin « nouveau client, ancien serveur » ; l'état « appareil
  lié sans session » de K-10 ; K-12 au niveau de la page ; les appels réels de « Tester », de l'extraction et du
  fournisseur compatible OpenAI.
- **Lot confort** : le parcours réel de bout en bout par Neegan.
- **Lot web** : statut et corps d'un compte sans recherche web, `pause_turn`, `refusal`, taille du corps, coût.
- **Safari et l'iPhone** partout (aucun WebKit ici) ; `target="_blank"` et `navigator.onLine` depuis une PWA installée ;
  les délais (45 s, 120 s) comptent le temps actif (PWA iOS en arrière-plan).

## Reste à faire (gestes de Neegan, dans cet ordre)
1. **Lot 1 d'abord, `0003` avant tout `push`** : éditeur SQL de `mitsu`, coller `supabase/migrations/0003_assistant_config.sql`
   entier ; puis la preuve `supabase/proofs/0003_assistant_config.sql` (deux adresses `exemple.invalid` dans
   `private.allowed_users`, quatre jetons remplacés, « Run without RLS », ligne `999 BILAN` à `0 faux`, verdicts dans
   `supabase/proofs/RESULTATS-mitsu.md` **sans aucune valeur de `data`**, adresses retirées) — `supabase/README.md`,
   étape 8 bis.
2. **Seulement après** : revue finale et `/verify` des deux lots par le chef d'orchestre ; copier
   `~/projects/mistu-ia/.superpowers/sdd/2026-10-18-creer-avec-l-ia/` dans `~/projects/mistu/.superpowers/sdd/` (celui du
   lot 1 y est déjà : `diff -rq` muet contre `~/projects/mistu-web` le 18 octobre).
3. **Fusions `--ff-only` en chaîne**, puis **un** `push` : `! cd ~/projects/mistu && git merge --ff-only assistant-compte`,
   puis `! cd ~/projects/mistu && git merge --ff-only creer-ia`, puis le lot 3 s'il est fini (ff-only depuis la pointe de
   `creer-ia`) ; si `assistant-compte` a bougé depuis `ce9eb5d` (vague de revue), rebaser `creer-ia` dessus d'abord ; puis
   `! git -C ~/projects/mistu push origin main`. Ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (seule la
   suite publique tue le mutant `() => false` du défaut de `texteAssistant`, lot 1).
4. Lot 1 sur les appareils : Mac, site public, Réglages → Assistant IA montre la configuration et « La configuration de
   l’assistant suit ton compte sur tes appareils connectés. » ; iPhone : « Connexion avec Google » depuis l'app installée
   (mesure iOS due depuis le 13 octobre : où atterrit le retour), la clé arrive à la passe suivante.
5. **Preuve réelle de la création** (Mac, site public) : une création → noter la durée, les jetons affichés et le coût
   dans la console Anthropic ; « Garder » → Mes livres → « Recettes créées avec l'IA » ; « Marquer testée » après
   cuisson ; une adaptation (« Adapter avec l'IA »). Preuve iPhone du lot web, toujours due : « saumon fenouil » → des
   liens ; « Garder ce lien » → signet prérempli.
6. **Confirmer ou renverser N-8/N-9** (et les autres décisions de nuit N-1 à N-10, plus les décisions de spec listées dans
   `CLAUDE.md`, section du lot de création).
7. Faire tourner la clé Anthropic (elle a transité par un chat) et poser un plafond de dépense mensuel sur le workspace.
8. Gestes restants des lots précédents : parcours iPhone/Safari du lot ISBN, clé Google Books (`docs/google-books.md`),
   « clean » des worktrees `mistu-isbn` et `mistu-sync` une fois leurs registres vérifiés. Deux worktrees VibeForge : ne pas
   toucher.

## Lots suivants (décisions du 17 octobre, spec web § 10 R11)
- Mistu reste **personnel** : pas de passerelle serveur ni de clé commune ; la clé suit le compte de Neegan (lot 1), et le
  mur reste le plafond du workspace Anthropic. D5 (sous-domaine dédié) reste recommandé.
- **Lot 3 refonte visuelle** (références du kit) : à cette clôture, ni branche `refonte-visuelle` (`git branch -a`) ni
  worktree `mistu-look` (`git worktree list`). Un lot à la fois.
- Au prochain lot qui touche le générateur, après le collage de `0003` : figer `SYNC_STORES_0003` et épingler
  l'empreinte de `0003`.
- Parqués : lire la page trouvée pour en tirer une fiche recette ; dettes des lots création, web et assistant
  (`CLAUDE.md`, sections des lots) ; lot ISBN (R-ISBN-9, R-ISBN-11, S3, S4, C6, C7, D6).

## Reprendre
```
cd ~/projects/mistu-ia && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8084 http=%{http_code}\n" http://localhost:8084/tests/ || (nohup python3 -m http.server 8084 > /dev/null 2>&1 &)
node ~/projects/mistu-ia/.superpowers/sdd/2026-10-18-creer-avec-l-ia/suite.cjs 8084   # attendu : 2524/2524 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 45/45, code 0
```
Ordre des gestes : § « Reste à faire », points 1 à 3 (`0003` AVANT le `push`, fusions ff-only en chaîne).

## Pièges connus
`\uXXXX` nu dans un appel d'outil = caractère réel écrit (écrire `\u{XXXX}`, vérifier les octets) ; `grep` de ce shell
appelle `ugrep` en UTF-8 : les caractères invisibles se mesurent en Python (commande de la ligne 21 du plan
`docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`, lue par script, jamais retapée ; elle ne couvre pas les
sélecteurs de variante U+FE00-FE0F : `src/app.js` en porte 3, antérieurs) ; le total épinglé de `tests/tests.js` se lit
dans « obtenu : X » puis se pose, jamais deviné ; messages de commit en ASCII sans accents ; jamais `git add -A`
(`.superpowers/` non suivi) ; ne jamais toucher `~/projects/mistu` depuis un worktree (l'arbre principal est servi sur
8080) ; aucune requête ne lit `public.assistant_config.data` (la clé y est en clair) ; un serveur de copie se lance sur un
port libre vérifié (8099 répondait déjà le 18 octobre).
Pas de `DECISIONS.md` ni `TASKS.md` dans ce dépôt : la traçabilité vit dans les specs (§ 11 / § 12), `CLAUDE.md` et les
registres SDD.
