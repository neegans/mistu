# Lot I2 — Livre sans saisie, photos et notes

**28 octobre 2026 — Révision 1, approuvée par Neegan : « ok go enchaine ». Construction du lot I2 autorisée.**

Base examinée : `main`, `baa7822` (passation), après I1 `7558ff2` ; application `0.18.0`, `DB_VERSION 4`.
Cette spec décrit le comportement à construire. Les nombres de tests et la livraison de I1 sont ceux des documents de passation,
pas des vérifications rejouées pendant sa rédaction.

Sources, lues dans l'ordre demandé : [AGENTS.md](../../../AGENTS.md), [STATE.md](../../../STATE.md),
[passation I2/I3](../../lots/2026-10-28-lot-I2-I3.md), puis [brief source](../../lots/2026-10-28-correctifs-isbn-couverture-index.md)
(§ 4, 5, 11 et 12). Les modules cités ci-dessous ont été consultés pour vérifier les contraintes.
Le début de `STATE.md` laisse la preuve Trinity à faire ; la passation, plus récente, rapporte que Neegan trouve l'extraction correcte.
I2 conserve I1 et ses règles ; il ne prétend pas apporter une nouvelle preuve de ses six pages.

## 1. Résultat attendu et périmètre

Un ISBN valide ou une photo de couverture, de quatrième de couverture ou de page de titre conduit à une fiche de livre préremplie,
avec les sources et les incertitudes. Neegan corrige et enregistre. Les recherches nécessaires se déclenchent dans ce parcours,
sans devoir ouvrir l'onglet Web ni recopier une recherche.

Lors de l'import ciblé d'une recette, l'app propose l'image du plat réellement imprimée sur une page, avec un recadrage ajustable.
Après une cuisson, Neegan peut ajouter ses propres photos et observations ; elles restent distinctes de l'image du livre.
Une note permanente « Mes notes » accompagne aussi la recette jusque dans le mode cuisine.

Inclus : ajout et complément d'un livre, provenance des champs, choix d'édition, recadrage depuis l'import ciblé,
formulaire de cuisson partagé, correction des observations, photos personnelles, notes permanentes, affichage, fichiers et synchronisation.
Exclus : chef Thermomix/Cookidoo (I3), nouvelle extraction d'index, enrichissement automatique de toute la bibliothèque,
génération d'images, recherche d'une photo de plat sur Internet, suppression physique des fichiers inutilisés.

## 2. Décisions et propositions soumises à relecture

« Acquis » reprend la demande ou une décision de la passation. « Proposition » identifie les détails soumis dans la révision 1 ;
le « ok go enchaine » de Neegan approuve cette révision et ces choix pour la construction.

| Réf. | Statut | Règle |
| --- | --- | --- |
| D-I2-1 | Acquis dans le brief ; option ouverte dans la passation résolue ici en faveur du brief | Relais Web **automatique et visible** après un catalogue sans correspondance fiable. Son coût est annoncé avant le geste initial. |
| D-I2-2 | Acquis | Une photo lance la lecture des indices puis la recherche Internet. Chaque donnée reste corrigeable, sourcée et « à vérifier ». |
| D-I2-3 | Proposition | Une tentative ISBN coûte au plus un appel assistant ; une tentative photo au plus deux : lecture, puis recherche Web. Pas de nouvelle tentative payée automatique après un échec. |
| D-I2-4 | Proposition | Le repérage de l'image du plat partage l'appel d'extraction de la recette. Aucun appel supplémentaire pour détecter ou recadrer l'image. |
| D-I2-5 | Acquis | « Utiliser cette image ? » : aperçu et confirmation indispensables. Aucune page entière ne devient automatiquement une photo du plat. |
| D-I2-6 | Acquis | Les photos personnelles appartiennent à une cuisson, dans `cook_history.photos`, et ne remplacent pas la photo du livre. |
| D-I2-7 | Acquis ; ordre précisé ici | La photo de la cuisson la plus récente passe en tête de fiche et sur la carte. À date égale : création de la cuisson, puis identifiant ; dans une cuisson : dernière photo de la liste. Modifier une observation ne change pas cet ordre. |
| D-I2-8 | Acquis | « J'ai cuisiné ce plat » hors mode cuisine, date par défaut aujourd'hui, observations facultatives, photos ; observations corrigeables ensuite. |
| D-I2-9 | Proposition à relire en priorité | Une cuisson exige une `RecipeVersion` existante. Sur une référence « À importer », proposer d'importer la recette d'abord ; « Mes notes » reste disponible. Permettre une cuisson sans version exigerait de revoir la contrainte serveur et cette spec. Aucune fausse version créée pour contourner cette contrainte. |
| D-I2-10 | Acquis | « Mes notes » est un texte personnel permanent sur `recipes`, affiché en tête et en mode cuisine ; il ne modifie aucune quantité ni étape. |
| D-I2-11 | Proposition | Six photos au plus par cuisson ; 10 000 caractères par observation ou note permanente. Les dépassements sont signalés, jamais tronqués à l'enregistrement. |
| D-I2-12 | Proposition | La couverture distante utilise le chemin Open Library par ISBN déjà permis. Sinon, garder la photo source ou une fiche sans image ; pas de téléchargement d'une adresse d'image produite par le modèle. |

## 3. Invariants

1. Toute réponse distante est une donnée hostile : validation de structure, propriétés propres, types, tailles, vocabulaires et relations.
   Aucun HTML rendu ; les textes du modèle ne contiennent pas d'adresse. Les liens de provenance suivent un contrôle séparé (§ 6).
2. Une métadonnée inconnue reste vide. Ni année de première publication prise pour l'année d'une édition, ni langue ou convention de mesure
   attribuée par défaut comme si elle avait été trouvée. Aucune compatibilité alimentaire déduite d'un livre ou d'une image.
