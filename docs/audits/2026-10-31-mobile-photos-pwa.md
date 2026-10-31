# Investigation photo — PWA sur iPhone

31 octobre 2026. Demande : investiguer les boutons « Photographier » et les problèmes voisins sur mobile. Appareil précisé par Neegan : **iPhone, application PWA installée**. Base examinée : `0b0b10e`, application publiée **0.32.9-1**. Le modèle d’iPhone, la version iOS, l’écran précis et le symptôme initial ne sont pas encore connus.

**Deux défauts applicatifs sont confirmés : l’annulation du choix de photo laisse plusieurs écrans bloqués ; une panne de conservation de couverture est présentée comme une photo illisible et laisse un brouillon référençant des octets absents.** La limite de résolution et le type HEIF constituent deux contraintes de compatibilité distinctes. Aucun correctif produit ni déploiement dans cette investigation.

## 1. Priorité haute — annulation du choix de photo

Tous les boutons photographier/choisir une image convergent vers `src/core/dom.js:158`. Le helper crée un input neuf dans le document, avec `capture="environment"` pour les prises de vue, et attend uniquement l’événement `change`. Il ignore `cancel` : la promesse ne finit pas et l’input reste dans le document.

Les nouveaux consommateurs qui se verrouillent avant ce choix attendent donc indéfiniment. Trois effets sont reproduits sur les vrais composants :

| Parcours | Après l’annulation | Emplacement |
| --- | --- | --- |
| Ajouter un livre → Photographier la couverture | Les boutons restent visuellement actifs, mais le deuxième appui n’ouvre rien. Enregistrer est aussi retenu par l’état de préparation. | `src/ui/livre-sans-saisie.js:192`, `:230` |
| Séance de pages → + Photographier | Photographier, Fichiers, Pivoter, Historique et Terminer restent désactivés. | `src/ui/revisions-source.js:30`, `:55` ; `src/ui/import.js:240` |
| Bilan de cuisson, depuis la fiche ou la fin du mode cuisine | Les deux boutons photo restent désactivés ; Enregistrer répond « La photo est en cours de préparation. ». | `src/ui/cuisson.js:164`, `:225`, `:269` |

Dans chaque témoin, un `change` avec une sélection vide libère les contrôles sans modifier les données. Cela distingue la cause du verrouillage d’un problème de fixture ou de conservation d’image.

