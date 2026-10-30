# L6 — Protocole des traductions, contrat de construction

29 octobre 2026 (30 octobre UTC). Base : L5 publié et vérifié, reçu `8e6a82f`. Contrat de revue4 accepté techniquement par root, B et C avant construction ; aucune mise en œuvre n’est affirmée. Base publiée L5:0.27.0/66734c5. Cible L6:0.28.0, migration0011, archive5, DB6. Root a accepté le principe de l’union publish/resolve/restore, C les frontières resolve/restore. Aucune migration distante.

## 1. Feuilles, identités et projections

Réutiliser strictement canoniqueSources/empreinteSources/comparerUtf8/octetsJsonbSources : tri UTF8, présence distincte de null, aucun NFC, NUL/surrogate isolé interdits. IDs existants : règle identifiantSource (1..200 points, aucun contrôle). IDs nouveaux d’opération : `tr_op_` suivi du SHA256 de `{projection:'translation-intent-v1',command}` où command exclut operation_id/payload_sha256 et, pour publish seulement, translation.revision (champ dérivé). Nonce aléatoire réservé une fois. Ensuite injecter operation_id et translation.revision, puis calculer payload_sha256 sur l’enveloppe complète sans ce dernier champ. Le target historique de restore garde son ancienne revision dans l’intention : la revision de sortie est dérivée par le serveur. Aucune boucle de hash. revision = operation_id. Toute modification du contenu ou de la base change l’ID dérivé ; aucun client ne choisit une ancienne revision.

Ref de segment : `ts_` + SHA256 canonique de `['translation-ref-v1',recipe_version_id,kind,source_id,field]`. Cette identité fixe de67 caractères est calculée par l’application, jamais par le modèle. Tri de refs UTF8 pour les masques ; le tableau de segments suit l’ordre de la projection source.

Combinaisons fermées : title/text, ingredient/name, ingredient/preparation, ingredient/source, heading/text, step/text, notes/text, yield/text. Les trois champs ingredient existent dans le squelette seulement si le champ source correspondant est une chaîne non vide. Title/text est toujours présent (source vide autorisée) ; heading/text et step/text suivent leurs lignes ; notes/yield seulement pour une chaîne non vide. La projection doit fournir une seule liste ordonnée partagée JS/SQL, pas plusieurs heuristiques UI. Le segment source documentaire peut être conservé même s’il répète le nom : l’omettre arbitrairement modifierait les refs attendues.

Champ texte traduit : string dans les bornes du rôle, ou null. Si null : origin:null et journal_id:null. Si string : origin manual avec journal_id:null, ou origin ai avec journal_id exact. Une correction d’un texte proposé devient manual sur ce segment seulement ; le journal d’origine reste relié par sa résolution, sans fausse provenance ai. Les espaces ou retours à la ligne ne sont jamais réécrits par la canonicalisation.

`translation-source-v2` : projection présence/valeur de recipe_version_id, recipe_id, source_locale capturée, et des champs de version `servings,yield_text,ingredients,ingredient_structure,steps,notes,constraints,convention_snapshot`, plus `provenance.thermomix`, `provenance.thermomix_invalide`, `provenance.convention_snapshot` et `plan_invalide`. Les objets ingredients/steps restent exacts, sans filtrage caché de champs culinaires ou de substitution. Exclure statut de test, dates techniques, pointeur courant, titres de recette, photos/favori et autres champs de provenance. Version sans champ respecte absence, pas une valeur null fabriquée. source_locale vient uniquement de recipe.original_language : string conforme à `^([A-Za-z]{2,3})(?:-([A-Za-z]{2}))?$`, langue ASCII en minuscules et région éventuelle en majuscules. Pas de trim, de renommage de langue ou de détection. Exemples EN-ca→en-CA,it→it ; français,espaces,zh-Hant,champ absent/nonstring→null. Cette règle syntaxique partagée JS/SQL représente un code déclaré, pas une preuve linguistique ; le lecteur/voix annonce indéterminé et ne choisit pas arbitrairement le français pour une source inconnue.

`translation-title-v1` : recipe_id,recipe_version_id et présence/valeur de display_title/original_title. Hash de segment `translation-segment-v1` : version,kind,source_id,field, texte source exact, source_locale ; title utilise le texte réellement affiché et sa capture de titre distincte. Les deux titres sont exclus du hash culinaire.

