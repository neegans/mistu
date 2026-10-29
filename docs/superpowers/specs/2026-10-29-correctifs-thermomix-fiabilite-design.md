# Correctifs prioritaires — Thermomix et propositions payées

29 octobre 2026. Demande explicite de Neegan pendant L2 : poursuivre le plan, mais corriger d’abord la sécurité Thermomix, puis les pertes d’appels et les blocages signalés. Cette demande autorise la construction ; aucune relecture personnelle de cette nouvelle spec n’est présumée.

Base : code public 0.23.1, commit `752566d` (documentation, code `d6b4488`). Branche isolée `correctifs-thermomix-0.23.2`. L2 reste conservé dans son checkout ; sa migration n’est pas publiée pendant ce correctif.

## 1. Sécurité avant les autres travaux

- Contrôler la somme des volumes mesurés présents dans chaque contenant après ajout, déplacement ou transvasement, y compris les bornes hautes des fourchettes et les conversions exactes selon la convention source. Limites : bol 2,2 L, panier 1,4 L. Aucune conversion d’une masse alimentaire en volume par densité supposée. Une précision utilisateur inférieure ne peut contourner le contenu connu. Un volume inconnu reste annoncé comme inconnu : le logiciel ne certifie pas le remplissage réel.
- Borner l’eau vapeur et la compter dans le bol ; elle est explicitement distincte des ingrédients placés par les actions. Le contrat indique cette distinction. Pas de cumul d’eau inventé à chaque réglage. Après vidange de l’eau déjà utilisée, une nouvelle vapeur est refusée : le contrat ne possède pas d’action structurée de réapprovisionnement. Garder le minimum de 500 g et le plafond logiciel de 30 min de vapeur cumulée ; aucune extension automatique selon l’eau disponible.
- Les instructions affichées et conservées proviennent uniquement des actions structurées validées. Une justification libre du modèle n’est pas une seconde source de consignes : remplacer son affichage par une explication locale dérivée des actions. Ne pas afficher une consigne de mixage chaud ou de retrait du couvercle/gobelet issue de cette prose. Maintenir la lecture des plans historiques sans réécrire leur original.
- Remplacer les rejets lexicaux trop larges : « huile végétale », « végétarien » et un refus tel que « je ne peux pas garantir… » ne rendent pas seuls la réponse invalide. Les textes libres ne constituent ni certification de sécurité ni compatibilité alimentaire. Questions et refus restent bornés et filtrés contre les instructions dangereuses et données hostiles.
- Tests indépendants et motif exact pour huile seule, vapeur cumulée, chauffe puis mixage rapide, couvercle et capacité. Chaque garde a un témoin voisin accepté. Une mutation supprimant la garde doit faire échouer son test.

