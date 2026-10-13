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
  root.CuisineSwRules = { shouldCache: shouldCache, isSameOriginGet: isSameOriginGet };
})(typeof self !== 'undefined' ? self : globalThis);
