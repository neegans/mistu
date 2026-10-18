# La passerelle de l'assistant — spec de design

Date : 18 octobre 2026 (matin, après la mise en ligne des trois lots de la nuit : `main` = `cdbd6e0`). Branche
`passerelle-assistant`, worktree `~/projects/mistu-passerelle` (serveur `python3 -m http.server 8086`). Révision 1 (§ 9 tranché par
Neegan le 18 octobre) ; **révision 2 à la clôture** : § 2, § 4, § 6, § 8 et § 9 amendés par ce que la construction a établi, § 10 ajouté
(rulings).

## 0. Ce que Neegan a tranché (18 octobre, 11 h)

- **Une seule clé Anthropic, à lui, côté serveur.** Plus jamais de clé dans un navigateur, ni à taper, ni à synchroniser.
- **Tous ses comptes et les personnes qu'il admet** utilisent l'assistant sans rien configurer. Aujourd'hui : `neeganprod@gmail.com`
  et `neegan@oraquan.com`, seuls comptes admis de `mitsu` (`private.allowed_users`, 2 lignes). Inviter quelqu'un = l'ajouter à
  cette liste, comme pour la synchronisation ; c'est Neegan qui paie et qui gère.
- **L'écran Réglages perd toute la section « clé ».** Il dit seulement si l'assistant est actif pour ce compte et quel modèle sert.
- Conséquence acceptée : **l'assistant exige d'être connecté**. Sans compte, l'app reste entière (recettes, livres, cuisine,
  courses) ; les trois usages de l'assistant (recherche web, création, lecture de pages photographiées) sont simplement absents,
  avec une phrase qui dit pourquoi et un bouton « Se connecter ».

## 1. But, non-buts

**But.** Que l'assistant marche dès la connexion, sur tous les appareils, pour toute personne admise, sans manipulation, et que
la clé ne quitte jamais le serveur.

**Non-buts.** Facturer par personne · plusieurs clés ou plusieurs fournisseurs · un assistant sans compte · un cache des réponses ·
le streaming · changer les écrans de recherche, de création ou d'import au-delà de la garde « connecte-toi ».

## 2. Architecture

```
app (GitHub Pages) ──POST /functions/v1/assistant (Bearer <jeton de session Supabase>)──▶ fonction Supabase « assistant » ──▶ api.anthropic.com
                                                                                            │  (clé = secret du projet)
                                                                                            └─▶ public.assistant_journal (usage, jamais le contenu)
```

