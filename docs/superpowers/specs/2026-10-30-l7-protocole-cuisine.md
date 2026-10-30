# L7 — protocole de persistance cuisine

30 octobre2026. Contrat relu techniquement par l’intégration, **avant tout code L7**. Base confirmée publiée par root : L6 code`87855c4`, reçu`c5b6c08`, SQL0011 et archive5. Cible L7 :0.29.0/DB6/archive6/SQL0012. Annexe normative de la spec cuisine ; les versions applicatives ne changent qu’à la construction. Références : spec/plan L7 du29octobre, revueC `revue-c.md`, `timers.js`, `cook.js`, `thermomix-session.js`, `cuisson.js`, repo/DB/sync/backup et générateurs SQL0008–0011.

## Décision proposée

Conserver les magasins et index existants, **DB6**. La migration additive0012 et la capacité **`cooking_persistence:1`** suffisent. L’archive passe au **format6**, parce qu’un ancien client peut importer puis réécrire des champs qu’il ne sait pas protéger. Conserver lecture des archives1–5.

Une garde invoker suffit à rendre l’ancre immuable. Elle ne suffit pas, avec le transport LWW actuel, à fournir toutes les garanties demandées pour la progression et les réessais. Recommandation : une branche étroite **`cooking_apply` dans `sync_push_v2`**, pas de RPC générique, pas de nouvelle table ni registre de transfert. Deux familles seulement : mutation d’un lancement ou mutation ciblée d’une session. La restauration historique est un mode distinct de ces mêmes cibles. Le calcul d’échéance, les lectures, Wake Lock, voix, invalidation de vue et les données de bilan restent hors de cette commande.

Cette branche ne doit pas devenir une API de mutation générale des repas, inventaires, recettes ou fichiers.

## 1. Pourquoi la garde seule ne couvre pas tout

| Opération | Protection suffisante | Limite réelle du code actuel |
|---|---|---|
| Calculer le reste depuis deadline | Fonction pure/vue | Aucune écriture ni RPC |
| Lire/reprendre un suivi, voix, Wake Lock | Contrôleur de vue/portée | Aucune RPC ; aucun effet externe à la réception |
| Empêcher d’effacer/changer une ancre existante | Trigger invoker + validation locale | Doit couvrir UPDATE, omission, tombale et DELETE ; timer_launches n’a actuellement ni trigger L1 ni L2 |
| Ajouter la première ancre | CAS local et guard null→valeur | Le premier serveur gagne ; la seconde ancre ne doit pas être fusionnée |
| Changer uniquement handoff_state sans perdre une ancre concurrente | Patch serveur ciblé, ou refus exact d’un vieux put | Un put complet LWW ne sait pas fusionner ce seul champ |
| Deux déplacements de l’étape courante | CAS du pointeur de cette version | Les done_step_ids monotones ne suffisent pas : deux puts contenant le même ensemble peuvent déplacer le pointeur différemment |
| ACK create perdu, autre appareil ajoute ensuite une ancre | Reconnaissance de l’intention déjà appliquée | `sync_push` accepte l’égalité totale à timestamp égal ; la ligne devenue différente produit sinon conflit. Un trigger ne peut transformer ce chemin antérieur au trigger en ACK idempotent |
| Bilan de cuisson | Transaction locale existante | Ne pas annoncer rétroactivement une atomicité serveur de toutes les lignes : le transport actuel les envoie séparément |

Une solution sans branche commande est possible seulement en ajoutant des bases/reçus persistés et une sémantique spéciale aux puts. Elle reconstituerait le même protocole de façon implicite. La branche explicite limitée à deux magasins est plus facile à vérifier.

## 2. Ligne timer_launches

Pour les nouveaux lancements, forme fermée :

```js
{
 id, timer_format:1,
 cook_session_id, recipe_version_id, step_id, device_id,
 duration_seconds, channel, requested_at, handoff_state,
 source_timer:null|{ordinal,seconds,seconds_max,sha256},
 legacy_launch_id:null|string,
 recipe_title_snapshot, task_label_snapshot,
 mirror:null|{format:1,started_at,deadline_at},
 cooking_incarnation, cooking_revision, cooking_receipts, cooking_receipt_floor,
 created_at, updated_at
}
```

