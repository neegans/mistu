# L6 — Plan de construction et de réception

**29 octobre 2026 — contrat relu, départ de construction.** [Spec](../specs/2026-10-29-l6-ingredients-groupes-traductions-design.md) et [protocole fermé](../specs/2026-10-29-l6-protocole-traductions.md), sur le plan directeur §11.3/12. Autorisation générale de poursuivre ; aucune relecture personnelle de Neegan revendiquée. Base publique L5 : code `66734c5`, reçu `8e6a82f`, 9472/9472 tests publics, 72 fichiers exacts, parcours16+12. Prototypes B33 et A25 vérifications réussies, sans réseau ni base métier ; ce ne sont pas des preuves de production L6. Revue technique root/B/C des six décisions et du protocole avant les premiers rouges. Cible0.28.0, SQL0011, archive5, DB6.

## 1. Portes de départ

- Consigner le commit L5 réellement publié, sa suite, DB/archive/capacités et les écarts restant ouverts. Reprendre ses helpers de capture, jamais un instantané antérieur de source.
- A/B/C relisent structure, traduction et publication ; nommer un propriétaire pour chaque fichier partagé et figer les API. Écrire les vecteurs JSON attendus avant le serveur.
- Mesurer des enveloppes réalistes et maximales :200 ingrédients,200 étapes,100 headings,200000 points de texte, Unicode astral/échappements, IDs longs. Mesurer séparément requête passerelle, réponse, journal, brouillon, récupération brute, traduction publiée et commande de synchronisation. Les plafonds proposés ne valent pas preuve de faisabilité.
- Fixer le prochain numéro de migration après0010, la capacité recipe_language:1, l’archive5 et le comportement des anciens clients. Aucun ajout SQL appliqué à distance pendant la construction.

## 2. Tranches et tests rouges

### T1 — Structure pure, sans assistant

Créer `tests/l6-structure-ingredients.js` : absence de champ = ordre historique exact ; deux groupes ; groupe vide ; déplacement simple/de groupe ; suppression du seul heading sans suppression d’aliment (structure conservée avec blocs ingredient seulement) ; conversion explicite dans les deux sens ; conservation des ID intacts ; référence absente/double/étrangère/collision ; données hors bornes sans troncature ; « Sauce soja », « Pâte miso » et « Levain » restent aliments. Vérifier publication nouvelle version, parent original intact, métadonnées seules sans version.

Étendre les tests L4 de modèle/brouillon/publication avec de vraies sources : titres et groupes dans empreintes, reprise après recharge, comparaison après modification concurrente, saisie locale récupérable après corbeille/remplacement de bibliothèque, traduction d’ancienne version non héritée. Observer le comportement, jamais rechercher une chaîne dans le source.

### T2 — Extraction et producteurs compatibles

Créer `tests/l6-extraction-groupes.js` : JSON ancien sans blocs, blocs cohérents, index de ligne étranger/double, heading trop long, perte de bloc mais extraction correcte conservée, JSON habillé, réponse coupée, source à deux paragraphes. Vérifier IDs attribués localement, aucune quantité déduite et aucune relance pour corriger un groupe.

Rejouer import photo, web/JSON-LD, création, correction assistée L4, substitution et adaptation TM. Une modification de ligne doit encore atteindre les exports via son texte source fidèle. L’extraction sans modèle reste sans appel au modèle. Résultat payé lié au journal exact, aux pages réellement envoyées et au propriétaire capturé.

### T3 — Traduction pure, format2 et lecteurs L0

Créer `tests/l6-traductions.js` avec vecteurs fermés : version/source/ref exactes ; trous au deuxième ingrédient et première étape ; ordre de réponse arbitraire ; doublons/refs étrangères ; source modifiée sous même ID ; titre personnalisé ou original modifié seul (hash culinaire intact, CAS titre distinct modifié) ; autre version avec mêmes textes ; notes/avertissements/rendement ; caractères Unicode et nombres/plages/unités protégés. Réponse partielle garde les segments valides. Format ancien reste consultable, format1 garde ses trous et son édition manuelle.