3. Aucune correction manuelle, y compris un champ vidé ou une suggestion retirée, n'est écrasée par une réponse tardive ou une relance.
4. Une recherche ne crée pas un livre. Seuls « Ajouter ce livre » et « Enregistrer les compléments » écrivent la fiche finale.
5. L'original d'une recette et toutes ses versions restent intacts lors d'un changement de photo ou de note.
6. Les octets d'une image sont enregistrés avant son pointeur. Un échec d'écriture ne produit pas de message de réussite.
7. Une note ou une photo personnelle n'est jamais envoyée à l'assistant pour identifier un livre ou lire une page.
8. Écritures par le dépôt ; fusion et gardes dans la transaction. Une double tape ne double ni l'appel, ni le livre, ni la cuisson.
9. Aucun magasin, index IndexedDB, outil assistant ou service externe nouveau. Aucun changement SQL ou serveur prévu.

## 4. Identifier ou compléter un livre par ISBN

### 4.1 Parcours

1. Le lecteur ou la saisie fournit un ISBN. `src/core/isbn.js` reste la référence : espaces/tirets, contrôle ISBN-10/13 et préfixe 978/979.
   Un supplément de prix à cinq chiffres n'est pas un ISBN. Une lecture invalide reste corrigeable ; zéro requête catalogue ou assistant.
2. Afficher « Recherche dans ta bibliothèque… », chercher l'ISBN canonique dans les éditions locales, y compris les anciennes valeurs
   normalisables. Si trouvé : « Ce livre est déjà dans ta bibliothèque », « Ouvrir le livre », « Compléter les informations ».
   Aucun appel distant pour simplement ouvrir. Plusieurs fiches déjà présentes sont montrées, jamais fusionnées automatiquement.
3. Sinon, interroger les catalogues existants. Une réponse doit justifier l'édition exacte : une œuvre regroupant plusieurs éditions
   ne suffit pas à en affirmer l'année, l'éditeur ou la langue. Les données d'œuvre peuvent fournir titre/auteur, avec leur portée indiquée.
4. Sans correspondance fiable, lancer une seule recherche assistant ciblée sur l'ISBN exact. Afficher
   « Livre non trouvé dans le catalogue. Recherche sur Internet… ». Si le catalogue est en panne, dire à la place
   « Catalogue indisponible. Recherche sur Internet… » : ne pas présenter une panne comme une absence.
5. Une candidate unique et cohérente préremplit le formulaire : « Livre identifié — vérifie les informations. ».
   Si plusieurs éditions sont plausibles : « Plusieurs éditions possibles. », avec titre, auteur, ISBN, année, langue, éditeur
   et sources disponibles. Aucune candidate présélectionnée ; aucune page rattachée avant le choix.
6. Aucun résultat suffisamment étayé : « Aucun résultat fiable. Tu peux compléter la fiche manuellement. ».
   Garder l'ISBN, les indices lus, la photo et toutes les corrections. Titre requis pour enregistrer ; les autres données peuvent rester vides.
7. « Ajouter ce livre » relit les doublons dans la transaction avant de créer `books` et `book_editions` et de fermer le brouillon.
   Si l'édition est apparue depuis le début : proposer de l'ouvrir ou de la compléter. Ne pas créer une seconde fiche.

Le formulaire annonce avant « Identifier » : « Si le catalogue ne trouve pas l'édition, la recherche Internet utilise 1 appel de ton quota. ».
Une correspondance catalogue suffisante n'ajoute pas un appel pour remplir à tout prix des catégories manquantes.
« Compléter avec Internet (1 appel) » reste possible depuis le formulaire ou la fiche livre, sur geste explicite.

### 4.2 Rapprochement et corrections

L'ISBN exact validé est prioritaire, puis viennent la cohérence du titre, de l'auteur et des caractéristiques d'édition.
Une contradiction de titre ou d'auteur bloque l'identification certaine même si le modèle répète l'ISBN demandé.
Une recherche titre + auteur peut compléter les recherches internes au même appel ; elle ne remplace jamais l'ISBN saisi par un autre.
Un ISBN illisible ou invalide sur la photo reste un indice incertain, pas un identifiant enregistré.

Une édition différente ne reçoit jamais les pages de l'édition existante. Si Neegan choisit d'ajouter une autre édition d'un livre déjà
présent, proposer explicitement le rattachement au livre existant ; aucun rapprochement automatique sur le seul titre.

Chaque champ tient sa valeur actuelle, sa provenance et son état « modifié par moi ». Les champs préremplis encore intacts peuvent être
complétés ; un désaccord propose l'ancienne et la nouvelle valeur. Un champ manuel attend un choix explicite pour être remplacé.
Les anciennes fiches sans provenance sont traitées comme protégées, jamais comme des champs appartenant à l'assistant.
Un changement d'ISBN ou de photo invalide les résultats de l'ancienne tentative sans effacer les corrections personnelles.

La garde anti-doublon couvre une base locale et ses onglets, avec l'index ISBN existant. Deux appareils déconnectés peuvent encore créer
la même édition avant leur synchronisation : les doublons reçus doivent être signalés, sans fusion de pages ni suppression automatique.
I2 ne promet pas une unicité distribuée que le serveur ne garantit pas.

## 5. Identifier depuis une photo

Le premier écran accepte couverture, quatrième de couverture ou page de titre et annonce :
« La lecture de la photo et la recherche Internet utilisent jusqu'à 2 appels de ton quota. ».
Choisir une photo amorce le parcours annoncé ; une photo choisie seulement pour remplacer l'image décorative d'une fiche ne lance pas de lecture.

