# L6 — Groupes d’ingrédients et lecture complète en français

**29 octobre 2026 — contrat relu techniquement avant construction.** La poursuite du plan est autorisée par Neegan ; ce document ne lui attribue aucune relecture personnelle. Base publiée et vérifiée : L5, 0.27.0, code `66734c5`, reçu `8e6a82f`, DB6 et archive4. Cible L6 : 0.28.0, migration additive0011, DB6 et archive5. Les formes fermées de l’annexe §12 priment sur les propositions préparatoires ci-dessous.

Références : [plan directeur §11.3 et §12](../../lots/2026-10-29-plan-directeur-interface-fonctions.md), [L4](2026-10-29-l4-editeurs-brouillons-design.md), [L5](2026-10-29-l5-sources-index-design.md), [correctifs Thermomix et appels payés](2026-10-29-correctifs-thermomix-fiabilite-design.md). Audit préparatoire lu : `.superpowers/sdd/2026-10-29-l4/audit-l6-groupes-fr.md`.

## 1. Résultat attendu

Une recette distingue les aliments de leurs titres de groupe. Choisir Français rend la traduction compatible comme texte principal, dans la fiche et en cuisine. L’original reste accessible. La voix prononce exactement le segment affiché, dans sa langue réelle. Une traduction partielle indique les manques à leur place ; elle n’est jamais présentée comme complète.

La langue des menus, les repères descriptifs, la traduction fidèle et l’adaptation culinaire restent quatre fonctions distinctes. Traduire ne modifie aucune quantité structurée, identité d’aliment, température, minuterie, durée, portion, accessoire ou consigne de sécurité validée. « Français simple » signifie formulation claire avec toutes les conditions, négations, précisions et étapes conservées ; aucun résumé ni adaptation automatique.

Périmètre : structure des ingrédients, extraction compatible, correction explicite des groupes, traduction manuelle et assistée par version, réponse payée récupérable, lecture fiche/cuisine/voix et export documentaire dans la langue demandée, compatibilité/synchronisation/archive. L7 conserve la disposition générale de cuisine, les minuteurs persistants et Wake Lock ; E1 conserve toute connexion Cookidoo. L6 n’introduit aucune commande d’appareil.

## 2. Direction visuelle et parcours

Maquettes relues : `Mito_MD_et_Maquette_Photo_Pain 2/Mito_Interface_Visuelle.md`, `Mito_Maquette_Fiche_Pain.png`, et `Mitsu_Claude_Code/maquettes/mobile/03_recette_enregistree.png` dans Downloads. Elles fixent palette crème/olive, titre lisible, provenance/original accessible, photographie secondaire et sections Ingrédients/Préparation. Elles ne spécifient pas un moteur de traduction ; leurs exemples de durée/niveau ne sont pas des données à injecter.

Conserver les cinq destinations et les retours L3. Le choix près de la recette porte les mots **Original**, **Français**, et l’autre langue déjà disponible lorsque pertinente ; éviter un sigle FR qui suggère une traduction inexistante. L’anglais manuel actuellement disponible reste accessible. L’assistant de ce lot cible le français ; pas de génération multilingue cachée.

Sans traduction compatible : original affiché, explication courte, actions **Traduire en français** et **Traduire moi-même**. Choisir Français seul ne lance rien. Après demande assistée : coût maximum en nombre d’appels avant départ, progression réelle par portions conservées, puis proposition à relire. **Garder cette traduction** publie explicitement ; **Corriger la traduction** ouvre les segments reçus. **Garder la traduction partielle** est un geste nommé distinctement quand il manque des segments.

Les titres de groupe sont des titres visuels sans case d’aliment, quantité, bouton Substituer ou indicateur d’allergène. L’éditeur permet Ajouter un titre de groupe, Transformer cette ligne en titre, Modifier le titre, Monter/Descendre et Retirer le titre. Retirer un titre garde ses ingrédients et demande confirmation si le geste change leur présentation. Aucun glisser obligatoire. Un titre vide ne peut être publié ; un groupe sans aliment peut rester comme texte documentaire, avec indication explicite.

À320/390 px, garder les onglets existants et la source accessible sans seconde colonne comprimée. À768/900/1280 px, conserver la hiérarchie des maquettes. Cibles44px, focus après déplacement/retrait, textes longs et zoom texte200 %, état de langue annoncé par `aria-pressed`, attribut `lang` par segment réellement affiché. Aucun texte de proposition rendu en HTML.

## 3. Structure persistante des ingrédients

### 3.1 Décision : les titres sont séparés des aliments

`RecipeVersion.ingredients` reste la liste canonique des seuls aliments. Ajouter un champ optionnel fermé :

