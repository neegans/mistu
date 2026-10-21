# STATE.md — Cuisine OS (mistu) — état au 20 octobre 2026 (lots « Passerelle de l'assistant » et « Présentation du serveur » EN LIGNE, `main` = `57babc6` ; lots A « Import ciblé et journal d'import », B « Recette web complète » et G « Les photos voyagent entre appareils » FINIS, empilés A → B → G sur `main`, NI fusionnés NI poussés, migrations `0005` et `0006` PAS collées, fonction `assistant` PAS redéployée ; lots C, D, E, F prêts (specs, plans, valeurs de rejeu) mais en attente du relèvement de la limite de dépense du compte)

**20 octobre 2026, 23 h 30 — LOT G « LES PHOTOS VOYAGENT ENTRE APPAREILS » : FINI dans le worktree `~/projects/mistu-photos-entre-appareils`
(branche `photos-entre-appareils`, base = la tête finale du lot B `cf91f09`, spec `3601a52`, plan rejoué `c227711`, tête de code `222b3a5` — la vague
finale `c42693f`, faite INLINE par le chef d'orchestre parce que la limite de dépense avait refusé l'agent de vague, a été RE-REVUE à trois lentilles puis
complétée par la ronde 2 `222b3a5` (R-G-31, R-G-24 bis, R-G-28 bis) et sa re-revue ciblée ; les commits de spec et de docs suivent —, serveur 8090), six tâches en une ronde chacune (re-revues propres), revue finale à trois lentilles (4 Important et 15 Minor, tous fermés
ou nommés : R-G-24 à R-G-29), `/verify` mécanique VERT (suite 4403/4403, épingle 4402, Node 174/174, `--check` 0, invisibles 0, aucune clé),
`sw.js cuisine-os-v0.11.0-14`, `APP_VERSION 0.11.0`, aucune migration. **PAS fusionné, PAS poussé.** (La re-revue due par R-G-30 est FAITE le 20 octobre au soir.) Pour Neegan, dans l'ordre : les gestes des lots A
et B (ci-dessous) ; puis `git merge --ff-only photos-entre-appareils`, push, suite publique 4403/4403,
preuve « deux appareils » (spec G § 10 : images réellement ouvertes sur le second appareil, pas seulement leurs pointeurs), décision R-G-28 (refuser
« Effacer les données » tant que des photos restent à envoyer ?), « clean ». Registre `.superpowers/sdd/2026-10-19-photos-entre-appareils/`
(copie dans `~/projects/mistu/.superpowers/sdd/`) ; rulings R-G-7 à R-G-32 dans la spec § 12 ; dettes au § 13.**

