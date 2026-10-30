# STATE.md — Cuisine OS (Mistu) — 29 octobre 2026 — 0.26.0 LOCALE — L4 REÇU

**L4 — Éditeurs et brouillons : réception locale terminée, publication autorisée à suivre.**
[Spec](docs/superpowers/specs/2026-10-29-l4-editeurs-brouillons-design.md), [rapport](docs/superpowers/plans/2026-10-29-l4-editeurs-brouillons.md).
Branche `l4-editeurs-brouillons`, base `9ecf826`, contrat `de858f9`, revues techniques avant construction.
Formulaires structurés de recette/livre, source à côté ou bascule mobile, cinq sections, brouillons locaux repris explicitement.
Publication atomique et idempotente, métadonnées sans version superflue, lignes/paragraphes/original conservés,
réponse payée liée au journal exact, comparaison de conflits, récupération de texte et sorties protégées.
Titre personnalisé principal dans fiches/cartes/listes/cuisine ; valeurs corrigées également utilisées dans les exports.
**8880/8880** navigateur (épingle8879, +333 depuis L3 sans retrait), Node232/232, générateur0, syntaxe60 et diff propres.
Domaine129 assertions ; vrais parcours Chrome **28+12 mesures**, deux onglets, rechargement/reprise, quota,
création hors ligne, note/photo conservées, dix nouveaux modules dans le cache unique.
**0.26.0**, cache `cuisine-os-v0.26.0-1`, DB6/archive3 inchangées, aucun SQL nouveau.
Brouillons propres à l’appareil, hors archive/synchronisation ; touches non confirmées et historique étranger sans index restent limités.
Aucun compte privé, appel assistant réel ou essai physique iPhone/Safari ; production encore0.25.0 à ce stade.
L5 est en préparation de contrat, sans code ; **L5–L10 et E1 restent à réaliser**.

**L3 — Gestion visible : publié et vérifié.** Branche `l3-gestion-visible`, base publique `fc407df`.
[Spec](docs/superpowers/specs/2026-10-29-l3-gestion-visible-design.md), [rapport](docs/superpowers/plans/2026-10-29-l3-gestion-visible.md).
Poursuite et publication autorisées par « et enchaine sur le restant des lots » puis « continu ».
Modifier/Actions visibles, grille et liste communes, filtres, sélection groupée avec résultats individuels,
retour à la liste avec recherche/position conservées, contextes Recettes/Sources séparés ; maquettes fournies relues.
**8547/8547** navigateur (épingle8546, +181 sans retrait), Node232/232, générateur0, syntaxe43 et diff propres.
Parcours réels :25 +16 mesures, texte200 %, deux onglets, photos/notes après rechargement hors ligne, quatre modules en cache.
Modifier livre visible/focalisé à390/1280 ; export documentaire TM et réessai après quota corrigés après revue indépendante.
Cible **0.25.0**, cache `cuisine-os-v0.25.0-1` ; **DB6 et archive3 inchangées, aucun SQL nouveau**.
Code **`ea25232`**, avance rapide dans `main`, poussé ; GitHub Pages construit le29octobre à **19 h05 HAE (23:05:19UTC)**.
**44 fichiers** de production/tests publics identiques ; navigateur public **8547/8547**, zéro erreur JavaScript/requête extérieure.
Parcours publics **25+16 mesures**, contextes de listes, actions, quatre modules en cache unique, photo/note après rechargement hors ligne.
L4–L10 et E1 restent à réaliser ; L4 commence ensuite, le plan complet n’est pas terminé.

**Publication L2 vérifiée — 29 octobre,18 h 18 HAE (22:18:18UTC).** Code `9ec738c`, intégration `fc407df`,
avance rapide dans `main` puis GitHub Pages construit. **82 fichiers** de production/tests publics identiques au commit.
Suite publique **8366/8366**, zéro erreur JavaScript/requête extérieure. Parcours public :24 mesures sans débordement,
rechargements livre et recette avec réseau coupé, photos/notes/versions intactes, six modules nouveaux et deux modifiés en cache unique.
Migration0009 appliquée une seule fois avant le site ;17 fonctions exactes, droits exacts,50 triggers avec RLS conformes.
Capacités `recipe_lifecycle:1` et `edition_lifecycle:1` vérifiées sous rôle authenticated autorisé, en lecture seule.
Aucune donnée métier serveur modifiée, aucun appel assistant ni JWT utilisateur emprunté ; pas d’essai HTTP authentifié sur appareils privés.
[Rapport complet](docs/superpowers/plans/2026-10-29-l2-corbeille-livres.md). **L3 reprend ensuite ; L3–L10 etE1 ne sont pas terminés.**

**29 octobre 2026 — L2 : CORBEILLE DES LIVRES, RÉCEPTION LOCALE TERMINÉE.**
Après « deploy avant », Neegan demande « et enchaine sur le restant des lots ».
[Spec L2](docs/superpowers/specs/2026-10-29-l2-corbeille-livres-design.md) écrite puis relue techniquement ;
cette autorisation globale n’est pas présentée comme une relecture du nouveau texte par Neegan.
Branche `l2-corbeille-livres`, base initiale `752566d` ; correctifs 0.23.2 `5412745` intégrés avant reprise.
Retirer une édition en gardant ses recettes, ou retirer l’ensemble ; cycles individuels conservés,
restauration d’un membre possible sans restaurer tout le livre. C09 devient une opération réversible.
Version locale **0.24.0**, cache `cuisine-os-v0.24.0-1`, DB6 (index d’éditions), archive3, migration additive0009.
**8366/8366** navigateur (épingle8365, +414), Node232/232, générateur0, syntaxe87 fichiers et diff propres.
PostgreSQL neuf0001→0009 :121 assertions ; deux sessions concurrentes RPC/REST/CAS. Trois vrais moteurs et501 membres, archive3/photos.
Parcours réel :24 mesures320/390/768/1280, rechargements livre/fiche hors ligne, photo/notes/versions intactes, six modules nouveaux en cache.
Provenance et CAS de séances/archives, tombales après restauration et anciens échos de cycle corrigés après reproductions rouges.
Aucun SQL0009 ni déploiement0.24.0 distant à ce point ; la publication est autorisée par la poursuite du plan.
[Construction et réception](docs/superpowers/plans/2026-10-29-l2-corbeille-livres.md).

**29 octobre 2026 — PRIORITÉ DONNÉE PAR NEEGAN : THERMOMIX, APPELS PAYÉS ET BROUILLONS.**
Travail isolé dans `correctifs-thermomix-0.23.2`, base publique `752566d` ; L2 est conservé, non terminé, dans `l2-corbeille-livres`.
[Contrat](docs/superpowers/specs/2026-10-29-correctifs-thermomix-fiabilite-design.md) et [rapport](docs/superpowers/plans/2026-10-29-correctifs-thermomix-fiabilite.md).
Cible **0.23.2**, cache `cuisine-os-v0.23.2-1`, DB5 et archive2 inchangées ; aucun SQL ni appel assistant réel.
Capacité cumulée et eau vapeur suivies, explications générées depuis les réglages validés ; protections testées au motif exact et huit mutations détectées.
Propositions payées conservées, JSON habillé accepté, plages de durée et provenance par champ ; repères révision2 par version/signature.
Abandon explicite des anciens brouillons, résultats précédents récupérables, questions par tour et relecture liée au résultat affiché.
Corrections TM en versions personnelles avec retour explicite aux étapes source ; exports documentaires des plans invalidés.
Clôtures connues réconciliées sur réception/envoi, copies tardives consultables localement sans réouverture ; limites des anciens clients documentées.

**Correctif 0.23.2 publié et vérifié.** Navigateur **7952/7952** (épingle7951, +288 depuis7664 ; aucune assertion retirée), zéro erreur JavaScript/requête externe. Node **231/231**, migrations `--check`0, syntaxe de45 fichiers JS et diff propres.
Ciblés : sécurité38, JSON10, brouillons61, repères56, adaptation46, synchronisation67 ; huit mutations de protections détectées.
Application réelle en profil Chrome jetable : deux passages complets,20 mesures à320/390/768/1280 par passage, sans débordement ni texte parasite ; cinq modules neufs en cache et lecture hors ligne.
L’anomalie de lecture des temps venait du harnais : son attente asynchrone se résolvait sur `false`. Reproduction minimale conservée ; attente remplacée par lectures explicitement attendues jusqu’à l’état écrit. Les deux parcours corrigés prouvent description, estimations et correction manuelle conservées.
Code **`5412745`**, avancé dans `main` et poussé ; GitHub Pages construit le29octobre à **17 h 26 HAE (21:26:05 UTC)**.
**46 fichiers** de production/tests modifiés identiques au commit public. Suite publique **7952/7952**, zéro erreur JavaScript/requête externe.
Parcours public complet : **20 mesures** sans débordement ni texte parasite, deux réponses simulées conservées, ancien brouillon abandonné, cinq modules en cache et lecture hors ligne.
Preuves : `.superpowers/sdd/2026-10-29-correctifs/`. La version publique est désormais **0.23.2** ; L2 est repris séparément, encore incomplet.
Aucun compte privé, HTTP Supabase authentifié, appareil physique iPhone/Safari ou TM7 utilisé ; copies de conflit locales hors archive et limite des anciens clients explicitement conservées dans le rapport.

**29 octobre 2026 — PUBLICATION L0 + L1 SUR « deploy avant », PUIS POURSUITE DU PLAN AUTORISÉE.**
Neegan demande ensuite « et enchaine sur le restant des lots ». La suite se prépare lot par lot,
avec contrat écrit et revue technique avant construction ; l’état L2 est décrit en tête.
Migration **0008** appliquée à `mitsu` en transaction après contrôle du catalogue et d’une sauvegarde physique.
Postflight distant en lecture seule : **7 corps exacts**, **9 triggers avec RLS**, droits attendus,
capacité **recipe_lifecycle = 1** sous rôle `authenticated` autorisé ; RPC anonymes refusées (401/42501).
Aucun contenu métier consulté ou modifié, aucun JWT utilisateur emprunté, aucun appel assistant.

Code `52338ec` intégré en avance rapide dans `main`, poussé et construit par GitHub Pages le 29 octobre à
**16 h 09 HAE (20:09 UTC)**. Public **0.23.0**, cache `cuisine-os-v0.23.0-1`, DB5 ; **59 fichiers** identiques au commit.
Suite publique **7656/7656**, zéro erreur JavaScript/requête externe. Parcours public en profil jetable :
traduction partielle, heure répétée Toronto, courses, note/photo ajoutées, corbeille/restauration, ancien éditeur refusé,
cache des huit modules L0+L1 et hors ligne ; **26 mesures** sans débordement. Essais physiques toujours à faire.

La relecture des captures a trouvé un texte littéral `null` dans les courses et la cuisine actives : les mentions
absentes sont désormais filtrées avant insertion DOM. **Correctif 0.23.1 publié**, commit `d6b4488`, GitHub Pages
construit à **16 h 18 HAE (20:18 UTC)** ; cache `cuisine-os-v0.23.1-1`, DB inchangée, 59 fichiers publics identiques.
Huit assertions nouvelles, **7664/7664** navigateur local (épingle 7663), Node **231/231**, générateur `--check` 0.
Parcours local puis public 0.23.1 : **31 mesures**, aucun débordement ni texte parasite, zéro erreur JS/requête externe.
Cache unique actif avec huit modules L0+L1 ; notes/photos et restauration hors ligne préservées.
**Suite publique 0.23.1 : 7664/7664**, terminée à 20:19:59 UTC, zéro erreur JavaScript ou requête externe.
Le premier essai de suite publique à 390 px cherchait une table remplacée normalement par des cartes ;
le harnais de suite reprend les 1280 px de référence. Aucun défaut de comparaison applicatif constaté.
Preuves : `.superpowers/sdd/2026-10-29-l1-publication/`. [Bilan serveur](supabase/proofs/RESULTATS-mitsu.md).

**29 octobre 2026 — L1 APPROUVÉ ET CONSTRUIT LOCALEMENT : CORBEILLE INDIVIDUELLE.**
Neegan approuve la [spec de corbeille individuelle](docs/superpowers/specs/2026-10-29-l1-corbeille-individuelle-design.md) sur « ok ».
Branche `l1-corbeille-individuelle`, base de spec `cf539fb`, contenant L0 `9c823b0`.
[Rapport de construction et preuves](docs/superpowers/plans/2026-10-29-l1-corbeille-individuelle.md).

Retrait et restauration des recettes autonomes, Annuler conditionné, corbeille accessible depuis la bibliothèque.
Versions, sources, notes, photos et historique conservés ; nouveaux choix limités aux recettes actives.
Écritures tardives refusées même après restauration, avec saisie ou résultat payé conservé pour relecture explicite.
Gardes atomiques de cycle et de compte, commandes de synchronisation distinctes des modifications, conflits consultables.
Archives complètes avec refus intégral des cycles divergents et collisions d’enfants.

