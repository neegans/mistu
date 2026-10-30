# L8 — Repas, courses et inventaire explicites

**30 octobre 2026 — contrat fermé après revues techniques A/B/C/root ; construction autorisée par la poursuite du plan.** Aucune relecture personnelle attribuée à Neegan. Base publique L7 :0.29.0/DB6/archive6, code8fb0784/reçu f7e836a,10653/10653 tests publics. Cible L8 :0.30.0/DB6/archive7, migration0013 additive, capacité inventory_changes1. [Protocole et API figés](2026-10-30-l8-protocole-inventaire.md) avant code. Aucun test L8 annoncé réussi par cette rédaction.

Référence : [plan directeur, §14 et L8](../../lots/2026-10-29-plan-directeur-interface-fonctions.md). Construction : [plan L8](../plans/2026-10-29-l8-repas-inventaire.md). Ce document ne modifie ni le contrat L5, ni ceux de L6/L7.

## 1. Résultat attendu et limites

Garder une envie sans date, prévoir un repas avec ou sans heure, retrouver ses courses et enregistrer ce qui reste après cuisson. Les mêmes repas, versions, listes et lots existants restent utilisés. Une action qui modifie un stock demande toujours une décision explicite sur ce lot et cette quantité.

Le lot ajoute une organisation légère par jour, des lignes libres et rayons dans les courses, un inventaire modifiable avec quantité restante cohérente et consommation annulable, puis un accès aux restes depuis une cuisson réellement enregistrée. Il ne construit ni calendrier externe/récurrent, ni réservations automatiques de stock, ni calcul de durée de conservation, ni liste collaborative temps réel, ni moteur de recommandations selon les restes. Aucun appel assistant nouveau.

## 2. Audit de l’existant

Lecture du code courant, pas simple reprise du constat0.21.1. Les points ci-dessous sont confirmés par inspection ; ils ne constituent pas une réception navigateur de L8.

| Domaine | Déjà présent | Manque ou incohérence à traiter |
|---|---|---|
| Repas | `meals.js` : titre, rôles, plusieurs versions exactes, portions par élément, contraintes, remplacement/verrouillage, duplication et retours | `serve_at:null` existe, mais la liste mélange ces repas avec les dates de création ; pas de groupe visible « À cuisiner bientôt », ni jour sans heure |
| Horaires L0 | `heure-locale.js` et `champHeureRepas` : instant UTC, édition locale, heure inexistante refusée, choix des deux occurrences, CAS du champ horaire | À conserver ; une nouvelle date sans heure doit rester civile, sans imposer minuit |
| Gestion du repas | Écriture ciblée de champs, contexte historique des membres conservés | Ajout au repas part d’une copie de contexte ; changements de `items` peuvent remplacer une liste concurrente. Comparer la structure attendue, conserver les autres champs |
| Courses | `grocery.js` : scaling, identité vérifiée sinon nom normalisé, dimensions séparées, détail par recette, cases durables | Pas de ligne libre/rayon, pas de sections Acheté/Encore à acheter ; détails sans retour exact à la recette ; modification d’un repas ne met pas à jour une ancienne liste |
| Partage L0 | Même préparation pour Copier/Partager, choix restants/complet, attente des cases en cours, annulation de partage distincte d’une erreur | À réutiliser, sans seconde fonction d’export ni perte des cases |
| Inventaire | `kitchen.js` : emplacement, texte libre, portions, source/version, dates, notes, qualité, réchauffage | Formulaire dense ; pas de Modifier ; −1 portion garde l’ancien texte libre ; Consommé supprime la ligne ; dates civiles transformées en instants UTC |
| Carnet/restes | `cuisson.js` : note, photo, date, portions, temps réel, version exacte et fin de session atomique/idempotente | Pas de lot de restes issu de la cuisson confirmée ; aucun stock actuellement retiré automatiquement — invariant à préserver |
| Cycles | L1/L2 protègent recettes/versions et références historiques de repas, listes et lots | Nouveaux usages actifs à garder distincts de la modification d’un historique ; aucun stock ou repas ne doit restaurer une recette |
| Synchronisation | Magasins `meals`, `shopping_lists`, `inventory`, `cook_history` déjà synchronisés/archivés ; conflits génériques disponibles | Le put horodaté d’un stock ne prouve pas que deux diminutions ont la même base. Une révision attendue et un reçu sont nécessaires pour les nouveaux gestes de stock |