- **Fonction Supabase `assistant`** (Deno, `supabase/functions/assistant/index.ts`), déployée sur le projet `mitsu`. Elle :
  1. n'accepte que `POST` depuis une origine admise (`https://neegans.github.io`, et `http://localhost:8086`/`:8083…` si le secret
     `ASSISTANT_ORIGINES` les liste) ; répond au `OPTIONS` de CORS ;
  2. exige un jeton de session valide (`Authorization: Bearer …`, vérifié par `auth.getUser()`), et que l'adresse du compte soit dans
     `private.allowed_users` (la même règle `is_allowed()` que la synchronisation) ; sinon `401`/`403` sans détail ;
  3. lit un corps JSON borné (`outil` ∈ `recherche-web | creation | extraction`, `corps` = la requête Messages telle que l'app la
     bâtit aujourd'hui, **sans** `model`), le filtre par **liste blanche** de champs (`system`, `messages`, `max_tokens`, `tools`
     pour `recherche-web` seulement, `temperature` absent), impose le modèle du serveur (`ASSISTANT_MODELE`, défaut
     `claude-sonnet-5-5`) et les plafonds (`max_tokens` ≤ 16 000 ; corps ≤ 512 Kio, ou ≤ 8 Mio pour `extraction` qui porte des
     images en base64 ; amendé : bornes mesurées en octets, corps lu en flux et coupé à 8 Mio avant tout parse, R-T1-1 et R-T2-2) ;
  4. applique le **quota** : par compte et par jour UTC, `ASSISTANT_QUOTA_JOUR` appels (défaut 60) ; **réservé avant** l'appel dans
     `public.assistant_journal` par la fonction SQL `assistant_reserver` (§ 4, R-T2-1), `429 { erreur: 'quota', quota: n }` au-delà ;
  5. appelle Anthropic avec la clé `ANTHROPIC_API_KEY` (secret), délai 120 s, puis **renvoie le corps JSON d'Anthropic tel quel** avec
     son statut (l'app garde son classement actuel des issues) — les en-têtes d'Anthropic ne sont pas relayés. Amendé à la clôture :
     seuls 200, 400, 403, 413 et 429 sont relayés avec leur corps ; 529 devient 503 et tout autre statut (401, 404, 5xx, redirection) devient 502,
     sans le corps d'Anthropic ; la réponse est lue bornée à 2 Mio d'octets ;
  6. journalise une ligne : compte, outil, statut, jetons d'entrée/sortie (depuis `usage`), durée, taille du corps — **jamais** le
     contenu, jamais la clé, jamais une erreur brute d'Anthropic au-delà de son `type`.
- **Côté app** : un module `src/domain/passerelle.js` (`appelerAssistant(outil, corps, deps)`) remplace `anthropicHeaders` +
  `ANTHROPIC_MESSAGES_URL` dans `recherche-web.js`, `creation-ia.js` et `llm.js` (lecture de pages). Il prend le jeton de la session
  courante (`client.auth.getSession()` de `src/sync/auth.js`) et poste à `${SUPABASE.url}/functions/v1/assistant` avec `apikey`
  (clé publique) + `Authorization: Bearer <access_token>`. Sans session → issue `non_connecte` (nouvelle raison), aucun appel.
- **`settings.llm` / `assistant_config`** : plus lus pour l'assistant. La section Réglages devient : « L'assistant est actif pour
  `<adresse>` — modèle `<nom>` » (le nom vient d'un `GET` de la fonction qui ne demande rien à Anthropic), ou « Connecte-toi pour
  utiliser l'assistant ». Le magasin `assistant_config` et sa table restent (migration à ajout seul, données vides) ; une passe
  **efface** la ligne `llm` locale si elle porte une clé (`api_key` → `''`), pour qu'aucune clé ne traîne dans IndexedDB ; la
  synchro reçoit la ligne vide. Dette nommée : retirer le magasin à un lot ultérieur (il faudrait une migration et le compte des
  26 → 25 magasins).

## 3. Invariants

- **P-1 La clé ne quitte jamais le serveur.** Aucun fichier du dépôt, aucun test, aucun journal, aucune réponse de la fonction ne
  porte la clé. Le secret se pose dans le tableau de bord Supabase (geste de Neegan), jamais par un fichier.
- **P-2 Connecté et admis, sinon rien.** `401` sans jeton, `403` si l'adresse n'est pas admise. Le jeton anonyme seul ne suffit pas.
- **P-3 Le serveur décide** : modèle, plafonds, quota, origines. L'app ne peut pas les contourner (liste blanche des champs ; `model`
  reçu = ignoré).
- **P-4 Le contenu ne reste nulle part** : ni dans le journal, ni dans un cache. Seuls des compteurs.
- **P-5 L'app ne change pas de comportement visible** hors des gardes : mêmes écrans, mêmes issues (`cle_refusee` disparaît ;
  `non_connecte` et `quota` apparaissent), mêmes tests de comportement retournés sur les gardes seulement.
- **P-6 Zéro réseau dans la suite** : `fetch` injecté partout ; la fonction a ses propres tests purs (liste blanche, quota, CORS)
  exécutés sous Node (la logique vit dans un module `.js` sans import Deno).
- **P-7 Pas d'appel réel par un agent.** La preuve réelle est le geste de Neegan sur le site public (un POST vers
  `/functions/v1/assistant`, zéro vers `api.anthropic.com` depuis le navigateur).

## 4. Données et migration