Legacy sans IDs uniques d’ingrédients/étapes : consultation et édition L0 conservées. Format2 n’invente pas des IDs indexés par position. La mise à niveau explicite passe par une nouvelle version culinaire avec IDs réservés et revue, avant traduction assistée format2. Aucun appel automatique pour réaliser cette mise à niveau.

## 2. Captures et réception

Journal kind=traduction, champs spécifiques fermés :

```
source_version_id, target_locale, translation_source_signature,
translation_capture:{format:1,source_locale,title_capture},
translation_call:{format:1,series_id,ordinal,segment_refs:[
 {ref,kind,source_id,field,source_sha256,output_max_points}
]},
translation_resolution_revision:null|operation_id,
translation_resolutions:[{ref,decision:'adopte'|'ecarte',text_sha256:null|sha256}],
translation_resolution_receipts:[{operation_id,payload_sha256}]
```

Conserver les captures owner_id/recipe_id/édition/cycles déjà utilisées pour les autres appels. title_capture vaut null si aucune portion ne demande de titre, sinon projection translation-title-v1 complète bornée. Les refs sont1..24, uniques, dans l’ordre du squelette ; ordinal0..31. target_locale reste fr/en pour les gestes manuels existants ; assistance L6 cible fr. Une locale différente est un refus explicite, pas un alias silencieux.

`resultat` métier fermé : `{format:1,segments:[{ref,text,issue}]}` couvrant exactement les refs attendues. issue = admis/manquant/refuse ; admis exige texte string validé, les deux autres portent text:null. Le diagnostic borné du journal distingue JSON/coupure/bornes/jeton/identité ; aucun texte refusé ne disparaît du brut récupérable. Une portion invalide dans son ensemble peut avoir toutes ses refs refuse, sans effacer les octets reçus. Les mécanismes de parsing robuste ne doivent pas compléter un JSON coupé par des suppositions.

Lire une réponse exacte : `translation-reading-v1` projette id,kind,recipe_id,source_version_id,target_locale,owner_id,édition/cycles capturés,started_at,model,translation_source_signature,translation_capture,translation_call,resultat. Exclure status/résolutions/reçus/dates techniques. La résolution possède son hash séparé (`translation-resolution-v1`, revision + tableau trié des résolutions). Le read_set de publication porte les DEUX empreintes.

Initial a_lancer : capture source exacte et propriétaire courant, avant coût. en_cours : même capture, started_at fixé une seule fois. Réception : même lecture en cours capturée, résultat immuable dès sa conservation ; une source/cycle changée n’empêche pas de conserver historiquement la réponse du même propriétaire. Aucun terminal par put/REST. Les journaux de traduction restent exclus des blocages recette globaux.

Réserve interne `translation_response:v1:<journal_id>` : enveloppe fermée `{format:1,journal_id,owner_id,database_name,library_epoch,revision,state,created_at,saved_at,reserved_bytes,body,admitted}`. state reserved/received ; reserved exige body/admitted null et reserved_bytes3145728. received contient body `{encoding:'base64',byte_length,sha256,data}` (corps≤2097152octets) et admitted = résultat métier exact ; reserved_bytes vaut la taille effective de l’enveloppe complète. revision locale est un jeton CAS de réception, distinct de tout hash de traduction.

Avant l’appel : transaction unique journal a_lancer + réservation logique ; somme des enveloppes reçues et réservations≤8388608octets, nombre≤8. Chaque réservation de3Mio inclut les pires échappements des segments admis, identités et enveloppe, à vérifier par vecteur définitif. Après réception : même transaction remplace réservation par brut/admis et passe le journal à a_verifier. Une réservation en_cours n’est jamais purgée automatiquement ; après abandon explicite confirmé sans appel actif, seule la réservation vide peut être libérée. Pour une réponse reçue, purge explicite uniquement. Le quota physique peut toujours refuser : aucune écriture dans une autre portée, mémoire récupérable et message honnête. Réception normale aussi conservée avant toute publication ; aucune condition « a adopté un segment » pour démarrer l’appel suivant.

## 3. Ligne format2 et reçu borné

Ligne fermée proposée : id,recipe_version_id,locale,alignment_format:2,source_signature,source_locale,revision,translated_content:{format:2,segments},verification_state:'unverified',publication_receipts,publication_receipt_floor,created_at,updated_at. Segment = kind/source_id/field/source_sha256/text/origin/journal_id, aucun champ ref persistant nécessaire car il est dérivable. Le champ publication_receipts contient au plus128 `{operation_id,payload_sha256}`, ordre de commit. publication_receipt_floor est un entier0..length désignant le premier reçu fiable dans cette incarnation ; il est calculé par le dépôt/serveur, jamais repris du target restauré. À création publish,0. À restore, recopier l’historique borné puis ajouter le reçu restore : floor pointe ce nouveau reçu. À publication suivante, conserver floor puis le diminuer du nombre d’entrées FIFO évincées (minimum0). Les reçus historiques restent consultables mais ne prouvent aucune acceptation serveur nouvelle. Après128nouvelles opérations, tous les anciens reçus ont naturellement disparu.

