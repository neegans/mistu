# AGENTS.md — Cuisine OS (Mistu) — consignes pour Codex

Tu reprends un projet construit jusqu'ici par Claude Code. Lis d'abord, dans cet ordre :

1. `STATE.md` (en tête : l'état du jour et ce qui est en ligne) ;
2. `docs/lots/2026-10-28-lot-I2-I3.md` (le travail à faire, les décisions déjà prises avec Neegan) ;
3. au besoin, `CLAUDE.md` (l'historique complet des lots, très long : n'y cherche que la section du module que tu touches) et
   `docs/architecture.md`.

Langue : français partout (échanges, textes d'écran, documents). Neegan est le propriétaire ; il pilote et teste lui-même.

## Le projet en une minute

- PWA **sans étape de build** : modules ES natifs sous `src/`, aucune dépendance npm, aucun bundler.
- Données locales dans IndexedDB (`src/core/db.js`, schéma `src/model/schema.js`), synchronisées avec Supabase (projet `mitsu`).
  Toute écriture passe par `src/model/repo.js` (`repo.save`, `repo.saveBatch`, `repo.transitionner` pour une écriture conditionnée).
- L'assistant (Claude) n'est JAMAIS appelé directement : tout passe par la fonction `assistant` de `mitsu`
  (`src/domain/passerelle.js`, `supabase/functions/assistant/`). Outils existants : `recherche-web`, `creation`, `extraction`, `lecture-web`,
  `image-web`, `apercu-web`. L'outil `creation` accepte une consigne `system` fournie par l'app (pas de changement serveur nécessaire).
- Site public : `https://neegans.github.io/mistu/` (GitHub Pages, branche `main`).

## Règles non négociables

- Rien d'inventé : aucune quantité, durée, page ou compatibilité alimentaire déduite. Une réponse du modèle est une **donnée hostile** :
  validée champ par champ, bornée, sans adresse web, rendue en texte (jamais `innerHTML`).
- L'original d'une recette n'est jamais réécrit : une modification = une nouvelle `RecipeVersion`.
- Les états d'écran reflètent des événements réels (pas de « enregistré » sans écriture).
- Textes d'écran par `t('texte français')` ; l'anglais dans `src/i18n/en.js` (une entrée par texte neuf). Un module neuf qui affiche du texte
  s'ajoute à `MODULES_NEUFS` dans `tests/ajouter.js`.
- **Jamais** de clé, mot de passe ou jeton dans un fichier, un test ou un message. **Jamais** de `git push`, de déploiement de la fonction
  `assistant` ni de migration SQL appliquée : ce sont des gestes de Neegan (ou de Claude Code sur son « go »).
- Un nouveau magasin synchronisé ou un nouvel outil de la fonction `assistant` exige une migration SQL (`supabase/migrations/`) : à éviter si
  possible ; sinon l'écrire, ne jamais l'appliquer, et le dire.
- Messages de commit en ASCII (sans accents), fichiers nommés un par un (jamais `git add -A`), jamais de réécriture d'historique.

## À chaque changement de code

- `sw.js` : `VERSION` (`cuisine-os-v<APP_VERSION>-<n>`) +1 à chaque commit qui touche `src/`, `styles.css` ou `index.html` ; tout module neuf
  ajouté à la liste `SHELL`.
- Un nouveau lot monte `APP_VERSION` (`src/model/schema.js`, aujourd'hui `0.18.0`) et les épingles de version des tests (fichiers qui
  contiennent `0.18.0` sous `tests/` : `ajouter.js`, `assistant-compte.js`, `classement.js`, `creer-ia.js`, `passerelle.js`,
  `recherche-web.js`, `sync-l4.js`).
- `tests/tests.js` épingle le nombre total d'assertions (`eq(results.length, N, …)`, aujourd'hui 6245) : N = le nombre d'assertions AVANT
  cette ligne ; le bilan affiché vaut N + 1. Le remettre à la valeur mesurée, et dire pourquoi s'il baisse.
- `DB_VERSION` (aujourd'hui 4) ne monte que pour un index IndexedDB neuf. Des champs JSON neufs sur une fiche n'en demandent pas.

## Tests

Tu n'as pas de terminal dans VibeForge : écris les tests, et demande à Neegan de les lancer (session « Terminal classique », après avoir
arrêté ta session sur ce dossier). Ne dis jamais « ça passe » sans le bilan lu.

- Suite navigateur (la référence) : `python3 -m http.server 8080` à la racine, puis ouvrir `http://localhost:8080/tests/` et lire le
  bilan (« ✅ N/N tests réussis » ; seule erreur console attendue : le 404 de `/favicon.ico`). Recharger sans cache après chaque modification.
- Outils Node : `node --test --test-concurrency=1 tools/*.test.mjs` (aujourd'hui 230/230) et `node tools/generer-migrations.mjs --check` (0).
- Les tests de l'écran passent par des bases jetables et un `fetch` injecté : aucun appel réel à l'assistant dans la suite.
- Écrire le test d'abord (rouge), puis le code. Un test ne cherche jamais une chaîne dans le source : il observe un comportement.

## Méthode

Spec d'abord (`docs/superpowers/specs/AAAA-MM-JJ-<lot>-design.md`), relue par Neegan, puis construction en petites tâches testées, puis
mise à jour de `STATE.md` (en tête) et de la section du lot dans `CLAUDE.md` : ce qui marche, ce qui n'est pas prouvé, les gestes de Neegan.
