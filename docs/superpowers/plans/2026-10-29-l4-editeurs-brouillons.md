# L4 — Éditeurs et brouillons durables

Réception locale terminée ; publication autorisée, pas encore attestée dans cette révision.
Branche `l4-editeurs-brouillons`, base publique `ea25232`, spécification `de858f9`.
Cible0.26.0, cache `cuisine-os-v0.26.0-1`, DB6/archive3 inchangées, aucun SQL nouveau.
Poursuite et publication autorisées par Neegan ; [contrat](../specs/2026-10-29-l4-editeurs-brouillons-design.md) relu techniquement avant construction.

## Comportement livré

L’éditeur sépare Informations, Ingrédients et Préparation. La source est à côté du formulaire sur grand écran et accessible par une bascule sur téléphone. Chaque ingrédient a ses champs ; chaque étape reste un bloc multiligne, avec ajout, retrait et déplacement explicites. Photos et Sources donnent accès aux gestionnaires existants.

Une saisie confirmée reste dans un brouillon local, proposé à la réouverture. Enregistrer publie explicitement : un changement de métadonnées ne crée aucune version culinaire ; une correction crée une version enfant, une variante préserve la courante. Le titre personnalisé devient principal et le titre original reste nommé. Le rendement textuel n’est jamais converti en portions.

Le livre utilise le même mécanisme de conservation, avec comparaison des seuls champs touchés. Quitter attend la conservation ; un échec garde le formulaire et permet de récupérer le texte. Deux onglets ne s’écrasent pas : le second peut conserver une copie séparée de sa saisie. Les brouillons illisibles restent récupérables ou écartables explicitement. Une ancienne époque d’archive rend les brouillons inapplicables, sans les supprimer.

La relecture payée depuis une correction est liée à la version et au résultat exacts. Sa réponse est conservée dans le journal avant affichage ; reprise et adoption ne lancent pas un nouvel appel. Publication, fermeture du journal, reçu local et outbox partagent une transaction. Un accusé de réussite perdu ne double pas la version lors d’un réessai.

## Vérifications locales

Les reproductions rouges, bilans ciblés et captures sont conservés sous `.superpowers/sdd/2026-10-29-l4/`.
Les anciens tests interrompus par les nouveaux formulaires sont raccordés aux gestes actuels en conservant leurs assertions métier. Les attentes de titres suivent maintenant `display_title`. Le lecteur de sources des anciens filets accepte les petits modules JavaScript valides tout en refusant une réponse HTTP en échec, vide ou HTML ; aucun module n’est exclu des filets. L’inventaire CSS inclut les trois règles de bascule Source/Modification.

Le parcours Chrome réel du responsable passe **28 mesures** : Informations, Source, Préparation, Photos, Sources, livre et texte200 % à320/390/768/1280. Correction, métadonnées sans version, reprise après rechargement, livre, création hors ligne, note/photo hors ligne et dix modules nouveaux en cache unique sont vérifiés. Le parcours C vérifie séparément les sorties, quota, arrière/avance, changement de langue et deux onglets, avec **12 mesures**, sorties40/40 et livre25/25. Les captures ont été inspectées ; aucune erreur JavaScript ni requête extérieure dans ces parcours.

Domaine/stockage : **129/129** assertions ciblées (brouillons24, publication53, journal16, limites/archives29, deux moteurs7). Les limites2Mio/8Mio/32 brouillons/128 reçus, les gardes de compte/époque/génération au commit et les pannes avant/après écriture sont exercées. La revue indépendante a reproduit puis fait corriger un changement concurrent du livre parent d’une édition et une ligne interne altérée qui interrompait toute la liste.

Régressions ciblées : import710, classement470, passerelle288, traductions84, adaptation46, photos195, carnet301, thème81, I3intégration54, L1mutations32, L2mutations24 et synchronisation318. Les quatre nouvelles assertions de mutations vérifient précisément `cycle_change`, et pas seulement l’absence d’écriture.

Node **232/232**, générateur de migrations `--check`0. Syntaxe de60 fichiers JavaScript et diff propres. Après raccord des scénarios et nettoyage des trois éditeurs de livre laissés dans des iframes de test, suite complète **8880/8880**, épingle8879 (+333 depuis L3, aucun retrait), zéro erreur JavaScript/requête extérieure. Le compteur a été ajusté seulement après mesure complète sans autre échec. La réception publique reste à effectuer après publication.

## Limites conservées

Les brouillons restent sur cet appareil et hors archive/synchronisation. Une fermeture brutale peut perdre les touches non encore confirmées ; effacer les données du navigateur supprime les brouillons. Les avertissements et la récupération textuelle sont accessibles avant effacement.

Pour une entrée d’historique étrangère sans index disponible, le repli conserve formulaire, adresse et état, sans garantir l’identité physique de l’entrée. Aucun essai physique iPhone/Safari, aucun compte privé et aucun appel assistant payé n’ont été utilisés. Groupes d’ingrédients, traduction automatique complète, révisions de sources et confort cuisine appartiennent aux lots suivants ; L5–L10 et E1 ne sont pas terminés.
