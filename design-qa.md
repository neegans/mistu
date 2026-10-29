# Vérification visuelle — photos et repères

**final result: passed**

Périmètre : intégration des maquettes dans la PWA existante, conformément à la spec approuvée ; aucun compte connecté ni donnée réelle.

## Références et captures

Sources conservées dans `docs/lots/2026-10-28-interface-visuelle/` :
`Mito_Maquette_Liste_Recettes.png` (358 × 1455), `Mito_Maquette_Fiche_Pain.png` (358 × 1207),
`Mito_Maquette_Photo_Trinity_Bread.png` (358 × 944), MD et HTML fournis.

Application réelle : `http://127.0.0.1:8102/`, Chrome, profils jetables, thème clair, densité 1.
Captures dans `.superpowers/sdd/2026-10-28-interface-visuelle/captures/` : livre, fiche, photo, cuisine et repères,
aux largeurs CSS 320, 358, 390, 768 et 1280, hauteur du viewport 844. Les captures pleine page ont la largeur du viewport ;
les hauteurs dépendent du contenu. À 358 : livre 2029, fiche 2223, gestion photo 844 pixels.

Comparaisons dans une même image : `comparaison-finale-livre.png`, `comparaison-finale-fiche.png`,
`comparaison-finale-photo.png`. Chaque colonne est à 358 pixels, sans changement de densité ; le décor supérieur de la
maquette est décalé de 116 pixels pour livre/fiche et de 66 pour photo. Ce cadrage est une aide à la comparaison du contenu,
pas une superposition de pixels. La navigation persistante de la PWA et les gestes de production expliquent les hauteurs différentes.
Les informations des maquettes restent illustratives : 3 recettes et 0 page sont réellement présents dans le profil de test.

Les détails titre, vignette, description, badges et actions sont lisibles dans ces comparaisons à taille native ; aucun agrandissement
séparé n’était nécessaire. `sources-390.png` couvre l’état zéro page, `recherche-390.png` les repères dans les résultats et `fiche-en-390.png` l’interface anglaise avec description française.
La photo du pain est un extrait de la maquette, utilisé uniquement dans le profil jetable, jamais ajouté aux données de production.

## Comparaison et corrections

Première lecture visuelle : les deux menus du livre et un titre de section répété occupaient trop de place avant la première recette
(P2, rythme). Ils sont maintenant regroupés sous « Ajouter » ; les onglets nomment déjà la section. La description de la ligne
occupe sa propre rangée, sous la vignette et le titre. Le filtre Favoris tenait initialement sur une rangée supplémentaire à 358 pixels :
son espacement a été resserré. Vérification après correction : `comparaison-finale-livre.png`.

Le gestionnaire présentait initialement des commandes côte à côte, une image trop large et un texte parasite « null » (P2).
Image carrée de 260 pixels, commandes principales empilées, retrait discret et absence de texte parasite vérifiés dans
`comparaison-finale-photo.png`. La première fixture contenait par erreur une capture complète ; remplacée par le véritable extrait
photographique avant comparaison finale. Les premières captures intermédiaires ont été remplacées ; les comparaisons finales sont conservées.

La fiche conserve l’ordre titre original → description → difficulté et total → actif et repos → détails → photo carrée → gestes.
L’édition des repères est accessible sur la fiche, y compris sans version culinaire. Le mode cuisine place l’étape avant les ingrédients
repliés ; les boutons de progression restent au-dessus de la navigation de l’application (`cuisine-390.png`).

## Surfaces contrôlées

| Surface | Résultat |
|---|---|
| Typographie | Titres serif du thème, texte d’interface sans serif ; titre original prioritaire, alias secondaire. Description limitée à deux lignes dans les listes, entière dans la fiche. |
| Espacement | Miniatures du livre 78 × 78 ; photo fiche/gestion 260 × 260 sur téléphone ; actions sous les informations ; aucun débordement horizontal aux cinq largeurs. |
| Couleurs | Fond crème, olive, séparateurs et badges sobres du thème existant ; états inconnus neutres et erreurs explicites. |
| Images | Photographie fournie, ratio carré préservé, recadrage sans déformation ; aucun dessin artificiel ni photo inventée. Réception distante et décodage refusé ont leurs états propres. |
| Textes | Compteurs issus des données ; inconnues explicitement nommées ; origines, estimations et attentes distinguées ; description française conservée en interface anglaise. |
| Commandes | Choisir/prendre/retirer/terminer, navigation cuisine, accès aux pages source, édition manuelle et proposition explicite accessibles. Les contrôles photo ne sont pas imbriqués dans des liens. |

Différences acceptées : coquille et navigation de la PWA conservées, commandes de saisie existantes maintenues, contenus et compteurs non
recopiés depuis les exemples. Les icônes décoratives de certains badges du prototype ne sont pas reproduites (P3). Les durées longues
restent exprimées en minutes dans le lecteur partagé ; une présentation en heures serait un raffinement, sans changer leur valeur.
Aucun P0/P1/P2 visuel ouvert sur les états examinés.

## Parcours vérifiés

`visuel.resultat.json` : correction manuelle enregistrée puis relue après rechargement, choix d’une vraie image par le sélecteur,
photo conservée et décodée après rechargement, langue anglaise, ouverture des sources avec zéro page, étape suivante conservée après
ouverture de la photo, rechargement puis rechargement hors ligne. Cache `cuisine-os-v0.21.0-1` actif, six modules neufs présents.
Zéro erreur JavaScript et zéro requête hors origine dans ces parcours. Les tests complémentaires couvrent les états distants, erreurs,
pauses et changements de compte avec un réseau simulé.

Restent hors de cette preuve : Safari/iPhone physique, formats HEIC/HEIF sur ces appareils et synchronisation sur le compte réel de Neegan.

## Vérifications terminées

- Comparaison des trois références aux rendus de l’application.
- Corrections de densité, taille de photo et commandes, puis nouvelles captures.
- Parcours principaux, affichages étroits/larges et hors ligne.
- Publication autorisée sur « go deploy » après cette revue locale ; contrôles publics en cours.
