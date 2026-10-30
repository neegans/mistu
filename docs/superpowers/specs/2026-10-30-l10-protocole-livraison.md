# L10 — contrat opérationnel A de livraison

30 octobre2026, préparation documentaire seulement. Spec§4/8 et plan relus contre index.html, app.js, sw.js, sw-rules.js, i18n, manifeste PWA et anciens tests de fermeture. Aucun src, test, worker ou index modifié pour L10. Reçu public L9 acquis : code ed454203, reçu14cc996, version0.31.0/DB6/archive7. Le GO de construction est consigné dans le plan après le gel de cette annexe.

## 1. Propriétaires et fichiers

| Propriétaire | Fichiers / responsabilité |
|---|---|
| A | `tools/generer-livraison.mjs`, `tools/livraison-entrees.mjs`, `tools/service-worker.template.js`, `sw-rules.js`, `src/core/livraison-format.js`, `src/core/livraison.js`, `src/demarrage.js`, `index.html` ; artefacts générés `livraison-manifeste.json` et `sw.js` ; preuves générateur, worker et démarrage |
| B | `domain/hors-ligne.js`, `ui/hors-ligne-repas.js`, repas et paramètres exacts du lecteur de recette ; ne lit pas CacheStorage |
| C | `app.js`, garde explicite router/sortie-editeur, présentation de mise à jour et diagnostic Réglages ; ne possède ni démarrage ni activation |
| Root | versions, CSS, traductions habituelles, runner, réception/publication ; synchronise le suffixe de livraison avant génération finale |

C retire le register historique de app.js quand le démarrage A le remplace ; un seul propriétaire enregistre le worker. A ne touche pas les gardes métier de C. Aucun changement IndexedDB, magasin, archive ou SQL.

Les tests permanents proposés sont `tools/generer-livraison.test.mjs` (sorties reproductibles), `tests/l10-livraison.js` (ports/identités/timeout/dispose) et une preuve de navigateur à origine jetable servant réellement deux livraisons. Les anciens tests SHELL de tests/sync.js doivent lire le manifeste et conserver leur preuve de fermeture ; leur syntaxe de lecture actuelle ne doit pas imposer une deuxième liste éditoriale.

## 2. Génération et primitives fermées

`tools/livraison-entrees.mjs` est l'entrée éditoriale unique : racines démarrage/app, ressources HTML/CSS/PWA et énumérations explicites des chemins calculés, si nécessaires. Le générateur découvre les imports statiques et dynamiques littéraux et contrôle les références des ressources. Une expression d'import non littérale sans énumération vérifiable est une erreur. Les faux imports dans commentaires/chaînes ne constituent pas des dépendances ; cette frontière reçoit des fixtures. Vendor est une ressource intégrale bornée, pas du code exécuté pour découvrir ses dépendances. Les ressources embarquées et chemins réellement utilisés doivent être couverts ; aucun fetch de données métier n'est ajouté à l'inventaire.

Commande : `node tools/generer-livraison.mjs` écrit les deux artefacts ; `--check` recalcule sans écrire et sort1 à la moindre divergence. La version `release` vient de la méta fermée `mistu-release` dans index.html, sous forme version APP + suffixe livraison. Elle doit correspondre à APP_VERSION. Root change le suffixe pour toute nouvelle livraison, y compris un correctif de worker. Le générateur refuse un contenu de manifeste ou de worker généré changé sous le même release que l'artefact présent ; il ne réutilise pas silencieusement ce numéro. Une regeneration identique est permise.

Manifeste inchangé par rapport à la spec : `{format:1,release,entries:[{path,bytes,sha256,mime}]}`. Clés dans cet ordre, entrées triées par octets UTF-8, JSON compact UTF-8 sans BOM ni saut de ligne final ; SHA256 des octets exacts de ce fichier. Limites inchangées :1024 entrées,1Mio manifeste,32Mio cumulés,8Mio/fichier, tailles positives sûres. `index.html` présent exactement une fois, manifeste et worker hors inventaire. Le worker généré est autonome : table, hash et règles statiques embarqués, sans import réseau mutable au démarrage du worker. Le modèle est versionné. Il n'y a ni bundler applicatif, eval ni script blob.

Feuille `src/core/livraison-format.js`, sans dépendance UI/repo :

