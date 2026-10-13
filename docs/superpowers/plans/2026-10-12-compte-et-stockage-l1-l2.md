# Compte et stockage distant — plan d'implémentation, lots L1 et L2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** livrer L1 (schéma serveur généré, règles d'accès, fonctions, preuves SQL) et L2 (durcissement du client, dépendance embarquée vérifiée, connexion Google avec garde de compte, `db.mutate` + capture des écritures, `DB_VERSION 2`) exactement comme la spec v3 les définit, sans rien de L3-L5.

**Architecture:** la source de vérité du schéma serveur est `src/sync/tables.js` (dérivé de `schema.js`) ; un générateur Node sans dépendance (`tools/generer-migrations.mjs`) en produit les migrations SQL commitées ; côté client, `db.js` gagne une porte unique `mutate` qui porte la capture d'outbox dans la même transaction ; `auth.js` enveloppe `supabase-js` (UMD embarqué, vérifié deux fois) ; la synchronisation elle-même (envoi, réception) est L3 et **n'est pas dans ce plan**.

**Tech Stack:** PWA sans build (modules ES natifs), IndexedDB, Node 24 pour les outils (`node:test`, zéro dépendance), Supabase (Postgres 15+, Auth, Storage), tests du domaine dans le navigateur (`tests/index.html`) joués par Playwright (outil MCP `mcp__plugin_playwright_playwright__*`).

**Spec:** `docs/spec-compte-et-stockage-distant.md` (v3, 12 oct 2026 ; décisions D1-D8 prises). Conception amont : `docs/compte-et-stockage-distant.md`. Le plan argumente depuis la spec ; en cas de doute, la spec gagne, et l'écart est consigné dans « Écarts à la spec » en fin de plan.

## Global Constraints

- **Aucune dépendance npm à l'exécution** ; pas de bundler ; modules ES natifs sous `src/`. Les outils sous `tools/` tournent avec `node` (v24) sans `npm install` ; les tests d'outils utilisent `node:test`.
- **Langue** : code, commentaires, interface et commits en français ; chaînes d'interface par `t('…')` ; anglais dans `src/i18n/en.js`.
- **Après toute modification de fichiers de l'app** : mettre à jour la liste `SHELL` de `sw.js` et incrémenter `VERSION` (tâche 14 le fait une fois pour tout le lot ; ne pas le faire à chaque tâche).
- **Espace de travail** : la construction se fait dans le worktree frère `~/projects/mistu-sync` (branche `compte-et-stockage-distant`), jamais dans `~/projects/mistu` (arbre principal, servi sur 8080 et connu de VibeForge). Toute commande du plan s'exécute depuis `~/projects/mistu-sync`.
- **Tests du navigateur** : un serveur statique sert le worktree sur **8081** (`cd ~/projects/mistu-sync && nohup python3 -m http.server 8081 > /dev/null 2>&1 &`, lancé une fois par le contrôleur ; contrôle `curl -sS http://localhost:8081/tests/ | head -3`). Jouer `http://localhost:8081/tests/` avec Playwright : `mcp__plugin_playwright_playwright__browser_navigate` puis `mcp__plugin_playwright_playwright__browser_evaluate` avec `() => document.querySelector('#out h2')?.textContent` → attendu `✅ N/N tests réussis` (aucun `✗`) ; puis `browser_console_messages` niveau `error` → vide. Ne jamais affirmer qu'un test passe sans l'avoir joué.
- **Tests d'outils** : `cd ~/projects/mistu && node --test tools/*.test.mjs` (sortie `# fail 0`).
- **Dépôt public** : aucune adresse courriel, aucun nom de personne, aucune clé secrète dans un fichier commité (la clé `anon` et l'URL du projet sont publiques par conception et vont dans `src/sync/config.js`). `service_role` : jamais, nulle part.
- **Git** : branche `compte-et-stockage-distant` depuis `main` ; un commit par tâche, message français au présent, terminé par la ligne `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` ; **messages de commit sans accents** (le dépôt a déjà un commit aux accents cassés : écrire `e` pour `é`). Jamais `--amend`, `reset`, `rebase`, `stash`. Avant chaque commit : `grep -c $'\xe2\x80[\xa8\xa9]' <fichiers>` doit donner 0 (aucun U+2028/U+2029).
- **Pas de modification** de `cuisine-os-spec-v3.md` (hors dépôt) ; `CLAUDE.md` du projet n'est mis à jour qu'à la tâche 14 (section « État des travaux »).
- **Portée** : rien de L3 (envoi/réception), L4 (fichiers distants), L5. Si une tâche semble l'exiger, consigner l'écart et s'arrêter à la frontière.

---

## Carte des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `src/model/schema.js` | + `SYNC_INTERNAL_STORES`, `SYNC_STORES`, `DB_VERSION 2`, 3 magasins internes, `ARCHIVE_DATA_STORES` filtré | 1, 7 |
| `src/sync/tables.js` | déclaration par table : clé, colonnes générées, champs de relation obligatoires | 1 |
| `src/sync/mime.js` | liste blanche, table extension → type, `resolveMime`, `safeDisplayType` | 2 |
| `tools/generer-migrations.mjs`, `tools/generer-migrations.test.mjs` | génère `supabase/migrations/0001_tables_et_regles.sql`, `0002_stockage.sql` ; `--check` | 3 |
| `supabase/proofs/0001_*.sql`, `0002_*.sql`, `0001_hook.md`, `0001_providers.md` | preuves à coller par Neegan | 4 |
| `src/core/db.js` | `autoIncrement`, `mutate`, `onMutate`, `MUTATING_METHODS` | 6 |
| `src/domain/backup.js` | lignes `files` sans blob tolérées ; remplacement sans toucher aux magasins internes | 7 |
| `index.html`, `tests/index.html`, `tests/tests.css`, `tests/erreur.js` | CSP + referrer ; styles et script externes | 8 |
| `src/core/log.js` | `logError(code, { store, id })` | 8 |
| `src/ui/recipe.js`, `src/ui/import.js`, `src/ui/recipe-edit.js`, `src/ui/book.js` | plus de `window.open` ; `sandbox` ; `safeDisplayType` ; bouton « Télécharger le fichier » | 8 |
| `sw-rules.js`, `sw.js` | `shouldCache(url, origin, shell)` ; cache sans paramètres | 9 |
| `src/sync/clock.js`, `src/sync/outbox.js`, `src/model/repo.js`, 7 vues de `src/ui` | capture dans `mutate`, `keyOf`, `syncNow`, `repo.remove/clearDevice`, refactor des 9 écritures | 10 |
| `src/vendor/supabase-2.117.3.umd.js`, `tools/verifier-vendor.mjs`, `docs/architecture.md` | dépendance embarquée vérifiée deux fois | 11 |
| `src/sync/config.js`, `src/sync/auth.js` | client, connexion, retour, garde de compte, « Changer de compte » | 12 |
| `src/ui/settings.js`, `src/i18n/en.js`, `src/app.js` | section « Synchronisation » (ensemble L2), « Effacer les données de cet appareil », `logError` | 13 |
| `sw.js` (`SHELL`, `VERSION`), `docs/architecture.md`, `CLAUDE.md`, `README.md` | clôture du lot | 14 |
| `tests/sync.js`, `tests/tests.js` | tous les tests navigateur du lot | 1 → 13 |

---

## Tâche 1 — Constantes de synchronisation et `tables.js`

**Files:**
- Modify: `src/model/schema.js` (ajouts après `SECRET_SETTING_KEYS`, ligne 44)
- Create: `src/sync/tables.js`
- Create: `tests/sync.js` (début de la suite), Modify: `tests/tests.js` (import + appel)

**Interfaces:**
- Produces: `SYNC_INTERNAL_STORES = ['outbox','sync_state','sync_conflicts']`, `SYNC_STORES` (25 noms, exclut `settings` et les internes), `TABLES` (objet `{ [store]: { key, generated: [{ name, sql, type }], required: [field] } }`), `keyOf(store, record)`.
- Consumed by: tâches 3 (générateur), 6-10 (capture), 12-13.

- [ ] **Étape 1 : le test rouge** — créer `tests/sync.js` :

```js
// Tests du lot « compte et stockage distant » : constantes, tables, types, base, capture, connexion.
// Bases IndexedDB temporaires cuisine-os-sync-test-* seulement ; aucun réseau.
import { STORES, SYNC_STORES, SYNC_INTERNAL_STORES } from '../src/model/schema.js';
import { TABLES, keyOf } from '../src/sync/tables.js';

export async function runSyncTests({ eq, ok }) {
  // --- Constantes et tables (spec § 3.1, § 7.1)
  eq(SYNC_INTERNAL_STORES, ['outbox', 'sync_state', 'sync_conflicts'], 'trois magasins internes');
  eq(SYNC_STORES.length, 25, '25 magasins synchronisables');
  ok(!SYNC_STORES.includes('settings') && SYNC_INTERNAL_STORES.every((s) => !SYNC_STORES.includes(s)), 'settings et internes exclus');
  eq(Object.keys(TABLES).sort(), [...SYNC_STORES].sort(), 'une table par magasin synchronisable');
  for (const store of SYNC_STORES) {
    const table = TABLES[store];
    eq(table.key, STORES[store].keyPath, `${store} : clé = keyPath`);
    const indexNames = (STORES[store].indexes || []).map(([name]) => name).sort();
    const generated = table.generated.map((g) => g.name).filter((n) => !['size', 'mime'].includes(n) || store !== 'files').sort();
    eq(generated, indexNames, `${store} : colonnes générées = index de STORES`);
  }
  eq(TABLES.files.generated.map((g) => `${g.name}:${g.type}`).sort(), ['mime:text', 'size:bigint'], 'files : size bigint et mime text en plus');
  ok(TABLES.recipe_versions.required.includes('recipe_id') && TABLES.source_pages.required.includes('document_id'), 'champs de relation obligatoires déclarés');
  eq(keyOf('files', { sha256: 'abc' }), 'abc', 'keyOf files');
  eq(keyOf('rediscovery_prefs', { edition_id: 'ed1' }), 'ed1', 'keyOf rediscovery_prefs');
  eq(keyOf('settings', { key: 'ui_locale' }), 'ui_locale', 'keyOf settings');
  eq(keyOf('recipes', { id: 'rc1' }), 'rc1', 'keyOf recipes');
}
```

Dans `tests/tests.js`, après l'import de `runBackupTests` : `import { runSyncTests } from './sync.js';` et, juste après le bloc `try { await runBackupTests(...) }` : `try { await runSyncTests({ eq, ok }); } catch (error) { ok(false, \`Suite synchronisation interrompue : ${error?.message || String(error)}\`); }`.

- [ ] **Étape 2 : le voir rouge** — Playwright sur `http://localhost:8081/tests/` : la page affiche « Suite synchronisation interrompue » (module absent). Noter le compte.

- [ ] **Étape 3 : `schema.js`** — ajouter après `SECRET_SETTING_KEYS` :

```js
// Magasins internes du lot « compte et stockage distant » (spec § 5.1) : jamais archivés, jamais synchronisés.
export const SYNC_INTERNAL_STORES = ['outbox', 'sync_state', 'sync_conflicts'];
// Magasins miroirs d'une table serveur (spec § 3.1) : tout sauf les réglages et les internes.
export const SYNC_STORES = Object.keys(STORES).filter((s) => s !== 'settings' && !SYNC_INTERNAL_STORES.includes(s));
```

- [ ] **Étape 4 : `src/sync/tables.js`** :

```js
// Déclaration du schéma serveur, dérivée du schéma local (spec § 3.1). Source de vérité du générateur de migrations.
// generated : une colonne par index de STORES (même nom, texte), plus les colonnes listées ici ; required : champs de
// relation que l'app pose toujours (vérifié dans le code : un champ qui peut être nul n'est PAS listé).
import { STORES, SYNC_STORES } from '../model/schema.js';

const EXTRA_GENERATED = {
  files: [{ name: 'size', sql: "((data->>'size')::bigint)", type: 'bigint' }, { name: 'mime', sql: "(data->>'mime')", type: 'text' }],
};
const REQUIRED = {
  book_editions: ['book_id'],
  source_pages: ['document_id'],
  recipe_versions: ['recipe_id'],
  recipe_translations: ['recipe_version_id'],
  dish_recipe_links: ['dish_id', 'recipe_id'],
  cook_history: ['recipe_id', 'recipe_version_id'],
  cook_sessions: ['recipe_id'],
  meal_feedback: ['meal_id'],
  timer_launches: ['cook_session_id'],
  library_activity: ['edition_id'],
  substitutions: ['recipe_version_id'],
};

export const TABLES = Object.fromEntries(SYNC_STORES.map((store) => [store, {
  key: STORES[store].keyPath,
  generated: [
    ...(STORES[store].indexes || []).map(([name, keyPath]) => ({ name, sql: `(data->>'${keyPath}')`, type: 'text' })),
    ...(EXTRA_GENERATED[store] || []),
  ],
  required: REQUIRED[store] || [],
}]));

export const keyOf = (store, record) => record[STORES[store].keyPath];
```

Avant de garder chaque entrée de `REQUIRED`, **vérifier dans `src/ui` et `src/domain`** que le champ est toujours posé à la création (ex. `grep -n "newId('rv'" src` → `recipe_id` toujours présent). Retirer toute entrée dont un chemin de création laisse le champ nul (ex. `source_documents.edition_id` est nullable : pas dans la liste). Consigner la liste finale dans le commit.

- [ ] **Étape 5 : le voir vert** — Playwright : `✅ … tests réussis`, aucun ✗, console sans erreur.

- [ ] **Étape 6 : commit** — `git checkout -b compte-et-stockage-distant` (depuis `main`), puis `git add src/model/schema.js src/sync/tables.js tests/sync.js tests/tests.js docs/ CLAUDE.md` (les trois documents déjà présents et la note de Claude A dans `CLAUDE.md` entrent dans ce premier commit) et :
  `git commit -m "Synchronisation : constantes SYNC_STORES, declaration des tables serveur, spec et brief du lot"` + trailer.

---

## Tâche 2 — `mime.js` : liste blanche et résolution locale

**Files:** Create `src/sync/mime.js` ; Modify `tests/sync.js`.

**Interfaces:**
- Produces: `ALLOWED_MIME` (6 types), `EXT_TO_MIME`, `resolveMime(type, filename) → { mime, syncable }`, `isAllowed(mime)`, `safeDisplayType(mime) → mime | null`, `extensionFor(mime)`.
- Consumed by: tâche 3 (bucket), 8 (affichage), 10 (`putFile`).

- [ ] **Étape 1 : tests rouges** (ajouter à `runSyncTests`) :

```js
  // --- Types de fichiers (spec § 3.6, § 5.4)
  const { ALLOWED_MIME, resolveMime, isAllowed, safeDisplayType, extensionFor } = await import('../src/sync/mime.js');
  eq(ALLOWED_MIME, ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip'], 'liste blanche fermée');
  eq(resolveMime('image/jpeg', 'x.jpg'), { mime: 'image/jpeg', syncable: true }, 'type connu conservé');
  eq(resolveMime('', 'IMG_0012.HEIC'), { mime: 'image/heic', syncable: true }, 'type vide résolu par l’extension, insensible à la casse');
  eq(resolveMime('application/octet-stream', 'scan.pdf'), { mime: 'application/pdf', syncable: true }, 'octet-stream résolu par l’extension');
  eq(resolveMime('', 'notes.txt'), { mime: 'application/octet-stream', syncable: false }, 'inconnu : conservé localement, non synchronisable');
  eq(resolveMime('text/html', 'page.html'), { mime: 'application/octet-stream', syncable: false }, 'HTML : jamais un type affichable');
  ok(isAllowed('image/png') && !isAllowed('image/svg+xml') && !isAllowed('text/html'), 'isAllowed');
  eq(safeDisplayType('image/svg+xml'), null, 'SVG jamais affiché comme image');
  eq(safeDisplayType('application/pdf'), 'application/pdf', 'PDF affichable');
  eq(extensionFor('image/heic'), 'heic', 'extension de la liste');
```

- [ ] **Étape 2 : rouge** (Playwright).

- [ ] **Étape 3 : `src/sync/mime.js`** :

```js
// Liste blanche des types de fichiers synchronisés (spec § 3.6) et résolution locale sans refus (spec § 5.4).
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/epub+zip'];
export const EXT_TO_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf', epub: 'application/epub+zip' };
const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf', 'application/epub+zip': 'epub' };
export const UNKNOWN = 'application/octet-stream';

export const isAllowed = (mime) => ALLOWED_MIME.includes(mime);

// Le type déclaré par le navigateur gagne s'il est dans la liste ; sinon l'extension du nom d'origine, une seule fois.
export function resolveMime(type, filename = '') {
  const declared = String(type || '').toLowerCase().split(';')[0].trim();
  if (isAllowed(declared)) return { mime: declared, syncable: true };
  const ext = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const byExt = ext ? EXT_TO_MIME[ext] : null;
  if (byExt) return { mime: byExt, syncable: true };
  return { mime: UNKNOWN, syncable: false };
}

// À l'affichage : jamais un type hors liste (un blob text/html ou image/svg+xml exécuterait du script sur notre origine).
export const safeDisplayType = (mime) => (isAllowed(mime) ? mime : null);
export const extensionFor = (mime) => MIME_TO_EXT[mime] || 'bin';
```

- [ ] **Étape 4 : vert** (Playwright). **Étape 5 : commit** `git add src/sync/mime.js tests/sync.js` — `"Synchronisation : liste blanche des types de fichiers et resolution locale"`.

---

## Tâche 3 — Générateur de migrations et migrations `0001`, `0002`

**Files:** Create `tools/generer-migrations.mjs`, `tools/generer-migrations.test.mjs`, `supabase/migrations/0001_tables_et_regles.sql`, `supabase/migrations/0002_stockage.sql`.

**Interfaces:**
- Consumes: `TABLES`, `SYNC_STORES` (tâche 1), `ALLOWED_MIME` (tâche 2).
- Produces: `node tools/generer-migrations.mjs` (écrit les deux fichiers), `node tools/generer-migrations.mjs --check` (code 1 si les fichiers commités diffèrent du généré), `export function renderMigrations() → { tables: string, storage: string }`.

- [ ] **Étape 1 : tests rouges** — `tools/generer-migrations.test.mjs` (Node) :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMigrations } from './generer-migrations.mjs';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const { tables: sql, storage } = renderMigrations();

