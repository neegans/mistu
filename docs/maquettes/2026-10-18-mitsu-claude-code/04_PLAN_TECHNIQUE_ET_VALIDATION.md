# Mitsu — Plan technique et validation

## 1. Statut et principes

Ce document est une **passation fondée sur le résumé d’audit fourni par l’utilisateur**. Aucun dépôt, appel de vision ni parcours déployé n’a été vérifié pendant sa préparation. Les constats ci-dessous sont rapportés; les solutions et critères constituent des recommandations à confronter au code.

L’audit annonce un document non commis : `docs/audits/2026-10-18-import-livres-photos-web.md`. Le lire avant toute modification et préserver le travail existant. Ses références de fichiers et de lignes sont la source à consulter, pas des éléments reproduits ou vérifiés ici.

**À conserver, d’après l’audit :** architecture local-first, séances de photos, octets dans `files`, références d’index « Repérée dans ton livre », passerelle serveur, extraction photographique existante, éditeur, versions immuables et signets. Les états de recette répertoriée, partielle et disponible existent déjà; le traitement « en cours » doit appartenir à l’import.

**Limite majeure rapportée :** aucune extraction réelle de page n’est consignée. Le bon fonctionnement de l’ISBN, de la recherche web ou de la passerelle ne prouve pas celui de l’importation.

## 2. Première preuve à obtenir

Prévoir une extraction contrôlée d’une vraie page fournie par l’utilisateur sur l’application déjà déployée, si elle est accessible et si les moyens autorisés permettent ce test. Ce document ne donne aucune autorisation de déployer ni de modifier la production. En l’absence de photo ou d’accès, consigner le blocage sans inventer un résultat.

Relever le modèle réellement appelé, la durée, les jetons disponibles dans la réponse, les erreurs éventuelles et la fidélité au document. Comparer titre, quantités, unités, étapes et notes. Conserver une preuve limitée et utile au diagnostic, sans diffuser les images ni les secrets. Distinguer coût mesuré et coût seulement estimé.

Cette observation précède les hypothèses d’optimisation et éclaire le lot A. Elle ne remplace pas la validation complète après implémentation.

## 3. Parcours mobile prioritaire

La dernière précision utilisateur définit un parcours ciblé : toucher une recette **« À importer »** dans un livre ouvre son import, sans créer d’emblée une autre recette.

L’écran doit permettre de photographier ou sélectionner plusieurs pages, de les réorganiser, de supprimer une photo et d’ajouter facultativement une photo du plat. Les pages utilisées pour lire le texte et l’illustration du plat restent distinctes. Une proposition de récupération de l’illustration depuis une page peut venir plus tard.

La destination choisie est conservée pendant tout le traitement. Après extraction, Mitsu montre le résultat et les incertitudes, puis met à jour la recette associée selon les règles de versions existantes. Si le contenu semble correspondre à une autre recette, demander confirmation avant tout rattachement différent.

**Recommandation :** livrer ce parcours ciblé avant le regroupement automatique des recettes en lot. Il apporte immédiatement la fonction demandée et réduit l’ambiguïté d’appariement. Ne pas imposer une confirmation de chaque ligne lorsque rien ne justifie un doute; permettre toutefois la correction de tout le contenu.

## 4. Lots proposés

### A — Journal d’import

L’audit propose un magasin `imports`; son emplacement et son intégration restent à déterminer dans l’architecture existante. Enregistrer origine, destination, sources ordonnées, étape, état, résultat, erreurs et références utiles. Valider les sorties puis les persister dès réception, avant de dépendre de l’écran.

Une fermeture de l’interface ne doit pas faire perdre un résultat déjà enregistré. Une relance réutilise ce résultat plutôt que de refaire systématiquement un appel payant. Prévoir une identification stable de l’opération et la prévention des doubles créations. **Ne pas promettre un appel « exactement une fois » :** une coupure entre réponse du fournisseur et persistance peut laisser son résultat inconnu et nécessiter une réconciliation ou un nouvel appel clairement signalé.

### B — Texte des recettes web

