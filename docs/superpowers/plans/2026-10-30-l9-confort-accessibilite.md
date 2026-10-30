# L9 — Plan de construction et réception

**30 octobre 2026 — contrat fermé, réception publique L8 acquise.** [Spec](../specs/2026-10-29-l9-confort-accessibilite-design.md), plan directeur §16. Base : **L8 0.30.0, code9bb96ac/reçu c9b2048, DB6/archive7, SQL0013**,11083/11083 publics,76 fichiers exacts et parcours reçus. Cible **L9 0.31.0, DB6/archive7 inchangés**, sans migration SQL. Aucun code de production L9 modifié à la fermeture du contrat. La poursuite globale est autorisée ; aucune relecture personnelle de Neegan n’est revendiquée.

La réception publique L8 est acquise ; construire après clôture de revue A/B/C/root et GO. Le lot corrige navigation, dialogues, commandes et mouvement ; aucun domaine métier, dépendance ou nouvelle destination. Les harnais ignorés de préparation observent l’existant et ne comptent pas comme réception.

## 1. Préparer une base exacte

Consigner le commit de départ, la version, le cache et les API L3/L4/L6/L7/L8. Relire les maquettes mobile Bibliothèque et web Recette déjà référencées dans la spec ; elles fixent la direction visuelle, pas un comportement de focus supposé.

Inventorier les usages de `segmented`, dialogues natifs/helpers et régions live. Distinguer les défauts encore présents des corrections déjà reçues, notamment `aria-current` et les choix de langue L6. Pas de refonte de tous les écrans sous couvert d’accessibilité.

Attribuer un propriétaire unique à chaque zone :

| Zone | Fichiers principaux | Frontière |
|---|---|---|
| Navigation et focus | `app.js`, `ui/navigation-contexte.js`, `ui/coquille.js`, `index.html` | Une seule autorité de focus, gardes avant démontage |
| Dialogues et sélecteurs | `core/dom.js`, `ui/components.js`, raccords métier nécessaires | API existantes conservées, aucun second chemin d’écriture |
| Présentation et réception | `styles.css`, `i18n/en.js`, tests/runner/cache | Mouvement CSS limité, mesures réelles |

Les fichiers partagés ne sont pas édités simultanément par plusieurs volets. Publier le retour enrichi de `restaurerVue` et ses trois modes de présentation avant raccord app/livre. Le repli reste dans cette seule autorité ; aucun `h1.focus()` concurrent ajouté dans app.

## 2. Tranches avec tests rouges avant code

Ordre de travail fermé : **T0 → T1a/T1b → T2a/T2b → T3a/T3b → T4a → T4b → T5**. Les sous-tâches indépendantes peuvent se préparer en parallèle après partage des APIs ; un fichier n’a qu’un propriétaire. Chaque sous-tâche livre son rouge observé, le changement borné et le vert avant intégration.

| Petite tâche | Rouge causal attendu | Critère de fin |
|---|---|---|
| T0 — base reçue | capture320/texte200 et clavier des contraintes sur L8 | commit exact, attentes de réception et inventaire des appels consignés ; aucun produit modifié |
| T1a — helpers génériques | dialogue sans nom/label ; focus différé après fermeture ; showModal absent | choix/annulation identiques, un seul résultat, nom et focus utilisables |
| T1b — raccords métier | noms manquants des dialogues cuisson, stock et sortie | mêmes callbacks/intentions/CAS ; aucune nouvelle écriture |
| T2a — sélecteurs et filtres | tablist incomplet ; puce de retrait non atteinte au clavier | groupe nommé, états observés, retrait par vrai bouton |
| T2b — contraintes repas | Entrée/Espace ne sélectionnent pas un régime sur le span | même geste L8 au clavier, un seul appel ; échec clairement annoncé et saisie conservée |
| T3a — restauration commune | ancienne promesse ou interaction suivie d’un repli indésirable | résultat explicite, priorité ouverture/ancre/repli, aucune reprise après interruption |
| T3b — coquille/titre | live global, titre constant, absence de lien d’évitement | une annonce utile, busy de la seule vue courante, main accessible |
| T4a — reflow et cibles | marque fragmentée, nav masquante à200%, commandes inférieures44px | mots entiers, cinq liens accessibles, aucune commande masquée, géométrie mesurée |
| T4b — effets sobres | préférence réduite changée à chaud non suivie s’il y a un effet | CSS suffisant, action immédiate, compteurs/échéances inchangés |
| T5 — réception | parcours cumulés décrits ci-dessous | ciblés et intégrés, local puis public réellement observés |


