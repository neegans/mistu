# Réception — correctifs Thermomix et propositions payées

Demande de Neegan du 29 octobre 2026, pendant la construction de L2. La sécurité Thermomix est traitée en premier dans un checkout indépendant de la corbeille des livres. [Contrat](../specs/2026-10-29-correctifs-thermomix-fiabilite-design.md).

Base publique 0.23.1 (`752566d`, documentation ; code `d6b4488`). Cible 0.23.2, DB5 et archive2 inchangées. Aucun nouvel outil assistant, aucun appel réel ni SQL appliquée pour ce correctif. L2 reste conservé dans `l2-corbeille-livres` et n’est pas déclaré terminé.

## Constats et correction

| Constat | Comportement construit | Preuve ciblée |
| --- | --- | --- |
| 1,5 L + 1 L passent séparément | Somme par contenant après ajout, déplacement et transvasement ; conversions exactes, borne haute des quantités | `correctifs-thermomix-securite.js` |
| Eau vapeur jusqu’à 10 kg | Eau bornée à 2200 g, incluse dans le bol et suivie lors des transferts ; pas d’ajout cumulatif à chaque réglage | Même suite, motif exact et témoins acceptés |
| Justification libre dangereuse affichée | Seules les actions structurées produisent les consignes ; explication locale selon les réglages, jamais la justification libre | Vrai écran avec la phrase signalée et réponse simulée |
| Gardes non atteintes par les tests | Scénarios avec ingrédients réellement placés, motif exact pour huile, chaleur, vapeur ; témoins voisins valides | Huit mutations de protections détectées |
| Mots ordinaires rejetés | Pas de rejet d’une proposition pour « huile végétale », « végétarien » ou refus prudent contenant « garantir » | Domaine et parcours payé simulé |
| JSON entouré de Markdown/prose rejeté | Un objet complet accepté sous habillage borné ; tableaux, objets concurrents, contenu tronqué ou dangereux restent refusés | `correctifs-reponses-json.js` |
| Fourchette « 20 à 25 min » refusée | Les deux bornes explicitement citées sont conservées, aucune valeur intermédiaire inventée | `correctifs-reperes.js` |
| Pannes présentées comme saisie invalide | Textes distincts réseau, délai, indisponibilité, quota et refus ; aucune relance automatique | `correctifs-brouillons.js`, repères |
| Corrections perdent les autres champs proposés | La proposition relue est conservée avec les seuls changements manuels | Vrai formulaire repères |
| Ancien brouillon bloque sans issue | Proposition bloquante visible ; abandon volontaire possible même ancien appareil/contexte illisible, garde compte/cycle et CAS | Brouillons et application réelle |
| Corriger TM bloque cuisson et bibliothèque | Nouvelle version personnelle ; retour explicite aux vraies étapes source. Exports documentaires du plan invalidé et sauvegarde ZIP exhaustive | `correctifs-adaptation.js`, I3 et parcours réel |
| Toutes les durées deviennent manuelles | Provenance par durée ; les valeurs non touchées gardent leur origine et « ≈ » | Repères, concurrence et export |
| Anciennes réponses sous nouvelles questions | Identité du tour, réponses séparées et nouveau formulaire vide | Deux tours, changement concurrent de questions |
| Une description écrase celle de l’autre version | Enveloppe repères révision2, lecture1/2, historique par version/signature, limite explicite sans purge | Ancien client réel, archive, alternance des versions |
| Nouvelle tentative perd proposition payée précédente | Slot conservé dès modification ; un appel suivant, puis choix explicite ; reprise sans réseau et sans nouvelle base adoptée | Brouillons et repères, relecture liée à la réponse affichée |
| Réponse distante rouvre un journal ignoré | Réconciliation terminale bornée Thermomix/repères, copie tardive consultable | Deux moteurs, refus et ajustement d’envoi, accusé perdu, conflits et compte : 67/67 |

## Mesures de réception

