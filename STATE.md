# STATE.md — Cuisine OS (mistu) — état au 18 octobre 2026 (lot « Passerelle de l'assistant » fini dans le worktree `mistu-passerelle`, fonction déployée sur mitsu, `0004` pas collée, pas fusionné ; les trois lots de la nuit sont en ligne)

**18 octobre 2026, 14 h 29 — LOT « PASSERELLE DE L'ASSISTANT » : FINI dans le worktree, fonction DÉPLOYÉE sur `mitsu` (version 2),
`0004` PAS collée, PAS fusionné, PAS poussé.** Branche `passerelle-assistant`, worktree `~/projects/mistu-passerelle` (serveur 8086), base
`main` `cdbd6e0`, 15 commits jusqu'à `00424b6`, plus la clôture des documents. Pour Neegan : plus de clé à taper ; connecté, l'assistant
marche sur tous les appareils (60 appels par compte et par jour, `claude-sonnet-5-5`, Réglages dit « actif pour … ») ; la clé est un
secret du projet et l'app n'appelle plus `api.anthropic.com`. Déployée par le contrôleur : v1 17 h 05 UTC (`1590ba8`), **v2 18 h 16 UTC
(`6d7ed21`)**, `verify_jwt: false`, neuf sondes sans dépense conformes aux deux ; **aucun POST réel**. Suite **2910/2910** (épinglé 2909),
Node **89/89**, `--check` 0, `sw.js` `cuisine-os-v0.8.0-5`. **Gestes, dans l'ordre :** (1) coller `0004` sur `mitsu`, puis `notify pgrst,
'reload schema';` seule, puis sa preuve (`999 BILAN` à `0 faux`, tableau dans `RESULTATS-mitsu.md`) ; (2) après revue finale et `/verify` :
`! git -C ~/projects/mistu merge --ff-only passerelle-assistant`, puis `push` ; (3) preuve réelle sur le site public, connecté : « saumon
fenouil » → un POST `/functions/v1/assistant` 200, zéro `api.anthropic.com`, Réglages « actif … 60 », puis `select … from
public.assistant_usage_jour;` ; (4) iPhone avec l'autre compte, rien à configurer ; (5) console Anthropic : révoquer l'ancienne clé,
plafond mensuel ; (6) « clean » après copie du registre `.superpowers/sdd/2026-10-18-passerelle-assistant/`. Non prouvé : `CLAUDE.md`,
section du lot.

**18 octobre 2026, 10 h 50 — LES TROIS LOTS SONT EN LIGNE.** Geste de Neegan : `0003_assistant_config.sql` collée sur `mitsu`
(`Success`), preuve `0003` jouée : **45 verdicts, 0 faux**, journaux de Postgres jugés (la clé ne peut pas y finir :
`log_statement = ddl`, durée `-1`, `log_parameter_max_length_on_error = 0`), adresses de preuve retirées (2) ; puis trois
fusions `--ff-only` (`assistant-compte` → `creer-ia` → `refonte-visuelle`) et un `push` : **`main` = `origin/main` = `7a95777`**
(50 commits sur `66c5d19`). Suite publique `https://neegans.github.io/mistu/tests/` relancée par le contrôleur dans un Chrome
sans fenêtre, contexte neuf, aucune clé : **2633/2633**, seule erreur de console le 404 `/favicon.ico` ; `sw.js` servi
`cuisine-os-v0.7.0-25`. Les paragraphes ci-dessous décrivent chaque lot tel qu'il était à sa clôture (« FINI dans le
worktree, PAS fusionné, PAS poussé ») : c'est désormais de l'histoire. Reste à Neegan : iPhone (connexion Google, « suit ton
compte », barre d'état `default`, onglet actif, porte, survol), preuve réelle du lot 2 avec sa clé (un seul POST, étiquette,
« Garder »), décisions (N-8/N-9 sur les livres, V-3/V-4, R-VIS-8, R-VIS-4, ovale, 240 min, `image: null`, « 100 % », titre
d'adaptation, « filets » lu comme `dash`), rotation de la clé Anthropic + plafond, « clean » des cinq worktrees (les cinq
registres sont copiés identiques dans `~/projects/mistu/.superpowers/sdd/`, captures du lot 3 comprises).