Réserver AVANT paiement les octets du squelette complet +128 reçus à taille maximale +dates/identité/provenance +textes déjà conservés. Borne ligne524288octets JSONB, ensemble200000points. Cette réserve fixe le budget effectivement accordé aux sorties : jusqu’à6octets JSON échappés par point de code, en utilisant les vrais IDs de journaux pré-réservés et la taille fixe des128reçus. output_max_points de chaque ref est1..borne de rôle, somme≤24000par portion, et la somme des plafonds respecte le budget restant mesuré. Un squelette à lui seul trop gros est refusé avant tout appel, même si un sous-ensemble de textes aurait été demandé.  aucun retrait de texte après paiement. Une ligne manuelle trop grande reste dans le brouillon et n’écrase aucune valeur. Les traductions legacy ne sont pas soumises rétroactivement à ce nouveau squelette.

La provenance ai exige texte identique au segment admis du journal exact. Un texte corrigé est manual ; une décision d’adoption peut néanmoins résoudre le journal en citant le hash du texte manuel effectivement publié. Un segment absent/null n’est ni adopté ni écarté automatiquement.

## 4. Union `translation_apply` fermée

Champs communs : `{protocol:1,op:'translation_apply',mode,store,id,operation_id,payload_sha256,nonce}`. Hash et ID dérivés du contenu canonique ; commande≤786432octets, lot complet≤921600, chaque ligne≤524288,≤500mutations. Les trois modes ont leurs champs propres, sans paramètres ignorés ni mélange de modes.

### publish

store=recipe_translations,id=translation.id. Champs :

```
recipe_id,recipe_version_id,locale,
base_cycle_id,edition_id,base_edition_cycle_id,
source_signature,title_sha256:null|sha256,
expected_translations:[{id,revision:null|id,row_sha256}],
changed_refs:[ref],
journal_read_set:[{
 journal_id,reading_sha256,resolution_sha256,base_resolution_revision,
 decisions:[{ref,decision,text_sha256}]
}],
translation
```

expected_translations couvre TOUTES les candidates de la version/locale, triées ID UTF8 ; row_sha256 = projection complète de la ligne hors created_at/updated_at/publication_receipts. La revision et publication_receipt_floor demeurent incluses. Aucune candidate omise, vide signifie absence. Les candidates concurrentes restent présentes ; choisir une cible ne supprime pas les autres. Les gardes sont vérifiées sous transaction/index version_id et verrou propriétaire serveur ; aucune crypto await dans une transaction IndexedDB.

changed_refs trié unique est l’ensemble EXACT des segments modifiés par rapport à la cible sélectionnée. Nouvelle cible : base = squelette capturé avec tous les textes/provenances null ; seuls les segments effectivement renseignés changent. Les segments hors masque restent identiques, y compris provenance et hash de titre ancien. Un titre inchangé devenu périmé reste consultable mais n’est jamais affiché comme traduction courante ; il ne bloque pas l’adoption d’autres segments. Une nouvelle valeur nonnull du titre exige title_sha256 exact de la capture actuelle ; sinon title_sha256=null. Effacer explicitement le titre ne publie pas d’ancien texte et n’exige pas d’adopter un nouveau titre.

source_signature et version/association/cycles actuels doivent être exacts pour toute publication. Chaque segment culinaire est aligné sur cette source ; le seul hash historique toléré hors masque est celui du titre, dont le rendu reste périmé. translation.revision doit être operation_id. created_at est conservé pour une cible existante ; updated_at est normalisé par le serveur. Les reçus/floor sont dérivés côté dépôt/serveur, pas fournis arbitrairement : translation ne transporte ni publication_receipts ni publication_receipt_floor dans ce mode.

journal_read_set trié journal_id comprend chaque réponse citée par une adoption nouvelle et chaque journal résolu. Une décision adopte doit correspondre à une ref du journal et au segment final nonnull effectivement écrit sous la même ref/version/locale ; text_sha256 est recalculé. Une décision ecarte porte null et ne change aucun texte par elle-même. Au moins un changed_ref ou une résolution nouvelle ; aucun reçu vide. Les nouvelles résolutions sont disjointes des résolutions confirmées. Le serveur dérive état terminal et reçus, puis écrit traduction+journaux atomiquement.

