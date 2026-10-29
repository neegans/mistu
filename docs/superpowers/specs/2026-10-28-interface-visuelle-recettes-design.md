# Photos, descriptions et temps des recettes

**28 octobre 2026 — révision 1 approuvée par Neegan (« ok go »), construction autorisée.**

Base : `main` `d832528`, Mistu publié en `0.20.0`, DB 4, suite publique 6820/6820.
Branche de préparation : `interface-visuelle-recettes`. La construction suit le plan du même lot.

Sources : [document de Neegan](../../lots/2026-10-28-interface-visuelle/Mito_Interface_Visuelle.md),
[maquette interactive](../../lots/2026-10-28-interface-visuelle/Mito_Interface_Visuelle.html),
[liste du livre](../../lots/2026-10-28-interface-visuelle/Mito_Maquette_Liste_Recettes.png),
[fiche du pain](../../lots/2026-10-28-interface-visuelle/Mito_Maquette_Fiche_Pain.png),
[gestion de photo](../../lots/2026-10-28-interface-visuelle/Mito_Maquette_Photo_Trinity_Bread.png).
Les cinq fichiers sont conservés ensemble, à l’identique du dossier fourni. Le HTML est une référence de présentation et d’interaction,
pas du code à intégrer tel quel. Ses données, durées, niveaux et compteurs sont illustratifs ; ils ne deviennent aucune donnée de Trinity.

## 1. Résultat attendu

Comprendre un plat et le temps qu’il demande avant de l’ouvrir : photo, titre original, description française, difficulté et durée totale.
Dans la fiche, retrouver le détail, modifier ces informations et gérer la photo. En cuisine, voir d’abord l’étape et atteindre facilement
Précédent/Suivant. Les pages à lire par l’assistant restent clairement séparées de la photo du plat.

**Constat ajouté par Neegan :** « Les photos prises dans mon application mobile n’apparaissent pas sur l’application ordinateur ».
Ce défaut devient une priorité du lot, avant la finition visuelle. Les métadonnées synchronisées ne suffisent pas : l’image doit être
récupérée et affichée sur l’autre appareil, avec un état compréhensible si elle n’est pas encore disponible.

## 2. Ce qui existe et ce qui manque

| Zone actuelle | Constat dans le code | Travail du lot |
|---|---|---|
| `book.js` | Titre, état et actions se disputent la même rangée ; pas de description/niveau/temps | Reprendre l’organisation de la maquette ; actions sous les informations |
| Bibliothèque, `components.js` | Cartes avec photo locale ou titre, sans les nouveaux repères | Ajouter les informations communes ; conserver la grille existante |
| `recipe.js` | Pas de présentation générale ; une référence sans version quitte le rendu avant le gestionnaire photo | Présentation en tête et gestion de photo aussi sur une référence |
| `photo-plat.js`, `cuisine-personnelle.js` | Photo de recette et photos de cuisson séparées ; la dernière photo de cuisson est prioritaire | Modifier l’image réellement affichée, avec sa provenance |
| `sync/moteur.js` | Téléchargement global des octets seulement après demande explicite | Récupération progressive des images visibles ; états distincts de la synchronisation des fiches |
| `cook.js` | Ingrédients avant l’étape sur mobile, navigation après les minuteries, pas d’accès photo | Étape en premier, ingrédients repliés, photo accessible et navigation stable |
| Temps | Certaines vues additionnent préparation/cuisson avec une valeur manquante à zéro ; les cartes sont plus prudentes | Un lecteur partagé, aucune durée inconnue transformée en zéro |

## 3. Photos entre mobile et ordinateur — priorité

### 3.1 Diagnostic établi et limite du diagnostic

Le moteur reçoit les lignes `files`, mais n’appelle le téléchargement global que si `telecharger_tout` a été demandé.
Les listes du livre et de la bibliothèque n’affichent la miniature que si son `Blob` est déjà local ; elles ne déclenchent pas sa réception.
La fiche sait proposer « Télécharger » pour une image distante. **Ce chemin suffit à expliquer une image absente des listes malgré des
fiches correctement synchronisées. Il ne prouve pas encore la cause du cas réel de Neegan.**

