# Lot A « Importer une recette repérée » — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une recette « Repérée dans ton livre » s'importe depuis son propre écran (photos réorganisables, photo du plat facultative,
« Extraire et enregistrer »), rattachée sans doublon, et aucune lecture payée ne se perd grâce à un journal d'import visible et reprenable.

**Architecture:** un magasin `imports` (IndexedDB, synchronisé, archivé) tenu par des transitions compare-and-set ; un domaine pur
`src/domain/import-cible.js` (transitions, discordance, fabrication de la version) ; un écran `src/ui/import-cible.js` ; la section
« Imports » de la page Ajouter ; l'extraction existante (`PasserelleProvider`, outil `extraction`) amendée côté app seulement.

**Tech Stack:** PWA sans build (ES modules), IndexedDB (`src/core/db.js`, `db.mutate` porte unique), Supabase (synchro par outbox,
migration générée `0005`), suite navigateur `tests/index.html`, `node --test tools/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-18-import-cible-design.md` (rév. 2). Les décisions D-1 à D-12, les invariants I-1 à I-10 et
les rulings de § 12 font foi ; ce plan les met en tâches.

## Global Constraints

- Branche `import-cible`, worktree `/Users/neeganmac/projects/mistu-import`, servi sur **8088**. Suite : `node .superpowers/sdd/2026-10-18-import-cible/suite.cjs 8088`
  (attendu au départ : `✅ 3011/3011`, épingle 3010 dans `tests/tests.js:215` ; règle : épingle = N−1). Node : `node --test tools/*.test.mjs`
  (101/101 au départ). `node tools/generer-migrations.mjs --check` : 0.
- Aucun changement sous `supabase/functions/`. Aucune clé, aucun secret, aucun appel réseau réel dans les tests (`fetch` injecté, modèle
  de `tests/passerelle.js`), bases jetables (`withDatabase` / `withRepo`), jamais le navigateur MCP partagé.
- Tout texte d'écran par `t('…')` avec son entrée dans `src/i18n/en.js` (apostrophe typographique U+2019 dans les chaînes de l'app).
- Après tout changement de `src/`, `sw.js` : `SHELL` complet (modules neufs : `./src/domain/import-cible.js`, `./src/domain/vocabulaire.js`,
  `./src/ui/import-cible.js`) et `VERSION` **monotone** `cuisine-os-v0.9.0-N`. `APP_VERSION = '0.9.0'` dès la tâche 1 ; pins `v0\.9\.0-\d+` /
  `'0.9.0'` dans `tests/ajouter.js`, `tests/sync-l3.js`, `tests/recherche-web.js`, `tests/assistant-compte.js`, `tests/creer-ia.js`,
  `tests/passerelle.js` (chercher `0.8.1`).