### resolve

store=imports,id=premier journal du read_set trié. Champs propres : journal_read_set de même forme, aucune traduction/changed_refs/source courante/cycle de publication. Toutes décisions sont ecarte avec hashnull. Chaque journal doit appartenir au propriétaire courant selon son owner_id capturé, avec identité/résultat/résolutions exacts. Une recette retirée/disparue ne bloque pas ce geste explicite. Le résultat, les sources et les traductions restent intacts ; seul l’état dérivé des résolutions change. Aucune résolution adopte ni texte ne peut passer par ce mode.

### restore

store=recipe_translations,id=target.id. Champs : `{purpose:'archive'|'bootstrap',expected_target_sha256:null|sha256,target}`. Cible absente/identique seulement, tombale/divergence refusées. Hash de comparaison = seed métier exact hors created_at/updated_at, revision et reçus historiques inclus. Ce mode ne fabrique aucune résolution de journal.

Source version et historique nécessaire déjà disponibles ; vérifier la source culinaire en utilisant la source_locale capturée de la traduction, sans adopter celle actuelle de la recette. Une langue originale ou un titre de recette modifié peut rendre la traduction historique périmée mais reste restaurable sans changement du hash. La version culinaire elle-même reste soumise à l’identité/immuabilité du graphe ; toutes les provenances journal pointent des journaux restaurés/présents cohérents. Préserver contenu/signatures/provenance/reçus ; réserver une revision NEUVE égale operation_id à la restauration, jamais rétablir un ancien jeton de publication. Ajouter son reçu de restauration à publication_receipts, même borne128 et réserve d’octets. La capture de titre historique peut être périmée, sans falsifier le texte original. Une traduction archivée proche de la borne doit encore réserver le reçu, sans tronquer : si nécessaire, évincer le reçu le plus ancien selon la règle128, jamais un texte. Le format2 construit initialement réservait déjà cette capacité.

Journaux historiques : réutiliser `source_transfer` purpose archive/bootstrap,store imports déjà idempotent et reçu30/90jours. Ajouter au validateur de cible la branche fermée kind=traduction, toujours0parties/0rows ; aucun fragment, seed recette ou commande index possible sous cette branche. Même propriétaire historique du journal conservé. Forme historique exacte, aucune capture inventée ni clôture dérivée d’une nouvelle décision. Source présente : cohérence de la version culinaire et des identités avec les valeurs historiques capturées. Le titre, la langue et les cycles actuels ne remplacent ni ne rendent irrécupérables leurs captures historiques ; aucune signature recalculée depuis ces valeurs actuelles. Source disparue : état documentaire/orphelin, aucune publication admise depuis cette seule restauration. Signature d’une source absente non annoncée vérifiée. Résultat/résolutions/reçus et statut restent exacts. Cela réutilise un mécanisme éprouvé sans ajouter de registre privé ou de magasin.

Ordre réel : recettes/versions, journaux restaurés, puis traductions. Chaque intention conserve ses octets ; ordonnanceur de sync attend les ACK de toutes ses dépendances, même entre éditions et en cas de recul/permutation, comme le raccord final L5. La restauration n’appelle pas publish avec une fausse absence de journal et ne passe pas par un put réservé.

## 5. Rejeu, gardes et compatibilité

Reçu exact recherché dans la tranche publication_receipts[publication_receipt_floor:] AVANT CAS métier (ou tous les reçus de résolution journal, ceux-ci n’étant pas utilisés pour publication d’une traduction) : même operation_id/hash→déjà confirmé, jamais réécriture ni retour à une ancienne revision. Même ID/hash différent refuse. Au-delà des128 reçus de traduction, vieux replay refuse au CAS (operation_obsolete), il ne redevient pas une création : revisions nouvelles à chaque publication ET restauration, absence protégée contre delete/put génériques, ID dérivé du contenu+nonce. Les journaux ont au plus24 reçus utiles, car chaque opération résout au moins une nouvelle ref. Les restaurations de journaux utilisent les reçus du transfert L5, distincts des24résolutions utiles. Ses dates30/90jours et identité dérivée restent inchangées.