- `LIMITES_LIVRAISON` : les bornes ci-dessus, release80caractères (version numérique `majeur.mineur.patch-suffixe`), request_id128 (token non vide ASCII lettres/chiffres/underscore/tiret), délai de message par défaut5000ms (injection de test, plafond10000ms).
- `validerManifesteLivraison(value)` → copie fermée validée ou erreur typée `ErreurLivraison` ; aucune normalisation d'octets de fichier.
- `serialiserManifesteLivraison(manifeste)` → chaîne canonique exacte ; `empreinteManifesteLivraison(manifeste)` → SHA256 async.
- `normaliserPorteeLivraison(baseURL)` → URL de dossier absolue same-origin, sans query/hash, terminée par `/` ; usage interne seulement, pas de propagation au diagnostic.
- `validerReponseCoquille(value,{request_id})` → copie de la réponse wire fermée ou refus ; n'est pas une preuve d'identité du worker à elle seule.

`sw-rules.js` garde les primitives legacy `isSameOriginGet` et `shouldCache(request,origin)` : le worker0.31 utilise ce fichier via importScripts et une mise à jour de dépendance peut être observée alors que son script principal reste historique. Cette compatibilité ne devient jamais l'autorité du worker L10, qui utilise exclusivement la résolution fermée de l'inventaire. Les tests gardent explicitement cette distinction historique. Le même fichier fournit une résolution fermée vers les seules entrées connues. Son code statique peut être embarqué par le générateur dans le modèle ; cela ne change pas les modules ES de l'app. Les chemins invalides/traversants/externe/séparateurs encodés sont refusés conformément à la spec. Les alias de document sont seulement la portée `/mistu/` et son `index.html` ; les routes profondes de l'app restent dans le fragment. Une navigation vers un autre fichier du site n'est pas réécrite en recette.

MIME canonique et essences HTTP admises : HTML `text/html`, CSS `text/css`, JS canonique `text/javascript` avec les deux seules essences `text/javascript` et `application/javascript`, PWA `application/manifest+json`, SVG `image/svg+xml`, PNG `image/png`. Essence insensible à la casse, paramètres charset ignorés ; taille et SHA restent exacts. HEAD lu le30octobre : GitHub Pages JS=application/javascript, serveur Python local JS=text/javascript ; webmanifest=application/manifest+json des deux côtés. Aucun alias JSON générique supplémentaire n'est nécessaire.

## 3. Worker : validité, lecture et nettoyage

Cache immuable : `mistu-shell-v1:<sha256-portee>:<sha256-manifeste>`, avec SHA de l'URL de registration normalisée pour séparer deux applications/ports. Les clés sont des URL canoniques d'entrées, sans query/hash. Installation : GET same-origin, credentials omit, redirect error, cache no-store ; statut200 exact, essence MIME admise, lecture du flux bornée avant tout put. Un Content-Length ne remplace pas le comptage des octets. Maximum deux lectures/vérifications en vol, puis relecture complète du cache avant fin install. Pas de skipWaiting/claim. Une installation interrompue n'efface que sa tentative incomplète identifiée, jamais un cache déjà valide de même identité.

Chaque hit livré est revérifié taille/MIME/SHA. Cache miss ou corruption : tentative réseau seulement avec les mêmes octets attendus ; échec explicite sinon, pas de recherche dans d'autres caches. Un diagnostic shell_status est une lecture complète sans réseau de réparation : il ne transforme pas silencieusement un manque en téléchargement. Une éviction se constate lors de la prochaine vérification/livraison, aucun événement navigateur universel n'est inventé.

Les navigations du document peuvent porter query OAuth : servir les octets publics de index.html tout en laissant URL/query/fragment dans la page ; jamais stocker l'URL complète ou ces paramètres dans les caches, métadonnées ou diagnostics. Pour une ressource de coquille connue avec query technique, la résolution éventuelle ignore uniquement la query pour servir les octets immuables de cette entrée, sans écrire cette URL ; jamais réseau vers une nouvelle révision sous prétexte de query. Cela préserve les lectures de styles avec cache-busting des tests sans permettre un mélange A/B. Une URL hors inventaire reste hors cache et hors ce protocole.

Métadonnée de nettoyage séparée, bornée et non probante : cache `mistu-shell-meta-v1:<sha256-portee>`, une entrée interne contenant `{format:1,scope_sha256,active_release,active_manifest_sha256,active_cache}`. À l'activation naturelle, lire l'ancien enregistrement exact, écrire le courant, puis supprimer uniquement l'ancien cache actif prouvé de cette registration s'il est différent. Forme inconnue, scope/cache incompatibles, défaut lecture/écriture : conserver les caches inconnus. Un crash après écriture peut laisser un cache ancien, ce qui est sûr. Ni préfixe, date ni scan global ne justifient de supprimer waiting/install ou un cache étranger. La métadonnée n'est jamais nécessaire à la validité du démarrage.

