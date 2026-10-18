# La configuration de l'assistant suit le compte — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entrer la configuration de l'assistant IA (fournisseur, modèle, clé, URL de base) une fois sur un appareil connecté au compte, sur le site public, et la retrouver sur chaque autre appareil connecté — sans qu'elle entre jamais dans une archive, un écran de conflit, un journal ou un texte rendu.

**Architecture:** Un magasin local et une table serveur `assistant_config` (une ligne `'llm'`, dernier de `SYNC_STORES`), synchronisés par les chemins existants (capture, envoi initial, réception) **sur les hôtes de production seulement** ; `ctx.settings.llm` est composé à la lecture depuis cette ligne, donc aucun consommateur ne change. Jamais de conflit à trancher (le compte gagne à égalité), jamais de suppression d'origine locale (garde `noDelete` dans `db.mutate`), migration `0003` à ajout seul (table + `revoke anon` + les quatre fonctions recréées avec 26 noms), passe unique de migration locale qui garde l'horodatage d'origine.

**Tech Stack:** PWA sans build (modules ES natifs), IndexedDB (`src/core/db.js`), Supabase (migrations SQL générées par `tools/generer-migrations.mjs`, preuves SQL), suite navigateur `tests/index.html` (lanceur `node .superpowers/sdd/2026-10-17-assistant-compte/suite.cjs 8083`), `node --test tools/*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` (rév. 2 ; K-1…K-12 ; § 12 S1-S14, F1-F15). Spec parente : `docs/spec-compte-et-stockage-distant.md`.

## Global Constraints

- Branche `assistant-compte`, worktree `~/projects/mistu-web`, base `main 66c5d19`. Serveur `python3 -m http.server 8083` depuis le worktree. Suite : `node .superpowers/sdd/2026-10-17-assistant-compte/suite.cjs 8083` (copie de `.superpowers/sdd/2026-10-17-confort-web/suite.cjs` ; doit afficher `BILAN : ✅ N/N` ; seule la 404 de `/favicon.ico` est tolérée en console).
- `APP_VERSION = '0.6.0'`, `DB_VERSION = 3` (tâche 1). `sw.js VERSION = 'cuisine-os-v0.6.0-N'` (N = numéro de la tâche qui touche `src/` ou `sw.js`), `SHELL` + `./src/domain/assistant-config.js` (seul module neuf). Pins `v0\.6\.0-\d+` / `'0.6.0'` dans `tests/ajouter.js:1858,1860`, `tests/sync-l3.js:1864`, `tests/recherche-web.js:40,43`.
- Total épinglé `tests/tests.js:185` : relu dans « obtenu » après chaque tâche, jamais deviné (l'assertion du total s'ajoute elle-même au bilan affiché : « N+1/N+1 pour un total épinglé N »).
- Tests : comportement, jamais le texte source (hors tests statiques existants) ; rouge d'abord ; bases jetables (`withDatabase`, `withRepo`) ; aucun réseau ; `tick()` après un clic ; un `select` exige `dispatchEvent(new Event('change'))` ; nœuds attachés à un `div hidden` pour `isConnected`.
- Aucun secret dans le dépôt, les tests, les preuves, le registre : clés **factices** uniquement (`'sk-factice-…'`). Jamais `select data` sur `assistant_config` (spec § 7).
- Commits : message ASCII sans accents, fichiers nommés (`git add <fichiers>`, jamais `-A`), trailer `Co-Authored-By: <modèle réel> <noreply@anthropic.com>`. Jamais réécrire l'historique. Push = geste de Neegan.
- Octets invisibles : `LC_ALL=C grep -cP '\xE2\x80[\x8B-\x8F\xA8\xA9\xAE]|\xEF\xBB\xBF' <fichiers touchés>` → 0 partout.
- `0001` et `0002` ne bougent pas d'un octet (`--check` + empreintes SHA-256 épinglées, tâche 8).
- Les prédicats injectés valent **`false` par défaut** (`configSuitLeCompte = () => false`) : hors production par défaut, donc les tests existants d'envoi initial (23/24) ne bougent pas ; les tests du lot passent `() => true`. **R-CPT-1**, consigné en spec § 12 à la tâche 9.

## Review Focus

1. **Une clé tournée battue par une vieille copie** : la passe unique (§ 5.6) doit porter l'horodatage d'origine, repli 1970 — test « K2 reste partout » (tâche 5).
2. **Une tombale qui ressuscite la clé** : jamais `'ecrire'` d'une ligne dont `deleted_at` est posé ; suppression générique d'origine `remote` — fixture avec `api_key` dans `data` (tâche 5).
3. **« Aucun » sur un appareil neuf qui efface le compte** : rien écrit sans ligne ici ; confirmation avec clé et compte (tâche 7).
4. **Le secret dans un coin oublié** : `sync_conflicts`, `payload` d'outbox, archive, `outerHTML`, `logError` — un test par coin (tâches 2, 5, 6, 7).
5. **Le client neuf contre le serveur ancien** : non éprouvable par la suite ; l'ordre des gestes est écrit dans CLAUDE.md/STATE.md et la table est dernière (tâches 1, 9).

---

## Carte des fichiers

| Fichier | Rôle dans ce lot |
|---|---|
| `src/model/schema.js` | `DB_VERSION 3`, `APP_VERSION 0.6.0`, magasin `assistant_config` (après `files`, `noDelete: true`), `ARCHIVE_DATA_STORES` l'exclut |
| `src/domain/assistant-config.js` (**neuf**, pur) | `LIGNE_ASSISTANT`, `FOURNISSEURS`, `normaliserConfigAssistant`, `configVide` |
| `src/sync/tables.js` | `SYNC_STORES_0001` (25 noms figés) |
| `src/sync/config.js` | `configAssistantSuitLeCompte(hostname)` |
| `src/core/db.js` | garde `noDelete` dans `mutate` |
| `src/model/repo.js` | `getSettings` compose `llm` ; `getSetting`/`setSetting` lèvent sur un secret ; `saveAssistantConfig` ; passe unique `migrerConfigAssistant` |
| `src/sync/outbox.js`, `backfill.js`, `pull.js`, `moteur.js`, `src/app.js` | prédicat `configSuitLeCompte` injecté ; règles K-5 dans `appliquerPage` |
| `src/sync/reponses.js` | refus `conflit` sur `assistant_config` : retirer + `reecrire` conditionnel |
| `src/sync/conflits.js` | `garderIci`/`garderAilleurs`/`ignorerRenvoye` refusent le magasin |
| `src/domain/backup.js` | remplacement : `clearStores` sans `assistant_config` |
| `src/ui/settings.js` | section « Assistant IA » à dépendances injectées, K-6, K-10, K-12 |
| `src/i18n/en.js` | chaînes neuves |
| `tools/generer-migrations.mjs`, `tools/generer-migrations.test.mjs` | `fonctions(stores)`, `0003`, empreintes, troisième cible |
| `supabase/migrations/0003_assistant_config.sql`, `supabase/proofs/0003_assistant_config.sql`, `supabase/README.md`, `supabase/proofs/RESULTATS-mitsu.md` | serveur |
| `tests/assistant-compte.js` (**neuf**), `tests/tests.js`, `tests/sync.js`, `tests/sync-l3.js`, `tests/backup.js`, pins | tests |
| `CLAUDE.md`, `STATE.md`, `docs/architecture.md`, spec parente § 11, spec web § 11.2, spec de ce lot § 12 | docs |

---

### Task 1 : Schéma, module pur, versions, suite neuve

**Files:**
- Modify: `src/model/schema.js:5-6` (versions), `:36-38` (magasin), `:48` (archive)
- Create: `src/domain/assistant-config.js`
- Modify: `src/sync/tables.js` (fin de fichier : `SYNC_STORES_0001`)
- Modify: `sw.js` (`SHELL` + module, `VERSION = 'cuisine-os-v0.6.0-1'`)
- Modify (minimal, Step 6 bis) : `tools/generer-migrations.mjs:9-10,50`, `tools/generer-migrations.test.mjs:5,23,49-52`
- Create: `tests/assistant-compte.js` ; Modify: `tests/tests.js:23,178-185`
- Modify (retournés) : `tests/sync.js:9` (26), `:70` (`DB_VERSION`), `:226` (`V1_SEULEMENT` sans `assistant_config`), `:243` (`schema.DB_VERSION`), `tests/ajouter.js:1858,1860`, `tests/sync-l3.js:1864`, `tests/recherche-web.js:40,43`
- Create: `.superpowers/sdd/2026-10-17-assistant-compte/suite.cjs` (copie de celui du lot confort)

**Interfaces:**
- Produces: `STORES.assistant_config = { keyPath: 'id', indexes: [], noDelete: true }` ; `SYNC_STORES.length === 26`, `SYNC_STORES.at(-1) === 'assistant_config'` ; `SYNC_STORES_0001` (25) ; `normaliserConfigAssistant(brut) → { provider, model, base_url, api_key }` ; `LIGNE_ASSISTANT = 'llm'` ; `configVide(cfg) → boolean`.

- [ ] **Step 1 : la suite neuve, rouge**

Créer `tests/assistant-compte.js` :

