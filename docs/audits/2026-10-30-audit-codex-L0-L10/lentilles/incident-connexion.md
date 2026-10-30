# Incident pendant l'audit — connexion Google partie depuis la copie (30 oct. 2026, ≈ 12 h 59 UTC)

## Faits (journal de console du navigateur Playwright partagé, `~/.playwright-mcp/console-2026-10-30T12-59-41-289Z.log`)
- 12 h 59 : j'ouvre un onglet sur `http://127.0.0.1:8199/` (copie `git archive 247b2e5` servie par `python3 -m http.server`, lecture seule) pour mesurer le démarrage. Sur cette origine, `src/sync/config.js` (entrée `dev`, hôtes `localhost`/`127.0.0.1`) pointe vers le VRAI projet `mitsu` : la porte d'entrée « Kwe. » s'affiche.
- + 1,2 s : la porte prend le focus sur son bouton primaire « Connexion avec Google » (`src/app.js:306`, `.focus()` sur `button[autofocus]`).
- + 8,8 s : la page est chez Google (écran « validation en deux étapes »), puis un écran de mot de passe à + 11 s.
- + 39,5 s : retour sur `127.0.0.1:8199/?code=…` : un code d'autorisation a été délivré, la session s'est ouverte.
- Je n'ai cliqué ni tapé dans cet onglet ; mon seul appel dessus a été une lecture (`evaluate`) à + 17 s, déjà sur la page Google. Le code de la porte exige un clic (ou Entrée/Espace sur le bouton focalisé) : `app.js:299-305` ne résout `signIn` que par le geste. Je ne peux pas établir d'où est venu le geste (frappe dans la fenêtre partagée, ou autre) ; je ne l'affirme pas.
- 13 h 00 : onglet fermé par moi sans rien valider de plus.
- 13 h 06 (vérifié sans lire aucune valeur) : l'origine `127.0.0.1:8199` de ce navigateur garde des clés `sb-…-auth-token` dans `localStorage`, et une base IndexedDB `cuisine-os` v6 avec 46 recettes, 2 livres, 16 fichiers, `sync_state.user_id` posé, file d'envoi vide (0). Donc : réception de la bibliothèque depuis `mitsu` faite ; aucun envoi parti de cette copie.

## Portée
- Rien n'a quitté la machine : la copie est servie sur l'adresse de boucle locale, et la file d'envoi est vide.
- La session ouverte vit dans le profil du navigateur Playwright MCP (ta fenêtre partagée), origine `127.0.0.1:8199`. Elle reste valable jusqu'à expiration ou révocation.
- Quatre bases `cuisine-os-backup-test-*` restent aussi sur cette origine (reliquats du nettoyage de la suite de tests).

## Ce que je n'ai PAS fait, exprès
- Aucun effacement dans ce navigateur (règle : c'est ta fenêtre). Aucune déconnexion déclenchée depuis l'app.

## Gestes recommandés (à toi)
1. Dans ce navigateur, effacer les données du site `127.0.0.1:8199` (ou, dans l'app sur cette origine, « Se déconnecter » puis « Effacer les données de cet appareil »).
2. Si tu n'as pas toi-même validé cette connexion Google : révoquer les sessions du compte dans Supabase (Authentication → Users → sign out) et regarder l'activité récente du compte Google.
3. Arrêter le serveur de la copie : `! pkill -f "http.server 8199"` (si mon arrêt est refusé par le garde-fou).

## Leçon pour la méthode
Une copie de l'app servie sur `localhost`/`127.0.0.1` est branchée sur la PRODUCTION `mitsu` (décision R33 du 13 oct.). Toute sonde d'écran doit donc tourner dans un navigateur sans tête à profil neuf (fait ensuite : `scratchpad/audit/sonde-demarrage.mjs`), jamais dans la fenêtre partagée. À mémoriser.