Wire exactement celui de la spec : requête `{protocol:1,type:'shell_status',request_id}` ; réponse `{protocol:1,type:'shell_status',request_id,release,manifest_sha256,complete}`. Un port transféré par demande. Le worker n'accepte qu'un WindowClient de sa portée et origine, sans lire/copier sa query ou son fragment. Il vérifie tout son cache pour répondre. `false` signifie entrée absente/invalide constatée ; erreur de lecture empêchant la vérification → aucune réponse positive, le client rend inconnu au timeout. Aucun champ métier, URL ou identité de compte. Pas de protocole d'autorisation de fermeture ou d'inventaire des fenêtres ajouté : ce dernier reste facultatif et inutile au résultat L10.

## 4. API exacte consommée par B et C

`creerControleLivraison({releasePage,baseURL,serviceWorker,MessageChannel,maintenant,delaiMs})` construit l'instance injectable. Elle ne lit ni IDB ni données métier. Le démarrage enregistre cette instance par `installerControleLivraison(instance,{mode,manifest_sha256})` une seule fois avant import app. L'instance appartient à la factory locale ; le mode contrôlé exige sa dernière preuve complète du contrôleur/release/empreinte, encore courante. Un objet ou hash arbitraire n'est pas une admission. Avant cette admission, l'observation n'est pas un certificat d'exécution contrôlée. B/C utilisent `obtenirControleLivraison()` → instance ou null ; les tests d'écran peuvent injecter leur instance. Une absence vaut inconnue.

Surface de l'instance :

- `verifier()` → Promise d'une observation figée ci-dessous, fraîchement lue. Demandes simultanées identiques partagent la même promesse et le même objet résultat ; au plus une demande par objet ServiceWorker. Aucun polling.
- `etat()` → dernière observation ou null. Son âge n'est jamais déguisé en vérification fraîche.
- `estCourante(observation)` → bool synchrone : même observation émise par cette instance, époque de présentation/contrôleur/registration encore exacte, non disposée, et aucune vérification plus récente l'ayant remplacée. Ne prétend pas détecter spontanément une éviction de fichiers.
- `observer(listener)` → unsubscribe. Controllerchange, updatefound et statechange pertinents invalident d'abord la preuve et notifient un état inconnu ; puis une vérification readonly partagée peut notifier le résultat. Aucun reload, changement de DOM ou mutation métier. B invalide son bilan sur ce signal ; sa vérification finale appelle aussi estCourante.
- `dispose()` → retire listeners, ferme tous ports et timers ; promesses en vol terminées en inconnu/dispose. Un écran désabonne son observer, il ne détruit pas le service global.

Observation affichable fermée :

```
{
 etat: 'verifiee'|'incomplete'|'inconnue'|'incompatible'|'non_controlee',
 execution: { release: string, mode: 'controlee'|'en_ligne_non_verifiee', manifest_sha256: null|string },
 controleur: null|StatutWorker,
 actif: null|StatutWorker,
 attente: null|StatutWorker,
 raison: null|'indisponible'|'delai'|'reponse_invalide'|'worker_change'|'portee_incompatible'|'livraison_incompatible'|'cache_incomplet'|'non_controlee'|'dispose',
 verifieLe: stringISO
}
StatutWorker = { release:null|string, manifest_sha256:null|string, complete:null|boolean }
```

Null worker signifie absent ; worker présent mais non vérifiable = objet avec champs null. `complete` n'est jamais déduit de activated/installed. Une réponse reçue par un MessagePort ne porte pas à elle seule une identité de ServiceWorker : l'instance garde l'objet ciblé, la registration et sa portée exacts, ferme le port sur toute fin, puis revérifie ces références avant d'admettre le résultat. Un mauvais request_id/champ supplémentaire/type/registration ou résultat tardif est ignoré/refusé. Les workers actifs et en attente peuvent avoir des livraisons différentes ; seul le contrôleur compatible avec la livraison exécutée et son empreinte permet etat verifiee.

