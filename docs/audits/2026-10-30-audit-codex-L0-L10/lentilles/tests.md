# Audit de la qualité des tests — Mistu / Cuisine OS, lot Codex 29-30 oct. 2026 (copie figée 247b2e5)

Question : sur les 11 538 assertions épinglées (`tests/tests.js:691`), combien prouvent un comportement, combien sont
creuses, tautologiques ou vertes même si le code est cassé ?

Méthode : (1) balayage quantitatif par scripts Node écrits dans ce dossier (`sweep.mjs`, `boucles-awaits.mjs`,
`patch-analyse.mjs`, sorties `sweep-lots.md`, `boucles-awaits.md`, `patch-analyse.md`) ; (2) lecture d'un échantillon de
39 tests dans 20 fichiers du lot ; (3) analyse « mutant » par lecture de 8 gardes ; (4) exécution de `node --test` dans
la copie. Aucun navigateur, aucun réseau, aucun git, rien écrit hors de ce dossier.

## 1. Ce que compte le total épinglé

- `eq`/`ok`/`close` poussent dans `results` (`tests/tests.js:243-246`). `eq` compare par `JSON.stringify` : deux
  `undefined`, ou deux FONCTIONS quelconques, sont « égaux » (JSON.stringify(fn) = undefined). Un `eq(x.prop, undefined)`
  reste vert si `prop` est renommée.
- Chaque suite est appelée dans `try { await runX({eq, ok}) } catch (e) { ok(false, 'runX : …') }` (114 filets,
  `tests.js:390-690`). Une exception = un rouge + toutes les assertions suivantes de la suite disparaissent → l'épingle
  `eq(results.length, 11538)` rougit. C'est un bon mécanisme : une suite qui plante ne passe pas inaperçue.
- Sites d'appel statiques : 9 674 dans `tests/*.js` (hors `tests.js`) + 235 inline dans `tests.js` dont 114 filets qui ne
  comptent jamais au vert ≈ 9 795 sites effectifs pour 11 538 assertions exécutées → ≈ 1 740 assertions (15 %) viennent de
  boucles ou d'aides appelées plusieurs fois. Dans le lot neuf : 421 sites sur 3 651 (11,6 %) sont dans une boucle
  (`boucles-awaits.md`), presque tous des paramétrages légitimes (cas distincts : 7 mutations concurrentes dans
  `l0-traductions.js:71`, deux modes merge/replace dans `l7-archives.js:36`, 6 codes HTTP dans
  `l6-passerelle-brut.js:58`). Aucun « 40 configurations × assertion identique » trouvé dans la suite navigateur (les
  « 40 configurations » de STATE.md sont un parcours Chrome, pas la suite).

## 2. Périmètre du diff (`diff-tests.patch`, un seul diff écrasé, 168 fichiers)

- 139 fichiers NEUFS (l0…l10, correctifs-*, 2 fixtures) : 3 651 sites d'assertion, 10 365 lignes ajoutées.
- 29 fichiers ANCIENS modifiés : 214 sites ajoutés, 229 retirés (net −15) ; 54 attentes changées à libellé conservé ;
  127 assertions retirées dont le libellé ne réapparaît pas (`patch-analyse.md`). Détail § 7.
- Total : 7 117 → 11 538 (+4 421). Le diff est écrasé : la trajectoire commit par commit (question i) n'est PAS
  observable ici ; STATE.md annonce chaque étape en hausse (+592, +689, +492, +430, +179, +236, +242, +35).

## 3. Balayage par lot (sites d'appel statiques, `sweep-lots.md`)

