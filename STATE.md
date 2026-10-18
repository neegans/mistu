# STATE.md — Cuisine OS (mistu) — état au 18 octobre 2026 (lot « l'assistant suit le compte » fini dans le worktree)

## Où on en est
**Lot « La configuration de l'assistant suit le compte » (17-18 octobre) : FINI dans le worktree, PAS fusionné, PAS
poussé** — branche `assistant-compte`, worktree `~/projects/mistu-web` (serveur `python3 -m http.server 8083`), base
`main` `66c5d19`, registre `.superpowers/sdd/2026-10-17-assistant-par-le-compte/`. La configuration de l'assistant
(fournisseur, modèle, URL de base, clé) vit dans le magasin `assistant_config` (plus dans `settings`) et suit le compte
sur les hôtes de production seulement (jamais sur `localhost`) ; jamais de conflit à trancher, jamais de suppression
locale (« Aucun » écrit une ligne vide), jamais dans une archive ; passe unique depuis l'ancien `settings.llm`. Serveur
en fichiers seulement : `supabase/migrations/0003_assistant_config.sql` et sa preuve, **pas encore collées sur
`mitsu`**. Neuf tâches, chacune avec au plus une ronde de corrections. Suite **1966/1966** (total épinglé **1965** dans
`tests/tests.js` ; départ 1802/1802), seul le 404 `/favicon.ico` en console ; `node --test tools/*.test.mjs` 45/45 ;
`node tools/generer-migrations.mjs --check` 0 ; empreintes SHA-256 de `0001`/`0002` égales aux valeurs épinglées.
`APP_VERSION 0.6.0`, `DB_VERSION 3`, `sw.js` `cuisine-os-v0.6.0-9`, `SHELL` + `./src/domain/assistant-config.js`.
Spec `docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` (§ 12 : rulings R-CPT-1 à R-CPT-6), plan
`docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`, spec parente § 11 R65, section du lot dans `CLAUDE.md`
(ordre des gestes, procédure « appareil perdu ou clé exposée ») et dans `docs/architecture.md`.

**Lot « confort après preuve » : fusionné et poussé** (`origin/main` = `66c5d19`, lu par `git ls-remote` le 18 octobre ;
le site public n'a pas été relu dans cette session) — branche `confort-web`, registre `.superpowers/sdd/2026-10-17-confort-web/` :
« Liens web gardés » dans Mes livres, « Chercher à nouveau » sur la ligne de la mention K1, date de page en liste
blanche. Suite 1802/1802 (épinglé 1801), remesurée le 18 octobre sur `66c5d19`. Section « Confort après preuve » dans
`CLAUDE.md`.

**Lot « Chercher sur le web avec l'assistant » : LIVE** (fusionné et poussé en `dc7444a`) : l'onglet « Web » lance, sur
une tape, **un** appel à l'API Anthropic avec l'outil de recherche web ; au plus 5 liens pris dans les résultats bruts
du serveur ; un appel réel mesuré le 17 octobre sur le site public (« puttanesca »). Spec
`docs/superpowers/specs/2026-10-17-chercher-sur-le-web-design.md` (§ 11.2 ; I-C et geste R2 amendés par le lot de
l'assistant), registre `.superpowers/sdd/2026-10-17-chercher-sur-le-web/`.

## Ce qui n'est pas prouvé
- **Lot assistant** : aucune passe réelle contre `mitsu` (ni `0003` ni sa preuve n'ont tourné ; leur syntaxe seulement
  est vérifiée hors ligne, par pglast v8.6) ; l'iPhone ; le chemin « nouveau client, ancien serveur » (factice
  seulement) ; l'état « appareil lié sans session » de K-10 (prédicat injecté) ; K-12 au niveau de la page (câblage lu
  au source) ; les appels réels de « Tester », de l'extraction et du fournisseur compatible OpenAI.
- **Lot confort** : le parcours réel de bout en bout par Neegan.
- **Lot web** : statut et corps d'un compte sans recherche web, `pause_turn`, `refusal`, taille du corps, coût.
- **Safari et l'iPhone** partout (aucun WebKit ici) ; `target="_blank"` et `navigator.onLine` depuis une PWA installée ;
  le délai de 45 s compte le temps actif (PWA iOS en arrière-plan).

