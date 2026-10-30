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
    eq([jetons['--action'], jetons['--action-2'], jetons['--action-bg'], jetons['--tap']], ['#454e3b', '#363d2e', '#ebece4', 'rgba(69,78,59,.15)'], 'D-UI-2 amendé (fidélité aux maquettes, 28 octobre) : --action, --action-2, --action-bg et --tap sont l’olive sombre échantillonnée sur les maquettes (§ 3.1)');
    // Ronde 1 (M11) : « les 25 autres : inchangés » (§ 3.1) — theme.js n’en épingle que sept par valeur ; les 35 autres déclarations de :root (34, puis --radius-btn des maquettes) le sont ici, une à une, dans l'ordre.
    eq(Object.fromEntries(Object.entries(jetons).filter(([k]) => !['--action', '--action-2', '--action-bg', '--tap'].includes(k))), { '--paper': '#f8f5ef', '--paper-2': '#f1ece3', '--card': '#fffdf9', '--ink': '#242821', '--muted': '#636860', '--line': '#e4dfd5', '--field-line': '#8f8a80', '--accent': '#45604a', '--accent-2': '#55705a', '--accent-bg': '#e4ebe2', '--warn': '#8b5f10', '--warn-bg': '#fbf1dc', '--warn-line': '#ead9b3', '--danger': '#9c2f22', '--danger-bg': '#f9e4df', '--danger-line': '#e9bfb6', '--ok': '#3d6b4a', '--ok-bg': '#e2efe4', '--backdrop': 'rgba(36,40,33,.45)', '--radius': '12px', '--radius-pill': '999px', '--shadow': '0 1px 2px rgba(36,40,33,.05), 0 8px 24px rgba(36,40,33,.06)', '--serif': 'ui-serif, "New York", "Iowan Old Style", Georgia, "Times New Roman", serif', '--radius-btn': '8px', '--sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', '--topbar-h': '64px', '--nav-h': 'max(64px, 4.5rem)', '--safe-b': 'env(safe-area-inset-bottom, 0px)', '--safe-t': 'env(safe-area-inset-top, 0px)', '--cream': 'var(--paper)', '--cream-2': 'var(--paper-2)', '--green': 'var(--accent)', '--green-2': 'var(--accent-2)', '--sage': '#b9c8bb', '--sage-2': 'var(--accent-bg)' }, 'D-UI-2 / § 3.1 : les 35 autres déclarations de :root, une à une (fidélité aux maquettes, 28 octobre : --serif passe aux serifs du système, New York d’abord ; --radius-btn neuf, 8 px ; L0 : navigation adaptée au texte agrandi ; le reste inchangé)');
    const c =(a, b) => Number(contraste(hex(a), hex(b)).toFixed(2));
    eq([c('--action', '--paper'), c('--action', '--card'), c('--action', '--accent-bg'), c('--action', '--paper-2'), c('--action-2', '--paper'), c('--muted', '--action-bg'), c('--action', '--action-bg'), c('--warn', '--action-bg')], [8.02, 8.59, 7.18, 7.42, 10.35, 4.8, 7.34, 4.72], 'D-UI-2 amendé (olive sombre des maquettes) : les huit contrastes de § 3.1, recalculés par la formule de theme.js (olive sur papier, carte, accent-bg et paper-2 ; survol sur papier ; gris, olive et ambre sur action-bg)');
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
    eq([regle('h1')?.['font-size'], regle('h1.titre-fiche')?.['font-size'], R.filter((r) => r.sel === 'h1' && r.media).length, regle('h2')?.['font-size'], regle('h3')?.['font-size'], regle('header.stack h1 + p.muted')?.['font-size']], ['clamp(2.1rem, 8.5vw, 3.2rem)', 'clamp(2.2rem, 11vw, 3.4rem)', 0, '1.6rem', '1.15rem', '1.25rem'], 'D-UI-3 / § 3.2 / H-6, amendé par la fidélité aux maquettes : UNE formule clamp() par titre (plus grands, graisse 400), plus aucune règle h1 sous @media ; h2 1,6 rem, h3 1,15 rem, sous-titre de page serif à 1,25 rem');
    eq(regle('h1, h2, h3, h4')?.['font-weight'], '400', 'fidélité aux maquettes : titres serif en graisse 400 (plus fins)');
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
      eq([taille(tete.querySelector('h1')), taille(fiche.querySelector('h1'))], [clamp(33.6, 8.5, 51.2), clamp(35.2, 11, 54.4)], `D-UI-3 amendé (maquettes) : h1 de page = clamp(2.1rem, 8.5vw, 3.2rem), h1.titre-fiche = clamp(2.2rem, 11vw, 3.4rem), mesurés à ${window.innerWidth} px de fenêtre`);
      const h2 = el('h2', null, 'Ingrédients'); const h3 = el('h3', null, 'Titre'); scene.append(h2, h3);
      eq([taille(h2), taille(h3), taille(tete.querySelector('p.muted'))], [25.6, 18.4, 20], '§ 3.2 : h2 1,6 rem, h3 1,15 rem, sous-titre de pageHeader 1,25 rem (maquettes ; mesurés, racine 16 px)');
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
    const SITES = { 'library.js': ['assiette', 'livres'], 'grocery.js': ['panier'], 'meals.js': ['couverts', 'salade'], 'kitchen.js': ['flocon', 'toque'], 'dish.js': ['assiette'], 'bibliotheque-liste.js': ['livre-ouvert'], 'search.js': ['loupe'], 'import.js': ['appareil-photo'] };
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
    const app = sansCommentaires(await lire('../src/ui/coquille.js')); // fidélité aux maquettes : NAV et la barre vivent dans coquille.js (montée plus bas)
    const nav = [...app.matchAll(/\{ href: '([^']+)', label: '([^']+)', ico: '([^']+)'/g)].map((m) => m.slice(1, 4));
    const corpsNavLinks = /\nexport function navLinks\([^)]*\) \{\n([\s\S]*?)\n\}\n/.exec(app)?.[1] || '';
    eq([nav, app.includes("from './icones.js'"), corpsNavLinks.includes('icone(n.ico)'), /,\s*n\.ico\s*\)/.test(corpsNavLinks), /el\('a', \{ href: '#\/settings'[^}]*\}, el\('span', \{ class: 'ico', 'aria-hidden': 'true' \}, icone\('roue'\)\)/.test(app), app.includes('Mes livres'), /ico: '[^a-z]/.test(app)], [[['/', 'Aujourd’hui', 'soleil'], ['/library', 'Bibliothèque', 'bibliotheque'], ['/meals', 'Ma semaine', 'calendrier'], ['/kitchen', 'Ma cuisine', 'toque'], ['/add', 'Ajouter', 'plus']], true, true, false, true, false, false], 'D-UI-4 / D-UI-9 : NAV = cinq entrées, libellé « Bibliothèque », des noms d’icônes du jeu (plus un émoji) ; navLinks rend icone(n.ico), jamais le nom brut ; la roue est icone(\'roue\') dans le lien #/settings — de la barre haute depuis la fidélité aux maquettes : le panneau latéral est devenu une rangée d’onglets (source relu sans commentaires : app.js est hors suite, § 11)');
    // Vague finale (constat 15) : le segment « Mes livres » de la RECHERCHE (une portée, pas l'écran) est lu dans son RENDU — renderSearch en mode « books », sans
    // base, sans réseau (le mode web seul lit une session) —, plus dans le source ; l'état vide rendu porte l'icône « loupe » (R-UI-P1 : la ligne de UI-2,
    // '🔍', ferait lever icone() et planter l'écran). Les retours « ← Bibliothèque » (recipe.js, book.js) et « Aller à la bibliothèque. » (accueil-livre.js)
    // sont tenus par des rendus (T3, T4, bloc suivant) : leurs regex de source sont retirées.
    const { renderSearch } = await import('../src/ui/search.js');
    const { setUiLocale: localeS, getUiLocale: lireLocaleS } = await import('../src/core/i18n.js');
    const localeAvantS = lireLocaleS(); localeS('fr');
    let recherche = null;
    try { recherche = await renderSearch({}, { mode: 'books' }, { docs: [], docsByRecipe: new Map(), ingredientsById: new Map(), meal_feedback: [] }, { remplacerAdresse: () => {}, navigate: () => {} }); }
    catch (e) { recherche = e; } finally { localeS(localeAvantS); }
    const rechercheRendue = recherche instanceof Node ? recherche : null;
    eq([rechercheRendue ? [...rechercheRendue.querySelectorAll('.segmented button')].map((b) => b.textContent) : String(recherche), rechercheRendue?.querySelector('.segmented button.active')?.textContent ?? null,
      !!rechercheRendue?.querySelector('.empty .ico svg.icone.icone-loupe'), rechercheRendue?.querySelector('.empty p')?.textContent ?? null],
      [['Mes recettes', 'Mes livres', 'Web', 'Tout'], 'Mes livres', true, 'Aucune recette admissible.'],
      'D-UI-4 / R-UI-P1 (rendu) : la recherche garde son segment « Mes livres » (une portée de recherche, pas l’écran Bibliothèque), actif en mode books ; son état vide porte l’icône « loupe » au trait');
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
          const img = avec.querySelector('img');
          eq([avec.tagName, avec.className, avec.querySelector('h3 a')?.getAttribute('href'), img?.tagName, img?.className, img?.getAttribute('alt'), img?.getAttribute('loading'), img?.getAttribute('src')?.startsWith('blob:'), avec.querySelector(':scope > .carte-plat-corps > h3')?.textContent, avec.querySelectorAll('img').length],
            ['ARTICLE', 'item-link carte-plat', '#/recipes/rc_a', 'IMG', 'plat-vignette', '', 'lazy', true, 'Plat rc_a', 1],
            'carte-plat avec octets image : a.item-link.carte-plat > .carte-photo img.plat-vignette (alt vide, lazy, src blob:) puis le bloc de titre — décidé AU RETOUR de l’appel, sans attendre');
          // Ajout de l’implémenteur (T2) : la carte n’a pour enfants que l’img (quand il y en a une), le bloc de titre, puis `extra` quand il est donné — un `extra`
          // nul n’ajoute rien (Element.append(null) écrirait le texte « null » sous chaque carte de la grille).
          const extraT2 = document.createElement('span');
          eq([[...avec.childNodes].map((x) => x.nodeName), [...K.recipeCard(doc, { photoEnTete: true }).childNodes].map((x) => x.nodeName), [...K.recipeCard(doc, { photoEnTete: true, extra: extraT2 }).childNodes].map((x) => x.nodeName), avec.textContent.includes('null')],
            [['DIV', 'DIV'], ['DIV', 'DIV'], ['DIV', 'DIV', 'SPAN'], false], 'carte-plat : ses enfants sont [img], le bloc de titre, puis extra s’il est donné — jamais un nœud texte « null » pour un extra absent');
          const corps = (c) => c.querySelector(':scope > .carte-plat-corps');
          // text/html : mime ET blob — typeAffichage (lot G, F-9, mime.js:28-31) rend le type du blob s'il est admis, SINON celui de la ligne : un blob text/html sous
          // un mime image/jpeg est affiché jpeg (règle épinglée par le lot G, jamais touchée ici) ; ses octets indécodables suivent le chemin asynchrone testé plus bas.
          const SANS = [['aucune ligne files', null], ['ligne sans blob (octets pas ici)', { sha256: H('a'), mime: 'image/jpeg' }], ['text/html (mime et blob : hors liste)', ligneFichier(H('a'), new Blob(['<p>x</p>'], { type: 'text/html' }))],
            ['PDF (liste blanche, pas une image)', ligneFichier(H('a'), new Blob(['%PDF-1.4'], { type: 'application/pdf' }))], ['SVG (hors liste, blob et mime)', ligneFichier(H('a'), new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'image/svg+xml')]];
          eq(SANS.map(([nom, f]) => { const c = K.recipeCard(doc, { photoEnTete: true, fichier: f }); return [nom, c.className, c.querySelectorAll('img').length, !!corps(c), c.querySelector('h3')?.textContent]; }),
            SANS.map(([nom]) => [nom, 'item-link carte-plat', 0, true, 'Plat rc_a']),
            'carte-plat sans octets affichables (aucune ligne, pas de blob, text/html, PDF, SVG) : a.item-link.carte-plat.sans-photo, le bloc de titre, AUCUNE img — jamais de cadre vide ni d’image générique (I-UI-5)');
          const heic = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg, 'image/heic') });
          eq([heic.className, heic.querySelector('.carte-photo img.plat-vignette')?.getAttribute('src')?.startsWith('blob:')], ['item-link carte-plat', true], 'carte-plat : une ligne image/heic dont le blob est image/jpeg s’affiche (le type du blob, dans la liste blanche, gagne — G, F-9)');
          // H-10 : la variante ne rend PAS vignettePlat et ne lit rien elle-même — un pointeur valide sans `fichier` ne fait ni img cachée ni getFile.
          const muette = K.recipeCard(doc, { photoEnTete: true, fichier: null });
          await tick(); await tick();
          eq([muette.querySelectorAll('img').length, [...new Set(lectures)]], [0, [H('a')]], 'carte-plat : lot visuel : pointeur sans ligne → aucune image fabriquée, seules ses métadonnées sont relues localement');
          // Des octets image/jpeg que le navigateur ne décode pas : l'img est retirée, la carte retombe sans photo, l'URL blob: révoquée (jamais un cadre d'image cassée).
          const faux = K.recipeCard(doc, { photoEnTete: true, fichier: ligneFichier(H('a'), new Blob(['pas une image'], { type: 'image/jpeg' })) });
          const u = faux.querySelector('img')?.getAttribute('src');
          eq(typeof u === 'string' && u.startsWith('blob:'), true, 'carte-plat : des octets image/jpeg indécodables ont d’abord une img (le type est admis : la décision est synchrone)');
          scene.append(faux);
          await attendre(() => faux.querySelector('[role=status]')?.textContent.includes('ne peut pas être affichée'), 'octets indécodables : état explicite');
          eq([faux.querySelectorAll('img').length, !!corps(faux), BU.revoquerUrlDeBlob(u)], [0, true, false], 'carte-plat : au décodage raté, l’img est retirée, la carte passe .sans-photo avec son bloc de titre, et son URL blob: est déjà révoquée (revoquerUrlDeBlob rend false)');
          eq(K.recipeCard(doc).className, 'item-link card', 'recipeCard sans photoEnTete : la carte horizontale d’avant, inchangée (épinglée par tests/photo-plat.js)');
          const g = K.grilleCartes([avec, heic]);
          eq([g.tagName, g.className, [...g.children].map((c) => c.querySelector('h3 a')?.getAttribute('href'))], ['DIV', 'grille-plats', ['#/recipes/rc_a', '#/recipes/rc_a']], 'grilleCartes(noeuds) → div.grille-plats portant ses cartes, dans l’ordre');
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
          [35, null, null, null, null, 5, null, null, null],
          'dureeTotale : total_minutes d’abord, sinon prep + cook quand les DEUX sont connus (T3-R1 : une seule partie ne fait pas une durée ; une cuisson de 0 est connue), sinon null ; une création IA n’a pas de durée (C-6) ; une valeur non numérique vaut null');
        eq([source(web), source(duLivre), source(sansDuree), source(signet), source(ia), source(main)],
          ['recettes.test', 'Le livre — A.', 'Le livre — A.', 'a.test', 'Créée avec l’IA', 'Recette de famille'],
          'ligne de source (fidélité aux maquettes, 28 octobre) : « Du web » ou « De mon livre » — ni hôte ni titre de livre sur la carte —, puis « · {durée} » en UN nombre (formatMinutes) seulement quand une durée existe ; un signet non lu n’a pas de durée ; une fiche IA ou personnelle garde sa provenance');
        eq(K.ligneSource(docDe(fiche('rc_x', { source_url: 'pas une adresse' }))), 'Adresse non reconnue', 'ligneSource : une adresse illisible le dit (lienSignet), jamais le source_label stocké (S7)');
        // Ajout de l’implémenteur (T2, survivant M7 : source_label lue avant l’hôte) : une source_label stockée ne remplace ni l’hôte recalculé ni le livre.
        eq([K.ligneSource(docDe(fiche('rc_y', { source_url: 'https://vrai.test/p', source_label: 'Faux site' }))), K.ligneSource(docDe(fiche('rc_z', { edition_id: 'e1', source_label: 'Faux livre' }), { book: livre, edition: ed }))],
          ['Du web', 'De mon livre'], 'ligneSource : une source_label stockée ne s’affiche jamais (S7) : la carte dit « Du web » ou « De mon livre » — elle ne vaut que pour une fiche sans adresse ni livre');
        // Ronde 1 (C-2) : une fiche créée avec l'assistant le dit d'abord — une adresse ou un livre portés par une fiche reçue ou restaurée ne prennent pas sa place.
        eq([K.ligneSource(docDe(fiche('rc_ia1', { origine: 'ia', source_url: 'https://evil.test/p' }))), K.ligneSource(docDe(fiche('rc_ia2', { origine: 'ia', edition_id: 'e1' }), { book: livre, edition: ed }))],
          ['Créée avec l’IA', 'Créée avec l’IA'], 'ligneSource : une fiche IA qui porte une adresse ou un livre dit « Créée avec l’IA » (C-2, comme provenanceText), jamais l’hôte ni le livre');
        // Ronde 1 : seule une durée STRICTEMENT positive compte (« PT0S » d'un JSON-LD, une valeur négative tapée dans l'éditeur).
        eq([K.dureeTotale(version('x', { total_minutes: 0 })), K.dureeTotale(version('x', { total_minutes: 0, prep_minutes: 10 })), K.dureeTotale(version('x', { prep_minutes: -30, cook_minutes: 10 })), K.dureeTotale(version('x', { prep_minutes: -30, cook_minutes: 0 })),
          K.ligneSource(docDe(fiche('rc_0', { source_url: 'https://site.test/r' }), { version: version('rc_0', { total_minutes: 0 }) }))],
          [null, null, null, null, 'Du web'], 'dureeTotale : un total nul ou négatif vaut null (il retombe sur prep + cook) ; une partie négative est inconnue, et une seule partie connue ne fait pas une durée (T3-R1) ; une somme nulle vaut null ; la carte ne dit jamais « · 0 min » ni une durée négative');
        eq([K.dureeTotale(version('x', { total_minutes: 0, prep_minutes: 10, cook_minutes: 0 })), K.dureeTotale(version('x', { total_minutes: -5, prep_minutes: 10, cook_minutes: 20 }))], [null, null],
          'Lot visuel : un total nul ou négatif reste inconnu, aucune somme préparation + cuisson');
        const badges = (d) => [...K.recipeCard(d, { photoEnTete: true }).querySelectorAll('.carte-plat-corps > .carte-plat-badges > *')].map((b) => b.textContent);
        // Le badge de disponibilité est celui d'availabilityBadge, lu par le composant lui-même (« Recette disponible » aujourd'hui, « Disponible » dès T5, D-UI-10) :
        // ce test tient la CARTE (ordre et présence des badges), jamais le libellé — qui est à T5 (rév. 2).
        // Fidélité aux maquettes (28 octobre) : l'état ORDINAIRE (« Disponible ») n'est plus montré sur la carte ; un état qui dit quelque chose (« Partielle ») reste.
        const partielle = K.availabilityBadge(fiche('rc_p', { availability: 'partial' })).textContent;
        eq([badges(signet), badges(docDe(fiche('rc_f', { favorite: true }), { cooked: 3 })), badges(web), badges(ia), badges(docDe(fiche('rc_p', { availability: 'partial' })))],
          [['Lien web'], ['★ Favori', 'Cuisinée 3×'], [], ['Créée avec l’IA · non testée'], [partielle]],
          'carte-plat : les badges restent dans la carte, sous la ligne de source — « Lien web » pour un signet, le badge de disponibilité SEULEMENT quand il dit quelque chose (« Partielle » ; « Disponible », l’état ordinaire, n’est plus montré : maquettes), ★ Favori, « Cuisinée {n}× », l’étiquette IA');
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
            const g = K.grilleCartes([K.recipeCard({ ...web, recipe: { ...web.recipe, photo_sha256: H('a') } }, { photoEnTete: true, fichier: ligneFichier(H('a'), jpeg) }), K.recipeCard(duLivre, { photoEnTete: true }), K.recipeCard(sansDuree, { photoEnTete: true }), K.recipeCard(signet, { photoEnTete: true })]);
            // Le cadre est hors écran : une img lazy n'y chargerait jamais. La scène (pas le composant) la passe en eager et attend son décodage, borné à 3 s.
            for (const i of g.querySelectorAll('img')) i.loading = 'eager';
            d.querySelector('main').append(g); // adopté par le document du cadre : la feuille du cadre s'applique
            const decodee = await Promise.race([g.querySelector('.carte-photo img.plat-vignette').decode().then(() => true, () => false), new Promise((ok3) => setTimeout(() => ok3(false), 3000))]);
            const cs = w.getComputedStyle(g);
            const pistes = cs.gridTemplateColumns.trim().split(/\s+/);
            const img = g.querySelector('.carte-photo img.plat-vignette'); const r = img.getBoundingClientRect();
            const corps = g.querySelector('.carte-plat.sans-photo > .carte-plat-corps'); const cc = w.getComputedStyle(corps);
            const h3 = w.getComputedStyle(g.querySelector('.carte-plat h3'));
            const cartes = [...g.children].map((c) => Math.round(c.getBoundingClientRect().height));
            eq([largeur, decodee, img.naturalWidth, img.naturalHeight, cs.display, pistes.length, cs.columnGap, cs.alignItems, Math.abs(r.width / r.height - 8 / 5) < 0.02, w.getComputedStyle(img).objectFit, w.getComputedStyle(img).borderRadius, cc.minHeight, cc.backgroundColor, cc.borderRadius, h3.fontSize, /georgia/i.test(h3.fontFamily), cartes.slice(0, colonnes).every((h) => h === cartes[0])],
              [largeur, true, 48, 64, 'grid', colonnes, '19.2px', 'stretch', true, 'cover', '12px 12px 0px 0px', '112px', 'rgb(241, 236, 227)', '12px', '21.6px', true, true],
              `styles.css à ${largeur} px : .grille-plats = grid à ${colonnes} colonnes, gap 1.2rem, align-items stretch ; l’image 8:5 (maquettes ; une photo PORTRAIT 48 × 64 décodée : le ratio vient de la règle), recadrée, rayon 12 ; le bloc sans photo ≥ 7 rem (112 px) sur --paper-2 (#f1ece3), rayon 12 ; h3 serif 1,35 rem ; les cartes d’une même rangée ont la même hauteur (mesurés)`);
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
        const titres = (r) => [...r.querySelectorAll('.bibliotheque-item h3')].map((h) => h.textContent);
        const source = (r,v) => r.querySelector(`input[name=sources][value=${v}]`);
        const cocher = n => {n.checked=!n.checked;n.dispatchEvent(new Event('change',{bubbles:true}));};
        const attendreListe = r => r.querySelector('.bibliotheque-resultats').attendreAffichage();
        const n = await renderLibrary({}, {}, ctx, fauxMatchMedia(false));
        const fragments = []; const geste = () => fragments.push(location.hash);
        eq([texte(n.querySelector('header h1')), texte(n.querySelector('header p.muted')), [...n.querySelectorAll('.segmented button')].map(b=>b.textContent),segment(n),action(n),titres(n)],
          ['Bibliothèque','Tes livres, tes trouvailles, tes recettes.',['Recettes','Livres','Plats'],'Recettes',['btn primary','#/add','Ajouter une recette'],['Plat rD','Plat rF','Plat rE','Plat rB','Plat rC','Plat rA']], 'L3 bibliothèque : titres, segments, action et références incluses dans ordre réel');
        eq([n.querySelector('.segmented').classList.contains('onglets'),!!n.querySelector('.filtre-recettes > label.champ-recherche > input'),!!n.querySelector('.champ-recherche .icone')],[true,true,true],'L3 bibliothèque : recherche avec loupe et filtres nommés');
        const carteE=n.querySelector('article:has(h3 a[href="#/recipes/rE"])');
        eq([texte(carteE?.querySelector('.muted')),texte(carteE?.querySelector('.badge')),texte(n.querySelector('article.carte-plat:has(h3 a[href="#/recipes/rC"]) .carte-plat-source'))],['web.test','Lien web','Le livre — A. · web.test'],'L3 : provenance réelle et signet conservés');
        cocher(source(n,'livres'));await attendreListe(n);geste();eq(titres(n),['Plat rD','Plat rF','Plat rC','Plat rA'],'L3 : livre contient recettes et références');
        cocher(source(n,'web'));await attendreListe(n);geste();eq(titres(n),['Plat rD','Plat rF','Plat rE','Plat rB','Plat rC','Plat rA'],'L3 : union sources livre et web');
        cocher(source(n,'livres'));await attendreListe(n);geste();eq(titres(n),['Plat rE','Plat rB','Plat rC'],'L3 : source web réelle y compris livre');
        cocher(source(n,'web'));await attendreListe(n);
        const champ=n.querySelector('input[name=q]');
        const taper=async(q)=>{champ.value=q;champ.dispatchEvent(new Event('input',{bubbles:true}));await attendreListe(n);geste();return titres(n);};
        eq([champ.placeholder,champ.getAttribute('aria-label'),await taper('rb'),await taper('Pomme'),await taper('le livre'),await taper('')],['Une recette, un ingrédient…','Une recette, un ingrédient…',['Plat rB'],['Plat rB','Plat rC','Plat rA'],['Plat rD','Plat rF','Plat rC','Plat rA'],['Plat rD','Plat rF','Plat rE','Plat rB','Plat rC','Plat rA']],'L3 : texte titre ingrédient livre sans appel');
        eq(fragments,Array(7).fill(hashT2),'L3 : filtres locaux sans navigation');
        eq(n.querySelector('a[data-role=a-importer]'),null,'L3 : références directement visibles, pas de pied séparé');
        const sansRef=await renderLibrary({}, {}, ctxDe([A,B],{versions:[version('rA')],editions:[ed],books:[livre]}),fauxMatchMedia(false));
        eq(titres(sansRef).length,2,'L3 : aucune référence inventée');
        const livres=await renderLibrary({},{tab:'books'},ctx,fauxMatchMedia(false)),plats=await renderLibrary({},{tab:'dishes'},ctx,fauxMatchMedia(false));
        const recettes=await renderLibrary({},{tab:'recettes'},ctx,fauxMatchMedia(false)),inconnu=await renderLibrary({},{tab:'zzz'},ctx,fauxMatchMedia(false));
        eq([segment(livres),action(livres),!!livres.querySelector('.grid.livres'),!!livres.querySelector('.grille-plats'),segment(plats),action(plats),segment(recettes),segment(inconnu),titres(inconnu).length],['Livres',['btn primary','#/add/livre','Ajouter un livre'],true,false,'Plats',['btn','#/corbeille','Corbeille'],'Recettes','Recettes',6],'L3 : segments historiques et défaut conservés');
        eq([[...livres.querySelectorAll('section.plain > h2')].map(h=>h.textContent),livres.querySelectorAll('section.card').length],[[],0],'L3 : Livres contient uniquement éditions');
        // Le bouton mobile : a.btn.primary.big.block « Ajouter une recette » sous la grille, [hidden] ≥ 760 px (matchMedia injecté). Ronde 1 : l'abonnement à
        // `change` attend le MONTAGE (setTimeout 0 puis isConnected : app.js monte la route juste après son rendu) et il n'y en a jamais qu'UN dans l'app (le rendu
        // monté retire celui du précédent) — le MediaQueryList ne retient aucun rendu détaché (constat de la revue : N rendus, N écouteurs, N arbres retenus).
        const mm = fauxMatchMedia(true);
        const bouton = (r) => r.querySelector('a[data-role="ajouter-mobile"]');
        const nonMonte = await renderLibrary({}, {}, ctx, mm);
        await tick(); await tick();
        eq([bouton(nonMonte)?.className, bouton(nonMonte)?.getAttribute('href'), bouton(nonMonte)?.textContent, bouton(nonMonte)?.hidden, bouton(n)?.hidden, !!(nonMonte.querySelector('.grille-plats').compareDocumentPosition(bouton(nonMonte)) & Node.DOCUMENT_POSITION_FOLLOWING),
          bouton(nonMonte)?.parentElement === nonMonte, mm.ecouteurs.length],
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
        const vide=await renderLibrary({},{},ctxDe([D,F],{editions:[ed],books:[livre]}),fauxMatchMedia(false));
        eq([!!vide.querySelector('.empty'),titres(vide)], [false,['Plat rD','Plat rF']],'L3 : une bibliothèque de références reste une bibliothèque');
        const ai=await renderLibrary({},{tab:'a-importer'},ctx,fauxMatchMedia(false));
        eq([segment(ai),titres(ai),source(ai,'livres').checked,ai.querySelector('input[name=disponibilites][value=reference_only]').checked],['Recettes',['Plat rD','Plat rF'],true,true],'L3 : ancienne adresse applique filtre références de livres');
        const G=fiche('rG',{edition_id:'e1',availability:'reference_only',source_url:'https://web.test/g',printed_page:12});
        const avecG=await renderLibrary({},{tab:'a-importer'},ctxDe([D,G],{editions:[ed],books:[livre]}),fauxMatchMedia(false));
        const seulG=await renderLibrary({},{},ctxDe([G],{editions:[ed],books:[livre]}),fauxMatchMedia(false));
        eq([titres(avecG),titres(seulG)],[['Plat rD','Plat rG'],['Plat rG']],'L3 : référence web rangée dans livre visible dans filtre référence');
        const livreZ={id:'bz',title:'Zeste'},edZ={id:'ez',book_id:'bz'},livreA={id:'ba',title:'Agrumes'},edA={id:'ea',book_id:'ba'};
        const ref=(id,editionId,titre,page=null)=>fiche(id,{edition_id:editionId,availability:'reference_only',original_title:titre,printed_page:page});
        const ordre=await renderLibrary({},{tab:'a-importer',tri:'titre'},ctxDe([ref('z1','ez','Agneau',90),ref('z2','ez','Zucchini',12),ref('z3','ez','Tarte'),ref('z4','ez','Brioche'),ref('a1','ea','Citron',40),ref('a2','ea','Orange',5)],{editions:[edZ,edA],books:[livreZ,livreA]}),fauxMatchMedia(false));
        eq(titres(ordre),['Agneau','Brioche','Citron','Orange','Tarte','Zucchini'],'L3 : tri titre stable références de plusieurs livres');
        const livre42={id:'b42',title:42},ed42={id:'e42',book_id:'b42'};
        const ctx42=ctxDe([ref('n2','ea','Citron','12'),ref('n3','ea','Orange',5),ref('n1','e42','Nougat','x'.repeat(5000))],{editions:[edA,ed42],books:[livreA,livre42]});
        const ai42=await renderLibrary({},{tab:'a-importer'},ctx42,fauxMatchMedia(false)),livres42=await renderLibrary({},{tab:'books'},ctx42,fauxMatchMedia(false));
        eq([titres(ai42),[...livres42.querySelectorAll('.cover .title')].map(texte),ai42.textContent.includes('x'.repeat(50)),ai42.textContent.includes('p. 5')],[['Citron','Nougat','Orange'],['42','Agrumes'],false,true],'L3 : titre numérique sûr et pages hostiles absentes');
        const O=fiche('rO',{availability:'reference_only'}),avecO=await renderLibrary({},{tab:'a-importer'},ctxDe([D,O],{editions:[ed],books:[livre]}),fauxMatchMedia(false)),seulO=await renderLibrary({},{},ctxDe([A,O],{versions:[version('rA')],editions:[ed],books:[livre]}),fauxMatchMedia(false)),rien=await renderLibrary({},{tab:'a-importer'},ctxDe([A],{versions:[version('rA')],editions:[ed],books:[livre]}),fauxMatchMedia(false));
        eq([titres(avecO),titres(seulO),texte(rien.querySelector('.empty p'))],[['Plat rD'],['Plat rO','Plat rA'],'Aucune recette ne correspond.'],'L3 : référence sans livre visible et filtre livres strict');
        // Ronde 1 : le repli created_at du tri (une fiche sans updated_at se range par sa création ; sans horodatage, en dernier) ; le filtre lit display_title.
        const R1 = fiche('rR1', { updated_at: null, created_at: '2026-10-25T00:00:00.000Z' }); const R2 = fiche('rR2', { updated_at: null, created_at: null });
        const R3 = fiche('rR3', { display_title: 'Gâteau renommé' }); const R4 = fiche('rR4', { updated_at: '2026-10-24T00:00:00.000Z' });
        const tri = await renderLibrary({}, {}, ctxDe([R2, R3, R1, R4]), fauxMatchMedia(false));
        const triInitial = titres(tri);
        const champTri = tri.querySelector('.filtre-recettes input[type="search"]'); champTri.value = 'Renommé'; champTri.dispatchEvent(new Event('input', { bubbles: true }));
        try { await attendre(() => titres(tri).length === 1, 'filtre « Renommé »'); } catch { /* lu tel quel */ }
        eq([triInitial, titres(tri)], [['Plat rR1', 'Plat rR4', 'Gâteau renommé', 'Plat rR2'], ['Gâteau renommé']],
          'tri de la grille : updated_at, sinon created_at (R1, créée le 25, d’abord), sans horodatage en dernier (R2) ; le filtre trouve un titre renommé (display_title), casse ignorée');
        // Vague finale (constat 4) : un filtre (ou une puce) qui ne retient rien le DIT — comme « Aucun livre ne correspond. » sous Livres —, jamais une grille blanche
        // qu'on ne distingue pas d'un chargement ; le message part au filtre suivant qui retient des cartes.
        champTri.value = 'introuvable'; champTri.dispatchEvent(new Event('input', { bubbles: true }));
        try { await attendre(() => titres(tri).length === 0 && !!tri.querySelector('[data-role="aucune-correspondance"]'), 'filtre « introuvable »'); } catch { /* lu tel quel */ }
        const aucune = tri.querySelector('[data-role="aucune-correspondance"]');
        const [rienTexte, rienClasse, rienDansGrille] = [texte(aucune?.querySelector('p')), aucune?.className ?? null, aucune?.parentElement === tri.querySelector('.grille-plats')];
        champTri.value = ''; champTri.dispatchEvent(new Event('input', { bubbles: true }));
        try { await attendre(() => titres(tri).length === 4, 'filtre vidé'); } catch { /* lu tel quel */ }
        eq([rienTexte, rienClasse, rienDansGrille, tri.querySelector('[data-role="aucune-correspondance"]'), titres(tri).length],
          ['Aucune recette ne correspond.', 'empty', false, null, 4],
          'grille (vague finale) : un filtre qui ne retient rien dit « Aucune recette ne correspond. » (p.muted dans la grille), et le message part quand le filtre est vidé');
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
          const cartes = () => [...n.querySelectorAll('.grille-plats article.carte-plat')];
          const voirPlus = () => [...n.querySelectorAll('button')].find((b) => b.textContent === 'Voir plus') || null;
          const srcs = () => cartes().map((c) => c.querySelector('.carte-photo img.plat-vignette')?.getAttribute('src'));
          eq([cartes().length, lectures.length, new Set(lectures).size, cartes()[0]?.querySelector('h3')?.textContent, cartes()[59]?.querySelector('h3')?.textContent, srcs().every((u) => typeof u === 'string' && u.startsWith('blob:')), voirPlus()?.className, L.CARTES_PAR_PAGE],
            [60, 60, 60, 'Photo 69', 'Photo 10', true, 'btn', 60],
            '70 recettes à photo : 60 cartes rendues (les 60 dernières modifiées), EXACTEMENT 60 lectures de files en UN getFiles des cartes rendues (aucun getFile : la carte ne lit rien), chaque carte avec son image ; « Voir plus » (button.btn) offert ; CARTES_PAR_PAGE = 60');
          const empreintesInitiales = new Set(lectures);
          voirPlus().click();
          await attendre(() => cartes().length === 70, '« Voir plus » rend la suite');
          eq([[...new Set(lectures)].filter(sha => !empreintesInitiales.has(sha)).length, new Set(lectures).size, cartes()[69]?.querySelector('h3')?.textContent, voirPlus(), srcs().every((u) => typeof u === 'string' && u.startsWith('blob:'))], [10, 70, 'Photo 00', null, true],
            '« Voir plus » rend les 10 suivantes ; seules les 70 empreintes présentées sont lues, avec relecture locale des photos visibles ; plus rien à montrer : le bouton disparaît');
          // Ronde 1 : une frappe REMET la grille à 60 cartes (etat.limite revient à CARTES_PAR_PAGE) — « photo » garde les 70 : sans la remise, 70 resteraient.
          const champ = n.querySelector('.filtre-recettes input[type="search"]');
          champ.value = 'photo'; champ.dispatchEvent(new Event('input', { bubbles: true }));
          try { await attendre(() => cartes().length === 60, 'frappe « photo » après « Voir plus »'); } catch { /* lu tel quel */ }
          eq([cartes().length, voirPlus()?.className, new Set(lectures).size], [60, 'btn', 70], 'une frappe après « Voir plus » remet la grille à 60 cartes (« Voir plus » revient) et ne lit aucune empreinte supplémentaire');
          // D-T9 : un redessin (le filtre) révoque EXACTEMENT les URL des vignettes précédentes, chacune APRÈS le vidage (plus sous aucun img du document) ; les lignes files
          // gardées ne sont pas relues ; les cartes neuves ont des URL vivantes. L'espion note chaque révocation et si l'URL est encore sous un <img> à cet instant.
          const dansLeDocument = (u) => [...document.querySelectorAll('img')].some((i) => i.getAttribute('src') === u);
          URL.revokeObjectURL = (u) => { revoquees.push({ u, encore: dansLeDocument(u) }); return vraiRevoke.call(URL, u); };
          const avant = srcs();
          const sentinelle = BU.urlDeBlob(new Blob(['sentinelle']));
          champ.value = 'photo 6'; champ.dispatchEvent(new Event('input', { bubbles: true })); // « Photo 60 » à « Photo 69 »
          await attendre(() => cartes().length === 10 && revoquees.length >= avant.length, 'filtre « photo 6 » et révocations du redessin');
          eq([revoquees.map((x) => x.u).sort(), revoquees.filter((x) => x.encore).length, new Set(lectures).size, cartes().map((c) => c.querySelector('h3').textContent), srcs().every((u) => typeof u === 'string' && u.startsWith('blob:') && !revoquees.some((x) => x.u === u)), BU.revoquerUrlDeBlob(sentinelle)],
            [[...avant].sort(), 0, 70, ['Photo 69', 'Photo 68', 'Photo 67', 'Photo 66', 'Photo 65', 'Photo 64', 'Photo 63', 'Photo 62', 'Photo 61', 'Photo 60'], true, true],
            'redessin par le filtre : les URL précédentes (60) révoquées (compte exact), chacune APRÈS le vidage ; aucune empreinte supplémentaire lue ; 10 cartes neuves aux URL vivantes ; la sentinelle d’autrui reste vivante');
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
          const titres = () => [...n.querySelectorAll('.grille-plats article.carte-plat h3')].map((h) => h.textContent);
          const champ = n.querySelector('.filtre-recettes input[type="search"]');
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
          const champ = n.querySelector('.filtre-recettes input[type="search"]');
          champ.value = 'photo 0'; champ.dispatchEvent(new Event('input', { bubbles: true })); // Photo 00 à 09 : pas encore lues — la lecture est refusée
          try { await attendre(() => erreurs.length > 0 || rejets.length > 0, 'la lecture refusée est dite'); } catch { /* lu tel quel */ }
          await new Promise((r) => setTimeout(r, 50));
          eq([erreurs.filter((e) => e.includes('library.redessin')).length, rejets], [1, []], 'grille : la lecture refusée d’une frappe est journalisée (logError « library.redessin »), aucun rejet non géré');
        } finally { console.error = vraiErreur; window.removeEventListener('unhandledrejection', surRejet); delete db.getMany; BU.revoquerUrlsDeBlob(); }
      }));

      await run('en.js et filets i18n : les textes neufs de la tâche 2 (§ 5), l’interface anglaise', () => withRepo(async () => {
        const CLES = { 'Tes livres, tes trouvailles, tes recettes.': 'Your books, your finds, your recipes.', 'Recettes': 'Recipes', 'Ajouter une recette': 'Add a recipe', 'Une recette, un ingrédient…': 'A recipe, an ingredient…',
          'Toutes': 'All', 'De mes livres': 'From my books', 'Du web': 'From the web', 'Recettes de mes livres à importer': 'Recipes from my books to import', 'Voir plus': 'Show more', 'À importer': 'To import',
          'De mon livre': 'From my book', 'Aucune recette pour l’instant.': 'No recipes yet.',
          'Rien à importer pour l’instant.': 'Nothing to import for now.', // ronde 1 (D-T2-c) : l'état vide de ?tab=a-importer
          'Aucune recette ne correspond.': 'No recipes match.' }; // vague finale (constat 4) : un filtre ou une puce qui ne retient rien
        eq(Object.entries(CLES).filter(([k, v]) => EN[k] !== v).map(([k]) => k), [], 'en.js : chaque texte neuf de la tâche 2 a sa traduction exacte (§ 5)');
        const { CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
        const deComponents = ['De mon livre'];
        eq([Object.keys(CLES).filter((k) => !deComponents.includes(k) && !(CHAINES_NEUVES_AILLEURS['../src/ui/library.js'] || []).includes(k)), deComponents.filter((k) => !(CHAINES_NEUVES_AILLEURS['../src/ui/components.js'] || []).includes(k)), (CHAINES_NEUVES_AILLEURS['../src/ui/library.js'] || []).includes('Bibliothèque')],
          [[], [], true], 'filet i18n (tests/ajouter.js) : les chaînes neuves de library.js (« Bibliothèque » comprise) et de components.js sont déclarées dans CHAINES_NEUVES_AILLEURS');
        setUiLocale('en');
        try {
          // rx plus récente que ry : l'ordre attendu vient du tri, jamais de la stabilité d'Array.prototype.sort sur des dates égales (rév. 2).
          const en = await renderLibrary({}, {}, ctxDe([fiche('rx', { source_url: 'https://web.test/x', updated_at: '2026-10-24T00:00:00.000Z' }), fiche('ry', { edition_id: 'e1' }), fiche('rz', { edition_id: 'e1', availability: 'reference_only', printed_page: 3 })], { versions: [version('rx', { total_minutes: 35 }), version('ry', { prep_minutes: 5, cook_minutes: 5 })], editions: [ed], books: [livre] }), fauxMatchMedia(false));
          eq([texte(en.querySelector('header h1')),texte(en.querySelector('header p.muted')),[...en.querySelectorAll('.segmented button')].map(b=>b.textContent),[...en.querySelectorAll('fieldset input[name=sources]')].map(n=>n.parentElement.textContent),en.querySelector('input[name=q]')?.placeholder],['Library','Your books, your finds, your recipes.',['Recipes','Books','Dishes'],['From my books','From the web','Created with AI','Personal'],'A recipe, an ingredient…'],'L3 en : titres, sources et recherche traduits');
          const enAI=await renderLibrary({},{tab:'a-importer'},ctxDe([fiche('rz',{edition_id:'e1',availability:'reference_only',printed_page:3})],{editions:[ed],books:[livre]}),fauxMatchMedia(false));
          eq([texte(enAI.querySelector('header > a')),enAI.querySelector('input[name=sources][value=livres]').checked,enAI.querySelector('input[name=disponibilites][value=reference_only]').checked,texte(enAI.querySelector('.badge'))],['← Recipes',true,true,'To import · p. 3'],'L3 en : ancien lien initialise références et badge traduit');
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
      eq([tete?.classList.contains('two-col'), [...(tete?.children ?? [])].map((c) => c.dataset.role || (c.classList.contains('fiche-photo') ? 'fiche-photo' : null))], [true, ['fiche-etat', 'fiche-photo']], 'fiche T3 : .fiche-tete.two-col porte, dans cet ordre, l’état, l’emplacement de la photo, les gestes (en étroit, la photo passe avant les repères)');
      eq([q(tete, ':scope > .fiche-photo')?.contains(q(tete, '[data-role="emplacement-photo-plat"]')), !!q(tete, '[data-role="fiche-etat"] > .row .badge'), q(tete, '[data-role="fiche-etat"] > header h1.titre-fiche') !== null, avant(tete, details), avant(details, corps), details?.tagName, details?.classList.contains('card')],
        [true, false, true, true, true, 'DETAILS', false], 'fiche T3 (fidélité aux maquettes, 28 octobre) : la photo porte .fiche-photo ; une fiche ordinaire (disponible, originale) ne montre aucun badge d’état ; l’en-tête (le titre) vit dans la colonne de l’état ; .fiche-tete → details (entre deux filets, plus une carte) → .recipe-body');
      const zone = [...pL.querySelectorAll('section.card')].find((s) => titreSection(s) === 'Photo du plat');
      const original = sectionPlain(pL, 'Sources'); const versionsSec = sectionPlain(pL, 'Versions');
      const exportRow = [...pL.querySelectorAll('button')].find((b) => b.textContent === 'Exporter JSON-LD')?.closest('.row') ?? null;
      eq([avant(corps, zone), avant(zone, original), avant(original, versionsSec), avant(versionsSec, exportRow), !!exportRow, details.contains(exportRow)], [true, true, true, true, true, false], 'fiche T3 : .recipe-body → « Photo du plat » (.card) → « Original » (plain) → « Versions » (plain) → la rangée Export, hors du details (H-3)');
      eq([sectionPlain(pL, 'Ingrédients')?.dataset.role, sectionPlain(pL, 'Préparation')?.dataset.role, q(corps, '[data-role="colonnes-corps"]')?.classList.contains('two-col'), q(corps, '[data-role="colonnes-corps"]')?.children.length, [...pL.querySelectorAll('section.card')].map(titreSection)],
        ['section-ingredients', 'section-preparation', true, 2, ['Photo du plat']], 'fiche T3 : Ingrédients et Préparation en section.plain, seules dans un .two-col ; la seule section.card restante est « Photo du plat »');
      // --- Large : details ouvert, onglets cachés, les deux sections visibles
      const ongletsL = q(corps, '[data-role="onglets-corps"]');
      eq([details.open, details.querySelector('summary')?.textContent, ongletsL?.hidden, ongletsL?.classList.contains('segmented'), textes(ongletsL, 'button'), q(corps, '[data-role="section-ingredients"]').hidden, q(corps, '[data-role="section-preparation"]').hidden],
        [false, 'Portions, versions et autres gestes', true, true, ['Ingrédients', 'Préparation'], false, false], 'fiche T3 ≥ 760 px : details REPLIÉ (fidélité aux maquettes : replié à toutes les largeurs), segmented caché, Ingrédients et Préparation toutes deux visibles');
      // Fidélité aux maquettes (revue du 28 octobre) : l'étoile Favori (le mot lu, aria-pressed), les onglets soulignés du corps, et un état UTILE (« Partielle »)
      // gardé dans la rangée d'état — seul l'ordinaire (« Disponible », « Original ») est tu.
      const etoile = q(pL, '[data-role="fiche-etat"] > header button.btn.discret');
      eq([etoile?.textContent, etoile?.getAttribute('aria-pressed'), etoile?.querySelector('span.fav-libelle')?.textContent, q(corps, '[data-role="onglets-corps"]')?.classList.contains('onglets')], ['☆ Favori', 'false', ' Favori', true],
        'fiche (maquettes) : l’étoile Favori porte le mot (span.fav-libelle, caché à l’œil sous 760 px) et aria-pressed ; les onglets du corps sont soulignés (.onglets)');
      await mettre(fiche('rc_part', { availability: 'partial' })); await versions(version('rc_part'));
      const pPart = await monter('rc_part', fauxMatchMedia(true));
      eq(textes(q(pPart, '[data-role="fiche-etat"]'), ':scope > .row .badge'), ['Partielle'], 'fiche (maquettes) : une recette partielle garde son badge « Partielle » dans la rangée d’état (seul l’état ordinaire est tu ; « Original » aussi)');
      pPart.remove();
      // --- Autres gestes : TOUT l'ancien contenu de controls et de la rangée d'actions, sauf « Commencer à cuisiner » et « Corriger » (qui y reste aussi) ; pas l'Export
      const boutonsDetails = textes(details, 'button, a');
      eq(['Créer ma version', 'Corriger', '−', '+', 'Avec quoi on mange ça ?', 'Ajouter à mon repas', 'Liste d’épicerie', 'Rattacher à un plat', 'Original', 'Métrique', 'US'].filter((x) => !boutonsDetails.includes(x)), [], 'fiche T3 : « autres gestes » porte les anciens boutons de controls (versions, portions, unités) ET de la rangée d’actions');
      eq([boutonsDetails.includes('Commencer à cuisiner'), boutonsDetails.includes('Exporter JSON-LD'), boutonsDetails.includes('Exporter YAML (Paprika)'), !!q(details, '#servings-val'), q(details, '.chip.neutral')?.textContent, !!q(details, 'select'), details.querySelector('.row.between') !== null],
        [false, false, false, true, 'Rapide · V1', false, true], 'fiche T3 : ni « Commencer à cuisiner » ni l’Export dans le details ; les portions et les puces V1 y sont ; une seule version → badge, pas de select ; la .row.between (épingle creer-ia) y est');
      const gestes = q(tete, '[data-role="fiche-gestes"]'); const principal = q(gestes, '[data-role="geste-principal"]');
      const commencer = [...(principal?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Commencer à cuisiner');
      eq([commencer?.className, textes(pL, 'button').filter((x) => x === 'Commencer à cuisiner').length, q(gestes, '[data-role="corriger-tete"]')?.textContent, q(pL, '.card.sage')], ['btn primary big block', 1, 'Modifier', null], 'fiche T3 : « Commencer à cuisiner » = button.btn.primary.big.block dans les gestes de tête, une seule fois ; fiche VÉRIFIÉE → aucun « Corriger » dans l’en-tête ; plus de .card.sage');
      // --- « Corriger » visible tant que la version affichée n'est pas vérifiée (le seul geste que « — vérifie » réclame)
      await mettre(fiche('rc_nv', { verification_state: 'to_verify' }));
      await versions(version('rc_nv', { verification_state: 'to_verify', ingredients: [{ id: 'ri_nv', source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'to_verify' }] }));
      const pNV = await monter('rc_nv', fauxMatchMedia(true));
      const corriger = q(pNV, '[data-role="corriger-tete"]');
      eq([corriger?.tagName, corriger?.className, corriger?.textContent, corriger?.getAttribute('href'), q(pNV, '[data-role="geste-principal"]')?.contains(corriger), textes(q(pNV, '[data-role="autres-gestes"]'), 'a').filter((x) => x === 'Corriger').length, avant(q(pNV, '[data-role="geste-principal"] button'), corriger)],
        ['A', 'btn', 'Modifier', '#/recipes/rc_nv/edit?kind=correction&v=rv_rc_nv', true, 1, true], 'fiche T3 : version NON vérifiée → a.btn.link « Corriger » à côté (après) de « Commencer à cuisiner », même href que celui du details, qui reste');
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
      eq([onglets().hidden, ing().hidden, prep().hidden, detailsE.open, ing() !== null && ing() === q(corpsE, '[data-role="section-ingredients"]')], [true, false, false, false, true], 'fiche T3 : change → large : segmented caché, les deux sections visibles, details toujours replié (maquettes ; écouté sur change, sans redessin)');
      mmE.basculer(false);
      eq([onglets().hidden, ing().hidden, prep().hidden, detailsE.open, actif()], [false, true, false, false, ['Préparation']], 'fiche T3 : change → étroit : segmented visible, Préparation (le choix) visible, Ingrédients cachée, details fermé');
      // Revue du 28 octobre : un panneau ouvert à la main reste ouvert quand la largeur change (rien ne le replie d'office).
      detailsE.open = true; mmE.basculer(true); mmE.basculer(false);
      eq(detailsE.open, true, 'fiche (maquettes) : « autres gestes » ouvert à la main reste ouvert quand la largeur change (replié par défaut, jamais refermé d’office)');
      // Cases à cocher des ingrédients : une par ligne, dans une étiquette de 44 px, nommée par la ligne RENDUE ; cochée, elle n'écrit RIEN et survit au redessin.
      const casesE = () => [...ing().querySelectorAll('li > label.coche-cible > input.coche[type="checkbox"]')];
      const nomCase = (cs) => document.getElementById(cs.getAttribute('aria-labelledby') || '')?.textContent ?? null;
      const c0 = casesE();
      eq([c0.length, ing().querySelectorAll('li').length, c0.every((cs) => nomCase(cs) !== null && nomCase(cs) === cs.closest('li').querySelector(':scope > .row')?.textContent), c0.some((cs) => cs.hasAttribute('aria-label')), c0.every((cs) => !cs.checked)],
        [1, 1, true, false, true], 'fiche (maquettes) : une case par ligne d’ingrédient, nommée par la ligne rendue (aria-labelledby, jamais source_text), décochée au départ');
      const mutateVrai = db.mutate; let ecritures = 0;
      db.mutate = function (...a) { ecritures += 1; return mutateVrai.apply(this, a); };
      try { c0[0].click(); await macro(); } finally { db.mutate = mutateVrai; }
      [...detailsE.querySelectorAll('button')].find((b) => b.textContent === '+').click(); // drawBody : lignes et cases neuves
      const c1 = casesE();
      eq([ecritures, c1.length, c1[0] !== c0[0], c1[0]?.checked], [0, 1, true, true], 'fiche (maquettes) : cocher n’écrit rien (aucun db.mutate) ; la case cochée survit au redessin du corps (en mémoire, par fiche)');
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
      eq([nonMontee, montee, quittee, troisMontees, mmV.abonnes.size, q(derniere, '[data-role="onglets-corps"]')?.hidden], [0, 1, 0, 1, 1, true],
        'fiche T3 : un rendu jamais monté ne s’abonne pas ; une fiche montée puis quittée sans notification est retirée au change suivant ; trois fiches montées tour à tour sans change → UN abonné (le montage retire celui de la fiche précédente) ; la fiche montée suit le change');
      const mmM = fauxMatchMedia(true);
      const pM = await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour(), { matchMedia: mmM.matchMedia });
      const ongletsCachesAuRendu = q(pM, '[data-role="onglets-corps"]')?.hidden; // large au rendu : onglets cachés (le panneau des autres gestes, lui, reste replié : maquettes)
      mmM.basculer(false); // un change ENTRE le rendu et le montage
      scene.replaceChildren(pM); await macro();
      eq([ongletsCachesAuRendu, q(pM, '[data-role="autres-gestes"]')?.open, q(pM, '[data-role="onglets-corps"]')?.hidden, mmM.abonnes.size], [true, false, false, 1],
        'fiche T3 : un change reçu entre le rendu et le montage n’est pas perdu — l’abonnement, posé au montage, relit la largeur (onglets cachés au rendu large, puis visibles ; details replié) ; un abonné');
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
        ['4 portions', '1 portion', '4 portions', null, null, '2 portions'], 'Lot visuel : texteReperes ne donne que les portions ; aucune durée culinaire ne contourne le lecteur partagé');
      eq([R({ servings: '4', total_minutes: 35 }), R({ servings: 0, total_minutes: 35 }), R({ servings: 4, total_minutes: -5 }), R({ servings: 4, total_minutes: 'x' }), texteReperes(null), dureeVersion({ kind: 'synthesis', total_minutes: 30, provenance: { generated_by: 'ai', creation: { demande: 'x' } } }), dureeVersion({ kind: 'extraction', total_minutes: null, prep_minutes: 0, cook_minutes: 0 })],
        [null, null, '4 portions', '4 portions', null, '', ''], 'texteReperes / dureeVersion : portions non entières ou nulles ignorées ; durée négative, illisible ou nulle ignorée ; version nulle → null ; une création IA n’a pas de durée ici (C-6)');
      // Hors brief (EI-T3-1, survivant M18) : la fixture dictée « total 80 = 20 + 60 » ne distinguait pas « total d'abord » de « prep + cook d'abord ».
      // Ronde 1 (rien d'inventé) : une préparation connue et une cuisson INCONNUE ne font pas une durée de recette ; une cuisson nulle (0) est connue.
      eq([R({ servings: 4, total_minutes: null, prep_minutes: 20, cook_minutes: null }), R({ servings: 4, total_minutes: null, prep_minutes: null, cook_minutes: 25 }), dureeVersion({ kind: 'extraction', total_minutes: null, prep_minutes: 15, cook_minutes: 0 })],
        ['4 portions', '4 portions', ''], 'texteReperes / dureeVersion : préparation seule ou cuisson seule → aucune durée (jamais « 4 portions · 20 min » avec une cuisson inconnue) ; préparation 15 + cuisson 0 ne devient pas un total');
      eq([R({ servings: 2, total_minutes: 45, prep_minutes: 20, cook_minutes: 60 }), dureeVersion({ kind: 'extraction', total_minutes: 45, prep_minutes: 20, cook_minutes: 60 })], ['2 portions', '45 min'],
        'texteReperes / dureeVersion : total_minutes GAGNE sur prep + cook même quand ils diffèrent (45 contre 20 + 60 = 80)');
      await mettre(fiche('rc_r1'), fiche('rc_r2'), fiche('rc_r3'));
      await versions(version('rc_r1', { servings: 1, total_minutes: null, prep_minutes: 20, cook_minutes: 70 }), version('rc_r2', { servings: 4, total_minutes: null }), version('rc_r3', { servings: null, total_minutes: null }));
      scene.replaceChildren();
      const pR0 = await monter('rc_t3', fauxMatchMedia(true)); const pR1 = await monter('rc_r1', fauxMatchMedia(true)); const pR2 = await monter('rc_r2', fauxMatchMedia(true)); const pR3 = await monter('rc_r3', fauxMatchMedia(true));
      const reperes = (p) => q(p, '[data-role="reperes"]')?.textContent ?? null;
      eq([reperes(pR0), reperes(pR1), reperes(pR2), reperes(pR3), /\b(actif|total)\b/.test(q(pR0, '[data-role="fiche-gestes"]').textContent), q(pR0, '[data-role="fiche-gestes"]').contains(q(pR0, '[data-role="reperes"]')), /durée enregistrée 35 min/.test(sectionPlain(pR0, 'Ingrédients').textContent)],
        ['4 portions', '1 portion', '4 portions', null, false, true, true], 'fiche T3 : div.reperes dans les gestes de tête indique seulement les portions ; le lecteur partagé nomme la durée ancienne « durée enregistrée »');
      scene.replaceChildren();
      const pRq = await monter('rc_t3', fauxMatchMedia(true), { servings: '8' });
      eq([reperes(pRq), q(pRq, '#servings-val')?.textContent, titreSection(sectionPlain(pRq, 'Ingrédients'))], ['4 portions', '8', 'Ingrédients — recalculés pour 8 portions'], 'fiche T3 : ?servings=8 recalcule les lignes (titre d’Ingrédients, −/+) mais les repères disent la version (une donnée, jamais la valeur du −/+)');
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
      // T5 ronde 1 : une note de cuisson reçue hostile (1e9) ne fait plus lever la fiche (RangeError de '★'.repeat) — la cuisson est dite, sans étoile (etoiles).
      const pNote = await renderRecipe({ id: 'rc_t3' }, {}, await ctxPour({ cook_history: [{ id: 'ch_t3n', recipe_id: 'rc_t3', recipe_version_id: 'rv_rc_t3', cooked_at: DATE, servings: 4, rating: 1e9 }] }), { matchMedia: fauxMatchMedia(true).matchMedia });
      const memN = [...pNote.querySelectorAll('section')].find((s) => titreSection(s) === 'Mémoire culinaire') ?? null;
      eq([!!memN, memN?.textContent.includes('★'), memN?.textContent.includes('4 portions')], [true, false, true], 'fiche : une note reçue hostile (1e9) ne fait pas lever la fiche — la cuisson est dite (« 4 portions »), sans étoile (T5 ronde 1)');
      await mettre(fiche('rc_lu'));
      await versions(version('rc_lu', { provenance: { source_page_ids: [], generated_by: 'ai', model: null, edition_id: null, convention_snapshot: null, import_id: 'imp_lu', lu_le: DATE, source_url: 'https://site.test/lu', url_finale: 'https://site.test/lu', source_kind: 'jsonld', site: 'Le site' } }));
      const pLu = await renderRecipe({ id: 'rc_lu' }, {}, await ctxPour(), { matchMedia: fauxMatchMedia(true).matchMedia });
      eq([[...(q(pLu, '[data-role="fiche-etat"]')?.children ?? [])].map((c) => c.dataset.role ?? c.className), q(pLu, '[data-role="fiche-etat"]')?.children?.[1]?.querySelector('[data-role="etat-verification"]') !== null],
        [['stack', 'row', 'fiche-gestes', 'lecture-langue stack', 'resume-reperes detail', 'bandeau-web', 'bandeau-lecture'], true], 'fiche T3 / I2 : les bandeaux restent dans l’état de l’en-tête après le titre et les états ; Mes notes les suit');
      // --- Le sous-titre reste provenanceText (R-UI-P2) : « Du web · » / « De mon livre · » sont les préfixes de la CARTE-PLAT (ligneSource, T2), pas de la fiche — tests/creer-ia.js:1397 épingle « Mon livre — A. B. · page 58 » en header p.
      eq([q(pL, 'header p.muted')?.textContent, q(pH, 'header p.muted')?.textContent], ['Source personnelle', 'site.test'], 'fiche T3 : le sous-titre est provenanceText, inchangé — « Source personnelle » sans livre ni adresse, l’hôte RECALCULÉ pour une fiche web (R-UI-P2 ; § 4.2 amendé par T6)');
      // --- La photo en tête : dans la colonne photo, sans style en ligne (la feuille rend 8:5 pleine colonne)
      // Rév. 3 (ruling 17) : une image RÉELLE, 640 × 480 (4:3, PAS 8:5 ; fidélité aux maquettes du 28 octobre : la photo de tête passe de 4:3 à 8:5) — chargée avant la mesure du cadre, elle prouve que le 8:5 mesuré vient de la
      // feuille (aspect-ratio) et non de l'image : un JPEG 8:5 chargé aurait masqué le mutant « aspect-ratio retirée » (Step 10).
      const toile = new OffscreenCanvas(640, 480); toile.getContext('2d').fillRect(0, 0, 640, 480);
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
      eq([!!img, img?.getAttribute('src')?.startsWith('blob:'), img?.getAttribute('style'), q(pPh, '.fiche-photo')?.contains(img), avant(q(pPh, '[data-role="fiche-gestes"]'),img)], [true, true, null, true, true], 'fiche T3 : la photo de tête vit dans .fiche-photo, avant les gestes, sans style en ligne (plus de 320 px : la feuille rend 8:5 pleine colonne)');
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
          // chargement (eager + decode) du JPEG réel posé par repo.putFile (640 × 480, le chemin de production) ; la mesure ne dépend pas d'une boîte de
          // remplacement (`chargee` l'affirme par naturalWidth > 0). Si la mesure restait instable, elle porterait sur la figure parente (figure.photo-plat),
          // pas sur l'img. Rév. 4 (point 2) : l'attente est BORNÉE à 3 s — sans `eager`, une img lazy dans un cadre hors écran ne se charge jamais et
          // `decode()` PEND : la suite se figerait au lieu de rougir ; un rejet (indécodable) est avalé, puis `chargee` lit naturalWidth > 0 et tranche.
          if (img) { img.loading = 'eager'; await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]); }
          const rE = q(tete, '[data-role="fiche-etat"]').getBoundingClientRect(); const rP = ph.getBoundingClientRect(); const rG = q(tete, '[data-role="fiche-gestes"]').getBoundingClientRect();
          const rI = img ? img.getBoundingClientRect() : null;
          return { pistesTete: S(tete).gridTemplateColumns.trim().split(/\s+/).length, photoADroite: rP.left >= rE.right - 1 && rP.left >= rG.right - 1, photoEntre: rE.bottom <= rP.top + 1 && rG.bottom <= rE.bottom + 1,
            photoLongeGestes: rP.top <= rE.top + 1 && rP.left >= rG.right - 1, // EI-T3-2 : la photo couvre les DEUX rangées de gauche (zones), elle ne pousse pas les gestes sous elle
            chargee: img ? img.naturalWidth > 0 : null,
            imgPleine: rI ? Math.abs(rI.width - Math.min(rP.width, largeur < 760 ? 260 : 380)) < 1 : null, ratio: rI ? Math.abs(rI.width / rI.height - 1) < 0.02 : null, objectFit: img ? S(img).objectFit : null,
            onglets: S(q(p, '[data-role="onglets-corps"]')).display, prep: S(q(p, '[data-role="section-preparation"]')).display, pistesCorps: S(q(p, '[data-role="colonnes-corps"]')).gridTemplateColumns.trim().split(/\s+/).length,
            // Ronde 1 : l'écart entre l'état et les gestes (une pile, jamais un vide), la cible du summary (I-UI-4), la flèche du lien d'origine, le bouton seul plein.
            gestesDansEtat:rG.top>=rE.top-1&&rG.bottom<=rE.bottom+1, ecartEtatGestes: Math.round(rG.top - rE.top), summary: q(p, 'details[data-role="autres-gestes"] > summary').getBoundingClientRect().height, summaryDisplay: S(q(p, 'details[data-role="autres-gestes"] > summary')).display,
            fleche: q(p, '[data-role="ouvrir-lien"]') ? w.getComputedStyle(q(p, '[data-role="ouvrir-lien"]'), '::after').content : null,
            boutonPlein: (() => { const r = q(tete, '[data-role="geste-principal"]'); const b = q(r, 'button'); return !!r && !!b && [...r.querySelectorAll('a,button')].every(n=>{const z=n.getBoundingClientRect();return z.width>=44&&z.height>=44&&z.right<=r.getBoundingClientRect().right+1;}); })(),
            // Ronde 1 de T6 (constat 3) : la taille des repères, en rem de la racine du cadre (la règle `.reperes { font-size: 1.05rem }` mesurée, pas lue).
            reperesRem: (() => { const r = q(p, 'div.reperes'); return r ? Math.round((parseFloat(S(r).fontSize) / parseFloat(S(f.contentDocument.documentElement).fontSize)) * 100) / 100 : null; })() };
        } finally { f.remove(); }
      };
      const [ph1100, ph375, vide1100] = [await mesureFiche(1100, 'rc_ph'), await mesureFiche(375, 'rc_ph'), await mesureFiche(1100, 'rc_t3')];
      eq([ph1100.pistesTete, ph1100.photoADroite, ph1100.chargee, ph1100.imgPleine, ph1100.ratio, ph1100.objectFit, ph1100.onglets, ph1100.prep, ph1100.pistesCorps], [2, true, true, true, true, 'cover', 'none', 'block', 2],
        'styles.css à 1100 px (D-UI-6) : .fiche-tete en deux colonnes, la photo à droite de l’état ET des gestes (grid-template-areas), l’image RÉELLE chargée (naturalWidth > 0, 640 × 480) rendue carrée, bornée à 380 px sur ordinateur et 260 px sur mobile recadrée par la feuille ; segmented caché ([hidden]), les deux sections visibles, .recipe-body en deux colonnes (mesurés dans un cadre)');
      // Hors brief (EI-T3-2, survivant C1b) : sans les zones, l'ordre du DOM (état, photo, gestes) met déjà la photo à droite de l'état ET des gestes —
      // mais sur la première rangée seulement : les gestes tombaient sous la photo. Les zones la font longer les deux rangées de la colonne de gauche.
      eq(ph1100.photoLongeGestes, true, 'styles.css à 1100 px (D-UI-6) : la photo occupe la colonne de droite sur les DEUX rangées (« etat photo » / « gestes photo ») — elle commence à la hauteur de l’état et longe les gestes (mesuré)');
      eq([ph375.pistesTete, ph375.photoEntre, ph375.chargee, ph375.imgPleine, ph375.ratio, ph375.onglets !== 'none', ph375.prep, ph375.pistesCorps], [1, true, true, true, true, true, 'none', 1],
        'styles.css à 375 px (D-UI-6) : une colonne, la photo ENTRE l’état et les gestes (sous la provenance, maquette mobile), image réelle chargée, carrée de 260 px sur mobile ; segmented visible, Préparation cachée ([hidden]), une seule colonne de corps (mesurés)');
      // Ronde 1 : la colonne de gauche est une PILE état → gestes (D-UI-6, § 4.2) — la hauteur en trop de la photo va à la rangée des gestes, jamais entre les deux.
      ok(ph1100.gestesDansEtat && ph1100.ecartEtatGestes >= 0, `styles.css à 1100 px, avec photo : l’état et les gestes restent empilés (écart ${ph1100.ecartEtatGestes} px, attendu le gap de 16 px ; jamais le vide de la photo)`);
      const [http375, pe1100, pe375] = [await mesureFiche(375, 'rc_http'), await mesureFiche(1100, 'rc_pe'), await mesureFiche(375, 'rc_pe')];
      eq([ph375.summaryDisplay, ph1100.summaryDisplay], ['list-item', 'list-item'], 'fiche (revue du 28 octobre) : le summary de « autres gestes » reste un list-item — son triangle dit que le panneau replié s’ouvre (mesuré à 375 et 1100 px)');
      eq([http375.photoEntre, http375.fleche, http375.boutonPlein, ph375.boutonPlein, ph375.summary >= 44, ph1100.summary >= 44],
        [true, '" ↗"', true, true, true, true], 'styles.css à 375 px, fiche SANS photo : le geste Ajouter une photo reste entre l’état et les gestes de cuisine ; la flèche « ↗ » du lien d’origine vient de la feuille ; seul (fiche vérifiée), « Commencer à cuisiner » remplit sa rangée ; le summary des autres gestes fait au moins 44 px (I-UI-4)');
      eq([pe1100.chargee, pe1100.imgPleine, pe1100.ratio, pe375.chargee, pe375.imgPleine, pe375.ratio], [true, true, true, true, true, true],
        'styles.css (D-UI-6) : une photo RÉELLE plus étroite que la colonne (240 × 180) est rendue carrée, bornée à 380 px sur ordinateur et 260 px sur mobile, à 1100 comme à 375 px (mesuré)');
      eq([ph1100.reperesRem, ph375.reperesRem], [1.05, 1.05], 'styles.css (§ 4.2) : les repères de la fiche (div.reperes) à 1,05 rem, à 1100 comme à 375 px (mesuré ; ronde 1 de T6 : une règle .reperes renommée rougit ici)');
      eq([vide1100.pistesTete, vide1100.chargee, vide1100.imgPleine, vide1100.photoADroite], [2, null, null, true],'styles.css à 1100 px, fiche SANS photo : .fiche-tete:has(> .fiche-photo:empty) → deux colonnes pour conserver le geste Ajouter une photo à droite, aucune image (mesuré)');
      eq(reseau, 0, 'fiche T3 : aucun réseau');
    } finally { globalThis.fetch = vraiFetch; scene.remove(); setUiLocale(localeAvant); (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob(); }
  }));
  }

  // ===== Tâche 4 — la fiche livre (spec § 4.3, D-UI-7, D-UI-8, D-UI-10, I-UI-5 ; § 7 UI-1 T4). Un bloc : ses aides ne sortent pas d'ici.
  {
    const { withRepo } = await import('./sync-fixture.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const DATE4 = '2026-10-23T00:00:00.000Z';
    const H4 = (c) => c.repeat(64);
    // Un JPEG réel (OffscreenCanvas) : la vignette ne se décide que sur des octets d'un type d'image (I-UI-5).
    const jpegDe = async (couleur) => { const toile = new OffscreenCanvas(32, 24); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, 32, 24); return toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    // Un matchMedia factice : `matches` lisible, écouteurs de `change` tenus, `basculer(v)` les appelle ; la requête reçue est gardée (`requete`).
    const mediaFactice = (matches) => {
      const mq = { matches, requete: null, ecouteurs: [], addEventListener(type, fn) { if (type === 'change') this.ecouteurs.push(fn); }, removeEventListener(type, fn) { this.ecouteurs = this.ecouteurs.filter((f) => f !== fn); }, basculer(v) { this.matches = v; for (const f of [...this.ecouteurs]) f({ matches: v }); } };
      const media = (q) => { mq.requete = q; return mq; }; media.mq = mq; return media;
    };
    const LIVRE4 = { id: 'b4', title: 'Saisons gourmandes', author: 'A. Cuisinière', cuisines: [], tags: [], created_at: DATE4, updated_at: DATE4 };
    const EDITION4 = { id: 'ed4', book_id: 'b4', isbn: '9782890772816', publisher: 'Flammarion Québec', year: 2004, language: 'fr', owned: true, cover_sha256: null, unit_convention_id: null, convention_evidence: null, created_at: DATE4, updated_at: DATE4 };
    // Une fiche disponible (ou partielle) a une version courante — I-UI-1 : « Disponible » seulement après enregistrement ; une fixture impossible en base masquerait un
    // défaut si une tâche lisait doc.version sur la ligne (rév. 2) ; une référence n'en a pas (current_version_id null, sauf override explicite).
    const recette4 = (id, over = {}) => { const r = { id, edition_id: 'ed4', original_title: 'Recette ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_url: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE4, updated_at: DATE4, ...over }; if (r.availability === 'reference_only' && !('current_version_id' in over)) r.current_version_id = null; return r; };
    const version4 = (rid) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: null, cook_minutes: null, total_minutes: null, ingredients: [], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }], provenance: { generated_by: 'manual' }, verification_state: 'verified', created_at: DATE4, updated_at: DATE4 });
    const versions4 = (rs) => rs.filter((r) => r.availability !== 'reference_only').map((r) => version4(r.id)); // une version par fiche non référence
    // Le contexte d'une fiche livre (le motif de tests/sync-l4.js:3574), relu de la base jetable ; `over` complète ou remplace.
    const ctx4 = async (db, over = {}) => {
      const [recipes, recipe_versions, source_pages, source_documents, scan_sessions, imports] = await Promise.all(['recipes', 'recipe_versions', 'source_pages', 'source_documents', 'scan_sessions', 'imports'].map((s) => db.getAll(s)));
      return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions, source_pages, source_documents, scan_sessions, imports, rediscovery_prefs: [], book_editions: [EDITION4], books: [LIVRE4],
        versionsByRecipe: new Map(recipes.map(r => [r.id, recipe_versions.filter(v => v.recipe_id === r.id)])), editionsById: new Map([['ed4', EDITION4]]), booksById: new Map([['b4', LIVRE4]]), docsByRecipe: new Map(), settings: {}, sync: {}, editionLabel: () => LIVRE4.title, ...over };
    };
    const sectionDe = (racine, titre) => titre === 'Les recettes de ce livre' ? racine.querySelector('[data-role="compte-recettes"]')?.closest('section') ?? null : [...racine.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === titre) ?? null;
    const lignes4 = (racine) => [...racine.querySelectorAll('ul.liste-compacte > li')];
    const titres4 = (racine) => lignes4(racine).map((li) => li.querySelector('a.titre')?.textContent);
    const bouton4 = (racine, texte) => [...racine.querySelectorAll('button')].find((b) => b.textContent === texte) ?? null;
    // Ronde 1 : un tour de boucle — l'abonnement de largeur se pose au MONTAGE (setTimeout 0 puis isConnected : constats 1 et 18) ; `avant4` = l'ordre du document ;
    // `sansReseau` (constat 21, le motif des blocs T2 et T3) : fetch remplacé par un espion le temps d'un bloc qui monte renderBook, rendu dans le finally, compte affirmé.
    const macro4 = () => new Promise((r) => setTimeout(r, 0));
    const avant4 = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const sansReseau = async (quoi, f) => {
      const appels = []; const vraiFetch = globalThis.fetch;
      globalThis.fetch = async (u) => { appels.push(String(u?.url ?? u)); throw new Error('aucun reseau attendu : ' + u); };
      try { await f(); } finally { globalThis.fetch = vraiFetch; }
      eq(appels, [], `T4 (ronde 1, ${quoi}) : AUCUN appel réseau pendant le bloc (rendus, filtres, bascules, gestes)`);
    };

    await bloc('T4 — fiche livre : en-tête, menus renommés, deux colonnes, « Sommaire », « Pages et fichiers sources » (D-UI-7, D-UI-8)', () => withRepo(async (repo, db) => sansReseau('fiche livre', async () => {
      const { renderBook } = await import('../src/ui/book.js');
      const doc = { id: 'doc4', edition_id: 'ed4', source_type: 'photo', sha256: H4('a'), original_filename: 'a.jpg', created_at: DATE4, updated_at: DATE4 };
      // Ronde 1 (constat 5) : des identifiants dont l'ordre de CLÉ contredit l'ordre imprimé (IndexedDB rend « pgA » avant « pgB ») — sans le tri, le Sommaire dirait p. 3 puis p. 2.
      const pages = [
        { id: 'pgA', edition_id: 'ed4', document_id: 'doc4', sha256: H4('3'), printed_page: 3, kind: 'index', created_at: DATE4, updated_at: DATE4 },
        { id: 'pgB', edition_id: 'ed4', document_id: 'doc4', sha256: H4('2'), printed_page: 2, kind: 'index', created_at: DATE4, updated_at: DATE4 },
        { id: 'pg10', edition_id: 'ed4', document_id: 'doc4', sha256: H4('5'), printed_page: 10, kind: 'recette', created_at: DATE4, updated_at: DATE4 },
      ];
      const r1 = recette4('r1', { printed_page: 10 });
      await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], source_documents: [doc], source_pages: pages, recipes: [r1], recipe_versions: versions4([r1]) }, origin: 'device' });
      const fiche = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db), { matchMedia: mediaFactice(true) });
      // En-tête : titre de fiche, sous-titre dérivé SANS l'ISBN ni la langue (ils restent dans le details), retour « Bibliothèque », deux menus renommés.
      const h1 = fiche.querySelector('header h1');
      const menus = [...fiche.querySelectorAll('header details.menu-source')];
      eq([h1?.textContent, h1?.classList.contains('titre-fiche'), fiche.querySelector('header p.muted')?.textContent, fiche.querySelector('header > a')?.getAttribute('href'), fiche.querySelector('header > a')?.textContent],
        ['Saisons gourmandes', true, 'A. Cuisinière · Flammarion Québec · 2004', '#/library?tab=books', '← Bibliothèque'],
        'T4 : h1.titre-fiche = le titre du livre ; sous-titre « {auteur} · {éditeur} · {année} », sans ISBN ni langue (H-21) ; retour « ← Bibliothèque » → #/library?tab=books (le segment Livres, d’où vient la fiche : R-UI-11, vague finale)');
      eq([...fiche.querySelectorAll('header [data-action]')].map(a=>[a.dataset.action,a.textContent]),[['modifier-livre','Modifier le livre'],['ajouter-index','Ajouter des pages d’index'],['ajouter-recette','Ajouter une recette']],'L3 livre : modifier, index et recette accessibles directement sans menus imbriqués');
      // EI-T4-a : la carte « Connecte-toi » du panneau d'index (div.status.warn[data-role=connexion-ia], inchangée) reste ; ronde 1 (constat 15) : toute AUTRE pastille
      // d'état (.status.ok / .warn / .info, quelle que soit sa balise) est comptée — des chips revenus en div ne passent plus.
      eq([[...fiche.querySelectorAll('.status.ok, .status.warn, .status.info')].filter((n) => !n.matches('[data-role="connexion-ia"]')).length, fiche.querySelector('.row.top > header')], [0, null],
        'T4 : les trois chips d’état (« disponible(s) », « repérée(s) », « page(s) source ») ont disparu ; l’en-tête n’est plus dans une rangée avec la couverture (D-UI-7)');
      // Deux colonnes : gauche = couverture, « Couverture » (.card), métadonnées (details.card), « Sommaire » (.plain), le details des entrées d'index ; droite = « Les recettes de ce livre » (.plain).
      const colonnes = fiche.querySelector('.two-col.livre');
      const [gauche, droite] = [...(colonnes?.children || [])];
      const forme = (n) => n.tagName + ':' + [...n.classList].filter((c) => ['card', 'plain', 'cover-wrap'].includes(c)).join('.');
      eq([colonnes?.parentElement === fiche, colonnes?.children.length, [...(gauche?.children || [])].map(forme), [...(gauche?.children || [])].map((n) => n.querySelector(':scope > h2, :scope > summary > strong')?.textContent ?? null)],
        [true, 2, ['DIV:cover-wrap', 'A:', 'SECTION:card', 'DETAILS:card', 'DETAILS:'], [null, null, 'Couverture', 'Métadonnées et convention', null]],
        'T4 / I2 : deux colonnes ; gauche = couverture, complément du livre, Couverture, Métadonnées et convention, Sommaire, entrées d’index');
      eq([gauche?.children[1]?.textContent, gauche?.children[1]?.getAttribute('href')], ['Compléter les informations', '#/add/livre?edition=ed4'], 'I2 : le complément ouvre le formulaire de cette édition');
      const sources = sectionDe(fiche, 'Pages et fichiers sources');
      eq([[...(droite?.querySelectorAll('section') || [])].map((s) => [forme(s), s.querySelector('h2')?.textContent]), forme(sources), sources?.parentElement?.dataset.role, sources?.parentElement?.hidden],
        [[['SECTION:plain', undefined],['SECTION:',undefined]], 'SECTION:plain', 'pages-source', true],
        'T4 : droite = « Les recettes de ce livre » en section.plain ; « Pages et fichiers sources » en section.plain, en bas, juste après les deux colonnes');
      // Sommaire : les pages kind === 'index' seulement, dans l'ordre des pages imprimées, numérotées ; la page de recette reste dans « Pages et fichiers sources », sans numéro.
      const sommaire = sectionDe(fiche, 'Sommaire');
      // EI-T4-b : la vignette d'une page sans octets ici est elle-même un figure.fichier-absent (vignettePage) : seules les figures ENFANTS de .thumbs sont des pages.
      const figures = (s) => [...(s?.querySelectorAll('.thumbs > figure') || [])].map((f) => [f.querySelector('.num')?.textContent ?? null, f.querySelector('figcaption')?.textContent, !!f.querySelector('.vignette-page')]);
      eq([figures(sommaire), figures(sources), sommaire?.textContent.includes('Reprendre la séance')],
        [[['1', 'p. 2 · index', true], ['2', 'p. 3 · index', true]], [[null, 'p. 10 · recette', true]], false],
        'T4 : « Sommaire » = les pages d’index (p. 2 puis p. 3, numérotées 1 et 2, chacune par vignettesDePages) ; « Pages et fichiers sources » garde la page de recette, sans numéro ; sans séance ouverte, pas de « Reprendre la séance »');
      // Ronde 1 (constat 13) : « Pages et fichiers sources » ne paraît que s'il a quelque chose à montrer (une page qui n'est pas d'index, un document non-photo) — un livre
      // dont on n'a photographié que la table des matières n'a plus, en bas, une section vide. Ronde 1 (constat 19) : le Sommaire suit l'ordre APPLIQUÉ dans la séance
      // (`position` : « l'ordre se corrige dans le panneau de la séance ») avant le numéro imprimé — des pages d'index sans numéro ne sont plus rangées par clé de base.
      const indexSeul = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { source_pages: pages.filter((p) => p.kind === 'index') }), { matchMedia: mediaFactice(true) });
      const ordonnees = [
        { id: 'pgC', edition_id: 'ed4', document_id: 'doc4', sha256: H4('c'), printed_page: null, position: 2, kind: 'index', created_at: DATE4, updated_at: DATE4 },
        { id: 'pgD', edition_id: 'ed4', document_id: 'doc4', sha256: H4('d'), printed_page: null, position: 1, kind: 'index', created_at: DATE4, updated_at: DATE4 },
      ];
      const parPosition = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { source_pages: ordonnees }), { matchMedia: mediaFactice(true) });
      eq([sectionDe(indexSeul, 'Pages et fichiers sources'), figures(sectionDe(indexSeul, 'Sommaire')).length,
        [...(sectionDe(parPosition, 'Sommaire')?.querySelectorAll('.thumbs > figure') || [])].map((f) => [f.querySelector('.num')?.textContent, f.querySelector('[data-sha256]')?.dataset.sha256])],
      [null, 2, [['1', H4('d')], ['2', H4('c')]]],
      'T4 (ronde 1) : pages d’index et document photo seuls → pas de « Pages et fichiers sources » (le Sommaire les montre) ; pages d’index sans numéro imprimé → rangées et numérotées par leur position de séance (1 puis 2), jamais par l’ordre des clés');
      // Vague finale (constat 1, R-UI-23) : `position` est numérotée PAR SÉANCE (repo.ajouterPages : une séance neuve repart à 1) — deux séances d'index se
      // chevauchent (A : 1, 2 ; B : 1). Le Sommaire range d'abord par séance, la plus ancienne d'abord (started_at de la séance, sinon captured_at du document :
      // une séance absente du contexte, fiche reçue), puis par position. Rendu 1 : A débute le 20 (son document, repris, est capturé le 25 : seul le début de
      // la séance compte), B est absente et son document dit le 22 → A1, A2, B1. Rendu 2 : le document de B dit le 18 → B1, A1, A2 (le repli captured_at joue).
      const docAB = (id, seance, quand, c) => ({ id, edition_id: 'ed4', source_type: 'photo', sha256: H4(c), scan_session_id: seance, captured_at: quand, created_at: DATE4, updated_at: DATE4 });
      const pageAB = (id, doc, position, c) => ({ id, edition_id: 'ed4', document_id: doc, sha256: H4(c), printed_page: null, position, kind: 'index', created_at: DATE4, updated_at: DATE4 });
      const seanceA = { id: 'ssA', status: 'done', edition_id: 'ed4', started_at: '2026-10-20T00:00:00.000Z', page_ids: ['pgA1', 'pgA2'], document_ids: ['docA'], created_at: DATE4, updated_at: DATE4 };
      const pagesAB = [pageAB('pgA2', 'docA', 2, '7'), pageAB('pgB1', 'docB', 1, '8'), pageAB('pgA1', 'docA', 1, '6')];
      const sommaireDe = async (quandB) => [...(sectionDe(await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { source_pages: pagesAB, scan_sessions: [seanceA],
        source_documents: [docAB('docA', 'ssA', '2026-10-25T00:00:00.000Z', 'e'), docAB('docB', 'ssB', quandB, 'f')] }), { matchMedia: mediaFactice(true) }), 'Sommaire')?.querySelectorAll('.thumbs > figure') || [])]
        .map((f) => [f.querySelector('.num')?.textContent, f.querySelector('[data-sha256]')?.dataset.sha256]);
      eq([await sommaireDe('2026-10-22T00:00:00.000Z'), await sommaireDe('2026-10-18T00:00:00.000Z')],
        [[['1', H4('6')], ['2', H4('7')], ['3', H4('8')]], [['1', H4('8')], ['2', H4('6')], ['3', H4('7')]]],
        'T4 (vague finale, R-UI-23) : deux séances d’index aux positions qui se chevauchent → rangées par séance (started_at, sinon captured_at du document) puis par position, numérotées 1 à 3 — jamais entrelacées (A1, B1, A2)');
      // Sans page d'index ni séance ouverte : pas de « Sommaire ». Vague finale (constat 3) : le Sommaire ne rappelle qu'une séance de SOMMAIRE — une séance ouverte
      // qui porte une page d'index, ou une lecture d'index ouverte (l'intention d'une séance n'est pas stockée, import.js) ; une séance de RECETTES (ici : sa
      // seule page est pg10, kind 'recette') n'y paraît pas, présentée comme une table des matières : le rappel « Reprendre » de droite reste, seul.
      await db.mutate({ deletes: { source_pages: ['pgA', 'pgB'] }, origin: 'device' });
      const sans = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db), { matchMedia: mediaFactice(true) });
      await db.mutate({ puts: { scan_sessions: [{ id: 'ss4', status: 'open', edition_id: 'ed4', started_at: DATE4, page_ids: ['pg10'], document_ids: [], created_at: DATE4, updated_at: DATE4 }] }, origin: 'device' });
      const avecSeance = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db), { matchMedia: mediaFactice(true) });
      const avecLecture = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { imports: [{ id: 'imp6', kind: 'index', status: 'a_verifier', edition_id: 'ed4', scan_session_id: 'ss4', page_ids: ['pg10'], created_at: DATE4, updated_at: DATE4 }] }), { matchMedia: mediaFactice(true) });
      const pgI = { id: 'pgI', edition_id: 'ed4', document_id: 'doc4', sha256: H4('9'), printed_page: null, position: 2, kind: 'index', created_at: DATE4, updated_at: DATE4 };
      const avecPageIndex = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { source_pages: [...(await db.getAll('source_pages')), pgI],
        scan_sessions: [{ id: 'ss4', status: 'open', edition_id: 'ed4', started_at: DATE4, page_ids: ['pg10', 'pgI'], document_ids: [], created_at: DATE4, updated_at: DATE4 }] }), { matchMedia: mediaFactice(true) });
      const repriseDe = (f) => { const a = [...f.querySelectorAll('a')].find((x) => x.textContent === 'Reprendre la séance'); return a ? [a.getAttribute('href'), a.className, a.closest('section')?.querySelector('h2')?.textContent] : null; };
      eq([sectionDe(sans, 'Sommaire'), sectionDe(avecSeance, 'Sommaire'), repriseDe(avecSeance), [...avecSeance.querySelectorAll('a')].filter((a) => a.textContent === 'Reprendre').map((a) => a.getAttribute('href')), repriseDe(avecLecture), repriseDe(avecPageIndex)],
        [null, null, null, ['#/import?session=ss4'], ['#/import?session=ss4', 'btn', 'Pages source'], ['#/import?session=ss4', 'btn', 'Pages source']],
        'T4 (vague finale) : sans page d’index ni séance, pas de « Sommaire » ; une séance de recettes ouverte n’y paraît pas (le rappel « Reprendre » de droite reste, seul) ; une séance qui porte une lecture d’index ouverte ou une page d’index fait paraître « Sommaire » avec a.btn.small « Reprendre la séance » → #/import?session=<id>');
      // Ronde 1 (constat 9, spec § 4.3 « droite = rappels … puis Les recettes de ce livre ») : imports à reprendre, séance en cours et convention des tasses sont dans la
      // colonne de DROITE, avant la liste — sous 900 px, ils ne passent jamais au-dessus de la couverture ni entre elle et les métadonnées.
      const avecRappels = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, {
        imports: [{ id: 'imp4', kind: 'index', status: 'a_verifier', edition_id: 'ed4', page_ids: [], created_at: DATE4, updated_at: DATE4 }],
        recipe_versions: [{ ...version4('r1'), ingredients: [{ id: 'ing4', unit_id: 'cup', quantity: 1 }] }] }), { matchMedia: mediaFactice(true) });
      const droiteR = avecRappels.querySelector('.two-col.livre > [data-role="colonne-recettes"]');
      const listeR = sectionDe(avecRappels, 'Les recettes de ce livre');
      const rappels = [droiteR?.querySelector('[data-role="imports-a-reprendre"]'), [...(droiteR?.querySelectorAll('a') || [])].find((a) => a.textContent === 'Reprendre')?.closest('.card') ?? null, droiteR?.querySelector('.card.warn') ?? null];
      eq([rappels.map((n) => !!n), rappels.map((n) => avant4(n, listeR)), listeR?.parentElement === droiteR, rappels[0]?.textContent],
        [[true, true, true], [true, true, true], true, '1 import à reprendre'],
        'T4 (ronde 1) : « 1 import à reprendre », la carte « Séance en cours » (Reprendre) et l’avertissement de convention sont dans la colonne de droite, AVANT « Les recettes de ce livre »');
      // ?nouveau=1 : l'accueil d'un livre reste, entre l'en-tête et les colonnes (renderAccueilLivre inchangé) ; le sous-titre ne dit que ce qui est connu.
      const nouvelle = await renderBook({ id: 'ed4' }, { nouveau: '1' }, await ctx4(db), { matchMedia: mediaFactice(true) });
      const accueil = nouvelle.querySelector('.accueil-livre');
      const sansEditeur = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { editionsById: new Map([['ed4', { ...EDITION4, publisher: null, year: null }]]) }), { matchMedia: mediaFactice(true) });
      eq([!!accueil, accueil?.parentElement?.previousElementSibling?.tagName, accueil?.parentElement?.nextElementSibling?.classList.contains('onglets-livre'), sansEditeur.querySelector('header p.muted')?.textContent],
        [true, 'HEADER', true, 'A. Cuisinière'],
        'T4 : ?nouveau=1 → le panneau d’accueil entre l’en-tête et les deux colonnes (inchangé) ; sans éditeur ni année, le sous-titre ne porte que l’auteur (rien d’inventé)');
      // Vague finale (constat 2, R-UI-11 tranché) : « Plus tard » (« Aller à la bibliothèque. ») mène au segment Livres, où le livre qu'on vient de créer se voit
      // — #/library seul ouvre Recettes, sans trace du livre. L'adresse est rendue telle quelle après le geste (aucun routeur monté dans la suite).
      const hashAvant4 = location.hash;
      let apresPlusTard = null;
      try {
        [...(accueil?.querySelectorAll('button.carte') || [])].find((b) => b.querySelector('h3')?.textContent === 'Plus tard')?.click();
        apresPlusTard = location.hash;
      } finally { if (location.hash !== hashAvant4) history.replaceState(null, '', location.pathname + location.search + hashAvant4); }
      eq(apresPlusTard, '#/library?tab=books', 'T4 (vague finale, R-UI-11) : « Plus tard » de l’accueil d’un livre neuf → #/library?tab=books (segment Livres), jamais #/library (Recettes)');
    })));

    // Ronde 1 (constats 2 et 6) : connecté, deux pages d'index et deux autres pages DISTANTES (copie serveur de ce compte, aucun octet ici) — chaque groupe n'offre
    // « Télécharger les {n} pages » que pour SES pages, et ne transmet qu'elles au moteur, dans l'ordre affiché.
    await bloc('T4 (ronde 1) — « Télécharger les {n} pages » par groupe : le Sommaire ses pages d’index, « Pages et fichiers sources » les autres', () => withRepo(async (repo, db) => sansReseau('téléchargement par groupe', async () => {
      const { renderBook } = await import('../src/ui/book.js');
      const doc = { id: 'doc4', edition_id: 'ed4', source_type: 'photo', sha256: H4('a'), original_filename: 'a.jpg', created_at: DATE4, updated_at: DATE4 };
      const page = (id, c, printed_page, kind) => ({ id, edition_id: 'ed4', document_id: 'doc4', sha256: H4(c), printed_page, ...(kind ? { kind } : {}), created_at: DATE4, updated_at: DATE4 });
      const pages = [page('pd1', 'b', 5, 'index'), page('pd2', 'c', 4, 'index'), page('pd3', 'd', 20, 'recette'), page('pd4', 'e', 21, null)];
      const distante = (sha256) => ({ sha256, mime: 'image/jpeg', size: 5, updated_at: DATE4, remote: { sha256, size: 400, mime: 'image/jpeg', quality: 'reduite', uploaded_at: DATE4, owner: 'u4' } });
      await db.mutate({ puts: { files: pages.map((p) => distante(p.sha256)) }, origin: 'remote' });
      await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], source_documents: [doc], source_pages: pages }, origin: 'device' });
      const appels = [];
      const moteur = { onEtat: () => () => {}, telecharger: async (shas) => { appels.push([...shas]); return { recus: 0, erreurs: 0, erreur: null }; } };
      const fiche = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { sync: { user: { id: 'u4' }, moteur } }), { matchMedia: mediaFactice(true) });
      const groupe = (titre) => [...(sectionDe(fiche, titre)?.querySelectorAll('button') || [])].filter((b) => b.textContent.startsWith('Télécharger les '));
      const [sommaire, sources] = [groupe('Sommaire'), groupe('Pages et fichiers sources')];
      eq([sommaire.map((b) => b.textContent), sources.map((b) => b.textContent)], [['Télécharger les 2 pages'], ['Télécharger les 2 pages']],
        'T4 (ronde 1) : le Sommaire offre « Télécharger les 2 pages » pour SES deux pages d’index ; « Pages et fichiers sources » le sien pour ses deux autres pages (jamais les quatre)');
      sommaire[0]?.click();
      for (let i = 0; i < 100 && appels.length < 1; i += 1) await new Promise((r) => setTimeout(r, 10));
      sources[0]?.click();
      for (let i = 0; i < 100 && appels.length < 2; i += 1) await new Promise((r) => setTimeout(r, 10));
      eq(appels, [[H4('c'), H4('b')], [H4('d'), H4('e')]],
        'T4 (ronde 1) : chaque bouton transmet au moteur SES pages, dans l’ordre affiché — le Sommaire p. 4 puis p. 5 (index), les sources p. 20 puis p. 21');
    })));

    await bloc('T4 — liste compacte : vignette 48 px sur octets (synchrone), titre, « p. N », section, badge, « Importer » / « Saisir à la main », favori, compteur, filtres', () => withRepo(async (repo, db) => sansReseau('liste compacte', async () => {
      const B = await import('../src/ui/book.js');
      const K = await import('../src/ui/components.js');
      const BU = await import('../src/core/blob-urls.js');
      const jpeg = await jpegDe('#c63'); const sha = await sha256Hex(jpeg);
      await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
      await db.mutate({ puts: { files: [{ sha256: H4('1'), mime: 'text/html', blob: new Blob(['<p>x</p>'], { type: 'text/html' }), size: 8, syncable: false, created_at: DATE4, updated_at: DATE4 }] }, origin: 'device' });
      const recettes = [
        recette4('rA', { original_title: 'Tarte aux pommes', printed_page: 40, photo_sha256: sha, photo_origin: 'photo' }), // disponible, octets JPEG ici → vignette
        recette4('rB', { original_title: 'Bouillon', printed_page: 12, photo_sha256: H4('1'), favorite: true }), // disponible, pointeur vers une ligne text/html → aucune image ; favori
        recette4('rC', { original_title: 'Compote', printed_page: 12, availability: 'reference_only', section: '  Desserts  ' }), // à importer : référence sans adresse, avec section
        recette4('rD', { original_title: 'Dahl', printed_page: 77, availability: 'partial' }), // partielle sans adresse : « Importer » aussi ; compte parmi les disponibles
        recette4('rE', { original_title: 'Escabèche', availability: 'reference_only', source_url: 'https://exemple.test/escabeche', section: 'Poissons' }), // signet rangé dans le livre : « Lien web », ni Importer ni « à importer »
        recette4('rF', { original_title: 'Fenouil rôti', printed_page: 55, photo_sha256: H4('9') }), // pointeur sans ligne files → aucune image
      ];
      await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], recipes: recettes, recipe_versions: versions4(recettes) }, origin: 'device' });
      // Ronde 1 (constats 7 et 11, I-UI-5) : les octets des photos de plat sont lus UNE fois, en UNE transaction (repo.getFiles → db.getMany) — exactement les pointeurs
      // valides, dans l'ordre des fiches —, jamais fiche par fiche (db.get de `files`). L'espion est posé sur l'instance de base le temps du rendu.
      const lectures4 = { get: [], getMany: [] };
      const vraiGet4 = db.get.bind(db); const vraiGetMany4 = db.getMany.bind(db);
      db.get = (store, key) => { if (store === 'files') lectures4.get.push(key); return vraiGet4(store, key); };
      db.getMany = (store, keys) => { if (store === 'files') lectures4.getMany.push([...keys]); return vraiGetMany4(store, keys); };
      let fiche = null;
      try { fiche = await B.renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db), { matchMedia: mediaFactice(true) }); } finally { delete db.get; delete db.getMany; }
      eq([lectures4.getMany, lectures4.get], [[[H4('1'),sha,H4('9')]], [H4('9')]],
        'T4 (ronde 1, I-UI-5) : UNE lecture groupée de files (db.getMany) portant exactement les trois pointeurs valides (rA, rB, rF), aucune lecture fiche par fiche');
      const liste = sectionDe(fiche, 'Les recettes de ce livre');
      eq([liste?.querySelector('[data-role="compte-recettes"]')?.textContent, liste?.querySelector('[data-role="compte-recettes"]')?.dataset.role, titres4(fiche)],
        ['3 disponible(s) · 1 partielle(s) · 2 référence(s) · 0 état(s) inconnu(s)', 'compte-recettes', ['Bouillon', 'Compote', 'Tarte aux pommes', 'Fenouil rôti', 'Dahl', 'Escabèche']],
        'T4 : sous le titre, « {n} disponible(s) · {m} à importer » (disponibles = available + partial ; à importer = les références SANS adresse : le signet rangé ne compte pas) ; tri par page imprimée puis titre, sans page en dernier');
      const ligne = (titre) => lignes4(fiche).find((li) => li.querySelector('a.titre')?.textContent === titre)?.querySelector('.recette-ligne');
      // Le portrait d'une ligne : classe, href du titre, vignette (présence, src blob:, alt), « p. N », sections, badge = availabilityBadge SANS la page (vague finale,
      // constats 5 et 10 : la page est dite une fois, par « p. N » à côté du titre — § 4.3 veut le badge « À importer » seul), gestes [texte, href], « ★ Favori ».
      const portrait = (titre) => { const li = ligne(titre); const r = recettes.find((x) => x.original_title === titre); const img = li?.querySelector('img');
        return [li?.className, li?.querySelector('a.titre')?.getAttribute('href'), !!li?.querySelector('.recette-miniature img.plat-vignette'), img ? img.getAttribute('src')?.startsWith('blob:') : null, img ? img.getAttribute('alt') : null,
          li?.querySelector('span.muted')?.textContent ?? null, [...(li?.querySelectorAll('.chip.neutral') || [])].map((c) => c.textContent), li?.querySelector('[data-role="etat-recette"] > .badge')?.outerHTML === K.availabilityBadge({ ...r, printed_page: null }).outerHTML,
          [...(li?.querySelectorAll('a.btn.small') || [])].map((a) => [a.textContent, a.getAttribute('href')]), [...(li?.querySelectorAll('.badge') || [])].map((b) => b.textContent).includes('★ Favori')]; };
      eq(portrait('Tarte aux pommes'), ['recette-ligne', '#/recipes/rA', true, true, '', 'p. 40', [], true, [], false],
        'T4 (I-UI-5, D-F9) : octets JPEG ici → .recette-miniature img.plat-vignette, src blob:, alt vide, DÈS le rendu (décision synchrone sur la ligne files) ; « p. 40 » ; le badge est celui d’availabilityBadge ; aucun geste');
      eq([portrait('Bouillon'), portrait('Fenouil rôti')], [['recette-ligne', '#/recipes/rB', false, null, null, 'p. 12', [], true, [], true], ['recette-ligne', '#/recipes/rF', false, null, null, 'p. 55', [], true, [], false]],
        'T4 (I-UI-5) : une ligne files text/html, ou un pointeur sans ligne → AUCUNE image (ni cadre vide) ; « ★ Favori » sur la ligne du favori');
      eq([portrait('Compote'), portrait('Dahl')],
        [['recette-ligne', '#/recipes/rC', false, null, null, 'p. 12', ['Desserts'], true, [['Importer', '#/recipes/rC/importer']], false],
          ['recette-ligne', '#/recipes/rD', false, null, null, 'p. 77', [], true, [['Compléter', '#/recipes/rD/importer']], false]],
        'T4 : référence sans adresse → section rognée en .chip.neutral, « Importer » et « Saisir à la main » (mêmes href qu’au lot A, T4-R1) ; partielle sans adresse → les deux gestes aussi, sans section (reference_only seulement)');
      eq([portrait('Escabèche'), fiche.querySelectorAll('a.titre .chip, a.titre .badge, a .btn, a [data-role="section"]').length],
        [['recette-ligne', '#/recipes/rE', false, null, null, null, [], true, [], false], 0],
        'T4 : un signet rangé dans le livre → badge « Lien web » (availabilityBadge), ni « Importer » ni « Saisir à la main », pas de « p. » ; aucun chip, badge ou bouton dans un <a>');
      const attendreListe=()=>fiche.querySelector('.bibliotheque-resultats').attendreAffichage();
      const filtrer=async(name,value)=>{const n=liste.querySelector(`input[name=${name}]${value?`[value=${value}]`:''}`);n.checked=!n.checked;n.dispatchEvent(new Event('change',{bubbles:true}));await attendreListe();return titres4(fiche);};
      eq([...liste.querySelectorAll('fieldset input:checked')].length,0,'L3 livre : aucun filtre actif initialement');
      const refs=await filtrer('disponibilites','reference_only');await filtrer('disponibilites','reference_only');const disp=await filtrer('disponibilites','available');await filtrer('disponibilites','available');const fav=await filtrer('favoris');await filtrer('favoris');
      eq([refs,disp,fav,titres4(fiche)],[['Compote','Escabèche'],['Bouillon','Tarte aux pommes','Fenouil rôti'],['Bouillon'],['Bouillon','Compote','Tarte aux pommes','Fenouil rôti','Dahl','Escabèche']],'L3 livre : références, disponibles seules, favoris et retour ensemble');
      const champ=liste.querySelector('input[name=q]');champ.value='ta';champ.dispatchEvent(new Event('input',{bubbles:true}));await attendreListe();
      eq(titres4(fiche),['Tarte aux pommes'],'L3 livre : texte local sur titre');
      champ.value='zzz';champ.dispatchEvent(new Event('input',{bubbles:true}));await attendreListe();
      eq([lignes4(fiche).length,!!liste.querySelector('.empty'),!!liste.querySelector('.empty .ico svg'),liste.querySelector('.empty p')?.textContent],[0,true,true,'Aucune recette ne correspond.'],'L3 livre : vide filtré nommé avec icône au trait');
      // ligneCompacte seule : la décision est prise sur la ligne files PASSÉE — octets ET type d'image —, jamais relue en base.
      const ligneDirecte = B.ligneCompacte(recette4('rX', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'image/jpeg', blob: jpeg } });
      const ligneSansBlob = B.ligneCompacte(recette4('rY', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'image/jpeg', remote: null } });
      const lignePdf = B.ligneCompacte(recette4('rW', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'application/pdf', blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } });
      eq([ligneDirecte.querySelector('.recette-miniature img.plat-vignette')?.getAttribute('src')?.startsWith('blob:'), ligneDirecte.querySelector('img')?.getAttribute('loading'), ligneSansBlob.querySelector('img'), lignePdf.querySelector('img'), B.ligneCompacte(recette4('rZ')).querySelector('img')],
        [true, 'lazy', null, null, null],
        'ligneCompacte : octets d’un type d’image → .recette-miniature img.plat-vignette (loading lazy, src blob:) ; ligne sans blob, blob PDF (liste blanche, pas une image) ou fiche sans pointeur → aucune image');
      // Ronde 1 (constats 20 et 23) : le titre affiché est display_title d'abord, « Sans titre » à défaut (jamais un lien vide, le repli de library.js) ; l'href est encodé ;
      // data-recette porte l'identifiant tel quel.
      const renommee = B.ligneCompacte(recette4('r é/1', { original_title: 'Ancien titre', display_title: 'Nouveau titre' }));
      const sansTitre = B.ligneCompacte(recette4('rT', { original_title: '' }));
      eq([renommee.querySelector('a.titre')?.textContent, renommee.querySelector('a.titre')?.getAttribute('href'), renommee.dataset.recette, sansTitre.querySelector('a.titre')?.textContent],
        ['Nouveau titre', '#/recipes/r%20%C3%A9%2F1', 'r é/1', 'Sans titre'],
        'ligneCompacte L4 : le titre personnalisé est principal ; un titre vide devient « Sans titre » ; l’href du titre encode l’identifiant ; li[data-recette] = l’identifiant');
      // Vague finale (constats 5 et 10) : la page imprimée de la ligne suit la règle du badge (pageAffichable : un entier de 1 à 9999 — une fiche reçue ou restaurée
      // peut porter n'importe quoi) ; elle est dite UNE fois, par « p. N » (le badge court ne la répète pas).
      const pageDe = (p) => { const li = B.ligneCompacte(recette4('rP', { availability: 'reference_only', printed_page: p })); return [li.querySelector('span.muted')?.textContent ?? null, li.querySelector('[data-role="etat-recette"] > .badge')?.textContent]; };
      eq([pageDe(132), pageDe('x'.repeat(100000)), pageDe('12'), pageDe(0), pageDe(10000), pageDe(12.5)],
        [['p. 132', 'À importer'], [null, 'À importer'], [null, 'À importer'], [null, 'À importer'], [null, 'À importer'], [null, 'À importer']],
        'ligneCompacte (vague finale) : « p. 132 » et le badge court « À importer » (page dite une fois) ; une page hostile — chaîne de 100 000 caractères, « 12 » en texte, 0, 10000, 12,5 — n’est pas affichée (la règle du badge, pageAffichable)');
      // Ronde 1 (constat 12) : « à importer » a UNE définition (estAImporter / aUneAdresse de library.js) — une adresse qui n'est pas une chaîne non vide n'est pas une
      // adresse : la fiche compte la référence, son filtre la garde, sa ligne offre « Importer » et sa section, comme l'onglet « À importer » de la bibliothèque.
      const r42 = recette4('rQ', { original_title: 'Quiche', availability: 'reference_only', source_url: 42, section: 'Tartes' });
      const fiche42 = await B.renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db, { recipes: [...recettes, r42] }), { matchMedia: mediaFactice(true) });
      const liste42 = sectionDe(fiche42, 'Les recettes de ce livre');
      const ligne42 = () => lignes4(fiche42).find((li) => li.dataset.recette === 'rQ');
      const gestes42 = [...(ligne42()?.querySelectorAll('a.btn.small') || [])].map((a) => a.textContent);
      const chips42 = [...(ligne42()?.querySelectorAll('.chip.neutral') || [])].map((c) => c.textContent);
      const filtre42=liste42.querySelector('input[name=disponibilites][value=reference_only]');filtre42.checked=true;filtre42.dispatchEvent(new Event('change',{bubbles:true}));await fiche42.querySelector('.bibliotheque-resultats').attendreAffichage();
      eq([liste42?.querySelector('[data-role="compte-recettes"]')?.textContent, gestes42, chips42, titres4(fiche42)],
        ['3 disponible(s) · 1 partielle(s) · 3 référence(s) · 0 état(s) inconnu(s)', ['Importer'], ['Tartes'], ['Compote', 'Escabèche', 'Quiche']],
        'T4 (ronde 1) : une référence au source_url non-chaîne (42) est « à importer » partout dans la fiche — compteur, ligne (Importer, Saisir à la main, section), filtre « À importer »');
      // Ronde 1 (constat 3, D-F9, I-F6) : des octets admis (image/jpeg) que le navigateur ne décode pas → error : l'img est retirée, son URL blob: révoquée — jamais un
      // cadre de 48 px bordé avec l'icône d'image cassée (le motif de vignettePlat et de la carte-plat). « lazy » ne chargerait pas hors écran : le test passe en eager.
      const casse = new Blob([Uint8Array.of(0xff, 0xd8, 0xff, 0x00, 1, 2, 3, 4)], { type: 'image/jpeg' });
      const ligneCasse = B.ligneCompacte(recette4('rK', { photo_sha256: sha }), { fichier: { sha256: sha, mime: 'image/jpeg', blob: casse } });
      const imgCasse = ligneCasse.querySelector('.recette-miniature img.plat-vignette'); const uCasse = imgCasse?.getAttribute('src');
      const sceneK = document.createElement('ul'); sceneK.style.cssText = 'position:absolute;left:-10000px;top:0;width:375px'; document.body.append(sceneK); sceneK.append(ligneCasse);
      try {
        await new Promise((resoudre, rejeter) => {
          const minuterie = setTimeout(() => rejeter(new Error('attente dépassée (3 s) : error de la vignette indécodable')), 3000);
          imgCasse.addEventListener('error', () => { clearTimeout(minuterie); resoudre(); }, { once: true });
          imgCasse.loading = 'eager';
        });
        await macro4();
      } finally { sceneK.remove(); }
      eq([typeof uCasse === 'string' && uCasse.startsWith('blob:'), ligneCasse.querySelectorAll('img').length, BU.revoquerUrlDeBlob(uCasse)], [true, 0, false],
        'ligneCompacte (ronde 1) : octets image/jpeg indécodables → d’abord une img (type admis), puis, à l’erreur de décodage, plus AUCUNE img dans la ligne et son URL blob: déjà révoquée');
      BU.revoquerUrlsDeBlob();
    })));

    await bloc('L3 — livre pagination indépendante de largeur, focus et filtres', () => withRepo(async(repo,db)=>sansReseau('pagination L3',async()=>{
      const {renderBook}=await import('../src/ui/book.js');
      const recettes=Array.from({length:125},(_,i)=>recette4('r'+String(i).padStart(3,'0'),{original_title:'Plat '+String(i).padStart(3,'0'),printed_page:i+1,favorite:i<10}));
      await db.mutate({puts:{books:[LIVRE4],book_editions:[EDITION4],recipes:recettes,recipe_versions:versions4(recettes)},origin:'device'});
      const scene=document.createElement('div');document.body.append(scene);
      try{
        const media=mediaFactice(false),etroite=await renderBook({id:'ed4'},{presentation:'liste'},await ctx4(db),{matchMedia:media});scene.append(etroite);
        const list=()=>etroite.querySelector('.bibliotheque-resultats'),more=()=>etroite.querySelector('[data-role=voir-plus]');
        eq([lignes4(etroite).length,more()?.textContent,more()?.tagName,more()?.getAttribute('href')],[60,'Voir plus','BUTTON',null],'L3 : 60 lignes mobile, vrai bouton');
        more().click();await list().attendreAffichage();eq(lignes4(etroite).length,120,'L3 : deuxième page 120');
        more().click();await list().attendreAffichage();eq([lignes4(etroite).length,more()],[125,null],'L3 : dernière page et disparition bouton');
        list().querySelector('[name=favoris]').click();await list().attendreAffichage();eq([lignes4(etroite).length,more()],[10,null],'L3 : filtre remet pagination à60');
        const large=await renderBook({id:'ed4'},{presentation:'liste'},await ctx4(db),{matchMedia:mediaFactice(true)});eq(lignes4(large).length,60,'L3 : même borne sur ordinateur');
        const avant=lignes4(etroite);media.mq.basculer(true);eq(lignes4(etroite).every((n,i)=>n===avant[i]),true,'L3 : largeur ne perd ni résultats ni nœuds');
        media.mq.basculer(false);eq(lignes4(etroite).length,10,'L3 : retour mobile garde filtre');
        eq(media.mq.ecouteurs.length,0,'L3 : pagination sans abonné largeur supplémentaire');
        const nonMontee=await renderBook({id:'ed4'},{presentation:'liste'},await ctx4(db));eq(lignes4(nonMontee).length,60,'L3 : rendu non monté borné');
        etroite.remove();media.mq.basculer(true);eq(lignes4(etroite).every((n,i)=>n===avant[i]),true,'L3 : fiche quittée ne se redessine pas');
        const huit=await renderBook({id:'ed4'},{presentation:'liste'},await ctx4(db,{recipes:recettes.slice(0,8)}));eq([lignes4(huit).length,huit.querySelector('[data-role=voir-plus]')],[8,null],'L3 : petite liste sans pagination superflue');
        eq(new Set(lignes4(large).map(n=>n.dataset.navId)).size,60,'L3 : identités stables uniques sur première page');
      }finally{scene.remove();(await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();}
    })));

    await bloc('T4 — styles.css servie : deux colonnes 200px 1fr ≥ 900 px, une colonne sous ; titre de ligne en serif ; vignette 78 × 78 (cadres de mesure)', () => withRepo(async (repo, db) => sansReseau('styles.css servie', async () => {
      const { renderBook } = await import('../src/ui/book.js');
      const jpeg = await jpegDe('#36c'); const sha = await sha256Hex(jpeg);
      await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
      // Deux recettes : la première (photo, page 5) porte le filet du bas ; la dernière ligne n'en a pas (:last-child).
      const rGH = [recette4('rG', { original_title: 'Gratin dauphinois aux trois fromages et à la muscade', printed_page: 5, photo_sha256: sha }), recette4('rH', { original_title: 'Haricots', printed_page: 9 })];
      await db.mutate({ puts: { books: [LIVRE4], book_editions: [EDITION4], recipes: rGH, recipe_versions: versions4(rGH) }, origin: 'device' });
      // La VRAIE feuille, chargée DANS un <iframe> about:blank par largeur (la technique de T2 ; rév. 2) : les jetons de :root (var(--serif), var(--line)) s'y résolvent et
      // les @media suivent la largeur du CADRE — dans une racine fantôme, :root ne matche rien (tests/index.html ne charge que tests.css) et (min-width: 900px) suivrait la
      // fenêtre de 1280 px du lanceur, quelle que soit la largeur de l'hôte : serif faux, filet 0px, deux pistes à 375 et 800.
      const mesurer = async (largeur) => {
        const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
        let fiche = null;
        f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:900px;border:0`;
        document.body.append(f);
        try {
          const d = f.contentDocument; const w = f.contentWindow;
          d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
          const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
          await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
          if (w.innerWidth !== largeur) throw new Error(`cadre ${largeur} : innerWidth ${w.innerWidth}`);
          fiche = await renderBook({ id: 'ed4' }, {presentation:'liste'}, await ctx4(db), { matchMedia: mediaFactice(largeur >= 900) });
          d.querySelector('main').append(fiche); // adopté par le document du cadre : SA feuille s'applique
          const S = (n) => w.getComputedStyle(n);
          const colonnes = fiche.querySelector('.two-col.livre');
          const [gauche, droite] = [...colonnes.children].map((n) => n.getBoundingClientRect());
          const titre = fiche.querySelector('a.titre'); const img = fiche.querySelector('.recette-miniature img.plat-vignette').getBoundingClientRect();
          const li = fiche.querySelector('ul.liste-compacte > li');
          return { gauche: Math.round(gauche.width), coteACote: droite.left >= gauche.right - 1 && Math.abs(droite.top - gauche.top) < 2, empilee: gauche.top >= droite.bottom - 1,
            serif: /georgia/i.test(S(titre).fontFamily), souligne: S(titre).textDecorationLine, vignette: [Math.round(img.width), Math.round(img.height)],
            grille: S(colonnes).gridTemplateColumns.trim().split(/\s+/).length, filet: S(li).borderBottomWidth, puce: S(fiche.querySelector('ul.liste-compacte')).listStyleType,
            couverture: Math.round(fiche.querySelector('.two-col.livre > [data-role="colonne-livre"] > .cover-wrap').getBoundingClientRect().width), // EI-T4-2
            // Ronde 1 (constats 4 et 10, I-UI-4) : la cible de chaque titre (le seul geste qui ouvre la recette depuis la liste), la plus petite hauteur et largeur.
            cible: (() => { const r = [...fiche.querySelectorAll('ul.liste-compacte a.titre')].map((a) => a.getBoundingClientRect()); return [Math.round(Math.min(...r.map((x) => x.height))), Math.round(Math.min(...r.map((x) => x.width))), r.length]; })() };
        } finally { fiche?.dispose?.(); fiche?.remove(); f.remove(); }
      };
      const [l1100, l800, l375] = [await mesurer(1100), await mesurer(800), await mesurer(375)];
      eq([l1100.gauche, l1100.coteACote, l1100.grille, l1100.serif, l1100.souligne, l1100.vignette, l1100.filet, l1100.puce], [200, true, 2, true, 'none', [78, 78], '1px', 'none'],
        'T4 (styles.css, 1100 px) : colonne de gauche 200 px, droite à côté (.two-col.livre 200px 1fr) ; titre de ligne en Georgia, sans soulignement ; vignette 78 × 78 (.plat-vignette.petite, T2) ; filet de 1 px sous la ligne ; aucune puce de liste');
      eq([l800.empilee, l800.grille, l375.empilee, l375.grille, l375.vignette], [true, 1, true, 1, [78, 78]],
        'T4 (styles.css, 800 et 375 px) : une seule colonne, gauche puis droite (la fiche livre ne prend pas le 1fr 1fr de .two-col à 760 px) ; la vignette reste 78 × 78');
      // EI-T4-2 : la couverture de la fiche garde ≈ 200 px (D-UI-7) quand les colonnes s'empilent — jamais la largeur de l'écran (avant T4 : 96 px à côté du titre).
      eq([l1100.couverture, l800.couverture, l375.couverture], [200, 200, 200], 'T4 (EI-T4-2, styles.css) : la couverture de la colonne de gauche mesure 200 px de large à 1100, 800 et 375 px (D-UI-7 « bookCover ≈ 200 px »)');
      eq([l1100, l800, l375].map((l) => [l.cible[0] >= 44, l.cible[1] >= 44, l.cible[2]]), [[true, true, 2], [true, true, 2], [true, true, 2]],
        'T4 (ronde 1, styles.css, I-UI-4) : le titre de chaque ligne — la cible qui ouvre la recette — mesure au moins 44 px de haut et de large à 1100, 800 et 375 px (« Haricots » compris)');
      (await import('../src/core/blob-urls.js')).revoquerUrlsDeBlob();
    })));

    await bloc('T4 — styles.css lue : les règles .liste-compacte (jetons seulement : T-1, T-2, T-11 ; survol sous @media (hover: hover))', async () => {
      const css = (await (await fetch(new URL('../styles.css', import.meta.url), { cache: 'no-store' })).text()).replace(/\/\*[\s\S]*?\*\//g, '');
      const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]).filter(([s]) => s.includes('.liste-compacte'));
      const decl = (sel) => regles.find(([s]) => s === sel)?.[1] ?? '';
      eq(regles.map(([s]) => s), ['.liste-compacte', '.liste-compacte > li', '.liste-compacte > li:last-child', '.liste-compacte .titre', '.liste-compacte .titre:hover', '.liste-compacte > .recette-ligne', '.fiche-livre .liste-compacte'], 'styles.css : les cinq règles .liste-compacte, dans cet ordre, et aucune autre');
      ok(/list-style:\s*none/.test(decl('.liste-compacte')) && /border-bottom:\s*1px solid var\(--line\)/.test(decl('.liste-compacte > li')) && /border-bottom:\s*0/.test(decl('.liste-compacte > li:last-child')) && /font-family:\s*var\(--serif\)/.test(decl('.liste-compacte .titre')) && /color:\s*var\(--ink\)/.test(decl('.liste-compacte .titre')) && /text-decoration:\s*none/.test(decl('.liste-compacte .titre')),
        'styles.css : filets fins --line entre les lignes, titre en --serif / --ink sans soulignement (jetons seulement)');
      const survol = [...css.matchAll(/@media\s*\(hover:\s*hover\)\s*\{\s*([^{}]+)\{/g)].map((m) => m[1].trim());
      ok(survol.includes('.liste-compacte .titre:hover') && !/(?:^|\})\s*\.liste-compacte \.titre:hover\s*\{/.test(css), 'styles.css : le survol du titre vit sous @media (hover: hover) seulement (I-UI-4, R-VIS-12)');
      ok(regles.every(([, d]) => !/display\s*:\s*none|#[0-9a-f]{3,8}\b|\b56px\b|olive/i.test(d)), 'styles.css : ni display:none, ni couleur en dur, ni 56px, ni « olive » dans ces règles (T-1, T-2, T-11)');
    });

    await bloc('T4 — filets : chaînes retirées et neuves (book.js, en.js, CHAINES_NEUVES_AILLEURS), sections plain par sectionPlain, recipeCard parti', async () => {
      const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
      const src = await lire('../src/ui/book.js');
      const { EN } = await import('../src/i18n/en.js');
      const { CHAINES_NEUVES_AILLEURS } = await import('./ajouter.js');
      ok(src.length > 3000 && /export async function renderBook\(params, query, ctx, deps = \{\}\)/.test(src), `book.js : le source est lu (${src.length} caractères) et renderBook prend deps`);
      const NEUVES = ['Ajouter une recette', 'Ajouter des pages d’index', 'Sommaire', 'Reprendre la séance', 'Recettes', 'Pages source', 'Filtrer les recettes de ce livre', 'Voir plus'];
      const RETIREES = ['+ Recette', '+ Pages d’index', 'Repérées', '{n} recette(s) disponible(s)', '{n} repérée(s) dans l’index', '{n} page(s) source'];
      eq([NEUVES.filter((c) => !src.includes(`t('${c}'`)), RETIREES.filter((c) => src.includes(`'${c}'`))], [[], []], 'book.js : chaque chaîne neuve est posée par t(), aucune chaîne retirée ne subsiste');
      eq([NEUVES.map((c) => EN[c]), RETIREES.slice(0, 2).map((c) => c in EN), EN['Disponibles']],
        [['Add a recipe', 'Add index pages', 'Table of contents', 'Resume the session', 'Recipes', 'Source pages', 'Filter this book’s recipes', 'Show more'], [false, false], 'Available'],
        'en.js : les traductions de la spec § 5 (et « Reprendre la séance », « Disponibles » au passage) ; « + Recette » et « + Pages d’index » ont quitté le dictionnaire');
      const filet = CHAINES_NEUVES_AILLEURS['../src/ui/book.js'];
      eq([NEUVES.filter((c) => !filet.includes(c)), RETIREES.slice(0, 2).filter((c) => filet.includes(c))], [[], []], 'CHAINES_NEUVES_AILLEURS (book.js) : porte les chaînes neuves, plus « + Recette » ni « + Pages d’index »');
      // Un seul test de SOURCE ici, admis par exception (Global Constraints) : le défaut de deps.matchMedia n'est atteignable que dans l'app réelle (la suite injecte
      // toujours) — il garde le motif « jamais window.matchMedia nu » (Illegal invocation). Les sections plain, « Couverture » en .card et l'absence de recipeCard sont
      // tenues par COMPORTEMENT dans les blocs « fiche livre » (formes SECTION:plain / SECTION:card) et « liste compacte » (rév. 2 : les regex de source sur ces faits, vertes
      // sur une ligne commentée, sont retirées).
      eq([/\(q\) => window\.matchMedia\(q\)/.test(src), /[^.\w]window\.matchMedia\(LARGEUR_DEUX_COLONNES\)/.test(src)], [true, false],
        'book.js : le défaut de deps.matchMedia est la flèche (q) => window.matchMedia(q), jamais window.matchMedia(LARGEUR_DEUX_COLONNES) nu (appel sans this : « Illegal invocation » dans l’app)');
    });
  }

  // ===== Tâche 5 — Aujourd'hui, Ajouter, import ciblé, libellés dérivés (spec experience-carnet § 4.4, § 4.5, D-UI-9, D-UI-10, § 5 ; § 7 T5)
  {
    const { withRepo } = await import('./sync-fixture.js');
    const { sha256Hex } = await import('../src/core/hash.js');
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const lire = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); return r.text(); };
    const H = (c) => c.repeat(64); // une empreinte lisible : H('b') = « bbbb… » (64)
    const DATE = '2026-10-23T12:00:00.000Z';
    const attendre = async (cond, quoi) => { for (let i = 0; i < 300; i += 1) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 10)); } throw new Error('attente dépassée (3 s) : ' + quoi); };
    // Une image de test : un aplat et un coin clair ; un File, comme un sélecteur de fichiers.
    const imageTest = async (nom, couleur, l = 320, h = 240) => { const toile = new OffscreenCanvas(l, h); const cx = toile.getContext('2d'); cx.fillStyle = couleur; cx.fillRect(0, 0, l, h); cx.fillStyle = '#fff'; cx.fillRect(0, 0, l >> 2, h >> 2); return new File([await toile.convertToBlob({ type: 'image/jpeg', quality: 0.9 })], nom, { type: 'image/jpeg' }); };
    const nouvelleScene = (largeur = 900) => { const s = document.createElement('div'); s.style.cssText = `position:absolute;left:-10000px;top:0;width:${largeur}px`; document.body.append(s); return s; };
    // T5 ronde 1 : la feuille servie, injectée le temps d'un bloc (comme tests/theme.js) — une règle neuve se MESURE (I-UI-4), elle ne se lit pas dans le source.
    const feuilleServie = async () => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '../styles.css?v=' + Date.now(); await new Promise((r) => { link.onload = r; link.onerror = r; document.head.append(link); }); return link; };
    const bouton = (racine, texte) => [...(racine?.querySelectorAll('button') || [])].find((b) => b.textContent === texte) || null;
    const sectionNommee = (racine, titre) => [...racine.querySelectorAll('section')].find((s) => s.querySelector(':scope > h2')?.textContent === titre) || null;
    const avant = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const fiche = (id, over = {}) => ({ id, edition_id: null, original_title: 'Plat ' + id, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, source_page_ids: [], current_version_id: 'rv_' + id, tags: [], cuisines: [], favorite: false, ingredient_ids: [], created_at: DATE, updated_at: DATE, ...over });
    const version = (rid, over = {}) => ({ id: 'rv_' + rid, recipe_id: rid, kind: 'extraction', status: null, servings: 4, prep_minutes: 10, cook_minutes: 25, active_minutes: null, total_minutes: null,
      ingredients: [{ id: 'ri_' + rid, source_text: '1 pomme', name_text: 'pomme', quantity: { raw: '1', value: 1 }, unit_id: null, verification_state: 'verified' }], steps: [{ id: 'st_' + rid, position: 1, text: 'Cuire.' }, { id: 'st2_' + rid, position: 2, text: 'Servir.' }],
      constraints: {}, changes: '', notes: '', provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: null, convention_snapshot: null }, verification_state: 'verified', created_at: DATE, updated_at: DATE, ...over });
    const localeAvantT5 = getUiLocale(); setUiLocale('fr');
    try {
      await bloc('T5 — Aujourd’hui : en-tête, barre hors carte, puces, grilles de cartes-plat, UNE passe getFiles, cuissons hors du <a>, sections plain (§ 4.4)', () => withRepo(async (repo, db) => {
        const { renderHome } = await import('../src/ui/home.js');
        const { buildDocs } = await import('../src/domain/search.js');
        const { formatDate } = await import('../src/core/dom.js');
        const BU = await import('../src/core/blob-urls.js');
        const scene = nouvelleScene(); let feuille = null;
        const vraiFetch = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); };
        try {
          feuille = await feuilleServie();
          const jpeg = await imageTest('fav.jpg', '#c63'); const sha = await sha256Hex(jpeg);
          await repo.putFile(sha, jpeg, { mime: 'image/jpeg', origin: 'device' });
          // Quatre fiches : deux favorites (octets ici / pointeur sans octets), une cuisinée ni favorite ni illustrée, une ni favorite ni cuisinée AVEC pointeur (jamais lue).
          const recettes = [fiche('rc_f1', { favorite: true, photo_sha256: sha }), fiche('rc_f2', { favorite: true, photo_sha256: H('b') }), fiche('rc_c1'), fiche('rc_x', { photo_sha256: H('c') })];
          const versions = recettes.map((r) => version(r.id));
          const histoire = [
            { id: 'ch1', recipe_id: 'rc_c1', recipe_version_id: 'rv_rc_c1', cooked_at: '2026-10-22T18:00:00.000Z', servings: 2, rating: 2, redo: true },
            { id: 'ch2', recipe_id: 'rc_f1', recipe_version_id: 'rv_rc_f1', cooked_at: '2026-10-21T18:00:00.000Z', servings: 4, rating: null, redo: false },
            { id: 'ch3', recipe_id: 'rc_absente', recipe_version_id: null, cooked_at: '2026-10-20T18:00:00.000Z' }]; // une cuisson d'une fiche inconnue : pas rendue (comme avant)
          const docs = buildDocs({ recipes: recettes, versions, editions: [], books: [], dishes: [], links: [], translations: [], history: histoire });
          const ctx = { recipes: recettes, docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])), cook_history: histoire,
            cook_sessions: [{ id: 'cs1', recipe_id: 'rc_c1', status: 'active', updated_at: DATE, progress: { total_steps: 2, done_step_ids: ['st_rc_c1'] } }],
            inventory: [{ id: 'inv1', label: 'Épinards', quantity_text: '1 sac', use_by: new Date(Date.now() + 86400000).toISOString() }],
            settings: { rediscover_enabled: false }, book_editions: [], books: [], library_activity: [], rediscovery_prefs: [] };
          // L'espion compte les lectures de fichiers : UNE passe getFiles (le sac) sur les cartes rendues ; et, sur l'INSTANCE de base (db.get / db.getMany du
          // magasin files, comme T2), exactement ces lectures-là — une lecture carte par carte faite par le module (vignettePlat, repo.getFile) s'y verrait (T5 ronde 1).
          const appels = []; const depot = { ...repo, getFiles: async (shas) => { appels.push([...shas]); return repo.getFiles(shas); } };
          const lectures = []; const vraiGet = db.get.bind(db); const vraiGetMany = db.getMany.bind(db);
          db.get = (store, key) => { if (store === 'files') lectures.push(key); return vraiGet(store, key); };
          db.getMany = (store, keys) => { if (store === 'files') lectures.push(...keys); return vraiGetMany(store, keys); };
          let root;
          try { root = await renderHome({}, {}, ctx, { repo: depot }); scene.append(root); await new Promise((r) => setTimeout(r, 30)); } finally { delete db.get; delete db.getMany; }
          const ordre = [...root.children].map((n) => (n.tagName === 'HEADER' ? 'header' : n.tagName === 'SECTION' ? n.querySelector(':scope > h2')?.textContent ?? null : n.className));
          eq(ordre, ['header', 'recherche-accueil stack', 'Reprendre ma recette', 'Favoris', 'Dernières cuissons', 'À utiliser en priorité'],
            'Aujourd’hui : les enfants directs dans l’ordre — en-tête, recherche (barre et puces), Reprendre ma recette, Favoris, Dernières cuissons, À utiliser en priorité (§ 4.4 ; T5 ronde 1)');
          const entete = root.querySelector(':scope > header'); const barre = root.querySelector('.search-bar'); const puces = root.querySelector('.chips');
          eq([entete?.querySelector('h1')?.textContent, entete?.querySelector('p.muted')?.textContent, root.querySelectorAll('.card.sage').length, !!barre?.closest('.card'), !!puces?.closest('.card'), avant(entete, barre), avant(barre, puces),
            barre?.querySelector('input[type="search"]')?.getAttribute('placeholder'), bouton(barre, 'Chercher')?.classList.contains('primary'), puces?.querySelectorAll('.chip.clickable').length],
            ['Qu’est-ce qu’on cuisine ?', 'Cherche une recette, un ingrédient, une envie.', 0, false, false, true, true, 'Qu’est-ce qu’on cuisine ?', true, 4],
            'Aujourd’hui : pageHeader (titre, sous-titre § 5) puis .search-bar hors de toute .card (plus de .card.sage), puis les quatre puces d’exemple hors de toute carte ; « Chercher » reste primaire, le placeholder est inchangé');
          const favoris = sectionNommee(root, 'Favoris'); const grilleF = favoris?.querySelector('.grille-plats');
          const cartesF = [...(grilleF?.querySelectorAll('article.item-link.carte-plat') || [])];
          const parHref = (cartes, id) => cartes.find((c) => c.querySelector('h3 a')?.getAttribute('href') === `#/recipes/${id}`) || null;
          const avecPhoto = parHref(cartesF, 'rc_f1'); const sansOctets = parHref(cartesF, 'rc_f2');
          eq([favoris?.className, cartesF.length, !!avecPhoto?.querySelector('.carte-photo img.plat-vignette'), avecPhoto?.querySelector('.carte-photo img.plat-vignette')?.getAttribute('src')?.startsWith('blob:'), avecPhoto?.classList.contains('sans-photo'), sansOctets?.classList.contains('sans-photo'), sansOctets?.querySelectorAll('img').length, favoris?.querySelectorAll('a.item-link.card').length],
            ['plain', 2, true, true, false, false, 0, 0],
            'Favoris : section.plain > div.grille-plats de cartes-plat ; octets ici → .carte-photo img.plat-vignette en blob: (décision synchrone) ; pointeur sans octets → .sans-photo sans aucune img (I-UI-5) ; aucune carte horizontale');
          eq([appels.length, appels[0] ? [...appels[0]].sort() : null, [...new Set(lectures)].sort()], [1, [H('b'), sha].sort(), [H('b'), sha].sort()],
            'Aujourd’hui : UNE passe repo.getFiles, sur les empreintes des cartes RENDUES seulement (rc_f1 et rc_f2 ; rc_x, ni favorite ni cuisinée, n’est jamais lue) , dédoublonnées par l’écran (rc_f1, favorite ET cuisinée, une fois) ; sur l’instance de base, exactement ces lectures files — aucune carte ne relit son fichier (D-UI-5, F-3, I-UI-5 ; T5 ronde 1)');
          const cuissons = sectionNommee(root, 'Dernières cuissons');
          const cellules = [...(cuissons?.querySelectorAll('.grille-plats .cellule-cuisson') || [])];
          const celluleDe = (id) => cellules.find((c) => c.querySelector('article.carte-plat h3 a')?.getAttribute('href') === `#/recipes/${id}`) || null;
          const refaire = (cell) => [...(cell?.querySelectorAll('a.btn') || [])].find((a) => a.textContent === 'Refaire comme la dernière fois') || null;
          const c1 = celluleDe('rc_c1'); const carte1 = c1?.querySelector('article.carte-plat'); const date1 = c1?.querySelector('.cuisson-date'); const r1 = refaire(c1);
          eq([cuissons?.className, cellules.length, !!carte1, !!date1 && !carte1.contains(date1), !!r1 && !carte1.contains(r1), date1?.textContent, r1?.getAttribute('href'), r1?.className, avant(carte1, date1), avant(date1, r1)],
            ['plain', 2, true, true, true, `${formatDate('2026-10-22T18:00:00.000Z')} · ★★`, '#/recipes/rc_c1?v=rv_rc_c1&servings=2', 'btn small', true, true],
            'Dernières cuissons : section.plain > grille de 2 cellules (la cuisson d’une fiche inconnue n’est pas rendue) ; la date (★★) puis « Refaire comme la dernière fois » (même href qu’avant) sont HORS du <a> de la carte, sous elle, dans la cellule (§ 4.4, H-16)');
          const c2 = celluleDe('rc_f1');
          eq([c2?.querySelector('.cuisson-date')?.textContent, !!c2?.querySelector('article.carte-plat .carte-photo img.plat-vignette'), refaire(c2)?.getAttribute('href')],
            [`${formatDate('2026-10-21T18:00:00.000Z')} · à ne pas refaire`, true, '#/recipes/rc_f1?v=rv_rc_f1&servings=4'],
            'Dernières cuissons : « à ne pas refaire » sur la date ; la carte-plat d’une cuisson porte sa photo (la même passe getFiles sert favoris et cuissons)');
          // T5 ronde 1 (feuille servie) : la barre est suivie de 1,6 rem ; dans une rangée de cuissons, la carte s'étire (.cellule-cuisson > .carte-plat { flex: 1 }) —
          // cartes de même hauteur et dates alignées, la carte à photo étant de nature plus haute que la carte sans photo.
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize); const boite = (n) => n.getBoundingClientRect();
          const carte2 = c2?.querySelector('article.carte-plat'); const date2 = c2?.querySelector('.cuisson-date'); const [h1c, h2c] = [boite(carte1).height, boite(carte2).height];
          ok(Math.abs(parseFloat(getComputedStyle(root.querySelector('.recherche-accueil')).marginBottom) - 1.6 * rem) < 0.5 && h2c > 100 && Math.abs(h1c - h2c) < 1 && Math.abs(boite(date1).top - boite(date2).top) < 1,
            `Aujourd’hui (feuille servie) : .recherche-accueil suivie de 1,6 rem ; cartes de cuisson de même hauteur (${Math.round(h1c)} / ${Math.round(h2c)} px), dates alignées (.cellule-cuisson > .carte-plat { flex: 1 })`);
          eq([sectionNommee(root, 'Reprendre ma recette')?.className, !!sectionNommee(root, 'Reprendre ma recette')?.querySelector('a.item-link.card.flat[href="#/cook/cs1"]'), sectionNommee(root, 'À utiliser en priorité')?.className, !!sectionNommee(root, 'À utiliser en priorité')?.querySelector('a.btn.small[href="#/kitchen?tab=inventory"]'), sectionNommee(root, 'Bienvenue')],
            ['plain', true, 'plain', true, null],
            'Aujourd’hui : « Reprendre ma recette » et « À utiliser en priorité » en section.plain, contenu inchangé ; pas de « Bienvenue » quand la bibliothèque a des recettes');
          const vide = await renderHome({}, {}, { ...ctx, recipes: [], docs: [], docsByRecipe: new Map(), cook_sessions: [], cook_history: [], inventory: [] }, { repo: depot });
          eq([sectionNommee(vide, 'Bienvenue')?.className, !!sectionNommee(vide, 'Bienvenue')?.querySelector('a.btn.primary[href="#/add"]'), appels.length, vide.querySelectorAll('.grille-plats').length], ['card', true, 1, 0],
            'Aujourd’hui vide : « Bienvenue » reste une section.card avec « Ajouter » primaire ; sans carte rendue, aucune lecture de fichiers de plus ; aucune grille');
          // EI-T5-2 (hors brief) : un pointeur qui n'est pas une empreinte (pointeurValide, la règle de la bibliothèque et de la fiche livre) n'est ni lu ni passé à la carte.
          const appels2 = []; const depot2 = { ...repo, getFiles: async (shas) => { appels2.push([...shas]); return repo.getFiles(shas); } };
          const bizarre = fiche('rc_z', { favorite: true, photo_sha256: 'pas-une-empreinte' });
          const docsZ = buildDocs({ recipes: [bizarre], versions: [version('rc_z')], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
          const rz = await renderHome({}, {}, { ...ctx, recipes: [bizarre], docs: docsZ, docsByRecipe: new Map(docsZ.map((d) => [d.recipe.id, d])), cook_sessions: [], cook_history: [], inventory: [] }, { repo: depot2 });
          eq([appels2.length, rz.querySelectorAll('.grille-plats article.carte-plat.sans-photo').length, rz.querySelectorAll('img').length], [0, 1, 0],
            'Aujourd’hui : un pointeur photo qui n’est pas une empreinte n’est pas lu (aucun getFiles) et la carte reste sans photo (pointeurValide, EI-T5-2)');
          // T5 ronde 1 : Redécouvrir écrit par le sac injecté (le même que getFiles), jamais par le module en dehors de lui.
          const ecrits = []; const depot3 = { ...repo, getFiles: async () => new Map(), save: async (store, row) => { ecrits.push(store); return repo.save(store, row); } };
          const edR = { id: 'ed_r', book_id: 'b_r' }; const livreR = { id: 'b_r', title: 'Vieux livre', author: 'E. F.' }; const refR = fiche('rc_r', { edition_id: 'ed_r' });
          await repo.saveBatch({books:[livreR],book_editions:[edR]}, {conditions:{book_editions:[{key:edR.id,absente:true}]}});
          await renderHome({}, {}, { ...ctx, settings: { rediscover_enabled: true }, book_editions: [edR], books: [livreR], recipes: [refR], docs: [], docsByRecipe: new Map(), library_activity: [], rediscovery_prefs: [], cook_history: [], cook_sessions: [], inventory: [] }, { repo: depot3 });
          eq(ecrits, ['rediscovery_prefs'], 'Redécouvrir : la suggestion notée (last_suggested_at) s’écrit par le sac injecté de renderHome, jamais par le module hors du sac (T5 ronde 1)');
          // T5 ronde 1 : une note de cuisson reçue hostile (1e9, -1, 2.5) ne fait plus lever la page (RangeError de '★'.repeat) — la date seule, sans étoile.
          const { etoiles } = await import('../src/ui/components.js');
          eq([1, 5, 0, 6, 2.5, '3', null, -1, 1e9].map((n) => etoiles(n)), ['★', '★★★★★', '', '', '', '', '', '', ''], 'etoiles : une note entière de 1 à 5 donne ses étoiles, toute autre valeur reçue rien (cook.js n’écrit que 1 à 5)');
          const notes = [1e9, -1, 2.5].map((rating, i) => ({ id: 'chn' + i, recipe_id: 'rc_c1', recipe_version_id: 'rv_rc_c1', cooked_at: `2026-10-1${i}T18:00:00.000Z`, servings: 2, rating }));
          const rn = await renderHome({}, {}, { ...ctx, cook_history: notes, cook_sessions: [], inventory: [] }, { repo: depot2 });
          eq([...rn.querySelectorAll('.cuisson-date')].map((n) => n.textContent), [...notes].reverse().map((h) => formatDate(h.cooked_at)), 'Aujourd’hui : une note reçue hostile (1e9, -1, 2.5) ne fait pas lever la page — la date de chaque cuisson, sans étoile (T5 ronde 1)');
        } finally { globalThis.fetch = vraiFetch; scene.remove(); feuille?.remove(); BU.revoquerUrlsDeBlob(); }
      }));

      await bloc('T5 — libellés D-UI-10 : availabilityBadge courts, « À importer » seulement pour reference_only sans adresse, STATE_LABELS, en.js, compteurs', () => withRepo(async (repo, db) => {
        const { availabilityBadge } = await import('../src/ui/components.js');
        const { label } = await import('../src/core/i18n.js');
        const { EN } = await import('../src/i18n/en.js');
        const { renderLibrary } = await import('../src/ui/library.js');
        const badge = (r) => { const b = availabilityBadge(r); return [b.className, b.textContent]; };
        eq([badge({ availability: 'reference_only', printed_page: 12 }), badge({ availability: 'reference_only' }), badge({ availability: 'reference_only', printed_page: 0 }), badge({ availability: 'reference_only', source_url: 'https://a.test/' }),
          badge({ availability: 'available' }), badge({ availability: 'available', source_url: 'https://a.test/' }), badge({ availability: 'partial' }), badge({ availability: 'partial', source_url: 'https://a.test/', printed_page: 3 }), badge({})],
          [['badge reference', 'À importer · p. 12'], ['badge reference', 'À importer'], ['badge reference', 'À importer'], ['badge reference', 'Lien web'], ['badge available', 'Disponible'], ['badge available', 'Disponible'], ['badge partial', 'Partielle'], ['badge partial', 'Partielle'], ['badge reference', '']],
          'availabilityBadge : textes courts — « À importer · p. {p} » (page > 0) / « À importer », « Lien web » (signet), « Disponible », « Partielle » ; classes inchangées ; availability inconnue → badge reference vide, comme avant (D-UI-10, H-19)');
        const porteurs = [];
        for (const availability of ['available', 'partial', 'reference_only', undefined]) for (const source_url of [null, 'https://a.test/x']) { if (availabilityBadge({ availability, source_url, printed_page: 7 }).textContent.startsWith('À importer')) porteurs.push([availability, source_url]); }
        eq(porteurs, [['reference_only', null]], '« À importer » n’apparaît que pour reference_only SANS source_url (huit combinaisons) — mutant « posé sur une available » : rouge');
        eq([label('availability', 'reference_only'), label('availability', 'available'), label('availability', 'partial')], ['À importer', 'Recette disponible', 'Partiellement disponible'],
          'STATE_LABELS.availability : seule reference_only change (« À importer » ; son seul lecteur est dish.js — comparaison et rattachements —, ni les exports ni Redécouvrir ne le lisent) ; available et partial gardent leur libellé long (D-UI-10, H-19)');
        // T5 ronde 1 : la page n'est affichée que bornée (un entier de 1 à 9999, la borne de l'écran d'import) ; un état hors vocabulaire rend un badge VIDE
        // (jamais la valeur reçue ni une clé du prototype) ; label() ne lit que des clés propres.
        eq([-3, 12.5, '12', 'verifiee par le chef', {}, 10000, 9999].map((p) => availabilityBadge({ availability: 'reference_only', printed_page: p }).textContent),
          ['À importer', 'À importer', 'À importer', 'À importer', 'À importer', 'À importer', 'À importer · p. 9999'], 'availabilityBadge : « · p. N » seulement pour un entier de 1 à 9999 — négatif, décimal, texte, objet ou 10000 → « À importer » seul (fiche reçue = donnée hostile)');
        eq([badge({ availability: 'constructor' }), badge({ availability: '__proto__' }), badge({ availability: 'x'.repeat(300) }), label('availability', 'constructor'), label('availability', '__proto__')],
          [['badge reference', ''], ['badge reference', ''], ['badge reference', ''], 'constructor', '__proto__'], 'availabilityBadge : un état hors vocabulaire → badge vide (jamais la valeur reçue) ; label() ne lit que les clés PROPRES de STATE_LABELS (« constructor », « __proto__ » ne lisent pas le prototype)');
        // « Une adresse » a UNE définition (aUneAdresse, components.js ; library.js la ré-exporte pour book.js) : une chaîne non vide — 42 ou un objet n'en sont pas.
        const LIB = await import('../src/ui/library.js'); const K = await import('../src/ui/components.js');
        eq([LIB.aUneAdresse === K.aUneAdresse, badge({ availability: 'reference_only', source_url: 42 }), badge({ availability: 'reference_only', source_url: { href: 'https://a.test/' } }), badge({ availability: 'reference_only', source_url: '' })],
          [true, ['badge reference', 'À importer'], ['badge reference', 'À importer'], ['badge reference', 'À importer']], '« une adresse » : UNE définition partagée par le badge et la Bibliothèque (aUneAdresse) — une adresse qui n’est pas une chaîne non vide ne fait pas un signet (T5 ronde 1)');
        // T5 ronde 1 (H-19, I-UI-1) : STATE_LABELS.availability n'est lu que par la comparaison de plats (dish.js) — un signet y dit « Lien web », comme son badge,
        // jamais « À importer » ; un état hors vocabulaire n'y dit rien. Dans la VRAIE rangée « Provenance » aussi ; et une note reçue hostile n'y fait rien lever.
        const D = await import('../src/ui/dish.js'); const { buildDocs } = await import('../src/domain/search.js');
        eq([D.provenanceComparee({ recipe: { availability: 'reference_only', source_url: 'https://a.test/x' } }), D.provenanceComparee({ recipe: { availability: 'reference_only', printed_page: 12 }, book: { title: 'Mon livre', author: 'A. B.' } }), D.provenanceComparee({ recipe: { availability: 'constructor' } })],
          ['Lien web', 'Mon livre · A. B. · p. 12 · À importer', ''], 'provenanceComparee : un signet → « Lien web » (jamais « À importer ») ; une référence de livre → « À importer » ; un état hors vocabulaire → rien');
        const plat = { id: 'di_t5', labels: { fr: { label: 'Tarte' } } };
        const sig = fiche('rc_ds', { original_title: 'Signet', availability: 'reference_only', verification_state: 'unverified', current_version_id: null, source_url: 'https://a.test/tarte' }); const cuite = fiche('rc_dc', { original_title: 'Cuite' });
        const docsD = buildDocs({ recipes: [sig, cuite], versions: [version('rc_dc')], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
        const pageD = await D.renderDish({ id: 'di_t5' }, { cmp: 'rc_ds,rc_dc' }, { dishesById: new Map([['di_t5', plat]]), dish_recipe_links: [sig, cuite].map((r) => ({ id: 'dl_' + r.id, dish_id: 'di_t5', recipe_id: r.id, state: 'confirmed' })), recipes: [sig, cuite],
          recipesById: new Map([[sig.id, sig], [cuite.id, cuite]]), docsByRecipe: new Map(docsD.map((d) => [d.recipe.id, d])), cook_history: [{ id: 'chd', recipe_id: 'rc_dc', recipe_version_id: 'rv_rc_dc', cooked_at: DATE, rating: 1e9 }], ingredientsById: new Map(), editionsById: new Map(), editionLabel: () => '' });
        const rangee = (nom) => [...pageD.querySelectorAll('table.compare tr')].find((tr) => tr.firstElementChild?.textContent === nom) ?? null;
        eq([[...(rangee('Provenance')?.querySelectorAll('td') || [])].map((td) => td.textContent), rangee('Expérience')?.querySelectorAll('td')[1]?.textContent.includes('★') ?? null], [['Lien web', 'Recette disponible'], false],
          'comparaison de plats (rendue) : la rangée « Provenance » d’un signet dit « Lien web » ; une note reçue hostile (1e9) ne fait pas lever la page et n’affiche aucune étoile');
        setUiLocale('en');
        try {
          eq([label('availability', 'reference_only'), availabilityBadge({ availability: 'reference_only', printed_page: 12 }).textContent, availabilityBadge({ availability: 'available' }).textContent, availabilityBadge({ availability: 'partial' }).textContent, availabilityBadge({ availability: 'reference_only' }).textContent],
            ['To import', 'To import · p. 12', 'Available', 'Partial', 'To import'], 'interface anglaise : « To import », « To import · p. 12 », « Available », « Partial » (§ 5)');
          eq([label('availability', 'constructor'), label('availability', 'reference_only')], ['constructor', 'To import'], 'interface anglaise : label() et t() ne lisent que des clés PROPRES — une valeur reçue « constructor » reste ce texte, jamais une fonction du prototype (T5 ronde 1)');
        } finally { setUiLocale('fr'); }
        eq(['À importer', 'À importer · p. {p}', 'Disponible', 'Partielle', 'Cherche une recette, un ingrédient, une envie.', 'Page {n} · p. {p}', '{n} à importer'].map((k) => EN[k]),
          ['To import', 'To import · p. {p}', 'Available', 'Partial', 'Search a recipe, an ingredient, a craving.', 'Page {n} · p. {p}', '{n} to import'], 'en.js : les sept clés de la tâche portent l’anglais de la spec § 5');
        eq(['{n} repérée(s)', 'Repérée dans ton livre', 'Le numéro de page n’a pas pu être enregistré. Réessaie.'].map((k) => Object.hasOwn(EN, k)), [false, false, true], 'en.js : les deux clés orphelines de T5 (« {n} repérée(s) », « Repérée dans ton livre » : plus aucun t() ne les porte) ont quitté le dictionnaire (§ 5) ; la phrase d’échec de la ronde 1 a son entrée (T5 ronde 1)');
        // Compteur library.js:73 (grille Livres) : « {n} à importer » à la place de « {n} repérée(s) » ; base jetable (renderLibrary lit repo.getFiles pour les couvertures).
        const ed = { id: 'ed_k', book_id: 'b_k', year: 2020 }; const livre = { id: 'b_k', title: 'Mon livre', author: 'A. B.', cuisines: [], tags: [] };
        const refs = [fiche('rc_k1', { edition_id: 'ed_k' }), fiche('rc_k2', { edition_id: 'ed_k', availability: 'reference_only', verification_state: 'unverified', current_version_id: null, printed_page: 12 }), fiche('rc_k3', { edition_id: 'ed_k', availability: 'reference_only', verification_state: 'unverified', current_version_id: null, printed_page: 40 })];
        const ctxL = { book_editions: [ed], books: [livre], booksById: new Map([['b_k', livre]]), editionsById: new Map([['ed_k', ed]]), recipes: refs, recipe_versions: [], recipesById: new Map(refs.map((r) => [r.id, r])), docs: [], docsByRecipe: new Map(),
          rediscovery_prefs: [], dishes: [], dish_recipe_links: [], source_documents: [], source_pages: [], scan_sessions: [], settings: {}, sync: {}, editionLabel: () => livre.title };
        // T5 ronde 1 : renderLibrary est monté sans réseau (fetch remplacé par un lanceur d'erreur le temps du montage, remis ensuite).
        const sansReseau = async (f) => { const vrai = globalThis.fetch; globalThis.fetch = async (u) => { throw new Error('aucun reseau attendu : ' + u); }; try { return await f(); } finally { globalThis.fetch = vrai; } };
        const biblio = await sansReseau(() => renderLibrary({}, { tab: 'books' }, ctxL));
        const legende = [...biblio.querySelectorAll('.muted')].map((n) => n.textContent).find((x) => x.includes('référence(s)')) ?? null;
        eq([legende, /repérée/i.test(biblio.textContent)], ['1 disponible(s) · 0 partielle(s) · 2 référence(s) · 0 état(s) inconnu(s)', false], 'library.js (grille Livres, l. 73) : « {n} disponible(s) · {m} à importer » sous la couverture ; plus aucun « repérée(s) »');
        // EI-T5-1 (D-UI-10, H-19 ; hors brief) : un signet rangé dans un livre (reference_only + adresse) est un lien web, jamais « à importer » — la définition
        // d'estAImporter (library.js), celle du sous-titre de la fiche livre (T4) ; un livre qui ne porte qu'un signet dit « Aucune recette indexée ».
        const ed2 = { id: 'ed_s', book_id: 'b_s', year: 2021 }; const livre2 = { id: 'b_s', title: 'Liens', author: 'C. D.', cuisines: [], tags: [] };
        const signetDe = (id, edition_id) => fiche(id, { edition_id, availability: 'reference_only', verification_state: 'unverified', current_version_id: null, source_url: `https://a.test/${id}` });
        const refs2 = [...refs, signetDe('rc_k4', 'ed_k'), signetDe('rc_s1', 'ed_s')];
        const biblio2 = await sansReseau(() => renderLibrary({}, { tab: 'books' }, { ...ctxL, book_editions: [ed, ed2], books: [livre, livre2], booksById: new Map([['b_k', livre], ['b_s', livre2]]), editionsById: new Map([['ed_k', ed], ['ed_s', ed2]]),
          recipes: refs2, recipesById: new Map(refs2.map((r) => [r.id, r])), editionLabel: (e) => (e?.id === 'ed_s' ? livre2.title : livre.title) }));
        eq([...biblio2.querySelectorAll('.grid.livres > div')].map((d) => d.querySelector('.bibliotheque-compteurs')?.textContent ?? null), ['0 disponible(s) · 0 partielle(s) · 1 référence(s) · 0 état(s) inconnu(s)', '1 disponible(s) · 0 partielle(s) · 3 référence(s) · 0 état(s) inconnu(s)'],
          'library.js (grille Livres) : un signet rangé dans un livre ne compte pas « à importer » (estAImporter, comme la fiche livre) ; un livre qui n’a qu’un signet dit « Aucune recette indexée » (EI-T5-1)');
        // T5 ronde 1 : le test de SOURCE de book.js et library.js (un t('…repérée…') cherché par regex) est retiré — hors des cas admis (app.js, filets i18n,
        // SHELL) ; le comportement le tient : la légende de la grille Livres ci-dessus (aucun « repérée »), et pour book.js les blocs de T4 (chips retirées, filtre « À importer »).
      }));

      await bloc('T5 — icônes au trait : la grille Ajouter et l’accueil d’un livre (D-UI-9)', async () => {
        const A = await import('../src/ui/add.js');
        const AL = await import('../src/ui/accueil-livre.js');
        eq(A.grilleModel().cartes.map((c) => c.ico), ['livres', 'appareil-photo', 'crayon', 'lien', 'etincelle', 'flocon'], 'grilleModel : ico = le NOM d’une icône d’icones.js, dans l’ordre des six cartes (plus d’émoji)');
        const gestes = Object.fromEntries(A.GRILLE_ACTIONS.map((a) => [a, () => {}]));
        const grille = A.renderGrille(A.grilleModel(), gestes);
        const svgs = [...grille.querySelectorAll('button.carte .carte-ico > svg')];
        eq([grille.querySelectorAll('button.carte').length, svgs.length, svgs.every((s) => s.getAttribute('aria-hidden') === 'true' && s.getAttribute('focusable') === 'false'), [...grille.querySelectorAll('.carte-ico')].every((n) => n.textContent.trim() === '')], [6, 6, true, true],
          'renderGrille : chaque .carte-ico porte un svg[aria-hidden=true][focusable=false] et aucun texte (plus d’émoji) ; six cartes');
        // T5 ronde 1 : chaque carte porte le svg de SON nom (c.ico), dans l'ordre — un rendu qui ignorerait c.ico (la même icône partout) rougit ; la feuille servie
        // le MESURE à 2 rem (.card.carte .carte-ico svg ; 24 px sans la règle).
        const { icone } = await import('../src/ui/icones.js');
        eq(svgs.map((s) => s.outerHTML), A.grilleModel().cartes.map((c) => icone(c.ico).outerHTML), 'renderGrille : le svg de chaque carte est celui de son nom, dans l’ordre (livres, appareil-photo, crayon, lien, etincelle, flocon)');
        const sceneI = nouvelleScene(); let feuilleI = null;
        try {
          feuilleI = await feuilleServie(); sceneI.append(grille);
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize); const w = svgs[0].getBoundingClientRect().width;
          ok(Math.abs(w - 2 * rem) < 0.5, `grille Ajouter (feuille servie) : l’icône d’une carte mesure 2 rem (${w} px ; .card.carte .carte-ico svg)`);
        } finally { sceneI.remove(); feuilleI?.remove(); }
        const m = AL.accueilLivreModel({ nouveau: '1' });
        eq(m.cartes.map((c) => c.ico), ['appareil-photo', 'page', 'horloge'], 'accueilLivreModel : ico = appareil-photo, page, horloge (D-UI-9, § 3.3)');
        const panneau = AL.renderAccueilLivre(m, {});
        eq([panneau.querySelectorAll('button.carte .carte-ico > svg').length, [...panneau.querySelectorAll('.carte-ico')].every((n) => n.textContent.trim() === '')], [3, true], 'renderAccueilLivre : trois svg, aucun émoji');
        eq([...panneau.querySelectorAll('button.carte .carte-ico > svg')].map((s) => s.outerHTML), ['appareil-photo', 'page', 'horloge'].map((n) => icone(n).outerHTML), 'renderAccueilLivre : le svg de chaque carte est celui de son nom — appareil-photo, page, horloge, dans l’ordre (T5 ronde 1 : un rendu qui ignorerait c.ico rougit)');
        let leve = null;
        try { A.renderGrille({ cartes: [{ action: 'pages', ico: 'inconnue', titre: 'x', sousTitre: 'y' }] }, { pages: () => {} }); } catch (e) { leve = e?.name || String(e); }
        eq(leve, 'TypeError', 'renderGrille : un nom d’icône inconnu lève TypeError (icone(nom), T1) — jamais une carte sans pictogramme en silence');
      });

      await bloc('T5 — import ciblé : badge « À importer » / « Partielle », × en coin de la vignette (nom accessible, ≥ 44 px), légende « Page 1 · p. 76 » et champ ouvert à la tape, Monter / Descendre inchangés (§ 4.5)', () => withRepo(async (repo, db) => {
        const UI = await import('../src/ui/import-cible.js');
        const BU = await import('../src/core/blob-urls.js');
        // EI-T5-a : la feuille est lue AVANT que fetch soit remplacé par le lanceur d'erreur (le texte dicté la lisait après : « aucun reseau attendu : …/styles.css »).
        const cssServie = (await lire('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
        // T5 ronde 1 : la scène, la feuille servie (la cible du × se MESURE, I-UI-4), le remplacement de fetch et les écritures de fixture sont posés DANS le try —
        // un rejet là ne laisse plus fetch remplacé ni la feuille injectée pour les blocs suivants.
        let scene = null; let link = null; const vraiFetch = globalThis.fetch; let reseau = 0;
        const NOW = '2026-10-23T12:00:00.000Z';
        const livre = { id: 'b5', title: 'Mon livre', author: 'A. B.', updated_at: DATE }; const edition = { id: 'ed5', book_id: 'b5', language: 'fr', updated_at: DATE };
        const ref = (id, over = {}) => fiche(id, { edition_id: 'ed5', original_title: 'Tarte aux pommes', availability: 'reference_only', verification_state: 'unverified', printed_page: 132, current_version_id: null, ...over });
        const manuelle = version('rc_t5p', { provenance: { source_page_ids: [], generated_by: 'manual', model: null, edition_id: 'ed5', convention_snapshot: null } });
        const SESSION = { access_token: 'jeton-carnet-sentinelle', user: { id: 'u1', email: 'a@exemple.invalid' } };
        const ctxDe = async () => { const recipes = await db.getAll('recipes'); const vs = await db.getAll('recipe_versions'); return { recipes, recipesById: new Map(recipes.map((r) => [r.id, r])), recipe_versions: vs, versionsByRecipe: repo.groupBy(vs, 'recipe_id'), versionsById: new Map(vs.map((v) => [v.id, v])), editionsById: new Map([['ed5', edition]]), booksById: new Map([['b5', livre]]), books: [livre], book_editions: [edition], pagesById: new Map(), imports: await db.getAll('imports'), settings: { llm: { provider: 'none' }, units: 'original', reading_locale: 'original' }, sync: { user: SESSION.user, auth: { jeton: async () => SESSION } }, conventionFor: () => null }; };
        const pick = { suivant: [] }; const pickFiles = async () => (pick.suivant.length ? pick.suivant.shift() : []);
        const navs = [], dits = [];
        const monter = async (id, { repo: depot = repo } = {}) => { const root = await UI.renderImportCible({ id }, {}, await ctxDe(), { repo: depot, navigate: (p) => navs.push(p), toast: (m) => dits.push(m), fetch: async () => { reseau += 1; throw new Error('aucun appel attendu'); }, pickFiles, maintenant: () => NOW }); scene.append(root); return root; };
        try {
          scene = nouvelleScene(); link = await feuilleServie();
          globalThis.fetch = async (u) => { reseau += 1; throw new Error('aucun reseau attendu : ' + u); };
          await db.mutate({ puts: { books: [livre], book_editions: [edition], recipes: [ref('rc_t5'), ref('rc_t5p', { availability: 'partial', verification_state: 'verified', current_version_id: 'rv_rc_t5p' }), ref('rc_t5e', { original_title: 'Clafoutis' })], recipe_versions: [manuelle] }, origin: 'device' });
          const root = await monter('rc_t5');
          eq([...root.querySelectorAll('.badge')].map((b) => [b.className, b.textContent]), [['badge reference', 'À importer']], 'écran d’import : badge « À importer » sur une référence — le sous-titre porte déjà « Mon livre · p. 132 » (§ 4.5, D-UI-10)');
          pick.suivant.push([await imageTest('a.jpg', '#c33'), await imageTest('b.jpg', '#3c3')]);
          bouton(root, 'Choisir des photos').click();
          await attendre(() => root.etatRoute().pageIds.length === 2, 'deux pages ajoutées');
          const [p1, p2] = root.etatRoute().pageIds;
          const figures = [...root.querySelectorAll('.thumbs figure')]; const fig1 = figures[0];
          const croix = fig1?.querySelector(':scope > button[data-role="retirer"]'); const legende = fig1?.querySelector('button[data-role="legende"]'); const champ = fig1?.querySelector('input[type="number"]');
          eq([figures.length, croix?.textContent, croix?.getAttribute('aria-label'), croix?.dataset.page, croix?.classList.contains('retirer'), legende?.textContent, legende?.dataset.page, legende?.getAttribute('aria-expanded'), champ?.hidden, !!bouton(root, 'Monter la page 1'), !!bouton(root, 'Descendre la page 1'), bouton(root, 'Retirer la page 1')],
            [2, '×', 'Retirer la page 1', p1, true, 'Page 1', p1, 'false', true, true, true, null],
            'vignette : le × (button.btn.retirer, data-role retirer) est enfant direct de la figure, nom accessible « Retirer la page 1 » ; légende « Page 1 » (pas de numéro imprimé) ; champ « p. imprimée » né hidden ; Monter / Descendre inchangés ; plus aucun bouton au TEXTE « Retirer la page 1 »');
          // T5 ronde 1 : chaque vignette dit SON rang (« Page 2 ») ; la légende nomme SON champ (aria-controls, ids distincts).
          const fig2 = figures[1]; const legende2 = fig2?.querySelector('button[data-role="legende"]'); const champ2 = fig2?.querySelector('input[type="number"]');
          eq([legende2?.textContent, !!champ?.id, legende?.getAttribute('aria-controls') === champ?.id, legende2?.getAttribute('aria-controls') === champ2?.id, champ?.id !== champ2?.id],
            ['Page 2', true, true, true, true], 'légende : la vignette 2 dit « Page 2 » ; chaque légende porte aria-controls vers SON champ « p. imprimée » (ids distincts ; I-UI-4)');
          // T5 ronde 1 : le coin est BORNÉ — à 8 px au plus du bord droit et du haut de la figure, dans sa moitié droite, sans recouvrir le numéro .num (en haut à
          // gauche) : un × posé en bas (sur Monter / Descendre) ou en haut à gauche rougit.
          const r = croix.getBoundingClientRect(); const rf = fig1.getBoundingClientRect(); const rn = fig1.querySelector(':scope > .num').getBoundingClientRect();
          const recouvre = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          ok(r.width >= 44 && r.height >= 44 && r.right <= rf.right + 1 && r.top >= rf.top - 1 && rf.right - r.right <= 8 && r.top - rf.top <= 8 && r.left > rf.left + rf.width / 2 && !recouvre(r, rn),
            `× : cible ${Math.round(r.width)} × ${Math.round(r.height)} ≥ 44 px, dans le coin supérieur droit de la vignette (à ${Math.round(rf.right - r.right)} px du bord droit et ${Math.round(r.top - rf.top)} px du haut ; sans recouvrir le numéro) — feuille servie injectée, I-UI-4`);
          legende.click();
          eq([champ.hidden, document.activeElement === champ, legende.getAttribute('aria-expanded')], [false, true, 'true'], 'légende : la tape ouvre le champ « p. imprimée » et lui donne le focus (aria-expanded true)');
          // T5 ronde 1 (I-UI-4) : la légende est une VRAIE bascule — une seconde tape referme le champ (aria-expanded false, focus rendu à la légende) ; Échap aussi,
          // sans rien écrire et en remettant la valeur courante.
          legende.click();
          eq([champ.hidden, legende.getAttribute('aria-expanded'), document.activeElement === legende], [true, 'false', true], 'légende : une seconde tape referme le champ (aria-expanded false), le focus revient à la légende');
          legende.click(); champ.value = '5';
          champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          eq([champ.hidden, legende.getAttribute('aria-expanded'), document.activeElement === legende, champ.value, (await db.get('source_pages', p1)).printed_page ?? null], [true, 'false', true, '', null],
            'légende : Échap referme le champ sans rien écrire (la valeur courante est remise), le focus revient à la légende');
          legende.click();
          champ.value = '76'; champ.dispatchEvent(new Event('change', { bubbles: true }));
          await attendre(async () => (await db.get('source_pages', p1)).printed_page === 76, 'p. imprimée écrite');
          eq([legende.textContent, legende.getAttribute('aria-expanded'), champ.hidden, (await db.get('source_pages', p1)).printed_page, root.etatRoute().pageIds, root.querySelector('button[data-role="legende"]') === legende],
            ['Page 1 · p. 76', 'false', true, 76, [p1, p2], true],
            'légende : après la saisie, « Page 1 · p. 76 » réécrite SUR PLACE (le même nœud : aucun redessin, page_ids intacts), le champ se referme ; source_pages.printed_page écrit');
          eq(document.activeElement === legende, true, 'légende : le champ refermé sous le focus le rend à la légende, jamais au body (EI-T5-3, I-UI-4)');
          legende.click(); champ.value = '0'; champ.dispatchEvent(new Event('change', { bubbles: true }));
          await attendre(() => champ.value === '76', 'champ remis à la valeur courante');
          eq([legende.textContent, champ.hidden, (await db.get('source_pages', p1)).printed_page], ['Page 1 · p. 76', false, 76], 'légende : une saisie illisible (« 0 ») n’écrit rien, la légende garde « p. 76 », le champ reste ouvert pour corriger (T4-R1 du lot A tenu)');
          // T5 ronde 1 : chaque vignette réécrit SA légende, à SON rang (« Page 2 · p. 33 ») ; un redessin (Descendre) les rend depuis etat.pages, numéros compris.
          legende2.click(); champ2.value = '33'; champ2.dispatchEvent(new Event('change', { bubbles: true }));
          await attendre(async () => (await db.get('source_pages', p2)).printed_page === 33, 'p. imprimée de la page 2 écrite');
          eq([legende2.textContent, legende.textContent], ['Page 2 · p. 33', 'Page 1 · p. 76'], 'légende : la saisie sur la page 2 réécrit « Page 2 · p. 33 » — son rang, pas celui de la page 1 ; la page 1 garde « p. 76 »');
          bouton(root, 'Descendre la page 1').click();
          await attendre(() => root.etatRoute().pageIds[0] === p2, 'page 1 descendue');
          eq([...root.querySelectorAll('.thumbs figure button[data-role="legende"]')].map((b) => [b.dataset.page, b.textContent]), [[p2, 'Page 1 · p. 33'], [p1, 'Page 2 · p. 76']],
            'légende : après un redessin (Descendre), chaque vignette est rendue à son nouveau rang AVEC son numéro imprimé (etat.pages) — ni « Page 1 » partout, ni le numéro perdu');
          root.querySelector(`.thumbs figure > button[data-role="retirer"][data-page="${CSS.escape(p1)}"]`).click(); // le × de p1, rendu par le redessin
          await attendre(() => root.etatRoute().pageIds.length === 1, 'page retirée');
          const apres = [...root.querySelectorAll('.thumbs figure')];
          eq([root.etatRoute().pageIds, apres.length, apres[0]?.querySelector('button[data-role="retirer"]')?.getAttribute('aria-label'), apres[0]?.querySelector('button[data-role="legende"]')?.textContent, reseau, dits],
            [[p2], 1, 'Retirer la page 1', 'Page 1 · p. 33', 0, []],
            '× : « Retirer la page 1 » détache p1 (même geste qu’avant : la ligne source_pages reste) ; la vignette restante est renumérotée « Page 1 » (× et légende) ; aucun réseau, aucun toast');
          const partielle = await monter('rc_t5p');
          eq([...partielle.querySelectorAll('.badge')].map((b) => [b.className, b.textContent]), [['badge partial', 'Partielle']], 'écran d’import : badge « Partielle » sur une fiche partial (§ 4.5, D-UI-10)');
          // T5 ronde 1 : une écriture du numéro imprimé qui n'a PAS lieu — save en échec (quota), puis ligne source_pages absente — ne réécrit pas la légende, ne referme
          // pas le champ, ne touche pas la page en mémoire : le champ reste ouvert sur la valeur courante et l'échec est dit (les états d'écran suivent des écritures réelles).
          let panne = null; const repoPanne = { ...repo, get: async (store, id) => (panne === 'absente' && store === 'source_pages' ? undefined : repo.get(store, id)),
            save: async (store, row) => { if (panne === 'quota' && store === 'source_pages') throw new DOMException('quota (test)', 'QuotaExceededError'); return repo.save(store, row); } };
          const rootE = await monter('rc_t5e', { repo: repoPanne });
          pick.suivant.push([await imageTest('e.jpg', '#33c')]);
          bouton(rootE, 'Choisir des photos').click();
          await attendre(() => rootE.etatRoute().pageIds.length === 1, 'une page ajoutée (écran en panne)');
          const [pe] = rootE.etatRoute().pageIds; const legE = rootE.querySelector('button[data-role="legende"]'); const champE = rootE.querySelector('.thumbs input[type="number"]');
          const DIT = 'Le numéro de page n’a pas pu être enregistré. Réessaie.'; const nDits = dits.length;
          const etatE = async () => [legE?.textContent, legE?.getAttribute('aria-expanded'), champE?.hidden, champE?.value, (await db.get('source_pages', pe))?.printed_page ?? null, dits.at(-1) ?? null];
          const journal = []; const vraiErreur = console.error; console.error = (...a) => { journal.push(String(a[0])); };
          try {
            panne = 'quota'; legE.click(); champE.value = '76'; champE.dispatchEvent(new Event('change', { bubbles: true }));
            await attendre(() => dits.length > nDits, 'échec dit (quota)');
            eq([...(await etatE()), journal], ['Page 1', 'true', false, '', null, DIT, ['[cuisine-os] import_cible.page_imprimee']],
              'p. imprimée : un save en échec ne réécrit pas la légende ni ne referme le champ — il reste ouvert sur la valeur courante, rien en base, l’échec est dit (et journalisé)');
            panne = 'absente'; champE.value = '77'; champE.dispatchEvent(new Event('change', { bubbles: true }));
            await attendre(() => dits.length > nDits + 1, 'échec dit (ligne absente)');
            eq(await etatE(), ['Page 1', 'true', false, '', null, DIT], 'p. imprimée : une ligne source_pages absente (rien n’est écrit) ne réécrit pas la légende ni ne referme le champ — l’échec est dit');
          } finally { console.error = vraiErreur; panne = null; }
          // styles.css : les deux règles neuves de l'écran, lues sans commentaires (T-1, T-2, T-11 : ni display:none, ni couleur en dur, ni 56px, ni :hover hors @media).
          const css = cssServie;
          const croixCss = css.match(/(?:^|\})\s*\.thumbs \.btn\.retirer\s*\{([^}]*)\}/)?.[1] ?? null;
          const legCss = css.match(/(?:^|\})\s*\.thumbs \.legende\s*\{([^}]*)\}/)?.[1] ?? null;
          eq([croixCss !== null, /position:\s*absolute/.test(croixCss || ''), /min-width:\s*44px/.test(croixCss || ''), /min-height:\s*44px/.test(croixCss || ''), legCss !== null, [croixCss, legCss].some((x) => /display\s*:\s*none|#[0-9a-f]{3,8}\b|56px/i.test(x || '')), /\.thumbs\s+\.(?:btn\.retirer|legende)[^{}]*:hover/.test(css)],
            [true, true, true, true, true, false, false], 'styles.css : .thumbs .btn.retirer (position absolute, min-width et min-height 44px) et .thumbs .legende sont trouvées ; ni display:none, ni couleur en dur, ni 56px dans leurs corps ; aucun SÉLECTEUR :hover sur l’une ou l’autre, nulle part dans la feuille (T5 ronde 1 : un :hover se cherche dans les sélecteurs, jamais dans une déclaration) (T-1, T-2, T-11)');
        } finally { globalThis.fetch = vraiFetch; if (UI.volEnCours()) UI.reinitialiserImportCible(); scene?.remove(); link?.remove(); BU.revoquerUrlsDeBlob(); }
      }));
    } finally { setUiLocale(localeAvantT5); }
  }

  // ===== Tâche 6 — filets du lot (spec § 5, § 7 « Tests neufs » : filets i18n ; D-UI-4, D-UI-10 : chaînes retirées ; I-UI-4 : règles neuves)
  try {
    // S4 (lot UX) : une lecture de source qui échoue est un ROUGE nommé, jamais un source vide lu comme vert (V-F13 du lot web).
    const lireT6 = async (chemin) => { const r = await fetch(new URL(chemin, import.meta.url), { cache: 'no-store' }); if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status}`); const s = await r.text(); if (!s.trim() || /^\s*</.test(s)) throw new Error(`${chemin} : source vide ou page HTML inattendue`); return s; };
    // Ronde 1 (constat 20) : t('…') ET t("…") — un t() entre guillemets doubles n'échappe plus ni à l'inventaire ni aux chaînes retirées. Vague finale (constat
    // 13) : la lecture des clés est UNE définition, clesT de tests/ajouter.js (F13 la lit aussi), qui voit en plus t(`…`) sans ${…} ; son témoin est au bloc F13.
    // Ronde 1 (constats 10 et 20) : le lecteur de T1-R1 (chaînes '…', "…", `…` sautées ; commentaires // et /* */ retirés), recopié ici (bloc autonome) —
    // un t('…') laissé dans un commentaire ne compte plus comme un EMPLOI, et la NAV d'app.js se relit sans ses commentaires.
    const sansCommentairesT6 = (src) => { let out = ''; let q = null; for (let i = 0; i < src.length; i++) { const c = src[i]; if (q) { out += c; if (c === '\\') out += src[++i] ?? ''; else if (c === q) q = null; } else if (c === '/' && src[i + 1] === '/') { while (i + 1 < src.length && src[i + 1] !== '\n') i++; } else if (c === '/' && src[i + 1] === '*') { const fin = src.indexOf('*/', i + 2); i = fin < 0 ? src.length : fin + 1; } else { if (c === "'" || c === '"' || c === '`') q = c; out += c; } } return out; };
    const { EN } = await import('../src/i18n/en.js');
    const { MODULES_NEUFS, CHAINES_NEUVES_AILLEURS, clesT } = await import('./ajouter.js');
    const clesDe = clesT;
    // La table FR → EN des textes UI-1 (spec § 5, lignes UI-1 seulement ; les quatre lignes UI-2 vivent dans tests/apercu-web.js), plus quatre textes
    // que les tâches posent hors de la table § 5 (R-UI-38) : « Disponibles » (filtre § 4.3, T4), « Reprendre la séance » (§ 4.3, T4), « {n} à importer »
    // (compteur de library.js, T5), « Page {n} · p. {p} » (légende § 4.5, T5) — les anglais sont ceux de la tâche qui les pose et se relisent ici.
    // EI-T6-a, ronde 1 (constats 12 et 19 ; R-UI-41) : la ligne « {n} portions · {d} » de § 5 n'a plus de clé — T3 ronde 1 l'a retirée (R-UI-17) ; les
    // repères joignent « {n} portions » ou « 1 portion » et la durée par « · ». Ces deux clés sont ANTÉRIEURES au lot (en.js à f3672be, anglais inchangé) :
    // ce ne sont pas des textes neufs, elles rejoignent les clés réemployées ci-dessous. 31 paires : 27 de la spec § 5 (UI-1), quatre hors table.
    const TEXTES_UI1 = {
      'Bibliothèque': 'Library', 'Aller à la bibliothèque.': 'Go to the library.', 'Tes livres, tes trouvailles, tes recettes.': 'Your books, your finds, your recipes.',
      'Recettes': 'Recipes', 'Ajouter une recette': 'Add a recipe', 'Une recette, un ingrédient…': 'A recipe, an ingredient…',
      'Filtres': 'Filters', 'De mes livres': 'From my books', 'Du web': 'From the web', 'Recettes de mes livres à importer': 'Recipes from my books to import', 'Voir plus': 'Show more',
      'À importer': 'To import', 'À importer · p. {p}': 'To import · p. {p}', 'Disponible': 'Available', 'Disponibles': 'Available', 'Partielle': 'Partial',
      'De mon livre': 'From my book', // fidélité aux maquettes (28 octobre) : les deux lignes de source à hôte / titre deviennent « Du web » et « De mon livre »
      'Voir la page d’origine': 'View the original page', 'Portions, versions et autres gestes': 'Servings, versions and more',
      '{n} disponible(s)': '{n} available', 'Sélectionner': 'Select',
      'Effacer les filtres': 'Clear filters', 'Ajouter des pages d’index': 'Add index pages', 'Sommaire': 'Table of contents', 'Pages source': 'Source pages',
      'Cherche une recette, un ingrédient, une envie.': 'Search a recipe, an ingredient, a craving.', 'Aucune recette pour l’instant.': 'No recipes yet.',
      'Reprendre la séance': 'Resume the session', '{n} référence(s)': '{n} reference(s)', 'Page {n} · p. {p}': 'Page {n} · p. {p}',
    };
    // Clés RÉEMPLOYÉES par le lot (existaient avant lui : leur anglais ne change pas ; « Corriger » reste « Fix », H-14 ; « Mes livres » reste le
    // segment de la recherche, D-UI-4 ; « 1 portion » et « {n} portions » disent les portions des repères, R-UI-41). Existence, puis quatre anglais épinglés.
    const CLES_REEMPLOYEES = ['Corriger', 'Ingrédients', 'Préparation', 'Ajouter un livre', 'Favoris', 'Mes livres', 'Livres', 'Plats', '1 portion', '{n} portions'];
    // Les chaînes RETIRÉES par D-UI-4 et D-UI-10 (§ 5, dernier alinéa : les trois nommées + « Aller à Mes livres. », remplacée par la même décision).
    const CHAINES_RETIREES = ['+ Recette', '+ Pages d’index', 'Ouvrir le lien', 'Aller à Mes livres.'];
    // Où chaque texte neuf doit paraître comme t('…') (§ 4 ; un texte peut vivre dans plusieurs modules). Les modules de MODULES_NEUFS sont scannés
    // en entier par tests/ajouter.js ; les autres passent par CHAINES_NEUVES_AILLEURS, dont ce bloc vérifie qu'elle est À JOUR (calcul, pas relevé).
    const MODULES_UI1 = ['../src/ui/bibliotheque-liste.js','../src/ui/actions-contenu.js','../src/ui/navigation-contexte.js','../src/ui/library.js', '../src/ui/recipe.js', '../src/ui/book.js', '../src/ui/home.js', '../src/ui/components.js', '../src/ui/accueil-livre.js', '../src/ui/import-web.js', '../src/ui/import-cible.js', '../src/ui/add.js'];
    const HORS_MODULES_NEUFS = ['../src/ui/library.js', '../src/ui/recipe.js', '../src/ui/book.js', '../src/ui/home.js', '../src/ui/components.js'];
    // Ronde 1 (constat 19) : textes de la table que CE module écrivait déjà en t() à f3672be (mesuré) — antérieurs au module, ils ne se listent pas dans
    // CHAINES_NEUVES_AILLEURS (règle d'en-tête de tests/ajouter.js) ; leurs entrées en.js, elles, sont neuves (T2, T4) et la table les épingle.
    const DEJA_DANS_LE_MODULE = { '../src/ui/book.js': ['Toutes', 'Disponibles'] };
    // Ronde 1 (constat 2, faux-vert) : les clés t() SANS entrée en.js de ces cinq modules, toutes antérieures au lot (écrites dans ce module à f3672be,
    // sans entrée alors comme aujourd'hui : la dette i18n d'avant le lot, 8 + 37 + 23 + 1 + 9 = 78, relevée par la ronde 1). Toute AUTRE clé sans entrée rougit.
    const SANS_EN_ANTERIEURES = {
      '../src/ui/library.js': ['Aucun livre ne correspond.', 'Aucun plat défini. Crée « Puttanesca », puis rattache-lui les recettes de tes livres.',
        'Filtrer par titre, auteur, cuisine…', 'Nom du plat (anglais, facultatif)', 'Nom du plat (français)', 'Plat créé',
        'Similarité de titre seulement. Confirmer ou refuser ; un refus est mémorisé et reste réversible.',
        'Un plat rassemble des recettes apparentées de plusieurs livres, sans écraser leurs sources.'],
      '../src/ui/recipe.js': ['+ Nouveau plat…', 'Accepter',
        'Adaptation assistée : palier V1, non disponible dans cette version. Utilise « Créer ma version » pour décrire toi-même les changements.',
        'Aucune traduction {l} pour cette version.', 'Autre (texte libre)…',
        'Cette référence vient de l’index : ingrédients, durées et compatibilités alimentaires sont inconnus tant que la recette n’est pas numérisée. Ouvre le livre à cette page pour cuisiner, ou scanne la recette.',
        'Changer les portions, les unités ou la langue ne crée pas de nouvelle version. Les durées ne sont pas multipliées.',
        'Créer « Ma version » avec ce remplacement ? L’original reste inchangé.', 'Effets attendus (goût, texture, méthode, durée) et raison du remplacement',
        'Extraction IA ({m}) — vérifiée à la main ensuite ?', 'Inconnus', 'Ingrédient de remplacement', 'Je n’en ai pas ; texture un peu plus ferme ; même cuisson.',
        'Ma version créée ; contraintes et courses à réévaluer sur cette version.', 'Nom du plat (français)',
        'Observation liée à cette cuisson ; elle ne devient pas une règle universelle.', 'Original : page {p} du livre (pages non photographiées).',
        'Pages du livre telles que photographiées. Une adaptation n’est jamais présentée comme le texte original.', 'Pages d’index', 'Préciser', 'Rattachement manuel',
        'Rattacher cette recette à quel plat ?', 'Recette rattachée au plat', 'Remplacement : {a} → {b}. {e}', 'Remplacer « {s} » par :', 'Repérée dans l’index de ton livre',
        'Tasses/cuillères : convention non confirmée pour cette édition — quantités d’origine affichées.', 'Traduire', 'Version et langue affichées ; inconnues omises.',
        'inconnues', 'proposée', 'recalculés pour {n} portions', 'remplace', 'testée', 'Étapes non numérisées.', 'Évaluer une restriction…', 'à refaire'],
      '../src/ui/book.js': ['Ajouter des entrées d’index à la main', 'Aucune recette dans cette vue. Photographie l’index ou une recette pour commencer.', 'Choisir…',
        'Convention confirmée', 'Convention de mesure', 'Créer une recette depuis ce fichier',
        'Des recettes de ce livre utilisent des tasses ou des cuillères. Sans convention confirmée, ces quantités restent affichées telles quelles.', 'Enregistré',
        'Filtrer les recettes de ce livre', 'Langue', 'Livre de nouveau proposé dans Redécouvrir', 'Livre introuvable.', 'Métadonnées et convention', 'Non confirmée',
        'Ordre de décision : équivalences imprimées → convention décrite dans le livre → convention confirmée ici.', 'Pages et fichiers sources',
        'Quelle convention pour les tasses et cuillères de cette édition ?', 'Réafficher dans Redécouvrir', 'index', 'recette', '{n} document(s). Les originaux restent consultables depuis chaque recette.'],
      '../src/ui/home.js': ['Recette'],
      '../src/ui/components.js': ['Le raccourci « CuisineOS-Minuterie » doit être installé une fois (voir Réglages). L’app ne peut pas confirmer qu’Horloge a bien démarré.',
        'Ligne à vérifier', 'Original : {s}', 'Recalculé à partir de « {s} »', 'Sur Mac, utilise Horloge ou Siri directement ; le raccourci s’exécute sur iPhone et iPad.',
        'Unité ambiguë : once de masse ou once liquide ? À confirmer.', 'inconnu(s)', 'orig.',
        'Évaluation des ingrédients identifiés. Ne certifie ni les produits utilisés ni l’environnement de préparation.'],
    };
    const sources = Object.fromEntries(await Promise.all(MODULES_UI1.map(async (m) => [m, await lireT6(m)])));
    // Les EMPLOIS se lisent sans commentaires (constat 20) ; l'inventaire des clés sans entrée lit le source brut (plus strict : une clé commentée y compte).
    const parModule = Object.fromEntries(MODULES_UI1.map((m) => [m, new Set(clesDe(sansCommentairesT6(sources[m])))]));

    eq(Object.keys(TEXTES_UI1).length, 30, 'T6 i18n : la table compte 30 paires (lot visuel : ancien titre des recettes remplacé par « Pages source ») — 27 de la spec § 5 (UI-1), quatre hors table (garde de la TABLE contre une ligne effacée ; NON ÉPROUVÉE : aucun changement de src/ ni d’en.js ne la fait rougir, elle compte dans l’épingle comme F-4 du lot assistant)');
    eq(Object.entries(TEXTES_UI1).filter(([fr, en]) => EN[fr] !== en).map(([fr]) => fr), [], 'T6 i18n : chaque texte neuf de la table (27 de la spec § 5 UI-1, quatre hors table) a son entrée en.js, à l’anglais exact de la table');
    eq(CLES_REEMPLOYEES.filter((k) => typeof EN[k] !== 'string' || !EN[k]), [], 'T6 i18n : les clés réemployées (Corriger, Ingrédients, Préparation, Ajouter un livre, Favoris, Mes livres, Livres, Plats, 1 portion, {n} portions) gardent une entrée');
    eq([EN['Corriger'], EN['Mes livres'], EN['1 portion'], EN['{n} portions']], ['Fix', 'My books', '1 serving', '{n} servings'], 'T6 i18n : « Corriger » reste « Fix » (H-14), « Mes livres » reste « My books » (le segment de la recherche, D-UI-4) ; les deux clés antérieures des repères gardent « 1 serving » et « {n} servings » (R-UI-41)');
    // Chaque texte neuf est bien ÉCRIT quelque part dans les modules du lot, en t('…') littéral HORS commentaires : une table sans emploi serait un filet creux.
    const employes = new Set(MODULES_UI1.flatMap((m) => [...parModule[m]]));
    eq([...Object.keys(TEXTES_UI1), '1 portion', '{n} portions'].filter((fr) => !employes.has(fr)), [], 'T6 i18n : chaque texte de la table, et les deux clés des repères, est écrit en t(\'…\') hors commentaires dans au moins un module du lot (library, recipe, book, home, components, accueil-livre, import-web, import-cible, add)');
    // Filet de la TABLE : pour les cinq modules hors MODULES_NEUFS, un texte de la table qu'ils écrivent et qui est neuf pour le module figure dans CHAINES_NEUVES_AILLEURS[module].
    const manquantes = HORS_MODULES_NEUFS.flatMap((m) => [...parModule[m]].filter((k) => k in TEXTES_UI1 && !(CHAINES_NEUVES_AILLEURS[m] || []).includes(k) && !(DEJA_DANS_LE_MODULE[m] || []).includes(k)).map((k) => `${m} : ${k}`));
    eq(manquantes, [], 'T6 i18n : CHAINES_NEUVES_AILLEURS (tests/ajouter.js) liste, pour library.js, recipe.js, book.js, home.js et components.js, chaque texte de la table qu’ils écrivent et qui est neuf pour le module (« Toutes » et « Disponibles » étaient déjà dans book.js à f3672be)');
    // Ronde 1 (constat 2) : le filet CALCULÉ sur TOUT le module, pas sur la table (mutant X1 de la revue : un aria-label neuf sans entrée en.js passait tous les filets).
    const sansEntree = HORS_MODULES_NEUFS.flatMap((m) => [...new Set(clesDe(sources[m]))].filter((k) => !(k in EN) && !(SANS_EN_ANTERIEURES[m] || []).includes(k)).map((k) => `${m} : ${k}`));
    eq(sansEntree, [], 'T6 i18n (calculé) : toute clé t() de library.js, recipe.js, book.js, home.js et components.js a son entrée en.js, hors les 78 clés antérieures au lot sans entrée (inventaire figé à f3672be) — un texte neuf sans anglais rougit, listé ou non');
    eq(['../src/ui/accueil-livre.js', '../src/ui/import-web.js', '../src/ui/import-cible.js', '../src/ui/add.js', '../src/ui/icones.js'].filter((m) => !MODULES_NEUFS.includes(m)), [], 'T6 i18n : accueil-livre.js, import-web.js, import-cible.js, add.js et icones.js sont dans MODULES_NEUFS (scannés en entier ; icones.js : S14 — ni innerHTML, ni html: ; pour icones.js, doublon du filet de T1 : filet de clôture)');
    // Les chaînes retirées ont quitté en.js, les filets ET chaque module de SHELL (sw.js lu comme un tableau, X4 du lot C).
    const sw = await lireT6('../sw.js');
    // Le TABLEAU SHELL, sans ses commentaires (la forme X4 du lot C, tests/table-matieres.js:1674) ; seuls les modules de src/ hors vendor sont relus.
    const shell = [...(sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    ok(shell.length > 30 && shell.includes('./src/ui/icones.js'), `T6 SHELL : lu comme un tableau (${shell.length} entrées) et il porte ./src/ui/icones.js (doublon du filet SHELL de T1 : filet de clôture)`);
    const srcShell = Object.fromEntries(await Promise.all(shell.filter((m) => m.startsWith('./src/') && m.endsWith('.js') && !m.includes('/vendor/')).map(async (m) => [m, await lireT6('.' + m)])));
    const restes = CHAINES_RETIREES.flatMap((c) => [
      ...(c in EN ? [`en.js : ${c}`] : []),
      ...Object.values(CHAINES_NEUVES_AILLEURS).some((l) => l.includes(c)) ? [`CHAINES_NEUVES_AILLEURS : ${c}`] : [],
      ...Object.entries(srcShell).filter(([, s]) => clesDe(s).includes(c)).map(([m]) => `${m} : ${c}`),
    ]);
    eq(restes, [], 'T6 chaînes retirées : « + Recette », « + Pages d’index », « Ouvrir le lien », « Aller à Mes livres. » ne sont plus ni dans en.js, ni dans les filets, ni en t(\'…\') ou t("…") dans aucun module de SHELL (source brut, commentaires compris)');
    const appSans = sansCommentairesT6(srcShell['./src/ui/coquille.js']); const searchSans = sansCommentairesT6(srcShell['./src/ui/search.js']);
    eq([/label: 'Bibliothèque'/.test(appSans), /label: 'Mes livres'/.test(appSans), clesDe(searchSans).includes('Mes livres') || /\['books', 'Mes livres'\]/.test(searchSans)],
      [true, false, true], 'T6 D-UI-4 : NAV (coquille.js depuis la fidélité aux maquettes ; avant, app.js, hors suite : relu SANS commentaires, comme le test NAV de T1 dont celui-ci est le doublon de clôture) dit « Bibliothèque » et plus « Mes livres » ; le segment « Mes livres » de la recherche (search.js MODES) reste');
    // I-UI-4 : les règles neuves du lot existent dans la feuille servie (garde positive ; T-1, T-2, T-11 et le survol sont tenus par tests/theme.js sur TOUTE la feuille).
    const css = (await lireT6('../styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
    const selecteurs = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
    const SELECTEURS_UI1 = ['.carte-plat', '.sans-photo', '.grille-plats', '.plat-vignette.grande', '.plat-vignette.petite', 'section.plain', '.two-col.livre', '.titre-fiche', '.grid.livres', '.liste-compacte', '.fiche-tete', '.reperes', '[data-role=autres-gestes]'];
    // Ronde 1 (constat 3, faux-vert) : un sélecteur se compare comme un JETON entier — `.reperes-x`, `.sans-photos` ou `xsection.plain` ne valent plus
    // `.reperes`, `.sans-photo` ou `section.plain` (mutant X2 de la revue : `.reperes` renommé `.reperes-x` restait vert).
    const echapperT6 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const jetonT6 = (s) => new RegExp((/^[\w-]/.test(s) ? '(?<![\\w-])' : '') + echapperT6(s) + '(?![\\w-])');
    const present = (s) => [s, s.replace('=autres-gestes]', '="autres-gestes"]')].some((f) => selecteurs.some((sel) => sel.split(',').some((part) => jetonT6(f).test(part.trim()))));
    eq(SELECTEURS_UI1.filter((s) => !present(s)), [], 'T6 I-UI-4 : les treize sélecteurs neufs du lot (spec § 3.3, § 4) existent dans styles.css, chacun comme un jeton entier (ni suffixe ni préfixe)');
    eq([...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => /\.plat-vignette\b/.test(s)), ['.plat-vignette', '.plat-vignette.grande', '.plat-vignette.petite', '.photo-visible img.plat-vignette'], 'T6 § 3.3 : exactement trois sélecteurs nomment .plat-vignette, dans cet ordre (72 px, grande 4:3, petite 48 px) — doublon de tests/photo-plat.js : filet de clôture');
  } catch (e) { ok(false, `T6 filets : bloc interrompu — ${e?.message || String(e)}`); } // un source illisible est UN rouge nommé, jamais une suite coupée en silence

  // --- Vague finale (constat 8) : l'identifiant d'une fiche reçue ou restaurée peut porter « ? », « & », « # » ou « / » — la carte-plat (grille, Favoris,
  // cuissons), la carte horizontale et « Refaire comme la dernière fois » l'ENCODENT, comme la fiche (rid, T3-R1) et la ligne compacte : le geste ouvert est
  // celui annoncé (jamais #/recipes/a avec v=b, jamais l'éditeur d'une autre fiche). Aucune base : aucune fiche n'a de photo, rien n'est lu.
  await bloc('vague finale : adresses de fiche encodées', async () => {
    const { setUiLocale, getUiLocale } = await import('../src/core/i18n.js');
    const { buildDocs } = await import('../src/domain/search.js');
    const { renderHome } = await import('../src/ui/home.js');
    const avantVF = getUiLocale(); setUiLocale('fr');
    try {
      const D = '2026-10-23T12:00:00.000Z';
      const ficheVF = (id, titre) => ({ id, edition_id: null, original_title: titre, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, current_version_id: null, favorite: true, created_at: D, updated_at: D });
      const recettes = [ficheVF('a?v=b', 'Ma tarte'), ficheVF('x/edit', 'Autre')];
      const docs = buildDocs({ recipes: recettes, versions: [], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
      const docDe = (id) => docs.find((d) => d.recipe.id === id);
      const accueil = await renderHome({}, {}, { recipes: recettes, docs, docsByRecipe: new Map(docs.map((d) => [d.recipe.id, d])), cook_history: [{ id: 'chVF', recipe_id: 'a?v=b', recipe_version_id: 'rv_a', cooked_at: D, servings: 2 }],
        cook_sessions: [], inventory: [], settings: { rediscover_enabled: false }, book_editions: [], books: [], library_activity: [], rediscovery_prefs: [] });
      const refaire = [...accueil.querySelectorAll('a.btn')].find((a) => a.textContent === 'Refaire comme la dernière fois');
      eq([C.recipeCard(docDe('a?v=b'), { photoEnTete: true }).querySelector('h3 a')?.getAttribute('href'), C.recipeCard(docDe('x/edit'), { photoEnTete: true }).querySelector('h3 a')?.getAttribute('href'), C.recipeCard(docDe('a?v=b')).querySelector('h3 a')?.getAttribute('href'),
        [...accueil.querySelectorAll('article.carte-plat h3 a')].map((a) => a.getAttribute('href')).sort(), refaire?.getAttribute('href')],
        ['#/recipes/a%3Fv%3Db', '#/recipes/x%2Fedit', '#/recipes/a%3Fv%3Db', ['#/recipes/a%3Fv%3Db', '#/recipes/a%3Fv%3Db', '#/recipes/x%2Fedit'], '#/recipes/a%3Fv%3Db?v=rv_a&servings=2'],
        'vague finale : la carte-plat, la carte horizontale, les cartes d’Aujourd’hui (Favoris, cuissons) et « Refaire comme la dernière fois » encodent l’identifiant (a?v=b → a%3Fv%3Db, x/edit → x%2Fedit)');
    } finally { setUiLocale(avantVF); }
  });

  // --- Fidélité aux maquettes (revue du 28 octobre) : la barre du haut, montée depuis coquille.js et mesurée dans un cadre où la feuille servie s'applique.
  // La pastille « N non envoyés » VISIBLE (le cas que la première mesure manquait) : jamais de défilement de côté, la roue Réglages entière à l'écran ;
  // dès 900 px, les cinq onglets de la barre et pas d'onglets bas ; de 900 à 1099 px et sous 600 px, la recherche réduite à sa loupe (le mot lu).
  await bloc('fidélité aux maquettes : barre du haut', async () => {
    const { coquille } = await import('../src/ui/coquille.js');
    const mesures = [];
    for (const largeur of [375, 390, 768, 900, 960, 1099, 1100, 1280]) {
      const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
      f.style.cssText = `position:absolute;left:-12000px;top:0;width:${largeur}px;height:600px;border:0`;
      document.body.append(f);
      try {
        const d = f.contentDocument;
        d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><div id="app"></div></body></html>'); d.close();
        const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
        await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
        if (f.contentWindow.innerWidth !== largeur) throw new Error(`cadre ${largeur} : innerWidth ${f.contentWindow.innerWidth}`);
        const c = coquille('/library');
        d.getElementById('app').append(c.root);
        const p = c.root.querySelector('.pastille'); p.replaceChildren(Object.assign(d.createElement('span'), { className: 'long', textContent: '12 modifications à envoyer' })); p.dataset.court = '12 à envoyer'; p.hidden = false; // ce que pose majPastille (B04, lot I1)
        await new Promise((r) => requestAnimationFrame(() => r()));
        const w = f.contentWindow; const S = (n) => w.getComputedStyle(n); const B = (n) => n.getBoundingClientRect();
        const roue = c.root.querySelector('.topbar a[href="#/settings"]'); const rech = c.root.querySelector('.topbar a[href="#/search"]');
        const libelle = rech.querySelector('.nowrap');
        const visibles = [...c.side.querySelectorAll('a')].filter((a) => B(a).width > 1 && S(c.side).display !== 'none');
        // B04 (lot I1) : là où la barre est serrée (< 600 px, 900-1099 px), le texte entier est masqué (1 px) et la forme courte se voit (la pastille garde
        // une largeur) ; ailleurs, le texte entier se voit — jamais une pastille vide.
        const serree = largeur < 600 || (largeur >= 900 && largeur <= 1099);
        const longue = B(p.querySelector('.long'));
        mesures.push([largeur, d.documentElement.scrollWidth <= largeur, B(roue).left >= 0 && B(roue).right <= largeur, B(p).right <= B(rech).left,
          largeur >= 900 ? visibles.length : S(c.tabs).display !== 'none', B(libelle).width <= 1, rech.textContent.trim(), Math.round(B(rech).width) >= 44,
          serree ? longue.width <= 1 : longue.width > 40, B(p).width >= 40]);
      } finally { f.remove(); }
    }
    eq(mesures, [
      [375, true, true, true, true, true, 'Qu’est-ce qu’on cuisine ?', true, true, true], [390, true, true, true, true, true, 'Qu’est-ce qu’on cuisine ?', true, true, true],
      [768, true, true, true, true, false, 'Qu’est-ce qu’on cuisine ?', true, true, true], [900, true, true, true, 5, true, 'Qu’est-ce qu’on cuisine ?', true, true, true],
      [960, true, true, true, 5, true, 'Qu’est-ce qu’on cuisine ?', true, true, true], [1099, true, true, true, 5, true, 'Qu’est-ce qu’on cuisine ?', true, true, true],
      [1100, true, true, true, 5, false, 'Qu’est-ce qu’on cuisine ?', true, true, true], [1280, true, true, true, 5, false, 'Qu’est-ce qu’on cuisine ?', true, true, true]],
      'barre du haut, pastille « 12 modifications à envoyer » visible (forme courte « 12 à envoyer » là où la barre est serrée) : aucune page plus large que la fenêtre, roue Réglages entière, pastille avant la recherche ; ≥ 900 px cinq onglets dans la barre, < 900 px les onglets bas ; recherche réduite à sa loupe sous 600 px et de 900 à 1099 px (le mot reste dans le lien) ; recherche ≥ 44 px (mesurés à 375, 390, 768, 900, 960, 1099, 1100, 1280 px)');
    // Un titre sans espace (une adresse collée en titre de signet) reste DANS sa carte à 375 px : overflow-wrap des titres gardé (revue du 28 octobre).
    {
      const { buildDocs } = await import('../src/domain/search.js');
      const D = '2026-10-28T12:00:00.000Z';
      const fiche = (id, titre) => ({ id, edition_id: null, original_title: titre, original_language: 'fr', availability: 'available', verification_state: 'verified', printed_page: null, current_version_id: null, source_url: null, tags: [], cuisines: [], favorite: false, created_at: D, updated_at: D });
      const docs = buildDocs({ recipes: [fiche('rL', 'ricardocuisine.com/recettes/bouillabaisse-marseillaise'), fiche('rC', 'Croquembouche')], versions: [], editions: [], books: [], dishes: [], links: [], translations: [], history: [] });
      const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'scène de mesure');
      f.style.cssText = 'position:absolute;left:-12000px;top:0;width:375px;height:800px;border:0'; document.body.append(f);
      try {
        const d = f.contentDocument;
        d.open(); d.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body><main class="content"></main></body></html>'); d.close();
        const lien = d.createElement('link'); lien.rel = 'stylesheet'; lien.href = new URL('../styles.css?v=' + Date.now(), location.href).href;
        await new Promise((r) => { lien.onload = r; lien.onerror = r; d.head.append(lien); });
        const g = C.grilleCartes(docs.map((doc) => C.recipeCard(doc, { photoEnTete: true })));
        d.querySelector('main').append(g);
        const h3s = [...g.querySelectorAll('.carte-plat h3')];
        eq([d.documentElement.scrollWidth <= 375, h3s.every((h) => h.scrollWidth <= h.clientWidth + 1)], [true, true], 'grille à 375 px : un titre sans espace (adresse collée) reste dans sa carte, sans trait d’union imposé ni défilement de côté (mesuré)');
      } finally { f.remove(); }
    }
    const c = coquille('/library');
    eq([c.side.getAttribute('role'), c.side.getAttribute('aria-label'), [...c.side.querySelectorAll('a.active')].map((a) => a.getAttribute('href'))], ['navigation', 'Navigation', ['#/library']],
      'coquille : la rangée d’onglets de la barre est un repère de navigation (role) ; l’onglet de la route est actif');
  });

  // Correctif mobile du 29 octobre : la langue choisie est visible et suit le lien vers l’éditeur manuel.
  await bloc('langue de lecture et cible de traduction', async () => {
    const { withRepo } = await import('./sync-fixture.js');
    const { renderRecipe } = await import('../src/ui/recipe.js');
    const { renderRecipeEdit } = await import('../src/ui/recipe-edit.js');
    const { getData } = await import('../src/ui/state.js');
    const { getUiLocale, setUiLocale } = await import('../src/core/i18n.js');
    const localeAvant = getUiLocale(), hashAvant = location.hash, vraiFetch = globalThis.fetch;
    let appels = 0;
    setUiLocale('fr');
    globalThis.fetch = async () => { appels++; throw new Error('Aucun appel réseau attendu pour choisir une langue'); };
    try {
      await withRepo(async repo => {
        const italienne = { id: 'carnet-langue-it', original_title: 'Pane', original_language: 'it', availability: 'available', current_version_id: 'carnet-langue-v', source_page_ids: [] };
        const version = { id: 'carnet-langue-v', recipe_id: italienne.id, kind: 'extraction', servings: 2, ingredients: [{ id: 'langue-farine', source_text: 'Farina', name_text: 'farina' }], steps: [{ id: 'langue-etape', position: 1, text: 'Impastare.', timers: [] }] };
        const inconnue = { ...italienne, id: 'carnet-langue-inconnue', original_language: null, current_version_id: 'carnet-langue-inconnue-v' };
        await repo.saveBatch({ recipes: [italienne, inconnue], recipe_versions: [version, { ...version, id: inconnue.current_version_id, recipe_id: inconnue.id }] }, {conditions:{recipes:[{key:italienne.id,absente:true},{key:inconnue.id,absente:true}]}});
        const avant = { fiche: await repo.get('recipes', italienne.id), version: await repo.get('recipe_versions', version.id) };
        const scene = document.createElement('div'); document.body.append(scene);
        const anglaiseDisponible={id:'carnet-tr-en',recipe_version_id:version.id,locale:'en',alignment_format:1,translated_content:{title:'Bread',ingredients:['Flour'],steps:['Knead.']}};await repo.save('recipe_translations',anglaiseDisponible);
        const ctx = async () => ({ ...await getData(true), sync: {} });
        const bouton = (node, texte) => [...node.querySelectorAll('button')].find(b => b.textContent === texte);
        const champLangue=node=>node.querySelector('[data-role=langue-recette]');
        const selection = node => [...champLangue(node).querySelectorAll('button.active')].map(b => b.textContent);
        const lienTraduire = node => [...node.querySelectorAll('a')].find(a => a.textContent === 'Traduire moi-même');
        const queryDuLien = lien => Object.fromEntries(new URLSearchParams(lien.getAttribute('href').split('?')[1]));
        try {
          const fiche = await renderRecipe({ id: italienne.id }, {}, await ctx()); scene.append(fiche);
          const details = fiche.querySelector('[data-role=autres-gestes]'); details.open = true;
          eq(selection(fiche), ['Original'], 'Langue mobile : la sélection initiale est Original');
          bouton(champLangue(fiche), 'Français').click();
          eq(selection(fiche), ['Français'], 'Langue mobile : FR seul devient visuellement actif après le choix');
          ok(fiche.querySelector('[data-role=texte-etape]')?.textContent==='Impastare.'&&!!fiche.querySelector('[data-role=traduction-manquante]'), 'Langue mobile : original italien sans traduction française dit son absence');
          const cibleFr = queryDuLien(lienTraduire(fiche));
          eq([cibleFr.kind, cibleFr.v, cibleFr.locale], ['translation', version.id, 'fr'], 'Langue mobile : le lien de traduction transporte exactement la version et FR choisies');
          let editeur = await renderRecipeEdit({ id: italienne.id }, cibleFr, await ctx());
          eq([editeur.querySelector('h1')?.textContent,cibleFr.format],['Traduire — Français','2'],'Langue mobile : italien vers FR ouvre le nouvel éditeur français explicite');editeur.dispose?.();
          bouton(champLangue(fiche), 'Anglais').click();
          eq(selection(fiche), ['Anglais'], 'Langue mobile : EN seul devient visuellement actif après FR');
          eq(queryDuLien(lienTraduire(fiche)).locale, 'en', 'Langue mobile : le prochain lien suit EN sans conserver FR');
          bouton(champLangue(fiche), 'Original').click();
          eq([selection(fiche), !!fiche.querySelector('[data-role=traduction-manquante]')], [['Original'], false], 'Langue mobile : revenir à Original retire l’avis de traduction absente');
          bouton(champLangue(fiche), 'Français').click();
          bouton(details, 'Métrique').click();
          eq([selection(fiche), details.open, queryDuLien(lienTraduire(fiche)).locale], [['Français'], true, 'fr'], 'Langue mobile : changer les unités conserve le choix FR et le volet ouvert');

          const manque = await renderRecipe({ id: inconnue.id }, { lang: 'fr' }, await ctx()); scene.append(manque);
          ok(manque.querySelector('[data-role=texte-etape]')?.textContent==='Impastare.'&&!!manque.querySelector('[data-role=traduction-manquante]'), 'Langue mobile : une langue originale absente ne fait pas croire qu’une traduction FR existe');
          const lienInconnu = lienTraduire(manque);
          const cibleInconnue = lienInconnu ? queryDuLien(lienInconnu) : {};
          eq(cibleInconnue.locale, 'fr', 'Langue mobile : sans langue originale, le lien conserve aussi la demande FR');
          editeur = await renderRecipeEdit({ id: inconnue.id }, { kind: 'translation', v: inconnue.current_version_id, locale: 'fr' }, await ctx());
          eq(editeur.querySelector('h1')?.textContent, 'Traduire — FR', 'Langue mobile : demande FR explicite respectée sans langue originale');
          const ancien = await renderRecipeEdit({ id: italienne.id }, { kind: 'translation', v: version.id }, await ctx());
          eq(ancien.querySelector('h1')?.textContent, 'Traduire — EN', 'Langue mobile : ancien lien sans locale conserve son comportement antérieur');
          const invalide = await renderRecipeEdit({ id: italienne.id }, { kind: 'translation', v: version.id, locale: 'fr<script>' }, await ctx());
          eq([invalide.querySelector('h1')?.textContent, !!invalide.querySelector('script')], ['Traduire — EN', false], 'Langue mobile : locale hors FR/EN ignorée, texte hostile jamais propagé');
          const anglaise = { ...italienne, original_language: 'en' };
          const contexteAnglais = await ctx(); contexteAnglais.recipesById = new Map(contexteAnglais.recipesById).set(italienne.id, anglaise);
          const ancienAnglais = await renderRecipeEdit({ id: italienne.id }, { kind: 'translation', v: version.id }, contexteAnglais);
          eq(ancienAnglais.querySelector('h1')?.textContent, 'Traduire — FR', 'Langue mobile : ancien lien anglais conserve le choix français par défaut');

          editeur = await renderRecipeEdit({ id: italienne.id }, { kind: 'translation', v: version.id, locale: 'fr' }, await ctx()); scene.append(editeur);
          const [titre, ingredients, etapes] = editeur.querySelectorAll('input, textarea');
          for (const [champ, texte] of [[titre, 'Pain'], [ingredients, 'Farine'], [etapes, 'Pétrir.']]) { champ.value = texte; champ.dispatchEvent(new Event('input', { bubbles: true })); }
          bouton(editeur, 'Enregistrer la traduction').click();
          let traductions = [];
          for (let i = 0; i < 50; i++) { traductions = (await repo.all('recipe_translations')).filter(x=>x.locale==='fr'); if (traductions.length) break; await new Promise(r => setTimeout(r, 5)); }
          eq(traductions.map(tr => [tr.recipe_version_id, tr.locale, tr.origin, tr.translated_content]), [[version.id, 'fr', 'manual', { title: 'Pain', ingredients: ['Farine'], steps: ['Pétrir.'] }]], 'Langue mobile : la traduction saisie reste manuelle et liée à la version française demandée');
          eq({ fiche: await repo.get('recipes', italienne.id), version: await repo.get('recipe_versions', version.id) }, avant, 'Langue mobile : choisir une langue et enregistrer une traduction ne réécrit ni fiche ni original culinaire');
          eq(appels, 0, 'Langue mobile : aucun appel IA ou réseau pour ces gestes');
        } finally { for (const node of scene.children) node.dispose?.(); scene.remove(); }
      });
    } finally { globalThis.fetch = vraiFetch; setUiLocale(localeAvant); if (location.hash !== hashAvant) history.replaceState(null, '', location.pathname + location.search + hashAvant); }
  });

  // --- repère de fin : les tâches 2 à 6 ajoutent leurs blocs AU-DESSUS de cette ligne ---
}
