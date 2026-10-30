# RÉSUMÉ — qualité des tests du lot Codex (Mistu, 29-30 oct. 2026, copie 247b2e5)

## Estimation chiffrée
- Lot neuf : 139 fichiers, 3 651 sites d'assertion (≈ 4 400 assertions exécutées, 11,6 % des sites dans des boucles de
  cas distincts). Total épinglé 11 538 : ≈ 9 795 sites statiques effectifs, le reste (≈ 15 %) vient de boucles/aides.
- Comptage exhaustif des patrons sur le lot : **creux ≈ 0,5 %** (17-25 sites : `ok(true)`, `typeof === 'function'`),
  **faibles ≈ 4 %** (≈ 150 : 109 refus « n'importe quelle exception », 12 assertions sur le serveur factice, quelques
  `eq(x.prop, undefined)` qui restent verts si `prop` est renommée, deux suites contre un double interne),
  **comportement ≈ 95 %**.
- Échantillon lu (39 tests, 20 fichiers, biaisé vers les lignes suspectes) : 24 comportement / 9 faibles / 6 creux.
- Lecture du source dans les tests du lot : 0. Texte d'écran sans événement mesuré : 0 trouvé. Await manquant : 0 réel.
  `catch` vides : 7, tous suivis d'une assertion discriminante. Délais : bornés et levants, risque = flakiness, pas faux vert.
- Mutants (8 gardes lus) : 6 rougiraient vraiment (capacité, vapeur cumulée, mixage chaud, huile seule, eau vapeur,
  découpage 499 lignes + fragment ≤ 262 144) ; cycle de corbeille rougit mais sans distinguer garde et plantage ;
  `absente:true` prouvée au niveau moteur, pas isolée au niveau dépôt ; `too_large` (64 fragments, 4 Mio) jamais atteint.

## Les 10 pires exemples
1. `tests/l5-transferts-source.js:9` — `ok(true,'toutes empreintes vérifiables')` : ne peut pas rougir.
2. `tests/l6-versions-structurees.js:8` et `:16` — `ok(true, …)` après exécution, témoins inertes.
3. `tests/l6-commandes-traduction.js:8` — `ok(true,'empreinte complète vérifiée')`.
4. `tests/l9-navigation.js:9,25,35` — `ok(typeof api==='function'); if(!api) return;` : vert trivial, le reste disparaît.
5. `tests/l6-lecture-exports.js:14-15` — `ok(typeof E.toMarkdown==='function')` (idem `l7-cuisine-ecran.js:24`).
6. `tests/l1-corbeille-domaine.js:26-28,33,36,39,43,57,58,64,72,91,94,115,120,127,137` — 14 × `ok(await refuse(fn))` où
   `refuse` rend `true` pour toute exception (`l.9`) ; un TypeError de signature vaut une garde.
7. `tests/l2-corbeille-domaine.js:34-81` — 10 × idem, sans snapshot entre les refus.
8. `tests/l2-corbeille-sync.js:38-39` — assertions sur `serveur.ligne(...)` : on teste l'arbitre factice
   (`tests/transport-factice.js`), pas `sync_push_v2`.
9. `tests/l3-navigation.js:43,87,100` — `eq(x.retourConnu(...).cleEntree, undefined)` : propriété renommée = vert à vie.
10. `tests/correctifs-thermomix-securite.js:19` — « une précision basse ne masque pas la somme » : la garde
    (`src/domain/thermomix.js:222`) ignore `volume_bol_l` ; le test passe pour une autre raison que son libellé.
Mentions : `tests/index-livre-ecran.js` libellé « (1 appel) » attend « 3 appels au plus » ; `tests/i3-integration.js`
`ok(a)` élargi en `ok(a || b)`.

## Ce qui est solide
- `withRepo` (`tests/sync-fixture.js`) : vraie IndexedDB jetable + vrai `repo.js` + vraie capture ; les écrans montent les
  vrais `render*` avec `fetch` injecté. Les modules testés sont toujours les vrais (36 fichiers par `await import`).
- `tests/correctifs-thermomix-securite.js` : raison exacte + témoin à la borne, jusqu'au vrai écran. Référence du lot.
- Concurrence client réelle : 2e connexion IndexedDB (`l0-traductions.js:52`), course injectée dans la transaction
  (`l7-archives.js:52`), quota injecté (`l7-archives.js:57`), vrai moteur de sync (`l10-hors-ligne-medias.js`).
- Octets et bornes mesurés (`l6-passerelle-brut.js`, `l5-index-stockage.js:21`) ; épingle + 114 filets : une suite qui
  plante ne passe pas pour verte.

## Preuves PostgreSQL (h) et total (i)
- `tools/prover-*.mjs` (29) = générateurs de SQL pour `psql`, hors `node --test`, exigent un PostgreSQL local avec les
  migrations 0001→0013 (`sync_push_v2`, `private.allowed_users`, `auth.users`, rôle `authenticated`) ; le `.cjs` exige
  `L1_PROOF_LOCAL=1` et un serveur sur `127.0.0.1:55439`. Aucun lanceur, README ni mention dans STATE/CLAUDE/AGENTS ;
  traces `.superpowers/sdd/…` absentes de la copie ; registre : « serveur arrêté » après. **Reçus uniques, non rejouables
  par le propriétaire : pas un filet.** Le serveur réel n'a aucun test rejouable.
- Diff écrasé : 7 117 → 11 538, trajectoire par commit invisible. Anciens fichiers : −229/+214 lignes d'assertion, 127
  libellés disparus (22 scénarios `supprimerLivreVide`, fonction devenue `corbeille_requise` — `src/ui/book.js:58`) :
  « aucun scénario retiré » de STATE.md est inexact.

## Bilan exact de `node --test --test-concurrency=1 tools/*.test.mjs` (copie, 30 oct.)
tests 271 · pass 271 · fail 0 · cancelled 0 · skipped 0 · todo 0 · 9 212 ms · exit 0 (`node-test.log`).
12 fichiers ; 132 tests sur la fonction `assistant`, 87 sur le générateur de migrations, 2 tests SQL « dorés » ; 4 imports
de `src/` seulement : « Node 271/271 » ne couvre pas l'application.

Rapport complet : `/private/tmp/claude-501/-Users-neeganmac/5a71e0f5-d5af-485a-b6b1-dde2c5cbdc6d/scratchpad/audit/rapports/tests/rapport.md`
(sorties brutes : `sweep-lots.md`, `boucles-awaits.md`, `patch-analyse.md`, `node-test.log` ; scripts `*.mjs` à côté).