Reproduction en navigateur jetable, sans données personnelles : ligne `files.remote` valide mais aucun `Blob` local ; carte sans image
ni action de téléchargement ; fiche avec « Pas encore sur cet appareil » et un bouton « Télécharger » ; aucun téléchargement automatique,
aucune erreur JavaScript ni requête externe. Les photos I2 sont bien référencées par la synchronisation ; le test existant entre deux bases
effectue explicitement le téléchargement et ne couvre donc pas leur apparition automatique. Voir le
[diagnostic détaillé](../../lots/2026-10-28-photos-mobile-ordinateur.md).

À relever pour son cas : type de photo (page, plat, couverture), même compte sur les deux appareils, version de l’application,
message de synchronisation côté mobile et état de l’image côté ordinateur. Aucun mot de passe ni jeton à demander.
Le diagnostic doit distinguer : référence non envoyée, octets non envoyés, référence non reçue, octets non téléchargés, format non affichable.

### 3.2 Comportement visé

- Sur un appareil connecté au même compte, une photo référencée disponible sur le serveur est récupérée lorsqu’elle devient visible
  dans une liste, une fiche, le mode cuisine ou la vue des pages source. Pas besoin de connaître la commande de téléchargement global.
- Réutiliser le moteur et ses contrôles de compte, erreurs, pauses et stockage. Une seule demande par empreinte à la fois ; priorité
  aux images visibles, concurrence et nombre par passe bornés. Pas de téléchargement de toute la bibliothèque à l’ouverture.
- Les couvertures et photos du plat suivent cette règle. Dans les pages source, charger progressivement les images visibles ; aucun
  téléchargement automatique d’un PDF/EPUB complet uniquement parce que le livre est ouvert.
- L’arrivée des octets rafraîchit l’image concernée, sans perdre une saisie, une sélection ni la progression de cuisine.
- Hors ligne, montrer les images déjà locales. Une image distante reste identifiable comme « Photo à télécharger » ; un échec offre
  « Réessayer ». Respecter une pause demandée par la personne et l’indiquer, sans la lever silencieusement.
- Si l’envoi n’est pas encore terminé sur le mobile, le dire. « Fiches synchronisées » ne doit pas signifier « Photos disponibles ».
- Une image distante ou illisible n’est jamais présentée comme absente : « Ajouter une photo » est réservé à l’absence réelle de photo.
- Si la photo personnelle prioritaire est encore distante, montrer son emplacement d’attente et sa provenance ; ne pas lui substituer
  silencieusement l’image du livre dans les listes. Cette dernière reste accessible séparément. L’action photo cible ainsi la même image
  dans le livre, la bibliothèque, la fiche et la cuisine.
- Conserver les originaux et le réglage de qualité existant. Tester les captures mobiles JPEG et les fichiers HEIC ; si le format reçu
  ne se décode pas sur l’ordinateur, donner un état explicite et l’accès au fichier. Ne pas annoncer ce cas résolu sans preuve du format réel.

Les nouvelles photos de plat, de cuisson et de couverture passent déjà en JPEG avant stockage. La piste HEIC concerne surtout les pages
source originales. Une erreur de décodage ne doit pas simplement masquer l’image ou laisser une image cassée.

La commande globale des Réglages doit nommer sa portée réelle, par exemple « Télécharger toutes les photos et pages » : elle inclut
aussi les photos de plats et de cuissons, pas seulement les pages du livre.

## 4. Description française

Sous le titre original : une ou deux phrases, cible de 15 à 25 mots, ton de menu simple. Deux lignes au maximum dans les listes par
limitation visuelle ; texte complet dans la fiche et le formulaire. Aucun texte stocké n’est coupé pour satisfaire la mise en page.

