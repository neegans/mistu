# Refonte visuelle « magazine culinaire » — spec de design

Date : 18 octobre 2026 (nuit). **Révision 2** (après la revue adverse R1-R19 — § 7). **Amendée à la clôture** (tâche 4, sur la
pointe `332d818`) : § 2 (T-1, T-3, T-4, T-5, T-7), § 3.6, § 4, § 5, § 6 et § 8 (rulings R-VIS-1 à R-VIS-12). **Amendée à la vague finale** (après la revue
finale de branche, sur `77e0218`) : V-5, § 2 (T-1, T-4, T-5, T-7), § 3.1, § 3.6, § 4, § 5, § 6, § 7 (R4) et § 8 (R-VIS-13, R-VIS-14). Les vérifications sur iPhone sont
marquées « à vérifier sur l'iPhone » : rien de ce lot n'a été mesuré sous Safari (aucun WebKit ici). Branche `refonte-visuelle` sur la pointe de
`creer-ia`, worktree `~/projects/mistu-look` (serveur `http://localhost:8085/`). Entrées : kit Gemini (hors dépôt, lecture seule)
`~/Downloads/mistu-claude-code-kit/` — `assets/design-references/01-magazine-culinaire.png` (direction retenue le 17 octobre),
`assets/design-tokens.json`, `MISTU-SPEC.md` § « Direction d'interface », `docs/05-ASSETS-SOURCES.md` (les photos du kit sont des
illustrations générées : **aucune n'entre dans l'app**). État actuel : `styles.css` (260 lignes à `237047a`, 315 après le lot (`77e0218`), 317 après la vague finale ; le
lot 2 y ajoute au moins `.proposition, .recipe-body { overflow-wrap: anywhere }` — **toute plage de lignes se reprend sur la pointe de
`creer-ia`**), coquille `src/app.js` `shell()` (barre haute verte, onglets bas sur mobile, panneau latéral ≥ 900 px).

## 0. Décisions de nuit (prises sans Neegan, renversables au matin)

- **V-1 Un thème, pas une refonte des écrans.** Jetons, composants, coquille. Aucun bloc déplacé, aucune classe JS renommée, aucun flux
  ni texte changé. Zéro changement de comportement ; aucun test de comportement retouché.
- **V-2 Direction 01 « magazine »** : papier `#f8f5ef`, encre `#242821`, gris `#636860` (revu R4 : 4,85 sur papier-2), filet `#e4dfd5`,
  **action tomate** `#bc3026` (survol `#98231b`), **accent vert** `#45604a`, titres en serif système (`Georgia, "Times New Roman",
  serif`, aucune police externe), corps en sans-serif système, rayon 12, ombres légères, photos généreuses **seulement quand l'app en a**.
- **V-3 La navigation garde sa structure** (onglets bas mobile, panneau latéral ≥ 900) ; barre haute « façon maquette » sur bureau =
  option du matin.
- **V-4 Le vert reste aux états** (« ok », « Original », couvertures sans image) ; ambre aux avertissements, brique aux dangers ; la
  tomate est l'action (boutons primaires, liens, actif, anneau de focus).
- **V-5 Accessibilité mesurée** : contrastes AA **calculés sur la feuille lue** pour chaque paire texte/fond réellement utilisée
  (§ 3.6 ; *amendé à la vague finale* : vrai seulement depuis la 28e paire, ambre sur accent-bg de `.cook .ingredients li.hit .est`,
  qui valait 4,49 et que ni la liste des 27 ni la galerie ne montraient — R-VIS-13), contour des champs ≥ 3:1, cibles ≥ 44 px (boutons, onglets, roue des Réglages), focus visible partout (y compris segments et
  état actif), `prefers-reduced-motion`, `color-scheme: light`, champs ≥ 16 px (iOS ne zoome pas), `[hidden]` imposé.
- **V-6 Preuve visuelle du contrôleur** (Playwright **dédié**, jamais le navigateur MCP partagé) : largeurs 375/390/768/1512 ; **porte
  d'entrée capturée puis passée** (« Continuer sans compte », une fois par contexte — sur localhost la synchro est configurée, R7) ;
  routes `#/`, `#/search?mode=web`, `#/library`, `#/add`, `#/recipes/creer`, `#/settings`, `#/kitchen` ; **galerie statique**
  `.superpowers/sdd/2026-10-18-refonte-visuelle/galerie.html` (non commitée, lie `/styles.css`) qui montre toutes les variantes (badges,
  puces, statuts, cartes, couvertures avec/sans image, champs, segments, barre haute **avec la pastille « 12 non envoyés » forcée**,
  onglets, toast, dialogue, mode cuisine) ; mesures : `scrollWidth <= innerWidth`, navigation visible, cibles ≥ 44 px, contraste calculé
  texte/fond par nœud texte de la galerie, géométrie M3 (bouton K1 / « Annuler ») re-mesurée ; captures PNG (`animations: 'disabled'`,
  `caret: 'hide'`, `timeout: 30000`, repli CDP `Page.captureScreenshot`, `reducedMotion: 'reduce'`, réseau externe coupé par `route`).

