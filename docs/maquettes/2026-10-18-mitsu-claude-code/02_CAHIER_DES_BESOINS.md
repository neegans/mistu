# Mitsu — besoins fonctionnels consolidés

## Objectif et périmètre

Faire grandir une bibliothèque personnelle de recettes issues de livres, de photos et du web. Le contenu doit être extrait, structuré, conservé et consultable dans Mitsu. L’utilisateur importe des sources et corrige au besoin; il ne doit pas ressaisir les renseignements déjà lisibles.

Ce document consolide les demandes de la conversation. Il décrit le résultat attendu, pas l’état actuel du code. L’audit transmis figure séparément dans `05_AUDIT_TRANSMIS.md`.

## B1 — Livre reconnu depuis sa couverture

- Photographier ou choisir une image de couverture.
- Extraire automatiquement titre, auteur et renseignements effectivement visibles; conserver la couverture.
- Créer ou retrouver la fiche du livre et proposer une correction simple.
- L’ISBN peut aider à identifier ou dédoublonner; ne pas confondre différentes éditions ou traductions sur le seul titre.
- Ne pas inventer les métadonnées absentes. Si une recherche extérieure complète les renseignements, préserver leur provenance.

## B2 — Table des matières sur plusieurs photos

- Accepter une ou plusieurs photos, notamment quatre ou cinq ensemble.
- Proposer un ordre à partir des indices visibles; conserver l’ordre explicitement corrigé par l’utilisateur.
- Permettre ajout, suppression et déplacement d’une page. Proposer aussi des commandes accessibles pour déplacer une page sans glisser-déposer.
- Extraire sections, titres et pages, puis réunir les résultats dans un sommaire structuré lié au livre.
- Distinguer position dans le lot de photos et numéro de page imprimé.
- Conserver le lien avec la photo source précise, pour pouvoir contrôler une lecture.
- Une ligne du sommaire ne fournit pas les ingrédients et les étapes : c’est une recette repérée, pas une recette intégralement disponible.

## B3 — Import ciblé depuis une recette repérée

Dernière précision de l’utilisateur, à intégrer au parcours prioritaire : cliquer sur une recette « À importer » ouvre son propre écran d’import.

La fiche conserve le lien avec le livre et la référence sélectionnée. L’utilisateur peut prendre des photos des pages de la recette ou les choisir dans sa galerie, en ajouter plusieurs, en retirer et réorganiser leur ordre. Les images de texte restent distinctes de la photo du plat.

Une zone séparée **« Photo du plat — facultatif »** permet de photographier l’illustration du livre ou de choisir une image existante. Lorsque la photo du plat se trouve dans une page déjà importée, la récupération ou le recadrage automatique peut être proposé comme amélioration, avec correction possible.

L’action **« Extraire et enregistrer »** extrait le texte, conserve les sources et associe le résultat à la recette sélectionnée. Elle ne crée pas un doublon de cette référence. Une discordance de titre ou de contenu doit être signalée avant d’associer silencieusement la mauvaise recette.

Un résultat exploitable et complet rend la recette disponible. Un résultat partiel reste visible et récupérable, avec les limites indiquées. Une erreur ne doit pas effacer les photos ni les corrections.

## B4 — Plusieurs recettes photographiées ensemble

- Importer quatre ou cinq recettes, possiblement chacune sur plusieurs pages.
- Proposer leur regroupement et l’ordre des pages de chaque groupe.
- Distinguer deux recettes indépendantes d’une recette multipage; gérer une page pouvant contenir plusieurs recettes.
- Permettre de corriger les groupes, extraire chaque recette et proposer son rapprochement avec le sommaire.
- Signaler les éléments ou les pages possiblement manquants; ne pas compléter par invention.
- Indiquer les recettes disponibles, les résultats partiels et les traitements en cours ou en erreur.

Le parcours en lot complète l’import ciblé B3; il ne doit pas empêcher la réalisation d’un premier parcours simple et fiable.

## B5 — Fidélité de l’extraction et structure commune

Lorsque présents, conserver titre, ingrédients, quantités, unités, ordre des étapes, portions, temps de préparation/cuisson, notes et sous-recettes. Respecter l’organisation du texte source au lieu de résumer ou de réécrire arbitrairement les instructions.

