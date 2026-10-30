# Lentille Thermomix — 0.23.2 (`5412745`) contre la revue adverse 0.21.1, lue à la version finale `247b2e5`

Lecture seule (agent « reviewer »). Chemins relatifs à ``. « Rougit » est déduit de la lecture des assertions, pas exécuté.

## 1. Verdict
Sur 20 constats TMX/VIS : 6 fermés (TMX-1, TMX-5, TMX-6, VIS-1, VIS-2, VIS-10), 6 partiels (TMX-2, TMX-4, TMX-9, VIS-3, VIS-5, VIS-6), 8 non fermés (TMX-3, TMX-7, TMX-8, TMX-10, VIS-4, VIS-7, VIS-8, VIS-9). Aucun régressé au sens strict.
Le cœur sécurité TM7 tient : capacité en somme, eau bornée et comptée, prose du modèle jamais affichée, huile seule, vapeur cumulée, chaud puis vitesse > 2, gardés par des tests qui rougissent.
Reste ouvert : filtre de mots sur questions/refus, réponses refusées après paiement (jamais conservées), repères tout-ou-rien, durées « 1 h 30 » et « mijoter », TMX-3/7/8/10, VIS-4/7/8/9. VIS-10 fermé par les lots L, pas par 0.23.2.
Le correctif resserre aussi les règles appliquées à la relecture des plans déjà conservés : un ancien plan (même « testé ») peut devenir illisible et irréparable (§ 5).

## 2. TMX
| Constat | Statut | Preuve (code final) | Reste |
|---|---|---|---|
| TMX-1 capacité en somme, eau | Fermé | `src/domain/thermomix.js:221-233` (somme eau + volumes exacts), `:245`, `:278`, `:303` ; eau ≤ 2200 `:102` ; UI `src/ui/thermomix.js:186` | Masses (g) jamais comptées (voulu) ; volume estimé (tasse) ignoré (`:231`) |
| TMX-2 prose non confrontée | Partiel | raison non affichée : `thermomix.js:202`, `ui/thermomix.js:332-333` (`explicationBlocThermomix`) | Questions (`ui/thermomix.js:278`) et refus (`:325`) restent affichés ; le filtre `instruction_libre` (`thermomix.js:38`) laisse passer « sans le gobelet », « retiré », Turbo, « 120 °C » |
| TMX-3 accessoire contourné | Non fermé | `thermomix.js:187-191`, `:288-289` : couteau et fouet ne contrôlent que `['bol']` | i1 au panier, i2 au bol, couteau vitesse 10 à froid passe ; aucun test |
| TMX-4 filtre trop large | Partiel | « huile végétale », « végétarien », « garantir » passent (`thermomix.js:40-42`) ; test `tests/correctifs-thermomix-securite.js:67-73` | Encore rejetés après paiement : tout `<` ou `>` (`:36`) alors que la consigne écrit « vitesse >2 » (`thermomix-parcours.js:172-174`) ; « sans risque », « safe », « sans danger » dans questions/refus (`:41`) ; faux positifs nouveaux (`:38`, sans `\b`, `cap` lu comme couvercle) : « retirer du liquide pour respecter la capacité du bol », « mixer la soupe… chaude » ; message générique `ui/thermomix.js:47` |
| TMX-5 Corriger rend la version courante invalide | Fermé (reste un message) | `src/domain/brouillons-editeur.js:153-154`, `editeur-recette.js:135-138`, `exporters.js:75-76`, « Repartir des étapes source » ; tests `correctifs-adaptation.js:32-47,98-110` | `ui/thermomix-garde.js:6` et `ui/recipe.js:408` gardent « Reviens aux quantités adaptées… » avec un bouton qui ne débloque rien ; toute correction de contenu invalide encore le plan (`editeur-recette.js:137`) |
| TMX-6 anciennes réponses | Fermé | `thermomix-parcours.js:263`, `:155`, `:232` ; tests `correctifs-brouillons.js:43-57` | `tour_questions_precedent` écrit, jamais lu ni renvoyé au modèle |
| TMX-7 refs i1…iN non envoyées | Non fermé | `thermomix-parcours.js:185` sans `ref` ; consigne `:181` positionnelle | un décalage d'un rang passe la validation |
| TMX-8 étape > 2000 car. au « Garder » | Non fermé | `thermomix.js:311-338` ne mesure rien ; contrôle en `:84` via `signatureVersion` (`:406-408`) | même scénario |
| TMX-9 six domaines | Partiel | `thermomix.js:36` inchangé ; raison non affichée | « bit.ly/… », « .io » passent dans questions/refus |
| TMX-10 intégrité liée au texte | Non fermé, aggravé | `thermomix.js:113-115` (`plan_invalide`), `:458-470` ; message `ui/thermomix.js:247` | les règles resserrées déclenchent le même cul-de-sac (§ 5) |