Gardes : ancien RPC/REST/put ne peut créer/modifier/supprimer une traduction format2 ni les champs capture/résultats/résolutions d’un journal traduction hors transition de vol admise. Verrou propriétaire AVANT toute ligne ; mêmes exceptions L1/L2 pour publish, restauration historique bornée pour restore, aucune suppression de source par resolve. La capacité recipe_language:1 doit traverser le vrai wrapper moteur, et les commandes en délai restent des barrières. Sans capacité : conserver+expliquer, aucun ancien put de secours.

Versions : structure valide sur toute version entrante ; contenu culinaire/structure d’une version publiée immuables, statut testé séparé. Parent_version_id et provenance.derived_from structurés imposent structure valide dans l’enfant, même sans headings. Les vrais producteurs, dont substitution, remappent les IDs ; ni similarité ni titre ne peuvent créer un lien de parent.

Archive5/DB6, lecteurs1–4 conservés. Brut/réserves/brouillons internes exclus et signalés. Aucun test de prototype n’est une preuve de transaction ou de traduction fournisseur ; obtenir ensuite rouges sur quota physique, courses réelles, SQLUTF8, ancien RPC/REST, archive vers base vide, deux moteurs et ACK perdu.


## 6. Raccord HTTP et API consommateur figés

Root possède src/domain/passerelle.js et ses tests. `appelerAssistant(outil,corps,{captureReponse:true,...optionsExistantes})` ajoute `reponseBrute:Uint8Array|null` au retour. Sans option, résultat inchangé. Capture uniquement status200, même si JSON illisible ; jamais corps d’erreurHTTP ni en-têtes. Plafond min(corpsMax,2097152). Lecture des octets via stream ou arrayBuffer exact ; jamais reconstruction TextEncoder(text()). Flux incomplet/trop grand:rawnull, aucun préfixe présenté comme corps complet. Annulation après lecture complète:raison annule avec brut disponible, aucune publication ; avant/pendant lecture incomplète:rawnull. Un JSON illisible reste un échec de parsing, même si ses octets sont récupérables. Le retour est une donnée, aucun callback d’écriture asynchrone dans le transport.

B possède `PasserelleProvider.completeTranslation({system,messages,maxTokens,signal})`, méthode dédiée qui poste l’outil creation avec captureReponse:true,8000tokensmax, mêmes bornes/raison/modèle que les autres appels. Elle rend `{text,stopReason,model,reponseBrute,raison}` ; une erreur ou annulation avec corps200complet conserve reponseBrute, pas de succès fictif. L’ancien complete/extraction reste inchangé. B possède l’orchestration de lecture et UI, réutilise src/ui/vol.js : un seul verrou global de vol du document, aucune seconde mutex indépendante.

Modules A sans dépendance UI :

- `domain/traductions-format.js` : `capturerSourceTraduction({recipe,version})`, `validerTraductionV2(row,source,{historique:false})`, `validerPortionTraduction(reponse,portion)`, projections et signature/validation de commande. Résultat des validateurs `{ok:true,valeur}|{ok:false,raison}`, aucune normalisation cachée ; les fonctions de signature lèvent une erreur typée de contrat. Source retournée `{source_signature,source_locale,title_sha256,title_capture,segments}` ; segments portent ref/kind/source_id/field/source_sha256/text exact. Seule autorité format2, importable par B/C et tests sans repo/DOM.
- `domain/depot-traductions.js` : `creerDepotTraductions({repo,getGeneration,maintenant,newId})` retourne les opérations ci-dessous. Captures/sessions/plans sont opaques, bases copiées au geste. Réutilise la portée L4 owner/donnée+DB+génération+époque durable ; aucun crypto await en transaction.
- `domain/publication-traductions.js` : préparation/signature publish/resolve/restore et exécution par porte repo étroite, réutilisant gardes L1/L2. Le dépôt en est la façade, aucun second journal UI.

API du dépôt :

```
ouvrirTraduction({affiche:{recipe,version,traductions},locale})
 -> {issue:'ok',session,source,modele,revision:null}|refus
preparerLectureTraduction({session,selection:[ref],limiteAppels:1..32})
 -> {issue:'ok',plan,portions,bilan}|refus
reserverPortionTraduction({plan,ordinal})
 -> {issue:'ok',reservation,portion,journalId}|refus
commencerPortionTraduction({reservation})
 -> {issue:'ok',vol,portion}|refus
conserverReponseTraduction({vol,reponse:{text,stopReason,model,reponseBrute,raison}})
 -> {issue:'conserve',journalId,lecture,manquants,refuses}|echec/refus
lireLectureTraduction({journalId,portee})
 -> {issue:'ok',lecture,etat,recuperationDisponible}|refus
adopterLectureTraduction({session,lecture,refs:[ref]})
 -> {issue:'ok',session,modele,revision:null}|refus
preparerPublicationTraduction({session,expectedRevision,payload})
 -> {issue:'ok',plan,bilan}|refus
publierTraduction({plan}) -> {issue:'publie'|'deja_publie',id}|refus/echec
resoudreTraduction({lectures:[lecture],refsParJournal})
 -> {issue:'resolu'|'deja_resolu'}|refus/echec
```

