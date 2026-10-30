# L7 — Plan de construction et réception cuisine

**30 octobre 2026 — contrat technique fermé, construction à venir.** [Spec](../specs/2026-10-29-l7-cuisine-minuteurs-design.md), [protocole](../specs/2026-10-30-l7-protocole-cuisine.md), plan directeur §13 et maquettes relues. Base publique L6 code87855c4/reçu c5b6c08, 10161/10161 tests publics. Cible0.29.0/cache0.29.0-1, DB6/archive6, SQL0012 et cooking_persistence1. Aucun code, test ou essai physique L7 réalisé à cette revue ; autorisation générale de poursuivre, aucune relecture personnelle de Neegan inventée.

## 1. Avant le premier code

- Relire la base effectivement publiée et les API L6 : projecteur commun, groupes, langue réelle et voix. Ne pas copier un second moteur dans Cook.
- Fait à la revue : cinq points de §9 fermés dans la spec et son annexe ; propriétaires désignés, progression V2, incarnations, reçus et protections arrêtés. Interfaces complètes consignées avant le premier code.
- Mesurer les enveloppes utiles : session multi-recettes, historique1000 lancements, snapshots longs, dates limites et références absentes. Pas de plafond d’affichage qui cache des suivis actifs ; pas de nouvelle limitation des anciennes sessions sans message.
- Écrire les fixtures/vecteurs avant le service : horloge de départ fixe, deux versions dont les IDs d’étape se ressemblent, portions différentes, plage30–90s, suivi déjà écoulé, demande système sans suivi, ligne legacy et ligne invalide.
- Fait à la revue : cible0.29.0/cache0.29.0-1, DB6/archive6, SQL0012/cooking_persistence1 depuis L6 publié. Aucun SQL appliqué à distance pendant la construction.

## 2. Tests rouges par tranche

### T1 — Durée et projection pure

Créer `tests/l7-minuteurs.js`. Durée1/86400, fractions normalisées selon contrat historique,0/négatif/NaN/infini/hors borne refusés ; plage valide, min=max, plage inversée et maximum absent. Choix minimum/maximum préservé, jamais moyenne implicite. Source de la minuterie exacte par version/étape/ordinal, texte traduit sans influence.

Vecteurs : départ12:00:00.000, durée90s → échéance12:01:30.000 ; maintenant12:00:30.250 →60s affichées par plafond ; à12:01:30.000 →écoulé. Exécuter zéro callback pendant70s puis un seul rendu : même résultat qu’avec70 ticks. Aucun compteur négatif, aucun timer relancé après zéro. UTC identique sous deux fuseaux/DST. Dates invalides, échéance incohérente ou recul d’horloge : état expliqué et données originales intactes.

Les anciennes demandes sans ancre ne démarrent pas un miroir à l’ouverture. Inconnues/invalides : lecture documentaire sans action automatique. Les snapshots ne deviennent pas une source de quantité, d’allergène ou de consigne TM.

### T2 — Dépôt, ID et concurrence

Créer `tests/l7-minuteurs-depot.js`. Départ atomique après capture ; même intention/réessai après quota =même ID/ancre, double clic désactivé ; même ID avec contenu différent refuse. Quota, session supprimée/terminée, version absente/modifiée, retrait/restauration et changement de propriétaire/DB/génération/époque avant commit : absence d’effets partiels/outbox.

Deux onglets sur la même demande : démarrer le suivi puis signaler un échec système ne perd pas l’ancre ; un état périmé ne l’efface pas. Écriture tardive après dispose peut se conserver dans sa portée autorisée mais ne redessine pas/relance pas de contrôleur. Relecture après commit donne exactement dates/durée choisies.

Si le contrat exige une garde serveur, produire mêmes fixtures signées en PostgreSQL UTF8 jetable : création, ancre immuable, ancienne écriture qui omet les champs, generic RPC/REST, reprise idempotente et capacité manquante. Ne pas prétendre des garanties interappareils sur le seul test IndexedDB.

### T3 — Session et progression

Créer `tests/l7-session-cuisine.js` et conserver tous les scénarios `l0-cuisine.js`. A→B change titre/Fiche/version/portions/ingrédients/étape et futur minuteur ensemble ; retour A retrouve son étape. Clics rapides et latences inversées : dernier geste confirmé, aucune fusion entière d’un vieux snapshot.

Une mise à jour de recette active ne perd pas progression/langue/portions concurrentes. Ancienne session avec `current_step_id` seulement reprise exactement ; collision d’ID d’étape entre versions ne marque pas l’autre recette faite. Étape disparue ou version active absente : état lisible et choix explicite, aucune substitution par la version courante de la recette.

