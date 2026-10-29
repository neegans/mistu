import { remplacerAdresse, start } from '../src/core/router.js';

function navigateur() {
  const w = new EventTarget(), entries = [{ state: { externe: 7 }, hash: '#/library' }]; let at = 0;
  w.location = { hash: '#/library', pathname: '/', search: '', origin: 'https://example.test' };
  const install = (event = true) => { w.location.hash = entries[at].hash; if (event) { w.dispatchEvent(new Event('popstate')); w.dispatchEvent(new Event('hashchange')); } };
  w.history = { get state() { return entries[at].state; }, scrollRestoration: 'auto',
    replaceState(state, _, hash) { entries[at] = { state, hash: '#' + String(hash).split('#').at(-1) }; install(false); },
    go(delta) { at = Math.max(0, Math.min(entries.length - 1, at + delta)); install(); } };
  w.ouvrir = hash => { entries.splice(at + 1); entries.push({ state: structuredClone(w.history.state), hash }); at++; install(); };
  return w;
}
const stockage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

export async function runL3NavigationTests({ eq, ok }) {
  const hash = location.href, state = history.state;
  try {
    history.replaceState({ externe: 7 }, '', '#/library'); remplacerAdresse('/library?q=pain');
    eq(history.state?.externe, 7, 'L3 navigation : remplacerAdresse conserve les clés étrangères');
  } finally { history.replaceState(state, '', hash); }
  const w = navigateur(), events = [], stop = start(r => events.push(r), { fenetre: w });
  const first = events[0]?.navigation?.cleEntree;
  w.ouvrir('#/recipes/r'); const fiche = events.at(-1)?.navigation?.cleEntree;
  ok(first && fiche && first !== fiche, 'L3 navigation : fragment crée une entrée malgré state copié');
  eq(events.length, 2, 'L3 navigation : popstate et hashchange dédupliqués');
  w.history.go(-1);
  eq(events.at(-1)?.navigation?.cleEntree, first, 'L3 navigation : retour retrouve la clé initiale');
  eq(events.at(-1)?.navigation?.type, 'retour', 'L3 navigation : retour distinct du rendu ordinaire');
  w.history.go(1); eq(events.at(-1)?.navigation?.cleEntree, fiche, 'L3 navigation : avance retrouve la fiche');
  w.dispatchEvent(new Event('cuisineos:refresh'));
  eq(events.at(-1)?.navigation?.type, 'refresh', 'L3 navigation : actualisation explicite');
  if (typeof stop === 'function') stop();
  let nav;
  try { nav = await import('../src/ui/navigation-contexte.js'); } catch { ok(false, 'L3 C07 : mémoire de retour disponible'); return; }
  const session = stockage(), local = stockage(), n = nav.creerNavigation({ fenetre: w, session, local });
  const a = n.porteeNavigation({ proprietaireDonnees: 'A' }, 'db-a');
  const b = n.porteeNavigation({ proprietaireDonnees: 'B' }, 'db-a');
  n.activerEntree({ cleEntree: 'entree-a', route: '/library', query: {}, portee: a });
  n.memoriserListe({ cleEntree: 'entree-a', route: '/library', portee: a, recherche: 'pain', filtres: { favoris: true }, presentation: 'liste', limite: 120, ancre: { id: 'r-120', decalage: -12, y: 1500 } });
  eq(n.lireContexteListe({ route: '/library', query: {}, portee: a }).recherche, 'pain', 'L3 C07 : recherche retrouvée au retour');
  eq(n.lireContexteListe({ route: '/library', query: {}, portee: a }).limite, 120, 'L3 C07 : limite dépliée retrouvée');
  eq(n.lireContexteListe({ route: '/library', query: {}, portee: b }).recherche, '', 'L3 compte : contexte A absent sous B');
  eq(n.retourConnu({ query: { origine: 'entree-a' }, portee: b, repli: '/library' }).cleEntree, undefined, 'L3 compte : origine étrangère refusée');
  const reloaded = nav.creerNavigation({ fenetre: w, session, local });
  reloaded.activerEntree({ cleEntree: 'entree-a', route: '/library', query: {}, portee: a });
  eq(reloaded.lireContexteListe({ route: '/library', query: {}, portee: a }).recherche, 'pain', 'L3 C07 : mémoire survit au rechargement');
  n.invaliderNavigation({ motif: 'bibliotheque_remplacee' });
  const nouvelle = n.porteeNavigation({ proprietaireDonnees: 'A' }, 'db-a');
  ok(nouvelle.epoque !== a.epoque, 'L3 compte : remplacement change époque durable');
  eq(n.lireContexteListe({ route: '/library', query: {}, portee: nouvelle }).recherche, '', 'L3 compte : ancienne recherche invalidée après remplacement');
  // Enveloppe bornée, validation métier et branche d'historique sans aucune donnée de recette.
  const f = nav.creerNavigation({ fenetre: w, session: stockage(), local: stockage() }), p = f.porteeNavigation({ proprietaireDonnees: 'A', sync: { user: { id: 'B' } } }, 'db-proof');
  eq(p.proprietaire, 'A', 'L3 portée : propriétaire des données distinct du compte connecté');
  f.activerEntree({ cleEntree: 'liste', route: '/library', query: {}, portee: p, position: 0, chaine: 'chaine' });
  const linked = f.lienAvecOrigine('/recipes/r/edit?kind=adaptation&pages=p1%2Cp2&doc=d&v=v&locale=fr&servings=4&access_token=secret');
  ok(linked.startsWith('#/recipes/r/edit?') && linked.includes('origine=liste'), 'L3 liens : vrai fragment interne avec origine opaque');
  const args = new URLSearchParams(linked.split('?')[1]);
  eq([args.get('kind'), args.get('pages'), args.get('doc'), args.get('v'), args.get('locale'), args.get('servings')], ['adaptation', 'p1,p2', 'd', 'v', 'fr', '4'], 'L3 liens : paramètres métier préservés');
  eq(args.has('access_token'), false, 'L3 liens : aucun jeton authentification accepté');
  eq(nav.routeInterne('/recipes/x%2Fedit?v=v'), '/recipes/x%2Fedit?v=v', 'L3 route : slash encodé reste dans son identifiant, comme le routeur');
  eq([nav.routeInterne('https://example.test'), nav.routeInterne('//evil.test'), nav.routeInterne('/recipes/%E0%A4%A'), nav.routeInterne('/books/b/edit')], [null, null, null, null], 'L3 routes hostiles ou inconnues refusées');
  f.memoriserListe({ route: '/library', portee: p, q: '😀'.repeat(550), sources: ['web', 'inconnu'], ingredientIds: ['i', 'i'], presentation: 'malveillant', selection: ['secret'] });
  const clean = f.lireContexteListe({ route: '/library', query: {}, portee: p });
  eq([...clean.q].length, 500, 'L3 mémoire : borne en points de code');
  eq([clean.sources, clean.ingredientIds, clean.presentation, clean.selection], [['web'], ['i'], 'grille', undefined], 'L3 mémoire : enums, dédoublonnage et sélection exclue');
  f.activerEntree({ cleEntree: 'liste', route: '/library', query: { q: 'salade' }, portee: p, position: 0, chaine: 'chaine' });
  f.memoriserListe({ route: '/library', portee: p, q: 'soupe' });
  eq(f.lireContexteListe({ route: '/library', query: { q: 'salade' }, portee: p }).q, 'soupe', 'L3 C07 : ancienne query ne remplace pas la saisie au refresh');
  const routeFiche = f.lienAvecOrigine('/recipes/r?v=v').slice(1);
  f.activerEntree({ cleEntree: 'fiche', route: '/recipes/r', query: Object.fromEntries(new URLSearchParams(routeFiche.split('?')[1])), portee: p, position: 1, chaine: 'chaine' });
  const edit = f.lienAvecOrigine('/recipes/r/edit?v=v');
  const back = f.retourConnu({ query: Object.fromEntries(new URLSearchParams(edit.split('?')[1])), portee: p });
  ok(back.href.startsWith('/recipes/r?') && back.href.includes('origine=liste'), 'L3 chaîne : éditeur revient fiche avec origine de liste conservée');
  f.activerEntree({ cleEntree: 'livre', route: '/books/b', query: {}, portee: p });
  eq(f.lireContexteListe({ route: '/books/b', query: {}, portee: p }).tri, 'page', 'L3 livre : tri initial par page');
  f.memoriserListe({ route: '/books/b', portee: p, onglet: 'recettes', q: 'pain', ancre: { id: 'r', y: 400 } });
  f.memoriserListe({ route: '/books/b', portee: p, onglet: 'sources', q: 'page', ancre: { id: 'page', y: 800 } });
  const recettes = f.lireContexteListe({ route: '/books/b', query: { onglet: 'recettes' }, portee: p });
  const sources = f.lireContexteListe({ route: '/books/b', query: { onglet: 'sources' }, portee: p });
  eq([recettes.q, recettes.ancre.y, sources.q, sources.ancre.y], ['pain', 400, 'page', 800], 'L3 livre : deux onglets avec filtres et positions indépendants');
  f.activerEntree({ cleEntree: 'search', route: '/search', query: {}, portee: p });
  f.memoriserListe({ route: '/search', portee: p, q: 'pain', filtresRechercheQ: 'pain', filtresRecherche: { quick: true, type: 'soupe', diets: ['vegetarien', 'fake'], include: ['i'], max_total_minutes: 30 } });
  eq(f.lireContexteListe({ route: '/search', query: { q: 'pain' }, portee: p }).filtresRecherche.diets, ['vegetarien'], 'L3 recherche : filtres manuels validés retrouvés');
  eq(f.lireContexteListe({ route: '/search', query: { q: 'pain' }, portee: p }).filtresRecherche.quick, true, 'L3 recherche : prédicat rapide conservé');
  eq(f.lireContexteListe({ route: '/search', query: { q: 'autre' }, portee: p }).filtresRecherche, null, 'L3 recherche : nouveau texte ne réutilise pas les filtres précédents');
  for (let i = 0; i < 81; i++) f.activerEntree({ cleEntree: 'borne-' + i, route: '/library', query: {}, portee: p });
  eq(f.retourConnu({ query: { origine: 'liste' }, portee: p }).cleEntree, undefined, 'L3 mémoire : anciennes entrées évincées à 80');
  const broken = { getItem() { throw Error('bloqué'); }, setItem() { throw Error('quota'); } }, volatil = nav.creerNavigation({ fenetre: w, session: broken, local: broken });
  const pv = volatil.porteeNavigation({ proprietaireDonnees: null }, 'db-volatil');
  volatil.activerEntree({ cleEntree: 'volatile', route: '/library', query: {}, portee: pv });
  eq(volatil.memoriserListe({ route: '/library', portee: pv, q: 'toujours lisible' }), false, 'L3 stockage : refus contrôlé sans exception métier');
  eq(volatil.lireContexteListe({ route: '/library', query: {}, portee: pv }).q, 'toujours lisible', 'L3 stockage : repli volatil utilisable');

  const copiedSession = stockage(), sharedLocal = stockage(), original = nav.creerNavigation({ fenetre: w, session: copiedSession, local: sharedLocal });
  const po = original.porteeNavigation({}, 'db-onglet');
  original.activerEntree({ cleEntree: 'source-tab', route: '/library', portee: po, chaine: 'chaine-originale' });
  original.memoriserListe({ route: '/library', portee: po, q: 'filtre privé onglet' });
  const nouvelOnglet = nav.creerNavigation({ fenetre: w, session: copiedSession, local: sharedLocal });
  nouvelOnglet.activerEntree({ cleEntree: 'nouvel-onglet', route: '/recipes/r', query: { origine: 'source-tab' }, portee: po, chaine: 'nouvelle-chaine', type: 'initial' });
  eq(nouvelOnglet.retourConnu({ query: { origine: 'source-tab' }, portee: po, repli: '/library' }).cleEntree, undefined, 'L3 onglet : sessionStorage cloné ne transporte pas les origines');

  // Défilement de navigateur réel dans un document indépendant, sans attente async waitForFunction.
  const frame = document.createElement('iframe'); frame.style.cssText = 'width:700px;height:500px'; frame.srcdoc = '<style>body{margin:0}article{height:100px}button{height:30px}</style><main>' + Array.from({ length: 30 }, (_, i) => '<article data-nav-id="item-' + i + '"><button data-nav-focus="element">Objet ' + i + '</button></article>').join('') + '</main>';
  const ready = new Promise(resolve => frame.onload = resolve); document.body.append(frame); await ready;
  try {
    const fw = frame.contentWindow, root = fw.document.querySelector('main'), dom = nav.creerNavigation({ fenetre: fw, session: stockage(), local: stockage() }), pd = dom.porteeNavigation({}, 'db-scroll');
    dom.activerEntree({ cleEntree: 'scroll', route: '/library', portee: pd });
    fw.scrollTo(0, 735); root.querySelector('[data-nav-id="item-7"] button').focus({ preventScroll: true }); dom.capturerVue(root);
    fw.scrollTo(0, 0); await dom.restaurerVue({ racine: root, portee: pd });
    ok(Math.abs(fw.scrollY - 735) <= 1, 'L3 défilement réel : ancre et décalage restaurés');
    eq(fw.document.activeElement.textContent, 'Objet 7', 'L3 défilement réel : focus retrouve élément ouvert');
    root.firstElementChild.style.height = '200px'; await new Promise(resolve => setTimeout(resolve, 80));
    ok(Math.abs(fw.scrollY - 835) <= 1, 'L3 défilement réel : arrivée tardive de hauteur réajustée');
    fw.dispatchEvent(new Event('wheel')); fw.scrollTo(0, 300); root.firstElementChild.style.height = '300px'; await new Promise(resolve => setTimeout(resolve, 60));
    ok(fw.scrollY < 600, 'L3 défilement réel : geste utilisateur annule correction tardive');
    fw.scrollTo(0, 0); await dom.restaurerVue({ racine: root, portee: pd, estCourante: () => false });
    eq(fw.scrollY, 0, 'L3 défilement réel : ancien rendu ne déplace jamais nouvelle page');

    const formulaire = fw.document.createElement('section'), champ = fw.document.createElement('input');
    formulaire.style.paddingBottom = '800px'; champ.dataset.navOuverture = 'focus'; formulaire.append(champ); root.append(formulaire);
    await dom.restaurerVue({ racine: root, portee: pd });
    ok(champ.getBoundingClientRect().top >= 0 && champ.getBoundingClientRect().bottom <= fw.innerHeight, 'L3 ouverture explicite : formulaire hors écran devient visible malgré ancienne ancre');
    ok(fw.document.activeElement === champ, 'L3 ouverture explicite : focus posé après restauration, sur le champ demandé');
    const positionChamp = champ.getBoundingClientRect().top;
    root.firstElementChild.style.height = '400px';
    for (let i = 0; i < 4; i++) await new Promise(resolve => fw.requestAnimationFrame(resolve));
    ok(Math.abs(champ.getBoundingClientRect().top - positionChamp) <= 1, 'L3 ouverture explicite : hauteur tardive conserve le champ visible');
    await dom.restaurerVue({ racine: root, portee: pd });
    eq(fw.document.activeElement.textContent, 'Objet 7', 'L3 ouverture explicite : demande consommée, retour ordinaire retrouve son ancre');
    champ.dataset.navOuverture = 'focus'; fw.scrollTo(0, 0);
    await dom.restaurerVue({ racine: root, portee: pd, estCourante: () => false });
    eq([fw.scrollY, fw.document.activeElement === champ], [0, false], 'L3 ouverture explicite : ancien rendu ne déplace ni focus ni position');
    const annulee = dom.restaurerVue({ racine: root, portee: pd }); fw.dispatchEvent(new Event('wheel')); await annulee;
    eq([fw.scrollY, fw.document.activeElement === champ], [0, false], 'L3 ouverture explicite : geste utilisateur annule avant la première frame');
    dom.invaliderNavigation({ motif: 'compte_modifie' }); await dom.restaurerVue({ racine: root, portee: pd });
    eq([fw.scrollY, fw.document.activeElement === champ], [0, false], 'L3 ouverture explicite : portée invalidée ne déplace ni focus ni position');
  } finally { frame.remove(); }

}
