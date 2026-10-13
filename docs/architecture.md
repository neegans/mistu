# Architecture — Cuisine OS V0

## Choix

- **PWA sans étape de build** : modules ES natifs, aucune dépendance npm. Un serveur statique suffit. Choix guidé par « éviter la surarchitecture » (spec §15) et par la possibilité de tout vérifier en ouvrant l'app.
- **Local-first** : IndexedDB comme base unique (un magasin par entité), blobs (photos, PDF) stockés dédupliqués par SHA-256 dans le magasin `files`. La sauvegarde complète (ZIP) est le mécanisme de durabilité et de transfert entre appareils. Un backend Supabase/Postgres pourra reprendre le même modèle plus tard; aucune synchronisation serveur n'est prétendue.
- **Déterministe avant IA** : unités, portions, courses, régimes, sauvegarde et recherche sont du code sans LLM. L'IA est une abstraction `LLMProvider` (aucun, compatible OpenAI, Anthropic) branchée uniquement sur l'extraction de pages et d'index; ses résultats sont toujours « à vérifier ».

## Carte des modules

```text
index.html, styles.css, manifest.webmanifest, sw.js
src/app.js                 coquille, navigation, routes
src/core/    db.js (IndexedDB), router.js (#/…), dom.js (el, dialogues), i18n.js (FR clé, EN dictionnaire), hash.js (SHA-256 + repli), zip.js (ZIP stored), ids.js, bus.js
src/model/   schema.js (magasins, relations, vocabulaires), seed.js (unités, conventions, ingrédients FR/EN, presets d'appareils), repo.js (accès, réglages, activité, fichiers)
src/domain/  quantity.js (fractions, plages, qualitatif), units.js (conventions, conversions, affichage), lines.js (analyse d'une ligne d'ingrédient), scaling.js,
             diet.js, grocery.js, search.js (langage naturel → pastilles; groupes), dishes.js (rapprochement, comparaison), pairing.js (accompagnements, résumé de repas),
             rediscover.js, timers.js, backup.js (archive, inspection isolée, restauration, vérification), exporters.js (JSON-LD, YAML Paprika, HTML), llm.js
src/ui/      state.js (cache), components.js, home, search, library, book, dish, recipe, recipe-edit, cook, import, meals, grocery, kitchen, settings, add
src/sync/    tables.js, mime.js, clock.js, outbox.js, config.js, auth.js — voir « Synchronisation (L1-L2) »
src/core/log.js            point d'entrée unique du journal d'erreurs (logError)
src/vendor/  supabase-2.117.3.umd.js (dépendance embarquée, vérifiée deux fois)
tests/       tests.js + index.html : tests du domaine ; backup.js : régressions IndexedDB dans des bases temporaires ; sync.js : lot « compte et stockage distant »
```

## Dépendance embarquée

`supabase-js` est embarqué en un seul fichier autonome, jamais installé par `npm` à l'exécution (spec § 6.1) :
`src/vendor/supabase-2.117.3.umd.js` est une copie **octet pour octet** de `dist/umd/supabase.js` tiré du tarball
npm officiel `@supabase/supabase-js@2.117.3` (bundle IIFE, `globalName` `supabase`, ~213 Ko). Il est chargé par un
`<script src="./src/vendor/supabase-2.117.3.umd.js">` **classique** (jamais `type="module"`, un IIFE n'y
exposerait rien), **avant** `src/app.js` dans `index.html` et avant `tests.js` dans `tests/index.html`. Le bundle
`+esm` de jsDelivr est exclu : il importe huit modules du CDN à l'exécution, ce qui violerait la CSP
`script-src 'self'` et la portée « aucune dépendance npm à l'exécution ».

**Deux vérifications distinctes**, faites par `tools/verifier-vendor.mjs` (Node, zéro dépendance) :
1. l'archive `.tgz` obtenue par `npm pack @supabase/supabase-js@2.117.3` (sans `npm install`) confrontée au
   `dist.integrity` publié par le registre npm (sha512 en base64) ;
2. le fichier `dist/umd/supabase.js` extrait de cette archive (`tar -xzf …tgz package/dist/umd/supabase.js`) haché
   en sha256 et comparé octet pour octet au même fichier servi par unpkg
   (`https://unpkg.com/@supabase/supabase-js@2.117.3/dist/umd/supabase.js`).

Obtention (dans un dossier hors dépôt, jamais le `.tgz` commité) :