Portionsnull restentnull. Versions TM aux quantités incompatibles restent bloquées, suivis déjà enregistrés consultables. Le dernier bouton Terminer puis annulation du bilan ne marque pas seulement en mémoire une étape comme définitivement conservée ; confirmer bilan conserve cuissons/clôture avec les gardes I2/L1/L2 actuelles.

### T4 — Interface à deux régions

Créer `tests/l7-cuisine-ecran.js`. Observer des enfants DOM distincts ingrédients/étape et leur géométrie réelle à largeur utile suffisante ; ne pas tester seulement l’existence de `display:grid`. Sur320/390 : étape principale, ingrédients ouvrables en place, navigation atteignable sans recouvrement. Ouverture conservée par version entre étapes, recettes et plan commun ; rechargement peut replier sans perdre métier.

Titre long, note personnelle longue, ingrédients/groupes L6 et étape multiligne entière. Focus après changement d’étape et retour des ingrédients, pas de focus volé par tick. Photo secondaire, aucune erreur d’image qui bloque la session. États manquants, session close et recette retirée rendus sans fabriquer de version.

### T5 — Minuteurs indépendants et demandes système

Créer `tests/l7-minuteurs-ecran.js`. Lancer deux suivis sur deux recettes ; changer étape, recette, plan commun, taille et langue : mêmes IDs/échéances toujours présents dans le panneau. Recharger et ouvrir par Aujourd’hui : valeurs calculées depuis stockage. Session terminée avec suivi restant : lien exact toujours accessible, sans réactivation de progression.

Siri : phrase exacte et déclaration humaine ; aucun appel à Siri. Raccourcis : première étape conserve la préparation, second vrai geste ouvre le lien ; refus d’écriture ne laisse aucun lien d’ouverture annoncé prêt. Le suivi commence seulement au geste nommé. Bloquer l’URL externe dans les tests ; constater son intention ne prouve pas une ouverture native.

Plage : choix précis identique dans phrase, URL, stockage et suivi. Inconnue/invalide : aucun lien actif. Réessai d’enregistrement sans second départ externe. État opening tardif/retour page n’invente pas un accusé Horloge. « Ça n’a pas démarré » garde l’historique, ne prétend pas annuler l’alarme.

### T6 — Contrôleur Wake Lock et clavier

Créer `tests/l7-ecran-allume.js` avec faux document et fausses sentinelles. Absent/insecure, refus, succès, release système, masquage puis retour, double activation, désactivation pendant Promise, dispose avant résolution, libération rejetée. Une seule demande en vol/sentinelle ; résultat tardif libéré ; aucun listener restant. Retour visible : une tentative si encore voulu, aucune boucle après refus ; montage/recharge n’acquiert rien sans geste.

Statut Actif seulement avec sentinelle non libérée. Contrôler absence de modification de session/minuterie lors d’un refus de Wake Lock. Pas de média caché ni de contournement d’énergie.

Clavier : flèches seulement sur la région d’étape focalisée ; champs, bouton/lien/select/summary/contenteditable, composition, répétition, modificateurs et dialogue exclus. Dernière étape : flèche ne clôture pas la session. Commande gardée identique au bouton, pas de deuxième chemin métier.

### T7 — Compatibilité, langue, archive et plan commun

Rejouer suites L0, I2 cuisine, I3, L1 historique, L4 titres et L6 lecture/voix/TM. Fiche et cuisine utilisent même texte et même `langReelle`. Stop voix au changement/sortie ; aucune lecture automatique au retour.

Plan commun : durées documentaires, aucune durée longue présentée comme travail libre, aucune température TM assimilée à un four. Ambiguïté de deux beurres : ouvrir les ingrédients, ne choisir aucune quantité arbitraire.

Exporter/restaurer avec dates, plages, IDs et provenance ; calcul après restauration à une horloge fixe, aucun appel externe ni permission/son acquis automatiquement. Deux clients : même échéance, horloges explicitement locales, aucune copie qui relance une demande système. Ancien client ne supprime pas une ancre protégée ; lignes historiques toujours consultables.

## 3. Parcours réel Chrome local puis public

Contexte jetable, réseaux externes bloqués, aucune donnée privée/appel assistant. Harnais public avec fixture injectée, sans module `.superpowers` demandé au site. Pas de `waitForFunction` async ; attendre événements/états réels et horloge injectable.