Les noms recipe_title_snapshot/task_label_snapshot sont repris de la propositionC. `legacy_launch_id` ferme le seul cas source_timer:null : une ancienne demande documentaire relue exactement. Une nouvelle intention issue d’une étape possède source_timer nonnull. Aucun minuteur libre ni détection depuis traduction. La vieille ligne n’est pas modifiée ; un suivi depuis elle réserve un nouvel ID.

IDs : `identifiantSource`, pas de conversion d’ID par titre. Durée choisie entière1..86400 après `normaliserDuree` historique ; seconds/seconds_max source gardent leurs nombres exacts validés et l’absence de maximum devient null. Le choix est l’extrémité explicitement sélectionnée, normalisée par la même fonction pour lien, phrase, stockage et miroir. Ordinal entier≥0 de l’objet dans l’étape exacte ; sha256 = canonicalisation de cet objet entier, libellé compris. Aucune comparaison par texte ressemblant.

Snapshots :0..300 points Unicode, réduction avec ellipse explicite seulement pour ces textes d’affichage, jamais pour durée/source. Source exacte consultable dans la version ; aucun texte culinaire créé. Titre traduit affiché autorisé comme snapshot documentaire, sans introduire de dépendance du calcul aux traductions.

Dates timer nouvelles : ISO UTC millisecondes exactes (`toISOString`), date réelle ; started_at et deadline_at ne sont jamais normalisés par une réponse serveur. Égalité milliseconde stricte avec duration_seconds. requested_at est null pour channel mirror ; mirror alors présent dès create et handoff_state null. Pour shortcut/siri, requested_at date le geste de préparation/déclaration, ne détermine jamais le départ du miroir.

États fermés nouveaux : shortcut `requested`→`opening`→`unconfirmed`, avec `failed` accessible depuis ces trois états ; failed terminal. siri commence seulement au geste humain « J’ai demandé », état `siri`, puis éventuellement failed. Aucun état « Horloge confirmé ». Une répétition d’une demande après failed crée une nouvelle intention. opening désigne un lien actionné, non une preuve d’ouverture native.

Identité, durée, source_timer, legacy_launch_id, snapshots, requested_at et channel immuables après create ; mirror null→première valeur uniquement. Les états de demande ne réécrivent aucun de ces champs. Tombale/DELETE des lignes protégées refusés sauf purge explicite autorisée sous propriétaire réel, jamais un GUC seul. Un état de présentation « masqué » n’est pas une suppression métier dans L7.

## 3. Session et progression V2

Conserver tous champs actuels de session et les champs historiques de progress, mais ajouter :

```js
progress: {
 ...legacy,
 format:2,
 legacy_by_version: /* copie exacte si ancien by_version était présent ; sinon champ absent */,
 by_version:{
   [version_id]:{
     ...anciensChampsDeCetteEntree,
     current_step_id:null|string,
     done_step_ids:string[],
     revision:null|operation_id
   }
 }
},
cooking_state:{
 format:1,
 incarnation:operation_id,
 active_revision:null|operation_id,
 lang_revision:null|operation_id,
 receipts:[{operation_id,payload_sha256}],
 receipt_floor:0
}
```

L’incarnation est créée une fois par adopt_progress et remplacée seulement par restore. Les révisions de champ sont des jetons d’intention dérivés, pas des timestamps ; elles ne remplacent pas cette incarnation. Une entrée par version permet à un geste surA de préserver et ne pas refuser gratuitement le progrès deB. active_revision/lang_revision protègent leurs champs respectifs. La clôture status active→done est monotone ; aucune réouverture sous le même ID. Les dates started_at/ended_at gardent leur sens actuel ; status inconnu = consultation.

Après adoption V2, l’ensemble selected_version_ids, recipe_id/meal_id, servings/servings_by_version et units capturés est immuable pour L7 : les écrans actuels ne modifient pas ces valeurs en cuisine. Changer de contexte demande une nouvelle session. Cela protège l’exécution TM sans introduire un éditeur de portions en cuisine. Ne pas appliquer cette règle rétroactivement à une ligne legacy avant migration explicite.

Les tableaux done_step_ids sont des ensembles triés UTF8, sans doublon ; accumulation seulement dans une version. Les pointeurs pointent un ID connu ou null. Null ne signifie pas première étape ; la lecture legacy peut afficher une première étape connue sans l’écrire. Source indisponible ou ID ambigu : aucune étape inventée ni suppression des références anciennes.

