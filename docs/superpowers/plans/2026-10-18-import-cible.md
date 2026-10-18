# Lot A « Importer une recette repérée » — plan d'implémentation (rév. 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une recette « Repérée dans ton livre » s'importe depuis son propre écran (photos réorganisables, photo du plat facultative,
« Extraire et enregistrer »), rattachée sans doublon, et aucune lecture payée ne se perd grâce à un journal d'import visible et reprenable.

**Architecture:** un magasin `imports` (IndexedDB, synchronisé, archivé) tenu par des écritures conditionnées (`db.mutate({ conditions })`,
enveloppe `repo.transitionner`) ; un domaine pur `src/domain/import-cible.js` (transitions, discordance, fabrication de la version) ; un
écran `src/ui/import-cible.js` ; la section « Imports » de la page Ajouter ; l'extraction existante (`PasserelleProvider`, outil `extraction`)
amendée côté app seulement.

**Tech Stack:** PWA sans build (ES modules), IndexedDB (`src/core/db.js`, `db.mutate` porte unique), Supabase (synchro par outbox,
migration générée `0005`), suite navigateur `tests/index.html`, `node --test tools/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-18-import-cible-design.md` (**rév. 3.1**). Les décisions D-1 à D-12, les invariants I-1 à I-10 et
les rulings de § 12 (C1-C2, I1-I17, N1-N5, m1-m10, pré-vol) font foi ; ce plan les met en tâches. Rév. 2 du plan : après le pré-vol à trois
lentilles (couverture, cohérence, faisabilité).

## Global Constraints

