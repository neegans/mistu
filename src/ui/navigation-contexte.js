// État d'affichage local à l'onglet. Aucune recette, sélection ou donnée d'assistant sérialisée.
import * as repo from '../model/repo.js';
import { CLE_ENTREE_NAV } from '../core/router.js';
import { t } from '../core/i18n.js';
import { RECIPE_TYPES, DIET_TAGS } from '../model/schema.js';

export const LIMITES_NAVIGATION = Object.freeze({ entrees: 80, entreeOctets: 8192, totalOctets: 524288 });
const MEMO = 'mistu.navigation.v1', EPOQUES = 'mistu.navigation.epoques.v1', VUE = 'mistu.navigation.presentation.v1';
const token = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(x);
const texte = x => typeof x === 'string' ? [...x.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 500).join('') : '';
const identifiant = x => typeof x === 'string' && x.length > 0 && x.length <= 200 && !/[\u0000-\u001f\u007f]/.test(x) ? x : null;
const nombre = (x, def = 0, max = 1e7) => Number.isFinite(Number(x)) ? Math.max(0, Math.min(max, Number(x))) : def;
const copie = x => JSON.parse(JSON.stringify(x));
const octets = x => new TextEncoder().encode(JSON.stringify(x)).length;
const cleNeuve = () => globalThis.crypto?.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const pareils = (a, b) => a && b && a.proprietaire === b.proprietaire && a.base === b.base && a.epoque === b.epoque;
const stockageDe = (w, nom) => { try { return w?.[nom]; } catch { return null; } };
const lire = (s, k) => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const ecrire = (s, k, v) => { try { if (!s) return false; s.setItem(k, v); return true; } catch { return false; } };

export function routeInterne(cible) {
  if (typeof cible !== 'string' || cible.length > 4096) return null;
  const raw = cible.startsWith('#') ? cible.slice(1) : cible;
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f\u007f#]/.test(raw)) return null;
  const [path, ...suite] = raw.split('?'); if (suite.length > 1) return null;
  let parts; try { parts = path.split('/').slice(1).map(decodeURIComponent); } catch { return null; }
  if (parts.some(p => p && !identifiant(p))) return null;
  const fixes = ['/', '/search', '/library', '/corbeille', '/meals', '/kitchen', '/settings', '/import', '/add', '/add/livre', '/add/signet', '/recipes/new', '/recipes/creer'];
  if (!fixes.includes(path) && !/^\/(books|dishes|recipes|cook|meals|lists)\/[^/]+(?:\/(edit|thermomix|photo|reperes|importer))?$/.test(path)) return null;
  // Seules recipes acceptent un troisième segment.
  if (parts.length === 3 && parts[0] !== 'recipes') return null;
  const params = new URLSearchParams(suite[0] || '');
  const admis = new Set(['draft','section','kind','format','assistant','translation','pages','doc','adapter','add','adresse','cmp','intention','nouveau','titre','origine','retour_nav','tab','onglet','q','mode','fav','cooked','any','for','role','meal','v','servings','locale','lang','import','session','edition','book','source','type','diets','max','panel','panneau','intent','tout','page','id','sources','editionId','disponibilites','favoris','aRelire','cuisinees','rapide','maxMinutes','ingredientIds','appareil','tri','presentation','limite']);
  for (const [k, v] of [...params]) if (!admis.has(k) || k.length > 50 || [...v].length > 500 || /[\u0000-\u001f\u007f]/.test(k + v)) params.delete(k);
  const query = params.toString(); return path + (query ? '?' + query : '');
}
const chemin = route => route?.split('?')[0];
const listeRoute = route => ['/library', '/search'].includes(chemin(route)) || /^\/books\/[^/]+$/.test(chemin(route) || '');
const bool = x => x === true || x === '1';
const choix = (x, values, fallback) => values.includes(x) ? x : fallback;
const liste = (x, values = null) => [...new Set((Array.isArray(x) ? x : typeof x === 'string' ? x.split(',') : []).filter(v => values ? values.includes(v) : identifiant(v)))].slice(0, 40);
function nettoyerEtat(input = {}, vue = 'grille') {
  const x = { ...(input.filtres || {}), ...input };
  const q = texte(x.q ?? x.recherche);
  return { q, recherche: q, tab: choix(x.tab, ['recettes', 'books', 'dishes', 'a-importer'], 'recettes'), onglet: choix(x.onglet, ['recettes', 'sources'], 'recettes'),
    sources: liste(x.sources, ['livres', 'web', 'ia', 'personnelles']), editionId: identifiant(x.editionId),
    disponibilites: liste(x.disponibilites, ['available', 'partial', 'reference_only', 'unknown']),
    favoris: bool(x.favoris), aRelire: bool(x.aRelire), cuisinees: bool(x.cuisinees), rapide: bool(x.rapide),
    maxMinutes: Number.isInteger(Number(x.maxMinutes)) && Number(x.maxMinutes) >= 1 && Number(x.maxMinutes) <= 10080 ? Number(x.maxMinutes) : null,
    ingredientIds: liste(x.ingredientIds), appareil: x.appareil === 'tm7' ? 'tm7' : null,
    tri: choix(x.tri, ['modification', 'titre', 'page'], 'modification'), presentation: choix(x.presentation, ['grille', 'liste'], vue),
    limite: Math.max(60, Math.min(6000, Math.floor(nombre(x.limite, 60, 6000) / 60) * 60)),
    ancre: nettoyerAncre(x.ancre), filtresRecherche: nettoyerRecherche(x.filtresRecherche), filtresRechercheQ: texte(x.filtresRechercheQ) };
}
function nettoyerRecherche(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  return { quick: f.quick === true, type: choix(f.type, RECIPE_TYPES, null), diets: liste(f.diets, DIET_TAGS), include: liste(f.include), exclude: liste(f.exclude),
    exclude_text: liste((Array.isArray(f.exclude_text) ? f.exclude_text : []).map(texte)),
    max_total_minutes: Number.isInteger(f.max_total_minutes) && f.max_total_minutes > 0 && f.max_total_minutes <= 10080 ? f.max_total_minutes : null,
    max_active_minutes: Number.isInteger(f.max_active_minutes) && f.max_active_minutes > 0 && f.max_active_minutes <= 10080 ? f.max_active_minutes : null };
}
function nettoyerAncre(a) {
  if (!a || typeof a !== 'object') return null;
  return { id: identifiant(a.id), suivant: identifiant(a.suivant), precedent: identifiant(a.precedent), decalage: Number.isFinite(a.decalage) ? Math.max(-10000, Math.min(10000, a.decalage)) : 0,
    y: nombre(a.y), focus: choix(a.focus, ['recherche', 'titre', 'liste', 'element'], null), focusId: identifiant(a.focusId) };
}