## 2 bis. VIS
| Constat | Statut | Preuve | Reste |
|---|---|---|---|
| VIS-1 brouillon repères bloque sans message | Fermé (mur conservé) | `src/ui/import-cible.js` (blocage affiché, « Reprendre », « Abandonner »), `src/domain/import-cible.js:288`, `reprise-import.js:11-36` ; tests `correctifs-brouillons.js:134-142`, `correctifs-reperes.js:84-96` | mur `repo.js:1203` (`exclus: IMPORTS_OUVERTS`) et `db.js:133` ; brouillon créé à la première frappe (`ui/reperes.js:144`) ; condition transactionnelle `repo.js:1349` non filtrée (inférence) |
| VIS-2 « Enregistrer mes corrections » jette la proposition | Fermé | `ui/reperes.js:170`, `reperes-parcours.js:259` ; test `correctifs-reperes.js:67-83` | — |
| VIS-3 origine des durées | Partiel | sous-champs `reperes.js:145-147,184-193`, `reperes-parcours.js:222-227` ; test `correctifs-reperes.js:71-81` | « Confirmer cette valeur » (`ui/reperes.js:144`, `name=null`) passe les 5 sous-champs en « Corrigé par toi » sans `≈` |
| VIS-4 « Rapide » sur la parole du modèle | Non fermé | `reperes.js:168-170` inchangé | total 25 « source » + nuit de repos |
| VIS-5 tout-ou-rien | Partiel | fourchettes `source` admises `reperes.js:129-135` ; messages réseau distincts `ui/reperes.js:32-36` | fourchettes seulement avec cuire/cuisson/bake/rôtir/repos… ; « Mijoter 20 minutes », « 1 h 30 » (lu 60) refusés ; `temps` nul avec `references:[]` refusé (`:107-109`) alors que la consigne montre ce gabarit (`reperes-parcours.js:115`) ; « Chili végétarien » toujours `texte_interdit` (`reperes.js:28`, manuel `:154`), aucun test ; toute erreur rejette la réponse entière (`reperes-parcours.js:167`), « Vérifie les champs » (`ui/reperes.js:40`), réponse refusée non conservée |
| VIS-6 enveloppe unique | Partiel | rév. 2 par signature `reperes.js:214-248`, `:262` ; tests `correctifs-reperes.js:23-31,41-52` | repli `|| enveloppe` (`:262`) : adaptation TM7 sans entrée propre → `perime`, « Actualiser » affiché (`ui/reperes.js:154-156,176`) ; plus de perte de description |
| VIS-7 photo remplacée sans confirmation | Non fermé | `ui/photo-gestion.js` : confirmation seulement pour Retirer (`:127`) | hors périmètre du correctif |
| VIS-8 caractère invisible | Non fermé | `reperes.js:25` refuse `\p{Cc}\p{Cf}`, aucun nettoyage dans `lines.js` | collage PDF → « informations non disponibles » |
| VIS-9 recette envoyée deux fois | Non fermé | `reperes-parcours.js:122` (`contexte` + `signature` = JSON de la source) | coût d'entrée doublé |
| VIS-10 FR/EN et volet cuisine | Fermé (lots ultérieurs) | `ui/recipe.js:310-312`, `ui/cook.js:31,142-147` | — |

## 3. Gardes TM7 et tests
| Garde | Test | Rougit si retirée ? |
|---|---|---|
| Capacité du bol en somme (`thermomix.js:221-233,245`) | `correctifs-thermomix-securite.js:18-27` (témoin 2,2 L `:21`, précision basse `:19`, fourchette `:24-25`) | Oui |
| Capacité du panier, transvaser | `:30-32` | Oui ; panier via « ajouter » seulement `i3-thermomix.js:211-212` (sans raison exacte) |
| Eau bornée (`:102`) | `:41-44` | Oui |
| Eau comptée dans le bol (`:303`) | `:45-46`, `:50-53` | Oui |
| Eau non recomptée à chaque réglage (`:301-302`) | `:47-49` | NON discriminant : 1200 + 2×500 = 2200 pile ; le mutant « eau cumulée » survit (calcul) |
| Prose non affichée (`:202`, UI `:332-333`) | `:77-95` | Oui |
| Filtre questions/refus `instruction_libre` | `:74-76` | Partiel : « mixer… chaud/vitesse 3-10 », `contourner/bypass`, `gobelet|bouchon|lid|cap` sans test propre |
| Huile seule (`:296`) | `:56-60`, `i3-thermomix.js:83` | Oui |
| Vapeur cumulée ≤ 30 min (`:304`) | `:35-40`, `i3-thermomix.js:73` | Oui |
| Chaud puis vitesse > 2 (`:293`, `:307`) | `:61-66`, `i3-thermomix.js:75,77` | Oui |
| Chauffe ou vapeur ≤ vitesse 2 (`:186`) | `correctifs-reponses-json.js:13-14` | Oui pour la chauffe ; AUCUN test vapeur vitesse > 2 |
| Varoma seulement en vapeur (`:189`) | aucun | NON gardé |
| Panier ≤ 1, fouet ≤ 4 | `i3-thermomix.js:58-61` | Oui |
| Fouet cumulé ≤ 2 h | `i3-thermomix.js:143-145` | Oui |
Connexes : `refused` (`i3-thermomix.js:23`) accepte une raison exacte ; `refus` de `visuel-reperes.js:17` inchangé (TST-6) ; fixtures « huile cachée » (`i3-thermomix.js:171,177,179`) sans raison exigée.

