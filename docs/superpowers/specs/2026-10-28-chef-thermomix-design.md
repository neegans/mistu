# Lot I3 — Chef Thermomix

**28 octobre 2026 — révision 1 approuvée par Neegan (« go »). Construction autorisée.**

Références : [passation I2–I3](../../lots/2026-10-28-lot-I2-I3.md), [méthode du projet](../../../AGENTS.md),
[état publié](../../../STATE.md). Base : I2 publié, `main` `34105d2`, application `0.19.0`, DB 4.

## 1. Résultat attendu et décisions approuvées

Depuis une recette, Neegan choisit les étapes qu’il veut confier au TM7. L’assistant propose leur adaptation,
avec des réglages lisibles, explique les changements et signale ce qui manque. Neegan compare avec sa recette,
puis choisit de conserver une nouvelle version. Les autres étapes et les ingrédients restent inchangés.

« Copier pour Cookidoo » prépare ensuite la saisie dans les Recettes créées. Mistu ne commande pas le robot.
La synchronisation des Recettes créées vers TM7 est documentée ; **Recipe Handover / “Send to Thermomix”
exclut expressément les recettes créées par l’utilisateur** [S7, S8].

Les choix suivants ont été approuvés avec la spec :

1. **Première version limitée au manuel et à la vapeur**, avec le bol, le fouet, le panier ou le Varoma.
   Les limites ci-dessous forment un sous-ensemble volontaire des possibilités du TM7.
2. **Réglages liés aux quantités de la version source.** Pas de recalcul automatique des réglages lorsque les portions changent.
3. **Durées et réglages nouveaux présentés comme des propositions estimées**, jamais comme des données du livre ou une cuisson vérifiée.
   Cela précise, pour cette adaptation demandée, la règle « rien d’inventé » : aucune nouvelle quantité d’ingrédient,
   aucune provenance ni garantie alimentaire inventée ; une estimation de réglage reste explicitement une estimation.
4. **Copie assistée, champ par champ**, avec un texte complet disponible en complément. Pas de promesse de collage magique dans Cookidoo.

Le profil connu est **TM7 Amérique du Nord, 120 V**, abonnement Cookidoo actif, accessoires de la boîte,
plus couvre-lames et éplucheur. Aucun Cutter ni Sensor. Le profil et ces limites sont affichés avant le premier appel.
Les préférences générales de matériel de Mistu ne doivent pas étendre silencieusement ce profil.

## 2. Parcours dans Mistu

### 2.1 Choisir la partie à adapter

Sur la fiche, dans les gestes de la **version affichée**, « Adapter au Thermomix » ouvre un écran dédié.
Une référence d’index sans recette invite d’abord à importer les pages. Une recette partielle reste marquée comme telle ;
le chef demande les informations manquantes si elles conditionnent les étapes choisies.

L’écran montre la version source, ses quantités, ses étapes numérotées avec cases à cocher et une demande facultative
de 500 caractères : par exemple « faire seulement la sauce au Thermomix ». Rien n’est présélectionné.
Une ou plusieurs étapes, contiguës ou non, peuvent être cochées ; elles restent dans leur ordre d’origine.

V1 travaille sur les quantités enregistrées dans la version. Si la fiche affichait des portions recalculées, le retour
aux quantités source est annoncé et accepté **avant** l’appel. Les portions inconnues restent inconnues ; la liste exacte
des ingrédients constitue alors la référence. Si une quantité nécessaire est absente, le chef pose une question.

« Proposer l’adaptation — 1 appel » nécessite une session assistant utilisable, le réseau et au moins une étape choisie.
Le brouillon est conservé localement avant l’appel. Les garde-fous existants de quota, connexion et appel en cours s’appliquent.
Lire, comparer et cuisiner une adaptation déjà conservée restent possibles hors ligne.

### 2.2 Réponse, précisions et comparaison

Le chef répond par une **proposition**, des **questions** ou un **refus motivé**. Une information manquante n’est jamais
remplacée par une quantité, un niveau de bol ou une température supposés. Les précisions viennent de Neegan,
restent attribuées à sa saisie et ne réécrivent pas les ingrédients de la recette.
Si une quantité d’ingrédient manque à la source, la question invite à compléter une version personnelle de la recette,
puis à repartir de cette version. Les précisions du brouillon servent au contexte matériel, notamment l’eau de vapeur et le départ froid.

La comparaison présente, pour chaque étape cochée : le texte source, les sous-actions proposées, leurs réglages et la raison
du changement. Les autres étapes restent consultables. Exemple de présentation :

> Réglages proposés · à vérifier en cuisinant
> 8 min / 100 °C / sens inverse / vitesse mijotage