```js
// Tests du lot « la configuration de l'assistant suit le compte » (spec 2026-10-17-assistant-par-le-compte).
// Bases jetables seulement ; aucun réseau ; clés FACTICES uniquement.
import { STORES, SYNC_STORES, ARCHIVE_DATA_STORES, DB_VERSION, APP_VERSION, SECRET_SETTING_KEYS } from '../src/model/schema.js';
import { SYNC_STORES_0001 } from '../src/sync/tables.js';

export async function runAssistantCompteTests({ eq, ok }) {
  // --- T1 : schéma (K-9, § 4.1)
  eq([DB_VERSION, APP_VERSION], [3, '0.6.0'], 'T1 : DB_VERSION 3, APP_VERSION 0.6.0');
  eq(STORES.assistant_config, { keyPath: 'id', indexes: [], noDelete: true }, 'T1 : magasin assistant_config, clé id, noDelete');
  eq([SYNC_STORES.length, SYNC_STORES.at(-1)], [26, 'assistant_config'], 'K-9 : 26 magasins synchronisés, assistant_config DERNIER');
  eq(SYNC_STORES.slice(0, 25), [...SYNC_STORES_0001], 'K-9 : les 25 premiers = la liste figée de 0001, dans l’ordre');
  ok(!ARCHIVE_DATA_STORES.includes('assistant_config'), 'K-7 : hors archive');
  eq(SECRET_SETTING_KEYS, ['llm'], 'la liste des réglages secrets reste (filtre des vieilles archives)');
  const ordre = Object.keys(STORES);
  ok(ordre.indexOf('assistant_config') === ordre.indexOf('files') + 1 && ordre.indexOf('settings') === ordre.indexOf('assistant_config') + 1, 'K-9 : déclaré après files, avant settings');

  // --- T1 : normalisation (§ 4.1, S14, F13)
  const A = await import('../src/domain/assistant-config.js');
  const N = A.normaliserConfigAssistant;
  const VIDE = { provider: 'none', model: '', base_url: '', api_key: '' };
  eq(A.LIGNE_ASSISTANT, 'llm', 'T1 : une ligne, id llm');
  eq([N(undefined), N(null), N(42), N('x'), N({})], [VIDE, VIDE, VIDE, VIDE, VIDE], 'normaliser : rien, nul, nombre, chaîne, objet vide → configuration vide');
  eq(N({ provider: 'anthropic', model: ' claude-sonnet-5-5 ', api_key: ' sk-factice-1 ', base_url: 'https://example.invalid/v1' }), { provider: 'anthropic', model: 'claude-sonnet-5-5', base_url: '', api_key: 'sk-factice-1' }, 'normaliser : trim, base_url vidée pour anthropic (S14)');
  eq(N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'https://api.example.invalid/v1' }).base_url, 'https://api.example.invalid/v1', 'normaliser : base_url https gardée pour openai_compatible');
  eq([N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'http://api.example.invalid/v1' }).base_url, N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'https://u:p@api.example.invalid/v1' }).base_url, N({ provider: 'openai_compatible', model: 'm', api_key: 'k', base_url: 'pas une url' }).base_url], ['', '', ''], 'normaliser : http, identifiants, texte libre → base_url vidée (S14)');
  eq(N({ provider: 'inconnu', model: 'm', api_key: 'k' }), VIDE, 'normaliser : fournisseur inconnu → none, et none vide les champs (K-6)');
  eq(N({ provider: 'none', model: 'm', api_key: 'k', base_url: 'https://x.invalid' }), VIDE, 'normaliser : none vide les trois champs');
  eq(N({ provider: 'anthropic', model: 'a\u200Bb\u0007c', api_key: 'k\u202Ek' }), { provider: 'anthropic', model: 'abc', base_url: '', api_key: 'kk' }, 'normaliser : Cc/Cf retirés (I-H)');
  eq([N({ provider: 'anthropic', model: 'm'.repeat(300), api_key: 'k' }).model.length, N({ provider: 'anthropic', model: 'm', api_key: 'k'.repeat(600) }).api_key.length], [200, 500], 'normaliser : bornes 200 / 500 points de code');
  eq(N({ provider: 'anthropic', model: 7, api_key: ['k'], base_url: {} }), { provider: 'anthropic', model: '', base_url: '', api_key: '' }, 'normaliser : types faux → chaînes vides, jamais une levée');
  eq([A.configVide(VIDE), A.configVide(null), A.configVide({ provider: 'anthropic', api_key: 'k' }), A.configVide({ provider: 'inconnu', api_key: 'k' })], [true, true, false, true], 'configVide : délègue à la normalisation (fournisseur inconnu = vide)');
}
```

Enregistrer dans `tests/tests.js` : import `runAssistantCompteTests` (après la ligne 23) et un bloc `try { await runAssistantCompteTests({ eq, ok }); } catch …` **après** celui de `runRechercheWebTests` (ligne 178, même forme que ses voisins).

- [ ] **Step 2 : rouge** — `node .superpowers/sdd/2026-10-17-assistant-compte/suite.cjs 8083` → les assertions T1 échouent (module absent, 25 magasins).

- [ ] **Step 3 : schéma**

`src/model/schema.js` :
```js
export const DB_VERSION = 3;
export const APP_VERSION = '0.6.0';
```
Après `files:` et avant `settings:` :
```js
  // Configuration de l'assistant IA : une ligne 'llm', synchronisée sur les hôtes de production (spec
  // 2026-10-17-assistant-par-le-compte § 4). noDelete : jamais de suppression d'origine locale (K-6, lue par db.mutate).
  assistant_config:    { keyPath: 'id', indexes: [], noDelete: true },
```
Ligne 48 :
```js
export const ARCHIVE_DATA_STORES = Object.keys(STORES).filter((s) => s !== 'files' && s !== 'settings' && s !== 'assistant_config' && !SYNC_INTERNAL_STORES.includes(s));
```

- [ ] **Step 4 : module pur** `src/domain/assistant-config.js`

```js
// Configuration de l'assistant IA (spec 2026-10-17-assistant-par-le-compte § 4.1). Pur : aucune base, aucun DOM.
// Une seule forme, à l'écriture locale ET à la lecture ; la réception écrit la ligne telle que le serveur la porte.
import { borner } from '../core/bornes.js';

export const LIGNE_ASSISTANT = 'llm';
export const FOURNISSEURS = ['none', 'openai_compatible', 'anthropic'];
export const BORNES_ASSISTANT = { model: 200, base_url: 500, api_key: 500 };
const VIDE = Object.freeze({ provider: 'none', model: '', base_url: '', api_key: '' });

const texte = (v, max) => (typeof v === 'string' ? borner(v.trim(), max) : '');

// S14 : une URL de base ne voyage que si elle est https, absolue, sans identifiants — la clé part en Bearer vers elle.
function urlSure(u) {
  if (!u) return '';
  try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password ? u : ''; } catch { return ''; }
}

export function normaliserConfigAssistant(brut) {
  const src = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const provider = FOURNISSEURS.includes(src.provider) ? src.provider : 'none';
  if (provider === 'none') return { ...VIDE };
  return {
    provider,
    model: texte(src.model, BORNES_ASSISTANT.model),
    base_url: provider === 'anthropic' ? '' : urlSure(texte(src.base_url, BORNES_ASSISTANT.base_url)),
    api_key: texte(src.api_key, BORNES_ASSISTANT.api_key),
  };
}

// Une seule définition du « vide » : celle de la normalisation (revue Neegan 1.2 : un fournisseur inconnu est vide).
export const configVide = (cfg) => normaliserConfigAssistant(cfg).provider === 'none';
```
Vérifier la signature réelle de `borner(s, max)` dans `src/core/bornes.js:9` (retire Cc/Cf et tronque par points de code) ; si elle ne tronque pas, tronquer par `Array.from(s).slice(0, max).join('')` après.

- [ ] **Step 5 : liste figée** — fin de `src/sync/tables.js` :
```js
// Les 25 magasins de la migration 0001, FIGÉS : 0001 est appliquée sur mitsu et doit rester identique octet pour octet
// (spec assistant-par-le-compte § 6.1). Toute table neuve va dans une migration à ajout seul (0003, …).
export const SYNC_STORES_0001 = Object.freeze(['books', 'book_editions', 'source_documents', 'source_pages', 'scan_sessions', 'dishes', 'dish_recipe_links', 'recipes', 'recipe_versions', 'recipe_translations', 'ingredients', 'unit_definitions', 'unit_conventions', 'substitutions', 'appliances', 'cook_history', 'cook_sessions', 'inventory', 'meals', 'meal_feedback', 'shopping_lists', 'library_activity', 'rediscovery_prefs', 'timer_launches', 'files']);
```

- [ ] **Step 6 : versions, SHELL, pins, tests retournés** — `sw.js` : `SHELL` + `'./src/domain/assistant-config.js'`, `VERSION = 'cuisine-os-v0.6.0-1'`. Pins : `v0\.5\.1` → `v0\.6\.0`, `'0.5.1'` → `'0.6.0'` aux cinq lignes listées. `tests/sync.js:9` → `26, '26 magasins synchronisables'` ; `:70` → `eq(schema.DB_VERSION, 3, 'DB_VERSION 3')` ; `:226` → `V1_SEULEMENT` exclut aussi `'assistant_config'` (`!SYNC_INTERNAL_STORES.includes(n) && n !== 'assistant_config'`) ; `:243` → `eq(v2.idb.version, schema.DB_VERSION, …)` ; ligne 237 (« les trois magasins internes sont créés ») : ajouter `ok(v2.idb.objectStoreNames.contains('assistant_config'), 'montée 2 → 3 : le magasin assistant_config est créé')`. Le commentaire de la ligne 211 parle de « 26 magasins d'avant le lot » : laisser.

