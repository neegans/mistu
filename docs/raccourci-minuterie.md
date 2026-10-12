# Minuterie système — raccourci « CuisineOS-Minuterie »

Cuisine OS ne crée pas d'alarme elle-même : un compteur dans une page web n'est pas une alarme fiable (spec §15, §33). Deux voies :

1. **Siri, par toi** : « Dis Siri, mets une minuterie de huit minutes ». L'app affiche la phrase avec la bonne durée.
2. **Raccourci installé une fois**, ouvert par l'app avec la durée en secondes :

```text
shortcuts://run-shortcut?name=CuisineOS-Minuterie&input=text&text=480
```

## Créer le raccourci (à faire une fois par appareil)

1. Ouvrir **Raccourcis** → **+** → nommer le raccourci exactement `CuisineOS-Minuterie`.
2. Dans les détails du raccourci, activer **Recevoir l'entrée depuis** et accepter le type **Texte**.
3. Ajouter l'action **Nombre** et lui donner l'**Entrée du raccourci** (le texte reçu, ex. `480`).
4. Ajouter l'action **Démarrer une minuterie** (app Horloge), durée = le **Nombre** de l'étape précédente, unité réglée explicitement sur **secondes**.
5. Ne pas ajouter d'attente ni de notification : l'alarme est celle d'Horloge.

Facultatif : une action **Si** pour refuser un nombre ≤ 0 ou non numérique.

## Tester avant de s'y fier

Depuis Réglages → « Tester le raccourci (10 s) ». Vérifier :

- lancement depuis Safari et depuis la PWA installée sur l'écran d'accueil, iPhone et iPad;
- l'alarme sonne appareil verrouillé et après passage à une autre app;
- comportement quand le raccourci est absent (message du système) ou refusé;
- plusieurs minuteries successives (Horloge en accepte plusieurs sur les versions récentes);
- son audible selon les réglages du système.

## Ce que l'app affiche

- **Demande enregistrée** → **Ouverture de Raccourcis…** → **À vérifier dans Horloge** si aucun accusé fiable.
- **Ça n'a pas démarré** : marque la demande comme non démarrée; l'app ne suppose jamais qu'une URL ouverte équivaut à une alarme démarrée.
- Le compte à rebours affiché est **indicatif** : il ne lit pas les pauses ou annulations faites dans Horloge, et reprendre la recette ne relance jamais la minuterie.

Chaque demande est conservée (`timer_launches` : recette, version, étape, appareil, durée, canal, état).