Cet exemple illustre le format, pas un réglage culinaire conseillé sans recette. « Sans chauffe » signifie absence de consigne
de chauffe ; il ne signifie pas que le contenu du bol est froid.

Une réponse invalide est refusée en entier, avec une raison compréhensible. Aucune vitesse, température, durée ou sélection
n’est corrigée automatiquement. L’utilisateur peut modifier sa demande ou ses réponses, puis relancer explicitement un appel.
Il peut abandonner ou revenir à la sélection sans perdre son texte. Il n’y a pas d’éditeur libre de paramètres dans cette V1.
Chaque nouvel appel renvoie l’instantané, la sélection, le profil et les précisions : l’assistant n’a pas de mémoire entre appels.

« Garder cette adaptation » exige la confirmation de relecture. Il crée la version puis ouvre sa fiche ; le succès n’est annoncé
qu’après l’écriture. La nouvelle version porte **« Adaptée au TM7 avec l’IA · non testée »**. La marquer testée conserve son origine
et ne certifie ni ses réglages ni sa sécurité alimentaire. Les notes et photos du lot I2 fonctionnent sur cette version exacte.

## 3. Contrat de recette et de version

L’entrée de l’assistant est un instantané borné de la version : ingrédients, quantités, unités et convention, toutes les étapes,
portions connues ou nulles, restrictions existantes, sélection et demande. Les notes personnelles, photos, historique et données
de compte ne sont pas envoyés. Si l’ensemble dépasse les limites, le parcours l’explique ; aucune étape de contexte n’est tronquée.

Le modèle ne renvoie **pas** une recette complète. Il fournit exactement un bloc de remplacement par identifiant d’étape sélectionnée.
Un bloc peut contenir plusieurs sous-actions. Le nombre et l’ordre des étapes extérieures restent identiques : les renvois du texte
source vers « l’étape 4 » ne changent pas. Une dépendance qui exige de modifier une autre étape mène à une question demandant
d’étendre la sélection, puis à un nouvel appel volontaire.

À la conservation, le client fabrique une `RecipeVersion` :

- `kind: adaptation`, `status: proposed`, `recipe_id` inchangé, `parent_version_id` = version effectivement relue ;
- ingrédients et portions copiés exactement ; textes des étapes non sélectionnées conservés à l’identique ;
- identifiants neufs pour **toutes** les étapes de la nouvelle version, avec correspondance vers les identifiants source ;
- texte des étapes adaptées assemblé par le client, réglages issus des champs typés, et plan structuré dans `provenance.thermomix` ;
- provenance du livre ou du Web conservée comme origine de la recette ; marqueur IA distinct, sans transformer une recette de livre
  en création intégrale de l’IA ni détourner `provenance.creation` ;
- modèle réellement retourné par la passerelle, révision du contrat et du profil matériel, empreinte de l’instantané,
  sélection, précisions utilisateur et date de relecture ; aucun champ de provenance choisi par le modèle ;
- durées globales de préparation/cuisson devenues incertaines laissées nulles dans l’adaptation. Les anciennes restent dans l’instantané
  source ; aucune addition des sous-actions n’est présentée comme durée totale de recette.

Les traductions des étapes remplacées sont invalidées ; aucune traduction source ne doit apparaître sous une nouvelle instruction.
Les traductions des autres étapes peuvent être conservées si leur correspondance est certaine.
La recette, sa version courante et l’original ne sont pas réécrits ; la fiche ouvre explicitement la nouvelle version.
Une session de cuisine déjà ouverte garde ses versions. Une durée proposée ne démarre aucune minuterie automatiquement :
un geste explicite reste nécessaire et la durée est présentée comme estimée, y compris dans le choix de minuterie.

Une nouvelle adaptation d’une version TM7 conserve les blocs non sélectionnés et remplace les seuls blocs sélectionnés.
Le plan résultant entier est revalidé, notamment les transitions et les quantités. Une correction manuelle qui modifie une étape,
un ingrédient ou les portions invalide l’approbation du plan ; elle reste lisible comme version personnelle, avec son ascendance IA,
mais les gestes de cuisson TM7 et de copie Cookidoo exigent une nouvelle adaptation relue.

## 4. Profil TM7 : faits vérifiés et limites de V1

### 4.1 Contraintes du constructeur

Sources primaires consultées le 28 octobre 2026 ; pages ci-dessous : pagination française imprimée du manuel US/CA/MX V5 [S1].