- [ ] **Step 6 bis : le générateur lit la liste figée dès maintenant** (revue Neegan 1.1, « confort SDD » : sans cela `--check` et `tools/*.test.mjs` seraient rouges de T1 à T7). Changement **minimal**, la factorisation reste en T8 :
  - `tools/generer-migrations.mjs:9-10` : `import { TABLES, SYNC_STORES_0001 } from '../src/sync/tables.js';` (retirer l'import de `SYNC_STORES` depuis `schema.js`) ; ligne 50 : `const stores = SYNC_STORES_0001;`.
  - `tools/generer-migrations.test.mjs:5` : importer `SYNC_STORES_0001` depuis `../src/sync/tables.js` (garder `SYNC_STORES` si d'autres tests l'utilisent) ; ligne 23 : boucle sur `SYNC_STORES_0001` ; lignes 49-52 : littéral bâti sur `SYNC_STORES_0001`.
  - Vérifier : `node tools/generer-migrations.mjs --check` → **0**, `node --test tools/*.test.mjs` → tout vert, `shasum -a 256 supabase/migrations/0001_tables_et_regles.sql` inchangé (`e90ff35e…`).

- [ ] **Step 7 : vert** — suite complète verte, total épinglé relu et posé ; `--check` 0 ; tools verts. Ne PAS régénérer `0001`.

- [ ] **Step 8 : commit** `Assistant par le compte 1 : schema v3, magasin assistant_config, module de normalisation, APP 0.6.0, SW -1`

---

### Task 2 : Garde `noDelete` dans `db.mutate`

**Files:**
- Modify: `src/core/db.js:158-170` (`mutate`)
- Modify: `src/sync/conflits.js` (`garderIci`, `garderAilleurs`, `ignorerRenvoye` : refus du magasin)
- Test: `tests/assistant-compte.js` (bloc T2), `sw.js VERSION -2`

- [ ] **Step 1 : tests rouges** (dans `runAssistantCompteTests`, après T1)

```js
  // --- T2 : jamais de suppression d'origine locale (K-6, § 5.4, S6) — garde de COMPORTEMENT dans db.mutate
  const { Database } = await import('../src/core/db.js');
  const { withDatabase } = await import('./backup.js');
  const T2_STORES = { a: { keyPath: 'id', indexes: [] }, verrou: { keyPath: 'id', indexes: [], noDelete: true } };
  await withDatabase(async (db) => {
    await db.mutate({ puts: { verrou: [{ id: 'llm', api_key: 'sk-factice-2' }], a: [{ id: 'x' }] } });
    let levee = null;
    try { await db.mutate({ deletes: { verrou: ['llm'] } }); } catch (e) { levee = e; }
    ok(levee instanceof Error && /noDelete|verrou/.test(levee.message), 'noDelete : une suppression d’origine local lève, en nommant le magasin');
    levee = null;
    try { await db.mutate({ deletes: { verrou: ['llm'] }, origin: 'device' }); } catch (e) { levee = e; }
    ok(!!levee, 'noDelete : origine device → lève aussi');
    levee = null;
    try { await db.delete('verrou', 'llm'); } catch (e) { levee = e; }
    ok(!!levee && !!(await db.get('verrou', 'llm')), 'noDelete : db.delete lève et la ligne est intacte');
    await db.mutate({ deletes: { a: ['x'] } });
    eq(await db.get('a', 'x'), undefined, 'noDelete : un autre magasin se supprime normalement');
    await db.mutate({ deletes: { verrou: ['llm'] }, origin: 'remote' });
    eq(await db.get('verrou', 'llm'), undefined, 'noDelete : une suppression d’origine remote (tombale reçue) passe');
    await db.mutate({ puts: { verrou: [{ id: 'llm' }] } });
    await db.mutate({ clearStores: ['verrou'], origin: 'device' });
    eq(await db.count('verrou'), 0, 'noDelete : clearStores reste permis (K-8, clearDevice)');
    // La levée précède la transaction : une capture posée ne voit rien.
    let captures = 0; db.onMutate = () => { captures += 1; return null; };
    try { await db.mutate({ deletes: { verrou: ['llm'] } }); } catch { /* attendu */ }
    eq(captures, 0, 'noDelete : la garde précède onMutate — rien n’entre en file');
    db.onMutate = null;
  }, T2_STORES);
  // Les gestes de conflit refusent ce magasin par son nom (K-5)
  const C = await import('../src/sync/conflits.js');
  await withDatabase(async (db) => {
    const conflit = { id: 'assistant_config:llm', store: 'assistant_config', record_id: 'llm', local: { id: 'llm', api_key: 'sk-factice-l' }, server: { data: { id: 'llm', api_key: 'sk-factice-s' }, updated_at: '2026-10-17T10:00:00Z', deleted_at: null }, at: 'x', kind: 'donnees' };
    await db.mutate({ puts: { sync_conflicts: [conflit] }, origin: 'device' });
    eq([await C.garderIci(db, conflit), await C.garderAilleurs(db, conflit), await C.ignorerRenvoye(db, conflit)], [false, false, false], 'conflits : les trois gestes refusent assistant_config');
    eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length], [undefined, 0], 'conflits : rien écrit, rien en file');
  });
```

- [ ] **Step 2 : rouge** — lancer la suite.

- [ ] **Step 3 : garde** — dans `mutate`, juste après les deux `TypeError` et **avant** `this.onMutate` :
```js
    // K-6 / S6 : un magasin `noDelete` (assistant_config) n'accepte aucune suppression d'origine locale ou device —
    // une suppression copie la fiche dans la file (payload), et ce magasin porte un secret. Seule la réception
    // (origine 'remote', tombale venue du serveur) peut retirer la ligne ; `clearStores` reste permis (vidage d'appareil).
    for (const [name, keys] of Object.entries(deletes)) {
      if (keys.length && this.stores[name]?.noDelete && origin !== 'remote') {
        throw new Error(`Suppression interdite sur ${name} (noDelete) : écrire une ligne vide à la place`);
      }
    }
```
`conflits.js` : première ligne de `garderIci`, `garderAilleurs`, `ignorerRenvoye` : `if (conflit?.store === 'assistant_config') return false; // K-5 : ce magasin n'a jamais de conflit à trancher`.

- [ ] **Step 4 : vert**, total épinglé, `sw.js -2`. **Step 5 : commit** `Assistant par le compte 2 : garde noDelete dans db.mutate, gestes de conflit fermes au magasin`

---

### Task 3 : `repo` — lecture composée, secrets refusés, écriture, passe unique

**Files:**
- Modify: `src/model/repo.js` (imports ; `init()` ; `DEFAULT_SETTINGS` ; `getSetting`/`getSettings`/`setSetting` ; nouveau `saveAssistantConfig` ; nouvelle `migrerConfigAssistant`)
- Modify: `tests/sync-l3.js:2022-2034` (fausse base : ajouter `get`)
- Test: `tests/assistant-compte.js` (bloc T3), `sw.js -3`

**Interfaces:**
- Produces: `repo.saveAssistantConfig(brut) → ligne écrite` ; `repo.getSettings().llm` = `normaliserConfigAssistant(ligne 'llm')` ; `repo.getSetting('llm')` et `repo.setSetting('llm', …)` lèvent ; passe unique garde `sync_state.assistant_config_migre = 1`.

- [ ] **Step 1 : tests rouges**

```js
  // --- T3 : lecture composée, secrets refusés, écriture, passe unique (K-1, § 5.1, § 5.2, § 5.6, S1, F3)
  const { withRepo } = await import('./sync-fixture.js');
  const bus = await import('../src/core/bus.js');
  await withRepo(async (repo, db) => {
    eq((await repo.getSettings()).llm, { provider: 'none', model: '', base_url: '', api_key: '' }, 'lecture : sans ligne, configuration vide');
    let levee = null; try { await repo.setSetting('llm', { api_key: 'sk-factice-3' }); } catch (e) { levee = e; }
    ok(!!levee && !(await db.get('settings', 'llm')), 'K-1 : setSetting(llm) lève et n’écrit rien');
    levee = null; try { await repo.getSetting('llm'); } catch (e) { levee = e; }
    ok(!!levee, 'K-1 : getSetting(llm) lève (F15)');
    // Écriture : capturée (fixture = capture posée, user u1), horodatée par syncNow, événements change + settings sans valeur
    const evenements = [];
    const off1 = bus.on('settings', (p) => evenements.push(['settings', p]));
    const off2 = bus.on('change', (p) => evenements.push(['change', p]));
    try {
      const ligne = await repo.saveAssistantConfig({ provider: 'anthropic', model: ' m ', api_key: ' sk-factice-3 ', base_url: 'https://x.invalid' });
      eq([ligne.id, ligne.provider, ligne.model, ligne.api_key, ligne.base_url, typeof ligne.updated_at], ['llm', 'anthropic', 'm', 'sk-factice-3', '', 'string'], 'écriture : ligne normalisée et horodatée');
      eq((await repo.getSettings()).llm, { provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-3' }, 'lecture : composée depuis assistant_config, sans id ni dates');
      const file = (await db.getAll('outbox')).filter((e) => e.store === 'assistant_config');
      eq(file.map((e) => [e.op, e.id, e.user_id, 'payload' in e]), [['put', 'llm', 'u1', false]], 'écriture : capturée, un put sans copie de la fiche');
      ok(evenements.some(([n, p]) => n === 'change' && p.store === 'assistant_config') && evenements.some(([n, p]) => n === 'settings' && p.key === 'llm' && !('value' in p)), 'écriture : change + settings { key } SANS la valeur (K-2)');
      ok(!JSON.stringify(evenements).includes('sk-factice-3'), 'écriture : aucun événement ne porte la clé');
    } finally { off1(); off2(); }
    // Une ligne settings.llm résiduelle est ignorée à la lecture
    await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', api_key: 'sk-factice-residu' } }] }, origin: 'device' });
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-3', 'lecture : settings.llm résiduel ignoré');
    // Ligne reçue abîmée : la lecture reste saine
    await db.mutate({ puts: { assistant_config: [{ id: 'llm', provider: 'anthropic', model: 7, api_key: 'k\u0007', updated_at: '2026-10-17T10:00:00Z' }] }, origin: 'remote' });
    eq((await repo.getSettings()).llm, { provider: 'anthropic', model: '', base_url: '', api_key: 'k' }, 'lecture : une ligne reçue abîmée est normalisée (F13)');
  });
  // Passe unique § 5.6 : dans l'ordre de boot() — init() SANS capture, puis envoi initial (F3, S10)
  {
    const repoModule = await import('../src/model/repo.js');
    const { envoiInitial } = await import('../src/sync/backfill.js');
    const origine = repoModule.db;
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-mac' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try {
        await repoModule.init();
        const ligne = await db.get('assistant_config', 'llm');
        eq([ligne?.provider, ligne?.api_key, ligne?.updated_at, await db.get('settings', 'llm'), (await db.get('sync_state', 'assistant_config_migre'))?.value, await db.count('outbox')],
          ['anthropic', 'sk-factice-mac', '2026-10-01T12:00:00.000Z', undefined, 1, 0], 'passe unique : copiée avec l’horodatage D’ORIGINE (S1), settings.llm effacé, garde posée, rien en file (init précède la capture)');
        const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        ok(r.tables.includes('assistant_config') && (await db.getAll('outbox')).some((e) => e.store === 'assistant_config' && e.op === 'put' && e.user_id === 'u1'), 'passe unique : c’est l’envoi initial qui met la ligne en file, au nom du compte (F3)');
        await repoModule.init();
        eq((await db.get('assistant_config', 'llm')).updated_at, '2026-10-01T12:00:00.000Z', 'passe unique : idempotente (seconde init)');
      } finally { repoModule.bindDatabase(origine); }
    });
    // Repli 1970 sans horodatage lisible ; rien copié si none / clé vide ; ligne déjà reçue respectée
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-sans-date' } }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq((await db.get('assistant_config', 'llm'))?.updated_at, '1970-01-01T00:00:00.000Z', 'passe unique : sans horodatage lisible → 1970 (toute version du compte gagne)'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'none' }, updated_at: '2026-10-01T12:00:00.000Z' }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([await db.get('assistant_config', 'llm'), await db.get('settings', 'llm')], [undefined, undefined], 'passe unique : none → rien copié, settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-vieille' }, updated_at: '2026-10-01T12:00:00.000Z' }], assistant_config: [{ id: 'llm', provider: 'anthropic', model: 'm2', base_url: '', api_key: 'sk-factice-recue', updated_at: '2026-10-17T12:00:00.000Z' }] }, origin: 'remote' });
      repoModule.bindDatabase(db);
      try { await repoModule.init(); eq([(await db.get('assistant_config', 'llm')).api_key, await db.get('settings', 'llm')], ['sk-factice-recue', undefined], 'passe unique : une ligne déjà reçue n’est pas écrasée ; settings.llm effacé'); }
      finally { repoModule.bindDatabase(origine); }
    });
  }
```
`tests/sync-l3.js:2022` : la fausse base devient `({ idb: ouverte ? {} : null, getAll: async (store) => { appels.push(store); return []; }, get: async () => undefined })` ; l'assertion `eq(appels, ['settings'])` reste (le `get` n'est pas compté).

- [ ] **Step 2 : rouge.** **Step 3 : code** (`src/model/repo.js`)

Imports : `import { DB_NAME, DB_VERSION, STORES, SYNC_STORES, SECRET_SETTING_KEYS } from './schema.js';` et `import { normaliserConfigAssistant, LIGNE_ASSISTANT } from '../domain/assistant-config.js';`

`DEFAULT_SETTINGS` : retirer la ligne `llm:` (une seule source : K-1).