- `DB_VERSION = 4`. `imports` déclaré dans `STORES` **juste après `assistant_config`** (dernier magasin synchronisé ; K-9 : la réception
  s'arrête à la première table inconnue).
- Commits par chemin nommé (jamais `-A`), message ASCII sans accents, trailer du modèle réel de l'implémenteur
  (`Co-Authored-By: <modele reel> <noreply@anthropic.com>`) puis `Claude-Session: https://claude.ai/code/session_01UbA8VtELjUtu3BwXRGcrBE`.
  Jamais réécrire l'historique.
- Caractères invisibles (U+200B-200D, U+2028/2029, U+202A-202E, U+2060, U+FEFF) : contrôle en Python (`-I`) sur chaque fichier touché, jamais `grep`.
- Un test qui lit le SOURCE n'est admis que pour les listes d'appelants (`assertVocabulaire`) et `SHELL` ; tout le reste par comportement.

## Review Focus

1. **Une archive ZIP faite avant le lot** (format 1, sans `data/imports.json`) doit se restaurer en fusion et en remplacement → test tâche 1.
2. **« Tarte aux poires » photographiée pour la référence « Tarte aux pommes »** (pages voisines) doit ouvrir le dialogue de discordance,
   et « Tarte aux pommes de ma grand-mère » ne doit pas → test tâche 3.
3. **Deux onglets** : une transition depuis un état périmé est refusée sans écriture ; un démarrage ne marque pas `interrompu` un vol dont le
   battement a moins de 90 s → tests tâches 1 et 6.
4. **Réponse arrivée après « Annuler »** : rien n'est écrit sur la recette, `reponse_brute` seule est gardée, l'état reste `echec(annule)` → test tâche 4.
5. **« Corriger » après un import** : les puces « incertain », « page possiblement manquante » et les étapes entières survivent à la correction
   d'une seule quantité → test tâche 5.

---

### Task 1 : Schéma, archives, primitives et vocabulaire

**Files:**
- Modify: `src/model/schema.js` (`DB_VERSION`, `APP_VERSION`, `STORES.imports`, `RELATIONS`, `MAGASINS_AJOUTES_APRES_V1`, `STATUTS_IMPORT`)
- Modify: `src/core/db.js` (`transitionner`, `MUTATING_METHODS`)
- Modify: `src/domain/backup.js` (tolérance des magasins ajoutés après le format 1)
- Create: `src/domain/vocabulaire.js`
- Modify: `src/domain/creation-ia.js`, `src/ui/signet.js`, `src/ui/recipe-edit.js` (appel d'`assertVocabulaire` avant écriture)
- Modify: `src/ui/state.js` (`getData` charge `imports`)
- Modify: `tests/assistant-compte.js` (K-9 : 25 tables, dernière `imports`), `tests/sync.js` ou le test statique de la porte unique (ajout de `transitionner`), pins de version
- Create: `tests/import-cible.js` (`export async function runImportCibleTests({ eq, ok })`), câblé dans `tests/tests.js` après `runPasserelleTests`
- Modify: `sw.js` (`SHELL` + `./src/domain/vocabulaire.js`, `VERSION`)

**Interfaces:**
- Produces: `STATUTS_IMPORT = ['a_lancer','en_cours','a_verifier','enregistre','echec','ignore']` (schema.js) ;
  `MAGASINS_AJOUTES_APRES_V1 = ['imports']` ;
  `db.transitionner(store, key, { attendus, patch, puts = {}, origin = 'local' })` → `Promise<fiche écrite>` ou lève `TransitionRefusee`
  (`{ store, key, statut }`) ; `assertVocabulaire(fiche, magasin)` (lève `ErreurVocabulaire { magasin, champ, valeur }`).

- [ ] **Step 1 : tests rouges du schéma**

```js
// tests/import-cible.js — bloc « schéma »
const S = await import('../src/model/schema.js');
eq(S.DB_VERSION, 4, 'schéma : DB_VERSION 4');
eq(Object.keys(S.STORES).indexOf('imports'), Object.keys(S.STORES).indexOf('assistant_config') + 1, 'schéma : imports juste après assistant_config');
eq(S.STORES.imports, { keyPath: 'id', indexes: [['edition_id', 'edition_id'], ['recipe_id', 'recipe_id'], ['status', 'status']] }, 'schéma : clé et index d’imports');
ok(S.SYNC_STORES.at(-1) === 'imports' && S.ARCHIVE_DATA_STORES.includes('imports'), 'schéma : imports synchronisé et archivé, dernier reçu');
eq(S.RELATIONS.filter(([c]) => c === 'imports').map(([, p, m]) => [p, m]).sort(), [['edition_id', 'book_editions'], ['scan_session_id', 'scan_sessions']], 'schéma : recipe_id et page_ids sont des pointeurs souples (hors RELATIONS)');
eq(S.MAGASINS_AJOUTES_APRES_V1, ['imports'], 'schéma : magasins ajoutés après le format 1');
eq(S.STATUTS_IMPORT, ['a_lancer', 'en_cours', 'a_verifier', 'enregistre', 'echec', 'ignore'], 'schéma : statuts du journal');
```

- [ ] **Step 2 : test rouge de la montée de version sur base peuplée** (fixture : ouvrir une base jetable en `DB_VERSION 3` avec le `STORES`
  d'avant, y poser une recette et un livre, fermer, rouvrir avec le schéma courant : la recette est intacte, `imports` existe avec ses trois index).

- [ ] **Step 3 : tests rouges de `db.transitionner`**

```js
await withDatabase(async (db) => {
  await db.put('imports', { id: 'imp_1', status: 'a_lancer', updated_at: '2026-10-18T00:00:00.000Z' });
  const r = await db.transitionner('imports', 'imp_1', { attendus: ['a_lancer'], patch: { status: 'en_cours' } });
  eq([r.status, (await db.get('imports', 'imp_1')).status], ['en_cours', 'en_cours'], 'transitionner : écrit quand le statut est attendu');
  let refus = null; try { await db.transitionner('imports', 'imp_1', { attendus: ['a_lancer'], patch: { status: 'en_cours' } }); } catch (e) { refus = e; }
  eq([refus?.name, refus?.statut], ['TransitionRefusee', 'en_cours'], 'transitionner : refuse depuis un état périmé, nommé');
  // puts supplémentaires dans la MÊME transaction, et capture d’outbox
  const entrees = []; db.onMutate = ({ puts, origin }) => { entrees.push([Object.keys(puts).sort(), origin]); return {}; };
  await db.transitionner('imports', 'imp_1', { attendus: ['en_cours'], patch: { status: 'a_verifier' }, puts: { recipes: [{ id: 'rc_x', availability: 'available' }] } });
  eq([entrees, (await db.get('recipes', 'rc_x'))?.id], [[[['imports', 'recipes'], 'local']], 'rc_x'], 'transitionner : puts supplémentaires et capture dans une seule transaction');
  // deux transitions entrelacées : une seule gagne
  await db.put('imports', { id: 'imp_2', status: 'echec' });
  const res = await Promise.allSettled([1, 2].map(() => db.transitionner('imports', 'imp_2', { attendus: ['echec'], patch: { status: 'en_cours' } })));
  eq(res.map((x) => x.status).sort(), ['fulfilled', 'rejected'], 'transitionner : course entre deux transitions, une seule écrit');
});
```
Contrainte d'implémentation : lecture, vérification, appel synchrone de `onMutate` et écritures **dans les rappels `onsuccess` de la même
transaction readwrite** (aucun `await` entre : IndexedDB valide la transaction dès que la file est vide). `MUTATING_METHODS` gagne
`'transitionner'` ; le test statique de la porte unique (grep `MUTATING_METHODS` dans `tests/`) est mis à jour.

- [ ] **Step 4 : tests rouges des archives (Review Focus 1)** : une archive **construite sans `imports`** (helper du test : exporter une base
  jetable, puis reconstruire le ZIP sans `data/imports.json` et sans son entrée de manifeste, décomptes et empreintes recalculés) passe
  l'inspection et se restaure en fusion **et** en remplacement ; après restauration, `imports` vaut `[]`. Un aller-retour d'archive **avec**
  une ligne `imports` la retrouve. Une archive où `data/recipes.json` manque est toujours refusée (`Magasin absent ou invalide : recipes`).

- [ ] **Step 5 : tests rouges du vocabulaire**

```js
const V = await import('../src/domain/vocabulaire.js');
let e = null; try { V.assertVocabulaire({ availability: 'dispo' }, 'recipes'); } catch (x) { e = x; }
eq([e?.name, e?.champ, e?.valeur], ['ErreurVocabulaire', 'availability', 'dispo'], 'vocabulaire : valeur hors liste refusée, nommée');
eq(V.assertVocabulaire({ original_title: 'x' }, 'recipes'), true, 'vocabulaire : champ absent toléré');
e = null; try { V.assertVocabulaire({ status: 'fini' }, 'imports'); } catch (x) { e = x; } eq(e?.champ, 'status', 'vocabulaire : statut d’import hors liste refusé');
const src = await lire('../src/domain/creation-ia.js') + await lire('../src/ui/signet.js') + await lire('../src/ui/recipe-edit.js');
eq((src.match(/assertVocabulaire\(/g) || []).length >= 3, true, 'vocabulaire : les trois fabricants existants l’appellent (test de source, admis)');
```

- [ ] **Step 6 : lancer la suite, lire le rouge** (`node .superpowers/sdd/2026-10-18-import-cible/suite.cjs 8088`).
- [ ] **Step 7 : implémenter** `schema.js` (ajouts ; `APP_VERSION '0.9.0'`), `db.js` (`transitionner`), `backup.js` (`validateRows` : un magasin de
  `MAGASINS_AJOUTES_APRES_V1` absent ne compte pas comme erreur ; `restoredStores` : `payload.stores[name] ?? []` ; les décomptes du manifeste ne
  l'exigent pas), `vocabulaire.js`, les trois appels, `getData`, K-9, pins, `SHELL`/`VERSION`.
- [ ] **Step 8 : suite verte, épingle relevée, Node 101/101, `--check` 0** (le `--check` rougira à la tâche 2 si `SYNC_STORES` change le rendu de `0003` :
  si c'est le cas dès maintenant, dire dans le rapport que la tâche 2 le ferme, et ne pas « réparer » en régénérant `0003`).
- [ ] **Step 9 : commit** `Schema imports, transitionner, archives tolerantes, vocabulaire (lot A, tache 1)`.

---

### Task 2 : Générateur, migration `0005` et sa preuve

**Files:**
- Modify: `src/sync/tables.js` (`SYNC_STORES_0003` figée, 26 noms), `tools/generer-migrations.mjs` (`0003` depuis la liste figée ; `0005_imports.sql`
  pour `SYNC_STORES.filter((s) => !SYNC_STORES_0003.includes(s))`, fonctions recréées avec les 27), `tools/generer-migrations.test.mjs`
- Create: `supabase/migrations/0005_imports.sql` (générée), `supabase/proofs/0005_imports.sql`
- Modify: `supabase/README.md` (étape 11 : coller `0005`, `notify pgrst, 'reload schema';`, preuve ; « une archive plus récente qu'un client ne se
  restaure pas : mets l'app à jour »), `supabase/proofs/RESULTATS-mitsu.md` (section « Preuve `0005` — à jouer »)

**Interfaces:**
- Produces: `SYNC_STORES_0003` (export de `tables.js`) ; `renderMigrations()` rend quatre cibles ; empreinte SHA-256 de `0003` épinglée :
  `37f9f80d62cf82457b177f35979892ce7deeaf2067567a506228e145ad8efd39` (valeur consignée dans `CLAUDE.md`, section « L'assistant suit le compte », bilan).

- [ ] **Step 1 : tests Node rouges** (`tools/generer-migrations.test.mjs`) : `SYNC_STORES_0003.length === 26` et `at(-1) === 'assistant_config'` ;
  `0003` rendue est **identique octet pour octet** au fichier commité (empreinte ci-dessus) même avec `imports` dans `SYNC_STORES` ; `0005` ne crée que
  `public.imports` (une `create table`), avec `revoke all on public.imports from anon`, les colonnes générées `edition_id`, `recipe_id`, `status`
  (`(data->>'…')`), l'index `imports_recv`, la RLS du gabarit, et recrée les quatre fonctions avec les 27 noms (`'imports'` présent dans chacune) ;
  `--check` sur une copie sans `0005` rend 1 ; la preuve `0005` finit par `rollback;` et ne contient aucune adresse ni valeur de `data`.
- [ ] **Step 2 : rouge lu.**
- [ ] **Step 3 : implémenter** (gabarit : la façon dont `0003` est rendue aujourd'hui, `tools/generer-migrations.mjs:298-310`) ; écrire la preuve `0005`
  sur le modèle de `supabase/proofs/0003_assistant_config.sql` (verdicts : table présente et RLS ; policies `authenticated` select/insert/update ;
  delete sous `app.purge` ; `revoke anon` ; colonnes générées ; `sync_push` d'une ligne `imports` sous un utilisateur de preuve accepté puis relu ;
  `999 BILAN`) ; vérifier la syntaxe avec pglast (`/private/tmp/claude-501/-Users-neeganmac/1602708c-1218-4b6c-99db-b05ac6854f25/scratchpad/venv-pglast/bin/python`,
  `parse_sql` + `parse_plpgsql` sur les blocs `do`) et dire le compte d'instructions dans le rapport.
- [ ] **Step 4 : `node --test` vert, `--check` 0, suite inchangée.**
- [ ] **Step 5 : commit** `Migration 0005 imports generee, SYNC_STORES_0003 figee, preuve et README (lot A, tache 2)`.

---

### Task 3 : Domaine de l'import ciblé et extraction amendée

**Files:**
- Create: `src/domain/import-cible.js`
- Modify: `src/domain/llm.js` (`PARSER_SYSTEM`, `validateParsedRecipe` durci et exporté, `complete(messages, { maxTokens, signal })` + `this.stopReason`,
  `extraireRecette(images, { signal, maxTokens = 6000 })` → `{ recette, stopReason, modele }`, `extractRecipeFromImages` = enveloppe compatible,
  `extraireIndex` de même pour `extractIndexFromImages`)
- Modify: `src/domain/lines.js` (`parseStepsBlock(text, { parParagraphe = false })`)
- Modify: `src/model/repo.js` (`ajouterPages`), `src/ui/import.js` (`startScanSession` l'appelle)
- Modify: `src/core/image.js` (`preparerPhotoLocale(blob)` extraite de `poserCouverture`), `src/ui/livre-ajout.js` (`poserCouverture` l'utilise)
- Modify: `tests/import-cible.js`, `tests/passerelle.js`
- Modify: `sw.js`

**Interfaces:**
- Produces (`src/domain/import-cible.js`) :
  `TRANSITIONS = { a_lancer: ['en_cours','ignore'], en_cours: ['a_verifier','echec'], a_verifier: ['enregistre','a_lancer','ignore'], echec: ['en_cours','a_lancer','ignore'], enregistre: [], ignore: [] }` ;
  `transitionPermise(de, vers)` ; `MOTS_VIDES` (liste fermée de la spec § 4.3.3) ; `motsDistinctifs(titre)` → `string[]` (`normalizeText` puis mots vides retirés) ;
  `discordance(resultat, reference)` → `{ ok: boolean, raison: null | 'titre_nul' | 'titre' | 'page', titreLu, pageLue }` ;
  `deplacerPage(pageIds, id, sens)` / `retirerPage(pageIds, id)` → nouveau tableau (purs) ;
  `fabriquerExtraction(resultat, { reference, versions, pages, pageIds, edition, convention, importId, modele, maintenant })` →
  `{ recipe, version, pageUpdates, remplacement: boolean }` (`remplacement` vrai quand une version `correction` existe : I-5) ;
  `ageTexte(iso, maintenant)` → « il y a {n} min / h / j » ; `RAISONS_ECHEC` (liste fermée § 4.4).
- Produces (`llm.js`) : `ErreurExtraction` (`raison` ∈ `coupe | illisible | hors_bornes | vide`) ; `extraireRecette` ; `BORNES_EXTRACTION = { titre: 200, ligne: 300, etape: 2000, notes: 2000, lignes: 80, etapes: 60, sousRecettes: 20, champsIncertains: 40, champIncertain: 200 }` ; `MAX_TOKENS_EXTRACTION = 6000`.
- Produces (`repo.js`) : `repo.ajouterPages(files, { edition_id, session_id, import_id })` → `{ session, pages, docs }` sans navigation ni toast.
- Produces (`core/image.js`) : `preparerPhotoLocale(blob)` → `Blob` JPEG (lève `ErreurImage('trop_lourde' | 'type' | 'trop_grande' | 'indecodable')`).

- [ ] **Step 1 : tests rouges du domaine** (dans `tests/import-cible.js`)

```js
const D = await import('../src/domain/import-cible.js');
eq(D.transitionPermise('a_verifier', 'a_lancer'), true, 'transitions : changer les pages depuis à vérifier');
eq(D.transitionPermise('echec', 'a_verifier'), false, 'transitions : une réponse tardive ne ressuscite pas un échec');
eq(D.motsDistinctifs('Tarte aux pommes de ma grand-mère'), ['tarte', 'pommes', 'grand', 'mere'], 'discordance : mots vides retirés, accents aplatis');
const ref = { original_title: 'Tarte aux pommes', printed_page: 132 };
eq(D.discordance({ title: 'Tarte aux poires', printed_page: 133 }, ref).raison, 'titre', 'discordance (Review Focus 2) : poires sur pommes → dialogue');
eq(D.discordance({ title: 'Soupe à l’ail', printed_page: null }, { original_title: 'Soupe à l’oignon', printed_page: null }).raison, 'titre', 'discordance : ail sur oignon → dialogue');
eq(D.discordance({ title: 'Tarte aux pommes de ma grand-mère', printed_page: 132 }, ref).ok, true, 'discordance : titre plus long qui contient tous les mots → concordant');
eq(D.discordance({ title: 'TARTE AUX POMMES', printed_page: 136 }, ref).raison, 'page', 'discordance : page à plus de 3 → dialogue');
eq(D.discordance({ title: null, printed_page: 132 }, ref).raison, 'titre_nul', 'discordance : titre illisible → dialogue');
eq(D.deplacerPage(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b'], 'ordre : monter'); eq(D.deplacerPage(['a', 'b'], 'a', -1), ['a', 'b'], 'ordre : monter en tête ne change rien');
eq(D.ageTexte('2026-10-18T10:00:00Z', '2026-10-18T12:30:00Z'), 'il y a 2 h', 'âge : heures');
```
Puis `fabriquerExtraction` : titre de la référence conservé et `titre_lu` en provenance ; `uncertain` recopié par ligne ; étapes = une par
entrée du modèle, texte multi-lignes intact, `position` 1..n, `timers` posés ; `availability` `available` / `partial` (`incomplete`) ;
`verification_state` `to_verify` ; `provenance.import_id` ; une page absente de `pages` ignorée ; `remplacement` vrai avec une version
`correction` parmi `versions` ; `assertVocabulaire` appelé (une fiche fabriquée passe ; un `resultat` sans ligne ni étape n'arrive pas ici : `vide` est levé en amont).

- [ ] **Step 2 : tests rouges de l'extraction amendée** (`tests/passerelle.js`, cas d'extraction) : la consigne envoyée contient `"incomplete"`,
  `"missing_page"` et la phrase « garde-la entière » ; `max_tokens` vaut 6000 ; un `signal` déjà levé → aucun POST, erreur `annule` ; une réponse
  `stop_reason: 'max_tokens'` → `ErreurExtraction('coupe')` ; `{"title":"x","ingredients":[],"steps":[]}` → `vide` ; 81 lignes → `hors_bornes` ;
  `"incomplete":"oui"` → booléen `false` ; `extraireRecette` rend `{ recette, stopReason: 'end_turn', modele }` ; `extractRecipeFromImages` rend la
  recette seule (compatibilité) ; `parseStepsBlock('a\nb\n\nc', { parParagraphe: true })` → deux étapes (`'a\nb'`, `'c'`) et sans option trois.
- [ ] **Step 3 : tests rouges de `repo.ajouterPages`** (base jetable, `navigate` espionné : non appelé ; une transaction pour les lignes : un
  `onMutate` espion voit `source_documents`, `source_pages`, `scan_sessions` et `imports` dans le même appel quand `import_id` est fourni ;
  `page_ids` ajoutés en fin ; `startScanSession` passe toujours par là et navigue, lui).
- [ ] **Step 4 : test rouge de `preparerPhotoLocale`** (reprend les cas de `poserCouverture` : `trop_lourde` > 25 Mo, `type`, `trop_grande` > 16 Mpx,
  JPEG 1 200 px en sortie ; `poserCouverture` reste vert).
- [ ] **Step 5 : rouge lu ; implémenter ; vert.** `PARSER_SYSTEM` fr, texte ajouté mot pour mot : « Si une page semble manquer (étapes qui commencent
  au milieu, ingrédients sans étapes, renvoi à une page absente), mets "missing_page": true ; si la recette est visiblement partielle, mets
  "incomplete": true ; une étape peut tenir sur plusieurs lignes : garde-la entière dans un seul "text". » et le schéma gagne
  `"incomplete": boolean, "missing_page": boolean` ; `"language"` retiré du schéma demandé.
- [ ] **Step 6 : commit** `Domaine import cible, extraction amendee (6000 jetons, stop_reason, signal), ajouterPages, preparerPhotoLocale (lot A, tache 3)`.

---

### Task 4 : L'écran d'import ciblé

**Files:**
- Create: `src/ui/import-cible.js` (`renderImportCible(params, query, ctx)`)
- Modify: `src/app.js` (route), `src/ui/state.js` (`ROUTES_DE_SAISIE` + `'/recipes/*/importer'`), `src/ui/book.js` (bouton « Importer », retrait de
  « Scanner cette recette » et de `pending_recipe`), `src/ui/recipe.js` (« Importer cette recette », « Relire les pages », retrait de `pending_recipe`),
  `src/ui/recipe-edit.js` (retrait de `pendingRef` / « Oui, rattacher »), `src/ui/add.js` (retrait du chemin `?edition`, R-UX-16), `src/i18n/en.js`, `sw.js`
- Modify: `tests/import-cible.js`, `tests/ajouter.js` (tests de « Scanner cette recette » et `?edition` à retirer ou retourner)

**Interfaces:**
- Consumes : tout de la tâche 3 ; `db.transitionner` ; `repo.ajouterPages` ; `preparerPhotoLocale` ; `sessionAssistant(ctx)`, `carteConnexion(connecter, ctx)`,
  `texteEchecAssistant`, `texteRefusAssistant` (`src/ui/components.js`) ; `pagePourEnvoi` (`llm.js`).
- Produces : `etatRoute()` exporté par `import-cible.js` pour les tests (`{ importId, status, pageIds, vol: boolean, discordance: null | {...} }`) ;
  `DOCUMENT_ID` (identifiant du document, `crypto.randomUUID()` à l'import du module) ; `volCourant` (module) ; battement `BATTEMENT_MS = 15000`.

- [ ] **Step 1 : tests rouges de l'écran** (gestes injectés `{ repo, navigate, toast, fetch, pickFiles, maintenant }` comme `tests/ajouter.js` ; `fetch`
  factice qui rend une réponse d'extraction valide) :
  - ouverte sur une `reference_only` : en-tête (titre, « {livre} · p. 132 »), zéro vignette, bouton primaire éteint, « Retour à la fiche » présent ;
    sur une `available` : toast « Cette recette a déjà son texte. » + `navigate('/recipes/<id>')` ; sur un signet : toast du lot suivant ;
  - « Choisir des photos » (sans `capture`) avec deux fichiers → **avant tout appel** : `imports` `a_lancer` avec `page_ids` [p1, p2], séance liée,
    deux `source_pages` ; « Descendre la page 1 » → `page_ids` [p2, p1] ; « Retirer la page 2 » → [p2]… (lire les noms accessibles) ;
  - photo du plat : « Choisir une image » → `imports.photo_sha256` posé, aperçu `blob:` ; « Retirer » → `null` ;
  - « Extraire et enregistrer » : **un** POST, images dans l'ordre de `page_ids`, `max_tokens` 6000 ; pendant le vol : `.status[role="status"]` puis
    `.row` avec « Annuler » (structure R-VIS-8) ; `appels` passe à 1 au départ du `fetch` ; à la réponse : ordre des écritures espionné
    (`imports → a_verifier` **avant** toute écriture `recipes`) ; puis **une** transaction qui écrit `recipes`, `recipe_versions`, `source_pages`
    (`kind: 'recipe'`, `position` 1..n), `scan_sessions` (`status: 'done'`, `recipe_ids`), `imports` (`enregistre`, `reponse_brute: null`) ;
    `navigate('/recipes/<id>?v=…')`, toast « Recette importée » ; la recette garde son `original_title` et son `id`, `availability: 'available'`,
    `photo_sha256` posé ;
  - **Review Focus 4** : « Annuler » pendant le vol → `fetch` abandonné (signal), `imports` `echec(annule)`, texte « L'appel a peut-être été compté… »,
    puis la réponse tardive du faux `fetch` arrive : **aucune** recette écrite, `reponse_brute` posée, statut toujours `echec` ;
  - discordance (titre lu « Tarte aux poires ») : panneau à trois boutons ; « Garder la lecture sans l'enregistrer » → reste `a_verifier`, rien écrit ;
    « Changer les pages » → `a_lancer` ; « Rattacher » → enregistrement ;
  - `partial` avec une version `correction` existante : « Remplacer par cette lecture ? » ; refus → version ajoutée, `current_version_id` inchangé,
    `availability` et `verification_state` de la fiche inchangés ;
  - double clic → un POST ; hors ligne (état basculé **après** le rendu, événement `offline`) → bouton éteint, zéro POST ; session absente → carte,
    photos ajoutables, zéro POST ; chaque raison de § 4.4 (table de `tests/passerelle.js`) → texte et « Relancer » ;
  - second passage sur la même recette → le même `imports` est repris (un seul `a_lancer`) ; la séance de l'import n'apparaît pas dans
    `seancesOuvertes(ctx)` de `add.js` ni dans « Séance en cours » de `book.js` ;
  - `ROUTES_DE_SAISIE` contient `'/recipes/*/importer'` ; `grep` de `pending_recipe` et de `'?edition='` / `query.edition` dans `src/` : 0 (test de
    comportement en plus : le bouton « Importer » de `book.js` navigue vers `/recipes/<id>/importer`, « Scanner cette recette » absent).
- [ ] **Step 2 : rouge lu ; implémenter ; vert.** Enregistrement : `fabriquerExtraction` → `assertVocabulaire` → **une** `db.transitionner('imports', id,
  { attendus: ['a_verifier'], patch: { status: 'enregistre', reponse_brute: null, finished_at }, puts: { recipes, recipe_versions, source_pages,
  scan_sessions } })`. Relire la référence (`repo.get`) juste avant. Battement : `setInterval` 15 s pendant le vol, transition sur place
  (`attendus: ['en_cours']`, `patch: { battement_at }`), nettoyé en `finally`. `pickFiles` : « Photographier » `{ accept: 'image/*', capture: 'environment', multiple: true }`,
  « Choisir des photos » `{ accept: 'image/*', multiple: true }`. `SHELL` + `./src/ui/import-cible.js`, `VERSION` +1.
- [ ] **Step 3 : commit** `Ecran d import cible : pages reorganisables, photo du plat, extraire et enregistrer, discordance, annulation (lot A, tache 4)`.

---

### Task 5 : Fiche, mode cuisine, courses et « Corriger »

**Files:**
- Modify: `src/ui/recipe.js` (bandeau de lecture, état de la version affichée, photo du plat, puces « incertain »), `src/ui/cook.js` et `src/ui/grocery.js`
  (bandeau D-3), `src/ui/recipe-edit.js` (étapes jointes par ligne vide + `parParagraphe: true` ; `reparse()` hérite `uncertain` ; version `correction`
  hérite `import_id`, `incomplete`, `missing_page`, `titre_lu`), `src/ui/components.js` (puce `incertain`), `src/i18n/en.js`, `sw.js`
- Modify: `tests/import-cible.js`

**Interfaces:**
- Consumes : `recipe_versions.provenance.{import_id, incomplete, missing_page, titre_lu}`, lignes `uncertain`, `recipes.photo_sha256` (tâches 1, 3, 4).
- Produces : `banniereLecture(version)` (pure, `components.js`) → texte ou `null` ; `estExtractionNonRelue(version)` (pure) → booléen.

- [ ] **Step 1 : tests rouges** : fiche d'une recette importée → « Lue par l'assistant le {d} · 2 ligne(s) incertaine(s) · page possiblement
  manquante » + « Incertain : … » ; état « 7 lignes à vérifier » **de la version affichée** (`?v=` d'une `correction` vérifiée → « Vérifiée ») ; photo du
  plat rendue quand `files` a les octets, rien sinon ; puce « incertain » sur les lignes `uncertain` et pas sur les autres ; mode cuisine et courses :
  bandeau « Lue par l'assistant, non relue » présent pour une `extraction` à `to_verify`, absent pour une `correction` ou après vérification ;
  **Review Focus 5** : ouvrir « Corriger », changer une quantité d'une ligne, enregistrer → la ligne touchée perd `uncertain`, les autres le gardent,
  `provenance.incomplete/missing_page/import_id/titre_lu` hérités, les étapes multi-lignes restent entières (zone de texte jointe par ligne vide,
  `parParagraphe: true`), bandeau toujours là.
- [ ] **Step 2 : rouge lu ; implémenter ; vert ; `VERSION` +1.**
- [ ] **Step 3 : commit** `Fiche, cuisine, courses et Corriger : lecture visible, heritage des incertitudes (lot A, tache 5)`.

---

### Task 6 : Section « Imports », reprise, journal pour l'éditeur et l'index, démarrage

**Files:**
- Modify: `src/ui/add.js` (section « Imports » avant la grille, ancre `#imports`, `seancesOuvertes` filtrée), `src/ui/book.js` (« {n} import(s) à reprendre »
  → `#/add#imports`, « Séance en cours » filtrée), `src/ui/recipe-edit.js` (« Extraire avec l'assistant IA » écrit dans le journal `kind: 'recette'`,
  `recipe_id: null` ; `?import=<id>` préremplit depuis `resultat` revalidé ; bouton verrouillé pendant l'appel ; `signal`), `src/ui/import.js` (panneau
  d'index : journal `kind: 'index'`, verrou, `?import=`), `src/model/repo.js` (`init()` : passe `interrompu` si `battement_at` > 90 s pour les lignes
  `en_cours` de cet appareil ; purge des `enregistre`/`ignore` de plus de 30 jours par suppression d'origine `local`), `src/domain/import-cible.js`
  (`lignesImports(ctx, { maintenant, documentId, deviceId })` pure → lignes triées, `cibleReprise(ligne)` → route), `src/i18n/en.js`, `sw.js`
- Modify: `tests/import-cible.js`, `tests/ajouter.js` (« Séances à reprendre »), `tests/passerelle.js` (panneau d'index et éditeur : journal)

**Interfaces:**
- Produces : `lignesImports` → `[{ id, kind, titre, sousTitre, etat, age, gestes: ['reprendre' | 'relancer' | 'annuler' | 'ignorer' | 'ouvrir_seance'], cible, ailleurs: boolean, autreAppareil: boolean, referenceAbsente: boolean }]` ;
  `cibleReprise` : `recette + recipe_id` → `/recipes/<id>/importer` ; `recette` sans `recipe_id` → `/recipes/new?import=<imp>` ; `index` → `/import?session=<s>&import=<imp>`.

- [ ] **Step 1 : tests rouges** : `lignesImports` (table : un cas par état et par sorte ; `en_cours` tenu par `documentId` → `annuler`, sinon
  `ailleurs` ; `a_verifier` sans `resultat` d'un autre appareil → sans `reprendre` ; `recipe_id` inconnu → `referenceAbsente`, sans geste ; séance
  `open` sans import → `ouvrir_seance` ; séance d'un import → absente de `seancesOuvertes`) ; page Ajouter : section absente quand vide, rendue
  avant la grille sinon, gestes câblés (« Reprendre » navigue vers la cible ; « Relancer » → **un** POST, **aucune** page ni séance en double ;
  « Ignorer » → `ignore` ; « Annuler » absent pour un vol d'ailleurs) ; « Reprendre » sur `a_verifier` → écran en mode « Enregistrer cette lecture »,
  `resultat` **revalidé** (un `resultat` hostile injecté dans la base → `echec(illisible)` au lieu d'une écriture) ; fiche du livre : « 2 imports à
  reprendre » → `#/add#imports` ; éditeur : « Extraire avec l'assistant IA » crée `imports{kind:'recette', recipe_id:null}` puis `a_verifier` avec
  `resultat`, bouton éteint pendant l'appel ; `#/recipes/new?import=<imp>` préremplit titre, ingrédients, étapes sans POST ; panneau d'index : idem
  avec `entries`, bouton verrouillé (double clic → un POST) ; `init()` : **Review Focus 3** : `en_cours` avec `battement_at` à −120 s → `interrompu`,
  à −30 s → intact, d'un autre `device_id` → intact ; `enregistre` vieux de 31 jours → supprimé **avec** une entrée d'outbox `delete` (origine
  `local`), vieux de 29 jours → intact ; `echec` vieux de 60 jours → intact.
- [ ] **Step 2 : rouge lu ; implémenter ; vert ; `VERSION` +1.**
- [ ] **Step 3 : commit** `Section Imports, reprise par sorte, journal pour l editeur et l index, interrompu et purge au demarrage (lot A, tache 6)`.

---

### Clôture (contrôleur, hors tâche)

Revue finale de branche (panel), vague de corrections, `/verify` (suite, Node, `--check`, scan secrets, invisibles, mutants listés en spec § 7),
docs (`CLAUDE.md` section du lot, `STATE.md`, `docs/architecture.md`, spec § 12 « ce que la construction a amendé »), copie du registre
`.superpowers/sdd/2026-10-18-import-cible/` dans `~/projects/mistu/.superpowers/sdd/`. Gestes de Neegan : `0005` + preuve, fusion `--ff-only`,
`push`, preuve réelle (§ 10 de la spec, puis l'écran ciblé sur le site public).
