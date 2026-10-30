# L8 — Plan de construction et de réception

**30 octobre 2026 — contrat construit, réception locale terminée.** [Spec](../specs/2026-10-29-l8-repas-inventaire-design.md), [protocole et API](../specs/2026-10-30-l8-protocole-inventaire.md). Base publique L7 :0.29.0/DB6/archive6, code8fb0784/reçu f7e836a,10653/10653 tests publics. Cible0.30.0/DB6/archive7, SQL0013 additive et inventory_changes1. Revue technique A/B/C/root terminée, poursuite autorisée ; aucune relecture personnelle attribuée à Neegan. Les résultats observés sont consignés au §7 ; la publication reste distincte.

## 1. État de départ et décisions à fermer

Audit du plan directeur§14/L8 et du code courant : les repas multi-recettes, listes consolidées, inventaire et carnet existent. Ne pas reconstruire ces moteurs. Les correctifs L0 d’heure locale/DST et de partage/cases sont déjà livrés et leurs tests doivent rester.

Manques observés : envies sans date peu visibles, pas de jour seul ; modifications d’éléments de repas sur copie ancienne ; pas de lignes libres/rayons ni comparaison d’actualisation des courses ; stock décrémenté sans réviser son texte ; Consommé efface la ligne ; dates de lot converties en UTC ; pas de parcours restes depuis une cuisson confirmée.

Références visuelles relues : mobile recette et web bibliothèque du18octobre. Aucune maquette dédiée aux écrans L8 dans ce dossier. Adapter les composants actuels à320px, garder les cibles44px et faire relire les captures réelles. Ne pas présenter les captures d’un autre projet comme une maquette Mistu.

Avant code :

- A ferme le contrat minimal `inventory_change`, révision/recevabilité de création legacy, champs protégés, reçu/rejeu/undo, capacité, ancien client, archive et première liaison. Pas de nouveau magasin imposé.
- Vérifier l’état publié L6/L7 : API de projection des aliments/groupes et contrat de création/fin de session. Coordonner le callback optionnel `onEnregistre({deja,rows})`, avec IDs réellement confirmés, sans changer le retour booléen historique de `ouvrirCuissons`. L8 n’écrit ni traduction ni timer.
- Reproduire la concurrence locale/distante repas/courses. Maintenir une limite honnête à la collaboration ; si la cible exige plus que le put existant, faire relire une extension bornée avant construction.
- Fixer version applicative, archive, migration et nombre d’assertions seulement après integration. DB6 demeure sauf index réellement nécessaire.

## 2. Répartition proposée, à confirmer au lancement

| Volet | Propriété suggérée | Livrable |
|---|---|---|
| A — Contrats métier/données | Quantités de lot, dates civiles, commandes inventory, dépôt/outbox/sync/SQL/archive, tests purs et transactionnels | Garde propriétaire/cycle/CAS, idempotence et récupération prouvées |
| B — Repas et courses | `ui/meals.js`, `ui/grocery.js`, `domain/grocery.js`, raccord borné `portionsRepas` dans `domain/thermomix-session.js`, gestes fiche/recherche et tests | Envies/planning, objectif null explicite, conventions figées, lignes libres/rayons et comparaison |
| C — Inventaire et restes | `ui/kitchen.js` partie inventaire, callback `ui/cuisson.js` coordonné L7, composant lot et tests | Quoi/Combien/Où, Modifier/utiliser/terminer/annuler ; tuple cuisson/recette/version exact validé avec A |
| Intégration | Coquille/accueil/navigation, CSS/i18n, versions/cache/runner, docs et réception | Parcours cohérent local/public, mesures et limites documentées |

Les chemins ne sont pas une permission d’édition avant GO. Isoler les portions de fichiers partagés ; ne pas modifier les appareils dans kitchen.js ni le contrat de fin de cuisson dans cook.js sans coordination L7.

## 3. Petites tâches avec preuves rouges avant logique