| lot | fichiers | lignes | ok+eq+close | a. lit le source | b. trivial | catch vide | setTimeout/sleep | textContent/includes | for/forEach | imports src |
|---|---|---|---|---|---|---|---|---|---|---|
| l0 | 4 | 714 | 180 | 0 | 0 | 0 | 11 | 82 | 19 | 14 |
| l1 | 5 | 874 | 224 | 0 | 0 | 0 | 3 | 49 | 16 | 39 |
| l2 | 11 | 1278 | 306 | 1* | 1 | 0 | 6 | 47 | 34 | 48 |
| l3 | 4 | 453 | 164 | 0 | 0 | 0 | 5 | 32 | 8 | 10 |
| l4 | 11 | 752 | 304 | 0 | 1 | 0 | 15 | 59 | 25 | 26 |
| l5 | 19 | 1287 | 495 | 1* | 2 | 0 | 6 | 30 | 39 | 41 |
| l6 | 28 | 1054 | 595 | 0 | 6 | 1 | 12 | 94 | 47 | 65 |
| l7 | 17 | 742 | 434 | 0 | 2 | 3 | 11 | 94 | 22 | 29 |
| l8 | 15 | 430 | 348 | 0 | 0 | 2 | 9 | 68 | 18 | 34 |
| l9 | 4 | 276 | 145 | 2* | 4 | 1 | 4 | 17 | 7 | 6 |
| l10 | 8 | 357 | 225 | 0 | 0 | 0 | 16 | 61 | 18 | 11 |
| correctifs | 7 | 834 | 231 | 0 | 0 | 1 | 1 | 44 | 19 | 21 |
| i2/i3 (anciens) | 8 | 1690 | 422 | 0 | 0 | 2 | 15 | 84 | 25 | 4 |
| anciens | 32 | 30147 | 5601 | 20 | 9 | 13 | 151 | 2045 | 344 | 39 |

\* les 4 hits « a » du lot sont des `new URL('../styles.css', import.meta.url)` (chargement de feuille de style), pas une
lecture de source. La colonne « imports src » ne compte que les `import … from '../src/…'` statiques : 36 fichiers du lot
n'en ont aucun mais chargent le vrai module par `await import('../src/…')` (vérifié un par un, § 4).

### Verdict par patron (lot neuf, comptage exhaustif, pas l'échantillon)

- **a. Lecture du source : 0.** Les anciens `ok(sw.includes("'./src/x.js'"))` (9 dans ajouter/carnet/classement/
  couverture/passerelle/recherche-web/sync-l4) ont été convertis en `lireLivraison().chemins.includes(…)`
  (`tests/livraison-fixture.js`) : on lit le manifeste de livraison, un artefact de build, pas le source. Acceptable.
  Les 20 `.toString()` restants sont dans les anciens fichiers (hors lot).
- **b. Trivial : 17 sites** (0,5 %). `ok(typeof X==='function')` : `l2-livre-mutations.js:76`, `l4-brouillons.js:5`,
  `l5-raccords.js:85`, `l6-lecture-exports.js:14-15`, `l7-cuisine-ecran.js:24`, `l9-navigation.js:9,25,33,35`.
  `ok(true, …)` : `l5-transferts-source.js:9`, `l6-commandes-traduction.js:8`, `l6-versions-structurees.js:8,16`.
  Les `ok(true)` suivent un appel qui « ne doit pas lever » : le filet de suite rougirait sur exception, mais l'assertion
  elle-même ne peut jamais rougir.
- **c. Faux qui remplacent le code testé : le module testé est toujours le vrai.** `withRepo`
  (`tests/sync-fixture.js`) lie le VRAI `src/model/repo.js` à une base IndexedDB temporaire et installe la vraie capture
  d'outbox. Les doubles sont périphériques : `fetch`, transport réseau, stockage de fichiers, ServiceWorker/MessageChannel
  (`l10-livraison.js:3-6`), ResizeObserver (`l7-cuisine-ecran.js:34`), speechSynthesis. UNE exception notable :
  `tests/transport-factice.js` en mode `serveur:true` RÉIMPLÉMENTE en JS l'arbitrage SQL de `sync_push` (son en-tête
  l'assume : « un arbitre qui emprunterait la règle du client ne pourrait jamais le contredire »). 8 fichiers du lot
  l'utilisent ; 12 assertions portent directement sur l'état du faux serveur (`eq(serveur.ligne(...))`,
  ex. `l2-corbeille-sync.js:38-39`) : elles prouvent le client contre une copie du serveur, pas le serveur.
  Le serveur réel n'est couvert que par les scripts `prover-*` (§ 6). Autre double interne : `l10-conservation.js:8-14`
  teste `protegerSortieEditeur` contre un contrôleur d'éditeur FACTICE (le vrai éditeur n'arrive qu'à la suite suivante,
  l.47).
