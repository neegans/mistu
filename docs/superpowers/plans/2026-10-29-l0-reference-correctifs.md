# Rapport du lot L0 — cohérence des données et des parcours

**29 octobre 2026 — construit et vérifié localement ; publication non effectuée.**

[Spec L0](../specs/2026-10-29-l0-reference-correctifs-design.md) approuvée par Neegan sur « go ».
Branche `l0-reference-correctifs`, base `cd8c7f2`. Application locale **0.22.0**, schéma **4**, cache `cuisine-os-v0.22.0-1`.
La dernière version publiée reste **0.21.1**. Aucun nouveau magasin, index, SQL ou déploiement de fonction assistant.

## Comportements corrigés

| Sujet | Résultat |
|---|---|
| Traductions manuelles | Un champ par ingrédient et par étape ; positions vides et paragraphes conservés. L’original reste intact. Les anciennes traductions restent consultables et demandent une réattribution explicite lorsque leur alignement n’est pas établi. |
| Sauvegarde après disparition | Recette, version et traduction relues dans la transaction. Un refus annule les écritures associées et leur capture ; le formulaire conserve la saisie. Les photos, notes et favoris concurrents sont préservés. |
| Heure du repas | Instant ISO conservé, contrôle affiché dans le fuseau local. Heure sautée refusée, occurrences d’automne choisissables et seconde occurrence préservée à la réouverture. Les autres gestes du repas fusionnent leurs champs sans rétablir une ancienne heure. |
| Recette active en cuisine | Onglet, contenu et lien Fiche suivent la sélection enregistrée. Les changements rapides sont sérialisés ; une session ou cible devenue invalide est refusée sans réactivation. |
| Durées | Phrases Siri et raccourcis gardent les secondes ; plages FR/EN conservées et borne choisie explicitement dans la fiche comme en cuisine. Valeurs invalides refusées. |
| Courses | Copier et Partager utilisent le même choix restants/complet et les mêmes cases. Les cases reçues d’un autre onglet sont réconciliées à l’écran ; les gestes locaux en cours restent visibles jusqu’à leur confirmation. |

Les principaux fichiers touchés sont les éditeurs et fiches de recette, `cook.js`, `meals.js`, `grocery.js`, `components.js`,
les domaines de durées et de courses, ainsi que les nouveaux domaines `traductions.js` et `heure-locale.js`.
Les textes anglais, versions, cache et tests associés ont été mis à jour. Des ajustements CSS gardent les écrans lisibles à 200 % de taille de texte.

## Reproductions et revue croisée

Toutes les preuves locales ci-dessous sont sous `.superpowers/sdd/2026-10-29-l0/`, ignoré par Git.
Les tests comportementaux ont été lus en échec avant correction :

- `traductions-rouge.json` : résurrection, écritures associées et favori concurrent perdu.
- `integration-rouge.log` : ancienne traduction ambiguë associée par position, trous non signalés et paragraphes aplatis.
- `repas-courses-rouge.json` : restitution des heures et différence entre copie et partage.
- `cuisine-rouge.json` : durées, sélection, lien Fiche et reprise.

La revue croisée a aussi reproduit puis corrigé des courses entre gestes : portions rétablissant une ancienne heure,
cases visuelles désaccordées avec l’état fusionné, progression réécrivant une version retirée de la session.
Elle a étendu les cas du parseur aux abréviations, unités suivant une heure et ponctuations.
Preuves : `repas-courses-concurrence-rouge.json`, `cuisine-adverse-rouge.json`, `cuisine-limites-rouge.json` et `cuisine-ponctuation-rouge.json`.

## Résultats de validation

| Vérification | Résultat lu | Preuve |
|---|---|---|
| Suite navigateur complète finale | **7397/7397**, épingle **7396** | `suite-finale.log`, `suite.resultat.json` |
| Traductions ciblées | **84/84** | `l0-traductions.js.resultat.json` |
| Cuisine et durées ciblées | **110/110** | `l0-cuisine.js.resultat.json` |
| Repas et courses ciblés | **54/54** | `repas-courses-concurrence-vert.json` |
| Intégration fiche, synchronisation et archive | **30/30** | `l0-integration.js.resultat.json` |
| Changements d’heure Toronto | **13/13**, profil `America/Toronto`, séparé de la suite publique | `heure-toronto-vert.json`, `toronto-final.log` |
| Outils Node en série | **230/230** | `node-final.log` |
| Migrations générées | `--check` : **code 0** | Contrôle exécuté, aucune migration appliquée |
| Syntaxe JavaScript | **29 fichiers contrôlés** | Contrôle des fichiers modifiés et ajoutés |

La suite complète et les résultats ciblés enregistrent **zéro erreur JavaScript et zéro requête hors origine**.
Le total augmente de **279 assertions** depuis 7118 : 278 dans les quatre suites L0 et une garde supplémentaire d’outbox dans l’import ciblé.
Aucune assertion retirée ; l’attente historique d’un rejet non traité devient un refus visible avec saisie conservée.
L’assertion existante de hauteur de navigation suit son adaptation au texte agrandi. Ces nombres sont des assertions, pas autant de parcours utilisateurs distincts.

La vérification de synchronisation utilise **deux vraies bases IndexedDB et deux moteurs**, avec transport distant simulé.
Une traduction contenant des positions vides et plusieurs paragraphes, son marqueur de format et une ancienne traduction passent d’une base à l’autre.
L’archive issue de la seconde base est inspectée puis restaurée dans une **troisième base jetable**, sans perte de contenu ou de format.
Il ne s’agit pas d’un transfert sur les comptes réels de Neegan.

## Parcours dans l’application

`parcours.resultat.json` enregistre cinq flux réussis dans un profil Chrome jetable :

1. Traduction partielle saisie au clavier, enregistrée puis rechargée ; positions conservées et original inchangé.
2. Repas à 19 h locale conservé ; seconde occurrence d’automne choisie, enregistrée et rechargée.
3. Sauce sélectionnée en cuisine, bon lien Fiche et sélection conservée après rechargement.
4. Case de courses enregistrée et sorties restants/complet contrôlées par Copier avec presse-papiers simulé.
5. Fiche traduite rechargée hors ligne, avec les deux nouveaux modules présents dans le cache.

Éditeur, fiche, repas, cuisine et courses contrôlés à **320, 390, 768, 900 et 1280 px**, puis à **200 % de taille de texte** : aucun débordement horizontal.
Cache actif et contrôlant : **`cuisine-os-v0.22.0-1`**, `traductions.js` et `heure-locale.js` disponibles hors ligne.
Le parcours ne présente aucune erreur JavaScript ni requête externe ; captures conservées sous `captures/`.
Captures de l’éditeur et de la cuisine inspectées ; à 200 %, le bouton de sauvegarde et le texte de l’étape sont également contrôlés
dans le viewport après défilement, sans être masqués. Ces essais ciblés ne constituent pas une réception de la refonte graphique du plan.

## Limites et suite

La publication n’a pas été faite. Aucun compte privé ni appel réel à l’assistant utilisé ; aucun essai physique Safari/iPhone,
Siri, Raccourcis ou feuille de partage native ne peut être déduit des tests simulés.

L0 ne fournit pas la traduction automatique complète en français, la langue commune fiche/cuisine/voix, la persistance complète des minuteurs,
la corbeille ou la refonte visuelle du plan directeur. La traduction complète reste prévue dans **L6/L7** ; ces travaux ne sont pas annoncés comme livrés.
Les anciens clients doivent être rechargés pour bénéficier des correctifs ; les tableaux déjà décalés ne sont pas réparés par supposition.
