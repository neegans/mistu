# Audit L10 — livraison, service worker, hors ligne (Mistu / Cuisine OS)

Copie figée du commit `247b2e5` (30 oct. 2026), lue dans ``. Chemins relatifs à cette copie.
Aucun git, aucun réseau hors `127.0.0.1:8199`, aucune écriture hors `rapports/livraison/`.

## 0. Verdict

**Le cœur est solide ; les trous sont autour.** Le générateur, le manifeste signé et le worker immuable font ce
qu'ils promettent (fermeture des imports, SHA vérifié à l'installation, à chaque hit et au diagnostic, pas de mélange
A/B, OAuth jamais mis en cache). Rien dans ce lot ne perd de données IndexedDB ni ne fige un appareil *par le code
du worker*. Les trous sont dans **la couture démarrage ↔ cycle de vie du worker** et dans **ce que personne ne voit** :

- une **course au premier lancement après chaque publication** qui envoie sur l'écran « La livraison hors ligne n'est
  pas vérifiée. Fermez les anciens onglets… » (I1) ;
- une **adoption depuis le worker historique 0.31.0** qui coûte 5 s d'attente + le même écran, sans dire que c'est
  l'ancienne version, sans indicateur de téléchargement, et qui laisse l'ancien cache pour toujours (I2) ;
- **aucun `navigator.storage.persist()`** : photos, PDF et file d'envoi vivent dans un stockage évincable (I3) ;
- **aucun filet hors de la machine du développeur** : pas de CI, et l'application ne lit jamais le manifeste
  public → une publication sans régénération ou une installation qui échoue (quota, CDN, MIME) reste **muette** (I4, I5) ;
- un **coût de démarrage** (3 vérifications complètes de 3,6 Mo + re-hachage de chaque module) borné à 5 s par
  demande, non mesuré sur iPhone (I6, inférence).

Aucun bloquant au sens « perte de données certaine ». Six points importants, six moyens, quatre mineurs.

## 1. Commandes exécutées (dans la copie uniquement)

| Commande | Résultat exact |
|---|---|
| `node tools/generer-livraison.mjs --check` | `0.32.0-5 : 208 fichiers, 3608736 octets, 48b6b6b1cebfcc672d4ba04c6d91c676fe311679f824ac61e94f3b37e87d93b2` — **EXIT 0** |
| `node --test --test-concurrency=1 tools/livraison-worker.test.mjs tools/livraison-generateur.test.mjs tools/generer-livraison.test.mjs` | **tests 39, pass 39, fail 0** (Node v24.14.1) |
| `curl -sI http://127.0.0.1:8199/{sw.js,manifest.webmanifest,icons/icon.svg,index.html,src/app.js}` | `text/javascript`, `application/manifest+json`, `image/svg+xml`, `text/html`, `text/javascript` (serveur Python local : ne dit rien de GitHub Pages) |
| Journaux déjà présents (`audit/check-livraison.log`, `audit/node-tests.log`) | `--check` EXIT 0 ; Node 271/271 |

Lu intégralement : `sw.js`, `sw-rules.js`, `index.html`, `manifest.webmanifest`, `tools/generer-livraison.mjs`,
`tools/livraison-entrees.mjs`, `tools/service-worker.template.js`, les trois tests Node du générateur,
`src/demarrage.js`, `src/core/livraison.js`, `src/core/livraison-format.js`, `src/ui/mise-a-jour.js`,
`src/domain/diagnostic-app.js`, `src/domain/hors-ligne.js`, la spec design, le contrat A et le rapport de Codex ;
grep ciblé dans `src/ui/settings.js`, `src/ui/hors-ligne-repas.js`, `src/sync/fichiers.js`, `src/core/image.js`,
`src/app.js`, `tests/`. Ancien worker 0.31.0 lu dans `diff-tools-sw.patch` (lignes `-` de `sw.js`).

## 2. Carte des constats

