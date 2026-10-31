# Traduction masquée après synchronisation — correctif

31 octobre 2026. Correctif du contrat existant L6 : une traduction enregistrée doit rester lisible après synchronisation et réouverture. Base publiée : 0.32.8-2. Aucun changement de protocole distant, de schéma ou de comportement payant.

## Incident confirmé

Lecture serveur ciblée, sans écriture : la traduction signalée comporte les 65 passages attendus et 65 textes présents, liés à la version courante. Aucun marqueur de suppression. Le JSON métier est valide et correctement aligné. Le serveur expose séparément une date métier canonique en millisecondes terminée par `Z` et une date de transport avec microsecondes et suffixe `+00:00`.

Le pull remplace aujourd’hui `data.updated_at` par cette date externe. Le valideur strict de traduction refuse ensuite la ligne, et la fiche affiche l’original ou « Traduction demandée indisponible », alors que les textes sont encore présents. La validation reproduite en mémoire sur la cible réelle confirme ce mécanisme ; aucun contenu personnel n’est ajouté aux tests ou à ce document.

## Contrat du correctif

1. À la réception d’une traduction V2 ou d’un journal de traduction, conserver exactement le JSON métier. La date externe et la séquence restent des métadonnées de synchronisation. Garder les protections des commandes en attente, confirmations, changements de compte et tombales.
2. Réparer au démarrage les copies locales déjà affectées, même lorsque le curseur a dépassé l’écho fautif. La réparation est limitée à `updated_at`, au format UTC de transport connu. Elle ne s’applique qu’à une ligne strictement invalide avant cette conversion et strictement valide après. Une ligne valide ou présentant un autre défaut reste inchangée.
3. La réparation locale est idempotente, atomique et conditionnée à la ligne exacte, à la base, au propriétaire et à l’époque capturés. Elle ne crée aucun envoi, aucune version et aucun appel. Les intentions en attente ne sont pas modifiées. Textes, signatures, reçus, autres dates et état de publication sont conservés.
4. Ne pas élargir globalement les dates admises par les valideurs : archives et commandes doivent conserver leur contrat avec le serveur.
5. Défaut de reprise distinct : un brouillon de traduction déjà publié doit afficher son état publié, et non un panneau de reprise vide (`publie` contre `committed`). Corriger uniquement cette reconnaissance, sans réouvrir ni republier le brouillon.

## Réception

Tests rouges avant produit : vrai pull puis lecture fiche, écho après accusé, dates UTC avec microsecondes et offset, journaux de traduction ; récupération d’une ligne déjà affectée au redémarrage sans réseau ; idempotence, aucune outbox, CAS/races, lignes invalides et commandes pendantes préservées ; retour vers un brouillon déjà publié. Conserver les voisins L6, la suite navigateur de référence, les outils Node et générateurs. Vérifier la livraison publique et une transition ancienne copie locale vers le correctif dans un profil jetable.

Pas de modification SQL ni de traduction payante. Les observations du serveur restent dans des reçus locaux ignorés, limités aux métadonnées et verdicts ; aucun texte personnel ne sera commité. Aucune relecture personnelle de cette spec n’est attribuée à Neegan.