### T1 — Référence existante et invariants

Conserver les suites L0 repas/courses, I3 portions/TM, carnet et cycles L1/L2 avant modification. Créer les fixtures suivantes : repas sans date, jour civil, instant avec secondes, heure Toronto répétée ; deux recettes dont une version TM ; liste avec case achetée ; lot historique `quantity_text:'4 portions /800g'` et `portions:3` ; recette/livre retirés avec historique présent.

Rouges ciblés : envie n’affiche pas la date de création comme planning, lot partiellement utilisé ne garde pas un ancien restant principal, Consommé reste annulable après recharge, jour civil ne recule pas avec le fuseau. Les tests doivent exercer le rendu/dépôt, pas rechercher des chaînes dans les fichiers.

### T2 — Modèles purs et validation

Construire uniquement les feuilles nécessaires aux invariants de la spec : projection repas par date/heure, lecture de lot legacy/structuré, validation/diminution absolue et comparaison avant/après, projection de base d’une liste. Employer quantités/unités/heure-locale existantes lorsque leur contrat convient.

Couvrir null distinct de0, NaN/Infinity/négatifs, dépassement disponible, précision décimale, changement d’unité incompatible, texte libre inconnu, initial inconnu, dates civiles impossibles, DST via module L0. Aucune quantité calculée depuis le nombre de convives ou une traduction libre. Aucun heading L6 dans les courses.

Rouges sur portions : `servings_custom:true,servings:null` reste inconnu même si le repas porte6 ; absence de choix propre peut hériter. Aucun repli `||` vers le rendement de la recette. Quantités d’origine documentaires, mention explicite et exclusion des sommes de besoin lorsque objectif ou rendement est inconnu ; autres plats connus toujours calculables. Mêmes valeurs transmises à la session, gardes I3 inchangées.

Rouge sur convention :1cup à236.5882365ml sous us_customary, puis réglage metric_ca250ml ; une liste déjà conservée ne change pas. Conserver `{id,revision,values}` ou null par élément et consommer ces valeurs figées, même si la définition portant le même ID évolue. Une liste legacy sans preuve ne reçoit pas automatiquement la convention courante ; mesures dépendantes documentaires jusqu’à choix explicite.

### T3 — Dépôt de stock, sync et archive

Écrire d’abord les courses transactionnelles : deux onglets même base, changement de propriétaire/DB/époque juste avant commit, source/version ou cycle changé, quota. Vérifier l’absence de demi-écriture et le maintien de la saisie.

Définir préparation depuis la copie affichée, plan opaque et commit unique lot+outbox+preuve d’annulation. ID réservé pour création, reçu pour chaque geste, aucune diminution recalculée après conflit. État local conservé distinct de synchronisé.

Annulation seulement de consume/finish encore dernière action, révision de résultat égale à la révision courante, et stock égal à son après. Capturer action/révision avant dialogue. Toute édition/adoption avance la révision et pose l’action annulable ànull ; consommation/fin la remplace, undo n’autorise pas un undo d’undo. Restaurer seulement le stock avant, jamais les anciennes métadonnées. Prouver consume→note, consume→quantité corrigée, consume→finish, double undo et rejeu ancien après nouvelle action. A ferme dans son protocole la forme exacte, les reçus et la preuve historique à l’import ; ne pas improviser ce transport dans l’UI.

SQL uniquement après contrat relu : rôle autorisé, capacité, contrôle owner et cycles, révision attendue, bornes/forme fermée ; deux clients, ACK perdu, replay identique, même ID autres octets, vieux replay après publications suivantes, ancien put/REST/tombale et restore. Une archive reçue n’est pas une nouvelle consommation. Première liaison sans compte à examiner sur les mécanismes existants, sans adopter un autre propriétaire.