| # | Gravité | Titre | Où |
|---|---|---|---|
| I1 | important | Course `updatefound`/`statechange` pendant la vérification de démarrage → écran de choix à chaque publication | `src/demarrage.js:49-52`, `src/core/livraison.js:22,49` |
| I2 | important | Adoption depuis le worker historique : 5 s muets, écran générique, aucun indicateur d'installation, ancien cache jamais purgé | `src/demarrage.js:48-52`, `sw.js:47`, `src/ui/mise-a-jour.js:42` |
| I3 | important | Aucun `storage.persist()` : photos/PDF/outbox évincables (Safari 7 j, Chrome LRU) | grep `src/` = 0 occurrence |
| I4 | important | Dérive serveur ↔ worker invisible : pas de CI, manifeste public jamais relu par l'app | `tools/generer-livraison.mjs:29-30`, `.github/` absent |
| I5 | important | Échec d'installation silencieux et sans reprise partielle (quota, MIME, CDN périmé, réseau) | `sw.js:45-46`, `src/ui/mise-a-jour.js:42` |
| I6 | important (inférence) | Démarrage contrôlé = 3 vérifications complètes + re-hachage par module, 5 s de délai chacune | `src/demarrage.js:40-41,49`, `sw.js:44,48`, `livraison-format.js:2` |
| M1 | moyen | `/tests/` dans un onglet contrôlé teste les modules du cache actif, pas ceux publiés | `sw-rules.js:15-23`, `tests/index.html:14-16` |
| M2 | moyen | Première installation bornée à 15 s ; message inadapté ; auto-reprise coupée après « Reprendre » | `src/demarrage.js:21,30-31,48` |
| M3 | moyen | Fuite de caches : pré-L10 jamais supprimé, orphelin si `delete` échoue après `meta.put` | `sw.js:47` |
| M4 | moyen (inférence Safari) | `<link rel=manifest>`/`apple-touch-icon` posés dynamiquement après décision | `src/demarrage.js:17`, diff `index.html` |
| M5 | moyen | 503 texte brut « Coquille indisponible » sans page de secours | `sw.js:48` |
| M6 | moyen | Diagnostic : `delai` 5 s → `inconnue` alors que le cache est complet ; compteurs figés sous rétention | `src/ui/settings.js:73-76,97` |
| m1–m4 | mineur | Un seul message pour 5 causes ; écran de démarrage sans CSS ; `/mistu` sans barre hors ligne ; suffixe 4 sauté | — |

Ce qui tient : § 5. Réponses aux dix questions : § 6. Limites de l'audit : § 7.

## 3. Constats importants

### I1 — Course entre la vérification de démarrage et la découverte d'une nouvelle livraison

`src/demarrage.js:48-52` :
```
const registration=await borner(serviceWorker.register(new URL('sw.js',base).href,{scope:base,updateViaCache:'none'}),delai);…
const observation=await controle.verifier();
if(controle.estCourante(observation)&&observation.controleur?.complete&&observation.controleur.release===release){await monter('controlee',observation);return resultat}
```
`register()` relance une vérification de `sw.js` à chaque ouverture (c'est voulu). Si le serveur porte une nouvelle
livraison, le navigateur crée un worker `installing` et émet `updatefound` **pendant** le `verifier()` du démarrage.
`src/core/livraison.js:22` invalide alors l'observation en vol : `epoch++; … fin({data:null,raison:'worker_change'})`,
et `:49` rend `poser('inconnue','worker_change')`. `demarrage.js:50-51` ne traite ni `inconnue` ni `worker_change` :
on tombe ligne 52 sur l'écran « La livraison hors ligne n'est pas vérifiée. Fermez les anciens onglets puis reprenez
le démarrage, ou continuez en ligne sans cette garantie. » Le `relireApres` de `livraison.js:58` relance bien une
vérification, mais le démarrage n'attend plus son résultat.

Scénario : Codex publie 0.32.0-6 ; Neegan ouvre l'app installée (iPhone ou Chrome) en ligne. Le contrôleur 0.32.0-5
est pourtant complet et cohérent. Il voit l'écran de choix, tape « Reprendre » (recharge : plus d'`updatefound`, la
page monte), puis plus tard le bandeau « Mise à jour prête ». Même course, plus courte, dans `monter()` (`:40-41`,
deux `verifier()` de plus) : un `statechange` d'`installing` → `installed` à cet instant lève `worker_change` → « Cette
livraison ne peut pas être ouverte pour le moment. Reprenez le démarrage. » sans bouton « Continuer en ligne ».

