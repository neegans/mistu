# Synchronisation L3 — envoi et réception — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** ce que la personne écrit sur un appareil connecté (livres, recettes, fiches — pas encore les octets des photos) arrive sur ses autres appareils, et inversement, par le serveur `mitsu` ; chaque état affiché est un fait (accusé du serveur, lignes reçues), jamais une promesse.

**Architecture :** la file `outbox` remplie en L2 est vidée par `push.js` (lots vers `sync_push`, accusés → retrait / réécriture / conflit / quarantaine) ; `pull.js` lit chaque table par `server_seq > curseur` et applique « le plus récent gagne » (I7) avec journal de conflits ; `backfill.js` met en file toute la bibliothèque d'avant la connexion, table par table, par marqueurs ; `moteur.js` enchaîne envoi initial → envoi → réception sur chaque déclencheur, en un seul vol à la fois, et expose un état lisible par Réglages et par la pastille. Tout le réseau passe par `transport.js` (le client supabase-js embarqué), remplacé par un faux transport dans les tests : **aucun test ne touche le réseau**.

**Tech Stack :** PWA sans build (modules ES natifs), IndexedDB via `src/core/db.js` (`mutate` = porte unique), `supabase-js` 2.117.3 UMD embarqué (`client.rpc`, `client.from().select()`), tests navigateur `tests/index.html` (harnais `tests/tests.js` : `run`, `ok`, `eq`), outils Node `tools/*.test.mjs` inchangés.

**Spec :** `docs/spec-compte-et-stockage-distant.md` — § 2 (invariants I4, I5, I7), § 3.4 (contrat de `sync_push`), § 4.2 (Réglages, ensemble L3), § 5.1 (magasins internes), § 5.2 (envoi initial par marqueurs, fusion ZIP), **§ 5.3 (envoi)**, **§ 5.5 (réception et conflits)**, § 7.1 (tests DOIT), § 11 (amendements R1-R36 : R9 motifs ASCII, R14 512 Ko, R25/S2 côté serveur, R27 historique, R28/R32 démarrage, R31 remplacement). Le lot L4 (octets des fichiers) et L5 (tombales lisibles, purge serveur) restent hors périmètre.

## Global Constraints

