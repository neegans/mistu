# L7 — Cuisine lisible, minuteries conservées et reprise

**30 octobre 2026 — contrat relu techniquement avant construction.** La poursuite globale du plan est autorisée ; aucune relecture personnelle de Neegan n’est revendiquée. Base publique L6 : code `87855c4`, reçu `c5b6c08`, 0.28.0, SQL0011, DB6/archive5 et 10161/10161 tests publics. Cible L7 : **0.29.0**, cache `cuisine-os-v0.29.0-1`, **DB6**, **archive6**, migration additive **0012** et capacité `cooking_persistence:1`. Les contrats de stockage/transport sont fermés dans [l’annexe cuisine](2026-10-30-l7-protocole-cuisine.md), qui prévaut sur les premières propositions ci-dessous. Aucun code L7 à cette revue.

Références : [plan directeur §13](../../lots/2026-10-29-plan-directeur-interface-fonctions.md#13-mode-cuisine--fiable-lisible-et-facile-à-reprendre), [L0 cuisine](2026-10-29-l0-reference-correctifs-design.md), [L6](2026-10-29-l6-ingredients-groupes-traductions-design.md). Les preuves L0 existantes sont aussi dans `tests/l0-cuisine.js` et STATE.

## 1. Résultat et limites

La recette en cours garde ses ingrédients accessibles et son étape lisible. Un changement d’étape ou de recette ne fait disparaître ni les suivis de durée ni leur échéance. Une session reprise retrouve la version exacte, la recette active, les portions connues et la progression confirmée. L’écran peut rester allumé lorsque le navigateur accorde cette possibilité ; son refus ne bloque jamais la cuisine.

Un **suivi indicatif** dans Mistu et une **alarme système** restent distincts. Mistu n’observe pas Horloge, ne démarre pas Siri, ne garantit aucun son quand la page est masquée/fermée et ne promet aucune notification d’arrière-plan. L7 n’ajoute ni serveur de notifications, ni reconnaissance vocale, ni moteur de rétroplanning, ni commande d’appareil. L’heure écoulée ne prouve jamais la cuisson terminée.

## 2. Audit du code et références visuelles

Lecture effectuée de `src/ui/cook.js`, `src/domain/timers.js`, `src/domain/thermomix-session.js`, des producteurs de session dans `recipe.js`/`meals.js`, de `components.js::timerBlock`, du retour Aujourd’hui, de la clôture dans `cuisson.js`, de `schema.js`, `state.js` et des règles CSS cuisine. Aucun de ces fichiers modifié pendant la préparation.

Constats actuels :

- L0 a déjà réparé la recette active : titre, lien Fiche et boutons changent ensemble ; `active_version_id` est conservé avec des écritures sérialisées, et les mises à jour ciblées préservent la progression d’un autre onglet. Conserver ces preuves, ne pas annoncer ce correctif comme neuf.
- `.cook` ne reçoit qu’un enfant principal ; les ingrédients sont imbriqués dans celui-ci. `.mode-cuisine .cook { display:block }` neutralise aussi la grille. Corriger DOM et CSS ensemble.
- Chaque redessin détruit les cartes de minuterie, les intervalles et l’état d’ouverture des ingrédients. Le miroir utilise déjà `Date.now()` et une échéance en mémoire ; c’est cette échéance qui n’est pas conservée. `timer_launches` enregistre les demandes, mais n’est pas chargé par `getData` et la vue ne relit pas son historique de session.
- Les lancements contiennent recette/version/étape/session, durée et instant de demande ; le magasin est déjà synchronisé et archivé. Aucun index IndexedDB nouveau n’est nécessaire pour le lire par session.
- Le raccourci est un vrai lien dont l’action native peut partir pendant l’écriture asynchrone. Une future preuve doit établir l’ordre conservation/geste externe ; attendre un Promise dans un gestionnaire ne suffit pas à retarder la navigation du lien.
- La voix lit aujourd’hui le texte original. L6 possède le projecteur et l’alignement de langue ; L7 consomme son API et sa gestion d’arrêt, sans second moteur de traduction.
- Le plan commun déduit actuellement du temps libre d’une durée longue. Cette formulation dépasse ce que les données prouvent ; elle doit être remplacée.
- Aucune utilisation actuelle de Screen Wake Lock trouvée dans le code lu.

Maquettes réellement relues, copies conservées dans le dépôt : `docs/maquettes/2026-10-18-mitsu-claude-code/maquettes/web/03_recette_enregistree.jpg` et `maquettes/mobile/03_recette_enregistree.jpg`, ainsi que les orientations visuelles déjà consignées. L’intégration a revu la capture mobile ; la revue C a revu les deux formats. La maquette web sépare Ingrédients/Préparation ; la mobile donne une bascule lisible. Le MD demande étape courante principale, ingrédients repliables, Précédent/Suivant accessibles, photo secondaire. Aucun écran dédié aux minuteries ou à Wake Lock n’a été trouvé dans ces fichiers : les dispositions ci-dessous sont des propositions issues du plan, pas des maquettes déjà validées. Conserver crème/olive, titres sobres, espaces et cinq destinations ; n’importer aucune donnée culinaire fictive des images.

## 3. Deux vraies zones et une zone persistante de minuteries

DOM cible, un seul exemplaire de chaque contenu :

```text
.mode-cuisine
  en-tête : titre du repas + recette active, Fiche, Terminer
  sélection des recettes + commande Plan commun
  état de conservation, langue L6 et option écran allumé
  .cuisine-contenu
    .cuisine-ingredients  (région nommée, portions, groupes/aliments L6)
    .cuisine-etape        (région nommée, note personnelle, étape complète)
  .cuisine-navigation   (Précédent / Suivant ou Terminer)
  .cuisine-minuteurs    (région nommée, indépendante des étapes)
  photo repliée / original consultable
```

Les deux régions sont des enfants directs distincts de `.cuisine-contenu`. Les minuteries restent montées lorsque le contenu d’étape ou le plan commun change. Les identifiants de région, recette/version et étape permettent des tests DOM et des liens de focus ; aucun sélecteur dépendant du texte traduit.

Sur largeur utile suffisante, ingrédients à gauche et étape à droite. Seuil proposé :900px **de zone disponible**, pas900px de fenêtre si la navigation latérale en consomme une partie ; repli une colonne dès que l’étape n’a plus une largeur lisible. Pas de colonne fixe340px imposée sur une tablette étroite. Les ingrédients peuvent défiler dans la page ; éviter deux zones de défilement obligatoires.

Sur téléphone, le sommaire Ingrédients est compact avant l’étape et ouvre la même région en place, sans changer de route ni de version. Les paragraphes de l’étape restent entiers. Une commande Revenir à l’étape restaure son focus/repère ; aucune modale obligatoire ni panneau couvrant les minuteries. L’état d’ouverture est conservé par version pendant le montage, entre étapes, bascules de recette et plan commun. Une recharge peut remettre ce panneau replié ; elle ne remet pas à zéro la progression ou les minuteries. Ce choix évite de créer un magasin pour une préférence de présentation.

Précédent/Suivant restent accessibles avec les zones sûres de l’appareil et la navigation existante, sans recouvrir la dernière ligne ni piéger le défilement. Au clavier, ordre du DOM cohérent, focus visible ; après une avancée confirmée, annoncer le numéro et placer le focus sur le titre d’étape seulement si le geste le demande. Une mise à jour de compteur ne déplace jamais le focus.

Pas de case de quantité sur un titre de groupe. Les portions inconnues restent inconnues, affichées comme telles ; aucun repli vers1. La photo reste repliée et les notes personnelles utiles sont proches de l’étape. Les boutons mesurent au moins44×44px et l’écran reste lisible à320/390/768/900/1280px, texte200%.

## 4. Recette active, progression et contexte

Le contexte actif est un ID de version dans `selected_version_ids`, jamais un index de tableau partagé implicitement avec une autre recette. Titre, Fiche avec `v=`, portions, langue projetée, ingrédients, étape, voix et nouveaux lancements utilisent ce même contexte. Plan commun garde la recette active en mémoire sans la remplacer.

Une ancienne session sans `active_version_id` choisit la première version admise de sa liste à l’ouverture. En revanche une référence active présente mais disparue n’autorise pas le remplacement silencieux par une autre version : afficher la cible indisponible et laisser choisir une autre recette. Ne jamais remplacer une version de session par le `current_version_id` récent de sa recette. Les références manquantes du repas sont signalées, sans supprimer leurs IDs ni leurs suivis de durée.

Conserver les fusions ciblées L0 : choisir une recette ne réécrit ni progression, ni portions, ni langue. Avancer écrit le pointeur d’étape et les étapes faites avant d’annoncer le succès ; deux gestes rapides sont sérialisés et restent attribués à leur version capturée. Une réussite tardive ne réactive pas la vue quittée. Les anciens `progress.current_step_id` et `progress.by_version` sont lus explicitement, sans remise à zéro à la reprise. Les étapes faites sont qualifiées par version dans les calculs ; une collision d’ID héritée entre deux versions ne signifie pas que les deux étapes sont faites. La forme persistante est `progress.format:2`, avec entrées par version et jetons de révision ; l’adoption pure conserve les preuves historiques ambiguës et précède le premier geste dans la même transaction locale (annexe §3–4bis).

Chaque mutation relit session active, appartenance de version, version exacte, propriétaire/DB/génération/époque et les captures L1/L2 autorisées. Conserver l’usage historique déjà admis des sessions ; il ne restaure jamais une recette ou une édition. Une version TM invalidée ne retrouve pas ses commandes par simple retour en cuisine. Ses suivis déjà conservés restent lisibles séparément de l’exécution bloquée.

Terminer ouvre toujours le bilan par recette et sa transaction existante. Les étapes terminées ne sont pas ajoutées seulement dans un objet mémoire avant un dialogue annulé. Une session clôturée garde ses suivis, sans les redémarrer ni prétendre arrêter Horloge. Si des suivis restent en cours, le bilan le dit. Retour à une session clôturée : consultation et échéances, pas de progression nouvelle sans geste de nouvelle session.

## 5. Minuteries : modèle et échéance réelle

### 5.1 Unités de données

Réutiliser `timer_launches` et l’index `cook_session_id`. Ne pas créer un minuteur nouveau à chaque redessin, reprise, tick ou réception sync. Une demande indépendante possède un ID réservé une seule fois ; le réessai d’écriture réutilise cet ID et son contenu capturé. Deux vrais départs intentionnels gardent deux IDs et sont nommés distinctement.

Conserver les champs historiques de demande. La nouvelle forme fermée est définie dans l’annexe §2 : `timer_format:1`, identités et durée, `mirror`, `source_timer:{ordinal,seconds,seconds_max,sha256}|null`, `legacy_launch_id`, snapshots titre/tâche, incarnation, révision et reçus. Le hash porte l’objet minuterie exact ; le libellé n’est pas substitué à cette preuve. Une reprise documentaire garde l’ancienne ligne et crée une nouvelle identité, sans inventer de source.

`channel` accepte shortcut/siri et mirror ; ce dernier possède dès sa création une ancre et `requested_at:null`, `handoff_state:null`. Snapshots d’affichage bornés à300 points Unicode avec ellipse explicite ; textes exacts consultables dans la source. Un titre traduit ne prouve aucune durée. Une version modifiée sous le même ID est refusée avant départ grâce à l’empreinte exacte capturée.

Durée choisie normalisée selon le contrat existant : entier de1 à86400 secondes. Pour une plage valide, choix explicite minimum ou maximum avant départ, sans moyenne ni préférence cachée. Conserver à la fois plage de source et durée réellement choisie. Deux tâches de même durée restent distinctes. Les durées ne sont jamais redétectées depuis une traduction.

`started_at` est l’instant UTC du geste explicite de démarrage du suivi ; `deadline_at = started_at + duration_seconds×1000` exactement. La transition d’un champ mirror absent/null vers sa première ancre est autorisée une seule fois sous CAS ; ensuite ces deux dates et la durée sont immuables. `requested_at` documente la demande système et n’est pas automatiquement confondu avec le début d’un suivi. Le validateur exige dates canoniques, bornes et égalité de l’échéance ; pas de date corrigée ou de seconde inventée silencieusement.

### 5.2 États et gestes réels

Chaque ligne montre recette, tâche, durée exacte ou plage avec choix retenu, suivi courant et état de demande système séparés. Au lancement depuis l’étape, la zone Minuteurs de la session reçoit la ligne ; changer de recette ne la cache pas. Filtrer par recette est possible, mais le nombre de suivis des autres recettes reste visible.

- **Démarrer un suivi indicatif** : conserver la ligne avec ancre, puis afficher le compte à rebours. Aucun lien système et aucune promesse de son.
- **Siri** : montrer la phrase. Le geste « J’ai demandé à Siri » est une déclaration humaine, pas une confirmation d’Horloge ; il peut démarrer un suivi indicatif à cet instant clairement nommé. Ne pas dire que l’app a demandé à Siri.
- **Raccourcis** : conserver d’abord une demande préparée, sans prétendre que le raccourci s’est ouvert. Présenter ensuite le vrai lien explicite « Ouvrir Raccourcis » ; le navigateur peut l’ignorer/refuser. Pas de lancement automatique après un await qui a perdu l’activation utilisateur. Au retour, l’état reste non confirmé. Le suivi commence uniquement au geste explicite « Démarrer le suivi indicatif maintenant », pas lors d’un délai supposé de l’alarme système.
- **Ça n’a pas démarré** conserve ce signalement humain et laisse le texte/les options accessibles. Cela ne prouve pas qu’aucune minuterie système n’existe.

Ce parcours en deux gestes pour Raccourcis est retenu après revue technique : il garantit l’enregistrement préalable et évite de présenter la préparation comme le démarrage. Aucune demande système relancée automatiquement après recharge, quota, retour d’arrière-plan ou acquittement sync perdu.

Ne pas ajouter Pause/Reprendre à une alarme système que Mistu ne peut commander. Pour un nouveau suivi, repartir sur une nouvelle intention explicite ; ne pas modifier l’échéance d’un suivi existant. L’affichage des suivis écoulés peut être replié sans supprimer leur historique. Le masquage de présentation ne dit jamais « alarme arrêtée ».

### 5.3 Calcul, reprise et horloge

À chaque rendu : `reste_ms = max(0, deadline_ms - maintenant_ms)` ; secondes affichées par plafond pour ne pas annoncer zéro trop tôt. L’état écoulé dépend de `maintenant_ms >= deadline_ms`. L’intervalle ne sert qu’à rafraîchir le texte, jamais à décrémenter la donnée. Aucune écriture par seconde, aucun heartbeat serveur, aucun minuteur permanent dans le service worker. Le standard HTML ne garantit pas l’exécution ponctuelle des callbacks : [HTML, Timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers).

À ouverture, recharge hors ligne, retour visible, `pageshow` et réception de données : relire les lignes de la session puis recalculer depuis l’échéance conservée. Les deux mêmes échéances doivent donner le même résultat à une horloge injectée identique, indépendamment du nombre de callbacks manqués. Afficher « Temps indicatif écoulé » ; jamais « l’alarme a sonné ».

Le temps dépend de l’horloge de l’appareil. Changement de fuseau/DST ne modifie pas les instants UTC. Si une incohérence détectable apparaît (heure antérieure au départ, écart anormal entre horloges pendant une période continuellement visible), indiquer « Heure de l’appareil modifiée : vérifie dans Horloge », garder les dates originales et ne pas décaler l’échéance. Une recharge ne permet pas de détecter toutes les corrections d’horloge : cette limite reste explicite, particulièrement sur un autre appareil.

Une ligne historique sans `mirror` reste une demande documentée, sans réinventer le début réel d’un suivi à partir de `requested_at`. Proposer un nouveau suivi maintenant par un geste ; aucun compte à rebours ressuscité automatiquement depuis une vieille archive. Une ligne inconnue/invalide reste consultable avec motif, sans commande active ni correction implicite.

### 5.4 Lecture, conservation et concurrence

Lire les minuteries par l’index de session directement dans le service ; ne pas charger tous les lancements de la bibliothèque à chaque tick. Rendre les actifs puis les écoulés, tri déterministe échéance/ID ; paginer l’historique sans cacher un actif derrière une limite arbitraire. Le panneau est abonné aux mutations pertinentes, libère abonnements/intervalles au dispose, et ignore les réponses d’un ancien montage. Chargement/refus de lecture sont distincts d’une session sans minuterie. Le texte du compte à rebours n’est pas une région live annoncée chaque seconde ; annoncer une seule fois le changement d’état écoulé par montage, sans son automatique ni déplacement de focus.

L’écriture de départ fait ses gardes et son insertion atomiquement, avant le statut conservé. Réessai exact du même ID = même résultat ; même ID différent = conflit. Quota, session close, recette/version modifiée ou propriétaire remplacé : aucune ligne partielle, aucune fausse échéance durable. La vue propose réessayer l’écriture avec la même intention ou abandonner cette intention, sans lancer un autre service.

Une mise à jour d’état de demande fusionne uniquement le champ visé sous CAS exact ; elle ne peut perdre l’ancre `mirror` reçue ailleurs. Un ancien put/REST ne peut effacer ou remplacer une ancre déjà conservée. La migration0012 protège sessions et lancements ; la branche fermée `cooking_apply` de `sync_push_v2` fournit les CAS et reçus limités à ces deux magasins. Pas de nouveau magasin ni de protocole général de mutation. Tant que la capacité de protection requise manque, laisser la commande en attente expliquée, sans repli qui détruit les champs.

Synchronisation et archive transportent les dates/textes conservés, pas un temps restant calculé. Sur un autre appareil, la ligne indique son origine et « suivi indicatif » ; aucun départ Siri/Raccourcis, son ou Wake Lock implicite. Restaurer une archive ne programme aucune notification. Les internes du contrôleur, sentinelles, intervalles et choix temporaire d’ouverture restent hors archive.

Aujourd’hui permet d’ouvrir les suivis d’une session active ; une session terminée dont un suivi n’est pas écoulé doit rester accessible par son lien exact. Le panneau peut afficher les suivis même lorsque la version est devenue non exécutable. Aucune création automatique de session depuis une ligne orpheline.

## 6. Écran allumé : demande révocable et repli

L’API est réservée à un contexte sécurisé et à un document visible ; le navigateur ou le système peut refuser ou libérer la demande, notamment pour des choix d’énergie. La disponibilité doit être détectée par capacité, sans déduire une réussite du nom du navigateur. Référence vérifiée : [Screen Wake Lock, W3C](https://www.w3.org/TR/screen-wake-lock/). WebKit annonce son support dans les apps de l’écran d’accueil d’iOS/iPadOS18.4 ; cela ne prouve pas le comportement de l’appareil de Neegan : [WebKit, Safari18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).

Option **Garder l’écran allumé**, désactivée par défaut à l’entrée. Elle exprime une intention locale à cette vue ; ne pas la synchroniser ni la réactiver après recharge sans geste. États fermés du contrôleur : indisponible, désactivé, demande en cours, actif, libéré, refusé. « Actif » exige une sentinelle reçue non libérée, pas seulement une case cochée.

Une seule demande en vol et une seule sentinelle par contrôleur. Au passage masqué, libérer la sentinelle et son listener release ; garder les listeners du contrôleur, notamment visibilitychange, pour observer le retour visible. À la sortie/dispose, les retirer tous. Une résolution tardive après désactivation/dispose doit immédiatement libérer son résultat. Au retour visible, si l’option reste voulue dans cette même vue, tenter une seule acquisition pour cet événement, sans boucle après refus. Un release reçu alors que la page est encore visible affiche l’état et propose Réessayer ; ne pas contredire le système en redemandant en boucle. Les erreurs et `release()` rejetés sont capturés sans promesse non gérée.

Repli lisible : « Le navigateur ne maintient pas l’écran allumé. Tu peux continuer à cuisiner. » Pas de vidéo invisible, fausse lecture audio, plein écran forcé ni réglage système modifié. Éteindre volontairement/verrouiller son appareil reste possible. Aucun lien entre Wake Lock et fiabilité de la sonnerie ou maintien d’une tâche en arrière-plan.

## 7. Langue, clavier, quantités et plan commun

Consommer le projecteur L6 : texte, groupes, manques et `langReelle` identiques à la fiche. La voix s’arrête au changement d’étape, recette, langue, route et fermeture ; aucune voix lancée à la reprise d’une session. Une langue inconnue ne devient pas française par défaut. Aucun nouvel appel assistant dans L7.

Quantités selon les portions de cette version/session, avec les gardes TM et unités existantes. Un nom cité dans le texte n’autorise pas à deviner son groupe ou une quantité : ouvrir les ingrédients de la recette. Le lien direct vers une ligne n’est autorisé que lorsqu’une relation d’ID fiable existe déjà ; sinon le texte reste normal. Deux beurres dans deux groupes ne donnent jamais un seul chiffre arbitraire. Pas de nouvelle extraction automatique de mentions dans L7.

Raccourcis clavier proposés : flèches gauche/droite seulement lorsque la région d’étape a explicitement le focus. Ignorer événements déjà traités, répétition maintenue, composition, Ctrl/Alt/Meta/Shift, champs, contenteditable, boutons, liens, sélecteurs, summary et dialogue ouvert. Utiliser exactement les commandes gardées Précédent/Suivant ; pas d’écriture parallèle ni de Terminer déclenché par une flèche sur la dernière étape.

Plan commun : liste par recette, progression connue et durées citées. Remplacer « cette attente libère du temps » et « pendant ce temps : autre recette » par une indication documentaire de durée, sans disponibilité déduite. Températures éventuellement rapprochées : « Températures à vérifier », jamais conflit d’appareil déduit sans appareil, chevauchement et contexte connus. L7 ne calcule ni heure optimale de service, ni créneaux de cuisson sûrs.

## 8. API et répartition

L’annexe §7 définit le service `creerServiceCuisine`, les intentions opaques, les résultats confirmés et les raccords UI. Les producteurs de session continuent de créer une session legacy gardée ; aucun put ordinaire ne crée V2. Le premier geste conserve adoption puis commande dans une transaction locale, sans appel assistant.

| Volet | Propriétaire | Fichiers et preuves |
|---|---|---|
| A | Domaine et persistance | Domaine cuisine/timers/thermomix-session, dépôt/DB/sync/archive, SQL0012 et générateurs ; CAS, réessai, ACK perdu, restauration, concurrence réelle |
| B | Écran cuisine et fin | cook.js, accueil/session, recipe.js/meals.js et cuisson.js (raccord A) ; deux régions, progression, versions exactes, clavier, clôture |
| C | Minuteurs et écran allumé | Panneau minuteurs, contrôleur Wake Lock, timerBlock de components.js, Siri/Raccourcis ; dispose et courses asynchrones |
| Intégration | Root | CSS/i18n, notifications ciblées interonglets, app/state, runner/cache/version, parcours et publication |

`/cook/*` est déjà protégé du remontage global après une passe de synchronisation dans `ROUTES_DE_SAISIE`. Le besoin neuf est une notification ciblée après commit, suivie d’une relecture dans IndexedDB ; ne pas annoncer un défaut de remontage absent du code. Conserver contrôleurs, ingrédients ouverts et candidate L6 locale au montage ; après rechargement réel, plusieurs candidates imposent un choix explicite. Aucun contenu du canal interonglets n’est adopté comme donnée métier.

## 9. Points de revue et preuves encore nécessaires

1. Deux régions DOM et panneau indépendant retenus ; géométrie à prouver sur largeurs utiles et texte200%.
2. Formes, incarnation anti-rejeu après restauration, adoption pure, reçus128 et capacité0012 fermés dans l’annexe. Archive6, sans changement IndexedDB.
3. Raccourcis en deux gestes et miroir explicitement séparé retenus ; ouverture native et alarme restent non vérifiables par l’app.
4. Progression qualifiée par version, absence de substitution de version, clôture atomique locale retenues. Le transport du bilan demeure progressif : historiques puis manifeste exact de clôture ; aucune atomicité serveur globale revendiquée.
5. États Wake Lock et matrice physique retenus ; aucune preuve iPhone/son matériel déduite de Chrome automatisé.

Le [plan de tests et réception](../plans/2026-10-29-l7-cuisine-minuteurs.md) détaille les rouges et parcours à obtenir. Aucun test L7, essai physique, lancement système ni code L7 n’a été exécuté pendant cette rédaction.