```sh
cd <dossier hors dépôt> && npm pack @supabase/supabase-js@2.117.3
tar -xzf supabase-supabase-js-2.117.3.tgz package/dist/umd/supabase.js
node tools/verifier-vendor.mjs 2.117.3 <chemin du .tgz> package/dist/umd/supabase.js
```

Sortie obtenue le 12 octobre 2026 (les deux vérifications réussies) :

```json
{
  "version": "2.117.3",
  "integrity_registre": "sha512-K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==",
  "archive_ok": true,
  "umd_sha256": "d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3",
  "unpkg_sha256": "d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3",
  "umd_ok": true
}
```

Mise à jour : **manuelle**, jamais automatique. Pour une nouvelle version, refaire les deux vérifications
ci-dessus (ou, pour revérifier seulement le fichier déjà commité sans ravoir l'archive :
`node tools/verifier-vendor.mjs --local src/vendor/supabase-<version>.umd.js <version>`, qui ne fait que (2) et
imprime le sha256), puis remplacer le fichier dans `src/vendor/` et les deux `<script>` qui le chargent.

## Synchronisation (L1-L2)

Spec du lot : `docs/spec-compte-et-stockage-distant.md` (conception amont : `docs/compte-et-stockage-distant.md`).
Livré ici : le serveur en migrations, la connexion, la capture des écritures. **Pas** l'échange de données.

### Modules

```text
src/sync/tables.js    TABLES : par magasin synchronisable, la clé, les colonnes générées (index de STORES + size/mime
                      pour files) et les champs de relation obligatoires. Source de vérité du générateur de migrations.
                      keyOf(store, record) : la clé d'une fiche, fonction unique (outbox, envoi, réception).
src/sync/mime.js      liste blanche fermée des six types synchronisables, resolveMime (type déclaré, sinon extension,
                      sinon application/octet-stream + syncable:false), safeDisplayType, extensionFor, displayUrl.
src/sync/clock.js     syncNow() : horloge corrigée du décalage serveur, strictement croissante (offset 0 avant L3).
src/sync/outbox.js    installCapture(db, …) : pose db.onMutate ; ne fait que remplir la file.
src/sync/config.js    SUPABASE.prod / SUPABASE.dev (url + anonKey, valeurs publiques), currentConfig(hostname).
src/sync/auth.js      createAuth : client PKCE depuis globalThis.supabase, signIn/signOut, handleReturn (échange du
                      code puis retrait de l'historique), garde de compte, readError (phrase fixe, jamais le texte brut).
src/core/log.js       logError(code, details) : un code et une liste blanche d'identifiants ; jamais e.stack, jamais
                      le corps d'une réponse. Seul console.error du dépôt (reste un console.warn dans app.js quand
                      l'enregistrement du service worker échoue).
```

### Une seule porte d'écriture

`db.mutate({ puts, deletes, clearStores, origin, payloads })` est la seule transaction d'écriture de `src/core/db.js` ;
`put`, `putMany`, `putBatch`, `delete`, `deleteMany`, `clear`, `clearAll` en sont des enveloppes (`MUTATING_METHODS`).
`installCapture` y branche `db.onMutate`, qui renvoie les lignes d'outbox **écrites dans la même transaction** que la
donnée : une écriture annulée ne laisse aucune entrée de file.

- Une suppression met en file son `payload` (copie de la fiche au moment de la suppression) ; un `put` sera relu à
  l'envoi.