| Élément | Fait retenu | Source |
|---|---|---|
| Bol / panier | Maximum 2,2 L / 1,4 L ; panier au plus 100 °C | S1 p. 26–27 |
| Fouet | Vitesse au plus 4, température au plus 100 °C, durée au plus 2 h | S1 p. 27, 34 |
| Soupes, ragoûts, confitures | Au plus 100 °C **et** vitesse 2 | S1 p. 29 |
| Couvercle | Nécessaire lorsque les lames tournent ; verrouillage au-dessus de 2 | S1 p. 35–36 |
| Vapeur | Vitesse au plus 5 ; au moins 500 g d’eau pour 30 min ; passages de vapeur libres | S1 p. 38 |
| Chauffe | Inactive aux vitesses 6,5 à 10 | S2 |
| Varoma | Accessoire ; sur TM7, utiliser le mode Vapeur, pas une « température Varoma » | S3 |
| Turbo / Pétrin | Turbo désactivé au-dessus de 60 °C ; Pétrin activable seulement sous 60 °C | S4 |

Ces bornes ne prouvent pas qu’une recette cuise correctement. La consigne de température ne mesure pas le contenu du bol.
Mistu ne reçoit ni température, ni volume réel, ni état du couvercle du TM7.

### 4.2 Sous-ensemble proposé pour la première version

Le profil embarqué, versionné et indépendant de la réponse IA, utilise une liste fermée. Un réglage absent est refusé,
jamais arrondi ni transformé. Les restrictions suivantes sont des **choix Mistu**, pas les capacités maximales du robot.

| Champ | Valeurs proposées en V1 |
|---|---|
| Mode | `manuel` ou `vapeur` |
| Température manuelle | Sans chauffe ou **100 °C** ; les autres valeurs attendent une vérification du sélecteur TM7 120 V |
| Température en vapeur | Absente : le mode est explicite, sans fausse valeur « Varoma » |
| Vitesse | `mijotage` ou entier 1 à 10 à froid ; en chauffe ou vapeur, plafond **2 choisi par Mistu** |
| Sens | Normal ou inverse ; inverse limité par Mistu à mijotage, 1 ou 2 |
| Durée d’une action | Entier de 1 à 1 800 secondes ; ce plafond de 30 min est une limite Mistu |
| Accessoires | Couteau et couvercle ; fouet, panier, Varoma ou panier + Varoma selon les combinaisons décrites ci-dessous |
| Fouet | Manuel, sens normal, vitesse au plus 4 ; pas de vapeur |
| Panier | Manuel au plus 100 °C, ou vapeur ; vitesse mijotage ou 1 |
| Varoma | Mode vapeur, seul ou avec panier ; vitesse mijotage ou 1 si panier présent ; jamais de fouet |

« Mijotage » est un jeton propre, sans assimilation non vérifiée à la valeur numérique 0,5. Le manuel décrit ce réglage [S1 p. 36].
La plage manuelle 37–120 °C existe dans une fiche officielle européenne, mais sa liste de valeurs n’a pas été établie pour le
sélecteur nord-américain. **100 °C seulement est une limitation notable de cette proposition**, à élargir sur preuve officielle
régionale ou constat de Neegan sur son appareil ; l’assistant ne peut pas inventer la liste.

Turbo, Pétrin, Rissoler, cuisson sans couvercle, sous-vide, cuisson lente, fermentation, épluchage et couvre-lames sont hors
génération V1. Le couvre-lame éplucheur combiné original est compatible TM7/TM6/TM5 [S5] ; l’exclusion porte sur les protocoles
de cette version, pas sur sa compatibilité. Rissoler existe en fonction de base TM7 [S6] : ne pas le dire réservé aux recettes guidées.
Les sources France de cuisson lente divergent ; aucun des deux minimums n’est retenu ici.
Le montage vapeur avec panier et Varoma est décrit dans le manuel [S1 p. 38] et dispose d’une consigne fixe dédiée.

### 4.3 Contexte matériel et culinaire

Les réglages ne sont pas validés isolément. Le contrôle porte sur la séquence complète et les étapes source intermédiaires.
Après une chauffe, ou si l’état thermique est inconnu, Mistu exclut les actions au-dessus de la vitesse 2 de ce profil.
Le modèle ne peut déclarer le bol froid pour lever cette restriction. Une demande qui exige ce mixage mène à une question ou
à un refus dans V1. Le mélange de liquide chaud à haute vitesse reste hors de ce lot.

Pour une opération sans chauffe au-dessus de 2, la relecture demande de confirmer que le bol et les ingrédients sont froids
**au début de cette action**, sans contredire une chauffe précédente connue. Tout transfert depuis une étape source non sélectionnée
dont l’état thermique n’est pas établi reste inconnu. Une phrase libre « laisser refroidir » ne réinitialise pas cet état.
Le hachage d’un ingrédient froid avant constitution d’une soupe reste possible ; la restriction concerne la préparation chauffée,
pas le titre de la recette entière. Les opérations avec chauffe sont plafonnées à 2 dès leur démarrage.
Les contrôles de texte peuvent repérer des contradictions manifestes ; ils ne prétendent pas déduire avec certitude la nature de chaque aliment.

