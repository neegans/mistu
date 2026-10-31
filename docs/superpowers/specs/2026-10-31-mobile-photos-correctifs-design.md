# Photos mobiles — correction et livraison

31 octobre 2026. Base technique0b0b10e, audit1e9e601 ; public0.32.9-1. Autorisation de Neegan : « deploy » après le [rapport d’investigation](../../audits/2026-10-31-mobile-photos-pwa.md). Elle couvre la construction des correctifs identifiés puis leur publication. Aucune relecture personnelle de cette spec n’est attribuée à Neegan.

## Périmètre

Corriger les deux défauts applicatifs confirmés : annulation du choix photo non terminée et conservation incohérente d’une nouvelle couverture lors d’un échec de stockage. Séparer visuellement l’aide du choix de pages. La limite de16Mpx et les types de fichiers synchronisés restent des contrats distincts ; cette livraison ne prétend pas prouver la caméra physique iPhone ni modifier le protocole serveur.

## Sélecteur partagé

- `pickFiles` continue de rendre une promesse de tableau de fichiers. Un changement rend les fichiers choisis ; une annulation explicite rend `[]`. Les écouteurs et l’input sont nettoyés une seule fois, y compris lorsque les événements se suivent.
- Nettoyer un choix abandonné par navigation ou fermeture du dialogue d’origine. Un passage temporaire en arrière-plan, un événement `pagehide` isolé, un simple retour de focus ou une attente longue ne doivent pas résoudre prématurément le choix. La destruction du document libère naturellement ses objets ; ne pas la confondre avec une suspension pendant la caméra.
- Capturer le déclencheur et son dialogue lorsqu’ils existent ; conserver une ouverture directement issue de l’appel, sans attente nouvelle avant `input.click()`. Aucun remplacement automatique par une API à la compatibilité différente.
- Définir le règlement des ouvertures successives et des erreurs de déclenchement. Ne pas garder d’input ou de promesse orphelins. Ne pas invalider une sélection réussie déjà remise à son appelant.
- Conserver les gardes métier de compte, de bibliothèque, de recette/édition et de changement concurrent. Aucun téléchargement, appel assistant ni envoi ne découle d’une annulation.

## Couverture et brouillon de livre

- La première conservation d’une couverture et de son import ne doit jamais publier une référence vers des octets non écrits. Pour une création, l’import et les fichiers doivent participer à la même transaction gardée ; pour un import existant, conserver les gardes de transition actuelles.
- Une erreur de décodage reste une erreur d’image. Une erreur d’écriture indique que la photo n’a pas pu être enregistrée et propose de réessayer sa conservation sans rouvrir la caméra.
- La sélection préparée demeure disponible en mémoire pour le réessai tant que la vue et sa portée restent valides. Aucun appel payé ne part avant conservation réussie. Les modifications de titre pendant l’attente restent conservées. Une sauvegarde de texte déjà demandée peut se terminer après fermeture de la vue, sous les gardes de sa portée initiale ; une sélection photo tardive exige en plus la vue vivante et son identité exacte. Un changement de compte/base/bibliothèque ne peut pas écrire dans une nouvelle portée.
- Choisir une autre photo ou retirer la couverture rend le résultat précédent inapplicable. Garder une seule sélection en attente ; ne pas faire croire qu’elle est durable tant que la transaction n’a pas abouti.
- Les boutons et messages reviennent à un état utilisable après échec ou annulation. Textes par `t()` et traductions anglaises correspondantes.

## Réception

Tests rouges avant modification : helper réel avec `cancel`, `change`, événements successifs et nettoyage ; vraie reprise livre, séance et bilan de cuisson après annulation ; échec de la première conservation avec absence d’import orphelin, réessai sans nouveau sélecteur ni appel payé, conservation après réouverture ; gardes de portée et nouvelle sélection. Pas de tests qui cherchent des chaînes dans le source.

Rejouer les parcours tactiles Chromium et WebKit en profil jetable. `cancel` reste simulé et le signal automatisé `filechooser` ne prouve pas l’activation native iOS. Vérifier un vrai choix de JPEG synthétique, la sauvegarde et une relecture hors ligne. Conserver les suites voisines, la suite navigateur complète, les outils Node/CI et les générateurs.

APP_VERSION0.32.10, livraison0.32.10-1 prévue ; DB6/archive7 inchangés. Publier par avance rapide, contrôler les fichiers publics et les mêmes parcours sur la livraison servie. Aucun SQL ni changement de fonction assistant.