**Portée de la preuve :** un appui tactile automatisé ouvre un vrai événement `filechooser`, puis le harnais envoie un événement DOM `cancel` à l’input réel. Les blocages sont observés dans Chromium et, pour les dialogues de cuisson, dans WebKit. L’annulation est synthétique : il ne s’agit pas d’un appui physique dans la caméra de l’iPhone de Neegan. WebKit a bien implémenté cet événement de fermeture ([ticket officiel 227799](https://bugs.webkit.org/show_bug.cgi?id=227799)).

Les chemins d’import ciblé et d’ajout à une cuisson existante présentent le même motif d’attente dans le code ; ils restent distingués des trois reproductions ci-dessus. Aucun effacement de recette ou de photo existante n’est constaté dans ces scénarios.

**Correction à construire :** terminer le choix sur `change` et `cancel`, nettoyer l’input et ses écouteurs une seule fois, puis laisser les `finally` existants rendre les contrôles. Prévoir la fermeture de l’écran et vérifier les consommateurs qui toléraient une promesse pendante. Ne pas ajouter de délai arbitraire qui pourrait jeter une photo encore en cours de transfert. Les gardes de compte, de bibliothèque et de cible doivent rester actives.

## 2. Priorité moyenne — échec de conservation d’une couverture

Sur Ajouter un livre, le premier import est écrit par `ensure()` avec les empreintes de la couverture. Une seconde transaction doit conserver les octets et le brouillon. Si cette seconde écriture échoue, le brouillon déjà écrit reste accessible, mais son fichier n’existe pas. Voir `src/ui/livre-sans-saisie.js:117`, `:229` et `src/domain/livre-parcours.js:27`.

Reproduction : JPEG valide réellement décodé, puis `QuotaExceededError` injecté juste avant la transaction contenant les fichiers. Le message affiche « Cette image ne peut pas être lue ici. Essaie une autre photo. » au lieu d’expliquer l’échec de stockage. Modifier le titre ne récupère pas les octets. Réouvrir le brouillon affiche « La couverture n’est pas sur cet appareil. ».

La panne est simulée à l’entrée du dépôt ; aucune saturation réelle de l’iPhone n’est revendiquée. Le même fichier est bien conservé sans cette panne. L’import n’est pas perdu : le défaut porte sur la cohérence de ses références, le message et l’absence de réessai de conservation de la sélection préparée. Une nouvelle sélection est possible, mais les octets déjà choisis ne sont plus proposés au réessai. Leur éventuelle présence dans Photos sur iPhone n’a pas été observée.

**Correction à construire :** conserver ensemble le brouillon et son fichier, garder la sélection préparée en cas d’échec et permettre de réessayer l’enregistrement sans reprendre une photo. Distinguer une image indécodable d’une erreur de stockage.

## 3. Compatibilité — résolution et formats

Ces contraintes sont confirmées dans l’application ; leur implication dans l’incident personnel reste inconnue.

- **Photos de plat, de cuisson et couvertures : plafond de 16 Mpx**, avant réduction en JPEG de 1 200 px. Un vrai JPEG synthétique de 5 712 × 4 284, seulement 148 967 octets, est refusé avec « Cette image est trop grande. ». Le même fichier passe comme page de recette, dont le plafond d’envoi est 50 Mpx. Un JPEG de 4 032 × 3 024 passe et est réduit correctement. C’est une protection mémoire existante, pas une régression démontrée ; il ne faut pas simplement la retirer. (`src/core/image.js:16`, `:107`.)
- **HEIC est autorisé ; HEIF n’est pas reconnu sous tous ses noms.** Le MIME `image/heif` et l’extension `.heif` sont exclus des listes locales actuelles. Une page portant ce nom/type est conservée mais n’est pas candidate à la synchronisation des médias. Le témoin isole la garde MIME avec des octets JPEG : il ne constitue pas un essai de codec HEIF, ni une observation du format fourni par l’iPhone. (`src/core/image.js:14`, `src/sync/mime.js:2`.)
- Un JPEG de démonstration avec orientation EXIF 6 est correctement réorienté dans Chromium. Cela ne certifie pas tous les formats ni le retour natif d’une prise de vue iOS.

Apple documente la prise en charge de HEIC/HEIF depuis Safari 17 ([notes officielles](https://developer.apple.com/documentation/safari-release-notes/safari-17-release-notes)). Cette capacité du navigateur ne suffit pas à valider les gardes MIME, le décodeur et le parcours complet de Mistu.

## 4. Ouverture de caméra — hypothèse non confirmée

Plusieurs chemins attendent une lecture de base avant d’appeler le sélecteur : couverture/pages d’un livre, gestion de photo de recette, révision de page et certaines branches d’import. L’ordre est établi, mais il ne prouve pas que la caméra est refusée sur cet iPhone.

WebKit documente l’activation issue d’un geste et sa durée limitée ([documentation](https://webkit.org/blog/13862/the-user-activation-api/)). Un [ticket récent](https://bugs.webkit.org/show_bug.cgi?id=328902) décrit un refus de `input.click()` après `MessageChannel`, même lorsque l’activation exposée est encore vraie. Mistu n’emploie pas ce chemin dans les sélecteurs étudiés : ce ticket est un contexte technique, pas la preuve de sa panne.

La sonde comparative utilisée ici comporte des contrôles sans geste, appel direct, microtâche, IndexedDB, délai et MessageChannel. **Le WebKit piloté autorise même le contrôle sans geste à émettre `filechooser`** ; ce contrôle négatif invalide son usage comme preuve des restrictions natives Safari. Aucun résultat automatisé n’est donc transformé en affirmation « la caméra iPhone s’ouvre » ou « cet await la bloque ».

L’input de cuisson est placé hors du dialogue modal, mais l’ouverture automatisée fonctionne en Chromium : aucune cause liée au modal n’est établie. Les inputs observés sont connectés et non désactivés. Chaque appel crée un input neuf ; aucun défaut de réutilisation du même fichier n’est démontré.

## 5. Contrôles mobiles voisins

Les vues Ajouter, livre, recette et cuisson sont examinées en affichage tactile 390 px, sur Chromium et WebKit (390 × 664 pixels CSS, `standalone=false`). Ce sont des vues mobiles émulées, pas la PWA iOS installée. Les 12 cibles photo mesurées par moteur sont atteignables au centre, d’une hauteur de 44 à 48 px ; aucun débordement horizontal dans les huit vues observées. Les captures sont relues. Aucun défaut de superposition de la barre de navigation n’est établi sur ces vues.

Petit défaut de présentation distinct, confirmé dans les captures : l’explication « Un index appartient à un livre… » est collée au libellé « Index ou table des matières », sans séparation. Voir `src/ui/add.js:84`. Il ne bloque pas le sélecteur mais rend ce choix moins lisible.

La route de gestion de photo est déjà protégée contre le redessin automatique de fin de synchronisation (`src/ui/state.js:77`). Ce mécanisme n’est pas présenté comme une perte de photo reproduite. Les essais n’impliquent ni compte personnel, ni appel assistant, ni écriture serveur.

## Réception et suite

- Reproductions d’annulation : trois parcours et témoins `change` vide, données inchangées ; confirmation indépendante des deux entrées de bilan de cuisson.
- Aval photo : **23 observations attendues sur 23**. Certaines attestent un défaut ou une limite actuelle ; ce total ne signifie pas que 23 parcours satisfont le besoin utilisateur.
- Aucun incident JavaScript ou appel extérieur dans les parcours applicatifs. La sonde isolée d’activation a d’abord eu un échec de ciblage tactile faute de présentation adaptée ; ce montage a été corrigé dans le harnais uniquement et n’est pas compté comme panne produit.
- Les reçus, captures et scripts détaillés sont dans `.superpowers/sdd/2026-10-31-mobile-photos/`, ignoré par Git. Tous les navigateurs de test sont fermés.

Ordre proposé : **annulation et remise à disposition des commandes**, puis **conservation/retry de couverture**, puis **compatibilité photo et ordre d’ouverture du sélecteur**. Avant de déclarer le parcours iPhone reçu, vérifier sur la PWA installée : ouvrir → annuler → rouvrir ; prendre → utiliser → enregistrer → relire ; choisir la même photo ; revenir après passage en arrière-plan. Les formats/dimensions effectivement fournis doivent être relevés sans transmettre les photos privées.

Relecture croisée du rapport : aucun écart matériel relevé entre les constats, les compteurs et les reçus.

Le code, la version, le manifeste et les tests suivis restent inchangés. La suite de 14 769 tests n’est pas relancée pour cette investigation documentaire ; elle ne remplace pas ces témoins ni un essai physique iPhone. Aucune correction n’est déployée par ce rapport.
