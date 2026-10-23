# Lot F — « Les plats en images » : photo du plat, rapatriement par la fonction, cartes illustrées — spec (rév. 4)

Date : 19 octobre 2026 (**rév. 4 à la clôture de la construction, 23 octobre 2026** : rejeu du plan sur la tête finale du lot E `5ec092c`
— sept écarts d’intention EI-1 à EI-7, trois défauts du plan D-1 à D-3 et onze adaptations A-1 à A-11 tranchés par R-F-12 à R-F-18 —, précisions P-1 à
P-19 du plan, rulings de construction R-F-19 à R-F-29, mesures finales, le tout en § 12 « Rév. 3 → rév. 4 » ; tête de code `b65988f`, `sw.js
cuisine-os-v0.15.0-9`, épingle 5947,
suite 5948/5948, Node 208/208, `tsc` 0 ; § 13 mis à jour). Base : la tête du lot A sur `import-cible` (worktree `~/projects/mistu-import`),
**`bd03e48`** à l'écriture des rév. 2 et 3
(tâche 6 du lot A commise, sur `f8cfafa` — ronde 1 de la tâche 5 — et `e88f0b1` — tâche 5 ; `APP_VERSION 0.9.0`, `DB_VERSION 4`, `sw.js`
`cuisine-os-v0.9.0-10`, total épinglé **3586**, `tests/tests.js` l. 220), elle-même sur `main` `57babc6`. Le lot F se construit EN DERNIER de la
chaîne linéaire (A → B → G → C → D → E → F), dans son propre worktree (`~/projects/mistu-plats-en-images`, branche `plats-en-images`, port 8094 ; fixés par le chef d'orchestre au Départ : worktree
créé sur la tête FINALE du lot E), sur la tête du lot E. Il consomme le lot A (`recipes.photo_sha256` / `photo_origin`, la photo en tête de fiche
`photoDuPlat`), le lot B (l'image du JSON-LD et `og:image` que B ignore : « F la prendra », D-B9 et `recetteDepuisJsonLd`) et le lot G
(`referencesFichiers` compte `recipes.photo_sha256` ; l'état d'un fichier absent et « Télécharger », que le plan G rév. 1, tâche 6, pose EN TÊTE de la
fiche dans `photoDuPlat(recipe, ctxF)`). Sources : audit `docs/audits/2026-10-18-import-livres-photos-web.md` (§ 1.5 ligne par ligne, § 2 « recipes
(photo du plat) », § 3.3 étape 4, § 4 lot F, § 5 « Photo du plat (bonus) ») ; dossier de passation (01 points 3-4, 02 B7, 03 § 4 et § 6, 04 § F) ;
spec du lot A (rév. 3.1, `docs/superpowers/specs/2026-10-18-import-cible-design.md` : D-4, I-4 à I-8, § 3.2, § 4.2.3, § 4.3.6, rulings T4-R1-d et
T4-R2) ; spec du lot B rév. 3 (scratchpad `lots/B/spec-rev3.md` : I-B3, I-B7, I-B8, B-24, § 3.5, § 4.2.5, § 4.3, § 6.1-6.4, § 7.2-7.3) et son
prototype (`lots/B/proto/serveur/supabase/functions/assistant/index.ts`) ; spec du lot G rév. 4 (scratchpad `lots/G/spec-rev3.md` : § 3.5, § 4.2,
§ 4.4, R-G-5 « aucune migration ») et plan G rév. 1 (`lots/G/plan-rev1.md` : `typeAffichage`, `contexteFichiers`, `vignettePage`, `photoDuPlat`) ;
specs C rév. 6 et E (aucune migration, aucun recouvrement avec les surfaces de F) ; brief du chef d'orchestre (D-F1 à D-F6, reprises ci-dessous,
précisées où le code l'exige) ; code du worktree, relu nom par nom (`python3` sur les sources : le `grep` de ce shell est peu fiable en UTF-8).
**Numéros de ligne** (règle R-C-7 de la spec C) : ils valent à la tête nommée, **`bd03e48`** (`recipe.js`, `components.js`, `livre-ajout.js`,
`meals.js`, `search.js`, `dish.js`, `passerelle.js`, `core/image.js`, `vocabulaire.js`, `schema.js` n'ont pas bougé depuis `f8cfafa`), et sont
relus au pré-vol du plan et à la tâche 1 ; une dérive n'est pas un constat, y compris celle d'un commit du lot A postérieur à `bd03e48` (le
vérificateur l'applique). **Reprise** : un premier jet avait été écrit sur `47f61ed` (`spec-rev1-premier-jet-47f61ed.md`) ; la rév. 1 sur
`e88f0b1` ; la rév. 2 applique les trois revues adverses (besoin, sécurité, faisabilité) ; la rév. 3 applique les rulings R-F-1 à R-F-6 du chef
d'orchestre et le constat N-1 de la vérification de la rév. 2 (§ 12). Méthode : spec → revue adverse → plan → construction par sous-agents →
`/verify` → fusion par Neegan (après le collage de `0006` avec le lot B, qui porte la contrainte `outil` à cinq outils, § 6.4).

## 0. Décisions (chacune renversable sans défaire le reste, avec son coût si faux)

Décisions du chef d'orchestre (reprises telles quelles, précisées où le code l'exige) :

- **D-F1 Une seule image du plat par recette.** `recipes.photo_sha256` (pointeur souple vers `files`, posé par le lot A :
  `fabriquerExtraction`, `src/domain/import-cible.js` l. 115, depuis `imports.photo_sha256`), `recipes.photo_origin` et
  `recipes.photo_source_url` (NEUF, § 3.1). **Précision (code lu)** : le lot A écrit `photo_origin ∈ 'photo' | 'image'` (constante locale
  `ORIGINES_PHOTO = ['photo', 'image']`, `src/domain/import-cible.js` l. 91 ; `'photo'` = « Prendre une photo », capture `environment` ;
  `'image'` = « Choisir une image » ; `tests/import-cible.js` l. 364 et 645-680), et non le `'appareil'` de l'audit (§ 2). F **aligne** :
  `photo_origin ∈ 'photo' | 'image' | 'web' | null`, liste fermée **`PHOTO_ORIGINS`** neuve dans `src/model/schema.js` (à côté
  d'`AVAILABILITY`, l. 146), lue par `assertVocabulaire` (`recipes.photo_origin`, non obligatoire). La constante locale `ORIGINES_PHOTO` de
  l'écran ciblé **reste** à deux valeurs : l'écran ciblé n'admet que les gestes de la personne, jamais `'web'`. Une origine hors liste RELUE
  d'une fiche (archive, appareil plus récent) se lit `null` (D-F19). La règle d'empreinte **`HASH = /^[0-9a-f]{64}$/`** est exportée UNE fois,
  par `src/model/schema.js` (aujourd'hui recopiée en ligne dans `src/ui/import-cible.js` l. 64 et locale à `src/domain/backup.js` l. 21 : F ne
  touche pas ces deux-là) et importée par `photo-web.js`, `photo-plat.js` et `components.js`. L'image vit dans `files` (JPEG ré-encodé, 1 200 px
  de grand côté, `LIMITES_COUVERTURE.maxCote`, comme la couverture) ; distincte des images sources (`source_page_ids` → `source_pages.sha256`,
  section « Original » de la fiche, `recipe.js` l. 121-123) : jamais confondue, deux zones à l'écran (I-6 du lot A). Coût si faux : une liste de
  trois valeurs à renommer, un test.
- **D-F2 Fiche recette : zone « Photo du plat » (le composant de la couverture du livre) ; cartes illustrées.** Deux places, comme la fiche d'un
  livre (couverture à gauche du titre, `book.js` l. 66-68 ; section « Couverture » plus bas, l. 129-168) :
  - **En tête** : l'image, telle que le lot A la rend (`photoDuPlat` : `figure.photo-plat[data-role="photo-plat"]`, `img` 320 px, `alt` « Photo
    du plat » ; rien quand aucune ligne `files` n'existe, pas même un cadre), **et l'état d'un fichier absent que le lot G y pose** (plan G rév. 1,
    tâche 6 : `photoDuPlat(recipe, ctxF)` rend `vignettePage` — « Pas encore sur cet appareil » + « Télécharger » — dans la même `figure`, épinglé
    par le test G « fiche recette : « Original » groupé et photo du plat distante »). F la déplace dans `src/ui/photo-plat.js`
    (**`figurePhotoPlat`**, même balisage, règle d'affichage de G `typeAffichage`), resserre le pointeur à `HASH`, lui ajoute la légende
    d'attribution `figcaption.muted` quand `photo_origin === 'web'` (D-F11), et la pose dans un emplacement `div[data-role="emplacement-photo-plat"]`
    que la zone redessine après un geste.
  - **Zone** : une `section` « Photo du plat » après la préparation et avant « Original », rendue par le MÊME composant que la couverture :
    **`renderZoneCouverture`** (`src/ui/livre-ajout.js` l. 240), qui gagne deux options `{ libelle, nomRetirer }` (défauts : « Couverture » et
    aucun `aria-label` : la fiche du livre et `tests/ajouter.js` l. 1212-1225 ne changent pas) ; gestes « Photographier » (`capture:
    'environment'`, origine `'photo'`), « Choisir une image » (origine `'image'` ; sur une photo en place, il la REMPLACE : 03 § 4), « Retirer »
    (quand un pointeur existe ; `aria-label` « Retirer la photo du plat », 03 § 6) ; mur `preparerPhotoLocale` (le chemin `'locale'` de
    `poserCouverture` : 25 Mo, liste `MIME_PHOTO_LOCALE`, 16 Mpx lus dans l'en-tête, JPEG 1 200 px) ; URL `blob:` par `urlDeBlob`, révoquées
    (D-T9). Sous le composant, la ligne du rapatriement web (§ 4.1.2).
  - **Pointeur sans octets** : l'état du fichier et « Télécharger » vivent EN TÊTE (G) et nulle part ailleurs (§ 4.1.4, I-F10) ; jamais sur une
    carte.
  - **Cartes** : `recipeCard` (`src/ui/components.js` l. 129, six appelants : recherche ×2, Mes livres, fiche du livre, plat, favoris de
    l'accueil) et les cartes d'éléments d'un repas (`renderMeal`, `src/ui/meals.js` l. 81) : une vignette quand `photo_sha256` a ses octets
    ICI, sinon RIEN (ni pictogramme, ni cadre).
  Coût si faux : un composant à dédoubler (une zone propre à la photo du plat) ; trois lignes par appelant de carte.
- **D-F3 Import web (lot B) : l'image de la page.** La fonction `lecture-web` rend EN PLUS `page.image_url` : première `image` du JSON-LD `Recipe`
  RETENU (le premier lisible, D-B25), sinon `<meta property="og:image">` **sauf quand la page porte d'autres recettes lisibles**
  (`autres_recettes > 0` : une page de liste, dont l'image de partage est celle d'une autre recette ou de la liste — 02 B7 « éviter les images
  d'autres recettes ») ; une adresse relative est résolue contre `page.url_finale` (règle d'URL, rien d'inventé) ; puis `valideAdresse` du lot B
  (`https:` seul, hôte public, ni IP, ni port, ni identifiants, ASCII visible, ≤ 2 048, hôte de `SUPABASE_URL` refusé) → `href` sans fragment, sinon
  `null` ; revalidée côté client à chaque lecture (`lirePage`, `adresseImageAdmise`, § 3.4). **Pourquoi la fonction, et non le navigateur** : la CSP
  `img-src 'self' blob: data:` interdit une balise `img` externe, mais `connect-src 'self' https:` (`index.html` l. 5, dos-d'âne assumé,
  `tests/ajouter.js` l. 1837) laisserait un `fetch()` atteindre un CDN qui répond en CORS ouvert ; ce qui exclut le chemin direct, c'est CORS pour la
  plupart des hôtes ET la promesse de § 1 : l'adresse IP de l'appareil ne part jamais chez l'hôte de l'image (test S-8, § 7.4). → **nouvel outil de la
  fonction `assistant` : `image-web`** : `{ url }` → la fonction télécharge par la MÊME boucle que `lecture-web` (`suivreRedirections`, extraite de
  `telechargerPage` du lot B : `https`, hôte public, 3 redirections revalidées, 15 s par saut, 30 s en tout, **corps compris**), accepte
  `image/jpeg | image/png | image/webp` ≤ **2 Mio** (R-F-4 ; `content-type`, corps lu en flux et coupé, puis **signature des premiers octets** égale
  au type annoncé), rend `{ type, taille, url_finale, octets }` (`octets` en base64) ou `{ erreur }` ; journal `outil = 'image-web'`, jetons `null`
  (aucun modèle, jamais : `OUTILS_MODELE`, § 6.2) ; **compte dans le quota** (réservation `assistant_reserver` AVANT tout téléchargement). La
  réservation BORNE ce relais pour les comptes admis (60 appels par jour, 2 Mio chacun, objets `https` publics qui ont une signature d'image) ; elle
  ne le ferme pas (§ 11). **Règles du site** (02 B7) : une copie privée, ré-encodée, pour la fiche de la personne ; jamais redistribuée (aucun export
  ne la porte, D-F5) ; la requête porte exactement les trois en-têtes de B (`user-agent` qui nomme Mitsu, `accept`, `accept-language`), aucun
  `referer`, `origin`, `cookie` ni jeton ; un refus du site (403 anti-hotlink, 404) est respecté (`inaccessible`), jamais contourné. La contrainte
  `check (outil in (…))` d'`assistant_journal` ne connaît que trois outils (`0004`) ; elle admettra `'image-web'` par la migration `0006` du lot B,
  qui porte les CINQ outils (R-F-1, § 6.4) : F n'écrit aucune migration. **Borne de 2 Mio** (R-F-4) : une réponse base64 de 6,7 Mio (la borne de 5 Mio
  du brief) n'a jamais été mesurée, ni sur le transfert mobile ni dans la mémoire de l'iPhone ; coût si faux : une image rare de plus de 2 Mio n'est
  pas récupérée (« non récupérée », raison définitive), la personne pose la sienne. Le client ré-encode (`preparerPhotoDistante`, § 3.4 : JPEG
  1 200 px, petit côté ≥ 200 px), écrit `files`, puis les trois champs de la photo ENSEMBLE sur la fiche relue (D-F18). **Échec SILENCIEUX pour le
  texte** : la recette est gardée telle que B l'a écrite ; la zone dit, discret, « Photo du plat non récupérée. », offre « Réessayer » (un appel, dit
  dessous) et « Ne pas récupérer » ; la raison n'est dite qu'après une tape, ou quand elle rend « Réessayer » inutile (D-F17). **Le rapatriement part
  sur « Enregistrer » de l'import web, APRÈS la transaction qui écrit la version, jamais avant** (§ 4.3), y compris sur « Ajouter sans remplacer »
  (comme la photo du plat sur « non » au lot A, I-5 : la photo n'est pas le texte ; défaut confirmé, R-F-2). Coût si faux : un outil de fonction et un
  module client de plus ; le texte lu ne dépend d'aucun d'eux.
- **D-F4 Suppression.** « Retirer » met `photo_sha256: null` ; la ligne `files` reste (orphelins = L5, règle du lot UX). **Précisions** :
  « Retirer » met aussi `photo_origin: null` et `photo_source_url: null` — sans quoi la zone redirait « non récupérée » après un retrait voulu ;
  et le cas 5 (rapatriement attendu, aucun pointeur) a sa sortie : **« Ne pas récupérer »** (même écriture, `retirerPhotoPlat`), parce que le
  composant ne rend « Retirer » qu'avec un pointeur (`livre-ajout.js` l. 250) — 02 B7 : « l'utilisateur peut changer l'association ou retirer
  l'image ». Coût si faux : une ligne ; un « Réessayer » payant à vie sur la fiche.
- **D-F5 Hors périmètre** : galerie, plusieurs photos, recadrage, image générée, photo pour une création IA, réutilisation d'une page source comme
  photo du plat (plus tard : « Utiliser cette page »), photo dans les exports (JSON-LD `image`, YAML, site lisible), photo dans le mode cuisine (§ 8).
  **Lecture retenue de « photo pour une création IA »** (confirmée, R-F-3) : l'app ne PRODUIT ni ne CHERCHE aucune image pour une création IA
  (`creer-ia.js` refuse toute clé `image`, `CLES_REFUSEES` ; une fiche `origine: 'ia'` n'a ni `source_url` ni `image_url`, donc aucun candidat) ; la
  personne peut poser SA photo du plat qu'elle a cuisiné sur une fiche IA comme sur toute fiche (la zone y est, D-F8 ; test § 7.4). **La récupération
  depuis une page PHOTOGRAPHIÉE** (04 § F « depuis une page web ou photographiée » ; 01 point 4 et 03 § 4 : proposition de récupération ou de
  recadrage, avec correction possible) est différée au **lot H** (futur, hors de la chaîne A à G, R-F-5) : elle demande un recadrage, hors du brief ;
  en attendant, la personne pose sa propre photo (« Photographier », « Choisir une image »). Coût si faux : une condition `origine !== 'ia'` (zone
  absente) ; un lot de recadrage.
- **D-F6 Aucun magasin neuf, aucune migration** (la contrainte `outil` vient de `0006` du lot B, à cinq outils : R-F-1, § 6.4) ; `DB_VERSION` 4
  inchangée (`photo_source_url` est une donnée JSON sans index) ; fonction redéployée par le chef d'orchestre avec sondes sans dépense (§ 6.5, § 10) ;
  `APP_VERSION` +1 mineure sur la tête du lot précédent : **0.15.0** si l'ordre tient (A 0.9.0 → B 0.10.0 → G 0.11.0 → C 0.12.0 → D 0.13.0 → E 0.14.0
  → F 0.15.0 ; sinon le numéro suivant libre) ; `sw.js` `VERSION` monotone `cuisine-os-v0.15.0-N`, incrémentée à chaque tâche qui touche `src/` ;
  `SHELL` + les trois modules neufs (`./src/domain/photo-web.js`, `./src/domain/base64.js`, `./src/ui/photo-plat.js`) dès la tâche qui les crée.

Décisions de l'auteur de la spec (soumises à la revue) :

- **D-F7 Un rapatriement par fiche à la fois, par document, HORS du vol partagé.** L'appel `image-web` est payé (quota) mais silencieux et court
  (≤ 30 s de téléchargement côté serveur, corps compris, plus le ré-encodage) : il ne prend PAS la variable de vol de `src/ui/vol.js` (lot B,
  D-B13 ; une personne qui enregistre une recette web puis en lit une autre ne doit pas voir « vol tenu » à cause d'une image). Il tient son
  propre ensemble `enVol` (clé `recipe_id`, module `src/ui/photo-plat.js`), posé AVANT tout `await` : un second rapatriement de la même fiche est
  refusé `vol_tenu` ; deux fiches différentes descendent en parallèle. « Annuler » n'existe pas (rien du texte n'en dépend ; quitter la fiche
  ne coupe pas la descente, bornée à 90 s côté client, D-F13). Coût si faux : deux appels payés pour deux fiches en même temps (le quota les
  compte ; l'écran ne les cache pas).
- **D-F8 La zone n'est rendue que sur une fiche qui a une version.** Elle se pose après `if (!version) { …; return root; }` (`recipe.js` l. 71) :
  une référence d'index sans texte garde son écran (« Importer cette recette » ; la photo du plat s'y pose par l'écran ciblé du lot A) ; un
  signet sans version garde `blocSignet` seul. Une fiche `origine: 'ia'` a une version : la zone y est (D-F5). L'en-tête (image, ou état du
  fichier de G) reste rendu pour toute fiche qui a une ligne `files` pour son pointeur. Coût si faux : une condition de rendu.
- **D-F9 La vignette d'une carte : 72 × 72 px, `object-fit: cover`, coins 8 px, bord `var(--line)`.** Dans `recipeCard`, premier enfant de la
  colonne de droite (`div.col`, l. 140), au-dessus des badges ; dans une carte de repas, à gauche du titre. La direction visuelle « grandes
  photos » des maquettes reste hors lot (D-9 du lot A) ; aucune couleur en dur (T-2), aucun `display: none` neuf (T-1 : l'inventaire des cinq
  d'origine, `tests/theme.js` l. 42 ; l'élément naît `hidden`, que `[hidden] { display: none !important }` cache déjà). Coût si faux : trois
  lignes de `styles.css` (point à trancher 2, § 13).
- **D-F10 Sur cet appareil, une photo CHOISIE par la personne n'est jamais remplacée par le web** (`photo_origin ∈ 'photo' | 'image'`, ou une
  origine `null`, avec un pointeur valide → `candidatPhotoWeb` rend `null` : aucun appel, aucune annonce) ; une photo venue du web (`'web'`) est
  remplaçable par une relecture dont l'image diffère ; une photo choisie sur la fiche EFFACE le candidat web (`poserPhotoPlat` écrit
  `photo_source_url: null`). L'écran ciblé du lot A n'a pas à l'effacer : il refuse toute fiche à `source_url` (`src/ui/import-cible.js` l. 208),
  et seul `fabriquerLectureWeb` (fiches web) pose un candidat ; `fabriquerExtraction` ne touche donc pas `photo_source_url`. Entre deux appareils,
  la synchronisation fait gagner l'écriture la plus récente (règle I7) : une fenêtre nommée en § 11. Coût si faux : une règle pure, une ligne.
- **D-F11 `photo_source_url` n'est jamais rendu à l'écran** (ni l'adresse, ni son hôte) : il sert à rapatrier et à dire « non récupérée ».
  **Attribution** (02 B7 « conserver son attribution/provenance disponible ») : une photo `'web'` porte la légende « Image de la page {hote} », où
  `hote` est RECALCULÉ depuis `recipe.source_url` par `lienSignet` (la page de la recette, dont l'hôte est déjà affiché sur la fiche, I-B5) —
  jamais depuis `photo_source_url` (l'hôte d'un CDN n'est pas une attribution, et une adresse hostile n'a ainsi aucune surface d'affichage) ;
  sans `source_url` valide : « Image de la page web ». « Ouvrir le lien » (fiche, lot B) ouvre la PAGE, jamais l'image. Coût si faux : un `small`
  de plus.
- **D-F12 Le mur d'une image DISTANTE est plus strict que celui d'une photo locale** (`preparerPhotoDistante`, § 3.4) : type annoncé ∈
  `COVER_INPUT_MIME` (jamais HEIC), en-tête LU par `dimensionsImage` et de MÊME type que l'annonce (règle de `recupererCouvertureParIsbn`,
  `livre-ajout.js` l. 207-209), petit côté ≥ **200 px** (`COTE_MIN_DISTANT` : une icône, un logo carré ou un pixel de suivi n'illustre pas un plat —
  02 B7), ≤ 16 Mpx, ≤ 5 Mio (`octetsDistants`, mur commun des images distantes ; l'image web y arrive déjà bornée à 2 Mio par le serveur et par
  `lireImageWeb`, R-F-4), puis ré-encodage. Un en-tête illisible refuse (`indecodable`) là où une photo locale HEIC passe au ré-encodage. Coût si
  faux : une image légitime à en-tête exotique, ou une vraie photo de moins de 200 px, refusée (la personne la pose à la main).
- **D-F13 La réponse `image-web` passe par `appelerAssistant` avec `corpsMax: 3 Mio` et `tentativeMs: 90 000`** (`LIMITES_PASSERELLE.corps`
  vaut 2 Mio, `src/domain/passerelle.js` l. 17 : une image à la borne de 2 Mio, R-F-4, fait 2 796 204 caractères de base64, plus une enveloppe
  JSON de moins de 4 Kio, `url_finale` ≤ 2 048 comprise : le défaut ne suffit pas ; 3 Mio laissent ≈ 340 Kio de marge). Le délai couvre la
  session, la liste admise, la réservation, jusqu'à 30 s de téléchargement, l'encodage, PUIS le transfert de la réponse vers le téléphone
  (`echanger` abandonne pendant `lireBornee`, l. 85) : ≈ 2,7 Mio prennent ≈ 15 s à 1,5 Mbit/s. 90 s reste sous le défaut de la passerelle (135 s,
  F-5) et sous l'idle de la plateforme (150 s). Coût si faux : deux constantes ; alternative nommée en § 11 (réponse binaire, nouveau chemin
  client).
- **D-F14 L'écran ciblé du lot A n'est pas touché.** `sectionPhoto` (`src/ui/import-cible.js` l. 449) garde ses libellés (« Prendre une photo »,
  « Choisir une image », « Remplacer », « Retirer »), son aperçu `data-role="apercu-plat"` et son pointeur sur `imports` ; F ne le fait pas
  déléguer à un composant commun (les tests du lot A, `tests/import-cible.js` l. 645-680, restent verts sans changement). La fiche, elle, parle
  comme la couverture (« Photographier », « Choisir une image », « Retirer ») : sur une photo en place, « Choisir une image » la REMPLACE (03 § 4
  « la remplacer ou la retirer » : pas de bouton « Remplacer » de plus) ; deux jeux de libellés pour la même photo, sur deux écrans différents.
  Coût si faux : unifier les libellés (un lot de texte, § 11).
- **D-F15 Le redessin après un geste est LOCAL** (l'emplacement de tête et la zone), jamais `refresh()` : la fiche garde ses portions, ses
  unités et sa langue de lecture (état local de `renderRecipe`, l. 44 : `state.units` et `state.lang` ne passent pas par l'adresse, et
  `setServings` ne l'écrit pas) — à la différence de la couverture, que `book.js` rafraîchit (la fiche d'un livre n'a pas d'état local). Le cache
  de `getData` est vidé par le `change` qu'émet `repo.save` (`src/ui/state.js` l. 12) : les cartes des autres écrans suivent au prochain rendu,
  sans `invalidate()` explicite. Coût si faux : `refresh()` à la place (une ligne), et les réglages de lecture perdus à chaque geste.
- **D-F16 Les deux écritures de la fiche qui partent d'une copie du RENDU ne défont plus une photo posée entre-temps.** Le rapatriement écrit la
  fiche en arrière-plan pendant que la fiche, ou l'éditeur, est ouvert : ★ Favori (`recipe.js` l. 48 : `{ ...recipe, favorite }`) réécrirait
  sinon le `photo_sha256: null` de sa copie, et « Corriger » (`recipe-edit.js` l. 270 : `{ ...targetRecipe }`, écrit après l. 285) aussi —
  scénario probable : « Enregistrer » d'une recette web, la fiche s'ouvre, ★ dans les 30 s. F corrige les deux, au plus juste : `favBtn` RELIT la
  fiche (`repo.get`, leçon C4) et n'écrit que `favorite` sur la fiche relue ; « Corriger » reprend `photo_sha256`, `photo_source_url` et
  `originePhotoAdmise(photo_origin)` (D-F19) de la fiche RELUE juste avant son écriture (l'éditeur ne les édite pas : la base fait foi), le reste
  de son écriture inchangé. Recensé à `bd03e48` : aucune autre écriture de `recipes` ne part d'une copie du rendu (`creation-ia.js`, `signet.js`,
  `import.js` fabriquent la leur ; `fabriquerExtraction` relit) ; **B, C, D et E ajoutent des écritures de `recipes`** : le recensement est REFAIT
  sur la tête du lot E, à la tâche 3 (★ Favori) et à la tâche 5 (« Corriger » et toute écriture neuve), et tout écrivain neuf qui part d'une copie
  est corrigé de même (amendement nommé en § 12). Coût si faux : deux lectures de plus ; sans elles, une photo web effacée par un geste voisin.
- **D-F17 L'état du rapatriement est DÉRIVÉ de la fiche, jamais écrit au journal ; ses raisons vivent dans le document.** « Récupération… »
  vient d'`enVol` (le document) ; « non récupérée » vient de la fiche (un `photo_source_url` admis sans pointeur valide = un rapatriement attendu) ;
  la raison du dernier échec vit dans une `Map` du document (`derniersEchecs`, clé `recipe_id`, avec l'adresse tentée), jamais en base. I-8 du lot
  A tient : `availability` et `verification_state` ne changent pas de vocabulaire, et aucun mot d'état (« échec », « en cours ») n'est stocké sur
  la fiche — `photo_source_url` est une DONNÉE (une adresse), pas un état. Le journal `imports` n'a qu'une ligne par import (`kind: 'web'`,
  `enregistre`) : y écrire l'état d'une image ajouterait du vocabulaire à `STATUTS_IMPORT` et des écritures conditionnées pour un bonus
  silencieux. Ce que cela coûte, nommé en § 11 : un second appareil voit « non récupérée » pendant que le premier descend encore ; un onglet fermé
  pendant la descente laisse « non récupérée » au retour (l'appel a pu être compté : la ligne de coût sous « Réessayer » le dit) ; la raison est
  perdue au rechargement (« Réessayer » revient, même après une raison définitive). Coût si faux : une ligne de journal par image.
- **D-F18 Le candidat voyage en ARGUMENT ; la provenance n'est écrite qu'avec la photo.** `enregistrerLecture` passe le candidat à
  `rapatrierPhotoWeb(recipeId, { candidat })`. La fabrication n'écrit `photo_source_url` QUE sur une fiche sans pointeur valide et quand la
  lecture remplace (`remplacer !== false`) : c'est le « rapatriement attendu » qui permet « Récupération… », « non récupérée » et « Réessayer ».
  Quand une photo `'web'` est en place (relecture dont l'image a changé) ou sur « Ajouter sans remplacer » (B-24 : aucun `put recipes`), la
  fabrication ne touche pas `photo_source_url` : la descente écrit `photo_sha256`, `photo_origin: 'web'` et `photo_source_url` ENSEMBLE, à la
  réussite, sinon rien. Ainsi, quand `photo_sha256` est posé avec `'web'`, `photo_source_url` est toujours la provenance de CETTE image (§ 3.1).
  La descente n'écrit que si les trois champs de la photo sont ceux qu'elle a lus au départ (garde des trois champs, § 4.3 point 3). Coût si
  faux : un paramètre et une comparaison.
- **D-F19 Une origine hors liste se lit `null` chez les fabricants qui RECOPIENT une fiche.** `photo_origin` entre dans le vocabulaire fermé
  (D-F1), alors que la réception et la restauration restent tolérantes (D-12 du lot A) : `fabriquerExtraction` (`reference.photo_origin ?? null`,
  `src/domain/import-cible.js` l. 116), « Corriger » (`{ ...targetRecipe }` puis `assertVocabulaire`, `recipe-edit.js` l. 270 et 285) et
  `fabriquerLectureWeb` (`{ ...signet }`, lot B) lèveraient `ErreurVocabulaire` sur une fiche reçue ou restaurée portant `'appareil'` ou une
  origine d'un appareil plus récent — et aucune vue ne traduit `ErreurVocabulaire` (`save()` de l'éditeur n'a pas de `try`). Ces trois
  recopies passent par **`originePhotoAdmise(v)`** (`src/domain/vocabulaire.js` : `PHOTO_ORIGINS.includes(v) ? v : null`) AVANT l'assertion ;
  la règle de lecture vaut pour l'origine SEULE : le pointeur et l'adresse sont déjà revalidés à chaque lecture (`HASH`, `adresseImageAdmise`),
  et réécrire le pointeur ferait rougir le lot A (`tests/import-cible.js` : une référence au pointeur `'ancienne'` le garde). Les fabricants qui
  créent leur fiche (`creation-ia.js`, `signet.js`, `import.js`) n'ont pas de photo. Coût si faux : une origine inconnue d'un appareil plus récent
  ramenée à `null` par un appareil plus ancien qui réécrit la fiche (§ 11).

## 1. Pour toi

Chaque recette peut avoir SA photo du plat. Sur la fiche, une section « Photo du plat » — la même que la couverture d'un livre — te laisse
photographier, choisir (ce qui remplace la photo en place) ou retirer ; la photo s'affiche en tête de la fiche. Quand tu gardes et lis une recette
du web, l'app essaie aussi de récupérer l'image que la page affiche, par le serveur et jamais depuis ton téléphone, juste après « Enregistrer » ;
l'écran te dit avant que c'est un appel de plus de ton quota du jour (60), sans jeton. Si l'image ne vient pas, la recette est là quand même, la
section le dit en une ligne, et tu choisis : « Réessayer » (un appel de plus, dit sous le bouton), poser ta propre photo, ou « Ne pas récupérer ».
Une image venue du web porte la mention « Image de la page » suivie du site de la recette. Dans tes listes (recherche, Mes livres, fiche d'un
livre, plats, favoris, repas), une petite vignette montre les plats dont tu as la photo ; sans photo, rien ne change. Sur ton appareil, une photo
que tu as choisie reste toujours la tienne : une image du web ne la remplace jamais.

## 2. Invariants

- **I-F1 Porte unique, relecture avant d'écrire.** Toute écriture passe par `repo` (`putFile`, `save`) ; toute pose ou tout retrait d'un pointeur
  sur `recipes` RELIT la fiche juste avant (`repo.get('recipes', id)`, leçon C4 du lot UX) — et AVANT `putFile` aussi : une fiche absente
  n'entraîne aucune ligne `files` neuve — puis n'écrit que ses trois champs (`photo_sha256`, `photo_origin`, `photo_source_url`) sur la fiche
  relue, après `assertVocabulaire(fiche, 'recipes')` : un titre, un favori ou une version changés entre le rendu et le geste survivent.
- **I-F2 Une image est une donnée hostile.** Bornes AVANT décodage (taille, type annoncé dans la liste, signature des premiers octets égale au
  type annoncé côté serveur, dimensions lues dans l'en-tête ≤ 16 Mpx et petit côté ≥ 200 px pour une image distante, type de l'en-tête égal au
  type annoncé), puis ré-encodage JPEG par canvas (le type est PROUVÉ par le décodage ; les métadonnées — dont la position GPS — disparaissent,
  et le nom du fichier sur l'appareil n'est pas gardé : `putFile(…, { mime: 'image/jpeg' })`). `photo_source_url` et `page.image_url` : `https:`
  seul, ASCII visible `[\x21-\x7e]`, ≤ 2 048 avant ET après `lienSignet` (qui retire les identifiants et peut allonger par encodage),
  `lienSignet(...).ok`, revalidés à CHAQUE lecture (serveur, `lirePage`, `candidatPhotoWeb`, `rapatrierPhotoWeb`) et comparés sous leur forme
  normalisée (`memeAdresseImage`). Un `photo_sha256` venu d'ailleurs (archive, serveur) n'est lu que s'il passe `HASH` (règle T4-R1-d du lot
  A) ; une `photo_origin` hors liste se lit `null` quand une fiche est recopiée (D-F19).
- **I-F3 CSP inchangée, aucune image externe, aucun appel direct.** `index.html` garde `img-src 'self' blob: data:` (épinglé, `tests/ajouter.js`
  l. 1844) ; aucun `src` d'image ne reçoit jamais une adresse `http(s)` : toute image affichée vient d'un blob LOCAL retypé par la règle
  d'affichage de G (`typeAffichage`, puis `displayUrl`) et posé par `urlDeBlob` (test de source sur `photo-plat.js`, `components.js`, `meals.js`).
  Les octets d'une image web entrent dans l'app par la fonction `assistant` SEULEMENT : pendant un rapatriement, le navigateur n'appelle que
  `/functions/v1/assistant` (D-F3 ; `connect-src 'self' https:` le permettrait, le code ne le fait pas : test S-8).
- **I-F4 Le texte ne dépend jamais de l'image.** La version, `availability`, `verification_state` et le journal `imports` d'une lecture web sont
  écrits AVANT le premier octet d'image ; un échec d'image n'écrit rien sur la version ni sur le journal (`enregistre` reste `enregistre`) et ne
  lève jamais vers l'écran (`logError` seulement). « Enregistrer » n'attend pas l'image.
- **I-F5 Sur cet appareil, jamais une photo de la personne écrasée par le web** (D-F10), y compris par une descente partie AVANT son geste (garde
  des trois champs de `rapatrierPhotoWeb`, § 4.3 point 3). La garde relit puis écrit DANS une transaction, par la condition `{ key, fusion }` de
`repo.saveBatch` (T3-R1, R-F-20 ; la spec écrivait : en deux
  transactions — les conditions de `db.mutate` lisent
  `status`, que `recipes` n'a pas) : la fenêtre d'un `await` reste, et entre deux appareils l'écriture la plus récente gagne (I7) — nommées en
  § 11.
- **I-F6 Rien d'inventé, rien de vide.** Une carte montre une vignette seulement quand les octets sont ici ; sans octets : rien. L'en-tête de la
  fiche ne rend rien quand aucune ligne `files` n'existe pour le pointeur (lot A : « pas même un cadre ») ; une ligne sans octets y montre l'état
  de G. La zone dit l'état vrai : « Récupération de la photo du plat… » pendant une descente (y compris le remplacement d'une photo web),
  « Photo du plat non récupérée. » quand un rapatriement attendu n'a pas abouti ; jamais « enregistrée » avant l'écriture (le toast suit
  `repo.save`) ; l'annonce de l'écran a_verifier dit un ESSAI, jamais un résultat.
- **I-F7 Un appel = compté et annoncé, partout où un geste le lance.** Un `image-web` est un appel du quota (réservation avant téléchargement).
  L'écran `a_verifier` annonce l'essai et son coût avant « Enregistrer » (§ 4.3 point 1) ; sous « Réessayer », `small.muted` « Un appel de plus,
  compté dans ton quota du jour. » ; un rapatriement par fiche à la fois par document (D-F7). Le départ automatique reste muet en cas d'échec
  (« non récupérée » seulement), sauf une raison définitive (l'image de cette page ne sera jamais utilisable), dite parce qu'elle retire
  « Réessayer » ; après une TAPE, la zone dit la raison (D-F17, § 4.1.2).
- **I-F8 Textes par `t()`** littéral, avec leur entrée dans `src/i18n/en.js` (filet `sansEntree` de `tests/creer-ia.js` l. 1227-1244 :
  `photo-plat.js` ajouté à ses `sources`, l. 1238) ; aucun texte ne nomme le fournisseur ni la base (test de source `Anthropic|Supabase` sur
  `photo-plat.js`, `photo-web.js` et `base64.js`).
- **I-F9 Les tests des lots précédents restent verts sans changement** : fiche du lot A (`tests/import-cible.js` l. 1293-1330 :
  `[data-role="photo-plat"] img` en `blob:`, `alt` « Photo du plat » ; rien sans ligne `files` ; rien pour un PDF ; aucun nœud texte direct,
  l. 1320 ; rien sur une recette saisie à la main) ; fabrication du lot A (l. 335-364, dont l. 360 : « aucune clé ajoutée à la fiche » — F n'ajoute
  aucune clé dans `fabriquerExtraction`) ; écran ciblé (l. 645-680) ; `renderZoneCouverture` (`tests/ajouter.js` l. 1212-1225) ; ceux de G (dont
  « photo du plat distante », plan G tâche 6) ; ceux de B (`tests/lecture-web.js`, `tools/*.test.mjs`), sauf les amendements NOMMÉS en § 7 : forme
  exacte de `page` en t2/t3 serveur ; formes exactes de `page` et de `resultat.page` côté client (`tests/lecture-web.js`, relevées à la tâche 2) ;
  forme du rendu de `fabriquerLectureWeb` (`photoWeb` en plus) si B l'épingle ; liste `OUTILS` ; liste d'ordre et comptes d'`index.ts`. Le test croisé
  de `0006`, écrit par B pour cinq outils avec `OUTILS` en préfixe (R-F-1, § 6.4), passe sans amendement. La suite est épinglée N−1
  (`tests/tests.js`), relevée à chaque tâche.
- **I-F10 L'état d'un fichier absent est dit en UN seul endroit de la fiche** : en tête, là où G le pose (§ 4.1.4) ; la zone ne le répète jamais.
- **I-F11 Aucun appel sans un geste qui l'a demandé.** Seuls « Enregistrer » d'une lecture web annoncée et « Réessayer » lancent `image-web` ;
  monter une fiche (reçue par la synchronisation, restaurée d'une archive, au cas 5) n'en lance AUCUN (test S-5, § 7.4).

## 3. Données

### 3.1 `recipes` (magasin inchangé, `DB_VERSION` 4)

| Champ | Forme | Posé par | Borne et règle |
|---|---|---|---|
| `photo_sha256` | `string \| null` (lot A) | zone de la fiche (`poserPhotoPlat`), écran ciblé (lot A : `imports.photo_sha256` → `fabriquerExtraction`), `rapatrierPhotoWeb` | pointeur souple vers `files` (hors `RELATIONS`, comme `cover_sha256`, `schema.js` l. 44) ; lu seulement s'il passe `HASH` ; une valeur hostile vaut « pas de photo » |
| `photo_origin` | `'photo' \| 'image' \| 'web' \| null` | mêmes poseurs | liste fermée **`PHOTO_ORIGINS = Object.freeze(['photo', 'image', 'web'])`** neuve dans `src/model/schema.js` ; `assertVocabulaire` la lit (`recipes.photo_origin`, `obligatoire: false` : `null` et absent tolérés ; `src/domain/vocabulaire.js` l. 22-25) ; `ORIGINES_PHOTO` de l'écran ciblé reste `['photo', 'image']` (D-F1) ; une valeur hors liste recopiée → `null` (`originePhotoAdmise`, D-F19) |
| `photo_source_url` | `string \| null` (NEUF) | `fabriquerLectureWeb` (lot B, amendé § 4.3 point 2 : fiche SANS pointeur valide, `remplacer !== false`) ; `rapatrierPhotoWeb` (avec la photo, D-F18) ; `null` par `poserPhotoPlat` et `retirerPhotoPlat` (« Retirer », « Ne pas récupérer ») | `https:` seul, ASCII visible, ≤ 2 048 avant et après `lienSignet`, `lienSignet(...).href` (identifiants retirés, D-T7) — **jamais rendu** (D-F11). Sens : avec `photo_sha256` valide et `photo_origin: 'web'` = la provenance de CETTE photo (toujours vraie, D-F18) ; sans `photo_sha256` valide = un rapatriement attendu (en cours ou échoué) ; avec une photo de la personne = sans effet (fiche reçue d'ailleurs) |

Une fiche d'avant le lot (sans ces champs) reste valide partout : champ absent = `null`. Les trois champs traversent « Corriger »
(`recipe-edit.js` l. 270 : `{ ...targetRecipe }` ; les trois champs repris de la fiche relue, D-F16) et ★ Favori (`recipe.js` l. 48, relu par F :
D-F16), la synchronisation (données JSON de la ligne `recipes`, aucune colonne générée : `TABLES.recipes`, `src/sync/tables.js`) et les archives
(`recipes` ∈ `ARCHIVE_DATA_STORES`). Le lot G lit `recipes.photo_sha256` dans `referencesFichiers` (G § 3.5) : les octets d'une photo du plat
voyagent comme ceux d'une couverture.

### 3.2 `imports` (magasin du lot A) : aucun champ neuf

`imports.photo_sha256` / `photo_origin` (lot A, photo posée sur l'écran ciblé) ne changent pas. Pour `kind: 'web'` (lot B), `resultat.page` gagne
**`image_url`** (§ 3.3), stocké tel que `lirePage` l'a revalidé et revalidé à chaque relecture ; rien d'autre. L'état d'un rapatriement n'y est
jamais écrit (D-F17).

### 3.3 La réponse `lecture-web` (lot B, § 3.5), amendée : `page.image_url`

| Champ | Serveur (borne à l'écriture) | Client (`lirePage`, `src/domain/lecture-web.js`) |
|---|---|---|
| `page.image_url` | `imageUrlDe(objetRecette, html, { urlFinale, hotesRefuses, autresRecettes })` (§ 6.1) : première `image` de l'objet JSON-LD `Recipe` RETENU (brut, celui dont `recetteDepuisJsonLd` a tiré la recette lisible), sinon `og:image` **si `autresRecettes === 0`** ; résolue contre `urlFinale` ; `valideAdresse` (B) → `href` sans fragment, sinon `null` | **`adresseImageAdmise(valeur)`** (§ 3.4) → `href` sinon `null` — PAS `borner` (une adresse tronquée n'est pas une adresse) ; stockée dans `resultat.page.image_url` ; jamais rendue (D-F11) |

Le test de source du lot B « chaque champ de `page` passe par `borner` dans `lirePage` » (B § 7.4, les sept lectures nommées) reste vrai pour ses
sept champs ; F y ajoute « et `image_url` passe par `adresseImageAdmise(` ».

### 3.4 Domaine client : `src/domain/photo-web.js` (neuf, pur sauf `lireImageWeb`), `src/domain/base64.js` (neuf, pur, sans import), `src/core/image.js` et `src/domain/vocabulaire.js` (amendés)

- **`HASH`** (`src/model/schema.js`, exporté, `/^[0-9a-f]{64}$/`) ; **`originePhotoAdmise(v)`** (`vocabulaire.js`) → `v` si `PHOTO_ORIGINS.includes(v)`,
  sinon `null` (D-F19).
- **`LIMITES_IMAGE_WEB`** (`photo-web.js`, `Object.freeze`) : `{ url: 2048, octets: 2 * 1024 * 1024, corpsReponse: 3 * 1024 * 1024,
  tentativeMs: 90000, types: COVER_INPUT_MIME }` (R-F-4, D-F13). Épinglés par un test : `octets` égal au littéral 2 097 152 (le même que
  `LIMITES_IMAGE.octets` du serveur, épinglé de même par le test Node, § 7.1 : les deux suites ne partagent aucun module), et `octets` ≤
  `LIMITES_COUVERTURE.octetsDistants` (5 Mio, `src/core/image.js` l. 15 : le mur de `preparerPhotoDistante` ne reçoit jamais plus que ce que
  `lireImageWeb` admet) ; `corpsReponse` ≥ `4 * Math.ceil(octets / 3) + 4096` (le base64 d'une image à la borne et son enveloppe).
- **`adresseImageAdmise(valeur)`** → `string | null`, ne lève jamais : `typeof valeur === 'string'` ; `/^[\x21-\x7e]+$/` ; longueur ≤ 2 048 ;
  `l = lienSignet(valeur)` (`src/core/lien.js` l. 9) avec `l.ok` ; `new URL(l.href).protocol === 'https:'` ; **`l.href` encore ASCII visible et
  ≤ 2 048** (la normalisation d'`URL` encode `"`, `<`, `>`, `` ` ``, `{`, `}` dans le chemin et peut allonger : un `href` qui dépasse serait refusé
  `interdit` par le serveur, échec permanent) ; rend `l.href` (identifiants retirés) ; tout autre cas `null`.
- **`memeAdresseImage(a, b)`** → booléen : `x = adresseImageAdmise(a)` ; `x !== null && x === adresseImageAdmise(b)`. UNE fonction pour toute
  comparaison d'adresses d'image (candidat, garde des trois champs, raisons gardées) : une valeur reçue sous une autre forme (`HTTPS://A.TEST:443/
  i.jpg`) est la même adresse.
- **`candidatPhotoWeb(fiche, imageUrl)`** → `string | null` (pure, D-F10) : `href = adresseImageAdmise(imageUrl)` ; nul → `null` ;
  `photo = HASH.test(fiche?.photo_sha256)` ; `photo && fiche.photo_origin !== 'web'` (photo de la personne, ou origine inconnue) → `null` ;
  `photo && memeAdresseImage(fiche.photo_source_url, href)` (déjà cette image) → `null` ; sinon `href`.
- **`lireImageWeb({ url, session }, { fetch, signal, tentativeMs = LIMITES_IMAGE_WEB.tentativeMs } = {})`** → `{ etat: 'recue', blob, urlFinale } |
  { etat: 'echec', raison, extra }`, ne lève jamais (toute exception → `echec(interne)`) :
  1. `href = adresseImageAdmise(url)` ; nul → `{ etat: 'echec', raison: 'adresse', extra: {} }`, zéro appel ;
  2. `r = await appelerAssistant('image-web', { url: href }, { fetch, session, signal, tentativeMs, corpsMax: LIMITES_IMAGE_WEB.corpsReponse })` ;
  3. `r.raison` non nul → `{ etat: 'echec', ...echecDomaine(r) }` (`pas_une_image`, `image_trop_lourde`, `interdit`, `inaccessible` relayées telles
     quelles : § 4.6) ;
  4. 200 : `c = r.corps`, chaque champ lu par `Object.hasOwn` ; `type` ∈ `LIMITES_IMAGE_WEB.types` sinon `illisible` ; `taille` entier sûr ≥ 1 sinon
     `illisible` ; `taille > LIMITES_IMAGE_WEB.octets` → `image_trop_lourde` (avant tout décodage) ; `u8 = lireOctetsBase64(c.octets, taille)`
     (`base64.js`) ; `null` → `illisible` ; `blob = new Blob([u8], { type })` ; `urlFinale = adresseImageAdmise(c.url_finale)` (informative, jamais
     écrite ni rendue).
  Le jeton n'entre dans aucun objet rendu (balayage `JSON.stringify`, § 7.4). Le seul `fetch` est celui d'`appelerAssistant` (I-F3).
- **`lireOctetsBase64(texte, taille)`** (`src/domain/base64.js`, module feuille SANS import, importable par la suite navigateur ET par Node) →
  `Uint8Array | null`, ne lève jamais : chaîne ; `/^[A-Za-z0-9+/]*={0,2}$/` ; longueur EXACTE `4 * Math.ceil(taille / 3)` (base64 avec
  remplissage) ; `atob` (une exception → `null`) → `Uint8Array` ; longueur décodée ≠ `taille` → `null`. C'est la règle de lecture que le test Node
  chaîne à la sortie de `versBase64` du serveur (§ 7.1).
- **`preparerPhotoDistante(blob, { coteMin = COTE_MIN_DISTANT } = {})`** (`src/core/image.js`, à côté de `preparerPhotoLocale` l. 82, D-F12 ;
  `export const COTE_MIN_DISTANT = 200`), lève `ErreurImage` : `!(blob instanceof Blob)` → `indecodable` ; `blob.size >
  LIMITES_COUVERTURE.octetsDistants` → `trop_lourde` ; `!COVER_INPUT_MIME.includes(blob.type)` → `type` ; `dims = await dimensionsImage(blob)` ;
  `!dims || dims.type !== blob.type` → `indecodable` ; `Math.min(dims.largeur, dims.hauteur) < coteMin` → **`trop_petite`** ; `dims.largeur *
  dims.hauteur > LIMITES_COUVERTURE.pixels` → `trop_grande` ; puis `reduireImage(blob)` (JPEG 1 200 px, qualité 0,85). Rend le Blob JPEG ; n'écrit
  rien. `poserCouverture(…, { origine: 'distante' })` n'est PAS touchée (sa borne de pixels vit déjà dans `recupererCouvertureParIsbn`) ;
  l'unification est nommée en § 11.
- **`RAISONS_PHOTO_WEB`** (`photo-web.js`, liste fermée gelée, pour `logError` et les tests) : `['adresse', 'fiche_absente', 'fiche_changee',
  'photo_manuelle', 'deja_la', 'vol_tenu', 'hors_ligne', 'non_connecte', 'non_admis', 'quota', 'trop_de_demandes', 'requete', 'serveur', 'delai',
  'reseau', 'interne', 'reponse_illisible', 'annule', 'interdit', 'inaccessible', 'pas_une_image', 'image_trop_lourde', 'illisible', 'type',
  'trop_petite', 'trop_grande', 'indecodable', 'trop_lourde', 'ecriture']`. Toute raison rendue par `lireImageWeb` et `rapatrierPhotoWeb` y
  figure (test : un balayage des issues de § 7.4).
- **`RAISONS_DEFINITIVES`** (`photo-web.js`, gelée) : `['interdit', 'pas_une_image', 'image_trop_lourde', 'type', 'trop_petite', 'trop_grande',
  'indecodable', 'trop_lourde']` — l'image de CETTE adresse ne sera jamais utilisable : « Réessayer » n'est plus offert pour elle (D-F17).

### 3.5 La réponse 200 de `image-web` (serveur → client)

```
{ type: 'image/jpeg' | 'image/png' | 'image/webp',   // le content-type reçu, sans paramètres, en minuscules ; égal à la signature des octets
  taille: <entier : octets reçus, 1..2 097 152 (R-F-4)>,
  url_finale: <adresse après redirections, ≤ 2 048>,
  octets: <base64 des octets reçus, avec remplissage, par versBase64> }   // 4 × ceil(taille / 3) caractères ; enveloppe JSON < 3 Mio
```
Refus typés `{ erreur }` : `interdit` 422 (adresse envoyée : AVANT réservation ; cible d'une redirection : après), `inaccessible` 502 (DNS, délai
d'un saut ou des 30 s — corps compris —, statut ≥ 400 ou hors 2xx / 3xx, redirections dépassées, `location` absente ou illisible),
`pas_une_image` 422 (`content-type` hors liste, corps de 0 octet, ou signature des premiers octets différente du type annoncé : le corps n'est
pas relayé), `image_trop_lourde` 413 (`content-length` annoncé ou flux > 2 Mio), `delai` 504 (budget de 120 s épuisé, y compris pendant la
lecture du corps), plus les refus existants (401 / 403 / 429 / 413 `trop_lourd` / 400 / 422 `bornes`). Journal : statut rendu, `jetons_entree`
/ `jetons_sortie` `null` (`usage` nul), `octets` = taille de la DEMANDE (posée à la réservation, `p_octets: bytes.byteLength`), 499 si le client
est parti.

## 4. Parcours

### 4.1 Fiche recette (`src/ui/recipe.js`) : l'en-tête, la zone « Photo du plat »

#### 4.1.1 Montage

`renderRecipe(params, query, ctx, deps = {})` gagne un quatrième paramètre, transmis tel quel au module de la photo (`app.js` ne change pas :
`route('/recipes/:id', renderRecipe)` appelle avec trois arguments, les défauts valent la production ; le test G appelle aussi avec trois) :
`deps = { repo = repoModule, pickFiles = pickDom, toast = toastDom, fetch = undefined, enLigne = () => enLigneFlag }` (motif de
`renderImportCible`, `import-cible.js` l. 196 ; `enLigneFlag` est tenu par `photo-plat.js` sur `online` / `offline`, comme `import-cible.js`
l. 38-41). Le reste de `recipe.js` garde son `import * as repo`.

- l. 68-69 (`const photo = await photoDuPlat(recipe); if (photo) root.append(photo);`, qui devient avec G `photoDuPlat(recipe, ctxF)` après `const
  ctxF = await contexteFichiers(ctx)`) devient `const photo = await monterPhotoPlat(recipe, ctx, { ...deps, ctxF }); root.append(photo.entete);`
  (même place : après la rangée des badges et le bandeau de lecture, avant `if (!version)` ; `photo.entete` est un `div`, jamais `null` : la règle
  « aucun nœud texte direct » du lot A, l. 1320, tient). `photoDuPlat` quitte `recipe.js` : c'est **`figurePhotoPlat(recipe, { repo, ctxF })`** de
  `photo-plat.js` — le code de G déplacé tel quel (même balisage `figure.photo-plat[data-role="photo-plat"]`, `style.margin '0 0 .8rem'`, `img`
  `alt` « Photo du plat », `loading: 'lazy'`, 320 px, `maxWidth: '100%'`, coins `var(--radius)` ; aucune ligne `files` → `null` ; octets d'un type
  que `typeAffichage` ne rend pas `image/` → `null` ; ligne sans octets → la `vignettePage` de G et son « Télécharger », redessinée sur place par
  le geste de G), avec deux différences : le pointeur doit passer `HASH` (un **resserrement** : le lot A testait une chaîne non vide ; toutes ses
  fixtures et celles de G sont des empreintes de 64 chiffres hexadécimaux), et, quand l'image est rendue et que `photo_origin === 'web'`, la
  légende `figcaption.muted[data-role="legende-photo-plat"]` « Image de la page {hote} » (`hote` = `lienSignet(recipe.source_url).hote` si `ok`,
  sinon « Image de la page web », D-F11). L'appelant n'insère jamais `null`. **Si le code de G diffère de son plan à la tâche 3** (§ 9), la règle
  reste : l'état d'un fichier absent vit EN TÊTE, là où G l'a posé, et la zone ne le répète pas (I-F10) ; l'écart est un amendement nommé en § 12.
- après `drawBody()` (l. 119) et avant « Pages originales » (l. 121) : `root.append(photo.zone)`. Atteint seulement quand la fiche a une version
  (D-F8) ; sans version, `photo.zone` n'est jamais insérée (et sa vue est purgée au premier `notifier()`).

**`monterPhotoPlat(recipe, ctx, deps)`** (exportée, `photo-plat.js`) → `Promise<{ entete, zone, gestes }>` (`gestes` est rendu pour les tests :
`photographier`, `choisir`, `retirer`, `reessayer`, `abandonner`) :
- `entete = el('div', { dataset: { role: 'emplacement-photo-plat' } })` (sans style : vide, il n'occupe rien — I-F6) ;
- `zone = section(t('Photo du plat'), conteneur)` où `conteneur = el('div', { dataset: { role: 'zone-photo-plat' } })` (`section` :
  `components.js` l. 22, une `section.card` avec son `h2`) ;
- état local : `occupe` (un geste écrit), `connecte = !!ctx?.sync?.user` (le jeton lui-même n'est lu qu'au geste, par `sessionAssistant`) ;
- **`dessiner()`** : `relue = (await repo.get('recipes', recipe.id)) || recipe` ; `sha = HASH.test(relue.photo_sha256) ? relue.photo_sha256 :
  null` ; `fichier = sha ? await repo.getFile(sha) : null` (une exception vaut `null`) ; `present` = `typeAffichage(fichier)` commence par
  `image/` (la règle d'affichage de G, une seule : le type du blob gagne s'il est dans la liste blanche) ; `etat = etatZonePlat(relue, { present,
  enVol: recuperationEnCours(relue.id), enLigne: enLigne(), connecte, occupe, echec: derniersEchecs.get(relue.id) ?? null })` ; les URL `blob:`
  des `img` de `entete` et de `conteneur` sont relevées, les deux nœuds remplacés (`entete.replaceChildren(...[await figurePhotoPlat(relue, { repo,
  ctxF })].filter(Boolean))`, `conteneur.replaceChildren(renderZonePhotoPlat(etat, gestes))`), puis les anciennes URL révoquées par
  `revoquerUrlDeBlob` (D-T9 : APRÈS le remplacement) ;
- **monter ne lance AUCUN appel** (I-F11) : ni `rapatrierPhotoWeb`, ni `lireImageWeb` ; seul un geste le fait ;
- vue enregistrée dans `vues` (`{ root: zone, recipeId, redessiner: dessiner }`) ; `notifier(recipeId)` redessine les vues de cette fiche et
  écarte celles dont `root.isConnected` est faux ; même garde que `import-cible.js` l. 542 : `setTimeout(() => { if (zone.isConnected &&
  !vues.has(vue)) { vues.add(vue); dessiner(); } }, 0)` (une descente finie entre le montage et l'insertion par le routeur n'est jamais perdue) ;
  `online` / `offline` → `dessiner()` des vues montées (le bouton « Réessayer » suit) ;
- `reinitialiserPhotoPlat()` (tests seulement) : `enVol` vidé, `vues` vidées, `derniersEchecs` vidée, `enLigneFlag` relu.

#### 4.1.2 États de la zone (`etatZonePlat(recipe, { present, enVol, enLigne, connecte, occupe, echec })`, pure sauf `t()`, exportée, testée)

Calculs : `sha` = le pointeur s'il passe `HASH`, sinon `null` ; `candidat = !sha ? adresseImageAdmise(recipe.photo_source_url) : null` ;
`echecVu = echec && candidat && memeAdresseImage(echec.url, candidat) ? echec : null` (une raison ne vaut que pour l'adresse tentée) ;
`definitif = !!echecVu && RAISONS_DEFINITIVES.includes(echecVu.raison)` ; `web = enVol ? 'en_cours' : candidat ? 'echouee' : null`.

| Cas | Condition | `etat` rendu | Ce que la zone montre |
|---|---|---|---|
| 1 | aucun pointeur valide, aucun candidat, pas en vol | `{ sha256: null, message: t('Ajoute une photo du plat : elle illustre la recette dans tes listes.'), web: null }` | le message ; « Photographier », « Choisir une image » |
| 2 | pointeur valide, octets ici | `{ sha256, message: null, web: enVol ? 'en_cours' : null }` | « Photographier », « Choisir une image », « Retirer » (l'image est EN TÊTE ; la zone ne la répète pas : `apercu: null`) ; pendant le remplacement d'une photo web, la ligne « Récupération… » du cas 4 dessous |
| 3 | pointeur valide, octets absents ou non affichables | `{ sha256, message: null, web: …, absente: true }` | comme le cas 2 ; l'état du fichier est EN TÊTE (G, § 4.1.4), jamais ici |
| 4 | aucun pointeur valide, en vol (avec ou sans candidat écrit : « Ajouter sans remplacer » descend sans candidat écrit, D-F18) | `{ sha256: null, message: null, web: 'en_cours' }` | « Photographier », « Choisir une image », ALLUMÉS (une photo choisie pendant la descente gagne : I-F5) ; dessous, `p.status[role="status"][data-role="photo-web-etat"]` « Récupération de la photo du plat… » |
| 5 | candidat, pas en vol | `{ sha256: null, message: null, web: 'echouee', raison, offreReessayer: !definitif, peutReessayer: !definitif && enLigne && connecte }` | « Photographier », « Choisir une image » ; dessous, `div.stack[data-role="photo-web-etat"]` : `small.muted` « Photo du plat non récupérée. » ; si `raison`, `small.muted[data-role="raison-photo-web"]` ; si `offreReessayer`, une rangée `div.row` : `button.btn[data-role="reessayer-photo"]` « Réessayer » (`disabled: !peutReessayer`), `small.muted[data-role="cout-photo-web"]` « Un appel de plus, compté dans ton quota du jour. », et, si éteint, « Tu es hors ligne. » (hors ligne) ou « Connecte-toi pour utiliser l’assistant. » (sans compte) — jamais quand `raison` dit déjà ce texte ; enfin `button.btn.link[data-role="abandonner-photo-web"]` « Ne pas récupérer » |
| 6 | pointeur hostile (ne passe pas `HASH`) | comme « aucun pointeur » (cas 1, 4 ou 5) | rien n'est écrit pour le corriger |

**`raison`** (cas 5) : `echecVu && (echecVu.tape || definitif) ? texteEchecPhotoWeb(echecVu) : null` — muette après le départ automatique (D-F3),
dite après une TAPE (« Réessayer »), et dite dans tous les cas quand elle est définitive (elle change ce que la zone offre). **`texteEchecPhotoWeb({
raison, extra })`** (exportée, `photo-plat.js`, textes existants d'abord) :

| Raison | Texte |
|---|---|
| `quota`, `non_admis` | `texteRefusAssistant({ raison, quota: extra.quota })` (`components.js` l. 317 : « Tu as atteint la limite du jour pour l’assistant ({n} appels). », « Ce compte n’a pas accès à l’assistant. ») |
| `non_connecte` | « Connecte-toi pour utiliser l’assistant. » |
| `trop_de_demandes` | « Trop de demandes pour l’instant. Réessaie dans une minute. » |
| `delai`, `reseau`, `annule` | « L’appel a peut-être été compté ; relancer en coûtera un autre. » (I-4 du lot A, I-B7) |
| `inaccessible` | **« Le site de la page n’a pas donné son image. »** (neuf) |
| `RAISONS_DEFINITIVES` | **« L’image de cette page ne peut pas être utilisée. »** (neuf ; « Réessayer » retiré) |
| `ecriture` | « La photo du plat n’a pas pu être changée. Réessaie. » |
| toute autre (`serveur`, `interne`, `reponse_illisible`, `requete`, `illisible`) | `texteEchecAssistant({ message: raison })` (« L’assistant n’a pas répondu. Réessaie. Code : {c} ») |
| refus avant l'appel (`adresse`, `fiche_absente`, `fiche_changee`, `photo_manuelle`, `deja_la`, `vol_tenu`, `hors_ligne`) | `null` : l'état de la zone le dit déjà, ou c'est le geste de la personne |

Dans tous les cas `enCours = occupe` : pendant une écriture, les boutons du composant sont éteints (règle F9 / RF-m4 de la couverture), ainsi que
« Réessayer » et « Ne pas récupérer ».

**Rendu** (`renderZonePhotoPlat(etat, gestes)`, exportée) : `renderZoneCouverture({ sha256: etat.sha256, apercu: null, message: etat.message,
enCours: etat.enCours }, { photographier: gestes.photographier, choisir: gestes.choisir, retirer: gestes.retirer }, { libelle: t('Photo du
plat'), nomRetirer: t('Retirer la photo du plat') })` (structure du composant : `div.field.zone-couverture` > `span` libellé, `.row` > `.stack` >
`small.muted` message, `.row` de boutons ; R-UX-8 : aucun `<label>`), puis, si `etat.web`, la ligne web du tableau. **`renderZoneCouverture`
amendée** (`livre-ajout.js` l. 240) : `renderZoneCouverture(etat, gestes = {}, { libelle = null, nomRetirer = null } = {})` rend `el('span', null,
libelle ?? t('Couverture'))` et pose `'aria-label': nomRetirer` sur « Retirer » quand `nomRetirer` est donné (03 § 6 : un bouton de suppression
a un nom accessible explicite) ; rien d'autre ne change (la fiche du livre l'appelle à deux arguments : son « Retirer » reste sans
`aria-label`, dette nommée en § 11). « Réessayer » est un `.btn` (≥ 44 px, T-4 et 03 § 6), « Ne pas récupérer » un `.btn.link` (≥ 44 px).

#### 4.1.3 Gestes (`src/ui/photo-plat.js`, tous `async`, `occupe = true` pendant l'écriture, puis `dessiner()` — jamais `refresh()`, D-F15)

- **« Photographier »** → `pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' })` → `poserPhotoPlat(recipe.id, fichiers[0], {
  repo, origin: 'photo' })` ; **« Choisir une image »** → `pickFiles({ accept: 'image/*', multiple: false })` → `origin: 'image'`. Aucun fichier
  choisi → rien (ni écriture, ni toast). Garde : `if (occupe) return` AVANT `pickFiles`, mais `occupe = true` seulement APRÈS le choix (le motif
  d'`import-cible.js` l. 288-292 ; `book.js` n'a pas cette garde) : `pickFiles` ne se résout jamais sur une annulation (`dom.js` l. 112-119), poser
  `occupe` avant figerait la zone.
- **`poserPhotoPlat(recipeId, file, { repo, origin })`** (exportée) → `{ issue: 'ok', sha256 } | { issue: 'refuse', raison: 'image', code } |
  { issue: 'refuse', raison: 'fiche_absente' } | { issue: 'echec', raison: 'ecriture' }`, ne lève jamais (sauf `origin` hors `['photo',
  'image']` : `TypeError`, erreur de programmation) :
  1. `jpeg = await preparerPhotoLocale(file)` — `ErreurImage` → `refuse(image, e.code)`, rien d'écrit ;
  2. `courante = await repo.get('recipes', recipeId)` — absente → `refuse(fiche_absente)`, rien d'écrit (aucune ligne `files` neuve, I-F1) ;
  3. `sha = await sha256Hex(jpeg)` ; `await repo.putFile(sha, jpeg, { mime: 'image/jpeg' })` (comme la couverture et le rapatriement : le nom du
     fichier sur l'appareil n'est pas gardé, I-F2) ;
  4. `courante = await repo.get('recipes', recipeId)` (relue encore, C4) — absente → `refuse(fiche_absente)` (la ligne `files` reste : orphelin
     L5) ;
  5. `fiche = { ...courante, photo_sha256: sha, photo_origin: origin, photo_source_url: null }` (D-F10 : le candidat web tombe) ;
     `assertVocabulaire(fiche, 'recipes')` ; `await repo.save('recipes', fiche)` ; `derniersEchecs.delete(recipeId)` ; `ok`.
  Une exception aux étapes 2-5 → `echec(ecriture)` et `logError('photo_plat.pose', { error, id })`.
  Le contrôleur dit : `ok` → toast « Photo du plat enregistrée. » ; `refuse(image)` → toast `messageErreurImage({ code })` (textes existants,
  `livre-ajout.js` l. 232-236) ; `refuse(fiche_absente)` → toast « Recette introuvable. » ; `echec` → toast « La photo du plat n’a pas pu être
  changée. Réessaie. ». Dans tous les cas, `dessiner()` redit l'état RELU.
- **« Retirer »** et **« Ne pas récupérer »** → **`retirerPhotoPlat(recipeId, { repo })`** (exportée) → `{ issue: 'ok' } | { issue: 'refuse',
  raison: 'fiche_absente' } | { issue: 'echec', raison: 'ecriture' }` : relit ; `repo.save('recipes', { ...courante, photo_sha256: null,
  photo_origin: null, photo_source_url: null })` (D-F4) ; `derniersEchecs.delete(recipeId)` ; la ligne `files` reste. Toasts de « Retirer » :
  « Photo du plat retirée. » ; « Recette introuvable. » ; « La photo du plat n’a pas pu être changée. Réessaie. ». « Ne pas récupérer » : aucun
  toast sur `ok` (la ligne disparaît, la zone revient au cas 1 : le fait suffit), les deux mêmes toasts sur un refus ou un échec. Aucun appel.
- **« Réessayer »** → `rapatrierPhotoWeb(recipe.id, { tape: true, ctx, repo, fetch, enLigne })` (§ 4.3, point 3), sans `await` dans le
  gestionnaire : `enVol` est posé avant tout `await`, la zone passe en cas 4 tout de suite (`notifier`), puis se redessine à la fin. Aucun toast :
  la raison, s'il y en a une, est dite dans la zone (cas 5).

#### 4.1.4 Pointeur sans octets (cas 3) : l'état du fichier vit EN TÊTE (lot G), en UN seul endroit (I-F10)

Branche TRANCHÉE (rév. 1 : deux branches laissées ouvertes) : G § 4.4 dit que la photo du plat « suit la règle de la couverture (§ 4.2) là où le lot
A l'affiche », et le plan G rév. 1 (tâche 6) l'écrit : `photoDuPlat(recipe, ctxF)` rend, dans `figure.photo-plat`, soit l'image, soit
`vignettePage({ id: 'photo', sha256 }, fichier, { ...ctxF, telecharger })` (« Pas encore sur cet appareil » + « Télécharger » quand le fichier est
`distant` et le compte là ; « Connecte-toi pour la télécharger » ; « Pas encore envoyée par l’appareil qui l’a prise » ; « Fichier illisible reçu
du serveur. » + « Réessayer »), redessinée sur place après le téléchargement (`gesteTelechargement` de G : `invalidate()` puis le redessin de la
figure, jamais `refresh()`). F garde cette place : `figurePhotoPlat` EST ce code (§ 4.1.1), alimenté par le `ctxF` de G (`contexteFichiers(ctx)` :
`connecte`, `uid`, `erreurs`, `moteur`) que `recipe.js` calcule déjà et transmet à `monterPhotoPlat`. La zone, au cas 3, ne rend ni message ni
« Télécharger » (`message: null`) : elle n'a donc besoin ni d'`etatFichier` ni du moteur. Une fiche SANS version (D-F8 : pas de zone) garde
l'état en tête. Aucun texte neuf : ceux de G. Après un téléchargement réussi, la figure de G pose l'image ; la zone (cas 3 → cas 2) a les mêmes
boutons et n'a pas à être redessinée. La légende est calculée DANS la fonction de redessin de la figure (celle que le geste de G rappelle après
un téléchargement) : elle suit l'image, sans geste de F.

### 4.2 Cartes illustrées

- **`vignettePlat(recipe, { repo = repoModule } = {})`** (exportée, `src/ui/components.js`) → `img.plat-vignette` ou `null` : `recipe?.photo_sha256`
  ne passe pas `HASH` → `null` ; sinon `img = el('img', { class: 'plat-vignette', alt: '', loading: 'lazy', hidden: true })` (décorative : la carte
  porte le titre ; née cachée, `[hidden]` du thème) ; puis `repo.getFile(sha).then((f) => { if (!typeAffichage(f)?.startsWith('image/')) return;
  const u = displayUrl(f, urlDeBlob); if (!u) return; img.src = u; img.hidden = false; }).catch(() => {})` (la règle d'affichage de G en une seule
  copie : `typeAffichage` choisit le type, `displayUrl` retype le blob). Sans octets ici : l'élément reste caché, sans `src` (I-F6).
- **`recipeCard(doc, …)`** (l. 129) : `vignettePlat(recipe)` devient le PREMIER enfant de la colonne de droite (`el('div', { class: 'col', … })`,
  l. 140), au-dessus d'`availabilityBadge`. Sans `photo_sha256` valide, `vignettePlat` rend `null` (que `el` ignore) : la carte est octet pour
  octet celle d'aujourd'hui. Les six appelants (`search.js` l. 152 et 162, `book.js` (dans `drawList`), `dish.js` l. 51, `home.js` l. 40,
  `library.js` l. 33 pour « Liens web gardés » et « Recettes créées avec l'IA ») héritent sans changer leur appel.
- **Carte d'un élément de repas** (`renderMeal`, `src/ui/meals.js` l. 81-95) : `v = vignettePlat(it.recipe)` ; le bloc de gauche (l. 83, `el('div',
  null, lien du titre, badge, source)`) est enveloppé dans `el('div', { class: 'row top', style: { flex: '1', minWidth: '0' } }, v, bloc)` SEULEMENT
  quand `v` est non nul (sans photo, le DOM est celui d'aujourd'hui). `renderMeals` (la liste des repas) ne change pas : elle ne montre pas de
  recettes.
- **`styles.css`** : `.plat-vignette { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line); flex: 0 0
  auto; }` (D-F9 ; `--line` existe dans `:root`).
- **Révocation entre deux redessins d'une même route** (règle D-T9 de `library.js` l. 76-82) : **`urlsDesVignettes(conteneur)`** (exportée :
  `[...conteneur.querySelectorAll('img.plat-vignette')].map((i) => i.getAttribute('src')).filter((u) => typeof u === 'string' &&
  u.startsWith('blob:'))`) est relevée AVANT le vidage, puis chaque URL révoquée par `revoquerUrlDeBlob` APRÈS (`replaceChildren()` les a
  détachées) — dans `search.js` `render()` (`results.replaceChildren()`, l. 122) et `book.js` `drawList()` (`list.replaceChildren()`, le filtre
  redessine à chaque touche). `dish.js` n'en a pas besoin : son `drawList()` n'est appelé qu'une fois par route (l. 92). `library.js`, `home.js`,
  `dish.js` et `renderMeal` rendent une fois par route : `app.js` révoque tout au changement de vue (l. 80). Une vignette dont l'octet arrive
  après un redessin garde son URL jusqu'au prochain changement de route (borne assumée, § 11).
- Coût : une lecture `files` par carte (≤ 50 en recherche, une transaction chacune) ; `repo.getFiles` (lecture groupée, `repo.js` l. 402, déjà
  employée par `library.js` l. 57) est le remède nommé en § 11 si l'iPhone peine.

### 4.3 Import web (lot B) : l'image de la page

1. **Écran `a_verifier`** (`src/ui/import-web.js`, B § 4.2.5) : l'écran calcule `photoAnnoncee = candidatPhotoWeb(<la fiche du signet, telle que
   l'écran la lit>, resultat.page.image_url)` (revalidée par `lirePage`) et la garde dans son état ; non nulle → il insère
   `ligneAnnoncePhotoWeb()` (exportée par `photo-plat.js`, pour que le filet i18n voie son texte) sous les lignes « Selon la page » et mode :
   `small.muted[data-role="photo-web-annonce"]` « Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de
   plus, compté dans ton quota du jour. » (un ESSAI, jamais un résultat : hors ligne, sans session, quota épuisé ou page qui refuse, il n'aboutit
   pas). Sans candidat (pas d'image, ou une photo de la personne déjà posée, ou la même image web déjà là) : rien, et `photoAnnoncee = null`.
2. **« Enregistrer »** (`enregistrerLecture(importId, { ctx, repo, remplacer = null, fetch, enLigne, photoAnnoncee = null })`, B § 4.3, point 4 —
   **trois dépendances de plus**, passées par la route comme celles de `lancerLecture`) :
   - `fabriquerLectureWeb(recette, { signet, versions, page, sourceKind, importId, modele, maintenant, remplacer, photoAnnoncee })`, sur le
     signet RELU par `enregistrerLecture` : `candidat = candidatPhotoWeb(signet, page.image_url)` ; **`photoWeb = candidat !== null &&
     memeAdresseImage(candidat, photoAnnoncee) ? candidat : null`** (un appel ne part que s'il a été ANNONCÉ, et pour l'adresse annoncée : une
     photo posée dans un autre onglet entre l'écran et la tape, ou un candidat apparu depuis, ne lance rien) ; si `photoWeb`, `remplacer !==
     false` et le signet relu n'a PAS de pointeur valide : la fiche fabriquée porte `photo_source_url: photoWeb` (le rapatriement attendu, D-F18) ;
     sinon `photo_source_url` est celui du signet (inchangé). `photo_sha256` n'est JAMAIS touché par la fabrication ; `photo_origin` de la copie
     passe par `originePhotoAdmise` (D-F19). Avec `remplacer: false`, la fiche n'est pas écrite (B-24 : aucun `put recipes`). Le fabricant rend
     `{ recipe, version, remplacement, photoWeb }` ;
   - la transaction du lot B écrit `recipes` + `recipe_versions` + `imports enregistre` comme avant (ou `recipe_versions` + `imports` seuls sur
     « Ajouter sans remplacer ») ;
   - **après** la transaction réussie (et seulement alors) : si `photoWeb` est non nul, `rapatrierPhotoWeb(recipe.id, { candidat: photoWeb, ctx,
     repo, fetch, enLigne })` SANS `await`, appelé AVANT `navigate('/recipes/<id>?v=<version.id>')` (la zone de la fiche s'ouvre sur
     « Récupération de la photo du plat… ») — y compris sur « Ajouter sans remplacer » (D-F3 : l'annonce tient, comme la photo du plat sur
     « non » au lot A, I-5). `TransitionRefusee` → aucun rapatriement. « Annuler » du dialogue de remplacement (B-13) → rien d'écrit, rien ne part
     (il n'y a pas eu d'enregistrement). `enregistrerLecture` ne change pas ce qu'elle rend ; les tests attendent la descente par
     **`attendreRecuperation(recipeId)`** (exportée par `photo-plat.js` : la promesse de la descente en vol de cette fiche, sinon une promesse
     résolue) avant de sortir de leur `withRepo`.
3. **`rapatrierPhotoWeb(recipeId, { candidat = null, tape = false, ctx, repo = repoModule, fetch = undefined, enLigne = () => enLigneFlag } = {})`**
   (exportée, `src/ui/photo-plat.js`) → `Promise<{ issue: 'ok', sha256 } | { issue: 'refuse', raison } | { issue: 'echec', raison }>`, ne lève
   jamais. Fonction NON `async` qui pose le vol puis délègue : `enVol.has(recipeId)` → `Promise.resolve(refuse(vol_tenu))` ; sinon `entree = {
   controller: new AbortController(), promesse: null }`, `enVol.set(recipeId, entree)`, `notifier(recipeId)` — tout cela AVANT le premier `await` —,
   puis `entree.promesse = descendre(recipeId, entree, options).finally(() => { enVol.delete(recipeId); notifier(recipeId); })`, rendue.
   **`descendre`** :
   - `fiche = await repo.get('recipes', recipeId)` → absente : `refuse(fiche_absente)` ; **`depart`** = `{ photo_sha256, photo_origin,
     photo_source_url }` de la fiche (bruts) ; `sha = HASH.test(fiche.photo_sha256) ? fiche.photo_sha256 : null` ;
   - `sha && fiche.photo_origin !== 'web'` → `refuse(photo_manuelle)` (D-F10 ; une origine `null` avec un pointeur valide compte comme une photo de
     la personne) ;
   - `url = candidat !== null ? adresseImageAdmise(candidat) : adresseImageAdmise(fiche.photo_source_url)` ; nulle → `refuse(adresse)` ;
     `sha && memeAdresseImage(url, fiche.photo_source_url)` → `refuse(deja_la)` (cette image est déjà en place) ;
   - `!enLigne()` → `refuse(hors_ligne)` ; `session = await sessionAssistant(ctx)` nulle → `refuse(non_connecte)` ;
   - `r = await lireImageWeb({ url, session }, { fetch: fetch ?? globalThis.fetch, signal: entree.controller.signal })` ; `r.etat === 'echec'` →
     échec (ci-dessous) — rien d'écrit (un `photo_source_url` déjà là reste : la zone dira « non récupérée », I-F4) ;
   - `jpeg = await preparerPhotoDistante(r.blob)` (`ErreurImage` → échec `e.code`) ; `sha2 = await sha256Hex(jpeg)` ;
   - **garde des trois champs, AVANT `putFile`** (I-F1, I-F5, D-F18) : `relue = await repo.get('recipes', recipeId)` ; absente →
     `refuse(fiche_absente)`, rien d'écrit ; `relue.photo_sha256 !== depart.photo_sha256` ou `relue.photo_origin !== depart.photo_origin` ou
     l'adresse a changé (`!memeAdresseImage(relue.photo_source_url, depart.photo_source_url)`, et deux adresses nulles ou refusées comptent comme
     égales) → `refuse(fiche_changee)`, rien d'écrit (la personne a choisi une photo, retiré, « Ne pas récupérer », ou une relecture a changé
     l'adresse) ;
   - `await repo.putFile(sha2, jpeg, { mime: 'image/jpeg' })` (exception → échec `ecriture`) ;
   - **même garde, encore** juste avant l'écriture (une écriture de la personne a pu s'engager pendant `putFile`) : changée → `refuse(fiche_changee)`,
     la ligne `files` reste (orphelin L5) ; sinon `fiche = { ...relue, photo_sha256: sha2, photo_origin: 'web', photo_source_url: url }` (les trois
     ENSEMBLE : la provenance est celle de cette image, D-F18) ; `assertVocabulaire(fiche, 'recipes')` ; `repo.save('recipes', fiche)` (exception →
     échec `ecriture`) ; `derniersEchecs.delete(recipeId)` ; `{ issue: 'ok', sha256: sha2 }` ;
   - **un échec** (`lireImageWeb`, `preparerPhotoDistante`, `ecriture`) : `logError('photo_web.echec', { raison, id: recipeId })` ;
     `derniersEchecs.set(recipeId, { raison, extra, tape, url })` ; `{ issue: 'echec', raison }`. Un `refuse` ne touche pas `derniersEchecs`, sauf
     `fiche_changee` et `fiche_absente`, qui l'effacent, et `non_connecte` sur une TAPE, qui l'écrit (`{ raison: 'non_connecte', extra: {}, tape:
     true, url }` : une session nulle alors que `ctx.sync.user` est posé — jeton dont le rafraîchissement dépasse 2 s, `sessionAssistant`,
     `components.js` l. 276-284 — ; la zone dit alors pourquoi rien n'est venu, aucun appel n'étant payé) ;
   - aucun toast dans aucun cas ; la zone et l'en-tête de la fiche, s'ils sont montés, se redessinent par `notifier` ; les cartes des autres
     écrans suivent au prochain rendu (le `change` de `repo.save` vide le cache, D-F15).
   La relecture puis l'écriture font UNE transaction (`{ key, fusion }`, T3-R1, R-F-20 ; la spec écrivait : deux transactions, la fenêtre d'un `await`
   reste, § 11) ; les conditions de `db.mutate` (lot A, § 3.6) lisent
   `status`, que `recipes` n'a pas : elles ne s'appliquent pas telles quelles.
4. **Relecture d'une fiche déjà lue** (D-B18, « Relire la page avec l’assistant ») : `candidatPhotoWeb` sur le signet relu — photo `'web'` avec une
   autre `image_url` → annonce, puis descente avec le candidat EN ARGUMENT ; `photo_source_url` n'est pas touché par la fabrication (la provenance
   de la photo en place reste vraie) ; la réussite écrit les trois champs, l'échec ne change rien (l'ancienne photo web reste, avec SA provenance ;
   la relecture suivante retentera, puisque l'adresse diffère encore) ; même `image_url` → `null` : rien ne part ; photo `'photo' | 'image'` →
   `null` : rien ne part, la photo reste (I-F5) ; pas de photo et une `image_url` → `photo_source_url` posé, descente.
5. **Un échec de rapatriement n'est jamais une ligne du journal `imports`** : l'import est `enregistre` (I-F4) ; la section « Imports » (lot A § 4.5)
   ne montre rien ; la fiche porte l'état (cas 5 de § 4.1.2, D-F17).

### 4.4 Écran ciblé (lot A, `src/ui/import-cible.js`) : intouché (D-F14)

`sectionPhoto` (l. 449) et ses gestes (`poserPhoto`, `retirerPhoto`, pointeur sur `imports`) ne changent pas. F touche seulement le domaine du lot A,
d'une ligne : **`fabriquerExtraction`** (`src/domain/import-cible.js` l. 116) recopie `originePhotoAdmise(reference.photo_origin)` au lieu de
`reference.photo_origin ?? null` quand aucune photo n'est posée (D-F19 : une référence reçue avec une origine hors liste ne fait plus lever
`ErreurVocabulaire`). **Aucune clé n'est ajoutée** : `photo_source_url` n'est pas posé par la fabrication (rév. 1 : `photo_source_url: null` avec
une photo — retiré, il faisait rougir `tests/import-cible.js` l. 360, « aucune clé ajoutée à la fiche », et ne protégeait qu'un cas
inatteignable : l'écran ciblé refuse toute fiche à `source_url`, l. 208). `ORIGINES_PHOTO` (l. 91) reste `['photo', 'image']` (D-F1). Les tests du
lot A (l. 335-364, 645-680) restent verts sans changement : `refCorr` porte `photo_origin: null`, la référence de la l. 362 porte `'image'`
(admises).

### 4.5 Cas et textes

| Cas | Écrit | Écran |
|---|---|---|
| Photo prise ou choisie sur la fiche | `files` + `recipes { photo_sha256, photo_origin: 'photo' \| 'image', photo_source_url: null }` (fiche relue) | image en tête (redessinée sur place) ; zone cas 2 ; toast « Photo du plat enregistrée. » |
| « Choisir une image » sur une photo en place (web ou non) | nouveau `files` + les trois champs ; l'ancienne ligne `files` reste | l'image remplacée, sans légende si l'ancienne était web ; même toast |
| Image refusée par le mur local (`ErreurImage`) | rien | toast `messageErreurImage` (« Cette image est trop lourde (25 Mo au plus). », « Cette image est trop grande. », « Cette image ne peut pas être lue ici. Essaie une autre photo. ») ; la zone redit l'état relu |
| Fiche supprimée entre le rendu et le geste | rien (relecture avant `putFile`) | toast « Recette introuvable. » |
| Écriture de la fiche impossible | `files` seulement (orphelin) | toast « La photo du plat n’a pas pu être changée. Réessaie. » |
| « Retirer » | `recipes { photo_sha256: null, photo_origin: null, photo_source_url: null }` | en-tête vide ; zone cas 1 (« Ajoute une photo du plat : elle illustre la recette dans tes listes. ») ; toast « Photo du plat retirée. » |
| Pointeur sans octets (ligne reçue, octets ailleurs) | rien | l'état et « Télécharger » de G EN TÊTE (§ 4.1.4) ; zone cas 3 (« Retirer » offert) |
| Import web, `image_url` présente, candidat non nul | à l'enregistrement : `photo_source_url` (fiche sans photo) ; puis `files` + `photo_sha256`, `photo_origin: 'web'` (+ `photo_source_url` quand il n'était pas écrit) | écran a_verifier : « Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour. » ; fiche : « Récupération de la photo du plat… » puis l'image en tête avec la légende « Image de la page {hote} » |
| Import web, rapatriement échoué au départ automatique | `photo_source_url` seul (fiche sans photo) ; `logError('photo_web.echec')` | zone : « Photo du plat non récupérée. » + « Réessayer » (+ « Un appel de plus, compté dans ton quota du jour. ») + « Ne pas récupérer » ; aucune raison dite, sauf définitive ; texte intact |
| « Réessayer » qui échoue | rien | la même ligne, plus la raison (table § 4.1.2) ; raison définitive → « L’image de cette page ne peut pas être utilisée. », sans « Réessayer » |
| « Ne pas récupérer » | `recipes { photo_sha256: null, photo_origin: null, photo_source_url: null }` | zone cas 1 ; aucun toast ; aucun appel |
| « Réessayer » hors ligne / sans compte | rien | bouton éteint ; « Tu es hors ligne. » / « Connecte-toi pour utiliser l’assistant. » dessous |
| « Réessayer » pendant une descente de la même fiche | rien (`vol_tenu`) | « Récupération de la photo du plat… » (déjà affiché) |
| Fiche changée pendant la descente (photo choisie, retrait, « Ne pas récupérer », relecture) | rien, ou `files` seulement si le changement arrive pendant `putFile` | la zone montre ce que la personne a fait ; rien n'est écrasé (I-F5) |
| Relecture dont l'image a changé, descente échouée | rien | l'ancienne photo web reste avec sa provenance (D-F18) ; la relecture suivante retente |
| Image web > 2 Mio, type hors liste, signature différente, corps vide, en-tête illisible ou d'un autre type, petit côté < 200 px, > 16 Mpx | serveur : 413 `image_trop_lourde` / 422 `pas_une_image` ; client : `preparerPhotoDistante` refuse | même cas « non récupérée » ; raison définitive : « L’image de cette page ne peut pas être utilisée. », sans « Réessayer » |
| « Ajouter sans remplacer » (dialogue de B) | la transaction n'écrit pas la fiche (B-24) ; la descente part ; réussite → les trois champs ; échec → rien | fiche : « Récupération… », puis l'image, ou rien (aucun candidat écrit : pas de cas 5) |
| Carte, octets ici | — | vignette 72 px (à droite dans une carte de recette ; à gauche du titre dans un repas) |
| Carte sans octets / sans photo | — | rien |

### 4.6 Ce qui change ailleurs

`schema.js` : `PHOTO_ORIGINS`, `HASH` exporté ; `vocabulaire.js` : `recipes.photo_origin`, `originePhotoAdmise` ; `src/domain/import-cible.js` : une
ligne (`originePhotoAdmise`) ; `src/core/image.js` : `preparerPhotoDistante`, `COTE_MIN_DISTANT` ; `src/domain/passerelle.js` : `RAISON_DE_ERREUR`
(l. 22) += `pas_une_image → pas_une_image`, `image_trop_lourde → image_trop_lourde` (B y a mis `interdit` et `inaccessible`) ; `echecDomaine`
(l. 115-120) les relaie (`extra: {}`) ; `src/domain/lecture-web.js` (B) : `lirePage` lit `image_url`, `fabriquerLectureWeb` reçoit `photoAnnoncee`,
pose `photo_source_url` (fiche sans photo) et rend `photoWeb`, recopie l'origine par `originePhotoAdmise` ; `src/ui/import-web.js` (B) : annonce,
`photoAnnoncee` gardée, déclenchement, `enregistrerLecture` reçoit `fetch`, `enLigne` et `photoAnnoncee` ; `src/ui/livre-ajout.js` : options
`libelle` et `nomRetirer` de `renderZoneCouverture` ; `src/ui/recipe.js` : quatrième paramètre, `monterPhotoPlat`, `photoDuPlat` déplacée,
`favBtn` relu (D-F16) ; `src/ui/recipe-edit.js` : les trois champs de la photo repris de la fiche relue avant l'écriture (D-F16, D-F19) ;
`src/ui/components.js` : `vignettePlat`, `urlsDesVignettes`, `recipeCard` ; `search.js`, `book.js` : révocation des vignettes au redessin ;
`meals.js` : vignette des éléments ; `styles.css` : `.plat-vignette` ; `en.js` : les textes de § 5 ; `sw.js` : `SHELL` + trois modules,
`VERSION` ; `tests/creer-ia.js` : `photo-plat.js` dans les `sources` du filet i18n.

## 5. Textes (FR → EN, toutes par `t()` littéral ; les clés exactes font foi dans `en.js`, apostrophe typographique U+2019)

Existent déjà (relus dans `en.js`) : « Photo du plat » (“Photo of the dish”) · « Photographier » (“Take photos” : clé PARTAGÉE avec la couverture
et les menus « + Recette » qui prennent plusieurs pages ; laissée telle quelle, dette nommée en § 11) · « Choisir une image » · « Retirer » ·
« Réessayer » · « Recette introuvable. » · « Tu es hors ligne. » · « Connecte-toi pour utiliser l’assistant. » · « Couverture » · « Trop de
demandes pour l’instant. Réessaie dans une minute. » · « L’appel a peut-être été compté ; relancer en coûtera un autre. » · les textes de
`texteRefusAssistant` et `texteEchecAssistant` (`components.js` l. 317-341) · les trois textes de `messageErreurImage`. Neufs (alignés sur
“Photo of the dish” de l'existant) :
- **« Ajoute une photo du plat : elle illustre la recette dans tes listes. »** → “Add a photo of the dish: it illustrates the recipe in your
  lists.”
- **« Image de la page {hote} »** → “Image from the page {hote}” ; **« Image de la page web »** → “Image from the web page”
- **« Récupération de la photo du plat… »** → “Fetching the photo of the dish…”
- **« Photo du plat non récupérée. »** → “Photo of the dish not retrieved.”
- **« Un appel de plus, compté dans ton quota du jour. »** → “One more call, counted in your daily quota.”
- **« Ne pas récupérer »** → “Don’t fetch it”
- **« Le site de la page n’a pas donné son image. »** → “The page’s site did not provide its image.”
- **« L’image de cette page ne peut pas être utilisée. »** → “This page’s image cannot be used.”
- **« Photo du plat enregistrée. »** → “Photo of the dish saved.”
- **« Photo du plat retirée. »** → “Photo of the dish removed.”
- **« La photo du plat n’a pas pu être changée. Réessaie. »** → “The photo of the dish could not be changed. Try again.”
- **« Retirer la photo du plat »** (nom accessible du bouton « Retirer ») → “Remove the photo of the dish”
- **« Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour. »** →
  “After saving, the app will try to fetch the photo of the dish from the page: one more call, counted in your daily quota.”
Les textes de l'état d'un fichier absent (« Pas encore sur cet appareil », « Télécharger », « Téléchargement… », « Connecte-toi pour la
télécharger », « Fichier illisible reçu du serveur. ») sont ceux du lot G, rendus en tête (§ 4.1.4) : F n'en ajoute aucun. **Un seul nom anglais
pour la photo du plat** : le plan G écrit `"Photo du plat · {titre}": "Dish photo · {titre}"` (nom d'un fichier dans Réglages) ; F aligne sur
l'existant du lot A : la tâche 3 change cette valeur en “Photo of the dish · {titre}” si G l'a gardée (une ligne d'`en.js`, amendement nommé ; les
tests de G lisent le français). Aucun texte ne nomme une raison technique hors la règle « Code : {c} » de `texteEchecAssistant`. Tous les textes
neufs vivent dans `src/ui/photo-plat.js` (seul fichier ajouté au filet `sansEntree`) ; `import-web.js` (B) reçoit l'annonce par une fonction
exportée de `photo-plat.js` (`ligneAnnoncePhotoWeb()`), pour que le filet la voie.

## 6. Serveur

### 6.1 `supabase/functions/assistant/lecture-web.js` (module feuille du lot B, amendé ; Node et Deno, toujours sans import)

| Export | Contrat |
|---|---|
| `LIMITES_IMAGE` | `Object.freeze({ url: 2048, octets: 2 * 1024 * 1024, redirections: 3, delaiSautMs: 15000, delaiTotalMs: 30000, types: Object.freeze(['image/jpeg', 'image/png', 'image/webp']) })` — `url`, `redirections`, `delaiSautMs`, `delaiTotalMs` recopient `LIMITES_LECTURE` (épinglés égaux par un test) ; `octets` : 2 Mio (R-F-4), épinglé au littéral 2 097 152 |
| `typeImageAdmis(contentType)` → type \| `null` | `content-type` sans paramètres, minuscules, ∈ `LIMITES_IMAGE.types` → ce type ; `image/gif`, `image/svg+xml`, `image/heic`, `text/html`, `application/octet-stream`, `''`, `null` → `null` |
| `signatureImage(octets)` → type \| `null` | lit les premiers octets d'un `Uint8Array` : `FF D8 FF` → `image/jpeg` ; `89 50 4E 47 0D 0A 1A 0A` → `image/png` ; `52 49 46 46` (« RIFF ») aux octets 0-3 ET `57 45 42 50` (« WEBP ») aux octets 8-11 → `image/webp` ; tout autre début, ou trop court, → `null` ; ne lève jamais |
| `imageDe(objet)` → chaîne \| `null` | `image` lu par `Object.hasOwn` : chaîne → elle ; objet nu → `url`, sinon `contentUrl` (chaînes) ; tableau → le premier élément qui rend une chaîne par la même règle (profondeur 2 : un tableau d'`ImageObject`) ; `nettoyerChaineJsonLd` ; vide → `null` ; jamais `Object.assign` ni `for…in` (S-11 du lot B) ; ne lève jamais |
| `imageOgDe(html)` → chaîne \| `null` | `<meta property="og:image" content="…">` (ou `name="og:image"` ; casse et ordre des attributs libres, guillemets simples ou doubles), balise trouvée par `indexOf('<meta', i)` et lue dans sa tranche jusqu'à `>` (linéaire, D-B12 ; le lecteur de balise `meta` de `siteDe` est partagé s'il est exporté par B), premier `content` décodé (`decoderEntites`), rogné ; absente → `null` ; `og:image:url`, `og:image:secure_url` ignorés |
| `imageUrlDe(objet, html, { urlFinale, hotesRefuses = [], autresRecettes = 0 } = {})` → chaîne \| `null` | **Construction (vague finale, VF-F3 à VF-F5, R-F-21) : chaque candidat est validé avant de passer la main — une image JSON-LD refusée laisse `og:image` tenter la sienne —, une adresse dégénérée (`#`, `#top`, `.`, `./`, `?v=1` : la page elle-même ou son dossier) est écartée, et la garde « page de liste » compte `max(autresRecettes, Recipe trouvées − 1)` ; la spec écrivait :** `candidat = (objet ? imageDe(objet) : null) ?? (autresRecettes > 0 ? null : imageOgDe(html))` (D-F3 : l'image de partage d'une page de liste n'est pas celle de la recette) ; `null` → `null` ; `abs = new URL(candidat, urlFinale)` sous `try` (levée → `null` ; une adresse relative ou `//hôte/…` est ainsi résolue) ; `valideAdresse(abs.href, { hotesRefuses })` → `.href` sinon `null` (`http:`, une IP, un hôte interne, un port, l'hôte de `SUPABASE_URL` → `null`) |
| `TRANCHE_BASE64` | `24576` (= 3 × 8 192) : un MULTIPLE DE 3, épinglé par un test (`TRANCHE_BASE64 % 3 === 0`) |
| `versBase64(octets)` → chaîne | `Uint8Array` → base64 avec remplissage : pour chaque tranche de `TRANCHE_BASE64` octets, `btoa(String.fromCharCode(...tranche))`, concaténées. Une tranche multiple de 3 n'a jamais de remplissage : seul le DERNIER morceau peut finir par `=` (rév. 1 : 32 Kio, qui n'est pas un multiple de 3, plaçait des `=` au milieu — base64 invalide dès 32 769 octets, mesuré) ; Node et Deno ; `new Uint8Array(0)` → `''` |
| `lirePageHtml({ html, urlFinale, contentType, hotesRefuses = [] })` | **amendée** : retient en interne l'OBJET `Recipe` dont vient la recette lisible (B : « la première lisible ») et pose `page.image_url = imageUrlDe(<cet objet, brut>, html, { urlFinale, hotesRefuses, autresRecettes: <page.autres_recettes> })` ; sans `Recipe` lisible (chemin `modele`), `imageUrlDe(null, html, …)` (`og:image` seul, `autres_recettes` vaut 0) ; tout le reste de B inchangé |

### 6.2 `supabase/functions/assistant/logique.js`

- `OUTILS = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'])` (le cinquième en dernier ; aujourd'hui trois,
  l. 3 ; quatre après B).
- **`OUTILS_MODELE = Object.freeze(['recherche-web', 'creation', 'extraction', 'lecture-web'])`** (neuf) : la liste FERMÉE des outils qui peuvent
  atteindre le modèle ; `image-web` n'y est pas et n'y sera jamais (§ 6.3).
- `lireDemande(texte, { outil: 'image-web', octets, hotesRefuses = [] })` : la MÊME règle que `lecture-web` (B § 6.1), par une fonction interne
  partagée **`lireDemandeUrl`** (une règle, deux outils) : borne `LIMITES.corps` (512 Kio, l. 4) ; `corps` objet nu ; liste blanche `{ url }` :
  absente ou non chaîne → 400 `forme` ; `valideAdresse(url, { hotesRefuses })` refuse → **422 `interdit`** ; tout autre champ ignoré ; aucun
  `messages`, `system`, `max_tokens` lus ; rend `{ ok: true, corps: { url: href } }`.
- `LIMITES` ne change pas ; `ligneJournal` (l. 101) admet `'image-web'` (∈ `OUTILS`) ; `usage` nul → `jetons_entree` / `jetons_sortie` `null` (déjà
  le cas : `entierOuNul(own(null, …))`, l. 94 et 103).

### 6.3 `supabase/functions/assistant/index.ts` — le chemin `image-web`

Gardes inchangées jusqu'à `lireDemande` (B : `hotesRefuses` passé) ; `lu.raison === 'interdit'` → 422 avant réservation (B). Puis, pour
`outil === 'image-web'`, APRÈS la réservation (`admin.rpc('assistant_reserver', { p_owner, p_outil: 'image-web', p_octets: bytes.byteLength,
p_quota })`) et le `ctl` de 120 s (relais de `req.signal`) :
1. **`suivreRedirections(href, { signal, hotesRefuses, accept, lire })`** — la boucle de `telechargerPage` (B § 6.3 point 2 ; prototype B,
   `telechargerPage` l. 86-130) EXTRAITE, partagée par `telechargerPage` et `telechargerImage` (une règle SSRF, deux appelants) : minuterie globale
   `LIMITES_LECTURE.delaiTotalMs` (30 s), ≤ `LIMITES_LECTURE.redirections` sauts, minuterie de `delaiSautMs` (15 s) par saut, relais de `signal`
   (`ctl.signal`) vers le contrôleur du saut ; `fetch(courant, { method: 'GET', redirect: 'manual', credentials:
   'omit', signal: <contrôleur du saut>, headers: { 'user-agent': <la valeur de B, inchangée>, accept, 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5'
   } })` — **exactement ces trois en-têtes** : jamais `referer`, `origin`, `cookie`, `authorization`, `apikey`, `x-api-key` (I-B8 ; un `referer`
   « pour passer l'anti-hotlink » enverrait l'adresse de la recette chez un tiers) ; 301 / 302 / 303 / 307 / 308 → corps annulé (`r.body?.cancel()`,
   S-9), `location` absente ou illisible → `inaccessible` 502, cible revalidée par `valideAdresse` (refus → `{ erreur: 'interdit', statut: 422 }`),
   sauts dépassés → `inaccessible` 502 ; statut ≥ 400 ou hors 2xx → `inaccessible` 502 (corps annulé). **Sur un 2xx, le corps est lu PAR `lire(r)`,
   DANS le `try/finally` du saut** : la minuterie du saut, la minuterie globale et le relais de `ctl.signal` restent posés pendant TOUTE la lecture du
   corps, et ne sont retirés qu'après — la règle de D-B26 telle que le prototype B l'écrit (`telechargerPage` : minuterie du saut armée à l'entrée du
   saut, l. 95, retirée dans le `finally`, l. 123-124, APRÈS `lireCorpsBorne`, l. 120) : un saut, en-têtes ET corps, dure 15 s au plus, tout le
   téléchargement 30 s ; `image-web` suit la même règle par la même boucle, sans affaiblissement (R-F-6) (rév. 1 : « rend la réponse 2xx non lue » —
   les `finally` auraient retiré les minuteries au `return`, et un hôte qui envoie ses en-têtes vite puis le corps au goutte-à-goutte aurait tenu la
   fonction 120 s, pour `lecture-web` aussi : régression de D-B26). `lire(r)` rend `{ ok: valeur }` ou un refus `{ erreur, statut }` ; une exception
   pendant `lire` : `ctl.signal.aborted` → relancée (504 `delai`, D-B26) ; sinon (minuterie d'un saut ou globale, réseau) → `inaccessible` 502. Rend
   `{ valeur, urlFinale }` ou `{ erreur, statut }`. **`telechargerPage`** devient `suivreRedirections(href, { …, accept: <celui de B>, lire: (r)
   => <la lecture de B : typeAdmis, lireCorpsBorne(r, LIMITES_LECTURE.page), lireCharset, TextDecoder> })` : comportement de B inchangé, corps compris
   dans les 30 s (u6 bis le prouve).
2. **`telechargerImage(href, { signal, hotesRefuses })`** : `suivreRedirections(…, { accept: 'image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1',
   lire })` où `lire(r)` : `type = typeImageAdmis(r.headers.get('content-type'))` nul → corps annulé, `{ erreur: 'pas_une_image', statut: 422 }` ;
   `content-length` annoncé > `LIMITES_IMAGE.octets` → corps annulé, `{ erreur: 'image_trop_lourde', statut: 413 }` ; `octets = await
   lireCorpsBorne(r, LIMITES_IMAGE.octets)` (en flux, coupé) → `null` → 413 `image_trop_lourde` ; `octets.byteLength === 0` → 422 `pas_une_image` ;
   **`signatureImage(octets) !== type` → 422 `pas_une_image`** (un HTML, un PDF ou une PNG annoncés `image/jpeg` ne sont jamais relayés) ; rend
   `{ ok: { octets, type } }`.
3. Succès → 200 `{ type, taille: octets.byteLength, url_finale: urlFinale, octets: versBase64(octets) }` ; journal statut 200, `usage` nul.
4. `req.signal.aborted` → 499 sans corps (inchangé) ; mise à jour du journal par LE MÊME point d'écriture (`.update(` ; F-7 du lot B :
   `octets: bytes.byteLength` reste compté 2 dans le source).
**Le modèle n'est JAMAIS appelé pour `image-web`** (rév. 1 : « sauté quand la réponse est déjà posée » ne couvrait pas une branche oubliée — dans
le prototype B, `let corpsModele = lu.corps` est le défaut, et seul le bloc `lecture-web` le remet à `null`) : dans `traiter`, `let corpsModele =
OUTILS_MODELE.includes(outil) ? lu.corps : null`, posé AVANT tout `await` du bloc ; le point d'appel unique `await appelerAnthropic(` n'est atteint
que si `corpsModele !== null` ; l'adresse demandée ne part donc jamais chez le fournisseur, et aucune réponse du fournisseur n'écrase celle de
l'image (u11).
**Forme de `traiter`** (N-1 du lot B) : après la réservation, le bloc `if (outil === 'lecture-web')` de B (qui appelle `telechargerPage`, elle-même
sur `suivreRedirections`), puis UN bloc `if (outil === 'image-web')` qui télécharge (`await telechargerImage(`) et pose la réponse (200 ou refus
typé), puis le point d'appel unique `await appelerAnthropic(` (gardé par `corpsModele !== null`), puis `.update(`. Les déclarations
(`suivreRedirections`, `telechargerPage`, `telechargerImage`, `appelerAnthropic`) vivent où l'auteur veut (le test d'ordre épingle les POINTS
D'APPEL, § 7.2). Appels sortants : UN `await fetch(courant, …)` dans `suivreRedirections` (partagé) et `await fetch(ANTHROPIC, …)` dans
`appelerAnthropic` : le compte « deux appels sortants » du lot B tient. Le `user-agent` de B ne change pas (il nomme Mitsu et porte l'adresse du
site public du projet : avec F, il part aussi chez les hôtes d'images, § 11). `deno.json` inchangé ; `tsc --strict` : le cast local de B pour
`lecture-web.js` s'étend aux exports neufs. Mémoire : 2 Mio d'octets plus ≈ 2,7 Mio de texte base64 et l'enveloppe JSON, une fois par appel (non
mesuré sur la plateforme, § 11).

### 6.4 Contrainte `outil` : la migration `0006` du lot B porte les CINQ outils (R-F-1)

La spec B rév. 3 (§ 3.7, § 6.4, § 7.3) écrit `0006_lecture_web.sql` avec `check (outil in ('recherche-web', 'creation', 'extraction',
'lecture-web'))`, un test croisé « `add constraint` avec exactement `OUTILS` de `logique.js` dans l'ordre » (tâche 2 de B) et un verdict 1.01
« les quatre outils, dans l'ordre d'`OUTILS` ». **Ruling R-F-1 (chemin 1)** : le chef d'orchestre amende la spec et le plan B dès que le plan B
est rendu, pour que `0006` porte les cinq outils :
1. `check (outil in ('recherche-web', 'creation', 'extraction', 'lecture-web', 'image-web'))` (une valeur admise de plus dans un `check` est
   inoffensive tant que `OUTILS` ne la porte pas : B n'écrit jamais `'image-web'`) ;
2. le test croisé de B (`tools/generer-migrations.test.mjs`) compare la liste SQL au littéral **`OUTILS_0006 = ['recherche-web', 'creation',
   'extraction', 'lecture-web', 'image-web']`** (comme `OUTILS_0004`, F-2 du lot B) et affirme `OUTILS` égal à `OUTILS_0006.slice(0,
   OUTILS.length)` (préfixe : B passe avec quatre, F avec cinq) ;
3. la preuve `0006` : verdict 1.01 « les cinq outils, dans l'ordre d'`OUTILS_0006` » ; **2.031** (`c` recompté après 2.03, sinon le quota est déjà atteint et la réservation rend `null` ; ex-« 2.03 bis ») `assistant_reserver(uid, 'image-web', 1, c + 1)`
   → id non nul ; 2.02 `'inconnu'` → 23514 inchangé ; les verdicts de droits de B (1.03-1.05) inchangés ;
4. le README (étape 12 de B) le dit en une phrase : « la contrainte admet aussi `image-web` (lot F, à venir) ».

**F n'écrit aucune migration** : ni `0007`, ni preuve, ni étape de README, ni section de `RESULTATS-mitsu.md`. À la tâche 1, F constate dans le
code réel de B que `0006`, son test croisé et sa preuve portent les cinq outils (§ 7.3) ; une `0006` collée sur `mitsu` avec quatre outils est le
seul cas où F écrirait `0007` : nommé en § 11, rouvert par le chef d'orchestre, jamais décidé par la tâche. `0006` est collée et prouvée par Neegan
avec le lot B, donc avant le redéploiement de la fonction de F (§ 6.5) et avant tout `push` de F : un code servi sans la contrainte verrait chaque
`image-web` en 502 `serveur` (la réservation refuserait l'outil en 23514) — la recette, elle, serait enregistrée (I-F4) et la zone dirait « non
récupérée ».

### 6.5 Déploiement (D-F6)

Par le chef d'orchestre, APRÈS `0006` (cinq outils) collée et prouvée avec le lot B :
`supabase functions deploy assistant --project-ref <ref du projet mitsu> --no-verify-jwt --use-api` (commande de l'étape 10 du README) ; version et
`ezbr_sha256` consignés dans `RESULTATS-mitsu.md` (section « Sondes `image-web` ») ; sondes sans dépense S-F1 à S-F3, puis les deux payantes S-F4 et
S-F5 (§ 10) ; les sondes du lot 4 (S1-S9) et de B (S13-S16) rejouées (rien ne change pour les quatre autres outils).

## 7. Tests (suite navigateur : fixtures, `fetch` factice, bases jetables ; Node pour `logique.js`, `lecture-web.js`, `base64.js`, `index.ts`, la contrainte de `0006`)

Convention : chaque test est nommé par son libellé d'assertion ; chaque mutant est rejoué sur une copie servie à part et doit rougir. Aucun
réseau ; aucune écriture dans la base de la personne ; `withRepo` (`tests/sync-fixture.js`) et `withDatabase` (`tests/backup.js` l. 16) ;
`fetch`, `pickFiles`, `toast`, `enLigne` injectés ; images fabriquées par canvas par un fabricant RECOPIÉ dans `tests/photo-plat.js`
(`imageTest(nom, couleur, l, h, type)` → `File` JPEG ou PNG : celui de `tests/import-cible.js` l. 555 est une constante locale d'un bloc, non
exportée, et ne fait que du JPEG) ; `HASH` importé de `src/model/schema.js` ; un caractère hostile (U+2028, U+202E, Cf) est construit par
`String.fromCharCode` dans le test, jamais écrit en littéral ; un espion de révocation remplace `URL.revokeObjectURL` (posé et retiré en
`try/finally`, motif de `tests/ajouter.js` l. 1061-1076) — jamais `revoquerUrlDeBlob`, liaison d'import ESM qu'un test ne peut pas remplacer. Les
tests « on attend un fait » (F3/F4 du lot UX) attendent le DOM, `zone.dataset` ou `attendreRecuperation(id)`, jamais un délai ; un test qui
enregistre une lecture web attend `attendreRecuperation` avant de sortir de son `withRepo` (aucune descente ne survit à sa base).

### 7.1 Node — `tools/assistant-lecture-web.test.mjs` (lot B) et `tools/assistant-logique.test.mjs`

- **« `LIMITES_IMAGE` : forme »** — `url`, `redirections`, `delaiSautMs`, `delaiTotalMs` égaux à ceux de `LIMITES_LECTURE` ; `octets` 2 097 152
  (R-F-4) ; `types` gelée, exactement trois valeurs. Mutants : `image/gif` ajouté → rouge ; `octets` remis à 5 Mio → rouge.
- **« `typeImageAdmis` : table »** — `image/jpeg`, `IMAGE/PNG; charset=binary` → `image/png`, `image/webp` → le type ; `image/gif`,
  `image/svg+xml`, `image/heic`, `text/html`, `application/octet-stream`, `''`, `null` → `null`. Mutant : `image/svg+xml` admis → rouge.
- **« `signatureImage` : table »** — `FF D8 FF E0 …` → jpeg ; les huit octets PNG → png ; `RIFF` + 4 octets + `WEBP` → webp ; `RIFF` +
  4 octets + `AVI ` → `null` ; `<!doctype html>` → `null` ; `%PDF` → `null` ; 2 octets → `null` ; `Uint8Array(0)` → `null`. Mutant : WebP admis sur
  `RIFF` seul → rouge.
- **« `imageDe` : formes »** — chaîne ; `{ url }` ; `{ contentUrl }` ; tableau de chaînes → la première ; tableau d'objets → le premier `url` ;
  tableau vide → `null` ; `{ '@type': 'ImageObject' }` sans adresse → `null` ; `'<b>https://a.test/i.jpg</b>'` → balises retirées ; `'&amp;'`
  décodé ; bloc `{"image":{"__proto__":{"pollue":1}}}` → `null` et `({}).pollue === undefined` (en `try/finally`, S-11) ; `image: 7` → `null`.
- **« `imageOgDe` : balise lue dans sa tranche »** — `<meta property="og:image" content="https://a.test/i.jpg">` ; `name="og:image"` ;
  attributs dans l'autre ordre ; guillemets simples ; `content` avec `&amp;` ; `og:image:secure_url` seul → `null` ; absente → `null` ; une
  balise jamais fermée → `null` sans lever ; 2 Mio de `<meta` sans `>` → sous 500 ms (borne temporelle S-4) ; construction (T1-R1, vague VF-F2) : un
test jumeau sur des balises FERMÉES
  (`<script type=` + 2 030 blancs, `TYPE_JSONLD` linéaire) tient la borne que l'entrée « sans `>` » ne mesure pas.
- **« `imageUrlDe` : priorité, résolution, validation, pages de liste »** — JSON-LD `image` ET `og:image` → l'image du JSON-LD ; JSON-LD sans
  `image` → `og:image` ; **JSON-LD sans `image`, `og:image` présente, `autresRecettes: 2` → `null`** ; JSON-LD avec `image` et `autresRecettes: 2`
  → l'image du JSON-LD ; `/img/i.jpg` avec `urlFinale: 'https://site.test/r/x'` → `https://site.test/img/i.jpg` ; `//cdn.test/i.jpg` →
  `https://cdn.test/i.jpg` ; `http://a.test/i.jpg` → `null` ; `https://127.0.0.1/i.jpg` → `null` ; `https://a.test:8443/i.jpg` → `null` ;
  `https://projet.test/i.jpg` avec `hotesRefuses: ['projet.test']` → `null` ; `'https://a.test/i.jpg#frag'` → sans fragment ; 2 049 points de code
  → `null`. Mutants : `valideAdresse` sautée (l'adresse `http:` passe) → rouge ; résolution retirée (la relative vaut `null`) → rouge ; garde
  `autresRecettes` retirée → rouge.
- **« `versBase64` : base64 valide à toute taille »** — `TRANCHE_BASE64 % 3 === 0` ; `[0]` → `'AA=='` ; `[0, 0]` → `'AAA='` ; vide → `''` ; pour
  `n` ∈ { 100 000, `TRANCHE_BASE64 + 1`, `2 × TRANCHE_BASE64 + 2` } octets pseudo-aléatoires (graine fixe) : longueur = `4 * Math.ceil(n / 3)` ;
  aucun `=` ailleurs que dans les deux derniers caractères ; `atob(sortie)` (global de Node) et `Buffer.from(sortie, 'base64')` égaux octet pour
  octet à l'entrée. Mutant : `TRANCHE_BASE64 = 32768` (la valeur de la rév. 1) → rouge.
- **« chaînage serveur → client »** — `lireOctetsBase64(versBase64(octets), octets.length)` (`src/domain/base64.js`, module sans import, importé
  par le test Node) rend les mêmes octets pour les trois tailles ci-dessus ; une sortie mutée (un `=` inséré au milieu) → `null`. C'est le test
  qui manquait en rév. 1 : le `fetch` factice du client fabrique son propre base64.
- **« `lirePageHtml` : `page.image_url` »** — deux `Recipe` dont la première illisible (image A) et la seconde lisible (image B) → B (l'objet
  RETENU, B-2) ; sans JSON-LD → `og:image` ; ni l'un ni l'autre → `null` ; `hotesRefuses` relayé ; relative résolue contre `urlFinale` ; deux
  `Recipe` lisibles sans `image` et une `og:image` → `null` (`autres_recettes` = 1). Mutant : image lue sur le premier `Recipe` trouvé (et non le
  retenu) → rouge.
- **`assistant-logique.test.mjs`** : « `OUTILS` : cinq outils, `image-web` dernier » (le `deepEqual` de la l. 43, à trois outils aujourd'hui et
  quatre après B, devient la liste à cinq) ; « `OUTILS_MODELE` : gelée, égale à `OUTILS` sans `image-web` » ; « `lireDemande` image-web : liste
  blanche `{ url }` » (champs en trop ignorés ; `url` absente → 400 `forme` ; `http://` → 422 `interdit` ; `hotesRefuses` → 422 ; corps > 512 Kio →
  413 ; `messages` absents : pas une erreur ; `corps.url` = `href`) ; « `lireDemandeUrl` : une règle, deux outils » (table de six adresses :
  `lecture-web` et `image-web` rendent le même verdict pour chacune ; mutant : `image-web` sans `valideAdresse` → rouge) ; « `ligneJournal` :
  `image-web` admis, `usage` nul → jetons `null` ».

### 7.2 Node — `tools/assistant-index.test.mjs` (harnais de B : faux `Deno`, faux supabase-js, faux `fetch`, minuteries simulées ; `SUPABASE_URL = 'https://projet.test'`)

- **u1** `image-web` avec `http://site.test/i.jpg` → 422 `{ erreur: 'interdit' }`, **aucune** réservation, aucun fetch ; **u1bis**
  `https://projet.test/i.jpg` → 422, aucune réservation (S-12).
- **u2** `https://site.test/i.jpg` → réponse factice 200, `content-type: image/jpeg`, 1 000 octets commençant par `FF D8 FF` → réservation `{
  p_outil: 'image-web', p_octets, p_quota }` par la clé secrète ; **un** fetch (la page : `redirect: 'manual'`, `credentials: 'omit'`) dont les
  en-têtes posés sont **EXACTEMENT** `{ user-agent, accept, accept-language }` (`user-agent` qui commence par `Mitsu/`, `accept` qui commence par
  `image/jpeg`) ; **aucun** fetch vers le fournisseur ; 200 `{ type: 'image/jpeg', taille: 1000, url_finale, octets }` avec
  `Buffer.from(octets, 'base64')` égal aux 1 000 octets ; journal statut 200, `jetons_entree null`, `jetons_sortie null` ; ordre des événements
  `['rpc:is_allowed', 'rpc:assistant_reserver', 'fetch', 'update']`. Mutant : un `referer` ajouté aux en-têtes → rouge.
- **u3** redirection 301 vers `https://cdn.test/i.jpg` → suivie, `url_finale` = la cible, `cancel` appelé sur le corps du 301 ; 302 vers
  `http://…`, `https://localhost/`, `https://127.0.0.1/`, `https://projet.test/` → 422 `interdit` (après réservation : journal 422) ; quatre 301 →
  502 `inaccessible` ; 3xx sans `location` → 502 ; `location` relative résolue.
- **u4** `content-type: text/html` → 422 `pas_une_image`, corps annulé ; `image/svg+xml` → 422 ; `image/gif` → 422 ; 200 `image/png` de 0 octet →
  422 `pas_une_image`. **u4 bis** (signature) : un HTML annoncé `image/jpeg` → 422 `pas_une_image`, rien de son corps dans la réponse ni le
  journal ; une PNG annoncée `image/jpeg` → 422 ; une WebP (`RIFF…WEBP`) annoncée `image/webp` → 200 ; `RIFF…AVI ` annoncé `image/webp` → 422.
  Mutant : contrôle de signature retiré → rouge.
- **u5** `content-length: 2097153` → 413 `image_trop_lourde` sans lire le corps (`cancel` appelé) ; flux de 2 Mio + 1 sans `content-length` → 413,
  lecture coupée en route ; exactement 2 097 152 → 200, `octets` de 2 796 204 caractères (R-F-4). Mutant : borne remise à 5 Mio → le flux de
  2 Mio + 1 rend 200 → rouge.
- **u6** 404 / 500 / 403 → 502 `inaccessible` ; `fetch` qui rejette (DNS) → 502 ; délai d'un saut à 15 s exactes → 502 ; trois sauts de 12 s →
  abandon à 30 s → 502 ; abandon par `ctl` à 120 s pendant les en-têtes → 504 `delai` (D-B26).
- **u6 bis — le CORPS est sous les minuteries, pour `image-web` ET pour `lecture-web`** (D-B26 : 15 s PAR SAUT, corps compris, et 30 s en
  tout, corps compris ; R-F-6) : (a) **un seul saut, en-têtes en 1 s, puis un corps qui goutte** (flux factice, un octet par seconde simulée, sans
  `content-length`) → **coupé à 15 s exactes** (la minuterie du saut, armée à l'entrée du saut, court pendant le corps : rien à 14 999 ms, coupé à
  15 000 ms ; pas 30 s), 502 `inaccessible` (et non 504 à 120 s) ; (b) **la minuterie globale pendant le corps** : deux 301 de 12 s chacune, puis
  un troisième saut aux en-têtes en 1 s et un corps qui goutte → coupé à 30 s exactes (rien à 29 999 ms), 502 `inaccessible` ; (c) un abandon par
  `ctl` pendant la lecture du CORPS → 504 `delai` ; (d) un client parti pendant la lecture du CORPS → flux annulé (constaté sur le lecteur
  factice), aucun corps, journal 499. Mutants, pour les deux outils : `lire` appelé après le `finally` (minuteries retirées avant la lecture) →
  504 à 120 s en (a) et (b) → rouge ; minuterie du saut retirée à la réception des en-têtes (D-B26 affaibli) → (a) coupé à 30 s au lieu de 15 s →
  rouge.
- **u7** abandon du client pendant les en-têtes → fetch abandonné, 499, aucun corps, journal 499.
- **u8** jamais le corps d'une page d'erreur dans la réponse (sentinelle `IMAGE-SENTINELLE` dans un 500 → absente de la réponse et du journal).
- **u9** `lecture-web` : t2 et t3 de B **amendés** (la forme exacte de `page` gagne `image_url` : l'image du JSON-LD en t2, `og:image` en t3) ; une
  page sans image → `image_url: null`. Amendement nommé, pas contourné.
- **u10** la même boucle : un `image-web` redirigé vers `https://localhost/` et un `lecture-web` redirigé vers la même cible rendent le même 422
  (`suivreRedirections` partagée ; mutant : `telechargerImage` avec sa propre boucle sans revalidation → rouge).
- **u11 — `image-web` n'atteint JAMAIS le modèle** : pour chaque issue (200 ; `interdit` après redirection ; `pas_une_image` ; `image_trop_lourde` ;
  `inaccessible` ; une exception levée par `telechargerImage` ; 504 ; 499) : zéro fetch vers l'adresse du fournisseur, aucun en-tête `x-api-key`
  dans aucun fetch, la réponse est celle de l'image. Mutant : `corpsModele` laissé à `lu.corps` pour tout outil → rouge.
- **Test de source amendé** (`tools/generer-migrations.test.mjs`, bloc « index.ts : imports fermés… », B § 7.2) : la liste d'ordre devient `[…,
  ".rpc('assistant_reserver'", 'await telechargerPage(', 'lirePageHtml(', 'await telechargerImage(', 'await appelerAnthropic(', '.update(']` ;
  `await fetch(` compté 2 (« la page ou l'image dans `suivreRedirections`, le fournisseur dans `appelerAnthropic` ») ; `redirect: 'manual'` compté 1
  (une seule boucle) ; `OUTILS_MODELE.includes(outil)` présent ; `async function suivreRedirections(`, `telechargerPage(`, `telechargerImage(`,
  `appelerAnthropic(` déclarées où l'auteur veut ; mutant « réservation après `telechargerImage` » → positions non croissantes → rouge ; mutant
  « second `await fetch(` dans `telechargerImage` » → compte 3 → rouge ; « `Deno.createHttpClient` et `caCerts` absents » (D-B1) inchangé.

### 7.3 Node — `tools/generer-migrations.test.mjs`

« `0006` : `add constraint` égal au littéral `OUTILS_0006` (cinq outils) ; `OUTILS` en est le préfixe (quatre à B, cinq à F) » et « preuve
`0006` : verdicts nommés (`'image-web'`, `23514`, `assistant_reserver`) » — écrits par B (R-F-1 : la spec et le plan B amendés par le chef
d'orchestre) ; F constate qu'ils sont là et ajoute « `OUTILS.length === 5` et `OUTILS` égal à `OUTILS_0006` » (le préfixe devient l'égalité).
Aucune migration, aucune preuve, aucun pglast côté F. `--check` : 0.

### 7.4 Suite navigateur — `tests/photo-plat.js` (neuf) et ajouts nommés

`tests/photo-plat.js` exporte `runPhotoPlatTests({ eq, ok })`, câblé dans `tests/tests.js` après le bloc du lot E, avant le bloc thème et le
total ; ajouts nommés dans `tests/import-cible.js`, `tests/lecture-web.js`, `tests/passerelle.js`, `tests/ajouter.js`, `tests/theme.js`,
`tests/creer-ia.js` et `tests/sync.js`.

- **Schéma et vocabulaire** (`tests/import-cible.js`, bloc vocabulaire) : « `PHOTO_ORIGINS` gelée = `['photo', 'image', 'web']` » ; « `HASH`
  exporté par `schema.js` = `/^[0-9a-f]{64}$/` » ; « `recipes.photo_origin: 'appareil'` → `ErreurVocabulaire` (magasin, champ, valeur) ; `null` et
  absent tolérés ; `'web'` admis » ; « `originePhotoAdmise` : `'photo'`, `'image'`, `'web'` → eux-mêmes ; `'appareil'`, `''`, `7`, `null`,
  `'__proto__'` → `null` » ; « `RELATIONS` : aucune relation sur `photo_sha256` ni `photo_source_url` » ; « `DB_VERSION` 4 inchangée » ;
  « `fabriquerExtraction` avec `photo: { sha256, origin: 'web' }` → `photo_origin: null` (l'écran ciblé n'admet que `photo | image`) » — mutant :
  `ORIGINES_PHOTO` remplacée par `PHOTO_ORIGINS` → rouge ; **« D-F19 : une référence relue avec `photo_origin: 'appareil'` et `photo: null` →
  `fabriquerExtraction` ne lève pas, `photo_origin: null`, aucune clé ajoutée »** — mutant : recopie brute → `ErreurVocabulaire` → rouge. Les
  assertions existantes des l. 344, 358, 360, 362, 364 restent telles quelles (I-F9 : `fabriquerExtraction` n'ajoute aucune clé).
- **Domaine** (`tests/photo-plat.js`) :
  - « `LIMITES_IMAGE_WEB` : bornes » (R-F-4, D-F13) — gelée ; `octets` 2 097 152 ; `octets` ≤ `LIMITES_COUVERTURE.octetsDistants` ;
    `corpsReponse` ≥ `4 * Math.ceil(octets / 3) + 4096`. Mutants : `octets` remis à 5 Mio → rouge ; `corpsReponse` remis à 2 Mio → rouge.
  - « `adresseImageAdmise` : table » — `https://a.test/i.jpg` → même ; `https://u:p@a.test/i.jpg` → sans identifiants ; `http://a.test/i.jpg` →
    `null` ; `'https://a.test/ i.jpg'` → `null` (espace hors ASCII visible) ; `'https://café.test/i.jpg'` → `null` ; U+2028 au milieu → `null` ;
    2 049 points de code → `null` ; **un `href` ASCII de 2 040 points dont le chemin porte dix `"` (encodés `%22` par `URL`, donc > 2 048 après
    normalisation) → `null`** ; `javascript:x`, `''`, `null`, `7`, `{}` → `null`. Mutants : règle ASCII retirée (U+2028 admis) → rouge ; borne
    après `lienSignet` retirée → rouge.
  - « `memeAdresseImage` » — `HTTPS://A.TEST:443/i.jpg` et `https://a.test/i.jpg` → vrai ; deux adresses différentes → faux ; une adresse refusée
    des deux côtés → faux.
  - « `candidatPhotoWeb` : table (D-F10) » — fiche sans photo + image admise → `href` ; `photo_origin: 'image'` + pointeur → `null` ; `'photo'` →
    `null` ; origine `null` + pointeur valide → `null` ; `'web'` + même `photo_source_url` → `null` ; `'web'` + la même sous une autre forme
    (`HTTPS://…:443/…`) → `null` ; `'web'` + autre adresse → `href` ; pointeur hostile (`'../x'`) + `'image'` → traité comme sans photo → `href` ;
    image `http:` → `null`. Mutant : sans la règle `photo_origin !== 'web'` → rouge.
  - « `lireImageWeb` : l'appel » — un POST `{ outil: 'image-web', corps: { url } }` exact vers `/functions/v1/assistant`, trois en-têtes
    (`content-type`, `apikey`, `authorization`), `redirect: 'error'`, `credentials: 'omit'` ; le `fetch` factice rend le 200 d'une image à la borne
    (2 097 152 octets, ≈ 2,7 Mio de JSON : au-delà des 2 Mio de `LIMITES_PASSERELLE.corps`) et il est LU (mutant : `corpsMax` omis →
    `reponse_illisible` → rouge) ; `tentativeMs` passé = 90 000 ; sans session → `non_connecte`, zéro fetch ; `url`
    en `http:` → `adresse`, zéro fetch ; signal levé → `annule`.
  - « `lireImageWeb` : le 200 est une donnée hostile » — `type: 'image/gif'` → `illisible` ; `taille: 0` → `illisible` ; `taille: 2 097 153` →
    `image_trop_lourde` et `atob` jamais appelé (espion posé et retiré en `try/finally`) ; `octets: '@@'` → `illisible` ; longueur ≠
    `4 * ceil(taille / 3)` → `illisible` ; décodé de longueur ≠ `taille` → `illisible` ; `octets` absent, `type` porté par le prototype (objet à
    `__proto__`) → `illisible` ; valide → `{ etat: 'recue', blob }` du bon type et de `taille` octets.
  - « table serveur → client » — `{ erreur: 'pas_une_image' }` 422 → `pas_une_image` ; `{ erreur: 'image_trop_lourde' }` 413 →
    `image_trop_lourde` ; `{ erreur: 'interdit' }` 422 → `interdit` ; `{ erreur: 'inaccessible' }` 502 → `inaccessible` ; `{ erreur: 'quota',
    quota: 60 }` → `quota` ; 429 nu → `trop_de_demandes` ; 504 → `delai` (`tests/passerelle.js` : « `RAISON_DE_ERREUR` lit `pas_une_image` et
    `image_trop_lourde` ; `echecDomaine` les relaie avec `extra: {}` »).
  - « le jeton n'est dans aucun résultat » (`JSON.stringify` de chaque issue de ce bloc et du bloc rapatriement) ; « toute raison rendue ∈
    `RAISONS_PHOTO_WEB` » ; « `RAISONS_DEFINITIVES` ⊂ `RAISONS_PHOTO_WEB` ».
- **Mur distant** (`src/core/image.js`) : « `preparerPhotoDistante` : un JPEG 600 × 400 → un JPEG ≤ 1 200 px » ; « octets PNG annoncés `image/jpeg` →
  `indecodable` » ; « `image/heic` → `type` » ; « 5 Mio + 1 → `trop_lourde` (le mur commun `octetsDistants`, inchangé) » ; « **un JPEG 199 × 600 →
  `trop_petite`** ; 200 × 600 → accepté » ; « en-tête 5 000 × 4 000 → `trop_grande` AVANT décodage (espion : `createImageBitmap` jamais appelé) » ;
  « 10 octets nuls annoncés `image/jpeg` → `indecodable` » ; « `preparerPhotoLocale` inchangée : un `image/heic` d'en-tête illisible passe au
  ré-encodage » (régression). Mutants : contrôle `dims.type !== blob.type` retiré → rouge ; plancher de 200 px retiré → rouge.
- **Composant** :
  - (`tests/ajouter.js`, à côté des l. 1212-1225) « `renderZoneCouverture` sans troisième argument : `span` « Couverture », « Retirer » sans
    `aria-label` (inchangé) ; avec `{ libelle: 'Photo du plat', nomRetirer: 'Retirer la photo du plat' }` : `span` « Photo du plat », les mêmes
    boutons dans le même ordre, « Retirer » porte `aria-label` « Retirer la photo du plat » ».
  - « `etatZonePlat` : les six cas de § 4.1.2 » (table : `sha256`, `message`, `web`, `raison`, `offreReessayer`, `peutReessayer`, `absente`,
    `enCours`) ; « en vol avec une photo web en place → cas 2 + `web: 'en_cours'` » ; « pointeur hostile → cas 1 (ou 4/5 avec un candidat) » ;
    « `peutReessayer` faux hors ligne, faux sans compte » ; « `occupe` → `enCours` » ; « une raison gardée pour une AUTRE adresse est ignorée » ;
    « raison `quota` avec `tape: true` → le texte du quota ; même raison avec `tape: false` → `raison: null` » ; « raison `pas_une_image`, `tape:
    false` → « L’image de cette page ne peut pas être utilisée. », `offreReessayer: false` ».
  - « `texteEchecPhotoWeb` : table de § 4.1.2 » (chaque ligne, dont `delai` → « L’appel a peut-être été compté ; relancer en coûtera un autre. »,
    `serveur` → « … Code : serveur », refus avant l'appel → `null`).
  - « `renderZonePhotoPlat` : textes exacts et `data-role` par cas » — cas 1 : « Ajoute une photo du plat : elle illustre la recette dans tes listes.
    », boutons `['Photographier', 'Choisir une image']` ; cas 2 et 3 : `['Photographier', 'Choisir une image', 'Retirer']`, aucun message, aucun
    « Télécharger » ; cas 4 : `[data-role="photo-web-etat"][role="status"]` « Récupération de la photo du plat… », boutons d'ajout allumés ; cas 5 :
    « Photo du plat non récupérée. », `button.btn` « Réessayer » allumé (classe `btn` sans `small`), `[data-role="cout-photo-web"]` « Un appel de
    plus, compté dans ton quota du jour. », « Ne pas récupérer » ; puis « Réessayer » éteint avec « Tu es hors ligne. » / « Connecte-toi pour utiliser
    l’assistant. » dessous ; raison définitive → aucun « Réessayer », aucune ligne de coût, « Ne pas récupérer » présent ; `enCours` → tous les
    boutons éteints, « Réessayer » et « Ne pas récupérer » compris ; aucun `<a>`, aucun `<label>`, aucun `img` (`apercu: null`) ; **raison
    `non_connecte` gardée d'une tape, puis sans compte** → « Connecte-toi pour utiliser l’assistant. » UNE seule fois dans la zone (mutant : la ligne
    sous le bouton éteint rendue quand même → deux fois → rouge).
- **Fiche** (`tests/photo-plat.js`, `renderRecipe(params, query, ctx, { pickFiles, toast, fetch, enLigne })` et `monterPhotoPlat`, bases jetables) :
  - « places » — fiche avec version et pages sources : `[data-role="emplacement-photo-plat"]` avant la carte des contrôles ; la `section` « Photo du
    plat » (`[data-role="zone-photo-plat"]`) après `.recipe-body` et avant la section « Original » ; « deux zones distinctes » (I-6) : aucune `img`
    de la zone, les pages restent dans « Original » ; aucun nœud texte direct sous la racine (règle l. 1320 du lot A, avec et sans photo).
  - « D-F8 » — `reference_only` sans version → aucune zone ; signet sans version → aucune zone (`blocSignet` seul) ; fiche sans version avec un
    pointeur et des octets → l'image en tête (lot A), aucune zone ; **fiche `origine: 'ia'` avec version → zone présente, aucun candidat, aucun
    POST** (D-F5).
  - « **monter ne lance aucun appel** (I-F11, S-5) » — une fiche au cas 5 (`photo_source_url` admis, aucun pointeur) posée par une passe de
    synchronisation factice (`origin: 'remote'`) PUIS une fiche au cas 5 restaurée d'une archive : `renderRecipe` des deux → zéro fetch, la zone
    dit « Photo du plat non récupérée. ». Mutant : `monterPhotoPlat` lance `rapatrierPhotoWeb` au cas 5 → rouge.
  - « « Choisir une image » » → `pickFiles({ accept: 'image/*', multiple: false })` exact ; `files` reçoit le JPEG ré-encodé (empreinte =
    `sha256Hex(await preparerPhotoLocale(img))`), ligne `files` sans `original_filename` (`mime: 'image/jpeg'`) ; `recipes { photo_sha256,
    photo_origin: 'image', photo_source_url: null }` ; toast « Photo du plat enregistrée. » ; `[data-role="photo-plat"] img` en `blob:`, `alt`
    « Photo du plat » ; zone cas 2.
  - « « Photographier » » → `{ accept: 'image/*', multiple: false, capture: 'environment' }`, `photo_origin: 'photo'`.
  - « « Choisir une image » sur une photo en place » → nouveau `sha256`, l'ancienne ligne `files` reste ; l'ancienne URL `blob:` de l'en-tête est
    révoquée APRÈS le remplacement (espion sur `URL.revokeObjectURL` ; l'URL révoquée n'est plus dans le document au moment de la révocation).
  - « **remplaçable à la main, depuis une photo WEB** (D-F14, B-10) » — fiche `photo_origin: 'web'`, `photo_source_url` posé, octets ici, légende
    présente → « Choisir une image » → `photo_origin: 'image'`, `photo_source_url: null`, légende absente ; puis une relecture de la même page
    (lecture factice, même `image_url`) → aucune annonce, zéro POST `image-web`. Mutant : `poserPhotoPlat` qui ne remet pas `photo_source_url` à
    `null` → rouge.
  - « « Retirer » » → trois champs à `null`, toast « Photo du plat retirée. », les octets restent, en-tête vide (aucune `figure`), zone cas 1 ;
    « Retirer » porte `aria-label` « Retirer la photo du plat ».
  - « un PDF » → toast « Cette image ne peut pas être lue ici. Essaie une autre photo. », rien d'écrit.
  - « **relecture C4** » — le titre est changé en base entre le rendu et « Choisir une image » → la fiche écrite porte le NOUVEAU titre et la
    photo. Mutant : `{ ...recipe }` du rendu au lieu de la fiche relue → rouge.
  - « fiche supprimée entre le rendu et le geste » → toast « Recette introuvable. », aucune fiche recréée (mutant : écriture sans relecture → la
    fiche ressuscite → rouge), **aucune ligne `files` neuve** (relecture avant `putFile`).
  - « D-F15 : un geste ne redessine que la photo » — unités passées à « Métrique » et portions à 6 avant « Choisir une image » → après le geste, le
    segment « Métrique » est toujours actif et `#servings-val` vaut 6 ; aucun événement `cuisineos:refresh` émis (écouteur espion). Mutant :
    `refresh()` à la place de `dessiner()` → l'événement est vu → rouge.
  - « pendant une écriture » — `monterPhotoPlat` avec un `repo` injecté dont `putFile` attend une barrière tenue par le test : pendant l'attente,
    les boutons de la zone sont `disabled` (constaté sur le DOM, jamais après un délai) ; **`gestes.choisir()` appelé directement** (pas un clic :
    un clic sur un bouton désactivé ne déclenche rien, garde ou pas) → `pickFiles` n'est pas rappelé ; la barrière levée, UNE écriture `recipes`.
    Mutants : `enCours` ignoré au rendu (boutons allumés) → rouge par l'assertion `disabled` ; **garde `if (occupe) return` retirée** → un second
    `pickFiles` → rouge.
  - « légende » — `photo_origin: 'web'` avec octets et `source_url: 'https://recettes.test/x'` → `figcaption` « Image de la page recettes.test » ;
    `source_url` illisible → « Image de la page web » ; `'image'` → aucune légende ; jamais `photo_source_url` ni son hôte (un CDN distinct,
    `cdn.test`) dans le texte de la page (D-F11).
  - « lot A inchangé » — le bloc « Fiche (spec § 4.3.6) » de `tests/import-cible.js` (l. 1293-1330) passe sans changement (I-F9).
- **Pointeur sans octets** (§ 4.1.4 ; moteur factice et `contexteFichiers` du lot G, comme le test G « photo du plat distante ») : « `distant` +
  compte → dans `[data-role="photo-plat"]`, EXACTEMENT un bouton « Télécharger » ; dans `[data-role="zone-photo-plat"]`, AUCUN » (sélecteurs bornés
  aux deux `data-role` : le « Télécharger les {n} pages » d'« Original » n'est jamais compté) ; « « Télécharger » (moteur factice qui écrit le
  blob) → l'image en tête, sans `refresh()`, la zone inchangée » ; « `absent` → le texte de G en tête, aucun bouton » ; « sans compte → « Connecte-
  toi pour la télécharger » en tête » ; « aucune ligne `files` → rien en tête (lot A, l. 1316) ». Mutant : la zone rend aussi l'état → deux
  « Télécharger » → rouge.
- **Rapatriement** (`tests/photo-plat.js`, `fetch` factice qui rend une PNG 800 × 600 en base64 ; chaque test attend `attendreRecuperation`) :
  - « fiche à `photo_source_url` sans photo → un POST `image-web` avec l'adresse de la fiche RELUE ; `files` reçoit le JPEG ré-encodé ;
    `recipes { photo_sha256, photo_origin: 'web' }`, `photo_source_url` conservé ; `{ issue: 'ok' }` ».
  - « **seul `/functions/v1/assistant` est appelé** (S-8, I-F3) » — un `fetch` factice qui enregistre chaque adresse, pendant tout le bloc
    rapatriement : aucune autre adresse. Mutant : `lireImageWeb` qui récupère l'image directement par `fetch(url)` → rouge.
  - « deux appels entrelacés sur la même fiche → UN POST, le second `vol_tenu` » (mutant : `enVol` posé après le premier `await` → deux POST →
    rouge) ; « deux fiches → deux POST ».
  - « `photo_origin: 'image'` + pointeur → `photo_manuelle`, zéro POST » ; « `'web'` + même adresse sans candidat neuf → `deja_la`, zéro POST » ;
    « `photo_source_url` en `http:` → `adresse`, zéro POST » ; « hors ligne → `hors_ligne` ; sans session → `non_connecte` ; zéro POST ».
  - « **adresses comparées normalisées** (S-10) » — une fiche dont `photo_source_url` vaut `HTTPS://A.TEST:443/i.jpg` → la descente aboutit (`ok`,
    jamais `fiche_changee`). Mutant : comparaison brute (`!==`) → rouge.
  - « **fiche changée pendant la descente** » — une photo choisie entre le POST et l'écriture (la fiche relue porte `photo_origin: 'image'`) →
    `fiche_changee`, la photo de la personne intacte, **aucune ligne `files` neuve** (garde avant `putFile`) ; la même photo choisie PENDANT
    `putFile` (barrière) → `fiche_changee`, `files` porte le JPEG orphelin. Mutant : écriture sans garde → la photo de la personne est écrasée →
    rouge. « « Retirer » ou « Ne pas récupérer » pendant la descente → `fiche_changee` ». « fiche supprimée pendant la descente → aucune ligne
    `files` neuve ».
  - « **relecture dont l'image a changé** (D-F18, B-4) » — fiche `'web'` (adresse A, octets A) ; descente avec `candidat` B qui RÉUSSIT → les trois
    champs ensemble (`photo_sha256` neuf, `'web'`, `photo_source_url` B) ; la même qui ÉCHOUE (`inaccessible`) → `photo_sha256` A et
    `photo_source_url` A INTACTS (la provenance reste vraie), zone cas 2. Mutant : `photo_source_url` B écrit avant la descente → après l'échec, la
    fiche porte l'image A avec l'adresse B → rouge.
  - « échec serveur (`inaccessible`, `pas_une_image`, `image_trop_lourde`, `quota`) → `{ issue: 'echec', raison }`, `logError('photo_web.echec')`
    espionné, fiche INTACTE, aucun toast » ; « image reçue déguisée (PNG annoncée jpeg) → `echec(indecodable)`, rien d'écrit » (mutant :
    `preparerPhotoLocale` à la place de `preparerPhotoDistante` → la PNG déguisée passe et s'écrit → rouge) ; « une PNG 150 × 150 → `echec(trop_petite)`,
    rien d'écrit ».
  - « la zone montée passe par « Récupération de la photo du plat… » (vérifié PENDANT la descente, `fetch` factice suspendu) puis l'image en tête
    (après) ; sur échec au départ automatique : « Photo du plat non récupérée. » + « Réessayer » + ligne de coût + « Ne pas récupérer », AUCUNE raison
    dite » ; « « Réessayer » → un POST, puis l'image » ; « **« Réessayer » qui échoue sur `quota`** → la zone dit « Tu as atteint la limite du jour
    pour l’assistant (60 appels). », aucun toast » ; « **départ automatique sur `quota`** → aucun texte de raison » ; « départ automatique sur
    `pas_une_image` → « L’image de cette page ne peut pas être utilisée. », aucun « Réessayer » » ; « « Réessayer » hors ligne → bouton éteint, zéro
    POST » ; « **« Réessayer » avec `ctx.sync.user` posé et une session nulle** (jeton factice qui ne répond pas en 2 s) → zéro POST, la zone dit
    « Connecte-toi pour utiliser l’assistant. » (mutant : `non_connecte` d'une tape non gardé → zone muette → rouge) » ; « **« Ne pas récupérer »** →
    les trois champs à `null`, zone cas 1, zéro POST, aucun toast » ; « photo choisie PENDANT la descente → la photo de la personne reste (I-F5) ».
  - « l'écriture passe par la capture » — l'outbox reçoit une entrée `recipes` (origine `local`) portant `photo_sha256` et `photo_origin: 'web'`
    (`tests/sync.js`-like, transport factice) : la photo voyagera (les octets : lot G).
- **Import web** (`tests/lecture-web.js`, lot B, ajouts ; chaque test qui enregistre attend `attendreRecuperation`) : « `lirePage` : `image_url`
  admise gardée, `http:` → `null`, absente → `null`, hostile (U+2028) → `null` » ; test de source « `image_url` passe par `adresseImageAdmise(` dans
  `lirePage` » ; « `fabriquerLectureWeb` : fiche sans photo + annoncée → `photo_source_url` = l'adresse, `photoWeb` = l'adresse ; fiche `'image'` →
  `photoWeb: null`, `photo_source_url` inchangé ; fiche `'web'` + autre `image_url` annoncée → `photoWeb` = l'adresse, `photo_source_url`
  INCHANGÉ (D-F18) ; `remplacer: false` → signet intact (aucune clé changée), `photoWeb` = l'adresse ; `photoAnnoncee` nulle ou différente →
  `photoWeb: null` ; `photo_sha256` jamais touché par la fabrication ; signet relu `photo_origin: 'appareil'` → `photo_origin: null`, aucune levée
  (D-F19) » ; « écran a_verifier : « Après l’enregistrement, l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté
  dans ton quota du jour. » présent avec une `image_url` et un candidat ; absent sans image ; absent quand la fiche a une photo de la personne ;
  absent quand la même image web est déjà là » ; « **ordre** — « Enregistrer » : la transaction (`recipes`, `recipe_versions`, `imports
  enregistre`) est écrite AVANT le premier POST `image-web` (ordre des `db.mutate` et des `fetch` espionnés), puis UN POST `image-web`, puis
  `files` et `photo_sha256`. Mutant : rapatriement lancé avant la transaction → rouge » ; « **annonce et déclenchement, les deux sens** (S-12) —
  annonce affichée, puis une photo posée dans un autre onglet avant « Enregistrer » → zéro POST ; aucune annonce au rendu (fiche avec photo), puis
  photo retirée avant « Enregistrer » → zéro POST (rien n'a été annoncé) » ; « `TransitionRefusee` à l'enregistrement → aucun POST `image-web` » ;
  « **« Ajouter sans remplacer »** → la transaction n'a AUCUN `put recipes` (B-24 inchangé : `puts` = `imports` + `recipe_versions`, `updated_at`
  de la fiche inchangé), PUIS un POST `image-web` ; réussite → les trois champs ; échec → fiche intacte, aucune ligne « non récupérée » » ;
  « « Annuler » du dialogue → zéro POST » ; « échec du rapatriement → l'import reste `enregistre`, la version et `availability` intactes, la zone dit
  « non récupérée » (I-F4) » ; « relecture : photo `'web'` + même `image_url` → aucun POST ; autre `image_url` → un POST et la photo remplacée ;
  photo `'image'` → aucun POST, photo intacte ».
- **Cartes** (`tests/photo-plat.js`) : « `vignettePlat` : pointeur + octets → `img.plat-vignette` visible, `src` `blob:`, `alt` vide ; pointeur sans
  octets → `hidden` reste vrai, aucun `src` ; sans pointeur → `null` ; `mime` hors liste (`text/html`) → `hidden` ; `mime` `application/pdf` (permis
  par la liste blanche, mais pas une image) → `hidden` ; ligne `mime: 'image/heic'` dont le blob est `image/jpeg` → visible (la règle
  `typeAffichage` de G : le type du blob gagne) » (mutants : `src` posé sans octets → rouge ; garde `image/` retirée → un PDF dans un `<img>` →
  rouge) ; « `recipeCard` : la vignette est le premier enfant de `.col`, avant le badge ; sans photo, `outerHTML` égal à celui d'une carte rendue
  sans le lot (référence construite dans le test) » ; « `renderMeal` : la vignette à gauche du titre avec octets ; sans photo, le DOM de la carte
  est celui d'aujourd'hui » ; « `renderSearch` : après que CHAQUE `img.plat-vignette` a son `src` (fait attendu), un redessin (retrait d'une puce)
  révoque les URL des vignettes précédentes (espion sur `URL.revokeObjectURL`, compte exact) ; `book.js` `drawList` (filtre) de même » (mutant :
  révocation retirée d'un redessin → rouge) ; « `styles.css` : `.plat-vignette` 72 × 72, `object-fit: cover`, `var(--line)` ; `tests/theme.js` :
  T-1 inventaire inchangé (cinq), T-2 aucune couleur en dur ».
- **CSP et sources** (`tests/ajouter.js` l. 1844 inchangé ; `tests/photo-plat.js`) : « `img-src 'self' blob: data:` toujours » ; test de
  source : « `photo-plat.js`, `components.js`, `meals.js` : aucun `src:` ni `.src =` suivi d'une chaîne `http` » ; « `Anthropic|Supabase` absent
  de `photo-plat.js`, `photo-web.js` et `base64.js` » ; « `photo_source_url` n'apparaît dans aucun `textContent`, aucun `t(` ni aucun `el(` de
  `photo-plat.js` et `recipe.js` » (D-F11).
- **Régression** : « « Corriger » (`recipe-edit.js`) sur une fiche à photo → la fiche écrite garde `photo_sha256`, `photo_origin`,
  `photo_source_url` » ; « **D-F16, ★ Favori** (tâche 3, rouge d'abord) — fiche rendue sans photo, puis `rapatrierPhotoWeb` aboutit (la photo est
  écrite), puis clic ★ → la fiche écrite porte `favorite: true` ET `photo_sha256`, `photo_origin: 'web'`. Mutant : `{ ...recipe }` du rendu →
  photo effacée → rouge » ; « **D-F16, « Corriger »** (tâche 5) — éditeur rendu, puis une photo écrite en base (descente ou autre onglet), puis
  « Enregistrer » de l'éditeur → la fiche écrite porte les trois champs de la BASE. Mutant : champs de la copie → rouge » ; « **D-F19, « Corriger »**
  — fiche relue avec `photo_origin: 'appareil'` → « Enregistrer » de l'éditeur ne lève pas, `photo_origin: null` écrit » ; « archive aller-retour
  d'une fiche à `photo_source_url` et `photo_origin: 'web'` : champs intacts, `verifyRestored` zéro écart » ; « les tests des lots A, B, G, C, D, E
  restent verts, sauf les amendements nommés (I-F9) ».
- **Versions, coquille, dictionnaire** : `APP_VERSION 0.15.0` (pins relevés en Python sur `tests/` : `0.14.0` et `v0\.14\.0` de la tête du lot E) ;
  `sw.js` `cuisine-os-v0.15.0-N`, `SHELL` + `./src/domain/photo-web.js` + `./src/domain/base64.js` + `./src/ui/photo-plat.js` (graphe d'imports de
  `tests/sync.js`) ; total épinglé N−1 ; filet i18n : `'photo-plat.js'` dans les `sources` de `sansEntree` (`tests/creer-ia.js` l. 1238), chaque
  texte de § 5 dans `en.js` ; `DB_VERSION` 4.

### 7.5 Mutants (sur copies servies à part ; chacun doit rougir)

Rapatriement avant la transaction d'« Enregistrer » · écriture de la fiche sans garde des trois champs (photo de la personne écrasée ; fiche
supprimée ressuscitée) · `putFile` avant la garde (ligne `files` neuve pour une fiche supprimée) · `photo_source_url` écrit avant la descente d'une
relecture (provenance fausse après un échec) · comparaison d'adresses brute · `candidatPhotoWeb` sans la règle `photo_origin !== 'web'` · un appel
lancé sans annonce, ou pour une autre adresse que l'annoncée · « Retirer » qui garde `photo_source_url` · `poserPhotoPlat` qui ne remet pas
`photo_source_url` à `null` · `monterPhotoPlat` qui lance un rapatriement au cas 5 · raison dite après le départ automatique (`quota`) · « Réessayer »
offert après une raison définitive · `lireImageWeb` qui récupère l'image par `fetch` direct · `corpsMax` omis sur `image-web` · `dims.type !==
blob.type` retiré · plancher de 200 px retiré · `preparerPhotoLocale` employée pour l'image web · `adresseImageAdmise` sans la règle ASCII, ou sans
la borne après `lienSignet` · `fabriquerExtraction` qui recopie l'origine brute · `vignettePlat` qui pose un `src` sans octets, ou qui ignore la
règle d'affichage · révocation des vignettes retirée d'un redessin · `enVol` posé après le premier `await` · `refresh()` après un geste (D-F15) ·
★ Favori ou « Corriger » qui écrivent les champs de la photo de leur copie (D-F16) · boutons allumés pendant une écriture · garde `occupe` retirée ·
état du fichier absent rendu deux fois (I-F10) · `OUTILS` sans `'image-web'` · `corpsModele` laissé à `lu.corps` pour `image-web` ·
`typeImageAdmis` qui admet `image/svg+xml` · signature non contrôlée · WebP admis sur `RIFF` seul · `imageUrlDe` sans `valideAdresse`, sans
résolution, ou sans la garde `autresRecettes` · image lue sur le premier `Recipe` au lieu du retenu · `TRANCHE_BASE64 = 32768` · `lire` appelé
hors des minuteries · `referer` ajouté aux en-têtes · réservation après `telechargerImage` · second `await fetch(` dans `telechargerImage` ·
`image_url` rendue quelque part (D-F11, test de source) · `ORIGINES_PHOTO` remplacée par `PHOTO_ORIGINS` · `PHOTO_ORIGINS` sans `'web'` (la
fabrication du rapatriement lève `ErreurVocabulaire` : le test « ok » rougit) · borne d'une image remise à 5 Mio (`LIMITES_IMAGE.octets` ou
`LIMITES_IMAGE_WEB.octets`) · `corpsReponse` sous le base64 de la borne · minuterie du saut retirée à la réception des en-têtes (u6 bis, D-B26
affaibli) · `non_connecte` d'une tape non gardé · « Connecte-toi… » rendu deux fois.

## 8. Hors périmètre (nommé pour ne pas y glisser)

Galerie et plusieurs photos par recette ; recadrage ; image générée ; image produite ou cherchée pour une création IA (`creer-ia.js` refuse toute clé
`image`, `CLES_REFUSEES` ; la photo que la personne pose elle-même sur une fiche IA, elle, est dans le lot : D-F5, R-F-3) ; « Utiliser cette page »
(une page source comme photo du plat) et la **récupération depuis une page photographiée** (04 § F, 01 point 4, 03 § 4 : proposition de récupération
ou de recadrage, avec correction possible — le **lot H**, futur, hors de la chaîne A à G, R-F-5 ; en attendant, la personne pose sa propre photo) ;
photo dans le mode cuisine (`cook.js`), dans « Reprendre ma recette » et « Dernières cuissons » (`home.js`, pas des `recipeCard`), dans la liste des
repas (`renderMeals` : des repas, pas des recettes) ; photo dans les exports (`toJsonLd` `image`, YAML, site lisible `toReadableSite`) ;
`cook_history.photos` (toujours `[]`, `cook.js` l. 188) ; octets entre appareils et « Télécharger » (lot G : F s'y branche, § 4.1.4) ; image d'une
page `http:` ; `image/gif`, HEIC web, SVG ; réponse binaire de la fonction (§ 11) ; lecture groupée `getFiles` par rendu de cartes ; unification des
libellés de l'écran ciblé (« Prendre une photo », « Remplacer ») avec ceux de la fiche (D-F14) ; nom accessible du « Retirer » de la COUVERTURE (seule
la photo du plat reçoit le sien) ; unification de `poserCouverture(…, { origine: 'distante' })` sur `preparerPhotoDistante` ; rapatriement sur une
tape seulement (point à trancher 1) ; bandeau pleine largeur (point à trancher 2) ; une photo posée sur une référence sans texte depuis sa fiche
(D-F8 : c'est l'écran ciblé qui la pose) ; une détection de logo ou de publicité au-delà de la garde `autres_recettes` et du plancher de 200 px
(aucune lecture du contenu de l'image) ; une image de plus de 2 Mio (R-F-4) ; toute migration (R-F-1 : la contrainte `outil` vient de `0006` du
lot B).

## 9. Ordre des tâches (découpage TDD, cinq tâches, chacune avec sa suite verte : navigateur, `node --test tools/*.test.mjs`, `--check` 0)

Chaque tâche : test rouge d'abord (rejoué contre le code d'avant), puis vert ; `sw.js` `VERSION` +1 dès qu'elle touche `src/` ; total épinglé
relevé dans « obtenu » ; aucun caractère invisible dans les fichiers touchés (contrôle en Python) ; numéros de ligne relus à la tête du lot E
(R-C-7).

1. **Serveur.** Relire d'abord le code RÉEL de B (`supabase/functions/assistant/lecture-web.js`, `logique.js`, `index.ts`) et amender ici, § 12, tout
   nom de B qui aurait changé (§ 11) ; constater que `0006`, son test croisé et sa preuve portent les cinq outils (R-F-1,
   § 6.4), sinon s'arrêter et le remonter au chef d'orchestre (§ 11). `lecture-web.js` (`LIMITES_IMAGE`, `typeImageAdmis`,
   `signatureImage`, `imageDe`, `imageOgDe`, `imageUrlDe` avec `autresRecettes`, `TRANCHE_BASE64`, `versBase64`, `lirePageHtml` → `page.image_url`),
   `logique.js` (`OUTILS` à cinq, `OUTILS_MODELE`, `lireDemandeUrl` partagée, `lireDemande` pour `image-web`), `index.ts` (`suivreRedirections`
   extraite de `telechargerPage` avec le rappel `lire` sous les minuteries, `telechargerImage`, le bloc `image-web` de `traiter`, `corpsModele` par
   `OUTILS_MODELE`) ; tests § 7.1-7.2, sauf le chaînage serveur → client (tâche 2) (dont
   u6 bis pour `lecture-web` — 15 s par saut, corps compris (R-F-6), rouge d'abord sur la boucle extraite naïvement —, t2/t3 de B amendés et le
   bloc d'ordre réécrit) ; contrainte `outil` : § 7.3 seulement (F n'écrit aucune migration, R-F-1) ; `tsc --strict` 0. Aucun écran.
2. **Schéma et domaine client.** `schema.js` (`PHOTO_ORIGINS`, `HASH` exporté), `vocabulaire.js` (`recipes.photo_origin`, `originePhotoAdmise`),
   `src/domain/import-cible.js` (une ligne : `originePhotoAdmise` ; `ORIGINES_PHOTO` intouchée ; aucune clé ajoutée), `src/core/image.js`
   (`preparerPhotoDistante`, `COTE_MIN_DISTANT`), `src/domain/photo-web.js` (neuf : `LIMITES_IMAGE_WEB`, `adresseImageAdmise`, `memeAdresseImage`,
   `candidatPhotoWeb`, `lireImageWeb`, `RAISONS_PHOTO_WEB`, `RAISONS_DEFINITIVES`), `src/domain/base64.js` (neuf : `lireOctetsBase64`, et le test
   Node de chaînage avec `versBase64` de la tâche 1), `src/domain/passerelle.js` (deux raisons),
   `src/domain/lecture-web.js` (B : `lirePage.image_url`, `fabriquerLectureWeb` : `photoAnnoncee`, `photo_source_url` sur fiche sans photo,
   `photoWeb` rendu, `originePhotoAdmise`) ; tests § 7.4 (vocabulaire et D-F19, domaine, mur distant, `lirePage`, fabrication, passerelle) ; formes
   exactes de `page` côté client dans `tests/lecture-web.js` relevées et amendées (nommées) ; `SHELL` + `./src/domain/photo-web.js` +
   `./src/domain/base64.js` ; `APP_VERSION 0.15.0` et ses pins ; `sw.js` +1.
3. **Fiche.** Relire d'abord ce que G a fait de `photoDuPlat`, de `contexteFichiers`, de `typeAffichage` et de `renderZoneCouverture` (plan G,
   tâche 6 ; G § 4.2, § 4.4) : l'état d'un fichier absent reste EN TÊTE (§ 4.1.4) ; tout écart au plan G est un amendement nommé en § 12.
   `src/ui/photo-plat.js` (neuf : `figurePhotoPlat`, `etatZonePlat`, `texteEchecPhotoWeb`, `renderZonePhotoPlat`, `monterPhotoPlat`,
   `poserPhotoPlat`, `retirerPhotoPlat`, `rapatrierPhotoWeb`, `attendreRecuperation`, `recuperationEnCours`, `ligneAnnoncePhotoWeb`,
   `reinitialiserPhotoPlat`), `livre-ajout.js` (options `libelle` et `nomRetirer`), `recipe.js` (quatrième paramètre, `monterPhotoPlat`,
   `photoDuPlat` déplacée, `favBtn` relu : D-F16, **avec son test ★ Favori, rouge d'abord**) ; recensement D-F16 refait sur la tête du lot E pour
   les écritures de `recipes` qui partent d'une copie du RENDU de la fiche ; tests § 7.4 (composant, fiche, pointeur sans octets, rapatriement) ;
   `en.js` (dont la valeur anglaise de « Photo du plat · {titre} » de G, si besoin, § 5) ; filet i18n (`photo-plat.js` dans `sources`) ;
   `SHELL` + `./src/ui/photo-plat.js` ; `sw.js` +1.
4. **Cartes illustrées.** `components.js` (`vignettePlat`, `urlsDesVignettes`, `recipeCard`), `meals.js` (`renderMeal`), `search.js` / `book.js`
   (révocation au redessin), `styles.css` (`.plat-vignette`), `tests/theme.js` (inventaire et T-2 inchangés, relus) ; tests § 7.4 (cartes, CSP et
   sources) ; `sw.js` +1.
5. **Import web → rapatriement, régression, docs.** `import-web.js` (B : annonce a_verifier par `ligneAnnoncePhotoWeb`, `photoAnnoncee` gardée,
   `enregistrerLecture` reçoit `fetch`, `enLigne` et `photoAnnoncee`, déclenchement après la transaction, y compris sur « Ajouter sans
   remplacer »), `recipe-edit.js` (D-F16 et D-F19 : les trois champs de la photo repris de la fiche relue) ; recensement D-F16 refait sur la tête du
   lot E pour TOUTE écriture de `recipes` ajoutée par B, C, D ou E (chaque écrivain qui part d'une copie est corrigé de même, amendement nommé) ;
   tests § 7.4 (import web, régression « Corriger », archive, capture) ; mutants § 7.5 rejoués ; `CLAUDE.md` (section du lot), `STATE.md`,
   `docs/architecture.md` (« `photo_sha256` : pointeur souple », à côté de « `cover_sha256` : pointeur souple ») ; spec § 12 (rulings de
   construction) ; `sw.js` +1.

Clôture (contrôleur) : revue finale de branche, vague, `/verify`, copie du registre dans `~/projects/mistu/.superpowers/sdd/` AVANT tout `git worktree
remove`, puis D-F6 (redéploiement, sondes) et § 10 (gestes de Neegan).

## 10. Preuve réelle (gestes de Neegan et du contrôleur ; dépense dite à chaque pas)

1. **Avant tout `push`** (Neegan) : rien à coller pour F — `0006`, à cinq outils, a été collée et prouvée avec le lot B (R-F-1) ; le contrôleur
   relit dans `RESULTATS-mitsu.md` le verdict 2.031 (ex-2.03 bis ; `image-web` réservé : « id non nul ») avant le redéploiement. Sans dépense.
2. Le contrôleur redéploie la fonction (§ 6.5) et joue, avec la session de Neegan lue comme au README (étape 10, `read -rs JETON`), les sondes sans
   dépense : **S-F1** `POST { outil: 'image-web', corps: { url: 'http://exemple.test/i.jpg' } }` → 422 `{ erreur: 'interdit' }`,
   `assistant_usage_jour` inchangé ; **S-F2** `https://127.0.0.1/i.jpg` → 422 ; **S-F3** sans jeton → 401 ; les sondes S1-S9 (lot 4) et S13-S16
   (lot B) rejouées, identiques. **2 bis — deux sondes PAYANTES d'un appel chacune, zéro jeton** : **S-F4** l'adresse d'une image publique en `https`
   d'un grand site de recettes québécois (choisie au moment du geste, vérifiée d'abord par `curl -sI` : `content-type: image/jpeg`, taille ≤ 2 Mio,
   soit `content-length` ≤ 2 097 152, R-F-4) → 200, `type` et `taille` conformes, `Buffer.from(octets, 'base64').length === taille`, journal
   `image-web` 200 jetons `null` ; noter la durée ; **S-F5** l'adresse d'une page HTML → 422 `pas_une_image`, journal 422. Résultats dans la section
   « Sondes `image-web` » de RESULTATS. Si S-F4 tombe sur un 403 anti-hotlink : le noter tel quel (`inaccessible`), choisir une autre image, ne rien
   contourner (D-F3).
3. **Première photo web réelle** (coûte DEUX appels : la lecture, puis l'image ; zéro jeton si la page a un JSON-LD) : site public, connecté, onglet
   Web, « puttanesca », « Garder et lire » sur une page d'un grand site de recettes québécois → l'écran a_verifier dit « Après l’enregistrement,
   l’app essaiera de récupérer la photo du plat de la page : un appel de plus, compté dans ton quota du jour. » → « Enregistrer » → la fiche
   s'ouvre ; la section « Photo du plat » dit « Récupération de la photo du plat… », puis l'image apparaît en tête avec « Image de la page {le site} » ;
   dans l'éditeur SQL, `select outil, statut, jetons_entree, duree_ms from public.assistant_journal order by id desc limit 3;` montre `lecture-web`
   200 puis `image-web` 200 (jetons `null`). Noter la durée de l'image, et, depuis l'iPhone en réseau mobile, la durée totale jusqu'à l'image en
   tête (la borne de 90 s, D-F13). Puis Mes livres → « Liens web gardés » : la carte porte la vignette ; recherche « puttanesca » : vignette aussi ;
   « Ajouter à mon repas » → la carte du repas porte la vignette.
4. **Échec dit** (un à deux appels) : une page dont l'image est protégée (hotlink) ou absente → la recette est là, la section dit « Photo du plat non
   récupérée. », « Réessayer » avec sa ligne de coût, « Ne pas récupérer » ; « Réessayer » (un appel) → la raison est dite (« Le site de la page n’a
   pas donné son image. ») ; « Ne pas récupérer » → la ligne disparaît, sans appel ; sur une autre fiche, « Choisir une image » pose une photo à la
   main et la ligne disparaît.
5. **Fiche** (sans dépense) : sur une recette de livre importée (lot A) sans photo : section « Photo du plat » → « Photographier » depuis l'iPhone
   (site public, app installée) → l'image en tête, la vignette sur la fiche du livre ; « Choisir une image » remplace ; « Retirer » → l'image et la
   vignette disparaissent (VoiceOver lit « Retirer la photo du plat »). Pendant ces gestes, passer les unités en « Métrique » avant : elles le restent
   (D-F15). Sur la photo web de l'étape 3 : « Choisir une image » → la photo de la personne remplace l'image web, la légende disparaît ; relire la
   page (« Relire la page avec l’assistant ») → aucune annonce, la photo choisie reste (I-F5 ; aucun `image-web` dans le journal).
6. **Deux appareils** (après G) : la photo posée sur l'iPhone apparaît sur le Mac après une passe ; avant la passe des octets, « Télécharger » à UN
   seul endroit de la fiche, en tête (I-F10).
7. **iPhone** : les étapes 3 et 5 depuis l'app installée (aucun WebKit ici ; le décodage d'un JPEG de 2 Mio par `createImageBitmap` et la mémoire
   d'une réponse de ≈ 2,7 Mio en base64 n'ont pas été mesurés).

## 11. Risques et limites assumés

- **Deux appels par recette web** (lecture, puis image) : 60 appels par jour deviennent 30 recettes web illustrées au plus ; dit à l'écran avant
  l'enregistrement ; le point à trancher 1 offre la tape à la place de l'automatique.
- **Base64** : 2 Mio d'image (la borne, R-F-4) font ≈ 2,7 Mio de texte dans la réponse, lus en mémoire par le client (`corpsMax` 3 Mio) puis décodés :
  sur un iPhone, ≈ 5 Mio transitoires par image ; côté fonction, ≈ 5 Mio aussi (non mesuré sur la plateforme). Alternative nommée : réponse BINAIRE
  (`content-type: image/*`) et un chemin client `appelerAssistantBinaire` — un lot de la passerelle, pas celui-ci.
- **Réseau lent** : 90 s couvrent la réponse d'une image à la borne (≈ 2,7 Mio, ≈ 22,4 Mbit) jusqu'à ≈ 0,4 Mbit/s après 30 s de téléchargement
  côté serveur ; en dessous, une image déjà payée échoue `delai` (« L’appel a peut-être été compté ; relancer en coûtera un autre. » après une
  tape).
- **Borne de 2 Mio** (R-F-4) : une image de la page de plus de 2 Mio n'est pas récupérée — 413 `image_trop_lourde`, raison définitive : la zone
  dit « Photo du plat non récupérée. » et « L’image de cette page ne peut pas être utilisée. », sans « Réessayer » ; la personne pose la sienne.
  Choisie parce qu'une réponse base64 de 6,7 Mio (la borne de 5 Mio du brief) n'a jamais été mesurée sur le transfert mobile ni dans la mémoire
  de l'iPhone ; si la preuve § 10 dit de la relever : deux constantes épinglées (`LIMITES_IMAGE.octets`, `LIMITES_IMAGE_WEB.octets`).
- **Protection anti-hotlink et en-têtes** : l'image part avec le `user-agent` de B (qui nomme Mitsu et porte l'adresse du site public du projet :
  chaque recette web illustrée l'envoie maintenant aussi à l'hôte de son image, une seconde exposition par recette), sans `referer`, `origin` ni
  cookie (u2 l'épingle). Un CDN qui exige un `Referer` ou un cookie répond 403 → `inaccessible` → « non récupérée » : respecté, jamais contourné ;
  la personne pose la photo à la main.
- **Pertinence de l'image** : `og:image` est écartée sur une page de liste (`autres_recettes > 0`) et une image de moins de 200 px de petit côté est
  refusée ; un logo ou une photo d'ambiance de grande taille reste possible (aucune lecture du contenu) : « Choisir une image » ou « Retirer ».
- **Le serveur lit la signature, pas l'image** : les premiers octets doivent dire le type annoncé ; c'est le client qui lit l'en-tête
  (`dimensionsImage`) et prouve le type par le ré-encodage ; une image > 16 Mpx, de moins de 200 px ou à en-tête illisible est refusée APRÈS avoir
  été payée et téléchargée.
- **Types annoncés stricts** : un `image/jpg` ou un `application/octet-stream` dont la signature est JPEG est refusé `pas_une_image` (raison
  définitive, appel payé) : choix prudent, cohérent avec la table de `typeImageAdmis` ; à relever si la preuve § 10 en rencontre un.
- **Un relais borné, pas fermé** : rien ne lie l'adresse demandée à une lecture-web précédente ; tout compte admis peut faire descendre, par
  `image-web`, les octets de n'importe quel objet `https` public qui porte une signature JPEG, PNG ou WebP, 60 fois par jour, 2 Mio chacun. La
  liste admise et la réservation le bornent ; le lier à une lecture précédente demanderait un état serveur (un lot de la passerelle).
- **Images animées** (WebP animé) : la première image par canvas ; orientation : `createImageBitmap(…, { imageOrientation: 'from-image' })`
  (repli sans option sur un vieux Safari, `decoder` de `image.js`).
- **Adresses signées ou expirantes** (`?Expires=…&Signature=…`) : chaque relecture voit une « autre » adresse, l'annonce revient et la descente
  repart (un appel, annoncé) ; un « Réessayer » après l'expiration échoue `inaccessible`.
- **Relecture dont l'image a changé, puis échec** : l'ancienne photo web reste, avec SA provenance (D-F18) ; la zone ne dit rien (cas 2) ; la
  relecture suivante de la même page retente (l'adresse diffère encore).
- **Second appareil** (D-F17) : une fiche reçue avec `photo_source_url` sans `photo_sha256` (descente encore en cours sur le premier appareil) dit
  « Photo du plat non récupérée. » + « Réessayer » jusqu'à la passe suivante ; un « Réessayer » là coûte un appel pour une image que l'autre appareil
  descend déjà (deux lignes `files`, une orpheline).
- **Raisons gardées par document** (D-F17) : perdues au rechargement ; « Réessayer » revient alors, même après une raison définitive (un appel de
  plus pour un échec connu, dit par la ligne de coût). Un onglet fermé pendant une descente laisse « non récupérée » au retour, sans raison.
- **Fenêtres de la garde finale** (I-F5 ; construction, T3-R1 et T5-R1, R-F-20 : les écrivains de la photo — rapatriement, pose, retrait, ★ Favori,
  « Corriger », « Créer ma version » — et « Enregistrer » de l'import web (vague, VF-F6) relisent la fiche DANS la transaction par `{ key, fusion }` de
  `repo.saveBatch` : cette fenêtre n'existe plus sur ces chemins ; la spec écrivait :) sur l'appareil, la relecture et l'écriture font deux
transactions — une écriture de la personne déjà en
  file dans IndexedDB peut s'engager entre les deux et être écrasée (la fenêtre d'un `await`) ; les conditions de `db.mutate` (lot A § 3.6) lisent
  `status`, que `recipes` n'a pas : une condition « champs de la photo inchangés » serait une forme neuve de la primitive, hors lot. Entre deux
  appareils, I7 fait gagner l'`updated_at` le plus récent : une photo choisie sur l'iPhone pendant la descente du Mac (jusqu'à 90 s), pas encore
  reçue par le Mac, est remplacée partout par la photo web écrite après ; la ligne `files` de la personne reste, orpheline. D'où « sur cet
  appareil » dans § 1 et I-F5.
- **« Effacer les données de cet appareil » pendant une descente** : la garde avant `putFile` voit la fiche absente et n'écrit rien ; seule la
  fenêtre d'un `await` entre la garde et `putFile` peut réécrire une ligne `files` dans la base vidée (orpheline, L5).
- **Une lecture `files` par carte** (≤ 50 en recherche) : acceptable sur Mac ; `repo.getFiles` (déjà là) par rendu est le remède si l'iPhone peine.
  Une vignette dont l'octet arrive après un redessin garde son URL `blob:` jusqu'au prochain changement de route (`app.js` révoque tout).
- **Autres écritures d'une copie** : D-F16 ferme ★ Favori et « Corriger » pour la photo ; « Corriger » écrit encore, depuis sa copie, les champs
  qu'il n'édite pas (favori, mots-clés… : dette C4 préexistante du lot UX, hors lot) ; les écrivains ajoutés par B à E sont recensés aux tâches 3 et 5.
- **Origine inconnue ramenée à `null`** (D-F19) : une quatrième origine écrite par un appareil plus récent devient `null` dès qu'un appareil plus
  ancien réécrit la fiche (« Corriger », relecture) ; la photo reste, comptée comme celle de la personne (D-F10).
- **Orphelins `files`** : une descente dont la fiche a changé pendant `putFile`, un remplacement, un « Retirer » laissent des octets (L5, règle du lot
  UX ; G ne les envoie pas : `referencesFichiers`).
- **Libellés** : deux jeux pour la même photo (D-F14) — « Prendre une photo » / « Remplacer » sur l'écran ciblé, « Photographier » / « Choisir une
  image » sur la fiche ; en anglais, « Photographier » reste “Take photos” (clé partagée avec les menus qui prennent plusieurs pages) ; le
  « Retirer » de la couverture reste sans nom accessible propre.
- **Si `0006` est collée sans `image-web`** (l'amendement R-F-1 arrivé trop tard pour le lot B) : F écrira `0007` (même gabarit que `0006`,
  sa preuve avec les verdicts de droits et la règle d'affichage de la preuve `0004`, une étape de README, une section de `RESULTATS-mitsu.md`,
  l'empreinte de `0006` épinglée par son test) — un collage de plus pour Neegan, avant le redéploiement et avant le `push` ; sans lui, chaque
  `image-web` répondrait 502 `serveur` (23514 à la réservation), la recette restant enregistrée (I-F4). Constaté à la tâche 1 ; le chef
  d'orchestre rouvre alors ce point (amendement nommé en § 12).
- **Noms du lot B et du lot G non vérifiables dans le code** (ni B ni G ne sont construits à la date de cette spec) : `lirePage`,
  `fabriquerLectureWeb`, `enregistrerLecture`, `import-web.js`, `lecture-web.js`, `valideAdresse`, `telechargerPage`, `appelerAnthropic`,
  `lirePageHtml`, `siteDe`, `decoderEntites`, `nettoyerChaineJsonLd`, `vol.js`, `corpsModele` (B rév. 3 et son prototype) ; `typeAffichage`,
  `contexteFichiers`, `vignettePage`, `gesteTelechargement`, la forme de `photoDuPlat(recipe, ctxF)` (plan G rév. 1) : repris des specs, du plan et
  du prototype ; les tâches 1 et 3 relisent le code réel et amendent ici (§ 12).
- **Mesures absentes** : aucun appel réel `image-web` ; aucune page réelle dont on sache qu'elle porte `image` dans son JSON-LD ou un `og:image`
  absolu (la preuve § 10 le dira) ; Safari et l'iPhone jamais vus ; aucune durée de transfert d'une réponse de ≈ 2,7 Mio sur réseau mobile.

## 12. Ce que la revue a amendé (rév. 1 → rév. 2, puis rév. 2 → rév. 3, puis rév. 3 → rév. 4)

Trois relecteurs (lentilles besoin, sécurité, faisabilité ; 41 constats, dont un Critical). Chaque constat de faisabilité a été vérifié dans le code
du worktree (tête `f8cfafa` puis `bd03e48`, en lecture seule) ou dans les specs, le plan G et le prototype B avant d'être appliqué. Les constats
qui se recouvrent sont appliqués une fois et renvoyés l'un à l'autre.

**Lentille besoin**
- **B-1** (Important) appliqué — « Réessayer » dit son coût (`small.muted` « Un appel de plus, compté dans ton quota du jour. ») ; après une TAPE, la
  zone dit la raison (`texteEchecPhotoWeb`, § 4.1.2 : `texteRefusAssistant` pour `quota` / `non_admis`, le texte de connexion, « Trop de
  demandes… », la phrase I-4 du lot A pour `delai` / `reseau` / `annule`, `texteEchecAssistant` sinon ; deux textes neufs pour `inaccessible` et les
  raisons définitives, parce que « L’assistant n’a pas répondu » serait faux quand c'est le site qui refuse) ; le départ automatique reste muet ;
  I-F7 réécrit ; tests « quota après une tape → texte » et « départ automatique sur quota → aucun texte ».
- **B-2** (Important) appliqué — le cas 5 a sa sortie, « Ne pas récupérer » (`retirerPhotoPlat`, D-F4) ; **D-F17** neuve dit pourquoi l'état est
  dérivé de la fiche et non écrit au journal (I-8 du lot A respecté : aucun mot d'état stocké ; `photo_source_url` est une donnée) et ce que cela
  coûte (second appareil, onglet fermé, raisons perdues au rechargement) ; test « Ne pas récupérer → cas 1, zéro POST ».
- **B-3** (Important) appliqué autrement — l'annonce dit un ESSAI (« Après l’enregistrement, l’app essaiera de récupérer… ») ; plutôt que de la
  masquer quand la lecture pourrait ne pas remplacer, la descente part AUSSI sur « Ajouter sans remplacer » (comme la photo du plat sur « non » au
  lot A, I-5), sans écrire la fiche dans la transaction (B-24 tient : le candidat voyage en argument, D-F18) ; aucun chemin connu ne contredit plus
  l'annonce ; hors ligne, sans session ou quota épuisé restent des essais qui échouent, ce que dit le conditionnel ; tests.
- **B-4** (Important) appliqué — **D-F18** : quand une photo `'web'` est en place, la fabrication ne touche plus `photo_source_url` ; le candidat
  passe en argument (`rapatrierPhotoWeb(id, { candidat })`) et les trois champs sont écrits ENSEMBLE à la réussite ; garde des trois champs ; test
  « relecture dont l'image a changé puis échec → provenance intacte » et son mutant ; « Récupération… » s'affiche aussi au cas 2 pendant un
  remplacement (I-F6) ; le risque de § 11 est réécrit (il ne dit plus une donnée fausse).
- **B-5** (Important) appliqué — (a) `og:image` écartée quand `autres_recettes > 0` (`imageUrlDe(…, { autresRecettes })`), plancher de 200 px de petit
  côté (`trop_petite`, `COTE_MIN_DISTANT`), tests et mutants ; (b) D-F3 dit comment F suit les règles du site (copie privée, aucune redistribution,
  trois en-têtes, aucun `referer` forgé, un 403 respecté) ; (c) légende « Image de la page {hote} », hôte RECALCULÉ depuis `recipe.source_url` par
  `lienSignet`, jamais depuis `photo_source_url` (D-F11).
- **B-6** (Important) appliqué — même constat que S-1 et F-4 : le corps est lu par le rappel `lire(r)` DANS le `try/finally` du saut (§ 6.3) ; u6
  bis pour `image-web` ET `lecture-web` ; mutant.
- **B-7** (Important) appliqué en partie — **D-F19** : `originePhotoAdmise` dans les trois recopies (`fabriquerExtraction`, « Corriger »,
  `fabriquerLectureWeb`) ; tests « `'appareil'` passe Corriger, l'import ciblé et la lecture web, écrit `null` ». Refusé pour le pointeur et
  l'adresse (le `champsPhoto` complet) : ils ne lèvent pas (hors vocabulaire, revalidés à chaque lecture), et réécrire un pointeur hors `HASH`
  ferait rougir le lot A (`tests/import-cible.js` : une référence au pointeur `'ancienne'` le garde).
- **B-8** (Minor) appliqué — D-F5 écrit la lecture retenue (aucune image produite ni cherchée pour une création IA ; la personne peut poser la sienne)
  ; test « fiche `origine: 'ia'` → zone présente, aucun candidat, aucun POST ».
- **B-9** (Minor) appliqué — D-F5 et § 8 citent 04 § F, 01 point 4 et 03 § 4 ; aucun des lots A à G ne porte la récupération depuis une page
  photographiée : le lot qui la portera est à nommer par le chef d'orchestre (rév. 3 : le lot H, R-F-5).
- **B-10** (Minor) appliqué — test « remplaçable à la main, depuis une photo WEB » (→ `'image'`, adresse `null`, légende absente, puis relecture de la
  même page → zéro POST) ; le mutant « `poserPhotoPlat` garde `photo_source_url` » est désormais tué.
- **B-11** (Minor) appliqué — (a) la règle d'affichage de G (`typeAffichage`) partout : `present`, `vignettePlat`, la figure ; (b) la branche est
  tranchée EN TÊTE (F-3) : la zone n'a besoin ni d'`etatFichier` ni du moteur, et `monterPhotoPlat` reçoit le `ctxF` de G pour la figure ; (c) les
  tests bornent leurs sélecteurs à `[data-role="photo-plat"]` et `[data-role="zone-photo-plat"]` — pas de `data-role` propre au bouton : c'est
  celui de `vignettePage` (G), que F ne réécrit pas.
- **B-12** (Minor) appliqué — en-tête rebasé (`f8cfafa` relevé, puis `bd03e48` : la tâche 6 du lot A a été commise pendant la revue), numéros
  relevés, règle R-C-7 écrite ; recensement de D-F16 refait sur la tête du lot E, aux tâches 3 et 5.
- **B-13** (Minor) appliqué — la fenêtre est nommée en § 11 et I-F5 est borné à « sur cet appareil » ; la primitive du lot A ne s'applique pas telle
  quelle (vérifié, `src/core/db.js` l. 36-108 : les conditions lisent `status`, que `recipes` n'a pas).
- **B-14** (Minor) appliqué en partie — `aria-label` « Retirer la photo du plat » (option `nomRetirer`) ; « Réessayer » en `.btn` (T-4 admet un
  `.btn.small` à 36 px, mais 03 § 6 demande 44) ; D-F14 dit que « Choisir une image » remplace ; un seul nom anglais (“Photo of the dish”, la valeur
  de G alignée à la tâche 3). Refusé : « Photographier » garde “Take photos” — clé partagée avec la couverture et les menus qui prennent plusieurs
  pages ; une clé neuve pour un seul écran ajouterait une incohérence (dette nommée en § 11).
- **B-15** (Minor) appliqué — l'amendement de `0006` est placé en tête de la spec comme action immédiate du chef d'orchestre (rév. 3 :
  tranché par R-F-1, retiré de l'en-tête).

**Lentille sécurité**
- **S-1** (Important) appliqué — contrat de `suivreRedirections(…, { lire })` (§ 6.3) : minuteries et relais posés pendant toute la lecture du corps ;
  504 sur `ctl`, 502 sur une minuterie ; u6 bis (corps qui goutte → 502 à 30 s — rév. 3 : 15 s par saut en (a), 30 s en (b), R-F-6 ; `ctl` pendant le corps → 504 ; client parti pendant le corps →
  flux annulé, 499), pour les deux outils ; mutant « `lire` hors des minuteries ».
- **S-2** (Important) appliqué — `OUTILS_MODELE` (liste fermée, `logique.js`) ; `corpsModele` initialisé par elle avant tout `await` ; u11 (zéro
  fetch vers le fournisseur, aucun `x-api-key`, pour chaque issue d'`image-web`) ; test de source ; mutant.
- **S-3** (Important) appliqué — même constat que F-1 : `TRANCHE_BASE64 = 24576` exportée, `% 3` épinglé, tailles `TRANCHE + 1` et
  `2 × TRANCHE + 2`, `atob` en plus de `Buffer`.
- **S-4** (Important) appliqué — chemin 2 : amendement NOMMÉ du test de `0006` (littéral `OUTILS_0006` à quatre outils, `OUTILS.slice(0, 4)`,
  empreinte du fichier épinglée, `0006` jamais modifiée une fois collée) ; le test croisé « liste SQL = `OUTILS` » porte sur `0007` (§ 6.4, § 7.3) ;
  rév. 3 : sans objet, le chemin 2 quitte le corps (R-F-1 ; une ligne reste en § 11).
- **S-5** (Important) appliqué — ligne de coût (B-1) ; `derniersEchecs` (une `Map` du document, avec l'adresse tentée) ; « Réessayer » retiré après
  une raison définitive (`RAISONS_DEFINITIVES` : `interdit`, `pas_une_image`, `image_trop_lourde` et les refus du mur distant) ; **I-F11** et le test
  « monter une fiche au cas 5 (synchro factice, archive restaurée) → zéro fetch », avec son mutant ; le second appareil est nommé en § 11.
- **S-6** (Minor) appliqué — u2 épingle EXACTEMENT `{ user-agent, accept, accept-language }` ; mutant `referer` ; § 11 et D-F3 disent les en-têtes
  et la seconde exposition du `user-agent`.
- **S-7** (Minor) appliqué — `signatureImage` côté serveur (JPEG, PNG, WebP), discordance → 422 `pas_une_image`, corps non relayé ; u4 bis ; D-F3
  dit que la réservation borne le relais sans le fermer ; § 11 réécrit.
- **S-8** (Minor) appliqué — D-F3 et I-F3 corrigés (la CSP porte `connect-src 'self' https:`, `index.html` l. 5, vérifié : ce sont CORS et la
  promesse sur l'adresse IP de l'appareil qui excluent le chemin direct) ; test « seul `/functions/v1/assistant` est appelé » et son mutant.
- **S-9** (Minor) appliqué — I-F5, D-F10 et § 1 bornés à « sur cet appareil » ; la fenêtre entre appareils (I7, `docs/architecture.md` : l'`updated_at`
  strictement supérieur gagne) est nommée en § 11 ; une transaction unique n'est pas possible avec la primitive actuelle (B-13).
- **S-10** (Minor) appliqué — `memeAdresseImage` pour toute comparaison (candidat, garde des trois champs, raisons gardées) ; test
  `HTTPS://A.TEST:443/i.jpg` et son mutant ; adresses signées nommées en § 11.
- **S-11** (Minor) appliqué — garde des trois champs AVANT `putFile` (et encore avant l'écriture) dans `rapatrierPhotoWeb`, relecture avant
  `putFile` dans `poserPhotoPlat` ; `poserPhotoPlat` écrit `{ mime: 'image/jpeg' }` (plus de `original_filename`) ; tests « fiche supprimée pendant
  la descente ou entre le rendu et le geste → aucune ligne `files` neuve » ; « Effacer les données » nommé en § 11.
- **S-12** (Minor) appliqué — texte au conditionnel (B-3) ; `photoAnnoncee` gardée par l'écran et passée à `enregistrerLecture` : un appel ne part
  que pour l'adresse annoncée ; tests des deux sens ; « Ajouter sans remplacer » tranché : la descente part (B-3).
- **S-13** (Minor) appliqué — preuve `0007` : verdicts de droits de `0006` (1.03-1.05, séquence et `security_invoker` compris) ; règle d'affichage de
  la preuve `0004` reprise (compte emprunté, `c` et id jamais affichés, ligne datée 2000-01-01) ; test node des formes affichées. Rév. 3 :
  sans objet, F n'écrit plus de preuve (R-F-1).
- **S-14** (Minor) appliqué en partie — `tentativeMs` 90 000 (D-F13), cas nommé en § 11, durée mesurée en § 10. Refusé : abaisser la borne d'octets
  à 2 Mio contredit D-F3 du brief (« ≤ 5 Mio ») ; laissé au chef d'orchestre — rév. 3 : tranché, 2 Mio (R-F-4).

**Lentille faisabilité**
- **F-1** (Critical) appliqué — même constat que S-3 (mesuré à nouveau : 100 000 octets par tranches de 32 768 → 133 340 caractères au lieu de
  133 336, des `=` au milieu) ; contrat réécrit (tranche multiple de 3) ; test de chaînage serveur → client par `lireOctetsBase64`, dans un module
  sans import (`src/domain/base64.js`) que Node importe comme il importe déjà `src/model/schema.js` (`tools/generer-migrations.test.mjs`).
- **F-2** (Important) appliqué — l'amendement de `fabriquerExtraction` (`photo_source_url: null` avec une photo) est retiré : vérifié,
  `tests/import-cible.js` l. 360 compare l'ENSEMBLE des clés, et l'écran ciblé refuse toute fiche à `source_url` (`src/ui/import-cible.js` l. 208) ;
  D-F10 et § 4.4 corrigés ; la seule retouche de `fabriquerExtraction` est `originePhotoAdmise` (aucune clé ajoutée).
- **F-3** (Important) appliqué autrement — la branche est tranchée maintenant, mais EN TÊTE et non dans la zone : le plan G rév. 1 (tâche 6) pose
  déjà l'état dans `photoDuPlat(recipe, ctxF)` et l'épingle par son test « photo du plat distante » ; la branche « zone » obligerait à amender G et
  laisserait sans état une fiche sans version (D-F8, pas de zone) ; le test est réécrit pour cette branche (un « Télécharger » en tête, aucun dans
  la zone) ; `monterPhotoPlat` reçoit le `ctxF` complet de G (`connecte`, `uid`, `erreurs`, `moteur`) pour la figure.
- **F-4** (Important) appliqué — même constat que S-1 et B-6.
- **F-5** (Important) appliqué — même constat que B-7 : règle de lecture choisie (`originePhotoAdmise`), dite dans I-F2 et D-F19 ; tests dans
  `fabriquerExtraction`, « Corriger » et `fabriquerLectureWeb`.
- **F-6** (Minor) appliqué — le test appelle `gestes.choisir()` pendant la barrière (`monterPhotoPlat` rend `gestes`) ; mutant « garde `occupe`
  retirée » nommé ; motif cité : `import-cible.js` l. 288-292 seul (vérifié : `book.js` l. 144-147 n'a pas la garde).
- **F-7** (Minor) appliqué — (a) espion sur `URL.revokeObjectURL` ; (b) `dish.js` retiré de la règle de révocation (vérifié : `drawList()` appelé une
  seule fois, l. 92) ; (c) un fabricant d'images JPEG et PNG recopié dans `tests/photo-plat.js` ; (d) `withDatabase` situé dans `tests/backup.js`
  l. 16 ; (e) le test de révocation attend que chaque vignette ait son `src`.
- **F-8** (Minor) appliqué — `fabriquerLectureWeb` rend `photoWeb` ; `attendreRecuperation(recipeId)` exportée ; chaque test qui enregistre l'attend
  avant de sortir de son `withRepo` ; `enregistrerLecture` garde la valeur qu'elle rend (B inchangé sur ce point).
- **F-9** (Minor) appliqué — même constat que B-2 : « Ne pas récupérer » (le libellé « Retirer » laisserait croire qu'une photo est là), ligne au
  tableau § 4.5, test.
- **F-10** (Minor) appliqué en partie — même constat que S-14 : 90 s ; abaisser `LIMITES_IMAGE.octets` refusé (D-F3 du brief) ; rév. 3 :
  abaissé à 2 Mio (R-F-4).
- **F-11** (Minor) appliqué — `HASH` exporté par `schema.js` (vérifié : copie en ligne dans `src/ui/import-cible.js` l. 64, locale dans
  `src/domain/backup.js` l. 21) ; `adresseImageAdmise` rebornée après `lienSignet` (test d'un `href` qui s'allonge) ; « resserrement (`HASH`) »
  écrit pour `figurePhotoPlat` (vérifié : `photoDuPlat` testait une chaîne non vide, `recipe.js` l. 297).
- **F-12** (Minor) appliqué — en-tête rebasé (`bd03e48`) ; I-F9 nomme les formes exactes de `page` côté client (`tests/lecture-web.js`) et la forme
  du rendu de `fabriquerLectureWeb` ; le test ★ Favori est rattaché à la tâche 3, rouge d'abord.

**Rév. 2 → rév. 3 : rulings du chef d'orchestre et vérification de la rév. 2**

La vérification de la rév. 2 (`verification-rev2.md` : 17 constats Critical / Important réglés sur 17, verdict PRÊT) relève un Important neuf
(N-1) et quatre résidus mineurs ; le chef d'orchestre tranche six points (R-F-1 à R-F-6). Noms touchés revérifiés en lecture seule à `bd03e48`
(`src/core/image.js` l. 15 ; `src/domain/passerelle.js` l. 17, 54-95, 115-120 et 126 ; `src/ui/components.js` l. 276-284), dans la spec B rév. 3
(D-B26, § 6.3 point 2, § 6.4, F-2) et dans son prototype (`telechargerPage`, l. 86-130).

- **R-F-1** (chemin 1 retenu) — la migration `0006` du lot B portera les CINQ outils ; le chef d'orchestre amende la spec et le plan B dès que le
  plan B est rendu (littéral `OUTILS_0006` à cinq avec `OUTILS` en préfixe, verdicts 1.01 et 2.031 (ex-2.03 bis, `c` recompté), une phrase au README, étape 12 : § 6.4).
  L'ancienne « action immédiate » de l'en-tête devient cette ligne. F n'écrit AUCUNE migration : le chemin 2 (`0007`, sa preuve, l'étape 13 du
  README, la section de RESULTATS, l'amendement du test de `0006`) quitte l'en-tête, D-F3, D-F6, I-F9, § 6.4, § 7, § 9 (tâche 1) et
  § 10 (geste 1) ; une ligne reste en § 11 (« si `0006` est collée sans `image-web`, F écrira `0007` ») ; § 8 met toute migration hors périmètre.
- **R-F-2** — la descente part aussi sur « Ajouter sans remplacer » : défaut de la rév. 2 confirmé (D-F3, § 4.3 point 2, § 4.5, tests § 7.4) ;
  seule une mention ajoutée dans D-F3.
- **R-F-3** — « photo pour une création IA » hors périmètre = aucune image produite ni cherchée ; la zone « Photo du plat » est présente sur une
  fiche IA : lecture de la rév. 2 confirmée (D-F5, D-F8, § 8, test « fiche `origine: 'ia'` ») ; mentions ajoutées dans D-F5 et § 8.
- **R-F-4** — borne d'une image rapatriée abaissée de 5 Mio à **2 Mio** (deux relecteurs : transfert mobile et mémoire de l'iPhone ; une réponse
  base64 de 6,7 Mio n'a jamais été mesurée). Coût si faux : une image rare de plus de 2 Mio n'est pas récupérée (« non récupérée », la personne
  pose la sienne). Amendés : D-F3 (borne, relais) ; D-F12 (le mur `octetsDistants` de `preparerPhotoDistante` reste 5 Mio, mur commun des images
  distantes : l'image web y arrive bornée à 2 Mio) ; D-F13 (`corpsMax` 3 Mio au lieu de 8 : 2 796 204 caractères de base64 plus une enveloppe de
  moins de 4 Kio ; ≈ 15 s à 1,5 Mbit/s ; `tentativeMs` 90 000 gardé) ; § 3.4 (`LIMITES_IMAGE_WEB` : `octets` épinglé au littéral 2 097 152 et
  ≤ `octetsDistants` — l'égalité avec `octetsDistants` de la rév. 2 ne tient plus — ; `corpsReponse` ≥ base64 de la borne + 4 Kio) ; § 3.5 ;
  § 4.5 ; § 6.1 (`LIMITES_IMAGE.octets`) ; § 6.3 (mémoire) ; § 7.1-7.2 (forme ; u5 : 2 097 153 → 413, 2 097 152 → 200) ; § 7.4 (bornes de
  `LIMITES_IMAGE_WEB` ; le 200 d'une image à la borne, ≈ 2,7 Mio, dépasse encore les 2 Mio de `LIMITES_PASSERELLE.corps` : le mutant « `corpsMax`
  omis » rougit toujours ; `taille: 2 097 153`) ; § 7.5 (mutants « borne remise à 5 Mio », « `corpsReponse` sous le base64 de la borne ») ; § 8 ;
  § 10 (S-F4 ≤ 2 Mio, mesures iPhone) ; § 11 (base64, réseau lent, relais, risque nommé).
- **R-F-5** — la récupération ou le recadrage d'une photo du plat depuis une PAGE PHOTOGRAPHIÉE est nommée **lot H** (futur, hors de A à G) :
  D-F5 et § 8 ; en attendant, la personne pose sa propre photo.
- **R-F-6** (l'Important N-1) — u6 bis aligné sur D-B26 : 15 s PAR SAUT, corps compris, la minuterie du saut retirée APRÈS `lireCorpsBorne`
  (prototype B, l. 95, 120, 123-124) ; u6 bis (a) attend « en-têtes en 1 s, corps qui goutte → coupé à 15 s exactes, 502 » (et non 30 s) ; le cas
  (b) de la minuterie globale pendant le corps (deux 301 de 12 s, puis un corps qui goutte → 30 s exactes), proposé par le correctif de N-1, est
  gardé ; `image-web` applique la même règle que `lecture-web` par la boucle partagée `suivreRedirections` ; § 6.3 point 1 le dit ; mutant neuf
  « minuterie du saut retirée aux en-têtes » (§ 7.2, § 7.5). Aucun affaiblissement de D-B26.
- **N-1** (Important, vérification de la rév. 2 : u6 bis attendait une coupe à 30 s là où le contrat coupe à 15 s) — appliqué par R-F-6.
- **Résidus mineurs de la vérification** — (1) `non_connecte` après une tape : appliqué, `rapatrierPhotoWeb` le garde dans `derniersEchecs`
  quand `tape` est vrai (§ 4.3 point 3 ; test et mutant § 7.4-7.5) ; `hors_ligne` non gardé (le bouton éteint dit déjà « Tu es hors ligne. ») ;
  (2) arithmétique du réseau lent : sans objet après R-F-4, recalculée (≈ 0,4 Mbit/s pour ≈ 2,7 Mio en 60 s) ; (3) types annoncés stricts
  (`image/jpg`, `application/octet-stream` à signature JPEG) : nommés en § 11 ; (4) « Connecte-toi… » dit deux fois : appliqué, la ligne sous un
  « Réessayer » éteint n'est pas rendue quand la raison dit déjà ce texte (§ 4.1.2 cas 5 ; test et mutant).
- **Règle de forme** — les numéros de ligne valent à `bd03e48` ; une dérive due à un commit du lot A postérieur n'est pas un constat (en-tête).

### Rév. 3 → rév. 4 : la construction (rejeu du plan sur la tête finale du lot E, rulings R-F-7 à R-F-29, 23 octobre 2026)

**Base et rejeu (voie (b)).** F est construit sur la tête FINALE du lot E `5ec092c` (chaîne A → B → G → C → D → E → F ; R-E-18) : base `35fb29c`
(= `5ec092c` + cette spec, rév. 3), plan rév. 3 (écrit sur `bd03e48` / `4cb99a0`) rejoué par intention et commis `111f857`
(`docs/superpowers/plans/2026-10-19-plats-en-images.md` ; rapport `~/projects/mistu/.superpowers/sdd/nuit-2026-10-18/lots/F/depart-rejeu-rapport.md`) ;
mesure de départ `✅ 5681/5681` (épingle 5680), Node 174/174, `--check` 0, `APP_VERSION 0.14.0`, `sw.js cuisine-os-v0.14.0-12`. Les numéros de ligne de
cette spec valent à `bd03e48` (R-F-11) ; ceux du plan commis, à `35fb29c`.

**Précisions du plan (P-1 à P-19, recopiées du plan commis).**

- **P-1** `logError('photo_web.echec', { reason, id })` (et non `{ raison, id }`) : `src/core/log.js` ne garde que les clés `store, id, status,
    reason, table, count` — `raison` serait jetée.
- **P-2** `etatZonePlat` rend aussi **`motifEteint`** (`'hors_ligne' | 'sans_compte' | null`) : la ligne sous un « Réessayer » éteint est
    décidée par la fonction pure (testable par table), le rendu ne fait que l'afficher ; `null` quand la raison dit déjà « Connecte-toi… »
    (résidu 4 de la vérification rév. 2).
- **P-3** `lireImageWeb` accepte un `config` facultatif (comme `lireRecetteWeb` de B) pour les tests ; la production n'en passe pas
    (`currentConfig()`).
- **P-4** `imageOgDe` lit la balise `og:image` par le balayage linéaire UNIQUE de B (`balayer(html).metas` : `lireMetaTranche` capture
    `og:image` en troisième clé, la première occurrence) ; `lirePageHtml` réutilise le `scan` qu'elle a déjà fait (aucun second balayage, D-B12).
    Conséquence nommée : une balise `meta` de plus de 2 048 caractères est ignorée par la borne de B (une `og:image` de plus de ≈ 2 000
    caractères vaut `null`).
- **P-5** `fabriquerLectureWeb(…, { remplacer: false })` vérifie le vocabulaire sur une COPIE dont l'origine passe `originePhotoAdmise`, et rend le
    signet INTACT (B-24) : sans cela, une fiche reçue avec `photo_origin: 'appareil'` ferait lever « Ajouter sans remplacer ».
- **P-6** `photo_origin` n'est réécrite par `fabriquerLectureWeb` et « Corriger » que si la fiche la porte (`Object.hasOwn`) : aucune clé ajoutée
    à une fiche ancienne (les formes exactes de B restent vertes).
- **P-7** `enregistrerLecture` gagne **quatre** dépendances (`ctx`, `fetch`, `enLigne`, `photoAnnoncee`) : la signature du plan B rév. 2
    (`{ repo, remplacer, maintenant, choisir, cle }`, P-12 de B) n'a pas `ctx`, dont `rapatrierPhotoWeb` a besoin pour la session. `cle`, le refus
    `lecture` et la clôture `cloture` de B sont gardés tels quels (les retirer réintroduirait le mutant C23 de B).
- **P-8** `photo-plat.js` dans les deux filets i18n (ci-dessus).
- **P-9** le test Node de B « `lirePageHtml` : assemblage » épingle la forme exacte de `page` ; `RICARDO` y porte une `image` : amendé
    (`image_url: 'https://ricardo.test/a.jpg'`), amendement que la spec I-F9 ne listait pas.
- **P-10** les docs (`CLAUDE.md`, `STATE.md`, `docs/architecture.md`, spec § 12) passent à la Clôture (spec § 9 : tâche 5), comme B (P-7 du plan B).
- **P-11** le test « l'écriture passe par la capture » vit en tâche 5 (spec § 9) ; § 7.4 le range sous « Rapatriement ».
- **P-12** le test B-10 « remplaçable à la main… puis relecture de la même page → zéro POST » est coupé en deux : la tâche 3 éprouve le candidat
    pur (`candidatPhotoWeb` → `null` après le remplacement), la tâche 5 le parcours complet de relecture par l'écran web.
- **P-13** « session nulle avec `ctx.sync.user` posé » : le jeton factice rend `null` tout de suite (`jeton: async () => null`) — même branche que
    « ne répond pas en 2 s » (`sessionAssistant` rend `null` dans les deux cas), sans 2 s d'attente dans la suite.
- **P-14** worktree `/Users/neeganmac/projects/mistu-plats-en-images` (consigne), et non `~/projects/mistu-plats` (spec, en-tête).
- **P-15** `monterPhotoPlat` sérialise ses redessins (une file de promesses, motif de `renderImportWeb`) : deux redessins ne s'entrelacent jamais.
- **P-16** `poserPhotoPlat` : une exception autre qu'`ErreurImage` levée par `preparerPhotoLocale` vaut `refuse(image, 'indecodable')`.
- **P-17** `descendre` (le corps de `rapatrierPhotoWeb`) attrape toute exception inattendue → `echec('interne')` : rien ne lève vers l'écran (I-F4).
- **P-18** les assertions neuves de `tests/passerelle.js` n'emploient pas `garde()` : le balayage « jeton absent » du lot 4 compte exactement ses
    résultats (R-T3-12) ; elles contrôlent le jeton sur place.
- **P-19** D-F15 : la suite n'a pas de routeur, donc un `refresh()` ne redessine rien sous test ; le mutant « `refresh()` après un geste » est tué
    par l'écouteur espion de `cuisineos:refresh` (spec), et la conservation des portions par `#servings-val` ; « le segment Métrique reste actif »
    n'est pas observable (le segmenté ne change pas sa classe au clic, préexistant) et n'est pas affirmé.
- **P-20** *(refusé en rév. 3, R-F-7)* — la « référence dorée » (le `outerHTML` de la carte relevé en littéral au Step 0 de la tâche 4) est
    abandonnée : le lanceur `suite.cjs` réduit les blancs et coupe chaque échec à 400 caractères (`.slice(0, 400)`, l. 22 du lanceur du lot A,
    relu) — le littéral « obtenu » n'est pas lisible dans le bilan. Retour à la lettre de la spec § 7.4 : la référence est CONSTRUITE dans le
    test (la carte avec photo, rendue par le MÊME composant et privée de sa vignette, doit être exactement la carte sans photo ; un gabarit
    explicite borne la colonne), et le test compare des FAITS (tâche 4, bloc « recipeCard : référence construite »).
- **P-21** la règle `.plat-vignette` est lue dans `styles.css` **sans ses commentaires**, dans un bloc à part : son rouge se lit au Step 2 de la
    tâche 4 pour la bonne raison (règle absente) ; une règle introuvable est un rouge NOMMÉ, jamais une chaîne vide qui passe les filets.
- **P-22** les mutants serveur (tâches 1 et 5) se rejouent sur une **copie entière** du worktree dans le scratchpad, une par mutant : les
    harnais Node importent `logique.js` (et `index.ts` charge `lecture-web.js`) par des chemins fixes ; `LECTURE_WEB_JS` et `INDEX_TS` ne
    suffisent pas pour `logique.js`. Jamais une mutation dans le worktree.

**Rejeu sur `5ec092c` (voie (b)) : écarts d’intention EI-1 à EI-7, défauts du plan D-1 à D-3, adaptations A-1 à A-11 (recopiés du plan commis).**

Départ du 23 octobre 2026, contrôleur délégué (Opus 5.5), sans sous-agent, sans réseau réel, sans déploiement ; jamais le navigateur MCP (la suite par
`suite.cjs`, l'app par un Chrome sans tête dédié). Base : le worktree `/Users/neeganmac/projects/mistu-plats-en-images`, branche `plats-en-images` à
`35fb29c` (= `5ec092c` + la spec F commise), copié par `rsync` (sans `.git` ni `.superpowers`) dans le scratchpad du lot F (`depart/base`,
`depart/rejeu`,
`depart/mut`), servi à part sur 8194, 8294 et 8394 ; le worktree n'a reçu AUCUNE écriture. Chaque bloc a été appliqué PAR INTENTION par des scripts
Python
qui vérifient chaque ancre (présence et unicité) et refusent toute écriture hors des copies (`depart/outils/t1.py` à `t5.py`, `t1-d1.py`, `t2-fin.py`,
`t3-d2.py`, `t3-cycle.py`) ; les blocs du plan sont copiés À L'OCTET depuis ce fichier (aucune séquence « barre oblique inverse + u + hexa » retapée) ;
chaque fonction que le plan réécrit l'a été DEPUIS `35fb29c`. Journal des opérations : `depart/logs/rejeu-journal.txt` ; rapport :
`depart-rejeu-rapport.md` (même dossier que ce plan).

**Totaux mesurés** (lanceur `suite.cjs` sur la copie servie ; `node --test tools/*.test.mjs` ; `node tools/generer-migrations.mjs --check` ; `tsc` 5.6.3
`--strict` ; une seule erreur de console partout : le 404 de `/favicon.ico`) :

| État | Suite | Épingle | Node | `--check` | `tsc` | `APP_VERSION` / `sw.js` |
|---|---|---|---|---|---|---|
| Départ (`35fb29c`) | ✅ 5681/5681 | 5680 | 174/174 | 0 | 0 | `0.14.0` / `cuisine-os-v0.14.0-12` |
| T1, rouge (Step 5, `--test-timeout=10000`) | — | — | 174 : 142 ✓, 29 ✗, 3 annulés | — | — | — |
| T1, vert | ✅ 5681/5681 | 5680 | **203/203** | 0 | 0 | inchangés |
| T2, rouge (Step 6) | ❌ 5668/5703 | 5680 | 203/204 | — | — | — |
| T2, vert (Steps 8-9) | ❌ 5738/5739 (épingle) → ✅ **5739/5739** | **5738** | 204/204 | 0 | — | `0.15.0` / `-1` |
| T3, vert (Steps 11-12) | ❌ 5827/5828 (épingle) → ✅ **5828/5828** | **5827** | 204/204 | 0 | — | `-2` |
| T4, vert (Steps 5-6) | ❌ 5844/5845 (épingle) → ✅ **5845/5845** | **5844** | 204/204 | 0 | — | `-3` |
| T5, vert (Steps 6-7) | ❌ 5883/5884 (épingle) → ✅ **5884/5884** | **5883** | 204/204 | 0 | 0 | `-4` |

Entre deux tâches, seule l'épingle a rougi ; les lignes existantes amendées (A-5, EI-2, pins, P-9, I-F9) ont rougi exactement dans la tâche qui les
amende ;
aucune autre assertion existante n'a rougi. `DB_VERSION` 4 et `ARCHIVE_FORMAT_VERSION` 1 inchangées ; aucune migration (`--check` 0 à chaque tâche).
Graphe des imports statiques depuis `src/app.js` : 85 modules, 0 cycle au départ ; 88 modules, 0 cycle à la fin (EI-5). L'app réelle (`index.html`,
`#/library`, `#/add`, `#/search`) se charge à la fin sans aucune erreur de console.

**Écarts d'intention** (chacun tranché en faveur du code commis ; une ligne de ruling R-F-12 et suivants par écart, à écrire par le chef d'orchestre) :

- **EI-1** (tâche 1, `supabase/functions/assistant/index.ts`) — Plan : extraire du prototype B une boucle `suivreRedirections` sans autre garde. Code
  commis :
  la vague finale de B (`ebbcf10`, défense en profondeur SSRF, test t13) refuse en 422 `interdit` une réponse SUIVIE malgré `redirect: 'manual'`
  (`r.redirected`), et nomme `ctlSaut` le contrôleur du saut. Tranché : la boucle partagée GARDE la garde `r.redirected` (elle vaut désormais pour
  `image-web` aussi) et les noms de B ; mutant M20 « garde retirée » rouge sur t13.
- **EI-2** (tâche 1, `tools/assistant-index.test.mjs`, t3) — Plan : amender la ligne à trois champs `[hote, titre_page, texte_coupe]` du prototype. Code
  commis : depuis sa ronde 1, B épingle l'objet `page` ENTIER (l. 672). Tranché : `image_url: 'https://cdn.test/og.jpg'` ajoutée en dernière clé de
cet objet
  (même fait affirmé, plus strict).
- **EI-3** (tâche 3, `src/ui/photo-plat.js` `figurePhotoPlat`) — Plan : déplacer le `photoDuPlat` du plan G rév. 3 (erreurs relues en `Set` par
  `lireErreursFichiers`). Code commis : le `photoDuPlat` de G (ronde 1 de sa tâche 6) n'offre rien sans octets si ce qui arrivera ne s'affichera pas
  (`safeDisplayType` du `remote.mime`, sinon du `mime`) et relit les erreurs par `relireErreurs(ctxF)` (une définition, une `Map`). Tranché : la garde
est
  recopiée, `relireErreurs` remplace la relecture locale, l'import de `lireErreursFichiers` disparaît.
- **EI-4** (tâche 3, `src/ui/photo-plat.js`) — Plan : `messageErreurImage` importée de `./livre-ajout.js`. Code commis : le lot E (D-E20) l'a
  déménagée dans
  `src/core/image.js` ; `livre-ajout.js` ne la ré-exporte que pour book.js et regroupement.js. Tranché : importée de `../core/image.js`.
- **EI-5** (tâches 3 et 5, `src/ui/components.js`, `src/ui/livre-ajout.js`, `src/ui/photo-plat.js`) — Plan : `photo-plat.js` lit
  `renderZoneCouverture` dans
  `livre-ajout.js`, et `import-web.js` importe `photo-plat.js` (tâche 5). Code commis : `livre-ajout.js` importe `./import-cible.js` depuis le lot E
  (`c647e4a`), qui importe `./import-web.js` depuis le lot B (`3ca8d19`) ; le graphe n'a AUCUN cycle à `35fb29c`, et B (D-B13 « sens unique ») comme E
  (D-E20, « un cycle ») les évitent exprès. Le plan tel quel ferme, à la tâche 5, le cycle import-web → photo-plat → livre-ajout → import-cible →
import-web
  (mesuré : 1 composante cyclique ; suite verte et app chargée sans erreur quand même). Tranché : `renderZoneCouverture` est DÉPLACÉE dans
`components.js`
  et ré-exportée par `livre-ajout.js` — le motif même de D-E20 (et de `lireBornee` / `signalDelai`, lot ISBN) ; 0 cycle ; suite et app vertes. À
ratifier :
  le revers (garder la lettre du plan et accepter le cycle) ne change aucun test.
- **EI-6** (tâche 5, `src/ui/import-web.js` `enregistrerLecture`) — Plan : la forme du plan B rév. 2 (deux appels de `fabriquerLectureWeb`, le signet lu
  avant le dialogue). Code commis : la ronde 1 de la tâche 5 de B relit le signet et ses versions APRÈS le dialogue (`relire`, `fondement`, question
  reposée), appelle `fabriquerLectureWeb` une fois, et nomme la fiche `fiche.signet`. Tranché : le corps de B est gardé ligne pour ligne ;
`photoAnnoncee`
  entre dans l'appel unique ; le déclenchement vise `fiche.signet.id`.
- **EI-7** (tâche 5, `renderImportWeb`) — Plan : `etat` sans `lu`, `charger()` qui relit le résultat pour l'annonce. Code commis : `etat.lu` (la lecture
  relue UNE fois par chargement, ronde 1 de B) et un `charger()` qui relit la ligne préférée et rejoue deux passes `marquerIllisible`. Tranché :
  `photoAnnoncee` est calculée sur `lu` et posée dans la même affectation que `ligne`, `lu` et `versions`.

**Défauts du plan** (indépendants des lots construits depuis ; corrigés au plus près, à ratifier) :

- **D-1** (tâche 1, u5, `tools/assistant-index.test.mjs`) — le flux de 2 Mio + 1 se FERMAIT dans le tirage qui suit le dernier octet : quand le lecteur
  franchit la borne, le flux est déjà clos et `reader.cancel()` n'appelle jamais `cancel()` — l'assertion `annule2 === true` ne pouvait pas être vraie
  (mesuré : rouge sur le code juste). Correction : la fermeture est différée d'un tirage (`finDemandee`) ; la borne exacte reste éprouvée (mutant «
borne + 1 »
  de `lireCorpsBorne` rejoué : rouge, sans blocage).
- **D-2** (tâche 3, « rapatriement », cas 5) — `files` est adressé par l'empreinte : c1, c2 et c4 redescendaient la MÊME image que les cas 1 à 4 bis ;
  c2
  (« la ligne files du JPEG reste », `nf2 + 1`) était impossible, c1 et c4 (« aucune ligne files neuve ») vrais par construction — le mutant « `putFile`
  avant la garde » du Step 13 survivait (mesuré : seul le rouge permanent de c2). Correction : trois PNG distinctes (`pngC1`, `pngC2`, `pngC4`) ; le
même
  mutant rougit alors c1 et c4.
- **D-3** (tâche 1, Step 5) — contre le code d'avant, u6, u6 bis, u7 et u11 attendent un `fetch` de l'image qui ne part jamais : `node --test` ne finit
  pas. Correction : le rouge se lit avec `--test-timeout=10000` (u7 et u6 bis (d) ont déjà leur `timeout`).

**Adaptations de forme** (même intention, autre forme du code commis) :

- **A-1** `supabase/functions/assistant/logique.js` l. 4-5 : le commentaire de B « OUTILS reste à quatre … » devenu faux est réécrit (cinq outils,
  `OUTILS_MODELE`).
- **A-2** `tools/generer-migrations.test.mjs` l. 1177-1178 : idem pour le commentaire d'`OUTILS_0006` ; préfixe l. 1188 de forme `slice(0, 4)` (R-F-9).
- **A-3** `src/model/schema.js` : `PHOTO_ORIGINS` et `HASH` après `VERIFICATION` (l. 149), `SOURCE_KINDS` de B séparant `AVAILABILITY` (l. 146) de
  `VERIFICATION`.
- **A-4** `src/domain/vocabulaire.js` : l'import garde `SOURCE_KINDS` (B) et `SORTES_IMPORT` (D) ; `photo_origin` après `source_kind` (l. 25).
- **A-5** `tests/lecture-web.js` l. 151 (« tout autre `eq` qui compare un `resultat.page` complet », Step 0 de la tâche 2) : `PAGE` y est l'entrée ET
  l'attendu — l'attendu devient `{ ...PAGE, image_url: null }`.
- **A-6** `src/domain/lecture-web.js` `fabriquerLectureWeb` : le corps RÉEL de B (l. 194-228 : vocabulaire de `source_kind` en tête, `incertains`,
  `lu_le`,
  copie `intact`) gardé ligne pour ligne, lignes « Lot F » ajoutées ; P-5 sur `{ ...intact, ...origine }` (cas prévu par le plan).
- **A-7** pins : quinze lignes relevées en Python à `35fb29c` (`tests/ajouter.js` 3806, 3808 ; `assistant-compte.js` 8 ; `classement.js` 2568 ;
  `creer-ia.js` 11 ; `passerelle.js` 765, 767 ; `recherche-web.js` 66, 69, 72 ; `sync-l3.js` 1867 ; `sync-l4.js` 514, 516, 3506, 3507), libellés du
lot F
  et historique prolongé (convention du lot E).
- **A-8** `tests/tests.js` : l'appel du lot F se pose juste avant le thème (l. 236-238), soit après le bloc du lot D (l. 232-234) — celui du lot E est
  l. 217-219.
- **A-9** `src/ui/recipe.js` : imports que `photoDuPlat` lisait seule, relevés hors commentaires — lignes `../sync/mime.js` (l. 7) et
  `../core/blob-urls.js`
  (l. 8) entières, `vignettePage`, `gesteTelechargement`, `relireErreurs` de la ligne `./components.js` (l. 18).
- **A-10** `src/i18n/en.js` l. 528 : la valeur de G « Dish photo · {titre} » devient « Photo of the dish · {titre} » (cas prévu par le Step 10).
- **A-11** `src/ui/book.js` : `revoquerUrlDeBlob` rejoint la ligne existante `import { urlDeBlob } from '../core/blob-urls.js';` (l. 10, lot G).

**Fichiers rejoués** (39) : serveur — `supabase/functions/assistant/{lecture-web.js, logique.js, index.ts}` ; app — `src/model/schema.js`,
`src/domain/{vocabulaire.js, import-cible.js, passerelle.js, lecture-web.js}`, `src/domain/{base64.js, photo-web.js}` (neufs), `src/core/image.js`,
`src/ui/photo-plat.js` (neuf), `src/ui/{components.js, livre-ajout.js, recipe.js, meals.js, search.js, book.js, import-web.js, recipe-edit.js}`,
`src/i18n/en.js`, `styles.css`, `sw.js` ; tests — `tests/photo-plat.js` (neuf), `tests/{tests.js, import-cible.js, passerelle.js, lecture-web.js,
ajouter.js, creer-ia.js}` et les pins de `tests/{assistant-compte.js, classement.js, recherche-web.js, sync-l3.js, sync-l4.js}`,
`tools/{assistant-lecture-web, assistant-logique, assistant-index, generer-migrations}.test.mjs`. Vérifications sur les 39 : `python3 -I` invisibles
(U+200B-200D, U+2028/2029, U+202A-202E, U+2060, U+FEFF) **0** ; motifs de clés (Anthropic, JWT, `sb_secret_`, `sb_publishable_` réels) **0** ;
`node --check` **0 échec** ; chaque ligne de `35fb29c` qui porte une séquence « barre oblique inverse + u » retrouvée telle quelle **(0 perdue)** ; le
plan régénéré lui-même : invisibles 0.

**Mutants de la tâche 1** (Step 10, P-22 : copie entière, `node --test --test-timeout=10000` depuis la copie) : les 19 de la liste rougissent, chacun
par au
moins un test nommé (`image/gif` → « LIMITES_IMAGE : forme », « typeImageAdmis : table », u4 ; 5 Mio → « forme », u5, u11 ; `svg+xml` → «
typeImageAdmis »,
u4 ; WebP sur RIFF → « signatureImage », u4 ; signature retirée → u4 ; sans `valideAdresse` → « imageUrlDe », « lirePageHtml : page.image_url » ; sans
résolution → mêmes + u9 ; sans `autresRecettes` → « imageUrlDe », « lirePageHtml » ; premier Recipe → « lirePageHtml » ; `TRANCHE_BASE64 = 32768` →
« versBase64 », u5 ; `lire` hors du saut → u6 bis (a)-(d), u11, t5 ; minuterie retirée aux en-têtes → u6 bis (a), t5 ; `referer` → u2, t2 ;
`corpsModele = lu.corps` → u2 à u11, « index.ts (lot F) » ; `OUTILS` sans `image-web` → 17 tests dont « 0006 », u1-u11 ; `image-web` sans
`valideAdresse` → « lireDemande image-web », « lireDemandeUrl », u1 ; boucle propre → u10, « index.ts (lot F) », « index.ts : imports fermés… » ; second
`await fetch(` → « index.ts (lot F) », « index.ts : imports fermés… » ; `propre` → accès direct → « imageDe : formes »). Hors liste : M20 (EI-1) → t13.

**Ce qui reste au contrôleur** : (1) relire ce plan et le rapport, puis le commettre dans le worktree sous
`docs/superpowers/plans/2026-10-19-plats-en-images.md`
(chemin par nom, message ASCII) ; (2) écrire les rulings R-F-12 et suivants (un par EI-1 à EI-7, et la ratification de D-1 à D-3) dans `rulings-F.md`,
puis spec § 12 à la clôture — EI-5 est le seul qui demande une décision de forme (déplacement ou cycle accepté) ; (3) poser le registre
`.superpowers/sdd/2026-10-19-plats-en-images/progress.md` (le relevé du Départ ci-dessus) et `recensement-D-F16.md` (Step 0 de la tâche 3 : aucun (c)
neuf) ; (4) les briefs (en-tête `entete.txt`), puis lancer la tâche 1.

**Rulings du chef d’orchestre (R-F-7 à R-F-11 du plan de nuit ; R-F-12 à R-F-18 du Départ, en tête des cinq briefs).**

- **R-F-7** — P-20 REFUSÉ : la référence dorée d'une image n'est pas un littéral illisible dans le test (le lanceur `suite.cjs` tronque à 400
  caractères) ; elle est construite dans le test (spec § 7.4).
- **R-F-8** — aucune mutation d'`Object.prototype` dans la suite (la configuration de test de `lireImageWeb` passe par une option, ou par un `Blob`
  typé).
- **R-F-9** — préfixe des outils : le lot B affirme `OUTILS = OUTILS_0006.slice(0, 4)` ; F passe à l'égalité (`OUTILS_0006` entière, `image-web`
  compris :
  la migration `0006` de B porte déjà les cinq outils, aucune migration dans F) ; le Step 0 de la tâche 1 accepte les deux formes sur la tête.
- **R-F-10** — les négatives « cartes » (un redessin qui ne doit PAS recharger une vignette) sont une limite nommée (§ 11) ; un rouge intermittent se
  rejoue seul, machine à vide, avant d'être un constat (R-B-15, R-E-29).
- **R-F-11** — les numéros de ligne du plan se relisent sur la tête finale du lot E (`5ec092c`) : une dérive n'est pas un constat, un nom absent ou un
  comportement différent en est un (R-C-7, R-E-14).

### Rulings du Départ (R-F-12 et suivants : à écrire après le rapport `depart-rejeu-rapport.md`, un par écart d'intention EI-n)
- **R-F-12 (EI-5, cycle d'imports)** — RATIFIÉ : `renderZoneCouverture` passe dans `src/ui/components.js` et `src/ui/livre-ajout.js` la ré-exporte
  (le motif de D-E20 pour `messageErreurImage` et de D-B13) ; le graphe d'imports reste sans cycle (`import-web` → `photo-plat` → `livre-ajout` →
  `import-cible` → `import-web` l'aurait fermé). Les deux fichiers hors des Files du plan (`components.js`, `livre-ajout.js`) sont touchés en tâche 3 et
  déclarés ; aucun test ne change. Coût si faux : nul (le revers, un cycle, est mesuré inoffensif à l'exécution).
- **R-F-13 (EI-1, EI-2, EI-6, EI-7 : le code commis du lot B)** — La boucle de redirections partagée d'`index.ts` garde la garde `r.redirected` et le
  nom
  `ctlSaut` de la vague finale de B (mutant M20 rouge sur t13) et vaut pour `image-web` ; t3 épingle l'objet `page` ENTIER, `image_url` en dernière
clé ;
  `enregistrerLecture` garde le corps réel de B (relecture APRÈS le dialogue, `fondement`, un seul `fabriquerLectureWeb`, déclenchement sur
  `fiche.signet.id`) ; `renderImportWeb` garde `etat.lu` et le `charger()` réel, l'annonce calculée sur `lu`. Coût si faux : nul.
- **R-F-14 (EI-3, EI-4 : le code commis des lots G et E)** — `figurePhotoPlat` recopie la garde de G (rien sans octets si ce qui arrivera ne s'affichera
  pas, `safeDisplayType`) et lit `relireErreurs(ctxF)` (une `Map`, une définition) ; `messageErreurImage` est importée de `src/core/image.js`
  (déménagée par E). Coût si faux : nul.
- **R-F-15 (D-1 à D-3 : défauts du plan rév. 3, corrigés au plus près)** — RATIFIÉS : D-1 u5 — le flux de 2 Mio + 1 était déjà clos quand la borne
  tombait ; fermeture différée d'un tirage, le mutant « borne + 1 » de `lireCorpsBorne` rougit sans blocage ; D-2 — les cas c1, c2 et c4 du rapatriement
  prennent trois PNG distinctes (la même image ne pouvait pas donner une ligne `files` de plus) : le mutant « `putFile` avant la garde » rougit c1 et
c4 ;
  D-3 — le rouge du Step 5 de la tâche 1 se lit avec `--test-timeout=10000` (u6, u6 bis, u7, u11 attendent un `fetch` qui ne part jamais). Coût si
faux :
  un test de caractère de moins.
- **R-F-16 (adaptations de forme A-1 à A-11, pins, versions, attendus)** — Ratifiées : commentaires de B « quatre outils » réécrits (`OUTILS` à
  l'égalité
  avec `OUTILS_0006`, R-F-9 ; `tools/generer-migrations.test.mjs` l. 1188) ; `PHOTO_ORIGINS` et `HASH` après `VERIFICATION` ; l'import de
  `vocabulaire.js` garde les noms de B et D ; `tests/lecture-web.js:151` attend `{ ...PAGE, image_url: null }` ; `fabriquerLectureWeb` corps réel ;
  quinze pins de version relevées en Python ; l'appel du lot F après le bloc du lot D dans `tests/tests.js` ; imports de `recipe.js` relevés ;
  `en.js:528` « Photo of the dish » ; `revoquerUrlDeBlob` sur l'import existant de `book.js`. `docs/architecture.md:1200` dit encore « quatre outils » :
  corrigé à la clôture (P-10). Attendus de mesure (rejeu sur copie) : T1 5681/5681 (aucune version ; Node 203/203 ; `tsc` 0 ; rouge Node 174 tests,
  142 ✓, 29 ✗, 3 annulés), T2 5739/5739 (épingle 5738, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-1`, Node 204 ; rouge `❌ 5668/5703`), T3 5828/5828
  (5827, `-2`), T4 5845/5845 (5844, `-3`), T5 5884/5884 (5883, `-4`, `tsc` 0) ; `--check` 0 partout ; entre deux tâches seule l'épingle rougit ; les
  rouges des tâches 3 à 5 n'ont pas été remesurés au Départ (l'implémenteur les lit). Une ronde qui touche `src/` fait +1 (R-B-24). Coût si faux : nul.
- **R-F-17 (serveur et recensement)** — Aucun déploiement par un agent ; `tsc` 5.6.3 `--strict --noEmit` passe à chaque tâche qui touche
  `supabase/functions/` (`npx -y -p typescript@5.6.3 tsc …`, commande du lot B, typescript 5.6.3 en cache) ; aucune migration (`0006` de B porte déjà
  `image-web`) ; le redéploiement d'`assistant` est un geste du chef d'orchestre après la clôture, la sonde réelle `image-web` et la preuve § 10 des
  gestes de Neegan ; aucun agent ne dépense d'appel. Recensement D-F16 (script du plan sur `35fb29c`, diff contre `4cb99a0`) : les écrivains (c) sont
  `recipe.js:76` (★ Favori, corrigé en tâche 3) et `recipe-edit.js:342` (« Corriger », tâche 5) ; AUCUN (c) neuf venu de B, C, D ou E (`import-web.js`
  l. 186 = (a), l. 270 = (b) ; `table-matieres.js` l. 64 et `domain/table-matieres.js` l. 201 = (a) ; `regroupement.js` l. 686 = condition sans
écriture) :
  la tâche 3 n'a pas d'écrivain neuf à corriger, `recensement-D-F16.md` est posé au registre. Coût si faux : une fiche écrite par copie non relue.
- **R-F-18 (rouges de bruit, copies, disque)** — Un rouge intermittent (négatives « cartes », R-F-10 ; Node sous charge ; `tests/sync-l3.js:976`) se
  rejoue
  seul, machine à vide, avant d'être un constat (R-B-15) ; au plus trois copies servies à la fois ; copies par `rsync` sans `.git` ni `.superpowers`
  (ports 8194, 8294, 8394…) ; un ENOSPC est un faux rouge dit dans le rapport ; aucun effacement récursif (les copies d'une tâche finie restent,
  nommées). Coût si faux : un faux rouge, jamais un faux vert.

**Rulings de construction (cinq tâches, leurs rondes, la revue finale de branche à trois lentilles, la vague finale et sa re-revue).**

- **R-F-19 (revue de sécurité automatique du commit `2da429d`, tâche 1 : « SSRF » dans `index.ts`)** — Constat RATIFIÉ comme le résidu déjà ratifié
  au lot B (R-B-21 : l'hôte est filtré par son nom — `https` seul, hôte public, ni IP, ni port, ni identifiants, hôte du projet et alias refusés —,
  sans épinglage d'IP ; le DNS rebinding théorique est assumé, le mur restant TLS). `image-web` passe par la MÊME boucle `suivreRedirections`
  (`valideAdresse` sur chaque cible, `r.redirected` refusé, 3 sauts, 15 s par saut et 30 s en tout, corps borné à 2 Mio, type lu dans la signature des
  octets, jamais le modèle). Sans correction ; nommé en § 11. Coût si faux : un relais vers une adresse privée par un nom public qui y résout.
- **R-F-20 (ratification en bloc des écarts de construction)** — Le code commis fait foi : (a) T1-R1 — quatre redondances simplifiées (`byteLength ===
  0`,
  `usage = null`, `premiere ? autres : 0`, `metas?.get?.`, mutants équivalents), bloc de commentaire de B réduit, relais `hotesRefuses` épinglé (u9),
  motif de clé `meta` linéaire ; le test de borne de § 7.1 gardé tel quel et un test sur des balises fermées ajouté ; (b) T2-R1 — `src/sync/mime.js`
  touché hors Files (`COVER_INPUT_MIME` gelé), `src/domain/lecture-web.js` lit `pointeurValide` exporté par `photo-web.js` (une définition),
`lireImageWeb(args,
  opts)` déstructure dans son `try`, arguments nuls refusés ; (c) T3-R1 — les écrivains de la photo (rapatriement, pose, retrait, ★ Favori) relisent
la fiche
  DANS la transaction par la condition `{ key, fusion }` de `repo.saveBatch` (la garde `setTimeout(0)` de § 4.1.1 disparaît ; § 11 « Fenêtres de la
garde
  finale », I-F5 et B-13 amendés) ; interfaces étendues sans changer les appels existants : `figurePhotoPlat(recipe, { repo, ctxF, fichier })`,
  `renderZonePhotoPlat(etat, gestes, { gardeRefusee })`, `retirerPhotoPlat(id, { repo, attendu })` rend aussi `refuse('fiche_changee')`,
`vuesPhotoPlat()`
  (tests) ; ★ Favori écrit la valeur montrée (`!recipe.favorite`) par `deps.repo` et `deps.toast` ; sur une vue périmée, « Retirer » et « Ne pas
  récupérer » rendent `fiche_changee` sans phrase et la zone redessine l'état relu (une phrase serait une clé `t()` neuve : décision de produit, non
  prise) ; un échec d'écriture du Favori est seulement journalisé ; une borne de 500 ms (`Promise.race`) autour de `m.gestes.choisir()` (M17 rendait un
  bilan figé) ; (d) T4-R1 — titre du repas à droite de la vignette, vignette indécodable cachée, `pointeurValide` ; (e) T5-R1 — « Corriger » et «
Créer ma
  version » relisent les trois champs de la photo DANS la transaction (`{ key, fusion }`), le vocabulaire vérifié sur la fiche écrite (une levée annule
  tout ; m14 du lot A vert) ; `vol_tenu` refusé (constat Minor) : une descente déjà en vol sur la fiche abandonne l'essai annoncé sans rien dire —
limite
  § 11 (R-F-26) ; la fenêtre « Corriger » de T2 (`photo_origin` hors liste reçue → `ErreurVocabulaire`) est fermée par `originePhotoAdmise` en T5 ;
  (f) T1 — `Object.prototype` pollué le temps de trois appels synchrones dans un test Node (R-F-8 vise la suite navigateur ; `node --test` isole chaque
  fichier), l'exception de `headers.get('content-type')` attrapée dans `suivreRedirections` (502 `inaccessible` au lieu de `serveur`, inatteignable avec
  une vraie `Response`). Coût si faux : § 12 ment sur le code commis.
- **R-F-21 (vague finale VF-F1 à VF-F8, revue finale de branche de `fb3b30c` : 2 Important, 9 Minor ; commit `b65988f`)** — RATIFIÉS : (VF-F1) l'en-tête
  JPEG est lu comme libjpeg le lit — l'octet FF de remplissage avant un marqueur est sauté ; `FF 00`, EOI ou SOS avant le SOF rendent l'en-tête
  illisible et une image distante est refusée « indecodable » sans décodage (le mur ≤ 16 Mpx / petit côté ≥ 200 px, I-F2 et D-F12, ne se contourne
  plus par un faux SOF caché dans un COM ; effet assumé : un JPEG distant corrompu que Chrome décoderait est refusé) ; (VF-F2) `TYPE_JSONLD` (code du
  lot B) devient linéaire (`/\btype\s*=\s*(?:["']\s*)?application\/ld\+json/`) et son jumeau S-4 sur des balises fermées entre dans
  `tools/assistant-lecture-web.test.mjs` (3 466 ms → 84 ms pour quatre pages) ; (VF-F3) une image de page dégénérée (`#`, `#top`, `.`, `./`, `?v=1` : la
  page elle-même ou son dossier) est écartée ; (VF-F4) chaque candidat d'image est validé avant de passer la main — une image JSON-LD refusée laisse
  `og:image` tenter la sienne (contrat § 6.1 d'`imageUrlDe` / `lirePageHtml` amendé) ; (VF-F5) la garde « page de liste » compte `max(autres, Recipe
  trouvées − 1)` (coût assumé, test de caractère : une Recipe lisible sans image accompagnée d'une vignette liée perd son `og:image`) ; (VF-F6)
  `enregistrerLecture` écrit la fiche DANS la transaction par fusion — une fiche supprimée entre la relecture et la transaction n'est plus recréée :
refus
  `inconnu`, rien d'écrit ; les autres champs du signet écrits depuis la copie restent la fenêtre R-B-27 du lot B ; (VF-F7) la zone n'affiche plus
  « Récupération de la photo… » après une photo choisie ou un « Retirer » pendant la descente ; les vues jamais insérées sont bornées par le temps ; z5
  tué par la tape ; (VF-F8) le faux-vert « Réessayer hors ligne → zéro POST » (clic sur un bouton `disabled`) est fermé, et les deux tests de temps du
  lot B (S-4 < 500 ms, `portionsDe` < 50 ms) se jouent seuls (rouges de charge). Mutants de la vague : client 15/15, serveur 7/7 (un par un, seuls).
  Re-revue ciblée : PROPRE (les deux Important fermés, 0 neuf). Coût si faux : nul — chaque changement a son test lu rouge d'abord.
- **R-F-22 (versions et épingles, R-B-24)** — La tâche 1 (serveur) ne porte aucune version (`sw.js` reste `cuisine-os-v0.14.0-12`, épingle 5680) ;
  `APP_VERSION 0.15.0` dès T2. Chaîne réelle de `sw.js` : `-1` (T2 `a2cafe0`), `-2` (T2-R1 `68ce8fb`), `-3` (T3 `09af72c`), `-4` (T3-R1 `7cb1145`),
`-5` (T4
  `d0d3161`), `-6` (T4-R1 `58aa0c1`), `-7` (T5 `a3b55c8`), `-8` (T5-R1 `fb3b30c`), `-9` (vague `b65988f`) ; épingles 5680, 5738, 5750, 5839, 5859, 5876,
  5881, 5920, 5935, 5947. Les attendus du rejeu (5681 / 5739 / 5828 / 5845 / 5884, `-1` à `-4`) sont dépassés par les rondes ; les deltas propres aux
  tâches (+58, +89, +17, +39) sont ceux du rejeu : la tête réelle fait foi (R-C-7). Node 174 → 203 (T1) → 204 (T2) → 206 (T5) → 208 (vague) ; `tsc`
  5.6.3 `--strict` 0 à chaque tâche qui touche la fonction. Le commit de clôture ne touche pas `src/`. Coût si faux : nul.
- **R-F-23 (assertions hors brief et amendées, I-D11)** — Ratifiées, ajoutées et jamais retirées : celles des rondes (T1-R1, T2-R1 +12, T3-R1 +20,
  T4-R1 +5, T5-R1 +15), de la vague (+12), la borne de 500 ms de T3 (M17) ; les quinze pins passées à `0.15.0` pendant les Steps rouges (le rouge égale
  celui du rejeu) ; `tools/generer-migrations.test.mjs` à l'égalité `OUTILS` = `OUTILS_0006` (R-F-9). Coût si faux : un libellé qui laisse croire que
§ 7
  nommait l'assertion.
- **R-F-24 (mutants)** — T1 19/19 + M20 ; T2 18/18 ; T3 tous rouges sauf deux équivalents observables (une seule définition de `pointeurValide`, une
  seule
  lecture `files`) ; T4 12/12 (M07a/M07b, M11 rejoué seul) ; T5 78/78 (client 57, serveur 21 dont M21 « réservation après `telechargerImage` ») ; vague
  22/22. Équivalents déclarés : les quatre redondances de T1 ; R-F-10 (négatives « cartes » : aucun rouge intermittent sur trois passages, M01-M03
  rouges). Rouges de charge connus : les deux tests de temps du lot B, joués seuls ; les mutants Node se jouent un par un. Les copies des agents
  (`lots/F/build`, ~1,1 Gio) restent nommées, aucun effacement récursif. Coût si faux : un rouge lent au lieu d'un rouge nommé.
- **R-F-25 (dettes nommées, sans décision)** — `HASH` (`schema.js`) double `HASH_FICHIER` (`src/sync/tables.js`) : le lot qui touchera `tables.js`
  écrit `export const HASH_FICHIER = HASH` ; commentaires périmés d'`index.ts` autour de la boucle partagée (bloc de B) ; `PROFONDEUR_IMAGE = 2` et le
  rognage d'`og:image` non épinglés ; la garde `r.redirected` pour `image-web` tenue par le test de source « un seul `redirect: 'manual'` » et non par
  un test de comportement ; le test de borne « 2 Mio de `<meta` sans `>` » (§ 7.1) ne mesure pas `lireMetaTranche` (gardé tel quel, son jumeau sur des
  balises fermées tient la borne) ; une vue insérée puis détachée sans avis reste enregistrée jusqu'au prochain montage (une par montage au plus) ;
  une lecture `files` par carte (`repo.getFiles` si l'iPhone peine) ; les autres champs de la fiche viennent de la copie du rendu (C4 du lot UX,
  R-B-27) ; rien n'est mesuré sous le vrai runtime Deno (`redirect: 'manual'`, relais des signaux pendant le corps, mémoire 2 Mio + base64) ni dans
  Safari, sur l'iPhone ou avec ImageIO. Coût si faux : nul — chaque ligne a sa lecture.
- **R-F-26 (limites, § 11)** — Ratifiées : une descente déjà en vol sur la fiche abandonne l'essai annoncé sans rien dire (`vol_tenu` ; fiche sans
  photo : « non récupérée », il faut payer « Réessayer » ; photo web en place : l'ancienne image reste, `fabriquerLectureWeb` ne réécrit pas
  `photo_source_url` quand une photo est en place) ; une fiche supprimée entre la relecture et « Enregistrer » → refus `inconnu` ; un JPEG distant
  corrompu (FF 00, EOI ou SOS avant le SOF) est refusé bien que Chrome le décoderait ; une Recipe lisible sans image accompagnée d'une vignette liée
  perd son `og:image` ; le résidu SSRF de R-F-19. Coût si faux : un appel payé pour rien, jamais une photo de la personne écrasée.
- **R-F-27 (serveur, redéploiement, preuve ; R-C-32 reprise)** — La fonction `assistant` est modifiée (cinquième outil `image-web`) et NON déployée :
  le redéploiement est un geste du chef d'orchestre, APRÈS que Neegan a collé et prouvé la `0006` à cinq outils avec le lot B (verdict 2.031 relu dans
  `RESULTATS-mitsu.md`), suivi des sondes S-F1 à S-F3 sans dépense, de S1-S9 et S13-S16 rejouées, puis des deux sondes payantes d'un appel chacune et
  zéro jeton (S-F4, S-F5), avec la session de Neegan lue comme au README ; la preuve § 10 sur le site public est le geste de Neegan (deux appels par
  recette web) ; aucun agent ne dépense d'appel. Après la fusion et le push, tous les appareils sur 0.15.0 avant la première photo web d'une
  bibliothèque partagée. Coût si faux : un appel du quota.
- **R-F-28 (lettre de la spec)** — Alignés en rév. 4 : I-F5 et § 4.3 (une transaction par `{ key, fusion }`, plus deux), § 11 « Fenêtres de la garde
  finale », § 6.1 (`imageUrlDe` : candidats validés tour à tour, dégénérées écartées, garde de liste), § 7.1 (jumeau S-4 sur des balises fermées) ;
  `docs/architecture.md` : `OUTILS` en porte cinq. Les trois choix de § 13 restent à Neegan, le lot a construit les défauts. Coût si faux : nul.
- **R-F-29 (clôture)** — Re-revue de la vague PROPRE ; aucune ronde de clôture. `/verify` mécanique sur `b65988f` (registre `verify-F-b65988f.txt`) :
  suite `✅ 5948/5948` (épingle 5947, `tests/tests.js:250`), seule erreur de console le 404 de `/favicon.ico`, Node 208/208, `--check` 0, `tsc` 5.6.3
`--strict` 0, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, `DB_VERSION` 4, secrets 0, invisibles 0, arbre propre, 11 commits depuis `111f857`.
Le registre `progress.md` a été alimenté par les agents (Départ, tâches, rondes) et complété par le chef. Registre copié dans
  `~/projects/mistu/.superpowers/sdd/2026-10-19-plats-en-images/` (`diff -rq` muet) ; tête finale = le commit de clôture qui pose cette rév. 4,
  `CLAUDE.md`, `STATE.md` et `docs/architecture.md`. La chaîne A → B → G → C → D → E → F est complète. Coût si faux : nul.

**Mesures finales de la construction.** Tête de code `b65988f`, `APP_VERSION 0.15.0`, `sw.js cuisine-os-v0.15.0-9`, épingle 5947 (`tests/tests.js`),
suite 5948/5948 (plus le 404 de
`/favicon.ico`), Node 208/208, `--check` 0, `tsc` 5.6.3 `--strict` 0, invisibles 0 (Python), aucune clé, aucune migration (`DB_VERSION` 4, `TABLES`
intact ;
`OUTILS` = `OUTILS_0006`, cinq outils), fonction `assistant` modifiée (outil `image-web`) et NON déployée ; registre
`.superpowers/sdd/2026-10-19-plats-en-images/` (copie dans `~/projects/mistu/.superpowers/sdd/`).

## 13. Points à trancher par Neegan (≤ 3)

**Après la construction (rév. 4, 23 octobre 2026).** Les rulings de construction R-F-19 à R-F-29 (§ 12 « Rév. 3 → rév. 4 ») tranchent ce que
les tâches, les rondes, la revue finale et sa vague ont remonté ; les trois choix ci-dessous restent à Neegan, sans urgence : le lot a construit les
défauts. Restent aussi des gestes, pas des décisions : (a) le redéploiement de la fonction `assistant` (cinquième outil `image-web` ; geste du chef
d'orchestre, après la `0006` collée et prouvée par Neegan avec le lot B) et les sondes S-F1 à S-F5 (§ 10 pas 2, deux appels payants sans jeton) ;
(b) après la fusion et le `push`, la preuve § 10 sur le site public (première photo web réelle : deux appels) ; (c) tous les appareils sur 0.15.0 avant
la première photo web d'une bibliothèque partagée ; (d) Safari et iPhone jamais mesurés ; (e) le registre `.superpowers/sdd/2026-10-19-plats-en-images/`
copié dans `~/projects/mistu/.superpowers/sdd/` (`diff -rq` muet) AVANT tout `git worktree remove`, « clean » après. Dettes de code nommées, sans
décision à prendre : voir R-F-25 (§ 12) ; aucune ne change un comportement promis.

**Avant la construction (rév. 3) :** Les questions au chef d'orchestre sont tranchées (R-F-1 à R-F-6, § 12) : rien d'autre n'est ouvert. Restent les
trois choix de Neegan ; chacun a
son défaut, que le plan construit si Neegan ne dit rien.

1. **L'image d'une recette web est cherchée toute seule après « Enregistrer » (défaut, D-F3 : deux appels par recette web, annoncé à l'écran) — ou
   seulement sur une tape « Récupérer la photo » dans la section de la fiche** (un appel seulement quand tu le veux ; l'écran a_verifier n'annonce
   rien). Coût si tape : un geste de plus par recette web ; coût si automatique : la moitié du quota pour une journée d'imports web.
2. **Vignette à droite des cartes, 72 px (défaut, D-F9) — ou bandeau pleine largeur en tête de carte, façon magazine** (direction des maquettes,
   hors lot depuis D-9 du lot A). Coût si bandeau : des cartes deux fois plus hautes dans la recherche et les listes.
3. **Les gestes de la photo dans une section « Photo du plat » après la préparation, comme la couverture d'un livre (défaut, D-F2) — ou juste sous
   l'image en tête de la fiche.** Coût si en tête : une carte de plus au-dessus des ingrédients sur chaque recette sans photo (« Ajoute une photo du
   plat… ») ; coût du défaut : défiler jusqu'en bas pour changer la photo.
