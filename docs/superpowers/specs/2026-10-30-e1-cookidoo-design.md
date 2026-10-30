# E1 — Cookidoo : résultat de la recherche et décision de livraison

**30 octobre 2026 — résultat documentaire technique : automatisation écartée pour cette livraison.** La décision applique l’alternative « démontrer ou écarter » du [plan directeur §15 et lot E1](../../lots/2026-10-29-plan-directeur-interface-fonctions.md). Aucun code, compte ou appareil modifié. Base auditée : L8 0.30.0, code9bb96ac, DB6/archive7, SQL0013. [Plan et bilan documentaire](../plans/2026-10-30-e1-cookidoo.md). Aucune relecture personnelle de Neegan n’est revendiquée.

## 1. Décision

La recherche officielle consultée ne démontre pas de mécanisme autorisé permettant à Mistu de créer automatiquement une recette personnelle dans le compte Cookidoo canadien, puis d’en constater la réception sur un TM7. **Ne pas construire ni annoncer cette automatisation dans la livraison actuelle.** Ce résultat ne prétend pas prouver l’absence universelle d’API ou d’accords partenaires privés.

Le transfert manuel déjà livré reste le parcours disponible : préparer une adaptation validée, comparer et garder la version, puis copier ses champs dans l’éditeur officiel. Aucun ajout facultatif n’est requis pour cocher E1. Le chapitre du plan directeur proposant « Champ suivant », une progression locale ou une trace durable de préparation reste une piste distincte ; il ne devient pas une construction promise par ce résultat documentaire.

Le scénario de création personnelle **Canada → Cookidoo → TM7 n’a pas été exécuté**. Aucun identifiant, jeton, compte privé, abonnement ou appareil n’était disponible pour cette vérification. Ni la recherche documentaire, ni les contrôles du presse-papiers Mistu ne sont un test de bout en bout du transfert.

## 2. Sources et portée de la recherche

Sources officielles consultées le 30 octobre 2026, à partir de la recherche préparatoire root :