Legacy : lire by_version d’abord ; ancien current_step_id/global done_step_ids rattachés seulement lorsque l’ID appartient à une seule version de selected_version_ids. Préserver physiquement les anciens champs ; ils ne redeviennent jamais la source de vérité après format2. Le premier geste explicite prépare une adoption pure de V2, puis sa commande métier distincte ; il capture un hash exact du vieux progress ainsi que toutes les versions nécessaires à la désambiguïsation. Aucune écriture à l’ouverture. Si une ancienne session est proche de la borne512Kio et ne peut accueillir V2/reçus, refus explicite avant mutation, consultation et copie du texte préservées ; aucune réduction silencieuse de son histoire. Mesurer ce cas avant code, ne pas prétendre qu’un JSON plus grand tient dans une limite inchangée.

## 4. Enveloppe unique, actes fermés et CAS

```js
{
 protocol:1, op:'cooking_apply',
 store:'timer_launches'|'cook_sessions', id,
 action, operation_id, nonce, payload_sha256,
 base, change, contexts
}
```

Canonicalisation commune L5/L6, mêmes limites de ligne/commande/lot :524288/786432/921600 octets JSONB réels. L’intention dérive `ck_op_`+SHA de `{projection:'cooking-intent-v1',command}` hors operation_id/payload_sha256 ; la ligne finale/révisions ne figurent pas dans change. La branche fabrique le résultat, les tokens et les reçus. Aucun champ métier arbitraire dans change. Un appel transporte une commande ; fichiers exclus.

| Cible/action | base fermée | change fermé |
|---|---|---|
| timer/create | `{target:null,session_sha256,source_sha256,legacy_launch_sha256:null|hash}` | `{timer}` sans cooking_incarnation/revision/receipts/floor, ancre déjà capturée si miroir autonome |
| timer/anchor | `{identity_sha256,mirror:null,session_sha256,source_sha256}` | `{mirror}` |
| timer/handoff | `{identity_sha256,handoff_state}` | `{handoff_state}` |
| session/adopt_progress | `{session_sha256,legacy_progress_sha256,versions:[{id,sha256:null|hash}]}` | `{}` ; adoption pure calculée depuis les lignes serveur/locales exactes, sans geste métier inclus |
| session/progress | `{session_context_sha256,version_id,progress_revision,source_sha256}` | `{current_step_id,done_add:string[]}` |
| session/active | `{session_context_sha256,active_revision}` | `{active_version_id}` |
| session/language | `{session_context_sha256,lang_revision}` | `{lang:'original'|'fr'|'en'}` |
| session/finish | `{session_context_sha256,progress:[{version_id,revision}],history:[{id,sha256}]}` | `{ended_at,done_add:[{version_id,step_ids}]}` |
| timer/session restore | `{expected_target_sha256:null|hash}` | `{purpose:'archive'|'bootstrap',target}` |

`contexts` : captures recettes/éditions L1/L2 exactes et propriétaire implicite auth.uid, avec historique seulement là où la session déjà capturée le permet. Ajouter les garde-fous DB/owner/époque au dépôt local ; ne pas sérialiser un identifiant de DB dans une preuve serveur. Aucun compte lié implicitement depuis une intention nommée étrangère.

Projections partagées :

- timer identity : tous les champs immuables listés au§2 **et cooking_incarnation**, présence/valeur exactes ; exclure cooking_revision, mirror, handoff, reçus et dates techniques. L’ajout d’ancre n’empêche pas un signalement humain concurrent.
- session context : identité, **cooking_state.incarnation**, status, sélection exacte, portions, unités, started_at, références meal/recipe ; exclure progression, active/lang et leurs tokens. Les cycles restent dans contexts. Un finish change status et invalide tout geste dépendant non encore appliqué.
- version source : objet version exact hors dates techniques et status de test, IDs/parents conservés. Cela couvre steps.timers et réglages TM d’une version legacy encore mutable, sans emprunter la langue/titre de traduction. Snapshots titre ne sont pas une preuve culinaire.
- seed restore : ligne entière hors created_at/updated_at, anciens tokens/reçus inclus.