### 2.1 Maquettes réellement consultées

Lecture de `docs/maquettes/2026-10-18-mitsu-claude-code/03_PARCOURS_ET_DIRECTION_VISUELLE.md` et inspection des images `maquettes/mobile/03_recette_enregistree.jpg` et `maquettes/web/01_bibliotheque.jpg`. Elles montrent des titres lisibles, source discrète, quantités proches des aliments, boutons accessibles et contenu qui défile naturellement. Reprendre les composants de L3/L4 et cette hiérarchie, sans panneau technique dominant.

Ce dossier ne contient aucun écran Repas/Courses/Inventaire : les dispositions ci-dessous sont une proposition adaptée, pas une reproduction de maquette existante. Les captures d’autres projets trouvées sur le disque ne font pas partie des références Mistu. Vérifier320/390/768/1280px, texte200 %, clavier et cibles44px ; ne pas diminuer les caractères pour faire tenir le contenu.

## 3. Repas : envies, jours et heure facultative

### 3.1 Navigation et gestes

Conserver les routes `/meals`, `/meals/:id`, `/lists/:id` et `/kitchen?tab=inventory`. Libellé proposé pour l’entrée actuelle « Ma semaine » : **Repas**, avec sections **À cuisiner bientôt**, **Prévus**, **Passés** et accès aux **Courses**. Les repas sans date ne portent pas leur date de création comme date prévue. Les repas passés ne sont ni supprimés ni déclarés cuisinés automatiquement.

Sur une recette/version active : **À cuisiner bientôt** crée, après conservation, un repas d’un seul élément, sans dialogue de titre obligatoire et sans date. L’ID du repas et de l’élément sont réservés pour le geste ; double clic/réessai ne créent pas deux envies. Une envie identique déjà active peut être proposée à ouvrir, sans fusion implicite de repas distincts. **Ajouter à un repas** conserve le sélecteur existant pour composer plusieurs plats.

Fiche repas : actions visibles **Ajouter un plat**, **Planifier**, **Voir mes courses**, **Cuisiner ensemble**, puis **Refaire ce repas** et **Archiver ce repas**. Pas de nouveau système de menus. La duplication garde les versions exactes, portions et contraintes, attribue de nouveaux IDs aux éléments, enlève date/heure et repart active. Une référence d’index reste ajoutable comme envie, avec ingrédients inconnus ; elle ne fabrique pas de version ni de courses.

**Planifier** demande un jour civil. L’heure reste facultative. Avec heure, réutiliser intégralement la conversion/ambiguïté L0 ; sans heure, ne stocker aucun instant UTC fictif. **Retirer la date** remet dans À cuisiner bientôt. **Archiver** retire seulement le repas des groupes actifs ; accès et retour depuis Archives, indépendamment de la corbeille des recettes. Terminer une cuisson n’archive pas le repas sans geste.

### 3.2 Champs minimaux proposés dans `meals`

- `planned_on: null | 'YYYY-MM-DD'` : jour sans heure, calendrier valide. Valeur non nulle seulement si `serve_at` est nul.
- `serve_at` inchangé : instant quand une heure est réellement choisie ; `planned_on` alors nul. Date/heure se modifient ensemble sous CAS du couple. Les anciennes valeurs `serve_at` sont conservées exactement, secondes et occurrence répétée comprises.
- `archived_at: null | ISO` : absent signifie actif. Aucune confusion avec `trashed_at` des recettes.
- Identités, rôles, versions et portions de `items` restent ceux de l’existant. Pas de magasin « envies » ni de copie du contenu des recettes.

Groupement : sans les deux dates → envie ; jour civil → ce jour dans tous les fuseaux ; instant → son jour dans le fuseau d’affichage, selon L0. Un changement de fuseau ne convertit jamais `planned_on`. Tri stable, titre affiché prioritaire, original/source/version accessibles. Restaurer un repas archivé n’autorise pas automatiquement les nouveaux usages de ses recettes retirées.

### 3.3 Concurrence et quantités du repas

Capturer avant le dialogue : portée du compte/DB/époque, ensemble ordonné des éléments concernés et versions affichées. À l’enregistrement, comparer les champs que le geste remplace. Une correction de titre indépendante n’est pas écrasée par une modification de portions ; un ajout concurrent d’élément provoque une comparaison ou une fusion explicitement définie par ID, jamais le remplacement silencieux du tableau.