```js
ingredient_structure: {
  format: 1,
  blocks: [
    {kind:'heading', id:'gh_…', text:'For the starter'},
    {kind:'ingredient', ingredient_id:'ri_…'}
  ]
}
```

Un niveau seulement,100 titres et300 blocs au maximum pour les200 ingrédients déjà admis par la traduction. Titre1..300 points de code, chaîne Unicode valide, aucune donnée de quantité ou identité culinaire dans un heading. Les identifiants sont attribués par l’application, uniques et bornés selon le contrat de version existant. Chaque ingrédient est référencé exactement une fois ; aucune référence étrangère, omission, répétition ou collision entre ID de titre et ID d’aliment. L’ordre des références ingredient est aussi celui de `ingredients` : les consommateurs anciens conservent l’ordre culinaire même sans afficher les titres.

Sans champ : lecture historique, ordre exact de `ingredients`, aucun groupe deviné. Champ présent invalide : consultation documentaire avec avertissement, aucune fabrication silencieuse d’une structure « réparée ». Les fonctions culinaires ne commencent jamais à inclure les headings pour compenser une structure invalide. La publication d’une nouvelle version refuse cette structure ; le brouillon conserve la saisie.

Les versions historiques dépassant ces bornes restent consultables/exportables selon les capacités antérieures. Elles ne sont pas tronquées à l’ouverture. Un refus d’édition structurée ou de traduction assistée doit être annoncé avant toute écriture ou appel ; correction manuelle documentaire/récupération conservée. Ne pas diminuer les bornes déjà admises pour les versions sans structure.

### 3.2 Gestes et provenance

Transformer un ingrédient en titre est explicite et produit une nouvelle version. L’ancienne ligne et son ID restent dans la version source ; la nouvelle version la retire des aliments et réserve un ID heading. Montrer la conséquence : cette ligne ne comptera plus dans les quantités, courses et vérifications alimentaires. Si elle porte une quantité, une unité ou une identité confirmée, demander confirmation après affichage de ces valeurs. « Levain », « Pâte miso » et « Sauce soja » ne sont jamais transformés par heuristique.

L’inverse est explicite : créer un nouvel aliment depuis le titre et ouvrir ses champs, état à vérifier, sans quantité inventée. Déplacer un bloc ne recrée pas ses ID. Déplacer un groupe complet est une action distincte nommée, qui déplace le titre et les aliments jusqu’au titre suivant. Supprimer un aliment retire également sa référence de structure, jamais le groupe entier. Les lignes/étapes inchangées conservent les garanties L4 et les substitutions déjà présentes.

La structure appartient au contenu culinaire pour les empreintes L4, les exports et les traductions. Sa modification crée une version ; elle ne modifie pas le titre original de la recette. Métadonnées seules : toujours aucune version nouvelle. Les anciennes traductions ne sont pas transférées automatiquement, même si certains ID survivent. Les repères restent liés à leur version/signature, sans passage global à « Corrigé par toi ».

Après retrait explicite de tous les titres, conserver une structure valide composée uniquement des blocs ingredient. Une version dérivée d’un parent structuré ne revient jamais au champ absent ; aucune dérogation ni nouveau protocole de version n’est nécessaire pour ce retrait.

### 3.3 Extraction et autres producteurs

Conserver le résultat `ingredients` historique comme aliments seulement. Extension de réponse facultative `ingredient_blocks` fermée : `{kind:'heading',text}` ou `{kind:'ingredient',index}`, index entier vers le tableau d’ingrédients reçu. Couverture exacte et ordre cohérent ; aucun ID du modèle admis. La fabrication attribue les ID et produit `ingredient_structure`.

Une absence de blocs est une extraction legacy valide. Des blocs invalides n’effacent pas une extraction correcte : conserver le résultat culinaire valide et l’anomalie de structure séparément, montrer les titres candidats en texte à relire, ne retirer aucun aliment sur la foi d’une structure rejetée. Ce résultat partiel ne prétend pas avoir préservé les groupes. La validation et la conservation de la réponse précèdent sa publication ; ne pas ajouter une seconde lecture payante automatique pour réparer les groupes.

Tous les producteurs sont audités : photo, texte, web assisté, création, correction assistée L4, fabrication depuis journal, substitution et adaptation Thermomix. Le chemin web JSON-LD sans modèle reste sans appel au modèle. Une source sans groupes reste admise. Un producteur qui dérive une version structurée doit conserver/remapper les références exactes ou ouvrir une correction ; il ne peut abandonner le champ silencieusement.

## 4. Traduction par identité

### 4.1 Format proposé, fermé et indépendant des positions

Conserver `recipe_translations`, sans nouveau magasin. Nouvelle ligne :

