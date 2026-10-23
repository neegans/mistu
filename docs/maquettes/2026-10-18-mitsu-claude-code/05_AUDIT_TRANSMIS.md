# Audit transmis par l’utilisateur — lecture courte

**Provenance :** texte collé par l’utilisateur le 18 octobre 2026, présenté comme le compte rendu de Claude Code. Le tableau a été remis en forme en Markdown; le contenu ci-dessous reprend la lecture courte fournie. Les conclusions n’ont pas été vérifiées indépendamment pendant la préparation de ce dossier.

**Document complet annoncé :** `docs/audits/2026-10-18-import-livres-photos-web.md`, 235 lignes, non commis au moment du compte rendu. Ce document complet et ses références par fichier et ligne ne sont pas inclus dans le ZIP. Il doit être lu dans le dépôt.

---

L’audit est écrit dans le dépôt, non commis : docs/audits/2026-10-18-import-livres-photos-web.md (235 lignes, cinq parties, tout référencé par fichier et ligne). Voici la lecture courte.

**Verdict.** Le squelette est bon et il faut le garder : séance de photos avec octets dans files, références d’index « Repérée dans ton livre », extraction d’une recette photographiée par le modèle de vision à travers la passerelle, éditeur où toute ligne est à vérifier, versions jamais réécrites, signets. Mais sur tes sept points, quatre sont absents et trois partiels. Et rien de l’importation n’a jamais été prouvé en vrai : seuls l’ISBN chez Open Library, la recherche web et la passerelle ont été mesurés. Aucun appel réel d’extraction de page n’est consigné.

| Demandé | État | Le fait qui tranche |
| --- | --- | --- |
| Couverture lue par la vision | Absent | La photo est seulement enregistrée en JPEG 1200 px. L’identification passe par l’ISBN. |
| Table des matières sur 4-5 photos | Partiel | Un seul appel, toutes photos. Ordre = ordre de cochage, non corrigeable. Section perdue. Correction dans une zone de texte. |
| Recettes photographiées en lot | Partiel | Tu regroupes à la main, une recette par appel, pas de détection ni d’appariement à l’index. Le résultat se perd si tu quittes l’écran. |
| Recette web avec son texte | Absent | Un signet n’est qu’un lien. Aucun code ne lit une page. La passerelle n’admet que l’outil de recherche. |
| Images des plats | Absent | Aucun champ. La politique de sécurité du site interdit toute image externe, il faudra la rapatrier côté serveur. |
| États et fiabilité | Partiel | Répertoriée, partielle, disponible existent. Pas d’« en cours », pas de journal d’import, pas de doublon par ISBN ni par adresse. |
| Images entre appareils | Absent | Le seau Supabase existe, aucun code ne l’appelle. Sur l’iPhone, les pointeurs sont sans octets. |

**Structure proposée.** Tout garder, et ajouter un magasin imports : le journal de chaque import, avec son état, son résultat validé et sa réponse brute bornée. Un appel payé ne se perd plus, une relance relit au lieu de rappeler, la progression devient visible. Plus quelques champs : la photo d’index précise d’une référence, l’auteur et le site d’une recette web, l’incertitude par ligne d’ingrédient, et un pointeur de photo du plat distinct des images sources. Pas de troisième vocabulaire d’état : « en cours » appartient à l’import, pas à la recette.

**Plan.** Sept lots, dans cet ordre conseillé :

1. A. Journal d’import, la fondation, sans IA nouvelle.
2. B. Recette web complète : un outil « lecture-web » dans la fonction serveur, qui lit d’abord le JSON-LD Recipe que la plupart des sites de recettes embarquent, sans modèle, et ne passe au modèle que s’il manque.
3. C. Table des matières multi-pages : sortie structurée par photo, ordre proposé et corrigeable, fusion des lectures.
4. D. Lot de recettes photographiées : un appel « classer » qui propose les groupes, puis une extraction par groupe, pages manquantes signalées, appariement proposé à la référence.
5. E. Couverture lue, petit et indépendant.
6. F. Images des plats, puis G. octets entre appareils, sans lequel les photos restent sur l’appareil qui les a prises.

**Coordination.** Pas d’agent cerveau. Trois appels typés au modèle, classer, lire, extraire, chacun avec un schéma de sortie fermé validé comme une donnée hostile, et tout le reste déterministe : séance, journal, appariement par titre et page, dédoublonnage, versions. Chaque endroit où l’IA peut se tromper est un écran de confirmation, pas une décision d’agent. Avec une personne, soixante appels par jour et une app locale-first, c’est le plus simple et le plus fiable.

**Critères de validation.** Les sept que tu as nommés sont dans le document avec, pour chacun, l’observable attendu et ce que ça donne aujourd’hui.

**Prochaine étape.** Un brainstorm du lot A, une question à la fois, puis sa spec. Le tout premier geste de ce lot devrait être une extraction réelle d’une page de livre sur le site public : durée, jetons, fidélité, avant de bâtir dessus.

Deux écarts de documentation relevés au passage, à rafraîchir au prochain lot : STATE.md sur main dit encore le lot « présentation du serveur » non fusionné, et l’architecture dit une relation « jamais vérifiée » que la restauration vérifie bel et bien.

---

## Lecture de cette source dans le dossier de passation

Les formulations du compte rendu restent conservées ci-dessus. Les autres documents du dossier précisent les ajustements proposés : ne pas promettre qu’un journal élimine toute incertitude de facturation, vérifier la synchronisation assez tôt pour les essais sur téléphone, et éviter une confirmation systématique de chaque ligne lorsque l’extraction est claire. Ces ajustements sont des recommandations, pas des conclusions supplémentaires attribuées à l’audit.

L’hypothèse « une personne, soixante appels par jour » est celle du compte rendu transmis; elle n’a pas été mesurée pendant la constitution de ce dossier.