### T1 — Dialogues nommés et replis utilisables

Créer une suite comportementale dédiée, par exemple `tests/l9-dialogues.js`. Monter les vrais helpers et observer le nom accessible, l’association du label au champ, les options conservées et la valeur rendue après geste.

Cas : confirmer, annuler, Échap, fermeture native, fermeture successive et déclencheur disparu/désactivé. Fermer un prompt avant son focus différé : aucun focus tardif dans un nœud détaché. Deux dialogues successifs ne partagent ni ID de titre ni décision. Le helper résout une seule fois et rend le focus à un contrôle utilisable ou au repli de vue connu.

Tester `HTMLDialogElement` absent, puis constructeur présent sans `showModal` utilisable. Les replis conservent l’annulation et le choix réel ; choose ne sélectionne pas implicitement la première option. Un dialogue spécialisé long conserve ses actions et son contenu dans le repli en ligne. Aucune recherche de chaîne dans le source comme preuve.

T1a corrige les helpers ; T1b raccorde seulement les dialogues métier réellement dépourvus de nom/repli, avec priorité aux saisies L4/L6, cuisson L7 et création/mouvement/restes L8. Les dialogues déjà nommés Actions/Sources conservent leur comportement. Préserver les confirmations de corbeille, les CAS, la récupération de saisie et le choix Rester.

### T2 — Sélecteurs honnêtes

Créer `tests/l9-selecteurs.js`. Pour langue, filtres, unités et présentation : groupe nommé, état pressé observé après chaque geste, parcours Tab naturel et aucun `tablist` partiel. Garder Original/Français et la candidate explicitement choisie de L6.

Pour les panneaux de contenu conservés comme vrais onglets, éprouver relations tab/tabpanel, noms, état sélectionné, flèches et focus. Si des boutons pressés suffisent, prendre cette solution prévue par la spec. Aucun clic de présentation ne déclenche de lecture assistant ou de mutation de recette.

T2b monte un vrai repas avec contraintes et utilise Tab puis Espace/Entrée. Observer sélection, nombre d’écritures et retour après reload ; le profil alimentaire personnel reste intact. Injecter quota/conflit dans la voie L8 : aucune fausse réussite, saisie retenue, focus sur contrôle utilisable. Les filtres de recherche utilisent des vrais boutons uniquement s’ils sont retirables, avec le nom du filtre dans le nom accessible.

### T3 — Navigation, titre et focus communs

Créer `tests/l9-navigation.js` sur le routeur et la vraie restauration L3. Poser d’abord un rouge avec handler suspendu : interaction clavier/pointeur avant montage, puis résolution du handler ; aucun focus ni scroll tardif ne doit être appliqué. Préparer la capsule de présentation synchronement dans onRoute, après la garde et avant son premier await ; consommation unique par restaurerVue et nettoyage idempotent sur erreur/abandon/rendu périmé. Poser ensuite un rouge où une restauration terminée sans cible est confondue avec un focus déjà déplacé, puis fermer le résultat explicite de `restaurerVue` : ouverture, ancre, repli, refresh, interaction ou rendu périmé.

Cas indispensables : nouvelle vue ; ouverture d’un champ demandée par le lien ; retour vers une recherche filtrée et défilée ; cible de liste disparue avec voisin connu ; deux rendus dont le premier finit en dernier ; interaction pendant attente ; compte/base/génération changés ; garde de sortie refusée. Observer `document.activeElement`, position réelle et titre, pas uniquement des attributs.

Le repli titre/main intervient une seule fois et jamais après interruption. Tester ensuite un vrai refresh qui démonte la vue après que l’utilisateur a tabulé jusqu’à un bouton : la capture du repère L3 avant démontage permet de retrouver uniquement son équivalent, sans repli titre/main ni voisin si absent. Une nouvelle interaction pendant le chargement interdit cette restauration. Observer le nœud remplacé réellement focalisé et le résultat `rafraichissement` avec `focusDeplace` exact ; un tick de minuterie conservant les nœuds ne constitue pas cette preuve. Le titre de document vient de la vue courante ; erreur de rendu nommée, anciennes promesses sans effet. La navigation arrière/avant ne reçoit pas de nouvelle entrée pour cette présentation.

Ajouter le lien d’évitement vers le vrai `main` et le busy limité au rendu courant après accord de sortie. Retirer le live global `#app` ; conserver les régions locales utiles. Vérifier la structure des annonces dans le DOM, puis distinguer cette preuve d’un essai de lecteur d’écran.