## 1. But, non-buts
**But.** Que l'app donne envie de cuisiner — grands titres serif, surfaces calmes, une action rouge claire, listes aérées, iPhone
d'abord — sans changer ce qu'elle fait. **Non-buts.** Police externe · images d'illustration · réécriture des vues (une classe additive au
plus, justifiée) · mode sombre · barre haute bureau · `exporters.js` (CSS inline) · icônes SVG (les émojis 📚 🗓 🍳 ne prennent pas `color` :
l'état actif des onglets repose sur le libellé et le trait, R16) · impression.

## 2. Invariants (T-1 … T-11)
- **T-1 Aucun changement de comportement.** Tests de comportement intacts ; aucun sélecteur JS renommé ; les seuls `display: none` sont les
  cinq d'origine (`aside.sidenav`, `nav.tabs` dans `@media`, `.accueil-livre .sources:empty`, `.menu-source summary::-webkit-details-marker`,
  `.cover.with-img .title, .cover.with-img .author`) — **égalité exacte** de l'inventaire, commentaires retirés (R11) ; aucun
  `visibility: hidden`, `opacity: 0`, `font-size: 0` nouveau. Les règles qui portent le comportement ne bougent pas : `.status` en
  `inline-flex` (après `.row` dans l'ordre des sources), `.row { flex-wrap: wrap }`, `.menu-source summary { display: inline-flex;
  list-style: none }`, `main.content` et `.toast` calés sur `--nav-h + --safe-b`, `.cover-wrap { position: relative }`. *Amendé (R-VIS-8, tâche 3 ; revue de T3)* :
  la structure « `.status[role="status"]` suivie d'une `.row` » devient un **crochet de style** (« Annuler » à droite pendant un
  vol). Dans l'app, `role="status"` est gardé par les tests de comportement (`tests/recherche-web.js:383`, F20 ; `tests/creer-ia.js`,
  aide `statutVol` l. 554 et 1497) ; l'assertion R-VIS-8 de `tests/theme.js` construit son propre DOM : si la rangée est enveloppée
  ou la classe `.status` changée, **seule la preuve M3** (hors git) le verra. *Amendé (vague finale, R-VIS-14)* : les règles qui portent le
  comportement sont **épinglées** par `tests/theme.js` — ordre des sources (`.status` après `.row`, positions lues dans la feuille
  servie), `.row` en `wrap`, la mention K1 `div.status.row.between` en `inline-flex`, `.menu-source summary` (`inline-flex`, sans
  marqueur) et `.cover-wrap` (`relative`) mesurés au rendu ; `.toast` et `main.content` (règles de base) lus sur leurs déclarations ;
  les cinq mutants de la revue finale rougissent (copie servie à part).
- **T-2 Jetons uniques.** Toute couleur vit dans `:root` ; hors `:root`, liste blanche **exacte** : `#fff` (champs, `iframe.pdf`, `.kbd`) et
  `#222` (`.page-view`) ; aucun `rgba(`/`hsl(` hors `:root` (le fond du dialogue devient `--backdrop`). Alias des anciens noms.
