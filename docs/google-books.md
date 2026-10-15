# Clé Google Books — pourquoi publique, comment la poser

Spec : `docs/superpowers/specs/2026-10-14-identifier-un-livre-fiable-design.md`, § 7. **État livré : la case est vide**
(`src/sync/config.js`, `GOOGLE_BOOKS = { key: '' }`) : Google Books n’est **jamais** appelé, l’app vit avec Open
Library seule. Poser une clé est un geste de Neegan, facultatif.

## À quoi elle sert

Quand Open Library **répond** qu’elle n’a aucune fiche pour un ISBN, l’app peut demander à Google Books en second.
Sans clé, Google répond 429 (quota anonyme à zéro) : d’où la case vide. Google n’est **jamais** appelé quand Open
Library n’a pas répondu (l’écran dit alors « n’a pas répondu » et offre « Réessayer »).

## Pourquoi elle est publique

Le site est une PWA statique servie par GitHub Pages : tout ce que le navigateur utilise se lit dans le dépôt public.
Une clé d’API Google côté navigateur est donc **publique par conception**, comme la clé `anon` de Supabase. La
restriction par référent HTTP est un **dos-d’âne**, pas un mur : un `Referer` se forge en une ligne hors navigateur.

## Les murs (ce qui protège vraiment)

1. **Un projet Google Cloud dédié, SANS compte de facturation** (par exemple `cuisine-os-livres`). **Pas**
   `cuisine-os-neegan` : celui-là porte le client OAuth de la connexion, et un signalement d’abus ne doit pas toucher
   le login. Sans facturation, un abus ne coûte rien.
2. **Restriction d’API : « Books API » seule.** Une clé sans restriction d’API ne doit **jamais** être collée.
3. **Quota abaissé** (IAM et administration → Quotas, Books API, par exemple 200 requêtes par jour).
4. **Restriction par référent quand même** (le dos-d’âne) : `https://neegans.github.io/*`, `http://localhost:8082/*`
   (et les autres ports locaux utilisés), plus l’hôte du **sous-domaine D5** le jour où il existe.

Impact accepté d’un abus : la perte du repli Google jusqu’à rotation de la clé. Rien d’autre n’est atteignable.

## Étapes dans la console Google Cloud

1. Créer le projet dédié ; ne lui associer **aucun** compte de facturation.
2. API et services → Bibliothèque → « Books API » → Activer.
3. API et services → Identifiants → Créer des identifiants → Clé API.
4. Modifier la clé : « Restrictions relatives aux applications » = Sites web, ajouter les référents ci-dessus ;
   « Restrictions relatives aux API » = Restreindre la clé → Books API seule. Enregistrer.
5. Abaisser le quota de la Books API (point 3 des murs).

## La coller dans l’app

1. `src/sync/config.js` : `export const GOOGLE_BOOKS = { key: 'AIza…' };` — la suite vérifie la **forme**
   (`/^AIza[0-9A-Za-z_-]{35}$/` ou vide), jamais la valeur.
2. `sw.js` : incrémenter `VERSION` (sinon l’app installée garde l’ancien `config.js` en cache).
3. Lancer la suite (`tests/`), puis commit et `git push` par Neegan.

**Si GitHub refuse le push** (protection des secrets : la chaîne `AIza…` est reconnue comme une clé Google) : le
message de refus donne un lien. L’ouvrir, autoriser **cette** clé en choisissant le motif le plus proche de la
réalité (« clé publique par conception, restreinte par API, projet sans facturation »), puis relancer le même
`git push`. Ne jamais contourner en coupant la protection pour tout le dépôt.

## Ce qui part vers Google

L’ISBN seul, dans `https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn13>&maxResults=1&key=<clé>`. Les appels
Open Library partent sans référent (`no-referrer`) ; **l’appel Google, et lui seul**, part en `strict-origin` :
l’origine seule (`https://neegans.github.io/`), jamais le chemin ni le `#`, faute de quoi Google refuserait une clé
restreinte par référent.

## Mesure à faire AVEC la clé (rien de ceci n’est prouvé aujourd’hui)

Sur **Chrome ET Safari** (Mac, puis iPhone), depuis le site public :

1. Choisir un ISBN **valide** pour lequel Open Library répond « Aucune fiche chez Open Library pour cet ISBN. Complète à la main. »
   (le vérifier d’abord sans clé).
2. Avec la clé posée et poussée : « Identifier » → attendu « **Renseigné par Google Books — vérifie et corrige.** »
3. Outils de développement → Réseau → la requête `www.googleapis.com/books/v1/volumes…` : statut **200**, en-tête
   **`Referer: https://neegans.github.io/`** (l’origine seule) — preuve que Google accepte un référent réduit à
   l’origine et que le navigateur l’envoie.
4. Si Google répond 403 (`API_KEY_HTTP_REFERRER_BLOCKED`) : le référent n’est pas accepté sur ce navigateur ; la
   personne voit « Aucune fiche chez Open Library pour cet ISBN (Google Books n’a pas répondu). Complète à la
   main. » — consigner le navigateur et la version, puis revoir la liste des référents.

Consigner le résultat (navigateur, version, statut, `Referer` vu) dans `CLAUDE.md`, sous-section « Identifier un
livre, fiable ».