Distinguer portions inconnues, portions globales et choix propre à l’élément. Avec `servings_custom:true`, `servings:null` signifie explicitement inconnu et prime sur les portions du repas, pour toute version. Sans choix propre, l’élément hérite des portions globales, elles-mêmes éventuellement nulles. Aucun `||` ni repli vers le rendement de la recette ne transforme un objectif inconnu en nombre. Le raccord borné de `portionsRepas` porte ce sens jusqu’à la liste et à l’instantané de session ; une ancienne valeur explicite ne change pas au simple rendu.

Pour un objectif inconnu ou un rendement d’origine inconnu, les aliments et quantités d’origine restent consultables avec **Quantités d’origine, portions non ajustées**. Ces valeurs documentaires ne participent pas au total numérique présenté comme besoin du repas ; elles restent dans le détail et le texte partagé, avec la même mention. Les besoins connus des autres plats continuent à se sommer. Choisir ensuite les portions est un geste explicite, suivi de Revoir les courses pour une liste existante.

Les changements de portions ne convertissent pas une version TM dont les réglages portent sur une autre quantité. Les gardes I3 restent inchangées ; un objectif inconnu ne contourne pas un refus. Reprendre le contrat de session livré par L7 : une session créée conserve son propre instantané et ne suit pas les modifications ultérieures du repas.

## 4. Courses cohérentes et utiles

### 4.1 Liste existante et quantités

Une liste conserve ses versions/portions et conventions exactes ; changer le pointeur courant d’une recette ou sa convention actuelle ne la recalcule pas. La génération n’écrit ni recette, ni inventaire. Grouper seulement selon les identités et unités admises aujourd’hui : aucune addition masse/volume sans conversion justifiée, aucun heading de L6, aucune quantité issue du seul texte traduit. Les quantités inconnues et unités ambiguës restent détaillées ; aucune valeur0 de substitution.

Le moteur actuel retient la borne haute d’une plage pour l’achat. Garder le détail source et annoncer cette borne comme choix d’achat, pas comme quantité exacte de la recette. Le détail indique recette/version/portions et offre un vrai lien avec retour L3. Une recette retirée reste consultable depuis sa liste historique, avec sa mention de cycle.

Chaque élément nouvellement conservé dans `shopping_lists.items` porte `convention_snapshot:null|{id,revision,values}`, copie validée de la convention effectivement confirmée pour le calcul. Cette forme existe déjà dans les provenances de recettes ; un instantané de provenance peut être repris seulement s’il est réellement celui du calcul affiché. Le moteur consomme les valeurs conservées, sans relire la définition actuelle par ID. La projection de base inclut cet objet complet : un hash ou un ID seuls ne permettent pas de reconstruire une ancienne convention.

Une liste historique sans instantané ne reçoit aucune convention supposée au chargement. Elle garde éléments, cases et lignes libres ; les mesures dépendant d’une convention restent documentaires/non additionnables tant qu’aucune preuve exacte n’est disponible. Une mesure indépendante, telle qu’un gramme, garde son calcul. **Revoir les courses** permet de choisir explicitement une convention et montre le changement avant conservation. Ne pas prétendre retrouver un ancien total qui n’a jamais été conservé.

### 4.2 Cases, lignes libres et rayons

Sections **Encore à acheter** et **Acheté**, avec compteurs issus des lignes réellement rendues. Cocher signifie uniquement « acheté » pour cette liste. Cela ne crée aucun stock et ne prouve pas une consommation. Conserver les cases par clé stable, y compris hors ligne et lors du changement de section. Copier/Partager utilise la préparation L0 et le même choix restants/complet ; une annulation du partage n’est pas un échec de sauvegarde.

**Ajouter une ligne** : libellé obligatoire, quantité libre facultative, rayon facultatif. Pas d’identification automatique dans le lexique. Champs proposés dans `shopping_lists` :

- `manual_lines:[{id,label,quantity_text,aisle}]`, IDs stables, aucune référence de recette fabriquée ;
- `row_overrides:{[row_key]:{aisle}}` pour classer une ligne calculée sans modifier sa recette ;
- `checked` existant, clés calculées actuelles et `manual:<id>` pour les lignes libres ;
- `meal_basis_sha256:null|hash` pour détecter les seuls changements de composition/versions/portions/conventions du repas ayant servi à la liste. La convention comparée est l’instantané complet proposé pour chaque élément, conservé dans `items[].convention_snapshot` à confirmation. Aucun nom traduit ni date technique dans cette projection.