Les instructions fixes d’installation viennent du profil, jamais du modèle : couvercle en place pour toute rotation, montage du Varoma
selon le manuel, passages libres, accessoires compatibles. Un texte demandant de retirer le couvercle pendant la rotation ou de
contourner une sécurité rend la proposition irrecevable. Les consignes de montage ne sont pas des champs de prose libres du modèle.

Le volume réel est à contrôler sur les repères du bol et du panier. On ne convertit jamais une somme de grammes en litres.
Un volume explicite supérieur à la capacité est refusé ; un volume inconnu n’est pas étiqueté « capacité vérifiée ».
La relecture et l’entrée en cuisine rappellent la vérification physique pour les contenants utilisés.

Une proposition vapeur doit disposer de l’eau nécessaire dans le contexte explicite. Le minimum du manuel est une condition matérielle,
pas une quantité ajoutée à la recette par l’IA. Si cette eau n’est pas renseignée, demander à Neegan de préciser la préparation du bol.
Le cumul des actions vapeur du plan entier, blocs TM7 préexistants compris, est limité à 30 min. Le cumul des actions avec fouet
est limité à 2 h. Changer de bloc, ajouter une préparation textuelle ou suggérer un remplissage ne remet pas ces compteurs à zéro.
Pas d’extrapolation de la réserve d’eau au-delà de 30 min, ni de découpage d’une longue cuisson pour contourner cette limite.
Une chauffe d’huile seule, un ajout de graisse déjà chaude ou une cuisson dépendant d’un protocole hors profil sont refusés [S1 p. 29].

## 5. Réponse hostile et validation

Le module de domaine réutilise le **transport** `appelerAssistant('creation', …)` et les erreurs de passerelle. Il ne réutilise pas
le fabricant de recette de `creation-ia.js`, qui remplacerait tous les ingrédients et toutes les étapes.

Contrat JSON fermé : `type` vaut `proposition`, `questions` ou `refus`. Aucun URL, HTML, source bibliographique, identifiant de version,
accessoire libre, statut « testé » ou garantie alimentaire n’est accepté. Propriétés propres, types exacts et nombres finis ;
champs inconnus refusés. Les textes sont normalisés, bornés et rendus par des nœuds texte.

Une proposition contient `blocs` : identifiant source autorisé, raison du changement et liste ordonnée d’actions.
Une action est soit une préparation structurée, soit un réglage typé : mode, secondes, température ou absence de chauffe,
vitesse, sens, accessoire et références d’ingrédients présents dans l’instantané. Les préparations ont une liste fermée : ajouter,
réserver, transvaser, racler les parois à l’arrêt, répartir dans le Varoma, vérifier la texture. Ingrédients et contenants sont des
références autorisées ; le texte opérationnel est rendu par le client. Une opération hors de cette liste mène à une question ou un refus.
La prose du modèle se limite aux raisons et questions, sans être insérée comme instruction de cuisson.

Les quantités ne sont pas réémises par le modèle : les références renvoient aux quantités source. Ajouter deux fois le même ingrédient
en quantité complète est refusé ; un partage non établi par la source mène à une question. Une instruction de la source qui attribue
des fractions non structurées ne suffit pas à en inventer l’allocation : compléter la version source ou renoncer à cette proposition.
L’eau technique de vapeur saisie par Neegan est une condition de montage distincte, identifiée comme telle.

Le validateur refuse les doublons, étapes absentes ou hors sélection, ingrédients étrangers, opérations non supportées, incohérences
de mode/accessoire, valeurs hors profil et contradictions détectables entre prose et paramètres. Il ne suffit pas de rechercher
quelques mots interdits : les paramètres, références, couvertures d’étapes et transitions sont contrôlés structurellement.
La consigne demande une question ou un refus dès que les conditions ne sont pas établies.

Limites de travail proposées : 60 ingrédients, 40 étapes source de 2 000 caractères, 20 étapes sélectionnées, 6 sous-actions par bloc,
80 actions au total, 300 caractères par raison, 4 questions de 300 caractères et 500 caractères par réponse utilisateur.
Une demande complète est plafonnée à 128 Kio UTF-8 ; réponse à 1 Mio, sortie à 16 000 jetons, durée d’appel à 135 s conformément au
transport existant. Un dépassement est expliqué, sans troncature ni conservation partielle. Les erreurs n’affichent pas la réponse brute.

La validation est rejouée à la réception, à la conservation, après reprise/synchronisation/restauration, et avant cuisson ou export.
Un profil inconnu ou une empreinte divergente rend le plan inutilisable comme adaptation TM7 ; la source reste accessible.
Ces contrôles établissent la conformité au contrat logiciel, **pas la sûreté culinaire du texte produit par un modèle**.
La mention de proposition, la comparaison et la relecture demeurent donc visibles.

