// Règles du service worker, partagées avec les tests : seules les requêtes GET de même origine SANS chaîne de requête sont mises en cache (spec § 5.6).
(function (root) {
  function isSameOriginGet(request, origin) {
    if (request.method !== 'GET') return false;
    const url = new URL(request.url);
    return url.origin === origin;
  }
  function shouldCache(request, origin) {
    if (!isSameOriginGet(request, origin)) return false;
    const url = new URL(request.url);
    return url.search === '';
  }
  // L10 : seule une entrée de l'inventaire peut être servie par le nouveau worker.
  // Les deux fonctions historiques restent inchangées pour ses prédécesseurs.
  function resolveShellPath(request, scope, paths) {
    if (request.method !== 'GET') return null;
    var base, url; try { base = new URL(scope); url = new URL(request.url); } catch (_) { return null; }
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || /%2f|%5c/i.test(url.pathname)) return null;
    var relative; try { relative = decodeURIComponent(url.pathname.slice(base.pathname.length)); } catch (_) { return null; }
    if (!relative && request.mode === 'navigate') relative = 'index.html';
    if (request.mode === 'navigate' && relative !== 'index.html') return null;
    return paths.has(relative) ? relative : null;
  }
  root.CuisineSwRules = { shouldCache: shouldCache, isSameOriginGet: isSameOriginGet, resolveShellPath: resolveShellPath };
})(typeof self !== 'undefined' ? self : globalThis);