Server : ownerlock AVANT lecture/lock lignes. Vérifier reçu exact avant les bases devenues anciennes ; puis source/association/cycles, base du champ ciblé et appartenance sélection. Fusionner uniquement les champs de l’acte, conserver extensions des autres champs. Nouvelle ancre/start exige sessionactive et source exacte ; un handoff humain et la consultation des suivis existants peuvent continuer après clôture, sans créer de départ. Une session historique autorisée L1/L2 ne restaure ni recette ni édition ; toute exception est la même qu’actuellement, pas un flag qui dispense de lire le contexte.

Les garde-fous TM restent ceux du domaine ; le serveur vérifie la version exacte capturée, sans réimplémenter un second moteur culinaire. Aucune nouvelle ancre ne valide implicitement une compatibilité TM.

## 4bis. Fermetures après revue root : incarnation, adoption pure et création

**Incarnation anti-rejeu après restore.** timer/create calcule `cooking_incarnation = operation_id`. session/adopt_progress calcule `cooking_state.incarnation = operation_id`. Restore remplace cette incarnation par son propre operation_id, sans reprendre celle du target comme autorité. Le target historique et son ancienne incarnation participent toujours au hash de l’intention restore : aucune circularité. L’incarnation nouvelle participe à timer identity et session context. Elle ne change pas lors d’anchor, handoff, progress, active ou language.

Conséquences précises :

- Un ancien anchor préparé sur mirror:null échoue après restore même si la ligne restaurée a encore mirror:null, car identity_sha256 inclut l’ancienne incarnation.
- Un ancien handoff préparé sur le même handoff_state échoue après restore, même si tous les textes/états ont été restaurés identiquement.
- Handoff préparé avant un anchor concurrent de la **même incarnation** reste admissible si son état de demande n’a pas changé : identity_sha256 exclut mirror et cooking_revision. Le patch préserve l’ancre réellement présente.
- Toutes commandes de session portent session_context_sha256 ; l’incarnation y est obligatoire après adoption. Un ancien finish avec progress:[] est donc refusé après restore, même pour une recette sans étape. Aucun acte actif ne se contente d’un tableau de bases vide.
- Les anciens reçus conservés par restore sont sous receipt_floor et ne dispensent jamais du contrôle d’incarnation. Le reçu exact du restore courant, lui, permet son propre rejeu. Hors rétention, une ancienne commande restore échoue sur son expected_target_sha256, qui contient l’ancienne incarnation.
- Les révisions de champ progress/active/lang sont aussi réinitialisées à l’opération restore lorsqu’elles existent ; les textes, pointeurs et preuves d’étapes restent identiques. Le changement d’incarnation suffit à invalider tous les gestes, même un champ qui était null ou absent.

**Adoption pure.** change est exactement `{}` ; ni progress_v2, ni pointeur, ni done_add ne peuvent être fournis par le client. Avant adoption, format2 et cooking_state sont absents : autre format inconnu ou état partiellement marqué refuse. Le read_set versions est trié, sans doublon, et couvre exactement selected_version_ids. Un ancien champ legacy_by_version préexistant, une sélection dupliquée ou un format progress déjà déclaré mais inconnu est refusé comme forme incompatible, sans nettoyage. sha256:null capture une version absente, protégée par CAS d’absence ; il n’autorise aucune source inventée. Les autres hashes portent les versions relues et validées.

Le domaine et SQL calculent la même projection : conserver les champs legacy hors by_version ; si cet ancien champ était présent, en garder une copie exacte dans progress.legacy_by_version (sinon ne pas créer ce champ) ; créer les entrées V2 uniquement pour les versions présentes avec IDs d’étapes valides. Les preuves déjà qualifiées sont attribuées uniquement à leur version. Un ID global ne devient une preuve qualifiée que si toutes les versions sélectionnées sont disponibles et qu’une seule le contient. Si une version manque ou si l’ID est ambigu, garder la preuve legacy sans lui attribuer une version. Aucun pointeur n’est remplacé par la première étape. Une adoption pure n’ajoute aucune étape faite, ne choisit aucune recette/langue et ne clôture rien. Les tokens des entrées V2 initiales, active_revision et lang_revision valent l’opération d’adoption, incarnation comprise. L’adoption n’est permise que pour une session active ; une session historique done reste documentaire, sa restauration étant un autre acte.

