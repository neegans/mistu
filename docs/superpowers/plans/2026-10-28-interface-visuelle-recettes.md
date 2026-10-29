# Construction — Photos, descriptions et temps

Spec approuvée sur « ok go » : [révision 1](../specs/2026-10-28-interface-visuelle-recettes-design.md).
Base `d832528`, branche `interface-visuelle-recettes`, application visée `0.21.0`, DB 4.

1. Photos : récupération visible, états distants/décodage, gestion de l’image affichée, tests à deux bases.
2. Repères : contrat borné, corrections liées à leur source, lecteur commun, recherche/repas/exports.
3. Parcours : saisie manuelle et proposition IA explicite, journal durable, conservation conditionnée.
4. Écrans : maquette du livre et de la fiche, cartes enrichies, cuisine centrée sur l’étape, pages source.
5. Intégration : routes, vocabulaire, i18n, versions/cache, préservation des métadonnées dans les éditeurs.
6. Revue croisée, tests navigateur/Node/migrations, captures comparées aux références et parcours hors ligne.

Les tâches 1–3 sont déléguées dans des fichiers distincts ; le chef porte les écrans existants et l’intégration.
Tests de comportement d’abord, réseau simulé, bases jetables. Aucun appel IA réel ni accès aux données privées.
Preuves ignorées par Git : `.superpowers/sdd/2026-10-28-interface-visuelle/`.
Le choix approuvé est un appel explicite pour les repères ; pas de génération automatique à l’import.
Publication autorisée ensuite par Neegan sur « go deploy ».

## Résultat vérifié

Les six étapes sont terminées. Version publiée `0.21.0`, cache `cuisine-os-v0.21.0-1`, DB 4. Commit de code `af85c6f`,
intégration en avance rapide dans `main`, push et construction Pages réussis le 28 octobre à 22 h 43 HAE.

Contrôles publics : **7080/7080**, zéro erreur JS/requête externe, neuf fichiers identiques, cache actif et contrôlant
avec les six modules. Profil neuf sans compte : correction et photo conservées, photo décodée hors ligne, progression
cuisine maintenue après ouverture photo/rechargement hors ligne. Fiche sans débordement à 320/390/768/1280.
Preuves : `suite-publique.resultat.json`, `publication.resultat.json`, `pages-build-code.json` et `captures-publication/`.

| Contrôle | Résultat lu |
|---|---|
| Suite navigateur | 7080/7080, épingle 7079, zéro erreur JS/externe |
| Repères / photos / journal / écran / intégration | 87 / 48 / 45 / 39 / 23 |
| Anciennes suites photos / synchronisation fichiers / Carnet | 195 / 403 / 282 |
| Outils Node | 230/230, exécution en série |
| Migrations | `--check` terminé avec code 0 |
| Syntaxe | 119 fichiers JavaScript |
| Visuel | [Rapport passed](../../../design-qa.md), cinq largeurs sans débordement |
| Parcours réel local | correction manuelle, choix photo, rechargement, anglais, cuisine et cache hors ligne |

Le total augmente de 260 : 242 assertions ciblées plus 18 contrôles i18n des six modules neufs. Aucune assertion retirée.
Les attentes obsolètes sont remplacées : photo distante cachée, repli vers la photo du livre, titre alias prioritaire,
somme préparation+cuisson, cartes entièrement enveloppées dans un lien, menus et proportions précédents.
Les tests d’images détachées demandent explicitement leur chargement pour ne pas attendre indéfiniment `loading=lazy`.

Revue croisée : contexte de synchronisation propagé aux listes secondaires et repas ; correction nulle appliquée aussi à l’en-tête
des ingrédients ; gestion photo conservée après redessin ; absence de texte « null » ; valeurs exportées bornées ;
écritures tardives après fermeture refusées ; réception partagée maintenue si son premier lecteur disparaît.

Preuves du registre : `suite.resultat.json`, `node.log`, `visuel.resultat.json`, cinq suites ciblées et `captures/`.
Certaines premières preuves ciblées des agents sont aussi dans le registre I3, utilisé comme harnais avant copie locale.
La fixture visuelle utilise uniquement le profil jetable ; ses valeurs et son extrait de photo ne deviennent pas des données de production.

Non prouvé : vrai appel assistant, Safari/iPhone physique, formats de photos réels et transfert sur le compte de Neegan.
Sur les appareils de Neegan : recharger les deux appareils sur la même version et le même compte, photographier un plat,
vérifier son envoi puis son apparition et sa disponibilité hors ligne sur l’ordinateur.