La photo est conservée avant le réseau. L'orientation EXIF est appliquée ; « Pivoter » reste accessible. La lecture peut proposer un quart
de tour supplémentaire, appliqué à l'aperçu et aux usages suivants, sans seconde lecture payée automatique. En cas de doute, Neegan pivote
et peut demander une nouvelle lecture dont le coût est annoncé. Une rotation n'altère pas la photo source conservée.

La lecture structurée est étendue à : titre principal, sous-titre, auteur(s), ISBN imprimé, éditeur, langue explicitement lisible,
résumé imprimé court, titres de compléments/ouvrages cités, orientation et incertitudes. Elle ne complète rien de mémoire.
Le cas Trinity doit séparer **Trinity: The Cookbook** de **Trinity: The Repertoire**, et l'EAN du code de prix.

Après une lecture exploitable, vérifier d'abord les éditions déjà présentes. Pour une nouvelle fiche, rechercher sur Internet avec l'ISBN
valide ou le titre et l'auteur ; les indices insuffisants conduisent à la saisie, sans requête générique payée. Si l'édition existe,
proposer « Ouvrir » ou « Compléter » ; la recherche de complément suit seulement le second geste.

Le formulaire présente titre/sous-titre, auteur, ISBN, éditeur, année, langue, description courte, couverture, types de cuisine et mots-clés.
Les types distinguent **origines/traditions**, **styles** et **familles de préparations**. Les anciennes cuisines non catégorisées restent
visibles, sans reclassement inventé. Les puces sont modifiables, retirables et dédoublonnées ; aucune cuisine géographique déduite de l'adresse
d'un restaurant. Les associations du livre restent des indices de recherche, jamais des garanties pour toutes ses recettes.

Une couverture catalogue par ISBN peut être proposée à côté de la photo prise, avec choix explicite. Ne pas remplacer d'office la photo
de Neegan. La photo source demeure consultable après enregistrement, même si une autre couverture est retenue. Ici « conservée » signifie
image entière normalisée, sans recadrage, avec retrait des métadonnées comme aujourd'hui ; la conservation des octets photo strictement
originaux ne fait pas partie du lot. L'échec de récupération d'une couverture ne bloque jamais la fiche.

## 6. Recherche Web, provenance et journal

### 6.1 Contrat assistant

Créer un domaine bibliographique distinct, utilisant `appelerAssistant('recherche-web', …)` avec sa consigne.
Ne pas appeler `chercherRecettesWeb` : ses champs et sa consigne concernent des recettes.
Le serveur accepte déjà `system` et l'outil Web ; aucun nouvel outil ni redéploiement requis.

Proposition de bornes : un POST, au plus trois recherches internes, 6 000 jetons de sortie, cinq candidates et dix sources retenues.
La recherche interne ne compte pas comme plusieurs appels du quota applicatif ; ne pas présenter pour autant son coût fournisseur comme nul.
Le quota quotidien vient de l'état serveur (60 appels par défaut aujourd'hui), sans nouveau plafond codé dans l'écran.
Réutiliser les limites de délai/corps de la passerelle et le verrou de vol partagé. « Annuler » empêche l'application tardive du résultat ;
un appel déjà parti peut avoir consommé son quota. Pas de continuation automatique de `pause_turn`, de réponse tronquée ou de refus.

La consigne exige une recherche effective, priorité éditeur/auteur/notices bibliographiques, identification de l'édition,
champs non établis à `null`, contradictions explicites, classifications séparées des faits, et ignorance des instructions dans les pages.
Les titres et textes du livre sont des données, jamais des instructions.

Le JSON décrit les candidates et, pour chaque valeur, son origine, ses sources et ses incertitudes. Les adresses ne sont permises que
dans les références de sources : elles doivent correspondre exactement à un résultat brut `web_search_result` de cet appel,
passer `lienSignet`, puis être limitées à HTTPS sans identifiants. Les textes et les champs bibliographiques rejettent les adresses.
L'hôte affiché vient de l'URL validée, jamais d'un libellé du modèle. Aucun `fetch` arbitraire vers une URL choisie par le modèle.

Une URL présente dans les résultats prouve seulement l'existence du résultat, pas la vérité de chaque champ. Les valeurs restent
« à vérifier », avec la source consultable ; une valeur sans source correspondante n'est pas un fait Web admissible.
Le modèle ne peut pas s'auto-attribuer le statut « vérifié ». Aucune preuve de recherche effective : échec explicite, pas de fiche prétendument trouvée.

Bornes proposées, en caractères Unicode : titre 300, sous-titre 300, auteur 300 (cinq au plus), éditeur 200, description 1 200,
incertitude/justification 300 (dix au plus), libellé de puce 80 (vingt par liste, plafond existant plus strict conservé le cas échéant).
ISBN contrôlé par `validerIsbn` ; année entière de 1000 à l'année courante + 2, sans déduction ; langue acceptée seulement si représentable
par le modèle de l'app, sinon signalée sans être convertie en français. Une borne technique ne prouve pas la véracité d'une valeur.
Un champ mal typé ou sans justification reste vide et signalé ; structure, identité ou taille globale illisibles : candidate refusée.
Un JSON coupé ne devient jamais une identification complète.

### 6.2 Provenance et reprise

Afficher près des champs : « Lu sur la photo », « Trouvé sur Internet · {hôte} », « Proposé par {catalogue} »,
« Suggestion de classement », « Modifié par moi », et les incertitudes. Une zone « Sources » donne les liens et la date de récupération.
Cette date est celle de la réponse reçue, pas une date de publication déduite. Une description résumée est étiquetée comme résumé,
et une suggestion renvoie aux éléments qui l'appuient.