### T4 — Lisibilité avant mouvement

T4a ferme d’abord les constats de la capture L8 : marque coupée et cinq libellés fragmentés. Conserver les mêmes destinations en mots entiers ; permettre une répartition sur plusieurs rangées ou le flux normal quand nécessaire. Ne pas masquer les échecs avec `overflow:hidden`, ellipse des destinations ou réduction du texte. Mesurer également la hauteur et la réservation des barres, pas seulement la largeur. Le témoin préparatoire C ajoute un champ date natif atteignant375px dans un viewport320px/texte200% : le borner au conteneur sans altérer la valeur, le calendrier ou la saisie. Ajouter un contrôle du dernier champ/bouton atteignable après scroll et focus, avec pastille vide puis longue, en français et anglais.

Raccorder l’API A `installerGeometrieCoquille({root,tabs,fenetre})` et le `dispose()` de `coquille(path)` au contrat de la spec : mesure intrinsèque à largeur constante, `--nav-h` réelle en fixe et zéro en flux/desktop caché, seuil strict de 25 % du viewport visible pour `nav-dans-flux`, rAF groupé et aucune écriture à mesure identique. Root possède les règles CSS. Témoins causaux : changement de texte/langue et hauteur visible, seuil dans les deux sens sans oscillation, navigation desktop cachée, deux événements dans une frame, démontage avec rAF en attente. Après reconstruction de coquille, l’ancien observateur ne touche plus la nouvelle ; changement de route simple ne duplique pas le contrôleur.

T4b seulement ensuite : corriger les cibles/contrastes identifiés, puis ajouter seulement les transitions CSS prévues. L’état confirmé, les erreurs et Annuler apparaissent immédiatement après leurs événements réels ; pas d’attente de fin d’animation dans les mutations.

Même parcours avec mouvement normal, réduit au départ, puis préférence modifiée pendant la session. Compteurs et panneau de minuteurs inchangés pendant une transition d’étape. Aucun scroll doux automatique, animation de formulaire ou transition `all`. View Transitions n’est pas nécessaire à la réception ; ne pas l’ajouter si les transitions CSS satisfont le besoin.

Mesurer les couleurs composées et les cibles réelles. Texte courant au moins 4,5:1, grand texte 3:1 selon les conditions retenues ; ne pas arrondir un échec en succès. Vérifier également focus, contours et état pressé sur les fonds utilisés.

### T5 — Régressions et intégration

Rejouer navigation L3, sorties/brouillons L4, lectures et éditeurs L6, cuisine/minuteurs L7 et parcours repas L8. Les tests anciens évoluent seulement lorsque le geste ou la sémantique change réellement ; garder leurs scénarios et contrôles de non-perte.

Une écriture refusée ne devient jamais succès animé ; une interaction pendant rendu conserve son effet. Aucun appel assistant réel, URL externe ou donnée privée dans les tests.

## 3. Parcours réel local puis public

Profil jetable, données synthétiques représentatives, réseau externe bloqué. Captures à 320/390/768/900/1280px, texte 200 %, contenu long et zoom de page représentatif. Relire visuellement les captures, mesurer débordement, commandes atteignables, cibles 44×44 et focus visible.

1. Tab depuis le début de page : lien d’évitement, navigation nommée, arrivée sur une fiche et accès aux commandes.
2. Filtrer une grande liste, descendre, ouvrir une fiche puis revenir ; position et focus restent conformes à L3.
3. Ouvrir un éditeur directement, saisir, refuser une sortie ; aucun titre/focus/busy d’une autre vue. Refaire avec quota et récupération de texte.
4. Ouvrir des dialogues successifs, utiliser Shift-Tab/Tab/Échap ; supprimer leur déclencheur après un geste confirmé et observer le repli.
5. Changer langue/présentation, recette active et étape de cuisine avec minuteurs ; aucun focus pris par leurs ticks ou par une synchronisation.
6. Rejouer les gestes avec mouvement réduit puis changé à chaud ; dernière ligne et commandes accessibles sur petite hauteur.

Consigner navigateur, viewport, mesures et nombre de captures effectivement obtenus. Un viewport réduit ne prouve pas le clavier tactile iOS ; un arbre accessible inspecté ne prouve pas une lecture vocale physique. Laisser ces essais séparés et non vérifiés s’ils n’ont pas été réalisés.

## 4. Livraison

