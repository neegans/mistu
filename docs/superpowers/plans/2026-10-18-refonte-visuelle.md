# Refonte visuelle « magazine culinaire » — plan d'implémentation (rév. 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à Cuisine OS la direction « magazine culinaire » du kit par un thème CSS mesuré (contrastes AA calculés, cibles, focus, mouvement réduit, `[hidden]`, barre d'état iOS lisible) sans changer un seul comportement.

**Architecture:** Réécriture de `styles.css` autour de jetons uniques (anciens noms en alias), coquille et composants restylés règle par règle (une ligne de l'ancien = une ligne du nouveau, même ordre), `theme-color`/manifeste/status bar alignés, une suite `tests/theme.js` qui lit la feuille servie et calcule ce qu'elle promet, une galerie statique et une preuve Playwright du contrôleur (géométrie, contrastes rendus, captures) sur quatre largeurs.

**Tech Stack:** CSS natif, PWA sans build, suite navigateur (lanceur `node .superpowers/sdd/2026-10-18-refonte-visuelle/suite.cjs 8085`), Playwright dédié (preuve).

**Spec:** `docs/superpowers/specs/2026-10-18-refonte-visuelle-design.md` (rév. 2 ; V-1…V-6, T-1…T-11, § 3.6 paires, § 7 R1-R19).

## Global Constraints
- Branche `refonte-visuelle`, worktree `~/projects/mistu-look`, base = pointe de `creer-ia`. **Reprendre toutes les plages de lignes et l'inventaire `display:none` sur cette pointe avant d'écrire** (le lot 2 a touché `styles.css`).
- **T-1** : aucun test de comportement retouché ; si un rougit, le CSS est faux.
- `sw.js VERSION = 'cuisine-os-v0.7.0-N'`, N = 20 + tâche ; total épinglé relu dans « obtenu » ; scan Python des invisibles (commande du plan du lot 2) ; commits ASCII, fichiers nommés, trailer du modèle réel.
- Liste blanche des couleurs hors `:root` : `#fff`, `#222`. Aucune police externe, aucune URL dans le CSS. Pas de `color-mix()`/`oklch`.
- Décisions de nuit V-1…V-6 : appliquer, consigner comme renversables (T4).

## Review Focus
1. Un contenu caché par le thème (`[hidden]` battu, `display`) → T-9 + inventaire exact (T1). 2. Un contraste qui échoue sur un fond coloré ou en petit texte → § 3.6 toutes paires + badges (T1/T2). 3. Débordement à 375/390 avec la pastille → galerie + preuve (T3). 4. Focus coupé ou battu → T-5 mesuré (T2). 5. Thème pas servi / barre d'état illisible → `VERSION`, `theme-color`, `default` (T1).

---

### Task 1 : Jetons, base, coquille, règles globales ; suite `tests/theme.js` (partie structure)

**Files:** Modify `styles.css` (`:root`, base, layout — plages à reprendre), `index.html` (`theme-color`, status bar `default`), `manifest.webmanifest`, `sw.js` (`-21`) ; Create `tests/theme.js` ; Modify `tests/tests.js` (import + bloc + total)

- [ ] **Step 1 : tests rouges** — `tests/theme.js` (structure ; les mesures de composants arrivent en T2) :

```js
// Thème « magazine culinaire » (spec 2026-10-18-refonte-visuelle). La feuille est LUE et MESURÉE, jamais recopiée.
const JETONS = ['--paper', '--paper-2', '--card', '--ink', '--muted', '--line', '--field-line', '--action', '--action-2', '--action-bg', '--accent', '--accent-2', '--accent-bg', '--warn', '--warn-bg', '--warn-line', '--danger', '--danger-bg', '--danger-line', '--ok', '--ok-bg', '--backdrop', '--tap', '--radius', '--radius-pill', '--shadow', '--serif', '--sans', '--topbar-h', '--cream', '--cream-2', '--green', '--green-2', '--sage', '--sage-2'];
// (texte, fond, où) — spec § 3.6
const PAIRES = [['--ink', '--paper', 'corps'], ['--muted', '--paper', '.muted'], ['--muted', '--paper-2', '.badge / .chip.neutral'], ['--muted', '--card', 'cartes'], ['--muted', '--accent-bg', 'small.muted dans .card.sage'], ['--muted', '--warn-bg', ''], ['--muted', '--danger-bg', ''], ['--muted', '--ok-bg', ''], ['--muted', '--action-bg', ''], ['--action', '--paper', 'liens'], ['--paper', '--action', '.btn.primary'], ['--paper', '--action-2', 'survol'], ['--accent', '--paper', ''], ['--accent', '--accent-bg', '.badge.original'], ['--action', '--action-bg', '.badge.ai'], ['--action', '--accent-bg', ''], ['--warn', '--warn-bg', '.status.warn / .chip.warn / .badge.reference'], ['--warn', '--paper', '.qty .est'], ['--warn', '--card', ''], ['--danger', '--danger-bg', ''], ['--ok', '--ok-bg', ''], ['--ink', '--paper-2', '.segmented actif'], ['--ink', '--card', ''], ['--card', '--ink', '.toast'], ['--paper', '--accent', '.cover bas'], ['--paper', '--accent-2', '.cover haut']];
const HEX3 = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
const lum = (hex) => { const h = HEX3(hex); const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const rgbVersHex = (rgb) => { const m = rgb.match(/\d+/g); return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null; };
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export async function runThemeTests({ eq, ok }) {
  const v = Date.now();
  const css = sansCommentaires(await (await fetch('../styles.css?v=' + v, { cache: 'no-store' })).text());
  ok(css.length > 1000, 'thème : feuille lue');
  const racine = css.match(/(?:^|\n)\s*:root\s*\{([^}]*)\}/);
  ok(!!racine, 'thème : bloc :root trouvé');
  const jetons = Object.fromEntries([...(racine?.[1] || '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  eq(JETONS.filter((j) => !(j in jetons)), [], 'thème : tous les jetons de § 3.1 (alias compris) sont dans :root');
  const hex = (j) => { let x = jetons[j]; for (let i = 0; i < 5 && x && x.startsWith('var('); i++) x = jetons[x.slice(4, -1).trim()]; return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(x || '') ? HEX3(x.toLowerCase()) : null; };
  eq([hex('--paper'), hex('--action'), hex('--ink'), hex('--accent'), hex('--warn'), hex('--muted')], ['#f8f5ef', '#bc3026', '#242821', '#45604a', '#8d6111', '#636860'], 'thème : jetons de la direction 01 (revus R4)');
  eq([hex('--cream'), hex('--green'), hex('--cream-2'), hex('--sage-2')], [hex('--paper'), hex('--accent'), hex('--paper-2'), hex('--accent-bg')], 'T-2 : anciens noms = alias');
  for (const [fg, bg, ou] of PAIRES) { const a = hex(fg), b = hex(bg); const c = a && b ? contraste(a, b) : 0; ok(c >= 4.5, `T-3 : ${fg} sur ${bg} = ${c.toFixed(2)} ≥ 4,5${ou ? ' (' + ou + ')' : ''}`); }
  ok(contraste(hex('--field-line'), '#ffffff') >= 3 && contraste(hex('--field-line'), hex('--paper')) >= 3, 'T-10 : contour des champs ≥ 3:1 sur blanc et sur papier');
  ok(/color-scheme:\s*light/.test(racine?.[1] || ''), 'T-8 : color-scheme light');
  const hors = css.replace(racine[0], '');
  const durs = [...hors.matchAll(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)].map((m) => m[0].toLowerCase()).filter((h) => !['#fff', '#ffffff', '#222'].includes(h));
  eq(durs, [], 'T-2 : aucune couleur en dur hors :root (liste blanche #fff, #222)');
  const caches = [...hors.matchAll(/([^{}]+)\{[^}]*display:\s*none[^}]*\}/g)].map((m) => m[1].trim().replace(/\s+/g, ' ')).filter((s) => s !== '[hidden]');
  const attendus = ['aside.sidenav', 'nav.tabs', '.accueil-livre .sources:empty', '.menu-source summary::-webkit-details-marker', '.cover.with-img .title, .cover.with-img .author'];
  eq(caches.sort(), attendus.sort(), 'T-1 : inventaire EXACT des display:none (les cinq d’origine ; [hidden] à part)');
  eq((hors.match(/visibility:\s*hidden|opacity:\s*0\b|font-size:\s*0\b/g) || []).length, 0, 'T-1 : ni visibility:hidden, ni opacity:0, ni font-size:0');
  ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(hors) && /:focus-visible/.test(hors) && /prefers-reduced-motion:\s*reduce/.test(hors), 'T-9/T-5/T-6 : [hidden] imposé, focus visible, mouvement réduit');
  const html = await (await fetch('../index.html?v=' + v, { cache: 'no-store' })).text();
  const manifest = await (await fetch('../manifest.webmanifest?v=' + v, { cache: 'no-store' })).json();
  eq([new RegExp('name="theme-color" content="' + hex('--paper') + '"').test(html), manifest.theme_color, manifest.background_color, /apple-mobile-web-app-status-bar-style" content="default"/.test(html)], [true, hex('--paper'), hex('--paper'), true], 'T-8 : theme-color, manifeste = papier ; barre d’état default');
  // --- Mesures rendues : la feuille est injectée le temps du bloc, dans une scène hors écran mais VISIBLE.
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../styles.css?v=' + v;
  await new Promise((r) => { link.onload = r; link.onerror = r; document.head.append(link); });
  const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-9999px;top:0;width:390px'; document.body.append(scene);
  try {
    const nav = document.createElement('nav'); nav.className = 'tabs'; nav.style.cssText = 'position:static;display:flex'; // R1 : le @media ≥ 900 px cacherait nav.tabs ; le style en ligne bat la règle
    const a = document.createElement('a'); a.href = '#/'; a.append(Object.assign(document.createElement('span'), { className: 'ico', textContent: '☀\ufe0e' }), Object.assign(document.createElement('span'), { textContent: 'Aujourd’hui' })); nav.append(a); scene.append(nav);
    const h1 = document.createElement('h1'); h1.textContent = 'Titre'; scene.append(h1);
    const p = document.createElement('p'); p.textContent = 'Corps'; scene.append(p);
    ok(a.getBoundingClientRect().height >= 48, 'T-4 : un onglet bas ≥ 48 px (mesuré)');
    ok(/georgia/i.test(getComputedStyle(h1).fontFamily) && !/georgia/i.test(getComputedStyle(p).fontFamily), 'typographie : h1 Georgia, corps sans (calculés ; R2)');
    for (const [cls, tag] of [['pastille', 'span'], ['card', 'div'], ['muted', 'small']]) { const n = document.createElement(tag); n.className = cls; n.hidden = true; n.textContent = 'x'; scene.append(n); eq(getComputedStyle(n).display, 'none', `T-9 : .${cls}[hidden] est caché`); }
    const top = document.createElement('div'); top.className = 'topbar'; const brand = document.createElement('a'); brand.className = 'brand'; brand.textContent = 'Cuisine OS'; top.append(brand); scene.append(top);
    ok(contraste(rgbVersHex(getComputedStyle(brand).color), rgbVersHex(getComputedStyle(top).backgroundColor)) >= 4.5, 'coquille : la marque se lit sur la barre haute (calculé)');
  } finally { scene.remove(); link.remove(); }
}
```
Enregistrer `runThemeTests` (dernier bloc avant le total). **Les mesures `.btn`/`.btn.small`/`.chip`/rayons/focus/champs sont en T2** (R3).

- [ ] **Step 2 : rouge.** **Step 3 : `styles.css` (`:root`, base, layout)** — § 3.1 (alias compris, `color-scheme: light`), base (`body` sans ; `h1/h2/h3` serif encre + `overflow-wrap: anywhere; hyphens: auto` ; `a { color: var(--action) }`), `[hidden] { display: none !important; }`, `:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }`, `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }`, `.topbar` (§ 3.3 + T-7 + roue 44 + règle morte retirée + `-webkit-tap-highlight-color`), `nav.tabs`, `aside.sidenav` (`--topbar-h`), `.card { scroll-margin-top }`. `index.html` (`theme-color`, status bar `default`), manifeste, `sw.js -21`.
- [ ] **Step 4 : vert** (suite entière), total. **Step 5 : commit** `Refonte visuelle 1 : jetons magazine, base serif, coquille, [hidden], focus, mouvement reduit, barre d etat default`

---

### Task 2 : Composants + mesures de composants

**Files:** Modify `styles.css` (composants — plages reprises), `sw.js -22`, `tests/theme.js` (ajouts)

- [ ] **Step 1 : tests rouges** (dans le bloc « mesures rendues », avant le `finally`) :
```js
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Un bouton'; scene.append(b);
    const s = document.createElement('button'); s.className = 'btn small'; s.textContent = 'Petit'; scene.append(s);
    const l = document.createElement('button'); l.className = 'btn link'; l.textContent = 'Lien'; scene.append(l);
    const ch = document.createElement('span'); ch.className = 'chip'; ch.textContent = 'Puce'; scene.append(ch);
    ok(b.getBoundingClientRect().height >= 44 && s.getBoundingClientRect().height >= 36 && l.getBoundingClientRect().height >= 44, 'T-4 : .btn ≥ 44, .btn.small ≥ 36, .btn.link ≥ 44 (mesurés)');
    eq([getComputedStyle(b).borderRadius, getComputedStyle(ch).borderRadius], ['999px', '999px'], 'composants : boutons et puces en pilule');
    const seg = document.createElement('div'); seg.className = 'segmented'; const sb = document.createElement('button'); sb.className = 'active'; sb.textContent = 'Web'; seg.append(sb); scene.append(seg);
    ok(contraste(rgbVersHex(getComputedStyle(sb).color), rgbVersHex(getComputedStyle(sb).backgroundColor)) >= 4.5, 'segments : l’option active se lit (calculé)');
    const badge = document.createElement('span'); badge.className = 'badge ai'; badge.textContent = 'IA'; scene.append(badge);
    eq(rgbVersHex(getComputedStyle(badge).color), hex('--action'), 'badges : .badge.ai en tomate');
    const inp = document.createElement('input'); inp.type = 'text'; scene.append(inp); inp.focus();
    ok(document.activeElement === inp && rgbVersHex(getComputedStyle(inp).outlineColor) === hex('--action') && parseFloat(getComputedStyle(inp).fontSize) >= 16, 'T-5/T-8 : champ focalisé = anneau tomate, 16 px minimum (iOS ne zoome pas)');
    inp.blur();
    ok(contraste(rgbVersHex(getComputedStyle(inp).borderColor), '#ffffff') >= 3, 'T-10 : contour du champ ≥ 3:1 (calculé)');
```
- [ ] **Step 2 : rouge.** **Step 3 : code** § 3.4 règle par règle (ordre conservé) : `.btn` 44 pilule, `.small` 36, `.link` 44, `.big`, `.primary`, `.sage`, `.danger` (`--danger-line`), `.btn.active:focus-visible` ; `.chip*` ; `.puce` ; `.card.warn/.danger` (`--warn-line`/`--danger-line`) ; `.badge*` ; champs (`--field-line`, `font-size: 1rem`, `:focus-visible` tomate ; retirer l'ancien `input:focus` sauge) ; `.search-bar input` 52 ; `.segmented` (+ `button:focus-visible { outline-offset: -3px }`) ; `.status.*` ; `.cover` dégradé inversé ; `.qty` ; `.step-num` ; `.progress > div` ; `.toast` ; `dialog`, `dialog::backdrop { background: var(--backdrop) }` ; `.kbd` ; `.cook` ; `.mirror` sans tomate.
- [ ] **Step 4 : vert**, total, `-22`. **Step 5 : commit** `Refonte visuelle 2 : composants pilule, badges, champs 16 px, segments, couverture, focus mesure`

---

### Task 3 : Galerie, preuve visuelle du contrôleur, retouches

**Files:** Create `.superpowers/sdd/2026-10-18-refonte-visuelle/galerie.html` (non commitée : toutes les variantes de § 3.4, la barre haute complète avec `#pastille` visible « 12 non envoyés », `nav.tabs`, un `.cover` avec et sans image, un `.status.warn`, un `.card.warn`, le formulaire, le mode cuisine, le toast, un dialogue ouvert), `…/preuve-visuelle.cjs` (Playwright dédié : contextes 375/390/768/1512 avec `reducedMotion: 'reduce'`, `route(/supabase\.co|anthropic|openlibrary|googleapis/, r => r.abort())` ; pour l'app : porte capturée puis « Continuer sans compte » ; routes de V-6 ; pour la galerie : contraste calculé de chaque nœud texte sur son fond effectif (remonter jusqu'au premier fond non transparent) ≥ 4,5 (badges compris), `scrollWidth <= innerWidth`, cibles ≥ 44 px sur `.btn:not(.small)`, `nav.tabs a`, `.topbar a`, re-mesure M3 (bouton K1 / « Annuler ») sur `#/search?mode=web` avec une instance montée comme au lot confort ; captures `page.screenshot({ animations: 'disabled', caret: 'hide', timeout: 30000, fullPage: false })`, repli CDP `Page.captureScreenshot`, fichiers `captures/<largeur>-<nom>.png`), `styles.css` retouches issues des mesures, `sw.js -23` si CSS touché.

- [ ] **Step 1 : galerie et script.** **Step 2 : lancer** contre `http://localhost:8085` ; **tout rouge (débordement, cible, contraste rendu) = correction CSS**, jamais le script. Tableau de sortie consigné au registre. **Step 3 : suite verte**, total. **Step 4 : commit** `Refonte visuelle 3 : galerie, preuve sur quatre largeurs, retouches mesurees`

---

### Task 4 : Clôture
`CLAUDE.md` (section du lot : décisions V-1…V-6 à confirmer, mesures (paires calculées, géométrie, captures), dettes § 5, barre d'état à vérifier sur l'iPhone), `STATE.md`, `docs/architecture.md`, spec § 7 (rulings R-VIS-…) ; suite + tools + --check + scan ; commit `Refonte visuelle 4 : cloture — decisions de nuit, mesures, dettes`.

---

## Self-review
V-1…V-6 et T-1…T-11 couverts : T1 (jetons, base, coquille, T-1/2/3/6/7/8/9/10/11 structure), T2 (composants, T-4/T-5 mesurés), T3 (V-6, galerie, M3), T4 (docs). Noms : `runThemeTests`, `PAIRES`, `rgbVersHex`, `galerie.html`, `preuve-visuelle.cjs`. R1-R19 : chaque correctif a sa ligne (R1/R2 T1 step 1 ; R3 T2 ; R4 § 3.1/3.6 ; R5 T-9 ; R6 T-8 ; R7/R8/R19 T3 ; R9/R10 T2 ; R11/R12 T1 ; R13 T1/T2 ; R14 T2 ; R15 T1 ; R16 T1 ; R17 T1/T2 ; R18 contraintes).

## Rulings du contrôleur au pré-vol — FONT FOI (voir spec § 8)
- R-VIS-1 (T1) : retirer `.status[hidden] { display: none; }` (ajoutée par le lot 2) ; `attendus` = les cinq d'origine ; ajouter `['status', 'span']` aux cas T-9 mesurés.
- R-VIS-2 (T1) : `--accent-2: #55705a` ; le test des jetons peut épingler `hex('--accent-2') === '#55705a'`.
- T-11 : `aside.sidenav` `top`/`height` → `var(--topbar-h)` ; `.btn.big` garde `56px`.
- Toutes les plages de lignes se reprennent sur la pointe réelle de `creer-ia` (R18) ; `styles.css` fait 260 lignes à `618b454`.
