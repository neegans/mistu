# Lentille produit / navigation / i18n — copie 247b2e5 (30 oct. 2026)

Lecture seule par un agent « explore » ; chemins relatifs à ``. Les comptages i18n sont des échantillons (inférence).

## 1. Verdict
- Les nouvelles surfaces existent presque toutes et sont atteignables. Seule route orpheline : `/import` nu (aucun lien). Les « trous » sont ailleurs : ce qui est promis et absent, et ce qui est dit en langage de mécanisme.
- 5 destinations uniques (onglets bas sur mobile, rangée haute dès 900 px) ; plus de panneau latéral depuis le 28 oct (`src/ui/coquille.js:25`). Corbeille, Diagnostic, Brouillons, Minuteurs, Sources n'ont aucun onglet : boutons d'écran ou Réglages.
- Important : l'accueil ne montre ni prochain repas, ni envies, ni courses, ni import interrompu, ni brouillons (plan directeur § 6.1 l'exigeait). Les Réglages sont le fourre-tout technique (jargon de synchro, JSON brut, noms de magasins internes).
- Promesses manquantes : « Mettre à jour mes stocks » (L8 § 6, absent), note personnelle près de l'étape (L7 § 3, absente de `cook.js`, inférence), purge/vidage de la corbeille (différé volontairement, § 8.6), renommage « Ma semaine » → « Repas » à moitié fait.
- i18n : échantillon sain. Seul trou trouvé, ancien : l'onglet Appareils de Ma cuisine n'a aucune entrée anglaise.

## 2. Routes (`src/app.js:150-173`)
| Route | Entrée visible | Verdict |
|---|---|---|
| `/` | onglet « Aujourd’hui » `coquille.js:12` ; marque `:31` | OK |
| `/search` | loupe `coquille.js:36` ; `home.js:34` | OK |
| `/library` | onglet `coquille.js:13` | OK |
| `/corbeille` | seul bouton « Corbeille » en tête de Bibliothèque `library.js:56` ; `corbeille.js:34` | Une seule porte, discrète ; rien depuis Réglages, l'accueil ou une fiche |
| `/books/:id`, `/dishes/:id` | cartes `library.js` ; `components.js:333` | OK |
| `/recipes/new` | `add.js:353` ; `book.js:213` | OK |
| `/recipes/creer` | `add.js:355` ; `search.js:252` ; `recipe.js:334` | OK |
| `/recipes/:id`, `/edit`, `/photo`, `/reperes` | cartes ; menu Actions `actions-contenu.js:123-126` ; `reperes-affichage.js:15,49` | OK |
| `/recipes/:id/thermomix` | `recipe.js:174,320` | OK |
| `/recipes/:id/importer` | `recipe.js:323,566,605` | OK |
| `/cook/:id` | « Reprendre ma recette » `home.js:57`, `meals.js:238`, `recipe.js:495`, `settings.js:915` | Une séance terminée n'a plus de lien (sauf suivi de durée en cours, `home.js:45-47`) ; pas de liste des séances |
| `/import` (nu) | aucun lien sans paramètre ; `?session=` depuis `book.js:250,373,377`, `settings.js:922` | Orpheline (`import.js:83`) ; doublonnée par la section « Imports » de `/add` |
| `/meals`, `/meals/:id` | onglet « Ma semaine » `coquille.js:14` | OK ; titre de page « Repas » (`meals.js:30`) vs onglet « Ma semaine » |
| `/kitchen` | onglet `coquille.js:15` ; inventaire = onglet interne `kitchen.js:14` ; `home.js:104` ; `add.js:356` | L'onglet par défaut est « Appareils » (`kitchen.js:12`) ; l'inventaire (L8) est un second geste |
| `/settings` | roue `coquille.js:37` ; `home.js:109` ; `recipe.js:216` | Liens atterrissent en haut, sans ancre ; « Trancher dans Réglages » oblige à chercher « Conflits à trancher » |
| `/lists/:id` | section « Courses » `meals.js:35` (10 dernières listes, aucun « voir toutes ») ; `meals.js:213` | OK ; au-delà de 10, seulement via le repas |
| `/add`, `/add/livre`, `/add/signet` | onglet `coquille.js:16` ; `library.js:54` ; `add.js:351,354` | OK |