- **d. Boucles gonflantes : non.** 421 sites en boucle, paramétrages réels (cas distincts, libellé incluant le cas).
- **e. Exceptions avalées / await manquants / délais.** 7 `catch {}` vides dans le lot, tous suivis d'une assertion
  discriminante (`l7-cuisine-persistance.js:35` → `eq(p?.versions[0].etat,'source_invalide')` ; `l7-sync.js:27` →
  `ok(valide)`). 97 « appels async sans await » signalés par heuristique : TOUS faux positifs (`run('x', () =>
  withRepo(...))` rend la promesse à un `run` qui l'attend). 0 await manquant réel trouvé. Délais : 101 `setTimeout` dans
  le lot, en très grande majorité dans des `attendre(pred)` bornés qui LÈVENT au bout de 100-250 itérations (jamais un
  vert par chance) ; quelques `pause()` fixes (50 ms, `l9-dialogues.js:2`) pour la restauration du focus → risque de
  flakiness, pas de faux vert.
- **f. Texte d'écran sans événement : 0 trouvé.** Les toasts sont neutralisés (`toast:()=>{}`) ; quand un texte est
  affirmé, une lecture de base suit (`l1-corbeille-ui.js:39-44` puis `eq(await repo.get(...), avant)`,
  `l2-livre-mutations.js:37-40` puis `eq((await repo.all('book_editions')).length,1)`).
- **Refus non motivé (patron supplémentaire, le plus répandu) :** 66 `ok(await refuse(fn))` avec une aide qui rend
  `true` pour N'IMPORTE QUELLE exception (`l1-corbeille-archive.js:5`, `l1-corbeille-domaine.js:9`,
  `l2-corbeille-archive.js:10`, `l2-corbeille-domaine.js:10`, `l5-archives.js:9`, `correctifs-reperes.js:8`) + 43
  `catch{refus=true}` inline ≈ **109 assertions** (3 % du lot) où une garde remplacée par un TypeError ou une faute de
  signature reste verte. En face, ≈ 35 refus à code précis (`e.code==='stock_change'`, `eq(e.code,code)` dans
  `correctifs-brouillons.js:14`, `motif()` qui rend `e.raison` dans `correctifs-thermomix-securite.js:14`). Codex a
  lui-même corrigé ce défaut dans `i3-thermomix.js:23` (ancien `refused` acceptait toute `raison`, le nouveau exige la
  raison attendue) — preuve que les gardes I3 d'origine n'avaient jamais été discriminées.
- **`eq(…, undefined)` : 26** dans le lot, surtout de vraies absences (`db.get` après suppression). Faibles :
  `l3-navigation.js:43,87,100` (`.cleEntree` : une propriété renommée reste verte), `l5-complements-recette.js:6`,
  `l4-rendement.js:22`.

### Estimation chiffrée sur le lot (3 651 sites, comptage exhaustif des patrons)

creux ≈ 17-25 sites (≈ 0,5 %) · faibles ≈ 150 (≈ 4 % : 109 refus non motivés, 12 sur le serveur factice, ~8
`eq(undefined)` fragiles, ~20 assertions dans des suites à double interne) · comportement ≈ 95 %.
Sur l'échantillon LU (biaisé vers les lignes suspectes, § 4) : 6/39 creux, 9/39 faibles, 24/39 comportement.
## 4. Échantillon lu : 39 tests, 20 fichiers du lot

Légende : **C** = comportement (le test rougit si le code visé change) · **F** = faible (vert pour de mauvaises
raisons possibles, ou double testé) · **X** = creux (ne peut pas rougir seul).

