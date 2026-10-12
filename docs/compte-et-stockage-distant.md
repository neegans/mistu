# Cuisine OS — compte, stockage distant et trajectoire « pour l'entreprise »

*Brief d'architecture écrit par Claude Code (terminal) le 12 octobre 2026, à la demande de Neegan, pour la
session VibeForge qui construit Cuisine OS. Il répond aux trois questions posées le 12 octobre (sur quoi
tourne le portail Oraquan, ce qu'est Capture, comment une app « s'ajoute ») et fixe la conception du lot
« Compte et stockage distant ». Ce qui est décidé est marqué **DÉCIDÉ** ; ce qui reste ouvert, **OUVERT**.*

## 1. La réponse aux trois questions

**Le portail Oraquan et Capture.** `oraquan-system` est le système de production de l'entreprise de Neegan :
comptabilité, paie, reçus de dépenses, membres, archives. Il tourne sur Cloud Run (Node), un Supabase « Canada
PROD » (22 tables sous RLS), Google Drive (un Drive partagé d'entreprise, seul lieu d'écriture autorisé) et
Monday. **Capture** est la PWA du personnel : pointage des heures et photos de reçus, lues par une IA puis
classées dans le Drive partagé. Sa connexion est celle des employés. Il est soumis à des règles de conformité
(moindre privilège, trace d'audit, un seul arbre de code servi).

**DÉCIDÉ — Cuisine OS n'entre pas dans oraquan-system ni dans Capture.** Trois raisons :
1. des livres de cuisine et des milliers de photos personnelles n'ont rien à faire dans le périmètre
   comptable et salarial de l'entreprise (sécurité, facture, confiance des employés) ;
2. un bug dans une recette ne doit jamais pouvoir toucher la prod comptable ;
3. la connexion du portail est une identité d'employé, pas une identité personnelle multi-appareils.

**DÉCIDÉ — Cuisine OS reçoit sa propre maison : un projet Supabase « mistu », région Canada**, avec la même
recette qu'Oraquan (connexion Google, règles appliquées côté serveur, stockage privé) mais **aucun serveur,
aucune base, aucun compte en commun**. L'écran de consentement Google se crée dans un **projet Google Cloud
personnel** de Neegan, pas dans `oraquan-comptable`. Ce qu'on réutilise d'Oraquan, c'est le savoir-faire :
RLS, file d'envoi hors ligne qui ne dit « reçu » qu'après réception, résultats d'IA toujours « à vérifier ».

## 2. La trajectoire : un jour, le service pour les employés d'Oraquan

Neegan veut **à terme** offrir ce livre de recettes à ses employés. Ça ne se construit pas maintenant
(`PROJET.md` : multi-utilisateurs hors périmètre de V0), mais **la conception d'aujourd'hui ne doit pas
fermer la porte**. Voie recommandée (**OUVERT**, à décider le moment venu) : Cuisine OS reste un service à
part, les employés s'y connectent avec leur compte Google d'entreprise (`@oraquan.com`), et le portail Oraquan
n'ajoute qu'une tuile vers l'app. L'isolation reste une qualité, pas un obstacle : on « ajoute » le service,
on ne fusionne pas les bases.

**DÉCIDÉ — ce que ça impose dès ce lot, sans rien construire de multi-utilisateur :**
- chaque ligne de données personnelles porte `owner_id uuid` (= `auth.uid()` du compte) ; les règles RLS
  disent « chacun voit et écrit sa propre bibliothèque » — c'est déjà, mécaniquement, du multi-utilisateur ;
- les **références** amorcées par l'app (`unit_definitions`, `unit_conventions`, `ingredients` de base) sont
  distinguées des données personnelles : lignes sans `owner_id` (`owner_id` NULL = référence commune, lisible
  par tous, modifiable par personne depuis l'app) ; une correction personnelle d'une référence crée une ligne
  à soi, comme aujourd'hui une version crée une ligne ;
- les fichiers sont rangés par propriétaire : `pages/{owner_id}/{sha256}.{ext}` ;
- la liste des personnes autorisées vit dans une table (`allowed_users(email)`), jamais dans le code public ;
  plus tard, une règle « tout `@oraquan.com` » remplacera la liste sans toucher au reste ;
- aucune adresse, aucun nom, aucune clé secrète dans le dépôt (il est public).

**Reporté, à ne pas construire :** partage de recettes entre personnes, bibliothèque commune d'entreprise,
rôles, tuile et connexion unique dans le portail, facturation.

## 3. Ce qui ne change pas

- **PWA sans build**, hébergée sur GitHub Pages (`https://neegans.github.io/mistu/`), aucune dépendance npm.
- **Le modèle** : les 26 magasins gardent leurs noms, leurs identifiants (`text`, préfixés, générés par l'app)
  et leurs relations. Le format d'archive ZIP `cuisine-os-archive` v1 reste valide : l'export peut se faire
  depuis l'état local comme aujourd'hui.
- **Local-first** : IndexedDB reste la base de travail de l'appareil ; le serveur devient la source de vérité
  **une fois qu'il a accusé réception**. Sans compte, l'app fonctionne exactement comme aujourd'hui (mode
  local) ; « Se connecter avec Google » s'appelle, dans l'interface, **« Activer la synchronisation »**.
- Les principes de la spec : l'original n'est jamais réécrit, aucune donnée inventée, les états d'interface
  reflètent des événements réels (« envoyé » = accusé de réception du serveur, jamais avant).

## 4. Architecture cible

### 4.1 Connexion
- Supabase Auth, fournisseur Google, flux PKCE (app sans serveur), redirection vers l'URL de l'app.
- **Deux barrières** contre un compte Google étranger : (a) un déclencheur `before insert on auth.users` qui
  refuse toute adresse absente de `allowed_users` (la connexion échoue proprement) ; (b) les règles RLS, qui
  ne laissent de toute façon rien lire ni écrire à un compte sans lignes à lui.
- Session durable (rafraîchissement automatique), bouton « Se déconnecter » dans Réglages.
- `supabase-js` est **embarqué dans le dépôt** (`src/vendor/`, version épinglée, empreinte SHA-256 notée dans
  `docs/architecture.md`), jamais chargé depuis un CDN : l'app doit s'ouvrir hors ligne et les versions
  restent sous contrôle.

### 4.2 Base de données
- **DÉCIDÉ : une table par magasin, même nom**, avec des colonnes stables et le contenu en `jsonb` :
  `id text primary key`, `owner_id uuid` (NULL = référence commune), `data jsonb not null`,
  `updated_at timestamptz not null`, `deleted_at timestamptz` (pierre tombale : indispensable pour synchroniser
  une suppression entre appareils), plus des **colonnes générées** depuis `data` pour les relations indexées
  (`recipe_id`, `edition_id`, `book_id`, `recipe_version_id`, `sha256`…). Pourquoi : le modèle est déjà en
  JSON côté app, l'archive ZIP reste identique, et une relation indexée se requête aussi vite qu'une vraie
  colonne. Les contraintes de relation sont vérifiées par les règles de l'app et par la vérification de
  restauration, comme aujourd'hui.
- RLS sur chaque table : `select` si `owner_id = auth.uid() or owner_id is null` ; `insert/update/delete`
  si `owner_id = auth.uid()`. Les références communes se modifient seulement par migration.
- `allowed_users(email text primary key, added_at)` : lecture interdite depuis l'app ; alimentée par Neegan
  dans l'éditeur SQL de Supabase (les adresses ne transitent jamais par le dépôt ni par l'agent).
- Les migrations SQL vivent dans le dépôt (`supabase/migrations/NNNN_*.sql`, sans aucune valeur personnelle)
  et sont **appliquées par Neegan** dans l'éditeur SQL ; chaque migration a sa requête de preuve (voir § 6).

### 4.3 Fichiers (photos de pages, PDF)
- Bucket privé `pages`, chemin `{owner_id}/{sha256}.{ext}` ; règles sur `storage.objects` : le premier
  segment du chemin doit être `auth.uid()`.
- Déduplication par SHA-256 conservée (le magasin `files` garde `sha256`, `mime`, `size`, et désormais
  `remote: { uploaded_at }`).
- **OUVERT :** qualité des photos envoyées. Le principe de provenance plaide pour l'original ; le coût plaide
  pour une réduction (JPEG, grand côté ≈ 2 000 px). Proposition : original par défaut, réglage « Qualité
  d'envoi » visible avec l'estimation de taille, et le choix noté dans la provenance.

### 4.4 Synchronisation (la partie qui demande le plus de soin)
- **File d'envoi locale** (`outbox`, nouveau magasin IndexedDB) : chaque écriture locale ajoute une entrée
  `{ store, id, op, updated_at }` ; un envoyeur la vide quand le réseau le permet, dans l'ordre, par lots ;
  une entrée ne disparaît qu'après l'accusé de réception. L'interface montre « N éléments non envoyés ».
- **Réception** : par table, `updated_at > dernier_point_de_synchro` (et `deleted_at` pour les tombales).
- **Conflits** : les versions de recettes sont immuables (jamais réécrites) donc sans conflit ; pour les
  autres fiches, la plus récente (`updated_at`) gagne, et l'ancienne est conservée dans l'historique local
  pendant 30 jours pour pouvoir la retrouver. Aucune fusion silencieuse de champs.
- Un **second appareil** qui se connecte pour la première fois reçoit toute la bibliothèque (données d'abord,
  fichiers à la demande puis en arrière-plan).
- Le service worker ne met jamais en cache la page de retour de connexion ni les appels à Supabase ; les
  fichiers reçus sont mis en cache localement (IndexedDB `files`), pas par le service worker.

### 4.5 Ce qui reste local
- Les clés d'IA (`settings.llm`) restent dans les réglages de l'appareil, exclues de la sauvegarde et de la
  synchronisation, comme aujourd'hui.
- La clé `anon` de Supabase est **publique par conception** et va dans le code ; la clé `service_role` ne
  doit jamais être donnée à un agent ni écrite nulle part dans le dépôt.

## 5. Ce que fait Neegan (une fois, ~30 minutes)

1. **Supabase** — supabase.com → New project : nom `mistu`, région Canada (Central), mot de passe de base
   généré (le garder dans son gestionnaire ; personne d'autre n'en a besoin).
2. **Google Cloud (projet personnel, pas `oraquan-comptable`)** — APIs & Services → OAuth consent screen :
   External, nom « Cuisine OS », son courriel, statut Testing, **ses deux adresses en Test users** ;
   Credentials → OAuth client ID → Web application : origine `https://neegans.github.io`, redirection
   `https://<ref>.supabase.co/auth/v1/callback` (`<ref>` = Project URL de Supabase).
3. **Supabase** → Authentication → Providers → Google : activer, coller Client ID + secret ; URL Configuration :
   Site URL `https://neegans.github.io/mistu/`, Redirect URLs `https://neegans.github.io/mistu/**` et
   `http://localhost:8080/**`.
4. Donner à l'agent : **Project URL** et **clé anon** (publiques). Coller lui-même dans l'éditeur SQL la
   ligne d'`allowed_users` que l'agent lui prépare (avec ses deux adresses).

## 6. Ordre de construction (lots bite-size, chacun prouvé avant le suivant)

| Lot | Contenu | Preuve attendue |
|---|---|---|
| L1 | Migration SQL : tables, colonnes générées, tombales, RLS, `allowed_users` + déclencheur, bucket et règles | Avec les **deux adresses de Neegan comme deux comptes** : A écrit, B ne voit rien ; un compte hors liste ne peut pas se connecter ; une référence commune est lisible et non modifiable |
| L2 | Connexion : `src/vendor/supabase-js`, « Activer la synchronisation », session, déconnexion, service worker ajusté | Sur Mac puis iPhone installé : détour Google → retour dans la PWA plein écran, session conservée après fermeture |
| L3 | File d'envoi + réception des **données** (sans fichiers) | Recette créée hors ligne sur iPhone → compteur « non envoyé » → réseau → accusé → visible sur Mac ; suppression propagée ; conflit volontaire résolu comme prévu |
| L4 | Fichiers : envoi des photos/PDF, réception à la demande | Photo prise sur iPhone → visible dans la fiche sur Mac ; même SHA-256 des deux côtés |
| L5 | Second appareil : première connexion reçoit tout ; archive ZIP toujours exportable | Base vide sur iPad → bibliothèque complète ; ZIP exporté = même décomptes et empreintes que sur Mac |

Règles de travail pour la session VibeForge : écrire les tests avant le code (`tests/`), **ne jamais annoncer
un résultat non exécuté** — c'est Neegan qui joue `tests/index.html` et les parcours sur appareil et qui colle
les résultats ; chaque lot finit par une entrée dans `CLAUDE.md` (état des travaux) et `docs/architecture.md`.
Avant la mise en service réelle (fin L2 au plus tard), Neegan peut demander à Claude Code (terminal) une
**revue adverse de sécurité** des migrations et des règles RLS, jouée contre le vrai projet.

## 7. Décisions confirmées par Neegan le 12 octobre (« ok Go »)

1. **DÉCIDÉ** — la voie « service à part + tuile dans le portail » pour les employés, plutôt qu'une fusion des bases (§ 2).
2. **DÉCIDÉ puis RÉVISÉ le 12 oct (spec § 9, D2)** — les photos : **réduite par défaut** (~400 Ko), originale au
   choix ; l'original reste sur l'appareil. Raison : le palier gratuit (1 Go) ne tient que ~500 pages en originales.
   Les décisions D5 (origine dédiée), D6 (historique non synchronisé par défaut), D7 (tombales 90 jours) et D8 (second
   projet Supabase pour le développement) sont prises le même jour : voir la spec § 9.
3. **DÉCIDÉ** — le coût : palier gratuit pour commencer ; Pro (~25 $ US/mois) quand la bibliothèque dépasse 1 Go de fichiers.
4. **DÉCIDÉ — hébergement : le nuage Supabase d'abord.** Neegan a demandé si la bibliothèque pouvait vivre « sur un
   ordinateur branché en permanence » chez lui. Réponse : oui, par Supabase auto-hébergé (même logiciel, même base,
   même `supabase-js` : l'app ne voit que l'adresse changer ; copie de base en une commande), à condition d'une
   machine dédiée allumée 24 h/24, d'une adresse HTTPS (Cloudflare Tunnel) et de sauvegardes automatiques hors de
   la machine. Le Mac actuel n'est pas candidat (disque à 97 %, aucune sauvegarde, Docker en panne). On construit
   donc L1-L5 dans le nuage, sans rien qui empêche un rapatriement plus tard. **OUVERT** : une sauvegarde ZIP
   automatique du serveur vers une machine de Neegan chaque nuit (« mes données chez moi »), si demandée.

## 7 bis. La spécification remplace les détails de ce brief

`docs/spec-compte-et-stockage-distant.md` (v2, relue par deux revues adverses) fait foi pour tout ce qui est
technique. En particulier, elle **remplace** ici : § 4.2 (règle `delete` → aucune : tombales + `sync_purge`),
§ 4.4 (curseur par `updated_at` → curseur serveur `server_seq` ; « 30 jours » → `sync_conflicts`), § 4.1 (deux
barrières → trois, B0 Google *Testing* nommée), § 4.3 (chemin sans extension, liste blanche MIME, pas de TUS) et
§ 6 L2 (la capture des écritures commence dès L2). Les décisions D5-D8 de la spec § 9 s'ajoutent à D1-D4.

## 8. Qui fait quoi maintenant

- **Neegan** : les réglages du § 5 (Supabase + Google Cloud personnel), puis donner Project URL + clé anon.
- **La session VibeForge (Claude A)** : L1 — écrire `supabase/migrations/0001_*.sql` et ses requêtes de preuve,
  puis L2 dès que l'URL et la clé existent. Rien n'est appliqué dans Supabase par l'agent : Neegan colle les
  migrations dans l'éditeur SQL après la revue.
- **Claude Code (terminal)** : revue adverse de L1 (règles RLS, déclencheur, règles du bucket) **avant** que Neegan
  n'applique la migration, puis revue de L2 avant la première connexion réelle.