Tests archive : legacy conservé, lot structuré available/finished, source de cuisson exacte, dates civiles, import absent/identique, collision différente refusée. Fixer le format d’archive pour empêcher qu’un lecteur ancien prétende éditer le stock nouveau. Aucun SQL distant appliqué pendant la construction.

### T4 — Envies et planification légère

Ajouter les sections sans changer les routes. «À cuisiner bientôt» depuis une version affichée réserve un repas/élément stable sans titre/date obligatoires ; réessai et double clic n’ajoutent pas de doublon. Les envies d’index restent des références, sans ingrédients inventés.

Jour seul avec planned_on ; heure optionnelle via toute la logique L0 ; Retirer la date ; archiver/réouvrir ; Refaire garde versions/portions mais remet sans date. Préserver recherche/scroll/focus grâce à L3. Aucun déplacement vers «cuisiné» sur le seul passage du jour.

Revoir les écritures de items : ajout/remplacement/retrait/portion sous comparaison des champs exacts, titre concurrent préservé, nouvel élément concurrent jamais perdu. Arrêt/refus visible si compte ou cycle change pendant un dialogue. Les membres historiques retirés restent visibles et retirables du repas.

### T5 — Courses et actualisation explicite

Réutiliser buildShoppingList et preparerSortieCourses. Ajouter sections Encore à acheter/Acheté, lignes libres à ID stable, rayon libre et retours vers versions exactes. Capturer `items[].convention_snapshot` avec les versions et portions ; inclure sa valeur complète dans la projection de base. Cases conservées quand on filtre/classe ; les commandes Copier/Partager attendent les écritures et partagent le même texte, y compris les mentions de quantités documentaires.

Revoir les courses d’un repas changé : comparaison explicite ajout/retrait/quantité, maintien des lignes libres/rayons, choix pour une ligne achetée dont le besoin augmente. Aucun remplacement au montage ni lors d’un changement de version courante hors repas. Ne plus annoncer «courses recalculées» sans avoir modifié la liste visée.

Preuves : deux cases simultanées, autre onglet coche ou modifie une ligne libre/rayon entre ouverture de comparaison et confirmation, ligne libre modifiée/supprimée, plage/borne haute annoncée, unité ambiguë, dimensions séparées, recette indisponible, erreur clipboard, annulation share, quota. Comparer les champs de la liste remplacés au commit ; le hash du repas seul ne suffit pas. Tester changement de convention/révision après case cochée : reload et export stables avant actualisation explicite, différence présentée au geste. Garder toutes les anciennes assertions L0 ; adapter seulement les gestes délibérément changés.

### T6 — Inventaire lisible et réversible

Formulaire principal Quoi/Combien/Où ; détails facultatifs pour provenance/dates/notes. Quantité inconnue admise sans décompte. Source du lot historique consultable, titre affiché principal et version accessible. Les anciens textes restent en mention d’origine, sans remplacer le nouveau restant.

Modifier, Utiliser une quantité, Tout consommé et Lots terminés ; confirmer le résultat avant commit, garder la saisie en erreur. Recharger puis annuler la dernière consommation sous CAS. Une nouvelle action ou un nouveau compte interdit l’ancien undo. Mettre l’accueil sur la même projection de dates et ne pas remonter les lots terminés comme disponibles.

Tester aussi un ancien lot aux valeurs incohérentes : pas de réparation silencieuse, correction explicite sans effacer le texte. Une date limite utilisateur est un repère, pas une évaluation de salubrité.

### T7 — Restes après cuisine, sans effet implicite

Raccorder `onEnregistre({deja,rows})` après le reçu d’enregistrement I2/L7 tout en conservant le retour booléen de `ouvrirCuissons`. Les lignes sont confirmées ou relues par leurs IDs stables ; le chemin déjà terminé sans rows exactes ne fabrique pas de reçu et ne choisit pas la dernière cuisson par tri. Il laisse l’accès à l’historique explicite. «Enregistrer des restes» choisit une cuisson précise si plusieurs recettes ont été enregistrées, puis transmet son tuple cuisson/recette/version au formulaire ; quantité/emplacement restent des saisies explicites.