- Français partout (code, commentaires, interface) ; toute chaîne d'interface passe par `t()` ; `src/i18n/en.js` complété pour chaque chaîne neuve.
- **Aucune dépendance npm, aucun bundler** (I1) ; la seule bibliothèque tierce est le bundle embarqué `src/vendor/supabase-2.117.3.umd.js` (`globalThis.supabase`).
- **Toute écriture passe par `db.mutate`** (une transaction par geste) ; le test statique « aucune écriture directe hors `db.mutate` » reste vert ; les écritures venues du serveur, les ajustements et les réécritures internes portent `origin: 'remote'` ou `'device'` (jamais capturées) ; seules les écritures de la personne portent `origin: 'local'`.
- **I5** : « envoyé » = accusé du serveur (l'entrée d'outbox n'existe plus) ; « reçu » = ligne écrite localement ; « Dernier échange » = heure du dernier appel réussi ; aucun état affiché sans événement réel.
- **I7** : `updated_at` strictement supérieur gagne ; égal + contenu identique = rien ; égal + contenu différent = conflit à trancher par la personne ; aucune fusion silencieuse de champs.
- Motifs de rejet du serveur = jetons ASCII `updated_at | cle | forme | taille | conflit` (R9) ; borne 512 Ko par élément (R14), 500 éléments et 1 Mo par lot (§ 3.4).
- `updated_at` des écritures synchronisées = `syncNow()` de `src/sync/clock.js` (local + décalage mesuré, jamais inférieur au dernier `server_time` vu).
- **Jamais `error.message` d'un fournisseur à l'écran** ; `logError(code, { … })` journalise un code et des identifiants, jamais de contenu de fiche.
- Dépôt public (I6, R29) : aucune adresse, aucune clé ; `Object.hasOwn` sur les objets nus ; pas de `window.open` ; `grep -c $'\xe2\x80[\xa8\xa9]'` = 0 par fichier touché (commandes séparées).
- Tests : TDD (rouge mesuré et nommé dans le rapport, puis vert), bases temporaires `cuisine-os-sync-test-*` via `withRepo`, **transport factice** (`tests/transport-factice.js`), aucun réseau ; suite complète lancée par Playwright sur `http://localhost:8080/tests/?v=…` après SW désinscrit + cache purgé par CDP ; **aucune vérification destructrice dans le navigateur Playwright** (profil partagé avec Neegan : pas de `deleteDatabase`, pas de « Effacer », pas de `clearDevice` hors base temporaire).
- `sw.js` : chaque module neuf entre dans `SHELL` ; `VERSION` incrémenté à chaque commit qui touche un fichier servi.
- Commits : messages **sans accents** + ligne vide + `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` ; jamais `--amend` / `reset` / `rebase` / `stash` ; un commit par tâche au moins.
- Branche de travail : `synchro-l3`, créée depuis `main` (`dfd164a`) dans `/Users/neeganmac/projects/mistu` (serveur `http://localhost:8080/` déjà lancé sur cet arbre).

---

## Carte des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `src/sync/transport.js` (créé) | Le seul endroit qui parle au réseau : `pousser(rows)` → `sync_push`, `lire(table, apres, limite)` → `select`; classification des erreurs | T1 |
| `src/sync/auth.js` (modifié) | `getClient()` : le client supabase-js, ou `null` | T1 |
| `tests/transport-factice.js` (créé) | Transport scripté pour les tests (réponses, erreurs, journal des appels) | T1 |
| `src/sync/lots.js` (créé) | Pur : nettoyage des chaînes, taille JSON, composition des lots (ordre, dédoublonnage, relecture, bornes) | T2 |
| `src/sync/reponses.js` (créé) | Pur : une réponse de `sync_push` → effets (retraits, réécritures, conflits, quarantaine) | T3 |
| `src/sync/clock.js` (modifié) | `appliquerHeureServeur(iso)` : décalage, plancher, avertissement unique | T3 |
| `src/sync/push.js` (créé) | Envoi d'une passe : lots → transport → effets ; recul, 401, quota, dichotomie | T3, T4 |
| `src/sync/backfill.js` (créé) | Envoi initial par marqueurs, par morceaux, reprenable | T5 |
| `src/sync/pull.js` (créé) | Réception paginée, décision I7, curseur atomique, conflits, lignes `files` sans octets, pointeur de version | T6 |
| `src/sync/conflits.js` (créé) | « Garder celle d'ici » / « Garder celle d'ailleurs », purge > 30 jours | T6 |
| `src/sync/moteur.js` (créé) | Déclencheurs, un seul vol, ordre envoi initial → envoi → réception, état observable, persistance | T7 |
| `src/ui/settings.js` (modifié) | Section « Synchronisation » ensemble L3 : lignes, gestes, quarantaine, conflits, progression, pause, horloge | T8 |
| `src/app.js` (modifié) | Démarrage du moteur après la porte, pastille « N non envoyés » | T9 |
| `src/ui/recipe.js` (modifié) | « Une autre version a été créée ailleurs » | T9 |
| `src/domain/backup.js`, `src/ui/settings.js` (modifiés) | Fusion ZIP : `updated_at` neufs, bilan « N fiches seront renvoyées au serveur » | T9 |
| `tests/sync-l3.js` (créé), `tests/tests.js` (modifié) | Suite L3 (`runSyncL3Tests`) câblée au harnais | T1→T9 |
| `sw.js`, `CLAUDE.md`, `README.md`, `docs/architecture.md`, spec § 11 | Clôture | T10 |

Interfaces partagées (nommées une fois, reprises telles quelles) :

```js
// Entrée d'outbox (spec § 5.1, écrite par src/sync/outbox.js)
// { seq, user_id, store, id, op: 'put'|'delete', updated_at, payload?, tries, last_error?, quarantined_at?, next_try_at? }
// Élément envoyé à sync_push (spec § 3.4)
// { store, id, data: object|null, updated_at: iso, deleted: boolean }
// Réponse de sync_push
// { server_time: iso, accepted: [{store,id}], adjusted: [{store,id,updated_at}], rejected: [{store,id,reason,server?}] }
// Ligne reçue (select)
// { id, data, updated_at, deleted_at, server_seq }
// Conflit (magasin sync_conflicts)
// { id: `${store}:${record_id}`, store, record_id, local: object|null, server: { data, updated_at, deleted_at }, at: iso, kind: 'donnees'|'version' }
// Erreur de transport (classée par transport.js)
// { type: 'reseau'|'auth'|'quota'|'refus'|'inconnu', status: number|null, message: string }
```

---

### Task 1 : transport et client

**Files :**
- Create : `src/sync/transport.js`
- Modify : `src/sync/auth.js` (ajouter `getClient` à l'objet rendu)
- Create : `tests/transport-factice.js`
- Create : `tests/sync-l3.js` ; Modify : `tests/tests.js:19-20,159-166`

**Interfaces :**
- Consumes : `createAuth()` (client privé `client` dans `auth.js`).
- Produces : `createTransport(client)` → `{ pousser(rows) → Promise<{ reponse: object|null, erreur: Erreur|null }>, lire(table, apres, limite = 1000) → Promise<{ lignes: Ligne[]|null, erreur: Erreur|null }> }` ; `classerErreur({ status = null, code = null, message = '' } = {})` → `Erreur` ; `auth.getClient()` → client ou `null` ; `creerTransportFactice({ pousser = [], lire = {} } = {})` → transport + `journal` (appels) ; `runSyncL3Tests({ eq, ok })`.

- [ ] **Step 1 : tests rouges (`tests/sync-l3.js`, nouveau fichier)**

```js
// Suite L3 — envoi et réception (spec § 5.3, § 5.5). Transport factice : aucun réseau.
import { classerErreur, createTransport } from '../src/sync/transport.js';
import { createAuth } from '../src/sync/auth.js';
import { creerTransportFactice } from './transport-factice.js';

export async function runSyncL3Tests({ eq, ok }) {
  // --- Transport (spec § 5.3) : classification des erreurs, un seul chemin réseau
  eq(classerErreur({ status: 0, message: 'Failed to fetch' }).type, 'reseau', 'transport : échec réseau → reseau');
  eq(classerErreur({ status: 503, message: 'Service Unavailable' }).type, 'reseau', 'transport : 5xx → reseau (réessai)');
  eq(classerErreur({ status: 429, message: 'Too Many Requests' }).type, 'reseau', 'transport : 429 → reseau (recul)');
  eq(classerErreur({ status: 401, message: 'JWT expired' }).type, 'auth', 'transport : 401 → auth');
  eq(classerErreur({ status: 400, code: 'P0001', message: 'adresse non autorisée' }).type, 'auth', 'transport : refus d’adresse → auth (garde à refaire)');
  eq(classerErreur({ status: 413, message: 'Payload Too Large' }).type, 'quota', 'transport : 413 → quota');
  eq(classerErreur({ status: 507, message: 'Insufficient Storage' }).type, 'quota', 'transport : 507 → quota');
  eq(classerErreur({ status: 400, message: 'disk quota exceeded' }).type, 'quota', 'transport : message « exceeded » → quota');
  eq(classerErreur({ status: 400, code: 'P0001', message: 'rows : 500 éléments au plus' }).type, 'refus', 'transport : lot refusé entier → refus (dichotomie)');
  eq(classerErreur({ status: 404, message: 'not found' }).type, 'inconnu', 'transport : le reste → inconnu');
  ok(!('error' in classerErreur({ status: 401, message: 'secret' })), 'transport : l’erreur classée ne transporte pas l’objet brut');

  const fauxClient = {
    rpc: async (nom, args) => (nom === 'sync_push' ? { data: { server_time: '2026-10-13T20:00:00Z', accepted: [], adjusted: [], rejected: [] }, error: null, status: 200 } : { data: null, error: { message: 'x', code: 'PGRST202' }, status: 404 }),
    from: (table) => ({ select: () => ({ gt: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'b1', data: { id: 'b1' }, updated_at: '2026-10-13T19:00:00Z', deleted_at: null, server_seq: 7 }], error: null, status: 200 }) }) }) }) }),
  };
  const tr = createTransport(fauxClient);
  const p = await tr.pousser([]);
  eq([p.erreur, p.reponse.server_time], [null, '2026-10-13T20:00:00Z'], 'transport : pousser rend la réponse telle quelle');
  const l = await tr.lire('books', 0, 1000);
  eq([l.erreur, l.lignes.length, l.lignes[0].server_seq], [null, 1, 7], 'transport : lire rend les lignes');
  const sansClient = createTransport(null);
  eq((await sansClient.pousser([])).erreur.type, 'auth', 'transport : sans client → auth (rien n’est tenté)');

  const f = creerTransportFactice({ pousser: [{ reponse: { server_time: 't', accepted: [{ store: 'books', id: 'b1' }], adjusted: [], rejected: [] } }, { erreur: { type: 'reseau', status: 0, message: 'x' } }] });
  eq((await f.pousser([{ store: 'books', id: 'b1' }])).reponse.accepted.length, 1, 'factice : première réponse scriptée');
  eq((await f.pousser([])).erreur.type, 'reseau', 'factice : deuxième réponse scriptée');
  eq(f.journal.map((a) => a.appel), ['pousser', 'pousser'], 'factice : journal des appels');

  // auth.getClient : la seule sortie du client vers le transport (jamais vers l’interface).
  const auth = createAuth({ db: null, config: { url: 'https://x.supabase.co', anonKey: 'k' }, factory: () => fauxClient, win: { location: { origin: 'http://localhost', pathname: '/', search: '', hash: '' }, history: { replaceState() {} } } });
  eq(auth.getClient(), fauxClient, 'auth : getClient rend le client créé');
  const sans = createAuth({ db: null, config: null, factory: () => fauxClient, win: { location: { origin: 'http://localhost', pathname: '/', search: '', hash: '' }, history: { replaceState() {} } } });
  eq(sans.getClient(), null, 'auth : sans configuration, getClient rend null');
}
```

Câblage dans `tests/tests.js` : après `import { runSyncTests } from './sync.js';` ajouter `import { runSyncL3Tests } from './sync-l3.js';` et, après le bloc `try { await runSyncTests({ eq, ok }); } …`, le même bloc pour `runSyncL3Tests` (même forme : `try { await runSyncL3Tests({ eq, ok }); } catch (e) { ok(false, 'Suite L3 interrompue : ' + (e?.message || e)); }` — reprendre exactement la forme du bloc existant de `runSyncTests`).

- [ ] **Step 2 : rouge** — Playwright, `http://localhost:8080/tests/?v=l3-t1-rouge` → « Suite L3 interrompue : Failed to fetch dynamically imported module … transport.js » (ou équivalent). Noter le compte.

- [ ] **Step 3 : implémentation**

`src/sync/transport.js` :

```js
// Le seul module qui parle au serveur (spec § 5.3, § 5.5). Deux appels : sync_push (RPC) et la lecture d'une table
// par server_seq. Les erreurs sont CLASSÉES ici (type + statut + message pour le journal), jamais rendues brutes à
// l'interface. Dans les tests, ce module est remplacé par tests/transport-factice.js : aucun réseau.
const COLONNES = 'id,data,updated_at,deleted_at,server_seq';

// Classement d'une erreur de supabase-js / PostgREST en cinq types que le moteur sait traiter.
//   reseau  : réessai avec recul (échec réseau, 5xx, 429)
//   auth    : attente de connexion, garde à refaire (401, 403, « adresse non autorisée »)
//   quota   : pause (413, 507, message « exceeded ») — rien n'est perdu
//   refus   : lot entier refusé par une règle du serveur (4xx autre) — dichotomie
//   inconnu : journalisé, traité comme refus (prudence)
export function classerErreur({ status = null, code = null, message = '' } = {}) {
  const s = Number.isFinite(status) ? status : null;
  const m = String(message || '');
  const basse = m.toLowerCase();
  let type = 'inconnu';
  if (s === null || s === 0 || s >= 500 || s === 429) type = 'reseau';
  else if (s === 401 || s === 403 || basse.includes('adresse non autoris')) type = 'auth';
  else if (s === 413 || s === 507 || basse.includes('exceeded')) type = 'quota';
  else if (s >= 400 && s < 500 && s !== 404) type = 'refus';
  // Le message est gardé pour le JOURNAL (code seul à l'écran) : tronqué, jamais un objet.
  return { type, status: s, message: m.slice(0, 200), code: code ? String(code) : null };
}

const SANS_CLIENT = () => ({ type: 'auth', status: null, message: 'client absent', code: null });

export function createTransport(client) {
  return {
    async pousser(rows) {
      if (!client) return { reponse: null, erreur: SANS_CLIENT() };
      try {
        const { data, error, status } = await client.rpc('sync_push', { rows });
        if (error) return { reponse: null, erreur: classerErreur({ status, code: error.code, message: error.message }) };
        return { reponse: data, erreur: null };
      } catch (error) {
        return { reponse: null, erreur: classerErreur({ status: 0, message: error?.message }) };
      }
    },
    async lire(table, apres, limite = 1000) {
      if (!client) return { lignes: null, erreur: SANS_CLIENT() };
      try {
        const { data, error, status } = await client.from(table).select(COLONNES).gt('server_seq', apres).order('server_seq', { ascending: true }).limit(limite);
        if (error) return { lignes: null, erreur: classerErreur({ status, code: error.code, message: error.message }) };
        return { lignes: Array.isArray(data) ? data : [], erreur: null };
      } catch (error) {
        return { lignes: null, erreur: classerErreur({ status: 0, message: error?.message }) };
      }
    },
  };
}
```

`src/sync/auth.js` : dans l'objet rendu par `createAuth`, ajouter `getClient: () => client,` (le client privé créé par `factory`, ou `null`). Commentaire : « seule sortie du client : vers transport.js, jamais vers l'interface ».

`tests/transport-factice.js` :

```js
// Transport scripté pour la suite L3 : chaque appel consomme la réponse suivante de sa liste ; au-delà, la dernière
// est répétée. `lire` est scripté par table : { books: [[lignes page 1], [lignes page 2]] }. Tout appel est journalisé.
export function creerTransportFactice({ pousser = [], lire = {} } = {}) {
  const journal = [];
  const filesLire = Object.fromEntries(Object.entries(lire).map(([t, pages]) => [t, [...pages]]));
  let iPousser = 0;
  return {
    journal,
    async pousser(rows) {
      journal.push({ appel: 'pousser', rows: structuredClone(rows) });
      const r = pousser[Math.min(iPousser, pousser.length - 1)] || { reponse: { server_time: new Date().toISOString(), accepted: rows.map(({ store, id }) => ({ store, id })), adjusted: [], rejected: [] } };
      iPousser += 1;
      return { reponse: r.reponse ? structuredClone(r.reponse) : null, erreur: r.erreur || null };
    },
    async lire(table, apres, limite = 1000) {
      journal.push({ appel: 'lire', table, apres, limite });
      const pages = filesLire[table] || [];
      const page = pages.length ? pages.shift() : [];
      if (page && page.erreur) return { lignes: null, erreur: page.erreur };
      return { lignes: structuredClone(page.filter((l) => l.server_seq > apres).slice(0, limite)), erreur: null };
    },
  };
}
```

- [ ] **Step 4 : vert** — `?v=l3-t1-vert` : suite complète verte (450 + les nouvelles assertions), 0 erreur console. `node --input-type=module -e "await import('./src/sync/transport.js')"` OK.

- [ ] **Step 5 : commit** — `git add src/sync/transport.js src/sync/auth.js tests/transport-factice.js tests/sync-l3.js tests/tests.js && git commit -m "L3 T1 : transport (sync_push, lecture par server_seq), classement des erreurs, client expose par auth, transport factice"`

---

### Task 2 : composition des lots (pur)

**Files :**
- Create : `src/sync/lots.js`
- Test : `tests/sync-l3.js` (bloc `// --- Lots (spec § 5.3)`)

**Interfaces :**
- Consumes : forme des entrées d'outbox (§ 5.1), `keyOf` de `tables.js` (pas nécessaire : l'entrée porte déjà `id`).
- Produces : `nettoyerChaines(valeur)` ; `tailleJson(valeur)` (octets UTF-8) ; `LIMITES = { elements: 500, lot: 1048576, element: 524288 }` ; `dedoublonner(entrees)` → `[{ cle, entree (la plus récente), seqs: [tous les seq de cette clé] }]` dans l'ordre du **premier** seq ; `composerLots(entrees, relire)` → `Promise<{ lots: [{ elements, seqs }], retenues: [{ seq, raison }] }>` — `relire(store, id)` async rend la fiche locale ou `undefined`.

- [ ] **Step 1 : tests rouges**

```js
  // --- Lots (spec § 5.3) : ordre, dédoublonnage, relecture, bornes 500 / 1 Mo / 512 Ko, fichiers retenus
  const { nettoyerChaines, tailleJson, dedoublonner, composerLots, LIMITES } = await import('../src/sync/lots.js');
  eq(nettoyerChaines({ a: 'x\u0000y', b: ['\u0007z', 1], c: { d: 't\u001f' } }), { a: 'xy', b: ['z', 1], c: { d: 't' } }, 'lots : les caractères de contrôle sont retirés partout');
  eq(nettoyerChaines('é\n'), 'é\n', 'lots : les sauts de ligne et les accents restent');
  eq(tailleJson({ a: 'é' }), 10, 'lots : taille en octets UTF-8 du JSON');
  eq(LIMITES, { elements: 500, lot: 1048576, element: 524288 }, 'lots : bornes de la spec (§ 3.4, R14)');

  const entrees = [
    { seq: 1, store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:00:00Z', tries: 0 },
    { seq: 2, store: 'books', id: 'b2', op: 'delete', updated_at: '2026-10-13T10:01:00Z', payload: { id: 'b2', title: 'X', updated_at: '2026-10-13T10:01:00Z' }, tries: 0 },
    { seq: 3, store: 'books', id: 'b1', op: 'put', updated_at: '2026-10-13T10:02:00Z', tries: 0 },
    { seq: 4, store: 'files', id: 'f'.repeat(64), op: 'put', updated_at: '2026-10-13T10:03:00Z', tries: 0 },
    { seq: 5, store: 'books', id: 'b3', op: 'put', updated_at: '2026-10-13T10:04:00Z', tries: 0 },
  ];
  const d = dedoublonner(entrees);
  eq(d.map((x) => [x.cle, x.entree.seq, x.seqs]), [['books:b1', 3, [1, 3]], ['books:b2', 2, [2]], ['files:' + 'f'.repeat(64), 4, [4]], ['books:b3', 5, [5]]], 'lots : une clé par (store, id), la plus récente gardée, tous les seq retenus');

  const fiches = { 'books:b1': { id: 'b1', title: 'Un\u0000', updated_at: '2026-10-13T10:02:00Z' } };
  const relire = async (store, id) => fiches[store + ':' + id];
  const c = await composerLots(entrees, relire);
  eq(c.lots.length, 1, 'lots : un seul lot pour quatre éléments');
  eq(c.lots[0].elements.map((e) => [e.store, e.id, e.deleted]), [['books', 'b1', false], ['books', 'b2', true], ['books', 'b3', true]], 'lots : put relu, delete avec payload, put disparu → delete');
  eq(c.lots[0].elements[0].data.title, 'Un', 'lots : la fiche relue est nettoyée');
  eq(c.lots[0].elements[1].data.title, 'X', 'lots : le payload d’une suppression part avec elle');
  eq(c.lots[0].elements[2].data, null, 'lots : un put dont la fiche a disparu sans payload part comme tombale sans data');
  eq(c.lots[0].seqs, [1, 3, 2, 5], 'lots : les seq de chaque clé suivent le lot');
  eq(c.retenues, [{ seq: 4, raison: 'fichier en attente' }], 'lots : une ligne files est retenue tant que l’empreinte distante n’est pas confirmée (L4)');

  const gros = Array.from({ length: 1200 }, (_, i) => ({ seq: i + 1, store: 'books', id: 'g' + i, op: 'put', updated_at: '2026-10-13T10:00:00Z', tries: 0 }));
  const cg = await composerLots(gros, async (s, id) => ({ id, updated_at: '2026-10-13T10:00:00Z' }));
  eq(cg.lots.map((l) => l.elements.length), [500, 500, 200], 'lots : 500 éléments au plus par lot, dans l’ordre');
  const lourd = [{ seq: 1, store: 'books', id: 'l1', op: 'put', updated_at: 't', tries: 0 }, { seq: 2, store: 'books', id: 'l2', op: 'put', updated_at: 't', tries: 0 }];
  const cl = await composerLots(lourd, async (s, id) => ({ id, updated_at: '2026-10-13T10:00:00Z', texte: 'x'.repeat(600000) }));
  eq(cl.lots.map((l) => l.elements.length), [1, 1], 'lots : une fiche de plus de 512 Ko part seule (le serveur la refuse pour sa taille, nommée)');
  const moyens = Array.from({ length: 3 }, (_, i) => ({ seq: i + 1, store: 'books', id: 'm' + i, op: 'put', updated_at: 't', tries: 0 }));
  const cm = await composerLots(moyens, async (s, id) => ({ id, updated_at: '2026-10-13T10:00:00Z', texte: 'x'.repeat(450000) }));
  eq(cm.lots.map((l) => l.elements.length), [2, 1], 'lots : la borne de 1 Mo par lot coupe avant 500 éléments');
  eq(cl.lots[0].elements[0].updated_at, '2026-10-13T10:00:00Z', 'lots : updated_at de l’élément = celui de la fiche relue');
```

- [ ] **Step 2 : rouge** — `?v=l3-t2-rouge` (import en échec).

- [ ] **Step 3 : implémentation `src/sync/lots.js`**

```js
// Composition des lots d'envoi (spec § 5.3) : pur, sans base ni réseau. L'ordre est celui de la file (seq), chaque
// (store, id) part une fois (la version la plus récente), un put est RELU au moment de l'envoi (la file ne garde
// pas la fiche), une suppression part avec son payload. Bornes du serveur (§ 3.4, R14) appliquées ici pour que le
// serveur n'ait jamais à refuser un lot entier pour sa taille.
export const LIMITES = { elements: 500, lot: 1048576, element: 524288 };
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const encodeur = new TextEncoder();

// PostgreSQL refuse \u0000 dans un jsonb ; les autres caractères de contrôle ne portent aucun sens dans une fiche.
export function nettoyerChaines(valeur) {
  if (typeof valeur === 'string') return valeur.replace(CONTROLE, '');
  if (Array.isArray(valeur)) return valeur.map(nettoyerChaines);
  if (valeur && typeof valeur === 'object' && !(valeur instanceof Blob)) {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) sortie[k] = nettoyerChaines(v);
    return sortie;
  }
  return valeur;
}

export const tailleJson = (valeur) => encodeur.encode(JSON.stringify(valeur)).length;

const cleDe = (e) => `${e.store}:${e.id}`;

// Une clé par (store, id) : l'entrée la plus récente (seq le plus haut) représente la clé, tous les seq la suivent
// pour être retirés ensemble à l'accusé. L'ordre des clés est celui de leur PREMIÈRE apparition dans la file.
export function dedoublonner(entrees) {
  const parCle = new Map();
  for (const e of [...entrees].sort((a, b) => a.seq - b.seq)) {
    const cle = cleDe(e);
    const actuel = parCle.get(cle);
    if (!actuel) parCle.set(cle, { cle, entree: e, seqs: [e.seq] });
    else { actuel.seqs.push(e.seq); if (e.seq > actuel.entree.seq) actuel.entree = e; }
  }
  return [...parCle.values()];
}

// Une entrée → un élément de sync_push, ou une retenue (ligne files : L4 confirme l'empreinte avant l'envoi).
async function elementDe(entree, relire) {
  if (entree.store === 'files') return { retenue: { seq: entree.seq, raison: 'fichier en attente' } };
  if (entree.op === 'delete') {
    const data = entree.payload ? nettoyerChaines(entree.payload) : null;
    return { element: { store: entree.store, id: entree.id, data, updated_at: data?.updated_at || entree.updated_at, deleted: true } };
  }
  const fiche = await relire(entree.store, entree.id);
  if (fiche === undefined || fiche === null) {
    // Disparue entre la capture et l'envoi : elle est partie, on le dit au serveur avec ce qu'on sait.
    const data = entree.payload ? nettoyerChaines(entree.payload) : null;
    return { element: { store: entree.store, id: entree.id, data, updated_at: data?.updated_at || entree.updated_at, deleted: true } };
  }
  const data = nettoyerChaines(fiche);
  return { element: { store: entree.store, id: entree.id, data, updated_at: data.updated_at || entree.updated_at, deleted: false } };
}

export async function composerLots(entrees, relire) {
  const lots = [];
  const retenues = [];
  let courant = { elements: [], seqs: [], octets: 2 }; // « [] »
  const fermer = () => { if (courant.elements.length) lots.push({ elements: courant.elements, seqs: courant.seqs }); courant = { elements: [], seqs: [], octets: 2 }; };
  for (const { entree, seqs } of dedoublonner(entrees)) {
    const r = await elementDe(entree, relire);
    if (r.retenue) { retenues.push(r.retenue); continue; }
    const taille = tailleJson(r.element) + 1;
    const seul = tailleJson(r.element.data ?? {}) > LIMITES.element;
    if (seul) { fermer(); lots.push({ elements: [r.element], seqs }); continue; }
    if (courant.elements.length >= LIMITES.elements || courant.octets + taille > LIMITES.lot) fermer();
    courant.elements.push(r.element); courant.seqs.push(...seqs); courant.octets += taille;
  }
  fermer();
  return { lots, retenues };
}
```

- [ ] **Step 4 : vert** — `?v=l3-t2-vert`. `nettoyerChaines` ne touche pas aux `Blob` (une fiche `files` relue n'arrive jamais ici, mais la garde coûte une ligne).

- [ ] **Step 5 : commit** — `git add src/sync/lots.js tests/sync-l3.js && git commit -m "L3 T2 : composition des lots (ordre, dedoublonnage, relecture, bornes 500 / 1 Mo / 512 Ko, fichiers retenus)"`

---

### Task 3 : réponses du serveur, horloge, envoi d'une passe (chemin heureux)

**Files :**
- Create : `src/sync/reponses.js`, `src/sync/push.js`
- Modify : `src/sync/clock.js` (ajouter `appliquerHeureServeur`)
- Test : `tests/sync-l3.js` (blocs `// --- Réponses (spec § 5.3)` et `// --- Envoi : une passe (spec § 5.3)`)

**Interfaces :**
- Consumes : `composerLots`, `createTransport`/factice, `db.mutate`, `db.getAll('outbox')`, `db.get(store, id)`, `clock.js`.
- Produces : `appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales })` → `{ retirer: seq[], reecrire: { [store]: fiche[] }, conflits: Conflit[], quarantaine: [{ seq, motif }] }` ; `appliquerHeureServeur(iso, localMs = Date.now())` → `{ decalageMs, avertir: boolean, minutes }` (`clock.js`) ; `createPush({ db, transport, maintenant = Date.now, surHeure = () => {} })` → `{ envoyer() → Promise<{ envoyes, ajustes, conflits, quarantaine, retenues, erreur: Erreur|null, pause: boolean, attenteConnexion: boolean }> }`.

- [ ] **Step 1 : tests rouges**

```js
  // --- Réponses (spec § 5.3) : accepted → retrait ; adjusted → retrait + réécriture non capturée ; rejected par motif
  const { appliquerReponse } = await import('../src/sync/reponses.js');
  const lot = { elements: [
    { store: 'books', id: 'a', data: { id: 'a', updated_at: 'ta' }, updated_at: 'ta', deleted: false },
    { store: 'books', id: 'b', data: { id: 'b', updated_at: 'tb' }, updated_at: 'tb', deleted: false },
    { store: 'books', id: 'c', data: { id: 'c', updated_at: 'tc' }, updated_at: 'tc', deleted: false },
    { store: 'books', id: 'd', data: { id: 'd', updated_at: 'td' }, updated_at: 'td', deleted: false },
    { store: 'books', id: 'e', data: { id: 'e', updated_at: 'te' }, updated_at: 'te', deleted: true },
  ], seqs: [1, 2, 3, 4, 5] };
  const entreesParSeq = new Map([[1, { seq: 1, store: 'books', id: 'a' }], [2, { seq: 2, store: 'books', id: 'b' }], [3, { seq: 3, store: 'books', id: 'c' }], [4, { seq: 4, store: 'books', id: 'd' }], [5, { seq: 5, store: 'books', id: 'e', op: 'delete', payload: { id: 'e' } }]]);
  const reponse = { server_time: '2026-10-13T20:00:00Z', accepted: [{ store: 'books', id: 'a' }, { store: 'books', id: 'e' }], adjusted: [{ store: 'books', id: 'b', updated_at: '2026-10-13T20:00:00+00:00' }], rejected: [{ store: 'books', id: 'c', reason: 'conflit', server: { data: { id: 'c', titre: 'serveur' }, updated_at: '2026-10-14T00:00:00Z', deleted_at: null } }, { store: 'books', id: 'd', reason: 'taille' }] };
  const effets = appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales: { 'books:c': { id: 'c', titre: 'ici', updated_at: 'tc' } } });
  eq(effets.retirer.sort(), [1, 2, 3, 5], 'réponses : accepted, adjusted et conflit retirés de la file ; la quarantaine reste');
  eq(effets.reecrire, { books: [{ id: 'b', updated_at: '2026-10-13T20:00:00+00:00' }] }, 'réponses : adjusted → fiche réécrite avec EXACTEMENT le updated_at renvoyé');
  eq(effets.conflits.map((c) => [c.id, c.store, c.record_id, c.local.titre, c.server.data.titre, c.kind]), [['books:c', 'books', 'c', 'ici', 'serveur', 'donnees']], 'réponses : rejected{conflit} → conflit journalisé avec les deux versions');
  eq(effets.quarantaine, [{ seq: 4, motif: 'taille' }], 'réponses : rejected{taille} → quarantaine immédiate avec motif');
  const inconnu = appliquerReponse({ lot: { elements: [], seqs: [] }, reponse: { server_time: 't', accepted: [{ store: 'books', id: 'zz' }], adjusted: [], rejected: [] }, entreesParSeq: new Map(), fichesLocales: {} });
  eq(inconnu.retirer, [], 'réponses : un accusé pour une clé hors du lot ne retire rien');

  // --- Horloge (spec § 5.3) : décalage mesuré à chaque réponse, plancher, avertissement unique au-delà de 5 min
  const { appliquerHeureServeur, getClockOffset, syncNow, setClockOffset } = await import('../src/sync/clock.js');
  try {
    const h1 = appliquerHeureServeur('2026-10-13T20:00:00Z', Date.parse('2026-10-13T19:50:00Z'));
    eq([h1.decalageMs, h1.avertir, h1.minutes], [600000, true, 10], 'horloge : décalage de 10 min mesuré, avertissement');
    eq(getClockOffset(), 600000, 'horloge : le décalage est appliqué à syncNow');
    const h2 = appliquerHeureServeur('2026-10-13T20:00:01Z', Date.parse('2026-10-13T19:59:59Z'));
    eq([h2.decalageMs, h2.avertir], [2000, false], 'horloge : 2 s de décalage, pas d’avertissement');
    ok(syncNow() >= '2026-10-13T20:00:01.000Z', 'horloge : syncNow ne descend jamais sous le dernier server_time vu');
  } finally { setClockOffset(0); }

  // --- Envoi : une passe (spec § 5.3) — chemin heureux sur une base temporaire
  const { createPush } = await import('../src/sync/push.js');
  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'b1', title: 'Un' });
    await repo.save('books', { id: 'b2', title: 'Deux' });
    await repo.remove('books', 'b2');
    eq(await db.count('outbox'), 3, 'envoi : trois entrées capturées (put, put, delete)');
    const tf = creerTransportFactice();
    let heures = [];
    const push = createPush({ db, transport: tf, surHeure: (h) => heures.push(h) });
    const r = await push.envoyer();
    eq([r.envoyes, r.conflits, r.quarantaine, r.erreur], [2, 0, 0, null], 'envoi : deux clés envoyées (b1 put, b2 delete), aucun conflit');
    eq(await db.count('outbox'), 0, 'envoi : la file est vide après l’accusé (I5 : envoyé = accusé)');
    eq(tf.journal[0].rows.map((e) => [e.store, e.id, e.deleted]), [['books', 'b1', false], ['books', 'b2', true]], 'envoi : le lot envoyé est dédoublonné et ordonné');
    ok(heures.length === 1 && typeof heures[0].decalageMs === 'number', 'envoi : l’heure du serveur est appliquée à chaque réponse');
    eq((await push.envoyer()).envoyes, 0, 'envoi : file vide → aucun appel');
    eq(tf.journal.length, 1, 'envoi : file vide → aucun appel réseau');
  });
```

Note : `withRepo` et `creerTransportFactice` sont importés en tête de `tests/sync-l3.js` (`import { withRepo } from './sync-fixture.js';`).

- [ ] **Step 2 : rouge** — `?v=l3-t3-rouge`.

- [ ] **Step 3 : implémentation**

`src/sync/clock.js`, ajouter :

```js
// Décalage mesuré à chaque réponse du serveur (spec § 5.3) : syncNow() = local + décalage, et jamais sous la
// dernière heure serveur vue. Au-delà de 5 minutes, l'appelant avertit UNE fois (clock_warned_at, moteur).
export function appliquerHeureServeur(serverIso, localMs = Date.now()) {
  const serverMs = Date.parse(serverIso);
  if (!Number.isFinite(serverMs)) return { decalageMs: offsetMs, avertir: false, minutes: 0 };
  offsetMs = serverMs - localMs;
  if (!floorIso || serverIso > floorIso) floorIso = new Date(serverMs).toISOString();
  const minutes = Math.round(Math.abs(offsetMs) / 60000);
  return { decalageMs: offsetMs, avertir: Math.abs(offsetMs) > 5 * 60000, minutes };
}
```

(`floorIso` existe déjà dans `clock.js` ; vérifier que `syncNow()` compare bien à `floorIso` avant de rendre.)

`src/sync/reponses.js` :

```js
// Une réponse de sync_push → des effets, sans toucher à la base (spec § 5.3). Le moteur applique les effets en
// UNE transaction. Clés par (store, id) ; un accusé pour une clé hors du lot est ignoré (jamais de retrait aveugle).
const cle = (x) => `${x.store}:${x.id}`;

export function appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales = {} }) {
  const seqsParCle = new Map();
  for (const seq of lot.seqs) {
    const e = entreesParSeq.get(seq);
    if (!e) continue;
    const k = cle(e);
    if (!seqsParCle.has(k)) seqsParCle.set(k, []);
    seqsParCle.get(k).push(seq);
  }
  const retirer = [];
  const reecrire = {};
  const conflits = [];
  const quarantaine = [];
  const at = reponse.server_time || new Date().toISOString();
  for (const a of reponse.accepted || []) for (const s of seqsParCle.get(cle(a)) || []) retirer.push(s);
  for (const a of reponse.adjusted || []) {
    const k = cle(a);
    for (const s of seqsParCle.get(k) || []) retirer.push(s);
    const element = lot.elements.find((e) => cle(e) === k);
    if (element && element.data && !element.deleted) {
      (reecrire[a.store] ||= []).push({ ...element.data, updated_at: a.updated_at });
    }
  }
  for (const r of reponse.rejected || []) {
    const k = cle(r);
    const seqs = seqsParCle.get(k) || [];
    if (r.reason === 'conflit') {
      for (const s of seqs) retirer.push(s);
      conflits.push({ id: k, store: r.store, record_id: r.id, local: fichesLocales[k] ?? null, server: r.server || null, at, kind: 'donnees' });
    } else {
      // updated_at | cle | forme | taille (R9) : permanent, la fiche est nommée, la personne décide (Réglages).
      const seq = seqs.length ? Math.max(...seqs) : null;
      if (seq !== null) quarantaine.push({ seq, motif: String(r.reason || 'forme') });
      for (const s of seqs) if (s !== seq) retirer.push(s); // les doublons plus anciens de la même clé partent
    }
  }
  return { retirer, reecrire, conflits, quarantaine };
}
```

`src/sync/push.js` (chemin heureux ; les erreurs viennent en T4) :

```js
// Envoi d'une passe (spec § 5.3) : la file est lue, dédoublonnée, relue, envoyée par lots ; chaque réponse est
// appliquée en UNE transaction (retraits, réécritures non capturées, conflits, quarantaine). I5 : une fiche n'est
// « envoyée » que par l'absence d'entrée la concernant.
import { composerLots } from './lots.js';
import { appliquerReponse } from './reponses.js';
import { appliquerHeureServeur } from './clock.js';
import { logError } from '../core/log.js';

const cle = (x) => `${x.store}:${x.id}`;

export function createPush({ db, transport, maintenant = Date.now, surHeure = () => {} }) {
  async function lireFile() {
    const toutes = await db.getAll('outbox');
    // Les entrées en quarantaine attendent un geste ; celles dont l'heure de reprise n'est pas venue attendent.
    return toutes.filter((e) => !e.quarantined_at && (!e.next_try_at || Date.parse(e.next_try_at) <= maintenant())).sort((a, b) => a.seq - b.seq);
  }

  async function appliquer(lot, reponse, entreesParSeq) {
    const fichesLocales = {};
    for (const e of lot.elements) fichesLocales[cle(e)] = (await db.get(e.store, e.id)) ?? null;
    const effets = appliquerReponse({ lot, reponse, entreesParSeq, fichesLocales });
    const puts = { ...effets.reecrire };
    if (effets.conflits.length) puts.sync_conflicts = effets.conflits;
    if (effets.quarantaine.length) {
      puts.outbox = effets.quarantaine.map(({ seq, motif }) => ({ ...entreesParSeq.get(seq), quarantined_at: new Date(maintenant()).toISOString(), last_error: motif }));
    }
    // origin 'remote' : rien de ceci ne repart vers le serveur (réécriture d'un ajustement, journal, quarantaine).
    await db.mutate({ puts, deletes: effets.retirer.length ? { outbox: effets.retirer } : {}, origin: 'remote' });
    return effets;
  }

  async function envoyer() {
    const bilan = { envoyes: 0, ajustes: 0, conflits: 0, quarantaine: 0, retenues: 0, erreur: null, pause: false, attenteConnexion: false };
    const file = await lireFile();
    if (!file.length) return bilan;
    const entreesParSeq = new Map(file.map((e) => [e.seq, e]));
    const { lots, retenues } = await composerLots(file, (store, id) => db.get(store, id));
    bilan.retenues = retenues.length;
    for (const lot of lots) {
      const { reponse, erreur } = await transport.pousser(lot.elements);
      if (erreur) { bilan.erreur = erreur; logError('sync.push', { type: erreur.type, status: erreur.status }); break; }
      if (reponse?.server_time) surHeure(appliquerHeureServeur(reponse.server_time, maintenant()));
      const effets = await appliquer(lot, reponse, entreesParSeq);
      bilan.envoyes += (reponse.accepted || []).length;
      bilan.ajustes += (reponse.adjusted || []).length;
      bilan.conflits += effets.conflits.length;
      bilan.quarantaine += effets.quarantaine.length;
    }
    return bilan;
  }

  return { envoyer };
}
```

- [ ] **Step 4 : vert** — `?v=l3-t3-vert`. Vérifier que le test statique « aucune écriture directe » reste vert (push.js est sous `src/sync/`, exempté par la spec § 5.2).

- [ ] **Step 5 : commit** — `git add src/sync/reponses.js src/sync/push.js src/sync/clock.js tests/sync-l3.js && git commit -m "L3 T3 : reponses de sync_push appliquees en une transaction, horloge serveur, envoi d une passe"`

---

### Task 4 : envoi — recul, attente de connexion, pause quota, dichotomie

**Files :**
- Modify : `src/sync/push.js`
- Test : `tests/sync-l3.js` (bloc `// --- Envoi : erreurs (spec § 5.3)`)

**Interfaces :**
- Produces : `createPush` inchangé en signature ; le bilan gagne `recul: number|null` (ms avant la prochaine tentative) ; entrées d'outbox : `tries`, `next_try_at`, `last_error`, `quarantined_at` écrits par la passe ; `reculMs(tries)` exporté (2 s, 4 s, 8 s … plafond 300 000 ms) ; `sync_state.pause = { raison: 'quota', at }` écrit en pause.

- [ ] **Step 1 : tests rouges**

```js
  // --- Envoi : erreurs (spec § 5.3) — recul, 401, quota, dichotomie, refus d’adresse
  const { reculMs } = await import('../src/sync/push.js');
  eq([reculMs(0), reculMs(1), reculMs(2), reculMs(10)], [2000, 4000, 8000, 300000], 'envoi : recul 2 s, 4 s, 8 s … plafond 5 min');
  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'r1', title: 'Un' });
    const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'reseau', status: 503, message: 'x' } }, { erreur: { type: 'reseau', status: 0, message: 'x' } }] });
    let t = Date.parse('2026-10-13T20:00:00Z');
    const push = createPush({ db, transport: tf, maintenant: () => t });
    const r1 = await push.envoyer();
    eq([r1.erreur.type, r1.recul], ['reseau', 2000], 'envoi : échec réseau → recul de 2 s annoncé');
    const e1 = (await db.getAll('outbox'))[0];
    eq([e1.tries, e1.next_try_at], [1, new Date(t + 2000).toISOString()], 'envoi : l’entrée compte l’essai et son heure de reprise');
    eq((await push.envoyer()).erreur, null, 'envoi : avant l’heure de reprise, rien n’est tenté');
    eq(tf.journal.length, 1, 'envoi : aucun appel avant l’heure de reprise');
    t += 2000;
    const r2 = await push.envoyer();
    eq([r2.erreur.type, r2.recul], ['reseau', 4000], 'envoi : deuxième échec → recul doublé');
    eq((await db.getAll('outbox'))[0].tries, 2, 'envoi : deux essais comptés');
  });
  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'a1', title: 'Un' });
    const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'auth', status: 401, message: 'x' } }] });
    const r = await createPush({ db, transport: tf }).envoyer();
    eq([r.attenteConnexion, r.erreur.type, (await db.getAll('outbox'))[0].tries], [true, 'auth', 0], 'envoi : 401 → en attente de connexion, sans compter d’essai');
  });
  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'q1', title: 'Un' });
    const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'quota', status: 507, message: 'x' } }] });
    const r = await createPush({ db, transport: tf }).envoyer();
    eq(r.pause, true, 'envoi : refus de quota → pause');
    eq((await db.get('sync_state', 'pause'))?.value?.raison, 'quota', 'envoi : la pause est écrite dans sync_state');
    eq(await db.count('outbox'), 1, 'envoi : rien n’est perdu en pause');
  });
  await withRepo(async (repo, db) => {
    for (const id of ['d1', 'd2', 'd3', 'd4']) await repo.save('books', { id, title: id });
    // Le serveur refuse tout lot contenant d3 (règle simulée) ; la dichotomie doit l’isoler et envoyer les autres.
    const refus = { erreur: { type: 'refus', status: 400, message: 'regle simulee' } };
    const tf = { journal: [], async pousser(rows) { tf.journal.push(rows.map((r) => r.id)); if (rows.some((r) => r.id === 'd3')) return { reponse: null, erreur: refus.erreur }; return { reponse: { server_time: '2026-10-13T20:00:00Z', accepted: rows.map(({ store, id }) => ({ store, id })), adjusted: [], rejected: [] }, erreur: null }; }, async lire() { return { lignes: [], erreur: null }; } };
    const r = await createPush({ db, transport: tf }).envoyer();
    eq([r.envoyes, r.quarantaine], [3, 1], 'envoi : dichotomie → trois envoyées, une en quarantaine');
    const reste = await db.getAll('outbox');
    eq(reste.map((e) => [e.id, e.last_error, !!e.quarantined_at]), [['d3', 'refus', true]], 'envoi : l’entrée fautive est en quarantaine avec le motif « refus »');
    ok(tf.journal.length >= 3 && tf.journal[0].length === 4, 'envoi : le lot entier d’abord, puis des moitiés');
  });
  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'n1', title: 'Un' });
    const tf = creerTransportFactice({ pousser: [{ erreur: { type: 'auth', status: 400, message: 'adresse non autorisée' } }] });
    const r = await createPush({ db, transport: tf }).envoyer();
    eq(r.attenteConnexion, true, 'envoi : « adresse non autorisée » → attente (la garde est refaite par le moteur), rien n’est perdu');
  });
```

- [ ] **Step 2 : rouge** — `?v=l3-t4-rouge`.

- [ ] **Step 3 : implémentation (compléter `src/sync/push.js`)**

```js
export const reculMs = (tries) => Math.min(2000 * 2 ** Math.max(0, tries), 300000);

// Dans createPush : remplacer la boucle `for (const lot of lots)` par un envoi avec dichotomie.
async function envoyerLot(lot, entreesParSeq, bilan) {
  const { reponse, erreur } = await transport.pousser(lot.elements);
  if (!erreur) {
    if (reponse?.server_time) surHeure(appliquerHeureServeur(reponse.server_time, maintenant()));
    const effets = await appliquer(lot, reponse, entreesParSeq);
    bilan.envoyes += (reponse.accepted || []).length;
    bilan.ajustes += (reponse.adjusted || []).length;
    bilan.conflits += effets.conflits.length;
    bilan.quarantaine += effets.quarantaine.length;
    return true;
  }
  logError('sync.push', { type: erreur.type, status: erreur.status });
  if (erreur.type === 'reseau') {
    // Réseau, 5xx, 429 : réessai plus tard. Les entrées du lot comptent l'essai et portent leur heure de reprise.
    await reporter(lot.seqs, entreesParSeq, erreur);
    bilan.erreur = erreur; bilan.recul = reculMs(Math.max(...lot.seqs.map((s) => entreesParSeq.get(s)?.tries || 0)));
    return false;
  }
  if (erreur.type === 'auth') { bilan.erreur = erreur; bilan.attenteConnexion = true; return false; }
  if (erreur.type === 'quota') {
    await db.mutate({ puts: { sync_state: [{ key: 'pause', value: { raison: 'quota', at: new Date(maintenant()).toISOString() } }] }, origin: 'remote' });
    bilan.erreur = erreur; bilan.pause = true; return false;
  }
  // refus (ou inconnu) : le serveur refuse le lot ENTIER. Dichotomie jusqu'à isoler l'élément fautif.
  if (lot.elements.length === 1) {
    const seq = Math.max(...lot.seqs);
    const entree = entreesParSeq.get(seq);
    await db.mutate({ puts: { outbox: [{ ...entree, quarantined_at: new Date(maintenant()).toISOString(), last_error: 'refus' }] }, deletes: { outbox: lot.seqs.filter((s) => s !== seq) }, origin: 'remote' });
    bilan.quarantaine += 1;
    return true;
  }
  const milieu = Math.ceil(lot.elements.length / 2);
  const seqsDe = (elements) => lot.seqs.filter((s) => { const e = entreesParSeq.get(s); return elements.some((x) => x.store === e.store && x.id === e.id); });
  const gauche = lot.elements.slice(0, milieu), droite = lot.elements.slice(milieu);
  const okG = await envoyerLot({ elements: gauche, seqs: seqsDe(gauche) }, entreesParSeq, bilan);
  if (!okG && (bilan.attenteConnexion || bilan.pause || bilan.erreur?.type === 'reseau')) return false;
  return envoyerLot({ elements: droite, seqs: seqsDe(droite) }, entreesParSeq, bilan);
}

async function reporter(seqs, entreesParSeq, erreur) {
  const puts = seqs.map((s) => { const e = entreesParSeq.get(s); const tries = (e.tries || 0) + 1; return { ...e, tries, next_try_at: new Date(maintenant() + reculMs(tries - 1)).toISOString(), last_error: erreur.type }; });
  await db.mutate({ puts: { outbox: puts }, origin: 'remote' });
}
```

Dans `envoyer()` : `bilan.recul = null` au départ ; `for (const lot of lots) { const continuer = await envoyerLot(lot, entreesParSeq, bilan); if (!continuer) break; }`. Le type `inconnu` suit le chemin « refus » (prudence : la fiche est nommée, la personne décide).

- [ ] **Step 4 : vert** — `?v=l3-t4-vert`.

- [ ] **Step 5 : commit** — `git add src/sync/push.js tests/sync-l3.js && git commit -m "L3 T4 : recul exponentiel, attente de connexion, pause quota, dichotomie sur refus"`

---

### Task 5 : envoi initial par marqueurs

**Files :**
- Create : `src/sync/backfill.js`
- Test : `tests/sync-l3.js` (bloc `// --- Envoi initial par marqueurs (spec § 5.2)`)

**Interfaces :**
- Consumes : `SYNC_STORES`, `keyOf`, `isAllowed` (mime), `db.getAll`, `db.mutate`.
- Produces : `tablesAEnvoyer({ marqueurs, isActivitySynced })` → `string[]` (pur) ; `envoiInitial({ db, getUserId, isActivitySynced, surProgression = () => {}, tailleMorceau = 500 })` → `Promise<{ tables: string[], mises: number }>` ; marqueur `sync_state['backfill:<table>'] = 'fait'` ; `retirerMarqueur(db, table)`.

- [ ] **Step 1 : tests rouges**

```js
  // --- Envoi initial par marqueurs (spec § 5.2) : complet, reprenable, déclenché sur un appareil déjà connecté
  const { tablesAEnvoyer, envoiInitial, retirerMarqueur } = await import('../src/sync/backfill.js');
  const { SYNC_STORES } = await import('../src/model/schema.js');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => false }).length, 24, 'envoi initial : 24 tables sans l’historique');
  eq(tablesAEnvoyer({ marqueurs: {}, isActivitySynced: () => true }).length, 25, 'envoi initial : 25 tables avec l’historique');
  eq(tablesAEnvoyer({ marqueurs: { 'backfill:books': 'fait' }, isActivitySynced: () => false }).includes('books'), false, 'envoi initial : une table marquée « fait » ne repart pas');
  await withRepo(async (repo, db) => {
    // Bibliothèque d’AVANT la connexion : écrite sans capture (comme en L1, ou restaurée), puis compte connecté.
    await db.mutate({ puts: { books: [{ id: 'v1', title: 'Vieux', updated_at: '2026-10-01T00:00:00Z' }, { id: 'v2', title: 'Vieux 2', updated_at: '2026-10-01T00:00:00Z' }], files: [{ sha256: 'a'.repeat(64), mime: 'image/jpeg', size: 1, updated_at: '2026-10-01T00:00:00Z', syncable: true }, { sha256: 'b'.repeat(64), mime: 'application/octet-stream', size: 1, updated_at: '2026-10-01T00:00:00Z', syncable: false }] }, origin: 'device' });
    eq(await db.count('outbox'), 0, 'envoi initial : rien en file avant');
    const progression = [];
    const r = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false, surProgression: (p) => progression.push(p), tailleMorceau: 1 });
    eq(r.tables.length, 24, 'envoi initial : les 24 tables sont parcourues');
    const file = await db.getAll('outbox');
    const refs = 64 + 27 + 5; // amorçage : ingredients, unit_definitions, unit_conventions
    eq(file.length, refs + 2 + 1, 'envoi initial : références amorcées + 2 livres + 1 fichier synchronisable en file');
    ok(file.every((e) => e.op === 'put' && e.user_id === 'u1'), 'envoi initial : des put, au nom du compte');
    ok(!file.some((e) => e.store === 'files' && e.id === 'b'.repeat(64)), 'envoi initial : une ligne files syncable:false n’est jamais mise en file');
    eq((await db.get('sync_state', 'backfill:books'))?.value, 'fait', 'envoi initial : marqueur posé après la table');
    ok(progression.some((p) => p.table === 'books' && p.n >= 1 && p.total === 24), 'envoi initial : progression « table n/24 »');
    const r2 = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false });
    eq([r2.mises, await db.count('outbox')], [0, refs + 3], 'envoi initial : rejoué → rien de plus (marqueurs)');
    await retirerMarqueur(db, 'books');
    const r3 = await envoiInitial({ db, getUserId: () => 'u1', isActivitySynced: () => false });
    eq(r3.tables, ['books'], 'envoi initial : marqueur retiré → seule cette table repart (rattrapage, R27)');
  });
```

- [ ] **Step 2 : rouge** — `?v=l3-t5-rouge`.

- [ ] **Step 3 : implémentation `src/sync/backfill.js`**

```js
// Envoi initial (spec § 5.2) : tout ce qui existait AVANT la connexion est mis en file, table par table, commandé
// par des marqueurs — pas par user_id. Reprenable : une table interrompue est rejouée en entier (le dédoublonnage de
// l'envoi absorbe les doublons) ; le marqueur part dans la MÊME transaction que le dernier morceau.
import { SYNC_STORES } from '../model/schema.js';
import { keyOf } from './tables.js';
import { isAllowed } from './mime.js';

const MARQUEUR = (table) => `backfill:${table}`;

export function tablesAEnvoyer({ marqueurs = {}, isActivitySynced = () => false }) {
  return SYNC_STORES.filter((t) => (t !== 'library_activity' || isActivitySynced()) && marqueurs[MARQUEUR(t)] !== 'fait');
}

const synchronisable = (table, row) => table !== 'files' || (row?.syncable !== false && isAllowed(row?.mime));

export async function lireMarqueurs(db) {
  const lignes = await db.getAll('sync_state');
  return Object.fromEntries(lignes.filter((l) => String(l.key).startsWith('backfill:')).map((l) => [l.key, l.value]));
}

export async function retirerMarqueur(db, table) {
  await db.mutate({ deletes: { sync_state: [MARQUEUR(table)] }, origin: 'device' });
}

export async function envoiInitial({ db, getUserId, isActivitySynced = () => false, surProgression = () => {}, tailleMorceau = 500 }) {
  const tables = tablesAEnvoyer({ marqueurs: await lireMarqueurs(db), isActivitySynced });
  const total = SYNC_STORES.length - (isActivitySynced() ? 0 : 1);
  let mises = 0;
  const user_id = getUserId();
  for (const [i, table] of tables.entries()) {
    surProgression({ phase: 'envoi_initial', table, n: i + 1, total });
    const lignes = (await db.getAll(table)).filter((r) => synchronisable(table, r));
    for (let debut = 0; debut < Math.max(lignes.length, 1); debut += tailleMorceau) {
      const morceau = lignes.slice(debut, debut + tailleMorceau);
      const dernier = debut + tailleMorceau >= lignes.length;
      const puts = { outbox: morceau.map((r) => ({ user_id, store: table, id: keyOf(table, r), op: 'put', updated_at: r.updated_at || null, tries: 0 })) };
      if (!puts.outbox.length) delete puts.outbox;
      if (dernier) puts.sync_state = [{ key: MARQUEUR(table), value: 'fait' }];
      await db.mutate({ puts, origin: 'device' });
      mises += morceau.length;
    }
  }
  return { tables, mises };
}
```

- [ ] **Step 4 : vert** — `?v=l3-t5-vert`. (Les 96 références amorcées partent aussi : c'est voulu — § 5.2, R26.)

- [ ] **Step 5 : commit** — `git add src/sync/backfill.js tests/sync-l3.js && git commit -m "L3 T5 : envoi initial par marqueurs, par morceaux, reprenable"`

---

### Task 6 : réception, décision I7, conflits, curseur atomique

**Files :**
- Create : `src/sync/pull.js`, `src/sync/conflits.js`
- Test : `tests/sync-l3.js` (blocs `// --- Réception (spec § 5.5)` et `// --- Conflits : gestes (spec § 5.5)`)

**Interfaces :**
- Consumes : transport `lire`, `db.mutate`, `db.get`, `keyOf`, `syncNow`.
- Produces : `decider({ locale, distante })` → `'supprimer' | 'ecrire' | 'ignorer' | 'conflit_renvoyer' | 'conflit'` (pur) ; `estAncetre(versions, candidatId, cibleId)` (pur) ; `createPull({ db, transport, isActivitySynced, getUserId, surProgression = () => {}, limite = 1000 })` → `{ recevoir() → Promise<{ recues, supprimees, conflits, erreur: Erreur|null }> }` ; `conflits.js` : `garderIci(db, conflit)`, `garderAilleurs(db, conflit)`, `purgerAnciens(db, maintenantMs, joursMax = 30)`.

- [ ] **Step 1 : tests rouges**

```js
  // --- Réception (spec § 5.5) : décision I7, tombale, curseur atomique, conflits, files sans octets, pointeur
  const { decider, estAncetre, createPull } = await import('../src/sync/pull.js');
  const L = (u, extra = {}) => ({ id: 'x', updated_at: u, ...extra });
  eq(decider({ locale: undefined, distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'ecrire', 'réception : absent localement → écrit');
  eq(decider({ locale: L('t1'), distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'ecrire', 'réception : distant plus récent → écrit');
  eq(decider({ locale: L('t3'), distante: { data: L('t2'), updated_at: 't2', deleted_at: null } }), 'conflit_renvoyer', 'réception : local plus récent → conservé, conflit, renvoyé');
  eq(decider({ locale: L('t2', { a: 1 }), distante: { data: L('t2', { a: 1 }), updated_at: 't2', deleted_at: null } }), 'ignorer', 'réception : égalité identique → rien');
  eq(decider({ locale: L('t2', { a: 1 }), distante: { data: L('t2', { a: 2 }), updated_at: 't2', deleted_at: null } }), 'conflit', 'réception : égalité différente → conflit sans remise en file');
  eq(decider({ locale: L('t1'), distante: { data: {}, updated_at: 't2', deleted_at: 't2' } }), 'supprimer', 'réception : tombale → suppression');
  eq(decider({ locale: undefined, distante: { data: {}, updated_at: 't2', deleted_at: 't2' } }), 'ignorer', 'réception : tombale d’une fiche inconnue → rien');
  const versions = [{ id: 'v1', parent_version_id: null }, { id: 'v2', parent_version_id: 'v1' }, { id: 'v3', parent_version_id: 'v2' }, { id: 'w1', parent_version_id: 'v1' }];
  eq([estAncetre(versions, 'v1', 'v3'), estAncetre(versions, 'v2', 'v3'), estAncetre(versions, 'w1', 'v3'), estAncetre(versions, 'v3', 'v3')], [true, true, false, true], 'réception : ancêtre de version (chaîne parent_version_id)');

  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'p1', title: 'Ici plus récent', updated_at: '2026-10-13T12:00:00Z' });
    await repo.save('books', { id: 'p3', title: 'À supprimer', updated_at: '2026-10-13T10:00:00Z' });
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    const page1 = [
      { id: 'p1', data: { id: 'p1', title: 'Ailleurs plus vieux', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 10 },
      { id: 'p2', data: { id: 'p2', title: 'Nouveau', updated_at: '2026-10-13T11:30:00Z' }, updated_at: '2026-10-13T11:30:00Z', deleted_at: null, server_seq: 11 },
    ];
    const page2 = [{ id: 'p3', data: {}, updated_at: '2026-10-13T12:30:00Z', deleted_at: '2026-10-13T12:30:00Z', server_seq: 12 }];
    const tf = creerTransportFactice({ lire: { books: [page1, page2, []] } });
    const pull = createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1', limite: 2 });
    const r = await pull.recevoir();
    eq([r.recues, r.supprimees, r.conflits, r.erreur], [1, 1, 1, null], 'réception : une écrite, une supprimée, un conflit');
    eq((await db.get('books', 'p1')).title, 'Ici plus récent', 'réception : le local plus récent est conservé');
    eq((await db.get('books', 'p2')).title, 'Nouveau', 'réception : la fiche nouvelle est écrite');
    eq(await db.get('books', 'p3'), undefined, 'réception : la tombale supprime localement');
    eq((await db.get('sync_state', 'cursor:books'))?.value, 12, 'réception : le curseur = dernier server_seq écrit');
    const file = await db.getAll('outbox');
    eq(file.map((e) => [e.store, e.id, e.op]), [['books', 'p1', 'put']], 'réception : le local plus récent est remis en file (le serveur l’acceptera) ; la suppression reçue ne repart pas');
    const conflit = await db.get('sync_conflicts', 'books:p1');
    eq([conflit.local.title, conflit.server.data.title, conflit.kind], ['Ici plus récent', 'Ailleurs plus vieux', 'donnees'], 'réception : conflit journalisé avec les deux versions');
    const appels = tf.journal.filter((a) => a.appel === 'lire' && a.table === 'books').map((a) => a.apres);
    eq(appels, [0, 11, 12], 'réception : paginée par le curseur avancé après chaque page écrite');
    ok(!tf.journal.some((a) => a.appel === 'lire' && a.table === 'library_activity'), 'réception : l’historique n’est pas lu sans le réglage');
  });
  await withRepo(async (repo, db) => {
    // Curseur atomique : une page dont l’écriture échoue n’avance pas le curseur.
    const tf = creerTransportFactice({ lire: { books: [[{ id: 'bad', data: { id: 'autre' }, updated_at: 't', deleted_at: null, server_seq: 5 }], []] } });
    const pull = createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' });
    const r = await pull.recevoir();
    ok(r.erreur && r.erreur.type === 'forme', 'réception : une ligne dont data.id ≠ id est refusée (forme), rien d’écrit');
    eq(await db.get('sync_state', 'cursor:books'), undefined, 'réception : le curseur n’a pas avancé');
  });
  await withRepo(async (repo, db) => {
    // files reçue sans octets : ligne écrite remote:true ; une ligne locale qui a déjà le blob le garde.
    const sha = 'c'.repeat(64);
    await repo.putFile(sha, new Blob(['x'], { type: 'image/jpeg' }), { original_filename: 'x.jpg' });
    const tf = creerTransportFactice({ lire: { files: [[{ id: sha, data: { sha256: sha, mime: 'image/jpeg', size: 1, updated_at: '2030-01-01T00:00:00Z' }, updated_at: '2030-01-01T00:00:00Z', deleted_at: null, server_seq: 3 }, { id: 'd'.repeat(64), data: { sha256: 'd'.repeat(64), mime: 'image/png', size: 2, updated_at: '2030-01-01T00:00:00Z' }, updated_at: '2030-01-01T00:00:00Z', deleted_at: null, server_seq: 4 }], []] } });
    await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    ok((await db.get('files', sha)).blob instanceof Blob, 'réception : une ligne files reçue n’efface jamais le blob local');
    const sans = await db.get('files', 'd'.repeat(64));
    eq([sans.remote, 'blob' in sans], [true, false], 'réception : une ligne files inconnue arrive remote:true, sans octets (L4 les téléchargera)');
  });
  await withRepo(async (repo, db) => {
    // Pointeur de version : la version locale pointée n’est pas un ancêtre de la version reçue → conflit « version ».
    await db.mutate({ puts: { recipes: [{ id: 'r1', current_version_id: 'w1', updated_at: '2026-10-13T10:00:00Z' }], recipe_versions: [{ id: 'v1', recipe_id: 'r1', parent_version_id: null, updated_at: 't' }, { id: 'w1', recipe_id: 'r1', parent_version_id: 'v1', updated_at: 't' }, { id: 'v2', recipe_id: 'r1', parent_version_id: 'v1', updated_at: 't' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { recipes: [[{ id: 'r1', data: { id: 'r1', current_version_id: 'v2', updated_at: '2026-10-13T11:00:00Z' }, updated_at: '2026-10-13T11:00:00Z', deleted_at: null, server_seq: 9 }], []] } });
    const r = await createPull({ db, transport: tf, isActivitySynced: () => false, getUserId: () => 'u1' }).recevoir();
    eq((await db.get('recipes', 'r1')).current_version_id, 'v2', 'réception : la fiche recette reçue (plus récente) est écrite');
    const c = await db.get('sync_conflicts', 'recipes:r1');
    eq([c?.kind, r.conflits], ['version', 1], 'réception : conflit « version » journalisé — aucune version masquée');
  });

  // --- Conflits : gestes (spec § 5.5)
  const { garderIci, garderAilleurs, purgerAnciens } = await import('../src/sync/conflits.js');
  await withRepo(async (repo, db) => {
    const conflit = { id: 'books:k1', store: 'books', record_id: 'k1', local: { id: 'k1', title: 'ici', updated_at: '2026-10-13T12:00:00Z' }, server: { data: { id: 'k1', title: 'ailleurs', updated_at: '2026-10-13T12:00:00Z' }, updated_at: '2026-10-13T12:00:00Z', deleted_at: null }, at: '2026-10-13T12:01:00Z', kind: 'donnees' };
    await db.mutate({ puts: { sync_conflicts: [conflit], books: [conflit.server.data] }, origin: 'device' });
    await garderIci(db, conflit);
    const k = await db.get('books', 'k1');
    ok(k.title === 'ici' && k.updated_at > '2026-10-13T12:00:00Z', 'conflits : « Garder celle d’ici » restaure la version locale avec un updated_at neuf');
    eq((await db.getAll('outbox')).map((e) => e.id), ['k1'], 'conflits : … et la met en file');
    eq(await db.get('sync_conflicts', 'books:k1'), undefined, 'conflits : le conflit est effacé');
    await db.mutate({ puts: { sync_conflicts: [conflit] }, deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    await garderAilleurs(db, conflit);
    eq((await db.get('books', 'k1')).title, 'ailleurs', 'conflits : « Garder celle d’ailleurs » écrit la version du serveur');
    eq([await db.count('outbox'), await db.get('sync_conflicts', 'books:k1')], [0, undefined], 'conflits : … sans remise en file, conflit effacé');
    await db.mutate({ puts: { sync_conflicts: [{ ...conflit, id: 'books:vieux', at: '2026-09-01T00:00:00Z' }, { ...conflit, id: 'books:recent', at: '2026-10-12T00:00:00Z' }] }, origin: 'device' });
    eq(await purgerAnciens(db, Date.parse('2026-10-13T00:00:00Z')), 1, 'conflits : plus de 30 jours → retiré');
    eq((await db.getAll('sync_conflicts')).map((c) => c.id), ['books:recent'], 'conflits : le récent reste');
  });
```

- [ ] **Step 2 : rouge** — `?v=l3-t6-rouge`.

- [ ] **Step 3 : implémentation**

`src/sync/pull.js` :

```js
// Réception (spec § 5.5) : par table, pages par server_seq croissant ; le curseur n'avance qu'avec l'écriture de la
// page (même transaction). Règle I7, la même qu'à l'envoi : le plus récent gagne ; égal + identique = rien ;
// égal + différent = conflit. Tout ce qui s'écrit ici porte origin 'remote' : jamais recapturé.
import { SYNC_STORES, STORES } from '../model/schema.js';
import { keyOf } from './tables.js';
import { logError } from '../core/log.js';

const identiques = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function decider({ locale, distante }) {
  if (distante.deleted_at) return locale === undefined || locale === null ? 'ignorer' : 'supprimer';
  if (locale === undefined || locale === null) return 'ecrire';
  const l = String(locale.updated_at || ''), d = String(distante.updated_at || '');
  if (d > l) return 'ecrire';
  if (l > d) return 'conflit_renvoyer';
  return identiques(locale, distante.data) ? 'ignorer' : 'conflit';
}

// Une version est l'ancêtre d'une autre si on la retrouve en remontant parent_version_id (elle-même comprise).
export function estAncetre(versions, candidatId, cibleId) {
  const parId = new Map(versions.map((v) => [v.id, v]));
  let courant = cibleId;
  const vus = new Set();
  while (courant && !vus.has(courant)) {
    if (courant === candidatId) return true;
    vus.add(courant);
    courant = parId.get(courant)?.parent_version_id || null;
  }
  return false;
}

export function createPull({ db, transport, isActivitySynced = () => false, getUserId = () => null, surProgression = () => {}, limite = 1000 }) {
  const tables = () => SYNC_STORES.filter((t) => t !== 'library_activity' || isActivitySynced());

  async function appliquerPage(table, lignes, bilan) {
    const puts = {}; const deletes = {}; const conflits = []; const refile = [];
    const cleTable = STORES[table].keyPath;
    for (const ligne of lignes) {
      if (!ligne.deleted_at && (!ligne.data || typeof ligne.data !== 'object' || ligne.data[cleTable] !== ligne.id)) {
        return { erreur: { type: 'forme', status: null, message: `ligne ${table}/${ligne.id}` } };
      }
      const locale = await db.get(table, ligne.id);
      const decision = decider({ locale, distante: ligne });
      if (decision === 'supprimer') { (deletes[table] ||= []).push(ligne.id); bilan.supprimees += 1; continue; }
      if (decision === 'ignorer') continue;
      if (decision === 'ecrire') {
        let fiche = { ...ligne.data, updated_at: ligne.updated_at };
        if (table === 'files') fiche = locale?.blob instanceof Blob ? { ...fiche, blob: locale.blob } : { ...fiche, remote: true };
        (puts[table] ||= []).push(fiche); bilan.recues += 1;
        if (table === 'recipes' && locale && locale.current_version_id && ligne.data.current_version_id && locale.current_version_id !== ligne.data.current_version_id) {
          const versions = (await db.getAll('recipe_versions')).filter((v) => v.recipe_id === ligne.id);
          if (!estAncetre(versions, locale.current_version_id, ligne.data.current_version_id)) {
            conflits.push({ id: `recipes:${ligne.id}`, store: 'recipes', record_id: ligne.id, local: locale, server: { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null }, at: new Date().toISOString(), kind: 'version' });
          }
        }
        continue;
      }
      conflits.push({ id: `${table}:${ligne.id}`, store: table, record_id: ligne.id, local: locale, server: { data: ligne.data, updated_at: ligne.updated_at, deleted_at: null }, at: new Date().toISOString(), kind: 'donnees' });
      if (decision === 'conflit_renvoyer') refile.push({ user_id: getUserId(), store: table, id: ligne.id, op: 'put', updated_at: locale.updated_at || null, tries: 0 });
    }
    if (conflits.length) puts.sync_conflicts = conflits;
    if (refile.length) puts.outbox = refile;
    const dernier = Math.max(...lignes.map((l) => l.server_seq));
    puts.sync_state = [{ key: `cursor:${table}`, value: dernier }];
    await db.mutate({ puts, deletes, origin: 'remote' });
    bilan.conflits += conflits.length;
    return { erreur: null, dernier };
  }

  async function recevoir() {
    const bilan = { recues: 0, supprimees: 0, conflits: 0, erreur: null };
    const liste = tables();
    for (const [i, table] of liste.entries()) {
      surProgression({ phase: 'reception', table, n: i + 1, total: liste.length });
      let curseur = (await db.get('sync_state', `cursor:${table}`))?.value || 0;
      for (;;) {
        const { lignes, erreur } = await transport.lire(table, curseur, limite);
        if (erreur) { bilan.erreur = erreur; logError('sync.pull', { table, type: erreur.type, status: erreur.status }); return bilan; }
        if (!lignes.length) break;
        const r = await appliquerPage(table, lignes, bilan);
        if (r.erreur) { bilan.erreur = r.erreur; logError('sync.pull.forme', { table }); return bilan; }
        curseur = r.dernier;
        if (lignes.length < limite) break;
      }
    }
    return bilan;
  }

  return { recevoir };
}
```

`src/sync/conflits.js` :

```js
// Gestes sur un conflit (spec § 5.5). « Garder celle d'ici » : la version locale est restaurée avec un updated_at
// NEUF et mise en file (le serveur l'acceptera : plus récente). « Garder celle d'ailleurs » : la version du serveur
// est écrite sans remise en file. Dans les deux cas le conflit disparaît. Plus de 30 jours : retiré.
import { syncNow } from './clock.js';

export async function garderIci(db, conflit) {
  const fiche = { ...(conflit.local || {}), updated_at: syncNow() };
  await db.mutate({ puts: { [conflit.store]: [fiche] }, deletes: { sync_conflicts: [conflit.id] }, origin: 'local' });
}

export async function garderAilleurs(db, conflit) {
  const puts = {};
  if (conflit.server?.deleted_at) { /* tombale : la suppression est appliquée */ }
  else puts[conflit.store] = [{ ...conflit.server.data, updated_at: conflit.server.updated_at }];
  const deletes = { sync_conflicts: [conflit.id] };
  if (conflit.server?.deleted_at) deletes[conflit.store] = [conflit.record_id];
  await db.mutate({ puts, deletes, origin: 'remote' });
}

export async function purgerAnciens(db, maintenantMs = Date.now(), joursMax = 30) {
  const limite = maintenantMs - joursMax * 86400000;
  const vieux = (await db.getAll('sync_conflicts')).filter((c) => Date.parse(c.at) < limite).map((c) => c.id);
  if (vieux.length) await db.mutate({ deletes: { sync_conflicts: vieux }, origin: 'remote' });
  return vieux.length;
}
```

Note : `garderIci` écrit avec `origin: 'local'` **exprès** — la capture met la fiche en file (c'est le renvoi voulu) ; le retrait du conflit dans la même transaction est interne (`sync_conflicts` n'est pas dans `SYNC_STORES`).

- [ ] **Step 4 : vert** — `?v=l3-t6-vert`.

- [ ] **Step 5 : commit** — `git add src/sync/pull.js src/sync/conflits.js tests/sync-l3.js && git commit -m "L3 T6 : reception paginee, decision I7, curseur atomique, conflits et gestes, files sans octets, pointeur de version"`

---

### Task 7 : le moteur — déclencheurs, un seul vol, état observable

**Files :**
- Create : `src/sync/moteur.js`
- Test : `tests/sync-l3.js` (bloc `// --- Moteur (spec § 5.3, § 4.2)`)

**Interfaces :**
- Consumes : `envoiInitial`, `createPush`, `createPull`, `purgerAnciens`, `appliquerHeureServeur` (via push), `db`, `auth.getClient()` + `createTransport`, bus `on('change')`, `window` (`online`, `visibilitychange`).
- Produces : `createMoteur({ db, getUserId, isActivitySynced, transport, fenetre = globalThis, bus = { on }, maintenant = Date.now, delaiRegroupementMs = 2000 })` → `{ demarrer(), arreter(), executer(raison) → Promise<Etat>, planifier(), etat() → Etat, onEtat(fn) → desabonner }` ; `Etat = { enCours: boolean, phase: null|'envoi_initial'|'envoi'|'reception', progression: null|{ table, n, total }, dernierEchange: iso|null, aEnvoyer: number, enQuarantaine: number, conflits: number, pause: null|{ raison, at }, attenteConnexion: boolean, horloge: null|{ minutes }, derniereErreur: null|{ type } }`.

- [ ] **Step 1 : tests rouges**

```js
  // --- Moteur (spec § 5.3, § 4.2) : ordre envoi initial → envoi → réception, un seul vol, état, déclencheurs
  const { createMoteur } = await import('../src/sync/moteur.js');
  await withRepo(async (repo, db) => {
    await db.mutate({ puts: { books: [{ id: 'm1', title: 'Avant', updated_at: '2026-10-01T00:00:00Z' }] }, origin: 'device' });
    const tf = creerTransportFactice({ lire: { books: [[{ id: 'm9', data: { id: 'm9', title: 'Reçu', updated_at: '2026-10-13T00:00:00Z' }, updated_at: '2026-10-13T00:00:00Z', deleted_at: null, server_seq: 1 }], []] } });
    const etats = [];
    const ecouteurs = {};
    const fenetre = { addEventListener: (ev, fn) => { ecouteurs[ev] = fn; }, removeEventListener: (ev) => { delete ecouteurs[ev]; }, document: { visibilityState: 'visible' } };
    const abonnes = {};
    const bus = { on: (ev, fn) => { abonnes[ev] = fn; return () => delete abonnes[ev]; } };
    const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre, bus, delaiRegroupementMs: 10 });
    moteur.onEtat((e) => etats.push({ ...e }));
    const e0 = moteur.etat();
    eq([e0.enCours, e0.aEnvoyer, e0.dernierEchange], [false, 0, null], 'moteur : état initial');
    const fin = await moteur.executer('test');
    eq([fin.enCours, fin.phase, fin.aEnvoyer, fin.conflits, fin.attenteConnexion], [false, null, 0, 0, false], 'moteur : après une passe complète, plus rien à envoyer');
    ok(fin.dernierEchange !== null, 'moteur : « Dernier échange » posé après un appel réussi');
    eq((await db.get('sync_state', 'last_exchange_at'))?.value, fin.dernierEchange, 'moteur : dernier échange persisté');
    const ordre = tf.journal.map((a) => a.appel);
    ok(ordre.indexOf('pousser') < ordre.indexOf('lire'), 'moteur : envoi (initial inclus) AVANT réception');
    eq((await db.get('books', 'm9'))?.title, 'Reçu', 'moteur : la réception a écrit la fiche');
    ok(etats.some((e) => e.phase === 'envoi_initial') && etats.some((e) => e.phase === 'reception'), 'moteur : les phases sont annoncées');
    // Un seul vol : deux exécutions concurrentes → une passe, la seconde attend la première.
    const avant = tf.journal.length;
    await Promise.all([moteur.executer('a'), moteur.executer('b')]);
    ok(tf.journal.length - avant <= 25, 'moteur : exécutions concurrentes → un seul vol (pas deux fois les appels)');
    // Déclencheurs : écriture regroupée, online, premier plan.
    moteur.demarrer();
    ok(['online', 'visibilitychange'].every((ev) => ecouteurs[ev]) && abonnes.change, 'moteur : écoute online, visibilitychange et le bus « change »');
    const n0 = tf.journal.length;
    await repo.save('books', { id: 'm2', title: 'Nouveau' });
    abonnes.change({ store: 'books' }); abonnes.change({ store: 'books' });
    await new Promise((r) => setTimeout(r, 60));
    ok(tf.journal.filter((a, i) => i >= n0 && a.appel === 'pousser').length === 1, 'moteur : deux écritures rapprochées → un seul envoi (regroupement)');
    moteur.arreter();
    eq(Object.keys(ecouteurs).length, 0, 'moteur : arrêt → plus d’écoute');
  });
  await withRepo(async (repo, db) => {
    await repo.save('books', { id: 'h1', title: 'x' });
    const tf = creerTransportFactice({ pousser: [{ reponse: { server_time: new Date(Date.now() + 11 * 60000).toISOString(), accepted: [{ store: 'books', id: 'h1' }], adjusted: [], rejected: [] } }], lire: {} });
    const moteur = createMoteur({ db, getUserId: () => 'u1', isActivitySynced: () => false, transport: tf, fenetre: { addEventListener() {}, removeEventListener() {}, document: { visibilityState: 'visible' } }, bus: { on: () => () => {} } });
    const e = await moteur.executer('t');
    eq(e.horloge?.minutes, 11, 'moteur : horloge fausse de 11 min → avertissement porté par l’état');
    eq(typeof (await db.get('sync_state', 'clock_warned_at'))?.value, 'string', 'moteur : avertissement unique mémorisé');
    const e2 = await moteur.executer('t');
    eq(e2.horloge?.minutes, 11, 'moteur : l’avertissement reste affiché, pas répété');
    const { setClockOffset } = await import('../src/sync/clock.js'); setClockOffset(0);
  });
```

- [ ] **Step 2 : rouge** — `?v=l3-t7-rouge`.

- [ ] **Step 3 : implémentation `src/sync/moteur.js`**

```js
// Le moteur (spec § 5.3, § 5.5, § 4.2) : sur chaque déclencheur, UNE passe — envoi initial (marqueurs) → envoi →
// réception — jamais deux en même temps (un vol en cours est rejoint, pas doublé). L'état est observable par
// Réglages et par la pastille ; ce qu'il affiche vient toujours d'un fait (accusé, lignes reçues, erreur classée).
import { envoiInitial } from './backfill.js';
import { createPush } from './push.js';
import { createPull } from './pull.js';
import { purgerAnciens } from './conflits.js';
import { setClockOffset } from './clock.js';
import { logError } from '../core/log.js';

export function createMoteur({ db, getUserId, isActivitySynced = () => false, transport, fenetre = globalThis, bus = null, maintenant = Date.now, delaiRegroupementMs = 2000 }) {
  let etat = { enCours: false, phase: null, progression: null, dernierEchange: null, aEnvoyer: 0, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: false, horloge: null, derniereErreur: null };
  const abonnes = new Set();
  let vol = null; let minuterie = null; let reprise = null; const desabonner = [];
  const push = createPush({ db, transport, maintenant, surHeure: (h) => { avertirHorloge(h); } });
  const pull = createPull({ db, transport, isActivitySynced, getUserId, surProgression: (p) => poser({ phase: p.phase, progression: { table: p.table, n: p.n, total: p.total } }) });

  function poser(partiel) { etat = { ...etat, ...partiel }; for (const fn of abonnes) { try { fn(etat); } catch (e) { logError('sync.etat', { error: e }); } } return etat; }

  async function compter() {
    const file = await db.getAll('outbox');
    return { aEnvoyer: file.length, enQuarantaine: file.filter((e) => e.quarantined_at).length, conflits: await db.count('sync_conflicts') };
  }

  async function avertirHorloge(h) {
    if (!h.avertir) return;
    const deja = await db.get('sync_state', 'clock_warned_at');
    if (!deja) await db.mutate({ puts: { sync_state: [{ key: 'clock_warned_at', value: new Date(maintenant()).toISOString() }, { key: 'clock_offset_ms', value: h.decalageMs }] }, origin: 'device' });
    poser({ horloge: { minutes: h.minutes } });
  }

  async function charger() {
    const pause = (await db.get('sync_state', 'pause'))?.value || null;
    const dernier = (await db.get('sync_state', 'last_exchange_at'))?.value || null;
    const decalage = (await db.get('sync_state', 'clock_offset_ms'))?.value;
    if (Number.isFinite(decalage)) setClockOffset(decalage);
    const averti = await db.get('sync_state', 'clock_warned_at');
    poser({ pause, dernierEchange: dernier, horloge: averti && Number.isFinite(decalage) ? { minutes: Math.round(Math.abs(decalage) / 60000) } : null, ...(await compter()) });
  }

  async function passe(raison) {
    if (!getUserId()) { poser({ ...(await compter()) }); return etat; }
    poser({ enCours: true, phase: 'envoi_initial', derniereErreur: null, attenteConnexion: false });
    try {
      if (etat.pause) { /* en pause : on ne tente que sur « Envoyer maintenant », qui lève la pause avant d'appeler */ }
      await envoiInitial({ db, getUserId, isActivitySynced, surProgression: (p) => poser({ progression: { table: p.table, n: p.n, total: p.total } }) });
      poser({ phase: 'envoi', progression: null });
      const r = await push.envoyer();
      if (r.pause) poser({ pause: (await db.get('sync_state', 'pause'))?.value || { raison: 'quota', at: new Date(maintenant()).toISOString() } });
      if (r.attenteConnexion) poser({ attenteConnexion: true });
      if (r.erreur) poser({ derniereErreur: { type: r.erreur.type } });
      if (r.recul) programmerReprise(r.recul);
      if (!r.erreur) await toucherEchange();
      if (!r.erreur && !r.pause && !r.attenteConnexion) {
        poser({ phase: 'reception' });
        const p = await pull.recevoir();
        if (p.erreur) poser({ derniereErreur: { type: p.erreur.type } }); else await toucherEchange();
      }
      await purgerAnciens(db, maintenant());
    } catch (error) {
      logError('sync.passe', { error, raison });
      poser({ derniereErreur: { type: 'inconnu' } });
    } finally {
      poser({ enCours: false, phase: null, progression: null, ...(await compter()) });
    }
    return etat;
  }

  async function toucherEchange() {
    const iso = new Date(maintenant()).toISOString();
    await db.mutate({ puts: { sync_state: [{ key: 'last_exchange_at', value: iso }] }, origin: 'device' });
    poser({ dernierEchange: iso });
  }

  function programmerReprise(ms) {
    if (reprise) clearTimeout(reprise);
    reprise = setTimeout(() => { reprise = null; executer('reprise'); }, ms);
  }

  // Un seul vol : un appel pendant une passe rejoint la passe en cours (sa promesse), sans en lancer une seconde.
  function executer(raison = 'manuel') {
    if (vol) return vol;
    vol = passe(raison).finally(() => { vol = null; });
    return vol;
  }

  function planifier() {
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(() => { minuterie = null; executer('ecriture'); }, delaiRegroupementMs);
  }

  async function envoyerMaintenant() {
    if (etat.pause) { await db.mutate({ deletes: { sync_state: ['pause'] }, origin: 'device' }); poser({ pause: null }); }
    return executer('manuel');
  }

  function demarrer() {
    const surOnline = () => executer('online');
    const surVisibilite = () => { if (fenetre.document?.visibilityState === 'visible') executer('premier_plan'); };
    fenetre.addEventListener('online', surOnline);
    fenetre.addEventListener('visibilitychange', surVisibilite);
    desabonner.push(() => fenetre.removeEventListener('online', surOnline), () => fenetre.removeEventListener('visibilitychange', surVisibilite));
    if (bus) desabonner.push(bus.on('change', () => planifier()));
    charger().then(() => executer('demarrage')).catch((error) => logError('sync.demarrer', { error }));
  }

  function arreter() { for (const d of desabonner.splice(0)) d(); if (minuterie) clearTimeout(minuterie); if (reprise) clearTimeout(reprise); }

  return { demarrer, arreter, executer, planifier, envoyerMaintenant, etat: () => etat, onEtat: (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); } };
}
```

Décisions à respecter : `executer()` sans compte rend l'état (compte à jour) sans appel réseau ; en pause, `executer()` **ne tente rien** (ajouter `if (etat.pause) { poser({ ...(await compter()) }); return etat; }` en tête de `passe` après la vérification du compte) ; seul `envoyerMaintenant()` lève la pause.

- [ ] **Step 4 : vert** — `?v=l3-t7-vert`.

- [ ] **Step 5 : commit** — `git add src/sync/moteur.js tests/sync-l3.js && git commit -m "L3 T7 : moteur (declencheurs, un seul vol, envoi initial puis envoi puis reception, etat observable, reprise)"`

---

### Task 8 : Réglages — ensemble L3

**Files :**
- Modify : `src/ui/settings.js` (`syncSectionModel`, `syncSection`, nouveaux gestes), `src/i18n/en.js`
- Test : `tests/sync.js` (étendre le bloc « Réglages : section Synchronisation ») ou `tests/sync-l3.js` (bloc `// --- Réglages L3 (spec § 4.2)`)

**Interfaces :**
- Consumes : `getSyncState()` (gagne `moteur` en T9 ; ici le modèle reçoit `moteur: Etat|null` et `quarantaine: Entree[]`, `conflits: Conflit[]`) ; `conflits.js` ; `backfill.retirerMarqueur`.
- Produces : `syncSectionModel({ …L2, moteur = null, quarantaine = [], conflits = [] })` → `{ title, lines, buttons, quarantaine: [{ seq, libelle, motif }], conflits: [{ id, libelle, dateIci, dateAilleurs }], progression: string|null, pause: string|null }` ; gestes `envoyerMaintenant`, `reessayer(seq)`, `abandonner(seq)`, `garderIci(id)`, `garderAilleurs(id)` ; `SYNC_ACTIONS` += `'envoyerMaintenant'` ; `reglerHistorique(actif)` : à l'activation, `retirerMarqueur(db, 'library_activity')` (rattrapage).

- [ ] **Step 1 : tests rouges**

```js
  // --- Réglages L3 (spec § 4.2) : dernier échange, quarantaine, conflits, Envoyer maintenant, progression, pause
  const { syncSectionModel } = await import('../src/ui/settings.js');
  const base = { available: true, user: { id: 'u', email: 'x@exemple.invalid' }, guard: { ok: true }, pending: 3 };
  const m1 = syncSectionModel({ ...base, moteur: { enCours: false, dernierEchange: '2026-10-13T20:05:00Z', enQuarantaine: 2, conflits: 1, pause: null, attenteConnexion: false, horloge: null, phase: null, progression: null }, quarantaine: [{ seq: 4, store: 'books', id: 'b4', last_error: 'taille' }, { seq: 5, store: 'recipes', id: 'r5', last_error: 'forme' }], conflits: [{ id: 'books:k1', store: 'books', record_id: 'k1', local: { title: 'Ici', updated_at: '2026-10-13T12:00:00Z' }, server: { data: { title: 'Ailleurs' }, updated_at: '2026-10-13T12:00:00Z' }, at: '2026-10-13T12:01:00Z', kind: 'donnees' }] });
  ok(m1.lines.some((l) => l.startsWith('Dernier échange')), 'réglages L3 : « Dernier échange : <heure> »');
  ok(m1.lines.includes('En quarantaine : 2') && m1.lines.includes('Conflits : 1'), 'réglages L3 : quarantaine et conflits comptés');
  ok(m1.buttons.some((b) => b.action === 'envoyerMaintenant'), 'réglages L3 : « Envoyer maintenant » offert quand connecté');
  eq(m1.quarantaine.map((q) => [q.seq, q.motif]), [[4, 'taille'], [5, 'forme']], 'réglages L3 : chaque entrée en quarantaine, avec son motif');
  ok(m1.quarantaine[0].libelle.includes('b4'), 'réglages L3 : la fiche est nommée');
  eq(m1.conflits.length, 1, 'réglages L3 : chaque conflit listé');
  ok(m1.conflits[0].libelle.includes('Ici') || m1.conflits[0].libelle.includes('k1'), 'réglages L3 : le conflit nomme la fiche');
  const m2 = syncSectionModel({ ...base, moteur: { enCours: true, phase: 'envoi_initial', progression: { table: 'recipes', n: 8, total: 24 }, dernierEchange: null, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: false, horloge: null } });
  eq(m2.progression, 'Envoi initial : recipes 8/24', 'réglages L3 : progression de l’envoi initial');
  const m3 = syncSectionModel({ ...base, moteur: { enCours: true, phase: 'reception', progression: { table: 'books', n: 1, total: 24 }, dernierEchange: null, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: false, horloge: null } });
  eq(m3.progression, 'Réception : books 1/24', 'réglages L3 : progression de la réception');
  const m4 = syncSectionModel({ ...base, moteur: { enCours: false, phase: null, progression: null, dernierEchange: null, enQuarantaine: 0, conflits: 0, pause: { raison: 'quota', at: 't' }, attenteConnexion: false, horloge: { minutes: 12 } } });
  ok(m4.pause && m4.pause.includes('1 Go'), 'réglages L3 : pause quota nommée (rien n’est perdu)');
  ok(m4.lines.some((l) => l.includes('12')), 'réglages L3 : avertissement d’horloge avec les minutes');
  const m5 = syncSectionModel({ ...base, moteur: { enCours: false, phase: null, progression: null, dernierEchange: null, enQuarantaine: 0, conflits: 0, pause: null, attenteConnexion: true, horloge: null } });
  ok(m5.lines.some((l) => l.includes('En attente de connexion')), 'réglages L3 : 401 → « En attente de connexion »');
  const m6 = syncSectionModel({ ...base, moteur: null });
  ok(!m6.buttons.some((b) => b.action === 'envoyerMaintenant') && m6.progression === null, 'réglages L3 : sans moteur (L2), rien de L3 n’est affiché');

  const { reglerHistorique } = await import('../src/ui/settings.js');
  await withRepo(async (repo, db) => {
    await db.mutate({ puts: { sync_state: [{ key: 'backfill:library_activity', value: 'fait' }] }, origin: 'device' });
    await reglerHistorique(true, { db });
    eq(await db.get('sync_state', 'backfill:library_activity'), undefined, 'réglages L3 : activer l’historique retire son marqueur (rattrapage)');
  });
```

- [ ] **Step 2 : rouge** — `?v=l3-t8-rouge`.

- [ ] **Step 3 : implémentation** (dans `src/ui/settings.js`)

Étendre `syncSectionModel` : après les lignes L2 de l'état « connectée » (et seulement dans cet état), si `moteur` est non nul :

```js
    if (moteur) {
      lines.push(moteur.dernierEchange ? t('Dernier échange : {h}', { h: formatDate(moteur.dernierEchange, { withTime: true }) }) : t('Aucun échange encore.'));
      lines.push(t('En quarantaine : {n}', { n: moteur.enQuarantaine }));
      lines.push(t('Conflits : {n}', { n: moteur.conflits }));
      if (moteur.attenteConnexion) lines.push(t('En attente de connexion — l’envoi reprendra après la prochaine connexion.'));
      if (moteur.horloge) lines.push(t('L’heure de cet appareil semble fausse (± {m} min).', { m: moteur.horloge.minutes }));
      buttons.push({ action: 'envoyerMaintenant', label: t('Envoyer maintenant'), tone: '' });
    }
```

Et rendre `{ title, lines, buttons, quarantaine, conflits, progression, pause }` où :
- `quarantaine = quarantaineListe.map((e) => ({ seq: e.seq, libelle: `${e.store} · ${String(e.id).slice(0, 12)}`, motif: e.last_error || 'refus' }))` ;
- `conflits = conflitsListe.map((c) => ({ id: c.id, libelle: `${c.store} · ${c.local?.title || c.local?.name || c.record_id}`, dateIci: formatDate(c.local?.updated_at || c.at, { withTime: true }), dateAilleurs: formatDate(c.server?.updated_at || c.at, { withTime: true }), kind: c.kind }))` ;
- `progression = moteur?.enCours && moteur.progression ? (moteur.phase === 'reception' ? t('Réception : {t} {n}/{total}', …) : t('Envoi initial : {t} {n}/{total}', …)) : null` ;
- `pause = moteur?.pause?.raison === 'quota' ? t('Espace serveur plein (1 Go au palier gratuit) — rien n’est perdu, tout reste sur cet appareil.') : null`.

Rendu (`syncSection`) : sous les lignes, `progression` en `p.muted` ; `pause` en `div.card.warn` ; liste de quarantaine : pour chaque entrée `p` avec libellé — motif + boutons « Réessayer » (`reessayer(seq)`) et « Abandonner cet envoi » (`abandonner(seq)`) ; liste de conflits : « <libellé> — version d'ici du <dateIci>, version d'ailleurs du <dateAilleurs> » + « Garder celle d'ici (<dateIci>) » / « Garder celle d'ailleurs » (`garderIci(id)` / `garderAilleurs(id)`). Gestes :

```js
    envoyerMaintenant: async () => { await getSyncState().moteur?.envoyerMaintenant(); refresh(); },
    reessayer: async (seq) => { const e = await repo.db.get('outbox', seq); if (!e) return; await repo.db.mutate({ puts: { outbox: [{ ...e, quarantined_at: null, last_error: null, tries: 0, next_try_at: null }] }, origin: 'device' }); getSyncState().moteur?.executer('reessai'); refresh(); },
    abandonner: async (seq) => { await repo.db.mutate({ deletes: { outbox: [seq] }, origin: 'device' }); refresh(); }, // la fiche locale n'est pas touchée
    garderIci: async (id) => { const c = await repo.db.get('sync_conflicts', id); if (c) { await garderIci(repo.db, c); getSyncState().moteur?.planifier(); } refresh(); },
    garderAilleurs: async (id) => { const c = await repo.db.get('sync_conflicts', id); if (c) await garderAilleurs(repo.db, c); refresh(); },
```

`renderSettings` lit `quarantaine = (await repo.db.getAll('outbox')).filter((e) => e.quarantined_at)` et `conflits = await repo.db.getAll('sync_conflicts')` et passe `moteur: getSyncState().moteur?.etat() || null`. `reglerHistorique(actif, { db = repo.db, … })` : si `actif`, `await retirerMarqueur(db, 'library_activity')` puis `getSyncState().moteur?.planifier()`. « Effacer les données de cet appareil » : le toast devient « {n} éléments ne sont pas encore envoyés (dont {m} en quarantaine : « Abandonner » d'abord). » quand `m > 0`. `SYNC_ACTIONS` += `'envoyerMaintenant'`. Toutes les chaînes dans `en.js`.

- [ ] **Step 4 : vert** — `?v=l3-t8-vert` ; vérification réelle sur `localhost:8080/#/settings` (Playwright, **sans geste destructeur**) : la section affiche « Dernier échange » / « En quarantaine : 0 » / « Conflits : 0 » / « Envoyer maintenant » quand connecté — si le profil n'est pas connecté sur localhost, vérifier au moins que la section L2 est intacte et que le modèle rend les champs L3 (test).

- [ ] **Step 5 : commit** — `git add src/ui/settings.js src/i18n/en.js tests/sync-l3.js && git commit -m "L3 T8 : Reglages ensemble L3 (dernier echange, quarantaine, conflits, Envoyer maintenant, progression, pause, horloge)"`

---

### Task 9 : câblage — démarrage du moteur, pastille, vue recette, fusion ZIP

**Files :**
- Modify : `src/app.js` (après `porteDEntree()` : moteur ; pastille dans `shell()`), `src/ui/state.js` (`sync.moteur`), `src/ui/recipe.js` (ligne de conflit de version), `src/domain/backup.js` (fusion : `updated_at` neufs), `src/ui/settings.js` (bilan de restauration : « N fiches seront renvoyées au serveur »), `src/i18n/en.js`
- Test : `tests/sync-l3.js` (bloc `// --- Câblage (spec § 4.2, § 5.2, § 5.5)`) ; `tests/backup.js` reste vert

**Interfaces :**
- Consumes : `createMoteur`, `createTransport(auth.getClient())`, `getSyncState()`, `setSyncState({ moteur })`, bus `on`.
- Produces : `getSyncState().moteur` (instance ou `null`) ; `pastilleModel({ aEnvoyer })` → `string|null` (« N non envoyés ») ; `applyArchive(db, inspection, { mode: 'merge', horodater = null })` : en fusion, chaque fiche d'un magasin de `SYNC_STORES` reçoit `updated_at = horodater()` quand `horodater` est fourni ; `settings.js` passe `horodater: syncNow` **seulement si un compte est connecté**, et le bilan ajoute « {n} fiches seront renvoyées au serveur. ».

- [ ] **Step 1 : tests rouges**

```js
  // --- Câblage (spec § 4.2, § 5.2, § 5.5) : pastille, fusion horodatée, conflit de version dans la vue recette
  // JAMAIS importer src/app.js dans les tests : il lance boot() à l'import (remplace #app, enregistre le SW).
  // La pastille vit dans src/ui/state.js pour rester testable sans démarrer l'app.
  const { pastilleModel: pm } = await import('../src/ui/state.js');
  eq([pm({ aEnvoyer: 0 }), pm({ aEnvoyer: 1 }), pm({ aEnvoyer: 12 })], [null, '1 non envoyé', '12 non envoyés'], 'pastille : « N non envoyés » seulement si N > 0 (singulier à part)');
  const { applyArchive, inspectArchive, createArchive } = await import('../src/domain/backup.js');
  await withRepo(async (repo, db) => {
    await db.mutate({ puts: { books: [{ id: 'z1', title: 'Archivé', updated_at: '2026-10-01T00:00:00Z' }] }, origin: 'device' });
    const archive = await createArchive(db);
    const insp = await inspectArchive(archive.blob);
    await db.mutate({ deletes: { outbox: (await db.getAll('outbox')).map((e) => e.seq) }, origin: 'device' });
    await applyArchive(db, insp, { mode: 'merge', horodater: () => '2030-01-01T00:00:00.000Z' });
    eq((await db.get('books', 'z1')).updated_at, '2030-01-01T00:00:00.000Z', 'fusion : chaque fiche fusionnée reçoit un updated_at neuf');
    ok((await db.getAll('outbox')).some((e) => e.store === 'books' && e.id === 'z1'), 'fusion : … et part en file (capturée, origin local)');
    await applyArchive(db, insp, { mode: 'merge' });
    eq((await db.get('books', 'z1')).updated_at, '2026-10-01T00:00:00Z', 'fusion sans compte : updated_at de l’archive conservé (comportement d’avant)');
  });
```

- [ ] **Step 2 : rouge** — `?v=l3-t9-rouge`.

- [ ] **Step 3 : implémentation**

`src/ui/state.js` : `sync` gagne `moteur: null` ; `export function pastilleModel({ aEnvoyer = 0 } = {}) { if (!(aEnvoyer > 0)) return null; return aEnvoyer === 1 ? t('1 non envoyé') : t('{n} non envoyés', { n: aEnvoyer }); }`.

`src/app.js` : dans `boot()`, après `await porteDEntree()` et avant `registerRoutes()` :

```js
    demarrerMoteur();
```

```js
// Moteur de synchronisation (spec § 5.3, § 5.5) : lancé après la porte, seulement quand un client existe. Il vit
// dans l'état de connexion (Réglages et pastille le lisent) et suit les changements de session.
function demarrerMoteur() {
  const { auth } = getSyncState();
  const client = auth?.getClient?.() || null;
  if (!client) return;
  const moteur = createMoteur({ db: repo.db, transport: createTransport(client), getUserId: () => getSyncState().user?.id || null, isActivitySynced, fenetre: window, bus: { on } });
  setSyncState({ moteur });
  moteur.onEtat((etat) => majPastille(etat));
  moteur.demarrer();
  auth.onChange(() => setTimeout(() => moteur.executer('session'), 0));
}
```

Pastille : dans `shell()`, ajouter dans `top` un `el('span', { class: 'pastille', id: 'pastille', hidden: true })` ; `majPastille(etat)` écrit `pastilleModel({ aEnvoyer: etat.aEnvoyer })` dans ce nœud (`hidden` si `null`). Style `.pastille` (fond `--warn-bg`, texte `--warn`, arrondi) dans `styles.css`. Au geste « Se déconnecter » ou « Changer de compte », le moteur est arrêté (`getSyncState().moteur?.arreter()`) et l'état `{ moteur: null }` posé (dans `settings.js`, gestes existants) ; au prochain `auth.onChange` avec un compte, `demarrerMoteur()` est rappelé (exporter une fonction `relancerMoteur` depuis `state.js` qui garde la fabrique posée par `app.js` — ou plus simple : `demarrerMoteur` reste dans `app.js` et `auth.onChange` l'appelle si `getSyncState().moteur` est nul et qu'un compte existe).

`src/ui/recipe.js` : en tête de `renderRecipe`, `const conflit = await repo.get('sync_conflicts', 'recipes:' + params.id);` et, si `conflit?.kind === 'version'`, une `div.card.warn` : `t('Une autre version a été créée ailleurs — les deux versions sont conservées.')` + lien vers Réglages (`#/settings`). Aucune version n'est masquée (la liste des versions de la vue reste entière).

`src/domain/backup.js` `applyArchive(db, inspection, { mode = 'merge', horodater = null })` : en mode `merge`, si `horodater`, pour chaque magasin de `SYNC_STORES` présent dans `batch`, `row.updated_at = horodater()` avant `putBatch`. `settings.js` (restauration) : `horodater: getSyncState().user ? syncNow : null` ; bilan : si `horodater`, ajouter `t('{n} fiches seront renvoyées au serveur.', { n })` où `n` = nombre de fiches des magasins de `SYNC_STORES` dans l'inspection.

- [ ] **Step 4 : vert** — `?v=l3-t9-vert` ; `tests/backup.js` vert ; vérification réelle Playwright sur `localhost:8080` **sans geste destructeur** : l'app démarre (0 erreur console), la pastille est absente quand la file est vide ; si le profil est connecté sur localhost, Réglages montre l'ensemble L3 et « Dernier échange » se pose après « Envoyer maintenant ».

- [ ] **Step 5 : commit** — `git add src/app.js src/ui/state.js src/ui/recipe.js src/domain/backup.js src/ui/settings.js src/i18n/en.js styles.css tests/sync-l3.js && git commit -m "L3 T9 : moteur lance au demarrage, pastille N non envoyes, conflit de version dans la recette, fusion ZIP horodatee"`

---

### Task 10 : clôture — `SHELL`, version, docs, spec § 11

**Files :**
- Modify : `sw.js` (`SHELL` += `./src/sync/transport.js`, `lots.js`, `reponses.js`, `push.js`, `backfill.js`, `pull.js`, `conflits.js`, `moteur.js` ; `VERSION = 'cuisine-os-v0.3.0-1'`), `src/model/schema.js` (`APP_VERSION = '0.3.0'`), `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/spec-compte-et-stockage-distant.md` § 11.

- [ ] **Step 1 : `SHELL` et versions** — le test de complétude de `SHELL` (tests/sync.js) doit être **rouge** avant (il nomme les 8 modules) puis vert.
- [ ] **Step 2 : spec § 11** — une ligne par décision prise pendant L3 (au minimum) : **R37** `auth.getClient()` (seule sortie du client, vers `transport.js`) ; **R38** « adresse non autorisée » (P0001) = attente de connexion + garde refaite, pas une quarantaine ; **R39** les lignes `files` sont **reçues** en L3 (sans octets, `remote: true`, le blob local est conservé) — les octets restent L4 ; **R40** `inconnu` suit le chemin « refus » (dichotomie → quarantaine nommée) ; **R41** la pause quota n'est levée que par « Envoyer maintenant » ; **R42** fusion ZIP horodatée seulement avec un compte connecté ; **R43** conflit « version » = fiche recette écrite + conflit journalisé + bandeau dans la vue, aucune version masquée.
- [ ] **Step 3 : `CLAUDE.md`** — sous-section « Synchronisation L3 livrée (date) » : ce qui marche, ce qui n'est pas prouvé sur appareil (§ 7.3 : iPhone hors ligne → compteur → réseau → Mac ; bibliothèque existante du Mac entièrement arrivée ; suppression propagée ; conflit volontaire résolu — **gestes de Neegan**), dettes différées. `README.md` : la phrase « aucune donnée ne quitte l'appareil » devient « les fiches voyagent entre tes appareils ; les photos, pas encore (L4) ». `docs/architecture.md` : section « Synchronisation (L3) » — carte des 8 modules, ordre d'une passe, états, ce qui est absent (fichiers, purge, tombales lisibles).
- [ ] **Step 4 : vérifications finales** — suite complète verte (`?v=l3-final`), 0 erreur console ; `node --test tools/*.test.mjs` 40/40 ; `node tools/generer-migrations.mjs --check` 0 ; `grep -rn "window.open\|\.stack" src --exclude-dir=vendor` vide ; scan secrets ; U+2028/2029 = 0 par fichier touché ; import ESM réel des 8 modules ; `git status` propre ; **aucune vérification destructrice dans le navigateur**.
- [ ] **Step 5 : commit** — `git add sw.js src/model/schema.js CLAUDE.md README.md docs/architecture.md docs/spec-compte-et-stockage-distant.md && git commit -m "L3 : SHELL, version 0.3.0, architecture, spec section 11 (R37-R43), etat des travaux"`

Puis : revue finale de branche (opus), ONE fix wave, `/verify` (3 lentilles), menu de fin de branche ; **parcours sur appareils par Neegan** (§ 7.3) : iPhone hors ligne → écriture → compteur → réseau → arrivée sur le Mac ; bibliothèque du Mac arrivée sur l'iPhone ; suppression propagée ; conflit volontaire (même fiche modifiée des deux côtés hors ligne) résolu par « Garder celle d'ici ».

---

## Auto-revue du plan (faite le 13 octobre 2026)

1. **Couverture de la spec** — § 5.3 : déclencheurs (T7), lots/ordre/dédoublonnage/bornes (T2), `put` relu / `delete` avec payload / `files` retenu (T2), horloge + avertissement unique (T3, T7), réponses accepted/adjusted/rejected (T3), réseau/5xx/429 recul (T4), 401 attente (T4), 4xx dichotomie (T4), quota pause (T4, T7), quarantaine + gestes (T3, T8), I5 « À envoyer » (T8 lit `outbox`). § 5.2 envoi initial par marqueurs, reprenable, `library_activity` rattrapé (T5, T8) ; fusion ZIP horodatée + bilan (T9). § 5.5 : pagination par curseur, curseur après écriture (T6), tombale / plus ancien / plus récent + renvoi / égalité (T6), conflits + gestes + 30 jours (T6, T8), `current_version_id` (T6, T9), première connexion = envoi initial puis réception (T7), lignes `files` sans octets (T6, R39). § 4.2 L3 : dernier échange, quarantaine, conflits, Envoyer maintenant, progression, pastille, historique rattrapé, « Effacer » compte la quarantaine (T8, T9). § 7.1 L3 : chaque DOIT a son assertion dans T1-T9 ; « transport simulé, aucun réseau » (T1). **Hors plan, assumé** : octets des fichiers (L4), purge serveur et tombales lisibles (L5), « Supprimer ma bibliothèque du serveur » (L5).
2. **Placeholders** — aucun « TBD/TODO » ; chaque étape de code montre le code ; T10 décrit des textes de docs (pas du code) avec leur contenu attendu.
3. **Cohérence des types** — `Erreur { type, status, message, code }` partout ; `Etat` du moteur nommé en T7 et consommé tel quel en T8/T9 ; `createPull` rend `{ recues, supprimees, conflits, erreur }` (T6, T7) ; `createPush().envoyer()` rend `{ envoyes, ajustes, conflits, quarantaine, retenues, erreur, pause, attenteConnexion, recul }` (T3, T4, T7) ; conflits `{ id, store, record_id, local, server, at, kind }` (T3, T6, T8) ; `transport.lire(table, apres, limite)` (T1, T6) ; `appliquerHeureServeur` (T3) consommée par `push.js` et avertissement posé par le moteur (T7).
