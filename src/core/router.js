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
  if (replace) location.replace(target);
  else location.hash = target;
}

// Retire ou pose un paramètre d'adresse SANS re-rendu : history.replaceState ne déclenche pas hashchange. Injecté dans les
// vues qui s'en servent (geste `historique.remplacer`), donc espionnable dans la suite.
export function remplacerAdresse(hash) { history.replaceState(null, '', hash.startsWith('#') ? hash : '#' + hash); }

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
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params, query, path, pattern: r.pattern };
    }
  }
  return { handler: notFound, params: {}, query, path, pattern: null };
}

export function start(onRoute) {
  const run = () => onRoute(resolve());
  window.addEventListener('hashchange', run);
  window.addEventListener('cuisineos:refresh', run);
  run();
}

// Re-rend la route courante (après une écriture ou un changement de réglage).
export function refresh() { window.dispatchEvent(new Event('cuisineos:refresh')); }
