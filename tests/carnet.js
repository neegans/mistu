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

  // ===== Tâche 2 — la carte-plat, la grille bornée et la Bibliothèque « Recettes » (spec D-UI-4, D-UI-5, I-UI-5, § 4.1, § 7 UI-1 T2)
  {
    const run = async (name, test) => { try { await test(); } catch (error) { ok(false, `Carnet T2 — ${name} : ${error?.name || 'Erreur'} — ${error?.message || String(error)}`); } };
    const { withRepo } = await import('./sync-fixture.js');
    const { buildDocs } = await import('../src/domain/search.js');
    const K = await import('../src/ui/components.js');
    const L = await import('../src/ui/library.js');
    const { renderLibrary } = L;
    const BU = await import('../src/core/blob-urls.js');
    const { EN } = await import('../src/i18n/en.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale();
    setUiLocale('fr'); // des textes français sont affirmés (rendue dans le finally)
    const DATE = '2026-10-23T12:00:00.000Z';
    const H = (c) => c.repeat(64); // une empreinte lisible : H('a') = « aaaa… » (64)
    const hex64 = (i) => i.toString(16).padStart(2, '0').repeat(32); // 70 empreintes DISTINCTES, admises par HASH (64 hex)
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    // Une scène DANS la fenêtre, derrière la page (z-index -1, aucun pointeur) : les images lazy s'y chargent, et un décodage raté y lève error.
    const nouvelleScene = () => { const s = document.createElement('div'); s.style.cssText = 'position:fixed;left:0;top:0;width:900px;z-index:-1;pointer-events:none'; document.body.append(s); return s; };
    const imageTest = async (couleur = '#c63', l = 64, h = 48) => { const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); return toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    const ligneFichier = (sha, blob, mime = blob.type) => ({ sha256: sha, mime, blob, size: blob.size, syncable: true, created_at: DATE, updated_at: DATE });
    const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Plat ' + id, availability: 'available', verification_state: 'verified', printed_page: null, current_version_id: 'rv_' + id, favorite: false, created_at: DATE, updated_at: DATE, ...over });
    const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, total_minutes: null,
      ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }],
      provenance: { generated_by: 'manual' }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
    const docDe = (recipe, over = {}) => ({ recipe, version: null, book: null, edition: null, cooked: 0, ...over });
    // Le contexte d'une bibliothèque (motif de tests/ajouter.js, bloc « Liens web gardés ») : les docs sont ceux de buildDocs, la forme que recipeCard attend.
    const ctxDe = (recipes, { versions = [], editions = [], books = [] } = {}) => {
      const docs = buildDocs({ recipes, versions, editions, books, dishes: [], links: [] });
      return { book_editions: editions, recipes, recipe_versions: versions, source_documents: [], source_pages: [], rediscovery_prefs: [], dishes: [], dish_recipe_links: [],
        recipesById: new Map(recipes.map((r) => [r.id, r])), docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])), scan_sessions: [], settings: {}, books,
        booksById: new Map(books.map((b) => [b.id, b])), editionsById: new Map(editions.map((e) => [e.id, e])), editionLabel: (e) => (e ? books.find((b) => b.id === e.book_id)?.title || '' : ''), cook_history: [], imports: [] };
    };
    // Un matchMedia factice : `matches` posé, écouteurs `change` notés, `bascule(m)` les appelle (F-5 : le même motif que la fiche recette, tâche 3).
    const fauxMatchMedia = (matches) => {
      const ecouteurs = [];
      const mq = { matches, addEventListener: (type, fn) => { if (type === 'change') ecouteurs.push(fn); }, removeEventListener: (type, fn) => { const i = ecouteurs.indexOf(fn); if (i >= 0) ecouteurs.splice(i, 1); } };
      return { matchMedia: (q) => { if (q !== '(min-width: 760px)') throw new Error('requête inattendue : ' + q); return mq; }, mq, ecouteurs, bascule(m) { mq.matches = m; for (const fn of [...ecouteurs]) fn({ matches: m }); } };
    };
    const texte = (n) => n?.textContent ?? null;
    // Espion des lectures de `files` sur l'instance de base : repo.getFile → db.get('files', sha), repo.getFiles → db.getMany('files', shas) (H-10 : les deux comptés).
    const espionnerLectures = (db) => { const lectures = []; const vraiGet = db.get.bind(db); const vraiGetMany = db.getMany.bind(db);
      db.get = (store, key) => { if (store === 'files') lectures.push(key); return vraiGet(store, key); };
      db.getMany = (store, keys) => { if (store === 'files') lectures.push(...keys); return vraiGetMany(store, keys); };
      return { lectures, rendre: () => { delete db.get; delete db.getMany; } }; };
    // Ronde 1 : un ESPION, plus un lanceur muet — un appel avalé par un catch (`fetch(…).catch(() => {})`) passait inaperçu. Le compte est affirmé à la fin
    // du bloc (aucun appel réseau) ; le fragment de la page est relevé pour affirmer qu'aucun geste ne navigue, et rendu tel quel en sortie.
    const appelsReseau = []; const hashT2 = location.hash;
    const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { appelsReseau.push(String(u?.url ?? u)); throw new Error('aucun reseau attendu : ' + u); };
    // Les 70 recettes à photo de trois blocs (une empreinte DISTINCTE chacune ; la plus récemment modifiée = la 69) : une définition (ronde 1).
    const septanteAPhoto = (prefixe) => Array.from({ length: 70 }, (_, i) => fiche(prefixe + String(i).padStart(2, '0'), { photo_sha256: hex64(i), original_title: 'Photo ' + String(i).padStart(2, '0'), updated_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() }));
    try {
      await run('recipeCard({ photoEnTete, fichier }) : décision synchrone, jamais de cadre vide, aucune lecture (D-UI-5, I-UI-5)', () => withRepo(async (repo, db) => {
        const jpeg = await imageTest();
        const { lectures, rendre } = espionnerLectures(db);
        const scene = nouvelleScene();
        try {
          const doc = docDe(fiche('rc_a', { photo_sha256: H('a') }));
          const avec = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg) });
          const img = avec.firstElementChild;
          eq([avec.tagName, avec.className, avec.getAttribute('href'), img?.tagName, img?.className, img?.getAttribute('alt'), img?.getAttribute('loading'), img?.getAttribute('src')?.startsWith('blob:'), avec.querySelector(':scope > .carte-plat-corps > h3')?.textContent, avec.querySelectorAll('img').length],
            ['A', 'item-link carte-plat', '#/recipes/rc_a', 'IMG', 'plat-vignette grande', '', 'lazy', true, 'Plat rc_a', 1],
            'carte-plat avec octets image : a.item-link.carte-plat > img.plat-vignette.grande (alt vide, lazy, src blob:) puis le bloc de titre — décidé AU RETOUR de l’appel, sans attendre');
          // Ajout de l’implémenteur (T2) : la carte n’a pour enfants que l’img (quand il y en a une), le bloc de titre, puis `extra` quand il est donné — un `extra`
          // nul n’ajoute rien (Element.append(null) écrirait le texte « null » sous chaque carte de la grille).
          const extraT2 = document.createElement('span');
          eq([[...avec.childNodes].map((x) => x.nodeName), [...K.recipeCard(doc, { photoEnTete: true }).childNodes].map((x) => x.nodeName), [...K.recipeCard(doc, { photoEnTete: true, extra: extraT2 }).childNodes].map((x) => x.nodeName), avec.textContent.includes('null')],
            [['IMG', 'DIV'], ['DIV'], ['DIV', 'SPAN'], false], 'carte-plat : ses enfants sont [img], le bloc de titre, puis extra s’il est donné — jamais un nœud texte « null » pour un extra absent');
          const corps = (c) => c.querySelector(':scope > .carte-plat-corps');
          // text/html : mime ET blob — typeAffichage (lot G, F-9, mime.js:28-31) rend le type du blob s'il est admis, SINON celui de la ligne : un blob text/html sous
          // un mime image/jpeg est affiché jpeg (règle épinglée par le lot G, jamais touchée ici) ; ses octets indécodables suivent le chemin asynchrone testé plus bas.
          const SANS = [['aucune ligne files', null], ['ligne sans blob (octets pas ici)', { sha256: H('a'), mime: 'image/jpeg' }], ['text/html (mime et blob : hors liste)', ligneFichier(H('a'), new Blob(['<p>x</p>'], { type: 'text/html' }))],
            ['PDF (liste blanche, pas une image)', ligneFichier(H('a'), new Blob(['%PDF-1.4'], { type: 'application/pdf' }))], ['SVG (hors liste, blob et mime)', ligneFichier(H('a'), new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'image/svg+xml')]];
          eq(SANS.map(([nom, f]) => { const c = K.recipeCard(doc, { photoEnTete: true, fichier: f }); return [nom, c.className, c.querySelectorAll('img').length, !!corps(c), c.querySelector('h3')?.textContent]; }),
            SANS.map(([nom]) => [nom, 'item-link carte-plat sans-photo', 0, true, 'Plat rc_a']),
            'carte-plat sans octets affichables (aucune ligne, pas de blob, text/html, PDF, SVG) : a.item-link.carte-plat.sans-photo, le bloc de titre, AUCUNE img — jamais de cadre vide ni d’image générique (I-UI-5)');
          const heic = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg, 'image/heic') });
          eq([heic.className, heic.querySelector('img.plat-vignette.grande')?.getAttribute('src')?.startsWith('blob:')], ['item-link carte-plat', true], 'carte-plat : une ligne image/heic dont le blob est image/jpeg s’affiche (le type du blob, dans la liste blanche, gagne — G, F-9)');
          // H-10 : la variante ne rend PAS vignettePlat et ne lit rien elle-même — un pointeur valide sans `fichier` ne fait ni img cachée ni getFile.
          const muette = K.recipeCard(doc, { photoEnTete: true, fichier: null });
          await tick(); await tick();
          eq([muette.querySelectorAll('img').length, lectures], [0, []], 'carte-plat : pointeur valide sans ligne passée → aucune img (pas même cachée), AUCUNE lecture de files (la variante ne rend pas vignettePlat)');
          // Des octets image/jpeg que le navigateur ne décode pas : l'img est retirée, la carte retombe sans photo, l'URL blob: révoquée (jamais un cadre d'image cassée).
          const faux = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), new Blob(['pas une image'], { type: 'image/jpeg' })) });
          const u = faux.querySelector('img')?.getAttribute('src');
          eq(typeof u === 'string' && u.startsWith('blob:'), true, 'carte-plat : des octets image/jpeg indécodables ont d’abord une img (le type est admis : la décision est synchrone)');
          scene.append(faux);
          await attendre(() => faux.classList.contains('sans-photo'), 'octets indécodables : la carte retombe sans photo');
          eq([faux.querySelectorAll('img').length, !!corps(faux), BU.revoquerUrlDeBlob(u)], [0, true, false], 'carte-plat : au décodage raté, l’img est retirée, la carte passe .sans-photo avec son bloc de titre, et son URL blob: est déjà révoquée (revoquerUrlDeBlob rend false)');
          eq(K.recipeCard(doc).className, 'item-link card', 'recipeCard sans photoEnTete : la carte horizontale d’avant, inchangée (épinglée par tests/photo-plat.js)');
          const g = K.grilleCartes([avec, heic]);
          eq([g.tagName, g.className, [...g.children].map((c) => c.getAttribute('href'))], ['DIV', 'grille-plats', ['#/recipes/rc_a', '#/recipes/rc_a']], 'grilleCartes(noeuds) → div.grille-plats portant ses cartes, dans l’ordre');
        } finally { rendre(); scene.remove(); BU.revoquerUrlsDeBlob(); }
      }));

      // Les docs de référence des deux blocs suivants : une recette du web, une d'un livre (prep + cook), une sans durée, un signet non lu, une création IA, une saisie à la main.
      const livre = { id: 'b1', title: 'Le livre', author: 'A.' }; const ed = { id: 'e1', book_id: 'b1' };
      const web = docDe(fiche('rc_w', { source_url: 'https://recettes.test/tarte' }), { version: version('rc_w', { total_minutes: 35 }) });
      const duLivre = docDe(fiche('rc_l', { edition_id: 'e1' }), { version: version('rc_l', { prep_minutes: 10, cook_minutes: 30 }), book: livre, edition: ed });
      const sansDuree = docDe(fiche('rc_s', { edition_id: 'e1' }), { version: version('rc_s'), book: livre, edition: ed });
      const signet = docDe(fiche('rc_g', { availability: 'reference_only', source_url: 'https://a.test/x' }));
      const ia = docDe(fiche('rc_i', { origine: 'ia' }), { version: version('rc_i', { kind: 'synthesis', status: 'proposed', total_minutes: 20, provenance: { generated_by: 'ai', creation: { demande: 'tarte' } } }) });
      const main = docDe(fiche('rc_m', { source_label: 'Recette de famille' }), { version: version('rc_m', { total_minutes: 90 }) });

      await run('dureeTotale, ligneSource, badges : « {source} · {durée} », rien d’inventé (D-UI-5, B-I-6)', async () => {
        const source = (d) => texte(K.recipeCard(d, { photoEnTete: true }).querySelector('.carte-plat-source'));
        eq([K.dureeTotale(web.version), K.dureeTotale(duLivre.version), K.dureeTotale(sansDuree.version), K.dureeTotale(null), K.dureeTotale(ia.version), K.dureeTotale(version('x', { total_minutes: 5, prep_minutes: 1, cook_minutes: 1 })), K.dureeTotale(version('x', { total_minutes: '35' })), K.dureeTotale(version('x', { cook_minutes: 25 })), K.dureeTotale(version('x', { prep_minutes: 15, cook_minutes: 0 }))],
          [35, 40, null, null, null, 5, null, null, 15],
          'dureeTotale : total_minutes d’abord, sinon prep + cook quand les DEUX sont connus (T3-R1 : une seule partie ne fait pas une durée ; une cuisson de 0 est connue), sinon null ; une création IA n’a pas de durée (C-6) ; une valeur non numérique vaut null');
        eq([source(web), source(duLivre), source(sansDuree), source(signet), source(ia), source(main)],
          ['Du web · recettes.test · 35 min', 'De mon livre · Le livre · 40 min', 'De mon livre · Le livre', 'Du web · a.test', 'Créée avec l’IA', 'Recette de famille · 1 h 30'],
          'ligne de source : « Du web · {hôte} » (hôte RECALCULÉ) ou « De mon livre · {titre} », puis « · {durée} » en UN nombre (formatMinutes) seulement quand une durée existe ; un signet non lu n’a pas de durée ; une fiche IA ou personnelle garde sa provenance');
        eq(K.ligneSource(docDe(fiche('rc_x', { source_url: 'pas une adresse' }))), 'Adresse non reconnue', 'ligneSource : une adresse illisible le dit (lienSignet), jamais le source_label stocké (S7)');
        // Ajout de l’implémenteur (T2, survivant M7 : source_label lue avant l’hôte) : une source_label stockée ne remplace ni l’hôte recalculé ni le livre.
        eq([K.ligneSource(docDe(fiche('rc_y', { source_url: 'https://vrai.test/p', source_label: 'Faux site' }))), K.ligneSource(docDe(fiche('rc_z', { edition_id: 'e1', source_label: 'Faux livre' }), { book: livre, edition: ed }))],
          ['Du web · vrai.test', 'De mon livre · Le livre'], 'ligneSource : une source_label stockée ne prend jamais la place de l’hôte recalculé ni du livre (S7) — elle ne vaut que pour une fiche sans adresse ni livre');
        // Ronde 1 (C-2) : une fiche créée avec l'assistant le dit d'abord — une adresse ou un livre portés par une fiche reçue ou restaurée ne prennent pas sa place.
        eq([K.ligneSource(docDe(fiche('rc_ia1', { origine: 'ia', source_url: 'https://evil.test/p' }))), K.ligneSource(docDe(fiche('rc_ia2', { origine: 'ia', edition_id: 'e1' }), { book: livre, edition: ed }))],
          ['Créée avec l’IA', 'Créée avec l’IA'], 'ligneSource : une fiche IA qui porte une adresse ou un livre dit « Créée avec l’IA » (C-2, comme provenanceText), jamais l’hôte ni le livre');
        // Ronde 1 : seule une durée STRICTEMENT positive compte (« PT0S » d'un JSON-LD, une valeur négative tapée dans l'éditeur).
        eq([K.dureeTotale(version('x', { total_minutes: 0 })), K.dureeTotale(version('x', { total_minutes: 0, prep_minutes: 10 })), K.dureeTotale(version('x', { prep_minutes: -30, cook_minutes: 10 })), K.dureeTotale(version('x', { prep_minutes: -30, cook_minutes: 0 })),
          K.ligneSource(docDe(fiche('rc_0', { source_url: 'https://site.test/r' }), { version: version('rc_0', { total_minutes: 0 }) }))],
          [null, null, null, null, 'Du web · site.test'], 'dureeTotale : un total nul ou négatif vaut null (il retombe sur prep + cook) ; une partie négative est inconnue, et une seule partie connue ne fait pas une durée (T3-R1) ; une somme nulle vaut null ; la carte ne dit jamais « · 0 min » ni une durée négative');
        eq([K.dureeTotale(version('x', { total_minutes: 0, prep_minutes: 10, cook_minutes: 0 })), K.dureeTotale(version('x', { total_minutes: -5, prep_minutes: 10, cook_minutes: 20 }))], [10, 30],
          'dureeTotale : un total nul ou négatif retombe sur prep + cook quand les deux sont connus (10 + 0, 10 + 20)');
        const badges = (d) => [...K.recipeCard(d, { photoEnTete: true }).querySelectorAll('.carte-plat-corps > .carte-plat-badges > *')].map((b) => b.textContent);
        // Le badge de disponibilité est celui d'availabilityBadge, lu par le composant lui-même (« Recette disponible » aujourd'hui, « Disponible » dès T5, D-UI-10) :
        // ce test tient la CARTE (ordre et présence des badges), jamais le libellé — qui est à T5 (rév. 2).
        const dispo = K.availabilityBadge(fiche('rc_f')).textContent;
        eq([badges(signet), badges(docDe(fiche('rc_f', { favorite: true }), { cooked: 3 })), badges(web), badges(ia)],
          [['Lien web'], [dispo, '★ Favori', 'Cuisinée 3×'], [dispo], [dispo, 'Créée avec l’IA · non testée']],
          'carte-plat : les badges restent dans la carte, sous la ligne de source — « Lien web » pour un signet, le badge de disponibilité (texte d’availabilityBadge, court dès T5), ★ Favori, « Cuisinée {n}× », l’étiquette IA');
      });

      await run('styles.css : .grille-plats 1 colonne à 359 px, 2 dès 360, 2 à 899, 3 dès 900 et à 950 (D-UI-4, bornes exactes ; D-15) ; carte sans photo ≥ 7 rem sur --paper-2 ; image 4:3 ; h3 serif 1,3 rem (mesurés dans un cadre)', async () => {
        // La grille suit la LARGEUR DE LA FENÊTRE (@media) : une scène dans la page de tests ne la ferait pas varier. Un <iframe> about:blank par largeur,
        // hors écran, même origine (frame-src 'self' ; about:blank hérite de la politique), qui charge la feuille servie et adopte la grille.
        // Ronde 1 : une image test en PORTRAIT (48 × 64), DÉCODÉE avant la mesure — le 4:3 doit venir de la règle, jamais du ratio naturel des octets.
        const jpeg = await imageTest('#c63', 48, 64);
        const cadre = async (largeur) => {
          const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
          f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:900px;border:0`;
          document.body.append(f);
          const d = f.contentDocument;
          d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
          const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
          await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
          return f;
        };
        const fautes = [];
        // Les DEUX bornes de D-UI-4, de part et d'autre (359 | 360, 899 | 900), plus 950 (rév. 3, D-15) : un @media décalé rougit — à 370 (360 → 1 piste),
        // à 880 (899 → 3 pistes), à 1000 (900 ET 950 → 2 pistes : la largeur 950 tue le mutant « 900 → 1000 » quelle que soit la borne basse de la plage).
        for (const [largeur, colonnes] of [[359, 1], [360, 2], [899, 2], [900, 3], [950, 3]]) {
          const f = await cadre(largeur);
          try {
            const w = f.contentWindow; const d = f.contentDocument;
            if (w.innerWidth !== largeur) fautes.push(`cadre ${largeur} : innerWidth ${w.innerWidth}`);
            const g = K.grilleCartes([K.recipeCard(web, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg) }), K.recipeCard(duLivre, { photoEnTete: true }), K.recipeCard(sansDuree, { photoEnTete: true }), K.recipeCard(signet, { photoEnTete: true })]);
            // Le cadre est hors écran : une img lazy n'y chargerait jamais. La scène (pas le composant) la passe en eager et attend son décodage, borné à 3 s.
            for (const i of g.querySelectorAll('img')) i.loading = 'eager';
            d.querySelector('main').append(g); // adopté par le document du cadre : la feuille du cadre s'applique
            const decodee = await Promise.race([g.querySelector('img.plat-vignette.grande').decode().then(() => true, () => false), new Promise((ok3) => setTimeout(() => ok3(false), 3000))]);
            const cs = w.getComputedStyle(g);
            const pistes = cs.gridTemplateColumns.trim().split(/\s+/);
            const img = g.querySelector('img.plat-vignette.grande'); const r = img.getBoundingClientRect();
            const corps = g.querySelector('.carte-plat.sans-photo > .carte-plat-corps'); const cc = w.getComputedStyle(corps);
            const h3 = w.getComputedStyle(g.querySelector('.carte-plat h3'));
            const cartes = [...g.children].map((c) => Math.round(c.getBoundingClientRect().height));
            eq([largeur, decodee, img.naturalWidth, img.naturalHeight, cs.display, pistes.length, cs.columnGap, cs.alignItems, Math.abs(r.width / r.height - 4 / 3) < 0.02, w.getComputedStyle(img).objectFit, w.getComputedStyle(img).borderRadius, cc.minHeight, cc.backgroundColor, cc.borderRadius, h3.fontSize, /georgia/i.test(h3.fontFamily), cartes.slice(0, colonnes).every((h) => h === cartes[0])],
              [largeur, true, 48, 64, 'grid', colonnes, '19.2px', 'stretch', true, 'cover', '12px', '112px', 'rgb(241, 236, 227)', '12px', '20.8px', true, true],
              `styles.css à ${largeur} px : .grille-plats = grid à ${colonnes} colonnes, gap 1.2rem, align-items stretch ; l’image 4:3 (une photo PORTRAIT 48 × 64 décodée : le ratio vient de la règle), recadrée, rayon 12 ; le bloc sans photo ≥ 7 rem (112 px) sur --paper-2 (#f1ece3), rayon 12 ; h3 serif 1,3 rem ; les cartes d’une même rangée ont la même hauteur (mesurés)`);
          } finally { f.remove(); }
        }
        eq(fautes, [], 'cadres de mesure : chaque iframe a la largeur demandée (359, 360, 899, 900, 950)');
        BU.revoquerUrlsDeBlob();
      });

      await run('Bibliothèque : Recettes par défaut, actions par segment, segments anciens valides, filtres par données, tri, pied, bouton mobile, « à importer » (§ 4.1)', () => withRepo(async () => {
        // A : de mon livre · B : du web (lue) · C : les deux · D : référence sans adresse (DEHORS, « à importer ») · E : signet non lu (DEDANS) · F : référence sans page.
        const A = fiche('rA', { edition_id: 'e1', updated_at: '2026-10-20T00:00:00.000Z' });
        const B = fiche('rB', { source_url: 'https://web.test/b', updated_at: '2026-10-22T00:00:00.000Z' });
        const C = fiche('rC', { edition_id: 'e1', source_url: 'https://web.test/c', updated_at: '2026-10-21T00:00:00.000Z' });
        const D = fiche('rD', { edition_id: 'e1', availability: 'reference_only', printed_page: 58 });
        const E = fiche('rE', { availability: 'reference_only', source_url: 'https://web.test/e', updated_at: '2026-10-23T00:00:00.000Z' });
        const F = fiche('rF', { edition_id: 'e1', availability: 'reference_only' });
        const ctx = ctxDe([A, B, C, D, E, F], { versions: [version('rA'), version('rB', { total_minutes: 35 }), version('rC')], editions: [ed], books: [livre] });
        const segment = (r) => texte(r.querySelector('.segmented button.active'));
        const action = (r) => { const a = r.querySelector('header .row.between.top > .row > a'); return a ? [a.className, a.getAttribute('href'), a.textContent] : null; };
        const titres = (r) => [...r.querySelectorAll('.grille-plats > a.carte-plat h3')].map((h) => h.textContent);
        const puce = (r, libelle) => [...r.querySelectorAll('button.puce')].find((b) => b.textContent === libelle);
        const pressees = (r) => [...r.querySelectorAll('button.puce')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
        const n = await renderLibrary({}, {}, ctx, fauxMatchMedia(false));
        const fragments = []; const geste = () => fragments.push(location.hash); // ronde 1 : le fragment après chaque puce et chaque frappe
        eq([texte(n.querySelector('header h1')), texte(n.querySelector('header p.muted')), [...n.querySelectorAll('.segmented button')].map((b) => b.textContent), segment(n), action(n), !!n.querySelector('.grille-plats'), titres(n), n.querySelector('header > a')],
          ['Bibliothèque', 'Tes livres, tes trouvailles, tes recettes.', ['Recettes', 'Livres', 'Plats'], 'Recettes', ['btn primary', '#/add', 'Ajouter une recette'], true, ['Plat rE', 'Plat rB', 'Plat rC', 'Plat rA'], null],
          'renderLibrary({}) : « Bibliothèque », son sous-titre, trois segments, Recettes ACTIF par défaut, « Ajouter une recette » → #/add en tête, la grille triée par dernière modification (E, B, C, A) ; la référence D est DEHORS, le signet non lu E DEDANS (B-I-5) ; aucun retour « ← … » sur Recettes');
        const carteE = n.querySelector('.grille-plats > a.carte-plat[href="#/recipes/rE"]');
        eq([carteE?.className, texte(carteE?.querySelector('.carte-plat-source')), [...(carteE?.querySelectorAll('.carte-plat-badges > *') || [])].map((b) => b.textContent), texte(n.querySelector('a.carte-plat[href="#/recipes/rB"] .carte-plat-source')), texte(n.querySelector('a.carte-plat[href="#/recipes/rC"] .carte-plat-source'))],
          ['item-link carte-plat sans-photo', 'Du web · web.test', ['Lien web'], 'Du web · web.test · 35 min', 'Du web · web.test'],
          'un signet non lu : carte sans photo, « Du web · {hôte} » sans durée, badge « Lien web » ; une recette web lue porte sa durée ; C (un livre ET une adresse) dit le web, l’adresse avant le livre');
        puce(n, 'De mes livres').click(); await attendre(() => titres(n).length === 2, 'puce « De mes livres »'); geste();
        eq([titres(n), pressees(n)], [['Plat rC', 'Plat rA'], [['Toutes', 'false'], ['De mes livres', 'true'], ['Du web', 'false']]], '« De mes livres » = edition_id non nul (C puis A) ; une seule puce pressée (aria-pressed)');
        puce(n, 'Du web').click(); await attendre(() => titres(n).length === 3, 'puce « Du web »'); geste();
        eq(titres(n), ['Plat rE', 'Plat rB', 'Plat rC'], '« Du web » = source_url non nul (E, B, C) : une fiche qui a les deux est dans les deux (B-M-7) — un filtre de DONNÉES, jamais un appel');
        puce(n, 'Toutes').click(); await attendre(() => titres(n).length === 4, 'puce « Toutes »'); geste();
        const champ = n.querySelector('.stack input[type="search"]');
        // Après chaque frappe, l'attente borne le redessin (asynchrone : il relit les lignes files manquantes) ; au-delà, les titres du moment sont rendus tels quels (le diff se lit dans eq).
        const taper = async (q, attendu) => { champ.value = q; champ.dispatchEvent(new Event('input', { bubbles: true })); try { await attendre(() => JSON.stringify(titres(n)) === JSON.stringify(attendu), `filtre « ${q} »`); } catch { /* lu tel quel */ } geste(); return titres(n); };
        eq([champ.getAttribute('placeholder'), champ.getAttribute('aria-label'), await taper('rb', ['Plat rB']), await taper('Pomme', ['Plat rB', 'Plat rC', 'Plat rA']), await taper('le livre', ['Plat rC', 'Plat rA']), await taper('', ['Plat rE', 'Plat rB', 'Plat rC', 'Plat rA'])],
          ['Une recette, un ingrédient…', 'Une recette, un ingrédient…', ['Plat rB'], ['Plat rB', 'Plat rC', 'Plat rA'], ['Plat rC', 'Plat rA'], ['Plat rE', 'Plat rB', 'Plat rC', 'Plat rA']],
          'le champ « Une recette, un ingrédient… » filtre LOCALEMENT sur le titre, les ingrédients de la version courante (« Pomme », casse ignorée : A, B, C) et le titre du livre ; vidé, tout revient ; le champ porte son nom accessible (aria-label)');
        eq(fragments, Array(7).fill(hashT2), 'les trois puces et les quatre frappes ne touchent pas l’adresse de la page : aucune navigation (filtres LOCAUX, ronde 1) — l’absence d’appel est affirmée en fin de bloc');
        const pied = n.querySelector('a[data-role="a-importer"]');
        eq([pied?.getAttribute('href'), pied?.textContent, !!(n.querySelector('.grille-plats').compareDocumentPosition(pied) & Node.DOCUMENT_POSITION_FOLLOWING)], ['#/library?tab=a-importer', 'Recettes de mes livres à importer →', true],
          'pied : « Recettes de mes livres à importer → » vers ?tab=a-importer, sous la grille, parce qu’une référence sans adresse existe');
        const sansRef = await renderLibrary({}, {}, ctxDe([A, B], { versions: [version('rA')], editions: [ed], books: [livre] }), fauxMatchMedia(false));
        eq(sansRef.querySelector('a[data-role="a-importer"]'), null, 'pied absent quand aucune référence n’est à importer (rien d’inventé)');
        // Les segments : ?tab=books et ?tab=dishes d'aujourd'hui restent valides ; ?tab=recettes aussi ; un ?tab inconnu vaut Recettes.
        const livres = await renderLibrary({}, { tab: 'books' }, ctx, fauxMatchMedia(false));
        const plats = await renderLibrary({}, { tab: 'dishes' }, ctx, fauxMatchMedia(false));
        const recettes = await renderLibrary({}, { tab: 'recettes' }, ctx, fauxMatchMedia(false));
        const inconnu = await renderLibrary({}, { tab: 'zzz' }, ctx, fauxMatchMedia(false));
        eq([segment(livres), action(livres), !!livres.querySelector('.grid.livres'), livres.querySelectorAll('.grid').length, !!livres.querySelector('.grille-plats'), segment(plats), action(plats), !!plats.querySelector('.grille-plats'), segment(recettes), !!recettes.querySelector('.grille-plats'), segment(inconnu), titres(inconnu).length, livres.querySelector('header > a')],
          ['Livres', ['btn primary', '#/add/livre', 'Ajouter un livre'], true, 1, false, 'Plats', null, false, 'Recettes', true, 'Recettes', 4, null],
          '?tab=books : Livres actif, « Ajouter un livre » → #/add/livre (neuf, H-15), la grille des couvertures porte .grid.livres (§ 3.3 : minmax 170 px, règle de T1) et reste la seule .grid ; ?tab=dishes : Plats actif, AUCUNE action ; ?tab=recettes et un ?tab inconnu : la grille des plats ; aucun retour « ← … » sous Livres');
        eq([[...livres.querySelectorAll('section.plain > h2')].map((h) => h.textContent), livres.querySelectorAll('section.card').length, livres.querySelector('section.plain a.item-link.card')?.getAttribute('href')],
          [['Liens web gardés'], 0, '#/recipes/rB'], 'sous Livres : « Liens web gardés » (B et E, signets sans livre, en carte horizontale) est une section PLAIN ; aucune section .card (D-UI-8)');
        // Le bouton mobile : a.btn.primary.big.block « Ajouter une recette » sous la grille, [hidden] ≥ 760 px (matchMedia injecté). Ronde 1 : l'abonnement à
        // `change` attend le MONTAGE (setTimeout 0 puis isConnected : app.js monte la route juste après son rendu) et il n'y en a jamais qu'UN dans l'app (le rendu
        // monté retire celui du précédent) — le MediaQueryList ne retient aucun rendu détaché (constat de la revue : N rendus, N écouteurs, N arbres retenus).
        const mm = fauxMatchMedia(true);
        const bouton = (r) => r.querySelector('a[data-role="ajouter-mobile"]');
        const nonMonte = await renderLibrary({}, {}, ctx, mm);
        await tick(); await tick();
        eq([bouton(nonMonte)?.className, bouton(nonMonte)?.getAttribute('href'), bouton(nonMonte)?.textContent, bouton(nonMonte)?.hidden, bouton(n)?.hidden, !!(nonMonte.querySelector('.grille-plats').compareDocumentPosition(bouton(nonMonte)) & Node.DOCUMENT_POSITION_FOLLOWING),
          bouton(nonMonte)?.parentElement === nonMonte.querySelector('.grille-plats')?.parentElement, mm.ecouteurs.length],
          ['btn primary big block', '#/add', 'Ajouter une recette', true, false, true, true, 0],
          '« Ajouter une recette » répété sous la grille en a.btn.primary.big.block, sans enveloppe à marge (caché, il ne laisse aucune bande vide) : [hidden] quand (min-width: 760px) est vraie, visible dessous ; un rendu jamais monté ne pose AUCUN écouteur');
        const scene = nouvelleScene();
        try {
          const large = await renderLibrary({}, {}, ctx, mm);
          const auRendu = bouton(large).hidden;
          mm.bascule(false); // un change ENTRE le rendu et le montage (D-T2-b)
          scene.append(large); await tick(); await tick();
          eq([auRendu, bouton(large).hidden, mm.ecouteurs.length], [true, false, 1], 'un change reçu entre le rendu et le montage n’est pas perdu : l’abonnement, posé au montage, relit la largeur (visible) ; un écouteur (D-T2-b)');
          mm.bascule(true); eq(bouton(large).hidden, true, 'le bouton suit la largeur : (min-width: 760px) devient vraie → [hidden]');
          mm.bascule(false); eq(bouton(large).hidden, false, '… et redevient fausse → visible');
          // Trois rendus montés tour à tour (navigation, refresh après une passe de synchro qui écrit), sans aucun change : un seul écouteur reste.
          let dernier = large;
          for (let i = 0; i < 3; i += 1) { dernier = await renderLibrary({}, {}, ctx, mm); scene.replaceChildren(dernier); await tick(); await tick(); }
          const sansChange = mm.ecouteurs.length; // compté AVANT tout change : un change retirerait de lui-même les écouteurs détachés
          mm.bascule(true);
          eq([sansChange, mm.ecouteurs.length, bouton(large).hidden, bouton(dernier).hidden], [1, 1, false, true], 'trois rendus montés tour à tour sans aucun change : UN écouteur actif (le rendu monté retire celui du précédent : aucun rendu détaché retenu) ; le bouton détaché ne suit plus, le monté suit');
          scene.remove(); mm.bascule(false);
          eq([mm.ecouteurs.length, bouton(dernier).hidden], [0, true], 'hors du document (route quittée), le prochain change retire l’écouteur sans rien toucher');
        } finally { scene.remove(); }
        // Ronde 1 : le défaut de production — app.js appelle handler(params, query, ctx) SANS deps : le vrai window.matchMedia, appelé lié (« Illegal invocation »
        // sinon). Rendu sans être monté : aucun écouteur sur la vraie MediaQueryList.
        let parDefaut = null; try { parDefaut = await renderLibrary({}, {}, ctx); } catch (e) { parDefaut = e; }
        const boutonDefaut = parDefaut instanceof Error ? null : bouton(parDefaut);
        eq([parDefaut instanceof Error ? `${parDefaut.name}: ${parDefaut.message}` : null, !!(parDefaut instanceof Error ? null : parDefaut.querySelector('.grille-plats')), boutonDefaut?.hidden ?? null],
          [null, true, window.matchMedia('(min-width: 760px)').matches], 'renderLibrary sans deps (le chemin de app.js) : le vrai window.matchMedia, sans levée ; la grille et le bouton mobile, [hidden] selon la vraie largeur');
        // Vide : seules des références → l'état vide « Aucune recette pour l’instant. » + « Ajouter une recette », aucune grille — et le pied, puisque des références attendent.
        const vide = await renderLibrary({}, {}, ctxDe([D, F], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
        eq([texte(vide.querySelector('.empty p')), vide.querySelector('.empty a.btn.primary')?.getAttribute('href'), texte(vide.querySelector('.empty a.btn.primary')), !!vide.querySelector('.grille-plats'), vide.querySelector('a[data-role="a-importer"]')?.getAttribute('href')],
          ['Aucune recette pour l’instant.', '#/add', 'Ajouter une recette', false, '#/library?tab=a-importer'], 'vide (seules des références) : « Aucune recette pour l’instant. » + « Ajouter une recette », aucune grille, le pied « à importer » reste');
        // ?tab=a-importer : segment Recettes actif, retour « ← Recettes », la liste compacte groupée par livre, « {titre} · p. N · À importer » → l'écran d'import ciblé.
        const ai = await renderLibrary({}, { tab: 'a-importer' }, ctx, fauxMatchMedia(false));
        const retour = ai.querySelector('header > a');
        eq([segment(ai), action(ai), retour?.getAttribute('href'), retour?.textContent, texte(ai.querySelector('section.plain > h2')), [...ai.querySelectorAll('section.plain h3')].map((h) => h.textContent), [...ai.querySelectorAll('section.plain li > a')].map((a) => [a.getAttribute('href'), a.textContent]), ai.querySelectorAll('section.card').length, !!ai.querySelector('.grille-plats')],
          ['Recettes', ['btn primary', '#/add', 'Ajouter une recette'], '#/library?tab=recettes', '← Recettes', 'Recettes de mes livres à importer', ['Le livre'], [['#/recipes/rD/importer', 'Plat rD · p. 58 · À importer'], ['#/recipes/rF/importer', 'Plat rF · À importer']], 0, false],
          '?tab=a-importer : segment Recettes actif, retour « ← Recettes » vers /library?tab=recettes (B-M-4), section plain « Recettes de mes livres à importer » groupée par livre, une ligne « {titre} · p. N · À importer » → #/recipes/<id>/importer par référence sans adresse (page d’abord, puis titre) ; le signet E n’y est pas');
        // Ajout de l’implémenteur (T2, survivant M22 : estAImporter sans « sans adresse ») : un signet RANGÉ dans un livre (reference_only, adresse, livre) est une
        // carte de la grille, jamais une ligne « à importer » ni une raison d’offrir le pied (le signet E, lui, n’a pas de livre : il ne distinguait pas les deux).
        const G = fiche('rG', { edition_id: 'e1', availability: 'reference_only', source_url: 'https://web.test/g', printed_page: 12 });
        const avecG = await renderLibrary({}, { tab: 'a-importer' }, ctxDe([D, G], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
        const seulG = await renderLibrary({}, {}, ctxDe([G], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
        eq([[...avecG.querySelectorAll('section.plain li > a')].map((a) => a.getAttribute('href')), titres(seulG), seulG.querySelector('a[data-role="a-importer"]')], [['#/recipes/rD/importer'], ['Plat rG'], null],
          'un signet rangé dans un livre est dans la grille (carte), jamais dans la liste « à importer » ni dans le pied (seule une référence SANS adresse est à importer)');
        // Ronde 1 : l'ORDRE de la liste « à importer » — deux livres insérés à rebours de l'alphabet, des pages insérées à rebours, deux références sans page aux
        // titres inversés : les livres par titre, puis dans chacun la page d'abord, puis le titre (l'ordre de la base ne passe jamais).
        const livreZ = { id: 'bz', title: 'Zeste' }; const edZ = { id: 'ez', book_id: 'bz' }; const livreA = { id: 'ba', title: 'Agrumes' }; const edA = { id: 'ea', book_id: 'ba' };
        const ref = (id, editionId, titre, page = null) => fiche(id, { edition_id: editionId, availability: 'reference_only', original_title: titre, printed_page: page });
        const ordre = await renderLibrary({}, { tab: 'a-importer' }, ctxDe([ref('z1', 'ez', 'Agneau', 90), ref('z2', 'ez', 'Zucchini', 12), ref('z3', 'ez', 'Tarte'), ref('z4', 'ez', 'Brioche'), ref('a1', 'ea', 'Citron', 40), ref('a2', 'ea', 'Orange', 5)],
          { editions: [edZ, edA], books: [livreZ, livreA] }), fauxMatchMedia(false));
        eq([[...ordre.querySelectorAll('section.plain h3')].map((h) => h.textContent), [...ordre.querySelectorAll('section.plain > .stack')].map((s) => [...s.querySelectorAll('li > a')].map((a) => a.textContent))],
          [['Agrumes', 'Zeste'], [['Orange · p. 5 · À importer', 'Citron · p. 40 · À importer'], ['Zucchini · p. 12 · À importer', 'Agneau · p. 90 · À importer', 'Brioche · À importer', 'Tarte · À importer']]],
          '?tab=a-importer : les livres par ordre alphabétique (Agrumes avant Zeste, insérés à rebours), puis dans chaque livre la page d’abord (12 avant 90) et le titre ensuite (Brioche avant Tarte) — jamais l’ordre de la base');
        // Ronde 1 : une référence sans adresse NI livre (son livre a disparu) n'est pas « à importer » et n'offre pas le pied (où elle doit paraître : au chef
        // d'orchestre, D-T2-d) ; sans aucune référence, la liste le dit en propre (D-T2-c).
        const O = fiche('rO', { availability: 'reference_only' });
        const avecO = await renderLibrary({}, { tab: 'a-importer' }, ctxDe([D, O], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
        const seulO = await renderLibrary({}, {}, ctxDe([A, O], { versions: [version('rA')], editions: [ed], books: [livre] }), fauxMatchMedia(false));
        const rien = await renderLibrary({}, { tab: 'a-importer' }, ctxDe([A], { versions: [version('rA')], editions: [ed], books: [livre] }), fauxMatchMedia(false));
        eq([[...avecO.querySelectorAll('section.plain li > a')].map((a) => a.getAttribute('href')), seulO.querySelector('a[data-role="a-importer"]'), texte(rien.querySelector('.empty p')), texte(rien.querySelector('header > a'))],
          [['#/recipes/rD/importer'], null, 'Rien à importer pour l’instant.', '← Recettes'],
          'une référence sans adresse ni livre n’est ni « à importer » ni une raison d’offrir le pied ; ?tab=a-importer sans référence : « Rien à importer pour l’instant. » (plus « Aucune recette »), avec son retour');
        // Ronde 1 : le repli created_at du tri (une fiche sans updated_at se range par sa création ; sans horodatage, en dernier) ; le filtre lit display_title.
        const R1 = fiche('rR1', { updated_at: null, created_at: '2026-10-25T00:00:00.000Z' }); const R2 = fiche('rR2', { updated_at: null, created_at: null });
        const R3 = fiche('rR3', { display_title: 'Gâteau renommé' }); const R4 = fiche('rR4', { updated_at: '2026-10-24T00:00:00.000Z' });
        const tri = await renderLibrary({}, {}, ctxDe([R2, R3, R1, R4]), fauxMatchMedia(false));
        const triInitial = titres(tri);
        const champTri = tri.querySelector('.stack input[type="search"]'); champTri.value = 'Renommé'; champTri.dispatchEvent(new Event('input', { bubbles: true }));
        try { await attendre(() => titres(tri).length === 1, 'filtre « Renommé »'); } catch { /* lu tel quel */ }
        eq([triInitial, titres(tri)], [['Plat rR1', 'Plat rR4', 'Gâteau renommé', 'Plat rR2'], ['Gâteau renommé']],
          'tri de la grille : updated_at, sinon created_at (R1, créée le 25, d’abord), sans horodatage en dernier (R2) ; le filtre trouve un titre renommé (display_title), casse ignorée');
        BU.revoquerUrlsDeBlob();
      }));

      await run('grille bornée : 70 recettes à photo → 60 cartes et EXACTEMENT 60 lectures (getFile et getFiles comptés), « Voir plus » en lit 10 ; révocation au redessin (F-9, D-T9)', () => withRepo(async (repo, db) => {
        const jpeg = await imageTest();
        // 70 recettes à photo (septanteAPhoto) ; les 70 lignes files partagent les mêmes octets (la base ne relit pas l'empreinte).
        const recettes = septanteAPhoto('rp');
        await db.mutate({ puts: { files: recettes.map((r) => ligneFichier(r.photo_sha256, jpeg)) }, origin: 'device' });
        const { lectures, rendre } = espionnerLectures(db);
        const scene = nouvelleScene();
        const revoquees = []; const vraiRevoke = URL.revokeObjectURL;
        try {
          const n = await renderLibrary({}, {}, ctxDe(recettes), fauxMatchMedia(false));
          scene.append(n);
          const cartes = () => [...n.querySelectorAll('.grille-plats > a.carte-plat')];
          const voirPlus = () => [...n.querySelectorAll('button')].find((b) => b.textContent === 'Voir plus') || null;
          const srcs = () => cartes().map((c) => c.querySelector('img.plat-vignette.grande')?.getAttribute('src'));
          eq([cartes().length, lectures.length, new Set(lectures).size, cartes()[0]?.querySelector('h3')?.textContent, cartes()[59]?.querySelector('h3')?.textContent, srcs().every((u) => typeof u === 'string' && u.startsWith('blob:')), voirPlus()?.className, L.CARTES_PAR_PAGE],
            [60, 60, 60, 'Photo 69', 'Photo 10', true, 'btn', 60],
            '70 recettes à photo : 60 cartes rendues (les 60 dernières modifiées), EXACTEMENT 60 lectures de files en UN getFiles des cartes rendues (aucun getFile : la carte ne lit rien), chaque carte avec son image ; « Voir plus » (button.btn) offert ; CARTES_PAR_PAGE = 60');
          voirPlus().click();
          await attendre(() => cartes().length === 70, '« Voir plus » rend la suite');
          eq([lectures.length, new Set(lectures).size, cartes()[69]?.querySelector('h3')?.textContent, voirPlus(), srcs().every((u) => typeof u === 'string' && u.startsWith('blob:'))], [70, 70, 'Photo 00', null, true],
            '« Voir plus » rend les 10 suivantes et en lit EXACTEMENT 10 de plus (70 au total, aucune relecture des 60 premières) ; plus rien à montrer : le bouton disparaît');
          // Ronde 1 : une frappe REMET la grille à 60 cartes (etat.limite revient à CARTES_PAR_PAGE) — « photo » garde les 70 : sans la remise, 70 resteraient.
          const champ = n.querySelector('.stack input[type="search"]');
          champ.value = 'photo'; champ.dispatchEvent(new Event('input', { bubbles: true }));
          try { await attendre(() => cartes().length === 60, 'frappe « photo » après « Voir plus »'); } catch { /* lu tel quel */ }
          eq([cartes().length, voirPlus()?.className, lectures.length], [60, 'btn', 70], 'une frappe après « Voir plus » remet la grille à 60 cartes (« Voir plus » revient) et ne relit rien');
          // D-T9 : un redessin (le filtre) révoque EXACTEMENT les URL des vignettes précédentes, chacune APRÈS le vidage (plus sous aucun img du document) ; les lignes files
          // gardées ne sont pas relues ; les cartes neuves ont des URL vivantes. L'espion note chaque révocation et si l'URL est encore sous un <img> à cet instant.
          const dansLeDocument = (u) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u);
          URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: dansLeDocument(u) }); return vraiRevoke.call(URL, u); };
          const avant = srcs();
          const sentinelle = BU.urlDeBlob(new Blob(['sentinelle']));
          champ.value = 'photo 6'; champ.dispatchEvent(new Event('input', { bubbles: true })); // « Photo 60 » à « Photo 69 »
          await attendre(() => cartes().length === 10 && revoquees.length >= avant.length, 'filtre « photo 6 » et révocations du redessin');
          eq([revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length, lectures.length, cartes().map((c) => c.querySelector('h3').textContent), srcs().every((u) => typeof u === 'string' && u.startsWith('blob:') && !revoquees.some((x) => x.u === u)), BU.revoquerUrlDeBlob(sentinelle)],
            [[...avant].sort(), 0, 70, ['Photo 69', 'Photo 68', 'Photo 67', 'Photo 66', 'Photo 65', 'Photo 64', 'Photo 63', 'Photo 62', 'Photo 61', 'Photo 60'], true, true],
            'redessin par le filtre : les URL précédentes (60) révoquées (compte exact), chacune APRÈS le vidage ; aucune nouvelle lecture (lignes gardées) ; 10 cartes neuves aux URL vivantes ; la sentinelle d’autrui reste vivante');
        } finally { URL.revokeObjectURL = vraiRevoke; rendre(); scene.remove(); BU.revoquerUrlsDeBlob(); }
      }));

      // Ajout de l’implémenteur (T2) : deux redessins qui se croisent — le premier attend une lecture de files (dix cartes pas encore lues), le second non
      // (sa carte est déjà lue) : la grille montre la DERNIÈRE demande, jamais celle qui finit en dernier (un redessin périmé ne rend rien).
      await run('grille : un redessin périmé ne remplace jamais le plus récent', () => withRepo(async (repo, db) => {
        const jpeg = await imageTest();
        const recettes = septanteAPhoto('rq');
        await db.mutate({ puts: { files: recettes.map((r) => ligneFichier(r.photo_sha256, jpeg)) }, origin: 'device' });
        const enVol = []; const vraiGetMany = db.getMany.bind(db);
        db.getMany = (store, keys) => { const p = vraiGetMany(store, keys); if (store === 'files') enVol.push(p); return p; };
        try {
          const n = await renderLibrary({}, {}, ctxDe(recettes), fauxMatchMedia(false));
          const titres = () => [...n.querySelectorAll('.grille-plats > a.carte-plat h3')].map((h) => h.textContent);
          const champ = n.querySelector('.stack input[type="search"]');
          champ.value = 'photo 0'; champ.dispatchEvent(new Event('input', { bubbles: true })); // Photo 00 à 09 : pas encore lues — une lecture part
          champ.value = 'photo 69'; champ.dispatchEvent(new Event('input', { bubbles: true })); // déjà lue : aucune lecture
          await Promise.allSettled(enVol); for (let i = 0; i < 5; i += 1) await tick();
          eq([enVol.length, titres()], [2, ['Photo 69']], 'grille : le redessin de « photo 0 » (lecture en vol) finit APRÈS celui de « photo 69 » et ne le remplace pas — la grille dit la dernière frappe');
        } finally { delete db.getMany; BU.revoquerUrlsDeBlob(); }
      }));

      // Ronde 1 : une lecture de files qui échoue pendant un redessin (base fermée, erreur IndexedDB) est journalisée par logError — jamais un rejet non géré.
      await run('grille : une lecture de files refusée pendant un redessin est journalisée, jamais un rejet non géré (ronde 1)', () => withRepo(async (repo, db) => {
        const jpeg = await imageTest();
        const recettes = septanteAPhoto('rr');
        await db.mutate({ puts: { files: recettes.map((r) => ligneFichier(r.photo_sha256, jpeg)) }, origin: 'device' });
        const n = await renderLibrary({}, {}, ctxDe(recettes), fauxMatchMedia(false));
        const rejets = []; const surRejet = (e) => { rejets.push(String(e.reason?.message || e.reason)); e.preventDefault(); };
        const erreurs = []; const vraiErreur = console.error;
        window.addEventListener('unhandledrejection', surRejet);
        console.error = (...a) => { erreurs.push(String(a[0])); };
        db.getMany = (store) => (store === 'files' ? Promise.reject(new Error('base fermée (test)')) : Promise.reject(new Error('magasin inattendu : ' + store)));
        try {
          const champ = n.querySelector('.stack input[type="search"]');
          champ.value = 'photo 0'; champ.dispatchEvent(new Event('input', { bubbles: true })); // Photo 00 à 09 : pas encore lues — la lecture est refusée
          try { await attendre(() => erreurs.length > 0 || rejets.length > 0, 'la lecture refusée est dite'); } catch { /* lu tel quel */ }
          await new Promise((r) => setTimeout(r, 50));
          eq([erreurs.filter((e) => e.includes('library.redessin')).length, rejets], [1, []], 'grille : la lecture refusée d’une frappe est journalisée (logError « library.redessin »), aucun rejet non géré');
        } finally { console.error = vraiErreur; window.removeEventListener('unhandledrejection', surRejet); delete db.getMany; BU.revoquerUrlsDeBlob(); }
      }));

      await run('en.js et filets i18n : les textes neufs de la tâche 2 (§ 5), l’interface anglaise', () => withRepo(async () => {
        const CLES = { 'Tes livres, tes trouvailles, tes recettes.': 'Your books, your finds, your recipes.', 'Recettes': 'Recipes', 'Ajouter une recette': 'Add a recipe', 'Une recette, un ingrédient…': 'A recipe, an ingredient…',
          'Toutes': 'All', 'De mes livres': 'From my books', 'Du web': 'From the web', 'Recettes de mes livres à importer': 'Recipes from my books to import', 'Voir plus': 'Show more', 'À importer': 'To import',
          'Du web · {h}': 'From the web · {h}', 'De mon livre · {t}': 'From my book · {t}', 'Aucune recette pour l’instant.': 'No recipes yet.',
          'Rien à importer pour l’instant.': 'Nothing to import for now.' }; // ronde 1 (D-T2-c) : l'état vide de ?tab=a-importer
        eq(Object.entries(CLES).filter(([k, v]) => EN[k] !== v).map(([k]) => k), [], 'en.js : chaque texte neuf de la tâche 2 a sa traduction exacte (§ 5)');
        const { CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
        const deComponents = ['Du web · {h}', 'De mon livre · {t}'];
        eq([Object.keys(CLES).filter((k) => !deComponents.includes(k) && !(CHAINES_NEUVES_AILLEURS['../src/ui/library.js'] || []).includes(k)), deComponents.filter((k) => !(CHAINES_NEUVES_AILLEURS['../src/ui/components.js'] || []).includes(k)), (CHAINES_NEUVES_AILLEURS['../src/ui/library.js'] || []).includes('Bibliothèque')],
          [[], [], true], 'filet i18n (tests/ajouter.js) : les chaînes neuves de library.js (« Bibliothèque » comprise) et de components.js sont déclarées dans CHAINES_NEUVES_AILLEURS');
        setUiLocale('en');
        try {
          // rx plus récente que ry : l'ordre attendu vient du tri, jamais de la stabilité d'Array.prototype.sort sur des dates égales (rév. 2).
          const en = await renderLibrary({}, {}, ctxDe([fiche('rx', { source_url: 'https://web.test/x', updated_at: '2026-10-24T00:00:00.000Z' }), fiche('ry', { edition_id: 'e1' }), fiche('rz', { edition_id: 'e1', availability: 'reference_only', printed_page: 3 })], { versions: [version('rx', { total_minutes: 35 }), version('ry', { prep_minutes: 5, cook_minutes: 5 })], editions: [ed], books: [livre] }), fauxMatchMedia(false));
          eq([texte(en.querySelector('header h1')), texte(en.querySelector('header p.muted')), [...en.querySelectorAll('.segmented button')].map((b) => b.textContent), [...en.querySelectorAll('button.puce')].map((b) => b.textContent), [...en.querySelectorAll('.carte-plat-source')].map(texte), texte(en.querySelector('a[data-role="a-importer"]')), en.querySelector('.stack input[type="search"]')?.getAttribute('placeholder') ?? null],
            ['Library', 'Your books, your finds, your recipes.', ['Recipes', 'Books', 'Dishes'], ['All', 'From my books', 'From the web'], ['From the web · web.test · 35 min', 'From my book · Le livre · 10 min'], 'Recipes from my books to import →', 'A recipe, an ingredient…'],
            'en : en-tête, segments, puces, lignes de source, pied et champ rendus par t() (la durée reste formatMinutes)');
          const enAI = await renderLibrary({}, { tab: 'a-importer' }, ctxDe([fiche('rz', { edition_id: 'e1', availability: 'reference_only', printed_page: 3 })], { editions: [ed], books: [livre] }), fauxMatchMedia(false));
          eq([texte(enAI.querySelector('header > a')), texte(enAI.querySelector('section.plain > h2')), texte(enAI.querySelector('section.plain li > a'))], ['← Recipes', 'Recipes from my books to import', 'Plat rz · p. 3 · To import'], 'en : la liste « à importer » (retour, titre, ligne) rendue par t()');
        } finally { setUiLocale('fr'); }
      }));
      // Ronde 1 (I-UI-1) : rien dans tout le bloc n'a appelé le réseau — ni le filtre local, ni les puces (« Du web » comprise), ni « Voir plus », ni un rendu.
      eq(appelsReseau, [], 'Carnet T2 : AUCUN appel réseau dans tout le bloc (frappes, puces — « Du web » est un filtre de données —, « Voir plus », rendus)');
    } finally { globalThis.fetch = vraiFetch; if (location.hash !== hashT2) history.replaceState(null, '', location.pathname + location.search + hashT2); setUiLocale(localeAvant); BU.revoquerUrlsDeBlob(); }
  }

  // ===== Tâche 3 — la fiche recette (spec § 4.2, D-UI-6, D-UI-10 ; bases jetables, matchMedia FACTICE, aucun réseau, aucune navigation réelle).
  // Trois fiches sont montées dans la même scène : avant chaque « + » (setServings lit document.getElementById), la scène est vidée.
  // Rév. 3 : tout nœud que drawBody() REMPLACE (body.replaceChildren : le segmented, les deux sections) se lit par un ACCESSEUR (onglets(), ing(), prep()),
  // jamais par une constante capturée — un nœud capturé avant un « + » serait détaché (vert aveugle sur actif(), rouge à tort sur hidden).
  {
  const { withRepo } = await import('./sync-fixture.js');
  await bloc('fiche recette (T3) : ordre du DOM, deux largeurs, onglets, autres gestes, repères, « Voir la page d’origine »', () => withRepo(async (repo, db) => {
    const { renderRecipe, blocSignet, texteReperes, dureeVersion } = await import('../src/ui/recipe.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const { lienOrigine } = await import('../src/ui/components.js');
    const { lienSignet } = await import('../src/core/lien.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { INGREDIENTS } = await import('../src/model/seed.js');
    const ING = new Map(INGREDIENTS.map((i) => [i.id, i]));
    const DATE = '2026-10-23T00:00:00.000Z';
    const vraiFetch = globalThis.fetch; let reseau = 0;
    globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
    const scene = document.createElement('div'); scene.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px'; document.body.append(scene);
    const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Pâtes ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
    const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, active_minutes: null, total_minutes: 35,
      ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }],
      constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: null, convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
    // Une page d'original pour rc_t3 (le motif de tests/photo-plat.js:336-337) : la section « Original » n'est rendue que si la fiche a une page (recipe.js:178-187) — sans
    // elle, l'ordre « Photo du plat → Original → Versions » n'aurait rien à mesurer (rév. 2). Les autres fiches ont source_page_ids: [] et ne la voient pas.
    const PAGE_T3 = { id: 'pg_t3', sha256: '1'.repeat(64), printed_page: 12 };
    const ctxPour = async (over = {}) => {
      const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions');
      return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])),
        editionsById: new Map(), booksById: new Map(), books: [], book_editions: [], pagesById: new Map([[PAGE_T3.id, PAGE_T3]]), imports: await db.getAll('imports'), dishesById: new Map(), dishes: [], cook_history: [],
        dish_recipe_links: [], recipe_translations: [], ingredients: INGREDIENTS, ingredientsById: ING, source_documents: [], source_pages: [], scan_sessions: [], rediscovery_prefs: [], docsByRecipe: new Map(),
        meals: [], meal_feedback: [], settings: { units: 'original', reading_locale: 'original', ui_locale: 'fr', llm: { provider: 'none' } }, conventionFor: () => null, sync: {}, ...over };
    };
    // Le matchMedia FACTICE : une MediaQueryList à la main — matches, change écouté, bascule à la demande, abonnés et requêtes comptés.
    const fauxMatchMedia = (large) => {
      const abonnes = new Set(); const requetes = [];
      const mql = { matches: large, media: '(min-width: 760px)', addEventListener: (nom, f) => { if (nom === 'change') abonnes.add(f); }, removeEventListener: (nom, f) => { abonnes.delete(f); } };
      return { matchMedia: (q) => { requetes.push(q); return mql; }, basculer: (l) => { mql.matches = l; for (const f of [...abonnes]) f({ matches: l, media: mql.media }); }, abonnes, requetes };
    };
    const mettre = (...rows) => db.mutate({ puts: { recipes: rows }, origin: 'device' });
    const versions = (...rows) => db.mutate({ puts: { recipe_versions: rows }, origin: 'device' });
    // Ronde 1 : l'abonnement à `change` se pose au MONTAGE (setTimeout 0 puis isConnected, le motif boutonMobile de library.js) — monter attend ce tour.
    const macro = () => new Promise((r) => setTimeout(r, 0));
    const monter = async (id, mm, query = {}) => { const p = await renderRecipe({ id }, query, await ctxPour(), { matchMedia: mm.matchMedia }); scene.append(p); await macro(); return p; };
    const avant = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const q = (p, sel) => p?.querySelector(sel) ?? null;
    const textes = (p, sel) => [...(p?.querySelectorAll(sel) ?? [])].map((n) => n.textContent);
    const titreSection = (s) => s?.querySelector('h2')?.textContent ?? null;
    const sectionPlain = (p, titre) => [...p.querySelectorAll('section.plain')].find((s) => (titreSection(s) ?? '').startsWith(titre)) ?? null;
    // Ronde 1 : des textes français sont affirmés — la locale est posée ici et rendue dans le finally (le bloc ne dépend plus de celui qui le précède).
    const localeAvant = getUiLocale(); setUiLocale('fr');
    try {
      await mettre(fiche('rc_t3', { source_page_ids: [PAGE_T3.id] })); await versions(version('rc_t3'));
      // --- Ordre du DOM, large
      const mmL = fauxMatchMedia(true);
      const pL = await monter('rc_t3', mmL);
      eq(mmL.requetes, ['(min-width: 760px)'], 'fiche T3 : la largeur est demandée au matchMedia INJECTÉ, par la requête de D-UI-6');
      const tete = q(pL, '[data-role="fiche-tete"]'); const details = q(pL, '[data-role="autres-gestes"]'); const corps = q(pL, '.recipe-body');
      eq([q(pL, 'header h1')?.classList.contains('titre-fiche'), q(pL, 'header a.muted')?.textContent, q(pL, 'header a.muted')?.getAttribute('href')], [true, '← Bibliothèque', '#/library'], 'fiche T3 : h1.titre-fiche (classeTitre) ; retour « ← Bibliothèque » → #/library');
      eq([tete?.classList.contains('two-col'), [...(tete?.children ?? [])].map((c) => c.dataset.role)], [true, ['fiche-etat', 'emplacement-photo-plat', 'fiche-gestes']], 'fiche T3 : .fiche-tete.two-col porte, dans cet ordre, l’état, l’emplacement de la photo, les gestes (en étroit, la photo passe avant les repères)');
      eq([q(tete, '[data-role="emplacement-photo-plat"]')?.classList.contains('fiche-photo'), !!q(tete, '[data-role="fiche-etat"] .badge'), avant(q(pL, 'header'), tete), avant(tete, details), avant(details, corps), details?.tagName, details?.classList.contains('card')],
        [true, true, true, true, true, 'DETAILS', true], 'fiche T3 : la photo porte .fiche-photo ; les badges sont dans l’état ; header → .fiche-tete → details.card → .recipe-body');
      const zone = [...pL.querySelectorAll('section.card')].find((s) => titreSection(s) === 'Photo du plat');
      const original = sectionPlain(pL, 'Original'); const versionsSec = sectionPlain(pL, 'Versions');
      const exportRow = [...pL.querySelectorAll('button')].find((b) => b.textContent === 'Exporter JSON-LD')?.closest('.row') ?? null;
      eq([avant(corps, zone), avant(zone, original), avant(original, versionsSec), avant(versionsSec, exportRow), !!exportRow, details.contains(exportRow)], [true, true, true, true, true, false], 'fiche T3 : .recipe-body → « Photo du plat » (.card) → « Original » (plain) → « Versions » (plain) → la rangée Export, hors du details (H-3)');
      eq([sectionPlain(pL, 'Ingrédients')?.dataset.role, sectionPlain(pL, 'Préparation')?.dataset.role, q(corps, '[data-role="colonnes-corps"]')?.classList.contains('two-col'), q(corps, '[data-role="colonnes-corps"]')?.children.length, [...pL.querySelectorAll('section.card')].map(titreSection)],
        ['section-ingredients', 'section-preparation', true, 2, ['Photo du plat']], 'fiche T3 : Ingrédients et Préparation en section.plain, seules dans un .two-col ; la seule section.card restante est « Photo du plat »');
      // --- Large : details ouvert, onglets cachés, les deux sections visibles
      const ongletsL = q(corps, '[data-role="onglets-corps"]');
      eq([details.open, details.querySelector('summary')?.textContent, ongletsL?.hidden, ongletsL?.classList.contains('segmented'), textes(ongletsL, 'button'), q(corps, '[data-role="section-ingredients"]').hidden, q(corps, '[data-role="section-preparation"]').hidden],
        [true, 'Portions, versions et autres gestes', true, true, ['Ingrédients', 'Préparation'], false, false], 'fiche T3 ≥ 760 px : details OUVERT, segmented caché, Ingrédients et Préparation toutes deux visibles');
      // --- Autres gestes : TOUT l'ancien contenu de controls et de la rangée d'actions, sauf « Commencer à cuisiner » et « Corriger » (qui y reste aussi) ; pas l'Export
      const boutonsDetails = textes(details, 'button, a');
      eq(['Créer ma version', 'Corriger', '−', '+', 'Avec quoi on mange ça ?', 'Ajouter à mon repas', 'Liste d’épicerie', 'Rattacher à un plat', 'Original', 'Métrique', 'US', 'FR', 'EN'].filter((x) => !boutonsDetails.includes(x)), [], 'fiche T3 : « autres gestes » porte les anciens boutons de controls (versions, portions, unités, langue) ET de la rangée d’actions');
      eq([boutonsDetails.includes('Commencer à cuisiner'), boutonsDetails.includes('Exporter JSON-LD'), boutonsDetails.includes('Exporter YAML (Paprika)'), !!q(details, '#servings-val'), q(details, '.chip.neutral')?.textContent, !!q(details, 'select'), details.querySelector('.row.between') !== null],
        [false, false, false, true, 'Rapide · V1', false, true], 'fiche T3 : ni « Commencer à cuisiner » ni l’Export dans le details ; les portions et les puces V1 y sont ; une seule version → badge, pas de select ; la .row.between (épingle creer-ia) y est');
      const gestes = q(tete, '[data-role="fiche-gestes"]'); const principal = q(gestes, '[data-role="geste-principal"]');
      const commencer = [...(principal?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Commencer à cuisiner');
      eq([commencer?.className, textes(pL, 'button').filter((x) => x === 'Commencer à cuisiner').length, q(gestes, '[data-role="corriger-tete"]'), q(pL, '.card.sage')], ['btn primary big block', 1, null, null], 'fiche T3 : « Commencer à cuisiner » = button.btn.primary.big.block dans les gestes de tête, une seule fois ; fiche VÉRIFIÉE → aucun « Corriger » dans l’en-tête ; plus de .card.sage');
      // --- « Corriger » visible tant que la version affichée n'est pas vérifiée (le seul geste que « — vérifie » réclame)
      await mettre(fiche('rc_nv', { verification_state: 'to_verify' }));
      await versions(version('rc_nv', { verification_state: 'to_verify', ingredients: [{ id: 'ri_nv', source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'to_verify' }] }));
      const pNV = await monter('rc_nv', fauxMatchMedia(true));
      const corriger = q(pNV, '[data-role="corriger-tete"]');
      eq([corriger?.tagName, corriger?.className, corriger?.textContent, corriger?.getAttribute('href'), q(pNV, '[data-role="geste-principal"]')?.contains(corriger), textes(q(pNV, '[data-role="autres-gestes"]'), 'a').filter((x) => x === 'Corriger').length, avant(q(pNV, '[data-role="geste-principal"] button'), corriger)],
        ['A', 'btn link', 'Corriger', '#/recipes/rc_nv/edit?kind=correction&v=rv_rc_nv', true, 1, true], 'fiche T3 : version NON vérifiée → a.btn.link « Corriger » à côté (après) de « Commencer à cuisiner », même href que celui du details, qui reste');
      // Ronde 1 : « Corriger » en tête pour TOUTE version non vérifiée (la règle est !== 'verified') — une version ancienne sans état, ou « unverified ».
      const sansEtat = version('rc_u0'); delete sansEtat.verification_state;
      await mettre(fiche('rc_u0'), fiche('rc_u1')); await versions(sansEtat, version('rc_u1', { verification_state: 'unverified' }));
      const pU0 = await monter('rc_u0', fauxMatchMedia(true)); const pU1 = await monter('rc_u1', fauxMatchMedia(true));
      eq([q(pU0, '[data-role="corriger-tete"]')?.getAttribute('href'), q(pU1, '[data-role="corriger-tete"]')?.getAttribute('href')], ['#/recipes/rc_u0/edit?kind=correction&v=rv_rc_u0', '#/recipes/rc_u1/edit?kind=correction&v=rv_rc_u1'],
        'fiche T3 : « Corriger » en tête sur une version SANS état de vérification et sur une version « unverified » (pas seulement « to_verify »)');
      // Ronde 1 : l'identifiant d'une fiche reçue (synchro, archive) peut porter « & » ou « # » — les liens d'édition l'encodent : le geste ouvert est celui annoncé.
      await mettre(fiche('rc_&x#', { verification_state: 'to_verify' })); await versions(version('rc_&x#', { verification_state: 'to_verify' }));
      const pEnc = await monter('rc_&x#', fauxMatchMedia(true));
      const liensEdition = [...(q(pEnc, '[data-role="autres-gestes"]')?.querySelectorAll('a') ?? [])].filter((a) => ['Créer ma version', 'Corriger'].includes(a.textContent)).map((a) => a.getAttribute('href'));
      eq([q(pEnc, '[data-role="corriger-tete"]')?.getAttribute('href'), liensEdition], ['#/recipes/rc_%26x%23/edit?kind=correction&v=rv_rc_%26x%23', ['#/recipes/rc_%26x%23/edit?kind=adaptation&v=rv_rc_%26x%23', '#/recipes/rc_%26x%23/edit?kind=correction&v=rv_rc_%26x%23']],
        'fiche T3 : les liens d’édition (« Corriger » de tête, « Créer ma version » et « Corriger » du details) encodent l’identifiant de la fiche et de la version');
      // --- Étroit : details fermé, onglets visibles, bascule LOCALE (la scène est vidée : un seul #servings-val dans le document)
      scene.replaceChildren();
      const mmE = fauxMatchMedia(false);
      const pE = await monter('rc_t3', mmE);
      const detailsE = q(pE, '[data-role="autres-gestes"]'); const corpsE = q(pE, '.recipe-body');
      // Rév. 3 (Critical du vérificateur) : `onglets` est un ACCESSEUR, comme ing() et prep() — un « + » (setServings → drawBody → body.replaceChildren) remplace
      // le segmented ; un nœud capturé ici serait DÉTACHÉ après le « + » : « change → large » rougirait avec un code correct (son hidden n'est plus touché),
      // actif() resterait vert aveugle (l'ancien nœud garde son .active).
      const onglets = () => q(corpsE, '[data-role="onglets-corps"]');
      const ing = () => q(corpsE, '[data-role="section-ingredients"]'); const prep = () => q(corpsE, '[data-role="section-preparation"]');
      const actif = () => textes(onglets(), 'button.active');
      eq([detailsE.open, onglets().hidden, ing().hidden, prep().hidden, actif(), onglets().getAttribute('role')], [false, false, false, true, ['Ingrédients'], 'tablist'], 'fiche T3 < 760 px : details FERMÉ ; segmented visible (tablist) ; Ingrédients visible, Préparation cachée (hidden), segment actif « Ingrédients »');
      const hashAvant = location.hash; const ingAvant = ing(); const prepAvant = prep(); const corpsAvant = corpsE.firstElementChild;
      [...onglets().querySelectorAll('button')].find((b) => b.textContent === 'Préparation').click();
      eq([ing().hidden, prep().hidden, actif(), location.hash === hashAvant, reseau, ing() === ingAvant && prep() === prepAvant, corpsE.firstElementChild === corpsAvant, corpsE.contains(ingAvant), ing().querySelectorAll('li').length],
        [true, false, ['Préparation'], true, 0, true, true, true, 1], 'fiche T3 : la tape « Préparation » bascule par hidden — sans navigation, sans appel, sans redessin (mêmes nœuds) ; Ingrédients reste dans le DOM avec sa ligne');
      // Le choix survit à drawBody() (un « + » redessine le corps : nœuds neufs, même choix)
      [...detailsE.querySelectorAll('button')].find((b) => b.textContent === '+').click();
      eq([q(detailsE, '#servings-val')?.textContent, ing() !== ingAvant, ing().hidden, prep().hidden, actif(), location.hash === hashAvant], ['5', true, true, false, ['Préparation'], true], 'fiche T3 : après un « + » (drawBody), les sections sont neuves mais le choix « Préparation » est gardé (mémorisé dans l’instance, jamais dans l’adresse)');
      // change du matchMedia : large → les deux visibles, onglets cachés, details ouvert ; retour étroit → le choix tient
      mmE.basculer(true);
      eq([onglets().hidden, ing().hidden, prep().hidden, detailsE.open, ing() !== null && ing() === q(corpsE, '[data-role="section-ingredients"]')], [true, false, false, true, true], 'fiche T3 : change → large : segmented caché, les deux sections visibles, details ouvert (écouté sur change, sans redessin)');
      mmE.basculer(false);
      eq([onglets().hidden, ing().hidden, prep().hidden, detailsE.open, actif()], [false, true, false, false, ['Préparation']], 'fiche T3 : change → étroit : segmented visible, Préparation (le choix) visible, Ingrédients cachée, details fermé');
      // L'abonné est retiré quand la fiche a quitté le document (pas de fuite à chaque visite)
      eq(mmE.abonnes.size, 1, 'fiche T3 : un seul abonné change par fiche montée');
      pE.remove(); mmE.basculer(true);
      eq(mmE.abonnes.size, 0, 'fiche T3 : une fiche retirée du document se désabonne à la notification suivante');
      // Ronde 1 (fuite de la revue : un abonné par rendu, jamais retiré sans change) : AU PLUS UN abonné de fiche dans l'app, posé au MONTAGE — le motif
      // boutonMobile de library.js (T2-R1). Les comptes sont pris AVANT tout change : un change retire de lui-même un abonné détaché (le trou de la revue).
      const mmV = fauxMatchMedia(true);
      await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour(), { matchMedia: mmV.matchMedia }); // jamais montée (app.js jette un rendu dépassé)
      await macro(); await macro();
      const nonMontee = mmV.abonnes.size;
      scene.replaceChildren();
      const vue1 = await monter('rc_t3', mmV); const montee = mmV.abonnes.size;
      vue1.remove(); mmV.basculer(false); // montée puis quittée SANS notification : le change suivant la retire
      const quittee = mmV.abonnes.size;
      let derniere = null;
      for (let i = 0; i < 3; i += 1) { scene.replaceChildren(); derniere = await monter('rc_t3', mmV); }
      const troisMontees = mmV.abonnes.size;
      mmV.basculer(true);
      eq([nonMontee, montee, quittee, troisMontees, mmV.abonnes.size, q(derniere, '[data-role="autres-gestes"]')?.open], [0, 1, 0, 1, 1, true],
        'fiche T3 : un rendu jamais monté ne s’abonne pas ; une fiche montée puis quittée sans notification est retirée au change suivant ; trois fiches montées tour à tour sans change → UN abonné (le montage retire celui de la fiche précédente) ; la fiche montée suit le change');
      const mmM = fauxMatchMedia(true);
      const pM = await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour(), { matchMedia: mmM.matchMedia });
      const ouvertAuRendu = q(pM, '[data-role="autres-gestes"]')?.open;
      mmM.basculer(false); // un change ENTRE le rendu et le montage
      scene.replaceChildren(pM); await macro();
      eq([ouvertAuRendu, q(pM, '[data-role="autres-gestes"]')?.open, q(pM, '[data-role="onglets-corps"]')?.hidden, mmM.abonnes.size], [true, false, false, 1],
        'fiche T3 : un change reçu entre le rendu et le montage n’est pas perdu — l’abonnement, posé au montage, relit la largeur (details replié, onglets visibles) ; un abonné');
      // Le défaut de production (app.js n'injecte rien) : window.matchMedia appelé lié ; ses abonnements `change` comptés par un espion posé le temps de ces rendus.
      const vraiMM = window.matchMedia; let actifs = 0; let leve = null;
      window.matchMedia = function (requete) {
        const m = vraiMM.call(window, requete); const ajouter = m.addEventListener.bind(m); const retirer = m.removeEventListener.bind(m);
        m.addEventListener = (nom, f, o) => { if (nom === 'change') actifs += 1; return ajouter(nom, f, o); };
        m.removeEventListener = (nom, f, o) => { if (nom === 'change') actifs -= 1; return retirer(nom, f, o); };
        return m;
      };
      try {
        for (let i = 0; i < 3; i += 1) { scene.replaceChildren(); scene.append(await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour())); await macro(); }
        await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour()); await macro(); // un rendu jamais monté
      } catch (e) { leve = `${e?.name}: ${e?.message}`; } finally { window.matchMedia = vraiMM; }
      eq([leve, actifs], [null, 1], 'fiche T3, défaut de production (window.matchMedia) : trois fiches montées puis un rendu jamais monté → UN abonnement change actif, sans levée');
      scene.replaceChildren();
      // --- Repères (B-I-6) : « {n} portions · {durée} », chaque partie si connue, UN nombre, portions de la VERSION
      const R = (over) => texteReperes({ ...version('x'), ...over });
      eq([R({ servings: 4, total_minutes: 35 }), R({ servings: 1, total_minutes: null, prep_minutes: 20, cook_minutes: 70 }), R({ servings: 4, total_minutes: null }), R({ servings: null, total_minutes: 35 }), R({ servings: null, total_minutes: null }), R({ servings: 2, total_minutes: 80, prep_minutes: 20, cook_minutes: 60 })],
        ['4 portions · 35 min', '1 portion · 1 h 30', '4 portions', '35 min', null, '2 portions · 1 h 20'], 'texteReperes : n ≥ 2 et durée → « {n} portions · {d} » ; « 1 portion » ; une seule partie connue ; rien → null ; total_minutes gagne sur prep + cook');
      eq([R({ servings: '4', total_minutes: 35 }), R({ servings: 0, total_minutes: 35 }), R({ servings: 4, total_minutes: -5 }), R({ servings: 4, total_minutes: 'x' }), texteReperes(null), dureeVersion({ kind: 'synthesis', total_minutes: 30, provenance: { generated_by: 'ai', creation: { demande: 'x' } } }), dureeVersion({ kind: 'extraction', total_minutes: null, prep_minutes: 0, cook_minutes: 0 })],
        ['35 min', '35 min', '4 portions', '4 portions', null, '', ''], 'texteReperes / dureeVersion : portions non entières ou nulles ignorées ; durée négative, illisible ou nulle ignorée ; version nulle → null ; une création IA n’a pas de durée ici (C-6)');
      // Hors brief (EI-T3-1, survivant M18) : la fixture dictée « total 80 = 20 + 60 » ne distinguait pas « total d'abord » de « prep + cook d'abord ».
      // Ronde 1 (rien d'inventé) : une préparation connue et une cuisson INCONNUE ne font pas une durée de recette ; une cuisson nulle (0) est connue.
      eq([R({ servings: 4, total_minutes: null, prep_minutes: 20, cook_minutes: null }), R({ servings: 4, total_minutes: null, prep_minutes: null, cook_minutes: 25 }), dureeVersion({ kind: 'extraction', total_minutes: null, prep_minutes: 15, cook_minutes: 0 })],
        ['4 portions', '4 portions', '15 min'], 'texteReperes / dureeVersion : préparation seule ou cuisson seule → aucune durée (jamais « 4 portions · 20 min » avec une cuisson inconnue) ; préparation 15 + cuisson 0 → 15 min');
      eq([R({ servings: 2, total_minutes: 45, prep_minutes: 20, cook_minutes: 60 }), dureeVersion({ kind: 'extraction', total_minutes: 45, prep_minutes: 20, cook_minutes: 60 })], ['2 portions · 45 min', '45 min'],
        'texteReperes / dureeVersion : total_minutes GAGNE sur prep + cook même quand ils diffèrent (45 contre 20 + 60 = 80)');
      await mettre(fiche('rc_r1'), fiche('rc_r2'), fiche('rc_r3'));
      await versions(version('rc_r1', { servings: 1, total_minutes: null, prep_minutes: 20, cook_minutes: 70 }), version('rc_r2', { servings: 4, total_minutes: null }), version('rc_r3', { servings: null, total_minutes: null }));
      scene.replaceChildren();
      const pR0 = await monter('rc_t3', fauxMatchMedia(true)); const pR1 = await monter('rc_r1', fauxMatchMedia(true)); const pR2 = await monter('rc_r2', fauxMatchMedia(true)); const pR3 = await monter('rc_r3', fauxMatchMedia(true));
      const reperes = (p) => q(p, '[data-role="reperes"]')?.textContent ?? null;
      eq([reperes(pR0), reperes(pR1), reperes(pR2), reperes(pR3), /\b(actif|total)\b/.test(q(pR0, '[data-role="fiche-gestes"]').textContent), q(pR0, '[data-role="fiche-gestes"]').contains(q(pR0, '[data-role="reperes"]')), /total 35 min/.test(sectionPlain(pR0, 'Ingrédients').textContent)],
        ['4 portions · 35 min', '1 portion · 1 h 30', '4 portions', null, false, true, true], 'fiche T3 : div.reperes dans les gestes de tête — « 4 portions · 35 min », « 1 portion · 1 h 30 », « 4 portions » seul, rien sans portions ni durée ; jamais la paire « actif · total », qui reste dans l’en-tête d’Ingrédients (timeText)');
      scene.replaceChildren();
      const pRq = await monter('rc_t3', fauxMatchMedia(true), { servings: '8' });
      eq([reperes(pRq), q(pRq, '#servings-val')?.textContent, titreSection(sectionPlain(pRq, 'Ingrédients'))], ['4 portions · 35 min', '8', 'Ingrédients — recalculés pour 8 portions'], 'fiche T3 : ?servings=8 recalcule les lignes (titre d’Ingrédients, −/+) mais les repères disent la version (une donnée, jamais la valeur du −/+)');
      // --- « Voir la page d’origine » (D-UI-10, I-B5) : lien texte, sur toute adresse lisible, http compris ; même data-role sur la fiche et le bloc du signet
      await mettre(fiche('rc_http', { source_url: 'http://site.test/r' })); await versions(version('rc_http'));
      const pH = await monter('rc_http', fauxMatchMedia(true));
      const ouvrir = q(pH, '[data-role="ouvrir-lien"]');
      eq([ouvrir?.tagName, ouvrir?.className, ouvrir?.textContent, ouvrir?.getAttribute('href'), ouvrir?.getAttribute('target'), ouvrir?.getAttribute('rel'), q(pH, '[data-role="fiche-gestes"]').contains(ouvrir), avant(ouvrir, q(pH, '[data-role="geste-principal"]')), pH.textContent.includes('Ouvrir le lien'), pH.querySelectorAll('[data-role="ouvrir-lien"]').length, q(pL, '[data-role="ouvrir-lien"]')],
        ['A', 'btn link', 'Voir la page d’origine', 'http://site.test/r', '_blank', 'noopener noreferrer', true, true, false, 1, null], 'fiche T3 : a.btn.link[data-role=ouvrir-lien] « Voir la page d’origine » sur une fiche http (I-B5), dans les gestes de tête avant la rangée principale ; « Ouvrir le lien » n’existe plus ; aucun lien sans adresse');
      const signetHttp = blocSignet({ id: 'rc_s', source_url: 'http://a.test/x', availability: 'reference_only' });
      const lienS = q(signetHttp, '[data-role="ouvrir-lien"]');
      eq([lienS?.className, lienS?.textContent, lienS?.getAttribute('href'), lienS?.getAttribute('rel'), signetHttp.textContent.includes('Ouvrir le lien'), signetHttp.querySelectorAll('a.btn.primary').length, lienOrigine(lienSignet('javascript:alert(1)')), lienOrigine(null), lienOrigine(lienSignet('https://b.test/y'))?.getAttribute('href')],
        ['btn link', 'Voir la page d’origine', 'http://a.test/x', 'noopener noreferrer', false, 0, null, null, 'https://b.test/y'], 'blocSignet et lienOrigine : le même lien texte « Voir la page d’origine » (plus de « Ouvrir le lien » primaire) ; une adresse hostile ou absente → null');
      // --- Ronde 1 (mutants survivants de la revue) : « Mémoire culinaire » en section plain (D-UI-8) ; les bandeaux de lecture dans l'état de l'en-tête (D-UI-6, § 4.2).
      const pMem = await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour({ cook_history: [{ id: 'ch_t3', recipe_id: 'rc_t3', recipe_version_id: 'rv_rc_t3', cooked_at: DATE, servings: 4 }] }), { matchMedia: fauxMatchMedia(true).matchMedia });
      const memoire = [...pMem.querySelectorAll('section')].find((s) => titreSection(s) === 'Mémoire culinaire') ?? null;
      eq([!!memoire, memoire?.classList.contains('plain'), memoire?.classList.contains('card'), [...pMem.querySelectorAll('section.card')].map(titreSection)], [true, true, false, ['Photo du plat']],
        'fiche T3 : « Mémoire culinaire » (une cuisson) est une section.plain, jamais une .card ; « Photo du plat » reste la seule .card');
      await mettre(fiche('rc_lu'));
      await versions(version('rc_lu', { provenance: { source_page_ids: [], generated_by: 'ai', model: null, edition_id: null, convention_snapshot: null, import_id: 'imp_lu', lu_le: DATE, source_url: 'https://site.test/lu', url_finale: 'https://site.test/lu', source_kind: 'jsonld', site: 'Le site' } }));
      const pLu = await renderRecipe({ id: 'rc_lu' }, {}, await ctxPour(), { matchMedia: fauxMatchMedia(true).matchMedia });
      eq([[...(q(pLu, '[data-role="fiche-etat"]')?.children ?? [])].map((c) => c.dataset.role ?? c.className), q(pLu, '[data-role="fiche-etat"]')?.firstElementChild?.querySelector('.badge') !== null],
        [['row', 'bandeau-web', 'bandeau-lecture'], true], 'fiche T3 : le bandeau web puis le bandeau de lecture vivent dans l’état de l’en-tête (.fiche-etat), après la rangée des badges (colonne de gauche, D-UI-6)');
      // --- Le sous-titre reste provenanceText (R-UI-P2) : « Du web · » / « De mon livre · » sont les préfixes de la CARTE-PLAT (ligneSource, T2), pas de la fiche — tests/creer-ia.js:1397 épingle « Mon livre — A. B. · page 58 » en header p.
      eq([q(pL, 'header p.muted')?.textContent, q(pH, 'header p.muted')?.textContent], ['Source personnelle', 'site.test'], 'fiche T3 : le sous-titre est provenanceText, inchangé — « Source personnelle » sans livre ni adresse, l’hôte RECALCULÉ pour une fiche web (R-UI-P2 ; § 4.2 amendé par T6)');
      // --- La photo en tête : dans la colonne photo, sans style en ligne (la feuille rend 4:3 pleine colonne)
      // Rév. 3 (ruling 17) : une image RÉELLE, 640 × 400 (16:10, PAS 4:3) — chargée avant la mesure du cadre, elle prouve que le 4:3 mesuré vient de la
      // feuille (aspect-ratio) et non de l'image : un JPEG 4:3 chargé aurait masqué le mutant « aspect-ratio retirée » (Step 10).
      const toile = new OffscreenCanvas(640, 400); toile.getContext('2d').fillRect(0, 0, 640, 400);
      const jpeg = await toile.convertToBlob({ type: 'image/jpeg' }); const sha = await sha256Hex(jpeg);
      await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
      await mettre(fiche('rc_ph', { photo_sha256: sha, photo_origin: 'image' })); await versions(version('rc_ph'));
      const pPh = await monter('rc_ph', fauxMatchMedia(true));
      // Ronde 1 (mutant survivant : width 100 % retirée) : une image RÉELLE plus étroite que la colonne (240 × 180) — la règle globale img { max-width: 100% } ne la grandit pas.
      const toileE = new OffscreenCanvas(240, 180); toileE.getContext('2d').fillRect(0, 0, 240, 180);
      const jpegE = await toileE.convertToBlob({ type: 'image/jpeg' }); const shaE = await sha256Hex(jpegE);
      await repo.putFile(shaE, jpegE, { mime: 'image/jpeg', origin: 'device' });
      await mettre(fiche('rc_pe', { photo_sha256: shaE, photo_origin: 'image' })); await versions(version('rc_pe'));
      const img = q(pPh, '[data-role="photo-plat"] img');
      eq([!!img, img?.getAttribute('src')?.startsWith('blob:'), img?.getAttribute('style'), q(pPh, '.fiche-photo')?.contains(img), avant(img, q(pPh, '[data-role="fiche-gestes"]'))], [true, true, null, true, true], 'fiche T3 : la photo de tête vit dans .fiche-photo, avant les gestes, sans style en ligne (plus de 320 px : la feuille rend 4:3 pleine colonne)');
      // --- La FEUILLE servie (D-UI-6), mesurée dans des cadres (la technique de T2 : un <iframe> about:blank par largeur, la feuille chargée DEDANS — les jetons de :root et
      // les @media y valent, ce qu'une scène de la page de tests ou une racine fantôme ne donne pas ; rév. 2). Deux fiches : rc_ph (photo) et rc_t3 (emplacement vide → une colonne).
      const cadre3 = async (largeur) => {
        const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
        f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:1200px;border:0`;
        document.body.append(f);
        try { // ronde 1 : le cadre est retiré aussi quand le contrôle de largeur lève (rien ne reste attaché à la page de tests)
          const d = f.contentDocument;
          d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
          const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
          await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
          if (f.contentWindow.innerWidth !== largeur) throw new Error(`cadre ${largeur} : innerWidth ${f.contentWindow.innerWidth}`);
          return f;
        } catch (e) { f.remove(); throw e; }
      };
      const mesureFiche = async (largeur, id) => {
        const f = await cadre3(largeur);
        try {
          const w = f.contentWindow; const S = (n) => w.getComputedStyle(n);
          const p = await renderRecipe({ id }, {}, await ctxPour(), { matchMedia: fauxMatchMedia(largeur >= 760).matchMedia });
          f.contentDocument.querySelector('main').append(p); // adopté par le document du cadre : SA feuille s'applique
          const tete = q(p, '[data-role="fiche-tete"]'); const ph = q(tete, '.fiche-photo'); const img = q(ph, 'img');
          // Rév. 3 (ruling 17) : l'image RÉELLE est CHARGÉE avant la mesure — le cadre est hors écran, loading="lazy" n'y décoderait jamais : on force le
          // chargement (eager + decode) du JPEG réel posé par repo.putFile (640 × 400, le chemin de production) ; la mesure ne dépend pas d'une boîte de
          // remplacement (`chargee` l'affirme par naturalWidth > 0). Si la mesure restait instable, elle porterait sur la figure parente (figure.photo-plat),
          // pas sur l'img. Rév. 4 (point 2) : l'attente est BORNÉE à 3 s — sans `eager`, une img lazy dans un cadre hors écran ne se charge jamais et
          // `decode()` PEND : la suite se figerait au lieu de rougir ; un rejet (indécodable) est avalé, puis `chargee` lit naturalWidth > 0 et tranche.
          if (img) { img.loading = 'eager'; await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]); }
          const rE = q(tete, '[data-role="fiche-etat"]').getBoundingClientRect(); const rP = ph.getBoundingClientRect(); const rG = q(tete, '[data-role="fiche-gestes"]').getBoundingClientRect();
          const rI = img ? img.getBoundingClientRect() : null;
          return { pistesTete: S(tete).gridTemplateColumns.trim().split(/\s+/).length, photoADroite: rP.left >= rE.right - 1 && rP.left >= rG.right - 1, photoEntre: rE.bottom <= rP.top + 1 && rP.bottom <= rG.top + 1,
            photoLongeGestes: rP.top <= rE.top + 1 && rP.bottom > rG.top + 1, // EI-T3-2 : la photo couvre les DEUX rangées de gauche (zones), elle ne pousse pas les gestes sous elle
            chargee: img ? img.naturalWidth > 0 : null,
            imgPleine: rI ? Math.abs(rI.width - rP.width) < 1 : null, ratio: rI ? Math.abs(rI.width / rI.height - 4 / 3) < 0.02 : null, objectFit: img ? S(img).objectFit : null,
            onglets: S(q(p, '[data-role="onglets-corps"]')).display, prep: S(q(p, '[data-role="section-preparation"]')).display, pistesCorps: S(q(p, '[data-role="colonnes-corps"]')).gridTemplateColumns.trim().split(/\s+/).length,
            // Ronde 1 : l'écart entre l'état et les gestes (une pile, jamais un vide), la cible du summary (I-UI-4), la flèche du lien d'origine, le bouton seul plein.
            ecartEtatGestes: Math.round(rG.top - rE.bottom), summary: q(p, 'details[data-role="autres-gestes"] > summary').getBoundingClientRect().height,
            fleche: q(p, '[data-role="ouvrir-lien"]') ? w.getComputedStyle(q(p, '[data-role="ouvrir-lien"]'), '::after').content : null,
            boutonPlein: (() => { const r = q(tete, '[data-role="geste-principal"]'); const b = q(r, 'button'); return r && b && r.children.length === 1 ? Math.abs(b.getBoundingClientRect().width - r.getBoundingClientRect().width) < 1 : null; })() };
        } finally { f.remove(); }
      };
      const [ph1100, ph375, vide1100] = [await mesureFiche(1100, 'rc_ph'), await mesureFiche(375, 'rc_ph'), await mesureFiche(1100, 'rc_t3')];
      eq([ph1100.pistesTete, ph1100.photoADroite, ph1100.chargee, ph1100.imgPleine, ph1100.ratio, ph1100.objectFit, ph1100.onglets, ph1100.prep, ph1100.pistesCorps], [2, true, true, true, true, 'cover', 'none', 'block', 2],
        'styles.css à 1100 px (D-UI-6) : .fiche-tete en deux colonnes, la photo à droite de l’état ET des gestes (grid-template-areas), l’image RÉELLE chargée (naturalWidth > 0, 640 × 400) rendue pleine colonne en 4:3 recadrée par la feuille ; segmented caché ([hidden]), les deux sections visibles, .recipe-body en deux colonnes (mesurés dans un cadre)');
      // Hors brief (EI-T3-2, survivant C1b) : sans les zones, l'ordre du DOM (état, photo, gestes) met déjà la photo à droite de l'état ET des gestes —
      // mais sur la première rangée seulement : les gestes tombaient sous la photo. Les zones la font longer les deux rangées de la colonne de gauche.
      eq(ph1100.photoLongeGestes, true, 'styles.css à 1100 px (D-UI-6) : la photo occupe la colonne de droite sur les DEUX rangées (« etat photo » / « gestes photo ») — elle commence à la hauteur de l’état et longe les gestes (mesuré)');
      eq([ph375.pistesTete, ph375.photoEntre, ph375.chargee, ph375.imgPleine, ph375.ratio, ph375.onglets !== 'none', ph375.prep, ph375.pistesCorps], [1, true, true, true, true, true, 'none', 1],
        'styles.css à 375 px (D-UI-6) : une colonne, la photo ENTRE l’état et les gestes (sous la provenance, maquette mobile), image réelle chargée, pleine largeur 4:3 ; segmented visible, Préparation cachée ([hidden]), une seule colonne de corps (mesurés)');
      // Ronde 1 : la colonne de gauche est une PILE état → gestes (D-UI-6, § 4.2) — la hauteur en trop de la photo va à la rangée des gestes, jamais entre les deux.
      ok(ph1100.ecartEtatGestes >= 0 && ph1100.ecartEtatGestes < 24, `styles.css à 1100 px, avec photo : l’état et les gestes restent empilés (écart ${ph1100.ecartEtatGestes} px, attendu le gap de 16 px ; jamais le vide de la photo)`);
      const [http375, pe1100, pe375] = [await mesureFiche(375, 'rc_http'), await mesureFiche(1100, 'rc_pe'), await mesureFiche(375, 'rc_pe')];
      eq([http375.ecartEtatGestes, http375.fleche, http375.boutonPlein, ph375.boutonPlein, ph375.summary >= 44, ph1100.summary >= 44],
        [16, '" ↗"', true, true, true, true], 'styles.css à 375 px, fiche SANS photo : l’emplacement vide n’ajoute pas de second gap (état → gestes 16 px) ; la flèche « ↗ » du lien d’origine vient de la feuille ; seul (fiche vérifiée), « Commencer à cuisiner » remplit sa rangée ; le summary des autres gestes fait au moins 44 px (I-UI-4)');
      eq([pe1100.chargee, pe1100.imgPleine, pe1100.ratio, pe375.chargee, pe375.imgPleine, pe375.ratio], [true, true, true, true, true, true],
        'styles.css (D-UI-6) : une photo RÉELLE plus étroite que la colonne (240 × 180) est rendue pleine colonne en 4:3, à 1100 comme à 375 px (mesuré)');
      eq([vide1100.pistesTete, vide1100.chargee, vide1100.imgPleine, vide1100.photoADroite], [1, null, null, false], 'styles.css à 1100 px, fiche SANS photo : .fiche-tete:has(> .fiche-photo:empty) → une seule colonne (la zone photo déclarée en troisième rangée, 0 px : aucune piste implicite à droite, rév. 4), aucune image (mesuré)');
      eq(reseau, 0, 'fiche T3 : aucun réseau');
    } finally { globalThis.fetch = vraiFetch; scene.remove(); setUiLocale(localeAvant); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
  }));
  }

  // --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---
}
