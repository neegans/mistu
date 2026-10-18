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
  eq(hex('--accent-2'), '#55705a', 'R-VIS-2 : --accent-2 = #55705a (papier sur accent-2 = 5,01 ; #5f7a64 donnait 4,33)');
  eq([hex('--cream'), hex('--green'), hex('--cream-2'), hex('--sage-2')], [hex('--paper'), hex('--accent'), hex('--paper-2'), hex('--accent-bg')], 'T-2 : anciens noms = alias');
  for (const [fg, bg, ou] of PAIRES) { const a = hex(fg), b = hex(bg); const c = a && b ? contraste(a, b) : 0; ok(c >= 4.5, `T-3 : ${fg} sur ${bg} = ${c.toFixed(2)} ≥ 4,5${ou ? ' (' + ou + ')' : ''}`); }
  ok(contraste(hex('--field-line'), '#ffffff') >= 3 && contraste(hex('--field-line'), hex('--paper')) >= 3, 'T-10 : contour des champs ≥ 3:1 sur blanc et sur papier');
  ok(/color-scheme:\s*light/.test(racine?.[1] || ''), 'T-8 : color-scheme light');
  const hors = css.replace(racine[0], '');
  const durs = [...hors.matchAll(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)].map((m) => m[0].toLowerCase()).filter((h) => !['#fff', '#ffffff', '#222'].includes(h));
  eq(durs, [], 'T-2 : aucune couleur en dur hors :root (liste blanche #fff, #222)');
  // Le bloc de déclarations exclut « { » : sinon la règle qui ouvre un @media est nommée « @media (…) » au lieu de son sélecteur (nav.tabs).
  const caches = [...hors.matchAll(/([^{}]+)\{[^{}]*display:\s*none[^{}]*\}/g)].map((m) => m[1].trim().replace(/\s+/g, ' ')).filter((s) => s !== '[hidden]');
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
    // La racine aussi : ici body tient sa police de tests.css, qui masquerait un :root { font-family } en serif (le corps de l'app en hérite).
    ok(/georgia/i.test(getComputedStyle(h1).fontFamily) && !/georgia/i.test(getComputedStyle(p).fontFamily) && !/georgia/i.test(getComputedStyle(document.documentElement).fontFamily), 'typographie : h1 Georgia, corps et racine sans (calculés ; R2)');
    for (const [cls, tag] of [['pastille', 'span'], ['card', 'div'], ['muted', 'small'], ['status', 'span']]) { const n = document.createElement(tag); n.className = cls; n.hidden = true; n.textContent = 'x'; scene.append(n); eq(getComputedStyle(n).display, 'none', `T-9 : .${cls}[hidden] est caché`); }
    const top = document.createElement('div'); top.className = 'topbar'; const brand = document.createElement('a'); brand.className = 'brand'; brand.textContent = 'Cuisine OS'; top.append(brand); scene.append(top);
    ok(contraste(rgbVersHex(getComputedStyle(brand).color), rgbVersHex(getComputedStyle(top).backgroundColor)) >= 4.5, 'coquille : la marque se lit sur la barre haute (calculé)');
  } finally { scene.remove(); link.remove(); }
}