test('25 tables, cle composee, proprietaire non nul, aucun owner_id is null', () => {
  assert.equal((sql.match(/create table public\./g) || []).length, 25);
  for (const t of SYNC_STORES) assert.match(sql, new RegExp(`create table public\\.${t} \\(`));
  assert.equal((sql.match(/primary key \(owner_id, id\)/g) || []).length, 25);
  assert.equal((sql.match(/owner_id\s+uuid not null default auth\.uid\(\)/g) || []).length, 25);
  assert.doesNotMatch(sql, /owner_id is null/);
});
test('chaque regle porte is_allowed et owner_id ; delete gardee par app.purge', () => {
  const policies = sql.match(/create policy[^;]+;/g) || [];
  assert.equal(policies.length, 25 * 4);
  for (const p of policies) assert.match(p, /public\.is_allowed\(\) and owner_id = auth\.uid\(\)/);
  const deletes = policies.filter((p) => / for delete /.test(p));
  assert.equal(deletes.length, 25);
  for (const p of deletes) assert.match(p, /current_setting\('app\.purge', true\) = 'on'/);
});
test('sync_push : liste litterale, format %I, bornes, motifs, idempotence sans ecriture', () => {
  assert.match(sql, /stores constant text\[\] := array\['books'/);
  assert.doesNotMatch(sql, /'select updated_at, data, deleted_at from public\.' \|\|/);
  assert.match(sql, /format\('select updated_at, data, deleted_at from public\.%I/);
  for (const needle of ['jsonb_array_length(rows) > 500', 'pg_column_size(rows) > 1048576', "interval '5 minutes'", "'updated_at'", "'forme'", "'cle'", "'taille'", "'conflit'", "'server_time'"]) assert.ok(sql.includes(needle), needle);
  assert.match(sql, /security invoker/);
  assert.doesNotMatch(sql.slice(sql.indexOf('function public.sync_push')), /security definer/);
});
test('files : pas de blob en base ; colonnes size et mime', () => {
  assert.match(sql, /check \(not \(data \? 'blob'\)\)/);
  assert.match(sql, /size\s+bigint generated always as \(\(data->>'size'\)::bigint\) stored/);
});
test('server_seq : sequence globale, declencheur conditionnel, maintenance', () => {
  assert.match(sql, /create sequence if not exists public\.sync_seq/);
  assert.match(sql, /current_setting\('app\.maintenance', true\) = 'on'/);
  assert.equal((sql.match(/execute function public\.touch_server_seq\(\)/g) || []).length, 25);
});
test('barrieres : hook B1, declencheur secondaire, grants, revocations', () => {
  assert.match(sql, /function public\.before_user_created\(event jsonb\)/);
  assert.match(sql, /grant execute on function public\.before_user_created\(jsonb\) to supabase_auth_admin/);
  assert.match(sql, /'http_code', 403/);
  assert.match(sql, /before insert on auth\.users/);
  assert.match(sql, /revoke all on all tables in schema public from anon/);
  for (const f of ['sync_push(jsonb)', 'sync_purge(text, text)', 'sync_purge_all()']) assert.match(sql, new RegExp(`revoke execute on function public\\.${f.replace(/[()]/g, '\\$&')} from public, anon`));
  assert.match(sql, /email = lower\(email\) and email like '%@%'/);
});
test('purge : set_config app.purge local, compte renvoye, tombales 90 jours sous maintenance', () => {
  assert.match(sql, /set_config\('app\.purge', 'on', true\)/);
  assert.match(sql, /get diagnostics n = row_count/);
  assert.match(sql, /interval '90 days'/);
  assert.match(sql, /set_config\('app\.maintenance', 'on', true\)/);
});
test('stockage : bucket prive, limites, liste blanche, regles par dossier', () => {
  assert.match(storage, /'pages', 'pages', false, 52428800/);
  for (const m of ALLOWED_MIME) assert.ok(storage.includes(`'${m}'`), m);
  assert.equal((storage.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g) || []).length, 4);
  assert.match(storage, /create or replace view private\.storage_usage/);
});
test('aucune donnee personnelle, determinisme', () => {
  assert.doesNotMatch(sql + storage, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const again = renderMigrations();
  assert.equal(again.tables, sql); assert.equal(again.storage, storage);
});
```

- [ ] **Étape 2 : rouge** — `node --test tools/*.test.mjs` → échecs « module introuvable ».

- [ ] **Étape 3 : écrire `tools/generer-migrations.mjs`** — structure :

```js
#!/usr/bin/env node
// Génère les migrations SQL du lot « compte et stockage distant » depuis src/sync/tables.js (spec § 3.1-3.7).
// Usage : node tools/generer-migrations.mjs            → écrit supabase/migrations/0001_*.sql et 0002_*.sql
//         node tools/generer-migrations.mjs --check    → code 1 si les fichiers commités diffèrent du généré
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TABLES } from '../src/sync/tables.js';
import { SYNC_STORES } from '../src/model/schema.js';
import { ALLOWED_MIME } from '../src/sync/mime.js';

const ENTETE = (nom) => `-- ${nom} — généré par tools/generer-migrations.mjs le ${'(date retirée pour le déterminisme)'} ; ne pas éditer à la main.\n-- Spec : docs/spec-compte-et-stockage-distant.md (v3). Aucune valeur personnelle ici : les adresses vont dans private.allowed_users par l'éditeur SQL.\n\n`;
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const list = (arr) => arr.map(q).join(', ');

function table(store) {
  const t = TABLES[store];
  const gen = t.generated.map((g) => `,\n  ${g.name} ${g.type} generated always as ${g.sql} stored`).join('');
  const extra = store === 'files' ? `,\n  check (not (data ? 'blob'))` : '';
  const idx = t.generated.filter((g) => g.name !== 'size' && g.name !== 'mime').map((g) => `create index ${store}_${g.name} on public.${store} (owner_id, ${g.name});`).join('\n');
  const cond = `public.is_allowed() and owner_id = auth.uid()`;
  return `create table public.${store} (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.sync_seq'),
  deleted_at timestamptz,
  primary key (owner_id, id)${gen}${extra}
);
create index ${store}_recv on public.${store} (owner_id, server_seq);
${idx}
alter table public.${store} enable row level security;
create policy ${store}_select on public.${store} for select to authenticated using (${cond});
create policy ${store}_insert on public.${store} for insert to authenticated with check (${cond});
create policy ${store}_update on public.${store} for update to authenticated using (${cond}) with check (${cond});
create policy ${store}_delete on public.${store} for delete to authenticated using (${cond} and current_setting('app.purge', true) = 'on');
create trigger ${store}_seq before insert or update on public.${store} for each row execute function public.touch_server_seq();
`;
}

export function renderMigrations() {
  const stores = SYNC_STORES;
  const keys = JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s].key])));
  const required = JSON.stringify(Object.fromEntries(stores.map((s) => [s, TABLES[s].required])));
  const tables = ENTETE('0001_tables_et_regles.sql') + `create extension if not exists pg_cron;
create schema if not exists private;
create sequence if not exists public.sync_seq;

-- Liste des personnes autorisées (spec § 3.2) : écrite seulement par l'éditeur SQL, en minuscules.
create table if not exists private.allowed_users (
  email text primary key check (email = lower(email) and email like '%@%'),
  added_at timestamptz not null default now()
);
alter table private.allowed_users enable row level security;
revoke all on all tables in schema private from anon, authenticated;

create or replace function public.is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.allowed_users a where a.email = lower(coalesce(auth.jwt()->>'email', '')));
$$;
revoke all on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

-- B1 : crochet « Before User Created » (branché par Neegan dans Authentication → Hooks ; preuve 0001_hook.md).
create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e text := lower(coalesce(event->'user'->>'email', ''));
begin
  if e = '' or not exists (select 1 from private.allowed_users a where a.email = e) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'adresse non autorisée'));
  end if;
  return '{}'::jsonb;
end $$;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

-- B1 secondaire : déclencheur sur auth.users.
create or replace function public.enforce_allowed_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (select 1 from private.allowed_users a where a.email = lower(new.email)) then
    raise exception 'adresse non autorisée';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_allowed_user() from public, anon, authenticated;
grant execute on function public.enforce_allowed_user() to supabase_auth_admin;
drop trigger if exists enforce_allowed_user on auth.users;
create trigger enforce_allowed_user before insert on auth.users for each row execute function public.enforce_allowed_user();

-- Ordre de réception : une séquence globale, posée seulement quand le contenu change et hors maintenance (spec § 3.1).
create or replace function public.touch_server_seq() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.server_seq := nextval('public.sync_seq'); return new; end if;
  if current_setting('app.maintenance', true) = 'on' then return new; end if;
  if new.data is distinct from old.data or new.updated_at is distinct from old.updated_at or new.deleted_at is distinct from old.deleted_at then
    new.server_seq := nextval('public.sync_seq');
  end if;
  return new;
end $$;

${stores.map(table).join('\n')}
revoke all on all tables in schema public from anon;

-- Envoi (spec § 3.4) : sous RLS, par élément, idempotent, jamais d'exception pour une ligne.
create or replace function public.sync_push(rows jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  stores constant text[] := array[${list(stores)}];
  keys constant jsonb := ${q(keys)}::jsonb;
  required constant jsonb := ${q(required)}::jsonb;
  r jsonb; s text; i text; d jsonb; u timestamptz; del boolean; adj boolean; bad text; f text;
  cur_updated timestamptz; cur_data jsonb; cur_deleted timestamptz;
  accepted jsonb := '[]'; adjusted jsonb := '[]'; rejected jsonb := '[]';
  now_ts timestamptz := now();
begin
  if rows is null or jsonb_typeof(rows) <> 'array' then raise exception 'rows : tableau attendu'; end if;
  if jsonb_array_length(rows) > 500 then raise exception 'rows : 500 éléments au plus'; end if;
  if pg_column_size(rows) > 1048576 then raise exception 'rows : 1 Mo au plus'; end if;
  for r in select * from jsonb_array_elements(rows) loop
    s := r->>'store'; i := r->>'id'; d := r->'data'; del := coalesce((r->>'deleted')::boolean, false); adj := false; bad := null;
    if s is null or not (s = any(stores)) then raise exception 'store inconnu'; end if;
    begin u := (r->>'updated_at')::timestamptz; exception when others then u := null; end;
    if u is null then bad := 'updated_at'; end if;
    if bad is null and u > now_ts + interval '5 minutes' then u := now_ts; adj := true; end if;
    if bad is null then
      if d is null or jsonb_typeof(d) = 'null' then
        d := null; if not del then bad := 'forme'; end if;
      elsif jsonb_typeof(d) <> 'object' then bad := 'forme';
      elsif (d->>(keys->>s)) is distinct from i then bad := 'cle';
      elsif pg_column_size(d) > 1048576 then bad := 'taille';
      else
        for f in select jsonb_array_elements_text(coalesce(required->s, '[]'::jsonb)) loop
          if d->>f is null then bad := 'forme'; end if;
        end loop;
      end if;
    end if;
    if bad is not null then
      rejected := rejected || jsonb_build_object('store', s, 'id', i, 'reason', bad); continue;
    end if;
    cur_updated := null; cur_data := null; cur_deleted := null;
    execute format('select updated_at, data, deleted_at from public.%I where owner_id = auth.uid() and id = $1', s) into cur_updated, cur_data, cur_deleted using i;
    if cur_updated is null then
      execute format('insert into public.%I (owner_id, id, data, updated_at, deleted_at) values (auth.uid(), $1, $2, $3, $4)', s)
        using i, coalesce(d, '{}'::jsonb), u, case when del then now_ts end;
    elsif u > cur_updated then
      execute format('update public.%I set data = $2, updated_at = $3, deleted_at = $4 where owner_id = auth.uid() and id = $1', s)
        using i, coalesce(d, cur_data), u, case when del then coalesce(cur_deleted, now_ts) end;
    elsif u = cur_updated and ((del and cur_deleted is not null) or (not del and cur_deleted is null and d = cur_data)) then
      null; -- réessai idempotent : rien n'est écrit, server_seq inchangé
    else
      rejected := rejected || jsonb_build_object('store', s, 'id', i, 'reason', 'conflit',
        'server', jsonb_build_object('data', cur_data, 'updated_at', cur_updated, 'deleted_at', cur_deleted));
      continue;
    end if;
    if adj then adjusted := adjusted || jsonb_build_object('store', s, 'id', i, 'updated_at', u);
    else accepted := accepted || jsonb_build_object('store', s, 'id', i); end if;
  end loop;
  return jsonb_build_object('server_time', now_ts, 'accepted', accepted, 'adjusted', adjusted, 'rejected', rejected);
end $$;
revoke execute on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- Suppression réelle (spec § 3.5) : la règle delete n'est franchissable que sous app.purge, posé localement ici.
create or replace function public.sync_purge(store text, id text) returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer; stores constant text[] := array[${list(stores)}];
begin
  if not (store = any(stores)) then raise exception 'store inconnu'; end if;
  perform set_config('app.purge', 'on', true);
  execute format('delete from public.%I where owner_id = auth.uid() and id = $1', store) using id;
  get diagnostics n = row_count;
  if store = 'files' then
    delete from storage.objects where bucket_id = 'pages' and name = auth.uid()::text || '/' || id;
  end if;
  return n;
end $$;
revoke execute on function public.sync_purge(text, text) from public, anon;
grant execute on function public.sync_purge(text, text) to authenticated;

create or replace function public.sync_purge_all() returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer := 0; k integer; s text; stores constant text[] := array[${list(stores)}];
begin
  perform set_config('app.purge', 'on', true);
  foreach s in array stores loop
    execute format('delete from public.%I where owner_id = auth.uid()', s);
    get diagnostics k = row_count; n := n + k;
  end loop;
  delete from storage.objects where bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text;
  return n;
end $$;
revoke execute on function public.sync_purge_all() from public, anon;
grant execute on function public.sync_purge_all() to authenticated;

-- Tombales : data vidé après 90 jours, sous maintenance (ne réémet rien) — spec § 3.1.
create or replace function public.purge_tombstones() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; k integer; s text; stores constant text[] := array[${list(stores)}];
begin
  perform set_config('app.maintenance', 'on', true);
  foreach s in array stores loop
    execute format('update public.%I set data = ''{}''::jsonb where deleted_at < now() - interval ''90 days'' and data <> ''{}''::jsonb', s);
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $$;
revoke execute on function public.purge_tombstones() from public, anon, authenticated;
select cron.schedule('cuisine-os-tombales', '15 4 * * *', 'select public.purge_tombstones()');
`;
  const storage = ENTETE('0002_stockage.sql') + `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pages', 'pages', false, 52428800, array[${list(ALLOWED_MIME)}])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Chaque personne ne voit et n'écrit que son dossier <owner_id>/ ; delete réservé aux fonctions de purge et à la réécriture d'un objet corrompu (spec § 3.6).
create policy pages_select on storage.objects for select to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_insert on storage.objects for insert to authenticated with check (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_update on storage.objects for update to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text) with check (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pages_delete on storage.objects for delete to authenticated using (public.is_allowed() and bucket_id = 'pages' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace view private.storage_usage as
  select (storage.foldername(name))[1] as owner, count(*) as objets, sum((metadata->>'size')::bigint) as octets
  from storage.objects where bucket_id = 'pages' group by 1;
`;
  return { tables, storage };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'supabase', 'migrations');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { tables, storage } = renderMigrations();
  const targets = [['0001_tables_et_regles.sql', tables], ['0002_stockage.sql', storage]];
  if (process.argv.includes('--check')) {
    let differ = false;
    for (const [name, content] of targets) {
      let current = null; try { current = readFileSync(path.join(dir, name), 'utf8'); } catch { /* absent */ }
      if (current !== content) { differ = true; console.error('différent du généré : ' + name); }
    }
    process.exit(differ ? 1 : 0);
  }
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of targets) { writeFileSync(path.join(dir, name), content); console.log('écrit : ' + name); }
}
```

Note : la ligne de la storage update est un seul `create policy` (dans le test, le compte « 4 occurrences de `foldername` » suppose une occurrence par règle : la règle `update` en a deux — **ajuster le test à 5** si c'est le cas, et le dire dans le commit). Retirer aussi la mention « date retirée » de l'en-tête si elle gêne : l'en-tête doit être **déterministe** (pas de date).

- [ ] **Étape 4 : générer** — `node tools/generer-migrations.mjs` puis `node tools/generer-migrations.mjs --check` (code 0) ; `node --test tools/*.test.mjs` → `# fail 0`. Lire les deux fichiers SQL **en entier** une fois : chaque `$$` fermé, chaque `format('%I')`, pas de `'` non doublé dans les chaînes SQL imbriquées (`purge_tombstones`).

- [ ] **Étape 5 : commit** `git add tools/generer-migrations.mjs tools/generer-migrations.test.mjs supabase/migrations/` — `"Synchronisation : generateur de migrations, schema serveur 0001 et stockage 0002"`.

---

## Tâche 4 — Preuves SQL et gabarits de preuve

**Files:** Create `supabase/proofs/0001_tables_et_regles.sql`, `supabase/proofs/0002_stockage.sql`, `supabase/proofs/0001_hook.md`, `supabase/proofs/0001_providers.md`, `supabase/README.md`.

- [ ] **Étape 1 : `supabase/README.md`** — comment Neegan applique : (1) éditeur SQL du projet **`mistu-dev`** d'abord, coller `0001` puis `0002` ; si `create extension pg_cron` échoue : Database → Extensions → activer `pg_cron`, rejouer ; (2) `insert into private.allowed_users (email) values (lower('…')), (lower('…')) on conflict do nothing;` tapé par lui (jamais dans le dépôt) ; (3) coller la preuve `0001` après avoir remplacé les quatre jetons `A_UUID`, `A_EMAIL`, `B_UUID`, `B_EMAIL` ; (4) `0002` ; (5) brancher le crochet (Authentication → Hooks → Before User Created → Postgres function `public.before_user_created`) et consigner `0001_hook.md` ; (6) Providers : Google seul, capture dans `0001_providers.md` ; (7) refaire (1), (2), (4), (5), (6) sur `mistu` quand L1 est revu.

- [ ] **Étape 2 : `supabase/proofs/0001_tables_et_regles.sql`** — un seul script, résultats attendus en commentaires, qui joue **toutes** les lignes SQL du § 7.2 :

```sql
-- Preuve 0001 — à coller dans l'éditeur SQL APRÈS 0001_tables_et_regles.sql et l'insertion des adresses.
-- REMPLACE A_UUID, A_EMAIL, B_UUID, B_EMAIL (deux adresses de private.allowed_users ; des uuid au hasard). Rien ici n'est versionné avec tes valeurs.
-- Chaque bloc imprime une ligne « attendu / obtenu » ; tout doit dire OK.
begin;
insert into auth.users (id, email, instance_id, aud, role) values ('A_UUID', 'A_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into auth.users (id, email, instance_id, aud, role) values ('B_UUID', 'B_EMAIL', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- 1. le déclencheur B1 secondaire refuse une adresse hors liste (attendu : exception « adresse non autorisée »)
savepoint s1;
do $$ begin
  begin
    insert into auth.users (id, email, instance_id, aud, role) values (gen_random_uuid(), 'inconnu@exemple.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    raise notice 'KO : adresse hors liste acceptée';
  exception when others then raise notice 'OK : % ', sqlerrm; end;
end $$;
rollback to savepoint s1;

-- 2. A écrit, A relit ; B ne voit rien ; même id et même sha256 chez les deux
set local role authenticated;
set local request.jwt.claims = '{"sub":"A_UUID","email":"A_EMAIL","role":"authenticated"}';
select 'A push' as etape, public.sync_push('[
 {"store":"books","id":"b_commun","data":{"id":"b_commun","title":"Livre A"},"updated_at":"2026-10-12T10:00:00Z"},
 {"store":"files","id":"0000000000000000000000000000000000000000000000000000000000000001","data":{"sha256":"0000000000000000000000000000000000000000000000000000000000000001","mime":"image/jpeg","size":3},"updated_at":"2026-10-12T10:00:00Z"}
]'::jsonb) as reponse;  -- attendu : accepted 2, rejected 0
select 'A relit' as etape, count(*) = 1 as ok from public.books where id = 'b_commun';
set local request.jwt.claims = '{"sub":"B_UUID","email":"B_EMAIL","role":"authenticated"}';
select 'B ne voit rien' as etape, count(*) = 0 as ok from public.books;
select 'B push meme id' as etape, public.sync_push('[
 {"store":"books","id":"b_commun","data":{"id":"b_commun","title":"Livre B"},"updated_at":"2026-10-12T10:00:00Z"},
 {"store":"files","id":"0000000000000000000000000000000000000000000000000000000000000001","data":{"sha256":"0000000000000000000000000000000000000000000000000000000000000001","mime":"image/jpeg","size":3},"updated_at":"2026-10-12T10:00:00Z"}
]'::jsonb) as reponse;  -- attendu : accepted 2 (clé composée)
select 'B ne peut pas ecrire chez A' as etape, (select count(*) from public.books where owner_id = 'A_UUID') = 1 as inchange;
savepoint s2;
do $$ begin
  begin insert into public.books (owner_id, id, data, updated_at) values ('A_UUID', 'b_pirate', '{"id":"b_pirate"}', now()); raise notice 'KO : insert chez A accepté';
  exception when others then raise notice 'OK : %', sqlerrm; end;
  begin insert into public.books (owner_id, id, data, updated_at) values (null, 'b_nul', '{"id":"b_nul"}', now()); raise notice 'KO : owner_id nul accepté';
  exception when others then raise notice 'OK : %', sqlerrm; end;
end $$;
rollback to savepoint s2;

-- 3. delete direct = 0 ligne ; sync_purge = 1 et objet disparu
delete from public.books where id = 'b_commun';
select 'delete direct' as etape, count(*) = 1 as toujours_la from public.books where id = 'b_commun';
select 'sync_purge' as etape, public.sync_purge('books', 'b_commun') = 1 as ok;
select 'apres purge' as etape, count(*) = 0 as ok from public.books where id = 'b_commun';

-- 4. motifs de rejet et ajustements
select 'store inconnu' as etape; savepoint s3;
do $$ begin begin perform public.sync_push('[{"store":"pirates","id":"x","data":{"id":"x"},"updated_at":"2026-10-12T10:00:00Z"}]'::jsonb); raise notice 'KO'; exception when others then raise notice 'OK : %', sqlerrm; end; end $$;
rollback to savepoint s3;
select 'motifs' as etape, public.sync_push('[
 {"store":"books","id":"m1","data":{"id":"m1"}},
 {"store":"books","id":"m2","data":{"id":"autre"},"updated_at":"2026-10-12T10:00:00Z"},
 {"store":"recipe_versions","id":"m3","data":{"id":"m3"},"updated_at":"2026-10-12T10:00:00Z"},
 {"store":"books","id":"m4","data":{"id":"m4"},"updated_at":"2999-01-01T00:00:00Z"},
 {"store":"books","id":"m5","data":null,"deleted":true,"updated_at":"2026-10-12T10:00:00Z"}
]'::jsonb) as reponse;  -- attendu : m1 rejected updated_at ; m2 rejected cle ; m3 rejected forme ; m4 adjusted ; m5 accepted (tombale '{}')
select 'tombale' as etape, data = '{}'::jsonb and deleted_at is not null as ok from public.books where id = 'm5';

-- 5. idempotence sans écriture, conflit, server_seq
select 'push 1' as etape, public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":1},"updated_at":"2026-10-12T10:00:00Z"}]'::jsonb);
select server_seq as seq_avant from public.books where id = 'i1' \gset
select 'push identique' as etape, public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":1},"updated_at":"2026-10-12T10:00:00Z"}]'::jsonb);  -- attendu : accepted, aucun écrit
select 'server_seq inchange' as etape, server_seq as seq_apres from public.books where id = 'i1';  -- attendu : = seq_avant
select 'plus ancien' as etape, public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":0},"updated_at":"2026-10-12T09:00:00Z"}]'::jsonb);  -- attendu : rejected conflit avec server
select 'plus recent' as etape, public.sync_push('[{"store":"books","id":"i1","data":{"id":"i1","t":2},"updated_at":"2026-10-12T11:00:00Z"}]'::jsonb);  -- attendu : accepted, server_seq a augmenté
select 'maintenance' as etape; select set_config('app.maintenance', 'on', true); update public.books set data = data where id = 'i1';
select 'server_seq inchange sous maintenance' as etape, server_seq from public.books where id = 'i1';

-- 6. files : pas de blob
savepoint s4;
do $$ begin begin insert into public.files (id, data, updated_at) values ('f_blob', '{"sha256":"f_blob","blob":"x"}', now()); raise notice 'KO'; exception when others then raise notice 'OK : %', sqlerrm; end; end $$;
rollback to savepoint s4;

-- 7. privilèges
reset role;
select 'anon sans privilege' as etape, bool_and(not has_table_privilege('anon', 'public.' || t, 'select')) as ok from unnest(array['books','recipes','files']) t;
select 'anon sans execute' as etape, not has_function_privilege('anon', 'public.sync_push(jsonb)', 'execute') and not has_function_privilege('anon', 'public.sync_purge(text, text)', 'execute') and not has_function_privilege('anon', 'public.sync_purge_all()', 'execute') as ok;
select 'allowed_users hors API' as etape, not has_table_privilege('authenticated', 'private.allowed_users', 'select') as ok;

-- 8. adresse retirée → plus rien à la requête suivante
delete from private.allowed_users where email = 'B_EMAIL';
set local role authenticated;
set local request.jwt.claims = '{"sub":"B_UUID","email":"B_EMAIL","role":"authenticated"}';
select 'B retire' as etape, count(*) = 0 as ok from public.books;
reset role;
rollback;  -- la preuve ne laisse rien : tout est annulé
```

Remarque pour l'implémenteur : `\gset` est psql, pas l'éditeur Supabase — **remplacer** par deux `select server_seq from public.books where id='i1'` à comparer à l'œil (noter la valeur attendue en commentaire). Le `rollback` final remet aussi `allowed_users` : la preuve est rejouable.

- [ ] **Étape 3 : `supabase/proofs/0002_stockage.sql`** : `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'pages';` (attendu : `false`, `52428800`, les six types) ; les quatre règles `pages_*` présentes (`select policyname from pg_policies where tablename = 'objects' and policyname like 'pages_%'`) ; la vue existe. Les refus réels (objet hors dossier, type hors liste, > 50 Mo) se jouent **depuis l'app** en L4 : le dire dans le fichier.

- [ ] **Étape 4 : gabarits** — `0001_hook.md` : « Capture de la page Authentication → Hooks montrant *Before User Created* **activé** avec `public.before_user_created` ; date ; projet (`mistu-dev` / `mistu`). [capture à coller par Neegan] ». `0001_providers.md` : « Capture de Authentication → Providers : Google **activé**, Email **désactivé** (ni mot de passe ni magic link), Phone désactivé, Anonymous désactivé ; *Confirm email* activé ; *Linking* automatique désactivé. [capture à coller] ».

- [ ] **Étape 5 : test** — ajouter à `tools/generer-migrations.test.mjs` un test qui lit `supabase/proofs/0001_tables_et_regles.sql` et vérifie la présence de chaque motif (`'cle'`, `'forme'`, `'taille'`, `conflit`, `has_function_privilege`, `set_config('app.maintenance'`, `rollback;` en dernière instruction) et l'absence de `@` suivi d'un domaine réel (regex du test 3, en tolérant `exemple.invalid` et `A_EMAIL`/`B_EMAIL`). `node --test tools/*.test.mjs` vert.

- [ ] **Étape 6 : commit** `git add supabase/ tools/generer-migrations.test.mjs` — `"Synchronisation : preuves SQL et gabarits de preuve pour L1"`.

---

## Tâche 5 — Porte de L1 : revue adverse, puis application sur `mistu-dev`

**Ce n'est pas une tâche d'implémenteur** : le contrôleur (Claude Code) dispatche un **réviseur adverse** (lecture seule) sur `supabase/migrations/*.sql`, `supabase/proofs/*`, `src/sync/tables.js`, `tools/generer-migrations.mjs` avec la spec § 3 et § 7.2 comme rubrique : règles manquantes, `security definer` interdits, injections, `search_path`, motifs, idempotence, privilèges. Corrections en TDD (tests Node) puis re-revue ciblée.

Puis **Neegan** (ou le contrôleur avec une URL de connexion fournie par lui **hors conversation**, dans une variable d'environnement) applique `0001` + `0002` sur **`mistu-dev`** et colle la sortie des preuves dans `supabase/proofs/RESULTATS-mistu-dev.md` (sans ses adresses). Toute ligne « KO » renvoie à la tâche 3. L1 n'est fini que quand les preuves sont OK et consignées.

---

## Tâche 6 — `db.js` : `autoIncrement`, `mutate`, `onMutate`, `MUTATING_METHODS`

**Files:** Modify `src/core/db.js` ; Modify `tests/sync.js`.

**Interfaces:**
- Produces: `Database#mutate({ puts = {}, deletes = {}, clearStores = [], origin = 'local', payloads = {} })` (une transaction ; `puts`/`deletes` = `{ store: rows[] | keys[] }`) ; `Database#onMutate` (fonction `(op) => extraPuts | null`, où `extraPuts = { store: rows[] }` est écrit **dans la même transaction**) ; `export const MUTATING_METHODS = ['put', 'putMany', 'putBatch', 'delete', 'deleteMany', 'clear', 'clearAll', 'mutate']` ; définition de magasin acceptant `autoIncrement: true`.
- Consumed by: 7, 10.

- [ ] **Étape 1 : tests rouges** (ajouter à `runSyncTests` ; reprendre la fonction `withDatabase` de `tests/backup.js` — l'importer n'est pas possible, elle n'est pas exportée : **l'exporter** depuis `tests/backup.js` (`export async function withDatabase`) et l'importer ici) :

```js
  // --- db.mutate : une transaction, crochet de capture, autoIncrement (spec § 5.1, § 5.2)
  const { Database, MUTATING_METHODS } = await import('../src/core/db.js');
  const { withDatabase } = await import('./backup.js');
  const TEST_STORES = { a: { keyPath: 'id', indexes: [] }, b: { keyPath: 'id', indexes: [] }, journal: { keyPath: 'seq', autoIncrement: true, indexes: [] } };
  eq(MUTATING_METHODS.sort(), ['clear', 'clearAll', 'delete', 'deleteMany', 'mutate', 'put', 'putBatch', 'putMany'], 'liste des méthodes mutantes exportée');
  await withDatabase(async (db) => {
    await db.mutate({ puts: { a: [{ id: 'a1' }], journal: [{ note: 'x' }, { note: 'y' }] } });
    const rows = await db.getAll('journal');
    eq(rows.map((r) => r.seq), [1, 2], 'autoIncrement : clés 1, 2');
    db.onMutate = ({ puts, deletes, origin }) => origin === 'local' ? { journal: [{ note: 'capture:' + Object.keys(puts).join(',') + '|' + Object.keys(deletes).join(',') }] } : null;
    await db.mutate({ puts: { b: [{ id: 'b1' }] } });
    eq((await db.getAll('journal')).at(-1).note, 'capture:b|', 'le crochet écrit dans la même transaction');
    await db.mutate({ puts: { a: [{ id: 'a2' }] }, origin: 'remote' });
    eq((await db.getAll('journal')).length, 3, 'origin remote : aucune capture');
    let threw = false;
    try { await db.mutate({ puts: { a: [{ pas_de_cle: true }] }, deletes: { b: ['b1'] } }); } catch { threw = true; }
    ok(threw, 'une écriture sans clé lève');
    eq((await db.get('b', 'b1'))?.id, 'b1', 'et la suppression du même lot est annulée');
    eq((await db.getAll('journal')).length, 3, 'et aucune capture n’est restée');
    await db.mutate({ deletes: { b: ['b1'] } });
    eq(await db.get('b', 'b1'), undefined, 'suppression par mutate');
    eq((await db.getAll('journal')).at(-1).note, 'capture:|b', 'la suppression est capturée avec son magasin');
  }, TEST_STORES);
```

- [ ] **Étape 2 : rouge.**

- [ ] **Étape 3 : `db.js`** — dans `open()`, remplacer la création : `store = db.createObjectStore(name, { keyPath: def.keyPath || 'id', autoIncrement: !!def.autoIncrement })`. Ajouter `this.onMutate = null;` au constructeur. Ajouter :

```js
  // Porte unique d'écriture (spec § 5.1) : puts, deletes et vidages dans UNE transaction ; le crochet onMutate peut
  // ajouter des lignes (capture d'outbox) écrites dans la même transaction. origin : 'local' | 'remote' | 'device'.
  async mutate({ puts = {}, deletes = {}, clearStores = [], origin = 'local', payloads = {} } = {}) {
    for (const [name, rows] of Object.entries(puts)) if (!Array.isArray(rows)) throw new TypeError('Les données de ' + name + ' doivent être un tableau');
    for (const [name, keys] of Object.entries(deletes)) if (!Array.isArray(keys)) throw new TypeError('Les clés de ' + name + ' doivent être un tableau');
    const extra = this.onMutate ? (this.onMutate({ puts, deletes, clearStores, origin, payloads }) || {}) : {};
    const allPuts = { ...puts };
    for (const [name, rows] of Object.entries(extra)) allPuts[name] = [...(allPuts[name] || []), ...rows];
    const toClear = knownStoreNames(this.stores, clearStores);
    const names = knownStoreNames(this.stores, [...toClear, ...Object.keys(allPuts), ...Object.keys(deletes)]);
    if (!names.length) return;
    const tx = await this.tx(names, 'readwrite');
    await runTransaction(tx, () => {
      for (const name of toClear) tx.objectStore(name).clear();
      for (const [name, rows] of Object.entries(allPuts)) { const os = tx.objectStore(name); for (const row of rows) os.put(row); }
      for (const [name, keys] of Object.entries(deletes)) { const os = tx.objectStore(name); for (const key of keys) os.delete(key); }
    });
  }
```

puis réécrire `putBatch(batch, { clearStores })` → `return this.mutate({ puts: batch, clearStores })` (garder ses contrôles de type en tête), `deleteMany(store, keys)` → `return this.mutate({ deletes: { [store]: keys } })`, `clear`/`clearAll` → `mutate({ clearStores: [...] , origin: 'device' })` ? **Non** : `clearAll` garde `origin: 'local'` par défaut ; c'est `repo.clearDevice` (tâche 10) qui passe `origin: 'device'`. Exporter en fin de fichier : `export const MUTATING_METHODS = ['put', 'putMany', 'putBatch', 'delete', 'deleteMany', 'clear', 'clearAll', 'mutate'];`.

- [ ] **Étape 4 : vert** — toute la suite (y compris `tests/backup.js`, qui doit rester verte). **Étape 5 : commit** — `"db : porte unique mutate, crochet de capture, autoIncrement"`.

---

## Tâche 7 — Schéma local v2, archive tolérante, magasins internes protégés

**Files:** Modify `src/model/schema.js`, `src/domain/backup.js` ; Modify `tests/sync.js`.

**Interfaces:**
- Produces: `DB_VERSION = 2` ; `STORES.outbox/sync_state/sync_conflicts` ; `ARCHIVE_DATA_STORES` filtré ; `createArchive` ignore les `files` sans blob et renvoie `missingFiles` ; `verifyRestored` idem ; `applyArchive` en remplacement efface `Object.keys(STORES)` moins `SYNC_INTERNAL_STORES`.

- [ ] **Étape 1 : tests rouges** :

```js
  // --- Schéma v2 et archive (spec § 5.1, I3)
  const schema = await import('../src/model/schema.js');
  const { createArchive, inspectArchive, applyArchive, verifyRestored } = await import('../src/domain/backup.js');
  eq(schema.DB_VERSION, 2, 'DB_VERSION 2');
  eq(schema.STORES.outbox, { keyPath: 'seq', autoIncrement: true, indexes: [['store_id', ['store', 'id']]] }, 'outbox autoIncrement');
  ok(schema.STORES.sync_state.keyPath === 'key' && schema.STORES.sync_conflicts.keyPath === 'id', 'sync_state et sync_conflicts');
  ok(schema.SYNC_INTERNAL_STORES.every((s) => !schema.ARCHIVE_DATA_STORES.includes(s)), 'internes hors archive');
  // Archive v1 d'avant le lot : produite par une base v1 (sans magasins internes), restaurée dans une base v2.
  const V1_STORES = Object.fromEntries(Object.entries(schema.STORES).filter(([n]) => !schema.SYNC_INTERNAL_STORES.includes(n)));
  const archiveV1 = await withDatabase(async (db) => {
    await db.putBatch({ books: [{ id: 'b1', title: 'V1' }], unit_definitions: [{ id: 'g' }], unit_conventions: [{ id: 'uc' }], ingredients: [{ id: 'ing' }] });
    return (await createArchive(db)).blob.arrayBuffer();
  }, V1_STORES);
  await withDatabase(async (db) => {
    const insp = await inspectArchive(await archiveV1);
    ok(insp.ok, 'archive v1 acceptée par la v2 : ' + insp.errors.join(' · '));
    await db.mutate({ puts: { outbox: [{ store: 'books', id: 'b9', op: 'put' }], sync_state: [{ key: 'user_id', value: 'u' }] } });
    await applyArchive(db, insp, { mode: 'replace' });
    eq((await db.getAll('outbox')).length, 1, 'remplacement : outbox intacte');
    eq((await db.getAll('sync_state')).length, 1, 'remplacement : sync_state intact');
    ok((await verifyRestored(db, insp, { mode: 'replace' })).ok, 'vérification verte');
  });
  // Une ligne files reçue sans octets n'empêche ni l'archive ni la vérification (spec § 5.4).
  await withDatabase(async (db) => {
    await db.putBatch({ files: [{ sha256: 'a'.repeat(64), mime: 'image/jpeg', size: 3, remote: true, updated_at: '2026-10-12T10:00:00Z' }], unit_definitions: [{ id: 'g' }], unit_conventions: [{ id: 'uc' }], ingredients: [{ id: 'ing' }] });
    const archive = await createArchive(db);
    eq(archive.missingFiles, 1, 'archive : une page non téléchargée comptée');
    eq(archive.manifest.files.length, 0, 'et absente de l’archive');
  });
```

- [ ] **Étape 2 : rouge.**

- [ ] **Étape 3 : `schema.js`** — `DB_VERSION = 2` ; dans `STORES`, après `settings` :
```js
  // Magasins internes de la synchronisation (spec § 5.1) — jamais archivés.
  outbox:              { keyPath: 'seq', autoIncrement: true, indexes: [['store_id', ['store', 'id']]] },
  sync_state:          { keyPath: 'key', indexes: [] },
  sync_conflicts:      { keyPath: 'id', indexes: [] },
```
`ARCHIVE_DATA_STORES = Object.keys(STORES).filter((s) => s !== 'files' && s !== 'settings' && !SYNC_INTERNAL_STORES.includes(s));` (déplacer la déclaration de `SYNC_INTERNAL_STORES` **avant**). Vérifier que `db.js` crée l'index composé : `store.createIndex('store_id', ['store', 'id'], {})` fonctionne tel quel.

- [ ] **Étape 4 : `backup.js`** — dans `createArchive` : `let missingFiles = 0; for (const file of snapshot.files) { if (!(file.blob instanceof Blob)) { if (file.remote) { missingFiles++; continue; } throw new Error('Fichier source invalide : ' + file.sha256); } … }` et retourner `missingFiles` ; dans `checkRelations`, le jeu d'empreintes passé par `createArchive` reste celui de **toutes** les lignes `files` (une page référence une ligne, pas des octets). Dans `applyArchive` : `clearStores: mode === 'replace' ? Object.keys(STORES).filter((s) => !SYNC_INTERNAL_STORES.includes(s)) : []`. Dans `verifyRestored` : ignorer `snapshot.files` sans blob **et** `remote` dans le décompte `replace`. Importer `SYNC_INTERNAL_STORES`.

- [ ] **Étape 5 : vert** (suite complète ; `tests/backup.js` toujours vert). **Étape 6 : commit** — `"Schema local v2 : magasins internes, archive tolerante aux pages non telechargees"`.

---

## Tâche 8 — Durcissement du client (avant toute session)

**Files:** Modify `index.html`, `tests/index.html` ; Create `tests/tests.css`, `tests/erreur.js`, `src/core/log.js` ; Modify `src/ui/recipe.js`, `src/ui/import.js`, `src/ui/recipe-edit.js`, `src/ui/book.js`, `src/app.js`, `src/core/bus.js` ; Modify `tests/sync.js`.

**Interfaces:**
- Produces: `logError(code, details = {})` (console : code + identifiants seulement) ; `displayUrl(fileRow) → string | null` dans `src/sync/mime.js` (blob reconstruit avec un type de la liste blanche) ; les deux `<meta>`.

- [ ] **Étape 1 : tests rouges** :

```js
  // --- Durcissement (spec § 6.2, § 5.4, § 6.4)
  for (const page of ['../index.html', './index.html']) {
    const html = await (await fetch(page)).text();
    ok(/http-equiv="Content-Security-Policy"/.test(html) && /script-src 'self'/.test(html) && !/frame-ancestors/.test(html), page + ' : CSP présente, script-src self, sans frame-ancestors');
    ok(/name="referrer" content="no-referrer"/.test(html), page + ' : referrer no-referrer');
    ok(!/<style>/.test(html) && !/<script>(?!<)/.test(html.replace(/<script type="module" src=[^>]+><\/script>/g, '')), page + ' : ni style ni script inline');
  }
  const { displayUrl } = await import('../src/sync/mime.js');
  eq(displayUrl({ mime: 'text/html', blob: new Blob(['<script>1</script>'], { type: 'text/html' }) }), null, 'HTML : jamais d’URL d’affichage');
  const url = displayUrl({ mime: 'image/svg+xml', blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }) });
  eq(url, null, 'SVG : jamais');
  const jpg = displayUrl({ mime: 'image/jpeg', blob: new Blob([1], { type: 'text/html' }) });
  ok(typeof jpg === 'string' && jpg.startsWith('blob:'), 'JPEG : URL d’un blob retypé image/jpeg');
  const { logError } = await import('../src/core/log.js');
  const seen = []; const orig = console.error; console.error = (...a) => seen.push(a);
  logError('sync.push', { store: 'books', id: 'b1', secret: 'ne doit pas sortir', error: new Error('corps de réponse') });
  console.error = orig;
  eq(seen.length, 1, 'un seul appel console');
  ok(JSON.stringify(seen[0]).includes('books') && !JSON.stringify(seen[0]).includes('corps de réponse') && !JSON.stringify(seen[0]).includes('ne doit pas sortir'), 'console : code et identifiants seulement');
```

- [ ] **Étape 2 : rouge.**

- [ ] **Étape 3 : `index.html`** — dans `<head>`, après `<meta charset>` :
```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
```
`tests/index.html` : mêmes deux balises ; déplacer le `<style>` dans `tests/tests.css` (`<link rel="stylesheet" href="./tests.css">`) et le `<script>` inline dans `tests/erreur.js` (`<script src="./erreur.js"></script>`, contenu : l'écouteur `error` tel quel). Vérifier que `styles.css` n'exige rien d'autre (les `style: {…}` posés par `el()` sont du CSSOM, autorisés).

- [ ] **Étape 4 : `src/core/log.js`** :
```js
// Journal des incidents : jamais un objet d'erreur réseau ni une fiche, seulement un code et des identifiants (spec § 6.4).
const SAFE = ['store', 'id', 'status', 'reason', 'table', 'count'];
export function logError(code, details = {}) {
  const safe = {};
  for (const key of SAFE) if (details[key] !== undefined) safe[key] = String(details[key]).slice(0, 120);
  if (details.error instanceof Error) safe.name = details.error.name;
  console.error('[cuisine-os] ' + code, safe);
}
```
`app.js` : remplacer les deux `console.error(e)` par `logError('route', { error: e })` / `logError('boot', { error: e })` et les `<pre>` par `el('p', { class: 'muted' }, t('Code : {c}', { c: e?.name || 'Erreur' }))` + un bouton « Recharger » ; `bus.js` : `logError('bus', { error: e })` (import). Aucun `e.stack` n'est affiché nulle part (`grep -rn "stack" src` vide).

- [ ] **Étape 5 : `mime.js`** — ajouter :
```js
// URL d'affichage d'une ligne files : le blob est retypé avec un type de la liste blanche, ou rien n'est affiché.
export function displayUrl(fileRow) {
  const type = safeDisplayType(fileRow?.mime);
  if (!type || !(fileRow.blob instanceof Blob)) return null;
  return URL.createObjectURL(fileRow.blob.type === type ? fileRow.blob : new Blob([fileRow.blob], { type }));
}
```
Dans `recipe.js:81`, `recipe-edit.js:62`, `book.js:80`, `import.js:116`, `recipe.js:202` : `img.src = URL.createObjectURL(f.blob)` → `const u = displayUrl(f); if (u) img.src = u;` et **retirer** `onClick: () => window.open(img.src, '_blank')` (la vignette reste `clickable` vers rien : retirer la classe aussi). Pour les deux `<iframe>` (`import.js:136`, `recipe-edit.js:67`) : `el('iframe', { class: 'pdf', title: …, sandbox: '' })` (attribut présent, vide = toutes restrictions, **sans** `allow-same-origin`), `frame.src = displayUrl(f) || ''`, et **sous le cadre, toujours** : `el('div', { class: 'row' }, el('button', { class: 'btn', onClick: () => downloadBlob(f.blob, d.original_filename) }, t('Télécharger le fichier')), el('small', { class: 'muted' }, t('Si l’aperçu reste vide, télécharge le fichier.')))`. Vérifier que `el()` pose bien un attribut vide pour `sandbox: ''` (lire `dom.js` ; sinon `frame.setAttribute('sandbox', '')`).

- [ ] **Étape 6 : vert** (Playwright : aucune erreur console sur `tests/`, puis ouvrir `http://localhost:8081/` et vérifier dans la console qu'aucune violation CSP n'apparaît en naviguant Accueil → Réglages). **Étape 7 : commit** — `"Durcissement : CSP et referrer, cadres isoles, blobs retypes, journal sans pile"`.

---

## Tâche 9 — Service worker : cache sans paramètres

**Files:** Create `sw-rules.js` ; Modify `sw.js`, `tests/index.html` ; Modify `tests/sync.js`.

- [ ] **Étape 1 : tests rouges** — `tests/index.html` charge `<script src="../sw-rules.js"></script>` (classique, avant le module) ; test :
```js
  // --- Service worker (spec § 5.6)
  const rules = globalThis.CuisineSwRules;
  ok(rules && typeof rules.shouldCache === 'function', 'sw-rules.js chargé');
  const origin = 'https://exemple.test';
  ok(rules.shouldCache({ url: origin + '/mistu/', method: 'GET' }, origin), 'navigation sans paramètres : cache');
  ok(!rules.shouldCache({ url: origin + '/mistu/?code=abc', method: 'GET' }, origin), 'avec ?code= : jamais en cache');
  ok(!rules.shouldCache({ url: 'https://autre.test/x.js', method: 'GET' }, origin), 'autre origine : jamais');
  ok(!rules.shouldCache({ url: origin + '/mistu/', method: 'POST' }, origin), 'POST : jamais');
```
- [ ] **Étape 2 : rouge.** **Étape 3 : `sw-rules.js`** (script classique) :
```js
// Règles du service worker, partagées avec les tests : seules les requêtes GET de même origine SANS chaîne de requête sont mises en cache (spec § 5.6).
(function (root) {
  function shouldCache(request, origin) {
    if (request.method !== 'GET') return false;
    var url = new URL(request.url);
    return url.origin === origin && url.search === '';
  }
  root.CuisineSwRules = { shouldCache: shouldCache };
})(typeof self !== 'undefined' ? self : globalThis);
```
`sw.js` : `importScripts('./sw-rules.js');` en tête ; dans `fetch` : `if (!self.CuisineSwRules.shouldCache(event.request, self.location.origin)) { if (event.request.method === 'GET' && new URL(event.request.url).origin === self.location.origin) { event.respondWith(fetch(event.request).catch(() => caches.match('./index.html'))); } return; }` — une navigation `?code=` est servie réseau (repli coquille hors ligne) et **jamais `cache.put`**. Ajouter `'./sw-rules.js'` à `SHELL`.
- [ ] **Étape 4 : vert**, puis vérification réelle : Playwright sur `http://localhost:8081/?code=abc` puis `browser_evaluate` `async () => { const ks = await caches.keys(); const all = []; for (const k of ks) for (const r of await (await caches.open(k)).keys()) all.push(r.url); return all.filter((u) => u.includes('code=')); }` → `[]` (noter dans le commit : « vérifié par Playwright »). **Étape 5 : commit** — `"Service worker : aucune mise en cache d'une URL avec parametres"`.

---

## Tâche 10 — Capture des écritures, `repo` et refactor des neuf écritures

**Files:** Create `src/sync/clock.js`, `src/sync/outbox.js` ; Modify `src/model/repo.js`, `src/ui/grocery.js`, `src/ui/import.js`, `src/ui/home.js`, `src/ui/book.js`, `src/ui/cook.js`, `src/ui/settings.js` (ligne 155 seulement : `clearDevice`, le reste à la tâche 13) ; Modify `tests/sync.js`.

**Interfaces:**
- Produces: `syncNow()` (`clock.js` : `new Date(Date.now() + offsetMs).toISOString()`, `setClockOffset(ms)`, `getClockOffset()`), `installCapture(db, { getUserId, isActivitySynced })` et `uninstallCapture(db)` (`outbox.js`), `repo.remove(store, key)` (lit la fiche, passe `payloads`), `repo.save/saveBatch` inchangés en signature mais horodatés par `syncNow()`, `repo.putFile(sha256, blob, meta)` (pose `updated_at`, `mime`/`syncable` par `resolveMime`, écrit le blob si la ligne existante n'en a pas), `repo.recordActivity` (pose `updated_at`), `repo.clearDevice()`.

- [ ] **Étape 1 : tests rouges** :

```js
  // --- Capture (spec § 5.2) et repo (spec § 5.1)
  const { installCapture, uninstallCapture } = await import('../src/sync/outbox.js');
  await withDatabase(async (db) => {
    installCapture(db, { getUserId: () => 'u1', isActivitySynced: () => false });
    await db.mutate({ puts: { recipes: [{ id: 'r1', updated_at: '2026-10-12T10:00:00Z' }], settings: [{ key: 'k', value: 1 }], library_activity: [{ id: 'act1', edition_id: 'e', updated_at: '2026-10-12T10:00:00Z' }] } });
    let out = await db.getAll('outbox');
    eq(out.map((o) => [o.store, o.id, o.op, o.user_id]), [['recipes', 'r1', 'put', 'u1']], 'recipes capturé ; settings et library_activity (réglage off) non');
    await db.mutate({ deletes: { recipes: ['r1'] }, payloads: { recipes: { r1: { id: 'r1', updated_at: '2026-10-12T10:00:00Z' } } } });
    out = await db.getAll('outbox');
    eq([out.at(-1).op, out.at(-1).payload?.id], ['delete', 'r1'], 'suppression capturée avec sa copie');
    await db.mutate({ puts: { recipes: [{ id: 'r2', updated_at: '2026-10-12T10:00:00Z' }] }, origin: 'remote' });
    eq((await db.getAll('outbox')).length, 2, 'réception : non capturée');
    await db.mutate({ clearStores: ['recipes'], origin: 'device' });
    eq((await db.getAll('outbox')).length, 2, 'vidage d’appareil : non capturé');
    uninstallCapture(db);
  });
  const { withRepo } = await import('./sync-fixture.js'); // voir étape 3 : repo sur base temporaire
  await withRepo(async (repo, db) => {
    const row = await repo.putFile('b'.repeat(64), new Blob(['x'], { type: '' }), { original_filename: 'IMG.HEIC' });
    ok(row.updated_at && row.mime === 'image/heic' && row.syncable === true, 'putFile : updated_at, type résolu, synchronisable');
    const unknown = await repo.putFile('c'.repeat(64), new Blob(['y'], { type: '' }), { original_filename: 'notes.txt' });
    ok(unknown.syncable === false && unknown.mime === 'application/octet-stream', 'type inconnu : gardé localement, non synchronisable');
    await db.mutate({ puts: { files: [{ sha256: 'd'.repeat(64), mime: 'image/jpeg', size: 1, remote: true, updated_at: '2026-10-12T10:00:00Z' }] }, origin: 'remote' });
    const filled = await repo.putFile('d'.repeat(64), new Blob(['z'], { type: 'image/jpeg' }), { origin: 'remote' });
    ok(filled.blob instanceof Blob, 'putFile remote : le blob est écrit sur une ligne qui n’en avait pas');
    await repo.recordActivity('ed1', 'open');
    ok((await db.getAll('library_activity'))[0].updated_at, 'recordActivity : updated_at');
    await repo.save('recipes', { id: 'r1' });
    await repo.remove('recipes', 'r1');
    const out = await db.getAll('outbox');
    eq(out.map((o) => o.op), ['put', 'put', 'put', 'delete'].slice(-out.length), 'ordre des captures');
    await repo.clearDevice({ signOut: async () => {} });
    eq([(await db.getAll('recipes')).length, (await db.getAll('outbox')).length, (await db.getAll('sync_state')).map((s) => s.key)], [0, 0, ['device_id']], 'clearDevice : tout vidé sauf device_id');
  });
  // Test statique : aucune écriture directe hors repo.js, src/sync/ et backup.js (spec § 5.2)
  const swText = await (await fetch('../sw.js')).text();
  const shell = [...swText.matchAll(/'(\.\/src\/[^']+\.js)'/g)].map((m) => m[1]);
  const forbidden = new RegExp('\\bdb\\.(' + MUTATING_METHODS.join('|') + ')\\s*\\(');
  const offenders = [];
  for (const file of shell) {
    if (/src\/model\/repo\.js$|src\/sync\/|src\/domain\/backup\.js$|src\/core\/db\.js$/.test(file)) continue;
    if (forbidden.test(await (await fetch('../' + file.slice(2))).text())) offenders.push(file);
  }
  eq(offenders, [], 'aucune écriture IndexedDB directe hors des portes autorisées');
```

`tests/sync-fixture.js` : `withRepo(test)` crée une base temporaire v2 via `withDatabase`, et **instancie le module repo sur cette base** — `repo.js` exporte `db` figé ; pour le rendre testable, `repo.js` expose `export function bindDatabase(database)` (remplace `db` interne, utilisé seulement par les tests) ; `withRepo` appelle `bindDatabase(tempDb)`, `installCapture(tempDb, …)`, puis restaure la base d'origine dans `finally`.

- [ ] **Étape 2 : rouge.**

- [ ] **Étape 3 : `clock.js`, `outbox.js`** :
```js
// clock.js — heure corrigée par le décalage mesuré avec le serveur (spec § 5.3) ; décalage 0 tant que L3 n'existe pas.
let offsetMs = 0; let floorIso = '';
export const setClockOffset = (ms) => { offsetMs = Number.isFinite(ms) ? ms : 0; };
export const getClockOffset = () => offsetMs;
export function syncNow() { const iso = new Date(Date.now() + offsetMs).toISOString(); return iso > floorIso ? (floorIso = iso) : floorIso; }
```
```js
// outbox.js — capture des écritures dans la même transaction (spec § 5.2). Pas d'envoi ici (L3).
import { SYNC_STORES } from '../model/schema.js';
import { keyOf } from './tables.js';
export function installCapture(db, { getUserId = () => null, isActivitySynced = () => false } = {}) {
  db.onMutate = ({ puts, deletes, origin, payloads }) => {
    if (origin !== 'local') return null;
    const rows = []; const user_id = getUserId();
    const wanted = (store) => SYNC_STORES.includes(store) && (store !== 'library_activity' || isActivitySynced());
    for (const [store, list] of Object.entries(puts)) if (wanted(store)) for (const r of list) rows.push({ user_id, store, id: keyOf(store, r), op: 'put', updated_at: r.updated_at || null, tries: 0 });
    for (const [store, keys] of Object.entries(deletes)) if (wanted(store)) for (const k of keys) { const payload = payloads?.[store]?.[k] || null; rows.push({ user_id, store, id: k, op: 'delete', updated_at: payload?.updated_at || null, payload, tries: 0 }); }
    return rows.length ? { outbox: rows } : null;
  };
}
export const uninstallCapture = (db) => { db.onMutate = null; };
```

- [ ] **Étape 4 : `repo.js`** — `import { syncNow } from '../sync/clock.js'; import { resolveMime } from '../sync/mime.js'; import { SYNC_INTERNAL_STORES, STORES } from './schema.js';` ; `nowIso` des horodatages de fiches → `syncNow()` dans `stamp`, `save`, `saveBatch` (garder `nowIso` exporté pour les autres usages) ; `remove(store, key)` : `const existing = await db.get(store, key); await db.mutate({ deletes: { [store]: [key] }, payloads: { [store]: { [key]: existing || null } } }); emit(...)` ; `putFile(sha256, blob, meta = {})` :
```js
export async function putFile(sha256, blob, meta = {}) {
  const existing = await db.get('files', sha256);
  if (existing && existing.blob instanceof Blob) return existing;
  const { mime, syncable } = resolveMime(blob.type || meta.mime, meta.original_filename || existing?.original_filename);
  const now = syncNow();
  const row = { ...(existing || {}), sha256, blob, mime, syncable, size: blob.size, created_at: existing?.created_at || now, updated_at: now, ...stripOrigin(meta) };
  await db.mutate({ puts: { files: [row] }, origin: meta.origin === 'remote' ? 'remote' : 'local' });
  return row;
}
```
(`stripOrigin` retire `origin` de `meta`). `recordActivity` : `{ …, occurred_at: syncNow(), updated_at: syncNow(), …extra }` via `db.mutate`. `clearDevice({ signOut })` :
```js
// Efface tout ce qui est à cet appareil sauf son identité ; jamais capturé (spec § 5.1).
export async function clearDevice({ signOut } = {}) {
  const device = await db.get('sync_state', 'device_id');
  await db.mutate({ clearStores: Object.keys(STORES), puts: device ? { sync_state: [device] } : {}, origin: 'device' });
  if (signOut) await signOut();
  emit('change', { store: '*' });
}
```
`bindDatabase(database)` pour les tests (`export let db = …` → `let database = new Database(...); export const db = new Proxy(…)` est trop malin : plus simple, `export function bindDatabase(d) { db = d; }` avec `export let db`). `init()` migre `localStorage['cuisineos.device']` → `sync_state.device_id` (si présent et absent de la base), puis retire la clé.

- [ ] **Étape 5 : les neuf sites** — `grocery.js:22` → `repo.save('shopping_lists', { ...list, checked: … })` ; `import.js:169` → `for (const id of ids) await repo.remove('source_pages', id)` (ou un `repo.removeMany` si le lot est grand : l'ajouter, même forme) ; `home.js:77,82`, `book.js:104` → `repo.save('rediscovery_prefs', { ...pref, … })` ; `cook.js:65,119,122` → `repo.save(...)` ; `settings.js:155` → `await repo.clearDevice({ signOut: null })` (le vrai `signOut` arrive tâche 13). `backup.js` reste tel quel.

- [ ] **Étape 6 : vert** (tout, y compris le test statique). **Étape 7 : commit** — `"Capture des ecritures dans la transaction, repo.remove/clearDevice, horloge corrigee, plus d'ecriture directe dans l'interface"`.

---

## Tâche 11 — `supabase-js` embarqué et vérifié deux fois

**Files:** Create `tools/verifier-vendor.mjs`, `src/vendor/supabase-2.117.3.umd.js` ; Modify `index.html`, `tests/index.html`, `docs/architecture.md`.

- [ ] **Étape 1 : `tools/verifier-vendor.mjs`** (Node, `fetch` + `node:crypto` + `zlib`/`tar` ? — pas de `tar` natif : extraire le `.tgz` par `npm pack` puis `tar -xzf` **en shell**, le script ne fait que les vérifications) :
```js
#!/usr/bin/env node
// Vérifie la dépendance embarquée (spec § 6.1) : (1) l'archive npm contre dist.integrity du registre ; (2) le fichier extrait contre unpkg.
// Usage : node tools/verifier-vendor.mjs <version> <chemin du .tgz> <chemin du fichier umd extrait>
import { createHash } from 'node:crypto'; import { readFileSync } from 'node:fs';
const [version, tgz, umd] = process.argv.slice(2);
const sha512b64 = (buf) => 'sha512-' + createHash('sha512').update(buf).digest('base64');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const meta = await (await fetch(`https://registry.npmjs.org/@supabase/supabase-js/${version}`)).json();
const okTgz = meta.dist.integrity === sha512b64(readFileSync(tgz));
const local = readFileSync(umd);
const remote = new Uint8Array(await (await fetch(`https://unpkg.com/@supabase/supabase-js@${version}/dist/umd/supabase.js`)).arrayBuffer());
const okUmd = sha256(local) === sha256(remote);
console.log(JSON.stringify({ version, integrity_registre: meta.dist.integrity, archive_ok: okTgz, umd_sha256: sha256(local), unpkg_sha256: sha256(remote), umd_ok: okUmd }, null, 2));
process.exit(okTgz && okUmd ? 0 : 1);
```
- [ ] **Étape 2 : obtenir et vérifier** — dans un dossier du scratchpad : `npm pack @supabase/supabase-js@2.117.3` (produit le `.tgz`), `tar -xzf …tgz package/dist/umd/supabase.js`, `node tools/verifier-vendor.mjs 2.117.3 <tgz> package/dist/umd/supabase.js` → les deux `ok: true` ; copier le fichier en `src/vendor/supabase-2.117.3.umd.js`. Vérifier qu'il **commence par** `var supabase=` (IIFE) et ne contient aucun `import(` dynamique ni `from"/npm/`. Coller la sortie JSON dans `docs/architecture.md`, section « Dépendance embarquée ».
- [ ] **Étape 3 : chargement** — `index.html` : `<script src="./src/vendor/supabase-2.117.3.umd.js"></script>` **avant** `<script type="module" src="./src/app.js">` ; `tests/index.html` : même balise avant `tests.js`. Test (`tests/sync.js`) : `ok(typeof globalThis.supabase?.createClient === 'function', 'supabase-js embarqué chargé par un script classique');`.
- [ ] **Étape 4 : vert.** **Étape 5 : commit** — `"Dependance embarquee : supabase-js 2.117.3 UMD, verifiee contre le registre et unpkg"` (le fichier vendorisé est commité tel quel, sans reformatage).

---

## Tâche 12 — `config.js` et `auth.js` : connexion, retour, garde de compte

**Files:** Create `src/sync/config.js`, `src/sync/auth.js` ; Modify `tests/sync.js`.

**Interfaces:**
- Produces: `SUPABASE = { prod: { url, anonKey }, dev: { url, anonKey } }` et `currentConfig()` (dev si `location.hostname` ∈ {`localhost`, `127.0.0.1`}, sinon prod ; `null` si l'entrée est vide) ; `createAuth({ db, config = currentConfig(), factory = globalThis.supabase?.createClient, win = window })` → `{ available, reason, signIn(), signOut(), session(), onChange(fn), handleReturn(), guard(uid, email) }`.

- [ ] **Étape 1 : tests rouges** (client simulé) :
```js
  // --- Connexion (spec § 4.1)
  const { createAuth } = await import('../src/sync/auth.js');
  const fakeHistory = []; const fakeWin = { location: { origin: 'https://cuisine.exemple.test', pathname: '/', hash: '#/settings', search: '?code=abc&state=s', href: 'https://cuisine.exemple.test/?code=abc&state=s#/settings' }, history: { replaceState: (a, b, url) => fakeHistory.push(url) } };
  const calls = []; let changeCb = null;
  const factory = (url, key, options) => { calls.push({ url, key, options }); return { auth: {
    signInWithOAuth: async (o) => { calls.push({ signIn: o }); return { data: {}, error: null }; },
    signOut: async (o) => { calls.push({ signOut: o }); return { error: null }; },
    getSession: async () => ({ data: { session: { user: { id: 'uid-A', email: 'A@EXEMPLE.test' } } } }),
    onAuthStateChange: (cb) => { changeCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
  } }; };
  await withDatabase(async (db) => {
    const sans = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: undefined, win: fakeWin });
    eq([sans.available, sans.reason], [false, 'bibliotheque'], 'sans supabase-js : indisponible avec motif');
    const auth = createAuth({ db, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory, win: fakeWin });
    eq(calls[0].options.auth, { flowType: 'pkce', persistSession: true, detectSessionInUrl: true }, 'options PKCE');
    await auth.signIn();
    eq(calls.at(-1).signIn.options.redirectTo, 'https://cuisine.exemple.test/', 'redirectTo sans fragment');
    auth.handleReturn();
    eq(fakeHistory.at(-1), '/#/settings', 'code retiré, fragment conservé');
    eq(auth.readError({ search: '?error=access_denied&error_description=x', hash: '' }), 'Cette adresse n’est pas autorisée.', 'refus : message fixe');
    eq(auth.readError({ search: '', hash: '#error=server_error&error_code=unexpected_failure' }), 'Cette adresse n’est pas autorisée.', 'refus dans le fragment');
    eq(await auth.guard('uid-A', 'a@exemple.test'), { ok: true }, 'premier compte : accepté et mémorisé');
    eq((await db.get('sync_state', 'user_id')).value, 'uid-A', 'user_id écrit');
    const other = await auth.guard('uid-B', 'b@exemple.test');
    eq(other.ok, false, 'autre compte : refusé');
    ok(/synchronisé avec/.test(other.message) && other.message.includes('a@exemple.test'), 'message nomme l’adresse connue');
    await auth.signOut();
    eq(calls.at(-1).signOut, { scope: 'local' }, 'déconnexion locale seulement');
  });
```
- [ ] **Étape 2 : rouge.** **Étape 3 : `config.js`** :
```js
// Valeurs publiques par conception (clé anon + URL) : prod = GitHub Pages / origine dédiée ; dev = projet « mistu-dev » (D8).
// À remplir par Neegan ; une entrée vide désactive la synchronisation sur cette origine.
export const SUPABASE = {
  prod: { url: '', anonKey: '' },
  dev:  { url: '', anonKey: '' },
};
export function currentConfig(hostname = globalThis.location?.hostname || '') {
  const entry = ['localhost', '127.0.0.1'].includes(hostname) ? SUPABASE.dev : SUPABASE.prod;
  return entry.url && entry.anonKey ? entry : null;
}
```
`auth.js` : implémenter l'interface ; `available=false, reason='bibliotheque'` sans `factory`, `reason='config'` sans config ; `signIn()` → `signInWithOAuth({ provider: 'google', options: { redirectTo: win.location.origin + win.location.pathname } })` ; `handleReturn()` → si `win.location.search` contient `code=` ou `error`, `win.history.replaceState(null, '', win.location.pathname + win.location.hash)` ; `readError({search, hash})` → `null` ou le message fixe `t('Cette adresse n’est pas autorisée.')` dès que `error` ou `error_code` est présent ; `guard(uid, email)` lit/écrit `sync_state.user_id` et `sync_state.user_email` (**adresse en base locale seulement**) et renvoie `{ ok, message }` ; `onChange(fn)` relaie `onAuthStateChange` + `emit('sync', state)` ; `session()` depuis `getSession`. `signOut()` → `{ scope: 'local' }`. Le flux « Changer de compte sur cet appareil » est un geste d'interface (tâche 13) qui appelle `repo.clearDevice({ signOut })`.
- [ ] **Étape 4 : vert.** **Étape 5 : commit** — `"Connexion : client, retour PKCE sans code dans l'historique, garde de compte"`.

---

## Tâche 13 — Réglages : section « Synchronisation » (ensemble L2) et « Effacer les données de cet appareil »

**Files:** Modify `src/ui/settings.js`, `src/i18n/en.js`, `src/app.js` ; Modify `tests/sync.js` (test de rendu minimal).

- [ ] **Étape 1 : test rouge** — exporter de `settings.js` une fonction pure `syncSectionModel({ available, reason, session, pending, guard })` → `{ title, lines: [...], buttons: [...] }` (le rendu DOM la consomme) et la tester : désactivée (`available` false, reason `config`) → une ligne « Tes données restent sur cet appareil. » et aucun bouton si `reason` n'est pas `null` ? **Non** : si `available` est false pour `reason: 'config'`, la section dit « Synchronisation non configurée sur cette adresse » ; si `'bibliotheque'`, « La bibliothèque de synchronisation n'a pas été chargée » ; si disponible et sans session : bouton **« Activer la synchronisation »** ; avec session : « Connectée : <adresse> », « À envoyer : N », « Se déconnecter » ; si `guard.ok === false` : le message de garde + bouton « Changer de compte sur cet appareil ». Tests `eq` sur ces quatre états.
- [ ] **Étape 2 : rouge.** **Étape 3 : implémentation** — section insérée **avant** « Sauvegarde » ; `pending` = `await repo.db.count('outbox')` ; « Changer de compte » : `confirmDialog` ×2 (la seconde nomme `N envois en attente seront perdus — ils sont dans l'archive`), exige `sessionStorage['cuisineos.archive_created']` posé par le bouton d'archive de la même page (poser cette clé dans le `try` du bouton « Sauvegarder toute ma bibliothèque » après `downloadBlob`), puis `repo.clearDevice({ signOut: auth.signOut })` et `location.reload()`. « Effacer toutes les données » renommé **« Effacer les données de cet appareil »**, texte « Cet appareil sera déconnecté ; ta bibliothèque reste sur le serveur. », refusé si `pending > 0` (`toast(t('{n} éléments ne sont pas encore envoyés', { n }))`), sinon `repo.clearDevice({ signOut: auth.signOut })`. Les puces « Données sur cet appareil » filtrent `SYNC_INTERNAL_STORES`. Réglage « Synchroniser mon historique de consultation » (case, `settings.sync_activity`, défaut `false`) — **la capture le lit** (`isActivitySynced: () => settingsCache.sync_activity`). `app.js` : au `boot`, `installCapture(repo.db, { getUserId: () => authState.user?.id || null, isActivitySynced })`, `const auth = createAuth({ db: repo.db })`, `auth.handleReturn()`, puis `auth.session()` → `auth.guard(...)` → état exposé à Réglages par `getData()`/`ctx.sync`. Toutes les chaînes dans `en.js`.
- [ ] **Étape 4 : vert** + Playwright sur `http://localhost:8081/#/settings` : la section s'affiche « Synchronisation non configurée sur cette adresse » (config vide), sans erreur console. **Étape 5 : commit** — `"Reglages : section Synchronisation (L2), changer de compte, effacer les donnees de cet appareil"`.

---

## Tâche 14 — Clôture du lot : `SHELL`, `VERSION`, docs, état des travaux

**Files:** Modify `sw.js`, `docs/architecture.md`, `CLAUDE.md`, `README.md`.

- [ ] `SHELL` : ajouter `./sw-rules.js`, `./src/core/log.js`, `./src/sync/tables.js`, `./src/sync/mime.js`, `./src/sync/clock.js`, `./src/sync/outbox.js`, `./src/sync/config.js`, `./src/sync/auth.js`, `./src/vendor/supabase-2.117.3.umd.js` ; `VERSION = 'cuisine-os-v0.2.0-1'` ; `APP_VERSION = '0.2.0'` dans `schema.js`. Test existant de complétude de `SHELL` ? S'il n'y en a pas, ajouter à `tests/sync.js` : chaque import statique de `src/app.js` (récursif, regex `from '…'`) est dans `SHELL`.
- [ ] `docs/architecture.md` : section « Synchronisation (L1-L2) » : carte des modules `src/sync/`, porte `db.mutate`, magasins internes, dépendance embarquée (les deux empreintes), CSP, ce qui est **absent** (envoi, réception : L3).
- [ ] `CLAUDE.md` : section « État des travaux » : lot L1-L2 livré, preuves jouées / non jouées (tâche 5), mesure iOS **à faire par Neegan** (spec § 4.1), valeurs `config.js` à remplir, origine dédiée (D5) : état.
- [ ] `README.md` : une phrase sur la synchronisation et le lien vers la spec.
- [ ] Suite complète verte (Playwright), `node --test tools/*.test.mjs` vert, `node tools/generer-migrations.mjs --check` code 0, `grep -rn "window.open\|\.stack" src` vide, scan secrets (`grep -rniE 'service_role|api_key|secret|token' src supabase tools | grep -v -E 'SECRET_SETTING_KEYS|anonKey|key|token' …` — relire à l'œil), octets invisibles 0.
- [ ] Commit — `"Lot L1-L2 : SHELL, version 0.2.0, architecture et etat des travaux"`.

Puis : **`/verify`** par le contrôleur (revue adverse 3 lentilles, scan secrets, tests), et la **mesure iOS** par Neegan (spec § 4.1) avant tout L3.

---

## Écarts à la spec (à tenir à jour pendant la construction)

1. `is_allowed()`, `before_user_created()` et `enforce_allowed_user()` vivent dans **`public`** (pas `private`) : une fonction appelée par une règle RLS ou par le service d'authentification doit être exécutable par le rôle appelant, ce qui exigerait `usage` sur `private` — contraire à son but. `private` ne garde que `allowed_users` et la vue. Les trois fonctions sont `security definer`, `set search_path = ''`, avec les `grant`/`revoke` de la spec. **À reporter dans la spec § 3.2 / § 3.3 à la clôture.**
2. `clearAll()` de `db.js` reste `origin: 'local'` ; seul `repo.clearDevice()` passe `origin: 'device'` (la spec dit la même chose autrement).
3. `sync_state.user_email` (adresse connue de l'appareil, base locale) est ajouté pour afficher le message de garde : la spec le laissait implicite.

## Ce qui n'est PAS dans ce plan (L3-L5)
Envoi (`push.js`), réception (`pull.js`), envoi initial par marqueurs, conflits, quarantaine, pause quota, pastille d'en-tête, fichiers distants (`files.js`), « Télécharger toutes les pages », tombales lisibles, `sync_purge` depuis l'app, second appareil. Le prochain plan part de la spec § 5.3-5.5 et § 4.2 (L3-L5).
