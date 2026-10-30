# Cuisine OS (Mistu)

Mistu conserve livres, recettes, variantes, photos, notes, repas et inventaire dans IndexedDB. L’application utilise des modules ES natifs et un hébergement statique, sans framework ni bundler. La synchronisation passe par Supabase ; les appels de l’assistant passent par la fonction serveur du projet `mitsu`.

**Version réellement publiée, contrôles exécutés et travail restant : [STATE.md](STATE.md).** Les spécifications et rapports datés distinguent les résultats automatisés des essais sur appareils physiques.

## Démarrer et vérifier

```sh
python3 -m http.server 8080
```

Ouvrir `http://localhost:8080/`. Le site hébergé est [Mistu sur GitHub Pages](https://neegans.github.io/mistu/), construit depuis `main`. Une publication n’est reçue qu’après construction de Pages et vérification des fichiers publics.

Le service worker exige HTTPS ou localhost. Sur une adresse HTTP non sécurisée, le démarrage propose de continuer en ligne, sans annoncer une disponibilité hors ligne vérifiée. Sur iOS, l’installation se fait depuis Safari → Ajouter à l’écran d’accueil. Le comportement matériel reste à recevoir sur les appareils concernés.

Pour les tests : ouvrir `http://localhost:8080/tests/`. Les scénarios utilisent des bases jetables et des transports injectés, sans appel payé à l’assistant ni bibliothèque personnelle. Les preuves de cycle réel du worker utilisent une origine et un profil séparés.

```sh
node --test --test-concurrency=1 tools/*.test.mjs
node tools/generer-migrations.mjs --check
node tools/generer-livraison.mjs --check
```

Le dernier outil contrôle le manifeste et le worker générés. Après modification des ressources livrées, augmenter le suffixe de livraison dans la méta `mistu-release` de `index.html`, puis lancer `node tools/generer-livraison.mjs`. La version applicative vient de `src/model/schema.js`. Une identité de livraison ne se réutilise pas avec des octets différents. Il ne s’agit pas d’une compilation de l’application : les modules restent servis tels quels.

## Parcours

| Parcours | Où |
| --- | --- |
| Identifier un livre par ISBN ou couverture, confirmer sa fiche ; saisir manuellement reste possible | Ajouter un livre |
| Photographier des pages, conserver PDF et sources, lire un index, reprendre une lecture et comparer les révisions | Livre → Pages source |
| Ajouter une recette, garder un lien, lire une page web ou demander une création à vérifier | Ajouter |
| Web (avec l'assistant, une fois connecté) | Ajouter → Web |
| Assistant IA | Assistant servi par ton compte ; la clé vit côté serveur, rien à configurer. |
| Chercher, filtrer, sélectionner et retrouver la position dans les listes | Bibliothèque, Recherche |
| Consulter original et variantes, groupes d’ingrédients, traduction choisie et passages encore dans la langue source | Fiche recette |
| Corriger avec brouillon local, reprendre une réponse conservée et récupérer un texte non enregistré | Éditeurs |
| Garder ses notes et photos de cuisson séparées des photos du livre | Fiche recette, bilan de cuisson |
| Retirer puis restaurer recettes et livres, en conservant les sources et les contrôles de concurrence | Corbeille |
| Composer un repas, choisir une date sans heure, revoir les courses et leurs conventions | Ma semaine |
| Cuisiner plusieurs versions, reprendre une séance et ses minuteurs indicatifs | Mode cuisine |
| Confirmer du stock, consommer une quantité choisie et garder les restes d’une cuisson précise | Ma cuisine |
| Vérifier le contenu et les médias choisis disponibles sur cet appareil | Repas → Préparer hors ligne |
| Archiver, inspecter avant restauration, exporter une copie lisible et copier un diagnostic sans contenu privé | Réglages |

Les réponses de l’assistant sont des propositions à vérifier. L’original n’est pas réécrit par une correction ou une adaptation. Les durées estimées et les valeurs corrigées gardent leur provenance. Les réglages Thermomix restent soumis aux contrôles de volume total, température, vitesse, accessoires et enchaînements ; ils ne certifient pas une recette testée sur machine.

Dans Créer avec l’IA : **Un appel à l'assistant par clic** sur la commande de création. Relire une réponse déjà conservée ou enregistrer ses corrections ne relance pas cet appel.

**Cookidoo : transfert manuel par champs.** L’automatisation officielle n’a pas été démontrée par la recherche ciblée et est écartée pour cette livraison. Aucun identifiant Cookidoo n’est demandé par Mistu. Voir la [décision E1](docs/superpowers/specs/2026-10-30-e1-cookidoo-design.md).

## Synchronisation, photos et hors ligne

Avec un compte autorisé, les fiches **et les octets des photos/PDF** empruntent le moteur de synchronisation existant. La réception des fiches, l’envoi des fichiers et leur téléchargement sont des étapes distinctes. La pastille de changements à envoyer ne prouve pas que les photos sont déjà présentes sur l’autre appareil. Certains fichiers reçus sont des copies réduites ; leur présence ne prouve pas la conservation de l’original.

Sans compte, la bibliothèque reste locale et peut être transférée par archive. Avec un compte, une écriture hors ligne attend son envoi. Les commandes protégées de corbeille, sources, traduction, cuisine et inventaire gardent leur propre protocole ; les autres fiches conservent leur arbitrage existant. La fusion de cases de courses vérifiée entre onglets d’une même base ne constitue pas une fusion entre deux appareils.

La préparation hors ligne porte sur les versions et langues choisies, les notes et les médias sélectionnés. Elle relit les données et décode les images ; fichier absent, image illisible et vérification inconnue restent distincts. Le bilan est daté et reste en mémoire : après rechargement du repas, il faut vérifier à nouveau. Un lien de consultation garde sa version et sa candidate explicites. Les choix du mode cuisine restent séparés. Les fonctions d’assistance et de recherche en ligne nécessitent une connexion.

Les mises à jour compatibles attendent la fin d’utilisation de l’ancienne livraison. Le message propose de conserver le travail, puis de fermer toutes les fenêtres Mistu, y compris celles de la PWA, et de rouvrir. Aucun rechargement forcé ne vient interrompre une saisie ou une cuisson. La première transition depuis l’ancien worker exige cette fermeture/réouverture : le nouveau code ne peut pas corriger rétroactivement un ancien onglet déjà ouvert.

## Archives et limites à vérifier

L’archive ZIP contient les fiches et les fichiers locaux, avec empreintes et inspection avant restauration. Elle distingue copies réduites, originaux inconnus et fichiers manquants. Les brouillons et réponses brutes conservés localement sont exclus : récupérer leur texte depuis leur écran avant d’effacer un appareil. « Archive générée » ne confirme pas son enregistrement dans Téléchargements ou Fichiers.

Une incohérence peut être signalée à l’export de secours puis empêcher la restauration ; conserver le ZIP et son bilan. Le traitement ZIP reste en mémoire. Les mesures de volume et de mémoire JavaScript sur ordinateur ne prédisent pas la mémoire disponible sur iPhone.

Essais physiques restant séparés des tests automatisés :

- Capture sur iPhone, sélection sur iPad, installation PWA et rechargement en mode avion avec photos/pages ouvertes.
- Aller-retour réel entre deux appareils connectés au même compte, y compris les octets d’une photo et la reprise après coupure.
- Enregistrement et restauration d’une archive depuis les fichiers de l’appareil, forte pression de stockage et éviction par l’OS.
- Lecture vocale, maintien d’écran, raccourci de minuterie, transfert manuel Cookidoo/TM7 au Canada et import Paprika dans leurs applications.

Les minuteries sont des suivis indicatifs ; aucune alarme système n’est confirmée par leur seule présence dans Mistu. La lecture complète d’EPUB, une extension native de partage iPhone et une automatisation Cookidoo ne sont pas fournies.

Voir [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [serveur](supabase/README.md), [plan directeur](docs/lots/2026-10-29-plan-directeur-interface-fonctions.md) et les rapports dans `docs/superpowers/plans/`.
