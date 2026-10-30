// Routeur par fragment (#/chemin?query) : fonctionne depuis n'importe quel hébergement statique et en PWA installée.

const routes = [];
let notFound = null;
const gardesSortie = new Set();
export function enregistrerGardeSortie(garde) { gardesSortie.add(garde); return () => gardesSortie.delete(garde); }
function avantNavigation(demande) {
  const gardes = [...gardesSortie];
  const poursuivre = index => {
    for (; index < gardes.length; index++) {
      const accord = gardes[index](demande);
      if (accord?.then) {
        const suivante = index + 1;
        return Promise.resolve(accord).then(valeur => valeur === false ? false : poursuivre(suivante));
      }
      if (accord === false) return false;
    }
    return true;
  };
  // Une ancienne vue démontée autorise immédiatement ; seules les gardes actives imposent une attente.
  return poursuivre(0);
}

export function route(pattern, handler) {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^\\/]+)'; }) + '$');
  routes.push({ regex, keys, handler, pattern });
}

export function setNotFound(handler) { notFound = handler; }

export function parseHash(hash = location.hash) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart || '/';
  const query = {};
  for (const [k, v] of new URLSearchParams(queryPart)) query[k] = v;
  return { path, query };
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) { remplacerAdresse(target); window.dispatchEvent(new Event('cuisineos:replace')); }
  else location.hash = target;
}

// Retire ou pose un paramètre d'adresse SANS re-rendu : history.replaceState ne déclenche pas hashchange. Injecté dans les
// vues qui s'en servent (geste `historique.remplacer`), donc espionnable dans la suite.
export const CLE_ENTREE_NAV = 'mistuNavigation';
const nouvelleCle = () => globalThis.crypto?.randomUUID?.() || 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
export function remplacerAdresse(hash, { fenetre = window } = {}) {
  const href = hash.startsWith('#') ? hash : '#' + hash;
  const state = fenetre.history.state && typeof fenetre.history.state === 'object' ? fenetre.history.state : {};
  fenetre.history.replaceState({ ...state, ...(state[CLE_ENTREE_NAV] ? { [CLE_ENTREE_NAV]: { ...state[CLE_ENTREE_NAV], href } } : {}) }, '', href);
}

export function currentPath() { return parseHash().path; }

export function buildQuery(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
}

export function resolve(hash = location.hash) {
  const { path, query } = parseHash(hash);
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params = {};
      try { r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); } catch { continue; }
      return { handler: r.handler, params, query, path, pattern: r.pattern };
    }
  }
  return { handler: notFound, params: {}, query, path, pattern: null };
}

export function start(onRoute, { fenetre = window, avantRoute = avantNavigation } = {}) {
  let derniere = null, dernierEtat = null, observee = null, compensation = null, demandeId = 0, arretee = false;
  const run = (event) => {
    const href = fenetre.location.hash || '#/';
    const state = fenetre.history.state && typeof fenetre.history.state === 'object' ? fenetre.history.state : {};
    let entree = state[CLE_ENTREE_NAV];
    const reconnue = entree && typeof entree.cle === 'string' && entree.href === href && Number.isSafeInteger(entree.position) && typeof entree.chaine === 'string';
    let type = event?.type === 'cuisineos:refresh' ? 'refresh' : event?.type === 'cuisineos:replace' ? 'replace' : derniere ? 'navigation' : 'initial';
    if (!reconnue) {
      entree = { cle: nouvelleCle(), href, position: (observee?.position ?? derniere?.position ?? -1) + 1, chaine: observee?.chaine || derniere?.chaine || nouvelleCle() };
      fenetre.history.replaceState({ ...state, [CLE_ENTREE_NAV]: entree }, '', href);
    } else if (derniere && entree.cle !== derniere.cle) type = 'retour';
    const indexNavigateur = fenetre.navigation?.currentEntry?.index;
    entree = { ...entree, indexNavigateur: Number.isSafeInteger(indexNavigateur) ? indexNavigateur : null };
    if (compensation?.cle === entree.cle && compensation.href === href) { compensation = null; observee = { ...entree }; return; }
    if (observee?.cle === entree.cle && observee.href === href && !['refresh', 'replace'].includes(type)) return;
    observee = { ...entree };
    if (derniere?.cle === entree.cle && derniere.href === href && !['refresh', 'replace'].includes(type)) { demandeId++; return; }
    const precedente = derniere, etatPrecedent = dernierEtat, id = ++demandeId;
    const cible = { ...resolve(href), navigation: { type, cleEntree: entree.cle, position: entree.position, chaine: entree.chaine, precedente } };
    const finir = autorisee => {
      if (arretee || id !== demandeId) return;
      if (autorisee !== false) { derniere = { ...entree }; dernierEtat = { ...fenetre.history.state }; onRoute(cible); return; }
      if (!precedente || precedente.cle === entree.cle && precedente.href === href) return;
      // Le navigateur a déjà changé d’entrée. Revenir à la clé exacte sans fabriquer une nouvelle entrée.
      compensation = { ...precedente };
      const delta = precedente.indexNavigateur !== null && entree.indexNavigateur !== null ? precedente.indexNavigateur - entree.indexNavigateur
        : precedente.chaine === entree.chaine ? precedente.position - entree.position : null;
      if (delta !== null && delta !== 0) fenetre.history.go(delta);
      else { compensation = null; fenetre.history.replaceState(etatPrecedent, '', precedente.href); observee = { ...precedente }; }
    };
    if (!precedente) { finir(true); return; }
    let accord;
    try { accord = avantRoute({ ...cible, depuis: { ...precedente }, event: event?.type || 'initial' }); }
    catch { finir(false); return; }
    if (accord?.then) Promise.resolve(accord).then(finir, () => finir(false)); else finir(accord);
  };
  for (const nom of ['popstate', 'hashchange', 'cuisineos:refresh', 'cuisineos:replace']) fenetre.addEventListener(nom, run);
  run();
  return () => { arretee = true; demandeId++; for (const nom of ['popstate', 'hashchange', 'cuisineos:refresh', 'cuisineos:replace']) fenetre.removeEventListener(nom, run); };
}

// Re-rend la route courante (après une écriture ou un changement de réglage).
export function refresh() { window.dispatchEvent(new Event('cuisineos:refresh')); }