Comparer les rendus Original/Français, portions4→6, unité ambiguë, quantité qualitative et ligne documentaire non structurée. Prouver que le texte principal ne conserve jamais une ancienne quantité traduite quand une quantité nouvelle est affichée. Vérifier aucun flag verified, identité d’aliment, timer ou repère modifié par la traduction.

### T4 — Coût, journal et conservation de réponse

Créer `tests/l6-traduction-journal.js`, provider/fetch injectés uniquement. Montage, choix Français, retour/reload et reprise de lecture : zéro appel. Clic explicite : coût planifié annoncé et cibles exactes dès a_lancer. Plusieurs portions : chaque réponse durable avant la suivante. Réseau coupé à droite/portion suivante : les précédentes restent visibles et ne repartent pas. Quota après réception : pas de faux succès, copie/récupération et réessai d’écriture sans appel.

Réponse malformed ou trop grande : brut exact en base64 et segments admis récupérables après recharge sans aucune publication ; jamais de troncature annoncée complète. Tester2Mio d’octets nuls, Unicode valide/invalide, SHA et longueur, taille complète avec projection admise. Saturation8 entrées/8Mio avant appel : arrêt expliqué, aucune purge automatique. Quota pendant le commit : ni demi-écriture ni faux succès, copie/réessai sans appel. Annulation : comptage possible dit, réponses déjà reçues conservées, aucun appel suivant. Pas de relance implicite à partir d’un message « vérifie ta saisie » quand c’est le réseau/serveur.

Audit de tous consommateurs `importOuvert`, reprise, Ajouter/Imports et abonnement au vol : une traduction ouverte n’empêche ni cuisiner, exporter ni décrire/adopter une recette. Ancien journal sans propriétaire ne devient pas celui d’un compte connecté. Journaux reçus d’un autre appareil et après réinstallation : lisibles, repris/abandonnés explicitement.

### T5 — Publication et synchronisation réelles

Créer `tests/l6-traduction-publication.js` : deux writers, double clic, révision changée au commit, réponse changée sous même ID/date, recette retirée/restaurée, édition keep_recipes et exception individuelle, changement de compte/DB/époque pendant appel, ancien pointeur courant, titre modifié, un seul segment manuel corrigé. CAS de l’ensemble des traductions candidates : absence puis apparition, seconde identité même version/locale, ordre de lecture différent, contenu changé sous même ID/révision. Comparer instantanés avant/après ; aucun effet partiel au refus.

Journal3 refs : adopter1 conserve `a_verifier`, laisse2 refs consultables/corrigeables sans appel ; adopter1 autre et écarter explicitement la dernière donne `enregistre`. Tout écarté donne `ignore`, résultat conservé. Tester ref étrangère/double, résolution déjà confirmée, ref absente/null jamais écartée implicitement,24 refs/reçus au maximum, replay ancien après clôture sans retour arrière. Publication partielle ne purge pas le brut. Refus de titre n’empêche pas la consultation des autres segments ; nouveau plan explicite excluant le titre périmé, sans recapture silencieuse.

Tester la commande SQL sur PostgreSQL UTF8 jetable avec les mêmes fixtures signées que le planner JS : refus causal, acquittement perdu, replay exact après modification ultérieure, conflit d’opération, journaux exacts et clôture atomique. Deux clients réels et un ancien client : protection REST/generic RPC, absence de remplacement silencieux du format2 et de perte des groupes par dérivation. Capacité manquante laisse la commande en attente explicite sans repli vers ancien put.

Créer `tests/l6-archives.js` : archive5, anciens formats1–4, groupes/traductions/provenances/résultats payés conservés, champs internes exclus, relations orphelines/ref étrangères refusées avant écriture, collisions d’identité, restauration concurrente, gros Unicode et fichiers source inchangés. La vérification après restauration compare les données réellement écrites.