Ajouter `imports.kind = 'livre'` dans le magasin existant, sans page et sans nouvel état global. Champs JSON de parcours :
entrée ISBN/photo, phase, données de lecture, résultat Web validé, brouillon, champs modifiés, suggestions retirées,
candidate choisie, générations de requête et compte des appels réellement partis. Les photos source sont des pointeurs vers `files`.
La table serveur `imports` ne borne pas `kind` : étendre le vocabulaire client ne demande pas de migration.

Les phases `bibliotheque`, `catalogue`, `lecture_photo`, `web`, `relecture` distinguent ce qui travaille. Les statuts existants
`a_lancer`, `en_cours`, `a_verifier`, `echec`, `enregistre`, `ignore` gardent leur sens. Une fiche saisie manuellement peut fermer
un import échoué sans prétendre que la recherche a réussi. Les résultats valides des phases terminées survivent à l'échec suivant.

Le brouillon est sauvegardé localement au fil de la saisie, avec écritures ordonnées et flush avant une navigation contrôlée.
Une fermeture brutale peut perdre la dernière frappe non écrite ; aucun indicateur ne dit « sauvegardé » avant la réussite réelle.
« Reprendre » rouvre le même brouillon et les résultats déjà payés. Après interruption/rechargement ou retour du réseau,
une phase assistant inachevée attend « Réessayer (1 appel) » ; le simple montage d'écran ne dépense rien.

Les anciens imports `couverture` restent lisibles et reprenables. Leurs résultats sont validés avec leur format d'origine puis adaptés,
sans relecture automatique. La fiche et la fermeture de son import sont enregistrées ensemble ; la provenance utile et la photo source
sont copiées sur les objets durables avant l'expiration du journal.

`lancerVol` exige aujourd'hui des images : partager ses gardes, battements et transitions, mais adapter l'orchestration du livre au
chemin ISBN/Web sans image. Ne pas créer de fausse image pour passer cette garde. Le verrou d'appels reste commun à tous les imports.

## 7. Proposer l'image imprimée du plat

### 7.1 Détection et présentation

Dans `#/recipes/<id>/importer`, les pages sont numérotées selon la liste effectivement envoyée après dédoublonnage et vérification
des fichiers. Étendre l'extraction existante à un résultat facultatif d'au plus trois zones : numéro d'image envoyée, rectangle normalisé,
incertitude. La consigne ne retient qu'une photographie du plat de cette recette ; dessins, portraits, logos, texte et images ambiguës
ne sont pas retenus comme certains. Aucune absence d'image n'est un échec d'extraction de la recette.
La validation des zones est indépendante : rectangle mal typé, numéro d'image inconnu ou coordonnées hors limites écartent seulement
la proposition concernée. Une recette dont les autres champs sont valides reste enregistrable, avec le cadrage manuel disponible.

La recette suit son enregistrement actuel. Après réussite, l'écran reste sur un bilan qui propose « Utiliser cette image ? »,
avec l'aperçu de la zone et sa page source, « Ajuster le cadrage », « Utiliser comme photo du livre », « Ignorer » et « Voir la recette ».
Ne pas quitter cet écran automatiquement avant de rendre la proposition accessible. S'il existe plusieurs zones, Neegan en choisit une.
Une photo déjà posée directement reste prioritaire ; la remplacer demande un geste explicite.

Les zones validées et le choix sont conservés dans le résultat de l'import, hors du contenu de `RecipeVersion`.
Tant que ce journal existe, la fiche permet de retrouver une proposition non traitée ; après sa purge, les pages sources restent
accessibles pour un cadrage manuel. Aucun nouvel appel payé pour rouvrir ou ajuster un cadrage.
En l'absence de détection exploitable, proposer « Choisir une zone dans une page » avec les pages de cet import.

### 7.2 Géométrie, écriture et provenance

Rectangle `{ x, y, largeur, hauteur }` en fractions de l'image **orientée telle qu'envoyée**, valeurs finies, positives pour la taille,
à l'intérieur de `[0,1]`. Le numéro est résolu vers l'identifiant et l'empreinte de la page envoyée, jamais vers l'ordre courant de l'écran.
Conserver rotation et dimensions de référence. Une rotation, substitution ou suppression de page pendant le vol invalide cette proposition.
Pas de rectangle hors image silencieusement rabattu ; pas de page étrangère à l'import.

Le recadrage rectangulaire local est ajouté à `src/core/image.js` en conservant le contrat des bandes verticales de I1.
L'aperçu et le JPEG final utilisent la même géométrie. Proposer des poignées tactiles et des réglages utilisables au clavier ;
conserver le ratio libre, ne pas imposer celui des cartes. Pas d'agrandissement artificiel, de remplissage ni de génération.
Une zone vide, minuscule ou indécodable est refusée avec possibilité de la modifier.

Les limites des **pages** s'appliquent avant le décodage de la page source (50 Mio/50 Mpx existants), puis sortie JPEG de 1 200 px
de grand côté au plus. Les limites des photos de plat ordinaires ne doivent pas rejeter une page déjà admise avant son recadrage.
La page entière et ses octets restent intacts.

Sur confirmation seulement : `putFile`, puis fusion transactionnelle de `recipes.photo_sha256`, `photo_origin: 'image'` et provenance
de recadrage (page, empreinte, rotation, rectangle). Cette valeur utilise le vocabulaire existant ; le libellé devient « Image du livre ».
Une photo choisie entre-temps n'est pas écrasée. Annuler ou ignorer ne change aucun pointeur de recette.

## 8. Cuissons, photos personnelles et observations

### 8.1 Un formulaire commun, une recette clairement désignée

« J'ai cuisiné ce plat » ouvre le même formulaire que la fin du mode cuisine : titre de recette et version concernée, date,
« À refaire ? », étoiles, observations, temps réel, portions et « Ajouter une photo de mon plat » (appareil photo ou fichier).
Tous les champs d'évaluation, les observations et les photos sont facultatifs. Les choix peuvent être remis à vide.
Depuis une fiche, la version est celle affichée ; en mode cuisine, celle de la session, même si une nouvelle version a été créée ensuite.

