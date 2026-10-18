// Thème « magazine culinaire » (spec 2026-10-18-refonte-visuelle). La feuille est LUE et MESURÉE, jamais recopiée.
const JETONS = ['--paper', '--paper-2', '--card', '--ink', '--muted', '--line', '--field-line', '--action', '--action-2', '--action-bg', '--accent', '--accent-2', '--accent-bg', '--warn', '--warn-bg', '--warn-line', '--danger', '--danger-bg', '--danger-line', '--ok', '--ok-bg', '--backdrop', '--tap', '--radius', '--radius-pill', '--shadow', '--serif', '--sans', '--topbar-h', '--cream', '--cream-2', '--green', '--green-2', '--sage', '--sage-2'];
// (texte, fond, où) — spec § 3.6
const PAIRES = [['--ink', '--paper', 'corps'], ['--muted', '--paper', '.muted'], ['--muted', '--paper-2', '.badge / .chip.neutral'], ['--muted', '--card', 'cartes'], ['--muted', '--accent-bg', 'small.muted dans .card.sage'], ['--muted', '--warn-bg', ''], ['--muted', '--danger-bg', ''], ['--muted', '--ok-bg', ''], ['--muted', '--action-bg', ''], ['--action', '--paper', 'liens'], ['--paper', '--action', '.btn.primary'], ['--paper', '--action-2', 'survol'], ['--accent', '--paper', ''], ['--accent', '--accent-bg', '.badge.original'], ['--action', '--action-bg', '.badge.ai'], ['--action', '--accent-bg', ''], ['--warn', '--warn-bg', '.status.warn / .chip.warn / .badge.reference'], ['--warn', '--paper', '.qty .est'], ['--warn', '--card', ''], ['--warn', '--accent-bg', '.cook .ingredients li.hit .est (R-VIS-13)'], ['--danger', '--danger-bg', ''], ['--ok', '--ok-bg', ''], ['--ink', '--paper-2', '.segmented actif'], ['--ink', '--card', ''], ['--card', '--ink', '.toast'], ['--paper', '--accent', '.cover bas'], ['--paper', '--accent-2', '.cover haut'], ['--action', '--card', 'onglet actif / panneau actif']];
// T-2 : liste FERMÉE des 148 couleurs nommées de CSS Color 4 (transparent, currentColor et inherit n'en sont pas : permis).
const COULEURS_NOMMEES = new Set('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' '));
const HEX3 = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
const lum = (hex) => { const h = HEX3(hex); const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const rgbVersHex = (rgb) => { const m = rgb.match(/\d+/g); return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null; };
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// R-VIS-14 : les règles de la feuille dans l'ordre des sources, avec leur @media (la feuille n'a qu'un niveau d'imbrication).
const regles = (css) => { const out = []; const pile = []; let sel = null; let debut = 0; for (let i = 0; i < css.length; i++) { if (css[i] === '{') { const tete = css.slice(debut, i).trim(); if (tete.startsWith('@')) pile.push(tete); else sel = tete.replace(/\s+/g, ' '); debut = i + 1; } else if (css[i] === '}') { if (sel !== null) { out.push({ sel, corps: css.slice(debut, i), media: pile.length ? pile[pile.length - 1] : null }); sel = null; } else pile.pop(); debut = i + 1; } } return out; };
const declarations = (corps) => Object.fromEntries(corps.split(';').filter((d) => d.includes(':')).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
// Valeurs d'une propriété raccourcie, découpées aux espaces hors parenthèses (calc(var(--nav-h) + …) reste entier).
const termes = (v) => (v || '').match(/[^\s()]*\((?:[^()]|\([^()]*\))*\)|[^\s()]+/g) || [];

export async function runThemeTests({ eq, ok }) {
  const v = Date.now();
  const css = sansCommentaires(await (await fetch('../styles.css?v=' + v, { cache: 'no-store' })).text());
  ok(css.length > 1000, 'thème : feuille lue');
  const racine = css.match(/(?:^|\n)\s*:root\s*\{([^}]*)\}/);
  ok(!!racine, 'thème : bloc :root trouvé');
  const jetons = Object.fromEntries([...(racine?.[1] || '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  eq(JETONS.filter((j) => !(j in jetons)), [], 'thème : tous les jetons de § 3.1 (alias compris) sont dans :root');
  const hex = (j) => { let x = jetons[j]; for (let i = 0; i < 5 && x && x.startsWith('var('); i++) x = jetons[x.slice(4, -1).trim()]; return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(x || '') ? HEX3(x.toLowerCase()) : null; };
  eq([hex('--paper'), hex('--action'), hex('--ink'), hex('--accent'), hex('--warn'), hex('--muted')], ['#f8f5ef', '#bc3026', '#242821', '#45604a', '#8b5f10', '#636860'], 'thème : jetons de la direction 01 (revus R4 ; --warn R-VIS-13 : ambre sur accent-bg 4,49 → 4,62)');
  eq(hex('--accent-2'), '#55705a', 'R-VIS-2 : --accent-2 = #55705a (papier sur accent-2 = 5,01 ; #5f7a64 donnait 4,33)');
  eq([hex('--cream'), hex('--green'), hex('--cream-2'), hex('--sage-2')], [hex('--paper'), hex('--accent'), hex('--paper-2'), hex('--accent-bg')], 'T-2 : anciens noms = alias');
  for (const [fg, bg, ou] of PAIRES) { const a = hex(fg), b = hex(bg); const c = a && b ? contraste(a, b) : 0; ok(c >= 4.5, `T-3 : ${fg} sur ${bg} = ${c.toFixed(2)} ≥ 4,5${ou ? ' (' + ou + ')' : ''}`); }
  ok(contraste(hex('--field-line'), '#ffffff') >= 3 && contraste(hex('--field-line'), hex('--paper')) >= 3, 'T-10 : contour des champs ≥ 3:1 sur blanc et sur papier');
  ok(/color-scheme:\s*light/.test(racine?.[1] || ''), 'T-8 : color-scheme light');
  const hors = css.replace(racine[0], '');
  const durs = [...hors.matchAll(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)].map((m) => m[0].toLowerCase()).filter((h) => !['#fff', '#ffffff', '#222'].includes(h));
  eq(durs, [], 'T-2 : aucune couleur en dur hors :root (liste blanche #fff, #222)');
  // Valeurs des déclarations seulement (jamais les sélecteurs), noms de jetons var(--…) et chaînes retirés : « --green » n'est pas « green ».
  const valeurs = [...hors.matchAll(/\{([^{}]*)\}/g)].flatMap((m) => m[1].split(';')).filter((d) => d.includes(':')).map((d) => d.slice(d.indexOf(':') + 1).replace(/var\(--[\w-]+\)/g, '').replace(/"[^"]*"|'[^']*'/g, '').toLowerCase());
  eq(valeurs.flatMap((x) => x.match(/[a-z]+/g) || []).filter((w) => COULEURS_NOMMEES.has(w)), [], 'T-2 : aucune couleur nommée hors :root (white, red… ; transparent, currentColor, inherit permis)');
  // Le bloc de déclarations exclut « { » : sinon la règle qui ouvre un @media est nommée « @media (…) » au lieu de son sélecteur (nav.tabs).
  const caches = [...hors.matchAll(/([^{}]+)\{[^{}]*display:\s*none[^{}]*\}/g)].map((m) => m[1].trim().replace(/\s+/g, ' ')).filter((s) => s !== '[hidden]');
  const attendus = ['aside.sidenav', 'nav.tabs', '.accueil-livre .sources:empty', '.menu-source summary::-webkit-details-marker', '.cover.with-img .title, .cover.with-img .author'];
  eq(caches.sort(), attendus.sort(), 'T-1 : inventaire EXACT des display:none (les cinq d’origine ; [hidden] à part)');
  // « 0(?![.\d]) » : 0, 0px et 0% sont attrapés, 0.5 et 0.9rem non (« \b » passait entre 0 et le point).
  eq((hors.match(/visibility:\s*hidden|opacity:\s*0(?![.\d])|font-size:\s*0(?![.\d])/g) || []).length, 0, 'T-1 : ni visibility:hidden, ni opacity:0, ni font-size:0');
  // Le CONTENU des blocs, pas leur seule présence : l'anneau global (2 px tomate décalé 2 px) et le bloc du mouvement réduit.
  const anneau = hors.match(/(?:^|\n)\s*:focus-visible\s*\{([^}]*)\}/)?.[1] || '';
  const reduit = hors.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^{}]*\{([^}]*)\}\s*\}/)?.[1] || '';
  ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(hors) && /outline:\s*2px\s+solid\s+var\(--action\)/.test(anneau) && /outline-offset:\s*2px/.test(anneau) && /transition:\s*none\s*!important/.test(reduit) && /animation:\s*none\s*!important/.test(reduit), 'T-9/T-5/T-6 : [hidden] imposé ; :focus-visible = 2px tomate décalé 2px ; mouvement réduit = transition et animation none !important (contenu des blocs)');
  const R = regles(hors); const base = (s) => R.filter((r) => r.sel === s && !r.media).map((r) => declarations(r.corps));
  const iRow = R.findIndex((r) => r.sel === '.row' && !r.media); const iStatus = R.findIndex((r) => r.sel === '.status' && !r.media);
  ok(iRow >= 0 && iStatus > iRow, `R-VIS-14 (T-1) : la règle .status vient APRÈS la règle .row dans la feuille servie (positions ${iRow} et ${iStatus})`);
  const calePile = /^calc\(\s*var\(--nav-h\)\s*\+\s*var\(--safe-b\)\s*\+/;
  const toastBas = base('.toast').map((d) => d.bottom).filter(Boolean).pop();
  const mainBas = base('main.content').map((d) => d['padding-bottom'] || (termes(d.padding).length >= 3 ? termes(d.padding)[2] : termes(d.padding)[0])).filter(Boolean).pop();
  ok(calePile.test(toastBas || ''), `R-VIS-14 (T-1) : .toast (règle de base) calé sur calc(var(--nav-h) + var(--safe-b) + …) : « ${toastBas} »`);
  ok(calePile.test(mainBas || ''), `R-VIS-14 (T-1) : main.content (règle de base) a son bas calé sur calc(var(--nav-h) + var(--safe-b) + …) : « ${mainBas} »`);
  eq([...hors.matchAll(/([^{}]+)\{[^{}]*\b56px[^{}]*\}/g)].map((m) => m[1].trim()), ['.btn.big'], 'T-11 : seul .btn.big garde 56px en dur (le panneau latéral suit --topbar-h)');
  // Survol réservé aux appareils à pointeur (sur iOS il reste collé après une tape) : les deux :hover des boutons vivent sous @media (hover: hover), aucun au niveau racine.
  const survols = [...hors.matchAll(/@media\s*\(hover:\s*hover\)\s*\{\s*([^{}]+)\{/g)].map((m) => m[1].trim());
  ok(survols.includes('.btn:hover') && survols.includes('.btn.primary:hover') && !/(?:^|\})\s*\.btn(?:\.primary)?:hover\s*\{/.test(hors), 'survol : .btn:hover et .btn.primary:hover seulement sous @media (hover: hover)');
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
    const h2 = document.createElement('h2'); h2.textContent = 'Sous-titre'; scene.append(h2);
    const miroir = document.createElement('div'); miroir.className = 'mirror'; miroir.textContent = 'Indicatif : 11 min 32 s'; scene.append(miroir);
    ok(/georgia/i.test(getComputedStyle(h2).fontFamily) && !/georgia/i.test(getComputedStyle(miroir).fontFamily), 'typographie : h2 Georgia ; .mirror sans, chiffres tabulaires (R14 : Georgia ignore tabular-nums) (calculés)');
    for (const [cls, tag] of [['pastille', 'span'], ['card', 'div'], ['muted', 'small'], ['status', 'span']]) { const n = document.createElement(tag); n.className = cls; n.hidden = true; n.textContent = 'x'; scene.append(n); eq(getComputedStyle(n).display, 'none', `T-9 : .${cls}[hidden] est caché`); }
    const carte = document.createElement('div'); carte.className = 'card'; carte.textContent = 'Carte'; scene.append(carte);
    eq(getComputedStyle(carte).scrollMarginTop, '72px', 'T-11 : .card scroll-margin-top = --topbar-h + .5rem (calculé : 64 + 8)');
    const top = document.createElement('div'); top.className = 'topbar'; const brand = document.createElement('a'); brand.className = 'brand'; brand.textContent = 'Cuisine OS'; top.append(brand); scene.append(top);
    ok(contraste(rgbVersHex(getComputedStyle(brand).color), rgbVersHex(getComputedStyle(top).backgroundColor)) >= 4.5, 'coquille : la marque se lit sur la barre haute (calculé)');
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
    ok(rgbVersHex(getComputedStyle(inp).borderTopColor) === hex('--action') && getComputedStyle(inp).outlineOffset === '2px' && getComputedStyle(inp).outlineStyle === 'solid', 'T-5 : input:focus-visible = contour du champ tomate en plus de l’anneau 2 px décalé 2 px (l’anneau global seul laisse le contour gris) (calculé)');
    inp.blur();
    ok(contraste(rgbVersHex(getComputedStyle(inp).borderColor), '#ffffff') >= 3, 'T-10 : contour du champ ≥ 3:1 (calculé)');
    // T-3 / R-VIS-2 : titre et auteur d'une couverture sans image se lisent EN BAS (flex-end), donc l'arrêt du bas est le plus sombre (accent, 6,38) : dégradé INVERSÉ.
    const cov = document.createElement('div'); cov.className = 'cover'; cov.textContent = 'Titre'; scene.append(cov);
    const arrets = (getComputedStyle(cov).backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(rgbVersHex);
    eq([arrets.length, arrets[0], arrets[arrets.length - 1], rgbVersHex(getComputedStyle(cov).color)], [2, hex('--accent-2'), hex('--accent'), hex('--paper')], 'T-3 : .cover = dégradé accent-2 (haut) → accent (bas), texte papier (calculés)');
    // Les deux autres champs tapés de l'app (adresse du signet, clé API des Réglages) : hors sélecteur, le navigateur les rendait à 13,33 px (iOS zoome).
    const autres = ['url', 'password'].map((t) => { const i = document.createElement('input'); i.type = t; scene.append(i); return i; });
    ok(autres.every((i) => parseFloat(getComputedStyle(i).fontSize) >= 16 && contraste(rgbVersHex(getComputedStyle(i).borderTopColor), '#ffffff') >= 3), 'T-8/T-10 : champs adresse et clé aussi à 16 px, contour ≥ 3:1 (calculés)');
    // T-5 au clavier : .btn.active et un segment focalisés montrent l'anneau tomate (Chromium sans interaction au pointeur : focus() donne :focus-visible).
    const actif = document.createElement('button'); actif.className = 'btn active'; actif.textContent = 'Actif'; scene.append(actif); actif.focus();
    ok(actif.matches(':focus-visible') && rgbVersHex(getComputedStyle(actif).outlineColor) === hex('--action'), 'T-5 : .btn.active focalisé = anneau tomate, pas le contour vert d’état (calculé)');
    sb.focus();
    ok(sb.matches(':focus-visible') && rgbVersHex(getComputedStyle(sb).outlineColor) === hex('--action') && getComputedStyle(sb).outlineOffset === '-3px', 'T-5 : segment focalisé = anneau tomate rentré de 3 px (calculé)');
    sb.blur();
    a.focus();
    ok(a.matches(':focus-visible') && rgbVersHex(getComputedStyle(a).outlineColor) === hex('--action') && getComputedStyle(a).outlineOffset === '-3px', 'T-5 : onglet bas focalisé = anneau tomate rentré de 3 px (collé au bas de l’écran, un décalage de +2 px sortait de l’écran) (calculé)');
    a.blur();
    // Chaque règle de composant reliée à SA paire : couleur RENDUE sur le fond RENDU (premier fond opaque en remontant) ≥ 4,5 ; hauteurs T-4 dans la même boucle.
    const teinte = (c) => (/^rgba\(.*,\s*0\)$/.test(c) ? 'transparent' : rgbVersHex(c));
    const fondRendu = (n) => { for (let x = n; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || Number(m[3]) === 1)) return rgbVersHex(c); } return '#ffffff'; };
    const support = document.createElement('div'); support.className = 'card'; scene.append(support);
    const composants = [['button', 'btn primary'], ['button', 'btn sage'], ['button', 'btn danger'], ['button', 'btn link'], ['span', 'chip'], ['span', 'chip warn'], ['span', 'chip danger'], ['span', 'chip ok'], ['span', 'chip neutral'], ['span', 'chip removable'], ['span', 'chip outline'], ['span', 'chip clickable'], ['button', 'puce', ['aria-pressed', 'true']], ['span', 'badge'], ...['available', 'reference', 'partial', 'ai', 'original', 'personal'].map((v) => ['span', `badge ${v}`]), ['div', 'status'], ...['info', 'warn', 'danger', 'ok'].map((v) => ['div', `status ${v}`]), ['span', 'step-num'], ['div', 'toast', null, 'position:static;transform:none'], ['span', 'pastille']];
    const fautes = [];
    for (const [tag, cls, attr, style] of composants) {
      const n = document.createElement(tag); n.className = cls; n.textContent = 'Texte 12'; if (attr) n.setAttribute(attr[0], attr[1]); if (style) n.style.cssText = style; support.append(n);
      const c = contraste(rgbVersHex(getComputedStyle(n).color), fondRendu(n));
      if (!(c >= 4.5)) fautes.push(`.${cls.replace(/ /g, '.')} ${c.toFixed(2)}`);
      if (cls === 'chip removable' && n.getBoundingClientRect().height < 32) fautes.push(`.chip.removable ${n.getBoundingClientRect().height} px < 32`);
    }
    const barre = document.createElement('div'); barre.className = 'search-bar'; const champ = document.createElement('input'); champ.type = 'search'; barre.append(champ); support.append(barre);
    if (Math.round(champ.getBoundingClientRect().height) !== 52) fautes.push(`.search-bar input ${champ.getBoundingClientRect().height} px ≠ 52`);
    eq(fautes, [], 'composants : chaque règle reliée à sa paire (couleur rendue sur fond rendu ≥ 4,5) ; .chip.removable ≥ 32, .search-bar input = 52 (mesurés)');
    // R-VIS-3 : la marque et la pilule de recherche sont des cibles principales, comme la roue (44 px) ; la barre garde 64 px.
    const pilule = document.createElement('a'); pilule.className = 'btn small'; pilule.href = '#/search'; pilule.append('⌕ ', Object.assign(document.createElement('span'), { className: 'nowrap', textContent: 'Qu’est-ce qu’on cuisine ?' }));
    const roue = document.createElement('a'); roue.className = 'btn small'; roue.href = '#/settings'; roue.textContent = '⚙';
    top.append(Object.assign(document.createElement('span'), { className: 'spacer' }), pilule, roue);
    const [rb, rp, rr] = [brand, pilule, roue].map((x) => x.getBoundingClientRect());
    ok(rb.height >= 44 && rp.height >= 44 && rp.width >= 44 && rr.height >= 44 && rr.width >= 44 && Math.round(top.getBoundingClientRect().height) === 64, 'R-VIS-3 : marque, pilule de recherche et roue ≥ 44 px ; barre haute = 64 px (mesurés)');
    // R-VIS-5 : l'auteur d'une couverture se lit sur les DEUX arrêts du dégradé, opacité comprise (un titre sur deux lignes le remonte vers accent-2).
    const auteur = Object.assign(document.createElement('div'), { className: 'author', textContent: 'Josée Di Stasio · 2004' }); cov.append(auteur);
    const op = parseFloat(getComputedStyle(auteur).opacity); const ca = rgbVersHex(getComputedStyle(auteur).color).match(/[0-9a-f]{2}/g).map((h) => parseInt(h, 16));
    const melange = (f) => '#' + f.match(/[0-9a-f]{2}/g).map((h, i) => Math.round(op * ca[i] + (1 - op) * parseInt(h, 16)).toString(16).padStart(2, '0')).join('');
    ok(arrets.length === 2 && arrets.every((a) => contraste(melange(a), a) >= 4.5), 'R-VIS-5 : auteur de couverture ≥ 4,5 sur accent-2 ET sur accent, opacité comprise (calculé)');
    // R-VIS-6 : les segments d'extrémité épousent la pilule (l'anneau de focus suit le rayon : plus de coins coupés, M14).
    const seg3 = document.createElement('div'); seg3.className = 'segmented'; const bs = ['A', 'B', 'C'].map((x) => Object.assign(document.createElement('button'), { textContent: x })); seg3.append(...bs); scene.append(seg3);
    const rd = (n, coin) => getComputedStyle(n)[coin];
    eq([rd(bs[0], 'borderTopLeftRadius'), rd(bs[0], 'borderBottomLeftRadius'), rd(bs[0], 'borderTopRightRadius'), rd(bs[1], 'borderTopLeftRadius'), rd(bs[1], 'borderTopRightRadius'), rd(bs[2], 'borderTopRightRadius'), rd(bs[2], 'borderBottomRightRadius'), rd(bs[2], 'borderBottomLeftRadius')], ['999px', '999px', '0px', '0px', '0px', '999px', '999px', '0px'], 'R-VIS-6 : segments d’extrémité arrondis comme la pilule, segment du milieu droit (calculés)');
    // R-VIS-7 : une couverture AVEC image a ses coins arrondis — l'image a .cover pour bloc conteneur (même boîte que .cover-wrap, donc même place).
    const enveloppe = document.createElement('a'); enveloppe.className = 'cover-wrap'; enveloppe.href = '#/'; const cov2 = document.createElement('div'); cov2.className = 'cover with-img';
    const image = document.createElement('div'); image.className = 'cover-img'; cov2.append(image); enveloppe.append(cov2); scene.append(enveloppe);
    const [ri, rc] = [image.getBoundingClientRect(), cov2.getBoundingClientRect()];
    ok(image.offsetParent === cov2 && rc.height > 0 && ['left', 'top', 'width', 'height'].every((k) => Math.abs(ri[k] - rc[k]) < 0.5), 'R-VIS-7 : couverture avec image rognée par .cover (coins arrondis), image à la même place (mesurés)');
    // R-VIS-8 (M3) : pendant un vol (annonce role=status puis rangée), « Annuler » se range à droite, jamais sous le doigt qui vient de lancer l'appel.
    const vol = document.createElement('div'); vol.className = 'card flat stack';
    const annonce = document.createElement('div'); annonce.className = 'status'; annonce.setAttribute('role', 'status'); annonce.textContent = 'L’assistant cherche sur le web…';
    const rangee = document.createElement('div'); rangee.className = 'row';
    const prim = Object.assign(document.createElement('button'), { className: 'btn primary', disabled: true, textContent: 'Chercher sur le web avec l’assistant' });
    const annuler = Object.assign(document.createElement('button'), { className: 'btn', textContent: 'Annuler' });
    rangee.append(prim, annuler); vol.append(annonce, rangee); scene.append(vol);
    const [ra, rg, rpr] = [annuler, rangee, prim].map((x) => x.getBoundingClientRect());
    ok(Math.abs(ra.right - rg.right) < 1 && ra.left > rpr.left + 44, 'R-VIS-8 : « Annuler » du vol rangé à droite de sa rangée (mesuré)');
    // R-VIS-14 (T-1) : les règles qui portent le comportement, mesurées sur le rendu (la suite de comportement ne charge pas la feuille).
    const k1 = document.createElement('div'); k1.className = 'status row between'; k1.setAttribute('role', 'status'); k1.textContent = 'La demande a changé depuis cette recherche.'; scene.append(k1);
    eq([getComputedStyle(rangee).flexWrap, getComputedStyle(k1).display], ['wrap', 'inline-flex'], 'R-VIS-14 (T-1) : .row { flex-wrap: wrap } ; la mention K1 div.status.row.between reste inline-flex (.status après .row) (calculés)');
    const menu = document.createElement('details'); menu.className = 'menu-source'; const resume = document.createElement('summary'); resume.textContent = '+ Recette'; menu.append(resume); scene.append(menu);
    eq([getComputedStyle(resume).display, getComputedStyle(resume).listStyleType], ['inline-flex', 'none'], 'R-VIS-14 (T-1) : .menu-source summary { display: inline-flex; list-style: none } (calculés)');
    eq(getComputedStyle(enveloppe).position, 'relative', 'R-VIS-14 (T-1) : .cover-wrap { position: relative } (calculé)');
    // R-VIS-10 : une puce bascule ALLUMÉE (case cochée, capacités d'un appareil) garde une teinte d'état ; éteinte = .outline ;
    // une puce cliquable sans case (exemples de l'accueil sur la carte sauge, contraintes d'un repas) reste une puce ordinaire.
    const bascule = (tag, cls, coche) => { const n = Object.assign(document.createElement(tag), { className: cls }); if (coche !== null) n.append(Object.assign(document.createElement('input'), { type: 'checkbox', checked: coche, style: 'display:none' })); n.append('Four'); scene.append(n); return n; };
    const bascules = [bascule('label', 'chip clickable', true), bascule('label', 'chip clickable outline', false), bascule('span', 'chip clickable', null), bascule('span', 'chip clickable warn', null)];
    eq(bascules.map((n) => [teinte(getComputedStyle(n).backgroundColor), rgbVersHex(getComputedStyle(n).color)]), [[hex('--accent-bg'), hex('--accent')], ['transparent', hex('--muted')], [hex('--paper-2'), hex('--ink')], [hex('--warn-bg'), hex('--warn')]], 'R-VIS-10 : bascule cochée = accent, éteinte = transparente grise ; puce cliquable sans case = ordinaire, contrainte = ambre (calculés)');
    // R-VIS-11 : dans un champ (colonne flex), la pilule de segments prend la largeur de ses options, sans queue vide.
    const champSeg = document.createElement('div'); champSeg.className = 'field'; const segC = document.createElement('div'); segC.className = 'segmented';
    segC.append(...['Original', 'FR'].map((x) => Object.assign(document.createElement('button'), { textContent: x }))); champSeg.append(Object.assign(document.createElement('span'), { textContent: 'Langue' }), segC); scene.append(champSeg);
    ok(segC.getBoundingClientRect().width < champSeg.getBoundingClientRect().width - 100, 'R-VIS-11 : segments d’un champ à la largeur de leurs options (mesuré)');
  } finally { scene.remove(); link.remove(); }
}