```js
{
  id, recipe_version_id, locale:'fr', alignment_format:2,
  source_signature, source_locale,
  revision, // jeton opaque réservé pour cette publication
  translated_content:{format:2, segments:[
    {kind, source_id, field, source_sha256, text, origin, journal_id}
  ]},
  verification_state:'unverified', created_at, updated_at
}
```

`kind` = title/ingredient/heading/step/notes/yield ; `field` = text/name/preparation/source, combinaisons fermées. Title, notes et yield ont `source_id` égal à l’ID de version ; ingredient, heading et step citent leurs ID exacts. `origin` = manual/ai ; `journal_id` nul pour une correction manuelle, ID de la réponse exacte pour une valeur conservée de l’assistant. Aucune réponse du modèle ne décide ces champs. Un texte manquant est `null`, jamais supprimé ni déplacé. La présence de chaque segment attendu est vérifiée ; ID étranger ou doublon refuse le bloc.

`source_signature` est le SHA-256 d’une projection canonique discriminée `translation-source-v2` : version/recette exactes, langue d’origine connue ou inconnue, structure ordonnée, textes et champs culinaires nécessaires à leur lecture, notes et rendement. **`display_title` et `original_title` en sont tous deux exclus**, ainsi que `updated_at`, favorite, photo et repères. Le titre réellement affiché (`display_title || original_title`) possède son propre hash de segment ; un changement de titre invalide ce segment sans déplacer les autres.

La publication utilise un CAS de titre séparé, discriminé `translation-title-v1`, avec ID recette/version et présence+valeur de chacun des deux champs de titre. Elle ne peut adopter un ancien segment de titre sur une capture différente. Les autres segments compatibles restent consultables et adoptables par un plan qui exclut explicitement ce titre ; aucune recapture implicite de sa proposition. Une modification historique du titre original est donc détectée par le CAS de titre sans rendre toute la traduction culinaire périmée. Le titre original n’est jamais réécrit.

`lireTraduction` annonce absente/ancienne/courante/partielle/périmée/invalide et fournit la couverture réelle. Une correspondance n’est courante que pour cette version et ce hash de segment. Même ID avec texte modifié : segment périmé. Autre version : aucune adoption automatique, même si tous les textes paraissent identiques. Le compteur de couverture se calcule ; il ne dépend pas d’un booléen `complete` renvoyé par l’assistant.

### 4.2 Quantités et texte d’ingrédient

Pour une ligne structurée, traduire `name_text` et `preparation` séparément. Le rendu de quantité/unité utilise exclusivement les données et formateurs existants, après `scaleVersion` et ses gardes. Facultatif et états de vérification sont des libellés déterministes. La traduction n’attribue ni identité du lexique ni statut verified.

Le texte source documentaire doit aussi rester compréhensible : segment `ingredient/source` quand il apporte du texte non représenté dans les champs principaux. Ce texte est consultable comme citation de la source avec ses quantités d’origine ; il ne remplace jamais la ligne recalculée. Une ligne sans nom/structure exploitable utilise le segment source entier, reste non recalculable et le dit. Ne pas fabriquer un découpage ou une quantité pour obtenir un rendu français.

Une traduction L0 de ligne entière n’est pas réutilisée comme ligne recalculée après changement de portions. À portions/unités d’origine, elle peut être le texte principal, avec son état réel. Pour un autre réglage, afficher la ligne culinaire exacte, garder la traduction documentaire explicitement étiquetée et proposer de compléter les segments structurés. Ne pas montrer « 500g » traduits comme quantité principale lorsque la quantité calculée vaut600g.

### 4.3 Étapes, notes, rendement et sécurité

Étape = même ID, même unité de progression, paragraphes conservés. Les temporisations viennent des étapes structurées originales ; aucun `detectTimers` sur la traduction pour créer/modifier une minuterie. Durées/plages, températures, négations et conditions ne sont pas retirées pour simplifier le style. Notes et avertissements dans le texte source sont couverts ; `yield_text` se traduit comme texte, jamais comme portions.

Pour Thermomix, les réglages/montages/avertissements générés par `formaterActionThermomix`, `formaterBlocThermomix` et leurs validateurs sont rendus de façon déterministe dans la locale choisie. Une traduction libre ne remplace pas ces instructions opérationnelles. Les étapes documentaires non adaptées suivent le contrat normal. Une version TM invalidée reste invalidée ; changer FR/Original ne réactive ni Cuisiner ni Cookidoo. Le contrôle du bol, de la chaleur, des vitesses, de l’huile, de la vapeur et du couvercle continue d’atteindre les mêmes motifs.

### 4.4 Compatibilité L0