Nouvelles surfaces : Brouillons = section « Mes brouillons sur cet appareil » dans `/add` (`brouillons-liste.js:33`, cachée si vide `:39`), lien Réglages `settings.js:226`, bloc dans l'éditeur `recette-editeur.js:92` · Inventaire = Ma cuisine onglet interne ; accueil seulement si un lot expire bientôt (`home.js:100`) · Minuteurs = panneau dans `/cook/:id` (`cook.js:48`), aucune surface globale · Sources/révisions = « Historique des photos » (`revisions-source.js:80`), onglet « Pages source » (`book.js:366`) · Traductions = pas de route propre ; `recipe.js:438` seulement quand un avis de lecture s'affiche · Diagnostic = dernière section de Réglages (`settings.js:321`) · Versions candidates = aucune surface nommée ; `livre-sans-saisie.js:278` « Cette candidate… » · Préparer hors ligne = `meals.js:188` · Mises à jour = bandeau `app.js:20` + `mise-a-jour.js`.

## 3. Culs-de-sac (Important)
1. Actions désactivées sans motif visible au toucher : `actions-contenu.js:171` met le motif en `title` (infobulle, absente sur iPhone) ; capacité serveur inconnue → « Mettre à la corbeille » / « Restaurer » grisés sans phrase (`:112,135`). Sur la fiche, `corbeille.js:56` dit au moins « La corbeille n’est pas encore disponible pour ce compte… ».
2. « Vérifier la disponibilité » échoue en silence : `corbeille.js:57-67` `catch { }` ; hors ligne, rien n'est dit ; sans synchro configurée, ni geste ni explication.
3. Séance de cuisine en erreur : `cook.js:56` « La bibliothèque a changé. Rouvre la séance de cuisine. » sans bouton « Rouvrir » ni retour ; `cook.js:40` pas de `pageHeader`.
4. Conflits en JSON brut : `settings.js:914,921,931,940` `<details><pre>JSON.stringify(...)` sous « Consulter la copie conservée » ; seuls `inventory` et `cooking` ont un écran de comparaison ; les autres : « Reprends les changements depuis le contenu concerné » (`:919`).
5. Brouillon `invalide`/`detache` : pas de « Reprendre » (`brouillons-liste.js:11`) mais « Télécharger mon texte » + « Écarter ». OK.
6. Adaptation TM7 invalide : `thermomix-garde.js:11-14` offre « Revenir à la fiche ». OK.
7. Mise à jour (`mise-a-jour.js:21`) : « ferme toutes les fenêtres Mistu, y compris l’app installée. Rouvre ensuite Mistu. » Consigne sans geste iPhone expliqué ; aucun bouton de rechargement (choix voulu).
8. Puces de sélection (`bibliotheque-liste.js:100`) : « Rattacher au plat » grisé tant qu'aucun plat choisi ; tolérable.

## 3 bis. Écrans « système » (première ligne = mécanisme)
Important : Synchronisation (`settings.js:1138-1147`) « À envoyer », « En quarantaine », « Envoi initial : {t} {n}/{total} » où `{t}` est un nom de magasin interne (`:1166`) ; lignes `${e.store} · ${id}` (`:1183,1193`) · Sauvegarde (`settings.js:224`) « Archive ZIP privée : manifeste, données par entité… SHA-256 » · Données sur cet appareil (`settings.js:290-291`) « Base locale « cuisine-os » v{n} · format d’archive v{n} » + puces `magasin : compte` · Ma cuisine > Appareils (`kitchen.js:22`) « Le moteur raisonne sur les capacités, pas sur la marque… palier V1 ; le registre se prépare » (texte de développeur, sans traduction anglaise) · Diagnostic (`settings.js:93`) décrit son contenu, pas son but · Minuteurs (`minuteurs-session.js:97,155`) « Confirmé par la synchronisation. », « Modification en conflit. Les deux états restent distincts. » · Inventaire (`inventaire.js:33`) « Synchronisé. » / « Modification à comparer. »
Mineur : `revisions-source.js:83` « révision » ; `livre-sans-saisie.js:278` « candidate » ; `brouillons-liste.js:41` ; `hors-ligne-repas.js:56` ; `reperes.js:207` ; marque incohérente « Cuisine OS » (`coquille.js:31`, `settings.js:105`) vs « Mistu » (`mise-a-jour.js:21`) ; ≈ 40 lignes `t()` à vocabulaire technique dans `src/ui` (inférence), dont 25 dans `settings.js`. Bon exemple : `corbeille.js:182` « …Tu peux les restaurer. »