### T6 — Éditeur et lecture entière

Créer `tests/l6-editeur-traduction.js` et `tests/l6-lecture-recette.js`. Éditeur : gestes de groupe, original consultable, formulaire segmenté et manques à leur place, conservation différée +reload+reprise explicite, flush avant navigation/publication, réponse assistée n’écrasant pas une saisie locale, copie séparée lors de conflit. Corriger un champ conserve le reste de la proposition ; provenance manuelle limitée à ce champ.

Fiche : titre réellement choisi, groupes, ingrédients, étapes complètes, notes/avertissements/rendement français principaux ; original accessible ; langue menu indépendante ; aucune traduction annoncée si absente/périmée. Contrôler aussi les formats L0 dans le parcours réel, pas seulement les validateurs.

Cuisine : même version, même texte que la fiche, langue mémorisée par session,2recettes avec couvertures différentes, retour fiche/cuisine et recharge hors ligne. Voix injectée : texte/locale exacts du segment affiché, annulation changement étape/recette/langue/sortie, manque original dans sa langue connue, langue inconnue sans voix inventée. Ne pas déclarer un test acoustique sur iPhone à partir de l’injection.

Exports : HTML/texte français conformes au projecteur ; JSON-LD sans heading-aliment ; conservation documentaire des groupes et manques explicites. Cookidoo/TM : contrôles structurels inchangés, aucune traduction libre substituée aux réglages canoniques.

### T7 — Consommateurs culinaires

Tests d’intégration avec une recette dont un faux ingrédient « For the starter » devient heading : somme des quantités, courses, ingrédient_ids, recherche/appairage, substitutions, allergènes, capacité du bol et ratio de portions ne comprennent aucun titre. Tester aussi « Levain » réellement alimentaire, quantité250g, qui reste comptée. Les titres ne passent pas au statut vérifié des aliments.

Rejouer les preuves urgentes TM aux motifs exacts : cumul2,5L, eau vapeur, huile seule, durée vapeur, mixage après chauffe et couvercle ; changer langue/groupes ne masque pas le refus ni ne rétablit une signature périmée. Pas d’essai matériel inventé.

## 3. Parcours réels de réception

Base jetable, réseaux externes bloqués et réponses modèle factices. Préparer un harnais réutilisable local/public avec fixture injectée, sans dépendre de modules `.superpowers` publics. Aucun `waitForFunction` async ; attendre des états DOM/stockage mesurables.

1. Recette anglaise avec2groupes, aliment « Levain », quantité en plage, unité ambiguë, étape multiligne, avertissement chaud et rendement textuel. Corriger un faux aliment en titre, publier, original toujours exact.
2. Français absent → demande explicite →2portions dont la seconde échoue → première réponse conservée →reload/reprise des manquants sans repayer la première →proposition partielle visible puis adoption explicite.
3. Corriger une préparation traduite, conserver tout le reste, changer portions4→6, vérifier quantité principale correcte et citation source étiquetée. Revenir Original puis Français.
4. Cuisine,2recettes et voix injectée : texte/locale/progression cohérents. Quitter/reprendre avec le réseau coupé, vérifier que les textes réellement conservés restent disponibles.
5. Deux onglets : saisie/refus concurrent, compte/époque remplacés pendant réception, retrait/restauration. Réponse récupérable, aucun mauvais propriétaire ni réactivation implicite.
6. Archive exportée/restaurée, mêmes ID/groupes/textes, sources/photos/notes et résultats payés ; brouillons locaux clairement hors archive.

Captures à320/390/768/900/1280 px et texte200 %, clavier seul/focus, groupes longs, traduction manquante, erreur/quota et mode cuisine. Mesurer débordements/cibles et relire visuellement les captures. Vérifier cache unique, nouveaux modules présents et rechargement vraiment hors ligne avant de rétablir le réseau.

## 4. Critères de livraison et preuves