Effet : friction à **chaque** publication (Codex en a fait 5 le 30 oct.) ; message qui parle d'onglets à fermer alors
qu'il n'y a rien à fermer ; c'est très probablement l'un des « trous » ressentis. Non couvert : `tests/l10-demarrage.js`
n'a que les scénarios `controller/stockage/ancienMarqueur/muet/mismatch/indisponible/registerAttente` ; aucun
`updatefound` pendant la vérification.
Suggestion : si `observation.raison==='worker_change'`, attendre la relecture (`controle.verifier()` une seconde fois,
bornée) avant de présenter le choix ; ne compter `installing` ni dans `cibles()` ni dans `sameTargets` pour l'admission
du contrôleur (un worker en installation ne change rien au contrôleur courant).

### I2 — Adoption depuis le worker historique (0.31.0, `cuisine-os-v0.31.0-1`)

Ancien worker (diff, `sw.js` lignes `-`) : réseau d'abord, `skipWaiting` + `clients.claim`, aucun gestionnaire
`message`. Nouveau démarrage : `demander()` (`livraison.js:24-38`) lui poste `shell_status` et attend
`LIMITES_LIVRAISON.delai = 5000` ms (`livraison-format.js:2`) → `{raison:'delai'}` → `etat:'non_controlee'` →
écran de choix après **5 secondes blanches** (`index.html:18` « Vérification de la livraison… », sans CSS).
Pendant ce temps le nouveau worker télécharge 208 fichiers (`sw.js:46`, deux en vol) ; aucun indicateur : le
bandeau de `src/ui/mise-a-jour.js:42` est `hidden` tant que `attente` (waiting) est null, donc invisible pendant
`installing`. Si Neegan tue la PWA avant la fin, iOS peut tuer le worker avec elle : `install` échoue, `caches.delete`
(`sw.js:46`) efface la tentative, et tout repart de zéro à la prochaine ouverture — nouvel écran de choix, nouveaux 5 s.
L'ancien cache `cuisine-os-v0.31.0-1` (~3,5 Mo, modules 0.31 + réponses mises à jour par le réseau-d'abord) n'est
**jamais** supprimé : `sw.js:47` ne purge que `old.active_cache` relu dans `mistu-shell-meta-v1`, absent à la première
activation. Le contrat A § 5 assume cette limite (« adoption historique… limite documentaire »), mais l'écran ne la
nomme pas.

Effet : première impression de panne ; dépendance à un geste non évident (swipe-kill de la PWA ; fermer *toutes* les
fenêtres Chrome de l'origine). Suggestion : texte dédié quand `controleur` est muet (« ancienne version installée,
téléchargement de la nouvelle en cours ») ; afficher `registration.installing` comme « installation en cours » ;
supprimer explicitement les caches `cuisine-os-v*` à l'activation (préfixe historique connu, hors contrat L10, une fois).

### I3 — Pas de stockage persistant demandé

`grep -rn "storage.persist" src/` → 0. Les octets des photos (`src/sync/fichiers.js`, magasin IndexedDB `files`, champ
`blob`), les PDF, la file `outbox`, les caches de coquille et la registration sont **best-effort** :
- Safari (onglet, pas PWA installée) : 7 jours sans interaction → tout script-writable storage effacé (ITP) ; la PWA
  installée sur l'écran d'accueil est exemptée, mais toute consultation faite dans Safari (lien reçu, retour OAuth
  ouvert dans Safari) ne l'est pas ;
- Chrome : éviction LRU de l'origine entière sous pression disque, sauf si `persisted()`.
Scénario : photo de cuisson prise hors ligne, non envoyée (pas de réseau pendant deux jours), puis pression disque →
ligne `files` et son blob disparaissent avec la base ; le serveur n'a rien ; perte sèche. Le diagnostic (`settings.js:73`)
lit `storage.estimate()` mais jamais `storage.persisted()`.
Suggestion : `navigator.storage.persist()` au premier montage contrôlé (sans bloquer), `persisted()` dans le
diagnostic, phrase dans Réglages si refusé.