Sans `alignment_format` : ancienne traduction consultable, jamais réappliquée par position. Format1 : conserver tableaux/trous et gardes L0 sur la version exacte. Conversion au format2 seulement par ouverture explicite, correspondance démontrable et confirmation ; ne jamais aligner par similarité. Conserver les champs non convertibles en consultation. Un texte entier d’ingrédient ne devient pas son nom par simple renommage de clé.

Les traductions manuelles fr/en existantes restent éditables. Aucune migration de masse, aucun appel pour normaliser une ancienne bibliothèque. Si plusieurs traductions concurrentes existent pour la même version/locale, montrer le conflit et demander laquelle comparer ; `find()` sur l’ordre IndexedDB n’est pas un arbitrage.

## 5. Appel assisté, bornes et conservation

### 5.1 Préparer avant de payer

Réutiliser `PasserelleProvider` et l’outil existant `creation`, qui accepte un prompt système fourni par l’application. Le serveur actuel accepte au plus16000 max_tokens,20 messages,512Kio pour cet outil et une réponse HTTP2Mio. Un nouvel outil serveur n’est pas nécessaire pour cette traduction textuelle ; l’étiquette « création » du journal technique de passerelle ne devient pas une provenance culinaire de création.

Le plan est déterministe, lié aux sources affichées. Maximum24 segments et6000 points de code sources par portion,32 portions par geste au maximum ; segment indivisible. Un segment de plus6000 points n’est pas envoyé automatiquement : il reste à traduire manuellement, sans effacer sa source ni diminuer la limite historique d’édition. Au-delà du budget, demander un sous-ensemble explicite avant départ. Le coût affiché est celui de cette sélection ; aucune assurance de réussite sémantique ni promesse de gain monétaire.

Une portion demande au plus8000 tokens, dans le plafond serveur existant. Ce nombre est une limite d’arrêt, pas une preuve de taille linguistique. Réponse coupée : garder ce qui est reçu, ne pas prétendre la portion complète, aucune relance automatique. Pour la reprise, sélectionner uniquement les portions manquantes ou explicitement refusées ; une portion déjà conservée ne repart jamais lors d’un retour/rechargement.

Le validateur borne chaque texte selon son rôle (titre1000, nom/source ingrédient2000, préparation2000, heading300, étape10000, rendement200, notes10000 points), chaque portion à24000 points et128Kio UTF-8 de textes, l’ensemble publié à200000 points et une ligne JSONB complète à512Kio. La taille inclut IDs, hashes, provenance et horodatages ; la mesurer avant appel avec l’enveloppe et les plafonds effectivement accordés aux segments. Les plafonds de rôle ne garantissent pas ensemble la borne de la ligne : allouer un budget de sortie explicite aux segments sélectionnés, avec le squelette complet et les textes déjà conservés. Une sélection impossible à conserver est réduite explicitement avant paiement, jamais tronquée après réponse. Une réponse hors budget reste récupérable selon §5.3, même si elle ne peut être publiée telle quelle. La traduction manuelle ne perd aucune ancienne valeur au dépassement.

### 5.2 Fidélité et données hostiles

Payload assistant fermé : `{format:1,segments:[{ref,text}]}` ; ref opaque attribuée par l’app à chaque segment attendu. Aucun ordre de réponse imposé, correspondance par ref exacte ; aucune ref inconnue/double. Toutes les refs sont présentes, text null représente un manque. L’app recalcule identités/hashes/couverture et pose la provenance.

Protéger par jetons opaques les valeurs numériques/unités opérationnelles qui doivent rester identiques. Vérifier l’ensemble des jetons par segment, pas seulement leur compte global ; restaurer leurs textes exacts après validation. Les quantités principales restent hors du texte généré. Une différence de nombre, de plage ou de jeton rend ce segment à corriger, pas les autres segments d’une portion. Contrôler les adresses, Unicode, types et bornes avec les utilitaires partagés ; les mots ordinaires « végétarien », « huile végétale » et « garantir » ne sont pas des refus lexicaux globaux.

Accepter une réponse JSON habillée par une phrase ou une clôture Markdown via le parseur robuste partagé. Aucun `eval`, extraction par regex non bornée ou HTML. Les textes source et consignes imprimées restent des données. Les contrôles numériques ne prouvent ni sens, ni négation, ni innocuité : l’interface dit proposition à relire, sans badge de fidélité inventé.

### 5.3 Journal exact et durabilité

Ajouter la sorte fermée `traduction` à `imports`, avec le protocole commun de vol/réseau, mais des cibles propres : `recipe_id`, `source_version_id`, `target_locale`, `translation_source_signature`, `translation_call:{format:1,series_id,ordinal,segment_refs}` et captures propriétaire/cycles. Un journal par portion ; pas de résultat dupliqué dans un manifeste global. IDs de série/journaux/opérations réservés avant l’appel. La ligne `a_lancer` capture déjà la cible ; `en_cours` est la preuve de départ, `a_verifier` celle d’une réponse durable dont il reste des segments à décider. `enregistre` exige que toutes ses refs soient résolues et qu’au moins une soit adoptée ; `ignore` exige que toutes soient explicitement écartées. Aucun terminal sur simple clic de publication partielle, ni réouverture d’un terminal.