La description reformule uniquement les éléments disponibles. Un titre explicite peut permettre une description minimale ; un nom
ambigu sans recette donne « Description à compléter ». Les ingrédients, garnitures, textures et techniques ne sont pas ajoutés pour
embellir le plat. Aucune allégation nutritionnelle, alimentaire ou de sécurité déduite.

Le titre original reste visible et lisible. Un titre personnalisé existant reste conservé et peut apparaître en complément ; il ne
remplace pas silencieusement l’original demandé. Corriger la description ne change ni titre, ni ingrédients, ni étapes.

La description demandée est française, même lorsque les commandes de l’interface sont en anglais. Les libellés, aides et états restent
traduits par le mécanisme FR/EN de Mistu. Ce lot ne traduit pas automatiquement les étapes de recette.

## 5. Difficulté

| Niveau | Sens |
|---|---|
| Facile | Gestes simples et peu de préparations à coordonner |
| Intermédiaire | Quelques techniques et plusieurs étapes à organiser |
| Avancé | Gestes précis, cuisson délicate ou coordination soutenue |
| Chef | Techniques expertes, plusieurs préparations complexes ou matériel spécialisé |

Le niveau est distinct de la durée. Une levée longue ne rend pas à elle seule une recette difficile ; la présence du TM7 ne suffit pas
à classer une recette « Chef ». Sans étapes suffisantes : « Niveau à estimer ». Dans le détail, une raison courte cite les gestes ou
le matériel qui fondent l’estimation. Le niveau et cette raison sont modifiables manuellement.

## 6. Temps total, temps actif et attentes

Le total couvre le délai jusqu’au plat prêt : préparation, cuisson, repos, levée, marinade et refroidissement nécessaires.
Il ne se calcule pas en additionnant aveuglément toutes les durées des étapes. Un chevauchement doit être explicite ou présenté comme
une estimation avec son explication. Si l’organisation temporelle ne peut pas être établie, le total reste inconnu.

Séparer : total, actif, cuisson et attentes quand ces éléments sont connus. Une préparation n’est pas automatiquement égale au temps actif.
Chaque valeur conserve son origine : durée explicite de la source, estimation IA ou correction manuelle. Un total consolidé comportant
une partie estimée reste estimé, même si les autres durées sont imprimées dans le livre.

Une durée peut être une valeur ou une fourchette. Afficher « ≈ » pour une estimation et son origine dans « Détail du temps et du niveau ».
« Repos inclus » exige une analyse suffisamment complète ; ne pas le déduire d’une simple somme préparation + cuisson.
Un total imprimé qui exclut une attente visible reste conservé comme donnée source, mais ne devient pas le délai complet affirmé.

**Rapide :** borne haute du total complet et courant ≤ 30 minutes, recette disponible et suffisamment renseignée.
Pas de badge pour 20–40 minutes, une durée active de 20 minutes avec une nuit de repos, une recette partielle, un total inconnu ou périmé.
La recherche « rapide », les filtres de temps et les résumés de repas utilisent la même règle et conservent la mention d’estimation.
Une inconnue dans un repas ne disparaît pas du bilan ; aucune parallélisation garantie entre plats.

Une correction manuelle propose explicitement valeur/fourchette, origine et inclusion des attentes. Effacer une valeur signifie inconnu,
jamais zéro ni retour automatique à une valeur IA. Les temps de la maquette Trinity ne sont pas préremplis.

## 7. Préparer et corriger les informations

**Choix approuvé avec cette révision :** bouton « Compléter les informations — 1 appel » sur la fiche, puis « Actualiser les informations —
1 appel » lorsque des repères existent. Aucun appel à l’ouverture d’une fiche, d’un livre, d’un onglet ou après synchronisation.
Le « ok go » porte sur cette révision qui retient le déclenchement explicite. L’alternative automatique évoquée auparavant n’est pas construite.