- **T-3 Contrastes AA calculés** sur les paires de § 3.6 (≥ 4,5:1) ; **T-10 contour des champs ≥ 3:1** (`--field-line`) ; couverture :
  dégradé **inversé** (`accent-2` → `accent`) pour que le titre (6,38) et l'auteur restent lisibles (R4). *Amendé (R-VIS-5, tâche 3)* : l'auteur
  perd `opacity: .85` — avec elle, il ne tenait 5,16 que sur `accent` et tombait à **4,14** sur `accent-2` (mesuré par la preuve V-6 :
  un titre sur deux lignes remonte l'auteur vers le haut du dégradé, et chaque nœud est comparé à tous les arrêts) ; sans elle :
  **5,01** sur `accent-2`, 6,38 sur `accent`.
- **T-4 Cibles ≥ 44 px** : `.btn`, `.btn.link`, `.btn.big`, roue des Réglages de la barre haute (`44×44`), onglets bas ≥ 48 px ; `.btn.small`
  ≥ 36 px (jamais seul sur un geste principal : dette nommée pour « − / + » des portions) ; `.chip.removable` ≥ 32 px. *Amendé (R-VIS-3, tâche 3)* : dans la barre haute, la marque `a.brand` (boîte flex de 44 px de
  haut) et la pilule de recherche (`.topbar .btn.small`, ≥ 44 × 44) sont des cibles principales, comme la roue ; la barre garde 64 px par
  `min-height: calc(var(--topbar-h) + var(--safe-t))` (`styles.css` l. 73 ; le contenu seul en fait 61 : 44 + 16 + 1). Champs : 44 px de haut (tâche 2, alignés sur `.btn` dans une `.row`).
- **T-5 Focus visible** : `:focus-visible` tomate 2 px décalé 2 px ; `.segmented button:focus-visible { outline-offset: -3px }` (sinon
  coupé par `overflow: hidden`) ; `.btn.active:focus-visible { outline-color: var(--action) }` ; champs `:focus-visible` tomate (R9). *Amendé (tâche 3)* : les segments d'extrémité sont arrondis côté extérieur
  (`.segmented button:first-child` / `:last-child`, `--radius-pill`, R-VIS-6) — l'anneau décalé de −3 px suit le rayon et n'est plus
  coupé aux coins (M14 : focus au clavier réel, 20 cibles sur 20 aux quatre largeurs) ; le survol `.btn:hover` / `.btn.primary:hover`
  vit sous `@media (hover: hover)` (R-VIS-12 : sur iOS, un survol reste collé après une tape et se lit « choisi » — à vérifier sur
  l'iPhone). *Amendé (vague finale)* : `nav.tabs a:focus-visible { outline-offset: -3px }` — l'onglet touche le bas de l'écran
  quand `--safe-b` vaut 0 ; décalé de +2 px, l'anneau sortait de l'écran (revue finale : `[-4, 633, 68, 704]` pour une fenêtre
  320 × 700) ; rentré, son contour extérieur est à 1 px à l'intérieur de l'onglet (Tab réel dans la galerie, 320 × 700 et 375 × 812). Le
  champ focalisé se distingue de l'anneau global par son contour tomate (`input:focus-visible`, épinglé).
- **T-6 Mouvement** : transitions ≤ 160 ms (couleur, fond, bordure) ; `prefers-reduced-motion: reduce` → aucune transition ni animation.
- **T-7 Pas de débordement horizontal** à 375 et 390 px, **pastille visible comprise** (R8) : `.topbar .brand, .topbar .pastille, .topbar
  .btn:last-child { flex-shrink: 0 }`, `.topbar .btn { min-width: 0 }`, `.topbar .btn .nowrap { min-width: 0; overflow: hidden;
  text-overflow: ellipsis }`, titres `overflow-wrap: anywhere; hyphens: auto`. *Amendé (R-VIS-3, tâche 3 ; revue de T3)* : pour la pilule de
  recherche, `.topbar .btn.small { min-width: 44px }` remplace le `min-width: 0` de `.topbar .btn` (plancher de cible) ; à 375 px avec
  la pastille, la pilule peut encore céder 21,7 px (65,7 → plancher de 44 ; `task-3-report.md`) ; c'est ce plancher qui fait déborder la barre à 320 px avec la pastille
  (341 px) — 320 px est la largeur d'un iPhone de 375 ou 390 px en mode « Agrandir l'affichage » (revue de T3) : à signaler à Neegan.
- **T-8 Le thème est servi et la barre d'état se lit** : `sw.js VERSION` ; `meta theme-color` et manifeste = `--paper` ; `apple-mobile-web-
  app-status-bar-style` passe à **`default`** (R6 : avec `black-translucent`, iOS écrit l'heure en blanc sur l'ivoire — 1,09:1) ;
  `color-scheme: light`.
- **T-9 `[hidden]` cache vraiment** : `[hidden] { display: none !important; }` (R5 : la pastille, le panneau d'index, l'erreur du signet et
  l'aide du web sont cachés par l'attribut ; une règle `display` d'auteur les montrerait).
- **T-11 Hauteur de barre en jeton** : `--topbar-h` (le panneau latéral était calé sur `56px` en dur) ; `.card { scroll-margin-top:
  calc(var(--topbar-h) + .5rem) }`.

## 3. Le thème
### 3.1 Jetons (`:root`)
```
--paper:#f8f5ef --paper-2:#f1ece3 --card:#fffdf9 --ink:#242821 --muted:#636860 --line:#e4dfd5 --field-line:#8f8a80
--action:#bc3026 --action-2:#98231b --action-bg:#f7e3e0 --accent:#45604a --accent-2:#55705a --accent-bg:#e4ebe2
--warn:#8b5f10 --warn-bg:#fbf1dc --warn-line:#ead9b3 --danger:#9c2f22 --danger-bg:#f9e4df --danger-line:#e9bfb6 --ok:#3d6b4a --ok-bg:#e2efe4
--backdrop:rgba(36,40,33,.45) --tap:rgba(188,48,38,.15)
--radius:12px --radius-pill:999px --shadow:0 1px 2px rgba(36,40,33,.05), 0 8px 24px rgba(36,40,33,.06)
--serif:Georgia,"Times New Roman",serif --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif
--topbar-h:64px --nav-h:64px --safe-b/--safe-t inchangés ; color-scheme: light
alias : --cream:var(--paper) --cream-2:var(--paper-2) --green:var(--accent) --green-2:var(--accent-2) --sage:#b9c8bb --sage-2:var(--accent-bg)
```
*Amendé à la vague finale (R-VIS-13)* : `--warn` passe de `#8d6111` à `#8b5f10`.
### 3.2 Typographie
`body` sans 16 px / 1,5 ; `h1` serif 2,1 rem (2,6 rem ≥ 900) 600 / 1,1 encre, `overflow-wrap: anywhere; hyphens: auto` ; `h2` serif 1,45 ;
`h3` serif 1,15 ; `.porte-titre` serif 3 rem ; `.brand` serif 1,25 rem, **aucun `text-transform`** ; `.qty` tabulaire encre ; **`.mirror`
reste en `--sans`** (Georgia ignore `tabular-nums` : le compte à rebours sautillerait, R14), tomate ; champs `font-size: 1rem` minimum.
### 3.3 Coquille
`.topbar` : papier, filet bas, encre, hauteur `--topbar-h`, `-webkit-tap-highlight-color: var(--tap)` ; `.brand` serif ; `.topbar .btn`
contour (`--line`, encre) ; la règle morte `.topbar .btn.primary` est retirée ; roue des Réglages `min-width/min-height: 44px`,
`justify-content: center` ; T-7. `nav.tabs` : carte, filet haut, `a` ≥ 48 px, actif tomate + `box-shadow: inset 0 2px 0 var(--action)`,
`a.add .ico` pastille tomate 40 px. `aside.sidenav` (≥ 900) : papier-2, `top/height` sur `--topbar-h`, actif carte + tomate + `inset 3px 0
0 var(--action)`, « Ajouter » tomate pleine.
### 3.4 Composants
`.btn` pilule 44 px (`.small` 36, `.big` 56, `.link` 44, `.primary` tomate/ivoire, `.sage` accent-bg/accent, `.danger` brique +
`--danger-line`) ; `.chip` pilule papier-2/encre + filet ; `.puce[aria-pressed=true]` tomate ; `.card` carte + filet + ombre légère ;
`.card.warn` `--warn-line`, `.card.danger` `--danger-line` ; `.badge` capitales 0,7 rem pilule : `.available` ok, `.reference` ambre,
`.original` accent, `.ai` action-bg/action, `.personal` papier-2/encre, `.partial` papier-2/encre ; champs : filet `--field-line`, rayon 12,
`:focus-visible` tomate, `font-size: 1rem` ; `.search-bar input` 52 px pilule ; `.segmented` pilule, actif encre sur papier-2 + souligné
tomate, focus `outline-offset: -3px` ; `.status.info` accent-bg ; `.toast` encre/papier ; `dialog::backdrop` `--backdrop` ; `.step-num`
tomate ; `.progress > div` tomate ; `.cover` dégradé `accent-2 → accent` ; `.cook .ingredients li.hit` accent-bg ; `[hidden]` (T-9) ;
`:focus-visible` (T-5) ; `prefers-reduced-motion` (T-6) ; `.proposition, .recipe-body` conservés.
### 3.5 Hors CSS
`index.html` : `theme-color` `#f8f5ef`, status bar `default` ; `manifest.webmanifest` : `theme_color`/`background_color` `#f8f5ef` ; `sw.js`
`VERSION` ; docs.
### 3.6 Paires de contraste mesurées (texte / fond — où)
encre/papier (corps) · gris/papier (`.muted`) · gris/papier-2 (`.badge`, `.chip.neutral`) · gris/carte · gris/accent-bg (`small.muted` dans
`.card.sage`) · gris/warn-bg, gris/danger-bg, gris/ok-bg, gris/action-bg · tomate/papier (liens) · papier/tomate (`.btn.primary`) ·
papier/action-2 (survol) · accent/papier · accent/accent-bg (`.badge.original`) · tomate/action-bg (`.badge.ai`) · tomate/accent-bg ·
ambre/warn-bg (`.status.warn`, `.chip.warn`, `.badge.reference`) · ambre/papier (`.qty .est`) · ambre/carte · ambre/accent-bg
(`.cook .ingredients li.hit .est`, 28e paire, R-VIS-13) · brique/danger-bg · ok/ok-bg ·
encre/paper-2 (`.segmented` actif) · encre/carte · carte/encre (`.toast`) · papier/accent (`.cover` bas) · papier/accent-2 (`.cover` haut).
Toutes ≥ 4,5 — *vrai seulement depuis la 28e paire de la vague finale, voir plus bas* (papier/accent-2 = 5,01 avec `#55705a` — R-VIS-2 : `#5f7a64` donnait 4,33). Contour : `--field-line`/`#fff` 3,43 et `--field-line`/papier 3,16 (≥ 3).

*Amendé à la clôture (recalculé par la formule du test sur les jetons de `332d818`)* : une 27e paire, **tomate/carte** (onglet actif,
panneau actif, `.btn.link`, `.mirror` : 5,76), ajoutée par la tâche 2 ; minimum des 27 paires **4,63** (gris/action-bg), puis 4,67
(gris/danger-bg) et 4,70 (gris/accent-bg). Couverture : papier/accent-2 **5,01** et papier/accent 6,38, pour le titre **et** pour
l'auteur, désormais sans opacité (R-VIS-5 ; la note « auteur 5,16 » de T-3 valait pour `opacity: .85` sur `accent` seul). Contraste
**rendu** (preuve V-6 de la tâche 3, chaque nœud texte contre son fond effectif) : minimum **4,67** sur 1 732 nœuds, aucun sous 4,5.

*Amendé à la vague finale (R-VIS-13)* : « toutes ≥ 4,5 » était faux pour une paire utilisée et absente de la liste : ambre sur accent-bg
(mode cuisine, l'étape courante cite un ingrédient dont la quantité est estimée ou convertie : `li.hit` + `span.est`) valait **4,49**
avec `#8d6111` — ni `PAIRES` ni la galerie ne la montraient. Avec `--warn: #8b5f10`, recalculées par la formule du test sur la feuille
de la vague : les **28** paires sont ≥ 4,5, minimum **4,62** (ambre/accent-bg), puis 4,63 (gris/action-bg) ; paires de l'ambre :
accent-bg 4,62, warn-bg 5,00, papier 5,16, carte 5,52 (hors liste : papier-2 4,77) ; contour inchangé (3,43 / 3,16). Contraste **rendu**
(preuve relancée par la vague, la galerie montre désormais `li.hit .est`) : minimum **4,62** sur 1 760 nœuds, aucun sous 4,5 ; avec
l'ancien `--warn` (feuille forcée, copie servie à part), la même galerie sort ROUGE : 2 nœuds `span.est` à 4,49.

## 4. Tests (`tests/theme.js`, lit et mesure, ne recopie pas)
Jetons de § 3.1 présents (alias compris) ; `hex()` résout `var()` et accepte 3 ou 6 chiffres ; `:root` lu par regex ancrée ; toutes les
paires de § 3.6 calculées ≥ 4,5 et le contour ≥ 3 ; aucune couleur hex/rgba/hsl hors `:root` sauf `#fff`/`#222` (CSS sans commentaires) ;
inventaire **exact** des `display: none` + zéro `visibility: hidden`/`opacity: 0`/`font-size: 0` ; `[hidden]{display:none !important}`,
`:focus-visible`, `prefers-reduced-motion`, `color-scheme: light` présents ; `theme-color` et manifeste = `hex('--paper')` ; status bar
`default`. **Mesures rendues** (feuille injectée par `<link>` avec `?v=`, retirée en `finally` ; scène hors écran **visible**) : `.btn` ≥ 44,
`.btn.small` ≥ 36, `.btn.link` ≥ 44, onglet (`nav.tabs` monté avec `style="position:static;display:flex"`, R1) ≥ 48, `h1` contient
`georgia` (R2), `body` non, `.btn`/`.chip` `borderRadius` `999px`, `.pastille[hidden]`/`.card[hidden]`/`small.muted[hidden]` →
`display: none` (T-9), un `input` focalisé → `outlineColor` = tomate en `rgb()`, `input` `fontSize` ≥ 16 px, `.segmented button.active`
contraste calculé ≥ 4,5 (`rgbVersHex`), `.topbar` : couleur calculée de `.brand` sur fond calculé ≥ 4,5.

*Amendé à la clôture* : le bloc compte **69** assertions (total épinglé de `tests/tests.js` 2553 → 2622). La tâche 2 y a ajouté les
arrêts du dégradé de `.cover` (ordre compris), les champs `url` et `password` (16 px, contour ≥ 3:1), la paire tomate/carte, les
couleurs **nommées** hors `:root` (liste fermée des 148 de CSS Color 4) et le **contenu** des blocs `:focus-visible` et mouvement
réduit ; la tâche 3, le focus mesuré de `.btn.active` et d'un segment (`:focus-visible`, tomate, −3 px), une assertion groupée du
contraste **rendu** des composants (`.btn.*`, `.chip*`, `.puce`, `.badge.*`, `.status.*`, `.step-num`, `.toast`, `.pastille`) avec
`.chip.removable` ≥ 32 et `.search-bar input` = 52, le survol sous `(hover: hover)` (lu sur la feuille) et R-VIS-3, 5, 6, 7, 8, 10, 11.
**R-VIS-4 n'est pas épinglé** (la page de tests est large : les règles sous 440 px n'y jouent pas) : seule la preuve V-6 le mesure.

*Amendé à la vague finale* : **79** assertions (total épinglé 2622 → 2632) — la 28e paire et le pin de `--warn` (R-VIS-13) ; six
assertions R-VIS-14 (ordre des sources `.status`/`.row`, `.toast` et `main.content` calés sur `--nav-h + --safe-b`, `.row` en `wrap` et
K1 en `inline-flex`, `summary` du menu, `.cover-wrap`) ; `h2` Georgia et `.mirror` sans ; `input:focus-visible` (contour tomate,
anneau décalé 2 px) distingué de l'anneau global ; onglet bas focalisé rentré de 3 px.

## 5. Dettes nommées
Mode sombre · barre haute bureau · icônes SVG · police de marque · `exporters.js` · barre d'état iOS à vérifier sur l'appareil (app
installée : réinstaller pour relire la balise) · `.chip.removable` = `span` cliquable non focalisable · case à cocher `display:none` en ligne
(`kitchen.js:42`) · pas d'`aria-current` sur l'onglet actif · `scrollIntoView({ behavior: 'smooth' })` ignore `reduced-motion` · « − / + »
des portions en 36 px · pas de `color-mix()`/`oklch` (iOS < 16.2) — respecté.

*Complété à la clôture* (tâches 1 à 3 et leurs revues ; une ligne chacune) :
- **À vérifier sur l'iPhone** (tout est mesuré sous Chrome) : la barre d'état `default` (réinstaller l'app ; la page ne passe plus
  sous la barre d'état, `--safe-t` non mesuré sur l'appareil) ; l'onglet actif (tomate + trait) ; le survol non collé (R-VIS-12) ; la
  marge de 3,4 px du libellé de recherche à 390 px (R-VIS-4) ; le voile du dialogue (`::backdrop` + `var()` = Safari ≥ 17.4, sinon
  dialogue sans voile, rien de caché) ; la puce bascule cochée (`:has()`, iOS ≥ 15.4, sinon règle ignorée et puce neutre).
- 320 px avec la pastille : la barre haute mesure 341 px (21 px de débordement ; hors T-7, qui vise 375/390 ; ancien thème 480).
- Libellé de la recherche coupé à 375 px sans pastille (147/159 px) et sous 768 px avec la pastille (R-VIS-4 ; T-7 tenu : ellipse,
  `title` « Recherche » et « ⌕ » restent).
- `src/ui/import.js:136` : style en ligne `font-size: .8rem` sur le champ « p. imprimée » (12,8 px : iOS zoome) — dette JS, hors thème.
- Sans assistant configuré, la seule action de `#/recipes/creer` et de l'onglet Web est un « Réglages » de 36 px (`.btn.small`) :
  T-4 dit « jamais seul sur un geste principal » — balisage des lots web et création.
- Segments hors recherche à 36-38 px (T-4 ne les vise pas) ; segments de `#/search?mode=web` sur deux lignes à 375/390 (R-VIS-9).
- **Bug préexistant, hors lot** (revue de T3 ; à corriger dans un lot de comportement) : dans Réglages, `src/ui/settings.js:43-45`
  met des segments dans un `label.field` (`field()` de `components.js` rend un `<label>`) : toucher le libellé ou la zone vide du champ
  active la **première** option — R-UX-8 n'est pas appliqué là. R-VIS-11 ne règle que l'apparence (plus de queue vide).
- `.btn.link:hover` et `.item-link:hover h3` restent hors `@media (hover: hover)`.
- `scroll-margin-top` de 72 px (T-11) suppose une police racine de 16 px : faux rouge possible, jamais faux vert.
- Les assertions de focus dépendent de l'heuristique `:focus-visible` de Chromium (une interaction au pointeur avant le bloc : faux
  rouge, jamais faux vert).
- R-VIS-8 est un crochet de style sur une structure du JS (T-1 amendé) : si `role="status"` disparaît, les tests de comportement
  rougissent ; si la rangée est enveloppée ou la classe `.status` changée, seule la preuve M3 (hors git) le voit — l'assertion de
  `tests/theme.js` construit son propre DOM.
- Portée de R-VIS-8 : la règle vise **tous** les boutons non primaires de la rangée ; une future annonce `role="status"` suivie d'une
  `.row` à deux boutons non primaires ou plus les écarterait tous (un `:last-child` la bornerait).
- L'assertion groupée du contraste rendu de `tests/theme.js` ignore l'opacité (seule l'assertion R-VIS-5 de l'auteur la compose).
- Le souligné tomate de l'option active d'extrémité suit la courbe de la pilule (R-VIS-6 : accepté).
- L'outil de preuve `preuve-visuelle.cjs`, `galerie.html`, les résultats et les 136 captures vivent dans le registre SDD, **hors git**.

*Complété à la vague finale* (ce que la vague ne corrige pas ; revue finale de branche) :
- Liste blanche T-2 sans vérification d'usage : `tests/theme.js` accepte `#fff` et `#222` partout hors `:root` (une règle neuve
  `color: #fff` passerait) ; la spec dit où (champs, `iframe.pdf`, `.kbd` ; `.page-view`), le test ne le vérifie pas.