## 4. i18n
- Échantillon de 20 textes neufs : 19 trouvés dans `en.js`. Absent : `kitchen.js:22` (ancien).
- Trous probables, tous anciens : tout l'onglet Appareils de `kitchen.js` (« Ajouter un appareil courant… », « Appareil ajouté », « Aucun appareil enregistré. », « Appareil personnalisé », « Nom de l’appareil », « Notes (capacité…) », « Supprimer « {n} » ? ») ; `kitchen.js` n'est ni dans `MODULES_NEUFS` ni dans `CHAINES_NEUVES_AILLEURS` → aucun test ne le garde.
- Clés dynamiques non filtrées : `actions-contenu.js:107,144` `t(libelle)` ; `settings.js:978` `t(variable)` ; le filtre F13 ignore les variables (`tests/ajouter.js:9-11`). « Modifier le livre », « Retirer des favoris », « Ajouter aux favoris » non retrouvés dans `en.js` (à vérifier par script).
- `MODULES_NEUFS` (`tests/ajouter.js:12`) couvre 24 des 26 modules UI neufs ; manquent `recette-garde.js` et `repas-garde.js` (sans `t()`, sans conséquence). `kitchen.js` et `dish.js` hors `CHAINES_NEUVES_AILLEURS`.

## 5. Mobile et promesses non tenues
Mobile : pas de tableau large ni `alert()`/`prompt()` direct ; `confirm()`/`prompt()` natifs seulement en repli `src/core/dom.js:138,142` (conforme L9 § 4) ; `.btn` 44 px ; barre de sélection (`bibliotheque-liste.js:99`) chargée à 375 px (inférence) ; panneau Filtres 11 contrôles dont un `<select multiple>` de tous les ingrédients (`:74`) et un filtre « Appareil » codé en dur « Thermomix TM7 » (`:73`) ; « ← Retour » de `pageHeader` (`components.js:31`) simple `<a>` à .9rem, cible 44 px non garantie ; `dish.js` → `attachRecipe` capture toutes les recettes avant d'ouvrir le dialogue (perf, inférence).
Promesses : (1) accueil sans repas/envies/courses/imports/brouillons (plan § 6.1) ; (2) L8 § 6 « Mettre à jour mes stocks » absent ; (3) L8 § 3.1 onglet encore « Ma semaine » ; (4) L7 § 3 note près de l'étape absente (inférence) ; (5) L3 § 6 libellé « Sélectionner les recettes affichées » (cosmétique) ; (6) corbeille sans purge ni « Vider », grossit sans limite ni décompte ; (7) plan § 6.2/7.1 liste + aperçu côte à côte en bureau non observable (inférence) ; (8) L3 § 3.2 sections et actions présentes ; (9) courses : gestes présents (`grocery.js:32-61`, `meals.js:331,341`).

Pièges : le seul chemin vers « Comparer les copies de cuisine » est le bloc Synchronisation de Réglages (`settings.js:898-915`) ; `NOM_MAX` tronque un nom dans les conflits ; « Effacer cet appareil » reste dans une section technique (`settings.js:289-300`). Incertitude principale : condition d'affichage de l'avis de lecture (`recipe.js:438`).