Les journaux de traduction ne bloquent ni cuisson, exports, descriptions, adaptation TM ou import de la recette. Empêcher seulement deux départs simultanés pour la même série/version/locale et conserver le verrou global de vol du document. Les consommateurs d’`importOuvert` doivent être audités explicitement ; ne pas ajouter une nouvelle sorte à un filtre global qui recrée le blocage urgent.

Conservation confirmée de chaque réponse avant appel suivant, **indépendamment de toute publication**. Le refus de certains segments garde les autres et leur texte exact. La réception et l’adoption sont séparées : un changement de titre/version/cycle/source pendant le vol garde la réponse attachée à sa capture, interdit sa publication automatique et ouvre une comparaison. Une réponse différente sous même ID/date invalide le plan. Le résultat reçu est immuable ; ses résolutions ne le remplacent pas.

Réponse HTTP hors enveloppe publiable : conserver ses octets complets, jusqu’à la borne de transport2Mio, dans un espace interne local fermé (`translation_response:v1:<journal_id>`, propriétaire/DB/époque/révision/hash). Le corps est `{encoding:'base64',byte_length,sha256,data}` : les octets sont restituables sans normalisation Unicode ni amplification imprévisible des échappements JSON. Réserve limitée simultanément à8 entrées et8Mio **d’enveloppes complètes**, pas8Mio de corps bruts. Deux réponses maximales tiennent ; une troisième peut dépasser la réserve. Avant chaque départ, réserver l’espace logique maximum restant et refuser un nouveau coût si cette réserve est saturée. Cette réservation ne garantit pas que le navigateur ne refusera jamais son quota physique.

Conserver ensemble par le dépôt le brut récupérable, le diagnostic du journal et les segments admis, même si aucun segment n’est publiable ou adopté. Les segments admis restent visibles/corrigeables et les segments refusés copiables depuis le brut ; aucune publication n’est nécessaire pour les retrouver après recharge. La récupération interne garde aussi la projection admise si la ligne métier ne peut la porter intégralement. Sa borne complète doit donc inclure ces champs. Sous changement de propriétaire/DB/époque ou quota réel, aucune écriture de repli dans une autre portée : arrêter la série, conserver en mémoire tant que la vue reste ouverte, annoncer l’absence de durabilité et proposer réessayer l’écriture/copie. Aucun succès après seule réception réseau.

Ne pas synchroniser ni archiver le brut local comme une traduction ; annoncer cette limite. Le journal garde un diagnostic borné et l’existence de la récupération locale. Copier/télécharger est offert ; aucune chaîne tronquée n’est annoncée complète. Une publication partielle ne purge ni le résultat ni son brut de récupération. La purge de cette réserve est explicite, distingue les textes qui resteraient récupérables ailleurs et ne sert jamais à libérer silencieusement une place pour un nouvel appel.

## 6. Brouillon de traduction et publication

Le formulaire garde les contrôleurs L4 : conservation différée sérialisée, statut confirmé, flush avant publication/navigation, sortie protégée, URL avec draft après première conservation. Ajouter un kind spécialisé `recipe_translation` au service de brouillons, sans toucher les brouillons culinaires ni leurs bases. Payload = locale, segments saisis et journal(s) adoptés exactement ; IDs/hash/bases détenus par le service. La signature de base inclut la version et les lignes de traduction affichées. Les espaces internes restent hors archive/synchronisation.

La réponse assistée ne remplace pas une saisie manuelle par simple arrivée réseau. Adoption explicite dans une nouvelle session de brouillon, affichant quels segments seront remplacés ; segments manuels non sélectionnés préservés. Écrire une correction d’un seul segment garde tous les autres segments de la proposition. Provenance par segment, jamais toute la traduction déclarée manuelle après une seule correction.

Publication locale atomique : version source exacte, CAS de titre distinct lorsqu’il est adopté, recette/édition et exceptions L2, propriétaire durable, DB/génération/époque, ensemble de traductions attendues sur version/locale, révision du brouillon et tous les journaux adoptés. Capturer toutes les candidates en ordre canonique `{id,revision,row_sha256}` ; tableau vide signifie absence effectivement démontrée. L’arrivée d’une seconde identité ou une modification sous même ID/révision refuse ce CAS, même si la ligne sélectionnée paraît inchangée. Relire cet ensemble sous transaction ; aucun index IndexedDB nouveau nécessaire. Écrire la traduction proposée, les résolutions de segments, les états dérivés des journaux, le reçu du brouillon et la commande de synchronisation ensemble. Aucun pointeur de version culinaire ni RecipeVersion nouvelle pour une traduction seule.