## 6. Brouillon, concurrence et quantités

Un journal `imports.kind: thermomix` réutilise le magasin existant. Il conserve la source, son empreinte, la sélection, la demande,
les précisions, la phase, la proposition validée et l’identifiant de la version conservée. Les états existants suffisent :
`a_lancer`, `en_cours`, `a_verifier`, `enregistre`, `echec`, `ignore`. Aucun secret ni réponse brute hostile n’y est enregistré.
Proposition, questions et refus valides arrivent en `a_verifier`, avec leur discriminant ; seules les propositions ouvrent « Garder ».
Modifier la sélection ou répondre aux questions repasse par `a_lancer` avant un appel volontaire. Une erreur de transport ou de validation
mène à `echec`. Un refus se consulte, puis se reformule ou s’abandonne ; il n’est pas confondu avec une panne.
Les informations nécessaires à la revalidation et à la provenance sont aussi dans la version conservée : la purge des journaux
terminés après 30 jours ne doit pas la rendre illisible.

L’ouverture conserve la règle locale existante d’un journal ouvert par recette, toutes sortes confondues. S’il en existe un,
proposer de le reprendre ou de le fermer explicitement, sans l’annuler d’office. Le constructeur I3 n’utilise pas l’ouverture
réservée aux imports de pages. Les listes, titres, reprises et actions du journal reconnaissent cette nouvelle sorte sans exiger
de photos ni masquer sa reprise sous prétexte que la recette est déjà disponible.

La route et le journal permettent de reprendre après fermeture. Un appel interrompu ne repart pas au rechargement ; il faut
choisir « Réessayer — 1 appel ». Double clic, réponse tardive, changement de sélection, suppression de la source ou changement
de compte ne doivent jamais conserver une ancienne réponse. Le marqueur de tentative est vérifié dans la transaction,
pas seulement dans l’écran. La saisie en cours est protégée des rafraîchissements de synchronisation.

Toutes les écritures passent par `repo`. La conservation de la version et la clôture du journal sont atomiques et conditionnées
à la même source et tentative. Deux onglets gardant le même résultat retrouvent une seule version. Si la synchronisation transmet
un brouillon à un autre appareil, celui-ci peut le consulter, mais seul l’appareil créateur peut le modifier, relancer ou conserver.
La reprise en écriture après fermeture se fait donc sur cet appareil. Ailleurs, une copie indépendante n’est proposée qu’après
clôture du journal sur l’appareil créateur et réception de cette clôture par synchronisation. Le journal reçu encore ouvert bloque
donc bien sa copie ; l’écran indique où le terminer ou l’ignorer. La copie porte de nouveaux identifiants et reste soumise à l’absence
d’autre journal ouvert connu sur cette recette. Elle est annoncée comme une nouvelle adaptation. Pas de garantie d’unicité mondiale
entre appareils déconnectés ni de refonte de la synchronisation dans I3.

Une fonction de domaine commune vérifie la correspondance entre le plan, les quantités, les portions et les étapes.
Elle garde **tous** les chemins : fiche, lien avec `?servings`, lancement de repas, chargement/reprise de session et exports.
Si des portions différentes sont demandées, le mode cuisine TM7 et la copie restent bloqués avec retour explicite aux quantités adaptées.
Si les portions sont inconnues, aucune valeur par défaut ne devient une nouvelle quantité : comparaison sur la liste d’ingrédients.
La condition exige aussi des portions demandées nulles : `source.servings === null` interdit qu’une URL, un repas ou une session
introduise un nombre. Le retour aux quantités d’origine efface explicitement cette valeur ; la seule égalité des ingrédients ne suffit pas.
Les durées, vitesses, températures et capacités ne sont jamais multipliées par le facteur de portions.

## 7. Copier pour Cookidoo

Le geste est disponible sur une adaptation conservée, lisible par le contrat courant et correspondant à ses quantités.
Il ouvre un panneau montrant exactement ce qui sera copié : titre, portions connues, ingrédients et recette complète,
avec étapes source conservées et sous-actions TM7. L’origine et l’état réel de la version restent dans le texte : proposition IA non testée,
ou cuisinée par l’utilisateur, sans certification des réglages. Une adaptation de source partielle peut se conserver et se consulter,
mais **tous les gestes de copie Cookidoo sont bloqués** jusqu’au complément et à une nouvelle adaptation de la source complète.
Le message « Recette incomplète » donne accès à la source, sans annoncer de texte prêt à cuisiner dans Cookidoo.