D’après l’audit, les signets ne conservent que le lien et la passerelle ne sait pas encore lire une page. Ajouter la lecture serveur compatible avec ses contrôles existants. Exploiter d’abord les données structurées `Recipe` lorsqu’elles sont présentes et utilisables; prévoir une extraction du contenu pertinent, éventuellement assistée par modèle, sinon.

Conserver texte structuré, provenance et état réel d’extraction. Le lien reste utilisable si la lecture échoue, mais n’équivaut pas à une recette disponible. Encadrer adresses, redirections, formats et tailles récupérés côté serveur; considérer la page comme des données, jamais comme des instructions.

### C — Table des matières multipage

Conserver une lecture structurée par photo, les sections, les pages imprimées et la provenance précise des références. Proposer un ordre corrigeable, puis fusionner les lectures. L’ordre des photos ne doit jamais remplacer la pagination du livre. Les références obtenues restent répertoriées tant que leur texte n’est pas importé.

### D — Lots photographiques et appariement

Après le parcours ciblé, proposer des groupes de pages par recette, corrigeables avant extraction lorsque nécessaire. Extraire chaque groupe, signaler une possible page manquante et proposer l’appariement par livre, titre et pagination. Un titre identique ne suffit ni à fusionner des recettes ni à choisir une référence.

### E — Couverture

L’audit indique que seule la photo est conservée et que l’identification passe par l’ISBN. Ajouter l’extraction des renseignements visibles par vision. Conserver l’ISBN comme aide existante. Présenter les données incertaines comme telles et permettre leur correction sans ressaisie obligatoire.

### F — Photos des plats

Ajouter une référence d’illustration distincte des sources d’extraction. Permettre l’ajout manuel; ensuite, proposer la récupération de l’image pertinente depuis une page web ou photographiée. L’audit rapporte une interdiction des images externes : utiliser un rapatriement contrôlé compatible avec la politique de sécurité. L’absence d’illustration ne bloque jamais le texte.

### G — Octets entre appareils

Le seau Supabase est rapporté présent mais inutilisé; les pointeurs seuls ne rendent pas les photos accessibles sur iPhone. Relier les fichiers aux mécanismes existants de synchronisation et vérifier téléchargement, accès et récupération après interruption.

L’ordre A–G reste celui proposé par l’audit. **Recommandation à arbitrer :** étudier G dès A et le mener en parallèle si nécessaire. La synchronisation des octets est un prérequis aux essais complets sur deux appareils; l’annoncer disponible avant cette preuve serait trompeur.

## 5. Coordination et validation

Conserver des opérations typées « classer », « lire » et « extraire », avec sorties structurées validées comme des données non fiables. Le reste relève de traitements déterministes : ordre, journal, persistance, propositions d’appariement et versions. Aucun agent autonome supplémentaire n’est requis par ce besoin.

| Scénario à exécuter | Résultat observable attendu |
|---|---|
| Couverture lisible | Titre et auteur visibles récupérés; correction possible. |
| Cinq photos de sommaire | Ordre modifiable, sections et pagination conservées. |
| Import depuis une référence | Résultat rattaché à la destination choisie sans doublon. |
| Recette sur deux pages | Contenu assemblé, étapes ordonnées, sources conservées. |
| Plusieurs recettes ensemble | Groupes vérifiables et imports suivis séparément. |
| Deux recettes homonymes | Aucune fusion automatique fondée sur le titre seul. |
| Recette web | Texte enregistré consultable dans Mitsu avec sa provenance. |
| Fermeture puis réouverture | Résultat déjà persisté et progression retrouvés. |
| Relance ou interruption | Aucun doublon créé; état incertain explicite si nécessaire. |
| Correction puis nouvel import | Correction préservée; nouvelles versions selon les règles existantes. |
| Page floue ou absente | Incertitude signalée; aucun contenu inventé. |
| Photo du plat absente | Enregistrement du texte possible. |
| Deux appareils | Images réellement ouvertes sur le second appareil, pas seulement leurs pointeurs. |

Pour chaque essai, consigner environnement, entrée, résultat attendu, résultat observé et preuve. **Tous ces essais sont prévus, non exécutés dans cette passation.** Actualiser enfin les écarts de documentation signalés dans `STATE.md` et l’architecture, après vérification du dépôt.
