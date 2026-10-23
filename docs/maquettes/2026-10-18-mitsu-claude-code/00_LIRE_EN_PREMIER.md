# Mitsu — dossier de passation pour Claude Code

Préparé le 18 octobre 2026. Langue du produit et des échanges : français.

## Utilisation

1. Décompresse `Mitsu_Claude_Code_2026-10-18.zip`.
2. Place le dossier `Mitsu_Claude_Code` à un endroit accessible à Claude Code, à côté de ton dépôt ou dans un dossier de documentation adapté. Ne remplace aucun fichier existant.
3. Ouvre Claude Code dans le dépôt Mitsu, puis transmets le contenu de `01_PROMPT_CLAUDE_CODE.md` en indiquant le chemin de ce dossier.
4. Demande-lui de lire les documents et d’ouvrir les PNG, en particulier `maquettes/mobile/04_import_recette_ciblee.png`.

Message court prêt à copier :

> Voici le dossier de passation Mitsu. Lis `01_PROMPT_CLAUDE_CODE.md`, puis les documents et les maquettes indiqués. Le dépôt contient déjà l’audit `docs/audits/2026-10-18-import-livres-photos-web.md` : lis sa version actuelle sans écraser les modifications non commises. Utilise ce dossier pour cadrer la suite, à commencer par la preuve d’extraction et la spécification du lot A. La dernière précision de parcours est l’import directement depuis une recette « À importer », avec photos réorganisables et photo du plat facultative.

## Contenu

| Fichier | Utilité |
| --- | --- |
| `01_PROMPT_CLAUDE_CODE.md` | Prompt de démarrage, contexte de l’audit, priorités et résultat attendu. |
| `02_CAHIER_DES_BESOINS.md` | Besoins consolidés : couverture, sommaire, recettes, web, images, persistance. |
| `03_PARCOURS_ET_DIRECTION_VISUELLE.md` | Parcours mobile/web et lecture des sept maquettes. |
| `04_PLAN_TECHNIQUE_ET_VALIDATION.md` | Lots A à G, points de vigilance et critères de validation. |
| `05_AUDIT_TRANSMIS.md` | Lecture courte de l’audit fournie par l’utilisateur, avec tableau remis en forme. |
| `maquettes/web/` | Trois maquettes PNG : bibliothèque, import d’un livre, recette enregistrée. |
| `maquettes/mobile/` | Quatre maquettes PNG, dont l’import ciblé depuis une recette repérée. |
| `MANIFEST.json` | Liste des fichiers et empreintes SHA-256 pour vérifier l’intégrité du dossier. |

## Ce que ce dossier établit

- Le besoin fonctionnel et le dernier parcours mobile demandé par l’utilisateur.
- Une direction visuelle cohérente et exploratoire, illustrée par sept images générées.
- Les conclusions rapportées par l’audit de Claude Code, sans prétendre les avoir vérifiées à nouveau.
- Des recommandations de mise en œuvre et de validation à confronter au dépôt.

## Limites à conserver lors de la reprise

Ce dossier n’est pas le dépôt Mitsu. Il ne contient ni son code source, ni ses secrets, ni le fichier complet d’audit de 235 lignes. Seule la lecture courte collée dans la conversation est reproduite. Le fichier complet doit être lu directement dans le dépôt par Claude Code.

Aucune extraction réelle, migration, synchronisation entre appareils ou modification de l’application n’a été réalisée pour préparer ce ZIP. Les recettes, auteurs, livres, chiffres et sources présents dans les maquettes sont des données fictives de démonstration. Les PNG servent de références de design; ce ne sont ni des écrans fonctionnels ni des données à importer.

Les textes fonctionnels de ce dossier priment sur les petites incohérences visuelles ou textuelles des images générées. Les besoins utilisateur restent prioritaires; l’audit complet et le code servent à établir l’état actuel. Les recommandations ajoutées sont identifiées comme telles et ne constituent pas des constats sur le code.

Les sept maquettes sont ici en JPEG reduits a 1200 px de cote (sips, qualite 82) pour tenir dans le depot public ; les PNG d'origine (1,5 a 2,1 Mo chacun) restent dans ~/Downloads/Mitsu_Claude_Code (copie du 18 octobre 2026). MANIFEST.json decrit les PNG d'origine, pas ces JPEG.