Rayons libres et modifiables, vide = Sans rayon. Aucun classement automatique présenté comme certain. Une correction de libellé libre conserve son ID/case ; retirer une ligne est un geste distinct et annulable tant qu’aucune modification concurrente ne l’a remplacée. La saisie reste présente après erreur d’écriture.

### 4.3 Repas modifié et liste existante

**Voir mes courses** ouvre la liste liée choisie, au lieu de créer silencieusement une nouvelle liste à chaque visite. Si plusieurs listes existent, les montrer avec leur date et leur contenu ; ne pas deviner la liste « officielle ». Si la base du repas diffère, montrer **Le repas a changé** et **Revoir les courses**. Aucune actualisation au simple rendu.

La comparaison montre les lignes ajoutées, retirées ou dont la quantité change. Conserver lignes libres et rayons. Une case achetée ne couvre pas silencieusement une quantité augmentée : ce changement est explicitement relu et la case à utiliser choisie avant confirmation. Refus de la comparaison laisse l’ancienne liste exacte disponible. La préparation capture aussi les éléments, cases, lignes libres et rayons de la liste affichée ; le commit compare les champs remplacés et préserve les champs indépendants relus. Un achat ou une édition concurrente pendant le dialogue ne sont jamais effacés par la seule vérification du hash du repas. Une liste hors repas garde son fonctionnement autonome.

## 5. Inventaire : un lot, une quantité réelle, une action explicite

### 5.1 Formulaire et représentation

Afficher d’abord **Quoi**, **Combien**, **Où**. Le choix Combien accepte **Quantité connue** ou **Je ne sais pas**/texte libre ; ne pas rendre le chiffre obligatoire. Source/version, dates, qualité, réchauffage et notes restent dans Détails facultatifs. Aucun conseil de salubrité ou temps de conservation n’est déduit.

Objet additionnel proposé sur `inventory` :

```js
stock: {
  format: 1,
  unit: null | 'portion' | 'piece' | 'g' | 'kg' | 'ml' | 'l',
  initial: null | number,
  remaining: null | number,
  state: 'available' | 'finished'
}
```

`portion` désigne l’unité du lot, pas une nouvelle unité alimentaire injectée dans le lexique. Un lot suit une seule dimension ; aucune relation grammes/portions n’est inventée. Nombre fini positif à la création, restant≥0, restant≤initial quand initial est connu. Bornes de saisie proposées : portions/pièces≤1000 ; masse/volume≤1 milliard dans l’unité choisie ; six décimales maximum, refus explicite au-delà. Calcul exact dans cette précision, arrondi seulement à l’affichage. Ces bornes concernent les nouvelles saisies structurées, pas la lecture des anciennes archives.

Nouveau lot : initial et restant sont la quantité réellement saisie, souvent les seuls restes. Ils ne correspondent pas au rendement théorique complet de la recette. Si quantité inconnue : valeurs/unit null, texte libre conservé ; aucun bouton de décrément numérique. Un changement d’unité incompatible exige de ressaisir et confirmer les quantités ; aucune conversion implicite de dimension.

Conserver `quantity_text` et les anciens `portions` comme valeurs historiques, sans prétendre qu’ils décrivent encore le restant. Après adoption de `stock`, son restant est principal ; texte initial dans Détails, nommé **Mention d’origine**. Une ancienne ligne avec `portions:3` et texte «4 portions /800g» ne permet pas de retrouver sa quantité initiale : proposer restant3 portions à confirmer, initial inconnu, texte intact. Pas de migration de masse ni de parsing autoritaire du texte libre.

### 5.2 Utiliser, corriger, terminer et annuler

Actions : **Modifier**, **Utiliser une quantité**, **Tout consommé**. La diminution montre avant/après dans l’unité du lot. Confirmation écrit une valeur restante absolue calculée depuis la base relue, avec révision attendue ; aucun delta rejoué automatiquement après conflit. Quantité supérieure au disponible ou négative : refus, saisie gardée.

**Tout consommé** écrit `state:'finished'`, restant0 si quantité connue ; il ne supprime pas la ligne. Pour quantité inconnue, état terminé et restantnull. La liste courante masque les lots terminés mais offre **Lots terminés**. La confirmation conserve une dernière action annulable durable : ID, date et valeurs antérieures des seuls champs de stock. **Annuler cette consommation** après recharge exige cette action/révision exacte ; il ne remplace pas une correction ou consommation postérieure.