Les recettes des livres et du web doivent partager une structure utilisable, sans perdre leurs particularités ni leur provenance. La correction manuelle doit rester possible et être protégée lors d’une relance.

Un passage incertain doit être signalé au niveau utile, par exemple une quantité ou une ligne d’ingrédient. L’objectif n’est pas d’obliger l’utilisateur à confirmer chaque ligne reconnue correctement. Les mécanismes de qualité restent à définir et mesurer sur de vraies pages.

## B6 — Sauvegarde du contenu d’une recette web

Quand l’utilisateur ajoute une URL ou clique sur **« Garder la recette »**, l’application doit récupérer le texte de la recette et le conserver dans Mitsu. Le signet seul ne satisfait pas ce besoin.

Conserver les ingrédients, étapes et autres renseignements disponibles, ainsi que l’URL d’origine, le site et l’auteur lorsqu’il est identifié. Extraire la recette plutôt que la navigation, les publicités ou les commentaires.

Une page inaccessible, un contenu manquant ou un import partiel doit produire un état compréhensible, sans fausse confirmation de succès. Un signet peut rester utile, mais ne doit pas être présenté comme une recette dont le texte est conservé.

Le JSON-LD `Recipe` proposé par l’audit est une première source à examiner, avec validation du contenu. Ce dossier ne fixe pas un pourcentage de sites compatibles et ne prétend pas que toutes les pages en contiennent.

## B7 — Images des plats et images sources

Deux usages séparés :

| Usage | Rôle |
| --- | --- |
| Images sources | Couverture, sommaire ou pages de recettes permettant de retrouver la preuve de lecture. |
| Photo du plat | Illustration de la recette dans la galerie et dans sa fiche. |

Sur le web, récupérer une image pertinente lorsqu’elle existe et conserver son attribution/provenance disponible. Éviter publicités, logos et images d’autres recettes. Le téléchargement et le stockage doivent être compatibles avec les règles du serveur et du site, sans ouvrir indistinctement l’affichage à toutes les images externes.

La photo du plat est facultative. Son absence ou son échec ne bloque pas l’importation du texte. L’utilisateur peut changer l’association ou retirer l’image. Une photo générée ne doit pas être substituée silencieusement à une photo extraite.

## B8 — Persistance, reprise et synchronisation

- Suivre chaque import avec un journal distinct des états de recette.
- Conserver les photos, l’ordre choisi, les associations et les résultats dès que possible, pour pouvoir quitter l’écran et revenir.
- Préserver un résultat reçu et enregistré, même si une étape ultérieure échoue.
- Réutiliser les résultats persistés lors d’une relance; gérer les incertitudes liées à un appel dont la réponse n’a pas pu être enregistrée.
- Éviter les doublons de livre, d’URL et de recette selon des règles explicites, sans fusion automatique sur le seul titre.
- Préserver les versions immuables et les corrections utilisateur.
- Transférer réellement les fichiers entre appareils, avec un état de transfert observable; un identifiant d’image sans octets disponibles ne suffit pas.

## B9 — Interface et coordination

Direction visuelle : carnet de cuisine personnel, chaleureux, crème et olive, grandes photos utiles, texte lisible. Même langage sur web et mobile, avec une disposition adaptée au téléphone et l’accès à l’appareil photo.

Le système doit coordonner reconnaissance, classement, extraction, validation et enregistrement. L’utilisateur n’impose pas un agent autonome. La proposition de l’audit privilégie trois opérations typées et des règles déterministes autour d’elles.

Les noms des états de données doivent rester compatibles avec le dépôt. Le libellé de maquette **« À importer »** peut représenter une référence **repérée**; il n’impose pas un nouveau statut de recette. **« En cours »** décrit le traitement d’import.

## Priorités

1. Prouver l’extraction réelle et conserver durablement ses entrées et résultats.
2. Réussir l’import ciblé et les parcours texte des livres et du web.
3. Rendre fiables le regroupement de plusieurs recettes et les reprises.
4. Ajouter les photos de plats, sans bloquer les étapes précédentes.

La synchronisation des octets est une dépendance à traiter dès que les parcours doivent être vérifiés entre ordinateur et téléphone. L’ordre exact des lots est à décider à partir du code et du plan joint.
