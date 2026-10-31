# Photos mobiles — correction et réception

31 octobre 2026. Autorisation « deploy » après l’investigation de la PWA iPhone. [Audit](../../audits/2026-10-31-mobile-photos-pwa.md) · [Contrat](../specs/2026-10-31-mobile-photos-correctifs-design.md). Base publiée0b0b10e/0.32.9-1 ; audit1e9e601. Aucune relecture personnelle de la spec attribuée à Neegan.

## Correction

Annuler le choix de photo rend les commandes du livre, de la séance de pages et du bilan de cuisson disponibles. Les entrées temporaires sont nettoyées ; une suspension pendant la caméra ne doit pas être traitée comme une annulation. Le brouillon d’un nouveau livre et ses octets sont conservés ensemble. En cas d’échec d’écriture, la photo préparée reste disponible pour un réessai explicite sans nouveau sélecteur ni appel payé. L’aide du choix de pages est séparée de son libellé.

## Vérifications ciblées

Les tests rouges précèdent les modifications : **21 échecs sur43** pour le sélecteur partagé et ses trois consommateurs ; **15 échecs sur45** pour la conservation du livre. Les premiers témoins de conservation atteignent la transaction et montrent les références orphelines ; les scénarios de course de cet ancien code s’arrêtent à l’absence de bouton de réessai, ils ne prouvent pas encore les gardes de concurrence.

Réceptions ciblées finales : **43/43** nouveaux contrôles du sélecteur et **65/65** de conservation, soit108 nouvelles assertions. Régressions :175/175 pour le sélecteur et ses voisins,85/85 pour le livre (ces groupes partagent le module I2 de57 assertions et ne sont pas additionnés comme des cas distincts). Revue indépendante sans défaut restant confirmé. Outils Node : **281/281** ; outils CI : **29/29**. Suite navigateur complète : **14877/14877**, soit108 de plus que14769 ; épingle14876 avant sa propre assertion. Zéro erreur JavaScript ni requête extérieure ;29 journaux simulés attendus. Node24.22.2, Chromium156.0.8078.4 ; passage terminé à18:57:20UTC, navigateur et serveur fermés. Générateurs et `git diff --check` conformes.

Deux cas historiques, `tests/l5-import-sources.js` et `tests/l2-corbeille-imports.js`, ouvraient un sélecteur système automatiquement annulé par Playwright avant d’y placer les fichiers. Le nouveau helper traite correctement cette annulation : les fixtures ne pouvaient plus atteindre leur véritable scénario. La seule présentation système est désormais interceptée dans ces deux cas, sous `try/finally`, avec le vrai helper, les vrais fichiers et l’événement `change`. Leurs51 et45 assertions sont conservées ; le runner CI reste inchangé.

La revue a ajouté des témoins pour conserver une photo en attente après une deuxième sélection annulée/invalide et empêcher Pivoter/Catalogue de la jeter :53/63 avant correction,63/63 après. Une sauvegarde de texte déjà demandée devait aussi survivre à la fermeture de la vue :64/65 avant séparation des gardes de portée et de sélection,65/65 après. Ces défauts intermédiaires sont corrigés avant gel.

## Parcours et publication

Parcours Chromium local : **35/35**, sept entrées photo avec annulation puis réouverture, sélection de vrais JPEG synthétiques, décodage, conservation des octets et des références. Les recettes, livres, bilans, séances et pages restent strictement identiques après un rechargement réellement hors ligne ; les images s’affichent depuis la base. Zéro erreur JavaScript/console/HTTP, requête extérieure ou POST. Captures de l’aide de pages, du bilan utilisable et des vues hors ligne relues. Le premier montage avait omis de terminer le dialogue normal des restes après le bilan ; le harnais a été corrigé, sans changement produit. Le parcours complet WebKit automatisé n’est pas validé : l’annulation/réouverture fonctionne, mais la conservation de la première page reste bloquée. Un témoin indépendant, sans aucun module Mistu, lit correctement les867octets du fichier JPEG puis échoue à son écriture IndexedDB avec `UnknownError: Error preparing Blob/File data to be stored in object store`. L’échec d’automatisation est conservé ; il ne prouve ni un défaut introduit par cette correction ni le fonctionnement de la caméra réelle. Vérification publique encore à recevoir.

Manifeste : **217 ressources**, **3 797 277 octets**, SHA256 `1b3ff174e14d47b59e9e9c32a87ca5e464ebf49b5ce20dd5cd26c0aac7a1e0ad`. Le code est gelé. Promotion, Pages et CI distante restent à recevoir.

Traces locales : `.superpowers/sdd/2026-10-31-mobile-photos/correction-root/`, `artifacts/ci-navigateur/passage-sR5crV/`, `.superpowers/sdd/2026-10-31-correctifs-mobile-photos/agent3/`. Les preuves de panne de stockage injectent une erreur dans la transaction native, sans saturation physique du disque.

## Portée

Livraison prévue0.32.10-1, APP_VERSION0.32.10 ; DB6/archive7 inchangés. Aucun SQL, nouveau type synchronisé ou déploiement assistant. La limite de16Mpx des photos normalisées reste distincte ; la prise en charge supplémentaire de HEIF n’est pas incluse. Les défauts d’annulation et d’écriture sont corrigés dans cette livraison, pas une incompatibilité de caméra iOS encore non reproduite physiquement.

Les parcours utilisent des profils et des JPEG synthétiques. L’événement d’annulation est envoyé au vrai input, mais reste simulé. `filechooser` dans WebKit automatisé ne prouve pas l’activation native, comme l’a montré le contrôle négatif de l’audit. Aucun essai sur un iPhone physique, compte privé, prise de vue réelle, ni appel assistant payé n’est revendiqué.