Le panneau propose « Copier le titre », une copie par ingrédient et par étape, et « Copier tout le texte » pour consultation.
Les sous-actions restent sous le numéro de leur étape source, afin de ne pas déplacer les renvois du texte original.
**Un bloc source correspond à un champ d’étape Cookidoo** ; ses sous-actions sont numérotées à l’intérieur du texte.
Le panneau ne les fractionne pas automatiquement en nouvelles étapes Cookidoo. Plusieurs réglages dans un même champ ne sont pas
promis comme programmables : seules les annotations réellement offertes peuvent être saisies, les autres restent des réglages manuels.
Les portions et quantités viennent du même instantané ; le nombre affiché ailleurs sur la fiche ne les remplace pas.

Le succès signifie seulement **« Texte copié »**, après résolution de l’API presse-papiers. En cas d’indisponibilité ou de refus,
le texte reste sélectionnable avec une instruction de copie manuelle. Aucun message « envoyé », « synchronisé » ou « prêt sur le TM7 ».

L’aide, concise et accessible depuis ce panneau, décrit le parcours officiel [S9–S11] :

1. Ouvrir Cookidoo Canada avec le lien officiel fixe ; Mes recettes → Recettes créées → créer une recette.
2. Renseigner les champs titre, portions, ingrédients puis étapes ; le collage global n’est pas un import documenté.
3. Ajouter seulement les réglages effectivement proposés par le bouton de cuisson de l’éditeur. Temps, température et vitesse sont
   documentés dans le tutoriel, encore rédigé pour TM6. Les autres restent des consignes manuelles ; ne pas convertir un mode en température.
   Sens inverse, modes et accessoires restent explicitement écrits et à vérifier/régler sur le TM7.
4. Enregistrer dans Cookidoo puis retrouver la recette par la synchronisation des Recettes créées vers le TM7.

La limite annoncée est de 100 Recettes créées avec abonnement actif [S9]. La capacité de synchronisation TM7 est documentée [S7],
mais la restitution précise de tous les réglages sur le compte canadien de Neegan n’a pas été essayée.
Aucune API publique officielle de création/export, ni lien préremplissant une recette externe, n’a été trouvé dans les sources consultées.
Mistu ne demande pas d’identifiants Cookidoo, n’automatise pas sa connexion et ne publie pas de recette pour contourner cette limite.

Les exports existants (JSON-LD, YAML Paprika, copie HTML) conservent aussi les réglages lisibles, la provenance d’adaptation et l’état réel de test.
Ils passent par le même lecteur de plan. Aucun `cookTime` ou `prepTime` source n’est réutilisé comme durée certaine de l’adaptation.
Une sauvegarde ZIP conserve les données ; une restauration ne dispense pas de les revalider.

## 8. Intégration réalisée après approbation

| Zone | Changement réalisé |
|---|---|
| Domaine neuf | Profil TM7, construction de demande, validation, lecture du plan, garde des quantités et format de copie |
| Journal neuf | Transitions de brouillon et conservation atomique, réutilisant `imports` |
| Interface neuve | Sélection → appel/questions → comparaison → conservation ; panneau Cookidoo |
| `recipe.js`, `recipe-edit.js` | Entrée sur la version affichée, provenance, invalidation d’une adaptation modifiée |
| `cook.js`, `meals.js` | Garde des quantités au lancement et à la reprise ; réglages et mentions lisibles |
| `exporters.js` | JSON-LD, YAML Paprika et copie HTML fidèles au plan, sans anciennes durées affirmées |
| `app.js`, `state.js`, `import-cible.js` | Route de l’écran, listes et reprise du journal, protection de la saisie |
| Schéma / vocabulaire | Ajouter `thermomix` aux sortes d’import ; champs JSON, pas de magasin ni index neuf |
| i18n / cache / tests | Tous les textes via `t()`, anglais, `MODULES_NEUFS`, modules dans `SHELL` |

Aucune migration SQL ni nouvel outil assistant. `DB_VERSION` reste 4. Construction locale en `APP_VERSION 0.20.0`,
cache `cuisine-os-v0.20.0-1` et épingles de version mises à jour. Les résultats mesurés sont consignés dans `STATE.md`.
La publication, distincte de cette construction, a été autorisée ensuite par Neegan (« promote tout ») ; son bilan est dans `STATE.md`.

## 9. Preuves attendues

Tests de comportement, données jetables, passerelle injectée ; aucun appel assistant payant dans la suite.