- `origin: 'remote'` (réception, ajustement d'horloge) et `origin: 'device'` ne sont **jamais** capturés.
- `settings` n'est pas synchronisable ; `library_activity` n'entre en file que si le réglage « Synchroniser mon
  historique de consultation » est actif (lu par `src/ui/state.js`, relu à chaque événement qui peut le réécrire).
- Une ligne `files` hors liste blanche (`syncable: false`, ou un `mime` absent de la liste) reste locale et n'entre
  jamais en file.
- Un test statique de `tests/sync.js` échoue si un fichier de `SHELL` autre que `src/model/repo.js`, `src/sync/*`,
  `src/domain/backup.js` et `src/core/db.js` appelle une méthode mutante de `db` directement.

### Magasins internes

`SYNC_INTERNAL_STORES = ['outbox', 'sync_state', 'sync_conflicts']` (`DB_VERSION` 2). Ils sont **hors archive** :
`ARCHIVE_DATA_STORES` les exclut, l'inspection et la vérification de restauration n'en voient aucune trace, les puces
« Données sur cet appareil » ne les listent pas, et un remplacement par ZIP ne les vide pas. Seul `repo.clearDevice()`
les vide — en une transaction sans capture, en gardant `sync_state.device_id`. L'identité d'appareil vit dans
`sync_state.device_id` (plus aucun reflet dans `localStorage`) ; l'ancienne clé `cuisineos.device` est reprise une
seule fois puis retirée.

### Dépendance embarquée

`src/vendor/supabase-2.117.3.umd.js`, chargé par un `<script>` classique avant `src/app.js` (détail et procédure :
« Dépendance embarquée » ci-dessus). Deux empreintes, vérifiées par `tools/verifier-vendor.mjs` :

- fichier servi (sha256) : `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3` ;
- tarball npm (`dist.integrity` du registre) : `sha512-K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==`.

Si `globalThis.supabase?.createClient` est absent, `createAuth` reste indisponible avec le motif `bibliotheque` et
l'interface le dit ; l'application démarre quand même (invariant I4 : utilisable sans compte).

### Durcissement du client

`index.html` **et** `tests/index.html` portent la même balise
`Content-Security-Policy` — `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none';
form-action 'none'` — et `<meta name="referrer" content="no-referrer">`. `script-src 'self'` n'est jamais élargi ;
`frame-ancestors` n'est jamais ajouté (WebKit l'hérite dans un document `blob:` et refuse alors le cadre) ;
`connect-src https:` reste large parce que la `base_url` d'un fournisseur d'IA est libre. Les PDF et EPUB s'affichent
dans une `<iframe sandbox>` sans `allow-same-origin`, avec un bouton de téléchargement permanent ; aucun
`window.open` sur un `blob:` ne subsiste.

Service worker : `sw-rules.js` (partagé avec les tests par `importScripts`) ne met en cache que les GET de même
origine **sans chaîne de requête** — un retour `?code=…` est servi par le réseau et jamais stocké.

### Côté serveur

