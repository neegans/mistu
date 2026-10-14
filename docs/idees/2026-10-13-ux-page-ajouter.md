# Idées UX/UI — page « Ajouter » et flux des livres (notes de Neegan, 13 octobre 2026)

> Notes brutes déposées en fin de soirée du 13 octobre, **pas encore brainstormées ni spécifiées**. À reprendre par le
> flux habituel (brainstorm court → spec → revue adverse → plan → build) quand Neegan dit go. Contexte : la page `#/add`
> affiche aujourd'hui le long formulaire « Ajouter un livre » en bas, et on ne comprend pas comment y rattacher la
> couverture, les pages d'index et les recettes photographiées — tout de suite après la création, ou plus tard.

## 1. Grille principale de `#/add`

- Retirer le formulaire « Ajouter un livre » affiché par défaut en bas de page.
- Une **grille uniforme de cartes d'action** :
  - Ajouter un livre (ISBN, titre ou photo)
  - Importer un lien web / signet (URL d'une recette ou d'une page)
  - Photographier / importer des pages (caméra, photos ou PDF — pour une recette ou un index)
  - Saisir une recette (création manuelle)
  - Ajouter un lot au congélateur

## 2. Flux progressif « Ajouter un livre » (dévoilement progressif)

- **Étape 1 — Identification** : interface épurée centrée sur la recherche/scan d'ISBN (« Scanner », « Identifier ») + lien
  « Saisir manuellement ».
- **Étape 2 — Détails et couverture** : une fois l'ISBN scanné (ou la saisie manuelle choisie), déployer les champs
  (titre, auteur, éditeur, année, langue, cuisines, convention de mesure). Champ visuel « Page couverture » : image
  récupérée par l'ISBN, ou photo / image choisie.
- Remplacer les champs libres comme « Cuisines » par des **puces cliquables** (Italienne, Levantine, Québécoise… + ajout
  personnalisé).

## 3. Après la création du livre (accueil du livre)

- « Ajouter ce livre » ne renvoie pas dans le vide : fiche du nouveau livre (ou modale de continuité) avec confirmation
  et **trois actions immédiates** :
  - 📸 Photographier l'index / la table des matières (indexer les recettes du livre)
  - 📄 Photographier / importer des pages de recettes (numériser tout de suite seulement les pages qui m'intéressent)
  - Plus tard (aller à Mes livres) — garder le livre et y revenir un autre jour

## 4. Ajout continu et classement automatique dans un livre existant

- Dans la fiche d'un livre (« Mes livres ») : toujours des boutons clairs « + Ajouter des pages d'index » et
  « + Ajouter / photographier une recette ». Les photos prises depuis la fiche sont **associées au livre sans redemander**.
- Depuis la page générale `#/add` (« Photographier des pages » / « Choisir des photos ou un PDF ») : un **sélecteur
  rapide** dans le flux — associer à un livre existant (liste de mes livres) ou enregistrer comme recette indépendante —
  et le **type de page** (page d'index ou page de recette).

## Ce qui existe déjà (à vérifier au brainstorm, pas à réinventer)

- Fiche livre → « Photographier des pages » → séance de scan → cocher la page d'index → « Créer les références » (parcours
  V0 du 8 septembre, `CLAUDE.md` § « En cours »). Les points 3 et 4 réorganisent ce parcours plus qu'ils ne le créent.
- Principes non négociables de la spec : aucune donnée inventée (une couverture récupérée par ISBN reste une donnée
  reçue, pas devinée) ; états d'interface = événements réels.