- **Préconditions.** D-3 (enregistrement sans éditeur) est **confirmée par Neegan** (« oui go », 18 octobre, après question explicite). La preuve réelle
  § 10 (une page de livre lue par l'assistant sur le site public : modèle affiché, durée, fidélité, page dense) est **souhaitée avant la tâche 3** ;
  si elle manque encore, la tâche 3 avance avec `MAX_TOKENS_EXTRACTION = 6000` et la mesure l'ajustera (une constante, aucun secret). Elle n'est
  **pas** dans la clôture.
- Branche `import-cible`, worktree `/Users/neeganmac/projects/mistu-import`, servi sur **8088**. Suite : `node .superpowers/sdd/2026-10-18-import-cible/suite.cjs 8088`
  (attendu au départ : `✅ 3011/3011`, épingle 3010 dans `tests/tests.js:215` ; règle : épingle = N−1). Node : `node --test tools/*.test.mjs`
  (101/101 au départ). `node tools/generer-migrations.mjs --check` : 0. **Chaque tâche rend ces trois verts** (la tâche 1 fige `SYNC_STORES_0003`
  pour cela).
- Aucun changement sous `supabase/functions/`. Aucune clé, aucun secret, aucun appel réseau réel dans les tests (`fetch` injecté, modèle de
  `tests/passerelle.js`), bases jetables (`withDatabase` / `withRepo` ; **`withRepo` pose la capture APRÈS `init()`** : un test qui veut observer
  l'outbox d'une passe de démarrage pose `installCapture` puis rappelle `repo.init()`, comme `tests/assistant-compte.js:244-247`), jamais le
  navigateur MCP partagé.
- Tout texte d'écran par `t('…')` avec son entrée dans `src/i18n/en.js` (apostrophe typographique U+2019). **Filet automatique** : le détecteur
  `sansEntree` de `tests/creer-ia.js` (listes `MODULES_NEUFS` et `CHAINES_NEUVES_AILLEURS`) : chaque tâche d'écran y ajoute son module neuf ou ses
  chaînes neuves. Aucun texte ne nomme le fournisseur ni la base (test de source `Anthropic|Supabase` sur `src/ui/import-cible.js`).
- Après tout changement de `src/`, `sw.js` : `SHELL` complet (modules neufs : `./src/domain/vocabulaire.js` en tâche 1, `./src/domain/import-cible.js`
  en tâche 3, `./src/ui/import-cible.js` en tâche 4) et `VERSION` **monotone** `cuisine-os-v0.9.0-N`. `APP_VERSION = '0.9.0'` dès la tâche 1 ; pins
  à relever : `grep -rn "0\.8\.1\|0\\\\.8\\\\.1" tests/` (sept lignes dans `tests/ajouter.js`, `tests/sync-l3.js`, `tests/recherche-web.js`,
  `tests/assistant-compte.js`, `tests/creer-ia.js`, `tests/passerelle.js`).
- `DB_VERSION = 4`. `imports` déclaré dans `STORES` **juste après `assistant_config` et avant `settings`** (dernier magasin synchronisé ; K-9).
- **Une seule primitive** : `db.mutate` gagne `conditions` ; **aucune méthode `db.transitionner`** ; `MUTATING_METHODS` et son pin
  (`tests/sync.js:47`) inchangés ; tout écran passe par `repo.transitionner` ; un test statique vérifie que `transitionner(` n'apparaît dans
  `src/` que dans `src/model/repo.js` et sous la forme `repo.transitionner(`.
- Commits par chemin nommé (jamais `-A`), message ASCII sans accents, trailer du modèle réel de l'implémenteur
  (`Co-Authored-By: <modele reel> <noreply@anthropic.com>`) puis `Claude-Session: https://claude.ai/code/session_01UbA8VtELjUtu3BwXRGcrBE`.
  Jamais réécrire l'historique.
- Caractères invisibles (U+200B-200D, U+2028/2029, U+202A-202E, U+2060, U+FEFF) : contrôle en Python (`-I`) sur chaque fichier touché, jamais `grep`.
- Un test qui lit le SOURCE n'est admis que pour : les appelants d'`assertVocabulaire` (faible, admis), `SHELL`, le test statique `transitionner(`,
  `Anthropic|Supabase` ; tout le reste par comportement.
- pglast pour le SQL : un venv avec `pglast==8.6` (créer au besoin : `python3 -m venv <scratchpad>/venv-pglast && <scratchpad>/venv-pglast/bin/pip install pglast==8.6`).

## Review Focus

1. **Une archive ZIP faite avant le lot** (format 1, sans `data/imports.json`) doit se restaurer en fusion et en remplacement → tâche 1 (fixture réelle + helper).
2. **« Tarte aux poires » photographiée pour la référence « Tarte aux pommes »** doit ouvrir le dialogue de discordance, et « Tarte aux pommes de ma
   grand-mère » ne doit pas → tâche 3.
3. **Deux onglets** : une écriture conditionnée depuis un état périmé est refusée sans rien écrire ; un démarrage ne marque pas `interrompu` un vol dont
   le battement a moins de 90 s → tâches 1 et 6.
4. **Réponse arrivée après « Annuler »** : rien n'est écrit sur la recette, `reponse_brute` seule est gardée, l'état reste `echec(annule)` → tâche 4.
5. **« Corriger » après un import** : les puces « incertain », « page possiblement manquante » et les étapes entières survivent à la correction d'une
   seule quantité → tâche 5.

---

### Task 1 : Schéma, archives, primitives, vocabulaire et liste figée du générateur

**Files:**
- Modify: `src/model/schema.js` (`DB_VERSION 4`, `APP_VERSION '0.9.0'`, `STORES.imports`, `RELATIONS`, `MAGASINS_AJOUTES_APRES_V1`, `STATUTS_IMPORT`)
- Modify: `src/core/db.js` (`conditions` de `mutate`), `src/model/repo.js` (`transitionner`, `saveBatch(batch, { conditions })`)
- Modify: `src/domain/backup.js` (tolérance des magasins ajoutés après le format 1)
- Create: `src/domain/vocabulaire.js`
- Modify: `src/domain/creation-ia.js`, `src/ui/signet.js`, `src/ui/recipe-edit.js` (appel d'`assertVocabulaire` avant écriture)
- Modify: `src/ui/state.js` (`getData` charge `imports`)
- Modify: `src/sync/tables.js` (`SYNC_STORES_0003` figée, 26 noms), `tools/generer-migrations.mjs` (`0003` rendue depuis `SYNC_STORES_0003`, empreinte épinglée),
  `tools/generer-migrations.test.mjs` (bloc `0003`, l. 202-233 : `nouvelles` vient de la liste figée)
- Modify: `tests/assistant-compte.js` (K-9, six assertions : `DB_VERSION 4` ; 27 magasins synchronisés, dernier `imports` ; les 25 premiers = `0001` ;
  ordre `assistant_config` → `imports` → `settings` ; l. 395 et l. 415 : 25 tables à l'envoi initial, dernière lue `imports`), pins de version (sept lignes)
- Create: `tests/import-cible.js` (`export async function runImportCibleTests({ eq, ok })`), câblé dans `tests/tests.js` après `runPasserelleTests` ;
  `tests/backup.js` exporte `rewriteArchive` ; Create: `tests/fixtures/archive-0.8.1-sans-imports.zip`
- Modify: `sw.js` (`SHELL` + `./src/domain/vocabulaire.js`, `VERSION`)

**Interfaces:**
- Produces: `STATUTS_IMPORT = ['a_lancer','en_cours','a_verifier','enregistre','echec','ignore']` ; `MAGASINS_AJOUTES_APRES_V1 = ['imports']` ;
  `db.mutate({ puts, deletes, clearStores, origin, payloads, conditions })` avec `conditions = { [store]: [{ key, attendus, patch }] }` (`patch` objet
  ou `(courant) => objet` ; condition fausse → `tx.abort()` **et rejet `TransitionRefusee { store, key, statut }`**, pas le rejet générique) ;
  `repo.transitionner(store, key, { attendus, patch, puts = {}, deletes = {}, origin = 'local' })` → fiche écrite (nettoyage des chaînes,
  `updated_at = syncNow()` sur chaque fiche écrite, `emit('change')`) ; `repo.saveBatch(batch, { conditions })` ; `assertVocabulaire(fiche, magasin)`
  → `true`, ou lève `ErreurVocabulaire { magasin, champ, valeur }` ; `SYNC_STORES_0003` (26, dernier `assistant_config`).

- [ ] **Step 1 : tests rouges du schéma**

```js
// tests/import-cible.js — bloc « schéma »
const S = await import('../src/model/schema.js');
eq(S.DB_VERSION, 4, 'schéma : DB_VERSION 4');
const noms = Object.keys(S.STORES);
eq([noms[noms.indexOf('assistant_config') + 1], noms[noms.indexOf('imports') + 1]], ['imports', 'settings'], 'schéma : imports juste après assistant_config, avant settings');
eq(S.STORES.imports, { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['recipe_id', 'recipe_id'], ['status', 'status']] }, 'schéma : clé et index d’imports');
ok(S.SYNC_STORES.at(-1) === 'imports' && S.SYNC_STORES.length === 27 && S.ARCHIVE_DATA_STORES.includes('imports'), 'schéma : 27 synchronisés, imports dernier, archivé');
eq(S.RELATIONS.filter(([c]) => c === 'imports').map(([, p, m]) => [p, m]).sort(), [['edition_id', 'book_editions'], ['scan_session_id', 'scan_sessions']], 'schéma : recipe_id et page_ids sont des pointeurs souples (hors RELATIONS)');
eq(S.MAGASINS_AJOUTES_APRES_V1, ['imports'], 'schéma : magasins ajoutés après le format 1');
eq(S.STATUTS_IMPORT, ['a_lancer', 'en_cours', 'a_verifier', 'enregistre', 'echec', 'ignore'], 'schéma : statuts du journal');
```

- [ ] **Step 2 : test rouge de la montée de version sur base peuplée** (ouvrir une base jetable en version 3 avec le `STORES` d'avant, y poser une recette
  et un livre, fermer, rouvrir avec le schéma courant : la recette est intacte, `imports` existe avec ses trois index).

- [ ] **Step 3 : tests rouges de `db.mutate({ conditions })`, `repo.transitionner` et `repo.saveBatch(…, { conditions })`**

```js
await withDatabase(async (db) => {
  await db.put('imports', { id: 'imp_1', status: 'a_lancer', updated_at: '2026-10-18T00:00:00.000Z' });
  await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] } });
  eq((await db.get('imports', 'imp_1')).status, 'en_cours', 'conditions : écrit quand le statut est attendu');
  let refus = null; try { await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['a_lancer'], patch: { status: 'en_cours' } }] }, puts: { recipes: [{ id: 'rc_non' }] } }); } catch (e) { refus = e; }
  eq([refus?.name, refus?.statut, await db.get('recipes', 'rc_non')], ['TransitionRefusee', 'en_cours', undefined], 'conditions : condition fausse → refus nommé, RIEN d’écrit, pas même les puts');
  const entrees = []; db.onMutate = ({ puts, origin }) => { entrees.push([Object.keys(puts).sort(), origin]); return {}; };
  await db.mutate({ conditions: { imports: [{ key: 'imp_1', attendus: ['en_cours'], patch: (c) => ({ status: 'a_verifier', appels: (c.appels || 0) + 1 }) }] }, puts: { recipes: [{ id: 'rc_x', availability: 'available' }] } });
  eq([entrees, (await db.get('recipes', 'rc_x'))?.id, (await db.get('imports', 'imp_1')).appels], [[[['imports', 'recipes'], 'local']], 'rc_x', 1], 'conditions : patch-fonction, puts et capture dans une seule transaction');
  await db.put('imports', { id: 'imp_2', status: 'echec' });
  const res = await Promise.allSettled([1, 2].map(() => db.mutate({ conditions: { imports: [{ key: 'imp_2', attendus: ['echec'], patch: { status: 'en_cours' } }] } })));
  eq(res.map((x) => x.status).sort(), ['fulfilled', 'rejected'], 'conditions (Review Focus 3) : deux transitions entrelacées, une seule écrit');
});
```
Puis sur base jetable liée à `repo` : `repo.transitionner('imports', id, { attendus, patch: { erreur: { raison: 'x\u0007' } } })` → chaînes de contrôle
retirées, `updated_at` posé, un abonné `change` notifié une fois ; `repo.saveBatch({ imports: [...] }, { conditions })` avec condition fausse → rien
d'écrit ; `db.transitionner` **n'existe pas** (`typeof db.transitionner === 'undefined'`) ; test statique : `transitionner(` n'apparaît dans `src/`
que dans `repo.js` ou précédé de `repo.`. Contrainte d'implémentation : lecture, vérification, appel **synchrone** de `onMutate` et écritures **dans
les rappels `onsuccess` de la même transaction readwrite** (aucun `await` entre : IndexedDB valide la transaction dès que la file est vide) ; la portée
inclut `outbox` seulement si la base la possède (`TEST_STORES` de `tests/sync.js` n'en a pas) ; sur refus, **capturer l'erreur `TransitionRefusee`
dans une fermeture avant `tx.abort()` et la relancer** à la place du rejet générique « Transaction annulée » de `done()`.

- [ ] **Step 4 : tests rouges des archives (Review Focus 1)** — **AVANT de toucher `schema.js`**, générer la fixture réelle : page Playwright (Chrome
  sans tête, même lanceur que la suite) sur `http://localhost:8088/tests/`, `import('../src/domain/backup.js')` et `import('../src/model/repo.js')`,
  base jetable peuplée (un livre, une édition, une référence, une recette avec version), export de l'archive, octets écrits dans
  `tests/fixtures/archive-0.8.1-sans-imports.zip` (committée). Tests : cette archive **réelle** passe l'inspection et se restaure en fusion **et** en
  remplacement ; après restauration, `imports` vaut `[]` ; une archive construite au vol par `rewriteArchive` (exporté de `tests/backup.js`) sans
  `data/imports.json`, sans son entrée `data_files` et sans `counts.imports` se restaure aussi ; un aller-retour **avec** une ligne `imports` la retrouve ;
  une archive où `data/recipes.json` manque est toujours refusée (`Magasin absent ou invalide : recipes`).

- [ ] **Step 5 : tests rouges du vocabulaire**

```js
const V = await import('../src/domain/vocabulaire.js');
let e = null; try { V.assertVocabulaire({ availability: 'dispo' }, 'recipes'); } catch (x) { e = x; }
eq([e?.name, e?.champ, e?.valeur], ['ErreurVocabulaire', 'availability', 'dispo'], 'vocabulaire : valeur hors liste refusée, nommée');
e = null; try { V.assertVocabulaire({ verification_state: 'ok' }, 'recipes'); } catch (x) { e = x; } eq(e?.champ, 'verification_state', 'vocabulaire : état de vérification hors liste refusé');
eq(V.assertVocabulaire({ original_title: 'x' }, 'recipes'), true, 'vocabulaire : champ absent toléré, rend true');
e = null; try { V.assertVocabulaire({ status: 'fini' }, 'imports'); } catch (x) { e = x; } eq(e?.champ, 'status', 'vocabulaire : statut d’import hors liste refusé');
const src = await lire('../src/domain/creation-ia.js') + await lire('../src/ui/signet.js') + await lire('../src/ui/recipe-edit.js');
eq((src.match(/assertVocabulaire\(/g) || []).length >= 3, true, 'vocabulaire : les trois fabricants existants l’appellent (test de source, faible, admis)');
```

- [ ] **Step 6 : tests Node rouges du générateur** (`tools/generer-migrations.test.mjs`) : `SYNC_STORES_0003.length === 26` et `at(-1) === 'assistant_config'` ;
  `0003` rendue est **identique octet pour octet** au fichier commité (empreinte `37f9f80d62cf82457b177f35979892ce7deeaf2067567a506228e145ad8efd39`,
  à recalculer par `shasum -a 256` et à corriger ici si elle diffère) **même avec `imports` dans `SYNC_STORES`** ; le bloc « une table neuve » (l. 202-233)
  compare à `SYNC_STORES_0003`, plus au `SYNC_STORES` vivant.
- [ ] **Step 7 : lancer la suite et Node, lire le rouge.**
- [ ] **Step 8 : implémenter** (`schema.js`, `db.js`, `repo.js`, `backup.js` — `validateRows` : un magasin de `MAGASINS_AJOUTES_APRES_V1` absent n'est pas
  une erreur ; `restoredStores` : `payload.stores[name] ?? []` ; décomptes et `data_files` ne l'exigent pas —, `vocabulaire.js`, les trois appels,
  `getData`, `tables.js`, le générateur, K-9, pins, `SHELL`/`VERSION`).
- [ ] **Step 9 : suite verte, épingle relevée, Node vert (compte relevé), `--check` 0.**
- [ ] **Step 10 : commit** `Schema imports, conditions de mutate, archives tolerantes, vocabulaire, SYNC_STORES_0003 figee (lot A, tache 1)`.

---

### Task 2 : Migration `0005`, preuve et README

**Files:**
- Modify: `tools/generer-migrations.mjs` (`0005_imports.sql` pour `SYNC_STORES.filter((s) => !SYNC_STORES_0003.includes(s))`, quatre fonctions recréées
  avec les 27), `tools/generer-migrations.test.mjs`
- Create: `supabase/migrations/0005_imports.sql` (générée), `supabase/proofs/0005_imports.sql`
- Modify: `supabase/README.md` (étape 11 : coller `0005`, `notify pgrst, 'reload schema';`, preuve ; « un client plus ancien refuse une archive plus
  récente : “Description de magasin absente ou inconnue” / “Décompte de magasin inconnu : imports” → mets l'app à jour »),
  `supabase/proofs/RESULTATS-mitsu.md` (section « Preuve `0005` — à jouer »)

**Interfaces:**
- Consumes: `SYNC_STORES_0003` (tâche 1). Produces: `renderMigrations()` rend quatre cibles.

- [ ] **Step 1 : tests Node rouges** : `0005` ne crée que `public.imports` (une `create table`), avec `revoke all on public.imports from anon`, colonnes
  générées `edition_id`, `recipe_id`, `status` (`(data->>'…')`), index `imports_recv`, RLS du gabarit, quatre fonctions avec les 27 noms (`'imports'`
  présent dans chacune) ; `--check` sur une copie sans `0005` rend 1 ; la preuve finit par `rollback;`, sans adresse ni valeur de `data` ; test node du
  README (étape 11 présente, ordre des gestes).
- [ ] **Step 2 : rouge lu ; implémenter** (gabarit : le rendu de `0003`) ; preuve sur le modèle de `supabase/proofs/0003_assistant_config.sql`
  (table et RLS ; policies `authenticated` select/insert/update ; delete sous `app.purge` ; `revoke anon` ; colonnes générées ; `sync_push` d'une
  ligne `imports` sous un utilisateur de preuve, acceptée puis relue ; `999 BILAN`) ; pglast (`parse_sql` + `parse_plpgsql`), compte d'instructions
  dans le rapport.
- [ ] **Step 3 : Node vert, `--check` 0, suite inchangée.**
- [ ] **Step 4 : commit** `Migration 0005 imports generee, preuve et README etape 11 (lot A, tache 2)`.

---

### Task 3 : Domaine de l'import ciblé et extraction amendée

**Files:**
- Create: `src/domain/import-cible.js`
- Modify: `src/domain/llm.js` (`PARSER_SYSTEM`, `validateParsedRecipe` durci et exporté, `BORNES_EXTRACTION`, `MAX_TOKENS_EXTRACTION`, `REPONSE_BRUTE_MAX`,
  `complete(messages, { maxTokens, signal })` + `this.stopReason`, `extraireRecette(provider, images, { signal, maxTokens = MAX_TOKENS_EXTRACTION })`,
  `extraireIndex(provider, images, { signal })`, enveloppes `extractRecipeFromImages(provider, images)` / `extractIndexFromImages(provider, images)`)
- Modify: `src/domain/lines.js` (`parseStepsBlock(text, { parParagraphe = false })`)
- Modify: `src/model/repo.js` (`ajouterPages`), `src/ui/import.js` (`startScanSession` l'appelle)
- Modify: `src/core/image.js` (`preparerPhotoLocale(blob)` extraite de `poserCouverture`), `src/ui/livre-ajout.js` (`poserCouverture` l'utilise)
- Modify: `tests/import-cible.js`, `tests/passerelle.js`, `sw.js` (`SHELL` + `./src/domain/import-cible.js`, `VERSION` +1)

**Interfaces:**
- Produces (`src/domain/import-cible.js`) :
  `TRANSITIONS = { a_lancer: ['en_cours','ignore'], en_cours: ['a_verifier','echec'], a_verifier: ['enregistre','a_lancer','ignore'], echec: ['en_cours','a_lancer','ignore'], enregistre: [], ignore: [] }` ;
  `transitionPermise(de, vers)` ; `MOTS_VIDES` (liste fermée de la spec § 4.3.3, possessifs compris) ; `motsDistinctifs(titre)` → `string[]`
  (`normalizeText`, découpage sur espaces, apostrophes, traits d'union, points, mots vides retirés) ;
  `discordance(resultat, reference)` → `{ ok, raison: null | 'titre_nul' | 'titre' | 'page', titreLu, pageLue }` ;
  `deplacerPage(pageIds, id, sens)` / `retirerPage(pageIds, id)` → nouveau tableau ;
  `fabriquerExtraction(resultat, { reference, versions, pages, pageIds, edition, convention, importId, modele, photo: { sha256, origin } | null, maintenant })` →
  `{ recipe, version, pageUpdates, remplacement }` avec `remplacement = versions.some((v) => v.provenance?.generated_by !== 'ai')` ; **appelle `assertVocabulaire`** ;
  `ageDepuis(iso, maintenant)` → `{ n, unite: 'min' | 'h' | 'j' }` (l'écran traduit) ; `RAISONS_ECHEC` (liste fermée § 4.4 : passerelle + `annule`, `coupe`,
  `illisible`, `hors_bornes`, `vide`, `interrompu`, `incertain`) ; `seanceDUnImportCible(seance, imports)` → booléen (import `kind: 'recette'` avec
  `recipe_id`, statut non terminé, même `scan_session_id`).
- Produces (`llm.js`) : `ErreurExtraction` (`raison` ∈ `coupe | illisible | hors_bornes | vide`) ;
  `BORNES_EXTRACTION = { titre: 200, ligne: 300, etape: 2000, notes: 2000, lignes: 80, etapes: 60, sousRecettes: 20, sousRecetteTitre: 200, sousRecetteRenvoi: 40, champsIncertains: 40, champIncertain: 200 }` ;
  `MAX_TOKENS_EXTRACTION = 6000` ; `REPONSE_BRUTE_MAX = 16000` ; `extraireRecette` → `{ recette, stopReason, modele, texteBrut }` ; `extraireIndex` →
  `{ index: { entries, uncertain }, stopReason, modele, texteBrut }`.
- Produces (`repo.js`) : `repo.ajouterPages(files, { edition_id, session_id, import_id, import })` → `{ session, pages, docs, importId }` sans navigation ni
  toast : octets par `putFile` avant ; avec `import_id`, **un** `repo.transitionner('imports', import_id, { attendus: ['a_lancer','a_verifier','echec'], patch: (c) => ({ page_ids: [...c.page_ids, ...neufs] }), puts: { source_documents, source_pages, scan_sessions } })` ;
  avec `import: { id, kind, recipe_id, edition_id, device_id }` (première photo : la ligne n'existe pas), un `saveBatch` qui écrit la ligne `a_lancer`
  (avec `scan_session_id` et `page_ids`) et les lignes de séance ensemble ; sans l'un ni l'autre, le chemin existant.
- Produces (`core/image.js`) : `preparerPhotoLocale(blob)` → `Blob` JPEG (lève `ErreurImage('trop_lourde' | 'type' | 'trop_grande' | 'indecodable')`).

- [ ] **Step 1 : tests rouges du domaine** (`tests/import-cible.js`)

```js
const D = await import('../src/domain/import-cible.js');
for (const de of Object.keys(D.TRANSITIONS)) for (const vers of Object.keys(D.TRANSITIONS)) eq(D.transitionPermise(de, vers), D.TRANSITIONS[de].includes(vers), `transitions : ${de} → ${vers}`);
eq(D.TRANSITIONS, { a_lancer: ['en_cours', 'ignore'], en_cours: ['a_verifier', 'echec'], a_verifier: ['enregistre', 'a_lancer', 'ignore'], echec: ['en_cours', 'a_lancer', 'ignore'], enregistre: [], ignore: [] }, 'transitions : la table exacte de la spec');
eq(D.motsDistinctifs('Tarte aux pommes de ma grand-mère'), ['tarte', 'pommes', 'grand', 'mere'], 'discordance : mots vides et possessifs retirés, accents aplatis, trait d’union coupé');
eq(D.motsDistinctifs("Soupe à l'oignon"), ['soupe', 'oignon'], 'discordance : apostrophe coupée');
const ref = { original_title: 'Tarte aux pommes', printed_page: 132 };
eq(D.discordance({ title: 'Tarte aux poires', printed_page: 133 }, ref).raison, 'titre', 'discordance (Review Focus 2) : poires sur pommes → dialogue');
eq(D.discordance({ title: 'Soupe à l’ail', printed_page: null }, { original_title: 'Soupe à l’oignon', printed_page: null }).raison, 'titre', 'discordance : ail sur oignon → dialogue');
eq(D.discordance({ title: 'Tarte aux pommes de ma grand-mère', printed_page: 132 }, ref).ok, true, 'discordance : titre plus long qui contient tous les mots → concordant');
eq(D.discordance({ title: 'TARTE AUX POMMES', printed_page: 136 }, ref).raison, 'page', 'discordance : page à plus de 3 → dialogue');
eq(D.discordance({ title: 'Tarte aux pommes', printed_page: null }, ref).ok, true, 'discordance : page lue nulle → le critère de page ne joue pas');
eq(D.discordance({ title: null, printed_page: 132 }, ref).raison, 'titre_nul', 'discordance : titre illisible → dialogue');
eq(D.deplacerPage(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b'], 'ordre : monter'); eq(D.deplacerPage(['a', 'b'], 'a', -1), ['a', 'b'], 'ordre : monter en tête ne change rien');
eq(D.ageDepuis('2026-10-18T10:00:00Z', '2026-10-18T12:30:00Z'), { n: 2, unite: 'h' }, 'âge : heures, valeur structurée');
```
Puis `fabriquerExtraction` : `recipe.original_title` = celui de la référence et `provenance.titre_lu` = le titre lu ; `uncertain` recopié par
ligne ; étapes = une par entrée du modèle, texte multi-lignes intact, `position` 1..n, clés de `detectTimers` présentes ; `notes` → `version.notes` ;
`printed_page` posé si vide ; `availability` `available` / `partial` (`incomplete`) / `partial` (`missing_page`) ; `verification_state`
`to_verify` ; `parent_version_id` = `current_version_id` de la référence ; `provenance` complète (`source_page_ids`, `source_document_id`,
`generated_by: 'ai'`, `model`, `edition_id`, `convention_snapshot`, `import_id`, `incomplete`, `missing_page`, `titre_lu`) ; `photo_sha256` et
`photo_origin` posés ; une page absente de `pages` ignorée ; `remplacement` vrai avec une version manuelle **ou** une `correction`, faux avec une
`extraction` `ai` seule ; `assertVocabulaire` appelée (test de source étendu à `import-cible.js` : ≥ 4 appelants). `seanceDUnImportCible` : vrai
pour un import ciblé non terminé, faux pour `kind: 'index'`, pour `recipe_id: null`, pour `enregistre` / `ignore`.

- [ ] **Step 2 : tests rouges de l'extraction amendée** (`tests/passerelle.js`) : la consigne envoyée contient `"incomplete"`, `"missing_page"`,
  la phrase « garde-la entière » et plus `"language"` ; `max_tokens` vaut 6000 ; un `signal` déjà levé → aucun POST, erreur `annule` ;
  `stop_reason: 'max_tokens'` → `ErreurExtraction('coupe')` ; `{"title":"x","ingredients":[],"steps":[]}` → `vide` ; `'pas du json'` → `illisible` ;
  **table des bornes** : pour chaque entrée de `BORNES_EXTRACTION`, une fixture juste au-dessus → `hors_bornes`, juste à la borne → acceptée ;
  portions / durée / page à `-1`, `NaN`, `'12'` → `null` ; `"incomplete":"oui"` → `false` ; `extraireRecette(provider, images)` rend `{ recette,
  stopReason: 'end_turn', modele, texteBrut }` ; `extractRecipeFromImages(provider, images)` rend la recette seule ; `extraireIndex(provider, images)`
  rend `{ index: { entries, uncertain }, … }` et `extractIndexFromImages(provider, images)` les entrées seules ; `parseStepsBlock('a\nb\n\nc',
  { parParagraphe: true })` → deux étapes et sans option trois.
- [ ] **Step 3 : tests rouges de `repo.ajouterPages`** (`navigate` espionné : non appelé ; un `onMutate` espion voit `source_documents`,
  `source_pages`, `scan_sessions` et `imports` dans le **même** appel avec `import_id` ; `page_ids` ajoutés en fin **par patch-fonction** ; import
  `enregistre` → `TransitionRefusee` et aucune ligne `source_documents`/`source_pages`/`scan_sessions`/`imports` écrite (la ligne `files` posée avant
  reste, assumé) ; première photo avec `import: {…}` → ligne `a_lancer` avec `scan_session_id` et `page_ids` dans le même lot ; `startScanSession`
  passe toujours par là et navigue, lui).
- [ ] **Step 4 : test rouge de `preparerPhotoLocale`** (cas de `poserCouverture` : `trop_lourde` > 25 Mo, `type`, `trop_grande` > 16 Mpx, JPEG 1 200 px ;
  `poserCouverture` reste vert).
- [ ] **Step 5 : rouge lu ; implémenter ; vert.** `PARSER_SYSTEM` fr, texte ajouté mot pour mot : « Si une page semble manquer (étapes qui commencent au
  milieu, ingrédients sans étapes, renvoi à une page absente), mets "missing_page": true ; si la recette est visiblement partielle, mets "incomplete":
  true ; une étape peut tenir sur plusieurs lignes : garde-la entière dans un seul "text". » ; schéma + `"incomplete": boolean, "missing_page": boolean`,
  `"language"` retiré. `SHELL` + `./src/domain/import-cible.js`, `VERSION` +1.
- [ ] **Step 6 : commit** `Domaine import cible, extraction amendee (6000 jetons, stop_reason, signal, bornes), ajouterPages, preparerPhotoLocale (lot A, tache 3)`.

---

### Task 4 : L'écran d'import ciblé

**Files:**
- Create: `src/ui/import-cible.js`
- Modify: `src/app.js` (route `'/recipes/:id/importer'`), `src/ui/state.js` (`ROUTES_DE_SAISIE` + `'/recipes/*/importer'`), `src/ui/book.js` (rangée **sous**
  la carte, hors du `<a>` : « Importer » + « Saisir à la main » ; retrait de « Scanner cette recette » et de `pending_recipe`), `src/ui/recipe.js`
  (« Importer cette recette » primaire sur `reference_only`, « Relire les pages » sur `partial`, retrait de `pending_recipe`), `src/ui/recipe-edit.js`
  (retrait de `pendingRef` / « Oui, rattacher »), `src/ui/add.js` (retrait du seul chemin `#/add?edition=` et de `query.edition`, l. 82 ; `/recipes/new?edition=`
  **reste**, `tests/ajouter.js:683`), `src/i18n/en.js`, `tests/creer-ia.js` (`MODULES_NEUFS` + `./src/ui/import-cible.js` ; `CHAINES_NEUVES_AILLEURS` pour
  `book.js`, `recipe.js`), `sw.js` (`SHELL` + `./src/ui/import-cible.js`, `VERSION` +1)
- Modify: `tests/import-cible.js`, `tests/ajouter.js` (tests de « Scanner cette recette » et de `#/add?edition=` : retirés ou retournés)

**Interfaces:**
- Consumes : tout de la tâche 3 ; `repo.transitionner` ; `repo.ajouterPages` ; `preparerPhotoLocale` ; `sessionAssistant(ctx)`, `carteConnexion(connecter, ctx)`,
  `texteEchecAssistant`, `texteRefusAssistant` (`src/ui/components.js`) ; `pagePourEnvoi` (`llm.js`).
- Produces : `renderImportCible(params, query, ctx, deps)` ; `etatRoute()` → `{ importId, status, pageIds, vol: boolean, discordance: null | { ok, raison, titreLu, pageLue } }` ;
  `DOCUMENT_ID` (`crypto.randomUUID()` à l'import du module) ; `BATTEMENT_MS = 15000` ; **exportés pour la tâche 6** : `lancerExtraction(importId, { ctx, repo, fetch, maintenant })`
  (garde session / en ligne / pages, transition `en_cours`, appel, écriture `a_verifier`, discordance, enregistrement ; refuse si un vol est tenu) et
  `annulerVol(importId)` (abandonne le `fetch` si ce document tient le vol, transition `echec(annule)` ; sinon ne fait rien et rend `false`).

- [ ] **Step 1 : tests rouges de l'écran** (gestes injectés `{ repo, navigate, toast, fetch, pickFiles, maintenant }` ; `fetch` factice qui rend une
  réponse d'extraction valide) :
  - ouverture sur une `reference_only` : en-tête (titre, « {livre} · p. 132 », badge « Repérée dans ton livre »), « 0 photo ajoutée », aucune ligne
    `imports` écrite **tant qu'aucune photo n'est ajoutée**, bouton primaire éteint, « Retour à la fiche » présent ; sur une `available` : toast
    « Cette recette a déjà son texte. » + `navigate('/recipes/<id>')` ; sur un signet : toast du lot suivant ;
  - « Choisir des photos » (`pickFiles` appelé **sans** `capture`) avec deux fichiers → **avant tout appel** : `imports` `a_lancer` avec `page_ids`
    [p1, p2], séance liée, deux `source_pages` ; « 2 photos ajoutées » ; « Photographier » (`capture: 'environment'`, `multiple`) ; « Descendre la page 1 »
    → `page_ids` [p2, p1] et `document.activeElement` = le bouton de la page déplacée ; « Retirer la page 2 » → [p2], `source_pages` compte inchangé ;
    champ « p. imprimée » 133 sur une vignette → `source_pages.printed_page` 133 ;
  - photo du plat : « Choisir une image » → `imports.photo_sha256` + `photo_origin: 'image'`, aperçu `blob:` ; « Prendre une photo » (`capture`) →
    `photo_origin: 'photo'` ; « Remplacer » → nouveau `sha256` ; « Retirer » → `null` ;
  - « Extraire et enregistrer » : **un** POST, images dans l'ordre de `page_ids`, `max_tokens` 6000 ; pendant le vol : `.status[role="status"]` puis `.row`
    avec « Annuler » (R-VIS-8) ; `appels` passe à 1 au départ du `fetch` ; `imports → a_verifier` **avant** toute écriture `recipes` (ordre des
    `db.mutate` espionné) ; puis **une** transaction : `recipes`, `recipe_versions`, `source_pages` (`kind: 'recipe'`, `position` 1..n, `printed_page`),
    `scan_sessions` (`status: 'done'`, `recipe_ids`), `imports` (`enregistre`, `reponse_brute: null`, `finished_at`) ; `navigate('/recipes/<id>?v=…')`,
    toast « Recette importée » ; la recette garde `original_title` et `id`, `availability: 'available'`, `photo_sha256` et `photo_origin` posés ;
  - `reponse_brute` : réponse factice de 20 000 points de code → `reponse_brute` coupée à 16 000 points de code, `resultat` intact,
    `JSON.stringify(ligne imports).length < 512 * 1024` ;
  - **Review Focus 4** : « Annuler » pendant le vol → `fetch` abandonné (signal), `echec(annule)`, texte « Lecture annulée. L'appel a peut-être été
    compté… » ; puis la réponse tardive arrive : **aucune** recette écrite, `reponse_brute` posée, statut toujours `echec` ;
  - **`incertain`** : un `repo` espion dont l'écriture `a_verifier` rejette **une** fois → `echec(incertain)` + phrase I-4 + « Relancer » ; rejette **deux**
    fois → la ligne reste `en_cours` (sans plantage de l'écran, erreur journalisée) ;
  - discordance (titre lu « Tarte aux poires ») : panneau à trois boutons ; « Garder la lecture sans l'enregistrer » → reste `a_verifier`, rien écrit ;
    « Changer les pages » → `a_lancer` ; « Rattacher » → enregistrement ;
  - **I-5 (N4)** : `partial` dont la version courante est **saisie à la main** (ou une `correction`) → « Remplacer par cette lecture ? » ; refus → version
    ajoutée non courante, `source_page_ids` (union), `kind: 'recipe'` et `photo_sha256` posés quand même, `availability`/`verification_state`/`current_version_id`
    inchangés ;
  - référence modifiée en base entre l'ouverture et le clic (`original_title`) → la fiche écrite porte la valeur **récente** (relecture) ; import passé
    `enregistre` par un autre onglet juste avant le clic → `TransitionRefusee`, aucun `put`, écran redessiné ;
  - **table raison → texte, geste** : les neuf raisons de la passerelle (table de `tests/passerelle.js`) + `annule`, `coupe` (« La lecture a été coupée :
    essaie avec moins de pages. »), `illisible` / `hors_bornes` (« L'assistant n'a pas répondu lisiblement. Réessaie. » + « Code : … »), `vide` (« Aucun
    ingrédient ni étape lus sur ces pages. »), `interrompu`, `incertain` ; `en_cours` tenu par un autre document (`document_id_vol ≠ DOCUMENT_ID`) →
    « En cours sur un autre écran », sans « Annuler » ;
  - double clic → un POST ; hors ligne (événement `offline` **après** le rendu) → bouton éteint, zéro POST ; `online` → rallumé ; session absente → carte,
    photos ajoutables, zéro POST ; second passage sur la même recette → le même `imports` est repris (un seul `a_lancer`) ;
  - entrées : fiche `reference_only` → « Importer cette recette » (primaire) navigue vers `/recipes/<id>/importer`, « Saisir à la main » toujours là,
    « Scanner cette recette » absent ; fiche `partial` → « Relire les pages » ; fiche du livre → « Importer » et « Saisir à la main » **ne sont pas
    descendants d'un `a`** et « Importer » navigue ; éditeur : aucune case « Oui, rattacher » ; `#/add?edition=x` n'impose plus de livre ;
    `/recipes/new?edition=` fonctionne toujours (`tests/ajouter.js:683`) ; `grep` de `pending_recipe` dans `src/` : 0 ;
  - `ROUTES_DE_SAISIE` contient `'/recipes/*/importer'` ; `MODULES_NEUFS` contient `./src/ui/import-cible.js` ; `Anthropic|Supabase` absent de
    `src/ui/import-cible.js`.
- [ ] **Step 2 : rouge lu ; implémenter ; vert.** Enregistrement : `fabriquerExtraction` → **une** `repo.transitionner('imports', id, { attendus:
  ['a_verifier'], patch: { status: 'enregistre', reponse_brute: null, finished_at }, puts: { recipes, recipe_versions, source_pages, scan_sessions } })` ;
  `TransitionRefusee` → redessin. Relire la référence (`repo.get`) juste avant. Battement : `setInterval` 15 s pendant le vol, `repo.transitionner` sur
  place (`attendus: ['en_cours']`, `patch: { battement_at }`, `origin: 'device'`), nettoyé en `finally`. `pickFiles` : « Photographier » `{ accept: 'image/*',
  capture: 'environment', multiple: true }`, « Choisir des photos » `{ accept: 'image/*', multiple: true }`.
- [ ] **Step 3 : commit** `Ecran d import cible : pages reorganisables, photo du plat, extraire et enregistrer, discordance, annulation (lot A, tache 4)`.

---

### Task 5 : Fiche, mode cuisine, courses et « Corriger »

**Files:**
- Modify: `src/ui/recipe.js` (bandeau de lecture, état de la version affichée, photo du plat, puces « incertain », texte d'étape `white-space: pre-line`),
  `src/ui/cook.js` (bandeau D-3, `pre-line`) et `src/ui/grocery.js` (bandeau D-3), `src/ui/recipe-edit.js` (mode « une étape par paragraphe » **seulement**
  si une étape de la version de départ porte un saut de ligne : jointure par ligne vide, aide « Une étape par paragraphe (ligne vide entre deux étapes). »,
  aperçu et `save()` avec `parParagraphe: true` ; `reparse()` hérite `uncertain` ; version `correction` hérite `import_id`, `incomplete`, `missing_page`,
  `titre_lu`), `src/ui/components.js` (puce `incertain`, `banniereLecture`, `estExtractionNonRelue`), `src/i18n/en.js`, `tests/creer-ia.js`
  (`CHAINES_NEUVES_AILLEURS` pour `recipe.js`, `cook.js`, `grocery.js`, `recipe-edit.js`), `sw.js` (`VERSION` +1)
- Modify: `tests/import-cible.js`

**Interfaces:**
- Consumes : `recipe_versions.provenance.{import_id, incomplete, missing_page, titre_lu}`, lignes `uncertain`, `recipes.photo_sha256` (tâches 1, 3, 4), `resultat.uncertain_fields`.
- Produces : `banniereLecture(version)` (pure) → `{ date, incertaines, missing_page, incomplete, incertain: texte ≤ 300 points de code } | null` ;
  `estExtractionNonRelue(version)` → booléen.

- [ ] **Step 1 : tests rouges** : fiche d'une recette importée → « Lue par l'assistant le {d} · 2 ligne(s) incertaine(s) · page possiblement manquante » +
  « Incertain : … » coupé à 300 points de code ; état « 7 lignes à vérifier » **de la version affichée** (`?v=` d'une `correction` vérifiée → « Vérifiée ») ;
  photo du plat rendue quand `files` a les octets, rien sinon ; puce « incertain » sur les lignes `uncertain` seulement ; une étape « a\nb » rendue avec
  son saut de ligne (fiche et mode cuisine) ; mode cuisine et courses : bandeau « Lue par l'assistant, non relue » pour une `extraction` à `to_verify`,
  absent pour une `correction` ou après vérification ; **Review Focus 5** : « Corriger », changer une quantité d'une ligne, enregistrer → la ligne
  touchée perd `uncertain`, les autres le gardent, `provenance.incomplete/missing_page/import_id/titre_lu` hérités, étapes multi-lignes entières (zone
  jointe par ligne vide, aide adaptée, `parParagraphe: true`), bandeau toujours là ; **une recette sans étape multi-ligne** garde l'éditeur d'aujourd'hui
  (une étape ajoutée sur une nouvelle ligne reste une étape).
- [ ] **Step 2 : rouge lu ; implémenter ; vert ; `VERSION` +1.**
- [ ] **Step 3 : commit** `Fiche, cuisine, courses et Corriger : lecture visible, heritage des incertitudes (lot A, tache 5)`.

---

### Task 6 : Section « Imports », reprise, journal pour l'éditeur et l'index, démarrage

**Files:**
- Modify: `src/ui/add.js` (section « Imports » avant la grille ; `?section=imports` → section en premier avec le focus ; « Photos conservées » filtrées par
  `seanceDUnImportCible`), `src/ui/book.js` (`seancesOuvertes(ctx, editionId)` filtrée ; « {n} import(s) à reprendre » → `#/add?section=imports`),
  `src/ui/import.js` (`sessionsList` « Séances à reprendre » filtrée ; panneau d'index : journal `kind: 'index'`, verrou, `?import=`),
  `src/ui/recipe-edit.js` (« Extraire avec l'assistant IA » écrit dans le journal `kind: 'recette'`, `recipe_id: null` ; `?import=<id>` préremplit depuis
  `resultat` **revalidé** ; bouton verrouillé pendant l'appel ; `signal`), `src/model/repo.js` (`init()` : passe `interrompu` pour les lignes `en_cours`
  **de cet appareil** dont `battement_at` > 90 s ; purge des `enregistre`/`ignore` de plus de 30 jours par suppression d'origine `local`),
  `src/domain/import-cible.js` (`lignesImports(ctx, { maintenant, documentId, deviceId })`, `cibleReprise(ligne)`), `src/i18n/en.js`, `tests/creer-ia.js`
  (`CHAINES_NEUVES_AILLEURS` pour `add.js`, `import.js`), `sw.js` (`VERSION` +1)
- Modify: `tests/import-cible.js`, `tests/ajouter.js` (« Séance en cours », l. 707-712), `tests/passerelle.js` (panneau d'index et éditeur : journal)

**Interfaces:**
- Consumes : `DOCUMENT_ID`, `lancerExtraction`, `annulerVol` (tâche 4) ; `validateParsedRecipe` (tâche 3) ; `repo.transitionner`.
- Produces : `lignesImports` → `[{ id, kind, titre: { type: 'reference' | 'index' | 'regrouper', texte, livre }, etat (statut), age: { n, unite }, raison, gestes: ['reprendre' | 'relancer' | 'annuler' | 'ignorer' | 'ouvrir_seance'], cible, ailleurs, autreAppareil, referenceAbsente }]`
  (l'écran traduit par `t()`) ; `cibleReprise` : `recette` + `recipe_id` → `/recipes/<id>/importer` ; `recette` sans `recipe_id` → `/recipes/new?import=<imp>` ;
  `index` → `/import?session=<s>&import=<imp>`.

- [ ] **Step 1 : tests rouges** : `lignesImports` (table : un cas par état et par sorte ; `en_cours` tenu par `documentId` → `annuler`, sinon `ailleurs` sans
  `ignorer` ; `a_verifier` sans `resultat` d'un autre appareil → sans `reprendre` ; `echec` d'un autre appareil → `['ignorer']` seulement ; `incertain` →
  phrase I-4 + `relancer` ; `recipe_id` inconnu → `referenceAbsente`, sans geste ; séance `open` sans import → `ouvrir_seance` ; séance d'un import **ciblé**
  non terminé → absente, de retour après `ignore` ; séance où « Regrouper en recette » a écrit un import → **toujours** listée) ; page Ajouter : section
  absente quand vide, rendue avant la grille sinon, `?section=imports` → focus sur la section ; gestes câblés (« Reprendre » navigue vers la cible ;
  « Relancer » → **un** POST via `lancerExtraction`, **aucune** page ni séance en double ; « Ignorer » → `ignore` ; « Annuler » absent pour un vol d'ailleurs) ;
  « Reprendre » sur `a_verifier` → écran en mode « Enregistrer cette lecture », `resultat` **revalidé** (un `resultat` hostile injecté → `echec(illisible)`),
  enregistrement sans appel ; fiche du livre : « 2 imports à reprendre » → `#/add?section=imports` ; « Séance en cours » (`tests/ajouter.js:707-712`) et
  « Séances à reprendre » (`import.js`) filtrées de même ; éditeur : « Extraire avec l'assistant IA » crée `imports{kind:'recette', recipe_id:null}` puis
  `a_verifier` avec `resultat`, bouton éteint pendant l'appel ; `#/recipes/new?import=<imp>` préremplit titre, ingrédients, étapes sans POST ; panneau
  d'index : idem avec `entries`, bouton verrouillé (double clic → un POST) ; `init()` (capture posée puis `repo.init()` rappelé) : **Review Focus 3** :
  `en_cours` avec `battement_at` à −120 s → `interrompu`, à −30 s → intact, d'un autre `device_id` → intact ; `enregistre` et `ignore` vieux de 31 jours →
  supprimés **avec** une entrée d'outbox `delete` (origine `local` ; « À envoyer » monte d'autant, assumé), vieux de 29 jours → intacts ; `echec` vieux de
  60 jours → intact ; la `recipe_version` dont `provenance.import_id` pointe une ligne purgée reste intacte ; battement : écriture d'origine `device`,
  **aucune** entrée d'outbox.
- [ ] **Step 2 : rouge lu ; implémenter ; vert ; `VERSION` +1.**
- [ ] **Step 3 : commit** `Section Imports, reprise par sorte, journal pour l editeur et l index, interrompu et purge au demarrage (lot A, tache 6)`.

---

### Clôture (contrôleur, hors tâche)

Revue finale de branche (panel), vague de corrections, `/verify` (suite, Node, `--check`, scan secrets, invisibles, mutants listés en spec § 7 **plus**
« appel d'`assertVocabulaire` commenté » → rouge), docs (`CLAUDE.md` section du lot, `STATE.md`, `docs/architecture.md`, spec § 12 « ce que la
construction a amendé »), copie du registre `.superpowers/sdd/2026-10-18-import-cible/` dans `~/projects/mistu/.superpowers/sdd/`. Gestes de Neegan :
`0005` + preuve, fusion `--ff-only`, `push`, preuve réelle **de l'écran ciblé** sur le site public (la preuve § 10 de la spec, elle, précède la tâche 3).