Les entrées opaques portent les bases réellement montrées ; lire/reprendre ne paie rien. reserver écrit journal a_lancer+réserve dans une seule transaction CAS ; commencer écrit en_cours/started_at exact après dernier contrôle de source/compte, puis seulement B appelle le fournisseur sous vol global. conserver analyse hors transaction puis conserve brut+admis+journal dans une transaction même portée ; aucune reprise d’appel sur un simple échec d’écriture. B garde en mémoire le même objet reponse pour réessayer conserver, jamais un nouveau POST. Une réponse historique reçue après changement de source demeure consultable mais n’est pas adoptée automatiquement. Si le plan doit reprendre une source changée, il exige comparaison explicite et nouveau plan.

Modèle brouillon kind recipe_translation : `{locale,segments:[{ref,text}],adoptions:[{journal_id,reading_sha256,refs}],ecarts:[{journal_id,reading_sha256,refs}]}`. Toutes les refs du squelette présentes une fois, ordre source, text string/null ; adoptions/écarts explicites par journal/ref, disjoints. Source IDs/hashes/provenance/cycles gardés par session, jamais acceptés du formulaire. Les noms/contrôleurs L4 de conservation, reprise, comparaison, copie de conflit, flush et sortie sont réutilisés ; aucun brouillon culinaire n’est modifié. Copier un brouillon de traduction garde ses anciennes bases. La saisie d’un segment corrigé préserve les autres propositions.

B possède `domain/plan-traduction.js` : `planifierTraduction({source,selection,limiteAppels,budgetSortie}) -> {ok,portions,nonEligibles,bilan}` pur, et `domain/lecture-traduction.js` pour séquencer les API du dépôt et le provider. Les IDs/journaux et budgets définitifs sont réservés par preparerLectureTraduction ; le planner ne crée pas de base ni de nouvelle identité. B peut préparer l’extraction pure mais réutilise validerPortionTraduction de A. Le plan annonce avant départ32portionsmax ET la réserve8entrées/8Mio : une série peut se mettre en pause à ce plafond, conservation reçue intacte, libération/récupération explicite, aucun appel répété ni purge automatique.

C possède `domain/lecture-recette.js` : `projeterLectureRecette({recipe,version,traduction,lang,portions,unites,convention})` et raccords fiche/cuisine/voix/exports/substitution. Consomme les feuilles structure B et format A sans repo ; retourne textes visibles, langue réelle et couverture/état, jamais mutation ni réglage TM dérivé de traduction libre.

## 7. Mesures de fermeture (prototype, pas tests de production)

Scripts .superpowers/sdd/2026-10-29-l6/contrats-et-bornes.mjs et mesurer-contrat-a.mjs ; vecteurs et résultats conservés au même emplacement. B:33vérifications ; A:25vérifications. Zéro réseau/DB. Commandes synthétiques servent aux bornes, pas à prouver la validité métier de journaux dont les hashes sont des fixtures.

- Reçu compact176octets ; réserve128reçus22784octets JSONB, plus entier floor/identités/dates inclus dans ligne.
- Ligne complète exactement524288octets admissible ; ajout d’un seul ASCII→524289, refus avant paiement/publication.
- Commande complète ligne proche borne +9journaux/203résolutions558112octets, wrapper558124 ; variante32journaux/768résolutions672849, sous786432.
- Réception2Mio exacts encodésbase64 +24000points U+0001 échappés +enveloppe2944512octets, sous réservation3145728. Deux réservations maximales tiennent dans8Mio, pas trois.
- Vecteurs : IDs dérivés sans boucle, nonce distinct, null sans provenance, resolve sans publication, nouveau jeton restore, reçu ancien avantCAS, vieux replay hors rétention refusé, reçu d’archive non fiable, cas source_locale.

Ajouter avant réception les preuves réelles de réservation simultanée/quotaphysique/époque/32portions, FIFO floor et reçu forgé, signatures JS↔SQL, anciens clients/REST, source historique/archives, deux moteurs et ACKperdu. Le prototype ne remplace aucune de ces preuves.