Chaque journal porte une révision de résolution et au plus une décision par ref attendue : `{ref,decision:'adopte'|'ecarte',text_sha256}`. Une adoption cite l’empreinte exacte du texte effectivement publié, y compris après correction manuelle ; un écart explicite porte `text_sha256:null`. Pas de ref étrangère, doublon ou remplacement d’une résolution confirmée. Le nombre de résolutions et de reçus utiles est borné par les refs du journal, au plus24. Une publication partielle laisse les autres refs non résolues et le journal `a_verifier`. Elles restent consultables, corrigeables et adoptables sans nouvel appel ; une absence, un refus du validateur ou un texte null n’équivaut jamais à « écarté ». Fermer seulement lorsque chaque ref est adoptée ou explicitement écartée, selon les états de §5.3. Le serveur dérive cette clôture de la couverture exacte, jamais d’un drapeau terminal fourni par l’interface.

Reçu idempotent : même operation_id et même empreinte renvoient le résultat déjà confirmé sans réappliquer. Même ID avec contenu différent refuse. Deux onglets ne remplacent pas la saisie de l’autre ; comparaison ou copie séparée du brouillon, pas rebase silencieux. Deux traductions concurrentes reçues d’appareils différents restent comparables ; une stratégie de dernier horodatage ne prouve pas leur équivalence.

## 7. Lecture commune, cuisine et exports

Un projecteur pur partagé produit titre, blocs d’ingrédients, étapes, notes, rendement et couverture. Chaque segment porte `text`, `sourceText`, `langReelle`, `etat`, `source_id`. Les vues ne recomposent pas séparément leurs correspondances. La langue d’un segment manquant est celle de l’original connu ; si elle est inconnue, ne pas inventer fr/en pour la voix.

La fiche rend la traduction compatible au premier plan ; original disponible par segment ou bascule globale. Les alertes concernent les manques concrets, pas un avertissement permanent sur chaque ligne déjà traduite. Quantités recalculées et unités sont communes aux deux langues et gardent les incertitudes.

La session cuisine reprend `cook_sessions.lang`. Changer la langue est une écriture ciblée gardée, préserve version active/progression et refuse un compte/cycle périmé. Chaque recette d’un repas utilise sa traduction propre pour sa version ; un manque dans l’une ne remplace pas le texte d’une autre. La voix utilise exactement le texte et `langReelle` affichés ; arrêter la parole au changement d’étape, recette, langue et à la sortie. Un repli original est annoncé avant lecture ; absence de voix disponible ou langue inconnue ne produit aucun faux état parlé.

Exports : HTML/texte/Markdown demandés en français utilisent le même projecteur et annoncent les segments restés originaux. JSON-LD conserve les seules lignes alimentaires dans `recipeIngredient` ; ne pas ajouter un heading comme aliment. Pour préserver les groupes, HTML/texte ont des titres explicites et l’archive garde la structure complète. Un export machine ne prétend pas tout conserver si son format ne porte pas les groupes. Les exports documentaires existants restent disponibles pour données anciennes/partielles. Cookidoo garde son contrat de sécurité actuel et ses réglages canoniques ; aucune traduction libre n’écrit ses paramètres.

Audit obligatoire des consommateurs : scaling, grocery, diet, matching/substitution, recherche/appairage, repères, Thermomix, exports, copie de brouillon. Aucun heading dans `ingredient_ids`, sommes/volume du bol, courses ou allergènes. Une structure seule ne valide aucun aliment. Traduire ne modifie pas les durées/repères ni leur provenance.

## 8. Compatibilité, synchronisation et archive

DB6 peut rester inchangée : magasins/index existants suffisants. L’absence de colonne nouvelle ne suffit pas à garantir la compatibilité JSON. Prévoir une migration additive après L5 et une capacité serveur **recipe_language:1** ; numéro fixé après gel0010. Aucun changement serveur assistant requis par le choix d’outil existant, sauf défaut démontré des bornes/contrats.

Décision proposée : commande d’outbox fermée `translation_apply`, dispatchée par le transport transactionnel existant, et garde des structures de version. Forme minimale : protocol1, operation_id, payload_sha256, recipe_id/version_id/locale, cycles capturés, source_signature et CAS de titre séparé, expected_translations (ensemble canonique de toutes les candidates défini au §6), journal_read_set trié (ID/hash de réponse exact, révision de résolution attendue et décisions de refs), traduction finale, révision réservée. Au plus500 lignes métier modifiées et borne de commande compatible avec le transport actuel ; une traduction seule reste≤512Kio, donc le read_set, les résolutions et reçus doivent être mesurés avant publication. Portionner l’adoption explicitement si nécessaire, sans clôturer des journaux dont des refs restent à décider. La forme SQL exacte et ses empreintes restent à fermer par A après gel L5.