Application **0.23.0**, cache **cuisine-os-v0.23.0-1**, **IndexedDB 5** (index `trashed_at`), **archive 2** (lecture 1/2).
Migration additive **0008_corbeille_recettes.sql** préparée ; anciennes migrations inchangées.
Navigateur **7656/7656** (épingle **7655**, +259 depuis L0, aucune assertion retirée), Node **231/231**,
migrations `--check` **0**, syntaxe de **93** fichiers et diff propres. Ciblés L1 : domaine **61**, archives **24**,
synchronisation **58**, écrans **79**, mutations **30**. Zéro erreur JavaScript ou requête externe dans les preuves navigateur.

Application réelle en profil jetable : retrait au clavier, rechargement, restauration, notes/photos intactes,
ancien éditeur sur un second onglet refusé sans perdre sa saisie, consultation hors ligne et six modules en cache.
Captures relues à 320/390/768/900/1280, texte à 200 %, aucun débordement horizontal.
Vrai code L0 0.22.0/DB4 : fermeture lors du passage en DB5, réouverture refusée par `VersionError`, données conservées.
Trois bases et trois vrais moteurs avec transport/stockage simulés : concurrence hors ligne, réessai après accusé perdu,
archive sur un troisième appareil puis connexion, photos intactes. PostgreSQL local réel : **42 assertions** et
deux sessions concurrentes ; une commande acceptée, l’autre refusée sur sa base périmée. Serveur de test arrêté.
Preuves locales : `.superpowers/sdd/2026-10-29-l1/`.

À la clôture initiale, L1 était local et la dernière publication était 0.21.1 ; la publication autorisée est décrite en tête.
Aucun compte privé, vrai appel assistant, appareil iPhone/Safari physique ou lecteur d’écran testé.
L’échange HTTP authentifié, Storage et la convergence sur les deux appareils réels restent à vérifier ; les contrôles
SQL de capacité et les refus anonymes PostgREST ont été ajoutés lors de la publication.
Les conflits d’enfants restent consultables et bloqués jusqu’à reprise volontaire depuis la fiche.
Livres/groupes, purge, refonte générale et traduction automatique complète restent hors de L1 ; le plan directeur n’est pas terminé.

**29 octobre 2026 — PLAN DIRECTEUR : LOT L0 APPROUVÉ ET CONSTRUIT LOCALEMENT.**
Neegan fournit `Mistu_Plan_Directeur_Interface_et_Fonctions_0.21.1.md`, conservé à l’identique dans
[`docs/lots/2026-10-29-plan-directeur-interface-fonctions.md`](docs/lots/2026-10-29-plan-directeur-interface-fonctions.md).
La base du plan correspond à `main` `cd8c7f2`. Le plan donne pour cible du « français simple » la recette entière traduite fidèlement,
distincte de la description courte. [Spec L0](docs/superpowers/specs/2026-10-29-l0-reference-correctifs-design.md) approuvée sur « go ».
Branche `l0-reference-correctifs`, base `cd8c7f2`. [Rapport et preuves](docs/superpowers/plans/2026-10-29-l0-reference-correctifs.md).

Traductions manuelles par segment, trous et paragraphes conservés, anciennes traductions consultables sans association présumée.
Gardes atomiques contre recette/version disparue et source/traduction concurrente ; aucun original réécrit.
Heure locale et choix du décalage au changement d’heure ; les portions ne rétablissent plus une ancienne heure.
Recette active, lien Fiche et progression cohérents, sélection conditionnée ; durées exactes et choix explicite des bornes d’une plage.
Copier/Partager utilisent la même sortie de courses, avec mode restants/complet ; cases concurrentes réconciliées à l’écran.

Version locale **0.22.0**, cache `cuisine-os-v0.22.0-1`, DB **4**. Deux modules de domaine neufs dans le cache ; aucun magasin, SQL ou outil assistant.
Navigateur **7397/7397** (épingle **7396**, +279 assertions depuis 7118, aucune retirée). Ciblés : traductions **84**, cuisine **110**, repas/courses **54**, intégration **30** ;
Toronto **13** séparés. Node **230/230**, migrations `--check` **0**, syntaxe de **29** fichiers JS et diff propres.
Parcours réels sur profil jetable : traduction enregistrée au clavier et relue, heure répétée choisie/rechargée, recette active persistée,
cases et copie des courses, fiche rechargée hors ligne. Cache actif avec les deux modules. Largeurs 320/390/768/900/1280 et texte à 200 %
sans débordement horizontal. Zéro erreur JavaScript ou requête externe. Synchronisation entre deux bases avec moteurs réels/transport simulé,
puis archive et restauration sur une troisième base. Preuves : `.superpowers/sdd/2026-10-29-l0/`.

À sa clôture initiale, L0 était local ; il est inclus dans la publication 0.23.0 décrite en tête. Aucun vrai appel assistant, compte privé,
Safari/iPhone physique, déclenchement Siri ou partage natif vérifié. La traduction automatique complète et sa lecture fiche/cuisine/voix
restent L6/L7 ; la refonte visuelle, la corbeille et les révisions de source ne sont pas livrées par L0. Le plan directeur entier reste à réaliser.

**29 octobre 2026 — RETOUR MOBILE : CORRECTIFS 0.21.1 PUBLIÉS ET VÉRIFIÉS.**
Neegan confirme la réception des photos mobile → ordinateur. Il signale ensuite ne pas voir les changements de présentation
et ne pas trouver le « français simple ». La réception du lot visuel est donc rouverte. Captures neuves : recette sans repères
montrant « Description à compléter », accès indirect à l’assistant et motif de connexion sous le long formulaire ; sélecteur de
langue ne reflétant pas FR choisi. Le lien Traduire perd aussi la langue cible. Correctifs bornés décrits au § 13 de la spec.
Branche `correctifs-francais-mobile`, base `801b115`, commit de code `fe241e1` intégré en avance rapide dans `main`.
Push et GitHub Pages réussis le 29 octobre à 8 h 26 HAE (12 h 26 UTC) ; public en 0.21.1. Accès principal à la description française, motif de
connexion/hors ligne près du bouton, sélection FR/EN cohérente et langue cible transmise à l’éditeur corrigés. La traduction IA
intégrale n’est pas construite ni annoncée comme livrée ; le parcours de traduction des ingrédients/étapes reste manuel.
Version publiée 0.21.1, cache `cuisine-os-v0.21.1-1`, DB 4. **7118/7118** tests (épingle 7117 ; +38 sans retrait), Node **230/230**,
migrations `--check` 0, syntaxe de 19 fichiers JS et diff propres. Ciblés : intégration 33, écran repères 49, Carnet 300.
Preuves : `.superpowers/sdd/2026-10-29-mobile-francais/`. Captures locales vérifiées à 320/358/390/768/1280 : description conservée après rechargement, visible dans le livre, original anglais intact, FR actif, éditeur FR et saisie hors ligne. Cache 0.21.1-1 actif, six modules.
**Public : 7118/7118**, zéro erreur JS/requête externe, sept fichiers modifiés identiques au disque ; parcours de description
conservée dans fiche/livre, FR actif, éditeur FR, hors ligne et cinq largeurs vérifiés à nouveau sur GitHub Pages.
Preuves `suite-publique.resultat.json`, `fichiers-publics.resultat.json`, `pages-build-code.json`, `apres-public/resultat.json`.
Profil jetable, description saisie manuellement ; aucun appel réel assistant ni compte privé. Le sens exact de « français simple »
(description courte ou traduction intégrale) reste demandé à Neegan, sans réponse supposée.

**29 octobre 2026 — MISE À JOUR D’UNE INSTALLATION 0.20.0 VÉRIFIÉE.**
Sur une même origine locale `/mistu/`, Chrome en profil jetable passe du commit publié `d832528` au commit `9faa1bf`.
Avant rechargement, l’onglet garde bien son code 0.20.0 même après activation du nouveau service worker ; après rechargement en ligne,
Réglages affiche 0.21.0. Recette, version culinaire, notes permanentes, observations, session et empreintes des deux photos sont identiques.
Seul le cache `cuisine-os-v0.21.0-1` reste, actif et contrôlant avec les six modules. Hors ligne après rechargement : photo personnelle
prioritaire décodée, note affichée, cuisine reprise à la seconde étape. Zéro erreur JavaScript et zéro requête externe.
Preuve : `.superpowers/sdd/2026-10-29-mise-a-jour/resultat.json` ; harnais `verifier.cjs`. Aucun changement applicatif nécessaire.
Cette vérification complète le profil neuf utilisé pour la publication ; elle ne prouve pas le transfert sur le compte et les appareils réels.
Retour reçu de Neegan le 29 octobre : oui, les photos apparaissent maintenant sur l’ordinateur. Les formats et appareils exacts ne sont pas documentés.

**28 octobre 2026 — PHOTOS, DESCRIPTIONS ET TEMPS : PUBLIÉ ET VÉRIFIÉ, 0.21.0.**
[Spec](docs/superpowers/specs/2026-10-28-interface-visuelle-recettes-design.md) approuvée sur « ok go », branche `interface-visuelle-recettes`, base `d832528`.
[Plan et preuves](docs/superpowers/plans/2026-10-28-interface-visuelle-recettes.md), [revue visuelle](design-qa.md).
Les cinq fichiers fournis par Neegan restent à l’identique dans `docs/lots/2026-10-28-interface-visuelle/`.

Les photos visibles se récupèrent par le moteur existant ; une photo personnelle distante reste prioritaire. Gestion photo depuis les
listes et fiches, y compris les références sans version. Description française, difficulté, durées avec origine et attentes, corrections
manuelles hors ligne et proposition explicite « 1 appel » avec relecture. Aucune génération automatique à l’import. Les corrections
périmées ne se réactivent pas sur une nouvelle version. Badge et filtre Rapide utilisent le total complet courant. Recherche, repas et
exports partagent cette lecture ; les versions culinaires et plans TM7 restent intacts. Livre en onglets Recettes/Pages source, cuisine
centrée sur l’étape avec ingrédients repliés et navigation persistante.

Version publiée `0.21.0`, cache `cuisine-os-v0.21.0-1`, DB 4. Six modules neufs ; aucun magasin, outil serveur, déploiement de fonction ou SQL.
**Publication faite sur « go deploy » de Neegan.** Commit de code `af85c6f`, intégration en avance rapide dans `main`, push réussi.
GitHub Pages a construit ce commit le 28 octobre à 22 h 43 HAE (29 octobre à 02 h 43 UTC).