Une page lancée en repli en ligne garde mode en_ligne_non_verifiee jusqu'à un nouveau document de démarrage : un controllerchange ultérieur ne certifie pas rétroactivement les modules déjà exécutés. Waiting complète donne une mise à jour prête, jamais « l'écran utilise B ». Les observations n'exposent ni Worker, ni URL, ni identité propriétaire ; les capacités de comparaison restent privées.

## 5. Démarrage et couture avec app

`index.html` identifie seulement release via méta `mistu-release`. Avant décision, il ne lance que `src/demarrage.js` et ses petites feuilles livraison ; pas CSS/vendor/app, repo, DB ou i18n complet. Le document garde un contenu accessible de démarrage/repli, sans script inline ni modification CSP. Les liens qui chargent manifest/icônes/styles sont montés après décision pour garder cette frontière observable.

Exception de texte explicitement acceptée root : les messages pré-montage restent en français statique, comme index/noscript actuel ; ne pas charger EN/repo avant vérification seulement pour respecter la forme t. Les mêmes messages réutilisés après montage passent par t et EN habituels. Aucune préférence de langue persistée supplémentaire.

Ordre : enregistrer sw.js avec updateViaCache:none → identifier controller/registration → shell_status complet → vérifier release HTML égale contrôleur → marquer exécution contrôlée → charger styles/vendor puis importer app. Capture du contrôleur revérifiée avant import app. Le worker immuable garantit ensuite chaque import tardif. L'activation naturelle et la prise de contrôle d'une nouvelle navigation suivent la [spécification Service Workers W3C](https://www.w3.org/TR/2026/CRD-service-workers-20261029/) ; elles ne sont pas remplacées par un vote applicatif.

Sans contrôle, active compatible complète peut justifier une seule reprise automatique de la même URL, avant tout métier. SessionStorage ne contient que marqueur booléen/versionné de tentative par portée, jamais URL/query/fragment. Lire/écrire le marqueur avant navigation ; si stockage indisponible ou déjà tenté, afficher Reprendre explicitement/Continuer en ligne, pas boucle. Une reprise explicite n'autorise pas une nouvelle boucle automatique. Marqueur effacé uniquement lorsque contrôleur+livraison cohérente est établi. Si HTML réseau B côtoie contrôleur A, ne pas mélanger : la même navigation reprend le document A vérifié. Mismatch persistant → repli expliqué.

Un ancien worker incompatible/muet rend le contrôle inconnu ; le démarrage explique l'adoption historique, offre la conservation/fermeture selon l'écran en usage et ne force jamais un écran métier déjà monté. Continuer en ligne est un geste explicite de première entrée ; aucune garantie de coquille cohérente n'est attribuée à ce repli. La fermeture/réouverture d'anciens onglets demeure une limite documentaire, pas un protocole rétroactif.

## 6. Réception avant implémentation puis avant publication

Avant code, B/C relisent cette API et les frontières suivantes : réplication des noms, singleton sans poll, état inconnu de ports/lecture, bouton Conserver sans reload, configuration de sortie encore distincte. Le partage de fichiers est figé avec eux.

Après GO, rouges causaux : générations divergentes à release réutilisé, MIME réellement servi, plus grosse réponse bornée, cache corrompu/missing, requêtes à query ne mélangeant pas A/B, cache étranger/waiting intacts, channels fermés, lifecycle changé pendant réponse, première visite sans app prématurée, sessionStorage refusé, nouveau document A/B cohérent. Deux livraisons réellement servies et imports dynamiques tardifs ; A chargée, B en attente, garde de saisie, fermeture humaine puis B. Transition historique reçue séparément. Les preuves de première visite observent réseau et DOM, pas seulement un état en mémoire.

Les plafonds32Mio/8Mio et deux vérifications concurrentes restent des bornes contractuelles à mesurer sur L9 et l'artefact final. La réparation d'un miss ne crée pas un second téléchargeur de médias ; les fichiers métier restent sous le moteur existant de B. Aucun résultat de cette note n'est une réception L10.


Précision de réception historique : selon [W3C§6.3.2](https://www.w3.org/TR/2026/CRD-service-workers-20261029/#importscripts), un worker actif redémarré réutilise sa carte de ressources ; il ne faut pas prétendre qu'un nouveau sw-rules est nécessairement demandé au réseau à ce moment. Le harnais distingue redémarrage inchangé et update avec script principal historique/dépendance nouvelle. La compatibilité des deux fonctions historiques est conservée dans les deux cas ; aucune propriété nouvelle n'est attribuée aux onglets historiques.