```js
const estSecret = (key) => SECRET_SETTING_KEYS.includes(key);

export async function getSetting(key) {
  if (estSecret(key)) throw new Error(`Réglage secret « ${key} » : lire getSettings().llm (K-1)`);
  const row = await db.get('settings', key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export async function getSettings() {
  const rows = await db.getAll('settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (!estSecret(r.key)) out[r.key] = r.value; // une ligne settings.llm résiduelle est ignorée
  // K-1 / K-11 : la configuration de l'assistant vit dans assistant_config ; les consommateurs lisent toujours settings.llm.
  out.llm = normaliserConfigAssistant(await db.get('assistant_config', LIGNE_ASSISTANT));
  return out;
}

export async function setSetting(key, value) {
  if (estSecret(key)) throw new Error(`Réglage secret « ${key} » : passer par saveAssistantConfig (K-1)`);
  await db.put('settings', { key, value, updated_at: nowIso() });
  emit('settings', { key, value });
}

// K-6 / § 5.2 : normalisée, horodatée par syncNow (save), capturée si l'origine et l'hôte le permettent (outbox.js),
// `change` émis par save ; `settings` sans la valeur (K-2 : aucun événement ne porte la clé).
export async function saveAssistantConfig(brut) {
  const cfg = normaliserConfigAssistant(brut);
  const ligne = await save('assistant_config', { id: LIGNE_ASSISTANT, ...cfg });
  emit('settings', { key: LIGNE_ASSISTANT });
  return ligne;
}
```
Passe unique (après `nettoyerAnciennesFiches` dans `init()` : `await migrerConfigAssistant();`) :
```js
// Passe unique (spec assistant-par-le-compte § 5.6, S1/F3/F4) : l'ancien réglage settings.llm devient la ligne
// assistant_config, UNE transaction d'origine 'device'. L'horodatage est celui de l'ancienne ligne (repli 1970) —
// JAMAIS « maintenant » : une vieille clé restée sur une autre origine battrait une clé tournée depuis. Rien n'entre
// en file ici (init() précède installCapture) : l'envoi initial enverra la ligne au premier passage avec un compte.
const MIGRATION_ASSISTANT_GUARD = 'assistant_config_migre';
const EPOQUE = '1970-01-01T00:00:00.000Z';
async function migrerConfigAssistant() {
  if ((await db.get('sync_state', MIGRATION_ASSISTANT_GUARD))?.value === 1) return false;
  const ancien = await db.get('settings', LIGNE_ASSISTANT);
  const existante = await db.get('assistant_config', LIGNE_ASSISTANT);
  const cfg = normaliserConfigAssistant(ancien?.value);
  const copier = !existante && cfg.provider !== 'none' && cfg.api_key !== '';
  const puts = { sync_state: [{ key: MIGRATION_ASSISTANT_GUARD, value: 1 }] };
  if (copier) {
    const quand = typeof ancien.updated_at === 'string' && Number.isFinite(Date.parse(ancien.updated_at)) ? ancien.updated_at : EPOQUE;
    puts.assistant_config = [{ id: LIGNE_ASSISTANT, ...cfg, created_at: quand, updated_at: quand }];
  }
  await db.mutate({ puts, deletes: ancien ? { settings: [LIGNE_ASSISTANT] } : {}, origin: 'device' });
  return copier;
}
```
`src/ui/settings.js:155` lit encore `s.llm` : inchangé (composé). Aucun autre lecteur de `settings.llm` (mesuré par la revue).

- [ ] **Step 4 : vert**, total, `sw.js -3`. **Step 5 : commit** `Assistant par le compte 3 : lecture composee, secrets refuses dans settings, saveAssistantConfig, passe unique horodatee a l origine`

---

### Task 4 : Production seulement — prédicat injecté dans capture, envoi initial, réception, moteur, app

**Files:**
- Modify: `src/sync/config.js` (`configAssistantSuitLeCompte`), `src/sync/outbox.js:25-31`, `src/sync/backfill.js:97-116`, `src/sync/pull.js:206-212`, `src/sync/moteur.js:37-45, 99-104, 175-180`, `src/app.js:181-186, 276`
- Test: `tests/assistant-compte.js` (bloc T4), `sw.js -4`

**Interfaces:**
- Produces: `configAssistantSuitLeCompte(hostname = location.hostname) → boolean` (vrai ssi `hostname` ∈ `SUPABASE.prod.hosts`, comparaison en minuscules) ; paramètre `configSuitLeCompte = () => false` sur `installCapture`, `tablesCandidates`/`tablesAEnvoyer`/`envoiInitial`, `createPull`, `createMoteur`.

- [ ] **Step 1 : tests rouges**

```js
  // --- T4 : production seulement (K-3, S3) — prédicat injecté, faux par défaut (R-CPT-1)
  const cfgMod = await import('../src/sync/config.js');
  eq([cfgMod.configAssistantSuitLeCompte('neegans.github.io'), cfgMod.configAssistantSuitLeCompte('NEEGANS.GITHUB.IO'), cfgMod.configAssistantSuitLeCompte('localhost'), cfgMod.configAssistantSuitLeCompte('127.0.0.1'), cfgMod.configAssistantSuitLeCompte(''), cfgMod.configAssistantSuitLeCompte(undefined)],
    [true, true, false, false, false, cfgMod.configAssistantSuitLeCompte(globalThis.location?.hostname)], 'K-3 : vrai seulement pour les hôtes de production (prod.hosts), insensible à la casse');
  const { installCapture, uninstallCapture } = await import('../src/sync/outbox.js');
  const { tablesAEnvoyer, envoiInitial } = await import('../src/sync/backfill.js');
  const { createPull } = await import('../src/sync/pull.js');
  const { creerTransportFactice } = await import('./transport-factice.js');
  const LIGNE = (k) => ({ id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: k, updated_at: '2026-10-17T10:00:00Z' });
  await withDatabase(async (db) => {
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false }); // défaut : hors production
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-dev')] } });
    eq((await db.getAll('outbox')).length, 0, 'capture : hors production (défaut), assistant_config n’entre pas en file');
    uninstallCapture(db);
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-prod')] } });
    eq((await db.getAll('outbox')).map((e) => [e.store, e.op, e.user_id]), [['assistant_config', 'put', 'u1']], 'capture : en production, capturée comme les autres');
    await db.mutate({ puts: { assistant_config: [LIGNE('sk-factice-recu')] }, origin: 'remote' });
    eq((await db.getAll('outbox')).length, 1, 'capture : une réception n’est pas recapturée');
    uninstallCapture(db);
  });
  eq([tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).includes('assistant_config'), tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false, configSuitLeCompte: () => true }).includes('assistant_config'), tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true, configSuitLeCompte: () => true }).length], [false, true, 25], 'envoi initial : hors production exclue ; en production incluse (25 avec l’historique)');
  // Réception : hors production la table n'est pas lue ; en production elle est lue EN DERNIER (K-9)
  const tf = creerTransportFactice({ serveur: true });
  await tf.pousser([{ store: 'assistant_config', id: 'llm', data: LIGNE('sk-factice-serveur'), updated_at: '2026-10-17T10:00:00Z' }]);
  await withDatabase(async (db) => {
    const lues = [];
    const r0 = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', surProgression: (p) => lues.push(p.table) }).recevoir();
    eq([r0.recues, lues.includes('assistant_config'), await db.get('assistant_config', 'llm')], [0, false, undefined], 'réception : hors production, la table n’est ni lue ni écrite');
    lues.length = 0;
    const r1 = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true, surProgression: (p) => lues.push(p.table) }).recevoir();
    eq([r1.recues, lues.at(-1), (await db.get('assistant_config', 'llm'))?.api_key, (await db.getAll('outbox')).length], [1, 'assistant_config', 'sk-factice-serveur', 0], 'réception : en production, lue EN DERNIER (K-9), écrite telle quelle, rien en file');
  });
```

- [ ] **Step 2 : rouge.** **Step 3 : code**

`src/sync/config.js` (fin) :
```js
// Spec assistant-par-le-compte K-3 (S3) : la configuration de l'assistant ne suit le compte que sur les hôtes de
// PRODUCTION. Une origine localhost:<port> est partagée par tout autre projet servi sur ce port — IndexedDB et jeton
// de session compris : s'y connecter y déposerait la clé. Hors production, le magasin reste local à l'appareil.
export function configAssistantSuitLeCompte(hostname = globalThis.location?.hostname || '') {
  const hote = String(hostname || '').toLowerCase();
  return !!hote && SUPABASE.prod.hosts.some((h) => String(h).toLowerCase() === hote);
}
```
`outbox.js:25` : `export function installCapture(db, { getUserId = () => null, isActivitySynced = () => false, configSuitLeCompte = () => false } = {})` ; `wanted` : `SYNCHRONISEES.includes(store) && (store !== 'library_activity' || isActivitySynced()) && (store !== 'assistant_config' || configSuitLeCompte())`.
`backfill.js` : `tablesCandidates({ isActivitySynced = () => false, configSuitLeCompte = () => false } = {})` filtre `(t !== 'assistant_config' || configSuitLeCompte())` ; `tablesAEnvoyer` et `envoiInitial` acceptent et propagent `configSuitLeCompte` (aussi dans `total`).
`pull.js:206` : `createPull({ …, configSuitLeCompte = () => false })` ; `tables()` : `retenues = SYNC_STORES.filter((t) => (t !== 'library_activity' || isActivitySynced()) && (t !== 'assistant_config' || configSuitLeCompte()))`.
`moteur.js` : paramètre `configSuitLeCompte = () => false` ; passé à `createPull` (l. 99) et à `envoiInitial` (l. 175).
`src/app.js` : importer `configAssistantSuitLeCompte` depuis `./sync/config.js` ; `installCapture(repo.db, { getUserId: …, isActivitySynced, configSuitLeCompte: () => configAssistantSuitLeCompte() })` ; `createMoteur({ …, configSuitLeCompte: () => configAssistantSuitLeCompte() })`.

- [ ] **Step 4 : vert**, total, `sw.js -4`. **Step 5 : commit** `Assistant par le compte 4 : production seulement, predicat injecte dans capture, envoi initial, reception, moteur`

---

### Task 5 : Conflits sans écran et tombale (deux appareils, arbitre factice)

**Files:**
- Modify: `src/sync/pull.js:241-277` (`appliquerPage`), `src/sync/reponses.js:366-379`
- Test: `tests/assistant-compte.js` (bloc T5), `sw.js -5`

- [ ] **Step 1 : tests rouges**