| Cas | Résultat attendu |
|---|---|
| Une étape, plusieurs étapes non contiguës, version affichée différente de l’original | Exacte sélection adaptée ; autres textes, ingrédients et original identiques |
| Plusieurs sous-actions / repas comprenant deux versions de la même recette | Numérotation extérieure stable ; progression isolée par identifiants neufs |
| Réponse hors sélection, doublon, ingrédient ajouté, nombre non fini, URL, HTML, texte excessif | Refus entier, aucune version ni commande exportable |
| Question, refus, quota, hors ligne, délai dépassé, annulation | État vrai, demande conservée, aucune relance automatique |
| Bornes du profil et valeur suivante interdite | Contrôles inclusifs exacts ; aucune correction des valeurs |
| Fouet >4, chauffe ou vapeur >2, température « Varoma », accessoire absent, mode hors V1 | Proposition refusée selon le profil Mistu |
| Liquide chaud, étape antérieure de chauffe, faux « sans chauffe = froid », soupe à vitesse >2 | Restriction thermique conservée, pas de contournement par prose |
| Capacité explicite 2,2 / 2,201 L et panier 1,4 / 1,401 L | Limites exactes ; inconnu jamais considéré comme vérifié |
| Vapeur sans eau renseignée, cumul >30 min ou fouet >2 h, même en plusieurs blocs | Question ou refus ; compteurs non remis à zéro par une phrase |
| Préparation libre, double ajout d’ingrédient, quantité cachée dans une instruction | Refus ; seules les préparations structurées sont exécutables |
| Double clic, deux onglets, réponse ancienne, changement de compte/source | Une conservation au plus pour le résultat courant ; aucune écriture tardive |
| Rechargement, synchronisation, ZIP, purge du journal, profil inconnu ou plan altéré | Reprise sans appel ; version autonome ; nouvelle validation ; plan invalide bloqué |
| Brouillon reçu d’un autre appareil / journal d’import déjà ouvert | Consultation sans écriture distante ; copie seulement après clôture reçue ; aucune clôture implicite |
| Portions modifiées par fiche, URL, repas ou session restaurée ; portions nulles | Même garde partout ; aucun réglage recalculé ni nombre de portions inventé |
| Correction manuelle, adaptation d’adaptation, traduction existante | Provenance et plan cohérents ; approbation invalidée si contenu modifié |
| Copie réussie/refusée, source partielle, version testée et exports existants | Texte exact, copie partielle bloquée, état réel, repli sélectionnable, aucune annonce de synchronisation |
| Cuisine terminée et photos/notes I2 | Historique lié à la version réellement cuisinée |

Vérification finale de construction : suite navigateur complète et épingle mesurée, outils Node en série, migrations `--check`,
vraie navigation et reprise hors ligne, clavier/lecteur d’écran, français/anglais et écrans 320/390/768/1280 pixels.
Les tests logiciels ne prouvent ni la qualité des propositions sur de vraies recettes ni leur exécution sur TM7.

Essai utilisateur après construction : une sauce choisie dans sa recette, comparaison et conservation, copie de quelques champs
dans Cookidoo Canada, réglages disponibles dans l’éditeur, synchronisation puis lecture sur le TM7. Une cuisson réellement réalisée
peut ensuite recevoir une observation/photo. Aucun essai physique ni fonctionnement Cookidoo ne sera déclaré réussi sans retour observé.

## 10. Sources officielles et limites de la recherche

