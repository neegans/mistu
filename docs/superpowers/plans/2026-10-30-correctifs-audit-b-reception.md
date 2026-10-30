# Correctifs de l’audit — lot B

Référence : [plan fourni par Neegan](2026-10-30-correctifs-audit-L0-L10.md), tâches6 et7 ; lentille [livraison](../../audits/2026-10-30-audit-codex-L0-L10/lentilles/livraison.md). Branche `correctifs-audit-b`, base `8fd8ed2` (reçu de publication A). Autorisation : « go et enchaine ». B a ensuite été publié sur le « go » explicite de Neegan ; réception publique ci-dessous. Baseline11913 tests navigateur ; APP_VERSION0.32.2, DB6/archive7 inchangés.

## Tâche 6 — démarrage

Le correctif7696ed6 concerne la découverte des mises à jour après montage. Il ne corrige pas les courses de la frontière de démarrage : les reproductions actuelles restaient en choix, sans ouverture. Dix échecs causaux sont reçus avant code ; un second témoin atteint la dernière vérification avant import.

Une nouvelle lecture bornée est maintenant faite après un changement de worker, avant la décision initiale et avant import. Un contrôleur incomplet reste refusé. Sans API, ou après refus de register, l’app monte en mode `en_ligne_non_verifiee`, sans écran de choix intermédiaire. Les textes de cette frontière sont FR/EN selon la langue du navigateur, sans importer i18n avant admission.

Le montage métier remplace #app plus tard, après import : un helper préserve explicitement le même nœud d’information aux trois remplacements de racine (porte, coquille, erreur). Pas d’observateur permanent. Le premier placement après coquille était hors premier écran mobile (y844) ; témoin d’ordre rouge puis avis placé avant la coquille (y0/48px sur390×844). Les textes restent en texte DOM et la langue du navigateur est conservée après changement de langue de l’interface.

Ciblé **42/42**, soit **+24** depuis18. Une attente historique a changé : l’absence d’API ouvre désormais en ligne, comme demandé ; aucune assertion retirée. Suite complète **11937/11937**, zéro erreur JavaScript/requête extérieure. Parcours réels indépendants **49/49** sur quatre scénarios absent/refusé ×FR/EN : vraie porte, admission, Réglages/Bibliothèque, langue, recharge ; ligne unique visible, mode non vérifié exact, largeur390 sans débordement. Captures relues. Une première tentative de harnais utilisait une classe .shell inexistante ; son timeout a été corrigé vers .coquille et n’est pas compté comme succès produit.

Preuves : `.superpowers/sdd/2026-10-30-audit-b/t6-*.log`, `t6-parcours.json`, `parcours-demarrage/sans-worker.resultat.json` et captures. Syntaxe, diff et générateur conformes. Livraison intermédiaire **0.32.2-1**, 211 fichiers / 3 649 291 octets, SHA256 `16b9eb6b6e5bd42cf6b31db78bc7d6d947d1b7db7af0b7427ab08adab1418529`. Commit `b79c5a8`. Aucun push B ni changement serveur.

## Tâche 7 — persistance, erreurs d’installation et caches