```js
  // --- T5 : jamais de conflit à trancher (K-5, § 5.5), tombale (§ 5.4, S5/F6), S1 « K2 reste partout »
  const { createPush } = await import('../src/sync/push.js');
  const { decider } = await import('../src/sync/pull.js');
  const H = { t1: '2026-10-17T10:00:00.000Z', t2: '2026-10-17T11:00:00.000Z', t3: '2026-10-17T12:00:00.000Z' };
  const L = (k, t) => ({ id: 'llm', provider: 'anthropic', model: 'm', base_url: '', api_key: k, updated_at: t });
  // decider reste PUR et générique : ses verdicts ne changent pas (F7)
  eq(decider({ locale: L('a', H.t1), distante: { data: L('b', H.t1), updated_at: H.t1, deleted_at: null } }), 'conflit', 'decider : inchangé (égalité différente → conflit) ; la règle du magasin vit dans appliquerPage');
  const deuxAppareils = async (scenario) => withRepo(async (repo, dbA) => withDatabase(async (dbB) => {
    const tf = creerTransportFactice({ serveur: true });
    installCapture(dbB, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    uninstallCapture(dbA); installCapture(dbA, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
    const push = (db) => createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
    const pull = (db) => createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true }).recevoir();
    try { return await scenario({ dbA, dbB, tf, push, pull, repo }); } finally { uninstallCapture(dbB); }
  }));
  const propre = async (db) => [(await db.getAll('sync_conflicts')).length, (await db.getAll('outbox')).filter((e) => e.store === 'assistant_config').length];
  // 1. Plus récent ailleurs → écrit ici
  await deuxAppareils(async ({ dbA, dbB, push, pull }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-A', H.t1)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-B', H.t2)] } }); await push(dbB);
    await pull(dbA);
    eq([(await dbA.get('assistant_config', 'llm')).api_key, ...(await propre(dbA))], ['sk-factice-B', 0, 0], 'K-5 : plus récent ailleurs → écrit ici, aucun conflit, rien en file');
  });
  // 2. Égalité différente → le COMPTE gagne, sans écran (réception et envoi)
  await deuxAppareils(async ({ dbA, dbB, push, pull }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-compte', H.t2)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-local', H.t2)] } });
    await pull(dbB);
    eq([(await dbB.get('assistant_config', 'llm')).api_key, ...(await propre(dbB))], ['sk-factice-compte', 0, 1], 'K-5 réception : égalité différente → la version du compte est écrite ici, aucun conflit (l’entrée de file locale reste : l’envoi la réglera)');
    const r = await push(dbB);
    eq([r.conflits, ...(await propre(dbB)), (await dbB.get('assistant_config', 'llm')).api_key, tf.ligne('assistant_config', 'llm').data.api_key], [0, 0, 0, 'sk-factice-compte', 'sk-factice-compte'], 'K-5 envoi : refus conflit → entrée retirée, aucun conflit journalisé, le compte reste');
  });
  // 3. Plus récent ici → repart, sans journal
  await deuxAppareils(async ({ dbA, dbB, push, pull }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-vieux', H.t1)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-neuf', H.t3)] } });
    await pull(dbB);
    eq([(await dbB.get('assistant_config', 'llm')).api_key, (await dbB.getAll('sync_conflicts')).length], ['sk-factice-neuf', 0], 'K-5 : plus récent ici → conservé, aucun conflit');
    await push(dbB); await pull(dbA);
    eq([(await dbA.get('assistant_config', 'llm')).api_key, ...(await propre(dbA))], ['sk-factice-neuf', 0, 0], 'K-5 : … et il arrive sur l’autre appareil');
  });
  // 4. Refus conflit au push alors que la fiche a BOUGÉ pendant l'aller-retour (R-L3-7, S11) : rien réécrit
  await deuxAppareils(async ({ dbA, dbB, push, pull, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-compte', H.t2)] } }); await push(dbA);
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-perdant', H.t2)] } });
    // simuler l'édition pendant l'aller-retour : le transport pousse puis on modifie la fiche locale avant l'application
    const vraiPousser = tf.pousser.bind(tf);
    tf.pousser = async (rows) => { const rep = await vraiPousser(rows); await dbB.mutate({ puts: { assistant_config: [L('sk-factice-tape-pendant', H.t3)] } }); return rep; };
    await push(dbB);
    eq([(await dbB.get('assistant_config', 'llm')).api_key, (await dbB.getAll('sync_conflicts')).length], ['sk-factice-tape-pendant', 0], 'S11 : la fiche a bougé pendant l’aller-retour → la version du serveur n’écrase pas la saisie ; aucun conflit');
    tf.pousser = vraiPousser;
    await push(dbB);
    eq(tf.ligne('assistant_config', 'llm').data.api_key, 'sk-factice-tape-pendant', 'S11 : … et la saisie (plus récente) part à son tour');
  });
  // 5. Tombale reçue : JAMAIS écrite (elle porte l'ancienne clé) ; plus récente → suppression locale d'origine remote
  await deuxAppareils(async ({ dbA, dbB, push, pull, tf }) => {
    await dbA.mutate({ puts: { assistant_config: [L('sk-factice-ancienne', H.t1)] } }); await push(dbA); await pull(dbB);
    // un autre client (hors de ce code) supprime : le serveur garde data (coalesce) — simulé par le factice
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-ancienne', H.t2), updated_at: H.t2, deleted: true }]);
    ok(tf.ligne('assistant_config', 'llm').deleted_at && tf.ligne('assistant_config', 'llm').data.api_key === 'sk-factice-ancienne', 'tombale : le serveur porte deleted_at ET l’ancienne data (comme sync_push)');
    const r = await pull(dbB);
    eq([await dbB.get('assistant_config', 'llm'), ...(await propre(dbB)), r.supprimees], [undefined, 0, 0, 1], 'tombale plus récente → ligne locale SUPPRIMÉE (origine remote, noDelete laisse passer), rien écrit, rien en file');
    // tombale data {} (après purge) : ni erreur ni blocage
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: {}, updated_at: H.t3, deleted: true }]);
    const r2 = await pull(dbB);
    eq([r2.erreur, await dbB.get('assistant_config', 'llm')], [null, undefined], 'tombale data {} → pas d’erreur, le curseur avance');
    // tombale PLUS ANCIENNE qu'une saisie locale : remise en file, pas de journal (§ 5.4)
    await dbB.mutate({ puts: { assistant_config: [L('sk-factice-apres', '2026-10-18T00:00:00.000Z')] } });
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: {}, updated_at: '2026-10-17T23:00:00.000Z', deleted: true }]);
    await pull(dbB);
    eq([(await dbB.get('assistant_config', 'llm'))?.api_key, (await dbB.getAll('sync_conflicts')).length, (await dbB.getAll('outbox')).some((e) => e.store === 'assistant_config' && e.op === 'put')], ['sk-factice-apres', 0, true], 'tombale plus ancienne → la saisie locale reste et repart, aucun conflit');
  });
  // 6. S1 : le serveur porte K2 (tournée) ; une base monte avec K1 dans settings → K2 reste partout
  {
    const repoModule = await import('../src/model/repo.js');
    const origine = repoModule.db;
    const tf = creerTransportFactice({ serveur: true });
    await tf.pousser([{ store: 'assistant_config', id: 'llm', data: L('sk-factice-K2', H.t3), updated_at: H.t3 }]);
    await withDatabase(async (db) => {
      await db.mutate({ puts: { settings: [{ key: 'llm', value: { provider: 'anthropic', model: 'm', api_key: 'sk-factice-K1' }, updated_at: H.t1 }] }, origin: 'device' });
      repoModule.bindDatabase(db);
      try {
        await repoModule.init();
        installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, configSuitLeCompte: () => true });
        const r = await createPush({ db, transport: tf, getUserId: () => 'u1' }).envoyer();
        await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', configSuitLeCompte: () => true }).recevoir();
        eq([tf.ligne('assistant_config', 'llm').data.api_key, (await db.get('assistant_config', 'llm')).api_key, r.conflits, (await db.getAll('sync_conflicts')).length], ['sk-factice-K2', 'sk-factice-K2', 0, 0], 'S1 : K1 (horodatage d’origine, plus vieux) ne bat pas K2 ; K2 arrive ici ; aucun conflit');
      } finally { uninstallCapture(db); repoModule.bindDatabase(origine); }
    });
  }
```
Si le scénario 4 exige un crochet que le factice ne permet pas (`tf.pousser` non remplaçable), remplacer par un transport scripté qui rend `rejected` `conflit` avec `server` et faire l'écriture locale entre `lireFile` et `appliquer` par un `db.get` espionné ; le fait mesuré reste : **la version du serveur n'écrase pas une fiche dont `updated_at` a changé**.

- [ ] **Step 2 : rouge.** **Step 3 : code**

`pull.js`, dans `appliquerPage`, remplacer `const decision = decider({ locale, distante: ligne });` par :
```js
      const decision = regleDuMagasin(table, decider({ locale, distante: ligne }));
      if (decision === 'renvoyer_seulement') { // K-5 : plus récent ici → repart, SANS entrée de journal
        refile.push({ user_id: getUserId(), store: table, id: ligne.id, op: 'put', updated_at: locale.updated_at || null, tries: 0 });
        continue;
      }
```
et, au niveau du module :
```js
// Spec assistant-par-le-compte K-5 (§ 5.5) : pour assistant_config, I7 s'applique SANS écran. `decider` reste pur et
// générique ; la règle du magasin se pose ici, après lui. Une tombale reçue suit le chemin générique ('supprimer' ou
// 'renvoyer_seulement') : jamais 'ecrire' d'une tombale — elle porte l'ancienne data, clé comprise (S5/F6).
function regleDuMagasin(table, decision) {
  if (table !== 'assistant_config') return decision;
  if (decision === 'conflit') return 'ecrire';
  if (decision === 'conflit_renvoyer') return 'renvoyer_seulement';
  return decision;
}
```
Vérifier que `'ecrire'` d'une ligne `deleted_at` posée est impossible : `decider` rend `'supprimer'`/`'conflit_renvoyer'` dès que `distante.deleted_at` (pull.js:57) — ajouter un test unitaire si besoin : `regleDuMagasin` n'est appelé qu'après.

`reponses.js`, branche `if (r.reason === 'conflit')` :
```js
    if (r.reason === 'conflit') {
      for (const s of seqs) retirer.push(s);
      if (r.store === 'assistant_config') {
        // K-5 (§ 5.5, S11/F7) : aucun journal. La version du compte est réécrite ici seulement si elle existe, n'est pas
        // une tombale, est au moins aussi récente, ET si la fiche n'a pas bougé pendant l'aller-retour (R-L3-7) —
        // sinon rien : une saisie faite entre-temps a sa propre entrée de file. Jamais remettre en file la version
        // refusée : elle n'est pas plus récente, le serveur la refuserait encore.
        const element = lot.elements.find((e) => cleDe(e) === k);
        const locale = fichesLocales[k];
        const serveur = r.server;
        const inchangee = !!locale && !!element && locale.updated_at === element.updated_at;
        const aussiRecente = !!serveur?.data && !serveur.deleted_at && Number.isFinite(Date.parse(serveur.updated_at)) && Date.parse(serveur.updated_at) >= Date.parse(locale?.updated_at || 0);
        // `id` forcé (revue Neegan 1.3) : la clé primaire ne dépend jamais de ce que `data` porte.
        if (inchangee && aussiRecente) (reecrire[r.store] ||= []).push({ ...serveur.data, id: element.id, updated_at: serveur.updated_at });
        continue;
      }
      conflits.push({ … inchangé … });
    }
```

