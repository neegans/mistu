# STATE.md — Cuisine OS (mistu) — état au 17 octobre 2026 (fin du lot « Chercher sur le web »)

## Où on en est
**FINI dans le worktree, revue finale faite le 17 octobre, une vague de corrections, puis `/verify` et sa vague,
prête à fusionner par Neegan ; PAS fusionné, PAS poussé** : lot « Chercher sur le web avec
l'assistant », branche `recherche-web`, worktree `~/projects/mistu-web` (serveur `python3 -m http.server 8083`), base
`main` `e4e841b`. Neuf tâches (une ronde de corrections au plus chacune), puis la vague finale de la revue de branche
(R-WEB-9 et quatre mineurs), puis sa vague 2 (la tape met l'adresse à jour sans re-rendu), puis la vague `/verify`
(R-WEB-10, V-C2, V-C6, faux-verts fermés, dettes nommées). Après la vague `/verify` : suite
**1778/1778** (total épinglé **1777** dans `tests/tests.js`), une
seule erreur de console (404 `/favicon.ico`, pré-existant), `node --test tools/*.test.mjs` 40/40,
`node tools/generer-migrations.mjs --check` 0. `APP_VERSION 0.5.0`, `sw.js`
`cuisine-os-v0.5.0-11`, `SHELL` + `./src/core/bornes.js` et `./src/domain/recherche-web.js`. `main` était
`e4e841b` (lot ISBN) au départ du lot ; vérifier avant la fusion. Le site public ne change qu'à la fusion et au
`git push` de Neegan.
Ce que fait le lot : l'onglet « Web » de la recherche lance, sur une tape, **un** appel à l'API Anthropic avec l'outil de
recherche web ; au plus 5 liens, tous pris dans les résultats bruts du serveur (rien d'inventé) ; « Garder ce lien » →
signet prérempli ; issues distinctes ; mémoire vive par demande ; un seul appel en vol dans l'app.
Spec `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (§ 11.2 = R-WEB-1 à R-WEB-10 et tout ce que la
construction a amendé), plan `docs/superpowers/plans/2026-10-17-chercher-sur-le-web.md`, registre
`.superpowers/sdd/2026-10-17-chercher-sur-le-web/progress.md`, section du lot dans `CLAUDE.md` et dans
`docs/architecture.md`.

## Ce qui n'est pas prouvé
- **Aucun appel réel** avec la clé de Neegan : tout est éprouvé par un `fetch` factice et des réponses fixes. Inconnus :
  statut et corps d'un compte sans recherche web, forme réelle de `page_age`, `web_search_requests`, `pause_turn`,
  `refusal`, taille du corps, durée, coût.
- **Safari et l'iPhone** (aucun WebKit ici) ; `target="_blank"` et `navigator.onLine` depuis une PWA installée ; le délai
  de 45 s compte le temps actif (PWA iOS en arrière-plan).

## Reste à faire
1. Fait le 17 octobre : revue finale de branche et sa vague de corrections, rouge d'abord (rapport
   `.superpowers/sdd/2026-10-17-chercher-sur-le-web/final-fix-report.md`, spec § 11.2 R-WEB-9) ; puis `/verify` (trois
   lentilles) et sa vague : R-WEB-10, V-C2, V-C6, faux-verts fermés, dettes nommées (même rapport, « Vague 3 »).
2. **À faire, pas encore fait pour ce lot** : copier `~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/`
   dans `~/projects/mistu/.superpowers/sdd/`. Règle : les registres SDD sont copiés dans `~/projects/mistu/.superpowers/sdd/`
   **avant** tout `git worktree remove` (le registre vit à la racine du worktree et meurt avec lui).
3. **Gestes de Neegan** (spec § 10 R2) : clé d'un **workspace Anthropic dédié à Cuisine OS avec plafond de dépense
   mensuel** ; **pas de clé sur le site public avant D5** (sous-domaine dédié) ; **avant la fusion**,
   écarter le `STATE.md` non suivi de l'arbre principal (ce lot ajoute un `STATE.md` suivi : sans ce geste, `git merge`
   s'arrête sur « untracked working tree files would be overwritten: STATE.md ») :
   `! mv ~/projects/mistu/STATE.md ~/projects/mistu/STATE.avant-web.md` (le nouveau le remplace ; l'ancien peut être effacé après lecture) ;
   puis fusion par `!` (`cd ~/projects/mistu && git merge --ff-only recherche-web`, ou rebase si `main` a bougé) et
   `! git -C ~/projects/mistu push origin main` (le dossier courant peut être un worktree) ; preuve
   sur le site public (service worker `cuisine-os-v0.5.0-N` servi, onglet Web → « configure l’assistant » sans clé,
   0 requête) ; **preuve réelle** sur le Mac puis sur l'iPhone (après D5) : « saumon fenouil » → liens, « Garder ce
   lien » → signet prérempli ; noter durée, nombre de recherches, forme du refus d'un compte sans recherche web.
4. Gestes restants des lots précédents : parcours iPhone/Safari du lot ISBN, clé Google Books (`docs/google-books.md`),
   « clean » des worktrees `mistu-isbn` et `mistu-sync` — **mais d'abord compléter leurs registres** dans
   `~/projects/mistu/.superpowers/sdd/` (constaté le 17 octobre, lecture seule : la copie de
   `2026-10-14-identifier-un-livre-fiable` y est partielle — `progress.md` diffère, 17 diffs de revue manquent — et
   `2026-10-12-compte-et-stockage-l1-l2`, 61 fichiers dans `~/projects/mistu-sync`, n'y est pas du tout). Deux worktrees
   VibeForge : ne pas toucher.

## Lots suivants (décisions du 17 octobre, spec § 10 R11)
- Mistu reste **personnel** : pas de passerelle serveur ni de clé commune ; le mur est la clé sur l'appareil et le
  plafond du compte.
- **Lot 2 « Créer avec l'IA »**, en option, sur les versions de recette existantes et leur provenance.
- **Lot 3 refonte visuelle** (références du kit). Un lot à la fois.
- Parqués : lire la page trouvée pour en tirer une fiche recette (hors lot, spec § 2) ; dettes du lot web (`CLAUDE.md`,
  section du lot) ; lot ISBN (R-ISBN-9, R-ISBN-11, S3, S4, C6, C7, D6).

## Reprendre
```
cd ~/projects/mistu-web && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8083 http=%{http_code}\n" http://localhost:8083/tests/ || (nohup python3 -m http.server 8083 > /dev/null 2>&1 &)
node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/suite.cjs 8083   # attendu : 1778/1778 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check
```
Avant la fusion (geste de Neegan, arbre principal) : `mv ~/projects/mistu/STATE.md ~/projects/mistu/STATE.avant-web.md`, puis § « Reste à faire », point 3.

## Pièges connus
`\uXXXX` nu dans un appel d'outil = caractère réel écrit (écrire `\u{XXXX}`, vérifier les octets) ; le total épinglé de
`tests/tests.js` se lit dans « obtenu : X » puis se pose, jamais deviné ; messages de commit en ASCII sans accents ;
jamais `git add -A` (`.superpowers/` non suivi) ; ne jamais toucher `~/projects/mistu` depuis ce worktree (l'arbre
principal est servi sur 8080).
Pas de `DECISIONS.md` ni `TASKS.md` dans ce dépôt : la traçabilité vit dans les specs (§ 11), `CLAUDE.md` et les
registres SDD.