1. Repas A/B, portions4 et inconnues, version exactes, groupe de beurre pâte/sauce et étape multiligne. Ouvrir ingrédients, Suivant, B, retour A : titre/Fiche/contenu/progression/état d’ouverture cohérents.
2. Démarrer un suivi90s depuis A et un autre120s depuis B. Garder panneau visible à chaque changement ; noter les IDs/échéances et le compte de lignes réellement écrit.
3. Avancer l’horloge contrôlée sans exécuter tous les ticks ; masquer/réafficher puis recharger vraiment hors ligne. Même échéance et reste calculé, état écoulé sans prétendre une alarme.
4. Deux onglets : progression concurrente, session terminée ailleurs, quota injecté et bibliothèque remplacée. Refus causal, aucune ancre perdue, aucune mise à jour d’ancienne vue. Sauvegarde/reprise par Aujourd’hui.
5. Parcours Siri/Raccourcis avec interception du schéma externe : bonne durée/étape, préparation durable et geste séparé. Aucun vrai service système invoqué en automatisation.
6. Wake Lock injecté : succès/refus/release/retour/dispose ; si Chrome visible expose réellement l’API, observer aussi sa sentinelle dans un profil jetable sécurisé. Cette observation ne prouve pas que l’écran matériel est resté allumé.
7. Fin de cuisson annulée puis confirmée ; notes/photos/historique conservés, suivis restant accessibles. Archive restaurée, mêmes données, aucune action externe automatique.

Captures et mesures à320/390/768/900/1280px, texte200%, tablette portrait/paysage émulée, clavier seul et reduced-motion. Vérifier deux colonnes réelles lorsque la largeur utile le permet, sinon repli lisible ; zones sûres, dernier paragraphe, barre Précédent/Suivant, panneau Minuteurs, état écran, noms très longs. Relire les captures visuellement. Contrôler cache unique et modules nouveaux, puis reload réseau coupé avant de rétablir la connexion.

## 4. Ce que les preuves permettent d’annoncer

| Preuve | Ce qu’elle démontre | Ce qu’elle ne démontre pas |
|---|---|---|
| Horloge/service injectés | Calcul depuis échéance, CAS, absence d’effet partiel et transitions prévues | Horloge matérielle exacte, exécution continue en arrière-plan |
| Chrome automatisé +IndexedDB | DOM, focus, géométrie, rechargement/hors ligne et données réellement conservées | Clavier tactile, verrouillage réel, PWA Safari, son système |
| Sentinelle Wake Lock réelle en Chrome visible | API accordée/libérée dans ce navigateur et ce contexte | Écran physiquement allumé pendant la durée, autres OS/appareils |
| URL Raccourcis interceptée | Intention explicite, bonne URL/durée et ordre des écritures | Raccourci installé, autorisation, minuterie Horloge en marche |
| Archive/sync en base jetable | Données et dates conservées, protections de compatibilité vérifiées | Synchronisation d’horloges, alarmes transférées entre appareils |

## 5. Réception physique à consigner séparément

Préparer une fiche de test à réaliser sur ordinateur Chrome visible, iPhone/Safari et PWA installée ; tablette en portrait/paysage, Android/Chrome si cet appareil est dans les usages retenus. Consigner modèle, OS, navigateur/version, mode installé/onglet, alimentation et économie d’énergie, date et résultat observé.

- Écran allumé demandé, période sans toucher de durée supérieure au verrouillage automatique configuré ; refus/révocation, passage arrière-plan, verrouillage volontaire et retour. Contrôler l’écran réel, pas uniquement un badge dans l’app.
- Siri demandé humainement et raccourci réellement installé : contrôler dans Horloge la durée, le départ et le son ; changer d’app puis verrouiller. Documenter les échecs et le repli manuel. Ne pas attribuer ce son au miroir Mistu.
- Fermer/recharger la PWA, réseau coupé, puis reprendre les deux recettes et leurs suivis ; comparer les dates conservées. Vérifier le clavier physique/tactile, le zoom, les cibles et la voix audible dans la langue réelle.

Sans ces essais, annoncer exactement les preuves Chrome obtenues et laisser ces cases non vérifiées. L7 peut présenter un suivi indicatif avec repli ; aucune réception automatisée ne permet d’affirmer une notification fiable en arrière-plan.

## 6. Livraison

Conserver tous les scénarios anciens et leurs assertions causales ; adapter seulement les attentes réellement changées (parcours Raccourcis explicite, demande legacy sans miroir fabriqué, plan documentaire). Ciblés puis intégrés, syntaxe/diff, Node/générateur, SQL UTF8 si requis, captures et rapport. L’épingle est mesurée, jamais diminuée pour masquer un scénario interrompu.

Après revue/intégration et autorisation existante : version/cache, capacité éventuelle vérifiée, Pages réellement construit, empreintes publiques identiques et parcours public. Aucun déploiement ni migration dans cette phase documentaire. Consigner les futures preuves sous `.superpowers/sdd/2026-10-30-l7/`, puis mettre STATE à jour sur faits observés. L7 et les lots suivants restent non réalisés à ce stade.