Références officielles consultées : [assistance TM7 Amérique du Nord](https://service.thermomix.com/hc/en-us/sections/44048421752467-Thermomix-TM7), [Varoma TM7](https://service.thermomix.com/hc/en-us/articles/51487463673235-All-about-the-TM7-Varoma), [manuel TM7](https://assets.vorwerk.com/content/dam/general/zendesk-guide/manuals/tm7_2025-04/user%20manual_TM7_11012_V1.0_GB.pdf). Les restrictions du profil Mistu peuvent être plus fortes que celles de la machine ; elles ne sont pas présentées comme une certification Vorwerk.

## 2. Conserver le travail payé

- Accepter un unique objet JSON entouré d’une clôture Markdown ou d’une courte introduction, sans réparation du contenu, sans exécution, sans choisir arbitrairement entre plusieurs objets ; valider ensuite chaque champ et les bornes habituelles.
- Repères : accepter et conserver une durée en fourchette sans choisir sa moyenne ou une borne arbitraire. Les valeurs impossibles restent refusées.
- Distinguer une panne réseau/serveur, un quota, un refus de domaine et une saisie invalide. Aucun réessai payant automatique ; ne pas demander une correction de saisie pour une panne réseau.
- Après relecture d’une proposition payée, enregistrer les corrections garde aussi les champs proposés non modifiés. Garder ou corriger est lié au journal effectivement affiché : une réponse différente arrivée dans un autre onglet impose une nouvelle relecture, avant et pendant l’écriture atomique. Une correction ne change que la provenance du champ effectivement corrigé ; les autres estimations conservent leur marque approximative.

## 3. Débloquer sans perdre ni contourner les gardes

- Un brouillon ancien ou d’un autre appareil reste visible et peut être ignoré volontairement ; un appel actif n’est pas silencieusement repris ou doublé. Clôture atomique, compte et cycle vérifiés, résultat tardif incapable de ressusciter le brouillon.
- Corriger une adaptation crée une version personnelle sans réécrire l’original. Une invalidation du plan Thermomix ne bloque pas l’export de sauvegarde de toute la bibliothèque. La cuisson et la copie ne présentent jamais d’anciens réglages comme validés ; l’utilisateur dispose d’un parcours explicite vers une version utilisable.
- Un nouveau tour de questions n’hérite pas des réponses du tour précédent. Les réponses sont liées au jeu exact de questions présenté et relu ; les précisions indépendantes sont conservées.
- Description et repères sont liés à leur version source. Alterner original et adaptation ne détruit ni ne remplace les informations de l’autre. Préserver la compatibilité des anciennes données sans inventer leur association.

## 4. Réception

Tests rouges ciblés observés avant correction ; tests de domaine et vrais écrans sur bases jetables, appels simulés ; régression navigateur complète, outils Node et migrations inchangées vérifiées. Contrôles d’archives et de concurrence selon les modules modifiés. Captures mobiles et ordinateur des états touchés. Aucun vrai appel assistant ou compte privé utilisé. APP 0.23.2 et cache correspondant lors de l’intégration ; pas de montée DB sans index neuf, pas de SQL anticipée. Documenter les limites réelles et les points encore ouverts.

## 5. Résultat précédent et nouvelle tentative

Une nouvelle saisie après une réponse reçue met cette réponse à l'abri avant toute invalidation ou nouvelle tentative. Un emplacement `proposition_precedente` du journal conserve le résultat, sa version et son contexte exacts, le modèle, la date de réponse, l'identifiant de tentative, le cycle et le propriétaire. Les réponses aux questions du Thermomix restent liées au contexte de cette réponse. Le résultat conservé est borné et revalidé ; aucune suppression silencieuse ne résout un dépassement.

Un seul départ supplémentaire est autorisé tant que cet emplacement est occupé. `tentative_suivante_id` l'identifie. Son succès comme son échec laisse le résultat précédent consultable sans appel ; toute autre demande nécessite un choix explicite. Les frappes intermédiaires ne remplacent pas le résultat conservé et ne peuvent pas effacer une seconde réponse payée lorsque l'emplacement est déjà occupé.

**Reprendre le résultat précédent** est une commande conditionnelle, sans appel, suivie de la relecture habituelle. Elle exige le même propriétaire, la source et le cycle attendus. Si un nouveau résultat courant existe déjà, les deux résultats sont échangés pour ne pas perdre le nouveau. Une source ou un cycle changé laisse l'ancien résultat consultable mais interdit son application automatique. **Écarter le résultat précédent** demande un choix explicite et conditionné sur le journal affiché ; le texte explique qu'il ne sera plus disponible dans ce brouillon. L'abandon du brouillon entier reste distinct et conserve les résultats de son journal.

Pour les repères enregistrés, l'enveloppe JSON passe à la révision 2 avec lecture des révisions 1 et 2. Les entrées des autres versions/signatures sont conservées, dans la limite totale existante de 192 Kio ; la limite refuse l'écriture plutôt que purger l'historique. Les corrections de temps identifient leurs sous-champs : modifier le temps actif ne réattribue pas le total ni la cuisson. Le format de sauvegarde, les magasins et la version IndexedDB ne changent pas pour ces champs JSON. Vérifier le refus atomique d'une écriture par l'ancien éditeur et l'aller-retour d'une archive contenant plusieurs versions de repères.

La réponse conservée doit être celle effectivement affichée et relue. Les persistances de saisie et les commandes de conservation sont conditionnées sur le journal affiché ; une nouvelle réponse reçue dans un autre onglet ne remplace pas silencieusement ce consentement. Le conflit conserve les résultats et la saisie, rend l'actualisation accessible et exige une nouvelle relecture après actualisation.

## 6. Clôtures reçues entre appareils — amendement de réception

Une preuve avec deux bases, les vrais envoi/réception et un appel Thermomix suspendu montre que la règle serveur « date la plus récente » peut réouvrir un brouillon ignoré sur un autre appareil : sa réponse termine avant réception de la clôture. La nouvelle application réconcilie donc uniquement les lignes `imports` Thermomix/repères d'identité inchangée (identifiant, recette, nature).

Pour ces lignes, `enregistre` prime sur `ignore`, et chaque état fermé prime sur un état ouvert, quelle que soit la date. Les états fermés de même rang gardent l'arbitrage usuel. Les tombales ne sont pas assimilées à un état ouvert. Cette règle s'applique à la réception, aux réponses d'envoi et aux résolutions d'anciens conflits.

La copie perdante est conservée dans `sync_conflicts` sous un type documentaire distinct, avec clé issue du contenu. Elle reste consultable en texte, sans geste de remise en activité, sans purge automatique et sans retrait lors de l'accusé du renvoi. Cette conservation est locale et hors archive, comme le magasin de conflits existant ; aucune nouvelle conservation synchronisée n'est introduite après un abandon explicite.

Une clôture locale battue par la date distante est réhorodatée au-delà de cette date puis remise en file, atomiquement avec la copie et la réception. Un écho plus ancien ne provoque pas de nouveau renvoi ; un écho fermé ne provoque aucune nouvelle écriture. Les écritures et accusés vérifient le compte et la copie locale relue. Les tests couvrent deux vrais moteurs, réessai, rejet push, écho ancien, protection des conflits et changement de compte.

Sans migration SQL, cette règle n'est pas une fermeture globale garantie : un ancien client qui n'a pas reçu la clôture peut encore réouvrir temporairement la ligne serveur. Une application à jour ayant connaissance de la clôture conserve son état fermé et réconcilie à la réception. Aucun résultat tardif ne crée automatiquement une recette ou une adaptation.