Le bouton explicite permet un circuit entièrement client avec l’outil `creation` existant. Le contexte comprend le titre, la version
affichée ou la référence d’index, ingrédients, étapes, durées connues et état incomplet. Ni notes personnelles, ni historique de cuisson,
ni identifiants de compte, ni photographies ne sont nécessaires à cet appel.

Réponse fermée : description, niveau/raison et temps peuvent chacun être inconnus. Les citations et références renvoient seulement à
des éléments réellement transmis. Toute estimation reste présentée comme telle ; des références valides ne garantissent pas à elles
seules la justesse sémantique d’une description ou d’un calcul.

La proposition est montrée avant « Garder ces informations ». Les champs peuvent être corrigés ou laissés vides. Saisie manuelle possible
hors ligne et sans compte. Annulation, quota, délai et perte de connexion conservent le brouillon et ne relancent jamais un appel d’office.
Une réponse tardive ne remplace ni une nouvelle version ni une correction faite pendant l’appel.

Pour l’option automatique : distinguer les circuits avant de promettre « sans appel supplémentaire ». L’extraction de photos et la
création IA acceptent une consigne client ; la lecture Web a un contrat serveur propre, et un JSON-LD peut être importé sans appel modèle.
Il ne faut ni ajouter un appel caché à ce dernier cas, ni affaiblir le contrat fermé Thermomix pour y glisser ces informations.

## 8. Conservation et validité des repères

Les repères de présentation vivent dans un champ JSON de `recipes`, séparé des `RecipeVersion` culinaires immuables :

```text
reperes.revision
reperes.proposition : source { version_id, signature }, description_fr, difficulte, temps, modele, calcule_le
reperes.corrections : par champ { valeur, source { version_id, signature }, modifie_le }
```

Une enveloppe courante par recette suffit à ce lot ; pas d’historique illimité de propositions. Une correction présente, même `null`,
prime sur la proposition. **Chaque correction garde sa propre liaison à la source** : analyser une version B ne revalide pas un temps
manuel venant d’une version A. Une autre version affichée n’emprunte pas les repères de la version analysée.

La signature dépend du contenu culinaire pertinent, du titre et de l’état de complétude, pas des photos, notes, favoris ou statut testé.
Après changement pertinent, les corrections sont conservées dans l’éditeur et marquées « À revoir après modification de la recette ».
Les temps et niveaux périmés n’alimentent ni badges, ni filtres, ni exports. La personne peut les confirmer pour la nouvelle source.
Une nouvelle analyse ne les supprime pas et ne les remplace pas silencieusement par sa proposition.

Validation à la réception et après synchronisation/restauration : textes bornés (description 400 caractères, raison 300, explication 800),
quatre niveaux fermés, nombres entiers finis en minutes, plages ordonnées, actif compatible avec total quand les deux sont connus.
Plage proposée : 0 à 43 200 minutes, zéro seulement explicite, pour admettre les attentes de plusieurs jours ; aucune troncature.
Contexte d’appel et enveloppe bornés avant écriture, sous les limites de synchronisation ; un contexte trop long est refusé, pas coupé.
Pas de HTML, URL, instructions exécutables ni référence inventée dans les champs produits par l’assistant.

Toutes les écritures passent par `repo`, avec relecture transactionnelle des corrections et de la version source. L’éditeur générique
doit préserver `reperes` lorsqu’une autre vue les modifie en parallèle. Les repères sont inclus dans la sauvegarde et la synchronisation
des fiches. Un journal reprenable peut utiliser `imports.kind = reperes`, sans magasin ni index supplémentaire.

**I3 :** aucune écriture dans les quatre champs de durée d’une version TM7, aucun changement d’étape, de minuterie ou de signature du plan.
Les estimations de présentation ne recalculent pas les réglages, ne valident pas une adaptation et ne changent pas son état « non testée ».

## 9. Écrans et fidélité aux maquettes

### Liste du livre et bibliothèque