Minimum technique complémentaire : `stock_revision` opaque et `stock_last_action:null|objet` fermé, comprenant opération, type consume/finish/undo et avant/après du stock, avec lien vers l’opération annulée. Une annulation est proposée seulement si la dernière action est consume/finish, si sa révision de résultat est encore la révision courante du lot et si le stock courant égale son après. La capture de cette action et de cette révision précède le dialogue ; un refus ne recapture pas automatiquement la nouvelle révision.

Toute modification du lot, y compris notes, emplacement, dates, adoption legacy ou correction de quantité, avance la révision et invalide l’ancienne consommation annulable. Une édition/adoption pose `stock_last_action:null` ; une consommation ou une fin la remplace ; undo conserve une preuve de type undo, sans proposer une annulation d’annulation. Seuls les champs de stock reviennent exactement à l’avant ; aucun vieux titre, note ou contexte n’est repris d’une copie globale. L’idempotence/rétention est définie séparément (§8), pas par une liste illimitée d’actions embarquées. Une correction de quantité initiale/restante est explicitement enregistrée ; ne pas changer l’initial automatiquement pour faire passer un dépassement. A ferme la forme transport/révisions et le traitement d’une preuve historique restaurée ; l’import d’archive ne doit pas réactiver implicitement une ancienne annulation.

Un lot terminé n’est jamais un nouvel ingrédient disponible. Cocher les courses, planifier, lancer/terminer une session, ajouter une photo ou enregistrer un repas ne consomme rien. Les totaux de recette ne sont jamais soustraits d’office.

### 5.3 Dates civiles

Ajouter `prepared_on` et `use_by_on`, chacun null ou date civile valide `YYYY-MM-DD`, affichée sans conversion UTC. Le libellé indique **Date indiquée par toi** ; conserver `use_by_origin:'user'` quand elle est choisie. Ne pas préremplir une date limite calculée. «Date dépassée» est une comparaison de calendrier avec la date indiquée, pas une conclusion sur la sécurité alimentaire.

Les anciens `prepared_at`/`use_by` restent conservés. Sans marqueur démontrant une saisie civile, ne pas transformer tous les ISO en dates supposées : montrer l’ancienne date disponible, proposer sa correction lors de Modifier et enregistrer le champ `_on` seulement après confirmation. La priorité `_on` est explicite, jamais une double date contradictoire. Le filtre d’accueil «à utiliser bientôt» doit consommer la même projection et exclure les lots terminés ; aucune modification du lot au passage d’un jour.

## 6. Restes après une cuisson confirmée

Le formulaire carnet I2 reste léger et ses champs/photo/version restent intacts. Après le commit confirmé de la cuisson : **Enregistrer des restes** ouvre le formulaire du lot avec le titre et la source/version proposés. Quantité, emplacement et dates sont à confirmer. Aucun préremplissage à partir de «portions cuisinées−convives», aucune préparation d’un lot avant que la cuisson soit réellement conservée.

Lien facultatif additionnel : `source_cook_history_id` vers la cuisson exacte, en plus des références source recette/version existantes. Valider que les trois identités concordent. Le lot ne déplace pas cette provenance si la recette change de version courante. ID de lot réservé au premier formulaire ; réessai/double clic ne dupliquent pas. Créer un second lot, par exemple une partie au frigo et une au congélateur, reste un second geste nommé.

Le raccord avec L7 conserve le résultat booléen historique de `ouvrirCuissons` et ajoute un callback optionnel après commit, `onEnregistre({deja,rows})`. Les `rows` sont les lignes effectivement confirmées ou relues par leurs IDs stables, dans la portée capturée ; jamais des valeurs de formulaire non écrites, la « dernière cuisson » par tri ou la version courante. Une session déjà terminée sans lignes identifiées ne déclenche pas ce callback avec des références inventées : l’accès à l’historique exact reste proposé. Un rejeu ne crée ni n’ouvre automatiquement un lot. Pour une cuisson multi-recettes, le geste Restes choisit une ligne précise de ce reçu.

La transaction du lot valide `source_cook_history_id`, `source_recipe_id` et `source_recipe_version_id` comme un même tuple, dans le même compte ; toute réassociation en attente refuse. Le transport attend la confirmation de cette cuisson avant la création du lot qui la cite ; la relation est incluse dans les validations d’archive existantes. Ce callback est coordonné avec L7 avant construction, sans changer son atomicité de fin de séance.