- Tous les anciens scénarios restent présents ; adapter une attente uniquement lorsqu’un changement produit est expliqué et causal. Retrouver les assertions d’un bloc interrompu ; ne pas réduire l’épingle pour rendre vert.
- Suites ciblées puis intégrées, syntaxe/diff, outils Node/générateur applicables, preuves SQL UTF8 si migration, capture d’archive et matrice de concurrence. Documenter les comptes mesurés, pas une prévision.
- Annoncer séparément local conservé, synchronisé, traduction partielle/complète et vérification humaine. Aucun pourcentage sans dénominateur, aucune progression fictive.
- Publication seulement après intégration revue : migration autorisée/capacité contrôlée, cache/version corrects, Pages réellement construit, empreintes publiques identiques et parcours public avec zéro compte privé/appel payé.
- Essais physiques iPhone/Safari/PWA, voix audible et qualité linguistique bilingue restent des preuves à effectuer ou des limites explicites. L’émulation de largeur et la validation d’un schéma ne les remplacent pas.

Consigner les futures preuves sous `.superpowers/sdd/2026-10-29-l6/`. Mettre STATE et le rapport à jour après faits observés ; ne déclarer ni L6 ni les lots suivants terminés pendant cette préparation.

## 5. Préparation mesurée, hors production

Exécution locale : `node .superpowers/sdd/2026-10-29-l6/contrats-et-bornes.mjs`. Sorties : `vecteurs-l6.json`, `mesures-l6.json`, `contrats-et-bornes.log`. Bilan lu :33 vérifications,0 échec. Les fonctions pures actuelles mesurent le JSONB et admettent la requête de passerelle ; les transitions/réceptions restent un modèle de contrat à remplacer par de vrais tests dépôt/SQL.

Résultats à reprendre lors de la fermeture A :903 segments nécessitent38 portions ; source Unicode admise460269 octets mais traduction590340 ; squelette à IDs longs367621 ; journal portion avec24 résolutions122863 ; récupération brut2Mio+projection admise2893479 ; traduction proche du plafond518202 et sa commande9 journaux/203 résolutions547601 octets. Voir les nuances et la table de §11 de la spec. Aucun appel fournisseur, comportement serveur de publication, essai physique ni qualité de traduction n’est prouvé par ces mesures.

## Raccord de contrat revue4

Avant construction, suivre l’[annexe normative](../specs/2026-10-29-l6-protocole-traductions.md). Root possède captureReponse dans passerelle.js ; B structure pure/éditeur/extraction/provider+plan+orchestration assistée/UI ; C projecteur commun/lecture/voix/exports/substitution ; A format2/projections/captures/dépôt/publication/journalréception/repo/SQL/archive. Les API consommateurs sont figées au §6 de l’annexe. Ajouter rouges réels pour raw HTTP200 illisible/annulation après corps complet, barrière de quota avant nouvel appel,24refs/32portions et8entrées/8Mio, receipt_floor forgé/FIFO, restorehistorique sansrebase, locale JS↔SQL et ACKperdu à deuxmoteurs. Ne pas attribuer les prototypes25+33assertions à des preuves de transaction.


## 6. Réception locale — 30 octobre 2026

Version0.28.0/cache0.28.0-1, DB6, archive5. Contrat3ca2255 puis construction sur base publique8e6a82f. Revue technique en trois volets, sans attribuer une relecture personnelle à Neegan. Autorisation générale de poursuivre et publier conservée.

### Comportements livrés localement