Après la porte d’entrée, l’application demande `navigator.storage.persist()` une fois, sans attendre sa réponse pour ouvrir les routes. Une réservation atomique dans `sync_state`, d’origine `device`, empêche deux onglets de demander simultanément. Le résultat est un booléen strict ; absence d’API, exception ou attente restent inconnues. Le booléen reflète la réponse du navigateur, conformément au [contrat Storage de WHATWG](https://storage.spec.whatwg.org/#dom-storagemanager-persist) : aucune garantie physique d’absence d’éviction n’est revendiquée.

Les écritures passent par le dépôt. Un changement de base, une bibliothèque remplacée ou une réservation remplacée interdisent une réponse tardive. Un refus d’écriture ne devient pas une réussite ; un quota insuffisant avant réservation empêche l’appel. Une réservation interrompue reste inconnue sans relancer la demande à chaque ouverture. La valeur locale n’est pas envoyée dans l’outbox.

Le diagnostic affiche « Stockage protégé contre l’éviction : oui/non/inconnu » dès son montage, puis actualise la valeur lors de sa collecte. La copie JSON ne garde que ce booléen ou `null`, même si l’estimation de quota échoue. Ni marqueur brut, ni identifiant de demande, ni exception ne sont exposés. Les textes sont traduits en anglais. La fermeture du panneau et les changements de contexte empêchent les résultats tardifs d’écrire dans l’interface ou le presse-papiers.

Un worker dont l’installation échoue envoie un message fermé aux fenêtres de sa portée : type, portée, livraison, empreinte et motif parmi `shell_invalid`, `shell_incomplete`, `quota`, `indisponible`. L’écran de choix affiche ce motif, y compris s’il arrive après son montage. La source, la portée et l’identité connues du worker sont vérifiées ; une ancienne tentative ne remplace pas l’erreur d’une tentative plus récente et ne ressuscite pas après un succès ultérieur. La preuve d’un contrôleur déjà utilisable reste valable. Aucun rechargement ni activation n’est forcé.

Le message est conservé pendant la vie de la page ; il n’est pas un journal durable après fermeture de toutes les fenêtres. Le protocole `shell_status` reste inchangé. Le nettoyage attend la fin des écritures parallèles et supprime le cache partiel connu. Si la lecture d’un cache existant échoue avant de savoir s’il est incomplet, ce cache est préservé.

À l’activation, le nettoyage des noms historiques `cuisine-os-v*` s’ajoute au retrait de l’ancienne livraison exacte. Les noms historiques ne portaient pas leur portée : un cache non vide n’est supprimé que si toutes ses URL appartiennent à celle du worker. Les caches modernes étrangers, les métadonnées, les noms inconnus et les caches historiques mélangés ou étrangers sont conservés. Une erreur de nettoyage n’empêche pas l’activation. Cette vérification de portée précise la suppression par préfixe proposée dans le plan.

### Tests et réception

Les tests ont précédé les corrections : module de persistance absent, 24 échecs causaux sur 30 pour le diagnostic, échecs d’installation puis courses entre tentatives et montage. Les témoins ont été reçus verts après correction. Les mutations isolées retirant la réservation atomique, la garde de demande et les gardes de contexte font respectivement rougir 2, 4 et 9 assertions de persistance.

| Vérification | Résultat |
| --- | --- |
| Persistance, dépôt et courses entre onglets | 53/53 |
| Contrôle des échecs et écran de démarrage | 43/43 |
| Diagnostic de persistance | 30/30 |
| Worker sous Node | 19/19, dont 7 nouvelles |
| Suite navigateur complète | **12063/12063**, zéro erreur JavaScript/requête extérieure |
| Ensemble des outils Node | **278/278** |
| Revue indépendante du diagnostic et résultats tardifs | 10/10 |
| Application réelle, cinq réponses de persistance | **45/45** |
| Transition naturelle A→B et reprise hors ligne | **14/14** |
| Échecs avec de vrais workers | **15/15** |

T7 ajoute 126 assertions navigateur : 53 + 43 + 30. Avec les 24 de T6, le lot B passe de 11913 à 12063, épingle 12062 avant l’assertion finale. L’attente historique du diagnostic a été élargie au champ `persistant:null` ; le changement de contrat sans worker est décrit en T6. Les suites existantes livraison (51/51), démarrage (42/42), diagnostic (14/14) et actualisation du diagnostic (5/5) passent également.

Les parcours de persistance couvrent accord, refus, exception, suspension et API absente, dans deux onglets : aucune demande avant admission, appel unique, routes disponibles pendant l’attente, valeur identique en base et dans le diagnostic copié, recharge sans nouvel appel. La transition utilise les fichiers exacts de A `243266b` et B : A conserve son cache tant qu’une fenêtre l’utilise, B prend la suite après fermeture, les données et la note sont retrouvées après rechargement réellement hors ligne. Les captures à 390 et 1280 pixels sont relues, sans débordement. Le test d’installation invalide vérifie le motif visible et la suppression du cache partiel ; un échec de mise à jour conserve le contrôleur A et la saisie, sans navigation.

Preuves locales ignorées par Git : `.superpowers/sdd/2026-10-30-audit-b/t7-suite.log`, `t7-node.log`, `t7-persist-*.log`, `t7-echec-*.log`, `t7-worker-*.log`, `t7-ordre-*.log`, `revue-diagnostic.json`, `revue-worker-reel.resultat.json`, `parcours-demarrage/persistance.resultat.json`, `parcours-demarrage/transition.resultat.json` et captures associées. Le parcours T6 sans worker (49/49) a été reçu sur la livraison intermédiaire ; les suites complètes et les parcours T7 portent sur la livraison finale.

Limites : Chrome local, profils et bibliothèques jetables, API de persistance simulée, vrais workers. Aucun compte privé, appel assistant payé, essai physique iPhone/Safari ou promesse de conservation par le système.

## État prêt à publier

Livraison locale **0.32.2-2**, **212 fichiers / 3 655 921 octets**, manifeste SHA256 `533f888d39e4a03d255f9652acffe540cc0a0a1428b556822a991808e7b53d39`. Générateurs livraison et migrations, syntaxe et diff conformes. APP_VERSION **0.32.2**, DB6/archive7 inchangés ; aucun SQL ni déploiement de la fonction assistant.

**A reste publié en 0.32.1-5. B est reçu localement, pas publié.** Le prochain geste est la promotion en avance rapide et la publication de B après le « go » explicite par lot demandé dans le plan, puis sa réception publique. Les lots C à G restent à exécuter ; la migration 0014 du lot C devra être écrite et testée sans application distante.


## Publication reçue

Neegan a autorisé « go » après présentation du lot B complet. Le code `32dc3de844b8da38ac2c9c40a8c546f4259da6f1` a été promu par avance rapide et poussé sur `main`. GitHub Pages a terminé la construction le **30 octobre 2026 à 20:31:25 UTC (16 h 31 HAE)**. **0.32.2-2 est en ligne.**

Les **251 fichiers publics** contrôlés correspondent au commit : octets, SHA256 et MIME attendus. La suite publique exécute **12063/12063 tests**, sans erreur JavaScript ni requête extérieure. Les parcours publics indépendants réussissent **105/105 contrôles** : quatre replis FR/EN, cinq réponses simulées de persistance et une utilisation de l’API native, deux onglets, diagnostic copié, bibliothèque et note conservées après recharge réellement hors ligne. Le cache contient les **212 ressources** exactes de la livraison. Six mesures et treize captures relues, largeurs 390 et 1280 sans débordement.

Sur ce profil jetable Chrome, l’API native de persistance répond **false** : la valeur est gardée en base et affichée « non », après recharge et hors ligne. Ce reçu ne revendique donc pas une protection accordée par le navigateur. Les autres scénarios restent explicitement simulés. Aucun compte privé, appel payé ou appareil physique iPhone/Safari n’a été utilisé.

Preuves : `.superpowers/sdd/2026-10-30-audit-b/publication-fichiers.json`, `suite-publique.log`, `public/public.resultat.json`, `public.log` et captures dans `public/`. Le lot B est clos ; le lot C peut être construit. La migration 0014 sera écrite et éprouvée localement, sans application distante.