- `--safe-t` ignoré par `aside.sidenav` (`top`/`height` sur `--topbar-h`) et par `.card { scroll-margin-top }` alors que la barre haute
  en tient compte : sans effet en `default` (`--safe-t` = 0) ; à refaire si la barre d'état repasse en `black-translucent`.
- Titre d'une page trouvée (onglet Web, `a.btn`, `src/ui/search.js:244`) sur plusieurs lignes : la pilule devient un **ovale** (309 × 88
  à 375 px, 324 × 88 à 390, trois lignes, mesuré dans la galerie ; 275 × 88 dans l'app selon la revue) — **décision de Neegan**
  (garder, ou `--radius` pour ce cas) ; capture `captures/375-galerie-boutons.png` (échantillon ajouté à la galerie, hors git).
- R-VIS-14 lit `.toast` et `main.content` par expressions sur les déclarations : une réécriture équivalente (`calc(var(--safe-b) +
  var(--nav-h) + 12px)`) rougit — voulu (coût de R-VIS-14).
- L'anneau rentré des onglets bas est mesuré dans la scène de `tests/theme.js` et au Tab réel dans la galerie, pas dans l'app.
- Fermées par la vague : `.mirror` et `h2` épinglés ; `input:focus-visible` distingué de l'anneau global ; `li.hit .est` dans la
  galerie (et dans `PAIRES`).