Serveur : verrouiller propriétaire/recette/version/locale, relire les bases/cycles et les journaux, valider les identités/structure/segments, écrire traduction+clôtures+reçu dans la même transaction. Aucun texte utilisateur ni jeton dans les refus. Les puts/REST anciens ne peuvent supprimer ou modifier les champs protégés d’une traduction format2 ni la structure d’une version existante. Une dérivation dont le parent est structuré doit toujours fournir une structure valide, y compris seulement des blocs ingredient après retrait explicite de tous les titres ; un ancien client ne peut la perdre silencieusement. Cette garde réutilise le chemin de publication des versions, sans protocole de version supplémentaire. Les anciennes versions sans structure et traductions format1 gardent leurs opérations admises.

Les résultats tardifs restent conservables historiquement sans être publiables sur une cible modifiée. Déconnexion/changement de compte : aucun dépôt dans la bibliothèque du nouveau propriétaire. Appareil hors ligne après construction du plan : conserver localement la commande et son état non envoyé ; capacité manquante serveur = blocage expliqué, aucune conversion en ancien put pour contourner la garde.

Archive proposée **format5** : nécessaire pour que les lecteurs anciens refusent un format qu’ils ne peuvent interpréter/éditer sûrement. Lecture des formats1–4 maintenue, sans migration de masse. Structure, segments, signatures, provenance et réponses payées incluses selon les magasins métier ; brouillons et récupération brute interne exclus et clairement annoncés. Inspecter avant écrire ; refuser groupes orphelins, ID étrangers/dupliqués, signature incohérente et conversion de langue illégitime. Restauration/merge n’écrase pas une identité de version structurée différente et ne ressuscite aucun cycle. Réutiliser la fermeture des sources et les transferts L5 ; aucune traduction ne remappe ses sources vers la page active actuelle.

## 9. API et répartition proposées pour revue

Module feuille pur `structure-ingredients.js` :

```js
lireStructureIngredients(version) // {etat:'legacy'|'courante'|'invalide', blocks, raison}
validerStructureIngredients(structure, ingredients) // résultat fermé ; aucune réparation
deplacerBlocIngredients(modele, id, sens, {groupe:false})
transformerIngredientEnTitre(modele, ingredientId, {headingId, texte})
transformerTitreEnIngredient(modele, headingId, {ingredientId})
```

`traductions.js` conserve les exports L0 ; ajouter une façade format2 sans changer silencieusement leur retour :

```js
capturerSourceTraduction({recipe,version}) // projection canonique, hashes, segments attendus
validerTraductionV2(row, source) // structure, alignement par ID, couverture, bornes
planifierTraduction({source, selection, limiteAppels}) // refus avant coût ou portions réservables
validerPortionTraduction(reponse, portion) // segments admis/manquants/refusés séparés
projeterLectureRecette({recipe,version,traduction,lang,portions,unites,convention})
```

Service dédié, réutilisant dépôt et vol : `ouvrirTraduction`, `lirePortionTraduction`, `reprendreTraduction`, `preparerPublicationTraduction`, `publierTraduction`, `abandonnerTraduction`. Prendre une capture opaque de portée et des copies affichées ; ne jamais recapturer silencieusement dans publier. Reprise lecture historique ne lance rien ; reprise des manquants est un geste distinct. Les réponses structurées utilisent issue/raison et distinguent quota/réseau/refus de contexte.

Trois volets après revue, interfaces figées avant consommation :

| Volet | Propriété | Livraison indépendante |
|---|---|---|
| A | Feuilles structure/traduction, captures/validations, publication, dépôt/outbox/SQL/archive | Vecteurs purs, CAS/idempotence et compatibilité ; API figées |
| B | Éditeur groupes et traduction, brouillon spécialisé, extraction/validation de blocs et adoption de résultats | Gestes explicites, saisie conservée, original intact, faux réseau injecté |
| C | Projecteur de lecture avec A, fiche/cuisine/voix/exports, audit consommateurs | Français réellement principal, mêmes quantités/texte/voix, aucune consommation des titres |
| Intégration | CSS/i18n, version/cache/runner, navigation commune, réception locale/publique | Maquettes, largeurs, suite entière, archives et preuves de publication |

Attribuer les portions de `llm.js`, `brouillons-editeur.js`, `recipe-edit.js`, `components.js` et les fichiers de tests anciens avant écriture. Un propriétaire par fichier partagé ; pas deux formats concurrents de traduction ou d’ingrédient.