Proposition de validation : date civile réelle, aujourd'hui par défaut, pas dans le futur ; étoiles entières de 1 à 5 ou `null` ;
à refaire booléen ou `null` ; portions positives et finies, au plus 1 000 ; temps réel entier de 0 à 10 080 minutes ou `null`.
Zéro minute explicitement saisi n'est pas un champ vide. Les bornes sont des limites de saisie, pas des durées recommandées.

Une cuisson saisie après coup conserve sa date dans `cooked_at` sous la forme `AAAA-MM-JJ`, sans inventer une heure ;
`created_at` indique quand elle a été enregistrée. Le mode cuisine conserve son instant réel quand la date n'est pas changée.
Les lecteurs de date, tris et affichages distinguent date civile et instant : aucun passage à la veille par conversion UTC.
Les lignes anciennes avec date ISO restent lisibles. Une fonction commune fournit la date de classement et d'affichage.

Le mode cuisine d'un repas doit afficher un groupe de champs **par recette** et enregistrer chaque groupe sur la bonne cuisson.
Aujourd'hui `finish()` copie le même formulaire sur toutes les recettes : ce comportement doit être corrigé avant d'y ajouter les photos.
La clôture de session et ses cuissons sont atomiques, gardées par l'état de session. Une nouvelle tape ou un autre onglet ne les recrée pas.
Hors session, conserver un identifiant de brouillon de cuisson stable pour rendre l'enregistrement idempotent.

Les quantités de la session gardent leur instantané existant. Hors mode cuisine, ne pas présenter les quantités calculées de la recette
comme des quantités réellement utilisées : `quantities_snapshot` reste vide en l'absence de données explicites.
Enregistrer une cuisson ne marque pas automatiquement une création IA « testée » ; le geste existant reste séparé.

### 8.2 Mes photos

La section « Mes photos » regroupe les images par cuisson, avec date et accès à ses observations. On peut ajouter une photo à une cuisson
existante, ou ouvrir « J'ai cuisiné ce plat » pour en créer une. Une image ne crée jamais une cuisson implicite.
Prévisualiser les photos et permettre de les retirer avant l'enregistrement. Six images uniques au plus par cuisson ; même empreinte
ajoutée deux fois à la même cuisson : une seule entrée. La même image peut être référencée ailleurs sans duplication des octets.

`cook_history.photos` devient un tableau ordonné de SHA-256. Aucune URL ou base64 dans ce tableau. Préparation locale existante
(25 Mio, types admis, contrôle des dimensions, JPEG réencodé sans métadonnées) puis `putFile` et écriture de la cuisson.
Un échec de préparation garde les autres saisies et photos ; retirer une image du formulaire ne supprime pas une photo déjà enregistrée.

La photo principale est calculée, jamais recopiée dans `recipes.photo_sha256` : dernière cuisson portant une image admissible,
selon D-I2-7, puis dernière image de sa liste. La bibliothèque et la tête de fiche partagent cette sélection ; les autres cartes de recette
qui affichent une photo l'emploient aussi pour rester cohérentes. Charger les fichiers en lot, sans recherche de toute l'histoire par carte.
La photo du livre reste dans sa section propre, avec sa provenance et ses commandes ; une ancienne photo ne devient pas arbitrairement
« Ma photo » à partir de `photo_origin`, dont les valeurs historiques ne permettent pas de l'affirmer.

Si les octets personnels manquent sur cet appareil, la fiche dit « Ta photo n'est pas sur cet appareil » et offre les gestes de téléchargement
existants. Une carte peut montrer provisoirement la photo du livre si disponible, sans prétendre qu'il s'agit de la photo personnelle.
La sélection logique ne change pas selon la disponibilité locale ; la photo personnelle prend sa place après téléchargement.

Retirer une photo enregistrée retire seulement son lien à la cuisson, sur confirmation ; les autres photos et la photo du livre survivent.
Le retrait de la dernière photo fait revenir la photo personnelle précédente, puis la photo du livre s'il n'en reste aucune.
Pas de suppression physique de `files` : les octets peuvent être partagés et le nettoyage L5 reste hors périmètre.

### 8.3 Corriger une observation

Chaque ligne de « Mémoire culinaire » offre « Modifier mes observations ». Le formulaire reprend le texte et permet de le vider.
« Enregistrer » met à jour cette seule ligne, sans nouvelle cuisson, sans toucher version, quantités, date, étoiles ou photos.
La gestion des photos passe par ses commandes propres. Annuler n'écrit rien.
Si l'observation a changé depuis l'ouverture, montrer les deux textes et demander un choix ; ne pas écraser silencieusement l'autre saisie.

## 9. Mes notes permanentes

`recipes.personal_notes` est une chaîne facultative, vide par défaut, indépendante de `recipe_versions.notes` et de `cook_history.notes`.
La fiche offre « Ajouter une note personnelle », puis « Modifier mes notes » ; texte visible en tête sans masquer l'action de cuisson.
La note est disponible même sur une référence sans version. En mode cuisine, elle reste accessible à côté des étapes de la recette
concernée, identifiée comme personnelle, sans être injectée dans leur texte.

Enregistrer ou vider la note ne crée aucune version ni cuisson, ne change pas disponibilité, statut vérifié, portions, favoris ou image.
Relire la recette en transaction et ne modifier que ce champ. Détecter le changement concurrent du même texte comme pour les observations.
Le champ est du texte brut, avec retours à la ligne ; aucun HTML ou lien cliquable implicite. Aucun appel assistant.

## 10. Données et points d'intégration