Dans le livre : miniature carrée d’environ 78 px avec accès photo, pages et titre original à côté ; description puis niveau/temps ;
favori, état et action en dessous. Séparateurs sobres. « Compléter » pour une recette partielle, « Importer » pour une référence.
Les compteurs, pagination et ordre des pages viennent des données réelles, jamais des exemples du HTML.

La bibliothèque garde sa grille et la navigation existantes, avec les mêmes repères et une miniature ou un vrai emplacement « Ajouter
une photo ». Aucun bouton imbriqué dans un lien englobant la carte. Les titres ne sont ni coupés arbitrairement ni tassés par les actions.
Le nouvel emplacement sans photo remplace expressément l’ancien choix « jamais de cadre vide » pour les recettes.

### Fiche et gestion de photo

Ordre mobile : titre original, description complète, difficulté/total, actif/attentes, détail repliable, photo, actions pertinentes.
Photo proche du carré de la maquette, largeur autour de 260 px sur mobile, adaptable sans étirement ; ouvrir l’image entière sans recadrage
des octets d’origine. Palette crème et olive, titres serif et composants existants ; ne pas ajouter le cadre de téléphone de la démonstration.

Référence et recette partielle : photo gérable immédiatement, état incomplet et action « Compléter »/« Ajouter des pages » visibles.
Aucune photo ne rend une recette prête à cuisiner et aucun ingrédient manquant n’est complété par l’apparence de la photo.

Gestionnaire « Photo de la recette », depuis la miniature ou « Modifier la photo » : « Choisir une photo », « Prendre une photo »,
« Retirer la photo », « Terminer ». Annuler le choix de fichier ne change rien. Confirmation de réussite seulement après l’écriture.

**Priorité I2 conservée :** la dernière photo de cuisson précède l’image de la recette. Le gestionnaire nomme et modifie l’image réellement
affichée : si elle vient d’une cuisson, cibler cette cuisson et cette empreinte, sans toucher ses notes ni les autres photos ; sinon cibler
la photo de recette. Aucune fausse cuisson n’est créée pour enregistrer une image. L’image du livre reste accessible séparément.
Après retrait, une autre photo peut devenir prioritaire : l’annoncer clairement. Un changement concurrent de l’image montrée fait relire
le gestionnaire, jamais retirer une autre photo à sa place.

### Cuisine

Étape courante en premier ; ingrédients dans un volet fermé au départ. Ne pas inventer une attribution d’ingrédients par étape :
sans association fiable, le volet s’appelle « Ingrédients de la recette ». Photo accessible sans perdre l’étape ni arrêter les minuteries.
Précédent/Suivant restent accessibles même avec une longue étape, avec l’espace nécessaire pour ne masquer aucun contenu.
Conserver progression par version, gardes TM7, avertissements pertinents et vérité des états de minuterie. Aucun lancement automatique.

### Pages source du livre

Accès « Pages source » visible avec le nombre réel, même zéro. « Ajouter des pages » reste accessible depuis cette vue.
« Mettre à jour avec l’IA » précise l’objet avant l’appel : index du livre, pages sélectionnées et nombre d’appels ; la commande ne
réimporte pas silencieusement toutes les recettes et ne complète pas leurs repères à leur insu. Réutiliser le parcours I1 éprouvé.

## 10. Intégrations et limites du lot

Un lecteur commun fournit valeurs, origines, validité et badge Rapide aux listes, fiche, recherche, filtres, repas et exports.
Les anciens champs de durée restent intacts ; leur absence ne signifie jamais zéro. Les résumés de repas ne garantissent pas un
planning calculé. Les exports conservent les repères comme informations annotées ; les estimations n’alimentent pas des durées
JSON-LD certaines. Les exports Thermomix gardent leurs contrôles et l’absence de durées culinaires affirmées.