`supabase/migrations/0001_tables_et_regles.sql` (séquence `sync_seq`, 25 tables, déclencheur `server_seq`, RLS avec
`is_allowed()` sur chaque règle, règle `delete` gardée par `app.purge`, schéma `private`, fonction du crochet
« Before User Created » + déclencheur de secours, `sync_push`, `sync_purge`, `sync_purge_all`, révocations, tâche
`pg_cron` des tombales) et `supabase/migrations/0002_stockage.sql` (seau privé `pages`, ses quatre règles, vue
`private.storage_usage`). Les deux fichiers sont **générés** par `tools/generer-migrations.mjs` depuis
`src/sync/tables.js` et `src/sync/mime.js` : ne pas les éditer à la main ;
`node tools/generer-migrations.mjs --check` sort en code 1 si les fichiers commités diffèrent du généré.
Application et preuves : `supabase/README.md` (gestes manuels de Neegan dans l'éditeur SQL, preuves `supabase/proofs/`).

### Ce qui est absent (L3 et après)

- **Envoi** : il n'y a pas de `src/sync/push.js`. La file se remplit et ne se vide jamais ; rien n'est transmis au
  serveur. `sync_push` existe en base, sans appelant côté client.
- **Réception** : pas de `src/sync/pull.js`, pas de curseur consommé, pas d'envoi initial (`backfill`).
- **Conflits** : `sync_conflicts` existe comme magasin ; rien ne l'écrit ni ne le présente.
- **Fichiers distants** : pas de `src/sync/files.js` — aucun téléversement, aucun téléchargement, aucune ligne
  `files` marquée `remote`, pas de qualité d'envoi, pas d'affichage de l'espace serveur (L4).
- **Suppression réelle et tombales** : `sync_purge` / `sync_purge_all` existent en base, sans appelant côté client
  (L5). La purge de l'objet de stockage passe par l'API Storage, pas par le SQL.
- **Horloge** : `clock.js` garde un décalage de 0 — personne ne mesure encore `server_time`.

## Modèle de données (magasins IndexedDB)

`books`, `book_editions` (ISBN, langue, `unit_convention_id`), `source_documents` (fichier, sha256, type), `source_pages` (page imprimée, position),
`scan_sessions`, `dishes` (libellés FR/EN embarqués), `dish_recipe_links` (proposé / confirmé / refusé), `recipes` (titre original, disponibilité, vérification, favori, pages sources, `current_version_id`),
`recipe_versions` (extraction / correction / adaptation / traduction / synthèse; ingrédients avec texte source, quantité, unité, identité proposée; étapes à identifiant stable; provenance avec instantané de convention),
`recipe_translations`, `ingredients` (identité neutre, libellés FR/EN, `contains` pour les régimes, équivalences documentées), `unit_definitions`, `unit_conventions` (révision),
`substitutions`, `appliances` (capacités), `cook_history` (version exacte, portions, quantités effectivement utilisées), `cook_sessions` (progression par identifiant d'étape),
`inventory`, `meals` (éléments avec rôle, portions, verrouillage), `meal_feedback`, `shopping_lists`, `library_activity`, `rediscovery_prefs`, `timer_launches`, `files`, `settings`.

Règles : identifiants stables préfixés; une correction crée une version (jamais de réécriture); l'historique référence la version et un instantané des quantités; les adaptations sont des versions, sans table concurrente.

## Sauvegarde

Archive ZIP « stored » : `manifest.json` (format `cuisine-os-archive` v1, décomptes, liste des fichiers avec SHA-256), `data/<magasin>.json`, `files/<sha256>.<ext>`, `README.txt`.
L’export lit tous les magasins dans une transaction IndexedDB commune, puis construit et hache l’archive en mémoire. Les fichiers sources sont rehachés avant export. Si des relations sont déjà incohérentes dans la bibliothèque, l’archive peut être conservée avec un avertissement visible ; elle sera refusée à la restauration tant que les incohérences ne sont pas résolues. Aucune donnée n’est supprimée ou réparée automatiquement.

L’inspection exige tous les magasins de données et les réglages, leurs décomptes et leurs empreintes. Elle refuse les clés absentes ou dupliquées, les chemins ZIP répétés, les entrées non déclarées, les fichiers corrompus et les relations connues cassées. Les chemins de relations dans le schéma peuvent traverser des objets et des tableaux. Il s’agit d’une validation de structure, de clés et de relations, pas d’un contrôle de tous les champs métier.

La restauration prépare les objets et fichiers avant toute écriture. La fusion et le remplacement utilisent une seule transaction ; en remplacement, les vidages font partie de cette transaction. Une exception synchrone ou une erreur IndexedDB annule les écritures du lot. En fusion, les fiches portant le même identifiant sont remplacées, les autres sont conservées ; les métadonnées locales des fichiers existants sont conservées et leurs octets sont réécrits depuis l’archive validée. Les réglages secrets sont ignorés à l’import ; en remplacement, les secrets locaux sont effacés avec les autres réglages.

La vérification relit un instantané commun et compare le contenu JSON complet des fiches importées, leurs clés, les relations déclarées, les tailles/types et empreintes des fichiers. En remplacement, les décomptes doivent aussi être identiques ; en fusion, des fiches supplémentaires sont permises. Le bilan reste visible et l’utilisateur recharge explicitement l’application. Les anciennes commandes sont désactivées pour éviter d’exporter un contexte périmé.

Le format reste v1 : les archives complètes produites précédemment restent lisibles si elles satisfont les contrôles renforcés. Les versions inconnues sont refusées. ZIP64 et les entrées compressées/chiffrées ne sont pas pris en charge ; les limites du ZIP standard sont contrôlées avant génération. Les archives et photos restent chargées en mémoire : les gros volumes et le quota sur iPhone restent à valider.

« Dernière archive générée » atteste seulement la génération et le déclenchement du téléchargement. Le navigateur ne confirme pas l’enregistrement dans Fichiers. Les scénarios automatisés ajoutés dans tests/backup.js utilisent exclusivement des bases temporaires cuisine-os-backup-test-* ; ils n’ont pas été exécutés pendant cette modification.

## Limites connues de V0

- Pas d'échange de données entre appareils : transférer par archive. Le lot L1-L2 pose le serveur, la connexion et la
  capture des écritures ; l'envoi et la réception arrivent en L3 (voir « Synchronisation (L1-L2) »).
- Pas de reconnaissance vocale; minuterie confiée au système (Siri / raccourci).
- EPUB conservé mais non rendu; PDF affiché via le lecteur du navigateur, pages référencées à la main.
- Interface anglaise partielle (dictionnaire `src/i18n/en.js`).
- Adaptations Rapide / On se gâte / Meal prep, moteur de salubrité, planificateur multi-repas et synthèse : paliers V1–V1.5, non implémentés (indiqués comme tels dans l'interface).