## 6. Gestes de Neegan
Aucun avant la fusion. Au matin : regarder les captures (porte, coquille, galerie) ; sur l'iPhone, la barre d'état et l'onglet actif ;
renverser V-3/V-4 au besoin.

*Complété à la clôture* : captures dans `.superpowers/sdd/2026-10-18-refonte-visuelle/captures/` du worktree `~/projects/mistu-look`
(136 PNG, 34 par largeur : huit écrans dont la porte, 18 sections de la galerie, 5 focus au clavier, 3 de M3) — copier le registre dans
le dépôt principal **avant** tout `git worktree remove`. Sur l'iPhone, après fusion, `push` et **réinstallation** de l'app : barre
d'état, onglet actif, porte « Kwe. », survol après une tape, libellé de la recherche (à vérifier sur l'iPhone). Dire si « Agrandir
l'affichage » est activé sur l'iPhone (il le ramène à 320 px de large : avec la pastille, la barre haute y mesure 341 px). Confirmer ou
renverser V-1 à V-6, R-VIS-8 (placement d'« Annuler ») et R-VIS-4 (libellé coupé à 375 px) ; trancher l'ovale des titres web sur
plusieurs lignes (§ 5, capture `375-galerie-boutons.png`). Ordre complet des gestes : `CLAUDE.md`,
section du lot.

## 7. Ce que la revue a amendé (R1-R19)
R1 onglet monté `display:flex` · R2 `/georgia/i` · R3 assertions `.btn`/hex/rayon déplacées en T2 · R4 jetons `--warn #8d6111` (→ `#8b5f10`, R-VIS-13), `--muted
#636860`, dégradé inversé, paires § 3.6 · R5 T-9 `[hidden]` · R6 status bar `default` · R7 porte passée + galerie · R8 T-7 barre haute avec
pastille, 375 px · R9 T-5 segments/actif/champs · R10 `--field-line` · R11 inventaire exact · R12 `--warn-line`/`--danger-line`/`--backdrop`,
scan rgba, liste blanche `#fff`/`#222` · R13 cibles (roue 44, `.btn.link` 44, dette « − / + ») · R14 `.mirror` sans · R15 hygiène du test ·
R16 `--topbar-h`, règle morte, `text-transform`, émojis · R17 `color-scheme`, `--tap`, champs 16 px, `overflow-wrap`, dettes JS · R18 plages
reprises sur `creer-ia`, M3 re-mesuré · R19 recette de capture.

## 8. Rulings (R-VIS-1 à R-VIS-14)
Une ligne chacun : **R-VIS-n** (tâche) quoi — coût si faux. Détail : registre `.superpowers/sdd/2026-10-18-refonte-visuelle/`
(`progress.md`, `task-3-report.md`, `final-fix-report.md` ; hors git). Chacun se renverse sans défaire le reste (R-VIS-2, R-VIS-5 et
R-VIS-13 sont imposés par le contraste AA ; R-VIS-4 et R-VIS-8 sont les décisions de produit à confirmer par Neegan).
- **R-VIS-1** (pré-vol, appliqué en tâche 1) `.status[hidden] { display: none; }`, ajoutée par le lot 2, est retirée (redondante avec
  `[hidden] { display: none !important }`, T-9) ; l'inventaire T-1 redevient les cinq d'origine ; `['status', 'span']` rejoint les cas
  T-9 mesurés ; aucun test de comportement retouché (le test K1 du lot 2 lit `.hidden`) — coût si faux : la mention K1 visible (la suite
  rougit).
- **R-VIS-2** (pré-vol, tâche 1) `--accent-2: #55705a` (papier/accent-2 4,33 → 5,01 ; reste plus clair que `--accent #45604a`) — coût
  si faux : un vert de survol un peu plus sombre.
- **R-VIS-3** (contrôleur, appliqué en tâche 3) dans la barre haute, `a.brand` et la pilule de recherche (`.topbar .btn.small`) sont des
  cibles principales : ≥ 44 px (T-4 ne citait que la roue) ; la barre garde 64 px ; le seuil ±4 px de M3 est accepté et nommé — coût si
  faux : une barre visuellement identique, rien.
- **R-VIS-4** (tâche 3 ; **à confirmer**) sous **440 px** (pas 400) : barre `gap .4rem`, `padding-inline .75rem`, marque `1.15rem`,
  pilule `padding-inline .6rem` ; le libellé tient en entier de 390 à 439 px (marge ≥ 3,4 px, Chrome seulement), reste coupé à 375 sans
  pastille (147/159) et sous 768 avec la pastille (T-7 tenu) — coût si faux : une marque un peu plus petite sur iPhone, un libellé coupé
  à 375 ; à refaire si Safari mesure plus large (non mesuré).
- **R-VIS-5** (tâche 3) `.cover .author` perd `opacity: .85` (4,14 → 5,01 sur accent-2, 6,38 sur accent) — coût si faux : l'auteur
  aussi foncé que le titre (hiérarchie par taille et graisse seulement).
- **R-VIS-6** (tâche 3) `.segmented button:first-child` / `:last-child` arrondis côté extérieur (`--radius-pill`) : l'anneau n'est plus
  coupé aux coins (M14), fond actif et souligné tomate épousent la courbe ; `outline-offset: -3px` inchangé — coût si faux : le souligné
  de l'option active d'extrémité est courbé aux bouts.
- **R-VIS-7** (tâche 3) `.cover { position: relative }` : l'image d'une couverture prend `.cover` pour bloc conteneur, donc ses coins
  sont arrondis ; rectangle identique à 0,1 px près (390 et 1512) ; `.cover-wrap` intouchée (T-1) — coût si faux : aucun
  repositionnement mesuré ; un futur enfant positionné de `.cover` s'y calera.
- **R-VIS-8** (tâche 3, M3 ; **placement à confirmer**, au regard de V-1)
  `.status[role="status"] + .row > .btn:not(.primary) { margin-left: auto }` : pendant un vol (recherche web et création IA, seules structures « annonce `role=status` + rangée »), « Annuler »
  se range à droite ; 0 recouvrement mesuré aux quatre largeurs sur la recherche web (thème de T2 : 3 échecs à 375 et 3 à 390 ; ancien
  thème : 3 à 375) ; crochet de style sur une structure du JS (T-1 amendé) — coût si faux : « Annuler » à droite de la carte du vol
  (pouce droit), et un sélecteur qui dépend d'un attribut posé par le JS ; le retirer rouvre M3.
- **R-VIS-9** (tâche 3) segments de `#/search?mode=web` sur deux lignes à 375/390 (62 px) **gardés** (préexistant ; une ligne exigerait
  des segments de 38 px) — coût si faux : une pilule haute sur l'écran de recherche.
- **R-VIS-10** (tâche 3, jugé) `.chip.clickable:has(> input:checked)` = accent-bg / accent : la puce bascule **cochée** (capacités d'un
  appareil, `kitchen.js:42`) retrouve un indice de teinte ; restreinte à la case cochée (sur toute `.chip.clickable`, les exemples de
  l'accueil devenaient invisibles) ; contraintes d'un repas (`meals.js:74`) inchangées ; sans `:has()` la règle tombe — coût si faux :
  capacités cochées en vert.
- **R-VIS-11** (tâche 3, jugé) `.field > .segmented { align-self: flex-start }` : la pilule prend la largeur de ses options (Réglages,
  fiche recette) au lieu d'une queue vide qui se lisait comme un champ — coût si faux : aucun.
- **R-VIS-12** (tâche 3) `.btn:hover` et `.btn.primary:hover` sous `@media (hover: hover)`, texte des règles inchangé (survol collant
  sur iOS) ; `.btn.link:hover` et `.item-link:hover h3` restent hors média (nommés) — coût si faux : aucun survol sur un appareil
  tactile à souris non déclarée.
- **R-VIS-13** (contrôleur, vague finale) `--warn: #8b5f10` (était `#8d6111`) : ambre sur accent-bg 4,49 → 4,62 (`.cook .ingredients
  li.hit .est`, mode cuisine) ; les autres paires de l'ambre restent ≥ 4,5 (warn-bg 5,00, papier 5,16, carte 5,52) ; la paire entre
  dans `PAIRES` et dans § 3.6 (28e), le pin `hex('--warn')` suit — coût si faux : un ambre un peu plus sombre.
- **R-VIS-14** (contrôleur, vague finale) les règles porteuses de comportement de T-1 sont épinglées par `tests/theme.js` : `.status`
  après `.row` (positions dans la feuille lue, et K1 mesurée `inline-flex`), `.row { flex-wrap: wrap }`, `.menu-source summary
  { display: inline-flex; list-style: none }`, `.cover-wrap { position: relative }` (mesurés au rendu), `.toast` et `main.content`
  calés sur `calc(var(--nav-h) + var(--safe-b) …)` (déclarations des règles de base) ; les cinq mutants de la revue finale rougissent
  — coût si faux : un faux rouge sur une réécriture légitime d'une de ces règles (voulu).

### Précisions du pré-vol (18 oct, mesurées sur la pointe `618b454` du lot 2)
- Précision T-11 : seuls les deux `56px` de `aside.sidenav` (`top`/`height`) deviennent `var(--topbar-h)` ; `.btn.big { min-height: 56px }` reste.
- Couleurs en dur à migrer (mesurées) : `.badge.partial/.ai/.personal` (`#eef0d8/#6f7a1f`, `#e8e4f5/#4d3f8a`, `#e4ecf7/#2c4f7c`), `.card.warn/.danger` et `.btn.danger`
  (`#ead9b3`, `#e9bfb6`), `dialog::backdrop` (`rgba(29,35,31,.45)`), `.topbar .btn` (`rgba(255,255,255,.14)`).
- Hors CSS mesuré : `index.html:10` `theme-color #1f4d3a`, `:15` `black-translucent` ; manifeste `background_color #f6f1e7`, `theme_color #1f4d3a`.