## 10. Points à fermer avant construction

1. Valider structure séparée,100 headings/300 blocs, et règle de dérivation avec anciens clients. Aucun `is_heading` ajouté seulement au prompt.
2. Valider les segments nom/préparation et la citation source pour les lignes non structurables ; cas portions/unités et traductions L0 de ligne entière à montrer dans une preuve de rendu.
3. Valider journal traduction indépendant des blocages recette, brouillon spécialisé et récupération brute locale bornée. Tester la borne réelle requête/réponse/enveloppe avant fixer les constantes finales.
4. Fermé en revue4 : commande/capacité/idempotence/protection des dérivations et formes exactes dans l’annexe normative. Construction seulement après commit de ce contrat et signal GO root.
5. Confirmer archive5 et maintien des lecteurs1–4. L5 n’est pas déclaré publié par anticipation.
6. Maintenir génération déterministe des consignes TM et voix alignée ; aucune traduction libre ne contourne les protections urgentes.

Revue technique root : décisions1/2/3/5/6 acceptées, avec CAS de titre séparé, résolutions par ref et récupération sans publication précisés ci-dessus. Le point4 reste à fermer par A après gel L5. Cette revue technique ne vaut ni construction autorisée avant le signal d’intégration, ni publication L5 reçue par anticipation.

## 11. Vecteurs et mesures préparatoires

Outil local hors production : `.superpowers/sdd/2026-10-29-l6/contrats-et-bornes.mjs`, résultats `vecteurs-l6.json`, `mesures-l6.json` et `contrats-et-bornes.log`. Il utilise les fonctions pures actuelles de canonicalisation/mesure JSONB et d’admission de requête de la passerelle. Aucun réseau, aucune base métier, aucun appel payé. Les vérifications portent sur un prototype de contrat ; elles ne prouvent ni transaction IndexedDB/SQL, ni qualité linguistique, ni coût effectif fournisseur.

| Cas mesuré | Résultat utile |
|---|---|
|200 ingrédients,200 étapes,100 titres,903 segments | Source104269 octets JSONB ; traduction234340 ;38 portions à24 segments. Le sous-ensemble explicite est nécessaire au-delà de32 appels. |
|Même structure, IDs ASCII200 caractères | Squelette367621 octets ; traduction408040. L’enveloppe ne peut pas être ignorée dans le budget de texte. |
|Source Unicode admise,903 segments | Source460269 octets ; traduction590340. Une source admise et moins de200000 points ne garantissent pas une traduction≤512Kio. |
|Requête24 segments/6000 points Unicode |25138 octets UTF-8, admise par le validateur local réel avec8000 max_tokens. Aucun modèle appelé. |
|Journal24 segments/24000 points Unicode,24 résolutions et reçus |122863 octets JSONB dans la forme proposée ; réserve d’enveloppe réelle à conserver après fermeture A. |
|Corps HTTP2Mio avec octets nuls | Base64+enveloppe2796704 octets ; avec24 segments admis2893479, donc2 réponses maximales dans8Mio, pas3. Texte JSON échappé12583285. La borne HTTP est un plafond de transport, pas une sortie fournisseur démontrée à8000 tokens. |
|Traduction203 segments proche de la borne |518202 octets ; commande avec9 journaux/203 résolutions547601. Budget synthétique de transport32×24 résolutions625261, non preuve de validité de cette combinaison. |

Les vecteurs couvrent titres exclus du hash culinaire, titre sous CAS distinct, modification de quantité/version, adoption partielle, reprise des refs restantes, refus de ref étrangère/révision périmée, clôture complète, replay ancien et conflit d’opération. Le modèle de réception couvre conservation brut+segments sans publication, quota sans demi-écriture et changement de portée. A doit remplacer les formes proposées par ses formes fermées puis remesurer, notamment les captures/reçus définitifs et les plafonds de sortie alloués avant appel.

Le [plan de construction et réception](../plans/2026-10-29-l6-ingredients-groupes-traductions.md) donne les preuves à obtenir. Les tests de production, essais physiques et appels modèle de L6 ne sont pas encore exécutés.

## 12. Fermeture technique — revue4

L’[annexe normative du protocole traduction](2026-10-29-l6-protocole-traductions.md) ferme les formes, projections, API, budgets et modes publish/resolve/restore. Elle prévaut sur les noms/formes indiqués comme proposés dans les sections précédentes. Revue favorable root/B/C ; cela ne remplace pas le signal GO de construction ni les preuves réelles exigées au plan. Base publiée L5:0.27.0 (66734c5), cible L6:0.28.0/migration0011/archive5/DB6.