## 4. Dix autres constats
DON-2 Fermé (« Ignorer » `import-cible.js:288`, route TM7 `ui/thermomix.js:62-71` ; tests `correctifs-brouillons.js:15-21,59-63`) · DON-3 Partiel (`repo.js:155,160` ignore l'interruption TM7/repères d'un autre `device_id`) · SEC-2 Fermé (`reponse-json.js`, tests `correctifs-reponses-json.js:7-12`) · SEC-3 Partiel (« mijoter », « enfourner », « 1 h 30 » refusés) · SEC-4 Partiel (refus de validation → « Vérifie la sélection… » `ui/thermomix.js:47`) · SEC-5 Partiel (pas de `marquerInterrompus` dans la route repères, aucun message `en_cours`) · TST-1 Fermé · TST-2 Fermé · TST-3 Partiel (vapeur vitesse 3 et Varoma sans test) · TST-6 Non fermé (`visuel-reperes.js:17` ; cas actif 40 échoue sur `duree_non_sourcee` avant `actif_incompatible`). TST-5 partiel (racler, `contourner/bypass` non testés) ; SEC-7 semble fermé (`thermomix-parcours.js:220`).

## 5. Risques nouveaux introduits par 0.23.2
Bloquant : aucun.
Important :
1. Anciens plans resserrés, illisibles ou irréparables : `precisionsDe` impose eau ≤ 2200 (`thermomix.js:102`) ; `reponseDe` → `verifierSequence` applique capacité et eau unique (`:221-246,296-304,337`) ; `lireThermomix` rejoue tout (`:458-470`). Une adaptation conservée avant 0.23.2 (même « testée ») avec 3 L d'eau, un total > 2,2 L ou deux vapeurs devient `ok:false` : cuisson, copie, repas et courses refusés (`cuisine-persistance.js:22`, `meals.js:214`, `grocery.js:60`) sous le message trompeur `ui/thermomix-garde.js:6` ; `construireContexteThermomix` lève `plan_invalide` (`:113-115`), l'écran conseille « sélectionne toutes ses étapes » (`ui/thermomix.js:247`) sans effet. Aucun test d'un plan déjà conservé.
2. Une réponse payée refusée par une garde est perdue (`thermomix-parcours.js:256,269` ; `reperes-parcours.js:167,173` : `resultat` et `reponse_brute` à `null`) ; le « travail payé » ne couvre que les réponses acceptées.
3. Clôture reçue « fermé prime sur ouvert » sans retour (`src/sync/imports-clos.js:1-37`, `pull.js`, `push.js`) : un `ignore` d'un autre appareil clôt un brouillon local `a_verifier` porteur d'une réponse payée ; copie seulement dans `sync_conflicts` (local, hors archive, sans geste de remise en activité).
4. Abandon d'un appel en cours : `ignorerPropositionImport` accepte `en_cours` (`reprise-import.js:4,16`) ; la réponse tardive est refusée, l'appel compté est perdu (dit à l'écran).
Mineur : `tour_questions_precedent` et `contexte_tentative` jamais lus (jusqu'à trois exemplaires du contexte sans garde de 192 Kio ; limite sync 524288 octets `sync/lots.js:20`) · verrou plus strict (`ui/thermomix.js:254,262`, `thermomix-parcours.js:153`) ; un résultat « questions »/« refus » n'est pas mis à l'abri (`:154`) · `gardeImportRelu` lève `import_modifie_pendant_sync` pendant un lot (inférence) · borne haute des fourchettes comptée (`:228`) ; eau de vapeur comptée après usage (`:301`) · plafond repères 192 Kio / 100 versions → `reperes_trop_grands` (`reperes.js:247-248`) · export documentaire d'une version TM7 invalide (`exporters.js:73`).