A valide ce tuple en transaction et le protège pendant les attentes ; le transport attend la cuisson référencée avant la création du lot. Ajouter la relation aux contrôles d’archive, sans nouveau magasin. Aucun lot créé par callback seul, rejeu, simple ouverture, fermeture ou photo. Après quota, réessayer seulement le lot avec les mêmes identifiants ; ne pas réécrire cook_history. Un callback de présentation défaillant ne doit pas transformer un commit de cuisson réussi en fausse erreur d’enregistrement.

Ajouter Mettre à jour mes stocks comme accès facultatif à l’inventaire, sans lot présélectionné par théorie. Tester recette retirée après cuisson confirmée : création historique autorisée avec preuve exacte, aucune réactivation. Nouveau lot sans preuve historique sur une recette retirée reste un nouveau geste refusé selon L1/L2.

Deux lots frigo/congélateur demandent deux gestes. Une note ou quantité de cuisson ne consomme rien, ne réserve rien et ne déduit pas de restes. Vérifier que les écritures hors inventaire n’ajoutent aucun mouvement de stock.

## 4. Parcours réels de réception

Harnais réutilisable local/public, profils jetables, aucun compte privé ni appel assistant. Observer les commits et les événements, pas des délais arbitraires ou waitForFunction asynchrone retournant une promesse.

1. Depuis recherche, garder une envie, revenir à la recherche, planifier un jour sans heure puis une heure ; reload/hors ligne ; retirer la date. Refaire un repas connu et vérifier les versions exactes.
2. Composer deux plats avec portions distinctes, dont un TM et un objectif explicitement inconnu ; courses communes avec plage et unité ambiguë ; ajouter une ligne libre/rayon, cocher, filtrer, copier/partager. Modifier la convention courante puis reload : ancien calcul figé jusqu’à Revoir les courses. Les quantités documentaires restent nommées, la quantité TM interdite reste refusée.
3. Modifier le repas sur l’autre onglet pendant que les courses sont ouvertes ; revoir explicitement les changements, ne perdre ni case ni ligne libre. Tester membre retiré et livre retiré/recette conservée.
4. Ajouter quatre portions réelles au frigo, utiliser une, voir initial4/restant3 ; tout consommer, fermer/recharger, annuler ; édition de note/quantité ou autre action refuse l’ancien undo, double undo sans effet supplémentaire. Ancienne mention libre conservée dans Détails.
5. Finir une cuisson multi-recettes, choisir le reçu exact pour des restes, injecter un quota, réessayer ; chaque cuisson une seule fois/un seul lot par geste. Rejeu de fin de séance sans rows identifiées : aucun lot ni référence inventée. Terminer une seconde cuisson sans déclarer de restes : aucun changement d’inventaire.
6. Deux vrais moteurs et serveur local isolé : consommation concurrente, refus conservé à comparer, ACK perdu/rejeu, compte/cycle. Archive exportée puis restaurée, données/provenance exactes. Ne pas revendiquer ce test avant exécution.

Captures320/390/768/1280px et texte200 %, mobile en portrait et ordinateur ; listes longues, inconnus, erreurs et état terminé. Lire visuellement les images et mesurer débordements/cibles. Clavier, focus après dialogue, annulation/Escape et retour navigateur. Tester cache unique et rechargement réellement hors ligne des contenus présents.

## 5. Intégration et sortie du lot