Ciblés puis suite complète, syntaxe/diff, Node et générateur applicables. Inscrire les nouveaux modules/tests et textes EN, mesurer le compteur d’assertions, mettre APP_VERSION à0.31.0 et le cache correspondant après base L8 réellement reçue. DB6/archive7 inchangés ; aucune migration SQL.

Après réception locale : revue indépendante, publication autorisée selon le contexte de session, Pages réellement construit, fichiers publics comparés et parcours public. Vérifier aussi le rechargement hors ligne avec le mécanisme de cache alors livré ; le protocole de mise à jour L10 n’est pas attribué à L9.

Conserver preuves sous `.superpowers/sdd/2026-10-30-l9/`, puis mettre STATE et rapport à jour sur résultats observés. Ce plan n’annonce aucun de ces contrôles comme déjà exécuté.


## 5. GO de construction — 30 octobre

Reçu L8 code9bb96ac/reçu c9b2048 acquis, revue A/B/C/root favorable. Les deux maquettes de la spec ont été ouvertes et relues par root. Aucun essai personnel de Neegan n’est attribué à cette clôture technique.

- A : navigation-contexte/app/coquille/index, raccord book et tests navigation ; capture avant attente et géométrie avec dispose selon la spec.
- B : helpers core/dom et raccords de dialogues métier identifiés, tests dialogues ; communique sa liste de fichiers avant raccords.
- C : components, contraintes meals et raccords des groupes nommés, tests sélecteurs ; coordonne tout fichier partagé avec B/A.
- Root : CSS, mouvement, mesures visuelles/contrastes, i18n/version/cache/runner, intégration et publication.

Pas de commit ni publication par les agents. Une nouvelle API est communiquée avant raccord ; une édition concurrente d’un fichier partagé exige un transfert explicite. Les tests causaux précèdent les changements, sans retirer les scénarios historiques.


## 6. Réception locale

**L9 — confort et accessibilité : réception locale terminée, publication en préparation.**
[Spec](../specs/2026-10-29-l9-confort-accessibilite-design.md), [rapport](2026-10-30-l9-confort-accessibilite.md).
Branche l9-confort-accessibilite, contrat36caf1f ; base L8 code9bb96ac/reçu c9b2048. Revues techniques A/B/C/root ; aucune relecture personnelle attribuée à Neegan.
Navigation/focus/titres et chargement cohérents, lien d’évitement, groupes de boutons nommés, contraintes au clavier, dialogues nommés avec repli en ligne et conservation du focus. Barre haute/basse mesurée, retour dans le flux sur petite surface, messages au-dessus de la navigation, cibles44px et mouvement réduit.
**0.31.0**, cache0.31.0-1, DB6/archive7 inchangés, aucun SQL nouveau ni module de production neuf. Public encore0.30.0 à ce reçu.
**11262/11262** navigateur (épingle11261, +179 depuis L8, aucun scénario retiré), zéro erreur JavaScript/requête extérieure. Node232/232, générateur0, syntaxe36 fichiers et diff propres.
A41 contrôles/navigation et géométrie, B62/dialogues, C68/sélecteurs, root8/lisibilité ; régressions L3/navigation45, Carnet301, Thème81 et corbeille/réponses payées conservées. Les attentes historiques de rangée fixe et tablist partiel suivent le nouveau contrat ; les montages iframe disposent leur contrôleur dans la bonne fenêtre.
Parcours Chrome : navigation12 observations/deux onglets, dialogues20 observations/10 captures, clavier des contraintes6 ;40 configurations de lecture FR/EN320→1280/texte100–200/pastille, plus lien d’évitement, petite hauteur, message, réduction du mouvement à chaud et zoom visuel200% CDP. Captures relues.
Cuisine8 mesures/36 gestes, photo décodée et note conservées après rechargement réellement hors ligne ; minuteurs sans remontage, API voix/Wake Lock simulées. Aucun essai physique iPhone/Safari/lecteur vocal ni certification WCAG ; zoom CDP distinct du zoom physique. Aucun compte privé ou appel assistant réel.
E1 clos sur la décision documentaire d’écarter l’automatisation Cookidoo pour cette livraison, transfert manuel existant conservé. **L10 reste à terminer.**

Preuves sous `.superpowers/sdd/2026-10-30-l9/` : rapports A/B/C/root, revues indépendantes, rouges/verts et parcours. Défaillances fermées : focus périmé/explicite après dialogue, bouton réactivé tardivement, repère de réglage perdu au vrai refresh, fenêtre du contrôleur de géométrie incorrecte dans les cadres, titre sous barre haute et toast sous navigation. Aucun retrait de test pour masquer ces défauts.