**20 octobre 2026, 05 h 30 — LOT B « RECETTE WEB COMPLÈTE » : FINI dans le worktree `~/projects/mistu-recette-web` (branche `recette-web`, base = la
tête finale du lot A `2b6a2fd`, tête de code `51bad50` (le dernier commit de code ; le suivent deux commits de spec, `7df269e` : rulings R-B-17 à
R-B-28 et amendements de clôture, et `76d88dd` : bilan des mutants vérifiable, R-B-22 bis, heure du Départ ; puis le commit de clôture qui pose ces
documents), serveur 8089), revu (six tâches à trois lentilles, une ronde chacune, re-revues propres ; revue finale de branche, 4 Important et 10
Minor : la vague finale `d8163be` + `ebbcf10` ferme les 4 Important et 8 Minor (compte de son rapport), le Minor `portionsDe`, refusé par la vague,
est tranché par R-B-22 à la ronde finale 2, les 2 Minor de documentation (R-B-11 « survivant », chiffres de `cloture.md`) sont fermés à la clôture ;
ronde finale 2 `51bad50` : R-B-22 `portionsDe`, R-B-23 alias de la fonction ; clôture du chef d'orchestre : rulings R-B-17 à R-B-28, puis R-B-22 bis),
PAS fusionné, PAS poussé, `0006` PAS collée, fonction `assistant` PAS redéployée (la version 3 du lot 4 sert toujours) ; `/verify` de clôture par le
chef d'orchestre.** Pour Neegan : un lien web gardé devient une vraie recette — « Lire la recette avec l’assistant » sur la fiche du lien, ou « Garder
et lire » sous une carte de l'onglet Web (le lien gardé et lu d'un geste) ; la fonction `assistant` télécharge la page (jamais le téléphone), lit
d'abord les données que le site publie (JSON-LD `Recipe` : « Lue dans les données de la page : aucun jeton dépensé. »), et seulement sinon fait lire
le texte par le modèle ; l'écran dit « Lue sur {hôte} — vérifie avant d’enregistrer. », l'hôte réel toujours d'abord, le site et l'auteur ensuite sous
« Selon la page : … » ; « Enregistrer » fait du lien la recette (à la première lecture, le titre lu devient son titre), toutes les lignes « à
vérifier » ; « Ouvrir le lien » reste sur toute fiche venue du web ; une adresse en `http:` n'est jamais lue (ni bouton de lecture ni « Réessayer » :
« Ouvrir le lien » et la phrase du refus ; « Garder et lire » n'est pas proposé) ; un échec (site injoignable ou qui refuse les robots, PDF, page trop
lourde ou vide) laisse le lien intact, dit pourquoi et offre « Réessayer » ; une version écrite à la main n'est jamais remplacée sans « Remplacer par
cette lecture ? » (« Ajouter sans remplacer » d'abord), mais une lecture ou une correction de l'assistant, même vérifiée, l'est sans question
(R-B-19) ; la même adresse gardée deux fois est dite, rien d'écrit ; la section « Imports » liste les lectures web, « Réessayer » compris depuis un
autre appareil ; chaque lecture compte pour un appel du quota (60 par jour par défaut, réglable par le secret `ASSISTANT_QUOTA_JOUR`), même sans
jeton. Chiffres : suite **3997/3997** (épinglé 3996 ; départ 3694/3694 ; vague 3997/3997), Node **172/172** sur `51bad50` (125 au
départ, 167 à la vague, 5 de plus à la ronde finale 2 ; registre `verify-51bad50.txt`), `--check` 0, `tsc` 0, pglast `0006` 4 instructions et preuve
12 instructions + 2 blocs `do`, `APP_VERSION 0.10.0`, `DB_VERSION 4`, `sw.js` `cuisine-os-v0.10.0-8`, tous les mutants nommés par la spec § 7.5 et par le plan (C1 à
C24, B1 à B8, T6a à T6j) rouges, aucun survivant (R-B-28 ; deux équivalents déclarés par la spec, M30r et « Annuler » web par `annulerVol`, un
troisième, R18b, au rapport de la tâche 4 ; 338 passages relevés dans les rapports hors ronde finale 2, 352 avec ses 14 mutants, tous rouges), 15
commits de code sur `e411779` (14 de construction jusqu'à `ebbcf10`, puis `51bad50`), puis les deux commits de spec. **Aucune lecture réelle** ;
`0006` jamais jouée sur `mitsu` ; `redirect: 'manual'` jamais mesuré sous le runtime Supabase (c'est la sonde S17). **Gestes, dans l'ordre :** (1)
**le lot A d'abord** (B est empilé sur A) : `0005` collée et prouvée (`0 faux sur 35`), adresse de preuve retirée,
`! git -C ~/projects/mistu merge --ff-only import-cible`, `! git -C ~/projects/mistu push origin main` (paragraphe du lot A, ci-dessous) ; (2) **AVANT
le redéploiement et AVANT tout `push` du lot B**, dans l'éditeur SQL de `mitsu` (`supabase/README.md`, étape 12) : coller
`supabase/migrations/0006_lecture_web.sql` entière (la contrainte `outil` à CINQ valeurs : `recherche-web`, `creation`, `extraction`, `lecture-web`,
`image-web`), puis, collée seule, `notify pgrst, 'reload schema';`, puis jouer la preuve `supabase/proofs/0006_lecture_web.sql` (« Run without RLS »,
rien à remplacer ; lire `999 BILAN` : attendu `0 faux sur 10`, verdict 2.031 `image-web` compris) et coller le tableau dans
`supabase/proofs/RESULTATS-mitsu.md` (section préparée) ; (3) le chef d'orchestre redéploie la fonction `assistant` (`index.ts` et `lecture-web.js`
ont changé depuis la version 3, en dernier dans `ebbcf10` et `51bad50` ; `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb
--no-verify-jwt --use-api`, la version suivante) et joue les sondes de l'étape 12 du README : S13-S16 et S1-S9 sans dépense, **S19** (R-B-23, R-B-22
bis : `https://ybdooerfeziiabsbfxtb.functions.supabase.co/` → 422 `interdit`, sans réservation ni dépense ; ni le README ni la table « Sondes
`lecture-web` » de `RESULTATS-mitsu.md` n'ont encore sa ligne : l'y ajouter), puis S17 (la sonde de redirection, R-B-14) et S18, un appel du quota
chacune sans dépense Anthropic — une redirection opaque à S17 impose une ronde sur `telechargerPage` avant la fusion ; (4)
`! git -C ~/projects/mistu merge --ff-only recette-web` puis `! git -C ~/projects/mistu push origin main` ; ouvrir
`https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : 3997/3997, plus le 404 de `/favicon.ico`) ; (5) preuve réelle sur le
site public, connecté : un lien web → « Garder et lire » (ou « Lire la recette avec l’assistant » sur un lien déjà gardé) : **un** POST
`/functions/v1/assistant` ; sur une page à JSON-LD, l'écran dit « Lue dans les données de la page : aucun jeton dépensé. » (sinon, une lecture par le
modèle : « Texte de la page lu par l’assistant. ») ; « Enregistrer » ; puis `select jour, appels from public.assistant_usage_jour;` (et, pour le
détail, la ligne `lecture-web` de `public.assistant_journal` : 200, 0 / 0 pour un JSON-LD) ; (6) iPhone (le même parcours depuis l'app installée) ;
(7) « clean » en dernier, **après** avoir copié le registre `.superpowers/sdd/2026-10-19-recette-web/` (hors git) dans
`~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet), puis `git worktree remove`. Non prouvé et dettes nommées (R-B-27 : identité du vol non
vérifiée aux écritures de fin, dans les deux machines ; deux machines de vol à garder alignées à la main ; fenêtre sans dialogue avant la transaction
d'« Enregistrer » ; entités 0x80-0x9F retirées ; DoS de regex mesuré sous Node seulement ; spec § 13 : sept points, deux ouverts à défaut appliqué et,
points 3 à 7, les dettes R-B-27) : `CLAUDE.md`, section « Recette web complète », et `docs/architecture.md`, section du lot.

