# Photos visibles sur mobile, absentes sur ordinateur

**28 octobre 2026 — constat de Neegan pendant la préparation du lot d’interface visuelle.**

« Les photos prises dans mon application mobile n’apparaissent pas sur l’application ordinateur. »

Base examinée : Mistu `0.20.0`, `main` `d832528`. Diagnostic en lecture seule ; aucun changement applicatif, aucune donnée personnelle lue.
Le constat est intégré en priorité à la [spec](../superpowers/specs/2026-10-28-interface-visuelle-recettes-design.md).

## Faits établis

- `src/sync/moteur.js` télécharge toutes les images seulement lorsque la personne demande `telecharger_tout` ; les gestes de téléchargement
  individuel existent séparément. Une passe ordinaire reçoit les métadonnées sans nécessairement récupérer les octets.
- `src/ui/components.js`, `book.js` et les cartes de bibliothèque exigent une image déjà locale pour la miniature. Ils ne récupèrent pas
  automatiquement une photo distante et n’affichent pas son état. Une photo personnelle distante peut être remplacée visuellement par celle
  du livre déjà locale, alors que la fiche montre la photo personnelle à télécharger.
- La fiche peut afficher « Pas encore sur cet appareil » et « Télécharger ». La commande globale des Réglages porte « Télécharger toutes les
  pages », mais ses références comprennent aussi les photos de recette, de cuisson et les couvertures.
- `src/sync/fichiers.js` inclut bien `cook_history.photos` dans les références, candidats à l’envoi, compteurs et téléchargement global.
  L’historique de cuisson n’est pas désactivé par le choix de ne pas synchroniser l’historique des consultations.
- `tests/i2-integration.js` vérifie l’envoi puis demande explicitement le téléchargement sur la seconde base. Il ne démontre pas une
  apparition automatique de la photo sur le second appareil.

## Reproduction contrôlée

Dans un navigateur jetable, avec une recette et une ligne `files.remote` valides du même compte, mais aucun `Blob` local :

| Observation | Résultat |
|---|---|
| État du fichier | `distant` |
| Carte de bibliothèque | 0 image, aucun bouton de téléchargement |
| Fiche | « Pas encore sur cet appareil », 1 bouton « Télécharger » |
| Téléchargements automatiques | 0 |
| Erreurs JavaScript / requêtes externes | 0 / 0 |

Cette reproduction prouve le manque de récupération automatique et l’absence d’état dans les listes. Elle ne prouve pas que les octets
de Neegan sont déjà sur le serveur, ni que ce chemin explique à lui seul son cas réel.

## Autres pistes à départager

Téléphone passé en arrière-plan avant l’envoi des octets, session expirée, pause/erreur de stockage, compte ou origine différents, ordinateur
resté sur une ancienne version. Les fiches partent avant les fichiers ; une passe supplémentaire peut être nécessaire pour transmettre les
métadonnées de la copie serveur. Les passes sont bornées à 20 fichiers et 60 secondes.

Les nouvelles photos de plat, de cuisson et les couvertures sont ré-encodées en JPEG avant stockage. HEIC est donc surtout une piste pour
les pages source originales. Un original HEIC peut être envoyé tel quel ; le navigateur de réception peut ne pas le décoder. Le rendu ne
donne pas partout une explication lorsque ce décodage échoue. `image/heif`/`.heif` doivent aussi être distingués de HEIC lors du diagnostic.

## Informations encore nécessaires pour le cas réel

Type de photo, version affichée sur chaque appareil, même compte et même adresse publique, message de synchronisation des photos sur mobile,
présence du bouton « Télécharger » dans la fiche sur ordinateur. Ces questions ont été envoyées à Neegan ; aucune réponse n’est supposée.

## Mesure immédiate et correction prévue

Sur l’ordinateur, ouvrir la fiche et utiliser « Télécharger », ou Réglages → « Télécharger toutes les pages » si cette commande est proposée.
Elle inclut les photos de plats. Cela aide seulement si les images ont bien été envoyées par le mobile.

Le lot prévoit récupération progressive des images visibles, états de chargement/attente/erreur, libellé global exact, gestion explicite du
décodage refusé et cohérence de la photo prioritaire entre les écrans. Pas de récupération d’une bibliothèque entière à l’ouverture.
La réception tardive doit actualiser l’image sans perdre la recherche, les filtres ni la saisie.

Preuve de réception finale : deux bases simulées, puis mobile réel → ordinateur réel avec une photo de plat JPEG et une page source du
format réellement utilisé. Aucun essai sur les appareils de Neegan n’a encore été effectué.

## Correction publiée après approbation

Le « ok go » a autorisé le lot local 0.21.0. Les images visibles sont maintenant demandées au moteur sans clic,
les états distants/erreurs/décodage sont affichés, la photo personnelle reste prioritaire et les Réglages parlent de
« Photos et fichiers ». Deux bases et deux moteurs réels sur transport simulé prouvent réception et décodage
sans téléchargement manuel. Couvertures, pages source, cartes, fiche, repas et cuisine partagent ce composant.

Tests photos 48/48, intégration 23/23, suite globale 7080/7080. Le gestionnaire préserve les autres images et les notes.
Les captures et parcours sont décrits dans [design-qa.md](../../design-qa.md).
**Correction publiée en 0.21.0 sur « go deploy »**, commit `af85c6f`, GitHub Pages construit le 28 octobre à 22 h 43 HAE.
Suite publique **7080/7080** ; cache et six modules vérifiés, photo ajoutée puis décodée hors ligne dans un profil jetable.
Le contournement ci-dessus décrit le comportement de l’ancienne version 0.20.0.
Le transfert sur les appareils et le compte de Neegan reste à vérifier ; aucune donnée privée n’a été consultée.


## Contrôle de mise à jour — 29 octobre 2026

Le passage d’une installation 0.20.0 contenant déjà des photos et des notes à la 0.21.0 est vérifié dans Chrome, sur une
même origine locale, avec des données jetables. Les deux photos, les notes et la session de cuisine restent identiques.
Après rechargement hors ligne, la photo personnelle se décode et la cuisine reprend à la même étape. Cache 0.21.0-1
actif avec ses six nouveaux modules ; aucune erreur JavaScript ni requête externe.

Une application restée ouverte peut garder son code 0.20.0 même si le nouveau service worker s’est activé. Pour vérifier
le cas réel : recharger en ligne sur chaque appareil, ouvrir Réglages et lire **Cuisine OS 0.21.0**, puis contrôler le même
compte et la même adresse `https://neegans.github.io/mistu/`. Prendre une nouvelle photo sur le téléphone, laisser
l’envoi se terminer, puis ouvrir la recette sur l’ordinateur. Le résultat de cet essai reste à fournir par Neegan.

Preuve technique : `.superpowers/sdd/2026-10-29-mise-a-jour/resultat.json`. Ce contrôle n’accède à aucun compte réel.