Les champs ci-dessous sont proposés ; absence sur une ancienne fiche = fonctionnalité vide, jamais erreur de chargement.

| Objet | Ajouts ou contrat à étendre |
| --- | --- |
| `books` | Sous-titre, description courte, `cuisine_facets` (origines/styles/préparations), provenance par champ. Garder `cuisines` comme projection compatible des facettes et des valeurs anciennes ; `tags` reste distinct. |
| `book_editions` | Provenance des champs d'édition, `source_photo_sha256` distinct de `cover_sha256`, rotation de lecture si nécessaire. |
| Provenance des champs | Origine, date de récupération, source(s) validée(s), incertitude, modification manuelle. Sur les puces : provenance par valeur et retraits conservés dans le brouillon. Pas de réponse distante brute non bornée dans une fiche. |
| `imports` | Sorte `livre`, phases/brouillon/résultats (§ 6) ; sur imports recette, zones proposées et décision photo (§ 7), format versionné et ancien format accepté. |
| `recipes` | `personal_notes`, provenance du recadrage de `photo_sha256`. Aucune copie de la dernière photo personnelle. |
| `cook_history` | `photos: string[]` enfin rempli ; date civile ou instant dans `cooked_at`, contrat de lecture commun ; relations recette/version conservées. |
| `files` | Octets et synchronisation existants ; pas de magasin d'images supplémentaire. |

Les champs bibliographiques partagés se modifient sur le livre ; ISBN, année, langue, éditeur, couverture et leurs sources sur l'édition.
Compléter une édition ne réécrit pas silencieusement les champs partagés avec les autres éditions.

Intégrations indispensables :

- `src/ui/livre-ajout.js`, `src/domain/couverture.js`, `src/domain/llm.js`, nouveau domaine bibliographique : reconnaissance, rapprochement,
  champs sourcés, suggestions et orchestration ; `src/ui/book.js` : compléments et sources.
- `src/model/schema.js`, domaine/journal d'import, `src/ui/add.js`, reprise de route : vocabulaire `livre`, formats et états.
  Garder `livre` hors des sortes exigeant des pages. Anciennes reprises couverture conservées.
- `src/model/repo.js` / `src/core/db.js` : garde d'absence d'ISBN dans l'index au sein de la transaction.
  L'index n'est pas unique aujourd'hui ; un simple `byIndex` avant `saveBatch` ne suffit pas entre deux onglets.
- `src/core/image.js`, extraction et import ciblé : rectangle sans régression des rotations et bandes de I1.
- Formulaire de cuisson partagé et fonctions de validation/sélection de photo : `cook.js`, `recipe.js`, cartes, bibliothèque, accueil,
  recherche et autres consommateurs de photo/date. Monter les notes avant le retour anticipé des références sans version.
  Le contrat des dates concerne aussi `src/core/dom.js`, l'historique assemblé dans le dépôt et la comparaison de plats (`dish.js`/`dishes.js`).
- `src/sync/fichiers.js` : ajouter `cook_history.photos[]`, photos source des éditions et brouillons de livre aux références de fichiers,
  aux instantanés (`MAGASINS_FICHIERS`), aux noms humains, compteurs, envoi et téléchargement. Un pointeur JSON seul ne synchronise pas les octets.
- Archives : round-trip des nouveaux champs, pointeurs souples d'images absentes et restitution fidèle des notes/photos.
  Aucun changement des migrations historiques générées ; le contrôle `--check` doit rester vert.

Les recettes, cuissons et fiches reçues par synchronisation sont revalidées avant affichage, comme les réponses assistant.
Les conflits entre appareils gardent le mécanisme de conflit existant ; aucune fusion de texte automatique.
Toutes les écritures relisent l'objet courant et préservent les champs non concernés, y compris les nouveaux champs lors d'un ancien geste
tel que favori, correction, import ou remplacement de couverture. Les vieux clients peuvent ignorer ces champs : tous les appareils doivent
passer à I2 avant les essais réels, et cette limite doit figurer dans les consignes de livraison.

## 11. États d'échec et accessibilité

| Situation | Comportement exigé |
| --- | --- |
| Hors ligne / session absente | Conserver le brouillon et les photos, permettre la saisie ; expliquer pourquoi l'assistant ne part pas. Reprise payée sur geste. |
| Quota atteint / refus / délai / réponse coupée | Cause distincte, résultats antérieurs conservés, aucun résultat inventé ; « Réessayer (1 appel) » sur la phase manquante. |
| Autre lecture déjà en cours | Le verrou partagé empêche un second appel ; pas de dépense différée cachée quand le verrou se libère. |
| Changement de photo, ISBN, route ou compte | Invalider la génération en cours ; une réponse tardive ne remplit ni ne sauvegarde un autre brouillon. |
| Fichier absent / indécodable / trop lourd | Cause visible, télécharger ou remplacer ; recette et notes conservées. Aucune vignette cassée présentée comme une image. |
| Écriture locale refusée | Aucun message de réussite, formulaire conservé pour réessayer. Des octets préparés peuvent rester orphelins sans fausse fiche. |
| Modification concurrente | Préserver les champs étrangers ; afficher le conflit du champ concerné et garder la saisie locale tant qu'aucun choix n'est fait. |

Textes par `t('…')`, dictionnaire anglais complet et modules neufs affichant du texte ajoutés à `MODULES_NEUFS`.
États de progression annoncés par `role=status`, erreurs associées aux champs, pas de perte de focus à l'arrivée d'une réponse.
Commandes utilisables au clavier et au toucher ; aucun recadrage accessible uniquement par glissement.
Vérifier la fiche, le formulaire et le recadrage à 320, 375, 390, 768 et 1512 px, puis iPhone portrait/paysage.

## 12. Critères de réception et tests à écrire après accord