Cuisson et lot de restes sont deux commits explicites : si le second échoue, la cuisson reste enregistrée et le formulaire de restes reste récupérable. Ne pas refaire l’enregistrement de cuisson pour réessayer le lot. Ne pas ajouter de lien inverse obligatoire dans l’historique : les lots se retrouvent par leur référence, sans écrire deux objets pour un même geste.

Autre action facultative après la cuisson : **Mettre à jour mes stocks** ouvre l’inventaire, sans sélection présumée. La personne choisit les lots réellement utilisés et les quantités. Les ingrédients d’une recette ne prouvent ni le lot pris, ni sa quantité restante. Un lot provenant d’une cuisson historique peut être enregistré après retrait de la recette, avec la preuve de cette cuisson ; cela ne réactive aucune fonction culinaire de la recette retirée.

## 7. Cycles, sources et saisies à préserver

- Nouveaux éléments de repas, génération/actualisation de courses et nouvelle session : contextes actifs L1/L2 de toutes les recettes nécessaires. La recette gardée active après retrait de son livre respecte l’exception exacte L2 ; aucune garde globale ne bloque toute la bibliothèque.
- Repas/liste/lot existant référençant une recette retirée : consultation, case achetée, classement, note et diminution du lot restent des usages historiques. Ils ne réécrivent jamais la recette/version. Retirer un membre du repas doit rester possible. Ajouter ou remplacer exige le contexte actif de la nouvelle cible.
- Références absentes : ne pas filtrer silencieusement l’élément pour afficher un repas ou des courses «complets». Montrer l’élément indisponible ; conserver les autres, les quantités et les sources présentes. Aucun repli vers la version courante d’une autre recette.
- Toute mutation capture propriétaire durable, DB/époque/génération, base affichée et cycles applicables ; revalidation en transaction. Un refresh de synchronisation ne vide pas un formulaire sale et n’accepte pas une autre base sans comparaison.
- Réutiliser statut de conservation et garde de sortie L4 là où une saisie dure plusieurs champs, sans créer un second système d’autosave. Une promesse de brouillon durable ne sera affichée que si un kind adapté est réellement ajouté/validé ; sinon protection de la saisie en mémoire explicitement limitée.

## 8. Dépôt, synchronisation et archive : contrat fermé

DB6 peut rester : magasins existants suffisants, aucun index obligatoire pour ces volumes. Les nouveaux champs ne suffisent toutefois pas à garantir la concurrence. Les gestes d’inventaire protégés doivent passer par une commande réservée avec capacité serveur, révision attendue, résultat absolu, identités/cycles, operation_id et hash, puis reçu idempotent. Même opération/mêmes octets → reçu reconnu et ligne courante renvoyée sans nouvelle diminution ; autre résultat avec même ID → refus. Deux appareils sur la même révision : un commit, l’autre conservé comme proposition à comparer. Aucun recalcul silencieux du delta depuis le stock reçu.

Contrat fermé dans l’annexe : une commande `inventory_change` limitée au magasin `inventory`, création/adoption legacy/édition/consommation/annulation ; aucun moteur général de réservation ou d’événements. Elle protège l’ensemble des champs métier d’un lot devenu structuré, pour qu’un ancien put de notes ne réécrive pas le stock périmé. Le premier passage legacy capture la ligne entière et ne l’adopte pas à la lecture. Reçu borné, replay ancien après modification, ancienne tombale et restauration d’archive doivent être traités dans le contrat fermé ; pas de livraison avant cette revue. Rester dans les bornes existantes512Kio/ligne et768Kio/commande ; préserver les valeurs héritées en lecture.

Repas et courses : CAS local par champ/ensemble d’éléments, conflits de synchronisation existants conservés. Ne pas annoncer une collaboration temps réel ni une fusion distante sans perte. L’extension de commandes à ces deux magasins n’est justifiée que par une reproduction montrant que le contrat cible ne peut être tenu ; décider avant construction si une telle extension est nécessaire. Dans tous les cas, un conflit reçoit un accès de comparaison et la saisie locale demeure récupérable, sans appeler l’assistant.