### I4 — Dérive serveur ↔ worker : rien ne la voit

Le garde-fou vit dans le terminal du développeur : `tools/generer-livraison.mjs:29` (`--check` → « Artefacts de
livraison périmés ») et `:30` (« Suffixe de livraison déjà utilisé »). Aucun `.github/workflows` dans la copie ; GitHub
Pages publie `main` tel quel. Si un module est poussé sans régénération :
- appareils déjà installés : `sw.js` identique → pas d'update → ils gardent l'ancien module **pour toujours** (immuable,
  voulu) et personne n'est averti ;
- appareil neuf : `recevoir()` (`sw.js:45`) voit un SHA différent → `shell_invalid` → installation échoue → pas de worker
  → écran de choix « Continuer en ligne » à chaque ouverture, sans explication.
L'application ne relit jamais `livraison-manifeste.json` public (seuls les tests le font, `tests/livraison-fixture.js:4`).
Suggestion : workflow CI `node tools/generer-livraison.mjs --check` + `node --test tools/*.test.mjs` sur `main` ;
en ligne, après montage, `fetch('livraison-manifeste.json',{cache:'no-store'})` et comparer `release` au contrôleur
pour afficher « Livraison X publiée, non installée sur cet appareil (raison) ».

### I5 — Échec d'installation : silencieux, total, sans reprise

`sw.js:46` : `catch(e){await caches.delete(c.cache).catch(()=>{});throw e}`. Toute cause (quota iOS, MIME inattendu,
CDN Fastly servant un fichier périmé < 10 min après la publication, coupure réseau à la 190e requête) jette **toute**
la tentative ; le prochain essai refait 208 requêtes `cache:'no-store'` (3,6 Mo), deux en vol (`parDeux`, `:43`).
Aucun signal ne remonte : pas de `postMessage` aux clients, pas d'entrée `sync_state`, et `mise-a-jour.js:42` cache le
bandeau tant que `waiting` n'existe pas. Le diagnostic copié dira `attente: null` — vrai mais trompeur.
Scénario : iPhone sous quota (bibliothèque photographiée), 0.32.0-6 refusée par `QuotaExceededError` à chaque
ouverture : Neegan reste sur -5 indéfiniment, re-télécharge 3,6 Mo à chaque lancement, et le diagnostic ne dit rien.
Suggestion : dans `install`, sur échec, écrire une petite métadonnée `{release, raison, at}` dans
`mistu-shell-meta-v1` (déjà bornée) et la renvoyer dans `shell_status` (champ fermé supplémentaire) → bandeau
« Mise à jour 0.32.0-6 impossible : quota ».

### I6 — Coût du démarrage contrôlé (inférence, à mesurer sur iPhone)

Avant `import('./app.js')`, trois `controle.verifier()` (`demarrage.js:49`, `:40`, `:41`), chacun → `shell_status` →
`cacheComplet()` (`sw.js:44`) = `cache.keys()` + 208 `cache.match` + SHA-256 de 3 608 736 octets, deux en vol ;
puis chaque module importé repasse par `verifierReponse` (`sw.js:48`, re-hachage du hit). Chaque demande est bornée à
5 s (`livraison-format.js:2`, plafond 10 s) : au-delà → `delai` → `inconnue` → écran de choix.
Sur M3 Pro c'est invisible ; sur un iPhone avec Cache API froide, 3 passes × 208 lectures peuvent approcher la borne.
Les mesures du rapport Codex (§ 7, § 11) ne couvrent pas ce chemin. Suggestion : une seule vérification complète par
démarrage (réutiliser l'observation si `estCourante`), les deux autres en `shell_status` léger (`keys.length` seulement,
ou un drapeau « complet » écrit à la fin de `install`), et mesurer `performance.now()` sur iPhone.

## 4. Constats moyens et mineurs

