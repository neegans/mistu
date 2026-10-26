// Tests du lot UI-1 « Carnet » (spec docs/superpowers/specs/2026-10-23-experience-carnet-design.md, § 7 « Tests neufs »). Tâche 1 : jetons olive
// et la paire neuve, typographie (une formule clamp() par titre), sectionPlain, pageHeader({ classeTitre, back }), icones.js (vingt-trois noms,
// aria-hidden, currentColor, levée sur un nom inconnu), emptyState à nom d'icône, et les filets de source du lot (onze états vides, NAV, retours,
// en.js, SHELL). La feuille est LUE (texte, sans commentaires) et MESURÉE (scène hors écran, feuille injectée le temps du bloc), jamais recopiée.
// Aucune base, aucun réseau, aucun écran monté : des composants seuls. Les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS du repère de fin.
import { MODULES_NEUFS } from './ajouter.js';

export async function runCarnetTests({ eq, ok }) {
  const bloc = async (nom, f) => { try { await f(); } catch (error) { ok(false, `Carnet — bloc « ${nom} » interrompu : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); } };
  const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
  const C = await import('../src/ui/components.js');
  let I = null; // le module d'icônes : absent tant que la tâche 1 ne l'a pas posé — les blocs qui en dépendent rougissent alors par leur nom
  try { I = await import('../src/ui/icones.js'); } catch { I = null; }
  const v = Date.now();
  const css = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  // Aides recopiées de tests/theme.js (non exportées là-bas ; les deux suites ne partagent aucun module).
  const HEX3 = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h);
  const lum = (hex) => { const h = HEX3(hex); const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const rgbVersHex = (rgb) => { const m = (rgb || '').match(/\d+/g); return m ? '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null; };
  const racine = css.match(/(?:^|\n)\s*:root\s*\{([^}]*)\}/)?.[1] || '';
  const jetons = Object.fromEntries([...racine.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const hex = (j) => { let x = jetons[j]; for (let i = 0; i < 5 && x && x.startsWith('var('); i++) x = jetons[x.slice(4, -1).trim()]; return /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(x || '') ? HEX3(x.toLowerCase()) : null; };
  // Les règles dans l'ordre des sources, avec leur @media (la feuille n'a qu'un niveau d'imbrication) ; regle(sel, media) rend la DERNIÈRE qui porte ce sélecteur.
  const regles = (texte) => { const out = []; const pile = []; let sel = null; let debut = 0; for (let i = 0; i < texte.length; i++) { if (texte[i] === '{') { const tete = texte.slice(debut, i).trim(); if (tete.startsWith('@')) pile.push(tete); else sel = tete.replace(/\s+/g, ' '); debut = i + 1; } else if (texte[i] === '}') { if (sel !== null) { out.push({ sel, corps: texte.slice(debut, i), media: pile.length ? pile[pile.length - 1] : null }); sel = null; } else pile.pop(); debut = i + 1; } } return out; };
  const declarations = (corps) => Object.fromEntries(corps.split(';').filter((d) => d.includes(':')).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
  const R = regles(css);
  const regle = (sel, media = null) => { const r = R.filter((x) => x.sel === sel && x.media === media).pop(); return r ? declarations(r.corps) : null; };
  const { el } = await import('../src/core/dom.js');
  const NOMS = ['soleil', 'bibliotheque', 'calendrier', 'toque', 'plus', 'roue', 'livres', 'appareil-photo', 'crayon', 'lien', 'etincelle', 'flocon', 'page', 'horloge', 'panier', 'assiette', 'couverts', 'salade', 'livre-ouvert', 'loupe', 'globe', 'personnes', 'image'];

  // --- Tâche 1 — jetons (D-UI-2, § 3.1) : les quatre valeurs de l'olive, les huit contrastes de la table, plus aucune tomate.
  await bloc('jetons', async () => {
    eq([jetons['--action'], jetons['--action-2'], jetons['--action-bg'], jetons['--tap']], ['#4f6b2e', '#3e5424', '#e9eddf', 'rgba(79,107,46,.15)'], 'D-UI-2 : --action, --action-2, --action-bg et --tap sont l’olive (§ 3.1)');
    // Ronde 1 (M11) : « les 25 autres : inchangés » (§ 3.1) — theme.js n'en épingle que sept par valeur ; les 34 autres déclarations de :root le sont ici, une à une, dans l'ordre.
    eq(Object.fromEntries(Object.entries(jetons).filter(([k]) => !['--action', '--action-2', '--action-bg', '--tap'].includes(k))), { '--paper': '#f8f5ef', '--paper-2': '#f1ece3', '--card': '#fffdf9', '--ink': '#242821', '--muted': '#636860', '--line': '#e4dfd5', '--field-line': '#8f8a80', '--accent': '#45604a', '--accent-2': '#55705a', '--accent-bg': '#e4ebe2', '--warn': '#8b5f10', '--warn-bg': '#fbf1dc', '--warn-line': '#ead9b3', '--danger': '#9c2f22', '--danger-bg': '#f9e4df', '--danger-line': '#e9bfb6', '--ok': '#3d6b4a', '--ok-bg': '#e2efe4', '--backdrop': 'rgba(36,40,33,.45)', '--radius': '12px', '--radius-pill': '999px', '--shadow': '0 1px 2px rgba(36,40,33,.05), 0 8px 24px rgba(36,40,33,.06)', '--serif': 'Georgia, "Times New Roman", serif', '--sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', '--topbar-h': '64px', '--nav-h': '64px', '--safe-b': 'env(safe-area-inset-bottom, 0px)', '--safe-t': 'env(safe-area-inset-top, 0px)', '--cream': 'var(--paper)', '--cream-2': 'var(--paper-2)', '--green': 'var(--accent)', '--green-2': 'var(--accent-2)', '--sage': '#b9c8bb', '--sage-2': 'var(--accent-bg)' }, 'D-UI-2 / § 3.1 : les 34 autres déclarations de :root gardent leur valeur de la refonte, une à une (« les 25 autres : inchangés » ; aucun jeton neuf, aucun retiré)');
    const c =(a, b) => Number(contraste(hex(a), hex(b)).toFixed(2));
    eq([c('--action', '--paper'), c('--action', '--card'), c('--action', '--accent-bg'), c('--action', '--paper-2'), c('--action-2', '--paper'), c('--muted', '--action-bg'), c('--action', '--action-bg'), c('--warn', '--action-bg')], [5.55, 5.95, 4.97, 5.14, 7.72, 4.8, 5.08, 4.71], 'D-UI-2 : les huit contrastes de § 3.1, recalculés par la formule de theme.js (olive sur papier, carte, accent-bg et paper-2 ; survol sur papier ; gris, olive et ambre sur action-bg)');
    eq([css.includes('#bc3026'), css.includes('#98231b'), css.includes('#f7e3e0'), /rgba\(188,\s*48,\s*38/.test(css)], [false, false, false, false], 'D-UI-2 : plus aucune tomate dans la feuille servie (ni #bc3026, ni #98231b, ni #f7e3e0, ni rgba(188,48,38,…))');
  });

  // --- Tâche 1 — règles de la feuille (texte) : où vivent .two-col.livre, .grid.livres, section.plain, les titres, .step-num.
  await bloc('règles de la feuille', async () => {
    eq(regle('.two-col.livre', '@media (min-width: 900px)')?.['grid-template-columns'], '200px 1fr', 'D-UI-7 / F-17 : .two-col.livre = 200px 1fr sous @media (min-width: 900px)');
    eq(regle('.two-col.livre', '@media (min-width: 760px)')?.['grid-template-columns'], '1fr', 'D-UI-7 : sous 900 px la fiche livre reste EMPILÉE — .two-col.livre = 1fr dans le bloc 760 px (sans elle, .two-col y ferait deux colonnes de 760 à 899 px)');
    eq([regle('.two-col')?.['grid-template-columns'], regle('.two-col', '@media (min-width: 760px)')?.['grid-template-columns'], regle('.two-col.narrow-left', '@media (min-width: 760px)')?.['grid-template-columns'], regle('.two-col.livre')], ['1fr', '1fr 1fr', '320px 1fr', null], 'F-17 : .two-col (760 px) et .two-col.narrow-left inchangées ; .two-col.livre n’a aucune règle hors @media');
    eq([regle('.grid.livres')?.['grid-template-columns'], regle('.grid')?.['grid-template-columns']], ['repeat(auto-fill, minmax(170px, 1fr))', 'repeat(auto-fill, minmax(150px, 1fr))'], '§ 3.3 : .grid.livres minmax(170px, 1fr) ; .grid intacte');
    const plain = regle('section.plain');
    eq([plain?.['box-shadow'], plain?.padding, plain?.['margin-bottom'], regle('section.plain > h2')?.['border-bottom'], regle('section.plain > h2')?.['padding-bottom']], ['none', '0', '1.6rem', '1px solid var(--line)', '.4rem'], 'D-UI-8 : section.plain sans ombre ni marge intérieure, 1,6 rem sous elle ; filet fin --line sous son h2, à .4 rem du texte');
    // Ronde 1 (M14) : la taille de 24 px vient aussi des attributs du svg — l'alignement et la non-compression ne tiennent qu'à la règle .icone.
    eq([regle('.icone')?.display, regle('.icone')?.['vertical-align'], regle('.icone')?.['flex-shrink'], regle('.empty .ico .icone')?.width], ['inline-block', 'middle', '0', '40px'], 'D-UI-9 : .icone en ligne, alignée au milieu du texte, jamais compressée dans une rangée flex ; 40 px dans un état vide');
    eq([regle('h1')?.['font-size'], regle('h1.titre-fiche')?.['font-size'], R.filter((r) => r.sel === 'h1' && r.media).length, regle('h2')?.['font-size'], regle('h3')?.['font-size'], regle('header.stack h1 + p.muted')?.['font-size']], ['clamp(1.8rem, 6vw, 3.2rem)', 'clamp(1.5rem, 4.5vw, 2.6rem)', 0, '1.6rem', '1.15rem', '1.05rem'], 'D-UI-3 / § 3.2 / H-6 : UNE formule clamp() par titre, plus aucune règle h1 sous @media ; h2 1,6 rem, h3 1,15 rem, sous-titre de page 1,05 rem');
    eq([regle('.step-num')?.background, regle('.step-num')?.color], ['var(--paper-2)', 'var(--ink)'], '§ 3.2 : .step-num en --paper-2 / --ink (le cercle beige des maquettes)');
  });

  // --- Tâche 1 — composants (DOM seul) : pageHeader({ classeTitre, back }), emptyState(nom), sectionPlain / section.
  await bloc('pageHeader, emptyState, sectionPlain', async () => {
    const tete = C.pageHeader('The Particular Sadness of Lemon Cake', { subtitle: 'Aimee Bender · Doubleday · 2010', back: { href: '/library', label: 'Bibliothèque' }, classeTitre: 'titre-fiche' });
    const h1 = tete.querySelector('h1'); const retour = tete.querySelector('a');
    eq([tete.tagName, tete.className, h1?.className, h1?.textContent, retour?.getAttribute('href'), retour?.textContent, tete.querySelector('h1 + p.muted')?.textContent], ['HEADER', 'stack', 'titre-fiche', 'The Particular Sadness of Lemon Cake', '#/library', '← Bibliothèque', 'Aimee Bender · Doubleday · 2010'], 'pageHeader : classeTitre pose la classe sur le h1 (H-20) ; back reste un objet { href, label } (H-1) ; le sous-titre suit le h1');
    const page = C.pageHeader('Bibliothèque', { subtitle: 'Tes livres, tes trouvailles, tes recettes.' });
    eq([page.querySelector('h1')?.hasAttribute('class'), page.querySelector('h1')?.className, page.querySelector('a'), page.querySelectorAll('.row.between.top > div').length], [false, '', null, 1], 'pageHeader sans classeTitre ni back : un h1 nu (titre de PAGE), aucun lien de retour, aucune rangée d’actions — rien d’autre ne change');
    const action = el('a', { class: 'btn primary', href: '#/add' }, 'Ajouter une recette');
    const vide = C.emptyState('panier', 'Aucun ingrédient structuré dans ces recettes.', action);
    const ico = vide.querySelector('.ico');
    eq([vide.className, ico?.children.length, ico?.firstElementChild?.tagName.toLowerCase(), ico?.firstElementChild?.classList.contains('icone-panier'), ico?.textContent, vide.querySelector('p')?.textContent, vide.lastElementChild === action], ['empty', 1, 'svg', true, '', 'Aucun ingrédient structuré dans ces recettes.', true], 'D-UI-9 : emptyState prend un NOM d’icône — .ico porte le svg du jeu et aucun texte ; le texte et l’action suivent');
    const leve = (f) => { try { f(); return false; } catch { return true; } };
    eq([leve(() => C.emptyState(String.fromCodePoint(0x1F6D2), 'x')), leve(() => C.emptyState('caddie', 'x')), leve(() => C.emptyState(undefined, 'x'))], [true, true, true], 'D-UI-9 : emptyState lève sur un émoji, sur un nom hors du jeu, sur rien — aucun état vide ne garde un émoji en silence');
    const sp = C.sectionPlain('Ingrédients', el('ul', { class: 'list plain' }, el('li', null, '400 g de spaghetti')), el('p', { class: 'muted' }, 'x'));
    eq([sp.tagName, sp.className, sp.children.length, sp.firstElementChild?.tagName, sp.firstElementChild?.textContent, sp.children[1]?.tagName, sp.children[2]?.className], ['SECTION', 'plain', 3, 'H2', 'Ingrédients', 'UL', 'muted'], 'D-UI-8 / H-2 : sectionPlain(title, ...children) rend section.plain, h2 puis ses enfants dans l’ordre (la forme de section)');
    const sc = C.section('Ingrédients', el('p', null, 'x')); const sansTitre = C.sectionPlain(null, el('p', null, 'seul'));
    eq([sc.className, sc.firstElementChild?.tagName, sc.children.length, sansTitre.firstElementChild?.tagName, sansTitre.className], ['card', 'H2', 2, 'P', 'plain'], 'D-UI-8 : section() reste .card (54 appelants intacts) ; sectionPlain sans titre = aucun h2, toujours .plain');
  });

  // --- Tâche 1 — icônes (DOM seul) : vingt-trois noms, la forme de chaque svg, levée sur un nom inconnu.
  await bloc('icônes', async () => {
    const { icone, NOMS_ICONES } = I; // module absent : TypeError, le bloc rougit par son nom
    eq([Object.isFrozen(NOMS_ICONES), NOMS_ICONES.length, [...NOMS_ICONES].sort()], [true, 23, [...NOMS].sort()], 'D-UI-9 / K-3 : exactement vingt-trois noms, ceux de la spec § 3.3, gelés');
    const NS = 'http://www.w3.org/2000/svg';
    const forme = (n) => { const s = icone(n); const traces = [...s.children]; return [s.namespaceURI, s.tagName.toLowerCase(), s.getAttribute('viewBox'), s.getAttribute('width'), s.getAttribute('height'), s.getAttribute('aria-hidden'), s.getAttribute('focusable'), s.getAttribute('fill'), s.getAttribute('stroke'), s.getAttribute('stroke-width'), s.getAttribute('stroke-linecap'), s.getAttribute('stroke-linejoin'), s.classList.contains('icone') && s.classList.contains('icone-' + n), traces.length >= 1 && traces.every((p) => p.namespaceURI === NS && p.tagName === 'path' && /^M[\d.\s,a-zA-Z-]+$/.test(p.getAttribute('d') || ''))]; };
    const FORME = [NS, 'svg', '0 0 24 24', '24', '24', 'true', 'false', 'none', 'currentColor', '1.75', 'round', 'round', true, true];
    eq(NOMS.map((n) => [n, ...forme(n)]), NOMS.map((n) => [n, ...FORME]), 'D-UI-9 / § 3.3 : chaque icône = svg[aria-hidden=true][focusable=false] 24 × 24, viewBox 0 0 24 24, fill none, stroke currentColor, trait 1,75 à bouts et joints ronds, classes icone + icone-<nom>, des <path d> au trait');
    eq(new Set(NOMS.map((n) => icone(n).innerHTML)).size, 23, 'D-UI-9 : vingt-trois tracés DISTINCTS (aucune icône recopiée d’une autre)');
    // La levée ATTENDUE porte son message (« icône inconnue : … ») : un `nom in TRACES` laisserait passer 'constructor' et lèverait AUTRE chose (« is not iterable »,
    // une TypeError aussi) — le message tranche (rév. 2, mutant 8).
    const leve = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError && /icône inconnue/.test(e.message); } };
    eq([leve(() => icone('inconnue')), leve(() => icone('')), leve(() => icone('Soleil')), leve(() => icone('constructor')), leve(() => icone('toString')), leve(() => icone(undefined)), leve(() => icone(null)), leve(() => icone(7)), leve(() => icone(['plus'])), leve(() => icone({ toString: () => 'plus' }))], [true, true, true, true, true, true, true, true, true, true], 'D-UI-9 : icone(nom) lève une TypeError « icône inconnue : … » sur un nom inconnu — casse comprise ; les clés héritées du prototype (constructor, toString) ne sont pas des icônes (Object.hasOwn, pas `in`) ; un non-texte qui se convertit en un nom du jeu ([\'plus\'], un objet à toString) non plus (garde typeof, ronde 1)');
    ok(icone('plus') !== icone('plus') && icone('plus').isEqualNode(icone('plus')), 'icone() rend un nœud NEUF à chaque appel, identique au précédent (une icône par site, jamais un nœud déplacé)');
  });

  // --- Tâche 1 — rendu (feuille injectée, scène hors écran de 980 px) : titres, sections, .step-num, grilles ; puis les icônes (tailles, couleur héritée, tracés).
  await bloc('rendu : typographie, sections, grilles, icônes', async () => {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../styles.css?v=' + v;
    await new Promise((r) => { link.onload = r; link.onerror = r; document.head.append(link); });
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-9999px;top:0;width:980px'; document.body.append(scene);
    try {
      const S = (n) => getComputedStyle(n);
      const taille = (n) => Number(parseFloat(S(n).fontSize).toFixed(1));
      // Attendu CALCULÉ sur la fenêtre réelle (vw = 1 % de window.innerWidth) : la même assertion vaut à 390, 768, 1280 ou 1512 px de fenêtre.
      const clamp = (min, vw, max) => Number(Math.min(max, Math.max(min, (vw / 100) * window.innerWidth)).toFixed(1));
      const tete = C.pageHeader('Bibliothèque', { subtitle: 'Tes livres, tes trouvailles, tes recettes.' });
      const fiche = C.pageHeader('The Particular Sadness of Lemon Cake', { classeTitre: 'titre-fiche' }); scene.append(tete, fiche);
      eq([taille(tete.querySelector('h1')), taille(fiche.querySelector('h1'))], [clamp(28.8, 6, 51.2), clamp(24, 4.5, 41.6)], `D-UI-3 : h1 de page = clamp(1.8rem, 6vw, 3.2rem), h1.titre-fiche = clamp(1.5rem, 4.5vw, 2.6rem), mesurés à ${window.innerWidth} px de fenêtre (1,8 / 1,5 rem à 375 et 390 px, 2,88 / 2,16 à 768, 3,2 / 2,6 à 1512)`);
      const h2 = el('h2', null, 'Ingrédients'); const h3 = el('h3', null, 'Titre'); scene.append(h2, h3);
      eq([taille(h2), taille(h3), taille(tete.querySelector('p.muted'))], [25.6, 18.4, 16.8], '§ 3.2 : h2 1,6 rem, h3 1,15 rem, sous-titre de pageHeader 1,05 rem (mesurés, racine 16 px)');
      // Les sections sont construites À LA MAIN ici : ce bloc mesure la FEUILLE (section.plain / section.card) ; la fonction sectionPlain est éprouvée au bloc « composants ».
      const sp = el('section', { class: 'plain' }, el('h2', null, 'Préparation'), el('p', null, 'x')); const sc = el('section', { class: 'card' }, el('h2', null, 'Photo du plat'), el('p', null, 'x')); const carte = el('div', { class: 'card' }, 'x'); scene.append(sp, sc, carte);
      eq([S(sp).backgroundColor, S(sp).boxShadow, S(sp).borderTopWidth, S(sp).paddingLeft, S(sp).marginBottom, S(sp).scrollMarginTop], ['rgba(0, 0, 0, 0)', 'none', '0px', '0px', '25.6px', '72px'], 'D-UI-8 : section.plain sur le papier (ni fond, ni ombre, ni bord, ni marge intérieure), 1,6 rem sous elle, même scroll-margin que .card (mesurés)');
      const h2p = sp.querySelector('h2');
      eq([S(h2p).borderBottomWidth, rgbVersHex(S(h2p).borderBottomColor), /georgia/i.test(S(h2p).fontFamily), S(h2p).marginTop], ['1px', hex('--line'), true, '0px'], 'D-UI-8 : le h2 d’une section plain = serif, filet fin --line dessous, sans marge haute (mesurés)');
      eq([S(sc).marginBottom, rgbVersHex(S(sc).backgroundColor), S(sc).boxShadow !== 'none', S(carte).marginBottom], ['25.6px', hex('--card'), true, '14.4px'], '§ 3.2 / R-VIS-14 : section.card espacée de 1,6 rem et toujours une carte (fond, ombre) ; un div.card garde ses .9 rem — .card ne change pas');
      const num = el('span', { class: 'step-num' }, '3'); scene.append(num);
      eq([rgbVersHex(S(num).backgroundColor), rgbVersHex(S(num).color)], [hex('--paper-2'), hex('--ink')], '§ 3.2 : .step-num = cercle --paper-2, chiffre --ink (mesurés)');
      const pistes = (n) => S(n).gridTemplateColumns.split(' ');
      const livre = el('div', { class: 'two-col livre' }, el('div', null, 'g'), el('div', null, 'd')); const deux = el('div', { class: 'two-col' }, el('div', null, 'g'), el('div', null, 'd')); scene.append(livre, deux);
      eq([pistes(livre).length, pistes(livre)[0], pistes(deux).length], window.innerWidth >= 900 ? [2, '200px', 2] : [1, '980px', window.innerWidth >= 760 ? 2 : 1], `D-UI-7 : .two-col.livre = 200px | le reste à ≥ 900 px, une seule colonne en dessous ; .two-col inchangée (fenêtre ${window.innerWidth} px, scène 980 px)`);
      const gl = el('div', { class: 'grid livres' }, ...Array.from({ length: 8 }, () => el('div', null, 'c'))); const g = el('div', { class: 'grid' }, ...Array.from({ length: 8 }, () => el('div', null, 'c'))); scene.append(gl, g);
      eq([pistes(gl).length, pistes(g).length], [5, 6], '§ 3.3 : .grid.livres (minmax 170 px) fait 5 colonnes à 980 px là où .grid (150 px) en fait 6 (mesurés)');
      // Icônes : tailles, couleur héritée, tracés. nav.tabs est display:none à ≥ 900 px : le style en ligne la montre (comme tests/theme.js, l. 69).
      const { icone, NOMS_ICONES } = I; // module absent : TypeError, le reste du bloc rougit par son nom
      const nav = el('nav', { class: 'tabs', style: { position: 'static', display: 'flex' } },
        el('a', { href: '#/library', class: 'active' }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('bibliotheque')), el('span', null, 'Bibliothèque')),
        el('a', { href: '#/add', class: 'add' }, el('span', { class: 'ico', 'aria-hidden': 'true' }, icone('plus')), el('span', null, 'Ajouter')));
      const vide = C.emptyState('panier', 'Rien.'); const seul = el('span', null, icone('horloge')); scene.append(nav, vide, seul);
      const dims = (s) => [S(s).width, S(s).height];
      eq([dims(seul.firstElementChild), dims(vide.querySelector('svg')), dims(nav.querySelector('a.active svg'))], [['24px', '24px'], ['40px', '40px'], ['24px', '24px']], '§ 3.3 : une icône mesure 24 × 24 ; 40 × 40 dans un état vide (mesurés)');
      // Chromium rend le stroke RÉSOLU (rgb) ; s'il gardait le mot currentcolor, la couleur calculée du path fait foi : dans les deux cas, l'icône suit son texte.
      const couleur = (p) => { const s = S(p).stroke.toLowerCase(); return s === 'currentcolor' ? rgbVersHex(S(p).color) : rgbVersHex(s); };
      eq([couleur(nav.querySelector('a.active path')), couleur(nav.querySelector('a.add path'))], [hex('--action'), hex('--paper')], 'D-UI-9 : le trait suit la couleur du texte — olive sur l’onglet actif, papier dans la pastille « Ajouter » (currentColor, mesuré)');
      const fautes = [];
      for (const n of NOMS_ICONES) {
        const s = icone(n); scene.append(s);
        for (const p of s.querySelectorAll('path')) { const b = p.getBBox(); if (!(p.getTotalLength() > 0) || b.x < -0.01 || b.y < -0.01 || b.x + b.width > 24.01 || b.y + b.height > 24.01) fautes.push(`${n} : d « ${(p.getAttribute('d') || '').slice(0, 40)} » (longueur ${p.getTotalLength().toFixed(1)}, boîte ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}×${b.height.toFixed(1)})`); }
      }
      eq(fautes, [], 'D-UI-9 : chaque tracé des vingt-trois icônes se dessine (longueur > 0) et tient dans la boîte 0 0 24 24 (mesuré)');
    } finally { scene.remove(); link.remove(); }
  });

  // --- Tâche 1 — sources (filets) : les états vides, NAV, les trois retours, en.js, SHELL et MODULES_NEUFS. app.js reste hors suite (§ 11) : seul son texte se relit.
  await bloc('sources : états vides, NAV, retours, en.js, SHELL', async () => {
    // D-UI-9 : par module, l'ENSEMBLE (trié) des noms d'icône de ses emptyState, et aucun nom hors du jeu (un émoji resté y tomberait) — un ensemble, pas la
    // liste ordonnée : T2 ajoute deux emptyState('assiette', …) à library.js (recettesTab, aImporterTab) sans toucher ce filet ; onze sites à f3672be.
    const SITES = { 'library.js': ['assiette', 'livres'], 'grocery.js': ['panier'], 'meals.js': ['couverts', 'salade'], 'kitchen.js': ['flocon', 'toque'], 'dish.js': ['assiette'], 'book.js': ['livre-ouvert'], 'search.js': ['loupe'], 'import.js': ['appareil-photo'] };
    // Ronde 1 (M9) : TOUS les modules de src/ui que SHELL sert (emptyState lève sur un nom inconnu : un appel hors des huit modules de SITES planterait son
    // écran) ; le premier argument de chaque appel est un littéral de N'IMPORTE QUELLE forme ('…', "…", `…` sans ${}) dont le texte est un nom du jeu — un
    // émoji, un nom hors du jeu ou une expression (constante, String.fromCodePoint…) tombent dans horsJeu. Rien n'est retiré du texte : un appel laissé
    // en commentaire compte aussi (plus strict ; un « 'image/*' » ouvrirait un faux commentaire et cacherait du code à un retrait par expression).
    const shell = await lire('../sw.js');
    const modulesUi = [...shell.matchAll(/'\.\/(src\/ui\/[a-z0-9-]+\.js)'/g)].map((m) => m[1]);
    const releve = {}; const horsJeu = [];
    for (const f of modulesUi) {
      const args = [...(await lire('../' + f)).matchAll(/(?<!function\s+)\bemptyState\(\s*([^,)]*)/g)].map((m) => { const a = m[1].trim(); return /^(['"`])([^'"`$]*)\1$/.exec(a)?.[2] ?? a; });
      if (args.length) releve[f.slice(7)] = [...new Set(args)].sort();
      horsJeu.push(...args.filter((n) => !NOMS.includes(n)).map((n) => `${f} : ${n}`));
    }
    eq([Object.fromEntries(Object.keys(SITES).map((f) => [f, releve[f]])), horsJeu, modulesUi.length > 20], [SITES, [], true], 'D-UI-9 / § 3.3 : chaque module porte l’ENSEMBLE de noms d’icône attendu pour ses états vides (onze sites à f3672be ; T2 en ajoute deux à library.js) et, dans TOUS les modules de src/ui que SHELL sert, chaque emptyState prend un nom du jeu (toute forme de guillemet) — plus aucun émoji');
    // Ronde 1 (constats 2, 3 et 6 : X1, XROUE) : app.js est relu SANS ses commentaires (lecteur qui saute les chaînes '…', "…", `…` : app.js n'a ni
    // expression régulière littérale ni commentaire /* */ à la ronde 1) ; navLinks rend icone(n.ico), jamais le nom brut, et la roue est l'icône ENFANT
    // du lien #/settings du panneau latéral (un « icone('roue') » laissé dans un commentaire ne compte plus). Un retrait qui mangerait du code rougit.
    const sansCommentaires = (src) => { let out = ''; let q = null; for (let i = 0; i < src.length; i++) { const c = src[i]; if (q) { out += c; if (c === '\\') out += src[++i] ?? ''; else if (c === q) q = null; } else if (c === '/' && src[i + 1] === '/') { while (i + 1 < src.length && src[i + 1] !== '\n') i++; } else if (c === '/' && src[i + 1] === '*') { const fin = src.indexOf('*/', i + 2); i = fin < 0 ? src.length : fin + 1; } else { if (c === "'" || c === '"' || c === '`') q = c; out += c; } } return out; };
    const app = sansCommentaires(await lire('../src/app.js'));
    const nav = [...app.matchAll(/\{ href: '([^']+)', label: '([^']+)', ico: '([^']+)'/g)].map((m) => m.slice(1, 4));
    const corpsNavLinks = /\nfunction navLinks\([^)]*\) \{\n([\s\S]*?)\n\}\n/.exec(app)?.[1] || '';
    eq([nav, app.includes("from './ui/icones.js'"), corpsNavLinks.includes('icone(n.ico)'), /,\s*n\.ico\s*\)/.test(corpsNavLinks), /el\('a', \{ href: '#\/settings'[^}]*\}, el\('span', \{ class: 'ico', 'aria-hidden': 'true' \}, icone\('roue'\)\)/.test(app), app.includes('Mes livres'), /ico: '[^a-z]/.test(app)], [[['/', 'Aujourd’hui', 'soleil'], ['/library', 'Bibliothèque', 'bibliotheque'], ['/meals', 'Ma semaine', 'calendrier'], ['/kitchen', 'Ma cuisine', 'toque'], ['/add', 'Ajouter', 'plus']], true, true, false, true, false, false], 'D-UI-4 / D-UI-9 : NAV = cinq entrées, libellé « Bibliothèque », des noms d’icônes du jeu (plus un émoji) ; navLinks rend icone(n.ico), jamais le nom brut ; la roue du panneau latéral est icone(\'roue\') dans le lien #/settings (source relu sans commentaires : app.js est hors suite, § 11)');
    const [recipe, book, accueil, search] = await Promise.all(['recipe.js', 'book.js', 'accueil-livre.js', 'search.js'].map((f) => lire('../src/ui/' + f)));
    eq([(recipe.match(/label: t\('Bibliothèque'\)/g) || []).length, (book.match(/label: t\('Bibliothèque'\)/g) || []).length, recipe.includes("t('Mes livres')"), book.includes("t('Mes livres')"), accueil.includes("t('Aller à la bibliothèque.')"), accueil.includes('Aller à Mes livres.'), search.includes("['books', 'Mes livres']")], [1, 1, false, false, true, false, true], 'D-UI-4 / B-M-9 : « ← Bibliothèque » sur la fiche recette et la fiche livre, « Aller à la bibliothèque. » à l’accueil d’un livre ; le segment « Mes livres » de la RECHERCHE (une portée, pas l’écran) reste');
    const { EN } = await import('../src/i18n/en.js');
    eq([EN['Bibliothèque'], EN['Aller à la bibliothèque.'], 'Aller à Mes livres.' in EN, EN['Mes livres']], ['Library', 'Go to the library.', false, 'My books'], '§ 5 : en.js porte « Library » et « Go to the library. », a perdu « Go to My books. » (chaîne retirée du source) et garde « My books » (segment de la recherche)');
    eq([shell.includes("'./src/ui/icones.js'"), MODULES_NEUFS.includes('../src/ui/icones.js')], [true, true], 'I-UI-7 / § 7 T1 : ./src/ui/icones.js dans SHELL (sw.js) et dans le filet i18n MODULES_NEUFS (tests/ajouter.js:8)');
  });

  // --- Tâche 1, ronde 1 (M15) — rendus : un état vide de module rendu par son écran (il lève sur un nom inconnu : l'écran planterait), et le texte de la
  // carte « Plus tard » lu dans le modèle pur de l'accueil d'un livre. Aucune base : la liste de courses est vide, son contexte est un objet en mémoire.
  await bloc('rendus : état vide de la liste de courses, accueil d’un livre', async () => {
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const avant = getUiLocale(); setUiLocale('fr');
    try {
      const { renderShoppingList } = await import('../src/ui/grocery.js');
      const { accueilLivreModel } = await import('../src/ui/accueil-livre.js');
      const vue = await renderShoppingList({ id: 'l1' }, {}, { shopping_lists: [{ id: 'l1', title: 'Courses', items: [] }], versionsById: new Map(), recipesById: new Map(), ingredientsById: new Map(), conventionFor: () => null, settings: { ui_locale: 'fr' } });
      eq([vue.querySelectorAll('.empty').length, vue.querySelector('.empty .ico')?.children.length, !!vue.querySelector('.empty .ico > svg.icone.icone-panier'), vue.querySelector('.empty .ico')?.textContent, vue.querySelector('.empty p')?.textContent], [1, 1, true, '', 'Aucun ingrédient structuré dans ces recettes.'], 'D-UI-9 : une liste de courses vide rend SON état vide, l’icône « panier » au trait et aucun émoji (rendu par renderShoppingList, contexte en mémoire)');
      eq(accueilLivreModel({ nouveau: 'x' }).cartes.map((c) => [c.action, c.texte]).at(-1), ['plusTard', 'Aller à la bibliothèque.'], 'D-UI-4 / B-M-9 : la carte « Plus tard » de l’accueil d’un livre dit « Aller à la bibliothèque. » (modèle pur)');
    } finally { setUiLocale(avant); }
  });

  // --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---
}