- **S1 — [Manuel TM7 US/CA/MX V5, mars 2026](https://cdn.shopify.com/s/files/1/0772/4325/3038/files/digim_TM7_11011_V5.0_USCAMX_20260305.pdf?v=1773957827)**.
  Tableaux d’accessoires vérifiés visuellement ; références françaises dans §4, alimentation 120 V p. 42.
- **S2 — [Températures et chauffe TM7](https://globalsupport.vorwerk.com/hc/en-us/articles/22782044570780-Questions-about-TM7-Temperatures-and-Heating)**.
- **S3 — [Varoma TM7, support américain](https://service.thermomix.com/hc/en-us/articles/51487463673235-All-about-the-TM7-Varoma)**.
- **S4 — [Fonctionnalités et modes TM7, support américain](https://service.thermomix.com/hc/en-us/articles/47810683955603-What-to-know-about-functionalities-and-modes-of-TM7)**.
- **S5 — [Couvre-lame éplucheur, boutique américaine](https://www.thermomix.com/products/blade-cover-peeler)**.
- **S6 — [Compatibilité Thermomix, Cookidoo US](https://cookidoo.thermomix.com/foundation/en-US/thermomix-compatibility)**.
- **S7 — [Recettes créées et TM7, Vorwerk UK](https://support-gb.vorwerk.com/hc/en-gb/articles/19200758508700-Can-recipes-be-created-rated-and-translated-directly-on-the-TM7)**, 28 mars 2025.
- **S8 — [Recipe Handover vers TM7](https://globalsupport.vorwerk.com/hc/en-us/articles/23238724724764-How-to-send-Cookidoo-recipes-from-your-smartphone-to-Thermomix-TM7)**, 8 septembre 2026.
- **S9 — [Recettes créées, Cookidoo Canada](https://cookidoo.ca/foundation/en-CA/pages/discover-created-recipes)**.
- **S10 — [Saisir ingrédients et étapes](https://cookidoo.ca/foundation/tutorials/en-CA/courses/how-to-edit/edit-addingingredientandstepbasics)**.
- **S11 — [Ajouter les réglages de cuisson](https://cookidoo.ca/foundation/tutorials/en-CA/courses/how-to-edit/edit-addingingredientandstepadvanced)**.

Écarts clarifiés par rapport à la passation : synchronisation TM7 établie, Handover des recettes créées exclu, restitution de sens inverse
et modes encore non vérifiée. Pas de liste régionale exhaustive des températures/demi-vitesses ni de durée maximale manuelle affirmée.
L’[aide UK création](https://support-gb.vorwerk.com/hc/en-gb/articles/18203526304924-How-to-create-a-new-recipe-from-scratch)
et l’[aide UK éléments](https://support-gb.vorwerk.com/hc/en-gb/articles/18203542577948-Create-Add-elements-to-your-recipes)
divergent sur les modes TM6 ; elles ne fondent pas une promesse TM7.

**Spec approuvée sur « go » ; construction locale terminée, suivie dans le [plan I3](../plans/2026-10-28-chef-thermomix.md).**

Preuves automatisées : **6820/6820** dans le navigateur (épingle **6819**), **230/230** Node, migrations `--check` **0**.
Navigation réelle, copie Cookidoo, rechargement et cuisine hors ligne vérifiés avec un assistant simulé. Aucun appel assistant réel,
essai matériel. Publication I3 autorisée ensuite par « promote tout » ; son bilan est dans `STATE.md`.
Les essais sur le compte Cookidoo et le TM7 de Neegan restent à faire.

Relecture technique préparatoire : trois angles (TM7, intégration, Cookidoo). Corrections intégrées sur les bornes thermiques cumulées,
les portions inconnues, les préparations structurées, la reprise entre appareils et la copie des sous-actions. La relecture technique a précédé l’approbation de Neegan ; elle ne constitue pas une preuve de fonctionnement logiciel ou matériel.

## 11. Précisions de construction

- **I3-01 — Empreintes.** Les lecteurs de fiches, de sessions et d’exports sont synchrones. L’empreinte est la sérialisation canonique
  intégrale des champs contrôlés, comparée exactement ; elle n’est pas présentée comme une signature cryptographique.
- **I3-02 — Réadaptation d’une correction.** Une version modifiée manuellement conserve son ascendance TM7 et un marqueur d’invalidation.
  Sa réadaptation exige la sélection de toutes les étapes : aucun ancien réglage devenu incohérent ne doit rester sous une nouvelle approbation.
  Les restrictions de la parente sont conservées dans la correction.
- **I3-03 — Sessions.** La garde relit les versions puis les contrôle dans la transaction qui crée la session. Une valeur `null` par version
  n’est jamais remplacée par les portions générales du repas. Les contrôles des identifiants répétés sont dédupliqués.
- **I3-04 — Héritage du plan.** Chaque bloc conservé garde ses propres conditions matérielles et sa langue d’origine ; il reste lié au
  texte et aux minuteries source. Une déclaration du modèle ne peut ajouter un ingrédient absent des préparations structurées.
- **I3-05 — Retour idempotent.** Un journal déjà conservé doit pointer la version issue de sa source, de son contexte et de son résultat,
  avec sa provenance d’import ; une autre adaptation valide de la même recette ne suffit pas.

- **I3-06 — Contenu des contenants.** Le premier segment machine commence explicitement avec bol, panier et Varoma vides.
  Seules les préparations structurées établissent et déplacent les ingrédients présents ; les références d’un réglage doivent correspondre
  exactement à ce contenu. Un réglage ne peut pas déclarer un ingrédient jamais ajouté pour contourner la chauffe d’huile seule.
  Une étape source non sélectionnée entre deux blocs rend ce contenu inconnu : il faut une préparation explicite qui le réétablit ou
  élargir la sélection. Adapter une étape ultérieure seule reste possible avec ce départ vide et ses ajouts explicites.
- **I3-07 — Capacité explicite.** Un ajout individuel déjà mesuré en volume supérieur à la capacité du bol ou du panier est refusé,
  même si la précision de volume global est vide. Seules les conversions entre unités de volume sont admises ; aucune somme supposée,
  ni conversion masse vers volume. Les repères physiques restent à vérifier.
- **I3-08 — Exports globaux.** Les trois exports des Réglages valident tous leurs plans avant de générer un fichier. Un plan TM7
  invalidé bloque l’ensemble avec un message et un lien vers chaque version à revoir ; aucune recette n’est écartée silencieusement.