export function creerNavigation({ fenetre = globalThis.window, session = stockageDe(fenetre, 'sessionStorage'), local = stockageDe(fenetre, 'localStorage') } = {}) {
  let entrees = [], active = null, dernierePortee = null, revision = 0, ephemere = Object.create(null), derniereRestauration = 0;
  const presentation = () => choix(lire(local, VUE), ['grille', 'liste'], 'grille');
  try {
    const raw = lire(session, MEMO);
    const saved = raw && raw.length <= 524288 ? JSON.parse(raw) : null;
    if (saved?.version === 1 && Array.isArray(saved.entrees)) entrees = saved.entrees.slice(-80).flatMap(e => {
      const route = routeInterne(e.route), p = e.portee;
      return token(e.cleEntree) && route && p && (p.proprietaire === null || identifiant(p.proprietaire)) && identifiant(p.base) && token(p.epoque) && octets(e) <= 8192
        ? [{ cleEntree: e.cleEntree, route, portee: { proprietaire: p.proprietaire, base: p.base, epoque: p.epoque }, position: Number.isSafeInteger(e.position) ? e.position : null, chaine: token(e.chaine) ? e.chaine : null,
          touche: nombre(e.touche), etat: nettoyerEtat(e.etat, presentation()), onglets: Object.fromEntries(['recettes', 'sources'].filter(k => e.onglets?.[k]).map(k => [k, nettoyerEtat(e.onglets[k], presentation())])) }] : [];
    });
  } catch { /* Une ancienne mémoire n'empêche jamais la navigation. */ }
  function persister() {
    entrees.sort((a, b) => a.touche - b.touche);
    while (entrees.length > 80 || octets({ version: 1, entrees }) > 524288) entrees.shift();
    return ecrire(session, MEMO, JSON.stringify({ version: 1, entrees }));
  }
  persister();
  function epoque(base) {
    let values; try { values = JSON.parse(lire(local, EPOQUES)) || {}; } catch { values = {}; }
    const value = token(values[base]) ? values[base] : ephemere[base] || cleNeuve();
    ephemere[base] = value;
    if (values[base] !== value) ecrire(local, EPOQUES, JSON.stringify({ ...values, [base]: value }));
    return value;
  }
  function porteeNavigation(ctx = {}, base = repo.db.name) { return { proprietaire: identifiant(ctx.proprietaireDonnees), base: identifiant(base) || 'cuisine-os', epoque: epoque(base) }; }
  const admissible = p => p && p.epoque === epoque(p.base);
  const trouver = (key, p) => admissible(p) ? entrees.find(e => e.cleEntree === key && pareils(e.portee, p)) : null;
  function activerEntree({ cleEntree, route, query = {}, portee, position = null, chaine = null, type = 'initial' }) {
    if (!token(cleEntree) || !routeInterne(route) || !admissible(portee)) return false;
    if (dernierePortee && !pareils(dernierePortee, portee)) { entrees = []; revision++; persister(); }
    if (!active && type === 'initial' && token(chaine) && entrees.length && !entrees.some(e => e.chaine === chaine)) { entrees = []; revision++; }
    if (type === 'navigation') for (const e of entrees) if (e.chaine === chaine && e.position >= position) e.position = null;
    dernierePortee = { ...portee };
    active = { cleEntree, route: routeInterne(route + (Object.keys(query).length ? '?' + new URLSearchParams(query) : '')), portee, position, chaine };
    const existante = trouver(cleEntree, portee);
    if (!existante) { const retour = trouver(query.retour_nav, portee); entrees.push({ ...copie(active), touche: Date.now(), etat: retour && chemin(retour.route) === chemin(route) ? copie(retour.etat) : nettoyerEtat({ tri: /^\/books\//.test(route) ? 'page' : 'modification', ...query }, presentation()) }); }
    else { existante.route = active.route; existante.position = position; existante.chaine = chaine; existante.touche = Date.now(); }
    persister(); return true;
  }
  function lireContexteListe({ route, query = {}, portee } = {}) {
    const p = portee || active?.portee;
    let e = trouver(query.retour_nav, p) || (active && trouver(active.cleEntree, p));
    if (e && chemin(e.route) !== chemin(route)) e = null;
    const adresse = new URLSearchParams(e?.route.split('?')[1] || '');
    // L'adresse initiale d'une entrée n'écrase pas les filtres saisis ensuite. Une nouvelle
    // adresse (nouvelle entrée ou paramètres explicitement différents) garde sa priorité.
    const explicit = Object.fromEntries(Object.entries(query).filter(([k, v]) => Object.hasOwn(nettoyerEtat(), k) && (!e || adresse.get(k) !== String(v))));
    const panneau = choix(query.onglet, ['recettes', 'sources'], e?.etat.onglet || 'recettes');
    const precedent = e?.onglets?.[panneau] || (e?.etat.onglet === panneau ? e.etat : {});
    const etat = nettoyerEtat({ tri: /^\/books\//.test(route) ? 'page' : 'modification', ...precedent, ...explicit, onglet: panneau }, presentation());
    if (etat.filtresRechercheQ !== etat.q) { etat.filtresRecherche = null; etat.filtresRechercheQ = ''; }
    if (query.tab === 'a-importer') Object.assign(etat, { tab: 'recettes', sources: ['livres'], disponibilites: ['reference_only'] });
    return { ...etat, filtres: { ...etat, ancre: undefined }, cleEntree: active?.cleEntree ?? null, portee: p };
  }
  function memoriserListe(input = {}) {
    const key = input.cleEntree || active?.cleEntree, p = input.portee || active?.portee, route = routeInterne(input.route || active?.route);
    if (!token(key) || !route || !listeRoute(route) || !admissible(p)) return false;
    let e = trouver(key, p);
    const state = nettoyerEtat({ ...(e?.etat || {}), ...(input.filtres || {}), ...input, ...(Object.hasOwn(input, 'recherche') && !Object.hasOwn(input, 'q') ? { q: input.recherche } : {}) }, presentation());
    const onglets = /^\/books\//.test(route) ? { ...(e?.onglets || {}), ...(e ? { [e.etat.onglet]: e.etat } : {}), [state.onglet]: state } : {};
    const candidate = { onglets, cleEntree: key, route: e?.route || route, portee: copie(p), position: e?.position ?? active?.position ?? null, chaine: e?.chaine ?? active?.chaine ?? null, touche: Date.now(), etat: state };
    if (octets(candidate) > 8192) return false;
    if (e) Object.assign(e, candidate); else entrees.push(candidate);
    if (Object.hasOwn(input, 'presentation')) ecrire(local, VUE, state.presentation);
    return persister();
  }
  function lienAvecOrigine(cible, { cleEntree = active?.cleEntree, repli = '/library' } = {}) {
    const route = routeInterne(cible) || routeInterne(repli) || '/library';
    const [path, query = ''] = route.split('?'), params = new URLSearchParams(query);
    params.delete('retour_nav');
    if (trouver(cleEntree, active?.portee)) params.set('origine', cleEntree); else params.delete('origine');
    return '#' + path + (params.size ? '?' + params.toString() : '');
  }
  function retourConnu({ query = {}, portee = active?.portee, repli = '/library' } = {}) {
    const e = trouver(query.origine, portee), fallback = routeInterne(repli) || '/library';
    if (!e) return { href: fallback, libelle: t('Retour') };
    const [path, q = ''] = e.route.split('?'), params = new URLSearchParams(q); params.set('retour_nav', e.cleEntree);
    return { href: path + '?' + params.toString(), cleEntree: e.cleEntree, libelle: t('Retour') };
  }
  function invaliderNavigation({ motif = 'bibliotheque_modifiee' } = {}) {
    const base = active?.portee?.base || dernierePortee?.base || repo.db.name;
    let values; try { values = JSON.parse(lire(local, EPOQUES)) || {}; } catch { values = {}; }
    const value = cleNeuve(); ephemere[base] = value; ecrire(local, EPOQUES, JSON.stringify({ ...values, [base]: value }));
    entrees = []; active = null; dernierePortee = null; revision++; derniereRestauration++; persister();
    fenetre?.dispatchEvent(new CustomEvent('mistu:navigation-invalidee', { detail: { motif } }));
  }
  function capturerVue(racine) {
    if (!active || !racine) return;
    const e = trouver(active.cleEntree, active.portee); if (!e) return;
    const nodes = [...racine.querySelectorAll('[data-nav-id]')], index = nodes.findIndex(n => n.getBoundingClientRect().bottom > 0), node = nodes[index];
    const focus = racine.contains(fenetre.document?.activeElement) ? fenetre.document.activeElement : null;
    e.etat.ancre = nettoyerAncre({ id: node?.dataset.navId, suivant: nodes[index + 1]?.dataset.navId, precedent: nodes[index - 1]?.dataset.navId,
      decalage: node?.getBoundingClientRect().top || 0, y: fenetre.scrollY || 0, focus: focus?.dataset.navFocus || (focus?.closest('[data-nav-id]') ? 'element' : e.etat.ancre?.focus), focusId: focus?.closest('[data-nav-id]')?.dataset.navId || e.etat.ancre?.focusId });
    const adresse = routeInterne(fenetre.location.hash);
    if (fenetre.history.state?.[CLE_ENTREE_NAV]?.cle === active.cleEntree && chemin(adresse) === chemin(e.route)) { e.route = adresse; active.route = adresse; }
    if (/^\/books\//.test(e.route)) (e.onglets ||= {})[e.etat.onglet] = copie(e.etat);
    e.touche = Date.now(); persister();
  }
  async function restaurerVue({ racine, cleEntree = active?.cleEntree, portee = active?.portee, estCourante = () => true } = {}) {
    const key = ++derniereRestauration, rev = revision, entry = trouver(cleEntree, portee), ancre = entry?.etat.ancre;
    let interrompu = false, observer = null, timer = null, reprises = 0, ouverture = null;
    const nettoyer = () => { observer?.disconnect(); clearTimeout(timer); for (const nom of ['wheel', 'touchstart', 'pointerdown', 'keydown']) fenetre.removeEventListener(nom, stopper); };
    const stopper = () => { interrompu = true; nettoyer(); };
    const vivante = () => !interrompu && key === derniereRestauration && rev === revision && admissible(portee) && estCourante() && racine?.isConnected;
    for (const nom of ['wheel', 'touchstart', 'pointerdown', 'keydown']) fenetre.addEventListener(nom, stopper, { passive: true });
    try {
      const cibler = id => [...racine.querySelectorAll('[data-nav-id]')].find(n => n.dataset.navId === id);
      const cibleOuverture = () => {
        const node = ouverture || racine.querySelector('[data-nav-ouverture="focus"]');
        return node && !node.disabled && node.getClientRects().length && racine.contains(node) ? node : null;
      };
      const deplacer = () => {
        const explicite = cibleOuverture(), node = ancre && (cibler(ancre.id) || cibler(ancre.suivant) || cibler(ancre.precedent));
        if (explicite) ouverture = explicite;
        const rect = explicite?.getBoundingClientRect();
        const y = explicite ? fenetre.scrollY + rect.top - Math.max(16, ((fenetre.innerHeight || 0) - rect.height) / 2)
          : node ? fenetre.scrollY + node.getBoundingClientRect().top - ancre.decalage : ancre?.y || 0;
        const maximum = Math.max(0, (fenetre.document?.documentElement.scrollHeight || 0) - (fenetre.innerHeight || 0));
        fenetre.scrollTo({ top: Math.min(Math.max(0, y), maximum), behavior: 'instant' });
      };
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => (fenetre.requestAnimationFrame || (f => setTimeout(f, 0)))(resolve));
        if (!vivante()) return false;
        deplacer();
      }
      if (ouverture && cibleOuverture() && vivante()) {
        ouverture.focus({ preventScroll: true });
        // Une ouverture explicite vaut pour ce montage ; un changement d'onglet retrouve ensuite son ancre.
        ouverture.removeAttribute('data-nav-ouverture');
      } else if (ancre?.focus && vivante()) {
        const scope = ancre.focusId ? cibler(ancre.focusId) || cibler(ancre.suivant) || cibler(ancre.precedent) || racine : racine;
        const node = scope.matches?.('[data-nav-focus="' + ancre.focus + '"]') ? scope : scope.querySelector('[data-nav-focus="' + ancre.focus + '"]');
        (node || (ancre.focus === 'element' ? scope.querySelector('a[href],button') : null) || racine.querySelector('[data-nav-focus="titre"]'))?.focus?.({ preventScroll: true });
      }
      if ((ancre || ouverture) && fenetre.ResizeObserver && vivante()) {
        observer = new fenetre.ResizeObserver(() => {
          if (!vivante() || reprises++ >= 3) { nettoyer(); return; }
          deplacer();
        });
        observer.observe(racine); timer = setTimeout(nettoyer, 500);
      }
      return true;
    } finally { if (!observer) nettoyer(); }
  }
  function lienBibliotheque() {
    const e = entrees.filter(e => chemin(e.route) === '/library' && pareils(e.portee, active?.portee) && admissible(e.portee)).sort((a, b) => b.touche - a.touche)[0];
    if (!e) return '#/library';
    const [path, q = ''] = e.route.split('?'), p = new URLSearchParams(q); p.set('retour_nav', e.cleEntree); return '#' + path + '?' + p;
  }
  function installerRetours(racine = fenetre.document) {
    const click = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const a = event.target.closest?.('a[href]'); if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return;
      const route = routeInterne(a.getAttribute('href')); if (!route) return;
      const e = trouver(new URLSearchParams(route.split('?')[1] || '').get('retour_nav'), active?.portee), courant = fenetre.history.state?.[CLE_ENTREE_NAV];
      if (e && e.chaine === courant?.chaine && chemin(e.route) === chemin(route) && Number.isSafeInteger(e.position) && Number.isSafeInteger(courant?.position) && e.position !== courant.position) { event.preventDefault(); fenetre.history.go(e.position - courant.position); }
    };
    racine?.addEventListener('click', click);
    fenetre.history.scrollRestoration = 'manual';
    return () => racine?.removeEventListener('click', click);
  }
  return { porteeNavigation, activerEntree, lireContexteListe, memoriserListe, lienAvecOrigine, retourConnu, invaliderNavigation, capturerVue, restaurerVue, lienBibliotheque, installerRetours };
}
const navigation = creerNavigation();
export const { porteeNavigation, activerEntree, lireContexteListe, memoriserListe, lienAvecOrigine, retourConnu, invaliderNavigation, capturerVue, restaurerVue, lienBibliotheque, installerRetours } = navigation;
