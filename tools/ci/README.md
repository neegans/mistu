# Vérifications automatiques

Ces dépendances sont réservées aux outils du dépôt. L’application reste en modules ES natifs, sans npm ni étape de compilation ; rien de `tools/ci` n’entre dans la livraison.

Le workflow GitHub exécute, sur les pull requests et les envois vers `main`, le scan des fichiers suivis, les 281 tests Node historiques, les deux générateurs en mode `--check`, les tests des outils CI puis toute la suite navigateur. Aucun déploiement ni accès à un secret. Les actions sont épinglées à leur commit, Node à 24.22.2 et Playwright à 1.64.1 dans le verrou npm. PostgreSQL reste une preuve locale séparée : voir `../prouver.sh` et le README Supabase.

Depuis la racine, avec Node 24 :

```sh
node tools/ci/verifier-secrets.mjs
node --test --test-concurrency=1 tools/*.test.mjs
node tools/generer-migrations.mjs --check
node tools/generer-livraison.mjs --check
npm ci --prefix tools/ci --include=dev --ignore-scripts --no-audit --no-fund
node tools/ci/node_modules/playwright/cli.js install --with-deps chromium
node --test --test-concurrency=1 tools/ci/*.test.mjs
node tools/ci/verifier-navigateur.mjs
```

Le navigateur est celui téléchargé par Playwright, avec un profil neuf, les workers bloqués et le fuseau Toronto. Le lanceur crée son serveur local sur un port libre, attend la page de tests et ferme ses ressources après succès ou échec. Les requêtes extérieures sont bloquées. Le bilan doit être exactement positif, avec deux nombres identiques et autant de lignes vertes, sans ligne rouge. Ressource manquante, exception JavaScript, erreur console inattendue ou absence de bilan font échouer le lancement. Le délai global de 30 minutes ne modifie aucun délai interne des tests.

Les seuls incidents console admis sont onze messages exacts des scénarios d’échec injectés, provenant de `src/core/log.js`. Un code inconnu, une autre erreur ou un autre fichier restent refusés. Les erreurs d’images temporaires ne bénéficient d’aucune exception.

Chaque passage conserve son JSON, son journal et une capture du profil synthétique sous `artifacts/ci-navigateur/passage-*`, dossier ignoré par Git. Le workflow téléverse uniquement ce dossier, sans fichiers cachés, pour sept jours. Les tests courts du lanceur utilisent leurs propres dossiers temporaires et les retirent après réception.

Le scanner examine tous les fichiers suivis, y compris tests, documentation et binaires. Il autorise seulement les mentions littérales des motifs et une sentinelle synthétique exacte dans son ancien document. Un candidat voisin ou prolongé reste refusé ; les sorties n’affichent jamais sa valeur. Les nouveaux fichiers doivent être ajoutés à l’index avant le scan final local. Un échec de Git est un échec du contrôle.

Les réceptions locales et leurs limites sont consignées dans le [reçu du lot G](../../docs/superpowers/plans/2026-10-30-correctifs-audit-g-reception.md). Une réception sur Mac ne constitue pas une exécution du workflow sur Ubuntu/GitHub.