- [ ] **Step 4 : vert**, total, `sw.js -5`. **Step 5 : commit** `Assistant par le compte 5 : conflits sans ecran, tombale jamais ecrite, S1 prouve a deux appareils`

---

### Task 6 : Archives (K-7) et cycle du compte (K-8)

**Files:**
- Modify: `src/domain/backup.js:297` (`clearStores` du remplacement)
- Test: `tests/assistant-compte.js` (bloc T6), `sw.js -6`

- [ ] **Step 1 : tests rouges**

```js
  // --- T6 : archives (K-7) et cycle du compte (K-8)
  const B = await import('../src/domain/backup.js');
  await withRepo(async (repo, db) => {
    await repo.saveAssistantConfig({ provider: 'anthropic', model: 'm', api_key: 'sk-factice-archive' });
    await repo.save('books', { id: 'b_arch', title: 'Livre' });
    const archive = await B.createArchive(db);
    const texte = new TextDecoder().decode(await archive.blob.arrayBuffer());
    ok(!texte.includes('sk-factice-archive') && !texte.includes('assistant_config'), 'K-7 : ni la clé ni le magasin dans les octets du ZIP');
    const inspection = await B.inspectArchive(archive.blob);
    ok(!('assistant_config' in (inspection.payload?.stores || {})), 'K-7 : l’inspection ne connaît pas ce magasin');
    // remplacement : la ligne reste ; fusion : aussi
    await B.applyArchive(db, inspection, { mode: 'replace' });
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-archive', 'K-7 : une restauration en REMPLACEMENT garde la configuration');
    await B.applyArchive(db, inspection, { mode: 'merge' });
    eq((await repo.getSettings()).llm.api_key, 'sk-factice-archive', 'K-7 : une fusion aussi');
    ok((await B.verifyRestored(db, inspection, { mode: 'replace' })).ok, 'K-7 : le bilan de restauration reste vert malgré le magasin hors archive');
    eq(B.compterFichesSynchronisees(inspection) >= 1, true, 'K-7 : compterFichesSynchronisees tolère l’absence du magasin');
    // K-8 : effacer l'appareil vide la ligne, rien en file, rien envoyé
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    await repo.clearDevice();
    eq([await db.get('assistant_config', 'llm'), (await db.getAll('outbox')).length, (await repo.getSettings()).llm.provider], [undefined, 0, 'none'], 'K-8 : clearDevice vide assistant_config sans rien mettre en file');
  });
  // Une vieille archive (sans ce magasin) reste valide : déjà couvert par tests/backup.js (archives v1) — assertion ici :
  ok(!B.DATA_STORES?.includes?.('assistant_config') ?? true, 'K-7 : DATA_STORES inchangé (si exporté)');
```
(`archive.blob` : vérifier la forme rendue par `createArchive` dans `tests/backup.js:170` — `const { archive, inspection } = await prepared(db)` ; copier `prepared`.)

- [ ] **Step 2 : rouge** (le remplacement efface la ligne). **Step 3 : code** `backup.js:297` :
```js
  // K-7 (spec assistant-par-le-compte) : la configuration de l'assistant n'est pas de la bibliothèque — une
  // restauration en remplacement ne la vide pas (elle n'est dans aucune archive : il n'y aurait rien pour la réécrire).
  await db.putBatch(batch, { clearStores: mode === 'replace' ? Object.keys(STORES).filter((s) => !SYNC_INTERNAL_STORES.includes(s) && s !== 'assistant_config') : [] });
```
- [ ] **Step 4 : vert**, total, `sw.js -6`. **Step 5 : commit** `Assistant par le compte 6 : le remplacement d archive garde la configuration, K-7 et K-8 prouves`

---

### Task 7 : Réglages — section à dépendances injectées, K-6, K-10, K-12, `en.js`

**Files:**
- Modify: `src/ui/settings.js:155-172` (section), `:246-253` (`suivreMoteurDeLaPage` : `occupe`), imports
- Modify: `src/i18n/en.js` (chaînes neuves)
- Test: `tests/assistant-compte.js` (bloc T7), `sw.js -7`

**Interfaces:**
- Produces: `export function sectionAssistant({ llm, sync, lie, suitLeCompte }, { saveConfig = repo.saveAssistantConfig, confirm = confirmDialog, dire = toast, tester = …, rafraichir = refresh } = {}) → HTMLElement` (avec `data-section="assistant"`) ; `export function texteAssistant({ sync, lie, suitLeCompte }) → string` ; `export function occupeParAssistant(doc = document) → boolean`.

- [ ] **Step 1 : tests rouges**