`0004_assistant_journal.sql` (à ajout seul, une transaction) : `public.assistant_journal (id bigserial, owner_id uuid, outil text, statut int,
jetons_entree int, jetons_sortie int, duree_ms int, octets int, jour date, cree_le timestamptz default now())`, index
`(owner_id, jour)`. **Amendé à la clôture : la table est dans `public`, pas dans `private`** — PostgREST, par lequel la fonction
écrit, n'accède pas à `private`. **Aucun droit** pour `anon` / `authenticated` (RLS activée sans règle, `revoke all` sur la table et
sur la séquence) : seule la clé secrète du projet (`service_role`) y écrit. Vue `public.assistant_usage_jour` (`security_invoker`,
mêmes révocations ; compte, jour, appels, jetons) pour la lecture par Neegan dans l'éditeur SQL. **Fonction
`public.assistant_reserver(p_owner uuid, p_outil text, p_octets integer, p_quota integer) returns bigint`** (plpgsql, `security
invoker`, `search_path` vide, `execute` réservé à `service_role`) : verrou consultatif par compte, comptage du jour UTC et
insertion de la ligne « en vol » (statut 0) en UNE transaction ; `null` = quota atteint (R-T2-1). Sans elle, deux appels
simultanés passent le même comptage ; le motif suppose READ COMMITTED, défaut de PostgREST. Preuve `0004` : table, droits et
fonction (24 instructions + 5 blocs `do` à l'analyse ; **jamais jouée** : geste de Neegan, `supabase/README.md`, étape 10).

## 5. Erreurs, vu de la personne

| Cas | Statut de la fonction | Issue dans l'app | Texte |
|---|---|---|---|
| pas de session | — (pas d'appel) | `non_connecte` | « Connecte-toi pour utiliser l'assistant. » + « Se connecter » |
| compte non admis | 403 | `non_admis` | « Ce compte n'a pas accès à l'assistant. » |
| quota du jour atteint | 429 `quota` | `quota` | « Tu as atteint la limite du jour pour l'assistant ({n} appels). » |
| Anthropic 429 / 5xx / 4xx | relayé | inchangé (`trop_de_demandes`, `serveur`, `requete`) | inchangé |
| fonction en panne / délai | 502 / 504 | `serveur` / `delai` | inchangé |
| corps trop gros | 413 | `requete` | « La demande est trop lourde. » |

## 6. Déploiement et secrets (gestes de Neegan)

1. Console Anthropic → **API keys** → nouvelle clé `mistu-passerelle` ; révoquer l'ancienne ; plafond mensuel dans Limits.
2. Supabase `mitsu` → **Edge Functions → Secrets** : `ANTHROPIC_API_KEY` (obligatoire), `ASSISTANT_MODELE` (facultatif),
   `ASSISTANT_QUOTA_JOUR` (facultatif), `ASSISTANT_ORIGINES` (facultatif, origines séparées par des virgules).
3. Poser la fonction — **tranché le 18 octobre : la voie (b), par le contrôleur** (CLI Supabase 2.121.0, `~/.local/bin/supabase`, session de
   Neegan), depuis le worktree : `~/.local/bin/supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt --use-api`.
   `--no-verify-jwt` : c'est la fonction qui vérifie le jeton elle-même, pour répondre au `OPTIONS` sans jeton ; `--use-api` : le bundle se
   fait côté serveur, sans démon Docker ; le `deno.json` du dossier sert d'import map ; le dépôt n'a aucun `config.toml`. Mesuré : version 1
   le 18 octobre à 17 h 05 UTC (code `1590ba8`), version 2 à 18 h 16 UTC (code `6d7ed21`), `ACTIVE`, `verify_jwt: false`
   (`supabase/proofs/RESULTATS-mitsu.md`). La voie (a), le collage dans le tableau de bord, n'a pas été retenue.
4. Coller `0004_assistant_journal.sql`, puis, collée seule, `notify pgrst, 'reload schema';` (sans elle PostgREST ne connaît pas
   `assistant_reserver` : `PGRST202`, et tous les `POST` valides rendent 502 `serveur` ; P-7), puis sa preuve (comme `0003`).
5. Fusion et `push` ; puis preuve réelle sur le site public.

## 7. Tests

- **Fonction (Node, purs)** : liste blanche des champs par outil ; `model` forcé ; plafonds ; décision du quota (n−1 passe, n refuse) ;
  CORS (origine admise/refusée, `OPTIONS`) ; journal = compteurs seulement (une sonde affirme qu'aucune chaîne du corps ne se
  retrouve dans la ligne) ; mappage des statuts.
- **App (suite navigateur)** : `appelerAssistant` poste au bon chemin avec `Authorization: Bearer` et `apikey`, jamais `x-api-key` ;
  sans session → `non_connecte` sans fetch ; 403/429 → issues ; `recherche-web`/`creation`/lecture de pages passent par la passerelle
  (le faux `fetch` voit `/functions/v1/assistant`, **jamais** `api.anthropic.com`) ; Réglages : section sans champ de clé, deux états
  (connecté / non) ; la passe d'effacement vide `api_key` local ; gardes « Connecte-toi » sur les trois écrans.
- **Preuve réelle (Neegan)** : site public, connecté, onglet Réseau : un POST `/functions/v1/assistant` 200, zéro requête vers
  `api.anthropic.com` ; même chose sur l'iPhone avec l'autre compte, sans rien configurer.

## 8. Dettes nommées

Retrait du magasin `assistant_config` (26 → 25) · quotas par jetons et non par appels · relevé d'usage visible dans l'app · streaming ·
cache · plusieurs modèles par outil · rotation de la clé = geste tableau de bord (documenté, pas d'outil).

Complété à la clôture (détail et sources dans `CLAUDE.md`, section « La passerelle de l'assistant ») :
- Le magasin `assistant_config`, `assistant-config.js` et `getSettings().llm` restent (R-T4-5) ; le serveur garde la ligne vide.
- Un 403 relayé d'Anthropic (« recherche web non activée pour l'organisation ») est classé `serveur` et s'affiche comme une panne de
  service ; la porte « Créer une recette avec ces critères » qui s'affichait sur cette issue a disparu avec elle.
- `decisionQuota` (pur, testé sous Node) n'est plus importé par `index.ts` : la règle réelle vit en SQL, dans `assistant_reserver`.
- Le test d'ordre `installCapture` / `repo.init()` de `app.js` est un test de texte source ; dérive d'horloge avant la première réponse
  serveur ; un appareil en ancienne version qui réécrit sa clé après la passe d'effacement (garde à usage unique).
- Le `GET` n'est pas annoncé dans `Access-Control-Allow-Methods` ; `pause_turn` non géré (relayé tel quel) ; `getUser()` est un appel
  réseau par requête ; une ligne « en vol » (statut 0) compte dans le quota si la fonction plante ; `connect-src 'self' https:` non resserrée.
- La commande de déploiement de `supabase/README.md` (étape 10) n'a pas `--use-api`, celle qui a servi.

## 9. Décisions — tranchées par Neegan le 18 octobre

- Déploiement : **la voie (b), le CLI, par le contrôleur** (pas de collage dans le tableau de bord ; commande exacte en § 6, étape 3).
- Quota par défaut : **60 appels par compte et par jour** (modifiable sans redéploiement par le secret `ASSISTANT_QUOTA_JOUR`).
- Modèle par défaut : **`claude-sonnet-5-5`** pour les trois outils.
- Origines admises : **le site public seulement** (`https://neegans.github.io`) ; des essais depuis `localhost` exigent de poser
  `ASSISTANT_ORIGINES` (qui remplace la valeur par défaut).

## 10. Rulings de construction

Une ligne chacun ; le détail, la raison et le « coût si faux » sont dans le registre
`.superpowers/sdd/2026-10-18-passerelle-assistant/progress.md` (hors git, à copier avant tout `git worktree remove`).

- **R-PV-1** (pré-vol) la raison d'`appelerAssistant` est le champ `erreur` du corps quand il existe, sinon le statut (401 `non_connecte`, 403 `non_admis`, 429 `quota`, 413 `trop_lourd`, 400/422 `requete`, 504 `delai`, ≥ 500 `serveur`) ; les modules de domaine classent ensuite (413/422/400 → `requete`, 429 sans `erreur` → `trop_de_demandes`, 502/503 → `serveur`, 504 → `delai`).
- **R-PV-2** (pré-vol) T3 ajoute `etatAssistant({ fetch, session, config, signal })` : un `GET` qui rend `{ modele, quotaJour }`, pour Réglages et pour une sonde sans dépense.
- **R-PV-3** (pré-vol) T3 retire `non_configure`, `non_pris_en_charge` et `cle_refusee` des modules de domaine ; T4 retire leurs textes et adapte les écrans.
- **R-T1-1** les bornes 512 Kio / 8 Mio se mesurent en OCTETS : `lireDemande` reçoit `octets` (lu par `index.ts`) ; sans lui, elle retombe sur `texte.length`.
- **R-T1-2** `ligneJournal` ne validait ni l'outil, ni le statut, ni `ownerId` (l'appelant les tient) ; relu en T2, durci par R-T1-6.
- **R-T1-3** le trailer `Co-Authored-By` est celui du modèle réel de l'implémenteur (convention du dépôt) ; jamais de réécriture d'historique.
- **R-T1-4** `max_uses` vaut `LIMITES.maxUses` (5) quand le client l'omet : plus de recherche web sans plafond.
- **R-T1-5** tests à mutants : prototype pollué (en `try/finally`) et épluchage imbriqué assertés.
- **R-T1-6** gardes de `ligneJournal` : outil dans `OUTILS` sinon `null`, statut entier, compteurs entiers sûrs ≥ 0, jour par `toISOString()`.
- **R-T1-7** `max_tokens` plafonné à 16 000 par le serveur ; modèle absent → 502 `serveur`.
- **R-T1-8** `corpsErreur` rend `{ ...extra, erreur }` : le champ `erreur` ne s'écrase pas.
- **R-T1-9** `decisionQuota` exige `appels ≥ 0`.
- **R-T2-1** la réservation est UNE fonction SQL atomique, `public.assistant_reserver(uuid, text, integer, integer)` (plpgsql, volatile, `security invoker`, `search_path` vide, verrou consultatif par compte, comptage du jour UTC, insertion « en vol » au statut 0, `execute` pour `service_role` seulement) ; `index.ts` fait un seul `rpc` : `null` → 429, erreur → 502.
- **R-T2-2** `lireCorpsBorne` (`content-length` d'abord, puis flux borné à 8 Mio, 413 avant tout parse) sert aussi à la réponse d'Anthropic (2 Mio d'octets).
- **R-T2-3** un `try/catch` global rend 502 `serveur` avec les en-têtes CORS : aucune exception ne sort sans `{ erreur }`.
- **R-T2-4** les secrets (`ASSISTANT_ORIGINES`, `ASSISTANT_MODELE`, `ASSISTANT_QUOTA_JOUR`) sont lus à chaque requête ; un quota invalide retombe sur 60.
- **R-T2-5** la mise à jour du journal ne pose que le statut, les jetons et la durée.
- **R-T2-6** preuve 1.09 : un `has_table_privilege` par privilège, reliés par `and` (une liste vaut OU) ; `set_config` en `perform` dans un bloc `do` ; README : jeton lu par `read -rs`, `ASSISTANT_ORIGINES` REMPLACE le défaut.
- **R-T2-7** `index.ts` est éprouvé sous Node par comportement (`stripTypeScriptTypes`, faux `Deno`, faux supabase-js, faux `fetch`), pas par épinglage de lignes.
- **R-T3-1** plomberie minimale des écrans : `auth.jeton()` (lecture locale, sans réseau) fournit la session aux cinq points d'appel ; textes et Réglages restent à T4 (`sessionCourante` écarté).
- **R-T3-2** la session est une DONNÉE `{ access_token, user? } | null` ; sans jeton non vide → `non_connecte` sans `fetch` ; le jeton n'apparaît dans aucun objet rendu.
- **R-T3-3** `cfg` disparaît des deux modules de domaine ; `non_configure`, `non_pris_en_charge` et `cle_refusee` n'existent plus ; le modèle d'une issue vient de `json.model` (≤ 80 points de code) ; les gardes « args null » rendent `non_connecte`.
- **R-T3-4** classement des statuts dans `passerelle.js` (champ `erreur` d'abord, puis statut) puis dans les modules de domaine ; les erreurs d'outil web restent telles quelles.
- **R-T3-5** `llm.js` : plus d'URL ni d'en-têtes Anthropic ; `AnthropicProvider` devient `PasserelleProvider` (`name` reste `'anthropic'`) ; `providerFrom(settings, { session })`.
- **R-T3-6** `tests/passerelle.js` : URL exacte, en-têtes exacts (jamais `x-api-key`), `redirect: 'error'`, `credentials: 'omit'`, corps `{ outil, corps }` ; mutant « poste vers `api.anthropic.com` » obligatoire.
- **R-T3-7** `APP_VERSION 0.8.0`, `sw.js` `-3`, `SHELL` + `./src/domain/passerelle.js`, pins de version déplacés.
- **R-T3-8** le lanceur `suite.cjs 8086` et `node --test tools/*.test.mjs` restent verts à chaque tâche.
- **R-T3-9** `sessionAssistant` rend `null` sans `ctx.sync.user` (compte refusé ou absent), sans appeler `jeton()`.
- **R-T3-10** un 403 sans champ `erreur` (Anthropic relayé) est `serveur`, jamais « compte non admis ».
- **R-T3-11** `sessionAssistant` est borné à 2 s (`Promise.race`, comme `demarrerSync`) ; `search.js` n'attend la session qu'en mode web.
- **R-T3-12** le balayage « le jeton est absent de chaque résultat » attend chaque résultat (`garde(await …)`) et compte exactement (86).
- **R-T3-13** `ecrite: true|false` sur tous les résultats : un 429 écrit par la passerelle → `quota`, un 429 relayé → `trop_de_demandes`.
- **R-T4-1** pas de `ctx.session` : l'écran lit la session par `sessionAssistant(ctx)` ; aucun champ `session` dans `state.js` ni `app.js`.
- **R-T4-2** Réglages → Assistant en deux états, première ligne = le but ; plus de champs fournisseur / modèle / URL / clé, ni Enregistrer, ni Tester, ni « Retirer… ».
- **R-T4-3** passe unique `effacerCleLocale()` dans `init()` (garde `sync_state.cle_locale_effacee`) : une ligne `assistant_config` qui porte une clé ou un fournisseur est réécrite vide, d'origine `local`, pour partir au compte.
- **R-T4-4** textes exacts des gardes (« Connecte-toi… » + « Se connecter », `non_admis`, `quota`, 413 « La demande est trop lourde. »), par `t()` avec leur entrée `en.js`.
- **R-T4-5** `OpenAICompatibleProvider` est retiré ; le magasin `assistant_config` et `assistant-config.js` restent (dette).
- **R-T4-6** tests par comportement (deux états de Réglages, passe d'effacement, quatre écrans à 0 appel) et mutant sur la garde de `search.js`.
- **R-T4-7** `sw.js` `-4` ; total épinglé relevé dans « obtenu ».
- **R-T4-8** même lanceur que T3 ; Node reste vert.
- **R-T4-9** `quota` nul → « Tu as atteint la limite du jour pour l’assistant. » sans nombre.
- **R-T4-10** à la bascule vers « Web » dans la même instance de `search.js`, la session est relue avant de rendre : pas de flash « Connecte-toi » pour une personne connectée.
- **R-T4-11** les textes « Une recherche / Une création = un appel à l’assistant, compté dans ton quota du jour. » : plus aucun texte d'écran ne nomme Anthropic.
- **T5a** (restes parqués, sans numéro R) : P-1 `jourDe` → `null` hors `AAAA-MM-JJ` ; P-2 défaut `max_tokens` = `min(4000, plafond)` ; P-3 preuve 2.04 reconnaît aussi `assistant_reserver` / `function` ; P-4 corps annulé quand `content-length` dépasse ; P-5 quota borné à l'int4 ; P-6 « isolat chaud » dit non prouvé ; P-7 `notify pgrst, 'reload schema';` au README ; P-8 commentaire READ COMMITTED dans `0004` ; P-10 « Code : … » borné à 40 points de code.