Les tests observent les comportements avec bases jetables, horloge et `fetch` injectés. Aucun appel réel pendant la suite.
Chaque groupe se construit test rouge d'abord, puis code ; aucun test qui cherche une chaîne dans un fichier source.

| Réf. | Scénario | Résultat observable |
| --- | --- | --- |
| L01 | ISBN déjà présent, ISBN-10 équivalent, double tape et deux onglets | Édition retrouvée ; au plus une création locale ; ouvrir ne déclenche pas le Web. |
| L02 | `9781837836222`, catalogue factice sans résultat | Relais Internet visible et automatique, un seul POST `recherche-web`, ISBN exact dans la demande. |
| L03 | ISBN altéré, code de prix adjacent | Aucun remplacement de chiffre, aucun appel pour la valeur invalide ; ISBN principal distinct du prix. |
| L04 | Notice d'œuvre avec plusieurs éditions / contradictions Web | Pas d'année d'édition inventée ; choix explicite, différences et sources visibles, aucune page rattachée avant décision. |
| L05 | Dos de Trinity, mention de The Repertoire | Livre principal et complément distingués ; seules les données établies préremplissent la fiche. |
| L06 | Photo tournée, rotation manuelle et EXIF | Aperçu et lecture cohérents ; photo source conservée ; zéro relecture payée implicite. |
| L07 | Champs inconnus, classifications et descriptions | Champs vides, provenance par champ, puces retirables sans doublons ; aucune garantie alimentaire héritée. |
| L08 | Modification ou effacement d'un champ pendant le Web, puis reprise | La correction gagne ; brouillon, suppressions de suggestions et sources survivent. |
| L09 | Refus, quota, absence de recherche réelle, JSON coupé, source inventée | Aucun faux « identifié » ; conservation des résultats acquis ; relance d'une seule phase sur geste. |
| L10 | Ancien import couverture / reprise après fermeture / catalogue en panne | Compatibilité, zéro appel au montage, état de panne exact et brouillon récupérable. |
| P01 | Page de recette avec image du plat, sans image, avec plusieurs images | Propositions pertinentes ou cadrage manuel ; jamais de photo posée d'office ; aucun appel supplémentaire. |
| P02 | Rectangle mal typé/hors bornes, mauvaise page, ordre changé, page tournée | Proposition seule refusée ou invalidée, recette valide conservée et cadrage manuel disponible ; même zone dans l'aperçu et le fichier accepté. |
| P03 | Confirmer, ignorer, remplacer une photo choisie entre-temps | Écriture seulement sur geste et garde de concurrence ; page source et versions intactes. |
| P04 | Index I1 en bandes verticales, page de grande résolution | Contrat I1 conservé ; limites de page appliquées au cadrage, pas celles d'une petite photo. |
| C01 | « J'ai cuisiné ce plat », date passée, version différente de la courante | Une seule cuisson liée à la version affichée ; date sans décalage ; aucune quantité réellement utilisée inventée. |
| C02 | Référence sans version | Mes notes disponible, cuisson orientée vers l'import ; aucune fausse version. |
| C03 | Fin d'un repas de plusieurs recettes, double tape / deux onglets | Notes et photos sur leurs recettes respectives ; une clôture, aucune cuisson dupliquée. |
| C04 | Ajouter deux photos, même fichier répété, septième photo, retrait | Ordre déterministe, dédoublonnage local, borne expliquée, aucun blob partagé supprimé. |
| C05 | Cuisson rétroactive, modification d'observation, retrait de dernière image | Photo principale selon date de cuisson, indépendante de la modification ; repli correct, image du livre conservée. |
| C06 | Modifier une observation pendant un ajout de photo | Aucun champ perdu ; conflit du même texte visible ; pas de cuisson nouvelle. |
| N01 | Ajouter/modifier/vider Mes notes, puis ouvrir mode cuisine et une autre version | Même note personnelle, aucune modification de version, quantité, étape, favori ou statut. |
| N02 | HTML, liens, caractères de contrôle et données reçues mal typées | Texte inerte, bornes tenues, aucune exécution ni écran cassé. |
| S01 | Fichiers personnels et photo source sur deux dépôts avec Storage factice | Références repérées, octets envoyés puis téléchargés, noms et compteurs corrects. |
| S02 | Archive puis restauration, images absentes et anciennes fiches | Notes/photos/provenance restituées ; absence d'octets expliquée ; anciens formats acceptés. |
| S03 | Échec `putFile`/transaction, réponse tardive, changement de compte | Aucune réussite fictive ni pointeur cassé créé par l'action ; saisie préservée, compte isolé. |
| U01 | Mobile, clavier, français/anglais | Pas de débordement bloquant, focus conservé, recadrage et formulaires utilisables, textes traduits. |

Validation après construction : suite navigateur de référence, Node en série et `node tools/generer-migrations.mjs --check`.
Départ documentaire : navigateur 6246/6246 (épingle 6245), Node 230/230 ; remesurer avant construction et après, expliquer toute baisse.
Ne déclarer aucun test réussi sans bilan lu. La mention de terminal indisponible dans `AGENTS.md` décrit VibeForge ; si l'environnement
de construction ne permet pas un contrôle, le consigner comme non exécuté et donner à Neegan la commande correspondante.

Preuve réelle, après accord de construction et sur une version accessible à Neegan : ISBN Trinity avec relais Web, dos de Trinity,
choix d'édition ambiguë, import d'une vraie page avec photo, confirmation d'un cadrage, cuisson avec photo personnelle,
correction d'observation et note permanente en mode cuisine. Sur un second appareil, ouvrir effectivement les images téléchargées.
Noter appels réellement partis, latence, qualité d'identification et limites observées ; ne pas déduire la fidélité réelle des seules fixtures.
Le catalogue pouvant évoluer, le test L02 injecté garantit le déclenchement du relais même si Trinity est désormais trouvé directement.