- Gels par volet, revue croisée des transactions et limites, ciblés causaux puis suite entière. Aucun test retiré pour masquer une interruption ; compter les assertions réellement atteintes.
- Validation syntaxe/diff, outils Node/générateur et SQL UTF8 si migration, archives historiques, matrice anciens clients. Modifier le pin au bilan mesuré seulement.
- Statuts exacts : enregistré localement, en attente de synchronisation, conflit à comparer ; aucune promesse de collaboration ou d’état stock serveur avant accusé.
- Version/cache/modules/i18n/catalogue de tests intégrés par un seul responsable. STATE et rapport actualisés après les faits, pas à l’écriture du plan.
- Publication seulement après réception et autorisation d’intégration. Si SQL neuf : capacité/guards vérifiés avant activation client. Vérifier ensuite Pages réellement construit, fichiers identiques, suite et parcours publics en profil isolé.
- Les essais physiques iPhone/Safari et une utilisation réelle en épicerie restent à réaliser ou à citer comme limites ; l’émulation de largeur ne les remplace pas.

Preuves : `.superpowers/sdd/2026-10-30-l8/`. Le contrat initial a précédé le code ; réception observée au §7.


## 6. Répartition fermée avant construction

L’annexe de protocole§9–10 fait autorité sur les fichiers et signatures. A possède domaine/commandes/publication SQL/dépôt, B repas/courses, C inventaire/restes/backup/relations. Root possède canon/gardes SQL et preuves ACL/composition, CSS/navigation/i18n/version/cache/runner et livraison. Aucun fichier partagé n’est modifié en parallèle sans attribution explicite. La synchronisation pourra être transférée de A vers B après son volet UI, avec notification explicite.


## 7. Réception locale du 30 octobre

**L8 — repas, courses et inventaire : réception locale terminée, publication en préparation.**
[Spec](../specs/2026-10-29-l8-repas-inventaire-design.md), [protocole](../specs/2026-10-30-l8-protocole-inventaire.md), [rapport](2026-10-29-l8-repas-inventaire.md).
Branche l8-repas-inventaire, contrat1c42241 ; base L7 code8fb0784/reçu f7e836a. Revues A/B/C/root ; aucune relecture personnelle attribuée à Neegan.
Envies et jours sans heure, courses à convention conservée et révision explicite ; stock confirmé, consommation/fin/annulation conditionnées et restes liés à la cuisson exacte.
**0.30.0**, cache0.30.0-1, DB6/archive7, SQL0013 additive avec inventory_changes1. Public encore0.29.0 à ce reçu.
**11083/11083** navigateur (épingle11082, +430 depuis L7, aucun scénario retiré), zéro erreur JavaScript/requête extérieure ; Node232/232, générateur0, syntaxe89 fichiers et diff propres.
PostgreSQL UTF8 neuf0001→0013 :201 vecteurs JS/SQL,17 refus causaux/5legacy/21 anciens RPC,175 publication,26 sources,140 ACL et écriture authenticated ; bornes6JS/4SQL, réserve23500 octets sous32768.
Concurrence35 contrôles avec deux connexions ; deux moteurs42 contrôles/15RPC, confirmation perdue/rejeu courant, refus récupéré, archive/bootstrap et deux passes sans écho. Régressions SQL antérieures21 scripts verts.
Chrome : inventaire11 mesures/33 gestes et repas8/28, deux onglets, rechargements réellement hors ligne,14 modules en cache unique. Captures relues ; les défauts de navigation globale à texte200% sont consignés pour L9.
Les courses gardent leur arbitrage par ligne entre appareils ; la fusion de cases prouvée ici concerne deux onglets partageant la même base. Aucun calcul automatique de quantité, consommation ou durée de conservation.
Aucun compte privé/appel assistant réel ni essai physique iPhone/Safari/TM7. Publication autorisée par les demandes de poursuite/déploiement. **L9–L10 et E1 restent à terminer.**

Les rapports A/B/C et les journaux root sont conservés dans le dossier de preuves. La transaction de livraison0013 a été répétée sur une base locale0001→0012 ; un second passage est refusé avant toute modification. Le SHA256 du SQL reçu est `02f0390bed59a9297e3c2138679512a26c64e8acebd7b961128ca454eaa6be3b`. La publication distante n’est pas encore déclarée à ce reçu.
