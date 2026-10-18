# Refonte visuelle « magazine culinaire » — spec de design

Date : 18 octobre 2026 (nuit). **Révision 2** (après la revue adverse R1-R19 — § 7). Branche `refonte-visuelle` sur la pointe de
`creer-ia`, worktree `~/projects/mistu-look` (serveur `http://localhost:8085/`). Entrées : kit Gemini (hors dépôt, lecture seule)
`~/Downloads/mistu-claude-code-kit/` — `assets/design-references/01-magazine-culinaire.png` (direction retenue le 17 octobre),
`assets/design-tokens.json`, `MISTU-SPEC.md` § « Direction d'interface », `docs/05-ASSETS-SOURCES.md` (les photos du kit sont des
illustrations générées : **aucune n'entre dans l'app**). État actuel : `styles.css` (256 lignes à la pointe d'`assistant-compte` ; le
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
  (§ 3.6), contour des champs ≥ 3:1, cibles ≥ 44 px (boutons, onglets, roue des Réglages), focus visible partout (y compris segments et
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
  list-style: none }`, `main.content` et `.toast` calés sur `--nav-h + --safe-b`, `.cover-wrap { position: relative }`.
- **T-2 Jetons uniques.** Toute couleur vit dans `:root` ; hors `:root`, liste blanche **exacte** : `#fff` (champs, `iframe.pdf`, `.kbd`) et
  `#222` (`.page-view`) ; aucun `rgba(`/`hsl(` hors `:root` (le fond du dialogue devient `--backdrop`). Alias des anciens noms.
- **T-3 Contrastes AA calculés** sur les paires de § 3.6 (≥ 4,5:1) ; **T-10 contour des champs ≥ 3:1** (`--field-line`) ; couverture :
  dégradé **inversé** (`accent-2` → `accent`) pour que le titre (6,38) et l'auteur (5,16) restent lisibles (R4).
- **T-4 Cibles ≥ 44 px** : `.btn`, `.btn.link`, `.btn.big`, roue des Réglages de la barre haute (`44×44`), onglets bas ≥ 48 px ; `.btn.small`
  ≥ 36 px (jamais seul sur un geste principal : dette nommée pour « − / + » des portions) ; `.chip.removable` ≥ 32 px.
- **T-5 Focus visible** : `:focus-visible` tomate 2 px décalé 2 px ; `.segmented button:focus-visible { outline-offset: -3px }` (sinon
  coupé par `overflow: hidden`) ; `.btn.active:focus-visible { outline-color: var(--action) }` ; champs `:focus-visible` tomate (R9).
- **T-6 Mouvement** : transitions ≤ 160 ms (couleur, fond, bordure) ; `prefers-reduced-motion: reduce` → aucune transition ni animation.
- **T-7 Pas de débordement horizontal** à 375 et 390 px, **pastille visible comprise** (R8) : `.topbar .brand, .topbar .pastille, .topbar
  .btn:last-child { flex-shrink: 0 }`, `.topbar .btn { min-width: 0 }`, `.topbar .btn .nowrap { min-width: 0; overflow: hidden;
  text-overflow: ellipsis }`, titres `overflow-wrap: anywhere; hyphens: auto`.
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
--warn:#8d6111 --warn-bg:#fbf1dc --warn-line:#ead9b3 --danger:#9c2f22 --danger-bg:#f9e4df --danger-line:#e9bfb6 --ok:#3d6b4a --ok-bg:#e2efe4
--backdrop:rgba(36,40,33,.45) --tap:rgba(188,48,38,.15)
--radius:12px --radius-pill:999px --shadow:0 1px 2px rgba(36,40,33,.05), 0 8px 24px rgba(36,40,33,.06)
--serif:Georgia,"Times New Roman",serif --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif
--topbar-h:64px --nav-h:64px --safe-b/--safe-t inchangés ; color-scheme: light
alias : --cream:var(--paper) --cream-2:var(--paper-2) --green:var(--accent) --green-2:var(--accent-2) --sage:#b9c8bb --sage-2:var(--accent-bg)
```
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
ambre/warn-bg (`.status.warn`, `.chip.warn`, `.badge.reference`) · ambre/papier (`.qty .est`) · ambre/carte · brique/danger-bg · ok/ok-bg ·
encre/paper-2 (`.segmented` actif) · encre/carte · carte/encre (`.toast`) · papier/accent (`.cover` bas) · papier/accent-2 (`.cover` haut).
Toutes ≥ 4,5 (papier/accent-2 = 5,01 avec `#55705a` — R-VIS-2 : `#5f7a64` donnait 4,33). Contour : `--field-line`/`#fff` 3,43 et `--field-line`/papier 3,16 (≥ 3).

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

## 5. Dettes nommées
Mode sombre · barre haute bureau · icônes SVG · police de marque · `exporters.js` · barre d'état iOS à vérifier sur l'appareil (app
installée : réinstaller pour relire la balise) · `.chip.removable` = `span` cliquable non focalisable · case à cocher `display:none` en ligne
(`kitchen.js:42`) · pas d'`aria-current` sur l'onglet actif · `scrollIntoView({ behavior: 'smooth' })` ignore `reduced-motion` · « − / + »
des portions en 36 px · pas de `color-mix()`/`oklch` (iOS < 16.2) — respecté.

## 6. Gestes de Neegan
Aucun avant la fusion. Au matin : regarder les captures (porte, coquille, galerie) ; sur l'iPhone, la barre d'état et l'onglet actif ;
renverser V-3/V-4 au besoin.

## 7. Ce que la revue a amendé (R1-R19)
R1 onglet monté `display:flex` · R2 `/georgia/i` · R3 assertions `.btn`/hex/rayon déplacées en T2 · R4 jetons `--warn #8d6111`, `--muted
#636860`, dégradé inversé, paires § 3.6 · R5 T-9 `[hidden]` · R6 status bar `default` · R7 porte passée + galerie · R8 T-7 barre haute avec
pastille, 375 px · R9 T-5 segments/actif/champs · R10 `--field-line` · R11 inventaire exact · R12 `--warn-line`/`--danger-line`/`--backdrop`,
scan rgba, liste blanche `#fff`/`#222` · R13 cibles (roue 44, `.btn.link` 44, dette « − / + ») · R14 `.mirror` sans · R15 hygiène du test ·
R16 `--topbar-h`, règle morte, `text-transform`, émojis · R17 `color-scheme`, `--tap`, champs 16 px, `overflow-wrap`, dettes JS · R18 plages
reprises sur `creer-ia`, M3 re-mesuré · R19 recette de capture.

## 8. Rulings du contrôleur au pré-vol (18 oct, mesurés sur la pointe `618b454` du lot 2)
- **R-VIS-1** : le lot 2 a ajouté `.status[hidden] { display: none; }` (sixième `display:none`) ; T1 la RETIRE (redondante avec `[hidden] { display: none !important }`,
  T-9) ; l'inventaire T-1 redevient les cinq d'origine ; le test K1 du lot 2 lit `.hidden`, aucun test de comportement retouché. Coût si faux : la mention K1 visible.
- **R-VIS-2** : `--accent-2: #55705a` (papier/accent-2 4,33 → 5,01 ; reste plus clair que `--accent`). Coût si faux : un vert de survol plus sombre.
- Précision T-11 : seuls les deux `56px` de `aside.sidenav` (`top`/`height`) deviennent `var(--topbar-h)` ; `.btn.big { min-height: 56px }` reste.
- Couleurs en dur à migrer (mesurées) : `.badge.partial/.ai/.personal` (`#eef0d8/#6f7a1f`, `#e8e4f5/#4d3f8a`, `#e4ecf7/#2c4f7c`), `.card.warn/.danger` et `.btn.danger`
  (`#ead9b3`, `#e9bfb6`), `dialog::backdrop` (`rgba(29,35,31,.45)`), `.topbar .btn` (`rgba(255,255,255,.14)`).
- Hors CSS mesuré : `index.html:10` `theme-color #1f4d3a`, `:15` `black-translucent` ; manifeste `background_color #f6f1e7`, `theme_color #1f4d3a`.