Le geste utilisateur initial est une **deuxième commande fermée** progress, active, language, finish, ou création de timer. Le service prépare les deux intentions et leurs bases hors transaction, en calculant la seconde depuis le résultat déterministe de la première. Il conserve le résultat local final et les deux commandes dans la même transaction déjà autorisée : pas de statut « avancé » si le geste final échoue localement. Le transport envoie adoption avant commande dépendante, sans coalescence ni rebase. Si le serveur accepte adoption puis refuse le second geste, il a conservé uniquement une migration documentaire exacte ; l’interface signale que le geste métier reste en conflit. Aucun bouton technique supplémentaire n’est nécessaire, aucune adoption à la simple ouverture.

**Nouvelles sessions : chemin minimal choisi.** Les producteurs recette/repas continuent de créer une session **legacy ordinaire**, sous leurs gardes existantes de version/TM/cycles et avec IDs, portions et langue réellement affichés. Ne pas ajouter d’action session/create L7 et ne pas accepter de V2 fraîche par un put ordinaire. Au premier geste L7 qui a besoin du contexte durable (progression, recette active, langue, clôture ou lancement), effectuer l’adoption pure puis ce geste comme ci-dessus. Une nouvelle session simplement consultée peut rester legacy. Les anciens clients continuent leur contrat sur une ligne non adoptée ; dès adoption, ils ne peuvent plus effacer cooking_state/progress.format2 ou écrire les champs réservés. Les puts de création sont transportés avant l’adoption dépendante ; l’adoption n’est jamais un seed d’une session absente.

**Vecteurs causaux à écrire avant logique L7, non exécutés dans cette phase documentaire :** (1) vieux anchor null→date accepté à tort après restore sans incarnation, puis refus attendu avec elle ; (2) vieux handoff même état après restore refusé ; (3) handoff après anchor concurrent de même incarnation accepté sans perdre l’ancre ; (4) vieux finish avec progress:[] après restore refusé ; (5) progress_v2 arbitraire dans adopt_progress refusé ; (6) migration legacy pure ne modifie aucun geste métier ; (7) échec local de la deuxième commande laisse session/outbox entières inchangées ; (8) ACK adoption perdu ne duplique ni l’adoption ni le geste suivant ; (9) création legacy→adoption→geste sur deux vrais moteurs, aucun passage en V2 par ancien put.

## 5. Reçus, transport et état confirmé

Réutiliser le contrat de reçus compacts L6 :128maximum, seuil de confiance calculé après restore, réserve d’octets avant publication, FIFO. Révision de chaque champ modifié = operation_id. Un replay encore retenu rend les lignes serveur actuelles, jamais l’ancien snapshot ; hors rétention, refus au CAS, aucun faux « déjà appliqué ». Timer/ancre étant immuables, un reçu ancien ne permet pas de repousser une échéance.

Toutes commandes opaques sont capturées une fois, snapshot immuable en outbox, sans nettoyage de chaîne ni relecture de la donnée courante à l’envoi. Pas de coalescence de phases dépendantes. Les commandes disjointes d’une même session restent ordonnées par la file locale, mais un changement distant d’une autre entrée de version n’invalide pas leur base ciblée. Les reprises dépendent du vrai ACK ; un backoff ne laisse pas passer la commande suivante. ACK doit couvrir toutes lignes réellement écrites, including session après finish.

Conflit : conserver intention locale et confirmation serveur séparées. Ancien put/REST ne peut effacer V2/ancre ou renvoyer une progression ancienne ; conflit en lecture seule dans le résolveur générique. Garder confirmation ou préparer un nouveau geste explicite sur la base montrée ; pour une ancre concurrente, nouvelle identité de suivi. Aucun « renvoyer quand même » d’une ancienne ancre. Le calcul peut montrer les deux heures en conflit, clairement nommées, sans prétendre à une synchronisation réussie.

Absence capacité : local durable possible, file en attente explicite, aucun fallback vers putlegacy. Pull respecte confirmations/overlay/compte/epoch sans écho et sans notifier un départ externe. Les snapshots sources/signatures culinaires ne voyagent pas nettoyés.

## 6. Garde invoker, restauration et clôture

Deux guards invoker ne sont pas facultatifs même avec la commande : timer_launches et cook_sessions. Ils protègent forme, champs immuables, non-effacement ancre/V2, monotonie done/status et suppression. Gardes L1/L2 existantes conservées sur sessions. Leurs exceptions pour aggregatehistorique ne remplacent pas la garde de progression. Helpers de validation readonlySECDEF possibles comme L6 ; ACL révoquées puis réautorisées explicitement dans la composition entière.