Archive : conserver nouveaux champs, liens, état terminé et référence de cuisson ; jamais consommer/restaurer automatiquement un lot au simple import. Collision d’un lot structuré différent = comparaison/refus, pas écrasement. Les lecteurs anciens ne doivent pas éditer un stock protégé qu’ils ne savent pas lire : faire évoluer le format d’archive si le contrat L6/L7 publié ne le protège pas déjà ; numéro à fixer à l’intégration, sans présumer archive5 suffisante. Restaurer les anciens formats reste possible sans inventer initial, date ou provenance.

Bornes d’interface proposées pour nouvelles données : titre/libellé1000 caractères, notes10000, rayon100 ;100éléments nouveaux par repas (borne actuelle d’enregistrement de cuisson),500lignes libres par liste. Mesurer l’objet complet avant conservation ; aucune troncature silencieuse et aucun blocage rétroactif d’une lecture/export historique hors de ces bornes. Les identifiants et nombres reprennent les validateurs communs, pas les coercitions `Number(x)||1`.

## 9. Réception attendue

1. Envie sans date, actualisation/recharge/hors ligne, planification jour seul puis heure, retrait de date, archives/Refaire. Aucun doublon sur double clic ; versions exactes et retour de recherche conservés.
2. Fuseaux Toronto/UTC et changement de fuseau : jour civil stable, secondes/occurrence DST L0 préservées, heure inexistante refusée. Dates de stock sans décalage au jour précédent.
3. Deux plats, portions différentes/inconnues, null propre primant sur portions globales, version TM refusant le changement ; génération commune avec plages, quantité documentaire exclue des sommes exactes, unité ambiguë, masse/volume séparés et headings L6 absents. Convention figée malgré changement de convention courante ou de sa définition : reload/copie inchangés avant actualisation explicite, anciennes listes sans convention non réinterprétées.
4. Courses : lignes libres/rayons, deux cases simultanées, Copier/Partager restants et complet, annulation du partage, quota ; ancien état et texte de saisie conservés après refus.
5. Repas modifié pendant lecture de ses courses : comparaison explicite, cases et lignes libres conservées selon choix ; référence retirée/absente ne disparaît pas silencieusement.
6. Lot4portions → utiliser1 → restant3 et initial4, aucun vieux «4portions» présenté comme restant. Lot texte «800g/4portions» historique conservé sans conversion supposée. Tout consommé → reload → annuler exact ; édition de note ou quantité, autre consommation ou fin interdit l’ancien undo. Double undo et vieux replay après action suivante ne rétablissent rien.
7. Cuisson confirmée → reçu aux IDs exacts → restes saisis manuellement ; plusieurs recettes imposent le choix de la cuisson, rejeu déjà enregistré sans référence n’invente aucun reçu ; quota lot ne double pas l’historique ; deux lots distincts par geste. Fermer sans confirmation ne crée aucun lot. Aucun stock changé par courses/session/photo/portion théorique.
8. Deux appareils consomment depuis la même base ; ACK perdu/replay, nouvelle action puis vieux replay, retrait/restauration recette/livre, compte/époque remplacés, ancien client et archive : aucune diminution double, résurrection ou écriture au mauvais propriétaire.
9. Capture réelle mobile/ordinateur, texte200 %, clavier/focus ; compteurs et messages fondés sur les commits. Réception locale puis publique après autorisation d’intégration, sans compte privé ni appel payé.

Les commandes, reçus, API et dispositions ont été relus techniquement avant construction ; les résultats d’exécution seront ajoutés au rapport. Aucun scénario n’est déclaré réussi par la seule rédaction de cette spec.


## Fermetures de la revue technique du 30 octobre

Un ancien lot passe d’abord par Modifier et une confirmation explicite de son stock/unité, ou de leur caractère inconnu. Aucune consommation/annulation ne déclenche une adoption implicite. Les dates civiles utilisent la présence du champ : `_on:null` enlève la date sans reprendre l’ancien instant `_at`.

Le reçu `onEnregistre({deja,rows})` est capturé synchroniquement après commit vérifié et avant résolution de la fermeture du bilan. Ce callback ne monte aucun écran ; le caller décide de la suite Restes après son await, avant navigation finale. Aucun stock n’est créé automatiquement. Les copies montrées et les références exactes de la cuisson sont celles revérifiées au commit.

La protection interappareils de ce lot porte sur l’inventaire structuré. Repas et courses gardent l’arbitrage distant de lignes horodatées existant ; la fusion des cases de deux appareils n’est pas promise. Les CAS locaux protègent les gestes concurrents de deux onglets de la même base. Les limites et ce qui est réellement testé sont distingués au rapport.
