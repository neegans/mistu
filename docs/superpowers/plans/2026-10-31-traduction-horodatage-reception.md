# Traduction masquée après synchronisation — réception

31 octobre 2026. Correctif du contrat L6, poursuivi sous l’autorisation existante de corriger et déployer. [Spec](../specs/2026-10-31-traduction-horodatage-design.md). Aucune relecture personnelle attribuée à Neegan.

## Diagnostic confirmé

La lecture ciblée du serveur retrouve les 65 passages français attendus sur la version courante, sans suppression. Les appels et les portions enregistrées sont présents dans les journaux. Aucun texte privé ni identifiant de compte n’est ajouté au dépôt.

Le JSON métier contient une date canonique en millisecondes terminée par `Z`. Le transport expose séparément sa date en microsecondes avec `+00:00`. Le pull remplaçait la première par la seconde : la traduction restait stockée, mais échouait à la validation stricte et disparaissait de la lecture. Sur la ligne réelle, la validation de forme et d’alignement passe avant cette substitution et échoue après.

Le helper de réparation a été exécuté en mémoire sur cette ligne affectée : le résultat est strictement égal au JSON métier encore conservé sur le serveur, avec 65/65 passages valides. Aucun contenu personnel n’a été persisté par ce contrôle, aucune écriture distante ni traduction payante n’a été lancée.

## Correction

- Le pull conserve le JSON métier des traductions V2 et des journaux de traduction. Horodatage externe et séquence restent dans les métadonnées de synchronisation.
- Au démarrage, une copie locale touchée est réparée uniquement si la conversion de son seul `updated_at` suffit à la rendre strictement valide. Dates impossibles, autres défauts et intentions pendantes restent intacts. Aucun élargissement des valideurs.
- Transaction locale sans outbox, avec gardes sur la base, la connexion, le propriétaire, l’époque de bibliothèque, les lignes exactes et la file entière. La passe est rejouable, sans marqueur définitif. Confirmations et conflits documentaires restent intacts.
- Un brouillon déjà publié est reconnu comme tel au retour dans l’éditeur, sans proposer une reprise vide.

## Vérifications

Les témoins rouges précèdent les modifications : rejet de traduction/journal après vrai pull, retour vers un brouillon publié, disparition de couverture après redémarrage. Les données des tests sont synthétiques. Les régressions de commande pendante, accusé puis écho, tombale, journal et anciennes traductions sont conservées.

Réception ciblée : **50/50** nouveaux contrôles de pull, **90/90** de réparation au démarrage et **84/84** du parcours guidé (+4). Régressions voisines : **427/427** pour le pull, **142/142** pour le dépôt et la réparation, **40/40** pour les reprises L4. Revue indépendante sans défaut confirmé. Outils Node : **281/281**. **Suite navigateur complète : 14769/14769**, épingle14768, soit +144 assertions (50+90+4). Node24.22.2, Chromium156.0.8078.4 ; reçu `artifacts/ci-navigateur/passage-N06yfN/resultat.json`, du31octobre17:32:21 au17:35:23UTC. Zéro erreur JavaScript ou requête extérieure ; 29 journaux simulés attendus. Serveur et navigateur fermés. Générateurs conformes. Outils CI **29/29**. Premier lancement des outils CI sans le chemin du navigateur installé : échec de configuration conservé ; relance avec `PLAYWRIGHT_BROWSERS_PATH` réussie sans modification de code. La réception publique est décrite ci-dessous.

Le rouge initial de reprise comporte trois défauts causaux (traduction, journal et couverture) et un échec distinct dû au helper alors absent ; il ne représente pas quatre régressions métier. Le retour vers le brouillon publié est passé de 82/84 à 84/84 sans retirer les anciennes attentes. Les 15 rouges du nouveau témoin pull sont devenus 50/50.

## Parcours de récupération

Même harnais et même fixture synthétique de 65 passages sur deux vraies livraisons : **14/20** sur l’ancienne 0.32.8-2, avec six échecs causaux ; **20/20** sur 0.32.9-1. La base contient une traduction dont seule la date reproduit le défaut, ainsi qu’un curseur de réception déjà avancé. Un rechargement passe par le véritable démarrage de l’application et restaure la ligne exacte. Un deuxième rechargement réellement hors ligne conserve les 65 passages français, la source, la signature et le reçu. Confirmation historique et curseur restent inchangés, aucune outbox n’est créée.

Zéro erreur JavaScript, console, HTTP, requête extérieure ou POST dans les deux parcours. Captures ordinateur1280 et téléphone émulé390 relues. Le montage exploratoire initial avec des références non triées a été refusé avant semis : ce n’est pas un rouge produit, et il est conservé séparément. Même parcours public : **20/20**, sur0.32.9-1, avec les mêmes contrôles de conservation et de rechargement hors ligne ; aucune erreur inattendue ni POST. Quatre captures de lecture relues, dont les ingrédients et la préparation en français sur téléphone émulé hors ligne. Deux passages de la même matrice de20 contrôles ont servi à compléter les captures ; ce ne sont pas40 contrôles distincts. Tous les navigateurs sont fermés.

## Publication

Code `987f40820964d01a967ad857ce1a7a5444483883`, promu par avance rapide depuis `2f5232f`. [GitHub Pages](https://github.com/neegans/mistu/actions/runs/41225370710) terminé avec succès le31octobre à17:37:41UTC ; job de déploiement124608430366. **449/449 fichiers publics conformes** aux octets du commit, SHA256 et MIME compris. 455 réponsesHTTP200 avec alias et relectures, aucun nouvel essai nécessaire. Comparaison reçue entre17:38:08 et17:38:11UTC.

Livraison0.32.9-1 :217 ressources,3 789 472 octets ; SHA256 du manifeste `4c56b9aa39769593aad2b23fb7f537b802a4a05824eb677a1cc8848a18789bc9`. Le parcours natif public confirme séparément la livraison exécutée et la reprise des65 passages. [CI GitHub du code](https://github.com/neegans/mistu/actions/runs/41225371068) **verte**, job124608292293 terminé à17:40:59UTC, run terminé à17:41:00UTC. Journaux reçus par le connecteur GitHub :281/281 outils Node,29/29 outils CI,14769/14769 navigateur, générateurs conformes. Le reçu navigateur est conservé par le workflow ; aucun téléchargement de cet artefact n’est revendiqué.

## Portée

APP_VERSION 0.32.9, livraison publiée 0.32.9-1 ; DB6 et archive7 inchangés. Aucun SQL ni déploiement de la fonction assistant. La présence des textes sur le serveur est prouvée ; leur retour sur un appareil personnel exige que cet appareil charge la nouvelle livraison. Aucun essai physique sur iPhone/Safari n’est revendiqué.