Écritures réservées via command helper élevé étroit, avec propriétaire auth strict ; aucune autorité donnée par GUC seul. Anciennes RPC aliases, source_batch, transferts L5, REST et purge à couvrir dans le catalogue. Source_transfer L5 n’accepte pas arbitrairement ces nouveaux stores ; aucun registre privé nouveau.

Restore : cible absente ou seedmétieridentique, sinon refus avant écriture. Préserver dates d’ancre, source et champs historiques ; incarnation, tokens de reprise et reçu de restauration sont neufs comme précisé au§4bis. Archive n’ajoute pas d’ancre à une ancienne demande existante, ne déplace pas une échéance et ne réactive pas une sessiondone. Historique peut être retiré/nonexécutable ; préserver signaturehistorique sans la rebâtir à partir d’une recette actuelle. Sourceprésente doit garder son association ; contexte absent est documentaire, sans autoriser nouveau départ. Archive6 refuse importation par ancien client ; archive≤5 contenant formeL7 réservée refuse plutôt que nettoyer.

Clôture : garder UNE transaction locale `enregistrerCuissons` pour fichiers, cook_history, dernierdonequalifié et sessiondone. Aucune mutation de progression seulement en mémoire avant dialogue. Le transport n’est actuellement pas atomique pour tout le bilan multi-recettes : ne pas ajouter cette promesse dans L7. Envoyer les historiques requis avant session/finish, qui vérifie le manifeste exact des IDs/preuves, puis clôture ; crash avant finish laisse historique présent et sessionactive clairement à reprendre. Il ne faut pas recopier jusqu’à100 historiques/images dans une commande768Kio : cela réduirait les volumes déjà admis. Si le produit exigeait l’atomicité serveur de l’ensemble, il faudrait un lot distinct avec staging ; ce n’est pas nécessaire à la spec actuelle.

## 7. APIs de domaine proposées et réception

```js
creerServiceCuisine({repo,getGeneration,maintenant,newId})
 .capturerPortee({owner_id,estCourante})
 .lireSession({sessionId,portee})
 .preparerLancement({portee,affiche,ordinal,choix,channel})
 .conserverLancement({intention})
 .preparerAncre({portee,lancementAffiche,sessionAffichee,versionAffichee})
 .conserverAncre({intention})
 .signalerDemande({portee,lancementAffiche,etat})
 .preparerProgression({portee,affiche,versionId,currentStepId,doneAdd})
 .appliquerSession({intention})
 .lireMinuteurs({portee,sessionId})
```

Préparateurs capturent dates/IDs avantawait et retournent intentionsopaques réessayables ; retour `{issue:'conserve'|'deja_conserve'|'refuse'|'echec',raison?,...}`. Le reste calculé est une projection, jamais un état métier stocké. Lire les actifs puis historique paginé sans tronquer la liste active. Invalidation interonglets uniquement aprèscommit, contenu non fiable relu dansDB ; rootCook met à jour sans remount des minuteurs, sans réacquérir WakeLock, sans relancer voix. Choix candidateL6 local au montage, reprise aprèsvrai reload demande un choix si plusieurs candidates.

Rouges indispensables avant construction : ancreeffacée par vieuxput; deux ancres sous mêmeID; ACKcreateperdu après ancredistante; progressionmêmeIDstep dansdeuxversions; deux pointeurs d’unemêmeversion; progrèsdisjointA/B; ABAtoken; dernierdoneannulé; source/compte/époque/sessiondone avantcommit; REST/tombale/alias; restoreclosed/collision; sourcelegacytimer modifiée; capacitéabsente; deuxvraismoteurs avec retourhorsligne. PostgreSQLUTF8 neuf + ACLcomposition + deuxconnexions sous vraiownerlock. Mesurer1000lancements et sessionàborne réelle, sans timer àchaquetick.

Verdict : contrat intégré et relu techniquement avant code, sans attribuer une relecture personnelle à Neegan. Les champs supplémentaires d’incarnation/révisions/reçus/legacy_launch_id et la distinction atomicité locale/transport sont des décisions nouvelles explicites de cette note ; elles ne doivent pas être dissimulées dans l’implémentation. Une variante putseule n’est pas équivalente au contrat de réessai/CAS ci-dessus.