Réutiliser stockage/synchronisation des images, compression, cache, gestion des URL blob, pages source et historique I2.
Pas de nouvel outil assistant, de génération de photo, de refonte de compte ou d’automatisation Cookidoo. Aucun besoin de migration SQL
pour le circuit explicite proposé. `DB_VERSION` reste 4 ; version applicative visée à la construction : `0.21.0`, avec cache et épingles
actualisés seulement lorsque le code change. Tout module neuf de texte passe par `t()` et le filet de traduction.

## 11. Critères de réception

| Cas | Résultat exigé |
|---|---|
| Liste du livre, fiche et gestion de photo à 320/390/768/1280 px | Titres lisibles, aucune action sur le titre, aucun débordement ; comparaison avec les références au même état |
| Description longue, titre italien, titre ambigu seul | Deux lignes dans la liste, texte complet en fiche ; français fidèle ou état à compléter |
| 30 min / 31 min / fourchette 20–40 / 20 min actives + une nuit | Rapide seulement pour le total admissible ≤ 30 ; règle identique dans la recherche |
| Temps source sans repos, phases parallèles, recette partielle | Pas de fausse addition ni de total complet affirmé ; explication ou inconnu |
| Nouvelle analyse pendant une correction manuelle | Correction préservée, y compris effacement volontaire |
| Nouvelle version après correction du temps | Ancienne valeur conservée à revoir, sans badge/filtre/export périmé |
| Repères modifiés sur une version TM7 | Plan, signatures, quantités, minuteries et statut inchangés et toujours validables |
| Photo choisie sur référence sans version | Photo persistante ; recette toujours à importer |
| Photo de cuisson devant image du livre | Modifier/retirer cible l’image visible ; image du livre et autres photos préservées |
| Deux bases simulant mobile et ordinateur, même compte | Référence puis octets transmis ; image distante récupérée à l’affichage, sans téléchargement global manuel |
| Photo visible dans la liste avant arrivée des octets | Chargement/attente visible, puis miniature sans rechargement forcé |
| Photo personnelle distante et image du livre déjà locale | Même photo personnelle annoncée dans toutes les vues, attente visible, aucune substitution silencieuse |
| Déconnexion, changement de compte, pause et erreur réseau | Pas d’image d’un autre compte ; demandes interrompues ou suspendues, reprise explicite possible |
| JPEG mobile, HEIC, type inconnu, fichier distant indécodable | Affichage vérifié ou état explicite, jamais faux emplacement vide ni perte d’original |
| Réouverture, ZIP, restauration, nouvelle lecture de recette | Photos et corrections conservées ; propositions revalidées |
| Longue étape en cuisine | Étape prioritaire, ingrédients repliés, navigation utilisable, minuteries inchangées |
| Pages source, ajout et mise à jour de l’index | Compteurs réels, cible et coût lisibles, aucune recette effacée ni lecture élargie sans geste |

Tests de comportement avant correctifs, réseau injecté et bases jetables ; suite navigateur mesurée, Node en série, migrations `--check`.
Preuve manuelle séparée sur les deux appareils de Neegan : prendre une photo, constater son envoi, ouvrir son emplacement sur l’ordinateur,
attendre son apparition, puis vérifier sa disponibilité hors ligne. Les tests simulés ne remplacent pas cette preuve.

## 12. Ordre de construction proposé

1. Reproduire le défaut photo, corriger le chemin envoi/réception/affichage concerné et les états trompeurs.
2. Poser le lecteur de repères et la conservation des corrections, avec tests des temps et des versions TM7.
3. Construire la saisie manuelle et le circuit assistant retenu après relecture du § 7.
4. Appliquer les maquettes au livre, aux informations de recette et au gestionnaire photo.
5. Réorganiser la cuisine et l’accès aux pages source, puis vérifier les parcours complets et la fidélité visuelle.

**Statut : spec approuvée sur « ok go », construction locale terminée en 0.21.0 ; publication autorisée sur « go deploy ».** La construction suit la relecture prévue dans
[AGENTS.md](../../../AGENTS.md) : « Spec d’abord […] relue par Neegan, puis construction en petites tâches testées ».