- Sécurité : rouge17/31 puis vert31/31 ; complément rouge1/34 puis vert34/34 ; revue indépendante rouge3/38 puis vert38/38 (eau après vidange, « ôtez » et refus prudent de garantie alimentaire). JSON : rouge5/10 puis vert10/10. Ancien domaine I3 :132/132 après correction des scénarios mal préparés.
- Mutations isolées en mémoire du navigateur : capacité, plafond d’eau, vidange de l’eau, huile seule, vapeur cumulée, chaleur puis mixage, instruction libre et affichage de la justification. Chacune fait échouer au moins une assertion ciblée ; aucun fichier de production modifié par cette preuve.
- Outils Node :231/231 ; migrations `--check` :0. Suite navigateur finale **7952/7952**, épingle **7951**, +288 assertions depuis7664, aucune retirée ; zéro erreur JavaScript/requête externe. Syntaxe de45 fichiers JS et diff propres.
- Application réelle sur profil Chrome jetable : deux réponses assistant simulées, conservation TM7, reprise des étapes source en nouvelle version personnelle, original courant intact, correction d’une durée sans perdre description/difficulté/estimations, abandon ancien contexte illisible, rechargement et lecture hors ligne.20 mesures à320/390/768/1280, sans texte parasite ni débordement après correction du minimum de largeur de la grille d’édition. Zéro erreur JavaScript et requête externe.
- Le premier passage visuel a détecté un débordement à320px de la table d’ingrédients dans la grille ; `min-width:0` sur les enfants de `.two-col` maintient le défilement dans la table. Le premier démarrage du harnais attendait la corbeille sur l’accueil ; il ouvre désormais explicitement la bibliothèque.
- L’ancienne attente de course de l’écran web est conservée, mais provoquée dans `renderImportWeb` directement : la porte d’entrée lit maintenant les propositions bloquantes avant ce rendu. Le test vérifie toujours la notification survenant entre lecture et montage, et son rattrapage.

- Brouillons **61/61**, repères **56/56**, adaptations **46/46**, synchronisation terminale **67/67**. Régressions : I3 domaine132, journal66, écran55, intégration54 ; repères domaine87, écran49, parcours47 ; synchronisation L3 538 et L1 58, toutes vertes.
- La revue indépendante a reproduit puis corrigé deux courses supplémentaires : Garder lie l’écriture à la réponse affichée et relue (avant et dans transaction) ; une correction Thermomix ne rétablit plus un ancien `current_version_id` si un autre onglet a corrigé l’original.
- Deux passages finaux de l’application réelle passent avec20 mesures chacun. La lecture intermittente de temps vides provenait d’une attente du harnais : le Playwright installé résolvait `waitForFunction(async () => false)` en58ms malgré un timeout500ms, tandis que le prédicat synchrone expirait normalement. L’attente des écritures utilise désormais des lectures `page.evaluate` explicitement attendues et bornées. Aucun correctif applicatif spéculatif n’a été ajouté pour ce faux échec ; les deux reprises constatent les valeurs écrites avant la suite.

Artefacts de travail ignorés : `.superpowers/sdd/2026-10-29-correctifs/`, notamment `securite-rouge.log`, `json-rouge.log`, `mutations-securite.json`, les rapports par volet et `parcours-local/resultat.json`. Réception locale et publique terminées, publication détaillée ci-dessous.

## Limites

Les volumes alimentaires non mesurés ne sont pas déduits d’une masse ; le contrôle ne certifie pas le remplissage réel ni une cuisson sur le robot. Les restrictions du profil Mistu sont propres au logiciel. Le contenu original et les données de sauvegarde restent conservés, y compris un plan devenu non conforme, sans lui rendre sa validité de cuisson.

Les essais utilisent des données fictives et des appels simulés, sans compte privé ni robot. Aucun appareil physique iPhone/Safari, lecteur d’écran, échange HTTP Supabase authentifié ou nouvelle mesure sur les deux appareils de Neegan n’est prouvé ici. Les essais de synchronisation emploient les vrais moteurs avec transport simulé. Sans migration SQL, un ancien client ignorant la clôture peut encore rouvrir temporairement la ligne distante. Une application à jour qui connaît la clôture conserve son état fermé et réconcilie à la réception. Les copies perdantes sont locales, hors archive et non purgées automatiquement ; aucune adaptation n’est créée automatiquement par une réponse tardive.


## Publication vérifiée

Code `5412745`, intégré en avance rapide dans `main` et poussé sous l’autorisation de la conversation. GitHub Pages construit le29octobre à21:26:05UTC (17h26HAE).
Comparaison de **46 fichiers** de production/tests modifiés : tous identiques au commit ; le premier essai Python utilisait un magasin de certificats local incomplet, la comparaison a été relancée avec `curl` et vérification TLS normale.
Suite publique **7952/7952**, zéro erreur JavaScript et requête externe. Parcours public réel avec deux appels simulés : **20 mesures** sans débordement ni texte parasite, conservation des propositions, retour aux étapes source, abandon ancien brouillon, cache des cinq modules et lecture hors ligne.
Aucune migration SQL requise ou appliquée. La corbeille des livres L2 reste séparée ; sa construction reprend après intégration de ce correctif.
