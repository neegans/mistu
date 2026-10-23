# Prompt complet pour Claude Code — Mitsu

Je te transmets le dossier `Mitsu_Claude_Code` pour poursuivre le travail sur **Mitsu**, à partir de l’audit existant et des besoins précisés depuis.

## Mission

Mitsu doit constituer progressivement ma base de données de recettes à partir de mes livres, de photos et de liens web. Je veux photographier ou ajouter mes sources, laisser le système reconnaître et extraire le contenu, puis retrouver des recettes structurées, consultables et recherchables. La saisie manuelle ne doit pas être nécessaire lorsque les informations sont lisibles; je dois pouvoir corriger le résultat.

Le besoin est maintenant suffisamment décrit pour préparer des lots concrets. Commence par vérifier les éléments utiles dans le dépôt, puis propose la spécification et les critères du premier lot. Réserve les questions aux décisions qui ne peuvent pas être tranchées à partir du code, de l’audit et de ce dossier. Évite de rouvrir tout le besoin sous forme d’un long questionnaire.

## Sources à lire

1. Les instructions applicables du dépôt, son état Git et les modifications non commises.
2. `docs/audits/2026-10-18-import-livres-photos-web.md`, dans sa version actuelle : le fichier complet de 235 lignes est annoncé dans le dépôt, mais n’est pas inclus dans ce ZIP.
3. `02_CAHIER_DES_BESOINS.md`.
4. `03_PARCOURS_ET_DIRECTION_VISUELLE.md` et les sept PNG de `maquettes/`.
5. `04_PLAN_TECHNIQUE_ET_VALIDATION.md`.
6. `05_AUDIT_TRANSMIS.md`, copie de la lecture courte de l’audit pour garder le contexte.

Si le fichier complet d’audit manque, signale-le et travaille avec le résumé et les fichiers accessibles, sans inventer ses références de lignes. Ne remplace ni cet audit ni d’autres modifications non commises par les documents du ZIP.

## Ce que l’audit nous apprend

Le squelette existant est à conserver : séances de photos, octets dans `files`, références d’index, extraction par la passerelle, éditeur et versions immuables, signets. L’audit rapporte toutefois une couverture non lue par vision, un sommaire multi-pages partiel, un regroupement manuel des recettes, l’absence d’extraction du texte web, l’absence de photo du plat, une persistance d’import insuffisante et des images non transférées entre appareils.

Ces éléments sont des constats rapportés : vérifie ceux dont dépend le prochain lot. Aucune extraction réelle de page n’est documentée dans le résumé. Ne confonds pas une passerelle qui répond ou un test simulé qui passe avec la preuve que l’import fonctionne de bout en bout.

## Parcours attendu

### Livres

- La couverture est reconnue automatiquement : titre, auteur et autres renseignements visibles, modifiables au besoin. L’ISBN reste un complément utile, pas une saisie imposée pour une couverture lisible.
- Plusieurs photos de sommaire peuvent être ajoutées ensemble. Leur ordre est proposé et corrigeable; sections, titres et pages sont extraits et réunis.
- Une recette trouvée dans le sommaire est seulement repérée. Elle n’est pas encore disponible avec ses ingrédients et ses étapes.

### Précision prioritaire : cliquer sur une recette « À importer »

Lorsque je touche cette recette dans mon livre, ouvre un écran déjà rattaché à sa référence existante : titre, livre et page sont connus.

Je peux alors :

1. Photographier ses pages ou sélectionner plusieurs photos existantes.
2. Ajouter, retirer et réorganiser les photos de texte.
3. Ajouter séparément une photo du plat, si le livre en contient une, en la photographiant ou en choisissant une image. Cette photo reste facultative.
4. Si une photo du plat est déjà présente dans une page importée, recevoir éventuellement une proposition de récupération ou de recadrage, avec correction possible.
5. Lancer **« Extraire et enregistrer »**.

Le résultat doit être rattaché à la recette choisie, sans créer une deuxième recette. Un désaccord manifeste entre les pages et la référence sélectionnée doit être signalé. Après une extraction réussie et conforme aux règles de qualité, la recette devient disponible; un résultat incomplet demeure identifié comme tel.

La maquette `maquettes/mobile/04_import_recette_ciblee.png` illustre cette précision. C’est un chemin ciblé simple, distinct du futur import en lot de plusieurs recettes à regrouper automatiquement.

### Recettes en lot

Je peux également importer plusieurs recettes à la fois. Le système propose les groupes de pages, extrait chaque recette, signale les pages manquantes et propose les correspondances avec le sommaire. Je corrige seulement les ambiguïtés nécessaires.