**Preuves publiques :** [Mistu](https://neegans.github.io/mistu/) en **0.21.0**, suite **7080/7080**, zéro erreur JavaScript et zéro
requête hors origine. Neuf fichiers publics identiques au disque ; cache `cuisine-os-v0.21.0-1` actif et contrôlant, six modules présents.
Profil jetable sans compte : description manuelle conservée après rechargement, photo ajoutée à une référence sans version puis décodée
hors ligne, progression cuisine conservée après ouverture photo et rechargement hors ligne. Fiche sans débordement à 320/390/768/1280.
Preuves : `.superpowers/sdd/2026-10-28-interface-visuelle/suite-publique.resultat.json`, `publication.resultat.json`,
`pages-build-code.json` et `captures-publication/`. Aucun accès aux données privées ni appel réel à l’assistant.

**Validation locale :** navigateur **7080/7080** (épingle 7079 ; départ 6820, +242 assertions ciblées et +18 contrôles i18n des six modules,
aucune assertion retirée), Node **230/230**, migrations `--check` **0**, syntaxe de 119 fichiers JS et `git diff --check` propres.
Zéro erreur JavaScript et requête hors origine. Suites ciblées : repères 87, photos 48, journal 45, écran repères 39, intégration 23.
Deux bases et deux vrais moteurs avec serveur/stockage simulés : métadonnées reçues, photo personnelle téléchargée à visibilité et
décodée sans clic, malgré une image du livre déjà locale. Régression corrigée : si la première vue d’une réception partagée disparaît,
la vue encore visible continue. Photos hors ligne/pause/erreur/compte et écritures concurrentes couvertes.
Parcours réel en profil jetable : correction manuelle et photo conservées après rechargement, anglais, pages source à zéro,
étape conservée après ouverture photo et rechargement hors ligne. Cache actif et six modules présents. Captures 320/358/390/768/1280
sans débordement ; comparaisons aux maquettes dans `design-qa.md`. Preuves ignorées par Git : `.superpowers/sdd/2026-10-28-interface-visuelle/`.

**Non prouvé :** vrai appel assistant, Safari/iPhone physique et transfert sur les deux appareils de Neegan. Le
[diagnostic initial](docs/lots/2026-10-28-photos-mobile-ordinateur.md) prouve un défaut logiciel, pas la cause exclusive du cas réel.
À vérifier sur les appareils de Neegan : même version/compte sur mobile et ordinateur, puis transfert d’une photo de plat JPEG et d’une page
source au format réellement utilisé. Les chiffres et photos des fixtures ne sont jamais ajoutés aux données de Neegan.

**28 octobre 2026 — LOT I3 « CHEF THERMOMIX » : PUBLIÉ ET VÉRIFIÉ SUR LE SITE PUBLIC.**
[Spec approuvée sur « go »](docs/superpowers/specs/2026-10-28-chef-thermomix-design.md),
[plan et preuves](docs/superpowers/plans/2026-10-28-chef-thermomix.md). Branche `chef-thermomix`, base `34105d2`.
Sélection d’étapes → adaptation proposée par l’assistant → comparaison et relecture → nouvelle version, original conservé.
Brouillon reprenable, questions/refus, limites TM7 NA 120 V, manuel et vapeur seulement, sans chauffe ou 100 °C.
Les réglages estimés restent liés aux quantités source ; un changement de portions bloque la cuisson et la copie, une correction manuelle
invalide le plan. Fiche, repas, session reprise, exports JSON-LD/Paprika/HTML et sauvegarde ZIP utilisent le lecteur de plan.
« Copier pour Cookidoo » fournit titre, ingrédients, étapes et texte complet, avec repli sélectionnable. Aucun envoi au robot.

**État publié :** `APP_VERSION 0.20.0`, service worker `cuisine-os-v0.20.0-1`, `DB_VERSION` 4, six modules neufs dans le cache.
Aucun magasin, outil serveur, déploiement de fonction ni SQL nouveau. **Publication faite sur « promote tout » de Neegan.**
Commit de code `9fb825d`, intégration en avance rapide de `chef-thermomix` dans `main`, push réussi. GitHub Pages a construit ce commit
le 28 octobre à 20 h 42 HAE (29 octobre à 00 h 42 UTC).

**Preuves publiques :** [Mistu](https://neegans.github.io/mistu/) en **0.20.0**, suite **6820/6820**, zéro erreur JavaScript et zéro
requête hors origine. Neuf fichiers publics identiques au disque (version, cache, point d’entrée et six modules nouveaux). Cache
`cuisine-os-v0.20.0-1` actif avec les six modules. Profil jetable sans compte : adaptation conservée, copie complète, rechargement de fiche
et cuisine rechargée hors ligne réussis ; réponse assistant simulée. Captures mobiles sans débordement. Preuves :
`.superpowers/sdd/2026-10-28-chef-thermomix/suite-publique.resultat.json` et `publication.resultat.json`.

**Preuves locales :** navigateur **6820/6820** (épingle **6819**, départ I2 **6503/6503**, aucune assertion retirée),
Node **230/230** en série, migrations `--check` **0**, syntaxe des 36 fichiers JS contrôlée et `git diff --check` propre.
Zéro erreur JavaScript et zéro requête externe dans la suite. Suites I3 ciblées : domaine **132**, journal **66**, écrans **55**, intégration **52**.
Navigation réelle : relecture puis conservation, copie complète Cookidoo, rechargement de fiche, lancement et rechargement hors ligne
du mode cuisine réussis. Cache `0.20.0-1` actif. Captures 320/390/768/1280 pixels sans débordement, fiche anglaise vérifiée.
Zéro erreur JavaScript et zéro requête externe dans ce parcours ; assistant simulé. Preuves ignorées par Git dans
`.superpowers/sdd/2026-10-28-chef-thermomix/` (`suite.resultat.json`, `parcours.resultat.json`, captures).
Revue croisée : contenu des contenants contrôlé avant réglage, anciens blocs liés au texte et aux minuteries, conservation idempotente
liée au journal exact, portions inconnues conservées et création de session conditionnée en transaction. Les exports globaux refusés
affichent les versions à revoir avant toute génération de fichier.

**Non prouvé :** réponse d’un vrai appel assistant, usage du TM7, balisage et synchronisation sur le compte Cookidoo canadien,
Safari/iPhone physique et deux appareils connectés. Recettes créées synchronisables vers TM7 selon la documentation officielle ;
Recipe Handover / « Send to Thermomix » les exclut. Les réglages offerts dans l’éditeur restent à vérifier sur le compte de Neegan.
**Suite pour Neegan :** recharger Mistu sur ses appareils pour passer à `0.20.0`, puis essayer une recette sur Cookidoo et le TM7.

**28 octobre 2026 — LOT I2 « LIVRE SANS SAISIE, PHOTOS ET NOTES ».** Spec
[`docs/superpowers/specs/2026-10-28-livre-sans-saisie-design.md`](docs/superpowers/specs/2026-10-28-livre-sans-saisie-design.md)
approuvée par Neegan (« ok go enchaine »). Construction sur `livre-sans-saisie`, base `baa7822`, dans `~/projects/mistu`, serveur local 8102.
ISBN : bibliothèque → catalogue → relais Web visible, au plus un appel assistant. Photo de livre : lecture puis Web, au plus deux appels.
Brouillon repris sans appel automatique, corrections conservées, sources par champ, complément d’une édition existante.
Image du plat proposée dans la même extraction, cadrage local rectangulaire, confirmation avant écriture ; pages originales conservées.
« J’ai cuisiné ce plat », formulaire par recette en fin de repas, photos liées à la cuisson, observations corrigeables, « Mes notes » permanentes.
Photo personnelle prioritaire sur les cartes et la fiche, image du livre séparée ; fichiers synchronisés et conservés dans les archives.
Version publiée `0.19.0`, service worker `cuisine-os-v0.19.0-1`, `DB_VERSION` 4 ; aucun magasin, outil serveur ou SQL nouveau.
**Vérifications :** navigateur **6503/6503** (épingle **6502**, départ 6246/6246, aucune assertion retirée), Node **230/230**, migrations
`--check` **0**, `git diff --check` propre. Zéro erreur JavaScript et zéro requête externe dans le harnais navigateur.
Captures 320/390/768/1280 pixels sans débordement, ajout d’un livre puis rechargement de sa fiche dans l’application réelle vérifiés.
**Publication faite sur le « go » de Neegan, après sa question sur le déploiement.** Commit de code `455b192`, intégration en avance rapide
de `livre-sans-saisie` dans `main`, push réussi ; GitHub Pages a construit ce commit le 28 octobre à 22 h 19 UTC.
Sur [le site public](https://neegans.github.io/mistu/) : **6503/6503**, zéro erreur JavaScript et zéro requête hors origine dans le harnais.
Dix fichiers servis comparés aux fichiers locaux, tous identiques (version, point d’entrée et sept modules nouveaux).
Service worker actif, cache `cuisine-os-v0.19.0-1` installé avec les nouveaux écrans ; ajout d’un livre, rechargement puis rechargement
hors ligne réussis dans un profil jetable sans compte. Preuves : `.superpowers/sdd/2026-10-28-livre-sans-saisie/suite-publique.resultat.json`
et `publication.resultat.json`. Aucun déploiement de fonction ni migration SQL.

**Non prouvé sur données réelles :** identification de Trinity, recadrage proposé par le modèle, Safari/iPhone physique et transfert entre deux
appareils connectés. Les tests utilisent des bases jetables et un réseau factice ; aucun appel réel à l’assistant.
**Suite pour Neegan :** recharger l’application sur tous les appareils pour passer à `0.19.0`, puis jouer ces essais.
Le lot I3 Thermomix a ensuite été publié en `0.20.0` (voir en tête).

**28 octobre 2026, fin de journée — PASSATION À CODEX (VibeForge).** La suite (lots I2 « livre sans saisie, photos, notes » et I3 « chef
Thermomix ») est confiée à Codex dans VibeForge. Lire `AGENTS.md` (consignes) puis `docs/lots/2026-10-28-lot-I2-I3.md` (demandes de Neegan,
décisions, état du code, recherche Thermomix) et le document source `docs/lots/2026-10-28-correctifs-isbn-couverture-index.md`. Rien n'est
construit : une spec relue par Neegan avant chaque lot.

**28 octobre 2026 — LOT I1 « INDEX FIABLE » FUSIONNÉ ET POUSSÉ sur go de Neegan (rectification de Neegan, `~/Downloads/Mito_Rectification_Extraction_Index.md`).**
Branche `index-fiable`, worktree `~/projects/mistu-index`, base `main` `5388ff6`, serveur 8098 ; spec `docs/superpowers/specs/2026-10-28-index-fiable-design.md`
(rév. 2, rulings R-I1-1 à R-I1-17). Une lecture par page d'index ou de table des matières (une page dense relue en deux moitiés), les recettes certaines
écrites d'office dans le livre (une par titre, plages développées, rubriques réunies, triées par page), les contradictions, pages illisibles et lectures
d'un modèle hors liste (`claude-sonnet-5-5` minimum) laissées à la personne, personnes et matériel écartés ; « Retirer ces {n} recettes » ; saisie à la
main ; « Pivoter » ; libellés B04 (« {n} modifications à envoyer », « Photos : k/n sauvegardées sur le serveur »). L'ancien panneau d'index du lot C
est retiré. Suite 6246/6246 (épingle 6245, en baisse depuis 6389 : les blocs d'écran de l'ancien panneau partent avec lui), Node 230/230, `--check` 0 ;
revue adverse inline (une double tape ne crée plus deux fiches, deux onglets n'enregistrent qu'une fois, une saisie démesurée ne fige plus l'écran) ;
mutants 21 joués, 20 rouges, un équivalent. **Aucune lecture réelle.** Fusion en avance rapide `5388ff6..7558ff2`, push HTTPS, Pages servi (`cuisine-os-v0.18.0-1`, `APP_VERSION 0.18.0`), suite
publique 6246/6246 (seul le 404 de `/favicon.ico`). **Suite** : preuve réelle sur le site
public (les six pages de Trinity : « Lire les 6 pages (6 appels) », attendu 95 titres uniques, la contradiction des choux dite ; puis trois pages
d'abord, trois ensuite) → lot I2.

**28 octobre 2026 — LOT « FIDÉLITÉ AUX MAQUETTES » (go de Neegan).** Branche `fidelite-maquettes` (worktree `~/projects/mistu-maquettes`, base `main`
`92db6a2`, serveur 8097) : thème (olive sombre `#454e3b`, serif système en 400, boutons à 8 px), cartes 8:5 sans badge ordinaire, bibliothèque en
onglets soulignés, fiche recette (titre en face de la photo, cases à cocher, autres gestes repliés, étoile), navigation du Mac en onglets texte dans la
barre, coquille sortie d'`app.js` (`src/ui/coquille.js`). Revue adverse à trois lentilles (6 Important, 13 Minor) corrigée ; rulings R-FM-1 à R-FM-9
(spec « expérience carnet » § 12) ; `sw.js -14`, épingle 6389. Captures maquette | avant | après :
`.superpowers/sdd/2026-10-28-fidelite-maquettes/captures/triptyque-*.png`. **Ensuite** : le document de Neegan « Mito — Correctifs d'import des livres
et des index » (`~/Downloads/Mito_Correctifs_ISBN_Couverture_Index_2026-10-28.md`, cas réel Trinity, six pages d'index 310-315) : lot I1 « index
fiable » (une lecture par photo, relance d'une page coupée, plages abrégées, consolidation par recette, tri par page, entrées non culinaires à part,
contradictions visibles, gestes explicites, B03 rotation, B04 compteurs) puis lot I2 « livre sans saisie » (relais web de l'ISBN et de la couverture,
mots-clés et cuisines proposés) ; diagnostic de B01 : toutes les photos partaient en UNE lecture plafonnée à 8 000 jetons (`MAX_TOKENS_INDEX`), une
page dense d'index par ingrédients suffit à la couper.

**28 octobre 2026 — UI-1 « CARNET » CLÔTURÉ, FUSIONNÉ (commit de fusion sur `1cb5dde`) et POUSSÉ.** Clôture du chef : rulings R-UI-61 à
R-UI-65 (spec § 12 ; R-UI-5, la couleur du badge « Créée avec l’IA · non testée », renvoyée à Neegan : § 13, point 7) ; `/verify` sur `a60f8ba` :
suite 6226/6226, Node 208/208 (en série ; un rouge de durée sous charge, R-B-15), `--check` 0, secrets et invisibles 0. Fusion : 17 conflits résolus
un par un selon R-UI-47 (0.17.0, `sw.js cuisine-os-v0.17.0-11`, `SHELL` avec `apercu-web.js` ET `icones.js`, `en.js` en union, `.plat-vignette.grande`
écrite une fois avec `figure.apercu` et `.plat-vignette.petite`, I-F3 étendu à `book.js` et `home.js`, `'loupe'` gardé dans `search.js`, `CLAUDE.md` et
`docs/architecture.md` avec les sections des deux lots) ; mesures sur l'arbre fusionné : suite 6375/6375 (épingle 6374 = 5947 + 149 de UI-2 + 278 de UI-1),
Node 230/230 (en série), `--check` 0, `tsc --strict` 0, `supabase/` inchangé depuis `1cb5dde`. Suite, dans l'ordre : Neegan colle `0007` et
joue sa preuve (`supabase/README.md`, étape 13 : `0 faux sur 11`) → le chef redéploie la fonction (version 5) et joue les sondes (S-A3, S17-S18,
S-F4-S-F5, S-A5 à S-A7 avec la session de Neegan : un appel du quota chacune, zéro jeton) → preuves § 10 UI-2 (« puttanesca » dans l'onglet Web) et
UI-1 (Bibliothèque, fiches, Aujourd'hui, l'iPhone) sur le site public, tous les appareils sur 0.17.0 → décisions (§ 13, dont le point 7 ; borne de
pixels et règle S-4 de UI-2) → « clean » (worktrees `mistu-apercus` et `mistu-carnet`, serveurs 8095 et 8096, après la copie des deux registres).

**28 octobre 2026, 1 h (HAE) — LOT UI-1 « EXPÉRIENCE CARNET » : FINI dans le worktree `~/projects/mistu-carnet` (branche `experience-carnet`, base `f3672be`
= `main` `05c751f` + trois commits de docs, spec rév. 2.1 `7633675` et le « Go » de Neegan `f3672be`, plan `ec0263d`, tête de code
`0fa52b4`, filets `1d952fe`, vague finale `88e095a` après la revue finale de branche, serveur 8096), six tâches (T1 jetons et composants, T2 bibliothèque sur les recettes, T3 fiche recette, T4 fiche livre, T5 Aujourd'hui /
Ajouter / import ciblé / libellés, T6 filets, preuve visuelle, docs ; rondes et re-revues : `progress.md`), `/verify` au chef
d'orchestre ; contrôles mécaniques après la vague finale (suite 6226/6226, épingle 6225, Node 208/208, `--check` 0, invisibles 0, aucune clé ; rapport `final-fix-report.md`), preuve visuelle VERT (70 lignes,
174 captures, contraste minimum 4,62 sur 3 601 nœuds, 0 requête hors origine ; onglet « Bibliothèque » d'une ligne à 375-768 px, et à 320 px sur la galerie
et dans l'app, actif, sans marge : 71,8/71,8 px), `sw.js cuisine-os-v0.17.0-10`, `APP_VERSION 0.17.0`, `DB_VERSION` 4, aucune
migration, aucun fichier sous `supabase/`. **PAS fusionné, PAS poussé.** Pour Neegan, dans l'ordre : le lot UI-2 est déjà fusionné et poussé (27 octobre ; ses gestes restants — `0007`, redéploiement,
sondes — sont dans le `STATE.md` de `main`) ; la fusion de `experience-carnet` par un commit de fusion (17 fichiers en conflit, MESURÉS par `git merge-tree`
le 28 octobre — `CLAUDE.md`, `STATE.md` et `docs/architecture.md` : garder les sections et paragraphes des DEUX lots ; `en.js` union ; `sw.js` union de
`SHELL` + `VERSION` `-11` ; `schema.js` et les pins 0.17.0 de huit suites ; `styles.css` et `tests/photo-plat.js` par R-UI1-1, et I-F3 étendu à `book.js` et `home.js` ; `tests/ajouter.js` et
`tests/tests.js` en union, l'épingle remesurée ; `search.js` garde `'loupe'` ; chaque résolution relue à la main : `CLAUDE.md`, geste 2, et spec R-UI-47), push, suite publique, preuve réelle § 10 UI-1
sur sa bibliothèque et sur l'iPhone (« Agrandir l'affichage » dit), les sept points de § 13 (défauts confirmés le 23 octobre, renversables), « clean »
après la copie du registre AVEC `captures/`. Registre `.superpowers/sdd/2026-10-23-experience-carnet/` ; rulings R-UI-1 à R-UI-60 dans la spec
§ 12 « Construction UI-1 : rulings » ; section du lot dans `CLAUDE.md` et `docs/architecture.md`.**

**27 octobre 2026 — UI-2 CLÔTURÉ, FUSIONNÉ et POUSSÉ** (`main` en avance rapide depuis `05c751f` jusqu'au commit de clôture ; spec § 12, R-UI2-18 à
R-UI2-24) : `/verify` de clôture VERT sur `ecfc19b` (suite ✅ 6097/6097, épingle 6096 ; Node 230/230 ; `--check` 0 ; `tsc --strict` 0 ; secrets et
invisibles 0 ; `verify-UI2-ecfc19b.txt`) ; Neegan avait autorisé la fusion et le push à la fin du lot : ils précèdent `0007`, sans coût (la version 4 refuse
l'outil `apercu-web` en 400 `requete` avant toute réservation ; l'onglet Web dit « Photos indisponibles pour cette recherche. » jusqu'au redéploiement).
Suite, dans l'ordre : Neegan colle `0007` et sa preuve (`supabase/README.md`, étape 13 : `0 faux sur 11`) → le chef redéploie la fonction (version 5)
et joue les sondes (S-A3, S17-S18, S-F4-S-F5, S-A5 à S-A7 avec la session de Neegan : un appel du quota chacune, zéro jeton) → preuve § 10 UI-2 sur
le site public. Le lot UI-1 « Carnet » est en construction (`experience-carnet`, tâches 1 à 3 commises et relues) ; il fusionnera par un commit de
fusion (0.17.0).

**26 octobre 2026, 12 h 45 — VAGUE FINALE de UI-2 faite** (revue finale de branche sur `b5a61a6` : 4 Important, 9 Minor ; rapport
`.superpowers/sdd/2026-10-23-apercus-web/final-fix-report.md` ; spec § 12, VF-UI2-1 à VF-UI2-13) : aucun vol d'aperçus pendant une recherche en vol ;
images animées ou tronquées refusées sans décodage ; branchement par défaut et vraie route prouvés par test ; preuve `0007` jamais verte sans compte
(empreinte `f072ccce…`). Mesures : suite `6097/6097` (épingle 6096), Node 230/230 (bruit de temps `portionsDe` du lot B sous charge, R-B-15), `--check` 0,
`sw.js cuisine-os-v0.16.0-3`. Restent au chef : `/verify` de clôture (« vert conditionnel »), puis la suite ci-dessous ; à Neegan, en plus : la borne de
pixels d'un aperçu (§ 11), et la règle S-4 (garder un vol d'aperçus déjà envoyé au changement de route, ou repayer au retour).

**26 octobre 2026, 10 h 45 — LOT UI-2 « APERÇUS DES RÉSULTATS WEB » : CONSTRUIT (tâches 1 à 3), clôture à faire (re-revue de la ronde 1 de S2,
revue finale de branche, `/verify`) ; dans le worktree `~/projects/mistu-apercus` (branche `apercus-web`, base
`f3672be` = `main` `05c751f` + la spec « expérience carnet » rév. 2.1 `7633675` + le « Go » du 23 octobre `f3672be` ; plan
`docs/superpowers/plans/2026-10-23-apercus-web.md` (rév. 2, `daca8b3`) ; tête de code `16dd810` ; serveur 8095), trois tâches (S1 serveur `654e63d`
et sa ronde `c8b07f5`, S2 client `a1720bc` et sa ronde `16dd810`, S3 docs `99855cd` et sa ronde 1 = ce commit) ; rulings du chef R-UI2-1 à R-UI2-17 (25 octobre ; P-UI2-6 et
P-UI2-7 amendés, P-UI2-10 renversé : `styles.css` porte `.plat-vignette.grande` et `figure.apercu`) ; re-revue de la ronde 1 de S2, revue finale de branche et
`/verify` (« vert conditionnel ») : à la clôture du chef d'orchestre, AVANT `0007` ; mesures à la tête : suite `6080/6080` (épingle 6079, `tests/tests.js:255`), Node `230/230`, `--check` 0,
`tsc` 0, `sw.js cuisine-os-v0.16.0-2`, `APP_VERSION 0.16.0`, `DB_VERSION` 4 ; `0007_apercu_web.sql` ÉCRITE (à coller par Neegan : README étape 13 ;
empreinte `70168ef8…`), fonction `assistant` À REDÉPLOYER (sixième outil `apercu-web` ; geste du chef d'orchestre APRÈS la `0007` collée et prouvée).
**PAS fusionné, PAS poussé.** Dans l'ordre : le chef d'abord (re-revue de la ronde 1 de S2, revue finale, `/verify` « vert conditionnel ») ; puis
Neegan : `0007` + preuve (`0 faux sur 11`, aucune ligne « aucun compte : etape sautee », 2.032 = `id non nul`) ; puis le chef : redéploiement depuis
la tête vérifiée (recul : la version 4 depuis `0c7cbbd`), sondes (S17, S18, S-F4, S-A3 et S-A5 à S-A7 : un appel du quota chacune, zéro jeton ; les
autres sans dépense) ; ronde « borne 2 Mio » si S-A5 l'impose (puis `/verify` et redéploiement de sa tête) ; `git merge --ff-only apercus-web` (si
`main` est encore `05c751f` ; sinon un commit de fusion, UI-2 renuméroté 0.17.0), push, suite publique `6080/6080` (avance rapide ; sinon remesurée
sur l'arbre fusionné), preuve § 10 UI-2 (« puttanesca » : la ligne « Photos en cours de récupération… » puis les photos d'un coup ;
`assistant_usage_jour` +2 par recherche), tous les appareils sur 0.16.0 (0.17.0 si UI-1 a fusionné d'abord), iPhone, décisions (à ratifier par le chef d'orchestre : E-UI2-2, E-UI2-13, E-UI2-14, E-UI2-16 ; à trancher par Neegan : la borne 1 ou 2 Mio (B-M-6),
`PARALLELISME_APERCU` (S-2), le mode automatique ou la tape « Voir les photos (1 appel) » (§ 13 point 2), la borne de pixels d'un aperçu, R-UI2-8),
« clean ». Registre `.superpowers/sdd/2026-10-23-apercus-web/` (copie
dans `~/projects/mistu/.superpowers/sdd/`) ; rulings dans la spec § 12, sous-titre « Construction de UI-2 ». En parallèle : UI-1 « Carnet » en
construction (branche `experience-carnet` sur `f3672be` ; worktree `~/projects/mistu-carnet`, serveur 8096, `APP_VERSION 0.17.0` pendant la
construction ; tâche 1 commise `8b5c6d2`) ; le second lot fusionné résout les fichiers communs (spec § 9 : `sw.js`, `schema.js` et les pins, `en.js`,
`tests/tests.js` ; plus `styles.css` et l'épingle de `tests/photo-plat.js`, R-UI2-9).**

**23 octobre 2026, 17 h 30 — CHAÎNE A → F EN LIGNE.** Points 1 à 4 du bilan `.superpowers/sdd/nuit-2026-10-18/BILAN-CHAINE-A-F.md` faits le 23 octobre
: `0005` (35 verdicts, 0 faux) et `0006` (10 verdicts, 0 faux) collées et prouvées par Neegan ; fonction `assistant` redéployée en version 4 depuis
`0c7cbbd` (`lecture-web` + `image-web`) et sondée (S1-S9 rejouées, `GET` d'état `cles: nouvelles`, S13-S19, S-F1 à S-F5 : tout conforme, 4 appels du
quota, zéro jeton ; `supabase/proofs/RESULTATS-mitsu.md`) ; fusions simples dans l'ordre B `e973321`, G `d962193`, C `b02fe50`, D `c8a0491`, E
`017f94d`, F `d2424c4` (pas d'avance rapide : `main` portait la preuve `0005` ; un seul conflit, `RESULTATS-mitsu.md` à la fusion de B, composé et
relu ; chaque arbre identique à la branche vérifiée hors ce fichier) ; suite publique 3694 → 4743 → **5948/5948** (`cuisine-os-v0.15.0-9`). Les points
5 et 6 (sonde R-D-8 et preuve § 10 de E sur les serveurs locaux) ont été **sautés sur décision de Neegan** (« non je fais confiance, enchaine ») :
rulings R-D-29 et R-E-40 (`2f15d2e`). Les sept serveurs locaux sont arrêtés ; les worktrees des lots restent en place jusqu'au « clean ». **Reste à
Neegan** : tous les appareils sur 0.15.0 avant tout geste réel ; les preuves réelles sur le site public (C § 10, A § 10, D § 10 pas 1 à 8, E § 10, F §
10, G sur deux appareils ; `select … from public.assistant_usage_jour` avant et après chaque appel), chaque borne révélée = un commit borné sur
`main`, reculable ; les décisions ouvertes (VF-16, R-G-28, C § 13, R-D-26, R-E-37, F § 13) ; révoquer l'ancienne clé Anthropic ; « clean » (worktrees
des sept lots, `STATE.avant-web.md`, scratchpad). Les blocs ci-dessous décrivent chaque lot tel qu'il était à sa clôture.

**23 octobre 2026, 14 h 04 — LOT F « LES PLATS EN IMAGES » : FINI dans le worktree `~/projects/mistu-plats-en-images` (branche `plats-en-images`,
base = la tête finale du lot E `5ec092c`, spec `35fb29c` (rév. 3) puis rév. 4 à la clôture, plan rejoué `111f857`, tête de code `b65988f`, serveur
8094), cinq tâches (une ronde chacune, re-revues propres ; vague finale, re-revue PROPRE), revue finale à trois lentilles (2 Important et 9 Minor : la
vague `b65988f` les traite tous (VF-F1 à VF-F8), re-revue PROPRE ; rulings de construction R-F-19 à R-F-29), `/verify` mécanique VERT (suite
5948/5948, épingle 5947, Node
208/208, `--check` 0, `tsc` 0, invisibles 0, aucune clé), `sw.js cuisine-os-v0.15.0-9`, `APP_VERSION 0.15.0`, aucune migration, fonction `assistant` À
REDÉPLOYER
(cinquième outil `image-web` ; geste du chef d'orchestre après la `0006` collée et prouvée par Neegan avec le lot B). **PAS fusionné, PAS poussé.**
**La chaîne A → B → G → C → D → E → F est COMPLÈTE** : six lots empilés sur `main`, aucun fusionné. Pour Neegan, dans l'ordre : les gestes des lots A,
B, G, C, D et E (ci-dessous) ; puis le redéploiement d'`assistant` et les sondes S-F1 à S-F5 (chef) ; `git merge --ff-only plats-en-images`, push,
suite publique 5948/5948, preuve § 10 (première photo web réelle, deux appels), tous les appareils sur 0.15.0, iPhone, trois choix de la spec § 13,
« clean ». Registre `.superpowers/sdd/2026-10-19-plats-en-images/` (copie dans `~/projects/mistu/.superpowers/sdd/`) ; rulings R-F-7 à R-F-29 dans
la spec § 12 « Rév. 3 → rév. 4 » ; ce qui reste au § 13. **FIN DE LA CHAÎNE** : A → B → G → C → D → E → F construits et clos ; aucun lot en Départ.**

**23 octobre 2026, 4 h 59 — LOT E « UN LIVRE RECONNU DEPUIS SA COUVERTURE » : FINI dans le worktree `~/projects/mistu-couverture-lue`
(branche `couverture-lue`, base = la tête finale du lot D `619e6c0`, spec `209de95` (rév. 6) puis rév. 7 à la clôture, plan rejoué `2bb855a`,
tête de code `1e5e61b`, serveur 8093), cinq tâches (1, 2, 3a, 3b, 4 ; une ronde chacune, re-revues propres ; vague finale puis ronde de clôture),
revue finale à trois lentilles (3 Important et 11 Minor : la vague `f814f13` / `8934f07` corrige 3 Important et 8 Minor, nomme 2 limites (§ 11),
ratifie 2 choix ; re-revue A_CORRIGER (constat 2 en partie, 1 Minor neuf) → ronde de clôture `784e7cf` puis `1e5e61b` (tests seuls) (`sw.js -12`,
épingle 5678 puis 5680, 5681/5681, mutants 20/20 puis RA5 rouge sur les deux assertions neuves (`❌ 5679/5681`), RA1 et RA3 restent rouges, X1 du
relecteur rouge ; témoins verts sur 8298 et 8398-8399), re-revue de la ronde 1 A_CORRIGER (quatre points fermés, un faux-vert neuf RA5) puis, après la
ronde 2 tests seuls `1e5e61b`, **PROPRE** (0 restant, 0 neuf) ; rulings de construction R-E-30 à R-E-39),
`/verify` mécanique VERT (suite 5681/5681, épingle 5680, Node 174/174, `--check` 0, invisibles 0, aucune clé), `sw.js cuisine-os-v0.14.0-12`,
`APP_VERSION 0.14.0`, aucune migration, serveur `assistant` intact. **PAS fusionné, PAS poussé.** Pour Neegan, dans l'ordre : les gestes des lots A, B,
G, C et D (ci-dessous) ; puis la **preuve réelle § 10 sur la branche servie localement, AVANT la fusion** (`ASSISTANT_ORIGINES` =
`https://neegans.github.io,http://localhost:8093` — les deux origines — et `http://localhost:8093/**` aux Redirect URLs, le temps de la preuve ; les
sept points de § 10 ; une limite révélée amende la consigne § 3.3 et la table § 3.2 par une ronde avant la fusion ; autres appareils fermés) ;
`git merge --ff-only couverture-lue`, push, suite publique 5681/5681, tous les appareils sur 0.14.0, iPhone, « clean ». Registre
`.superpowers/sdd/2026-10-19-couverture-lue/` (copie dans `~/projects/mistu/.superpowers/sdd/`) ; rulings R-E-16 à R-E-39 dans la spec § 12
« Rév. 6 → rév. 7 » ; ce qui reste au § 13. Prochain : Départ F « Les plats en images » sur cette tête (worktree `~/projects/mistu-plats-en-images`,
8094, `APP_VERSION 0.15.0`, tâche 1 serveur `image-web`).**

**22 octobre 2026, 18 h 18 — LOT D « UN LOT DE RECETTES PHOTOGRAPHIÉES » : FINI dans le worktree `~/projects/mistu-recettes-en-lot`
(branche `recettes-en-lot`, base = la tête finale du lot C `739e706`, spec `4db4d8e` (rév. 4) puis rév. 5 à la clôture, plan rejoué `d42d4ab`,
tête de code `c90f527` (docs de la vague `1046c64`, vérifiée)`, serveur 8092), six tâches (T1 à T4 une ronde chacune, T5 deux, T6 une ; re-revues
propres), revue finale à trois lentilles (2 Important et 13 Minor : la vague `c90f527` / `1046c64` corrige les 2 Important et 10 Minor, en ratifie 1,
en nomme 1, en porte 1 à Neegan (la photo d'index dans un groupe, § 13) ; re-revue PROPRE ; rulings de construction R-D-20 à R-D-28),
`/verify` mécanique VERT (suite 5228/5228, épingle 5227, Node 174/174, `--check` 0, invisibles 0, aucune clé), `sw.js cuisine-os-v0.13.0-11`,
`APP_VERSION 0.13.0`, aucune migration, serveur `assistant` intact. **PAS fusionné, PAS poussé.** Pour Neegan, dans l'ordre : les gestes des lots A, B,
G et C (ci-dessous) ; puis la **sonde R-D-8 sur la branche servie localement, AVANT la fusion** (origine `http://127.0.0.1:8092` ajoutée à
`ASSISTANT_ORIGINES` le temps de la sonde ; pas 1, 2, 7 et 8 de la spec § 10 ; mesures en § 12, qui peuvent amender `MAX_PHOTOS_CLASSEMENT`,
`CLASSER_SYSTEM` ou rouvrir R-D-1 par une ronde) ; `git merge --ff-only recettes-en-lot`, push, suite publique 5228/5228, parcours § 10 complet
sur le site public, iPhone, « clean ». Registre `.superpowers/sdd/2026-10-19-recettes-en-lot/` (copie dans `~/projects/mistu/.superpowers/sdd/`) ;
rulings R-D-13 à R-D-28 dans la spec § 12.C ; dettes au § 13. Pendant la sonde R-D-8, les autres appareils restent fermés ; après la fusion, tous sur
0.13.0 avant le premier classement réel (R-D-27). Prochain : Départ E « Couverture lue » sur cette tête (worktree `~/projects/mistu-couverture-lue`,
8093, `APP_VERSION 0.14.0`).**

**21 octobre 2026, 16 h 49 — LOT C « TABLE DES MATIÈRES SUR PLUSIEURS PAGES » : FINI dans le worktree `~/projects/mistu-table-des-matieres`
(branche `table-des-matieres`, base = la tête finale du lot G `1e4d68d`, spec `a9e75ca` (rév. 6) puis rév. 7 à la clôture, plan rejoué `f575d3d`,
tête de code `e305355`, serveur 8091), six tâches en une ronde chacune (re-revues propres), revue finale à trois lentilles (6 Important et 18 Minor, tous fermés ou nommés : vague `0b9ba10` + ronde de clôture `e305355`, rulings R-C-15 à R-C-38),
`/verify` mécanique VERT (suite 4743/4743, épingle 4742, Node 174/174, `--check` 0, invisibles 0, aucune clé), `sw.js cuisine-os-v0.12.0-12`,
`APP_VERSION 0.12.0`, aucune migration, serveur `assistant` intact. **PAS fusionné, PAS poussé.** Pour Neegan, dans l'ordre : les gestes des lots A, B
et G (ci-dessous) ; puis `git merge --ff-only table-des-matieres`, push, suite publique 4743/4743, preuve réelle § 10 de la spec C (une table des
matières sur 3 à 5 photos lue en un appel : durée, coupe, fidélité, jetons — avant la fusion, elle peut amender `MAX_TOKENS_INDEX`), iPhone,
« clean ». Registre `.superpowers/sdd/2026-10-19-table-des-matieres/` (copie dans `~/projects/mistu/.superpowers/sdd/`) ; rulings R-C-8 à R-C-38
dans la spec § 12.3 ; dettes au § 13.**

**20 octobre 2026, 23 h 30 — LOT G « LES PHOTOS VOYAGENT ENTRE APPAREILS » : FINI dans le worktree `~/projects/mistu-photos-entre-appareils`
(branche `photos-entre-appareils`, base = la tête finale du lot B `cf91f09`, spec `3601a52`, plan rejoué `c227711`, tête de code `222b3a5` — la vague
finale `c42693f`, faite INLINE par le chef d'orchestre parce que la limite de dépense avait refusé l'agent de vague, a été RE-REVUE à trois lentilles puis
complétée par la ronde 2 `222b3a5` (R-G-31, R-G-24 bis, R-G-28 bis) et sa re-revue ciblée ; les commits de spec et de docs suivent —, serveur 8090), six tâches en une ronde chacune (re-revues propres), revue finale à trois lentilles (4 Important et 15 Minor, tous fermés
ou nommés : R-G-24 à R-G-29), `/verify` mécanique VERT (suite 4403/4403, épingle 4402, Node 174/174, `--check` 0, invisibles 0, aucune clé),
`sw.js cuisine-os-v0.11.0-14`, `APP_VERSION 0.11.0`, aucune migration. **PAS fusionné, PAS poussé.** (La re-revue due par R-G-30 est FAITE le 20 octobre au soir.) Pour Neegan, dans l'ordre : les gestes des lots A
et B (ci-dessous) ; puis `git merge --ff-only photos-entre-appareils`, push, suite publique 4403/4403,
preuve « deux appareils » (spec G § 10 : images réellement ouvertes sur le second appareil, pas seulement leurs pointeurs), décision R-G-28 (refuser
« Effacer les données » tant que des photos restent à envoyer ?), « clean ». Registre `.superpowers/sdd/2026-10-19-photos-entre-appareils/`
(copie dans `~/projects/mistu/.superpowers/sdd/`) ; rulings R-G-7 à R-G-32 dans la spec § 12 ; dettes au § 13.**

**20 octobre 2026, 05 h 30 — LOT B « RECETTE WEB COMPLÈTE » : FINI dans le worktree `~/projects/mistu-recette-web` (branche `recette-web`, base = la
tête finale du lot A `2b6a2fd`, tête de code `51bad50` (le dernier commit de code ; le suivent deux commits de spec, `7df269e` : rulings R-B-17 à
R-B-28 et amendements de clôture, et `76d88dd` : bilan des mutants vérifiable, R-B-22 bis, heure du Départ ; puis le commit de clôture qui pose ces
documents), serveur 8089), revu (six tâches à trois lentilles, une ronde chacune, re-revues propres ; revue finale de branche, 4 Important et 10
Minor : la vague finale `d8163be` + `ebbcf10` ferme les 4 Important et 8 Minor (compte de son rapport), le Minor `portionsDe`, refusé par la vague,
est tranché par R-B-22 à la ronde finale 2, les 2 Minor de documentation (R-B-11 « survivant », chiffres de `cloture.md`) sont fermés à la clôture ;
ronde finale 2 `51bad50` : R-B-22 `portionsDe`, R-B-23 alias de la fonction ; clôture du chef d'orchestre : rulings R-B-17 à R-B-28, puis R-B-22 bis),
PAS fusionné, PAS poussé, `0006` PAS collée, fonction `assistant` PAS redéployée (la version 3 du lot 4 sert toujours) ; `/verify` de clôture par le
chef d'orchestre.** Pour Neegan : un lien web gardé devient une vraie recette — « Lire la recette avec l’assistant » sur la fiche du lien, ou « Garder
et lire » sous une carte de l'onglet Web (le lien gardé et lu d'un geste) ; la fonction `assistant` télécharge la page (jamais le téléphone), lit
d'abord les données que le site publie (JSON-LD `Recipe` : « Lue dans les données de la page : aucun jeton dépensé. »), et seulement sinon fait lire
le texte par le modèle ; l'écran dit « Lue sur {hôte} — vérifie avant d’enregistrer. », l'hôte réel toujours d'abord, le site et l'auteur ensuite sous
« Selon la page : … » ; « Enregistrer » fait du lien la recette (à la première lecture, le titre lu devient son titre), toutes les lignes « à
vérifier » ; « Ouvrir le lien » reste sur toute fiche venue du web ; une adresse en `http:` n'est jamais lue (ni bouton de lecture ni « Réessayer » :
« Ouvrir le lien » et la phrase du refus ; « Garder et lire » n'est pas proposé) ; un échec (site injoignable ou qui refuse les robots, PDF, page trop
lourde ou vide) laisse le lien intact, dit pourquoi et offre « Réessayer » ; une version écrite à la main n'est jamais remplacée sans « Remplacer par
cette lecture ? » (« Ajouter sans remplacer » d'abord), mais une lecture ou une correction de l'assistant, même vérifiée, l'est sans question
(R-B-19) ; la même adresse gardée deux fois est dite, rien d'écrit ; la section « Imports » liste les lectures web, « Réessayer » compris depuis un
autre appareil ; chaque lecture compte pour un appel du quota (60 par jour par défaut, réglable par le secret `ASSISTANT_QUOTA_JOUR`), même sans
jeton. Chiffres : suite **3997/3997** (épinglé 3996 ; départ 3694/3694 ; vague 3997/3997), Node **172/172** sur `51bad50` (125 au
départ, 167 à la vague, 5 de plus à la ronde finale 2 ; registre `verify-51bad50.txt`), `--check` 0, `tsc` 0, pglast `0006` 4 instructions et preuve
12 instructions + 2 blocs `do`, `APP_VERSION 0.10.0`, `DB_VERSION 4`, `sw.js` `cuisine-os-v0.10.0-8`, tous les mutants nommés par la spec § 7.5 et par le plan (C1 à
C24, B1 à B8, T6a à T6j) rouges, aucun survivant (R-B-28 ; deux équivalents déclarés par la spec, M30r et « Annuler » web par `annulerVol`, un
troisième, R18b, au rapport de la tâche 4 ; 338 passages relevés dans les rapports hors ronde finale 2, 352 avec ses 14 mutants, tous rouges), 15
commits de code sur `e411779` (14 de construction jusqu'à `ebbcf10`, puis `51bad50`), puis les deux commits de spec. **Aucune lecture réelle** ;
`0006` jamais jouée sur `mitsu` ; `redirect: 'manual'` jamais mesuré sous le runtime Supabase (c'est la sonde S17). **Gestes, dans l'ordre :** (1)
**le lot A d'abord** (B est empilé sur A) : `0005` collée et prouvée (`0 faux sur 35`), adresse de preuve retirée,
`! git -C ~/projects/mistu merge --ff-only import-cible`, `! git -C ~/projects/mistu push origin main` (paragraphe du lot A, ci-dessous) ; (2) **AVANT
le redéploiement et AVANT tout `push` du lot B**, dans l'éditeur SQL de `mitsu` (`supabase/README.md`, étape 12) : coller
`supabase/migrations/0006_lecture_web.sql` entière (la contrainte `outil` à CINQ valeurs : `recherche-web`, `creation`, `extraction`, `lecture-web`,
`image-web`), puis, collée seule, `notify pgrst, 'reload schema';`, puis jouer la preuve `supabase/proofs/0006_lecture_web.sql` (« Run without RLS »,
rien à remplacer ; lire `999 BILAN` : attendu `0 faux sur 10`, verdict 2.031 `image-web` compris) et coller le tableau dans
`supabase/proofs/RESULTATS-mitsu.md` (section préparée) ; (3) le chef d'orchestre redéploie la fonction `assistant` (`index.ts` et `lecture-web.js`
ont changé depuis la version 3, en dernier dans `ebbcf10` et `51bad50` ; `supabase functions deploy assistant --project-ref ybdooerfeziiabsbfxtb
--no-verify-jwt --use-api`, la version suivante) et joue les sondes de l'étape 12 du README : S13-S16 et S1-S9 sans dépense, **S19** (R-B-23, R-B-22
bis : `https://ybdooerfeziiabsbfxtb.functions.supabase.co/` → 422 `interdit`, sans réservation ni dépense ; ni le README ni la table « Sondes
`lecture-web` » de `RESULTATS-mitsu.md` n'ont encore sa ligne : l'y ajouter), puis S17 (la sonde de redirection, R-B-14) et S18, un appel du quota
chacune sans dépense Anthropic — une redirection opaque à S17 impose une ronde sur `telechargerPage` avant la fusion ; (4)
`! git -C ~/projects/mistu merge --ff-only recette-web` puis `! git -C ~/projects/mistu push origin main` ; ouvrir
`https://neegans.github.io/mistu/tests/` et lire le BILAN (attendu : 3997/3997, plus le 404 de `/favicon.ico`) ; (5) preuve réelle sur le
site public, connecté : un lien web → « Garder et lire » (ou « Lire la recette avec l’assistant » sur un lien déjà gardé) : **un** POST
`/functions/v1/assistant` ; sur une page à JSON-LD, l'écran dit « Lue dans les données de la page : aucun jeton dépensé. » (sinon, une lecture par le
modèle : « Texte de la page lu par l’assistant. ») ; « Enregistrer » ; puis `select jour, appels from public.assistant_usage_jour;` (et, pour le
détail, la ligne `lecture-web` de `public.assistant_journal` : 200, 0 / 0 pour un JSON-LD) ; (6) iPhone (le même parcours depuis l'app installée) ;
(7) « clean » en dernier, **après** avoir copié le registre `.superpowers/sdd/2026-10-19-recette-web/` (hors git) dans
`~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet), puis `git worktree remove`. Non prouvé et dettes nommées (R-B-27 : identité du vol non
vérifiée aux écritures de fin, dans les deux machines ; deux machines de vol à garder alignées à la main ; fenêtre sans dialogue avant la transaction
d'« Enregistrer » ; entités 0x80-0x9F retirées ; DoS de regex mesuré sous Node seulement ; spec § 13 : sept points, deux ouverts à défaut appliqué et,
points 3 à 7, les dettes R-B-27) : `CLAUDE.md`, section « Recette web complète », et `docs/architecture.md`, section du lot.

**19 octobre 2026, 19 h 45 — LOT A « IMPORT CIBLÉ ET JOURNAL D'IMPORT » : FINI dans le worktree `~/projects/mistu-import` (branche `import-cible`,
base `main 57babc6`, tête `58bb49b` (dernier commit de code ; le commit de clôture qui pose ces documents le suit), serveur 8088), revu (six tâches à trois lentilles, revue finale de branche, vague finale VF-1 à VF-15, ronde
finale 2 et sa re-revue PROPRE, clôture du chef d'orchestre : m9, m12, m13 ratifiés, VF-16, VF-17), PAS fusionné, PAS poussé, `0005` PAS collée ;
`/verify` FAIT le 19 octobre à 17 h 40 (suite 3694/3694, Node 125/125, `--check` 0, invisibles 0, scan de secrets : deux noms de clés dans des tests, aucune valeur).** Pour Neegan : une recette « Repérée dans ton livre » s'importe depuis son propre écran (`#/recipes/<id>/importer` :
« Importer » sur la fiche du livre, « Importer cette recette » sur sa fiche) — pages photographiées ou choisies et remises dans l'ordre, photo du plat
facultative, puis « Extraire et enregistrer », qui écrit DANS la référence sans passer par l'éditeur (D-3) ; un titre lu qui ne concorde pas demande
« Rattacher quand même ? » avant d'écrire ; une version que tu as écrite n'est jamais remplacée sans « Remplacer par cette lecture ? » ; la section
« Imports », en tête d'Ajouter, garde chaque lecture payée (« Reprendre », « Relancer », « Annuler », « Ignorer ») ; une app fermée en plein vol dit
« La lecture a été interrompue… » au démarrage suivant (90 s), et les lignes terminées s'effacent après 30 jours. La ronde finale 2 a fermé le dernier
Important : « Relire les pages » ne reprend en tête que les pages dont les octets sont sur cet appareil, et une relecture qui ne couvre plus toute la
recette pose la question I-5 au lieu de remplacer d'office. Chiffres : suite **3694/3694** (épinglé 3693 ; départ 3011/3011), Node **125/125**,
`--check` 0, pglast `0005` 23 instructions + 4 fonctions et preuve 37 instructions + 2 blocs `do`, `APP_VERSION 0.9.0`, `DB_VERSION 4`, `sw.js`
`cuisine-os-v0.9.0-13`, 152 mutants joués (tous rouges sauf `hb-ignore`, déclaré équivalent, et M3, survivant nommé, pratiquement inatteignable), 16 commits de
construction sur `7fba2da`, plus la ronde finale 2 (`58bb49b`) et le commit de clôture de la spec. **Aucune extraction réelle** (la preuve § 10 de la
spec n'a jamais été faite) ; `0005` jamais jouée sur `mitsu`. **Gestes, dans l'ordre :** (1) **AVANT tout `push`**, dans l'éditeur SQL de `mitsu`
(`supabase/README.md`, étape 11) : **d'abord** insérer l'adresse de preuve (`exemple.invalid`) dans `private.allowed_users`, puis coller
`supabase/migrations/0005_imports.sql` entière, puis, collée seule, `notify pgrst, 'reload schema';`, puis jouer la preuve
`supabase/proofs/0005_imports.sql` (jetons `A_UUID` et `A_EMAIL` = cette adresse, « Run without RLS », lire `999 BILAN` : `0 faux sur 35`) et coller
le tableau dans `supabase/proofs/RESULTATS-mitsu.md` ; retirer l'adresse de preuve ; (2) après `/verify`, **d'abord** écarter le fichier NON SUIVI
`docs/audits/2026-10-18-import-livres-photos-web.md` de `~/projects/mistu` (identique à celui de la branche : `cmp` muet ; déjà écarté par le chef d’orchestre le 19 octobre, déplacé hors du dépôt, puis `rm`), sinon la fusion
refuse (« untracked working tree files would be overwritten ») ; puis `! git -C ~/projects/mistu merge --ff-only import-cible` ; (3) `! git -C
~/projects/mistu push origin main` (suite publique attendue : 3694/3694, plus le 404 de `/favicon.ico`) ; (4) preuve réelle sur le site public,
connecté : l'écran ciblé `#/recipes/<id>/importer` sur une recette « Repérée dans ton livre », ses photos, « Extraire et enregistrer » — la PREMIÈRE
extraction réelle jamais faite (noter le modèle, la durée, la fidélité, une page dense) ; puis la section « Imports » de la page Ajouter (« Reprendre »,
« Ignorer », « Annuler ») ; puis `select jour, appels from public.assistant_usage_jour;` ; (5) iPhone (même route depuis l'app installée, une app
fermée en plein vol) ; (6) décision de texte VF-16 (spec § 5, sans urgence : dire pourquoi « Remplacer par cette lecture ? » est posée quand des pages
ne sont pas relues ; un libellé pour « Garder ma version » quand la courante est une lecture de l'assistant) ; (7) « clean » en dernier : le registre
`.superpowers/sdd/2026-10-18-import-cible/` est déjà copié dans `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet le 19 octobre) ; le recopier si
la clôture y ajoute quelque chose, puis `git worktree remove`. Non prouvé et dettes nommées (m9, m12, m13 ratifiés à la clôture ; `hb-ignore`
équivalent ; survivant M3 ; I-2 aveugle à la sorte, à trancher au lot B ; `imports` chargé par `getData` à chaque rendu) : `CLAUDE.md`, section
« Importer une recette repérée », et `docs/architecture.md`, section du lot.

**Correction (19 octobre) : le paragraphe « Présentation du serveur » ci-dessous dit « PAS fusionné, PAS poussé » — c'est de l'histoire. Le lot
est EN LIGNE depuis le 18 octobre : fusion et `push` faits par Neegan, `main` = `origin/main` = `57babc6` (commit de docs au-dessus de `778883c`) ;
les lots 4 (« Passerelle de l'assistant ») et 5 (« Présentation du serveur ») sont servis.** Ses autres gestes (preuve réelle d'une recherche
Web, « clean » de `mistu-serveur` après copie de son registre) restent à relire tels qu'écrits.

**18 octobre 2026, 17 h 30 — LOT « PRÉSENTATION DU SERVEUR » : FINI dans le worktree `~/projects/mistu-serveur` (branche
`presentation-serveur`, base `main 3998f97`, serveur 8087), revu et re-revu, PAS fusionné, PAS poussé.** Décision de Neegan après la
première recherche réelle : chaque résultat Web porte une présentation en deux ou trois phrases « comme un serveur qui présente le
plat », puis une ligne « Estimé par l’assistant : ≈ 15 min · facile · 7 ingrédients » (hors sel et poivre), et un bouton « Voir la
recette » qui ouvre la page ; même appel, serveur intact ; `pourquoi` retiré ; `bornerAuMot` (fin du « La recet » coupé). Suite
**3011/3011** (épinglé 3010), Node 101/101, `sw.js` `cuisine-os-v0.8.1-3`, `APP_VERSION 0.8.1`. Commits `d124de6` + `5ab689f` + `778883c`. Revue
adverse (opus) : 0 Critical, 4 Important corrigés en ronde 1, 9 Minor ; re-revue 13/13 ; ronde 2 = hôte nu écarté + résidus (graphèmes parqués). Détail : `CLAUDE.md`, section
« La présentation du serveur ». **Gestes :** `! git -C ~/projects/mistu merge --ff-only presentation-serveur` puis `push` ; preuve réelle :
une recherche Web connecté → présentations et ligne « Estimé par l’assistant », « Voir la recette » ouvre la page ; « clean » après
copie du registre `.superpowers/sdd/2026-10-18-presentation-serveur/`. Hors périmètre, lot suivant si voulu : lire une page
(`web_fetch`), recette complète dans l'app.

**18 octobre 2026, 16 h 54 — LOT « PASSERELLE DE L'ASSISTANT » : EN LIGNE.** Fusion rapide et `push` par Neegan (`main` = `3998f97`, 22
commits), Pages servi à 20 h 51 UTC (`cuisine-os-v0.8.0-6`, `passerelle.js` 200, le code servi ne nomme plus `api.anthropic.com`) ;
**première recherche réelle rendue sur le site public sans clé** (« salade concombre sans gluten 15 minutes », quatre résultats, capture
16 h 54). Non lu encore : `select * from public.assistant_usage_jour;`, `assistant_journal.statut`, la valeur `cles` du GET, le 499.

**18 octobre 2026, 15 h 19 — LOT « PASSERELLE DE L'ASSISTANT » : FINI dans le worktree, fonction DÉPLOYÉE sur `mitsu` (version 3),
`0004` COLLÉE et PROUVÉE par Neegan (20 h 40 UTC : `999 BILAN` = `0 faux sur 20`, `assistant_reserver` visible de PostgREST), puis FUSIONNÉ et POUSSÉ (ci-dessus).** Branche `passerelle-assistant`, worktree `~/projects/mistu-passerelle` (serveur 8086), base
`main` `cdbd6e0`, tête `2a2f838` (19 commits, dont deux commits RESULTATS du contrôleur et les deux de la vague finale `f43e071` serveur et
`2a2f838` app). Pour Neegan : plus de clé à taper ; connecté, l'assistant marche sur tous les appareils (60 appels par compte et par jour,
`claude-sonnet-5-5`, Réglages dit « Vérification… » puis « actif pour … » une fois le serveur répondu) ; la clé est un secret du projet et
l'app n'appelle plus `api.anthropic.com`. Déployée par le contrôleur : v1 17 h 05 UTC (`1590ba8`), v2 18 h 16 UTC (`6d7ed21`), **v3 19 h 19 UTC
(`2a2f838`, `--no-verify-jwt --use-api`, `verify_jwt: false`, `ezbr_sha256 95034efd…`)**, neuf sondes sans dépense identiques aux trois ;
**aucun POST réel**. Revue finale de branche (opus) : 0 Critical, 3 Important (pages non réduites, forme des clés injectées, README racine), 11
Minor ; rulings F-1 à F-14 appliqués, F-15 (double `JSON.parse`) laissé en dette. Suite **2953/2953** (épinglé 2952), Node **101/101**,
`--check` 0, tsc strict 0, pglast OK (12 + 24 instructions), `sw.js` `cuisine-os-v0.8.0-6`, `APP_VERSION 0.8.0`. **Gestes, dans l'ordre :** (1)
FAIT le 18 oct à 20 h 40 UTC : `0004` collée, preuve `999 BILAN` = `0 faux sur 20` (tableau dans `RESULTATS-mitsu.md`, sondes S11-S12 : fonction connue de PostgREST, `anon` refusé 42501) ;
(2) après `/verify` : `! git -C ~/projects/mistu merge --ff-only passerelle-assistant`, puis `push` ; (3) preuve réelle sur le site public,
connecté : « saumon fenouil » → un POST `/functions/v1/assistant` 200, zéro `api.anthropic.com`, Réglages « actif … 60 », puis `select … from
public.assistant_usage_jour;` ; avec la session, la sonde `GET` du README (étape 10) lit `cles` ; couper un appel en vol et lire le 499 dans le
journal ; (4) iPhone avec l'autre compte, rien à configurer ; (5) console Anthropic : révoquer l'ancienne clé, plafond mensuel ; (6) « clean »
après copie du registre `.superpowers/sdd/2026-10-18-passerelle-assistant/`. Non prouvé : `CLAUDE.md`, section du lot.

**18 octobre 2026, 10 h 50 — LES TROIS LOTS SONT EN LIGNE.** Geste de Neegan : `0003_assistant_config.sql` collée sur `mitsu`
(`Success`), preuve `0003` jouée : **45 verdicts, 0 faux**, journaux de Postgres jugés (la clé ne peut pas y finir :
`log_statement = ddl`, durée `-1`, `log_parameter_max_length_on_error = 0`), adresses de preuve retirées (2) ; puis trois
fusions `--ff-only` (`assistant-compte` → `creer-ia` → `refonte-visuelle`) et un `push` : **`main` = `origin/main` = `7a95777`**
(50 commits sur `66c5d19`). Suite publique `https://neegans.github.io/mistu/tests/` relancée par le contrôleur dans un Chrome
sans fenêtre, contexte neuf, aucune clé : **2633/2633**, seule erreur de console le 404 `/favicon.ico` ; `sw.js` servi
`cuisine-os-v0.7.0-25`. Les paragraphes ci-dessous décrivent chaque lot tel qu'il était à sa clôture (« FINI dans le
worktree, PAS fusionné, PAS poussé ») : c'est désormais de l'histoire. Reste à Neegan : iPhone (connexion Google, « suit ton
compte », barre d'état `default`, onglet actif, porte, survol), preuve réelle du lot 2 avec sa clé (un seul POST, étiquette,
« Garder »), décisions (N-8/N-9 sur les livres, V-3/V-4, R-VIS-8, R-VIS-4, ovale, 240 min, `image: null`, « 100 % », titre
d'adaptation, « filets » lu comme `dash`), rotation de la clé Anthropic + plafond, « clean » des cinq worktrees (les cinq
registres sont copiés identiques dans `~/projects/mistu/.superpowers/sdd/`, captures du lot 3 comprises).

## Où on en est
**Lot « Refonte visuelle magazine culinaire » (18 octobre) : FINI dans le worktree, PAS fusionné, PAS poussé** — branche
`refonte-visuelle`, worktree `~/projects/mistu-look` (serveur `python3 -m http.server 8085`), base = pointe finale de `creer-ia`
`237047a` (lot 2 ci-dessous, **lui-même non fusionné** sur le lot 1 `ce9eb5d`, **lui-même non fusionné** sur `main` `66c5d19`) ;
commit de départ `174415b` (spec et plan rév. 2), puis T1, T2, T3, la clôture et la **vague finale** après la revue finale de
branche (R-VIS-13 : ambre `#8b5f10` ; R-VIS-14 : règles de comportement épinglées ; anneau des onglets bas rentré). Registre **hors git** :
`.superpowers/sdd/2026-10-18-refonte-visuelle/` (`progress.md`, rapports, outil `preuve-visuelle.cjs`, `galerie.html`, résultats et
**`captures/`**, 136 PNG). Pour Neegan : l'app change d'habit, pas de gestes — papier ivoire, titres en serif, la tomate pour
l'action, le vert pour les états ; mêmes écrans, mêmes textes, aucun test de comportement retouché ; à l'écran, « Annuler » se range
à droite pendant un vol (R-VIS-8, à confirmer), les segments des Réglages ne s'étirent plus, la puce bascule cochée passe en vert, les
coins des couvertures sont arrondis. Fichiers : `styles.css`, `index.html`, `manifest.webmanifest`, `sw.js`,
`tests/theme.js` (neuf), `tests/tests.js` ; aucun `src/`. Suite **2633/2633** (total épinglé **2632** dans `tests/tests.js`, après la
vague finale ; 2622 à la clôture ; départ sur `237047a`, mesuré par le contrôleur : 2554/2554, épinglé 2553), seul le 404 `/favicon.ico` en console ;
`node --test tools/*.test.mjs` 45/45 ; `node tools/generer-migrations.mjs --check` 0 ; les 28 paires de contraste de la spec § 3.6
recalculées ≥ 4,5 (minimum 4,62, ambre sur accent-bg du mode cuisine, qui valait 4,49 avant R-VIS-13). Preuve visuelle **relancée par
la vague finale**, VERTE (code de sortie 0) : 40 lignes sur 40 aux largeurs 375, 390, 768 et 1512, contraste rendu minimum 4,62 sur
1 760 nœuds, M3 sans recouvrement, M14 20 sur 20, 136 captures (avant la vague, la tâche 3, la revue finale et le contrôleur
l'avaient trouvée identique : 40/40, minimum 4,67 sur 1 732 nœuds, 136 captures). Mutants de la vague : 11 sur 11 rougissent. `APP_VERSION 0.7.0`, `DB_VERSION 3` (inchangés),
`sw.js` `cuisine-os-v0.7.0-25`, `SHELL` inchangé. Décisions de nuit V-1 à V-6 **à confirmer par Neegan**, avec R-VIS-8 (placement
d'« Annuler »), R-VIS-4 (libellé de recherche coupé à 375 px) et l'ovale des titres web sur plusieurs lignes (capture
`375-galerie-boutons.png`). Spec `docs/superpowers/specs/2026-10-18-refonte-visuelle-design.md`
(§ 8 : rulings R-VIS-1 à R-VIS-14 ; § 5 : dettes), section du lot dans `CLAUDE.md` et dans `docs/architecture.md`. Revue finale de
branche faite (une vague de corrections) ; re-revue ciblée et `/verify` : au chef d'orchestre.

**Lot « Créer une recette avec l'assistant » (18 octobre) : FINI dans le worktree, PAS fusionné, PAS poussé** — branche
`creer-ia`, worktree `~/projects/mistu-ia` (serveur `python3 -m http.server 8084`), base = pointe d'`assistant-compte`
`ce9eb5d` (lot 1 ci-dessous, **lui-même non fusionné** ; commit de départ du lot `4fee65e` : spec et plan), registre
`.superpowers/sdd/2026-10-18-creer-avec-l-ia/`. Pour Neegan : tu décris ce que tu veux, l'assistant propose UNE recette, tu
la gardes ou pas ; une recette gardée dit partout « Créée avec l'IA · non testée » jusqu'à « Marquer testée », et « Adapter
avec l'IA » en fait une variante sans toucher l'original. Deux portes sur clic (carte « Créer avec l'IA » d'Ajouter, six
cartes ; bouton « Créer une recette avec ces critères » de l'onglet Web), un appel par clic, un seul vol pour toute l'app,
rien d'écrit sans « Garder ». Huit tâches (ordre T1, T2, T5, T3, T4, T6, T7, T8), une ronde de corrections au plus chacune,
14 commits sur `4fee65e` (clôture comprise), puis la **vague finale** après la revue de branche (R-CRE-13 : unité vide
acceptée et invite alignée sur le validateur ; R-CRE-14 : restrictions demandées dans l'invite ; R-CRE-15 : exemple du
champ ; faux positifs N-8 documentés ; exports échappés). Suite **2554/2554** (total épinglé **2553** dans
`tests/tests.js` ; départ remesuré sur `4fee65e` : 1967/1967, épinglé 1966), seul le 404 `/favicon.ico` en console ;
`node --test tools/*.test.mjs` 45/45 ; `node tools/generer-migrations.mjs --check` 0. `APP_VERSION 0.7.0`, `DB_VERSION 3`
(inchangé), `sw.js` `cuisine-os-v0.7.0-11`, `SHELL` + `./src/domain/creation-ia.js` + `./src/ui/creer-ia.js`. **Aucun appel réel** pendant le
lot (`fetch` factice injecté partout). Décisions de nuit N-1 à N-10 **à confirmer par Neegan**, **N-8/N-9 en tête** : elles
changent l'app entière (une fiche de LIVRE aux lignes non vérifiées passe de « compatible » à « à vérifier » ; courses
groupées par le texte écrit ; et N-8 dit souvent « incompatible » une création « sans gluten » ou « sans lactose » à cause de
ses substituts non vérifiés, pâtes sans gluten ou lait de soya : mesuré, décision de Neegan). Spec
`docs/superpowers/specs/2026-10-18-creer-avec-l-ia-design.md` (§ 11 : rulings R-CRE-1 à R-CRE-15 ; § 10 : gestes), plan `docs/superpowers/plans/2026-10-18-creer-avec-l-ia.md` (amendements P1-P29), section du
lot dans `CLAUDE.md` et dans `docs/architecture.md`. Revue finale de branche faite (une vague de corrections) ; re-revue
ciblée et `/verify` : au chef d'orchestre.

**Lot « La configuration de l'assistant suit le compte » (17-18 octobre) : FINI dans le worktree, PAS fusionné, PAS
poussé** — branche `assistant-compte`, worktree `~/projects/mistu-web` (serveur `python3 -m http.server 8083`), base
`main` `66c5d19`, registre `.superpowers/sdd/2026-10-17-assistant-par-le-compte/`. La configuration de l'assistant
(fournisseur, modèle, URL de base, clé) vit dans le magasin `assistant_config` (plus dans `settings`) et suit le compte
sur les hôtes de production seulement (jamais sur `localhost`) ; jamais de conflit à trancher, jamais de suppression
locale (« Aucun » écrit une ligne vide), jamais dans une archive ; passe unique depuis l'ancien `settings.llm`. Serveur
en fichiers seulement : `supabase/migrations/0003_assistant_config.sql` et sa preuve, **pas encore collées sur
`mitsu`**. Suite **1967/1967** (total épinglé **1966**), `APP_VERSION 0.6.0`, `sw.js` `cuisine-os-v0.6.0-10`. Spec
`docs/superpowers/specs/2026-10-17-assistant-par-le-compte-design.md` (§ 12 : R-CPT-1 à R-CPT-7), section du lot dans
`CLAUDE.md` (ordre des gestes, procédure « appareil perdu ou clé exposée »).

**Lots poussés** (`origin/main` = `66c5d19`, relu par `git ls-remote` le 18 octobre) : « confort après preuve »
(`confort-web` : « Liens web gardés », « Chercher à nouveau » sur la ligne K1, date de page en liste blanche ; suite
1802/1802) — poussé, **site public non relu dans cette session** — et « Chercher sur le web avec l'assistant » (LIVE depuis
`dc7444a`, prouvé par l'appel réel du 17 octobre sur le site public, « puttanesca »). Sections dans `CLAUDE.md`.

## Ce qui n'est pas prouvé
- **Lot passerelle** : (la preuve `0004` est jouée : 20/20 le 18 oct à 20 h 40 UTC, tableau dans `RESULTATS-mitsu.md`) ; **aucun POST réel** (aucune ligne `assistant_journal`, aucun appel à Anthropic, validité du secret non exercée) ; le `GET`
  `{ modele, quotaJour, cles }` avec une session (dont la valeur de `cles`) et `is_allowed` pour une session non admise ; l'abandon du client
  → 499 (prouvé sous Node seulement) ; le préflight d'un vrai navigateur (S1 est un `OPTIONS` à la main) ;
  un secret changé pris par un isolat chaud ; l'ordre `installCapture` / `repo.init()` dans l'app réelle (test de source seulement) ;
  Safari et l'iPhone.
- **Lot refonte** : rien sous Safari ni sur l'iPhone — barre d'état `default` (app à réinstaller pour relire la balise), onglet
  actif, survol collant (R-VIS-12), marge de 3,4 px du libellé de recherche à 390 px (Chrome seulement) ; à 320 px avec la pastille,
  la barre haute mesure 341 px (320 px = iPhone de 375 ou 390 px en « Agrandir l'affichage », selon la revue de T3) ; `::backdrop` +
  `var()` exige Safari 17.4 et `:has()` iOS 15.4 ; R-VIS-8 est un crochet de style : l'assertion de `tests/theme.js` construit son
  propre DOM, seule la preuve M3 (hors git, recherche web seulement) voit la vraie structure ; l'anneau rentré des onglets bas
  (vague finale) est mesuré dans la scène des tests et dans la galerie, pas dans l'app.
- **Lot création** : **aucun appel réel** (chaque test passe par un `fetch` factice ; le parcours dans l'app réelle de la
  tâche 3 avait l'API Anthropic interceptée) — forme réelle d'une réponse, durée, jetons, coût, taux de refus `illisible`
  ou `affirmation` ; Safari et l'iPhone ; les minuteurs Siri d'une étape de création sur appareil ; l'effet de N-8/N-9
  sur la vraie bibliothèque de Neegan (fixtures seulement).
- **Lot assistant** : aucune passe réelle contre `mitsu` (ni `0003` ni sa preuve n'ont tourné ; leur syntaxe seulement
  est vérifiée hors ligne, par pglast v8.6) ; l'iPhone ; le chemin « nouveau client, ancien serveur » ; l'état « appareil
  lié sans session » de K-10 ; K-12 au niveau de la page ; les appels réels de « Tester », de l'extraction et du
  fournisseur compatible OpenAI.
- **Lot confort** : le parcours réel de bout en bout par Neegan.
- **Lot web** : statut et corps d'un compte sans recherche web, `pause_turn`, `refusal`, taille du corps, coût.
- **Safari et l'iPhone** partout (aucun WebKit ici) ; `target="_blank"` et `navigator.onLine` depuis une PWA installée ;
  les délais (135 s pour l'assistant) comptent le temps actif (PWA iOS en arrière-plan).

## Reste à faire (gestes de Neegan, dans cet ordre)
1. **Lot 1 d'abord, `0003` avant tout `push`** : éditeur SQL de `mitsu`, coller `supabase/migrations/0003_assistant_config.sql`
   entier ; puis la preuve `supabase/proofs/0003_assistant_config.sql` (deux adresses `exemple.invalid` dans
   `private.allowed_users`, quatre jetons remplacés, « Run without RLS », ligne `999 BILAN` à `0 faux`, verdicts dans
   `supabase/proofs/RESULTATS-mitsu.md` **sans aucune valeur de `data`**, adresses retirées) — `supabase/README.md`,
   étape 8 bis.
2. Revue finale et `/verify` des trois lots par le chef d'orchestre ; regarder les captures du lot 3 :
   `~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/captures/` (136 PNG, `<largeur>-<nom>.png`).
3. **Fusions `--ff-only` en chaîne**, puis **un** `push` (chaîne linéaire, mesurée par `git merge-base --is-ancestor` :
   `66c5d19` ⊂ `ce9eb5d` ⊂ `237047a` ⊂ `refonte-visuelle`) : `! git -C ~/projects/mistu merge --ff-only assistant-compte`, puis
   `! git -C ~/projects/mistu merge --ff-only creer-ia`, puis `! git -C ~/projects/mistu merge --ff-only refonte-visuelle` ; si une
   branche a bougé pendant une vague de revue, rebaser la suivante dessus d'abord ; puis `! git -C ~/projects/mistu push origin main`.
4. Suite publique : ouvrir `https://neegans.github.io/mistu/tests/` et lire le BILAN (après la vague finale : 2633/2633, épinglé 2632,
   plus le 404 de `/favicon.ico` ; seule la suite publique tue le mutant `() => false` du défaut de `texteAssistant`, lot 1) ;
   service worker `cuisine-os-v0.7.0-25`.
5. iPhone, app **réinstallée** depuis le site public : barre d'état lisible, onglet actif, porte « Kwe. », aucun survol collé après
   une tape, libellé de la recherche, et dire si « Agrandir l'affichage » est activé (lot 3) ; « Connexion avec Google » depuis l'app installée (mesure iOS due depuis le
   13 octobre : où atterrit le retour), la clé arrive à la passe suivante (lot 1, geste 4) ; sur le Mac, Réglages → Assistant IA
   montre la configuration et « La configuration de l’assistant suit ton compte sur tes appareils connectés. ».
6. **Preuve réelle de la création** (Mac, site public ; réécrit par R-CRE-15) : taper « saumon fenouil » dans la demande,
   puis régler dans le formulaire la puce « Sans lactose », Portions 2 et Temps maximal 30 → « Créer ma recette » ; vérifier
   qu'**un seul** POST part et que la proposition affiche « Créée avec l’IA · non testée » ; noter la durée, les jetons
   affichés et le coût dans la console Anthropic ; « Garder » → Mes livres → « Recettes créées avec l'IA » ; « Marquer
   testée » après cuisson ; une adaptation (« Adapter avec l'IA »). Preuve iPhone du lot web, toujours due : « saumon fenouil » → des
   liens ; « Garder ce lien » → signet prérempli.
7. **Décisions** : V-1 à V-6 du lot 3 (renverser V-3 ou V-4 au besoin), R-VIS-8, R-VIS-4 et l'ovale des titres web sur plusieurs
   lignes ; N-8/N-9 en tête puis N-1 à N-10 du
   lot 2, et les décisions de spec listées dans `CLAUDE.md` (borne de 240 min, etc.).
8. Faire tourner la clé Anthropic (elle a transité par un chat) et poser un plafond de dépense mensuel sur le workspace.
9. « clean » **seulement après** avoir copié les registres dans `~/projects/mistu/.superpowers/sdd/` :
   `2026-10-17-assistant-par-le-compte` (déjà là, `diff -rq` muet contre `~/projects/mistu-web` le 18 octobre),
   `2026-10-17-chercher-sur-le-web` et `2026-10-17-confort-web` (dans `~/projects/mistu-web` : déjà là, vérifiés identiques, `diff -rq`
   muet le 18 octobre — `git worktree remove` de `mistu-web` détruirait les originaux),
   `2026-10-18-creer-avec-l-ia` (copié par le contrôleur, `diff -rq` muet contre `~/projects/mistu-ia` le 18 octobre),
   `2026-10-18-refonte-visuelle` **avec `captures/`** (une copie du contrôleur existe déjà, mais chaque rapport la périme : la
   recopier en dernier, puis `diff -rq` muet) ; ensuite seulement `git worktree remove` de `mistu-look`, `mistu-ia`, `mistu-web`.
10. Gestes restants des lots précédents : parcours iPhone/Safari du lot ISBN, clé Google Books (`docs/google-books.md`),
   « clean » des worktrees `mistu-isbn` et `mistu-sync` une fois leurs registres vérifiés. Deux worktrees VibeForge : ne pas
   toucher.

## Lots suivants (décisions du 17 octobre, spec web § 10 R11)
- Mistu reste **personnel**. *Décision du 17 octobre (pas de passerelle serveur ni de clé commune) renversée par Neegan le 18 octobre à 11 h :*
  une seule clé Anthropic, côté serveur (lot « Passerelle de l'assistant ») ; le mur reste le plafond du workspace Anthropic. D5
  (sous-domaine dédié) reste recommandé.
- **Après le lot 3** (dettes nommées, spec refonte § 5) : mode sombre, barre haute sur bureau (V-3), icônes SVG, police de marque,
  `.chip.removable` focalisable, `aria-current` sur l'onglet actif, `scrollIntoView` qui respecte le mouvement réduit, « − / + »
  des portions à 44 px, champ « p. imprimée » de `src/ui/import.js:136` à 16 px, liste blanche T-2 vérifiée par usage, `--safe-t`
  sur le panneau latéral et `scroll-margin-top` si la barre d'état repasse en `black-translucent` (revue finale) ; et, pour un lot de comportement, le bug
  préexistant de Réglages (`src/ui/settings.js:43-45` : segments dans un `label.field`, toucher le libellé active la première
  option — revue de T3). Un lot à la fois.
- Au prochain lot qui touche le générateur, après le collage de `0003` : figer `SYNC_STORES_0003` et épingler
  l'empreinte de `0003`.
- Parqués : lire la page trouvée pour en tirer une fiche recette ; dettes des lots création, web et assistant
  (`CLAUDE.md`, sections des lots) ; lot ISBN (R-ISBN-9, R-ISBN-11, S3, S4, C6, C7, D6).

## Reprendre

Lot UI-1 « Carnet » (le plus récent ; l'outil de preuve réécrit resultats.md, resultats.json et captures/ : jamais pendant qu'une revue les lit) :
```
cd ~/projects/mistu-carnet && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8096 http=%{http_code}\n" http://127.0.0.1:8096/tests/ || (nohup python3 -m http.server 8096 --bind 127.0.0.1 > /dev/null 2>&1 &)
node ~/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/suite.cjs 8096   # attendu : 6226/6226 (+ 1 x 404 favicon ; vague finale)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 208/208, code 0
node ~/projects/mistu-carnet/.superpowers/sdd/2026-10-23-experience-carnet/preuve-visuelle.cjs 8096   # attendu : VERT, code 0, 70 lignes, 174 captures
```
Lot A, import ciblé :
```
cd ~/projects/mistu-import && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8088 http=%{http_code}\n" http://localhost:8088/tests/ || (nohup python3 -m http.server 8088 > /dev/null 2>&1 &)
# suite.cjs charge Playwright depuis le cache npx (~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright) : un ménage du cache npm casse ce lanceur
node ~/projects/mistu-import/.superpowers/sdd/2026-10-18-import-cible/suite.cjs 8088   # attendu : 3694/3694 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 125/125, code 0
```
Lot passerelle (le plus récent) :
```
cd ~/projects/mistu-passerelle && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8086 http=%{http_code}\n" http://localhost:8086/tests/ || (nohup python3 -m http.server 8086 > /dev/null 2>&1 &)
node ~/projects/mistu-passerelle/.superpowers/sdd/2026-10-18-passerelle-assistant/suite.cjs 8086   # attendu : 2953/2953 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 101/101, code 0
```
Lot refonte (les trois lots de la nuit sont en ligne ; ce bloc sert à reprendre l'outil de preuve visuelle) :
```
cd ~/projects/mistu-look && git status --short && git log --oneline -3
curl -sS -o /dev/null -w "8085 http=%{http_code}\n" http://localhost:8085/tests/ || (nohup python3 -m http.server 8085 > /dev/null 2>&1 &)
node ~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/suite.cjs 8085   # attendu : 2633/2633 (+ 1 x 404 favicon)
node --test tools/*.test.mjs && node tools/generer-migrations.mjs --check   # attendu : 45/45, code 0
```
Preuve visuelle (réécrit `resultats.md`, `resultats.json` et `captures/` : jamais pendant qu'une revue les lit) :
`node ~/projects/mistu-look/.superpowers/sdd/2026-10-18-refonte-visuelle/preuve-visuelle.cjs 8085` — attendu : VERT, code de sortie 0.
Ordre des gestes : § « Reste à faire », points 1 à 3 (`0003` AVANT le `push`, fusions ff-only en chaîne).

## Pièges connus
`\uXXXX` nu dans un appel d'outil = caractère réel écrit (écrire `\u{XXXX}`, vérifier les octets) ; `grep` de ce shell
appelle `ugrep` en UTF-8 : les caractères invisibles se mesurent en Python (commande de la ligne 21 du plan
`docs/superpowers/plans/2026-10-17-assistant-par-le-compte.md`, lue par script, jamais retapée ; elle ne couvre pas les
sélecteurs de variante U+FE00-FE0F : `src/app.js` en porte 3 U+FE0E et `src/ui/add.js:18` 1 U+FE0F, l'émoji U+270D + U+FE0F, tous
antérieurs) ; le total épinglé de `tests/tests.js` se lit
dans « obtenu : X » puis se pose, jamais deviné ; messages de commit en ASCII sans accents ; jamais `git add -A`
(`.superpowers/` non suivi) ; ne jamais toucher `~/projects/mistu` depuis un worktree (l'arbre principal est servi sur
8080) ; aucune requête ne lit `public.assistant_config.data` (la clé y est en clair) ; un serveur de copie se lance sur un
port libre vérifié (8099 répondait déjà le 18 octobre) ; `.superpowers/` est exclu par `.git/info/exclude` (le registre, l'outil de
preuve et les captures ne sont pas dans git : les copier avant tout `git worktree remove`).
Pas de `DECISIONS.md` ni `TASKS.md` dans ce dépôt : la traçabilité vit dans les specs (§ 11 / § 12), `CLAUDE.md` et les
registres SDD.