```js
  // --- T7 : Réglages (K-6, K-10, K-12)
  const S = await import('../src/ui/settings.js');
  const scene = document.createElement('div'); scene.hidden = true; document.body.append(scene);
  try {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const texteDe = (sync, lie, prod) => S.texteAssistant({ sync, lie, suitLeCompte: () => prod });
    ok(texteDe({}, false, false).includes('adresse de développement'), 'K-10 (a) : hôte hors production');
    ok(texteDe({}, false, true).includes('Sans compte'), 'K-10 (b) : jamais connectée');
    ok(texteDe({}, true, true).includes('prochaine connexion'), 'K-10 (c) : appareil lié, déconnecté');
    ok(texteDe({ user: { id: 'u1' } }, true, true).includes('suit ton compte'), 'K-10 (d) : connectée');
    for (const [sync, lie, prod] of [[{}, false, false], [{}, false, true], [{}, true, true], [{ user: { id: 'u1' } }, true, true]]) ok(texteDe(sync, lie, prod).includes('jamais incluse dans les sauvegardes ZIP'), 'K-10 : toujours la phrase des archives');
    const monter = (llm, sync, deps) => { const sec = S.sectionAssistant({ llm, sync, lie: !!sync.user, suitLeCompte: () => true }, { tester: async () => 'OK', rafraichir: () => {}, ...deps }); scene.append(sec); return sec; };
    const bouton = (root, nom) => [...root.querySelectorAll('button')].find((b) => b.textContent === nom);
    const selectFournisseur = (root) => root.querySelector('select');
    // K-6 : « Aucun » sans ligne ici → rien écrit
    {
      const appels = []; const dits = [];
      const sec = monter({ provider: 'none', model: '', base_url: '', api_key: '' }, {}, { saveConfig: async (c) => { appels.push(c); }, dire: (m) => dits.push(m), confirm: async () => true });
      bouton(sec, 'Enregistrer').click(); await tick();
      eq([appels.length, dits.length > 0], [0, true], 'K-6 : « Aucun » sans configuration ici → rien écrit, et on le dit');
      sec.remove();
    }
    // K-6 : « Aucun » avec clé et compte → confirmation ; refusée → rien ; acceptée → ligne vide
    for (const reponse of [false, true]) {
      const appels = []; let demandes = 0;
      const sec = monter({ provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-ui' }, { user: { id: 'u1' } }, { saveConfig: async (c) => { appels.push(c); }, dire: () => {}, confirm: async () => { demandes += 1; return reponse; } });
      const sel = selectFournisseur(sec); sel.value = 'none'; sel.dispatchEvent(new Event('change'));
      bouton(sec, 'Enregistrer').click(); await tick();
      eq([demandes, appels.map((c) => c.provider)], [1, reponse ? ['none'] : []], `K-6 : confirmation ${reponse ? 'acceptée → ligne vide' : 'refusée → rien'}`);
      sec.remove();
    }
    // Enregistrer normal : la config normalisée part à saveConfig ; la clé n'est ni dans textContent ni dans outerHTML
    {
      const appels = [];
      const sec = monter({ provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-ui' }, { user: { id: 'u1' } }, { saveConfig: async (c) => { appels.push(c); }, dire: () => {}, confirm: async () => true });
      const champCle = sec.querySelector('input[type="password"]');
      ok(!!champCle && !sec.textContent.includes('sk-factice-ui') && !sec.outerHTML.includes('sk-factice-ui'), 'K-2 : champ password, clé ni dans le texte ni dans le HTML');
      champCle.value = 'sk-factice-nouvelle'; champCle.dispatchEvent(new Event('input'));
      bouton(sec, 'Enregistrer').click(); await tick();
      eq(appels, [{ provider: 'anthropic', model: 'm', base_url: '', api_key: 'sk-factice-nouvelle' }], 'Enregistrer : saveConfig reçoit la configuration tapée');
      // K-12 : focus RÉEL dans la section (revue Neegan 1.4 : un nœud sous `hidden` ne reçoit jamais le focus, et
      // « occupé === (activeElement === champ) » valait false === false — un faux vert). La scène est rendue visible
      // le temps du focus.
      scene.hidden = false;
      champCle.focus();
      eq(document.activeElement, champCle, 'K-12 : le champ a réellement reçu le focus');
      eq(S.occupeParAssistant(), true, 'K-12 : occupé quand le focus est dans la section');
      champCle.blur();
      scene.hidden = true;
      eq(S.occupeParAssistant(), false, 'K-12 : libre sans focus');
      sec.remove();
    }
    // S14 sur « Tester » (revue Neegan 1.1, critique) : le test part de la configuration NORMALISÉE — une base_url en
    // http ou avec identifiants ne reçoit jamais la clé en Bearer, même avant « Enregistrer ».
    {
      const recu = [];
      const sec = monter({ provider: 'openai_compatible', model: 'm', base_url: 'http://x.invalid/v1', api_key: 'sk-factice-test' }, {}, { tester: async (cfg) => { recu.push(cfg); return 'OK'; }, saveConfig: async () => {}, dire: () => {}, confirm: async () => true });
      bouton(sec, 'Tester').click(); await tick();
      eq(recu, [{ provider: 'openai_compatible', model: 'm', base_url: '', api_key: 'sk-factice-test' }], 'S14 : « Tester » reçoit la configuration normalisée (base_url http vidée)');
      const urlBase = [...sec.querySelectorAll('input[type="text"]')].find((i) => i.placeholder.startsWith('https://api.openai.com'));
      urlBase.value = 'https://u:p@x.invalid/v1'; urlBase.dispatchEvent(new Event('input'));
      bouton(sec, 'Tester').click(); await tick();
      eq(recu.at(-1).base_url, '', 'S14 : identifiants dans l’URL → vidée aussi pour « Tester »');
      sec.remove();
    }
    // K-6 : après un « Enregistrer » réussi, « Aucun » sait qu'une ligne existe maintenant (revue Neegan 1.5 : `avait` suit)
    {
      const appels = [];
      const sec = monter({ provider: 'none', model: '', base_url: '', api_key: '' }, {}, { saveConfig: async (c) => { appels.push(c); }, dire: () => {}, confirm: async () => true });
      const sel = selectFournisseur(sec); sel.value = 'anthropic'; sel.dispatchEvent(new Event('change'));
      const champs = [...sec.querySelectorAll('input')];
      const modele = champs.find((i) => i.placeholder.startsWith('ex. gpt')); modele.value = 'm'; modele.dispatchEvent(new Event('input'));
      const cle = sec.querySelector('input[type="password"]'); cle.value = 'sk-factice-puis-aucun'; cle.dispatchEvent(new Event('input'));
      bouton(sec, 'Enregistrer').click(); await tick();
      sel.value = 'none'; sel.dispatchEvent(new Event('change'));
      bouton(sec, 'Enregistrer').click(); await tick();
      eq(appels.map((c) => c.provider), ['anthropic', 'none'], 'K-6 : enregistrer puis « Aucun » dans la même instance → la ligne vide part (avait mis à jour)');
      sec.remove();
    }
    // suivreMoteur ne rafraîchit pas quand occupé (déjà éprouvé ; ici : le câblage de la page passe par occupeParAssistant)
    ok(typeof S.occupeParAssistant === 'function', 'K-12 : occupeParAssistant exporté et câblé dans suivreMoteurDeLaPage (lire le source : pas testable autrement sans monter la page)');
  } finally { scene.remove(); }
  // en.js : les quatre textes K-10 et les chaînes neuves ont une traduction
  const { EN } = await import('../src/i18n/en.js'); // export nommé `EN` (src/i18n/en.js:3)
  for (const fr of ['Sur cette adresse de développement, la configuration reste sur cet appareil.', 'Sans compte, la configuration reste sur cet appareil.', 'Ce qui est enregistré ici partira à ton compte à la prochaine connexion.', 'La configuration de l’assistant suit ton compte sur tes appareils connectés.', 'Elle n’est jamais incluse dans les sauvegardes ZIP.', 'Retirer l’assistant de tous tes appareils ?', 'Rien à retirer : aucun assistant n’est configuré ici.']) ok(typeof EN[fr] === 'string' && EN[fr].length > 0, 'en.js : ' + fr.slice(0, 40));
```
(Vérifier l'export réel de `src/i18n/en.js` — `export default { … }` ou nommé — et adapter la lecture.)

- [ ] **Step 2 : rouge.** **Step 3 : code** (`src/ui/settings.js`)

Imports : `import { normaliserConfigAssistant, configVide } from '../domain/assistant-config.js';` et `import { configAssistantSuitLeCompte } from '../sync/config.js';`

```js
// K-10 : quatre états, un texte chacun — ce qui se passe SUR CET APPAREIL, MAINTENANT. Toujours la phrase des archives.
export function texteAssistant({ sync = {}, lie = false, suitLeCompte = configAssistantSuitLeCompte } = {}) {
  let etat;
  if (!suitLeCompte()) etat = t('Sur cette adresse de développement, la configuration reste sur cet appareil.');
  else if (sync.user) etat = t('La configuration de l’assistant suit ton compte sur tes appareils connectés.');
  else if (lie) etat = t('Ce qui est enregistré ici partira à ton compte à la prochaine connexion.');
  else etat = t('Sans compte, la configuration reste sur cet appareil.');
  return `${etat} ${t('Elle n’est jamais incluse dans les sauvegardes ZIP.')}`;
}

// K-12 : la page n'est pas reconstruite sous les doigts — le focus dans cette section vaut « occupé » pour suivreMoteur.
export const occupeParAssistant = (doc = document) => !!doc.activeElement?.closest?.('[data-section="assistant"]');

// Section « Assistant IA », à dépendances injectées (F12 : on ne pose pas d'espion sur un espace de noms de module).
export function sectionAssistant({ llm: initial, sync = {}, lie = false, suitLeCompte = configAssistantSuitLeCompte },
  { saveConfig = repo.saveAssistantConfig, confirm = confirmDialog, dire = toast, tester = null, rafraichir = refresh } = {}) {
  const llm = { provider: 'none', base_url: '', model: '', api_key: '', ...(initial || {}) };
  let avait = !configVide(initial); // suit les enregistrements de cette instance (revue Neegan 1.5)
  const llmStatus = el('div', { class: 'muted' });
  const enregistrer = async () => {
    const cfg = normaliserConfigAssistant(llm);
    if (cfg.provider === 'none') {
      // K-6 (F5) : sans ligne ici, « Aucun » n'écrit RIEN — une ligne vide plus récente effacerait la clé du compte.
      if (!avait) { dire(t('Rien à retirer : aucun assistant n’est configuré ici.')); return; }
      if (sync.user && !(await confirm(t('Retirer l’assistant de tous tes appareils ?'), { danger: true, okLabel: t('Retirer') }))) return;
    }
    await saveConfig(cfg);
    avait = !configVide(cfg);
    dire(t('Assistant enregistré'));
    rafraichir();
  };
  // S14 (revue Neegan 1.1, critique) : « Tester » part de la configuration NORMALISÉE, jamais de l'objet tapé — une
  // base_url en http ou avec identifiants ne reçoit la clé en Bearer ni avant ni après « Enregistrer ».
  const testerCfg = async () => {
    const cfg = normaliserConfigAssistant(llm);
    if (tester) return tester(cfg);
    const p = providerFrom({ llm: cfg });
    if (!p.configured) throw new Error(t('Configuration incomplète'));
    return String(await p.complete([{ role: 'user', content: 'Réponds uniquement : OK' }], { maxTokens: 5 })).slice(0, 80);
  };
  const sec = section(t('Assistant IA'),
    el('p', { class: 'muted' }, t('Fournisseur-agnostique. Sans configuration, tout fonctionne à la main.') + ' ' + texteAssistant({ sync, lie, suitLeCompte })),
    el('div', { class: 'two-col' },
      field(t('Fournisseur'), select([{ value: 'none', label: t('Aucun (manuel)') }, { value: 'openai_compatible', label: t('API compatible OpenAI (OpenAI, Ollama, LM Studio…)') }, { value: 'anthropic', label: 'Anthropic' }], llm.provider, (v) => { llm.provider = v; })),
      field(t('Modèle'), el('input', { type: 'text', value: llm.model, placeholder: 'ex. gpt-4o / claude-…', onInput: (e) => { llm.model = e.target.value.trim(); } })),
      field(t('URL de base (compatible OpenAI seulement)'), el('input', { type: 'text', value: llm.base_url, placeholder: 'https://api.openai.com/v1', onInput: (e) => { llm.base_url = e.target.value.trim(); } })),
      field(t('Clé API'), el('input', { type: 'password', value: llm.api_key, autocomplete: 'off', onInput: (e) => { llm.api_key = e.target.value.trim(); } }))),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onClick: enregistrer }, t('Enregistrer')),
      el('button', { class: 'btn', onClick: async () => { llmStatus.textContent = t('Test en cours…'); try { llmStatus.textContent = `${t('Réponse')} : ${await testerCfg()}`; } catch (e) { llmStatus.textContent = `${t('Échec')} : ${e.message}`; } } }, t('Tester')),
      llmStatus));
  sec.dataset.section = 'assistant';
  return sec;
}
```
Dans `renderSettings` : remplacer le bloc « Assistant IA » par `const lie = !!(await repo.db.get('sync_state', 'user_id'))?.value; root.append(sectionAssistant({ llm: s.llm, sync, lie }));`. Vérifier que `select()` de components accepte un `onChange` qui reçoit la valeur (ligne 158 actuelle : `(v) => { llm.provider = v; }` — oui). Dans `suivreMoteurDeLaPage` : `occupe: () => archiveOperation || occupeParAssistant()`.

`src/i18n/en.js` : les sept chaînes (K-10 ×5, confirmation, « Rien à retirer ») + 'Retirer' si absente.

- [ ] **Step 4 : vert**, total, `sw.js -7`. **Step 5 : commit** `Assistant par le compte 7 : section Reglages injectee, Aucun prudent, quatre textes d etat, formulaire non reconstruit sous le focus`

---

### Task 8 : Générateur, migration `0003`, preuve, README

**Files:**
- Modify: `tools/generer-migrations.mjs` (ENTETE paramétré, `fonctions(stores)`, `0001` depuis `SYNC_STORES_0001`, `0003`, troisième cible)
- Modify: `tools/generer-migrations.test.mjs:1-60, 208, 324-355` (+ empreintes, + `0003`)
- Create: `supabase/migrations/0003_assistant_config.sql` (généré), `supabase/proofs/0003_assistant_config.sql`
- Modify: `supabase/README.md` (étape « 8. Coller 0003 et jouer sa preuve » avant « Où coller les sorties »), `supabase/proofs/RESULTATS-mitsu.md` (section vide datée à remplir par Neegan)

- [ ] **Step 1 : tests node rouges** (`tools/generer-migrations.test.mjs`)

```js
import { createHash } from 'node:crypto';
import { SYNC_STORES_0001 } from '../src/sync/tables.js';
const { tables: sql, storage, delta } = renderMigrations();
const sha = (s) => createHash('sha256').update(s).digest('hex');

test('0001 et 0002 : octet pour octet ceux appliques sur mitsu (empreintes du 17 octobre 2026)', () => {
  assert.equal(sha(sql), 'e90ff35ec7c031f63dfb903e6885103ed7e42202866f59359ce019d00b85ee51');
  assert.equal(sha(storage), '2e90d2b1beb7270601f83c7408b1a2a2be32c800772f14f454960b233a2d5944');
});
test('0003 : une table neuve, revoke anon, quatre fonctions avec les 26 magasins', () => {
  const nouvelles = SYNC_STORES.filter((s) => !SYNC_STORES_0001.includes(s));
  assert.deepEqual(nouvelles, ['assistant_config']);
  assert.equal((delta.match(/create table public\./g) || []).length, 1);
  assert.match(delta, /create table public\.assistant_config \(/);
  assert.equal((delta.match(/create policy[^;]+;/g) || []).length, 4);
  assert.equal((delta.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 1);
  assert.match(delta, /create index assistant_config_recv on public\.assistant_config \(owner_id, server_seq\);/);
  assert.match(delta, /revoke all on public\.assistant_config from anon;/);
  const litteral26 = 'array[' + SYNC_STORES.map((s) => `'${s}'`).join(', ') + ']';
  assert.equal(delta.split(litteral26).length - 1, 4, 'sync_push, sync_purge, sync_purge_all, purge_tombstones');
  assert.match(delta, /"assistant_config":"id"/);
  assert.match(delta, /"assistant_config":\[\]/);
  assert.doesNotMatch(delta, /cron\.schedule/);
  assert.doesNotMatch(delta, /create table public\.books/);
  assert.match(delta, /grant execute on function public\.sync_push\(jsonb\) to authenticated;/);
});
```
Retourner : l. 23 boucle sur `SYNC_STORES_0001` ; l. 49-52 littéral `SYNC_STORES_0001` ; `NOMS` += `'0003_assistant_config.sql'` ; test F1 d'écriture compare aussi `0003`.

- [ ] **Step 2 : rouge** (`node --test tools/*.test.mjs`). **Step 3 : générateur**

```js
import { TABLES, SYNC_STORES_0001 } from '../src/sync/tables.js';
const ENTETE = (nom, spec = 'docs/spec-compte-et-stockage-distant.md (v3)') => `-- ${nom} — généré par tools/generer-migrations.mjs ; ne pas éditer à la main.
-- Spec : ${spec}. Aucune valeur personnelle ici : les adresses vont dans private.allowed_users par l'éditeur SQL.

`;
// Les quatre fonctions qui portent la liste littérale des magasins (sync_push, sync_purge, sync_purge_all,
// purge_tombstones), rendues pour UNE liste : 0001 avec les 25 d'origine, 0003 avec les 26. Le texte est celui de 0001,
// déplacé tel quel : --check et l'empreinte SHA-256 du test prouvent qu'il n'a pas bougé d'un octet.
function fonctions(stores) {
  const keys = JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s].key])));
  const required = JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s].required])));
  return `-- Envoi (spec § 3.4) : sous RLS, par élément, idempotent, jamais d'exception pour une ligne.
create or replace function public.sync_push(rows jsonb) returns jsonb
… (lignes 130 à 268 du fichier actuel, VERBATIM, de « language plpgsql security invoker » à
    « revoke execute on function public.purge_tombstones() from public, anon, authenticated; ») …
`;
}
export function renderMigrations() {
  const stores = SYNC_STORES_0001;
  const tables = ENTETE('0001_tables_et_regles.sql') + `create extension if not exists pg_cron;
… (lignes 54 à 127 actuelles, VERBATIM, `${stores.map(table).join('\n')}` compris) …
` + fonctions(stores) + `select cron.schedule('cuisine-os-tombales', '15 4 * * *', 'select public.purge_tombstones()');
`;
  const storage = ENTETE('0002_stockage.sql') + `… inchangé …`;
  const nouvelles = SYNC_STORES.filter((s) => !SYNC_STORES_0001.includes(s));
  const delta = ENTETE('0003_assistant_config.sql', 'docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md (rév. 2, § 6)') + `-- Migration À AJOUT SEUL : ${nouvelles.length} table(s) neuve(s) et les quatre fonctions recréées avec la liste des ${SYNC_STORES.length} magasins.
-- À coller APRÈS 0001 et 0002, une seule fois. Les droits des fonctions sont rejoués (idempotents).

${nouvelles.map(table).join('\n')}${nouvelles.map((s) => `revoke all on public.${s} from anon;\n`).join('')}
` + fonctions(SYNC_STORES);
  return { tables, storage, delta };
}
```
Attention aux sauts de ligne : le fichier `0001` actuel a une ligne vide entre `revoke execute on function public.touch_server_seq() …;` et `-- Envoi …`, et `select cron.schedule(…)` suit **immédiatement** `revoke execute … purge_tombstones …;`. Après la factorisation : `node tools/generer-migrations.mjs --check` **doit rendre 0 avant d'écrire 0003** (lancer `--check` avec l'ancien `targets` à deux cibles d'abord, puis ajouter la troisième cible et écrire `0003` : `node tools/generer-migrations.mjs`). `targets` : `[['0001_tables_et_regles.sql', tables], ['0002_stockage.sql', storage], ['0003_assistant_config.sql', delta]]`. Mettre à jour le commentaire d'usage en tête.

- [ ] **Step 4 : preuve `supabase/proofs/0003_assistant_config.sql`** — même squelette que `0001` (en-tête avec les quatre jetons, gardes de lecture, `create temporary table preuve`, `begin;` … `rollback;`, `BILAN` 999). Verdicts (numéros libres, étapes nommées) :
  - 1.01 table présente et RLS activée (`pg_class.relrowsecurity`) ; 1.02 quatre règles (`pg_policies`) ; 1.03 déclencheur `assistant_config_seq` ; 1.04 index `assistant_config_recv`.
  - 2.01 `authenticated` a select/insert/update sur `public.assistant_config` ; 2.02 **`anon` n'a aucun privilège sur les 26 tables** (`count(*) = 26` sur `pg_tables where schemaname = 'public'`, même expression que 8.01) ; 2.03-2.06 `has_function_privilege('anon', …)` = false pour `sync_push(jsonb)`, `sync_purge(text, text)`, `sync_purge_all()`, `purge_tombstones()` ; 2.07 `authenticated` exécute `sync_push`.
  - 3.01 (A, `set local role authenticated` + claims) : `sync_push` d'un élément `{"store":"assistant_config","id":"llm","data":{"id":"llm","provider":"anthropic","model":"m","base_url":"","api_key":"sk-factice-preuve"},"updated_at":"2026-10-17T10:00:00Z"}` → `accepted 1` ; 3.02 A relit `count(*) = 1` et `length(data->>'api_key') = 17` — **jamais la valeur** ; 3.03 A pousse `'llm'` avec `updated_at` **plus ancien** et une autre clé factice → `rejected 1`, `reason = 'conflit'` ; 3.04 A pousse `'llm'` plus récent → `accepted 1` et `length(data->>'api_key')` change.
  - 4.01 (B) `count(*) = 0` sur la table ; 4.02 B pousse son propre `'llm'` → `accepted 1` ; 4.03 (`reset role`) vu de postgres : 2 lignes, 2 propriétaires.
  - 5.01 (A) `delete from public.assistant_config where id = 'llm'` sans `app.purge` → `row_count = 0` (comme 4.01 de 0001).
  - 6.01-6.04 `pg_get_functiondef` des quatre fonctions contient `'assistant_config'`.
  - 7.01 `current_setting('log_min_error_statement')`, 7.02 `current_setting('log_parameter_max_length_on_error')` (verdict informatif : `ok = true`, valeur imprimée).
  - 999 BILAN.
  La preuve n'imprime **jamais** `data` entier. Le test node `preuve 0003 : …` (à ajouter) vérifie : `rollback;` final, aucune adresse réelle (`@` seulement dans les jetons), `length(data->>'api_key')`, absence de `select data` / `data::text`, présence de `has_table_privilege('anon'`, `= 26`.

- [ ] **Step 5 : README et RESULTATS** — `supabase/README.md` : nouvelle étape « ### 8 bis. Coller `0003_assistant_config.sql`, puis jouer sa preuve » (après l'étape 9 actuelle ou renumérotée : préalables = deux adresses `exemple.invalid` dans `allowed_users`, quatre jetons, « Run without RLS », retirer les adresses, `notify pgrst, 'reload schema';` si 404, **avant** tout `push` du code) + la procédure « Appareil perdu ou clé exposée » (spec § 7). `RESULTATS-mitsu.md` : section `## Preuve 0003_assistant_config.sql — à jouer (section à remplir par Neegan, sans aucune valeur de data)`.

- [ ] **Step 6 : vert** — `node --test tools/*.test.mjs` tout vert (+N), `node tools/generer-migrations.mjs --check` → 0, `shasum -a 256` des deux premières migrations inchangé. Suite navigateur verte (rien de `src/` touché : `sw.js` inchangé à cette tâche). **Step 7 : commit** `Assistant par le compte 8 : migration 0003 a ajout seul, generateur factorise, empreintes epinglees, preuve 0003, README`

---

### Task 9 : Clôture — docs, spec § 12, STATE.md, versions finales

**Files:**
- Modify: `CLAUDE.md` (nouvelle sous-section « L'assistant suit le compte (17-18 octobre 2026) » : où, ce qui marche, non prouvé, dettes, **ordre des gestes 0003 → push**, procédure « appareil perdu », versions, bilan ; mettre à jour la ligne « Versions » du lot web et le geste 2 retiré), `STATE.md`, `docs/architecture.md` (magasin, table, prédicat, passe unique), spec parente § 11 (ligne « R65 (17 oct 2026) : 26 magasins ; `assistant_config` ; I7 amendé pour ce magasin ; production seulement »), spec web § 11.2 (ligne « I-C et geste R2 amendés par la spec assistant-par-le-compte »), spec de ce lot § 12 (« Rulings de construction » : R-CPT-1 défaut `false`, et tout ruling pris pendant le SDD), `sw.js VERSION -9` si `src/` touché (sinon inchangé)

- [ ] **Step 1 : relire le registre** `.superpowers/sdd/2026-10-17-assistant-compte/progress.md` et lister chaque ruling → spec § 12.
- [ ] **Step 2 : écrire les docs** (faits mesurés seulement : totaux lus dans « obtenu », `--check` 0, empreintes ; « non prouvé » : la passe réelle contre `mitsu` avec `0003`, l'iPhone, le chemin « serveur ancien »).
- [ ] **Step 3 : suite complète + tools + --check + octets invisibles + scan secrets** (`grep -rnEi 'sk-ant-[0-9A-Za-z_-]{10,}' src tests docs supabase tools` → vide ; `sk-factice-` seulement dans `tests/` et `supabase/proofs/0003…`).
- [ ] **Step 4 : commit** `Assistant par le compte 9 : cloture — CLAUDE.md, STATE.md, architecture, specs amendees, rulings`

---

## Self-review (fait à l'écriture)

- **Couverture de la spec** : K-1 (T3), K-2 (T2/T3/T5/T6/T7), K-3/K-4 (T4), K-5 (T5), K-6 (T2/T3/T7), K-7 (T6), K-8 (T6), K-9 (T1/T4), K-10 (T7), K-11 (T3 : aucun consommateur touché), K-12 (T7), § 5.6 (T3/T5), § 6 (T8), § 7 procédure (T8 README / T9 CLAUDE.md), § 8 tests retournés (T1/T3/T8), § 10 gestes (T9). Rien sans tâche.
- **Types et noms** : `configSuitLeCompte` (paramètre) / `configAssistantSuitLeCompte` (fonction de `config.js`) partout ; `saveAssistantConfig`, `normaliserConfigAssistant`, `LIGNE_ASSISTANT`, `SYNC_STORES_0001`, `renvoyer_seulement`, `regleDuMagasin`, `sectionAssistant`, `texteAssistant`, `occupeParAssistant` — mêmes noms de T1 à T9.
- **Placeholders** : les deux « VERBATIM » de T8 désignent des blocs existants du générateur à déplacer sans modification (lignes citées) ; `--check` est leur test.
- **Review Focus** : 1 → T3/T5 ; 2 → T5 ; 3 → T7 ; 4 → T2/T3/T5/T6/T7 ; 5 → T1 (K-9) + T9 (docs).