### M1 — `/tests/` dans un onglet contrôlé teste le cache actif, pas le serveur
`sw-rules.js:15-23` : seule la navigation est restreinte à `index.html` ; toute autre requête same-origin dont le chemin
est dans l'inventaire est servie depuis le cache, **query ignorée** (`url.pathname` seul). `tests/index.html:14-16`
charge `../sw-rules.js`, `../src/vendor/…umd.js` et `tests.js` importe `../src/**` ; `tests/sync.js:1003`
`fetch('../'+chemin,{cache:'no-store'})` est intercepté aussi. Dans un profil où l'app a déjà été ouverte, l'onglet
`tests/` est contrôlé : **la suite joue les modules de la livraison active, pas ceux publiés**, et le manifeste lu par
`livraison-fixture.js` vient, lui, du réseau. Le rapport Codex (§ 11) parle de profil isolé ; c'est cohérent. Mais si
Neegan ouvre `/mistu/tests/` dans son Chrome, le « 11539/11539 » valide le cache de son appareil, et un worker en attente
rend des tests neufs rouges sur des modules anciens (ou verts sur une régression déjà corrigée côté serveur). Pas un
mensonge du code, un piège de lecture. Suggestion : `tests/index.html` affiche `navigator.serviceWorker.controller`
+ la `release` testée (via `shell_status`) en tête du bilan.

### M2 — Première installation bornée à 15 s, auto-reprise coupée après un geste
`demarrage.js:21` `delaiInstallation=15000`, `:48` `attendreInstallation(registration,delai)`. Sur cellulaire, 208
requêtes en deux files peuvent dépasser 15 s → `verifier()` sans actif → écran de choix avec le texte « Fermez les
anciens onglets » alors qu'il n'y a jamais eu d'onglet. `:30-31` : « Reprendre » pose la clé de session, et
`autoReprise()` refuse ensuite toute reprise automatique pour la session (`getItem(cle)==='1'`) : si l'installation
finit après ce premier geste, la page revient *non contrôlée* avec un actif complet et **ne se recharge plus seule** ;
il faut un second « Reprendre ». Même texte pour `serviceWorker` absent (Safari navigation privée) : « Continuer en
ligne » à chaque ouverture, sans mémoire du choix. Suggestion : distinguer `registration.installing` présent
(« installation en cours, patientez ») de l'absence de worker ; message spécifique à la première visite.

### M3 — Caches orphelins
`sw.js:47` : `meta.put(record)` **puis** `caches.delete(old.active_cache)`. Worker tué entre les deux, ou `delete` en
échec → l'ancien cache (3,6 Mo) survit, la métadonnée pointe déjà sur le nouveau, aucun ramassage ultérieur (voulu par
contrat A § 3 : « sûr »). S'ajoute au `cuisine-os-v0.31.0-1` de I2. Sur un iPhone à quota serré, ce sont des Mo qui
manqueront à la prochaine installation (I5). Suggestion : à l'activation, lister `caches.keys()` et supprimer les
`mistu-shell-v1:<ce scope>:*` qui ne sont ni le courant ni `old.active_cache` ni un cache dont un worker
`installing/waiting` de cette registration a besoin — ou au minimum les `cuisine-os-v*`.

### M4 — Manifeste PWA et icône Apple posés après décision (inférence Safari)
Diff `index.html` : `<link rel="manifest">`, `<link rel="icon">`, `<link rel="apple-touch-icon">` retirés du HTML ;
`demarrage.js:17` les insère dans `chargerMetierParDefaut` seulement. Sur l'écran de vérification/choix, « Sur l'écran
d'accueil » ne voit ni manifeste ni icône → icône générique, `start_url` = URL courante. Chrome lit les liens
dynamiques ; Safari, pas sûr. L'app déjà installée n'est pas touchée ; une réinstallation après l'écran de choix l'est.
Suggestion : garder ces trois `<link>` statiques (ils ne chargent ni script ni CSS, la frontière « rien avant décision »
n'en souffre pas ; `manifest.webmanifest` et les icônes sont dans l'inventaire).

