# L3 — Gestion visible, filtres et retour à la liste

29 octobre 2026. Base publique `fc407df`, spec `6112fd1`, branche `l3-gestion-visible`.
[Contrat](../specs/2026-10-29-l3-gestion-visible-design.md).

## Résultat et périmètre

Modifier et Actions sont accessibles dans les cartes, les lignes et les fiches. La version affichée est transmise
à l’éditeur ; une recette vérifiée conserve Modifier. Les commandes partagent les captures de propriétaire et
de cycles L1/L2. Les actions secondaires de fiche utilisent les parcours existants, sans nouvelle règle Thermomix.

Recettes rassemble aussi les références d’index, les signets et les créations IA. Livres contient uniquement les
éditions. Grille et liste partagent une projection, les filtres, les compteurs et la pagination de 60 éléments.
Une durée inconnue reste inconnue. Le filtre rapide lit les repères de la version courante et leur borne haute.
Les photos ne sont lues que pour les éléments rendus. Sélectionner ouvre les commandes groupées ; chaque résultat
de retrait ou de rattachement est compté individuellement.

Les entrées d’historique conservent recherche, filtres, limite, position et focus. La mémoire est bornée, propre
à l’onglet et à son propriétaire de données. Le remplacement de bibliothèque invalide les anciennes origines.
La chaîne liste → fiche → éditeur → fiche → liste reste distincte des liens de provenance. Les pages et filtres
Sources d’un livre ont leur contexte propre. Un retour ne relance aucun appel assistant.

Les couleurs, titres et disposition de lecture reprennent le MD et les PNG fournis dans
`Mito_MD_et_Maquette_Photo_Pain 2`. Les commandes restent visibles au toucher. Les panneaux Actions fonctionnent
au clavier et prennent place en bas de l’écran sur téléphone. La navigation supporte le texte agrandi.

## Contrat technique

- Application cible **0.25.0**, cache `cuisine-os-v0.25.0-1`.
- IndexedDB **6**, archive **3**, aucune migration SQL nouvelle.
- Modules neufs : `domain/bibliotheque.js`, `ui/bibliotheque-liste.js`, `ui/actions-contenu.js`,
  `ui/navigation-contexte.js`. Tous dans le précache ; modules d’affichage dans le filet i18n.
- Les corrections prioritaires 0.23.2 demeurent : repères par version/signature et provenance par champ,
  conservation des propositions payées, refus conditionné des anciens brouillons et plans Thermomix contrôlés.
- Les échecs de mutation se distinguent des conflits de source ou de compte. Aucune commande groupée ne promet
  une transaction globale serveur ; les cycles de chaque membre restent autonomes et durables.

## Réception locale terminée

Preuves locales sous `.superpowers/sdd/2026-10-29-l3/`.

Les reproductions rouges précèdent la construction : C07, Modifier sur une version vérifiée, informations
facultatives dans les cartes, projection des états L2 et accès aux nouvelles actions. Des vérifications réelles
ont également révélé le débordement de la barre de navigation à 200 % et un bouton de corbeille désactivé après
résolution de sa capacité avant ouverture du menu ; ces cas sont traités avant la réception finale.

Réception finale Chrome en profil jetable : 130 recettes, 120 affichées, recherche et tri, passage liste,
retour/avance, fiche → éditeur → fiche → liste, fermeture Échap et focus, favori puis rechargement.
L’ancre est retrouvée à moins d’un pixel. **25 mesures** à 320/390/768/900/1280 px, dont texte à 200 %, sans
débordement. Photo et note présentes après rechargement avec le réseau coupé ; quatre modules neufs en cache.
Parcours collections séparé : **16 mesures**, grille/liste sur les mêmes 34 résultats, retrait de deux membres
avec une modification concurrente (un succès, un refus et note conservée), Annuler et contextes Recettes/Sources distincts.
Deux onglets réels : action devenue périmée refusée sans résurrection ; remplacement du contexte de bibliothèque propagé.

Le bouton Modifier du livre a révélé un conflit entre son focus et la restauration de navigation : le champ
recevait le focus hors écran. Un marqueur d’ouverture explicite donne désormais priorité au formulaire.
Deux mesures supplémentaires à 390 et 1280 px confirment le champ visible et focalisé ; aucune temporisation
arbitraire ajoutée à l’application. Le formulaire étroit conserve des champs utilisables.

Revue croisée : export documentaire d’une adaptation Thermomix invalidée débloqué, sans autoriser cuisson ni
Cookidoo ; réessai réel après quota IndexedDB au lieu de réutiliser une promesse rejetée. Reproductions rouges,
corrections puis vérifications indépendantes conservées. Les capacités résolues avant réouverture d’un menu
restent actives ; les rejets tardifs sont traités sans erreur JavaScript non interceptée.

Navigateur **8547/8547** (épingle **8546**, **+181** depuis L2 ; aucune assertion retirée), zéro erreur JavaScript
ou requête extérieure. Ciblés nouveaux : navigation45, projection33, listes29, actions64.
Node **232/232**, générateur de migrations `--check` **0**, syntaxe des 43 fichiers JavaScript modifiés et diff propres.
Les anciens scénarios de carnet et d’import sont conservés avec les nouveaux sélecteurs ; le garde de dépendance
`getClient` distingue désormais le nom exact de l’API DOM `getClientRects`.

## Publication vérifiée

Code **`ea252326011adff107c1a3425c038a3629072736`**, avancé dans `main` et poussé sur autorisation de poursuite.
GitHub Pages construit le29octobre2026 à **23:05:19UTC (19 h05 HAE)**. **44 fichiers** de production/tests modifiés
identiques octet pour octet au commit public. Suite publique **8547/8547**, aucune erreur JavaScript ni requête extérieure.
Deux parcours publics distincts : **25+16 mesures** sans débordement, retours/navigation et contextes conservés,
actions et sélection concurrente, quatre modules nouveaux dans l’unique cache0.25.0-1, photo/note présentes après
rechargement complet hors ligne. Captures publiques relues ; fixtures injectées en profils jetables.
Preuves : `publication-fichiers.json`, `suite-publique.log`, `parcours-public.resultat.json`, `parcours-b-public.resultat.json`.

## Limites et suite

Aucun compte privé, appel assistant réel ou contenu utilisateur utilisé. Les photos de réception sont des
fixtures locales. Chrome avec largeurs émulées ne prouve pas Safari, un iPhone physique ou un lecteur d’écran.
Les échanges entre onglets concernent des bases de test locales, sans HTTP Supabase authentifié.

L4 doit ajouter les éditeurs organisés et les brouillons durables. L6 reste responsable de la traduction
automatique intégrale en français ; L3 n’annonce pas cette fonction comme livrée. Les autres lots du plan
restent suivis séparément. La publication L3 est vérifiée ; L4 commence ensuite.
