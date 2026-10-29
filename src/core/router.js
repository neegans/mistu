// Routeur par fragment (#/chemin?query) : fonctionne depuis n'importe quel hébergement statique et en PWA installée.

const routes = [];
let notFound = null;

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

export function start(onRoute, { fenetre = window } = {}) {
  let derniere = null;
  const run = (event) => {
    const href = fenetre.location.hash || '#/';
    const state = fenetre.history.state && typeof fenetre.history.state === 'object' ? fenetre.history.state : {};
    let entree = state[CLE_ENTREE_NAV];
    const reconnue = entree && typeof entree.cle === 'string' && entree.href === href && Number.isSafeInteger(entree.position) && typeof entree.chaine === 'string';
    let type = event?.type === 'cuisineos:refresh' ? 'refresh' : event?.type === 'cuisineos:replace' ? 'replace' : derniere ? 'navigation' : 'initial';
    if (!reconnue) {
      entree = { cle: nouvelleCle(), href, position: (derniere?.position ?? -1) + 1, chaine: derniere?.chaine || nouvelleCle() };
      fenetre.history.replaceState({ ...state, [CLE_ENTREE_NAV]: entree }, '', href);
    } else if (derniere && entree.cle !== derniere.cle) type = 'retour';
    if (derniere?.cle === entree.cle && derniere.href === href && !['refresh', 'replace'].includes(type)) return;
    const precedente = derniere; derniere = { ...entree };
    onRoute({ ...resolve(href), navigation: { type, cleEntree: entree.cle, position: entree.position, chaine: entree.chaine, precedente } });
  };
  for (const nom of ['popstate', 'hashchange', 'cuisineos:refresh', 'cuisineos:replace']) fenetre.addEventListener(nom, run);
  run();
  return () => { for (const nom of ['popstate', 'hashchange', 'cuisineos:refresh', 'cuisineos:replace']) fenetre.removeEventListener(nom, run); };
}

// Re-rend la route courante (après une écriture ou un changement de réglage).
export function refresh() { window.dispatchEvent(new Event('cuisineos:refresh')); }