## Où on en est
**Lot « Refonte visuelle magazine culinaire » (18 octobre) : FINI dans le worktree, PAS fusionné, PAS poussé** — branche
`refonte-visuelle`, worktree `~/projects/mistu-look` (serveur `python3 -m http.server 8085`), base = pointe finale de `creer-ia`
`237047a` (lot 2 ci-dessous, **lui-même non fusionné** sur le lot 1 `ce9eb5d`, **lui-même non fusionné** sur `main` `66c5d19`) ;
commit de départ `174415b` (spec et plan rév. 2), puis T1, T2, T3, la clôture et la **vague finale** après la revue finale de
branche (R-VIS-13 : ambre `#8b5f10` ; R-VIS-14 : règles de comportement épinglées ; anneau des onglets bas rentré). Registre **hors git** :
`.superpowers/sdd/2026-10-18-refonte-visuelle/` (`progress.md`, rapports, outil `preuve-visuelle.cjs`, `galerie.html`, résultats et
**`captures/`**, 136 PNG). Pour Neegan : l'app change d'habit, pas de gestes — papier ivoire, titres en serif, la tomate pour
l'action, le vert pour les états ; mêmes écrans, mêmes textes, aucun test de comportement retouché ; à l'écran, « Annuler » se range
à droite pendant un vol (R-VIS-8, à confirmer), les segments des Réglages ne s'étirent plus, la puce bascule cochée passe en vert, les
coins des couvertures sont arrondis. Fichiers : `styles.css`, `index.html`, `manifest.webmanifest`, `sw.js`,
`tests/theme.js` (neuf), `tests/tests.js` ; aucun `src/`. Suite **2633/2633** (total épinglé **2632** dans `tests/tests.js`, après la
vague finale ; 2622 à la clôture ; départ sur `237047a`, mesuré par le contrôleur : 2554/2554, épinglé 2553), seul le 404 `/favicon.ico` en console ;
`node --test tools/*.test.mjs` 45/45 ; `node tools/generer-migrations.mjs --check` 0 ; les 28 paires de contraste de la spec § 3.6
recalculées ≥ 4,5 (minimum 4,62, ambre sur accent-bg du mode cuisine, qui valait 4,49 avant R-VIS-13). Preuve visuelle **relancée par
la vague finale**, VERTE (code de sortie 0) : 40 lignes sur 40 aux largeurs 375, 390, 768 et 1512, contraste rendu minimum 4,62 sur
1 760 nœuds, M3 sans recouvrement, M14 20 sur 20, 136 captures (avant la vague, la tâche 3, la revue finale et le contrôleur
l'avaient trouvée identique : 40/40, minimum 4,67 sur 1 732 nœuds, 136 captures). Mutants de la vague : 11 sur 11 rougissent. `APP_VERSION 0.7.0`, `DB_VERSION 3` (inchangés),
`sw.js` `cuisine-os-v0.7.0-25`, `SHELL` inchangé. Décisions de nuit V-1 à V-6 **à confirmer par Neegan**, avec R-VIS-8 (placement
d'« Annuler »), R-VIS-4 (libellé de recherche coupé à 375 px) et l'ovale des titres web sur plusieurs lignes (capture
`375-galerie-boutons.png`). Spec `docs/superpowers/specs/2026-10-18-refonte-visuelle-design.md`
(§ 8 : rulings R-VIS-1 à R-VIS-14 ; § 5 : dettes), section du lot dans `CLAUDE.md` et dans `docs/architecture.md`. Revue finale de
branche faite (une vague de corrections) ; re-revue ciblée et `/verify` : au chef d'orchestre.

**Lot « Créer une recette avec l'assistant » (18 octobre) : FINI dans le worktree, PAS fusionné, PAS poussé** — branche
`creer-ia`, worktree `~/projects/mistu-ia` (serveur `python3 -m http.server 8084`), base = pointe d'`assistant-compte`
`ce9eb5d` (lot 1 ci-dessous, **lui-même non fusionné** ; commit de départ du lot `4fee65e` : spec et plan), registre
`.superpowers/sdd/2026-10-18-creer-avec-l-ia/`. Pour Neegan : tu décris ce que tu veux, l'assistant propose UNE recette, tu
la gardes ou pas ; une recette gardée dit partout « Créée avec l'IA · non testée » jusqu'à « Marquer testée », et « Adapter
avec l'IA » en fait une variante sans toucher l'original. Deux portes sur clic (carte « Créer avec l'IA » d'Ajouter, six
cartes ; bouton « Créer une recette avec ces critères » de l'onglet Web), un appel par clic, un seul vol pour toute l'app,
rien d'écrit sans « Garder ». Huit tâches (ordre T1, T2, T5, T3, T4, T6, T7, T8), une ronde de corrections au plus chacune,
14 commits sur `4fee65e` (clôture comprise), puis la **vague finale** après la revue de branche (R-CRE-13 : unité vide
acceptée et invite alignée sur le validateur ; R-CRE-14 : restrictions demandées dans l'invite ; R-CRE-15 : exemple du
champ ; faux positifs N-8 documentés ; exports échappés). Suite **2554/2554** (total épinglé **2553** dans
`tests/tests.js` ; départ remesuré sur `4fee65e` : 1967/1967, épinglé 1966), seul le 404 `/favicon.ico` en console ;
`node --test tools/*.test.mjs` 45/45 ; `node tools/generer-migrations.mjs --check` 0. `APP_VERSION 0.7.0`, `DB_VERSION 3`
(inchangé), `sw.js` `cuisine-os-v0.7.0-11`, `SHELL` + `./src/domain/creation-ia.js` + `./src/ui/creer-ia.js`. **Aucun appel réel** pendant le
lot (`fetch` factice injecté partout). Décisions de nuit N-1 à N-10 **à confirmer par Neegan**, **N-8/N-9 en tête** : elles
changent l'app entière (une fiche de LIVRE aux lignes non vérifiées passe de « compatible » à « à vérifier » ; courses
groupées par le texte écrit ; et N-8 dit souvent « incompatible » une création « sans gluten » ou « sans lactose » à cause de
ses substituts non vérifiés, pâtes sans gluten ou lait de soya : mesuré, décision de Neegan). Spec
`docs/superpowers/specs/2026-10-18-creer-avec-l-ia-design.md` (§ 11 : rulings R-CRE-1 à R-CRE-15 ; § 10 : gestes), plan `docs/superpowers/plans/2026-10-18-creer-avec-l-ia.md` (amendements P1-P29), section du
lot dans `CLAUDE.md` et dans `docs/architecture.md`. Revue finale de branche faite (une vague de corrections) ; re-revue
ciblée et `/verify` : au chef d'orchestre.

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

**Lots poussés** (`origin/main` = `66c5d19`, relu par `git ls-remote` le 18 octobre) : « confort après preuve »
(`confort-web` : « Liens web gardés », « Chercher à nouveau » sur la ligne K1, date de page en liste blanche ; suite
1802/1802) — poussé, **site public non relu dans cette session** — et « Chercher sur le web avec l'assistant » (LIVE depuis
`dc7444a`, prouvé par l'appel réel du 17 octobre sur le site public, « puttanesca »). Sections dans `CLAUDE.md`.

## Ce qui n'est pas prouvé
- **Lot passerelle** : la preuve `0004` (ni la migration, ni `notify pgrst`, ni la preuve n'ont été jouées sur `mitsu` ; syntaxe vérifiée par pglast
  seulement) ; **aucun POST réel** (aucune ligne `assistant_journal`, aucun appel à Anthropic, validité du secret non exercée) ; le `GET`
  `{ modele, quotaJour }` et `is_allowed` pour une session non admise ; le préflight d'un vrai navigateur (S1 est un `OPTIONS` à la main) ;
  un secret changé pris par un isolat chaud ; l'ordre `installCapture` / `repo.init()` dans l'app réelle (test de source seulement) ;
  Safari et l'iPhone.
- **Lot refonte** : rien sous Safari ni sur l'iPhone — barre d'état `default` (app à réinstaller pour relire la balise), onglet
  actif, survol collant (R-VIS-12), marge de 3,4 px du libellé de recherche à 390 px (Chrome seulement) ; à 320 px avec la pastille,
  la barre haute mesure 341 px (320 px = iPhone de 375 ou 390 px en « Agrandir l'affichage », selon la revue de T3) ; `::backdrop` +
  `var()` exige Safari 17.4 et `:has()` iOS 15.4 ; R-VIS-8 est un crochet de style : l'assertion de `tests/theme.js` construit son
  propre DOM, seule la preuve M3 (hors git, recherche web seulement) voit la vraie structure ; l'anneau rentré des onglets bas
  (vague finale) est mesuré dans la scène des tests et dans la galerie, pas dans l'app.
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
2. Revue finale et `/verify` des trois lots par le chef d'orchestre ; regarder les captures du lot 3 :
   `~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/captures/` (136 PNG, `<largeur>-<nom>.png`).
3. **Fusions `--ff-only` en chaîne**, puis **un** `push` (chaîne linéaire, mesurée par `git merge-base --is-ancestor` :
   `66c5d19` ⊂ `ce9eb5d` ⊂ `237047a` ⊂ `refonte-visuelle`) : `! git -C ~/projects/mistu merge --ff-only assistant-compte`, puis
   `! git -C ~/projects/mistu merge --ff-only creer-ia`, puis `! git -C ~/projects/mistu merge --ff-only refonte-visuelle` ; si une
   branche a bougé pendant une vague de revue, rebaser la suivante dessus d'abord ; puis `! git -C ~/projects/mistu push origin main`.
4. Suite publique : ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (après la vague finale : 2633/2633, épinglé 2632,
   plus le 404 de `/favicon.ico` ; seule la suite publique tue le mutant `() => false` du défaut de `texteAssistant`, lot 1) ;
   service worker `cuisine-os-v0.7.0-25`.
5. iPhone, app **réinstallée** depuis le site public : barre d'état lisible, onglet actif, porte « Kwe. », aucun survol collé après
   une tape, libellé de la recherche, et dire si « Agrandir l'affichage » est activé (lot 3) ; « Connexion avec Google » depuis l'app installée (mesure iOS due depuis le
   13 octobre : où atterrit le retour), la clé arrive à la passe suivante (lot 1, geste 4) ; sur le Mac, Réglages → Assistant IA
   montre la configuration et « La configuration de l’assistant suit ton compte sur tes appareils connectés. ».
6. **Preuve réelle de la création** (Mac, site public ; réécrit par R-CRE-15) : taper « saumon fenouil » dans la demande,
   puis régler dans le formulaire la puce « Sans lactose », Portions 2 et Temps maximal 30 → « Créer ma recette » ; vérifier
   qu'**un seul** POST part et que la proposition affiche « Créée avec l’IA · non testée » ; noter la durée, les jetons
   affichés et le coût dans la console Anthropic ; « Garder » → Mes livres → « Recettes créées avec l'IA » ; « Marquer
   testée » après cuisson ; une adaptation (« Adapter avec l'IA »). Preuve iPhone du lot web, toujours due : « saumon fenouil » → des
   liens ; « Garder ce lien » → signet prérempli.
7. **Décisions** : V-1 à V-6 du lot 3 (renverser V-3 ou V-4 au besoin), R-VIS-8, R-VIS-4 et l'ovale des titres web sur plusieurs
   lignes ; N-8/N-9 en tête puis N-1 à N-10 du
   lot 2, et les décisions de spec listées dans `CLAUDE.md` (borne de 240 min, etc.).
8. Faire tourner la clé Anthropic (elle a transité par un chat) et poser un plafond de dépense mensuel sur le workspace.
9. « clean » **seulement après** avoir copié les registres dans `~/projects/mistu/.superpowers/sdd/` :
   `2026-10-17-assistant-par-le-compte` (déjà là, `diff -rq` muet contre `~/projects/mistu-web` le 18 octobre),
   `2026-10-17-chercher-sur-le-web` et `2026-10-17-confort-web` (dans `~/projects/mistu-web` : déjà là, vérifiés identiques, `diff -rq`
   muet le 18 octobre — `git worktree remove` de `mistu-web` détruirait les originaux),
   `2026-10-18-creer-avec-l-ia` (copié par le contrôleur, `diff -rq` muet contre `~/projects/mistu-ia` le 18 octobre),
   `2026-10-18-refonte-visuelle` **avec `captures/`** (une copie du contrôleur existe déjà, mais chaque rapport la périme : la
   recopier en dernier, puis `diff -rq` muet) ; ensuite seulement `git worktree remove` de `mistu-look`, `mistu-ia`, `mistu-web`.
10. Gestes restants des lots précédents : parcours iPhone/Safari du lot ISBN, clé Google Books (`docs/google-books.md`),
   « clean » des worktrees `mistu-isbn` et `mistu-sync` une fois leurs registres vérifiés. Deux worktrees VibeForge : ne pas
   toucher.

## Lots suivants (décisions du 17 octobre, spec web § 10 R11)
- Mistu reste **personnel**. *Décision du 17 octobre (pas de passerelle serveur ni de clé commune) renversée par Neegan le 18 octobre à 11 h :*
  une seule clé Anthropic, côté serveur (lot « Passerelle de l'assistant ») ; le mur reste le plafond du workspace Anthropic. D5
  (sous-domaine dédié) reste recommandé.
- **Après le lot 3** (dettes nommées, spec refonte § 5) : mode sombre, barre haute sur bureau (V-3), icônes SVG, police de marque,
  `.chip.removable` focalisable, `aria-current` sur l'onglet actif, `scrollIntoView` qui respecte le mouvement réduit, « − / + »
  des portions à 44 px, champ « p. imprimée » de `src/ui/import.js:136` à 16 px, liste blanche T-2 vérifiée par usage, `--safe-t`
  sur le panneau latéral et `scroll-margin-top` si la barre d'état repasse en `black-translucent` (revue finale) ; et, pour un lot de comportement, le bug
  préexistant de Réglages (`src/ui/settings.js:43-45` : segments dans un `label.field`, toucher le libellé active la première
  option — revue de T3). Un lot à la fois.
- Au prochain lot qui touche le générateur, après le collage de `0003` : figer `SYNC_STORES_0003` et épingler
  l'empreinte de `0003`.
- Parqués : lire la page trouvée pour en tirer une fiche recette ; dettes des lots création, web et assistant
  (`CLAUDE.md`, sections des lots) ; lot ISBN (R-ISBN-9, R-ISBN-11, S3, S4, C6, C7, D6).

## Reprendre
Lot passerelle (le plus récent) :
```
cd ~/projects/mistu-passerelle && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8086 http=%{http_code}\n" http://localhost:8086/tests/ || (nohup python3 -m http.server 8086 > /dev/null 2>&1 &)
node ~/projects/mistu-passerelle/.superpowers/sdd/2026-10-18-passerelle-assistant/suite.cjs 8086   # attendu : 2910/2910 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 89/89, code 0
```
Lot refonte (les trois lots de la nuit sont en ligne ; ce bloc sert à reprendre l'outil de preuve visuelle) :
```
cd ~/projects/mistu-look && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8085 http=%{http_code}\n" http://localhost:8085/tests/ || (nohup python3 -m http.server 8085 > /dev/null 2>&1 &)
node ~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/suite.cjs 8085   # attendu : 2633/2633 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 45/45, code 0
```
Preuve visuelle (réécrit `resultats.md`, `resultats.json` et `captures/` : jamais pendant qu'une revue les lit) :
`node ~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/preuve-visuelle.cjs 8085` — attendu : VERT, code de sortie 0.
Ordre des gestes : § « Reste à faire », points 1 à 3 (`0003` AVANT le `push`, fusions ff-only en chaîne).

## Pièges connus
`\uXXXX` nu dans un appel d'outil = caractère réel écrit (écrire `\u{XXXX}`, vérifier les octets) ; `grep` de ce shell
appelle `ugrep` en UTF-8 : les caractères invisibles se mesurent en Python (commande de la ligne 21 du plan
`docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`, lue par script, jamais retapée ; elle ne couvre pas les
sélecteurs de variante U+FE00-FE0F : `src/app.js` en porte 3 U+FE0E et `src/ui/add.js:18` 1 U+FE0F, l'émoji U+270D + U+FE0F, tous
antérieurs) ; le total épinglé de `tests/tests.js` se lit
dans « obtenu : X » puis se pose, jamais deviné ; messages de commit en ASCII sans accents ; jamais `git add -A`
(`.superpowers/` non suivi) ; ne jamais toucher `~/projects/mistu` depuis un worktree (l'arbre principal est servi sur
8080) ; aucune requête ne lit `public.assistant_config.data` (la clé y est en clair) ; un serveur de copie se lance sur un
port libre vérifié (8099 répondait déjà le 18 octobre) ; `.superpowers/` est exclu par `.git/info/exclude` (le registre, l'outil de
preuve et les captures ne sont pas dans git : les copier avant tout `git worktree remove`).
Pas de `DECISIONS.md` ni `TASKS.md` dans ce dépôt : la traçabilité vit dans les specs (§ 11 / § 12), `CLAUDE.md` et les
registres SDD.