### Liens web

Quand je clique sur **« Garder la recette »**, conserve son contenu structuré dans Mitsu, avec sa provenance. Un simple signet n’est pas une recette importée. Privilégie les données structurées `Recipe` de la page lorsqu’elles sont présentes et utilisables; prévois un repli approprié lorsque ces données manquent ou sont incomplètes.

La photo pertinente du plat peut être récupérée séparément lorsqu’elle est disponible. Son absence ou l’échec de son téléchargement ne doit pas bloquer l’enregistrement du texte.

## Règles de fonctionnement

- Préserver l’architecture locale-first et réutiliser les mécanismes existants lorsque cela convient.
- Introduire un journal d’import distinct des états de recette. L’avancement ou l’échec d’une opération appartient à l’import; ne pas créer un troisième vocabulaire métier incompatible avec l’existant.
- Enregistrer les entrées, l’ordre des pages et le résultat au fil du traitement, afin qu’une fermeture de l’écran ne perde pas le travail déjà obtenu.
- Réutiliser un résultat déjà persisté lors d’une relance. Traiter explicitement les cas où un appel externe a pu réussir sans que sa réponse ait été enregistrée; ne pas promettre une absence absolue de double facturation.
- Conserver les versions immuables, la provenance, les images sources et mes corrections.
- Ne pas inventer les quantités, les étapes, les pages ou les renseignements illisibles. Signaler les incertitudes pertinentes.
- Ne pas imposer la confirmation manuelle de chaque ligne lisible : proposer une vérification adaptée aux ambiguïtés et aux choix réels de l’utilisateur.
- Valider les réponses du modèle et les contenus web comme des données non fiables, selon des contrats explicites.
- Séparer la photo d’illustration du plat des photos de pages servant à extraire le texte.
- Pour la synchronisation, transférer les octets des images et vérifier qu’ils sont récupérables sur l’autre appareil; synchroniser seulement les pointeurs ne suffit pas.
- Ne pas imposer un système multi-agents. Le découpage proposé par l’audit — classer, lire, extraire, avec orchestration déterministe — est la base à examiner.
- Confirmer le nom exact du modèle de vision configuré, ses capacités réellement utilisées et les mesures observées. Ne pas partir d’un nom de modèle supposé.

## Ordre de travail et premier livrable

Conserve la nomenclature A à G de l’audit : journal d’import, web, sommaire, lots de recettes, couverture, photos des plats, synchronisation des octets. Le plan joint recommande toutefois de traiter le socle de synchronisation G assez tôt, en parallèle de A si nécessaire, pour ne pas repousser tous les essais iPhone à la fin. Explique les dépendances réelles avant de figer cet ordre.

Pour démarrer :

1. Vérifie le chemin actuel d’extraction d’une page et les ressources nécessaires à un essai réel. Si une photo utilisateur et l’application déployée sont disponibles avec les accès nécessaires, réalise cet essai contrôlé; sinon, nomme précisément l’entrée ou l’accès manquant, sans inventer de résultat.
2. Documente le modèle, la durée, les jetons si exposés, la fidélité des ingrédients et des étapes, et ce qui persiste après fermeture/réouverture. Ne présente pas une estimation comme une mesure.
3. Prépare la **spécification du lot A** : données, transitions, reprise, rattachement aux fichiers et recettes, migrations éventuelles, intégration à l’extraction existante et critères de validation.
4. Identifie le plus petit lot utilisable permettant l’import depuis une recette déjà repérée, ainsi que ses dépendances. Distingue ce chemin du classement automatique de plusieurs recettes.
5. Présente la suite B à G avec les éventuels ajustements de dépendances et le rafraîchissement des documents signalés dans l’audit.

Ce premier livrable sert à rendre la suite concrète; il ne demande ni une réécriture générale du projet ni le déploiement simultané de tous les lots. Respecte le workflow et les règles du dépôt pour l’implémentation, les commits et les déploiements.

## Forme de ta réponse

Commence par les décisions et les points vérifiés. Fournis ensuite la spécification du premier lot, les fichiers concernés et les critères d’acceptation. Distingue **observé dans le code**, **testé réellement**, **proposé**, et **reste à vérifier**.

La priorité est que les imports produisent du texte fidèle, durablement conservé et utilisable dans Mitsu. La direction visuelle est fournie par les maquettes, mais leurs données fictives et leurs éventuelles erreurs ne doivent pas devenir des exigences métier.