| Source | Fait documenté utile | Limite de la preuve |
|---|---|---|
| [Cookidoo Canada — Recettes créées](https://cookidoo.ca/foundation/en-CA/pages/discover-created-recipes) | Création, import, modification et partage dans Cookidoo ; jusqu’à 100 créations avec abonnement actif. | La page ne fournit pas de contrat d’API de création depuis Mistu. |
| [Vorwerk — Recipe Handover vers TM7](https://globalsupport.vorwerk.com/hc/en-us/articles/23238724724764-How-to-send-Cookidoo-recipes-from-your-smartphone-to-Thermomix-TM7) | Le transfert décrit concerne les recettes officielles et exclut les recettes créées par l’utilisateur. | Ce parcours ne valide pas l’envoi d’une recette personnelle Mistu. |
| [Cookidoo Canada — Tutoriel d’import](https://cookidoo.ca/foundation/tutorials/en-CA/courses/how-to-import/import-followthesesteps) | L’utilisateur colle une URL dans l’éditeur officiel, importe puis vérifie et corrige. | Ce geste dans un éditeur ne démontre ni API tierce, ni acceptation d’une URL Mistu privée. |
| [Vorwerk UK — Créations et TM7](https://support-gb.vorwerk.com/hc/en-gb/articles/19200758508700-Can-recipes-be-created-rated-and-translated-directly-on-the-TM7) | La synchronisation des créations est documentée séparément. | Article du 28 mars 2025 ; ses annonces futures au lancement ne sont pas utilisées comme état actuel ni preuve canadienne. |
| [Vorwerk — Régions Cookidoo](https://globalsupport.vorwerk.com/hc/en-us/articles/360020979740-Access-to-Cookidoo-platform-internationally) | La documentation situe le Canada en français/anglais dans la région technique United States. | Un parcours européen ne prouve pas celui du compte canadien. |

La recherche ciblée de documentation développeur publique/API/OAuth, limitée aux domaines officiels Vorwerk, Thermomix et Cookidoo consultés, n’a trouvé aucun contrat public utilisable pour cette création tierce. C’est une **absence de documentation trouvée dans ce périmètre**, pas une déclaration d’inexistence. Les offres commerciales ou clients communautaires ne remplacent pas une autorisation et un protocole officiel démontrés ; aucun de leurs mécanismes n’est adopté ici.

## 3. Ce que le code livre déjà

L’audit en lecture seule porte sur `src/ui/cookidoo.js`, `src/domain/thermomix.js::copieCookidooThermomix` et leur raccord dans `src/ui/recipe.js`.

- Le panneau copie le titre, chaque ingrédient, chaque étape ou l’ensemble ; il donne un lien vers la page officielle canadienne et explique la saisie manuelle.
- Les champs proviennent de la version adaptée du bundle affiché. Le domaine vérifie l’adaptation et les portions exactes ; il refuse un plan incomplet ou altéré et un changement de portions incompatible. L’original et les protections Thermomix restent intacts.
- Chaque copie repasse par le domaine avant l’écriture du presse-papiers. Le message de réussite suit uniquement la résolution de cette écriture. En cas de refus, le texte demandé reste sélectionnable dans un champ en lecture seule.
- Le texte comporte les indications de vérification et de provenance déjà prévues. Les réglages disponibles dans Cookidoo doivent être vérifiés manuellement ; aucune capacité supplémentaire de TM7 n’est déduite du profil logiciel de Mistu.
- Le code n’authentifie pas un compte Cookidoo, ne crée pas de recette distante, ne commande pas l’appareil et ne reçoit aucune confirmation de celui-ci.

Les tests existants `tests/i3-thermomix.js` et `tests/i3-ecran.js` couvrent notamment les champs copiés, les refus de plan/portions et le presse-papiers différé ou refusé. `tests/l3-actions.js` distingue l’export documentaire d’une adaptation invalidée de son usage Cookidoo. **Ces tests ont été lus, pas rejoués spécifiquement pour E1** ; leurs preuves locales ne doivent pas être renommées en réception Cookidoo/TM7.

## 4. Sens exact des états

| Événement | Ce qui peut être affirmé | Ce qui reste inconnu de Mistu |
|---|---|---|
| Adaptation gardée dans Mistu | La version locale préparée est celle choisie. | Présence dans Cookidoo ou sur l’appareil. |
| Écriture du presse-papiers réussie | Le texte demandé a été copié. | Collage, enregistrement distant et synchronisation. |
| Texte sélectionnable affiché après refus | Une copie manuelle reste possible. | Le texte n’est pas déclaré copié. |
| Lien officiel ouvert | La destination officielle a été demandée. | Connexion, création distante, état du TM7. |

Ne jamais transformer « Copié » en « Enregistré dans Cookidoo », « Envoyé au TM7 » ou « Connecté au Thermomix ». Une progression facultative de champs copiés, si elle est demandée ultérieurement, resterait locale et ne pourrait changer cette frontière.

## 5. Conditions minimales pour rouvrir l’expérience

Rouvrir E1 seulement avec une voie officielle applicable à l’intégration tierce démontrée par documentation ou autorisation vérifiable, et une expérience séparément autorisée sur un compte canadien et un TM7 disponibles. Ne pas demander ni conserver d’identifiants dans ce travail documentaire.

L’expérience future resterait bornée à une recette personnelle : relever région, abonnement, modèle et firmware ; comparer la version source exacte, les quantités, unités, étapes, réglages et accessoires ; distinguer la création Cookidoo de sa visibilité réellement constatée sur l’appareil. Prouver une création unique ou une réconciliation après résultat réseau inconnu avant réessai ; sans preuve, arrêter au statut « résultat à vérifier ». Prouver déconnexion/révocation et absence de secrets dans les fichiers, journaux et archives. L’échec du connecteur ne doit jamais empêcher la consultation locale ou la copie manuelle.

Ce sont des conditions de réouverture, **pas des tests accomplis ni des travaux restant nécessaires pour clore le résultat négatif de cette livraison**. Aucun nouveau stockage, migration SQL, version d’application ou mécanisme de connexion n’est proposé par E1.

## 6. Critère de clôture

La clôture est documentaire : sources et limites consignées, automatisation écartée pour cette livraison, parcours manuel existant identifié, distinction des états maintenue et conditions d’une éventuelle reprise précisées. Aucun essai Canada/TM7 ni succès de bout en bout n’est annoncé. Le plan associé ne programme pas de code facultatif pour atteindre ce critère.