### M5 — 503 brut hors ligne
`sw.js:48` : toute erreur du chemin coquille → `Response('Coquille indisponible pour cette livraison.',{status:503})`.
Pour une navigation (entrée évincée + hors ligne), Neegan voit ce texte nu dans la PWA, sans bouton ni retour. Rare
(éviction partielle d'un cache est inhabituelle). Suggestion : une page HTML minimale inline avec « Réessayer ».

### M6 — Diagnostic : deux façons de vieillir
`settings.js:73` `Promise.allSettled([…,livraison?.verifier(),navigateur.storage?.estimate?.()])` : la coquille est
relue en direct (bien), mais avec le délai de 5 s (I6) ; `inconnue/delai` peut être copié alors que le cache est
complet. `settings.js:97` `retientVue()` + `suivreMoteurDeLaPage` : tant que le texte copié est visible, la page
Réglages ne se redessine plus → compteurs de synchronisation figés. C'est un instantané honnête, pas un mensonge, mais
rien ne l'horodate à l'écran (seul le JSON porte `observe_le`). Suggestion : afficher « lu à HH:MM » sous le texte.

### Mineurs
- m1. Un seul libellé (`demarrage.js:52`) pour cinq causes : worker muet (0.31), indisponible, `delai`, `worker_change`,
  installation > 15 s. La `raison` existe dans l'observation ; l'écran ne la montre pas.
- m2. `index.html` ne charge plus `styles.css` avant décision : écran de vérification et de choix sans style (voulu par
  contrat A § 5 ; à assumer visuellement).
- m3. `https://neegans.github.io/mistu` (sans barre) est hors portée (`scope` = `/mistu/`) : GitHub répond 301 en ligne ;
  hors ligne, erreur navigateur. `start_url` du manifeste (`./index.html#/`) n'est pas concerné.
- m4. Suffixe `0.32.0-4` jamais publié (STATE.md : -2, -3, -5). Sans effet ; noter pour ne pas le réutiliser.

## 5. Ce qui tient (vérifié dans le code et par les commandes)

- **Générateur** (`tools/generer-livraison.mjs`) : tokeniseur JS qui ignore commentaires/chaînes/regex, imports
  statiques, ré-exports et `import()` littéraux suivis ; `import(variable)` refusé sauf énumération dans
  `IMPORTS_CALCULES_LIVRAISON` (vide : aucun import calculé dans `src/`, vérifié par grep) ; références HTML/CSS/
  webmanifest suivies ; `sw.js`/manifeste exclus de leur propre inventaire ; `release` lue dans `index.html` et
  contrainte à `APP_VERSION` ; `--check` EXIT 0 ; 39/39 tests Node. `tests/sync.js:982-1018` recoupe le graphe réel.
- **Cohérence HEAD** : `index.html:8` `0.32.0-5` = `livraison-manifeste.json.release` = `sw.js:31` `VERSION`
  = `MANIFEST.release` ; empreinte `48b6b6…` identique dans `sw.js:30`, `--check` et STATE.md.
- **Worker** : `install` vérifie statut 200, non-redirigé, MIME (JS : `text/javascript` ou `application/javascript`,
  conforme au HEAD GitHub Pages relevé au contrat A § 2), taille exacte, SHA, deux en vol, relecture complète avant
  fin ; `fetch` re-vérifie chaque hit, répare un manque **uniquement** avec les octets attendus, sinon 503 (pas de
  200 périmé, pas de recherche dans d'autres caches) ; hors-origine (Supabase, Open Library, Storage), `blob:`,
  `tests/`, navigations profondes vers autre chose qu'`index.html` → non interceptés ; `?code=` OAuth jamais stocké ;
  pas de `skipWaiting`/`claim` (choix de spec) ; nettoyage limité au précédent actif prouvé, caches étrangers et
  waiting intacts ; `message` n'accepte qu'un `WindowClient` de la portée.
- **Démarrage** : un SW qui échoue ne bloque pas (« Continuer en ligne ») ; première visite → une seule reprise
  automatique ; `sessionStorage` refusé → pas de boucle ; `repo.init()` (DB 6) n'est appelé qu'après admission
  (`app.js:340`), donc jamais sous une coquille non vérifiée en mode contrôlé ; `aria-busy` retiré au montage.
- **Diagnostic** : `collecterDiagnosticApp` lit en direct (`verifier()`, `storage.estimate`, curseurs IndexedDB),
  projection fermée (`diagnostic-app.js`), rien de persistant, `attente` ≠ `controleur` ≠ `execution`.
- **Médias** : octets dans IndexedDB `files.blob` (`fichiers.js:20,40`) ; photos locales recodées JPEG ≤ 1 200 px,
  refus > 16 Mpx / 25 Mo (`image.js:16,107-114`) ; envoi en « réduite » (≤ 2 000 px, q 0,8, `fichiers.js:156,190-204`)
  par défaut, original conservé localement, « Renvoyer en originale » explicite ; photo prise hors ligne = ligne `files`
  + envoi à la prochaine passe `envoyer` du moteur ; vérification hors ligne par décodage réel, deux en vol
  (`hors-ligne-repas.js:86,99-100`).
- **CSP** : inchangée dans le lot (diff `index.html`) ; `worker-src` absent → hérite de `script-src 'self'` ; `connect-src
  'self' https:` ; aucun inline script ajouté.

## 6. Réponses aux dix questions

1. **Transition depuis le worker écrit à la main.** Cache ancien `cuisine-os-v0.31.0-1` (0.21.1 au début de la plage,
   monté jusqu'à 0.31.0 d'après STATE.md) ; nouveau nom `mistu-shell-v1:<sha portée>:<sha manifeste>`. `activate` du
   nouveau worker ne supprime que ce que sa métadonnée désigne → l'ancien reste (I2/M3). Pas de `skipWaiting`/`claim` :
   le nouveau attend la fermeture de **tous** les clients (PWA comprise) ; « Recharger » ne suffit pas, le bandeau le
   dit (`mise-a-jour.js:21`). Mélange pendant la transition : l'ancien worker (réseau d'abord) sert HTML + modules neufs
   depuis le réseau et les range dans son vieux cache ; hors ligne il peut alors servir un mélange vieux/neufs (modules
   jamais redemandés restés en 0.31). Limite documentée au contrat A § 5, non corrigible rétroactivement. Après
   adoption L10 : plus aucun mélange possible, chaque import (même tardif) sort du cache du contrôleur. Import calculé :
   aucun dans `src/` ; le générateur le refuserait.
2. **`fetch`.** Même origine + chemin de l'inventaire → cache vérifié, query ignorée (octets de la livraison), sinon
   réparation réseau stricte, sinon 503 (jamais un 200 périmé). `tests/`, hors-origine, `blob:`, navigations vers
   autre chose que `/mistu/` ou `index.html` → réseau, sans cache. Les 11539 tests : la page `tests/` vient du réseau,
   mais ses imports `../src/**` viennent du cache si l'onglet est contrôlé (M1) ; en profil neuf (rapport Codex) ils
   viennent du réseau.
3. **GitHub Pages `max-age=600`.** `register()` avec `updateViaCache:'none'` (`demarrage.js:48`) et relance à chaque
   ouverture → `sw.js` est revalidé à chaque lancement ; délai résiduel = cache CDN Fastly (≤ 10 min). Les 208 fichiers
   sont lus en `cache:'no-store'` par le worker ; un fichier servi périmé par le CDN dans cette fenêtre fait échouer
   l'installation (SHA), qui sera retentée au prochain lancement (I5). Pas de `?v=` ; `Content-Type` contrôlé par essence
   (JS : deux essences admises). Suffixe : une seule source, la méta `mistu-release` d'`index.html`, recopiée par le
   générateur dans `VERSION` et `MANIFEST.release` ; cohérente à HEAD.
4. **« Version candidate ».** Dans STATE.md et la spec, *candidate* désigne la **candidate de traduction** d'une recette
   choisie dans « Préparer hors ligne » (`hors-ligne-repas.js:78-82`), pas une version de l'app. Côté app, la seule
   notion est `attente` = worker en attente. Aucun choix de l'ancienne version n'existe : un seul contrôleur, on avance
   en fermant les fenêtres. Caches coexistants : actif + en attente = 2 × 3,6 Mo, plus les orphelins (M3). iOS : PWA
   installée exemptée du plafond ITP 7 jours, Safari onglet non ; `persist()` jamais demandé (I3).
5. **Générateur.** `--check` refuse la dérive (`:29`), la génération refuse de réécrire un suffixe déjà produit (`:30`) ;
   tout dépend du geste local (I4). À l'exécution, le manifeste **est** vérifié : à l'installation, à chaque hit, au
   `shell_status`. Fichier tronqué/corrompu par le réseau → taille/SHA faux → refus, pas de put. Fichier corrompu dans
   le cache → re-téléchargé avec les octets attendus, sinon 503.
6. **Ordre.** `register` (≤ 15 s) → `shell_status` ×3 (≤ 5 s chacun) → `styles.css` + vendor → `import('./app.js')` →
   `repo.init()` (migrations) → sync → porte → routes. Un SW en échec ne bloque pas (« Continuer en ligne »). Premier
   lancement hors ligne : rien n'est en cache → « Le démarrage n'a pas pu terminer » (attendu). Premier lancement en
   ligne lent → M2.
7. **Diagnostic.** Événements réels au clic (`verifier()`, `cache.keys`/SHA côté worker, `storage.estimate`), pas d'état
   mémorisé entre deux clics ; la « rétention locale » de Codex ne retient que le DOM du panneau (texte affiché) pendant
   les refresh du moteur ; un rechargement de page repart de zéro. Ce qui peut mentir : `inconnue/delai` sous charge
   (M6), `attente:null` quand l'installation échoue (I5).
8. **Médias.** IndexedDB `files` (Blob), jamais la Cache API ; entrée ≤ 16 Mpx / 25 Mo, recodée ≤ 1 200 px ; copies
   réduites ≤ 2 000 px envoyées au Storage, original gardé localement ; photo hors ligne envoyée à la prochaine passe du
   moteur ; décodage de vérification borné à 2. Rien de 24 Mpx ne reste brut. Risque réel = éviction du stockage (I3).
9. **Procédure humaine.** Vérifiable à HEAD seulement (pas de git ici) : `index.html` / manifeste / `sw.js` cohérents,
   `--check` EXIT 0. STATE.md relate -1 (jamais publiée), -2 (`a54a4ce`), -3 (`6532c43`), -5 (`fbbb76c`) ; les deux
   commits suivants (`7fb583c`, `247b2e5`) sont des docs (titres) — inférence : la coquille n'a pas bougé après -5. Le
   respect commit par commit de « monter le suffixe puis régénérer » n'a pas pu être relu ; une CI l'imposerait (I4).
10. **CSP / `index.html`.** CSP inchangée : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:; frame-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none';
    form-action 'none'`. Pas de `worker-src` (hérite de `script-src 'self'`, suffisant). Changements du lot : méta
    `mistu-release`, retrait des `<link>` et des deux `<script>`, `aria-busy`, un seul `<script type=module
    src=./src/demarrage.js>`.

## 7. Limites de cet audit

- Aucun appareil réel ni GitHub Pages : les en-têtes publics viennent du contrat A § 2 (relevé Codex du 30 oct.), le
  comportement Safari/iOS (ITP, kill du worker, Cache API lente) est une inférence nommée comme telle.
- Pas de git : l'historique des 30 commits n'a été lu qu'à ses deux bornes (patchs) et par STATE.md.
- Les tests Node ont été rejoués ; la suite navigateur (11539) ne l'a pas été.
- Les mesures de temps (I6) sont à produire, pas déduites.

## 8. Ordre de traitement suggéré

1. I1 (course `updatefound`) — petit correctif dans `demarrage.js`, gros gain de confiance.
2. I3 (`persist()`) — trois lignes, protège les données.
3. I5 + I2 (échec d'installation visible, texte d'adoption, purge des `cuisine-os-v*`).
4. I4 (CI `--check`, lecture du manifeste public).
5. I6 (une seule vérification complète, mesure iPhone), puis M1–M6.