## Reste à faire (gestes de Neegan, dans cet ordre)
1. **`0003` d'abord** : éditeur SQL de `mitsu`, coller `supabase/migrations/0003_assistant_config.sql` entier ; puis la
   preuve `supabase/proofs/0003_assistant_config.sql` (deux adresses `exemple.invalid` dans `private.allowed_users`,
   quatre jetons remplacés, « Run without RLS », ligne `999 BILAN`, verdicts dans `supabase/proofs/RESULTATS-mitsu.md`
   **sans aucune valeur de `data`**, adresses retirées) — `supabase/README.md`, étape 8 bis.
2. **Seulement après** : revue finale et `/verify` du chef d'orchestre ; copier
   `~/projects/mistu-web/.superpowers/sdd/2026-10-17-assistant-par-le-compte/` dans `~/projects/mistu/.superpowers/sdd/` ;
   `! cd ~/projects/mistu && git merge --ff-only assistant-compte` (ou rebaser si `main` a bougé depuis `66c5d19`) ;
   `! git -C ~/projects/mistu push origin main`.
3. Mac, site public : Réglages → Assistant IA montre la configuration et « La configuration de l’assistant suit ton
   compte sur tes appareils connectés. » ; iPhone : « Connexion avec Google » (mesure iOS due depuis le 13 octobre), la
   clé arrive à la passe suivante (« Envoyer maintenant » la force).
4. Faire tourner la clé Anthropic (elle a transité par un chat) et poser un plafond de dépense mensuel sur le workspace.
5. Registres à copier dans `~/projects/mistu/.superpowers/sdd/` **avant** tout `git worktree remove` (le registre vit à
   la racine du worktree et meurt avec lui) : `2026-10-17-chercher-sur-le-web/` et `2026-10-17-confort-web/` (copie
   non vérifiée), puis ceux des lots ISBN et L1-L2 (constaté le 17 octobre : `2026-10-14-identifier-un-livre-fiable`
   partiel, `2026-10-12-compte-et-stockage-l1-l2` absent). Deux worktrees VibeForge : ne pas toucher.
6. Gestes restants des lots précédents : parcours iPhone/Safari du lot ISBN, clé Google Books (`docs/google-books.md`),
   « clean » des worktrees `mistu-isbn` et `mistu-sync` une fois leurs registres copiés.

## Lots suivants (décisions du 17 octobre, spec web § 10 R11)
- Mistu reste **personnel** : pas de passerelle serveur ni de clé commune ; depuis ce lot la clé suit le compte de
  Neegan, et le mur reste le plafond du workspace Anthropic. D5 (sous-domaine dédié) reste recommandé.
- **Lot 2 « Créer avec l'IA »**, en option, sur les versions de recette existantes et leur provenance.
- **Lot 3 refonte visuelle** (références du kit). Un lot à la fois.
- Au prochain lot qui touche le générateur, après le collage de `0003` : figer `SYNC_STORES_0003` et épingler
  l'empreinte de `0003`.
- Parqués : lire la page trouvée pour en tirer une fiche recette ; dettes des lots web et assistant (`CLAUDE.md`,
  sections des lots) ; lot ISBN (R-ISBN-9, R-ISBN-11, S3, S4, C6, C7, D6).

## Reprendre
```
cd ~/projects/mistu-web && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8083 http=%{http_code}\n" http://localhost:8083/tests/ || (nohup python3 -m http.server 8083 > /dev/null 2>&1 &)
node ~/projects/mistu-web/.superpowers/sdd/2026-10-17-assistant-par-le-compte/suite.cjs 8083   # attendu : 1966/1966 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 45/45, code 0
```
Ordre des gestes du lot : § « Reste à faire », points 1 et 2 (`0003` AVANT le `push`).

## Pièges connus
`\uXXXX` nu dans un appel d'outil = caractère réel écrit (écrire `\u{XXXX}`, vérifier les octets) ; `grep` de ce shell
appelle `ugrep` en UTF-8 : les caractères invisibles se mesurent en Python (commande de la ligne 21 du plan du lot,
lue par script, jamais retapée) ; le total épinglé de `tests/tests.js` se lit dans « obtenu : X » puis se pose, jamais
deviné ; messages de commit en ASCII sans accents ; jamais `git add -A` (`.superpowers/` non suivi) ; ne jamais toucher
`~/projects/mistu` depuis ce worktree (l'arbre principal est servi sur 8080) ; aucune requête ne lit
`public.assistant_config.data` (la clé y est en clair).
Pas de `DECISIONS.md` ni `TASKS.md` dans ce dépôt : la traçabilité vit dans les specs (§ 11 / § 12), `CLAUDE.md` et les
registres SDD.
