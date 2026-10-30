# Version française complète — réception du 30 octobre 2026

## Résultat attendu

Neegan veut une recette traduite et enregistrée, lisible ensuite en français. La fiche propose désormais **Créer la version française**, **Compléter la version française** ou **Lire la version française**, selon le contenu réellement disponible. Une traduction complète existante ouvre directement sa candidate, sans relancer l’assistant.

[Spec](../specs/2026-10-30-traduction-francaise-guidee-design.md). Base publiée `7696ed6` / livraison0.32.0-6 ; branche `traduction-francaise-guidee`. Autorisation de correction et de publication portée par la session. Relecture technique à plusieurs agents ; aucune relecture personnelle attribuée à Neegan.

## Parcours livré

L’ouverture prépare localement la sélection et affiche son maximum d’appels. **Traduire toute la recette** lance explicitement l’assistant. Les réponses sont conservées avant de poursuivre ; le plan suivant ne demande que les passages encore manquants. Une réponse conservée sur ce navigateur est retrouvée au retour avant tout nouveau lancement.

L’aperçu présente le titre, les ingrédients et leurs quantités, la préparation et les notes. Les corrections manuelles restent dans un volet replié. **Enregistrer la version française** adopte les propositions puis publie une seule traduction durable ; chaque adoption intermédiaire est conservée avant la suivante. La fiche s’ouvre avec la version culinaire et la candidate exactes en français. L’original, les quantités et les minuteries ne changent pas.

Les manques, propositions contradictoires, réponses coupées et traductions périmées ne sont pas présentés comme une version complète prête à enregistrer. Une comparaison ou relecture explicite permet leur résolution. La péremption est reconstruite depuis le brouillon durable après rechargement. Une interruption sans réponse peut être libérée par un geste explicite et conditionné ; ce geste ne supprime aucune réponse reçue et ne paie aucun appel. Une source changée après préparation refuse cette libération. Le battement du contrôleur emploie une date ISO, afin qu’une récupération d’interruptions ne coupe pas un appel vivant.

Le bouton de connexion utilise le service d’authentification prévu. Aucune modification de protocole synchronisé, de schéma IndexedDB, d’archive ou de SQL : APP_VERSION0.32.0, DB6/archive7 inchangés.

## Vérifications ciblées

- Nouveau module guidé : **80/80**. Coût sans POST, plusieurs portions, publication avec provenance, reprise sans nouvel appel, corrections préservées, manques ciblés, récupération, source périmée, réponse coupée, réservations interrompues, changement de source et retour d’une réponse d’une autre fenêtre.
- Fiche : **27/27**, trois nouvelles assertions ; lecture L6 **28/28**, éditeur **26/26**, parcours **18/18**, journal **21/21**.
- Vol : **20/20**, cinq assertions causales ajoutées pour le battement, rouges avant correction.
- Livraison : **51/51**, six nouvelles assertions pour le refus de recherche hors ligne.
- Outils Node : **271/271** ; générateurs `--check` et syntaxe des16 fichiers JavaScript modifiés conformes.

La suite complète locale termine à **11684/11684**, sans erreur JavaScript ni requête extérieure. La nouvelle épingle globale est11683 : +80 guidées, +3 fiche, +5 battement, +6 recherche hors ligne. Aucun scénario supprimé. La réception complète et la publication sont consignées ci-dessous à mesure de leur vérification.

Parcours local Chrome390/1280 **47/47 contrôles**, captures relues : coût sans appel, traduction, aperçu, enregistrement, fiche française puis rechargement réellement hors ligne sous le worker0.32.0-7. Même base et candidate, quantités/minuteur intacts, aucune nouvelle demande au fournisseur après rechargement. Zéro erreur JavaScript/requête extérieure ; deux appels simulés au total. Le premier essai attendait trop peu : `serviceWorker.ready` pouvait résoudre avant la fin de l’état `activating`. Le harnais attend maintenant l’état `activated`, sans correctif produit.

## Suite de la réception0.32.0-6

La publication précédente a bien été construite le30octobre à13:02:34UTC ;235 fichiers publics identiques. Le parcours langue public comptait24 contrôles. La première suite publique s’est arrêtée au chargement sur unHTTP503. Sa reprise avec concurrence bornée a exécuté11590 assertions :11589 vertes, une course du test inventaire après ajout d’un lot. Le test attend maintenant la fin réelle du geste avant de cliquer Consommer ; aucune assertion retirée et aucun comportement inventaire changé.

Un contrôle réel hors ligne a aussi révélé que Chrome pouvait résoudre `registration.update()` sans réseau. La recherche vérifie désormais la connectivité avant et après cet appel pour afficher son échec réel. Ces deux corrections accompagnent la livraison7. La suite publique6 n’est pas présentée comme entièrement verte.

## Livraison et limites de preuve

Livraison générée **0.32.0-7**,208 fichiers /3 636 335 octets ; empreinte `fd435b143c1c342b2b95b6a9a0af1a74db068d3e9db8f3c5ca386699525ebb09`. Réception locale terminée ; publication et réception publique en préparation à ce reçu.

Preuves locales dans `.superpowers/sdd/2026-10-30-traduction-guidee/` et `.superpowers/sdd/2026-10-30-actualisation/transition/`. Les essais utilisent des bases jetables et un fournisseur simulé, avec les modules produit réels. Aucun accès au compte ou à la recette Trinity privée de Neegan, aucun appel payé ; sa traduction doit être lancée dans son application. La qualité linguistique du fournisseur réel n’est pas certifiée par la simulation. La traduction porte sur le contenu présent et ne reconstitue pas une page manquante.

Parcours de régression locaux : langue **24/24** (320/390/1280, commandes et persistance), recherche **10/10** (version7 affichée, recherche réelle, échec hors ligne et résultat conservé). Captures relues. Les contre-épreuves indépendantes confirment la péremption après reprise et la libération d’une seule réservation interrompue, avec journal et seconde réservation conservés.