| # | fichier:ligne | classe | justification |
|---|---|---|---|
| 1 | correctifs-thermomix-securite.js:18-21 | C | 1,5 L + 1 L → `'capacite'` exact ; témoin 1,2 L → `null` (l.21). Retirer la garde rend `null` → rouge. |
| 2 | correctifs-thermomix-securite.js:38-40 | C | 1800 s accepté, 1801 s → `'vapeur_cumulee'`. Borne testée des deux côtés. |
| 3 | correctifs-thermomix-securite.js:79-94 | C | VRAI écran `renderThermomixRoute`, `fetch` injecté (1 appel compté), texte dangereux absent du DOM, réglage structuré présent. |
| 4 | correctifs-thermomix-securite.js:19 | F | Libellé « précision basse ne masque pas la somme » : `verifierVolume` (thermomix.js:222) code 2200 en dur et ignore `volume_bol_l` ; le test passe parce que la précision n'est pas lue, pas parce qu'elle est contrée. |
| 5 | correctifs-reponses-json.js:7-12 | C | 4 habillages acceptés → `'proposition'`, 5 ambiguïtés → `'json'`, habillage + vitesse 10 → `'vitesse'` (métier non contourné). |
| 6 | l6-passerelle-brut.js:58-62 | C | 6 statuts HTTP → raison exacte, `reponseBrute` null, et `!JSON.stringify(r).includes('PRIVE')` (aucune fuite d'en-tête). |
| 7 | l6-passerelle-brut.js:64-67 | C | `corpsMax` = taille → accepté ; taille − 1 → `'reponse_illisible'` sans préfixe. Octets comparés un à un. |
| 8 | l6-passerelle-brut.js:70-74 | C | flux annulé (`annulations===1`) et `appels < 7` : le corps trop grand n'est pas tiré jusqu'au bout. |
| 9 | l0-traductions.js:46-59 | C | 2e connexion IndexedDB supprime la recette pendant l'édition ; `eq(snapshot, avant)` prouve le refus atomique (versions, pages, séances, outbox). |
| 10 | l0-traductions.js:61-69 | C | fusion concurrente : favori/note/photo/repères posés par un autre `save` sont conservés après « Enregistrer ». |
| 11 | l1-corbeille-domaine.js:26-29 | F→C | l.26-28 : `ok(await refuse(...))` catch-all (un TypeError passe) ; sauvé par l.29 `eq(getSnapshot, avant)` qui rougirait si l'écriture passait. |
| 12 | l1-corbeille-domaine.js:48-52 | C | changement de compte : octets ET lien refusés, snapshot (recipes, files, outbox) identique ; puis acceptés ensemble sous compte null. |
| 13 | l1-corbeille-domaine.js:102-106 | C | capture du DELETE d'un reste : `[op, recipe_id, expected_cycle_id, historique]` exacts dans l'outbox. |
| 14 | l2-corbeille-domaine.js:34-49 | F | 10 × `ok(await refus(...))` catch-all consécutifs, sans snapshot entre chacun : une faute de signature de `repo.save` rendrait tout vert. |
| 15 | l2-corbeille-sync.js:38-39 | F | `trash.reponse.accepted[0].operation_id` et `serveur.ligne(...).trash_mode` : assertions sur l'arbitre FACTICE (`transport-factice.js`), pas sur `sync_push_v2`. |
| 16 | l2-livre-mutations.js:25-31 | C | couverture après changement de cycle : refus, `getFile === undefined` et journal inchangé (`eq([…],[undefined, avant])`). |
| 17 | l2-livre-mutations.js:55-67 | C | résultat payé ancien : non appliqué, bouton désactivé, relecture explicite, `expected_edition_cycle_id` adopté par le geste seul, `appels === 0`. |
| 18 | l3-navigation.js:43 | F | `eq(n.retourConnu(...).cleEntree, undefined)` : si `cleEntree` est renommée, vert à vie (JSON.stringify(undefined)). |
| 19 | l4-editeur-recette.js:19-22 | C | `modifierIngredient` : seule la ligne touchée passe `to_verify`, la voisine est identique (`eq(mod…[1], p…[1])`), même valeur → objet identique. |
| 20 | l4-editeur-recette.js:35-40 | C | rendement de 201 caractères conservable mais non publiable ; identités d'étapes dupliquées refusées ; champ hors modèle refusé. |
| 21 | l5-index-stockage.js:17-25 | C | 600 entrées Unicode : fragments bornés à 64, chaque ligne ≤ 262 144 octets JSONB mesurés, reconstruction exacte en ordre inverse, source non mutée. |
| 22 | l5-index-stockage.js:33-43 | F | 5 altérations → `catch { refused = true }` sans code : une archive qui lèverait pour une autre raison (fixture cassée) resterait verte. |
| 23 | l5-transferts-source.js:7-8 | C | 701 lignes → `['begin','part','part','finish']`, `row_count` 701, chaque commande ≤ `LIMITES_SOURCES.commande` mesurée. |
| 24 | l5-transferts-source.js:9 | X | `ok(true,'toutes empreintes vérifiables')` après une boucle d'`await` : ne peut pas rougir ; seul le filet de suite attraperait une exception. |
| 25 | l5-index-vol.js:20-40 | C | moitié gauche écrite AVANT le départ de la droite (assertion depuis l'intérieur du `lire` injecté), 3 appels, reprise ne repaie que la droite. |
| 26 | l6-versions-structurees.js:8 et 16 | X | `ok(true, …)` après `await executer(...)` ; `refuse` (l.7) exige `e.code` (bien), mais ces deux-là sont des témoins inertes. |
| 27 | l6-depot-gardes.js:12-14 | C | 3 altérations de la capture (texte, sha, projection) → `etat 'invalide'`, titre vide dans la liste. |
| 28 | l6-lecture-exports.js:14-15 | X | `ok(typeof E.toMarkdown==='function')` puis `if (E.toMarkdown)` : le vrai test est derrière, l'assertion typeof est du remplissage. |
| 29 | l7-archives.js:28-33 | C | archive altérée APRÈS inspection → refus avant écriture, `timer_launches` vide ; format abaissé refusé. |
| 30 | l7-archives.js:50-53 | C | course injectée par façade `mutate` (ligne modifiée pendant la transaction) → refus, `ok(atteinte)`, snapshot = état concurrent. |
| 31 | l7-cuisine-ecran.js:31 | C | clic « suivant » puis relecture DB : `done_step_ids` qualifié par version A, jamais B (même id d'étape). |
| 32 | l7-cuisine-ecran.js:24 | X | `ok(typeof root.actualiserCuisine==='function')` au milieu d'assertions DOM réelles. |
| 33 | l8-sync.js:17-19 | C | `composerLots` ordonne create avant consommation ; `retirerEnvoi` refusé ; RPC nommé `'sync_push_v2'` ; capacité 0 → `sends===0` et `'incompatible'`. |
| 34 | l8-inventaire-mutations.js:10 | C | `refused = e.code==='stock_change'` : refus à code précis après édition de note. |
| 35 | l8-inventaire-persistance.js:10 | C/F | `repo.remove` → `e.code==='stock_protege'` (C) ; mais `repo.save` ancien → `catch{refused=true}` (F). |
| 36 | l9-dialogues.js:11-12 | C | `confirmDialog` danger : nom accessible, focus initial sur « Annuler », promesse `false`, focus rendu au déclencheur. |
| 37 | l9-dialogues.js:42-49 | C | dialogues métier ouverts puis annulés : `repo.all('inventory')` et `cook_history` vides (présentation sans écriture). |
| 38 | l9-navigation.js:9,25,35 | X | `ok(typeof api==='function'); if(!api) return;` : vert trivial ; si l'API manque, les assertions suivantes disparaissent (l'épingle rougit, pas ce test). |
| 39 | l10-hors-ligne-medias.js:17-21 | C | vrai `createMoteur`, 1 GET compté, PNG réel décodé, outbox vide ; PNG corrompu → `'illisible'` et 0 GET ; note concurrente pendant réception → `'perime'`. |

Lectures complémentaires sans entrée au tableau (toutes C) : `l10-livraison.js:7-13` (réponse avec champ en trop →
`'reponse_invalide'`, silence → `'delai'`, `dispose` libère le singleton), `l10-demarrage.js:13-20` (8 scénarios de
démarrage, marqueur sans jeton ni URL), `l10-conservation.js:36-42` (deux demandes partagent un flush, formulaire arrivé
pendant le flush invalide le succès, portée remplacée refuse le résultat tardif), `correctifs-brouillons.js:22-40`
(abandon pendant un appel en vol, réponse tardive sans résurrection, compte changé dans la transaction → code exact).

Lisibilité : une large part du lot est écrite en lignes de 400 à 1 200 caractères (`l7-cuisine-persistance.js:55`,
`l8-sync.js:28`, `l10-hors-ligne-medias.js:12`). Ce n'est pas un faux vert, mais le propriétaire ne peut pas relire ces
tests sans outil ; un diff futur y sera illisible.

## 5. Mutants lus (g) : la garde retirée, le test rougit-il ?

| # | garde (source) | test | verdict en lecture |
|---|---|---|---|
| 1 | Thermomix capacité du bol — `thermomix.js:232` `if (total > capacite) erreur('capacite')` | `correctifs-thermomix-securite.js:18` attend `'capacite'` pour 2,5 L | **ROUGE** : sans garde `valide` rend `null`, `eq(null,'capacite')` échoue. Témoins l.21 (2,2 L → null) et l.46 (eau vapeur comptée). |
| 2 | Thermomix vapeur cumulée — `thermomix.js:304` `vapeur > 1800 → 'vapeur_cumulee'` | l.40 (1801 s) | **ROUGE** ; témoin l.38 à 1800 s exact. |
| 3 | Thermomix mixage chaud — `thermomix.js:293` `vitesse > 2 && (chaude||inconnue||!froid_confirme) → 'froid_non_etabli'` | l.62, l.66 ; `i3-thermomix.js:75,77` (raison exigée depuis ce lot) | **ROUGE** : chaîne exacte attendue ; une autre garde qui tirerait donnerait une autre chaîne → rouge aussi. Témoin l.64. |
| 4 | Thermomix huile seule — `thermomix.js:296` | l.58 ; témoin l.60 (huile sans chauffe → null) | **ROUGE**. |
| 5 | Thermomix eau vapeur (plafond 2200 g `thermomix.js:102`, minimum 500 g l.299, pas de réapprovisionnement l.301-302) | l.41-42 (10 000 / 2 201 → `'eau_vapeur'`), l.55 (absente), l.53 (après vidange) | **ROUGE** pour les trois. |
| 6 | Corbeille, cycle périmé — `repo.js:546` `cycle.id !== c.expected_cycle_id → ErreurCycleRecette('cycle_change')` | `l1-corbeille-domaine.js:26` + snapshot l.29 | **ROUGE mais non motivé** : sans garde l'écriture réussit → `refuse()` rend `false` → rouge, et l'outbox gagne une entrée → snapshot rouge. En revanche une garde qui lèverait pour une mauvaise raison (TypeError) resterait VERTE. |
| 7 | Écriture conditionnée `absente: true` — `repo.js:434` (`lireCondition`) et le moteur `db.mutate` | `l1-corbeille-domaine.js:39-41` ; `l7-observations-base.js:44-46` | **PARTIEL** : au niveau du MOTEUR, la collision est prouvée (`l7-observations-base.js:44-46` : `absente:true` sur une ligne présente → `db.get('rows','b') === undefined`, aucune notification) → ROUGE si la condition est ignorée. Au niveau du DÉPÔT, l.39 (création sans condition refusée) est couvert par une AUTRE garde (`creation_refusee`, repo.js:542) et l.41 ne prouve que l'acceptation : retirer la branche `absente` de `lireCondition` (repo.js:434) ne rougit aucun test du lot lu. |
| 8 | Bornes d'index — `index-stockage.js:52` (résultat > 4 Mio), :133 (> 64 fragments → `'too_large'`), :138 (fragment ≤ 262 144) ; découpage 499 lignes `transferts-source.js:20` | `l5-index-stockage.js:19-21`, `l5-transferts-source.js:7` | **MIXTE** : fragment ≤ 262 144 → ROUGE si la borne est relevée (l.21 mesure chaque ligne) ; 499 lignes → ROUGE (701 lignes donneraient une seule « part ») ; mais **« plus de 64 fragments → too_large » n'est atteint par aucun test** (600 entrées font quelques fragments) et « résultat > 4 Mio » non plus → ces deux gardes peuvent être retirées sans rouge. |

Bilan g : 6 gardes sur 8 rougiraient vraiment ; la 6e rougit mais ne distingue pas une garde d'un plantage ; la 7e est
en partie couverte par une autre garde ; la 8e a deux bornes jamais atteintes.
## 6. Les « preuves » PostgreSQL de Codex (h)

Ce que sont les 29 `tools/prover-*.mjs` : des GÉNÉRATEURS de SQL. Chacun importe les vrais modules de `src/domain/*`
pour calculer des vecteurs (empreintes, commandes signées), écrit sur stdout un script `psql` (`\set ON_ERROR_STOP on`,
`begin; … rollback;`, assertions sous forme de `do $$ … raise exception … $$`), et termine par un `select '<n> … vérifiés'
as bilan`. Le compteur est tenu par le script lui-même. Usage documenté une seule fois, en commentaire :
`tools/prover-sources-canon.mjs:2` « node tools/prover-sources-canon.mjs > preuve.sql ; psql -v ON_ERROR_STOP=1 -f
preuve.sql ».

- **Hors `node --test`** : aucun n'est un `.test.mjs` ; `node --test tools/*.test.mjs` ne les touche pas.
- **Exigent un PostgreSQL local** où les migrations 0001→0013 sont appliquées : le SQL généré appelle
  `public.sync_push_v2`, insère dans `private.allowed_users` et `auth.users`, pose `set role authenticated` et un
  `app.proof_uid`. Deux scripts (`prover-cuisine-concurrence.mjs`, `prover-inventaire-concurrence.mjs`) lancent
  eux-mêmes `child_process` (deux sessions psql). La preuve à deux sessions `supabase/proofs/0008_corbeille_concurrence.cjs`
  exige `L1_PROOF_LOCAL=1`, `PROOF_PSQL=…` et un serveur sur `127.0.0.1:55439` (« cluster jetable local préparé pour L1 »).
- **Aucun lanceur, aucun README, aucune mention** : `grep -rn "prover-"` sur AGENTS.md, CLAUDE.md, STATE.md, README.md,
  docs/ ne rend rien. La préparation du cluster (initdb, port 55439, application des migrations, rôles) n'est documentée
  nulle part dans la copie. Les traces invoquées (`.superpowers/sdd/2026-10-29-l1-publication/…`,
  `…/l5/production-application.json`) sont ABSENTES de la copie (pas de dossier `.superpowers`).
- **Ce que dit le registre** (`supabase/proofs/RESULTATS-mitsu.md:541-547, 565-567, 579-581`) : « exécutées sur
  PostgreSQL local jetable pendant la construction, puis le serveur arrêté » ; « preuves mutantes exclusivement locales » ;
  « aucune preuve de mutation exécutée sur la production ».
- **Pas de réseau** (bien) ; les scripts n'exigent aucune clé.

Verdict : les « 327 assertions PostgreSQL » (L5), « 212 + 132 ACL » (L6), « 201 vecteurs … 140 ACL » (L8) sont des
REÇUS d'exécution unique, relus par Codex, non rejouables par le propriétaire sans reconstruire un cluster dont la
recette n'existe pas dans le dépôt. Ce n'est pas un filet durable : une régression SQL future ne sera vue par aucune
commande du projet. Les deux seuls tests Node « SQL » (`tools/corbeille-sql.test.mjs`, `tools/corbeille-livres-sql.test.mjs`)
vérifient qu'un générateur reproduit octet pour octet le fichier de migration (test « doré » d'un texte), pas un
comportement de la base.

## 7. Le total épinglé et les fichiers anciens (i)

- Le diff fourni est un seul diff écrasé (7 117 → 11 538) : impossible d'y voir une baisse intermédiaire. STATE.md
  déclare des hausses à chaque lot ; l'exactitude par commit n'est pas vérifiable ici.
- **Les anciens fichiers ont perdu 229 lignes d'assertion et en ont gagné 214** (`patch-analyse.md`) ; 127 libellés
  retirés ne réapparaissent pas. Le gros : `tests/couverture.js` (−32/+10) — les scénarios `supprimerLivreVide`
  (`{ok:true}`, `lecture_en_cours`, `import_lie`, `non_vide`, atomicité, toasts…) sont supprimés parce que la fonction
  refuse désormais toujours (`src/ui/book.js:58` → `corbeille_requise`, un seul test le dit : couverture.js, ligne
  ajoutée « L2 C09 : ancien appel refuse et demande la corbeille »). Légitime si la fonctionnalité est retirée, mais
  STATE.md écrit « aucun scénario retiré » / « +N sans suppression » à chaque lot : inexact au niveau des assertions.
  Autres retraits : `ajouter.js` (−13 nets : menus d'en-tête, « Liens web gardés », version 0.21.1),
  `carnet.js` (−11 nets : jetons de thème, filtres « De mes livres/Du web », T4 « Voir les n recettes »),
  `classement.js`, `creer-ia.js`.
- **54 attentes changées à libellé conservé.** La plupart suivent l'écran (« FR » → « Français », `.cook` →
  `.cuisine-contenu`, « Original » → « Sources »). Trois méritent l'œil :
  - `tests/i3-integration.js` « session modifiée reçue refusée à la reprise » : `ok(a)` devient `ok(a || b)` (élargi).
  - `tests/index-livre-ecran.js` « une page : le geste dit « Lire la page (1 appel) » » attend désormais
    `'Lire la page (3 appels au plus)'` : le libellé ment sur ce qui est testé.
  - `tests/classement.js` T-D19 : notes `''` → `undefined` (changement de contrat silencieux) ;
    `tests/import-cible.js` startScanSession : 7 pages → 6 (idem).

## 8. Suite Node (`node --test --test-concurrency=1 tools/*.test.mjs`, exécutée dans la copie)

Bilan exact (`node-test.log`) : **tests 271, pass 271, fail 0, cancelled 0, skipped 0, todo 0, duration 9 212 ms,
code de sortie 0.** 12 fichiers : `assistant-index` 67, `assistant-lecture-web` 30, `assistant-logique` 35 (la fonction
Edge `assistant`, via `tools/faux/supabase.mjs`), `generer-migrations` 87, `verifier-vendor` 7, `livraison-*` 8,
`generer-livraison` 2, `fichiers-node` 2, `lien` 2, deux tests SQL « dorés ». Seuls 4 imports de `src/` : la suite Node
couvre la passerelle et les générateurs, pas l'application. « Node 271/271 » ne dit rien de `src/`.
Aucune lecture de source (`readFileSync` de `src/`, `.toString()`) dans ces tests.

## 9. Ce qui est solide (à dire au propriétaire)

- L'infrastructure : `withRepo` = vraie base IndexedDB temporaire, vrai `repo.js`, vraie capture d'outbox, remise en
  place garantie (`tests/sync-fixture.js`). Les suites d'écran montent les vrais `render*` avec `fetch` injecté
  (règle AGENTS.md respectée : aucun appel réel).
- Les gardes Thermomix : raison exacte attendue + témoin positif à la borne, jusqu'au vrai écran
  (`correctifs-thermomix-securite.js`). C'est le meilleur fichier du lot.
- Concurrence réelle côté client : deuxième connexion IndexedDB (`l0-traductions.js:52`), façade `mutate` qui modifie
  pendant la transaction (`l7-archives.js:52`, `l8-sync.js:44`), `QuotaExceededError` injecté dans `onMutate`
  (`l7-archives.js:57`), vrai moteur de synchronisation avec stockage factice (`l10-hors-ligne-medias.js`).
- Octets et bornes mesurés, pas supposés (`l6-passerelle-brut.js`, `l5-index-stockage.js:21`,
  `l5-transferts-source.js:8`).
- L'épingle du total + les 114 filets de suite : une suite qui plante ne peut pas passer pour verte.

## 10. Ce qui est fragile (par ordre d'importance)

1. ≈ 109 refus « n'importe quelle exception » (corbeille L1/L2, archives L5, repères) : remplacer la garde par un plantage
   reste vert. Correctif mécanique : `motif()` → `eq(motif(...), 'code')` comme dans `correctifs-thermomix-securite.js:14`.
2. Le serveur SQL n'a aucun filet rejouable (§ 6) ; la suite navigateur le remplace par une copie JS
   (`transport-factice.js`) que 12 assertions prennent pour cible.
3. Deux bornes d'index jamais atteintes (`too_large` à 64 fragments et 4 Mio) ; `absente:true` non isolée au niveau du
   dépôt (§ 5, mutants 7-8).
4. 17 assertions creuses (`ok(true)`, `typeof === 'function'`) : négligeable en nombre, mais elles gonflent un total qui
   sert d'argument.
5. Lisibilité : lignes de 400-1 200 caractères ; le propriétaire ne peut pas relire ni diffuser ces tests.
6. STATE.md : « aucun scénario retiré » contredit par 127 assertions anciennes disparues (dont 22 légitimes de
   `supprimerLivreVide`) ; libellés périmés (`index-livre-ecran.js` « 1 appel » → 3).
