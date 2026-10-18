# La passerelle de l'assistant — spec de design

Date : 18 octobre 2026 (matin, après la mise en ligne des trois lots de la nuit : `main` = `cdbd6e0`). Branche
`passerelle-assistant`, worktree `~/projects/mistu-passerelle` (serveur `python3 -m http.server 8086`). Révision 1, à faire
lire par Neegan avant le plan.

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
                                                                                            └─▶ private.assistant_journal (usage, jamais le contenu)
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
     images en base64) ;
  4. applique le **quota** : par compte et par jour UTC, `ASSISTANT_QUOTA_JOUR` appels (défaut 60) ; compté dans
     `private.assistant_journal` **avant** l'appel (réservation), `429 { raison: 'quota' }` au-delà ;
  5. appelle Anthropic avec la clé `ANTHROPIC_API_KEY` (secret), délai 120 s, puis **renvoie le corps JSON d'Anthropic tel quel** avec
     son statut (l'app garde son classement actuel des issues) — les en-têtes d'Anthropic ne sont pas relayés ;
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

`0004_assistant_journal.sql` (à ajout seul) : `private.assistant_journal (id bigserial, owner_id uuid, outil text, statut int,
jetons_entree int, jetons_sortie int, duree_ms int, octets int, jour date, cree_le timestamptz default now())`, index
`(owner_id, jour)`. **Aucun droit** pour `anon`/`authenticated` : seule la fonction écrit, par la clé de service. Vue `private.assistant_usage_jour`
(compte, jour, appels, jetons) pour la lecture par Neegan dans l'éditeur SQL. Preuve `0004` : table et droits.

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
3. Poser la fonction : **(a)** coller `index.ts` et ses modules dans l'éditeur du tableau de bord (« Deploy a new function », nom
   `assistant`, « Verify JWT » **désactivé** côté passerelle Supabase : c'est la fonction qui vérifie le jeton elle-même, pour
   répondre au `OPTIONS` sans jeton) ; ou **(b)** installer le CLI Supabase (`brew install supabase/tap/supabase`, épinglé) et
   `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb --no-verify-jwt`. **À choisir.**
4. Coller `0004_assistant_journal.sql` puis sa preuve (comme `0003`).
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

## 9. Décisions à confirmer par Neegan

- Déploiement **(a)** tableau de bord ou **(b)** CLI par Homebrew.
- Quota par défaut : **60 appels par compte et par jour** (modifiable sans redéploiement par le secret).
- Modèle par défaut : `claude-sonnet-5-5` pour les trois outils.
- Origines admises : le site public seulement, ou aussi `localhost` pour tes essais sur le Mac.