**19 octobre 2026, 19 h 45 — LOT A « IMPORT CIBLÉ ET JOURNAL D'IMPORT » : FINI dans le worktree `~/projects/mistu-import` (branche `import-cible`,
base `main 57babc6`, tête `58bb49b` (dernier commit de code ; le commit de clôture qui pose ces documents le suit), serveur 8088), revu (six tâches à trois lentilles, revue finale de branche, vague finale VF-1 à VF-15, ronde
finale 2 et sa re-revue PROPRE, clôture du chef d'orchestre : m9, m12, m13 ratifiés, VF-16, VF-17), PAS fusionné, PAS poussé, `0005` PAS collée ;
`/verify` FAIT le 19 octobre à 17 h 40 (suite 3694/3694, Node 125/125, `--check` 0, invisibles 0, scan de secrets : deux noms de clés dans des tests, aucune valeur).** Pour Neegan : une recette « Repérée dans ton livre » s'importe depuis son propre écran (`#/recipes/<id>/importer` :
« Importer » sur la fiche du livre, « Importer cette recette » sur sa fiche) — pages photographiées ou choisies et remises dans l'ordre, photo du plat
facultative, puis « Extraire et enregistrer », qui écrit DANS la référence sans passer par l'éditeur (D-3) ; un titre lu qui ne concorde pas demande
« Rattacher quand même ? » avant d'écrire ; une version que tu as écrite n'est jamais remplacée sans « Remplacer par cette lecture ? » ; la section
« Imports », en tête d'Ajouter, garde chaque lecture payée (« Reprendre », « Relancer », « Annuler », « Ignorer ») ; une app fermée en plein vol dit
« La lecture a été interrompue… » au démarrage suivant (90 s), et les lignes terminées s'effacent après 30 jours. La ronde finale 2 a fermé le dernier
Important : « Relire les pages » ne reprend en tête que les pages dont les octets sont sur cet appareil, et une relecture qui ne couvre plus toute la
recette pose la question I-5 au lieu de remplacer d'office. Chiffres : suite **3694/3694** (épinglé 3693 ; départ 3011/3011), Node **125/125**,
`--check` 0, pglast `0005` 23 instructions + 4 fonctions et preuve 37 instructions + 2 blocs `do`, `APP_VERSION 0.9.0`, `DB_VERSION 4`, `sw.js`
`cuisine-os-v0.9.0-13`, 152 mutants joués (tous rouges sauf `hb-ignore`, déclaré équivalent, et M3, survivant nommé, pratiquement inatteignable), 16 commits de
construction sur `7fba2da`, plus la ronde finale 2 (`58bb49b`) et le commit de clôture de la spec. **Aucune extraction réelle** (la preuve § 10 de la
spec n'a jamais été faite) ; `0005` jamais jouée sur `mitsu`. **Gestes, dans l'ordre :** (1) **AVANT tout `push`**, dans l'éditeur SQL de `mitsu`
(`supabase/README.md`, étape 11) : **d'abord** insérer l'adresse de preuve (`exemple.invalid`) dans `private.allowed_users`, puis coller
`supabase/migrations/0005_imports.sql` entière, puis, collée seule, `notify pgrst, 'reload schema';`, puis jouer la preuve
`supabase/proofs/0005_imports.sql` (jetons `A_UUID` et `A_EMAIL` = cette adresse, « Run without RLS », lire `999 BILAN` : `0 faux sur 35`) et coller
le tableau dans `supabase/proofs/RESULTATS-mitsu.md` ; retirer l'adresse de preuve ; (2) après `/verify`, **d'abord** écarter le fichier NON SUIVI
`docs/audits/2026-10-18-import-livres-photos-web.md` de `~/projects/mistu` (identique à celui de la branche : `cmp` muet ; déjà écarté par le chef d’orchestre le 19 octobre, déplacé hors du dépôt, puis `rm`), sinon la fusion
refuse (« untracked working tree files would be overwritten ») ; puis `! git -C ~/projects/mistu merge --ff-only import-cible` ; (3) `! git -C
~/projects/mistu push origin main` (suite publique attendue : 3694/3694, plus le 404 de `/favicon.ico`) ; (4) preuve réelle sur le site public,
connecté : l'écran ciblé `#/recipes/<id>/importer` sur une recette « Repérée dans ton livre », ses photos, « Extraire et enregistrer » — la PREMIÈRE
extraction réelle jamais faite (noter le modèle, la durée, la fidélité, une page dense) ; puis la section « Imports » de la page Ajouter (« Reprendre »,
« Ignorer », « Annuler ») ; puis `select jour, appels from public.assistant_usage_jour;` ; (5) iPhone (même route depuis l'app installée, une app
fermée en plein vol) ; (6) décision de texte VF-16 (spec § 5, sans urgence : dire pourquoi « Remplacer par cette lecture ? » est posée quand des pages
ne sont pas relues ; un libellé pour « Garder ma version » quand la courante est une lecture de l'assistant) ; (7) « clean » en dernier : le registre
`.superpowers/sdd/2026-10-18-import-cible/` est déjà copié dans `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet le 19 octobre) ; le recopier si
la clôture y ajoute quelque chose, puis `git worktree remove`. Non prouvé et dettes nommées (m9, m12, m13 ratifiés à la clôture ; `hb-ignore`
équivalent ; survivant M3 ; I-2 aveugle à la sorte, à trancher au lot B ; `imports` chargé par `getData` à chaque rendu) : `CLAUDE.md`, section
« Importer une recette repérée », et `docs/architecture.md`, section du lot.

**Correction (19 octobre) : le paragraphe « Présentation du serveur » ci-dessous dit « PAS fusionné, PAS poussé » — c'est de l'histoire. Le lot
est EN LIGNE depuis le 18 octobre : fusion et `push` faits par Neegan, `main` = `origin/main` = `57babc6` (commit de docs au-dessus de `778883c`) ;
les lots 4 (« Passerelle de l'assistant ») et 5 (« Présentation du serveur ») sont servis.** Ses autres gestes (preuve réelle d'une recherche
Web, « clean » de `mistu-serveur` après copie de son registre) restent à relire tels qu'écrits.

**18 octobre 2026, 17 h 30 — LOT « PRÉSENTATION DU SERVEUR » : FINI dans le worktree `~/projects/mistu-serveur` (branche
`presentation-serveur`, base `main 3998f97`, serveur 8087), revu et re-revu, PAS fusionné, PAS poussé.** Décision de Neegan après la
première recherche réelle : chaque résultat Web porte une présentation en deux ou trois phrases « comme un serveur qui présente le
plat », puis une ligne « Estimé par l’assistant : ≈ 15 min · facile · 7 ingrédients » (hors sel et poivre), et un bouton « Voir la
recette » qui ouvre la page ; même appel, serveur intact ; `pourquoi` retiré ; `bornerAuMot` (fin du « La recet » coupé). Suite
**3011/3011** (épinglé 3010), Node 101/101, `sw.js` `cuisine-os-v0.8.1-3`, `APP_VERSION 0.8.1`. Commits `d124de6` + `5ab689f` + `778883c`. Revue
adverse (opus) : 0 Critical, 4 Important corrigés en ronde 1, 9 Minor ; re-revue 13/13 ; ronde 2 = hôte nu écarté + résidus (graphèmes parqués). Détail : `CLAUDE.md`, section
« La présentation du serveur ». **Gestes :** `! git -C ~/projects/mistu merge --ff-only presentation-serveur` puis `push` ; preuve réelle :
une recherche Web connecté → présentations et ligne « Estimé par l’assistant », « Voir la recette » ouvre la page ; « clean » après
copie du registre `.superpowers/sdd/2026-10-18-presentation-serveur/`. Hors périmètre, lot suivant si voulu : lire une page
(`web_fetch`), recette complète dans l'app.

**18 octobre 2026, 16 h 54 — LOT « PASSERELLE DE L'ASSISTANT » : EN LIGNE.** Fusion rapide et `push` par Neegan (`main` = `3998f97`, 22
commits), Pages servi à 20 h 51 UTC (`cuisine-os-v0.8.0-6`, `passerelle.js` 200, le code servi ne nomme plus `api.anthropic.com`) ;
**première recherche réelle rendue sur le site public sans clé** (« salade concombre sans gluten 15 minutes », quatre résultats, capture
16 h 54). Non lu encore : `select * from public.assistant_usage_jour;`, `assistant_journal.statut`, la valeur `cles` du GET, le 499.

**18 octobre 2026, 15 h 19 — LOT « PASSERELLE DE L'ASSISTANT » : FINI dans le worktree, fonction DÉPLOYÉE sur `mitsu` (version 3),
`0004` COLLÉE et PROUVÉE par Neegan (20 h 40 UTC : `999 BILAN` = `0 faux sur 20`, `assistant_reserver` visible de PostgREST), puis FUSIONNÉ et POUSSÉ (ci-dessus).** Branche `passerelle-assistant`, worktree `~/projects/mistu-passerelle` (serveur 8086), base
`main` `cdbd6e0`, tête `2a2f838` (19 commits, dont deux commits RESULTATS du contrôleur et les deux de la vague finale `f43e071` serveur et
`2a2f838` app). Pour Neegan : plus de clé à taper ; connecté, l'assistant marche sur tous les appareils (60 appels par compte et par jour,
`claude-sonnet-5-5`, Réglages dit « Vérification… » puis « actif pour … » une fois le serveur répondu) ; la clé est un secret du projet et
l'app n'appelle plus `api.anthropic.com`. Déployée par le contrôleur : v1 17 h 05 UTC (`1590ba8`), v2 18 h 16 UTC (`6d7ed21`), **v3 19 h 19 UTC
(`2a2f838`, `--no-verify-jwt --use-api`, `verify_jwt: false`, `ezbr_sha256 95034efd…`)**, neuf sondes sans dépense identiques aux trois ;
**aucun POST réel**. Revue finale de branche (opus) : 0 Critical, 3 Important (pages non réduites, forme des clés injectées, README racine), 11
Minor ; rulings F-1 à F-14 appliqués, F-15 (double `JSON.parse`) laissé en dette. Suite **2953/2953** (épinglé 2952), Node **101/101**,
`--check` 0, tsc strict 0, pglast OK (12 + 24 instructions), `sw.js` `cuisine-os-v0.8.0-6`, `APP_VERSION 0.8.0`. **Gestes, dans l'ordre :** (1)
FAIT le 18 oct à 20 h 40 UTC : `0004` collée, preuve `999 BILAN` = `0 faux sur 20` (tableau dans `RESULTATS-mitsu.md`, sondes S11-S12 : fonction connue de PostgREST, `anon` refusé 42501) ;
(2) après `/verify` : `! git -C ~/projects/mistu merge --ff-only passerelle-assistant`, puis `push` ; (3) preuve réelle sur le site public,
connecté : « saumon fenouil » → un POST `/functions/v1/assistant` 200, zéro `api.anthropic.com`, Réglages « actif … 60 », puis `select … from
public.assistant_usage_jour;` ; avec la session, la sonde `GET` du README (étape 10) lit `cles` ; couper un appel en vol et lire le 499 dans le
journal ; (4) iPhone avec l'autre compte, rien à configurer ; (5) console Anthropic : révoquer l'ancienne clé, plafond mensuel ; (6) « clean »
après copie du registre `.superpowers/sdd/2026-10-18-passerelle-assistant/`. Non prouvé : `CLAUDE.md`, section du lot.

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
- **Lot passerelle** : (la preuve `0004` est jouée : 20/20 le 18 oct à 20 h 40 UTC, tableau dans `RESULTATS-mitsu.md`) ; **aucun POST réel** (aucune ligne `assistant_journal`, aucun appel à Anthropic, validité du secret non exercée) ; le `GET`
  `{ modele, quotaJour, cles }` avec une session (dont la valeur de `cles`) et `is_allowed` pour une session non admise ; l'abandon du client
  → 499 (prouvé sous Node seulement) ; le préflight d'un vrai navigateur (S1 est un `OPTIONS` à la main) ;
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
  les délais (135 s pour l'assistant) comptent le temps actif (PWA iOS en arrière-plan).

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

Lot A, import ciblé (le plus récent) :
```
cd ~/projects/mistu-import && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8088 http=%{http_code}\n" http://localhost:8088/tests/ || (nohup python3 -m http.server 8088 > /dev/null 2>&1 &)
# suite.cjs charge Playwright depuis le cache npx (~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright) : un ménage du cache npm casse ce lanceur
node ~/projects/mistu-import/.superpowers/sdd/2026-10-18-import-cible/suite.cjs 8088   # attendu : 3694/3694 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 125/125, code 0
```
Lot passerelle (le plus récent) :
```
cd ~/projects/mistu-passerelle && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8086 http=%{http_code}\n" http://localhost:8086/tests/ || (nohup python3 -m http.server 8086 > /dev/null 2>&1 &)
node ~/projects/mistu-passerelle/.superpowers/sdd/2026-10-18-passerelle-assistant/suite.cjs 8086   # attendu : 2953/2953 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 101/101, code 0
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
