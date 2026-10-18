# STATE.md — Cuisine OS (mistu) — état au 17 octobre 2026, soir (lot « confort après preuve » fini dans le worktree)

## Où on en est
**Lot « confort après preuve » (17 octobre, soir) : FINI dans le worktree, PAS fusionné, PAS poussé** — branche
`confort-web`, worktree `~/projects/mistu-web` (serveur `python3 -m http.server 8083`), base `main` `dc7444a`, registre
`.superpowers/sdd/2026-10-17-confort-web/`. Trois frictions vues par Neegan sur le lot web LIVE : section « Liens web
gardés » dans Mes livres (signets sans livre, le dernier gardé d'abord, même sans aucun livre) ; « Chercher à nouveau »
aussi sur la ligne de la mention K1, avant les liens ; date de page en liste blanche (« April 30, 2025 » ou « 2025-04-30 » → « 30 avril 2025 »), tout le reste
masqué (« 654 days ago »). Rondes 1 et 2 et vague finale de revue faites. Suite **1802/1802** (total épinglé **1801**), seul le 404 `/favicon.ico` en console, `node --test
tools/*.test.mjs` 40/40, `--check` 0. `APP_VERSION 0.5.1`, `sw.js` `cuisine-os-v0.5.1-6`, `SHELL` inchangé. Section
« Confort après preuve » dans `CLAUDE.md`.

**Lot « Chercher sur le web avec l'assistant » : LIVE** (fusionné et poussé : `main` = `origin/main` = `dc7444a`) :
branche `recherche-web`, worktree `~/projects/mistu-web` (serveur `python3 -m http.server 8083`), base
`main` `e4e841b`. Neuf tâches (une ronde de corrections au plus chacune), puis la vague finale de la revue de branche
(R-WEB-9 et quatre mineurs), puis sa vague 2 (la tape met l'adresse à jour sans re-rendu), puis la vague `/verify`
(R-WEB-10, V-C2, V-C6, faux-verts fermés, dettes nommées). Après la vague `/verify` : suite
**1778/1778** (total épinglé **1777** dans `tests/tests.js`), une
seule erreur de console (404 `/favicon.ico`, pré-existant), `node --test tools/*.test.mjs` 40/40,
`node tools/generer-migrations.mjs --check` 0. `APP_VERSION 0.5.0`, `sw.js`
`cuisine-os-v0.5.0-11`, `SHELL` + `./src/core/bornes.js` et `./src/domain/recherche-web.js`. `main` était
`e4e841b` (lot ISBN) au départ du lot.
Ce que fait le lot : l'onglet « Web » de la recherche lance, sur une tape, **un** appel à l'API Anthropic avec l'outil de
recherche web ; au plus 5 liens, tous pris dans les résultats bruts du serveur (rien d'inventé) ; « Garder ce lien » →
signet prérempli ; issues distinctes ; mémoire vive par demande ; un seul appel en vol dans l'app.
Spec `docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (§ 11.2 = R-WEB-1 à R-WEB-10 et tout ce que la
construction a amendé), plan `docs/superpowers/plans/2026-10-17-chercher-sur-le-web.md`, registre
`.superpowers/sdd/2026-10-17-chercher-sur-le-web/progress.md`, section du lot dans `CLAUDE.md` et dans
`docs/architecture.md`.

## Ce qui n'est pas prouvé
- **Lot confort** : éprouvé par la suite (rendus à gestes injectés, aucun réseau) ; rien de nouveau côté réseau. La
  ligne K1 a été regardée par le chef d'orchestre le 17 octobre dans l'app servie (127.0.0.1:8084 = ce worktree), sur
  une instance montée avec un `chercher` factice (aucun appel réel) : à 1512 px, texte et bouton sur la même ligne avant
  le premier lien ; à 390 px, le texte passe sur 2 lignes et le bouton se place dessous, sans débordement horizontal.
  Le parcours réel de bout en bout par Neegan n'est pas fait.
- **Lot web, mesuré en réel le 17 octobre (site public)** : « puttanesca » → **un** POST vers l'API Messages → 200,
  2 recherches, 5 liens choisis + 13 autres pages, ≈ 20 s ; `page_age` vu en « 654 days ago » et parfois « April 30,
  2025 » (d'où le lot confort). Toujours inconnus : statut et corps d'un compte sans recherche web, `pause_turn`,
  `refusal`, taille du corps, coût.
- **Safari et l'iPhone** (aucun WebKit ici) ; `target="_blank"` et `navigator.onLine` depuis une PWA installée ; le délai
  de 45 s compte le temps actif (PWA iOS en arrière-plan).

## Reste à faire
1. **Lot confort** : revue du chef d'orchestre ; puis fusion par Neegan (`! cd ~/projects/mistu && git merge --ff-only
   confort-web`, ou rebase si `main` a bougé depuis `dc7444a`) et `! git -C ~/projects/mistu push origin main` ; preuve
   sur le site public : service worker `cuisine-os-v0.5.1-6` servi, Mes livres → « Liens web gardés » avec un signet,
   une recherche web → dates en français ou masquées, « Chercher à nouveau » à côté de « La demande a changé ».
2. **À faire** : copier `~/projects/mistu-web/.superpowers/sdd/2026-10-17-chercher-sur-le-web/` (copie non vérifiée
   depuis ce worktree) et `2026-10-17-confort-web/` dans `~/projects/mistu/.superpowers/sdd/`. Règle : les registres SDD
   sont copiés dans `~/projects/mistu/.superpowers/sdd/` **avant** tout `git worktree remove` (le registre vit à la racine
   du worktree et meurt avec lui).
3. **Gestes de Neegan** (spec § 10 R2) : clé d'un **workspace Anthropic dédié à Cuisine OS avec plafond de dépense
   mensuel** ; **pas de clé sur le site public avant D5** (sous-domaine dédié) ; **preuve réelle** : faite sur le site public le 17 octobre (« puttanesca ») ; reste l'iPhone (après
   D5) : « saumon fenouil » → liens, « Garder ce lien » → signet prérempli ; noter durée, nombre de recherches, forme
   du refus d'un compte sans recherche web. (La fusion du lot web est faite : `dc7444a` poussé.)
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
node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-confort-web/suite.cjs 8083   # attendu : 1802/1802 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check
```
Fusion du lot confort : § « Reste à faire », point 1.

## Pièges connus
`\uXXXX` nu dans un appel d'outil = caractère réel écrit (écrire `\u{XXXX}`, vérifier les octets) ; le total épinglé de
`tests/tests.js` se lit dans « obtenu : X » puis se pose, jamais deviné ; messages de commit en ASCII sans accents ;
jamais `git add -A` (`.superpowers/` non suivi) ; ne jamais toucher `~/projects/mistu` depuis ce worktree (l'arbre
principal est servi sur 8080).
Pas de `DECISIONS.md` ni `TASKS.md` dans ce dépôt : la traçabilité vit dans les specs (§ 11), `CLAUDE.md` et les
registres SDD.