## 13. Découpage prévu après relecture

1. Contrats bibliographiques, validation et provenance, brouillon/journal compatible, garde ISBN transactionnelle.
2. Parcours ISBN et photo, relais Web et compléments, catégories, sources et reprise.
3. Rectangle local et proposition de photo à l'import, préservation des pages et de I1.
4. Formulaire commun de cuisson, observations modifiables et Mes notes ; correction du rattachement par recette dans un repas.
5. Photos personnelles, sélection partagée, fichiers/synchronisation et archives.
6. Régressions, réception visuelle et réelle à distinguer, documentation de clôture et limites restantes.

Chaque étape reste petite et testée ; le plan détaillé sera écrit après l'accord sur cette spec.
À la construction seulement : version proposée `0.19.0` (à ajuster si un lot s'intercale), épingles de version et nombre d'assertions mesuré,
`sw.js` augmenté à chaque commit concerné, modules nouveaux dans `SHELL`. `DB_VERSION` reste 4.
Mise à jour de `STATE.md`, de la section I2 de `CLAUDE.md` et de l'architecture au fil de la livraison effective.
Pas de push, déploiement ni migration appliquée par cette tâche.

## 14. Point d'arrêt pour Neegan

Cette révision est à relire avant tout code. Les choix principaux à confirmer ou corriger sont :

- **D-I2-9 :** importer une recette avant d'y consigner une cuisson, afin de conserver la relation à une version réelle sans migration.
- **D-I2-3/4 :** au plus un appel pour le relais ISBN, deux pour une photo de livre ; repérage de photo du plat inclus dans l'extraction.
- **D-I2-7/11 :** photo principale selon la date de cuisson, six photos par cuisson et notes de 10 000 caractères au plus.
- **D-I2-12 :** couverture distante par le chemin catalogue existant ; sinon photo source conservée, sans récupération d'image Web arbitraire.

Le relais Web automatique et la séparation des photos du livre et des photos personnelles reprennent la demande.
**Relecture autorisant la construction : Neegan a répondu « ok go enchaine ». Le lot I2 passe en construction ; I3 reste séparé.**

## 15. Construction et corrections de relecture — 28 octobre 2026

La construction suit cette révision sur la branche `livre-sans-saisie`, base `baa7822`. Les décisions suivantes précisent les garanties
vérifiées dans le code ; elles ne changent ni les coûts annoncés ni le périmètre approuvé.

- **R-I2-1 — Journal durable.** `kind: livre` utilise les magasins existants. Les résultats de photo et de Web sont gardés par phase ;
  reprendre un résultat payé le revalide avant application et ne fait aucun appel. Les indices d’identification et le choix de candidate
  sont conservés. Les éléments de classement incertains ne contaminent pas une liste contenant aussi des suggestions certaines.
- **R-I2-2 — Concurrence.** La création vérifie l’absence d’ISBN dans l’index existant, dans la transaction. Notes, photos et compléments
  emploient des fusions conditionnelles. L’import et l’ancien éditeur relisent les champs personnels et la provenance au moment de l’écriture.
  Les tests ont reproduit la perte de note/photo avant correction, y compris une valeur vidée ou une clé supprimée.
- **R-I2-3 — Cadrage.** Changer de page invalide immédiatement l’aperçu précédent ; l’écriture fige la sélection confirmée. Les tests différés
  reproduisent la course entre une page en chargement et une confirmation. L’image directe qui remplace un cadrage efface sa provenance devenue fausse.
- **R-I2-4 — Saisies et synchronisation.** Une garde liée au nœud monté protège notes, bilans, choix de photos et cadrage contre le rafraîchissement
  automatique ; une fiche au repos continue de recevoir ses mises à jour. Une vue quittée libère sa garde. L’ajout à une cuisson existante
  partage l’aperçu et le retrait des photos avec une nouvelle cuisson ; annuler ne crée aucun fichier ni pointeur.
- **R-I2-5 — Fichiers et consultation.** La même règle sélectionne les empreintes de cuisson affichées et synchronisées. Les octets sont
  envoyés puis téléchargés dans une seconde base jetable et restaurés depuis une archive. Le consentement `sync_activity` concerne les
  consultations (`library_activity`), comme avant I2 ; les cuissons et leurs photos conservent leur contrat existant. Ce cas est testé explicitement.
- **R-I2-6 — Livraison locale.** `APP_VERSION 0.19.0`, service worker `cuisine-os-v0.19.0-1`, sept modules nouveaux en cache, `DB_VERSION` 4.
  Aucun changement sous `supabase/`, aucune migration à appliquer, aucun appel réel à l’assistant, aucun commit ou push pendant cette construction.

Le bilan final mesuré figure dans `STATE.md` et dans le plan. Les captures locales couvrent 320, 390, 768 et 1280 pixels, sans débordement ;
le parcours réel « Continuer sans compte → Ajouter un livre → saisir → enregistrer → recharger la fiche » est vérifié dans un profil jetable.
Ces contrôles ne valent pas preuve de qualité du modèle sur Trinity, ni preuve Safari/iPhone physique ou de transfert sur deux appareils réels.

**R-I2-7 — Publication autorisée et vérifiée.** Après le bilan local, Neegan a demandé si le lot était déployé puis donné son « go » à la
publication. Le commit de code `455b192` a été intégré en avance rapide à `main`, poussé et construit par GitHub Pages. La suite publique
passe **6503/6503** ; les fichiers servis vérifiés sont identiques, le cache `cuisine-os-v0.19.0-1` est installé, et un livre créé dans un
profil jetable reste accessible après rechargement hors ligne. Aucun appel assistant réel, aucune fonction déployée ni migration appliquée.