- Titres de groupes explicites, sans les compter comme aliments ; édition, extraction et dérivations conservent ordre et identités. Un retrait de titre depuis un parent structuré demande une décision explicite ; réponse déjà reçue conservée.
- Original/français lisibles sur fiche, cuisine et exports. Rendement et titre utilisent le même projecteur ; voix injectée reçoit exactement le texte affiché et la langue déclarée. Les réglages Thermomix restent issus de leurs valeurs validées.
- Traduction par passages, trous visibles, coût préparé avant appel explicite. Réponse durable avant portion suivante ; réserve bornée et libération explicite. Un quota après réception permet récupération des octets exacts puis réessai d’écriture sans second appel.
- Brouillons repris explicitement, concurrence entre onglets, comparaison des valeurs et copies récupérables. Corrections manuelles gardent les autres propositions. Plusieurs adoptions du même journal conservent leur union et leurs provenances.
- Gardes JS/SQL, commandes signées, CAS de toutes les candidates, titres et source séparés, journal résolu atomiquement. Ancien client ne peut réécrire une traduction protégée, sa réponse ou sa source. Réglages montrent les copies refusées avec leur accès utile, sans faux choix générique.
- Archive5 restaure captures historiques, groupes, résultats et provenances ; photos/notes conservées. Première liaison suit le même graphe versions→journaux→traductions. Les bruts et brouillons restent explicitement propres à l’appareil.

### Preuves relues

**10161/10161** navigateur, épingle10160 ; hausse689 depuis9472, aucun bloc interrompu ni assertion retirée. Zéro erreur JavaScript/requête extérieure. Node **232/232**, générateur `--check`0, syntaxe/diff propres. Les listes de migrations du témoin de copie Node incluent désormais0011 ; ce raccord a rougi avant correction.

Base locale `mistu_l6_livraison_root`, créée depuis template0 UTF8, puis les onze migrations métier dans l’ordre. Authentification synthétique et cron sans ordonnanceur documentés ; aucune donnée privée. Régression L5 **327 contrôles**. L6 :56 vecteurs JS/SQL,24 gardes versions,93 formes/transitions journal,18 publications (dont129 publications réelles pour le FIFO128),17 publications/résolutions avec provenance assistant,4 limites SQL et4 limites JS. Total L6SQL212 ; **132 contrôles ACL**, plus vraie création/modification de version structurée sous rôle authenticated. Les ACL de composition ont été corrigées après rouges : validateur de version réautorisé, droits PUBLIC/anon des RPC fermés.

Deux connexions PostgreSQL : **16 contrôles L6** (publication concurrente, titre REST, source REST) et **10 contrôles L5** ; seconde opération attend le verrou propriétaire, puis refuse au motif exact sans écriture partielle. Deux vrais moteurs Chrome/IndexedDB→PostgreSQL : **30 contrôles,12 RPC**, trois phases journal, confirmation de publication perdue puis rejeu exact, archive5 et restauration historique, réception par autre moteur, aucun écho après amorçage. Le replay serveur inclut les journaux confirmés ; sa première réponse incomplète a été détectée par la garde client.

Parcours de la vraie application : **15 mesures/28 gestes** de lecture, **7 mesures/20 gestes** d’éditeur ; largeurs320/390/768/900/1280 et texte200 %. Original/français, quantités recalculées, voix injectée, deux onglets concurrents, récupération réelle de texte, quota simulé, publication et rechargement réseau coupé. Photo décodable et note personnelle conservées,12 nouveaux modules dans le cache unique. Le harnais attend maintenant explicitement le chargement de l’image avant d’annoncer son décodage ; il ne confond plus l’apparition du titre avec la fin de chargement de la photo. Débordement du message de connexion à200 % reproduit puis corrigé. Captures mobiles de l’éditeur et de la lecture réellement relues.

### Limites et publication

Aucun fournisseur payé ni compte privé utilisé ; pas d’iPhone/Safari physique, de voix audible ou de Thermomix réel testé. La qualité linguistique d’une réponse future ne découle pas de la validation de son format. Les captures et révisions historiques sont conservées : un nouveau geste d’import du même ancien ZIP après restauration fraîche peut refuser une divergence, sans convertir artificiellement ses reçus historiques en preuve actuelle.

Preuves et scripts dans `.superpowers/sdd/2026-10-29-l6/`, rapports A/B/C et journaux SQL séparés. Migration0011 et publication0.28.0 encore non appliquées au moment de ce reçu local. L7–L10 et E1 restent à réaliser.
